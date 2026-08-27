import {
  createHash,
  createPublicKey,
  verify as verifySignature,
  type KeyObject,
} from "node:crypto";

export const FILING_CORPUS_ADMISSION_SCHEMA_VERSION = "1.0.0" as const;
export const FILING_CORPUS_ADMISSION_COUNT = 100 as const;
export const FILING_CORPUS_ADMISSION_CLAIM =
  "fixed_rights_and_steward_approved_content_addressed_100_filing_corpus_admission" as const;

export const FILING_CORPUS_ADMISSION_CHECKS = [
  "exact_canonical_candidate_manifest_and_duplicate_key_rejection",
  "fixed_100_accession_content_hash_inventory",
  "unique_accession_content_identity_and_duplicate_weighting_rejection",
  "closed_form_cik_timestamp_taxonomy_and_amendment_metadata",
  "selection_plan_frozen_before_parser_or_adjudication_results",
  "frozen_strata_counts_and_exclusion_reason_accounting",
  "adjudication_protocol_hash_bound_before_measurement",
  "external_approval_binds_manifest_selection_protocol_purpose_and_retention_class",
  "out_of_band_authority_key_and_curator_approver_separation",
  "wrong_key_algorithm_scope_expiry_revocation_and_signature_tamper_rejection",
  "immutable_versioned_manifest_and_no_update_surface",
  "whole_manifest_atomic_accept_or_value_free_rejection",
  "no_raw_filing_approval_body_or_sensitive_metadata_in_logs_or_evidence",
  "no_network_fetch_parser_database_api_web_or_queue_execution",
  "deterministic_exact_byte_replay_and_mutation_conflict",
  "source_history_and_cycle2a_preservation",
] as const;

export const FILING_CORPUS_ADMISSION_NOT_PROVEN = [
  "legal_opinion_validity_counsel_identity_authentication_or_revocation_freshness",
  "sec_source_authenticity_or_sec_attestation",
  "raw_payload_presence_byte_hash_validation_ingestion_custody_retention_crypto_erasure_or_backup_deletion",
  "external_fetch_edgar_dns_tls_ssrf_or_rate_limits",
  "malware_scanning_or_zero_day_safety",
  "ten_fact_normalization_or_parser_correctness",
  "independently_adjudicated_ground_truth_or_2000_assertions",
  "precision_recall_quality_or_zero_silent_critical_failures",
  "dual_parser_independence_or_conflict_quarantine",
  "general_xbrl_ixbrl_taxonomy_or_plugins",
  "correction_supersession_lineage_execution",
  "production_key_kms_hsm_custody_or_rotation",
  "queue_scheduler_retry_exactly_once_or_load_slo",
  "database_api_web_composition_or_b15_v15",
  "representativeness_beyond_exact_approved_selection_plan",
  "real_data_beyond_exact_approved_manifest_or_production_admission",
] as const;

export const FILING_CORPUS_ADMISSION_FAILURE_CODES = [
  "FILING_CORPUS_INVALID_INPUT",
  "FILING_CORPUS_DOCUMENT_INVALID",
  "FILING_CORPUS_SCOPE_MISMATCH",
  "FILING_CORPUS_AUTHORITY_INVALID",
  "FILING_CORPUS_APPROVAL_INVALID",
  "FILING_CORPUS_APPROVAL_INACTIVE",
  "FILING_CORPUS_SIGNATURE_INVALID",
] as const;

export type FilingCorpusAdmissionFailureCode =
  (typeof FILING_CORPUS_ADMISSION_FAILURE_CODES)[number];

export class FilingCorpusAdmissionError extends Error {
  public constructor(public readonly code: FilingCorpusAdmissionFailureCode) {
    super("Filing corpus admission failed.");
    this.name = "FilingCorpusAdmissionError";
  }
}

export interface FilingCorpusAdmissionInput {
  readonly adjudicationProtocol: Uint8Array;
  readonly authorityKeys: Uint8Array;
  readonly candidateManifest: Uint8Array;
  /** Trusted evaluation time supplied by the composition boundary, not corpus data. */
  readonly evaluatedAt: string;
  readonly manifest: Uint8Array;
  readonly rightsApproval: Uint8Array;
  readonly selectionPlan: Uint8Array;
  readonly stewardApproval: Uint8Array;
}

export interface FilingCorpusAdmissionRecord {
  readonly adjudicationProtocolSha256: `sha256:${string}`;
  readonly authorityKeysSha256: `sha256:${string}`;
  readonly candidateManifestSha256: `sha256:${string}`;
  readonly claim: typeof FILING_CORPUS_ADMISSION_CLAIM;
  readonly corpusId: string;
  readonly corpusVersion: typeof FILING_CORPUS_ADMISSION_SCHEMA_VERSION;
  readonly evaluatedAt: string;
  readonly filingCount: typeof FILING_CORPUS_ADMISSION_COUNT;
  readonly manifestSha256: `sha256:${string}`;
  readonly rightsApprovalSha256: `sha256:${string}`;
  readonly schemaVersion: typeof FILING_CORPUS_ADMISSION_SCHEMA_VERSION;
  readonly selectionPlanSha256: `sha256:${string}`;
  readonly status: "admitted";
  readonly stewardApprovalSha256: `sha256:${string}`;
  readonly validUntil: string;
}

type ApprovalRole = "data_steward" | "rights_authority";
type FilingForm = "10-K" | "10-K/A" | "10-Q" | "10-Q/A";

interface AuthorityKey {
  readonly key: KeyObject;
  readonly keyId: string;
  readonly revokedAt: string | null;
  readonly role: ApprovalRole;
  readonly validFrom: string;
  readonly validTo: string;
}

