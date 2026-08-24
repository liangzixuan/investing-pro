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
  type FilingQualityPrecommitmentQuarantinedResult,
} from "./filing-quality-precommitment";
import {
  buildSyntheticFilingQualityPrecommitmentDocuments,
  canonicalSyntheticFilingQualityPrecommitmentDocument,
  decodeSyntheticFilingQualityPrecommitmentDocument,
} from "./test-filing-quality-precommitment-builder";

type MutableRecord = Record<string, unknown>;

describe("synthetic filing quality precommitment", () => {
  it("freezes the exact bounded claim, limits, checks, and nonclaims", () => {
    expect(FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_QUALITY_PRECOMMITMENT_CLAIM).toBe(
      "bounded_synthetic_in_process_one_shot_candidate_observation_commit_before_declared_reference_reveal_and_fail_closed_quality_evaluation",
    );
    expect(FILING_QUALITY_PRECOMMITMENT_LIMITS).toEqual({
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
    expect(FILING_QUALITY_PRECOMMITMENT_QUARANTINE_CODES).toEqual([
      "protocol_quarantined",
      "measurement_quarantined",
    ]);
    expect(FILING_QUALITY_PRECOMMITMENT_CHECKS).toHaveLength(16);
    expect(FILING_QUALITY_PRECOMMITMENT_NOT_PROVEN).toHaveLength(16);
    for (const registry of [
      FILING_QUALITY_PRECOMMITMENT_LIMITS,
      FILING_QUALITY_PRECOMMITMENT_QUARANTINE_CODES,
      FILING_QUALITY_PRECOMMITMENT_CHECKS,
      FILING_QUALITY_PRECOMMITMENT_NOT_PROVEN,
    ]) {
      expect(Object.isFrozen(registry)).toBe(true);
    }
  });

  it("commits only aggregate metadata with an empty instance-bound capability", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const result = expectCommitted(
      protocol.commit(documents.plan, documents.candidateObservations),
    );
    expect(result.audit).toEqual({
      documentObservationCount: 100,
      emittedFactCount: 990,
      outcome: "candidate_committed",
      quarantinedDocumentCount: 1,
      succeededDocumentCount: 99,
    });
    for (const hash of [
      result.planSha256,
      result.candidateObservationsSha256,
      result.candidateCommitmentSha256,
    ]) {
      expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    }
    expect(Reflect.ownKeys(result.capability)).toEqual([]);
    expect(Object.getPrototypeOf(result.capability)).toBeNull();
    expect(Object.isFrozen(result.capability)).toBe(true);
    expect(JSON.stringify(result.capability)).toBe("{}");
    expect(JSON.stringify(result)).not.toMatch(
      /synthetic-filing-0001|rc-synthetic:Assets|1000100/u,
    );
    expectDeepFrozen(result);
  });

  it("reveals the exact digest-bound reference and preserves the Cycle 2f met accounting", () => {
    const { committed, documents, protocol } = committedHarness();
    const result = expectEvaluated(
      protocol.reveal(committed.capability, documents.declaredReference),
    );
    expect(result.measurement.syntheticPilotThresholdOutcome).toBe("met");
    expect(result.measurement.failedThresholds).toEqual([]);
    expect(result.measurement.counts).toEqual({
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
    expect(result.candidateCommitmentSha256).toBe(
      committed.candidateCommitmentSha256,
    );
    expect(result.candidateObservationsSha256).toBe(
      committed.candidateObservationsSha256,
    );
    expect(result.planSha256).toBe(committed.planSha256);
    expect(result.evaluationBindingSha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(JSON.stringify(result)).not.toMatch(
      /synthetic-filing-0001|rc-synthetic:Assets|1000100/u,
    );
    expectDeepFrozen(result);
  });

  it("keeps a committed well-formed wrong prediction as evaluated not_met", () => {
    const documents = mutableDocuments();
    const first = recordAt(
      arrayAt(documents.candidateObservations, "documentObservations"),
      0,
    );
    recordAt(arrayAt(first, "facts"), 0).value = "1000101";
    const encoded = encodeDocuments(documents);
    const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const committed = expectCommitted(
      protocol.commit(encoded.plan, encoded.candidateObservations),
    );
    const result = expectEvaluated(
      protocol.reveal(committed.capability, encoded.declaredReference),
    );
    expect(result.measurement.syntheticPilotThresholdOutcome).toBe("not_met");
    expect(result.measurement.failedThresholds).toEqual([
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ]);
    expect(result.measurement.counts).toMatchObject({
      falseNegativeFactCount: 11,
      falsePositiveFactCount: 1,
      silentCriticalFailureCount: 1,
      truePositiveFactCount: 989,
      valueMismatchCount: 1,
    });
  });

  it("preserves fixed denominators for committed omissions and a second quarantine", () => {
    const missing = mutableDocuments();
    arrayAt(missing.candidateObservations, "documentObservations").pop();
    const missingResult = evaluate(missing);
    expect(missingResult.measurement.syntheticPilotThresholdOutcome).toBe(
      "not_met",
    );
    expect(missingResult.measurement.counts).toMatchObject({
      documentCount: 100,
      expectedFactCount: 1_000,
      missingDocumentCount: 1,
      silentCriticalFailureCount: 20,
      succeededDocumentCount: 99,
    });

    const twoQuarantines = mutableDocuments();
    const observations = arrayAt(
      twoQuarantines.candidateObservations,
      "documentObservations",
    );
    const source = recordAt(observations, 98);
    observations[98] = {
      documentId: source.documentId,
      documentSha256: source.documentSha256,
      facts: [],
      quarantineCode: "comparison_conflict",
      status: "quarantined",
    };
    const quarantineResult = evaluate(twoQuarantines);
    expect(quarantineResult.measurement.syntheticPilotThresholdOutcome).toBe(
      "not_met",
    );
    expect(quarantineResult.measurement.counts).toMatchObject({
      falseNegativeFactCount: 20,
      quarantinedDocumentCount: 2,
      silentCriticalFailureCount: 0,
      succeededDocumentCount: 98,
    });
    expect(quarantineResult.measurement.failedThresholds).toEqual([
      "fact_recall_minimum",
    ]);
  });

  it("owns committed byte snapshots and returns results safe from later input mutation", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const committed = expectCommitted(
      protocol.commit(documents.plan, documents.candidateObservations),
    );
    documents.plan.fill(0);
    documents.candidateObservations.fill(0);
    const result = expectEvaluated(
      protocol.reveal(committed.capability, documents.declaredReference),
    );
    const snapshot = JSON.stringify(result);
    documents.declaredReference.fill(0);
    expect(JSON.stringify(result)).toBe(snapshot);
    expect(result.measurement.syntheticPilotThresholdOutcome).toBe("met");
    expectDeepFrozen(result);
  });

  it("consumes after a malformed first commit and rejects repair", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
    expectQuarantined(
      protocol.commit(undefined, documents.candidateObservations),
      "protocol_quarantined",
    );
    expectQuarantined(
      protocol.commit(documents.plan, documents.candidateObservations),
      "protocol_quarantined",
    );
    expectQuarantined(
      protocol.reveal({}, documents.declaredReference),
      "protocol_quarantined",
    );
  });

  it("consumes reveal-before-commit and a second commit invalidates the first capability", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    const early = createSyntheticFilingQualityPrecommitmentProtocol();
    expectQuarantined(
      early.reveal({}, documents.declaredReference),
      "protocol_quarantined",
    );
    expectQuarantined(
      early.commit(documents.plan, documents.candidateObservations),
      "protocol_quarantined",
    );

    const duplicate = createSyntheticFilingQualityPrecommitmentProtocol();
    const first = expectCommitted(
      duplicate.commit(documents.plan, documents.candidateObservations),
    );
    expectQuarantined(
      duplicate.commit(documents.plan, documents.candidateObservations),
      "protocol_quarantined",
    );
    expectQuarantined(
      duplicate.reveal(first.capability, documents.declaredReference),
      "protocol_quarantined",
    );
  });

  it("consumes wrong, copied, serialized, and cross-instance capabilities before retry", () => {
    const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
    const wrongFactories: Array<
      (committed: FilingQualityPrecommitmentCommittedResult) => unknown
    > = [
      () => Object.freeze(Object.create(null) as object),
      (committed) => ({ ...committed.capability }),
      (committed) =>
        JSON.parse(JSON.stringify(committed.capability)) as unknown,
    ];
    for (const wrongCapability of wrongFactories) {
      const { committed, protocol } = committedHarness();
      expectQuarantined(
        protocol.reveal(
          wrongCapability(committed),
          documents.declaredReference,
        ),
        "protocol_quarantined",
      );
      expectQuarantined(
        protocol.reveal(committed.capability, documents.declaredReference),
        "protocol_quarantined",
      );
    }

    const first = committedHarness();
    const second = committedHarness();
    expectQuarantined(
      second.protocol.reveal(
        first.committed.capability,
        second.documents.declaredReference,
      ),
      "protocol_quarantined",
    );
    expectQuarantined(
      second.protocol.reveal(
        second.committed.capability,
        second.documents.declaredReference,
      ),
      "protocol_quarantined",
    );
  });

  it("binds the exact reference digest and consumes mismatch before a correct retry", () => {
    const { committed, documents, protocol } = committedHarness();
    const changed = decodeSyntheticFilingQualityPrecommitmentDocument(
      documents.declaredReference,
    );
    const first = recordAt(arrayAt(changed, "documents"), 0);
    recordAt(arrayAt(first, "facts"), 0).value = "1000101";
    const changedBytes =
      canonicalSyntheticFilingQualityPrecommitmentDocument(changed);
    expectQuarantined(
      protocol.reveal(committed.capability, changedBytes),
      "protocol_quarantined",
    );
    expectQuarantined(
      protocol.reveal(committed.capability, documents.declaredReference),
      "protocol_quarantined",
    );
  });

  it("maps an exact-digest malformed reference to measurement_quarantined and consumes", () => {
    const documents = mutableDocuments();
    documents.declaredReference.extra = "reference-canary";
    const referenceBytes = canonicalSyntheticFilingQualityPrecommitmentDocument(
      documents.declaredReference,
    );
    documents.candidateObservations.declaredReferenceSha256 =
      sha256(referenceBytes);
    const encoded = {
      candidateObservations:
        canonicalSyntheticFilingQualityPrecommitmentDocument(
          documents.candidateObservations,
        ),
      declaredReference: referenceBytes,
      plan: canonicalSyntheticFilingQualityPrecommitmentDocument(
        documents.plan,
      ),
    };
    const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
    const committed = expectCommitted(
      protocol.commit(encoded.plan, encoded.candidateObservations),
    );
    expectQuarantined(
      protocol.reveal(committed.capability, encoded.declaredReference),
      "measurement_quarantined",
    );
    expectQuarantined(
      protocol.reveal(committed.capability, encoded.declaredReference),
      "protocol_quarantined",
    );
  });

  it("returns deterministic fresh receipts and fresh value-free quarantines", () => {
    const first = committedHarness();
    const second = committedHarness();
    expect(withoutCapability(first.committed)).toStrictEqual(
      withoutCapability(second.committed),
    );
    expect(first.committed).not.toBe(second.committed);
    expect(first.committed.capability).not.toBe(second.committed.capability);

    const firstEvaluation = expectEvaluated(
      first.protocol.reveal(
        first.committed.capability,
        first.documents.declaredReference,
      ),
    );
    const secondEvaluation = expectEvaluated(
      second.protocol.reveal(
        second.committed.capability,
        second.documents.declaredReference,
      ),
    );
    expect(firstEvaluation).toStrictEqual(secondEvaluation);
    expect(firstEvaluation).not.toBe(secondEvaluation);
    expect(firstEvaluation.measurement).not.toBe(secondEvaluation.measurement);

    const invalidOne = createSyntheticFilingQualityPrecommitmentProtocol();
    const invalidTwo = createSyntheticFilingQualityPrecommitmentProtocol();
    const firstQuarantine = expectQuarantined(
      invalidOne.commit(null, null),
      "protocol_quarantined",
    );
    const secondQuarantine = expectQuarantined(
      invalidTwo.commit(null, null),
      "protocol_quarantined",
    );
    expect(firstQuarantine).toStrictEqual(secondQuarantine);
    expect(firstQuarantine).not.toBe(secondQuarantine);
    expect(firstQuarantine.audit).not.toBe(secondQuarantine.audit);
    expect(JSON.stringify(firstQuarantine)).not.toContain("reference-canary");
    expectDeepFrozen(firstQuarantine);
  });
});

function committedHarness(): {
  readonly committed: FilingQualityPrecommitmentCommittedResult;
  readonly documents: ReturnType<
    typeof buildSyntheticFilingQualityPrecommitmentDocuments
  >;
  readonly protocol: ReturnType<
    typeof createSyntheticFilingQualityPrecommitmentProtocol
  >;
} {
  const documents = buildSyntheticFilingQualityPrecommitmentDocuments();
  const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
  const committed = expectCommitted(
    protocol.commit(documents.plan, documents.candidateObservations),
  );
  return { committed, documents, protocol };
}

function mutableDocuments(): {
  candidateObservations: MutableRecord;
  declaredReference: MutableRecord;
  plan: MutableRecord;
} {
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

function encodeDocuments(documents: {
  candidateObservations: MutableRecord;
  declaredReference: MutableRecord;
  plan: MutableRecord;
}): ReturnType<typeof buildSyntheticFilingQualityPrecommitmentDocuments> {
  return {
    candidateObservations: canonicalSyntheticFilingQualityPrecommitmentDocument(
      documents.candidateObservations,
    ),
    declaredReference: canonicalSyntheticFilingQualityPrecommitmentDocument(
      documents.declaredReference,
    ),
    plan: canonicalSyntheticFilingQualityPrecommitmentDocument(documents.plan),
  };
}

function evaluate(
  documents: ReturnType<typeof mutableDocuments>,
): FilingQualityPrecommitmentEvaluatedResult {
  const encoded = encodeDocuments(documents);
  const protocol = createSyntheticFilingQualityPrecommitmentProtocol();
  const committed = expectCommitted(
    protocol.commit(encoded.plan, encoded.candidateObservations),
  );
  return expectEvaluated(
    protocol.reveal(committed.capability, encoded.declaredReference),
  );
}

function expectCommitted(
  result: ReturnType<
    ReturnType<
      typeof createSyntheticFilingQualityPrecommitmentProtocol
    >["commit"]
  >,
): FilingQualityPrecommitmentCommittedResult {
  expect(result.status).toBe("candidate_committed");
  if (result.status !== "candidate_committed")
    throw new TypeError("Expected committed candidate observations.");
  return result;
}

function expectEvaluated(
  result: ReturnType<
    ReturnType<
      typeof createSyntheticFilingQualityPrecommitmentProtocol
    >["reveal"]
  >,
): FilingQualityPrecommitmentEvaluatedResult {
  expect(result.status).toBe("evaluated");
  if (result.status !== "evaluated")
    throw new TypeError("Expected evaluated precommitment.");
  return result;
}

function expectQuarantined(
  result:
    | ReturnType<
        ReturnType<
          typeof createSyntheticFilingQualityPrecommitmentProtocol
        >["commit"]
      >
    | ReturnType<
        ReturnType<
          typeof createSyntheticFilingQualityPrecommitmentProtocol
        >["reveal"]
      >,
  code: FilingQualityPrecommitmentQuarantinedResult["code"],
): FilingQualityPrecommitmentQuarantinedResult {
  expect(result.status).toBe("quarantined");
  if (result.status !== "quarantined")
    throw new TypeError("Expected quarantined precommitment.");
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

function withoutCapability(
  result: FilingQualityPrecommitmentCommittedResult,
): Omit<FilingQualityPrecommitmentCommittedResult, "capability"> {
  const { capability, ...rest } = result;
  void capability;
  return rest;
}

function recordAt(value: unknown[], index: number): MutableRecord {
  const item = value[index];
  if (typeof item !== "object" || item === null || Array.isArray(item))
    throw new TypeError("Expected test record.");
  return item as MutableRecord;
}

function arrayAt(record: MutableRecord, key: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) throw new TypeError("Expected test array.");
  return value;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value))
    expectDeepFrozen(Reflect.get(value, key), seen);
}
