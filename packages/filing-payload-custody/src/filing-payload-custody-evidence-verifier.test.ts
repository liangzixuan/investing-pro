import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  cycle2zTransitionSurfaceDiffPaths,
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
  isCycle3bPublicPromotionCommitDiffSetAllowed,
  isCycle3bPublicPromotionTopologyAllowed,
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
  isCycle3eaOpenFigiAliasRoutingClosureCommitDiffSetAllowed,
  isCycle3eaOpenFigiAliasRoutingClosureTopologyAllowed,
  isCycle3eaOpenFigiAliasSourceCommitDiffSetAllowed,
  isCycle3eaOpenFigiAliasSourceTopologyAllowed,
  isCycle3eaProviderQueryMicSourceCommitDiffSetAllowed,
  isCycle3eaProviderQueryMicSourceTopologyAllowed,
  isCycle3eaPublicPromotionCommitDiffSetAllowed,
  isCycle3eaPublicPromotionTopologyAllowed,
  isCycle3eb1FeatureCommitDiffSetAllowed,
  isCycle3eb1FeatureTopologyAllowed,
  isCycle3eb1RoutingClosureCommitDiffSetAllowed,
  isCycle3eb1RoutingClosureTopologyAllowed,
  isCycle3ga1FeatureCommitDiffSetAllowed,
  isCycle3ga1FeatureTopologyAllowed,
  isCycle3ga1RoutingClosureCommitDiffSetAllowed,
  isCycle3ga1RoutingClosureTopologyAllowed,
  isCycle3gb1FeatureCommitDiffSetAllowed,
  isCycle3gb1FeatureTopologyAllowed,
  isCycle3gb1RoutingClosureCommitDiffSetAllowed,
  isCycle3gb1RoutingClosureTopologyAllowed,
  isCycle3ha1FeatureCommitDiffSetAllowed,
  isCycle3ha1FeatureTopologyAllowed,
  isCycle3ha1RoutingClosureCommitDiffSetAllowed,
  isCycle3ha1RoutingClosureTopologyAllowed,
  isCycle3ha2FeatureCommitDiffSetAllowed,
  isCycle3ha2FeatureTopologyAllowed,
  isCycle3ha2RoutingClosureCommitDiffSetAllowed,
  isCycle3ha2RoutingClosureTopologyAllowed,
  isCycle3ha3FeatureCommitDiffSetAllowed,
  isCycle3ha3FeatureTopologyAllowed,
  isCycle3ha3RoutingClosureCommitDiffSetAllowed,
  isCycle3ha3RoutingClosureTopologyAllowed,
  isCycle3ia1FeatureCommitDiffSetAllowed,
  isCycle3ia1FeatureTopologyAllowed,
  isCycle3ia1RoutingClosureCommitDiffSetAllowed,
  isCycle3ia1RoutingClosureTopologyAllowed,
  isCycle3ia2FeatureCommitDiffSetAllowed,
  isCycle3ia2FeatureTopologyAllowed,
  isCycle3ia2RoutingClosureCommitDiffSetAllowed,
  isCycle3ia2RoutingClosureTopologyAllowed,
  isCycle3ja1FeatureCommitDiffSetAllowed,
  isCycle3ja1FeatureTopologyAllowed,
  isCycle3ja1RoutingClosureCommitDiffSetAllowed,
  isCycle3ja1RoutingClosureTopologyAllowed,
  isCycle3ja2FeatureCommitDiffSetAllowed,
  isCycle3ja2FeatureTopologyAllowed,
  isCycle3ja2RoutingClosureCommitDiffSetAllowed,
  isCycle3ja2RoutingClosureTopologyAllowed,
  isCycle3ka1FeatureCommitDiffSetAllowed,
  isCycle3ka1FeatureTopologyAllowed,
  isCycle3ka1RoutingClosureCommitDiffSetAllowed,
  isCycle3ka1RoutingClosureTopologyAllowed,
  isCycle3ka2FeatureCommitDiffSetAllowed,
  isCycle3ka2FeatureTopologyAllowed,
  isCycle3ka2RoutingClosureCommitDiffSetAllowed,
  isCycle3ka2RoutingClosureTopologyAllowed,
  isCycle3la1FeatureCommitDiffSetAllowed,
  isCycle3la1FeatureTopologyAllowed,
  isCycle3la1RoutingClosureCommitDiffSetAllowed,
  isCycle3la1RoutingClosureTopologyAllowed,
  isCycle3ma1FeatureCommitDiffSetAllowed,
  isCycle3ma1FeatureTopologyAllowed,
  isCycle3ma1RoutingClosureCommitDiffSetAllowed,
  isCycle3ma1RoutingClosureTopologyAllowed,
  isCycle3ma2FeatureCommitDiffSetAllowed,
  isCycle3ma2FeatureTopologyAllowed,
  isCycle3ma2RoutingClosureCommitDiffSetAllowed,
  isCycle3ma2RoutingClosureTopologyAllowed,
  isCycle3ma3FeatureCommitDiffSetAllowed,
  isCycle3ma3FeatureTopologyAllowed,
  isCycle3ma3RoutingClosureCommitDiffSetAllowed,
  isCycle3ma3RoutingClosureTopologyAllowed,
  isCycle3ma4FeatureCommitDiffSetAllowed,
  isCycle3ma4FeatureTopologyAllowed,
  isCycle3ma4RoutingClosureCommitDiffSetAllowed,
  isCycle3ma4RoutingClosureTopologyAllowed,
  isCycle3ma5FeatureCommitDiffSetAllowed,
  isCycle3ma5FeatureTopologyAllowed,
  isCycle3ma5RoutingClosureCommitDiffSetAllowed,
  isCycle3ma5RoutingClosureTopologyAllowed,
  isCycle3ma6FeatureCommitDiffSetAllowed,
  isCycle3ma6FeatureTopologyAllowed,
  isCycle3ma6RoutingClosureCommitDiffSetAllowed,
  isCycle3ma6RoutingClosureTopologyAllowed,
  isCycle3ma7FeatureCommitDiffSetAllowed,
  isCycle3ma7FeatureTopologyAllowed,
  isCycle3ma7RoutingClosureCommitDiffSetAllowed,
  isCycle3ma7RoutingClosureTopologyAllowed,
  isCycle3ha4FeatureCommitDiffSetAllowed,
  isCycle3ha4FeatureTopologyAllowed,
  isCycle3ha4RoutingClosureCommitDiffSetAllowed,
  isCycle3ha4RoutingClosureTopologyAllowed,
  isCycle3ha5FeatureCommitDiffSetAllowed,
  isCycle3ha5FeatureTopologyAllowed,
  isCycle3ha5RoutingClosureCommitDiffSetAllowed,
  isCycle3ha5RoutingClosureTopologyAllowed,
  isCycle3ha6FeatureCommitDiffSetAllowed,
  isCycle3ha6FeatureTopologyAllowed,
  isCycle3ha6RoutingClosureCommitDiffSetAllowed,
  isCycle3ha6RoutingClosureTopologyAllowed,
  isCycle3ha7FeatureCommitDiffSetAllowed,
  isCycle3ha7FeatureTopologyAllowed,
  isCycle3ha7RoutingClosureCommitDiffSetAllowed,
  isCycle3ha7RoutingClosureTopologyAllowed,
  isCycle3ha8FeatureCommitDiffSetAllowed,
  isCycle3ha8FeatureTopologyAllowed,
  isCycle3ha8RoutingClosureCommitDiffSetAllowed,
  isCycle3ha8RoutingClosureTopologyAllowed,
  isCycle3ha9FeatureCommitDiffSetAllowed,
  isCycle3ha9FeatureTopologyAllowed,
  isCycle3ha9RoutingClosureCommitDiffSetAllowed,
  isCycle3ha9RoutingClosureTopologyAllowed,
  isCycle3ha10FeatureCommitDiffSetAllowed,
  isCycle3ha10FeatureTopologyAllowed,
  isCycle3ha10RoutingClosureCommitDiffSetAllowed,
  isCycle3ha10RoutingClosureTopologyAllowed,
  isCycle3ha11FeatureCommitDiffSetAllowed,
  isCycle3ha11FeatureTopologyAllowed,
  isCycle3ha11RoutingClosureCommitDiffSetAllowed,
  isCycle3ha11RoutingClosureTopologyAllowed,
  isCycle3ha12FeatureCommitDiffSetAllowed,
  isCycle3ha12FeatureTopologyAllowed,
  isCycle3ha12RoutingClosureCommitDiffSetAllowed,
  isCycle3ha12RoutingClosureTopologyAllowed,
  isCycle3ha13FeatureCommitDiffSetAllowed,
  isCycle3ha13FeatureTopologyAllowed,
  isCycle3ha13RoutingClosureCommitDiffSetAllowed,
  isCycle3ha13RoutingClosureTopologyAllowed,
  isCycle3ha14FeatureCommitDiffSetAllowed,
  isCycle3ha14FeatureTopologyAllowed,
  isCycle3ha14RoutingClosureCommitDiffSetAllowed,
  isCycle3ha14RoutingClosureTopologyAllowed,
  isCycle3ka3FeatureCommitDiffSetAllowed,
  isCycle3ka3FeatureTopologyAllowed,
  isCycle3ka3RoutingClosureCommitDiffSetAllowed,
  isCycle3ka3RoutingClosureTopologyAllowed,
  isCycle3ka4FeatureCommitDiffSetAllowed,
  isCycle3ka4FeatureTopologyAllowed,
  isCycle3ka4RoutingClosureCommitDiffSetAllowed,
  isCycle3ka4RoutingClosureTopologyAllowed,
  isCycle3ka5FeatureCommitDiffSetAllowed,
  isCycle3ka5FeatureTopologyAllowed,
  isCycle3ka5RoutingClosureCommitDiffSetAllowed,
  isCycle3ka5RoutingClosureTopologyAllowed,
  isCycle3ka6FeatureCommitDiffSetAllowed,
  isCycle3ka6FeatureTopologyAllowed,
  isCycle3ka6RoutingClosureCommitDiffSetAllowed,
  isCycle3ka6RoutingClosureTopologyAllowed,
  isCycle3eaWindowsExpiryRecoveryLatencyRoutingClosureCommitDiffSetAllowed,
  isCycle3eaWindowsExpiryRecoveryLatencyRoutingClosureTopologyAllowed,
  isCycle3eaWindowsExpiryRecoveryLatencyStabilizationCommitDiffSetAllowed,
  isCycle3eaWindowsExpiryRecoveryLatencyStabilizationTopologyAllowed,
  isCycle3ea1PublicEngineeringEvidenceRecordCommitDiffSetAllowed,
  isCycle3ea1PublicEngineeringEvidenceRecordTopologyAllowed,
  isCycle3ea1RoutingClosureCommitDiffSetAllowed,
  isCycle3ea1RoutingClosureTopologyAllowed,
  isCycle3ea1SourcePreparationCommitDiffSetAllowed,
  isCycle3ea1SourcePreparationTopologyAllowed,
  isCycle3ea2MeasurementClockClosureCommitDiffSetAllowed,
  isCycle3ea2MeasurementClockClosureTopologyAllowed,
  isCycle3ea2PublicEngineeringEvidenceRecordCommitDiffSetAllowed,
  isCycle3ea2PublicEngineeringEvidenceRecordTopologyAllowed,
  isCycle3ea2RoutingClosureCommitDiffSetAllowed,
  isCycle3ea2RoutingClosureTopologyAllowed,
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
const CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION =
  "fda5148a4251a36861196029bbc6df6b7d1a84d0" as const;
const CYCLE_3E_A1_SOURCE_PREPARATION_REVISION =
  "0cf87021648e05c191eebbeb95aee6742c4c0f09" as const;
const CYCLE_3E_A1_ROUTING_CLOSURE_REVISION =
  "5e27bed1a11956bb207f523739083131aea254f0" as const;
const CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION =
  "d34266037ca997d72bea440e9be942cddd223da9" as const;
const CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_REVISION =
  "8c2166fa01f5e1f471887ccdeb9484b132a02bb0" as const;
const CYCLE_3E_A2_ROUTING_CLOSURE_REVISION =
  "0374becdf96c1e9891d80e73024c8be0440fd812" as const;
const CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION =
  "3fe17a21330b6a8ee438298628a832f274fc7216" as const;
const CYCLE_3B_PUBLIC_PROMOTION_REVISION =
  "89dbab5f50c8c4ee0e4ede6b187c372e9e6b8473" as const;
const CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION =
  "a1180532f6432d211831aeb420cb6d6d8326733f" as const;
const CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_REVISION =
  "b688636bedeff13a1c0c1710135e99022f134b56" as const;
const CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_REVISION =
  "7c2b486438e16e45348c4882ddaf5c69c6f7c906" as const;
const CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_ROUTING_CLOSURE_REVISION =
  "4f5547bcdf86b0f4268af904f38e68574acdd668" as const;
const CYCLE_3E_A_PROVIDER_QUERY_MIC_SOURCE_REVISION =
  "5b547c88f213cfbc10450c460528a97ee395a834" as const;
const CYCLE_3E_A_PUBLIC_PROMOTION_REVISION =
  "8df2f84c680281bf35d401d17fb98c4946292f14" as const;
const CYCLE_3E_B1_FEATURE_REVISION =
  "33b12345461aa93e05d2a98bca76276c8740d289" as const;
const CYCLE_3E_B1_ROUTING_CLOSURE_REVISION =
  "398680bb3a609f273f4a8fe21705ce63981d8946" as const;
const CYCLE_3G_A1_FEATURE_REVISION =
  "e53670fa44b2fcf54c5dfc7ad04b886d9bf30a26" as const;
const CYCLE_3G_A1_ROUTING_CLOSURE_REVISION =
  "7b2cf20e595ebc6d78fc358ab626fa242df0575a" as const;
const CYCLE_3G_B1_FEATURE_REVISION =
  "bf4e780b6e055352ca7d31ad00fffc50923910ab" as const;
const CYCLE_3G_B1_ROUTING_CLOSURE_REVISION =
  "b5d4dca64e37afd9692e1e3361258efbdf61e88f" as const;
const CYCLE_3H_A1_FEATURE_REVISION =
  "fabc8546bdfd7d2e79623eb518d3c0d75eecbaf1" as const;
const CYCLE_3H_A1_ROUTING_CLOSURE_REVISION =
  "5e28f271092b05a7627a699d1e7136dfe551034c" as const;
const CYCLE_3H_A2_FEATURE_REVISION =
  "0a280ccb3ca87264c38a4cc03459f58fe6852575" as const;
const CYCLE_3H_A2_ROUTING_CLOSURE_REVISION =
  "e02b2004ca020735e2c38fc4a87ce150c2e9d7eb" as const;
const CYCLE_3H_A3_FEATURE_REVISION =
  "4ff2de0f12b73388591c5f54cae946d27408362d" as const;
const CYCLE_3H_A3_ROUTING_CLOSURE_REVISION =
  "fe015df1002b3ce7c31a6186cac8824f2692a4c2" as const;
const CYCLE_3I_A1_FEATURE_REVISION =
  "eb582309f73abd8a3ab7faa9852ab59d685cbde0" as const;
const CYCLE_3I_A1_ROUTING_CLOSURE_REVISION =
  "dd0b4a21ebb6b7e1fe215297c2f2bb12e88aa815" as const;
const CYCLE_3I_A2_FEATURE_REVISION =
  "c5f3eaf58ce593e74514622d6decca5d1acf6c9b" as const;
const CYCLE_3I_A2_ROUTING_CLOSURE_REVISION =
  "61501ab1d4f48bf56ea18448ce96c92de848e41e" as const;
const CYCLE_3J_A1_FEATURE_REVISION =
  "02424b7cdd6bd736c232e31eb2575ff213332760" as const;
const CYCLE_3J_A1_ROUTING_CLOSURE_REVISION =
  "2af82002d40307f6b7502e1e100370ceeef34db5" as const;
const CYCLE_3J_A2_FEATURE_REVISION =
  "61e060fa7a00e8fd4d582a458dcf7921a3c0ff2a" as const;
const CYCLE_3J_A2_ROUTING_CLOSURE_REVISION =
  "fa63a5de52c569857abcdc7f2b8995db800ced50" as const;
const CYCLE_3K_A1_FEATURE_REVISION =
  "5dd44acdbe3159d58d9f8983093d3afbb2d33ae5" as const;
const CYCLE_3K_A1_ROUTING_CLOSURE_REVISION =
  "2f5bab2833acc6367fa4c1e5b20f3e15d6d3ec6e" as const;
const CYCLE_3K_A2_FEATURE_REVISION =
  "ad168082454aa243431138a3e3a300d048bde2d7" as const;
const CYCLE_3K_A2_ROUTING_CLOSURE_REVISION =
  "e9c5a705c49db7a632c6fcdfa0655b0fb3ec4e21" as const;
const CYCLE_3L_A1_FEATURE_REVISION =
  "2152d1a337ee64821062025d884edb6f334f17ab" as const;
const CYCLE_3L_A1_ROUTING_CLOSURE_REVISION =
  "86745528518a8ee02315bc2806af1c1d3499fdab" as const;
const CYCLE_3M_A1_FEATURE_REVISION =
  "bf5082a3a59d15d7312806eda30a1c46db20cd8e" as const;
const CYCLE_3M_A1_ROUTING_CLOSURE_REVISION =
  "fc9a94e190cfc76f2bcc17c56d3403293aa7e18d" as const;
const CYCLE_3M_A2_FEATURE_REVISION =
  "e2bc175a3fdb9863fc81467ca9f92bcdb63cf027" as const;
const CYCLE_3M_A2_ROUTING_CLOSURE_REVISION =
  "e30cb7b45881469eab2ec5ca53be096c4bf86689" as const;
const CYCLE_3M_A3_FEATURE_REVISION =
  "2688fdfc5fcc88a53e77932c8580e45dcac2ca0c" as const;
const CYCLE_3M_A3_ROUTING_CLOSURE_REVISION =
  "4381ee30ea3803093189f394f33122a0424b3348" as const;
const CYCLE_3M_A4_FEATURE_REVISION =
  "20ffde392d8517f7a7b14c278bc396d1149d4c16" as const;
const CYCLE_3M_A4_ROUTING_CLOSURE_REVISION =
  "11890c7f61bbd21c203b9dd2540b6abf52057466" as const;
const CYCLE_3M_A5_FEATURE_REVISION =
  "8ccb4ca684bbd5320dbd51fb779b14930060015f" as const;
const CYCLE_3M_A5_ROUTING_CLOSURE_REVISION =
  "051e25adef5e5fd6b6c9ef818ff42f0cc71b085c" as const;
const CYCLE_3M_A6_FEATURE_REVISION =
  "7565f8a3e356b4a778cab93e0e76b1e40c0eee1a" as const;
const CYCLE_3M_A6_ROUTING_CLOSURE_REVISION =
  "c9c7de8d75e79ee7a417dd09a317e929469f88de" as const;
const CYCLE_3M_A7_FEATURE_REVISION =
  "2fbaf505689c858ec28973138c3b14c84b472ea9" as const;
const CYCLE_3M_A7_ROUTING_CLOSURE_REVISION =
  "12e24957407f9fd318972fa87402672736660274" as const;
const CYCLE_3H_A4_FEATURE_REVISION =
  "af4d7fbd4a392d26f54c4bad07ddbe70d524a312" as const;
const CYCLE_3H_A4_ROUTING_CLOSURE_REVISION =
  "63c204bccb4975ea44cf53bdea536ca3ec5afc20" as const;
const CYCLE_3H_A5_FEATURE_REVISION =
  "6e6bef9ffa4b1520eeb753768a90b767df4cbd21" as const;
const CYCLE_3H_A5_ROUTING_CLOSURE_REVISION =
  "14002d430e06f9db21a127543ebe8b9029bb33fd" as const;
const CYCLE_3H_A6_FEATURE_REVISION =
  "37ab12627f93eadd25af71e1bb43112fbcda75e5" as const;
const CYCLE_3H_A6_ROUTING_CLOSURE_REVISION =
  "f538be68faff7e31b98ccff878f6ca8452951fc7" as const;
const CYCLE_3H_A7_FEATURE_REVISION =
  "80ef20f680c79a7dec97c4868b3b82c9f255ad32" as const;
const CYCLE_3H_A7_ROUTING_CLOSURE_REVISION =
  "cb83d6a60e379c7fc728c1ca801554a62d1cc603" as const;
const CYCLE_3H_A8_FEATURE_REVISION =
  "72660cb15bae5339f5a78f1c79455f468eb7de66" as const;
const CYCLE_3H_A8_ROUTING_CLOSURE_REVISION =
  "e7e1ab6a56327b8d59374a540149990e99119bbe" as const;
const CYCLE_3H_A9_FEATURE_REVISION =
  "d874b68f44445d523ec5a82b9495e5905eb03b85" as const;
const CYCLE_3H_A9_ROUTING_CLOSURE_REVISION =
  "fe04a47e40fe9fbbca1db6bdeb0525c3dca9f9eb" as const;
const CYCLE_3H_A10_FEATURE_REVISION =
  "26a5fea2cca6df4ba6d7ba29f35e4496ac47e086" as const;
const CYCLE_3H_A10_ROUTING_CLOSURE_REVISION =
  "4309cf01a1bff8ec3d6a4e086e9888a0e1ef6cd1" as const;
const CYCLE_3H_A11_FEATURE_REVISION =
  "c7924db71eb6f16c0e4fe559a80363258a55cbd7" as const;
const CYCLE_3H_A11_ROUTING_CLOSURE_REVISION =
  "ec9b302f3743f52588f65f9d276b1f357056bc3b" as const;
const CYCLE_3H_A12_FEATURE_REVISION =
  "53ae441125c99429643b123e97aa02bbd4da46be" as const;
const CYCLE_3H_A12_ROUTING_CLOSURE_REVISION =
  "5491785d758fabb721267d102ff33215d842093b" as const;
const CYCLE_3H_A13_FEATURE_REVISION =
  "5548b9a92ab8400807aace3ec1b2900450462d67" as const;
const CYCLE_3H_A13_ROUTING_CLOSURE_REVISION =
  "ef7635f85db1c6ac274a8c63c3a22dfcd83303af" as const;
const CYCLE_3H_A14_FEATURE_REVISION =
  "55e8f23926bdf07e4b84e0c0beb8e68508597e5f" as const;
const CYCLE_3H_A14_ROUTING_CLOSURE_REVISION =
  "d86d952470f1b2703eebc032efba3c4d51bd98cf" as const;
const CYCLE_3K_A3_FEATURE_REVISION =
  "6e224923aa2c5d8c22299bfb2793cc83be89cfb8" as const;
const CYCLE_3K_A3_ROUTING_CLOSURE_REVISION =
  "0eed422fe3ef7e7e6ffaefbc53e5ff261c163468" as const;
const CYCLE_3K_A4_FEATURE_REVISION =
  "076228285e96f6b05e5bbc120832fbe54ba17fcd" as const;
const CYCLE_3K_A4_ROUTING_CLOSURE_REVISION =
  "b9a2d1d2168092b31636bbb2a9f5a510da928f5e" as const;
const CYCLE_3K_A5_FEATURE_REVISION =
  "bd0bbd9f7074b0a032d6095fb5cfb8dbbefb1432" as const;
const CYCLE_3K_A5_ROUTING_CLOSURE_REVISION =
  "170feab23f1eb4be3653ccd7523fbd4e5f8bd71a" as const;
