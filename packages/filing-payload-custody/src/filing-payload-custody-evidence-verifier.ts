import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";

import {
  FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS,
  filingPayloadCustodyEvidenceSha256,
  parseCanonicalFilingPayloadCustodyEvidence,
  type FilingPayloadCustodyEvidence,
} from "./filing-payload-custody-evidence";

const BASELINE_REVISION = "ba97f43c10f7472151d4cd073c93904f04b1fdcf" as const;
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
const FASTIFY_5_12_1_MAINTENANCE_BASELINE_REVISION =
  "0521bc8a1b0c3ba15d5ffc16fc74e45252bd9efd" as const;
const CI_TEST_SERIALIZATION_BASELINE_REVISION =
  "c7c427d304cd1df0037a96b53202c1c191d06a3a" as const;
const MAX_EVIDENCE_BYTES = 1_048_576;
const MAX_GIT_BYTES = 4_194_304;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u;
const RUN_ID = /^[1-9][0-9]{0,19}$/u;
const CYCLE_2C_EVIDENCE_NOTE_PATH =
  "docs/FILING_PAYLOAD_CUSTODY_EVIDENCE.md" as const;
const CYCLE_2D_PACKAGE_TREE = Object.freeze(
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
const CYCLE_2E_PACKAGE_TREE = Object.freeze(
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
const CYCLE_2F_PACKAGE_TREE = Object.freeze(
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
const CYCLE_2G_PACKAGE_TREE = Object.freeze(
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
const FASTIFY_5_12_1_MAINTENANCE_TRANSITION = Object.freeze(
  [
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CI_TEST_SERIALIZATION_TRANSITION = Object.freeze(
  [
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2H_PRE_BASELINE_CUMULATIVE_PATHS = Object.freeze([
  "packages/db/tests/postgres-acceptance-evidence-review.test.ts",
]);
const CYCLE_2D_TRANSITION_PATHS = new Set(
  CYCLE_2D_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2E_TRANSITION_PATHS = new Set(
  CYCLE_2E_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2F_TRANSITION_PATHS = new Set(
  CYCLE_2F_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2G_TRANSITION_PATHS = new Set(
  CYCLE_2G_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2H_TRANSITION_PATHS = new Set(
  CYCLE_2H_TRANSITION.map((entry) => entry.path),
);
const FASTIFY_5_12_1_MAINTENANCE_TRANSITION_PATHS = new Set(
  FASTIFY_5_12_1_MAINTENANCE_TRANSITION.map((entry) => entry.path),
);
const FASTIFY_5_12_1_MAINTENANCE_MARKER_PATHS = new Set([
  "apps/api/package.json",
]);
const CI_TEST_SERIALIZATION_SURFACE_PATHS = new Set(["package.json"]);
const CYCLE_2F_MARKER_PATHS = new Set([
  "docs/CYCLE_2F_EXIT_MATRIX.md",
  "docs/adr/0033-bounded-synthetic-declared-reference-quality-measurement.md",
  ...CYCLE_2F_PACKAGE_TREE,
]);
const CYCLE_2G_MARKER_PATHS = new Set([
  "docs/CYCLE_2G_EXIT_MATRIX.md",
  "docs/adr/0034-bounded-synthetic-declared-reference-precommitment.md",
  ...CYCLE_2G_PACKAGE_TREE,
]);
const CYCLE_2H_MARKER_PATHS = new Set([
  "docs/CYCLE_2H_EXIT_MATRIX.md",
  "docs/adr/0035-cross-boundary-intrinsic-byte-snapshot-hardening.md",
  ...CYCLE_2H_PRE_BASELINE_CUMULATIVE_PATHS,
]);

const CYCLE_2C_DIFF_ALLOWLIST = new Set([
  ".github/workflows/filing-payload-custody-acceptance.yml",
  "LICENSE_POLICY.md",
  "README.md",
  "docs/BUILD_ROADMAP.md",
  "docs/CANONICAL_MODEL.md",
  "docs/CYCLE_2C_EXIT_MATRIX.md",
  CYCLE_2C_EVIDENCE_NOTE_PATH,
  "docs/THREAT_MODEL.md",
  "docs/adr/0030-bounded-synthetic-filing-payload-custody.md",
  "fixtures/synthetic/filing-payload-custody/v1/cases.json",
  "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
  "package.json",
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-parser/src/parser-boundary.test.ts",
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
  "pnpm-lock.yaml",
  "scripts/verify-boundaries.ts",
  "scripts/verify-filing-payload-custody-fixtures.ts",
]);
const CYCLE_2C_DIFF_PATHS = Object.freeze([...CYCLE_2C_DIFF_ALLOWLIST].sort());
const CYCLE_2C_LEGACY_DIFF_PATHS = Object.freeze(
  CYCLE_2C_DIFF_PATHS.filter((path) => path !== CYCLE_2C_EVIDENCE_NOTE_PATH),
);
const CYCLE_2D_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2C_DIFF_PATHS,
      ...CYCLE_2D_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);
const CYCLE_2E_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2D_CUMULATIVE_DIFF_PATHS,
      ...CYCLE_2E_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);
const CYCLE_2F_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2E_CUMULATIVE_DIFF_PATHS,
      ...CYCLE_2F_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);
const CYCLE_2G_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2F_CUMULATIVE_DIFF_PATHS,
      ...CYCLE_2G_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);
const CYCLE_2H_BASELINE_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2G_CUMULATIVE_DIFF_PATHS,
      ...CYCLE_2H_PRE_BASELINE_CUMULATIVE_PATHS,
    ]),
  ].sort(),
);
const CYCLE_2H_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2H_BASELINE_CUMULATIVE_DIFF_PATHS,
      ...CYCLE_2H_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);
const FASTIFY_5_12_1_MAINTENANCE_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2H_CUMULATIVE_DIFF_PATHS,
      ...FASTIFY_5_12_1_MAINTENANCE_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);

const EXPECTED_PACKAGE_TREE = [...CYCLE_2C_DIFF_ALLOWLIST]
  .filter((path) => path.startsWith("packages/filing-payload-custody/"))
  .sort();
const EXPECTED_FIXTURE_TREE = [...CYCLE_2C_DIFF_ALLOWLIST]
  .filter((path) =>
    path.startsWith("fixtures/synthetic/filing-payload-custody/v1/"),
  )
  .sort();
const EXPECTED_MANIFEST_FILES = [
  "packages/filing-payload-custody/src/payload-custody-security.test.ts",
  "packages/filing-payload-custody/src/payload-custody.test.ts",
  "packages/filing-payload-custody/src/payload-custody.ts",
  "packages/filing-payload-custody/src/test-payload-builder.ts",
] as const;

export interface FilingPayloadCustodyEvidenceReviewOptions {
  readonly evidencePath: string;
  readonly expectedEvidenceSha256: `sha256:${string}`;
  readonly expectedRepository: string;
  readonly expectedRevision: string;
  readonly expectedRunAttempt: number;
  readonly expectedRunId: string;
  readonly repositoryPath: string;
}

export interface FilingPayloadCustodyEvidenceReview {
  readonly evidenceSha256: `sha256:${string}`;
  readonly recordedChecksPassed: FilingPayloadCustodyEvidence["checksPassed"];
  readonly recordedNotProven: FilingPayloadCustodyEvidence["notProven"];
  readonly repository: string;
  readonly revision: string;
  readonly runAttempt: number;
  readonly runId: string;
  readonly sourceHashCount: number;
  readonly verdict: "offline_consistent";
}

export async function verifyFilingPayloadCustodyEvidenceOffline(
  options: FilingPayloadCustodyEvidenceReviewOptions,
): Promise<FilingPayloadCustodyEvidenceReview> {
  try {
    const normalizedOptions = normalizeOptions(options);
    const evidenceBytes = await readSmallRegularFile(
      normalizedOptions.evidencePath,
      MAX_EVIDENCE_BYTES,
    );
    const evidence = parseCanonicalFilingPayloadCustodyEvidence(evidenceBytes);
    const evidenceSha256 = filingPayloadCustodyEvidenceSha256(evidence);
    if (
      evidenceSha256 !== normalizedOptions.expectedEvidenceSha256 ||
      evidence.repository !== normalizedOptions.expectedRepository ||
      evidence.revision !== normalizedOptions.expectedRevision ||
      evidence.workflow.runAttempt !== normalizedOptions.expectedRunAttempt ||
      evidence.workflow.runId !== normalizedOptions.expectedRunId
    )
      invalid();

    const repositoryPath = await realpath(normalizedOptions.repositoryPath);
    const repository = await lstat(repositoryPath);
    if (!repository.isDirectory() || repository.isSymbolicLink()) invalid();
    await git(
      repositoryPath,
      ["cat-file", "-e", `${normalizedOptions.expectedRevision}^{commit}`],
      0,
    );
    await verifyCycle2cCommitBoundary(
      repositoryPath,
      normalizedOptions.expectedRevision,
    );

    const committed = new Map<string, Uint8Array>();
    for (
      let index = 0;
      index < FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS.length;
      index += 1
    ) {
      const path = FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS[index];
      const recorded = evidence.sourceHashes[index];
      if (
        path === undefined ||
        recorded === undefined ||
        recorded.path !== path
      )
        invalid();
      const bytes = await git(repositoryPath, [
        "show",
        `${normalizedOptions.expectedRevision}:${path}`,
      ]);
      if (sha256(bytes) !== recorded.sha256) invalid();
      committed.set(path, bytes);
    }

    const manifestBytes = required(
      committed,
      "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
    );
    if (sha256(manifestBytes) !== evidence.fixtureManifestSha256) invalid();
    verifyFixtureChain(committed, manifestBytes, evidence.sourceHashes);

    return Object.freeze({
      evidenceSha256,
      recordedChecksPassed: evidence.checksPassed,
      recordedNotProven: evidence.notProven,
      repository: evidence.repository,
      revision: evidence.revision,
      runAttempt: evidence.workflow.runAttempt,
      runId: evidence.workflow.runId,
      sourceHashCount: evidence.sourceHashes.length,
      verdict: "offline_consistent",
    });
  } catch {
    return invalid();
  }
}

export async function verifyCycle2cCommitBoundary(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${BASELINE_REVISION}^{commit}`],
    0,
  );
  await git(
    repositoryPath,
    ["merge-base", "--is-ancestor", BASELINE_REVISION, revision],
    0,
  );
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "-z",
      BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2cCommitDiffSetAllowed(entries)) invalid();
  const packageTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-payload-custody",
  );
  const fixtureTree = await tree(
    repositoryPath,
    revision,
    "fixtures/synthetic/filing-payload-custody/v1",
  );
  const normalizationTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-fact-normalization",
  );
  const comparisonTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-fact-comparison",
  );
  const qualityMeasurementTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-quality-measurement",
  );
  const qualityPrecommitmentTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-quality-precommitment",
  );
  if (
    !exactList(packageTree, EXPECTED_PACKAGE_TREE) ||
    !exactList(fixtureTree, EXPECTED_FIXTURE_TREE) ||
    !isCycle2dNormalizationTreeAllowed(normalizationTree) ||
    !isCycle2eComparisonTreeAllowed(comparisonTree) ||
    !isCycle2fQualityMeasurementTreeAllowed(qualityMeasurementTree) ||
    !isCycle2gQualityPrecommitmentTreeAllowed(qualityPrecommitmentTree)
  )
    invalid();
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
  const ciTestSerializationSurfaceDiffPaths =
    await ciTestSerializationTransitionSurfaceDiffPaths(
      repositoryPath,
      revision,
    );
  if (
    isCiTestSerializationSurfaceRoutingRequired(
      ciTestSerializationSurfaceDiffPaths,
    )
  )
    await verifyCiTestSerializationTransition(repositoryPath, revision);
  else if (isFastify5121MaintenanceTransitionRoutingRequired(entries))
    await verifyFastify5121MaintenanceTransition(repositoryPath, revision);
  else if (
    isCycle2hTransitionRoutingRequired(cycle2hBaselineDiffPaths, entries)
  )
    await verifyCycle2hTransition(repositoryPath, revision);
  else if (
    isCycle2gTransitionRoutingRequired(
      cycle2gBaselineDiffPaths,
      qualityPrecommitmentTree,
      entries,
    )
  )
    await verifyCycle2gTransition(repositoryPath, revision);
  else if (
    isCycle2fTransitionRoutingRequired(
      cycle2fBaselineDiffPaths,
      qualityMeasurementTree,
      entries,
    )
  )
    await verifyCycle2fTransition(repositoryPath, revision);
  else if (comparisonTree.length > 0)
    await verifyCycle2eTransition(repositoryPath, revision);
  else if (normalizationTree.length > 0)
    await verifyCycle2dTransition(repositoryPath, revision);
}

/** @internal Exact commit-boundary regression seam. */
export function isCycle2cCommitDiffEntryAllowed(
  status: string | undefined,
  path: string | undefined,
): boolean {
  return (
    (status === "A" || status === "M") &&
    path !== undefined &&
    (CYCLE_2C_DIFF_ALLOWLIST.has(path) ||
      CYCLE_2D_TRANSITION_PATHS.has(path) ||
      CYCLE_2E_TRANSITION_PATHS.has(path) ||
      CYCLE_2F_TRANSITION_PATHS.has(path) ||
      CYCLE_2G_TRANSITION_PATHS.has(path) ||
      CYCLE_2H_TRANSITION_PATHS.has(path) ||
      FASTIFY_5_12_1_MAINTENANCE_TRANSITION_PATHS.has(path))
  );
}

/** @internal Exact cumulative milestone-diff regression seam. */
export function isCycle2cCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const paths = entries.map((entry) => entry.path).sort();
  return (
    entries.every(
      (entry) =>
        isCycle2cCommitDiffEntryAllowed(entry.status, entry.path) ||
        isCycle2hPreBaselineCumulativeDiffEntry(entry.status, entry.path),
    ) &&
    (exactList(paths, CYCLE_2C_LEGACY_DIFF_PATHS) ||
      exactList(paths, CYCLE_2C_DIFF_PATHS) ||
      exactList(paths, CYCLE_2D_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2E_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2F_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2G_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2H_BASELINE_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2H_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, FASTIFY_5_12_1_MAINTENANCE_CUMULATIVE_DIFF_PATHS))
  );
}

function isCycle2hPreBaselineCumulativeDiffEntry(
  status: string | undefined,
  path: string | undefined,
): boolean {
  return (
    status === "M" &&
    path !== undefined &&
    CYCLE_2H_PRE_BASELINE_CUMULATIVE_PATHS.includes(path)
  );
}

/** @internal Exact package/fixture tree regression seam. */
export function isCycle2cTreeAllowed(
  packagePaths: readonly string[],
  fixturePaths: readonly string[],
): boolean {
  return (
    exactList(packagePaths, EXPECTED_PACKAGE_TREE) &&
    exactList(fixturePaths, EXPECTED_FIXTURE_TREE)
  );
}

/** @internal Exact disconnected-successor tree regression seam. */
export function isCycle2dNormalizationTreeAllowed(
  paths: readonly string[],
): boolean {
  return paths.length === 0 || exactList(paths, CYCLE_2D_PACKAGE_TREE);
}

/** @internal Exact disconnected-successor tree regression seam. */
export function isCycle2eComparisonTreeAllowed(
  paths: readonly string[],
): boolean {
  return paths.length === 0 || exactList(paths, CYCLE_2E_PACKAGE_TREE);
}

/** @internal Exact disconnected-successor tree regression seam. */
export function isCycle2fQualityMeasurementTreeAllowed(
  paths: readonly string[],
): boolean {
  return paths.length === 0 || exactList(paths, CYCLE_2F_PACKAGE_TREE);
}

/** @internal Exact disconnected-successor tree regression seam. */
export function isCycle2gQualityPrecommitmentTreeAllowed(
  paths: readonly string[],
): boolean {
  return paths.length === 0 || exactList(paths, CYCLE_2G_PACKAGE_TREE);
}

/** @internal Exact successor-routing regression seam. */
export function isCycle2hBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2H_BASELINE_REVISION;
}

/** @internal Exact maintenance-successor routing regression seam. */
export function isFastify5121MaintenanceBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === FASTIFY_5_12_1_MAINTENANCE_BASELINE_REVISION;
}

/** @internal Exact CI-test-serialization successor routing regression seam. */
export function isCiTestSerializationBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CI_TEST_SERIALIZATION_BASELINE_REVISION;
}

/** @internal Exact CI-test-serialization successor routing regression seam. */
export function isCiTestSerializationSurfaceRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    exactList(
      baselineDiffPaths,
      [...CI_TEST_SERIALIZATION_SURFACE_PATHS].sort(),
    )
  );
}

/** @internal Exact maintenance-successor routing regression seam. */
export function isFastify5121MaintenanceTransitionRoutingRequired(
  cumulativeDiffEntries: readonly { readonly path: string }[],
): boolean {
  return cumulativeDiffEntries.some((entry) =>
    FASTIFY_5_12_1_MAINTENANCE_MARKER_PATHS.has(entry.path),
  );
}

/** @internal Exact successor-routing regression seam. */
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

/** @internal Exact successor-routing regression seam. */
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

/** @internal Exact successor-routing regression seam. */
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

/** @internal Exact successor-transition regression seam. */
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

/** @internal Exact successor-transition regression seam. */
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

/** @internal Exact successor-transition regression seam. */
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

/** @internal Exact successor-transition regression seam. */
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

/** @internal Exact successor-transition regression seam. */
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

/** @internal Exact maintenance-successor regression seam. */
export function isFastify5121MaintenanceCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const sorted = [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  return (
    sorted.length === FASTIFY_5_12_1_MAINTENANCE_TRANSITION.length &&
    sorted.every((entry, index) => {
      const expected = FASTIFY_5_12_1_MAINTENANCE_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exact CI-test-serialization successor regression seam. */
export function isCiTestSerializationCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const sorted = [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  return (
    sorted.length === CI_TEST_SERIALIZATION_TRANSITION.length &&
    sorted.every((entry, index) => {
      const expected = CI_TEST_SERIALIZATION_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

async function ciTestSerializationTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(repositoryPath, [
      "merge-base",
      CI_TEST_SERIALIZATION_BASELINE_REVISION,
      revision,
    ]),
  );
  if (!isCiTestSerializationBaselineMergeBaseAllowed(mergeBase))
    return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CI_TEST_SERIALIZATION_BASELINE_REVISION,
      revision,
      "--",
      ...CI_TEST_SERIALIZATION_SURFACE_PATHS,
    ]),
  );
}

async function cycle2hTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(repositoryPath, [
      "merge-base",
      CYCLE_2H_BASELINE_REVISION,
      revision,
    ]),
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
    await git(repositoryPath, [
      "merge-base",
      CYCLE_2G_BASELINE_REVISION,
      revision,
    ]),
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
    await git(repositoryPath, [
      "merge-base",
      CYCLE_2F_BASELINE_REVISION,
      revision,
    ]),
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2dCommitDiffSetAllowed(entries)) invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2eCommitDiffSetAllowed(entries)) invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2fCommitDiffSetAllowed(entries)) invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2gCommitDiffSetAllowed(entries)) invalid();
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
    await git(repositoryPath, [
      "merge-base",
      CYCLE_2H_BASELINE_REVISION,
      revision,
    ]),
  );
  if (!isCycle2hBaselineMergeBaseAllowed(mergeBase)) invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2hCommitDiffSetAllowed(entries)) invalid();
}

async function verifyFastify5121MaintenanceTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    [
      "cat-file",
      "-e",
      `${FASTIFY_5_12_1_MAINTENANCE_BASELINE_REVISION}^{commit}`,
    ],
    0,
  );
  const mergeBase = decodeGitRevisionLine(
    await git(repositoryPath, [
      "merge-base",
      FASTIFY_5_12_1_MAINTENANCE_BASELINE_REVISION,
      revision,
    ]),
  );
  if (!isFastify5121MaintenanceBaselineMergeBaseAllowed(mergeBase)) invalid();
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      FASTIFY_5_12_1_MAINTENANCE_BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isFastify5121MaintenanceCommitDiffSetAllowed(entries)) invalid();
}

async function verifyCiTestSerializationTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CI_TEST_SERIALIZATION_BASELINE_REVISION}^{commit}`],
    0,
  );
  const mergeBase = decodeGitRevisionLine(
    await git(repositoryPath, [
      "merge-base",
      CI_TEST_SERIALIZATION_BASELINE_REVISION,
      revision,
    ]),
  );
  if (!isCiTestSerializationBaselineMergeBaseAllowed(mergeBase)) invalid();
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      CI_TEST_SERIALIZATION_BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCiTestSerializationCommitDiffSetAllowed(entries)) invalid();
}

