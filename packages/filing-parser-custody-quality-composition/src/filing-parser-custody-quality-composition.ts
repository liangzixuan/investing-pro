import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
  createFilingParserArchivePairCustodyProtocol,
  type FilingParserArchivePairCustodyProtocol,
  type FilingParserArchivePairCustodyReceipt,
} from "@research-cockpit/filing-payload-custody";
import {
  FILING_PARSER_QUALITY_COMPOSITION_CLAIM,
  FILING_PARSER_QUALITY_COMPOSITION_LIMITS,
  FILING_PARSER_QUALITY_COMPOSITION_NOT_PROVEN,
  FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION,
  createFilingParserQualityCompositionProtocol,
  type FilingParserQualityCompositionCapability,
  type FilingParserQualityCompositionConfiguration,
  type FilingParserQualityCompositionEvaluatedResult,
  type FilingParserQualityCompositionProjectionReceipt,
  type FilingParserQualityCompositionProtocol,
  type FilingParserQualityCompositionSourceExecution,
} from "@research-cockpit/filing-parser-quality-composition";

type FilingQualityMeasurementEvaluatedResult =
  FilingParserQualityCompositionEvaluatedResult["measurement"];

export const FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION =
  "1.0.0" as const;
export const FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM =
  "bounded_synthetic_source_owned_exact_pair_encrypted_custody_authenticated_readback_to_direct_docker_cross_engine_quality_evaluation_binding" as const;

export const FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CHECKS = Object.freeze([
  "exact_sealed_cycle2m_engine_configuration_and_frozen_archive_pair_profile",
  "no_caller_injected_custody_path_clock_entropy_key_store_receipt_readback_boundary_runner_signer_result_or_callback",
  "intrinsic_owned_plan_and_archive_snapshots_before_first_await",
  "async_one_shot_commit_reservation_and_reveal_consumption_before_validation",
  "common_source_context_binds_plan_reference_digest_and_both_archive_digests",
  "role_specific_custody_bindings_cover_common_context_role_and_both_archives",
  "exact_two_archive_encrypted_stage_atomic_publish_and_authenticated_readback",
  "only_authenticated_owned_readback_snapshots_enter_fresh_cycle2n_composition",
  "custody_cleanup_and_key_forget_complete_before_commit_publication",
  "exact_cycle2n_candidate_commitment_projection_source_execution_and_frozen_evidence_carrier_validation",
  "unchanged_cycle2g_reveal_and_cycle2f_fixed_population_measurement",
  "honest_two_document_evaluated_not_met_accounting_is_preserved",
  "outer_commitment_binds_custody_receipts_pair_quality_carrier_and_cycle2n_commitment",
  "outer_evaluation_binds_custody_commitment_quality_carrier_and_cycle2n_evaluation",
  "mutation_tamper_role_swap_replay_concurrency_dependency_and_cleanup_failure_coverage",
  "single_deeply_frozen_value_free_quarantine_and_cycle2c_cycle2n_history_immutability",
] as const);

export const FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_NOT_PROVEN =
  Object.freeze([
    ...FILING_PARSER_QUALITY_COMPOSITION_NOT_PROVEN,
    "host_os_filesystem_temp_directory_disk_or_docker_runtime_attestation",
    "physical_or_cryptographic_erasure_disk_remanence_swap_or_gc_copy_absence",
    "durable_twenty_four_hour_retention_expiry_crash_recovery_or_backup_deletion",
    "process_crash_power_loss_or_cross_process_custody_recovery",
    "source_owned_ephemeral_custody_key_production_identity_rotation_or_nonrepudiation",
    "javascript_plaintext_memory_wipe_guarantee_or_gc_copy_absence",
  ] as const);

export const FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE =
  Object.freeze({
    algorithm: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM,
    claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
    fixtures: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES,
    schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
  });

type Sha256 = `sha256:${string}`;

export type FilingParserCustodyQualityCompositionConfiguration =
  FilingParserQualityCompositionConfiguration;

declare const capabilityBrand: unique symbol;
export interface FilingParserCustodyQualityCompositionCapability {
  readonly [capabilityBrand]: "filing-parser-custody-quality-composition-capability";
}

export interface FilingParserCustodyQualityCompositionAudit {
  readonly authenticatedReadbackCount: 2;
  readonly cleanupCount: 1;
  readonly directExecutionCount: 1;
  readonly emittedFactCount: 20;
  readonly stagedArchiveCount: 2;
  readonly zeroResidue: true;
}

export interface FilingParserCustodyQualityCompositionCustody {
  readonly custodyPairBindingSha256: Sha256;
  readonly receipts: readonly [
    FilingParserArchivePairCustodyReceipt,
    FilingParserArchivePairCustodyReceipt,
  ];
  readonly sourceContextSha256: Sha256;
}

export interface FilingParserCustodyQualityCompositionQuality {
  readonly projectionReceipts: readonly [
    FilingParserQualityCompositionProjectionReceipt,
    FilingParserQualityCompositionProjectionReceipt,
  ];
  readonly sourceExecution: FilingParserQualityCompositionSourceExecution;
}

export interface FilingParserCustodyQualityCompositionCommittedResult {
  readonly audit: FilingParserCustodyQualityCompositionAudit;
  readonly candidateCommitmentSha256: Sha256;
  readonly candidateObservationsSha256: Sha256;
  readonly capability: FilingParserCustodyQualityCompositionCapability;
  readonly claim: typeof FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM;
  readonly custody: FilingParserCustodyQualityCompositionCustody;
  readonly custodyCompositionCommitmentSha256: Sha256;
  readonly declaredReferenceSha256: Sha256;
  readonly planSha256: Sha256;
  readonly quality: FilingParserCustodyQualityCompositionQuality;
  readonly qualityCompositionCommitmentSha256: Sha256;
  readonly schemaVersion: typeof FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION;
  readonly status: "candidate_committed";
  readonly synthetic: true;
}

