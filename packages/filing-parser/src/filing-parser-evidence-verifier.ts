import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import { types as utilTypes } from "node:util";

import {
  FILING_PARSER_EVIDENCE_SOURCE_PATHS,
  filingParserEvidenceSha256,
  parseCanonicalFilingParserEvidence,
  type FilingParserEvidence,
} from "./filing-parser-evidence";
import { FILING_PARSER_QUARANTINE_CODES } from "./parser-boundary";

const MAX_EVIDENCE_BYTES = 1_048_576;
const MAX_GIT_BLOB_BYTES = 4_194_304;
const MAX_GIT_PATH_BYTES = 32_768;
const GIT_TIMEOUT_MILLISECONDS = 30_000;
const isProxy = utilTypes.isProxy;
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
const CYCLE_2K_BASELINE_REVISION =
  "962a00f65835fc6126e4da98e0e0d5998e8d59cc" as const;
const CYCLE_2M_BASELINE_REVISION =
  "1cb7d3ce024cbd29665af7ec4e010da0c380b726" as const;
const CYCLE_2M_SOURCE_REVISION =
  "5d61868e6075865b32640ddaceb845ac9dbc69f3" as const;
const CYCLE_2N_BASELINE_REVISION =
  "09e76235b5683427f2dd3201aefa740bb5adb16e" as const;
const CYCLE_2O_BASELINE_REVISION =
  "711fe866594d5e20a657a24c0a0c72fd78ab90be" as const;
const CYCLE_2O_SOURCE_REVISION =
  "46408ec875755ef531c124846143e9b619c1961f" as const;
const ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION =
  "7243f16df0c4bd8691ff11fa037085e3beb3447e" as const;
const ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION =
  "96b042669edc6cb4a876bb0c061fa5e18732c1ca" as const;
const ADMISSION_VALIDITY_BRIDGE_CORRECTIVE_REVISION =
  "711fe866594d5e20a657a24c0a0c72fd78ab90be" as const;
const CYCLE_2P_BASELINE_REVISION =
  "e21408acf70a28909136cc3eb0c10bbbd48b8266" as const;
const CYCLE_2P_SOURCE_REVISION =
  "bc4b371784711102462ad28a9c9eb7cb567f1072" as const;
const CYCLE_2P_CORPUS_ADMISSION_PATH =
  "packages/filing-parser/src/corpus-admission.ts" as const;
