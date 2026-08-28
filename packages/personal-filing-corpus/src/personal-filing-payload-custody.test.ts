import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES,
  PERSONAL_FILING_PAYLOAD_CUSTODY_CHECKS,
  PERSONAL_FILING_PAYLOAD_CUSTODY_CLAIM,
  PERSONAL_FILING_PAYLOAD_CUSTODY_FAILURE_CODES,
  PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS,
  PERSONAL_FILING_PAYLOAD_CUSTODY_NOT_PROVEN,
  PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION,
  PERSONAL_FILING_PAYLOAD_DELETE_CONFIRMATION,
  PERSONAL_FILING_PAYLOAD_DELETION_CLAIM,
  PersonalFilingPayloadCustodyError,
  deletePersonalFilingPayloadCustodyWithRuntime,
  recordPersonalFilingPayloadCustodyWithRuntime,
  type PersonalFilingPayloadCustodyInput,
  type PersonalFilingPayloadCustodyTestRuntime,
  type PersonalFilingPayloadDeletionInput,
} from "./personal-filing-payload-custody";
import { personalFilingPayloadRelativePath } from "./personal-filing-payload-identity";

type JsonRecord = Record<string, unknown>;

const CUSTODY_RECORDED_AT = "2026-08-28T12:00:00.000Z";
const OWNER_DELETE_AT = "2026-08-28T12:00:00.001Z";
const temporaryDirectories: string[] = [];

const EXPECTED_CHECKS = [
  "owned_documents_reverified_and_cycle_2r_payload_identity_invoked_internally",
  "existing_canonical_non_root_nonnested_payload_and_audit_roots",
  "bigint_root_identity_and_private_domain_separated_location_binding",
  "fixed_bounded_exact_audit_inventory_and_canonical_aggregate_records",
  "exclusive_synchronized_audit_write_and_same_directory_publication",
  "custody_record_binds_exact_manifest_and_runtime_payload_identity_result",
  "declared_retention_target_recorded_without_minimum_hold_or_scheduler",
  "expected_custody_digest_and_exact_caller_intent_confirmation",
  "append_only_deletion_intent_published_before_any_payload_unlink",
  "manifest_derived_direct_children_only_and_no_recursive_removal",
  "bounded_rehash_and_pre_unlink_path_descriptor_identity_observations",
  "resumable_missing_after_intent_and_no_terminal_receipt_on_partial_failure",
  "every_selected_name_and_exact_live_root_inventory_observed_absent",
  "aggregate_only_immutable_custody_and_terminal_deletion_receipts",
] as const;

const EXPECTED_NONCLAIMS = [
  "sec_source_authenticity_attestation_or_complete_filing_provenance",
  "mime_truth_archive_structure_malware_safety_parser_correctness_or_fact_quality",
  "automatic_retention_scheduling_deadline_enforcement_or_legal_hold_execution",
  "backup_cloud_sync_replica_snapshot_cache_temp_log_swap_recycle_bin_or_third_party_deletion",
  "filesystem_journal_history_recovery_tool_physical_media_overwrite_or_cryptographic_erasure",
  "process_memory_buffer_zeroization_or_post_operation_forensic_absence",
  "post_return_absence_future_recreation_or_external_resurrection_prevention",
  "transactional_atomicity_between_payload_and_audit_roots_or_rollback",
  "crash_power_loss_cross_process_recovery_or_exactly_once_deletion",
  "adversarial_namespace_aba_elimination_race_freedom_or_active_same_machine_attacker_safety",
  "every_windows_reparse_cloud_placeholder_filter_driver_or_kernel_path_behavior",
  "filesystem_acl_owner_device_storage_encryption_or_local_host_attestation",
  "audit_signature_nonrepudiation_trusted_timestamp_or_tamper_proofing",
  "any_specific_owner_corpus_without_a_successful_operation_invocation",
  "caller_confirmation_as_owner_authentication_or_authorization",
  "database_api_web_fetcher_parser_queue_or_running_application_composition",
  "multi_user_commercial_redistributed_shared_service_or_production_safety",
  "enterprise_rights_steward_approval_database_b15_or_v15",
] as const;

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { force: true, recursive: true });
  }
});

