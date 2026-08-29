import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  PERSONAL_FILING_CORPUS_LIMITS,
  PERSONAL_FILING_CORPUS_PROFILE,
  verifyPersonalFilingCorpusManifest,
} from "./personal-filing-corpus";
import {
  PERSONAL_FILING_FACT_CONTRACTS,
  PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA,
  PERSONAL_FILING_FACT_KEYS,
  PERSONAL_FILING_FACT_NORMALIZATION_LIMITS,
  normalizePersonalFilingFacts,
  type PersonalFilingFactKey,
  type PersonalFilingFactSubtractionDerivation,
  type PersonalNormalizedFilingFactVersion,
} from "./personal-filing-fact-normalization";
import {
  PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS,
  comparePersonalFilingRawFactExtraction,
  type PersonalFilingRawFactExtractionInput,
} from "./personal-filing-raw-fact-extraction";

export const PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION =
  "1.0.0" as const;
export const PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM =
  "bounded_owner_reviewed_frozen_reference_personal_filing_quality_measurement_with_predeclared_zero_tolerance_thresholds_and_atomic_value_free_quarantine_for_personal_single_user_local_use" as const;
export const PERSONAL_FILING_QUALITY_MEASUREMENT_ASSURANCE =
  "candidate_observations_committed_before_owner_reviewed_reference_content_reveal" as const;

export const PERSONAL_FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS =
  Object.freeze(["semantic_value_presence", "exact_unit_period"] as const);

export const PERSONAL_FILING_QUALITY_MEASUREMENT_METRICS = Object.freeze([
  "document_success",
  "fact_precision",
  "fact_recall",
  "unit_date_tolerance",
  "silent_critical_failure",
  "quarantine_rate",
] as const);

export const PERSONAL_FILING_QUALITY_MEASUREMENT_THRESHOLDS = Object.freeze({
  dateToleranceDays: 0,
  documentSuccessMinimum: Object.freeze({ denominator: 1, numerator: 1 }),
  factPrecisionMinimum: Object.freeze({ denominator: 1, numerator: 1 }),
  factRecallMinimum: Object.freeze({ denominator: 1, numerator: 1 }),
  maximumQuarantineRate: Object.freeze({ denominator: 1, numerator: 0 }),
  maximumSilentCriticalFailures: 0,
  unitTolerancePolicy: "exact_canonical_unit.v1" as const,
});

export const PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS = Object.freeze({
  aggregateStringCodePoints: 262_144,
  assertionsPerFact: 2,
  documentDepth: 12,
  documentNodes: 8_192,
  documents: 2,
  factsPerDocument: 10,
  qualityPlanBytes: 65_536,
  ownerReviewedReferenceBytes: 262_144,
});

export const PERSONAL_FILING_QUALITY_MEASUREMENT_CHECKS = Object.freeze([
  "one_shot_open_candidate_committed_consumed_protocol_with_consuming_first_attempts",
  "owned_bounded_disjoint_plan_primary_source_and_raw_byte_snapshots",
  "exact_manifest_bound_one_or_two_document_personal_quality_population",
  "reference_digest_selection_rules_and_zero_tolerance_thresholds_bound_before_candidate_execution",
  "cycle2w_raw_extraction_agreement_and_cycle2u_normalized_candidate_projection_executed_internally",
  "commit_receives_reference_digest_only_and_no_reference_content_labels_or_expected_values",
  "reveal_requires_identity_bound_empty_frozen_single_use_capability_and_exact_reference_digest",
  "exact_ten_ordered_owner_reviewed_fact_labels_per_document_with_fcf_operand_contract",
  "semantic_value_presence_and_exact_unit_period_assertion_accounting",
  "caller_cannot_supply_counts_metrics_thresholds_weights_exclusions_or_outcomes",
  "integer_ratio_evaluation_with_zero_denominator_fail_closed",
  "valid_disagreement_or_explicit_pipeline_quarantine_is_evaluated_not_met",
  "immutable_aggregate_only_commit_and_evaluation_or_atomic_value_free_quarantine",
  "no_reference_fact_value_concept_coordinate_identifier_path_timestamp_or_diff_disclosure",
] as const);

export const PERSONAL_FILING_QUALITY_MEASUREMENT_NOT_PROVEN = Object.freeze([
  "authenticated_external_chronology_actual_reference_secrecy_blinding_or_label_leakage_absence",
  "owner_identity_independent_adjudication_or_owner_reviewed_label_correctness",
  "reference_digest_hiding_secrecy_salt_zero_knowledge_or_predictable_label_guess_resistance",
  "reference_set_representativeness_statistical_threshold_adequacy_or_generalization_beyond_exact_frozen_scope",
  "sec_authenticity_source_authority_or_complete_filing_provenance",
  "accounting_fact_free_cash_flow_or_taxonomy_truth_beyond_owner_reviewed_labels",
  "general_xbrl_ixbrl_html_taxonomy_alias_transform_dimension_unit_or_fiscal_calendar_coverage",
  "completeness_beyond_exact_labeled_launch_facts_additional_raw_coordinates_or_excluded_dimensional_semantics",
  "primary_parser_identity_source_binding_code_lineage_operator_host_process_failure_domain_or_runtime_independence",
  "absence_of_common_specification_error_coordinated_defects_collusion_or_malicious_code",
  "python_executable_identity_process_isolation_preflight_to_launch_atomicity_or_runtime_attestation",
  "amendment_discovery_global_currentness_or_absence_of_external_corrections",
  "database_api_web_queue_fetcher_or_running_application_composition",
  "multi_user_shared_service_commercial_redistributed_or_production_safety",
] as const);

export const PERSONAL_FILING_QUALITY_MEASUREMENT_QUARANTINE_CODES =
  Object.freeze(["protocol_quarantined", "measurement_quarantined"] as const);

export type PersonalFilingQualityMeasurementQuarantineCode =
  (typeof PERSONAL_FILING_QUALITY_MEASUREMENT_QUARANTINE_CODES)[number];

export type PersonalFilingQualityMeasurementFailedThreshold =
  | "document_success_minimum"
  | "fact_precision_minimum"
  | "fact_recall_minimum"
  | "maximum_quarantine_rate"
  | "maximum_silent_critical_failures"
  | "unit_date_tolerance";

declare const capabilityBrand: unique symbol;
export interface PersonalFilingQualityMeasurementCapability {
  readonly [capabilityBrand]: "personal-filing-quality-measurement-capability";
}

export interface PersonalFilingQualityMeasurementCommitInput extends PersonalFilingRawFactExtractionInput {
  readonly qualityPlan: Uint8Array;
}

export interface PersonalFilingQualityMeasurementAudit {
  readonly criticalAssertionCount: number;
  readonly documentCount: number;
  readonly emittedFactCount: number;
  readonly expectedFactCount: number;
  readonly outcome: "candidate_committed" | "evaluated" | "quarantined";
  readonly quarantinedDocumentCount: number;
  readonly succeededDocumentCount: number;
}

