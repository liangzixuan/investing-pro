import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM,
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_MODE,
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_SCHEMA_VERSION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS,
  createFilingParserCrossEngineDirectExecutionBoundary,
  type FilingParserCrossEngineDirectExecutionBoundary,
  type FilingParserCrossEngineDirectExecutionConfiguration,
} from "@research-cockpit/filing-parser-cross-engine-execution";
import {
  FILING_QUALITY_MEASUREMENT_CLAIM,
  FILING_QUALITY_MEASUREMENT_DECLARATIONS,
  FILING_QUALITY_MEASUREMENT_FACT_KEYS,
  FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
  type FilingQualityMeasurementEvaluatedResult,
} from "@research-cockpit/filing-quality-measurement";
import {
  FILING_QUALITY_PRECOMMITMENT_LIMITS,
  FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
  createSyntheticFilingQualityPrecommitmentProtocol,
  type FilingQualityPrecommitmentCapability,
  type FilingQualityPrecommitmentProtocol,
} from "@research-cockpit/filing-quality-precommitment";

export const FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION =
  "1.0.0" as const;
export const FILING_PARSER_QUALITY_COMPOSITION_CLAIM =
  "bounded_synthetic_source_owned_direct_docker_cross_engine_two_document_observation_precommitment_and_fixed_population_quality_evaluation_binding" as const;

export const FILING_PARSER_QUALITY_COMPOSITION_LIMITS = Object.freeze({
  archiveBytes: FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS.archiveBytes,
  commitArguments: 4,
  directExecutions: 1,
  emittedFacts: 20,
  planBytes: FILING_QUALITY_PRECOMMITMENT_LIMITS.planBytes,
  projectedDocuments: 2,
  projectedFactsPerDocument: 10,
  referenceBytes: FILING_QUALITY_PRECOMMITMENT_LIMITS.referenceBytes,
  revealArguments: 2,
});

export const FILING_PARSER_QUALITY_COMPOSITION_CHECKS = Object.freeze([
  "exact_source_owned_direct_docker_cross_engine_and_cycle2g_cycle2f_contract_configuration",
  "no_caller_injected_boundary_runner_signer_key_factory_execution_result_candidate_observation_measurement_or_callback",
  "intrinsic_owned_bounded_plan_archive_configuration_and_dependency_output_snapshots_before_use",
  "async_one_shot_open_committing_candidate_committed_consumed_state_machine_with_reservation_before_await",
  "reference_digest_only_commit_and_reference_bytes_only_identity_bound_capability_reveal",
  "exact_cycle2m_agreed_claim_schema_mode_current_input_lineage_and_recomputed_normalization_binding",
  "exact_four_lifecycle_receipt_python_node_original_amendment_partition_and_zero_residue",
  "exact_twenty_fact_version_original_amendment_source_document_partition_and_complete_validation",
  "exact_two_fixed_quality_coordinates_with_ten_sorted_facts_and_source_document_binding",
  "ninety_eight_documents_remain_omitted_without_replication_reweighting_exclusion_or_population_widening",
  "exact_cycle2g_candidate_commitment_and_cycle2f_fixed_denominator_delegation",
  "two_document_quality_accounting_preserves_precision_and_fail_closed_document_recall_silent_thresholds",
  "outer_commitment_and_evaluation_binding_over_execution_lifecycle_source_mapping_and_quality_hashes",
  "same_input_candidate_measurement_stability_with_distinct_lifecycle_commitment_and_evaluation_bindings",
  "timeout_process_quarantine_mutation_role_swap_replay_cross_instance_concurrency_and_dependency_failure_coverage",
  "atomic_composed_success_or_single_empty_value_free_quarantine_and_success_only_exact_source_v4_evidence_history_immutability",
] as const);

export const FILING_PARSER_QUALITY_COMPOSITION_NOT_PROVEN = Object.freeze([
  "docker_daemon_host_kernel_runtime_or_container_id_authenticity",
  "worker_image_registry_supply_chain_attestation_nonce_freshness_or_cache_absence",
  "external_signer_identity_kms_hsm_custody_rotation_or_nonrepudiation",
  "organizational_operator_key_host_or_failure_domain_independence",
  "independent_adjudicator_identity_declared_reference_correctness_or_human_resolution_quality",
  "reference_secrecy_external_blinding_label_leakage_absence_or_authenticated_durable_chronology",
  "representative_one_hundred_real_filings_or_independently_adjudicated_two_thousand_real_assertions",
  "real_parser_quality_threshold_adequacy_confidence_or_production_acceptance",
  "general_parser_xbrl_ixbrl_taxonomy_plugin_or_accounting_correctness",
  "real_public_filing_bytes_sec_source_authenticity_attestation_or_custody",
  "cycle2b_external_inventory_rights_steward_key_authority_human_review_or_phaseb_admission",
  "strategic_quarantine_reason_authenticity_collusion_common_mode_or_malicious_failure_masking_detection",
  "general_alias_unit_conversion_dimension_fiscal_calendar_or_amendment_coverage",
  "edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety",
  "multi_issuer_batch_retry_crash_recovery_load_slo_database_api_web_queue_or_b15_v15",
  "real_data_admission_full_cycle2_exit_or_production_use",
] as const);

export type FilingParserQualityCompositionConfiguration =
  FilingParserCrossEngineDirectExecutionConfiguration;

declare const capabilityBrand: unique symbol;
export interface FilingParserQualityCompositionCapability {
  readonly [capabilityBrand]: "filing-parser-quality-composition-capability";
}

export interface FilingParserQualityCompositionAudit {
  readonly directExecutionCount: 1;
  readonly documentObservationCount: 2;
  readonly emittedFactCount: 20;
  readonly outcome: "candidate_committed";
}

export interface FilingParserQualityCompositionProjectionReceipt {
  readonly documentRole: "amendment" | "original";
  readonly factCount: 10;
  readonly observationSha256: `sha256:${string}`;
  readonly projectionBindingSha256: `sha256:${string}`;
  readonly qualityDocumentId: "synthetic-filing-0001" | "synthetic-filing-0002";
  readonly qualityDocumentSha256: `sha256:${string}`;
  readonly sourceArchiveSha256: `sha256:${string}`;
  readonly sourceDocumentSha256: `sha256:${string}`;
  readonly sourceLifecycleBindingSha256s: readonly [
    `sha256:${string}`,
    `sha256:${string}`,
  ];
}

