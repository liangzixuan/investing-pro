import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  filingParserEvidenceReviewOptionsFromArguments,
  filingParserEvidenceReviewStdout,
} from "./filing-parser-evidence-review";
import {
  decodeFilingParserAbsoluteGitPath,
  filingParserGitArgumentsWithoutReplacementObjects,
  filingParserGitEnvironmentWithoutGrafts,
  isAdmissionValidityBridgeBaselineMergeBaseAllowed,
  isAdmissionValidityBridgeCommitDiffSetAllowed,
  isAdmissionValidityBridgeCorrectiveChainAllowed,
  isAdmissionValidityBridgeCorrectiveCommitDiffSetAllowed,
  isAdmissionValidityBridgeSourceCommitDiffSetAllowed,
  isAdmissionValidityBridgeTransitionRoutingRequired,
  isAuthenticatedReplayMaintenanceBaselineMergeBaseAllowed,
  isAuthenticatedReplayMaintenanceCommitDiffSetAllowed,
  isAuthenticatedReplayMaintenanceSurfaceRoutingRequired,
  isCiTestSerializationBaselineMergeBaseAllowed,
  isCiTestSerializationCommitDiffSetAllowed,
  isCiTestSerializationSurfaceRoutingRequired,
  isCycle2aDisconnectedCustodyTreeAllowed,
  isCycle2aCommitDiffEntryAllowed,
  isCycle2aEvidenceNoteTreeAllowed,
  isCycle2aParserDomainTreeAllowed,
  isCycle2dCommitDiffSetAllowed,
  isCycle2dDisconnectedNormalizationTreeAllowed,
  isCycle2eCommitDiffSetAllowed,
  isCycle2eDisconnectedComparisonTreeAllowed,
  isCycle2fCommitDiffSetAllowed,
  isCycle2fDisconnectedQualityMeasurementTreeAllowed,
  isCycle2fTransitionRoutingRequired,
  isCycle2gCommitDiffSetAllowed,
  isCycle2gDisconnectedQualityPrecommitmentTreeAllowed,
  isCycle2gTransitionRoutingRequired,
  isCycle2hBaselineMergeBaseAllowed,
  isCycle2hCommitDiffSetAllowed,
  isCycle2hTransitionRoutingRequired,
  isCycle2iBaselineMergeBaseAllowed,
  isCycle2iCommitDiffSetAllowed,
  isCycle2iHandoffTreeAllowed,
  isCycle2iTransitionRoutingRequired,
  isCycle2jAcceptanceTreeAllowed,
  isCycle2jBaselineMergeBaseAllowed,
  isCycle2jCommitDiffSetAllowed,
  isCycle2jExecutionTreeAllowed,
  isCycle2jTransitionRoutingRequired,
  isCycle2kAcceptanceTreeAllowed,
  isCycle2kBaselineMergeBaseAllowed,
  isCycle2kCommitDiffSetAllowed,
  isCycle2kCoreTreeAllowed,
  isCycle2kTransitionRoutingRequired,
  isCycle2mAcceptanceTreeAllowed,
  isCycle2mBaselineMergeBaseAllowed,
  isCycle2mCommitDiffSetAllowed,
  isCycle2mCoreTreeAllowed,
  isCycle2mCorrectiveChainAllowed,
  isCycle2mCorrectiveCommitDiffSetAllowed,
  isCycle2mPreBaselineCumulativeDiffEntryAllowed,
  isCycle2mTransitionRoutingRequired,
  isCycle2nBaselineMergeBaseAllowed,
  isCycle2nCommitDiffSetAllowed,
  isCycle2nCompositionTreeAllowed,
  isCycle2nDirectChildAllowed,
  isCycle2nTransitionRoutingRequired,
  isCycle2oAcceptanceTreeAllowed,
  isCycle2oBaselineMergeBaseAllowed,
  isCycle2oCommitDiffSetAllowed,
  isCycle2oCompositionTreeAllowed,
  isCycle2oCorrectiveCommitDiffSetAllowed,
  isCycle2oCorrectiveTopologyAllowed,
  isCycle2oCustodyTreeAllowed,
  isCycle2oDirectChildAllowed,
  isCycle2oTransitionRoutingRequired,
  isCycle2pBaselineMergeBaseAllowed,
  isCycle2pCommitDiffSetAllowed,
  isCycle2pCorpusAdmissionBlobAllowed,
  isCycle2pDirectChildAllowed,
  isCycle2pTransitionRoutingRequired,
  isFastify5121MaintenanceBaselineMergeBaseAllowed,
  isFastify5121MaintenanceCommitDiffSetAllowed,
  isFastify5121MaintenanceTransitionRoutingRequired,
  isFilingParserEvidenceFileReadSnapshotAllowed,
  isFilingParserEmptyGitGraftsSnapshotAllowed,
  isFilingParserGitProcessResultAllowed,
  isOfflineEvidenceInputCustodyBaselineMergeBaseAllowed,
  isOfflineEvidenceInputCustodyCommitDiffSetAllowed,
  isOfflineEvidenceInputCustodySurfaceRoutingRequired,
  isPnpmDependencyPolicyMaintenanceBaselineMergeBaseAllowed,
  isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed,
  isPnpmDependencyPolicyMaintenanceNpmrcDeletionDiffEntryAllowed,
  isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired,
  isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired,
  normalizeFilingParserEvidenceReviewOptions,
  verifyNoEffectiveFilingParserGitGrafts,
  verifyFilingParserEvidenceOffline,
} from "./filing-parser-evidence-verifier";

const temporaryDirectories: string[] = [];
const HASH = `sha256:${"a".repeat(64)}` as const;
const ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION =
  "7243f16df0c4bd8691ff11fa037085e3beb3447e" as const;
const ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION =
  "96b042669edc6cb4a876bb0c061fa5e18732c1ca" as const;
