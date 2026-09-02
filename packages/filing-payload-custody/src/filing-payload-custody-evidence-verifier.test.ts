import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  decodeCycle2cAbsoluteGitPath,
  decodeCycle2cGitNulList,
  gitArgumentsWithoutReplacementObjects,
  gitEnvironmentWithoutGrafts,
  hasNonEmptyStderr,
  isAuthenticatedReplayMaintenanceBaselineMergeBaseAllowed,
  isAuthenticatedReplayMaintenanceCommitDiffSetAllowed,
  isAuthenticatedReplayMaintenanceSurfaceRoutingRequired,
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
  isCycle2iBaselineMergeBaseAllowed,
  isCycle2iCommitDiffSetAllowed,
  isCycle2iHandoffTreeAllowed,
  isCycle2iTransitionRoutingRequired,
  isCycle2jAcceptanceTreeAllowed,
  isCycle2jBaselineMergeBaseAllowed,
  isCycle2jCommitDiffSetAllowed,
  isCycle2jCoreTreeAllowed,
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
  isCycle2mCorrectiveCommitDiffSetAllowed,
  isCycle2mCorrectiveTopologyAllowed,
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
  isCycle2pCorrectiveCommitDiffSetAllowed,
  isCycle2pCorrectiveTopologyAllowed,
  isCycle2pCorpusAdmissionBlobAllowed,
  isCycle2pCumulativeDiffSetAllowed,
  isCycle2pDirectChildAllowed,
  isCycle2pHistoricalChainAllowed,
  isCycle2pHistoricalCorrectiveDiffSetAllowed,
  isCycle2pHistoricalDiffSetAllowed,
  isCycle2pHistoricalSourceDiffSetAllowed,
  isCycle2pTransitionRoutingRequired,
  isCycle2qBaselineMergeBaseAllowed,
  isCycle2qCommitDiffSetAllowed,
  isCycle2qDirectChildAllowed,
  isCycle2qTransitionRoutingRequired,
  isCycle2rBaselineMergeBaseAllowed,
  isCycle2rCommitDiffSetAllowed,
  isCycle2rDirectChildAllowed,
  isCycle2rTransitionRoutingRequired,
  isCycle2sBaselineMergeBaseAllowed,
  isCycle2sCommitDiffSetAllowed,
  isCycle2sDirectChildAllowed,
  isCycle2sTransitionRoutingRequired,
  isCycle2uBaselineMergeBaseAllowed,
  isCycle2uCommitDiffSetAllowed,
  isCycle2uDirectChildAllowed,
  isCycle2uTransitionRoutingRequired,
  isCycle3aSourceCommitDiffSetAllowed,
  isCycle3aSourceTopologyAllowed,
  isCycle3aPromotionCommitDiffSetAllowed,
  isCycle3aPromotionTopologyAllowed,
  isCycle3aTransitionRoutingRequired,
  isCycle3bCorrectiveCommitDiffSetAllowed,
  isCycle3bCorrectiveTopologyAllowed,
  isCycle3bSourceCommitDiffSetAllowed,
  isCycle3bSourceTopologyAllowed,
  isCycle3bTransitionRoutingRequired,
  isCycle3cRoutingClosureCommitDiffSetAllowed,
  isCycle3cRoutingClosureTopologyAllowed,
  isCycle3cSourceCommitDiffSetAllowed,
  isCycle3cSourceTopologyAllowed,
  isCycle3cTransitionRoutingRequired,
  isCycle3c3dPublicPromotionCommitDiffSetAllowed,
  isCycle3c3dPublicPromotionTopologyAllowed,
  isCycle3dAclCorrectiveCommitDiffSetAllowed,
  isCycle3dAclCorrectiveTopologyAllowed,
  isCycle3dApiWindowsFixtureStabilizationCommitDiffSetAllowed,
  isCycle3dApiWindowsFixtureStabilizationRoutingClosureCommitDiffSetAllowed,
  isCycle3dApiWindowsFixtureStabilizationRoutingClosureTopologyAllowed,
  isCycle3dApiWindowsFixtureStabilizationTopologyAllowed,
  isCycle3dCorrectiveRoutingClosureCommitDiffSetAllowed,
  isCycle3dCorrectiveRoutingClosureTopologyAllowed,
  isCycle3dRoutingClosureCommitDiffSetAllowed,
  isCycle3dRoutingClosureTopologyAllowed,
  isCycle3dSourceCommitDiffSetAllowed,
  isCycle3dSourceTopologyAllowed,
  isCycle3dStabilizationRoutingClosureCommitDiffSetAllowed,
  isCycle3dStabilizationRoutingClosureTopologyAllowed,
  isCycle3dTransitionRoutingRequired,
  isCycle3dWindowsCiStabilizationCommitDiffSetAllowed,
  isCycle3dWindowsCiStabilizationTopologyAllowed,
  isCycle3dWindowsParserTimeoutStabilizationCommitDiffSetAllowed,
  isCycle3dWindowsParserTimeoutStabilizationRoutingClosureCommitDiffSetAllowed,
  isCycle3dWindowsParserTimeoutStabilizationRoutingClosureTopologyAllowed,
  isCycle3dWindowsParserTimeoutStabilizationTopologyAllowed,
  isCycle3eaCanonicalTempFixtureStabilizationCommitDiffSetAllowed,
  isCycle3eaCanonicalTempFixtureStabilizationTopologyAllowed,
  isCycle3eaRoutingClosureCommitDiffSetAllowed,
  isCycle3eaRoutingClosureTopologyAllowed,
  isCycle3eaSourceCommitDiffSetAllowed,
  isCycle3eaSourceTopologyAllowed,
  isCycle3eaSyntheticBenchmarkTimeoutStabilizationCommitDiffSetAllowed,
  isCycle3eaSyntheticBenchmarkTimeoutStabilizationTopologyAllowed,
  isCycle3eaTransitionRoutingRequired,
  isCycle3eaWindowsStableFileStabilizationCommitDiffSetAllowed,
  isCycle3eaWindowsStableFileStabilizationTopologyAllowed,
  isCycle3eaWindowsSnapshotMetadataStabilizationCommitDiffSetAllowed,
  isCycle3eaWindowsSnapshotMetadataStabilizationTopologyAllowed,
  isCycle3eaWorkflowExpressionStabilizationCommitDiffSetAllowed,
  isCycle3eaWorkflowExpressionStabilizationTopologyAllowed,
  isCycle2zBaselineMergeBaseAllowed,
  isCycle2zCommitBoundaryCorrectiveDiffSetAllowed,
  isCycle2zCommitDiffSetAllowed,
  isCycle2zCorrectiveCommitDiffSetAllowed,
  isCycle2zCorrectiveTopologyAllowed,
  isCycle2zDirectChildAllowed,
  isCycle2zMaintenanceTopologyAllowed,
  isCycle2zPromotionCommitDiffSetAllowed,
  isCycle2zRoadmapRebaselineCommitDiffSetAllowed,
  isCycle2zRoadmapRebaselineTopologyAllowed,
  isCycle2zTransitionRoutingRequired,
  isCycle2zUbuntuCiStabilizationCommitDiffSetAllowed,
  isCycle2zUbuntuCiStabilizationTopologyAllowed,
  isCycle2zWindowsTimeoutStabilizationCommitDiffSetAllowed,
  isCycle2xBaselineMergeBaseAllowed,
  isCycle2xCommitDiffSetAllowed,
  isCycle2xCorrectiveChainAllowed,
  isCycle2xCorrectiveCumulativeDiffSetAllowed,
  isCycle2xDirectChildAllowed,
  isCycle2xRoutingClosureCommitDiffSetAllowed,
  isCycle2xTransitionRoutingRequired,
  isCycle2xValidatorIsolationCommitDiffSetAllowed,
  isCycle2wBaselineMergeBaseAllowed,
  isCycle2wCommitDiffSetAllowed,
  isCycle2wDirectChildAllowed,
  isCycle2wTransitionRoutingRequired,
  isCycle2vBaselineMergeBaseAllowed,
  isCycle2vCommitDiffSetAllowed,
  isCycle2vDirectChildAllowed,
  isCycle2vTransitionRoutingRequired,
  isCiTestSerializationBaselineMergeBaseAllowed,
  isCiTestSerializationCommitDiffSetAllowed,
  isCiTestSerializationSurfaceRoutingRequired,
  isFastify5121MaintenanceBaselineMergeBaseAllowed,
  isFastify5121MaintenanceCommitDiffSetAllowed,
  isFastify5121MaintenanceTransitionRoutingRequired,
  isGitProcessResultAllowed,
  isEmptyGitGraftsSnapshotAllowed,
  isOfflineEvidenceInputCustodyBaselineMergeBaseAllowed,
  isOfflineEvidenceInputCustodyCommitDiffSetAllowed,
  isOfflineEvidenceInputCustodySurfaceRoutingRequired,
  isPnpmDependencyPolicyMaintenanceBaselineMergeBaseAllowed,
  isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed,
  isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired,
  isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired,
  readSmallRegularFile,
  readSmallRegularFileWithOperations,
  type SmallRegularFileOperations,
  type SmallRegularFileStat,
  verifyNoEffectiveGitGrafts,
  verifyFilingPayloadCustodyEvidenceOffline,
} from "./filing-payload-custody-evidence-verifier";

const temporaryDirectories: string[] = [];
const HASH = `sha256:${"a".repeat(64)}` as const;
const CYCLE_2N_BASELINE_REVISION =
  "09e76235b5683427f2dd3201aefa740bb5adb16e" as const;
const CYCLE_2O_BASELINE_REVISION =
  "711fe866594d5e20a657a24c0a0c72fd78ab90be" as const;
const CYCLE_2O_SOURCE_REVISION =
  "46408ec875755ef531c124846143e9b619c1961f" as const;
const CYCLE_2P_BASELINE_REVISION =
  "e21408acf70a28909136cc3eb0c10bbbd48b8266" as const;
const CYCLE_2P_SOURCE_REVISION =
  "bc4b371784711102462ad28a9c9eb7cb567f1072" as const;
const CYCLE_2P_HISTORICAL_BASELINE_REVISION =
  "7243f16df0c4bd8691ff11fa037085e3beb3447e" as const;
const CYCLE_2P_HISTORICAL_SOURCE_REVISION =
  "96b042669edc6cb4a876bb0c061fa5e18732c1ca" as const;