export interface FilingParserQualityCompositionSourceExecution {
  readonly agreementSha256: `sha256:${string}`;
  readonly directExecutionClaim: typeof FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM;
  readonly directExecutionSchemaVersion: typeof FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_SCHEMA_VERSION;
  readonly ephemeralPublicKeySpkiSha256: `sha256:${string}`;
  readonly executionMode: typeof FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_MODE;
  readonly invocationBindingSha256: `sha256:${string}`;
  readonly lifecycleBindingSha256s: readonly [
    `sha256:${string}`,
    `sha256:${string}`,
    `sha256:${string}`,
    `sha256:${string}`,
  ];
  readonly normalizationSha256: `sha256:${string}`;
}

export interface FilingParserQualityCompositionCommittedResult {
  readonly audit: FilingParserQualityCompositionAudit;
  readonly candidateCommitmentSha256: `sha256:${string}`;
  readonly candidateObservationsSha256: `sha256:${string}`;
  readonly capability: FilingParserQualityCompositionCapability;
  readonly claim: typeof FILING_PARSER_QUALITY_COMPOSITION_CLAIM;
  readonly compositionCommitmentSha256: `sha256:${string}`;
  readonly declaredReferenceSha256: `sha256:${string}`;
  readonly planSha256: `sha256:${string}`;
  readonly projectionReceipts: readonly [
    FilingParserQualityCompositionProjectionReceipt,
    FilingParserQualityCompositionProjectionReceipt,
  ];
  readonly schemaVersion: typeof FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION;
  readonly sourceExecution: FilingParserQualityCompositionSourceExecution;
  readonly status: "candidate_committed";
  readonly synthetic: true;
}

export interface FilingParserQualityCompositionEvaluatedResult {
  readonly candidateCommitmentSha256: `sha256:${string}`;
  readonly candidateObservationsSha256: `sha256:${string}`;
  readonly claim: typeof FILING_PARSER_QUALITY_COMPOSITION_CLAIM;
  readonly compositionCommitmentSha256: `sha256:${string}`;
  readonly declaredReferenceSha256: `sha256:${string}`;
  readonly evaluationBindingSha256: `sha256:${string}`;
  readonly measurement: FilingQualityMeasurementEvaluatedResult;
  readonly planSha256: `sha256:${string}`;
  readonly projectionReceipts: readonly [
    FilingParserQualityCompositionProjectionReceipt,
    FilingParserQualityCompositionProjectionReceipt,
  ];
  readonly qualityEvaluationBindingSha256: `sha256:${string}`;
  readonly schemaVersion: typeof FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION;
  readonly sourceExecution: FilingParserQualityCompositionSourceExecution;
  readonly status: "evaluated";
  readonly synthetic: true;
}

export interface FilingParserQualityCompositionQuarantinedResult {
  readonly claim: typeof FILING_PARSER_QUALITY_COMPOSITION_CLAIM;
  readonly code: "quality_composition_quarantined";
  readonly schemaVersion: typeof FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: true;
}

export type FilingParserQualityCompositionCommitResult =
  | FilingParserQualityCompositionCommittedResult
  | FilingParserQualityCompositionQuarantinedResult;
export type FilingParserQualityCompositionRevealResult =
  | FilingParserQualityCompositionEvaluatedResult
  | FilingParserQualityCompositionQuarantinedResult;

export interface FilingParserQualityCompositionProtocol {
  readonly commit: (
    plan: unknown,
    declaredReferenceSha256: unknown,
    originalArchive: unknown,
    amendmentArchive: unknown,
  ) => Promise<FilingParserQualityCompositionCommitResult>;
  readonly reveal: (
    capability: unknown,
    declaredReference: unknown,
  ) => FilingParserQualityCompositionRevealResult;
}

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

interface CandidateDocument {
  readonly documentId: "synthetic-filing-0001" | "synthetic-filing-0002";
  readonly documentSha256: `sha256:${string}`;
  readonly facts: readonly CandidateFact[];
  readonly status: "succeeded";
}

interface Projection {
  readonly candidateDocuments: readonly [CandidateDocument, CandidateDocument];
  readonly projectionReceipts: readonly [
    FilingParserQualityCompositionProjectionReceipt,
    FilingParserQualityCompositionProjectionReceipt,
  ];
  readonly sourceExecution: FilingParserQualityCompositionSourceExecution;
}

interface CommittedContext {
  readonly candidateCommitmentSha256: `sha256:${string}`;
  readonly candidateObservationsSha256: `sha256:${string}`;
  readonly capability: FilingParserQualityCompositionCapability;
  readonly compositionCommitmentSha256: `sha256:${string}`;
  readonly declaredReferenceSha256: `sha256:${string}`;
  readonly innerCapability: FilingQualityPrecommitmentCapability;
  readonly planSha256: `sha256:${string}`;
  readonly precommitment: FilingQualityPrecommitmentProtocol;
  readonly projectionReceipts: readonly [
    FilingParserQualityCompositionProjectionReceipt,
    FilingParserQualityCompositionProjectionReceipt,
  ];
  readonly sourceExecution: FilingParserQualityCompositionSourceExecution;
}

interface NormalizedFact {
  readonly factId: string;
  readonly key: FactKey;
  readonly knownFrom: string;
  readonly knownToExclusive: string | null;
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly predecessorFactId: string | null;
  readonly sourceAcceptedAt: string;
  readonly sourceAccession: string;
  readonly sourceAvailableAt: string;
  readonly sourceContentSha256: `sha256:${string}`;
  readonly sourceConcept: string;
  readonly sourceDocumentSha256: `sha256:${string}`;
  readonly successorFactId: string | null;
  readonly unit: string;
  readonly value: string;
}

interface NormalizationProjection {
  readonly amendmentDocumentSha256: `sha256:${string}`;
  readonly amendmentFacts: readonly NormalizedFact[];
  readonly originalDocumentSha256: `sha256:${string}`;
  readonly originalFacts: readonly NormalizedFact[];
  readonly value: JsonRecord;
}

type FactKey = (typeof FILING_QUALITY_MEASUREMENT_FACT_KEYS)[number];
type ProtocolState = "candidate_committed" | "committing" | "consumed" | "open";
type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonRecord | readonly JsonValue[];
type JsonRecord = { readonly [key: string]: JsonValue };

