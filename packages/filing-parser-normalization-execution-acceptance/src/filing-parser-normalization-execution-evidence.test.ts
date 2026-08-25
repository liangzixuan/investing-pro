import { describe, expect, it } from "vitest";

import {
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CHECKS,
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_NOT_PROVEN,
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS,
  createFilingParserNormalizationExecutionEvidence,
  parseCanonicalFilingParserNormalizationExecutionEvidence,
  serializeCanonicalFilingParserNormalizationExecutionEvidence,
} from "./filing-parser-normalization-execution-evidence";
import { buildFilingParserNormalizationExecutionEvidenceInput } from "./test-filing-parser-normalization-execution-evidence-builder";

describe("Cycle 2j live evidence", () => {
  it("round-trips one canonical immutable success-only carrier", () => {
    const input = buildFilingParserNormalizationExecutionEvidenceInput();
    const evidence = createFilingParserNormalizationExecutionEvidence(input);
    const text =
      serializeCanonicalFilingParserNormalizationExecutionEvidence(evidence);
    const parsed = parseCanonicalFilingParserNormalizationExecutionEvidence(
      new TextEncoder().encode(text),
    );
    expect(parsed).toEqual(evidence);
    expect(parsed.runtime.cpuCount).toBe(0.5);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.runtime.capabilitiesDropped)).toBe(true);
    expect(FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CHECKS).toHaveLength(
      16,
    );
    expect(
      FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_NOT_PROVEN,
    ).toHaveLength(16);
    expect(
      new Set(FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS).size,
    ).toBe(FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS.length);
  });

  it("rejects missing sources, wrong anchors, invalid dates, and noncanonical bytes", () => {
    const valid = buildFilingParserNormalizationExecutionEvidenceInput();
    for (const mutation of [
      { ...valid, sourceHashes: valid.sourceHashes.slice(1) },
      { ...valid, fixtureManifestSha256: `sha256:${"c".repeat(63)}` },
      { ...valid, startedAt: "2026-02-31T16:00:00.000Z" },
      {
        ...valid,
        image: { ...valid.image, baseIndexDigest: `sha256:${"c".repeat(64)}` },
      },
    ]) {
      expect(() =>
        createFilingParserNormalizationExecutionEvidence(
          mutation as typeof valid,
        ),
      ).toThrow("evidence is invalid");
    }
    const text = serializeCanonicalFilingParserNormalizationExecutionEvidence(
      createFilingParserNormalizationExecutionEvidence(valid),
    );
    expect(() =>
      parseCanonicalFilingParserNormalizationExecutionEvidence(
        new TextEncoder().encode(` ${text}`),
      ),
    ).toThrow("evidence is invalid");
  });

  it("recursively freezes mutable children of a pre-frozen carrier", () => {
    const input = buildFilingParserNormalizationExecutionEvidenceInput();
    const capabilities = ["ALL"] as ["ALL"];
    const runtime = Object.freeze({
      ...input.runtime,
      capabilitiesDropped: capabilities,
    });
    const evidence = createFilingParserNormalizationExecutionEvidence({
      ...input,
      runtime,
    });
    expect(Object.isFrozen(evidence.runtime.capabilitiesDropped)).toBe(true);
    expect(() => capabilities.push("ALL")).toThrow();
  });
});
