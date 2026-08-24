import { createHash } from "node:crypto";

export const FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION = "1.0.0" as const;
export const FILING_QUALITY_MEASUREMENT_CLAIM =
  "bounded_synthetic_fixed_population_declared_reference_quality_metric_accounting_and_fail_closed_threshold_evaluation" as const;

export const FILING_QUALITY_MEASUREMENT_FACT_KEYS = Object.freeze([
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

export const FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS = Object.freeze([
  "semantic_value_presence",
  "exact_unit_period",
] as const);

export const FILING_QUALITY_MEASUREMENT_METRICS = Object.freeze([
  "document_success",
  "fact_precision",
  "fact_recall",
  "unit_date_tolerance",
  "silent_critical_failure",
  "quarantine_rate",
] as const);

export const FILING_QUALITY_MEASUREMENT_THRESHOLDS = Object.freeze({
  dateToleranceDays: 0,
  documentSuccessMinimum: Object.freeze({ denominator: 100, numerator: 95 }),
  factPrecisionMinimum: Object.freeze({ denominator: 100, numerator: 99 }),
  factRecallMinimum: Object.freeze({ denominator: 100, numerator: 99 }),
  maximumQuarantineRate: Object.freeze({ denominator: 100, numerator: 5 }),
  maximumSilentCriticalFailures: 0,
  unitTolerancePolicy: "exact_canonical_unit.v1",
});

export const FILING_QUALITY_MEASUREMENT_LIMITS = Object.freeze({
  aggregateStringCodePoints: 1_048_576,
  assertionsPerFact: 2,
  candidateBytes: 2_097_152,
  candidateFactsPerDocument: 10,
  criticalAssertions: 2_000,
  decimalIntegerDigits: 26,
  decimalPrecision: 38,
  decimalScale: 12,
  declaredReferenceBytes: 1_048_576,
  dimensionsPerFact: 4,
  documentDepth: 12,
  documentNodes: 32_768,
  documents: 100,
  expectedFacts: 1_000,
  factsPerDocument: 10,
  inputs: 3,
  planBytes: 32_768,
});

export interface FilingQualityMeasurementDeclaration {
  readonly declarationSha256: `sha256:${string}`;
  readonly id: string;
  readonly role:
    "declared-adjudicator-a" | "declared-adjudicator-b" | "declared-candidate";
  readonly version: typeof FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION;
}

export const FILING_QUALITY_MEASUREMENT_DECLARATIONS = Object.freeze({
  candidate: Object.freeze({
    declarationSha256:
      "sha256:c254e5f327be470a72f9feb206a7c34341b5020cf425592199a17fb4122e4b2a",
    id: "synthetic-filing-quality-candidate",
    role: "declared-candidate" as const,
    version: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
  }),
  declaredAdjudicators: Object.freeze([
    Object.freeze({
      declarationSha256:
        "sha256:2e13475902f4e9a22a4b7c74b4bf07a4104fc91349909b32105f17750ce91d1c",
      id: "synthetic-filing-quality-adjudicator-a",
      role: "declared-adjudicator-a" as const,
      version: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    }),
    Object.freeze({
      declarationSha256:
        "sha256:11525b220ae5b8bc1c28a8cf9398b870c210008f96835062c1ef02016ad25a47",
      id: "synthetic-filing-quality-adjudicator-b",
      role: "declared-adjudicator-b" as const,
      version: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    }),
  ]),
});

export const FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES =
  Object.freeze([
    "comparison_conflict",
    "normalization_failure",
    "parser_failure",
    "validator_quarantine",
  ] as const);

export const FILING_QUALITY_MEASUREMENT_QUARANTINE_CODES = Object.freeze([
  "input_invalid",
  "plan_invalid",
  "declared_reference_invalid",
  "candidate_invalid",
  "binding_invalid",
  "measurement_failure",
] as const);

export const FILING_QUALITY_MEASUREMENT_CHECKS = Object.freeze([
  "exact_fixed_role_synthetic_plan_candidate_and_declared_reference_documents",
  "owned_bounded_utf8_canonical_json_snapshots_and_duplicate_key_rejection",
  "fixed_095_099_099_005_zero_silent_exact_unit_zero_date_policy_binding",
  "closed_label_separated_plan_candidate_and_reference_schemas",
  "declared_plan_candidate_reference_chronology_and_exact_hash_role_binding",
  "exact_100_unique_documents_ten_fixed_keys_and_2000_derived_critical_assertions",
  "sorted_unique_coordinate_recomputation_and_no_duplicate_omission_exclusion_or_reweighting",
  "strict_canonical_decimal_concept_dimension_unit_and_gregorian_period_validation",
  "succeeded_partial_fact_or_quarantined_empty_candidate_state_coherence",
  "evaluator_derived_counts_denominators_classification_and_no_caller_supplied_metrics",
  "exact_fact_true_positive_wrong_prediction_false_positive_plus_false_negative_and_zero_denominator_fail_closed",
  "integer_cross_multiplication_without_float_nan_rounding_epsilon_or_tolerance_widening",
  "fixed_document_success_precision_recall_unit_date_silent_failure_and_quarantine_semantics",
  "valid_below_threshold_evaluation_recorded_as_not_met_not_input_quarantine",
  "immutable_aggregate_only_evaluated_receipt_or_empty_value_free_quarantine_and_canary_absence",
  "domain_separated_determinism_mutation_safety_no_io_composition_or_historical_evidence_mutation",
] as const);

export const FILING_QUALITY_MEASUREMENT_NOT_PROVEN = Object.freeze([
  "actual_independent_adjudicator_identity_process_host_operator_key_or_failure_domain",
  "actual_blinding_label_leakage_absence_prediction_precommitment_or_chronology_authenticity",
  "declared_reference_accounting_correctness_or_human_resolution_quality",
  "candidate_report_parser_execution_identity_digest_authenticity_or_cycle2e_output",
  "cycle2b_external_inventory_rights_steward_key_authority_or_human_review",
  "real_filing_payload_digest_sec_source_authenticity_or_custody",
  "representative_100_real_filings_or_independently_adjudicated_2000_real_assertions",
  "real_parser_quality_precision_recall_document_success_quarantine_or_zero_silent_failures",
  "threshold_statistical_adequacy_confidence_calibration_or_production_acceptance",
  "strategic_quarantine_reason_authenticity_or_malicious_failure_masking_detection",
  "cycle2d_normalizer_lineage_correctness_or_cycle2e_independent_validator_composition",
  "adaptive_metric_oracle_privacy_differential_privacy_or_real_label_confidentiality",
  "general_xbrl_ixbrl_taxonomy_concept_unit_dimension_fiscal_or_amendment_correctness",
  "network_fetch_custody_retention_kms_backup_deletion_or_cryptographic_erasure",
  "database_api_web_queue_persistence_evidence_passport_b15_v15_or_slo",
  "production_identity_secrets_real_data_full_cycle2_exit_or_production_use",
] as const);

export type FilingQualityMeasurementQuarantineCode =
  (typeof FILING_QUALITY_MEASUREMENT_QUARANTINE_CODES)[number];
export type FilingQualityMeasurementFailedThreshold =
  | "document_success_minimum"
  | "fact_precision_minimum"
  | "fact_recall_minimum"
  | "maximum_quarantine_rate"
  | "maximum_silent_critical_failures";

export interface FilingQualityMeasurementRatioMetric {
  readonly defined: boolean;
  readonly denominator: number;
  readonly met: boolean;
  readonly numerator: number;
  readonly threshold: {
    readonly denominator: number;
    readonly numerator: number;
  };
  readonly thresholdKind: "maximum" | "minimum";
}

export interface FilingQualityMeasurementSilentMetric {
  readonly count: number;
  readonly denominator: typeof FILING_QUALITY_MEASUREMENT_LIMITS.criticalAssertions;
  readonly maximumCount: 0;
  readonly met: boolean;
}

export interface FilingQualityMeasurementCounts {
  readonly conceptMismatchCount: number;
  readonly criticalAssertionCount: 2_000;
  readonly dimensionMismatchCount: number;
  readonly documentCount: 100;
  readonly emittedFactCount: number;
  readonly expectedFactCount: 1_000;
  readonly falseNegativeFactCount: number;
  readonly falsePositiveFactCount: number;
  readonly missingDocumentCount: number;
  readonly missingFactCount: number;
  readonly periodMismatchCount: number;
  readonly quarantinedDocumentCount: number;
  readonly semanticAssertionPassCount: number;
  readonly silentCriticalFailureCount: number;
  readonly succeededDocumentCount: number;
  readonly truePositiveFactCount: number;
  readonly unitMismatchCount: number;
  readonly unitPeriodAssertionPassCount: number;
  readonly valueMismatchCount: number;
}

export interface FilingQualityMeasurementMetrics {
  readonly documentSuccess: FilingQualityMeasurementRatioMetric;
  readonly factPrecision: FilingQualityMeasurementRatioMetric;
  readonly factRecall: FilingQualityMeasurementRatioMetric;
  readonly quarantineRate: FilingQualityMeasurementRatioMetric;
  readonly silentCriticalFailure: FilingQualityMeasurementSilentMetric;
  readonly unitDateTolerance: {
    readonly dateToleranceDays: 0;
    readonly periodMismatchCount: number;
    readonly unitMismatchCount: number;
    readonly unitTolerancePolicy: "exact_canonical_unit.v1";
  };
}

export interface FilingQualityMeasurementEvaluatedResult {
  readonly candidateSha256: `sha256:${string}`;
  readonly claim: typeof FILING_QUALITY_MEASUREMENT_CLAIM;
  readonly counts: FilingQualityMeasurementCounts;
  readonly declaredReferenceSha256: `sha256:${string}`;
  readonly evaluationSha256: `sha256:${string}`;
  readonly failedThresholds: readonly FilingQualityMeasurementFailedThreshold[];
  readonly metrics: FilingQualityMeasurementMetrics;
  readonly planSha256: `sha256:${string}`;
  readonly schemaVersion: typeof FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION;
  readonly status: "evaluated";
  readonly synthetic: true;
  readonly syntheticPilotThresholdOutcome: "met" | "not_met";
}

export interface FilingQualityMeasurementQuarantinedResult {
  readonly audit: {
    readonly criticalAssertionCount: 0;
    readonly documentCount: 0;
    readonly emittedFactCount: 0;
    readonly expectedFactCount: 0;
    readonly outcome: "quarantined";
  };
  readonly claim: typeof FILING_QUALITY_MEASUREMENT_CLAIM;
  readonly code: FilingQualityMeasurementQuarantineCode;
  readonly metrics: readonly [];
  readonly schemaVersion: typeof FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: true;
}

export type FilingQualityMeasurementResult =
  | FilingQualityMeasurementEvaluatedResult
  | FilingQualityMeasurementQuarantinedResult;

type FactKey = (typeof FILING_QUALITY_MEASUREMENT_FACT_KEYS)[number];
type CandidateQuarantineCode =
  (typeof FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES)[number];

interface MeasurementDimension {
  readonly axis: string;
  readonly member: string;
}

interface MeasurementFact {
  readonly concept: string;
  readonly dimensions: readonly MeasurementDimension[];
  readonly factKey: FactKey;
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly unit: string;
  readonly value: string;
}

interface ReferenceDocument {
  readonly documentId: string;
  readonly documentSha256: `sha256:${string}`;
  readonly facts: readonly MeasurementFact[];
}

interface SucceededCandidateDocument {
  readonly documentId: string;
  readonly documentSha256: `sha256:${string}`;
  readonly facts: readonly MeasurementFact[];
  readonly status: "succeeded";
}

interface QuarantinedCandidateDocument {
  readonly documentId: string;
  readonly documentSha256: `sha256:${string}`;
  readonly facts: readonly [];
  readonly quarantineCode: CandidateQuarantineCode;
  readonly status: "quarantined";
}

type CandidateDocument =
  QuarantinedCandidateDocument | SucceededCandidateDocument;

interface DeclaredReference {
  readonly documents: readonly ReferenceDocument[];
}

interface CandidateObservations {
  readonly documents: ReadonlyMap<string, CandidateDocument>;
}

interface MutableCounts {
  conceptMismatchCount: number;
  dimensionMismatchCount: number;
  emittedFactCount: number;
  missingDocumentCount: number;
  missingFactCount: number;
  periodMismatchCount: number;
  quarantinedDocumentCount: number;
  semanticAssertionPassCount: number;
  silentCriticalFailureCount: number;
  succeededDocumentCount: number;
  truePositiveFactCount: number;
  unitMismatchCount: number;
  unitPeriodAssertionPassCount: number;
  valueMismatchCount: number;
}

interface FactContract {
  readonly concept: string;
  readonly periodKind: "duration" | "instant";
  readonly unit: string;
}

class MeasurementFailure extends Error {
  public constructor(
    public readonly code: FilingQualityMeasurementQuarantineCode,
  ) {
    super("Synthetic filing quality measurement failed.");
    this.name = "MeasurementFailure";
  }
}

const PLAN_ROLE = "synthetic_pilot_plan" as const;
const REFERENCE_ROLE = "declared_reference" as const;
const CANDIDATE_ROLE = "candidate_observations" as const;
const PLAN_ID = "synthetic-filing-quality-plan.v1" as const;
const CORPUS_ID = "synthetic-filing-quality-reference.v1" as const;
const PLAN_FROZEN_AT = "2026-01-01T00:00:00.000Z" as const;
const REFERENCE_DECLARED_AT = "2026-01-02T00:00:00.000Z" as const;
const CANDIDATE_PRODUCED_AT = "2026-01-03T00:00:00.000Z" as const;
const REFERENCE_DECLARATION =
  "declared_synthetic_reference_not_independently_adjudicated" as const;
const HASH = /^sha256:[0-9a-f]{64}$/u;
const DOCUMENT_ID = /^synthetic-filing-[0-9]{4}$/u;
const DECIMAL = /^-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?$/u;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const QNAME = /^[A-Za-z_][A-Za-z0-9._-]{0,62}:[A-Za-z_][A-Za-z0-9._-]{0,62}$/u;
const SAFE_TOKEN = /^[A-Za-z][A-Za-z0-9._:/-]{0,127}$/u;
const SAFE_DIMENSION_TOKEN = /^[A-Za-z_][A-Za-z0-9._:-]{0,127}$/u;
const EVALUATION_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-filing-quality-measurement:v1\u0000",
);
const DOCUMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-filing-quality-document:v1\u0000",
);

