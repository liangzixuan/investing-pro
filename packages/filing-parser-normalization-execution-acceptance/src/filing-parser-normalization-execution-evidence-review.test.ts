import { describe, expect, it } from "vitest";

import {
  filingParserNormalizationExecutionEvidenceReviewOptionsFromArguments,
  filingParserNormalizationExecutionEvidenceReviewStdout,
} from "./filing-parser-normalization-execution-evidence-review";

describe("Cycle 2j evidence review CLI", () => {
  it("accepts only the exact anchored argument set and stable verdict", () => {
    const options =
      filingParserNormalizationExecutionEvidenceReviewOptionsFromArguments([
        "--evidence",
        "/tmp/evidence.json",
        "--evidence-sha256",
        `sha256:${"a".repeat(64)}`,
        "--repo",
        "/tmp/repo",
        "--repository",
        "example/research-cockpit",
        "--revision",
        "b".repeat(40),
        "--run-attempt",
        "2",
        "--run-id",
        "123",
      ]);
    expect(options.expectedRunAttempt).toBe(2);
    expect(
      JSON.parse(
        filingParserNormalizationExecutionEvidenceReviewStdout({
          evidenceSha256: `sha256:${"a".repeat(64)}`,
          repository: "example/research-cockpit",
          revision: "b".repeat(40),
          runAttempt: 2,
          runId: "123",
          sourceHashCount: 1,
          verdict: "offline_consistent",
        }),
      ),
    ).toMatchObject({ verdict: "offline_consistent" });
  });

  it("rejects missing, duplicate, and malformed anchors", () => {
    for (const args of [
      ["--evidence", "/tmp/evidence.json"],
      ["--evidence", "a", "--evidence", "b"],
      ["--run-attempt", "0"],
      ["evidence", "a"],
    ])
      expect(() =>
        filingParserNormalizationExecutionEvidenceReviewOptionsFromArguments(
          args,
        ),
      ).toThrow("evidence review failed");
  });
});