export interface PersonalFilingQualityMeasurementRatioMetric {
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

export interface PersonalFilingQualityMeasurementCounts {
  readonly conceptMismatchCount: number;
  readonly criticalAssertionCount: number;
  readonly documentCount: number;
  readonly emittedFactCount: number;
  readonly expectedFactCount: number;
  readonly falseNegativeFactCount: number;
  readonly falsePositiveFactCount: number;
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

export interface PersonalFilingQualityMeasurementMetrics {
  readonly documentSuccess: PersonalFilingQualityMeasurementRatioMetric;
  readonly factPrecision: PersonalFilingQualityMeasurementRatioMetric;
  readonly factRecall: PersonalFilingQualityMeasurementRatioMetric;
  readonly quarantineRate: PersonalFilingQualityMeasurementRatioMetric;
  readonly silentCriticalFailure: {
    readonly count: number;
    readonly denominator: number;
    readonly maximumCount: 0;
    readonly met: boolean;
  };
  readonly unitDateTolerance: {
    readonly dateToleranceDays: 0;
    readonly met: boolean;
    readonly periodMismatchCount: number;
    readonly unitMismatchCount: number;
    readonly unitTolerancePolicy: "exact_canonical_unit.v1";
  };
}

export interface PersonalFilingQualityMeasurementCommittedResult {
  readonly assurance: typeof PERSONAL_FILING_QUALITY_MEASUREMENT_ASSURANCE;
  readonly audit: PersonalFilingQualityMeasurementAudit;
  readonly candidateCommitmentSha256: `sha256:${string}`;
  readonly candidateObservationsSha256: `sha256:${string}`;
  readonly capability: PersonalFilingQualityMeasurementCapability;
  readonly claim: typeof PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM;
  readonly inputSetSha256: `sha256:${string}`;
  readonly ownerReviewedReferenceSha256: `sha256:${string}`;
  readonly qualityPlanSha256: `sha256:${string}`;
  readonly schemaVersion: typeof PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION;
  readonly status: "candidate_committed_for_personal_use";
  readonly synthetic: false;
}

export interface PersonalFilingQualityMeasurementEvaluatedResult {
  readonly assurance: typeof PERSONAL_FILING_QUALITY_MEASUREMENT_ASSURANCE;
  readonly audit: PersonalFilingQualityMeasurementAudit;
  readonly candidateCommitmentSha256: `sha256:${string}`;
  readonly candidateObservationsSha256: `sha256:${string}`;
  readonly claim: typeof PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM;
  readonly counts: PersonalFilingQualityMeasurementCounts;
  readonly evaluationSha256: `sha256:${string}`;
  readonly failedThresholds: readonly PersonalFilingQualityMeasurementFailedThreshold[];
  readonly inputSetSha256: `sha256:${string}`;
  readonly metrics: PersonalFilingQualityMeasurementMetrics;
  readonly ownerReviewedReferenceSha256: `sha256:${string}`;
  readonly personalQualityThresholdOutcome: "met" | "not_met";
  readonly qualityPlanSha256: `sha256:${string}`;
  readonly schemaVersion: typeof PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION;
  readonly status: "quality_evaluated_for_personal_use";
  readonly synthetic: false;
}

export interface PersonalFilingQualityMeasurementQuarantinedResult {
  readonly assurance: typeof PERSONAL_FILING_QUALITY_MEASUREMENT_ASSURANCE;
  readonly audit: PersonalFilingQualityMeasurementAudit;
  readonly bindings: readonly [];
  readonly claim: typeof PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM;
  readonly code: PersonalFilingQualityMeasurementQuarantineCode;
  readonly counts: readonly [];
  readonly metrics: readonly [];
  readonly schemaVersion: typeof PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: false;
}

export type PersonalFilingQualityMeasurementCommitResult =
  | PersonalFilingQualityMeasurementCommittedResult
  | PersonalFilingQualityMeasurementQuarantinedResult;
export type PersonalFilingQualityMeasurementRevealResult =
  | PersonalFilingQualityMeasurementEvaluatedResult
  | PersonalFilingQualityMeasurementQuarantinedResult;

export interface PersonalFilingQualityMeasurementProtocol {
  readonly commit: (
    input: PersonalFilingQualityMeasurementCommitInput,
  ) => PersonalFilingQualityMeasurementCommitResult;
  readonly reveal: (
    capability: unknown,
    ownerReviewedReference: unknown,
  ) => PersonalFilingQualityMeasurementRevealResult;
}

interface QualityDerivationOperand {
  readonly concept: string;
  readonly periodEnd: string;
  readonly periodStart: string;
  readonly unit: "USD";
  readonly value: string;
}

interface QualityDerivation {
  readonly formula: typeof PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA;
  readonly minuend: QualityDerivationOperand;
  readonly subtrahend: QualityDerivationOperand;
}

interface QualityFact {
  readonly derivation: QualityDerivation | null;
  readonly dimensions: Readonly<Record<string, never>>;
  readonly factKey: PersonalFilingFactKey;
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly sourceConcept: string | null;
  readonly unit: "USD" | "shares";
  readonly value: string;
}

interface SucceededCandidateDocument {
  readonly documentIndex: number;
  readonly facts: readonly QualityFact[];
  readonly rawDocumentSha256: `sha256:${string}`;
  readonly status: "succeeded";
}

interface QuarantinedCandidateDocument {
  readonly documentIndex: number;
  readonly facts: readonly [];
  readonly rawDocumentSha256: `sha256:${string}`;
  readonly status: "quarantined";
}

type CandidateDocument =
  QuarantinedCandidateDocument | SucceededCandidateDocument;

interface QualityPlan {
  readonly documentCount: number;
  readonly ownerReviewedReferenceSha256: `sha256:${string}`;
  readonly rawDocumentSha256s: readonly `sha256:${string}`[];
}

interface OwnerReviewedReference {
  readonly documents: readonly SucceededCandidateDocument[];
}

interface CommittedContext {
  readonly candidateCommitmentSha256: `sha256:${string}`;
  readonly candidateDocuments: readonly CandidateDocument[];
  readonly candidateObservationsSha256: `sha256:${string}`;
  readonly capability: PersonalFilingQualityMeasurementCapability;
  readonly inputSetSha256: `sha256:${string}`;
  readonly ownerReviewedReferenceSha256: `sha256:${string}`;
  readonly qualityPlanSha256: `sha256:${string}`;
}

interface InputSnapshot {
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
  readonly normalizationPlan: Uint8Array;
  readonly qualityPlan: Uint8Array;
  readonly rawFilingDocuments: readonly Uint8Array[];
  readonly sourceDocuments: readonly Uint8Array[];
}

interface SuppliedInputSnapshot extends InputSnapshot {
  readonly candidateObservations: Uint8Array;
}

interface SuppliedCandidateCommitInput extends PersonalFilingQualityMeasurementCommitInput {
  readonly candidateObservations: Uint8Array;
}

type ProtocolState = "candidate_committed" | "consumed" | "open";

class ProtocolFailure extends Error {
  public constructor() {
    super();
  }
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const QNAME = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}:[A-Za-z_][A-Za-z0-9_.-]{0,127}$/u;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const DECIMAL = /^(?:0|-?[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?$/u;
const PLAN_ROLE = "personal_quality_plan" as const;
const REFERENCE_ROLE = "owner_reviewed_reference" as const;
const REFERENCE_DECLARATION =
  "owner_reviewed_reference_not_independently_adjudicated" as const;
const SELECTION_RULE =
  "exact_manifest_order_all_source_documents_and_ten_fixed_launch_fact_keys.v1" as const;
const INPUT_KEYS = [
  "declaration",
  "manifest",
  "normalizationPlan",
  "qualityPlan",
  "rawFilingDocuments",
  "sourceDocuments",
] as const;
const SUPPLIED_INPUT_KEYS = [...INPUT_KEYS, "candidateObservations"] as const;
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
const INPUT_SET_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-filing-quality-input-set:v1\u0000",
);
const CANDIDATE_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-filing-quality-candidate:v1\u0000",
);
const COMMITMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-filing-quality-commitment:v1\u0000",
);
const EVALUATION_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-filing-quality-evaluation:v1\u0000",
);