const FACT_CONTRACTS: Readonly<Record<FactKey, FactContract>> = Object.freeze({
  assets: Object.freeze({
    concept: "rc-synthetic:Assets",
    periodKind: "instant" as const,
    unit: "USD",
  }),
  cash: Object.freeze({
    concept: "rc-synthetic:CashAndCashEquivalents",
    periodKind: "instant" as const,
    unit: "USD",
  }),
  debt: Object.freeze({
    concept: "rc-synthetic:Debt",
    periodKind: "instant" as const,
    unit: "USD",
  }),
  diluted_shares: Object.freeze({
    concept: "rc-synthetic:WeightedAverageDilutedShares",
    periodKind: "duration" as const,
    unit: "shares",
  }),
  free_cash_flow: Object.freeze({
    concept: "rc-synthetic:FreeCashFlow",
    periodKind: "duration" as const,
    unit: "USD",
  }),
  gross_profit: Object.freeze({
    concept: "rc-synthetic:GrossProfit",
    periodKind: "duration" as const,
    unit: "USD",
  }),
  net_income: Object.freeze({
    concept: "rc-synthetic:NetIncome",
    periodKind: "duration" as const,
    unit: "USD",
  }),
  operating_cash_flow: Object.freeze({
    concept: "rc-synthetic:OperatingCashFlow",
    periodKind: "duration" as const,
    unit: "USD",
  }),
  operating_income: Object.freeze({
    concept: "rc-synthetic:OperatingIncome",
    periodKind: "duration" as const,
    unit: "USD",
  }),
  revenue: Object.freeze({
    concept: "rc-synthetic:Revenue",
    periodKind: "duration" as const,
    unit: "USD",
  }),
});