export interface FilingParserCustodyQualityCompositionEvaluatedResult {
  readonly candidateCommitmentSha256: Sha256;
  readonly candidateObservationsSha256: Sha256;
  readonly claim: typeof FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM;
  readonly custody: FilingParserCustodyQualityCompositionCustody;
  readonly custodyCompositionCommitmentSha256: Sha256;
  readonly custodyCompositionEvaluationBindingSha256: Sha256;
  readonly declaredReferenceSha256: Sha256;
  readonly measurement: FilingQualityMeasurementEvaluatedResult;
  readonly planSha256: Sha256;
  readonly quality: FilingParserCustodyQualityCompositionQuality;
  readonly qualityCompositionCommitmentSha256: Sha256;
  readonly qualityCompositionEvaluationBindingSha256: Sha256;
  readonly qualityEvaluationBindingSha256: Sha256;
  readonly schemaVersion: typeof FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION;
  readonly status: "evaluated";
  readonly synthetic: true;
}

export interface FilingParserCustodyQualityCompositionQuarantinedResult {
  readonly claim: typeof FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM;
  readonly code: "custody_quality_composition_quarantined";
  readonly schemaVersion: typeof FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: true;
}

export type FilingParserCustodyQualityCompositionCommitResult =
  | FilingParserCustodyQualityCompositionCommittedResult
  | FilingParserCustodyQualityCompositionQuarantinedResult;
export type FilingParserCustodyQualityCompositionRevealResult =
  | FilingParserCustodyQualityCompositionEvaluatedResult
  | FilingParserCustodyQualityCompositionQuarantinedResult;

export interface FilingParserCustodyQualityCompositionProtocol {
  readonly commit: (
    plan: unknown,
    declaredReferenceSha256: unknown,
    originalArchive: unknown,
    amendmentArchive: unknown,
  ) => Promise<FilingParserCustodyQualityCompositionCommitResult>;
  readonly reveal: (
    capability: unknown,
    declaredReference: unknown,
  ) => FilingParserCustodyQualityCompositionRevealResult;
}

interface Context {
  readonly amendmentArchiveSha256: Sha256;
  readonly candidateCommitmentSha256: Sha256;
  readonly candidateObservationsSha256: Sha256;
  readonly capability: FilingParserCustodyQualityCompositionCapability;
  readonly custody: FilingParserCustodyQualityCompositionCustody;
  readonly custodyCompositionCommitmentSha256: Sha256;
  readonly declaredReferenceSha256: Sha256;
  readonly innerCapability: FilingParserQualityCompositionCapability;
  readonly originalArchiveSha256: Sha256;
  readonly planSha256: Sha256;
  readonly quality: FilingParserCustodyQualityCompositionQuality;
  readonly qualityCompositionCommitmentSha256: Sha256;
}

interface ParsedInnerCommitment {
  readonly candidateCommitmentSha256: Sha256;
  readonly candidateObservationsSha256: Sha256;
  readonly capability: FilingParserQualityCompositionCapability;
  readonly compositionCommitmentSha256: Sha256;
  readonly declaredReferenceSha256: Sha256;
  readonly planSha256: Sha256;
  readonly projectionReceipts: readonly [
    FilingParserQualityCompositionProjectionReceipt,
    FilingParserQualityCompositionProjectionReceipt,
  ];
  readonly sourceExecution: FilingParserQualityCompositionSourceExecution;
}

interface ParsedInnerEvaluation {
  readonly candidateCommitmentSha256: Sha256;
  readonly candidateObservationsSha256: Sha256;
  readonly compositionCommitmentSha256: Sha256;
  readonly declaredReferenceSha256: Sha256;
  readonly evaluationBindingSha256: Sha256;
  readonly measurement: FilingQualityMeasurementEvaluatedResult;
  readonly planSha256: Sha256;
  readonly qualityEvaluationBindingSha256: Sha256;
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const TEXT_ENCODER = new TextEncoder();
const SOURCE_CONTEXT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-custody-quality-source-context:v1\u0000",
);
const CUSTODY_ROLE_SOURCE_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-archive-custody-role-source:v1\u0000",
);
const CUSTODY_RECEIPT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-archive-custody-receipt:v1\u0000",
);
const CUSTODY_PAIR_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-archive-custody-pair:v1\u0000",
);
const COMMITMENT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-custody-quality-commitment:v1\u0000",
);
const EVALUATION_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-custody-quality-evaluation:v1\u0000",
);
const QUALITY_MEASUREMENT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-quality-measurement:v1\u0000",
);
const QUALITY_DOCUMENT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-quality-document:v1\u0000",
);
const QUALITY_PROJECTION_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-quality-projection:v1\u0000",
);
const QUALITY_COMPOSITION_COMMITMENT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-quality-composition-commitment:v1\u0000",
);
const QUALITY_COMPOSITION_EVALUATION_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-quality-composition-evaluation:v1\u0000",
);
const QUALITY_PRECOMMITMENT_COMMITMENT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-quality-precommitment:v1\u0000",
);
const QUALITY_PRECOMMITMENT_EVALUATION_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-quality-precommitment-evaluation:v1\u0000",
);
const EXPECTED_QUALITY_MEASUREMENT_CLAIM: FilingQualityMeasurementEvaluatedResult["claim"] =
  "bounded_synthetic_fixed_population_declared_reference_quality_metric_accounting_and_fail_closed_threshold_evaluation";
const EXPECTED_QUALITY_MEASUREMENT_SCHEMA_VERSION: FilingQualityMeasurementEvaluatedResult["schemaVersion"] =
  "1.0.0";
const EXPECTED_QUALITY_MEASUREMENT_CANDIDATE_SHA256 =
  "sha256:7c765f360694afae40b3433386c8ce013fef94e329fa4cbe297a1d8df0df6d8c" as const;
const EXPECTED_QUALITY_CANDIDATE_OBSERVATIONS_SHA256 =
  "sha256:be4a31a484b0f71e5ebb5dc13915d56290c68653d53fb0ac27e36c628fc97421" as const;
const EXPECTED_QUALITY_PROJECTION_OBSERVATION_SHA256S = Object.freeze([
  "sha256:016ae1ef58be5df9d438e77e60b1586e2880752a5aac062633f6059cc40983d7",
  "sha256:c3e8c74ee319437219b79a659e0aa6175946f0e4c27430ade1be4bf6c1642488",
] as const);
const EXPECTED_DIRECT_EXECUTION_CLAIM: FilingParserQualityCompositionSourceExecution["directExecutionClaim"] =
  "bounded_synthetic_source_owned_direct_docker_cross_engine_current_input_and_lineage_agreement_with_lifecycle_binding";
const EXPECTED_DIRECT_EXECUTION_SCHEMA_VERSION: FilingParserQualityCompositionSourceExecution["directExecutionSchemaVersion"] =
  "1.0.0";
