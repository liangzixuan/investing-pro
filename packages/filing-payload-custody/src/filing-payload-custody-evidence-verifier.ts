import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute } from "node:path";

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
const CYCLE_2P_BASELINE_REVISION =
  "e21408acf70a28909136cc3eb0c10bbbd48b8266" as const;
const CYCLE_2P_SOURCE_REVISION =
  "bc4b371784711102462ad28a9c9eb7cb567f1072" as const;
const CYCLE_2P_CORRECTIVE_REVISION =
  "d642e534b8911b58a32d50f8dfb976ae2900cadc" as const;
const CYCLE_2Q_BASELINE_REVISION =
  "2f0534d2a5b4206221cc66ece5e03cf529e5d373" as const;
const CYCLE_2Q_SOURCE_REVISION =
  "398bb280593b6de125c5561ac9dd1b1c0fe254bd" as const;
const CYCLE_2R_BASELINE_REVISION =
  "436f7fed6af9efaec21a26e5709b90073610384e" as const;
const CYCLE_2R_SOURCE_REVISION =
  "e15ddd8aa923a43fdca730e233abfbe684101e78" as const;
const CYCLE_2S_BASELINE_REVISION =
  "a13b51d2cd6862029aa598829e40209ce178c7be" as const;
const CYCLE_2S_SOURCE_REVISION =
  "78b3880632ff7e54ac493e9c208ee1d93a275aa1" as const;
const CYCLE_2U_BASELINE_REVISION =
  "39f0ce974f84e278ec9d12193b284876c928110e" as const;
const CYCLE_2U_SOURCE_REVISION =
  "4df5549087660b5b5d473c478b03b17576fd4784" as const;
const CYCLE_2V_BASELINE_REVISION =
  "90c20e6eeb6c387015af81f74ba4b8e7aebc444b" as const;
const CYCLE_2V_SOURCE_REVISION =
  "76bd8a1319d6b5feb05da412ca30fe6507c5bdbb" as const;
const CYCLE_2W_BASELINE_REVISION =
  "ad5e3003d3670c84021dabe47c4fb3976274bb23" as const;
const CYCLE_2P_CORPUS_ADMISSION_PATH =
  "packages/filing-parser/src/corpus-admission.ts" as const;
const CYCLE_2P_CORPUS_ADMISSION_BLOB =
  "e456cae97cf9eb377e3b3e8aabc156fdb377e2c7" as const;
const CYCLE_2P_HISTORICAL_BASELINE_REVISION =
  "7243f16df0c4bd8691ff11fa037085e3beb3447e" as const;
const CYCLE_2P_HISTORICAL_SOURCE_REVISION =
  "96b042669edc6cb4a876bb0c061fa5e18732c1ca" as const;
const CYCLE_2P_HISTORICAL_CORRECTIVE_REVISION =
  "711fe866594d5e20a657a24c0a0c72fd78ab90be" as const;
