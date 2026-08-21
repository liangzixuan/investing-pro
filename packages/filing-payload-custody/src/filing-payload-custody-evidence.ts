import { createHash } from "node:crypto";

import {
  FILING_PAYLOAD_CUSTODY_ALGORITHM,
  FILING_PAYLOAD_CUSTODY_CLAIM,
  FILING_PAYLOAD_CUSTODY_FIXTURE,
  FILING_PAYLOAD_CUSTODY_LIMITS,
  FILING_PAYLOAD_CUSTODY_RETENTION_POLICY,
} from "./payload-custody";

export const FILING_PAYLOAD_CUSTODY_EVIDENCE_SCHEMA_VERSION = "1.0.0" as const;
export const FILING_PAYLOAD_CUSTODY_EVIDENCE_VERSION = 1 as const;
export const FILING_PAYLOAD_CUSTODY_EVIDENCE_WORKFLOW =
  "Filing payload custody acceptance" as const;

export const FILING_PAYLOAD_CUSTODY_EVIDENCE_CHECKS = [
  "exact_single_nonempty_synthetic_payload_and_owned_byte_snapshot",
  "closed_size_digest_retention_and_algorithm_inputs",
  "recomputed_sha256_matches_declared_content_identity",
  "exact_replay_idempotency_and_same_hash_metadata_conflict_rejection",
  "random_per_payload_aes_256_gcm_dek_and_nonce_uniqueness",
  "aad_binds_schema_content_hash_size_and_retention_identity",
  "no_plaintext_staging_and_payload_key_audit_domain_separation",
  "opaque_internal_paths_and_link_device_reparse_escape_rejection",
  "atomic_stage_commit_or_bounded_zero_visible_record",
  "failure_injection_rollback_and_orphan_cleanup",
  "read_reauthenticates_tag_metadata_and_plaintext_sha256",
  "trusted_clock_active_expiry_boundary_and_no_caller_extension",
  "read_expire_delete_serialization_and_terminal_no_resurrection",
  "logical_key_forget_decrypt_denial_and_idempotent_cleanup",
  "aggregate_value_free_audit_error_and_canary_leakage_rejection",
  "no_network_parser_database_api_web_queue_and_cycle2a_schema_check_nonclaim_source_set_artifact_preservation",
] as const;

export const FILING_PAYLOAD_CUSTODY_EVIDENCE_NOT_PROVEN = [
  "real_filing_rights_approval_counsel_identity_or_legal_validity",
  "cycle2b_external_manifest_authority_or_phaseb_admission",
  "sec_source_authenticity_or_declared_digest_provenance",
  "real_payload_presence_100_filing_completeness_or_batch_atomicity",
  "edgar_fetch_dns_tls_ssrf_rate_limits_or_malware_scanning",
  "production_kms_hsm_key_custody_rotation_attestation_or_recovery",
  "physical_media_secure_erasure_memory_zeroization_or_cryptographic_erasure",
  "backup_replica_snapshot_cache_temp_log_or_third_party_deletion",
  "legal_hold_dsar_offboarding_or_regulatory_retention_execution",
  "multi_process_cross_host_object_store_or_distributed_consistency",
  "power_loss_filesystem_durability_disaster_recovery_or_restore",
  "database_api_web_queue_or_b15_v15_composition",
  "general_xbrl_ixbrl_ten_fact_parser_or_lineage_correctness",
  "dual_parser_ground_truth_2000_assertions_or_quality_thresholds",
  "production_network_secret_tenant_load_slo_or_operational_readiness",
  "real_data_admission_or_production_use",
] as const;

export const FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS = [
  ".github/workflows/ci.yml",
  ".github/workflows/filing-parser-acceptance.yml",
  ".github/workflows/filing-payload-custody-acceptance.yml",
  "fixtures/synthetic/filing-payload-custody/v1/cases.json",
  "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
  "package.json",
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-parser/src/filing-parser-evidence.ts",
  "packages/filing-payload-custody/package.json",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-review.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-review.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence.ts",
  "packages/filing-payload-custody/src/index.ts",
  "packages/filing-payload-custody/src/payload-custody-security.test.ts",
  "packages/filing-payload-custody/src/payload-custody.test.ts",
  "packages/filing-payload-custody/src/payload-custody.ts",
  "packages/filing-payload-custody/src/run-filing-payload-custody-acceptance.ts",
  "packages/filing-payload-custody/src/run-filing-payload-custody-evidence-review.ts",
  "packages/filing-payload-custody/src/test-payload-builder.ts",
  "packages/filing-payload-custody/tsconfig.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts/verify-boundaries.ts",
  "scripts/verify-filing-payload-custody-fixtures.ts",
  "tsconfig.base.json",
] as const;

