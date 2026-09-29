import { describe, expect, it } from "vitest";
import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_V6_SOURCE_BOUNDARY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_V5_HISTORICAL_BOUNDARY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_V6_SOURCE_PATHS,
  createFilingParserCrossEngineExecutionEvidenceV6,
  parseCanonicalFilingParserCrossEngineExecutionEvidenceV6,
  serializeCanonicalFilingParserCrossEngineExecutionEvidenceV6,
  type FilingParserCrossEngineExecutionEvidenceV6,
} from "./filing-parser-cross-engine-execution-evidence-v6";
import { buildFilingParserCrossEngineExecutionEvidenceV5Input } from "./test-filing-parser-cross-engine-execution-evidence-builder";

function input(): FilingParserCrossEngineExecutionEvidenceV6 {
  const { baseline, transition, ...domain } =
    buildFilingParserCrossEngineExecutionEvidenceV5Input();
  void baseline;
  void transition;
  return {
    ...domain,
    schemaVersion: "6.0.0",
    evidenceVersion: 6,
    sourceBoundary: FILING_PARSER_CROSS_ENGINE_EXECUTION_V6_SOURCE_BOUNDARY,
    historicalV5: FILING_PARSER_CROSS_ENGINE_EXECUTION_V5_HISTORICAL_BOUNDARY,
    sourceHashes: FILING_PARSER_CROSS_ENGINE_EXECUTION_V6_SOURCE_PATHS.map(
      (path) => ({ path, sha256: `sha256:${"a".repeat(64)}` }),
    ),
    workflow: {
      ...domain.workflow,
      artifactName: `filing-parser-cross-engine-execution-evidence-v6-${domain.revision}-1`,
    },
  };
}
function mutable() {
  return JSON.parse(
    JSON.stringify(input()),
  ) as FilingParserCrossEngineExecutionEvidenceV6;
}

describe("current-source cross-engine V6 evidence", () => {
  it("round-trips actual current revision metadata with the unchanged six-case contract", () => {
    const value = createFilingParserCrossEngineExecutionEvidenceV6(input());
    expect(value.caseOutcomes).toEqual(
      buildFilingParserCrossEngineExecutionEvidenceV5Input().caseOutcomes,
    );
    expect(value.runtime).toEqual(
      buildFilingParserCrossEngineExecutionEvidenceV5Input().runtime,
    );
    expect(value).not.toHaveProperty("transition");
    expect(value).not.toHaveProperty("baseline");
    expect(value.revision).toBe("d".repeat(40));
    expect(
      Object.isFrozen(value.caseOutcomes[0]?.invocations?.[0].custody),
    ).toBe(true);
    const text =
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV6(value);
    expect(
      parseCanonicalFilingParserCrossEngineExecutionEvidenceV6(
        new TextEncoder().encode(text),
      ),
    ).toEqual(value);
  });
  it.each([
    "historicalAnchor",
    "policy",
    "correctiveRevision",
    "revision",
    "artifact",
    "extra",
    "source",
    "source-order",
  ])("rejects altered %s provenance", (kind) => {
    const value = JSON.parse(JSON.stringify(input())) as Record<
      string,
      unknown
    >;
    if (kind === "historicalAnchor" || kind === "policy")
      (value.sourceBoundary as Record<string, unknown>)[kind] = "x";
    if (kind === "correctiveRevision")
      (value.historicalV5 as Record<string, unknown>).correctiveRevision =
        "e".repeat(40);
    if (kind === "revision") value.revision = "E".repeat(40);
    if (kind === "artifact")
      (value.workflow as Record<string, unknown>).artifactName = "old-v5";
    if (kind === "extra") value.transition = {};
    if (kind === "source") (value.sourceHashes as unknown[]).pop();
    if (kind === "source-order") (value.sourceHashes as unknown[]).reverse();
    expect(() =>
      createFilingParserCrossEngineExecutionEvidenceV6(
        value as FilingParserCrossEngineExecutionEvidenceV6,
      ),
    ).toThrow();
  });
  it.each([
    "receipt",
    "quarantine",
    "runtime",
    "engine",
    "fixture",
    "measurement",
  ])("retains the V5 %s rejection", (kind) => {
    const value = mutable();
    if (kind === "receipt")
      (
        value.caseOutcomes[0]!.invocations![0].custody.receipts[0] as {
          receiptSha256: string;
        }
      ).receiptSha256 = `sha256:${"f".repeat(64)}`;
    if (kind === "quarantine")
      (value.caseOutcomes[1] as { observedStatus: string }).observedStatus =
        "evaluated_not_met";
    if (kind === "runtime")
      (value.runtime as { directExecutionCount: number }).directExecutionCount =
        0;
    if (kind === "engine")
      (
        value.engines[0] as { implementationSha256: string }
      ).implementationSha256 = `sha256:${"f".repeat(64)}`;
    if (kind === "fixture")
      (value as { fixtureManifestSha256: string }).fixtureManifestSha256 =
        `sha256:${"f".repeat(64)}`;
    if (kind === "measurement")
      (
        value.caseOutcomes[0]!.invocations![0].measurement as {
          evaluationSha256: string;
        }
      ).evaluationSha256 = `sha256:${"f".repeat(64)}`;
    expect(() =>
      createFilingParserCrossEngineExecutionEvidenceV6(value),
    ).toThrow();
  });
  it("rejects noncanonical bytes and descriptor-backed input", () => {
    const text =
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV6(input());
    for (const changed of [
      text.trimEnd(),
      "\ufeff" + text,
      text.replace("{", "{ "),
    ])
      expect(() =>
        parseCanonicalFilingParserCrossEngineExecutionEvidenceV6(
          new TextEncoder().encode(changed),
        ),
      ).toThrow();
    const value = input();
    Object.defineProperty(value, "revision", {
      get: () => {
        throw new Error("must not execute");
      },
    });
    expect(() =>
      createFilingParserCrossEngineExecutionEvidenceV6(value),
    ).toThrow();
  });
});
