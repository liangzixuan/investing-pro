import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FILING_QUALITY_PRECOMMITMENT_CHECKS,
  FILING_QUALITY_PRECOMMITMENT_CLAIM,
  FILING_QUALITY_PRECOMMITMENT_LIMITS,
  FILING_QUALITY_PRECOMMITMENT_NOT_PROVEN,
  FILING_QUALITY_PRECOMMITMENT_QUARANTINE_CODES,
  FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
  createSyntheticFilingQualityPrecommitmentProtocol,
  type FilingQualityPrecommitmentCommittedResult,
  type FilingQualityPrecommitmentEvaluatedResult,
  type FilingQualityPrecommitmentProtocol,
  type FilingQualityPrecommitmentQuarantinedResult,
} from "./filing-quality-precommitment";
import {
  buildSyntheticFilingQualityPrecommitmentDocuments,
  canonicalSyntheticFilingQualityPrecommitmentDocument,
  decodeSyntheticFilingQualityPrecommitmentDocument,
} from "./test-filing-quality-precommitment-builder";

type MutableRecord = Record<string, unknown>;

interface MutableHarness {
  readonly candidateObservations: MutableRecord;
  readonly declaredReference: MutableRecord;
  readonly plan: MutableRecord;
}

interface EncodedHarness {
  readonly candidateObservations: Uint8Array;
  readonly declaredReference: Uint8Array;
  readonly plan: Uint8Array;
}

const COMMITMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-filing-quality-precommitment:v1\u0000",
);
const EVALUATION_BINDING_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-filing-quality-precommitment-evaluation:v1\u0000",
);

const EXPECTED_CHECKS = [
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
] as const;

const EXPECTED_NOT_PROVEN = [
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
] as const;