describe("personal filing payload custody", () => {
  it("freezes the exact personal custody and deletion contract", () => {
    expect(PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_FILING_PAYLOAD_CUSTODY_CLAIM).toBe(
      "bounded_separate_local_payload_and_audit_custody_recorded_for_personal_single_user_local_use",
    );
    expect(PERSONAL_FILING_PAYLOAD_DELETION_CLAIM).toBe(
      "bounded_owner_triggered_selected_live_payload_paths_observed_absent_for_personal_single_user_local_use",
    );
    expect(PERSONAL_FILING_PAYLOAD_DELETE_CONFIRMATION).toBe(
      "delete_all_manifest_bound_local_payloads",
    );
    expect(PERSONAL_FILING_PAYLOAD_CUSTODY_CHECKS).toEqual(EXPECTED_CHECKS);
    expect(PERSONAL_FILING_PAYLOAD_CUSTODY_NOT_PROVEN).toEqual(
      EXPECTED_NONCLAIMS,
    );
    expect(PERSONAL_FILING_PAYLOAD_CUSTODY_FAILURE_CODES).toEqual([
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
      "PERSONAL_FILING_PAYLOAD_CUSTODY_DOCUMENT_INVALID",
      "PERSONAL_FILING_PAYLOAD_CUSTODY_SCOPE_MISMATCH",
      "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
      "PERSONAL_FILING_PAYLOAD_CUSTODY_DELETION_FAILED",
    ]);
    expect(PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES).toEqual({
      custody: "personal-filing-payload-custody-v1.json",
      custodyPending: ".personal-filing-payload-custody-v1.pending",
      deletionIntent: "personal-filing-payload-delete-intent-v1.json",
      deletionIntentPending:
        ".personal-filing-payload-delete-intent-v1.pending",
      deletionReceipt: "personal-filing-payload-delete-receipt-v1.json",
      deletionReceiptPending:
        ".personal-filing-payload-delete-receipt-v1.pending",
    });
    expect(PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS).toEqual({
      auditFileBytes: 16_384,
      auditFilesIncludingPending: 4,
      chunkBytes: 65_536,
      rootPathCodeUnits: 4_096,
    });
    for (const value of [
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES,
      PERSONAL_FILING_PAYLOAD_CUSTODY_CHECKS,
      PERSONAL_FILING_PAYLOAD_CUSTODY_FAILURE_CODES,
      PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS,
      PERSONAL_FILING_PAYLOAD_CUSTODY_NOT_PROVEN,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it("records one frozen custody result and one canonical aggregate audit file", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode("first personal filing payload"),
    ]);
    const result = await recordPersonalFilingPayloadCustodyWithRuntime(
      fixture.input,
      runtimeAt(CUSTODY_RECORDED_AT),
    );

    expect(result).toMatchObject({
      claim: PERSONAL_FILING_PAYLOAD_CUSTODY_CLAIM,
      corpusId: "personal-payload-custody-2026",
      custodyRecordedAt: CUSTODY_RECORDED_AT,
      deletionMode: "owner_managed_local_delete",
      filingCount: 1,
      profile: "personal_single_user_local",
      retentionDays: 365,
      retentionTargetAt: "2027-08-28T12:00:00.000Z",
      state: "live_payloads_verified",
      status: "local_payload_custody_recorded_for_personal_use",
      totalVerifiedBytes: 29,
      version: 1,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(await readdir(fixture.auditRootPath)).toEqual([
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
    ]);

    const custodyPath = join(
      fixture.auditRootPath,
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
    );
    const custodyBytes = await readFile(custodyPath);
    const persisted = expectCanonicalAudit(custodyBytes);
    const { custodyRecordSha256, ...publicPersisted } = result;
    expect(persisted).toEqual(publicPersisted);
    expect(custodyRecordSha256).toBe(sha256(custodyBytes));
    expect(JSON.stringify(result)).not.toContain(fixture.payloadRootPath);
    expect(JSON.stringify(result)).not.toContain("0001234567-26-000001");
  });

  it("replays the exact custody record and re-verifies the live payload set", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode("replay-bound-payload"),
    ]);
    const first = await recordPersonalFilingPayloadCustodyWithRuntime(
      fixture.input,
      runtimeAt(CUSTODY_RECORDED_AT),
    );
    const replay = await recordPersonalFilingPayloadCustodyWithRuntime(
      fixture.input,
      runtimeAt("2026-09-01T12:00:00.000Z"),
    );
    expect(replay).toEqual(first);

    await writeFile(
      fixture.payloadPaths[0]!,
      new Uint8Array(fixture.payloads[0]!.byteLength).fill(0x78),
    );
    await expectCustodyFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        fixture.input,
        runtimeAt("2026-09-02T12:00:00.000Z"),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
    );
  });

  it("deletes multiple manifest-bound live files and retains exactly three audit files", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode("alpha"),
      new TextEncoder().encode("bravo payload"),
      new TextEncoder().encode("charlie payload bytes"),
    ]);
    const custody = await recordPersonalFilingPayloadCustodyWithRuntime(
      fixture.input,
      runtimeAt(CUSTODY_RECORDED_AT),
    );
    const deleted = await deletePersonalFilingPayloadCustodyWithRuntime(
      deletionInput(fixture, custody.custodyRecordSha256),
      runtimeAt(OWNER_DELETE_AT),
    );

    expect(deleted).toMatchObject({
      auditDisposition: "custody_intent_and_terminal_receipt_retained",
      claim: PERSONAL_FILING_PAYLOAD_DELETION_CLAIM,
      confirmedAbsentBytes: 39,
      confirmedAbsentFileCount: 3,
      custodyRecordSha256: custody.custodyRecordSha256,
      deletionAssurance:
        "observed_pre_unlink_identity_and_post_unlink_path_absence",
      filingCount: 3,
      ownerDeleteObservedAt: OWNER_DELETE_AT,
      ownerDeleteRequestedAt: OWNER_DELETE_AT,
      payloadRootDisposition: "directory_retained_empty",
      reason: "owner_requested",
      state: "owner_delete_live_payloads_absent_observed",
      status: "live_payload_names_absent_after_explicit_personal_delete",
      version: 2,
    });
    expect(Object.isFrozen(deleted)).toBe(true);
    expect((await stat(fixture.payloadRootPath)).isDirectory()).toBe(true);
    expect(await readdir(fixture.payloadRootPath)).toEqual([]);
    expect((await readdir(fixture.auditRootPath)).sort()).toEqual(
      terminalAuditNames(),
    );

    const intentBytes = await readFile(
      join(
        fixture.auditRootPath,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
      ),
    );
    const receiptBytes = await readFile(
      join(
        fixture.auditRootPath,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceipt,
      ),
    );
    expectCanonicalAudit(intentBytes);
    const persistedReceipt = expectCanonicalAudit(receiptBytes);
    const { deletionReceiptSha256, ...publicPersisted } = deleted;
    expect(persistedReceipt).toEqual(publicPersisted);
    expect(deleted.deletionIntentSha256).toBe(sha256(intentBytes));
    expect(deletionReceiptSha256).toBe(sha256(receiptBytes));
  });

  it("replays the terminal receipt without recreating or requiring payload files", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode("terminal-replay-one"),
      new TextEncoder().encode("terminal-replay-two"),
    ]);
    const custody = await recordPersonalFilingPayloadCustodyWithRuntime(
      fixture.input,
      runtimeAt(CUSTODY_RECORDED_AT),
    );
    const input = deletionInput(fixture, custody.custodyRecordSha256);
    const first = await deletePersonalFilingPayloadCustodyWithRuntime(
      input,
      runtimeAt(OWNER_DELETE_AT),
    );
    const before = await auditHashes(fixture.auditRootPath);
    const replay = await deletePersonalFilingPayloadCustodyWithRuntime(
      input,
      runtimeAt("2026-09-30T00:00:00.000Z"),
    );

    expect(replay).toEqual(first);
    expect(await auditHashes(fixture.auditRootPath)).toEqual(before);
    expect(await readdir(fixture.payloadRootPath)).toEqual([]);
  });

  it("honors an immediate explicit owner deletion before the retention target", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode("delete-on-request"),
    ]);
    const custody = await recordPersonalFilingPayloadCustodyWithRuntime(
      fixture.input,
      runtimeAt(CUSTODY_RECORDED_AT),
    );
    expect(Date.parse(OWNER_DELETE_AT)).toBeLessThan(
      Date.parse(custody.retentionTargetAt),
    );

    const deleted = await deletePersonalFilingPayloadCustodyWithRuntime(
      deletionInput(fixture, custody.custodyRecordSha256),
      runtimeAt(OWNER_DELETE_AT),
    );
    expect(deleted.ownerDeleteRequestedAt).toBe(OWNER_DELETE_AT);
    expect(Date.parse(deleted.ownerDeleteRequestedAt)).toBeLessThan(
      Date.parse(deleted.retentionTargetAt),
    );
    expect(await readdir(fixture.payloadRootPath)).toEqual([]);
  });

  it("rejects the wrong owner confirmation or expected custody digest before intent publication", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode("confirmation-bound"),
    ]);
    const custody = await recordPersonalFilingPayloadCustodyWithRuntime(
      fixture.input,
      runtimeAt(CUSTODY_RECORDED_AT),
    );
    const valid = deletionInput(fixture, custody.custodyRecordSha256);

    await expectCustodyFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(
        {
          ...valid,
          confirmation: "delete-something-else",
        } as unknown as PersonalFilingPayloadDeletionInput,
        runtimeAt(OWNER_DELETE_AT),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );
    await expectCustodyFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(
        {
          ...valid,
          expectedCustodyRecordSha256: `sha256:${"f".repeat(64)}`,
        },
        runtimeAt(OWNER_DELETE_AT),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_SCOPE_MISMATCH",
    );

    expect(await readdir(fixture.auditRootPath)).toEqual([
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
    ]);
    expect(await readdir(fixture.payloadRootPath)).toEqual([
      "0001234567-26-000001.payload",
    ]);
  });

  it("retains deletion intent after a partial failure and resumes to one terminal receipt", async () => {
    const fixture = await buildFixture([
      new TextEncoder().encode("partial-one"),
      new TextEncoder().encode("partial-two"),
      new TextEncoder().encode("partial-three"),
    ]);
    const custody = await recordPersonalFilingPayloadCustodyWithRuntime(
      fixture.input,
      runtimeAt(CUSTODY_RECORDED_AT),
    );
    const input = deletionInput(fixture, custody.custodyRecordSha256);
    let unlinked = 0;
    let injected = false;
    const partialRuntime: PersonalFilingPayloadCustodyTestRuntime = {
      now: () => new Date(OWNER_DELETE_AT),
      phase: (phase) => {
        if (phase === "after_payload_unlink") {
          unlinked += 1;
          if (!injected) {
            injected = true;
            throw new Error("private partial delete fault");
          }
        }
      },
    };

    await expectCustodyFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(input, partialRuntime),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_DELETION_FAILED",
    );
    expect(unlinked).toBe(1);
    expect((await readdir(fixture.auditRootPath)).sort()).toEqual(
      [
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
      ].sort(),
    );
    expect(await readdir(fixture.payloadRootPath)).toHaveLength(2);
    const intentPath = join(
      fixture.auditRootPath,
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
    );
    const intentHash = sha256(await readFile(intentPath));

    const result = await deletePersonalFilingPayloadCustodyWithRuntime(
      input,
      runtimeAt("2026-08-28T12:00:01.000Z"),
    );
    expect(result.deletionIntentSha256).toBe(intentHash);
    expect(result.ownerDeleteRequestedAt).toBe(OWNER_DELETE_AT);
    expect(result.ownerDeleteObservedAt).toBe("2026-08-28T12:00:01.000Z");
    expect(await readdir(fixture.payloadRootPath)).toEqual([]);
    expect((await readdir(fixture.auditRootPath)).sort()).toEqual(
      terminalAuditNames(),
    );
  });

  it("rejects extra payload or audit entries without deleting manifest-bound files", async () => {
    const extraPayload = await buildFixture([
      new TextEncoder().encode("expected-live-payload"),
    ]);
    await writeFile(
      join(extraPayload.payloadRootPath, "unexpected.payload"),
      new TextEncoder().encode("unexpected"),
    );
    await expectCustodyFailure(
      recordPersonalFilingPayloadCustodyWithRuntime(
        extraPayload.input,
        runtimeAt(CUSTODY_RECORDED_AT),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
    );
    expect(await readdir(extraPayload.auditRootPath)).toEqual([]);

    const extraAudit = await buildFixture([
      new TextEncoder().encode("audit-bound-payload"),
    ]);
    const custody = await recordPersonalFilingPayloadCustodyWithRuntime(
      extraAudit.input,
      runtimeAt(CUSTODY_RECORDED_AT),
    );
    await writeFile(
      join(extraAudit.auditRootPath, "unexpected.json"),
      new TextEncoder().encode("{}\n"),
    );
    await expectCustodyFailure(
      deletePersonalFilingPayloadCustodyWithRuntime(
        deletionInput(extraAudit, custody.custodyRecordSha256),
        runtimeAt(OWNER_DELETE_AT),
      ),
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    expect(await readdir(extraAudit.payloadRootPath)).toEqual([
      "0001234567-26-000001.payload",
    ]);
  });
});