export interface PersonalFilingQualitySuppliedCandidateTestProtocol {
  readonly commit: (
    input: SuppliedCandidateCommitInput,
  ) => PersonalFilingQualityMeasurementCommitResult;
  readonly reveal: (
    capability: unknown,
    ownerReviewedReference: unknown,
  ) => PersonalFilingQualityMeasurementRevealResult;
}

export function createPersonalFilingQualityMeasurementProtocol(): PersonalFilingQualityMeasurementProtocol {
  return createProtocol(arguments.length === 0, false);
}

/** @internal Test-only observation seam; deliberately not re-exported. */
export function createSuppliedPersonalFilingQualityMeasurementProtocolForTesting(): PersonalFilingQualitySuppliedCandidateTestProtocol {
  return createProtocol(arguments.length === 0, true);
}

function createProtocol(
  validFactoryCall: boolean,
  suppliedCandidate: false,
): PersonalFilingQualityMeasurementProtocol;
function createProtocol(
  validFactoryCall: boolean,
  suppliedCandidate: true,
): PersonalFilingQualitySuppliedCandidateTestProtocol;
function createProtocol(
  validFactoryCall: boolean,
  suppliedCandidate: boolean,
):
  | PersonalFilingQualityMeasurementProtocol
  | PersonalFilingQualitySuppliedCandidateTestProtocol {
  let state: ProtocolState = validFactoryCall ? "open" : "consumed";
  let context: CommittedContext | null = null;

  const consume = (): CommittedContext | null => {
    const current = context;
    state = "consumed";
    context = null;
    return current;
  };

  const commit = function (
    input:
      | PersonalFilingQualityMeasurementCommitInput
      | SuppliedCandidateCommitInput,
  ): PersonalFilingQualityMeasurementCommitResult {
    if (state !== "open") {
      consume();
      return quarantined("protocol_quarantined");
    }
    state = "consumed";
    try {
      if (arguments.length !== 1) fail();
      const snapshot = suppliedCandidate
        ? snapshotCommitInput(input, true)
        : snapshotCommitInput(input, false);
      const corpus = verifyPersonalFilingCorpusManifest({
        declaration: snapshot.declaration,
        manifest: snapshot.manifest,
      });
      const qualityPlanSha256 = sha256(snapshot.qualityPlan);
      const plan = validateQualityPlan(
        parseCanonicalDocument(snapshot.qualityPlan),
        snapshot,
        corpus.filingCount,
      );
      const inputSetSha256 = hashInputSet(snapshot);
      const candidateDocuments = suppliedCandidate
        ? validateSuppliedCandidate(
            parseCanonicalDocument(
              requiredSuppliedSnapshot(snapshot).candidateObservations,
            ),
            plan,
          )
        : deriveCandidateDocuments(snapshot, plan);
      const candidateBytes = new TextEncoder().encode(
        canonicalJson({ documents: candidateDocuments }),
      );
      const candidateObservationsSha256 = domainHash(
        CANDIDATE_DOMAIN,
        candidateBytes,
      );
      const candidateCommitmentSha256 = domainHash(
        COMMITMENT_DOMAIN,
        new TextEncoder().encode(
          canonicalJson({
            candidateObservationsSha256,
            inputSetSha256,
            ownerReviewedReferenceSha256: plan.ownerReviewedReferenceSha256,
            qualityPlanSha256,
          }),
        ),
      );
      const capability = Object.freeze(
        {},
      ) as PersonalFilingQualityMeasurementCapability;
      context = Object.freeze({
        candidateCommitmentSha256,
        candidateDocuments,
        candidateObservationsSha256,
        capability,
        inputSetSha256,
        ownerReviewedReferenceSha256: plan.ownerReviewedReferenceSha256,
        qualityPlanSha256,
      });
      state = "candidate_committed";
      return committed(context);
    } catch {
      consume();
      return quarantined("protocol_quarantined");
    }
  };

  const reveal = function (
    capability: unknown,
    ownerReviewedReference: unknown,
  ): PersonalFilingQualityMeasurementRevealResult {
    const committedContext = consume();
    if (
      state !== "consumed" ||
      committedContext === null ||
      arguments.length !== 2 ||
      capability !== committedContext.capability
    ) {
      return quarantined("protocol_quarantined");
    }
    try {
      const referenceSnapshot = byteSnapshot(
        ownerReviewedReference,
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.ownerReviewedReferenceBytes,
        new Set<object>(),
      );
      if (
        sha256(referenceSnapshot) !==
        committedContext.ownerReviewedReferenceSha256
      ) {
        fail();
      }
      const reference = validateOwnerReviewedReference(
        parseCanonicalDocument(referenceSnapshot),
        committedContext.candidateDocuments,
      );
      const counts = measure(reference, committedContext.candidateDocuments);
      return evaluated(committedContext, counts);
    } catch {
      return quarantined("measurement_quarantined");
    }
  };

  return Object.freeze({ commit, reveal });
}

function committed(
  context: CommittedContext,
): PersonalFilingQualityMeasurementCommittedResult {
  let succeededDocumentCount = 0;
  let quarantinedDocumentCount = 0;
  let emittedFactCount = 0;
  for (const document of context.candidateDocuments) {
    if (document.status === "succeeded") {
      succeededDocumentCount += 1;
      emittedFactCount += document.facts.length;
    } else {
      quarantinedDocumentCount += 1;
    }
  }
  return Object.freeze({
    assurance: PERSONAL_FILING_QUALITY_MEASUREMENT_ASSURANCE,
    audit: Object.freeze({
      criticalAssertionCount:
        context.candidateDocuments.length *
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument *
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.assertionsPerFact,
      documentCount: context.candidateDocuments.length,
      emittedFactCount,
      expectedFactCount:
        context.candidateDocuments.length *
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument,
      outcome: "candidate_committed" as const,
      quarantinedDocumentCount,
      succeededDocumentCount,
    }),
    candidateCommitmentSha256: context.candidateCommitmentSha256,
    candidateObservationsSha256: context.candidateObservationsSha256,
    capability: context.capability,
    claim: PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM,
    inputSetSha256: context.inputSetSha256,
    ownerReviewedReferenceSha256: context.ownerReviewedReferenceSha256,
    qualityPlanSha256: context.qualityPlanSha256,
    schemaVersion: PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    status: "candidate_committed_for_personal_use" as const,
    synthetic: false as const,
  });
}

function quarantined(
  code: PersonalFilingQualityMeasurementQuarantineCode,
): PersonalFilingQualityMeasurementQuarantinedResult {
  return Object.freeze({
    assurance: PERSONAL_FILING_QUALITY_MEASUREMENT_ASSURANCE,
    audit: Object.freeze({
      criticalAssertionCount: 0,
      documentCount: 0,
      emittedFactCount: 0,
      expectedFactCount: 0,
      outcome: "quarantined" as const,
      quarantinedDocumentCount: 0,
      succeededDocumentCount: 0,
    }),
    bindings: Object.freeze([] as const),
    claim: PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM,
    code,
    counts: Object.freeze([] as const),
    metrics: Object.freeze([] as const),
    schemaVersion: PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: false as const,
  });
}