const MAX_EVIDENCE_BYTES = 1_048_576;
const MAX_GIT_BYTES = 4_194_304;
const MAX_GIT_PATH_BYTES = 32_768;
const GIT_TIMEOUT_MILLISECONDS = 30_000;
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
const CYCLE_2I_HANDOFF_PACKAGE_TREE = Object.freeze(
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
const CYCLE_2J_CORE_PACKAGE_TREE = Object.freeze(
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
const CYCLE_2J_ACCEPTANCE_PACKAGE_TREE = Object.freeze(
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
const CYCLE_2K_CORE_PACKAGE_TREE = Object.freeze(
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
const CYCLE_2K_ACCEPTANCE_PACKAGE_TREE = Object.freeze(
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
const CYCLE_2M_CORE_PACKAGE_TREE = Object.freeze(
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
const CYCLE_2M_ACCEPTANCE_PACKAGE_TREE = Object.freeze([
  ...CYCLE_2K_ACCEPTANCE_PACKAGE_TREE,
]);
const CYCLE_2N_COMPOSITION_PACKAGE_TREE = Object.freeze(
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
const CYCLE_2O_COMPOSITION_PACKAGE_TREE = Object.freeze(
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
const CYCLE_2O_ACCEPTANCE_PACKAGE_TREE = Object.freeze(
  [
    ...CYCLE_2K_ACCEPTANCE_PACKAGE_TREE,
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
  {
    path: "packages/filing-parser-normalization-execution-acceptance/package.json",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence-review.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence-review.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence-verifier.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence-verifier.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution-acceptance/src/index.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution-acceptance/src/run-filing-parser-normalization-execution-acceptance.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution-acceptance/src/run-filing-parser-normalization-execution-acceptance.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution-acceptance/src/run-filing-parser-normalization-execution-evidence-review.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution-acceptance/src/test-filing-parser-normalization-execution-evidence-builder.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution-acceptance/tsconfig.json",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution/acceptance/python-image.json",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution/package.json",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution/src/filing-parser-normalization-execution-security.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution/src/filing-parser-normalization-execution.test.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution/src/filing-parser-normalization-execution.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution/src/index.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution/src/test-filing-parser-normalization-execution-builder.ts",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution/tsconfig.json",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution/worker/Dockerfile",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution/worker/parser.py",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution/worker/parser_test.py",
    status: "A",
  },
  {
    path: "packages/filing-parser-normalization-execution/worker/taxonomy-v1.json",
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
  ...CYCLE_2K_ACCEPTANCE_PACKAGE_TREE.map((path) => ({ path, status: "A" })),
  ...CYCLE_2K_CORE_PACKAGE_TREE.map((path) => ({ path, status: "A" })),
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
const CYCLE_2M_TRANSITION = Object.freeze([
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
]);
const CYCLE_2M_CORRECTIVE_TRANSITION = Object.freeze([
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
]);
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
    ...CYCLE_2N_COMPOSITION_PACKAGE_TREE.map((path) => ({ path, status: "A" })),
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
    ...CYCLE_2O_COMPOSITION_PACKAGE_TREE.map((path) => ({
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
const CYCLE_2P_TRANSITION = Object.freeze(
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
    ...new Set([
      ...CYCLE_2P_TRANSITION.map((entry) => entry.path),
      ...CYCLE_2P_CORRECTIVE_TRANSITION.map((entry) => entry.path),
    ]),
  ]
    .sort()
    .map((path) => Object.freeze({ path, status: "M" })),
);
const CYCLE_2P_HISTORICAL_SOURCE_TRANSITION = Object.freeze(
  [
    "packages/filing-parser/src/corpus-admission-security.test.ts",
    "packages/filing-parser/src/corpus-admission.ts",
  ]
    .sort()
    .map((path) => Object.freeze({ path, status: "M" })),
);
const CYCLE_2P_HISTORICAL_CORRECTIVE_TRANSITION = Object.freeze(
  [
    ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  ]
    .sort()
    .map((path) => Object.freeze({ path, status: "M" })),
);
const CYCLE_2P_HISTORICAL_TRANSITION = Object.freeze(
  [
    ...CYCLE_2P_HISTORICAL_SOURCE_TRANSITION,
    ...CYCLE_2P_HISTORICAL_CORRECTIVE_TRANSITION,
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2Q_SOURCE_TRANSITION = Object.freeze(
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2R_SOURCE_TRANSITION = Object.freeze(
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2S_SOURCE_TRANSITION = Object.freeze(
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2U_SOURCE_TRANSITION = Object.freeze(
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2W_SOURCE_TRANSITION = Object.freeze(
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
  ),
);

const CYCLE_2V_SOURCE_TRANSITION = Object.freeze(
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
  ].sort((left, right) => left.path.localeCompare(right.path)),
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
const CYCLE_2M_PRE_BASELINE_CUMULATIVE_PATHS = Object.freeze(
  CYCLE_2M_PRE_BASELINE_CUMULATIVE_ENTRIES.map((entry) => entry.path),
);
const CYCLE_2I_TRANSITION_PATHS = new Set(
  CYCLE_2I_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2J_TRANSITION_PATHS = new Set(
  CYCLE_2J_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2K_TRANSITION_PATHS = new Set(
  CYCLE_2K_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2M_TRANSITION_PATHS = new Set(
  CYCLE_2M_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2N_TRANSITION_PATHS = new Set(
  CYCLE_2N_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2O_TRANSITION_PATHS = new Set(
  CYCLE_2O_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2P_PROTECTED_SURFACE_PATHS = new Set([
  ...CYCLE_2P_CUMULATIVE_TRANSITION.map((entry) => entry.path),
  CYCLE_2P_CORPUS_ADMISSION_PATH,
]);
const CYCLE_2Q_TRANSITION_PATHS = new Set(
  CYCLE_2Q_SOURCE_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2Q_PROTECTED_SURFACE_PATHS = new Set([
  ...CYCLE_2Q_TRANSITION_PATHS,
  CYCLE_2P_CORPUS_ADMISSION_PATH,
]);
const CYCLE_2R_TRANSITION_PATHS = new Set(
  CYCLE_2R_SOURCE_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2R_PROTECTED_SURFACE_PATHS = new Set([
  ...CYCLE_2R_TRANSITION_PATHS,
  CYCLE_2P_CORPUS_ADMISSION_PATH,
  "packages/personal-filing-corpus/package.json",
  "packages/personal-filing-corpus/src/personal-filing-corpus-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.ts",
  "packages/personal-filing-corpus/tsconfig.json",
]);
const CYCLE_2S_TRANSITION_PATHS = new Set(
  CYCLE_2S_SOURCE_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2S_PROTECTED_SURFACE_PATHS = new Set([
  ...CYCLE_2S_TRANSITION_PATHS,
  CYCLE_2P_CORPUS_ADMISSION_PATH,
  "packages/personal-filing-corpus/package.json",
  "packages/personal-filing-corpus/src/personal-filing-corpus-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-identity.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-identity.ts",
  "packages/personal-filing-corpus/tsconfig.json",
]);
const CYCLE_2U_TRANSITION_PATHS = new Set(
  CYCLE_2U_SOURCE_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2U_PROTECTED_SURFACE_PATHS = new Set([
  ...CYCLE_2U_TRANSITION_PATHS,
  CYCLE_2P_CORPUS_ADMISSION_PATH,
  "packages/personal-filing-corpus/package.json",
  "packages/personal-filing-corpus/src/personal-filing-corpus-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-corpus.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-custody-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-custody.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-custody.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-identity-security.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-identity.test.ts",
  "packages/personal-filing-corpus/src/personal-filing-payload-identity.ts",
  "packages/personal-filing-corpus/tsconfig.json",
]);
const CYCLE_2V_TRANSITION_PATHS = new Set(
  CYCLE_2V_SOURCE_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2V_PROTECTED_SURFACE_PATHS = new Set([
  ...CYCLE_2V_TRANSITION_PATHS,
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
]);
const CYCLE_2W_TRANSITION_PATHS = new Set(
  CYCLE_2W_SOURCE_TRANSITION.map((entry) => entry.path),
);
const CYCLE_2W_PROTECTED_SURFACE_PATHS = new Set([
  ...CYCLE_2V_PROTECTED_SURFACE_PATHS,
  ...CYCLE_2W_TRANSITION_PATHS,
]);
const CYCLE_2O_PRE_BASELINE_ADMISSION_VALIDITY_PATHS = Object.freeze([
  "packages/filing-parser/src/corpus-admission-security.test.ts",
  "packages/filing-parser/src/corpus-admission.ts",
]);
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
const PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION_PATHS = new Set(
  PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.map((entry) => entry.path),
);
const FASTIFY_5_12_1_MAINTENANCE_MARKER_PATHS = new Set([
  "apps/api/package.json",
]);
const OFFLINE_EVIDENCE_INPUT_CUSTODY_SURFACE_PATHS = new Set(
  OFFLINE_EVIDENCE_INPUT_CUSTODY_TRANSITION.map((entry) => entry.path),
);
const AUTHENTICATED_REPLAY_MAINTENANCE_SURFACE_PATHS = new Set([
  "packages/filing-payload-custody/src/payload-custody.ts",
]);
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
const PNPM_DEPENDENCY_POLICY_MAINTENANCE_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...FASTIFY_5_12_1_MAINTENANCE_CUMULATIVE_DIFF_PATHS,
      ...PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION.map(
        (entry) => entry.path,
      ),
    ]),
  ].sort(),
);
const CYCLE_2I_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...PNPM_DEPENDENCY_POLICY_MAINTENANCE_CUMULATIVE_DIFF_PATHS,
      ...CYCLE_2I_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);
const CYCLE_2J_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2I_CUMULATIVE_DIFF_PATHS,
      ...CYCLE_2J_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);
const CYCLE_2K_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2J_CUMULATIVE_DIFF_PATHS,
      ...CYCLE_2K_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);
const CYCLE_2M_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2K_CUMULATIVE_DIFF_PATHS,
      ...CYCLE_2M_PRE_BASELINE_CUMULATIVE_PATHS,
      ...CYCLE_2M_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);
const CYCLE_2N_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2M_CUMULATIVE_DIFF_PATHS,
      ...CYCLE_2N_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);
const CYCLE_2O_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2N_CUMULATIVE_DIFF_PATHS,
      ...CYCLE_2O_PRE_BASELINE_ADMISSION_VALIDITY_PATHS,
      ...CYCLE_2O_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);

const EXPECTED_PACKAGE_TREE = [...CYCLE_2C_DIFF_ALLOWLIST]
  .filter((path) => path.startsWith("packages/filing-payload-custody/"))
  .sort();
const CYCLE_2O_CUSTODY_PACKAGE_TREE = Object.freeze(
  [
    ...EXPECTED_PACKAGE_TREE,
    "packages/filing-payload-custody/src/parser-archive-pair-custody.test.ts",
    "packages/filing-payload-custody/src/parser-archive-pair-custody.ts",
    "packages/filing-payload-custody/src/parser-archive-pair-fixture.ts",
  ].sort(),
);
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
  await verifyNoEffectiveGitGrafts(repositoryPath);
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
  const cycle2wBaselineDiffPaths = await cycle2wTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2wRoutingRequired = isCycle2wTransitionRoutingRequired(
    cycle2wBaselineDiffPaths,
  );
  if (cycle2wRoutingRequired)
    await verifyCycle2wTransition(repositoryPath, revision);
  const cycle2vBaselineDiffPaths = await cycle2vTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2vRoutingRequired = isCycle2vTransitionRoutingRequired(
    cycle2vBaselineDiffPaths,
  );
  if (!cycle2wRoutingRequired && cycle2vRoutingRequired)
    await verifyCycle2vTransition(repositoryPath, revision);
  const cycle2uBaselineDiffPaths = await cycle2uTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2uRoutingRequired = isCycle2uTransitionRoutingRequired(
    cycle2uBaselineDiffPaths,
  );
  if (
    !cycle2wRoutingRequired &&
    !cycle2vRoutingRequired &&
    cycle2uRoutingRequired
  )
    await verifyCycle2uTransition(repositoryPath, revision);
  const cycle2sBaselineDiffPaths = await cycle2sTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2sRoutingRequired = isCycle2sTransitionRoutingRequired(
    cycle2sBaselineDiffPaths,
  );
  if (
    !cycle2wRoutingRequired &&
    !cycle2vRoutingRequired &&
    !cycle2uRoutingRequired &&
    cycle2sRoutingRequired
  )
    await verifyCycle2sTransition(repositoryPath, revision);
  const cycle2rBaselineDiffPaths = await cycle2rTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2rRoutingRequired = isCycle2rTransitionRoutingRequired(
    cycle2rBaselineDiffPaths,
  );
  if (
    !cycle2wRoutingRequired &&
    !cycle2vRoutingRequired &&
    !cycle2uRoutingRequired &&
    !cycle2sRoutingRequired &&
    cycle2rRoutingRequired
  )
    await verifyCycle2rTransition(repositoryPath, revision);
  const cycle2qBaselineDiffPaths = await cycle2qTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2qRoutingRequired = isCycle2qTransitionRoutingRequired(
    cycle2qBaselineDiffPaths,
  );
  if (
    !cycle2wRoutingRequired &&
    !cycle2vRoutingRequired &&
    !cycle2uRoutingRequired &&
    !cycle2sRoutingRequired &&
    !cycle2rRoutingRequired &&
    cycle2qRoutingRequired
  )
    await verifyCycle2qTransition(repositoryPath, revision);
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
  if (
    !cycle2uRoutingRequired &&
    !cycle2sRoutingRequired &&
    !cycle2rRoutingRequired &&
    !cycle2qRoutingRequired &&
    !isCycle2cCommitDiffSetAllowed(entries)
  )
    invalid();
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
  const handoffTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-parser-normalization-handoff",
  );
  const cycle2jCoreTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-parser-normalization-execution",
  );
  const cycle2jAcceptanceTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-parser-normalization-execution-acceptance",
  );
  const cycle2kCoreTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-parser-cross-engine-execution",
  );
  const cycle2kAcceptanceTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-parser-cross-engine-execution-acceptance",
  );
  if (
    (!exactList(packageTree, EXPECTED_PACKAGE_TREE) &&
      !isCycle2oCustodyTreeAllowed(packageTree)) ||
    !exactList(fixtureTree, EXPECTED_FIXTURE_TREE) ||
    !isCycle2dNormalizationTreeAllowed(normalizationTree) ||
    !isCycle2eComparisonTreeAllowed(comparisonTree) ||
    !isCycle2fQualityMeasurementTreeAllowed(qualityMeasurementTree) ||
    !isCycle2gQualityPrecommitmentTreeAllowed(qualityPrecommitmentTree) ||
    !isCycle2iHandoffTreeAllowed(handoffTree) ||
    !isCycle2jCoreTreeAllowed(cycle2jCoreTree) ||
    !isCycle2jAcceptanceTreeAllowed(cycle2jAcceptanceTree) ||
    (!isCycle2kCoreTreeAllowed(cycle2kCoreTree) &&
      !isCycle2mCoreTreeAllowed(cycle2kCoreTree)) ||
    (!isCycle2kAcceptanceTreeAllowed(cycle2kAcceptanceTree) &&
      !isCycle2mAcceptanceTreeAllowed(cycle2kAcceptanceTree) &&
      !isCycle2oAcceptanceTreeAllowed(cycle2kAcceptanceTree))
  )
    invalid();
  const cycle2pSurfaceDiffPaths = await cycle2pTransitionSurfaceDiffPaths(
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
  const cycle2iBaselineDiffPaths = await cycle2iTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2jBaselineDiffPaths = await cycle2jTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2kBaselineDiffPaths = await cycle2kTransitionSurfaceDiffPaths(
    repositoryPath,
    revision,
  );
  const cycle2mBaselineDiffPaths = await cycle2mTransitionSurfaceDiffPaths(
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
  const cycle2nDiffPaths = entries.map((entry) => entry.path);
  if (cycle2wRoutingRequired) {
    // The exact non-evidence Cycle 2w transition was verified before Cycle 2v
    // and all inherited evidence and cumulative allowlists.
  } else if (cycle2vRoutingRequired) {
    // The exact non-evidence Cycle 2v transition was verified before Cycle 2u
    // and all inherited evidence and cumulative allowlists.
  } else if (cycle2uRoutingRequired) {
    // The exact non-evidence Cycle 2u transition was verified before Cycle 2s
    // and all inherited evidence and cumulative allowlists.
  } else if (cycle2sRoutingRequired) {
    // The exact non-evidence Cycle 2s transition was verified before Cycle 2r
    // and all inherited evidence and cumulative allowlists.
  } else if (cycle2rRoutingRequired) {
    // The exact non-evidence Cycle 2r transition was verified before Cycle 2q
    // and all inherited evidence and cumulative allowlists.
  } else if (cycle2qRoutingRequired) {
    // The exact non-evidence Cycle 2q transition was verified before the
    // inherited cumulative allowlists, which intentionally stop at Cycle 2p.
  } else if (isCycle2pTransitionRoutingRequired(cycle2pSurfaceDiffPaths))
    await verifyCycle2pTransition(repositoryPath, revision);
  else if (isCycle2oTransitionRoutingRequired(cycle2nDiffPaths))
    await verifyCycle2oTransition(repositoryPath, revision);
  else if (isCycle2nTransitionRoutingRequired(cycle2nDiffPaths))
    await verifyCycle2nTransition(repositoryPath, revision);
  else if (isCycle2mTransitionRoutingRequired(cycle2mBaselineDiffPaths))
    await verifyCycle2mTransition(repositoryPath, revision);
  else if (isCycle2kTransitionRoutingRequired(cycle2kBaselineDiffPaths))
    await verifyCycle2kTransition(repositoryPath, revision);
  else if (isCycle2jTransitionRoutingRequired(cycle2jBaselineDiffPaths))
    await verifyCycle2jTransition(repositoryPath, revision);
  else if (isCycle2iTransitionRoutingRequired(cycle2iBaselineDiffPaths))
    await verifyCycle2iTransition(repositoryPath, revision);
  else if (
    isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(
      pnpmDependencyPolicyMaintenanceSurfaceDiffPaths,
      entries,
    )
  )
    await verifyPnpmDependencyPolicyMaintenanceTransition(
      repositoryPath,
      revision,
    );
  else if (
    isAuthenticatedReplayMaintenanceSurfaceRoutingRequired(
      authenticatedReplayMaintenanceSurfaceDiffPaths,
    )
  )
    await verifyAuthenticatedReplayMaintenanceTransition(
      repositoryPath,
      revision,
    );
  else if (
    isOfflineEvidenceInputCustodySurfaceRoutingRequired(
      offlineEvidenceInputCustodySurfaceDiffPaths,
    )
  )
    await verifyOfflineEvidenceInputCustodyTransition(repositoryPath, revision);
  else if (
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
  if (path === ".npmrc") return status === "D";
  return (
    (status === "A" || status === "M") &&
    path !== undefined &&
    (CYCLE_2C_DIFF_ALLOWLIST.has(path) ||
      CYCLE_2D_TRANSITION_PATHS.has(path) ||
      CYCLE_2E_TRANSITION_PATHS.has(path) ||
      CYCLE_2F_TRANSITION_PATHS.has(path) ||
      CYCLE_2G_TRANSITION_PATHS.has(path) ||
      CYCLE_2H_TRANSITION_PATHS.has(path) ||
      CYCLE_2I_TRANSITION_PATHS.has(path) ||
      CYCLE_2J_TRANSITION_PATHS.has(path) ||
      CYCLE_2K_TRANSITION_PATHS.has(path) ||
      CYCLE_2O_TRANSITION_PATHS.has(path) ||
      CYCLE_2N_TRANSITION_PATHS.has(path) ||
      CYCLE_2O_PRE_BASELINE_ADMISSION_VALIDITY_PATHS.includes(path) ||
      CYCLE_2M_TRANSITION_PATHS.has(path) ||
      FASTIFY_5_12_1_MAINTENANCE_TRANSITION_PATHS.has(path) ||
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_TRANSITION_PATHS.has(path))
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
        isCycle2hPreBaselineCumulativeDiffEntry(entry.status, entry.path) ||
        isCycle2mPreBaselineCumulativeDiffEntry(entry.status, entry.path),
    ) &&
    (exactList(paths, CYCLE_2C_LEGACY_DIFF_PATHS) ||
      exactList(paths, CYCLE_2C_DIFF_PATHS) ||
      exactList(paths, CYCLE_2D_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2E_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2F_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2G_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2H_BASELINE_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2H_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, FASTIFY_5_12_1_MAINTENANCE_CUMULATIVE_DIFF_PATHS) ||
      exactList(
        paths,
        PNPM_DEPENDENCY_POLICY_MAINTENANCE_CUMULATIVE_DIFF_PATHS,
      ) ||
      exactList(paths, CYCLE_2I_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2J_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2K_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2M_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2N_CUMULATIVE_DIFF_PATHS) ||
      exactList(paths, CYCLE_2O_CUMULATIVE_DIFF_PATHS))
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

function isCycle2mPreBaselineCumulativeDiffEntry(
  status: string | undefined,
  path: string | undefined,
): boolean {
  const expected = CYCLE_2M_PRE_BASELINE_CUMULATIVE_ENTRIES.find(
    (entry) => entry.path === path,
  );
  return expected !== undefined && expected.status === status;
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

/** @internal Exact disconnected-successor tree regression seam. */
export function isCycle2iHandoffTreeAllowed(paths: readonly string[]): boolean {
  return paths.length === 0 || exactList(paths, CYCLE_2I_HANDOFF_PACKAGE_TREE);
}

/** @internal Exact disconnected-successor tree regression seam. */
export function isCycle2jCoreTreeAllowed(paths: readonly string[]): boolean {
  return paths.length === 0 || exactList(paths, CYCLE_2J_CORE_PACKAGE_TREE);
}

/** @internal Exact disconnected-successor tree regression seam. */
export function isCycle2jAcceptanceTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 || exactList(paths, CYCLE_2J_ACCEPTANCE_PACKAGE_TREE)
  );
}

/** @internal Exact disconnected-successor tree regression seam. */
export function isCycle2kCoreTreeAllowed(paths: readonly string[]): boolean {
  return paths.length === 0 || exactList(paths, CYCLE_2K_CORE_PACKAGE_TREE);
}

/** @internal Exact disconnected-successor tree regression seam. */
export function isCycle2kAcceptanceTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 || exactList(paths, CYCLE_2K_ACCEPTANCE_PACKAGE_TREE)
  );
}

/** @internal Exact disconnected-successor tree regression seam. */
export function isCycle2mCoreTreeAllowed(paths: readonly string[]): boolean {
  return paths.length === 0 || exactList(paths, CYCLE_2M_CORE_PACKAGE_TREE);
}

/** @internal Exact disconnected-successor tree regression seam. */
export function isCycle2mAcceptanceTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 || exactList(paths, CYCLE_2M_ACCEPTANCE_PACKAGE_TREE)
  );
}

/** @internal Exact successor-routing regression seam. */
export function isCycle2mBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2M_BASELINE_REVISION;
}

/** @internal Exact successor-routing regression seam. */
export function isCycle2kBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2K_BASELINE_REVISION;
}

/** @internal Exact successor-routing regression seam. */
export function isCycle2jBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2J_BASELINE_REVISION;
}

/** @internal Exact successor-routing regression seam. */
export function isCycle2iBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2I_BASELINE_REVISION;
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

/** @internal Exact pnpm-dependency-policy maintenance successor routing seam. */
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

/** @internal Exact Cycle 2m successor routing regression seam. */
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

/** @internal Exact Cycle 2p promotion baseline regression seam. */
export function isCycle2pBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2P_BASELINE_REVISION;
}

/** @internal Cycle 2p source is the exact direct child of the promoted Cycle 2o docs. */
export function isCycle2pDirectChildAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
): boolean {
  return (
    successorCount === "1" &&
    firstParentCount === "1" &&
    COMMIT.test(revision) &&
    revision === CYCLE_2P_SOURCE_REVISION &&
    parentLine === `${revision} ${CYCLE_2P_BASELINE_REVISION}`
  );
}

/** @internal Cycle 2p corrective promotion is one exact child of the frozen source. */
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
    COMMIT.test(revision) &&
    revision !== CYCLE_2P_BASELINE_REVISION &&
    revision !== CYCLE_2P_SOURCE_REVISION &&
    parentLine === `${revision} ${CYCLE_2P_SOURCE_REVISION}` &&
    sourceParentLine ===
      `${CYCLE_2P_SOURCE_REVISION} ${CYCLE_2P_BASELINE_REVISION}`
  );
}

/** @internal Historical P1 source/corrective ancestry regression seam. */
export function isCycle2pHistoricalChainAllowed(
  mergeBase: string | undefined,
  successorCount: string,
  firstParentCount: string,
  correctiveParentLine: string,
  sourceParentLine: string,
): boolean {
  return (
    mergeBase === CYCLE_2P_HISTORICAL_BASELINE_REVISION &&
    successorCount === "2" &&
    firstParentCount === "2" &&
    correctiveParentLine ===
      `${CYCLE_2P_HISTORICAL_CORRECTIVE_REVISION} ${CYCLE_2P_HISTORICAL_SOURCE_REVISION}` &&
    sourceParentLine ===
      `${CYCLE_2P_HISTORICAL_SOURCE_REVISION} ${CYCLE_2P_HISTORICAL_BASELINE_REVISION}`
  );
}

/** @internal Any Cycle 2p protected-surface touch must route and fail closed. */
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

/** @internal Exact Cycle 2q personal-use profile baseline regression seam. */
export function isCycle2qBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2Q_BASELINE_REVISION;
}

/** @internal Cycle 2q source is one exact direct child of its promoted baseline. */
export function isCycle2qDirectChildAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
): boolean {
  return (
    successorCount === "1" &&
    firstParentCount === "1" &&
    COMMIT.test(revision) &&
    revision !== CYCLE_2Q_BASELINE_REVISION &&
    parentLine === `${revision} ${CYCLE_2Q_BASELINE_REVISION}`
  );
}

/** @internal Any Cycle 2q protected-surface touch must route and fail closed. */
export function isCycle2qTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.some((path) => CYCLE_2Q_PROTECTED_SURFACE_PATHS.has(path))
  );
}

/** @internal Exact Cycle 2w personal raw fact-extraction baseline seam. */
export function isCycle2wBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2W_BASELINE_REVISION;
}

