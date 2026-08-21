import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FILING_PAYLOAD_CUSTODY_CLAIM,
  FILING_PAYLOAD_CUSTODY_ERROR_CODES,
  FILING_PAYLOAD_CUSTODY_FAULT_PHASES,
  FILING_PAYLOAD_CUSTODY_FIXTURE,
  FILING_PAYLOAD_CUSTODY_RETENTION_POLICY,
  FilingPayloadCustodyError,
  createFileSystemFilingPayloadCustodyTestHarness,
  createSyntheticFilingPayloadFixture,
  createSyntheticInMemoryFilingPayloadKeyStore,
  type FilingPayloadCustodyFaultPhase,
  type FilingPayloadStageCommand,
} from "./payload-custody";

const CREATED_AT = Date.parse("2026-08-20T12:00:00.000Z");
const SOURCE_BINDING = `sha256:${"a".repeat(64)}` as const;

describe("Cycle 2c synthetic filing payload custody", () => {
  it("stages, replays, reads, expires at the half-open boundary, and leaves zero residue", async () => {
    const context = await createContext();
    const callerBytes = createSyntheticFilingPayloadFixture();
    const expectedBytes = Uint8Array.from(callerBytes);
    const command = stageCommand(callerBytes);
    try {
      const receipt = await context.harness.boundary.stage(command);
      callerBytes.fill(0);
      const replay = await context.harness.boundary.stage(
        stageCommand(createSyntheticFilingPayloadFixture()),
      );

      expect(replay).toEqual(receipt);
      expect(receipt).toMatchObject({
        byteLength: FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength,
        claim: FILING_PAYLOAD_CUSTODY_CLAIM,
        contentSha256: FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256,
        createdAt: "2026-08-20T12:00:00.000Z",
        fixtureId: FILING_PAYLOAD_CUSTODY_FIXTURE.fixtureId,
        payloadExpiresAt: "2026-08-21T12:00:00.000Z",
        retentionClass: FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.class,
        sourceBindingSha256: SOURCE_BINDING,
        state: "available",
        transitionedAt: null,
        version: 1,
      });
      expect(receipt.payloadId).toMatch(/^payload_[0-9a-f]{32}$/u);
      expect(Object.isFrozen(receipt)).toBe(true);
      expect(
        await context.harness.boundary.read({ payloadId: receipt.payloadId }),
      ).toEqual(expectedBytes);

      const recordDirectory = join(
        context.harness.workspaceDirectory,
        "records",
        receipt.payloadId,
      );
      expect((await readdir(recordDirectory)).sort()).toEqual([
        "audit",
        "payload",
      ]);
      expect(await readdir(join(recordDirectory, "audit"))).toEqual([
        "available.json",
      ]);
      const ciphertext = await readFile(
        join(recordDirectory, "payload", "ciphertext.bin"),
      );
      expect(Uint8Array.from(ciphertext)).not.toEqual(expectedBytes);

      await expectCustodyFailure(
        context.harness.boundary.expire({ payloadId: receipt.payloadId }),
        "retention_active",
      );
      context.clock.milliseconds = CREATED_AT + 86_400_000;
      await expectCustodyFailure(
        context.harness.boundary.read({ payloadId: receipt.payloadId }),
        "payload_expired",
      );
      const unavailable = await context.harness.boundary.expire({
        payloadId: receipt.payloadId,
      });
      expect(unavailable).toMatchObject({
        payloadId: receipt.payloadId,
        state: "logical_key_unavailability",
        transitionedAt: "2026-08-21T12:00:00.000Z",
        version: 2,
      });
      expect(
        await context.harness.boundary.expire({ payloadId: receipt.payloadId }),
      ).toEqual(unavailable);
      expect(await readdir(join(recordDirectory, "payload"))).toEqual([]);
      expect((await readdir(join(recordDirectory, "audit"))).sort()).toEqual([
        "available.json",
        "logical-key-unavailability.json",
      ]);
      await expectCustodyFailure(
        context.harness.boundary.read({ payloadId: receipt.payloadId }),
        "payload_unavailable",
      );
      await expectCustodyFailure(
        context.harness.boundary.stage(
          stageCommand(createSyntheticFilingPayloadFixture()),
        ),
        "resurrection_blocked",
      );
      expect(
        await context.harness.boundary.inspectAudit({
          payloadId: receipt.payloadId,
        }),
      ).toMatchObject({
        payloadId: receipt.payloadId,
        state: "logical_key_unavailability",
        version: 2,
      });

      await context.harness.boundary.close();
      context.closed = true;
      expect(await readdir(context.parentDirectory)).toEqual([]);
      await expectCustodyFailure(
        context.harness.boundary.read({ payloadId: receipt.payloadId }),
        "closed",
      );
    } finally {
      await disposeContext(context);
    }
  });

  it("rejects a digest mismatch and same-content metadata conflict without changing the record", async () => {
    const context = await createContext();
    try {
      const modified = createSyntheticFilingPayloadFixture();
      modified[0] = (modified[0] ?? 0) ^ 0xff;
      await expectCustodyFailure(
        context.harness.boundary.stage(stageCommand(modified)),
        "hash_mismatch",
      );
      expect(
        await readdir(join(context.harness.workspaceDirectory, "records")),
      ).toEqual([]);

      const receipt = await context.harness.boundary.stage(
        stageCommand(createSyntheticFilingPayloadFixture()),
      );
      await expectCustodyFailure(
        context.harness.boundary.stage({
          ...stageCommand(createSyntheticFilingPayloadFixture()),
          sourceBindingSha256: `sha256:${"b".repeat(64)}`,
        }),
        "state_conflict",
      );
      expect(
        await context.harness.boundary.read({ payloadId: receipt.payloadId }),
      ).toEqual(createSyntheticFilingPayloadFixture());
    } finally {
      await disposeContext(context);
    }
  });

  it("rolls back every pre-publication fault and can stage cleanly afterward", async () => {
    for (const faultPhase of [
      "key_created",
      "ciphertext_written",
      "audit_written",
      "before_publish",
      "published",
    ] satisfies readonly FilingPayloadCustodyFaultPhase[]) {
      let enabled = true;
      const context = await createContext((phase) => {
        if (enabled && phase === faultPhase) throw new Error("SECRET-CANARY");
      });
      try {
        await expectCustodyFailure(
          context.harness.boundary.stage(
            stageCommand(createSyntheticFilingPayloadFixture()),
          ),
          "io_failure",
        );
        expect(
          await readdir(join(context.harness.workspaceDirectory, "records")),
        ).toEqual([]);
        expect(
          await readdir(join(context.harness.workspaceDirectory, ".staging")),
        ).toEqual([]);
        enabled = false;
        await expect(
          context.harness.boundary.stage(
            stageCommand(createSyntheticFilingPayloadFixture()),
          ),
        ).resolves.toMatchObject({ state: "available", version: 1 });
      } finally {
        await disposeContext(context);
      }
    }
  });

  it("resumes an authenticated key-first transition after each post-forget fault", async () => {
    for (const faultPhase of [
      "key_forgotten",
      "before_audit_update",
      "audit_updated",
      "ciphertext_deleted",
    ] satisfies readonly FilingPayloadCustodyFaultPhase[]) {
      let enabled = false;
      const context = await createContext((phase) => {
        if (enabled && phase === faultPhase) throw new Error("SECRET-CANARY");
      });
      try {
        const receipt = await context.harness.boundary.stage(
          stageCommand(createSyntheticFilingPayloadFixture()),
        );
        context.clock.milliseconds = CREATED_AT + 86_400_000;
        enabled = true;
        await expectCustodyFailure(
          context.harness.boundary.expire({ payloadId: receipt.payloadId }),
          faultPhase === "key_forgotten" ? "key_store_failure" : "io_failure",
        );
        enabled = false;
        await expect(
          context.harness.boundary.expire({ payloadId: receipt.payloadId }),
        ).resolves.toMatchObject({
          state: "logical_key_unavailability",
          version: 2,
        });
        await expectCustodyFailure(
          context.harness.boundary.read({ payloadId: receipt.payloadId }),
          "payload_unavailable",
        );
      } finally {
        await disposeContext(context);
      }
    }
  });

  it("normalizes close faults, rejects clock rollback and date overflow, and pins the closed contract", async () => {
    let closeFault = true;
    const context = await createContext((phase) => {
      if (closeFault && phase === "before_close_cleanup")
        throw new Error("SECRET-CANARY");
    });
    try {
      const receipt = await context.harness.boundary.stage(
        stageCommand(createSyntheticFilingPayloadFixture()),
      );
      context.clock.milliseconds -= 1;
      await expectCustodyFailure(
        context.harness.boundary.read({
          payloadId: receipt.payloadId,
        }),
        "invalid_input",
      );
      await expectCustodyFailure(
        context.harness.boundary.close(),
        "cleanup_failure",
      );
      closeFault = false;
      await context.harness.boundary.close();
      context.closed = true;
      expect(await readdir(context.parentDirectory)).toEqual([]);
    } finally {
      await disposeContext(context);
    }

    const overflow = await createContext(undefined, 8_640_000_000_000_000);
    try {
      await expectCustodyFailure(
        overflow.harness.boundary.stage(
          stageCommand(createSyntheticFilingPayloadFixture()),
        ),
        "invalid_input",
      );
    } finally {
      await disposeContext(overflow);
    }

    expect(FILING_PAYLOAD_CUSTODY_ERROR_CODES).toEqual([
      "invalid_input",
      "hash_mismatch",
      "state_conflict",
      "retention_active",
      "payload_expired",
      "payload_unavailable",
      "resurrection_blocked",
      "record_invalid",
      "key_store_failure",
      "io_failure",
      "cleanup_failure",
      "closed",
    ]);
    expect(FILING_PAYLOAD_CUSTODY_FAULT_PHASES).toEqual([
      "key_created",
      "ciphertext_written",
      "audit_written",
      "before_publish",
      "published",
      "before_key_forget",
      "key_forgotten",
      "before_audit_update",
      "audit_updated",
      "ciphertext_deleted",
      "before_close_cleanup",
    ]);
  });
});