describe("Cycle 2g filing quality precommitment security boundary", () => {
  it("freezes the bounded claim, limits, checks, nonclaims, and two coarse quarantine codes", () => {
    expect(FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_QUALITY_PRECOMMITMENT_CLAIM).toBe(
      "bounded_synthetic_in_process_one_shot_candidate_observation_commit_before_declared_reference_reveal_and_fail_closed_quality_evaluation",
    );
    expect(FILING_QUALITY_PRECOMMITMENT_LIMITS).toStrictEqual({
      aggregateStringCodePoints: 1_048_576,
      candidateObservationBytes: 2_097_152,
      dimensionsPerFact: 4,
      documentDepth: 12,
      documentNodes: 32_768,
      documents: 100,
      factsPerDocument: 10,
      phaseArguments: 2,
      planBytes: 32_768,
      referenceBytes: 1_048_576,
    });
    expect(FILING_QUALITY_PRECOMMITMENT_CHECKS).toStrictEqual(EXPECTED_CHECKS);
    expect(FILING_QUALITY_PRECOMMITMENT_NOT_PROVEN).toStrictEqual(
      EXPECTED_NOT_PROVEN,
    );
    expect(FILING_QUALITY_PRECOMMITMENT_QUARANTINE_CODES).toStrictEqual([
      "protocol_quarantined",
      "measurement_quarantined",
    ]);
    expectDeepFrozen(FILING_QUALITY_PRECOMMITMENT_LIMITS);
    expectDeepFrozen(FILING_QUALITY_PRECOMMITMENT_CHECKS);
    expectDeepFrozen(FILING_QUALITY_PRECOMMITMENT_NOT_PROVEN);
  });

  it("commits only aggregate hashes behind an empty identity capability and exactly binds the canonical bytes", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    const candidate = decodeSyntheticFilingQualityPrecommitmentDocument(
      documents.candidateObservations,
    );
    const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const committed = expectCommitted(
      protocol.commit(documents.plan, documents.candidateObservations),
    );

    const planSha256 = sha256(documents.plan);
    const candidateObservationsSha256 = sha256(documents.candidateObservations);
    const candidateCommitmentSha256 = domainHash(
      COMMITMENT_DOMAIN,
      canonicalSyntheticFilingQualityPrecommitmentDocument({
        candidateObservationsSha256,
        claim: FILING_QUALITY_PRECOMMITMENT_CLAIM,
        declaredReferenceSha256: candidate.declaredReferenceSha256,
        planSha256,
        schemaVersion: FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
      }),
    );
    expect(committed).toStrictEqual({
      audit: {
        documentObservationCount: 100,
        emittedFactCount: 990,
        outcome: "candidate_committed",
        quarantinedDocumentCount: 1,
        succeededDocumentCount: 99,
      },
      candidateCommitmentSha256,
      candidateObservationsSha256,
      capability: committed.capability,
      claim: FILING_QUALITY_PRECOMMITMENT_CLAIM,
      planSha256,
      schemaVersion: FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
      status: "candidate_committed",
      synthetic: true,
    });
    expect(Object.getPrototypeOf(committed.capability)).toBeNull();
    expect(Object.keys(committed.capability)).toStrictEqual([]);
    expect(Object.getOwnPropertySymbols(committed.capability)).toStrictEqual(
      [],
    );
    expect(JSON.stringify(committed.capability)).toBe("{}");
    expectDeepFrozen(committed);
  });

  it("reveals the exact digest-bound reference, injects only compatibility metadata, and owns the Cycle2f aggregate", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    const candidate = decodeSyntheticFilingQualityPrecommitmentDocument(
      documents.candidateObservations,
    );
    const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const committed = expectCommitted(
      protocol.commit(documents.plan, documents.candidateObservations),
    );
    const evaluated = expectEvaluated(
      protocol.reveal(committed.capability, documents.declaredReference),
    );

    const derivedCandidate =
      canonicalSyntheticFilingQualityPrecommitmentDocument({
        candidateDeclaration: candidate.candidateDeclaration,
        declaredReferenceSha256: candidate.declaredReferenceSha256,
        documentObservations: candidate.documentObservations,
        documentRole: "candidate_observations",
        planSha256: committed.planSha256,
        populationId: candidate.populationId,
        populationVersion: candidate.populationVersion,
        producedAt: "2026-01-03T00:00:00.000Z",
        schemaVersion: "1.0.0",
        synthetic: true,
      });
    expect(evaluated.measurement.planSha256).toBe(committed.planSha256);
    expect(evaluated.measurement.declaredReferenceSha256).toBe(
      sha256(documents.declaredReference),
    );
    expect(evaluated.measurement.candidateSha256).toBe(
      sha256(derivedCandidate),
    );
    expect(evaluated.measurement.syntheticPilotThresholdOutcome).toBe("met");
    expect(evaluated.measurement.counts.truePositiveFactCount).toBe(990);
    expect(evaluated.measurement.counts.falseNegativeFactCount).toBe(10);
    expect(evaluated.measurement.counts.quarantinedDocumentCount).toBe(1);
    expect(evaluated.measurement.counts.silentCriticalFailureCount).toBe(0);
    expect(evaluated.evaluationBindingSha256).toBe(
      domainHash(
        EVALUATION_BINDING_DOMAIN,
        canonicalSyntheticFilingQualityPrecommitmentDocument({
          candidateCommitmentSha256: committed.candidateCommitmentSha256,
          candidateObservationsSha256: committed.candidateObservationsSha256,
          measurementEvaluationSha256: evaluated.measurement.evaluationSha256,
          planSha256: committed.planSha256,
        }),
      ),
    );
    expectDeepFrozen(evaluated);
  });

  it("rejects post-commit reference substitution by digest and consumes the only reveal", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    const reference = decodeSyntheticFilingQualityPrecommitmentDocument(
      documents.declaredReference,
    );
    referenceFacts(reference, 0)[0]!.value = "9000001";
    const substituted =
      canonicalSyntheticFilingQualityPrecommitmentDocument(reference);
    const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const committed = expectCommitted(
      protocol.commit(documents.plan, documents.candidateObservations),
    );
    expectQuarantined(
      protocol.reveal(committed.capability, substituted),
      "protocol_quarantined",
    );
    expectQuarantined(
      protocol.reveal(committed.capability, documents.declaredReference),
      "protocol_quarantined",
    );
  });

  it("preserves a valid below-threshold candidate as evaluated not_met rather than protocol quarantine", () => {
    const harness = mutableHarness();
    candidateFacts(harness, 0)[0]!.value = "9000001";
    const encoded = encodeHarness(harness);
    const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const committed = expectCommitted(
      protocol.commit(encoded.plan, encoded.candidateObservations),
    );
    const evaluated = expectEvaluated(
      protocol.reveal(committed.capability, encoded.declaredReference),
    );
    expect(evaluated.measurement.syntheticPilotThresholdOutcome).toBe(
      "not_met",
    );
    expect(evaluated.measurement.failedThresholds).toStrictEqual([
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ]);
    expect(evaluated.measurement.counts.truePositiveFactCount).toBe(989);
    expect(evaluated.measurement.counts.falsePositiveFactCount).toBe(1);
    expect(evaluated.measurement.counts.falseNegativeFactCount).toBe(11);
    expect(evaluated.measurement.counts.silentCriticalFailureCount).toBe(1);
  });

  it("consumes open state on reveal-first, malformed commit, factory arity, and a second commit", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();

    const revealFirst = createSyntheticFilingQualityPrecommitmentProtocol();
    expectQuarantined(
      revealFirst.reveal({}, documents.declaredReference),
      "protocol_quarantined",
    );
    expectQuarantined(
      revealFirst.commit(documents.plan, documents.candidateObservations),
      "protocol_quarantined",
    );

    const malformed = createSyntheticFilingQualityPrecommitmentProtocol();
    expectQuarantined(
      malformed.commit(new Uint8Array(), documents.candidateObservations),
      "protocol_quarantined",
    );
    expectQuarantined(
      malformed.commit(documents.plan, documents.candidateObservations),
      "protocol_quarantined",
    );

    const invalidFactory = Reflect.apply(
      createSyntheticFilingQualityPrecommitmentProtocol,
      undefined,
      ["unexpected"],
    ) as unknown as FilingQualityPrecommitmentProtocol;
    expectQuarantined(
      invalidFactory.commit(documents.plan, documents.candidateObservations),
      "protocol_quarantined",
    );

    const secondCommit = createSyntheticFilingQualityPrecommitmentProtocol();
    const first = expectCommitted(
      secondCommit.commit(documents.plan, documents.candidateObservations),
    );
    expectQuarantined(
      secondCommit.commit(documents.plan, documents.candidateObservations),
      "protocol_quarantined",
    );
    expectQuarantined(
      secondCommit.reveal(first.capability, documents.declaredReference),
      "protocol_quarantined",
    );
  });

  it("reserves state before hostile byte-carrier traps can reenter commit or reveal", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();

    const commitProtocol = createSyntheticFilingQualityPrecommitmentProtocol();
    let nestedCommit: unknown;
    const hostilePlan = new Proxy(documents.plan, {
      getPrototypeOf() {
        nestedCommit = commitProtocol.commit(
          documents.plan,
          documents.candidateObservations,
        );
        return Uint8Array.prototype;
      },
    });
    expectQuarantined(
      commitProtocol.commit(hostilePlan, documents.candidateObservations),
      "protocol_quarantined",
    );
    expectQuarantined(nestedCommit, "protocol_quarantined");

    const revealProtocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const committed = expectCommitted(
      revealProtocol.commit(documents.plan, documents.candidateObservations),
    );
    let nestedReveal: unknown;
    const hostileReference = new Proxy(documents.declaredReference, {
      getPrototypeOf() {
        nestedReveal = revealProtocol.reveal(
          committed.capability,
          documents.declaredReference,
        );
        return Uint8Array.prototype;
      },
    });
    expectQuarantined(
      revealProtocol.reveal(committed.capability, hostileReference),
      "protocol_quarantined",
    );
    expectQuarantined(nestedReveal, "protocol_quarantined");
  });

  it("rejects wrong, foreign, cloned, proxied, serialized, receipt-shaped, and replayed capabilities", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    const foreignProtocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const foreign = expectCommitted(
      foreignProtocol.commit(documents.plan, documents.candidateObservations),
    );

    const capabilityFactories: Array<
      (
        capability: FilingQualityPrecommitmentCommittedResult["capability"],
      ) => unknown
    > = [
      () => ({}),
      (capability) => ({ ...capability }),
      (capability) => Object.assign({}, capability),
      (capability) =>
        JSON.parse(JSON.stringify(capability)) as Record<string, unknown>,
      (capability) => new Proxy(capability, {}),
      () => foreign.capability,
    ];
    for (const makeCapability of capabilityFactories) {
      const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
      const committed = expectCommitted(
        protocol.commit(documents.plan, documents.candidateObservations),
      );
      expectQuarantined(
        protocol.reveal(
          makeCapability(committed.capability),
          documents.declaredReference,
        ),
        "protocol_quarantined",
      );
      expectQuarantined(
        protocol.reveal(committed.capability, documents.declaredReference),
        "protocol_quarantined",
      );
    }

    const receiptProtocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const receipt = expectCommitted(
      receiptProtocol.commit(documents.plan, documents.candidateObservations),
    );
    expectQuarantined(
      receiptProtocol.reveal(receipt, documents.declaredReference),
      "protocol_quarantined",
    );

    const replayProtocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const replay = expectCommitted(
      replayProtocol.commit(documents.plan, documents.candidateObservations),
    );
    expectEvaluated(
      replayProtocol.reveal(replay.capability, documents.declaredReference),
    );
    expectQuarantined(
      replayProtocol.reveal(replay.capability, documents.declaredReference),
      "protocol_quarantined",
    );

    expectEvaluated(
      foreignProtocol.reveal(foreign.capability, documents.declaredReference),
    );
  });

  it("consumes reveal before an invalid capability can inspect the reference carrier", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const committed = expectCommitted(
      protocol.commit(documents.plan, documents.candidateObservations),
    );
    let referenceAccessed = false;
    const reference = new Proxy(documents.declaredReference, {
      getPrototypeOf() {
        referenceAccessed = true;
        return Uint8Array.prototype;
      },
    });
    expectQuarantined(protocol.reveal({}, reference), "protocol_quarantined");
    expect(referenceAccessed).toBe(false);
    expectQuarantined(
      protocol.reveal(committed.capability, documents.declaredReference),
      "protocol_quarantined",
    );
  });

  it("takes owned plan and candidate snapshots and returns deterministic results after caller mutation", () => {
    const firstDocuments = buildSyntheticFilingQualityPrecommitmentDocuments();
    const firstReference = firstDocuments.declaredReference.slice();
    const firstProtocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const firstCommit = expectCommitted(
      firstProtocol.commit(
        firstDocuments.plan,
        firstDocuments.candidateObservations,
      ),
    );
    firstDocuments.plan.fill(0);
    firstDocuments.candidateObservations.fill(0);
    const firstEvaluation = expectEvaluated(
      firstProtocol.reveal(firstCommit.capability, firstReference),
    );
    firstReference.fill(0);

    const secondDocuments = buildSyntheticFilingQualityPrecommitmentDocuments();
    const secondProtocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const secondCommit = expectCommitted(
      secondProtocol.commit(
        secondDocuments.plan,
        secondDocuments.candidateObservations,
      ),
    );
    const secondEvaluation = expectEvaluated(
      secondProtocol.reveal(
        secondCommit.capability,
        secondDocuments.declaredReference,
      ),
    );
    expect(firstCommit.candidateCommitmentSha256).toBe(
      secondCommit.candidateCommitmentSha256,
    );
    expect(firstEvaluation).toStrictEqual(secondEvaluation);
    expectDeepFrozen(firstEvaluation);
  });

  it("rejects invalid carriers, alternate views, subclasses, proxies, empty values, oversize values, and wrong arity", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    class Uint8Subclass extends Uint8Array {}
    const invalidPlans: unknown[] = [
      undefined,
      null,
      {},
      "plan",
      new Uint8Array(),
      Buffer.from(documents.plan),
      new DataView(documents.plan.buffer),
      new Uint8Subclass(documents.plan),
      new Proxy(documents.plan, {}),
      new Uint8Array(new SharedArrayBuffer(documents.plan.byteLength)),
      new Uint8Array(FILING_QUALITY_PRECOMMITMENT_LIMITS.planBytes + 1),
    ];
    for (const plan of invalidPlans) {
      const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
      expectQuarantined(
        protocol.commit(plan, documents.candidateObservations),
        "protocol_quarantined",
      );
    }
    const oversizeCandidate = new Uint8Array(
      FILING_QUALITY_PRECOMMITMENT_LIMITS.candidateObservationBytes + 1,
    );
    expectQuarantined(
      createSyntheticFilingQualityPrecommitmentProtocol().commit(
        documents.plan,
        oversizeCandidate,
      ),
      "protocol_quarantined",
    );

    const commitWithArguments =
      createSyntheticFilingQualityPrecommitmentProtocol().commit;
    expectQuarantined(
      Reflect.apply(commitWithArguments, undefined, [
        documents.plan,
        documents.candidateObservations,
        1,
      ]),
      "protocol_quarantined",
    );

    const referenceProtocol =
      createSyntheticFilingQualityPrecommitmentProtocol();
    const referenceCommit = expectCommitted(
      referenceProtocol.commit(documents.plan, documents.candidateObservations),
    );
    expectQuarantined(
      referenceProtocol.reveal(
        referenceCommit.capability,
        new Uint8Array(FILING_QUALITY_PRECOMMITMENT_LIMITS.referenceBytes + 1),
      ),
      "protocol_quarantined",
    );
  });

  it("uses intrinsic typed-array slots instead of caller buffer, byteLength, constructor, or species expandos", () => {
    const shadowed = buildSyntheticFilingQualityPrecommitmentDocuments();
    const shadowedPlan = withTypedArrayDataShadows(shadowed.plan);
    const shadowedCandidate = withTypedArrayDataShadows(
      shadowed.candidateObservations,
    );
    const shadowedReference = withTypedArrayDataShadows(
      shadowed.declaredReference,
    );
    const shadowedProtocol =
      createSyntheticFilingQualityPrecommitmentProtocol();
    const shadowedCommit = expectCommitted(
      shadowedProtocol.commit(shadowedPlan, shadowedCandidate),
    );
    expectEvaluated(
      shadowedProtocol.reveal(shadowedCommit.capability, shadowedReference),
    );

    for (const phase of ["plan", "candidate"] as const) {
      for (const trapKind of ["constructor", "species"] as const) {
        const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
        const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
        let accessCount = 0;
        let reentrantResult: unknown;
        const carrier = withTypedArrayConstructorTrap(
          phase === "plan" ? documents.plan : documents.candidateObservations,
          trapKind,
          () => {
            accessCount += 1;
            reentrantResult = protocol.commit(
              documents.plan,
              documents.candidateObservations,
            );
          },
        );
        const committed = expectCommitted(
          protocol.commit(
            phase === "plan" ? carrier : documents.plan,
            phase === "candidate" ? carrier : documents.candidateObservations,
          ),
        );
        expect(accessCount).toBe(0);
        expect(reentrantResult).toBeUndefined();
        expectEvaluated(
          protocol.reveal(committed.capability, documents.declaredReference),
        );
      }
    }

    for (const trapKind of ["constructor", "species"] as const) {
      const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
      const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
      const committed = expectCommitted(
        protocol.commit(documents.plan, documents.candidateObservations),
      );
      let accessCount = 0;
      let reentrantResult: unknown;
      const reference = withTypedArrayConstructorTrap(
        documents.declaredReference,
        trapKind,
        () => {
          accessCount += 1;
          reentrantResult = protocol.reveal(
            committed.capability,
            documents.declaredReference,
          );
        },
      );
      expectEvaluated(protocol.reveal(committed.capability, reference));
      expect(accessCount).toBe(0);
      expect(reentrantResult).toBeUndefined();
    }
  });

  it("cannot disguise shared or oversized typed-array backing stores with own short ordinary-buffer metadata", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    const sharedPlan = withTypedArrayDataShadows(sharedCopy(documents.plan));
    const sharedCandidate = withTypedArrayDataShadows(
      sharedCopy(documents.candidateObservations),
    );
    expectQuarantined(
      createSyntheticFilingQualityPrecommitmentProtocol().commit(
        sharedPlan,
        documents.candidateObservations,
      ),
      "protocol_quarantined",
    );
    expectQuarantined(
      createSyntheticFilingQualityPrecommitmentProtocol().commit(
        documents.plan,
        sharedCandidate,
      ),
      "protocol_quarantined",
    );

    const oversizedPlan = withTypedArrayDataShadows(
      new Uint8Array(FILING_QUALITY_PRECOMMITMENT_LIMITS.planBytes + 1),
    );
    const oversizedCandidate = withTypedArrayDataShadows(
      new Uint8Array(
        FILING_QUALITY_PRECOMMITMENT_LIMITS.candidateObservationBytes + 1,
      ),
    );
    expectQuarantined(
      createSyntheticFilingQualityPrecommitmentProtocol().commit(
        oversizedPlan,
        documents.candidateObservations,
      ),
      "protocol_quarantined",
    );
    expectQuarantined(
      createSyntheticFilingQualityPrecommitmentProtocol().commit(
        documents.plan,
        oversizedCandidate,
      ),
      "protocol_quarantined",
    );

    for (const reference of [
      withTypedArrayDataShadows(sharedCopy(documents.declaredReference)),
      withTypedArrayDataShadows(
        new Uint8Array(FILING_QUALITY_PRECOMMITMENT_LIMITS.referenceBytes + 1),
      ),
    ]) {
      const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
      const committed = expectCommitted(
        protocol.commit(documents.plan, documents.candidateObservations),
      );
      expectQuarantined(
        protocol.reveal(committed.capability, reference),
        "protocol_quarantined",
      );
    }
  });

  it("rejects invalid UTF-8, BOM, CRLF, missing LF, leading whitespace, duplicate keys, depth, node, and aggregate-string abuse", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    const planText = textOf(documents.plan);
    const duplicatePlan = planText.replace(
      '"assertionKinds":',
      '"assertionKinds":[],"assertionKinds":',
    );
    const malformedPlans = [
      new Uint8Array([0xc3, 0x28]),
      concatBytes(new Uint8Array([0xef, 0xbb, 0xbf]), documents.plan),
      new TextEncoder().encode(planText.replace(/\n$/u, "\r\n")),
      new TextEncoder().encode(planText.slice(0, -1)),
      new TextEncoder().encode(` ${planText}`),
      new TextEncoder().encode(duplicatePlan),
    ];
    for (const plan of malformedPlans) {
      expectQuarantined(
        createSyntheticFilingQualityPrecommitmentProtocol().commit(
          plan,
          documents.candidateObservations,
        ),
        "protocol_quarantined",
      );
    }

    const deep = mutableHarness();
    let nested: unknown = null;
    for (let depth = 0; depth < 14; depth += 1) nested = { nested };
    deep.candidateObservations.extra = nested;
    expectCommitQuarantine(encodeHarness(deep));

    const wide = mutableHarness();
    wide.candidateObservations.extra = new Array(
      FILING_QUALITY_PRECOMMITMENT_LIMITS.documentNodes + 1,
    ).fill(null);
    expectCommitQuarantine(encodeHarness(wide));

    const long = mutableHarness();
    long.candidateObservations.extra = "x".repeat(
      FILING_QUALITY_PRECOMMITMENT_LIMITS.aggregateStringCodePoints + 1,
    );
    expectCommitQuarantine(encodeHarness(long));

    const duplicateCandidate = textOf(documents.candidateObservations).replace(
      '"candidateDeclaration":',
      '"candidateDeclaration":null,"candidateDeclaration":',
    );
    expectQuarantined(
      createSyntheticFilingQualityPrecommitmentProtocol().commit(
        documents.plan,
        new TextEncoder().encode(duplicateCandidate),
      ),
      "protocol_quarantined",
    );
  });

  it("keeps commit schema reference-content-free and rejects labels, chronology, caller metrics, weights, exclusions, and malformed coordinates", () => {
    const forbiddenFields = [
      ["declaredReference", { labels: ["secret"] }],
      ["producedAt", "2026-01-03T00:00:00.000Z"],
      ["metrics", { factRecall: "1.0" }],
      ["counts", { truePositiveFactCount: 1_000 }],
      ["weights", [1]],
      ["exclusions", ["synthetic-filing-0100"]],
      ["assertionOutcomes", [true]],
    ] as const;
    for (const [key, value] of forbiddenFields) {
      const harness = mutableHarness();
      harness.candidateObservations[key] = value;
      expectCommitQuarantine(encodeHarness(harness));
    }

    const mutations: Array<(harness: MutableHarness) => void> = [
      (harness) => {
        harness.candidateObservations.documentRole = "candidate_observations";
      },
      (harness) => {
        candidateDocuments(harness).reverse();
      },
      (harness) => {
        candidateDocuments(harness).push(
          jsonClone(candidateDocuments(harness)[0]!),
        );
      },
      (harness) => {
        candidateDocuments(harness)[0]!.documentId = "synthetic-filing-9999";
      },
      (harness) => {
        candidateDocuments(harness)[0]!.documentSha256 = zeroHash();
      },
      (harness) => {
        candidateFacts(harness, 0).reverse();
      },
      (harness) => {
        candidateFacts(harness, 0)[0]!.factKey = "unknown";
      },
      (harness) => {
        candidateFacts(harness, 0)[0]!.value = "01";
      },
      (harness) => {
        candidateFacts(harness, 0)[0]!.concept = "not-a-qname";
      },
      (harness) => {
        candidateFacts(harness, 0)[0]!.periodEnd = "2025-02-30";
      },
      (harness) => {
        const last = candidateDocuments(harness).at(-1)!;
        last.facts = [
          jsonClone(referenceFacts(harness.declaredReference, 99)[0]!),
        ];
      },
      (harness) => {
        candidateDocuments(harness).at(-1)!.quarantineCode = "excluded";
      },
    ];
    for (const mutate of mutations) {
      const harness = mutableHarness();
      mutate(harness);
      expectCommitQuarantine(encodeHarness(harness));
    }
  });

  it("rejects role swaps and malformed digest-bound references while distinguishing downstream measurement quarantine", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    expectQuarantined(
      createSyntheticFilingQualityPrecommitmentProtocol().commit(
        documents.candidateObservations,
        documents.plan,
      ),
      "protocol_quarantined",
    );
    expectQuarantined(
      createSyntheticFilingQualityPrecommitmentProtocol().commit(
        documents.plan,
        documents.declaredReference,
      ),
      "protocol_quarantined",
    );

    const malformedReference = new TextEncoder().encode('{"invalid":true}\n');
    const harness = mutableHarness();
    harness.candidateObservations.declaredReferenceSha256 =
      sha256(malformedReference);
    const encoded = encodeHarness(harness, false);
    const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const committed = expectCommitted(
      protocol.commit(encoded.plan, encoded.candidateObservations),
    );
    expectQuarantined(
      protocol.reveal(committed.capability, malformedReference),
      "measurement_quarantined",
    );
  });

  it("returns only fresh deeply frozen value-free quarantine and aggregate canary-safe receipts", () => {
    const expectedQuarantine = {
      audit: {
        documentObservationCount: 0,
        emittedFactCount: 0,
        outcome: "quarantined",
        quarantinedDocumentCount: 0,
        succeededDocumentCount: 0,
      },
      claim: FILING_QUALITY_PRECOMMITMENT_CLAIM,
      code: "protocol_quarantined",
      measurement: null,
      schemaVersion: FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
      status: "quarantined",
      synthetic: true,
    };
    const first = expectQuarantined(
      createSyntheticFilingQualityPrecommitmentProtocol().commit(
        "commit-canary",
        "candidate-canary",
      ),
      "protocol_quarantined",
    );
    const second = expectQuarantined(
      createSyntheticFilingQualityPrecommitmentProtocol().commit(
        "commit-canary",
        "candidate-canary",
      ),
      "protocol_quarantined",
    );
    expect(first).toStrictEqual(expectedQuarantine);
    expect(second).toStrictEqual(expectedQuarantine);
    expect(first).not.toBe(second);
    expect(JSON.stringify(first)).not.toContain("canary");
    expectDeepFrozen(first);

    const harness = mutableHarness();
    candidateFacts(harness, 0)[0]!.concept = "Leak:CommitCanary";
    const encoded = encodeHarness(harness);
    const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const committed = expectCommitted(
      protocol.commit(encoded.plan, encoded.candidateObservations),
    );
    const evaluated = expectEvaluated(
      protocol.reveal(committed.capability, encoded.declaredReference),
    );
    expect(JSON.stringify(committed)).not.toContain("CommitCanary");
    expect(JSON.stringify(evaluated)).not.toContain("CommitCanary");
    expect(Object.keys(evaluated).sort()).toStrictEqual([
      "candidateCommitmentSha256",
      "candidateObservationsSha256",
      "claim",
      "evaluationBindingSha256",
      "measurement",
      "planSha256",
      "schemaVersion",
      "status",
      "synthetic",
    ]);
    expectDeepFrozen(committed);
    expectDeepFrozen(evaluated);
  });
});

