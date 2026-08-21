import { createHash } from "node:crypto";

import { validateDeclaredValidatorAEnvelope } from "./declared-validator-a";
import { validateDeclaredValidatorBEnvelope } from "./declared-validator-b";

export const FILING_FACT_COMPARISON_SCHEMA_VERSION = "1.0.0" as const;
export const FILING_FACT_COMPARISON_CLAIM =
  "bounded_synthetic_two_declared_validator_exact_payload_agreement_conflict_quarantine_and_no_silent_repair" as const;

export const FILING_FACT_COMPARISON_FACT_KEYS = Object.freeze([
  "assets",
  "cash",
  "debt",
  "diluted_shares",
  "free_cash_flow",
  "gross_profit",
  "net_income",
  "operating_cash_flow",
  "operating_income",
  "revenue",
] as const);

export type FilingFactComparisonDeclaredValidatorRole =
  "declared-validator-a" | "declared-validator-b";

export interface FilingFactComparisonDeclaredValidatorBinding {
  readonly implementationSha256: `sha256:${string}`;
  readonly role: FilingFactComparisonDeclaredValidatorRole;
  readonly validatorId: string;
  readonly validatorVersion: "1.0.0";
}

export const FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS: readonly FilingFactComparisonDeclaredValidatorBinding[] =
  Object.freeze([
    Object.freeze({
      implementationSha256:
        "sha256:144c62df219b6f6cddfa49783fd9f9e169187d39d3fc848c8bb06147df76fa44",
      role: "declared-validator-a",
      validatorId: "synthetic-filing-fact-validator-a",
      validatorVersion: "1.0.0",
    }),
    Object.freeze({
      implementationSha256:
        "sha256:8ae5aae1ecc92b3b71e764deb85d6758e38b1b11eee39f6aed07599bb30ae365",
      role: "declared-validator-b",
      validatorId: "synthetic-filing-fact-validator-b",
      validatorVersion: "1.0.0",
    }),
  ]);

export const FILING_FACT_COMPARISON_CHECKS = Object.freeze([
  "exact_two_declared_validator_same_schema_synthetic_envelopes",
  "owned_bounded_utf8_canonical_json_byte_snapshots_and_duplicate_key_rejection",
  "exact_distinct_declared_validator_identity_version_and_implementation_digest_bindings",
  "separate_no_shared_runtime_validator_implementations_and_fixed_argument_roles",
  "each_envelope_closed_schema_validation_precedes_agreement",
  "closed_original_amendment_entity_instrument_accession_hash_form_and_chronology_binding",
  "exact_ten_keys_twenty_versions_and_ten_one_to_one_lineage_edges_per_validator",
  "strict_decimal_unit_period_dimension_concept_parser_taxonomy_and_source_metadata_contract",
  "complete_source_preimage_fact_identity_recomputation_uniqueness_and_pointer_consistency",
  "acyclic_single_predecessor_changed_unchanged_and_half_open_known_window_validation",
  "byte_exact_full_normalized_payload_agreement_not_digest_or_subset_equality",
  "any_invalid_upstream_quarantine_source_fact_lineage_metadata_or_byte_conflict_fails_closed",
  "no_primary_preference_merge_fallback_reordering_tolerance_coercion_or_silent_repair",
  "atomic_metadata_only_agreement_receipt_or_empty_value_free_conflict_quarantine",
  "domain_separated_determinism_owned_snapshot_mutation_safety_runtime_immutability_and_canary_absence",
  "no_network_raw_parser_normalizer_custody_corpus_database_api_web_queue_or_historical_evidence_mutation",
] as const);

export const FILING_FACT_COMPARISON_NOT_PROVEN = Object.freeze([
  "true_validator_parser_implementation_process_host_operator_key_or_failure_domain_independence",
  "declared_validator_identity_digest_authenticity_code_correspondence_signature_or_authority",
  "cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission",
  "real_filing_raw_payload_identity_digest_equality_or_sec_source_authenticity",
  "xml_xbrl_ixbrl_parser_worker_or_general_taxonomy_plugin_correctness",
  "fact_id_source_preimage_authenticity_accounting_truth_or_cycle2d_normalizer_correctness",
  "independently_adjudicated_ground_truth_or_2000_assertions",
  "precision_recall_document_success_quality_thresholds_quarantine_rate_or_zero_silent_failures",
  "merge_repair_majority_tie_break_human_adjudication_or_correction_policy",
  "malicious_validator_collusion_common_mode_failure_or_real_cross_engine_determinism",
  "edgar_fetch_dns_tls_ssrf_rate_limit_malware_archive_or_source_safety",
  "raw_payload_custody_retention_kms_backup_deletion_or_cryptographic_erasure",
  "real_amendment_completeness_correction_discovery_or_sec_restated_status",
  "multi_issuer_multi_document_batch_streaming_concurrency_retry_crash_recovery_or_slo",
  "database_api_web_queue_persistence_evidence_passport_rights_projection_b15_or_v15_composition",
  "production_identity_secrets_network_operations_real_data_full_cycle2_exit_or_production_use",
] as const);