function snapshotCommitInput(
  value: unknown,
  suppliedCandidate: false,
): InputSnapshot;
function snapshotCommitInput(
  value: unknown,
  suppliedCandidate: true,
): SuppliedInputSnapshot;
function snapshotCommitInput(
  value: unknown,
  suppliedCandidate: boolean,
): InputSnapshot | SuppliedInputSnapshot {
  try {
    if (isProxy(value)) fail();
    const keys = suppliedCandidate ? SUPPLIED_INPUT_KEYS : INPUT_KEYS;
    const descriptors = exactDataDescriptors(value, keys);
    if (descriptors === undefined) fail();
    const seenBuffers = new Set<object>();
    const base: InputSnapshot = Object.freeze({
      declaration: byteSnapshot(
        descriptors.declaration?.value,
        PERSONAL_FILING_CORPUS_LIMITS.declarationBytes,
        seenBuffers,
      ),
      manifest: byteSnapshot(
        descriptors.manifest?.value,
        PERSONAL_FILING_CORPUS_LIMITS.manifestBytes,
        seenBuffers,
      ),
      normalizationPlan: byteSnapshot(
        descriptors.normalizationPlan?.value,
        PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.normalizationPlanBytes,
        seenBuffers,
      ),
      qualityPlan: byteSnapshot(
        descriptors.qualityPlan?.value,
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.qualityPlanBytes,
        seenBuffers,
      ),
      rawFilingDocuments: snapshotDocumentArray(
        descriptors.rawFilingDocuments?.value,
        PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.rawFilingDocumentBytes,
        seenBuffers,
      ),
      sourceDocuments: snapshotDocumentArray(
        descriptors.sourceDocuments?.value,
        PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.parserResultBytes,
        seenBuffers,
      ),
    });
    if (!suppliedCandidate) return base;
    return Object.freeze({
      ...base,
      candidateObservations: byteSnapshot(
        descriptors.candidateObservations?.value,
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.ownerReviewedReferenceBytes,
        seenBuffers,
      ),
    });
  } catch (error) {
    if (error instanceof ProtocolFailure) throw error;
    fail();
  }
}

function requiredSuppliedSnapshot(
  snapshot: InputSnapshot | SuppliedInputSnapshot,
): SuppliedInputSnapshot {
  if (!("candidateObservations" in snapshot)) fail();
  return snapshot;
}

function snapshotDocumentArray(
  value: unknown,
  maximumBytes: number,
  seenBuffers: Set<object>,
): readonly Uint8Array[] {
  if (
    !Array.isArray(value) ||
    isProxy(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length < 1 ||
    value.length > PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.documents
  ) {
    fail();
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const expectedKeys = [
    ...Array.from({ length: value.length }, (_, index) => String(index)),
    "length",
  ].sort();
  const ownKeys = Reflect.ownKeys(descriptors);
  if (
    ownKeys.some((key) => typeof key !== "string") ||
    (ownKeys as string[])
      .sort()
      .some((key, index) => key !== expectedKeys[index]) ||
    ownKeys.length !== expectedKeys.length
  ) {
    fail();
  }
  const snapshots: Uint8Array[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    ) {
      fail();
    }
    snapshots.push(byteSnapshot(descriptor.value, maximumBytes, seenBuffers));
  }
  return Object.freeze(snapshots);
}

function byteSnapshot(
  value: unknown,
  maximumBytes: number,
  seenBuffers: Set<object>,
): Uint8Array {
  try {
    if (typeof value !== "object" || value === null || isProxy(value)) fail();
    const tag = TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR?.get?.call(
      value,
    ) as unknown;
    const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(value) as unknown;
    const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      value,
    ) as unknown;
    const backingByteLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      buffer,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      typeof byteLength !== "number" ||
      typeof backingByteLength !== "number" ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype ||
      byteLength < 1 ||
      byteLength > maximumBytes ||
      seenBuffers.has(buffer as object)
    ) {
      fail();
    }
    seenBuffers.add(buffer as object);
    const snapshot = new Uint8Array(byteLength);
    Uint8Array.prototype.set.call(snapshot, value as Uint8Array);
    return snapshot;
  } catch (error) {
    if (error instanceof ProtocolFailure) throw error;
    fail();
  }
}

function exactDataDescriptors(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, PropertyDescriptor> | undefined {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (ownKeys.some((key) => typeof key !== "string")) return undefined;
    const actualKeys = (ownKeys as string[]).sort();
    const expected = [...expectedKeys].sort();
    if (
      actualKeys.length !== expected.length ||
      actualKeys.some((key, index) => key !== expected[index])
    ) {
      return undefined;
    }
    for (const key of expected) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      ) {
        return undefined;
      }
    }
    return descriptors;
  } catch {
    return undefined;
  }
}

function parseCanonicalDocument(bytes: Uint8Array): unknown {
  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    const parsed: unknown = JSON.parse(text);
    validateCanonicalTree(parsed);
    if (`${canonicalJson(parsed)}\n` !== text) fail();
    return parsed;
  } catch (error) {
    if (error instanceof ProtocolFailure) throw error;
    fail();
  }
}

function validateCanonicalTree(root: unknown): void {
  const stack: Array<{ readonly depth: number; readonly value: unknown }> = [
    { depth: 0, value: root },
  ];
  let nodes = 0;
  let stringCodePoints = 0;
  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry === undefined) fail();
    nodes += 1;
    if (
      nodes > PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.documentNodes ||
      entry.depth > PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.documentDepth
    ) {
      fail();
    }
    const value = entry.value;
    if (typeof value === "string") {
      stringCodePoints += [...value].length;
      if (
        stringCodePoints >
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.aggregateStringCodePoints
      ) {
        fail();
      }
      continue;
    }
    if (
      value === null ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isSafeInteger(value))
    ) {
      continue;
    }
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ depth: entry.depth + 1, value: value[index] });
      }
      continue;
    }
    if (
      typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      for (const child of Object.values(value).reverse()) {
        stack.push({ depth: entry.depth + 1, value: child });
      }
      continue;
    }
    fail();
  }
}