const HASH = /^sha256:[0-9a-f]{64}$/u;
const ENGINE_ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const FACT_ID = /^fact:sha256:[0-9a-f]{64}$/u;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ACCESSION = /^SYN-([0-9]{10})-([0-9]{2})-([0-9]{6})$/u;
const DECIMAL = /^-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?$/u;
const DIRECT_RESULT_DEPTH = 16;
const DIRECT_RESULT_NODES = 4_096;
const DIRECT_RESULT_STRING_CODE_POINTS = 1_048_576;
const FACT_CONTRACTS = Object.freeze({
  assets: Object.freeze({
    concept: "rc-synthetic:Assets",
    periodKind: "instant",
    unit: "USD",
  }),
  cash: Object.freeze({
    concept: "rc-synthetic:CashAndCashEquivalents",
    periodKind: "instant",
    unit: "USD",
  }),
  debt: Object.freeze({
    concept: "rc-synthetic:Debt",
    periodKind: "instant",
    unit: "USD",
  }),
  diluted_shares: Object.freeze({
    concept: "rc-synthetic:WeightedAverageDilutedShares",
    periodKind: "duration",
    unit: "shares",
  }),
  free_cash_flow: Object.freeze({
    concept: "rc-synthetic:FreeCashFlow",
    periodKind: "duration",
    unit: "USD",
  }),
  gross_profit: Object.freeze({
    concept: "rc-synthetic:GrossProfit",
    periodKind: "duration",
    unit: "USD",
  }),
  net_income: Object.freeze({
    concept: "rc-synthetic:NetIncome",
    periodKind: "duration",
    unit: "USD",
  }),
  operating_cash_flow: Object.freeze({
    concept: "rc-synthetic:OperatingCashFlow",
    periodKind: "duration",
    unit: "USD",
  }),
  operating_income: Object.freeze({
    concept: "rc-synthetic:OperatingIncome",
    periodKind: "duration",
    unit: "USD",
  }),
  revenue: Object.freeze({
    concept: "rc-synthetic:Revenue",
    periodKind: "duration",
    unit: "USD",
  }),
} satisfies Readonly<
  Record<
    FactKey,
    Readonly<{
      concept: string;
      periodKind: "duration" | "instant";
      unit: string;
    }>
  >
>);
const textEncoder = new TextEncoder();
const isProxy = utilTypes.isProxy;
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
const TYPED_ARRAY_TAG_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
);
const ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
);
const intrinsicSet = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "set",
)?.value as unknown;
const QUALITY_DOCUMENT_DOMAIN = textEncoder.encode(
  "research-cockpit:synthetic-filing-quality-document:v1\u0000",
);
const CROSS_ENGINE_AGREEMENT_DOMAIN = textEncoder.encode(
  "research-cockpit:synthetic-filing-parser-cross-engine-execution:v1\u0000",
);
const DIRECT_INVOCATION_DOMAIN = textEncoder.encode(
  "research-cockpit:synthetic-filing-parser-direct-cross-engine-invocation:v1\u0000",
);
const DIRECT_LIFECYCLE_DOMAIN = textEncoder.encode(
  "research-cockpit:synthetic-filing-parser-direct-container-lifecycle:v1\u0000",
);
const PROJECTION_DOMAIN = textEncoder.encode(
  "research-cockpit:synthetic-filing-parser-quality-projection:v1\u0000",
);
const COMMITMENT_DOMAIN = textEncoder.encode(
  "research-cockpit:synthetic-filing-parser-quality-composition-commitment:v1\u0000",
);
const EVALUATION_DOMAIN = textEncoder.encode(
  "research-cockpit:synthetic-filing-parser-quality-composition-evaluation:v1\u0000",
);

const AUDIT: FilingParserQualityCompositionAudit = Object.freeze({
  directExecutionCount: 1 as const,
  documentObservationCount: 2 as const,
  emittedFactCount: 20 as const,
  outcome: "candidate_committed" as const,
});
const QUARANTINED: FilingParserQualityCompositionQuarantinedResult =
  Object.freeze({
    claim: FILING_PARSER_QUALITY_COMPOSITION_CLAIM,
    code: "quality_composition_quarantined" as const,
    schemaVersion: FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: true as const,
  });
const QUARANTINING_PROTOCOL: FilingParserQualityCompositionProtocol =
  Object.freeze({
    commit: (): Promise<FilingParserQualityCompositionCommitResult> =>
      Promise.resolve(QUARANTINED),
    reveal: (): FilingParserQualityCompositionRevealResult => QUARANTINED,
  });

export function createFilingParserQualityCompositionProtocol(
  configuration: FilingParserQualityCompositionConfiguration,
): FilingParserQualityCompositionProtocol {
  if (arguments.length !== 1) return QUARANTINING_PROTOCOL;
  return createProtocol(
    createFilingParserCrossEngineDirectExecutionBoundary(configuration),
  );
}

/** @internal Test-only dependency seam; intentionally absent from package exports. */
export function createFilingParserQualityCompositionProtocolForTest(
  boundary: FilingParserCrossEngineDirectExecutionBoundary,
): FilingParserQualityCompositionProtocol {
  return arguments.length === 1
    ? createProtocol(boundary)
    : QUARANTINING_PROTOCOL;
}

