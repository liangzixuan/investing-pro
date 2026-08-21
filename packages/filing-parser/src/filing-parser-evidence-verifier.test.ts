import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  filingParserEvidenceReviewOptionsFromArguments,
  filingParserEvidenceReviewStdout,
} from "./filing-parser-evidence-review";
import {
  isCycle2aDisconnectedCustodyTreeAllowed,
  isCycle2aCommitDiffEntryAllowed,
  isCycle2aEvidenceNoteTreeAllowed,
  isCycle2aParserDomainTreeAllowed,
  isCycle2dCommitDiffSetAllowed,
  isCycle2dDisconnectedNormalizationTreeAllowed,
  isCycle2eCommitDiffSetAllowed,
  isCycle2eDisconnectedComparisonTreeAllowed,
  verifyFilingParserEvidenceOffline,
} from "./filing-parser-evidence-verifier";

const temporaryDirectories: string[] = [];
const HASH = `sha256:${"a".repeat(64)}` as const;
const SUCCESSOR_SOURCE_PATHS = [
  "packages/filing-parser/src/corpus-admission-security.test.ts",
  "packages/filing-parser/src/corpus-admission.test.ts",
  "packages/filing-parser/src/corpus-admission.ts",
] as const;
const PARSER_EVIDENCE_NOTE = "docs/FILING_PARSER_ISOLATION_EVIDENCE.md";
const CUSTODY_EVIDENCE_NOTE = "docs/FILING_PAYLOAD_CUSTODY_EVIDENCE.md";
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
const CYCLE_2C_SUCCESSOR_TREE = [
  "fixtures/synthetic/filing-payload-custody/v1/cases.json",
  "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
  "packages/filing-payload-custody/package.json",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-review.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-review.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence.ts",
  "packages/filing-payload-custody/src/index.ts",
  "packages/filing-payload-custody/src/payload-custody-security.test.ts",
  "packages/filing-payload-custody/src/payload-custody.test.ts",
  "packages/filing-payload-custody/src/payload-custody.ts",
  "packages/filing-payload-custody/src/run-filing-payload-custody-acceptance.ts",
  "packages/filing-payload-custody/src/run-filing-payload-custody-evidence-review.ts",
  "packages/filing-payload-custody/src/test-payload-builder.ts",
  "packages/filing-payload-custody/tsconfig.json",
].sort();
const CYCLE_2D_SUCCESSOR_TREE = [
  "packages/filing-fact-normalization/package.json",
  "packages/filing-fact-normalization/src/filing-fact-normalization-security.test.ts",
  "packages/filing-fact-normalization/src/filing-fact-normalization.test.ts",
  "packages/filing-fact-normalization/src/filing-fact-normalization.ts",
  "packages/filing-fact-normalization/src/index.ts",
  "packages/filing-fact-normalization/src/test-filing-fact-builder.ts",
  "packages/filing-fact-normalization/tsconfig.json",
].sort();
const CYCLE_2D_TRANSITION = [
  { path: "LICENSE_POLICY.md", status: "M" },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2B_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2C_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2D_EXIT_MATRIX.md", status: "A" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0029-fixed-public-filing-candidate-manifest-admission.md",
    status: "M",
  },
  {
    path: "docs/adr/0030-bounded-synthetic-filing-payload-custody.md",
    status: "M",
  },
  {
    path: "docs/adr/0031-bounded-synthetic-ten-fact-normalization-and-lineage.md",
    status: "A",
  },
  { path: "packages/filing-fact-normalization/package.json", status: "A" },
  {
    path: "packages/filing-fact-normalization/src/filing-fact-normalization-security.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-fact-normalization/src/filing-fact-normalization.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-fact-normalization/src/filing-fact-normalization.ts",
    status: "A",
  },
  { path: "packages/filing-fact-normalization/src/index.ts", status: "A" },
  {
    path: "packages/filing-fact-normalization/src/test-filing-fact-builder.ts",
    status: "A",
  },
  { path: "packages/filing-fact-normalization/tsconfig.json", status: "A" },
  {
    path: "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
    status: "M",
  },
  { path: "pnpm-lock.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
] as const;
const CYCLE_2E_SUCCESSOR_TREE = [
  "packages/filing-fact-comparison/package.json",
  "packages/filing-fact-comparison/src/declared-validator-a.ts",
  "packages/filing-fact-comparison/src/declared-validator-b.ts",
  "packages/filing-fact-comparison/src/filing-fact-comparison-security.test.ts",
  "packages/filing-fact-comparison/src/filing-fact-comparison.test.ts",
  "packages/filing-fact-comparison/src/filing-fact-comparison.ts",
  "packages/filing-fact-comparison/src/index.ts",
  "packages/filing-fact-comparison/src/test-filing-fact-comparison-builder.ts",
  "packages/filing-fact-comparison/tsconfig.json",
].sort();
const CYCLE_2E_TRANSITION = [
  { path: "LICENSE_POLICY.md", status: "M" },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2B_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2C_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2D_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2E_EXIT_MATRIX.md", status: "A" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0029-fixed-public-filing-candidate-manifest-admission.md",
    status: "M",
  },
  {
    path: "docs/adr/0030-bounded-synthetic-filing-payload-custody.md",
    status: "M",
  },
  {
    path: "docs/adr/0031-bounded-synthetic-ten-fact-normalization-and-lineage.md",
    status: "M",
  },
  {
    path: "docs/adr/0032-bounded-synthetic-two-declared-validator-fact-comparison.md",
    status: "A",
  },
  { path: "packages/filing-fact-comparison/package.json", status: "A" },
  {
    path: "packages/filing-fact-comparison/src/declared-validator-a.ts",
    status: "A",
  },
  {
    path: "packages/filing-fact-comparison/src/declared-validator-b.ts",
    status: "A",
  },
  {
    path: "packages/filing-fact-comparison/src/filing-fact-comparison-security.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-fact-comparison/src/filing-fact-comparison.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-fact-comparison/src/filing-fact-comparison.ts",
    status: "A",
  },
  { path: "packages/filing-fact-comparison/src/index.ts", status: "A" },
  {
    path: "packages/filing-fact-comparison/src/test-filing-fact-comparison-builder.ts",
    status: "A",
  },
  { path: "packages/filing-fact-comparison/tsconfig.json", status: "A" },
  {
    path: "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
    status: "M",
  },
  { path: "pnpm-lock.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
] as const;

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

  it("admits no custody successor or its exact atomic package and fixture tree", () => {
    expect(isCycle2aDisconnectedCustodyTreeAllowed([])).toBe(true);
    expect(
      isCycle2aDisconnectedCustodyTreeAllowed(CYCLE_2C_SUCCESSOR_TREE),
    ).toBe(true);
    for (const omitted of CYCLE_2C_SUCCESSOR_TREE) {
      expect(
        isCycle2aDisconnectedCustodyTreeAllowed(
          CYCLE_2C_SUCCESSOR_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2aDisconnectedCustodyTreeAllowed(
        [
          ...CYCLE_2C_SUCCESSOR_TREE,
          "packages/filing-payload-custody/src/unreviewed.ts",
        ].sort(),
      ),
    ).toBe(false);
  });

  it("accepts exact canonical, legacy, and current evidence-note trees", () => {
    expect(isCycle2aEvidenceNoteTreeAllowed([])).toBe(true);
    expect(isCycle2aEvidenceNoteTreeAllowed([PARSER_EVIDENCE_NOTE])).toBe(true);
    expect(
      isCycle2aEvidenceNoteTreeAllowed([
        PARSER_EVIDENCE_NOTE,
        CUSTODY_EVIDENCE_NOTE,
      ]),
    ).toBe(true);
    expect(isCycle2aEvidenceNoteTreeAllowed([CUSTODY_EVIDENCE_NOTE])).toBe(
      false,
    );
    expect(
      isCycle2aEvidenceNoteTreeAllowed([
        PARSER_EVIDENCE_NOTE,
        PARSER_EVIDENCE_NOTE,
        CUSTODY_EVIDENCE_NOTE,
      ]),
    ).toBe(false);
    expect(
      isCycle2aEvidenceNoteTreeAllowed([
        PARSER_EVIDENCE_NOTE,
        CUSTODY_EVIDENCE_NOTE,
        "docs/unreviewed.md",
      ]),
    ).toBe(false);
  });

  it("admits only reviewed Cycle 2c cumulative successor paths", () => {
    const successorPaths = [
      ".github/workflows/filing-payload-custody-acceptance.yml",
      "docs/CYCLE_2C_EXIT_MATRIX.md",
      CUSTODY_EVIDENCE_NOTE,
      "docs/adr/0030-bounded-synthetic-filing-payload-custody.md",
      "scripts/verify-filing-payload-custody-fixtures.ts",
      ...CYCLE_2C_SUCCESSOR_TREE,
    ];
    for (const path of successorPaths) {
      expect(isCycle2aCommitDiffEntryAllowed("A", path)).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("M", path)).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("D", path)).toBe(false);
    }
    expect(
      isCycle2aCommitDiffEntryAllowed(
        "A",
        "packages/filing-payload-custody/src/unreviewed.ts",
      ),
    ).toBe(false);
    expect(
      isCycle2aCommitDiffEntryAllowed(
        "A",
        `${CUSTODY_EVIDENCE_NOTE}.unreviewed`,
      ),
    ).toBe(false);
  });

  it("admits only the exact atomic Cycle 2d package tree and transition", () => {
    expect(isCycle2dDisconnectedNormalizationTreeAllowed([])).toBe(true);
    expect(
      isCycle2dDisconnectedNormalizationTreeAllowed(CYCLE_2D_SUCCESSOR_TREE),
    ).toBe(true);
    for (const omitted of CYCLE_2D_SUCCESSOR_TREE) {
      expect(
        isCycle2dDisconnectedNormalizationTreeAllowed(
          CYCLE_2D_SUCCESSOR_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2dDisconnectedNormalizationTreeAllowed(
        [
          ...CYCLE_2D_SUCCESSOR_TREE,
          "packages/filing-fact-normalization/src/unreviewed.ts",
        ].sort(),
      ),
    ).toBe(false);

    expect(isCycle2dCommitDiffSetAllowed(CYCLE_2D_TRANSITION)).toBe(true);
    expect(CYCLE_2D_TRANSITION).toHaveLength(24);
    for (const omitted of CYCLE_2D_TRANSITION) {
      expect(
        isCycle2dCommitDiffSetAllowed(
          CYCLE_2D_TRANSITION.filter((entry) => entry !== omitted),
        ),
      ).toBe(false);
      expect(
        isCycle2aCommitDiffEntryAllowed(omitted.status, omitted.path),
      ).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("D", omitted.path)).toBe(false);
    }
    expect(
      isCycle2dCommitDiffSetAllowed([
        ...CYCLE_2D_TRANSITION,
        { path: "docs/unreviewed.md", status: "A" },
      ]),
    ).toBe(false);
    expect(
      isCycle2dCommitDiffSetAllowed(
        CYCLE_2D_TRANSITION.map((entry, index) =>
          index === 0 ? { ...entry, status: "D" } : entry,
        ),
      ),
    ).toBe(false);
  });

  it("admits only the exact atomic Cycle 2e package tree and transition", () => {
    expect(isCycle2eDisconnectedComparisonTreeAllowed([])).toBe(true);
    expect(
      isCycle2eDisconnectedComparisonTreeAllowed(CYCLE_2E_SUCCESSOR_TREE),
    ).toBe(true);
    for (const omitted of CYCLE_2E_SUCCESSOR_TREE) {
      expect(
        isCycle2eDisconnectedComparisonTreeAllowed(
          CYCLE_2E_SUCCESSOR_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2eDisconnectedComparisonTreeAllowed(
        [
          ...CYCLE_2E_SUCCESSOR_TREE,
          "packages/filing-fact-comparison/src/unreviewed.ts",
        ].sort(),
      ),
    ).toBe(false);

    expect(CYCLE_2E_TRANSITION).toHaveLength(28);
    expect(isCycle2eCommitDiffSetAllowed(CYCLE_2E_TRANSITION)).toBe(true);
    for (const omitted of CYCLE_2E_TRANSITION) {
      expect(
        isCycle2eCommitDiffSetAllowed(
          CYCLE_2E_TRANSITION.filter((entry) => entry !== omitted),
        ),
      ).toBe(false);
      expect(
        isCycle2aCommitDiffEntryAllowed(omitted.status, omitted.path),
      ).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("D", omitted.path)).toBe(false);
    }
    expect(
      isCycle2eCommitDiffSetAllowed([
        ...CYCLE_2E_TRANSITION,
        { path: "docs/unreviewed.md", status: "A" },
      ]),
    ).toBe(false);
    expect(
      isCycle2eCommitDiffSetAllowed(
        CYCLE_2E_TRANSITION.map((entry, index) =>
          index === 0 ? { ...entry, status: "D" } : entry,
        ),
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