const CYCLE_2P_HISTORICAL_CORRECTIVE_REVISION =
  "711fe866594d5e20a657a24c0a0c72fd78ab90be" as const;
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
const CYCLE_2P_CORRECTIVE_TRANSITION = [
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
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
const CYCLE_2P_CUMULATIVE_TRANSITION = [
  ...new Set([
    ...CYCLE_2P_TRANSITION.map((entry) => entry.path),
    ...CYCLE_2P_CORRECTIVE_TRANSITION.map((entry) => entry.path),
  ]),
]
  .sort()
  .map((path) => ({ path, status: "M" }));
const CYCLE_2P_HISTORICAL_SOURCE_TRANSITION = [
  "packages/filing-parser/src/corpus-admission-security.test.ts",
  "packages/filing-parser/src/corpus-admission.ts",
]
  .sort()
  .map((path) => ({ path, status: "M" }));
const CYCLE_2P_HISTORICAL_CORRECTIVE_TRANSITION = [
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
]
  .sort()
  .map((path) => ({ path, status: "M" }));
const CYCLE_2P_HISTORICAL_TRANSITION = [
  ...CYCLE_2P_HISTORICAL_SOURCE_TRANSITION,
  ...CYCLE_2P_HISTORICAL_CORRECTIVE_TRANSITION,
].sort((left, right) => left.path.localeCompare(right.path));
const CYCLE_2Q_BASELINE_REVISION =
  "2f0534d2a5b4206221cc66ece5e03cf529e5d373" as const;
const CYCLE_2Q_SOURCE_TRANSITION = [
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
  { path: "packages/personal-filing-corpus/package.json", status: "A" },
  { path: "packages/personal-filing-corpus/src/index.ts", status: "A" },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-corpus-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-corpus.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-corpus.ts",
    status: "A",
  },
  { path: "packages/personal-filing-corpus/tsconfig.json", status: "A" },
  { path: "pnpm-lock.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const CYCLE_2Q_PROTECTED_SURFACE_PATHS = [
  ...CYCLE_2Q_SOURCE_TRANSITION.map(({ path }) => path),
  CYCLE_2P_CORPUS_ADMISSION_PATH,
];
const CYCLE_2R_BASELINE_REVISION =
  "436f7fed6af9efaec21a26e5709b90073610384e" as const;
const CYCLE_2R_SOURCE_TRANSITION = [
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
  { path: "packages/personal-filing-corpus/src/index.ts", status: "M" },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-identity-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-identity.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-identity.ts",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const CYCLE_2R_PROTECTED_SURFACE_PATHS = [
  ...CYCLE_2R_SOURCE_TRANSITION.map(({ path }) => path),
  CYCLE_2P_CORPUS_ADMISSION_PATH,
  "packages/personal-filing-corpus/package.json",
  "packages/personal-filing-corpus/src/personal-filing-corpus-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.ts",
  "packages/personal-filing-corpus/tsconfig.json",
];
const CYCLE_2S_BASELINE_REVISION =
  "a13b51d2cd6862029aa598829e40209ce178c7be" as const;
const CYCLE_2S_SOURCE_TRANSITION = [
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
  { path: "packages/personal-filing-corpus/src/index.ts", status: "M" },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-custody-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-custody.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-custody.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-identity-security.test.ts",
    status: "M",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const CYCLE_2S_PROTECTED_SURFACE_PATHS = [
  ...CYCLE_2S_SOURCE_TRANSITION.map(({ path }) => path),
  CYCLE_2P_CORPUS_ADMISSION_PATH,
  "packages/personal-filing-corpus/package.json",
  "packages/personal-filing-corpus/src/personal-filing-corpus-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-identity.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-identity.ts",
  "packages/personal-filing-corpus/tsconfig.json",
];
const CYCLE_2U_BASELINE_REVISION =
  "39f0ce974f84e278ec9d12193b284876c928110e" as const;
const CYCLE_2U_SOURCE_TRANSITION = [
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
  { path: "packages/personal-filing-corpus/src/index.ts", status: "M" },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-fact-normalization-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-fact-normalization.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-fact-normalization.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-identity-security.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-filing-corpus/src/test-personal-filing-fact-builder.ts",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const CYCLE_2U_PROTECTED_SURFACE_PATHS = [
  ...CYCLE_2U_SOURCE_TRANSITION.map(({ path }) => path),
  CYCLE_2P_CORPUS_ADMISSION_PATH,
  "packages/personal-filing-corpus/package.json",
  "packages/personal-filing-corpus/src/personal-filing-corpus-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-custody-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-custody.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-custody.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-identity.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-identity.ts",
  "packages/personal-filing-corpus/tsconfig.json",
];
const CYCLE_2V_BASELINE_REVISION =
  "90c20e6eeb6c387015af81f74ba4b8e7aebc444b" as const;
const CYCLE_2V_SOURCE_TRANSITION = [
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
  { path: "packages/personal-filing-corpus/src/index.ts", status: "M" },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-fact-comparison-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-fact-comparison.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-fact-comparison.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-identity-security.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-filing-corpus/src/test-personal-filing-fact-comparison-builder.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/validator/personal_filing_fact_validator.py",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const CYCLE_2V_PROTECTED_SURFACE_PATHS = [
  ...CYCLE_2V_SOURCE_TRANSITION.map(({ path }) => path),
  CYCLE_2P_CORPUS_ADMISSION_PATH,
  "packages/personal-filing-corpus/package.json",
  "packages/personal-filing-corpus/src/personal-filing-corpus-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.ts",
  "packages/personal-filing-corpus/src/personal-filing-fact-normalization-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-fact-normalization.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-fact-normalization.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-custody-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-custody.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-custody.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-identity.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-identity.ts",
  "packages/personal-filing-corpus/src/test-personal-filing-fact-builder.ts",
  "packages/personal-filing-corpus/tsconfig.json",
];
const CYCLE_2W_BASELINE_REVISION =
  "ad5e3003d3670c84021dabe47c4fb3976274bb23" as const;
const CYCLE_2W_SOURCE_TRANSITION = [
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
  { path: "packages/personal-filing-corpus/src/index.ts", status: "M" },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-identity-security.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-raw-fact-extraction-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-raw-fact-extraction.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-raw-fact-extraction.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/test-personal-filing-raw-fact-extraction-builder.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/validator/personal_filing_raw_fact_extractor.py",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_2W_PROTECTED_SURFACE_PATHS = [
  ...CYCLE_2V_PROTECTED_SURFACE_PATHS,
  "packages/personal-filing-corpus/src/personal-filing-raw-fact-extraction-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-raw-fact-extraction.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-raw-fact-extraction.ts",
  "packages/personal-filing-corpus/src/test-personal-filing-raw-fact-extraction-builder.ts",
  "packages/personal-filing-corpus/validator/personal_filing_raw_fact_extractor.py",
];
const CYCLE_2X_BASELINE_REVISION =
  "716a3f6b7ad5a43c48a6a61d18b59c2cd5645018" as const;
const CYCLE_2X_SOURCE_REVISION =
  "c0138a3121361fc06f210e42febe6af4c6fa3e13" as const;
const CYCLE_2X_VALIDATOR_ISOLATION_REVISION =
  "7f7163d4673360645e332d0b7d28467c15656f8a" as const;
const CYCLE_2X_SOURCE_TRANSITION = [
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
  { path: "packages/personal-filing-corpus/src/index.ts", status: "M" },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-identity-security.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-quality-measurement-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-quality-measurement.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-quality-measurement.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/test-personal-filing-quality-measurement-builder.ts",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_2X_VALIDATOR_ISOLATION_TRANSITION = [
  {
    path: "packages/personal-filing-corpus/src/personal-filing-fact-comparison.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-fact-comparison.ts",
    status: "M",
  },
  {
    path: "packages/personal-filing-corpus/src/test-personal-filing-fact-comparison-builder.ts",
    status: "M",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_2X_ROUTING_CLOSURE_TRANSITION = [
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
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_2X_CORRECTIVE_CUMULATIVE_TRANSITION = [
  ...CYCLE_2X_SOURCE_TRANSITION,
  ...CYCLE_2X_VALIDATOR_ISOLATION_TRANSITION.filter(
    (entry) =>
      !CYCLE_2X_SOURCE_TRANSITION.some(
        (sourceEntry) => sourceEntry.path === entry.path,
      ),
  ),
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_2X_PROTECTED_SURFACE_PATHS = [
  ...CYCLE_2W_PROTECTED_SURFACE_PATHS,
  "packages/personal-filing-corpus/src/personal-filing-quality-measurement-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-quality-measurement.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-quality-measurement.ts",
  "packages/personal-filing-corpus/src/test-personal-filing-quality-measurement-builder.ts",
];
const CYCLE_2Z_BASELINE_REVISION =
  "62c01dafe305ddd43c75688e0225163b3abdf6df" as const;
const CYCLE_2Z_SOURCE_REVISION =
  "e64924bc091bfc7a3e071e7db746910e082051c4" as const;
const CYCLE_2Z_ROUTING_CLOSURE_REVISION =
  "e76eeca112949f58e7e6e4ed57bcc0ab7e102d66" as const;
const CYCLE_2Z_PROMOTION_REVISION =
  "325e7d9a1fe38195099899dc9b9498e504cabbe9" as const;
const CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION =
  "c215166dbc5f1a87ae67a7c6a76b93308359dcbb" as const;
const CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION =
  "879a03759493158f20f579d1efc2e3d337de4385" as const;
const CYCLE_2Z_ROADMAP_REBASELINE_REVISION =
  "4c660188831b91111a45d588245cb8735b8858ab" as const;
const CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION =
  "dd7fb5ea0b5c288f4337793dd6ddcb314f8b41f3" as const;
const CYCLE_3A_SOURCE_REVISION =
  "ee023b9cf7cf43fd63baa9b531ae71cc34f349e1" as const;
const CYCLE_3A_PROMOTION_REVISION =
  "3b7f9c10639e3fc7086fe2c162d4a88827216188" as const;
const CYCLE_3B_SOURCE_REVISION =
  "8755cb81e3202136a52cb1eccb75aa1c1602eeba" as const;
const CYCLE_3B_CORRECTIVE_REVISION =
  "074c65ba5b9912230891d030236d634f4f36a2ac" as const;
const CYCLE_3C_SOURCE_REVISION =
  "4e9f011434382ccaae66f396fd5b163e4c0fc6be" as const;
const CYCLE_3C_ROUTING_CLOSURE_REVISION =
  "86e712574a5eee4e9f636c25ebd5d6fb70f20581" as const;
const CYCLE_3D_SOURCE_REVISION =
  "520fb9f860600c699b9a5a6fee940bc3e1cb185c" as const;
const CYCLE_3D_ROUTING_CLOSURE_REVISION =
  "1c831d59cf1558e1b63c9031c598825349bcd516" as const;
const CYCLE_3D_ACL_CORRECTIVE_REVISION =
  "5041b396f4cc89652b01f896ff9f69531cc2cb7e" as const;
const CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION =
  "a8fe1518484a4d0d8962a8318f4e0baaec0b9d36" as const;
const CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION =
  "c329b081019ac61fb857dc8f709315b3ae497398" as const;
const CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION =
  "fa5d31a0c1bc5f37e7b7f869cc8a888bd1f74021" as const;
const CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION =
  "0228e253f5173fc5d8b73d00f5abbf486107999d" as const;
const CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_REVISION =
  "3982631bb87c209044078e47bb1bec9c738a4fee" as const;
const CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_REVISION =
  "33e7ca938f19df4ec1e738b19c884860ee85fc7e" as const;
const CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_ROUTING_CLOSURE_REVISION =
  "3edb5464a3414313a980ffd9fecce5ca5257084a" as const;
const CYCLE_3C_3D_PUBLIC_PROMOTION_REVISION =
  "1d15cc11be8322a05120783defce8112ac3c84da" as const;
const CYCLE_3E_A_SOURCE_REVISION =
  "5186103977b906d3c035599b3b2b00793926fca3" as const;
const CYCLE_3E_A_ROUTING_CLOSURE_REVISION =
  "14874709bffc24155f459f790ee34ac27c50eb2c" as const;
const CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_REVISION =
  "88124260e727c67018dca4417c1b8d471ae50d4f" as const;
const CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_REVISION =
  "04cd7793694c1e59f91d17a7a3501b37c95b43d2" as const;
const CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION =
  "9053de8c7ef10dcf05267f0b4b30907fab9d7271" as const;
const CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION =
  "543a0bd806d02e9e527be243f4dd98dc1c17c3c9" as const;
const CYCLE_2Z_SOURCE_TRANSITION = [
  { path: ".gitignore", status: "M" },
  { path: "README.md", status: "M" },
  { path: "apps/api/package.json", status: "M" },
  { path: "apps/api/src/api-mode.test.ts", status: "M" },
  { path: "apps/api/src/api-mode.ts", status: "M" },
  { path: "apps/api/src/app.ts", status: "M" },
  { path: "apps/api/src/build-source-identity.test.ts", status: "A" },
  { path: "apps/api/src/build-source-identity.ts", status: "A" },
  { path: "apps/api/src/composition-root.ts", status: "M" },
  { path: "apps/api/src/copy-validators.ts", status: "A" },
  { path: "apps/api/src/personal-quality-readiness.ts", status: "M" },
  {
    path: "apps/api/src/personal-selected-fact-release.test.ts",
    status: "A",
  },
  { path: "apps/api/src/personal-selected-fact-release.ts", status: "A" },
  { path: "apps/api/src/personal-selected-fact-routes.ts", status: "A" },
  { path: "apps/api/src/server.ts", status: "M" },
  {
    path: "apps/api/src/test-personal-quality-readiness-builder.ts",
    status: "M",
  },
  {
    path: "apps/api/src/test-personal-selected-fact-release-builder.ts",
    status: "A",
  },
  { path: "apps/api/tsup.config.ts", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalFilingFacts.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalFilingFacts.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/ResearchWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/ResearchWorkspace.tsx",
    status: "M",
  },
  { path: "apps/web/src/lib/api.test.ts", status: "M" },
  { path: "apps/web/src/lib/api.ts", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2X_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2Y_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2Z_EXIT_MATRIX.md", status: "A" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md",
    status: "M",
  },
  {
    path: "docs/adr/0051-bounded-personal-quality-readiness-composition.md",
    status: "M",
  },
  {
    path: "docs/adr/0052-bounded-personal-owner-authorized-selected-fact-release.md",
    status: "A",
  },
  { path: "packages/contracts/openapi/openapi.yaml", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  { path: "packages/contracts/src/openapi.test.ts", status: "M" },
  { path: "packages/personal-filing-corpus/src/index.ts", status: "M" },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-identity-security.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-selected-fact-release.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-selected-fact-release.ts",
    status: "A",
  },
  { path: "pnpm-lock.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_2Z_CORRECTIVE_TRANSITION = [
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
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_2Z_PROMOTION_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2X_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2Y_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2Z_EXIT_MATRIX.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md",
    status: "M",
  },
  {
    path: "docs/adr/0051-bounded-personal-quality-readiness-composition.md",
    status: "M",
  },
  {
    path: "docs/adr/0052-bounded-personal-owner-authorized-selected-fact-release.md",
    status: "M",
  },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_TRANSITION = [
  {
    path: "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
    status: "M",
  },
  {
    path: "packages/db/tests/postgres-acceptance-evidence-review.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/payload-custody-security.test.ts",
    status: "M",
  },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
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
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_2Z_ROADMAP_REBASELINE_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "A" },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
    status: "M",
  },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_2Z_UBUNTU_CI_STABILIZATION_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  {
    path: "packages/filing-parser-custody-quality-composition/src/filing-parser-custody-quality-composition-security.test.ts",
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
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_3A_SOURCE_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  {
    path: ".github/workflows/filing-payload-custody-acceptance.yml",
    status: "M",
  },
  { path: "README.md", status: "M" },
  { path: "apps/api/src/app.ts", status: "M" },
  { path: "apps/api/src/composition-root.test.ts", status: "M" },
  { path: "apps/api/src/composition-root.ts", status: "M" },
  {
    path: "apps/api/src/personal-owner-session-routes.test.ts",
    status: "A",
  },
  { path: "apps/api/src/personal-owner-session-routes.ts", status: "A" },
  { path: "apps/api/src/personal-owner-session.test.ts", status: "A" },
  { path: "apps/api/src/personal-owner-session.ts", status: "A" },
  { path: "apps/api/src/personal-readiness-routes.test.ts", status: "M" },
  { path: "apps/api/src/personal-readiness-routes.ts", status: "M" },
  {
    path: "apps/api/src/personal-selected-fact-release.test.ts",
    status: "M",
  },
  { path: "apps/api/src/personal-selected-fact-routes.ts", status: "M" },
  { path: "apps/api/src/server.ts", status: "M" },
  {
    path: "apps/api/src/test-personal-owner-session-builder.ts",
    status: "A",
  },
  {
    path: "apps/api/src/test-personal-selected-fact-release-builder.ts",
    status: "M",
  },
  { path: "apps/web/app/globals.css", status: "M" },
  { path: "apps/web/app/research/[symbol]/page.tsx", status: "M" },
  {
    path: "apps/web/src/features/research/OwnerSessionPanel.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/OwnerSessionPanel.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/ResearchWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/ResearchWorkspace.tsx",
    status: "M",
  },
  { path: "apps/web/src/lib/api.test.ts", status: "M" },
  { path: "apps/web/src/lib/api.ts", status: "M" },
  {
    path: "apps/web/src/features/research/owner-session-lifecycle.test.ts",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/owner-session-lifecycle.ts",
    status: "A",
  },
  { path: "apps/web/src/lib/web-mode.test.ts", status: "A" },
  { path: "apps/web/src/lib/web-mode.ts", status: "A" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_3A_EXIT_MATRIX.md", status: "A" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  { path: "docs/adr/0053-personal-local-owner-session.md", status: "A" },
  { path: "packages/contracts/openapi/openapi.yaml", status: "M" },
  { path: "packages/contracts/src/openapi.test.ts", status: "M" },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
    status: "M",
  },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_3A_PROMOTION_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2X_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2Y_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2Z_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3A_EXIT_MATRIX.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md",
    status: "M",
  },
  {
    path: "docs/adr/0051-bounded-personal-quality-readiness-composition.md",
    status: "M",
  },
  {
    path: "docs/adr/0052-bounded-personal-owner-authorized-selected-fact-release.md",
    status: "M",
  },
  { path: "docs/adr/0053-personal-local-owner-session.md", status: "M" },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
    status: "M",
  },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_3B_SOURCE_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  {
    path: ".github/workflows/filing-payload-custody-acceptance.yml",
    status: "M",
  },
  { path: "README.md", status: "M" },
  { path: "apps/api/src/api-mode.test.ts", status: "M" },
  { path: "apps/api/src/api-mode.ts", status: "M" },
  { path: "apps/api/src/app.ts", status: "M" },
  { path: "apps/api/src/composition-root.ts", status: "M" },
  { path: "apps/api/src/personal-dossier-release.test.ts", status: "A" },
  { path: "apps/api/src/personal-dossier-release.ts", status: "A" },
  { path: "apps/api/src/personal-dossier-routes.ts", status: "A" },
  {
    path: "apps/api/src/test-personal-dossier-release-builder.ts",
    status: "A",
  },
  { path: "apps/web/app/globals.css", status: "M" },
  { path: "apps/web/app/page.tsx", status: "M" },
  { path: "apps/web/app/personal/page.tsx", status: "A" },
  { path: "apps/web/app/research/[symbol]/page.tsx", status: "M" },
  {
    path: "apps/web/src/features/research/OwnerSessionPanel.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/OwnerSessionPanel.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalDossier.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalDossier.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalResearchWorkspace.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalResearchWorkspace.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/test-personal-dossier-builder.ts",
    status: "A",
  },
  { path: "apps/web/src/lib/api.test.ts", status: "M" },
  { path: "apps/web/src/lib/api.ts", status: "M" },
  { path: "apps/web/src/lib/personal-api.ts", status: "A" },
  { path: "apps/web/src/lib/web-mode.test.ts", status: "M" },
  { path: "apps/web/src/lib/web-mode.ts", status: "M" },
  { path: "apps/web/src/research-page-mode.test.tsx", status: "A" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2X_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2Y_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2Z_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3A_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3B_EXIT_MATRIX.md", status: "A" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md",
    status: "M",
  },
  {
    path: "docs/adr/0051-bounded-personal-quality-readiness-composition.md",
    status: "M",
  },
  {
    path: "docs/adr/0052-bounded-personal-owner-authorized-selected-fact-release.md",
    status: "M",
  },
  { path: "docs/adr/0053-personal-local-owner-session.md", status: "M" },
  {
    path: "docs/adr/0054-authenticated-personal-dossier-composition.md",
    status: "A",
  },
  { path: "packages/contracts/openapi/openapi.yaml", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  { path: "packages/contracts/src/openapi.test.ts", status: "M" },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
    status: "M",
  },
  { path: "packages/personal-filing-corpus/src/index.ts", status: "M" },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-dossier-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-dossier.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-dossier.ts",
    status: "A",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-payload-identity-security.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-quality-measurement.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-filing-corpus/src/personal-filing-quality-measurement.ts",
    status: "M",
  },
  {
    path: "packages/personal-filing-corpus/src/test-personal-filing-dossier-builder.ts",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_3B_CORRECTIVE_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-acceptance.yml",
    status: "M",
  },
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  {
    path: ".github/workflows/filing-payload-custody-acceptance.yml",
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
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
const CYCLE_3C_SOURCE_TRANSITION = [
  ["README.md", "M"],
  ["apps/api/package.json", "M"],
  ["apps/api/src/api-mode.test.ts", "M"],
  ["apps/api/src/api-mode.ts", "M"],
  ["apps/api/src/composition-root.test.ts", "M"],
  ["apps/api/src/composition-root.ts", "M"],
  ["apps/api/src/connected-app.ts", "A"],
  ["apps/api/src/connected-composition-root.test.ts", "A"],
  ["apps/api/src/connected-composition-root.ts", "A"],
  ["apps/api/src/connected-server.ts", "A"],
  ["apps/api/src/connected-source-policy-composition.test.ts", "A"],
  ["apps/api/src/connected-source-policy-composition.ts", "A"],
  ["apps/api/src/connected-source-policy-routes.test.ts", "A"],
  ["apps/api/src/connected-source-policy-routes.ts", "A"],
  ["apps/api/src/connected-static-graph.test.ts", "A"],
  ["apps/api/src/personal-owner-session-routes.ts", "M"],
  ["apps/api/src/personal-owner-session.ts", "M"],
  ["apps/api/src/test-connected-source-policy-builder.ts", "A"],
  ["apps/api/tsup.config.ts", "M"],
  ["docs/BUILD_ROADMAP.md", "M"],
  ["docs/CANONICAL_MODEL.md", "M"],
  ["docs/CYCLE_2X_EXIT_MATRIX.md", "M"],
  ["docs/CYCLE_2Y_EXIT_MATRIX.md", "M"],
  ["docs/CYCLE_2Z_EXIT_MATRIX.md", "M"],
  ["docs/CYCLE_3A_EXIT_MATRIX.md", "M"],
  ["docs/CYCLE_3B_EXIT_MATRIX.md", "M"],
  ["docs/CYCLE_3C_EXIT_MATRIX.md", "A"],
  ["docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", "M"],
  ["docs/THREAT_MODEL.md", "M"],
  [
    "docs/adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md",
    "M",
  ],
  ["docs/adr/0051-bounded-personal-quality-readiness-composition.md", "M"],
  [
    "docs/adr/0052-bounded-personal-owner-authorized-selected-fact-release.md",
    "M",
  ],
  ["docs/adr/0053-personal-local-owner-session.md", "M"],
  ["docs/adr/0054-authenticated-personal-dossier-composition.md", "M"],
  ["docs/adr/0055-connected-personal-source-policy-registry.md", "A"],
  ["packages/connected-source-policy/package.json", "A"],
  [
    "packages/connected-source-policy/src/connected-source-policy-security.test.ts",
    "A",
  ],
  ["packages/connected-source-policy/src/connected-source-policy.test.ts", "A"],
  ["packages/connected-source-policy/src/connected-source-policy.ts", "A"],
  ["packages/connected-source-policy/src/index.ts", "A"],
  [
    "packages/connected-source-policy/src/test-connected-source-policy-builder.ts",
    "A",
  ],
  ["packages/connected-source-policy/tsconfig.json", "A"],
  ["packages/contracts/openapi/openapi.yaml", "M"],
  ["packages/contracts/src/index.ts", "M"],
  ["packages/contracts/src/openapi.test.ts", "M"],
  ["pnpm-lock.yaml", "M"],
  ["scripts/verify-boundaries.ts", "M"],
].map(([path, status]) => ({ path: path!, status: status! }));
const CYCLE_3C_ROUTING_CLOSURE_TRANSITION = [...CYCLE_3B_CORRECTIVE_TRANSITION];
const CYCLE_3D_SOURCE_TRANSITION = [
  ["README.md", "M"],
  ["apps/api/package.json", "M"],
  ["apps/api/src/api-mode.test.ts", "M"],
  ["apps/api/src/api-mode.ts", "M"],
  ["apps/api/src/composition-root.test.ts", "M"],
  ["apps/api/src/composition-root.ts", "M"],
  ["apps/api/src/connected-composition-root.ts", "M"],
  ["apps/api/src/personal-owner-session-routes.ts", "M"],
  ["apps/api/src/personal-vault-routes.test.ts", "A"],
  ["apps/api/src/personal-vault-routes.ts", "A"],
  ["apps/api/src/vault-app.ts", "A"],
  ["apps/api/src/vault-composition-root.test.ts", "A"],
  ["apps/api/src/vault-composition-root.ts", "A"],
  ["apps/api/src/vault-server.ts", "A"],
  ["apps/api/src/vault-static-graph.test.ts", "A"],
  ["apps/api/tsup.config.ts", "M"],
  ["apps/web/app/layout.tsx", "M"],
  ["apps/web/src/features/research/LegacyLocalStateCleanup.tsx", "A"],
  ["apps/web/src/features/research/ThesisMonitor.tsx", "M"],
  ["apps/web/src/lib/legacy-local-state-cleanup.test.ts", "A"],
  ["apps/web/src/lib/legacy-local-state-cleanup.ts", "A"],
  ["apps/web/src/lib/local-state.ts", "D"],
  ["docs/BUILD_ROADMAP.md", "M"],
  ["docs/CANONICAL_MODEL.md", "M"],
  ["docs/CYCLE_2X_EXIT_MATRIX.md", "M"],
  ["docs/CYCLE_2Y_EXIT_MATRIX.md", "M"],
  ["docs/CYCLE_2Z_EXIT_MATRIX.md", "M"],
  ["docs/CYCLE_3A_EXIT_MATRIX.md", "M"],
  ["docs/CYCLE_3B_EXIT_MATRIX.md", "M"],
  ["docs/CYCLE_3C_EXIT_MATRIX.md", "M"],
  ["docs/CYCLE_3D_EXIT_MATRIX.md", "A"],
  ["docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", "M"],
  ["docs/THREAT_MODEL.md", "M"],
  [
    "docs/adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md",
    "M",
  ],
  ["docs/adr/0051-bounded-personal-quality-readiness-composition.md", "M"],
  [
    "docs/adr/0052-bounded-personal-owner-authorized-selected-fact-release.md",
    "M",
  ],
  ["docs/adr/0053-personal-local-owner-session.md", "M"],
  ["docs/adr/0054-authenticated-personal-dossier-composition.md", "M"],
  ["docs/adr/0055-connected-personal-source-policy-registry.md", "M"],
  ["docs/adr/0056-durable-personal-local-research-vault.md", "A"],
  [
    "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.test.ts",
    "M",
  ],
  ["packages/local-research-vault/package.json", "A"],
  ["packages/local-research-vault/src/canonical-json.ts", "A"],
  ["packages/local-research-vault/src/crash-recovery.test.ts", "A"],
  ["packages/local-research-vault/src/encrypted-vault-backup.test.ts", "A"],
  ["packages/local-research-vault/src/encrypted-vault-backup.ts", "A"],
  ["packages/local-research-vault/src/errors.ts", "A"],
  ["packages/local-research-vault/src/fixtures/cycle3d-crash-worker.ts", "A"],
  ["packages/local-research-vault/src/index.ts", "A"],
  ["packages/local-research-vault/src/local-research-vault.ts", "A"],
  ["packages/local-research-vault/src/local-vault-paths.test.ts", "A"],
  ["packages/local-research-vault/src/local-vault-paths.ts", "A"],
  ["packages/local-research-vault/src/model.ts", "A"],
  ["packages/local-research-vault/src/recovery-key-file.ts", "A"],
  [
    "packages/local-research-vault/src/sqlite-local-research-vault.test.ts",
    "A",
  ],
  ["packages/local-research-vault/src/sqlite-local-research-vault.ts", "A"],
  ["packages/local-research-vault/src/vault-crypto.ts", "A"],
  ["packages/local-research-vault/src/vault-schema.ts", "A"],
  ["packages/local-research-vault/src/windows-owner-only-acl.test.ts", "A"],
  ["packages/local-research-vault/src/windows-owner-only-acl.ts", "A"],
  ["packages/local-research-vault/tsconfig.json", "A"],
  ["pnpm-lock.yaml", "M"],
  ["scripts/verify-boundaries.ts", "M"],
].map(([path, status]) => ({ path: path!, status: status! }));
const CYCLE_3D_ROUTING_CLOSURE_TRANSITION = [
  ...CYCLE_3C_ROUTING_CLOSURE_TRANSITION,
];
const CYCLE_3D_ACL_CORRECTIVE_TRANSITION = [
  {
    path: "packages/local-research-vault/src/windows-owner-only-acl.test.ts",
    status: "M",
  },
  {
    path: "packages/local-research-vault/src/windows-owner-only-acl.ts",
    status: "M",
  },
];
const CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_TRANSITION = [
  ...CYCLE_3D_ROUTING_CLOSURE_TRANSITION,
];
const CYCLE_3D_WINDOWS_CI_STABILIZATION_TRANSITION = [
  {
    path: "packages/local-research-vault/src/encrypted-vault-backup.test.ts",
    status: "M",
  },
  {
    path: "packages/local-research-vault/src/sqlite-local-research-vault.test.ts",
    status: "M",
  },
];
const CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_TRANSITION = [
  ...CYCLE_3D_ROUTING_CLOSURE_TRANSITION,
];
const CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_TRANSITION = [
  { path: "apps/api/src/personal-vault-routes.test.ts", status: "M" },
  { path: "apps/api/src/vault-composition-root.test.ts", status: "M" },
];
const CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_TRANSITION = [
  ...CYCLE_3D_ROUTING_CLOSURE_TRANSITION,
];
const CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_TRANSITION = [
  {
    path: "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-parser/src/parser-boundary.test.ts",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
    status: "M",
  },
];
const CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_ROUTING_CLOSURE_TRANSITION =
  [...CYCLE_3D_ROUTING_CLOSURE_TRANSITION];
const CYCLE_3C_3D_PUBLIC_PROMOTION_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2X_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2Y_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2Z_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3A_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3B_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3C_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3D_EXIT_MATRIX.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md",
    status: "M",
  },
  {
    path: "docs/adr/0051-bounded-personal-quality-readiness-composition.md",
    status: "M",
  },
  {
    path: "docs/adr/0052-bounded-personal-owner-authorized-selected-fact-release.md",
    status: "M",
  },
  { path: "docs/adr/0053-personal-local-owner-session.md", status: "M" },
  {
    path: "docs/adr/0054-authenticated-personal-dossier-composition.md",
    status: "M",
  },
  {
    path: "docs/adr/0055-connected-personal-source-policy-registry.md",
    status: "M",
  },
  {
    path: "docs/adr/0056-durable-personal-local-research-vault.md",
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
];
const CYCLE_3E_A_SOURCE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/api/package.json", status: "M" },
  { path: "apps/api/src/api-mode.test.ts", status: "M" },
  { path: "apps/api/src/api-mode.ts", status: "M" },
  { path: "apps/api/src/composition-root.test.ts", status: "M" },
  { path: "apps/api/src/composition-root.ts", status: "M" },
  { path: "apps/api/src/connected-composition-root.test.ts", status: "M" },
  { path: "apps/api/src/connected-composition-root.ts", status: "M" },
  { path: "apps/api/src/personal-security-master-routes.test.ts", status: "A" },
  { path: "apps/api/src/personal-security-master-routes.ts", status: "A" },
  { path: "apps/api/src/security-master-app.ts", status: "A" },
  {
    path: "apps/api/src/security-master-composition-root.test.ts",
    status: "A",
  },
  { path: "apps/api/src/security-master-composition-root.ts", status: "A" },
  { path: "apps/api/src/security-master-server.ts", status: "A" },
  { path: "apps/api/src/security-master-static-graph.test.ts", status: "A" },
  {
    path: "apps/api/src/test-personal-security-master-builder.ts",
    status: "A",
  },
  { path: "apps/api/src/vault-composition-root.test.ts", status: "M" },
  { path: "apps/api/src/vault-composition-root.ts", status: "M" },
  { path: "apps/api/tsup.config.ts", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_2X_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2Y_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_2Z_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3A_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3B_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3C_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3D_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3E_A_EXIT_MATRIX.md", status: "A" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md",
    status: "M",
  },
  {
    path: "docs/adr/0051-bounded-personal-quality-readiness-composition.md",
    status: "M",
  },
  {
    path: "docs/adr/0052-bounded-personal-owner-authorized-selected-fact-release.md",
    status: "M",
  },
  { path: "docs/adr/0053-personal-local-owner-session.md", status: "M" },
  {
    path: "docs/adr/0054-authenticated-personal-dossier-composition.md",
    status: "M",
  },
  {
    path: "docs/adr/0055-connected-personal-source-policy-registry.md",
    status: "M",
  },
  {
    path: "docs/adr/0056-durable-personal-local-research-vault.md",
    status: "M",
  },
  {
    path: "docs/adr/0057-owner-local-security-master-snapshot-and-search.md",
    status: "A",
  },
  { path: "packages/contracts/openapi/openapi.yaml", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  { path: "packages/contracts/src/openapi.test.ts", status: "M" },
  { path: "packages/personal-security-master/package.json", status: "A" },
  { path: "packages/personal-security-master/src/index.ts", status: "A" },
  {
    path: "packages/personal-security-master/src/personal-security-master-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-security-master/src/personal-security-master.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-security-master/src/personal-security-master.ts",
    status: "A",
  },
  {
    path: "packages/personal-security-master/src/test-personal-security-master-builder.ts",
    status: "A",
  },
  { path: "packages/personal-security-master/tsconfig.json", status: "A" },
  { path: "pnpm-lock.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3E_A_ROUTING_CLOSURE_TRANSITION = [
  { path: ".github/workflows/filing-parser-acceptance.yml", status: "M" },
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  {
    path: ".github/workflows/filing-payload-custody-acceptance.yml",
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
];
const CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_TRANSITION = [
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
];
const CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_TRANSITION = [
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
  {
    path: "packages/personal-security-master/src/personal-security-master.test.ts",
    status: "M",
  },
];
const CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  {
    path: "apps/api/src/security-master-composition-root.test.ts",
    status: "M",
  },
  {
    path: "apps/api/src/security-master-composition-root.ts",
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
];
const CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_TRANSITION = [
  ...CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_TRANSITION,
];
const CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_TRANSITION = [
  ...CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_TRANSITION,
];

const CYCLE_2Z_PROTECTED_SURFACE_PATHS = [
  ...new Set([
    ...CYCLE_2X_PROTECTED_SURFACE_PATHS,
    ...CYCLE_2Z_SOURCE_TRANSITION.map((entry) => entry.path),
  ]),
].sort();
const CYCLE_3A_PROTECTED_SURFACE_PATHS = [
  ...new Set([
    ...CYCLE_2Z_PROTECTED_SURFACE_PATHS,
    ...CYCLE_3A_SOURCE_TRANSITION.map((entry) => entry.path),
    ...CYCLE_3A_PROMOTION_TRANSITION.map((entry) => entry.path),
  ]),
].sort();
const CYCLE_3B_PROTECTED_SURFACE_PATHS = [
  ...new Set([
    ...CYCLE_3A_PROTECTED_SURFACE_PATHS,
    ...CYCLE_3B_SOURCE_TRANSITION.map((entry) => entry.path),
    ...CYCLE_3B_CORRECTIVE_TRANSITION.map((entry) => entry.path),
  ]),
].sort();
const CYCLE_3C_PROTECTED_SURFACE_PATHS = [
  ...new Set([
    ...CYCLE_3B_PROTECTED_SURFACE_PATHS,
    ...CYCLE_3C_SOURCE_TRANSITION.map((entry) => entry.path),
    ...CYCLE_3C_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
  ]),
].sort();
const CYCLE_3D_PROTECTED_SURFACE_PATHS = [
  ...new Set([
    ...CYCLE_3C_PROTECTED_SURFACE_PATHS,
    ...CYCLE_3D_SOURCE_TRANSITION.map((entry) => entry.path),
    ...CYCLE_3D_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
    ...CYCLE_3D_ACL_CORRECTIVE_TRANSITION.map((entry) => entry.path),
    ...CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_TRANSITION.map(
      (entry) => entry.path,
    ),
    ...CYCLE_3D_WINDOWS_CI_STABILIZATION_TRANSITION.map((entry) => entry.path),
    ...CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_TRANSITION.map(
      (entry) => entry.path,
    ),
    ...CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_TRANSITION.map(
      (entry) => entry.path,
    ),
    ...CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_TRANSITION.map(
      (entry) => entry.path,
    ),
    ...CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_TRANSITION.map(
      (entry) => entry.path,
    ),
    ...CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_ROUTING_CLOSURE_TRANSITION.map(
      (entry) => entry.path,
    ),
    ...CYCLE_3C_3D_PUBLIC_PROMOTION_TRANSITION.map((entry) => entry.path),
  ]),
].sort();

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
const CYCLE_2I_HANDOFF_TREE = [
  "packages/filing-parser-normalization-handoff/package.json",
  "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff-security.test.ts",
  "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff.test.ts",
  "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff.ts",
  "packages/filing-parser-normalization-handoff/src/index.ts",
  "packages/filing-parser-normalization-handoff/src/test-filing-parser-normalization-handoff-builder.ts",
  "packages/filing-parser-normalization-handoff/tsconfig.json",
].sort();
const CYCLE_2J_CORE_TREE = [
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
  ...PACKAGE_TREE,
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
const FASTIFY_5_12_1_MAINTENANCE_BASELINE_REVISION =
  "0521bc8a1b0c3ba15d5ffc16fc74e45252bd9efd" as const;
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
const FASTIFY_5_12_1_MAINTENANCE_CUMULATIVE_DIFF_PATHS = [
  ...new Set([
    ...CYCLE_2H_CUMULATIVE_DIFF_PATHS,
    ...FASTIFY_5_12_1_MAINTENANCE_TRANSITION.map((entry) => entry.path),
  ]),
].sort();
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
  ...CYCLE_2J_CORE_TREE.map((path) => ({ path, status: "A" })),
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
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
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
].sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
);
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
] as const;
const CYCLE_2M_TRANSITION_PATHS = CYCLE_2M_TRANSITION.map(
  (entry) => entry.path,
);
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
const AUTHENTICATED_REPLAY_MAINTENANCE_SURFACE_PATH =
  "packages/filing-payload-custody/src/payload-custody.ts" as const;
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
    path: AUTHENTICATED_REPLAY_MAINTENANCE_SURFACE_PATH,
    status: "M",
  },
] as const;
const PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS = [
  ".gitignore",
  ".npmrc",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts/verify-boundaries.ts",
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
const PNPM_DEPENDENCY_POLICY_MAINTENANCE_CUMULATIVE_DIFF_PATHS = [
  ...new Set([
    ...FASTIFY_5_12_1_MAINTENANCE_CUMULATIVE_DIFF_PATHS,
    ...PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.map((entry) => entry.path),
  ]),
].sort();
const CYCLE_2I_CUMULATIVE_DIFF_PATHS = [
  ...new Set([
    ...PNPM_DEPENDENCY_POLICY_MAINTENANCE_CUMULATIVE_DIFF_PATHS,
    ...CYCLE_2I_TRANSITION_PATHS,
  ]),
].sort();
const CYCLE_2J_CUMULATIVE_DIFF_PATHS = [
  ...new Set([...CYCLE_2I_CUMULATIVE_DIFF_PATHS, ...CYCLE_2J_TRANSITION_PATHS]),
].sort();
const CYCLE_2K_CUMULATIVE_DIFF_PATHS = [
  ...new Set([...CYCLE_2J_CUMULATIVE_DIFF_PATHS, ...CYCLE_2K_TRANSITION_PATHS]),
].sort();
const CYCLE_2M_CUMULATIVE_DIFF_PATHS = [
  ...new Set([
    ...CYCLE_2K_CUMULATIVE_DIFF_PATHS,
    ...CYCLE_2M_PRE_BASELINE_CUMULATIVE_ENTRIES.map((entry) => entry.path),
    ...CYCLE_2M_TRANSITION_PATHS,
  ]),
].sort();
const CYCLE_2N_CUMULATIVE_DIFF_PATHS = [
  ...new Set([
    ...CYCLE_2M_CUMULATIVE_DIFF_PATHS,
    ...CYCLE_2N_TRANSITION.map((entry) => entry.path),
  ]),
].sort();

interface SmallFileStatOverrides {
  readonly ctimeMs?: number;
  readonly dev?: number;
  readonly file?: boolean;
  readonly ino?: number;
  readonly mtimeMs?: number;
  readonly size?: number;
  readonly symbolicLink?: boolean;
}

interface SmallFileHarnessOptions {
  readonly bytes?: Uint8Array;
  readonly descriptorStats?: readonly SmallRegularFileStat[];
  readonly noFollowFlag?: number | undefined;
  readonly pathStats?: readonly SmallRegularFileStat[];
  readonly readSteps?: readonly (number | "throw")[];
}

function smallFileStat(
  overrides: SmallFileStatOverrides = {},
): SmallRegularFileStat {
  const file = overrides.file ?? true;
  const symbolicLink = overrides.symbolicLink ?? false;
  return Object.freeze({
    ctimeMs: overrides.ctimeMs ?? 4,
    dev: overrides.dev ?? 1,
    ino: overrides.ino ?? 2,
    isFile: () => file,
    isSymbolicLink: () => symbolicLink,
    mtimeMs: overrides.mtimeMs ?? 3,
    size: overrides.size ?? 3,
  });
}

function smallFileHarness(options: SmallFileHarnessOptions = {}): {
  readonly observations: {
    closeCalls: number;
    lstatCalls: number;
    openFlags: number[];
    readCalls: number;
    statCalls: number;
  };
  readonly operations: SmallRegularFileOperations;
} {
  const bytes = options.bytes ?? new TextEncoder().encode("{}\n");
  const defaultStat = smallFileStat({ size: bytes.byteLength });
  const pathStats = options.pathStats ?? [defaultStat, defaultStat];
  const descriptorStats = options.descriptorStats ?? [defaultStat, defaultStat];
  const readSteps = options.readSteps ?? [];
  const observations = {
    closeCalls: 0,
    lstatCalls: 0,
    openFlags: [] as number[],
    readCalls: 0,
    statCalls: 0,
  };
  const nextStat = (
    values: readonly SmallRegularFileStat[],
    index: number,
  ): SmallRegularFileStat =>
    values[Math.min(index, values.length - 1)] ??
    (() => {
      throw new Error("missing deterministic stat");
    })();
  const operations: SmallRegularFileOperations = Object.freeze({
    lstat: () => {
      const result = nextStat(pathStats, observations.lstatCalls);
      observations.lstatCalls += 1;
      return Promise.resolve(result);
    },
    noFollowFlag: options.noFollowFlag,
    open: (_path: string, flags: number) => {
      observations.openFlags.push(flags);
      return Promise.resolve({
        close: () => {
          observations.closeCalls += 1;
          return Promise.resolve();
        },
        read: (
          buffer: Uint8Array,
          offset: number,
          length: number,
          position: number,
        ) => {
          const step = readSteps[observations.readCalls];
          observations.readCalls += 1;
          if (step === "throw")
            return Promise.reject(new Error("deterministic read failure"));
          const available = Math.max(0, bytes.byteLength - position);
          const bytesRead = step ?? Math.min(length, available);
          const copied = Math.min(bytesRead, length, available);
          if (copied > 0)
            buffer.set(bytes.subarray(position, position + copied), offset);
          return Promise.resolve({ bytesRead });
        },
        stat: () => {
          const result = nextStat(descriptorStats, observations.statCalls);
          observations.statCalls += 1;
          return Promise.resolve(result);
        },
      });
    },
    readOnlyFlag: 0x10,
  });
  return { observations, operations };
}

function gitOutput(
  args: readonly string[],
  environment: Readonly<NodeJS.ProcessEnv> = gitEnvironmentWithoutGrafts(
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
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("Cycle 2p admission-validity custody closure", () => {
  it("anchors the exact source and one exact Windows-identity corrective child", () => {
    const correction = "a".repeat(40);
    expect(isCycle2pBaselineMergeBaseAllowed(CYCLE_2P_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2pBaselineMergeBaseAllowed("0".repeat(40))).toBe(false);
    expect(isCycle2pBaselineMergeBaseAllowed(undefined)).toBe(false);

    expect(
      isCycle2pDirectChildAllowed(
        "1",
        "1",
        CYCLE_2P_SOURCE_REVISION,
        `${CYCLE_2P_SOURCE_REVISION} ${CYCLE_2P_BASELINE_REVISION}`,
      ),
    ).toBe(true);
    for (const values of [
      [
        "2",
        "1",
        CYCLE_2P_SOURCE_REVISION,
        `${CYCLE_2P_SOURCE_REVISION} ${CYCLE_2P_BASELINE_REVISION}`,
      ],
      [
        "1",
        "2",
        CYCLE_2P_SOURCE_REVISION,
        `${CYCLE_2P_SOURCE_REVISION} ${CYCLE_2P_BASELINE_REVISION}`,
      ],
      ["1", "1", correction, `${correction} ${CYCLE_2P_BASELINE_REVISION}`],
      [
        "1",
        "1",
        CYCLE_2P_BASELINE_REVISION,
        `${CYCLE_2P_BASELINE_REVISION} ${CYCLE_2P_BASELINE_REVISION}`,
      ],
      [
        "1",
        "1",
        "not-a-revision",
        `not-a-revision ${CYCLE_2P_BASELINE_REVISION}`,
      ],
      [
        "1",
        "1",
        CYCLE_2P_SOURCE_REVISION,
        `${CYCLE_2P_SOURCE_REVISION} ${"b".repeat(40)}`,
      ],
      [
        "1",
        "1",
        CYCLE_2P_SOURCE_REVISION,
        `${CYCLE_2P_SOURCE_REVISION} ${CYCLE_2P_BASELINE_REVISION} ${"b".repeat(40)}`,
      ],
    ] as const)
      expect(
        isCycle2pDirectChildAllowed(values[0], values[1], values[2], values[3]),
      ).toBe(false);

    const validCorrection = [
      "2",
      "2",
      correction,
      `${correction} ${CYCLE_2P_SOURCE_REVISION}`,
      `${CYCLE_2P_SOURCE_REVISION} ${CYCLE_2P_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2pCorrectiveTopologyAllowed(...validCorrection)).toBe(true);
    for (let index = 0; index < validCorrection.length; index += 1) {
      const mutated: string[] = [...validCorrection];
      mutated[index] =
        index < 2
          ? "1"
          : index === 2
            ? CYCLE_2P_SOURCE_REVISION
            : "0".repeat(40);
      expect(
        isCycle2pCorrectiveTopologyAllowed(
          ...(mutated as Parameters<typeof isCycle2pCorrectiveTopologyAllowed>),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2pCorrectiveTopologyAllowed(
        "2",
        "2",
        "not-a-revision",
        `not-a-revision ${CYCLE_2P_SOURCE_REVISION}`,
        `${CYCLE_2P_SOURCE_REVISION} ${CYCLE_2P_BASELINE_REVISION}`,
      ),
    ).toBe(false);
  });

  it("freezes the historical P1 source and corrective-child ancestry", () => {
    const valid = [
      CYCLE_2P_HISTORICAL_BASELINE_REVISION,
      "2",
      "2",
      `${CYCLE_2P_HISTORICAL_CORRECTIVE_REVISION} ${CYCLE_2P_HISTORICAL_SOURCE_REVISION}`,
      `${CYCLE_2P_HISTORICAL_SOURCE_REVISION} ${CYCLE_2P_HISTORICAL_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2pHistoricalChainAllowed(...valid)).toBe(true);
    for (let index = 0; index < valid.length; index += 1) {
      const mutated: string[] = [...valid];
      mutated[index] = index === 1 || index === 2 ? "1" : "0".repeat(40);
      expect(
        isCycle2pHistoricalChainAllowed(
          ...(mutated as Parameters<typeof isCycle2pHistoricalChainAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("routes every protected-surface intersection before Cycle 2o", () => {
    const transitionPaths = CYCLE_2P_CUMULATIVE_TRANSITION.map(
      (entry) => entry.path,
    );
    expect(isCycle2pTransitionRoutingRequired(transitionPaths)).toBe(true);
    for (const path of [
      ...transitionPaths,
      "packages/filing-parser/src/corpus-admission.ts",
    ])
      expect(isCycle2pTransitionRoutingRequired([path])).toBe(true);
    expect(
      isCycle2pTransitionRoutingRequired([...transitionPaths].reverse()),
    ).toBe(true);
    expect(
      isCycle2pTransitionRoutingRequired([
        transitionPaths[0] as string,
        transitionPaths[0] as string,
      ]),
    ).toBe(true);
    expect(
      isCycle2pTransitionRoutingRequired([
        "packages/unreviewed-before.ts",
        transitionPaths[0] as string,
        "packages/unreviewed-after.ts",
      ]),
    ).toBe(true);
    expect(
      isCycle2pTransitionRoutingRequired([
        "packages/filing-payload-custody/src/unreviewed.ts",
      ]),
    ).toBe(false);
    expect(isCycle2pTransitionRoutingRequired([])).toBe(false);
    expect(isCycle2pTransitionRoutingRequired(undefined)).toBe(false);
  });

  it("requires the exact current and historical transition tuples", () => {
    const cases = [
      [CYCLE_2P_TRANSITION, isCycle2pCommitDiffSetAllowed],
      [CYCLE_2P_CORRECTIVE_TRANSITION, isCycle2pCorrectiveCommitDiffSetAllowed],
      [CYCLE_2P_CUMULATIVE_TRANSITION, isCycle2pCumulativeDiffSetAllowed],
      [
        CYCLE_2P_HISTORICAL_SOURCE_TRANSITION,
        isCycle2pHistoricalSourceDiffSetAllowed,
      ],
      [
        CYCLE_2P_HISTORICAL_CORRECTIVE_TRANSITION,
        isCycle2pHistoricalCorrectiveDiffSetAllowed,
      ],
      [CYCLE_2P_HISTORICAL_TRANSITION, isCycle2pHistoricalDiffSetAllowed],
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
        isAllowed([...expected, { path: "unreviewed", status: "M" }]),
      ).toBe(false);
    }
  });

  it("pins both current and historical enterprise-admission blobs", () => {
    expect(
      isCycle2pCorpusAdmissionBlobAllowed(
        CYCLE_2P_CORPUS_ADMISSION_BLOB,
        CYCLE_2P_CORPUS_ADMISSION_BLOB,
      ),
    ).toBe(true);
    expect(
      isCycle2pCorpusAdmissionBlobAllowed(
        "a".repeat(40),
        CYCLE_2P_CORPUS_ADMISSION_BLOB,
      ),
    ).toBe(false);
    expect(
      isCycle2pCorpusAdmissionBlobAllowed(
        CYCLE_2P_CORPUS_ADMISSION_BLOB,
        "b".repeat(40),
      ),
    ).toBe(false);
    expect(isCycle2pCorpusAdmissionBlobAllowed(undefined, undefined)).toBe(
      false,
    );
  });
});

describe("Cycle 2q personal-use profile routing", () => {
  it("accepts only one direct child of the promoted Cycle 2p baseline", () => {
    expect(isCycle2qBaselineMergeBaseAllowed(CYCLE_2Q_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2qBaselineMergeBaseAllowed("0".repeat(40))).toBe(false);
    expect(isCycle2qBaselineMergeBaseAllowed(undefined)).toBe(false);

    const revision = "c".repeat(40);
    const valid = [
      "1",
      "1",
      revision,
      `${revision} ${CYCLE_2Q_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2qDirectChildAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "2";
      },
      (values: string[]) => {
        values[1] = "2";
      },
      (values: string[]) => {
        values[2] = CYCLE_2Q_BASELINE_REVISION;
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[3] = `${revision} ${"d".repeat(40)}`;
      },
      (values: string[]) => {
        values[3] += ` ${"e".repeat(40)}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2qDirectChildAllowed(
          ...(values as Parameters<typeof isCycle2qDirectChildAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("requires the exact sorted personal-use source transition", () => {
    expect(isCycle2qCommitDiffSetAllowed(CYCLE_2Q_SOURCE_TRANSITION)).toBe(
      true,
    );
    expect(
      isCycle2qCommitDiffSetAllowed([...CYCLE_2Q_SOURCE_TRANSITION].reverse()),
    ).toBe(false);
    for (const [index, entry] of CYCLE_2Q_SOURCE_TRANSITION.entries()) {
      expect(
        isCycle2qCommitDiffSetAllowed(
          CYCLE_2Q_SOURCE_TRANSITION.filter(
            (_, candidate) => candidate !== index,
          ),
        ),
        `missing:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2qCommitDiffSetAllowed([...CYCLE_2Q_SOURCE_TRANSITION, entry]),
        `duplicate:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2qCommitDiffSetAllowed(
          CYCLE_2Q_SOURCE_TRANSITION.map((candidate, candidateIndex) =>
            candidateIndex === index
              ? {
                  ...candidate,
                  status: candidate.status === "M" ? "A" : "M",
                }
              : candidate,
          ),
        ),
        `status:${entry.path}`,
      ).toBe(false);
    }
    expect(
      isCycle2qCommitDiffSetAllowed([
        ...CYCLE_2Q_SOURCE_TRANSITION,
        { path: "unreviewed", status: "A" },
      ]),
    ).toBe(false);
  });

  it("routes every personal or enterprise-admission surface before Cycle 2p", () => {
    expect(CYCLE_2Q_PROTECTED_SURFACE_PATHS).toHaveLength(14);
    expect(new Set(CYCLE_2Q_PROTECTED_SURFACE_PATHS).size).toBe(14);
    for (const path of CYCLE_2Q_PROTECTED_SURFACE_PATHS) {
      expect(isCycle2qTransitionRoutingRequired([path]), path).toBe(true);
      expect(
        isCycle2qTransitionRoutingRequired(["unreviewed", path]),
        path,
      ).toBe(true);
    }
    expect(isCycle2qTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2qTransitionRoutingRequired([])).toBe(false);
    expect(isCycle2qTransitionRoutingRequired(["unreviewed"])).toBe(false);
  });
});

describe("Cycle 2z selected-fact release routing", () => {
  it("accepts only the pinned source child of the promoted Cycle 2y baseline", () => {
    expect(isCycle2zBaselineMergeBaseAllowed(CYCLE_2Z_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2zBaselineMergeBaseAllowed("a".repeat(40))).toBe(false);
    expect(isCycle2zBaselineMergeBaseAllowed(undefined)).toBe(false);

    const valid = [
      "1",
      "1",
      CYCLE_2Z_SOURCE_REVISION,
      `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2zDirectChildAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "2";
      },
      (values: string[]) => {
        values[1] = "2";
      },
      (values: string[]) => {
        values[2] = CYCLE_2Z_BASELINE_REVISION;
      },
      (values: string[]) => {
        values[2] = "e".repeat(40);
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[3] = `${CYCLE_2Z_SOURCE_REVISION} ${"d".repeat(40)}`;
      },
      (values: string[]) => {
        values[3] += ` ${"f".repeat(40)}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2zDirectChildAllowed(
          ...(values as Parameters<typeof isCycle2zDirectChildAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("accepts only one direct corrective child of the pinned Cycle 2z source", () => {
    const revision = "e".repeat(40);
    const valid = [
      "2",
      "2",
      revision,
      `${revision} ${CYCLE_2Z_SOURCE_REVISION}`,
      `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2zCorrectiveTopologyAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "1";
      },
      (values: string[]) => {
        values[1] = "3";
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[2] = CYCLE_2Z_BASELINE_REVISION;
      },
      (values: string[]) => {
        values[2] = CYCLE_2Z_SOURCE_REVISION;
      },
      (values: string[]) => {
        values[3] = `${revision} ${CYCLE_2Z_BASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[3] += ` ${CYCLE_2Z_BASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[4] = `${CYCLE_2Z_SOURCE_REVISION} ${"d".repeat(40)}`;
      },
      (values: string[]) => {
        values[4] += ` ${CYCLE_2Z_BASELINE_REVISION}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2zCorrectiveTopologyAllowed(
          ...(values as Parameters<typeof isCycle2zCorrectiveTopologyAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("accepts only one direct maintenance child after the pinned promoted stabilization chain", () => {
    const revision = "f".repeat(40);
    const valid = [
      "5",
      "5",
      revision,
      `${revision} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`,
      `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`,
      `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2zMaintenanceTopologyAllowed(...valid)).toBe(true);

    for (const mutate of [
      (values: string[]) => {
        values[0] = "4";
      },
      (values: string[]) => {
        values[1] = "4";
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[2] = CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION;
      },
      (values: string[]) => {
        values[3] = `${revision} ${CYCLE_2Z_PROMOTION_REVISION}`;
      },
      (values: string[]) => {
        values[3] += ` ${CYCLE_2Z_PROMOTION_REVISION}`;
      },
      (values: string[]) => {
        values[4] = `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`;
      },
      (values: string[]) => {
        values[5] = `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`;
      },
      (values: string[]) => {
        values[6] = `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[7] = `${CYCLE_2Z_SOURCE_REVISION} ${"d".repeat(40)}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2zMaintenanceTopologyAllowed(
          ...(values as Parameters<typeof isCycle2zMaintenanceTopologyAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("accepts only the pinned roadmap-rebaseline child after the pinned maintenance route", () => {
    const revision = CYCLE_2Z_ROADMAP_REBASELINE_REVISION;
    const valid = [
      "6",
      "6",
      revision,
      `${revision} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`,
      `${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`,
      `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`,
      `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2zRoadmapRebaselineTopologyAllowed(...valid)).toBe(true);

    for (const pinnedRevision of [
      CYCLE_2Z_BASELINE_REVISION,
      CYCLE_2Z_SOURCE_REVISION,
      CYCLE_2Z_ROUTING_CLOSURE_REVISION,
      CYCLE_2Z_PROMOTION_REVISION,
      CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION,
      CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION,
    ]) {
      const values: string[] = [...valid];
      values[2] = pinnedRevision;
      values[3] = `${pinnedRevision} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`;
      expect(
        isCycle2zRoadmapRebaselineTopologyAllowed(
          ...(values as Parameters<
            typeof isCycle2zRoadmapRebaselineTopologyAllowed
          >),
        ),
        pinnedRevision,
      ).toBe(false);
    }

    for (const mutate of [
      (values: string[]) => {
        values[0] = "5";
      },
      (values: string[]) => {
        values[1] = "5";
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[2] = "a".repeat(40);
        values[3] = `${values[2]} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`;
      },
      (values: string[]) => {
        values[3] = `${revision} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`;
      },
      (values: string[]) => {
        values[3] += ` ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`;
      },
      (values: string[]) => {
        values[4] = `${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`;
      },
      (values: string[]) => {
        values[4] += ` ${CYCLE_2Z_PROMOTION_REVISION}`;
      },
      (values: string[]) => {
        values[5] = `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`;
      },
      (values: string[]) => {
        values[6] = `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`;
      },
      (values: string[]) => {
        values[7] = `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[8] = `${CYCLE_2Z_SOURCE_REVISION} ${"d".repeat(40)}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2zRoadmapRebaselineTopologyAllowed(
          ...(values as Parameters<
            typeof isCycle2zRoadmapRebaselineTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
  });

  it("accepts only the pinned Ubuntu CI stabilization after the pinned roadmap rebaseline", () => {
    const revision = CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION;
    const valid = [
      "7",
      "7",
      revision,
      `${revision} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`,
      `${CYCLE_2Z_ROADMAP_REBASELINE_REVISION} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`,
      `${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`,
      `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`,
      `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2zUbuntuCiStabilizationTopologyAllowed(...valid)).toBe(true);

    for (const pinnedRevision of [
      CYCLE_2Z_BASELINE_REVISION,
      CYCLE_2Z_SOURCE_REVISION,
      CYCLE_2Z_ROUTING_CLOSURE_REVISION,
      CYCLE_2Z_PROMOTION_REVISION,
      CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION,
      CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION,
      CYCLE_2Z_ROADMAP_REBASELINE_REVISION,
    ]) {
      const values: string[] = [...valid];
      values[2] = pinnedRevision;
      values[3] = `${pinnedRevision} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`;
      expect(
        isCycle2zUbuntuCiStabilizationTopologyAllowed(
          ...(values as Parameters<
            typeof isCycle2zUbuntuCiStabilizationTopologyAllowed
          >),
        ),
        pinnedRevision,
      ).toBe(false);
    }

    for (const mutate of [
      (values: string[]) => {
        values[0] = "6";
      },
      (values: string[]) => {
        values[1] = "8";
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[2] = "b".repeat(40);
        values[3] = `${values[2]} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[3] = `${revision} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`;
      },
      (values: string[]) => {
        values[3] += ` ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`;
      },
      (values: string[]) => {
        values[4] = `${CYCLE_2Z_ROADMAP_REBASELINE_REVISION} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`;
      },
      (values: string[]) => {
        values[4] += ` ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`;
      },
      (values: string[]) => {
        values[5] = `${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`;
      },
      (values: string[]) => {
        values[6] = `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`;
      },
      (values: string[]) => {
        values[7] = `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`;
      },
      (values: string[]) => {
        values[8] = `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[9] = `${CYCLE_2Z_SOURCE_REVISION} ${"d".repeat(40)}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2zUbuntuCiStabilizationTopologyAllowed(
          ...(values as Parameters<
            typeof isCycle2zUbuntuCiStabilizationTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
  });

  it("accepts only the pinned Cycle 3a source and every predecessor link", () => {
    const revision = CYCLE_3A_SOURCE_REVISION;
    const valid = [
      "8",
      "8",
      revision,
      `${revision} ${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`,
      `${CYCLE_2Z_ROADMAP_REBASELINE_REVISION} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`,
      `${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`,
      `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`,
      `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle3aSourceTopologyAllowed(...valid)).toBe(true);

    for (const [index, replacement] of [
      [0, "7"],
      [0, "9"],
      [1, "7"],
      [1, "9"],
      [2, "not-a-commit"],
      [2, "b".repeat(40)],
    ] as const) {
      const values: string[] = [...valid];
      values[index] = replacement;
      expect(
        isCycle3aSourceTopologyAllowed(
          ...(values as Parameters<typeof isCycle3aSourceTopologyAllowed>),
        ),
        `${index}:${replacement}`,
      ).toBe(false);
    }

    for (const mutate of [
      (values: string[]) => {
        values[3] = `${revision} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[3] += ` ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle3aSourceTopologyAllowed(
          ...(values as Parameters<typeof isCycle3aSourceTopologyAllowed>),
        ),
      ).toBe(false);
    }

    for (let index = 4; index < valid.length; index += 1) {
      const changedParent: string[] = [...valid];
      changedParent[index] = `${changedParent[index]}-changed`;
      expect(
        isCycle3aSourceTopologyAllowed(
          ...(changedParent as Parameters<
            typeof isCycle3aSourceTopologyAllowed
          >),
        ),
        `pinned-link:${index}`,
      ).toBe(false);

      const mergedParent: string[] = [...valid];
      mergedParent[index] += ` ${"e".repeat(40)}`;
      expect(
        isCycle3aSourceTopologyAllowed(
          ...(mergedParent as Parameters<
            typeof isCycle3aSourceTopologyAllowed
          >),
        ),
        `pinned-link-merge:${index}`,
      ).toBe(false);
    }
  });

  it("accepts only the pinned merge-free Cycle 3a promotion after its source", () => {
    const revision = CYCLE_3A_PROMOTION_REVISION;
    const valid = [
      "9",
      "9",
      revision,
      `${revision} ${CYCLE_3A_SOURCE_REVISION}`,
      `${CYCLE_3A_SOURCE_REVISION} ${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`,
      `${CYCLE_2Z_ROADMAP_REBASELINE_REVISION} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`,
      `${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`,
      `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`,
      `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle3aPromotionTopologyAllowed(...valid)).toBe(true);

    for (const [index, replacement] of [
      [0, "8"],
      [0, "10"],
      [1, "8"],
      [1, "10"],
      [2, "not-a-commit"],
      [2, "b".repeat(40)],
    ] as const) {
      const values: string[] = [...valid];
      values[index] = replacement;
      expect(
        isCycle3aPromotionTopologyAllowed(
          ...(values as Parameters<typeof isCycle3aPromotionTopologyAllowed>),
        ),
        `${index}:${replacement}`,
      ).toBe(false);
    }

    for (const pinnedRevision of [
      CYCLE_2Z_BASELINE_REVISION,
      CYCLE_2Z_SOURCE_REVISION,
      CYCLE_2Z_ROUTING_CLOSURE_REVISION,
      CYCLE_2Z_PROMOTION_REVISION,
      CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION,
      CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION,
      CYCLE_2Z_ROADMAP_REBASELINE_REVISION,
      CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION,
      CYCLE_3A_SOURCE_REVISION,
    ]) {
      const values: string[] = [...valid];
      values[2] = pinnedRevision;
      values[3] = `${pinnedRevision} ${CYCLE_3A_SOURCE_REVISION}`;
      expect(
        isCycle3aPromotionTopologyAllowed(
          ...(values as Parameters<typeof isCycle3aPromotionTopologyAllowed>),
        ),
        pinnedRevision,
      ).toBe(false);
    }

    for (const mutate of [
      (values: string[]) => {
        values[3] = `${revision} ${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION}`;
      },
      (values: string[]) => {
        values[3] += ` ${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION}`;
      },
      (values: string[]) => {
        values[4] = `${CYCLE_3A_SOURCE_REVISION} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[4] += ` ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle3aPromotionTopologyAllowed(
          ...(values as Parameters<typeof isCycle3aPromotionTopologyAllowed>),
        ),
      ).toBe(false);
    }

    for (let index = 5; index < valid.length; index += 1) {
      const changedParent: string[] = [...valid];
      changedParent[index] = `${changedParent[index]}-changed`;
      expect(
        isCycle3aPromotionTopologyAllowed(
          ...(changedParent as Parameters<
            typeof isCycle3aPromotionTopologyAllowed
          >),
        ),
        `pinned-link:${index}`,
      ).toBe(false);

      const mergedParent: string[] = [...valid];
      mergedParent[index] += ` ${"e".repeat(40)}`;
      expect(
        isCycle3aPromotionTopologyAllowed(
          ...(mergedParent as Parameters<
            typeof isCycle3aPromotionTopologyAllowed
          >),
        ),
        `pinned-link-merge:${index}`,
      ).toBe(false);
    }
  });

  it("accepts one merge-free Cycle 3b source child of the pinned promotion", () => {
    const revision = CYCLE_3B_SOURCE_REVISION;
    const valid = [
      "10",
      "10",
      revision,
      `${revision} ${CYCLE_3A_PROMOTION_REVISION}`,
      `${CYCLE_3A_PROMOTION_REVISION} ${CYCLE_3A_SOURCE_REVISION}`,
      `${CYCLE_3A_SOURCE_REVISION} ${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`,
      `${CYCLE_2Z_ROADMAP_REBASELINE_REVISION} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`,
      `${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`,
      `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`,
      `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle3bSourceTopologyAllowed(...valid)).toBe(true);

    for (const [index, replacement] of [
      [0, "9"],
      [0, "11"],
      [1, "9"],
      [1, "11"],
      [2, "not-a-commit"],
      [2, "b".repeat(40)],
    ] as const) {
      const values: string[] = [...valid];
      values[index] = replacement;
      expect(
        isCycle3bSourceTopologyAllowed(
          ...(values as Parameters<typeof isCycle3bSourceTopologyAllowed>),
        ),
        `${index}:${replacement}`,
      ).toBe(false);
    }

    for (const pinnedRevision of [
      CYCLE_2Z_BASELINE_REVISION,
      CYCLE_2Z_SOURCE_REVISION,
      CYCLE_2Z_ROUTING_CLOSURE_REVISION,
      CYCLE_2Z_PROMOTION_REVISION,
      CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION,
      CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION,
      CYCLE_2Z_ROADMAP_REBASELINE_REVISION,
      CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION,
      CYCLE_3A_SOURCE_REVISION,
      CYCLE_3A_PROMOTION_REVISION,
    ]) {
      const values: string[] = [...valid];
      values[2] = pinnedRevision;
      values[3] = `${pinnedRevision} ${CYCLE_3A_PROMOTION_REVISION}`;
      expect(
        isCycle3bSourceTopologyAllowed(
          ...(values as Parameters<typeof isCycle3bSourceTopologyAllowed>),
        ),
        pinnedRevision,
      ).toBe(false);
    }

    for (const mutate of [
      (values: string[]) => {
        values[3] = `${revision} ${CYCLE_3A_SOURCE_REVISION}`;
      },
      (values: string[]) => {
        values[3] += ` ${CYCLE_3A_SOURCE_REVISION}`;
      },
      (values: string[]) => {
        values[4] = `${CYCLE_3A_PROMOTION_REVISION} ${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION}`;
      },
      (values: string[]) => {
        values[4] += ` ${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle3bSourceTopologyAllowed(
          ...(values as Parameters<typeof isCycle3bSourceTopologyAllowed>),
        ),
      ).toBe(false);
    }

    for (let index = 5; index < valid.length; index += 1) {
      const changedParent: string[] = [...valid];
      changedParent[index] = `${changedParent[index]}-changed`;
      expect(
        isCycle3bSourceTopologyAllowed(
          ...(changedParent as Parameters<
            typeof isCycle3bSourceTopologyAllowed
          >),
        ),
        `pinned-link:${index}`,
      ).toBe(false);

      const mergedParent: string[] = [...valid];
      mergedParent[index] += ` ${"e".repeat(40)}`;
      expect(
        isCycle3bSourceTopologyAllowed(
          ...(mergedParent as Parameters<
            typeof isCycle3bSourceTopologyAllowed
          >),
        ),
        `pinned-link-merge:${index}`,
      ).toBe(false);
    }
  });

  it("accepts only the pinned merge-free corrective child of the Cycle 3b source", () => {
    const revision = CYCLE_3B_CORRECTIVE_REVISION;
    const valid = [
      "11",
      "11",
      revision,
      `${revision} ${CYCLE_3B_SOURCE_REVISION}`,
      `${CYCLE_3B_SOURCE_REVISION} ${CYCLE_3A_PROMOTION_REVISION}`,
      `${CYCLE_3A_PROMOTION_REVISION} ${CYCLE_3A_SOURCE_REVISION}`,
      `${CYCLE_3A_SOURCE_REVISION} ${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`,
      `${CYCLE_2Z_ROADMAP_REBASELINE_REVISION} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`,
      `${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`,
      `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`,
      `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle3bCorrectiveTopologyAllowed(...valid)).toBe(true);

    for (const [index, replacement] of [
      [0, "10"],
      [0, "12"],
      [1, "10"],
      [1, "12"],
      [2, "not-a-commit"],
      [2, CYCLE_3B_SOURCE_REVISION],
    ] as const) {
      const values: string[] = [...valid];
      values[index] = replacement;
      if (index === 2) values[3] = `${replacement} ${CYCLE_3B_SOURCE_REVISION}`;
      expect(
        isCycle3bCorrectiveTopologyAllowed(
          ...(values as Parameters<typeof isCycle3bCorrectiveTopologyAllowed>),
        ),
        `${index}:${replacement}`,
      ).toBe(false);
    }

    for (let index = 3; index < valid.length; index += 1) {
      const changedParent: string[] = [...valid];
      changedParent[index] = `${changedParent[index]}-changed`;
      expect(
        isCycle3bCorrectiveTopologyAllowed(
          ...(changedParent as Parameters<
            typeof isCycle3bCorrectiveTopologyAllowed
          >),
        ),
        `parent:${index}`,
      ).toBe(false);

      const mergedParent: string[] = [...valid];
      mergedParent[index] += ` ${"d".repeat(40)}`;
      expect(
        isCycle3bCorrectiveTopologyAllowed(
          ...(mergedParent as Parameters<
            typeof isCycle3bCorrectiveTopologyAllowed
          >),
        ),
        `merge:${index}`,
      ).toBe(false);
    }
  });

  it("accepts only the pinned merge-free Cycle 3c source", () => {
    const valid = [
      "12",
      "12",
      CYCLE_3C_SOURCE_REVISION,
      `${CYCLE_3C_SOURCE_REVISION} ${CYCLE_3B_CORRECTIVE_REVISION}`,
      `${CYCLE_3B_CORRECTIVE_REVISION} ${CYCLE_3B_SOURCE_REVISION}`,
      `${CYCLE_3B_SOURCE_REVISION} ${CYCLE_3A_PROMOTION_REVISION}`,
      `${CYCLE_3A_PROMOTION_REVISION} ${CYCLE_3A_SOURCE_REVISION}`,
      `${CYCLE_3A_SOURCE_REVISION} ${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`,
      `${CYCLE_2Z_ROADMAP_REBASELINE_REVISION} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`,
      `${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`,
      `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`,
      `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle3cSourceTopologyAllowed(...valid)).toBe(true);
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "11"
            : "13"
          : index === 2
            ? "not-a-commit"
            : `${value} ${"f".repeat(40)}`;
      expect(
        isCycle3cSourceTopologyAllowed(
          ...(changed as Parameters<typeof isCycle3cSourceTopologyAllowed>),
        ),
        `source:${index}`,
      ).toBe(false);
    }
  });

  it("accepts only one exact merge-free Cycle 3c routing child", () => {
    const revision = CYCLE_3C_ROUTING_CLOSURE_REVISION;
    const valid = [
      "13",
      "13",
      revision,
      `${revision} ${CYCLE_3C_SOURCE_REVISION}`,
      `${CYCLE_3C_SOURCE_REVISION} ${CYCLE_3B_CORRECTIVE_REVISION}`,
      `${CYCLE_3B_CORRECTIVE_REVISION} ${CYCLE_3B_SOURCE_REVISION}`,
      `${CYCLE_3B_SOURCE_REVISION} ${CYCLE_3A_PROMOTION_REVISION}`,
      `${CYCLE_3A_PROMOTION_REVISION} ${CYCLE_3A_SOURCE_REVISION}`,
      `${CYCLE_3A_SOURCE_REVISION} ${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`,
      `${CYCLE_2Z_ROADMAP_REBASELINE_REVISION} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`,
      `${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`,
      `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`,
      `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`,
      `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle3cRoutingClosureTopologyAllowed(...valid)).toBe(true);
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "12"
            : "14"
          : index === 2
            ? "d".repeat(40)
            : `${value} ${"f".repeat(40)}`;
      expect(
        isCycle3cRoutingClosureTopologyAllowed(
          ...(changed as Parameters<
            typeof isCycle3cRoutingClosureTopologyAllowed
          >),
        ),
        `routing:${index}`,
      ).toBe(false);
    }
  });

  it("requires every exact ordered source, promotion, stabilization, and corrective name-status tuple", () => {
    const transitions: readonly [
      string,
      (
        entries: readonly { readonly path: string; readonly status: string }[],
      ) => boolean,
      readonly { readonly path: string; readonly status: string }[],
      number,
    ][] = [
      ["source", isCycle2zCommitDiffSetAllowed, CYCLE_2Z_SOURCE_TRANSITION, 43],
      [
        "corrective",
        isCycle2zCorrectiveCommitDiffSetAllowed,
        CYCLE_2Z_CORRECTIVE_TRANSITION,
        5,
      ],
      [
        "promotion",
        isCycle2zPromotionCommitDiffSetAllowed,
        CYCLE_2Z_PROMOTION_TRANSITION,
        10,
      ],
      [
        "Windows timeout stabilization",
        isCycle2zWindowsTimeoutStabilizationCommitDiffSetAllowed,
        CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_TRANSITION,
        3,
      ],
      [
        "commit-boundary corrective",
        isCycle2zCommitBoundaryCorrectiveDiffSetAllowed,
        CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_TRANSITION,
        3,
      ],
      [
        "roadmap rebaseline",
        isCycle2zRoadmapRebaselineCommitDiffSetAllowed,
        CYCLE_2Z_ROADMAP_REBASELINE_TRANSITION,
        5,
      ],
      [
        "Ubuntu CI stabilization",
        isCycle2zUbuntuCiStabilizationCommitDiffSetAllowed,
        CYCLE_2Z_UBUNTU_CI_STABILIZATION_TRANSITION,
        4,
      ],
      [
        "Cycle 3a source",
        isCycle3aSourceCommitDiffSetAllowed,
        CYCLE_3A_SOURCE_TRANSITION,
        39,
      ],
      [
        "Cycle 3a promotion",
        isCycle3aPromotionCommitDiffSetAllowed,
        CYCLE_3A_PROMOTION_TRANSITION,
        16,
      ],
      [
        "Cycle 3b source",
        isCycle3bSourceCommitDiffSetAllowed,
        CYCLE_3B_SOURCE_TRANSITION,
        56,
      ],
      [
        "Cycle 3b corrective",
        isCycle3bCorrectiveCommitDiffSetAllowed,
        CYCLE_3B_CORRECTIVE_TRANSITION,
        7,
      ],
      [
        "Cycle 3c source",
        isCycle3cSourceCommitDiffSetAllowed,
        CYCLE_3C_SOURCE_TRANSITION,
        47,
      ],
      [
        "Cycle 3c routing",
        isCycle3cRoutingClosureCommitDiffSetAllowed,
        CYCLE_3C_ROUTING_CLOSURE_TRANSITION,
        7,
      ],
    ];
    for (const [name, allowed, entries, count] of transitions) {
      expect(entries, name).toHaveLength(count);
      expect(allowed(entries), name).toBe(true);
      expect(allowed([...entries].reverse()), `${name}:order`).toBe(false);
      for (const [index, entry] of entries.entries()) {
        expect(
          allowed(entries.filter((_, candidate) => candidate !== index)),
          `${name}:missing:${entry.path}`,
        ).toBe(false);
        expect(
          allowed(
            entries.map((candidate, candidateIndex) =>
              candidateIndex === index
                ? {
                    ...candidate,
                    status: candidate.status === "M" ? "A" : "M",
                  }
                : candidate,
            ),
          ),
          `${name}:status:${entry.path}`,
        ).toBe(false);
        expect(
          allowed(
            [...entries, entry].sort((left, right) =>
              left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
            ),
          ),
          `${name}:duplicate:${entry.path}`,
        ).toBe(false);
      }
      expect(
        allowed([...entries, { path: "unreviewed", status: "A" }]),
        `${name}:extra`,
      ).toBe(false);
    }
    expect(
      isCycle2zCommitBoundaryCorrectiveDiffSetAllowed(
        CYCLE_2Z_CORRECTIVE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isCycle2zCorrectiveCommitDiffSetAllowed(
        CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isCycle2zRoadmapRebaselineCommitDiffSetAllowed(
        CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isCycle2zCommitBoundaryCorrectiveDiffSetAllowed(
        CYCLE_2Z_ROADMAP_REBASELINE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isCycle2zUbuntuCiStabilizationCommitDiffSetAllowed(
        CYCLE_2Z_ROADMAP_REBASELINE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isCycle2zRoadmapRebaselineCommitDiffSetAllowed(
        CYCLE_2Z_UBUNTU_CI_STABILIZATION_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isCycle3aSourceCommitDiffSetAllowed(
        CYCLE_2Z_UBUNTU_CI_STABILIZATION_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isCycle2zUbuntuCiStabilizationCommitDiffSetAllowed(
        CYCLE_3A_SOURCE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isCycle3aPromotionCommitDiffSetAllowed(CYCLE_3A_SOURCE_TRANSITION),
    ).toBe(false);
    expect(
      isCycle3aSourceCommitDiffSetAllowed(CYCLE_3A_PROMOTION_TRANSITION),
    ).toBe(false);
    expect(
      isCycle3bSourceCommitDiffSetAllowed(CYCLE_3A_PROMOTION_TRANSITION),
    ).toBe(false);
    expect(
      isCycle3aPromotionCommitDiffSetAllowed(CYCLE_3B_SOURCE_TRANSITION),
    ).toBe(false);
    expect(
      isCycle3bCorrectiveCommitDiffSetAllowed(CYCLE_3B_SOURCE_TRANSITION),
    ).toBe(false);
    expect(
      isCycle3bSourceCommitDiffSetAllowed(CYCLE_3B_CORRECTIVE_TRANSITION),
    ).toBe(false);
    expect(
      isCycle3bSourceCommitDiffSetAllowed(
        CYCLE_3B_SOURCE_TRANSITION.map((entry, index) =>
          index === 0
            ? { path: `${entry.path}.renamed`, status: "R100" }
            : entry,
        ),
      ),
    ).toBe(false);
  });

  it("routes every inherited or Cycle 2z transition surface", () => {
    expect(CYCLE_2Z_PROTECTED_SURFACE_PATHS).toHaveLength(77);
    expect(new Set(CYCLE_2Z_PROTECTED_SURFACE_PATHS).size).toBe(77);
    for (const path of CYCLE_2Z_PROTECTED_SURFACE_PATHS) {
      expect(isCycle2zTransitionRoutingRequired([path]), path).toBe(true);
      expect(
        isCycle2zTransitionRoutingRequired(["unreviewed", path]),
        path,
      ).toBe(true);
    }
    expect(isCycle2zTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2zTransitionRoutingRequired([])).toBe(false);
    expect(isCycle2zTransitionRoutingRequired(["unreviewed"])).toBe(false);
  });

  it("routes every inherited or Cycle 3a transition surface", () => {
    expect(new Set(CYCLE_3A_PROTECTED_SURFACE_PATHS).size).toBe(
      CYCLE_3A_PROTECTED_SURFACE_PATHS.length,
    );
    for (const path of CYCLE_3A_PROTECTED_SURFACE_PATHS) {
      expect(isCycle3aTransitionRoutingRequired([path]), path).toBe(true);
      expect(isCycle2zTransitionRoutingRequired([path]), path).toBe(true);
    }
    expect(isCycle3aTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle3aTransitionRoutingRequired([])).toBe(false);
    expect(isCycle3aTransitionRoutingRequired(["unreviewed"])).toBe(false);
  });

  it("routes every inherited or Cycle 3b transition surface", () => {
    expect(new Set(CYCLE_3B_PROTECTED_SURFACE_PATHS).size).toBe(
      CYCLE_3B_PROTECTED_SURFACE_PATHS.length,
    );
    for (const path of CYCLE_3B_PROTECTED_SURFACE_PATHS) {
      expect(isCycle3bTransitionRoutingRequired([path]), path).toBe(true);
      expect(isCycle3aTransitionRoutingRequired([path]), path).toBe(true);
      expect(isCycle2zTransitionRoutingRequired([path]), path).toBe(true);
    }
    expect(isCycle3bTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle3bTransitionRoutingRequired([])).toBe(false);
    expect(isCycle3bTransitionRoutingRequired(["unreviewed"])).toBe(false);
  });

  it("routes every inherited or Cycle 3c transition surface", () => {
    expect(new Set(CYCLE_3C_PROTECTED_SURFACE_PATHS).size).toBe(
      CYCLE_3C_PROTECTED_SURFACE_PATHS.length,
    );
    for (const path of CYCLE_3C_PROTECTED_SURFACE_PATHS) {
      expect(isCycle3cTransitionRoutingRequired([path]), path).toBe(true);
      expect(isCycle3bTransitionRoutingRequired([path]), path).toBe(true);
      expect(isCycle3aTransitionRoutingRequired([path]), path).toBe(true);
      expect(isCycle2zTransitionRoutingRequired([path]), path).toBe(true);
    }
    expect(isCycle3cTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle3cTransitionRoutingRequired([])).toBe(false);
    expect(isCycle3cTransitionRoutingRequired(["unreviewed"])).toBe(false);
  });
});

describe("Cycle 3d durable personal local-vault routing closure", () => {
  const historicalParents = [
    `${CYCLE_3C_ROUTING_CLOSURE_REVISION} ${CYCLE_3C_SOURCE_REVISION}`,
    `${CYCLE_3C_SOURCE_REVISION} ${CYCLE_3B_CORRECTIVE_REVISION}`,
    `${CYCLE_3B_CORRECTIVE_REVISION} ${CYCLE_3B_SOURCE_REVISION}`,
    `${CYCLE_3B_SOURCE_REVISION} ${CYCLE_3A_PROMOTION_REVISION}`,
    `${CYCLE_3A_PROMOTION_REVISION} ${CYCLE_3A_SOURCE_REVISION}`,
    `${CYCLE_3A_SOURCE_REVISION} ${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION}`,
    `${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`,
    `${CYCLE_2Z_ROADMAP_REBASELINE_REVISION} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`,
    `${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`,
    `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`,
    `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`,
    `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`,
    `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
  ] as const;

  it("pins the source to one merge-free child of the Cycle 3c routing closure", () => {
    const valid = [
      "14",
      "14",
      CYCLE_3D_SOURCE_REVISION,
      `${CYCLE_3D_SOURCE_REVISION} ${CYCLE_3C_ROUTING_CLOSURE_REVISION}`,
      ...historicalParents,
    ] as const;
    expect(isCycle3dSourceTopologyAllowed(...valid)).toBe(true);
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "13"
            : "15"
          : index === 2
            ? "not-a-commit"
            : `${value} ${"f".repeat(40)}`;
      expect(
        isCycle3dSourceTopologyAllowed(
          ...(changed as Parameters<typeof isCycle3dSourceTopologyAllowed>),
        ),
        `source:${index}`,
      ).toBe(false);
    }
  });

  it("pins the original merge-free Cycle 3d routing child", () => {
    const revision = CYCLE_3D_ROUTING_CLOSURE_REVISION;
    const valid = [
      "15",
      "15",
      revision,
      `${revision} ${CYCLE_3D_SOURCE_REVISION}`,
      `${CYCLE_3D_SOURCE_REVISION} ${CYCLE_3C_ROUTING_CLOSURE_REVISION}`,
      ...historicalParents,
    ] as const;
    expect(isCycle3dRoutingClosureTopologyAllowed(...valid)).toBe(true);
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "14"
            : "16"
          : index === 2
            ? "d".repeat(40)
            : `${value} ${"f".repeat(40)}`;
      expect(
        isCycle3dRoutingClosureTopologyAllowed(
          ...(changed as Parameters<
            typeof isCycle3dRoutingClosureTopologyAllowed
          >),
        ),
        `routing:${index}`,
      ).toBe(false);
    }
  });

  it("pins the ACL corrective to one merge-free child of the original route", () => {
    const valid = [
      "16",
      "16",
      CYCLE_3D_ACL_CORRECTIVE_REVISION,
      `${CYCLE_3D_ACL_CORRECTIVE_REVISION} ${CYCLE_3D_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_SOURCE_REVISION}`,
      `${CYCLE_3D_SOURCE_REVISION} ${CYCLE_3C_ROUTING_CLOSURE_REVISION}`,
      ...historicalParents,
    ] as const;
    expect(isCycle3dAclCorrectiveTopologyAllowed(...valid)).toBe(true);
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "15"
            : "17"
          : index === 2
            ? "d".repeat(40)
            : `${value} ${"f".repeat(40)}`;
      expect(
        isCycle3dAclCorrectiveTopologyAllowed(
          ...(changed as Parameters<
            typeof isCycle3dAclCorrectiveTopologyAllowed
          >),
        ),
        `corrective:${index}`,
      ).toBe(false);
    }
  });

  it("pins the corrective routing child after the ACL corrective", () => {
    const revision = CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION;
    const valid = [
      "17",
      "17",
      revision,
      `${revision} ${CYCLE_3D_ACL_CORRECTIVE_REVISION}`,
      `${CYCLE_3D_ACL_CORRECTIVE_REVISION} ${CYCLE_3D_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_SOURCE_REVISION}`,
      `${CYCLE_3D_SOURCE_REVISION} ${CYCLE_3C_ROUTING_CLOSURE_REVISION}`,
      ...historicalParents,
    ] as const;
    expect(isCycle3dCorrectiveRoutingClosureTopologyAllowed(...valid)).toBe(
      true,
    );
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "16"
            : "18"
          : index === 2
            ? "d".repeat(40)
            : `${value} ${"f".repeat(40)}`;
      expect(
        isCycle3dCorrectiveRoutingClosureTopologyAllowed(
          ...(changed as Parameters<
            typeof isCycle3dCorrectiveRoutingClosureTopologyAllowed
          >),
        ),
        `corrective-routing:${index}`,
      ).toBe(false);
    }
  });

  it("pins the Windows CI stabilization source after corrective routing", () => {
    const valid = [
      "18",
      "18",
      CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION,
      `${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION} ${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_ACL_CORRECTIVE_REVISION}`,
      `${CYCLE_3D_ACL_CORRECTIVE_REVISION} ${CYCLE_3D_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_SOURCE_REVISION}`,
      `${CYCLE_3D_SOURCE_REVISION} ${CYCLE_3C_ROUTING_CLOSURE_REVISION}`,
      ...historicalParents,
    ] as const;
    expect(isCycle3dWindowsCiStabilizationTopologyAllowed(...valid)).toBe(true);
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "17"
            : "19"
          : index === 2
            ? "d".repeat(40)
            : `${value} ${"f".repeat(40)}`;
      expect(
        isCycle3dWindowsCiStabilizationTopologyAllowed(
          ...(changed as Parameters<
            typeof isCycle3dWindowsCiStabilizationTopologyAllowed
          >),
        ),
        `windows-ci-stabilization:${index}`,
      ).toBe(false);
    }
  });

  it("pins the routing child after CI stabilization", () => {
    const revision = CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION;
    const valid = [
      "19",
      "19",
      revision,
      `${revision} ${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION}`,
      `${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION} ${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_ACL_CORRECTIVE_REVISION}`,
      `${CYCLE_3D_ACL_CORRECTIVE_REVISION} ${CYCLE_3D_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_SOURCE_REVISION}`,
      `${CYCLE_3D_SOURCE_REVISION} ${CYCLE_3C_ROUTING_CLOSURE_REVISION}`,
      ...historicalParents,
    ] as const;
    expect(isCycle3dStabilizationRoutingClosureTopologyAllowed(...valid)).toBe(
      true,
    );
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "18"
            : "20"
          : index === 2
            ? "e".repeat(40)
            : `${value} ${"f".repeat(40)}`;
      expect(
        isCycle3dStabilizationRoutingClosureTopologyAllowed(
          ...(changed as Parameters<
            typeof isCycle3dStabilizationRoutingClosureTopologyAllowed
          >),
        ),
        `stabilization-routing:${index}`,
      ).toBe(false);
    }
  });

  it("pins the API Windows fixture stabilization source", () => {
    const valid = [
      "20",
      "20",
      CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION,
      `${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION} ${CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION}`,
      `${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION} ${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_ACL_CORRECTIVE_REVISION}`,
      `${CYCLE_3D_ACL_CORRECTIVE_REVISION} ${CYCLE_3D_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_SOURCE_REVISION}`,
      `${CYCLE_3D_SOURCE_REVISION} ${CYCLE_3C_ROUTING_CLOSURE_REVISION}`,
      ...historicalParents,
    ] as const;
    expect(
      isCycle3dApiWindowsFixtureStabilizationTopologyAllowed(...valid),
    ).toBe(true);
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "19"
            : "21"
          : index === 2
            ? "e".repeat(40)
            : `${value} ${"f".repeat(40)}`;
      expect(
        isCycle3dApiWindowsFixtureStabilizationTopologyAllowed(
          ...(changed as Parameters<
            typeof isCycle3dApiWindowsFixtureStabilizationTopologyAllowed
          >),
        ),
        `api-windows-fixture-stabilization:${index}`,
      ).toBe(false);
    }
  });

  it("pins the routing child after API fixture stabilization", () => {
    const revision =
      CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_REVISION;
    const valid = [
      "21",
      "21",
      revision,
      `${revision} ${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION}`,
      `${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION} ${CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION}`,
      `${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION} ${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_ACL_CORRECTIVE_REVISION}`,
      `${CYCLE_3D_ACL_CORRECTIVE_REVISION} ${CYCLE_3D_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_SOURCE_REVISION}`,
      `${CYCLE_3D_SOURCE_REVISION} ${CYCLE_3C_ROUTING_CLOSURE_REVISION}`,
      ...historicalParents,
    ] as const;
    expect(
      isCycle3dApiWindowsFixtureStabilizationRoutingClosureTopologyAllowed(
        ...valid,
      ),
    ).toBe(true);
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "20"
            : "22"
          : index === 2
            ? "f".repeat(40)
            : `${value} ${"e".repeat(40)}`;
      expect(
        isCycle3dApiWindowsFixtureStabilizationRoutingClosureTopologyAllowed(
          ...(changed as Parameters<
            typeof isCycle3dApiWindowsFixtureStabilizationRoutingClosureTopologyAllowed
          >),
        ),
        `api-fixture-stabilization-routing:${index}`,
      ).toBe(false);
    }
  });

  it("pins the Windows parser-timeout stabilization source", () => {
    const valid = [
      "22",
      "22",
      CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_REVISION,
      `${CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION}`,
      `${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION} ${CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION}`,
      `${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION} ${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_ACL_CORRECTIVE_REVISION}`,
      `${CYCLE_3D_ACL_CORRECTIVE_REVISION} ${CYCLE_3D_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_SOURCE_REVISION}`,
      `${CYCLE_3D_SOURCE_REVISION} ${CYCLE_3C_ROUTING_CLOSURE_REVISION}`,
      ...historicalParents,
    ] as const;
    expect(
      isCycle3dWindowsParserTimeoutStabilizationTopologyAllowed(...valid),
    ).toBe(true);
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "21"
            : "23"
          : index === 2
            ? "f".repeat(40)
            : `${value} ${"e".repeat(40)}`;
      expect(
        isCycle3dWindowsParserTimeoutStabilizationTopologyAllowed(
          ...(changed as Parameters<
            typeof isCycle3dWindowsParserTimeoutStabilizationTopologyAllowed
          >),
        ),
        `windows-parser-timeout-stabilization:${index}`,
      ).toBe(false);
    }
  });

  it("pins the exact routing child after parser-timeout stabilization", () => {
    const revision =
      CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_ROUTING_CLOSURE_REVISION;
    const valid = [
      "23",
      "23",
      revision,
      `${CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_REVISION}`,
      `${CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION}`,
      `${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION} ${CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION}`,
      `${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION} ${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_ACL_CORRECTIVE_REVISION}`,
      `${CYCLE_3D_ACL_CORRECTIVE_REVISION} ${CYCLE_3D_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_SOURCE_REVISION}`,
      `${CYCLE_3D_SOURCE_REVISION} ${CYCLE_3C_ROUTING_CLOSURE_REVISION}`,
      ...historicalParents,
    ] as const;
    expect(
      isCycle3dWindowsParserTimeoutStabilizationRoutingClosureTopologyAllowed(
        ...valid,
      ),
    ).toBe(true);
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "22"
            : "24"
          : index === 2
            ? CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_REVISION
            : `${value} ${"e".repeat(40)}`;
      expect(
        isCycle3dWindowsParserTimeoutStabilizationRoutingClosureTopologyAllowed(
          ...(changed as Parameters<
            typeof isCycle3dWindowsParserTimeoutStabilizationRoutingClosureTopologyAllowed
          >),
        ),
        `windows-parser-timeout-routing:${index}`,
      ).toBe(false);
    }
  });

  it("accepts one exact joint Cycle 3c/3d public-promotion child", () => {
    const revision = CYCLE_3C_3D_PUBLIC_PROMOTION_REVISION;
    const valid = [
      "24",
      "24",
      revision,
      `${revision} ${CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_REVISION}`,
      `${CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION}`,
      `${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION} ${CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION}`,
      `${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION} ${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_ACL_CORRECTIVE_REVISION}`,
      `${CYCLE_3D_ACL_CORRECTIVE_REVISION} ${CYCLE_3D_ROUTING_CLOSURE_REVISION}`,
      `${CYCLE_3D_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_SOURCE_REVISION}`,
      `${CYCLE_3D_SOURCE_REVISION} ${CYCLE_3C_ROUTING_CLOSURE_REVISION}`,
      ...historicalParents,
    ] as const;
    expect(isCycle3c3dPublicPromotionTopologyAllowed(...valid)).toBe(true);
    for (const [index, value] of valid.entries()) {
      const changed: string[] = [...valid];
      changed[index] =
        index === 0 || index === 1
          ? index === 0
            ? "23"
            : "25"
          : index === 2
            ? "a".repeat(40)
            : `${value} ${"e".repeat(40)}`;
      expect(
        isCycle3c3dPublicPromotionTopologyAllowed(
          ...(changed as Parameters<
            typeof isCycle3c3dPublicPromotionTopologyAllowed
          >),
        ),
        `joint-public-promotion:${index}`,
      ).toBe(false);
    }
  });

  for (const [name, allowed, entries, count] of [
    [
      "Cycle 3d source",
      isCycle3dSourceCommitDiffSetAllowed,
      CYCLE_3D_SOURCE_TRANSITION,
      63,
    ],
    [
      "Cycle 3d routing",
      isCycle3dRoutingClosureCommitDiffSetAllowed,
      CYCLE_3D_ROUTING_CLOSURE_TRANSITION,
      7,
    ],
    [
      "Cycle 3d ACL corrective",
      isCycle3dAclCorrectiveCommitDiffSetAllowed,
      CYCLE_3D_ACL_CORRECTIVE_TRANSITION,
      2,
    ],
    [
      "Cycle 3d corrective routing",
      isCycle3dCorrectiveRoutingClosureCommitDiffSetAllowed,
      CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_TRANSITION,
      7,
    ],
    [
      "Cycle 3d Windows CI stabilization",
      isCycle3dWindowsCiStabilizationCommitDiffSetAllowed,
      CYCLE_3D_WINDOWS_CI_STABILIZATION_TRANSITION,
      2,
    ],
    [
      "Cycle 3d stabilization routing",
      isCycle3dStabilizationRoutingClosureCommitDiffSetAllowed,
      CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_TRANSITION,
      7,
    ],
    [
      "Cycle 3d API Windows fixture stabilization",
      isCycle3dApiWindowsFixtureStabilizationCommitDiffSetAllowed,
      CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_TRANSITION,
      2,
    ],
    [
      "Cycle 3d API fixture stabilization routing",
      isCycle3dApiWindowsFixtureStabilizationRoutingClosureCommitDiffSetAllowed,
      CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_TRANSITION,
      7,
    ],
    [
      "Cycle 3d Windows parser-timeout stabilization",
      isCycle3dWindowsParserTimeoutStabilizationCommitDiffSetAllowed,
      CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_TRANSITION,
      3,
    ],
    [
      "Cycle 3d Windows parser-timeout routing",
      isCycle3dWindowsParserTimeoutStabilizationRoutingClosureCommitDiffSetAllowed,
      CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_ROUTING_CLOSURE_TRANSITION,
      7,
    ],
    [
      "joint Cycle 3c/3d public promotion",
      isCycle3c3dPublicPromotionCommitDiffSetAllowed,
      CYCLE_3C_3D_PUBLIC_PROMOTION_TRANSITION,
      24,
    ],
  ] as const) {
    it(`freezes the exact ${name} name-status tuple`, () => {
      expect(entries, name).toHaveLength(count);
      expect(allowed(entries), name).toBe(true);
      expect(allowed([...entries].reverse()), `${name}:order`).toBe(false);
      for (const [index, entry] of entries.entries()) {
        expect(
          allowed(entries.filter((_, candidate) => candidate !== index)),
          `${name}:missing:${entry.path}`,
        ).toBe(false);
        expect(
          allowed(
            entries.map((candidate, candidateIndex) =>
              candidateIndex === index
                ? {
                    ...candidate,
                    status: candidate.status === "M" ? "A" : "M",
                  }
                : candidate,
            ),
          ),
          `${name}:status:${entry.path}`,
        ).toBe(false);
        expect(
          allowed([...entries, entry]),
          `${name}:duplicate:${entry.path}`,
        ).toBe(false);
      }
      expect(
        allowed([...entries, { path: "unreviewed", status: "A" }]),
        `${name}:extra`,
      ).toBe(false);
    });
  }

  it("routes every inherited or Cycle 3d transition surface", () => {
    expect(new Set(CYCLE_3D_PROTECTED_SURFACE_PATHS).size).toBe(
      CYCLE_3D_PROTECTED_SURFACE_PATHS.length,
    );
    for (const path of CYCLE_3D_PROTECTED_SURFACE_PATHS) {
      expect(isCycle3dTransitionRoutingRequired([path]), path).toBe(true);
      expect(isCycle3cTransitionRoutingRequired([path]), path).toBe(true);
      expect(isCycle3bTransitionRoutingRequired([path]), path).toBe(true);
      expect(isCycle3aTransitionRoutingRequired([path]), path).toBe(true);
      expect(isCycle2zTransitionRoutingRequired([path]), path).toBe(true);
    }
    expect(isCycle3dTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle3dTransitionRoutingRequired([])).toBe(false);
    expect(isCycle3dTransitionRoutingRequired(["unreviewed"])).toBe(false);
  });
});

describe("Cycle 3e-a prepared security-master source routing", () => {
  const publicPromotionTopology = [
    "24",
    "24",
    CYCLE_3C_3D_PUBLIC_PROMOTION_REVISION,
    `${CYCLE_3C_3D_PUBLIC_PROMOTION_REVISION} ${CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_ROUTING_CLOSURE_REVISION}`,
    `${CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_REVISION}`,
    `${CYCLE_3D_WINDOWS_PARSER_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_REVISION}`,
    `${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION}`,
    `${CYCLE_3D_API_WINDOWS_FIXTURE_STABILIZATION_REVISION} ${CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION}`,
    `${CYCLE_3D_STABILIZATION_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION}`,
    `${CYCLE_3D_WINDOWS_CI_STABILIZATION_REVISION} ${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION}`,
    `${CYCLE_3D_CORRECTIVE_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_ACL_CORRECTIVE_REVISION}`,
    `${CYCLE_3D_ACL_CORRECTIVE_REVISION} ${CYCLE_3D_ROUTING_CLOSURE_REVISION}`,
    `${CYCLE_3D_ROUTING_CLOSURE_REVISION} ${CYCLE_3D_SOURCE_REVISION}`,
    `${CYCLE_3D_SOURCE_REVISION} ${CYCLE_3C_ROUTING_CLOSURE_REVISION}`,
    `${CYCLE_3C_ROUTING_CLOSURE_REVISION} ${CYCLE_3C_SOURCE_REVISION}`,
    `${CYCLE_3C_SOURCE_REVISION} ${CYCLE_3B_CORRECTIVE_REVISION}`,
    `${CYCLE_3B_CORRECTIVE_REVISION} ${CYCLE_3B_SOURCE_REVISION}`,
    `${CYCLE_3B_SOURCE_REVISION} ${CYCLE_3A_PROMOTION_REVISION}`,
    `${CYCLE_3A_PROMOTION_REVISION} ${CYCLE_3A_SOURCE_REVISION}`,
    `${CYCLE_3A_SOURCE_REVISION} ${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION}`,
    `${CYCLE_2Z_UBUNTU_CI_STABILIZATION_REVISION} ${CYCLE_2Z_ROADMAP_REBASELINE_REVISION}`,
    `${CYCLE_2Z_ROADMAP_REBASELINE_REVISION} ${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION}`,
    `${CYCLE_2Z_COMMIT_BOUNDARY_CORRECTIVE_REVISION} ${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION}`,
    `${CYCLE_2Z_WINDOWS_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_2Z_PROMOTION_REVISION}`,
    `${CYCLE_2Z_PROMOTION_REVISION} ${CYCLE_2Z_ROUTING_CLOSURE_REVISION}`,
    `${CYCLE_2Z_ROUTING_CLOSURE_REVISION} ${CYCLE_2Z_SOURCE_REVISION}`,
    `${CYCLE_2Z_SOURCE_REVISION} ${CYCLE_2Z_BASELINE_REVISION}`,
  ] as const;
  const sourceTopology = [
    "25",
    "25",
    CYCLE_3E_A_SOURCE_REVISION,
    `${CYCLE_3E_A_SOURCE_REVISION} ${CYCLE_3C_3D_PUBLIC_PROMOTION_REVISION}`,
    publicPromotionTopology,
  ] as const;
  const routingTopology = [
    "26",
    "26",
    CYCLE_3E_A_ROUTING_CLOSURE_REVISION,
    `${CYCLE_3E_A_ROUTING_CLOSURE_REVISION} ${CYCLE_3E_A_SOURCE_REVISION}`,
    sourceTopology,
  ] as const;
  const workflowExpressionStabilizationTopology = [
    "27",
    "27",
    CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_REVISION,
    `${CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_REVISION} ${CYCLE_3E_A_ROUTING_CLOSURE_REVISION}`,
    routingTopology,
  ] as const;
  const syntheticBenchmarkTimeoutStabilizationTopology = [
    "28",
    "28",
    CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_REVISION,
    `${CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_REVISION}`,
    workflowExpressionStabilizationTopology,
  ] as const;
  const windowsStableFileStabilizationTopology = [
    "29",
    "29",
    CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION,
    `${CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION} ${CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_REVISION}`,
    syntheticBenchmarkTimeoutStabilizationTopology,
  ] as const;
  const windowsSnapshotMetadataStabilizationTopology = [
    "30",
    "30",
    CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION,
    `${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION} ${CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION}`,
    windowsStableFileStabilizationTopology,
  ] as const;

  it("pins the exact merge-free source after the public promotion", () => {
    expect(isCycle3eaSourceTopologyAllowed(...sourceTopology)).toBe(true);
    for (const [index, replacement] of [
      [0, "24"],
      [1, "26"],
      [2, "f".repeat(40)],
      [3, `${CYCLE_3E_A_SOURCE_REVISION} ${"f".repeat(40)}`],
    ] as const) {
      const changed: unknown[] = [...sourceTopology];
      changed[index] = replacement;
      expect(
        isCycle3eaSourceTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eaSourceTopologyAllowed
          >),
        ),
        `source:${index}`,
      ).toBe(false);
    }
    const changedPromotion = [...publicPromotionTopology];
    changedPromotion[3] += ` ${"f".repeat(40)}`;
    expect(
      isCycle3eaSourceTopologyAllowed(
        "25",
        "25",
        CYCLE_3E_A_SOURCE_REVISION,
        `${CYCLE_3E_A_SOURCE_REVISION} ${CYCLE_3C_3D_PUBLIC_PROMOTION_REVISION}`,
        changedPromotion as unknown as Parameters<
          typeof isCycle3c3dPublicPromotionTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free routing child", () => {
    expect(isCycle3eaRoutingClosureTopologyAllowed(...routingTopology)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "25"],
      [1, "27"],
      [2, CYCLE_3E_A_SOURCE_REVISION],
      [
        3,
        `${CYCLE_3E_A_ROUTING_CLOSURE_REVISION} ${CYCLE_3C_3D_PUBLIC_PROMOTION_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [...routingTopology];
      changed[index] = replacement;
      expect(
        isCycle3eaRoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eaRoutingClosureTopologyAllowed
          >),
        ),
        `routing:${index}`,
      ).toBe(false);
    }
  });

  it("pins the exact merge-free workflow-expression stabilization", () => {
    expect(
      isCycle3eaWorkflowExpressionStabilizationTopologyAllowed(
        ...workflowExpressionStabilizationTopology,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "26"],
      [1, "28"],
      [2, CYCLE_3E_A_ROUTING_CLOSURE_REVISION],
      [
        3,
        `${CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_REVISION} ${CYCLE_3E_A_SOURCE_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [...workflowExpressionStabilizationTopology];
      changed[index] = replacement;
      expect(
        isCycle3eaWorkflowExpressionStabilizationTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eaWorkflowExpressionStabilizationTopologyAllowed
          >),
        ),
        `stabilization:${index}`,
      ).toBe(false);
    }
  });

  it("pins the exact merge-free synthetic-benchmark-timeout stabilization", () => {
    expect(
      isCycle3eaSyntheticBenchmarkTimeoutStabilizationTopologyAllowed(
        ...syntheticBenchmarkTimeoutStabilizationTopology,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "27"],
      [1, "29"],
      [2, CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_REVISION],
      [
        3,
        `${CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_3E_A_ROUTING_CLOSURE_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [
        ...syntheticBenchmarkTimeoutStabilizationTopology,
      ];
      changed[index] = replacement;
      expect(
        isCycle3eaSyntheticBenchmarkTimeoutStabilizationTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eaSyntheticBenchmarkTimeoutStabilizationTopologyAllowed
          >),
        ),
        `timeout-stabilization:${index}`,
      ).toBe(false);
    }
    const changedWorkflow: unknown[] = [
      ...workflowExpressionStabilizationTopology,
    ];
    changedWorkflow[3] = `${CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_REVISION} ${CYCLE_3E_A_ROUTING_CLOSURE_REVISION} ${"f".repeat(40)}`;
    expect(
      isCycle3eaSyntheticBenchmarkTimeoutStabilizationTopologyAllowed(
        "28",
        "28",
        CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_REVISION,
        `${CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_REVISION}`,
        changedWorkflow as unknown as Parameters<
          typeof isCycle3eaWorkflowExpressionStabilizationTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free Windows stable-file stabilization", () => {
    expect(
      isCycle3eaWindowsStableFileStabilizationTopologyAllowed(
        ...windowsStableFileStabilizationTopology,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "28"],
      [1, "30"],
      [2, CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_REVISION],
      [
        3,
        `${CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION} ${CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [...windowsStableFileStabilizationTopology];
      changed[index] = replacement;
      expect(
        isCycle3eaWindowsStableFileStabilizationTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eaWindowsStableFileStabilizationTopologyAllowed
          >),
        ),
        `stable-file-stabilization:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3eaWindowsStableFileStabilizationTopologyAllowed(
        "29",
        "29",
        "f".repeat(40),
        `${CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION} ${"f".repeat(40)}`,
        syntheticBenchmarkTimeoutStabilizationTopology,
      ),
    ).toBe(false);
    const changedBenchmark: unknown[] = [
      ...syntheticBenchmarkTimeoutStabilizationTopology,
    ];
    changedBenchmark[3] = `${CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_REVISION} ${CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_REVISION} ${"f".repeat(40)}`;
    expect(
      isCycle3eaWindowsStableFileStabilizationTopologyAllowed(
        "29",
        "29",
        CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION,
        `${CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION} ${CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_REVISION}`,
        changedBenchmark as unknown as Parameters<
          typeof isCycle3eaSyntheticBenchmarkTimeoutStabilizationTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free Windows snapshot-metadata stabilization", () => {
    expect(
      isCycle3eaWindowsSnapshotMetadataStabilizationTopologyAllowed(
        ...windowsSnapshotMetadataStabilizationTopology,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "29"],
      [1, "31"],
      [2, CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION],
      [
        3,
        `${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION} ${CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [
        ...windowsSnapshotMetadataStabilizationTopology,
      ];
      changed[index] = replacement;
      expect(
        isCycle3eaWindowsSnapshotMetadataStabilizationTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eaWindowsSnapshotMetadataStabilizationTopologyAllowed
          >),
        ),
        `snapshot-metadata-stabilization:${index}`,
      ).toBe(false);
    }
    const changedWindows: unknown[] = [
      ...windowsStableFileStabilizationTopology,
    ];
    changedWindows[3] = `${CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION} ${CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_REVISION} ${"f".repeat(40)}`;
    expect(
      isCycle3eaWindowsSnapshotMetadataStabilizationTopologyAllowed(
        "30",
        "30",
        CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION,
        `${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION} ${CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION}`,
        changedWindows as unknown as Parameters<
          typeof isCycle3eaWindowsStableFileStabilizationTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("allows exactly one dynamic merge-free canonical-temp-fixture stabilization child", () => {
    const revision = "d".repeat(40);
    const valid = [
      "31",
      "31",
      revision,
      `${revision} ${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION}`,
      windowsSnapshotMetadataStabilizationTopology,
    ] as const;
    expect(
      isCycle3eaCanonicalTempFixtureStabilizationTopologyAllowed(...valid),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "30"],
      [1, "32"],
      [2, CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION],
      [
        3,
        `${revision} ${CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [...valid];
      changed[index] = replacement;
      expect(
        isCycle3eaCanonicalTempFixtureStabilizationTopologyAllowed(
          ...(changed as Parameters<
            typeof isCycle3eaCanonicalTempFixtureStabilizationTopologyAllowed
          >),
        ),
        `canonical-temp-fixture-stabilization:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3eaCanonicalTempFixtureStabilizationTopologyAllowed(
        "31",
        "31",
        "not-a-commit",
        `not-a-commit ${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION}`,
        windowsSnapshotMetadataStabilizationTopology,
      ),
    ).toBe(false);
    const changedMetadata: unknown[] = [
      ...windowsSnapshotMetadataStabilizationTopology,
    ];
    changedMetadata[3] = `${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION} ${CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION} ${"f".repeat(40)}`;
    expect(
      isCycle3eaCanonicalTempFixtureStabilizationTopologyAllowed(
        "31",
        "31",
        revision,
        `${revision} ${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION}`,
        changedMetadata as unknown as Parameters<
          typeof isCycle3eaWindowsSnapshotMetadataStabilizationTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("freezes the exact 51, 7, 5, 6, 7, 7, and 7-file transitions", () => {
    expectExactTransition(
      isCycle3eaSourceCommitDiffSetAllowed,
      CYCLE_3E_A_SOURCE_TRANSITION,
      51,
    );
    expectExactTransition(
      isCycle3eaRoutingClosureCommitDiffSetAllowed,
      CYCLE_3E_A_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3eaWorkflowExpressionStabilizationCommitDiffSetAllowed,
      CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_TRANSITION,
      5,
    );
    expectExactTransition(
      isCycle3eaSyntheticBenchmarkTimeoutStabilizationCommitDiffSetAllowed,
      CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_TRANSITION,
      6,
    );
    expectExactTransition(
      isCycle3eaWindowsStableFileStabilizationCommitDiffSetAllowed,
      CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3eaWindowsSnapshotMetadataStabilizationCommitDiffSetAllowed,
      CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3eaCanonicalTempFixtureStabilizationCommitDiffSetAllowed,
      CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_TRANSITION,
      7,
    );
  });

  it("routes every inherited, source, and routing surface", () => {
    const protectedPaths = new Set([
      ...CYCLE_3C_3D_PUBLIC_PROMOTION_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A_SOURCE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A_WORKFLOW_EXPRESSION_STABILIZATION_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A_SYNTHETIC_BENCHMARK_TIMEOUT_STABILIZATION_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_TRANSITION.map(
        (entry) => entry.path,
      ),
    ]);
    for (const path of protectedPaths) {
      expect(isCycle3eaTransitionRoutingRequired([path]), path).toBe(true);
      expect(isCycle3dTransitionRoutingRequired([path]), path).toBe(true);
      expect(isCycle2zTransitionRoutingRequired([path]), path).toBe(true);
    }
    expect(isCycle3eaTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle3eaTransitionRoutingRequired([])).toBe(false);
    expect(isCycle3eaTransitionRoutingRequired(["unreviewed"])).toBe(false);
  });

  function expectExactTransition(
    allowed: (
      entries: readonly { readonly path: string; readonly status: string }[],
    ) => boolean,
    entries: readonly { readonly path: string; readonly status: string }[],
    expectedCount: number,
  ): void {
    expect(entries).toHaveLength(expectedCount);
    expect(allowed(entries)).toBe(true);
    expect(allowed([...entries].reverse())).toBe(false);
    for (const [index, entry] of entries.entries()) {
      expect(
        allowed(entries.filter((_, candidate) => candidate !== index)),
      ).toBe(false);
      expect(
        allowed([
          ...entries,
          { path: entry.path, status: entry.status === "M" ? "A" : "M" },
        ]),
      ).toBe(false);
    }
    expect(allowed([...entries, { path: "unreviewed", status: "M" }])).toBe(
      false,
    );
  }
});

describe("Cycle 2x personal quality-measurement routing", () => {
  it("accepts only one direct child of the promoted Cycle 2w documentation", () => {
    expect(isCycle2xBaselineMergeBaseAllowed(CYCLE_2X_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2xBaselineMergeBaseAllowed("a".repeat(40))).toBe(false);
    expect(isCycle2xBaselineMergeBaseAllowed(undefined)).toBe(false);

    const revision = CYCLE_2X_SOURCE_REVISION;
    const valid = [
      "1",
      "1",
      revision,
      `${revision} ${CYCLE_2X_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2xDirectChildAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "2";
      },
      (values: string[]) => {
        values[1] = "2";
      },
      (values: string[]) => {
        values[2] = CYCLE_2X_BASELINE_REVISION;
      },
      (values: string[]) => {
        values[2] = "e".repeat(40);
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[3] = `${revision} ${"d".repeat(40)}`;
      },
      (values: string[]) => {
        values[3] += ` ${"f".repeat(40)}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2xDirectChildAllowed(
          ...(values as Parameters<typeof isCycle2xDirectChildAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("accepts only the exact three-commit validator-isolation corrective chain", () => {
    const revision = "e".repeat(40);
    const valid = [
      "3",
      "3",
      revision,
      `${revision} ${CYCLE_2X_VALIDATOR_ISOLATION_REVISION}`,
      `${CYCLE_2X_SOURCE_REVISION} ${CYCLE_2X_BASELINE_REVISION}`,
      `${CYCLE_2X_VALIDATOR_ISOLATION_REVISION} ${CYCLE_2X_SOURCE_REVISION}`,
    ] as const;
    expect(isCycle2xCorrectiveChainAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "2";
      },
      (values: string[]) => {
        values[1] = "4";
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[2] = CYCLE_2X_SOURCE_REVISION;
      },
      (values: string[]) => {
        values[2] = CYCLE_2X_BASELINE_REVISION;
      },
      (values: string[]) => {
        values[2] = CYCLE_2X_VALIDATOR_ISOLATION_REVISION;
      },
      (values: string[]) => {
        values[3] = `${revision} ${CYCLE_2X_SOURCE_REVISION}`;
      },
      (values: string[]) => {
        values[3] += ` ${CYCLE_2X_SOURCE_REVISION}`;
      },
      (values: string[]) => {
        values[4] = `${CYCLE_2X_SOURCE_REVISION} ${"d".repeat(40)}`;
      },
      (values: string[]) => {
        values[4] += ` ${"d".repeat(40)}`;
      },
      (values: string[]) => {
        values[5] = `${CYCLE_2X_VALIDATOR_ISOLATION_REVISION} ${CYCLE_2X_BASELINE_REVISION}`;
      },
      (values: string[]) => {
        values[5] += ` ${CYCLE_2X_BASELINE_REVISION}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2xCorrectiveChainAllowed(
          ...(values as Parameters<typeof isCycle2xCorrectiveChainAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("requires the exact sorted personal quality-measurement source transition", () => {
    expect(CYCLE_2X_SOURCE_TRANSITION).toHaveLength(12);
    expect(isCycle2xCommitDiffSetAllowed(CYCLE_2X_SOURCE_TRANSITION)).toBe(
      true,
    );
    expect(
      isCycle2xCommitDiffSetAllowed([...CYCLE_2X_SOURCE_TRANSITION].reverse()),
    ).toBe(false);
    for (const [index, entry] of CYCLE_2X_SOURCE_TRANSITION.entries()) {
      expect(
        isCycle2xCommitDiffSetAllowed(
          CYCLE_2X_SOURCE_TRANSITION.filter(
            (_, candidate) => candidate !== index,
          ),
        ),
        `missing:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2xCommitDiffSetAllowed([...CYCLE_2X_SOURCE_TRANSITION, entry]),
        `duplicate:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2xCommitDiffSetAllowed(
          CYCLE_2X_SOURCE_TRANSITION.map((candidate, candidateIndex) =>
            candidateIndex === index
              ? {
                  ...candidate,
                  status: candidate.status === "M" ? "A" : "M",
                }
              : candidate,
          ),
        ),
        `status:${entry.path}`,
      ).toBe(false);
    }
    expect(
      isCycle2xCommitDiffSetAllowed([
        ...CYCLE_2X_SOURCE_TRANSITION,
        { path: "unreviewed", status: "A" },
      ]),
    ).toBe(false);
  });

  it("requires exact isolation, routing-closure, and cumulative corrective tuples", () => {
    const transitions: readonly [
      string,
      (
        entries: readonly { readonly path: string; readonly status: string }[],
      ) => boolean,
      readonly { readonly path: string; readonly status: string }[],
      number,
    ][] = [
      [
        "isolation",
        isCycle2xValidatorIsolationCommitDiffSetAllowed,
        CYCLE_2X_VALIDATOR_ISOLATION_TRANSITION,
        4,
      ],
      [
        "routing_closure",
        isCycle2xRoutingClosureCommitDiffSetAllowed,
        CYCLE_2X_ROUTING_CLOSURE_TRANSITION,
        6,
      ],
      [
        "cumulative",
        isCycle2xCorrectiveCumulativeDiffSetAllowed,
        CYCLE_2X_CORRECTIVE_CUMULATIVE_TRANSITION,
        15,
      ],
    ];
    for (const [name, allowed, entries, count] of transitions) {
      expect(entries, name).toHaveLength(count);
      expect(allowed(entries), name).toBe(true);
      expect(allowed([...entries].reverse()), `${name}:reversed`).toBe(false);
      expect(allowed(entries.slice(0, -1)), `${name}:missing`).toBe(false);
      expect(allowed([...entries, entries[0]!]), `${name}:duplicate`).toBe(
        false,
      );
      expect(
        allowed([
          { ...entries[0]!, status: entries[0]!.status === "M" ? "A" : "M" },
          ...entries.slice(1),
        ]),
        `${name}:status`,
      ).toBe(false);
      expect(
        allowed([
          { ...entries[0]!, path: "same-length-substitution" },
          ...entries.slice(1),
        ]),
        `${name}:path`,
      ).toBe(false);
      expect(
        allowed([...entries, { path: "unreviewed", status: "A" }]),
        `${name}:extra`,
      ).toBe(false);
    }
    expect(
      isCycle2xRoutingClosureCommitDiffSetAllowed(
        CYCLE_2X_VALIDATOR_ISOLATION_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isCycle2xRoutingClosureCommitDiffSetAllowed([
        ...CYCLE_2X_ROUTING_CLOSURE_TRANSITION,
        {
          path: "packages/personal-filing-corpus/src/personal-filing-fact-comparison.ts",
          status: "M",
        },
      ]),
    ).toBe(false);
  });

  it("routes every protected personal-corpus or admission surface", () => {
    expect(CYCLE_2X_PROTECTED_SURFACE_PATHS).toHaveLength(37);
    expect(new Set(CYCLE_2X_PROTECTED_SURFACE_PATHS).size).toBe(37);
    for (const path of CYCLE_2X_PROTECTED_SURFACE_PATHS) {
      expect(isCycle2xTransitionRoutingRequired([path]), path).toBe(true);
      expect(
        isCycle2xTransitionRoutingRequired(["unreviewed", path]),
        path,
      ).toBe(true);
    }
    expect(isCycle2xTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2xTransitionRoutingRequired([])).toBe(false);
    expect(isCycle2xTransitionRoutingRequired(["unreviewed"])).toBe(false);
  });
});

describe("Cycle 2w personal raw fact-extraction routing", () => {
  it("accepts only one direct child of the promoted Cycle 2v documentation", () => {
    expect(isCycle2wBaselineMergeBaseAllowed(CYCLE_2W_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2wBaselineMergeBaseAllowed("a".repeat(40))).toBe(false);
    expect(isCycle2wBaselineMergeBaseAllowed(undefined)).toBe(false);

    const revision = "e".repeat(40);
    const valid = [
      "1",
      "1",
      revision,
      `${revision} ${CYCLE_2W_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2wDirectChildAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "2";
      },
      (values: string[]) => {
        values[1] = "2";
      },
      (values: string[]) => {
        values[2] = CYCLE_2W_BASELINE_REVISION;
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[3] = `${revision} ${"d".repeat(40)}`;
      },
      (values: string[]) => {
        values[3] += ` ${"f".repeat(40)}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2wDirectChildAllowed(
          ...(values as Parameters<typeof isCycle2wDirectChildAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("requires the exact sorted personal raw fact-extraction source transition", () => {
    expect(CYCLE_2W_SOURCE_TRANSITION).toHaveLength(13);
    expect(isCycle2wCommitDiffSetAllowed(CYCLE_2W_SOURCE_TRANSITION)).toBe(
      true,
    );
    expect(
      isCycle2wCommitDiffSetAllowed([...CYCLE_2W_SOURCE_TRANSITION].reverse()),
    ).toBe(false);
    for (const [index, entry] of CYCLE_2W_SOURCE_TRANSITION.entries()) {
      expect(
        isCycle2wCommitDiffSetAllowed(
          CYCLE_2W_SOURCE_TRANSITION.filter(
            (_, candidate) => candidate !== index,
          ),
        ),
        `missing:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2wCommitDiffSetAllowed([...CYCLE_2W_SOURCE_TRANSITION, entry]),
        `duplicate:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2wCommitDiffSetAllowed(
          CYCLE_2W_SOURCE_TRANSITION.map((candidate, candidateIndex) =>
            candidateIndex === index
              ? {
                  ...candidate,
                  status: candidate.status === "M" ? "A" : "M",
                }
              : candidate,
          ),
        ),
        `status:${entry.path}`,
      ).toBe(false);
    }
    expect(
      isCycle2wCommitDiffSetAllowed([
        ...CYCLE_2W_SOURCE_TRANSITION,
        { path: "unreviewed", status: "A" },
      ]),
    ).toBe(false);
  });

  it("routes every protected personal-corpus or admission surface", () => {
    expect(CYCLE_2W_PROTECTED_SURFACE_PATHS).toHaveLength(33);
    expect(new Set(CYCLE_2W_PROTECTED_SURFACE_PATHS).size).toBe(33);
    for (const path of CYCLE_2W_PROTECTED_SURFACE_PATHS) {
      expect(isCycle2wTransitionRoutingRequired([path]), path).toBe(true);
      expect(
        isCycle2wTransitionRoutingRequired(["unreviewed", path]),
        path,
      ).toBe(true);
    }
    expect(isCycle2wTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2wTransitionRoutingRequired([])).toBe(false);
    expect(isCycle2wTransitionRoutingRequired(["unreviewed"])).toBe(false);
  });
});
describe("Cycle 2v personal fact-comparison routing", () => {
  it("accepts only one direct child of the promoted Cycle 2u documentation", () => {
    expect(isCycle2vBaselineMergeBaseAllowed(CYCLE_2V_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2vBaselineMergeBaseAllowed("a".repeat(40))).toBe(false);
    expect(isCycle2vBaselineMergeBaseAllowed(undefined)).toBe(false);

    const revision = "e".repeat(40);
    const valid = [
      "1",
      "1",
      revision,
      `${revision} ${CYCLE_2V_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2vDirectChildAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "2";
      },
      (values: string[]) => {
        values[1] = "2";
      },
      (values: string[]) => {
        values[2] = CYCLE_2V_BASELINE_REVISION;
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[3] = `${revision} ${"d".repeat(40)}`;
      },
      (values: string[]) => {
        values[3] += ` ${"f".repeat(40)}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2vDirectChildAllowed(
          ...(values as Parameters<typeof isCycle2vDirectChildAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("requires the exact sorted personal fact-comparison source transition", () => {
    expect(CYCLE_2V_SOURCE_TRANSITION).toHaveLength(13);
    expect(isCycle2vCommitDiffSetAllowed(CYCLE_2V_SOURCE_TRANSITION)).toBe(
      true,
    );
    expect(
      isCycle2vCommitDiffSetAllowed([...CYCLE_2V_SOURCE_TRANSITION].reverse()),
    ).toBe(false);
    for (const [index, entry] of CYCLE_2V_SOURCE_TRANSITION.entries()) {
      expect(
        isCycle2vCommitDiffSetAllowed(
          CYCLE_2V_SOURCE_TRANSITION.filter(
            (_, candidate) => candidate !== index,
          ),
        ),
        `missing:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2vCommitDiffSetAllowed([...CYCLE_2V_SOURCE_TRANSITION, entry]),
        `duplicate:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2vCommitDiffSetAllowed(
          CYCLE_2V_SOURCE_TRANSITION.map((candidate, candidateIndex) =>
            candidateIndex === index
              ? {
                  ...candidate,
                  status: candidate.status === "M" ? "A" : "M",
                }
              : candidate,
          ),
        ),
        `status:${entry.path}`,
      ).toBe(false);
    }
    expect(
      isCycle2vCommitDiffSetAllowed([
        ...CYCLE_2V_SOURCE_TRANSITION,
        { path: "unreviewed", status: "A" },
      ]),
    ).toBe(false);
  });

  it("routes every protected personal-corpus or admission surface", () => {
    expect(CYCLE_2V_PROTECTED_SURFACE_PATHS).toHaveLength(28);
    expect(new Set(CYCLE_2V_PROTECTED_SURFACE_PATHS).size).toBe(28);
    for (const path of CYCLE_2V_PROTECTED_SURFACE_PATHS) {
      expect(isCycle2vTransitionRoutingRequired([path]), path).toBe(true);
      expect(
        isCycle2vTransitionRoutingRequired(["unreviewed", path]),
        path,
      ).toBe(true);
    }
    expect(isCycle2vTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2vTransitionRoutingRequired([])).toBe(false);
    expect(isCycle2vTransitionRoutingRequired(["unreviewed"])).toBe(false);
  });
});

describe("Cycle 2u personal fact-normalization routing", () => {
  it("accepts only one direct child of the promoted Cycle 2s documentation", () => {
    expect(isCycle2uBaselineMergeBaseAllowed(CYCLE_2U_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2uBaselineMergeBaseAllowed("a".repeat(40))).toBe(false);
    expect(isCycle2uBaselineMergeBaseAllowed(undefined)).toBe(false);

    const revision = "d".repeat(40);
    const valid = [
      "1",
      "1",
      revision,
      `${revision} ${CYCLE_2U_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2uDirectChildAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "2";
      },
      (values: string[]) => {
        values[1] = "2";
      },
      (values: string[]) => {
        values[2] = CYCLE_2U_BASELINE_REVISION;
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[3] = `${revision} ${"e".repeat(40)}`;
      },
      (values: string[]) => {
        values[3] += ` ${"f".repeat(40)}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2uDirectChildAllowed(
          ...(values as Parameters<typeof isCycle2uDirectChildAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("requires the exact sorted personal fact-normalization source transition", () => {
    expect(CYCLE_2U_SOURCE_TRANSITION).toHaveLength(12);
    expect(isCycle2uCommitDiffSetAllowed(CYCLE_2U_SOURCE_TRANSITION)).toBe(
      true,
    );
    expect(
      isCycle2uCommitDiffSetAllowed([...CYCLE_2U_SOURCE_TRANSITION].reverse()),
    ).toBe(false);
    for (const [index, entry] of CYCLE_2U_SOURCE_TRANSITION.entries()) {
      expect(
        isCycle2uCommitDiffSetAllowed(
          CYCLE_2U_SOURCE_TRANSITION.filter(
            (_, candidate) => candidate !== index,
          ),
        ),
        `missing:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2uCommitDiffSetAllowed([...CYCLE_2U_SOURCE_TRANSITION, entry]),
        `duplicate:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2uCommitDiffSetAllowed(
          CYCLE_2U_SOURCE_TRANSITION.map((candidate, candidateIndex) =>
            candidateIndex === index
              ? {
                  ...candidate,
                  status: candidate.status === "M" ? "A" : "M",
                }
              : candidate,
          ),
        ),
        `status:${entry.path}`,
      ).toBe(false);
    }
    expect(
      isCycle2uCommitDiffSetAllowed([
        ...CYCLE_2U_SOURCE_TRANSITION,
        { path: "unreviewed", status: "A" },
      ]),
    ).toBe(false);
  });

  it("routes every protected personal-corpus or admission surface", () => {
    expect(CYCLE_2U_PROTECTED_SURFACE_PATHS).toHaveLength(23);
    expect(new Set(CYCLE_2U_PROTECTED_SURFACE_PATHS).size).toBe(23);
    for (const path of CYCLE_2U_PROTECTED_SURFACE_PATHS) {
      expect(isCycle2uTransitionRoutingRequired([path]), path).toBe(true);
      expect(
        isCycle2uTransitionRoutingRequired(["unreviewed", path]),
        path,
      ).toBe(true);
    }
    expect(isCycle2uTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2uTransitionRoutingRequired([])).toBe(false);
    expect(isCycle2uTransitionRoutingRequired(["unreviewed"])).toBe(false);
  });
});

describe("Cycle 2s personal payload-custody routing", () => {
  it("accepts only one direct child of the promoted Cycle 2r documentation", () => {
    expect(isCycle2sBaselineMergeBaseAllowed(CYCLE_2S_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2sBaselineMergeBaseAllowed("a".repeat(40))).toBe(false);
    expect(isCycle2sBaselineMergeBaseAllowed(undefined)).toBe(false);

    const revision = "c".repeat(40);
    const valid = [
      "1",
      "1",
      revision,
      `${revision} ${CYCLE_2S_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2sDirectChildAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "2";
      },
      (values: string[]) => {
        values[1] = "2";
      },
      (values: string[]) => {
        values[2] = CYCLE_2S_BASELINE_REVISION;
      },
      (values: string[]) => {
        values[2] = "not-a-commit";
      },
      (values: string[]) => {
        values[3] = `${revision} ${"e".repeat(40)}`;
      },
      (values: string[]) => {
        values[3] += ` ${"f".repeat(40)}`;
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        isCycle2sDirectChildAllowed(
          ...(values as Parameters<typeof isCycle2sDirectChildAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("requires the exact sorted payload-custody source transition", () => {
    expect(CYCLE_2S_SOURCE_TRANSITION).toHaveLength(11);
    expect(isCycle2sCommitDiffSetAllowed(CYCLE_2S_SOURCE_TRANSITION)).toBe(
      true,
    );
    expect(
      isCycle2sCommitDiffSetAllowed([...CYCLE_2S_SOURCE_TRANSITION].reverse()),
    ).toBe(false);
    for (const [index, entry] of CYCLE_2S_SOURCE_TRANSITION.entries()) {
      expect(
        isCycle2sCommitDiffSetAllowed(
          CYCLE_2S_SOURCE_TRANSITION.filter(
            (_, candidate) => candidate !== index,
          ),
        ),
        `missing:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2sCommitDiffSetAllowed([...CYCLE_2S_SOURCE_TRANSITION, entry]),
        `duplicate:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2sCommitDiffSetAllowed(
          CYCLE_2S_SOURCE_TRANSITION.map((candidate, candidateIndex) =>
            candidateIndex === index
              ? {
                  ...candidate,
                  status: candidate.status === "M" ? "A" : "M",
                }
              : candidate,
          ),
        ),
        `status:${entry.path}`,
      ).toBe(false);
    }
    expect(
      isCycle2sCommitDiffSetAllowed([
        ...CYCLE_2S_SOURCE_TRANSITION,
        { path: "unexpected", status: "A" },
      ]),
    ).toBe(false);
  });

  it("routes all personal, verifier, workflow, and enterprise surfaces first", () => {
    expect(CYCLE_2S_PROTECTED_SURFACE_PATHS).toHaveLength(19);
    expect(new Set(CYCLE_2S_PROTECTED_SURFACE_PATHS).size).toBe(19);
    for (const path of CYCLE_2S_PROTECTED_SURFACE_PATHS) {
      expect(isCycle2sTransitionRoutingRequired([path]), path).toBe(true);
      expect(
        isCycle2sTransitionRoutingRequired(["unexpected", path]),
        path,
      ).toBe(true);
    }
    expect(isCycle2sTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2sTransitionRoutingRequired([])).toBe(false);
    expect(isCycle2sTransitionRoutingRequired(["unexpected"])).toBe(false);
  });
});

describe("Cycle 2r personal payload-identity routing", () => {
  it("accepts only one direct child of the promoted Cycle 2q documentation", () => {
    expect(isCycle2rBaselineMergeBaseAllowed(CYCLE_2R_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2rBaselineMergeBaseAllowed("0".repeat(40))).toBe(false);
    expect(isCycle2rBaselineMergeBaseAllowed(undefined)).toBe(false);

    const revision = "f".repeat(40);
    const valid = [
      "1",
      "1",
      revision,
      `${revision} ${CYCLE_2R_BASELINE_REVISION}`,
    ] as const;
    expect(isCycle2rDirectChildAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "2";
      },
      (values: string[]) => {
        values[1] = "2";
      },
      (values: string[]) => {
        values[2] = CYCLE_2R_BASELINE_REVISION;
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
        isCycle2rDirectChildAllowed(
          ...(values as Parameters<typeof isCycle2rDirectChildAllowed>),
        ),
      ).toBe(false);
    }
  });

  it("requires the exact sorted payload-identity source transition", () => {
    expect(isCycle2rCommitDiffSetAllowed(CYCLE_2R_SOURCE_TRANSITION)).toBe(
      true,
    );
    expect(
      isCycle2rCommitDiffSetAllowed([...CYCLE_2R_SOURCE_TRANSITION].reverse()),
    ).toBe(false);
    for (const [index, entry] of CYCLE_2R_SOURCE_TRANSITION.entries()) {
      expect(
        isCycle2rCommitDiffSetAllowed(
          CYCLE_2R_SOURCE_TRANSITION.filter(
            (_, candidate) => candidate !== index,
          ),
        ),
        `missing:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2rCommitDiffSetAllowed([...CYCLE_2R_SOURCE_TRANSITION, entry]),
        `duplicate:${entry.path}`,
      ).toBe(false);
      expect(
        isCycle2rCommitDiffSetAllowed(
          CYCLE_2R_SOURCE_TRANSITION.map((candidate, candidateIndex) =>
            candidateIndex === index
              ? {
                  ...candidate,
                  status: candidate.status === "M" ? "A" : "M",
                }
              : candidate,
          ),
        ),
        `status:${entry.path}`,
      ).toBe(false);
    }
    expect(
      isCycle2rCommitDiffSetAllowed([
        ...CYCLE_2R_SOURCE_TRANSITION,
        { path: "unreviewed", status: "A" },
      ]),
    ).toBe(false);
  });

  it("routes all personal, verifier, workflow, and enterprise surfaces first", () => {
    expect(CYCLE_2R_PROTECTED_SURFACE_PATHS).toHaveLength(16);
    expect(new Set(CYCLE_2R_PROTECTED_SURFACE_PATHS).size).toBe(16);
    for (const path of CYCLE_2R_PROTECTED_SURFACE_PATHS) {
      expect(isCycle2rTransitionRoutingRequired([path]), path).toBe(true);
      expect(
        isCycle2rTransitionRoutingRequired(["unreviewed", path]),
        path,
      ).toBe(true);
    }
    expect(isCycle2rTransitionRoutingRequired(undefined)).toBe(false);
    expect(isCycle2rTransitionRoutingRequired([])).toBe(false);
    expect(isCycle2rTransitionRoutingRequired(["unreviewed"])).toBe(false);
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

  it("admits the exact cumulative corpus-validity bridge and Cycle 2o paths", () => {
    const cycle2oCumulativePaths = [
      ...new Set([
        ...CYCLE_2N_CUMULATIVE_DIFF_PATHS,
        "packages/filing-parser/src/corpus-admission-security.test.ts",
        "packages/filing-parser/src/corpus-admission.ts",
        ...CYCLE_2O_TRANSITION.map((entry) => entry.path),
      ]),
    ].sort();
    const cumulativeEntries = cycle2oCumulativePaths.map((path) => {
      const preBaseline = CYCLE_2M_PRE_BASELINE_CUMULATIVE_ENTRIES.find(
        (entry) => entry.path === path,
      );
      return {
        path,
        status:
          path === ".npmrc"
            ? "D"
            : (preBaseline?.status ??
              (CYCLE_2M_CUMULATIVE_DIFF_PATHS.includes(path) ||
              path ===
                "packages/filing-parser/src/corpus-admission-security.test.ts" ||
              path === "packages/filing-parser/src/corpus-admission.ts"
                ? "M"
                : "A")),
      };
    });
    expect(isCycle2cCommitDiffSetAllowed(cumulativeEntries)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cumulativeEntries.slice(1))).toBe(
      false,
    );
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
        "1",
        "2",
        revision,
        `${revision} ${CYCLE_2N_BASELINE_REVISION}`,
      ),
    ).toBe(false);
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

    const cumulativeEntries = CYCLE_2N_CUMULATIVE_DIFF_PATHS.map((path) => {
      const preBaseline = CYCLE_2M_PRE_BASELINE_CUMULATIVE_ENTRIES.find(
        (entry) => entry.path === path,
      );
      return {
        path,
        status:
          path === ".npmrc"
            ? "D"
            : (preBaseline?.status ??
              (CYCLE_2M_CUMULATIVE_DIFF_PATHS.includes(path) ? "M" : "A")),
      };
    });
    expect(isCycle2cCommitDiffSetAllowed(cumulativeEntries)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cumulativeEntries.slice(0, -1))).toBe(
      false,
    );
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
  it("freezes the exact v3 core and acceptance trees", () => {
    expect(CYCLE_2M_CORE_TREE).toHaveLength(15);
    expect(CYCLE_2M_ACCEPTANCE_TREE).toHaveLength(13);
    expect(isCycle2mCoreTreeAllowed([])).toBe(true);
    expect(isCycle2mAcceptanceTreeAllowed([])).toBe(true);
    expect(isCycle2mCoreTreeAllowed(CYCLE_2M_CORE_TREE)).toBe(true);
    expect(isCycle2mAcceptanceTreeAllowed(CYCLE_2M_ACCEPTANCE_TREE)).toBe(true);
    expect(isCycle2kCoreTreeAllowed(CYCLE_2M_CORE_TREE)).toBe(false);
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
          "packages/filing-parser-cross-engine-execution-acceptance/src/extra.ts",
        ].sort(),
      ),
    ).toBe(false);
  });

  it("requires the exact baseline and ordered 28-path A/M transition", () => {
    expect(isCycle2mBaselineMergeBaseAllowed(CYCLE_2M_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2mBaselineMergeBaseAllowed(CYCLE_2M_SOURCE_REVISION)).toBe(
      false,
    );
    expect(isCycle2mBaselineMergeBaseAllowed(undefined)).toBe(false);
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
      expect(isCycle2cCommitDiffEntryAllowed(entry.status, entry.path)).toBe(
        true,
      );
    }
    expect(
      isCycle2mCommitDiffSetAllowed([
        ...CYCLE_2M_TRANSITION,
        { path: "unexpected", status: "A" },
      ]),
    ).toBe(false);
  });

  it("requires the exact five-file corrective commit and two-commit topology", () => {
    const correctionRevision = "f".repeat(40);
    const correctiveParents = [correctionRevision, CYCLE_2M_SOURCE_REVISION];
    const sourceParents = [
      CYCLE_2M_SOURCE_REVISION,
      CYCLE_2M_BASELINE_REVISION,
    ];
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
      isCycle2mCorrectiveTopologyAllowed(
        correctionRevision,
        correctiveParents,
        sourceParents,
        2,
        2,
      ),
    ).toBe(true);
    expect(
      isCycle2mCorrectiveTopologyAllowed(
        correctionRevision,
        [...correctiveParents, "e".repeat(40)],
        sourceParents,
        2,
        2,
      ),
    ).toBe(false);
    expect(
      isCycle2mCorrectiveTopologyAllowed(
        correctionRevision,
        correctiveParents,
        [CYCLE_2M_SOURCE_REVISION, "e".repeat(40)],
        2,
        2,
      ),
    ).toBe(false);
    expect(
      isCycle2mCorrectiveTopologyAllowed(
        correctionRevision,
        correctiveParents,
        sourceParents,
        3,
        2,
      ),
    ).toBe(false);
    expect(
      isCycle2mCorrectiveTopologyAllowed(
        correctionRevision,
        correctiveParents,
        sourceParents,
        2,
        3,
      ),
    ).toBe(false);
  });

  it("routes Cycle 2m first and admits only its exact cumulative history", () => {
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

    const cumulativeEntries = CYCLE_2M_CUMULATIVE_DIFF_PATHS.map((path) => {
      const preBaseline = CYCLE_2M_PRE_BASELINE_CUMULATIVE_ENTRIES.find(
        (entry) => entry.path === path,
      );
      return {
        path,
        status: path === ".npmrc" ? "D" : (preBaseline?.status ?? "M"),
      };
    });
    expect(CYCLE_2M_CUMULATIVE_DIFF_PATHS).toHaveLength(172);
    expect(isCycle2cCommitDiffSetAllowed(cumulativeEntries)).toBe(true);
    for (const omitted of cumulativeEntries)
      expect(
        isCycle2cCommitDiffSetAllowed(
          cumulativeEntries.filter((entry) => entry !== omitted),
        ),
      ).toBe(false);
    for (const preBaseline of CYCLE_2M_PRE_BASELINE_CUMULATIVE_ENTRIES)
      expect(
        isCycle2cCommitDiffSetAllowed(
          cumulativeEntries.map((entry) =>
            entry.path === preBaseline.path
              ? {
                  ...entry,
                  status: preBaseline.status === "A" ? "M" : "A",
                }
              : entry,
          ),
        ),
      ).toBe(false);
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
      expect(isCycle2cCommitDiffEntryAllowed(entry.status, entry.path)).toBe(
        true,
      );
    }
    expect(
      isCycle2kCommitDiffSetAllowed([
        ...CYCLE_2K_TRANSITION,
        { path: "unexpected", status: "A" },
      ]),
    ).toBe(false);
    const cumulativeEntries = CYCLE_2K_CUMULATIVE_DIFF_PATHS.map((path) => ({
      path,
      status: path === ".npmrc" ? "D" : "M",
    }));
    expect(isCycle2cCommitDiffSetAllowed(cumulativeEntries)).toBe(true);
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
    const fastifyMaintenance =
      FASTIFY_5_12_1_MAINTENANCE_CUMULATIVE_DIFF_PATHS.map((path) => ({
        path,
        status: path === CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH ? "M" : "A",
      }));
    const pnpmDependencyPolicyMaintenance =
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_CUMULATIVE_DIFF_PATHS.map((path) => ({
        path,
        status:
          path === ".npmrc"
            ? "D"
            : path === CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH
              ? "M"
              : "A",
      }));
    const cycle2i = CYCLE_2I_CUMULATIVE_DIFF_PATHS.map((path) => ({
      path,
      status:
        path === ".npmrc"
          ? "D"
          : path === CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH
            ? "M"
            : "A",
    }));
    const cycle2j = CYCLE_2J_CUMULATIVE_DIFF_PATHS.map((path) => ({
      path,
      status:
        path === ".npmrc"
          ? "D"
          : path === CYCLE_2H_PRE_BASELINE_MAINTENANCE_PATH
            ? "M"
            : "A",
    }));
    expect(complete).toHaveLength(33);
    expect(legacy).toHaveLength(32);
    expect(cycle2d).toHaveLength(44);
    expect(cycle2e).toHaveLength(55);
    expect(cycle2f).toHaveLength(64);
    expect(cycle2g).toHaveLength(73);
    expect(cycle2hBaseline).toHaveLength(74);
    expect(cycle2h).toHaveLength(82);
    expect(fastifyMaintenance).toHaveLength(85);
    expect(pnpmDependencyPolicyMaintenance).toHaveLength(88);
    expect(cycle2i).toHaveLength(98);
    expect(cycle2j).toHaveLength(129);
    expect(isCycle2cCommitDiffSetAllowed(complete)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(legacy)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2d)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2e)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2f)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2g)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2hBaseline)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2h)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(fastifyMaintenance)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(pnpmDependencyPolicyMaintenance)).toBe(
      true,
    );
    expect(isCycle2cCommitDiffSetAllowed(cycle2i)).toBe(true);
    expect(isCycle2cCommitDiffSetAllowed(cycle2j)).toBe(true);
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
    for (const omitted of fastifyMaintenance) {
      expect(
        isCycle2cCommitDiffSetAllowed(
          fastifyMaintenance.filter((entry) => entry.path !== omitted.path),
        ),
      ).toBe(false);
    }
    for (const omitted of pnpmDependencyPolicyMaintenance) {
      expect(
        isCycle2cCommitDiffSetAllowed(
          pnpmDependencyPolicyMaintenance.filter(
            (entry) => entry.path !== omitted.path,
          ),
        ),
      ).toBe(false);
    }
    for (const omitted of cycle2i) {
      expect(
        isCycle2cCommitDiffSetAllowed(
          cycle2i.filter((entry) => entry.path !== omitted.path),
        ),
      ).toBe(false);
    }
    for (const omitted of cycle2j) {
      expect(
        isCycle2cCommitDiffSetAllowed(
          cycle2j.filter((entry) => entry.path !== omitted.path),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2cCommitDiffSetAllowed(
        pnpmDependencyPolicyMaintenance.map((entry) =>
          entry.path === ".npmrc" ? { ...entry, status: "M" } : entry,
        ),
      ),
    ).toBe(false);
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
        ...fastifyMaintenance,
        { path: "apps/api/src/app.ts", status: "M" },
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

  it("admits only the exact post-Cycle-2h Fastify maintenance successor", () => {
    expect(FASTIFY_5_12_1_MAINTENANCE_TRANSITION).toHaveLength(8);
    expect(
      FASTIFY_5_12_1_MAINTENANCE_TRANSITION.every(
        (entry) => entry.status === "M",
      ),
    ).toBe(true);
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
      expect(isCycle2cCommitDiffEntryAllowed("A", omitted.path)).toBe(true);
      expect(isCycle2cCommitDiffEntryAllowed("M", omitted.path)).toBe(true);
      expect(isCycle2cCommitDiffEntryAllowed("D", omitted.path)).toBe(false);
      expect(isCycle2cCommitDiffEntryAllowed("R100", omitted.path)).toBe(false);
    }
    expect(
      isFastify5121MaintenanceCommitDiffSetAllowed([
        ...FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
        { path: "apps/api/src/app.ts", status: "M" },
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
      isCycle2hCommitDiffSetAllowed([
        ...CYCLE_2H_TRANSITION,
        ...FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
      ]),
    ).toBe(false);

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
      isFastify5121MaintenanceTransitionRoutingRequired([
        { path: "apps/api/package.json" },
      ]),
    ).toBe(true);
    expect(
      isFastify5121MaintenanceTransitionRoutingRequired([
        { path: "THIRD_PARTY_NOTICES.md" },
        { path: "pnpm-lock.yaml" },
        { path: "scripts/verify-licenses.ts" },
      ]),
    ).toBe(false);
    expect(
      isFastify5121MaintenanceTransitionRoutingRequired(CYCLE_2H_TRANSITION),
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
      expect(isCycle2cCommitDiffEntryAllowed(entry.status, entry.path)).toBe(
        true,
      );
      expect(isCycle2cCommitDiffEntryAllowed("D", entry.path)).toBe(false);
      expect(isCycle2cCommitDiffEntryAllowed("R100", entry.path)).toBe(false);

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

  it("admits and routes only the exact Cycle 2j execution successor before Cycle 2i and maintenance", () => {
    expect(CYCLE_2J_CORE_TREE).toHaveLength(12);
    expect(CYCLE_2J_ACCEPTANCE_TREE).toHaveLength(13);
    expect(isCycle2jCoreTreeAllowed([])).toBe(true);
    expect(isCycle2jAcceptanceTreeAllowed([])).toBe(true);
    expect(isCycle2jCoreTreeAllowed(CYCLE_2J_CORE_TREE)).toBe(true);
    expect(isCycle2jAcceptanceTreeAllowed(CYCLE_2J_ACCEPTANCE_TREE)).toBe(true);
    expect(isCycle2jCoreTreeAllowed([...CYCLE_2J_CORE_TREE].reverse())).toBe(
      false,
    );
    expect(
      isCycle2jAcceptanceTreeAllowed([...CYCLE_2J_ACCEPTANCE_TREE].reverse()),
    ).toBe(false);

    for (const omitted of CYCLE_2J_CORE_TREE) {
      expect(
        isCycle2jCoreTreeAllowed(
          CYCLE_2J_CORE_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    for (const omitted of CYCLE_2J_ACCEPTANCE_TREE) {
      expect(
        isCycle2jAcceptanceTreeAllowed(
          CYCLE_2J_ACCEPTANCE_TREE.filter((path) => path !== omitted),
        ),
      ).toBe(false);
    }
    expect(
      isCycle2jCoreTreeAllowed(
        [...CYCLE_2J_CORE_TREE, CYCLE_2J_CORE_TREE[0] as string].sort(),
      ),
    ).toBe(false);
    expect(
      isCycle2jAcceptanceTreeAllowed(
        [
          ...CYCLE_2J_ACCEPTANCE_TREE,
          CYCLE_2J_ACCEPTANCE_TREE[0] as string,
        ].sort(),
      ),
    ).toBe(false);
    expect(
      isCycle2jCoreTreeAllowed(
        [
          ...CYCLE_2J_CORE_TREE,
          "packages/filing-parser-normalization-execution/src/unreviewed.ts",
        ].sort(),
      ),
    ).toBe(false);
    expect(
      isCycle2jAcceptanceTreeAllowed(
        [
          ...CYCLE_2J_ACCEPTANCE_TREE,
          "packages/filing-parser-normalization-execution-acceptance/src/unreviewed.ts",
        ].sort(),
      ),
    ).toBe(false);

    expect(isCycle2jBaselineMergeBaseAllowed(CYCLE_2J_BASELINE_REVISION)).toBe(
      true,
    );
    expect(isCycle2jBaselineMergeBaseAllowed(CYCLE_2I_BASELINE_REVISION)).toBe(
      false,
    );
    expect(isCycle2jBaselineMergeBaseAllowed("0".repeat(40))).toBe(false);
    expect(isCycle2jBaselineMergeBaseAllowed(undefined)).toBe(false);

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
      expect(isCycle2cCommitDiffEntryAllowed(entry.status, entry.path)).toBe(
        true,
      );
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
      expect(
        isCycle2jTransitionRoutingRequired(
          CYCLE_2J_TRANSITION_PATHS.filter((candidate) => candidate !== path),
        ),
      ).toBe(true);
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
      CYCLE_2I_TRANSITION_PATHS.includes(
        path as (typeof CYCLE_2I_TRANSITION_PATHS)[number],
      ),
    );
    const pnpmOverlap = CYCLE_2J_TRANSITION_PATHS.filter((path) =>
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS.includes(
        path as (typeof PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS)[number],
      ),
    );
    expect(isCycle2jTransitionRoutingRequired(cycle2iOverlap)).toBe(true);
    expect(isCycle2iTransitionRoutingRequired(cycle2iOverlap)).toBe(true);
    expect(isCycle2jTransitionRoutingRequired(pnpmOverlap)).toBe(true);
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired(pnpmOverlap),
    ).toBe(true);
  });

  it("admits and routes only the exact pnpm dependency-policy maintenance successor before authenticated replay", () => {
    expect(PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION).toHaveLength(10);
    expect(
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.filter(
        (entry) => entry.status === "D",
      ),
    ).toEqual([{ path: ".npmrc", status: "D" }]);
    expect(
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.filter(
        (entry) => entry.status === "M",
      ),
    ).toHaveLength(9);
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

      if (entry.path === ".npmrc") {
        expect(isCycle2cCommitDiffEntryAllowed("D", entry.path)).toBe(true);
        for (const status of ["A", "M", "R100"]) {
          expect(isCycle2cCommitDiffEntryAllowed(status, entry.path)).toBe(
            false,
          );
        }
      } else {
        expect(isCycle2cCommitDiffEntryAllowed("A", entry.path)).toBe(true);
        expect(isCycle2cCommitDiffEntryAllowed("M", entry.path)).toBe(true);
        expect(isCycle2cCommitDiffEntryAllowed("D", entry.path)).toBe(false);
        expect(isCycle2cCommitDiffEntryAllowed("R100", entry.path)).toBe(false);
      }

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
    expect(isCycle2cCommitDiffEntryAllowed("D", ".gitignore")).toBe(false);
    expect(isCycle2cCommitDiffEntryAllowed("D", "unreviewed.npmrc")).toBe(
      false,
    );

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
    for (const path of PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS) {
      expect(
        isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired([path]),
      ).toBe(true);
    }
    expect(isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired([])).toBe(
      false,
    );
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired(undefined),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired([
        ".npmrc",
        ".npmrc",
      ]),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired([
        "scripts/unreviewed-dependency-policy.ts",
      ]),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired([
        ...PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS,
        "scripts/unreviewed-dependency-policy.ts",
      ]),
    ).toBe(false);

    expect(
      isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS,
        [],
      ),
    ).toBe(true);
    expect(
      isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(
        undefined,
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_CUMULATIVE_DIFF_PATHS.map(
          (path) => ({ path }),
        ),
      ),
    ).toBe(true);
    for (const path of [".gitignore", ".npmrc", "pnpm-workspace.yaml"]) {
      expect(
        isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(undefined, [
          { path },
        ]),
      ).toBe(true);
    }
    expect(
      isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(
        undefined,
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.filter(
          (entry) =>
            ![".gitignore", ".npmrc", "pnpm-workspace.yaml"].includes(
              entry.path,
            ),
        ),
      ),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(
        undefined,
        FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
      ),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(undefined, [
        { path: "scripts/unreviewed-dependency-policy.ts" },
      ]),
    ).toBe(false);
    expect(
      isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(undefined, []),
    ).toBe(false);

    expect(
      isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired(["package.json"]),
    ).toBe(true);
    expect(isCiTestSerializationSurfaceRoutingRequired(["package.json"])).toBe(
      true,
    );
    expect(
      isCiTestSerializationCommitDiffSetAllowed(
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION,
      ),
    ).toBe(false);

    expect(
      isAuthenticatedReplayMaintenanceSurfaceRoutingRequired([
        AUTHENTICATED_REPLAY_MAINTENANCE_SURFACE_PATH,
      ]),
    ).toBe(true);
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
      isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed([
        ...PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION,
        ...AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION,
      ]),
    ).toBe(false);
  });

  it("admits and routes only the exact authenticated-replay maintenance successor before offline custody", () => {
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
      expect(isCycle2cCommitDiffEntryAllowed("A", entry.path)).toBe(true);
      expect(isCycle2cCommitDiffEntryAllowed("M", entry.path)).toBe(true);
      expect(isCycle2cCommitDiffEntryAllowed("D", entry.path)).toBe(false);
      expect(isCycle2cCommitDiffEntryAllowed("R100", entry.path)).toBe(false);
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
          {
            path: "packages/filing-payload-custody/src/unreviewed.ts",
            status,
          },
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
      isAuthenticatedReplayMaintenanceSurfaceRoutingRequired([
        AUTHENTICATED_REPLAY_MAINTENANCE_SURFACE_PATH,
      ]),
    ).toBe(true);
    expect(isAuthenticatedReplayMaintenanceSurfaceRoutingRequired([])).toBe(
      false,
    );
    expect(
      isAuthenticatedReplayMaintenanceSurfaceRoutingRequired(undefined),
    ).toBe(false);
    expect(
      isAuthenticatedReplayMaintenanceSurfaceRoutingRequired([
        "packages/filing-payload-custody/src/payload-custody-security.test.ts",
      ]),
    ).toBe(false);
    expect(
      isAuthenticatedReplayMaintenanceSurfaceRoutingRequired([
        AUTHENTICATED_REPLAY_MAINTENANCE_SURFACE_PATH,
        "packages/filing-payload-custody/src/payload-custody-security.test.ts",
      ]),
    ).toBe(false);
    expect(
      isAuthenticatedReplayMaintenanceSurfaceRoutingRequired([
        AUTHENTICATED_REPLAY_MAINTENANCE_SURFACE_PATH,
        AUTHENTICATED_REPLAY_MAINTENANCE_SURFACE_PATH,
      ]),
    ).toBe(false);

    const offlineOverlapPaths =
      AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION.filter((entry) =>
        OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION.some(
          (offlineEntry) => offlineEntry.path === entry.path,
        ),
      ).map((entry) => entry.path);
    expect(offlineOverlapPaths).toHaveLength(4);
    expect(
      isOfflineEvidenceInputCustodySurfaceRoutingRequired(offlineOverlapPaths),
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

  it("admits and routes only the exact offline-evidence input-custody successor", () => {
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
          {
            path: "packages/filing-payload-custody/src/unreviewed.ts",
            status,
          },
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
        "packages/filing-payload-custody/src/unreviewed.ts",
      ]),
    ).toBe(false);
    expect(
      isOfflineEvidenceInputCustodySurfaceRoutingRequired([
        "packages/filing-payload-custody/src/unreviewed.ts",
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

  it("admits and routes only the exact post-Fastify CI test serialization successor", () => {
    expect(CI_TEST_SERIALIZATION_TRANSITION).toHaveLength(5);
    expect(
      CI_TEST_SERIALIZATION_TRANSITION.every((entry) => entry.status === "M"),
    ).toBe(true);
    expect(
      isCiTestSerializationCommitDiffSetAllowed(
        CI_TEST_SERIALIZATION_TRANSITION,
      ),
    ).toBe(true);
    expect(
      isCiTestSerializationCommitDiffSetAllowed(
        [...CI_TEST_SERIALIZATION_TRANSITION].reverse(),
      ),
    ).toBe(true);

    for (const omitted of CI_TEST_SERIALIZATION_TRANSITION) {
      expect(
        isCiTestSerializationCommitDiffSetAllowed(
          CI_TEST_SERIALIZATION_TRANSITION.filter((entry) => entry !== omitted),
        ),
      ).toBe(false);
      expect(isCycle2cCommitDiffEntryAllowed("A", omitted.path)).toBe(true);
      expect(isCycle2cCommitDiffEntryAllowed("M", omitted.path)).toBe(true);
      expect(isCycle2cCommitDiffEntryAllowed("D", omitted.path)).toBe(false);
      expect(isCycle2cCommitDiffEntryAllowed("R100", omitted.path)).toBe(false);
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
        {
          path: "packages/filing-parser/src/parser-boundary.test.ts",
          status: "M",
        },
      ]),
    ).toBe(false);
    expect(
      isFastify5121MaintenanceCommitDiffSetAllowed([
        ...FASTIFY_5_12_1_MAINTENANCE_TRANSITION,
        ...CI_TEST_SERIALIZATION_TRANSITION,
      ]),
    ).toBe(false);
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
    expect(isCiTestSerializationSurfaceRoutingRequired([])).toBe(false);
    expect(isCiTestSerializationSurfaceRoutingRequired(undefined)).toBe(false);
    expect(
      isCiTestSerializationSurfaceRoutingRequired([
        "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
      ]),
    ).toBe(false);
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
  });

  it("ignores zero-length stderr events but rejects actual stderr bytes", () => {
    expect(hasNonEmptyStderr([])).toBe(false);
    expect(hasNonEmptyStderr([new Uint8Array()])).toBe(false);
    expect(hasNonEmptyStderr([new Uint8Array(), new Uint8Array([0])])).toBe(
      true,
    );
  });

  it("treats the third git argument as an output bound, not an exit code", () => {
    expect(isGitProcessResultAllowed(0, 41, 64, [new Uint8Array()])).toBe(true);
    expect(isGitProcessResultAllowed(0, 41, 40, [])).toBe(false);
    expect(isGitProcessResultAllowed(64, 41, 64, [])).toBe(false);
    expect(isGitProcessResultAllowed(0, 41, 64, [new Uint8Array([1])])).toBe(
      false,
    );
    expect(isGitProcessResultAllowed(0, 41, 64, [], true)).toBe(false);
  });

  it("disables Git replacement objects and lazy fetches without mutating caller arguments", () => {
    const args = ["show", "revision:path"] as const;
    const hardened = gitArgumentsWithoutReplacementObjects(args);
    expect(hardened).toEqual([
      "--no-replace-objects",
      "--no-lazy-fetch",
      "-c",
      "advice.graftFileDeprecated=false",
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
    const windows = gitEnvironmentWithoutGrafts(inherited, "win32");
    expect(windows).toEqual({ GIT_GRAFT_FILE: "NUL", Path: "path-value" });
    expect(Object.isFrozen(windows)).toBe(true);
    expect(gitEnvironmentWithoutGrafts(inherited, "linux")).toEqual({
      GIT_GRAFT_FILE: "/dev/null",
      Path: "path-value",
    });
    expect(inherited).toEqual({
      GIT_GRAFT_FILE: "first",
      Path: "path-value",
      git_graft_file: "second",
    });
  });

  it("accepts only a stable empty regular effective grafts file", () => {
    const empty = smallFileStat({ size: 0 });
    expect(isEmptyGitGraftsSnapshotAllowed(empty, empty, empty, empty, 0)).toBe(
      true,
    );
    expect(
      isEmptyGitGraftsSnapshotAllowed(
        empty,
        empty,
        empty,
        smallFileStat({ size: 1 }),
        0,
      ),
    ).toBe(false);
    expect(isEmptyGitGraftsSnapshotAllowed(empty, empty, empty, empty, 1)).toBe(
      false,
    );
    expect(
      isEmptyGitGraftsSnapshotAllowed(
        empty,
        empty,
        empty,
        smallFileStat({ size: 0, symbolicLink: true }),
        0,
      ),
    ).toBe(false);
  });

  it("resolves and rejects the effective grafts file from a linked worktree", async () => {
    const directory = await mkdtemp(join(tmpdir(), "custody-grafts-test-"));
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
      verifyNoEffectiveGitGrafts(worktreePath, ambientEnvironment),
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
      decodeCycle2cAbsoluteGitPath(new TextEncoder().encode(`${graftsPath}\n`)),
    ).toBe(graftsPath);
    await mkdir(dirname(graftsPath), { recursive: true });
    await writeFile(graftsPath, `${"0".repeat(40)}\n`);
    await expect(
      gitOutput(["-C", worktreePath, "rev-parse", "HEAD"]),
    ).resolves.toMatch(/^[0-9a-f]{40}\n$/u);
    await expect(
      verifyNoEffectiveGitGrafts(worktreePath, ambientEnvironment),
    ).rejects.toThrow("Offline filing payload custody evidence review failed.");
    await writeFile(graftsPath, new Uint8Array());
    await expect(
      verifyNoEffectiveGitGrafts(worktreePath, ambientEnvironment),
    ).resolves.toBe(undefined);

    const ambientGraftsPath = join(directory, "ambient-grafts");
    const overriddenEnvironment = {
      ...ambientEnvironment,
      GIT_GRAFT_FILE: ambientGraftsPath,
    };
    await writeFile(ambientGraftsPath, `${"1".repeat(40)}\n`);
    await expect(
      verifyNoEffectiveGitGrafts(worktreePath, overriddenEnvironment),
    ).rejects.toThrow("Offline filing payload custody evidence review failed.");
    await writeFile(ambientGraftsPath, new Uint8Array());
    await expect(
      verifyNoEffectiveGitGrafts(worktreePath, overriddenEnvironment),
    ).resolves.toBe(undefined);
  }, 30_000);

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

  it("reads one stable bounded descriptor and uses no-follow only when available", async () => {
    for (const [noFollowFlag, expectedFlags] of [
      [undefined, 0x10],
      [0x20, 0x30],
    ] as const) {
      const { observations, operations } = smallFileHarness({ noFollowFlag });
      await expect(
        readSmallRegularFileWithOperations("evidence.json", 10, operations),
      ).resolves.toEqual(new TextEncoder().encode("{}\n"));
      expect(observations).toEqual({
        closeCalls: 1,
        lstatCalls: 2,
        openFlags: [expectedFlags],
        readCalls: 2,
        statCalls: 2,
      });
    }
  });

  it("reads an actual stable small regular file through the production operations", async () => {
    const directory = await mkdtemp(join(tmpdir(), "custody-file-read-test-"));
    temporaryDirectories.push(directory);
    const evidencePath = join(directory, "evidence.json");
    const bytes = new TextEncoder().encode("{}\n");
    await writeFile(evidencePath, bytes, { flag: "wx", mode: 0o600 });

    await expect(readSmallRegularFile(evidencePath, 10)).resolves.toEqual(
      bytes,
    );
  });

  it("rejects final-component links without relying on a platform no-follow flag", async () => {
    const link = smallFileStat({ file: false, symbolicLink: true });
    const initialLink = smallFileHarness({
      noFollowFlag: undefined,
      pathStats: [link],
    });
    await expect(
      readSmallRegularFileWithOperations(
        "evidence.json",
        10,
        initialLink.operations,
      ),
    ).rejects.toThrow("Offline filing payload custody evidence review failed.");
    expect(initialLink.observations.openFlags).toEqual([]);
    expect(initialLink.observations.closeCalls).toBe(0);

    const regular = smallFileStat();
    const swappedToLink = smallFileHarness({
      descriptorStats: [regular, regular],
      noFollowFlag: undefined,
      pathStats: [regular, link],
    });
    await expect(
      readSmallRegularFileWithOperations(
        "evidence.json",
        10,
        swappedToLink.operations,
      ),
    ).rejects.toThrow("Offline filing payload custody evidence review failed.");
    expect(swappedToLink.observations.closeCalls).toBe(1);
  });

  it("rejects path/descriptor substitution and closes every opened handle", async () => {
    const pathStat = smallFileStat();
    const descriptorStat = smallFileStat({ ino: 99 });
    const substituted = smallFileHarness({
      descriptorStats: [descriptorStat],
      pathStats: [pathStat],
    });
    await expect(
      readSmallRegularFileWithOperations(
        "evidence.json",
        10,
        substituted.operations,
      ),
    ).rejects.toThrow("Offline filing payload custody evidence review failed.");
    expect(substituted.observations.readCalls).toBe(0);
    expect(substituted.observations.closeCalls).toBe(1);

    const readFailure = smallFileHarness({ readSteps: ["throw"] });
    await expect(
      readSmallRegularFileWithOperations(
        "evidence.json",
        10,
        readFailure.operations,
      ),
    ).rejects.toThrow("deterministic read failure");
    expect(readFailure.observations.closeCalls).toBe(1);
  });

  it("rejects pre-open and descriptor-only oversized files", async () => {
    const oversized = smallFileStat({ size: 11 });
    const preOpen = smallFileHarness({ pathStats: [oversized] });
    await expect(
      readSmallRegularFileWithOperations(
        "evidence.json",
        10,
        preOpen.operations,
      ),
    ).rejects.toThrow("Offline filing payload custody evidence review failed.");
    expect(preOpen.observations.openFlags).toEqual([]);

    const descriptorOnly = smallFileHarness({
      descriptorStats: [oversized],
      pathStats: [smallFileStat()],
    });
    await expect(
      readSmallRegularFileWithOperations(
        "evidence.json",
        10,
        descriptorOnly.operations,
      ),
    ).rejects.toThrow("Offline filing payload custody evidence review failed.");
    expect(descriptorOnly.observations.closeCalls).toBe(1);
  });

  it("rejects growth, truncation, and a stable-stat short read", async () => {
    const regular = smallFileStat();
    const cases = [
      smallFileHarness({
        bytes: new TextEncoder().encode("{}\n!"),
        descriptorStats: [regular, regular],
        pathStats: [regular, regular],
        readSteps: [4],
      }),
      smallFileHarness({ readSteps: [2, 0] }),
      smallFileHarness({
        descriptorStats: [regular, smallFileStat({ size: 2 })],
        pathStats: [regular, smallFileStat({ size: 2 })],
        readSteps: [2, 0],
      }),
    ];
    for (const testCase of cases) {
      await expect(
        readSmallRegularFileWithOperations(
          "evidence.json",
          10,
          testCase.operations,
        ),
      ).rejects.toThrow(
        "Offline filing payload custody evidence review failed.",
      );
      expect(testCase.observations.closeCalls).toBe(1);
    }
  });

  it("rejects descriptor identity, size, or timestamp changes after reading", async () => {
    const regular = smallFileStat();
    for (const changed of [
      smallFileStat({ dev: 9 }),
      smallFileStat({ ino: 9 }),
      smallFileStat({ size: 4 }),
      smallFileStat({ mtimeMs: 9 }),
      smallFileStat({ ctimeMs: 9 }),
      smallFileStat({ file: false }),
      smallFileStat({ symbolicLink: true }),
    ]) {
      const testCase = smallFileHarness({
        descriptorStats: [regular, changed],
        pathStats: [regular, regular],
      });
      await expect(
        readSmallRegularFileWithOperations(
          "evidence.json",
          10,
          testCase.operations,
        ),
      ).rejects.toThrow(
        "Offline filing payload custody evidence review failed.",
      );
      expect(testCase.observations.closeCalls).toBe(1);
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