function createProtocol(
  directBoundary: FilingParserCrossEngineDirectExecutionBoundary,
): FilingParserQualityCompositionProtocol {
  let state: ProtocolState = "open";
  let context: CommittedContext | null = null;

  const consume = (): CommittedContext | null => {
    const current = context;
    context = null;
    state = "consumed";
    return current;
  };

  const commit = async function (
    plan: unknown,
    declaredReferenceSha256Value: unknown,
    originalArchiveValue: unknown,
    amendmentArchiveValue: unknown,
  ): Promise<FilingParserQualityCompositionCommitResult> {
    if (state === "committing") {
      consume();
      return QUARANTINED;
    }
    if (state !== "open") {
      consume();
      return QUARANTINED;
    }
    state = "committing";
    try {
      if (
        arguments.length !==
        FILING_PARSER_QUALITY_COMPOSITION_LIMITS.commitArguments
      )
        fail();
      if (
        typeof declaredReferenceSha256Value !== "string" ||
        !HASH.test(declaredReferenceSha256Value)
      )
        fail();
      const declaredReferenceSha256 =
        declaredReferenceSha256Value as `sha256:${string}`;
      const planSnapshot = snapshotBytes(
        plan,
        FILING_PARSER_QUALITY_COMPOSITION_LIMITS.planBytes,
      );
      const originalArchive = snapshotBytes(
        originalArchiveValue,
        FILING_PARSER_QUALITY_COMPOSITION_LIMITS.archiveBytes,
      );
      const amendmentArchive = snapshotBytes(
        amendmentArchiveValue,
        FILING_PARSER_QUALITY_COMPOSITION_LIMITS.archiveBytes,
      );
      if (bytesEqual(originalArchive, amendmentArchive)) fail();
      const originalArchiveSha256 = sha256(originalArchive);
      const amendmentArchiveSha256 = sha256(amendmentArchive);
      const directResult = await directBoundary.execute(
        originalArchive,
        amendmentArchive,
      );
      if (state !== "committing") return QUARANTINED;
      const projection = projectDirectResult(
        directResult,
        originalArchiveSha256,
        amendmentArchiveSha256,
      );
      const planSha256 = sha256(planSnapshot);
      const candidateObservations = canonicalDocument({
        candidateDeclaration: FILING_QUALITY_MEASUREMENT_DECLARATIONS.candidate,
        declaredReferenceSha256,
        documentObservations: projection.candidateDocuments,
        documentRole: "candidate_observations_precommit",
        planSha256,
        populationId: "synthetic-filing-quality-reference.v1",
        populationVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
        schemaVersion: FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
        synthetic: true,
      });
      const precommitment = createSyntheticFilingQualityPrecommitmentProtocol();
      const committed = precommitment.commit(
        planSnapshot,
        candidateObservations,
      );
      if (
        committed.status !== "candidate_committed" ||
        committed.planSha256 !== planSha256
      )
        fail();
      const compositionCommitmentSha256 = domainSha256(COMMITMENT_DOMAIN, {
        candidateCommitmentSha256: committed.candidateCommitmentSha256,
        candidateObservationsSha256: committed.candidateObservationsSha256,
        claim: FILING_PARSER_QUALITY_COMPOSITION_CLAIM,
        declaredReferenceSha256,
        planSha256,
        projectionReceipts: projection.projectionReceipts,
        schemaVersion: FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION,
        sourceExecution: projection.sourceExecution,
      });
      const capability = Object.freeze(
        Object.create(null) as object,
      ) as FilingParserQualityCompositionCapability;
      context = Object.freeze({
        candidateCommitmentSha256: committed.candidateCommitmentSha256,
        candidateObservationsSha256: committed.candidateObservationsSha256,
        capability,
        compositionCommitmentSha256,
        declaredReferenceSha256,
        innerCapability: committed.capability,
        planSha256,
        precommitment,
        projectionReceipts: projection.projectionReceipts,
        sourceExecution: projection.sourceExecution,
      });
      state = "candidate_committed";
      return Object.freeze({
        audit: AUDIT,
        candidateCommitmentSha256: committed.candidateCommitmentSha256,
        candidateObservationsSha256: committed.candidateObservationsSha256,
        capability,
        claim: FILING_PARSER_QUALITY_COMPOSITION_CLAIM,
        compositionCommitmentSha256,
        declaredReferenceSha256,
        planSha256,
        projectionReceipts: projection.projectionReceipts,
        schemaVersion: FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION,
        sourceExecution: projection.sourceExecution,
        status: "candidate_committed" as const,
        synthetic: true as const,
      });
    } catch {
      consume();
      return QUARANTINED;
    }
  };

  const reveal = function (
    capability: unknown,
    declaredReferenceValue: unknown,
  ): FilingParserQualityCompositionRevealResult {
    if (state === "committing") {
      consume();
      return QUARANTINED;
    }
    const committed = consume();
    if (committed === null) return QUARANTINED;
    try {
      if (
        arguments.length !==
          FILING_PARSER_QUALITY_COMPOSITION_LIMITS.revealArguments ||
        capability !== committed.capability
      )
        fail();
      const declaredReference = snapshotBytes(
        declaredReferenceValue,
        FILING_PARSER_QUALITY_COMPOSITION_LIMITS.referenceBytes,
      );
      if (sha256(declaredReference) !== committed.declaredReferenceSha256)
        fail();
      const evaluated = committed.precommitment.reveal(
        committed.innerCapability,
        declaredReference,
      );
      if (evaluated.status !== "evaluated") fail();
      if (
        evaluated.candidateCommitmentSha256 !==
          committed.candidateCommitmentSha256 ||
        evaluated.candidateObservationsSha256 !==
          committed.candidateObservationsSha256 ||
        evaluated.planSha256 !== committed.planSha256 ||
        evaluated.measurement.declaredReferenceSha256 !==
          committed.declaredReferenceSha256 ||
        !exactExpectedMeasurement(evaluated.measurement)
      )
        fail();
      const evaluationBindingSha256 = domainSha256(EVALUATION_DOMAIN, {
        candidateCommitmentSha256: committed.candidateCommitmentSha256,
        compositionCommitmentSha256: committed.compositionCommitmentSha256,
        declaredReferenceSha256: committed.declaredReferenceSha256,
        measurementEvaluationSha256: evaluated.measurement.evaluationSha256,
        qualityEvaluationBindingSha256: evaluated.evaluationBindingSha256,
      });
      return Object.freeze({
        candidateCommitmentSha256: committed.candidateCommitmentSha256,
        candidateObservationsSha256: committed.candidateObservationsSha256,
        claim: FILING_PARSER_QUALITY_COMPOSITION_CLAIM,
        compositionCommitmentSha256: committed.compositionCommitmentSha256,
        declaredReferenceSha256: committed.declaredReferenceSha256,
        evaluationBindingSha256,
        measurement: evaluated.measurement,
        planSha256: committed.planSha256,
        projectionReceipts: committed.projectionReceipts,
        qualityEvaluationBindingSha256: evaluated.evaluationBindingSha256,
        schemaVersion: FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION,
        sourceExecution: committed.sourceExecution,
        status: "evaluated" as const,
        synthetic: true as const,
      });
    } catch {
      return QUARANTINED;
    }
  };

  return Object.freeze({ commit, reveal });
}

