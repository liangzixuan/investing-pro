import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS,
  FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES,
  FILING_QUALITY_MEASUREMENT_CHECKS,
  FILING_QUALITY_MEASUREMENT_CLAIM,
  FILING_QUALITY_MEASUREMENT_DECLARATIONS,
  FILING_QUALITY_MEASUREMENT_FACT_KEYS,
  FILING_QUALITY_MEASUREMENT_LIMITS,
  FILING_QUALITY_MEASUREMENT_METRICS,
  FILING_QUALITY_MEASUREMENT_NOT_PROVEN,
  FILING_QUALITY_MEASUREMENT_QUARANTINE_CODES,
  FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
  FILING_QUALITY_MEASUREMENT_THRESHOLDS,
  measureSyntheticFilingQuality,
  type FilingQualityMeasurementEvaluatedResult,
  type FilingQualityMeasurementQuarantineCode,
  type FilingQualityMeasurementQuarantinedResult,
  type FilingQualityMeasurementResult,
} from "./filing-quality-measurement";
import {
  buildSyntheticFilingQualityMeasurementDocuments,
  canonicalSyntheticFilingQualityMeasurementDocument,
  decodeSyntheticFilingQualityMeasurementDocument,
} from "./test-filing-quality-measurement-builder";

type MutableRecord = Record<string, unknown>;

interface MutableHarness {
  readonly candidate: MutableRecord;
  readonly declaredReference: MutableRecord;
  readonly plan: MutableRecord;
}

interface EncodedHarness {
  readonly candidate: Uint8Array;
  readonly declaredReference: Uint8Array;
  readonly plan: Uint8Array;
}

const invokeMeasurement: (
  ...args: readonly unknown[]
) => FilingQualityMeasurementResult = measureSyntheticFilingQuality;

const EXACT_CHECKS = [
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
] as const;

const EXACT_NONCLAIMS = [
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
] as const;