export function measureSyntheticFilingQuality(
  plan: unknown,
  declaredReference: unknown,
  candidate: unknown,
): FilingQualityMeasurementResult {
  try {
    if (arguments.length !== FILING_QUALITY_MEASUREMENT_LIMITS.inputs)
      invalid("input_invalid");
    const planSnapshot = snapshotBytes(
      plan,
      FILING_QUALITY_MEASUREMENT_LIMITS.planBytes,
    );
    const referenceSnapshot = snapshotBytes(
      declaredReference,
      FILING_QUALITY_MEASUREMENT_LIMITS.declaredReferenceBytes,
    );
    const candidateSnapshot = snapshotBytes(
      candidate,
      FILING_QUALITY_MEASUREMENT_LIMITS.candidateBytes,
    );

    const planSha256 = sha256(planSnapshot);
    validatePlan(parseCanonicalDocument(planSnapshot, "plan_invalid"));
    const reference = validateDeclaredReference(
      parseCanonicalDocument(referenceSnapshot, "declared_reference_invalid"),
      planSha256,
    );
    const declaredReferenceSha256 = sha256(referenceSnapshot);
    const observations = validateCandidate(
      parseCanonicalDocument(candidateSnapshot, "candidate_invalid"),
      planSha256,
      declaredReferenceSha256,
      reference,
    );
    const candidateSha256 = sha256(candidateSnapshot);

    return evaluated(
      planSha256,
      declaredReferenceSha256,
      candidateSha256,
      measure(reference, observations),
    );
  } catch (error) {
    return quarantined(
      error instanceof MeasurementFailure ? error.code : "measurement_failure",
    );
  }
}