function projectDirectResult(
  value: unknown,
  originalArchiveSha256: `sha256:${string}`,
  amendmentArchiveSha256: `sha256:${string}`,
): Projection {
  const snapshot = snapshotJson(value);
  const result = jsonRecord(snapshot, [
    "claim",
    "normalization",
    "provenance",
    "schemaVersion",
    "status",
    "synthetic",
  ]);
  if (
    result.claim !== FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM ||
    result.schemaVersion !==
      FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_SCHEMA_VERSION ||
    result.status !== "agreed" ||
    result.synthetic !== true
  )
    fail();
  const normalization = validateNormalization(
    result.normalization!,
    originalArchiveSha256,
    amendmentArchiveSha256,
  );
  const provenance = jsonRecord(result.provenance!, [
    "agreement",
    "engineLifecycles",
    "ephemeralPublicKeySpkiSha256",
    "executionMode",
    "invocationBindingSha256",
    "keyId",
    "normalizationSha256",
  ]);
  if (
    provenance.executionMode !==
      FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_MODE ||
    provenance.keyId !== "cycle2m-ephemeral-ed25519-v1" ||
    !sha256Value(provenance.ephemeralPublicKeySpkiSha256!) ||
    !sha256Value(provenance.normalizationSha256!) ||
    !sha256Value(provenance.invocationBindingSha256!)
  )
    fail();
  const normalizationSha256 = sha256(
    textEncoder.encode(`${canonicalJson(normalization.value)}\n`),
  );
  if (provenance.normalizationSha256 !== normalizationSha256) fail();
  const agreement = jsonRecord(provenance.agreement!, [
    "agreementSha256",
    "amendmentArchiveSha256",
    "engineCount",
    "engines",
    "originalArchiveSha256",
  ]);
  if (
    agreement.engineCount !== 2 ||
    agreement.originalArchiveSha256 !== originalArchiveSha256 ||
    agreement.amendmentArchiveSha256 !== amendmentArchiveSha256 ||
    !sha256Value(agreement.agreementSha256!) ||
    !Array.isArray(agreement.engines) ||
    agreement.engines.length !== 2
  )
    fail();
  const agreementEngines = jsonArray(agreement.engines);
  const engines = agreementEngines.map((engine, index) =>
    validateEngine(engine, index === 0 ? "python-primary" : "node-secondary"),
  );
  if (
    engines[0]?.engineId === engines[1]?.engineId ||
    engines[0]?.imageSha256 === engines[1]?.imageSha256 ||
    engines[0]?.implementationSha256 === engines[1]?.implementationSha256 ||
    engines[0]?.executionBindingSha256 === engines[1]?.executionBindingSha256
  )
    fail();
  const expectedAgreementSha256 = cycle2kAgreementSha256({
    amendmentArchiveSha256,
    engines,
    normalizationSha256,
    originalArchiveSha256,
  });
  if (agreement.agreementSha256 !== expectedAgreementSha256) fail();
  if (
    !Array.isArray(provenance.engineLifecycles) ||
    provenance.engineLifecycles.length !== 2
  )
    fail();
  const engineLifecycleValues = jsonArray(provenance.engineLifecycles);
  const lifecycleBindings: `sha256:${string}`[] = [];
  const containerIds = new Set<string>();
  for (const [engineIndex, lifecycleValue] of engineLifecycleValues.entries()) {
    const role = engineIndex === 0 ? "python-primary" : "node-secondary";
    const lifecycle = jsonRecord(lifecycleValue, [
      "engine",
      "lifecycles",
      "role",
    ]);
    if (
      lifecycle.role !== role ||
      canonicalJson(lifecycle.engine) !== canonicalJson(engines[engineIndex])
    )
      fail();
    if (
      !Array.isArray(lifecycle.lifecycles) ||
      lifecycle.lifecycles.length !== 2
    )
      fail();
    const receiptValues = jsonArray(lifecycle.lifecycles);
    for (const [documentIndex, receiptValue] of receiptValues.entries()) {
      const documentRole = documentIndex === 0 ? "original" : "amendment";
      const engine = engines[engineIndex];
      if (engine === undefined) fail();
      const expectedArchiveSha256 =
        documentIndex === 0 ? originalArchiveSha256 : amendmentArchiveSha256;
      const expectedDocumentSha256 =
        documentIndex === 0
          ? normalization.originalDocumentSha256
          : normalization.amendmentDocumentSha256;
      const receipt = jsonRecord(receiptValue, [
        "archiveSha256",
        "containerIdSha256",
        "documentRole",
        "documentSha256",
        "engineId",
        "imageSha256",
        "implementationSha256",
        "keyId",
        "lifecycleBindingSha256",
        "publicKeySpkiSha256",
        "role",
        "zeroResidue",
      ]);
      if (
        receipt.archiveSha256 !== expectedArchiveSha256 ||
        receipt.documentRole !== documentRole ||
        receipt.documentSha256 !== expectedDocumentSha256 ||
        receipt.engineId !== engine.engineId ||
        receipt.imageSha256 !== engine.imageSha256 ||
        receipt.implementationSha256 !== engine.implementationSha256 ||
        receipt.keyId !== provenance.keyId ||
        receipt.publicKeySpkiSha256 !==
          provenance.ephemeralPublicKeySpkiSha256 ||
        receipt.role !== role ||
        receipt.zeroResidue !== true ||
        !sha256Value(receipt.containerIdSha256!) ||
        !sha256Value(receipt.lifecycleBindingSha256!)
      )
        fail();
      const { lifecycleBindingSha256, ...preimage } = receipt;
      if (
        lifecycleBindingSha256 !==
        domainSha256(DIRECT_LIFECYCLE_DOMAIN, preimage)
      )
        fail();
      if (containerIds.has(receipt.containerIdSha256)) fail();
      containerIds.add(receipt.containerIdSha256);
      lifecycleBindings.push(lifecycleBindingSha256);
    }
  }
  if (lifecycleBindings.length !== 4) fail();
  const lifecycleBindingSha256s = Object.freeze(
    lifecycleBindings,
  ) as unknown as readonly [
    `sha256:${string}`,
    `sha256:${string}`,
    `sha256:${string}`,
    `sha256:${string}`,
  ];
  if (
    provenance.invocationBindingSha256 !==
    domainSha256(DIRECT_INVOCATION_DOMAIN, {
      agreementSha256: agreement.agreementSha256,
      executionMode: provenance.executionMode,
      keyId: provenance.keyId,
      lifecycleReceipts: engineLifecycleValues.flatMap((item) => {
        const record = item as JsonRecord;
        return jsonArray(record.lifecycles!);
      }),
      normalizationSha256,
      publicKeySpkiSha256: provenance.ephemeralPublicKeySpkiSha256,
    })
  )
    fail();
  const sourceExecution: FilingParserQualityCompositionSourceExecution =
    Object.freeze({
      agreementSha256: agreement.agreementSha256,
      directExecutionClaim: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM,
      directExecutionSchemaVersion:
        FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_SCHEMA_VERSION,
      ephemeralPublicKeySpkiSha256: provenance.ephemeralPublicKeySpkiSha256,
      executionMode: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_MODE,
      invocationBindingSha256: provenance.invocationBindingSha256,
      lifecycleBindingSha256s,
      normalizationSha256,
    });
  const original = projectedDocument(
    "synthetic-filing-0001",
    "original",
    normalization.originalFacts,
    originalArchiveSha256,
    normalization.originalDocumentSha256,
    Object.freeze([lifecycleBindingSha256s[0], lifecycleBindingSha256s[2]]),
  );
  const amendment = projectedDocument(
    "synthetic-filing-0002",
    "amendment",
    normalization.amendmentFacts,
    amendmentArchiveSha256,
    normalization.amendmentDocumentSha256,
    Object.freeze([lifecycleBindingSha256s[1], lifecycleBindingSha256s[3]]),
  );
  return Object.freeze({
    candidateDocuments: Object.freeze([
      original.document,
      amendment.document,
    ] as const),
    projectionReceipts: Object.freeze([
      original.receipt,
      amendment.receipt,
    ] as const),
    sourceExecution,
  });
}