function mutableHarness(): MutableHarness {
  const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
  return {
    candidateObservations: decodeSyntheticFilingQualityPrecommitmentDocument(
      documents.candidateObservations,
    ),
    declaredReference: decodeSyntheticFilingQualityPrecommitmentDocument(
      documents.declaredReference,
    ),
    plan: decodeSyntheticFilingQualityPrecommitmentDocument(documents.plan),
  };
}

function encodeHarness(
  harness: MutableHarness,
  bindReference = true,
): EncodedHarness {
  const plan = canonicalSyntheticFilingQualityPrecommitmentDocument(
    harness.plan,
  );
  harness.candidateObservations.planSha256 = sha256(plan);
  const declaredReference =
    canonicalSyntheticFilingQualityPrecommitmentDocument(
      harness.declaredReference,
    );
  if (bindReference) {
    harness.candidateObservations.declaredReferenceSha256 =
      sha256(declaredReference);
  }
  return {
    candidateObservations: canonicalSyntheticFilingQualityPrecommitmentDocument(
      harness.candidateObservations,
    ),
    declaredReference,
    plan,
  };
}

function candidateDocuments(harness: MutableHarness): MutableRecord[] {
  return recordsOf(harness.candidateObservations.documentObservations);
}

function candidateFacts(
  harness: MutableHarness,
  documentIndex: number,
): MutableRecord[] {
  return recordsOf(candidateDocuments(harness)[documentIndex]!.facts);
}