describe("Cycle 2f filing quality measurement security boundary", () => {
  it("freezes the exact bounded claim, policy, population, declarations, checks, and nonclaims", () => {
    expect(FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_QUALITY_MEASUREMENT_CLAIM).toBe(
      "bounded_synthetic_fixed_population_declared_reference_quality_metric_accounting_and_fail_closed_threshold_evaluation",
    );
    expect(FILING_QUALITY_MEASUREMENT_FACT_KEYS).toStrictEqual([
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
    ]);
    expect(FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS).toStrictEqual([
      "semantic_value_presence",
      "exact_unit_period",
    ]);
    expect(FILING_QUALITY_MEASUREMENT_METRICS).toStrictEqual([
      "document_success",
      "fact_precision",
      "fact_recall",
      "unit_date_tolerance",
      "silent_critical_failure",
      "quarantine_rate",
    ]);
    expect(FILING_QUALITY_MEASUREMENT_THRESHOLDS).toStrictEqual({
      dateToleranceDays: 0,
      documentSuccessMinimum: { denominator: 100, numerator: 95 },
      factPrecisionMinimum: { denominator: 100, numerator: 99 },
      factRecallMinimum: { denominator: 100, numerator: 99 },
      maximumQuarantineRate: { denominator: 100, numerator: 5 },
      maximumSilentCriticalFailures: 0,
      unitTolerancePolicy: "exact_canonical_unit.v1",
    });
    expect(FILING_QUALITY_MEASUREMENT_LIMITS).toStrictEqual({
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
    expect(FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES).toStrictEqual(
      [
        "comparison_conflict",
        "normalization_failure",
        "parser_failure",
        "validator_quarantine",
      ],
    );
    expect(FILING_QUALITY_MEASUREMENT_QUARANTINE_CODES).toStrictEqual([
      "input_invalid",
      "plan_invalid",
      "declared_reference_invalid",
      "candidate_invalid",
      "binding_invalid",
      "measurement_failure",
    ]);
    expect(FILING_QUALITY_MEASUREMENT_CHECKS).toStrictEqual(EXACT_CHECKS);
    expect(FILING_QUALITY_MEASUREMENT_NOT_PROVEN).toStrictEqual(
      EXACT_NONCLAIMS,
    );
    expect(FILING_QUALITY_MEASUREMENT_DECLARATIONS).toStrictEqual({
      candidate: {
        declarationSha256:
          "sha256:c254e5f327be470a72f9feb206a7c34341b5020cf425592199a17fb4122e4b2a",
        id: "synthetic-filing-quality-candidate",
        role: "declared-candidate",
        version: "1.0.0",
      },
      declaredAdjudicators: [
        {
          declarationSha256:
            "sha256:2e13475902f4e9a22a4b7c74b4bf07a4104fc91349909b32105f17750ce91d1c",
          id: "synthetic-filing-quality-adjudicator-a",
          role: "declared-adjudicator-a",
          version: "1.0.0",
        },
        {
          declarationSha256:
            "sha256:11525b220ae5b8bc1c28a8cf9398b870c210008f96835062c1ef02016ad25a47",
          id: "synthetic-filing-quality-adjudicator-b",
          role: "declared-adjudicator-b",
          version: "1.0.0",
        },
      ],
    });
    expectDeepFrozen(FILING_QUALITY_MEASUREMENT_THRESHOLDS);
    expectDeepFrozen(FILING_QUALITY_MEASUREMENT_LIMITS);
    expectDeepFrozen(FILING_QUALITY_MEASUREMENT_DECLARATIONS);
  });

  it("accounts the exact 100/1000/2000 declared-reference-owned population at the recall boundary", () => {
    const encoded = encodedHarness(mutableHarness());
    const result = expectEvaluated(measureEncoded(encoded));

    expect(result.syntheticPilotThresholdOutcome).toBe("met");
    expect(result.failedThresholds).toStrictEqual([]);
    expect(result.counts).toStrictEqual({
      conceptMismatchCount: 0,
      criticalAssertionCount: 2_000,
      dimensionMismatchCount: 0,
      documentCount: 100,
      emittedFactCount: 990,
      expectedFactCount: 1_000,
      falseNegativeFactCount: 10,
      falsePositiveFactCount: 0,
      missingDocumentCount: 0,
      missingFactCount: 10,
      periodMismatchCount: 0,
      quarantinedDocumentCount: 1,
      semanticAssertionPassCount: 990,
      silentCriticalFailureCount: 0,
      succeededDocumentCount: 99,
      truePositiveFactCount: 990,
      unitMismatchCount: 0,
      unitPeriodAssertionPassCount: 990,
      valueMismatchCount: 0,
    });
    expect(result.metrics).toStrictEqual({
      documentSuccess: ratio(99, 100, 95, 100, "minimum", true),
      factPrecision: ratio(990, 990, 99, 100, "minimum", true),
      factRecall: ratio(990, 1_000, 99, 100, "minimum", true),
      quarantineRate: ratio(1, 100, 5, 100, "maximum", true),
      silentCriticalFailure: {
        count: 0,
        denominator: 2_000,
        maximumCount: 0,
        met: true,
      },
      unitDateTolerance: {
        dateToleranceDays: 0,
        periodMismatchCount: 0,
        unitMismatchCount: 0,
        unitTolerancePolicy: "exact_canonical_unit.v1",
      },
    });
    expect(result.planSha256).toBe(sha256(encoded.plan));
    expect(result.declaredReferenceSha256).toBe(
      sha256(encoded.declaredReference),
    );
    expect(result.candidateSha256).toBe(sha256(encoded.candidate));
    expect(result.evaluationSha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect("basisPoints" in result.metrics.factRecall).toBe(false);
    expect("rate" in result.metrics.silentCriticalFailure).toBe(false);
  });

  it("requires exact fixed argument roles, arity, wrapper declarations, hashes, and chronology", () => {
    const encoded = encodedHarness(mutableHarness());
    const invoke: (
      ...args: readonly unknown[]
    ) => FilingQualityMeasurementResult = measureSyntheticFilingQuality;
    for (const args of [
      [],
      [encoded.plan],
      [encoded.plan, encoded.declaredReference],
      [
        encoded.plan,
        encoded.declaredReference,
        encoded.candidate,
        encoded.candidate,
      ],
    ]) {
      expectQuarantined(invoke(...args), "input_invalid");
    }
    for (const args of [
      [encoded.declaredReference, encoded.plan, encoded.candidate],
      [encoded.plan, encoded.candidate, encoded.declaredReference],
      [encoded.candidate, encoded.declaredReference, encoded.plan],
    ]) {
      expect(invoke(...args).status).toBe("quarantined");
    }

    const mutations: Array<{
      readonly code: FilingQualityMeasurementQuarantineCode;
      readonly mutate: (harness: MutableHarness) => void;
    }> = [
      {
        code: "plan_invalid",
        mutate: (harness) => {
          harness.plan.documentRole = "declared_reference";
        },
      },
      {
        code: "plan_invalid",
        mutate: (harness) => {
          harness.plan.frozenAt = "2026-01-02T00:00:00.000Z";
        },
      },
      {
        code: "plan_invalid",
        mutate: (harness) => {
          const declarations = arrayOf(harness.plan.declaredAdjudicators);
          declarations.reverse();
        },
      },
      {
        code: "binding_invalid",
        mutate: (harness) => {
          harness.declaredReference.planSha256 = zeroHash();
        },
      },
      {
        code: "binding_invalid",
        mutate: (harness) => {
          harness.declaredReference.declaredAt = "2026-01-01T00:00:00.000Z";
        },
      },
      {
        code: "binding_invalid",
        mutate: (harness) => {
          harness.candidate.planSha256 = zeroHash();
        },
      },
      {
        code: "binding_invalid",
        mutate: (harness) => {
          harness.candidate.declaredReferenceSha256 = zeroHash();
        },
      },
      {
        code: "binding_invalid",
        mutate: (harness) => {
          harness.candidate.producedAt = "2026-01-02T00:00:00.000Z";
        },
      },
      {
        code: "binding_invalid",
        mutate: (harness) => {
          const declaration = recordOf(harness.candidate.candidateDeclaration);
          declaration.role = "declared-adjudicator-a";
        },
      },
      {
        code: "binding_invalid",
        mutate: (harness) => {
          candidateDocuments(harness)[0]!.documentSha256 = zeroHash();
        },
      },
    ];
    for (const { code, mutate } of mutations) {
      const harness = mutableHarness();
      mutate(harness);
      expectQuarantined(measureMutable(harness), code);
    }
  });

  it("rejects every attempt to reorder or weaken the fixed plan arrays, counts, and thresholds", () => {
    const mutations: Array<(harness: MutableHarness) => void> = [
      (harness) => {
        arrayOf(harness.plan.factKeys).reverse();
      },
      (harness) => {
        arrayOf(harness.plan.assertionKinds).reverse();
      },
      (harness) => {
        arrayOf(harness.plan.metrics).reverse();
      },
      (harness) => {
        arrayOf(harness.plan.candidateStatuses).reverse();
      },
      (harness) => {
        harness.plan.documentTarget = 99;
      },
      (harness) => {
        harness.plan.factTarget = 999;
      },
      (harness) => {
        harness.plan.assertionTarget = 1_999;
      },
      (harness) => {
        recordOf(harness.plan.thresholds).documentSuccessMinimum = "0.94";
      },
      (harness) => {
        recordOf(harness.plan.thresholds).factPrecisionMinimum = "0.98";
      },
      (harness) => {
        recordOf(harness.plan.thresholds).factRecallMinimum = "0.98";
      },
      (harness) => {
        recordOf(harness.plan.thresholds).maximumQuarantineRate = "0.06";
      },
      (harness) => {
        recordOf(harness.plan.thresholds).maximumSilentCriticalFailures = 1;
      },
      (harness) => {
        recordOf(harness.plan.thresholds).dateToleranceDays = 1;
      },
      (harness) => {
        recordOf(harness.plan.thresholds).unitTolerancePolicy = "compatible";
      },
      (harness) => {
        const candidate = recordOf(harness.plan.declaredCandidate);
        candidate.declarationSha256 = zeroHash();
      },
    ];
    for (const mutate of mutations) {
      const harness = mutableHarness();
      mutate(harness);
      expectQuarantined(measureMutable(harness), "plan_invalid");
    }
  });

  it("rejects caller-supplied metrics, counts, exclusions, labels, and other closed-schema escapes", () => {
    const mutations: Array<{
      readonly code: FilingQualityMeasurementQuarantineCode;
      readonly mutate: (harness: MutableHarness) => void;
    }> = [
      {
        code: "plan_invalid",
        mutate: (harness) => {
          harness.plan.exclusions = [];
        },
      },
      {
        code: "plan_invalid",
        mutate: (harness) => {
          harness.plan.pass = true;
        },
      },
      {
        code: "declared_reference_invalid",
        mutate: (harness) => {
          harness.declaredReference.metrics = {};
        },
      },
      {
        code: "declared_reference_invalid",
        mutate: (harness) => {
          referenceFacts(harness, 0)[0]!.adjudicatorLabel = "expected";
        },
      },
      {
        code: "candidate_invalid",
        mutate: (harness) => {
          harness.candidate.counts = { truePositiveFactCount: 1_000 };
        },
      },
      {
        code: "candidate_invalid",
        mutate: (harness) => {
          harness.candidate.referenceValues = [];
        },
      },
      {
        code: "candidate_invalid",
        mutate: (harness) => {
          candidateFacts(harness, 0)[0]!.expected = "leaked-label";
        },
      },
      {
        code: "candidate_invalid",
        mutate: (harness) => {
          candidateDocuments(harness)[0]!.unscored = true;
        },
      },
    ];
    for (const { code, mutate } of mutations) {
      const harness = mutableHarness();
      mutate(harness);
      expectQuarantined(measureMutable(harness), code);
    }
  });

  it("makes the declared reference own exactly 100 unique documents, 1,000 facts, and 2,000 derived assertions", () => {
    const mutations: Array<(harness: MutableHarness) => void> = [
      (harness) => {
        referenceDocuments(harness).pop();
      },
      (harness) => {
        referenceDocuments(harness).push(
          jsonClone(referenceDocuments(harness)[0]!),
        );
      },
      (harness) => {
        referenceDocuments(harness).reverse();
      },
      (harness) => {
        referenceDocuments(harness)[1]!.documentId =
          referenceDocuments(harness)[0]!.documentId;
      },
      (harness) => {
        referenceDocuments(harness)[1]!.documentSha256 =
          referenceDocuments(harness)[0]!.documentSha256;
      },
      (harness) => {
        referenceFacts(harness, 0).pop();
      },
      (harness) => {
        referenceFacts(harness, 0).push(
          jsonClone(referenceFacts(harness, 0)[0]!),
        );
      },
      (harness) => {
        referenceFacts(harness, 0).reverse();
      },
      (harness) => {
        referenceFacts(harness, 0)[0]!.factKey = "unknown_key";
      },
      (harness) => {
        harness.declaredReference.documentCount = 99;
      },
      (harness) => {
        harness.declaredReference.factCount = 999;
      },
      (harness) => {
        harness.declaredReference.criticalAssertionCount = 1_999;
      },
    ];
    for (const mutate of mutations) {
      const harness = mutableHarness();
      mutate(harness);
      expectQuarantined(measureMutable(harness), "declared_reference_invalid");
    }
  });

  it("rejects duplicate, reordered, unknown, reweighted, or forged candidate coordinates without repairing them", () => {
    const mutations: Array<{
      readonly code: FilingQualityMeasurementQuarantineCode;
      readonly mutate: (harness: MutableHarness) => void;
    }> = [
      {
        code: "candidate_invalid",
        mutate: (harness) => {
          candidateDocuments(harness).push(
            jsonClone(candidateDocuments(harness)[0]!),
          );
        },
      },
      {
        code: "candidate_invalid",
        mutate: (harness) => {
          candidateDocuments(harness).reverse();
        },
      },
      {
        code: "candidate_invalid",
        mutate: (harness) => {
          candidateDocuments(harness)[0]!.documentId = "synthetic-filing-9999";
        },
      },
      {
        code: "candidate_invalid",
        mutate: (harness) => {
          const facts = candidateFacts(harness, 0);
          facts.push(jsonClone(facts[0]!));
        },
      },
      {
        code: "candidate_invalid",
        mutate: (harness) => {
          candidateFacts(harness, 0).reverse();
        },
      },
      {
        code: "candidate_invalid",
        mutate: (harness) => {
          candidateFacts(harness, 0)[0]!.factKey = "unknown_key";
        },
      },
      {
        code: "candidate_invalid",
        mutate: (harness) => {
          candidateFacts(harness, 0)[1]!.factKey = candidateFacts(
            harness,
            0,
          )[0]!.factKey;
        },
      },
      {
        code: "binding_invalid",
        mutate: (harness) => {
          candidateDocuments(harness)[0]!.documentSha256 = sha256(
            new TextEncoder().encode("forged-document"),
          );
        },
      },
    ];
    for (const { code, mutate } of mutations) {
      const harness = mutableHarness();
      mutate(harness);
      expectQuarantined(measureMutable(harness), code);
    }
  });

  it("measures missing documents and partial succeeded documents instead of shrinking truth denominators", () => {
    const missing = mutableHarness();
    candidateDocuments(missing).shift();
    const missingResult = expectEvaluated(measureMutable(missing));
    expect(missingResult.syntheticPilotThresholdOutcome).toBe("not_met");
    expect(missingResult.counts.missingDocumentCount).toBe(1);
    expect(missingResult.counts.missingFactCount).toBe(20);
    expect(missingResult.counts.emittedFactCount).toBe(980);
    expect(missingResult.counts.truePositiveFactCount).toBe(980);
    expect(missingResult.counts.silentCriticalFailureCount).toBe(20);
    expect(missingResult.metrics.factRecall).toStrictEqual(
      ratio(980, 1_000, 99, 100, "minimum", false),
    );

    const partial = mutableHarness();
    candidateFacts(partial, 0).pop();
    const partialResult = expectEvaluated(measureMutable(partial));
    expect(partialResult.syntheticPilotThresholdOutcome).toBe("not_met");
    expect(partialResult.counts.emittedFactCount).toBe(989);
    expect(partialResult.counts.truePositiveFactCount).toBe(989);
    expect(partialResult.counts.falsePositiveFactCount).toBe(0);
    expect(partialResult.counts.falseNegativeFactCount).toBe(11);
    expect(partialResult.counts.missingFactCount).toBe(11);
    expect(partialResult.counts.silentCriticalFailureCount).toBe(2);
    expect(partialResult.metrics.factPrecision).toStrictEqual(
      ratio(989, 989, 99, 100, "minimum", true),
    );
    expect(partialResult.failedThresholds).toStrictEqual([
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ]);
  });

  it("measures well-formed semantic, context, value, unit, and date errors as FP plus FN and silent failures", () => {
    const cases: Array<{
      readonly countKey:
        | "conceptMismatchCount"
        | "dimensionMismatchCount"
        | "periodMismatchCount"
        | "unitMismatchCount"
        | "valueMismatchCount";
      readonly mutate: (fact: MutableRecord) => void;
      readonly semanticPasses: number;
      readonly unitPeriodPasses: number;
    }> = [
      {
        countKey: "conceptMismatchCount",
        mutate: (fact) => {
          fact.concept = "rc-synthetic:DifferentConcept";
        },
        semanticPasses: 989,
        unitPeriodPasses: 990,
      },
      {
        countKey: "dimensionMismatchCount",
        mutate: (fact) => {
          fact.dimensions = [{ axis: "SegmentAxis", member: "RetailMember" }];
        },
        semanticPasses: 989,
        unitPeriodPasses: 990,
      },
      {
        countKey: "valueMismatchCount",
        mutate: (fact) => {
          fact.value = "987654321";
        },
        semanticPasses: 989,
        unitPeriodPasses: 990,
      },
      {
        countKey: "unitMismatchCount",
        mutate: (fact) => {
          fact.unit = "shares";
        },
        semanticPasses: 990,
        unitPeriodPasses: 989,
      },
      {
        countKey: "periodMismatchCount",
        mutate: (fact) => {
          fact.periodEnd = "2025-12-30";
        },
        semanticPasses: 990,
        unitPeriodPasses: 989,
      },
    ];
    for (const testCase of cases) {
      const harness = mutableHarness();
      testCase.mutate(candidateFacts(harness, 0)[0]!);
      const result = expectEvaluated(measureMutable(harness));
      expect(result.syntheticPilotThresholdOutcome).toBe("not_met");
      expect(result.counts[testCase.countKey]).toBe(1);
      expect(result.counts.truePositiveFactCount).toBe(989);
      expect(result.counts.falsePositiveFactCount).toBe(1);
      expect(result.counts.falseNegativeFactCount).toBe(11);
      expect(result.counts.silentCriticalFailureCount).toBe(1);
      expect(result.counts.semanticAssertionPassCount).toBe(
        testCase.semanticPasses,
      );
      expect(result.counts.unitPeriodAssertionPassCount).toBe(
        testCase.unitPeriodPasses,
      );
      expect(result.status).toBe("evaluated");
    }
  });

  it("keeps valid not-met measurements out of malformed-input quarantine", () => {
    const harness = mutableHarness();
    candidateFacts(harness, 0)[0]!.value = "999999999";
    const result = expectEvaluated(measureMutable(harness));
    expect(result.syntheticPilotThresholdOutcome).toBe("not_met");
    expect(result.failedThresholds).toStrictEqual([
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ]);
    expect("code" in result).toBe(false);
    expect("audit" in result).toBe(false);
  });

  it("enforces coherent explicit quarantine and cannot relabel silent omissions away", () => {
    const one = expectEvaluated(measureMutable(mutableHarness()));
    expect(one.syntheticPilotThresholdOutcome).toBe("met");
    expect(one.counts.quarantinedDocumentCount).toBe(1);
    expect(one.counts.silentCriticalFailureCount).toBe(0);

    const twoHarness = mutableHarness();
    makePerfectCandidate(twoHarness);
    quarantineLast(twoHarness, 2);
    const two = expectEvaluated(measureMutable(twoHarness));
    expect(two.metrics.documentSuccess.met).toBe(true);
    expect(two.metrics.quarantineRate.met).toBe(true);
    expect(two.metrics.factRecall.met).toBe(false);
    expect(two.counts.silentCriticalFailureCount).toBe(0);
    expect(two.syntheticPilotThresholdOutcome).toBe("not_met");

    const acceptedEmpty = mutableHarness();
    const last = candidateDocuments(acceptedEmpty).at(-1)!;
    delete last.quarantineCode;
    last.status = "succeeded";
    const acceptedEmptyResult = expectEvaluated(measureMutable(acceptedEmpty));
    expect(acceptedEmptyResult.counts.quarantinedDocumentCount).toBe(0);
    expect(acceptedEmptyResult.counts.succeededDocumentCount).toBe(100);
    expect(acceptedEmptyResult.counts.silentCriticalFailureCount).toBe(20);
    expect(acceptedEmptyResult.syntheticPilotThresholdOutcome).toBe("not_met");

    const nonemptyQuarantine = mutableHarness();
    candidateDocuments(nonemptyQuarantine).at(-1)!.facts = [
      jsonClone(referenceFacts(nonemptyQuarantine, 99)[0]!),
    ];
    expectQuarantined(measureMutable(nonemptyQuarantine), "candidate_invalid");

    const unknownCode = mutableHarness();
    candidateDocuments(unknownCode).at(-1)!.quarantineCode = "excluded";
    expectQuarantined(measureMutable(unknownCode), "candidate_invalid");
  });

  it("uses exact integer threshold boundaries for document success and quarantine rate", () => {
    const fiveHarness = mutableHarness();
    makePerfectCandidate(fiveHarness);
    quarantineLast(fiveHarness, 5);
    const five = expectEvaluated(measureMutable(fiveHarness));
    expect(five.metrics.documentSuccess).toStrictEqual(
      ratio(95, 100, 95, 100, "minimum", true),
    );
    expect(five.metrics.quarantineRate).toStrictEqual(
      ratio(5, 100, 5, 100, "maximum", true),
    );

    const sixHarness = mutableHarness();
    makePerfectCandidate(sixHarness);
    quarantineLast(sixHarness, 6);
    const six = expectEvaluated(measureMutable(sixHarness));
    expect(six.metrics.documentSuccess).toStrictEqual(
      ratio(94, 100, 95, 100, "minimum", false),
    );
    expect(six.metrics.quarantineRate).toStrictEqual(
      ratio(6, 100, 5, 100, "maximum", false),
    );
  });

  it("uses exact integer threshold boundaries for recall and precision without rounding", () => {
    const recallMet = expectEvaluated(measureMutable(mutableHarness()));
    expect(recallMet.metrics.factRecall).toStrictEqual(
      ratio(990, 1_000, 99, 100, "minimum", true),
    );

    const recallMissHarness = mutableHarness();
    candidateFacts(recallMissHarness, 0)[0]!.value = "333333333";
    const recallMiss = expectEvaluated(measureMutable(recallMissHarness));
    expect(recallMiss.metrics.factRecall).toStrictEqual(
      ratio(989, 1_000, 99, 100, "minimum", false),
    );

    const precisionBoundaryHarness = mutableHarness();
    makePerfectCandidate(precisionBoundaryHarness);
    precisionBoundaryHarness.candidate.documentObservations =
      candidateDocuments(precisionBoundaryHarness).slice(0, 10);
    candidateFacts(precisionBoundaryHarness, 0)[0]!.value = "444444444";
    const precisionBoundary = expectEvaluated(
      measureMutable(precisionBoundaryHarness),
    );
    expect(precisionBoundary.metrics.factPrecision).toStrictEqual(
      ratio(99, 100, 99, 100, "minimum", true),
    );

    const roundingTrapHarness = mutableHarness();
    makePerfectCandidate(roundingTrapHarness);
    candidateFacts(roundingTrapHarness, 99).pop();
    for (let index = 0; index < 10; index += 1)
      candidateFacts(roundingTrapHarness, index)[0]!.value = String(
        700_000_000 + index,
      );
    const roundingTrap = expectEvaluated(measureMutable(roundingTrapHarness));
    expect(roundingTrap.metrics.factPrecision).toStrictEqual(
      ratio(989, 999, 99, 100, "minimum", false),
    );
    expect(roundingTrap.metrics.factPrecision.met).toBe(false);
  });

  it("represents zero-denominator precision as undefined and fail-closed, never NaN", () => {
    const harness = mutableHarness();
    harness.candidate.documentObservations = [];
    const result = expectEvaluated(measureMutable(harness));
    expect(result.metrics.factPrecision).toStrictEqual(
      ratio(0, 0, 99, 100, "minimum", false, false),
    );
    expect(result.syntheticPilotThresholdOutcome).toBe("not_met");
    expect(result.counts.missingDocumentCount).toBe(100);
    expect(result.counts.missingFactCount).toBe(1_000);
    expect(result.counts.silentCriticalFailureCount).toBe(2_000);
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/u);
  });

  it("rejects malformed decimals while measuring canonical decimal differences", () => {
    for (const value of [
      "-0",
      "0.0",
      "1.0",
      "1.230",
      "01",
      "1.",
      "1e2",
      "+1",
      "1".repeat(27),
      `0.${"1".repeat(13)}`,
    ]) {
      const harness = mutableHarness();
      candidateFacts(harness, 0)[0]!.value = value;
      expectQuarantined(measureMutable(harness), "candidate_invalid");
    }
    for (const value of [1, -0]) {
      const harness = mutableHarness();
      candidateFacts(harness, 0)[0]!.value = value;
      expectQuarantined(measureMutable(harness), "candidate_invalid");
    }

    for (const token of ["NaN", "Infinity", "-Infinity", "1e999999"]) {
      const encoded = encodedHarness(mutableHarness());
      const candidateText = textOf(encoded.candidate).replace(
        /"value":"[0-9]+"/u,
        `"value":${token}`,
      );
      expectQuarantined(
        measureSyntheticFilingQuality(
          encoded.plan,
          encoded.declaredReference,
          new TextEncoder().encode(candidateText),
        ),
        "candidate_invalid",
      );
    }

    const mismatch = mutableHarness();
    candidateFacts(mismatch, 0)[0]!.value = "1.23";
    const measured = expectEvaluated(measureMutable(mismatch));
    expect(measured.counts.valueMismatchCount).toBe(1);
    expect(measured.syntheticPilotThresholdOutcome).toBe("not_met");
  });

  it("rejects malformed Gregorian periods, concepts, units, and dimensions", () => {
    const mutations: Array<(fact: MutableRecord) => void> = [
      (fact) => {
        fact.periodEnd = "2025-02-29";
      },
      (fact) => {
        fact.periodEnd = "2024-02-30";
      },
      (fact) => {
        fact.periodEnd = "2025-13-01";
      },
      (fact) => {
        fact.periodEnd = "2025-12-31T00:00:00.000Z";
      },
      (fact) => {
        fact.periodStart = "2026-01-01";
      },
      (fact) => {
        fact.concept = "MissingNamespace";
      },
      (fact) => {
        fact.unit = "USD rounded";
      },
      (fact) => {
        fact.dimensions = [
          { axis: "SegmentAxis", member: "RetailMember" },
          { axis: "SegmentAxis", member: "WholesaleMember" },
        ];
      },
      (fact) => {
        fact.dimensions = [
          { axis: "ZAxis", member: "Member" },
          { axis: "AAxis", member: "Member" },
        ];
      },
      (fact) => {
        fact.dimensions = Array.from({ length: 5 }, (_, index) => ({
          axis: `Axis${index}`,
          member: `Member${index}`,
        }));
      },
    ];
    for (const mutate of mutations) {
      const harness = mutableHarness();
      mutate(candidateFacts(harness, 0)[0]!);
      expectQuarantined(measureMutable(harness), "candidate_invalid");
    }
  });

  it("rejects invalid byte carriers, alternate views, subclasses, proxies, empty inputs, and oversize inputs", () => {
    const encoded = encodedHarness(mutableHarness());
    class ByteSubclass extends Uint8Array {}
    const invalidInputs: unknown[] = [
      Buffer.from(encoded.plan),
      new DataView(
        encoded.plan.buffer,
        encoded.plan.byteOffset,
        encoded.plan.byteLength,
      ),
      new Int8Array(encoded.plan),
      new ByteSubclass(encoded.plan),
      new Proxy(encoded.plan, {}),
      new Uint8Array(new SharedArrayBuffer(encoded.plan.byteLength)),
      {},
      null,
      "bytes",
      new Uint8Array(),
    ];
    for (const invalidInput of invalidInputs) {
      expectQuarantined(
        measureSyntheticFilingQuality(
          invalidInput,
          encoded.declaredReference,
          encoded.candidate,
        ),
        "input_invalid",
      );
    }

    for (const [position, maximum] of [
      [0, FILING_QUALITY_MEASUREMENT_LIMITS.planBytes],
      [1, FILING_QUALITY_MEASUREMENT_LIMITS.declaredReferenceBytes],
      [2, FILING_QUALITY_MEASUREMENT_LIMITS.candidateBytes],
    ] as const) {
      const args: unknown[] = [
        encoded.plan,
        encoded.declaredReference,
        encoded.candidate,
      ];
      args[position] = new Uint8Array(maximum + 1);
      expectQuarantined(invokeMeasurement(...args), "input_invalid");
    }
  });

  it("uses intrinsic buffer and length metadata for every byte role", () => {
    const encoded = encodedHarness(mutableHarness());
    for (const [role, maximum] of [
      ["plan", FILING_QUALITY_MEASUREMENT_LIMITS.planBytes],
      [
        "declaredReference",
        FILING_QUALITY_MEASUREMENT_LIMITS.declaredReferenceBytes,
      ],
      ["candidate", FILING_QUALITY_MEASUREMENT_LIMITS.candidateBytes],
    ] as const) {
      const original = encoded[role];
      const shared = new Uint8Array(new SharedArrayBuffer(original.byteLength));
      shared.set(original);
      Object.defineProperties(shared, {
        buffer: { value: new ArrayBuffer(original.byteLength) },
        byteLength: { value: original.byteLength },
      });
      expectQuarantined(
        measureEncoded({ ...encoded, [role]: shared }),
        "input_invalid",
      );

      const oversized = new Uint8Array(maximum + 1);
      oversized.set(original);
      Object.defineProperties(oversized, {
        buffer: { value: new ArrayBuffer(original.byteLength) },
        byteLength: { value: original.byteLength },
      });
      expectQuarantined(
        measureEncoded({ ...encoded, [role]: oversized }),
        "input_invalid",
      );
    }
  });

  it("never invokes own constructor or species hooks while snapshotting any byte role", () => {
    const encoded = encodedHarness(mutableHarness());
    for (const role of ["plan", "declaredReference", "candidate"] as const) {
      let constructorCalls = 0;
      let constructorReentry: FilingQualityMeasurementResult | undefined;
      const constructorCarrier = Uint8Array.from(encoded[role]);
      Object.defineProperty(constructorCarrier, "constructor", {
        get() {
          constructorCalls += 1;
          constructorReentry = measureEncoded(encoded);
          return Uint8Array;
        },
      });
      expectEvaluated(
        measureEncoded({ ...encoded, [role]: constructorCarrier }),
      );
      expect(constructorCalls, role).toBe(0);
      expect(constructorReentry, role).toBeUndefined();

      let speciesCalls = 0;
      let speciesReentry: FilingQualityMeasurementResult | undefined;
      const speciesCarrier = Uint8Array.from(encoded[role]);
      const constructor = {};
      Object.defineProperty(constructor, Symbol.species, {
        get() {
          speciesCalls += 1;
          speciesReentry = measureEncoded(encoded);
          return Uint8Array;
        },
      });
      Object.defineProperty(speciesCarrier, "constructor", {
        value: constructor,
      });
      expectEvaluated(measureEncoded({ ...encoded, [role]: speciesCarrier }));
      expect(speciesCalls, role).toBe(0);
      expect(speciesReentry, role).toBeUndefined();
    }
  });

  it("rejects proxies before invoking a getPrototypeOf reentry trap in every byte role", () => {
    const encoded = encodedHarness(mutableHarness());
    for (const role of ["plan", "declaredReference", "candidate"] as const) {
      let trapCalls = 0;
      let reentry: FilingQualityMeasurementResult | undefined;
      const carrier = new Proxy(encoded[role], {
        getPrototypeOf() {
          trapCalls += 1;
          reentry = measureEncoded(encoded);
          throw new TypeError("Proxy prototype trap must not execute.");
        },
      });
      expectQuarantined(
        measureEncoded({ ...encoded, [role]: carrier }),
        "input_invalid",
      );
      expect(trapCalls, role).toBe(0);
      expect(reentry, role).toBeUndefined();
    }
  });

  it("rejects invalid UTF-8, BOM, whitespace, CRLF, missing LF, trailing bytes, and noncanonical key order in every role", () => {
    const encoded = encodedHarness(mutableHarness());
    for (const role of ["plan", "declaredReference", "candidate"] as const) {
      const original = encoded[role];
      const parsed = JSON.parse(textOf(original)) as MutableRecord;
      const reversed = Object.fromEntries(Object.entries(parsed).reverse());
      const malformed = [
        new Uint8Array([0xc3, 0x28]),
        concatBytes(new Uint8Array([0xef, 0xbb, 0xbf]), original),
        new TextEncoder().encode(` ${textOf(original)}`),
        new TextEncoder().encode(textOf(original).replace(/\n$/u, "\r\n")),
        new TextEncoder().encode(textOf(original).trimEnd()),
        new TextEncoder().encode(`${textOf(original)} `),
        new TextEncoder().encode(`${JSON.stringify(reversed)}\n`),
      ];
      for (const bytes of malformed) {
        const args: EncodedHarness = { ...encoded, [role]: bytes };
        expect(measureEncoded(args).status, role).toBe("quarantined");
      }
    }
  });

  it("rejects same-value and changed-value duplicate JSON keys at wrapper and nested levels", () => {
    const encoded = encodedHarness(mutableHarness());
    for (const role of ["plan", "declaredReference", "candidate"] as const) {
      const original = textOf(encoded[role]);
      const sameValue = original.replace(
        /"synthetic":true/u,
        '"synthetic":true,"synthetic":true',
      );
      const changedValue = original.replace(
        /"synthetic":true/u,
        '"synthetic":false,"synthetic":true',
      );
      for (const text of [sameValue, changedValue]) {
        const args: EncodedHarness = {
          ...encoded,
          [role]: new TextEncoder().encode(text),
        };
        expect(measureEncoded(args).status, role).toBe("quarantined");
      }
    }

    const nested = textOf(encoded.candidate).replace(
      /"value":"([0-9]+)"/u,
      '"value":"$1","value":"$1"',
    );
    expectQuarantined(
      measureSyntheticFilingQuality(
        encoded.plan,
        encoded.declaredReference,
        new TextEncoder().encode(nested),
      ),
      "candidate_invalid",
    );
  });

  it("enforces depth, node, aggregate-string, and array bounds before accepting schema data", () => {
    const deep = mutableHarness();
    let nested: unknown = "leaf";
    for (
      let index = 0;
      index <= FILING_QUALITY_MEASUREMENT_LIMITS.documentDepth;
      index += 1
    )
      nested = { nested };
    deep.candidate.extra = nested;
    expectQuarantined(measureMutable(deep), "candidate_invalid");

    const wide = mutableHarness();
    wide.candidate.extra = Array.from(
      { length: FILING_QUALITY_MEASUREMENT_LIMITS.documentNodes + 1 },
      () => null,
    );
    expectQuarantined(measureMutable(wide), "candidate_invalid");

    const long = mutableHarness();
    long.candidate.extra = "x".repeat(
      FILING_QUALITY_MEASUREMENT_LIMITS.aggregateStringCodePoints + 1,
    );
    expectQuarantined(measureMutable(long), "candidate_invalid");

    const tooManyFacts = mutableHarness();
    const facts = candidateFacts(tooManyFacts, 0);
    facts.push(jsonClone(facts[0]!));
    expectQuarantined(measureMutable(tooManyFacts), "candidate_invalid");
  });

  it("takes owned snapshots, ignores instance slice traps, and remains deterministic after caller mutation", () => {
    const encoded = encodedHarness(mutableHarness());
    const plan = Uint8Array.from(encoded.plan);
    Object.defineProperty(plan, "slice", {
      value: () => {
        throw new TypeError("instance slice must not execute");
      },
    });
    const first = expectEvaluated(
      measureSyntheticFilingQuality(
        plan,
        encoded.declaredReference,
        encoded.candidate,
      ),
    );
    const serialized = JSON.stringify(first);
    plan.fill(0);
    encoded.declaredReference.fill(0);
    encoded.candidate.fill(0);
    expect(JSON.stringify(first)).toBe(serialized);

    const fresh = encodedHarness(mutableHarness());
    const second = expectEvaluated(measureEncoded(fresh));
    const third = expectEvaluated(measureEncoded(fresh));
    expect(second).toStrictEqual(third);
    expect(second).not.toBe(third);
    expect(second.counts).not.toBe(third.counts);
    expect(second.metrics).not.toBe(third.metrics);
    expect(second.failedThresholds).not.toBe(third.failedThresholds);
    expectDeepFrozen(second);
    expectDeepFrozen(third);
  });

  it("returns only aggregate immutable receipts and empty value-free quarantines with no canary leakage", () => {
    const canary = "98765432123456789";
    const harness = mutableHarness();
    referenceFacts(harness, 0)[0]!.value = canary;
    candidateFacts(harness, 0)[0]!.value = canary;
    rebindReference(harness);
    const result = expectEvaluated(measureMutable(harness));
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      canary,
      "synthetic-filing-0001",
      "rc-synthetic:Assets",
      "2025-12-31",
      '"USD"',
      "declared-adjudicator-a",
    ])
      expect(serialized).not.toContain(forbidden);
    expect(serialized).not.toMatch(
      /"(?:documentId|documentSha256|factKey|concept|dimensions|periodEnd|periodStart|value)":/u,
    );

    const invalid = mutableHarness();
    invalid.candidate.secret = canary;
    const quarantined = expectQuarantined(
      measureMutable(invalid),
      "candidate_invalid",
    );
    expect(quarantined).toStrictEqual({
      audit: {
        criticalAssertionCount: 0,
        documentCount: 0,
        emittedFactCount: 0,
        expectedFactCount: 0,
        outcome: "quarantined",
      },
      claim: FILING_QUALITY_MEASUREMENT_CLAIM,
      code: "candidate_invalid",
      metrics: [],
      schemaVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
      status: "quarantined",
      synthetic: true,
    });
    expect(JSON.stringify(quarantined)).not.toContain(canary);
    expectDeepFrozen(quarantined);
  });

  it("returns fresh deeply frozen value-free quarantines for every coarse failure class", () => {
    const factories: Array<{
      readonly code: Exclude<
        FilingQualityMeasurementQuarantineCode,
        "measurement_failure"
      >;
      readonly mutate: (harness: MutableHarness) => void;
    }> = [
      {
        code: "plan_invalid",
        mutate: (harness) => {
          harness.plan.planId = "wrong-plan";
        },
      },
      {
        code: "declared_reference_invalid",
        mutate: (harness) => {
          harness.declaredReference.populationId = "wrong-population";
        },
      },
      {
        code: "candidate_invalid",
        mutate: (harness) => {
          harness.candidate.documentRole = 1;
        },
      },
      {
        code: "binding_invalid",
        mutate: (harness) => {
          harness.candidate.planSha256 = zeroHash();
        },
      },
    ];
    for (const { code, mutate } of factories) {
      const firstHarness = mutableHarness();
      mutate(firstHarness);
      const first = expectQuarantined(measureMutable(firstHarness), code);
      const secondHarness = mutableHarness();
      mutate(secondHarness);
      const second = expectQuarantined(measureMutable(secondHarness), code);
      expect(first).toStrictEqual(second);
      expect(first).not.toBe(second);
      expect(first.audit).not.toBe(second.audit);
      expect(first.metrics).not.toBe(second.metrics);
      expectDeepFrozen(first);
      expectDeepFrozen(second);
    }
  });
});

