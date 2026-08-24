import { createHash } from "node:crypto";

import {
  FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS,
  FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES,
  FILING_QUALITY_MEASUREMENT_CLAIM,
  FILING_QUALITY_MEASUREMENT_DECLARATIONS,
  FILING_QUALITY_MEASUREMENT_FACT_KEYS,
  FILING_QUALITY_MEASUREMENT_LIMITS,
  FILING_QUALITY_MEASUREMENT_METRICS,
  FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
  FILING_QUALITY_MEASUREMENT_THRESHOLDS,
  measureSyntheticFilingQuality,
  type FilingQualityMeasurementDeclaration,
  type FilingQualityMeasurementEvaluatedResult,
} from "@research-cockpit/filing-quality-measurement";

export const FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION = "1.0.0" as const;
export const FILING_QUALITY_PRECOMMITMENT_CLAIM =
  "bounded_synthetic_in_process_one_shot_candidate_observation_commit_before_declared_reference_reveal_and_fail_closed_quality_evaluation" as const;

export const FILING_QUALITY_PRECOMMITMENT_LIMITS = Object.freeze({
  aggregateStringCodePoints:
    FILING_QUALITY_MEASUREMENT_LIMITS.aggregateStringCodePoints,
  candidateObservationBytes: FILING_QUALITY_MEASUREMENT_LIMITS.candidateBytes,
  dimensionsPerFact: FILING_QUALITY_MEASUREMENT_LIMITS.dimensionsPerFact,
  documentDepth: FILING_QUALITY_MEASUREMENT_LIMITS.documentDepth,
  documentNodes: FILING_QUALITY_MEASUREMENT_LIMITS.documentNodes,
  documents: FILING_QUALITY_MEASUREMENT_LIMITS.documents,
  factsPerDocument: FILING_QUALITY_MEASUREMENT_LIMITS.candidateFactsPerDocument,
  phaseArguments: 2,
  planBytes: FILING_QUALITY_MEASUREMENT_LIMITS.planBytes,
  referenceBytes: FILING_QUALITY_MEASUREMENT_LIMITS.declaredReferenceBytes,
});

export const FILING_QUALITY_PRECOMMITMENT_QUARANTINE_CODES = Object.freeze([
  "protocol_quarantined",
  "measurement_quarantined",
] as const);

export const FILING_QUALITY_PRECOMMITMENT_CHECKS = Object.freeze([
  "exact_one_shot_in_process_protocol_factory_and_open_candidate_committed_consumed_state_machine",
  "first_commit_or_reveal_attempt_reserves_and_consumes_before_validation_and_forbids_retry_or_reset",
  "exact_commit_plan_and_reference_content_free_digest_bound_candidate_observation_then_reveal_capability_and_declared_reference_roles",
  "owned_bounded_utf8_canonical_json_snapshots_and_duplicate_key_rejection",
  "closed_label_separated_plan_candidate_observation_and_declared_reference_schemas",
  "fixed_cycle2f_schema_claim_function_and_095_099_099_005_zero_silent_exact_unit_zero_date_policy_binding",
  "candidate_observation_payload_binds_exact_reference_digest_but_excludes_reference_content_produced_at_metrics_counts_weights_exclusions_and_outcomes",
  "full_reference_content_free_candidate_document_fact_quarantine_sorted_unique_closed_population_validation_at_commit",
  "domain_separated_plan_candidate_observation_and_reference_digest_commitment_recomputation_and_immutable_aggregate_receipt",
  "opaque_instance_identity_bound_empty_frozen_single_use_capability_and_serialization_does_not_transfer_authority",
  "reveal_recomputes_committed_reference_digest_and_injects_fixed_candidate_role_produced_at_into_exact_derived_cycle2f_candidate",
  "exact_cycle2f_measurement_execution_preserves_fixed_denominators_missing_quarantine_wrong_prediction_zero_denominator_and_integer_ratio_semantics",
  "committed_snapshot_mutation_safety_and_substitution_replay_cross_instance_capability_or_role_swap_fail_closed",
  "valid_below_threshold_quality_remains_evaluated_not_met_and_reference_digest_mismatch_is_consuming_quarantine",
  "immutable_aggregate_only_commit_and_evaluated_receipts_or_empty_value_free_quarantine_and_canary_absence",
  "domain_separated_determinism_no_io_clock_randomness_parser_custody_corpus_normalizer_comparison_database_api_web_queue_or_historical_evidence_mutation",
] as const);