/** @internal Strict NUL-framed Git output regression seam. */
export function decodeCycle2cGitNulList(bytes: Uint8Array): readonly string[] {
  return Object.freeze(splitNul(bytes));
}

function verifyFixtureChain(
  sources: ReadonlyMap<string, Uint8Array>,
  manifestBytes: Uint8Array,
  sourceHashes: readonly { readonly path: string; readonly sha256: string }[],
): void {
  const manifest = parseExactJson(manifestBytes);
  if (
    !isExactRecord(manifest, [
      "caseCount",
      "casesSha256",
      "files",
      "schemaVersion",
      "synthetic",
    ])
  )
    invalid();
  if (
    manifest.caseCount !== 1 ||
    manifest.schemaVersion !== "1.0.0" ||
    manifest.synthetic !== true
  )
    invalid();
  const manifestFiles = unknownArray(manifest.files);
  const cases = required(
    sources,
    "fixtures/synthetic/filing-payload-custody/v1/cases.json",
  );
  if (manifest.casesSha256 !== sha256(cases)) invalid();
  const caseDocument = parseExactJson(cases);
  if (!isExactRecord(caseDocument, ["cases", "schemaVersion", "synthetic"]))
    invalid();
  if (
    caseDocument.schemaVersion !== "1.0.0" ||
    caseDocument.synthetic !== true ||
    !Array.isArray(caseDocument.cases) ||
    caseDocument.cases.length !== 1 ||
    canonicalJson(caseDocument.cases[0]) !==
      '{"expected":{"status":"passed"},"id":"single_generated_payload_lifecycle"}'
  )
    invalid();
  if (manifestFiles.length !== EXPECTED_MANIFEST_FILES.length) invalid();
  for (let index = 0; index < EXPECTED_MANIFEST_FILES.length; index += 1) {
    const path = EXPECTED_MANIFEST_FILES[index];
    const entry = manifestFiles[index];
    if (
      path === undefined ||
      !isExactRecord(entry, ["path", "sha256"]) ||
      entry.path !== path ||
      entry.sha256 !== sha256(required(sources, path)) ||
      sourceHashes.find((source) => source.path === path)?.sha256 !==
        entry.sha256
    )
      invalid();
  }
}