const EXPECTED_QUALITY_PRECOMMITMENT_CLAIM =
  "bounded_synthetic_in_process_one_shot_candidate_observation_commit_before_declared_reference_reveal_and_fail_closed_quality_evaluation" as const;
const EXPECTED_QUALITY_PRECOMMITMENT_SCHEMA_VERSION = "1.0.0" as const;

const QUARANTINED: FilingParserCustodyQualityCompositionQuarantinedResult =
  deepFreeze({
    claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
    code: "custody_quality_composition_quarantined" as const,
    schemaVersion: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: true as const,
  });
const QUARANTINING_PROTOCOL: FilingParserCustodyQualityCompositionProtocol =
  Object.freeze({
    commit: (): Promise<FilingParserCustodyQualityCompositionCommitResult> =>
      Promise.resolve(QUARANTINED),
    reveal: (): FilingParserCustodyQualityCompositionRevealResult =>
      QUARANTINED,
  });

export function createFilingParserCustodyQualityCompositionProtocol(
  configuration: FilingParserCustodyQualityCompositionConfiguration,
): FilingParserCustodyQualityCompositionProtocol {
  if (arguments.length !== 1) return QUARANTINING_PROTOCOL;
  return createProtocol(
    createFilingParserArchivePairCustodyProtocol(),
    createFilingParserQualityCompositionProtocol(configuration),
  );
}

/** @internal Test-only dependency seam; intentionally absent from package exports. */
export function createFilingParserCustodyQualityCompositionProtocolForTest(
  custody: FilingParserArchivePairCustodyProtocol,
  quality: FilingParserQualityCompositionProtocol,
): FilingParserCustodyQualityCompositionProtocol {
  return arguments.length === 2
    ? createProtocol(custody, quality)
    : QUARANTINING_PROTOCOL;
}

function createProtocol(
  custodyProtocol: FilingParserArchivePairCustodyProtocol,
  qualityProtocol: FilingParserQualityCompositionProtocol,
): FilingParserCustodyQualityCompositionProtocol {
  let state: "candidate_committed" | "committing" | "consumed" | "open" =
    "open";
  let context: Context | null = null;

  const consume = (): Context | null => {
    const current = context;
    context = null;
    state = "consumed";
    return current;
  };

  const commit = async function (
    planValue: unknown,
    declaredReferenceValue: unknown,
    originalValue: unknown,
    amendmentValue: unknown,
  ): Promise<FilingParserCustodyQualityCompositionCommitResult> {
    if (state === "committing") {
      consume();
      return QUARANTINED;
    }
    if (state !== "open") {
      consume();
      return QUARANTINED;
    }
    state = "committing";

    let plan: Uint8Array | undefined;
    let original: Uint8Array | undefined;
    let amendment: Uint8Array | undefined;
    let custodyOriginal: Uint8Array | undefined;
    let custodyAmendment: Uint8Array | undefined;
    try {
      if (arguments.length !== 4 || !isSha256(declaredReferenceValue)) fail();
      const declaredReferenceSha256 = declaredReferenceValue;
      plan = snapshotBounded(
        planValue,
        FILING_PARSER_QUALITY_COMPOSITION_LIMITS.planBytes,
      );
      original = snapshotExactArchive(originalValue, "original");
      amendment = snapshotExactArchive(amendmentValue, "amendment");
      if (equalBytes(original, amendment)) fail();
      const planSha256 = sha256(plan);
      const originalArchiveSha256 = sha256(original);
      const amendmentArchiveSha256 = sha256(amendment);
      const sourceContextSha256 = domainSha256(SOURCE_CONTEXT_DOMAIN, {
        amendmentArchiveSha256,
        claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
        declaredReferenceSha256,
        originalArchiveSha256,
        planSha256,
        schemaVersion: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
      });
      const custodyResult = await custodyProtocol.custodyAndRead(
        sourceContextSha256,
        original,
        amendment,
      );
      if (state !== "committing") fail();
      let parsedCustody: ReturnType<typeof parseCustodyResult>;
      try {
        parsedCustody = parseCustodyResult(custodyResult, sourceContextSha256);
      } finally {
        wipeCustodyResultReadbacks(custodyResult);
      }
      custodyOriginal = parsedCustody.originalArchive;
      custodyAmendment = parsedCustody.amendmentArchive;
      if (
        !equalBytes(original, custodyOriginal) ||
        !equalBytes(amendment, custodyAmendment)
      )
        fail();
      wipe(original);
      original = undefined;
      wipe(amendment);
      amendment = undefined;

      const innerResult = await qualityProtocol.commit(
        plan,
        declaredReferenceSha256,
        custodyOriginal,
        custodyAmendment,
      );
      if (state !== "committing") fail();
      const inner = parseInnerCommitment(
        innerResult,
        planSha256,
        declaredReferenceSha256,
        originalArchiveSha256,
        amendmentArchiveSha256,
      );
      const custodyValue = deepFreeze({
        custodyPairBindingSha256: parsedCustody.custodyPairBindingSha256,
        receipts: parsedCustody.receipts,
        sourceContextSha256,
      }) satisfies FilingParserCustodyQualityCompositionCustody;
      const qualityValue = deepFreeze({
        projectionReceipts: inner.projectionReceipts,
        sourceExecution: inner.sourceExecution,
      }) satisfies FilingParserCustodyQualityCompositionQuality;
      const custodyCompositionCommitmentSha256 = domainSha256(
        COMMITMENT_DOMAIN,
        {
          candidateCommitmentSha256: inner.candidateCommitmentSha256,
          candidateObservationsSha256: inner.candidateObservationsSha256,
          claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
          custody: custodyValue,
          declaredReferenceSha256,
          planSha256,
          quality: qualityValue,
          qualityCompositionCommitmentSha256: inner.compositionCommitmentSha256,
          schemaVersion:
            FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
        },
      );
      const capability = Object.freeze(
        Object.create(null) as object,
      ) as FilingParserCustodyQualityCompositionCapability;
      context = Object.freeze({
        amendmentArchiveSha256,
        candidateCommitmentSha256: inner.candidateCommitmentSha256,
        candidateObservationsSha256: inner.candidateObservationsSha256,
        capability,
        custody: custodyValue,
        custodyCompositionCommitmentSha256,
        declaredReferenceSha256,
        innerCapability: inner.capability,
        originalArchiveSha256,
        planSha256,
        quality: qualityValue,
        qualityCompositionCommitmentSha256: inner.compositionCommitmentSha256,
      });
      state = "candidate_committed";
      return deepFreeze({
        audit: {
          authenticatedReadbackCount: 2 as const,
          cleanupCount: 1 as const,
          directExecutionCount: 1 as const,
          emittedFactCount: 20 as const,
          stagedArchiveCount: 2 as const,
          zeroResidue: true as const,
        },
        candidateCommitmentSha256: inner.candidateCommitmentSha256,
        candidateObservationsSha256: inner.candidateObservationsSha256,
        capability,
        claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
        custody: custodyValue,
        custodyCompositionCommitmentSha256,
        declaredReferenceSha256,
        planSha256,
        quality: qualityValue,
        qualityCompositionCommitmentSha256: inner.compositionCommitmentSha256,
        schemaVersion: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
        status: "candidate_committed" as const,
        synthetic: true as const,
      });
    } catch {
      consume();
      return QUARANTINED;
    } finally {
      wipe(plan);
      wipe(original);
      wipe(amendment);
      wipe(custodyOriginal);
      wipe(custodyAmendment);
    }
  };

  const reveal = function (
    capabilityValue: unknown,
    declaredReference: unknown,
  ): FilingParserCustodyQualityCompositionRevealResult {
    const committedContext = consume();
    let referenceSnapshot: Uint8Array | undefined;
    try {
      if (
        arguments.length !== 2 ||
        committedContext === null ||
        capabilityValue !== committedContext.capability
      )
        fail();
      referenceSnapshot = snapshotBounded(
        declaredReference,
        FILING_PARSER_QUALITY_COMPOSITION_LIMITS.referenceBytes,
      );
      if (
        sha256(referenceSnapshot) !== committedContext.declaredReferenceSha256
      )
        fail();
      const innerResult = qualityProtocol.reveal(
        committedContext.innerCapability,
        referenceSnapshot,
      );
      const inner = parseInnerEvaluation(innerResult, committedContext);
      const custodyCompositionEvaluationBindingSha256 = domainSha256(
        EVALUATION_DOMAIN,
        {
          candidateCommitmentSha256: inner.candidateCommitmentSha256,
          candidateObservationsSha256: inner.candidateObservationsSha256,
          claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
          custody: committedContext.custody,
          custodyCompositionCommitmentSha256:
            committedContext.custodyCompositionCommitmentSha256,
          declaredReferenceSha256: inner.declaredReferenceSha256,
          measurementEvaluationSha256: inner.measurement.evaluationSha256,
          planSha256: inner.planSha256,
          quality: committedContext.quality,
          qualityCompositionCommitmentSha256: inner.compositionCommitmentSha256,
          qualityCompositionEvaluationBindingSha256:
            inner.evaluationBindingSha256,
          qualityEvaluationBindingSha256: inner.qualityEvaluationBindingSha256,
          schemaVersion:
            FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
        },
      );
      return deepFreeze({
        candidateCommitmentSha256: inner.candidateCommitmentSha256,
        candidateObservationsSha256: inner.candidateObservationsSha256,
        claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
        custody: committedContext.custody,
        custodyCompositionCommitmentSha256:
          committedContext.custodyCompositionCommitmentSha256,
        custodyCompositionEvaluationBindingSha256,
        declaredReferenceSha256: inner.declaredReferenceSha256,
        measurement: inner.measurement,
        planSha256: inner.planSha256,
        quality: committedContext.quality,
        qualityCompositionCommitmentSha256: inner.compositionCommitmentSha256,
        qualityCompositionEvaluationBindingSha256:
          inner.evaluationBindingSha256,
        qualityEvaluationBindingSha256: inner.qualityEvaluationBindingSha256,
        schemaVersion: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
        status: "evaluated" as const,
        synthetic: true as const,
      });
    } catch {
      return QUARANTINED;
    } finally {
      wipe(referenceSnapshot);
    }
  };

  return Object.freeze({ commit, reveal });
}

