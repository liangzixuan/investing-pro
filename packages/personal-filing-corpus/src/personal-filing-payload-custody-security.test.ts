import { createHash } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES,
  PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS,
  PERSONAL_FILING_PAYLOAD_DELETE_CONFIRMATION,
  PersonalFilingPayloadCustodyError,
  deletePersonalFilingPayloadCustody,
  deletePersonalFilingPayloadCustodyWithRuntime,
  recordPersonalFilingPayloadCustody,
  recordPersonalFilingPayloadCustodyWithRuntime,
  type PersonalFilingPayloadCustodyFailureCode,
  type PersonalFilingPayloadCustodyInput,
  type PersonalFilingPayloadCustodyTestRuntime,
  type PersonalFilingPayloadDeletionInput,
} from "./personal-filing-payload-custody";
import { personalFilingPayloadRelativePath } from "./personal-filing-payload-identity";

type JsonRecord = Record<string, unknown>;

interface Fixture {
  readonly auditRootPath: string;
  readonly input: PersonalFilingPayloadCustodyInput;
  readonly payloadPaths: readonly string[];
  readonly payloadRootPath: string;
  readonly payloads: readonly Uint8Array[];
  readonly temporaryDirectory: string;
}

const temporaryDirectories: string[] = [];
const FIXED_TIME = "2026-08-28T20:00:00.000Z";
const LATER_TIME = "2026-08-28T20:01:00.000Z";
const ERROR_CANARY = "CUSTODY_SECURITY_SECRET_CANARY_8f41";

afterEach(async () => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { force: true, recursive: true });
  }
});

