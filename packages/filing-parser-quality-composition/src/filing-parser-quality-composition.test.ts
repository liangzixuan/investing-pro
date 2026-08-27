import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FILING_PARSER_QUALITY_COMPOSITION_CHECKS,
  FILING_PARSER_QUALITY_COMPOSITION_CLAIM,
  FILING_PARSER_QUALITY_COMPOSITION_NOT_PROVEN,
  FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION,
  createFilingParserQualityCompositionProtocolForTest,
  type FilingParserQualityCompositionCommitResult,
  type FilingParserQualityCompositionRevealResult,
} from "./filing-parser-quality-composition";
import {
  buildDirectResultForTest,
  buildFilingParserQualityCompositionTestHarness,
  canonicalTestDocument,
  sha256ForTest,
} from "./test-filing-parser-quality-composition-builder";

describe("filing parser quality composition", () => {
  it("exports the exact sole claim, schema, checks, and nonclaims", () => {
    expect(FILING_PARSER_QUALITY_COMPOSITION_CLAIM).toBe(
      "bounded_synthetic_source_owned_direct_docker_cross_engine_two_document_observation_precommitment_and_fixed_population_quality_evaluation_binding",
    );
    expect(FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_PARSER_QUALITY_COMPOSITION_CHECKS).toHaveLength(16);
    expect(FILING_PARSER_QUALITY_COMPOSITION_NOT_PROVEN).toHaveLength(16);
    expect(FILING_PARSER_QUALITY_COMPOSITION_CHECKS[0]).toBe(
      "exact_source_owned_direct_docker_cross_engine_and_cycle2g_cycle2f_contract_configuration",
    );
    expect(FILING_PARSER_QUALITY_COMPOSITION_NOT_PROVEN[15]).toBe(
      "real_data_admission_full_cycle2_exit_or_production_use",
    );
    expect(Object.isFrozen(FILING_PARSER_QUALITY_COMPOSITION_CHECKS)).toBe(
      true,
    );
  });

  it("binds two source documents and returns the exact honest incomplete-population evaluation", async () => {
    const harness = buildFilingParserQualityCompositionTestHarness();
    const protocol = createFilingParserQualityCompositionProtocolForTest(
      harness.boundary,
    );
    const committed = await protocol.commit(
      harness.plan,
      harness.declaredReferenceSha256,
      harness.originalArchive,
      harness.amendmentArchive,
    );
    assertCommitted(committed);
    expect(committed.audit).toEqual({
      directExecutionCount: 1,
      documentObservationCount: 2,
      emittedFactCount: 20,
      outcome: "candidate_committed",
    });
    expect(
      committed.projectionReceipts.map(({ documentRole }) => documentRole),
    ).toEqual(["original", "amendment"]);
    expect(
      committed.projectionReceipts.map(
        ({ qualityDocumentId }) => qualityDocumentId,
      ),
    ).toEqual(["synthetic-filing-0001", "synthetic-filing-0002"]);
    expect(
      committed.projectionReceipts.every(({ factCount }) => factCount === 10),
    ).toBe(true);
    expect(
      new Set(
        committed.projectionReceipts.map(
          ({ observationSha256 }) => observationSha256,
        ),
      ).size,
    ).toBe(2);
    expect(committed.sourceExecution.lifecycleBindingSha256s).toHaveLength(4);
    expect(committed.sourceExecution.executionMode).toBe(
      "source_owned_direct_docker",
    );
    expect(Object.isFrozen(committed)).toBe(true);
    expect(Object.isFrozen(committed.projectionReceipts)).toBe(true);
    expect(Object.isFrozen(committed.capability)).toBe(true);
    expect(Object.getPrototypeOf(committed.capability)).toBeNull();
    expect(JSON.stringify(committed.capability)).toBe("{}");

    const evaluated = protocol.reveal(
      committed.capability,
      harness.declaredReference,
    );
    assertEvaluated(evaluated);
    expect(evaluated.measurement.counts).toEqual({
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
    });
    expect(evaluated.measurement.failedThresholds).toEqual([
      "document_success_minimum",
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ]);
    expect(evaluated.measurement.syntheticPilotThresholdOutcome).toBe(
      "not_met",
    );
    expect(evaluated.measurement.metrics.factPrecision).toMatchObject({
      denominator: 20,
      met: true,
      numerator: 20,
    });
    expect(evaluated.measurement.metrics.factRecall).toMatchObject({
      denominator: 1_000,
      met: false,
      numerator: 20,
    });
    expect(evaluated.measurement.metrics.documentSuccess).toMatchObject({
      denominator: 100,
      met: false,
      numerator: 2,
    });
    expect(evaluated.measurement.metrics.quarantineRate).toMatchObject({
      denominator: 100,
      met: true,
      numerator: 0,
    });
    expect(evaluated.evaluationBindingSha256).not.toBe(
      evaluated.qualityEvaluationBindingSha256,
    );
    expect(Object.isFrozen(evaluated)).toBe(true);
    expect(Object.isFrozen(evaluated.measurement)).toBe(true);
  });

  it("recomputes the inherited Cycle 2k normalization and agreement with canonical trailing newlines", () => {
    const harness = buildFilingParserQualityCompositionTestHarness();
    const directResult = harness.directResult;
    expect(directResult.status).toBe("agreed");
    if (directResult.status !== "agreed") throw new TypeError();
    const normalizationDocument = canonicalTestDocument(
      directResult.normalization,
    );
    const normalizationSha256 = sha256ForTest(normalizationDocument);
    const noNewlineNormalizationSha256 = sha256ForTest(
      normalizationDocument.subarray(0, normalizationDocument.byteLength - 1),
    );
    expect(directResult.provenance.normalizationSha256).toBe(
      normalizationSha256,
    );
    expect(normalizationSha256).not.toBe(noNewlineNormalizationSha256);

    const agreementPreimage = {
      amendmentArchiveSha256:
        directResult.provenance.agreement.amendmentArchiveSha256,
      engines: directResult.provenance.agreement.engines,
      normalizationSha256,
      originalArchiveSha256:
        directResult.provenance.agreement.originalArchiveSha256,
    };
    const agreementDocument = canonicalTestDocument(agreementPreimage);
    const expectedAgreementSha256 = `sha256:${createHash("sha256")
      .update(
        "research-cockpit:synthetic-filing-parser-cross-engine-execution:v1\u0000",
        "utf8",
      )
      .update(agreementDocument)
      .digest("hex")}`;
    const noNewlineAgreementSha256 = `sha256:${createHash("sha256")
      .update(
        "research-cockpit:synthetic-filing-parser-cross-engine-execution:v1\u0000",
        "utf8",
      )
      .update(agreementDocument.subarray(0, agreementDocument.byteLength - 1))
      .digest("hex")}`;
    expect(directResult.provenance.agreement.agreementSha256).toBe(
      expectedAgreementSha256,
    );
    expect(expectedAgreementSha256).not.toBe(noNewlineAgreementSha256);
  });

  it("repeats stable candidate and measurement hashes while lifecycle-bound outer receipts remain invocation-specific", async () => {
    const firstHarness = buildFilingParserQualityCompositionTestHarness();
    const secondHarness = buildFilingParserQualityCompositionTestHarness();
    secondHarness.boundary.outcome = buildDirectResultForTest(
      secondHarness.normalization,
      secondHarness.originalArchive,
      secondHarness.amendmentArchive,
      "second-invocation",
    );
    const first = createFilingParserQualityCompositionProtocolForTest(
      firstHarness.boundary,
    );
    const second = createFilingParserQualityCompositionProtocolForTest(
      secondHarness.boundary,
    );
    const firstCommit = await first.commit(
      firstHarness.plan,
      firstHarness.declaredReferenceSha256,
      firstHarness.originalArchive,
      firstHarness.amendmentArchive,
    );
    const secondCommit = await second.commit(
      secondHarness.plan,
      secondHarness.declaredReferenceSha256,
      secondHarness.originalArchive,
      secondHarness.amendmentArchive,
    );
    assertCommitted(firstCommit);
    assertCommitted(secondCommit);
    expect(secondCommit.candidateObservationsSha256).toBe(
      firstCommit.candidateObservationsSha256,
    );
    expect(secondCommit.candidateCommitmentSha256).toBe(
      firstCommit.candidateCommitmentSha256,
    );
    expect(secondCommit.sourceExecution.normalizationSha256).toBe(
      firstCommit.sourceExecution.normalizationSha256,
    );
    expect(secondCommit.sourceExecution.agreementSha256).not.toBe(
      firstCommit.sourceExecution.agreementSha256,
    );
    expect(secondCommit.sourceExecution.invocationBindingSha256).not.toBe(
      firstCommit.sourceExecution.invocationBindingSha256,
    );
    expect(secondCommit.compositionCommitmentSha256).not.toBe(
      firstCommit.compositionCommitmentSha256,
    );
    const firstEvaluation = first.reveal(
      firstCommit.capability,
      firstHarness.declaredReference,
    );
    const secondEvaluation = second.reveal(
      secondCommit.capability,
      secondHarness.declaredReference,
    );
    assertEvaluated(firstEvaluation);
    assertEvaluated(secondEvaluation);
    expect(secondEvaluation.measurement.evaluationSha256).toBe(
      firstEvaluation.measurement.evaluationSha256,
    );
    expect(secondEvaluation.evaluationBindingSha256).not.toBe(
      firstEvaluation.evaluationBindingSha256,
    );
  });
});

function assertCommitted(
  value: FilingParserQualityCompositionCommitResult,
): asserts value is Extract<
  FilingParserQualityCompositionCommitResult,
  { status: "candidate_committed" }
> {
  expect(value.status).toBe("candidate_committed");
  if (value.status !== "candidate_committed") throw new TypeError();
}

function assertEvaluated(
  value: FilingParserQualityCompositionRevealResult,
): asserts value is Extract<
  FilingParserQualityCompositionRevealResult,
  { status: "evaluated" }
> {
  expect(value.status).toBe("evaluated");
  if (value.status !== "evaluated") throw new TypeError();
}
