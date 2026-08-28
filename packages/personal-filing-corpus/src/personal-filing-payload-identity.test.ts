import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  appendFile,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  PERSONAL_FILING_PAYLOAD_IDENTITY_CHECKS,
  PERSONAL_FILING_PAYLOAD_IDENTITY_CLAIM,
  PERSONAL_FILING_PAYLOAD_IDENTITY_FAILURE_CODES,
  PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS,
  PERSONAL_FILING_PAYLOAD_IDENTITY_NOT_PROVEN,
  PERSONAL_FILING_PAYLOAD_IDENTITY_SCHEMA_VERSION,
  PERSONAL_FILING_PAYLOAD_PATH_MAPPING,
  PersonalFilingPayloadIdentityError,
  personalFilingPayloadRelativePath,
  verifyPersonalFilingCorpusPayloadIdentity,
} from "./personal-filing-payload-identity";

type JsonRecord = Record<string, unknown>;

const temporaryDirectories: string[] = [];

const EXPECTED_CHECKS = [
  "owned_manifest_declaration_snapshots_reverified_before_filesystem_access",
  "fixed_direct_root_accession_payload_v1_mapping",
  "bounded_exact_root_inventory_before_and_after_reads",
  "node_visible_root_chain_symlink_and_junction_rejection",
  "canonical_direct_child_containment_and_same_device_requirement",
  "bigint_regular_single_link_path_and_descriptor_identity",
  "one_open_descriptor_and_sequential_64_kib_positional_reads",
  "declared_length_early_eof_and_extra_byte_probe",
  "incremental_sha256_equality_for_every_manifest_entry",
  "observed_pre_open_post_path_descriptor_and_root_stability_checks",
  "whole_set_atomic_verification_or_value_free_rejection",
  "aggregate_only_immutable_payload_identity_record",
] as const;

const EXPECTED_NONCLAIMS = [
  "sec_source_authenticity_attestation_or_complete_filing_provenance",
  "mime_truth_archive_structure_malware_safety_parser_correctness_or_fact_quality",
  "adversarial_namespace_aba_elimination_file_locking_or_transactional_snapshot",
  "every_windows_reparse_cloud_placeholder_filter_driver_or_kernel_nofollow_behavior",
  "absence_of_transient_out_of_root_reads_against_an_active_same_machine_attacker",
  "filesystem_kernel_device_ownership_acl_or_local_storage_attestation",
  "hard_link_history_future_link_creation_or_post_verification_immutability",
  "any_specific_owner_corpus_without_a_successful_operation_invocation",
  "payload_confidentiality_in_memory_swap_storage_backups_or_other_processes",
  "wall_clock_deadline_cancellation_or_availability",
  "retention_enforcement_backup_deletion_or_cryptographic_erasure",
  "multi_user_commercial_redistributed_shared_service_or_production_safety",
  "enterprise_rights_steward_approval_database_api_web_or_b15_v15",
] as const;

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { force: true, recursive: true });
  }
});