const CYCLE_2P_CORPUS_ADMISSION_BLOB =
  "e456cae97cf9eb377e3b3e8aabc156fdb377e2c7" as const;
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
const CYCLE_2I_HANDOFF_SUCCESSOR_TREE = Object.freeze(
  [
    "packages/filing-parser-normalization-handoff/package.json",
    "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff-security.test.ts",
    "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff.test.ts",
    "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff.ts",
    "packages/filing-parser-normalization-handoff/src/index.ts",
    "packages/filing-parser-normalization-handoff/src/test-filing-parser-normalization-handoff-builder.ts",
    "packages/filing-parser-normalization-handoff/tsconfig.json",
  ].sort(),
);
const CYCLE_2J_EXECUTION_SUCCESSOR_TREE = Object.freeze(
  [
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
  ].sort(),
);
const CYCLE_2J_ACCEPTANCE_SUCCESSOR_TREE = Object.freeze(
  [
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
  ].sort(),
);
const CYCLE_2K_CORE_SUCCESSOR_TREE = Object.freeze(
  [
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
  ].sort(),
);
const CYCLE_2K_ACCEPTANCE_SUCCESSOR_TREE = Object.freeze(
  [
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
  ].sort(),
);
const CYCLE_2M_CORE_SUCCESSOR_TREE = Object.freeze(
  [
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
  ].sort(),
);
const CYCLE_2M_ACCEPTANCE_SUCCESSOR_TREE = Object.freeze([
  ...CYCLE_2K_ACCEPTANCE_SUCCESSOR_TREE,
]);
const CYCLE_2N_COMPOSITION_SUCCESSOR_TREE = Object.freeze(
  [
    "packages/filing-parser-quality-composition/package.json",
    "packages/filing-parser-quality-composition/src/filing-parser-quality-composition-security.test.ts",
    "packages/filing-parser-quality-composition/src/filing-parser-quality-composition.test.ts",
    "packages/filing-parser-quality-composition/src/filing-parser-quality-composition.ts",
    "packages/filing-parser-quality-composition/src/index.ts",
    "packages/filing-parser-quality-composition/src/test-filing-parser-quality-composition-builder.ts",
    "packages/filing-parser-quality-composition/tsconfig.json",
  ].sort(),
);
const CYCLE_2O_COMPOSITION_SUCCESSOR_TREE = Object.freeze(
  [
    "packages/filing-parser-custody-quality-composition/package.json",
    "packages/filing-parser-custody-quality-composition/src/filing-parser-custody-quality-composition-security.test.ts",
    "packages/filing-parser-custody-quality-composition/src/filing-parser-custody-quality-composition.test.ts",
    "packages/filing-parser-custody-quality-composition/src/filing-parser-custody-quality-composition.ts",
    "packages/filing-parser-custody-quality-composition/src/index.ts",
    "packages/filing-parser-custody-quality-composition/src/test-filing-parser-custody-quality-composition-builder.ts",
    "packages/filing-parser-custody-quality-composition/tsconfig.json",
  ].sort(),
);
const CYCLE_2O_CUSTODY_PACKAGE_TREE = Object.freeze(
  [
    ...CYCLE_2C_DISCONNECTED_SUCCESSOR_TREE.filter((path) =>
      path.startsWith("packages/filing-payload-custody/"),
    ),
    "packages/filing-payload-custody/src/parser-archive-pair-custody.test.ts",
    "packages/filing-payload-custody/src/parser-archive-pair-custody.ts",
    "packages/filing-payload-custody/src/parser-archive-pair-fixture.ts",
  ].sort(),
);
const CYCLE_2O_DISCONNECTED_CUSTODY_TREE = Object.freeze(
  [
    ...CYCLE_2C_DISCONNECTED_SUCCESSOR_TREE,
    "packages/filing-payload-custody/src/parser-archive-pair-custody.test.ts",
    "packages/filing-payload-custody/src/parser-archive-pair-custody.ts",
    "packages/filing-payload-custody/src/parser-archive-pair-fixture.ts",
  ].sort(),
);
const CYCLE_2O_ACCEPTANCE_SUCCESSOR_TREE = Object.freeze(
  [
    ...CYCLE_2K_ACCEPTANCE_SUCCESSOR_TREE,
    "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-v5.test.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-v5.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier-v5.test.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier-v5.ts",
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
const OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION = Object.freeze(
  [
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
const AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION = Object.freeze(
  [
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION = Object.freeze(
  [
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2I_TRANSITION = Object.freeze([
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
]);
const CYCLE_2J_TRANSITION = Object.freeze([
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
  ...CYCLE_2J_ACCEPTANCE_SUCCESSOR_TREE.map((path) => ({ path, status: "A" })),
  ...CYCLE_2J_EXECUTION_SUCCESSOR_TREE.map((path) => ({ path, status: "A" })),
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
]);
const CYCLE_2K_TRANSITION = Object.freeze([
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
  ...CYCLE_2K_ACCEPTANCE_SUCCESSOR_TREE.map((path) => ({ path, status: "A" })),
  ...CYCLE_2K_CORE_SUCCESSOR_TREE.map((path) => ({ path, status: "A" })),
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
]);
const CYCLE_2M_TRANSITION = Object.freeze(
  [
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
  ].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  ),
);
const CYCLE_2M_CORRECTIVE_TRANSITION = Object.freeze(
  [
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
  ),
);
const CYCLE_2N_TRANSITION = Object.freeze(
  [
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
    ...CYCLE_2N_COMPOSITION_SUCCESSOR_TREE.map((path) => ({
      path,
      status: "A",
    })),
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
  ),
);
const CYCLE_2O_TRANSITION = Object.freeze(
  [
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
    ...CYCLE_2O_COMPOSITION_SUCCESSOR_TREE.map((path) => ({
      path,
      status: "A",
    })),
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
  ),
);
const CYCLE_2O_CORRECTIVE_TRANSITION = Object.freeze(
  [
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
    .map((path) => Object.freeze({ path, status: "M" })),
);
const ADMISSION_VALIDITY_BRIDGE_SOURCE_TRANSITION = Object.freeze(
  [
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
  ),
);
const ADMISSION_VALIDITY_BRIDGE_CORRECTIVE_TRANSITION = Object.freeze(
  [
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
  ),
);
const ADMISSION_VALIDITY_BRIDGE_TRANSITION = Object.freeze(
  [
    ...ADMISSION_VALIDITY_BRIDGE_SOURCE_TRANSITION,
    ...ADMISSION_VALIDITY_BRIDGE_CORRECTIVE_TRANSITION,
  ].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  ),
);
const CYCLE_2P_SOURCE_TRANSITION = Object.freeze(
  [
    ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    "packages/filing-parser/src/corpus-admission-security.test.ts",
    "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
    "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  ]
    .sort()
    .map((path) => Object.freeze({ path, status: "M" })),
);
const CYCLE_2P_CORRECTIVE_TRANSITION = Object.freeze(
  [
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
    .map((path) => Object.freeze({ path, status: "M" })),
);
const CYCLE_2P_CUMULATIVE_TRANSITION = Object.freeze(
  [
    ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    "packages/filing-parser/src/corpus-admission-security.test.ts",
    "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
    "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
    "packages/filing-payload-custody/src/parser-archive-pair-custody.test.ts",
    "packages/filing-payload-custody/src/parser-archive-pair-custody.ts",
    "scripts/verify-boundaries.ts",
  ]
    .sort()
    .map((path) => Object.freeze({ path, status: "M" })),
);
const CYCLE_2M_PRE_BASELINE_CUMULATIVE_ENTRIES = Object.freeze([
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
]);
const CYCLE_2M_TRANSITION_PATHS = new Set(
  CYCLE_2M_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2N_TRANSITION_PATHS = new Set(
  CYCLE_2N_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2O_TRANSITION_PATHS = new Set(
  CYCLE_2O_TRANSITION.map((entry) => entry.path),
);
const ADMISSION_VALIDITY_BRIDGE_TRANSITION_PATHS = new Set(
  ADMISSION_VALIDITY_BRIDGE_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2P_PROTECTED_SURFACE_PATHS = new Set([
  ...CYCLE_2P_CUMULATIVE_TRANSITION.map((entry) => entry.path),
  CYCLE_2P_CORPUS_ADMISSION_PATH,
]);
const CYCLE_2K_TRANSITION_PATHS = new Set(
  CYCLE_2K_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2J_TRANSITION_PATHS = new Set(
  CYCLE_2J_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2I_TRANSITION_PATHS = new Set(
  CYCLE_2I_TRANSITION.map((entry) => entry.path),
);
const PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION_PATHS = new Set(
  PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.map((entry) => entry.path),
);
const PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS = new Set([
  ".gitignore",
  ".npmrc",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts/verify-boundaries.ts",
]);
const PNPM_DEPENDENCY_POLICY_MAINTENANCE_CUMULATIVE_MARKER_PATHS = new Set([
  ".gitignore",
  ".npmrc",
  "pnpm-workspace.yaml",
]);
const AUTHENTICATED_REPLAY_MAINTENANCE_SURFACE_PATHS = new Set([
  "packages/filing-payload-custody/src/payload-custody.ts",
]);
const OFFLINE_EVIDENCE_INPUT_CUSTODY_SURFACE_PATHS = new Set(
  OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION.map((entry) => entry.path),
);
const CI_TEST_SERIALIZATION_SURFACE_PATHS = new Set(["package.json"]);
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
const FASTIFY_5_12_1_MAINTENANCE_TRANSITION_PATHS = new Set(
  FASTIFY_5_12_1_MAINTENANCE_TRANSITION.map((entry) => entry.path),
);
const FASTIFY_5_12_1_MAINTENANCE_MARKER_PATHS = new Set([
  "apps/api/package.json",
]);
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
  ...FASTIFY_5_12_1_MAINTENANCE_TRANSITION_PATHS,
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
  const normalizedOptions = normalizeFilingParserEvidenceReviewOptions(options);
  const evidenceBytes = await readSmallRegularFile(
    normalizedOptions.evidencePath,
    MAX_EVIDENCE_BYTES,
  );
  const evidence = parseCanonicalFilingParserEvidence(evidenceBytes);
  const evidenceSha256 = filingParserEvidenceSha256(evidence);
  if (
    evidenceSha256 !== normalizedOptions.expectedEvidenceSha256 ||
    evidence.repository !== normalizedOptions.expectedRepository ||
    evidence.revision !== normalizedOptions.expectedRevision ||
    evidence.workflow.runId !== normalizedOptions.expectedRunId ||
    evidence.workflow.runAttempt !== normalizedOptions.expectedRunAttempt
  )
    invalidReview();

  const repositoryPath = await realpath(normalizedOptions.repositoryPath);
  const repositoryStat = await lstat(repositoryPath);
  if (!repositoryStat.isDirectory() || repositoryStat.isSymbolicLink())
    invalidReview();
  await git(
    repositoryPath,
    ["cat-file", "-e", `${normalizedOptions.expectedRevision}^{commit}`],
    0,
  );
  await verifyCycle2aCommitBoundary(
    repositoryPath,
    normalizedOptions.expectedRevision,
  );

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
      `${normalizedOptions.expectedRevision}:${path}`,
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
      `${normalizedOptions.expectedRevision}:${historical.path}`,
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
  await verifyNoEffectiveFilingParserGitGrafts(repositoryPath);
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
      "--no-renames",
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
      !isPnpmDependencyPolicyMaintenanceNpmrcDeletionDiffEntryAllowed(
        status,
        path,
      ) &&
      !isCycle2hPreBaselineCumulativeDiffEntry(status, path) &&
      !isCycle2mPreBaselineCumulativeDiffEntryAllowed(status, path)
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
  if (
    !isCycle2aDisconnectedCustodyTreeAllowed(custodyPaths) &&
    !exactPathList(custodyPaths, CYCLE_2O_DISCONNECTED_CUSTODY_TREE)
  )
    invalidReview();

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

  const handoffTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-parser-normalization-handoff",
    ]),
  );
  const handoffPaths = handoffTreeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (!isCycle2iHandoffTreeAllowed(handoffPaths)) invalidReview();

  const cycle2jExecutionTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-parser-normalization-execution",
    ]),
  );
  const cycle2jExecutionPaths = cycle2jExecutionTreeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (!isCycle2jExecutionTreeAllowed(cycle2jExecutionPaths)) invalidReview();

  const cycle2jAcceptanceTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-parser-normalization-execution-acceptance",
    ]),
  );
  const cycle2jAcceptancePaths = cycle2jAcceptanceTreeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (!isCycle2jAcceptanceTreeAllowed(cycle2jAcceptancePaths)) invalidReview();

  const cycle2kCoreTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-parser-cross-engine-execution",
    ]),
  );
  const cycle2kCorePaths = cycle2kCoreTreeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (
    !isCycle2kCoreTreeAllowed(cycle2kCorePaths) &&
    !isCycle2mCoreTreeAllowed(cycle2kCorePaths)
  )
    invalidReview();

  const cycle2kAcceptanceTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-parser-cross-engine-execution-acceptance",
    ]),
  );
  const cycle2kAcceptancePaths = cycle2kAcceptanceTreeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (
    !isCycle2kAcceptanceTreeAllowed(cycle2kAcceptancePaths) &&
    !isCycle2mAcceptanceTreeAllowed(cycle2kAcceptancePaths) &&
    !isCycle2oAcceptanceTreeAllowed(cycle2kAcceptancePaths)
  )
    invalidReview();

  const cycle2pBaselineDiffPaths = await cycle2pTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const admissionValidityBridgeBaselineDiffPaths =
    await admissionValidityBridgeTransitionSurfaceDiffPaths(
      repositoryPath,
      revision,
    );
  const cycle2mBaselineDiffPaths = await cycle2mTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2kBaselineDiffPaths = await cycle2kTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2jBaselineDiffPaths = await cycle2jTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2iBaselineDiffPaths = await cycle2iTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const pnpmDependencyPolicyMaintenanceSurfaceDiffPaths =
    await pnpmDependencyPolicyMaintenanceTransitionSurfaceDiffPaths(
      repositoryPath,
      revision,
    );
  const authenticatedReplayMaintenanceSurfaceDiffPaths =
    await authenticatedReplayMaintenanceTransitionSurfaceDiffPaths(
      repositoryPath,
      revision,
    );
  const offlineEvidenceInputCustodySurfaceDiffPaths =
    await offlineEvidenceInputCustodyTransitionSurfaceDiffPaths(
      repositoryPath,
      revision,
    );
  const ciTestSerializationSurfaceDiffPaths =
    await ciTestSerializationTransitionSurfaceDiffPaths(
      repositoryPath,
      revision,
    );
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
  const cycle2nDiffPaths = diffEntries.map((entry) => entry.path);
  if (isCycle2pTransitionRoutingRequired(cycle2pBaselineDiffPaths)) {
    await verifyCycle2pTransition(repositoryPath, revision);
  } else if (isCycle2oTransitionRoutingRequired(cycle2nDiffPaths)) {
    await verifyCycle2oTransition(repositoryPath, revision);
  } else if (
    isAdmissionValidityBridgeTransitionRoutingRequired(
      admissionValidityBridgeBaselineDiffPaths,
    )
  ) {
    await verifyAdmissionValidityBridgeTransition(repositoryPath, revision);
  } else if (isCycle2nTransitionRoutingRequired(cycle2nDiffPaths)) {
    await verifyCycle2nTransition(repositoryPath, revision);
  } else if (isCycle2mTransitionRoutingRequired(cycle2mBaselineDiffPaths)) {
    await verifyCycle2mTransition(repositoryPath, revision);
  } else if (isCycle2kTransitionRoutingRequired(cycle2kBaselineDiffPaths)) {
    await verifyCycle2kTransition(repositoryPath, revision);
  } else if (isCycle2jTransitionRoutingRequired(cycle2jBaselineDiffPaths)) {
    await verifyCycle2jTransition(repositoryPath, revision);
  } else if (isCycle2iTransitionRoutingRequired(cycle2iBaselineDiffPaths)) {
    await verifyCycle2iTransition(repositoryPath, revision);
  } else if (
    isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(
      pnpmDependencyPolicyMaintenanceSurfaceDiffPaths,
      diffEntries,
    )
  ) {
    await verifyPnpmDependencyPolicyMaintenanceTransition(
      repositoryPath,
      revision,
    );
  } else if (
    isAuthenticatedReplayMaintenanceSurfaceRoutingRequired(
      authenticatedReplayMaintenanceSurfaceDiffPaths,
    )
  ) {
    await verifyAuthenticatedReplayMaintenanceTransition(
      repositoryPath,
      revision,
    );
  } else if (
    isOfflineEvidenceInputCustodySurfaceRoutingRequired(
      offlineEvidenceInputCustodySurfaceDiffPaths,
    )
  ) {
    await verifyOfflineEvidenceInputCustodyTransition(repositoryPath, revision);
  } else if (
    isCiTestSerializationSurfaceRoutingRequired(
      ciTestSerializationSurfaceDiffPaths,
    )
  ) {
    await verifyCiTestSerializationTransition(repositoryPath, revision);
  } else if (isFastify5121MaintenanceTransitionRoutingRequired(diffEntries)) {
    await verifyFastify5121MaintenanceTransition(repositoryPath, revision);
  } else if (
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
    (CYCLE_2A_DIFF_ALLOWLIST.has(path) ||
      CYCLE_2O_TRANSITION_PATHS.has(path) ||
      CYCLE_2N_TRANSITION_PATHS.has(path) ||
      CYCLE_2M_TRANSITION_PATHS.has(path) ||
      CYCLE_2K_TRANSITION_PATHS.has(path) ||
      CYCLE_2J_TRANSITION_PATHS.has(path) ||
      CYCLE_2I_TRANSITION_PATHS.has(path) ||
      CYCLE_2H_TRANSITION_PATHS.has(path) ||
      (path !== ".npmrc" &&
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION_PATHS.has(path)))
  );
}

