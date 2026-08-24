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
  type FilingQualityMeasurementQuarantinedResult,
  type FilingQualityMeasurementResult,
} from "./filing-quality-measurement";
import {
  buildSyntheticFilingQualityMeasurementDocuments,
  canonicalSyntheticFilingQualityMeasurementDocument,
  decodeSyntheticFilingQualityMeasurementDocument,
} from "./test-filing-quality-measurement-builder";

describe("synthetic filing quality measurement", () => {
  it("freezes the exact bounded claim, population, policy, checks, and nonclaims", () => {
    expect(FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_QUALITY_MEASUREMENT_CLAIM).toBe(
      "bounded_synthetic_fixed_population_declared_reference_quality_metric_accounting_and_fail_closed_threshold_evaluation",
    );
    expect(FILING_QUALITY_MEASUREMENT_FACT_KEYS).toEqual([
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
    expect(FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS).toEqual([
      "semantic_value_presence",
      "exact_unit_period",
    ]);
    expect(FILING_QUALITY_MEASUREMENT_METRICS).toEqual([
      "document_success",
      "fact_precision",
      "fact_recall",
      "unit_date_tolerance",
      "silent_critical_failure",
      "quarantine_rate",
    ]);
    expect(FILING_QUALITY_MEASUREMENT_THRESHOLDS).toEqual({
      dateToleranceDays: 0,
      documentSuccessMinimum: { denominator: 100, numerator: 95 },
      factPrecisionMinimum: { denominator: 100, numerator: 99 },
      factRecallMinimum: { denominator: 100, numerator: 99 },
      maximumQuarantineRate: { denominator: 100, numerator: 5 },
      maximumSilentCriticalFailures: 0,
      unitTolerancePolicy: "exact_canonical_unit.v1",
    });
    expect(FILING_QUALITY_MEASUREMENT_LIMITS).toEqual({
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
    expect(FILING_QUALITY_MEASUREMENT_CHECKS).toEqual([
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
    ]);
    expect(FILING_QUALITY_MEASUREMENT_NOT_PROVEN).toEqual([
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
    ]);
    expect(FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES).toEqual([
      "comparison_conflict",
      "normalization_failure",
      "parser_failure",
      "validator_quarantine",
    ]);
    expect(FILING_QUALITY_MEASUREMENT_QUARANTINE_CODES).toEqual([
      "input_invalid",
      "plan_invalid",
      "declared_reference_invalid",
      "candidate_invalid",
      "binding_invalid",
      "measurement_failure",
    ]);
    for (const registry of [
      FILING_QUALITY_MEASUREMENT_FACT_KEYS,
      FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS,
      FILING_QUALITY_MEASUREMENT_METRICS,
      FILING_QUALITY_MEASUREMENT_THRESHOLDS,
      FILING_QUALITY_MEASUREMENT_LIMITS,
      FILING_QUALITY_MEASUREMENT_DECLARATIONS,
      FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES,
      FILING_QUALITY_MEASUREMENT_QUARANTINE_CODES,
      FILING_QUALITY_MEASUREMENT_CHECKS,
      FILING_QUALITY_MEASUREMENT_NOT_PROVEN,
    ]) {
      expect(Object.isFrozen(registry)).toBe(true);
    }
    expectDeepFrozen(FILING_QUALITY_MEASUREMENT_THRESHOLDS);
    expectDeepFrozen(FILING_QUALITY_MEASUREMENT_DECLARATIONS);
  });

  it("evaluates the boundary fixture with exact rational metrics and no rounded surface", () => {
    const result = evaluateDefault();
    expect(result.status).toBe("evaluated");
    if (result.status !== "evaluated") return;
    expect(result.syntheticPilotThresholdOutcome).toBe("met");
    expect(result.failedThresholds).toEqual([]);
    expect(result.counts).toEqual({
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
    expect(result.metrics).toEqual({
      documentSuccess: {
        defined: true,
        denominator: 100,
        met: true,
        numerator: 99,
        threshold: { denominator: 100, numerator: 95 },
        thresholdKind: "minimum",
      },
      factPrecision: {
        defined: true,
        denominator: 990,
        met: true,
        numerator: 990,
        threshold: { denominator: 100, numerator: 99 },
        thresholdKind: "minimum",
      },
      factRecall: {
        defined: true,
        denominator: 1_000,
        met: true,
        numerator: 990,
        threshold: { denominator: 100, numerator: 99 },
        thresholdKind: "minimum",
      },
      quarantineRate: {
        defined: true,
        denominator: 100,
        met: true,
        numerator: 1,
        threshold: { denominator: 100, numerator: 5 },
        thresholdKind: "maximum",
      },
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
    for (const hash of [
      result.planSha256,
      result.declaredReferenceSha256,
      result.candidateSha256,
      result.evaluationSha256,
    ]) {
      expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    }
    expect(JSON.stringify(result)).not.toMatch(
      /synthetic-filing-0001|rc-synthetic:|1000100/u,
    );
    expect(JSON.stringify(result)).not.toMatch(/basisPoints|rateBasisPoints/u);
    expectDeepFrozen(result);
  });

  it("keeps an additional explicit quarantine visible as a valid not-met evaluation", () => {
    const result = evaluateCandidateMutation((candidate) => {
      const observations = arrayAt(candidate, "documentObservations");
      const source = recordAt(observations, 98);
      observations[98] = {
        documentId: source.documentId,
        documentSha256: source.documentSha256,
        facts: [],
        quarantineCode: "comparison_conflict",
        status: "quarantined",
      };
    });
    expect(result.status).toBe("evaluated");
    if (result.status !== "evaluated") return;
    expect(result.syntheticPilotThresholdOutcome).toBe("not_met");
    expect(result.failedThresholds).toEqual(["fact_recall_minimum"]);
    expect(result.counts.succeededDocumentCount).toBe(98);
    expect(result.counts.quarantinedDocumentCount).toBe(2);
    expect(result.counts.truePositiveFactCount).toBe(980);
    expect(result.counts.falseNegativeFactCount).toBe(20);
    expect(result.counts.silentCriticalFailureCount).toBe(0);
    expect(result.metrics.factRecall).toMatchObject({
      denominator: 1_000,
      met: false,
      numerator: 980,
    });
  });

  it("counts an omitted candidate document without shrinking denominators or calling it quarantine", () => {
    const result = evaluateCandidateMutation((candidate) => {
      arrayAt(candidate, "documentObservations").pop();
    });
    expect(result.status).toBe("evaluated");
    if (result.status !== "evaluated") return;
    expect(result.counts).toMatchObject({
      documentCount: 100,
      expectedFactCount: 1_000,
      falseNegativeFactCount: 10,
      missingDocumentCount: 1,
      missingFactCount: 10,
      quarantinedDocumentCount: 0,
      silentCriticalFailureCount: 20,
      succeededDocumentCount: 99,
      truePositiveFactCount: 990,
    });
    expect(result.failedThresholds).toEqual([
      "maximum_silent_critical_failures",
    ]);
    expect(result.syntheticPilotThresholdOutcome).toBe("not_met");
  });

  it("counts a partial succeeded document as false negatives and two silent assertions per missing fact", () => {
    const result = evaluateCandidateMutation((candidate) => {
      const first = recordAt(arrayAt(candidate, "documentObservations"), 0);
      arrayAt(first, "facts").pop();
    });
    expect(result.status).toBe("evaluated");
    if (result.status !== "evaluated") return;
    expect(result.counts).toMatchObject({
      emittedFactCount: 989,
      falseNegativeFactCount: 11,
      falsePositiveFactCount: 0,
      missingFactCount: 11,
      semanticAssertionPassCount: 989,
      silentCriticalFailureCount: 2,
      truePositiveFactCount: 989,
      unitPeriodAssertionPassCount: 989,
    });
    expect(result.failedThresholds).toEqual([
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ]);
  });

  it("measures well-formed semantic and unit-period mismatches as FP plus FN", () => {
    const result = evaluateCandidateMutation((candidate) => {
      const first = recordAt(arrayAt(candidate, "documentObservations"), 0);
      const fact = recordAt(arrayAt(first, "facts"), 0);
      fact.concept = "alternate:Assets";
      fact.dimensions = [{ axis: "segment", member: "domestic" }];
      fact.periodEnd = "2025-12-30";
      fact.unit = "EUR";
      fact.value = "1000101";
    });
    expect(result.status).toBe("evaluated");
    if (result.status !== "evaluated") return;
    expect(result.counts).toMatchObject({
      conceptMismatchCount: 1,
      dimensionMismatchCount: 1,
      falseNegativeFactCount: 11,
      falsePositiveFactCount: 1,
      periodMismatchCount: 1,
      semanticAssertionPassCount: 989,
      silentCriticalFailureCount: 2,
      truePositiveFactCount: 989,
      unitMismatchCount: 1,
      unitPeriodAssertionPassCount: 989,
      valueMismatchCount: 1,
    });
    expect(result.metrics.factPrecision).toMatchObject({
      denominator: 990,
      numerator: 989,
    });
    expect(result.failedThresholds).toEqual([
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ]);
  });

  it("counts semantic and context assertion failures independently", () => {
    const semanticOnly = evaluateCandidateMutation((candidate) => {
      const first = recordAt(arrayAt(candidate, "documentObservations"), 0);
      recordAt(arrayAt(first, "facts"), 0).value = "1000101";
    });
    expect(semanticOnly.status).toBe("evaluated");
    if (semanticOnly.status === "evaluated") {
      expect(semanticOnly.counts.silentCriticalFailureCount).toBe(1);
      expect(semanticOnly.counts.semanticAssertionPassCount).toBe(989);
      expect(semanticOnly.counts.unitPeriodAssertionPassCount).toBe(990);
    }

    const contextOnly = evaluateCandidateMutation((candidate) => {
      const first = recordAt(arrayAt(candidate, "documentObservations"), 0);
      recordAt(arrayAt(first, "facts"), 0).unit = "EUR";
    });
    expect(contextOnly.status).toBe("evaluated");
    if (contextOnly.status === "evaluated") {
      expect(contextOnly.counts.silentCriticalFailureCount).toBe(1);
      expect(contextOnly.counts.semanticAssertionPassCount).toBe(990);
      expect(contextOnly.counts.unitPeriodAssertionPassCount).toBe(989);
    }
  });

  it("defines zero-emission precision as undefined and fail-closed", () => {
    const result = evaluateCandidateMutation((candidate) => {
      candidate.documentObservations = [];
    });
    expect(result.status).toBe("evaluated");
    if (result.status !== "evaluated") return;
    expect(result.metrics.factPrecision).toEqual({
      defined: false,
      denominator: 0,
      met: false,
      numerator: 0,
      threshold: { denominator: 100, numerator: 99 },
      thresholdKind: "minimum",
    });
    expect(result.counts).toMatchObject({
      emittedFactCount: 0,
      falseNegativeFactCount: 1_000,
      missingDocumentCount: 100,
      missingFactCount: 1_000,
      silentCriticalFailureCount: 2_000,
      truePositiveFactCount: 0,
    });
    expect(result.failedThresholds).toEqual([
      "document_success_minimum",
      "fact_precision_minimum",
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ]);
  });

  it("quarantines malformed decimals instead of scoring them as quality failures", () => {
    for (const value of ["-0", "-0.0", "1.0", "1.50", "1e3"]) {
      const result = evaluateCandidateMutation((candidate) => {
        const first = recordAt(arrayAt(candidate, "documentObservations"), 0);
        recordAt(arrayAt(first, "facts"), 0).value = value;
      });
      expectValueFreeQuarantine(result, "candidate_invalid");
    }
  });

  it("recomputes every fixed reference document identity and digest", () => {
    const renamed = evaluateReferenceMutation((reference) => {
      recordAt(arrayAt(reference, "documents"), 0).documentId =
        "synthetic-filing-9999";
    });
    expectValueFreeQuarantine(renamed, "declared_reference_invalid");

    const forgedDigest = evaluateReferenceMutation((reference) => {
      recordAt(arrayAt(reference, "documents"), 0).documentSha256 =
        `sha256:${"0".repeat(64)}`;
    });
    expectValueFreeQuarantine(forgedDigest, "declared_reference_invalid");
  });

  it("rejects equal duration boundaries while measuring valid shifted dates", () => {
    const equalDuration = evaluateCandidateMutation((candidate) => {
      const first = recordAt(arrayAt(candidate, "documentObservations"), 0);
      const duration = recordAt(arrayAt(first, "facts"), 3);
      duration.periodStart = duration.periodEnd;
    });
    expectValueFreeQuarantine(equalDuration, "candidate_invalid");

    const shiftedDuration = evaluateCandidateMutation((candidate) => {
      const first = recordAt(arrayAt(candidate, "documentObservations"), 0);
      recordAt(arrayAt(first, "facts"), 3).periodStart = "2025-01-02";
    });
    expect(shiftedDuration.status).toBe("evaluated");
    if (shiftedDuration.status === "evaluated") {
      expect(shiftedDuration.counts.periodMismatchCount).toBe(1);
      expect(shiftedDuration.counts.silentCriticalFailureCount).toBe(1);
      expect(shiftedDuration.syntheticPilotThresholdOutcome).toBe("not_met");
    }
  });

  it("returns deterministic fresh deeply frozen receipts safe from later input mutation", () => {
    const firstDocuments = buildSyntheticFilingQualityMeasurementDocuments();
    const secondDocuments = buildSyntheticFilingQualityMeasurementDocuments();
    const first = measureSyntheticFilingQuality(
      firstDocuments.plan,
      firstDocuments.declaredReference,
      firstDocuments.candidate,
    );
    const second = measureSyntheticFilingQuality(
      secondDocuments.plan,
      secondDocuments.declaredReference,
      secondDocuments.candidate,
    );
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    const snapshot = JSON.stringify(first);
    firstDocuments.plan.fill(0);
    firstDocuments.declaredReference.fill(0);
    firstDocuments.candidate.fill(0);
    expect(JSON.stringify(first)).toBe(snapshot);
    expectDeepFrozen(first);
  });

  it("returns fresh value-free quarantine for invalid argument shape and fixed roles", () => {
    const documents = buildSyntheticFilingQualityMeasurementDocuments();
    const tooFew = measureSyntheticFilingQuality(
      documents.plan,
      documents.declaredReference,
      undefined,
    );
    expectValueFreeQuarantine(tooFew, "input_invalid");
    const swapped = measureSyntheticFilingQuality(
      documents.declaredReference,
      documents.plan,
      documents.candidate,
    );
    expectValueFreeQuarantine(swapped, "input_invalid");
    expect(tooFew).not.toBe(swapped);
    if (tooFew.status === "quarantined" && swapped.status === "quarantined") {
      expect(tooFew.audit).not.toBe(swapped.audit);
      expect(tooFew.metrics).not.toBe(swapped.metrics);
    }
  });
});

function evaluateDefault(): FilingQualityMeasurementResult {
  const documents = buildSyntheticFilingQualityMeasurementDocuments();
  return measureSyntheticFilingQuality(
    documents.plan,
    documents.declaredReference,
    documents.candidate,
  );
}

function evaluateCandidateMutation(
  mutate: (candidate: MutableRecord) => void,
): FilingQualityMeasurementResult {
  const documents = buildSyntheticFilingQualityMeasurementDocuments();
  const candidate = decodeSyntheticFilingQualityMeasurementDocument(
    documents.candidate,
  );
  mutate(candidate);
  return measureSyntheticFilingQuality(
    documents.plan,
    documents.declaredReference,
    canonicalSyntheticFilingQualityMeasurementDocument(candidate),
  );
}

function evaluateReferenceMutation(
  mutate: (reference: MutableRecord) => void,
): FilingQualityMeasurementResult {
  const documents = buildSyntheticFilingQualityMeasurementDocuments();
  const reference = decodeSyntheticFilingQualityMeasurementDocument(
    documents.declaredReference,
  );
  mutate(reference);
  return measureSyntheticFilingQuality(
    documents.plan,
    canonicalSyntheticFilingQualityMeasurementDocument(reference),
    documents.candidate,
  );
}

function expectValueFreeQuarantine(
  result: FilingQualityMeasurementResult,
  code: FilingQualityMeasurementQuarantinedResult["code"],
): void {
  expect(result).toEqual({
    audit: {
      criticalAssertionCount: 0,
      documentCount: 0,
      emittedFactCount: 0,
      expectedFactCount: 0,
      outcome: "quarantined",
    },
    claim: FILING_QUALITY_MEASUREMENT_CLAIM,
    code,
    metrics: [],
    schemaVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    status: "quarantined",
    synthetic: true,
  });
  expect(JSON.stringify(result)).not.toMatch(
    /sha256:|synthetic-filing-|rc-synthetic:|candidateSha|ReferenceSha/u,
  );
  expectDeepFrozen(result);
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const item of Object.values(value)) expectDeepFrozen(item);
}

type MutableRecord = Record<string, unknown>;

function arrayAt(record: MutableRecord, key: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) throw new TypeError(`${key} must be an array`);
  return value;
}

function recordAt(values: unknown[], index: number): MutableRecord {
  const value = values[index];
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError(`index ${index} must be an object`);
  return value as MutableRecord;
}