function snapshotBytes(value: unknown, maximumBytes: number): Uint8Array {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype
    ) {
      invalid("input_invalid");
    }
    const bytes = value as Uint8Array;
    if (
      Object.getPrototypeOf(bytes.buffer) !== ArrayBuffer.prototype ||
      bytes.byteLength === 0 ||
      bytes.byteLength > maximumBytes
    ) {
      invalid("input_invalid");
    }
    return Uint8Array.prototype.slice.call(bytes);
  } catch (error) {
    if (error instanceof MeasurementFailure) throw error;
    invalid("input_invalid");
  }
}

function parseCanonicalDocument(
  bytes: Uint8Array,
  code: FilingQualityMeasurementQuarantineCode,
): unknown {
  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    const parsed: unknown = JSON.parse(text);
    validateCanonicalTree(parsed, code);
    if (`${canonicalJson(parsed)}\n` !== text) invalid(code);
    return parsed;
  } catch (error) {
    if (error instanceof MeasurementFailure) throw error;
    invalid(code);
  }
}

function validatePlan(value: unknown): void {
  const code = "plan_invalid" as const;
  const plan = exactRecord(
    value,
    [
      "assertionKinds",
      "assertionTarget",
      "candidateStatuses",
      "declaredAdjudicators",
      "declaredCandidate",
      "documentRole",
      "documentTarget",
      "factKeys",
      "factTarget",
      "frozenAt",
      "metrics",
      "planId",
      "planVersion",
      "referenceDeclaration",
      "schemaVersion",
      "synthetic",
      "thresholds",
    ],
    code,
  );
  const thresholds = exactRecord(
    plan.thresholds,
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
    plan.schemaVersion !== FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION ||
    plan.planVersion !== FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION ||
    plan.synthetic !== true ||
    plan.documentRole !== PLAN_ROLE ||
    plan.planId !== PLAN_ID ||
    plan.frozenAt !== PLAN_FROZEN_AT ||
    plan.referenceDeclaration !== REFERENCE_DECLARATION ||
    plan.documentTarget !== FILING_QUALITY_MEASUREMENT_LIMITS.documents ||
    plan.factTarget !== FILING_QUALITY_MEASUREMENT_LIMITS.expectedFacts ||
    plan.assertionTarget !==
      FILING_QUALITY_MEASUREMENT_LIMITS.criticalAssertions ||
    !exactArray(plan.factKeys, FILING_QUALITY_MEASUREMENT_FACT_KEYS) ||
    !exactArray(
      plan.assertionKinds,
      FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS,
    ) ||
    !exactArray(plan.metrics, FILING_QUALITY_MEASUREMENT_METRICS) ||
    !exactArray(plan.candidateStatuses, ["quarantined", "succeeded"]) ||
    !exactDeclarations(
      plan.declaredAdjudicators,
      FILING_QUALITY_MEASUREMENT_DECLARATIONS.declaredAdjudicators,
      code,
    ) ||
    !exactDeclaration(
      plan.declaredCandidate,
      FILING_QUALITY_MEASUREMENT_DECLARATIONS.candidate,
      code,
    ) ||
    thresholds.dateToleranceDays !== 0 ||
    thresholds.documentSuccessMinimum !== "0.95" ||
    thresholds.factPrecisionMinimum !== "0.99" ||
    thresholds.factRecallMinimum !== "0.99" ||
    thresholds.maximumQuarantineRate !== "0.05" ||
    thresholds.maximumSilentCriticalFailures !== 0 ||
    thresholds.unitTolerancePolicy !== "exact_canonical_unit.v1"
  ) {
    invalid(code);
  }
}

function validateDeclaredReference(
  value: unknown,
  planSha256: `sha256:${string}`,
): DeclaredReference {
  const code = "declared_reference_invalid" as const;
  const reference = exactRecord(
    value,
    [
      "criticalAssertionCount",
      "declaredAdjudicators",
      "declaredAt",
      "declaration",
      "documentCount",
      "documentRole",
      "documents",
      "factCount",
      "populationId",
      "populationVersion",
      "planSha256",
      "schemaVersion",
      "synthetic",
    ],
    code,
  );
  if (
    reference.schemaVersion !== FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION ||
    reference.synthetic !== true ||
    reference.documentRole !== REFERENCE_ROLE ||
    reference.populationId !== CORPUS_ID ||
    reference.populationVersion !== FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION ||
    reference.declaration !== REFERENCE_DECLARATION ||
    reference.documentCount !== FILING_QUALITY_MEASUREMENT_LIMITS.documents ||
    reference.factCount !== FILING_QUALITY_MEASUREMENT_LIMITS.expectedFacts ||
    reference.criticalAssertionCount !==
      FILING_QUALITY_MEASUREMENT_LIMITS.criticalAssertions ||
    !Array.isArray(reference.documents) ||
    reference.documents.length !== FILING_QUALITY_MEASUREMENT_LIMITS.documents
  ) {
    invalid(code);
  }
  if (
    reference.planSha256 !== planSha256 ||
    reference.declaredAt !== REFERENCE_DECLARED_AT ||
    !(PLAN_FROZEN_AT < REFERENCE_DECLARED_AT) ||
    !exactDeclarations(
      reference.declaredAdjudicators,
      FILING_QUALITY_MEASUREMENT_DECLARATIONS.declaredAdjudicators,
      code,
    )
  ) {
    invalid("binding_invalid");
  }

  const documents: ReferenceDocument[] = [];
  const ids = new Set<string>();
  const hashes = new Set<string>();
  let previousId = "";
  for (let index = 0; index < reference.documents.length; index += 1) {
    const rawDocument: unknown = (reference.documents as unknown[])[index];
    if (rawDocument === undefined) invalid(code);
    const document = validateReferenceDocument(rawDocument, index);
    if (
      document.documentId <= previousId ||
      ids.has(document.documentId) ||
      hashes.has(document.documentSha256)
    ) {
      invalid(code);
    }
    ids.add(document.documentId);
    hashes.add(document.documentSha256);
    documents.push(document);
    previousId = document.documentId;
  }
  return Object.freeze({ documents: Object.freeze(documents) });
}