export const FILING_QUALITY_PRECOMMITMENT_NOT_PROVEN = Object.freeze([
  "actual_reference_content_inaccessibility_to_caller_before_commit_external_blinding_or_label_leakage_absence",
  "trusted_clock_timestamp_cross_process_host_operator_or_failure_domain_chronology_authenticity",
  "durable_distributed_commitment_storage_receipt_timestamp_transparency_log_recovery_or_nonrepudiation",
  "candidate_or_commitment_signer_identity_key_authority_signature_or_external_capability_security",
  "reference_digest_or_candidate_commitment_hiding_secrecy_salt_privacy_zero_knowledge_or_adaptive_oracle_resistance",
  "declared_reference_correctness_independent_adjudicator_identity_or_human_resolution_quality",
  "candidate_observation_parser_execution_identity_digest_authenticity_or_cycle2d_cycle2e_output",
  "cycle2b_external_inventory_rights_steward_key_authority_human_review_or_phaseb_admission",
  "real_filing_payload_presence_digest_equality_sec_source_authenticity_or_custody",
  "representative_100_real_filings_independently_adjudicated_2000_real_assertions_or_real_parser_quality",
  "threshold_statistical_adequacy_confidence_calibration_or_production_acceptance",
  "strategic_quarantine_reason_authenticity_malicious_failure_masking_collusion_or_common_mode_failure",
  "general_xbrl_ixbrl_taxonomy_concept_alias_unit_conversion_dimension_fiscal_or_amendment_correctness",
  "network_fetch_custody_retention_kms_backup_deletion_or_cryptographic_erasure",
  "database_api_web_queue_persistence_evidence_passport_rights_projection_b15_v15_or_slo",
  "production_identity_secrets_real_data_full_cycle2_exit_or_production_use",
] as const);

export type FilingQualityPrecommitmentQuarantineCode =
  (typeof FILING_QUALITY_PRECOMMITMENT_QUARANTINE_CODES)[number];

declare const capabilityBrand: unique symbol;
export interface FilingQualityPrecommitmentCapability {
  readonly [capabilityBrand]: "filing-quality-precommitment-capability";
}

export interface FilingQualityPrecommitmentAudit {
  readonly documentObservationCount: number;
  readonly emittedFactCount: number;
  readonly outcome: "candidate_committed" | "quarantined";
  readonly quarantinedDocumentCount: number;
  readonly succeededDocumentCount: number;
}

export interface FilingQualityPrecommitmentCommittedResult {
  readonly audit: FilingQualityPrecommitmentAudit;
  readonly candidateCommitmentSha256: `sha256:${string}`;
  readonly candidateObservationsSha256: `sha256:${string}`;
  readonly capability: FilingQualityPrecommitmentCapability;
  readonly claim: typeof FILING_QUALITY_PRECOMMITMENT_CLAIM;
  readonly planSha256: `sha256:${string}`;
  readonly schemaVersion: typeof FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION;
  readonly status: "candidate_committed";
  readonly synthetic: true;
}

export interface FilingQualityPrecommitmentEvaluatedResult {
  readonly candidateCommitmentSha256: `sha256:${string}`;
  readonly candidateObservationsSha256: `sha256:${string}`;
  readonly claim: typeof FILING_QUALITY_PRECOMMITMENT_CLAIM;
  readonly evaluationBindingSha256: `sha256:${string}`;
  readonly measurement: FilingQualityMeasurementEvaluatedResult;
  readonly planSha256: `sha256:${string}`;
  readonly schemaVersion: typeof FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION;
  readonly status: "evaluated";
  readonly synthetic: true;
}

export interface FilingQualityPrecommitmentQuarantinedResult {
  readonly audit: FilingQualityPrecommitmentAudit;
  readonly claim: typeof FILING_QUALITY_PRECOMMITMENT_CLAIM;
  readonly code: FilingQualityPrecommitmentQuarantineCode;
  readonly measurement: null;
  readonly schemaVersion: typeof FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: true;
}