function validateQualityPlan(
  value: unknown,
  snapshot: InputSnapshot,
  corpusFilingCount: number,
): QualityPlan {
  const plan = exactRecord(value, [
    "assertionKinds",
    "documentCount",
    "documentRole",
    "factCount",
    "factKeys",
    "manifestSha256",
    "metrics",
    "normalizationPlanSha256",
    "ownerReviewedReferenceSha256",
    "profile",
    "rawDocumentSha256s",
    "schemaVersion",
    "selectionRule",
    "synthetic",
    "thresholds",
  ]);
  const thresholds = exactRecord(plan.thresholds, [
    "dateToleranceDays",
    "documentSuccessMinimum",
    "factPrecisionMinimum",
    "factRecallMinimum",
    "maximumQuarantineRate",
    "maximumSilentCriticalFailures",
    "unitTolerancePolicy",
  ]);
  const declaredRawDocumentSha256s = unknownArray(plan.rawDocumentSha256s);
  if (
    plan.schemaVersion !== PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION ||
    plan.documentRole !== PLAN_ROLE ||
    plan.profile !== PERSONAL_FILING_CORPUS_PROFILE ||
    plan.synthetic !== false ||
    plan.selectionRule !== SELECTION_RULE ||
    plan.manifestSha256 !== sha256(snapshot.manifest) ||
    plan.normalizationPlanSha256 !== sha256(snapshot.normalizationPlan) ||
    typeof plan.ownerReviewedReferenceSha256 !== "string" ||
    !HASH.test(plan.ownerReviewedReferenceSha256) ||
    !Number.isSafeInteger(plan.documentCount) ||
    plan.documentCount !== corpusFilingCount ||
    plan.documentCount !== snapshot.rawFilingDocuments.length ||
    plan.documentCount !== snapshot.sourceDocuments.length ||
    plan.documentCount < 1 ||
    plan.documentCount > PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.documents ||
    plan.factCount !==
      plan.documentCount *
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument ||
    !exactArray(plan.factKeys, PERSONAL_FILING_FACT_KEYS) ||
    !exactArray(
      plan.assertionKinds,
      PERSONAL_FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS,
    ) ||
    !exactArray(plan.metrics, PERSONAL_FILING_QUALITY_MEASUREMENT_METRICS) ||
    thresholds.documentSuccessMinimum !== "1.0" ||
    thresholds.factPrecisionMinimum !== "1.0" ||
    thresholds.factRecallMinimum !== "1.0" ||
    thresholds.maximumQuarantineRate !== "0.0" ||
    thresholds.maximumSilentCriticalFailures !== 0 ||
    thresholds.unitTolerancePolicy !== "exact_canonical_unit.v1" ||
    thresholds.dateToleranceDays !== 0 ||
    declaredRawDocumentSha256s.length !== plan.documentCount
  ) {
    fail();
  }
  const rawDocumentSha256s: `sha256:${string}`[] = [];
  for (let index = 0; index < plan.documentCount; index += 1) {
    const declared = declaredRawDocumentSha256s[index];
    const raw = snapshot.rawFilingDocuments[index];
    if (
      typeof declared !== "string" ||
      !HASH.test(declared) ||
      raw === undefined ||
      declared !== sha256(raw)
    ) {
      fail();
    }
    rawDocumentSha256s.push(declared);
  }
  return Object.freeze({
    documentCount: plan.documentCount,
    ownerReviewedReferenceSha256:
      plan.ownerReviewedReferenceSha256 as `sha256:${string}`,
    rawDocumentSha256s: Object.freeze(rawDocumentSha256s),
  });
}

function unknownArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) fail();
  return value as unknown[];
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
): Record<TKeys[number], unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail();
  }
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actualKeys.length !== expected.length ||
    actualKeys.some((key, index) => key !== expected[index])
  ) {
    fail();
  }
  return value as Record<TKeys[number], unknown>;
}

function deriveCandidateDocuments(
  snapshot: InputSnapshot,
  plan: QualityPlan,
): readonly CandidateDocument[] {
  const rawInput = Object.freeze({
    declaration: snapshot.declaration,
    manifest: snapshot.manifest,
    normalizationPlan: snapshot.normalizationPlan,
    rawFilingDocuments: snapshot.rawFilingDocuments,
    sourceDocuments: snapshot.sourceDocuments,
  });
  const extraction = comparePersonalFilingRawFactExtraction(rawInput);
  if (extraction.status !== "raw_extraction_agreed_for_personal_use") {
    return quarantinedCandidateDocuments(plan);
  }
  const normalization = normalizePersonalFilingFacts({
    declaration: snapshot.declaration,
    manifest: snapshot.manifest,
    normalizationPlan: snapshot.normalizationPlan,
    sourceDocuments: snapshot.sourceDocuments,
  });
  if (normalization.status !== "normalized_for_personal_use") {
    return quarantinedCandidateDocuments(plan);
  }
  if (
    normalization.factVersions.length !==
    plan.documentCount *
      PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument
  ) {
    return quarantinedCandidateDocuments(plan);
  }
  try {
    const documents: SucceededCandidateDocument[] = [];
    for (
      let documentIndex = 0;
      documentIndex < plan.documentCount;
      documentIndex += 1
    ) {
      const rawDocumentSha256 = plan.rawDocumentSha256s[documentIndex];
      if (rawDocumentSha256 === undefined) fail();
      const start =
        documentIndex *
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument;
      const versions = normalization.factVersions.slice(
        start,
        start + PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument,
      );
      if (
        versions.length !==
          PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument ||
        versions.some(
          (version, index) =>
            version.key !== PERSONAL_FILING_FACT_KEYS[index] ||
            version.sourceContentSha256 !== rawDocumentSha256,
        )
      ) {
        fail();
      }
      documents.push(
        Object.freeze({
          documentIndex,
          facts: Object.freeze(versions.map(projectQualityFact)),
          rawDocumentSha256,
          status: "succeeded" as const,
        }),
      );
    }
    return Object.freeze(documents);
  } catch {
    return quarantinedCandidateDocuments(plan);
  }
}

function quarantinedCandidateDocuments(
  plan: QualityPlan,
): readonly QuarantinedCandidateDocument[] {
  return Object.freeze(
    plan.rawDocumentSha256s.map((rawDocumentSha256, documentIndex) =>
      Object.freeze({
        documentIndex,
        facts: Object.freeze([] as const),
        rawDocumentSha256,
        status: "quarantined" as const,
      }),
    ),
  );
}

function projectQualityFact(
  version: PersonalNormalizedFilingFactVersion,
): QualityFact {
  return Object.freeze({
    derivation: projectDerivation(version.derivation),
    dimensions: Object.freeze({}),
    factKey: version.key,
    periodEnd: version.periodEnd,
    periodStart: version.periodStart,
    sourceConcept: version.sourceConcept,
    unit: version.unit,
    value: version.value,
  });
}

function projectDerivation(
  derivation: PersonalFilingFactSubtractionDerivation | null,
): QualityDerivation | null {
  if (derivation === null) return null;
  return Object.freeze({
    formula: derivation.formula,
    minuend: projectDerivationOperand(derivation.minuend),
    subtrahend: projectDerivationOperand(derivation.subtrahend),
  });
}

function projectDerivationOperand(
  operand: PersonalFilingFactSubtractionDerivation["minuend"],
): QualityDerivationOperand {
  return Object.freeze({
    concept: operand.concept,
    periodEnd: operand.periodEnd,
    periodStart: operand.periodStart,
    unit: operand.unit,
    value: operand.value,
  });
}

function validateSuppliedCandidate(
  value: unknown,
  plan: QualityPlan,
): readonly CandidateDocument[] {
  const root = exactRecord(value, ["documents", "schemaVersion", "status"]);
  if (
    root.schemaVersion !== PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION ||
    root.status !== "candidate_observations_for_testing_only" ||
    !Array.isArray(root.documents) ||
    root.documents.length !== plan.documentCount
  ) {
    fail();
  }
  const documents: CandidateDocument[] = [];
  for (let index = 0; index < root.documents.length; index += 1) {
    const expectedSha256 = plan.rawDocumentSha256s[index];
    if (expectedSha256 === undefined) fail();
    documents.push(
      validateCandidateDocument(root.documents[index], index, expectedSha256),
    );
  }
  return Object.freeze(documents);
}

