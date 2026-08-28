import { createHash } from "node:crypto";
import { constants as fsConstants, type BigIntStats } from "node:fs";
import {
  lstat,
  open,
  opendir,
  realpath,
  rename,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path";

import {
  PERSONAL_FILING_CORPUS_LIMITS,
  PERSONAL_FILING_CORPUS_PROFILE,
  PersonalFilingCorpusError,
  verifyPersonalFilingCorpusManifest,
  type PersonalFilingCorpusRecord,
} from "./personal-filing-corpus";
import {
  PERSONAL_FILING_PAYLOAD_IDENTITY_CLAIM,
  PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS,
  PERSONAL_FILING_PAYLOAD_PATH_MAPPING,
  PersonalFilingPayloadIdentityError,
  personalFilingPayloadRelativePath,
  verifyPersonalFilingCorpusPayloadIdentity,
  type PersonalFilingPayloadIdentityRecord,
  type PersonalFilingPayloadLinkAssurance,
} from "./personal-filing-payload-identity";

export const PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION = "1.0.0" as const;
export const PERSONAL_FILING_PAYLOAD_CUSTODY_CLAIM =
  "bounded_separate_local_payload_and_audit_custody_recorded_for_personal_single_user_local_use" as const;
export const PERSONAL_FILING_PAYLOAD_DELETION_CLAIM =
  "bounded_owner_triggered_selected_live_payload_paths_observed_absent_for_personal_single_user_local_use" as const;
export const PERSONAL_FILING_PAYLOAD_DELETE_CONFIRMATION =
  "delete_all_manifest_bound_local_payloads" as const;

export const PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES = Object.freeze({
  custody: "personal-filing-payload-custody-v1.json",
  custodyPending: ".personal-filing-payload-custody-v1.pending",
  deletionIntent: "personal-filing-payload-delete-intent-v1.json",
  deletionIntentPending: ".personal-filing-payload-delete-intent-v1.pending",
  deletionReceipt: "personal-filing-payload-delete-receipt-v1.json",
  deletionReceiptPending: ".personal-filing-payload-delete-receipt-v1.pending",
});

export const PERSONAL_FILING_PAYLOAD_CUSTODY_CHECKS = Object.freeze([
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
] as const);

export const PERSONAL_FILING_PAYLOAD_CUSTODY_NOT_PROVEN = Object.freeze([
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
] as const);

export const PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS = Object.freeze({
  auditFileBytes: 16_384,
  auditFilesIncludingPending: 4,
  chunkBytes: PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.chunkBytes,
  rootPathCodeUnits: PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.rootPathCodeUnits,
});

export const PERSONAL_FILING_PAYLOAD_CUSTODY_FAILURE_CODES = Object.freeze([
  "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
  "PERSONAL_FILING_PAYLOAD_CUSTODY_DOCUMENT_INVALID",
  "PERSONAL_FILING_PAYLOAD_CUSTODY_SCOPE_MISMATCH",
  "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
  "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
  "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
  "PERSONAL_FILING_PAYLOAD_CUSTODY_DELETION_FAILED",
] as const);

export type PersonalFilingPayloadCustodyFailureCode =
  (typeof PERSONAL_FILING_PAYLOAD_CUSTODY_FAILURE_CODES)[number];

export type PersonalFilingPayloadDeletionAssurance =
  "observed_pre_unlink_identity_and_post_unlink_path_absence";

export class PersonalFilingPayloadCustodyError extends Error {
  public constructor(
    public readonly code: PersonalFilingPayloadCustodyFailureCode,
  ) {
    super("Personal filing payload custody operation failed.");
    this.name = "PersonalFilingPayloadCustodyError";
  }
}

class InternalPersonalFilingPayloadCustodyFailure extends Error {
  public constructor(
    public readonly code: PersonalFilingPayloadCustodyFailureCode,
  ) {
    super();
  }
}

export interface PersonalFilingPayloadCustodyInput {
  readonly auditRootPath: string;
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
  readonly payloadRootPath: string;
}

export interface PersonalFilingPayloadDeletionInput extends PersonalFilingPayloadCustodyInput {
  readonly confirmation: typeof PERSONAL_FILING_PAYLOAD_DELETE_CONFIRMATION;
  readonly expectedCustodyRecordSha256: `sha256:${string}`;
}

export interface PersonalFilingPayloadCustodyRecord {
  readonly claim: typeof PERSONAL_FILING_PAYLOAD_CUSTODY_CLAIM;
  readonly corpusId: string;
  readonly corpusVersion: "1.0.0";
  readonly custodyRecordedAt: string;
  readonly custodyRecordSha256: `sha256:${string}`;
  readonly declarationSha256: `sha256:${string}`;
  readonly deletionMode: "owner_managed_local_delete";
  readonly filingCount: number;
  readonly frozenAt: string;
  readonly linkAssurance: PersonalFilingPayloadLinkAssurance;
  readonly locationBindingSha256: `sha256:${string}`;
  readonly manifestSha256: `sha256:${string}`;
  readonly pathMapping: typeof PERSONAL_FILING_PAYLOAD_PATH_MAPPING;
  readonly payloadIdentityBindingSha256: `sha256:${string}`;
  readonly profile: typeof PERSONAL_FILING_CORPUS_PROFILE;
  readonly retentionDays: number;
  readonly retentionTargetAt: string;
  readonly schemaVersion: typeof PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION;
  readonly state: "live_payloads_verified";
  readonly status: "local_payload_custody_recorded_for_personal_use";
  readonly totalVerifiedBytes: number;
  readonly version: 1;
}

export interface PersonalFilingPayloadDeletionRecord {
  readonly auditDisposition: "custody_intent_and_terminal_receipt_retained";
  readonly claim: typeof PERSONAL_FILING_PAYLOAD_DELETION_CLAIM;
  readonly confirmedAbsentBytes: number;
  readonly confirmedAbsentFileCount: number;
  readonly corpusId: string;
  readonly corpusVersion: "1.0.0";
  readonly custodyRecordSha256: `sha256:${string}`;
  readonly declarationSha256: `sha256:${string}`;
  readonly deletionAssurance: PersonalFilingPayloadDeletionAssurance;
  readonly deletionIntentSha256: `sha256:${string}`;
  readonly deletionReceiptSha256: `sha256:${string}`;
  readonly filingCount: number;
  readonly linkAssurance: PersonalFilingPayloadLinkAssurance;
  readonly locationBindingSha256: `sha256:${string}`;
  readonly manifestSha256: `sha256:${string}`;
  readonly ownerDeleteObservedAt: string;
  readonly ownerDeleteRequestedAt: string;
  readonly pathMapping: typeof PERSONAL_FILING_PAYLOAD_PATH_MAPPING;
  readonly payloadRootDisposition: "directory_retained_empty";
  readonly profile: typeof PERSONAL_FILING_CORPUS_PROFILE;
  readonly reason: "owner_requested";
  readonly retentionDays: number;
  readonly retentionTargetAt: string;
  readonly schemaVersion: typeof PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION;
  readonly state: "owner_delete_live_payloads_absent_observed";
  readonly status: "live_payload_names_absent_after_explicit_personal_delete";
  readonly version: 2;
}

export type PersonalFilingPayloadCustodyTestPhase =
  | "after_payload_identity"
  | "after_custody_pending_synced"
  | "after_custody_record_published"
  | "after_deletion_intent_pending_synced"
  | "after_deletion_intent_published"
  | "before_payload_unlink"
  | "after_payload_unlink"
  | "after_deletion_receipt_pending_synced"
  | "before_deletion_receipt_publish";

/** @internal Deterministic clock/fault seam; not re-exported by the package. */
export interface PersonalFilingPayloadCustodyTestRuntime {
  readonly now: () => Date;
  readonly phase?: (
    phase: PersonalFilingPayloadCustodyTestPhase,
    path?: string,
  ) => void | Promise<void>;
}

interface InputSnapshot {
  readonly auditRootPath: string;
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
  readonly payloadRootPath: string;
}

interface DeletionInputSnapshot extends InputSnapshot {
  readonly confirmation: typeof PERSONAL_FILING_PAYLOAD_DELETE_CONFIRMATION;
  readonly expectedCustodyRecordSha256: `sha256:${string}`;
}

interface DirectoryIdentity {
  readonly canonicalPath: string;
  readonly dev: bigint;
  readonly ino: bigint;
}

interface ManifestPayloadEntry {
  readonly accession: string;
  readonly contentBytes: number;
  readonly contentSha256: `sha256:${string}`;
  readonly relativePath: string;
}

interface PersistedCustodyRecord {
  readonly claim: typeof PERSONAL_FILING_PAYLOAD_CUSTODY_CLAIM;
  readonly corpusId: string;
  readonly corpusVersion: "1.0.0";
  readonly custodyRecordedAt: string;
  readonly declarationSha256: `sha256:${string}`;
  readonly deletionMode: "owner_managed_local_delete";
  readonly filingCount: number;
  readonly frozenAt: string;
  readonly linkAssurance: PersonalFilingPayloadLinkAssurance;
  readonly locationBindingSha256: `sha256:${string}`;
  readonly manifestSha256: `sha256:${string}`;
  readonly pathMapping: typeof PERSONAL_FILING_PAYLOAD_PATH_MAPPING;
  readonly payloadIdentityBindingSha256: `sha256:${string}`;
  readonly profile: typeof PERSONAL_FILING_CORPUS_PROFILE;
  readonly retentionDays: number;
  readonly retentionTargetAt: string;
  readonly schemaVersion: typeof PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION;
  readonly state: "live_payloads_verified";
  readonly status: "local_payload_custody_recorded_for_personal_use";
  readonly totalVerifiedBytes: number;
  readonly version: 1;
}

interface PersistedDeletionIntent {
  readonly claim: "bounded_owner_triggered_manifest_bound_live_payload_deletion_intent_recorded";
  readonly corpusId: string;
  readonly custodyRecordSha256: `sha256:${string}`;
  readonly declarationSha256: `sha256:${string}`;
  readonly filingCount: number;
  readonly locationBindingSha256: `sha256:${string}`;
  readonly manifestSha256: `sha256:${string}`;
  readonly ownerDeleteRequestedAt: string;
  readonly reason: "owner_requested";
  readonly retentionTargetAt: string;
  readonly schemaVersion: typeof PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION;
  readonly state: "owner_delete_intent_recorded";
  readonly totalSelectedBytes: number;
}

interface ValidatedDeletionIntent {
  readonly bytes: Uint8Array;
  readonly record: PersistedDeletionIntent;
}

type PersistedDeletionReceipt = Omit<
  PersonalFilingPayloadDeletionRecord,
  "deletionReceiptSha256"
>;

const DEFAULT_RUNTIME: PersonalFilingPayloadCustodyTestRuntime = Object.freeze({
  now: () => new Date(),
});
const HASH = /^sha256:[0-9a-f]{64}$/u;
const ACCESSION = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u;
const SAFE_ID = /^[a-z][a-z0-9._:-]{2,127}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MILLISECONDS_PER_DAY = 86_400_000;
const CUSTODY_RECORD_KEYS = Object.freeze([
  "claim",
  "corpusId",
  "corpusVersion",
  "custodyRecordedAt",
  "declarationSha256",
  "deletionMode",
  "filingCount",
  "frozenAt",
  "linkAssurance",
  "locationBindingSha256",
  "manifestSha256",
  "pathMapping",
  "payloadIdentityBindingSha256",
  "profile",
  "retentionDays",
  "retentionTargetAt",
  "schemaVersion",
  "state",
  "status",
  "totalVerifiedBytes",
  "version",
] as const);
const DELETION_INTENT_KEYS = Object.freeze([
  "claim",
  "corpusId",
  "custodyRecordSha256",
  "declarationSha256",
  "filingCount",
  "locationBindingSha256",
  "manifestSha256",
  "ownerDeleteRequestedAt",
  "reason",
  "retentionTargetAt",
  "schemaVersion",
  "state",
  "totalSelectedBytes",
] as const);
const DELETION_RECEIPT_KEYS = Object.freeze([
  "auditDisposition",
  "claim",
  "confirmedAbsentBytes",
  "confirmedAbsentFileCount",
  "corpusId",
  "corpusVersion",
  "custodyRecordSha256",
  "declarationSha256",
  "deletionAssurance",
  "deletionIntentSha256",
  "filingCount",
  "linkAssurance",
  "locationBindingSha256",
  "manifestSha256",
  "ownerDeleteObservedAt",
  "ownerDeleteRequestedAt",
  "pathMapping",
  "payloadRootDisposition",
  "profile",
  "reason",
  "retentionDays",
  "retentionTargetAt",
  "schemaVersion",
  "state",
  "status",
  "version",
] as const);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
);
const TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
);
const TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
);
const ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
);