function parseCustodyResult(
  value: unknown,
  sourceContextSha256: Sha256,
): Readonly<{
  amendmentArchive: Uint8Array;
  custodyPairBindingSha256: Sha256;
  originalArchive: Uint8Array;
  receipts: readonly [
    FilingParserArchivePairCustodyReceipt,
    FilingParserArchivePairCustodyReceipt,
  ];
}> {
  const result = exactRecord(value, [
    "amendmentArchive",
    "audit",
    "claim",
    "custodyPairBindingSha256",
    "originalArchive",
    "receipts",
    "schemaVersion",
    "status",
    "synthetic",
  ]);
  if (
    result.claim !== FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM ||
    result.schemaVersion !==
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION ||
    result.status !== "readback" ||
    result.synthetic !== true ||
    !isSha256(result.custodyPairBindingSha256)
  )
    fail();
  const audit = exactRecord(result.audit, [
    "cleanupCount",
    "readbackCount",
    "stagedArchiveCount",
    "zeroResidue",
  ]);
  if (
    audit.cleanupCount !== 1 ||
    audit.readbackCount !== 2 ||
    audit.stagedArchiveCount !== 2 ||
    audit.zeroResidue !== true
  )
    fail();
  let originalArchive: Uint8Array | undefined;
  let amendmentArchive: Uint8Array | undefined;
  let completed = false;
  try {
    originalArchive = snapshotExactArchive(result.originalArchive, "original");
    amendmentArchive = snapshotExactArchive(
      result.amendmentArchive,
      "amendment",
    );
    const receiptValues = densePlainArray(result.receipts, 2);
    const originalReceipt = parseCustodyReceipt(
      receiptValues[0],
      sourceContextSha256,
      "original",
    );
    const amendmentReceipt = parseCustodyReceipt(
      receiptValues[1],
      sourceContextSha256,
      "amendment",
    );
    const receipts = Object.freeze([
      originalReceipt,
      amendmentReceipt,
    ] as const);
    const expectedPairBinding = domainSha256(CUSTODY_PAIR_DOMAIN, {
      claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
      receipts,
      schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
      sourceContextSha256,
    });
    if (result.custodyPairBindingSha256 !== expectedPairBinding) fail();
    completed = true;
    return Object.freeze({
      amendmentArchive,
      custodyPairBindingSha256: expectedPairBinding,
      originalArchive,
      receipts,
    });
  } finally {
    if (!completed) {
      wipe(originalArchive);
      wipe(amendmentArchive);
    }
  }
}