function validateReferenceDocument(
  value: unknown,
  index: number,
): ReferenceDocument {
  const code = "declared_reference_invalid" as const;
  const document = exactRecord(
    value,
    ["documentId", "documentSha256", "facts"],
    code,
  );
  const expectedDocumentId = `synthetic-filing-${String(index + 1).padStart(
    4,
    "0",
  )}`;
  if (
    typeof document.documentId !== "string" ||
    !DOCUMENT_ID.test(document.documentId) ||
    document.documentId !== expectedDocumentId ||
    typeof document.documentSha256 !== "string" ||
    !HASH.test(document.documentSha256) ||
    !Array.isArray(document.facts) ||
    document.facts.length !== FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument
  ) {
    invalid(code);
  }
  if (document.documentSha256 !== syntheticDocumentSha(expectedDocumentId)) {
    invalid(code);
  }
  const facts: MeasurementFact[] = [];
  for (
    let index = 0;
    index < FILING_QUALITY_MEASUREMENT_FACT_KEYS.length;
    index += 1
  ) {
    const expectedKey = FILING_QUALITY_MEASUREMENT_FACT_KEYS[index];
    const rawFact: unknown = (document.facts as unknown[])[index];
    if (expectedKey === undefined || rawFact === undefined) invalid(code);
    const fact = validateFact(rawFact, code);
    const contract = FACT_CONTRACTS[expectedKey];
    if (
      fact.factKey !== expectedKey ||
      fact.concept !== contract.concept ||
      fact.dimensions.length !== 0 ||
      fact.unit !== contract.unit ||
      (contract.periodKind === "instant") !== (fact.periodStart === null)
    ) {
      invalid(code);
    }
    facts.push(fact);
  }
  return Object.freeze({
    documentId: document.documentId,
    documentSha256: document.documentSha256,
    facts: Object.freeze(facts),
  });
}

function validateCandidate(
  value: unknown,
  planSha256: `sha256:${string}`,
  declaredReferenceSha256: `sha256:${string}`,
  reference: DeclaredReference,
): CandidateObservations {
  const code = "candidate_invalid" as const;
  const candidate = exactRecord(
    value,
    [
      "candidateDeclaration",
      "declaredReferenceSha256",
      "documentObservations",
      "documentRole",
      "planSha256",
      "populationId",
      "populationVersion",
      "producedAt",
      "schemaVersion",
      "synthetic",
    ],
    code,
  );
  if (
    candidate.schemaVersion !== FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION ||
    candidate.synthetic !== true ||
    candidate.documentRole !== CANDIDATE_ROLE ||
    typeof candidate.planSha256 !== "string" ||
    !HASH.test(candidate.planSha256) ||
    typeof candidate.declaredReferenceSha256 !== "string" ||
    !HASH.test(candidate.declaredReferenceSha256) ||
    typeof candidate.populationId !== "string" ||
    typeof candidate.populationVersion !== "string" ||
    typeof candidate.producedAt !== "string" ||
    !Array.isArray(candidate.documentObservations) ||
    candidate.documentObservations.length >
      FILING_QUALITY_MEASUREMENT_LIMITS.documents
  ) {
    invalid(code);
  }
  if (
    candidate.planSha256 !== planSha256 ||
    candidate.declaredReferenceSha256 !== declaredReferenceSha256 ||
    candidate.populationId !== CORPUS_ID ||
    candidate.populationVersion !== FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION ||
    candidate.producedAt !== CANDIDATE_PRODUCED_AT ||
    !(REFERENCE_DECLARED_AT < CANDIDATE_PRODUCED_AT) ||
    !exactDeclaration(
      candidate.candidateDeclaration,
      FILING_QUALITY_MEASUREMENT_DECLARATIONS.candidate,
      code,
    )
  ) {
    invalid("binding_invalid");
  }

  const referencesById = new Map(
    reference.documents.map((document) => [document.documentId, document]),
  );
  const observations = new Map<string, CandidateDocument>();
  let previousId = "";
  for (const rawObservation of candidate.documentObservations) {
    const observation = validateCandidateDocument(rawObservation);
    const expected = referencesById.get(observation.documentId);
    if (
      observation.documentId <= previousId ||
      observations.has(observation.documentId) ||
      expected === undefined
    ) {
      invalid(code);
    }
    if (observation.documentSha256 !== expected.documentSha256)
      invalid("binding_invalid");
    observations.set(observation.documentId, observation);
    previousId = observation.documentId;
  }
  return Object.freeze({ documents: observations });
}

function validateCandidateDocument(value: unknown): CandidateDocument {
  const code = "candidate_invalid" as const;
  if (typeof value !== "object" || value === null || Array.isArray(value))
    invalid(code);
  const status = (value as Record<string, unknown>).status;
  if (status === "quarantined") {
    const document = exactRecord(
      value,
      ["documentId", "documentSha256", "facts", "quarantineCode", "status"],
      code,
    );
    if (
      typeof document.documentId !== "string" ||
      !DOCUMENT_ID.test(document.documentId) ||
      typeof document.documentSha256 !== "string" ||
      !HASH.test(document.documentSha256) ||
      !Array.isArray(document.facts) ||
      document.facts.length !== 0 ||
      typeof document.quarantineCode !== "string" ||
      !isCandidateQuarantineCode(document.quarantineCode)
    ) {
      invalid(code);
    }
    return Object.freeze({
      documentId: document.documentId,
      documentSha256: document.documentSha256 as `sha256:${string}`,
      facts: Object.freeze([] as const),
      quarantineCode: document.quarantineCode,
      status: "quarantined" as const,
    });
  }
  if (status !== "succeeded") invalid(code);
  const document = exactRecord(
    value,
    ["documentId", "documentSha256", "facts", "status"],
    code,
  );
  if (
    typeof document.documentId !== "string" ||
    !DOCUMENT_ID.test(document.documentId) ||
    typeof document.documentSha256 !== "string" ||
    !HASH.test(document.documentSha256) ||
    !Array.isArray(document.facts) ||
    document.facts.length >
      FILING_QUALITY_MEASUREMENT_LIMITS.candidateFactsPerDocument
  ) {
    invalid(code);
  }
  const facts: MeasurementFact[] = [];
  let previousKey = "";
  for (const rawFact of document.facts) {
    const fact = validateFact(rawFact, code);
    if (fact.factKey <= previousKey) invalid(code);
    facts.push(fact);
    previousKey = fact.factKey;
  }
  return Object.freeze({
    documentId: document.documentId,
    documentSha256: document.documentSha256 as `sha256:${string}`,
    facts: Object.freeze(facts),
    status: "succeeded" as const,
  });
}