export async function recordPersonalFilingPayloadCustody(
  input: PersonalFilingPayloadCustodyInput,
): Promise<PersonalFilingPayloadCustodyRecord> {
  if (arguments.length !== 1) {
    throw new PersonalFilingPayloadCustodyError(
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );
  }
  return recordPersonalFilingPayloadCustodyWithRuntime(input, DEFAULT_RUNTIME);
}

/** @internal Deterministic test seam; not re-exported by the package. */
export async function recordPersonalFilingPayloadCustodyWithRuntime(
  input: PersonalFilingPayloadCustodyInput,
  runtime: PersonalFilingPayloadCustodyTestRuntime,
): Promise<PersonalFilingPayloadCustodyRecord> {
  try {
    const snapshot = snapshotCustodyInput(input);
    const manifestRecord = verifyDocuments(snapshot);
    const roots = await captureSeparatedRoots(snapshot);
    const locationBindingSha256 = locationBinding(roots);
    const names = await auditInventory(roots.audit);

    if (
      exactNames(names, [
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custodyPending,
      ])
    ) {
      const identity = await verifyPayloadIdentity(snapshot);
      requireIdentityMatchesManifest(identity, manifestRecord);
      await requirePendingAuditCandidate(
        roots.audit,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custodyPending,
      );
      const pendingBytes = await readAuditFile(
        roots.audit,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custodyPending,
      );
      validateCustodyRecord(
        pendingBytes,
        manifestRecord,
        locationBindingSha256,
        identity,
      );
      await phase(runtime, "after_payload_identity");
      await revalidateRoots(roots);
      const stableIdentity = await verifyPayloadIdentity(snapshot);
      requireIdentityMatchesManifest(stableIdentity, manifestRecord);
      validateCustodyRecord(
        pendingBytes,
        manifestRecord,
        locationBindingSha256,
        stableIdentity,
      );
      await promoteValidatedPendingAuditFile(
        roots.audit,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custodyPending,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
        pendingBytes,
      );
      await phase(runtime, "after_custody_record_published");
      const stableRecord = await requireStableCustodyObservation(
        snapshot,
        roots,
        manifestRecord,
        locationBindingSha256,
        stableIdentity,
        pendingBytes,
      );
      return stableRecord;
    }

    if (
      exactNames(names, [PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody])
    ) {
      const identity = await verifyPayloadIdentity(snapshot);
      requireIdentityMatchesManifest(identity, manifestRecord);
      await phase(runtime, "after_payload_identity");
      const stableRecord = await requireStableCustodyObservation(
        snapshot,
        roots,
        manifestRecord,
        locationBindingSha256,
        identity,
      );
      return stableRecord;
    }
    if (names.length !== 0) failAuditRoot();

    const identity = await verifyPayloadIdentity(snapshot);
    requireIdentityMatchesManifest(identity, manifestRecord);
    await phase(runtime, "after_payload_identity");
    await revalidateRoots(roots);
    const stableIdentity = await verifyPayloadIdentity(snapshot);
    requireIdentityMatchesManifest(stableIdentity, manifestRecord);
    const custodyRecordedAt = currentInstant(runtime);
    const persisted = createCustodyRecord(
      manifestRecord,
      stableIdentity,
      locationBindingSha256,
      custodyRecordedAt,
    );
    const bytes = canonicalBytes(persisted);
    await publishAuditFile(
      roots.audit,
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custodyPending,
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
      bytes,
      runtime,
      "after_custody_pending_synced",
    );
    await phase(runtime, "after_custody_record_published");
    const stableRecord = await requireStableCustodyObservation(
      snapshot,
      roots,
      manifestRecord,
      locationBindingSha256,
      stableIdentity,
      bytes,
    );
    return stableRecord;
  } catch (error) {
    throw publicError(error);
  }
}

export async function deletePersonalFilingPayloadCustody(
  input: PersonalFilingPayloadDeletionInput,
): Promise<PersonalFilingPayloadDeletionRecord> {
  if (arguments.length !== 1) {
    throw new PersonalFilingPayloadCustodyError(
      "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
    );
  }
  return deletePersonalFilingPayloadCustodyWithRuntime(input, DEFAULT_RUNTIME);
}