/** @internal Cycle 2w source is one exact direct child of promoted Cycle 2v docs. */
export function isCycle2wDirectChildAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
): boolean {
  return (
    successorCount === "1" &&
    firstParentCount === "1" &&
    COMMIT.test(revision) &&
    revision !== CYCLE_2W_BASELINE_REVISION &&
    parentLine === `${revision} ${CYCLE_2W_BASELINE_REVISION}`
  );
}

/** @internal Any Cycle 2w protected-surface touch must route and fail closed. */
export function isCycle2wTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.some((path) => CYCLE_2W_PROTECTED_SURFACE_PATHS.has(path))
  );
}

/** @internal Exact Cycle 2v personal fact-comparison baseline seam. */
export function isCycle2vBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2V_BASELINE_REVISION;
}

/** @internal Cycle 2v source is one exact direct child of promoted Cycle 2u docs. */
export function isCycle2vDirectChildAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
): boolean {
  return (
    successorCount === "1" &&
    firstParentCount === "1" &&
    COMMIT.test(revision) &&
    revision !== CYCLE_2V_BASELINE_REVISION &&
    parentLine === `${revision} ${CYCLE_2V_BASELINE_REVISION}`
  );
}

/** @internal Any Cycle 2v protected-surface touch must route and fail closed. */
export function isCycle2vTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.some((path) => CYCLE_2V_PROTECTED_SURFACE_PATHS.has(path))
  );
}