function projectedDocument(
  documentId: "synthetic-filing-0001" | "synthetic-filing-0002",
  documentRole: "amendment" | "original",
  sourceFacts: readonly NormalizedFact[],
  sourceArchiveSha256: `sha256:${string}`,
  sourceDocumentSha256: `sha256:${string}`,
  sourceLifecycleBindingSha256s: readonly [
    `sha256:${string}`,
    `sha256:${string}`,
  ],
): {
  readonly document: CandidateDocument;
  readonly receipt: FilingParserQualityCompositionProjectionReceipt;
} {
  const qualityDocumentSha256 = domainSha256(
    QUALITY_DOCUMENT_DOMAIN,
    documentId,
  );
  const facts = Object.freeze(
    sourceFacts.map((fact) =>
      Object.freeze({
        concept: fact.sourceConcept,
        dimensions: Object.freeze([] as const),
        factKey: fact.key,
        periodEnd: fact.periodEnd,
        periodStart: fact.periodStart,
        unit: fact.unit,
        value: fact.value,
      }),
    ),
  );
  const document = Object.freeze({
    documentId,
    documentSha256: qualityDocumentSha256,
    facts,
    status: "succeeded" as const,
  });
  const observationSha256 = sha256(canonicalBytes(document));
  const receiptPreimage = Object.freeze({
    documentRole,
    factCount: 10 as const,
    observationSha256,
    qualityDocumentId: documentId,
    qualityDocumentSha256,
    sourceArchiveSha256,
    sourceDocumentSha256,
    sourceLifecycleBindingSha256s,
  });
  const receipt = Object.freeze({
    ...receiptPreimage,
    projectionBindingSha256: domainSha256(PROJECTION_DOMAIN, receiptPreimage),
  });
  return Object.freeze({ document, receipt });
}

function validateEngine(
  value: JsonValue,
  role: "node-secondary" | "python-primary",
): JsonRecord {
  const engine = jsonRecord(value, [
    "engineId",
    "executionBindingSha256",
    "imageSha256",
    "implementationSha256",
    "role",
  ]);
  if (
    typeof engine.engineId !== "string" ||
    !ENGINE_ID.test(engine.engineId) ||
    engine.role !== role ||
    !sha256Value(engine.executionBindingSha256!) ||
    !sha256Value(engine.imageSha256!) ||
    !sha256Value(engine.implementationSha256!)
  )
    fail();
  return engine;
}