/** @internal Deterministic test seam; not re-exported by the package. */
export async function deletePersonalFilingPayloadCustodyWithRuntime(
  input: PersonalFilingPayloadDeletionInput,
  runtime: PersonalFilingPayloadCustodyTestRuntime,
): Promise<PersonalFilingPayloadDeletionRecord> {
  try {
    const snapshot = snapshotDeletionInput(input);
    const manifestRecord = verifyDocuments(snapshot);
    const entries = parseManifestEntries(snapshot.manifest, manifestRecord);
    const roots = await captureSeparatedRoots(snapshot);
    const locationBindingSha256 = locationBinding(roots);
    let names = await auditInventory(roots.audit);
    requireRecoverableAuditState(names);

    const custodyBytes = await readAuditFile(
      roots.audit,
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
    );
    const custodyRecordSha256 = sha256(custodyBytes);
    if (custodyRecordSha256 !== snapshot.expectedCustodyRecordSha256) {
      fail("PERSONAL_FILING_PAYLOAD_CUSTODY_SCOPE_MISMATCH");
    }
    const persistedCustody = validateCustodyRecord(
      custodyBytes,
      manifestRecord,
      locationBindingSha256,
    );

    if (exactNames(names, pendingDeletionIntentAuditNames())) {
      await requirePendingAuditCandidate(
        roots.audit,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntentPending,
      );
      const pendingIntent = await readAndValidateDeletionIntentFile(
        roots.audit,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntentPending,
        persistedCustody,
        custodyRecordSha256,
      );
      await promoteValidatedPendingAuditFile(
        roots.audit,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntentPending,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
        pendingIntent.bytes,
      );
      names = await auditInventory(roots.audit);
    }

    if (exactNames(names, pendingDeletionReceiptAuditNames())) {
      const validatedIntent = await readAndValidateDeletionIntent(
        roots.audit,
        persistedCustody,
        custodyRecordSha256,
      );
      await requirePendingAuditCandidate(
        roots.audit,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceiptPending,
      );
      const pendingReceiptBytes = await readAuditFile(
        roots.audit,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceiptPending,
      );
      validateDeletionReceipt(
        pendingReceiptBytes,
        persistedCustody,
        custodyRecordSha256,
        sha256(validatedIntent.bytes),
        validatedIntent.record,
      );
      await requirePayloadInventory(roots.payload, entries, true);
      await promoteValidatedPendingAuditFile(
        roots.audit,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceiptPending,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceipt,
        pendingReceiptBytes,
      );
      names = await auditInventory(roots.audit);
    }
    requireAllowedAuditState(names);

    if (
      names.includes(
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceipt,
      )
    ) {
      const validatedIntent = await readAndValidateDeletionIntent(
        roots.audit,
        persistedCustody,
        custodyRecordSha256,
      );
      const receiptBytes = await readAuditFile(
        roots.audit,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceipt,
      );
      const receipt = validateDeletionReceipt(
        receiptBytes,
        persistedCustody,
        custodyRecordSha256,
        sha256(validatedIntent.bytes),
        validatedIntent.record,
      );
      await requirePayloadInventory(roots.payload, entries, true);
      await requireAuditInventory(roots.audit, terminalAuditNames());
      await revalidateRoots(roots);
      return deletionRecord(receipt, sha256(receiptBytes));
    }

    let intent: PersistedDeletionIntent;
    let intentBytes: Uint8Array;
    if (
      names.includes(PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent)
    ) {
      const validatedIntent = await readAndValidateDeletionIntent(
        roots.audit,
        persistedCustody,
        custodyRecordSha256,
      );
      intent = validatedIntent.record;
      intentBytes = validatedIntent.bytes;
    } else {
      const identity = await verifyPayloadIdentity(snapshot);
      requireIdentityMatchesCustody(identity, persistedCustody);
      await phase(runtime, "after_payload_identity");
      await revalidateRoots(roots);
      requireIdentityMatchesManifest(identity, manifestRecord);
      intent = createDeletionIntent(
        persistedCustody,
        custodyRecordSha256,
        currentInstant(runtime),
      );
      intentBytes = canonicalBytes(intent);
      await publishAuditFile(
        roots.audit,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntentPending,
        PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
        intentBytes,
        runtime,
        "after_deletion_intent_pending_synced",
      );
      await phase(runtime, "after_deletion_intent_published");
      await requireAuditInventory(roots.audit, pendingDeletionAuditNames());
    }

    await requireUnchangedPendingAuditChain(
      roots.audit,
      manifestRecord,
      locationBindingSha256,
      custodyBytes,
      custodyRecordSha256,
      intentBytes,
    );
    await requirePayloadInventory(roots.payload, entries, false);
    for (const entry of entries) {
      await revalidateRoots(roots);
      await verifyAndUnlinkPayload(roots.payload, entry, runtime);
    }
    await requirePayloadInventory(roots.payload, entries, true);
    await revalidateRoots(roots);
    await phase(runtime, "before_deletion_receipt_publish");
    const stableIntent = await requireUnchangedPendingAuditChain(
      roots.audit,
      manifestRecord,
      locationBindingSha256,
      custodyBytes,
      custodyRecordSha256,
      intentBytes,
    );

    const receipt = createDeletionReceipt(
      persistedCustody,
      custodyRecordSha256,
      sha256(intentBytes),
      stableIntent,
      currentInstant(runtime),
    );
    const receiptBytes = canonicalBytes(receipt);
    await publishAuditFile(
      roots.audit,
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceiptPending,
      PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceipt,
      receiptBytes,
      runtime,
      "after_deletion_receipt_pending_synced",
    );
    const terminalReceipt = await requireUnchangedTerminalAuditChain(
      roots.audit,
      manifestRecord,
      locationBindingSha256,
      custodyBytes,
      custodyRecordSha256,
      intentBytes,
      receiptBytes,
    );
    names = await auditInventory(roots.audit);
    if (!exactNames(names, terminalAuditNames())) failAuditRecord();
    await requirePayloadInventory(roots.payload, entries, true);
    await revalidateRoots(roots);
    return deletionRecord(terminalReceipt, sha256(receiptBytes));
  } catch (error) {
    throw publicError(error);
  }
}

async function requireStableCustodyObservation(
  snapshot: InputSnapshot,
  roots: {
    readonly audit: DirectoryIdentity;
    readonly payload: DirectoryIdentity;
  },
  manifest: PersonalFilingCorpusRecord,
  locationBindingSha256: `sha256:${string}`,
  initialIdentity: PersonalFilingPayloadIdentityRecord,
  expectedBytes?: Uint8Array,
): Promise<PersonalFilingPayloadCustodyRecord> {
  await requireAuditInventory(roots.audit, [
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
  ]);
  const beforeBytes = await readAuditFile(
    roots.audit,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
  );
  if (expectedBytes !== undefined && !bytesEqual(beforeBytes, expectedBytes)) {
    failAuditRecord();
  }
  validateCustodyRecord(
    beforeBytes,
    manifest,
    locationBindingSha256,
    initialIdentity,
  );

  const finalIdentity = await verifyPayloadIdentity(snapshot);
  requireIdentityMatchesManifest(finalIdentity, manifest);
  const finalBytes = await readAuditFile(
    roots.audit,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
  );
  if (!bytesEqual(finalBytes, beforeBytes)) failAuditRecord();
  const persisted = validateCustodyRecord(
    finalBytes,
    manifest,
    locationBindingSha256,
    finalIdentity,
  );
  await requireAuditInventory(roots.audit, [
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
  ]);
  await revalidateRoots(roots);
  return custodyRecord(persisted, sha256(finalBytes));
}

async function requireUnchangedPendingAuditChain(
  auditRoot: DirectoryIdentity,
  manifest: PersonalFilingCorpusRecord,
  locationBindingSha256: `sha256:${string}`,
  expectedCustodyBytes: Uint8Array,
  custodyRecordSha256: `sha256:${string}`,
  expectedIntentBytes: Uint8Array,
): Promise<PersistedDeletionIntent> {
  await requireAuditInventory(auditRoot, pendingDeletionAuditNames());
  const custodyBytes = await readAuditFile(
    auditRoot,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
  );
  if (
    !bytesEqual(custodyBytes, expectedCustodyBytes) ||
    sha256(custodyBytes) !== custodyRecordSha256
  ) {
    failAuditRecord();
  }
  const custody = validateCustodyRecord(
    custodyBytes,
    manifest,
    locationBindingSha256,
  );
  const intent = await readAndValidateDeletionIntent(
    auditRoot,
    custody,
    custodyRecordSha256,
  );
  if (!bytesEqual(intent.bytes, expectedIntentBytes)) failAuditRecord();
  await requireAuditInventory(auditRoot, pendingDeletionAuditNames());
  return intent.record;
}

async function requireUnchangedTerminalAuditChain(
  auditRoot: DirectoryIdentity,
  manifest: PersonalFilingCorpusRecord,
  locationBindingSha256: `sha256:${string}`,
  expectedCustodyBytes: Uint8Array,
  custodyRecordSha256: `sha256:${string}`,
  expectedIntentBytes: Uint8Array,
  expectedReceiptBytes: Uint8Array,
): Promise<PersistedDeletionReceipt> {
  await requireAuditInventory(auditRoot, terminalAuditNames());
  const custodyBytes = await readAuditFile(
    auditRoot,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
  );
  if (
    !bytesEqual(custodyBytes, expectedCustodyBytes) ||
    sha256(custodyBytes) !== custodyRecordSha256
  ) {
    failAuditRecord();
  }
  const custody = validateCustodyRecord(
    custodyBytes,
    manifest,
    locationBindingSha256,
  );
  const intent = await readAndValidateDeletionIntent(
    auditRoot,
    custody,
    custodyRecordSha256,
  );
  if (!bytesEqual(intent.bytes, expectedIntentBytes)) failAuditRecord();
  const receiptBytes = await readAuditFile(
    auditRoot,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceipt,
  );
  if (!bytesEqual(receiptBytes, expectedReceiptBytes)) failAuditRecord();
  const receipt = validateDeletionReceipt(
    receiptBytes,
    custody,
    custodyRecordSha256,
    sha256(intent.bytes),
    intent.record,
  );
  await requireAuditInventory(auditRoot, terminalAuditNames());
  return receipt;
}

function snapshotCustodyInput(value: unknown): InputSnapshot {
  const descriptors = exactDataDescriptors(value, [
    "auditRootPath",
    "declaration",
    "manifest",
    "payloadRootPath",
  ]);
  if (descriptors === undefined) failInvalidInput();
  return Object.freeze({
    auditRootPath: snapshotRootPath(descriptors.auditRootPath?.value),
    declaration: byteSnapshot(
      descriptors.declaration?.value,
      PERSONAL_FILING_CORPUS_LIMITS.declarationBytes,
    ),
    manifest: byteSnapshot(
      descriptors.manifest?.value,
      PERSONAL_FILING_CORPUS_LIMITS.manifestBytes,
    ),
    payloadRootPath: snapshotRootPath(descriptors.payloadRootPath?.value),
  });
}