interface SelectionPlan {
  readonly acceptanceFrom: string;
  readonly acceptanceToExclusive: string;
  readonly frozenAt: string;
  readonly strata: ReadonlyMap<string, number>;
}

interface AdjudicationProtocol {
  readonly frozenAt: string;
}

interface CandidateManifest {
  readonly corpusId: string;
  readonly corpusVersion: typeof FILING_CORPUS_ADMISSION_SCHEMA_VERSION;
  readonly frozenAt: string;
}

interface ApprovalRecord {
  readonly adjudicationProtocolSha256: string;
  readonly aiUse: "prohibited";
  readonly approvalId: string;
  readonly authorityKeysSha256: string;
  readonly candidateManifestSha256: string;
  readonly corpusId: string;
  readonly corpusVersion: typeof FILING_CORPUS_ADMISSION_SCHEMA_VERSION;
  readonly derivedUse: "quality_metrics_only";
  readonly effectiveUntil: string;
  readonly expiresAt: string;
  readonly issuedAt: string;
  readonly keyId: string;
  readonly purpose: "offline_parser_quality_evaluation_only";
  readonly redistribution: "prohibited";
  readonly retentionClass: string;
  readonly role: ApprovalRole;
  readonly selectionPlanSha256: string;
  readonly signature: string;
}