/** @internal Exact pnpm dependency-policy deletion regression seam. */
export function isPnpmDependencyPolicyMaintenanceNpmrcDeletionDiffEntryAllowed(
  status: string | undefined,
  path: string | undefined,
): boolean {
  return status === "D" && path === ".npmrc";
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

/** @internal Exact Cycle 2l cumulative-history bridge regression seam. */
export function isCycle2mPreBaselineCumulativeDiffEntryAllowed(
  status: string | undefined,
  path: string | undefined,
): boolean {
  const expected = CYCLE_2M_PRE_BASELINE_CUMULATIVE_ENTRIES.find(
    (entry) => entry.path === path,
  );
  return expected !== undefined && expected.status === status;
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

/** @internal Exported only for exact disconnected-successor regression tests. */
export function isCycle2iHandoffTreeAllowed(paths: readonly string[]): boolean {
  return (
    paths.length === 0 || exactPathList(paths, CYCLE_2I_HANDOFF_SUCCESSOR_TREE)
  );
}

/** @internal Exact Cycle 2j execution-package tree regression seam. */
export function isCycle2jExecutionTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2J_EXECUTION_SUCCESSOR_TREE)
  );
}

/** @internal Exact Cycle 2j acceptance-package tree regression seam. */
export function isCycle2jAcceptanceTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2J_ACCEPTANCE_SUCCESSOR_TREE)
  );
}

/** @internal Exact Cycle 2m core-package tree regression seam. */
export function isCycle2mCoreTreeAllowed(paths: readonly string[]): boolean {
  return (
    paths.length === 0 || exactPathList(paths, CYCLE_2M_CORE_SUCCESSOR_TREE)
  );
}

/** @internal Exact Cycle 2m acceptance-package tree regression seam. */
export function isCycle2mAcceptanceTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2M_ACCEPTANCE_SUCCESSOR_TREE)
  );
}

/** @internal Exact Cycle 2m corrective-successor routing regression seam. */
export function isCycle2mBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2M_BASELINE_REVISION;
}

/** @internal Exact two-commit Cycle 2m corrective chain regression seam. */
export function isCycle2mCorrectiveChainAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
  sourceParentLine: string,
): boolean {
  return (
    successorCount === "2" &&
    firstParentCount === "2" &&
    COMMIT_SHA.test(revision) &&
    revision !== CYCLE_2M_BASELINE_REVISION &&
    revision !== CYCLE_2M_SOURCE_REVISION &&
    parentLine === `${revision} ${CYCLE_2M_SOURCE_REVISION}` &&
    sourceParentLine ===
      `${CYCLE_2M_SOURCE_REVISION} ${CYCLE_2M_BASELINE_REVISION}`
  );
}

/** @internal Exact Cycle 2m corrective-successor routing regression seam. */
export function isCycle2mTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.length > 0 &&
    new Set(baselineDiffPaths).size === baselineDiffPaths.length &&
    baselineDiffPaths.every(
      (path, index) =>
        CYCLE_2M_TRANSITION_PATHS.has(path) &&
        (index === 0 || (baselineDiffPaths[index - 1] as string) < path),
    )
  );
}

/** @internal Exact Cycle 2p source baseline regression seam. */
export function isCycle2pBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2P_BASELINE_REVISION;
}

/** @internal Exact single-parent Cycle 2p source topology regression seam. */
export function isCycle2pDirectChildAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
): boolean {
  return (
    successorCount === "1" &&
    firstParentCount === "1" &&
    COMMIT_SHA.test(revision) &&
    revision === CYCLE_2P_SOURCE_REVISION &&
    parentLine === `${CYCLE_2P_SOURCE_REVISION} ${CYCLE_2P_BASELINE_REVISION}`
  );
}

/** @internal Exact single-parent Cycle 2p Windows-identity corrective seam. */
export function isCycle2pCorrectiveTopologyAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
  sourceParentLine: string,
): boolean {
  return (
    successorCount === "2" &&
    firstParentCount === "2" &&
    COMMIT_SHA.test(revision) &&
    revision !== CYCLE_2P_BASELINE_REVISION &&
    revision !== CYCLE_2P_SOURCE_REVISION &&
    parentLine === `${revision} ${CYCLE_2P_SOURCE_REVISION}` &&
    sourceParentLine ===
      `${CYCLE_2P_SOURCE_REVISION} ${CYCLE_2P_BASELINE_REVISION}`
  );
}

/** @internal Cycle 2p must route on any protected surface before Cycle 2o. */
export function isCycle2pTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.some((path) => CYCLE_2P_PROTECTED_SURFACE_PATHS.has(path))
  );
}

/** @internal Exact Cycle 2p immutable corpus-admission blob regression seam. */
export function isCycle2pCorpusAdmissionBlobAllowed(
  currentBlob: string | undefined,
  historicalBlob: string | undefined,
): boolean {
  return (
    currentBlob === CYCLE_2P_CORPUS_ADMISSION_BLOB &&
    historicalBlob === CYCLE_2P_CORPUS_ADMISSION_BLOB
  );
}

/** @internal Exact Cycle 2o custody-quality composition tree regression seam. */
export function isCycle2oCompositionTreeAllowed(
  paths: readonly string[],
): boolean {
  return exactPathList(paths, CYCLE_2O_COMPOSITION_SUCCESSOR_TREE);
}

/** @internal Exact Cycle 2o expanded custody tree regression seam. */
export function isCycle2oCustodyTreeAllowed(paths: readonly string[]): boolean {
  return exactPathList(paths, CYCLE_2O_CUSTODY_PACKAGE_TREE);
}

/** @internal Exact Cycle 2o expanded acceptance tree regression seam. */
export function isCycle2oAcceptanceTreeAllowed(
  paths: readonly string[],
): boolean {
  return exactPathList(paths, CYCLE_2O_ACCEPTANCE_SUCCESSOR_TREE);
}

/** @internal Exact Cycle 2o source baseline regression seam. */
export function isCycle2oBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2O_BASELINE_REVISION;
}