export type FilingQualityPrecommitmentCommitResult =
  | FilingQualityPrecommitmentCommittedResult
  | FilingQualityPrecommitmentQuarantinedResult;
export type FilingQualityPrecommitmentRevealResult =
  | FilingQualityPrecommitmentEvaluatedResult
  | FilingQualityPrecommitmentQuarantinedResult;

export interface FilingQualityPrecommitmentProtocol {
  readonly commit: (
    plan: unknown,
    candidateObservations: unknown,
  ) => FilingQualityPrecommitmentCommitResult;
  readonly reveal: (
    capability: unknown,
    declaredReference: unknown,
  ) => FilingQualityPrecommitmentRevealResult;
}

type ProtocolState = "candidate_committed" | "consumed" | "open";
type FactKey = (typeof FILING_QUALITY_MEASUREMENT_FACT_KEYS)[number];
type CandidateQuarantineCode =
  (typeof FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES)[number];

interface CandidateDimension {
  readonly axis: string;
  readonly member: string;
}

interface CandidateFact {
  readonly concept: string;
  readonly dimensions: readonly CandidateDimension[];
  readonly factKey: FactKey;
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly unit: string;
  readonly value: string;
}

interface SucceededCandidateDocument {
  readonly documentId: string;
  readonly documentSha256: `sha256:${string}`;
  readonly facts: readonly CandidateFact[];
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

interface CandidateObservationDocument {
  readonly candidateDeclaration: FilingQualityMeasurementDeclaration;
  readonly declaredReferenceSha256: `sha256:${string}`;
  readonly documentObservations: readonly CandidateDocument[];
  readonly documentRole: "candidate_observations_precommit";
  readonly planSha256: `sha256:${string}`;
  readonly populationId: "synthetic-filing-quality-reference.v1";
  readonly populationVersion: typeof FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION;
  readonly schemaVersion: typeof FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION;
  readonly synthetic: true;
}

interface CommittedContext {
  readonly candidateCommitmentSha256: `sha256:${string}`;
  readonly candidateObservations: CandidateObservationDocument;
  readonly candidateObservationsSha256: `sha256:${string}`;
  readonly capability: FilingQualityPrecommitmentCapability;
  readonly plan: Uint8Array;
  readonly planSha256: `sha256:${string}`;
}

class ProtocolFailure extends Error {
  public constructor() {
    super("Synthetic filing quality precommitment failed.");
    this.name = "ProtocolFailure";
  }
}

const PLAN_ROLE = "synthetic_pilot_plan" as const;
const PLAN_ID = "synthetic-filing-quality-plan.v1" as const;
const PLAN_FROZEN_AT = "2026-01-01T00:00:00.000Z" as const;
const CANDIDATE_ROLE = "candidate_observations" as const;
const CANDIDATE_PRECOMMIT_ROLE = "candidate_observations_precommit" as const;
const CANDIDATE_PRODUCED_AT = "2026-01-03T00:00:00.000Z" as const;
const CORPUS_ID = "synthetic-filing-quality-reference.v1" as const;
const REFERENCE_DECLARATION =
  "declared_synthetic_reference_not_independently_adjudicated" as const;
const HASH = /^sha256:[0-9a-f]{64}$/u;
const DOCUMENT_ID = /^synthetic-filing-([0-9]{4})$/u;
const DECIMAL = /^-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?$/u;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const QNAME = /^[A-Za-z_][A-Za-z0-9._-]{0,62}:[A-Za-z_][A-Za-z0-9._-]{0,62}$/u;
const SAFE_TOKEN = /^[A-Za-z][A-Za-z0-9._:/-]{0,127}$/u;
const SAFE_DIMENSION_TOKEN = /^[A-Za-z_][A-Za-z0-9._:-]{0,127}$/u;
const DOCUMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-filing-quality-document:v1\u0000",
);
const COMMITMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-filing-quality-precommitment:v1\u0000",
);
const EVALUATION_BINDING_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-filing-quality-precommitment-evaluation:v1\u0000",
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