function wipeCustodyResultReadbacks(value: unknown): void {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value))
    return;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of ["originalArchive", "amendmentArchive"] as const) {
      const descriptor = descriptors[key];
      if (descriptor !== undefined && "value" in descriptor)
        wipeIfOrdinaryBytes(descriptor.value);
    }
  } catch {
    return;
  }
}

function wipeIfOrdinaryBytes(value: unknown): void {
  try {
    if (
      typeof value === "object" &&
      value !== null &&
      !utilTypes.isProxy(value) &&
      utilTypes.isUint8Array(value)
    )
      Uint8Array.prototype.fill.call(value, 0);
  } catch {
    return;
  }
}

function parseCustodyReceipt(
  value: unknown,
  sourceContextSha256: Sha256,
  role: "amendment" | "original",
): FilingParserArchivePairCustodyReceipt {
  const receipt = exactRecord(value, [
    "aadSha256",
    "byteLength",
    "ciphertextSha256",
    "contentSha256",
    "readbackSha256",
    "receiptSha256",
    "role",
    "sourceBindingSha256",
  ]);
  const fixture = FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES[role];
  const sourceBindingSha256 = domainSha256(CUSTODY_ROLE_SOURCE_DOMAIN, {
    amendmentArchiveSha256:
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES.amendment.contentSha256,
    claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
    originalArchiveSha256:
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES.original.contentSha256,
    role,
    schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
    sourceContextSha256,
  });
  if (
    receipt.role !== role ||
    receipt.byteLength !== fixture.byteLength ||
    receipt.contentSha256 !== fixture.contentSha256 ||
    receipt.readbackSha256 !== fixture.contentSha256 ||
    receipt.sourceBindingSha256 !== sourceBindingSha256 ||
    !isSha256(receipt.aadSha256) ||
    !isSha256(receipt.ciphertextSha256) ||
    !isSha256(receipt.receiptSha256)
  )
    fail();
  const preimage = Object.freeze({
    aadSha256: receipt.aadSha256,
    byteLength: fixture.byteLength,
    ciphertextSha256: receipt.ciphertextSha256,
    contentSha256: fixture.contentSha256,
    readbackSha256: fixture.contentSha256,
    role,
    sourceBindingSha256,
  });
  const receiptSha256 = domainSha256(CUSTODY_RECEIPT_DOMAIN, preimage);
  if (receipt.receiptSha256 !== receiptSha256) fail();
  return Object.freeze({ ...preimage, receiptSha256 });
}

function parseInnerCommitment(
  value: unknown,
  planSha256: Sha256,
  declaredReferenceSha256: Sha256,
  originalArchiveSha256: Sha256,
  amendmentArchiveSha256: Sha256,
): ParsedInnerCommitment {
  const result = exactRecord(value, [
    "audit",
    "candidateCommitmentSha256",
    "candidateObservationsSha256",
    "capability",
    "claim",
    "compositionCommitmentSha256",
    "declaredReferenceSha256",
    "planSha256",
    "projectionReceipts",
    "schemaVersion",
    "sourceExecution",
    "status",
    "synthetic",
  ]);
  if (
    result.claim !== FILING_PARSER_QUALITY_COMPOSITION_CLAIM ||
    result.schemaVersion !== FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION ||
    result.status !== "candidate_committed" ||
    result.synthetic !== true ||
    result.planSha256 !== planSha256 ||
    result.declaredReferenceSha256 !== declaredReferenceSha256 ||
    !isSha256(result.candidateCommitmentSha256) ||
    result.candidateObservationsSha256 !==
      EXPECTED_QUALITY_CANDIDATE_OBSERVATIONS_SHA256 ||
    !isSha256(result.compositionCommitmentSha256) ||
    !isOpaqueCapability(result.capability)
  )
    fail();
  const audit = exactRecord(result.audit, [
    "directExecutionCount",
    "documentObservationCount",
    "emittedFactCount",
    "outcome",
  ]);
  if (
    audit.directExecutionCount !== 1 ||
    audit.documentObservationCount !== 2 ||
    audit.emittedFactCount !== 20 ||
    audit.outcome !== "candidate_committed"
  )
    fail();
  const sourceExecution = parseSourceExecution(result.sourceExecution);
  const projectionReceipts = parseInnerProjectionReceipts(
    result.projectionReceipts,
    originalArchiveSha256,
    amendmentArchiveSha256,
    sourceExecution,
  );
  const expectedCandidateCommitmentSha256 = domainSha256(
    QUALITY_PRECOMMITMENT_COMMITMENT_DOMAIN,
    {
      candidateObservationsSha256: result.candidateObservationsSha256,
      claim: EXPECTED_QUALITY_PRECOMMITMENT_CLAIM,
      declaredReferenceSha256,
      planSha256,
      schemaVersion: EXPECTED_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
    },
  );
  if (result.candidateCommitmentSha256 !== expectedCandidateCommitmentSha256)
    fail();
  const expectedCompositionCommitmentSha256 = compactDomainSha256(
    QUALITY_COMPOSITION_COMMITMENT_DOMAIN,
    {
      candidateCommitmentSha256: expectedCandidateCommitmentSha256,
      candidateObservationsSha256: result.candidateObservationsSha256,
      claim: FILING_PARSER_QUALITY_COMPOSITION_CLAIM,
      declaredReferenceSha256,
      planSha256,
      projectionReceipts,
      schemaVersion: FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION,
      sourceExecution,
    },
  );
  if (
    result.compositionCommitmentSha256 !== expectedCompositionCommitmentSha256
  )
    fail();
  return Object.freeze({
    candidateCommitmentSha256: expectedCandidateCommitmentSha256,
    candidateObservationsSha256: result.candidateObservationsSha256,
    capability: result.capability as FilingParserQualityCompositionCapability,
    compositionCommitmentSha256: expectedCompositionCommitmentSha256,
    declaredReferenceSha256,
    planSha256,
    projectionReceipts,
    sourceExecution,
  });
}