interface Fixture {
  readonly auditRootPath: string;
  readonly input: PersonalFilingPayloadCustodyInput;
  readonly payloadPaths: readonly string[];
  readonly payloadRootPath: string;
  readonly payloads: readonly Uint8Array[];
}

async function buildFixture(payloads: readonly Uint8Array[]): Promise<Fixture> {
  const temporaryDirectory = await mkdtemp(
    join(await realpath(tmpdir()), "personal-payload-custody-"),
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
    corpusId: "personal-payload-custody-2026",
    corpusVersion: "1.0.0",
    entries,
    frozenAt: "2026-08-27T18:00:00.000Z",
    profile: "personal_single_user_local",
    schemaVersion: "1.0.0",
  });
  const declaration = declarationFor(manifest);
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

function declarationFor(manifest: Uint8Array): Uint8Array {
  return canonicalBytes({
    commercialUse: "prohibited",
    corpusId: "personal-payload-custody-2026",
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

function terminalAuditNames(): string[] {
  return [
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceipt,
  ].sort();
}

async function auditHashes(
  auditRootPath: string,
): Promise<Readonly<Record<string, `sha256:${string}`>>> {
  const entries = (await readdir(auditRootPath)).sort();
  const hashes = Object.create(null) as Record<string, `sha256:${string}`>;
  for (const entry of entries) {
    hashes[entry] = sha256(await readFile(join(auditRootPath, entry)));
  }
  return Object.freeze(hashes);
}

function expectCanonicalAudit(bytes: Uint8Array): JsonRecord {
  const text = new TextDecoder().decode(bytes);
  expect(text.endsWith("\n")).toBe(true);
  expect(text.slice(0, -1)).not.toContain("\n");
  const parsed = JSON.parse(text) as JsonRecord;
  expect(text).toBe(`${JSON.stringify(parsed)}\n`);
  return parsed;
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

async function expectCustodyFailure(
  promise: Promise<unknown>,
  code: PersonalFilingPayloadCustodyError["code"],
): Promise<void> {
  try {
    await promise;
    throw new Error("expected custody operation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalFilingPayloadCustodyError);
    expect((error as PersonalFilingPayloadCustodyError).code).toBe(code);
    expect((error as Error).message).toBe(
      "Personal filing payload custody operation failed.",
    );
    expect((error as { cause?: unknown }).cause).toBeUndefined();
  }
}