function referenceFacts(
  reference: MutableRecord,
  documentIndex: number,
): MutableRecord[] {
  const documents = recordsOf(reference.documents);
  return recordsOf(documents[documentIndex]!.facts);
}

function recordOf(value: unknown): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError("Expected an object fixture.");
  return value as MutableRecord;
}

function recordsOf(value: unknown): MutableRecord[] {
  if (!Array.isArray(value)) throw new TypeError("Expected an array fixture.");
  value.forEach(recordOf);
  return value as MutableRecord[];
}

function withTypedArrayDataShadows(bytes: Uint8Array): Uint8Array {
  Object.defineProperties(bytes, {
    buffer: {
      configurable: true,
      value: new ArrayBuffer(1),
    },
    byteLength: {
      configurable: true,
      value: 1,
    },
  });
  return bytes;
}

function withTypedArrayConstructorTrap(
  source: Uint8Array,
  trapKind: "constructor" | "species",
  onAccess: () => void,
): Uint8Array {
  const bytes = new Uint8Array(source);
  const failOnAccess = (): never => {
    onAccess();
    throw new Error("Caller-controlled typed-array constructor was accessed.");
  };
  if (trapKind === "constructor") {
    Object.defineProperty(bytes, "constructor", {
      configurable: true,
      get: failOnAccess,
    });
  } else {
    const constructor = {};
    Object.defineProperty(constructor, Symbol.species, {
      configurable: true,
      get: failOnAccess,
    });
    Object.defineProperty(bytes, "constructor", {
      configurable: true,
      value: constructor,
    });
  }
  return bytes;
}