interface AdmissionInputSnapshot {
  readonly adjudicationProtocol: Uint8Array;
  readonly authorityKeys: Uint8Array;
  readonly candidateManifest: Uint8Array;
  readonly evaluatedAt: string;
  readonly manifest: Uint8Array;
  readonly rightsApproval: Uint8Array;
  readonly selectionPlan: Uint8Array;
  readonly stewardApproval: Uint8Array;
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const ACCESSION = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u;
const CIK = /^[0-9]{10}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const SAFE_ID = /^[a-z][a-z0-9._:-]{2,127}$/u;
const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const CONTENT_BYTES = /^[1-9][0-9]{0,11}$/u;
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/u;
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const RATIO = /^(?:0|1|0\.[0-9]{1,6})$/u;
const FORMS = ["10-K", "10-K/A", "10-Q", "10-Q/A"] as const;
const MEDIA_TYPES = [
  "application/xml",
  "application/zip",
  "text/html",
  "text/plain",
] as const;
const METRICS = [
  "document_success",
  "fact_precision",
  "fact_recall",
  "unit_date_tolerance",
  "silent_critical_failure",
  "quarantine_rate",
] as const;
const APPROVAL_DOMAIN = new TextEncoder().encode(
  "research-cockpit:filing-corpus-approval:v1\u0000",
);
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
const DOCUMENT_LIMITS = Object.freeze({
  adjudicationProtocol: 65_536,
  authorityKeys: 16_384,
  candidateManifest: 524_288,
  manifest: 65_536,
  rightsApproval: 16_384,
  selectionPlan: 65_536,
  stewardApproval: 16_384,
});
const MANIFEST_FILES = [
  "config/filing-corpus/v1/adjudication-protocol.json",
  "config/filing-corpus/v1/authority-keys.json",
  "config/filing-corpus/v1/candidate-manifest.json",
  "config/filing-corpus/v1/rights-approval.json",
  "config/filing-corpus/v1/selection-plan.json",
  "config/filing-corpus/v1/steward-approval.json",
] as const;

export function verifyFilingCorpusAdmission(
  input: FilingCorpusAdmissionInput,
): FilingCorpusAdmissionRecord {
  try {
    const snapshot = snapshotAdmissionInput(input);
    const evaluatedAt = parseInstant(
      snapshot.evaluatedAt,
      "FILING_CORPUS_INVALID_INPUT",
    );
    const hashes = Object.freeze({
      adjudicationProtocol: sha256(snapshot.adjudicationProtocol),
      authorityKeys: sha256(snapshot.authorityKeys),
      candidateManifest: sha256(snapshot.candidateManifest),
      manifest: sha256(snapshot.manifest),
      rightsApproval: sha256(snapshot.rightsApproval),
      selectionPlan: sha256(snapshot.selectionPlan),
      stewardApproval: sha256(snapshot.stewardApproval),
    });

    const selectionPlan = validateSelectionPlan(
      parseCanonicalDocument(
        snapshot.selectionPlan,
        DOCUMENT_LIMITS.selectionPlan,
        "FILING_CORPUS_DOCUMENT_INVALID",
      ),
    );
    const adjudicationProtocol = validateAdjudicationProtocol(
      parseCanonicalDocument(
        snapshot.adjudicationProtocol,
        DOCUMENT_LIMITS.adjudicationProtocol,
        "FILING_CORPUS_DOCUMENT_INVALID",
      ),
    );
    const candidate = validateCandidateManifest(
      parseCanonicalDocument(
        snapshot.candidateManifest,
        DOCUMENT_LIMITS.candidateManifest,
        "FILING_CORPUS_DOCUMENT_INVALID",
      ),
      selectionPlan,
      adjudicationProtocol,
      hashes.selectionPlan,
      hashes.adjudicationProtocol,
    );
    const authorityKeys = validateAuthorityKeys(
      parseCanonicalDocument(
        snapshot.authorityKeys,
        DOCUMENT_LIMITS.authorityKeys,
        "FILING_CORPUS_AUTHORITY_INVALID",
      ),
    );
    const rightsApproval = validateApproval(
      parseCanonicalDocument(
        snapshot.rightsApproval,
        DOCUMENT_LIMITS.rightsApproval,
        "FILING_CORPUS_APPROVAL_INVALID",
      ),
      "rights_authority",
      authorityKeys,
      evaluatedAt,
      candidate,
      hashes,
    );
    const stewardApproval = validateApproval(
      parseCanonicalDocument(
        snapshot.stewardApproval,
        DOCUMENT_LIMITS.stewardApproval,
        "FILING_CORPUS_APPROVAL_INVALID",
      ),
      "data_steward",
      authorityKeys,
      evaluatedAt,
      candidate,
      hashes,
    );
    validateApprovalSeparation(rightsApproval, stewardApproval);
    validateAdmissionManifest(
      parseCanonicalDocument(
        snapshot.manifest,
        DOCUMENT_LIMITS.manifest,
        "FILING_CORPUS_DOCUMENT_INVALID",
      ),
      candidate,
      hashes,
    );

    return Object.freeze({
      adjudicationProtocolSha256: hashes.adjudicationProtocol,
      authorityKeysSha256: hashes.authorityKeys,
      candidateManifestSha256: hashes.candidateManifest,
      claim: FILING_CORPUS_ADMISSION_CLAIM,
      corpusId: candidate.corpusId,
      corpusVersion: candidate.corpusVersion,
      evaluatedAt: snapshot.evaluatedAt,
      filingCount: FILING_CORPUS_ADMISSION_COUNT,
      manifestSha256: hashes.manifest,
      rightsApprovalSha256: hashes.rightsApproval,
      schemaVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
      selectionPlanSha256: hashes.selectionPlan,
      status: "admitted",
      stewardApprovalSha256: hashes.stewardApproval,
      validUntil:
        rightsApproval.effectiveUntil < stewardApproval.effectiveUntil
          ? rightsApproval.effectiveUntil
          : stewardApproval.effectiveUntil,
    });
  } catch (error) {
    if (error instanceof FilingCorpusAdmissionError) throw error;
    throw new FilingCorpusAdmissionError("FILING_CORPUS_DOCUMENT_INVALID");
  }
}

function snapshotAdmissionInput(value: unknown): AdmissionInputSnapshot {
  if (
    !isExactDataObject(value, [
      "adjudicationProtocol",
      "authorityKeys",
      "candidateManifest",
      "evaluatedAt",
      "manifest",
      "rightsApproval",
      "selectionPlan",
      "stewardApproval",
    ])
  ) {
    fail("FILING_CORPUS_INVALID_INPUT");
  }
  const record = value as Record<string, unknown>;
  const evaluatedAt = record.evaluatedAt;
  if (typeof evaluatedAt !== "string") fail("FILING_CORPUS_INVALID_INPUT");
  return Object.freeze({
    adjudicationProtocol: byteSnapshot(
      record.adjudicationProtocol,
      DOCUMENT_LIMITS.adjudicationProtocol,
      "FILING_CORPUS_DOCUMENT_INVALID",
    ),
    authorityKeys: byteSnapshot(
      record.authorityKeys,
      DOCUMENT_LIMITS.authorityKeys,
      "FILING_CORPUS_AUTHORITY_INVALID",
    ),
    candidateManifest: byteSnapshot(
      record.candidateManifest,
      DOCUMENT_LIMITS.candidateManifest,
      "FILING_CORPUS_DOCUMENT_INVALID",
    ),
    evaluatedAt,
    manifest: byteSnapshot(
      record.manifest,
      DOCUMENT_LIMITS.manifest,
      "FILING_CORPUS_DOCUMENT_INVALID",
    ),
    rightsApproval: byteSnapshot(
      record.rightsApproval,
      DOCUMENT_LIMITS.rightsApproval,
      "FILING_CORPUS_APPROVAL_INVALID",
    ),
    selectionPlan: byteSnapshot(
      record.selectionPlan,
      DOCUMENT_LIMITS.selectionPlan,
      "FILING_CORPUS_DOCUMENT_INVALID",
    ),
    stewardApproval: byteSnapshot(
      record.stewardApproval,
      DOCUMENT_LIMITS.stewardApproval,
      "FILING_CORPUS_APPROVAL_INVALID",
    ),
  });
}

function byteSnapshot(
  value: unknown,
  maximumBytes: number,
  oversizeCode: FilingCorpusAdmissionFailureCode,
): Uint8Array {
  try {
    if (typeof value !== "object" || value === null)
      fail("FILING_CORPUS_INVALID_INPUT");
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
      Object.getPrototypeOf(bytes) !== Uint8Array.prototype ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    ) {
      fail("FILING_CORPUS_INVALID_INPUT");
    }
    if (byteLength > maximumBytes) {
      fail(oversizeCode);
    }
    const snapshot = new Uint8Array(byteLength);
    Uint8Array.prototype.set.call(snapshot, bytes);
    return snapshot;
  } catch (error) {
    if (error instanceof FilingCorpusAdmissionError) throw error;
    fail("FILING_CORPUS_INVALID_INPUT");
  }
}

