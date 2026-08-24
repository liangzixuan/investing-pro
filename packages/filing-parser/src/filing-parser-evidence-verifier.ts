import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { spawn } from "node:child_process";

import {
  FILING_PARSER_EVIDENCE_SOURCE_PATHS,
  filingParserEvidenceSha256,
  parseCanonicalFilingParserEvidence,
  type FilingParserEvidence,
} from "./filing-parser-evidence";
import { FILING_PARSER_QUARANTINE_CODES } from "./parser-boundary";

const MAX_EVIDENCE_BYTES = 1_048_576;
const MAX_GIT_BLOB_BYTES = 4_194_304;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const RUN_ID = /^[1-9][0-9]{0,19}$/;
const CYCLE_2A_BASELINE_REVISION =
  "6d42175beb7e7c3f58a4143bc2e9b1fd73977439" as const;
const CYCLE_2D_BASELINE_REVISION =
  "c0bbab34535cdfd7c590d774a1dad521de92fee9" as const;
const CYCLE_2E_BASELINE_REVISION =
  "e0ee2e74eac6164487cc09d12b6efab5fd5f8cb5" as const;
const CYCLE_2F_BASELINE_REVISION =
  "baa79baa466cf1c869f63a279f90a6dde61c97ac" as const;
const CYCLE_2G_BASELINE_REVISION =
  "033e59cc06a421f104ecd869ae77ac694fa8ff31" as const;
const CYCLE_2H_BASELINE_REVISION =
  "14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98" as const;