function validateFact(
  value: unknown,
  code: FilingQualityMeasurementQuarantineCode,
): MeasurementFact {
  const fact = exactRecord(
    value,
    [
      "concept",
      "dimensions",
      "factKey",
      "periodEnd",
      "periodStart",
      "unit",
      "value",
    ],
    code,
  );
  if (
    typeof fact.factKey !== "string" ||
    !isFactKey(fact.factKey) ||
    typeof fact.concept !== "string" ||
    !QNAME.test(fact.concept) ||
    typeof fact.value !== "string" ||
    !isCanonicalDecimal(fact.value) ||
    typeof fact.unit !== "string" ||
    !SAFE_TOKEN.test(fact.unit) ||
    typeof fact.periodEnd !== "string" ||
    !isGregorianDate(fact.periodEnd) ||
    (fact.periodStart !== null &&
      (typeof fact.periodStart !== "string" ||
        !isGregorianDate(fact.periodStart))) ||
    (typeof fact.periodStart === "string" &&
      fact.periodStart >= fact.periodEnd) ||
    !Array.isArray(fact.dimensions) ||
    fact.dimensions.length > FILING_QUALITY_MEASUREMENT_LIMITS.dimensionsPerFact
  ) {
    invalid(code);
  }
  const dimensions: MeasurementDimension[] = [];
  let previousCoordinate = "";
  let previousAxis = "";
  for (const rawDimension of fact.dimensions) {
    const dimension = exactRecord(rawDimension, ["axis", "member"], code);
    if (
      typeof dimension.axis !== "string" ||
      !SAFE_DIMENSION_TOKEN.test(dimension.axis) ||
      typeof dimension.member !== "string" ||
      !SAFE_DIMENSION_TOKEN.test(dimension.member)
    ) {
      invalid(code);
    }
    const coordinate = `${dimension.axis}\u0000${dimension.member}`;
    if (coordinate <= previousCoordinate || dimension.axis === previousAxis)
      invalid(code);
    dimensions.push(
      Object.freeze({ axis: dimension.axis, member: dimension.member }),
    );
    previousCoordinate = coordinate;
    previousAxis = dimension.axis;
  }
  return Object.freeze({
    concept: fact.concept,
    dimensions: Object.freeze(dimensions),
    factKey: fact.factKey,
    periodEnd: fact.periodEnd,
    periodStart: fact.periodStart,
    unit: fact.unit,
    value: fact.value,
  });
}

function measure(
  reference: DeclaredReference,
  candidate: CandidateObservations,
): FilingQualityMeasurementCounts {
  const counts: MutableCounts = {
    conceptMismatchCount: 0,
    dimensionMismatchCount: 0,
    emittedFactCount: 0,
    missingDocumentCount: 0,
    missingFactCount: 0,
    periodMismatchCount: 0,
    quarantinedDocumentCount: 0,
    semanticAssertionPassCount: 0,
    silentCriticalFailureCount: 0,
    succeededDocumentCount: 0,
    truePositiveFactCount: 0,
    unitMismatchCount: 0,
    unitPeriodAssertionPassCount: 0,
    valueMismatchCount: 0,
  };

  for (const referenceDocument of reference.documents) {
    const observation = candidate.documents.get(referenceDocument.documentId);
    if (observation === undefined) {
      counts.missingDocumentCount += 1;
      counts.missingFactCount +=
        FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument;
      counts.silentCriticalFailureCount +=
        FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument *
        FILING_QUALITY_MEASUREMENT_LIMITS.assertionsPerFact;
      continue;
    }
    if (observation.status === "quarantined") {
      counts.quarantinedDocumentCount += 1;
      counts.missingFactCount +=
        FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument;
      continue;
    }

    counts.succeededDocumentCount += 1;
    counts.emittedFactCount += observation.facts.length;
    const predictions = new Map(
      observation.facts.map((fact) => [fact.factKey, fact]),
    );
    for (const expected of referenceDocument.facts) {
      const predicted = predictions.get(expected.factKey);
      if (predicted === undefined) {
        counts.missingFactCount += 1;
        counts.silentCriticalFailureCount +=
          FILING_QUALITY_MEASUREMENT_LIMITS.assertionsPerFact;
        continue;
      }
      const conceptMatches = predicted.concept === expected.concept;
      const dimensionsMatch = exactDimensions(
        predicted.dimensions,
        expected.dimensions,
      );
      const valueMatches = predicted.value === expected.value;
      const unitMatches = predicted.unit === expected.unit;
      const periodMatches =
        predicted.periodStart === expected.periodStart &&
        predicted.periodEnd === expected.periodEnd;
      const semanticMatches = conceptMatches && dimensionsMatch && valueMatches;
      const unitPeriodMatches = unitMatches && periodMatches;

      if (!conceptMatches) counts.conceptMismatchCount += 1;
      if (!dimensionsMatch) counts.dimensionMismatchCount += 1;
      if (!valueMatches) counts.valueMismatchCount += 1;
      if (!unitMatches) counts.unitMismatchCount += 1;
      if (!periodMatches) counts.periodMismatchCount += 1;
      if (semanticMatches) counts.semanticAssertionPassCount += 1;
      else counts.silentCriticalFailureCount += 1;
      if (unitPeriodMatches) counts.unitPeriodAssertionPassCount += 1;
      else counts.silentCriticalFailureCount += 1;
      if (semanticMatches && unitPeriodMatches)
        counts.truePositiveFactCount += 1;
    }
  }

  const falsePositiveFactCount =
    counts.emittedFactCount - counts.truePositiveFactCount;
  const falseNegativeFactCount =
    FILING_QUALITY_MEASUREMENT_LIMITS.expectedFacts -
    counts.truePositiveFactCount;
  return Object.freeze({
    conceptMismatchCount: counts.conceptMismatchCount,
    criticalAssertionCount:
      FILING_QUALITY_MEASUREMENT_LIMITS.criticalAssertions,
    dimensionMismatchCount: counts.dimensionMismatchCount,
    documentCount: FILING_QUALITY_MEASUREMENT_LIMITS.documents,
    emittedFactCount: counts.emittedFactCount,
    expectedFactCount: FILING_QUALITY_MEASUREMENT_LIMITS.expectedFacts,
    falseNegativeFactCount,
    falsePositiveFactCount,
    missingDocumentCount: counts.missingDocumentCount,
    missingFactCount: counts.missingFactCount,
    periodMismatchCount: counts.periodMismatchCount,
    quarantinedDocumentCount: counts.quarantinedDocumentCount,
    semanticAssertionPassCount: counts.semanticAssertionPassCount,
    silentCriticalFailureCount: counts.silentCriticalFailureCount,
    succeededDocumentCount: counts.succeededDocumentCount,
    truePositiveFactCount: counts.truePositiveFactCount,
    unitMismatchCount: counts.unitMismatchCount,
    unitPeriodAssertionPassCount: counts.unitPeriodAssertionPassCount,
    valueMismatchCount: counts.valueMismatchCount,
  });
}