function validateAuthorityKeys(
  value: unknown,
): ReadonlyMap<ApprovalRole, AuthorityKey> {
  const code = "FILING_CORPUS_AUTHORITY_INVALID" as const;
  const record = exactRecord(value, ["keys", "schemaVersion"], code);
  if (
    record.schemaVersion !== FILING_CORPUS_ADMISSION_SCHEMA_VERSION ||
    !Array.isArray(record.keys) ||
    record.keys.length !== 2
  ) {
    fail(code);
  }
  const authorities = new Map<ApprovalRole, AuthorityKey>();
  const keyIds = new Set<string>();
  const publicKeys = new Set<string>();
  for (const rawKey of record.keys) {
    const key = exactRecord(
      rawKey,
      [
        "algorithm",
        "keyId",
        "publicKeySpki",
        "revokedAt",
        "role",
        "validFrom",
        "validTo",
      ],
      code,
    );
    if (
      key.algorithm !== "ed25519" ||
      typeof key.keyId !== "string" ||
      !KEY_ID.test(key.keyId) ||
      (key.role !== "rights_authority" && key.role !== "data_steward") ||
      typeof key.publicKeySpki !== "string" ||
      !isCanonicalBase64(key.publicKeySpki) ||
      (key.revokedAt !== null && typeof key.revokedAt !== "string") ||
      typeof key.validFrom !== "string" ||
      typeof key.validTo !== "string"
    ) {
      fail(code);
    }
    const validFrom = parseInstant(key.validFrom, code);
    const validTo = parseInstant(key.validTo, code);
    const revokedAt =
      key.revokedAt === null ? null : parseInstant(key.revokedAt, code);
    if (
      validFrom >= validTo ||
      (revokedAt !== null && (revokedAt < validFrom || revokedAt > validTo)) ||
      authorities.has(key.role) ||
      keyIds.has(key.keyId) ||
      publicKeys.has(key.publicKeySpki)
    ) {
      fail(code);
    }
    const publicKey = importEd25519PublicKey(key.publicKeySpki);
    authorities.set(
      key.role,
      Object.freeze({
        key: publicKey,
        keyId: key.keyId,
        revokedAt: key.revokedAt,
        role: key.role,
        validFrom: key.validFrom,
        validTo: key.validTo,
      }),
    );
    keyIds.add(key.keyId);
    publicKeys.add(key.publicKeySpki);
  }
  return authorities;
}

function importEd25519PublicKey(encoded: string): KeyObject {
  try {
    const bytes = Buffer.from(encoded, "base64");
    const key = createPublicKey({ key: bytes, format: "der", type: "spki" });
    const exported = key.export({ format: "der", type: "spki" });
    if (
      key.asymmetricKeyType !== "ed25519" ||
      !Buffer.from(exported).equals(bytes)
    ) {
      fail("FILING_CORPUS_AUTHORITY_INVALID");
    }
    return key;
  } catch (error) {
    if (error instanceof FilingCorpusAdmissionError) throw error;
    fail("FILING_CORPUS_AUTHORITY_INVALID");
  }
}

function validateSelectionPlan(value: unknown): SelectionPlan {
  const code = "FILING_CORPUS_DOCUMENT_INVALID" as const;
  const record = exactRecord(
    value,
    [
      "acceptanceWindow",
      "candidateUniverseCount",
      "candidateUniverseSha256",
      "eligibleForms",
      "exclusions",
      "frozenAt",
      "planId",
      "planVersion",
      "schemaVersion",
      "selectionMethod",
      "selectionSeedSha256",
      "strata",
      "targetCount",
    ],
    code,
  );
  const window = exactRecord(
    record.acceptanceWindow,
    ["from", "toExclusive"],
    code,
  );
  if (
    record.schemaVersion !== FILING_CORPUS_ADMISSION_SCHEMA_VERSION ||
    record.planVersion !== FILING_CORPUS_ADMISSION_SCHEMA_VERSION ||
    typeof record.planId !== "string" ||
    !SAFE_ID.test(record.planId) ||
    record.selectionMethod !== "predeclared_stratified_content_hash_v1" ||
    record.targetCount !== FILING_CORPUS_ADMISSION_COUNT ||
    !Number.isInteger(record.candidateUniverseCount) ||
    (record.candidateUniverseCount as number) < FILING_CORPUS_ADMISSION_COUNT ||
    (record.candidateUniverseCount as number) > 1_000_000 ||
    typeof record.candidateUniverseSha256 !== "string" ||
    !HASH.test(record.candidateUniverseSha256) ||
    typeof record.selectionSeedSha256 !== "string" ||
    !HASH.test(record.selectionSeedSha256) ||
    !exactStringArray(record.eligibleForms, FORMS) ||
    !Array.isArray(record.exclusions) ||
    record.exclusions.length > 64 ||
    typeof record.frozenAt !== "string" ||
    typeof window.from !== "string" ||
    typeof window.toExclusive !== "string" ||
    !Array.isArray(record.strata) ||
    record.strata.length < 1 ||
    record.strata.length > FILING_CORPUS_ADMISSION_COUNT
  ) {
    fail(code);
  }
  const frozenAt = parseInstant(record.frozenAt, code);
  const acceptanceFrom = parseInstant(window.from, code);
  const acceptanceToExclusive = parseInstant(window.toExclusive, code);
  if (acceptanceFrom >= acceptanceToExclusive || frozenAt < acceptanceFrom)
    fail(code);
  const strata = new Map<string, number>();
  let total = 0;
  let previousId = "";
  for (const rawStratum of record.strata) {
    const stratum = exactRecord(rawStratum, ["id", "targetCount"], code);
    if (
      typeof stratum.id !== "string" ||
      !SAFE_ID.test(stratum.id) ||
      stratum.id <= previousId ||
      !Number.isInteger(stratum.targetCount) ||
      (stratum.targetCount as number) < 1 ||
      (stratum.targetCount as number) > FILING_CORPUS_ADMISSION_COUNT
    ) {
      fail(code);
    }
    strata.set(stratum.id, stratum.targetCount as number);
    total += stratum.targetCount as number;
    previousId = stratum.id;
  }
  if (total !== FILING_CORPUS_ADMISSION_COUNT) fail(code);
  let excluded = 0;
  let previousReasonCode = "";
  for (const rawExclusion of record.exclusions) {
    const exclusion = exactRecord(rawExclusion, ["count", "reasonCode"], code);
    if (
      typeof exclusion.reasonCode !== "string" ||
      !SAFE_ID.test(exclusion.reasonCode) ||
      exclusion.reasonCode <= previousReasonCode ||
      !Number.isInteger(exclusion.count) ||
      (exclusion.count as number) < 1 ||
      (exclusion.count as number) > 1_000_000
    ) {
      fail(code);
    }
    excluded += exclusion.count as number;
    if (excluded > 1_000_000) fail(code);
    previousReasonCode = exclusion.reasonCode;
  }
  if (
    FILING_CORPUS_ADMISSION_COUNT + excluded !==
    record.candidateUniverseCount
  ) {
    fail(code);
  }
  return Object.freeze({
    acceptanceFrom: window.from,
    acceptanceToExclusive: window.toExclusive,
    frozenAt: record.frozenAt,
    strata,
  });
}

