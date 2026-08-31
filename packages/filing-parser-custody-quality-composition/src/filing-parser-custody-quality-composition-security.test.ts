import { describe, expect, it } from "vitest";

import {
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
  type FilingParserArchivePairCustodyProtocol,
  type FilingParserArchivePairCustodyResult,
} from "@research-cockpit/filing-payload-custody";
import type {
  FilingParserQualityCompositionCommitResult,
  FilingParserQualityCompositionCommittedResult,
  FilingParserQualityCompositionEvaluatedResult,
  FilingParserQualityCompositionRevealResult,
} from "@research-cockpit/filing-parser-quality-composition";

import { createFilingParserArchivePairCustodyProtocolForTest } from "../../filing-payload-custody/src/parser-archive-pair-custody";
import {
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
  type FilingParserCustodyQualityCompositionCommitResult,
  type FilingParserCustodyQualityCompositionRevealResult,
} from "./filing-parser-custody-quality-composition";
import * as publicApi from "./index";
import {
  DeferredCustodyProtocol,
  RecordingCustodyProtocol,
  buildFilingParserCustodyQualityCompositionTestHarness,
  createStaticAuthenticatedCustodyProtocol,
  forgeQualityCandidateObservationsWithRecomputedBindings,
  forgeQualityMeasurementCandidateWithRecomputedBindings,
  forgeQualityProjectionWithRecomputedBindings,
  qualityQuarantine,
} from "./test-filing-parser-custody-quality-composition-builder";

const FORGED_HASH: `sha256:${string}` = `sha256:${"f".repeat(64)}`;
type CommitMutation = (
  value: FilingParserQualityCompositionCommittedResult,
) => FilingParserQualityCompositionCommitResult;
type RevealMutation = (
  value: FilingParserQualityCompositionEvaluatedResult,
) => FilingParserQualityCompositionRevealResult;