function normalizeOptions(
  options: FilingPayloadCustodyEvidenceReviewOptions,
): FilingPayloadCustodyEvidenceReviewOptions {
  const keys = [
    "evidencePath",
    "expectedEvidenceSha256",
    "expectedRepository",
    "expectedRevision",
    "expectedRunAttempt",
    "expectedRunId",
    "repositoryPath",
  ] as const;
  if (
    typeof options !== "object" ||
    options === null ||
    Object.getPrototypeOf(options) !== Object.prototype ||
    !exactList(
      Reflect.ownKeys(options)
        .map((key) => (typeof key === "string" ? key : invalid()))
        .sort(),
      [...keys].sort(),
    )
  )
    invalid();
  const descriptors = Object.getOwnPropertyDescriptors(options);
  if (
    keys.some((key) => {
      const descriptor = descriptors[key];
      return (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      );
    })
  )
    invalid();
  const values = Object.fromEntries(
    keys.map((key) => [key, descriptors[key]?.value]),
  ) as Record<(typeof keys)[number], unknown>;
  if (
    typeof values.evidencePath !== "string" ||
    values.evidencePath.length === 0 ||
    typeof values.repositoryPath !== "string" ||
    values.repositoryPath.length === 0 ||
    typeof values.expectedEvidenceSha256 !== "string" ||
    !SHA256.test(values.expectedEvidenceSha256) ||
    typeof values.expectedRepository !== "string" ||
    !REPOSITORY.test(values.expectedRepository) ||
    typeof values.expectedRevision !== "string" ||
    !COMMIT.test(values.expectedRevision) ||
    typeof values.expectedRunId !== "string" ||
    !RUN_ID.test(values.expectedRunId) ||
    !Number.isSafeInteger(values.expectedRunAttempt) ||
    (values.expectedRunAttempt as number) < 1
  )
    invalid();
  return Object.freeze({
    evidencePath: values.evidencePath,
    expectedEvidenceSha256: values.expectedEvidenceSha256 as `sha256:${string}`,
    expectedRepository: values.expectedRepository,
    expectedRevision: values.expectedRevision,
    expectedRunAttempt: values.expectedRunAttempt as number,
    expectedRunId: values.expectedRunId,
    repositoryPath: values.repositoryPath,
  });
}