export const FILING_FACT_COMPARISON_LIMITS = Object.freeze({
  aggregateStringCodePoints: 131_072,
  decimalIntegerDigits: 26,
  decimalPrecision: 38,
  decimalScale: 12,
  factsPerReport: 10,
  factVersionsPerReport: 20,
  lineageEdgesPerReport: 10,
  reportBytes: 262_144,
  reportDepth: 12,
  reportNodes: 2_048,
  reports: 2,
});

export const FILING_FACT_COMPARISON_QUARANTINE_CODES = Object.freeze([
  "report_invalid",
  "validator_binding_invalid",
  "normalized_payload_invalid",
  "validator_quarantined",
  "validator_conflict",
  "comparison_failure",
] as const);

export type FilingFactComparisonQuarantineCode =
  (typeof FILING_FACT_COMPARISON_QUARANTINE_CODES)[number];

export interface FilingFactComparisonAudit {
  readonly factVersionCount: number;
  readonly lineageCount: number;
  readonly outcome: "agreed" | "quarantined";
  readonly validatorCount: number;
}

export interface FilingFactComparisonReceiptValidatorBinding extends FilingFactComparisonDeclaredValidatorBinding {
  readonly reportSha256: `sha256:${string}`;
}

export interface FilingFactComparisonAgreementReceipt {
  readonly agreementSha256: `sha256:${string}`;
  readonly amendmentDocumentSha256: `sha256:${string}`;
  readonly audit: FilingFactComparisonAudit;
  readonly claim: typeof FILING_FACT_COMPARISON_CLAIM;
  readonly originalDocumentSha256: `sha256:${string}`;
  readonly schemaVersion: typeof FILING_FACT_COMPARISON_SCHEMA_VERSION;
  readonly status: "agreed";
  readonly synthetic: true;
  readonly validatorBindings: readonly [
    FilingFactComparisonReceiptValidatorBinding,
    FilingFactComparisonReceiptValidatorBinding,
  ];
}

export interface FilingFactComparisonQuarantinedResult {
  readonly audit: FilingFactComparisonAudit;
  readonly claim: typeof FILING_FACT_COMPARISON_CLAIM;
  readonly code: FilingFactComparisonQuarantineCode;
  readonly factVersions: readonly [];
  readonly lineage: readonly [];
  readonly schemaVersion: typeof FILING_FACT_COMPARISON_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: true;
  readonly validatorBindings: readonly [];
}

export type FilingFactComparisonResult =
  FilingFactComparisonAgreementReceipt | FilingFactComparisonQuarantinedResult;

const AGREEMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-filing-fact-comparison-agreement:v1\u0000",
);

export function compareSyntheticFilingFactValidatorReports(
  declaredValidatorAEnvelope: unknown,
  declaredValidatorBEnvelope: unknown,
): FilingFactComparisonResult {
  try {
    if (arguments.length !== FILING_FACT_COMPARISON_LIMITS.reports)
      return quarantined("report_invalid");
    const first = snapshotReportBytes(declaredValidatorAEnvelope);
    const second = snapshotReportBytes(declaredValidatorBEnvelope);
    if (first === null || second === null) return quarantined("report_invalid");

    const firstValidation = validateDeclaredValidatorAEnvelope(first);
    const secondValidation = validateDeclaredValidatorBEnvelope(second);
    const invalidCode = aggregateInvalidCode(firstValidation, secondValidation);
    if (invalidCode !== null) return quarantined(invalidCode);
    if (
      firstValidation.status === "quarantined" ||
      secondValidation.status === "quarantined"
    ) {
      return quarantined("validator_quarantined");
    }
    if (
      firstValidation.status !== "validated" ||
      secondValidation.status !== "validated"
    ) {
      return quarantined("comparison_failure");
    }
    if (
      firstValidation.originalDocumentSha256 !==
        secondValidation.originalDocumentSha256 ||
      firstValidation.amendmentDocumentSha256 !==
        secondValidation.amendmentDocumentSha256 ||
      !exactBytes(
        firstValidation.normalizedPayloadBytes,
        secondValidation.normalizedPayloadBytes,
      )
    ) {
      return quarantined("validator_conflict");
    }

    const firstReportSha256 = sha256(first);
    const secondReportSha256 = sha256(second);
    const normalizedPayloadSha256 = sha256(
      firstValidation.normalizedPayloadBytes,
    );
    const validatorBindings = receiptBindings(
      firstReportSha256,
      secondReportSha256,
    );
    const agreementSha256 = agreementSha(
      normalizedPayloadSha256,
      validatorBindings,
    );
    return Object.freeze({
      agreementSha256,
      amendmentDocumentSha256: firstValidation.amendmentDocumentSha256,
      audit: Object.freeze({
        factVersionCount: FILING_FACT_COMPARISON_LIMITS.factVersionsPerReport,
        lineageCount: FILING_FACT_COMPARISON_LIMITS.lineageEdgesPerReport,
        outcome: "agreed" as const,
        validatorCount: FILING_FACT_COMPARISON_LIMITS.reports,
      }),
      claim: FILING_FACT_COMPARISON_CLAIM,
      originalDocumentSha256: firstValidation.originalDocumentSha256,
      schemaVersion: FILING_FACT_COMPARISON_SCHEMA_VERSION,
      status: "agreed" as const,
      synthetic: true as const,
      validatorBindings,
    });
  } catch {
    return quarantined("comparison_failure");
  }
}