function parseInnerEvaluation(
  value: unknown,
  context: Context,
): ParsedInnerEvaluation {
  const result = exactRecord(value, [
    "candidateCommitmentSha256",
    "candidateObservationsSha256",
    "claim",
    "compositionCommitmentSha256",
    "declaredReferenceSha256",
    "evaluationBindingSha256",
    "measurement",
    "planSha256",
    "projectionReceipts",
    "qualityEvaluationBindingSha256",
    "schemaVersion",
    "sourceExecution",
    "status",
    "synthetic",
  ]);
  if (
    result.claim !== FILING_PARSER_QUALITY_COMPOSITION_CLAIM ||
    result.schemaVersion !== FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION ||
    result.status !== "evaluated" ||
    result.synthetic !== true ||
    result.planSha256 !== context.planSha256 ||
    result.declaredReferenceSha256 !== context.declaredReferenceSha256 ||
    result.candidateCommitmentSha256 !== context.candidateCommitmentSha256 ||
    result.candidateObservationsSha256 !==
      context.candidateObservationsSha256 ||
    result.compositionCommitmentSha256 !==
      context.qualityCompositionCommitmentSha256 ||
    !isSha256(result.evaluationBindingSha256) ||
    !isSha256(result.qualityEvaluationBindingSha256)
  )
    fail();
  const sourceExecution = parseSourceExecution(result.sourceExecution);
  const projectionReceipts = parseInnerProjectionReceipts(
    result.projectionReceipts,
    context.originalArchiveSha256,
    context.amendmentArchiveSha256,
    sourceExecution,
  );
  if (
    canonicalJson(sourceExecution) !==
      canonicalJson(context.quality.sourceExecution) ||
    canonicalJson(projectionReceipts) !==
      canonicalJson(context.quality.projectionReceipts)
  )
    fail();
  const measurement = parseMeasurement(result.measurement, context);
  const expectedQualityEvaluationBindingSha256 = domainSha256(
    QUALITY_PRECOMMITMENT_EVALUATION_DOMAIN,
    {
      candidateCommitmentSha256: context.candidateCommitmentSha256,
      candidateObservationsSha256: context.candidateObservationsSha256,
      measurementEvaluationSha256: measurement.evaluationSha256,
      planSha256: context.planSha256,
    },
  );
  if (
    result.qualityEvaluationBindingSha256 !==
    expectedQualityEvaluationBindingSha256
  )
    fail();
  const expectedEvaluationBindingSha256 = compactDomainSha256(
    QUALITY_COMPOSITION_EVALUATION_DOMAIN,
    {
      candidateCommitmentSha256: context.candidateCommitmentSha256,
      compositionCommitmentSha256: context.qualityCompositionCommitmentSha256,
      declaredReferenceSha256: context.declaredReferenceSha256,
      measurementEvaluationSha256: measurement.evaluationSha256,
      qualityEvaluationBindingSha256: expectedQualityEvaluationBindingSha256,
    },
  );
  if (result.evaluationBindingSha256 !== expectedEvaluationBindingSha256)
    fail();
  return Object.freeze({
    candidateCommitmentSha256: context.candidateCommitmentSha256,
    candidateObservationsSha256: context.candidateObservationsSha256,
    compositionCommitmentSha256: context.qualityCompositionCommitmentSha256,
    declaredReferenceSha256: context.declaredReferenceSha256,
    evaluationBindingSha256: expectedEvaluationBindingSha256,
    measurement,
    planSha256: context.planSha256,
    qualityEvaluationBindingSha256: expectedQualityEvaluationBindingSha256,
  });
}

function parseInnerProjectionReceipts(
  value: unknown,
  originalArchiveSha256: Sha256,
  amendmentArchiveSha256: Sha256,
  sourceExecution: FilingParserQualityCompositionSourceExecution,
): readonly [
  FilingParserQualityCompositionProjectionReceipt,
  FilingParserQualityCompositionProjectionReceipt,
] {
  const receiptValues = densePlainArray(value, 2);
  const expected = [
    [
      "original",
      originalArchiveSha256,
      "synthetic-filing-0001",
      EXPECTED_QUALITY_PROJECTION_OBSERVATION_SHA256S[0],
      Object.freeze([
        sourceExecution.lifecycleBindingSha256s[0],
        sourceExecution.lifecycleBindingSha256s[2],
      ] as const),
    ],
    [
      "amendment",
      amendmentArchiveSha256,
      "synthetic-filing-0002",
      EXPECTED_QUALITY_PROJECTION_OBSERVATION_SHA256S[1],
      Object.freeze([
        sourceExecution.lifecycleBindingSha256s[1],
        sourceExecution.lifecycleBindingSha256s[3],
      ] as const),
    ],
  ] as const;
  return Object.freeze([
    parseInnerProjectionReceipt(receiptValues[0], ...expected[0]),
    parseInnerProjectionReceipt(receiptValues[1], ...expected[1]),
  ] as const);
}

function parseInnerProjectionReceipt(
  value: unknown,
  documentRole: "amendment" | "original",
  sourceArchiveSha256: Sha256,
  qualityDocumentId: "synthetic-filing-0001" | "synthetic-filing-0002",
  observationSha256: Sha256,
  sourceLifecycleBindingSha256s: readonly [Sha256, Sha256],
): FilingParserQualityCompositionProjectionReceipt {
  const receipt = exactRecord(value, [
    "documentRole",
    "factCount",
    "observationSha256",
    "projectionBindingSha256",
    "qualityDocumentId",
    "qualityDocumentSha256",
    "sourceArchiveSha256",
    "sourceDocumentSha256",
    "sourceLifecycleBindingSha256s",
  ]);
  const lifecycleValues = densePlainArray(
    receipt.sourceLifecycleBindingSha256s,
    2,
  );
  if (
    receipt.documentRole !== documentRole ||
    receipt.sourceArchiveSha256 !== sourceArchiveSha256 ||
    receipt.qualityDocumentId !== qualityDocumentId ||
    receipt.factCount !== 10 ||
    receipt.observationSha256 !== observationSha256 ||
    !isSha256(receipt.projectionBindingSha256) ||
    !isSha256(receipt.qualityDocumentSha256) ||
    !isSha256(receipt.sourceDocumentSha256) ||
    lifecycleValues[0] !== sourceLifecycleBindingSha256s[0] ||
    lifecycleValues[1] !== sourceLifecycleBindingSha256s[1]
  )
    fail();
  const parsedSourceLifecycleBindingSha256s = Object.freeze([
    lifecycleValues[0],
    lifecycleValues[1],
  ] as const);
  const qualityDocumentSha256 = rawDomainSha256(
    QUALITY_DOCUMENT_DOMAIN,
    qualityDocumentId,
  );
  if (receipt.qualityDocumentSha256 !== qualityDocumentSha256) fail();
  const preimage = Object.freeze({
    documentRole,
    factCount: 10 as const,
    observationSha256,
    qualityDocumentId,
    qualityDocumentSha256,
    sourceArchiveSha256,
    sourceDocumentSha256: receipt.sourceDocumentSha256,
    sourceLifecycleBindingSha256s: parsedSourceLifecycleBindingSha256s,
  });
  const projectionBindingSha256 = compactDomainSha256(
    QUALITY_PROJECTION_DOMAIN,
    preimage,
  );
  if (receipt.projectionBindingSha256 !== projectionBindingSha256) fail();
  return Object.freeze({ ...preimage, projectionBindingSha256 });
}