/** @internal Exact Cycle 2u personal fact-normalization baseline seam. */
export function isCycle2uBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2U_BASELINE_REVISION;
}

/** @internal Cycle 2u source is one exact direct child of promoted Cycle 2s docs. */
export function isCycle2uDirectChildAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
): boolean {
  return (
    successorCount === "1" &&
    firstParentCount === "1" &&
    COMMIT.test(revision) &&
    revision !== CYCLE_2U_BASELINE_REVISION &&
    parentLine === `${revision} ${CYCLE_2U_BASELINE_REVISION}`
  );
}

/** @internal Any Cycle 2u protected-surface touch must route and fail closed. */
export function isCycle2uTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.some((path) => CYCLE_2U_PROTECTED_SURFACE_PATHS.has(path))
  );
}

/** @internal Exact Cycle 2s personal payload-custody baseline regression seam. */
export function isCycle2sBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2S_BASELINE_REVISION;
}

/** @internal Cycle 2s source is one exact direct child of promoted Cycle 2r docs. */
export function isCycle2sDirectChildAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
): boolean {
  return (
    successorCount === "1" &&
    firstParentCount === "1" &&
    COMMIT.test(revision) &&
    revision !== CYCLE_2S_BASELINE_REVISION &&
    parentLine === `${revision} ${CYCLE_2S_BASELINE_REVISION}`
  );
}

/** @internal Any Cycle 2s protected-surface touch must route and fail closed. */
export function isCycle2sTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.some((path) => CYCLE_2S_PROTECTED_SURFACE_PATHS.has(path))
  );
}

/** @internal Exact Cycle 2r personal payload-identity baseline regression seam. */
export function isCycle2rBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === CYCLE_2R_BASELINE_REVISION;
}

/** @internal Cycle 2r source is one exact direct child of promoted Cycle 2q docs. */
export function isCycle2rDirectChildAllowed(
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
): boolean {
  return (
    successorCount === "1" &&
    firstParentCount === "1" &&
    COMMIT.test(revision) &&
    revision !== CYCLE_2R_BASELINE_REVISION &&
    parentLine === `${revision} ${CYCLE_2R_BASELINE_REVISION}`
  );
}

/** @internal Any Cycle 2r protected-surface touch must route and fail closed. */
export function isCycle2rTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    baselineDiffPaths.some((path) => CYCLE_2R_PROTECTED_SURFACE_PATHS.has(path))
  );
}

/** @internal Exact Cycle 2o custody-quality composition tree regression seam. */
export function isCycle2oCompositionTreeAllowed(
  paths: readonly string[],
): boolean {
  return exactList(paths, CYCLE_2O_COMPOSITION_PACKAGE_TREE);
}

/** @internal Exact Cycle 2o expanded custody tree regression seam. */
export function isCycle2oCustodyTreeAllowed(paths: readonly string[]): boolean {
  return exactList(paths, CYCLE_2O_CUSTODY_PACKAGE_TREE);
}

/** @internal Exact Cycle 2o expanded acceptance tree regression seam. */
export function isCycle2oAcceptanceTreeAllowed(
  paths: readonly string[],
): boolean {
  return exactList(paths, CYCLE_2O_ACCEPTANCE_PACKAGE_TREE);
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
    COMMIT.test(revision) &&
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
    COMMIT.test(revision) &&
    revision !== CYCLE_2O_BASELINE_REVISION &&
    revision !== CYCLE_2O_SOURCE_REVISION &&
    parentLine === `${revision} ${CYCLE_2O_SOURCE_REVISION}` &&
    sourceParentLine ===
      `${CYCLE_2O_SOURCE_REVISION} ${CYCLE_2O_BASELINE_REVISION}`
  );
}

/** @internal Cycle 2o must route before cumulative Cycle 2n. */
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

/** @internal Exact Cycle 2n composition-package tree regression seam. */
export function isCycle2nCompositionTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 || exactList(paths, CYCLE_2N_COMPOSITION_PACKAGE_TREE)
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
    COMMIT.test(revision) &&
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

/** @internal Exact pnpm-dependency-policy maintenance successor routing seam. */
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

/** @internal Exact pnpm-dependency-policy maintenance successor routing seam. */
export function isPnpmDependencyPolicyMaintenanceTransitionRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
  cumulativeDiffEntries: readonly { readonly path: string }[],
): boolean {
  return (
    isPnpmDependencyPolicyMaintenanceSurfaceRoutingRequired(
      baselineDiffPaths,
    ) ||
    cumulativeDiffEntries.some((entry) =>
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_CUMULATIVE_MARKER_PATHS.has(
        entry.path,
      ),
    )
  );
}

/** @internal Exact authenticated-replay maintenance successor routing seam. */
export function isAuthenticatedReplayMaintenanceBaselineMergeBaseAllowed(
  mergeBase: string | undefined,
): boolean {
  return mergeBase === AUTHENTICATED_REPLAY_MAINTENANCE_BASELINE_REVISION;
}