describe("personal filing payload identity verifier", () => {
  it("freezes the exact bounded personal payload claim, checks, nonclaims, and limits", () => {
    expect(PERSONAL_FILING_PAYLOAD_IDENTITY_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_FILING_PAYLOAD_PATH_MAPPING).toBe(
      "direct_root_accession_payload_v1",
    );
    expect(PERSONAL_FILING_PAYLOAD_IDENTITY_CLAIM).toBe(
      "bounded_streamed_local_payload_presence_length_and_sha256_verified_for_personal_single_user_local_use",
    );
    expect(PERSONAL_FILING_PAYLOAD_IDENTITY_CHECKS).toEqual(EXPECTED_CHECKS);
    expect(PERSONAL_FILING_PAYLOAD_IDENTITY_NOT_PROVEN).toEqual(
      EXPECTED_NONCLAIMS,
    );
    expect(PERSONAL_FILING_PAYLOAD_IDENTITY_FAILURE_CODES).toEqual([
      "PERSONAL_FILING_PAYLOAD_INVALID_INPUT",
      "PERSONAL_FILING_PAYLOAD_DOCUMENT_INVALID",
      "PERSONAL_FILING_PAYLOAD_SCOPE_MISMATCH",
      "PERSONAL_FILING_PAYLOAD_SET_INVALID",
    ]);
    expect(PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS).toEqual({
      chunkBytes: 65_536,
      rootPathCodeUnits: 4_096,
    });
    for (const value of [
      PERSONAL_FILING_PAYLOAD_IDENTITY_CHECKS,
      PERSONAL_FILING_PAYLOAD_IDENTITY_NOT_PROVEN,
      PERSONAL_FILING_PAYLOAD_IDENTITY_FAILURE_CODES,
      PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it("defines one exact direct-root relative path for an accession", () => {
    expect(personalFilingPayloadRelativePath("0001234567-26-000001")).toBe(
      "0001234567-26-000001.payload",
    );
    for (const accession of [
      "../0001234567-26-000001",
      "0001234567-26-000001/extra",
      "0001234567-26-000001:stream",
      "0001234567-26-00001",
    ]) {
      expect(() => personalFilingPayloadRelativePath(accession)).toThrow(
        PersonalFilingPayloadIdentityError,
      );
    }
  });

  it("streams and verifies one exact local payload with aggregate-only output", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode("personal filing payload"),
    ]);
    const result = await verifyPersonalFilingCorpusPayloadIdentity(
      fixture.input,
    );

    expect(result).toEqual({
      claim: PERSONAL_FILING_PAYLOAD_IDENTITY_CLAIM,
      corpusId: "personal-payloads-2026",
      corpusVersion: "1.0.0",
      declarationSha256: sha256(fixture.input.declaration),
      filingCount: 1,
      frozenAt: "2026-08-28T18:00:00.000Z",
      linkAssurance:
        process.platform !== "win32" &&
        typeof fsConstants.O_NOFOLLOW === "number"
          ? "kernel_final_component_nofollow_plus_observed_snapshots"
          : "observed_snapshots_only",
      manifestSha256: sha256(fixture.input.manifest),
      pathMapping: "direct_root_accession_payload_v1",
      profile: "personal_single_user_local",
      retentionDays: 365,
      schemaVersion: "1.0.0",
      status: "payload_identity_verified_for_personal_use",
      totalVerifiedBytes: 23,
    });
    expect(Object.isFrozen(result)).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("0001234567-26-000001");
    expect(serialized).not.toContain(fixture.rootPath);
    expect(serialized).not.toContain("personal filing payload");
  });

  it("verifies multiple media types across exact chunk boundaries", async () => {
    const sizes = [
      PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.chunkBytes - 1,
      PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.chunkBytes,
      PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.chunkBytes + 1,
      7,
    ];
    const payloads = sizes.map((size, index) =>
      new Uint8Array(size).fill(index + 1),
    );
    const fixture = await buildFixture(payloads, [
      "application/xml",
      "application/zip",
      "text/html",
      "text/plain",
    ]);

    const result = await verifyPersonalFilingCorpusPayloadIdentity(
      fixture.input,
    );
    expect(result.filingCount).toBe(4);
    expect(result.totalVerifiedBytes).toBe(
      sizes.reduce((total, size) => total + size, 0),
    );
  });

  it("verifies the exact 100-file personal profile ceiling sequentially", async () => {
    const payloads = Array.from(
      { length: 100 },
      (_, index) => new Uint8Array([index + 1]),
    );
    const fixture = await buildFixture(payloads);

    const result = await verifyPersonalFilingCorpusPayloadIdentity(
      fixture.input,
    );
    expect(result.filingCount).toBe(100);
    expect(result.totalVerifiedBytes).toBe(100);
  });

  it("rejects missing, short, long, same-size wrong, and extra payloads atomically", async () => {
    const payload = new TextEncoder().encode("expected-payload");
    for (const mutate of [
      async (fixture: Fixture) => {
        await unlink(fixture.payloadPaths[0]!);
      },
      async (fixture: Fixture) => {
        await writeFile(fixture.payloadPaths[0]!, payload.subarray(1));
      },
      async (fixture: Fixture) => {
        await appendFile(fixture.payloadPaths[0]!, new Uint8Array([1]));
      },
      async (fixture: Fixture) => {
        await writeFile(
          fixture.payloadPaths[0]!,
          new Uint8Array(payload.length).fill(0x78),
        );
      },
      async (fixture: Fixture) => {
        await writeFile(join(fixture.rootPath, "unexpected.payload"), payload);
      },
    ]) {
      const fixture = await buildFixture([payload]);
      await mutate(fixture);
      await expectFailure(
        verifyPersonalFilingCorpusPayloadIdentity(fixture.input),
        "PERSONAL_FILING_PAYLOAD_SET_INVALID",
      );
    }
  });

  it("rejects invalid or differently scoped documents before filesystem access", async () => {
    const fixture = await buildFixture([new Uint8Array([1])]);
    const changedManifest = new Uint8Array(fixture.input.manifest);
    changedManifest[changedManifest.length - 2] = 32;
    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity({
        ...fixture.input,
        manifest: changedManifest,
        payloadRootPath: join(fixture.rootPath, "missing"),
      }),
      "PERSONAL_FILING_PAYLOAD_SCOPE_MISMATCH",
    );

    const parsed = JSON.parse(
      new TextDecoder().decode(fixture.input.manifest),
    ) as JsonRecord;
    const prettyManifest = new TextEncoder().encode(
      `${JSON.stringify(parsed, null, 2)}\n`,
    );
    const declaration = declarationFor(prettyManifest);
    await expectFailure(
      verifyPersonalFilingCorpusPayloadIdentity({
        declaration,
        manifest: prettyManifest,
        payloadRootPath: join(fixture.rootPath, "missing"),
      }),
      "PERSONAL_FILING_PAYLOAD_DOCUMENT_INVALID",
    );
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
}

async function buildFixture(
  payloads: readonly Uint8Array[],
  mediaTypes: readonly string[] = [],
): Promise<Fixture> {
  const temporaryDirectory = await mkdtemp(
    join(await realpath(tmpdir()), "personal-payload-identity-"),
  );
  temporaryDirectories.push(temporaryDirectory);
  const rootPath = join(temporaryDirectory, "payloads");
  await mkdir(rootPath);
  const entries = payloads.map((payload, index) =>
    filingEntry(index + 1, payload, mediaTypes[index] ?? "application/zip"),
  );
  const manifest = canonicalBytes({
    corpusId: "personal-payloads-2026",
    corpusVersion: "1.0.0",
    entries,
    frozenAt: "2026-08-28T18:00:00.000Z",
    profile: "personal_single_user_local",
    schemaVersion: "1.0.0",
  });
  const declaration = declarationFor(manifest);
  const payloadPaths = entries.map((entry, index) => {
    const path = join(
      rootPath,
      personalFilingPayloadRelativePath(entry.accession as string),
    );
    return { index, path };
  });
  for (const { index, path } of payloadPaths) {
    await writeFile(path, payloads[index]!);
  }
  return Object.freeze({
    input: Object.freeze({ declaration, manifest, payloadRootPath: rootPath }),
    payloadPaths: Object.freeze(payloadPaths.map(({ path }) => path)),
    rootPath,
  });
}

function filingEntry(
  sequence: number,
  payload: Uint8Array,
  mediaType: string,
): JsonRecord {
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
    mediaType,
    source: "sec_edgar",
    sourceLocator: `sec-edgar:${accession}`,
    taxonomy: "us-gaap-2026",
  };
}

function declarationFor(manifest: Uint8Array): Uint8Array {
  return canonicalBytes({
    commercialUse: "prohibited",
    corpusId: "personal-payloads-2026",
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
  try {
    await promise;
    throw new Error("expected verification to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalFilingPayloadIdentityError);
    expect((error as PersonalFilingPayloadIdentityError).code).toBe(code);
    expect((error as Error).message).toBe(
      "Personal filing payload identity verification failed.",
    );
    expect((error as { cause?: unknown }).cause).toBeUndefined();
  }
}