const CYCLE_2A_DISCONNECTED_SUCCESSOR_SOURCE_PATHS = Object.freeze([
  "packages/filing-parser/src/corpus-admission-security.test.ts",
  "packages/filing-parser/src/corpus-admission.test.ts",
  "packages/filing-parser/src/corpus-admission.ts",
]);
const CYCLE_2C_DISCONNECTED_SUCCESSOR_TREE = Object.freeze(
  [
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
  ].sort(),
);
const CYCLE_2D_DISCONNECTED_SUCCESSOR_TREE = Object.freeze(
  [
    "packages/filing-fact-normalization/package.json",
    "packages/filing-fact-normalization/src/filing-fact-normalization-security.test.ts",
    "packages/filing-fact-normalization/src/filing-fact-normalization.test.ts",
    "packages/filing-fact-normalization/src/filing-fact-normalization.ts",
    "packages/filing-fact-normalization/src/index.ts",
    "packages/filing-fact-normalization/src/test-filing-fact-builder.ts",
    "packages/filing-fact-normalization/tsconfig.json",
  ].sort(),
);
const CYCLE_2E_DISCONNECTED_SUCCESSOR_TREE = Object.freeze(
  [
    "packages/filing-fact-comparison/package.json",
    "packages/filing-fact-comparison/src/declared-validator-a.ts",
    "packages/filing-fact-comparison/src/declared-validator-b.ts",
    "packages/filing-fact-comparison/src/filing-fact-comparison-security.test.ts",
    "packages/filing-fact-comparison/src/filing-fact-comparison.test.ts",
    "packages/filing-fact-comparison/src/filing-fact-comparison.ts",
    "packages/filing-fact-comparison/src/index.ts",
    "packages/filing-fact-comparison/src/test-filing-fact-comparison-builder.ts",
    "packages/filing-fact-comparison/tsconfig.json",
  ].sort(),
);
const CYCLE_2F_DISCONNECTED_SUCCESSOR_TREE = Object.freeze(
  [
    "packages/filing-quality-measurement/package.json",
    "packages/filing-quality-measurement/src/filing-quality-measurement-security.test.ts",
    "packages/filing-quality-measurement/src/filing-quality-measurement.test.ts",
    "packages/filing-quality-measurement/src/filing-quality-measurement.ts",
    "packages/filing-quality-measurement/src/index.ts",
    "packages/filing-quality-measurement/src/test-filing-quality-measurement-builder.ts",
    "packages/filing-quality-measurement/tsconfig.json",
  ].sort(),
);
const CYCLE_2G_DISCONNECTED_SUCCESSOR_TREE = Object.freeze(
  [
    "packages/filing-quality-precommitment/package.json",
    "packages/filing-quality-precommitment/src/filing-quality-precommitment-security.test.ts",
    "packages/filing-quality-precommitment/src/filing-quality-precommitment.test.ts",
    "packages/filing-quality-precommitment/src/filing-quality-precommitment.ts",
    "packages/filing-quality-precommitment/src/index.ts",
    "packages/filing-quality-precommitment/src/test-filing-quality-precommitment-builder.ts",
    "packages/filing-quality-precommitment/tsconfig.json",
  ].sort(),
);
const CYCLE_2D_TRANSITION = Object.freeze(
  [
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2E_TRANSITION = Object.freeze(
  [
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2F_TRANSITION = Object.freeze(
  [
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2G_TRANSITION = Object.freeze(
  [
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
    {
      path: "packages/filing-quality-precommitment/tsconfig.json",
      status: "A",
    },
    { path: "pnpm-lock.yaml", status: "M" },
    { path: "scripts/verify-boundaries.ts", status: "M" },
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2H_TRANSITION = Object.freeze(
  [
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
    {
      path: "packages/filing-parser/src/parser-security.test.ts",
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2H_PRE_BASELINE_CUMULATIVE_PATHS = new Set([
  "packages/db/tests/postgres-acceptance-evidence-review.test.ts",
]);
const CYCLE_2F_TRANSITION_PATHS = new Set(
  CYCLE_2F_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2G_TRANSITION_PATHS = new Set(
  CYCLE_2G_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2H_TRANSITION_PATHS = new Set(
  CYCLE_2H_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2D_MARKER_PATHS = new Set([
  "docs/CYCLE_2D_EXIT_MATRIX.md",
  "docs/adr/0031-bounded-synthetic-ten-fact-normalization-and-lineage.md",
  ...CYCLE_2D_DISCONNECTED_SUCCESSOR_TREE,
]);
const CYCLE_2E_MARKER_PATHS = new Set([
  "docs/CYCLE_2E_EXIT_MATRIX.md",
  "docs/adr/0032-bounded-synthetic-two-declared-validator-fact-comparison.md",
  ...CYCLE_2E_DISCONNECTED_SUCCESSOR_TREE,
]);
const CYCLE_2F_MARKER_PATHS = new Set([
  "docs/CYCLE_2F_EXIT_MATRIX.md",
  "docs/adr/0033-bounded-synthetic-declared-reference-quality-measurement.md",
  ...CYCLE_2F_DISCONNECTED_SUCCESSOR_TREE,
]);
const CYCLE_2G_MARKER_PATHS = new Set([
  "docs/CYCLE_2G_EXIT_MATRIX.md",
  "docs/adr/0034-bounded-synthetic-declared-reference-precommitment.md",
  ...CYCLE_2G_DISCONNECTED_SUCCESSOR_TREE,
]);
const CYCLE_2H_MARKER_PATHS = new Set([
  "docs/CYCLE_2H_EXIT_MATRIX.md",
  "docs/adr/0035-cross-boundary-intrinsic-byte-snapshot-hardening.md",
  ...CYCLE_2H_PRE_BASELINE_CUMULATIVE_PATHS,
]);
const CYCLE_2A_LEGACY_EVIDENCE_NOTE_TREE = Object.freeze([
  "docs/FILING_PARSER_ISOLATION_EVIDENCE.md",
]);
const CYCLE_2C_SUCCESSOR_EVIDENCE_NOTE_TREE = Object.freeze([
  ...CYCLE_2A_LEGACY_EVIDENCE_NOTE_TREE,
  "docs/FILING_PAYLOAD_CUSTODY_EVIDENCE.md",
]);

const CYCLE_2A_DIFF_ALLOWLIST = new Set([
  ".github/workflows/ci.yml",
  ".github/workflows/filing-parser-acceptance.yml",
  ".github/workflows/filing-payload-custody-acceptance.yml",
  "LICENSE_POLICY.md",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "docs/BUILD_ROADMAP.md",
  "docs/CANONICAL_MODEL.md",
  "docs/CYCLE_2A_EXIT_MATRIX.md",
  "docs/CYCLE_2B_EXIT_MATRIX.md",
  "docs/CYCLE_2C_EXIT_MATRIX.md",
  "docs/CYCLE_2D_EXIT_MATRIX.md",
  "docs/CYCLE_2E_EXIT_MATRIX.md",
  "docs/CYCLE_2F_EXIT_MATRIX.md",
  "docs/CYCLE_2G_EXIT_MATRIX.md",
  "docs/FILING_PARSER_ISOLATION_EVIDENCE.md",
  "docs/FILING_PAYLOAD_CUSTODY_EVIDENCE.md",
  "docs/THREAT_MODEL.md",
  "docs/adr/0028-bounded-synthetic-filing-parser-isolation.md",
  "docs/adr/0029-fixed-public-filing-candidate-manifest-admission.md",
  "docs/adr/0030-bounded-synthetic-filing-payload-custody.md",
  "docs/adr/0031-bounded-synthetic-ten-fact-normalization-and-lineage.md",
  "docs/adr/0032-bounded-synthetic-two-declared-validator-fact-comparison.md",
  "docs/adr/0033-bounded-synthetic-declared-reference-quality-measurement.md",
  "docs/adr/0034-bounded-synthetic-declared-reference-precommitment.md",
  "fixtures/synthetic/filing-parser/v1/cases.json",
  "fixtures/synthetic/filing-parser/v1/manifest.json",
  "package.json",
  "packages/filing-parser/acceptance/python-image.json",
  "packages/filing-parser/package.json",
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
  "pnpm-lock.yaml",
  "scripts/verify-boundaries.ts",
  "scripts/verify-filing-parser-fixtures.ts",
  "scripts/verify-filing-payload-custody-fixtures.ts",
  ...CYCLE_2A_DISCONNECTED_SUCCESSOR_SOURCE_PATHS,
  ...CYCLE_2C_DISCONNECTED_SUCCESSOR_TREE,
  ...CYCLE_2D_DISCONNECTED_SUCCESSOR_TREE,
  ...CYCLE_2E_DISCONNECTED_SUCCESSOR_TREE,
  ...CYCLE_2F_DISCONNECTED_SUCCESSOR_TREE,
  ...CYCLE_2G_DISCONNECTED_SUCCESSOR_TREE,
]);

const LEGACY_CYCLE_2A_PARSER_DOMAIN_TREE = Object.freeze(
  [...CYCLE_2A_DIFF_ALLOWLIST]
    .filter(
      (path) =>
        (path.startsWith("packages/filing-parser/") ||
          path.startsWith("fixtures/synthetic/filing-parser/v1/")) &&
        !CYCLE_2A_DISCONNECTED_SUCCESSOR_SOURCE_PATHS.includes(path),
    )
    .sort(),
);
const SUCCESSOR_COMPATIBLE_CYCLE_2A_PARSER_DOMAIN_TREE = Object.freeze(
  [
    ...LEGACY_CYCLE_2A_PARSER_DOMAIN_TREE,
    ...CYCLE_2A_DISCONNECTED_SUCCESSOR_SOURCE_PATHS,
  ].sort(),
);

const PYTHON_IMAGE = Object.freeze({
  cpythonLicense: "Python Software Foundation License Version 2",
  cpythonLicenseUrl: "https://docs.python.org/3.12/license.html",
  containerPackageLicenseInventoryStatus: "not_proven_ci_acceptance_only",
  distribution: "Debian GNU/Linux 12 (bookworm) slim",
  image:
    "docker.io/library/python:3.12.13-slim-bookworm@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
  indexDigest:
    "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
  officialImageDefinitionUrl:
    "https://github.com/docker-library/official-images/blob/master/library/python",
  officialRegistryManifestUrl:
    "https://registry-1.docker.io/v2/library/python/manifests/3.12.13-slim-bookworm",
  platform: "linux/amd64",
  platformManifestDigest:
    "sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af",
  pythonVersion: "3.12.13",
  schemaVersion: 1,
  tag: "3.12.13-slim-bookworm",
});

const FROZEN_POSTGRES_V14_SOURCE_HASHES = Object.freeze([
  {
    path: ".github/workflows/postgres-acceptance.yml",
    sha256:
      "sha256:5f8ab0336cfb9fc35363f5b69d5db4564eaa79c7dd7fc16eecb266aa902e844f",
  },
  {
    path: "packages/db/src/postgres-acceptance-evidence.ts",
    sha256:
      "sha256:4988f3e358923c22d84ef1defc34c8078085f65bccc34a0f3996ce4520001b4e",
  },
  {
    path: "packages/db/src/postgres-acceptance-evidence-verifier.ts",
    sha256:
      "sha256:290b3ba06e1077c528cd3d636de48049ebde9ef1c70819e3527da0d46e38d3cb",
  },
  {
    path: "packages/db/src/postgres-acceptance-evidence-review.ts",
    sha256:
      "sha256:089034320a561c5768f1beaf630a19f106e9839093ca52f87fed2efbb27708dc",
  },
  {
    path: "packages/db/src/run-postgres-acceptance-evidence-review.ts",
    sha256:
      "sha256:7c4f2abd9310cbab7df55474ace97c69ef12ce35b585c528a46a538b4cd1f87c",
  },
] as const);

export interface FilingParserEvidenceReviewOptions {
  readonly evidencePath: string;
  readonly expectedEvidenceSha256: `sha256:${string}`;
  readonly expectedRepository: string;
  readonly expectedRevision: string;
  readonly expectedRunAttempt: number;
  readonly expectedRunId: string;
  readonly repositoryPath: string;
}

export interface FilingParserEvidenceReview {
  readonly evidenceSha256: `sha256:${string}`;
  readonly recordedChecksPassed: FilingParserEvidence["checksPassed"];
  readonly recordedNotProven: FilingParserEvidence["notProven"];
  readonly repository: string;
  readonly revision: string;
  readonly runAttempt: number;
  readonly runId: string;
  readonly sourceHashCount: number;
  readonly verdict: "offline_consistent";
}

export async function verifyFilingParserEvidenceOffline(
  options: FilingParserEvidenceReviewOptions,
): Promise<FilingParserEvidenceReview> {
  try {
    return await verifyFilingParserEvidenceOfflineInternal(options);
  } catch {
    return invalidReview();
  }
}

async function verifyFilingParserEvidenceOfflineInternal(
  options: FilingParserEvidenceReviewOptions,
): Promise<FilingParserEvidenceReview> {
  validateOptions(options);
  const evidenceBytes = await readSmallRegularFile(
    options.evidencePath,
    MAX_EVIDENCE_BYTES,
  );
  const evidence = parseCanonicalFilingParserEvidence(evidenceBytes);
  const evidenceSha256 = filingParserEvidenceSha256(evidence);
  if (
    evidenceSha256 !== options.expectedEvidenceSha256 ||
    evidence.repository !== options.expectedRepository ||
    evidence.revision !== options.expectedRevision ||
    evidence.workflow.runId !== options.expectedRunId ||
    evidence.workflow.runAttempt !== options.expectedRunAttempt
  )
    invalidReview();

  const repositoryPath = await realpath(options.repositoryPath);
  const repositoryStat = await lstat(repositoryPath);
  if (!repositoryStat.isDirectory() || repositoryStat.isSymbolicLink())
    invalidReview();
  await git(
    repositoryPath,
    ["cat-file", "-e", `${options.expectedRevision}^{commit}`],
    0,
  );
  await verifyCycle2aCommitBoundary(repositoryPath, options.expectedRevision);

  const committedSources = new Map<string, Uint8Array>();
  for (
    let index = 0;
    index < FILING_PARSER_EVIDENCE_SOURCE_PATHS.length;
    index += 1
  ) {
    const path = FILING_PARSER_EVIDENCE_SOURCE_PATHS[index];
    const recorded = evidence.sourceHashes[index];
    if (path === undefined || recorded === undefined || recorded.path !== path)
      invalidReview();
    const bytes = await git(repositoryPath, [
      "show",
      `${options.expectedRevision}:${path}`,
    ]);
    committedSources.set(path, bytes);
    if (sha256(bytes) !== recorded.sha256) invalidReview();
  }

  const imageConfig = parseExactJson(
    requiredSource(
      committedSources,
      "packages/filing-parser/acceptance/python-image.json",
    ),
  );
  if (canonicalJson(imageConfig) !== canonicalJson(PYTHON_IMAGE))
    invalidReview();
  if (
    evidence.image.baseIndexDigest !== PYTHON_IMAGE.indexDigest ||
    evidence.image.basePlatformManifestDigest !==
      PYTHON_IMAGE.platformManifestDigest
  )
    invalidReview();

  const dockerfile = new TextDecoder("utf-8", { fatal: true }).decode(
    requiredSource(
      committedSources,
      "packages/filing-parser/worker/Dockerfile",
    ),
  );
  if (`FROM ${PYTHON_IMAGE.image}` !== dockerfile.split(/\r?\n/u)[0])
    invalidReview();

  const manifestBytes = requiredSource(
    committedSources,
    "fixtures/synthetic/filing-parser/v1/manifest.json",
  );
  if (sha256(manifestBytes) !== evidence.fixtureManifestSha256) invalidReview();
  verifyFixtureManifestChain(committedSources, manifestBytes, evidence);

  for (const historical of FROZEN_POSTGRES_V14_SOURCE_HASHES) {
    const bytes = await git(repositoryPath, [
      "show",
      `${options.expectedRevision}:${historical.path}`,
    ]);
    if (sha256(bytes) !== historical.sha256) invalidReview();
  }

  return Object.freeze({
    evidenceSha256,
    recordedChecksPassed: evidence.checksPassed,
    recordedNotProven: evidence.notProven,
    repository: evidence.repository,
    revision: evidence.revision,
    runAttempt: evidence.workflow.runAttempt,
    runId: evidence.workflow.runId,
    sourceHashCount: evidence.sourceHashes.length,
    verdict: "offline_consistent" as const,
  });
}

function verifyFixtureManifestChain(
  sources: ReadonlyMap<string, Uint8Array>,
  manifestBytes: Uint8Array,
  evidence: FilingParserEvidence,
): void {
  const manifest = exactRecord(parseExactJson(manifestBytes), [
    "acceptedCases",
    "caseCount",
    "casesSha256",
    "files",
    "quarantinedCases",
    "schemaVersion",
    "synthetic",
  ]);
  const casesBytes = requiredSource(
    sources,
    "fixtures/synthetic/filing-parser/v1/cases.json",
  );
  if (
    manifest.acceptedCases !== 3 ||
    manifest.caseCount !== 103 ||
    manifest.casesSha256 !== sha256(casesBytes) ||
    manifest.quarantinedCases !== 100 ||
    manifest.schemaVersion !== "1.0.0" ||
    manifest.synthetic !== true
  )
    invalidReview();

  const expectedFiles = [
    "packages/filing-parser/acceptance/python-image.json",
    "packages/filing-parser/src/test-archive-builder.ts",
    "packages/filing-parser/worker/Dockerfile",
    "packages/filing-parser/worker/parser.py",
    "packages/filing-parser/worker/taxonomy-v1.json",
  ] as const;
  if (
    !Array.isArray(manifest.files) ||
    manifest.files.length !== expectedFiles.length
  )
    invalidReview();
  for (let index = 0; index < expectedFiles.length; index += 1) {
    const path = expectedFiles[index];
    const file = exactRecord(manifest.files[index], ["path", "sha256"]);
    if (
      path === undefined ||
      file.path !== path ||
      file.sha256 !== sha256(requiredSource(sources, path))
    )
      invalidReview();
  }

  const casesDocument = exactRecord(parseExactJson(casesBytes), [
    "cases",
    "schemaVersion",
    "synthetic",
  ]);
  if (
    casesDocument.schemaVersion !== "1.0.0" ||
    casesDocument.synthetic !== true ||
    !Array.isArray(casesDocument.cases) ||
    casesDocument.cases.length !== 103 ||
    evidence.caseOutcomes.length !== 103
  )
    invalidReview();
  const ids = new Set<string>();
  let accepted = 0;
  let quarantined = 0;
  for (let index = 0; index < casesDocument.cases.length; index += 1) {
    const fixtureCase = exactRecord(casesDocument.cases[index], [
      "archiveSha256",
      "expected",
      "id",
    ]);
    const id = stringMatching(fixtureCase.id, /^[a-z][a-z0-9_]{2,79}$/u);
    const archiveSha256 = stringMatching(
      fixtureCase.archiveSha256,
      SHA256,
    ) as `sha256:${string}`;
    if (ids.has(id)) invalidReview();
    ids.add(id);
    const expected = fixtureCase.expected;
    if (!isRecord(expected)) invalidReview();
    let expectedStatus: "accepted" | "quarantined";
    let expectedCode: string | null;
    if (expected.status === "accepted") {
      exactRecord(expected, ["status"]);
      accepted += 1;
      expectedStatus = "accepted";
      expectedCode = null;
    } else {
      const quarantine = exactRecord(expected, ["code", "status"]);
      if (
        quarantine.status !== "quarantined" ||
        !FILING_PARSER_QUARANTINE_CODES.includes(quarantine.code as never)
      )
        invalidReview();
      quarantined += 1;
      expectedStatus = "quarantined";
      expectedCode = quarantine.code as string;
    }
    const outcome = evidence.caseOutcomes[index];
    if (
      outcome === undefined ||
      outcome.caseId !== id ||
      outcome.sourceSha256 !== archiveSha256 ||
      outcome.expectedStatus !== expectedStatus ||
      outcome.observedStatus !== expectedStatus ||
      outcome.quarantineCode !== expectedCode
    )
      invalidReview();
  }
  if (
    accepted !== 3 ||
    quarantined !== 100 ||
    !ids.has("accepted_canonical") ||
    !ids.has("accepted_exact_replay") ||
    !ids.has("accepted_decimal_boundaries")
  )
    invalidReview();
}

export async function verifyCycle2aCommitBoundary(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2A_BASELINE_REVISION}^{commit}`],
    0,
  );
  await git(
    repositoryPath,
    ["merge-base", "--is-ancestor", CYCLE_2A_BASELINE_REVISION, revision],
    0,
  );
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "-z",
      CYCLE_2A_BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (diff.length % 2 !== 0) invalidReview();
  const diffEntries: Array<{
    readonly path: string;
    readonly status: string;
  }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (
      !isCycle2aCommitDiffEntryAllowed(status, path) &&
      !isCycle2hPreBaselineCumulativeDiffEntry(status, path)
    )
      invalidReview();
    if (status === undefined || path === undefined) invalidReview();
    diffEntries.push(Object.freeze({ path, status }));
  }

  const evidenceNoteTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      ...CYCLE_2C_SUCCESSOR_EVIDENCE_NOTE_TREE,
    ]),
  );
  const evidenceNotePaths = evidenceNoteTreeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (!isCycle2aEvidenceNoteTreeAllowed(evidenceNotePaths)) invalidReview();

  const treeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-parser",
      "fixtures/synthetic/filing-parser/v1",
    ]),
  );
  const paths = treeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (!isCycle2aParserDomainTreeAllowed(paths)) invalidReview();

  const custodyTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-payload-custody",
      "fixtures/synthetic/filing-payload-custody/v1",
    ]),
  );
  const custodyPaths = custodyTreeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (!isCycle2aDisconnectedCustodyTreeAllowed(custodyPaths)) invalidReview();

  const normalizationTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-fact-normalization",
    ]),
  );
  const normalizationPaths = normalizationTreeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (!isCycle2dDisconnectedNormalizationTreeAllowed(normalizationPaths))
    invalidReview();

  const comparisonTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-fact-comparison",
    ]),
  );
  const comparisonPaths = comparisonTreeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (!isCycle2eDisconnectedComparisonTreeAllowed(comparisonPaths))
    invalidReview();

  const qualityMeasurementTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-quality-measurement",
    ]),
  );
  const qualityMeasurementPaths = qualityMeasurementTreeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (
    !isCycle2fDisconnectedQualityMeasurementTreeAllowed(qualityMeasurementPaths)
  )
    invalidReview();

  const qualityPrecommitmentTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-quality-precommitment",
    ]),
  );
  const qualityPrecommitmentPaths = qualityPrecommitmentTreeEntries.map(
    (entry) => {
      const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
      return match?.[1] ?? invalidReview();
    },
  );
  if (
    !isCycle2gDisconnectedQualityPrecommitmentTreeAllowed(
      qualityPrecommitmentPaths,
    )
  )
    invalidReview();

  const cycle2hBaselineDiffPaths = await cycle2hTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2gBaselineDiffPaths = await cycle2gTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2fBaselineDiffPaths = await cycle2fTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  if (
    isCycle2hTransitionRoutingRequired(cycle2hBaselineDiffPaths, diffEntries)
  ) {
    await verifyCycle2hTransition(repositoryPath, revision);
  } else if (
    isCycle2gTransitionRoutingRequired(
      cycle2gBaselineDiffPaths,
      qualityPrecommitmentPaths,
      diffEntries,
    )
  ) {
    await verifyCycle2gTransition(repositoryPath, revision);
  } else if (
    isCycle2fTransitionRoutingRequired(
      cycle2fBaselineDiffPaths,
      qualityMeasurementPaths,
      diffEntries,
    )
  ) {
    await verifyCycle2fTransition(repositoryPath, revision);
  } else if (
    comparisonPaths.length > 0 ||
    diffEntries.some((entry) => CYCLE_2E_MARKER_PATHS.has(entry.path))
  ) {
    await verifyCycle2eTransition(repositoryPath, revision);
  } else if (
    normalizationPaths.length > 0 ||
    diffEntries.some((entry) => CYCLE_2D_MARKER_PATHS.has(entry.path))
  ) {
    await verifyCycle2dTransition(repositoryPath, revision);
  }
}

/** @internal Exported only for exact commit-boundary regression tests. */
export function isCycle2aCommitDiffEntryAllowed(
  status: string | undefined,
  path: string | undefined,
): boolean {
  return (
    (status === "A" || status === "M") &&
    path !== undefined &&
    (CYCLE_2A_DIFF_ALLOWLIST.has(path) || CYCLE_2H_TRANSITION_PATHS.has(path))
  );
}

function isCycle2hPreBaselineCumulativeDiffEntry(
  status: string | undefined,
  path: string | undefined,
): boolean {
  return (
    status === "M" &&
    path !== undefined &&
    CYCLE_2H_PRE_BASELINE_CUMULATIVE_PATHS.has(path)
  );
}

/** @internal Exported only for exact historical-note regression tests. */
export function isCycle2aEvidenceNoteTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2A_LEGACY_EVIDENCE_NOTE_TREE) ||
    exactPathList(paths, CYCLE_2C_SUCCESSOR_EVIDENCE_NOTE_TREE)
  );
}

/** @internal Exported only for exact commit-boundary regression tests. */
export function isCycle2aParserDomainTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    exactPathList(paths, LEGACY_CYCLE_2A_PARSER_DOMAIN_TREE) ||
    exactPathList(paths, SUCCESSOR_COMPATIBLE_CYCLE_2A_PARSER_DOMAIN_TREE)
  );
}

/** @internal Exported only for exact disconnected-successor regression tests. */
export function isCycle2aDisconnectedCustodyTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2C_DISCONNECTED_SUCCESSOR_TREE)
  );
}

/** @internal Exported only for exact disconnected-successor regression tests. */
export function isCycle2dDisconnectedNormalizationTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2D_DISCONNECTED_SUCCESSOR_TREE)
  );
}

/** @internal Exported only for exact disconnected-successor regression tests. */
export function isCycle2eDisconnectedComparisonTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2E_DISCONNECTED_SUCCESSOR_TREE)
  );
}

/** @internal Exported only for exact disconnected-successor regression tests. */
export function isCycle2fDisconnectedQualityMeasurementTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2F_DISCONNECTED_SUCCESSOR_TREE)
  );
}

/** @internal Exported only for exact disconnected-successor regression tests. */
export function isCycle2gDisconnectedQualityPrecommitmentTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2G_DISCONNECTED_SUCCESSOR_TREE)
  );
}

/** @internal Exported only for exact successor-routing regression tests. */
export function isCycle2hBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2H_BASELINE_REVISION;
}

/** @internal Exported only for successor-routing regression tests. */
export function isCycle2hTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
  cumulativeDiffEntries: readonly { readonly path: string }[],
): boolean {
  return (
    cumulativeDiffEntries.some((entry) =>
      CYCLE_2H_MARKER_PATHS.has(entry.path),
    ) ||
    baselineDiffPaths?.some((path) => CYCLE_2H_TRANSITION_PATHS.has(path)) ===
      true
  );
}

/** @internal Exported only for successor-routing regression tests. */
export function isCycle2gTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
  qualityPrecommitmentPaths: readonly string[],
  cumulativeDiffEntries: readonly { readonly path: string }[],
): boolean {
  return (
    qualityPrecommitmentPaths.length > 0 ||
    cumulativeDiffEntries.some((entry) =>
      CYCLE_2G_MARKER_PATHS.has(entry.path),
    ) ||
    baselineDiffPaths?.some((path) => CYCLE_2G_TRANSITION_PATHS.has(path)) ===
      true
  );
}

/** @internal Exported only for successor-routing regression tests. */
export function isCycle2fTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
  qualityMeasurementPaths: readonly string[],
  cumulativeDiffEntries: readonly { readonly path: string }[],
): boolean {
  return (
    qualityMeasurementPaths.length > 0 ||
    cumulativeDiffEntries.some((entry) =>
      CYCLE_2F_MARKER_PATHS.has(entry.path),
    ) ||
    baselineDiffPaths?.some((path) => CYCLE_2F_TRANSITION_PATHS.has(path)) ===
      true
  );
}

/** @internal Exported only for exact successor-diff regression tests. */
export function isCycle2dCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const sorted = [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  return (
    sorted.length === CYCLE_2D_TRANSITION.length &&
    sorted.every((entry, index) => {
      const expected = CYCLE_2D_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exported only for exact successor-diff regression tests. */
export function isCycle2eCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const sorted = [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  return (
    sorted.length === CYCLE_2E_TRANSITION.length &&
    sorted.every((entry, index) => {
      const expected = CYCLE_2E_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exported only for exact successor-diff regression tests. */
export function isCycle2fCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const sorted = [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  return (
    sorted.length === CYCLE_2F_TRANSITION.length &&
    sorted.every((entry, index) => {
      const expected = CYCLE_2F_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exported only for exact successor-diff regression tests. */
export function isCycle2gCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const sorted = [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  return (
    sorted.length === CYCLE_2G_TRANSITION.length &&
    sorted.every((entry, index) => {
      const expected = CYCLE_2G_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exported only for exact successor-diff regression tests. */
export function isCycle2hCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const sorted = [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  return (
    sorted.length === CYCLE_2H_TRANSITION.length &&
    sorted.every((entry, index) => {
      const expected = CYCLE_2H_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

async function cycle2hTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2H_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2hBaselineMergeBaseAllowed(mergeBase)) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2H_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2H_TRANSITION.map((entry) => entry.path),
    ]),
  );
}

async function cycle2gTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2G_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (mergeBase !== CYCLE_2G_BASELINE_REVISION) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2G_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2G_TRANSITION.map((entry) => entry.path),
    ]),
  );
}

async function cycle2fTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2F_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (mergeBase !== CYCLE_2F_BASELINE_REVISION) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2F_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2F_TRANSITION.map((entry) => entry.path),
    ]),
  );
}

async function verifyCycle2dTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2D_BASELINE_REVISION}^{commit}`],
    0,
  );
  await git(
    repositoryPath,
    ["merge-base", "--is-ancestor", CYCLE_2D_BASELINE_REVISION, revision],
    0,
  );
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "-z",
      CYCLE_2D_BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (diff.length % 2 !== 0) invalidReview();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalidReview();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2dCommitDiffSetAllowed(entries)) invalidReview();
}

async function verifyCycle2eTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2E_BASELINE_REVISION}^{commit}`],
    0,
  );
  await git(
    repositoryPath,
    ["merge-base", "--is-ancestor", CYCLE_2E_BASELINE_REVISION, revision],
    0,
  );
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "-z",
      CYCLE_2E_BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (diff.length % 2 !== 0) invalidReview();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalidReview();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2eCommitDiffSetAllowed(entries)) invalidReview();
}

async function verifyCycle2fTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2F_BASELINE_REVISION}^{commit}`],
    0,
  );
  await git(
    repositoryPath,
    ["merge-base", "--is-ancestor", CYCLE_2F_BASELINE_REVISION, revision],
    0,
  );
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "-z",
      CYCLE_2F_BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (diff.length % 2 !== 0) invalidReview();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalidReview();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2fCommitDiffSetAllowed(entries)) invalidReview();
}

async function verifyCycle2gTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2G_BASELINE_REVISION}^{commit}`],
    0,
  );
  await git(
    repositoryPath,
    ["merge-base", "--is-ancestor", CYCLE_2G_BASELINE_REVISION, revision],
    0,
  );
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "-z",
      CYCLE_2G_BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (diff.length % 2 !== 0) invalidReview();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalidReview();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2gCommitDiffSetAllowed(entries)) invalidReview();
}

async function verifyCycle2hTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2H_BASELINE_REVISION}^{commit}`],
    0,
  );
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2H_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2hBaselineMergeBaseAllowed(mergeBase)) invalidReview();
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      CYCLE_2H_BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (diff.length % 2 !== 0) invalidReview();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalidReview();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2hCommitDiffSetAllowed(entries)) invalidReview();
}

