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
      failedCorrectiveRevision: "061944f8f770e8a08b2a38d1e2fedf8b8e2de348",
      failedDiagnosticRevision: "abd65313705282dab8071f5d36c78d31b1720ee3",
      failedPrecursorRevision: "14b4ecf41806dca7759a06bebf7ef8da96374f76",
      failedRecoveryRevision: "f29e39cea40e76d500df833fd8e0e94e0c86a68c",
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
  it("emits the v2 review with the superseded v1 anchors", () => {
    const review = {
      artifactName: "artifact-v2",
      baseline: "b9b7dd19996f0c5bb1e073ab5522c42e06dee397",
      evidenceSha256: `sha256:${"a".repeat(64)}`,
      evidenceVersion: 2,
      historicalV1: {
        artifactId: "9588542275",
        claimStatus: "superseded",
        evidenceSha256:
          "sha256:aa45aaed5d28898fd0ea9b563792c61f5d4b908a8e2a8a4602bcb96bb9d2c965",
        evidenceVersion: 1,
        jobId: "98022742591",
        reason:
          "cross_input_child_receipt_replay_and_common_mode_lineage_reciprocity_gap",
        runId: "32917020041",
        sourceRevision: "54908db1ded8193ac4ade7a3d6f38505c6b4b8e5",
      },
      repository: "owner/repo",
      revision: "b".repeat(40),
      runAttempt: 1,
      runId: "123",
      sourceCount: 68,
      transitionPathCount: 10,
      verdict: "offline_consistent",
    } as const;
    expect(filingParserCrossEngineExecutionEvidenceReviewStdout(review)).toBe(
      `${JSON.stringify(review)}\n`,
    );
  });
});