function snapshotDeletionInput(value: unknown): DeletionInputSnapshot {
  const descriptors = exactDataDescriptors(value, [
    "auditRootPath",
    "confirmation",
    "declaration",
    "expectedCustodyRecordSha256",
    "manifest",
    "payloadRootPath",
  ]);
  if (descriptors === undefined) failInvalidInput();
  const confirmation = descriptors.confirmation?.value as unknown;
  const expectedCustodyRecordSha256 = descriptors.expectedCustodyRecordSha256
    ?.value as unknown;
  if (
    confirmation !== PERSONAL_FILING_PAYLOAD_DELETE_CONFIRMATION ||
    typeof expectedCustodyRecordSha256 !== "string" ||
    !HASH.test(expectedCustodyRecordSha256)
  ) {
    failInvalidInput();
  }
  return Object.freeze({
    auditRootPath: snapshotRootPath(descriptors.auditRootPath?.value),
    confirmation,
    declaration: byteSnapshot(
      descriptors.declaration?.value,
      PERSONAL_FILING_CORPUS_LIMITS.declarationBytes,
    ),
    expectedCustodyRecordSha256:
      expectedCustodyRecordSha256 as `sha256:${string}`,
    manifest: byteSnapshot(
      descriptors.manifest?.value,
      PERSONAL_FILING_CORPUS_LIMITS.manifestBytes,
    ),
    payloadRootPath: snapshotRootPath(descriptors.payloadRootPath?.value),
  });
}

function snapshotRootPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS.rootPathCodeUnits ||
    value.includes("\u0000") ||
    !isAbsolute(value) ||
    /^[\\/]{2}/u.test(value)
  ) {
    failInvalidInput();
  }
  const resolved = resolve(value);
  if (samePath(resolved, parse(resolved).root)) failInvalidInput();
  return resolved;
}

function byteSnapshot(value: unknown, maximumBytes: number): Uint8Array {
  try {
    if (typeof value !== "object" || value === null) failInvalidInput();
    const bytes = value as Uint8Array;
    const tag = TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(bytes) as unknown;
    const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const backingByteLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      buffer,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      typeof byteLength !== "number" ||
      typeof backingByteLength !== "number" ||
      byteLength > maximumBytes ||
      Object.getPrototypeOf(bytes) !== Uint8Array.prototype ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    ) {
      failInvalidInput();
    }
    const snapshot = new Uint8Array(byteLength);
    Uint8Array.prototype.set.call(snapshot, bytes);
    return snapshot;
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    failInvalidInput();
  }
}

function verifyDocuments(snapshot: InputSnapshot): PersonalFilingCorpusRecord {
  try {
    return verifyPersonalFilingCorpusManifest({
      declaration: snapshot.declaration,
      manifest: snapshot.manifest,
    });
  } catch (error) {
    if (
      error instanceof PersonalFilingCorpusError &&
      error.code === "PERSONAL_FILING_CORPUS_SCOPE_MISMATCH"
    ) {
      fail("PERSONAL_FILING_PAYLOAD_CUSTODY_SCOPE_MISMATCH");
    }
    fail("PERSONAL_FILING_PAYLOAD_CUSTODY_DOCUMENT_INVALID");
  }
}

async function verifyPayloadIdentity(
  snapshot: InputSnapshot,
): Promise<PersonalFilingPayloadIdentityRecord> {
  try {
    return await verifyPersonalFilingCorpusPayloadIdentity({
      declaration: snapshot.declaration,
      manifest: snapshot.manifest,
      payloadRootPath: snapshot.payloadRootPath,
    });
  } catch (error) {
    if (error instanceof PersonalFilingPayloadIdentityError) {
      if (error.code === "PERSONAL_FILING_PAYLOAD_SCOPE_MISMATCH") {
        fail("PERSONAL_FILING_PAYLOAD_CUSTODY_SCOPE_MISMATCH");
      }
      if (error.code === "PERSONAL_FILING_PAYLOAD_DOCUMENT_INVALID") {
        fail("PERSONAL_FILING_PAYLOAD_CUSTODY_DOCUMENT_INVALID");
      }
      if (error.code === "PERSONAL_FILING_PAYLOAD_SET_INVALID") {
        fail("PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID");
      }
    }
    failInvalidInput();
  }
}

function parseManifestEntries(
  bytes: Uint8Array,
  manifestRecord: PersonalFilingCorpusRecord,
): readonly ManifestPayloadEntry[] {
  try {
    const document = JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
    ) as unknown;
    if (!isPlainRecord(document) || !Array.isArray(document.entries)) {
      fail("PERSONAL_FILING_PAYLOAD_CUSTODY_DOCUMENT_INVALID");
    }
    const entries = document.entries.map((value) => {
      if (!isPlainRecord(value)) {
        fail("PERSONAL_FILING_PAYLOAD_CUSTODY_DOCUMENT_INVALID");
      }
      if (
        typeof value.accession !== "string" ||
        !ACCESSION.test(value.accession) ||
        typeof value.contentSha256 !== "string" ||
        !HASH.test(value.contentSha256) ||
        !Number.isSafeInteger(value.contentBytes) ||
        (value.contentBytes as number) < 1 ||
        (value.contentBytes as number) >
          PERSONAL_FILING_CORPUS_LIMITS.entryContentBytes
      ) {
        fail("PERSONAL_FILING_PAYLOAD_CUSTODY_DOCUMENT_INVALID");
      }
      return Object.freeze({
        accession: value.accession,
        contentBytes: value.contentBytes as number,
        contentSha256: value.contentSha256 as `sha256:${string}`,
        relativePath: personalFilingPayloadRelativePath(value.accession),
      });
    });
    const totalBytes = entries.reduce(
      (total, entry) => total + entry.contentBytes,
      0,
    );
    if (
      entries.length !== manifestRecord.filingCount ||
      totalBytes !== manifestRecord.totalDeclaredBytes
    ) {
      fail("PERSONAL_FILING_PAYLOAD_CUSTODY_DOCUMENT_INVALID");
    }
    return Object.freeze(entries);
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    fail("PERSONAL_FILING_PAYLOAD_CUSTODY_DOCUMENT_INVALID");
  }
}

async function captureSeparatedRoots(snapshot: InputSnapshot): Promise<{
  readonly audit: DirectoryIdentity;
  readonly payload: DirectoryIdentity;
}> {
  const payload = await captureDirectory(
    snapshot.payloadRootPath,
    "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
  );
  const audit = await captureDirectory(
    snapshot.auditRootPath,
    "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
  );
  if (
    samePath(payload.canonicalPath, audit.canonicalPath) ||
    isContained(payload.canonicalPath, audit.canonicalPath) ||
    isContained(audit.canonicalPath, payload.canonicalPath)
  ) {
    failAuditRoot();
  }
  return Object.freeze({ audit, payload });
}

async function captureDirectory(
  path: string,
  code: PersonalFilingPayloadCustodyFailureCode,
): Promise<DirectoryIdentity> {
  try {
    const before = await requireLexicalDirectoryChain(path, code);
    const canonicalPath = resolve(await realpath(path));
    const after = await requireLexicalDirectoryChain(path, code);
    const canonical = await requireLexicalDirectoryChain(canonicalPath, code);
    if (
      !samePath(path, canonicalPath) ||
      !sameDirectoryIdentity(before, after) ||
      !sameDirectoryIdentity(before, canonical)
    ) {
      fail(code);
    }
    return Object.freeze({
      canonicalPath,
      dev: before.dev,
      ino: before.ino,
    });
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    fail(code);
  }
}

async function requireLexicalDirectoryChain(
  path: string,
  code: PersonalFilingPayloadCustodyFailureCode,
): Promise<BigIntStats> {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  let current = root;
  let metadata = await lstat(current, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.ino <= 0n
  ) {
    fail(code);
  }
  const remainder = relative(root, absolute);
  for (const component of remainder === "" ? [] : remainder.split(sep)) {
    current = join(current, component);
    metadata = await lstat(current, { bigint: true });
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      metadata.ino <= 0n
    ) {
      fail(code);
    }
  }
  return metadata;
}

async function revalidateRoots(roots: {
  readonly audit: DirectoryIdentity;
  readonly payload: DirectoryIdentity;
}): Promise<void> {
  await revalidateDirectory(
    roots.payload,
    "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
  );
  await revalidateDirectory(
    roots.audit,
    "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
  );
}

async function revalidateDirectory(
  identity: DirectoryIdentity,
  code: PersonalFilingPayloadCustodyFailureCode,
): Promise<void> {
  try {
    const current = await requireLexicalDirectoryChain(
      identity.canonicalPath,
      code,
    );
    const canonicalPath = resolve(await realpath(identity.canonicalPath));
    if (
      !samePath(canonicalPath, identity.canonicalPath) ||
      current.dev !== identity.dev ||
      current.ino !== identity.ino
    ) {
      fail(code);
    }
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    fail(code);
  }
}

function locationBinding(roots: {
  readonly audit: DirectoryIdentity;
  readonly payload: DirectoryIdentity;
}): `sha256:${string}` {
  return domainSha256("personal-filing-local-custody-location-v1", {
    auditCanonicalPath: roots.audit.canonicalPath,
    auditDevice: roots.audit.dev.toString(10),
    auditInode: roots.audit.ino.toString(10),
    payloadCanonicalPath: roots.payload.canonicalPath,
    payloadDevice: roots.payload.dev.toString(10),
    payloadInode: roots.payload.ino.toString(10),
  });
}

