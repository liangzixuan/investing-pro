import { describe, expect, it } from "vitest";

import { FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM } from "@research-cockpit/filing-parser-cross-engine-execution";

import {
  FILING_PARSER_QUALITY_COMPOSITION_CLAIM,
  createFilingParserQualityCompositionProtocol,
  createFilingParserQualityCompositionProtocolForTest,
  type FilingParserQualityCompositionCommitResult,
  type FilingParserQualityCompositionRevealResult,
} from "./filing-parser-quality-composition";
import * as publicApi from "./index";
import {
  buildDirectResultForTest,
  buildFilingParserQualityCompositionTestHarness,
  canonicalTestDocument,
  decodeTestDocument,
  sha256ForTest,
} from "./test-filing-parser-quality-composition-builder";

describe("filing parser quality composition security", () => {
  it("keeps the dependency seam out of public exports and rejects public injection configuration", async () => {
    expect(
      "createFilingParserQualityCompositionProtocolForTest" in publicApi,
    ).toBe(false);
    expect("buildFilingParserQualityCompositionTestHarness" in publicApi).toBe(
      false,
    );
    const harness = buildFilingParserQualityCompositionTestHarness();
    const protocol = createFilingParserQualityCompositionProtocol({
      ...harness.configuration,
      boundary: harness.boundary,
    } as never);
    assertQuarantined(
      await protocol.commit(
        harness.plan,
        harness.declaredReferenceSha256,
        harness.originalArchive,
        harness.amendmentArchive,
      ),
    );
  });

  it("consumes precommit reveal, retry, replay, and cross-instance capability substitution", async () => {
    const before = buildFilingParserQualityCompositionTestHarness();
    const beforeProtocol = createFilingParserQualityCompositionProtocolForTest(
      before.boundary,
    );
    assertQuarantined(
      beforeProtocol.reveal(Object.freeze({}), before.declaredReference),
    );
    assertQuarantined(
      await beforeProtocol.commit(
        before.plan,
        before.declaredReferenceSha256,
        before.originalArchive,
        before.amendmentArchive,
      ),
    );
    expect(before.boundary.calls).toHaveLength(0);

    const duplicate = buildFilingParserQualityCompositionTestHarness();
    const duplicateProtocol =
      createFilingParserQualityCompositionProtocolForTest(duplicate.boundary);
    const committed = await duplicateProtocol.commit(
      duplicate.plan,
      duplicate.declaredReferenceSha256,
      duplicate.originalArchive,
      duplicate.amendmentArchive,
    );
    assertCommitted(committed);
    assertQuarantined(
      await duplicateProtocol.commit(
        duplicate.plan,
        duplicate.declaredReferenceSha256,
        duplicate.originalArchive,
        duplicate.amendmentArchive,
      ),
    );
    assertQuarantined(
      duplicateProtocol.reveal(
        committed.capability,
        duplicate.declaredReference,
      ),
    );

    const left = buildFilingParserQualityCompositionTestHarness();
    const right = buildFilingParserQualityCompositionTestHarness();
    const leftProtocol = createFilingParserQualityCompositionProtocolForTest(
      left.boundary,
    );
    const rightProtocol = createFilingParserQualityCompositionProtocolForTest(
      right.boundary,
    );
    const leftCommit = await leftProtocol.commit(
      left.plan,
      left.declaredReferenceSha256,
      left.originalArchive,
      left.amendmentArchive,
    );
    const rightCommit = await rightProtocol.commit(
      right.plan,
      right.declaredReferenceSha256,
      right.originalArchive,
      right.amendmentArchive,
    );
    assertCommitted(leftCommit);
    assertCommitted(rightCommit);
    assertQuarantined(
      rightProtocol.reveal(leftCommit.capability, right.declaredReference),
    );
    assertQuarantined(
      rightProtocol.reveal(rightCommit.capability, right.declaredReference),
    );
    assertEvaluated(
      leftProtocol.reveal(leftCommit.capability, left.declaredReference),
    );
    assertQuarantined(
      leftProtocol.reveal(leftCommit.capability, left.declaredReference),
    );
  });

  it("makes concurrent commit and reveal-during-commit consuming failures", async () => {
    const concurrent = buildFilingParserQualityCompositionTestHarness();
    concurrent.boundary.defer = true;
    const concurrentProtocol =
      createFilingParserQualityCompositionProtocolForTest(concurrent.boundary);
    const first = concurrentProtocol.commit(
      concurrent.plan,
      concurrent.declaredReferenceSha256,
      concurrent.originalArchive,
      concurrent.amendmentArchive,
    );
    await concurrent.boundary.started;
    const second = await concurrentProtocol.commit(
      concurrent.plan,
      concurrent.declaredReferenceSha256,
      concurrent.originalArchive,
      concurrent.amendmentArchive,
    );
    concurrent.boundary.release();
    assertQuarantined(second);
    assertQuarantined(await first);
    expect(concurrent.boundary.calls).toHaveLength(1);

    const earlyReveal = buildFilingParserQualityCompositionTestHarness();
    earlyReveal.boundary.defer = true;
    const earlyRevealProtocol =
      createFilingParserQualityCompositionProtocolForTest(earlyReveal.boundary);
    const pending = earlyRevealProtocol.commit(
      earlyReveal.plan,
      earlyReveal.declaredReferenceSha256,
      earlyReveal.originalArchive,
      earlyReveal.amendmentArchive,
    );
    await earlyReveal.boundary.started;
    assertQuarantined(
      earlyRevealProtocol.reveal(
        Object.freeze({}),
        earlyReveal.declaredReference,
      ),
    );
    earlyReveal.boundary.release();
    assertQuarantined(await pending);
  });

  it("quarantines a fifth commit argument before direct execution and consumes the protocol", async () => {
    const harness = buildFilingParserQualityCompositionTestHarness();
    const protocol = createFilingParserQualityCompositionProtocolForTest(
      harness.boundary,
    );
    const result = (await Reflect.apply(protocol.commit, protocol, [
      harness.plan,
      harness.declaredReferenceSha256,
      harness.originalArchive,
      harness.amendmentArchive,
      harness.declaredReference,
    ])) as FilingParserQualityCompositionCommitResult;
    assertQuarantined(result);
    expect(harness.boundary.calls).toHaveLength(0);
    assertQuarantined(
      await protocol.commit(
        harness.plan,
        harness.declaredReferenceSha256,
        harness.originalArchive,
        harness.amendmentArchive,
      ),
    );
  });

  it("owns plan and archive bytes before awaiting the source execution", async () => {
    const harness = buildFilingParserQualityCompositionTestHarness();
    harness.boundary.defer = true;
    const protocol = createFilingParserQualityCompositionProtocolForTest(
      harness.boundary,
    );
    const plan = Uint8Array.from(harness.plan);
    const original = Uint8Array.from(harness.originalArchive);
    const amendment = Uint8Array.from(harness.amendmentArchive);
    const pending = protocol.commit(
      plan,
      harness.declaredReferenceSha256,
      original,
      amendment,
    );
    await harness.boundary.started;
    plan.fill(0);
    original.fill(0);
    amendment.fill(0);
    harness.boundary.release();
    const committed = await pending;
    assertCommitted(committed);
    expect(harness.boundary.calls[0]?.original).toEqual(
      harness.originalArchive,
    );
    expect(harness.boundary.calls[0]?.amendment).toEqual(
      harness.amendmentArchive,
    );
    assertEvaluated(
      protocol.reveal(committed.capability, harness.declaredReference),
    );
  });

  it("rejects closed dependency-output carrier violations including symbols, accessors, sparse arrays, and non-enumerable data", async () => {
    const builders: Array<(value: Record<string, unknown>) => unknown> = [
      (value) => {
        const provenance = value.provenance as Record<string, unknown>;
        const values = provenance.engineLifecycles as unknown[];
        Object.defineProperty(values, Symbol("array-canary"), {
          enumerable: true,
          value: "canary",
        });
        return value;
      },
      (value) => {
        const provenance = value.provenance as Record<string, unknown>;
        Object.defineProperty(provenance, "executionMode", {
          enumerable: true,
          get: () => "source_owned_direct_docker",
        });
        return value;
      },
      (value) => {
        Object.defineProperty(value, "synthetic", {
          enumerable: false,
          value: true,
        });
        return value;
      },
      (value) => {
        Object.defineProperty(value, "__proto__", {
          enumerable: true,
          value: { canary: "prototype-pollution-canary" },
        });
        return value;
      },
      (value) => {
        const provenance = value.provenance as Record<string, unknown>;
        const values = provenance.engineLifecycles as unknown[];
        Reflect.deleteProperty(values, "1");
        return value;
      },
      (value) => new Proxy(value, {}),
    ];
    for (const build of builders) {
      const harness = buildFilingParserQualityCompositionTestHarness();
      harness.boundary.outcome = build(
        structuredClone(harness.directResult) as unknown as Record<
          string,
          unknown
        >,
      ) as never;
      const protocol = createFilingParserQualityCompositionProtocolForTest(
        harness.boundary,
      );
      assertQuarantined(
        await protocol.commit(
          harness.plan,
          harness.declaredReferenceSha256,
          harness.originalArchive,
          harness.amendmentArchive,
        ),
      );
    }
  });

  it("rejects recomputed forged normalization semantics and lifecycle role or digest tampering", async () => {
    const semanticMutations: Array<
      (normalization: Record<string, unknown>) => void
    > = [
      (normalization) => {
        const fact = facts(normalization)[0]!;
        fact.sourceAcceptedAt = "2026-02-20T20:00:02.000Z";
      },
      (normalization) => {
        const fact = facts(normalization)[10]!;
        fact.sourceConcept = "rc-synthetic:ForgedAssets";
      },
      (normalization) => {
        const fact = facts(normalization)[10]!;
        fact.periodEnd = "2025-12-30";
      },
      (normalization) => {
        for (let index = 0; index < 10; index += 1) {
          const original = facts(normalization)[index]!;
          const amendment = facts(normalization)[index + 10]!;
          amendment.value = `${original.value as string}1`;
        }
      },
      (normalization) => {
        const fact = facts(normalization)[10]!;
        fact.sourceAccession = "SYN-9999999999-26-000002";
      },
      (normalization) => {
        facts(normalization)[0]!.periodEnd = "2025-02-30";
        facts(normalization)[10]!.periodEnd = "2025-02-30";
      },
      (normalization) => {
        const fact = facts(normalization)[0]!;
        fact.sourceAvailableAt = "2026-99-20T20:00:01.000Z";
        fact.knownFrom = "2026-99-20T20:00:01.000Z";
      },
      (normalization) => {
        for (const fact of facts(normalization).slice(0, 10)) {
          fact.sourceAccession = "SYN-0000000001-25-000001";
        }
      },
      (normalization) => {
        facts(normalization)[3]!.periodStart = "2025-02-01";
        facts(normalization)[13]!.periodStart = "2025-02-01";
      },
      (normalization) => {
        facts(normalization)[0]!.periodEnd = "2027-12-31";
        facts(normalization)[10]!.periodEnd = "2027-12-31";
      },
    ];
    for (const mutate of semanticMutations) {
      const harness = buildFilingParserQualityCompositionTestHarness();
      const normalization = structuredClone(harness.normalization);
      mutate(normalization);
      harness.boundary.outcome = buildDirectResultForTest(
        normalization,
        harness.originalArchive,
        harness.amendmentArchive,
        "forged-semantics",
      );
      const protocol = createFilingParserQualityCompositionProtocolForTest(
        harness.boundary,
      );
      assertQuarantined(
        await protocol.commit(
          harness.plan,
          harness.declaredReferenceSha256,
          harness.originalArchive,
          harness.amendmentArchive,
        ),
      );
    }

    for (const pythonEngineId of [
      "Python-primary-v1",
      "python-primary\nforged",
      `p${"a".repeat(128)}`,
    ]) {
      const harness = buildFilingParserQualityCompositionTestHarness();
      harness.boundary.outcome = buildDirectResultForTest(
        harness.normalization,
        harness.originalArchive,
        harness.amendmentArchive,
        "forged-engine-id",
        { pythonEngineId },
      );
      const protocol = createFilingParserQualityCompositionProtocolForTest(
        harness.boundary,
      );
      assertQuarantined(
        await protocol.commit(
          harness.plan,
          harness.declaredReferenceSha256,
          harness.originalArchive,
          harness.amendmentArchive,
        ),
      );
    }

    {
      const harness = buildFilingParserQualityCompositionTestHarness();
      const sharedExecutionBinding = `sha256:${"e".repeat(64)}` as const;
      harness.boundary.outcome = buildDirectResultForTest(
        harness.normalization,
        harness.originalArchive,
        harness.amendmentArchive,
        "forged-equal-execution-binding",
        {
          nodeExecutionBindingSha256: sharedExecutionBinding,
          pythonExecutionBindingSha256: sharedExecutionBinding,
        },
      );
      const protocol = createFilingParserQualityCompositionProtocolForTest(
        harness.boundary,
      );
      assertQuarantined(
        await protocol.commit(
          harness.plan,
          harness.declaredReferenceSha256,
          harness.originalArchive,
          harness.amendmentArchive,
        ),
      );
    }

    for (const mutate of [
      (result: Record<string, unknown>) => {
        const provenance = result.provenance as Record<string, unknown>;
        const lifecycles = provenance.engineLifecycles as Array<
          Record<string, unknown>
        >;
        lifecycles[0]!.role = "node-secondary";
      },
      (result: Record<string, unknown>) => {
        const provenance = result.provenance as Record<string, unknown>;
        const lifecycles = provenance.engineLifecycles as Array<
          Record<string, unknown>
        >;
        const receipts = lifecycles[0]!.lifecycles as Array<
          Record<string, unknown>
        >;
        receipts[0]!.archiveSha256 = `sha256:${"f".repeat(64)}`;
      },
    ]) {
      const harness = buildFilingParserQualityCompositionTestHarness();
      const result = structuredClone(harness.directResult) as unknown as Record<
        string,
        unknown
      >;
      mutate(result);
      harness.boundary.outcome = result as never;
      const protocol = createFilingParserQualityCompositionProtocolForTest(
        harness.boundary,
      );
      assertQuarantined(
        await protocol.commit(
          harness.plan,
          harness.declaredReferenceSha256,
          harness.originalArchive,
          harness.amendmentArchive,
        ),
      );
    }
  });

  it("consumes reference digest mismatch and rejects a valid but nonmatching first-two-document reference", async () => {
    const mismatch = buildFilingParserQualityCompositionTestHarness();
    const mismatchProtocol =
      createFilingParserQualityCompositionProtocolForTest(mismatch.boundary);
    const mismatchCommit = await mismatchProtocol.commit(
      mismatch.plan,
      mismatch.declaredReferenceSha256,
      mismatch.originalArchive,
      mismatch.amendmentArchive,
    );
    assertCommitted(mismatchCommit);
    const changedBytes = Uint8Array.from(mismatch.declaredReference);
    changedBytes[10] = (changedBytes[10] ?? 0) ^ 1;
    assertQuarantined(
      mismatchProtocol.reveal(mismatchCommit.capability, changedBytes),
    );
    assertQuarantined(
      mismatchProtocol.reveal(
        mismatchCommit.capability,
        mismatch.declaredReference,
      ),
    );

    const qualityMismatch = buildFilingParserQualityCompositionTestHarness();
    const reference = decodeTestDocument(qualityMismatch.declaredReference);
    const documents = reference.documents as Array<Record<string, unknown>>;
    const referenceFacts = documents[0]!.facts as Array<
      Record<string, unknown>
    >;
    referenceFacts[0]!.value = "250000001";
    const forgedReference = canonicalTestDocument(reference);
    const protocol = createFilingParserQualityCompositionProtocolForTest(
      qualityMismatch.boundary,
    );
    const committed = await protocol.commit(
      qualityMismatch.plan,
      sha256ForTest(forgedReference),
      qualityMismatch.originalArchive,
      qualityMismatch.amendmentArchive,
    );
    assertCommitted(committed);
    assertQuarantined(protocol.reveal(committed.capability, forgedReference));
  });

  it("turns dependency quarantine and thrown output into the same value-free result without canary leakage", async () => {
    const harness = buildFilingParserQualityCompositionTestHarness();
    harness.boundary.outcome = {
      claim: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM,
      code: "direct_execution_quarantined",
      schemaVersion: "1.0.0",
      status: "quarantined",
      synthetic: true,
    };
    const protocol = createFilingParserQualityCompositionProtocolForTest(
      harness.boundary,
    );
    assertQuarantined(
      await protocol.commit(
        harness.plan,
        harness.declaredReferenceSha256,
        harness.originalArchive,
        harness.amendmentArchive,
      ),
    );
    const throwing = createFilingParserQualityCompositionProtocolForTest({
      execute: () => Promise.reject(new Error("secret-canary")),
    });
    const thrown = await throwing.commit(
      harness.plan,
      harness.declaredReferenceSha256,
      harness.originalArchive,
      harness.amendmentArchive,
    );
    assertQuarantined(thrown);
    expect(JSON.stringify(thrown)).not.toContain("canary");
  });
});

function facts(
  normalization: Record<string, unknown>,
): Array<Record<string, unknown>> {
  return normalization.factVersions as Array<Record<string, unknown>>;
}

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

function assertQuarantined(
  value:
    | FilingParserQualityCompositionCommitResult
    | FilingParserQualityCompositionRevealResult,
): void {
  expect(value).toEqual({
    claim: FILING_PARSER_QUALITY_COMPOSITION_CLAIM,
    code: "quality_composition_quarantined",
    schemaVersion: "1.0.0",
    status: "quarantined",
    synthetic: true,
  });
  expect(Object.isFrozen(value)).toBe(true);
  expect(Object.keys(value)).toHaveLength(5);
  expect(JSON.stringify(value)).not.toContain("canary");
}