const ADMISSION_VALIDITY_BRIDGE_SOURCE_TRANSITION = [
  {
    path: "packages/filing-parser/src/corpus-admission-security.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser/src/corpus-admission.ts",
    status: "M",
  },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const ADMISSION_VALIDITY_BRIDGE_CORRECTIVE_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  {
    path: "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    status: "M",
  },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const ADMISSION_VALIDITY_BRIDGE_TRANSITION = [
  ...ADMISSION_VALIDITY_BRIDGE_SOURCE_TRANSITION,
  ...ADMISSION_VALIDITY_BRIDGE_CORRECTIVE_TRANSITION,
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const ADMISSION_VALIDITY_BRIDGE_TRANSITION_PATHS =
  ADMISSION_VALIDITY_BRIDGE_TRANSITION.map(({ path }) => path);
const CYCLE_2P_BASELINE_REVISION =
  "e21408acf70a28909136cc3eb0c10bbbd48b8266" as const;
const CYCLE_2P_CORPUS_ADMISSION_BLOB =
  "e456cae97cf9eb377e3b3e8aabc156fdb377e2c7" as const;
const CYCLE_2P_CORPUS_ADMISSION_PATH =
  "packages/filing-parser/src/corpus-admission.ts" as const;
const CYCLE_2P_TRANSITION = [
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  "packages/filing-parser/src/corpus-admission-security.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
]
  .sort()
  .map((path) => ({ path, status: "M" }));
const CYCLE_2P_TRANSITION_PATHS = CYCLE_2P_TRANSITION.map(({ path }) => path);
const CYCLE_2P_PROTECTED_SURFACE_PATHS = [
  ...CYCLE_2P_TRANSITION_PATHS,
  CYCLE_2P_CORPUS_ADMISSION_PATH,
];
const CYCLE_2N_BASELINE_REVISION =
  "09e76235b5683427f2dd3201aefa740bb5adb16e" as const;
const CYCLE_2O_BASELINE_REVISION =
  "711fe866594d5e20a657a24c0a0c72fd78ab90be" as const;
const CYCLE_2O_SOURCE_REVISION =
  "46408ec875755ef531c124846143e9b619c1961f" as const;
const CYCLE_2N_COMPOSITION_TREE = [
  "packages/filing-parser-quality-composition/package.json",
  "packages/filing-parser-quality-composition/src/filing-parser-quality-composition-security.test.ts",
  "packages/filing-parser-quality-composition/src/filing-parser-quality-composition.test.ts",
  "packages/filing-parser-quality-composition/src/filing-parser-quality-composition.ts",
  "packages/filing-parser-quality-composition/src/index.ts",
  "packages/filing-parser-quality-composition/src/test-filing-parser-quality-composition-builder.ts",
  "packages/filing-parser-quality-composition/tsconfig.json",
].sort();
const CYCLE_2N_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2N_EXIT_MATRIX.md", status: "A" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0041-bounded-synthetic-source-owned-quality-composition.md",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-parser-cross-engine-execution/v4/cases.json",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-parser-cross-engine-execution/v4/manifest.json",
    status: "A",
  },
  {
    path: "packages/filing-parser-cross-engine-execution-acceptance/package.json",
    status: "M",
  },
  ...[
    "filing-parser-cross-engine-execution-evidence-review.test.ts",
    "filing-parser-cross-engine-execution-evidence-review.ts",
    "filing-parser-cross-engine-execution-evidence-verifier.test.ts",
    "filing-parser-cross-engine-execution-evidence-verifier.ts",
    "filing-parser-cross-engine-execution-evidence.test.ts",
    "filing-parser-cross-engine-execution-evidence.ts",
    "index.ts",
    "run-filing-parser-cross-engine-execution-acceptance.test.ts",
    "run-filing-parser-cross-engine-execution-acceptance.ts",
    "test-filing-parser-cross-engine-execution-evidence-builder.ts",
  ].map((name) => ({
    path: `packages/filing-parser-cross-engine-execution-acceptance/src/${name}`,
    status: "M",
  })),
  ...CYCLE_2N_COMPOSITION_TREE.map((path) => ({ path, status: "A" })),
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
  {
    path: "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
    status: "M",
  },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
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
const CYCLE_2F_SUCCESSOR_TREE = [
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
const CYCLE_2G_SUCCESSOR_TREE = [
  "packages/filing-quality-precommitment/package.json",
  "packages/filing-quality-precommitment/src/filing-quality-precommitment-security.test.ts",
  "packages/filing-quality-precommitment/src/filing-quality-precommitment.test.ts",
  "packages/filing-quality-precommitment/src/filing-quality-precommitment.ts",
  "packages/filing-quality-precommitment/src/index.ts",
  "packages/filing-quality-precommitment/src/test-filing-quality-precommitment-builder.ts",
  "packages/filing-quality-precommitment/tsconfig.json",
].sort();
const CYCLE_2I_HANDOFF_TREE = [
  "packages/filing-parser-normalization-handoff/package.json",
  "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff-security.test.ts",
  "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff.test.ts",
  "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff.ts",
  "packages/filing-parser-normalization-handoff/src/index.ts",
  "packages/filing-parser-normalization-handoff/src/test-filing-parser-normalization-handoff-builder.ts",
  "packages/filing-parser-normalization-handoff/tsconfig.json",
].sort();
const CYCLE_2J_EXECUTION_TREE = [
  "packages/filing-parser-normalization-execution/acceptance/python-image.json",
  "packages/filing-parser-normalization-execution/package.json",
  "packages/filing-parser-normalization-execution/src/filing-parser-normalization-execution-security.test.ts",
  "packages/filing-parser-normalization-execution/src/filing-parser-normalization-execution.test.ts",
  "packages/filing-parser-normalization-execution/src/filing-parser-normalization-execution.ts",
  "packages/filing-parser-normalization-execution/src/index.ts",
  "packages/filing-parser-normalization-execution/src/test-filing-parser-normalization-execution-builder.ts",
  "packages/filing-parser-normalization-execution/tsconfig.json",
  "packages/filing-parser-normalization-execution/worker/Dockerfile",
  "packages/filing-parser-normalization-execution/worker/parser.py",
  "packages/filing-parser-normalization-execution/worker/parser_test.py",
  "packages/filing-parser-normalization-execution/worker/taxonomy-v1.json",
].sort();
const CYCLE_2J_ACCEPTANCE_TREE = [
  "packages/filing-parser-normalization-execution-acceptance/package.json",
  "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence-review.test.ts",
  "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence-review.ts",
  "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence-verifier.test.ts",
  "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence-verifier.ts",
  "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence.test.ts",
  "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence.ts",
  "packages/filing-parser-normalization-execution-acceptance/src/index.ts",
  "packages/filing-parser-normalization-execution-acceptance/src/run-filing-parser-normalization-execution-acceptance.test.ts",
  "packages/filing-parser-normalization-execution-acceptance/src/run-filing-parser-normalization-execution-acceptance.ts",
  "packages/filing-parser-normalization-execution-acceptance/src/run-filing-parser-normalization-execution-evidence-review.ts",
  "packages/filing-parser-normalization-execution-acceptance/src/test-filing-parser-normalization-execution-evidence-builder.ts",
  "packages/filing-parser-normalization-execution-acceptance/tsconfig.json",
].sort();
const CYCLE_2K_CORE_TREE = [
  "packages/filing-parser-cross-engine-execution/acceptance/node-image.json",
  "packages/filing-parser-cross-engine-execution/package.json",
  "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution-security.test.ts",
  "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution.test.ts",
  "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution.ts",
  "packages/filing-parser-cross-engine-execution/src/index.ts",
  "packages/filing-parser-cross-engine-execution/src/test-cross-engine-execution-builder.ts",
  "packages/filing-parser-cross-engine-execution/tsconfig.json",
  "packages/filing-parser-cross-engine-execution/worker/Dockerfile",
  "packages/filing-parser-cross-engine-execution/worker/parser.mjs",
  "packages/filing-parser-cross-engine-execution/worker/parser.test.mjs",
  "packages/filing-parser-cross-engine-execution/worker/taxonomy-v1.json",
].sort();
const CYCLE_2K_ACCEPTANCE_TREE = [
  "packages/filing-parser-cross-engine-execution-acceptance/package.json",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-review.test.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-review.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.test.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence.test.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/index.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.test.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-evidence-review.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/test-filing-parser-cross-engine-execution-evidence-builder.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/tsconfig.json",
].sort();
const CYCLE_2M_CORE_TREE = [
  "packages/filing-parser-cross-engine-execution/acceptance/node-image.json",
  "packages/filing-parser-cross-engine-execution/package.json",
  "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-direct-execution-security.test.ts",
  "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-direct-execution.test.ts",
  "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-direct-execution.ts",
  "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution-security.test.ts",
  "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution.test.ts",
  "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution.ts",
  "packages/filing-parser-cross-engine-execution/src/index.ts",
  "packages/filing-parser-cross-engine-execution/src/test-cross-engine-execution-builder.ts",
  "packages/filing-parser-cross-engine-execution/tsconfig.json",
  "packages/filing-parser-cross-engine-execution/worker/Dockerfile",
  "packages/filing-parser-cross-engine-execution/worker/parser.mjs",
  "packages/filing-parser-cross-engine-execution/worker/parser.test.mjs",
  "packages/filing-parser-cross-engine-execution/worker/taxonomy-v1.json",
].sort();
const CYCLE_2M_ACCEPTANCE_TREE = [...CYCLE_2K_ACCEPTANCE_TREE];
const CYCLE_2O_COMPOSITION_TREE = [
  "packages/filing-parser-custody-quality-composition/package.json",
  "packages/filing-parser-custody-quality-composition/src/filing-parser-custody-quality-composition-security.test.ts",
  "packages/filing-parser-custody-quality-composition/src/filing-parser-custody-quality-composition.test.ts",
  "packages/filing-parser-custody-quality-composition/src/filing-parser-custody-quality-composition.ts",
  "packages/filing-parser-custody-quality-composition/src/index.ts",
  "packages/filing-parser-custody-quality-composition/src/test-filing-parser-custody-quality-composition-builder.ts",
  "packages/filing-parser-custody-quality-composition/tsconfig.json",
].sort();
const CYCLE_2O_CUSTODY_TREE = [
  ...CYCLE_2C_SUCCESSOR_TREE.filter((path) =>
    path.startsWith("packages/filing-payload-custody/"),
  ),
  "packages/filing-payload-custody/src/parser-archive-pair-custody.test.ts",
  "packages/filing-payload-custody/src/parser-archive-pair-custody.ts",
  "packages/filing-payload-custody/src/parser-archive-pair-fixture.ts",
].sort();
const CYCLE_2O_ACCEPTANCE_TREE = [
  ...CYCLE_2K_ACCEPTANCE_TREE,
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-v5.test.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-v5.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier-v5.test.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier-v5.ts",
].sort();
const CYCLE_2O_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2O_EXIT_MATRIX.md", status: "A" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0042-bounded-synthetic-parser-archive-custody-quality-composition.md",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-parser-cross-engine-execution/v5/cases.json",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-parser-cross-engine-execution/v5/manifest.json",
    status: "A",
  },
  {
    path: "packages/filing-parser-cross-engine-execution-acceptance/package.json",
    status: "M",
  },
  ...[
    "filing-parser-cross-engine-execution-evidence-review.ts",
    "filing-parser-cross-engine-execution-evidence-verifier.ts",
    "filing-parser-cross-engine-execution-evidence.ts",
    "index.ts",
    "run-filing-parser-cross-engine-execution-acceptance.test.ts",
    "run-filing-parser-cross-engine-execution-acceptance.ts",
    "test-filing-parser-cross-engine-execution-evidence-builder.ts",
  ].map((name) => ({
    path: `packages/filing-parser-cross-engine-execution-acceptance/src/${name}`,
    status: "M",
  })),
  ...[
    "filing-parser-cross-engine-execution-evidence-v5.test.ts",
    "filing-parser-cross-engine-execution-evidence-v5.ts",
    "filing-parser-cross-engine-execution-evidence-verifier-v5.test.ts",
    "filing-parser-cross-engine-execution-evidence-verifier-v5.ts",
  ].map((name) => ({
    path: `packages/filing-parser-cross-engine-execution-acceptance/src/${name}`,
    status: "A",
  })),
  ...CYCLE_2O_COMPOSITION_TREE.map((path) => ({ path, status: "A" })),
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
  { path: "packages/filing-payload-custody/src/index.ts", status: "M" },
  {
    path: "packages/filing-payload-custody/src/parser-archive-pair-custody.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-payload-custody/src/parser-archive-pair-custody.ts",
    status: "A",
  },
  {
    path: "packages/filing-payload-custody/src/parser-archive-pair-fixture.ts",
    status: "A",
  },
  { path: "pnpm-lock.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
  {
    path: "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
    status: "M",
  },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_2O_CORRECTIVE_TRANSITION = [
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-v5.test.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-v5.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier-v5.test.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.test.ts",
  "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  "packages/filing-payload-custody/src/parser-archive-pair-custody.test.ts",
  "packages/filing-payload-custody/src/parser-archive-pair-custody.ts",
  "scripts/verify-boundaries.ts",
]
  .sort()
  .map((path) => ({ path, status: "M" }));
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
const CYCLE_2H_BASELINE_REVISION =
  "14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98" as const;
const FASTIFY_5_12_1_MAINTENANCE_BASELINE_REVISION =
  "0521bc8a1b0c3ba15d5ffc16fc74e45252bd9efd" as const;
const CI_TEST_SERIALIZATION_BASELINE_REVISION =
  "c7c427d304cd1df0037a96b53202c1c191d06a3a" as const;
const OFFLINE_EVIDENCE_INPUT_CUSTODY_BASELINE_REVISION =
  "5e0a6eb0313107e4bd9fe4e358adbab16fa88311" as const;
const AUTHENTICATED_REPLAY_MAINTENANCE_BASELINE_REVISION =
  "ecc3a3ef7d054ca7cf3810edf0be72042f123b6b" as const;
const PNPM_DEPENDENCY_POLICY_MAINTENANCE_BASELINE_REVISION =
  "c1f27f4dfe946d999dad9473176e0285b01a48bc" as const;
const CYCLE_2I_BASELINE_REVISION =
  "dda2ecafc70aa6c4859a29cb312849bac5dec253" as const;
const CYCLE_2J_BASELINE_REVISION =
  "f17bacc6adc46851e182d260d59830652f1953bb" as const;
const CYCLE_2J_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-normalization-execution-acceptance.yml",
    status: "A",
  },
  { path: "LICENSE_POLICY.md", status: "M" },
  { path: "README.md", status: "M" },
  { path: "THIRD_PARTY_NOTICES.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2J_EXIT_MATRIX.md", status: "A" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0037-bounded-synthetic-ten-fact-parser-execution-normalization.md",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-parser-normalization-execution/v1/cases.json",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-parser-normalization-execution/v1/manifest.json",
    status: "A",
  },
  { path: "package.json", status: "M" },
  ...CYCLE_2J_ACCEPTANCE_TREE.map((path) => ({ path, status: "A" })),
  ...CYCLE_2J_EXECUTION_TREE.map((path) => ({ path, status: "A" })),
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
  {
    path: "scripts/verify-filing-parser-normalization-execution-fixtures.ts",
    status: "A",
  },
] as const;
const CYCLE_2J_TRANSITION_PATHS = CYCLE_2J_TRANSITION.map(
  (entry) => entry.path,
);
const CYCLE_2K_BASELINE_REVISION =
  "962a00f65835fc6126e4da98e0e0d5998e8d59cc" as const;
const CYCLE_2K_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "A",
  },
  { path: "LICENSE_POLICY.md", status: "M" },
  { path: "README.md", status: "M" },
  { path: "THIRD_PARTY_NOTICES.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2K_EXIT_MATRIX.md", status: "A" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0038-bounded-synthetic-cross-engine-parser-execution-agreement.md",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-parser-cross-engine-execution/v1/cases.json",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-parser-cross-engine-execution/v1/manifest.json",
    status: "A",
  },
  { path: "package.json", status: "M" },
  ...CYCLE_2K_ACCEPTANCE_TREE.map((path) => ({ path, status: "A" })),
  ...CYCLE_2K_CORE_TREE.map((path) => ({ path, status: "A" })),
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
  {
    path: "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
    status: "A",
  },
] as const;
const CYCLE_2K_TRANSITION_PATHS = CYCLE_2K_TRANSITION.map(
  (entry) => entry.path,
);
const CYCLE_2M_BASELINE_REVISION =
  "1cb7d3ce024cbd29665af7ec4e010da0c380b726" as const;
const CYCLE_2M_SOURCE_REVISION =
  "5d61868e6075865b32640ddaceb845ac9dbc69f3" as const;