function requireIdentityMatchesManifest(
  identity: PersonalFilingPayloadIdentityRecord,
  manifest: PersonalFilingCorpusRecord,
): void {
  if (
    identity.corpusId !== manifest.corpusId ||
    identity.corpusVersion !== manifest.corpusVersion ||
    identity.declarationSha256 !== manifest.declarationSha256 ||
    identity.filingCount !== manifest.filingCount ||
    identity.frozenAt !== manifest.frozenAt ||
    identity.manifestSha256 !== manifest.manifestSha256 ||
    identity.profile !== manifest.profile ||
    identity.retentionDays !== manifest.retentionDays ||
    identity.totalVerifiedBytes !== manifest.totalDeclaredBytes
  ) {
    fail("PERSONAL_FILING_PAYLOAD_CUSTODY_SCOPE_MISMATCH");
  }
}

function requireIdentityMatchesCustody(
  identity: PersonalFilingPayloadIdentityRecord,
  custody: PersistedCustodyRecord,
): void {
  if (
    identity.claim !== PERSONAL_FILING_PAYLOAD_IDENTITY_CLAIM ||
    identity.corpusId !== custody.corpusId ||
    identity.corpusVersion !== custody.corpusVersion ||
    identity.declarationSha256 !== custody.declarationSha256 ||
    identity.filingCount !== custody.filingCount ||
    identity.frozenAt !== custody.frozenAt ||
    identity.linkAssurance !== custody.linkAssurance ||
    identity.manifestSha256 !== custody.manifestSha256 ||
    identity.pathMapping !== custody.pathMapping ||
    identity.profile !== custody.profile ||
    identity.retentionDays !== custody.retentionDays ||
    identity.totalVerifiedBytes !== custody.totalVerifiedBytes ||
    payloadIdentityBinding(identity) !== custody.payloadIdentityBindingSha256
  ) {
    fail("PERSONAL_FILING_PAYLOAD_CUSTODY_SCOPE_MISMATCH");
  }
}

function payloadIdentityBinding(
  identity: PersonalFilingPayloadIdentityRecord,
): `sha256:${string}` {
  return domainSha256("personal-filing-payload-identity-record-v1", identity);
}

function createCustodyRecord(
  manifest: PersonalFilingCorpusRecord,
  identity: PersonalFilingPayloadIdentityRecord,
  locationBindingSha256: `sha256:${string}`,
  custodyRecordedAt: string,
): PersistedCustodyRecord {
  return Object.freeze({
    claim: PERSONAL_FILING_PAYLOAD_CUSTODY_CLAIM,
    corpusId: manifest.corpusId,
    corpusVersion: manifest.corpusVersion,
    custodyRecordedAt,
    declarationSha256: manifest.declarationSha256,
    deletionMode: "owner_managed_local_delete",
    filingCount: manifest.filingCount,
    frozenAt: manifest.frozenAt,
    linkAssurance: identity.linkAssurance,
    locationBindingSha256,
    manifestSha256: manifest.manifestSha256,
    pathMapping: PERSONAL_FILING_PAYLOAD_PATH_MAPPING,
    payloadIdentityBindingSha256: payloadIdentityBinding(identity),
    profile: PERSONAL_FILING_CORPUS_PROFILE,
    retentionDays: manifest.retentionDays,
    retentionTargetAt: addDays(custodyRecordedAt, manifest.retentionDays),
    schemaVersion: PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION,
    state: "live_payloads_verified",
    status: "local_payload_custody_recorded_for_personal_use",
    totalVerifiedBytes: identity.totalVerifiedBytes,
    version: 1,
  });
}

function custodyRecord(
  persisted: PersistedCustodyRecord,
  custodyRecordSha256: `sha256:${string}`,
): PersonalFilingPayloadCustodyRecord {
  return Object.freeze({ ...persisted, custodyRecordSha256 });
}

function createDeletionIntent(
  custody: PersistedCustodyRecord,
  custodyRecordSha256: `sha256:${string}`,
  ownerDeleteRequestedAt: string,
): PersistedDeletionIntent {
  return Object.freeze({
    claim:
      "bounded_owner_triggered_manifest_bound_live_payload_deletion_intent_recorded",
    corpusId: custody.corpusId,
    custodyRecordSha256,
    declarationSha256: custody.declarationSha256,
    filingCount: custody.filingCount,
    locationBindingSha256: custody.locationBindingSha256,
    manifestSha256: custody.manifestSha256,
    ownerDeleteRequestedAt,
    reason: "owner_requested",
    retentionTargetAt: custody.retentionTargetAt,
    schemaVersion: PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION,
    state: "owner_delete_intent_recorded",
    totalSelectedBytes: custody.totalVerifiedBytes,
  });
}

function createDeletionReceipt(
  custody: PersistedCustodyRecord,
  custodyRecordSha256: `sha256:${string}`,
  deletionIntentSha256: `sha256:${string}`,
  intent: PersistedDeletionIntent,
  ownerDeleteObservedAt: string,
): PersistedDeletionReceipt {
  if (
    Date.parse(ownerDeleteObservedAt) <
    Date.parse(intent.ownerDeleteRequestedAt)
  ) {
    failDeletion();
  }
  return Object.freeze({
    auditDisposition: "custody_intent_and_terminal_receipt_retained",
    claim: PERSONAL_FILING_PAYLOAD_DELETION_CLAIM,
    confirmedAbsentBytes: custody.totalVerifiedBytes,
    confirmedAbsentFileCount: custody.filingCount,
    corpusId: custody.corpusId,
    corpusVersion: custody.corpusVersion,
    custodyRecordSha256,
    declarationSha256: custody.declarationSha256,
    deletionAssurance:
      "observed_pre_unlink_identity_and_post_unlink_path_absence",
    deletionIntentSha256,
    filingCount: custody.filingCount,
    linkAssurance: custody.linkAssurance,
    locationBindingSha256: custody.locationBindingSha256,
    manifestSha256: custody.manifestSha256,
    ownerDeleteObservedAt,
    ownerDeleteRequestedAt: intent.ownerDeleteRequestedAt,
    pathMapping: custody.pathMapping,
    payloadRootDisposition: "directory_retained_empty",
    profile: custody.profile,
    reason: "owner_requested",
    retentionDays: custody.retentionDays,
    retentionTargetAt: custody.retentionTargetAt,
    schemaVersion: PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION,
    state: "owner_delete_live_payloads_absent_observed",
    status: "live_payload_names_absent_after_explicit_personal_delete",
    version: 2,
  });
}

function deletionRecord(
  persisted: PersistedDeletionReceipt,
  deletionReceiptSha256: `sha256:${string}`,
): PersonalFilingPayloadDeletionRecord {
  return Object.freeze({ ...persisted, deletionReceiptSha256 });
}

function validateCustodyRecord(
  bytes: Uint8Array,
  manifest: PersonalFilingCorpusRecord,
  locationBindingSha256: `sha256:${string}`,
  identity?: PersonalFilingPayloadIdentityRecord,
): PersistedCustodyRecord {
  const record = exactRecord(
    parseCanonicalAudit(bytes),
    CUSTODY_RECORD_KEYS,
    "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
  );
  if (
    record.claim !== PERSONAL_FILING_PAYLOAD_CUSTODY_CLAIM ||
    typeof record.corpusId !== "string" ||
    !SAFE_ID.test(record.corpusId) ||
    record.corpusVersion !== "1.0.0" ||
    !isInstant(record.custodyRecordedAt) ||
    typeof record.declarationSha256 !== "string" ||
    !HASH.test(record.declarationSha256) ||
    record.deletionMode !== "owner_managed_local_delete" ||
    !Number.isSafeInteger(record.filingCount) ||
    (record.filingCount as number) < 1 ||
    (record.filingCount as number) > PERSONAL_FILING_CORPUS_LIMITS.entries ||
    !isInstant(record.frozenAt) ||
    !isLinkAssurance(record.linkAssurance) ||
    typeof record.locationBindingSha256 !== "string" ||
    !HASH.test(record.locationBindingSha256) ||
    typeof record.manifestSha256 !== "string" ||
    !HASH.test(record.manifestSha256) ||
    record.pathMapping !== PERSONAL_FILING_PAYLOAD_PATH_MAPPING ||
    typeof record.payloadIdentityBindingSha256 !== "string" ||
    !HASH.test(record.payloadIdentityBindingSha256) ||
    record.profile !== PERSONAL_FILING_CORPUS_PROFILE ||
    !Number.isSafeInteger(record.retentionDays) ||
    (record.retentionDays as number) < 1 ||
    (record.retentionDays as number) >
      PERSONAL_FILING_CORPUS_LIMITS.retentionDays ||
    !isInstant(record.retentionTargetAt) ||
    record.schemaVersion !== PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION ||
    record.state !== "live_payloads_verified" ||
    record.status !== "local_payload_custody_recorded_for_personal_use" ||
    !Number.isSafeInteger(record.totalVerifiedBytes) ||
    (record.totalVerifiedBytes as number) < 1 ||
    (record.totalVerifiedBytes as number) >
      PERSONAL_FILING_CORPUS_LIMITS.totalDeclaredContentBytes ||
    record.version !== 1
  ) {
    failAuditRecord();
  }
  const persisted = Object.freeze({
    claim: record.claim,
    corpusId: record.corpusId,
    corpusVersion: record.corpusVersion,
    custodyRecordedAt: record.custodyRecordedAt,
    declarationSha256: record.declarationSha256 as `sha256:${string}`,
    deletionMode: record.deletionMode,
    filingCount: record.filingCount as number,
    frozenAt: record.frozenAt,
    linkAssurance: record.linkAssurance,
    locationBindingSha256: record.locationBindingSha256 as `sha256:${string}`,
    manifestSha256: record.manifestSha256 as `sha256:${string}`,
    pathMapping: record.pathMapping,
    payloadIdentityBindingSha256:
      record.payloadIdentityBindingSha256 as `sha256:${string}`,
    profile: record.profile,
    retentionDays: record.retentionDays as number,
    retentionTargetAt: record.retentionTargetAt,
    schemaVersion: record.schemaVersion,
    state: record.state,
    status: record.status,
    totalVerifiedBytes: record.totalVerifiedBytes as number,
    version: record.version,
  });
  if (
    persisted.corpusId !== manifest.corpusId ||
    persisted.corpusVersion !== manifest.corpusVersion ||
    persisted.declarationSha256 !== manifest.declarationSha256 ||
    persisted.filingCount !== manifest.filingCount ||
    persisted.frozenAt !== manifest.frozenAt ||
    persisted.locationBindingSha256 !== locationBindingSha256 ||
    persisted.manifestSha256 !== manifest.manifestSha256 ||
    persisted.profile !== manifest.profile ||
    persisted.retentionDays !== manifest.retentionDays ||
    persisted.retentionTargetAt !==
      addDays(persisted.custodyRecordedAt, persisted.retentionDays) ||
    persisted.totalVerifiedBytes !== manifest.totalDeclaredBytes
  ) {
    fail("PERSONAL_FILING_PAYLOAD_CUSTODY_SCOPE_MISMATCH");
  }
  if (identity !== undefined)
    requireIdentityMatchesCustody(identity, persisted);
  return persisted;
}