function evaluated(
  planSha256: `sha256:${string}`,
  declaredReferenceSha256: `sha256:${string}`,
  candidateSha256: `sha256:${string}`,
  counts: FilingQualityMeasurementCounts,
): FilingQualityMeasurementEvaluatedResult {
  const documentSuccess = ratioMetric(
    counts.succeededDocumentCount,
    counts.documentCount,
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.documentSuccessMinimum,
    "minimum",
  );
  const factPrecision = ratioMetric(
    counts.truePositiveFactCount,
    counts.emittedFactCount,
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.factPrecisionMinimum,
    "minimum",
  );
  const factRecall = ratioMetric(
    counts.truePositiveFactCount,
    counts.expectedFactCount,
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.factRecallMinimum,
    "minimum",
  );
  const quarantineRate = ratioMetric(
    counts.quarantinedDocumentCount,
    counts.documentCount,
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.maximumQuarantineRate,
    "maximum",
  );
  const silentCriticalFailure = Object.freeze({
    count: counts.silentCriticalFailureCount,
    denominator: FILING_QUALITY_MEASUREMENT_LIMITS.criticalAssertions,
    maximumCount:
      FILING_QUALITY_MEASUREMENT_THRESHOLDS.maximumSilentCriticalFailures,
    met:
      counts.silentCriticalFailureCount <=
      FILING_QUALITY_MEASUREMENT_THRESHOLDS.maximumSilentCriticalFailures,
  });
  const metrics: FilingQualityMeasurementMetrics = Object.freeze({
    documentSuccess,
    factPrecision,
    factRecall,
    quarantineRate,
    silentCriticalFailure,
    unitDateTolerance: Object.freeze({
      dateToleranceDays:
        FILING_QUALITY_MEASUREMENT_THRESHOLDS.dateToleranceDays,
      periodMismatchCount: counts.periodMismatchCount,
      unitMismatchCount: counts.unitMismatchCount,
      unitTolerancePolicy:
        FILING_QUALITY_MEASUREMENT_THRESHOLDS.unitTolerancePolicy,
    }),
  });
  const failedThresholds: FilingQualityMeasurementFailedThreshold[] = [];
  if (!documentSuccess.met) failedThresholds.push("document_success_minimum");
  if (!factPrecision.met) failedThresholds.push("fact_precision_minimum");
  if (!factRecall.met) failedThresholds.push("fact_recall_minimum");
  if (!quarantineRate.met) failedThresholds.push("maximum_quarantine_rate");
  if (!silentCriticalFailure.met)
    failedThresholds.push("maximum_silent_critical_failures");
  const frozenFailedThresholds = Object.freeze(failedThresholds);
  const syntheticPilotThresholdOutcome =
    frozenFailedThresholds.length === 0 ? "met" : "not_met";
  const evaluationSha256 = sha256(
    concatBytes(
      EVALUATION_DOMAIN,
      new TextEncoder().encode(
        canonicalJson({
          candidateSha256,
          counts,
          declaredReferenceSha256,
          failedThresholds: frozenFailedThresholds,
          planSha256,
          syntheticPilotThresholdOutcome,
        }),
      ),
    ),
  );
  return Object.freeze({
    candidateSha256,
    claim: FILING_QUALITY_MEASUREMENT_CLAIM,
    counts,
    declaredReferenceSha256,
    evaluationSha256,
    failedThresholds: frozenFailedThresholds,
    metrics,
    planSha256,
    schemaVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    status: "evaluated" as const,
    synthetic: true as const,
    syntheticPilotThresholdOutcome,
  });
}

function ratioMetric(
  numerator: number,
  denominator: number,
  threshold: Readonly<{
    readonly denominator: number;
    readonly numerator: number;
  }>,
  thresholdKind: "maximum" | "minimum",
): FilingQualityMeasurementRatioMetric {
  const defined = denominator !== 0;
  const met =
    defined &&
    (thresholdKind === "minimum"
      ? ratioAtLeast(numerator, denominator, threshold)
      : ratioAtMost(numerator, denominator, threshold));
  return Object.freeze({
    defined,
    denominator,
    met,
    numerator,
    threshold: Object.freeze({
      denominator: threshold.denominator,
      numerator: threshold.numerator,
    }),
    thresholdKind,
  });
}