function validateNormalization(
  value: JsonValue,
  originalArchiveSha256: `sha256:${string}`,
  amendmentArchiveSha256: `sha256:${string}`,
): NormalizationProjection {
  const record = jsonRecord(value, [
    "amendmentDocumentSha256",
    "audit",
    "claim",
    "factVersions",
    "lineage",
    "originalDocumentSha256",
    "schemaVersion",
    "status",
    "synthetic",
  ]);
  if (
    record.claim !==
      "bounded_synthetic_ten_fact_normalization_and_amendment_supersession_lineage" ||
    record.schemaVersion !== "1.0.0" ||
    record.status !== "normalized" ||
    record.synthetic !== true ||
    !sha256Value(record.originalDocumentSha256!) ||
    !sha256Value(record.amendmentDocumentSha256!) ||
    record.originalDocumentSha256 === record.amendmentDocumentSha256
  )
    fail();
  const audit = jsonRecord(record.audit!, [
    "factVersionCount",
    "lineageCount",
    "outcome",
  ]);
  if (
    audit.factVersionCount !== 20 ||
    audit.lineageCount !== 10 ||
    audit.outcome !== "normalized"
  )
    fail();
  if (
    !Array.isArray(record.factVersions) ||
    record.factVersions.length !== 20 ||
    !Array.isArray(record.lineage) ||
    record.lineage.length !== 10
  )
    fail();
  const factVersions = jsonArray(record.factVersions);
  const lineageValues = jsonArray(record.lineage);
  const originalFacts: NormalizedFact[] = [];
  const amendmentFacts: NormalizedFact[] = [];
  const ids = new Set<string>();
  for (const [index, factValue] of factVersions.entries()) {
    const fact = jsonRecord(factValue, [
      "dimensions",
      "factId",
      "key",
      "knownFrom",
      "knownToExclusive",
      "parserVersion",
      "periodEnd",
      "periodStart",
      "predecessorFactId",
      "sourceAcceptedAt",
      "sourceAccession",
      "sourceAvailableAt",
      "sourceConcept",
      "sourceContentSha256",
      "sourceDocumentSha256",
      "successorFactId",
      "synthetic",
      "taxonomyFamily",
      "taxonomyVersion",
      "unit",
      "value",
    ]);
    const expectedKey = FILING_QUALITY_MEASUREMENT_FACT_KEYS[index % 10];
    if (expectedKey === undefined) fail();
    const contract = FACT_CONTRACTS[expectedKey];
    const original = index < 10;
    const expectedDocumentSha256 = original
      ? record.originalDocumentSha256
      : record.amendmentDocumentSha256;
    const expectedContentSha256 = original
      ? originalArchiveSha256
      : amendmentArchiveSha256;
    if (
      typeof fact.factId !== "string" ||
      !FACT_ID.test(fact.factId) ||
      ids.has(fact.factId) ||
      fact.key !== expectedKey ||
      fact.sourceConcept !== contract.concept ||
      fact.unit !== contract.unit ||
      fact.sourceDocumentSha256 !== expectedDocumentSha256 ||
      fact.sourceContentSha256 !== expectedContentSha256 ||
      typeof fact.value !== "string" ||
      !DECIMAL.test(fact.value) ||
      fact.value === "-0" ||
      typeof fact.periodEnd !== "string" ||
      !isIsoDate(fact.periodEnd) ||
      (contract.periodKind === "instant"
        ? fact.periodStart !== null
        : typeof fact.periodStart !== "string" ||
          !isIsoDate(fact.periodStart) ||
          fact.periodStart >= fact.periodEnd) ||
      !emptyJsonRecord(fact.dimensions!) ||
      fact.parserVersion !== "synthetic-ten-fact-producer-v1" ||
      fact.synthetic !== true ||
      fact.taxonomyFamily !== "rc-synthetic-ten-fact" ||
      fact.taxonomyVersion !== "1.0.0" ||
      typeof fact.knownFrom !== "string" ||
      !isUtcInstant(fact.knownFrom) ||
      !(
        fact.knownToExclusive === null ||
        (typeof fact.knownToExclusive === "string" &&
          isUtcInstant(fact.knownToExclusive))
      ) ||
      typeof fact.sourceAcceptedAt !== "string" ||
      !isUtcInstant(fact.sourceAcceptedAt) ||
      typeof fact.sourceAvailableAt !== "string" ||
      !isUtcInstant(fact.sourceAvailableAt) ||
      fact.sourceAcceptedAt >= fact.sourceAvailableAt ||
      fact.knownFrom !== fact.sourceAvailableAt ||
      typeof fact.sourceAccession !== "string" ||
      !ACCESSION.test(fact.sourceAccession) ||
      ACCESSION.exec(fact.sourceAccession)?.[2] !==
        fact.sourceAcceptedAt.slice(2, 4) ||
      fact.periodEnd >= fact.sourceAcceptedAt.slice(0, 10) ||
      !(
        fact.predecessorFactId === null ||
        (typeof fact.predecessorFactId === "string" &&
          FACT_ID.test(fact.predecessorFactId))
      ) ||
      !(
        fact.successorFactId === null ||
        (typeof fact.successorFactId === "string" &&
          FACT_ID.test(fact.successorFactId))
      )
    )
      fail();
    if (
      original
        ? fact.predecessorFactId !== null ||
          fact.successorFactId === null ||
          fact.knownToExclusive === null
        : fact.predecessorFactId === null ||
          fact.successorFactId !== null ||
          fact.knownToExclusive !== null
    )
      fail();
    ids.add(fact.factId);
    const normalized: NormalizedFact = Object.freeze({
      factId: fact.factId,
      key: expectedKey,
      knownFrom: fact.knownFrom,
      knownToExclusive: fact.knownToExclusive,
      periodEnd: fact.periodEnd,
      periodStart: fact.periodStart as string | null,
      predecessorFactId: fact.predecessorFactId,
      sourceAcceptedAt: fact.sourceAcceptedAt,
      sourceAccession: fact.sourceAccession,
      sourceAvailableAt: fact.sourceAvailableAt,
      sourceContentSha256: fact.sourceContentSha256,
      sourceConcept: fact.sourceConcept,
      sourceDocumentSha256: fact.sourceDocumentSha256,
      successorFactId: fact.successorFactId,
      unit: fact.unit,
      value: fact.value,
    });
    (original ? originalFacts : amendmentFacts).push(normalized);
  }
  let changed = 0;
  let unchanged = 0;
  const originalAnchor = originalFacts[0];
  const amendmentAnchor = amendmentFacts[0];
  if (originalAnchor === undefined || amendmentAnchor === undefined) fail();
  const originalAccession = ACCESSION.exec(originalAnchor.sourceAccession);
  const amendmentAccession = ACCESSION.exec(amendmentAnchor.sourceAccession);
  const durationAnchor = originalFacts[3];
  if (
    originalAccession === null ||
    amendmentAccession === null ||
    durationAnchor === undefined ||
    originalAccession[1] !== amendmentAccession[1] ||
    originalAccession[2] !== amendmentAccession[2] ||
    Number(amendmentAccession[3]) <= Number(originalAccession[3]) ||
    originalAnchor.sourceAccession === amendmentAnchor.sourceAccession ||
    originalAnchor.sourceAcceptedAt >= originalAnchor.sourceAvailableAt ||
    originalAnchor.sourceAvailableAt >= amendmentAnchor.sourceAcceptedAt ||
    amendmentAnchor.sourceAcceptedAt >= amendmentAnchor.sourceAvailableAt ||
    originalAnchor.knownFrom >= amendmentAnchor.knownFrom
  )
    fail();
  for (let index = 0; index < 10; index += 1) {
    const original = originalFacts[index];
    const amendment = amendmentFacts[index];
    if (
      original === undefined ||
      amendment === undefined ||
      original.successorFactId !== amendment.factId ||
      amendment.predecessorFactId !== original.factId ||
      original.knownToExclusive !== amendment.knownFrom ||
      original.sourceAccession !== originalAnchor.sourceAccession ||
      amendment.sourceAccession !== amendmentAnchor.sourceAccession ||
      original.sourceAcceptedAt !== originalAnchor.sourceAcceptedAt ||
      amendment.sourceAcceptedAt !== amendmentAnchor.sourceAcceptedAt ||
      original.sourceAvailableAt !== originalAnchor.sourceAvailableAt ||
      amendment.sourceAvailableAt !== amendmentAnchor.sourceAvailableAt ||
      original.knownFrom !== originalAnchor.knownFrom ||
      amendment.knownFrom !== amendmentAnchor.knownFrom ||
      original.sourceConcept !== amendment.sourceConcept ||
      original.unit !== amendment.unit ||
      original.periodStart !== amendment.periodStart ||
      original.periodEnd !== amendment.periodEnd ||
      original.periodEnd !== originalAnchor.periodEnd ||
      (original.periodStart !== null &&
        original.periodStart !== durationAnchor.periodStart)
    )
      fail();
    if (original.value === amendment.value) unchanged += 1;
    else changed += 1;
    const lineage = jsonRecord(lineageValues[index]!, [
      "effectiveAt",
      "key",
      "predecessorFactId",
      "successorFactId",
    ]);
    if (
      lineage.effectiveAt !== amendment.knownFrom ||
      lineage.key !== original.key ||
      lineage.predecessorFactId !== original.factId ||
      lineage.successorFactId !== amendment.factId
    )
      fail();
  }
  if (changed === 0 || unchanged === 0) fail();
  return Object.freeze({
    amendmentDocumentSha256: record.amendmentDocumentSha256,
    amendmentFacts: Object.freeze(amendmentFacts),
    originalDocumentSha256: record.originalDocumentSha256,
    originalFacts: Object.freeze(originalFacts),
    value: record,
  });
}