function exactPathList(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((path, index) => path === expected[index])
  );
}

function validateOptions(options: FilingParserEvidenceReviewOptions): void {
  if (
    typeof options !== "object" ||
    options === null ||
    typeof options.evidencePath !== "string" ||
    options.evidencePath.length === 0 ||
    typeof options.repositoryPath !== "string" ||
    options.repositoryPath.length === 0 ||
    !SHA256.test(options.expectedEvidenceSha256) ||
    !REPOSITORY.test(options.expectedRepository) ||
    !COMMIT_SHA.test(options.expectedRevision) ||
    !RUN_ID.test(options.expectedRunId) ||
    !Number.isSafeInteger(options.expectedRunAttempt) ||
    options.expectedRunAttempt < 1
  )
    invalidReview();
}

async function readSmallRegularFile(
  path: string,
  maximumBytes: number,
): Promise<Uint8Array> {
  const stat = await lstat(path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size < 2 ||
    stat.size > maximumBytes
  )
    invalidReview();
  return Uint8Array.from(await readFile(path));
}

function requiredSource(
  sources: ReadonlyMap<string, Uint8Array>,
  path: string,
): Uint8Array {
  const value = sources.get(path);
  return value ?? invalidReview();
}

function parseExactJson(bytes: Uint8Array): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value = JSON.parse(text) as unknown;
    if (`${JSON.stringify(value, null, 2)}\n` !== text) invalidReview();
    return value;
  } catch {
    return invalidReview();
  }
}