function parseSourceExecution(
  value: unknown,
): FilingParserQualityCompositionSourceExecution {
  const source = exactRecord(value, [
    "agreementSha256",
    "directExecutionClaim",
    "directExecutionSchemaVersion",
    "ephemeralPublicKeySpkiSha256",
    "executionMode",
    "invocationBindingSha256",
    "lifecycleBindingSha256s",
    "normalizationSha256",
  ]);
  if (
    source.executionMode !== "source_owned_direct_docker" ||
    source.directExecutionClaim !== EXPECTED_DIRECT_EXECUTION_CLAIM ||
    source.directExecutionSchemaVersion !==
      EXPECTED_DIRECT_EXECUTION_SCHEMA_VERSION ||
    !isSha256(source.agreementSha256) ||
    !isSha256(source.ephemeralPublicKeySpkiSha256) ||
    !isSha256(source.invocationBindingSha256) ||
    !isSha256(source.normalizationSha256)
  )
    fail();
  const lifecycleValues = densePlainArray(source.lifecycleBindingSha256s, 4);
  if (
    !isSha256(lifecycleValues[0]) ||
    !isSha256(lifecycleValues[1]) ||
    !isSha256(lifecycleValues[2]) ||
    !isSha256(lifecycleValues[3])
  )
    fail();
  return Object.freeze({
    agreementSha256: source.agreementSha256,
    directExecutionClaim: EXPECTED_DIRECT_EXECUTION_CLAIM,
    directExecutionSchemaVersion: EXPECTED_DIRECT_EXECUTION_SCHEMA_VERSION,
    ephemeralPublicKeySpkiSha256: source.ephemeralPublicKeySpkiSha256,
    executionMode: "source_owned_direct_docker" as const,
    invocationBindingSha256: source.invocationBindingSha256,
    lifecycleBindingSha256s: Object.freeze([
      lifecycleValues[0],
      lifecycleValues[1],
      lifecycleValues[2],
      lifecycleValues[3],
    ] as const),
    normalizationSha256: source.normalizationSha256,
  });
}

function parseMeasurement(
  value: unknown,
  context: Context,
): FilingQualityMeasurementEvaluatedResult {
  const snapshot = safeDataSnapshot(value, 0, { nodes: 0 });
  const measurement = exactRecord(snapshot, [
    "candidateSha256",
    "claim",
    "counts",
    "declaredReferenceSha256",
    "evaluationSha256",
    "failedThresholds",
    "metrics",
    "planSha256",
    "schemaVersion",
    "status",
    "synthetic",
    "syntheticPilotThresholdOutcome",
  ]);
  if (
    measurement.claim !== EXPECTED_QUALITY_MEASUREMENT_CLAIM ||
    measurement.schemaVersion !== EXPECTED_QUALITY_MEASUREMENT_SCHEMA_VERSION ||
    measurement.status !== "evaluated" ||
    measurement.synthetic !== true ||
    measurement.syntheticPilotThresholdOutcome !== "not_met" ||
    measurement.planSha256 !== context.planSha256 ||
    measurement.declaredReferenceSha256 !== context.declaredReferenceSha256 ||
    measurement.candidateSha256 !==
      EXPECTED_QUALITY_MEASUREMENT_CANDIDATE_SHA256 ||
    !isSha256(measurement.evaluationSha256)
  )
    fail();
  const counts = exactRecord(measurement.counts, [
    "conceptMismatchCount",
    "criticalAssertionCount",
    "dimensionMismatchCount",
    "documentCount",
    "emittedFactCount",
    "expectedFactCount",
    "falseNegativeFactCount",
    "falsePositiveFactCount",
    "missingDocumentCount",
    "missingFactCount",
    "periodMismatchCount",
    "quarantinedDocumentCount",
    "semanticAssertionPassCount",
    "silentCriticalFailureCount",
    "succeededDocumentCount",
    "truePositiveFactCount",
    "unitMismatchCount",
    "unitPeriodAssertionPassCount",
    "valueMismatchCount",
  ]);
  const expectedCounts = {
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
  } as const;
  for (const [key, expected] of Object.entries(expectedCounts))
    if (counts[key as keyof typeof expectedCounts] !== expected) fail();
  const failedThresholds = densePlainArray(measurement.failedThresholds, 3);
  if (
    canonicalJson(failedThresholds) !==
    canonicalJson([
      "document_success_minimum",
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ])
  )
    fail();
  const expectedMetrics = {
    documentSuccess: {
      defined: true,
      denominator: 100,
      met: false,
      numerator: 2,
      threshold: { denominator: 100, numerator: 95 },
      thresholdKind: "minimum",
    },
    factPrecision: {
      defined: true,
      denominator: 20,
      met: true,
      numerator: 20,
      threshold: { denominator: 100, numerator: 99 },
      thresholdKind: "minimum",
    },
    factRecall: {
      defined: true,
      denominator: 1_000,
      met: false,
      numerator: 20,
      threshold: { denominator: 100, numerator: 99 },
      thresholdKind: "minimum",
    },
    quarantineRate: {
      defined: true,
      denominator: 100,
      met: true,
      numerator: 0,
      threshold: { denominator: 100, numerator: 5 },
      thresholdKind: "maximum",
    },
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
  } as const;
  if (canonicalJson(measurement.metrics) !== canonicalJson(expectedMetrics))
    fail();
  const expectedEvaluationSha256 = compactDomainSha256(
    QUALITY_MEASUREMENT_DOMAIN,
    {
      candidateSha256: measurement.candidateSha256,
      counts,
      declaredReferenceSha256: context.declaredReferenceSha256,
      failedThresholds,
      planSha256: context.planSha256,
      syntheticPilotThresholdOutcome: "not_met",
    },
  );
  if (measurement.evaluationSha256 !== expectedEvaluationSha256) fail();
  return deepFreeze(snapshot) as FilingQualityMeasurementEvaluatedResult;
}