function validateCandidateDocument(
  value: unknown,
  expectedIndex: number,
  expectedSha256: `sha256:${string}`,
): CandidateDocument {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    fail();
  const status = (value as Record<string, unknown>).status;
  if (status === "quarantined") {
    const document = exactRecord(value, [
      "documentIndex",
      "facts",
      "rawDocumentSha256",
      "status",
    ]);
    if (
      document.documentIndex !== expectedIndex ||
      document.rawDocumentSha256 !== expectedSha256 ||
      !Array.isArray(document.facts) ||
      document.facts.length !== 0
    ) {
      fail();
    }
    return Object.freeze({
      documentIndex: expectedIndex,
      facts: Object.freeze([] as const),
      rawDocumentSha256: expectedSha256,
      status: "quarantined" as const,
    });
  }
  if (status !== "succeeded") fail();
  const document = exactRecord(value, [
    "documentIndex",
    "facts",
    "rawDocumentSha256",
    "status",
  ]);
  if (
    document.documentIndex !== expectedIndex ||
    document.rawDocumentSha256 !== expectedSha256 ||
    !Array.isArray(document.facts) ||
    document.facts.length >
      PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument
  ) {
    fail();
  }
  const facts: QualityFact[] = [];
  let previousIndex = -1;
  for (const rawFact of document.facts) {
    const fact = validateQualityFact(rawFact, false);
    const keyIndex = PERSONAL_FILING_FACT_KEYS.indexOf(fact.factKey);
    if (keyIndex <= previousIndex) fail();
    facts.push(fact);
    previousIndex = keyIndex;
  }
  return Object.freeze({
    documentIndex: expectedIndex,
    facts: Object.freeze(facts),
    rawDocumentSha256: expectedSha256,
    status: "succeeded" as const,
  });
}

function validateOwnerReviewedReference(
  value: unknown,
  candidateDocuments: readonly CandidateDocument[],
): OwnerReviewedReference {
  const reference = exactRecord(value, [
    "documentCount",
    "documentRole",
    "documents",
    "factCount",
    "profile",
    "referenceDeclaration",
    "schemaVersion",
    "synthetic",
  ]);
  if (
    reference.schemaVersion !==
      PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION ||
    reference.profile !== PERSONAL_FILING_CORPUS_PROFILE ||
    reference.synthetic !== false ||
    reference.documentRole !== REFERENCE_ROLE ||
    reference.referenceDeclaration !== REFERENCE_DECLARATION ||
    reference.documentCount !== candidateDocuments.length ||
    reference.factCount !==
      candidateDocuments.length *
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument ||
    !Array.isArray(reference.documents) ||
    reference.documents.length !== candidateDocuments.length
  ) {
    fail();
  }
  const documents: SucceededCandidateDocument[] = [];
  for (let index = 0; index < reference.documents.length; index += 1) {
    const candidate = candidateDocuments[index];
    if (candidate === undefined) fail();
    const document = validateCandidateDocument(
      reference.documents[index],
      index,
      candidate.rawDocumentSha256,
    );
    if (
      document.status !== "succeeded" ||
      document.facts.length !==
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument
    ) {
      fail();
    }
    validateReferenceFactSet(document.facts);
    documents.push(document);
  }
  return Object.freeze({ documents: Object.freeze(documents) });
}

function validateReferenceFactSet(facts: readonly QualityFact[]): void {
  const directConcepts = new Set<string>();
  for (let index = 0; index < PERSONAL_FILING_FACT_KEYS.length; index += 1) {
    const expectedKey = PERSONAL_FILING_FACT_KEYS[index];
    const fact = facts[index];
    const contract = PERSONAL_FILING_FACT_CONTRACTS[index];
    if (
      fact === undefined ||
      contract === undefined ||
      fact.factKey !== expectedKey ||
      fact.unit !== contract.unit ||
      (contract.periodKind === "instant") !== (fact.periodStart === null)
    ) {
      fail();
    }
    if (fact.factKey !== "free_cash_flow") {
      if (
        fact.sourceConcept === null ||
        fact.derivation !== null ||
        directConcepts.has(fact.sourceConcept)
      ) {
        fail();
      }
      directConcepts.add(fact.sourceConcept);
    }
  }
  const freeCashFlow = facts.find((fact) => fact.factKey === "free_cash_flow");
  const operatingCashFlow = facts.find(
    (fact) => fact.factKey === "operating_cash_flow",
  );
  if (
    freeCashFlow === undefined ||
    operatingCashFlow === undefined ||
    freeCashFlow.sourceConcept !== null ||
    freeCashFlow.derivation === null ||
    operatingCashFlow.sourceConcept === null ||
    freeCashFlow.derivation.minuend.concept !==
      operatingCashFlow.sourceConcept ||
    freeCashFlow.derivation.minuend.value !== operatingCashFlow.value ||
    freeCashFlow.derivation.minuend.periodStart !==
      operatingCashFlow.periodStart ||
    freeCashFlow.derivation.minuend.periodEnd !== operatingCashFlow.periodEnd ||
    freeCashFlow.derivation.minuend.unit !== operatingCashFlow.unit ||
    freeCashFlow.periodStart !== operatingCashFlow.periodStart ||
    freeCashFlow.periodEnd !== operatingCashFlow.periodEnd ||
    freeCashFlow.derivation.subtrahend.periodStart !==
      freeCashFlow.periodStart ||
    freeCashFlow.derivation.subtrahend.periodEnd !== freeCashFlow.periodEnd ||
    freeCashFlow.derivation.subtrahend.unit !== freeCashFlow.unit ||
    directConcepts.has(freeCashFlow.derivation.subtrahend.concept) ||
    subtractCanonicalDecimals(
      freeCashFlow.derivation.minuend.value,
      freeCashFlow.derivation.subtrahend.value,
    ) !== freeCashFlow.value
  ) {
    fail();
  }
}

function validateQualityFact(value: unknown, reference: boolean): QualityFact {
  const fact = exactRecord(value, [
    "derivation",
    "dimensions",
    "factKey",
    "periodEnd",
    "periodStart",
    "sourceConcept",
    "unit",
    "value",
  ]);
  if (
    typeof fact.factKey !== "string" ||
    !isFactKey(fact.factKey) ||
    typeof fact.value !== "string" ||
    !DECIMAL.test(fact.value) ||
    (fact.unit !== "USD" && fact.unit !== "shares") ||
    typeof fact.periodEnd !== "string" ||
    !isGregorianDate(fact.periodEnd) ||
    (fact.periodStart !== null &&
      (typeof fact.periodStart !== "string" ||
        !isGregorianDate(fact.periodStart))) ||
    (typeof fact.periodStart === "string" &&
      fact.periodStart >= fact.periodEnd) ||
    !isEmptyRecord(fact.dimensions)
  ) {
    fail();
  }
  const isDerived = fact.factKey === "free_cash_flow";
  if (
    isDerived !== (fact.derivation !== null) ||
    isDerived !== (fact.sourceConcept === null) ||
    (!isDerived &&
      (typeof fact.sourceConcept !== "string" ||
        !QNAME.test(fact.sourceConcept)))
  ) {
    fail();
  }
  const derivation = isDerived
    ? validateQualityDerivation(fact.derivation)
    : null;
  const result = Object.freeze({
    derivation,
    dimensions: Object.freeze({}),
    factKey: fact.factKey,
    periodEnd: fact.periodEnd,
    periodStart: fact.periodStart,
    sourceConcept: fact.sourceConcept as string | null,
    unit: fact.unit,
    value: fact.value,
  });
  if (reference) {
    const contract = PERSONAL_FILING_FACT_CONTRACTS.find(
      (candidate) => candidate.key === result.factKey,
    );
    if (
      contract === undefined ||
      result.unit !== contract.unit ||
      (contract.periodKind === "instant") !== (result.periodStart === null)
    ) {
      fail();
    }
  }
  return result;
}

