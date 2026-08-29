import { describe, expect, it } from "vitest";

import {
  PERSONAL_FILING_QUALITY_MEASUREMENT_ASSURANCE,
  PERSONAL_FILING_QUALITY_MEASUREMENT_CHECKS,
  PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM,
  PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS,
  PERSONAL_FILING_QUALITY_MEASUREMENT_NOT_PROVEN,
  PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
  PERSONAL_FILING_QUALITY_MEASUREMENT_THRESHOLDS,
  createPersonalFilingQualityMeasurementProtocol,
  createSuppliedPersonalFilingQualityMeasurementProtocolForTesting,
  type PersonalFilingQualityMeasurementEvaluatedResult,
} from "./personal-filing-quality-measurement";
import {
  buildPersonalFilingQualityMeasurementFixture,
  canonicalPersonalFilingQualityDocument,
  decodePersonalFilingQualityDocument,
} from "./test-personal-filing-quality-measurement-builder";
import type { JsonRecord } from "./test-personal-filing-fact-builder";

describe("personal filing quality measurement", () => {
  it("freezes the personal zero-tolerance policy and exact nonclaims", () => {
    expect(PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM).toContain(
      "owner_reviewed_frozen_reference",
    );
    expect(PERSONAL_FILING_QUALITY_MEASUREMENT_ASSURANCE).toBe(
      "candidate_observations_committed_before_owner_reviewed_reference_content_reveal",
    );
    expect(PERSONAL_FILING_QUALITY_MEASUREMENT_THRESHOLDS).toEqual({
      dateToleranceDays: 0,
      documentSuccessMinimum: { denominator: 1, numerator: 1 },
      factPrecisionMinimum: { denominator: 1, numerator: 1 },
      factRecallMinimum: { denominator: 1, numerator: 1 },
      maximumQuarantineRate: { denominator: 1, numerator: 0 },
      maximumSilentCriticalFailures: 0,
      unitTolerancePolicy: "exact_canonical_unit.v1",
    });
    expect(PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS).toMatchObject({
      assertionsPerFact: 2,
      documents: 2,
      factsPerDocument: 10,
    });
    expect(PERSONAL_FILING_QUALITY_MEASUREMENT_CHECKS).toContain(
      "commit_receives_reference_digest_only_and_no_reference_content_labels_or_expected_values",
    );
    expect(PERSONAL_FILING_QUALITY_MEASUREMENT_NOT_PROVEN).toContain(
      "owner_identity_independent_adjudication_or_owner_reviewed_label_correctness",
    );
    expect(PERSONAL_FILING_QUALITY_MEASUREMENT_NOT_PROVEN).toContain(
      "reference_set_representativeness_statistical_threshold_adequacy_or_generalization_beyond_exact_frozen_scope",
    );
    for (const value of [
      PERSONAL_FILING_QUALITY_MEASUREMENT_CHECKS,
      PERSONAL_FILING_QUALITY_MEASUREMENT_NOT_PROVEN,
      PERSONAL_FILING_QUALITY_MEASUREMENT_THRESHOLDS,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it.each([
    [false, 1, 10, 20],
    [true, 2, 20, 40],
  ] as const)(
    "meets every threshold for internally derived linked mode %s",
    (withAmendment, documentCount, factCount, assertionCount) => {
      const fixture =
        buildPersonalFilingQualityMeasurementFixture(withAmendment);
      const protocol = createPersonalFilingQualityMeasurementProtocol();
      const committed = protocol.commit(fixture.commitInput);
      expect(committed).toMatchObject({
        assurance: PERSONAL_FILING_QUALITY_MEASUREMENT_ASSURANCE,
        audit: {
          criticalAssertionCount: assertionCount,
          documentCount,
          emittedFactCount: factCount,
          expectedFactCount: factCount,
          outcome: "candidate_committed",
          quarantinedDocumentCount: 0,
          succeededDocumentCount: documentCount,
        },
        status: "candidate_committed_for_personal_use",
        synthetic: false,
      });
      if (committed.status !== "candidate_committed_for_personal_use")
        throw new TypeError("Generated commit was quarantined.");
      const result = protocol.reveal(
        committed.capability,
        fixture.ownerReviewedReference,
      );
      expect(result).toMatchObject({
        audit: {
          criticalAssertionCount: assertionCount,
          documentCount,
          emittedFactCount: factCount,
          expectedFactCount: factCount,
          outcome: "evaluated",
          quarantinedDocumentCount: 0,
          succeededDocumentCount: documentCount,
        },
        counts: {
          falseNegativeFactCount: 0,
          falsePositiveFactCount: 0,
          silentCriticalFailureCount: 0,
          truePositiveFactCount: factCount,
        },
        failedThresholds: [],
        personalQualityThresholdOutcome: "met",
        status: "quality_evaluated_for_personal_use",
        synthetic: false,
      });
      expect(result).not.toHaveProperty("facts");
      expect(JSON.stringify(result)).not.toContain("sample:Revenue");
      expectDeepFrozen(result);
    },
  );

  it("records a wrong successful prediction as FP, FN, and silent not_met", () => {
    const fixture = buildPersonalFilingQualityMeasurementFixture();
    const candidate = decodePersonalFilingQualityDocument(
      fixture.candidateObservations,
    );
    const documents = candidate.documents as Array<{ facts: JsonRecord[] }>;
    const fact = documents[0]?.facts[0];
    if (fact === undefined) throw new TypeError("Fixture is incomplete.");
    fact.value = "99999991";
    const result = evaluateSupplied(
      fixture,
      canonicalPersonalFilingQualityDocument(candidate),
    );

    expect(result).toMatchObject({
      counts: {
        falseNegativeFactCount: 1,
        falsePositiveFactCount: 1,
        silentCriticalFailureCount: 1,
        truePositiveFactCount: 9,
        valueMismatchCount: 1,
      },
      personalQualityThresholdOutcome: "not_met",
      status: "quality_evaluated_for_personal_use",
    });
    expect(result.failedThresholds).toEqual([
      "fact_precision_minimum",
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ]);
    expect(JSON.stringify(result)).not.toContain("99999991");
  });

  it("counts explicit pipeline quarantine as non-silent evaluated not_met", () => {
    const fixture = buildPersonalFilingQualityMeasurementFixture();
    const candidate = decodePersonalFilingQualityDocument(
      fixture.candidateObservations,
    );
    const documents = candidate.documents as JsonRecord[];
    documents[0] = {
      documentIndex: 0,
      facts: [],
      rawDocumentSha256: documents[0]?.rawDocumentSha256,
      status: "quarantined",
    };
    const result = evaluateSupplied(
      fixture,
      canonicalPersonalFilingQualityDocument(candidate),
    );

    expect(result).toMatchObject({
      counts: {
        emittedFactCount: 0,
        falseNegativeFactCount: 10,
        falsePositiveFactCount: 0,
        missingFactCount: 10,
        quarantinedDocumentCount: 1,
        silentCriticalFailureCount: 0,
      },
      metrics: { factPrecision: { defined: false, met: false } },
      personalQualityThresholdOutcome: "not_met",
    });
    expect(result.failedThresholds).toEqual([
      "document_success_minimum",
      "fact_precision_minimum",
      "fact_recall_minimum",
      "maximum_quarantine_rate",
    ]);
  });

  it("internally records a Cycle 2w prerequisite failure as an explicit quality quarantine", () => {
    const fixture = buildPersonalFilingQualityMeasurementFixture();
    const changedSource = new Uint8Array(
      fixture.commitInput.sourceDocuments[0] as Uint8Array,
    );
    changedSource[8] = (changedSource[8] ?? 0) ^ 1;
    const protocol = createPersonalFilingQualityMeasurementProtocol();
    const committed = protocol.commit({
      ...fixture.commitInput,
      sourceDocuments: [changedSource],
    });
    expect(committed).toMatchObject({
      audit: {
        emittedFactCount: 0,
        quarantinedDocumentCount: 1,
        succeededDocumentCount: 0,
      },
      status: "candidate_committed_for_personal_use",
    });
    if (committed.status !== "candidate_committed_for_personal_use")
      throw new TypeError("Pipeline quarantine did not commit.");
    const result = protocol.reveal(
      committed.capability,
      fixture.ownerReviewedReference,
    );
    expect(result).toMatchObject({
      counts: {
        quarantinedDocumentCount: 1,
        silentCriticalFailureCount: 0,
      },
      personalQualityThresholdOutcome: "not_met",
      status: "quality_evaluated_for_personal_use",
    });
  });

  it("treats an omitted fact from a successful document as two silent failures", () => {
    const fixture = buildPersonalFilingQualityMeasurementFixture();
    const candidate = decodePersonalFilingQualityDocument(
      fixture.candidateObservations,
    );
    const documents = candidate.documents as Array<{ facts: JsonRecord[] }>;
    documents[0]?.facts.splice(0, 1);
    const result = evaluateSupplied(
      fixture,
      canonicalPersonalFilingQualityDocument(candidate),
    );
    expect(result).toMatchObject({
      counts: {
        emittedFactCount: 9,
        missingFactCount: 1,
        silentCriticalFailureCount: 2,
        truePositiveFactCount: 9,
      },
      personalQualityThresholdOutcome: "not_met",
    });
  });
});

function evaluateSupplied(
  fixture: ReturnType<typeof buildPersonalFilingQualityMeasurementFixture>,
  candidateObservations: Uint8Array,
): PersonalFilingQualityMeasurementEvaluatedResult {
  const protocol =
    createSuppliedPersonalFilingQualityMeasurementProtocolForTesting();
  const committed = protocol.commit({
    ...fixture.commitInput,
    candidateObservations,
  });
  if (committed.status !== "candidate_committed_for_personal_use")
    throw new TypeError("Supplied observation commit was quarantined.");
  const result = protocol.reveal(
    committed.capability,
    fixture.ownerReviewedReference,
  );
  if (result.status !== "quality_evaluated_for_personal_use")
    throw new TypeError("Supplied observation evaluation was quarantined.");
  return result;
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}