function snapshotExactArchive(
  value: unknown,
  role: "amendment" | "original",
): Uint8Array {
  const fixture = FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES[role];
  const snapshot = snapshotBounded(value, fixture.byteLength, true);
  if (sha256(snapshot) !== fixture.contentSha256) {
    wipe(snapshot);
    fail();
  }
  return snapshot;
}

function snapshotBounded(
  value: unknown,
  maximumBytes: number,
  exactLength = false,
): Uint8Array {
  try {
    if (typeof value !== "object" || value === null || utilTypes.isProxy(value))
      fail();
    const typedArrayPrototype = Object.getPrototypeOf(
      Uint8Array.prototype,
    ) as object;
    const bufferDescriptor = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "buffer",
    );
    const lengthDescriptor = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "byteLength",
    );
    const tagDescriptor = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      Symbol.toStringTag,
    );
    const arrayBufferLengthDescriptor = Object.getOwnPropertyDescriptor(
      ArrayBuffer.prototype,
      "byteLength",
    );
    const tag = tagDescriptor?.get?.call(value) as unknown;
    const buffer = bufferDescriptor?.get?.call(value) as unknown;
    const byteLength = lengthDescriptor?.get?.call(value) as unknown;
    const backingLength = arrayBufferLengthDescriptor?.get?.call(
      buffer,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      typeof byteLength !== "number" ||
      byteLength <= 0 ||
      byteLength > maximumBytes ||
      (exactLength && byteLength !== maximumBytes) ||
      backingLength !== byteLength ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    )
      fail();
    const snapshot = new Uint8Array(byteLength);
    Uint8Array.prototype.set.call(snapshot, value as Uint8Array);
    return snapshot;
  } catch {
    fail();
  }
}

function exactRecord<TKeys extends string>(
  value: unknown,
  keys: readonly TKeys[],
): Readonly<Record<TKeys, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    fail();
  const ownKeys = Reflect.ownKeys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    ownKeys.some((key) => typeof key !== "string") ||
    JSON.stringify([...ownKeys].sort()) !== JSON.stringify([...keys].sort())
  )
    fail();
  const result = Object.create(null) as Record<TKeys, unknown>;
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    )
      fail();
    result[key] = descriptor.value as unknown;
  }
  return Object.freeze(result);
}

function safeDataSnapshot(
  value: unknown,
  depth: number,
  budget: { nodes: number },
): unknown {
  budget.nodes += 1;
  if (depth > 12 || budget.nodes > 1_024) fail();
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail();
    return value;
  }
  if (Array.isArray(value)) {
    const values = densePlainArray(value);
    const result: unknown[] = [];
    for (const entry of values)
      result.push(safeDataSnapshot(entry, depth + 1, budget));
    return Object.freeze(result);
  }
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) fail();
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of keys as readonly string[]) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    )
      fail();
    result[key] = safeDataSnapshot(descriptor.value, depth + 1, budget);
  }
  return Object.freeze(result);
}

function densePlainArray(
  value: unknown,
  expectedLength?: number,
): readonly unknown[] {
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  )
    fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  const lengthValue: unknown =
    lengthDescriptor !== undefined && "value" in lengthDescriptor
      ? lengthDescriptor.value
      : undefined;
  if (
    typeof lengthValue !== "number" ||
    lengthDescriptor?.enumerable !== false ||
    lengthDescriptor?.configurable !== false ||
    !Number.isSafeInteger(lengthValue) ||
    lengthValue < 0 ||
    lengthValue > 1_024 ||
    (expectedLength !== undefined && lengthValue !== expectedLength)
  )
    fail();
  const length = lengthValue;
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== length + 1 ||
    ownKeys.some(
      (key) =>
        typeof key !== "string" ||
        (key !== "length" &&
          (!/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= length)),
    )
  )
    fail();
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    )
      fail();
    result.push(descriptor.value);
  }
  return Object.freeze(result);
}

function canonicalBytes(value: unknown): Uint8Array {
  return TEXT_ENCODER.encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail();
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (typeof value !== "object" || value === null) fail();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function domainSha256(domain: Uint8Array, value: unknown): Sha256 {
  return `sha256:${createHash("sha256")
    .update(domain)
    .update(canonicalBytes(value))
    .digest("hex")}`;
}

function compactDomainSha256(domain: Uint8Array, value: unknown): Sha256 {
  return `sha256:${createHash("sha256")
    .update(domain)
    .update(TEXT_ENCODER.encode(canonicalJson(value)))
    .digest("hex")}`;
}

function rawDomainSha256(domain: Uint8Array, value: string): Sha256 {
  return `sha256:${createHash("sha256")
    .update(domain)
    .update(TEXT_ENCODER.encode(value))
    .digest("hex")}`;
}

function sha256(value: Uint8Array): Sha256 {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function equalBytes(first: Uint8Array, second: Uint8Array): boolean {
  if (first.byteLength !== second.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < first.byteLength; index += 1)
    difference |= (first[index] ?? 0) ^ (second[index] ?? 0);
  return difference === 0;
}

function isSha256(value: unknown): value is Sha256 {
  return typeof value === "string" && HASH.test(value);
}

function isOpaqueCapability(value: unknown): value is object {
  return (
    typeof value === "object" &&
    value !== null &&
    !utilTypes.isProxy(value) &&
    Object.getPrototypeOf(value) === null &&
    Object.isFrozen(value) &&
    Reflect.ownKeys(value).length === 0
  );
}

function wipe(value: Uint8Array | undefined): void {
  if (value !== undefined) Uint8Array.prototype.fill.call(value, 0);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value))
    return value;
  for (const key of Reflect.ownKeys(value))
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  return Object.freeze(value);
}

function fail(): never {
  throw new TypeError("FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_FAILURE");
}
