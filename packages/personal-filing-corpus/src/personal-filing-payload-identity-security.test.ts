import { createHash } from "node:crypto";
import {
  appendFile,
  link,
  mkdir,
  mkdtemp,
  open,
  realpath,
  rename,
  rm,
  symlink,
  truncate,
  unlink,
  writeFile,
  type FileHandle,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as publicApi from "./index";
import {
  PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS,
  PersonalFilingPayloadIdentityError,
  isPersonalFilingPayloadFileIdentityStable,
  personalFilingPayloadRelativePath,
  verifyPersonalFilingCorpusPayloadIdentity,
  type PersonalFilingPayloadIdentityInput,
} from "./personal-filing-payload-identity";

type JsonRecord = Record<string, unknown>;

interface PositionalFileHandlePrototype {
  read(
    this: FileHandle,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<{ buffer: Uint8Array; bytesRead: number }>;
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { force: true, recursive: true });
  }
});

describe("personal filing payload identity security boundary", () => {
  it("exposes only the exact reviewed runtime API from the public barrel", () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [
        "PERSONAL_FILING_CORPUS_CHECKS",
        "PERSONAL_FILING_CORPUS_CLAIM",
        "PERSONAL_FILING_CORPUS_FAILURE_CODES",
        "PERSONAL_FILING_CORPUS_LIMITS",
        "PERSONAL_FILING_CORPUS_NOT_PROVEN",
        "PERSONAL_FILING_CORPUS_PROFILE",
        "PERSONAL_FILING_CORPUS_SCHEMA_VERSION",
        "PERSONAL_FILING_FACT_CONTRACTS",
        "PERSONAL_FILING_FACT_COMPARISON_ASSURANCE",
        "PERSONAL_FILING_FACT_COMPARISON_CHECKS",
        "PERSONAL_FILING_FACT_COMPARISON_CLAIM",
        "PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS",
        "PERSONAL_FILING_FACT_COMPARISON_LIMITS",
        "PERSONAL_FILING_FACT_COMPARISON_NOT_PROVEN",
        "PERSONAL_FILING_FACT_COMPARISON_QUARANTINE_CODES",
        "PERSONAL_FILING_FACT_COMPARISON_SCHEMA_VERSION",
        "PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA",
        "PERSONAL_FILING_FACT_KEYS",
        "PERSONAL_FILING_FACT_NORMALIZATION_CHECKS",
        "PERSONAL_FILING_FACT_NORMALIZATION_CLAIM",
        "PERSONAL_FILING_FACT_NORMALIZATION_LIMITS",
        "PERSONAL_FILING_FACT_NORMALIZATION_NOT_PROVEN",
        "PERSONAL_FILING_FACT_NORMALIZATION_QUARANTINE_CODES",
        "PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION",
        "PERSONAL_FILING_QUALITY_MEASUREMENT_ASSURANCE",
        "PERSONAL_FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS",
        "PERSONAL_FILING_QUALITY_MEASUREMENT_CHECKS",
        "PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM",
        "PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS",
        "PERSONAL_FILING_QUALITY_MEASUREMENT_METRICS",
        "PERSONAL_FILING_QUALITY_MEASUREMENT_NOT_PROVEN",
        "PERSONAL_FILING_QUALITY_MEASUREMENT_QUARANTINE_CODES",
        "PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION",
        "PERSONAL_FILING_QUALITY_MEASUREMENT_THRESHOLDS",
        "PERSONAL_FILING_RAW_FACT_EXTRACTION_ASSURANCE",
        "PERSONAL_FILING_RAW_FACT_EXTRACTION_CHECKS",
        "PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM",
        "PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS",
        "PERSONAL_FILING_RAW_FACT_EXTRACTION_NOT_PROVEN",
        "PERSONAL_FILING_RAW_FACT_EXTRACTION_QUARANTINE_CODES",
        "PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION",
        "PERSONAL_FILING_RAW_FACT_EXTRACTOR_BINDING",
        "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES",
        "PERSONAL_FILING_PAYLOAD_CUSTODY_CHECKS",
        "PERSONAL_FILING_PAYLOAD_CUSTODY_CLAIM",
        "PERSONAL_FILING_PAYLOAD_CUSTODY_FAILURE_CODES",
        "PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS",
        "PERSONAL_FILING_PAYLOAD_CUSTODY_NOT_PROVEN",
        "PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION",
        "PERSONAL_FILING_PAYLOAD_DELETE_CONFIRMATION",
        "PERSONAL_FILING_PAYLOAD_DELETION_CLAIM",
        "PERSONAL_FILING_PAYLOAD_IDENTITY_CHECKS",
        "PERSONAL_FILING_PAYLOAD_IDENTITY_CLAIM",
        "PERSONAL_FILING_PAYLOAD_IDENTITY_FAILURE_CODES",
        "PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS",
        "PERSONAL_FILING_PAYLOAD_IDENTITY_NOT_PROVEN",
        "PERSONAL_FILING_PAYLOAD_IDENTITY_SCHEMA_VERSION",
        "PERSONAL_FILING_PAYLOAD_PATH_MAPPING",
        "PersonalFilingCorpusError",
        "PersonalFilingPayloadCustodyError",
        "PersonalFilingPayloadIdentityError",
        "deletePersonalFilingPayloadCustody",
        "comparePersonalFilingFactValidation",
        "comparePersonalFilingRawFactExtraction",
        "createPersonalFilingQualityMeasurementProtocol",
        "normalizePersonalFilingFacts",
        "personalFilingPayloadRelativePath",
        "recordPersonalFilingPayloadCustody",
        "verifyPersonalFilingCorpusManifest",
        "verifyPersonalFilingCorpusPayloadIdentity",
      ].sort(),
    );
    expect("isPersonalFilingPayloadFileIdentityStable" in publicApi).toBe(
      false,
    );
    expect("deletePersonalFilingPayloadCustodyWithRuntime" in publicApi).toBe(
      false,
    );
    expect("recordPersonalFilingPayloadCustodyWithRuntime" in publicApi).toBe(
      false,
    );
    expect(
      "createSuppliedPersonalFilingQualityMeasurementProtocolForTesting" in
        publicApi,
    ).toBe(false);
  });

  it("accepts exactly one argument with three enumerable data properties", async () => {
    const fixture = await buildFixture([new Uint8Array([1])]);
    const duplicateArgumentPromise = Reflect.apply(
      verifyPersonalFilingCorpusPayloadIdentity,
      undefined,
      [fixture.input, fixture.input],
    ) as Promise<unknown>;
    await expectFailure(
      duplicateArgumentPromise,
      "PERSONAL_FILING_PAYLOAD_INVALID_INPUT",
    );
    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity({
        ...fixture.input,
        ignored: true,
      } as PersonalFilingPayloadIdentityInput),
      "PERSONAL_FILING_PAYLOAD_INVALID_INPUT",
    );

    const accessor = {
      get declaration(): Uint8Array {
        throw new Error("ACCESSOR_SECRET");
      },
      manifest: fixture.input.manifest,
      payloadRootPath: fixture.rootPath,
    };
    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity(accessor),
      "PERSONAL_FILING_PAYLOAD_INVALID_INPUT",
    );
  });

  it("snapshots descriptor values without invoking a stateful carrier get trap", async () => {
    const fixture = await buildFixture([new Uint8Array([1])]);
    const getTrap = vi.fn(() => {
      throw new Error("STATEFUL_GET_TRAP");
    });
    const carrier = new Proxy(fixture.input, { get: getTrap });

    const result = await verifyPersonalFilingCorpusPayloadIdentity(carrier);
    expect(result.status).toBe("payload_identity_verified_for_personal_use");
    expect(getTrap).not.toHaveBeenCalled();
  });

  it("rejects non-string accessions without invoking hostile coercion", () => {
    let coercions = 0;
    const hostileAccession = {
      [Symbol.toPrimitive](): string {
        coercions += 1;
        return coercions === 1 ? "0001234567-26-000001" : "../ESCAPE";
      },
    };
    let failure: unknown;
    try {
      Reflect.apply(personalFilingPayloadRelativePath, undefined, [
        hostileAccession,
      ]);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(PersonalFilingPayloadIdentityError);
    expect((failure as PersonalFilingPayloadIdentityError).code).toBe(
      "PERSONAL_FILING_PAYLOAD_INVALID_INPUT",
    );
    expect(coercions).toBe(0);
  });

  it("owns document snapshots before the first filesystem await", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode("owned-before-await"),
    ]);
    const promise = verifyPersonalFilingCorpusPayloadIdentity(fixture.input);
    fixture.input.declaration.fill(0);
    fixture.input.manifest.fill(0);

    const result = await promise;
    expect(result.status).toBe("payload_identity_verified_for_personal_use");
  });

  it("rejects hostile byte carriers and launders forged exported errors", async () => {
    const fixture = await buildFixture([new Uint8Array([1])]);
    const shared = new Uint8Array(
      new SharedArrayBuffer(fixture.input.manifest.length),
    );
    shared.set(fixture.input.manifest);
    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity({
        ...fixture.input,
        manifest: shared,
      }),
      "PERSONAL_FILING_PAYLOAD_INVALID_INPUT",
    );

    const forged = new PersonalFilingPayloadIdentityError(
      "PERSONAL_FILING_PAYLOAD_SET_INVALID",
    );
    forged.message = "FORGED_SECRET";
    const proxy = new Proxy(fixture.input, {
      getPrototypeOf() {
        throw forged;
      },
    });
    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity(proxy),
      "PERSONAL_FILING_PAYLOAD_INVALID_INPUT",
    );
  });

  it("rejects relative, root, overlong, NUL, and network-style root paths", async () => {
    const fixture = await buildFixture([new Uint8Array([1])]);
    const invalidRoots = [
      "relative-payload-root",
      parse(fixture.rootPath).root,
      `${fixture.rootPath}\u0000secret`,
      `${fixture.rootPath}${"x".repeat(
        PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.rootPathCodeUnits,
      )}`,
      process.platform === "win32"
        ? "\\\\server\\share\\payloads"
        : "//tmp/payloads",
    ];
    for (const payloadRootPath of invalidRoots) {
      await expectFailure(
        verifyPersonalFilingCorpusPayloadIdentity({
          ...fixture.input,
          payloadRootPath,
        }),
        "PERSONAL_FILING_PAYLOAD_INVALID_INPUT",
      );
    }
  });

  it("rejects a symlinked or junction root and never follows its payloads", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode("root-alias-payload"),
    ]);
    const alias = join(fixture.temporaryDirectory, "payload-alias");
    await symlink(
      fixture.rootPath,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity({
        ...fixture.input,
        payloadRootPath: alias,
      }),
      "PERSONAL_FILING_PAYLOAD_SET_INVALID",
    );
  });

  it("rejects a symlinked or junction intermediate root ancestor", async () => {
    const fixture = await buildFixture([new Uint8Array([0x22])]);
    const aliasParent = join(fixture.temporaryDirectory, "alias-parent");
    await symlink(
      fixture.temporaryDirectory,
      aliasParent,
      process.platform === "win32" ? "junction" : "dir",
    );

    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity({
        ...fixture.input,
        payloadRootPath: join(aliasParent, "payloads"),
      }),
      "PERSONAL_FILING_PAYLOAD_SET_INVALID",
    );
  });

  it("rejects a final-component symlink to an outside payload when supported", async ({
    skip,
  }) => {
    const payload = new TextEncoder().encode("outside-payload");
    const fixture = await buildFixture([payload]);
    const outside = join(fixture.temporaryDirectory, "outside.payload");
    await writeFile(outside, payload);
    await unlink(fixture.payloadPaths[0]!);
    try {
      await symlink(outside, fixture.payloadPaths[0]!, "file");
    } catch (error) {
      if (
        process.platform === "win32" &&
        isSystemErrorCode(error, ["EACCES", "EPERM"])
      ) {
        skip();
        return;
      }
      throw error;
    }

    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity(fixture.input),
      "PERSONAL_FILING_PAYLOAD_SET_INVALID",
    );
  });

  it("rejects a hard-linked payload and a directory at an expected name", async () => {
    const payload = new TextEncoder().encode("single-link-required");
    const hardLinkFixture = await buildFixture([payload]);
    const outside = join(
      hardLinkFixture.temporaryDirectory,
      "hard-link-source.payload",
    );
    await rename(hardLinkFixture.payloadPaths[0]!, outside);
    await link(outside, hardLinkFixture.payloadPaths[0]!);
    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity(hardLinkFixture.input),
      "PERSONAL_FILING_PAYLOAD_SET_INVALID",
    );

    const directoryFixture = await buildFixture([payload]);
    await unlink(directoryFixture.payloadPaths[0]!);
    await mkdir(directoryFixture.payloadPaths[0]!);
    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity(directoryFixture.input),
      "PERSONAL_FILING_PAYLOAD_SET_INVALID",
    );
  });

  it("caps positional reads at 64 KiB and performs a one-byte EOF probe", async () => {
    const payload = new Uint8Array(
      PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.chunkBytes * 2 + 17,
    ).fill(0x5a);
    const fixture = await buildFixture([payload]);
    const probe = await open(fixture.payloadPaths[0]!, "r");
    const prototype = Object.getPrototypeOf(probe) as {
      read: (
        buffer: Uint8Array,
        offset: number,
        length: number,
        position: number,
      ) => Promise<{ buffer: Uint8Array; bytesRead: number }>;
    };
    await probe.close();
    const readSpy = vi.spyOn(prototype, "read");

    const result = await verifyPersonalFilingCorpusPayloadIdentity(
      fixture.input,
    );
    expect(result.totalVerifiedBytes).toBe(payload.byteLength);
    const calls = readSpy.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(4);
    expect(
      calls.every(
        (call) =>
          call[2] >= 1 &&
          call[2] <= PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.chunkBytes,
      ),
    ).toBe(true);
    expect(calls.at(-1)?.[2]).toBe(1);
    expect(calls.at(-1)?.[3]).toBe(payload.byteLength);
    expect(calls.every((call) => call[0] === calls[0]?.[0])).toBe(true);
    expect(calls.every((call) => call[1] === 0)).toBe(true);
  });

  it("loops over short positional reads without skipping bytes", async () => {
    const payload = new Uint8Array(73).map((_, index) => index);
    const fixture = await buildFixture([payload]);
    const prototype = await fileHandlePrototype(fixture.payloadPaths[0]!);
    const originalRead = originalPositionalRead(prototype);
    const readSpy = vi
      .spyOn(prototype, "read")
      .mockImplementation(async function (
        this: FileHandle,
        buffer: Uint8Array,
        offset: number,
        length: number,
        position: number,
      ) {
        return originalRead.call(
          this,
          buffer,
          offset,
          Math.min(length, 7),
          position,
        );
      });

    const result = await verifyPersonalFilingCorpusPayloadIdentity(
      fixture.input,
    );
    expect(result.totalVerifiedBytes).toBe(payload.byteLength);
    expect(readSpy.mock.calls.map((call) => call[3])).toEqual([
      0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 73,
    ]);
  });

  it("rejects truncation and growth injected after the first descriptor read", async () => {
    for (const mutation of ["truncate", "append"] as const) {
      const payload = new Uint8Array(
        PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.chunkBytes + 19,
      ).fill(0x34);
      const fixture = await buildFixture([payload]);
      const payloadPath = fixture.payloadPaths[0]!;
      const prototype = await fileHandlePrototype(payloadPath);
      const originalRead = originalPositionalRead(prototype);
      let mutated = false;
      vi.spyOn(prototype, "read").mockImplementation(async function (
        this: FileHandle,
        buffer: Uint8Array,
        offset: number,
        length: number,
        position: number,
      ) {
        const result = await originalRead.call(
          this,
          buffer,
          offset,
          length,
          position,
        );
        if (!mutated) {
          mutated = true;
          if (mutation === "truncate") {
            await truncate(
              payloadPath,
              PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.chunkBytes / 2,
            );
          } else {
            await appendFile(payloadPath, new Uint8Array([0x99]));
          }
        }
        return result;
      });

      await expectFailure(
        verifyPersonalFilingCorpusPayloadIdentity(fixture.input),
        "PERSONAL_FILING_PAYLOAD_SET_INVALID",
      );
      vi.restoreAllMocks();
    }
  });

  it("rejects a pathname replacement injected after its descriptor is open", async () => {
    const payload = new Uint8Array(
      PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.chunkBytes + 3,
    ).fill(0x45);
    const fixture = await buildFixture([payload]);
    const payloadPath = fixture.payloadPaths[0]!;
    const detachedPath = join(fixture.temporaryDirectory, "detached.payload");
    const prototype = await fileHandlePrototype(payloadPath);
    const originalRead = originalPositionalRead(prototype);
    let replaced = false;
    vi.spyOn(prototype, "read").mockImplementation(async function (
      this: FileHandle,
      buffer: Uint8Array,
      offset: number,
      length: number,
      position: number,
    ) {
      const result = await originalRead.call(
        this,
        buffer,
        offset,
        length,
        position,
      );
      if (!replaced) {
        replaced = true;
        await rename(payloadPath, detachedPath);
        await writeFile(payloadPath, payload);
      }
      return result;
    });

    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity(fixture.input),
      "PERSONAL_FILING_PAYLOAD_SET_INVALID",
    );
  });

  it("rejects a root-inventory mutation injected during payload reading", async () => {
    const payload = new Uint8Array(37).fill(0x56);
    const fixture = await buildFixture([payload]);
    const prototype = await fileHandlePrototype(fixture.payloadPaths[0]!);
    const originalRead = originalPositionalRead(prototype);
    let mutated = false;
    vi.spyOn(prototype, "read").mockImplementation(async function (
      this: FileHandle,
      buffer: Uint8Array,
      offset: number,
      length: number,
      position: number,
    ) {
      const result = await originalRead.call(
        this,
        buffer,
        offset,
        length,
        position,
      );
      if (!mutated) {
        mutated = true;
        await writeFile(
          join(fixture.rootPath, "unexpected.payload"),
          new Uint8Array([1]),
        );
      }
      return result;
    });

    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity(fixture.input),
      "PERSONAL_FILING_PAYLOAD_SET_INVALID",
    );
  });

  it("rejects fractional content and EOF-probe read counts", async () => {
    for (const fractionalCall of [1, 2]) {
      const payload = new Uint8Array([0x67]);
      const fixture = await buildFixture([payload]);
      const prototype = await fileHandlePrototype(fixture.payloadPaths[0]!);
      const originalRead = originalPositionalRead(prototype);
      let callCount = 0;
      vi.spyOn(prototype, "read").mockImplementation(async function (
        this: FileHandle,
        buffer: Uint8Array,
        offset: number,
        length: number,
        position: number,
      ) {
        callCount += 1;
        if (callCount === fractionalCall) {
          return { buffer, bytesRead: 0.5 };
        }
        return originalRead.call(this, buffer, offset, length, position);
      });

      await expectFailure(
        verifyPersonalFilingCorpusPayloadIdentity(fixture.input),
        "PERSONAL_FILING_PAYLOAD_SET_INVALID",
      );
      vi.restoreAllMocks();
    }
  });

  it("closes the payload descriptor even when verification fails", async () => {
    const payload = new TextEncoder().encode("descriptor-close");
    const fixture = await buildFixture([payload]);
    await writeFile(
      fixture.payloadPaths[0]!,
      new TextEncoder().encode("wrong-same-size!"),
    );
    const prototype = await fileHandlePrototype(fixture.payloadPaths[0]!);
    const closeProbe = probeNextFileHandleClose(prototype, false);

    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity(fixture.input),
      "PERSONAL_FILING_PAYLOAD_SET_INVALID",
    );
    expect(closeProbe.calls).toBe(1);
  });

  it("does not return success when closing the descriptor fails", async () => {
    const fixture = await buildFixture([new Uint8Array([0x78])]);
    const prototype = await fileHandlePrototype(fixture.payloadPaths[0]!);
    const closeProbe = probeNextFileHandleClose(prototype, true);

    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity(fixture.input),
      "PERSONAL_FILING_PAYLOAD_SET_INVALID",
    );
    expect(closeProbe.calls).toBe(1);
  });

  it("uses exact bigint identity fields above the safe integer ceiling", () => {
    const identity = Object.freeze({
      ctimeNs: 9_007_199_254_740_995n,
      dev: 9_007_199_254_740_993n,
      ino: 9_007_199_254_740_997n,
      mode: 33_188n,
      mtimeNs: 9_007_199_254_740_999n,
      nlink: 1n,
      size: 65_537n,
    });
    expect(isPersonalFilingPayloadFileIdentityStable(identity, identity)).toBe(
      true,
    );
    for (const changed of [
      { ...identity, dev: identity.dev + 1n },
      { ...identity, ino: identity.ino + 1n },
      { ...identity, size: identity.size + 1n },
      { ...identity, nlink: 2n },
      { ...identity, mode: identity.mode + 1n },
      { ...identity, mtimeNs: identity.mtimeNs + 1n },
      { ...identity, ctimeNs: identity.ctimeNs + 1n },
    ]) {
      expect(isPersonalFilingPayloadFileIdentityStable(identity, changed)).toBe(
        false,
      );
    }
  });

  it("returns one generic value-free error with no logs or partial result", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode("first-valid-payload"),
      new TextEncoder().encode("second-invalid-payload"),
    ]);
    await writeFile(
      fixture.payloadPaths[1]!,
      new TextEncoder().encode("second-WRONG--payload"),
    );
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];

    const error = await capturedFailure(
      verifyPersonalFilingCorpusPayloadIdentity(fixture.input),
    );
    expect(error.code).toBe("PERSONAL_FILING_PAYLOAD_SET_INVALID");
    expect(JSON.stringify(error)).not.toContain("0001234567");
    expect(JSON.stringify(error)).not.toContain(fixture.rootPath);
    expect(JSON.stringify(error)).not.toContain("first-valid-payload");
    expect((error as { cause?: unknown }).cause).toBeUndefined();
    expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });

  it("launders native filesystem details from a missing secret-bearing root", async () => {
    const fixture = await buildFixture([new Uint8Array([1])]);
    const secretRoot = join(
      fixture.temporaryDirectory,
      "MISSING_SECRET_ROOT_9f81",
    );
    const error = await capturedFailure(
      verifyPersonalFilingCorpusPayloadIdentity({
        ...fixture.input,
        payloadRootPath: secretRoot,
      }),
    );
    expect(error.code).toBe("PERSONAL_FILING_PAYLOAD_SET_INVALID");
    expect(error.message).toBe(
      "Personal filing payload identity verification failed.",
    );
    expect(JSON.stringify(error)).not.toContain("MISSING_SECRET_ROOT_9f81");
  });
});

