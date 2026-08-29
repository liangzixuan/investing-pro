import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM,
  PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS,
  createPersonalFilingQualityMeasurementProtocol,
  createSuppliedPersonalFilingQualityMeasurementProtocolForTesting,
  type PersonalFilingQualityMeasurementCommitInput,
  type PersonalFilingQualityMeasurementQuarantinedResult,
} from "./personal-filing-quality-measurement";
import {
  buildPersonalFilingQualityMeasurementFixture,
  canonicalPersonalFilingQualityDocument,
  decodePersonalFilingQualityDocument,
} from "./test-personal-filing-quality-measurement-builder";
import type { JsonRecord } from "./test-personal-filing-fact-builder";

describe("personal filing quality measurement security", () => {
  it("consumes every first attempt and rejects replay, copies, and cross-instance capabilities", () => {
    const fixture = buildPersonalFilingQualityMeasurementFixture();
    const malformed = createPersonalFilingQualityMeasurementProtocol();
    expectFailure(
      malformed.commit({
        ...fixture.commitInput,
        extra: true,
      } as PersonalFilingQualityMeasurementCommitInput),
      "protocol_quarantined",
    );
    expectFailure(
      malformed.commit(fixture.commitInput),
      "protocol_quarantined",
    );

    const early = createPersonalFilingQualityMeasurementProtocol();
    expectFailure(
      early.reveal({}, fixture.ownerReviewedReference),
      "protocol_quarantined",
    );
    expectFailure(early.commit(fixture.commitInput), "protocol_quarantined");

    const first = createPersonalFilingQualityMeasurementProtocol();
    const second = createPersonalFilingQualityMeasurementProtocol();
    const firstCommit = committed(first.commit(fixture.commitInput));
    const secondCommit = committed(second.commit(fixture.commitInput));
    expectFailure(
      first.reveal(secondCommit.capability, fixture.ownerReviewedReference),
      "protocol_quarantined",
    );
    expectFailure(
      first.reveal(firstCommit.capability, fixture.ownerReviewedReference),
      "protocol_quarantined",
    );
    expectFailure(
      second.reveal(
        structuredClone(secondCommit.capability),
        fixture.ownerReviewedReference,
      ),
      "protocol_quarantined",
    );
  });

  it("consumes reference digest mismatch without exposing either reference", () => {
    const fixture = buildPersonalFilingQualityMeasurementFixture();
    const protocol = createPersonalFilingQualityMeasurementProtocol();
    const commit = committed(protocol.commit(fixture.commitInput));
    const reference = decodePersonalFilingQualityDocument(
      fixture.ownerReviewedReference,
    );
    const documents = reference.documents as Array<{ facts: JsonRecord[] }>;
    const fact = documents[0]?.facts[0];
    if (fact === undefined) throw new TypeError("Fixture is incomplete.");
    fact.value = "77000001";
    const changed = canonicalPersonalFilingQualityDocument(reference);
    const failure = protocol.reveal(commit.capability, changed);
    expectFailure(failure, "measurement_quarantined");
    expect(JSON.stringify(failure)).not.toContain("77000001");
    expectFailure(
      protocol.reveal(commit.capability, fixture.ownerReviewedReference),
      "protocol_quarantined",
    );
  });

  it("rejects proxies, accessors, aliased bytes, and noncanonical plan bytes", () => {
    const fixture = buildPersonalFilingQualityMeasurementFixture();
    const accessor = Object.create(Object.prototype) as Record<string, unknown>;
    for (const [key, value] of Object.entries(fixture.commitInput) as Array<
      [string, unknown]
    >) {
      Object.defineProperty(accessor, key, {
        enumerable: true,
        get: () => value,
      });
    }
    const plan = decodePersonalFilingQualityDocument(
      fixture.commitInput.qualityPlan,
    );
    const noncanonical = new TextEncoder().encode(
      `${JSON.stringify(plan, null, 2)}\n`,
    );
    const cases = [
      new Proxy(fixture.commitInput, {}),
      accessor as unknown as PersonalFilingQualityMeasurementCommitInput,
      {
        ...fixture.commitInput,
        qualityPlan: fixture.commitInput.manifest,
      },
      { ...fixture.commitInput, qualityPlan: noncanonical },
    ];
    for (const input of cases) {
      const protocol = createPersonalFilingQualityMeasurementProtocol();
      expectFailure(protocol.commit(input), "protocol_quarantined");
    }
  });

  it("rejects alternate, shared, detached, re-prototyped, and oversized byte carriers", () => {
    const fixture = buildPersonalFilingQualityMeasurementFixture();
    const source = fixture.commitInput.qualityPlan;
    const rePrototyped = new Uint16Array(2);
    Object.setPrototypeOf(rePrototyped, Uint8Array.prototype);
    const variants: unknown[] = [
      Buffer.from(source),
      new (class extends Uint8Array {})(source),
      new Uint16Array(2),
      rePrototyped,
      new DataView(new ArrayBuffer(8)),
      new Uint8Array(new SharedArrayBuffer(Math.max(3, source.byteLength))),
      new Uint8Array(
        PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.qualityPlanBytes + 1,
      ),
    ];
    const detached = Uint8Array.from(source);
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    variants.push(detached);
    for (const qualityPlan of variants) {
      const protocol = createPersonalFilingQualityMeasurementProtocol();
      expectFailure(
        protocol.commit({
          ...fixture.commitInput,
          qualityPlan: qualityPlan as Uint8Array,
        }),
        "protocol_quarantined",
      );
    }

    let sourceGetterCalls = 0;
    const accessorSources = new Array<Uint8Array>(1);
    Object.defineProperty(accessorSources, "0", {
      enumerable: true,
      get() {
        sourceGetterCalls += 1;
        throw new Error("QUALITY_SOURCE_GETTER_CANARY");
      },
    });
    expectFailure(
      createPersonalFilingQualityMeasurementProtocol().commit({
        ...fixture.commitInput,
        sourceDocuments: accessorSources,
      }),
      "protocol_quarantined",
    );
    expect(sourceGetterCalls).toBe(0);

    let symbolGetterCalls = 0;
    const symbolCanary = Symbol("private-quality-symbol-canary");
    const symbolCommit = {
      ...fixture.commitInput,
    } as PersonalFilingQualityMeasurementCommitInput &
      Record<PropertyKey, unknown>;
    Object.defineProperty(symbolCommit, symbolCanary, {
      enumerable: true,
      get() {
        symbolGetterCalls += 1;
        throw new Error("QUALITY_SYMBOL_GETTER_CANARY");
      },
    });
    expectFailure(
      createPersonalFilingQualityMeasurementProtocol().commit(symbolCommit),
      "protocol_quarantined",
    );

    for (const field of ["rawFilingDocuments", "sourceDocuments"] as const) {
      const documents = [...fixture.commitInput[field]];
      Object.defineProperty(documents, symbolCanary, {
        enumerable: true,
        get() {
          symbolGetterCalls += 1;
          throw new Error("QUALITY_ARRAY_SYMBOL_GETTER_CANARY");
        },
      });
      expectFailure(
        createPersonalFilingQualityMeasurementProtocol().commit({
          ...fixture.commitInput,
          [field]: documents,
        }),
        "protocol_quarantined",
      );
    }
    expect(symbolGetterCalls).toBe(0);

    const nonEnumerableSources = [...fixture.commitInput.sourceDocuments];
    Object.defineProperty(nonEnumerableSources, "0", {
      configurable: true,
      enumerable: false,
      value: nonEnumerableSources[0],
      writable: true,
    });
    expectFailure(
      createPersonalFilingQualityMeasurementProtocol().commit({
        ...fixture.commitInput,
        sourceDocuments: nonEnumerableSources,
      }),
      "protocol_quarantined",
    );
  });

  it("rejects malformed, reordered, incomplete, and incoherent reference labels value-free", () => {
    const fixture = buildPersonalFilingQualityMeasurementFixture();
    const valid = decodePersonalFilingQualityDocument(
      fixture.ownerReviewedReference,
    );
    const reordered = structuredClone(valid);
    const reorderedFacts = (
      reordered.documents as Array<{ facts: JsonRecord[] }>
    )[0]?.facts;
    if (reorderedFacts === undefined)
      throw new TypeError("Fixture is incomplete.");
    reorderedFacts.reverse();
    const incomplete = structuredClone(valid);
    (incomplete.documents as Array<{ facts: JsonRecord[] }>)[0]?.facts.pop();
    const incoherent = structuredClone(valid);
    const freeCashFlow = (
      incoherent.documents as Array<{ facts: JsonRecord[] }>
    )[0]?.facts[4];
    if (freeCashFlow === undefined)
      throw new TypeError("Fixture is incomplete.");
    const derivation = freeCashFlow.derivation as JsonRecord;
    (derivation.subtrahend as JsonRecord).value = "1234567";
    const crossPeriod = structuredClone(valid);
    const crossPeriodFreeCashFlow = (
      crossPeriod.documents as Array<{ facts: JsonRecord[] }>
    )[0]?.facts[4];
    if (crossPeriodFreeCashFlow === undefined)
      throw new TypeError("Fixture is incomplete.");
    crossPeriodFreeCashFlow.periodStart = "2000-01-01";
    (
      (crossPeriodFreeCashFlow.derivation as JsonRecord)
        .subtrahend as JsonRecord
    ).periodStart = "2000-01-01";
    const malformed = { ...valid, extra: "private-quality-canary" };

    for (const reference of [
      reordered,
      incomplete,
      incoherent,
      crossPeriod,
      malformed,
    ]) {
      const reboundFixture = buildPersonalFilingQualityMeasurementFixture();
      const bytes = canonicalPersonalFilingQualityDocument(reference);
      const plan = decodePersonalFilingQualityDocument(
        reboundFixture.commitInput.qualityPlan,
      );
      // Bind the malformed content so this reaches schema validation, not only
      // the precommitted digest check.
      const digest = `sha256:${sha256Hex(bytes)}`;
      plan.ownerReviewedReferenceSha256 = digest;
      const protocol = createPersonalFilingQualityMeasurementProtocol();
      const commit = committed(
        protocol.commit({
          ...reboundFixture.commitInput,
          qualityPlan: canonicalPersonalFilingQualityDocument(plan),
        }),
      );
      const result = protocol.reveal(commit.capability, bytes);
      expectFailure(result, "measurement_quarantined");
      expect(JSON.stringify(result)).not.toContain("private-quality-canary");
    }
  });

  it("reports concept, unit, period, and FCF operand conflicts only as aggregate not_met", () => {
    const fixture = buildPersonalFilingQualityMeasurementFixture();
    const candidate = decodePersonalFilingQualityDocument(
      fixture.candidateObservations,
    );
    const facts = (candidate.documents as Array<{ facts: JsonRecord[] }>)[0]
      ?.facts;
    if (facts === undefined) throw new TypeError("Fixture is incomplete.");
    const assets = facts[0];
    const freeCashFlow = facts[4];
    if (assets === undefined || freeCashFlow === undefined)
      throw new TypeError("Fixture is incomplete.");
    assets.sourceConcept = "privatecanary:SecretConcept";
    assets.unit = "shares";
    assets.periodEnd = "2025-12-30";
    const derivation = freeCashFlow.derivation as JsonRecord;
    (derivation.subtrahend as JsonRecord).value = "7000001";

    const protocol =
      createSuppliedPersonalFilingQualityMeasurementProtocolForTesting();
    const commit = committed(
      protocol.commit({
        ...fixture.commitInput,
        candidateObservations:
          canonicalPersonalFilingQualityDocument(candidate),
      }),
    );
    const result = protocol.reveal(
      commit.capability,
      fixture.ownerReviewedReference,
    );
    expect(result).toMatchObject({
      counts: {
        conceptMismatchCount: 1,
        periodMismatchCount: 1,
        silentCriticalFailureCount: 3,
        unitMismatchCount: 1,
        valueMismatchCount: 1,
      },
      personalQualityThresholdOutcome: "not_met",
      status: "quality_evaluated_for_personal_use",
    });
    expect(JSON.stringify(result)).not.toContain("privatecanary:SecretConcept");
    expectDeepFrozen(result);
  });
});

function committed(
  result: ReturnType<
    ReturnType<typeof createPersonalFilingQualityMeasurementProtocol>["commit"]
  >,
) {
  if (result.status !== "candidate_committed_for_personal_use")
    throw new TypeError("Expected quality candidate commit.");
  return result;
}

function expectFailure(
  result: unknown,
  code: "measurement_quarantined" | "protocol_quarantined",
): void {
  expect(result).toEqual({
    assurance:
      "candidate_observations_committed_before_owner_reviewed_reference_content_reveal",
    audit: {
      criticalAssertionCount: 0,
      documentCount: 0,
      emittedFactCount: 0,
      expectedFactCount: 0,
      outcome: "quarantined",
      quarantinedDocumentCount: 0,
      succeededDocumentCount: 0,
    },
    bindings: [],
    claim: PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM,
    code,
    counts: [],
    metrics: [],
    schemaVersion: "1.0.0",
    status: "quarantined",
    synthetic: false,
  });
  const record = result as PersonalFilingQualityMeasurementQuarantinedResult;
  expectDeepFrozen(record);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}
