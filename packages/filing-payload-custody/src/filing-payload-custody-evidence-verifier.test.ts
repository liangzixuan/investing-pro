import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  decodeCycle2cGitNulList,
  isCycle2cCommitDiffEntryAllowed,
  isCycle2cCommitDiffSetAllowed,
  isCycle2cTreeAllowed,
  isCycle2dCommitDiffSetAllowed,
  isCycle2dNormalizationTreeAllowed,
  verifyFilingPayloadCustodyEvidenceOffline,
} from "./filing-payload-custody-evidence-verifier";

const temporaryDirectories: string[] = [];
const HASH = `sha256:${"a".repeat(64)}` as const;
const PACKAGE_TREE = [
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
] as const;
const FIXTURE_TREE = [
  "fixtures/synthetic/filing-payload-custody/v1/cases.json",
  "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
] as const;
const EVIDENCE_NOTE_PATH = "docs/FILING_PAYLOAD_CUSTODY_EVIDENCE.md" as const;
const DIFF_PATHS = [
  ...PACKAGE_TREE,
  ...FIXTURE_TREE,
  ".github/workflows/filing-payload-custody-acceptance.yml",
  "LICENSE_POLICY.md",
  "README.md",
  "docs/BUILD_ROADMAP.md",
  "docs/CANONICAL_MODEL.md",
  "docs/CYCLE_2C_EXIT_MATRIX.md",
  EVIDENCE_NOTE_PATH,
  "docs/THREAT_MODEL.md",
  "docs/adr/0030-bounded-synthetic-filing-payload-custody.md",
  "package.json",
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-parser/src/parser-boundary.test.ts",
  "pnpm-lock.yaml",
  "scripts/verify-boundaries.ts",
  "scripts/verify-filing-payload-custody-fixtures.ts",
] as const;
const CYCLE_2D_PACKAGE_TREE = [
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
const CYCLE_2D_CUMULATIVE_DIFF_PATHS = [
  ...new Set([
    ...DIFF_PATHS,
    ...CYCLE_2D_TRANSITION.map((entry) => entry.path),
  ]),
].sort();

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("offline filing payload custody evidence review", () => {
  it("permits only the exact A/M implementation and milestone docs allowlist", () => {
    for (const path of DIFF_PATHS) {
      expect(isCycle2cCommitDiffEntryAllowed("A", path)).toBe(true);
      expect(isCycle2cCommitDiffEntryAllowed("M", path)).toBe(true);
      expect(isCycle2cCommitDiffEntryAllowed("D", path)).toBe(false);
    }
    expect(isCycle2cCommitDiffEntryAllowed("A", "apps/api/src/index.ts")).toBe(
      false,
    );
    expect(isCycle2cCommitDiffEntryAllowed("R100", PACKAGE_TREE[0])).toBe(
      false,
    );
  });

  it("accepts only the exact historical or atomic Cycle 2d cumulative diff", () => {
    const complete = DIFF_PATHS.map((path) => ({ path, status: "A" }));
    const legacy = complete.filter(
      (entry) => entry.path !== EVIDENCE_NOTE_PATH,
    );
    const cycle2d = CYCLE_2D_CUMULATIVE_DIFF_PATHS.map((path) => ({
      path,
      status: "A",
    }));
    expect(complete).toHaveLength(33);
    expect(legacy).toHaveLength(32);
    expect(cycle2d).toHaveLength(44);
    expect(isCycle2cCommitDiffSetAllowed(complete)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(legacy)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2d)).toBe(true);
    for (const omitted of DIFF_PATHS.filter(
      (path) => path !== EVIDENCE_NOTE_PATH,
    )) {
      expect(
        isCycle2cCommitDiffSetAllowed(
          complete.filter((entry) => entry.path !== omitted),
        ),
      ).toBe(false);
    }
    for (const omitted of legacy) {
      expect(
        isCycle2cCommitDiffSetAllowed(
          legacy.filter((entry) => entry.path !== omitted.path),
        ),
      ).toBe(false);
    }
    for (const omitted of cycle2d) {
      expect(
        isCycle2cCommitDiffSetAllowed(
          cycle2d.filter((entry) => entry.path !== omitted.path),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2cCommitDiffSetAllowed(
        complete.filter(
          (entry) =>
            entry.path !== "packages/filing-parser/src/parser-boundary.test.ts",
        ),
      ),
    ).toBe(false);
    expect(
      isCycle2cCommitDiffSetAllowed([
        ...complete,
        { path: "apps/api/src/unreviewed.ts", status: "A" },
      ]),
    ).toBe(false);
    expect(
      isCycle2cCommitDiffSetAllowed([
        ...complete.slice(0, -1),
        { path: complete[0]?.path ?? "", status: "A" },
      ]),
    ).toBe(false);
    expect(
      isCycle2cCommitDiffSetAllowed(
        complete.map((entry, index) =>
          index === 0 ? { ...entry, status: "D" } : entry,
        ),
      ),
    ).toBe(false);
  });

  it("requires the exact complete regular-blob package and fixture trees", () => {
    expect(isCycle2cTreeAllowed(PACKAGE_TREE, FIXTURE_TREE)).toBe(true);
    expect(isCycle2cTreeAllowed(PACKAGE_TREE.slice(1), FIXTURE_TREE)).toBe(
      false,
    );
    expect(
      isCycle2cTreeAllowed(
        [
          ...PACKAGE_TREE,
          "packages/filing-payload-custody/src/extra.ts",
        ].sort(),
        FIXTURE_TREE,
      ),
    ).toBe(false);
    expect(isCycle2cTreeAllowed(PACKAGE_TREE, FIXTURE_TREE.slice(1))).toBe(
      false,
    );
  });

  it("requires the exact Cycle 2d package tree and 24-path transition", () => {
    expect(isCycle2dNormalizationTreeAllowed([])).toBe(true);
    expect(isCycle2dNormalizationTreeAllowed(CYCLE_2D_PACKAGE_TREE)).toBe(true);
    for (const omitted of CYCLE_2D_PACKAGE_TREE) {
      expect(
        isCycle2dNormalizationTreeAllowed(
          CYCLE_2D_PACKAGE_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2dNormalizationTreeAllowed(
        [
          ...CYCLE_2D_PACKAGE_TREE,
          "packages/filing-fact-normalization/src/unreviewed.ts",
        ].sort(),
      ),
    ).toBe(false);

    expect(CYCLE_2D_TRANSITION).toHaveLength(24);
    expect(isCycle2dCommitDiffSetAllowed(CYCLE_2D_TRANSITION)).toBe(true);
    for (const omitted of CYCLE_2D_TRANSITION) {
      expect(
        isCycle2dCommitDiffSetAllowed(
          CYCLE_2D_TRANSITION.filter((entry) => entry !== omitted),
        ),
      ).toBe(false);
      expect(
        isCycle2cCommitDiffEntryAllowed(omitted.status, omitted.path),
      ).toBe(true);
      expect(isCycle2cCommitDiffEntryAllowed("D", omitted.path)).toBe(false);
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

  it("requires exact trailing-NUL framing with no empty or BOM-prefixed fields", () => {
    expect(
      decodeCycle2cGitNulList(new TextEncoder().encode("A\0path\0M\0other\0")),
    ).toEqual(["A", "path", "M", "other"]);
    expect(decodeCycle2cGitNulList(new Uint8Array())).toEqual([]);
    for (const malformed of ["A\0path", "A\0\0path\0", "\ufeffA\0path\0"]) {
      expect(() =>
        decodeCycle2cGitNulList(new TextEncoder().encode(malformed)),
      ).toThrow("Offline filing payload custody evidence review failed.");
    }
  });

  it("fails closed before Git for malformed evidence and anchors", async () => {
    const directory = await mkdtemp(join(tmpdir(), "payload-custody-review-"));
    temporaryDirectories.push(directory);
    const evidencePath = join(directory, "evidence.json");
    await writeFile(evidencePath, "{}\n", { flag: "wx", mode: 0o600 });
    await expect(
      verifyFilingPayloadCustodyEvidenceOffline({
        evidencePath,
        expectedEvidenceSha256: HASH,
        expectedRepository: "example/research-cockpit",
        expectedRevision: "b".repeat(40),
        expectedRunAttempt: 1,
        expectedRunId: "123",
        repositoryPath: directory,
      }),
    ).rejects.toThrow("Offline filing payload custody evidence review failed.");
    await expect(
      verifyFilingPayloadCustodyEvidenceOffline({
        evidencePath: "missing",
        expectedEvidenceSha256: "sha256:bad",
        expectedRepository: "bad",
        expectedRevision: "bad",
        expectedRunAttempt: 0,
        expectedRunId: "0",
        repositoryPath: "missing",
      }),
    ).rejects.toThrow("Offline filing payload custody evidence review failed.");
    const validOptions = {
      evidencePath,
      expectedEvidenceSha256: HASH,
      expectedRepository: "example/research-cockpit",
      expectedRevision: "b".repeat(40),
      expectedRunAttempt: 1,
      expectedRunId: "123",
      repositoryPath: directory,
    };
    await expect(
      verifyFilingPayloadCustodyEvidenceOffline({
        ...validOptions,
        unexpected: true,
      } as never),
    ).rejects.toThrow("Offline filing payload custody evidence review failed.");
    const accessor = { ...validOptions } as Record<string, unknown>;
    Object.defineProperty(accessor, "evidencePath", {
      enumerable: true,
      get: () => {
        throw new Error("must not evaluate accessors");
      },
    });
    await expect(
      verifyFilingPayloadCustodyEvidenceOffline(accessor as never),
    ).rejects.toThrow("Offline filing payload custody evidence review failed.");
  });
});