const CYCLE_2M_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2M_EXIT_MATRIX.md", status: "A" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0040-bounded-synthetic-source-owned-direct-docker-cross-engine-lifecycle-agreement.md",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-parser-cross-engine-execution/v3/cases.json",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-parser-cross-engine-execution/v3/manifest.json",
    status: "A",
  },
  {
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-review.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/index.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/test-filing-parser-cross-engine-execution-evidence-builder.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-direct-execution-security.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-direct-execution.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-direct-execution.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-cross-engine-execution/src/index.ts",
    status: "M",
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
  { path: "scripts/verify-boundaries.ts", status: "M" },
  {
    path: "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
    status: "M",
  },
];
const CYCLE_2M_CORRECTIVE_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
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
] as const;
const CYCLE_2M_PRE_BASELINE_CUMULATIVE_ENTRIES = [
  { path: ".github/workflows/ci.yml", status: "M" },
  { path: "docs/CYCLE_2L_EXIT_MATRIX.md", status: "A" },
  {
    path: "docs/adr/0039-bounded-synthetic-cross-engine-current-input-and-lineage-agreement.md",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-parser-cross-engine-execution/v2/cases.json",
    status: "A",
  },
  {
    path: "fixtures/synthetic/filing-parser-cross-engine-execution/v2/manifest.json",
    status: "A",
  },
] as const;
const CYCLE_2M_TRANSITION_PATHS = CYCLE_2M_TRANSITION.map(
  (entry) => entry.path,
);
const CYCLE_2I_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2I_EXIT_MATRIX.md", status: "A" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0036-bounded-synthetic-authenticated-parser-normalization-handoff.md",
    status: "A",
  },
  { path: "packages/db/tests/projection-normalization.test.ts", status: "M" },
  {
    path: "packages/filing-parser-normalization-handoff/package.json",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff-security.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-handoff/src/index.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-handoff/src/test-filing-parser-normalization-handoff-builder.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-handoff/tsconfig.json",
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
    path: "packages/filing-payload-custody/src/run-filing-payload-custody-acceptance.ts",
    status: "M",
  },
  { path: "pnpm-lock.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
] as const;
const CYCLE_2I_TRANSITION_PATHS = CYCLE_2I_TRANSITION.map(
  (entry) => entry.path,
);
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
const FASTIFY_5_12_1_MAINTENANCE_TRANSITION = [
  { path: "THIRD_PARTY_NOTICES.md", status: "M" },
  { path: "apps/api/package.json", status: "M" },
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
  { path: "scripts/verify-licenses.ts", status: "M" },
] as const;
const CI_TEST_SERIALIZATION_TRANSITION = [
  { path: "package.json", status: "M" },
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
] as const;
const OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION = [
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
] as const;
const AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION = [
  {
    path: "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
    status: "M",
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
    path: "packages/filing-payload-custody/src/payload-custody-security.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/payload-custody.ts",
    status: "M",
  },
] as const;
const PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION = [
  { path: ".gitignore", status: "M" },
  { path: ".npmrc", status: "D" },
  { path: "package.json", status: "M" },
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
  { path: "pnpm-workspace.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
] as const;
const PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS = [
  ".gitignore",
  ".npmrc",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts/verify-boundaries.ts",
] as const;

function gitOutput(
  args: readonly string[],
  environment: Readonly<NodeJS.ProcessEnv> = filingParserGitEnvironmentWithoutGrafts(
    process.env,
  ),
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [
        "--no-replace-objects",
        "--no-lazy-fetch",
        "-c",
        "advice.graftFileDeprecated=false",
        ...args,
      ],
      {
        encoding: "utf8",
        env: environment,
        killSignal: "SIGKILL",
        timeout: 30_000,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error !== null)
          reject(new Error("Git fixture failed.", { cause: error }));
        else resolve(stdout);
      },
    );
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("admission-validity exact corrective-successor routing", () => {
  it("freezes the exact baseline and two-commit linear ancestry", () => {
    expect(
      isAdmissionValidityBridgeBaselineMergeBaseAllowed(
        ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION,
      ),
    ).toBe(true);
    expect(
      isAdmissionValidityBridgeBaselineMergeBaseAllowed(
        ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION,
      ),
    ).toBe(false);
    expect(isAdmissionValidityBridgeBaselineMergeBaseAllowed(undefined)).toBe(
      false,
    );

    const revision = "d".repeat(40);
    const valid = [
      "2",
      "2",
      revision,
      `${revision} ${ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION}`,
      `${ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION} ${ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION}`,
    ] as const;
    expect(isAdmissionValidityBridgeCorrectiveChainAllowed(...valid)).toBe(
      true,
    );
    for (const mutate of [
      (values: string[]) => {
        values[0] = "1";
      },
      (values: string[]) => {
        values[1] = "1";
      },
      (values: string[]) => {
        values[2] = ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION;
      },
      (values: string[]) => {
        values[2] = ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION;
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[3] = `${revision} ${ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[3] += ` ${ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[4] = `${ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION} ${"a".repeat(40)}`;
      },
      (values: string[]) => {
        values[4] += ` ${"b".repeat(40)}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isAdmissionValidityBridgeCorrectiveChainAllowed(
          ...(values as Parameters<
            typeof isAdmissionValidityBridgeCorrectiveChainAllowed
          >),
        ),
      ).toBe(false);
    }
  });

  it("requires the exact source, cumulative, and corrective diff sets", () => {
    const cases = [
      [
        ADMISSION_VALIDITY_BRIDGE_SOURCE_TRANSITION,
        isAdmissionValidityBridgeSourceCommitDiffSetAllowed,
      ],
      [
        ADMISSION_VALIDITY_BRIDGE_TRANSITION,
        isAdmissionValidityBridgeCommitDiffSetAllowed,
      ],
      [
        ADMISSION_VALIDITY_BRIDGE_CORRECTIVE_TRANSITION,
        isAdmissionValidityBridgeCorrectiveCommitDiffSetAllowed,
      ],
    ] as const;
    for (const [expected, isAllowed] of cases) {
      expect(isAllowed(expected)).toBe(true);
      expect(isAllowed([...expected].reverse())).toBe(false);
      for (const entry of expected) {
        expect(
          isAllowed(expected.filter((candidate) => candidate !== entry)),
        ).toBe(false);
        expect(isAllowed([...expected, entry])).toBe(false);
        expect(
          isAllowed(
            expected.map((candidate) =>
              candidate === entry ? { ...candidate, status: "A" } : candidate,
            ),
          ),
        ).toBe(false);
      }
      expect(
        isAllowed([...expected, { path: "unexpected", status: "M" }]),
      ).toBe(false);
    }
  });

  it("routes only the complete ordered five-path bridge surface", () => {
    expect(
      isAdmissionValidityBridgeTransitionRoutingRequired(
        ADMISSION_VALIDITY_BRIDGE_TRANSITION_PATHS,
      ),
    ).toBe(true);
    expect(isAdmissionValidityBridgeTransitionRoutingRequired(undefined)).toBe(
      false,
    );
    expect(isAdmissionValidityBridgeTransitionRoutingRequired([])).toBe(false);
    expect(
      isAdmissionValidityBridgeTransitionRoutingRequired(
        [...ADMISSION_VALIDITY_BRIDGE_TRANSITION_PATHS].reverse(),
      ),
    ).toBe(false);
    for (const path of ADMISSION_VALIDITY_BRIDGE_TRANSITION_PATHS)
      expect(
        isAdmissionValidityBridgeTransitionRoutingRequired(
          ADMISSION_VALIDITY_BRIDGE_TRANSITION_PATHS.filter(
            (candidate) => candidate !== path,
          ),
        ),
      ).toBe(false);
    expect(
      isAdmissionValidityBridgeTransitionRoutingRequired([
        ...ADMISSION_VALIDITY_BRIDGE_TRANSITION_PATHS,
        "unexpected",
      ]),
    ).toBe(false);
  });
});

describe("Cycle 2p exact admission-validity promotion routing", () => {
  it("freezes the exact baseline and direct-child topology", () => {
    expect(isCycle2pBaselineMergeBaseAllowed(CYCLE_2P_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2pBaselineMergeBaseAllowed("a".repeat(40))).toBe(false);
    expect(isCycle2pBaselineMergeBaseAllowed(undefined)).toBe(false);

    const revision = "d".repeat(40);
    const valid = [
      "1",
      "1",
      revision,
      `${revision} ${CYCLE_2P_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2pDirectChildAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "0";
      },
      (values: string[]) => {
        values[0] = "2";
      },
      (values: string[]) => {
        values[1] = "0";
      },
      (values: string[]) => {
        values[1] = "2";
      },
      (values: string[]) => {
        values[2] = CYCLE_2P_BASELINE_REVISION;
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[3] = `${revision} ${"a".repeat(40)}`;
      },
      (values: string[]) => {
        values[3] += ` ${"b".repeat(40)}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2pDirectChildAllowed(
          ...(values as Parameters<typeof isCycle2pDirectChildAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("requires the exact sorted six-path source transition", () => {
    expect(isCycle2pCommitDiffSetAllowed(CYCLE_2P_TRANSITION)).toBe(true);
    expect(
      isCycle2pCommitDiffSetAllowed([...CYCLE_2P_TRANSITION].reverse()),
    ).toBe(false);
    for (const entry of CYCLE_2P_TRANSITION) {
      expect(
        isCycle2pCommitDiffSetAllowed(
          CYCLE_2P_TRANSITION.filter((candidate) => candidate !== entry),
        ),
      ).toBe(false);
      expect(
        isCycle2pCommitDiffSetAllowed([...CYCLE_2P_TRANSITION, entry]),
      ).toBe(false);
      expect(
        isCycle2pCommitDiffSetAllowed(
          CYCLE_2P_TRANSITION.map((candidate) =>
            candidate === entry ? { ...candidate, status: "A" } : candidate,
          ),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2pCommitDiffSetAllowed([
        ...CYCLE_2P_TRANSITION,
        { path: "unexpected", status: "M" },
      ]),
    ).toBe(false);
    expect(
      isCycle2pCommitDiffSetAllowed([
        ...CYCLE_2P_TRANSITION,
        { path: CYCLE_2P_CORPUS_ADMISSION_PATH, status: "M" },
      ]),
    ).toBe(false);
  });

  it("routes on every protected surface intersection before Cycle 2o", () => {
    for (const path of CYCLE_2P_PROTECTED_SURFACE_PATHS) {
      expect(isCycle2pTransitionRoutingRequired([path]), path).toBe(true);
      expect(
        isCycle2pTransitionRoutingRequired(["unexpected", path]),
        path,
      ).toBe(true);
    }
    expect(
      isCycle2pTransitionRoutingRequired(
        [...CYCLE_2P_PROTECTED_SURFACE_PATHS].reverse(),
      ),
    ).toBe(true);
    expect(
      isCycle2pTransitionRoutingRequired([CYCLE_2P_CORPUS_ADMISSION_PATH]),
    ).toBe(true);
    expect(isCycle2pTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2pTransitionRoutingRequired([])).toBe(false);
    expect(isCycle2pTransitionRoutingRequired(["unexpected"])).toBe(false);
  });

  it("requires both current and historical corpus-admission blobs to match", () => {
    expect(
      isCycle2pCorpusAdmissionBlobAllowed(
        CYCLE_2P_CORPUS_ADMISSION_BLOB,
        CYCLE_2P_CORPUS_ADMISSION_BLOB,
      ),
    ).toBe(true);
    for (const values of [
      ["a".repeat(40), CYCLE_2P_CORPUS_ADMISSION_BLOB],
      [CYCLE_2P_CORPUS_ADMISSION_BLOB, "b".repeat(40)],
      [undefined, CYCLE_2P_CORPUS_ADMISSION_BLOB],
      [CYCLE_2P_CORPUS_ADMISSION_BLOB, undefined],
    ] as const)
      expect(isCycle2pCorpusAdmissionBlobAllowed(values[0], values[1])).toBe(
        false,
      );
  });
});

describe("Cycle 2o exact source-successor routing", () => {
  it("freezes all three expanded trees", () => {
    expect(isCycle2oCompositionTreeAllowed(CYCLE_2O_COMPOSITION_TREE)).toBe(
      true,
    );
    expect(
      isCycle2oCompositionTreeAllowed([...CYCLE_2O_COMPOSITION_TREE].reverse()),
    ).toBe(false);
    expect(
      isCycle2oCompositionTreeAllowed(CYCLE_2O_COMPOSITION_TREE.slice(1)),
    ).toBe(false);
    expect(
      isCycle2oCompositionTreeAllowed([
        ...CYCLE_2O_COMPOSITION_TREE,
        "packages/filing-parser-custody-quality-composition/src/unreviewed.ts",
      ]),
    ).toBe(false);

    expect(isCycle2oCustodyTreeAllowed(CYCLE_2O_CUSTODY_TREE)).toBe(true);
    expect(
      isCycle2oCustodyTreeAllowed([...CYCLE_2O_CUSTODY_TREE].reverse()),
    ).toBe(false);
    expect(isCycle2oCustodyTreeAllowed(CYCLE_2O_CUSTODY_TREE.slice(1))).toBe(
      false,
    );
    expect(
      isCycle2oCustodyTreeAllowed([
        ...CYCLE_2O_CUSTODY_TREE,
        "packages/filing-payload-custody/src/unreviewed.ts",
      ]),
    ).toBe(false);

    expect(isCycle2oAcceptanceTreeAllowed(CYCLE_2O_ACCEPTANCE_TREE)).toBe(true);
    expect(
      isCycle2oAcceptanceTreeAllowed([...CYCLE_2O_ACCEPTANCE_TREE].reverse()),
    ).toBe(false);
    expect(
      isCycle2oAcceptanceTreeAllowed(CYCLE_2O_ACCEPTANCE_TREE.slice(1)),
    ).toBe(false);
    expect(
      isCycle2oAcceptanceTreeAllowed([
        ...CYCLE_2O_ACCEPTANCE_TREE,
        "packages/filing-parser-cross-engine-execution-acceptance/src/unreviewed.ts",
      ]),
    ).toBe(false);
  });

  it("requires the exact baseline, source, and corrective-child topology", () => {
    const revision = CYCLE_2O_SOURCE_REVISION;
    const correction = "a".repeat(40);
    expect(isCycle2oBaselineMergeBaseAllowed(CYCLE_2O_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2oBaselineMergeBaseAllowed(revision)).toBe(false);
    expect(
      isCycle2oDirectChildAllowed(
        "1",
        "1",
        revision,
        `${revision} ${CYCLE_2O_BASELINE_REVISION}`,
      ),
    ).toBe(true);
    expect(
      isCycle2oDirectChildAllowed(
        "2",
        "1",
        revision,
        `${revision} ${CYCLE_2O_BASELINE_REVISION}`,
      ),
    ).toBe(false);
    expect(
      isCycle2oDirectChildAllowed(
        "1",
        "2",
        revision,
        `${revision} ${CYCLE_2O_BASELINE_REVISION}`,
      ),
    ).toBe(false);
    expect(
      isCycle2oDirectChildAllowed(
        "1",
        "1",
        revision,
        `${revision} ${CYCLE_2O_BASELINE_REVISION} ${"b".repeat(40)}`,
      ),
    ).toBe(false);
    expect(
      isCycle2oDirectChildAllowed(
        "1",
        "1",
        revision,
        `${revision} ${"b".repeat(40)}`,
      ),
    ).toBe(false);
    expect(
      isCycle2oDirectChildAllowed(
        "1",
        "1",
        correction,
        `${correction} ${CYCLE_2O_BASELINE_REVISION}`,
      ),
    ).toBe(false);
    expect(
      isCycle2oCorrectiveTopologyAllowed(
        "2",
        "2",
        correction,
        `${correction} ${CYCLE_2O_SOURCE_REVISION}`,
        `${CYCLE_2O_SOURCE_REVISION} ${CYCLE_2O_BASELINE_REVISION}`,
      ),
    ).toBe(true);
    for (const values of [
      [
        "1",
        "2",
        `${correction} ${CYCLE_2O_SOURCE_REVISION}`,
        `${CYCLE_2O_SOURCE_REVISION} ${CYCLE_2O_BASELINE_REVISION}`,
      ],
      [
        "2",
        "1",
        `${correction} ${CYCLE_2O_SOURCE_REVISION}`,
        `${CYCLE_2O_SOURCE_REVISION} ${CYCLE_2O_BASELINE_REVISION}`,
      ],
      [
        "2",
        "2",
        `${correction} ${CYCLE_2O_BASELINE_REVISION}`,
        `${CYCLE_2O_SOURCE_REVISION} ${CYCLE_2O_BASELINE_REVISION}`,
      ],
      [
        "2",
        "2",
        `${correction} ${CYCLE_2O_SOURCE_REVISION}`,
        `${CYCLE_2O_SOURCE_REVISION} ${"b".repeat(40)}`,
      ],
    ] as const)
      expect(
        isCycle2oCorrectiveTopologyAllowed(
          values[0],
          values[1],
          correction,
          values[2],
          values[3],
        ),
      ).toBe(false);
  });

  it("requires the exact sorted Cycle 2o transition", () => {
    expect(isCycle2oCommitDiffSetAllowed(CYCLE_2O_TRANSITION)).toBe(true);
    expect(
      isCycle2oCommitDiffSetAllowed([...CYCLE_2O_TRANSITION].reverse()),
    ).toBe(false);
    expect(isCycle2oCommitDiffSetAllowed(CYCLE_2O_TRANSITION.slice(1))).toBe(
      false,
    );
    expect(
      isCycle2oCommitDiffSetAllowed([
        ...CYCLE_2O_TRANSITION,
        { path: "unreviewed", status: "A" },
      ]),
    ).toBe(false);
    expect(
      isCycle2oCommitDiffSetAllowed(
        CYCLE_2O_TRANSITION.map((entry, index) =>
          index === 0 ? { ...entry, status: "D" } : entry,
        ),
      ),
    ).toBe(false);
    expect(
      isCycle2oCorrectiveCommitDiffSetAllowed(CYCLE_2O_CORRECTIVE_TRANSITION),
    ).toBe(true);
    expect(
      isCycle2oCorrectiveCommitDiffSetAllowed(
        [...CYCLE_2O_CORRECTIVE_TRANSITION].reverse(),
      ),
    ).toBe(false);
    expect(
      isCycle2oCorrectiveCommitDiffSetAllowed(
        CYCLE_2O_CORRECTIVE_TRANSITION.slice(1),
      ),
    ).toBe(false);
  });

  it("routes Cycle 2o markers before the older milestone surfaces", () => {
    for (const path of [
      "docs/CYCLE_2O_EXIT_MATRIX.md",
      "fixtures/synthetic/filing-parser-cross-engine-execution/v5/cases.json",
      "packages/filing-parser-custody-quality-composition/src/index.ts",
      "packages/filing-payload-custody/src/parser-archive-pair-custody.ts",
    ])
      expect(isCycle2oTransitionRoutingRequired([path])).toBe(true);
    expect(isCycle2oTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2oTransitionRoutingRequired([])).toBe(false);
    expect(
      isCycle2oTransitionRoutingRequired([
        "packages/filing-parser-quality-composition/src/index.ts",
      ]),
    ).toBe(false);
  });
});

describe("Cycle 2n exact source-successor routing", () => {
  it("freezes the new composition tree and direct-child topology", () => {
    const revision = "a".repeat(40);
    expect(isCycle2nCompositionTreeAllowed(CYCLE_2N_COMPOSITION_TREE)).toBe(
      true,
    );
    expect(
      isCycle2nCompositionTreeAllowed([...CYCLE_2N_COMPOSITION_TREE].reverse()),
    ).toBe(false);
    expect(
      isCycle2nCompositionTreeAllowed([
        ...CYCLE_2N_COMPOSITION_TREE,
        "packages/filing-parser-quality-composition/src/unreviewed.ts",
      ]),
    ).toBe(false);
    expect(isCycle2nBaselineMergeBaseAllowed(CYCLE_2N_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2nBaselineMergeBaseAllowed(revision)).toBe(false);
    expect(
      isCycle2nDirectChildAllowed(
        "1",
        "1",
        revision,
        `${revision} ${CYCLE_2N_BASELINE_REVISION}`,
      ),
    ).toBe(true);
    expect(
      isCycle2nDirectChildAllowed(
        "2",
        "1",
        revision,
        `${revision} ${CYCLE_2N_BASELINE_REVISION}`,
      ),
    ).toBe(false);
    expect(
      isCycle2nDirectChildAllowed(
        "1",
        "2",
        revision,
        `${revision} ${CYCLE_2N_BASELINE_REVISION}`,
      ),
    ).toBe(false);
    expect(
      isCycle2nDirectChildAllowed(
        "1",
        "1",
        revision,
        `${revision} ${CYCLE_2N_BASELINE_REVISION} ${"b".repeat(40)}`,
      ),
    ).toBe(false);
    expect(
      isCycle2nDirectChildAllowed(
        "1",
        "1",
        revision,
        `${revision} ${"b".repeat(40)}`,
      ),
    ).toBe(false);
  });

  it("requires the exact complete Cycle 2n transition set", () => {
    expect(isCycle2nCommitDiffSetAllowed(CYCLE_2N_TRANSITION)).toBe(true);
    expect(
      isCycle2nCommitDiffSetAllowed([...CYCLE_2N_TRANSITION].reverse()),
    ).toBe(false);
    for (const entry of CYCLE_2N_TRANSITION) {
      expect(
        isCycle2nCommitDiffSetAllowed(
          CYCLE_2N_TRANSITION.filter((candidate) => candidate !== entry),
        ),
      ).toBe(false);
      expect(
        isCycle2nCommitDiffSetAllowed(
          CYCLE_2N_TRANSITION.map((candidate) =>
            candidate === entry ? { ...candidate, status: "D" } : candidate,
          ),
        ),
      ).toBe(false);
      expect(
        isCycle2nCommitDiffSetAllowed(
          CYCLE_2N_TRANSITION.map((candidate) =>
            candidate === entry ? { ...candidate, status: "R100" } : candidate,
          ),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2nCommitDiffSetAllowed([
        ...CYCLE_2N_TRANSITION,
        CYCLE_2N_TRANSITION[0]!,
      ]),
    ).toBe(false);
    expect(
      isCycle2nCommitDiffSetAllowed([
        ...CYCLE_2N_TRANSITION,
        { path: "unreviewed", status: "A" },
      ]),
    ).toBe(false);
  });

  it("routes Cycle 2n markers before overlapping Cycle 2m paths", () => {
    expect(
      isCycle2nTransitionRoutingRequired([
        "packages/filing-parser-quality-composition/src/index.ts",
      ]),
    ).toBe(true);
    expect(
      isCycle2nTransitionRoutingRequired([
        "fixtures/synthetic/filing-parser-cross-engine-execution/v4/cases.json",
      ]),
    ).toBe(true);
    expect(isCycle2nTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2nTransitionRoutingRequired([])).toBe(false);
    expect(
      isCycle2nTransitionRoutingRequired([
        "packages/filing-parser-cross-engine-execution/src/index.ts",
      ]),
    ).toBe(false);
  });
});

describe("Cycle 2m exact corrective-successor routing", () => {
  it("freezes the exact successor core and acceptance trees", () => {
    expect(CYCLE_2M_CORE_TREE).toHaveLength(15);
    expect(CYCLE_2M_ACCEPTANCE_TREE).toHaveLength(13);
    expect(isCycle2mCoreTreeAllowed([])).toBe(true);
    expect(isCycle2mAcceptanceTreeAllowed([])).toBe(true);
    expect(isCycle2mCoreTreeAllowed(CYCLE_2M_CORE_TREE)).toBe(true);
    expect(isCycle2mAcceptanceTreeAllowed(CYCLE_2M_ACCEPTANCE_TREE)).toBe(true);
    expect(isCycle2mCoreTreeAllowed([...CYCLE_2M_CORE_TREE].reverse())).toBe(
      false,
    );
    expect(
      isCycle2mAcceptanceTreeAllowed([...CYCLE_2M_ACCEPTANCE_TREE].reverse()),
    ).toBe(false);
    for (const omitted of CYCLE_2M_CORE_TREE)
      expect(
        isCycle2mCoreTreeAllowed(
          CYCLE_2M_CORE_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    for (const omitted of CYCLE_2M_ACCEPTANCE_TREE)
      expect(
        isCycle2mAcceptanceTreeAllowed(
          CYCLE_2M_ACCEPTANCE_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    expect(
      isCycle2mCoreTreeAllowed(
        [...CYCLE_2M_CORE_TREE, CYCLE_2M_CORE_TREE[0] as string].sort(),
      ),
    ).toBe(false);
    expect(
      isCycle2mAcceptanceTreeAllowed(
        [
          ...CYCLE_2M_ACCEPTANCE_TREE,
          "packages/filing-parser-cross-engine-execution-acceptance/src/unreviewed.ts",
        ].sort(),
      ),
    ).toBe(false);
    expect(isCycle2kCoreTreeAllowed(CYCLE_2M_CORE_TREE)).toBe(false);
  });

  it("requires the exact baseline and two-commit corrective ancestry", () => {
    expect(isCycle2mBaselineMergeBaseAllowed(CYCLE_2M_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2mBaselineMergeBaseAllowed(CYCLE_2K_BASELINE_REVISION)).toBe(
      false,
    );
    expect(isCycle2mBaselineMergeBaseAllowed(undefined)).toBe(false);

    const revision = "d".repeat(40);
    const valid = [
      "2",
      "2",
      revision,
      `${revision} ${CYCLE_2M_SOURCE_REVISION}`,
      `${CYCLE_2M_SOURCE_REVISION} ${CYCLE_2M_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2mCorrectiveChainAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "1";
      },
      (values: string[]) => {
        values[1] = "1";
      },
      (values: string[]) => {
        values[2] = CYCLE_2M_BASELINE_REVISION;
      },
      (values: string[]) => {
        values[2] = CYCLE_2M_SOURCE_REVISION;
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[3] = `${revision} ${CYCLE_2M_BASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[3] += ` ${CYCLE_2M_BASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[4] = `${CYCLE_2M_SOURCE_REVISION} ${CYCLE_2K_BASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[4] += " ";
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2mCorrectiveChainAllowed(
          ...(values as Parameters<typeof isCycle2mCorrectiveChainAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("admits only the ordered 28-path cumulative A/M transition", () => {
    expect(CYCLE_2M_TRANSITION).toHaveLength(28);
    expect(
      CYCLE_2M_TRANSITION.filter(({ status }) => status === "A"),
    ).toHaveLength(7);
    expect(
      CYCLE_2M_TRANSITION.filter(({ status }) => status === "M"),
    ).toHaveLength(21);
    expect(isCycle2mCommitDiffSetAllowed(CYCLE_2M_TRANSITION)).toBe(true);
    expect(
      isCycle2mCommitDiffSetAllowed([...CYCLE_2M_TRANSITION].reverse()),
    ).toBe(false);
    expect(isCycle2kCommitDiffSetAllowed(CYCLE_2M_TRANSITION)).toBe(false);
    for (const entry of CYCLE_2M_TRANSITION) {
      expect(
        isCycle2mCommitDiffSetAllowed(
          CYCLE_2M_TRANSITION.filter((candidate) => candidate !== entry),
        ),
      ).toBe(false);
      expect(
        isCycle2mCommitDiffSetAllowed([...CYCLE_2M_TRANSITION, entry]),
      ).toBe(false);
      expect(
        isCycle2mCommitDiffSetAllowed(
          CYCLE_2M_TRANSITION.map((candidate) =>
            candidate === entry
              ? { ...candidate, status: candidate.status === "A" ? "M" : "A" }
              : candidate,
          ),
        ),
      ).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed(entry.status, entry.path)).toBe(
        true,
      );
      expect(isCycle2aCommitDiffEntryAllowed("D", entry.path)).toBe(false);
    }
    expect(
      isCycle2mCommitDiffSetAllowed([
        ...CYCLE_2M_TRANSITION,
        { path: "docs/unreviewed.md", status: "A" },
      ]),
    ).toBe(false);
  });

  it("admits only the five exact post-source corrective modifications", () => {
    expect(CYCLE_2M_CORRECTIVE_TRANSITION).toHaveLength(5);
    expect(
      CYCLE_2M_CORRECTIVE_TRANSITION.every(({ status }) => status === "M"),
    ).toBe(true);
    expect(
      isCycle2mCorrectiveCommitDiffSetAllowed(CYCLE_2M_CORRECTIVE_TRANSITION),
    ).toBe(true);
    expect(
      isCycle2mCorrectiveCommitDiffSetAllowed(
        [...CYCLE_2M_CORRECTIVE_TRANSITION].reverse(),
      ),
    ).toBe(false);
    for (const entry of CYCLE_2M_CORRECTIVE_TRANSITION) {
      expect(
        isCycle2mCorrectiveCommitDiffSetAllowed(
          CYCLE_2M_CORRECTIVE_TRANSITION.filter(
            (candidate) => candidate !== entry,
          ),
        ),
      ).toBe(false);
      expect(
        isCycle2mCorrectiveCommitDiffSetAllowed([
          ...CYCLE_2M_CORRECTIVE_TRANSITION,
          entry,
        ]),
      ).toBe(false);
      expect(
        isCycle2mCorrectiveCommitDiffSetAllowed(
          CYCLE_2M_CORRECTIVE_TRANSITION.map((candidate) =>
            candidate === entry ? { ...candidate, status: "A" } : candidate,
          ),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2mCorrectiveCommitDiffSetAllowed([
        ...CYCLE_2M_CORRECTIVE_TRANSITION,
        { path: "unexpected", status: "M" },
      ]),
    ).toBe(false);
  });

  it("admits only the exact Cycle 2l cumulative-history entries", () => {
    expect(CYCLE_2M_PRE_BASELINE_CUMULATIVE_ENTRIES).toHaveLength(5);
    for (const entry of CYCLE_2M_PRE_BASELINE_CUMULATIVE_ENTRIES) {
      expect(
        isCycle2mPreBaselineCumulativeDiffEntryAllowed(
          entry.status,
          entry.path,
        ),
      ).toBe(true);
      expect(
        isCycle2mPreBaselineCumulativeDiffEntryAllowed(
          entry.status === "A" ? "M" : "A",
          entry.path,
        ),
      ).toBe(false);
    }
    expect(
      isCycle2mPreBaselineCumulativeDiffEntryAllowed("A", "unexpected"),
    ).toBe(false);
    expect(
      isCycle2mPreBaselineCumulativeDiffEntryAllowed(undefined, undefined),
    ).toBe(false);
  });

  it("routes Cycle 2m before overlapping historical successors", () => {
    expect(isCycle2mTransitionRoutingRequired(CYCLE_2M_TRANSITION_PATHS)).toBe(
      true,
    );
    for (const path of CYCLE_2M_TRANSITION_PATHS)
      expect(isCycle2mTransitionRoutingRequired([path])).toBe(true);
    expect(isCycle2mTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2mTransitionRoutingRequired([])).toBe(false);
    expect(
      isCycle2mTransitionRoutingRequired(
        [...CYCLE_2M_TRANSITION_PATHS].reverse(),
      ),
    ).toBe(false);
    expect(
      isCycle2mTransitionRoutingRequired([
        CYCLE_2M_TRANSITION_PATHS[0] as string,
        CYCLE_2M_TRANSITION_PATHS[0] as string,
      ]),
    ).toBe(false);
    expect(
      isCycle2mTransitionRoutingRequired([
        ...CYCLE_2M_TRANSITION_PATHS,
        "unexpected",
      ]),
    ).toBe(false);
    const cycle2kOverlap = CYCLE_2M_TRANSITION_PATHS.filter((path) =>
      CYCLE_2K_TRANSITION_PATHS.includes(path),
    );
    expect(cycle2kOverlap.length).toBeGreaterThan(0);
    expect(isCycle2mTransitionRoutingRequired(cycle2kOverlap)).toBe(true);
  });
});

describe("Cycle 2k exact historical-successor routing", () => {
  it("freezes the exact core and acceptance trees", () => {
    expect(CYCLE_2K_CORE_TREE).toHaveLength(12);
    expect(CYCLE_2K_ACCEPTANCE_TREE).toHaveLength(13);
    expect(isCycle2kCoreTreeAllowed([])).toBe(true);
    expect(isCycle2kAcceptanceTreeAllowed([])).toBe(true);
    expect(isCycle2kCoreTreeAllowed(CYCLE_2K_CORE_TREE)).toBe(true);
    expect(isCycle2kAcceptanceTreeAllowed(CYCLE_2K_ACCEPTANCE_TREE)).toBe(true);
    expect(isCycle2kCoreTreeAllowed([...CYCLE_2K_CORE_TREE].reverse())).toBe(
      false,
    );
    expect(
      isCycle2kAcceptanceTreeAllowed([...CYCLE_2K_ACCEPTANCE_TREE].reverse()),
    ).toBe(false);
    for (const omitted of CYCLE_2K_CORE_TREE)
      expect(
        isCycle2kCoreTreeAllowed(
          CYCLE_2K_CORE_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    for (const omitted of CYCLE_2K_ACCEPTANCE_TREE)
      expect(
        isCycle2kAcceptanceTreeAllowed(
          CYCLE_2K_ACCEPTANCE_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    expect(
      isCycle2kCoreTreeAllowed(
        [...CYCLE_2K_CORE_TREE, CYCLE_2K_CORE_TREE[0] as string].sort(),
      ),
    ).toBe(false);
    expect(
      isCycle2kAcceptanceTreeAllowed(
        [
          ...CYCLE_2K_ACCEPTANCE_TREE,
          "packages/filing-parser-cross-engine-execution-acceptance/src/extra.ts",
        ].sort(),
      ),
    ).toBe(false);
  });

  it("requires the exact baseline and ordered 44-path A/M transition", () => {
    expect(isCycle2kBaselineMergeBaseAllowed(CYCLE_2K_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2kBaselineMergeBaseAllowed(CYCLE_2J_BASELINE_REVISION)).toBe(
      false,
    );
    expect(isCycle2kBaselineMergeBaseAllowed(undefined)).toBe(false);
    expect(CYCLE_2K_TRANSITION).toHaveLength(44);
    expect(
      CYCLE_2K_TRANSITION.filter(({ status }) => status === "A"),
    ).toHaveLength(31);
    expect(
      CYCLE_2K_TRANSITION.filter(({ status }) => status === "M"),
    ).toHaveLength(13);
    expect(isCycle2kCommitDiffSetAllowed(CYCLE_2K_TRANSITION)).toBe(true);
    expect(
      isCycle2kCommitDiffSetAllowed([...CYCLE_2K_TRANSITION].reverse()),
    ).toBe(false);
    expect(isCycle2jCommitDiffSetAllowed(CYCLE_2K_TRANSITION)).toBe(false);
    for (const entry of CYCLE_2K_TRANSITION) {
      expect(
        isCycle2kCommitDiffSetAllowed(
          CYCLE_2K_TRANSITION.filter((candidate) => candidate !== entry),
        ),
      ).toBe(false);
      expect(
        isCycle2kCommitDiffSetAllowed([...CYCLE_2K_TRANSITION, entry]),
      ).toBe(false);
      expect(
        isCycle2kCommitDiffSetAllowed(
          CYCLE_2K_TRANSITION.map((candidate) =>
            candidate === entry
              ? { ...candidate, status: candidate.status === "A" ? "M" : "A" }
              : candidate,
          ),
        ),
      ).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed(entry.status, entry.path)).toBe(
        true,
      );
    }
    expect(
      isCycle2kCommitDiffSetAllowed([
        ...CYCLE_2K_TRANSITION,
        { path: "unexpected", status: "A" },
      ]),
    ).toBe(false);
  });

  it("routes Cycle 2k before older overlapping successors", () => {
    expect(isCycle2kTransitionRoutingRequired(CYCLE_2K_TRANSITION_PATHS)).toBe(
      true,
    );
    for (const path of CYCLE_2K_TRANSITION_PATHS)
      expect(isCycle2kTransitionRoutingRequired([path])).toBe(true);
    expect(isCycle2kTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2kTransitionRoutingRequired([])).toBe(false);
    expect(
      isCycle2kTransitionRoutingRequired(
        [...CYCLE_2K_TRANSITION_PATHS].reverse(),
      ),
    ).toBe(false);
    expect(
      isCycle2kTransitionRoutingRequired([
        CYCLE_2K_TRANSITION_PATHS[0] as string,
        CYCLE_2K_TRANSITION_PATHS[0] as string,
      ]),
    ).toBe(false);
    expect(
      isCycle2kTransitionRoutingRequired([
        ...CYCLE_2K_TRANSITION_PATHS,
        "unexpected",
      ]),
    ).toBe(false);
    const cycle2jOverlap = CYCLE_2K_TRANSITION_PATHS.filter((path) =>
      CYCLE_2J_TRANSITION_PATHS.includes(path),
    );
    expect(cycle2jOverlap.length).toBeGreaterThan(0);
    expect(isCycle2kTransitionRoutingRequired(cycle2jOverlap)).toBe(true);
  });
});

describe("offline filing parser evidence review", () => {
  it("disables Git replacement objects and lazy fetches before selecting the repository", () => {
    const args = ["show", "revision:path"] as const;
    const hardened = filingParserGitArgumentsWithoutReplacementObjects(
      "repository",
      args,
    );
    expect(hardened).toEqual([
      "--no-replace-objects",
      "--no-lazy-fetch",
      "-c",
      "advice.graftFileDeprecated=false",
      "-C",
      "repository",
      "show",
      "revision:path",
    ]);
    expect(Object.isFrozen(hardened)).toBe(true);
    expect(args).toEqual(["show", "revision:path"]);
  });

  it("canonicalizes the platform null graft environment", () => {
    const inherited = {
      GIT_GRAFT_FILE: "first",
      Path: "path-value",
      git_graft_file: "second",
    };
    const windows = filingParserGitEnvironmentWithoutGrafts(inherited, "win32");
    expect(windows).toEqual({ GIT_GRAFT_FILE: "NUL", Path: "path-value" });
    expect(Object.isFrozen(windows)).toBe(true);
    expect(filingParserGitEnvironmentWithoutGrafts(inherited, "linux")).toEqual(
      { GIT_GRAFT_FILE: "/dev/null", Path: "path-value" },
    );
    expect(inherited).toEqual({
      GIT_GRAFT_FILE: "first",
      Path: "path-value",
      git_graft_file: "second",
    });
  });

  it("fails closed on timed-out Git and unstable or nonempty graft snapshots", () => {
    expect(isFilingParserGitProcessResultAllowed(0, 41, 64, 0, false)).toBe(
      true,
    );
    expect(isFilingParserGitProcessResultAllowed(0, 41, 64, 0, true)).toBe(
      false,
    );
    const empty = {
      ctimeMs: 4,
      dev: 1,
      ino: 2,
      isFile: () => true,
      isSymbolicLink: () => false,
      mtimeMs: 3,
      size: 0,
    };
    expect(
      isFilingParserEmptyGitGraftsSnapshotAllowed(
        empty,
        empty,
        empty,
        empty,
        0,
      ),
    ).toBe(true);
    expect(
      isFilingParserEmptyGitGraftsSnapshotAllowed(
        empty,
        empty,
        empty,
        { ...empty, size: 1 },
        0,
      ),
    ).toBe(false);
    expect(
      isFilingParserEmptyGitGraftsSnapshotAllowed(
        empty,
        empty,
        empty,
        { ...empty, isSymbolicLink: () => true },
        0,
      ),
    ).toBe(false);
    expect(
      isFilingParserEmptyGitGraftsSnapshotAllowed(
        empty,
        empty,
        empty,
        empty,
        1,
      ),
    ).toBe(false);
  });

  it("resolves and rejects the effective grafts file from a linked worktree", async () => {
    const directory = await mkdtemp(join(tmpdir(), "parser-grafts-test-"));
    temporaryDirectories.push(directory);
    const repositoryPath = join(directory, "repository");
    const worktreePath = join(directory, "linked-worktree");
    await gitOutput(["init", "--quiet", repositoryPath]);
    await writeFile(join(repositoryPath, "tracked.txt"), "tracked\n");
    await gitOutput(["-C", repositoryPath, "add", "tracked.txt"]);
    await gitOutput([
      "-C",
      repositoryPath,
      "-c",
      "user.name=Evidence Test",
      "-c",
      "user.email=evidence@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "initial",
    ]);
    await gitOutput([
      "-C",
      repositoryPath,
      "worktree",
      "add",
      "--quiet",
      "--detach",
      worktreePath,
      "HEAD",
    ]);

    const ambientEnvironment = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => key.toUpperCase() !== "GIT_GRAFT_FILE",
      ),
    );

    await expect(
      verifyNoEffectiveFilingParserGitGrafts(worktreePath, ambientEnvironment),
    ).resolves.toBe(undefined);
    const graftsPath = (
      await gitOutput(
        [
          "-C",
          worktreePath,
          "rev-parse",
          "--path-format=absolute",
          "--git-path",
          "info/grafts",
        ],
        ambientEnvironment,
      )
    ).trim();
    expect(
      decodeFilingParserAbsoluteGitPath(
        new TextEncoder().encode(`${graftsPath}\n`),
      ),
    ).toBe(graftsPath);
    await mkdir(dirname(graftsPath), { recursive: true });
    await writeFile(graftsPath, `${"0".repeat(40)}\n`);
    await expect(
      gitOutput(["-C", worktreePath, "rev-parse", "HEAD"]),
    ).resolves.toMatch(/^[0-9a-f]{40}\n$/u);
    await expect(
      verifyNoEffectiveFilingParserGitGrafts(worktreePath, ambientEnvironment),
    ).rejects.toThrow("Offline evidence review failed.");
    await writeFile(graftsPath, new Uint8Array());
    await expect(
      verifyNoEffectiveFilingParserGitGrafts(worktreePath, ambientEnvironment),
    ).resolves.toBe(undefined);

    const ambientGraftsPath = join(directory, "ambient-grafts");
    const overriddenEnvironment = {
      ...ambientEnvironment,
      GIT_GRAFT_FILE: ambientGraftsPath,
    };
    await writeFile(ambientGraftsPath, `${"1".repeat(40)}\n`);
    await expect(
      verifyNoEffectiveFilingParserGitGrafts(
        worktreePath,
        overriddenEnvironment,
      ),
    ).rejects.toThrow("Offline evidence review failed.");
    await writeFile(ambientGraftsPath, new Uint8Array());
    await expect(
      verifyNoEffectiveFilingParserGitGrafts(
        worktreePath,
        overriddenEnvironment,
      ),
    ).resolves.toBe(undefined);
  });

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

  it("admits only the exact atomic Cycle 2f package tree and transition", () => {
    expect(isCycle2fDisconnectedQualityMeasurementTreeAllowed([])).toBe(true);
    expect(
      isCycle2fDisconnectedQualityMeasurementTreeAllowed(
        CYCLE_2F_SUCCESSOR_TREE,
      ),
    ).toBe(true);
    for (const omitted of CYCLE_2F_SUCCESSOR_TREE) {
      expect(
        isCycle2fDisconnectedQualityMeasurementTreeAllowed(
          CYCLE_2F_SUCCESSOR_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2fDisconnectedQualityMeasurementTreeAllowed(
        [
          ...CYCLE_2F_SUCCESSOR_TREE,
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
        isCycle2aCommitDiffEntryAllowed(omitted.status, omitted.path),
      ).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("D", omitted.path)).toBe(false);
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
    expect(overlapOnlyPartial).toHaveLength(19);
    expect(
      CYCLE_2F_TRANSITION.filter((entry) => entry.status === "A"),
    ).toHaveLength(9);
    expect(isCycle2eCommitDiffSetAllowed(CYCLE_2E_TRANSITION)).toBe(true);
    expect(
      isCycle2fTransitionRoutingRequired(
        overlapOnlyPartial.map((entry) => entry.path),
        [],
        CYCLE_2E_TRANSITION,
      ),
    ).toBe(true);
    expect(isCycle2fCommitDiffSetAllowed(overlapOnlyPartial)).toBe(false);
    expect(
      isCycle2fTransitionRoutingRequired([], [], CYCLE_2E_TRANSITION),
    ).toBe(false);
    expect(
      isCycle2fTransitionRoutingRequired(undefined, [], CYCLE_2E_TRANSITION),
    ).toBe(false);
  });

  it("admits only the exact atomic Cycle 2g package tree and transition", () => {
    expect(isCycle2gDisconnectedQualityPrecommitmentTreeAllowed([])).toBe(true);
    expect(
      isCycle2gDisconnectedQualityPrecommitmentTreeAllowed(
        CYCLE_2G_SUCCESSOR_TREE,
      ),
    ).toBe(true);
    for (const omitted of CYCLE_2G_SUCCESSOR_TREE) {
      expect(
        isCycle2gDisconnectedQualityPrecommitmentTreeAllowed(
          CYCLE_2G_SUCCESSOR_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2gDisconnectedQualityPrecommitmentTreeAllowed(
        [
          ...CYCLE_2G_SUCCESSOR_TREE,
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
        isCycle2aCommitDiffEntryAllowed(omitted.status, omitted.path),
      ).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("D", omitted.path)).toBe(false);
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
    expect(overlapOnlyPartial).toHaveLength(23);
    expect(
      CYCLE_2G_TRANSITION.filter((entry) => entry.status === "A"),
    ).toHaveLength(9);
    expect(isCycle2fCommitDiffSetAllowed(CYCLE_2F_TRANSITION)).toBe(true);
    expect(
      isCycle2gTransitionRoutingRequired(
        overlapOnlyPartial.map((entry) => entry.path),
        [],
        CYCLE_2F_TRANSITION,
      ),
    ).toBe(true);
    expect(isCycle2gCommitDiffSetAllowed(overlapOnlyPartial)).toBe(false);
    expect(
      isCycle2gTransitionRoutingRequired([], [], CYCLE_2F_TRANSITION),
    ).toBe(false);
    expect(
      isCycle2gTransitionRoutingRequired(undefined, [], CYCLE_2F_TRANSITION),
    ).toBe(false);
  });

  it("admits only the exact 38-modification and two-addition Cycle 2h transition", () => {
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
        isCycle2aCommitDiffEntryAllowed(omitted.status, omitted.path),
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

  it("routes Cycle 2h before the immutable Cycle 2g shape and pins its merge base", () => {
    const markerFreeModifications = CYCLE_2H_TRANSITION.filter(
      (entry) => entry.status === "M",
    );
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
        CYCLE_2G_TRANSITION,
      ),
    ).toBe(true);
    expect(
      isCycle2hTransitionRoutingRequired(undefined, CYCLE_2H_TRANSITION),
    ).toBe(true);
    expect(isCycle2hTransitionRoutingRequired([], CYCLE_2G_TRANSITION)).toBe(
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
        isCycle2aCommitDiffEntryAllowed(
          status,
          CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH,
        ),
      ).toBe(false);
    }
  });

  it("admits and routes only the exact eight-modification Fastify 5.12.1 maintenance successor", () => {
    expect(FASTIFY_5_12_1_MAINTENANCE_TRANSITION).toHaveLength(8);
    expect(
      FASTIFY_5_12_1_MAINTENANCE_TRANSITION.filter(
        (entry) => entry.status === "M",
      ),
    ).toHaveLength(8);
    expect(
      isFastify5121MaintenanceCommitDiffSetAllowed(
        FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
      ),
    ).toBe(true);

    for (const omitted of FASTIFY_5_12_1_MAINTENANCE_TRANSITION) {
      expect(
        isFastify5121MaintenanceCommitDiffSetAllowed(
          FASTIFY_5_12_1_MAINTENANCE_TRANSITION.filter(
            (entry) => entry !== omitted,
          ),
        ),
      ).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed("A", omitted.path)).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("M", omitted.path)).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("D", omitted.path)).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed("R100", omitted.path)).toBe(false);
    }
    expect(
      isFastify5121MaintenanceCommitDiffSetAllowed([
        ...FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
        { path: "apps/api/src/unreviewed.ts", status: "M" },
      ]),
    ).toBe(false);
    for (const status of ["A", "D", "R100"]) {
      expect(
        isFastify5121MaintenanceCommitDiffSetAllowed(
          FASTIFY_5_12_1_MAINTENANCE_TRANSITION.map((entry, index) =>
            index === 0 ? { ...entry, status } : entry,
          ),
        ),
      ).toBe(false);
    }

    expect(
      isFastify5121MaintenanceBaselineMergeBaseAllowed(
        FASTIFY_5_12_1_MAINTENANCE_BASELINE_REVISION,
      ),
    ).toBe(true);
    expect(
      isFastify5121MaintenanceBaselineMergeBaseAllowed("0".repeat(40)),
    ).toBe(false);
    expect(isFastify5121MaintenanceBaselineMergeBaseAllowed(undefined)).toBe(
      false,
    );
    expect(
      isFastify5121MaintenanceTransitionRoutingRequired(
        FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
      ),
    ).toBe(true);
    expect(
      isFastify5121MaintenanceTransitionRoutingRequired([
        { path: "apps/api/package.json" },
      ]),
    ).toBe(true);
    expect(
      isFastify5121MaintenanceTransitionRoutingRequired(
        FASTIFY_5_12_1_MAINTENANCE_TRANSITION.filter(
          (entry) => entry.path !== "apps/api/package.json",
        ),
      ),
    ).toBe(false);
    expect(
      isFastify5121MaintenanceTransitionRoutingRequired(CYCLE_2H_TRANSITION),
    ).toBe(false);

    const cycle2hOverlap = FASTIFY_5_12_1_MAINTENANCE_TRANSITION.filter(
      (entry) =>
        entry.path ===
          "packages/filing-parser/src/filing-parser-evidence-verifier.ts" ||
        entry.path ===
          "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    ).map((entry) => entry.path);
    expect(
      isCycle2hTransitionRoutingRequired(
        cycle2hOverlap,
        FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
      ),
    ).toBe(true);
    expect(
      isCycle2hCommitDiffSetAllowed([
        ...CYCLE_2H_TRANSITION,
        ...FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
      ]),
    ).toBe(false);
    expect(
      isFastify5121MaintenanceCommitDiffSetAllowed([
        ...CYCLE_2H_TRANSITION,
        ...FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
      ]),
    ).toBe(false);
  });

  it("admits only the exact Cycle 2j execution and acceptance package trees", () => {
    const trees = [
      {
        allowed: isCycle2jExecutionTreeAllowed,
        paths: CYCLE_2J_EXECUTION_TREE,
        unreviewed:
          "packages/filing-parser-normalization-execution/src/unreviewed.ts",
      },
      {
        allowed: isCycle2jAcceptanceTreeAllowed,
        paths: CYCLE_2J_ACCEPTANCE_TREE,
        unreviewed:
          "packages/filing-parser-normalization-execution-acceptance/src/unreviewed.ts",
      },
    ] as const;
    for (const tree of trees) {
      expect(tree.allowed([])).toBe(true);
      expect(tree.allowed(tree.paths)).toBe(true);
      expect(tree.allowed([...tree.paths].reverse())).toBe(false);
      for (const omitted of tree.paths) {
        expect(
          tree.allowed(tree.paths.filter((path) => path !== omitted)),
        ).toBe(false);
      }
      expect(tree.allowed([...tree.paths, tree.paths[0] as string])).toBe(
        false,
      );
      expect(tree.allowed([...tree.paths, tree.unreviewed].sort())).toBe(false);
    }

    expect(isCycle2jBaselineMergeBaseAllowed(CYCLE_2J_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2jBaselineMergeBaseAllowed("0".repeat(40))).toBe(false);
    expect(isCycle2jBaselineMergeBaseAllowed(undefined)).toBe(false);
  });

  it("admits and routes only the exact whole Cycle 2j transition before Cycle 2i and maintenance", () => {
    expect(CYCLE_2J_TRANSITION).toHaveLength(44);
    expect(
      CYCLE_2J_TRANSITION.filter((entry) => entry.status === "A"),
    ).toHaveLength(31);
    expect(
      CYCLE_2J_TRANSITION.filter((entry) => entry.status === "M"),
    ).toHaveLength(13);
    expect(isCycle2jCommitDiffSetAllowed(CYCLE_2J_TRANSITION)).toBe(true);
    expect(
      isCycle2jCommitDiffSetAllowed([...CYCLE_2J_TRANSITION].reverse()),
    ).toBe(false);

    for (const entry of CYCLE_2J_TRANSITION) {
      expect(
        isCycle2jCommitDiffSetAllowed(
          CYCLE_2J_TRANSITION.filter((candidate) => candidate !== entry),
        ),
      ).toBe(false);
      expect(
        isCycle2jCommitDiffSetAllowed([...CYCLE_2J_TRANSITION, entry]),
      ).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed(entry.status, entry.path)).toBe(
        true,
      );
      expect(isCycle2aCommitDiffEntryAllowed("D", entry.path)).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed("R100", entry.path)).toBe(false);

      for (const status of ["A", "M", "D", "R100"]) {
        if (status === entry.status) continue;
        expect(
          isCycle2jCommitDiffSetAllowed(
            CYCLE_2J_TRANSITION.map((candidate) =>
              candidate === entry ? { ...candidate, status } : candidate,
            ),
          ),
        ).toBe(false);
      }
    }
    expect(
      isCycle2jCommitDiffSetAllowed([
        ...CYCLE_2J_TRANSITION,
        { path: "docs/unreviewed.md", status: "A" },
      ]),
    ).toBe(false);

    expect(isCycle2jTransitionRoutingRequired(CYCLE_2J_TRANSITION_PATHS)).toBe(
      true,
    );
    for (const path of CYCLE_2J_TRANSITION_PATHS) {
      expect(isCycle2jTransitionRoutingRequired([path])).toBe(true);
    }
    expect(isCycle2jTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2jTransitionRoutingRequired([])).toBe(false);
    expect(
      isCycle2jTransitionRoutingRequired(
        [...CYCLE_2J_TRANSITION_PATHS].reverse(),
      ),
    ).toBe(false);
    expect(
      isCycle2jTransitionRoutingRequired([
        CYCLE_2J_TRANSITION_PATHS[0] as string,
        CYCLE_2J_TRANSITION_PATHS[0] as string,
      ]),
    ).toBe(false);
    expect(
      isCycle2jTransitionRoutingRequired([
        ...CYCLE_2J_TRANSITION_PATHS,
        "docs/unreviewed.md",
      ]),
    ).toBe(false);

    const cycle2iOverlap = CYCLE_2J_TRANSITION_PATHS.filter((path) =>
      CYCLE_2I_TRANSITION_PATHS.some((candidate) => candidate === path),
    );
    expect(cycle2iOverlap.length).toBeGreaterThan(0);
    expect(isCycle2jTransitionRoutingRequired(cycle2iOverlap)).toBe(true);
    expect(isCycle2iTransitionRoutingRequired(cycle2iOverlap)).toBe(true);

    const pnpmOverlap = CYCLE_2J_TRANSITION_PATHS.filter((path) =>
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS.some(
        (candidate) => candidate === path,
      ),
    );
    expect(pnpmOverlap).toEqual([
      "package.json",
      "pnpm-lock.yaml",
      "scripts/verify-boundaries.ts",
    ]);
    expect(isCycle2jTransitionRoutingRequired(pnpmOverlap)).toBe(true);
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired(pnpmOverlap),
    ).toBe(true);

    expect(isCycle2iCommitDiffSetAllowed(CYCLE_2J_TRANSITION)).toBe(false);
    expect(
      isCycle2jCommitDiffSetAllowed([
        ...CYCLE_2J_TRANSITION,
        ...CYCLE_2I_TRANSITION,
      ]),
    ).toBe(false);
  });

  it("admits and routes only the exact Cycle 2i handoff successor before pnpm maintenance", () => {
    expect(isCycle2iHandoffTreeAllowed([])).toBe(true);
    expect(isCycle2iHandoffTreeAllowed(CYCLE_2I_HANDOFF_TREE)).toBe(true);
    expect(
      isCycle2iHandoffTreeAllowed([...CYCLE_2I_HANDOFF_TREE].reverse()),
    ).toBe(false);
    for (const omitted of CYCLE_2I_HANDOFF_TREE) {
      expect(
        isCycle2iHandoffTreeAllowed(
          CYCLE_2I_HANDOFF_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2iHandoffTreeAllowed(
        [
          ...CYCLE_2I_HANDOFF_TREE,
          "packages/filing-parser-normalization-handoff/src/unreviewed.ts",
        ].sort(),
      ),
    ).toBe(false);

    expect(isCycle2iBaselineMergeBaseAllowed(CYCLE_2I_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2iBaselineMergeBaseAllowed("0".repeat(40))).toBe(false);
    expect(isCycle2iBaselineMergeBaseAllowed(undefined)).toBe(false);

    expect(CYCLE_2I_TRANSITION).toHaveLength(21);
    expect(
      CYCLE_2I_TRANSITION.filter((entry) => entry.status === "A"),
    ).toHaveLength(9);
    expect(
      CYCLE_2I_TRANSITION.filter((entry) => entry.status === "M"),
    ).toHaveLength(12);
    expect(isCycle2iCommitDiffSetAllowed(CYCLE_2I_TRANSITION)).toBe(true);
    expect(
      isCycle2iCommitDiffSetAllowed([...CYCLE_2I_TRANSITION].reverse()),
    ).toBe(false);

    for (const entry of CYCLE_2I_TRANSITION) {
      expect(
        isCycle2iCommitDiffSetAllowed(
          CYCLE_2I_TRANSITION.filter((candidate) => candidate !== entry),
        ),
      ).toBe(false);
      expect(
        isCycle2iCommitDiffSetAllowed([...CYCLE_2I_TRANSITION, entry]),
      ).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed(entry.status, entry.path)).toBe(
        true,
      );
      expect(isCycle2aCommitDiffEntryAllowed("D", entry.path)).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed("R100", entry.path)).toBe(false);

      for (const status of ["A", "M", "D", "R100"]) {
        if (status === entry.status) continue;
        expect(
          isCycle2iCommitDiffSetAllowed(
            CYCLE_2I_TRANSITION.map((candidate) =>
              candidate === entry ? { ...candidate, status } : candidate,
            ),
          ),
        ).toBe(false);
      }
    }
    expect(
      isCycle2iCommitDiffSetAllowed([
        ...CYCLE_2I_TRANSITION,
        { path: "docs/unreviewed.md", status: "A" },
      ]),
    ).toBe(false);

    expect(isCycle2iTransitionRoutingRequired(CYCLE_2I_TRANSITION_PATHS)).toBe(
      true,
    );
    for (const path of CYCLE_2I_TRANSITION_PATHS) {
      expect(isCycle2iTransitionRoutingRequired([path])).toBe(true);
      expect(
        isCycle2iTransitionRoutingRequired(
          CYCLE_2I_TRANSITION_PATHS.filter((candidate) => candidate !== path),
        ),
      ).toBe(true);
    }
    expect(isCycle2iTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2iTransitionRoutingRequired([])).toBe(false);
    expect(
      isCycle2iTransitionRoutingRequired(
        [...CYCLE_2I_TRANSITION_PATHS].reverse(),
      ),
    ).toBe(false);
    expect(
      isCycle2iTransitionRoutingRequired([
        CYCLE_2I_TRANSITION_PATHS[0] as string,
        CYCLE_2I_TRANSITION_PATHS[0] as string,
      ]),
    ).toBe(false);
    expect(
      isCycle2iTransitionRoutingRequired([
        ...CYCLE_2I_TRANSITION_PATHS,
        "docs/unreviewed.md",
      ]),
    ).toBe(false);
    const pnpmOverlap = CYCLE_2I_TRANSITION_PATHS.filter((path) =>
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS.some(
        (candidate) => candidate === path,
      ),
    );
    expect(pnpmOverlap).toEqual([
      "pnpm-lock.yaml",
      "scripts/verify-boundaries.ts",
    ]);
    expect(isCycle2iTransitionRoutingRequired(pnpmOverlap)).toBe(true);
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired(pnpmOverlap),
    ).toBe(true);
  });

  it("routes every pnpm policy surface subset before older maintenance routes and admits only the exact ten-path transition", () => {
    expect(PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION).toHaveLength(10);
    expect(
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.filter(
        (entry) => entry.status === "M",
      ),
    ).toHaveLength(9);
    expect(
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.filter(
        (entry) => entry.status === "D",
      ),
    ).toEqual([{ path: ".npmrc", status: "D" }]);
    expect(
      isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed(
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION,
      ),
    ).toBe(true);
    expect(
      isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed(
        [...PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION].reverse(),
      ),
    ).toBe(true);

    for (const entry of PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION) {
      expect(
        isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed(
          PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.filter(
            (candidate) => candidate !== entry,
          ),
        ),
      ).toBe(false);
      expect(
        isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed([
          ...PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION,
          entry,
        ]),
      ).toBe(false);
      for (const status of ["A", "M", "D", "R100"]) {
        if (status === entry.status) continue;
        expect(
          isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed(
            PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.map((candidate) =>
              candidate === entry ? { ...candidate, status } : candidate,
            ),
          ),
        ).toBe(false);
      }
    }

    for (const status of ["A", "M", "D", "R100"]) {
      expect(
        isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed([
          ...PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION,
          { path: "scripts/unreviewed-dependency-policy.ts", status },
        ]),
      ).toBe(false);
    }
    expect(
      isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed([
        ...PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.filter(
          (entry) => entry.path !== ".npmrc",
        ),
        { path: ".npmrc", status: "R100" },
        { path: ".npmrc.disabled", status: "A" },
      ]),
    ).toBe(false);
    expect(isCycle2aCommitDiffEntryAllowed("D", ".npmrc")).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceNpmrcDeletionDiffEntryAllowed(
        "D",
        ".npmrc",
      ),
    ).toBe(true);
    for (const status of ["A", "M", "R100"]) {
      expect(
        isPnpmDependencyPolicyMaintenanceNpmrcDeletionDiffEntryAllowed(
          status,
          ".npmrc",
        ),
      ).toBe(false);
    }
    expect(
      isPnpmDependencyPolicyMaintenanceNpmrcDeletionDiffEntryAllowed(
        "D",
        "scripts/unreviewed-dependency-policy.ts",
      ),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceNpmrcDeletionDiffEntryAllowed(
        "D",
        undefined,
      ),
    ).toBe(false);

    for (const entry of PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION) {
      if (entry.path === ".npmrc") continue;
      expect(isCycle2aCommitDiffEntryAllowed("A", entry.path)).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("M", entry.path)).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("D", entry.path)).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed("R100", entry.path)).toBe(false);
    }

    expect(
      isPnpmDependencyPolicyMaintenanceBaselineMergeBaseAllowed(
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_BASELINE_REVISION,
      ),
    ).toBe(true);
    expect(
      isPnpmDependencyPolicyMaintenanceBaselineMergeBaseAllowed("0".repeat(40)),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceBaselineMergeBaseAllowed(undefined),
    ).toBe(false);

    for (const path of PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS) {
      expect(
        isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired([path]),
      ).toBe(true);
      expect(
        isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired([path, path]),
      ).toBe(false);
    }
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired(
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS,
      ),
    ).toBe(true);
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired(
        [...PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS].reverse(),
      ),
    ).toBe(true);
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired([
        ".npmrc",
        "scripts/unreviewed-dependency-policy.ts",
      ]),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired([
        "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
      ]),
    ).toBe(false);
    expect(isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired([])).toBe(
      false,
    );
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired(undefined),
    ).toBe(false);

    expect(
      isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(undefined, [
        { path: ".npmrc", status: "D" },
      ]),
    ).toBe(true);
    for (const path of [".gitignore", "pnpm-workspace.yaml"]) {
      for (const status of ["A", "M"]) {
        expect(
          isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(
            undefined,
            [{ path, status }],
          ),
        ).toBe(true);
      }
    }
    expect(
      isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(undefined, [
        { path: "package.json", status: "M" },
        { path: "pnpm-lock.yaml", status: "M" },
        { path: "scripts/verify-boundaries.ts", status: "M" },
      ]),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(
        undefined,
        AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(
        ["package.json"],
        AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION,
      ),
    ).toBe(true);
    expect(
      isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(undefined, []),
    ).toBe(false);

    const olderAuthenticatedReplaySurface = [
      "packages/filing-payload-custody/src/payload-custody.ts",
    ];
    expect(
      isAuthenticatedReplayMaintenanceSurfaceRoutingRequired(
        olderAuthenticatedReplaySurface,
      ),
    ).toBe(true);
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired(["package.json"]),
    ).toBe(true);
    expect(isCiTestSerializationSurfaceRoutingRequired(["package.json"])).toBe(
      true,
    );
    expect(
      isAuthenticatedReplayMaintenanceCommitDiffSetAllowed(
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed(
        AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isCiTestSerializationCommitDiffSetAllowed(
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed([
        ...PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION,
        ...AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION,
      ]),
    ).toBe(false);
  });

  it("admits and routes only the exact seven-modification authenticated-replay maintenance successor", () => {
    const surfacePath =
      "packages/filing-payload-custody/src/payload-custody.ts";
    expect(AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION).toHaveLength(7);
    expect(
      AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION.every(
        (entry) => entry.status === "M",
      ),
    ).toBe(true);
    expect(
      isAuthenticatedReplayMaintenanceCommitDiffSetAllowed(
        AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION,
      ),
    ).toBe(true);
    expect(
      isAuthenticatedReplayMaintenanceCommitDiffSetAllowed(
        [...AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION].reverse(),
      ),
    ).toBe(true);

    for (const entry of AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION) {
      expect(
        isAuthenticatedReplayMaintenanceCommitDiffSetAllowed(
          AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION.filter(
            (candidate) => candidate !== entry,
          ),
        ),
      ).toBe(false);
      expect(
        isAuthenticatedReplayMaintenanceCommitDiffSetAllowed([
          ...AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION,
          entry,
        ]),
      ).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed("A", entry.path)).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("M", entry.path)).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("D", entry.path)).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed("R100", entry.path)).toBe(false);

      for (const status of ["A", "D", "R100"]) {
        expect(
          isAuthenticatedReplayMaintenanceCommitDiffSetAllowed(
            AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION.map((candidate) =>
              candidate === entry ? { ...candidate, status } : candidate,
            ),
          ),
        ).toBe(false);
      }
    }

    for (const status of ["A", "M", "D", "R100"]) {
      expect(
        isAuthenticatedReplayMaintenanceCommitDiffSetAllowed([
          ...AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION,
          { path: "packages/filing-payload-custody/src/unreviewed.ts", status },
        ]),
      ).toBe(false);
    }

    expect(
      isAuthenticatedReplayMaintenanceBaselineMergeBaseAllowed(
        AUTHENTICATED_REPLAY_MAINTENANCE_BASELINE_REVISION,
      ),
    ).toBe(true);
    expect(
      isAuthenticatedReplayMaintenanceBaselineMergeBaseAllowed("0".repeat(40)),
    ).toBe(false);
    expect(
      isAuthenticatedReplayMaintenanceBaselineMergeBaseAllowed(undefined),
    ).toBe(false);

    expect(
      isAuthenticatedReplayMaintenanceSurfaceRoutingRequired([surfacePath]),
    ).toBe(true);
    expect(
      isAuthenticatedReplayMaintenanceSurfaceRoutingRequired([
        surfacePath,
        surfacePath,
      ]),
    ).toBe(false);
    expect(
      isAuthenticatedReplayMaintenanceSurfaceRoutingRequired([
        "packages/filing-payload-custody/src/payload-custody-security.test.ts",
      ]),
    ).toBe(false);
    expect(
      isAuthenticatedReplayMaintenanceSurfaceRoutingRequired([
        surfacePath,
        "packages/filing-payload-custody/src/renamed.ts",
      ]),
    ).toBe(false);
    expect(isAuthenticatedReplayMaintenanceSurfaceRoutingRequired([])).toBe(
      false,
    );
    expect(
      isAuthenticatedReplayMaintenanceSurfaceRoutingRequired(undefined),
    ).toBe(false);

    const offlineOverlap = AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION.filter(
      (entry) =>
        OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION.some(
          (offlineEntry) => offlineEntry.path === entry.path,
        ),
    ).map((entry) => entry.path);
    expect(offlineOverlap).toHaveLength(4);
    expect(
      isOfflineEvidenceInputCustodySurfaceRoutingRequired(offlineOverlap),
    ).toBe(true);
    expect(
      isOfflineEvidenceInputCustodyCommitDiffSetAllowed(
        AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isAuthenticatedReplayMaintenanceCommitDiffSetAllowed(
        OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isAuthenticatedReplayMaintenanceCommitDiffSetAllowed([
        ...AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION,
        ...OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION,
      ]),
    ).toBe(false);
  });

  it("admits and routes only the exact four-modification offline-evidence input-custody successor", () => {
    const transitionPaths = OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION.map(
      (entry) => entry.path,
    );
    expect(OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION).toHaveLength(4);
    expect(
      OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION.every(
        (entry) => entry.status === "M",
      ),
    ).toBe(true);
    expect(
      isOfflineEvidenceInputCustodyCommitDiffSetAllowed(
        OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION,
      ),
    ).toBe(true);
    expect(
      isOfflineEvidenceInputCustodyCommitDiffSetAllowed(
        [...OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION].reverse(),
      ),
    ).toBe(true);

    for (const entry of OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION) {
      expect(
        isOfflineEvidenceInputCustodySurfaceRoutingRequired([entry.path]),
      ).toBe(true);
      expect(
        isOfflineEvidenceInputCustodySurfaceRoutingRequired([
          entry.path,
          entry.path,
        ]),
      ).toBe(false);
      expect(
        isOfflineEvidenceInputCustodyCommitDiffSetAllowed(
          OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION.filter(
            (candidate) => candidate !== entry,
          ),
        ),
      ).toBe(false);
      expect(
        isOfflineEvidenceInputCustodyCommitDiffSetAllowed([
          ...OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION,
          entry,
        ]),
      ).toBe(false);
      for (const status of ["A", "D", "R100"]) {
        expect(
          isOfflineEvidenceInputCustodyCommitDiffSetAllowed(
            OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION.map((candidate) =>
              candidate === entry ? { ...candidate, status } : candidate,
            ),
          ),
        ).toBe(false);
      }
    }

    for (const status of ["A", "M", "D", "R100"]) {
      expect(
        isOfflineEvidenceInputCustodyCommitDiffSetAllowed([
          ...OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION,
          { path: "packages/filing-parser/src/unreviewed.ts", status },
        ]),
      ).toBe(false);
    }
    expect(
      isOfflineEvidenceInputCustodySurfaceRoutingRequired(transitionPaths),
    ).toBe(true);
    expect(
      isOfflineEvidenceInputCustodySurfaceRoutingRequired(
        [...transitionPaths].reverse(),
      ),
    ).toBe(true);
    expect(
      isOfflineEvidenceInputCustodySurfaceRoutingRequired([
        ...transitionPaths,
        "packages/filing-parser/src/unreviewed.ts",
      ]),
    ).toBe(false);
    expect(
      isOfflineEvidenceInputCustodySurfaceRoutingRequired([
        "packages/filing-parser/src/unreviewed.ts",
      ]),
    ).toBe(false);
    expect(isOfflineEvidenceInputCustodySurfaceRoutingRequired([])).toBe(false);
    expect(isOfflineEvidenceInputCustodySurfaceRoutingRequired(undefined)).toBe(
      false,
    );

    expect(
      isOfflineEvidenceInputCustodyBaselineMergeBaseAllowed(
        OFFLINE_EVIDENCE_INPUT_CUSTODY_BASELINE_REVISION,
      ),
    ).toBe(true);
    expect(
      isOfflineEvidenceInputCustodyBaselineMergeBaseAllowed("0".repeat(40)),
    ).toBe(false);
    expect(
      isOfflineEvidenceInputCustodyBaselineMergeBaseAllowed(undefined),
    ).toBe(false);
    expect(
      isCiTestSerializationCommitDiffSetAllowed(
        OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION,
      ),
    ).toBe(false);
  });

  it("admits and routes only the exact five-modification CI test-serialization successor", () => {
    expect(CI_TEST_SERIALIZATION_TRANSITION).toHaveLength(5);
    expect(
      CI_TEST_SERIALIZATION_TRANSITION.filter((entry) => entry.status === "M"),
    ).toHaveLength(5);
    expect(
      isCiTestSerializationCommitDiffSetAllowed(
        CI_TEST_SERIALIZATION_TRANSITION,
      ),
    ).toBe(true);

    for (const omitted of CI_TEST_SERIALIZATION_TRANSITION) {
      expect(
        isCiTestSerializationCommitDiffSetAllowed(
          CI_TEST_SERIALIZATION_TRANSITION.filter((entry) => entry !== omitted),
        ),
      ).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed("A", omitted.path)).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("M", omitted.path)).toBe(true);
      expect(isCycle2aCommitDiffEntryAllowed("D", omitted.path)).toBe(false);
      expect(isCycle2aCommitDiffEntryAllowed("R100", omitted.path)).toBe(false);

      for (const status of ["A", "D", "R100"]) {
        expect(
          isCiTestSerializationCommitDiffSetAllowed(
            CI_TEST_SERIALIZATION_TRANSITION.map((entry) =>
              entry === omitted ? { ...entry, status } : entry,
            ),
          ),
        ).toBe(false);
      }
    }
    expect(
      isCiTestSerializationCommitDiffSetAllowed([
        ...CI_TEST_SERIALIZATION_TRANSITION,
        { path: "packages/filing-parser/src/unreviewed.ts", status: "M" },
      ]),
    ).toBe(false);

    expect(
      isCiTestSerializationBaselineMergeBaseAllowed(
        CI_TEST_SERIALIZATION_BASELINE_REVISION,
      ),
    ).toBe(true);
    expect(isCiTestSerializationBaselineMergeBaseAllowed("0".repeat(40))).toBe(
      false,
    );
    expect(isCiTestSerializationBaselineMergeBaseAllowed(undefined)).toBe(
      false,
    );
    expect(isCiTestSerializationSurfaceRoutingRequired(["package.json"])).toBe(
      true,
    );
    expect(
      isCiTestSerializationSurfaceRoutingRequired([
        "package.json",
        "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
      ]),
    ).toBe(false);
    expect(
      isCiTestSerializationSurfaceRoutingRequired([
        "package.json",
        "package.json",
      ]),
    ).toBe(false);
    expect(
      isCiTestSerializationSurfaceRoutingRequired([
        "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
      ]),
    ).toBe(false);
    expect(isCiTestSerializationSurfaceRoutingRequired([])).toBe(false);
    expect(isCiTestSerializationSurfaceRoutingRequired(undefined)).toBe(false);

    expect(
      isFastify5121MaintenanceCommitDiffSetAllowed(
        FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
      ),
    ).toBe(true);
    expect(
      isCiTestSerializationCommitDiffSetAllowed(
        FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isFastify5121MaintenanceCommitDiffSetAllowed(
        CI_TEST_SERIALIZATION_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isCiTestSerializationCommitDiffSetAllowed([
        ...FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
        ...CI_TEST_SERIALIZATION_TRANSITION,
      ]),
    ).toBe(false);
    expect(
      isFastify5121MaintenanceCommitDiffSetAllowed([
        ...FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
        ...CI_TEST_SERIALIZATION_TRANSITION,
      ]),
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

  it("takes one exact own-data snapshot of every independent review anchor", () => {
    const original = {
      evidencePath: "evidence.json",
      expectedEvidenceSha256: HASH,
      expectedRepository: "example/research-cockpit",
      expectedRevision: "b".repeat(40),
      expectedRunAttempt: 1,
      expectedRunId: "123",
      repositoryPath: "repository",
    };
    const expected = { ...original };
    const snapshot = normalizeFilingParserEvidenceReviewOptions(original);
    expect(snapshot).toStrictEqual(expected);
    expect(Object.isFrozen(snapshot)).toBe(true);

    original.evidencePath = "changed.json";
    original.expectedEvidenceSha256 = `sha256:${"c".repeat(64)}`;
    original.expectedRepository = "changed/repository";
    original.expectedRevision = "c".repeat(40);
    original.expectedRunAttempt = 2;
    original.expectedRunId = "456";
    original.repositoryPath = "changed-repository";
    expect(snapshot).toStrictEqual(expected);

    for (const omitted of Object.keys(expected)) {
      const candidate = { ...expected } as Record<string, unknown>;
      delete candidate[omitted];
      expect(() =>
        normalizeFilingParserEvidenceReviewOptions(candidate as never),
      ).toThrow("Offline evidence review failed.");
    }
    expect(() =>
      normalizeFilingParserEvidenceReviewOptions({
        ...expected,
        unexpected: true,
      } as never),
    ).toThrow("Offline evidence review failed.");

    const symbolKeyed = { ...expected } as Record<PropertyKey, unknown>;
    symbolKeyed[Symbol("unexpected")] = true;
    expect(() =>
      normalizeFilingParserEvidenceReviewOptions(symbolKeyed as never),
    ).toThrow("Offline evidence review failed.");

    const inherited = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      expected,
    );
    expect(() =>
      normalizeFilingParserEvidenceReviewOptions(inherited as never),
    ).toThrow("Offline evidence review failed.");

    let accessorCalls = 0;
    const accessor = { ...expected } as Record<string, unknown>;
    Object.defineProperty(accessor, "expectedRevision", {
      enumerable: true,
      get: () => {
        accessorCalls += 1;
        return expected.expectedRevision;
      },
    });
    expect(() =>
      normalizeFilingParserEvidenceReviewOptions(accessor as never),
    ).toThrow("Offline evidence review failed.");
    expect(accessorCalls).toBe(0);

    const nonenumerable = { ...expected } as Record<string, unknown>;
    Object.defineProperty(nonenumerable, "expectedRevision", {
      enumerable: false,
      value: expected.expectedRevision,
    });
    expect(() =>
      normalizeFilingParserEvidenceReviewOptions(nonenumerable as never),
    ).toThrow("Offline evidence review failed.");

    let propertyGetCalls = 0;
    const dataProxy = new Proxy(expected, {
      get: () => {
        propertyGetCalls += 1;
        throw new Error("property Get must not execute");
      },
    });
    expect(() => normalizeFilingParserEvidenceReviewOptions(dataProxy)).toThrow(
      "Offline evidence review failed.",
    );
    expect(propertyGetCalls).toBe(0);

    for (const trap of [
      "getPrototypeOf",
      "ownKeys",
      "getOwnPropertyDescriptor",
    ] as const) {
      const hostile = new Proxy(expected, {
        getOwnPropertyDescriptor: (target, key) => {
          if (trap === "getOwnPropertyDescriptor") throw new Error("canary");
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
        getPrototypeOf: (target) => {
          if (trap === "getPrototypeOf") throw new Error("canary");
          return Reflect.getPrototypeOf(target);
        },
        ownKeys: (target) => {
          if (trap === "ownKeys") throw new Error("canary");
          return Reflect.ownKeys(target);
        },
      });
      expect(() => normalizeFilingParserEvidenceReviewOptions(hostile)).toThrow(
        "Offline evidence review failed.",
      );
    }
  });

  it("admits only matching stable pathname and descriptor snapshots", () => {
    const maximumBytes = 1_048_576;
    const descriptor = {
      ctimeMs: 100,
      dev: 1,
      ino: 2,
      isFile: () => true,
      mtimeMs: 200,
      size: 3,
    };
    const pathSnapshot = {
      ...descriptor,
      isSymbolicLink: () => false,
    };
    const allowed = (
      overrides: {
        bytesRead?: number;
        descriptorAfter?: typeof descriptor;
        descriptorBefore?: typeof descriptor;
        maximumBytes?: number;
        pathAfter?: typeof pathSnapshot;
        pathBefore?: typeof pathSnapshot;
      } = {},
    ) =>
      isFilingParserEvidenceFileReadSnapshotAllowed(
        overrides.pathBefore ?? pathSnapshot,
        overrides.descriptorBefore ?? descriptor,
        overrides.descriptorAfter ?? descriptor,
        overrides.pathAfter ?? pathSnapshot,
        overrides.bytesRead ?? descriptor.size,
        overrides.maximumBytes ?? maximumBytes,
      );
    expect(allowed()).toBe(true);

    for (const pathBefore of [
      { ...pathSnapshot, isFile: () => false },
      { ...pathSnapshot, isSymbolicLink: () => true },
      { ...pathSnapshot, size: 1 },
      { ...pathSnapshot, size: maximumBytes + 1 },
      { ...pathSnapshot, size: Number.NaN },
    ])
      expect(allowed({ pathBefore })).toBe(false);

    for (const pathAfter of [
      { ...pathSnapshot, isFile: () => false },
      { ...pathSnapshot, isSymbolicLink: () => true },
    ])
      expect(allowed({ pathAfter })).toBe(false);

    const mismatches = [
      { size: descriptor.size + 1 },
      { size: descriptor.size - 1 },
      { dev: descriptor.dev + 1 },
      { ino: descriptor.ino + 1 },
      { mtimeMs: descriptor.mtimeMs + 1 },
      { ctimeMs: descriptor.ctimeMs + 1 },
    ];
    for (const mismatch of mismatches) {
      expect(allowed({ pathBefore: { ...pathSnapshot, ...mismatch } })).toBe(
        false,
      );
      expect(
        allowed({ descriptorBefore: { ...descriptor, ...mismatch } }),
      ).toBe(false);
      expect(allowed({ descriptorAfter: { ...descriptor, ...mismatch } })).toBe(
        false,
      );
      expect(allowed({ pathAfter: { ...pathSnapshot, ...mismatch } })).toBe(
        false,
      );
    }

    expect(
      allowed({ descriptorBefore: { ...descriptor, isFile: () => false } }),
    ).toBe(false);
    expect(
      allowed({ descriptorAfter: { ...descriptor, isFile: () => false } }),
    ).toBe(false);
    expect(allowed({ bytesRead: descriptor.size + 1 })).toBe(false);
    expect(allowed({ bytesRead: descriptor.size - 1 })).toBe(false);
    for (const invalidMaximum of [
      1,
      descriptor.size - 1,
      2.5,
      Number.NaN,
      Number.MAX_SAFE_INTEGER + 1,
    ])
      expect(allowed({ maximumBytes: invalidMaximum })).toBe(false);
  });

  it.runIf(process.platform !== "win32")(
    "rejects a final-component symbolic link",
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "filing-evidence-test-"));
      temporaryDirectories.push(directory);
      const evidencePath = join(directory, "evidence.json");
      await symlink("missing.json", evidencePath, "file");

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
    },
  );

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
