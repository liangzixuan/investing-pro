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
  isCycle2eCommitDiffSetAllowed,
  isCycle2eComparisonTreeAllowed,
  isCycle2fCommitDiffSetAllowed,
  isCycle2fQualityMeasurementTreeAllowed,
  isCycle2fTransitionRoutingRequired,
  isCycle2gCommitDiffSetAllowed,
  isCycle2gQualityPrecommitmentTreeAllowed,
  isCycle2gTransitionRoutingRequired,
  isCycle2hBaselineMergeBaseAllowed,
  isCycle2hCommitDiffSetAllowed,
  isCycle2hTransitionRoutingRequired,
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
const CYCLE_2E_PACKAGE_TREE = [
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
const CYCLE_2E_CUMULATIVE_DIFF_PATHS = [
  ...new Set([
    ...CYCLE_2D_CUMULATIVE_DIFF_PATHS,
    ...CYCLE_2E_TRANSITION.map((entry) => entry.path),
  ]),
].sort();
const CYCLE_2F_PACKAGE_TREE = [
  "packages/filing-quality-measurement/package.json",
  "packages/filing-quality-measurement/src/filing-quality-measurement-security.test.ts",
  "packages/filing-quality-measurement/src/filing-quality-measurement.test.ts",
  "packages/filing-quality-measurement/src/filing-quality-measurement.ts",
  "packages/filing-quality-measurement/src/index.ts",
  "packages/filing-quality-measurement/src/test-filing-quality-measurement-builder.ts",
  "packages/filing-quality-measurement/tsconfig.json",
].sort();
const CYCLE_2F_TRANSITION = [
  { path: "LICENSE_POLICY.md", status: "M" },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2B_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2C_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2D_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2E_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2F_EXIT_MATRIX.md", status: "A" },
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
    status: "M",
  },
  {
    path: "docs/adr/0033-bounded-synthetic-declared-reference-quality-measurement.md",
    status: "A",
  },
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
  { path: "packages/filing-quality-measurement/package.json", status: "A" },
  {
    path: "packages/filing-quality-measurement/src/filing-quality-measurement-security.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-quality-measurement/src/filing-quality-measurement.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-quality-measurement/src/filing-quality-measurement.ts",
    status: "A",
  },
  { path: "packages/filing-quality-measurement/src/index.ts", status: "A" },
  {
    path: "packages/filing-quality-measurement/src/test-filing-quality-measurement-builder.ts",
    status: "A",
  },
  { path: "packages/filing-quality-measurement/tsconfig.json", status: "A" },
  { path: "pnpm-lock.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
] as const;
const CYCLE_2F_CUMULATIVE_DIFF_PATHS = [
  ...new Set([
    ...CYCLE_2E_CUMULATIVE_DIFF_PATHS,
    ...CYCLE_2F_TRANSITION.map((entry) => entry.path),
  ]),
].sort();
const CYCLE_2G_PACKAGE_TREE = [
  "packages/filing-quality-precommitment/package.json",
  "packages/filing-quality-precommitment/src/filing-quality-precommitment-security.test.ts",
  "packages/filing-quality-precommitment/src/filing-quality-precommitment.test.ts",
  "packages/filing-quality-precommitment/src/filing-quality-precommitment.ts",
  "packages/filing-quality-precommitment/src/index.ts",
  "packages/filing-quality-precommitment/src/test-filing-quality-precommitment-builder.ts",
  "packages/filing-quality-precommitment/tsconfig.json",
].sort();
const CYCLE_2G_TRANSITION = [
  { path: "LICENSE_POLICY.md", status: "M" },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2B_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2C_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2D_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2E_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2F_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2G_EXIT_MATRIX.md", status: "A" },
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
    status: "M",
  },
  {
    path: "docs/adr/0033-bounded-synthetic-declared-reference-quality-measurement.md",
    status: "M",
  },
  {
    path: "docs/adr/0034-bounded-synthetic-declared-reference-precommitment.md",
    status: "A",
  },
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
  {
    path: "packages/filing-quality-measurement/src/filing-quality-measurement-security.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-quality-measurement/src/filing-quality-measurement.ts",
    status: "M",
  },
  { path: "packages/filing-quality-precommitment/package.json", status: "A" },
  {
    path: "packages/filing-quality-precommitment/src/filing-quality-precommitment-security.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-quality-precommitment/src/filing-quality-precommitment.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-quality-precommitment/src/filing-quality-precommitment.ts",
    status: "A",
  },
  { path: "packages/filing-quality-precommitment/src/index.ts", status: "A" },
  {
    path: "packages/filing-quality-precommitment/src/test-filing-quality-precommitment-builder.ts",
    status: "A",
  },
  { path: "packages/filing-quality-precommitment/tsconfig.json", status: "A" },
  { path: "pnpm-lock.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
] as const;
const CYCLE_2G_CUMULATIVE_DIFF_PATHS = [
  ...new Set([
    ...CYCLE_2F_CUMULATIVE_DIFF_PATHS,
    ...CYCLE_2G_TRANSITION.map((entry) => entry.path),
  ]),
].sort();
const CYCLE_2H_BASELINE_REVISION =
  "14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98" as const;
const CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH =
  "packages/db/tests/postgres-acceptance-evidence-review.test.ts" as const;
const CYCLE_2H_TRANSITION = [
  { path: "LICENSE_POLICY.md", status: "M" },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2A_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2B_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2C_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2D_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2E_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2F_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2G_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2H_EXIT_MATRIX.md", status: "A" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0028-bounded-synthetic-filing-parser-isolation.md",
    status: "M",
  },
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
    status: "M",
  },
  {
    path: "docs/adr/0033-bounded-synthetic-declared-reference-quality-measurement.md",
    status: "M",
  },
  {
    path: "docs/adr/0034-bounded-synthetic-declared-reference-precommitment.md",
    status: "M",
  },
  {
    path: "docs/adr/0035-cross-boundary-intrinsic-byte-snapshot-hardening.md",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
    status: "M",
  },
  {
    path: "packages/filing-fact-comparison/src/filing-fact-comparison-security.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-fact-comparison/src/filing-fact-comparison.ts",
    status: "M",
  },
  {
    path: "packages/filing-fact-normalization/src/filing-fact-normalization-security.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-fact-normalization/src/filing-fact-normalization.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser/src/corpus-admission-security.test.ts",
    status: "M",
  },
  { path: "packages/filing-parser/src/corpus-admission.ts", status: "M" },
  {
    path: "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    status: "M",
  },
  { path: "packages/filing-parser/src/parser-boundary.ts", status: "M" },
  { path: "packages/filing-parser/src/parser-security.test.ts", status: "M" },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/payload-custody-security.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/payload-custody.ts",
    status: "M",
  },
  {
    path: "packages/filing-quality-measurement/src/filing-quality-measurement-security.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-quality-measurement/src/filing-quality-measurement.ts",
    status: "M",
  },
  {
    path: "packages/filing-quality-precommitment/src/filing-quality-precommitment-security.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-quality-precommitment/src/filing-quality-precommitment.ts",
    status: "M",
  },
] as const;
const CYCLE_2H_BASELINE_CUMULATIVE_DIFF_PATHS = [
  ...new Set([
    ...CYCLE_2G_CUMULATIVE_DIFF_PATHS,
    CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH,
  ]),
].sort();
const CYCLE_2H_CUMULATIVE_DIFF_PATHS = [
  ...new Set([
    ...CYCLE_2H_BASELINE_CUMULATIVE_DIFF_PATHS,
    ...CYCLE_2H_TRANSITION.map((entry) => entry.path),
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

  it("accepts only exact historical or atomic successor cumulative diffs", () => {
    const complete = DIFF_PATHS.map((path) => ({ path, status: "A" }));
    const legacy = complete.filter(
      (entry) => entry.path !== EVIDENCE_NOTE_PATH,
    );
    const cycle2d = CYCLE_2D_CUMULATIVE_DIFF_PATHS.map((path) => ({
      path,
      status: "A",
    }));
    const cycle2e = CYCLE_2E_CUMULATIVE_DIFF_PATHS.map((path) => ({
      path,
      status: "A",
    }));
    const cycle2f = CYCLE_2F_CUMULATIVE_DIFF_PATHS.map((path) => ({
      path,
      status: "A",
    }));
    const cycle2g = CYCLE_2G_CUMULATIVE_DIFF_PATHS.map((path) => ({
      path,
      status: "A",
    }));
    const cycle2hBaseline = CYCLE_2H_BASELINE_CUMULATIVE_DIFF_PATHS.map(
      (path) => ({
        path,
        status: path === CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH ? "M" : "A",
      }),
    );
    const cycle2h = CYCLE_2H_CUMULATIVE_DIFF_PATHS.map((path) => ({
      path,
      status: path === CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH ? "M" : "A",
    }));
    expect(complete).toHaveLength(33);
    expect(legacy).toHaveLength(32);
    expect(cycle2d).toHaveLength(44);
    expect(cycle2e).toHaveLength(55);
    expect(cycle2f).toHaveLength(64);
    expect(cycle2g).toHaveLength(73);
    expect(cycle2hBaseline).toHaveLength(74);
    expect(cycle2h).toHaveLength(82);
    expect(isCycle2cCommitDiffSetAllowed(complete)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(legacy)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2d)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2e)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2f)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2g)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2hBaseline)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2h)).toBe(true);
    expect(
      isCycle2cCommitDiffSetAllowed(
        cycle2hBaseline.map((entry) =>
          entry.path === CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH
            ? { ...entry, status: "A" }
            : entry,
        ),
      ),
    ).toBe(false);
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
    for (const omitted of cycle2e) {
      expect(
        isCycle2cCommitDiffSetAllowed(
          cycle2e.filter((entry) => entry.path !== omitted.path),
        ),
      ).toBe(false);
    }
    for (const omitted of cycle2f) {
      expect(
        isCycle2cCommitDiffSetAllowed(
          cycle2f.filter((entry) => entry.path !== omitted.path),
        ),
      ).toBe(false);
    }
    for (const omitted of cycle2g) {
      expect(
        isCycle2cCommitDiffSetAllowed(
          cycle2g.filter((entry) => entry.path !== omitted.path),
        ),
      ).toBe(false);
    }
    for (const omitted of cycle2hBaseline.filter(
      (entry) => entry.path !== CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH,
    )) {
      expect(
        isCycle2cCommitDiffSetAllowed(
          cycle2hBaseline.filter((entry) => entry.path !== omitted.path),
        ),
      ).toBe(false);
    }
    for (const omitted of cycle2h) {
      expect(
        isCycle2cCommitDiffSetAllowed(
          cycle2h.filter((entry) => entry.path !== omitted.path),
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

  it("requires the exact Cycle 2e package tree and 28-path transition", () => {
    expect(isCycle2eComparisonTreeAllowed([])).toBe(true);
    expect(isCycle2eComparisonTreeAllowed(CYCLE_2E_PACKAGE_TREE)).toBe(true);
    for (const omitted of CYCLE_2E_PACKAGE_TREE) {
      expect(
        isCycle2eComparisonTreeAllowed(
          CYCLE_2E_PACKAGE_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2eComparisonTreeAllowed(
        [
          ...CYCLE_2E_PACKAGE_TREE,
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
        isCycle2cCommitDiffEntryAllowed(omitted.status, omitted.path),
      ).toBe(true);
      expect(isCycle2cCommitDiffEntryAllowed("D", omitted.path)).toBe(false);
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

  it("requires the exact Cycle 2f package tree and 28-path transition", () => {
    expect(isCycle2fQualityMeasurementTreeAllowed([])).toBe(true);
    expect(isCycle2fQualityMeasurementTreeAllowed(CYCLE_2F_PACKAGE_TREE)).toBe(
      true,
    );
    for (const omitted of CYCLE_2F_PACKAGE_TREE) {
      expect(
        isCycle2fQualityMeasurementTreeAllowed(
          CYCLE_2F_PACKAGE_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2fQualityMeasurementTreeAllowed(
        [
          ...CYCLE_2F_PACKAGE_TREE,
          "packages/filing-quality-measurement/src/unreviewed.ts",
        ].sort(),
      ),
    ).toBe(false);

    expect(CYCLE_2F_TRANSITION).toHaveLength(28);
    expect(isCycle2fCommitDiffSetAllowed(CYCLE_2F_TRANSITION)).toBe(true);
    for (const omitted of CYCLE_2F_TRANSITION) {
      expect(
        isCycle2fCommitDiffSetAllowed(
          CYCLE_2F_TRANSITION.filter((entry) => entry !== omitted),
        ),
      ).toBe(false);
      expect(
        isCycle2cCommitDiffEntryAllowed(omitted.status, omitted.path),
      ).toBe(true);
      expect(isCycle2cCommitDiffEntryAllowed("D", omitted.path)).toBe(false);
    }
    expect(
      isCycle2fCommitDiffSetAllowed([
        ...CYCLE_2F_TRANSITION,
        { path: "docs/unreviewed.md", status: "A" },
      ]),
    ).toBe(false);
    expect(
      isCycle2fCommitDiffSetAllowed(
        CYCLE_2F_TRANSITION.map((entry, index) =>
          index === 0 ? { ...entry, status: "D" } : entry,
        ),
      ),
    ).toBe(false);
  });

  it("routes a 19-modification marker-free Cycle 2f overlap to exact Cycle 2f enforcement", () => {
    const overlapOnlyPartial = CYCLE_2F_TRANSITION.filter(
      (entry) => entry.status === "M",
    );
    const cycle2eCumulative = CYCLE_2E_CUMULATIVE_DIFF_PATHS.map((path) => ({
      path,
      status: "A",
    }));
    expect(overlapOnlyPartial).toHaveLength(19);
    expect(
      CYCLE_2F_TRANSITION.filter((entry) => entry.status === "A"),
    ).toHaveLength(9);
    expect(isCycle2cCommitDiffSetAllowed(cycle2eCumulative)).toBe(true);
    expect(
      isCycle2fTransitionRoutingRequired(
        overlapOnlyPartial.map((entry) => entry.path),
        [],
        cycle2eCumulative,
      ),
    ).toBe(true);
    expect(isCycle2fCommitDiffSetAllowed(overlapOnlyPartial)).toBe(false);
    expect(isCycle2fTransitionRoutingRequired([], [], cycle2eCumulative)).toBe(
      false,
    );
    expect(
      isCycle2fTransitionRoutingRequired(undefined, [], cycle2eCumulative),
    ).toBe(false);
  });

  it("requires the exact Cycle 2g package tree and 32-path transition", () => {
    expect(isCycle2gQualityPrecommitmentTreeAllowed([])).toBe(true);
    expect(
      isCycle2gQualityPrecommitmentTreeAllowed(CYCLE_2G_PACKAGE_TREE),
    ).toBe(true);
    for (const omitted of CYCLE_2G_PACKAGE_TREE) {
      expect(
        isCycle2gQualityPrecommitmentTreeAllowed(
          CYCLE_2G_PACKAGE_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2gQualityPrecommitmentTreeAllowed(
        [
          ...CYCLE_2G_PACKAGE_TREE,
          "packages/filing-quality-precommitment/src/unreviewed.ts",
        ].sort(),
      ),
    ).toBe(false);

    expect(CYCLE_2G_TRANSITION).toHaveLength(32);
    expect(isCycle2gCommitDiffSetAllowed(CYCLE_2G_TRANSITION)).toBe(true);
    for (const omitted of CYCLE_2G_TRANSITION) {
      expect(
        isCycle2gCommitDiffSetAllowed(
          CYCLE_2G_TRANSITION.filter((entry) => entry !== omitted),
        ),
      ).toBe(false);
      expect(
        isCycle2cCommitDiffEntryAllowed(omitted.status, omitted.path),
      ).toBe(true);
      expect(isCycle2cCommitDiffEntryAllowed("D", omitted.path)).toBe(false);
    }
    expect(
      isCycle2gCommitDiffSetAllowed([
        ...CYCLE_2G_TRANSITION,
        { path: "docs/unreviewed.md", status: "A" },
      ]),
    ).toBe(false);
    expect(
      isCycle2gCommitDiffSetAllowed(
        CYCLE_2G_TRANSITION.map((entry, index) =>
          index === 0 ? { ...entry, status: "D" } : entry,
        ),
      ),
    ).toBe(false);
  });

  it("routes a 23-modification marker-free Cycle 2g overlap before Cycle 2f", () => {
    const overlapOnlyPartial = CYCLE_2G_TRANSITION.filter(
      (entry) => entry.status === "M",
    );
    const cycle2fCumulative = CYCLE_2F_CUMULATIVE_DIFF_PATHS.map((path) => ({
      path,
      status: "A",
    }));
    expect(overlapOnlyPartial).toHaveLength(23);
    expect(
      CYCLE_2G_TRANSITION.filter((entry) => entry.status === "A"),
    ).toHaveLength(9);
    expect(isCycle2cCommitDiffSetAllowed(cycle2fCumulative)).toBe(true);
    expect(
      isCycle2gTransitionRoutingRequired(
        overlapOnlyPartial.map((entry) => entry.path),
        [],
        cycle2fCumulative,
      ),
    ).toBe(true);
    expect(isCycle2gCommitDiffSetAllowed(overlapOnlyPartial)).toBe(false);
    expect(isCycle2gTransitionRoutingRequired([], [], cycle2fCumulative)).toBe(
      false,
    );
    expect(
      isCycle2gTransitionRoutingRequired(undefined, [], cycle2fCumulative),
    ).toBe(false);
  });

  it("requires the exact 38-modification and two-addition Cycle 2h transition", () => {
    expect(CYCLE_2H_TRANSITION).toHaveLength(40);
    expect(
      CYCLE_2H_TRANSITION.filter((entry) => entry.status === "M"),
    ).toHaveLength(38);
    expect(
      CYCLE_2H_TRANSITION.filter((entry) => entry.status === "A"),
    ).toHaveLength(2);
    expect(isCycle2hCommitDiffSetAllowed(CYCLE_2H_TRANSITION)).toBe(true);
    expect(isCycle2gCommitDiffSetAllowed(CYCLE_2G_TRANSITION)).toBe(true);

    for (const omitted of CYCLE_2H_TRANSITION) {
      expect(
        isCycle2hCommitDiffSetAllowed(
          CYCLE_2H_TRANSITION.filter((entry) => entry !== omitted),
        ),
      ).toBe(false);
      expect(
        isCycle2cCommitDiffEntryAllowed(omitted.status, omitted.path),
      ).toBe(true);
    }
    expect(
      isCycle2hCommitDiffSetAllowed([
        ...CYCLE_2H_TRANSITION,
        { path: "docs/unreviewed.md", status: "A" },
      ]),
    ).toBe(false);
    expect(
      isCycle2hCommitDiffSetAllowed(
        CYCLE_2H_TRANSITION.map((entry, index) =>
          index === 0 ? { ...entry, status: "D" } : entry,
        ),
      ),
    ).toBe(false);
    expect(
      isCycle2hCommitDiffSetAllowed(
        CYCLE_2H_TRANSITION.map((entry) =>
          entry.path ===
          "fixtures/synthetic/filing-payload-custody/v1/manifest.json"
            ? { ...entry, status: "A" }
            : entry,
        ),
      ),
    ).toBe(false);
    expect(
      isCycle2hCommitDiffSetAllowed(
        CYCLE_2H_TRANSITION.map((entry, index) =>
          index === 0 ? { ...entry, status: "R100" } : entry,
        ),
      ),
    ).toBe(false);
  });

  it("routes Cycle 2h first, pins its merge base, and confines DB maintenance to history", () => {
    const markerFreeModifications = CYCLE_2H_TRANSITION.filter(
      (entry) => entry.status === "M",
    );
    const cycle2gCumulative = CYCLE_2G_CUMULATIVE_DIFF_PATHS.map((path) => ({
      path,
      status: "A",
    }));
    const baselineWithMaintenance = [
      ...CYCLE_2G_TRANSITION,
      { path: CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH, status: "M" },
    ];

    expect(isCycle2hBaselineMergeBaseAllowed(CYCLE_2H_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2hBaselineMergeBaseAllowed("0".repeat(40))).toBe(false);
    expect(isCycle2hBaselineMergeBaseAllowed(undefined)).toBe(false);
    expect(markerFreeModifications).toHaveLength(38);
    expect(
      isCycle2hTransitionRoutingRequired(
        markerFreeModifications.map((entry) => entry.path),
        cycle2gCumulative,
      ),
    ).toBe(true);
    expect(
      isCycle2hTransitionRoutingRequired(undefined, CYCLE_2H_TRANSITION),
    ).toBe(true);
    expect(isCycle2hTransitionRoutingRequired([], cycle2gCumulative)).toBe(
      false,
    );
    expect(
      isCycle2hTransitionRoutingRequired(undefined, [
        { path: CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH },
      ]),
    ).toBe(true);

    expect(isCycle2gCommitDiffSetAllowed(baselineWithMaintenance)).toBe(false);
    expect(isCycle2hCommitDiffSetAllowed(CYCLE_2H_TRANSITION)).toBe(true);
    expect(
      isCycle2hCommitDiffSetAllowed([
        ...CYCLE_2H_TRANSITION,
        { path: CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH, status: "M" },
      ]),
    ).toBe(false);
    for (const status of ["A", "M", "R100"]) {
      expect(
        isCycle2cCommitDiffEntryAllowed(
          status,
          CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH,
        ),
      ).toBe(false);
    }
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