export function createSyntheticFilingQualityPrecommitmentProtocol(): FilingQualityPrecommitmentProtocol {
  let state: ProtocolState = arguments.length === 0 ? "open" : "consumed";
  let context: CommittedContext | null = null;

  const consume = (): CommittedContext | null => {
    const current = context;
    state = "consumed";
    context = null;
    return current;
  };

  const commit = function (
    plan: unknown,
    candidateObservations: unknown,
  ): FilingQualityPrecommitmentCommitResult {
    if (state !== "open") {
      consume();
      return quarantined("protocol_quarantined");
    }
    state = "consumed";
    try {
      if (
        arguments.length !== FILING_QUALITY_PRECOMMITMENT_LIMITS.phaseArguments
      )
        fail();
      assertExactMeasurementContract();
      const planSnapshot = snapshotBytes(
        plan,
        FILING_QUALITY_PRECOMMITMENT_LIMITS.planBytes,
      );
      const candidateSnapshot = snapshotBytes(
        candidateObservations,
        FILING_QUALITY_PRECOMMITMENT_LIMITS.candidateObservationBytes,
      );
      validatePlan(parseCanonicalDocument(planSnapshot));
      const planSha256 = sha256(planSnapshot);
      const candidate = validateCandidateObservations(
        parseCanonicalDocument(candidateSnapshot),
        planSha256,
      );
      const candidateObservationsSha256 = sha256(candidateSnapshot);
      const candidateCommitmentSha256 = domainHash(
        COMMITMENT_DOMAIN,
        canonicalBytes({
          candidateObservationsSha256,
          claim: FILING_QUALITY_PRECOMMITMENT_CLAIM,
          declaredReferenceSha256: candidate.declaredReferenceSha256,
          planSha256,
          schemaVersion: FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
        }),
      );
      const capability = Object.freeze(
        Object.create(null) as object,
      ) as FilingQualityPrecommitmentCapability;
      context = Object.freeze({
        candidateCommitmentSha256,
        candidateObservations: candidate,
        candidateObservationsSha256,
        capability,
        plan: planSnapshot,
        planSha256,
      });
      state = "candidate_committed";
      return committedResult(context);
    } catch {
      consume();
      return quarantined("protocol_quarantined");
    }
  };

  const reveal = function (
    capability: unknown,
    declaredReference: unknown,
  ): FilingQualityPrecommitmentRevealResult {
    const committed = consume();
    if (state !== "consumed" || committed === null) {
      return quarantined("protocol_quarantined");
    }
    try {
      if (
        arguments.length !==
          FILING_QUALITY_PRECOMMITMENT_LIMITS.phaseArguments ||
        capability !== committed.capability
      ) {
        fail();
      }
      const referenceSnapshot = snapshotBytes(
        declaredReference,
        FILING_QUALITY_PRECOMMITMENT_LIMITS.referenceBytes,
      );
      const declaredReferenceSha256 = sha256(referenceSnapshot);
      if (
        declaredReferenceSha256 !==
        committed.candidateObservations.declaredReferenceSha256
      ) {
        fail();
      }
      const derivedCandidate = canonicalBytes({
        candidateDeclaration:
          committed.candidateObservations.candidateDeclaration,
        declaredReferenceSha256,
        documentObservations:
          committed.candidateObservations.documentObservations,
        documentRole: CANDIDATE_ROLE,
        planSha256: committed.planSha256,
        populationId: committed.candidateObservations.populationId,
        populationVersion: committed.candidateObservations.populationVersion,
        producedAt: CANDIDATE_PRODUCED_AT,
        schemaVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
        synthetic: true,
      });
      const measured = measureSyntheticFilingQuality(
        committed.plan,
        referenceSnapshot,
        derivedCandidate,
      );
      if (measured.status !== "evaluated")
        return quarantined("measurement_quarantined");
      return evaluatedResult(committed, measured);
    } catch {
      return quarantined("protocol_quarantined");
    }
  };

  return Object.freeze({ commit, reveal });
}

