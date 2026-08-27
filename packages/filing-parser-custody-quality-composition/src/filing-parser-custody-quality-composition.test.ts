import { describe, expect, it } from "vitest";

import { FILING_PARSER_QUALITY_COMPOSITION_NOT_PROVEN } from "@research-cockpit/filing-parser-quality-composition";

import {
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CHECKS,
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE,
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_NOT_PROVEN,
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
  type FilingParserCustodyQualityCompositionCommitResult,
  type FilingParserCustodyQualityCompositionRevealResult,
} from "./filing-parser-custody-quality-composition";
import {
  DeferredCustodyProtocol,
  buildFilingParserCustodyQualityCompositionTestHarness,
  createStaticAuthenticatedCustodyProtocol,
  recomputeCustodyCompositionCommitment,
  recomputeCustodyCompositionEvaluation,
  recomputeCustodyPairBinding,
  recomputeCustodyReceipt,
  recomputeSourceContext,
} from "./test-filing-parser-custody-quality-composition-builder";

describe("filing parser custody quality composition", () => {
  it("exports the exact sole claim, schema, checks, and lossless ordered Cycle 2n nonclaims", () => {
    expect(FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM).toBe(
      "bounded_synthetic_source_owned_exact_pair_encrypted_custody_authenticated_readback_to_direct_docker_cross_engine_quality_evaluation_binding",
    );
    expect(FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION).toBe(
      "1.0.0",
    );
    expect(FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CHECKS).toHaveLength(16);
    expect(
      FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_NOT_PROVEN.slice(
        0,
        FILING_PARSER_QUALITY_COMPOSITION_NOT_PROVEN.length,
      ),
    ).toEqual(FILING_PARSER_QUALITY_COMPOSITION_NOT_PROVEN);
    expect(
      FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_NOT_PROVEN.slice(
        FILING_PARSER_QUALITY_COMPOSITION_NOT_PROVEN.length,
      ),
    ).toEqual([
      "host_os_filesystem_temp_directory_disk_or_docker_runtime_attestation",
      "physical_or_cryptographic_erasure_disk_remanence_swap_or_gc_copy_absence",
      "durable_twenty_four_hour_retention_expiry_crash_recovery_or_backup_deletion",
      "process_crash_power_loss_or_cross_process_custody_recovery",
      "source_owned_ephemeral_custody_key_production_identity_rotation_or_nonrepudiation",
      "javascript_plaintext_memory_wipe_guarantee_or_gc_copy_absence",
    ]);
    expect(FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_NOT_PROVEN).toHaveLength(
      FILING_PARSER_QUALITY_COMPOSITION_NOT_PROVEN.length + 6,
    );
    expect(
      Object.isFrozen(FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CHECKS),
    ).toBe(true);
    expect(
      Object.isFrozen(FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_NOT_PROVEN),
    ).toBe(true);
    expect(FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE).toEqual({
      algorithm: {
        aadDomain:
          "research-cockpit:synthetic-filing-parser-archive-pair-custody:aes-256-gcm:v1\u0000",
        keyBytes: 32,
        name: "aes-256-gcm",
        nonceBytes: 12,
        tagBytes: 16,
      },
      claim:
        "bounded_synthetic_exact_parser_archive_pair_encrypted_custody_and_authenticated_readback",
      fixtures: {
        amendment: {
          byteLength: 2_330,
          contentSha256:
            "sha256:df7f1ff416b60168b09902bd7714fa47bf0453ef9732c8c5b476988bb70f47a8",
          role: "amendment",
        },
        original: {
          byteLength: 2_306,
          contentSha256:
            "sha256:f331ff51540c11aca55a5d1d81d2c1daeaf4354acdea45530faed5275a5322ba",
          role: "original",
        },
      },
      schemaVersion: "1.0.0",
    });
    expect(
      Object.isFrozen(
        FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE,
      ),
    ).toBe(true);
  });

  it("preserves exact honest two-document evaluated/not-met accounting and recomputable custody bindings", async () => {
    const harness = buildFilingParserCustodyQualityCompositionTestHarness({
      invocationTag: "honest-accounting",
    });
    const committed = await harness.protocol.commit(
      harness.plan,
      harness.declaredReferenceSha256,
      harness.originalArchive,
      harness.amendmentArchive,
    );
    assertCommitted(committed);

    expect(committed.audit).toEqual({
      authenticatedReadbackCount: 2,
      cleanupCount: 1,
      directExecutionCount: 1,
      emittedFactCount: 20,
      stagedArchiveCount: 2,
      zeroResidue: true,
    });
    expect(committed.custody.receipts.map(({ role }) => role)).toEqual([
      "original",
      "amendment",
    ]);
    expect(committed.custody.sourceContextSha256).toBe(
      recomputeSourceContext(committed),
    );
    expect(committed.custody.receipts[0].receiptSha256).toBe(
      recomputeCustodyReceipt(committed.custody.receipts[0]),
    );
    expect(committed.custody.receipts[1].receiptSha256).toBe(
      recomputeCustodyReceipt(committed.custody.receipts[1]),
    );
    expect(committed.custody.custodyPairBindingSha256).toBe(
      recomputeCustodyPairBinding(committed),
    );
    expect(committed.custodyCompositionCommitmentSha256).toBe(
      recomputeCustodyCompositionCommitment(committed),
    );
    expect(Object.isFrozen(committed)).toBe(true);
    expect(Object.isFrozen(committed.custody)).toBe(true);
    expect(Object.isFrozen(committed.custody.receipts)).toBe(true);
    expect(Object.isFrozen(committed.quality)).toBe(true);
    expect(Object.isFrozen(committed.quality.projectionReceipts)).toBe(true);
    expect(Object.isFrozen(committed.quality.sourceExecution)).toBe(true);
    expect(Object.isFrozen(committed.capability)).toBe(true);
    expect(Object.getPrototypeOf(committed.capability)).toBeNull();
    expect(JSON.stringify(committed.capability)).toBe("{}");

    const evaluated = harness.protocol.reveal(
      committed.capability,
      harness.declaredReference,
    );
    assertEvaluated(evaluated);
    expect(evaluated.custody).toBe(committed.custody);
    expect(evaluated.quality).toBe(committed.quality);
    expect(evaluated.custodyCompositionCommitmentSha256).toBe(
      committed.custodyCompositionCommitmentSha256,
    );
    expect(evaluated.custodyCompositionEvaluationBindingSha256).toBe(
      recomputeCustodyCompositionEvaluation(evaluated),
    );
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
    expect(evaluated.measurement.metrics.documentSuccess).toMatchObject({
      denominator: 100,
      met: false,
      numerator: 2,
    });
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
    expect(Object.isFrozen(evaluated)).toBe(true);
    expect(Object.isFrozen(evaluated.measurement)).toBe(true);
  });

  it("keeps inner candidate and evaluation hashes stable while fresh custody and outer bindings remain distinct", async () => {
    const firstHarness = buildFilingParserCustodyQualityCompositionTestHarness({
      invocationTag: "stable-inner",
    });
    const secondHarness = buildFilingParserCustodyQualityCompositionTestHarness(
      {
        invocationTag: "stable-inner",
      },
    );
    const firstCommit = await commit(firstHarness);
    const secondCommit = await commit(secondHarness);

    expect(secondCommit.planSha256).toBe(firstCommit.planSha256);
    expect(secondCommit.candidateObservationsSha256).toBe(
      firstCommit.candidateObservationsSha256,
    );
    expect(secondCommit.candidateCommitmentSha256).toBe(
      firstCommit.candidateCommitmentSha256,
    );
    expect(secondCommit.qualityCompositionCommitmentSha256).toBe(
      firstCommit.qualityCompositionCommitmentSha256,
    );
    expect(secondCommit.custody.sourceContextSha256).toBe(
      firstCommit.custody.sourceContextSha256,
    );
    expect(secondCommit.custody.custodyPairBindingSha256).not.toBe(
      firstCommit.custody.custodyPairBindingSha256,
    );
    expect(
      secondCommit.custody.receipts.map(
        ({ ciphertextSha256 }) => ciphertextSha256,
      ),
    ).not.toEqual(
      firstCommit.custody.receipts.map(
        ({ ciphertextSha256 }) => ciphertextSha256,
      ),
    );
    expect(secondCommit.custodyCompositionCommitmentSha256).not.toBe(
      firstCommit.custodyCompositionCommitmentSha256,
    );

    const firstEvaluation = firstHarness.protocol.reveal(
      firstCommit.capability,
      firstHarness.declaredReference,
    );
    const secondEvaluation = secondHarness.protocol.reveal(
      secondCommit.capability,
      secondHarness.declaredReference,
    );
    assertEvaluated(firstEvaluation);
    assertEvaluated(secondEvaluation);
    expect(secondEvaluation.measurement.evaluationSha256).toBe(
      firstEvaluation.measurement.evaluationSha256,
    );
    expect(secondEvaluation.qualityCompositionEvaluationBindingSha256).toBe(
      firstEvaluation.qualityCompositionEvaluationBindingSha256,
    );
    expect(secondEvaluation.qualityEvaluationBindingSha256).toBe(
      firstEvaluation.qualityEvaluationBindingSha256,
    );
    expect(secondEvaluation.custodyCompositionEvaluationBindingSha256).not.toBe(
      firstEvaluation.custodyCompositionEvaluationBindingSha256,
    );
  });

  it("owns caller inputs before await and passes only distinct authenticated readback snapshots into Cycle 2n", async () => {
    const staticCustody =
      createStaticAuthenticatedCustodyProtocol("snapshot-identity");
    const deferredCustody = new DeferredCustodyProtocol(staticCustody);
    const harness = buildFilingParserCustodyQualityCompositionTestHarness({
      custody: deferredCustody,
      invocationTag: "snapshot-identity",
    });
    const callerPlan = Uint8Array.from(harness.plan);
    const callerOriginal = Uint8Array.from(harness.originalArchive);
    const callerAmendment = Uint8Array.from(harness.amendmentArchive);
    const expectedPlan = Uint8Array.from(callerPlan);
    const expectedOriginal = Uint8Array.from(callerOriginal);
    const expectedAmendment = Uint8Array.from(callerAmendment);

    const pending = harness.protocol.commit(
      callerPlan,
      harness.declaredReferenceSha256,
      callerOriginal,
      callerAmendment,
    );
    await deferredCustody.started;
    callerPlan.fill(0);
    callerOriginal.fill(0);
    callerAmendment.fill(0);
    deferredCustody.release();
    const committed = await pending;
    assertCommitted(committed);

    const custodyCall = deferredCustody.calls[0];
    const qualityCall = harness.quality.commitCalls[0];
    const custodyResult = staticCustody.lastResult;
    expect(custodyCall).toBeDefined();
    expect(qualityCall).toBeDefined();
    expect(custodyResult?.status).toBe("readback");
    if (
      custodyCall === undefined ||
      qualityCall === undefined ||
      custodyResult?.status !== "readback"
    )
      throw new TypeError();

    expect(custodyCall.originalSnapshot).toEqual(expectedOriginal);
    expect(custodyCall.amendmentSnapshot).toEqual(expectedAmendment);
    expect(qualityCall.planSnapshot).toEqual(expectedPlan);
    expect(qualityCall.originalSnapshot).toEqual(expectedOriginal);
    expect(qualityCall.amendmentSnapshot).toEqual(expectedAmendment);
    expect(custodyCall.originalArgument).not.toBe(callerOriginal);
    expect(custodyCall.amendmentArgument).not.toBe(callerAmendment);
    expect(qualityCall.planArgument).not.toBe(callerPlan);
    expect(qualityCall.originalArgument).not.toBe(callerOriginal);
    expect(qualityCall.amendmentArgument).not.toBe(callerAmendment);
    expect(qualityCall.originalArgument).not.toBe(
      custodyResult.originalArchive,
    );
    expect(qualityCall.amendmentArgument).not.toBe(
      custodyResult.amendmentArchive,
    );
    expect(qualityCall.originalArgument).not.toBe(custodyCall.originalArgument);
    expect(qualityCall.amendmentArgument).not.toBe(
      custodyCall.amendmentArgument,
    );
    expectZeroed(custodyCall.originalArgument);
    expectZeroed(custodyCall.amendmentArgument);
    expectZeroed(custodyResult.originalArchive);
    expectZeroed(custodyResult.amendmentArchive);
    expectZeroed(qualityCall.planArgument);
    expectZeroed(qualityCall.originalArgument);
    expectZeroed(qualityCall.amendmentArgument);

    assertEvaluated(
      harness.protocol.reveal(committed.capability, harness.declaredReference),
    );
  });
});

type Harness = ReturnType<
  typeof buildFilingParserCustodyQualityCompositionTestHarness
>;

async function commit(harness: Harness) {
  const result = await harness.protocol.commit(
    harness.plan,
    harness.declaredReferenceSha256,
    harness.originalArchive,
    harness.amendmentArchive,
  );
  assertCommitted(result);
  return result;
}

function assertCommitted(
  value: FilingParserCustodyQualityCompositionCommitResult,
): asserts value is Extract<
  FilingParserCustodyQualityCompositionCommitResult,
  { status: "candidate_committed" }
> {
  expect(value.status).toBe("candidate_committed");
  if (value.status !== "candidate_committed") throw new TypeError();
}

function assertEvaluated(
  value: FilingParserCustodyQualityCompositionRevealResult,
): asserts value is Extract<
  FilingParserCustodyQualityCompositionRevealResult,
  { status: "evaluated" }
> {
  expect(value.status).toBe("evaluated");
  if (value.status !== "evaluated") throw new TypeError();
}

function expectZeroed(value: unknown): void {
  expect(value).toBeInstanceOf(Uint8Array);
  if (!(value instanceof Uint8Array)) throw new TypeError();
  expect(value.every((byte) => byte === 0)).toBe(true);
}