function validateAdjudicationProtocol(value: unknown): AdjudicationProtocol {
  const code = "FILING_CORPUS_DOCUMENT_INVALID" as const;
  const record = exactRecord(
    value,
    [
      "assertionTarget",
      "blindedToParserResults",
      "factKeys",
      "frozenAt",
      "independentAdjudicators",
      "metrics",
      "protocolId",
      "protocolVersion",
      "resolution",
      "schemaVersion",
      "thresholds",
    ],
    code,
  );
  const thresholds = exactRecord(
    record.thresholds,
    [
      "dateToleranceDays",
      "documentSuccessMinimum",
      "factPrecisionMinimum",
      "factRecallMinimum",
      "maximumQuarantineRate",
      "maximumSilentCriticalFailures",
      "unitTolerancePolicy",
    ],
    code,
  );
  if (
    record.schemaVersion !== FILING_CORPUS_ADMISSION_SCHEMA_VERSION ||
    record.protocolVersion !== FILING_CORPUS_ADMISSION_SCHEMA_VERSION ||
    typeof record.protocolId !== "string" ||
    !SAFE_ID.test(record.protocolId) ||
    record.assertionTarget !== 2_000 ||
    record.independentAdjudicators !== 2 ||
    record.blindedToParserResults !== true ||
    record.resolution !== "independent_then_blinded_resolution" ||
    !exactStringArray(record.metrics, METRICS) ||
    !isSortedUniqueSafeIds(record.factKeys, 10, 10) ||
    typeof record.frozenAt !== "string" ||
    !Number.isInteger(thresholds.dateToleranceDays) ||
    (thresholds.dateToleranceDays as number) < 0 ||
    (thresholds.dateToleranceDays as number) > 366 ||
    typeof thresholds.documentSuccessMinimum !== "string" ||
    !RATIO.test(thresholds.documentSuccessMinimum) ||
    typeof thresholds.factPrecisionMinimum !== "string" ||
    !RATIO.test(thresholds.factPrecisionMinimum) ||
    typeof thresholds.factRecallMinimum !== "string" ||
    !RATIO.test(thresholds.factRecallMinimum) ||
    typeof thresholds.maximumQuarantineRate !== "string" ||
    !RATIO.test(thresholds.maximumQuarantineRate) ||
    thresholds.maximumSilentCriticalFailures !== 0 ||
    typeof thresholds.unitTolerancePolicy !== "string" ||
    !SAFE_ID.test(thresholds.unitTolerancePolicy)
  ) {
    fail(code);
  }
  parseInstant(record.frozenAt, code);
  return Object.freeze({ frozenAt: record.frozenAt });
}