/** @internal Exact single-parent Cycle 2o source topology regression seam. */
export function isCycle2oDirectChildAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
): boolean {
  return (
    successorCount === "1" &&
    firstParentCount === "1" &&
    COMMIT_SHA.test(revision) &&
    revision === CYCLE_2O_SOURCE_REVISION &&
    parentLine === `${CYCLE_2O_SOURCE_REVISION} ${CYCLE_2O_BASELINE_REVISION}`
  );
}

/** @internal Exact single-parent Cycle 2o corrective-child topology seam. */
export function isCycle2oCorrectiveTopologyAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
  sourceParentLine: string,
): boolean {
  return (
    successorCount === "2" &&
    firstParentCount === "2" &&
    COMMIT_SHA.test(revision) &&
    revision !== CYCLE_2O_BASELINE_REVISION &&
    revision !== CYCLE_2O_SOURCE_REVISION &&
    parentLine === `${revision} ${CYCLE_2O_SOURCE_REVISION}` &&
    sourceParentLine ===
      `${CYCLE_2O_SOURCE_REVISION} ${CYCLE_2O_BASELINE_REVISION}`
  );
}

/** @internal Cycle 2o must route before admission-validity and Cycle 2n. */
export function isCycle2oTransitionRoutingRequired(
  diffPaths: readonly string[] | undefined,
): boolean {
  return (
    diffPaths !== undefined &&
    diffPaths.some(
      (path) =>
        path === "docs/CYCLE_2O_EXIT_MATRIX.md" ||
        path ===
          "fixtures/synthetic/filing-parser-cross-engine-execution/v5/cases.json" ||
        path.startsWith(
          "packages/filing-parser-custody-quality-composition/",
        ) ||
        path ===
          "packages/filing-payload-custody/src/parser-archive-pair-custody.ts",
    )
  );
}

/** @internal Exact admission-validity corrective baseline regression seam. */
export function isAdmissionValidityBridgeBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION;
}

/** @internal Exact two-commit admission-validity corrective chain seam. */
export function isAdmissionValidityBridgeCorrectiveChainAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
  sourceParentLine: string,
): boolean {
  return (
    successorCount === "2" &&
    firstParentCount === "2" &&
    COMMIT_SHA.test(revision) &&
    revision !== ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION &&
    revision !== ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION &&
    parentLine === `${revision} ${ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION}` &&
    sourceParentLine ===
      `${ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION} ${ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION}`
  );
}

/** @internal Admission-validity correction must route before cumulative Cycle 2n. */
export function isAdmissionValidityBridgeTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    exactPathList(
      baselineDiffPaths,
      [...ADMISSION_VALIDITY_BRIDGE_TRANSITION_PATHS].sort(),
    )
  );
}

/** @internal Exact Cycle 2n composition-package tree regression seam. */
export function isCycle2nCompositionTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2N_COMPOSITION_SUCCESSOR_TREE)
  );
}

/** @internal Exact Cycle 2n source baseline regression seam. */
export function isCycle2nBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2N_BASELINE_REVISION;
}

/** @internal Exact single-parent Cycle 2n source topology regression seam. */
export function isCycle2nDirectChildAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
): boolean {
  return (
    successorCount === "1" &&
    firstParentCount === "1" &&
    COMMIT_SHA.test(revision) &&
    revision !== CYCLE_2N_BASELINE_REVISION &&
    parentLine === `${revision} ${CYCLE_2N_BASELINE_REVISION}`
  );
}

/** @internal Cycle 2n must route before overlapping Cycle 2m surfaces. */
export function isCycle2nTransitionRoutingRequired(
  diffPaths: readonly string[] | undefined,
): boolean {
  return (
    diffPaths !== undefined &&
    diffPaths.some(
      (path) =>
        path === "docs/CYCLE_2N_EXIT_MATRIX.md" ||
        path ===
          "fixtures/synthetic/filing-parser-cross-engine-execution/v4/cases.json" ||
        path.startsWith("packages/filing-parser-quality-composition/"),
    )
  );
}

/** @internal Exact Cycle 2k core-package tree regression seam. */
export function isCycle2kCoreTreeAllowed(paths: readonly string[]): boolean {
  return (
    paths.length === 0 || exactPathList(paths, CYCLE_2K_CORE_SUCCESSOR_TREE)
  );
}

/** @internal Exact Cycle 2k acceptance-package tree regression seam. */
export function isCycle2kAcceptanceTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2K_ACCEPTANCE_SUCCESSOR_TREE)
  );
}

/** @internal Exact Cycle 2k successor-routing regression seam. */
export function isCycle2kBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2K_BASELINE_REVISION;
}

/** @internal Exact Cycle 2k successor routing regression seam. */
export function isCycle2kTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.length > 0 &&
    new Set(baselineDiffPaths).size === baselineDiffPaths.length &&
    baselineDiffPaths.every(
      (path, index) =>
        CYCLE_2K_TRANSITION_PATHS.has(path) &&
        (index === 0 || (baselineDiffPaths[index - 1] as string) < path),
    )
  );
}

/** @internal Exact Cycle 2j successor-routing regression seam. */
export function isCycle2jBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2J_BASELINE_REVISION;
}

/** @internal Exact Cycle 2j successor routing regression seam. */
export function isCycle2jTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.length > 0 &&
    new Set(baselineDiffPaths).size === baselineDiffPaths.length &&
    baselineDiffPaths.every(
      (path, index) =>
        CYCLE_2J_TRANSITION_PATHS.has(path) &&
        (index === 0 || (baselineDiffPaths[index - 1] as string) < path),
    )
  );
}

/** @internal Exported only for exact successor-routing regression tests. */
export function isCycle2iBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2I_BASELINE_REVISION;
}

/** @internal Exported only for exact successor-routing regression tests. */
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

/** @internal Exact maintenance-successor routing regression seam. */
export function isFastify5121MaintenanceTransitionRoutingRequired(
  cumulativeDiffEntries: readonly { readonly path: string }[],
): boolean {
  return cumulativeDiffEntries.some((entry) =>
    FASTIFY_5_12_1_MAINTENANCE_MARKER_PATHS.has(entry.path),
  );
}

/** @internal Exact pnpm dependency-policy maintenance successor regression seam. */
export function isPnpmDependencyPolicyMaintenanceBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === PNPM_DEPENDENCY_POLICY_MAINTENANCE_BASELINE_REVISION;
}

/** @internal Exact Cycle 2i successor routing regression seam. */
export function isCycle2iTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.length > 0 &&
    new Set(baselineDiffPaths).size === baselineDiffPaths.length &&
    baselineDiffPaths.every(
      (path, index) =>
        CYCLE_2I_TRANSITION_PATHS.has(path) &&
        (index === 0 || (baselineDiffPaths[index - 1] as string) < path),
    )
  );
}

/** @internal Exact pnpm dependency-policy maintenance routing regression seam. */
export function isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.length > 0 &&
    new Set(baselineDiffPaths).size === baselineDiffPaths.length &&
    baselineDiffPaths.every((path) =>
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS.has(path),
    )
  );
}

/** @internal Exact pnpm dependency-policy maintenance routing regression seam. */
export function isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
  cumulativeDiffEntries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return (
    cumulativeDiffEntries.some((entry) =>
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_CUMULATIVE_MARKER_PATHS.has(
        entry.path,
      ),
    ) ||
    isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired(baselineDiffPaths)
  );
}

/** @internal Exact authenticated-replay maintenance successor regression seam. */
export function isAuthenticatedReplayMaintenanceBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === AUTHENTICATED_REPLAY_MAINTENANCE_BASELINE_REVISION;
}

/** @internal Exact authenticated-replay maintenance routing regression seam. */
export function isAuthenticatedReplayMaintenanceSurfaceRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    exactPathList(
      baselineDiffPaths,
      [...AUTHENTICATED_REPLAY_MAINTENANCE_SURFACE_PATHS].sort(),
    )
  );
}

/** @internal Exact offline-evidence input-custody successor regression seam. */
export function isOfflineEvidenceInputCustodyBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === OFFLINE_EVIDENCE_INPUT_CUSTODY_BASELINE_REVISION;
}

/** @internal Exact offline-evidence input-custody successor routing seam. */
export function isOfflineEvidenceInputCustodySurfaceRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.length > 0 &&
    new Set(baselineDiffPaths).size === baselineDiffPaths.length &&
    baselineDiffPaths.every((path) =>
      OFFLINE_EVIDENCE_INPUT_CUSTODY_SURFACE_PATHS.has(path),
    )
  );
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
    exactPathList(
      baselineDiffPaths,
      [...CI_TEST_SERIALIZATION_SURFACE_PATHS].sort(),
    )
  );
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