function mutableHarness(): MutableHarness {
  const documents = buildSyntheticFilingQualityMeasurementDocuments();
  return {
    candidate: decodeSyntheticFilingQualityMeasurementDocument(
      documents.candidate,
    ),
    declaredReference: decodeSyntheticFilingQualityMeasurementDocument(
      documents.declaredReference,
    ),
    plan: decodeSyntheticFilingQualityMeasurementDocument(documents.plan),
  };
}

function encodedHarness(harness: MutableHarness): EncodedHarness {
  return {
    candidate: canonicalSyntheticFilingQualityMeasurementDocument(
      harness.candidate,
    ),
    declaredReference: canonicalSyntheticFilingQualityMeasurementDocument(
      harness.declaredReference,
    ),
    plan: canonicalSyntheticFilingQualityMeasurementDocument(harness.plan),
  };
}

function measureMutable(
  harness: MutableHarness,
): FilingQualityMeasurementResult {
  return measureEncoded(encodedHarness(harness));
}

function measureEncoded(
  harness: EncodedHarness,
): FilingQualityMeasurementResult {
  return measureSyntheticFilingQuality(
    harness.plan,
    harness.declaredReference,
    harness.candidate,
  );
}

function referenceDocuments(harness: MutableHarness): MutableRecord[] {
  return recordsOf(harness.declaredReference.documents);
}