function assertExactMeasurementContract(): void {
  if (
    FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION !== "1.0.0" ||
    FILING_QUALITY_MEASUREMENT_CLAIM !==
      "bounded_synthetic_fixed_population_declared_reference_quality_metric_accounting_and_fail_closed_threshold_evaluation" ||
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.dateToleranceDays !== 0 ||
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.documentSuccessMinimum.numerator !==
      95 ||
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.documentSuccessMinimum.denominator !==
      100 ||
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.factPrecisionMinimum.numerator !==
      99 ||
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.factPrecisionMinimum.denominator !==
      100 ||
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.factRecallMinimum.numerator !== 99 ||
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.factRecallMinimum.denominator !==
      100 ||
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.maximumQuarantineRate.numerator !==
      5 ||
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.maximumQuarantineRate.denominator !==
      100 ||
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.maximumSilentCriticalFailures !== 0 ||
    FILING_QUALITY_MEASUREMENT_THRESHOLDS.unitTolerancePolicy !==
      "exact_canonical_unit.v1"
  ) {
    fail();
  }
}

function validatePlan(value: unknown): void {
  const plan = exactRecord(value, [
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
    ) ||
    !exactDeclaration(
      plan.declaredCandidate,
      FILING_QUALITY_MEASUREMENT_DECLARATIONS.candidate,
    ) ||
    thresholds.dateToleranceDays !== 0 ||
    thresholds.documentSuccessMinimum !== "0.95" ||
    thresholds.factPrecisionMinimum !== "0.99" ||
    thresholds.factRecallMinimum !== "0.99" ||
    thresholds.maximumQuarantineRate !== "0.05" ||
    thresholds.maximumSilentCriticalFailures !== 0 ||
    thresholds.unitTolerancePolicy !== "exact_canonical_unit.v1"
  ) {
    fail();
  }
}

function validateCandidateObservations(
  value: unknown,
  planSha256: `sha256:${string}`,
): CandidateObservationDocument {
  const candidate = exactRecord(value, [
    "candidateDeclaration",
    "declaredReferenceSha256",
    "documentObservations",
    "documentRole",
    "planSha256",
    "populationId",
    "populationVersion",
    "schemaVersion",
    "synthetic",
  ]);
  if (
    candidate.schemaVersion !== FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION ||
    candidate.synthetic !== true ||
    candidate.documentRole !== CANDIDATE_PRECOMMIT_ROLE ||
    candidate.planSha256 !== planSha256 ||
    typeof candidate.declaredReferenceSha256 !== "string" ||
    !HASH.test(candidate.declaredReferenceSha256) ||
    candidate.populationId !== CORPUS_ID ||
    candidate.populationVersion !== FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION ||
    !exactDeclaration(
      candidate.candidateDeclaration,
      FILING_QUALITY_MEASUREMENT_DECLARATIONS.candidate,
    ) ||
    !Array.isArray(candidate.documentObservations) ||
    candidate.documentObservations.length >
      FILING_QUALITY_PRECOMMITMENT_LIMITS.documents
  ) {
    fail();
  }
  const observations: CandidateDocument[] = [];
  let previousId = "";
  for (const value of candidate.documentObservations) {
    const observation = validateCandidateDocument(value);
    if (observation.documentId <= previousId) fail();
    observations.push(observation);
    previousId = observation.documentId;
  }
  return Object.freeze({
    candidateDeclaration: Object.freeze({
      declarationSha256:
        FILING_QUALITY_MEASUREMENT_DECLARATIONS.candidate.declarationSha256,
      id: FILING_QUALITY_MEASUREMENT_DECLARATIONS.candidate.id,
      role: FILING_QUALITY_MEASUREMENT_DECLARATIONS.candidate.role,
      version: FILING_QUALITY_MEASUREMENT_DECLARATIONS.candidate.version,
    }),
    declaredReferenceSha256:
      candidate.declaredReferenceSha256 as `sha256:${string}`,
    documentObservations: Object.freeze(observations),
    documentRole: CANDIDATE_PRECOMMIT_ROLE,
    planSha256,
    populationId: CORPUS_ID,
    populationVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    schemaVersion: FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
    synthetic: true,
  });
}