/** @internal Exact pnpm dependency-policy maintenance successor regression seam. */
export function isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const sorted = [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  return (
    sorted.length === PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.length &&
    sorted.every((entry, index) => {
      const expected = PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exact authenticated-replay maintenance successor regression seam. */
export function isAuthenticatedReplayMaintenanceCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const sorted = [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  return (
    sorted.length === AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION.length &&
    sorted.every((entry, index) => {
      const expected = AUTHENTICATED_REPLAY_MAINTENANCE_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exact offline-evidence input-custody successor regression seam. */
export function isOfflineEvidenceInputCustodyCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const sorted = [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  return (
    sorted.length === OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION.length &&
    sorted.every((entry, index) => {
      const expected = OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exact Cycle 2j successor regression seam. */
export function isCycle2jCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return (
    entries.length === CYCLE_2J_TRANSITION.length &&
    new Set(entries.map((entry) => entry.path)).size === entries.length &&
    entries.every((entry, index) => {
      const expected = CYCLE_2J_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exact Cycle 2m corrective-successor regression seam. */
export function isCycle2mCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return (
    entries.length === CYCLE_2M_TRANSITION.length &&
    new Set(entries.map((entry) => entry.path)).size === entries.length &&
    entries.every((entry, index) => {
      const expected = CYCLE_2M_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

function exactAdmissionValidityBridgeDiffSet(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
  expectedEntries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return (
    entries.length === expectedEntries.length &&
    new Set(entries.map((entry) => entry.path)).size === entries.length &&
    entries.every((entry, index) => {
      const expected = expectedEntries[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exact Cycle 2p source transition regression seam. */
export function isCycle2pCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactAdmissionValidityBridgeDiffSet(
    entries,
    CYCLE_2P_SOURCE_TRANSITION,
  );
}

/** @internal Exact Cycle 2p Windows-identity corrective transition seam. */
export function isCycle2pCorrectiveCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactAdmissionValidityBridgeDiffSet(
    entries,
    CYCLE_2P_CORRECTIVE_TRANSITION,
  );
}

/** @internal Exact Cycle 2p baseline-to-corrective cumulative seam. */
export function isCycle2pCumulativeCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactAdmissionValidityBridgeDiffSet(
    entries,
    CYCLE_2P_CUMULATIVE_TRANSITION,
  );
}

/** @internal Exact admission-validity source transition regression seam. */
export function isAdmissionValidityBridgeSourceCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactAdmissionValidityBridgeDiffSet(
    entries,
    ADMISSION_VALIDITY_BRIDGE_SOURCE_TRANSITION,
  );
}

/** @internal Exact admission-validity cumulative transition regression seam. */
export function isAdmissionValidityBridgeCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactAdmissionValidityBridgeDiffSet(
    entries,
    ADMISSION_VALIDITY_BRIDGE_TRANSITION,
  );
}

/** @internal Exact admission-validity corrective-child regression seam. */
export function isAdmissionValidityBridgeCorrectiveCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactAdmissionValidityBridgeDiffSet(
    entries,
    ADMISSION_VALIDITY_BRIDGE_CORRECTIVE_TRANSITION,
  );
}

/** @internal Exact Cycle 2o source-transition regression seam. */
export function isCycle2oCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return (
    entries.length === CYCLE_2O_TRANSITION.length &&
    new Set(entries.map((entry) => entry.path)).size === entries.length &&
    entries.every((entry, index) => {
      const expected = CYCLE_2O_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exact Cycle 2o corrective-child transition regression seam. */
export function isCycle2oCorrectiveCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return (
    entries.length === CYCLE_2O_CORRECTIVE_TRANSITION.length &&
    new Set(entries.map((entry) => entry.path)).size === entries.length &&
    entries.every((entry, index) => {
      const expected = CYCLE_2O_CORRECTIVE_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exact Cycle 2n source-transition regression seam. */
export function isCycle2nCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return (
    entries.length === CYCLE_2N_TRANSITION.length &&
    new Set(entries.map((entry) => entry.path)).size === entries.length &&
    entries.every((entry, index) => {
      const expected = CYCLE_2N_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exact Cycle 2m post-source corrective diff regression seam. */
export function isCycle2mCorrectiveCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return (
    entries.length === CYCLE_2M_CORRECTIVE_TRANSITION.length &&
    new Set(entries.map((entry) => entry.path)).size === entries.length &&
    entries.every((entry, index) => {
      const expected = CYCLE_2M_CORRECTIVE_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exact Cycle 2k successor regression seam. */
export function isCycle2kCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return (
    entries.length === CYCLE_2K_TRANSITION.length &&
    new Set(entries.map((entry) => entry.path)).size === entries.length &&
    entries.every((entry, index) => {
      const expected = CYCLE_2K_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

/** @internal Exact Cycle 2i successor regression seam. */
export function isCycle2iCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return (
    entries.length === CYCLE_2I_TRANSITION.length &&
    new Set(entries.map((entry) => entry.path)).size === entries.length &&
    entries.every((entry, index) => {
      const expected = CYCLE_2I_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

async function cycle2pTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2P_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2pBaselineMergeBaseAllowed(mergeBase)) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2P_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2P_PROTECTED_SURFACE_PATHS,
    ]),
  );
}

async function admissionValidityBridgeTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isAdmissionValidityBridgeBaselineMergeBaseAllowed(mergeBase))
    return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION,
      revision,
      "--",
      ...ADMISSION_VALIDITY_BRIDGE_TRANSITION_PATHS,
    ]),
  );
}

async function cycle2mTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2M_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2mBaselineMergeBaseAllowed(mergeBase)) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2M_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2M_TRANSITION_PATHS,
    ]),
  );
}

async function cycle2kTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2K_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2kBaselineMergeBaseAllowed(mergeBase)) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2K_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2K_TRANSITION_PATHS,
    ]),
  );
}

async function cycle2jTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2J_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2jBaselineMergeBaseAllowed(mergeBase)) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2J_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2J_TRANSITION_PATHS,
    ]),
  );
}

async function cycle2iTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2I_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2iBaselineMergeBaseAllowed(mergeBase)) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2I_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2I_TRANSITION_PATHS,
    ]),
  );
}

async function pnpmDependencyPolicyMaintenanceTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "merge-base",
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_BASELINE_REVISION,
        revision,
      ],
      64,
    ),
  );
  if (!isPnpmDependencyPolicyMaintenanceBaselineMergeBaseAllowed(mergeBase))
    return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_BASELINE_REVISION,
      revision,
      "--",
      ...PNPM_DEPENDENCY_POLICY_MAINTENANCE_SURFACE_PATHS,
    ]),
  );
}

async function authenticatedReplayMaintenanceTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "merge-base",
        AUTHENTICATED_REPLAY_MAINTENANCE_BASELINE_REVISION,
        revision,
      ],
      64,
    ),
  );
  if (!isAuthenticatedReplayMaintenanceBaselineMergeBaseAllowed(mergeBase))
    return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      AUTHENTICATED_REPLAY_MAINTENANCE_BASELINE_REVISION,
      revision,
      "--",
      ...AUTHENTICATED_REPLAY_MAINTENANCE_SURFACE_PATHS,
    ]),
  );
}

async function offlineEvidenceInputCustodyTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "merge-base",
        OFFLINE_EVIDENCE_INPUT_CUSTODY_BASELINE_REVISION,
        revision,
      ],
      64,
    ),
  );
  if (!isOfflineEvidenceInputCustodyBaselineMergeBaseAllowed(mergeBase))
    return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      OFFLINE_EVIDENCE_INPUT_CUSTODY_BASELINE_REVISION,
      revision,
      "--",
      ...OFFLINE_EVIDENCE_INPUT_CUSTODY_SURFACE_PATHS,
    ]),
  );
}

async function ciTestSerializationTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CI_TEST_SERIALIZATION_BASELINE_REVISION, revision],
      64,
    ),
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
    await git(
      repositoryPath,
      ["merge-base", FASTIFY_5_12_1_MAINTENANCE_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isFastify5121MaintenanceBaselineMergeBaseAllowed(mergeBase))
    invalidReview();
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
  if (diff.length % 2 !== 0) invalidReview();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalidReview();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isFastify5121MaintenanceCommitDiffSetAllowed(entries)) invalidReview();
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
    await git(
      repositoryPath,
      ["merge-base", CI_TEST_SERIALIZATION_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCiTestSerializationBaselineMergeBaseAllowed(mergeBase))
    invalidReview();
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
  if (diff.length % 2 !== 0) invalidReview();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalidReview();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCiTestSerializationCommitDiffSetAllowed(entries)) invalidReview();
}

async function cycle2oTreePaths(
  repositoryPath: string,
  revision: string,
  path: string,
): Promise<readonly string[]> {
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
  ).map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
}

async function cycle2pDiffEntries(
  repositoryPath: string,
  fromRevision: string,
  toRevision: string,
): Promise<readonly { readonly path: string; readonly status: string }[]> {
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      fromRevision,
      toRevision,
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
  return Object.freeze(entries);
}