function validateCandidateManifest(
  value: unknown,
  selectionPlan: SelectionPlan,
  adjudicationProtocol: AdjudicationProtocol,
  selectionPlanSha256: string,
  adjudicationProtocolSha256: string,
): CandidateManifest {
  const code = "FILING_CORPUS_DOCUMENT_INVALID" as const;
  const record = exactRecord(
    value,
    [
      "adjudicationProtocolSha256",
      "corpusId",
      "corpusVersion",
      "entries",
      "frozenAt",
      "schemaVersion",
      "selectionPlanSha256",
    ],
    code,
  );
  if (
    record.schemaVersion !== FILING_CORPUS_ADMISSION_SCHEMA_VERSION ||
    record.corpusVersion !== FILING_CORPUS_ADMISSION_SCHEMA_VERSION ||
    typeof record.corpusId !== "string" ||
    !SAFE_ID.test(record.corpusId) ||
    record.selectionPlanSha256 !== selectionPlanSha256 ||
    record.adjudicationProtocolSha256 !== adjudicationProtocolSha256 ||
    typeof record.frozenAt !== "string" ||
    !Array.isArray(record.entries) ||
    record.entries.length !== FILING_CORPUS_ADMISSION_COUNT
  ) {
    fail(
      record.selectionPlanSha256 !== selectionPlanSha256 ||
        record.adjudicationProtocolSha256 !== adjudicationProtocolSha256
        ? "FILING_CORPUS_SCOPE_MISMATCH"
        : code,
    );
  }
  const frozenAt = parseInstant(record.frozenAt, code);
  if (
    frozenAt < parseInstant(selectionPlan.frozenAt, code) ||
    frozenAt < parseInstant(adjudicationProtocol.frozenAt, code)
  ) {
    fail(code);
  }
  const accessions = new Set<string>();
  const contentHashes = new Set<string>();
  const entries = new Map<
    string,
    {
      acceptedAt: string;
      availableAt: string;
      cik: string;
      form: FilingForm;
      amendmentOf: string | null;
    }
  >();
  const stratumCounts = new Map<string, number>();
  let previousAccession = "";
  for (const rawEntry of record.entries) {
    const entry = exactRecord(
      rawEntry,
      [
        "accession",
        "acceptedAt",
        "amendmentOf",
        "availableAt",
        "cik",
        "contentBytes",
        "contentSha256",
        "form",
        "mediaType",
        "selectionStratumId",
        "taxonomyFamily",
        "taxonomyVersion",
      ],
      code,
    );
    if (
      typeof entry.accession !== "string" ||
      !ACCESSION.test(entry.accession) ||
      entry.accession <= previousAccession ||
      typeof entry.cik !== "string" ||
      !CIK.test(entry.cik) ||
      entry.accession.slice(0, 10) !== entry.cik ||
      !isFilingForm(entry.form) ||
      typeof entry.acceptedAt !== "string" ||
      typeof entry.availableAt !== "string" ||
      typeof entry.contentBytes !== "string" ||
      !CONTENT_BYTES.test(entry.contentBytes) ||
      typeof entry.contentSha256 !== "string" ||
      !HASH.test(entry.contentSha256) ||
      !MEDIA_TYPES.includes(entry.mediaType as (typeof MEDIA_TYPES)[number]) ||
      typeof entry.selectionStratumId !== "string" ||
      !selectionPlan.strata.has(entry.selectionStratumId) ||
      typeof entry.taxonomyFamily !== "string" ||
      !SAFE_TOKEN.test(entry.taxonomyFamily) ||
      typeof entry.taxonomyVersion !== "string" ||
      !SAFE_TOKEN.test(entry.taxonomyVersion) ||
      (entry.amendmentOf !== null &&
        (typeof entry.amendmentOf !== "string" ||
          !ACCESSION.test(entry.amendmentOf))) ||
      accessions.has(entry.accession) ||
      contentHashes.has(entry.contentSha256)
    ) {
      fail(code);
    }
    const acceptedAt = parseInstant(entry.acceptedAt, code);
    const availableAt = parseInstant(entry.availableAt, code);
    if (
      acceptedAt > availableAt ||
      acceptedAt < parseInstant(selectionPlan.acceptanceFrom, code) ||
      acceptedAt >= parseInstant(selectionPlan.acceptanceToExclusive, code) ||
      availableAt > frozenAt ||
      entry.form.endsWith("/A") !== (entry.amendmentOf !== null)
    ) {
      fail(code);
    }
    accessions.add(entry.accession);
    contentHashes.add(entry.contentSha256);
    entries.set(entry.accession, {
      acceptedAt: entry.acceptedAt,
      amendmentOf: entry.amendmentOf,
      availableAt: entry.availableAt,
      cik: entry.cik,
      form: entry.form,
    });
    stratumCounts.set(
      entry.selectionStratumId,
      (stratumCounts.get(entry.selectionStratumId) ?? 0) + 1,
    );
    previousAccession = entry.accession;
  }
  for (const [id, targetCount] of selectionPlan.strata) {
    if (stratumCounts.get(id) !== targetCount) fail(code);
  }
  for (const entry of entries.values()) {
    if (entry.amendmentOf === null) continue;
    const base = entries.get(entry.amendmentOf);
    if (
      base === undefined ||
      base.cik !== entry.cik ||
      `${base.form}/A` !== entry.form ||
      parseInstant(base.acceptedAt, code) >=
        parseInstant(entry.acceptedAt, code) ||
      parseInstant(base.availableAt, code) >
        parseInstant(entry.availableAt, code)
    ) {
      fail(code);
    }
  }
  return Object.freeze({
    corpusId: record.corpusId,
    corpusVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
    frozenAt: record.frozenAt,
  });
}