function validateQualityDerivation(value: unknown): QualityDerivation {
  const derivation = exactRecord(value, ["formula", "minuend", "subtrahend"]);
  if (derivation.formula !== PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA) {
    fail();
  }
  return Object.freeze({
    formula: PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA,
    minuend: validateQualityDerivationOperand(derivation.minuend),
    subtrahend: validateQualityDerivationOperand(derivation.subtrahend),
  });
}

function validateQualityDerivationOperand(
  value: unknown,
): QualityDerivationOperand {
  const operand = exactRecord(value, [
    "concept",
    "periodEnd",
    "periodStart",
    "unit",
    "value",
  ]);
  if (
    typeof operand.concept !== "string" ||
    !QNAME.test(operand.concept) ||
    typeof operand.periodStart !== "string" ||
    !isGregorianDate(operand.periodStart) ||
    typeof operand.periodEnd !== "string" ||
    !isGregorianDate(operand.periodEnd) ||
    operand.periodStart >= operand.periodEnd ||
    operand.unit !== "USD" ||
    typeof operand.value !== "string" ||
    !DECIMAL.test(operand.value)
  ) {
    fail();
  }
  return Object.freeze({
    concept: operand.concept,
    periodEnd: operand.periodEnd,
    periodStart: operand.periodStart,
    unit: "USD" as const,
    value: operand.value,
  });
}

function isFactKey(value: string): value is PersonalFilingFactKey {
  return (PERSONAL_FILING_FACT_KEYS as readonly string[]).includes(value);
}

function isEmptyRecord(value: unknown): value is Record<string, never> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === 0
  );
}

function isGregorianDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [
    31,
    leap ? 29 : 28,
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
  return day <= (monthDays[month - 1] ?? 0);
}

function subtractCanonicalDecimals(
  minuend: string,
  subtrahend: string,
): string {
  const first = decimalParts(minuend);
  const second = decimalParts(subtrahend);
  const scale = Math.max(first.scale, second.scale);
  const difference =
    first.coefficient * 10n ** BigInt(scale - first.scale) -
    second.coefficient * 10n ** BigInt(scale - second.scale);
  return canonicalDecimal(difference, scale);
}

function decimalParts(value: string): {
  readonly coefficient: bigint;
  readonly scale: number;
} {
  if (!DECIMAL.test(value)) fail();
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction = ""] = unsigned.split(".");
  const coefficient = BigInt(`${negative ? "-" : ""}${integer}${fraction}`);
  return { coefficient, scale: fraction.length };
}

function canonicalDecimal(coefficient: bigint, scale: number): string {
  if (coefficient === 0n) return "0";
  const negative = coefficient < 0n;
  let digits = (negative ? -coefficient : coefficient).toString();
  if (scale > 0) digits = digits.padStart(scale + 1, "0");
  const split = digits.length - scale;
  const integer = digits.slice(0, split);
  let fraction = scale === 0 ? "" : digits.slice(split);
  fraction = fraction.replace(/0+$/u, "");
  return `${negative ? "-" : ""}${integer}${fraction === "" ? "" : `.${fraction}`}`;
}

function measure(
  reference: OwnerReviewedReference,
  candidateDocuments: readonly CandidateDocument[],
): PersonalFilingQualityMeasurementCounts {
  let conceptMismatchCount = 0;
  let emittedFactCount = 0;
  let missingFactCount = 0;
  let periodMismatchCount = 0;
  let quarantinedDocumentCount = 0;
  let semanticAssertionPassCount = 0;
  let silentCriticalFailureCount = 0;
  let succeededDocumentCount = 0;
  let truePositiveFactCount = 0;
  let unitMismatchCount = 0;
  let unitPeriodAssertionPassCount = 0;
  let valueMismatchCount = 0;

  for (let index = 0; index < reference.documents.length; index += 1) {
    const expectedDocument = reference.documents[index];
    const candidateDocument = candidateDocuments[index];
    if (expectedDocument === undefined || candidateDocument === undefined)
      fail();
    if (candidateDocument.status === "quarantined") {
      quarantinedDocumentCount += 1;
      missingFactCount +=
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument;
      continue;
    }
    succeededDocumentCount += 1;
    emittedFactCount += candidateDocument.facts.length;
    const candidatesByKey = new Map(
      candidateDocument.facts.map((fact) => [fact.factKey, fact]),
    );
    for (const expected of expectedDocument.facts) {
      const candidate = candidatesByKey.get(expected.factKey);
      if (candidate === undefined) {
        missingFactCount += 1;
        silentCriticalFailureCount +=
          PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.assertionsPerFact;
        continue;
      }
      const conceptMatches = qualityConceptsMatch(candidate, expected);
      const valueMatches = qualityValuesMatch(candidate, expected);
      const unitMatches = qualityUnitsMatch(candidate, expected);
      const periodMatches = qualityPeriodsMatch(candidate, expected);
      const semanticMatches = conceptMatches && valueMatches;
      const unitPeriodMatches = unitMatches && periodMatches;
      if (!conceptMatches) conceptMismatchCount += 1;
      if (!valueMatches) valueMismatchCount += 1;
      if (!unitMatches) unitMismatchCount += 1;
      if (!periodMatches) periodMismatchCount += 1;
      if (semanticMatches) semanticAssertionPassCount += 1;
      else silentCriticalFailureCount += 1;
      if (unitPeriodMatches) unitPeriodAssertionPassCount += 1;
      else silentCriticalFailureCount += 1;
      if (semanticMatches && unitPeriodMatches) truePositiveFactCount += 1;
    }
  }
  const documentCount = reference.documents.length;
  const expectedFactCount =
    documentCount * PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument;
  return Object.freeze({
    conceptMismatchCount,
    criticalAssertionCount:
      expectedFactCount *
      PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.assertionsPerFact,
    documentCount,
    emittedFactCount,
    expectedFactCount,
    falseNegativeFactCount: expectedFactCount - truePositiveFactCount,
    falsePositiveFactCount: emittedFactCount - truePositiveFactCount,
    missingFactCount,
    periodMismatchCount,
    quarantinedDocumentCount,
    semanticAssertionPassCount,
    silentCriticalFailureCount,
    succeededDocumentCount,
    truePositiveFactCount,
    unitMismatchCount,
    unitPeriodAssertionPassCount,
    valueMismatchCount,
  });
}

function qualityConceptsMatch(
  first: QualityFact,
  second: QualityFact,
): boolean {
  if (first.sourceConcept !== second.sourceConcept) return false;
  if (first.derivation === null || second.derivation === null)
    return first.derivation === second.derivation;
  return (
    first.derivation.formula === second.derivation.formula &&
    first.derivation.minuend.concept === second.derivation.minuend.concept &&
    first.derivation.subtrahend.concept === second.derivation.subtrahend.concept
  );
}