/** @internal Exact authenticated-replay maintenance successor routing seam. */
export function isAuthenticatedReplayMaintenanceSurfaceRoutingRequired(
  baselineDiffPaths: readonly string[] | undefined,
): boolean {
  return (
    baselineDiffPaths !== undefined &&
    exactList(
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

/** @internal Exact pnpm-dependency-policy maintenance successor regression seam. */
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

/** @internal Exact Cycle 2m successor regression seam. */
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

function exactCycle2pDiffSet(
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

/** @internal Exact Cycle 2p successor transition regression seam. */
export function isCycle2pCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactCycle2pDiffSet(entries, CYCLE_2P_TRANSITION);
}

/** @internal Exact Cycle 2p Windows-identity corrective-child transition. */
export function isCycle2pCorrectiveCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactCycle2pDiffSet(entries, CYCLE_2P_CORRECTIVE_TRANSITION);
}

/** @internal Exact Cycle 2p source-through-corrective cumulative transition. */
export function isCycle2pCumulativeDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactCycle2pDiffSet(entries, CYCLE_2P_CUMULATIVE_TRANSITION);
}

/** @internal Exact historical P1 source transition regression seam. */
export function isCycle2pHistoricalSourceDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactCycle2pDiffSet(entries, CYCLE_2P_HISTORICAL_SOURCE_TRANSITION);
}

/** @internal Exact historical P1 corrective transition regression seam. */
export function isCycle2pHistoricalCorrectiveDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactCycle2pDiffSet(
    entries,
    CYCLE_2P_HISTORICAL_CORRECTIVE_TRANSITION,
  );
}

/** @internal Exact historical P1 cumulative transition regression seam. */
export function isCycle2pHistoricalDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactCycle2pDiffSet(entries, CYCLE_2P_HISTORICAL_TRANSITION);
}

/** @internal Exact Cycle 2q personal-use profile source transition seam. */
export function isCycle2qCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactCycle2pDiffSet(entries, CYCLE_2Q_SOURCE_TRANSITION);
}

/** @internal Exact Cycle 2w personal raw fact-extraction transition seam. */
export function isCycle2wCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactCycle2pDiffSet(entries, CYCLE_2W_SOURCE_TRANSITION);
}

/** @internal Exact Cycle 2v personal fact-comparison transition seam. */
export function isCycle2vCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactCycle2pDiffSet(entries, CYCLE_2V_SOURCE_TRANSITION);
}

/** @internal Exact Cycle 2u personal fact-normalization transition seam. */
export function isCycle2uCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactCycle2pDiffSet(entries, CYCLE_2U_SOURCE_TRANSITION);
}

/** @internal Exact Cycle 2s personal payload-custody source transition seam. */
export function isCycle2sCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactCycle2pDiffSet(entries, CYCLE_2S_SOURCE_TRANSITION);
}

/** @internal Exact Cycle 2r personal payload-identity source transition seam. */
export function isCycle2rCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  return exactCycle2pDiffSet(entries, CYCLE_2R_SOURCE_TRANSITION);
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

/** @internal Exact Cycle 2m corrective-commit regression seam. */
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

/** @internal Exact Cycle 2m two-commit topology regression seam. */
export function isCycle2mCorrectiveTopologyAllowed(
  revision: string | undefined,
  correctiveParents: readonly string[],
  sourceParents: readonly string[],
  successorCount: number | undefined,
  firstParentSuccessorCount: number | undefined,
): boolean {
  return (
    revision !== undefined &&
    COMMIT.test(revision) &&
    exactList(correctiveParents, [revision, CYCLE_2M_SOURCE_REVISION]) &&
    exactList(sourceParents, [
      CYCLE_2M_SOURCE_REVISION,
      CYCLE_2M_BASELINE_REVISION,
    ]) &&
    successorCount === 2 &&
    firstParentSuccessorCount === 2
  );
}

/** @internal Exact process-output regression seam. */
export function hasNonEmptyStderr(chunks: readonly Uint8Array[]): boolean {
  return chunks.some((chunk) => chunk.byteLength !== 0);
}

/** @internal Exact git-process regression seam. */
export function isGitProcessResultAllowed(
  code: number | null,
  outputBytes: number,
  maximumOutputBytes: number,
  stderr: readonly Uint8Array[],
  timedOut = false,
): boolean {
  return (
    !timedOut &&
    code === 0 &&
    outputBytes <= maximumOutputBytes &&
    !hasNonEmptyStderr(stderr)
  );
}

/** @internal Exact replacement-ref hardening regression seam. */
export function gitArgumentsWithoutReplacementObjects(
  args: readonly string[],
): readonly string[] {
  return Object.freeze([
    "--no-replace-objects",
    "--no-lazy-fetch",
    "-c",
    "advice.graftFileDeprecated=false",
    ...args,
  ]);
}

/** @internal Exact graft-environment hardening regression seam. */
export function gitEnvironmentWithoutGrafts(
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

/** @internal Exact effective-grafts-path regression seam. */
export function decodeCycle2cAbsoluteGitPath(bytes: Uint8Array): string {
  let value: string;
  try {
    value = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
  } catch {
    return invalid();
  }
  const path = value.slice(0, -1);
  if (
    value.includes("\ufeff") ||
    !value.endsWith("\n") ||
    path.length === 0 ||
    /[\0\r\n]/u.test(path) ||
    !isAbsolute(path)
  )
    invalid();
  return path;
}

/** @internal Exact empty-grafts TOCTOU regression seam. */
export function isEmptyGitGraftsSnapshotAllowed(
  pathBefore: SmallRegularFileStat,
  descriptorBefore: SmallRegularFileStat,
  descriptorAfter: SmallRegularFileStat,
  pathAfter: SmallRegularFileStat,
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
        isSameSmallRegularFileState(pathBefore, snapshot),
    )
  );
}

/** @internal Exported only for effective-worktree graft regressions. */
export async function verifyNoEffectiveGitGrafts(
  repositoryPath: string,
  environment: Readonly<NodeJS.ProcessEnv> = process.env,
): Promise<void> {
  const graftsPath = decodeCycle2cAbsoluteGitPath(
    await gitWithAmbientGrafts(
      repositoryPath,
      ["rev-parse", "--path-format=absolute", "--git-path", "info/grafts"],
      MAX_GIT_PATH_BYTES,
      environment,
    ),
  );
  let pathBefore: SmallRegularFileStat;
  try {
    pathBefore = await lstat(graftsPath);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return;
    return invalid();
  }
  if (
    !isEmptyGitGraftsSnapshotAllowed(
      pathBefore,
      pathBefore,
      pathBefore,
      pathBefore,
      0,
    )
  )
    invalid();
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
        !isEmptyGitGraftsSnapshotAllowed(
          pathBefore,
          descriptorBefore,
          descriptorAfter,
          pathAfter,
          bytesRead,
        )
      )
        invalid();
    } finally {
      await handle.close();
    }
  } catch {
    return invalid();
  }
}

async function cycle2wTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2W_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2wBaselineMergeBaseAllowed(mergeBase)) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2W_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2W_PROTECTED_SURFACE_PATHS,
    ]),
  );
}
async function cycle2vTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2V_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2vBaselineMergeBaseAllowed(mergeBase)) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2V_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2V_PROTECTED_SURFACE_PATHS,
    ]),
  );
}

async function cycle2uTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2U_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2uBaselineMergeBaseAllowed(mergeBase)) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2U_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2U_PROTECTED_SURFACE_PATHS,
    ]),
  );
}

async function cycle2sTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2S_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2sBaselineMergeBaseAllowed(mergeBase)) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2S_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2S_PROTECTED_SURFACE_PATHS,
    ]),
  );
}

async function cycle2rTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2R_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2rBaselineMergeBaseAllowed(mergeBase)) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2R_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2R_PROTECTED_SURFACE_PATHS,
    ]),
  );
}

async function cycle2qTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2Q_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2qBaselineMergeBaseAllowed(mergeBase)) return undefined;
  return splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      CYCLE_2Q_BASELINE_REVISION,
      revision,
      "--",
      ...CYCLE_2Q_PROTECTED_SURFACE_PATHS,
    ]),
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

async function pnpmDependencyPolicyMaintenanceTransitionSurfaceDiffPaths(
  repositoryPath: string,
  revision: string,
): Promise<readonly string[] | undefined> {
  const mergeBase = decodeGitRevisionLine(
    await git(repositoryPath, [
      "merge-base",
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_BASELINE_REVISION,
      revision,
    ]),
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
    await git(repositoryPath, [
      "merge-base",
      AUTHENTICATED_REPLAY_MAINTENANCE_BASELINE_REVISION,
      revision,
    ]),
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
    await git(repositoryPath, [
      "merge-base",
      OFFLINE_EVIDENCE_INPUT_CUSTODY_BASELINE_REVISION,
      revision,
    ]),
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
  if (!isCycle2iBaselineMergeBaseAllowed(mergeBase)) invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2iCommitDiffSetAllowed(entries)) invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  return Object.freeze(entries);
}