export const FILING_PAYLOAD_CUSTODY_EVIDENCE_TOOL_KEYS = [
  "git",
  "node",
  "pnpm",
] as const;

type SourcePath = (typeof FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS)[number];
type ToolKey = (typeof FILING_PAYLOAD_CUSTODY_EVIDENCE_TOOL_KEYS)[number];
type Sha256 = `sha256:${string}`;

export interface FilingPayloadCustodyEvidenceSourceHash {
  readonly path: SourcePath;
  readonly sha256: Sha256;
}

export interface FilingPayloadCustodyEvidence {
  readonly checksPassed: typeof FILING_PAYLOAD_CUSTODY_EVIDENCE_CHECKS;
  readonly claim: typeof FILING_PAYLOAD_CUSTODY_CLAIM;
  readonly completedAt: string;
  readonly evidenceVersion: typeof FILING_PAYLOAD_CUSTODY_EVIDENCE_VERSION;
  readonly fixtureManifestSha256: Sha256;
  readonly lifecycle: {
    readonly auditValueFree: true;
    readonly contentSha256: typeof FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256;
    readonly createdAt: string;
    readonly distinctCiphertextObserved: true;
    readonly earlyExpiryRejected: true;
    readonly exactReplayMatched: true;
    readonly keyUnavailableAfterExpiry: true;
    readonly payloadBytes: typeof FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength;
    readonly payloadExpiresAt: string;
    readonly plaintextCanaryAbsent: true;
    readonly postExpiryReadDenied: true;
    readonly preExpiryReadMatched: true;
    readonly sourceBindingSha256: Sha256;
    readonly terminalState: "logical_key_unavailability";
    readonly transitionedAt: string;
    readonly zeroResidue: true;
  };
  readonly notProven: typeof FILING_PAYLOAD_CUSTODY_EVIDENCE_NOT_PROVEN;
  readonly repository: string;
  readonly revision: string;
  readonly runtime: {
    readonly algorithm: typeof FILING_PAYLOAD_CUSTODY_ALGORITHM.name;
    readonly architecture: "x64";
    readonly keyBytes: typeof FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes;
    readonly maximumPayloadBytes: typeof FILING_PAYLOAD_CUSTODY_LIMITS.payloadBytes;
    readonly nonceBytes: typeof FILING_PAYLOAD_CUSTODY_ALGORITHM.nonceBytes;
    readonly operatingSystem: "linux";
    readonly retentionMilliseconds: typeof FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.payloadMilliseconds;
    readonly tagBytes: typeof FILING_PAYLOAD_CUSTODY_ALGORITHM.tagBytes;
  };
  readonly schemaVersion: typeof FILING_PAYLOAD_CUSTODY_EVIDENCE_SCHEMA_VERSION;
  readonly sourceHashes: readonly FilingPayloadCustodyEvidenceSourceHash[];
  readonly startedAt: string;
  readonly status: "passed";
  readonly synthetic: true;
  readonly tools: Readonly<Record<ToolKey, string>>;
  readonly workflow: {
    readonly event: "pull_request" | "push" | "workflow_dispatch";
    readonly job: "acceptance";
    readonly ref: string;
    readonly runAttempt: number;
    readonly runId: string;
    readonly workflowName: typeof FILING_PAYLOAD_CUSTODY_EVIDENCE_WORKFLOW;
  };
}

export type FilingPayloadCustodyEvidenceInput = FilingPayloadCustodyEvidence;

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u;
const SAFE_TEXT = /^[\x20-\x7e]{1,200}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export function createFilingPayloadCustodyEvidence(
  input: FilingPayloadCustodyEvidenceInput,
): FilingPayloadCustodyEvidence {
  return normalizeEvidence(input);
}

export function serializeCanonicalFilingPayloadCustodyEvidence(
  evidence: FilingPayloadCustodyEvidence,
): string {
  return `${canonicalJson(normalizeEvidence(evidence))}\n`;
}

