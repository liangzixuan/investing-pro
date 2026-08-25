import { describe, expect, it } from "vitest";

import {
  filingParserCrossEngineExecutionEvidenceReviewOptionsFromArguments,
  filingParserCrossEngineExecutionEvidenceReviewStdout,
} from "./filing-parser-cross-engine-execution-evidence-review";

describe("filing parser cross-engine execution evidence review", () => {
  const args = [
    "--artifact",
    "artifact",
    "--evidence",
    "C:\\evidence.json",
    "--evidence-sha256",
    `sha256:${"a".repeat(64)}`,
    "--repo",
    "C:\\repo",
    "--repository",
    "owner/repo",
    "--revision",
    "b".repeat(40),
    "--run-attempt",
    "1",
    "--run-id",
    "123",
  ];
  it("parses the exact closed CLI", () => {
    expect(
      filingParserCrossEngineExecutionEvidenceReviewOptionsFromArguments(args),
    ).toMatchObject({
      expectedArtifactName: "artifact",
      expectedRunAttempt: 1,
      expectedRunId: "123",
    });
  });
  it("rejects omissions, duplicates, extras and malformed integers", () => {
    for (const value of [
      args.slice(2),
      [...args, "--extra", "x"],
      [...args, "--artifact", "again"],
      args.map((x, i) => (i === 13 ? "0" : x)),
    ])
      expect(() =>
        filingParserCrossEngineExecutionEvidenceReviewOptionsFromArguments(
          value,
        ),
      ).toThrow();
  });
  it("emits only an offline-consistent review", () => {
    const review = {
      artifactName: "artifact",
      baseline: "962a00f65835fc6126e4da98e0e0d5998e8d59cc",
      evidenceSha256: `sha256:${"a".repeat(64)}`,
      repository: "owner/repo",
      revision: "b".repeat(40),
      runAttempt: 1,
      runId: "123",
      sourceCount: 1,
      transitionPathCount: 44,
      verdict: "offline_consistent",
    } as const;
    expect(filingParserCrossEngineExecutionEvidenceReviewStdout(review)).toBe(
      `${JSON.stringify(review)}\n`,
    );
    expect(() =>
      filingParserCrossEngineExecutionEvidenceReviewStdout({
        ...review,
        verdict: "no",
      } as never),
    ).toThrow();
  });
});