function ratioAtLeast(
  numerator: number,
  denominator: number,
  threshold: Readonly<{
    readonly denominator: number;
    readonly numerator: number;
  }>,
): boolean {
  return (
    BigInt(numerator) * BigInt(threshold.denominator) >=
    BigInt(threshold.numerator) * BigInt(denominator)
  );
}

function ratioAtMost(
  numerator: number,
  denominator: number,
  threshold: Readonly<{
    readonly denominator: number;
    readonly numerator: number;
  }>,
): boolean {
  return (
    BigInt(numerator) * BigInt(threshold.denominator) <=
    BigInt(threshold.numerator) * BigInt(denominator)
  );
}

function exactDeclarations(
  value: unknown,
  expected: readonly FilingQualityMeasurementDeclaration[],
  code: FilingQualityMeasurementQuarantineCode,
): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((declaration, index) => {
      const expectedDeclaration = expected[index];
      return (
        expectedDeclaration !== undefined &&
        exactDeclaration(declaration, expectedDeclaration, code)
      );
    })
  );
}

function exactDeclaration(
  value: unknown,
  expected: FilingQualityMeasurementDeclaration,
  code: FilingQualityMeasurementQuarantineCode,
): boolean {
  const declaration = exactRecord(
    value,
    ["declarationSha256", "id", "role", "version"],
    code,
  );
  return (
    declaration.declarationSha256 === expected.declarationSha256 &&
    declaration.id === expected.id &&
    declaration.role === expected.role &&
    declaration.version === expected.version
  );
}

function exactArray(value: unknown, expected: readonly unknown[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

function exactRecord<const TKeys extends readonly string[]>(
  value: unknown,
  expectedKeys: TKeys,
  code: FilingQualityMeasurementQuarantineCode,
): Record<TKeys[number], unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    invalid(code);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    invalid(code);
  }
  return value as Record<TKeys[number], unknown>;
}

function exactDimensions(
  first: readonly MeasurementDimension[],
  second: readonly MeasurementDimension[],
): boolean {
  return (
    first.length === second.length &&
    first.every(
      (dimension, index) =>
        dimension.axis === second[index]?.axis &&
        dimension.member === second[index]?.member,
    )
  );
}

function validateCanonicalTree(
  value: unknown,
  code: FilingQualityMeasurementQuarantineCode,
): void {
  const stack: Array<{ readonly depth: number; readonly value: unknown }> = [
    { depth: 0, value },
  ];
  let nodes = 0;
  let stringCodePoints = 0;
  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry === undefined) invalid(code);
    nodes += 1;
    if (
      nodes > FILING_QUALITY_MEASUREMENT_LIMITS.documentNodes ||
      entry.depth > FILING_QUALITY_MEASUREMENT_LIMITS.documentDepth
    ) {
      invalid(code);
    }
    if (typeof entry.value === "string") {
      stringCodePoints += [...entry.value].length;
    } else if (
      entry.value === null ||
      typeof entry.value === "boolean" ||
      (typeof entry.value === "number" && Number.isSafeInteger(entry.value))
    ) {
      // Byte bounds cover primitive storage.
    } else if (Array.isArray(entry.value)) {
      for (const item of entry.value)
        stack.push({ depth: entry.depth + 1, value: item });
    } else if (
      typeof entry.value === "object" &&
      entry.value !== null &&
      Object.getPrototypeOf(entry.value) === Object.prototype
    ) {
      for (const [key, item] of Object.entries(entry.value)) {
        stringCodePoints += [...key].length;
        stack.push({ depth: entry.depth + 1, value: item });
      }
    } else {
      invalid(code);
    }
    if (
      stringCodePoints >
      FILING_QUALITY_MEASUREMENT_LIMITS.aggregateStringCodePoints
    ) {
      invalid(code);
    }
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (
    typeof value !== "object" ||
    value === null ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError("Canonical measurement value is invalid.");
  }
  return `{${Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function isFactKey(value: string): value is FactKey {
  return (FILING_QUALITY_MEASUREMENT_FACT_KEYS as readonly string[]).includes(
    value,
  );
}

function isCandidateQuarantineCode(
  value: string,
): value is CandidateQuarantineCode {
  return (
    FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES as readonly string[]
  ).includes(value);
}

function isCanonicalDecimal(value: string): boolean {
  if (!DECIMAL.test(value) || /^-0(?:\.0+)?$/u.test(value)) return false;
  const unsigned = value.startsWith("-") ? value.slice(1) : value;
  const [integer = "", fraction = ""] = unsigned.split(".");
  return (
    integer.length <= FILING_QUALITY_MEASUREMENT_LIMITS.decimalIntegerDigits &&
    fraction.length <= FILING_QUALITY_MEASUREMENT_LIMITS.decimalScale &&
    integer.length + fraction.length <=
      FILING_QUALITY_MEASUREMENT_LIMITS.decimalPrecision
  );
}

function isGregorianDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (match === null) return false;
  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];
  if (
    yearText === undefined ||
    monthText === undefined ||
    dayText === undefined
  ) {
    return false;
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const monthLengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  const maximumDay = monthLengths[month - 1];
  return maximumDay !== undefined && day <= maximumDay;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function syntheticDocumentSha(documentId: string): `sha256:${string}` {
  return sha256(
    concatBytes(DOCUMENT_DOMAIN, new TextEncoder().encode(documentId)),
  );
}

function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const result = new Uint8Array(first.byteLength + second.byteLength);
  result.set(first, 0);
  result.set(second, first.byteLength);
  return result;
}

function invalid(code: FilingQualityMeasurementQuarantineCode): never {
  throw new MeasurementFailure(code);
}

function quarantined(
  code: FilingQualityMeasurementQuarantineCode,
): FilingQualityMeasurementQuarantinedResult {
  return Object.freeze({
    audit: Object.freeze({
      criticalAssertionCount: 0 as const,
      documentCount: 0 as const,
      emittedFactCount: 0 as const,
      expectedFactCount: 0 as const,
      outcome: "quarantined" as const,
    }),
    claim: FILING_QUALITY_MEASUREMENT_CLAIM,
    code,
    metrics: Object.freeze([] as const),
    schemaVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: true as const,
  });
}