export function parseCanonicalFilingPayloadCustodyEvidence(
  bytes: Uint8Array,
): FilingPayloadCustodyEvidence {
  if (
    Object.getPrototypeOf(bytes) !== Uint8Array.prototype ||
    bytes.byteLength === 0 ||
    bytes.byteLength > 1_048_576
  )
    invalid();
  let text: string;
  let value: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
    value = JSON.parse(text);
  } catch {
    return invalid();
  }
  if (`${canonicalJson(value)}\n` !== text) invalid();
  return normalizeEvidence(value);
}

export function filingPayloadCustodyEvidenceSha256(
  evidence: FilingPayloadCustodyEvidence,
): Sha256 {
  return sha256(
    new TextEncoder().encode(
      serializeCanonicalFilingPayloadCustodyEvidence(evidence),
    ),
  );
}

function normalizeEvidence(value: unknown): FilingPayloadCustodyEvidence {
  const record = exactRecord(value, [
    "checksPassed",
    "claim",
    "completedAt",
    "evidenceVersion",
    "fixtureManifestSha256",
    "lifecycle",
    "notProven",
    "repository",
    "revision",
    "runtime",
    "schemaVersion",
    "sourceHashes",
    "startedAt",
    "status",
    "synthetic",
    "tools",
    "workflow",
  ]);
  if (
    record.schemaVersion !== FILING_PAYLOAD_CUSTODY_EVIDENCE_SCHEMA_VERSION ||
    record.evidenceVersion !== FILING_PAYLOAD_CUSTODY_EVIDENCE_VERSION ||
    record.claim !== FILING_PAYLOAD_CUSTODY_CLAIM ||
    record.status !== "passed" ||
    record.synthetic !== true ||
    !exactStrings(
      record.checksPassed,
      FILING_PAYLOAD_CUSTODY_EVIDENCE_CHECKS,
    ) ||
    !exactStrings(
      record.notProven,
      FILING_PAYLOAD_CUSTODY_EVIDENCE_NOT_PROVEN,
    ) ||
    typeof record.repository !== "string" ||
    !REPOSITORY.test(record.repository) ||
    typeof record.revision !== "string" ||
    !COMMIT.test(record.revision) ||
    !isSha(record.fixtureManifestSha256) ||
    !isInstant(record.startedAt) ||
    !isInstant(record.completedAt) ||
    Date.parse(record.startedAt) > Date.parse(record.completedAt)
  )
    invalid();

  const lifecycle = exactRecord(record.lifecycle, [
    "auditValueFree",
    "contentSha256",
    "createdAt",
    "distinctCiphertextObserved",
    "earlyExpiryRejected",
    "exactReplayMatched",
    "keyUnavailableAfterExpiry",
    "payloadBytes",
    "payloadExpiresAt",
    "plaintextCanaryAbsent",
    "postExpiryReadDenied",
    "preExpiryReadMatched",
    "sourceBindingSha256",
    "terminalState",
    "transitionedAt",
    "zeroResidue",
  ]);
  if (
    lifecycle.auditValueFree !== true ||
    lifecycle.contentSha256 !== FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256 ||
    lifecycle.distinctCiphertextObserved !== true ||
    lifecycle.earlyExpiryRejected !== true ||
    lifecycle.exactReplayMatched !== true ||
    lifecycle.keyUnavailableAfterExpiry !== true ||
    lifecycle.payloadBytes !== FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength ||
    lifecycle.plaintextCanaryAbsent !== true ||
    lifecycle.postExpiryReadDenied !== true ||
    lifecycle.preExpiryReadMatched !== true ||
    lifecycle.sourceBindingSha256 !== record.fixtureManifestSha256 ||
    lifecycle.terminalState !== "logical_key_unavailability" ||
    lifecycle.zeroResidue !== true ||
    !isInstant(lifecycle.createdAt) ||
    !isInstant(lifecycle.payloadExpiresAt) ||
    !isInstant(lifecycle.transitionedAt) ||
    Date.parse(lifecycle.payloadExpiresAt) - Date.parse(lifecycle.createdAt) !==
      FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.payloadMilliseconds ||
    lifecycle.transitionedAt !== lifecycle.payloadExpiresAt
  )
    invalid();

  const runtime = exactRecord(record.runtime, [
    "algorithm",
    "architecture",
    "keyBytes",
    "maximumPayloadBytes",
    "nonceBytes",
    "operatingSystem",
    "retentionMilliseconds",
    "tagBytes",
  ]);
  if (
    runtime.algorithm !== FILING_PAYLOAD_CUSTODY_ALGORITHM.name ||
    runtime.architecture !== "x64" ||
    runtime.keyBytes !== FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes ||
    runtime.maximumPayloadBytes !==
      FILING_PAYLOAD_CUSTODY_LIMITS.payloadBytes ||
    runtime.nonceBytes !== FILING_PAYLOAD_CUSTODY_ALGORITHM.nonceBytes ||
    runtime.operatingSystem !== "linux" ||
    runtime.retentionMilliseconds !==
      FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.payloadMilliseconds ||
    runtime.tagBytes !== FILING_PAYLOAD_CUSTODY_ALGORITHM.tagBytes
  )
    invalid();

  const sourceHashes = normalizeSources(record.sourceHashes);
  const tools = exactRecord(
    record.tools,
    FILING_PAYLOAD_CUSTODY_EVIDENCE_TOOL_KEYS,
  );
  for (const key of FILING_PAYLOAD_CUSTODY_EVIDENCE_TOOL_KEYS) {
    const tool = tools[key];
    if (typeof tool !== "string" || !SAFE_TEXT.test(tool)) invalid();
  }
  const workflow = exactRecord(record.workflow, [
    "event",
    "job",
    "ref",
    "runAttempt",
    "runId",
    "workflowName",
  ]);
  if (
    !["pull_request", "push", "workflow_dispatch"].includes(
      workflow.event as string,
    ) ||
    workflow.job !== "acceptance" ||
    typeof workflow.ref !== "string" ||
    !SAFE_TEXT.test(workflow.ref) ||
    !Number.isSafeInteger(workflow.runAttempt) ||
    (workflow.runAttempt as number) < 1 ||
    typeof workflow.runId !== "string" ||
    !/^[1-9][0-9]{0,19}$/u.test(workflow.runId) ||
    workflow.workflowName !== FILING_PAYLOAD_CUSTODY_EVIDENCE_WORKFLOW
  )
    invalid();

  return deepFreeze({
    checksPassed: [...FILING_PAYLOAD_CUSTODY_EVIDENCE_CHECKS],
    claim: FILING_PAYLOAD_CUSTODY_CLAIM,
    completedAt: record.completedAt,
    evidenceVersion: FILING_PAYLOAD_CUSTODY_EVIDENCE_VERSION,
    fixtureManifestSha256: record.fixtureManifestSha256,
    lifecycle: { ...lifecycle },
    notProven: [...FILING_PAYLOAD_CUSTODY_EVIDENCE_NOT_PROVEN],
    repository: record.repository,
    revision: record.revision,
    runtime: { ...runtime },
    schemaVersion: FILING_PAYLOAD_CUSTODY_EVIDENCE_SCHEMA_VERSION,
    sourceHashes,
    startedAt: record.startedAt,
    status: "passed",
    synthetic: true,
    tools: { ...tools },
    workflow: { ...workflow },
  }) as unknown as FilingPayloadCustodyEvidence;
}

function normalizeSources(
  value: unknown,
): readonly FilingPayloadCustodyEvidenceSourceHash[] {
  if (
    !Array.isArray(value) ||
    value.length !== FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS.length
  )
    invalid();
  return Object.freeze(
    value.map((entry, index) => {
      const path = FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS[index];
      const record = exactRecord(entry, ["path", "sha256"]);
      if (path === undefined || record.path !== path || !isSha(record.sha256))
        invalid();
      return Object.freeze({ path, sha256: record.sha256 });
    }),
  );
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    Reflect.ownKeys(value).some((key) => typeof key !== "string") ||
    Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")
  )
    invalid();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) invalid();
  }
  return value as Record<string, unknown>;
}

function exactStrings(value: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((entry, index) => entry === expected[index])
  );
}

function isSha(value: unknown): value is Sha256 {
  return typeof value === "string" && SHA256.test(value);
}

function isInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_UTC.test(value) &&
    new Date(value).toISOString() === value
  );
}

function sha256(bytes: Uint8Array): Sha256 {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null) invalid();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value))
    return value;
  for (const key of Reflect.ownKeys(value))
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  return Object.freeze(value);
}

function invalid(): never {
  throw new Error("Filing payload custody evidence is invalid.");
}