function validateCandidateDocument(value: unknown): CandidateDocument {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    fail();
  const status = (value as Record<string, unknown>).status;
  if (status === "quarantined") {
    const document = exactRecord(value, [
      "documentId",
      "documentSha256",
      "facts",
      "quarantineCode",
      "status",
    ]);
    validateDocumentIdentity(document.documentId, document.documentSha256);
    if (
      !Array.isArray(document.facts) ||
      document.facts.length !== 0 ||
      typeof document.quarantineCode !== "string" ||
      !isCandidateQuarantineCode(document.quarantineCode)
    ) {
      fail();
    }
    return Object.freeze({
      documentId: document.documentId as string,
      documentSha256: document.documentSha256 as `sha256:${string}`,
      facts: Object.freeze([] as const),
      quarantineCode: document.quarantineCode,
      status: "quarantined",
    });
  }
  if (status !== "succeeded") fail();
  const document = exactRecord(value, [
    "documentId",
    "documentSha256",
    "facts",
    "status",
  ]);
  validateDocumentIdentity(document.documentId, document.documentSha256);
  if (
    !Array.isArray(document.facts) ||
    document.facts.length > FILING_QUALITY_PRECOMMITMENT_LIMITS.factsPerDocument
  ) {
    fail();
  }
  const facts: CandidateFact[] = [];
  let previousKey = "";
  for (const value of document.facts) {
    const fact = validateFact(value);
    if (fact.factKey <= previousKey) fail();
    facts.push(fact);
    previousKey = fact.factKey;
  }
  return Object.freeze({
    documentId: document.documentId as string,
    documentSha256: document.documentSha256 as `sha256:${string}`,
    facts: Object.freeze(facts),
    status: "succeeded",
  });
}

function validateDocumentIdentity(documentId: unknown, digest: unknown): void {
  if (
    typeof documentId !== "string" ||
    typeof digest !== "string" ||
    !HASH.test(digest)
  ) {
    fail();
  }
  const match = DOCUMENT_ID.exec(documentId);
  const ordinalText = match?.[1];
  if (ordinalText === undefined) fail();
  const ordinal = Number(ordinalText);
  if (
    ordinal < 1 ||
    ordinal > FILING_QUALITY_PRECOMMITMENT_LIMITS.documents ||
    digest !== syntheticDocumentSha(documentId)
  ) {
    fail();
  }
}

