import { describe, expect, it } from "vitest";

import {
  filingPayloadCustodyEvidenceReviewOptionsFromArguments,
  filingPayloadCustodyEvidenceReviewStdout,
} from "./filing-payload-custody-evidence-review";

const HASH = `sha256:${"a".repeat(64)}` as const;

describe("filing payload custody evidence review boundary", () => {
  it("accepts exactly one optional CLI separator and a closed argument set", () => {
    const values = [
      "--evidence",
      "evidence.json",
      "--evidence-sha256",
      HASH,
      "--repo",
      "repository",
      "--repository",
      "example/research-cockpit",
      "--revision",
      "b".repeat(40),
      "--run-attempt",
      "1",
      "--run-id",
      "123",
    ];
    const expected = {
      evidencePath: "evidence.json",
      expectedEvidenceSha256: HASH,
      expectedRepository: "example/research-cockpit",
      expectedRevision: "b".repeat(40),
      expectedRunAttempt: 1,
      expectedRunId: "123",
      repositoryPath: "repository",
    };
    expect(
      filingPayloadCustodyEvidenceReviewOptionsFromArguments(values),
    ).toEqual(expected);
    expect(
      filingPayloadCustodyEvidenceReviewOptionsFromArguments(["--", ...values]),
    ).toEqual(expected);
    for (const malformed of [
      ["--", "--", ...values],
      [...values, "--"],
      ["--", ...values, "--evidence", "other.json"],
    ]) {
      expect(() =>
        filingPayloadCustodyEvidenceReviewOptionsFromArguments(malformed),
      ).toThrow("Offline filing payload custody evidence review failed.");
    }
  });

  it("emits one canonical value-free success line", () => {
    expect(
      filingPayloadCustodyEvidenceReviewStdout({
        evidenceSha256: HASH,
        recordedChecksPassed: [] as never,
        recordedNotProven: [] as never,
        repository: "example/research-cockpit",
        revision: "b".repeat(40),
        runAttempt: 1,
        runId: "123",
        sourceHashCount: 29,
        verdict: "offline_consistent",
      }),
    ).toBe(
      `{"evidenceSha256":"${HASH}","repository":"example/research-cockpit","revision":"${"b".repeat(40)}","runAttempt":1,"runId":"123","sourceHashCount":29,"verdict":"offline_consistent"}\n`,
    );
  });
});