describe("personal filing payload custody security boundary", () => {
  it("accepts exactly one public argument with exact enumerable data descriptors", async () => {
    const fixture = await buildFixture([new Uint8Array([0x11])]);
    const duplicate = Reflect.apply(recordPersonalFilingPayloadCustody, null, [
      fixture.input,
      fixture.input,
    ]) as Promise<unknown>;
    await expectFailure(
      duplicate,
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );

    await expectFailure(
      recordPersonalFilingPayloadCustody({
        ...fixture.input,
        extra: ERROR_CANARY,
      } as PersonalFilingPayloadCustodyInput),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );

    const symbol = Symbol(ERROR_CANARY);
    await expectFailure(
      recordPersonalFilingPayloadCustody({
        ...fixture.input,
        [symbol]: ERROR_CANARY,
      } as unknown as PersonalFilingPayloadCustodyInput),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );

    const declarationGetter = vi.fn(() => {
      throw new Error(ERROR_CANARY);
    });
    const accessorInput: Record<string, unknown> = {
      auditRootPath: fixture.auditRootPath,
      manifest: fixture.input.manifest,
      payloadRootPath: fixture.payloadRootPath,
    };
    Object.defineProperty(accessorInput, "declaration", {
      enumerable: true,
      get: declarationGetter,
    });
    await expectFailure(
      recordPersonalFilingPayloadCustody(
        accessorInput as unknown as PersonalFilingPayloadCustodyInput,
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );
    expect(declarationGetter).not.toHaveBeenCalled();

    const getTrap = vi.fn(() => {
      throw new Error(ERROR_CANARY);
    });
    const result = await recordPersonalFilingPayloadCustodyWithRuntime(
      new Proxy(fixture.input, { get: getTrap }),
      runtimeAt(FIXED_TIME),
    );
    expect(result.status).toBe(
      "local_payload_custody_recorded_for_personal_use",
    );
    expect(getTrap).not.toHaveBeenCalled();
  });

  it("applies the same closed descriptor and argument boundary to deletion", async () => {
    const fixture = await buildFixture([new Uint8Array([0x12])]);
    const custody = await recordFixture(fixture);
    const input = deletionInput(fixture, custody.custodyRecordSha256);

    const duplicate = Reflect.apply(deletePersonalFilingPayloadCustody, null, [
      input,
      input,
    ]) as Promise<unknown>;
    await expectFailure(
      duplicate,
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );
    await expectFailure(
      deletePersonalFilingPayloadCustody({
        ...input,
        extra: ERROR_CANARY,
      } as PersonalFilingPayloadDeletionInput),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );
    await expectFailure(
      deletePersonalFilingPayloadCustody({
        ...input,
        [Symbol(ERROR_CANARY)]: true,
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );

    const confirmationGetter = vi.fn(() => {
      throw new Error(ERROR_CANARY);
    });
    const accessorInput: Record<string, unknown> = {
      auditRootPath: input.auditRootPath,
      declaration: input.declaration,
      expectedCustodyRecordSha256: input.expectedCustodyRecordSha256,
      manifest: input.manifest,
      payloadRootPath: input.payloadRootPath,
    };
    Object.defineProperty(accessorInput, "confirmation", {
      enumerable: true,
      get: confirmationGetter,
    });
    await expectFailure(
      deletePersonalFilingPayloadCustody(
        accessorInput as unknown as PersonalFilingPayloadDeletionInput,
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );
    expect(confirmationGetter).not.toHaveBeenCalled();

    const getTrap = vi.fn(() => {
      throw new Error(ERROR_CANARY);
    });
    const result = await deletePersonalFilingPayloadCustodyWithRuntime(
      new Proxy(input, { get: getTrap }),
      runtimeAt(LATER_TIME),
    );
    expect(result.status).toBe(
      "live_payload_names_absent_after_explicit_personal_delete",
    );
    expect(getTrap).not.toHaveBeenCalled();
  });

  it("owns public input values and document bytes before the first await", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode("owned-custody-input"),
    ]);
    const declaration = new Uint8Array(fixture.input.declaration);
    const manifest = new Uint8Array(fixture.input.manifest);
    const input: {
      auditRootPath: string;
      declaration: Uint8Array;
      manifest: Uint8Array;
      payloadRootPath: string;
    } = {
      auditRootPath: fixture.auditRootPath,
      declaration,
      manifest,
      payloadRootPath: fixture.payloadRootPath,
    };
    const promise = recordPersonalFilingPayloadCustody(input);
    declaration.fill(0);
    manifest.fill(0);
    input.auditRootPath = join(fixture.temporaryDirectory, ERROR_CANARY);
    input.payloadRootPath = input.auditRootPath;

    const custody = await promise;
    expect(custody.manifestSha256).toBe(sha256(fixture.input.manifest));

    const deleteDeclaration = new Uint8Array(fixture.input.declaration);
    const deleteManifest = new Uint8Array(fixture.input.manifest);
    const deleteInput: {
      auditRootPath: string;
      confirmation: string;
      declaration: Uint8Array;
      expectedCustodyRecordSha256: string;
      manifest: Uint8Array;
      payloadRootPath: string;
    } = {
      auditRootPath: fixture.auditRootPath,
      confirmation: PERSONAL_FILING_PAYLOAD_DELETE_CONFIRMATION,
      declaration: deleteDeclaration,
      expectedCustodyRecordSha256: custody.custodyRecordSha256,
      manifest: deleteManifest,
      payloadRootPath: fixture.payloadRootPath,
    };
    const deletePromise = deletePersonalFilingPayloadCustody(
      deleteInput as PersonalFilingPayloadDeletionInput,
    );
    deleteDeclaration.fill(0);
    deleteManifest.fill(0);
    deleteInput.confirmation = ERROR_CANARY;
    deleteInput.expectedCustodyRecordSha256 = `sha256:${"0".repeat(64)}`;
    deleteInput.payloadRootPath = join(
      fixture.temporaryDirectory,
      ERROR_CANARY,
    );

    const deletion = await deletePromise;
    expect(deletion.confirmedAbsentFileCount).toBe(1);
  });

  it("rejects same, ancestor, and descendant payload/audit roots", async () => {
    const fixture = await buildFixture([new Uint8Array([0x21])]);
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        {
          ...fixture.input,
          auditRootPath: fixture.payloadRootPath,
        },
        runtimeAt(FIXED_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        {
          ...fixture.input,
          auditRootPath: fixture.temporaryDirectory,
        },
        runtimeAt(FIXED_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );

    const nestedAudit = join(fixture.payloadRootPath, "nested-audit");
    await mkdir(nestedAudit);
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        { ...fixture.input, auditRootPath: nestedAudit },
        runtimeAt(FIXED_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
  });

  it("rejects symlinked or junction root aliases", async ({ skip }) => {
    const fixture = await buildFixture([new Uint8Array([0x22])]);
    const payloadAlias = join(fixture.temporaryDirectory, "payload-alias");
    const auditAlias = join(fixture.temporaryDirectory, "audit-alias");
    try {
      await symlink(
        fixture.payloadRootPath,
        payloadAlias,
        process.platform === "win32" ? "junction" : "dir",
      );
      await symlink(
        fixture.auditRootPath,
        auditAlias,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if (isSystemErrorCode(error, ["EACCES", "EPERM"])) {
        skip();
        return;
      }
      throw error;
    }

    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        { ...fixture.input, payloadRootPath: payloadAlias },
        runtimeAt(FIXED_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
    );
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        { ...fixture.input, auditRootPath: auditAlias },
        runtimeAt(FIXED_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
  });

  it("rejects hard-linked, extra, and content-mutated payload sets before custody", async () => {
    const hardLinkFixture = await buildFixture([
      new TextEncoder().encode("hard-link-payload"),
    ]);
    const hardLinkSource = join(
      hardLinkFixture.temporaryDirectory,
      "hard-link-source.payload",
    );
    await rename(hardLinkFixture.payloadPaths[0]!, hardLinkSource);
    await link(hardLinkSource, hardLinkFixture.payloadPaths[0]!);
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        hardLinkFixture.input,
        runtimeAt(FIXED_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
    );

    const extraFixture = await buildFixture([new Uint8Array([0x31])]);
    await writeFile(
      join(extraFixture.payloadRootPath, "unexpected.payload"),
      new Uint8Array([0x31]),
    );
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        extraFixture.input,
        runtimeAt(FIXED_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
    );

    const mutationFixture = await buildFixture([
      new TextEncoder().encode("expected-content"),
    ]);
    await writeFile(
      mutationFixture.payloadPaths[0]!,
      new TextEncoder().encode("mutated!-content"),
    );
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        mutationFixture.input,
        runtimeAt(FIXED_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
    );
  });

  it("rejects a final-component payload symlink", async ({ skip }) => {
    const payload = new TextEncoder().encode("outside-symlink-payload");
    const fixture = await buildFixture([payload]);
    const outside = join(fixture.temporaryDirectory, "outside.payload");
    await writeFile(outside, payload);
    await unlink(fixture.payloadPaths[0]!);
    try {
      await symlink(outside, fixture.payloadPaths[0]!, "file");
    } catch (error) {
      if (isSystemErrorCode(error, ["EACCES", "EPERM"])) {
        skip();
        return;
      }
      throw error;
    }

    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        fixture.input,
        runtimeAt(FIXED_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
    );
  });

  it("rejects canonical tamper, noncanonical bytes, and oversized audit records", async () => {
    const tamperFixture = await buildFixture([new Uint8Array([0x41])]);
    await recordFixture(tamperFixture);
    const tamperPath = custodyAuditPath(tamperFixture);
    const tampered = JSON.parse(
      await readFile(tamperPath, "utf8"),
    ) as JsonRecord;
    tampered.state = "tampered";
    await writeFile(tamperPath, canonicalBytes(tampered));
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        tamperFixture.input,
        runtimeAt(LATER_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
    );

    const noncanonicalFixture = await buildFixture([new Uint8Array([0x42])]);
    await recordFixture(noncanonicalFixture);
    const noncanonicalPath = custodyAuditPath(noncanonicalFixture);
    const parsed = JSON.parse(
      await readFile(noncanonicalPath, "utf8"),
    ) as JsonRecord;
    await writeFile(noncanonicalPath, `${JSON.stringify(parsed, null, 2)}\n`);
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        noncanonicalFixture.input,
        runtimeAt(LATER_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
    );

    const oversizedFixture = await buildFixture([new Uint8Array([0x43])]);
    await recordFixture(oversizedFixture);
    await writeFile(
      custodyAuditPath(oversizedFixture),
      new Uint8Array(
        PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS.auditFileBytes + 1,
      ).fill(0x61),
    );
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        oversizedFixture.input,
        runtimeAt(LATER_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
    );
  });

  it("rejects hard-linked custody audit records", async () => {
    const hardLinkFixture = await buildFixture([new Uint8Array([0x44])]);
    await recordFixture(hardLinkFixture);
    await link(
      custodyAuditPath(hardLinkFixture),
      join(hardLinkFixture.temporaryDirectory, "custody-hard-link.json"),
    );
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        hardLinkFixture.input,
        runtimeAt(LATER_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
    );
  });

  it("rejects symlinked custody audit records", async ({ skip }) => {
    const symlinkFixture = await buildFixture([new Uint8Array([0x45])]);
    await recordFixture(symlinkFixture);
    const custodyPath = custodyAuditPath(symlinkFixture);
    const outside = join(
      symlinkFixture.temporaryDirectory,
      "outside-custody.json",
    );
    await writeFile(outside, await readFile(custodyPath));
    await unlink(custodyPath);
    try {
      await symlink(outside, custodyPath, "file");
    } catch (error) {
      if (isSystemErrorCode(error, ["EACCES", "EPERM"])) {
        skip();
        return;
      }
      throw error;
    }
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        symlinkFixture.input,
        runtimeAt(LATER_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
    );
  });

  it("detects payload and audit root namespace swaps at phase boundaries", async () => {
    const payloadFixture = await buildFixture([new Uint8Array([0x51])]);
    const displacedPayload = join(
      payloadFixture.temporaryDirectory,
      "displaced-payloads",
    );
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(payloadFixture.input, {
        now: () => new Date(FIXED_TIME),
        phase: async (phase) => {
          if (phase !== "after_payload_identity") return;
          await rename(payloadFixture.payloadRootPath, displacedPayload);
          await mkdir(payloadFixture.payloadRootPath);
          await writeFile(
            payloadFixture.payloadPaths[0]!,
            payloadFixture.payloads[0]!,
          );
        },
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
    );

    const auditFixture = await buildFixture([new Uint8Array([0x52])]);
    const displacedAudit = join(
      auditFixture.temporaryDirectory,
      "displaced-audit",
    );
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(auditFixture.input, {
        now: () => new Date(FIXED_TIME),
        phase: async (phase) => {
          if (phase !== "after_custody_record_published") return;
          await rename(auditFixture.auditRootPath, displacedAudit);
          await mkdir(auditFixture.auditRootPath);
        },
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
  });

  it("rejects payload rewrite after identity and payload removal during custody replay", async () => {
    const rewritePayload = new TextEncoder().encode("rewrite-after-identity");
    const rewriteFixture = await buildFixture([rewritePayload]);
    let rewritten = false;
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(rewriteFixture.input, {
        now: () => new Date(FIXED_TIME),
        phase: async (phase) => {
          if (phase !== "after_payload_identity" || rewritten) return;
          rewritten = true;
          await writeFile(
            rewriteFixture.payloadPaths[0]!,
            new Uint8Array(rewritePayload.byteLength).fill(0x78),
          );
        },
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
    );
    expect(await readdir(rewriteFixture.auditRootPath)).toEqual([]);

    const replayFixture = await buildFixture([
      new TextEncoder().encode("remove-during-replay"),
    ]);
    await recordFixture(replayFixture);
    const custodyBytes = await readFile(custodyAuditPath(replayFixture));
    let removed = false;
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(replayFixture.input, {
        now: () => new Date(LATER_TIME),
        phase: async (phase) => {
          if (phase !== "after_payload_identity" || removed) return;
          removed = true;
          await unlink(replayFixture.payloadPaths[0]!);
        },
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
    );
    expect(await readdir(replayFixture.auditRootPath)).toEqual([
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
    ]);
    expect(await readFile(custodyAuditPath(replayFixture))).toEqual(
      custodyBytes,
    );
  });

  it("rejects canonical custody tamper after initial publication", async () => {
    const fixture = await buildFixture([new Uint8Array([0x53])]);
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(fixture.input, {
        now: () => new Date(FIXED_TIME),
        phase: async (phase) => {
          if (phase !== "after_custody_record_published") return;
          await rewriteCanonicalAudit(custodyAuditPath(fixture), (record) => {
            record.status = "tampered-after-publication";
          });
        },
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
    );
    expect(await fileExists(custodyAuditPath(fixture))).toBe(true);
  });

  it("resumes an empty payload root after failure before terminal receipt publication", async () => {
    const fixture = await buildFixture([
      new Uint8Array([0x61]),
      new Uint8Array([0x62, 0x63]),
    ]);
    const custody = await recordFixture(fixture);
    const input = deletionInput(fixture, custody.custodyRecordSha256);
    await expectFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(input, {
        now: () => new Date(LATER_TIME),
        phase: (phase) => {
          if (phase === "before_deletion_receipt_publish") {
            throw new Error(ERROR_CANARY);
          }
        },
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );

    expect(await readdir(fixture.payloadRootPath)).toEqual([]);
    expect((await readdir(fixture.auditRootPath)).sort()).toEqual(
      [
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
      ].sort(),
    );

    const receipt = await deletePersonalFilingPayloadCustodyWithRuntime(
      input,
      runtimeAt("2026-08-28T20:02:00.000Z"),
    );
    expect(receipt.confirmedAbsentFileCount).toBe(2);
    expect(receipt.confirmedAbsentBytes).toBe(3);
    expect((await readdir(fixture.auditRootPath)).sort()).toEqual(
      [
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceipt,
      ].sort(),
    );
  });

  it("rejects canonical custody or intent tamper before receipt publication", async () => {
    const custodyFixture = await buildFixture([new Uint8Array([0x64])]);
    const custody = await recordFixture(custodyFixture);
    const custodyInput = deletionInput(
      custodyFixture,
      custody.custodyRecordSha256,
    );
    await expectOneOfFailures(
      deletePersonalFilingPayloadCustodyWithRuntime(custodyInput, {
        now: () => new Date(LATER_TIME),
        phase: async (phase) => {
          if (phase !== "before_deletion_receipt_publish") return;
          await rewriteCanonicalAudit(
            custodyAuditPath(custodyFixture),
            (record) => {
              record.status = "tampered-before-receipt";
            },
          );
        },
      }),
      [
        "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
        "PERSONAL_FILING_PAYLOAD_CUSTODY_SCOPE_MISMATCH",
      ],
    );
    expect(await readdir(custodyFixture.payloadRootPath)).toEqual([]);
    expect(await fileExists(deletionReceiptPath(custodyFixture))).toBe(false);

    const intentFixture = await buildFixture([new Uint8Array([0x65])]);
    const intentCustody = await recordFixture(intentFixture);
    const intentInput = deletionInput(
      intentFixture,
      intentCustody.custodyRecordSha256,
    );
    await expectFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(intentInput, {
        now: () => new Date(LATER_TIME),
        phase: async (phase) => {
          if (phase !== "before_deletion_receipt_publish") return;
          await rewriteCanonicalAudit(
            deletionIntentPath(intentFixture),
            (record) => {
              record.state = "tampered-before-receipt";
            },
          );
        },
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
    );
    expect(await readdir(intentFixture.payloadRootPath)).toEqual([]);
    expect(await fileExists(deletionReceiptPath(intentFixture))).toBe(false);
  });

  it("rejects exact payload path replacement immediately before unlink", async () => {
    const payload = new TextEncoder().encode("replace-before-unlink");
    const fixture = await buildFixture([payload]);
    const custody = await recordFixture(fixture);
    const input = deletionInput(fixture, custody.custodyRecordSha256);
    let replaced = false;
    await expectFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(input, {
        now: () => new Date(LATER_TIME),
        phase: async (phase, path) => {
          if (phase !== "before_payload_unlink" || replaced) return;
          replaced = true;
          await unlink(path!);
          await writeFile(path!, payload);
        },
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_DELETION_FAILED",
    );
    expect(await fileExists(fixture.payloadPaths[0]!)).toBe(true);
    expect(await fileExists(deletionReceiptPath(fixture))).toBe(false);
    expect((await readdir(fixture.auditRootPath)).sort()).toEqual(
      [
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
      ].sort(),
    );
  });

  it("cleans a synced custody pending file and permits exact retry", async () => {
    const fixture = await buildFixture([new Uint8Array([0x66])]);
    await capturedFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(fixture.input, {
        now: () => new Date(FIXED_TIME),
        phase: (phase) => {
          if (phase === "after_custody_pending_synced") {
            throw new Error(ERROR_CANARY);
          }
        },
      }),
    );
    expect(await readdir(fixture.auditRootPath)).toEqual([]);
    expect(await fileExists(custodyPendingPath(fixture))).toBe(false);

    const custody = await recordFixture(fixture);
    expect(custody.status).toBe(
      "local_payload_custody_recorded_for_personal_use",
    );
  });

  it("cleans a synced deletion-intent pending file and permits exact retry", async () => {
    const fixture = await buildFixture([new Uint8Array([0x67])]);
    const custody = await recordFixture(fixture);
    const input = deletionInput(fixture, custody.custodyRecordSha256);
    await capturedFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(input, {
        now: () => new Date(LATER_TIME),
        phase: (phase) => {
          if (phase === "after_deletion_intent_pending_synced") {
            throw new Error(ERROR_CANARY);
          }
        },
      }),
    );
    expect((await readdir(fixture.auditRootPath)).sort()).toEqual([
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
    ]);
    expect(await fileExists(deletionIntentPendingPath(fixture))).toBe(false);
    expect(await fileExists(fixture.payloadPaths[0]!)).toBe(true);

    const receipt = await deletePersonalFilingPayloadCustodyWithRuntime(
      input,
      runtimeAt("2026-08-28T20:03:00.000Z"),
    );
    expect(receipt.confirmedAbsentFileCount).toBe(1);
  });

  it("cleans a synced deletion-receipt pending file and retries from an empty root", async () => {
    const fixture = await buildFixture([new Uint8Array([0x68])]);
    const custody = await recordFixture(fixture);
    const input = deletionInput(fixture, custody.custodyRecordSha256);
    await capturedFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(input, {
        now: () => new Date(LATER_TIME),
        phase: (phase) => {
          if (phase === "after_deletion_receipt_pending_synced") {
            throw new Error(ERROR_CANARY);
          }
        },
      }),
    );
    expect(await readdir(fixture.payloadRootPath)).toEqual([]);
    expect((await readdir(fixture.auditRootPath)).sort()).toEqual(
      [
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
      ].sort(),
    );
    expect(await fileExists(deletionReceiptPendingPath(fixture))).toBe(false);

    const receipt = await deletePersonalFilingPayloadCustodyWithRuntime(
      input,
      runtimeAt("2026-08-28T20:04:00.000Z"),
    );
    expect(receipt.confirmedAbsentFileCount).toBe(1);
    expect(await fileExists(deletionReceiptPath(fixture))).toBe(true);
  });

  it("promotes an authentic custody pending file restored after cleanup", async () => {
    const fixture = await buildFixture([new Uint8Array([0x69])]);
    const pendingPath = custodyPendingPath(fixture);
    let pendingBytes: Uint8Array | undefined;
    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(fixture.input, {
        now: () => new Date(FIXED_TIME),
        phase: async (phase, path) => {
          if (phase !== "after_custody_pending_synced") return;
          pendingBytes = new Uint8Array(await readFile(path!));
          throw new Error(ERROR_CANARY);
        },
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    expect(pendingBytes).toBeDefined();
    expect(await fileExists(pendingPath)).toBe(false);

    await writeFile(pendingPath, pendingBytes!);
    expect(await readdir(fixture.auditRootPath)).toEqual([
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custodyPending,
    ]);

    const custody = await recordFixture(fixture);
    expect(custody.status).toBe(
      "local_payload_custody_recorded_for_personal_use",
    );
    expect(await fileExists(pendingPath)).toBe(false);
    expect(await readdir(fixture.auditRootPath)).toEqual([
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
    ]);
  });

  it("promotes an authentic deletion-intent pending file restored after cleanup", async () => {
    const fixture = await buildFixture([new Uint8Array([0x6a])]);
    const custody = await recordFixture(fixture);
    const input = deletionInput(fixture, custody.custodyRecordSha256);
    const pendingPath = deletionIntentPendingPath(fixture);
    let pendingBytes: Uint8Array | undefined;
    await expectFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(input, {
        now: () => new Date(LATER_TIME),
        phase: async (phase, path) => {
          if (phase !== "after_deletion_intent_pending_synced") return;
          pendingBytes = new Uint8Array(await readFile(path!));
          throw new Error(ERROR_CANARY);
        },
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    expect(pendingBytes).toBeDefined();
    expect(await fileExists(pendingPath)).toBe(false);
    expect(await fileExists(fixture.payloadPaths[0]!)).toBe(true);

    await writeFile(pendingPath, pendingBytes!);

    const receipt = await deletePersonalFilingPayloadCustodyWithRuntime(
      input,
      runtimeAt("2026-08-28T20:05:00.000Z"),
    );
    expect(receipt.confirmedAbsentFileCount).toBe(1);
    expect(await fileExists(pendingPath)).toBe(false);
    expect(await readdir(fixture.payloadRootPath)).toEqual([]);
    expect((await readdir(fixture.auditRootPath)).sort()).toEqual(
      [
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceipt,
      ].sort(),
    );
  });

  it("promotes an authentic deletion-receipt pending file restored after cleanup", async () => {
    const fixture = await buildFixture([new Uint8Array([0x6b])]);
    const custody = await recordFixture(fixture);
    const input = deletionInput(fixture, custody.custodyRecordSha256);
    let pendingBytes: Uint8Array | undefined;
    await expectFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(input, {
        now: () => new Date(LATER_TIME),
        phase: async (phase, path) => {
          if (phase !== "after_deletion_receipt_pending_synced") return;
          pendingBytes = new Uint8Array(await readFile(path!));
          throw new Error(ERROR_CANARY);
        },
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    expect(pendingBytes).toBeDefined();
    expect(await readdir(fixture.payloadRootPath)).toEqual([]);

    const pendingPath = deletionReceiptPendingPath(fixture);
    expect(await fileExists(pendingPath)).toBe(false);
    await writeFile(pendingPath, pendingBytes!);
    expect((await readdir(fixture.auditRootPath)).sort()).toEqual(
      [
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceiptPending,
      ].sort(),
    );

    const receipt = await deletePersonalFilingPayloadCustodyWithRuntime(
      input,
      runtimeAt("2026-08-28T20:06:00.000Z"),
    );
    expect(receipt.confirmedAbsentFileCount).toBe(1);
    expect(await fileExists(pendingPath)).toBe(false);
    expect(await fileExists(deletionReceiptPath(fixture))).toBe(true);
  });

  it("rejects and retains arbitrary regular bytes at a pending name", async () => {
    const fixture = await buildFixture([new Uint8Array([0x6f])]);
    const pendingPath = custodyPendingPath(fixture);
    const partial = new TextEncoder().encode('{"partial":');
    await writeFile(pendingPath, partial);

    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        fixture.input,
        runtimeAt(FIXED_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
    );
    expect(new Uint8Array(await readFile(pendingPath))).toEqual(partial);
    expect(await fileExists(custodyAuditPath(fixture))).toBe(false);
  });

  it("rejects and retains a directory at the custody pending name", async () => {
    const fixture = await buildFixture([new Uint8Array([0x6c])]);
    const pendingPath = custodyPendingPath(fixture);
    await mkdir(pendingPath);

    await expectFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        fixture.input,
        runtimeAt(FIXED_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    expect((await lstat(pendingPath)).isDirectory()).toBe(true);
    expect(await fileExists(custodyAuditPath(fixture))).toBe(false);
  });

  it("rejects and retains a hard link at the deletion-intent pending name", async () => {
    const fixture = await buildFixture([new Uint8Array([0x6d])]);
    const custody = await recordFixture(fixture);
    const sourcePath = join(
      fixture.temporaryDirectory,
      "deletion-intent-pending-hard-link.json",
    );
    const pendingPath = deletionIntentPendingPath(fixture);
    const partial = new TextEncoder().encode('{"partial":');
    await writeFile(sourcePath, partial);
    await link(sourcePath, pendingPath);

    await expectFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(
        deletionInput(fixture, custody.custodyRecordSha256),
        runtimeAt(LATER_TIME),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    expect((await lstat(pendingPath)).nlink).toBeGreaterThan(1);
    expect(new Uint8Array(await readFile(sourcePath))).toEqual(partial);
    expect(await fileExists(fixture.payloadPaths[0]!)).toBe(true);
    expect(await fileExists(deletionReceiptPath(fixture))).toBe(false);
  });

  it("rejects and retains a symlink at the deletion-receipt pending name", async ({
    skip,
  }) => {
    const fixture = await buildFixture([new Uint8Array([0x6e])]);
    const custody = await recordFixture(fixture);
    const input = deletionInput(fixture, custody.custodyRecordSha256);
    await expectFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(input, {
        now: () => new Date(LATER_TIME),
        phase: (phase) => {
          if (phase === "before_deletion_receipt_publish") {
            throw new Error(ERROR_CANARY);
          }
        },
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );
    expect(await readdir(fixture.payloadRootPath)).toEqual([]);

    const sourcePath = join(
      fixture.temporaryDirectory,
      "deletion-receipt-pending-symlink.json",
    );
    const pendingPath = deletionReceiptPendingPath(fixture);
    const partial = new TextEncoder().encode('{"partial":');
    await writeFile(sourcePath, partial);
    try {
      await symlink(sourcePath, pendingPath, "file");
    } catch (error) {
      if (isSystemErrorCode(error, ["EACCES", "ENOSYS", "ENOTSUP", "EPERM"])) {
        skip();
        return;
      }
      throw error;
    }

    await expectFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(
        input,
        runtimeAt("2026-08-28T20:07:00.000Z"),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    expect((await lstat(pendingPath)).isSymbolicLink()).toBe(true);
    expect(new Uint8Array(await readFile(sourcePath))).toEqual(partial);
    expect(await fileExists(deletionReceiptPath(fixture))).toBe(false);
  });

  it("returns fresh generic value-free errors without console leakage", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode(ERROR_CANARY),
    ]);
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];

    const error = await capturedFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(fixture.input, {
        now: () => new Date(FIXED_TIME),
        phase: () => {
          throw new Error(ERROR_CANARY);
        },
      }),
    );
    expect(error.code).toBe("PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT");
    expect(error.message).toBe(
      "Personal filing payload custody operation failed.",
    );
    expect((error as { cause?: unknown }).cause).toBeUndefined();
    const serialized = JSON.stringify(error);
    expect(serialized).not.toContain(ERROR_CANARY);
    expect(serialized).not.toContain(fixture.payloadRootPath);
    expect(serialized).not.toContain("0001234567-26-000001");
    expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });

  it("launders invalid internal runtimes and invalid clock values", async () => {
    const fixture = await buildFixture([new Uint8Array([0x71])]);
    for (const runtime of [
      null,
      {},
      { now: 42 },
      { now: () => new Date(Number.NaN) },
      { now: () => ({}) },
      { now: () => new Date(FIXED_TIME), phase: 42 },
    ]) {
      await expectFailure(
        recordPersonalFilingPayloadCustodyWithRuntime(
          fixture.input,
          runtime as PersonalFilingPayloadCustodyTestRuntime,
        ),
        "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
      );
    }
    expect(await readdir(fixture.auditRootPath)).toEqual([]);
  });

  it("rejects clock rollback before publishing a terminal deletion receipt and permits retry", async () => {
    const fixture = await buildFixture([new Uint8Array([0x72])]);
    const custody = await recordFixture(fixture);
    const input = deletionInput(fixture, custody.custodyRecordSha256);
    const times = ["2026-08-28T20:10:00.000Z", "2026-08-28T20:09:59.999Z"];
    await expectFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(input, {
        now: () => new Date(times.shift() ?? FIXED_TIME),
      }),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_DELETION_FAILED",
    );
    expect(await readdir(fixture.payloadRootPath)).toEqual([]);
    expect(await fileExists(deletionReceiptPath(fixture))).toBe(false);

    const receipt = await deletePersonalFilingPayloadCustodyWithRuntime(
      input,
      runtimeAt("2026-08-28T20:11:00.000Z"),
    );
    expect(Date.parse(receipt.ownerDeleteObservedAt)).toBeGreaterThanOrEqual(
      Date.parse(receipt.ownerDeleteRequestedAt),
    );
  });
});

async function buildFixture(payloads: readonly Uint8Array[]): Promise<Fixture> {
  const temporaryDirectory = await mkdtemp(
    join(await realpath(tmpdir()), "personal-payload-custody-security-"),
  );
  temporaryDirectories.push(temporaryDirectory);
  const payloadRootPath = join(temporaryDirectory, "payloads");
  const auditRootPath = join(temporaryDirectory, "audit");
  await mkdir(payloadRootPath);
  await mkdir(auditRootPath);
  const entries = payloads.map((payload, index) =>
    filingEntry(index + 1, payload),
  );
  const manifest = canonicalBytes({
    corpusId: "personal-custody-security-2026",
    corpusVersion: "1.0.0",
    entries,
    frozenAt: "2026-08-28T18:00:00.000Z",
    profile: "personal_single_user_local",
    schemaVersion: "1.0.0",
  });
  const declaration = canonicalBytes({
    commercialUse: "prohibited",
    corpusId: "personal-custody-security-2026",
    corpusVersion: "1.0.0",
    deleteOnRequest: true,
    deletionMode: "user_managed_local_delete",
    localOnly: true,
    manifestSha256: sha256(manifest),
    profile: "personal_single_user_local",
    purpose: "personal_offline_filing_research_only",
    redistribution: "prohibited",
    retentionDays: 365,
    schemaVersion: "1.0.0",
    singleUser: true,
  });
  const payloadPaths = entries.map((entry) =>
    join(
      payloadRootPath,
      personalFilingPayloadRelativePath(entry.accession as string),
    ),
  );
  for (const [index, path] of payloadPaths.entries()) {
    await writeFile(path, payloads[index]!);
  }
  return Object.freeze({
    auditRootPath,
    input: Object.freeze({
      auditRootPath,
      declaration,
      manifest,
      payloadRootPath,
    }),
    payloadPaths: Object.freeze(payloadPaths),
    payloadRootPath,
    payloads: Object.freeze(payloads.map((payload) => new Uint8Array(payload))),
    temporaryDirectory,
  });
}

function filingEntry(sequence: number, payload: Uint8Array): JsonRecord {
  const accession = `0001234567-26-${String(sequence).padStart(6, "0")}`;
  return {
    acceptedAt: "2026-08-25T17:00:00.000Z",
    accession,
    amendmentOf: null,
    availableAt: "2026-08-25T17:00:01.000Z",
    cik: "0001234567",
    contentBytes: payload.byteLength,
    contentSha256: sha256(payload),
    form: "10-K",
    mediaType: "application/zip",
    source: "sec_edgar",
    sourceLocator: `sec-edgar:${accession}`,
    taxonomy: "us-gaap-2026",
  };
}

async function recordFixture(fixture: Fixture) {
  return recordPersonalFilingPayloadCustodyWithRuntime(
    fixture.input,
    runtimeAt(FIXED_TIME),
  );
}

function deletionInput(
  fixture: Fixture,
  expectedCustodyRecordSha256: `sha256:${string}`,
): PersonalFilingPayloadDeletionInput {
  return Object.freeze({
    ...fixture.input,
    confirmation: PERSONAL_FILING_PAYLOAD_DELETE_CONFIRMATION,
    expectedCustodyRecordSha256,
  });
}

function runtimeAt(instant: string): PersonalFilingPayloadCustodyTestRuntime {
  return Object.freeze({ now: () => new Date(instant) });
}

function custodyAuditPath(fixture: Fixture): string {
  return join(
    fixture.auditRootPath,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
  );
}

function deletionReceiptPath(fixture: Fixture): string {
  return join(
    fixture.auditRootPath,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceipt,
  );
}

function deletionIntentPath(fixture: Fixture): string {
  return join(
    fixture.auditRootPath,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
  );
}

function custodyPendingPath(fixture: Fixture): string {
  return join(
    fixture.auditRootPath,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custodyPending,
  );
}

function deletionIntentPendingPath(fixture: Fixture): string {
  return join(
    fixture.auditRootPath,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntentPending,
  );
}

function deletionReceiptPendingPath(fixture: Fixture): string {
  return join(
    fixture.auditRootPath,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceiptPending,
  );
}

async function rewriteCanonicalAudit(
  path: string,
  mutate: (record: JsonRecord) => void,
): Promise<void> {
  const record = JSON.parse(await readFile(path, "utf8")) as JsonRecord;
  mutate(record);
  await writeFile(path, canonicalBytes(record));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    if (isSystemErrorCode(error, ["ENOENT"])) return false;
    throw error;
  }
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as JsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function expectFailure(
  promise: Promise<unknown>,
  code: PersonalFilingPayloadCustodyFailureCode,
): Promise<void> {
  const error = await capturedFailure(promise);
  expect(error.code).toBe(code);
  expect(error.message).toBe(
    "Personal filing payload custody operation failed.",
  );
  expect((error as { cause?: unknown }).cause).toBeUndefined();
}

async function expectOneOfFailures(
  promise: Promise<unknown>,
  codes: readonly PersonalFilingPayloadCustodyFailureCode[],
): Promise<void> {
  const error = await capturedFailure(promise);
  expect(codes).toContain(error.code);
  expect(error.message).toBe(
    "Personal filing payload custody operation failed.",
  );
  expect((error as { cause?: unknown }).cause).toBeUndefined();
}

async function capturedFailure(
  promise: Promise<unknown>,
): Promise<PersonalFilingPayloadCustodyError> {
  try {
    await promise;
    throw new Error("expected custody operation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalFilingPayloadCustodyError);
    return error as PersonalFilingPayloadCustodyError;
  }
}

function isSystemErrorCode(
  error: unknown,
  allowedCodes: readonly string[],
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    allowedCodes.includes(error.code)
  );
}