function exactExpectedMeasurement(
  measurement: FilingQualityMeasurementEvaluatedResult,
): boolean {
  if (
    measurement.claim !== FILING_QUALITY_MEASUREMENT_CLAIM ||
    measurement.schemaVersion !== FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION ||
    measurement.status !== "evaluated" ||
    measurement.synthetic !== true ||
    measurement.syntheticPilotThresholdOutcome !== "not_met"
  )
    return false;
  const counts = {
    conceptMismatchCount: 0,
    criticalAssertionCount: 2_000,
    dimensionMismatchCount: 0,
    documentCount: 100,
    emittedFactCount: 20,
    expectedFactCount: 1_000,
    falseNegativeFactCount: 980,
    falsePositiveFactCount: 0,
    missingDocumentCount: 98,
    missingFactCount: 980,
    periodMismatchCount: 0,
    quarantinedDocumentCount: 0,
    semanticAssertionPassCount: 20,
    silentCriticalFailureCount: 1_960,
    succeededDocumentCount: 2,
    truePositiveFactCount: 20,
    unitMismatchCount: 0,
    unitPeriodAssertionPassCount: 20,
    valueMismatchCount: 0,
  };
  const metrics = {
    documentSuccess: ratio(2, 100, false, 95, 100, "minimum"),
    factPrecision: ratio(20, 20, true, 99, 100, "minimum"),
    factRecall: ratio(20, 1_000, false, 99, 100, "minimum"),
    quarantineRate: ratio(0, 100, true, 5, 100, "maximum"),
    silentCriticalFailure: {
      count: 1_960,
      denominator: 2_000,
      maximumCount: 0,
      met: false,
    },
    unitDateTolerance: {
      dateToleranceDays: 0,
      periodMismatchCount: 0,
      unitMismatchCount: 0,
      unitTolerancePolicy: "exact_canonical_unit.v1",
    },
  };
  return (
    canonicalJson(measurement.counts) === canonicalJson(counts) &&
    canonicalJson(measurement.metrics) === canonicalJson(metrics) &&
    canonicalJson(measurement.failedThresholds) ===
      canonicalJson([
        "document_success_minimum",
        "fact_recall_minimum",
        "maximum_silent_critical_failures",
      ])
  );
}

function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isUtcInstant(value: string): boolean {
  if (!ISO_UTC.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function ratio(
  numerator: number,
  denominator: number,
  met: boolean,
  thresholdNumerator: number,
  thresholdDenominator: number,
  thresholdKind: "maximum" | "minimum",
): object {
  return {
    defined: true,
    denominator,
    met,
    numerator,
    threshold: {
      denominator: thresholdDenominator,
      numerator: thresholdNumerator,
    },
    thresholdKind,
  };
}

function snapshotBytes(value: unknown, maximumBytes: number): Uint8Array {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype
    )
      fail();
    const tag = TYPED_ARRAY_TAG_DESCRIPTOR?.get?.call(value) as unknown;
    const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(value) as unknown;
    const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      value,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      typeof byteLength !== "number" ||
      byteLength < 1 ||
      byteLength > maximumBytes ||
      typeof intrinsicSet !== "function" ||
      typeof buffer !== "object" ||
      buffer === null ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype ||
      isProxy(buffer)
    )
      fail();
    const bufferLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      buffer,
    ) as unknown;
    if (typeof bufferLength !== "number" || bufferLength < byteLength) fail();
    const snapshot = new Uint8Array(byteLength);
    Reflect.apply(intrinsicSet, snapshot, [value]);
    return snapshot;
  } catch {
    fail();
  }
}

function snapshotJson(value: unknown): JsonValue {
  let nodes = 0;
  let stringCodePoints = 0;
  const seen = new WeakSet<object>();
  const visit = (item: unknown, depth: number): JsonValue => {
    nodes += 1;
    if (nodes > DIRECT_RESULT_NODES || depth > DIRECT_RESULT_DEPTH) fail();
    if (item === null || typeof item === "boolean") return item;
    if (typeof item === "number") {
      if (!Number.isSafeInteger(item)) fail();
      return item;
    }
    if (typeof item === "string") {
      stringCodePoints += [...item].length;
      if (stringCodePoints > DIRECT_RESULT_STRING_CODE_POINTS) fail();
      return item;
    }
    if (typeof item !== "object" || isProxy(item) || seen.has(item)) fail();
    seen.add(item);
    if (Array.isArray(item)) {
      if (Object.getOwnPropertySymbols(item).length !== 0) fail();
      const descriptors = Object.getOwnPropertyDescriptors(item);
      const keys = Object.keys(descriptors).filter((key) => key !== "length");
      if (
        keys.length !== item.length ||
        keys.some((key, index) => key !== String(index))
      )
        fail();
      const result = keys.map((key) =>
        visit(dataDescriptor(descriptors[key]), depth + 1),
      );
      seen.delete(item);
      return Object.freeze(result);
    }
    if (
      Object.getPrototypeOf(item) !== Object.prototype ||
      Object.getOwnPropertySymbols(item).length !== 0
    )
      fail();
    const descriptors = Object.getOwnPropertyDescriptors(item);
    const result = Object.create(null) as Record<string, JsonValue>;
    for (const key of Object.keys(descriptors)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype")
        fail();
      result[key] = visit(dataDescriptor(descriptors[key]), depth + 1);
    }
    seen.delete(item);
    return Object.freeze(result);
  };
  return visit(value, 0);
}

function dataDescriptor(descriptor: PropertyDescriptor | undefined): unknown {
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.enumerable !== true ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  )
    fail();
  return descriptor.value;
}

function jsonRecord(value: JsonValue, keys: readonly string[]): JsonRecord {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())
  )
    fail();
  return value as JsonRecord;
}

function jsonArray(value: JsonValue): readonly JsonValue[] {
  if (!isJsonArray(value)) fail();
  return value;
}

function isJsonArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value);
}

function emptyJsonRecord(value: JsonValue): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

function sha256Value(value: JsonValue): value is `sha256:${string}` {
  return typeof value === "string" && HASH.test(value);
}

function canonicalDocument(value: unknown): Uint8Array {
  return textEncoder.encode(`${canonicalJson(value)}\n`);
}

function canonicalBytes(value: unknown): Uint8Array {
  return textEncoder.encode(canonicalJson(value));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null) fail();
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}

function domainSha256(domain: Uint8Array, value: unknown): `sha256:${string}` {
  return sha256(
    concatBytes(
      domain,
      typeof value === "string"
        ? textEncoder.encode(value)
        : canonicalBytes(value),
    ),
  );
}

function cycle2kAgreementSha256(value: unknown): `sha256:${string}` {
  return sha256(
    concatBytes(CROSS_ENGINE_AGREEMENT_DOMAIN, canonicalDocument(value)),
  );
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const result = new Uint8Array(first.byteLength + second.byteLength);
  result.set(first, 0);
  result.set(second, first.byteLength);
  return result;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1)
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

function fail(): never {
  throw new TypeError("Synthetic filing parser quality composition failed.");
}