function candidateDocuments(harness: MutableHarness): MutableRecord[] {
  return recordsOf(harness.candidate.documentObservations);
}

function referenceFacts(
  harness: MutableHarness,
  documentIndex: number,
): MutableRecord[] {
  return recordsOf(referenceDocuments(harness)[documentIndex]!.facts);
}

function candidateFacts(
  harness: MutableHarness,
  documentIndex: number,
): MutableRecord[] {
  return recordsOf(candidateDocuments(harness)[documentIndex]!.facts);
}

function recordsOf(value: unknown): MutableRecord[] {
  const array = arrayOf(value);
  for (const item of array) recordOf(item);
  return array as MutableRecord[];
}

function arrayOf(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError("Expected test array.");
  return value;
}

function recordOf(value: unknown): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError("Expected test record.");
  return value as MutableRecord;
}

function makePerfectCandidate(harness: MutableHarness): void {
  harness.candidate.documentObservations = referenceDocuments(harness).map(
    (document) => ({
      documentId: document.documentId,
      documentSha256: document.documentSha256,
      facts: jsonClone(document.facts),
      status: "succeeded",
    }),
  );
}

function quarantineLast(harness: MutableHarness, count: number): void {
  const documents = candidateDocuments(harness);
  for (
    let index = documents.length - count;
    index < documents.length;
    index += 1
  ) {
    const document = documents[index]!;
    document.facts = [];
    document.quarantineCode = "validator_quarantine";
    document.status = "quarantined";
  }
}