interface Fixture {
  readonly input: {
    readonly declaration: Uint8Array;
    readonly manifest: Uint8Array;
    readonly payloadRootPath: string;
  };
  readonly payloadPaths: readonly string[];
  readonly rootPath: string;
  readonly temporaryDirectory: string;
}

async function buildFixture(payloads: readonly Uint8Array[]): Promise<Fixture> {
  const temporaryDirectory = await mkdtemp(
    join(await realpath(tmpdir()), "personal-payload-security-"),
  );
  temporaryDirectories.push(temporaryDirectory);
  const rootPath = join(temporaryDirectory, "payloads");
  await mkdir(rootPath);
  const entries = payloads.map((payload, index) =>
    filingEntry(index + 1, payload),
  );
  const manifest = canonicalBytes({
    corpusId: "personal-security-payloads-2026",
    corpusVersion: "1.0.0",
    entries,
    frozenAt: "2026-08-28T18:00:00.000Z",
    profile: "personal_single_user_local",
    schemaVersion: "1.0.0",
  });
  const declaration = canonicalBytes({
    commercialUse: "prohibited",
    corpusId: "personal-security-payloads-2026",
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
      rootPath,
      personalFilingPayloadRelativePath(entry.accession as string),
    ),
  );
  for (const [index, path] of payloadPaths.entries()) {
    await writeFile(path, payloads[index]!);
  }
  return Object.freeze({
    input: Object.freeze({ declaration, manifest, payloadRootPath: rootPath }),
    payloadPaths: Object.freeze(payloadPaths),
    rootPath,
    temporaryDirectory,
  });
}