async function verifyCycle2pTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  for (const requiredRevision of [
    CYCLE_2P_BASELINE_REVISION,
    CYCLE_2P_SOURCE_REVISION,
    ADMISSION_VALIDITY_BRIDGE_CORRECTIVE_REVISION,
  ])
    await git(
      repositoryPath,
      ["cat-file", "-e", `${requiredRevision}^{commit}`],
      0,
    );

  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2P_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2pBaselineMergeBaseAllowed(mergeBase)) invalidReview();
  const range = `${CYCLE_2P_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 64),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      64,
    ),
  );
  const parentLine = decodeGitParentLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  );
  const sourceParentLine = decodeGitParentLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", CYCLE_2P_SOURCE_REVISION],
      128,
    ),
  );
  const directSource = isCycle2pDirectChildAllowed(
    successorCount,
    firstParentCount,
    revision,
    parentLine,
  );
  const correctiveChild = isCycle2pCorrectiveTopologyAllowed(
    successorCount,
    firstParentCount,
    revision,
    parentLine,
    sourceParentLine,
  );
  if (!directSource && !correctiveChild) invalidReview();

  const sourceEntries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2P_BASELINE_REVISION,
    CYCLE_2P_SOURCE_REVISION,
  );
  if (!isCycle2pCommitDiffSetAllowed(sourceEntries)) invalidReview();

  if (correctiveChild) {
    const correctiveEntries = await cycle2pDiffEntries(
      repositoryPath,
      CYCLE_2P_SOURCE_REVISION,
      revision,
    );
    if (!isCycle2pCorrectiveCommitDiffSetAllowed(correctiveEntries))
      invalidReview();
  }

  const cumulativeEntries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2P_BASELINE_REVISION,
    revision,
  );
  if (
    directSource
      ? !isCycle2pCommitDiffSetAllowed(cumulativeEntries)
      : !isCycle2pCumulativeCommitDiffSetAllowed(cumulativeEntries)
  )
    invalidReview();

  await verifyAdmissionValidityBridgeTransition(
    repositoryPath,
    ADMISSION_VALIDITY_BRIDGE_CORRECTIVE_REVISION,
  );
  const [currentBlob, historicalBlob] = await Promise.all([
    git(
      repositoryPath,
      ["rev-parse", `${revision}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`],
      64,
    ),
    git(
      repositoryPath,
      [
        "rev-parse",
        `${ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`,
      ],
      64,
    ),
  ]);
  if (
    !isCycle2pCorpusAdmissionBlobAllowed(
      decodeGitRevisionLine(currentBlob),
      decodeGitRevisionLine(historicalBlob),
    )
  )
    invalidReview();
}

async function verifyCycle2oTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  for (const requiredRevision of [
    CYCLE_2O_BASELINE_REVISION,
    CYCLE_2O_SOURCE_REVISION,
  ])
    await git(
      repositoryPath,
      ["cat-file", "-e", `${requiredRevision}^{commit}`],
      0,
    );
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2O_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2oBaselineMergeBaseAllowed(mergeBase)) invalidReview();
  const range = `${CYCLE_2O_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 64),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      64,
    ),
  );
  const parentLine = decodeGitParentLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  );
  const sourceParentLine = decodeGitParentLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", CYCLE_2O_SOURCE_REVISION],
      128,
    ),
  );
  const directSource = isCycle2oDirectChildAllowed(
    successorCount,
    firstParentCount,
    revision,
    parentLine,
  );
  const correctiveChild = isCycle2oCorrectiveTopologyAllowed(
    successorCount,
    firstParentCount,
    revision,
    parentLine,
    sourceParentLine,
  );
  if (!directSource && !correctiveChild) invalidReview();

  if (correctiveChild) {
    const correctiveDiff = splitNul(
      await git(repositoryPath, [
        "diff",
        "--name-status",
        "--no-renames",
        "-z",
        CYCLE_2O_SOURCE_REVISION,
        revision,
        "--",
      ]),
    );
    if (correctiveDiff.length % 2 !== 0) invalidReview();
    const correctiveEntries: Array<{
      readonly path: string;
      readonly status: string;
    }> = [];
    for (let index = 0; index < correctiveDiff.length; index += 2) {
      const status = correctiveDiff[index];
      const path = correctiveDiff[index + 1];
      if (status === undefined || path === undefined) invalidReview();
      correctiveEntries.push(Object.freeze({ path, status }));
    }
    if (!isCycle2oCorrectiveCommitDiffSetAllowed(correctiveEntries))
      invalidReview();
  }

  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      CYCLE_2O_BASELINE_REVISION,
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
  if (!isCycle2oCommitDiffSetAllowed(entries)) invalidReview();

  const [compositionTree, custodyTree, acceptanceTree] = await Promise.all([
    cycle2oTreePaths(
      repositoryPath,
      revision,
      "packages/filing-parser-custody-quality-composition",
    ),
    cycle2oTreePaths(
      repositoryPath,
      revision,
      "packages/filing-payload-custody",
    ),
    cycle2oTreePaths(
      repositoryPath,
      revision,
      "packages/filing-parser-cross-engine-execution-acceptance",
    ),
  ]);
  if (
    !isCycle2oCompositionTreeAllowed(compositionTree) ||
    !isCycle2oCustodyTreeAllowed(custodyTree) ||
    !isCycle2oAcceptanceTreeAllowed(acceptanceTree)
  )
    invalidReview();
}

async function verifyAdmissionValidityBridgeTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  for (const requiredRevision of [
    ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION,
    ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION,
  ])
    await git(
      repositoryPath,
      ["cat-file", "-e", `${requiredRevision}^{commit}`],
      0,
    );
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isAdmissionValidityBridgeBaselineMergeBaseAllowed(mergeBase))
    invalidReview();
  const range = `${ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 64),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      64,
    ),
  );
  const parentLine = decodeGitParentLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  );
  const sourceParentLine = decodeGitParentLine(
    await git(
      repositoryPath,
      [
        "rev-list",
        "--parents",
        "--max-count=1",
        ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION,
      ],
      128,
    ),
  );
  if (
    !isAdmissionValidityBridgeCorrectiveChainAllowed(
      successorCount,
      firstParentCount,
      revision,
      parentLine,
      sourceParentLine,
    )
  )
    invalidReview();

  const sourceDiff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION,
      ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION,
      "--",
    ]),
  );
  if (sourceDiff.length % 2 !== 0) invalidReview();
  const sourceEntries: Array<{
    readonly path: string;
    readonly status: string;
  }> = [];
  for (let index = 0; index < sourceDiff.length; index += 2) {
    const status = sourceDiff[index];
    const path = sourceDiff[index + 1];
    if (status === undefined || path === undefined) invalidReview();
    sourceEntries.push(Object.freeze({ path, status }));
  }
  if (!isAdmissionValidityBridgeSourceCommitDiffSetAllowed(sourceEntries))
    invalidReview();

  const cumulativeDiff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      ADMISSION_VALIDITY_BRIDGE_BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (cumulativeDiff.length % 2 !== 0) invalidReview();
  const cumulativeEntries: Array<{
    readonly path: string;
    readonly status: string;
  }> = [];
  for (let index = 0; index < cumulativeDiff.length; index += 2) {
    const status = cumulativeDiff[index];
    const path = cumulativeDiff[index + 1];
    if (status === undefined || path === undefined) invalidReview();
    cumulativeEntries.push(Object.freeze({ path, status }));
  }
  if (!isAdmissionValidityBridgeCommitDiffSetAllowed(cumulativeEntries))
    invalidReview();

  const correctiveDiff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      ADMISSION_VALIDITY_BRIDGE_SOURCE_REVISION,
      revision,
      "--",
    ]),
  );
  if (correctiveDiff.length % 2 !== 0) invalidReview();
  const correctiveEntries: Array<{
    readonly path: string;
    readonly status: string;
  }> = [];
  for (let index = 0; index < correctiveDiff.length; index += 2) {
    const status = correctiveDiff[index];
    const path = correctiveDiff[index + 1];
    if (status === undefined || path === undefined) invalidReview();
    correctiveEntries.push(Object.freeze({ path, status }));
  }
  if (
    !isAdmissionValidityBridgeCorrectiveCommitDiffSetAllowed(correctiveEntries)
  )
    invalidReview();
}

async function verifyCycle2nTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2N_BASELINE_REVISION}^{commit}`],
    0,
  );
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2N_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2nBaselineMergeBaseAllowed(mergeBase)) invalidReview();
  const range = `${CYCLE_2N_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 64),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      64,
    ),
  );
  const parentLine = decodeGitParentLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  );
  if (
    !isCycle2nDirectChildAllowed(
      successorCount,
      firstParentCount,
      revision,
      parentLine,
    )
  )
    invalidReview();
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      CYCLE_2N_BASELINE_REVISION,
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
  if (!isCycle2nCommitDiffSetAllowed(entries)) invalidReview();
  const compositionTree = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-parser-quality-composition",
    ]),
  ).map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (!exactPathList(compositionTree, CYCLE_2N_COMPOSITION_SUCCESSOR_TREE))
    invalidReview();
}

async function verifyCycle2mTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  for (const requiredRevision of [
    CYCLE_2M_BASELINE_REVISION,
    CYCLE_2M_SOURCE_REVISION,
  ])
    await git(
      repositoryPath,
      ["cat-file", "-e", `${requiredRevision}^{commit}`],
      0,
    );
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2M_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2mBaselineMergeBaseAllowed(mergeBase)) invalidReview();
  const range = `${CYCLE_2M_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 64),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      64,
    ),
  );
  const parentLine = decodeGitParentLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  );
  const sourceParentLine = decodeGitParentLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", CYCLE_2M_SOURCE_REVISION],
      128,
    ),
  );
  if (
    !isCycle2mCorrectiveChainAllowed(
      successorCount,
      firstParentCount,
      revision,
      parentLine,
      sourceParentLine,
    )
  )
    invalidReview();
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      CYCLE_2M_BASELINE_REVISION,
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
  if (!isCycle2mCommitDiffSetAllowed(entries)) invalidReview();
  const correctiveDiff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      CYCLE_2M_SOURCE_REVISION,
      revision,
      "--",
    ]),
  );
  if (correctiveDiff.length % 2 !== 0) invalidReview();
  const correctiveEntries: Array<{
    readonly path: string;
    readonly status: string;
  }> = [];
  for (let index = 0; index < correctiveDiff.length; index += 2) {
    const status = correctiveDiff[index];
    const path = correctiveDiff[index + 1];
    if (status === undefined || path === undefined) invalidReview();
    correctiveEntries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2mCorrectiveCommitDiffSetAllowed(correctiveEntries))
    invalidReview();
  const coreTree = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-parser-cross-engine-execution",
    ]),
  ).map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  const acceptanceTree = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-parser-cross-engine-execution-acceptance",
    ]),
  ).map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (
    !exactPathList(coreTree, CYCLE_2M_CORE_SUCCESSOR_TREE) ||
    !exactPathList(acceptanceTree, CYCLE_2M_ACCEPTANCE_SUCCESSOR_TREE)
  )
    invalidReview();
}