function snapshotReportBytes(value: unknown): Uint8Array | null {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype
    ) {
      return null;
    }
    const bytes = value as Uint8Array;
    if (
      Object.getPrototypeOf(bytes.buffer) !== ArrayBuffer.prototype ||
      bytes.byteLength === 0 ||
      bytes.byteLength > FILING_FACT_COMPARISON_LIMITS.reportBytes
    ) {
      return null;
    }
    return Uint8Array.prototype.slice.call(bytes);
  } catch {
    return null;
  }
}

function aggregateInvalidCode(
  first: ReturnType<typeof validateDeclaredValidatorAEnvelope>,
  second: ReturnType<typeof validateDeclaredValidatorBEnvelope>,
):
  | "normalized_payload_invalid"
  | "report_invalid"
  | "validator_binding_invalid"
  | null {
  const codes = [
    first.status === "invalid" ? first.code : null,
    second.status === "invalid" ? second.code : null,
  ];
  if (codes.includes("report_invalid")) return "report_invalid";
  if (codes.includes("validator_binding_invalid"))
    return "validator_binding_invalid";
  if (codes.includes("normalized_payload_invalid"))
    return "normalized_payload_invalid";
  return null;
}

function receiptBindings(
  firstReportSha256: `sha256:${string}`,
  secondReportSha256: `sha256:${string}`,
): readonly [
  FilingFactComparisonReceiptValidatorBinding,
  FilingFactComparisonReceiptValidatorBinding,
] {
  const first = FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS[0];
  const second = FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS[1];
  if (first === undefined || second === undefined)
    throw new Error("Declared validator bindings are incomplete.");
  return Object.freeze([
    Object.freeze({ ...first, reportSha256: firstReportSha256 }),
    Object.freeze({ ...second, reportSha256: secondReportSha256 }),
  ]);
}

function agreementSha(
  normalizedPayloadSha256: `sha256:${string}`,
  validatorBindings: readonly FilingFactComparisonReceiptValidatorBinding[],
): `sha256:${string}` {
  const preimage = new TextEncoder().encode(
    canonicalJson({ normalizedPayloadSha256, validatorBindings }),
  );
  return `sha256:${createHash("sha256")
    .update(AGREEMENT_DOMAIN)
    .update(preimage)
    .digest("hex")}`;
}

function quarantined(
  code: FilingFactComparisonQuarantineCode,
): FilingFactComparisonQuarantinedResult {
  return Object.freeze({
    audit: Object.freeze({
      factVersionCount: 0,
      lineageCount: 0,
      outcome: "quarantined" as const,
      validatorCount: 0,
    }),
    claim: FILING_FACT_COMPARISON_CLAIM,
    code,
    factVersions: Object.freeze([] as const),
    lineage: Object.freeze([] as const),
    schemaVersion: FILING_FACT_COMPARISON_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: true as const,
    validatorBindings: Object.freeze([] as const),
  });
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function exactBytes(first: Uint8Array, second: Uint8Array): boolean {
  if (first.byteLength !== second.byteLength) return false;
  for (let index = 0; index < first.byteLength; index += 1) {
    if (first[index] !== second[index]) return false;
  }
  return true;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null)
    throw new TypeError("Agreement preimage is invalid.");
  return `{${Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}
