import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  filingParserEvidenceReviewOptionsFromArguments,
  filingParserEvidenceReviewStdout,
} from "./filing-parser-evidence-review";
import {
  isCycle2aCommitDiffEntryAllowed,
  isCycle2aParserDomainTreeAllowed,
  verifyFilingParserEvidenceOffline,
} from "./filing-parser-evidence-verifier";

const temporaryDirectories: string[] = [];
const HASH = `sha256:${"a".repeat(64)}` as const;
const SUCCESSOR_SOURCE_PATHS = [
  "packages/filing-parser/src/corpus-admission-security.test.ts",
  "packages/filing-parser/src/corpus-admission.test.ts",
  "packages/filing-parser/src/corpus-admission.ts",
] as const;
const CURRENT_PARSER_DOMAIN_TREE = [
  "fixtures/synthetic/filing-parser/v1/cases.json",
  "fixtures/synthetic/filing-parser/v1/manifest.json",
  "packages/filing-parser/acceptance/python-image.json",
  "packages/filing-parser/package.json",
  ...SUCCESSOR_SOURCE_PATHS,
  "packages/filing-parser/src/filing-parser-evidence-review.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-parser/src/filing-parser-evidence.test.ts",
  "packages/filing-parser/src/filing-parser-evidence.ts",
  "packages/filing-parser/src/index.ts",
  "packages/filing-parser/src/parser-boundary.test.ts",
  "packages/filing-parser/src/parser-boundary.ts",
  "packages/filing-parser/src/parser-security.test.ts",
  "packages/filing-parser/src/run-filing-parser-acceptance.ts",
  "packages/filing-parser/src/run-filing-parser-evidence-review.ts",
  "packages/filing-parser/src/test-archive-builder.ts",
  "packages/filing-parser/tsconfig.json",
  "packages/filing-parser/worker/Dockerfile",
  "packages/filing-parser/worker/parser.py",
  "packages/filing-parser/worker/taxonomy-v1.json",
].sort();

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("offline filing parser evidence review", () => {
  it("accepts only the legacy tree or its atomic disconnected successor trio", () => {
    const legacy = CURRENT_PARSER_DOMAIN_TREE.filter(
      (path) => !SUCCESSOR_SOURCE_PATHS.includes(path as never),
    );
    expect(isCycle2aParserDomainTreeAllowed(legacy)).toBe(true);
    expect(isCycle2aParserDomainTreeAllowed(CURRENT_PARSER_DOMAIN_TREE)).toBe(
      true,
    );
    for (const omitted of SUCCESSOR_SOURCE_PATHS) {
      expect(
        isCycle2aParserDomainTreeAllowed(
          CURRENT_PARSER_DOMAIN_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2aParserDomainTreeAllowed(
        [
          ...CURRENT_PARSER_DOMAIN_TREE,
          "packages/filing-parser/src/extra.ts",
        ].sort(),
      ),
    ).toBe(false);
  });

  it("admits the six reviewed cumulative successor paths without allowing deletion or extras", () => {
    const successorPaths = [
      "docs/CYCLE_2B_EXIT_MATRIX.md",
      "docs/FILING_PARSER_ISOLATION_EVIDENCE.md",
      "docs/adr/0029-fixed-public-filing-candidate-manifest-admission.md",
      ...SUCCESSOR_SOURCE_PATHS,
    ];
    for (const path of successorPaths) {
      expect(isCycle2aCommitDiffEntryAllowed("A", path)).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("M", path)).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("D", path)).toBe(false);
    }
    expect(
      isCycle2aCommitDiffEntryAllowed(
        "A",
        "packages/filing-parser/src/unreviewed.ts",
      ),
    ).toBe(false);
  });

  it("accepts exactly one conventional CLI separator without weakening the closed argument set", () => {
    const argumentsWithoutSeparator = [
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
      filingParserEvidenceReviewOptionsFromArguments([
        "--",
        ...argumentsWithoutSeparator,
      ]),
    ).toEqual(expected);
    expect(
      filingParserEvidenceReviewOptionsFromArguments(argumentsWithoutSeparator),
    ).toEqual(expected);
    for (const malformed of [
      ["--", "--", ...argumentsWithoutSeparator],
      [...argumentsWithoutSeparator, "--"],
      ["--", ...argumentsWithoutSeparator, "--evidence", "other.json"],
    ]) {
      expect(() =>
        filingParserEvidenceReviewOptionsFromArguments(malformed),
      ).toThrow("Offline evidence review failed.");
    }
  });

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