const CYCLE_3K_A6_FEATURE_REVISION =
  "d71ff75f00384bf244a73350d23b6bd25085bf6e" as const;
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
const CYCLE_3E_A1_SOURCE_PREPARATION_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_3E_A1_EXIT_MATRIX.md", status: "A" },
  { path: "docs/CYCLE_3E_A_EXIT_MATRIX.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0057-owner-local-security-master-snapshot-and-search.md",
    status: "M",
  },
  {
    path: "docs/adr/0058-offline-sec-openfigi-v1-source-preparation.md",
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
  { path: "packages/personal-security-master/package.json", status: "M" },
  {
    path: "packages/personal-security-master/src/sec-openfigi-v1-source-preparation-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-security-master/src/sec-openfigi-v1-source-preparation.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-security-master/src/sec-openfigi-v1-source-preparation.ts",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3E_A1_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_3E_A1_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3E_A_EXIT_MATRIX.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0057-owner-local-security-master-snapshot-and-search.md",
    status: "M",
  },
  {
    path: "docs/adr/0058-offline-sec-openfigi-v1-source-preparation.md",
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
const CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_TRANSITION = [
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
  { path: "docs/CYCLE_3E_A1_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3E_A2_EXIT_MATRIX.md", status: "A" },
  { path: "docs/CYCLE_3E_A_EXIT_MATRIX.md", status: "M" },
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
    status: "M",
  },
  {
    path: "docs/adr/0058-offline-sec-openfigi-v1-source-preparation.md",
    status: "M",
  },
  {
    path: "docs/adr/0059-package-owned-security-master-measurement-clock.md",
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
    path: "packages/personal-security-master/src/personal-security-master-security.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-security-master/src/personal-security-master.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-security-master/src/personal-security-master.ts",
    status: "M",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3E_A2_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/CYCLE_3E_A1_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3E_A2_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3E_A_EXIT_MATRIX.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  {
    path: "docs/adr/0057-owner-local-security-master-snapshot-and-search.md",
    status: "M",
  },
  {
    path: "docs/adr/0058-offline-sec-openfigi-v1-source-preparation.md",
    status: "M",
  },
  {
    path: "docs/adr/0059-package-owned-security-master-measurement-clock.md",
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
const CYCLE_3B_PUBLIC_PROMOTION_TRANSITION = [
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
const CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_TRANSITION = [
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  {
    path: "docs/adr/0058-offline-sec-openfigi-v1-source-preparation.md",
    status: "M",
  },
  {
    path: "packages/personal-security-master/src/sec-openfigi-v1-source-preparation.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-security-master/src/sec-openfigi-v1-source-preparation.ts",
    status: "M",
  },
];
const CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_TRANSITION = [
  {
    path: "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
    status: "M",
  },
  {
    path: "packages/filing-payload-custody/src/payload-custody-security.test.ts",
    status: "M",
  },
];
const CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_ROUTING_CLOSURE_TRANSITION =
  CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_TRANSITION;
const CYCLE_3E_A_PROVIDER_QUERY_MIC_SOURCE_TRANSITION = [
  {
    path: "packages/personal-security-master/src/sec-openfigi-v1-source-preparation-security.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-security-master/src/sec-openfigi-v1-source-preparation.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-security-master/src/sec-openfigi-v1-source-preparation.ts",
    status: "M",
  },
];
const CYCLE_3E_A_PUBLIC_PROMOTION_TRANSITION = [
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
  { path: "docs/CYCLE_3E_A1_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3E_A2_EXIT_MATRIX.md", status: "M" },
  { path: "docs/CYCLE_3E_A_EXIT_MATRIX.md", status: "M" },
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
    status: "M",
  },
  {
    path: "docs/adr/0058-offline-sec-openfigi-v1-source-preparation.md",
    status: "M",
  },
  {
    path: "docs/adr/0059-package-owned-security-master-measurement-clock.md",
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
const CYCLE_3E_B1_FEATURE_TRANSITION = [
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  { path: "README.md", status: "M" },
  { path: "apps/api/package.json", status: "M" },
  { path: "apps/api/src/api-mode.test.ts", status: "M" },
  { path: "apps/api/src/api-mode.ts", status: "M" },
  { path: "apps/api/src/composition-root.test.ts", status: "M" },
  { path: "apps/api/src/composition-root.ts", status: "M" },
  { path: "apps/api/src/security-master-composition-root.ts", status: "M" },
  { path: "apps/api/src/workspace-app.ts", status: "A" },
  { path: "apps/api/src/workspace-composition-root.test.ts", status: "A" },
  { path: "apps/api/src/workspace-composition-root.ts", status: "A" },
  { path: "apps/api/src/workspace-server.ts", status: "A" },
  { path: "apps/api/src/workspace-static-graph.test.ts", status: "A" },
  { path: "apps/api/src/workspace-watchlist-routes.ts", status: "A" },
  { path: "apps/api/tsup.config.ts", status: "M" },
  { path: "apps/web/app/discover/page.tsx", status: "A" },
  { path: "apps/web/app/globals.css", status: "M" },
  { path: "apps/web/app/page.tsx", status: "M" },
  { path: "apps/web/app/research/[symbol]/page.tsx", status: "M" },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "A",
  },
  { path: "apps/web/src/lib/personal-workspace-api.test.ts", status: "A" },
  { path: "apps/web/src/lib/personal-workspace-api.ts", status: "A" },
  { path: "apps/web/src/lib/web-mode.test.ts", status: "M" },
  { path: "apps/web/src/lib/web-mode.ts", status: "M" },
  { path: "apps/web/src/research-page-mode.test.tsx", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
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
];
const CYCLE_3E_B1_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3G_A1_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  {
    path: "apps/api/src/personal-market-data-provider.test.ts",
    status: "A",
  },
  { path: "apps/api/src/personal-market-data-provider.ts", status: "A" },
  {
    path: "apps/api/src/personal-owner-session-routes.test.ts",
    status: "M",
  },
  { path: "apps/api/src/personal-owner-session-routes.ts", status: "M" },
  { path: "apps/api/src/workspace-app.ts", status: "M" },
  {
    path: "apps/api/src/workspace-composition-root.test.ts",
    status: "M",
  },
  { path: "apps/api/src/workspace-composition-root.ts", status: "M" },
  { path: "apps/api/src/workspace-market-data-routes.test.ts", status: "A" },
  { path: "apps/api/src/workspace-market-data-routes.ts", status: "A" },
  { path: "apps/api/src/workspace-static-graph.test.ts", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalMarketOverview.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalMarketOverview.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PriceHistoryChart.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PriceHistoryChart.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  { path: "apps/web/src/lib/personal-workspace-api.test.ts", status: "M" },
  { path: "apps/web/src/lib/personal-workspace-api.ts", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "packages/contracts/openapi/openapi.yaml", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  { path: "packages/contracts/src/openapi.test.ts", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3G_A1_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3G_B1_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  { path: "apps/web/next.config.ts", status: "M" },
  { path: "apps/web/package.json", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalMarketAnalytics.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalMarketAnalytics.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalMarketOverview.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalMarketOverview.tsx",
    status: "M",
  },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "packages/personal-market-analytics/package.json", status: "A" },
  { path: "packages/personal-market-analytics/src/index.ts", status: "A" },
  {
    path: "packages/personal-market-analytics/src/personal-market-analytics-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-market-analytics/src/personal-market-analytics.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-market-analytics/src/personal-market-analytics.ts",
    status: "A",
  },
  { path: "packages/personal-market-analytics/tsconfig.json", status: "A" },
  { path: "pnpm-lock.yaml", status: "M" },
];
const CYCLE_3G_B1_ROUTING_CLOSURE_TRANSITION =
  CYCLE_3G_A1_ROUTING_CLOSURE_TRANSITION;
const CYCLE_3H_A1_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/api/src/personal-market-data-provider.test.ts", status: "M" },
  { path: "apps/api/src/personal-market-data-provider.ts", status: "M" },
  { path: "apps/api/src/workspace-market-data-routes.test.ts", status: "M" },
  { path: "apps/api/src/workspace-market-data-routes.ts", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  { path: "apps/web/next.config.ts", status: "M" },
  { path: "apps/web/package.json", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalAnnualFinancials.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalAnnualFinancials.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  { path: "apps/web/src/lib/personal-workspace-api.test.ts", status: "M" },
  { path: "apps/web/src/lib/personal-workspace-api.ts", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  { path: "packages/contracts/openapi/openapi.yaml", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  { path: "packages/contracts/src/openapi.test.ts", status: "M" },
  { path: "packages/personal-financial-analytics/package.json", status: "A" },
  { path: "packages/personal-financial-analytics/src/index.ts", status: "A" },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-analytics-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-analytics.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-analytics.ts",
    status: "A",
  },
  {
    path: "packages/personal-financial-analytics/src/reported-field-registry.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-financial-analytics/src/reported-field-registry.ts",
    status: "A",
  },
  { path: "packages/personal-financial-analytics/tsconfig.json", status: "A" },
  { path: "pnpm-lock.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3H_A1_ROUTING_CLOSURE_TRANSITION =
  CYCLE_3G_A1_ROUTING_CLOSURE_TRANSITION;
const CYCLE_3H_A2_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  {
    path: "apps/api/src/personal-market-data-provider.test.ts",
    status: "M",
  },
  { path: "apps/api/src/personal-market-data-provider.ts", status: "M" },
  { path: "apps/api/src/workspace-market-data-routes.test.ts", status: "M" },
  { path: "apps/api/src/workspace-market-data-routes.ts", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalAnnualFinancials.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalAnnualFinancials.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalQuarterlyFinancials.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalQuarterlyFinancials.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  { path: "apps/web/src/lib/personal-workspace-api.test.ts", status: "M" },
  { path: "apps/web/src/lib/personal-workspace-api.ts", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  { path: "packages/contracts/openapi/openapi.yaml", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  { path: "packages/contracts/src/openapi.test.ts", status: "M" },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-analytics-security.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-analytics.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-analytics.ts",
    status: "M",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3H_A2_ROUTING_CLOSURE_TRANSITION =
  CYCLE_3H_A1_ROUTING_CLOSURE_TRANSITION;
const CYCLE_3H_A3_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  {
    path: "apps/api/src/personal-market-data-provider.test.ts",
    status: "M",
  },
  { path: "apps/api/src/personal-market-data-provider.ts", status: "M" },
  { path: "apps/api/src/workspace-market-data-routes.test.ts", status: "M" },
  { path: "apps/api/src/workspace-market-data-routes.ts", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalValuationHistory.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalValuationHistory.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/ValuationHistoryChart.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/ValuationHistoryChart.tsx",
    status: "A",
  },
  { path: "apps/web/src/lib/personal-workspace-api.test.ts", status: "M" },
  { path: "apps/web/src/lib/personal-workspace-api.ts", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  { path: "packages/contracts/openapi/openapi.yaml", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  { path: "packages/contracts/src/openapi.test.ts", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3H_A3_ROUTING_CLOSURE_TRANSITION =
  CYCLE_3H_A1_ROUTING_CLOSURE_TRANSITION;
const CYCLE_3I_A1_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  {
    path: "apps/api/src/personal-market-data-provider.test.ts",
    status: "M",
  },
  { path: "apps/api/src/personal-market-data-provider.ts", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalHistoricalMultipleValuation.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalHistoricalMultipleValuation.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  { path: "packages/personal-market-analytics/src/index.ts", status: "M" },
  {
    path: "packages/personal-market-analytics/src/personal-historical-multiple-valuation.security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-market-analytics/src/personal-historical-multiple-valuation.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-market-analytics/src/personal-historical-multiple-valuation.ts",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3I_A1_ROUTING_CLOSURE_TRANSITION =
  CYCLE_3H_A1_ROUTING_CLOSURE_TRANSITION;
const CYCLE_3I_A2_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalFcffDcfValuation.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalFcffDcfValuation.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  { path: "packages/personal-market-analytics/src/index.ts", status: "M" },
  {
    path: "packages/personal-market-analytics/src/personal-fcff-dcf-valuation.security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-market-analytics/src/personal-fcff-dcf-valuation.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-market-analytics/src/personal-fcff-dcf-valuation.ts",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3I_A2_ROUTING_CLOSURE_TRANSITION = [
  ...CYCLE_3H_A1_ROUTING_CLOSURE_TRANSITION,
];
const CYCLE_3J_A1_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalFinancialQualityScorecard.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalFinancialQualityScorecard.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  { path: "packages/personal-financial-analytics/src/index.ts", status: "M" },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-quality-scorecard-security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-quality-scorecard.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-quality-scorecard.ts",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3J_A1_ROUTING_CLOSURE_TRANSITION = [
  ...CYCLE_3I_A2_ROUTING_CLOSURE_TRANSITION,
];
const CYCLE_3J_A2_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalAnnualFinancials.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalFcffDcfValuation.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalFinancialQualityScorecard.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalHistoricalMultipleValuation.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalManualPeerComparison.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalManualPeerComparison.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalMarketOverview.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalMarketOverview.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalQuarterlyFinancials.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalValuationHistory.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  { path: "packages/personal-market-analytics/src/index.ts", status: "M" },
  {
    path: "packages/personal-market-analytics/src/personal-manual-peer-comparison.security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-market-analytics/src/personal-manual-peer-comparison.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-market-analytics/src/personal-manual-peer-comparison.ts",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3J_A2_ROUTING_CLOSURE_TRANSITION = [
  ...CYCLE_3J_A1_ROUTING_CLOSURE_TRANSITION,
];
const CYCLE_3K_A1_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/api/src/workspace-app.ts", status: "M" },
  { path: "apps/api/src/workspace-composition-root.test.ts", status: "M" },
  { path: "apps/api/src/workspace-screener-routes.test.ts", status: "A" },
  { path: "apps/api/src/workspace-screener-routes.ts", status: "A" },
  { path: "apps/api/src/workspace-static-graph.test.ts", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalStockScreener.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalStockScreener.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  { path: "apps/web/src/lib/personal-workspace-api.test.ts", status: "M" },
  { path: "apps/web/src/lib/personal-workspace-api.ts", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CANONICAL_MODEL.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/THREAT_MODEL.md", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  { path: "packages/personal-security-master/src/index.ts", status: "M" },
  {
    path: "packages/personal-security-master/src/personal-security-master-screener.security.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-security-master/src/personal-security-master-screener.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-security-master/src/personal-security-master.ts",
    status: "M",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3K_A1_ROUTING_CLOSURE_TRANSITION = [
  { path: ".github/workflows/filing-parser-acceptance.yml", status: "M" },
  {
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    status: "M",
  },
  {
    path: ".github/workflows/filing-payload-custody-acceptance.yml",
    status: "M",
  },
  { path: "README.md", status: "M" },
  { path: "docs/BUILD_ROADMAP.md", status: "M" },
  { path: "docs/CURRENT_WORK.md", status: "A" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
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
const CYCLE_3K_A2_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/api/package.json", status: "M" },
  { path: "apps/api/src/personal-sec-financial-provider.test.ts", status: "A" },
  { path: "apps/api/src/personal-sec-financial-provider.ts", status: "A" },
  { path: "apps/api/src/workspace-app.ts", status: "M" },
  { path: "apps/api/src/workspace-composition-root.test.ts", status: "M" },
  { path: "apps/api/src/workspace-composition-root.ts", status: "M" },
  {
    path: "apps/api/src/workspace-financial-screen-routes.test.ts",
    status: "A",
  },
  { path: "apps/api/src/workspace-financial-screen-routes.ts", status: "A" },
  { path: "apps/api/src/workspace-static-graph.test.ts", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalFinancialScreener.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalFinancialScreener.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-financial-screen-api.test.ts",
    status: "A",
  },
  { path: "apps/web/src/lib/personal-financial-screen-api.ts", status: "A" },
  { path: "apps/web/src/lib/personal-workspace-api.ts", status: "M" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/SEC_ANNUAL_FINANCIAL_SCREENING.md", status: "A" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  {
    path: "packages/contracts/src/personal-financial-screener.ts",
    status: "A",
  },
  { path: "packages/personal-financial-analytics/package.json", status: "M" },
  { path: "packages/personal-financial-analytics/src/index.ts", status: "M" },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-screener.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-screener.ts",
    status: "A",
  },
  { path: "pnpm-lock.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3K_A2_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3L_A1_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/api/src/personal-sec-filings-provider.test.ts", status: "A" },
  { path: "apps/api/src/personal-sec-filings-provider.ts", status: "A" },
  { path: "apps/api/src/workspace-app.ts", status: "M" },
  { path: "apps/api/src/workspace-composition-root.ts", status: "M" },
  { path: "apps/api/src/workspace-static-graph.test.ts", status: "M" },
  {
    path: "apps/api/src/workspace-watchlist-filings-routes.test.ts",
    status: "A",
  },
  { path: "apps/api/src/workspace-watchlist-filings-routes.ts", status: "A" },
  { path: "apps/api/src/workspace-watchlist-routes.ts", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalWatchlistFilings.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalWatchlistFilings.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-watchlist-filings-api.test.ts",
    status: "A",
  },
  { path: "apps/web/src/lib/personal-watchlist-filings-api.ts", status: "A" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/WATCHLIST_SEC_FILINGS.md", status: "A" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  { path: "packages/contracts/src/personal-watchlist-filings.ts", status: "A" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3L_A1_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3M_A1_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/api/src/workspace-app.ts", status: "M" },
  { path: "apps/api/src/workspace-portfolio-routes.test.ts", status: "A" },
  { path: "apps/api/src/workspace-portfolio-routes.ts", status: "A" },
  { path: "apps/api/src/workspace-static-graph.test.ts", status: "M" },
  { path: "apps/web/app/layout.tsx", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalPortfolio.test.tsx",
    status: "A",
  },
  { path: "apps/web/src/features/research/PersonalPortfolio.tsx", status: "A" },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/personal-portfolio.css",
    status: "A",
  },
  { path: "apps/web/src/lib/personal-portfolio-api.test.ts", status: "A" },
  { path: "apps/web/src/lib/personal-portfolio-api.ts", status: "A" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PORTFOLIO.md", status: "A" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  { path: "packages/contracts/src/personal-portfolio.test.ts", status: "A" },
  { path: "packages/contracts/src/personal-portfolio.ts", status: "A" },
  { path: "packages/personal-market-analytics/src/index.ts", status: "M" },
  {
    path: "packages/personal-market-analytics/src/personal-portfolio-overview.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-market-analytics/src/personal-portfolio-overview.ts",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3M_A1_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3M_A2_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/api/src/workspace-portfolio-routes.test.ts", status: "M" },
  { path: "apps/api/src/workspace-portfolio-routes.ts", status: "M" },
  { path: "apps/web/app/layout.tsx", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalPortfolio.test.tsx",
    status: "M",
  },
  { path: "apps/web/src/features/research/PersonalPortfolio.tsx", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalPortfolioLedgerEditor.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioLedgerEditor.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/personal-portfolio-ledger.css",
    status: "A",
  },
  { path: "apps/web/src/lib/personal-portfolio-api.test.ts", status: "M" },
  { path: "apps/web/src/lib/personal-portfolio-api.ts", status: "M" },
  {
    path: "apps/web/src/lib/personal-portfolio-ledger-csv.test.ts",
    status: "A",
  },
  { path: "apps/web/src/lib/personal-portfolio-ledger-csv.ts", status: "A" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PORTFOLIO.md", status: "M" },
  { path: "docs/PERSONAL_PORTFOLIO_LEDGER.md", status: "A" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  {
    path: "packages/contracts/src/personal-portfolio-ledger.test.ts",
    status: "A",
  },
  { path: "packages/contracts/src/personal-portfolio-ledger.ts", status: "A" },
];
const CYCLE_3M_A2_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3M_A3_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/api/src/workspace-portfolio-routes.test.ts", status: "M" },
  { path: "apps/api/src/workspace-portfolio-routes.ts", status: "M" },
  { path: "apps/web/app/layout.tsx", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalPortfolio.test.tsx",
    status: "M",
  },
  { path: "apps/web/src/features/research/PersonalPortfolio.tsx", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalPortfolioHistoryCoverage.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioHistoryCoverage.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioLedgerEditor.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioLedgerEditor.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioSplitEditor.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioSplitEditor.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/personal-portfolio-history.css",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/personal-portfolio-ledger.css",
    status: "M",
  },
  { path: "apps/web/src/lib/personal-portfolio-api.test.ts", status: "M" },
  { path: "apps/web/src/lib/personal-portfolio-api.ts", status: "M" },
  { path: "apps/web/src/lib/personal-portfolio-history.test.ts", status: "A" },
  { path: "apps/web/src/lib/personal-portfolio-history.ts", status: "A" },
  {
    path: "apps/web/src/lib/personal-portfolio-ledger-csv.test.ts",
    status: "M",
  },
  { path: "apps/web/src/lib/personal-portfolio-ledger-csv.ts", status: "M" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PORTFOLIO_CORPORATE_ACTIONS.md", status: "A" },
  { path: "docs/PERSONAL_PORTFOLIO_LEDGER.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  {
    path: "packages/contracts/src/personal-portfolio-ledger.test.ts",
    status: "M",
  },
  { path: "packages/contracts/src/personal-portfolio-ledger.ts", status: "M" },
];
const CYCLE_3M_A3_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3M_A4_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/web/app/layout.tsx", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalPortfolio.test.tsx",
    status: "M",
  },
  { path: "apps/web/src/features/research/PersonalPortfolio.tsx", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalPortfolioHistoryCoverage.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioHistoryCoverage.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioValuationHistory.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioValuationHistory.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/personal-portfolio-valuation-history.css",
    status: "A",
  },
  {
    path: "apps/web/src/lib/personal-portfolio-valuation-history.test.ts",
    status: "A",
  },
  {
    path: "apps/web/src/lib/personal-portfolio-valuation-history.ts",
    status: "A",
  },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PORTFOLIO_CORPORATE_ACTIONS.md", status: "M" },
  { path: "docs/PERSONAL_PORTFOLIO_VALUATION_HISTORY.md", status: "A" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
];
const CYCLE_3M_A4_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3M_A5_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalPortfolioHistoryCoverage.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioHistoryCoverage.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioValuationHistory.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioValuationHistory.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/personal-portfolio-valuation-history.css",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-portfolio-valuation-history.test.ts",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-portfolio-valuation-history.ts",
    status: "M",
  },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PORTFOLIO_VALUATION_HISTORY.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
];
const CYCLE_3M_A5_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3M_A6_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalPortfolioHistoryCoverage.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioHistoryCoverage.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioValuationHistory.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioValuationHistory.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/personal-portfolio-valuation-history.css",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-portfolio-valuation-history.test.ts",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-portfolio-valuation-history.ts",
    status: "M",
  },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PORTFOLIO_VALUATION_HISTORY.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
];
const CYCLE_3M_A6_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3M_A7_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalPortfolioHistoryCoverage.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioHistoryCoverage.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioValuationHistory.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalPortfolioValuationHistory.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/personal-portfolio-valuation-history.css",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-portfolio-valuation-history.test.ts",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-portfolio-valuation-history.ts",
    status: "M",
  },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PORTFOLIO_VALUATION_HISTORY.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
];
const CYCLE_3M_A7_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3H_A4_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalQuarterlyFinancials.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalQuarterlyFinancials.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-quarterly-compatibility.test.ts",
    status: "A",
  },
  { path: "apps/web/src/lib/personal-quarterly-compatibility.ts", status: "A" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/PERSONAL_QUARTERLY_COMPATIBILITY.md", status: "A" },
  { path: "packages/personal-financial-analytics/src/index.ts", status: "M" },
  {
    path: "packages/personal-financial-analytics/src/personal-quarterly-compatibility.test.ts",
    status: "A",
  },
  {
    path: "packages/personal-financial-analytics/src/personal-quarterly-compatibility.ts",
    status: "A",
  },
];
const CYCLE_3H_A4_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3H_A5_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/api/src/personal-sec-filings-provider.test.ts", status: "M" },
  { path: "apps/api/src/personal-sec-filings-provider.ts", status: "M" },
  { path: "apps/api/src/personal-sec-financial-provider.test.ts", status: "M" },
  { path: "apps/api/src/personal-sec-financial-provider.ts", status: "M" },
  {
    path: "apps/api/src/personal-sec-quarterly-evidence-provider.test.ts",
    status: "A",
  },
  {
    path: "apps/api/src/personal-sec-quarterly-evidence-provider.ts",
    status: "A",
  },
  { path: "apps/api/src/personal-sec-request-scheduler.test.ts", status: "A" },
  { path: "apps/api/src/personal-sec-request-scheduler.ts", status: "A" },
  { path: "apps/api/src/workspace-app.ts", status: "M" },
  { path: "apps/api/src/workspace-composition-root.test.ts", status: "M" },
  { path: "apps/api/src/workspace-composition-root.ts", status: "M" },
  {
    path: "apps/api/src/workspace-sec-quarterly-evidence-routes.test.ts",
    status: "A",
  },
  {
    path: "apps/api/src/workspace-sec-quarterly-evidence-routes.ts",
    status: "A",
  },
  { path: "apps/api/src/workspace-static-graph.test.ts", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalSecQuarterlyEvidence.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalSecQuarterlyEvidence.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-sec-quarterly-evidence-api.test.ts",
    status: "A",
  },
  {
    path: "apps/web/src/lib/personal-sec-quarterly-evidence-api.ts",
    status: "A",
  },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/PERSONAL_SEC_QUARTERLY_EVIDENCE.md", status: "A" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  {
    path: "packages/contracts/src/personal-sec-quarterly-evidence.ts",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3H_A5_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3H_A6_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalSecQuarterlyEvidence.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalSecQuarterlyEvidence.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-sec-quarterly-comparison.test.ts",
    status: "A",
  },
  {
    path: "apps/web/src/lib/personal-sec-quarterly-comparison.ts",
    status: "A",
  },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/PERSONAL_SEC_QUARTERLY_EVIDENCE.md", status: "M" },
];
const CYCLE_3H_A6_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3H_A7_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  { path: "apps/api/src/copy-validators.ts", status: "M" },
  {
    path: "apps/api/src/personal-sec-filing-context-parser.test.ts",
    status: "A",
  },
  { path: "apps/api/src/personal-sec-filing-context-parser.ts", status: "A" },
  {
    path: "apps/api/src/personal-sec-filing-context-provider.test.ts",
    status: "A",
  },
  { path: "apps/api/src/personal-sec-filing-context-provider.ts", status: "A" },
  {
    path: "apps/api/src/personal-sec-quarterly-evidence-provider.ts",
    status: "M",
  },
  { path: "apps/api/src/workspace-app.ts", status: "M" },
  { path: "apps/api/src/workspace-composition-root.test.ts", status: "M" },
  { path: "apps/api/src/workspace-composition-root.ts", status: "M" },
  {
    path: "apps/api/src/workspace-sec-filing-context-routes.test.ts",
    status: "A",
  },
  { path: "apps/api/src/workspace-sec-filing-context-routes.ts", status: "A" },
  { path: "apps/api/src/workspace-static-graph.test.ts", status: "M" },
  { path: "apps/api/workers/personal_sec_filing_context.py", status: "A" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalSecFilingContext.test.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalSecFilingContext.tsx",
    status: "A",
  },
  {
    path: "apps/web/src/features/research/PersonalSecQuarterlyEvidence.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalSecQuarterlyEvidence.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-sec-filing-context-api.test.ts",
    status: "A",
  },
  { path: "apps/web/src/lib/personal-sec-filing-context-api.ts", status: "A" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/PERSONAL_SEC_FILING_CONTEXT.md", status: "A" },
  { path: "docs/PERSONAL_SEC_QUARTERLY_EVIDENCE.md", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  {
    path: "packages/contracts/src/personal-sec-filing-context.ts",
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3H_A7_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3H_A8_FEATURE_TRANSITION = [
  { path: "README.md", status: "M" },
  {
    path: "apps/api/src/personal-sec-filing-context-parser.test.ts",
    status: "M",
  },
  { path: "apps/api/src/personal-sec-filing-context-parser.ts", status: "M" },
  {
    path: "apps/api/src/personal-sec-filing-context-provider.test.ts",
    status: "M",
  },
  { path: "apps/api/src/workspace-composition-root.test.ts", status: "M" },
  {
    path: "apps/api/src/workspace-sec-filing-context-routes.test.ts",
    status: "M",
  },
  { path: "apps/api/src/workspace-sec-filing-context-routes.ts", status: "M" },
  { path: "apps/api/workers/personal_sec_filing_context.py", status: "M" },
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalSecFilingContext.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalSecFilingContext.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-sec-filing-context-api.test.ts",
    status: "M",
  },
  { path: "apps/web/src/lib/personal-sec-filing-context-api.ts", status: "M" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_PRODUCT_BREADTH_ROADMAP.md", status: "M" },
  { path: "docs/PERSONAL_SEC_FILING_CONTEXT.md", status: "M" },
  {
    path: "packages/contracts/src/personal-sec-filing-context.ts",
    status: "M",
  },
];
const CYCLE_3H_A8_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3H_A9_FEATURE_TRANSITION = [
  { path: "apps/api/src/copy-validators.ts", status: "M" },
  {
    path: "apps/api/src/personal-sec-filing-context-parser.test.ts",
    status: "M",
  },
  { path: "apps/api/src/verify-built-entrypoints.test.ts", status: "A" },
  { path: "apps/api/src/verify-built-entrypoints.ts", status: "A" },
  { path: "apps/api/src/workspace-static-graph.test.ts", status: "M" },
  { path: "apps/api/tsup.config.ts", status: "M" },
  { path: "apps/api/workers/personal_sec_filing_context.py", status: "M" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_SEC_FILING_CONTEXT.md", status: "M" },
];
const CYCLE_3H_A9_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3H_A10_FEATURE_TRANSITION = [
  {
    path: "apps/api/src/personal-sec-filing-context-parser.test.ts",
    status: "M",
  },
  { path: "apps/api/workers/personal_sec_filing_context.py", status: "M" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_SEC_FILING_CONTEXT.md", status: "M" },
];
const CYCLE_3H_A10_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3H_A11_FEATURE_TRANSITION = [
  {
    path: "apps/api/src/personal-sec-filing-context-parser.test.ts",
    status: "M",
  },
  { path: "apps/api/src/personal-sec-filing-context-parser.ts", status: "M" },
  { path: "apps/api/workers/personal_sec_filing_context.py", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalSecFilingContext.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-sec-filing-context-api.test.ts",
    status: "M",
  },
  { path: "apps/web/src/lib/personal-sec-filing-context-api.ts", status: "M" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_SEC_FILING_CONTEXT.md", status: "M" },
  { path: "packages/contracts/src/index.ts", status: "M" },
  {
    path: "packages/contracts/src/personal-sec-reporting-value.test.ts",
    status: "A",
  },
  {
    path: "packages/contracts/src/personal-sec-reporting-value.ts",
    status: "A",
  },
];
const CYCLE_3H_A11_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3H_A12_FEATURE_TRANSITION = [
  { path: "apps/web/app/globals.css", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalSecFilingContext.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalSecFilingContext.tsx",
    status: "M",
  },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/PERSONAL_SEC_FILING_CONTEXT.md", status: "M" },
];
const CYCLE_3H_A12_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3H_A13_FEATURE_TRANSITION = [
  {
    path: "packages/db/tests/postgres-acceptance-evidence-review.test.ts",
    status: "M",
  },
];
const CYCLE_3H_A13_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3H_A14_FEATURE_TRANSITION = [
  { path: "packages/local-research-vault/package.json", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3H_A14_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3K_A3_FEATURE_TRANSITION = [
  {
    path: "apps/api/src/workspace-financial-screen-routes.test.ts",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalFinancialScreener.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalFinancialScreener.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-financial-screen-api.test.ts",
    status: "M",
  },
  { path: "apps/web/src/lib/personal-financial-screen-api.ts", status: "M" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/SEC_ANNUAL_FINANCIAL_SCREENING.md", status: "M" },
  {
    path: "packages/contracts/src/personal-financial-screener.ts",
    status: "M",
  },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-screener.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-screener.ts",
    status: "M",
  },
];
const CYCLE_3K_A3_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3K_A4_FEATURE_TRANSITION = [
  {
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.test.ts",
    status: "M",
  },
];
const CYCLE_3K_A4_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3K_A5_FEATURE_TRANSITION = [
  { path: "apps/api/src/personal-sec-financial-provider.test.ts", status: "M" },
  {
    path: "apps/api/src/workspace-financial-screen-routes.test.ts",
    status: "M",
  },
  { path: "apps/api/src/workspace-financial-screen-routes.ts", status: "M" },
  {
    path: "apps/web/src/features/research/PersonalFinancialScreener.test.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/features/research/PersonalFinancialScreener.tsx",
    status: "M",
  },
  {
    path: "apps/web/src/lib/personal-financial-screen-api.test.ts",
    status: "M",
  },
  { path: "apps/web/src/lib/personal-financial-screen-api.ts", status: "M" },
  { path: "docs/CURRENT_WORK.md", status: "M" },
  { path: "docs/SEC_ANNUAL_FINANCIAL_SCREENING.md", status: "M" },
  {
    path: "packages/contracts/src/personal-financial-screener.ts",
    status: "M",
  },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-screener.test.ts",
    status: "M",
  },
  {
    path: "packages/personal-financial-analytics/src/personal-financial-screener.ts",
    status: "M",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
];
const CYCLE_3K_A5_ROUTING_CLOSURE_TRANSITION = [
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
const CYCLE_3K_A6_FEATURE_TRANSITION = [
  { path: "apps/api/src/personal-sec-request-scheduler.test.ts", status: "M" },
];
const CYCLE_3K_A6_ROUTING_CLOSURE_TRANSITION = [
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
  const canonicalTempFixtureStabilizationTopology = [
    "31",
    "31",
    CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION,
    `${CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION} ${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION}`,
    windowsSnapshotMetadataStabilizationTopology,
  ] as const;
  const sourcePreparationTopology = [
    "32",
    "32",
    CYCLE_3E_A1_SOURCE_PREPARATION_REVISION,
    `${CYCLE_3E_A1_SOURCE_PREPARATION_REVISION} ${CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION}`,
    canonicalTempFixtureStabilizationTopology,
  ] as const;
  const sourcePreparationRoutingClosureTopology = [
    "33",
    "33",
    CYCLE_3E_A1_ROUTING_CLOSURE_REVISION,
    `${CYCLE_3E_A1_ROUTING_CLOSURE_REVISION} ${CYCLE_3E_A1_SOURCE_PREPARATION_REVISION}`,
    sourcePreparationTopology,
  ] as const;
  const publicEngineeringEvidenceRecordTopology = [
    "34",
    "34",
    CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION,
    `${CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION} ${CYCLE_3E_A1_ROUTING_CLOSURE_REVISION}`,
    sourcePreparationRoutingClosureTopology,
  ] as const;
  const measurementClockClosureTopology = [
    "35",
    "35",
    CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_REVISION,
    `${CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_REVISION} ${CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION}`,
    publicEngineeringEvidenceRecordTopology,
  ] as const;
  const cycle3ea2RoutingClosureTopology = [
    "36",
    "36",
    CYCLE_3E_A2_ROUTING_CLOSURE_REVISION,
    `${CYCLE_3E_A2_ROUTING_CLOSURE_REVISION} ${CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_REVISION}`,
    measurementClockClosureTopology,
  ] as const;
  const cycle3ea2PublicEngineeringEvidenceRecordTopology = [
    "37",
    "37",
    CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION,
    `${CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION} ${CYCLE_3E_A2_ROUTING_CLOSURE_REVISION}`,
    cycle3ea2RoutingClosureTopology,
  ] as const;
  const cycle3bPublicPromotionTopology = [
    "38",
    "38",
    CYCLE_3B_PUBLIC_PROMOTION_REVISION,
    `${CYCLE_3B_PUBLIC_PROMOTION_REVISION} ${CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION}`,
    cycle3ea2PublicEngineeringEvidenceRecordTopology,
  ] as const;
  const openFigiAliasSourceTopology = [
    "39",
    "39",
    CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION,
    `${CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION} ${CYCLE_3B_PUBLIC_PROMOTION_REVISION}`,
    cycle3bPublicPromotionTopology,
  ] as const;
  const openFigiAliasRoutingClosureTopology = [
    "40",
    "40",
    CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_REVISION,
    `${CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_REVISION} ${CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION}`,
    openFigiAliasSourceTopology,
  ] as const;
  const windowsExpiryRecoveryLatencyStabilizationTopology = [
    "41",
    "41",
    CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_REVISION,
    `${CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_REVISION} ${CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_REVISION}`,
    openFigiAliasRoutingClosureTopology,
  ] as const;
  const windowsExpiryRecoveryLatencyRoutingClosureTopology = [
    "42",
    "42",
    CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_ROUTING_CLOSURE_REVISION,
    `${CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_ROUTING_CLOSURE_REVISION} ${CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_REVISION}`,
    windowsExpiryRecoveryLatencyStabilizationTopology,
  ] as const;
  const providerQueryMicSourceTopology = [
    "43",
    "43",
    CYCLE_3E_A_PROVIDER_QUERY_MIC_SOURCE_REVISION,
    `${CYCLE_3E_A_PROVIDER_QUERY_MIC_SOURCE_REVISION} ${CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_ROUTING_CLOSURE_REVISION}`,
    windowsExpiryRecoveryLatencyRoutingClosureTopology,
  ] as const;
  const cycle3eaPublicPromotionTopology = [
    "44",
    "44",
    CYCLE_3E_A_PUBLIC_PROMOTION_REVISION,
    `${CYCLE_3E_A_PUBLIC_PROMOTION_REVISION} ${CYCLE_3E_A_PROVIDER_QUERY_MIC_SOURCE_REVISION}`,
    providerQueryMicSourceTopology,
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

  it("pins the exact merge-free canonical-temp-fixture stabilization", () => {
    expect(
      isCycle3eaCanonicalTempFixtureStabilizationTopologyAllowed(
        ...canonicalTempFixtureStabilizationTopology,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "30"],
      [1, "32"],
      [2, CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION],
      [
        3,
        `${CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION} ${CYCLE_3E_A_WINDOWS_STABLE_FILE_STABILIZATION_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [...canonicalTempFixtureStabilizationTopology];
      changed[index] = replacement;
      expect(
        isCycle3eaCanonicalTempFixtureStabilizationTopologyAllowed(
          ...(changed as unknown as Parameters<
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
        `${CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION} ${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION}`,
        windowsSnapshotMetadataStabilizationTopology,
      ),
    ).toBe(false);
    const unpinnedRevision = "d".repeat(40);
    expect(
      isCycle3eaCanonicalTempFixtureStabilizationTopologyAllowed(
        "31",
        "31",
        unpinnedRevision,
        `${unpinnedRevision} ${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION}`,
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
        CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION,
        `${CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION} ${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION}`,
        changedMetadata as unknown as Parameters<
          typeof isCycle3eaWindowsSnapshotMetadataStabilizationTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free Cycle 3e-a1 source-preparation child", () => {
    expect(
      isCycle3ea1SourcePreparationTopologyAllowed(...sourcePreparationTopology),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "31"],
      [1, "33"],
      [2, "d".repeat(40)],
      [
        3,
        `${CYCLE_3E_A1_SOURCE_PREPARATION_REVISION} ${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [...sourcePreparationTopology];
      changed[index] = replacement;
      expect(
        isCycle3ea1SourcePreparationTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ea1SourcePreparationTopologyAllowed
          >),
        ),
        `source-preparation:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3ea1SourcePreparationTopologyAllowed(
        "32",
        "32",
        "not-a-commit",
        `${CYCLE_3E_A1_SOURCE_PREPARATION_REVISION} ${CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION}`,
        canonicalTempFixtureStabilizationTopology,
      ),
    ).toBe(false);
    const unpinnedRevision = "d".repeat(40);
    expect(
      isCycle3ea1SourcePreparationTopologyAllowed(
        "32",
        "32",
        unpinnedRevision,
        `${unpinnedRevision} ${CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION}`,
        canonicalTempFixtureStabilizationTopology,
      ),
    ).toBe(false);
    expect(
      isCycle3ea1SourcePreparationTopologyAllowed(
        "32",
        "32",
        CYCLE_3E_A1_SOURCE_PREPARATION_REVISION,
        `${CYCLE_3E_A1_SOURCE_PREPARATION_REVISION} ${CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION} ${"e".repeat(40)}`,
        canonicalTempFixtureStabilizationTopology,
      ),
    ).toBe(false);
    const changedCanonicalTempFixture: unknown[] = [
      ...canonicalTempFixtureStabilizationTopology,
    ];
    changedCanonicalTempFixture[3] = `${CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION} ${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION} ${"f".repeat(40)}`;
    expect(
      isCycle3ea1SourcePreparationTopologyAllowed(
        "32",
        "32",
        CYCLE_3E_A1_SOURCE_PREPARATION_REVISION,
        `${CYCLE_3E_A1_SOURCE_PREPARATION_REVISION} ${CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION}`,
        changedCanonicalTempFixture as unknown as Parameters<
          typeof isCycle3eaCanonicalTempFixtureStabilizationTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free Cycle 3e-a1 routing-closure child", () => {
    const revision = CYCLE_3E_A1_ROUTING_CLOSURE_REVISION;
    const valid = sourcePreparationRoutingClosureTopology;
    expect(isCycle3ea1RoutingClosureTopologyAllowed(...valid)).toBe(true);
    for (const [index, replacement] of [
      [0, "32"],
      [1, "34"],
      [2, "d".repeat(40)],
      [
        3,
        `${revision} ${CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [...valid];
      changed[index] = replacement;
      expect(
        isCycle3ea1RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ea1RoutingClosureTopologyAllowed
          >),
        ),
        `routing-closure:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3ea1RoutingClosureTopologyAllowed(
        "33",
        "33",
        "not-a-commit",
        `not-a-commit ${CYCLE_3E_A1_SOURCE_PREPARATION_REVISION}`,
        sourcePreparationTopology,
      ),
    ).toBe(false);
    expect(
      isCycle3ea1RoutingClosureTopologyAllowed(
        "33",
        "33",
        revision,
        `${revision} ${CYCLE_3E_A1_SOURCE_PREPARATION_REVISION} ${"e".repeat(40)}`,
        sourcePreparationTopology,
      ),
    ).toBe(false);
    const changedSourcePreparation: unknown[] = [...sourcePreparationTopology];
    changedSourcePreparation[3] = `${CYCLE_3E_A1_SOURCE_PREPARATION_REVISION} ${CYCLE_3E_A_WINDOWS_SNAPSHOT_METADATA_STABILIZATION_REVISION}`;
    expect(
      isCycle3ea1RoutingClosureTopologyAllowed(
        "33",
        "33",
        revision,
        `${revision} ${CYCLE_3E_A1_SOURCE_PREPARATION_REVISION}`,
        changedSourcePreparation as unknown as Parameters<
          typeof isCycle3ea1SourcePreparationTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free Cycle 3e-a1 public-engineering record child", () => {
    const revision = CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION;
    const valid = publicEngineeringEvidenceRecordTopology;
    expect(
      isCycle3ea1PublicEngineeringEvidenceRecordTopologyAllowed(...valid),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "33"],
      [1, "35"],
      [2, "f".repeat(40)],
      [3, `${revision} ${CYCLE_3E_A1_SOURCE_PREPARATION_REVISION}`],
    ] as const) {
      const changed: unknown[] = [...valid];
      changed[index] = replacement;
      expect(
        isCycle3ea1PublicEngineeringEvidenceRecordTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ea1PublicEngineeringEvidenceRecordTopologyAllowed
          >),
        ),
        `public-engineering-evidence-record:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3ea1PublicEngineeringEvidenceRecordTopologyAllowed(
        "34",
        "34",
        "not-a-commit",
        `not-a-commit ${CYCLE_3E_A1_ROUTING_CLOSURE_REVISION}`,
        sourcePreparationRoutingClosureTopology,
      ),
    ).toBe(false);
    const unpinnedRevision = "e".repeat(40);
    expect(
      isCycle3ea1PublicEngineeringEvidenceRecordTopologyAllowed(
        "34",
        "34",
        unpinnedRevision,
        `${unpinnedRevision} ${CYCLE_3E_A1_ROUTING_CLOSURE_REVISION}`,
        sourcePreparationRoutingClosureTopology,
      ),
    ).toBe(false);
    expect(
      isCycle3ea1PublicEngineeringEvidenceRecordTopologyAllowed(
        "34",
        "34",
        revision,
        `${revision} ${CYCLE_3E_A1_ROUTING_CLOSURE_REVISION} ${"e".repeat(40)}`,
        sourcePreparationRoutingClosureTopology,
      ),
    ).toBe(false);
    const changedRoutingClosure: unknown[] = [
      ...sourcePreparationRoutingClosureTopology,
    ];
    changedRoutingClosure[3] = `${CYCLE_3E_A1_ROUTING_CLOSURE_REVISION} ${CYCLE_3E_A_CANONICAL_TEMP_FIXTURE_STABILIZATION_REVISION}`;
    expect(
      isCycle3ea1PublicEngineeringEvidenceRecordTopologyAllowed(
        "34",
        "34",
        revision,
        `${revision} ${CYCLE_3E_A1_ROUTING_CLOSURE_REVISION}`,
        changedRoutingClosure as unknown as Parameters<
          typeof isCycle3ea1RoutingClosureTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free Cycle 3e-a2 measurement-clock-closure child", () => {
    const revision = CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_REVISION;
    const valid = [
      "35",
      "35",
      revision,
      `${revision} ${CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION}`,
      publicEngineeringEvidenceRecordTopology,
    ] as const;
    expect(isCycle3ea2MeasurementClockClosureTopologyAllowed(...valid)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "34"],
      [1, "36"],
      [2, "f".repeat(40)],
      [3, `${revision} ${CYCLE_3E_A1_ROUTING_CLOSURE_REVISION}`],
    ] as const) {
      const changed: unknown[] = [...valid];
      changed[index] = replacement;
      expect(
        isCycle3ea2MeasurementClockClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ea2MeasurementClockClosureTopologyAllowed
          >),
        ),
        `measurement-clock-closure:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3ea2MeasurementClockClosureTopologyAllowed(
        "35",
        "35",
        "not-a-commit",
        `not-a-commit ${CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION}`,
        publicEngineeringEvidenceRecordTopology,
      ),
    ).toBe(false);
    expect(
      isCycle3ea2MeasurementClockClosureTopologyAllowed(
        "35",
        "35",
        revision,
        `${revision} ${CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION} ${"e".repeat(40)}`,
        publicEngineeringEvidenceRecordTopology,
      ),
    ).toBe(false);
    const changedRecord: unknown[] = [
      ...publicEngineeringEvidenceRecordTopology,
    ];
    changedRecord[3] = `${CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION} ${CYCLE_3E_A1_SOURCE_PREPARATION_REVISION}`;
    expect(
      isCycle3ea2MeasurementClockClosureTopologyAllowed(
        "35",
        "35",
        revision,
        `${revision} ${CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION}`,
        changedRecord as unknown as Parameters<
          typeof isCycle3ea1PublicEngineeringEvidenceRecordTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free Cycle 3e-a2 routing-closure child", () => {
    const revision = CYCLE_3E_A2_ROUTING_CLOSURE_REVISION;
    const valid = cycle3ea2RoutingClosureTopology;
    expect(isCycle3ea2RoutingClosureTopologyAllowed(...valid)).toBe(true);
    for (const [index, replacement] of [
      [0, "35"],
      [1, "37"],
      [2, "f".repeat(40)],
      [
        3,
        `${revision} ${CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [...valid];
      changed[index] = replacement;
      expect(
        isCycle3ea2RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ea2RoutingClosureTopologyAllowed
          >),
        ),
        `routing-closure:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3ea2RoutingClosureTopologyAllowed(
        "36",
        "36",
        "not-a-commit",
        `not-a-commit ${CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_REVISION}`,
        measurementClockClosureTopology,
      ),
    ).toBe(false);
    expect(
      isCycle3ea2RoutingClosureTopologyAllowed(
        "36",
        "36",
        revision,
        `${revision} ${CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_REVISION} ${"e".repeat(40)}`,
        measurementClockClosureTopology,
      ),
    ).toBe(false);
    const changedSource: unknown[] = [...measurementClockClosureTopology];
    changedSource[3] = `${CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_REVISION} ${CYCLE_3E_A1_ROUTING_CLOSURE_REVISION}`;
    expect(
      isCycle3ea2RoutingClosureTopologyAllowed(
        "36",
        "36",
        revision,
        `${revision} ${CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_REVISION}`,
        changedSource as unknown as Parameters<
          typeof isCycle3ea2MeasurementClockClosureTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free Cycle 3e-a2 public-engineering evidence-record child", () => {
    const revision = CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION;
    const valid = cycle3ea2PublicEngineeringEvidenceRecordTopology;
    expect(
      isCycle3ea2PublicEngineeringEvidenceRecordTopologyAllowed(...valid),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "36"],
      [1, "38"],
      [2, "d".repeat(40)],
      [3, `${revision} ${CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_REVISION}`],
    ] as const) {
      const changed: unknown[] = [...valid];
      changed[index] = replacement;
      expect(
        isCycle3ea2PublicEngineeringEvidenceRecordTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ea2PublicEngineeringEvidenceRecordTopologyAllowed
          >),
        ),
        `public-engineering-evidence-record:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3ea2PublicEngineeringEvidenceRecordTopologyAllowed(
        "37",
        "37",
        "not-a-commit",
        `not-a-commit ${CYCLE_3E_A2_ROUTING_CLOSURE_REVISION}`,
        cycle3ea2RoutingClosureTopology,
      ),
    ).toBe(false);
    const unpinnedRevision = "e".repeat(40);
    expect(
      isCycle3ea2PublicEngineeringEvidenceRecordTopologyAllowed(
        "37",
        "37",
        unpinnedRevision,
        `${unpinnedRevision} ${CYCLE_3E_A2_ROUTING_CLOSURE_REVISION}`,
        cycle3ea2RoutingClosureTopology,
      ),
    ).toBe(false);
    expect(
      isCycle3ea2PublicEngineeringEvidenceRecordTopologyAllowed(
        "37",
        "37",
        revision,
        `${revision} ${CYCLE_3E_A2_ROUTING_CLOSURE_REVISION} ${"e".repeat(40)}`,
        cycle3ea2RoutingClosureTopology,
      ),
    ).toBe(false);
    const changedRouting: unknown[] = [...cycle3ea2RoutingClosureTopology];
    changedRouting[3] = `${CYCLE_3E_A2_ROUTING_CLOSURE_REVISION} ${CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION}`;
    expect(
      isCycle3ea2PublicEngineeringEvidenceRecordTopologyAllowed(
        "37",
        "37",
        revision,
        `${revision} ${CYCLE_3E_A2_ROUTING_CLOSURE_REVISION}`,
        changedRouting as unknown as Parameters<
          typeof isCycle3ea2RoutingClosureTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free Cycle 3b public-promotion child", () => {
    const revision = CYCLE_3B_PUBLIC_PROMOTION_REVISION;
    const valid = cycle3bPublicPromotionTopology;
    expect(isCycle3bPublicPromotionTopologyAllowed(...valid)).toBe(true);
    for (const [index, replacement] of [
      [0, "37"],
      [1, "39"],
      [2, "d".repeat(40)],
      [3, `${revision} ${CYCLE_3E_A2_ROUTING_CLOSURE_REVISION}`],
    ] as const) {
      const changed: unknown[] = [...valid];
      changed[index] = replacement;
      expect(
        isCycle3bPublicPromotionTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3bPublicPromotionTopologyAllowed
          >),
        ),
        `cycle3b-public-promotion:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3bPublicPromotionTopologyAllowed(
        "38",
        "38",
        "not-a-commit",
        `not-a-commit ${CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION}`,
        cycle3ea2PublicEngineeringEvidenceRecordTopology,
      ),
    ).toBe(false);
    expect(
      isCycle3bPublicPromotionTopologyAllowed(
        "38",
        "38",
        revision,
        `${revision} ${CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION} ${"e".repeat(40)}`,
        cycle3ea2PublicEngineeringEvidenceRecordTopology,
      ),
    ).toBe(false);
    const changedRecord: unknown[] = [
      ...cycle3ea2PublicEngineeringEvidenceRecordTopology,
    ];
    changedRecord[3] = `${CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION} ${CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_REVISION}`;
    expect(
      isCycle3bPublicPromotionTopologyAllowed(
        "38",
        "38",
        revision,
        `${revision} ${CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION}`,
        changedRecord as unknown as Parameters<
          typeof isCycle3ea2PublicEngineeringEvidenceRecordTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free OpenFIGI alias-correction source", () => {
    expect(
      isCycle3eaOpenFigiAliasSourceTopologyAllowed(
        ...openFigiAliasSourceTopology,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "38"],
      [1, "40"],
      [2, "e".repeat(40)],
      [
        3,
        `${CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION} ${CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [...openFigiAliasSourceTopology];
      changed[index] = replacement;
      expect(
        isCycle3eaOpenFigiAliasSourceTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eaOpenFigiAliasSourceTopologyAllowed
          >),
        ),
        `openfigi-alias-source:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3eaOpenFigiAliasSourceTopologyAllowed(
        "39",
        "39",
        CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION,
        `${CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION} ${CYCLE_3B_PUBLIC_PROMOTION_REVISION} ${"e".repeat(40)}`,
        cycle3bPublicPromotionTopology,
      ),
    ).toBe(false);
    const changedPromotion: unknown[] = [...cycle3bPublicPromotionTopology];
    changedPromotion[3] = `${CYCLE_3B_PUBLIC_PROMOTION_REVISION} ${CYCLE_3E_A2_ROUTING_CLOSURE_REVISION}`;
    expect(
      isCycle3eaOpenFigiAliasSourceTopologyAllowed(
        "39",
        "39",
        CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION,
        `${CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION} ${CYCLE_3B_PUBLIC_PROMOTION_REVISION}`,
        changedPromotion as unknown as Parameters<
          typeof isCycle3bPublicPromotionTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free OpenFIGI alias routing closure", () => {
    const revision = CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_REVISION;
    const valid = openFigiAliasRoutingClosureTopology;
    expect(isCycle3eaOpenFigiAliasRoutingClosureTopologyAllowed(...valid)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "39"],
      [1, "41"],
      [2, "f".repeat(40)],
      [3, `${revision} ${CYCLE_3B_PUBLIC_PROMOTION_REVISION}`],
    ] as const) {
      const changed: unknown[] = [...valid];
      changed[index] = replacement;
      expect(
        isCycle3eaOpenFigiAliasRoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eaOpenFigiAliasRoutingClosureTopologyAllowed
          >),
        ),
        `openfigi-alias-routing:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3eaOpenFigiAliasRoutingClosureTopologyAllowed(
        "40",
        "40",
        "not-a-commit",
        `not-a-commit ${CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION}`,
        openFigiAliasSourceTopology,
      ),
    ).toBe(false);
    expect(
      isCycle3eaOpenFigiAliasRoutingClosureTopologyAllowed(
        "40",
        "40",
        revision,
        `${revision} ${CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION} ${CYCLE_3B_PUBLIC_PROMOTION_REVISION}`,
        openFigiAliasSourceTopology,
      ),
    ).toBe(false);
    const changedSource: unknown[] = [...openFigiAliasSourceTopology];
    changedSource[3] = `${CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION} ${CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_REVISION}`;
    expect(
      isCycle3eaOpenFigiAliasRoutingClosureTopologyAllowed(
        "40",
        "40",
        revision,
        `${revision} ${CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION}`,
        changedSource as unknown as Parameters<
          typeof isCycle3eaOpenFigiAliasSourceTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact merge-free Windows expiry-recovery latency stabilization", () => {
    const revision =
      CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_REVISION;
    const valid = windowsExpiryRecoveryLatencyStabilizationTopology;
    expect(
      isCycle3eaWindowsExpiryRecoveryLatencyStabilizationTopologyAllowed(
        ...valid,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "40"],
      [1, "42"],
      [2, "f".repeat(40)],
      [3, `${revision} ${CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION}`],
    ] as const) {
      const changed: unknown[] = [...valid];
      changed[index] = replacement;
      expect(
        isCycle3eaWindowsExpiryRecoveryLatencyStabilizationTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eaWindowsExpiryRecoveryLatencyStabilizationTopologyAllowed
          >),
        ),
        `windows-expiry-recovery-latency:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3eaWindowsExpiryRecoveryLatencyStabilizationTopologyAllowed(
        "41",
        "41",
        revision,
        `${revision} ${CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_REVISION} ${"e".repeat(40)}`,
        openFigiAliasRoutingClosureTopology,
      ),
    ).toBe(false);
    const changedRouting: unknown[] = [...openFigiAliasRoutingClosureTopology];
    changedRouting[3] = `${CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_REVISION} ${CYCLE_3B_PUBLIC_PROMOTION_REVISION}`;
    expect(
      isCycle3eaWindowsExpiryRecoveryLatencyStabilizationTopologyAllowed(
        "41",
        "41",
        revision,
        `${revision} ${CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_REVISION}`,
        changedRouting as unknown as Parameters<
          typeof isCycle3eaOpenFigiAliasRoutingClosureTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the exact-inventory merge-free Windows stabilization routing child", () => {
    const revision =
      CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_ROUTING_CLOSURE_REVISION;
    const valid = windowsExpiryRecoveryLatencyRoutingClosureTopology;
    expect(
      isCycle3eaWindowsExpiryRecoveryLatencyRoutingClosureTopologyAllowed(
        ...valid,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "41"],
      [1, "43"],
      [2, "f".repeat(40)],
      [3, `${revision} ${CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_REVISION}`],
    ] as const) {
      const changed: unknown[] = [...valid];
      changed[index] = replacement;
      expect(
        isCycle3eaWindowsExpiryRecoveryLatencyRoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eaWindowsExpiryRecoveryLatencyRoutingClosureTopologyAllowed
          >),
        ),
        `windows-expiry-recovery-latency-routing:${index}`,
      ).toBe(false);
    }
    expect(
      isCycle3eaWindowsExpiryRecoveryLatencyRoutingClosureTopologyAllowed(
        "42",
        "42",
        revision,
        `${revision} ${CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_REVISION} ${"e".repeat(40)}`,
        windowsExpiryRecoveryLatencyStabilizationTopology,
      ),
    ).toBe(false);
    const changedStabilization: unknown[] = [
      ...windowsExpiryRecoveryLatencyStabilizationTopology,
    ];
    changedStabilization[3] = `${CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_REVISION} ${CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_REVISION}`;
    expect(
      isCycle3eaWindowsExpiryRecoveryLatencyRoutingClosureTopologyAllowed(
        "42",
        "42",
        revision,
        `${revision} ${CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_REVISION}`,
        changedStabilization as unknown as Parameters<
          typeof isCycle3eaWindowsExpiryRecoveryLatencyStabilizationTopologyAllowed
        >,
      ),
    ).toBe(false);
  });

  it("pins the provider, promotion, and visible-feature routing chain", () => {
    expect(
      isCycle3eaProviderQueryMicSourceTopologyAllowed(
        ...providerQueryMicSourceTopology,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "42"],
      [1, "44"],
      [2, "f".repeat(40)],
      [
        3,
        `${CYCLE_3E_A_PROVIDER_QUERY_MIC_SOURCE_REVISION} ${CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [...providerQueryMicSourceTopology];
      changed[index] = replacement;
      expect(
        isCycle3eaProviderQueryMicSourceTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eaProviderQueryMicSourceTopologyAllowed
          >),
        ),
      ).toBe(false);
    }

    const promotionRevision = CYCLE_3E_A_PUBLIC_PROMOTION_REVISION;
    expect(
      isCycle3eaPublicPromotionTopologyAllowed(
        ...cycle3eaPublicPromotionTopology,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "43"],
      [1, "45"],
      [2, "f".repeat(40)],
      [
        3,
        `${promotionRevision} ${CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_ROUTING_CLOSURE_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [...cycle3eaPublicPromotionTopology];
      changed[index] = replacement;
      expect(
        isCycle3eaPublicPromotionTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eaPublicPromotionTopologyAllowed
          >),
        ),
      ).toBe(false);
    }

    const featureRevision = CYCLE_3E_B1_FEATURE_REVISION;
    const feature = [
      "45",
      "45",
      featureRevision,
      `${featureRevision} ${CYCLE_3E_A_PUBLIC_PROMOTION_REVISION}`,
      cycle3eaPublicPromotionTopology,
    ] as const;
    expect(isCycle3eb1FeatureTopologyAllowed(...feature)).toBe(true);
    for (const [index, replacement] of [
      [0, "44"],
      [1, "46"],
      [2, "f".repeat(40)],
      [
        3,
        `${featureRevision} ${CYCLE_3E_A_PROVIDER_QUERY_MIC_SOURCE_REVISION}`,
      ],
    ] as const) {
      const changed: unknown[] = [...feature];
      changed[index] = replacement;
      expect(
        isCycle3eb1FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eb1FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }

    const closureRevision = CYCLE_3E_B1_ROUTING_CLOSURE_REVISION;
    const closure = [
      "46",
      "46",
      closureRevision,
      `${closureRevision} ${CYCLE_3E_B1_FEATURE_REVISION}`,
      feature,
    ] as const;
    expect(isCycle3eb1RoutingClosureTopologyAllowed(...closure)).toBe(true);
    for (const [index, replacement] of [
      [0, "45"],
      [1, "47"],
      [2, CYCLE_3E_B1_FEATURE_REVISION],
      [2, "e".repeat(40)],
      [2, "not-a-commit"],
      [3, `${closureRevision} ${CYCLE_3E_A_PUBLIC_PROMOTION_REVISION}`],
    ] as const) {
      const changed: unknown[] = [...closure];
      changed[index] = replacement;
      expect(
        isCycle3eb1RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3eb1RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const changedFeature: unknown[] = [...feature];
    changedFeature[2] = "d".repeat(40);
    expect(
      isCycle3eb1RoutingClosureTopologyAllowed(
        "46",
        "46",
        closureRevision,
        `${closureRevision} ${CYCLE_3E_B1_FEATURE_REVISION}`,
        changedFeature as unknown as Parameters<
          typeof isCycle3eb1RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const marketFeature = [
      "47",
      "47",
      CYCLE_3G_A1_FEATURE_REVISION,
      `${CYCLE_3G_A1_FEATURE_REVISION} ${CYCLE_3E_B1_ROUTING_CLOSURE_REVISION}`,
      closure,
    ] as const;
    expect(isCycle3ga1FeatureTopologyAllowed(...marketFeature)).toBe(true);
    for (const [index, replacement] of [
      [0, "46"],
      [1, "48"],
      [2, "f".repeat(40)],
      [3, `${CYCLE_3G_A1_FEATURE_REVISION} ${CYCLE_3E_B1_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3G_A1_FEATURE_REVISION} ${CYCLE_3E_B1_ROUTING_CLOSURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...marketFeature];
      changed[index] = replacement;
      expect(
        isCycle3ga1FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ga1FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const changedClosure: unknown[] = [...closure];
    changedClosure[2] = "e".repeat(40);
    expect(
      isCycle3ga1FeatureTopologyAllowed(
        "47",
        "47",
        CYCLE_3G_A1_FEATURE_REVISION,
        `${CYCLE_3G_A1_FEATURE_REVISION} ${CYCLE_3E_B1_ROUTING_CLOSURE_REVISION}`,
        changedClosure as unknown as Parameters<
          typeof isCycle3ga1FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const marketClosureRevision = "c".repeat(40);
    const marketClosure = [
      "48",
      "48",
      marketClosureRevision,
      `${marketClosureRevision} ${CYCLE_3G_A1_FEATURE_REVISION}`,
      marketFeature,
    ] as const;
    expect(isCycle3ga1RoutingClosureTopologyAllowed(...marketClosure)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "47"],
      [1, "49"],
      [2, CYCLE_3G_A1_FEATURE_REVISION],
      [2, "not-a-commit"],
      [3, `${marketClosureRevision} ${CYCLE_3E_B1_ROUTING_CLOSURE_REVISION}`],
      [
        3,
        `${marketClosureRevision} ${CYCLE_3G_A1_FEATURE_REVISION} ${"d".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...marketClosure];
      changed[index] = replacement;
      expect(
        isCycle3ga1RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ga1RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const changedMarketFeature: unknown[] = [...marketFeature];
    changedMarketFeature[2] = "d".repeat(40);
    expect(
      isCycle3ga1RoutingClosureTopologyAllowed(
        "48",
        "48",
        marketClosureRevision,
        `${marketClosureRevision} ${CYCLE_3G_A1_FEATURE_REVISION}`,
        changedMarketFeature as unknown as Parameters<
          typeof isCycle3ga1RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);
  });

  it("pins the exact Cycle 3g-b1 feature and merge-free routing child", () => {
    const cycle3eb1Feature = [
      "45",
      "45",
      CYCLE_3E_B1_FEATURE_REVISION,
      `${CYCLE_3E_B1_FEATURE_REVISION} ${CYCLE_3E_A_PUBLIC_PROMOTION_REVISION}`,
      cycle3eaPublicPromotionTopology,
    ] as const;
    const cycle3eb1Closure = [
      "46",
      "46",
      CYCLE_3E_B1_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3E_B1_ROUTING_CLOSURE_REVISION} ${CYCLE_3E_B1_FEATURE_REVISION}`,
      cycle3eb1Feature,
    ] as const;
    const cycle3ga1Feature = [
      "47",
      "47",
      CYCLE_3G_A1_FEATURE_REVISION,
      `${CYCLE_3G_A1_FEATURE_REVISION} ${CYCLE_3E_B1_ROUTING_CLOSURE_REVISION}`,
      cycle3eb1Closure,
    ] as const;
    const cycle3ga1Closure = [
      "48",
      "48",
      CYCLE_3G_A1_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3G_A1_ROUTING_CLOSURE_REVISION} ${CYCLE_3G_A1_FEATURE_REVISION}`,
      cycle3ga1Feature,
    ] as const;
    expect(isCycle3ga1RoutingClosureTopologyAllowed(...cycle3ga1Closure)).toBe(
      true,
    );

    const feature = [
      "49",
      "49",
      CYCLE_3G_B1_FEATURE_REVISION,
      `${CYCLE_3G_B1_FEATURE_REVISION} ${CYCLE_3G_A1_ROUTING_CLOSURE_REVISION}`,
      cycle3ga1Closure,
    ] as const;
    expect(isCycle3gb1FeatureTopologyAllowed(...feature)).toBe(true);
    for (const [index, replacement] of [
      [0, "48"],
      [1, "50"],
      [2, "f".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3G_B1_FEATURE_REVISION} ${CYCLE_3G_A1_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3G_B1_FEATURE_REVISION} ${CYCLE_3G_A1_ROUTING_CLOSURE_REVISION} ${"e".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...feature];
      changed[index] = replacement;
      expect(
        isCycle3gb1FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3gb1FeatureTopologyAllowed
          >),
        ),
        `cycle3gb1-feature:${index}:${replacement}`,
      ).toBe(false);
    }
    const changedClosure: unknown[] = [...cycle3ga1Closure];
    changedClosure[2] = "d".repeat(40);
    expect(
      isCycle3gb1FeatureTopologyAllowed(
        "49",
        "49",
        CYCLE_3G_B1_FEATURE_REVISION,
        `${CYCLE_3G_B1_FEATURE_REVISION} ${CYCLE_3G_A1_ROUTING_CLOSURE_REVISION}`,
        changedClosure as unknown as Parameters<
          typeof isCycle3gb1FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const routingRevision = "a".repeat(40);
    const routing = [
      "50",
      "50",
      routingRevision,
      `${routingRevision} ${CYCLE_3G_B1_FEATURE_REVISION}`,
      feature,
    ] as const;
    expect(isCycle3gb1RoutingClosureTopologyAllowed(...routing)).toBe(true);
    for (const [index, replacement] of [
      [0, "49"],
      [1, "51"],
      [2, CYCLE_3G_B1_FEATURE_REVISION],
      [2, "not-a-commit"],
      [3, `${routingRevision} ${CYCLE_3G_A1_ROUTING_CLOSURE_REVISION}`],
      [
        3,
        `${routingRevision} ${CYCLE_3G_B1_FEATURE_REVISION} ${"d".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...routing];
      changed[index] = replacement;
      expect(
        isCycle3gb1RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3gb1RoutingClosureTopologyAllowed
          >),
        ),
        `cycle3gb1-routing:${index}:${replacement}`,
      ).toBe(false);
    }
    const changedFeature: unknown[] = [...feature];
    changedFeature[2] = "c".repeat(40);
    expect(
      isCycle3gb1RoutingClosureTopologyAllowed(
        "50",
        "50",
        routingRevision,
        `${routingRevision} ${CYCLE_3G_B1_FEATURE_REVISION}`,
        changedFeature as unknown as Parameters<
          typeof isCycle3gb1RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);
  });

  it("pins the exact feature and merge-free routing chain through Cycle 3i-a1", () => {
    const cycle3eb1Feature = [
      "45",
      "45",
      CYCLE_3E_B1_FEATURE_REVISION,
      `${CYCLE_3E_B1_FEATURE_REVISION} ${CYCLE_3E_A_PUBLIC_PROMOTION_REVISION}`,
      cycle3eaPublicPromotionTopology,
    ] as const;
    const cycle3eb1Closure = [
      "46",
      "46",
      CYCLE_3E_B1_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3E_B1_ROUTING_CLOSURE_REVISION} ${CYCLE_3E_B1_FEATURE_REVISION}`,
      cycle3eb1Feature,
    ] as const;
    const cycle3ga1Feature = [
      "47",
      "47",
      CYCLE_3G_A1_FEATURE_REVISION,
      `${CYCLE_3G_A1_FEATURE_REVISION} ${CYCLE_3E_B1_ROUTING_CLOSURE_REVISION}`,
      cycle3eb1Closure,
    ] as const;
    const cycle3ga1Closure = [
      "48",
      "48",
      CYCLE_3G_A1_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3G_A1_ROUTING_CLOSURE_REVISION} ${CYCLE_3G_A1_FEATURE_REVISION}`,
      cycle3ga1Feature,
    ] as const;
    const cycle3gb1Feature = [
      "49",
      "49",
      CYCLE_3G_B1_FEATURE_REVISION,
      `${CYCLE_3G_B1_FEATURE_REVISION} ${CYCLE_3G_A1_ROUTING_CLOSURE_REVISION}`,
      cycle3ga1Closure,
    ] as const;
    const cycle3gb1Closure = [
      "50",
      "50",
      CYCLE_3G_B1_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3G_B1_ROUTING_CLOSURE_REVISION} ${CYCLE_3G_B1_FEATURE_REVISION}`,
      cycle3gb1Feature,
    ] as const;
    expect(isCycle3gb1RoutingClosureTopologyAllowed(...cycle3gb1Closure)).toBe(
      true,
    );

    const feature = [
      "51",
      "51",
      CYCLE_3H_A1_FEATURE_REVISION,
      `${CYCLE_3H_A1_FEATURE_REVISION} ${CYCLE_3G_B1_ROUTING_CLOSURE_REVISION}`,
      cycle3gb1Closure,
    ] as const;
    expect(isCycle3ha1FeatureTopologyAllowed(...feature)).toBe(true);
    for (const [index, replacement] of [
      [0, "50"],
      [1, "52"],
      [2, "f".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A1_FEATURE_REVISION} ${CYCLE_3G_B1_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A1_FEATURE_REVISION} ${CYCLE_3G_B1_ROUTING_CLOSURE_REVISION} ${"e".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...feature];
      changed[index] = replacement;
      expect(
        isCycle3ha1FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha1FeatureTopologyAllowed
          >),
        ),
        `cycle3ha1-feature:${index}:${replacement}`,
      ).toBe(false);
    }
    const changedClosure: unknown[] = [...cycle3gb1Closure];
    changedClosure[2] = "d".repeat(40);
    expect(
      isCycle3ha1FeatureTopologyAllowed(
        "51",
        "51",
        CYCLE_3H_A1_FEATURE_REVISION,
        `${CYCLE_3H_A1_FEATURE_REVISION} ${CYCLE_3G_B1_ROUTING_CLOSURE_REVISION}`,
        changedClosure as unknown as Parameters<
          typeof isCycle3ha1FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const routingRevision = CYCLE_3H_A1_ROUTING_CLOSURE_REVISION;
    const routing = [
      "52",
      "52",
      routingRevision,
      `${routingRevision} ${CYCLE_3H_A1_FEATURE_REVISION}`,
      feature,
    ] as const;
    expect(isCycle3ha1RoutingClosureTopologyAllowed(...routing)).toBe(true);
    for (const [index, replacement] of [
      [0, "51"],
      [1, "53"],
      [2, CYCLE_3H_A1_FEATURE_REVISION],
      [2, "not-a-commit"],
      [3, `${routingRevision} ${CYCLE_3G_B1_ROUTING_CLOSURE_REVISION}`],
      [
        3,
        `${routingRevision} ${CYCLE_3H_A1_FEATURE_REVISION} ${"d".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...routing];
      changed[index] = replacement;
      expect(
        isCycle3ha1RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha1RoutingClosureTopologyAllowed
          >),
        ),
        `cycle3ha1-routing:${index}:${replacement}`,
      ).toBe(false);
    }
    const changedFeature: unknown[] = [...feature];
    changedFeature[2] = "c".repeat(40);
    expect(
      isCycle3ha1RoutingClosureTopologyAllowed(
        "52",
        "52",
        routingRevision,
        `${routingRevision} ${CYCLE_3H_A1_FEATURE_REVISION}`,
        changedFeature as unknown as Parameters<
          typeof isCycle3ha1RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const quarterlyFeature = [
      "53",
      "53",
      CYCLE_3H_A2_FEATURE_REVISION,
      `${CYCLE_3H_A2_FEATURE_REVISION} ${CYCLE_3H_A1_ROUTING_CLOSURE_REVISION}`,
      routing,
    ] as const;
    expect(isCycle3ha2FeatureTopologyAllowed(...quarterlyFeature)).toBe(true);
    for (const [index, replacement] of [
      [0, "52"],
      [1, "54"],
      [2, "f".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A2_FEATURE_REVISION} ${CYCLE_3H_A1_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A2_FEATURE_REVISION} ${CYCLE_3H_A1_ROUTING_CLOSURE_REVISION} ${"e".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...quarterlyFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha2FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha2FeatureTopologyAllowed
          >),
        ),
        `cycle3ha2-feature:${index}:${replacement}`,
      ).toBe(false);
    }
    const changedAnnualClosure: unknown[] = [...routing];
    changedAnnualClosure[2] = "d".repeat(40);
    expect(
      isCycle3ha2FeatureTopologyAllowed(
        "53",
        "53",
        CYCLE_3H_A2_FEATURE_REVISION,
        `${CYCLE_3H_A2_FEATURE_REVISION} ${CYCLE_3H_A1_ROUTING_CLOSURE_REVISION}`,
        changedAnnualClosure as unknown as Parameters<
          typeof isCycle3ha2FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const quarterlyRoutingRevision = "a".repeat(40);
    const quarterlyRouting = [
      "54",
      "54",
      quarterlyRoutingRevision,
      `${quarterlyRoutingRevision} ${CYCLE_3H_A2_FEATURE_REVISION}`,
      quarterlyFeature,
    ] as const;
    expect(isCycle3ha2RoutingClosureTopologyAllowed(...quarterlyRouting)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "53"],
      [1, "55"],
      [2, CYCLE_3H_A2_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${quarterlyRoutingRevision} ${CYCLE_3H_A1_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${quarterlyRoutingRevision} ${CYCLE_3H_A2_FEATURE_REVISION} ${"d".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...quarterlyRouting];
      changed[index] = replacement;
      expect(
        isCycle3ha2RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha2RoutingClosureTopologyAllowed
          >),
        ),
        `cycle3ha2-routing:${index}:${replacement}`,
      ).toBe(false);
    }
    const changedQuarterlyFeature: unknown[] = [...quarterlyFeature];
    changedQuarterlyFeature[2] = "c".repeat(40);
    expect(
      isCycle3ha2RoutingClosureTopologyAllowed(
        "54",
        "54",
        quarterlyRoutingRevision,
        `${quarterlyRoutingRevision} ${CYCLE_3H_A2_FEATURE_REVISION}`,
        changedQuarterlyFeature as unknown as Parameters<
          typeof isCycle3ha2RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedQuarterlyRouting = [
      "54",
      "54",
      CYCLE_3H_A2_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A2_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A2_FEATURE_REVISION}`,
      quarterlyFeature,
    ] as const;
    expect(
      isCycle3ha2RoutingClosureTopologyAllowed(...pinnedQuarterlyRouting),
    ).toBe(true);

    const valuationFeature = [
      "55",
      "55",
      CYCLE_3H_A3_FEATURE_REVISION,
      `${CYCLE_3H_A3_FEATURE_REVISION} ${CYCLE_3H_A2_ROUTING_CLOSURE_REVISION}`,
      pinnedQuarterlyRouting,
    ] as const;
    expect(isCycle3ha3FeatureTopologyAllowed(...valuationFeature)).toBe(true);
    for (const [index, replacement] of [
      [0, "54"],
      [1, "56"],
      [2, "f".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A3_FEATURE_REVISION} ${CYCLE_3H_A2_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A3_FEATURE_REVISION} ${CYCLE_3H_A2_ROUTING_CLOSURE_REVISION} ${"e".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...valuationFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha3FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha3FeatureTopologyAllowed
          >),
        ),
        `cycle3ha3-feature:${index}:${replacement}`,
      ).toBe(false);
    }
    const changedQuarterlyRouting: unknown[] = [...pinnedQuarterlyRouting];
    changedQuarterlyRouting[2] = "d".repeat(40);
    expect(
      isCycle3ha3FeatureTopologyAllowed(
        "55",
        "55",
        CYCLE_3H_A3_FEATURE_REVISION,
        `${CYCLE_3H_A3_FEATURE_REVISION} ${CYCLE_3H_A2_ROUTING_CLOSURE_REVISION}`,
        changedQuarterlyRouting as unknown as Parameters<
          typeof isCycle3ha3FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const valuationRoutingRevision = "b".repeat(40);
    const valuationRouting = [
      "56",
      "56",
      valuationRoutingRevision,
      `${valuationRoutingRevision} ${CYCLE_3H_A3_FEATURE_REVISION}`,
      valuationFeature,
    ] as const;
    expect(isCycle3ha3RoutingClosureTopologyAllowed(...valuationRouting)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "55"],
      [1, "57"],
      [2, CYCLE_3H_A3_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${valuationRoutingRevision} ${CYCLE_3H_A2_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${valuationRoutingRevision} ${CYCLE_3H_A3_FEATURE_REVISION} ${"d".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...valuationRouting];
      changed[index] = replacement;
      expect(
        isCycle3ha3RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha3RoutingClosureTopologyAllowed
          >),
        ),
        `cycle3ha3-routing:${index}:${replacement}`,
      ).toBe(false);
    }
    const changedValuationFeature: unknown[] = [...valuationFeature];
    changedValuationFeature[2] = "c".repeat(40);
    expect(
      isCycle3ha3RoutingClosureTopologyAllowed(
        "56",
        "56",
        valuationRoutingRevision,
        `${valuationRoutingRevision} ${CYCLE_3H_A3_FEATURE_REVISION}`,
        changedValuationFeature as unknown as Parameters<
          typeof isCycle3ha3RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedValuationRouting = [
      "56",
      "56",
      CYCLE_3H_A3_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A3_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A3_FEATURE_REVISION}`,
      valuationFeature,
    ] as const;
    expect(
      isCycle3ha3RoutingClosureTopologyAllowed(...pinnedValuationRouting),
    ).toBe(true);

    const historicalMultipleFeature = [
      "57",
      "57",
      CYCLE_3I_A1_FEATURE_REVISION,
      `${CYCLE_3I_A1_FEATURE_REVISION} ${CYCLE_3H_A3_ROUTING_CLOSURE_REVISION}`,
      pinnedValuationRouting,
    ] as const;
    expect(
      isCycle3ia1FeatureTopologyAllowed(...historicalMultipleFeature),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "56"],
      [1, "58"],
      [2, "f".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3I_A1_FEATURE_REVISION} ${CYCLE_3H_A3_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3I_A1_FEATURE_REVISION} ${CYCLE_3H_A3_ROUTING_CLOSURE_REVISION} ${"e".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...historicalMultipleFeature];
      changed[index] = replacement;
      expect(
        isCycle3ia1FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ia1FeatureTopologyAllowed
          >),
        ),
        `cycle3ia1-feature:${index}:${replacement}`,
      ).toBe(false);
    }
    const changedValuationRouting: unknown[] = [...pinnedValuationRouting];
    changedValuationRouting[2] = "d".repeat(40);
    expect(
      isCycle3ia1FeatureTopologyAllowed(
        "57",
        "57",
        CYCLE_3I_A1_FEATURE_REVISION,
        `${CYCLE_3I_A1_FEATURE_REVISION} ${CYCLE_3H_A3_ROUTING_CLOSURE_REVISION}`,
        changedValuationRouting as unknown as Parameters<
          typeof isCycle3ia1FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const historicalMultipleRoutingRevision = "a".repeat(40);
    const historicalMultipleRouting = [
      "58",
      "58",
      historicalMultipleRoutingRevision,
      `${historicalMultipleRoutingRevision} ${CYCLE_3I_A1_FEATURE_REVISION}`,
      historicalMultipleFeature,
    ] as const;
    expect(
      isCycle3ia1RoutingClosureTopologyAllowed(...historicalMultipleRouting),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "57"],
      [1, "59"],
      [2, CYCLE_3I_A1_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${historicalMultipleRoutingRevision} ${CYCLE_3H_A3_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${historicalMultipleRoutingRevision} ${CYCLE_3I_A1_FEATURE_REVISION} ${"d".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...historicalMultipleRouting];
      changed[index] = replacement;
      expect(
        isCycle3ia1RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ia1RoutingClosureTopologyAllowed
          >),
        ),
        `cycle3ia1-routing:${index}:${replacement}`,
      ).toBe(false);
    }
    const changedHistoricalMultipleFeature: unknown[] = [
      ...historicalMultipleFeature,
    ];
    changedHistoricalMultipleFeature[2] = "c".repeat(40);
    expect(
      isCycle3ia1RoutingClosureTopologyAllowed(
        "58",
        "58",
        historicalMultipleRoutingRevision,
        `${historicalMultipleRoutingRevision} ${CYCLE_3I_A1_FEATURE_REVISION}`,
        changedHistoricalMultipleFeature as unknown as Parameters<
          typeof isCycle3ia1RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedHistoricalMultipleClosure = [
      "58",
      "58",
      CYCLE_3I_A1_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3I_A1_ROUTING_CLOSURE_REVISION} ${CYCLE_3I_A1_FEATURE_REVISION}`,
      historicalMultipleFeature,
    ] as const;
    expect(
      isCycle3ia1RoutingClosureTopologyAllowed(
        ...pinnedHistoricalMultipleClosure,
      ),
    ).toBe(true);

    const dcfFeature = [
      "59",
      "59",
      CYCLE_3I_A2_FEATURE_REVISION,
      `${CYCLE_3I_A2_FEATURE_REVISION} ${CYCLE_3I_A1_ROUTING_CLOSURE_REVISION}`,
      pinnedHistoricalMultipleClosure,
    ] as const;
    expect(isCycle3ia2FeatureTopologyAllowed(...dcfFeature)).toBe(true);
    for (const [index, replacement] of [
      [0, "58"],
      [1, "60"],
      [2, "b".repeat(40)],
      [3, `${CYCLE_3I_A2_FEATURE_REVISION} ${CYCLE_3I_A1_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3I_A2_FEATURE_REVISION} ${CYCLE_3I_A1_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...dcfFeature];
      changed[index] = replacement;
      expect(
        isCycle3ia2FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ia2FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedHistoricalMultipleClosure: unknown[] = [
      ...pinnedHistoricalMultipleClosure,
    ];
    tamperedPinnedHistoricalMultipleClosure[4] =
      changedHistoricalMultipleFeature;
    expect(
      isCycle3ia2FeatureTopologyAllowed(
        "59",
        "59",
        CYCLE_3I_A2_FEATURE_REVISION,
        `${CYCLE_3I_A2_FEATURE_REVISION} ${CYCLE_3I_A1_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedHistoricalMultipleClosure as unknown as Parameters<
          typeof isCycle3ia2FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const dcfClosureRevision = "b".repeat(40);
    const dcfClosure = [
      "60",
      "60",
      dcfClosureRevision,
      `${dcfClosureRevision} ${CYCLE_3I_A2_FEATURE_REVISION}`,
      dcfFeature,
    ] as const;
    expect(isCycle3ia2RoutingClosureTopologyAllowed(...dcfClosure)).toBe(true);
    for (const [index, replacement] of [
      [0, "59"],
      [1, "61"],
      [2, CYCLE_3I_A2_FEATURE_REVISION],
      [2, "not-a-commit"],
      [3, `${dcfClosureRevision} ${CYCLE_3I_A1_ROUTING_CLOSURE_REVISION}`],
      [
        3,
        `${dcfClosureRevision} ${CYCLE_3I_A2_FEATURE_REVISION} ${"d".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...dcfClosure];
      changed[index] = replacement;
      expect(
        isCycle3ia2RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ia2RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedDcfFeature: unknown[] = [...dcfFeature];
    tamperedDcfFeature[4] = tamperedPinnedHistoricalMultipleClosure;
    expect(
      isCycle3ia2RoutingClosureTopologyAllowed(
        "60",
        "60",
        dcfClosureRevision,
        `${dcfClosureRevision} ${CYCLE_3I_A2_FEATURE_REVISION}`,
        tamperedDcfFeature as unknown as Parameters<
          typeof isCycle3ia2RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedDcfClosure = [
      "60",
      "60",
      CYCLE_3I_A2_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3I_A2_ROUTING_CLOSURE_REVISION} ${CYCLE_3I_A2_FEATURE_REVISION}`,
      dcfFeature,
    ] as const;
    expect(isCycle3ia2RoutingClosureTopologyAllowed(...pinnedDcfClosure)).toBe(
      true,
    );

    const financialQualityFeature = [
      "61",
      "61",
      CYCLE_3J_A1_FEATURE_REVISION,
      `${CYCLE_3J_A1_FEATURE_REVISION} ${CYCLE_3I_A2_ROUTING_CLOSURE_REVISION}`,
      pinnedDcfClosure,
    ] as const;
    expect(isCycle3ja1FeatureTopologyAllowed(...financialQualityFeature)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "60"],
      [1, "62"],
      [2, "c".repeat(40)],
      [3, `${CYCLE_3J_A1_FEATURE_REVISION} ${CYCLE_3I_A2_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3J_A1_FEATURE_REVISION} ${CYCLE_3I_A2_ROUTING_CLOSURE_REVISION} ${"d".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...financialQualityFeature];
      changed[index] = replacement;
      expect(
        isCycle3ja1FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ja1FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedDcfClosure: unknown[] = [...pinnedDcfClosure];
    tamperedPinnedDcfClosure[4] = tamperedDcfFeature;
    expect(
      isCycle3ja1FeatureTopologyAllowed(
        "61",
        "61",
        CYCLE_3J_A1_FEATURE_REVISION,
        `${CYCLE_3J_A1_FEATURE_REVISION} ${CYCLE_3I_A2_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedDcfClosure as unknown as Parameters<
          typeof isCycle3ja1FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const financialQualityClosureRevision = "c".repeat(40);
    const financialQualityClosure = [
      "62",
      "62",
      financialQualityClosureRevision,
      `${financialQualityClosureRevision} ${CYCLE_3J_A1_FEATURE_REVISION}`,
      financialQualityFeature,
    ] as const;
    expect(
      isCycle3ja1RoutingClosureTopologyAllowed(...financialQualityClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "61"],
      [1, "63"],
      [2, CYCLE_3J_A1_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${financialQualityClosureRevision} ${CYCLE_3I_A2_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${financialQualityClosureRevision} ${CYCLE_3J_A1_FEATURE_REVISION} ${"e".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...financialQualityClosure];
      changed[index] = replacement;
      expect(
        isCycle3ja1RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ja1RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedFinancialQualityFeature: unknown[] = [
      ...financialQualityFeature,
    ];
    tamperedFinancialQualityFeature[4] = tamperedPinnedDcfClosure;
    expect(
      isCycle3ja1RoutingClosureTopologyAllowed(
        "62",
        "62",
        financialQualityClosureRevision,
        `${financialQualityClosureRevision} ${CYCLE_3J_A1_FEATURE_REVISION}`,
        tamperedFinancialQualityFeature as unknown as Parameters<
          typeof isCycle3ja1RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedFinancialQualityClosure = [
      "62",
      "62",
      CYCLE_3J_A1_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3J_A1_ROUTING_CLOSURE_REVISION} ${CYCLE_3J_A1_FEATURE_REVISION}`,
      financialQualityFeature,
    ] as const;
    expect(
      isCycle3ja1RoutingClosureTopologyAllowed(
        ...pinnedFinancialQualityClosure,
      ),
    ).toBe(true);

    const manualPeerFeature = [
      "63",
      "63",
      CYCLE_3J_A2_FEATURE_REVISION,
      `${CYCLE_3J_A2_FEATURE_REVISION} ${CYCLE_3J_A1_ROUTING_CLOSURE_REVISION}`,
      pinnedFinancialQualityClosure,
    ] as const;
    expect(isCycle3ja2FeatureTopologyAllowed(...manualPeerFeature)).toBe(true);
    expect(
      isCycle3ja2FeatureTopologyAllowed(
        "62",
        "63",
        CYCLE_3J_A2_FEATURE_REVISION,
        `${CYCLE_3J_A2_FEATURE_REVISION} ${CYCLE_3J_A1_ROUTING_CLOSURE_REVISION}`,
        pinnedFinancialQualityClosure,
      ),
    ).toBe(false);
    const tamperedPinnedFinancialQualityClosure: unknown[] = [
      ...pinnedFinancialQualityClosure,
    ];
    tamperedPinnedFinancialQualityClosure[4] = tamperedFinancialQualityFeature;
    expect(
      isCycle3ja2FeatureTopologyAllowed(
        "63",
        "63",
        CYCLE_3J_A2_FEATURE_REVISION,
        `${CYCLE_3J_A2_FEATURE_REVISION} ${CYCLE_3J_A1_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedFinancialQualityClosure as unknown as Parameters<
          typeof isCycle3ja2FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const manualPeerClosureRevision = "d".repeat(40);
    const manualPeerClosure = [
      "64",
      "64",
      manualPeerClosureRevision,
      `${manualPeerClosureRevision} ${CYCLE_3J_A2_FEATURE_REVISION}`,
      manualPeerFeature,
    ] as const;
    expect(isCycle3ja2RoutingClosureTopologyAllowed(...manualPeerClosure)).toBe(
      true,
    );
    expect(
      isCycle3ja2RoutingClosureTopologyAllowed(
        "64",
        "64",
        CYCLE_3J_A2_FEATURE_REVISION,
        `${CYCLE_3J_A2_FEATURE_REVISION} ${CYCLE_3J_A2_FEATURE_REVISION}`,
        manualPeerFeature,
      ),
    ).toBe(false);
    const tamperedManualPeerFeature: unknown[] = [...manualPeerFeature];
    tamperedManualPeerFeature[4] = tamperedPinnedFinancialQualityClosure;
    expect(
      isCycle3ja2RoutingClosureTopologyAllowed(
        "64",
        "64",
        manualPeerClosureRevision,
        `${manualPeerClosureRevision} ${CYCLE_3J_A2_FEATURE_REVISION}`,
        tamperedManualPeerFeature as unknown as Parameters<
          typeof isCycle3ja2RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedManualPeerClosure = [
      "64",
      "64",
      CYCLE_3J_A2_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3J_A2_ROUTING_CLOSURE_REVISION} ${CYCLE_3J_A2_FEATURE_REVISION}`,
      manualPeerFeature,
    ] as const;
    expect(
      isCycle3ja2RoutingClosureTopologyAllowed(...pinnedManualPeerClosure),
    ).toBe(true);
    const catalogScreenerFeature = [
      "65",
      "65",
      CYCLE_3K_A1_FEATURE_REVISION,
      `${CYCLE_3K_A1_FEATURE_REVISION} ${CYCLE_3J_A2_ROUTING_CLOSURE_REVISION}`,
      pinnedManualPeerClosure,
    ] as const;
    expect(isCycle3ka1FeatureTopologyAllowed(...catalogScreenerFeature)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "64"],
      [1, "66"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3K_A1_FEATURE_REVISION} ${CYCLE_3J_A2_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3K_A1_FEATURE_REVISION} ${CYCLE_3J_A2_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...catalogScreenerFeature];
      changed[index] = replacement;
      expect(
        isCycle3ka1FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ka1FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedManualPeerClosure: unknown[] = [
      ...pinnedManualPeerClosure,
    ];
    tamperedPinnedManualPeerClosure[4] = tamperedManualPeerFeature;
    expect(
      isCycle3ka1FeatureTopologyAllowed(
        "65",
        "65",
        CYCLE_3K_A1_FEATURE_REVISION,
        `${CYCLE_3K_A1_FEATURE_REVISION} ${CYCLE_3J_A2_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedManualPeerClosure as unknown as Parameters<
          typeof isCycle3ka1FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const catalogScreenerClosureRevision = "e".repeat(40);
    const catalogScreenerClosure = [
      "66",
      "66",
      catalogScreenerClosureRevision,
      `${catalogScreenerClosureRevision} ${CYCLE_3K_A1_FEATURE_REVISION}`,
      catalogScreenerFeature,
    ] as const;
    expect(
      isCycle3ka1RoutingClosureTopologyAllowed(...catalogScreenerClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "65"],
      [1, "67"],
      [2, CYCLE_3K_A1_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${catalogScreenerClosureRevision} ${CYCLE_3J_A2_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${catalogScreenerClosureRevision} ${CYCLE_3K_A1_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...catalogScreenerClosure];
      changed[index] = replacement;
      expect(
        isCycle3ka1RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ka1RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedCatalogScreenerFeature: unknown[] = [
      ...catalogScreenerFeature,
    ];
    tamperedCatalogScreenerFeature[4] = tamperedPinnedManualPeerClosure;
    expect(
      isCycle3ka1RoutingClosureTopologyAllowed(
        "66",
        "66",
        catalogScreenerClosureRevision,
        `${catalogScreenerClosureRevision} ${CYCLE_3K_A1_FEATURE_REVISION}`,
        tamperedCatalogScreenerFeature as unknown as Parameters<
          typeof isCycle3ka1RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedCatalogScreenerClosure = [
      "66",
      "66",
      CYCLE_3K_A1_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3K_A1_ROUTING_CLOSURE_REVISION} ${CYCLE_3K_A1_FEATURE_REVISION}`,
      catalogScreenerFeature,
    ] as const;
    expect(
      isCycle3ka1RoutingClosureTopologyAllowed(...pinnedCatalogScreenerClosure),
    ).toBe(true);
    const financialScreenerFeature = [
      "67",
      "67",
      CYCLE_3K_A2_FEATURE_REVISION,
      `${CYCLE_3K_A2_FEATURE_REVISION} ${CYCLE_3K_A1_ROUTING_CLOSURE_REVISION}`,
      pinnedCatalogScreenerClosure,
    ] as const;
    expect(isCycle3ka2FeatureTopologyAllowed(...financialScreenerFeature)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "66"],
      [1, "68"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3K_A2_FEATURE_REVISION} ${CYCLE_3K_A1_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3K_A2_FEATURE_REVISION} ${CYCLE_3K_A1_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...financialScreenerFeature];
      changed[index] = replacement;
      expect(
        isCycle3ka2FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ka2FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedCatalogScreenerClosure: unknown[] = [
      ...pinnedCatalogScreenerClosure,
    ];
    tamperedPinnedCatalogScreenerClosure[4] = tamperedCatalogScreenerFeature;
    expect(
      isCycle3ka2FeatureTopologyAllowed(
        "67",
        "67",
        CYCLE_3K_A2_FEATURE_REVISION,
        `${CYCLE_3K_A2_FEATURE_REVISION} ${CYCLE_3K_A1_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedCatalogScreenerClosure as unknown as Parameters<
          typeof isCycle3ka2FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const financialScreenerClosureRevision = "e".repeat(40);
    const financialScreenerClosure = [
      "68",
      "68",
      financialScreenerClosureRevision,
      `${financialScreenerClosureRevision} ${CYCLE_3K_A2_FEATURE_REVISION}`,
      financialScreenerFeature,
    ] as const;
    expect(
      isCycle3ka2RoutingClosureTopologyAllowed(...financialScreenerClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "67"],
      [1, "69"],
      [2, CYCLE_3K_A2_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${financialScreenerClosureRevision} ${CYCLE_3K_A1_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${financialScreenerClosureRevision} ${CYCLE_3K_A2_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...financialScreenerClosure];
      changed[index] = replacement;
      expect(
        isCycle3ka2RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ka2RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedFinancialScreenerFeature: unknown[] = [
      ...financialScreenerFeature,
    ];
    tamperedFinancialScreenerFeature[4] = tamperedPinnedCatalogScreenerClosure;
    expect(
      isCycle3ka2RoutingClosureTopologyAllowed(
        "68",
        "68",
        financialScreenerClosureRevision,
        `${financialScreenerClosureRevision} ${CYCLE_3K_A2_FEATURE_REVISION}`,
        tamperedFinancialScreenerFeature as unknown as Parameters<
          typeof isCycle3ka2RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedFinancialScreenerClosure = [
      "68",
      "68",
      CYCLE_3K_A2_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3K_A2_ROUTING_CLOSURE_REVISION} ${CYCLE_3K_A2_FEATURE_REVISION}`,
      financialScreenerFeature,
    ] as const;
    expect(
      isCycle3ka2RoutingClosureTopologyAllowed(
        ...pinnedFinancialScreenerClosure,
      ),
    ).toBe(true);
    const watchlistFilingsFeature = [
      "69",
      "69",
      CYCLE_3L_A1_FEATURE_REVISION,
      `${CYCLE_3L_A1_FEATURE_REVISION} ${CYCLE_3K_A2_ROUTING_CLOSURE_REVISION}`,
      pinnedFinancialScreenerClosure,
    ] as const;
    expect(isCycle3la1FeatureTopologyAllowed(...watchlistFilingsFeature)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "68"],
      [1, "70"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3L_A1_FEATURE_REVISION} ${CYCLE_3K_A2_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3L_A1_FEATURE_REVISION} ${CYCLE_3K_A2_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...watchlistFilingsFeature];
      changed[index] = replacement;
      expect(
        isCycle3la1FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3la1FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedFinancialScreenerClosure: unknown[] = [
      ...pinnedFinancialScreenerClosure,
    ];
    tamperedPinnedFinancialScreenerClosure[4] =
      tamperedFinancialScreenerFeature;
    expect(
      isCycle3la1FeatureTopologyAllowed(
        "69",
        "69",
        CYCLE_3L_A1_FEATURE_REVISION,
        `${CYCLE_3L_A1_FEATURE_REVISION} ${CYCLE_3K_A2_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedFinancialScreenerClosure as unknown as Parameters<
          typeof isCycle3la1FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const watchlistFilingsClosureRevision = "e".repeat(40);
    const watchlistFilingsClosure = [
      "70",
      "70",
      watchlistFilingsClosureRevision,
      `${watchlistFilingsClosureRevision} ${CYCLE_3L_A1_FEATURE_REVISION}`,
      watchlistFilingsFeature,
    ] as const;
    expect(
      isCycle3la1RoutingClosureTopologyAllowed(...watchlistFilingsClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "69"],
      [1, "71"],
      [2, CYCLE_3L_A1_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${watchlistFilingsClosureRevision} ${CYCLE_3K_A2_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${watchlistFilingsClosureRevision} ${CYCLE_3L_A1_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...watchlistFilingsClosure];
      changed[index] = replacement;
      expect(
        isCycle3la1RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3la1RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedWatchlistFilingsFeature: unknown[] = [
      ...watchlistFilingsFeature,
    ];
    tamperedWatchlistFilingsFeature[4] = tamperedPinnedFinancialScreenerClosure;
    expect(
      isCycle3la1RoutingClosureTopologyAllowed(
        "70",
        "70",
        watchlistFilingsClosureRevision,
        `${watchlistFilingsClosureRevision} ${CYCLE_3L_A1_FEATURE_REVISION}`,
        tamperedWatchlistFilingsFeature as unknown as Parameters<
          typeof isCycle3la1RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedWatchlistFilingsClosure = [
      "70",
      "70",
      CYCLE_3L_A1_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3L_A1_ROUTING_CLOSURE_REVISION} ${CYCLE_3L_A1_FEATURE_REVISION}`,
      watchlistFilingsFeature,
    ] as const;
    expect(
      isCycle3la1RoutingClosureTopologyAllowed(
        ...pinnedWatchlistFilingsClosure,
      ),
    ).toBe(true);
    const portfolioFeature = [
      "71",
      "71",
      CYCLE_3M_A1_FEATURE_REVISION,
      `${CYCLE_3M_A1_FEATURE_REVISION} ${CYCLE_3L_A1_ROUTING_CLOSURE_REVISION}`,
      pinnedWatchlistFilingsClosure,
    ] as const;
    expect(isCycle3ma1FeatureTopologyAllowed(...portfolioFeature)).toBe(true);
    for (const [index, replacement] of [
      [0, "70"],
      [1, "72"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3M_A1_FEATURE_REVISION} ${CYCLE_3L_A1_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3M_A1_FEATURE_REVISION} ${CYCLE_3L_A1_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...portfolioFeature];
      changed[index] = replacement;
      expect(
        isCycle3ma1FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma1FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedWatchlistFilingsClosure: unknown[] = [
      ...pinnedWatchlistFilingsClosure,
    ];
    tamperedPinnedWatchlistFilingsClosure[4] = tamperedWatchlistFilingsFeature;
    expect(
      isCycle3ma1FeatureTopologyAllowed(
        "71",
        "71",
        CYCLE_3M_A1_FEATURE_REVISION,
        `${CYCLE_3M_A1_FEATURE_REVISION} ${CYCLE_3L_A1_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedWatchlistFilingsClosure as unknown as Parameters<
          typeof isCycle3ma1FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const portfolioClosureRevision = "e".repeat(40);
    const portfolioClosure = [
      "72",
      "72",
      portfolioClosureRevision,
      `${portfolioClosureRevision} ${CYCLE_3M_A1_FEATURE_REVISION}`,
      portfolioFeature,
    ] as const;
    expect(isCycle3ma1RoutingClosureTopologyAllowed(...portfolioClosure)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "71"],
      [1, "73"],
      [2, CYCLE_3M_A1_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${portfolioClosureRevision} ${CYCLE_3L_A1_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${portfolioClosureRevision} ${CYCLE_3M_A1_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...portfolioClosure];
      changed[index] = replacement;
      expect(
        isCycle3ma1RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma1RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPortfolioFeature: unknown[] = [...portfolioFeature];
    tamperedPortfolioFeature[4] = tamperedPinnedWatchlistFilingsClosure;
    expect(
      isCycle3ma1RoutingClosureTopologyAllowed(
        "72",
        "72",
        portfolioClosureRevision,
        `${portfolioClosureRevision} ${CYCLE_3M_A1_FEATURE_REVISION}`,
        tamperedPortfolioFeature as unknown as Parameters<
          typeof isCycle3ma1RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedPortfolioClosure = [
      "72",
      "72",
      CYCLE_3M_A1_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3M_A1_ROUTING_CLOSURE_REVISION} ${CYCLE_3M_A1_FEATURE_REVISION}`,
      portfolioFeature,
    ] as const;
    expect(
      isCycle3ma1RoutingClosureTopologyAllowed(...pinnedPortfolioClosure),
    ).toBe(true);
    const ledgerFeature = [
      "73",
      "73",
      CYCLE_3M_A2_FEATURE_REVISION,
      `${CYCLE_3M_A2_FEATURE_REVISION} ${CYCLE_3M_A1_ROUTING_CLOSURE_REVISION}`,
      pinnedPortfolioClosure,
    ] as const;
    expect(isCycle3ma2FeatureTopologyAllowed(...ledgerFeature)).toBe(true);
    for (const [index, replacement] of [
      [0, "72"],
      [1, "74"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3M_A2_FEATURE_REVISION} ${CYCLE_3M_A1_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3M_A2_FEATURE_REVISION} ${CYCLE_3M_A1_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...ledgerFeature];
      changed[index] = replacement;
      expect(
        isCycle3ma2FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma2FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedPortfolioClosure: unknown[] = [
      ...pinnedPortfolioClosure,
    ];
    tamperedPinnedPortfolioClosure[4] = tamperedPortfolioFeature;
    expect(
      isCycle3ma2FeatureTopologyAllowed(
        "73",
        "73",
        CYCLE_3M_A2_FEATURE_REVISION,
        `${CYCLE_3M_A2_FEATURE_REVISION} ${CYCLE_3M_A1_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedPortfolioClosure as unknown as Parameters<
          typeof isCycle3ma2FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const ledgerClosureRevision = "e".repeat(40);
    const ledgerClosure = [
      "74",
      "74",
      ledgerClosureRevision,
      `${ledgerClosureRevision} ${CYCLE_3M_A2_FEATURE_REVISION}`,
      ledgerFeature,
    ] as const;
    expect(isCycle3ma2RoutingClosureTopologyAllowed(...ledgerClosure)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "73"],
      [1, "75"],
      [2, CYCLE_3M_A2_FEATURE_REVISION],
      [2, "not-a-commit"],
      [3, `${ledgerClosureRevision} ${CYCLE_3M_A1_ROUTING_CLOSURE_REVISION}`],
      [
        3,
        `${ledgerClosureRevision} ${CYCLE_3M_A2_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...ledgerClosure];
      changed[index] = replacement;
      expect(
        isCycle3ma2RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma2RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedLedgerFeature: unknown[] = [...ledgerFeature];
    tamperedLedgerFeature[4] = tamperedPinnedPortfolioClosure;
    expect(
      isCycle3ma2RoutingClosureTopologyAllowed(
        "74",
        "74",
        ledgerClosureRevision,
        `${ledgerClosureRevision} ${CYCLE_3M_A2_FEATURE_REVISION}`,
        tamperedLedgerFeature as unknown as Parameters<
          typeof isCycle3ma2RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedLedgerClosure = [
      "74",
      "74",
      CYCLE_3M_A2_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3M_A2_ROUTING_CLOSURE_REVISION} ${CYCLE_3M_A2_FEATURE_REVISION}`,
      ledgerFeature,
    ] as const;
    expect(
      isCycle3ma2RoutingClosureTopologyAllowed(...pinnedLedgerClosure),
    ).toBe(true);
    const splitFeature = [
      "75",
      "75",
      CYCLE_3M_A3_FEATURE_REVISION,
      `${CYCLE_3M_A3_FEATURE_REVISION} ${CYCLE_3M_A2_ROUTING_CLOSURE_REVISION}`,
      pinnedLedgerClosure,
    ] as const;
    expect(isCycle3ma3FeatureTopologyAllowed(...splitFeature)).toBe(true);
    for (const [index, replacement] of [
      [0, "74"],
      [1, "76"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3M_A3_FEATURE_REVISION} ${CYCLE_3M_A2_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3M_A3_FEATURE_REVISION} ${CYCLE_3M_A2_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...splitFeature];
      changed[index] = replacement;
      expect(
        isCycle3ma3FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma3FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedLedgerClosure: unknown[] = [...pinnedLedgerClosure];
    tamperedPinnedLedgerClosure[4] = tamperedLedgerFeature;
    expect(
      isCycle3ma3FeatureTopologyAllowed(
        "75",
        "75",
        CYCLE_3M_A3_FEATURE_REVISION,
        `${CYCLE_3M_A3_FEATURE_REVISION} ${CYCLE_3M_A2_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedLedgerClosure as unknown as Parameters<
          typeof isCycle3ma3FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const splitClosureRevision = "e".repeat(40);
    const splitClosure = [
      "76",
      "76",
      splitClosureRevision,
      `${splitClosureRevision} ${CYCLE_3M_A3_FEATURE_REVISION}`,
      splitFeature,
    ] as const;
    expect(isCycle3ma3RoutingClosureTopologyAllowed(...splitClosure)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "75"],
      [1, "77"],
      [2, CYCLE_3M_A3_FEATURE_REVISION],
      [2, "not-a-commit"],
      [3, `${splitClosureRevision} ${CYCLE_3M_A2_ROUTING_CLOSURE_REVISION}`],
      [
        3,
        `${splitClosureRevision} ${CYCLE_3M_A3_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...splitClosure];
      changed[index] = replacement;
      expect(
        isCycle3ma3RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma3RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedSplitFeature: unknown[] = [...splitFeature];
    tamperedSplitFeature[4] = tamperedPinnedLedgerClosure;
    expect(
      isCycle3ma3RoutingClosureTopologyAllowed(
        "76",
        "76",
        splitClosureRevision,
        `${splitClosureRevision} ${CYCLE_3M_A3_FEATURE_REVISION}`,
        tamperedSplitFeature as unknown as Parameters<
          typeof isCycle3ma3RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedSplitClosure = [
      "76",
      "76",
      CYCLE_3M_A3_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3M_A3_ROUTING_CLOSURE_REVISION} ${CYCLE_3M_A3_FEATURE_REVISION}`,
      splitFeature,
    ] as const;
    expect(
      isCycle3ma3RoutingClosureTopologyAllowed(...pinnedSplitClosure),
    ).toBe(true);
    const portfolioValuationFeature = [
      "77",
      "77",
      CYCLE_3M_A4_FEATURE_REVISION,
      `${CYCLE_3M_A4_FEATURE_REVISION} ${CYCLE_3M_A3_ROUTING_CLOSURE_REVISION}`,
      pinnedSplitClosure,
    ] as const;
    expect(
      isCycle3ma4FeatureTopologyAllowed(...portfolioValuationFeature),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "76"],
      [1, "78"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3M_A4_FEATURE_REVISION} ${CYCLE_3M_A3_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3M_A4_FEATURE_REVISION} ${CYCLE_3M_A3_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...portfolioValuationFeature];
      changed[index] = replacement;
      expect(
        isCycle3ma4FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma4FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedSplitClosure: unknown[] = [...pinnedSplitClosure];
    tamperedPinnedSplitClosure[4] = tamperedSplitFeature;
    expect(
      isCycle3ma4FeatureTopologyAllowed(
        "77",
        "77",
        CYCLE_3M_A4_FEATURE_REVISION,
        `${CYCLE_3M_A4_FEATURE_REVISION} ${CYCLE_3M_A3_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedSplitClosure as unknown as Parameters<
          typeof isCycle3ma4FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const portfolioValuationClosureRevision = "e".repeat(40);
    const portfolioValuationClosure = [
      "78",
      "78",
      portfolioValuationClosureRevision,
      `${portfolioValuationClosureRevision} ${CYCLE_3M_A4_FEATURE_REVISION}`,
      portfolioValuationFeature,
    ] as const;
    expect(
      isCycle3ma4RoutingClosureTopologyAllowed(...portfolioValuationClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "77"],
      [1, "79"],
      [2, CYCLE_3M_A4_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${portfolioValuationClosureRevision} ${CYCLE_3M_A3_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${portfolioValuationClosureRevision} ${CYCLE_3M_A4_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...portfolioValuationClosure];
      changed[index] = replacement;
      expect(
        isCycle3ma4RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma4RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPortfolioValuationFeature: unknown[] = [
      ...portfolioValuationFeature,
    ];
    tamperedPortfolioValuationFeature[4] = tamperedPinnedSplitClosure;
    expect(
      isCycle3ma4RoutingClosureTopologyAllowed(
        "78",
        "78",
        portfolioValuationClosureRevision,
        `${portfolioValuationClosureRevision} ${CYCLE_3M_A4_FEATURE_REVISION}`,
        tamperedPortfolioValuationFeature as unknown as Parameters<
          typeof isCycle3ma4RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedPortfolioValuationClosure = [
      "78",
      "78",
      CYCLE_3M_A4_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3M_A4_ROUTING_CLOSURE_REVISION} ${CYCLE_3M_A4_FEATURE_REVISION}`,
      portfolioValuationFeature,
    ] as const;
    expect(
      isCycle3ma4RoutingClosureTopologyAllowed(
        ...pinnedPortfolioValuationClosure,
      ),
    ).toBe(true);
    const endpointReturnFeature = [
      "79",
      "79",
      CYCLE_3M_A5_FEATURE_REVISION,
      `${CYCLE_3M_A5_FEATURE_REVISION} ${CYCLE_3M_A4_ROUTING_CLOSURE_REVISION}`,
      pinnedPortfolioValuationClosure,
    ] as const;
    expect(isCycle3ma5FeatureTopologyAllowed(...endpointReturnFeature)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "78"],
      [1, "80"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3M_A5_FEATURE_REVISION} ${CYCLE_3M_A4_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3M_A5_FEATURE_REVISION} ${CYCLE_3M_A4_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...endpointReturnFeature];
      changed[index] = replacement;
      expect(
        isCycle3ma5FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma5FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedPortfolioValuationClosure: unknown[] = [
      ...pinnedPortfolioValuationClosure,
    ];
    tamperedPinnedPortfolioValuationClosure[4] = tamperedSplitFeature;
    expect(
      isCycle3ma5FeatureTopologyAllowed(
        "79",
        "79",
        CYCLE_3M_A5_FEATURE_REVISION,
        `${CYCLE_3M_A5_FEATURE_REVISION} ${CYCLE_3M_A4_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedPortfolioValuationClosure as unknown as Parameters<
          typeof isCycle3ma5FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const endpointReturnClosureRevision = "e".repeat(40);
    const endpointReturnClosure = [
      "80",
      "80",
      endpointReturnClosureRevision,
      `${endpointReturnClosureRevision} ${CYCLE_3M_A5_FEATURE_REVISION}`,
      endpointReturnFeature,
    ] as const;
    expect(
      isCycle3ma5RoutingClosureTopologyAllowed(...endpointReturnClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "79"],
      [1, "81"],
      [2, CYCLE_3M_A5_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${endpointReturnClosureRevision} ${CYCLE_3M_A4_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${endpointReturnClosureRevision} ${CYCLE_3M_A5_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...endpointReturnClosure];
      changed[index] = replacement;
      expect(
        isCycle3ma5RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma5RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedEndpointReturnFeature: unknown[] = [...endpointReturnFeature];
    tamperedEndpointReturnFeature[4] = tamperedPinnedPortfolioValuationClosure;
    expect(
      isCycle3ma5RoutingClosureTopologyAllowed(
        "80",
        "80",
        endpointReturnClosureRevision,
        `${endpointReturnClosureRevision} ${CYCLE_3M_A5_FEATURE_REVISION}`,
        tamperedEndpointReturnFeature as unknown as Parameters<
          typeof isCycle3ma5RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedEndpointReturnClosure = [
      "80",
      "80",
      CYCLE_3M_A5_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3M_A5_ROUTING_CLOSURE_REVISION} ${CYCLE_3M_A5_FEATURE_REVISION}`,
      endpointReturnFeature,
    ] as const;
    expect(
      isCycle3ma5RoutingClosureTopologyAllowed(...pinnedEndpointReturnClosure),
    ).toBe(true);
    const modifiedDietzFeature = [
      "81",
      "81",
      CYCLE_3M_A6_FEATURE_REVISION,
      `${CYCLE_3M_A6_FEATURE_REVISION} ${CYCLE_3M_A5_ROUTING_CLOSURE_REVISION}`,
      pinnedEndpointReturnClosure,
    ] as const;
    expect(isCycle3ma6FeatureTopologyAllowed(...modifiedDietzFeature)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "80"],
      [1, "82"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3M_A6_FEATURE_REVISION} ${CYCLE_3M_A5_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3M_A6_FEATURE_REVISION} ${CYCLE_3M_A5_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...modifiedDietzFeature];
      changed[index] = replacement;
      expect(
        isCycle3ma6FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma6FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedEndpointReturnClosure: unknown[] = [
      ...pinnedEndpointReturnClosure,
    ];
    tamperedPinnedEndpointReturnClosure[4] = tamperedEndpointReturnFeature;
    expect(
      isCycle3ma6FeatureTopologyAllowed(
        "81",
        "81",
        CYCLE_3M_A6_FEATURE_REVISION,
        `${CYCLE_3M_A6_FEATURE_REVISION} ${CYCLE_3M_A5_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedEndpointReturnClosure as unknown as Parameters<
          typeof isCycle3ma6FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const modifiedDietzClosureRevision = "e".repeat(40);
    const modifiedDietzClosure = [
      "82",
      "82",
      modifiedDietzClosureRevision,
      `${modifiedDietzClosureRevision} ${CYCLE_3M_A6_FEATURE_REVISION}`,
      modifiedDietzFeature,
    ] as const;
    expect(
      isCycle3ma6RoutingClosureTopologyAllowed(...modifiedDietzClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "81"],
      [1, "83"],
      [2, CYCLE_3M_A6_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${modifiedDietzClosureRevision} ${CYCLE_3M_A5_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${modifiedDietzClosureRevision} ${CYCLE_3M_A6_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...modifiedDietzClosure];
      changed[index] = replacement;
      expect(
        isCycle3ma6RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma6RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedModifiedDietzFeature: unknown[] = [...modifiedDietzFeature];
    tamperedModifiedDietzFeature[4] = tamperedPinnedEndpointReturnClosure;
    expect(
      isCycle3ma6RoutingClosureTopologyAllowed(
        "82",
        "82",
        modifiedDietzClosureRevision,
        `${modifiedDietzClosureRevision} ${CYCLE_3M_A6_FEATURE_REVISION}`,
        tamperedModifiedDietzFeature as unknown as Parameters<
          typeof isCycle3ma6RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedModifiedDietzClosure = [
      "82",
      "82",
      CYCLE_3M_A6_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3M_A6_ROUTING_CLOSURE_REVISION} ${CYCLE_3M_A6_FEATURE_REVISION}`,
      modifiedDietzFeature,
    ] as const;
    expect(
      isCycle3ma6RoutingClosureTopologyAllowed(...pinnedModifiedDietzClosure),
    ).toBe(true);
    const linkedReturnFeature = [
      "83",
      "83",
      CYCLE_3M_A7_FEATURE_REVISION,
      `${CYCLE_3M_A7_FEATURE_REVISION} ${CYCLE_3M_A6_ROUTING_CLOSURE_REVISION}`,
      pinnedModifiedDietzClosure,
    ] as const;
    expect(isCycle3ma7FeatureTopologyAllowed(...linkedReturnFeature)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "82"],
      [1, "84"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3M_A7_FEATURE_REVISION} ${CYCLE_3M_A6_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3M_A7_FEATURE_REVISION} ${CYCLE_3M_A6_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...linkedReturnFeature];
      changed[index] = replacement;
      expect(
        isCycle3ma7FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma7FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedModifiedDietzClosure: unknown[] = [
      ...pinnedModifiedDietzClosure,
    ];
    tamperedPinnedModifiedDietzClosure[4] = tamperedModifiedDietzFeature;
    expect(
      isCycle3ma7FeatureTopologyAllowed(
        "83",
        "83",
        CYCLE_3M_A7_FEATURE_REVISION,
        `${CYCLE_3M_A7_FEATURE_REVISION} ${CYCLE_3M_A6_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedModifiedDietzClosure as unknown as Parameters<
          typeof isCycle3ma7FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const linkedReturnClosureRevision = "e".repeat(40);
    const linkedReturnClosure = [
      "84",
      "84",
      linkedReturnClosureRevision,
      `${linkedReturnClosureRevision} ${CYCLE_3M_A7_FEATURE_REVISION}`,
      linkedReturnFeature,
    ] as const;
    expect(
      isCycle3ma7RoutingClosureTopologyAllowed(...linkedReturnClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "83"],
      [1, "85"],
      [2, CYCLE_3M_A7_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${linkedReturnClosureRevision} ${CYCLE_3M_A6_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${linkedReturnClosureRevision} ${CYCLE_3M_A7_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...linkedReturnClosure];
      changed[index] = replacement;
      expect(
        isCycle3ma7RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ma7RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedLinkedReturnFeature: unknown[] = [...linkedReturnFeature];
    tamperedLinkedReturnFeature[4] = tamperedPinnedModifiedDietzClosure;
    expect(
      isCycle3ma7RoutingClosureTopologyAllowed(
        "84",
        "84",
        linkedReturnClosureRevision,
        `${linkedReturnClosureRevision} ${CYCLE_3M_A7_FEATURE_REVISION}`,
        tamperedLinkedReturnFeature as unknown as Parameters<
          typeof isCycle3ma7RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedLinkedReturnClosure = [
      "84",
      "84",
      CYCLE_3M_A7_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3M_A7_ROUTING_CLOSURE_REVISION} ${CYCLE_3M_A7_FEATURE_REVISION}`,
      linkedReturnFeature,
    ] as const;
    expect(
      isCycle3ma7RoutingClosureTopologyAllowed(...pinnedLinkedReturnClosure),
    ).toBe(true);
    const quarterlyCompatibilityFeature = [
      "85",
      "85",
      CYCLE_3H_A4_FEATURE_REVISION,
      `${CYCLE_3H_A4_FEATURE_REVISION} ${CYCLE_3M_A7_ROUTING_CLOSURE_REVISION}`,
      pinnedLinkedReturnClosure,
    ] as const;
    expect(
      isCycle3ha4FeatureTopologyAllowed(...quarterlyCompatibilityFeature),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "84"],
      [1, "86"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A4_FEATURE_REVISION} ${CYCLE_3M_A7_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A4_FEATURE_REVISION} ${CYCLE_3M_A7_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...quarterlyCompatibilityFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha4FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha4FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedLinkedReturnClosure: unknown[] = [
      ...pinnedLinkedReturnClosure,
    ];
    tamperedPinnedLinkedReturnClosure[4] = tamperedLinkedReturnFeature;
    expect(
      isCycle3ha4FeatureTopologyAllowed(
        "85",
        "85",
        CYCLE_3H_A4_FEATURE_REVISION,
        `${CYCLE_3H_A4_FEATURE_REVISION} ${CYCLE_3M_A7_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedLinkedReturnClosure as unknown as Parameters<
          typeof isCycle3ha4FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const quarterlyCompatibilityClosureRevision = "e".repeat(40);
    const quarterlyCompatibilityClosure = [
      "86",
      "86",
      quarterlyCompatibilityClosureRevision,
      `${quarterlyCompatibilityClosureRevision} ${CYCLE_3H_A4_FEATURE_REVISION}`,
      quarterlyCompatibilityFeature,
    ] as const;
    expect(
      isCycle3ha4RoutingClosureTopologyAllowed(
        ...quarterlyCompatibilityClosure,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "85"],
      [1, "87"],
      [2, CYCLE_3H_A4_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${quarterlyCompatibilityClosureRevision} ${CYCLE_3M_A7_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${quarterlyCompatibilityClosureRevision} ${CYCLE_3H_A4_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...quarterlyCompatibilityClosure];
      changed[index] = replacement;
      expect(
        isCycle3ha4RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha4RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedQuarterlyCompatibilityFeature: unknown[] = [
      ...quarterlyCompatibilityFeature,
    ];
    tamperedQuarterlyCompatibilityFeature[4] =
      tamperedPinnedLinkedReturnClosure;
    expect(
      isCycle3ha4RoutingClosureTopologyAllowed(
        "86",
        "86",
        quarterlyCompatibilityClosureRevision,
        `${quarterlyCompatibilityClosureRevision} ${CYCLE_3H_A4_FEATURE_REVISION}`,
        tamperedQuarterlyCompatibilityFeature as unknown as Parameters<
          typeof isCycle3ha4RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedQuarterlyCompatibilityClosure = [
      "86",
      "86",
      CYCLE_3H_A4_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A4_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A4_FEATURE_REVISION}`,
      quarterlyCompatibilityFeature,
    ] as const;
    expect(
      isCycle3ha4RoutingClosureTopologyAllowed(
        ...pinnedQuarterlyCompatibilityClosure,
      ),
    ).toBe(true);
    const secQuarterlyEvidenceFeature = [
      "87",
      "87",
      CYCLE_3H_A5_FEATURE_REVISION,
      `${CYCLE_3H_A5_FEATURE_REVISION} ${CYCLE_3H_A4_ROUTING_CLOSURE_REVISION}`,
      pinnedQuarterlyCompatibilityClosure,
    ] as const;
    expect(
      isCycle3ha5FeatureTopologyAllowed(...secQuarterlyEvidenceFeature),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "86"],
      [1, "88"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A5_FEATURE_REVISION} ${CYCLE_3H_A4_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A5_FEATURE_REVISION} ${CYCLE_3H_A4_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secQuarterlyEvidenceFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha5FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha5FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedQuarterlyCompatibilityClosure: unknown[] = [
      ...pinnedQuarterlyCompatibilityClosure,
    ];
    tamperedPinnedQuarterlyCompatibilityClosure[4] =
      tamperedQuarterlyCompatibilityFeature;
    expect(
      isCycle3ha5FeatureTopologyAllowed(
        "87",
        "87",
        CYCLE_3H_A5_FEATURE_REVISION,
        `${CYCLE_3H_A5_FEATURE_REVISION} ${CYCLE_3H_A4_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedQuarterlyCompatibilityClosure as unknown as Parameters<
          typeof isCycle3ha5FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const secQuarterlyEvidenceClosureRevision = "e".repeat(40);
    const secQuarterlyEvidenceClosure = [
      "88",
      "88",
      secQuarterlyEvidenceClosureRevision,
      `${secQuarterlyEvidenceClosureRevision} ${CYCLE_3H_A5_FEATURE_REVISION}`,
      secQuarterlyEvidenceFeature,
    ] as const;
    expect(
      isCycle3ha5RoutingClosureTopologyAllowed(...secQuarterlyEvidenceClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "87"],
      [1, "89"],
      [2, CYCLE_3H_A5_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${secQuarterlyEvidenceClosureRevision} ${CYCLE_3H_A4_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${secQuarterlyEvidenceClosureRevision} ${CYCLE_3H_A5_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secQuarterlyEvidenceClosure];
      changed[index] = replacement;
      expect(
        isCycle3ha5RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha5RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedSecQuarterlyEvidenceFeature: unknown[] = [
      ...secQuarterlyEvidenceFeature,
    ];
    tamperedSecQuarterlyEvidenceFeature[4] =
      tamperedPinnedQuarterlyCompatibilityClosure;
    expect(
      isCycle3ha5RoutingClosureTopologyAllowed(
        "88",
        "88",
        secQuarterlyEvidenceClosureRevision,
        `${secQuarterlyEvidenceClosureRevision} ${CYCLE_3H_A5_FEATURE_REVISION}`,
        tamperedSecQuarterlyEvidenceFeature as unknown as Parameters<
          typeof isCycle3ha5RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedSecQuarterlyEvidenceClosure = [
      "88",
      "88",
      CYCLE_3H_A5_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A5_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A5_FEATURE_REVISION}`,
      secQuarterlyEvidenceFeature,
    ] as const;
    expect(
      isCycle3ha5RoutingClosureTopologyAllowed(
        ...pinnedSecQuarterlyEvidenceClosure,
      ),
    ).toBe(true);
    const secQuarterlyComparisonFeature = [
      "89",
      "89",
      CYCLE_3H_A6_FEATURE_REVISION,
      `${CYCLE_3H_A6_FEATURE_REVISION} ${CYCLE_3H_A5_ROUTING_CLOSURE_REVISION}`,
      pinnedSecQuarterlyEvidenceClosure,
    ] as const;
    expect(
      isCycle3ha6FeatureTopologyAllowed(...secQuarterlyComparisonFeature),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "88"],
      [1, "90"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A6_FEATURE_REVISION} ${CYCLE_3H_A5_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A6_FEATURE_REVISION} ${CYCLE_3H_A5_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secQuarterlyComparisonFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha6FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha6FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedSecQuarterlyEvidenceClosure: unknown[] = [
      ...pinnedSecQuarterlyEvidenceClosure,
    ];
    tamperedPinnedSecQuarterlyEvidenceClosure[4] =
      tamperedSecQuarterlyEvidenceFeature;
    expect(
      isCycle3ha6FeatureTopologyAllowed(
        "89",
        "89",
        CYCLE_3H_A6_FEATURE_REVISION,
        `${CYCLE_3H_A6_FEATURE_REVISION} ${CYCLE_3H_A5_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedSecQuarterlyEvidenceClosure as unknown as Parameters<
          typeof isCycle3ha6FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const secQuarterlyComparisonClosureRevision = "e".repeat(40);
    const secQuarterlyComparisonClosure = [
      "90",
      "90",
      secQuarterlyComparisonClosureRevision,
      `${secQuarterlyComparisonClosureRevision} ${CYCLE_3H_A6_FEATURE_REVISION}`,
      secQuarterlyComparisonFeature,
    ] as const;
    expect(
      isCycle3ha6RoutingClosureTopologyAllowed(
        ...secQuarterlyComparisonClosure,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "89"],
      [1, "91"],
      [2, CYCLE_3H_A6_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${secQuarterlyComparisonClosureRevision} ${CYCLE_3H_A5_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${secQuarterlyComparisonClosureRevision} ${CYCLE_3H_A6_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secQuarterlyComparisonClosure];
      changed[index] = replacement;
      expect(
        isCycle3ha6RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha6RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedSecQuarterlyComparisonFeature: unknown[] = [
      ...secQuarterlyComparisonFeature,
    ];
    tamperedSecQuarterlyComparisonFeature[4] =
      tamperedPinnedSecQuarterlyEvidenceClosure;
    expect(
      isCycle3ha6RoutingClosureTopologyAllowed(
        "90",
        "90",
        secQuarterlyComparisonClosureRevision,
        `${secQuarterlyComparisonClosureRevision} ${CYCLE_3H_A6_FEATURE_REVISION}`,
        tamperedSecQuarterlyComparisonFeature as unknown as Parameters<
          typeof isCycle3ha6RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedSecQuarterlyComparisonClosure = [
      "90",
      "90",
      CYCLE_3H_A6_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A6_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A6_FEATURE_REVISION}`,
      secQuarterlyComparisonFeature,
    ] as const;
    expect(
      isCycle3ha6RoutingClosureTopologyAllowed(
        ...pinnedSecQuarterlyComparisonClosure,
      ),
    ).toBe(true);
    const secFilingContextFeature = [
      "91",
      "91",
      CYCLE_3H_A7_FEATURE_REVISION,
      `${CYCLE_3H_A7_FEATURE_REVISION} ${CYCLE_3H_A6_ROUTING_CLOSURE_REVISION}`,
      pinnedSecQuarterlyComparisonClosure,
    ] as const;
    expect(isCycle3ha7FeatureTopologyAllowed(...secFilingContextFeature)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "90"],
      [1, "92"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A7_FEATURE_REVISION} ${CYCLE_3H_A6_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A7_FEATURE_REVISION} ${CYCLE_3H_A6_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secFilingContextFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha7FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha7FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedSecQuarterlyComparisonClosure: unknown[] = [
      ...pinnedSecQuarterlyComparisonClosure,
    ];
    tamperedPinnedSecQuarterlyComparisonClosure[4] =
      tamperedSecQuarterlyComparisonFeature;
    expect(
      isCycle3ha7FeatureTopologyAllowed(
        "91",
        "91",
        CYCLE_3H_A7_FEATURE_REVISION,
        `${CYCLE_3H_A7_FEATURE_REVISION} ${CYCLE_3H_A6_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedSecQuarterlyComparisonClosure as unknown as Parameters<
          typeof isCycle3ha7FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const secFilingContextClosureRevision = "e".repeat(40);
    const secFilingContextClosure = [
      "92",
      "92",
      secFilingContextClosureRevision,
      `${secFilingContextClosureRevision} ${CYCLE_3H_A7_FEATURE_REVISION}`,
      secFilingContextFeature,
    ] as const;
    expect(
      isCycle3ha7RoutingClosureTopologyAllowed(...secFilingContextClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "91"],
      [1, "93"],
      [2, CYCLE_3H_A7_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${secFilingContextClosureRevision} ${CYCLE_3H_A6_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${secFilingContextClosureRevision} ${CYCLE_3H_A7_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secFilingContextClosure];
      changed[index] = replacement;
      expect(
        isCycle3ha7RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha7RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedSecFilingContextFeature: unknown[] = [
      ...secFilingContextFeature,
    ];
    tamperedSecFilingContextFeature[4] =
      tamperedPinnedSecQuarterlyComparisonClosure;
    expect(
      isCycle3ha7RoutingClosureTopologyAllowed(
        "92",
        "92",
        secFilingContextClosureRevision,
        `${secFilingContextClosureRevision} ${CYCLE_3H_A7_FEATURE_REVISION}`,
        tamperedSecFilingContextFeature as unknown as Parameters<
          typeof isCycle3ha7RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedSecFilingContextClosure = [
      "92",
      "92",
      CYCLE_3H_A7_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A7_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A7_FEATURE_REVISION}`,
      secFilingContextFeature,
    ] as const;
    expect(
      isCycle3ha7RoutingClosureTopologyAllowed(
        ...pinnedSecFilingContextClosure,
      ),
    ).toBe(true);
    const secFilingReportingMetadataFeature = [
      "93",
      "93",
      CYCLE_3H_A8_FEATURE_REVISION,
      `${CYCLE_3H_A8_FEATURE_REVISION} ${CYCLE_3H_A7_ROUTING_CLOSURE_REVISION}`,
      pinnedSecFilingContextClosure,
    ] as const;
    expect(
      isCycle3ha8FeatureTopologyAllowed(...secFilingReportingMetadataFeature),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "92"],
      [1, "94"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A8_FEATURE_REVISION} ${CYCLE_3H_A7_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A8_FEATURE_REVISION} ${CYCLE_3H_A7_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secFilingReportingMetadataFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha8FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha8FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedSecFilingContextClosure: unknown[] = [
      ...pinnedSecFilingContextClosure,
    ];
    tamperedPinnedSecFilingContextClosure[4] = tamperedSecFilingContextFeature;
    expect(
      isCycle3ha8FeatureTopologyAllowed(
        "93",
        "93",
        CYCLE_3H_A8_FEATURE_REVISION,
        `${CYCLE_3H_A8_FEATURE_REVISION} ${CYCLE_3H_A7_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedSecFilingContextClosure as unknown as Parameters<
          typeof isCycle3ha8FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const secFilingReportingMetadataClosureRevision = "e".repeat(40);
    const secFilingReportingMetadataClosure = [
      "94",
      "94",
      secFilingReportingMetadataClosureRevision,
      `${secFilingReportingMetadataClosureRevision} ${CYCLE_3H_A8_FEATURE_REVISION}`,
      secFilingReportingMetadataFeature,
    ] as const;
    expect(
      isCycle3ha8RoutingClosureTopologyAllowed(
        ...secFilingReportingMetadataClosure,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "93"],
      [1, "95"],
      [2, CYCLE_3H_A8_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${secFilingReportingMetadataClosureRevision} ${CYCLE_3H_A7_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${secFilingReportingMetadataClosureRevision} ${CYCLE_3H_A8_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secFilingReportingMetadataClosure];
      changed[index] = replacement;
      expect(
        isCycle3ha8RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha8RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedSecFilingReportingMetadataFeature: unknown[] = [
      ...secFilingReportingMetadataFeature,
    ];
    tamperedSecFilingReportingMetadataFeature[4] =
      tamperedPinnedSecFilingContextClosure;
    expect(
      isCycle3ha8RoutingClosureTopologyAllowed(
        "94",
        "94",
        secFilingReportingMetadataClosureRevision,
        `${secFilingReportingMetadataClosureRevision} ${CYCLE_3H_A8_FEATURE_REVISION}`,
        tamperedSecFilingReportingMetadataFeature as unknown as Parameters<
          typeof isCycle3ha8RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedSecFilingReportingMetadataClosure = [
      "94",
      "94",
      CYCLE_3H_A8_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A8_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A8_FEATURE_REVISION}`,
      secFilingReportingMetadataFeature,
    ] as const;
    expect(
      isCycle3ha8RoutingClosureTopologyAllowed(
        ...pinnedSecFilingReportingMetadataClosure,
      ),
    ).toBe(true);
    const secFilingDeclarationStartupFeature = [
      "95",
      "95",
      CYCLE_3H_A9_FEATURE_REVISION,
      `${CYCLE_3H_A9_FEATURE_REVISION} ${CYCLE_3H_A8_ROUTING_CLOSURE_REVISION}`,
      pinnedSecFilingReportingMetadataClosure,
    ] as const;
    expect(
      isCycle3ha9FeatureTopologyAllowed(...secFilingDeclarationStartupFeature),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "94"],
      [1, "96"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A9_FEATURE_REVISION} ${CYCLE_3H_A8_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A9_FEATURE_REVISION} ${CYCLE_3H_A8_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secFilingDeclarationStartupFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha9FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha9FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedSecFilingReportingMetadataClosure: unknown[] = [
      ...pinnedSecFilingReportingMetadataClosure,
    ];
    tamperedPinnedSecFilingReportingMetadataClosure[4] =
      tamperedSecFilingReportingMetadataFeature;
    expect(
      isCycle3ha9FeatureTopologyAllowed(
        "95",
        "95",
        CYCLE_3H_A9_FEATURE_REVISION,
        `${CYCLE_3H_A9_FEATURE_REVISION} ${CYCLE_3H_A8_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedSecFilingReportingMetadataClosure as unknown as Parameters<
          typeof isCycle3ha9FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const secFilingDeclarationStartupClosureRevision = "e".repeat(40);
    const secFilingDeclarationStartupClosure = [
      "96",
      "96",
      secFilingDeclarationStartupClosureRevision,
      `${secFilingDeclarationStartupClosureRevision} ${CYCLE_3H_A9_FEATURE_REVISION}`,
      secFilingDeclarationStartupFeature,
    ] as const;
    expect(
      isCycle3ha9RoutingClosureTopologyAllowed(
        ...secFilingDeclarationStartupClosure,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "95"],
      [1, "97"],
      [2, CYCLE_3H_A9_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${secFilingDeclarationStartupClosureRevision} ${CYCLE_3H_A8_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${secFilingDeclarationStartupClosureRevision} ${CYCLE_3H_A9_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secFilingDeclarationStartupClosure];
      changed[index] = replacement;
      expect(
        isCycle3ha9RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha9RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedSecFilingDeclarationStartupFeature: unknown[] = [
      ...secFilingDeclarationStartupFeature,
    ];
    tamperedSecFilingDeclarationStartupFeature[4] =
      tamperedPinnedSecFilingReportingMetadataClosure;
    expect(
      isCycle3ha9RoutingClosureTopologyAllowed(
        "96",
        "96",
        secFilingDeclarationStartupClosureRevision,
        `${secFilingDeclarationStartupClosureRevision} ${CYCLE_3H_A9_FEATURE_REVISION}`,
        tamperedSecFilingDeclarationStartupFeature as unknown as Parameters<
          typeof isCycle3ha9RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedSecFilingDeclarationStartupClosure = [
      "96",
      "96",
      CYCLE_3H_A9_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A9_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A9_FEATURE_REVISION}`,
      secFilingDeclarationStartupFeature,
    ] as const;
    expect(
      isCycle3ha9RoutingClosureTopologyAllowed(
        ...pinnedSecFilingDeclarationStartupClosure,
      ),
    ).toBe(true);
    const secInlineLinkingFeature = [
      "97",
      "97",
      CYCLE_3H_A10_FEATURE_REVISION,
      `${CYCLE_3H_A10_FEATURE_REVISION} ${CYCLE_3H_A9_ROUTING_CLOSURE_REVISION}`,
      pinnedSecFilingDeclarationStartupClosure,
    ] as const;
    expect(isCycle3ha10FeatureTopologyAllowed(...secInlineLinkingFeature)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "96"],
      [1, "98"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A10_FEATURE_REVISION} ${CYCLE_3H_A9_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A10_FEATURE_REVISION} ${CYCLE_3H_A9_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secInlineLinkingFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha10FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha10FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedSecFilingDeclarationStartupClosure: unknown[] = [
      ...pinnedSecFilingDeclarationStartupClosure,
    ];
    tamperedPinnedSecFilingDeclarationStartupClosure[4] =
      tamperedSecFilingDeclarationStartupFeature;
    expect(
      isCycle3ha10FeatureTopologyAllowed(
        "97",
        "97",
        CYCLE_3H_A10_FEATURE_REVISION,
        `${CYCLE_3H_A10_FEATURE_REVISION} ${CYCLE_3H_A9_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedSecFilingDeclarationStartupClosure as unknown as Parameters<
          typeof isCycle3ha10FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const secInlineLinkingClosureRevision = "e".repeat(40);
    const secInlineLinkingClosure = [
      "98",
      "98",
      secInlineLinkingClosureRevision,
      `${secInlineLinkingClosureRevision} ${CYCLE_3H_A10_FEATURE_REVISION}`,
      secInlineLinkingFeature,
    ] as const;
    expect(
      isCycle3ha10RoutingClosureTopologyAllowed(...secInlineLinkingClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "97"],
      [1, "99"],
      [2, CYCLE_3H_A10_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${secInlineLinkingClosureRevision} ${CYCLE_3H_A9_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${secInlineLinkingClosureRevision} ${CYCLE_3H_A10_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secInlineLinkingClosure];
      changed[index] = replacement;
      expect(
        isCycle3ha10RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha10RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedSecInlineLinkingFeature: unknown[] = [
      ...secInlineLinkingFeature,
    ];
    tamperedSecInlineLinkingFeature[4] =
      tamperedPinnedSecFilingDeclarationStartupClosure;
    expect(
      isCycle3ha10RoutingClosureTopologyAllowed(
        "98",
        "98",
        secInlineLinkingClosureRevision,
        `${secInlineLinkingClosureRevision} ${CYCLE_3H_A10_FEATURE_REVISION}`,
        tamperedSecInlineLinkingFeature as unknown as Parameters<
          typeof isCycle3ha10RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedSecInlineLinkingClosure = [
      "98",
      "98",
      CYCLE_3H_A10_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A10_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A10_FEATURE_REVISION}`,
      secInlineLinkingFeature,
    ] as const;
    expect(
      isCycle3ha10RoutingClosureTopologyAllowed(
        ...pinnedSecInlineLinkingClosure,
      ),
    ).toBe(true);
    const secReportEndTransformFeature = [
      "99",
      "99",
      CYCLE_3H_A11_FEATURE_REVISION,
      `${CYCLE_3H_A11_FEATURE_REVISION} ${CYCLE_3H_A10_ROUTING_CLOSURE_REVISION}`,
      pinnedSecInlineLinkingClosure,
    ] as const;
    expect(
      isCycle3ha11FeatureTopologyAllowed(...secReportEndTransformFeature),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "98"],
      [1, "100"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A11_FEATURE_REVISION} ${CYCLE_3H_A10_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A11_FEATURE_REVISION} ${CYCLE_3H_A10_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secReportEndTransformFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha11FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha11FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedSecInlineLinkingClosure: unknown[] = [
      ...pinnedSecInlineLinkingClosure,
    ];
    tamperedPinnedSecInlineLinkingClosure[4] = tamperedSecInlineLinkingFeature;
    expect(
      isCycle3ha11FeatureTopologyAllowed(
        "99",
        "99",
        CYCLE_3H_A11_FEATURE_REVISION,
        `${CYCLE_3H_A11_FEATURE_REVISION} ${CYCLE_3H_A10_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedSecInlineLinkingClosure as unknown as Parameters<
          typeof isCycle3ha11FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const secReportEndTransformClosureRevision = "e".repeat(40);
    const secReportEndTransformClosure = [
      "100",
      "100",
      secReportEndTransformClosureRevision,
      `${secReportEndTransformClosureRevision} ${CYCLE_3H_A11_FEATURE_REVISION}`,
      secReportEndTransformFeature,
    ] as const;
    expect(
      isCycle3ha11RoutingClosureTopologyAllowed(
        ...secReportEndTransformClosure,
      ),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "99"],
      [1, "101"],
      [2, CYCLE_3H_A11_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${secReportEndTransformClosureRevision} ${CYCLE_3H_A10_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${secReportEndTransformClosureRevision} ${CYCLE_3H_A11_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secReportEndTransformClosure];
      changed[index] = replacement;
      expect(
        isCycle3ha11RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha11RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedSecReportEndTransformFeature: unknown[] = [
      ...secReportEndTransformFeature,
    ];
    tamperedSecReportEndTransformFeature[4] =
      tamperedPinnedSecInlineLinkingClosure;
    expect(
      isCycle3ha11RoutingClosureTopologyAllowed(
        "100",
        "100",
        secReportEndTransformClosureRevision,
        `${secReportEndTransformClosureRevision} ${CYCLE_3H_A11_FEATURE_REVISION}`,
        tamperedSecReportEndTransformFeature as unknown as Parameters<
          typeof isCycle3ha11RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedSecReportEndTransformClosure = [
      "100",
      "100",
      CYCLE_3H_A11_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A11_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A11_FEATURE_REVISION}`,
      secReportEndTransformFeature,
    ] as const;
    expect(
      isCycle3ha11RoutingClosureTopologyAllowed(
        ...pinnedSecReportEndTransformClosure,
      ),
    ).toBe(true);
    const secContextBlockersFeature = [
      "101",
      "101",
      CYCLE_3H_A12_FEATURE_REVISION,
      `${CYCLE_3H_A12_FEATURE_REVISION} ${CYCLE_3H_A11_ROUTING_CLOSURE_REVISION}`,
      pinnedSecReportEndTransformClosure,
    ] as const;
    expect(
      isCycle3ha12FeatureTopologyAllowed(...secContextBlockersFeature),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "100"],
      [1, "102"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A12_FEATURE_REVISION} ${CYCLE_3H_A11_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A12_FEATURE_REVISION} ${CYCLE_3H_A11_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secContextBlockersFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha12FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha12FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedSecReportEndTransformClosure: unknown[] = [
      ...pinnedSecReportEndTransformClosure,
    ];
    tamperedPinnedSecReportEndTransformClosure[4] =
      tamperedSecReportEndTransformFeature;
    expect(
      isCycle3ha12FeatureTopologyAllowed(
        "101",
        "101",
        CYCLE_3H_A12_FEATURE_REVISION,
        `${CYCLE_3H_A12_FEATURE_REVISION} ${CYCLE_3H_A11_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedSecReportEndTransformClosure as unknown as Parameters<
          typeof isCycle3ha12FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const secContextBlockersClosureRevision = "e".repeat(40);
    const secContextBlockersClosure = [
      "102",
      "102",
      secContextBlockersClosureRevision,
      `${secContextBlockersClosureRevision} ${CYCLE_3H_A12_FEATURE_REVISION}`,
      secContextBlockersFeature,
    ] as const;
    expect(
      isCycle3ha12RoutingClosureTopologyAllowed(...secContextBlockersClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "101"],
      [1, "103"],
      [2, CYCLE_3H_A12_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${secContextBlockersClosureRevision} ${CYCLE_3H_A11_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${secContextBlockersClosureRevision} ${CYCLE_3H_A12_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...secContextBlockersClosure];
      changed[index] = replacement;
      expect(
        isCycle3ha12RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha12RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedSecContextBlockersFeature: unknown[] = [
      ...secContextBlockersFeature,
    ];
    tamperedSecContextBlockersFeature[4] =
      tamperedPinnedSecReportEndTransformClosure;
    expect(
      isCycle3ha12RoutingClosureTopologyAllowed(
        "102",
        "102",
        secContextBlockersClosureRevision,
        `${secContextBlockersClosureRevision} ${CYCLE_3H_A12_FEATURE_REVISION}`,
        tamperedSecContextBlockersFeature as unknown as Parameters<
          typeof isCycle3ha12RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedSecContextBlockersClosure = [
      "102",
      "102",
      CYCLE_3H_A12_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A12_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A12_FEATURE_REVISION}`,
      secContextBlockersFeature,
    ] as const;
    expect(
      isCycle3ha12RoutingClosureTopologyAllowed(
        ...pinnedSecContextBlockersClosure,
      ),
    ).toBe(true);
    const dbEvidenceCaseSplitFeature = [
      "103",
      "103",
      CYCLE_3H_A13_FEATURE_REVISION,
      `${CYCLE_3H_A13_FEATURE_REVISION} ${CYCLE_3H_A12_ROUTING_CLOSURE_REVISION}`,
      pinnedSecContextBlockersClosure,
    ] as const;
    expect(
      isCycle3ha13FeatureTopologyAllowed(...dbEvidenceCaseSplitFeature),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "102"],
      [1, "104"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A13_FEATURE_REVISION} ${CYCLE_3H_A12_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A13_FEATURE_REVISION} ${CYCLE_3H_A12_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...dbEvidenceCaseSplitFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha13FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha13FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedSecContextBlockersClosure: unknown[] = [
      ...pinnedSecContextBlockersClosure,
    ];
    tamperedPinnedSecContextBlockersClosure[4] =
      tamperedSecContextBlockersFeature;
    expect(
      isCycle3ha13FeatureTopologyAllowed(
        "103",
        "103",
        CYCLE_3H_A13_FEATURE_REVISION,
        `${CYCLE_3H_A13_FEATURE_REVISION} ${CYCLE_3H_A12_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedSecContextBlockersClosure as unknown as Parameters<
          typeof isCycle3ha13FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const dbEvidenceCaseSplitClosureRevision = "e".repeat(40);
    const dbEvidenceCaseSplitClosure = [
      "104",
      "104",
      dbEvidenceCaseSplitClosureRevision,
      `${dbEvidenceCaseSplitClosureRevision} ${CYCLE_3H_A13_FEATURE_REVISION}`,
      dbEvidenceCaseSplitFeature,
    ] as const;
    expect(
      isCycle3ha13RoutingClosureTopologyAllowed(...dbEvidenceCaseSplitClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "103"],
      [1, "105"],
      [2, CYCLE_3H_A13_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${dbEvidenceCaseSplitClosureRevision} ${CYCLE_3H_A12_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${dbEvidenceCaseSplitClosureRevision} ${CYCLE_3H_A13_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...dbEvidenceCaseSplitClosure];
      changed[index] = replacement;
      expect(
        isCycle3ha13RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha13RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedDbEvidenceCaseSplitFeature: unknown[] = [
      ...dbEvidenceCaseSplitFeature,
    ];
    tamperedDbEvidenceCaseSplitFeature[4] =
      tamperedPinnedSecContextBlockersClosure;
    expect(
      isCycle3ha13RoutingClosureTopologyAllowed(
        "104",
        "104",
        dbEvidenceCaseSplitClosureRevision,
        `${dbEvidenceCaseSplitClosureRevision} ${CYCLE_3H_A13_FEATURE_REVISION}`,
        tamperedDbEvidenceCaseSplitFeature as unknown as Parameters<
          typeof isCycle3ha13RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedDbEvidenceCaseSplitClosure = [
      "104",
      "104",
      CYCLE_3H_A13_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A13_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A13_FEATURE_REVISION}`,
      dbEvidenceCaseSplitFeature,
    ] as const;
    expect(
      isCycle3ha13RoutingClosureTopologyAllowed(
        ...pinnedDbEvidenceCaseSplitClosure,
      ),
    ).toBe(true);
    const vaultTestSerialFeature = [
      "105",
      "105",
      CYCLE_3H_A14_FEATURE_REVISION,
      `${CYCLE_3H_A14_FEATURE_REVISION} ${CYCLE_3H_A13_ROUTING_CLOSURE_REVISION}`,
      pinnedDbEvidenceCaseSplitClosure,
    ] as const;
    expect(isCycle3ha14FeatureTopologyAllowed(...vaultTestSerialFeature)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "104"],
      [1, "106"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3H_A14_FEATURE_REVISION} ${CYCLE_3H_A13_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3H_A14_FEATURE_REVISION} ${CYCLE_3H_A13_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...vaultTestSerialFeature];
      changed[index] = replacement;
      expect(
        isCycle3ha14FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha14FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedDbEvidenceCaseSplitClosure: unknown[] = [
      ...pinnedDbEvidenceCaseSplitClosure,
    ];
    tamperedPinnedDbEvidenceCaseSplitClosure[4] =
      tamperedDbEvidenceCaseSplitFeature;
    expect(
      isCycle3ha14FeatureTopologyAllowed(
        "105",
        "105",
        CYCLE_3H_A14_FEATURE_REVISION,
        `${CYCLE_3H_A14_FEATURE_REVISION} ${CYCLE_3H_A13_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedDbEvidenceCaseSplitClosure as unknown as Parameters<
          typeof isCycle3ha14FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const vaultTestSerialClosureRevision = "e".repeat(40);
    const vaultTestSerialClosure = [
      "106",
      "106",
      vaultTestSerialClosureRevision,
      `${vaultTestSerialClosureRevision} ${CYCLE_3H_A14_FEATURE_REVISION}`,
      vaultTestSerialFeature,
    ] as const;
    expect(
      isCycle3ha14RoutingClosureTopologyAllowed(...vaultTestSerialClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "105"],
      [1, "107"],
      [2, CYCLE_3H_A14_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${vaultTestSerialClosureRevision} ${CYCLE_3H_A13_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${vaultTestSerialClosureRevision} ${CYCLE_3H_A14_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...vaultTestSerialClosure];
      changed[index] = replacement;
      expect(
        isCycle3ha14RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ha14RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedVaultTestSerialFeature: unknown[] = [
      ...vaultTestSerialFeature,
    ];
    tamperedVaultTestSerialFeature[4] =
      tamperedPinnedDbEvidenceCaseSplitClosure;
    expect(
      isCycle3ha14RoutingClosureTopologyAllowed(
        "106",
        "106",
        vaultTestSerialClosureRevision,
        `${vaultTestSerialClosureRevision} ${CYCLE_3H_A14_FEATURE_REVISION}`,
        tamperedVaultTestSerialFeature as unknown as Parameters<
          typeof isCycle3ha14RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedVaultTestSerialClosure = [
      "106",
      "106",
      CYCLE_3H_A14_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3H_A14_ROUTING_CLOSURE_REVISION} ${CYCLE_3H_A14_FEATURE_REVISION}`,
      vaultTestSerialFeature,
    ] as const;
    expect(
      isCycle3ha14RoutingClosureTopologyAllowed(
        ...pinnedVaultTestSerialClosure,
      ),
    ).toBe(true);
    const revenueBasisFeature = [
      "107",
      "107",
      CYCLE_3K_A3_FEATURE_REVISION,
      `${CYCLE_3K_A3_FEATURE_REVISION} ${CYCLE_3H_A14_ROUTING_CLOSURE_REVISION}`,
      pinnedVaultTestSerialClosure,
    ] as const;
    expect(isCycle3ka3FeatureTopologyAllowed(...revenueBasisFeature)).toBe(
      true,
    );
    for (const [index, replacement] of [
      [0, "106"],
      [1, "108"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3K_A3_FEATURE_REVISION} ${CYCLE_3H_A14_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3K_A3_FEATURE_REVISION} ${CYCLE_3H_A14_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...revenueBasisFeature];
      changed[index] = replacement;
      expect(
        isCycle3ka3FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ka3FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedVaultTestSerialClosure: unknown[] = [
      ...pinnedVaultTestSerialClosure,
    ];
    tamperedPinnedVaultTestSerialClosure[4] = tamperedVaultTestSerialFeature;
    expect(
      isCycle3ka3FeatureTopologyAllowed(
        "107",
        "107",
        CYCLE_3K_A3_FEATURE_REVISION,
        `${CYCLE_3K_A3_FEATURE_REVISION} ${CYCLE_3H_A14_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedVaultTestSerialClosure as unknown as Parameters<
          typeof isCycle3ka3FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const revenueBasisClosureRevision = "e".repeat(40);
    const revenueBasisClosure = [
      "108",
      "108",
      revenueBasisClosureRevision,
      `${revenueBasisClosureRevision} ${CYCLE_3K_A3_FEATURE_REVISION}`,
      revenueBasisFeature,
    ] as const;
    expect(
      isCycle3ka3RoutingClosureTopologyAllowed(...revenueBasisClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "107"],
      [1, "109"],
      [2, CYCLE_3K_A3_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${revenueBasisClosureRevision} ${CYCLE_3H_A14_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${revenueBasisClosureRevision} ${CYCLE_3K_A3_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...revenueBasisClosure];
      changed[index] = replacement;
      expect(
        isCycle3ka3RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ka3RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedRevenueBasisFeature: unknown[] = [...revenueBasisFeature];
    tamperedRevenueBasisFeature[4] = tamperedPinnedVaultTestSerialClosure;
    expect(
      isCycle3ka3RoutingClosureTopologyAllowed(
        "108",
        "108",
        revenueBasisClosureRevision,
        `${revenueBasisClosureRevision} ${CYCLE_3K_A3_FEATURE_REVISION}`,
        tamperedRevenueBasisFeature as unknown as Parameters<
          typeof isCycle3ka3RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedRevenueBasisClosure = [
      "108",
      "108",
      CYCLE_3K_A3_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3K_A3_ROUTING_CLOSURE_REVISION} ${CYCLE_3K_A3_FEATURE_REVISION}`,
      revenueBasisFeature,
    ] as const;
    expect(
      isCycle3ka3RoutingClosureTopologyAllowed(...pinnedRevenueBasisClosure),
    ).toBe(true);
    const crossEngineCaseSplitFeature = [
      "109",
      "109",
      CYCLE_3K_A4_FEATURE_REVISION,
      `${CYCLE_3K_A4_FEATURE_REVISION} ${CYCLE_3K_A3_ROUTING_CLOSURE_REVISION}`,
      pinnedRevenueBasisClosure,
    ] as const;
    expect(
      isCycle3ka4FeatureTopologyAllowed(...crossEngineCaseSplitFeature),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "108"],
      [1, "110"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3K_A4_FEATURE_REVISION} ${CYCLE_3K_A3_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3K_A4_FEATURE_REVISION} ${CYCLE_3K_A3_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...crossEngineCaseSplitFeature];
      changed[index] = replacement;
      expect(
        isCycle3ka4FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ka4FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedRevenueBasisClosure: unknown[] = [
      ...pinnedRevenueBasisClosure,
    ];
    tamperedPinnedRevenueBasisClosure[4] = tamperedRevenueBasisFeature;
    expect(
      isCycle3ka4FeatureTopologyAllowed(
        "109",
        "109",
        CYCLE_3K_A4_FEATURE_REVISION,
        `${CYCLE_3K_A4_FEATURE_REVISION} ${CYCLE_3K_A3_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedRevenueBasisClosure as unknown as Parameters<
          typeof isCycle3ka4FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const crossEngineCaseSplitClosureRevision = "e".repeat(40);
    const crossEngineCaseSplitClosure = [
      "110",
      "110",
      crossEngineCaseSplitClosureRevision,
      `${crossEngineCaseSplitClosureRevision} ${CYCLE_3K_A4_FEATURE_REVISION}`,
      crossEngineCaseSplitFeature,
    ] as const;
    expect(
      isCycle3ka4RoutingClosureTopologyAllowed(...crossEngineCaseSplitClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "109"],
      [1, "111"],
      [2, CYCLE_3K_A4_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${crossEngineCaseSplitClosureRevision} ${CYCLE_3K_A3_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${crossEngineCaseSplitClosureRevision} ${CYCLE_3K_A4_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...crossEngineCaseSplitClosure];
      changed[index] = replacement;
      expect(
        isCycle3ka4RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ka4RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedCrossEngineCaseSplitFeature: unknown[] = [
      ...crossEngineCaseSplitFeature,
    ];
    tamperedCrossEngineCaseSplitFeature[4] = tamperedPinnedRevenueBasisClosure;
    expect(
      isCycle3ka4RoutingClosureTopologyAllowed(
        "110",
        "110",
        crossEngineCaseSplitClosureRevision,
        `${crossEngineCaseSplitClosureRevision} ${CYCLE_3K_A4_FEATURE_REVISION}`,
        tamperedCrossEngineCaseSplitFeature as unknown as Parameters<
          typeof isCycle3ka4RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedCrossEngineCaseSplitClosure = [
      "110",
      "110",
      CYCLE_3K_A4_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3K_A4_ROUTING_CLOSURE_REVISION} ${CYCLE_3K_A4_FEATURE_REVISION}`,
      crossEngineCaseSplitFeature,
    ] as const;
    expect(
      isCycle3ka4RoutingClosureTopologyAllowed(
        ...pinnedCrossEngineCaseSplitClosure,
      ),
    ).toBe(true);
    const grossProfitFeature = [
      "111",
      "111",
      CYCLE_3K_A5_FEATURE_REVISION,
      `${CYCLE_3K_A5_FEATURE_REVISION} ${CYCLE_3K_A4_ROUTING_CLOSURE_REVISION}`,
      pinnedCrossEngineCaseSplitClosure,
    ] as const;
    expect(isCycle3ka5FeatureTopologyAllowed(...grossProfitFeature)).toBe(true);
    for (const [index, replacement] of [
      [0, "110"],
      [1, "112"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3K_A5_FEATURE_REVISION} ${CYCLE_3K_A4_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3K_A5_FEATURE_REVISION} ${CYCLE_3K_A4_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...grossProfitFeature];
      changed[index] = replacement;
      expect(
        isCycle3ka5FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ka5FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedCrossEngineCaseSplitClosure: unknown[] = [
      ...pinnedCrossEngineCaseSplitClosure,
    ];
    tamperedPinnedCrossEngineCaseSplitClosure[4] =
      tamperedCrossEngineCaseSplitFeature;
    expect(
      isCycle3ka5FeatureTopologyAllowed(
        "111",
        "111",
        CYCLE_3K_A5_FEATURE_REVISION,
        `${CYCLE_3K_A5_FEATURE_REVISION} ${CYCLE_3K_A4_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedCrossEngineCaseSplitClosure as unknown as Parameters<
          typeof isCycle3ka5FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const grossProfitClosureRevision = "e".repeat(40);
    const grossProfitClosure = [
      "112",
      "112",
      grossProfitClosureRevision,
      `${grossProfitClosureRevision} ${CYCLE_3K_A5_FEATURE_REVISION}`,
      grossProfitFeature,
    ] as const;
    expect(
      isCycle3ka5RoutingClosureTopologyAllowed(...grossProfitClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "111"],
      [1, "113"],
      [2, CYCLE_3K_A5_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${grossProfitClosureRevision} ${CYCLE_3K_A4_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${grossProfitClosureRevision} ${CYCLE_3K_A5_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...grossProfitClosure];
      changed[index] = replacement;
      expect(
        isCycle3ka5RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ka5RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedGrossProfitFeature: unknown[] = [...grossProfitFeature];
    tamperedGrossProfitFeature[4] = tamperedPinnedCrossEngineCaseSplitClosure;
    expect(
      isCycle3ka5RoutingClosureTopologyAllowed(
        "112",
        "112",
        grossProfitClosureRevision,
        `${grossProfitClosureRevision} ${CYCLE_3K_A5_FEATURE_REVISION}`,
        tamperedGrossProfitFeature as unknown as Parameters<
          typeof isCycle3ka5RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const pinnedGrossProfitClosure = [
      "112",
      "112",
      CYCLE_3K_A5_ROUTING_CLOSURE_REVISION,
      `${CYCLE_3K_A5_ROUTING_CLOSURE_REVISION} ${CYCLE_3K_A5_FEATURE_REVISION}`,
      grossProfitFeature,
    ] as const;
    expect(
      isCycle3ka5RoutingClosureTopologyAllowed(...pinnedGrossProfitClosure),
    ).toBe(true);
    const grossProfitSchedulerFeature = [
      "113",
      "113",
      CYCLE_3K_A6_FEATURE_REVISION,
      `${CYCLE_3K_A6_FEATURE_REVISION} ${CYCLE_3K_A5_ROUTING_CLOSURE_REVISION}`,
      pinnedGrossProfitClosure,
    ] as const;
    expect(
      isCycle3ka6FeatureTopologyAllowed(...grossProfitSchedulerFeature),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "112"],
      [1, "114"],
      [2, "b".repeat(40)],
      [2, "not-a-commit"],
      [3, `${CYCLE_3K_A6_FEATURE_REVISION} ${CYCLE_3K_A5_FEATURE_REVISION}`],
      [
        3,
        `${CYCLE_3K_A6_FEATURE_REVISION} ${CYCLE_3K_A5_ROUTING_CLOSURE_REVISION} ${"c".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...grossProfitSchedulerFeature];
      changed[index] = replacement;
      expect(
        isCycle3ka6FeatureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ka6FeatureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedPinnedGrossProfitClosure: unknown[] = [
      ...pinnedGrossProfitClosure,
    ];
    tamperedPinnedGrossProfitClosure[4] = tamperedGrossProfitFeature;
    expect(
      isCycle3ka6FeatureTopologyAllowed(
        "113",
        "113",
        CYCLE_3K_A6_FEATURE_REVISION,
        `${CYCLE_3K_A6_FEATURE_REVISION} ${CYCLE_3K_A5_ROUTING_CLOSURE_REVISION}`,
        tamperedPinnedGrossProfitClosure as unknown as Parameters<
          typeof isCycle3ka6FeatureTopologyAllowed
        >[4],
      ),
    ).toBe(false);

    const grossProfitSchedulerClosureRevision = "e".repeat(40);
    const grossProfitSchedulerClosure = [
      "114",
      "114",
      grossProfitSchedulerClosureRevision,
      `${grossProfitSchedulerClosureRevision} ${CYCLE_3K_A6_FEATURE_REVISION}`,
      grossProfitSchedulerFeature,
    ] as const;
    expect(
      isCycle3ka6RoutingClosureTopologyAllowed(...grossProfitSchedulerClosure),
    ).toBe(true);
    for (const [index, replacement] of [
      [0, "113"],
      [1, "115"],
      [2, CYCLE_3K_A6_FEATURE_REVISION],
      [2, "not-a-commit"],
      [
        3,
        `${grossProfitSchedulerClosureRevision} ${CYCLE_3K_A5_ROUTING_CLOSURE_REVISION}`,
      ],
      [
        3,
        `${grossProfitSchedulerClosureRevision} ${CYCLE_3K_A6_FEATURE_REVISION} ${"f".repeat(40)}`,
      ],
    ] as const) {
      const changed: unknown[] = [...grossProfitSchedulerClosure];
      changed[index] = replacement;
      expect(
        isCycle3ka6RoutingClosureTopologyAllowed(
          ...(changed as unknown as Parameters<
            typeof isCycle3ka6RoutingClosureTopologyAllowed
          >),
        ),
      ).toBe(false);
    }
    const tamperedGrossProfitSchedulerFeature: unknown[] = [
      ...grossProfitSchedulerFeature,
    ];
    tamperedGrossProfitSchedulerFeature[4] = tamperedPinnedGrossProfitClosure;
    expect(
      isCycle3ka6RoutingClosureTopologyAllowed(
        "114",
        "114",
        grossProfitSchedulerClosureRevision,
        `${grossProfitSchedulerClosureRevision} ${CYCLE_3K_A6_FEATURE_REVISION}`,
        tamperedGrossProfitSchedulerFeature as unknown as Parameters<
          typeof isCycle3ka6RoutingClosureTopologyAllowed
        >[4],
      ),
    ).toBe(false);
  });

  it("freezes every exact Cycle 3e-a transition through Windows stabilization routing", () => {
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
    expectExactTransition(
      isCycle3ea1SourcePreparationCommitDiffSetAllowed,
      CYCLE_3E_A1_SOURCE_PREPARATION_TRANSITION,
      19,
    );
    expectExactTransition(
      isCycle3ea1RoutingClosureCommitDiffSetAllowed,
      CYCLE_3E_A1_ROUTING_CLOSURE_TRANSITION,
      5,
    );
    expectExactTransition(
      isCycle3ea1PublicEngineeringEvidenceRecordCommitDiffSetAllowed,
      CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_TRANSITION,
      14,
    );
    expectExactTransition(
      isCycle3ea2MeasurementClockClosureCommitDiffSetAllowed,
      CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_TRANSITION,
      34,
    );
    expectExactTransition(
      isCycle3ea2RoutingClosureCommitDiffSetAllowed,
      CYCLE_3E_A2_ROUTING_CLOSURE_TRANSITION,
      5,
    );
    expectExactTransition(
      isCycle3ea2PublicEngineeringEvidenceRecordCommitDiffSetAllowed,
      CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_TRANSITION,
      16,
    );
    expectExactTransition(
      isCycle3bPublicPromotionCommitDiffSetAllowed,
      CYCLE_3B_PUBLIC_PROMOTION_TRANSITION,
      20,
    );
    expectExactTransition(
      isCycle3eaOpenFigiAliasSourceCommitDiffSetAllowed,
      CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_TRANSITION,
      4,
    );
    expectExactTransition(
      isCycle3eaOpenFigiAliasRoutingClosureCommitDiffSetAllowed,
      CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_TRANSITION,
      5,
    );
    expectExactTransition(
      isCycle3eaWindowsExpiryRecoveryLatencyStabilizationCommitDiffSetAllowed,
      CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_TRANSITION,
      2,
    );
    expectExactTransition(
      isCycle3eaWindowsExpiryRecoveryLatencyRoutingClosureCommitDiffSetAllowed,
      CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_ROUTING_CLOSURE_TRANSITION,
      5,
    );
    expectExactTransition(
      isCycle3eaProviderQueryMicSourceCommitDiffSetAllowed,
      CYCLE_3E_A_PROVIDER_QUERY_MIC_SOURCE_TRANSITION,
      3,
    );
    expectExactTransition(
      isCycle3eaPublicPromotionCommitDiffSetAllowed,
      CYCLE_3E_A_PUBLIC_PROMOTION_TRANSITION,
      30,
    );
    expectExactTransition(
      isCycle3eb1FeatureCommitDiffSetAllowed,
      CYCLE_3E_B1_FEATURE_TRANSITION,
      33,
    );
    expectExactTransition(
      isCycle3eb1RoutingClosureCommitDiffSetAllowed,
      CYCLE_3E_B1_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ga1FeatureCommitDiffSetAllowed,
      CYCLE_3G_A1_FEATURE_TRANSITION,
      27,
    );
    expectExactTransition(
      isCycle3ga1RoutingClosureCommitDiffSetAllowed,
      CYCLE_3G_A1_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3gb1FeatureCommitDiffSetAllowed,
      CYCLE_3G_B1_FEATURE_TRANSITION,
      18,
    );
    expectExactTransition(
      isCycle3gb1RoutingClosureCommitDiffSetAllowed,
      CYCLE_3G_B1_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha1FeatureCommitDiffSetAllowed,
      CYCLE_3H_A1_FEATURE_TRANSITION,
      31,
    );
    expectExactTransition(
      isCycle3ha1RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A1_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha2FeatureCommitDiffSetAllowed,
      CYCLE_3H_A2_FEATURE_TRANSITION,
      25,
    );
    expectExactTransition(
      isCycle3ha2RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A2_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha3FeatureCommitDiffSetAllowed,
      CYCLE_3H_A3_FEATURE_TRANSITION,
      22,
    );
    expectExactTransition(
      isCycle3ha3RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A3_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ia1FeatureCommitDiffSetAllowed,
      CYCLE_3I_A1_FEATURE_TRANSITION,
      17,
    );
    expectExactTransition(
      isCycle3ia1RoutingClosureCommitDiffSetAllowed,
      CYCLE_3I_A1_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ia2FeatureCommitDiffSetAllowed,
      CYCLE_3I_A2_FEATURE_TRANSITION,
      15,
    );
    expectExactTransition(
      isCycle3ia2RoutingClosureCommitDiffSetAllowed,
      CYCLE_3I_A2_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ja1FeatureCommitDiffSetAllowed,
      CYCLE_3J_A1_FEATURE_TRANSITION,
      15,
    );
    expectExactTransition(
      isCycle3ja1RoutingClosureCommitDiffSetAllowed,
      CYCLE_3J_A1_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ja2FeatureCommitDiffSetAllowed,
      CYCLE_3J_A2_FEATURE_TRANSITION,
      23,
    );
    expectExactTransition(
      isCycle3ja2RoutingClosureCommitDiffSetAllowed,
      CYCLE_3J_A2_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ka1FeatureCommitDiffSetAllowed,
      CYCLE_3K_A1_FEATURE_TRANSITION,
      23,
    );
    expectExactTransition(
      isCycle3ka1RoutingClosureCommitDiffSetAllowed,
      CYCLE_3K_A1_ROUTING_CLOSURE_TRANSITION,
      11,
    );
    expectExactTransition(
      isCycle3ka2FeatureCommitDiffSetAllowed,
      CYCLE_3K_A2_FEATURE_TRANSITION,
      29,
    );
    expectExactTransition(
      isCycle3ka2RoutingClosureCommitDiffSetAllowed,
      CYCLE_3K_A2_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3la1FeatureCommitDiffSetAllowed,
      CYCLE_3L_A1_FEATURE_TRANSITION,
      22,
    );
    expectExactTransition(
      isCycle3la1RoutingClosureCommitDiffSetAllowed,
      CYCLE_3L_A1_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ma1FeatureCommitDiffSetAllowed,
      CYCLE_3M_A1_FEATURE_TRANSITION,
      23,
    );
    expectExactTransition(
      isCycle3ma1RoutingClosureCommitDiffSetAllowed,
      CYCLE_3M_A1_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ma2FeatureCommitDiffSetAllowed,
      CYCLE_3M_A2_FEATURE_TRANSITION,
      20,
    );
    expectExactTransition(
      isCycle3ma2RoutingClosureCommitDiffSetAllowed,
      CYCLE_3M_A2_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ma3FeatureCommitDiffSetAllowed,
      CYCLE_3M_A3_FEATURE_TRANSITION,
      27,
    );
    expectExactTransition(
      isCycle3ma3RoutingClosureCommitDiffSetAllowed,
      CYCLE_3M_A3_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ma4FeatureCommitDiffSetAllowed,
      CYCLE_3M_A4_FEATURE_TRANSITION,
      15,
    );
    expectExactTransition(
      isCycle3ma4RoutingClosureCommitDiffSetAllowed,
      CYCLE_3M_A4_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ma5FeatureCommitDiffSetAllowed,
      CYCLE_3M_A5_FEATURE_TRANSITION,
      11,
    );
    expectExactTransition(
      isCycle3ma5RoutingClosureCommitDiffSetAllowed,
      CYCLE_3M_A5_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ma6FeatureCommitDiffSetAllowed,
      CYCLE_3M_A6_FEATURE_TRANSITION,
      11,
    );
    expectExactTransition(
      isCycle3ma6RoutingClosureCommitDiffSetAllowed,
      CYCLE_3M_A6_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ma7FeatureCommitDiffSetAllowed,
      CYCLE_3M_A7_FEATURE_TRANSITION,
      11,
    );
    expectExactTransition(
      isCycle3ma7RoutingClosureCommitDiffSetAllowed,
      CYCLE_3M_A7_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha4FeatureCommitDiffSetAllowed,
      CYCLE_3H_A4_FEATURE_TRANSITION,
      12,
    );
    expectExactTransition(
      isCycle3ha4RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A4_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha5FeatureCommitDiffSetAllowed,
      CYCLE_3H_A5_FEATURE_TRANSITION,
      28,
    );
    expectExactTransition(
      isCycle3ha5RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A5_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha6FeatureCommitDiffSetAllowed,
      CYCLE_3H_A6_FEATURE_TRANSITION,
      9,
    );
    expectExactTransition(
      isCycle3ha6RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A6_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha7FeatureCommitDiffSetAllowed,
      CYCLE_3H_A7_FEATURE_TRANSITION,
      28,
    );
    expectExactTransition(
      isCycle3ha7RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A7_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha8FeatureCommitDiffSetAllowed,
      CYCLE_3H_A8_FEATURE_TRANSITION,
      17,
    );
    expectExactTransition(
      isCycle3ha8RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A8_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha9FeatureCommitDiffSetAllowed,
      CYCLE_3H_A9_FEATURE_TRANSITION,
      9,
    );
    expectExactTransition(
      isCycle3ha9RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A9_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha10FeatureCommitDiffSetAllowed,
      CYCLE_3H_A10_FEATURE_TRANSITION,
      4,
    );
    expectExactTransition(
      isCycle3ha10RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A10_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha11FeatureCommitDiffSetAllowed,
      CYCLE_3H_A11_FEATURE_TRANSITION,
      11,
    );
    expectExactTransition(
      isCycle3ha11RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A11_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha12FeatureCommitDiffSetAllowed,
      CYCLE_3H_A12_FEATURE_TRANSITION,
      5,
    );
    expectExactTransition(
      isCycle3ha12RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A12_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expect(CYCLE_3H_A13_FEATURE_TRANSITION).toHaveLength(1);
    expect(
      isCycle3ha13FeatureCommitDiffSetAllowed(CYCLE_3H_A13_FEATURE_TRANSITION),
    ).toBe(true);
    for (const entries of [
      [],
      [
        {
          path: "packages/db/tests/postgres-acceptance-evidence-review.test.ts",
          status: "A",
        },
      ],
      [
        {
          path: "packages/db/tests/postgres-acceptance-evidence-review.test.ts",
          status: "D",
        },
      ],
      [
        {
          path: "packages/db/src/postgres-acceptance-evidence-review.ts",
          status: "M",
        },
      ],
      [...CYCLE_3H_A13_FEATURE_TRANSITION, ...CYCLE_3H_A13_FEATURE_TRANSITION],
      [...CYCLE_3H_A13_FEATURE_TRANSITION, { path: "unreviewed", status: "M" }],
    ]) {
      expect(isCycle3ha13FeatureCommitDiffSetAllowed(entries)).toBe(false);
    }
    expectExactTransition(
      isCycle3ha13RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A13_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ha14FeatureCommitDiffSetAllowed,
      CYCLE_3H_A14_FEATURE_TRANSITION,
      2,
    );
    expectExactTransition(
      isCycle3ha14RoutingClosureCommitDiffSetAllowed,
      CYCLE_3H_A14_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ka3FeatureCommitDiffSetAllowed,
      CYCLE_3K_A3_FEATURE_TRANSITION,
      10,
    );
    expectExactTransition(
      isCycle3ka3RoutingClosureCommitDiffSetAllowed,
      CYCLE_3K_A3_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expect(CYCLE_3K_A4_FEATURE_TRANSITION).toHaveLength(1);
    expect(
      isCycle3ka4FeatureCommitDiffSetAllowed(CYCLE_3K_A4_FEATURE_TRANSITION),
    ).toBe(true);
    for (const entries of [
      [],
      [
        {
          path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.test.ts",
          status: "A",
        },
      ],
      [
        {
          path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.test.ts",
          status: "D",
        },
      ],
      [
        {
          path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.ts",
          status: "M",
        },
      ],
      [...CYCLE_3K_A4_FEATURE_TRANSITION, ...CYCLE_3K_A4_FEATURE_TRANSITION],
      [...CYCLE_3K_A4_FEATURE_TRANSITION, { path: "unreviewed", status: "M" }],
    ]) {
      expect(isCycle3ka4FeatureCommitDiffSetAllowed(entries)).toBe(false);
    }
    expectExactTransition(
      isCycle3ka4RoutingClosureCommitDiffSetAllowed,
      CYCLE_3K_A4_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expectExactTransition(
      isCycle3ka5FeatureCommitDiffSetAllowed,
      CYCLE_3K_A5_FEATURE_TRANSITION,
      13,
    );
    expectExactTransition(
      isCycle3ka5RoutingClosureCommitDiffSetAllowed,
      CYCLE_3K_A5_ROUTING_CLOSURE_TRANSITION,
      7,
    );
    expect(CYCLE_3K_A6_FEATURE_TRANSITION).toHaveLength(1);
    expect(
      isCycle3ka6FeatureCommitDiffSetAllowed(CYCLE_3K_A6_FEATURE_TRANSITION),
    ).toBe(true);
    for (const entries of [
      [],
      [
        {
          path: "apps/api/src/personal-sec-request-scheduler.test.ts",
          status: "A",
        },
      ],
      [
        {
          path: "apps/api/src/personal-sec-request-scheduler.test.ts",
          status: "D",
        },
      ],
      [{ path: "apps/api/src/personal-sec-request-scheduler.ts", status: "M" }],
      [...CYCLE_3K_A6_FEATURE_TRANSITION, ...CYCLE_3K_A6_FEATURE_TRANSITION],
      [...CYCLE_3K_A6_FEATURE_TRANSITION, { path: "unreviewed", status: "M" }],
    ]) {
      expect(isCycle3ka6FeatureCommitDiffSetAllowed(entries)).toBe(false);
    }
    expectExactTransition(
      isCycle3ka6RoutingClosureCommitDiffSetAllowed,
      CYCLE_3K_A6_ROUTING_CLOSURE_TRANSITION,
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
      ...CYCLE_3E_A1_SOURCE_PREPARATION_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A2_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3B_PUBLIC_PROMOTION_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_ROUTING_CLOSURE_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A_PROVIDER_QUERY_MIC_SOURCE_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A_PUBLIC_PROMOTION_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_B1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_B1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3G_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3G_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3G_B1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3G_B1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A2_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A2_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A3_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A3_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3I_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3I_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3I_A2_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3I_A2_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3J_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3J_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3J_A2_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3J_A2_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A2_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A2_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3L_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3L_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A2_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A2_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A3_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A3_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A4_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A4_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A5_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A5_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A6_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A6_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A7_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A7_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A4_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A4_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A5_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A5_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A6_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A6_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A7_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A7_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A8_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A8_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A9_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A9_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A10_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A10_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A11_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A11_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A12_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A12_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A13_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A13_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A14_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A14_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A3_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A3_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A4_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A4_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A5_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A5_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A6_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A6_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
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

  it("selects the complete Cycle 3e-a surface in the Cycle 2z baseline Git pathspec", async () => {
    const repositoryPath = "repository";
    const revision = "d".repeat(40);
    const calls: Array<{
      readonly cwd: string;
      readonly args: readonly string[];
      readonly maximumOutputBytes: number | undefined;
    }> = [];
    const encoder = new TextEncoder();
    await expect(
      cycle2zTransitionSurfaceDiffPaths(
        repositoryPath,
        revision,
        (cwd, args, maximumOutputBytes) => {
          calls.push({ cwd, args: [...args], maximumOutputBytes });
          return Promise.resolve(
            args[0] === "merge-base"
              ? encoder.encode(`${CYCLE_2Z_BASELINE_REVISION}\n`)
              : new Uint8Array(),
          );
        },
      ),
    ).resolves.toEqual([]);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      cwd: repositoryPath,
      args: ["merge-base", CYCLE_2Z_BASELINE_REVISION, revision],
      maximumOutputBytes: 64,
    });
    const diffCall = calls[1];
    expect(diffCall).toBeDefined();
    expect(diffCall?.cwd).toBe(repositoryPath);
    expect(diffCall?.maximumOutputBytes).toBeUndefined();
    expect(diffCall?.args.slice(0, 7)).toEqual([
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2Z_BASELINE_REVISION,
      revision,
      "--",
    ]);
    const selectedPaths = diffCall?.args.slice(7) ?? [];
    const expectedPaths = new Set([
      ...CYCLE_3D_PROTECTED_SURFACE_PATHS,
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
      ...CYCLE_3E_A1_SOURCE_PREPARATION_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A1_PUBLIC_ENGINEERING_EVIDENCE_RECORD_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A2_MEASUREMENT_CLOCK_CLOSURE_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A2_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A2_PUBLIC_ENGINEERING_EVIDENCE_RECORD_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3B_PUBLIC_PROMOTION_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A_OPENFIGI_ALIAS_SOURCE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_A_OPENFIGI_ALIAS_ROUTING_CLOSURE_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_STABILIZATION_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A_WINDOWS_EXPIRY_RECOVERY_LATENCY_ROUTING_CLOSURE_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A_PROVIDER_QUERY_MIC_SOURCE_TRANSITION.map(
        (entry) => entry.path,
      ),
      ...CYCLE_3E_A_PUBLIC_PROMOTION_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_B1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3E_B1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3G_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3G_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3G_B1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3G_B1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A2_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A2_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A3_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A3_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3I_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3I_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3I_A2_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3I_A2_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3J_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3J_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3J_A2_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3J_A2_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A2_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A2_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3L_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3L_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A1_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A1_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A2_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A2_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A3_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A3_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A4_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A4_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A5_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A5_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A6_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A6_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A7_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3M_A7_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A4_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A4_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A5_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A5_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A6_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A6_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A7_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A7_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A8_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A8_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A9_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A9_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A10_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A10_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A11_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A11_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A12_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A12_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A13_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A13_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A14_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3H_A14_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A3_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A3_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A4_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A4_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A5_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A5_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A6_FEATURE_TRANSITION.map((entry) => entry.path),
      ...CYCLE_3K_A6_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),
    ]);
    expect(selectedPaths).toHaveLength(expectedPaths.size);
    expect(new Set(selectedPaths)).toEqual(expectedPaths);
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