function sharedCopy(source: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(new SharedArrayBuffer(source.byteLength));
  bytes.set(source);
  return bytes;
}

function jsonClone(value: MutableRecord): MutableRecord {
  return recordOf(JSON.parse(JSON.stringify(value)) as unknown);
}

function expectCommitQuarantine(encoded: EncodedHarness): void {
  expectQuarantined(
    createSyntheticFilingQualityPrecommitmentProtocol().commit(
      encoded.plan,
      encoded.candidateObservations,
    ),
    "protocol_quarantined",
  );
}

function expectCommitted(
  value: unknown,
): FilingQualityPrecommitmentCommittedResult {
  expect(recordOf(value).status).toBe("candidate_committed");
  return value as FilingQualityPrecommitmentCommittedResult;
}

function expectEvaluated(
  value: unknown,
): FilingQualityPrecommitmentEvaluatedResult {
  expect(recordOf(value).status).toBe("evaluated");
  return value as FilingQualityPrecommitmentEvaluatedResult;
}

function expectQuarantined(
  value: unknown,
  code: "measurement_quarantined" | "protocol_quarantined",
): FilingQualityPrecommitmentQuarantinedResult {
  expect(recordOf(value).status).toBe("quarantined");
  const result = value as FilingQualityPrecommitmentQuarantinedResult;
  expect(result).toStrictEqual({
    audit: {
      documentObservationCount: 0,
      emittedFactCount: 0,
      outcome: "quarantined",
      quarantinedDocumentCount: 0,
      succeededDocumentCount: 0,
    },
    claim: FILING_QUALITY_PRECOMMITMENT_CLAIM,
    code,
    measurement: null,
    schemaVersion: FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
    status: "quarantined",
    synthetic: true,
  });
  expectDeepFrozen(result);
  return result;
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function domainHash(domain: Uint8Array, bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(domain)
    .update(bytes)
    .digest("hex")}`;
}

function zeroHash(): `sha256:${string}` {
  return `sha256:${"0".repeat(64)}`;
}

function textOf(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const result = new Uint8Array(first.byteLength + second.byteLength);
  result.set(first, 0);
  result.set(second, first.byteLength);
  return result;
}