async function readAndValidateDeletionIntent(
  auditRoot: DirectoryIdentity,
  custody: PersistedCustodyRecord,
  custodyRecordSha256: `sha256:${string}`,
): Promise<ValidatedDeletionIntent> {
  return readAndValidateDeletionIntentFile(
    auditRoot,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
    custody,
    custodyRecordSha256,
  );
}

async function readAndValidateDeletionIntentFile(
  auditRoot: DirectoryIdentity,
  name: string,
  custody: PersistedCustodyRecord,
  custodyRecordSha256: `sha256:${string}`,
): Promise<ValidatedDeletionIntent> {
  const bytes = await readAuditFile(auditRoot, name);
  const record = exactRecord(
    parseCanonicalAudit(bytes),
    DELETION_INTENT_KEYS,
    "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
  );
  if (
    record.claim !==
      "bounded_owner_triggered_manifest_bound_live_payload_deletion_intent_recorded" ||
    record.corpusId !== custody.corpusId ||
    record.custodyRecordSha256 !== custodyRecordSha256 ||
    record.declarationSha256 !== custody.declarationSha256 ||
    record.filingCount !== custody.filingCount ||
    record.locationBindingSha256 !== custody.locationBindingSha256 ||
    record.manifestSha256 !== custody.manifestSha256 ||
    !isInstant(record.ownerDeleteRequestedAt) ||
    record.reason !== "owner_requested" ||
    record.retentionTargetAt !== custody.retentionTargetAt ||
    record.schemaVersion !== PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION ||
    record.state !== "owner_delete_intent_recorded" ||
    record.totalSelectedBytes !== custody.totalVerifiedBytes
  ) {
    failAuditRecord();
  }
  return Object.freeze({
    bytes,
    record: Object.freeze({
      claim: record.claim,
      corpusId: record.corpusId,
      custodyRecordSha256: record.custodyRecordSha256,
      declarationSha256: record.declarationSha256,
      filingCount: record.filingCount,
      locationBindingSha256: record.locationBindingSha256,
      manifestSha256: record.manifestSha256,
      ownerDeleteRequestedAt: record.ownerDeleteRequestedAt,
      reason: record.reason,
      retentionTargetAt: record.retentionTargetAt,
      schemaVersion: record.schemaVersion,
      state: record.state,
      totalSelectedBytes: record.totalSelectedBytes,
    }),
  });
}

function validateDeletionReceipt(
  bytes: Uint8Array,
  custody: PersistedCustodyRecord,
  custodyRecordSha256: `sha256:${string}`,
  deletionIntentSha256: `sha256:${string}`,
  intent: PersistedDeletionIntent,
): PersistedDeletionReceipt {
  const record = exactRecord(
    parseCanonicalAudit(bytes),
    DELETION_RECEIPT_KEYS,
    "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID",
  );
  if (
    record.auditDisposition !==
      "custody_intent_and_terminal_receipt_retained" ||
    record.claim !== PERSONAL_FILING_PAYLOAD_DELETION_CLAIM ||
    record.confirmedAbsentBytes !== custody.totalVerifiedBytes ||
    record.confirmedAbsentFileCount !== custody.filingCount ||
    record.corpusId !== custody.corpusId ||
    record.corpusVersion !== custody.corpusVersion ||
    record.custodyRecordSha256 !== custodyRecordSha256 ||
    record.declarationSha256 !== custody.declarationSha256 ||
    record.deletionAssurance !==
      "observed_pre_unlink_identity_and_post_unlink_path_absence" ||
    record.deletionIntentSha256 !== deletionIntentSha256 ||
    record.filingCount !== custody.filingCount ||
    record.linkAssurance !== custody.linkAssurance ||
    record.locationBindingSha256 !== custody.locationBindingSha256 ||
    record.manifestSha256 !== custody.manifestSha256 ||
    !isInstant(record.ownerDeleteObservedAt) ||
    record.ownerDeleteRequestedAt !== intent.ownerDeleteRequestedAt ||
    Date.parse(record.ownerDeleteObservedAt) <
      Date.parse(intent.ownerDeleteRequestedAt) ||
    record.pathMapping !== custody.pathMapping ||
    record.payloadRootDisposition !== "directory_retained_empty" ||
    record.profile !== custody.profile ||
    record.reason !== "owner_requested" ||
    record.retentionDays !== custody.retentionDays ||
    record.retentionTargetAt !== custody.retentionTargetAt ||
    record.schemaVersion !== PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION ||
    record.state !== "owner_delete_live_payloads_absent_observed" ||
    record.status !==
      "live_payload_names_absent_after_explicit_personal_delete" ||
    record.version !== 2
  ) {
    failAuditRecord();
  }
  return Object.freeze({
    auditDisposition: record.auditDisposition,
    claim: record.claim,
    confirmedAbsentBytes: record.confirmedAbsentBytes,
    confirmedAbsentFileCount: record.confirmedAbsentFileCount,
    corpusId: record.corpusId,
    corpusVersion: record.corpusVersion,
    custodyRecordSha256: record.custodyRecordSha256,
    declarationSha256: record.declarationSha256,
    deletionAssurance: record.deletionAssurance,
    deletionIntentSha256: record.deletionIntentSha256,
    filingCount: record.filingCount,
    linkAssurance: record.linkAssurance as PersonalFilingPayloadLinkAssurance,
    locationBindingSha256: record.locationBindingSha256,
    manifestSha256: record.manifestSha256,
    ownerDeleteObservedAt: record.ownerDeleteObservedAt,
    ownerDeleteRequestedAt: record.ownerDeleteRequestedAt,
    pathMapping: record.pathMapping,
    payloadRootDisposition: record.payloadRootDisposition,
    profile: record.profile,
    reason: record.reason,
    retentionDays: record.retentionDays,
    retentionTargetAt: record.retentionTargetAt,
    schemaVersion: record.schemaVersion,
    state: record.state,
    status: record.status,
    version: record.version,
  });
}

function parseCanonicalAudit(bytes: Uint8Array): unknown {
  try {
    if (
      bytes.byteLength < 3 ||
      bytes.byteLength > PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS.auditFileBytes
    ) {
      failAuditRecord();
    }
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    if (!text.endsWith("\n") || text.slice(0, -1).includes("\n")) {
      failAuditRecord();
    }
    const parsed = JSON.parse(text) as unknown;
    if (!bytesEqual(bytes, canonicalBytes(parsed))) failAuditRecord();
    return parsed;
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    failAuditRecord();
  }
}

