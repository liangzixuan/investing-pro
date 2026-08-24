import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  filingParserEvidenceReviewOptionsFromArguments,
  filingParserEvidenceReviewStdout,
} from "./filing-parser-evidence-review";
import {
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
  isFastify5121MaintenanceBaselineMergeBaseAllowed,
  isFastify5121MaintenanceCommitDiffSetAllowed,
  isFastify5121MaintenanceTransitionRoutingRequired,
  isFilingParserEvidenceFileReadSnapshotAllowed,
  isOfflineEvidenceInputCustodyBaselineMergeBaseAllowed,
  isOfflineEvidenceInputCustodyCommitDiffSetAllowed,
  isOfflineEvidenceInputCustodySurfaceRoutingRequired,
  normalizeFilingParserEvidenceReviewOptions,
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