async function verifyCycle2wTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  for (const requiredRevision of [
    CYCLE_2W_BASELINE_REVISION,
    CYCLE_2V_SOURCE_REVISION,
    CYCLE_2U_SOURCE_REVISION,
    CYCLE_2S_SOURCE_REVISION,
    CYCLE_2R_SOURCE_REVISION,
    CYCLE_2Q_SOURCE_REVISION,
    CYCLE_2P_CORRECTIVE_REVISION,
    CYCLE_2P_HISTORICAL_SOURCE_REVISION,
  ])
    await git(
      repositoryPath,
      ["cat-file", "-e", `${requiredRevision}^{commit}`],
      0,
    );

  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2W_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2wBaselineMergeBaseAllowed(mergeBase)) invalid();
  const range = `${CYCLE_2W_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 32),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      32,
    ),
  );
  const parentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  ).join(" ");
  if (
    !isCycle2wDirectChildAllowed(
      String(successorCount),
      String(firstParentCount),
      revision,
      parentLine,
    )
  )
    invalid();

  const entries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2W_BASELINE_REVISION,
    revision,
  );
  if (!isCycle2wCommitDiffSetAllowed(entries)) invalid();

  await verifyCycle2vTransition(repositoryPath, CYCLE_2V_SOURCE_REVISION);
  const historicalCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "rev-parse",
        `${CYCLE_2P_HISTORICAL_SOURCE_REVISION}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`,
      ],
      64,
    ),
  );
  const currentCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["rev-parse", `${revision}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`],
      64,
    ),
  );
  if (
    !isCycle2pCorpusAdmissionBlobAllowed(
      currentCorpusAdmissionBlob,
      historicalCorpusAdmissionBlob,
    )
  )
    invalid();
}
async function verifyCycle2vTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  for (const requiredRevision of [
    CYCLE_2V_BASELINE_REVISION,
    CYCLE_2U_SOURCE_REVISION,
    CYCLE_2S_SOURCE_REVISION,
    CYCLE_2R_SOURCE_REVISION,
    CYCLE_2Q_SOURCE_REVISION,
    CYCLE_2P_CORRECTIVE_REVISION,
    CYCLE_2P_HISTORICAL_SOURCE_REVISION,
  ])
    await git(
      repositoryPath,
      ["cat-file", "-e", `${requiredRevision}^{commit}`],
      0,
    );

  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2V_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2vBaselineMergeBaseAllowed(mergeBase)) invalid();
  const range = `${CYCLE_2V_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 32),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      32,
    ),
  );
  const parentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  ).join(" ");
  if (
    !isCycle2vDirectChildAllowed(
      String(successorCount),
      String(firstParentCount),
      revision,
      parentLine,
    )
  )
    invalid();

  const entries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2V_BASELINE_REVISION,
    revision,
  );
  if (!isCycle2vCommitDiffSetAllowed(entries)) invalid();

  await verifyCycle2uTransition(repositoryPath, CYCLE_2U_SOURCE_REVISION);
  const historicalCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "rev-parse",
        `${CYCLE_2P_HISTORICAL_SOURCE_REVISION}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`,
      ],
      64,
    ),
  );
  const currentCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["rev-parse", `${revision}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`],
      64,
    ),
  );
  if (
    !isCycle2pCorpusAdmissionBlobAllowed(
      currentCorpusAdmissionBlob,
      historicalCorpusAdmissionBlob,
    )
  )
    invalid();
}

async function verifyCycle2uTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  for (const requiredRevision of [
    CYCLE_2U_BASELINE_REVISION,
    CYCLE_2S_SOURCE_REVISION,
    CYCLE_2R_SOURCE_REVISION,
    CYCLE_2Q_SOURCE_REVISION,
    CYCLE_2P_CORRECTIVE_REVISION,
    CYCLE_2P_HISTORICAL_SOURCE_REVISION,
  ])
    await git(
      repositoryPath,
      ["cat-file", "-e", `${requiredRevision}^{commit}`],
      0,
    );

  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2U_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2uBaselineMergeBaseAllowed(mergeBase)) invalid();
  const range = `${CYCLE_2U_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 32),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      32,
    ),
  );
  const parentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  ).join(" ");
  if (
    !isCycle2uDirectChildAllowed(
      String(successorCount),
      String(firstParentCount),
      revision,
      parentLine,
    )
  )
    invalid();

  const entries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2U_BASELINE_REVISION,
    revision,
  );
  if (!isCycle2uCommitDiffSetAllowed(entries)) invalid();

  await verifyCycle2sTransition(repositoryPath, CYCLE_2S_SOURCE_REVISION);
  const historicalCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "rev-parse",
        `${CYCLE_2P_HISTORICAL_SOURCE_REVISION}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`,
      ],
      64,
    ),
  );
  const currentCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["rev-parse", `${revision}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`],
      64,
    ),
  );
  if (
    !isCycle2pCorpusAdmissionBlobAllowed(
      currentCorpusAdmissionBlob,
      historicalCorpusAdmissionBlob,
    )
  )
    invalid();
}

async function verifyCycle2sTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  for (const requiredRevision of [
    CYCLE_2S_BASELINE_REVISION,
    CYCLE_2R_SOURCE_REVISION,
    CYCLE_2Q_SOURCE_REVISION,
    CYCLE_2P_CORRECTIVE_REVISION,
    CYCLE_2P_HISTORICAL_SOURCE_REVISION,
  ])
    await git(
      repositoryPath,
      ["cat-file", "-e", `${requiredRevision}^{commit}`],
      0,
    );

  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2S_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2sBaselineMergeBaseAllowed(mergeBase)) invalid();
  const range = `${CYCLE_2S_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 32),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      32,
    ),
  );
  const parentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  ).join(" ");
  if (
    !isCycle2sDirectChildAllowed(
      String(successorCount),
      String(firstParentCount),
      revision,
      parentLine,
    )
  )
    invalid();

  const entries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2S_BASELINE_REVISION,
    revision,
  );
  if (!isCycle2sCommitDiffSetAllowed(entries)) invalid();

  await verifyCycle2rTransition(repositoryPath, CYCLE_2R_SOURCE_REVISION);
  const historicalCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "rev-parse",
        `${CYCLE_2P_HISTORICAL_SOURCE_REVISION}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`,
      ],
      64,
    ),
  );
  const currentCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["rev-parse", `${revision}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`],
      64,
    ),
  );
  if (
    !isCycle2pCorpusAdmissionBlobAllowed(
      currentCorpusAdmissionBlob,
      historicalCorpusAdmissionBlob,
    )
  )
    invalid();
}

async function verifyCycle2rTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  for (const requiredRevision of [
    CYCLE_2R_BASELINE_REVISION,
    CYCLE_2Q_SOURCE_REVISION,
    CYCLE_2P_CORRECTIVE_REVISION,
    CYCLE_2P_HISTORICAL_SOURCE_REVISION,
  ])
    await git(
      repositoryPath,
      ["cat-file", "-e", `${requiredRevision}^{commit}`],
      0,
    );

  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2R_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2rBaselineMergeBaseAllowed(mergeBase)) invalid();
  const range = `${CYCLE_2R_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 32),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      32,
    ),
  );
  const parentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  ).join(" ");
  if (
    !isCycle2rDirectChildAllowed(
      String(successorCount),
      String(firstParentCount),
      revision,
      parentLine,
    )
  )
    invalid();

  const entries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2R_BASELINE_REVISION,
    revision,
  );
  if (!isCycle2rCommitDiffSetAllowed(entries)) invalid();

  await verifyCycle2qTransition(repositoryPath, CYCLE_2Q_SOURCE_REVISION);
  const historicalCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "rev-parse",
        `${CYCLE_2P_HISTORICAL_SOURCE_REVISION}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`,
      ],
      64,
    ),
  );
  const currentCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["rev-parse", `${revision}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`],
      64,
    ),
  );
  if (
    !isCycle2pCorpusAdmissionBlobAllowed(
      currentCorpusAdmissionBlob,
      historicalCorpusAdmissionBlob,
    )
  )
    invalid();
}

async function verifyCycle2qTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  for (const requiredRevision of [
    CYCLE_2Q_BASELINE_REVISION,
    CYCLE_2P_CORRECTIVE_REVISION,
    CYCLE_2P_HISTORICAL_SOURCE_REVISION,
  ])
    await git(
      repositoryPath,
      ["cat-file", "-e", `${requiredRevision}^{commit}`],
      0,
    );

  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2Q_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2qBaselineMergeBaseAllowed(mergeBase)) invalid();
  const range = `${CYCLE_2Q_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 32),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      32,
    ),
  );
  const parentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  ).join(" ");
  if (
    !isCycle2qDirectChildAllowed(
      String(successorCount),
      String(firstParentCount),
      revision,
      parentLine,
    )
  )
    invalid();

  const entries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2Q_BASELINE_REVISION,
    revision,
  );
  if (!isCycle2qCommitDiffSetAllowed(entries)) invalid();

  await verifyCycle2pTransition(repositoryPath, CYCLE_2P_CORRECTIVE_REVISION);
  const historicalCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "rev-parse",
        `${CYCLE_2P_HISTORICAL_SOURCE_REVISION}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`,
      ],
      64,
    ),
  );
  const currentCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["rev-parse", `${revision}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`],
      64,
    ),
  );
  if (
    !isCycle2pCorpusAdmissionBlobAllowed(
      currentCorpusAdmissionBlob,
      historicalCorpusAdmissionBlob,
    )
  )
    invalid();
}