async function publishAuditFile(
  root: DirectoryIdentity,
  pendingName: string,
  finalName: string,
  bytes: Uint8Array,
  runtime: PersonalFilingPayloadCustodyTestRuntime,
  pendingPhase: Extract<
    PersonalFilingPayloadCustodyTestPhase,
    | "after_custody_pending_synced"
    | "after_deletion_intent_pending_synced"
    | "after_deletion_receipt_pending_synced"
  >,
): Promise<void> {
  let pendingCreated = false;
  let pendingPath: string | undefined;
  try {
    if (
      bytes.byteLength < 1 ||
      bytes.byteLength > PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS.auditFileBytes
    ) {
      failAuditRecord();
    }
    await revalidateDirectory(
      root,
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    pendingPath = directChild(root, pendingName);
    const finalPath = directChild(root, finalName);
    await requireAbsent(
      pendingPath,
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    await requireAbsent(
      finalPath,
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    const handle = await open(
      pendingPath,
      writeExclusiveNoFollowFlags(),
      0o600,
    );
    pendingCreated = true;
    let closed = false;
    try {
      await writeAll(handle, bytes);
      await handle.sync();
      const opened = await handle.stat({ bigint: true });
      requireAuditFileMetadata(opened, root, bytes.byteLength);
      await handle.close();
      closed = true;
    } finally {
      if (!closed) await handle.close();
    }
    const pendingBytes = await readAuditFile(root, pendingName);
    if (!bytesEqual(pendingBytes, bytes)) failAuditRecord();
    await phase(runtime, pendingPhase, pendingPath);
    await revalidateDirectory(
      root,
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    await rename(pendingPath, finalPath);
    const finalBytes = await readAuditFile(root, finalName);
    if (!bytesEqual(finalBytes, bytes)) failAuditRecord();
  } catch (error) {
    if (pendingCreated && pendingPath !== undefined) {
      await bestEffortUnlinkPending(pendingPath);
    }
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    failAuditRoot();
  }
}

async function bestEffortUnlinkPending(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isFileSystemCode(error, "ENOENT")) return;
  }
}

async function readAuditFile(
  root: DirectoryIdentity,
  name: string,
): Promise<Uint8Array> {
  try {
    await revalidateDirectory(
      root,
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    const path = directChild(root, name);
    const before = await lstat(path, { bigint: true });
    requireAuditFileMetadata(before, root);
    const canonical = resolve(await realpath(path));
    if (!samePath(canonical, path)) failAuditRecord();
    const handle = await open(path, readOnlyNoFollowFlags());
    let closed = false;
    try {
      const opened = await handle.stat({ bigint: true });
      requireAuditFileMetadata(opened, root);
      if (!sameExactIdentity(before, opened)) failAuditRecord();
      const size = Number(opened.size);
      if (!Number.isSafeInteger(size)) failAuditRecord();
      const bytes = new Uint8Array(size);
      let offset = 0;
      while (offset < bytes.byteLength) {
        const { bytesRead } = await handle.read(
          bytes,
          offset,
          bytes.byteLength - offset,
          offset,
        );
        if (!Number.isSafeInteger(bytesRead) || bytesRead < 1) {
          failAuditRecord();
        }
        offset += bytesRead;
      }
      const probe = new Uint8Array(1);
      try {
        const { bytesRead } = await handle.read(probe, 0, 1, offset);
        if (!Number.isSafeInteger(bytesRead) || bytesRead !== 0) {
          failAuditRecord();
        }
      } finally {
        probe.fill(0);
      }
      const afterDescriptor = await handle.stat({ bigint: true });
      const afterPath = await lstat(path, { bigint: true });
      requireAuditFileMetadata(afterDescriptor, root, size);
      requireAuditFileMetadata(afterPath, root, size);
      if (
        !sameExactIdentity(opened, afterDescriptor) ||
        !sameExactIdentity(afterDescriptor, afterPath)
      ) {
        failAuditRecord();
      }
      await handle.close();
      closed = true;
      return bytes;
    } finally {
      if (!closed) await handle.close();
    }
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    failAuditRecord();
  }
}

async function writeAll(handle: FileHandle, bytes: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const { bytesWritten } = await handle.write(
      bytes,
      offset,
      bytes.byteLength - offset,
      offset,
    );
    if (!Number.isSafeInteger(bytesWritten) || bytesWritten < 1) {
      failAuditRecord();
    }
    offset += bytesWritten;
  }
}

function requireAuditFileMetadata(
  metadata: BigIntStats,
  root: DirectoryIdentity,
  expectedBytes?: number,
): void {
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.ino <= 0n ||
    metadata.nlink !== 1n ||
    metadata.dev !== root.dev ||
    metadata.size < 1n ||
    metadata.size >
      BigInt(PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS.auditFileBytes) ||
    (expectedBytes !== undefined && metadata.size !== BigInt(expectedBytes))
  ) {
    failAuditRecord();
  }
}

async function requirePendingAuditCandidate(
  root: DirectoryIdentity,
  name: string,
): Promise<void> {
  try {
    await revalidateDirectory(
      root,
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    const path = directChild(root, name);
    const before = await lstat(path, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.ino <= 0n ||
      before.nlink !== 1n ||
      before.dev !== root.dev ||
      before.size < 1n ||
      before.size >
        BigInt(PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS.auditFileBytes)
    ) {
      failAuditRoot();
    }
    const canonical = resolve(await realpath(path));
    const immediatelyBefore = await lstat(path, { bigint: true });
    if (
      !samePath(canonical, path) ||
      !sameExactIdentity(before, immediatelyBefore)
    ) {
      failAuditRoot();
    }
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    failAuditRoot();
  }
}

async function promoteValidatedPendingAuditFile(
  root: DirectoryIdentity,
  pendingName: string,
  finalName: string,
  expectedBytes: Uint8Array,
): Promise<void> {
  try {
    await requirePendingAuditCandidate(root, pendingName);
    const pendingBytes = await readAuditFile(root, pendingName);
    if (!bytesEqual(pendingBytes, expectedBytes)) failAuditRecord();
    const pendingPath = directChild(root, pendingName);
    const finalPath = directChild(root, finalName);
    await requireAbsent(
      finalPath,
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    await revalidateDirectory(
      root,
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    await rename(pendingPath, finalPath);
    const finalBytes = await readAuditFile(root, finalName);
    if (!bytesEqual(finalBytes, expectedBytes)) failAuditRecord();
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    failAuditRoot();
  }
}

async function auditInventory(
  root: DirectoryIdentity,
): Promise<readonly string[]> {
  try {
    await revalidateDirectory(
      root,
      "PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID",
    );
    const directory = await opendir(root.canonicalPath);
    const names: string[] = [];
    try {
      while (true) {
        const entry = await directory.read();
        if (entry === null) break;
        names.push(entry.name);
        if (
          names.length >
          PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS.auditFilesIncludingPending
        ) {
          failAuditRoot();
        }
      }
    } finally {
      await directory.close();
    }
    return Object.freeze(names.sort());
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    failAuditRoot();
  }
}

async function requireAuditInventory(
  root: DirectoryIdentity,
  expected: readonly string[],
): Promise<void> {
  if (!exactNames(await auditInventory(root), expected)) failAuditRoot();
}

function requireAllowedAuditState(names: readonly string[]): void {
  if (
    !exactNames(names, [PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody]) &&
    !exactNames(names, pendingDeletionAuditNames()) &&
    !exactNames(names, terminalAuditNames())
  ) {
    failAuditRoot();
  }
}

function requireRecoverableAuditState(names: readonly string[]): void {
  if (
    !exactNames(names, [PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody]) &&
    !exactNames(names, pendingDeletionAuditNames()) &&
    !exactNames(names, terminalAuditNames()) &&
    !exactNames(names, pendingDeletionIntentAuditNames()) &&
    !exactNames(names, pendingDeletionReceiptAuditNames())
  ) {
    failAuditRoot();
  }
}

function pendingDeletionIntentAuditNames(): readonly string[] {
  return Object.freeze([
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntentPending,
  ]);
}

function pendingDeletionReceiptAuditNames(): readonly string[] {
  return Object.freeze([
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceiptPending,
  ]);
}

function pendingDeletionAuditNames(): readonly string[] {
  return Object.freeze([
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
  ]);
}

function terminalAuditNames(): readonly string[] {
  return Object.freeze([
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.custody,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionIntent,
    PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES.deletionReceipt,
  ]);
}

async function requirePayloadInventory(
  root: DirectoryIdentity,
  entries: readonly ManifestPayloadEntry[],
  requireEmpty: boolean,
): Promise<void> {
  try {
    await revalidateDirectory(
      root,
      "PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID",
    );
    const expected = new Set(entries.map((entry) => entry.relativePath));
    const directory = await opendir(root.canonicalPath);
    const names: string[] = [];
    try {
      while (true) {
        const entry = await directory.read();
        if (entry === null) break;
        names.push(entry.name);
        if (names.length > PERSONAL_FILING_CORPUS_LIMITS.entries) {
          failPayloadSet();
        }
      }
    } finally {
      await directory.close();
    }
    if (
      (requireEmpty && names.length !== 0) ||
      names.some((name) => !expected.has(name))
    ) {
      failPayloadSet();
    }
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    failPayloadSet();
  }
}

async function verifyAndUnlinkPayload(
  root: DirectoryIdentity,
  entry: ManifestPayloadEntry,
  runtime: PersonalFilingPayloadCustodyTestRuntime,
): Promise<void> {
  const candidate = directChild(root, entry.relativePath);
  let before: BigIntStats;
  try {
    before = await lstat(candidate, { bigint: true });
  } catch (error) {
    if (isFileSystemCode(error, "ENOENT")) return;
    failDeletion();
  }
  try {
    requireExpectedPayload(before, root, entry.contentBytes);
    const canonicalBefore = resolve(await realpath(candidate));
    if (!samePath(canonicalBefore, candidate)) failDeletion();
    const handle = await open(candidate, readOnlyNoFollowFlags());
    let closed = false;
    try {
      const opened = await handle.stat({ bigint: true });
      requireExpectedPayload(opened, root, entry.contentBytes);
      if (!sameExactIdentity(before, opened)) failDeletion();
      const contentSha256 = await readPayloadSha256(handle, entry.contentBytes);
      const afterDescriptor = await handle.stat({ bigint: true });
      const afterPath = await lstat(candidate, { bigint: true });
      const canonicalAfter = resolve(await realpath(candidate));
      const finalPath = await lstat(candidate, { bigint: true });
      requireExpectedPayload(afterDescriptor, root, entry.contentBytes);
      requireExpectedPayload(afterPath, root, entry.contentBytes);
      requireExpectedPayload(finalPath, root, entry.contentBytes);
      if (
        contentSha256 !== entry.contentSha256 ||
        !samePath(canonicalAfter, canonicalBefore) ||
        !sameExactIdentity(opened, afterDescriptor) ||
        !sameExactIdentity(afterDescriptor, afterPath) ||
        !sameExactIdentity(afterPath, finalPath)
      ) {
        failDeletion();
      }
      await phase(runtime, "before_payload_unlink", candidate);
      const immediatelyBefore = await lstat(candidate, { bigint: true });
      requireExpectedPayload(immediatelyBefore, root, entry.contentBytes);
      if (!sameExactIdentity(finalPath, immediatelyBefore)) failDeletion();
      await unlink(candidate);
      await requireAbsent(
        candidate,
        "PERSONAL_FILING_PAYLOAD_CUSTODY_DELETION_FAILED",
      );
      const retainedDescriptor = await handle.stat({ bigint: true });
      if (
        !retainedDescriptor.isFile() ||
        retainedDescriptor.dev !== opened.dev ||
        retainedDescriptor.ino !== opened.ino ||
        retainedDescriptor.size !== opened.size
      ) {
        failDeletion();
      }
      await phase(runtime, "after_payload_unlink", candidate);
      await handle.close();
      closed = true;
    } finally {
      if (!closed) await handle.close();
    }
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    failDeletion();
  }
}

async function readPayloadSha256(
  handle: FileHandle,
  expectedBytes: number,
): Promise<`sha256:${string}`> {
  const buffer = new Uint8Array(
    PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS.chunkBytes,
  );
  try {
    const hash = createHash("sha256");
    let offset = 0;
    while (offset < expectedBytes) {
      const requested = Math.min(buffer.byteLength, expectedBytes - offset);
      const { bytesRead } = await handle.read(buffer, 0, requested, offset);
      if (
        !Number.isSafeInteger(bytesRead) ||
        bytesRead < 1 ||
        bytesRead > requested
      ) {
        failDeletion();
      }
      hash.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }
    const { bytesRead } = await handle.read(buffer, 0, 1, offset);
    if (!Number.isSafeInteger(bytesRead) || bytesRead !== 0) failDeletion();
    return `sha256:${hash.digest("hex")}`;
  } finally {
    buffer.fill(0);
  }
}

function requireExpectedPayload(
  metadata: BigIntStats,
  root: DirectoryIdentity,
  expectedBytes: number,
): void {
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.ino <= 0n ||
    metadata.nlink !== 1n ||
    metadata.dev !== root.dev ||
    metadata.size !== BigInt(expectedBytes)
  ) {
    failDeletion();
  }
}

function directChild(root: DirectoryIdentity, name: string): string {
  if (
    typeof name !== "string" ||
    name.length < 1 ||
    name.includes("\u0000") ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    failInvalidInput();
  }
  const candidate = resolve(join(root.canonicalPath, name));
  const fromRoot = relative(root.canonicalPath, candidate);
  if (
    fromRoot === "" ||
    fromRoot === ".." ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot) ||
    fromRoot.includes(sep)
  ) {
    failInvalidInput();
  }
  return candidate;
}

async function requireAbsent(
  path: string,
  code: PersonalFilingPayloadCustodyFailureCode,
): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if (isFileSystemCode(error, "ENOENT")) return;
    fail(code);
  }
  fail(code);
}