describe("filing parser custody quality composition security", () => {
  it("keeps both dependency seams out of public exports", () => {
    expect(
      "createFilingParserCustodyQualityCompositionProtocolForTest" in publicApi,
    ).toBe(false);
    expect(
      "buildFilingParserCustodyQualityCompositionTestHarness" in publicApi,
    ).toBe(false);
  });

  it("rejects invalid archives and role swap before either dependency receives bytes", async () => {
    const builders: Array<
      (harness: Harness) => readonly [Uint8Array, Uint8Array]
    > = [
      (harness) => [tamper(harness.originalArchive), harness.amendmentArchive],
      (harness) => [harness.amendmentArchive, harness.originalArchive],
    ];
    for (const build of builders) {
      const harness = buildFilingParserCustodyQualityCompositionTestHarness();
      const [original, amendment] = build(harness);
      const result = await harness.protocol.commit(
        harness.plan,
        harness.declaredReferenceSha256,
        original,
        amendment,
      );
      assertQuarantined(result);
      expect(harness.quality.commitCalls).toHaveLength(0);
      expect(custodyCalls(harness)).toHaveLength(0);
      assertQuarantined(
        await harness.protocol.commit(
          harness.plan,
          harness.declaredReferenceSha256,
          harness.originalArchive,
          harness.amendmentArchive,
        ),
      );
    }
  });

  it("consumes reference mismatch, capability replay, double reveal, and cross-instance substitution", async () => {
    // Keep capability-state coverage independent of filesystem custody, which
    // has separate encrypted-workspace integration coverage.
    const mismatch = buildFilingParserCustodyQualityCompositionTestHarness({
      custody: createStaticAuthenticatedCustodyProtocol("reference-mismatch"),
    });
    const mismatchCommit = await commit(mismatch);
    const changedReference = Uint8Array.from(mismatch.declaredReference);
    changedReference[0] = (changedReference[0] ?? 0) ^ 1;
    const firstMismatch = mismatch.protocol.reveal(
      mismatchCommit.capability,
      changedReference,
    );
    const consumedMismatch = mismatch.protocol.reveal(
      mismatchCommit.capability,
      mismatch.declaredReference,
    );
    assertQuarantined(firstMismatch);
    assertQuarantined(consumedMismatch);
    expect(consumedMismatch).toBe(firstMismatch);
    expect(mismatch.quality.revealCalls).toHaveLength(0);

    const replay = buildFilingParserCustodyQualityCompositionTestHarness({
      custody: createStaticAuthenticatedCustodyProtocol("capability-replay"),
    });
    const replayCommit = await commit(replay);
    assertEvaluated(
      replay.protocol.reveal(replayCommit.capability, replay.declaredReference),
    );
    const secondReveal = replay.protocol.reveal(
      replayCommit.capability,
      replay.declaredReference,
    );
    const thirdReveal = replay.protocol.reveal(
      replayCommit.capability,
      replay.declaredReference,
    );
    assertQuarantined(secondReveal);
    assertQuarantined(thirdReveal);
    expect(thirdReveal).toBe(secondReveal);
    expect(replay.quality.revealCalls).toHaveLength(1);

    const left = buildFilingParserCustodyQualityCompositionTestHarness({
      custody: createStaticAuthenticatedCustodyProtocol("cross-instance-left"),
    });
    const right = buildFilingParserCustodyQualityCompositionTestHarness({
      custody: createStaticAuthenticatedCustodyProtocol("cross-instance-right"),
    });
    const leftCommit = await commit(left);
    const rightCommit = await commit(right);
    assertQuarantined(
      right.protocol.reveal(leftCommit.capability, right.declaredReference),
    );
    assertQuarantined(
      right.protocol.reveal(rightCommit.capability, right.declaredReference),
    );
    assertEvaluated(
      left.protocol.reveal(leftCommit.capability, left.declaredReference),
    );
  });

  it("makes early reveal and concurrent commit consuming failures before Cycle 2n", async () => {
    const earlyCustody = new DeferredCustodyProtocol(
      createStaticAuthenticatedCustodyProtocol("early-reveal"),
    );
    const early = buildFilingParserCustodyQualityCompositionTestHarness({
      custody: earlyCustody,
    });
    const pendingEarly = early.protocol.commit(
      early.plan,
      early.declaredReferenceSha256,
      early.originalArchive,
      early.amendmentArchive,
    );
    await earlyCustody.started;
    const earlyResult = early.protocol.reveal(
      Object.freeze({}),
      early.declaredReference,
    );
    assertQuarantined(earlyResult);
    earlyCustody.release();
    const earlyCommit = await pendingEarly;
    assertQuarantined(earlyCommit);
    expect(earlyCommit).toBe(earlyResult);
    expect(early.quality.commitCalls).toHaveLength(0);

    const concurrentCustody = new DeferredCustodyProtocol(
      createStaticAuthenticatedCustodyProtocol("concurrent-commit"),
    );
    const concurrent = buildFilingParserCustodyQualityCompositionTestHarness({
      custody: concurrentCustody,
    });
    const first = concurrent.protocol.commit(
      concurrent.plan,
      concurrent.declaredReferenceSha256,
      concurrent.originalArchive,
      concurrent.amendmentArchive,
    );
    await concurrentCustody.started;
    const second = await concurrent.protocol.commit(
      concurrent.plan,
      concurrent.declaredReferenceSha256,
      concurrent.originalArchive,
      concurrent.amendmentArchive,
    );
    concurrentCustody.release();
    const firstResult = await first;
    assertQuarantined(second);
    assertQuarantined(firstResult);
    expect(firstResult).toBe(second);
    expect(concurrentCustody.calls).toHaveLength(1);
    expect(concurrent.quality.commitCalls).toHaveLength(0);
  });

  it("quarantines authenticated-custody readback, receipt, pair-binding, and role-order tamper", async () => {
    const transforms: readonly CustodyTransform[] = [
      (result) => {
        if (result.status !== "readback") return result;
        const originalArchive = Uint8Array.from(result.originalArchive);
        originalArchive[0] = (originalArchive[0] ?? 0) ^ 1;
        result.originalArchive.fill(0);
        return { ...result, originalArchive };
      },
      (result) =>
        result.status === "readback"
          ? { ...result, custodyPairBindingSha256: FORGED_HASH }
          : result,
      (result) =>
        result.status === "readback"
          ? {
              ...result,
              receipts: Object.freeze([
                { ...result.receipts[0], receiptSha256: FORGED_HASH },
                result.receipts[1],
              ] as const),
            }
          : result,
      (result) =>
        result.status === "readback"
          ? {
              ...result,
              receipts: Object.freeze([
                result.receipts[1],
                result.receipts[0],
              ] as const),
            }
          : result,
    ];

    for (const [index, transform] of transforms.entries()) {
      const custody = new RecordingCustodyProtocol(
        createStaticAuthenticatedCustodyProtocol(`custody-tamper-${index}`),
        transform,
      );
      const harness = buildFilingParserCustodyQualityCompositionTestHarness({
        custody,
      });
      const result = await harness.protocol.commit(
        harness.plan,
        harness.declaredReferenceSha256,
        harness.originalArchive,
        harness.amendmentArchive,
      );
      assertQuarantined(result);
      expect(harness.quality.commitCalls).toHaveLength(0);
      expect(custody.calls).toHaveLength(1);
    }
  });

  it("quarantines inner commit/reveal tamper and downstream quarantine at both boundaries", async () => {
    const commitTamper = buildFilingParserCustodyQualityCompositionTestHarness({
      custody: createStaticAuthenticatedCustodyProtocol("inner-commit-tamper"),
      qualityCommitTransform: (result) =>
        result.status === "candidate_committed"
          ? { ...result, candidateCommitmentSha256: FORGED_HASH }
          : result,
    });
    assertQuarantined(
      await commitTamper.protocol.commit(
        commitTamper.plan,
        commitTamper.declaredReferenceSha256,
        commitTamper.originalArchive,
        commitTamper.amendmentArchive,
      ),
    );

    const commitQuarantine =
      buildFilingParserCustodyQualityCompositionTestHarness({
        custody: createStaticAuthenticatedCustodyProtocol(
          "inner-commit-quarantine",
        ),
        qualityCommitTransform: () => qualityQuarantine(),
      });
    assertQuarantined(
      await commitQuarantine.protocol.commit(
        commitQuarantine.plan,
        commitQuarantine.declaredReferenceSha256,
        commitQuarantine.originalArchive,
        commitQuarantine.amendmentArchive,
      ),
    );

    const revealTamper = buildFilingParserCustodyQualityCompositionTestHarness({
      custody: createStaticAuthenticatedCustodyProtocol("inner-reveal-tamper"),
      qualityRevealTransform: (result) =>
        result.status === "evaluated"
          ? { ...result, candidateCommitmentSha256: FORGED_HASH }
          : result,
    });
    const revealTamperCommit = await commit(revealTamper);
    assertQuarantined(
      revealTamper.protocol.reveal(
        revealTamperCommit.capability,
        revealTamper.declaredReference,
      ),
    );

    const revealQuarantine =
      buildFilingParserCustodyQualityCompositionTestHarness({
        custody: createStaticAuthenticatedCustodyProtocol(
          "inner-reveal-quarantine",
        ),
        qualityRevealTransform: () => qualityQuarantine(),
      });
    const revealQuarantineCommit = await commit(revealQuarantine);
    assertQuarantined(
      revealQuarantine.protocol.reveal(
        revealQuarantineCommit.capability,
        revealQuarantine.declaredReference,
      ),
    );
  });

  it("recomputes every exposed Cycle 2n commitment hash and rejects sparse, proxy, and accessor carriers", async () => {
    let accessorReads = 0;
    let proxyTraps = 0;
    const mutations: readonly (readonly [string, CommitMutation])[] = [
      [
        "projection binding",
        (result) => ({
          ...result,
          projectionReceipts: Object.freeze([
            {
              ...result.projectionReceipts[0],
              projectionBindingSha256: FORGED_HASH,
            },
            result.projectionReceipts[1],
          ] as const),
        }),
      ],
      [
        "candidate observations with every dependent binding recomputed",
        (result) =>
          forgeQualityCandidateObservationsWithRecomputedBindings(
            result,
            FORGED_HASH,
          ),
      ],
      [
        "original observation with every dependent binding recomputed",
        (result) =>
          forgeQualityProjectionWithRecomputedBindings(result, 0, {
            observationSha256: FORGED_HASH,
          }),
      ],
      [
        "amendment observation with every dependent binding recomputed",
        (result) =>
          forgeQualityProjectionWithRecomputedBindings(result, 1, {
            observationSha256: FORGED_HASH,
          }),
      ],
      [
        "projection lifecycles with every dependent binding recomputed",
        (result) =>
          forgeQualityProjectionWithRecomputedBindings(result, 0, {
            sourceLifecycleBindingSha256s: Object.freeze([
              `sha256:${"b".repeat(64)}`,
              `sha256:${"c".repeat(64)}`,
            ] as const),
          }),
      ],
      [
        "quality document hash",
        (result) => ({
          ...result,
          projectionReceipts: Object.freeze([
            {
              ...result.projectionReceipts[0],
              qualityDocumentSha256: FORGED_HASH,
            },
            result.projectionReceipts[1],
          ] as const),
        }),
      ],
      [
        "candidate commitment",
        (result) => ({ ...result, candidateCommitmentSha256: FORGED_HASH }),
      ],
      [
        "Cycle 2n composition commitment",
        (result) => ({ ...result, compositionCommitmentSha256: FORGED_HASH }),
      ],
      [
        "direct execution claim",
        (result) =>
          ({
            ...result,
            sourceExecution: {
              ...result.sourceExecution,
              directExecutionClaim: "forged_direct_execution_claim",
            },
          }) as unknown as FilingParserQualityCompositionCommittedResult,
      ],
      [
        "direct execution schema",
        (result) =>
          ({
            ...result,
            sourceExecution: {
              ...result.sourceExecution,
              directExecutionSchemaVersion: "9.9.9",
            },
          }) as unknown as FilingParserQualityCompositionCommittedResult,
      ],
      [
        "sparse lifecycle array",
        (result) => {
          const sparse: unknown[] = new Array(4);
          sparse[0] = result.sourceExecution.lifecycleBindingSha256s[0];
          sparse[1] = result.sourceExecution.lifecycleBindingSha256s[1];
          sparse[3] = result.sourceExecution.lifecycleBindingSha256s[3];
          return {
            ...result,
            sourceExecution: {
              ...result.sourceExecution,
              lifecycleBindingSha256s: sparse,
            },
          } as unknown as FilingParserQualityCompositionCommittedResult;
        },
      ],
      [
        "proxy receipt array",
        (result) => {
          const proxy = new Proxy([...result.projectionReceipts], {
            get: (target, property, receiver) => {
              proxyTraps += 1;
              const reflected: unknown = Reflect.get(
                target,
                property,
                receiver,
              );
              return reflected;
            },
            getOwnPropertyDescriptor: (target, property) => {
              proxyTraps += 1;
              return Reflect.getOwnPropertyDescriptor(target, property);
            },
            getPrototypeOf: (target) => {
              proxyTraps += 1;
              return Reflect.getPrototypeOf(target);
            },
            ownKeys: (target) => {
              proxyTraps += 1;
              return Reflect.ownKeys(target);
            },
          });
          return {
            ...result,
            projectionReceipts: proxy,
          } as unknown as FilingParserQualityCompositionCommittedResult;
        },
      ],
      [
        "accessor receipt field",
        (result) => {
          const receipt = { ...result.projectionReceipts[0] };
          Object.defineProperty(receipt, "observationSha256", {
            enumerable: true,
            get: () => {
              accessorReads += 1;
              return result.projectionReceipts[0].observationSha256;
            },
          });
          return {
            ...result,
            projectionReceipts: Object.freeze([
              receipt,
              result.projectionReceipts[1],
            ]),
          } as unknown as FilingParserQualityCompositionCommittedResult;
        },
      ],
    ];

    for (const [label, mutate] of mutations) {
      const harness = buildFilingParserCustodyQualityCompositionTestHarness({
        custody: createStaticAuthenticatedCustodyProtocol(
          `quality-commit-forgery-${label}`,
        ),
        qualityCommitTransform: (result) =>
          result.status === "candidate_committed" ? mutate(result) : result,
      });
      const value = await harness.protocol.commit(
        harness.plan,
        harness.declaredReferenceSha256,
        harness.originalArchive,
        harness.amendmentArchive,
      );
      assertQuarantined(value);
    }
    expect(accessorReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it("requires the exact fixed measurement and recomputes both Cycle 2n evaluation bindings", async () => {
    const mutations: readonly (readonly [string, RevealMutation])[] = [
      [
        "measurement candidate with every dependent binding recomputed",
        (result) =>
          forgeQualityMeasurementCandidateWithRecomputedBindings(
            result,
            FORGED_HASH,
          ),
      ],
      [
        "measurement claim",
        (result) =>
          ({
            ...result,
            measurement: { ...result.measurement, claim: "forged_claim" },
          }) as unknown as FilingParserQualityCompositionEvaluatedResult,
      ],
      [
        "measurement schema",
        (result) =>
          ({
            ...result,
            measurement: { ...result.measurement, schemaVersion: "9.9.9" },
          }) as unknown as FilingParserQualityCompositionEvaluatedResult,
      ],
      [
        "measurement count",
        (result) =>
          ({
            ...result,
            measurement: {
              ...result.measurement,
              counts: { ...result.measurement.counts, documentCount: 99 },
            },
          }) as unknown as FilingParserQualityCompositionEvaluatedResult,
      ],
      [
        "measurement metric",
        (result) => ({
          ...result,
          measurement: {
            ...result.measurement,
            metrics: {
              ...result.measurement.metrics,
              factRecall: {
                ...result.measurement.metrics.factRecall,
                numerator: 21,
              },
            },
          },
        }),
      ],
      [
        "measurement evaluation hash",
        (result) => ({
          ...result,
          measurement: {
            ...result.measurement,
            evaluationSha256: FORGED_HASH,
          },
        }),
      ],
      [
        "quality evaluation binding",
        (result) => ({
          ...result,
          qualityEvaluationBindingSha256: FORGED_HASH,
        }),
      ],
      [
        "Cycle 2n evaluation binding",
        (result) => ({ ...result, evaluationBindingSha256: FORGED_HASH }),
      ],
    ];

    for (const [label, mutate] of mutations) {
      const harness = buildFilingParserCustodyQualityCompositionTestHarness({
        custody: createStaticAuthenticatedCustodyProtocol(
          `quality-reveal-forgery-${label}`,
        ),
        qualityRevealTransform: (result) =>
          result.status === "evaluated" ? mutate(result) : result,
      });
      const committed = await commit(harness);
      assertQuarantined(
        harness.protocol.reveal(
          committed.capability,
          harness.declaredReference,
        ),
      );
    }
  });

  it("maps custody quarantine, cleanup failure, and thrown dependency details to one value-free deeply frozen result", async () => {
    const dependencyQuarantine: FilingParserArchivePairCustodyProtocol =
      Object.freeze({
        custodyAndRead: (): Promise<FilingParserArchivePairCustodyResult> =>
          Promise.resolve(
            Object.freeze({
              claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
              code: "parser_archive_pair_custody_quarantined" as const,
              schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
              status: "quarantined" as const,
              synthetic: true as const,
            }),
          ),
      });
    const quarantinedHarness =
      buildFilingParserCustodyQualityCompositionTestHarness({
        custody: dependencyQuarantine,
      });
    const dependencyResult = await quarantinedHarness.protocol.commit(
      quarantinedHarness.plan,
      quarantinedHarness.declaredReferenceSha256,
      quarantinedHarness.originalArchive,
      quarantinedHarness.amendmentArchive,
    );
    assertQuarantined(dependencyResult);

    const cleanupFailure = createFilingParserArchivePairCustodyProtocolForTest({
      afterPhase: (phase) => {
        if (phase === "before_cleanup")
          throw new TypeError("cleanup-secret-canary");
      },
    });
    const cleanupHarness =
      buildFilingParserCustodyQualityCompositionTestHarness({
        custody: cleanupFailure,
      });
    const cleanupResult = await cleanupHarness.protocol.commit(
      cleanupHarness.plan,
      cleanupHarness.declaredReferenceSha256,
      cleanupHarness.originalArchive,
      cleanupHarness.amendmentArchive,
    );
    assertQuarantined(cleanupResult);

    const throwingCustody: FilingParserArchivePairCustodyProtocol =
      Object.freeze({
        custodyAndRead: () =>
          Promise.reject(new Error("dependency-secret-canary")),
      });
    const thrownHarness = buildFilingParserCustodyQualityCompositionTestHarness(
      {
        custody: throwingCustody,
      },
    );
    const thrownResult = await thrownHarness.protocol.commit(
      thrownHarness.plan,
      thrownHarness.declaredReferenceSha256,
      thrownHarness.originalArchive,
      thrownHarness.amendmentArchive,
    );
    assertQuarantined(thrownResult);

    expect(cleanupResult).toBe(dependencyResult);
    expect(thrownResult).toBe(dependencyResult);
  });
});

type Harness = ReturnType<
  typeof buildFilingParserCustodyQualityCompositionTestHarness
>;
type CustodyTransform = (
  result: FilingParserArchivePairCustodyResult,
) => FilingParserArchivePairCustodyResult;

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

function custodyCalls(harness: Harness): readonly unknown[] {
  return harness.custody instanceof RecordingCustodyProtocol
    ? harness.custody.calls
    : [];
}

function tamper(value: Uint8Array): Uint8Array {
  const result = Uint8Array.from(value);
  result[0] = (result[0] ?? 0) ^ 1;
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

function assertQuarantined(
  value:
    | FilingParserCustodyQualityCompositionCommitResult
    | FilingParserCustodyQualityCompositionRevealResult,
): void {
  expect(value).toEqual({
    claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
    code: "custody_quality_composition_quarantined",
    schemaVersion: "1.0.0",
    status: "quarantined",
    synthetic: true,
  });
  expect(Object.keys(value)).toEqual([
    "claim",
    "code",
    "schemaVersion",
    "status",
    "synthetic",
  ]);
  expect(deeplyFrozen(value)).toBe(true);
  expect(JSON.stringify(value)).not.toMatch(
    /canary|secret|sha256|digest|receipt|ciphertext|path|stack/iu,
  );
}

function deeplyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return (
    Object.isFrozen(value) &&
    Reflect.ownKeys(value).every((key) =>
      deeplyFrozen((value as Record<PropertyKey, unknown>)[key]),
    )
  );
}