async function verifyCycle2kTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2K_BASELINE_REVISION}^{commit}`],
    0,
  );
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2K_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2kBaselineMergeBaseAllowed(mergeBase)) invalidReview();
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      CYCLE_2K_BASELINE_REVISION,
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
  if (!isCycle2kCommitDiffSetAllowed(entries)) invalidReview();
  const coreTree = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-parser-cross-engine-execution",
    ]),
  ).map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  const acceptanceTree = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-parser-cross-engine-execution-acceptance",
    ]),
  ).map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (
    !exactPathList(coreTree, CYCLE_2K_CORE_SUCCESSOR_TREE) ||
    !exactPathList(acceptanceTree, CYCLE_2K_ACCEPTANCE_SUCCESSOR_TREE)
  )
    invalidReview();
}

async function verifyCycle2jTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2J_BASELINE_REVISION}^{commit}`],
    0,
  );
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2J_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2jBaselineMergeBaseAllowed(mergeBase)) invalidReview();
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      CYCLE_2J_BASELINE_REVISION,
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
  if (!isCycle2jCommitDiffSetAllowed(entries)) invalidReview();
}

async function verifyCycle2iTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2I_BASELINE_REVISION}^{commit}`],
    0,
  );
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2I_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2iBaselineMergeBaseAllowed(mergeBase)) invalidReview();
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      CYCLE_2I_BASELINE_REVISION,
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
  if (!isCycle2iCommitDiffSetAllowed(entries)) invalidReview();
}

async function verifyPnpmDependencyPolicyMaintenanceTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    [
      "cat-file",
      "-e",
      `${PNPM_DEPENDENCY_POLICY_MAINTENANCE_BASELINE_REVISION}^{commit}`,
    ],
    0,
  );
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "merge-base",
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_BASELINE_REVISION,
        revision,
      ],
      64,
    ),
  );
  if (!isPnpmDependencyPolicyMaintenanceBaselineMergeBaseAllowed(mergeBase))
    invalidReview();
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_BASELINE_REVISION,
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
  if (!isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed(entries))
    invalidReview();
}

async function verifyAuthenticatedReplayMaintenanceTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    [
      "cat-file",
      "-e",
      `${AUTHENTICATED_REPLAY_MAINTENANCE_BASELINE_REVISION}^{commit}`,
    ],
    0,
  );
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "merge-base",
        AUTHENTICATED_REPLAY_MAINTENANCE_BASELINE_REVISION,
        revision,
      ],
      64,
    ),
  );
  if (!isAuthenticatedReplayMaintenanceBaselineMergeBaseAllowed(mergeBase))
    invalidReview();
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      AUTHENTICATED_REPLAY_MAINTENANCE_BASELINE_REVISION,
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
  if (!isAuthenticatedReplayMaintenanceCommitDiffSetAllowed(entries))
    invalidReview();
}

async function verifyOfflineEvidenceInputCustodyTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    [
      "cat-file",
      "-e",
      `${OFFLINE_EVIDENCE_INPUT_CUSTODY_BASELINE_REVISION}^{commit}`,
    ],
    0,
  );
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "merge-base",
        OFFLINE_EVIDENCE_INPUT_CUSTODY_BASELINE_REVISION,
        revision,
      ],
      64,
    ),
  );
  if (!isOfflineEvidenceInputCustodyBaselineMergeBaseAllowed(mergeBase))
    invalidReview();
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "--no-renames",
      "-z",
      OFFLINE_EVIDENCE_INPUT_CUSTODY_BASELINE_REVISION,
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
  if (!isOfflineEvidenceInputCustodyCommitDiffSetAllowed(entries))
    invalidReview();
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

/** @internal Exported only for immutable-anchor regression tests. */
export function normalizeFilingParserEvidenceReviewOptions(
  options: FilingParserEvidenceReviewOptions,
): FilingParserEvidenceReviewOptions {
  try {
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
      isProxy(options) ||
      Object.getPrototypeOf(options) !== Object.prototype
    )
      invalidReview();
    const ownKeys = Reflect.ownKeys(options);
    if (
      ownKeys.some((key) => typeof key !== "string") ||
      !exactPathList((ownKeys as string[]).sort(), [...keys].sort())
    )
      invalidReview();
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
      invalidReview();
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
      !COMMIT_SHA.test(values.expectedRevision) ||
      typeof values.expectedRunId !== "string" ||
      !RUN_ID.test(values.expectedRunId) ||
      !Number.isSafeInteger(values.expectedRunAttempt) ||
      (values.expectedRunAttempt as number) < 1
    )
      invalidReview();
    return Object.freeze({
      evidencePath: values.evidencePath,
      expectedEvidenceSha256:
        values.expectedEvidenceSha256 as `sha256:${string}`,
      expectedRepository: values.expectedRepository,
      expectedRevision: values.expectedRevision,
      expectedRunAttempt: values.expectedRunAttempt as number,
      expectedRunId: values.expectedRunId,
      repositoryPath: values.repositoryPath,
    });
  } catch {
    return invalidReview();
  }
}

type EvidenceFileStat = Pick<
  Stats,
  "ctimeMs" | "dev" | "ino" | "isFile" | "mtimeMs" | "size"
>;
type EvidencePathStat = EvidenceFileStat & Pick<Stats, "isSymbolicLink">;

/** @internal Exported only for bounded-file TOCTOU regression tests. */
export function isFilingParserEvidenceFileReadSnapshotAllowed(
  pathBefore: EvidencePathStat,
  descriptorBefore: EvidenceFileStat,
  descriptorAfter: EvidenceFileStat,
  pathAfter: EvidencePathStat,
  bytesRead: number,
  maximumBytes: number,
): boolean {
  const snapshots = [descriptorBefore, descriptorAfter, pathAfter];
  return (
    Number.isSafeInteger(maximumBytes) &&
    maximumBytes >= 2 &&
    pathBefore.isFile() &&
    !pathBefore.isSymbolicLink() &&
    !pathAfter.isSymbolicLink() &&
    Number.isSafeInteger(pathBefore.size) &&
    pathBefore.size >= 2 &&
    pathBefore.size <= maximumBytes &&
    bytesRead === pathBefore.size &&
    snapshots.every(
      (snapshot) =>
        snapshot.isFile() &&
        snapshot.size === pathBefore.size &&
        snapshot.dev === pathBefore.dev &&
        snapshot.ino === pathBefore.ino &&
        snapshot.mtimeMs === pathBefore.mtimeMs &&
        snapshot.ctimeMs === pathBefore.ctimeMs,
    )
  );
}

async function readSmallRegularFile(
  path: string,
  maximumBytes: number,
): Promise<Uint8Array> {
  const pathBefore = await lstat(path);
  if (
    !isFilingParserEvidenceFileReadSnapshotAllowed(
      pathBefore,
      pathBefore,
      pathBefore,
      pathBefore,
      pathBefore.size,
      maximumBytes,
    )
  )
    invalidReview();
  const noFollow = constants.O_NOFOLLOW;
  const flags =
    typeof noFollow === "number"
      ? constants.O_RDONLY | noFollow
      : constants.O_RDONLY;
  const handle = await open(path, flags);
  try {
    const descriptorBefore = await handle.stat();
    if (
      !isFilingParserEvidenceFileReadSnapshotAllowed(
        pathBefore,
        descriptorBefore,
        descriptorBefore,
        pathBefore,
        descriptorBefore.size,
        maximumBytes,
      )
    )
      invalidReview();
    const bounded = Buffer.alloc(descriptorBefore.size + 1);
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
    const descriptorAfter = await handle.stat();
    const pathAfter = await lstat(path);
    if (
      !isFilingParserEvidenceFileReadSnapshotAllowed(
        pathBefore,
        descriptorBefore,
        descriptorAfter,
        pathAfter,
        offset,
        maximumBytes,
      )
    )
      invalidReview();
    return new Uint8Array(bounded.subarray(0, offset));
  } finally {
    await handle.close();
  }
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

function decodeGitCountLine(value: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    return invalidReview();
  }
  if (!/^(?:0|[1-9][0-9]*)\n$/u.test(text)) invalidReview();
  return text.slice(0, -1);
}

function decodeGitParentLine(value: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    return invalidReview();
  }
  if (!/^[0-9a-f]{40}(?: [0-9a-f]{40})+\n$/u.test(text)) invalidReview();
  return text.slice(0, -1);
}

/** @internal Exact replacement-ref hardening regression seam. */
export function filingParserGitArgumentsWithoutReplacementObjects(
  repositoryPath: string,
  args: readonly string[],
): readonly string[] {
  return Object.freeze([
    "--no-replace-objects",
    "--no-lazy-fetch",
    "-c",
    "advice.graftFileDeprecated=false",
    "-C",
    repositoryPath,
    ...args,
  ]);
}

/** @internal Exact graft-environment hardening regression seam. */
export function filingParserGitEnvironmentWithoutGrafts(
  environment: Readonly<NodeJS.ProcessEnv>,
  platform: NodeJS.Platform = process.platform,
): Readonly<NodeJS.ProcessEnv> {
  const sanitized = Object.fromEntries(
    Object.entries(environment).filter(
      ([key]) => key.toUpperCase() !== "GIT_GRAFT_FILE",
    ),
  );
  sanitized.GIT_GRAFT_FILE = platform === "win32" ? "NUL" : "/dev/null";
  return Object.freeze(sanitized);
}

/** @internal Exact git-process regression seam. */
export function isFilingParserGitProcessResultAllowed(
  code: number | null,
  stdoutBytes: number,
  maximumOutputBytes: number,
  stderrBytes: number,
  timedOut: boolean,
): boolean {
  return (
    !timedOut &&
    code === 0 &&
    stdoutBytes <= maximumOutputBytes &&
    stderrBytes === 0
  );
}

/** @internal Exact effective-grafts-path regression seam. */
export function decodeFilingParserAbsoluteGitPath(bytes: Uint8Array): string {
  let value: string;
  try {
    value = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
  } catch {
    return invalidReview();
  }
  const path = value.slice(0, -1);
  if (
    value.includes("\ufeff") ||
    !value.endsWith("\n") ||
    path.length === 0 ||
    /[\0\r\n]/u.test(path) ||
    !isAbsolute(path)
  )
    invalidReview();
  return path;
}

/** @internal Exact empty-grafts TOCTOU regression seam. */
export function isFilingParserEmptyGitGraftsSnapshotAllowed(
  pathBefore: EvidencePathStat,
  descriptorBefore: EvidencePathStat,
  descriptorAfter: EvidencePathStat,
  pathAfter: EvidencePathStat,
  bytesRead: number,
): boolean {
  const snapshots = [pathBefore, descriptorBefore, descriptorAfter, pathAfter];
  return (
    bytesRead === 0 &&
    snapshots.every(
      (snapshot) =>
        snapshot.isFile() &&
        !snapshot.isSymbolicLink() &&
        snapshot.size === 0 &&
        Number.isFinite(snapshot.mtimeMs) &&
        Number.isFinite(snapshot.ctimeMs) &&
        snapshot.dev === pathBefore.dev &&
        snapshot.ino === pathBefore.ino &&
        snapshot.mtimeMs === pathBefore.mtimeMs &&
        snapshot.ctimeMs === pathBefore.ctimeMs,
    )
  );
}

/** @internal Exported only for effective-worktree graft regressions. */
export async function verifyNoEffectiveFilingParserGitGrafts(
  repositoryPath: string,
  environment: Readonly<NodeJS.ProcessEnv> = process.env,
): Promise<void> {
  const graftsPath = decodeFilingParserAbsoluteGitPath(
    await gitWithAmbientGrafts(
      repositoryPath,
      ["rev-parse", "--path-format=absolute", "--git-path", "info/grafts"],
      MAX_GIT_PATH_BYTES,
      environment,
    ),
  );
  let pathBefore: EvidencePathStat;
  try {
    pathBefore = await lstat(graftsPath);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return;
    return invalidReview();
  }
  if (
    !isFilingParserEmptyGitGraftsSnapshotAllowed(
      pathBefore,
      pathBefore,
      pathBefore,
      pathBefore,
      0,
    )
  )
    invalidReview();
  const noFollow = constants.O_NOFOLLOW;
  const nonBlock = constants.O_NONBLOCK;
  const flags =
    constants.O_RDONLY |
    (typeof noFollow === "number" ? noFollow : 0) |
    (typeof nonBlock === "number" ? nonBlock : 0);
  try {
    const handle = await open(graftsPath, flags);
    try {
      const descriptorBefore = await handle.stat();
      const probe = Buffer.alloc(1);
      const { bytesRead } = await handle.read(probe, 0, probe.byteLength, 0);
      const descriptorAfter = await handle.stat();
      const pathAfter = await lstat(graftsPath);
      if (
        !isFilingParserEmptyGitGraftsSnapshotAllowed(
          pathBefore,
          descriptorBefore,
          descriptorAfter,
          pathAfter,
          bytesRead,
        )
      )
        invalidReview();
    } finally {
      await handle.close();
    }
  } catch {
    return invalidReview();
  }
}

function git(
  repositoryPath: string,
  args: readonly string[],
  maximumOutputBytes = MAX_GIT_BLOB_BYTES,
): Promise<Uint8Array> {
  return spawnGit(
    repositoryPath,
    args,
    maximumOutputBytes,
    filingParserGitEnvironmentWithoutGrafts(process.env),
  );
}

function gitWithAmbientGrafts(
  repositoryPath: string,
  args: readonly string[],
  maximumOutputBytes: number,
  environment: Readonly<NodeJS.ProcessEnv>,
): Promise<Uint8Array> {
  return spawnGit(repositoryPath, args, maximumOutputBytes, environment);
}

function spawnGit(
  repositoryPath: string,
  args: readonly string[],
  maximumOutputBytes: number,
  environment: Readonly<NodeJS.ProcessEnv>,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "git",
      filingParserGitArgumentsWithoutReplacementObjects(repositoryPath, args),
      {
        env: environment,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    const stdout: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let failed = false;
    let settled = false;
    let timedOut = false;
    const finish = (
      outcome: "resolve" | "reject",
      value?: Uint8Array,
    ): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (outcome === "resolve" && value !== undefined) resolve(value);
      else reject(new Error("Offline evidence review failed."));
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      failed = true;
      child.kill("SIGKILL");
      finish("reject");
    }, GIT_TIMEOUT_MILLISECONDS);
    timeout.unref();
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > maximumOutputBytes) {
        failed = true;
        child.kill("SIGKILL");
        finish("reject");
        return;
      }
      stdout.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > 16_384) {
        failed = true;
        child.kill("SIGKILL");
        finish("reject");
      }
    });
    child.on("error", () => finish("reject"));
    child.on("close", (code) => {
      if (
        failed ||
        !isFilingParserGitProcessResultAllowed(
          code,
          stdoutBytes,
          maximumOutputBytes,
          stderrBytes,
          timedOut,
        )
      ) {
        finish("reject");
        return;
      }
      finish("resolve", Uint8Array.from(Buffer.concat(stdout)));
    });
  });
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

function invalidReview(): never {
  throw new Error("Offline evidence review failed.");
}