function readOnlyNoFollowFlags(): number {
  let flags = fsConstants.O_RDONLY;
  if (
    process.platform !== "win32" &&
    typeof fsConstants.O_NOFOLLOW === "number"
  ) {
    flags |= fsConstants.O_NOFOLLOW;
  }
  if (
    process.platform !== "win32" &&
    typeof fsConstants.O_NONBLOCK === "number"
  ) {
    flags |= fsConstants.O_NONBLOCK;
  }
  return flags;
}

function writeExclusiveNoFollowFlags(): number {
  let flags = fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL;
  if (
    process.platform !== "win32" &&
    typeof fsConstants.O_NOFOLLOW === "number"
  ) {
    flags |= fsConstants.O_NOFOLLOW;
  }
  return flags;
}

function currentInstant(
  runtime: PersonalFilingPayloadCustodyTestRuntime,
): string {
  try {
    if (
      typeof runtime !== "object" ||
      runtime === null ||
      typeof runtime.now !== "function"
    ) {
      failInvalidInput();
    }
    const value = runtime.now();
    if (
      typeof value !== "object" ||
      value === null ||
      Object.getPrototypeOf(value) !== Date.prototype
    ) {
      failInvalidInput();
    }
    const milliseconds = Date.prototype.getTime.call(value);
    if (!Number.isSafeInteger(milliseconds)) failInvalidInput();
    return new Date(milliseconds).toISOString();
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadCustodyFailure) {
      throw error;
    }
    failInvalidInput();
  }
}

function addDays(instant: string, days: number): string {
  const milliseconds = Date.parse(instant);
  const result = milliseconds + days * MILLISECONDS_PER_DAY;
  if (!Number.isSafeInteger(result)) failAuditRecord();
  try {
    return new Date(result).toISOString();
  } catch {
    failAuditRecord();
  }
}

function isInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_UTC.test(value)) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isSafeInteger(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}

function isLinkAssurance(
  value: unknown,
): value is PersonalFilingPayloadLinkAssurance {
  return (
    value === "kernel_final_component_nofollow_plus_observed_snapshots" ||
    value === "observed_snapshots_only"
  );
}

async function phase(
  runtime: PersonalFilingPayloadCustodyTestRuntime,
  value: PersonalFilingPayloadCustodyTestPhase,
  path?: string,
): Promise<void> {
  if (runtime.phase !== undefined) await runtime.phase(value, path);
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (!isPlainRecord(value)) failAuditRecord();
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function domainSha256(domain: string, value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(`research-cockpit:${domain}\u0000`)
    .update(canonicalJson(value))
    .digest("hex")}`;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
  code: PersonalFilingPayloadCustodyFailureCode,
): Record<string, unknown> {
  if (!isPlainRecord(value) || !exactKeys(Object.keys(value), keys)) fail(code);
  return value;
}

function exactDataDescriptors(
  value: unknown,
  keys: readonly string[],
): PropertyDescriptorMap | undefined {
  if (!isPlainRecord(value)) return undefined;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.some((key) => typeof key !== "string") ||
      !exactKeys(ownKeys as string[], keys) ||
      !exactKeys(Object.keys(descriptors), keys)
    ) {
      return undefined;
    }
    return keys.every((key) => {
      const descriptor = descriptors[key];
      return (
        descriptor !== undefined &&
        "value" in descriptor &&
        descriptor.enumerable === true
      );
    })
      ? descriptors
      : undefined;
  } catch {
    return undefined;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  if (actual.length !== expected.length) return false;
  const left = [...actual].sort();
  const right = [...expected].sort();
  return right.every((key, index) => left[index] === key);
}

function exactNames(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return exactKeys(actual, expected);
}

function sameDirectoryIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameExactIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.ctimeNs === right.ctimeNs &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.nlink === right.nlink &&
    left.size === right.size
  );
}

function samePath(left: string, right: string): boolean {
  const resolvedLeft = resolve(left);
  const resolvedRight = resolve(right);
  return process.platform === "win32"
    ? resolvedLeft.toLowerCase() === resolvedRight.toLowerCase()
    : resolvedLeft === resolvedRight;
}

function isContained(parent: string, candidate: string): boolean {
  const pathFromParent = relative(resolve(parent), resolve(candidate));
  return (
    pathFromParent !== "" &&
    pathFromParent !== ".." &&
    !pathFromParent.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromParent)
  );
}

function isFileSystemCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

function publicError(error: unknown): PersonalFilingPayloadCustodyError {
  return new PersonalFilingPayloadCustodyError(
    error instanceof InternalPersonalFilingPayloadCustodyFailure
      ? error.code
      : "PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT",
  );
}

function failInvalidInput(): never {
  fail("PERSONAL_FILING_PAYLOAD_CUSTODY_INVALID_INPUT");
}

function failPayloadSet(): never {
  fail("PERSONAL_FILING_PAYLOAD_CUSTODY_PAYLOAD_SET_INVALID");
}

function failAuditRoot(): never {
  fail("PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_ROOT_INVALID");
}

function failAuditRecord(): never {
  fail("PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_RECORD_INVALID");
}

function failDeletion(): never {
  fail("PERSONAL_FILING_PAYLOAD_CUSTODY_DELETION_FAILED");
}

function fail(code: PersonalFilingPayloadCustodyFailureCode): never {
  throw new InternalPersonalFilingPayloadCustodyFailure(code);
}