function qualityValuesMatch(first: QualityFact, second: QualityFact): boolean {
  if (first.value !== second.value) return false;
  if (first.derivation === null || second.derivation === null)
    return first.derivation === second.derivation;
  return (
    first.derivation.minuend.value === second.derivation.minuend.value &&
    first.derivation.subtrahend.value === second.derivation.subtrahend.value
  );
}

function qualityUnitsMatch(first: QualityFact, second: QualityFact): boolean {
  if (first.unit !== second.unit) return false;
  if (first.derivation === null || second.derivation === null)
    return first.derivation === second.derivation;
  return (
    first.derivation.minuend.unit === second.derivation.minuend.unit &&
    first.derivation.subtrahend.unit === second.derivation.subtrahend.unit
  );
}

function qualityPeriodsMatch(first: QualityFact, second: QualityFact): boolean {
  if (
    first.periodStart !== second.periodStart ||
    first.periodEnd !== second.periodEnd
  ) {
    return false;
  }
  if (first.derivation === null || second.derivation === null)
    return first.derivation === second.derivation;
  return (
    first.derivation.minuend.periodStart ===
      second.derivation.minuend.periodStart &&
    first.derivation.minuend.periodEnd ===
      second.derivation.minuend.periodEnd &&
    first.derivation.subtrahend.periodStart ===
      second.derivation.subtrahend.periodStart &&
    first.derivation.subtrahend.periodEnd ===
      second.derivation.subtrahend.periodEnd
  );
}

function evaluated(
  context: CommittedContext,
  counts: PersonalFilingQualityMeasurementCounts,
): PersonalFilingQualityMeasurementEvaluatedResult {
  const documentSuccess = ratioMetric(
    counts.succeededDocumentCount,
    counts.documentCount,
    PERSONAL_FILING_QUALITY_MEASUREMENT_THRESHOLDS.documentSuccessMinimum,
    "minimum",
  );
  const factPrecision = ratioMetric(
    counts.truePositiveFactCount,
    counts.emittedFactCount,
    PERSONAL_FILING_QUALITY_MEASUREMENT_THRESHOLDS.factPrecisionMinimum,
    "minimum",
  );
  const factRecall = ratioMetric(
    counts.truePositiveFactCount,
    counts.expectedFactCount,
    PERSONAL_FILING_QUALITY_MEASUREMENT_THRESHOLDS.factRecallMinimum,
    "minimum",
  );
  const quarantineRate = ratioMetric(
    counts.quarantinedDocumentCount,
    counts.documentCount,
    PERSONAL_FILING_QUALITY_MEASUREMENT_THRESHOLDS.maximumQuarantineRate,
    "maximum",
  );
  const silentCriticalFailure = Object.freeze({
    count: counts.silentCriticalFailureCount,
    denominator: counts.criticalAssertionCount,
    maximumCount: 0 as const,
    met:
      counts.silentCriticalFailureCount <=
      PERSONAL_FILING_QUALITY_MEASUREMENT_THRESHOLDS.maximumSilentCriticalFailures,
  });
  const unitDateTolerance = Object.freeze({
    dateToleranceDays: 0 as const,
    met: counts.unitMismatchCount === 0 && counts.periodMismatchCount === 0,
    periodMismatchCount: counts.periodMismatchCount,
    unitMismatchCount: counts.unitMismatchCount,
    unitTolerancePolicy: "exact_canonical_unit.v1" as const,
  });
  const metrics: PersonalFilingQualityMeasurementMetrics = Object.freeze({
    documentSuccess,
    factPrecision,
    factRecall,
    quarantineRate,
    silentCriticalFailure,
    unitDateTolerance,
  });
  const failedThresholds: PersonalFilingQualityMeasurementFailedThreshold[] =
    [];
  if (!documentSuccess.met) failedThresholds.push("document_success_minimum");
  if (!factPrecision.met) failedThresholds.push("fact_precision_minimum");
  if (!factRecall.met) failedThresholds.push("fact_recall_minimum");
  if (!quarantineRate.met) failedThresholds.push("maximum_quarantine_rate");
  if (!silentCriticalFailure.met)
    failedThresholds.push("maximum_silent_critical_failures");
  if (!unitDateTolerance.met) failedThresholds.push("unit_date_tolerance");
  const frozenFailedThresholds = Object.freeze(failedThresholds);
  const personalQualityThresholdOutcome =
    frozenFailedThresholds.length === 0 ? "met" : "not_met";
  const evaluationSha256 = domainHash(
    EVALUATION_DOMAIN,
    new TextEncoder().encode(
      canonicalJson({
        candidateCommitmentSha256: context.candidateCommitmentSha256,
        counts,
        failedThresholds: frozenFailedThresholds,
        personalQualityThresholdOutcome,
      }),
    ),
  );
  return Object.freeze({
    assurance: PERSONAL_FILING_QUALITY_MEASUREMENT_ASSURANCE,
    audit: Object.freeze({
      criticalAssertionCount: counts.criticalAssertionCount,
      documentCount: counts.documentCount,
      emittedFactCount: counts.emittedFactCount,
      expectedFactCount: counts.expectedFactCount,
      outcome: "evaluated" as const,
      quarantinedDocumentCount: counts.quarantinedDocumentCount,
      succeededDocumentCount: counts.succeededDocumentCount,
    }),
    candidateCommitmentSha256: context.candidateCommitmentSha256,
    candidateObservationsSha256: context.candidateObservationsSha256,
    claim: PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM,
    counts,
    evaluationSha256,
    failedThresholds: frozenFailedThresholds,
    inputSetSha256: context.inputSetSha256,
    metrics,
    ownerReviewedReferenceSha256: context.ownerReviewedReferenceSha256,
    personalQualityThresholdOutcome,
    qualityPlanSha256: context.qualityPlanSha256,
    schemaVersion: PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    status: "quality_evaluated_for_personal_use" as const,
    synthetic: false as const,
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
): PersonalFilingQualityMeasurementRatioMetric {
  const defined = denominator !== 0;
  const met =
    defined &&
    (thresholdKind === "minimum"
      ? BigInt(numerator) * BigInt(threshold.denominator) >=
        BigInt(threshold.numerator) * BigInt(denominator)
      : BigInt(numerator) * BigInt(threshold.denominator) <=
        BigInt(threshold.numerator) * BigInt(denominator));
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

function hashInputSet(snapshot: InputSnapshot): `sha256:${string}` {
  return domainHash(
    INPUT_SET_DOMAIN,
    new TextEncoder().encode(
      canonicalJson({
        declarationSha256: sha256(snapshot.declaration),
        manifestSha256: sha256(snapshot.manifest),
        normalizationPlanSha256: sha256(snapshot.normalizationPlan),
        qualityPlanSha256: sha256(snapshot.qualityPlan),
        rawFilingDocumentSha256s: snapshot.rawFilingDocuments.map(sha256),
        sourceDocumentSha256s: snapshot.sourceDocuments.map(sha256),
      }),
    ),
  );
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function domainHash(domain: Uint8Array, bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(domain).update(bytes).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail();
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail();
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function fail(): never {
  throw new ProtocolFailure();
}