async function verifyCycle2pTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  for (const requiredRevision of [
    CYCLE_2P_BASELINE_REVISION,
    CYCLE_2P_SOURCE_REVISION,
    CYCLE_2P_HISTORICAL_BASELINE_REVISION,
    CYCLE_2P_HISTORICAL_SOURCE_REVISION,
    CYCLE_2P_HISTORICAL_CORRECTIVE_REVISION,
  ])
    await git(
      repositoryPath,
      ["cat-file", "-e", `${requiredRevision}^{commit}`],
      0,
    );

  const sourceMergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2P_BASELINE_REVISION, CYCLE_2P_SOURCE_REVISION],
      64,
    ),
  );
  if (!isCycle2pBaselineMergeBaseAllowed(sourceMergeBase)) invalid();
  const sourceRange = `${CYCLE_2P_BASELINE_REVISION}..${CYCLE_2P_SOURCE_REVISION}`;
  const sourceSuccessorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", sourceRange], 32),
  );
  const sourceFirstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", sourceRange],
      32,
    ),
  );
  const cycle2pSourceParentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", CYCLE_2P_SOURCE_REVISION],
      128,
    ),
  ).join(" ");
  if (
    !isCycle2pDirectChildAllowed(
      String(sourceSuccessorCount),
      String(sourceFirstParentCount),
      CYCLE_2P_SOURCE_REVISION,
      cycle2pSourceParentLine,
    )
  )
    invalid();
  const sourceEntries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2P_BASELINE_REVISION,
    CYCLE_2P_SOURCE_REVISION,
  );
  if (!isCycle2pCommitDiffSetAllowed(sourceEntries)) invalid();

  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2P_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2pBaselineMergeBaseAllowed(mergeBase)) invalid();
  const range = `${CYCLE_2P_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 32),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      32,
    ),
  );
  const parentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  ).join(" ");
  const directSource = isCycle2pDirectChildAllowed(
    String(successorCount),
    String(firstParentCount),
    revision,
    parentLine,
  );
  const correctiveChild = isCycle2pCorrectiveTopologyAllowed(
    String(successorCount),
    String(firstParentCount),
    revision,
    parentLine,
    cycle2pSourceParentLine,
  );
  if (!directSource && !correctiveChild) invalid();
  const currentEntries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2P_BASELINE_REVISION,
    revision,
  );
  if (directSource) {
    if (!isCycle2pCommitDiffSetAllowed(currentEntries)) invalid();
  } else {
    const correctiveEntries = await cycle2pDiffEntries(
      repositoryPath,
      CYCLE_2P_SOURCE_REVISION,
      revision,
    );
    if (!isCycle2pCorrectiveCommitDiffSetAllowed(correctiveEntries)) invalid();
    if (!isCycle2pCumulativeDiffSetAllowed(currentEntries)) invalid();
  }

  const historicalMergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "merge-base",
        CYCLE_2P_HISTORICAL_BASELINE_REVISION,
        CYCLE_2P_HISTORICAL_CORRECTIVE_REVISION,
      ],
      64,
    ),
  );
  const historicalRange = `${CYCLE_2P_HISTORICAL_BASELINE_REVISION}..${CYCLE_2P_HISTORICAL_CORRECTIVE_REVISION}`;
  const historicalSuccessorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", historicalRange], 32),
  );
  const historicalFirstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", historicalRange],
      32,
    ),
  );
  const historicalCorrectiveParentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      [
        "rev-list",
        "--parents",
        "--max-count=1",
        CYCLE_2P_HISTORICAL_CORRECTIVE_REVISION,
      ],
      128,
    ),
  ).join(" ");
  const historicalSourceParentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      [
        "rev-list",
        "--parents",
        "--max-count=1",
        CYCLE_2P_HISTORICAL_SOURCE_REVISION,
      ],
      128,
    ),
  ).join(" ");
  if (
    !isCycle2pHistoricalChainAllowed(
      historicalMergeBase,
      String(historicalSuccessorCount),
      String(historicalFirstParentCount),
      historicalCorrectiveParentLine,
      historicalSourceParentLine,
    )
  )
    invalid();

  const historicalSourceEntries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2P_HISTORICAL_BASELINE_REVISION,
    CYCLE_2P_HISTORICAL_SOURCE_REVISION,
  );
  if (!isCycle2pHistoricalSourceDiffSetAllowed(historicalSourceEntries))
    invalid();
  const historicalCorrectiveEntries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2P_HISTORICAL_SOURCE_REVISION,
    CYCLE_2P_HISTORICAL_CORRECTIVE_REVISION,
  );
  if (!isCycle2pHistoricalCorrectiveDiffSetAllowed(historicalCorrectiveEntries))
    invalid();
  const historicalEntries = await cycle2pDiffEntries(
    repositoryPath,
    CYCLE_2P_HISTORICAL_BASELINE_REVISION,
    CYCLE_2P_HISTORICAL_CORRECTIVE_REVISION,
  );
  if (!isCycle2pHistoricalDiffSetAllowed(historicalEntries)) invalid();

  const historicalCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      [
        "rev-parse",
        `${CYCLE_2P_HISTORICAL_SOURCE_REVISION}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`,
      ],
      64,
    ),
  );
  const currentCorpusAdmissionBlob = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["rev-parse", `${revision}:${CYCLE_2P_CORPUS_ADMISSION_PATH}`],
      64,
    ),
  );
  if (
    !isCycle2pCorpusAdmissionBlobAllowed(
      currentCorpusAdmissionBlob,
      historicalCorpusAdmissionBlob,
    )
  )
    invalid();
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
  if (!isCycle2oBaselineMergeBaseAllowed(mergeBase)) invalid();
  const range = `${CYCLE_2O_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 32),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      32,
    ),
  );
  const parentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  ).join(" ");
  const sourceParentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", CYCLE_2O_SOURCE_REVISION],
      128,
    ),
  ).join(" ");
  const directSource = isCycle2oDirectChildAllowed(
    String(successorCount),
    String(firstParentCount),
    revision,
    parentLine,
  );
  const correctiveChild = isCycle2oCorrectiveTopologyAllowed(
    String(successorCount),
    String(firstParentCount),
    revision,
    parentLine,
    sourceParentLine,
  );
  if (!directSource && !correctiveChild) invalid();

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
    if (correctiveDiff.length % 2 !== 0) invalid();
    const correctiveEntries: Array<{
      readonly path: string;
      readonly status: string;
    }> = [];
    for (let index = 0; index < correctiveDiff.length; index += 2) {
      const status = correctiveDiff[index];
      const path = correctiveDiff[index + 1];
      if (status === undefined || path === undefined) invalid();
      correctiveEntries.push(Object.freeze({ path, status }));
    }
    if (!isCycle2oCorrectiveCommitDiffSetAllowed(correctiveEntries)) invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2oCommitDiffSetAllowed(entries)) invalid();

  const [compositionTree, custodyTree, acceptanceTree] = await Promise.all([
    tree(
      repositoryPath,
      revision,
      "packages/filing-parser-custody-quality-composition",
    ),
    tree(repositoryPath, revision, "packages/filing-payload-custody"),
    tree(
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
    invalid();
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
  if (!isCycle2nBaselineMergeBaseAllowed(mergeBase)) invalid();
  const range = `${CYCLE_2N_BASELINE_REVISION}..${revision}`;
  const successorCount = decodeGitCountLine(
    await git(repositoryPath, ["rev-list", "--count", range], 32),
  );
  const firstParentCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--first-parent", "--count", range],
      32,
    ),
  );
  const parentLine = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  ).join(" ");
  if (
    !isCycle2nDirectChildAllowed(
      String(successorCount),
      String(firstParentCount),
      revision,
      parentLine,
    )
  )
    invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2nCommitDiffSetAllowed(entries)) invalid();
  const compositionTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-parser-quality-composition",
  );
  if (!exactList(compositionTree, CYCLE_2N_COMPOSITION_PACKAGE_TREE)) invalid();
}