function validateFact(value: unknown): CandidateFact {
  const fact = exactRecord(value, [
    "concept",
    "dimensions",
    "factKey",
    "periodEnd",
    "periodStart",
    "unit",
    "value",
  ]);
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
    fact.dimensions.length >
      FILING_QUALITY_PRECOMMITMENT_LIMITS.dimensionsPerFact
  ) {
    fail();
  }
  const dimensions: CandidateDimension[] = [];
  let previousCoordinate = "";
  let previousAxis = "";
  for (const value of fact.dimensions) {
    const dimension = exactRecord(value, ["axis", "member"]);
    if (
      typeof dimension.axis !== "string" ||
      !SAFE_DIMENSION_TOKEN.test(dimension.axis) ||
      typeof dimension.member !== "string" ||
      !SAFE_DIMENSION_TOKEN.test(dimension.member)
    ) {
      fail();
    }
    const coordinate = `${dimension.axis}\u0000${dimension.member}`;
    if (coordinate <= previousCoordinate || dimension.axis === previousAxis)
      fail();
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

function committedResult(
  context: CommittedContext,
): FilingQualityPrecommitmentCommittedResult {
  let emittedFactCount = 0;
  let quarantinedDocumentCount = 0;
  let succeededDocumentCount = 0;
  for (const document of context.candidateObservations.documentObservations) {
    if (document.status === "quarantined") quarantinedDocumentCount += 1;
    else {
      succeededDocumentCount += 1;
      emittedFactCount += document.facts.length;
    }
  }
  return Object.freeze({
    audit: Object.freeze({
      documentObservationCount:
        context.candidateObservations.documentObservations.length,
      emittedFactCount,
      outcome: "candidate_committed" as const,
      quarantinedDocumentCount,
      succeededDocumentCount,
    }),
    candidateCommitmentSha256: context.candidateCommitmentSha256,
    candidateObservationsSha256: context.candidateObservationsSha256,
    capability: context.capability,
    claim: FILING_QUALITY_PRECOMMITMENT_CLAIM,
    planSha256: context.planSha256,
    schemaVersion: FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
    status: "candidate_committed" as const,
    synthetic: true as const,
  });
}

function evaluatedResult(
  context: CommittedContext,
  measurement: FilingQualityMeasurementEvaluatedResult,
): FilingQualityPrecommitmentEvaluatedResult {
  const ownedMeasurement = cloneAndFreeze(
    measurement,
  ) as FilingQualityMeasurementEvaluatedResult;
  const evaluationBindingSha256 = domainHash(
    EVALUATION_BINDING_DOMAIN,
    canonicalBytes({
      candidateCommitmentSha256: context.candidateCommitmentSha256,
      candidateObservationsSha256: context.candidateObservationsSha256,
      measurementEvaluationSha256: ownedMeasurement.evaluationSha256,
      planSha256: context.planSha256,
    }),
  );
  return Object.freeze({
    candidateCommitmentSha256: context.candidateCommitmentSha256,
    candidateObservationsSha256: context.candidateObservationsSha256,
    claim: FILING_QUALITY_PRECOMMITMENT_CLAIM,
    evaluationBindingSha256,
    measurement: ownedMeasurement,
    planSha256: context.planSha256,
    schemaVersion: FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
    status: "evaluated" as const,
    synthetic: true as const,
  });
}

function quarantined(
  code: FilingQualityPrecommitmentQuarantineCode,
): FilingQualityPrecommitmentQuarantinedResult {
  return Object.freeze({
    audit: Object.freeze({
      documentObservationCount: 0,
      emittedFactCount: 0,
      outcome: "quarantined" as const,
      quarantinedDocumentCount: 0,
      succeededDocumentCount: 0,
    }),
    claim: FILING_QUALITY_PRECOMMITMENT_CLAIM,
    code,
    measurement: null,
    schemaVersion: FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: true as const,
  });
}

function snapshotBytes(value: unknown, maximumBytes: number): Uint8Array {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype
    ) {
      fail();
    }
    const bytes = value as Uint8Array;
    const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(bytes) as unknown;
    const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    if (
      typeof byteLength !== "number" ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype ||
      byteLength === 0 ||
      byteLength > maximumBytes
    ) {
      fail();
    }
    const snapshot = new Uint8Array(byteLength);
    Uint8Array.prototype.set.call(snapshot, bytes);
    return snapshot;
  } catch (error) {
    if (error instanceof ProtocolFailure) throw error;
    fail();
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

function validateCanonicalTree(value: unknown): void {
  const stack: Array<{ readonly depth: number; readonly value: unknown }> = [
    { depth: 0, value },
  ];
  let nodes = 0;
  let stringCodePoints = 0;
  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry === undefined) fail();
    nodes += 1;
    if (
      nodes > FILING_QUALITY_PRECOMMITMENT_LIMITS.documentNodes ||
      entry.depth > FILING_QUALITY_PRECOMMITMENT_LIMITS.documentDepth
    ) {
      fail();
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
      fail();
    }
    if (
      stringCodePoints >
      FILING_QUALITY_PRECOMMITMENT_LIMITS.aggregateStringCodePoints
    ) {
      fail();
    }
  }
}

function exactDeclarations(
  value: unknown,
  expected: readonly FilingQualityMeasurementDeclaration[],
): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((declaration, index) => {
      const expectedDeclaration = expected[index];
      return (
        expectedDeclaration !== undefined &&
        exactDeclaration(declaration, expectedDeclaration)
      );
    })
  );
}

function exactDeclaration(
  value: unknown,
  expected: FilingQualityMeasurementDeclaration,
): boolean {
  const declaration = exactRecord(value, [
    "declarationSha256",
    "id",
    "role",
    "version",
  ]);
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
): Record<TKeys[number], unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail();
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail();
  }
  return value as Record<TKeys[number], unknown>;
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
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
    throw new TypeError("Canonical precommitment value is invalid.");
  }
  return `{${Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function cloneAndFreeze(value: unknown): unknown {
  if (Array.isArray(value))
    return Object.freeze(value.map((item) => cloneAndFreeze(item)));
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value))
      result[key] = cloneAndFreeze(item);
    return Object.freeze(result);
  }
  return value;
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
  const yearText = match?.[1];
  const monthText = match?.[2];
  const dayText = match?.[3];
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

function syntheticDocumentSha(documentId: string): `sha256:${string}` {
  return domainHash(DOCUMENT_DOMAIN, new TextEncoder().encode(documentId));
}

function domainHash(domain: Uint8Array, bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(domain)
    .update(bytes)
    .digest("hex")}`;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fail(): never {
  throw new ProtocolFailure();
}