async function tree(
  repositoryPath: string,
  revision: string,
  path: string,
): Promise<string[]> {
  return splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      path,
    ]),
  ).map(
    (entry) =>
      /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry)?.[1] ?? invalid(),
  );
}

async function readSmallRegularFile(
  path: string,
  limit: number,
): Promise<Uint8Array> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size < 1 || before.size > limit) invalid();
    const bounded = Buffer.alloc(before.size + 1);
    let offset = 0;
    while (offset < bounded.byteLength) {
      const { bytesRead } = await handle.read(
        bounded,
        offset,
        bounded.byteLength - offset,
        offset,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await handle.stat();
    if (
      offset !== before.size ||
      after.size !== before.size ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs
    )
      invalid();
    return new Uint8Array(bounded.subarray(0, offset));
  } finally {
    await handle.close();
  }
}

async function git(
  cwd: string,
  args: readonly string[],
  expectedExit = 0,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > MAX_GIT_BYTES) child.kill();
      else target.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== expectedExit || bytes > MAX_GIT_BYTES || stderr.length > 0)
        reject(new Error("git failed"));
      else resolve(new Uint8Array(Buffer.concat(stdout)));
    });
  });
}

function required(
  values: ReadonlyMap<string, Uint8Array>,
  path: string,
): Uint8Array {
  return values.get(path) ?? invalid();
}

function parseExactJson(bytes: Uint8Array): unknown {
  let text: string;
  let value: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
    value = JSON.parse(text);
  } catch {
    return invalid();
  }
  if (`${JSON.stringify(value, null, 2)}\n` !== text) invalid();
  return value;
}

function isExactRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
  );
}

function unknownArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? (value as readonly unknown[]) : invalid();
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null) invalid();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function splitNul(bytes: Uint8Array): string[] {
  const text = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  if (text.length === 0) return [];
  if (text.includes("\ufeff") || !text.endsWith("\0")) invalid();
  const entries = text.slice(0, -1).split("\0");
  if (entries.some((entry) => entry.length === 0)) invalid();
  return entries;
}

function decodeGitRevisionLine(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  if (text.includes("\ufeff") || !/^[0-9a-f]{40}\n$/u.test(text)) invalid();
  return text.slice(0, -1);
}

function exactList(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index])
  );
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function invalid(): never {
  throw new Error("Offline filing payload custody evidence review failed.");
}