async function verifyCycle2mTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2M_BASELINE_REVISION}^{commit}`],
    0,
  );
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2M_SOURCE_REVISION}^{commit}`],
    0,
  );
  const mergeBase = decodeGitRevisionLine(
    await git(
      repositoryPath,
      ["merge-base", CYCLE_2M_BASELINE_REVISION, revision],
      64,
    ),
  );
  if (!isCycle2mBaselineMergeBaseAllowed(mergeBase)) invalid();
  const correctiveParents = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", revision],
      128,
    ),
  );
  const sourceParents = decodeGitRevisionParentsLine(
    await git(
      repositoryPath,
      ["rev-list", "--parents", "--max-count=1", CYCLE_2M_SOURCE_REVISION],
      128,
    ),
  );
  const successorCount = decodeGitCountLine(
    await git(
      repositoryPath,
      ["rev-list", "--count", `${CYCLE_2M_BASELINE_REVISION}..${revision}`],
      32,
    ),
  );
  const firstParentSuccessorCount = decodeGitCountLine(
    await git(
      repositoryPath,
      [
        "rev-list",
        "--first-parent",
        "--count",
        `${CYCLE_2M_BASELINE_REVISION}..${revision}`,
      ],
      32,
    ),
  );
  if (
    !isCycle2mCorrectiveTopologyAllowed(
      revision,
      correctiveParents,
      sourceParents,
      successorCount,
      firstParentSuccessorCount,
    )
  )
    invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2mCommitDiffSetAllowed(entries)) invalid();
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
  if (correctiveDiff.length % 2 !== 0) invalid();
  const correctiveEntries: Array<{
    readonly path: string;
    readonly status: string;
  }> = [];
  for (let index = 0; index < correctiveDiff.length; index += 2) {
    const status = correctiveDiff[index];
    const path = correctiveDiff[index + 1];
    if (status === undefined || path === undefined) invalid();
    correctiveEntries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2mCorrectiveCommitDiffSetAllowed(correctiveEntries)) invalid();
  const coreTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-parser-cross-engine-execution",
  );
  const acceptanceTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-parser-cross-engine-execution-acceptance",
  );
  if (
    !exactList(coreTree, CYCLE_2M_CORE_PACKAGE_TREE) ||
    !exactList(acceptanceTree, CYCLE_2M_ACCEPTANCE_PACKAGE_TREE)
  )
    invalid();
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
  if (!isCycle2kBaselineMergeBaseAllowed(mergeBase)) invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2kCommitDiffSetAllowed(entries)) invalid();
  const coreTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-parser-cross-engine-execution",
  );
  const acceptanceTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-parser-cross-engine-execution-acceptance",
  );
  if (
    !exactList(coreTree, CYCLE_2K_CORE_PACKAGE_TREE) ||
    !exactList(acceptanceTree, CYCLE_2K_ACCEPTANCE_PACKAGE_TREE)
  )
    invalid();
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
  if (!isCycle2jBaselineMergeBaseAllowed(mergeBase)) invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2jCommitDiffSetAllowed(entries)) invalid();
  const coreTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-parser-normalization-execution",
  );
  const acceptanceTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-parser-normalization-execution-acceptance",
  );
  if (
    !exactList(coreTree, CYCLE_2J_CORE_PACKAGE_TREE) ||
    !exactList(acceptanceTree, CYCLE_2J_ACCEPTANCE_PACKAGE_TREE)
  )
    invalid();
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
    await git(repositoryPath, [
      "merge-base",
      PNPM_DEPENDENCY_POLICY_MAINTENANCE_BASELINE_REVISION,
      revision,
    ]),
  );
  if (!isPnpmDependencyPolicyMaintenanceBaselineMergeBaseAllowed(mergeBase))
    invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isPnpmDependencyPolicyMaintenanceCommitDiffSetAllowed(entries))
    invalid();
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
    await git(repositoryPath, [
      "merge-base",
      AUTHENTICATED_REPLAY_MAINTENANCE_BASELINE_REVISION,
      revision,
    ]),
  );
  if (!isAuthenticatedReplayMaintenanceBaselineMergeBaseAllowed(mergeBase))
    invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isAuthenticatedReplayMaintenanceCommitDiffSetAllowed(entries)) invalid();
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
    await git(repositoryPath, [
      "merge-base",
      OFFLINE_EVIDENCE_INPUT_CUSTODY_BASELINE_REVISION,
      revision,
    ]),
  );
  if (!isOfflineEvidenceInputCustodyBaselineMergeBaseAllowed(mergeBase))
    invalid();
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
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isOfflineEvidenceInputCustodyCommitDiffSetAllowed(entries)) invalid();
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

export interface SmallRegularFileStat {
  readonly ctimeMs: number;
  readonly dev: number;
  readonly ino: number;
  readonly mtimeMs: number;
  readonly size: number;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

export interface SmallRegularFileHandle {
  close(): Promise<void>;
  read(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<{ readonly bytesRead: number }>;
  stat(): Promise<SmallRegularFileStat>;
}

export interface SmallRegularFileOperations {
  lstat(path: string): Promise<SmallRegularFileStat>;
  readonly noFollowFlag: number | undefined;
  open(path: string, flags: number): Promise<SmallRegularFileHandle>;
  readonly readOnlyFlag: number;
}

const SMALL_REGULAR_FILE_OPERATIONS: SmallRegularFileOperations = Object.freeze(
  {
    lstat: async (path: string) => lstat(path),
    noFollowFlag:
      typeof constants.O_NOFOLLOW === "number"
        ? constants.O_NOFOLLOW
        : undefined,
    open: async (path: string, flags: number) => open(path, flags),
    readOnlyFlag: constants.O_RDONLY,
  },
);

/** @internal Exported only for real-filesystem custody regression tests. */
export async function readSmallRegularFile(
  path: string,
  limit: number,
): Promise<Uint8Array> {
  return readSmallRegularFileWithOperations(
    path,
    limit,
    SMALL_REGULAR_FILE_OPERATIONS,
  );
}

/** @internal Exported only for deterministic file-custody regression tests. */
export async function readSmallRegularFileWithOperations(
  path: string,
  limit: number,
  operations: SmallRegularFileOperations,
): Promise<Uint8Array> {
  const pathBefore = await operations.lstat(path);
  if (!isSmallRegularFileStatAllowed(pathBefore, limit)) invalid();
  const handle = await operations.open(
    path,
    operations.readOnlyFlag |
      (typeof operations.noFollowFlag === "number"
        ? operations.noFollowFlag
        : 0),
  );
  try {
    const descriptorBefore = await handle.stat();
    if (
      !isSmallRegularFileStatAllowed(descriptorBefore, limit) ||
      !isSameSmallRegularFileState(pathBefore, descriptorBefore)
    )
      invalid();
    const bounded = Buffer.alloc(descriptorBefore.size + 1);
    let offset = 0;
    while (offset < bounded.byteLength) {
      const { bytesRead } = await handle.read(
        bounded,
        offset,
        bounded.byteLength - offset,
        offset,
      );
      if (
        !Number.isSafeInteger(bytesRead) ||
        bytesRead < 0 ||
        bytesRead > bounded.byteLength - offset
      )
        invalid();
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const descriptorAfter = await handle.stat();
    const pathAfter = await operations.lstat(path);
    if (
      offset !== descriptorBefore.size ||
      !isSmallRegularFileStatAllowed(descriptorAfter, limit) ||
      !isSmallRegularFileStatAllowed(pathAfter, limit) ||
      !isSameSmallRegularFileState(descriptorBefore, descriptorAfter) ||
      !isSameSmallRegularFileState(descriptorAfter, pathAfter)
    )
      invalid();
    return new Uint8Array(bounded.subarray(0, offset));
  } finally {
    await handle.close();
  }
}

function isSmallRegularFileStatAllowed(
  stat: SmallRegularFileStat,
  limit: number,
): boolean {
  return (
    stat.isFile() &&
    !stat.isSymbolicLink() &&
    Number.isSafeInteger(stat.size) &&
    stat.size >= 1 &&
    stat.size <= limit &&
    Number.isFinite(stat.mtimeMs) &&
    Number.isFinite(stat.ctimeMs)
  );
}

function isSameSmallRegularFileState(
  left: SmallRegularFileStat,
  right: SmallRegularFileStat,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

async function git(
  cwd: string,
  args: readonly string[],
  maximumOutputBytes = MAX_GIT_BYTES,
): Promise<Uint8Array> {
  return spawnGit(
    cwd,
    args,
    maximumOutputBytes,
    gitEnvironmentWithoutGrafts(process.env),
  );
}

function gitWithAmbientGrafts(
  cwd: string,
  args: readonly string[],
  maximumOutputBytes: number,
  environment: Readonly<NodeJS.ProcessEnv>,
): Promise<Uint8Array> {
  return spawnGit(cwd, args, maximumOutputBytes, environment);
}

function spawnGit(
  cwd: string,
  args: readonly string[],
  maximumOutputBytes: number,
  environment: Readonly<NodeJS.ProcessEnv>,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", gitArgumentsWithoutReplacementObjects(args), {
      cwd,
      env: environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
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
      else reject(new Error("git failed"));
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      finish("reject");
    }, GIT_TIMEOUT_MILLISECONDS);
    timeout.unref();
    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > maximumOutputBytes) {
        child.kill("SIGKILL");
        finish("reject");
      } else target.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.once("error", () => finish("reject"));
    child.once("close", (code) => {
      if (
        !isGitProcessResultAllowed(
          code,
          bytes,
          maximumOutputBytes,
          stderr,
          timedOut,
        )
      )
        finish("reject");
      else finish("resolve", new Uint8Array(Buffer.concat(stdout)));
    });
  });
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
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

function decodeGitRevisionParentsLine(bytes: Uint8Array): readonly string[] {
  const text = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  if (
    text.includes("\ufeff") ||
    !/^[0-9a-f]{40}(?: [0-9a-f]{40})*\n$/u.test(text)
  )
    invalid();
  return Object.freeze(text.slice(0, -1).split(" "));
}

function decodeGitCountLine(bytes: Uint8Array): number {
  const text = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  if (text.includes("\ufeff") || !/^(?:0|[1-9][0-9]*)\n$/u.test(text))
    invalid();
  const count = Number(text.slice(0, -1));
  if (!Number.isSafeInteger(count)) invalid();
  return count;
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