async function fileHandlePrototype(
  path: string,
): Promise<PositionalFileHandlePrototype> {
  const handle = await open(path, "r");
  const prototype = Object.getPrototypeOf(
    handle,
  ) as PositionalFileHandlePrototype;
  await handle.close();
  return prototype;
}

function probeNextFileHandleClose(
  prototype: PositionalFileHandlePrototype,
  throwAfterClose: boolean,
): { calls: number } {
  const state = { calls: 0 };
  const originalRead = originalPositionalRead(prototype);
  let installed = false;
  vi.spyOn(prototype, "read").mockImplementation(async function (
    this: FileHandle,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ) {
    if (!installed) {
      installed = true;
      const originalClose = this.close.bind(this);
      Object.defineProperty(this, "close", {
        configurable: true,
        enumerable: true,
        value: async (): Promise<void> => {
          state.calls += 1;
          await originalClose();
          if (throwAfterClose) throw new Error("CLOSE_FAILURE_SECRET");
        },
        writable: true,
      });
    }
    return originalRead.call(this, buffer, offset, length, position);
  });
  return state;
}

function originalPositionalRead(
  prototype: PositionalFileHandlePrototype,
): PositionalFileHandlePrototype["read"] {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "read");
  if (descriptor === undefined || typeof descriptor.value !== "function") {
    throw new Error("FileHandle.read prototype contract unavailable");
  }
  return descriptor.value as PositionalFileHandlePrototype["read"];
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
  code: PersonalFilingPayloadIdentityError["code"],
): Promise<void> {
  const error = await capturedFailure(promise);
  expect(error.code).toBe(code);
  expect(error.message).toBe(
    "Personal filing payload identity verification failed.",
  );
  expect((error as { cause?: unknown }).cause).toBeUndefined();
}

async function capturedFailure(
  promise: Promise<unknown>,
): Promise<PersonalFilingPayloadIdentityError> {
  try {
    await promise;
    throw new Error("expected verification to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalFilingPayloadIdentityError);
    return error as PersonalFilingPayloadIdentityError;
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
