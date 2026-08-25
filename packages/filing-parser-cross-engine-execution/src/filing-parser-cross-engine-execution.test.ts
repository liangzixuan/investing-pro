import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_CLAIM,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_ROLES,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_SCHEMA_VERSION,
  FilingParserCrossEngineExecutionConfigurationError,
  createFilingParserCrossEngineExecutionBoundary,
  type FilingParserCrossEngineExecutionResult,
} from "./filing-parser-cross-engine-execution";
import {
  NODE_IMAGE,
  buildCrossEngineTestHarness,
} from "./test-cross-engine-execution-builder";

describe("filing parser cross-engine execution", () => {
  it("freezes the exact contract and bounded roles", () => {
    expect(FILING_PARSER_CROSS_ENGINE_EXECUTION_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_PARSER_CROSS_ENGINE_EXECUTION_CLAIM).toBe(
      "bounded_synthetic_two_distinct_pinned_engine_executions_to_exact_ten_fact_normalization_agreement",
    );
    expect(FILING_PARSER_CROSS_ENGINE_EXECUTION_ROLES).toEqual([
      "python-primary",
      "node-secondary",
    ]);
    expect(FILING_PARSER_CROSS_ENGINE_EXECUTION_CHECKS).toHaveLength(16);
    expect(FILING_PARSER_CROSS_ENGINE_EXECUTION_NOT_PROVEN).toHaveLength(16);
    expect(FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS).toMatchObject({
      archiveBytes: 1_048_576,
      archives: 2,
      engines: 2,
      factVersions: 20,
      lineageEdges: 10,
    });
    expect(Object.isFrozen(FILING_PARSER_CROSS_ENGINE_EXECUTION_ROLES)).toBe(
      true,
    );
  });

  it("returns one immutable exact agreement with bounded provenance", async () => {
    const harness = await buildCrossEngineTestHarness();
    const boundary = createFilingParserCrossEngineExecutionBoundary(
      harness.configuration,
    );
    const result = await boundary.execute(
      harness.originalArchive,
      harness.amendmentArchive,
    );

    expect(result.status).toBe("agreed");
    if (result.status !== "agreed") throw new Error("expected agreement");
    expect(result.normalization).toEqual(harness.pythonResult.normalization);
    expect(result.provenance.engineCount).toBe(2);
    expect(result.provenance.engines).toEqual([
      expect.objectContaining({
        engineId: "python-3.12-primary-v1",
        role: "python-primary",
      }),
      expect.objectContaining({
        engineId: "node-24-secondary-v1",
        imageSha256: NODE_IMAGE,
        role: "node-secondary",
      }),
    ]);
    expect(result.provenance.originalArchiveSha256).toBe(
      sha256(harness.originalArchive),
    );
    expect(result.provenance.amendmentArchiveSha256).toBe(
      sha256(harness.amendmentArchive),
    );
    expect(result.provenance.agreementSha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.provenance)).toBe(true);
    expect(Object.isFrozen(result.provenance.engines)).toBe(true);
    expect(Object.isFrozen(result.normalization.factVersions)).toBe(true);
    expect(harness.python.calls).toHaveLength(1);
    expect(harness.node.calls).toHaveLength(1);
  });

  it("uses fresh owned archive copies for each fixed engine role", async () => {
    const harness = await buildCrossEngineTestHarness();
    harness.python.mutateInputs = true;
    const originalBefore = harness.originalArchive.slice();
    const amendmentBefore = harness.amendmentArchive.slice();
    const boundary = createFilingParserCrossEngineExecutionBoundary(
      harness.configuration,
    );
    const result = await boundary.execute(
      harness.originalArchive,
      harness.amendmentArchive,
    );

    expect(result.status).toBe("agreed");
    expect(harness.originalArchive).toEqual(originalBefore);
    expect(harness.amendmentArchive).toEqual(amendmentBefore);
    expect(harness.python.calls[0]?.original).not.toBe(harness.originalArchive);
    expect(harness.node.calls[0]?.original).not.toBe(harness.originalArchive);
    expect(harness.python.calls[0]?.original).not.toBe(
      harness.node.calls[0]?.original,
    );
    expect(harness.node.calls[0]?.original).toEqual(originalBefore);
    expect(harness.node.calls[0]?.amendment).toEqual(amendmentBefore);
  });

  it("is deterministic for exact replay", async () => {
    const harness = await buildCrossEngineTestHarness();
    const boundary = createFilingParserCrossEngineExecutionBoundary(
      harness.configuration,
    );
    const firstResult = await createFilingParserCrossEngineExecutionBoundary(
      harness.configuration,
    ).execute(harness.originalArchive, harness.amendmentArchive);
    const secondResult = await boundary.execute(
      harness.originalArchive,
      harness.amendmentArchive,
    );
    expect(secondResult).toEqual(firstResult);
  });

  it("rejects malformed and non-distinct configuration", async () => {
    const harness = await buildCrossEngineTestHarness();
    for (const invalid of [
      undefined,
      {},
      { ...harness.configuration, extra: true },
      {
        ...harness.configuration,
        nodeSecondary: {
          ...harness.configuration.nodeSecondary,
          role: "python-primary",
        },
      },
      {
        ...harness.configuration,
        nodeSecondary: {
          ...harness.configuration.nodeSecondary,
          engineId: harness.configuration.pythonPrimary.engineId,
        },
      },
      {
        ...harness.configuration,
        nodeSecondary: {
          ...harness.configuration.nodeSecondary,
          imageSha256: harness.configuration.pythonPrimary.imageSha256,
        },
      },
      {
        ...harness.configuration,
        nodeSecondary: {
          ...harness.configuration.nodeSecondary,
          implementationSha256:
            harness.configuration.pythonPrimary.implementationSha256,
        },
      },
      {
        ...harness.configuration,
        nodeSecondary: {
          ...harness.configuration.nodeSecondary,
          boundary: harness.configuration.pythonPrimary.boundary,
        },
      },
    ]) {
      expect(() =>
        createFilingParserCrossEngineExecutionBoundary(invalid),
      ).toThrow(FilingParserCrossEngineExecutionConfigurationError);
    }
  });

  it("quarantines missing, extra, identical, and invalid inputs", async () => {
    const harness = await buildCrossEngineTestHarness();
    const boundary = createFilingParserCrossEngineExecutionBoundary(
      harness.configuration,
    );
    const rawExecute = Reflect.get(boundary, "execute") as (
      ...args: unknown[]
    ) => Promise<FilingParserCrossEngineExecutionResult>;
    for (const invoke of [
      () => rawExecute.call(boundary),
      () => rawExecute.call(boundary, harness.originalArchive),
      () =>
        rawExecute.call(
          boundary,
          harness.originalArchive,
          harness.amendmentArchive,
          undefined,
          "extra",
        ),
      () => boundary.execute(new Uint8Array(), harness.amendmentArchive),
      () => boundary.execute({}, harness.amendmentArchive),
      () => boundary.execute(harness.originalArchive, harness.originalArchive),
      () =>
        boundary.execute(harness.originalArchive, harness.amendmentArchive, {
          signal: {} as AbortSignal,
        }),
    ]) {
      assertQuarantined(await invoke());
    }
  });
});

function assertQuarantined(value: unknown): void {
  expect(value).toEqual({
    claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_CLAIM,
    code: "agreement_quarantined",
    normalization: null,
    provenance: null,
    schemaVersion: FILING_PARSER_CROSS_ENGINE_EXECUTION_SCHEMA_VERSION,
    status: "quarantined",
    synthetic: true,
  });
  expect(JSON.stringify(value)).not.toMatch(/sha256:|SYN-|fact:/u);
  expect(Object.isFrozen(value)).toBe(true);
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