interface TestContext {
  closed: boolean;
  readonly clock: { milliseconds: number };
  readonly harness: Awaited<
    ReturnType<typeof createFileSystemFilingPayloadCustodyTestHarness>
  >;
  readonly parentDirectory: string;
}

async function createContext(
  afterPhase?: (phase: FilingPayloadCustodyFaultPhase) => void,
  milliseconds = CREATED_AT,
): Promise<TestContext> {
  const parentDirectory = await mkdtemp(
    join(tmpdir(), "research-cockpit-custody-test-"),
  );
  const clock = { milliseconds };
  let entropyCounter = 1;
  const harness = await createFileSystemFilingPayloadCustodyTestHarness(
    {
      clock: { now: () => new Date(clock.milliseconds) },
      entropy: {
        bytes: (length: number) => {
          const bytes = new Uint8Array(length);
          for (let index = 0; index < bytes.byteLength; index += 1)
            bytes[index] = (entropyCounter * 47 + index * 29) & 0xff;
          entropyCounter += 1;
          return bytes;
        },
      },
      keyStore: createSyntheticInMemoryFilingPayloadKeyStore(),
      workspaceParentDirectory: parentDirectory,
    },
    afterPhase === undefined ? {} : { afterPhase },
  );
  return { closed: false, clock, harness, parentDirectory };
}

function stageCommand(payload: Uint8Array): FilingPayloadStageCommand {
  return {
    contentSha256: FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256,
    fixtureId: FILING_PAYLOAD_CUSTODY_FIXTURE.fixtureId,
    payload,
    retentionClass: FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.class,
    sourceBindingSha256: SOURCE_BINDING,
  };
}

async function expectCustodyFailure(
  promise: Promise<unknown>,
  code: FilingPayloadCustodyError["code"],
): Promise<void> {
  let observed: unknown;
  try {
    await promise;
  } catch (error) {
    observed = error;
  }
  expect(observed).toBeInstanceOf(FilingPayloadCustodyError);
  expect(observed).toMatchObject({
    code,
    message: "FILING_PAYLOAD_CUSTODY_FAILURE",
  });
  expect(JSON.stringify(observed)).not.toContain("SECRET-CANARY");
}

async function disposeContext(context: TestContext): Promise<void> {
  if (!context.closed)
    await context.harness.boundary.close().catch(() => undefined);
  await rm(context.parentDirectory, { force: true, recursive: true });
}