function validateApproval(
  value: unknown,
  expectedRole: ApprovalRole,
  authorities: ReadonlyMap<ApprovalRole, AuthorityKey>,
  evaluatedAt: number,
  candidate: CandidateManifest,
  hashes: Readonly<{
    adjudicationProtocol: string;
    authorityKeys: string;
    candidateManifest: string;
    selectionPlan: string;
  }>,
): ApprovalRecord {
  const code = "FILING_CORPUS_APPROVAL_INVALID" as const;
  const record = exactRecord(
    value,
    [
      "adjudicationProtocolSha256",
      "aiUse",
      "algorithm",
      "approvalId",
      "approvalVersion",
      "authorityKeysSha256",
      "candidateManifestSha256",
      "corpusId",
      "corpusVersion",
      "derivedUse",
      "expiresAt",
      "issuedAt",
      "keyId",
      "purpose",
      "redistribution",
      "retentionClass",
      "role",
      "schemaVersion",
      "selectionPlanSha256",
      "signature",
    ],
    code,
  );
  if (
    record.schemaVersion !== FILING_CORPUS_ADMISSION_SCHEMA_VERSION ||
    record.approvalVersion !== FILING_CORPUS_ADMISSION_SCHEMA_VERSION ||
    record.algorithm !== "ed25519" ||
    record.role !== expectedRole ||
    typeof record.approvalId !== "string" ||
    !SAFE_ID.test(record.approvalId) ||
    typeof record.keyId !== "string" ||
    !KEY_ID.test(record.keyId) ||
    record.purpose !== "offline_parser_quality_evaluation_only" ||
    record.derivedUse !== "quality_metrics_only" ||
    record.aiUse !== "prohibited" ||
    record.redistribution !== "prohibited" ||
    typeof record.retentionClass !== "string" ||
    !SAFE_ID.test(record.retentionClass) ||
    record.corpusId !== candidate.corpusId ||
    record.corpusVersion !== candidate.corpusVersion ||
    record.candidateManifestSha256 !== hashes.candidateManifest ||
    record.selectionPlanSha256 !== hashes.selectionPlan ||
    record.adjudicationProtocolSha256 !== hashes.adjudicationProtocol ||
    record.authorityKeysSha256 !== hashes.authorityKeys ||
    typeof record.issuedAt !== "string" ||
    typeof record.expiresAt !== "string" ||
    typeof record.signature !== "string" ||
    !isCanonicalSignature(record.signature)
  ) {
    fail(
      record.corpusId !== candidate.corpusId ||
        record.corpusVersion !== candidate.corpusVersion ||
        record.candidateManifestSha256 !== hashes.candidateManifest ||
        record.selectionPlanSha256 !== hashes.selectionPlan ||
        record.adjudicationProtocolSha256 !== hashes.adjudicationProtocol ||
        record.authorityKeysSha256 !== hashes.authorityKeys
        ? "FILING_CORPUS_SCOPE_MISMATCH"
        : code,
    );
  }
  const issuedAt = parseInstant(record.issuedAt, code);
  const expiresAt = parseInstant(record.expiresAt, code);
  const authority = authorities.get(expectedRole);
  if (authority === undefined || authority.keyId !== record.keyId)
    fail("FILING_CORPUS_AUTHORITY_INVALID");
  const keyValidFrom = parseInstant(
    authority.validFrom,
    "FILING_CORPUS_AUTHORITY_INVALID",
  );
  const keyValidTo = parseInstant(
    authority.validTo,
    "FILING_CORPUS_AUTHORITY_INVALID",
  );
  const revokedAt =
    authority.revokedAt === null
      ? null
      : parseInstant(authority.revokedAt, "FILING_CORPUS_AUTHORITY_INVALID");
  if (
    issuedAt < parseInstant(candidate.frozenAt, code) ||
    issuedAt < keyValidFrom ||
    issuedAt >= keyValidTo ||
    expiresAt <= issuedAt ||
    expiresAt > keyValidTo ||
    evaluatedAt < issuedAt ||
    evaluatedAt >= expiresAt ||
    evaluatedAt < keyValidFrom ||
    evaluatedAt >= keyValidTo ||
    (revokedAt !== null && evaluatedAt >= revokedAt)
  ) {
    fail("FILING_CORPUS_APPROVAL_INACTIVE");
  }
  const unsigned = { ...record };
  delete unsigned.signature;
  const payload = concatBytes(
    APPROVAL_DOMAIN,
    new TextEncoder().encode(canonicalJson(unsigned)),
  );
  const valid = isValidApprovalSignature(
    payload,
    authority.key,
    record.signature,
  );
  if (!valid) fail("FILING_CORPUS_SIGNATURE_INVALID");
  let effectiveUntil = record.expiresAt;
  if (
    authority.revokedAt !== null &&
    revokedAt !== null &&
    revokedAt < expiresAt
  ) {
    effectiveUntil = authority.revokedAt;
  }
  return Object.freeze({
    adjudicationProtocolSha256: record.adjudicationProtocolSha256,
    aiUse: "prohibited",
    approvalId: record.approvalId,
    authorityKeysSha256: record.authorityKeysSha256,
    candidateManifestSha256: record.candidateManifestSha256,
    corpusId: record.corpusId,
    corpusVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
    derivedUse: "quality_metrics_only",
    effectiveUntil,
    expiresAt: record.expiresAt,
    issuedAt: record.issuedAt,
    keyId: record.keyId,
    purpose: "offline_parser_quality_evaluation_only",
    redistribution: "prohibited",
    retentionClass: record.retentionClass,
    role: expectedRole,
    selectionPlanSha256: record.selectionPlanSha256,
    signature: record.signature,
  });
}

function validateApprovalSeparation(
  rights: ApprovalRecord,
  steward: ApprovalRecord,
): void {
  if (
    rights.keyId === steward.keyId ||
    rights.approvalId === steward.approvalId ||
    rights.retentionClass !== steward.retentionClass ||
    rights.corpusId !== steward.corpusId ||
    rights.corpusVersion !== steward.corpusVersion ||
    rights.candidateManifestSha256 !== steward.candidateManifestSha256 ||
    rights.selectionPlanSha256 !== steward.selectionPlanSha256 ||
    rights.adjudicationProtocolSha256 !== steward.adjudicationProtocolSha256 ||
    rights.authorityKeysSha256 !== steward.authorityKeysSha256 ||
    rights.purpose !== steward.purpose ||
    rights.derivedUse !== steward.derivedUse ||
    rights.aiUse !== steward.aiUse ||
    rights.redistribution !== steward.redistribution
  ) {
    fail("FILING_CORPUS_SCOPE_MISMATCH");
  }
}

