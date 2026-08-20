import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { filingParserEvidenceReviewStdout } from "./filing-parser-evidence-review";
import { verifyFilingParserEvidenceOffline } from "./filing-parser-evidence-verifier";

const temporaryDirectories: string[] = [];
const HASH = `sha256:${"a".repeat(64)}` as const;

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("offline filing parser evidence review", () => {
  it("emits one value-free canonical success line", () => {
    expect(
      filingParserEvidenceReviewStdout({
        evidenceSha256: HASH,
        recordedChecksPassed: [] as never,
        recordedNotProven: [] as never,
        repository: "example/research-cockpit",
        revision: "b".repeat(40),
        runAttempt: 1,
        runId: "123",
        sourceHashCount: 26,
        verdict: "offline_consistent",
      }),
    ).toBe(
      `{"evidenceSha256":"${HASH}","repository":"example/research-cockpit","revision":"${"b".repeat(40)}","runAttempt":1,"runId":"123","sourceHashCount":26,"verdict":"offline_consistent"}\n`,
    );
  });

  it("fails closed before Git for a noncanonical candidate", async () => {
    const directory = await mkdtemp(join(tmpdir(), "filing-evidence-test-"));
    temporaryDirectories.push(directory);
    const evidencePath = join(directory, "evidence.json");
    await writeFile(evidencePath, "{}\n", { flag: "wx", mode: 0o600 });

    await expect(
      verifyFilingParserEvidenceOffline({
        evidencePath,
        expectedEvidenceSha256: HASH,
        expectedRepository: "example/research-cockpit",
        expectedRevision: "b".repeat(40),
        expectedRunAttempt: 1,
        expectedRunId: "123",
        repositoryPath: directory,
      }),
    ).rejects.toThrow("Offline evidence review failed.");
  });

  it("rejects malformed independent anchors with one stable error", async () => {
    await expect(
      verifyFilingParserEvidenceOffline({
        evidencePath: "missing",
        expectedEvidenceSha256: "sha256:bad",
        expectedRepository: "not-a-repository",
        expectedRevision: "bad",
        expectedRunAttempt: 0,
        expectedRunId: "0",
        repositoryPath: "missing",
      }),
    ).rejects.toThrow("Offline evidence review failed.");
  });
});