function rebindReference(harness: MutableHarness): void {
  harness.candidate.declaredReferenceSha256 = sha256(
    canonicalSyntheticFilingQualityMeasurementDocument(
      harness.declaredReference,
    ),
  );
}

function ratio(
  numerator: number,
  denominator: number,
  thresholdNumerator: number,
  thresholdDenominator: number,
  thresholdKind: "maximum" | "minimum",
  met: boolean,
  defined = true,
): unknown {
  return {
    defined,
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

function expectEvaluated(
  result: FilingQualityMeasurementResult,
): FilingQualityMeasurementEvaluatedResult {
  expect(result.status).toBe("evaluated");
  if (result.status !== "evaluated")
    throw new TypeError("Expected evaluated quality result.");
  return result;
}

function expectQuarantined(
  result: FilingQualityMeasurementResult,
  code: FilingQualityMeasurementQuarantineCode,
): FilingQualityMeasurementQuarantinedResult {
  expect(result.status).toBe("quarantined");
  if (result.status !== "quarantined")
    throw new TypeError("Expected quarantined quality result.");
  expect(result.code).toBe(code);
  expect(result.audit).toStrictEqual({
    criticalAssertionCount: 0,
    documentCount: 0,
    emittedFactCount: 0,
    expectedFactCount: 0,
    outcome: "quarantined",
  });
  expect(result.metrics).toStrictEqual([]);
  expect(Object.keys(result).sort()).toStrictEqual([
    "audit",
    "claim",
    "code",
    "metrics",
    "schemaVersion",
    "status",
    "synthetic",
  ]);
  return result;
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value))
    expectDeepFrozen(Reflect.get(value, key), seen);
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
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