function validateAdmissionManifest(
  value: unknown,
  candidate: CandidateManifest,
  hashes: Readonly<{
    adjudicationProtocol: string;
    authorityKeys: string;
    candidateManifest: string;
    rightsApproval: string;
    selectionPlan: string;
    stewardApproval: string;
  }>,
): void {
  const code = "FILING_CORPUS_DOCUMENT_INVALID" as const;
  const record = exactRecord(
    value,
    [
      "checks",
      "claim",
      "corpusId",
      "corpusVersion",
      "files",
      "filingCount",
      "nonclaims",
      "schemaVersion",
    ],
    code,
  );
  if (
    record.schemaVersion !== FILING_CORPUS_ADMISSION_SCHEMA_VERSION ||
    record.claim !== FILING_CORPUS_ADMISSION_CLAIM ||
    record.corpusId !== candidate.corpusId ||
    record.corpusVersion !== candidate.corpusVersion ||
    record.filingCount !== FILING_CORPUS_ADMISSION_COUNT ||
    !exactStringArray(record.checks, FILING_CORPUS_ADMISSION_CHECKS) ||
    !exactStringArray(record.nonclaims, FILING_CORPUS_ADMISSION_NOT_PROVEN) ||
    !Array.isArray(record.files) ||
    record.files.length !== MANIFEST_FILES.length
  ) {
    fail(code);
  }
  const expectedHashes = [
    hashes.adjudicationProtocol,
    hashes.authorityKeys,
    hashes.candidateManifest,
    hashes.rightsApproval,
    hashes.selectionPlan,
    hashes.stewardApproval,
  ];
  for (let index = 0; index < MANIFEST_FILES.length; index += 1) {
    const file = exactRecord(record.files[index], ["path", "sha256"], code);
    if (
      file.path !== MANIFEST_FILES[index] ||
      file.sha256 !== expectedHashes[index]
    ) {
      fail("FILING_CORPUS_SCOPE_MISMATCH");
    }
  }
}

function parseCanonicalDocument(
  bytes: Uint8Array,
  maximumBytes: number,
  code: FilingCorpusAdmissionFailureCode,
): unknown {
  if (bytes.byteLength < 3 || bytes.byteLength > maximumBytes) fail(code);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    fail(code);
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    fail(code);
  }
  try {
    assertJsonBudget(value, code);
    if (`${canonicalJson(value)}\n` !== text) fail(code);
  } catch (error) {
    if (error instanceof FilingCorpusAdmissionError) throw error;
    fail(code);
  }
  return value;
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (!isPlainRecord(value)) throw new TypeError();
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
  code: FilingCorpusAdmissionFailureCode,
): Record<string, unknown> {
  if (!isPlainRecord(value) || !exactKeys(Object.keys(value), keys)) fail(code);
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isExactDataObject(value: unknown, keys: readonly string[]): boolean {
  if (!isPlainRecord(value)) return false;
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return false;
  }
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.some((key) => typeof key !== "string") ||
    !exactKeys(ownKeys as string[], keys) ||
    !exactKeys(Object.keys(descriptors), keys)
  ) {
    return false;
  }
  return keys.every((key) => {
    const descriptor = descriptors[key];
    return (
      descriptor !== undefined &&
      "value" in descriptor &&
      descriptor.enumerable === true
    );
  });
}

function exactKeys(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  if (actual.length !== expected.length) return false;
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedExpected.every((key, index) => sortedActual[index] === key);
}

function exactStringArray(
  value: unknown,
  expected: readonly string[],
): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    expected.every((item, index) => value[index] === item)
  );
}

function isSortedUniqueSafeIds(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum)
    return false;
  let previous = "";
  for (const item of value) {
    if (typeof item !== "string" || !SAFE_ID.test(item) || item <= previous)
      return false;
    previous = item;
  }
  return true;
}

function isFilingForm(value: unknown): value is FilingForm {
  return FORMS.includes(value as FilingForm);
}

function isCanonicalBase64(value: string): boolean {
  if (value.length < 40 || value.length > 512 || !BASE64.test(value))
    return false;
  try {
    return Buffer.from(value, "base64").toString("base64") === value;
  } catch {
    return false;
  }
}

function isCanonicalSignature(value: string): boolean {
  if (!SIGNATURE.test(value)) return false;
  try {
    const bytes = Buffer.from(value, "base64url");
    return bytes.byteLength === 64 && bytes.toString("base64url") === value;
  } catch {
    return false;
  }
}

function isValidApprovalSignature(
  payload: Uint8Array,
  key: KeyObject,
  signature: string,
): boolean {
  try {
    return verifySignature(
      null,
      payload,
      key,
      Buffer.from(signature, "base64url"),
    );
  } catch {
    return false;
  }
}

function assertJsonBudget(
  root: unknown,
  code: FilingCorpusAdmissionFailureCode,
): void {
  const stack: Array<{ depth: number; value: unknown }> = [
    { depth: 0, value: root },
  ];
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) fail(code);
    nodes += 1;
    if (nodes > 20_000 || current.depth > 32) fail(code);
    if (
      current.value === null ||
      typeof current.value === "string" ||
      typeof current.value === "boolean" ||
      (typeof current.value === "number" && Number.isSafeInteger(current.value))
    ) {
      continue;
    }
    if (Array.isArray(current.value)) {
      for (const value of current.value)
        stack.push({ depth: current.depth + 1, value });
      continue;
    }
    if (!isPlainRecord(current.value)) fail(code);
    for (const value of Object.values(current.value))
      stack.push({ depth: current.depth + 1, value });
  }
}

function parseInstant(
  value: string,
  code: FilingCorpusAdmissionFailureCode,
): number {
  if (!ISO_UTC.test(value)) fail(code);
  const instant = Date.parse(value);
  if (!Number.isFinite(instant) || new Date(instant).toISOString() !== value)
    fail(code);
  return instant;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(first.byteLength + second.byteLength);
  bytes.set(first, 0);
  bytes.set(second, first.byteLength);
  return bytes;
}

function fail(code: FilingCorpusAdmissionFailureCode): never {
  throw new FilingCorpusAdmissionError(code);
}