function exactRecord<const TKeys extends readonly string[]>(
  value: unknown,
  keys: TKeys,
): Readonly<Record<TKeys[number], unknown>> {
  if (!isRecord(value)) invalidReview();
  const actual = Object.keys(value);
  if (
    actual.length !== keys.length ||
    actual.some((key) => !keys.includes(key))
  )
    invalidReview();
  return value as Readonly<Record<TKeys[number], unknown>>;
}

function stringMatching(value: unknown, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) invalidReview();
  return value;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) invalidReview();
    return String(value);
  }
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (!isRecord(value)) invalidReview();
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function splitNul(value: Uint8Array): string[] {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    return invalidReview();
  }
  if (text.length === 0) return [];
  if (!text.endsWith("\u0000")) return invalidReview();
  return text.slice(0, -1).split("\u0000");
}

function decodeGitRevisionLine(value: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    return invalidReview();
  }
  if (!/^[0-9a-f]{40}\n$/u.test(text)) invalidReview();
  return text.slice(0, -1);
}

function git(
  repositoryPath: string,
  args: readonly string[],
  maximumOutputBytes = MAX_GIT_BLOB_BYTES,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["-C", repositoryPath, ...args], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let failed = false;
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > maximumOutputBytes) {
        failed = true;
        child.kill("SIGKILL");
        return;
      }
      stdout.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > 16_384) {
        failed = true;
        child.kill("SIGKILL");
      }
    });
    child.on("error", () =>
      reject(new Error("Offline evidence review failed.")),
    );
    child.on("close", (code) => {
      if (failed || code !== 0 || stderrBytes !== 0) {
        reject(new Error("Offline evidence review failed."));
        return;
      }
      resolve(Uint8Array.from(Buffer.concat(stdout)));
    });
  });
}

function invalidReview(): never {
  throw new Error("Offline evidence review failed.");
}
