import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { open, readFile, readdir, realpath, stat } from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve as resolvePath,
  sep,
} from "node:path";
import {
  dirname as posixDirname,
  normalize as posixNormalize,
} from "node:path/posix";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const sourceRoots = [
  ".github",
  "apps",
  "config",
  "modules",
  "packages",
  "fixtures",
  "db",
  "infra",
];
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".cts",
  ".json",
  ".js",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".conf",
  ".sql",
  ".ps1",
  ".py",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".xml",
  ".yaml",
  ".yml",
]);
const executableSourceExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
const commandSurfaceExtensions = new Set([
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".yaml",
  ".yml",
]);
const forbiddenText = [
  /investing\.com/i,
  /investing[_ -]?pro/i,
  /restricted_competitor_reference/i,
  /investing_com_research/i,
  /yfinance/i,
  /finviz/i,
  /yahoo finance/i,
  /@?openbb/i,
];
const forbiddenDatabaseText = [
  /\bcopy\b[\s\S]*?\bfrom\b\s+(?:program\b|['"])/i,
  /\b(?:file_fdw|postgres_fdw|dblink|lo_import|pg_read_file|pg_read_binary_file|pg_ls_dir)\b/i,
  /\b(?:http_get|http_post|aws_s3|azure_storage|gcs)\b/i,
  /https?:\/\//i,
  /(?:^|[\s'"])\.\.[\\/]/m,
  /[a-z]:[\\/]/i,
];
const forbiddenDependencies = [
  "@ag-grid-enterprise/core",
  "@novu/api",
  "@openbb/core",
  "ag-grid-enterprise",
  "lightweight-charts",
  "novu",
  "openbb",
  "yfinance",
];
const forbiddenWebModuleImports = [
  "@research-cockpit/db",
  "@research-cockpit/research-state",
];
const forbiddenApiWriteDependencies = [
  "@research-cockpit/db",
  "pg",
  "postgres",
];
const filingParserModule = "@research-cockpit/filing-parser";
const filingPayloadCustodyModule = "@research-cockpit/filing-payload-custody";
const personalFilingCorpusModule =
  "@research-cockpit/personal-filing-corpus" as const;
const connectedSourcePolicyModule =
  "@research-cockpit/connected-source-policy" as const;
const personalSecurityMasterModule =
  "@research-cockpit/personal-security-master" as const;
const personalSecurityMasterSourcePreparationModule =
  `${personalSecurityMasterModule}/sec-openfigi-v1-source-preparation` as const;
const personalSecurityMasterPackagePrefix =
  "packages/personal-security-master/" as const;
const personalSecurityMasterPackagePaths = [
  `${personalSecurityMasterPackagePrefix}package.json`,
  `${personalSecurityMasterPackagePrefix}src/index.ts`,
  `${personalSecurityMasterPackagePrefix}src/personal-security-master-security.test.ts`,
  `${personalSecurityMasterPackagePrefix}src/personal-security-master.test.ts`,
  `${personalSecurityMasterPackagePrefix}src/personal-security-master.ts`,
  `${personalSecurityMasterPackagePrefix}src/sec-openfigi-v1-source-preparation-security.test.ts`,
  `${personalSecurityMasterPackagePrefix}src/sec-openfigi-v1-source-preparation.test.ts`,
  `${personalSecurityMasterPackagePrefix}src/sec-openfigi-v1-source-preparation.ts`,
  `${personalSecurityMasterPackagePrefix}src/test-personal-security-master-builder.ts`,
  `${personalSecurityMasterPackagePrefix}tsconfig.json`,
].sort();
const connectedSourcePolicyPackagePrefix =
  "packages/connected-source-policy/" as const;
const connectedSourcePolicyPackagePaths = [
  `${connectedSourcePolicyPackagePrefix}package.json`,
  `${connectedSourcePolicyPackagePrefix}src/connected-source-policy-security.test.ts`,
  `${connectedSourcePolicyPackagePrefix}src/connected-source-policy.test.ts`,
  `${connectedSourcePolicyPackagePrefix}src/connected-source-policy.ts`,
  `${connectedSourcePolicyPackagePrefix}src/index.ts`,
  `${connectedSourcePolicyPackagePrefix}src/test-connected-source-policy-builder.ts`,
  `${connectedSourcePolicyPackagePrefix}tsconfig.json`,
].sort();
const localResearchVaultModule =
  "@research-cockpit/local-research-vault" as const;
const localResearchVaultPackagePrefix =
  "packages/local-research-vault/" as const;
const localResearchVaultWindowsAclPath =
  `${localResearchVaultPackagePrefix}src/windows-owner-only-acl.ts` as const;
const localResearchVaultCrashRecoveryTestPath =
  `${localResearchVaultPackagePrefix}src/crash-recovery.test.ts` as const;
const localResearchVaultPackagePaths = [
  `${localResearchVaultPackagePrefix}package.json`,
  `${localResearchVaultPackagePrefix}src/canonical-json.ts`,
  localResearchVaultCrashRecoveryTestPath,
  `${localResearchVaultPackagePrefix}src/encrypted-vault-backup.test.ts`,
  `${localResearchVaultPackagePrefix}src/encrypted-vault-backup.ts`,
  `${localResearchVaultPackagePrefix}src/errors.ts`,
  `${localResearchVaultPackagePrefix}src/fixtures/cycle3d-crash-worker.ts`,
  `${localResearchVaultPackagePrefix}src/index.ts`,
  `${localResearchVaultPackagePrefix}src/local-research-vault.ts`,
  `${localResearchVaultPackagePrefix}src/local-vault-paths.test.ts`,
  `${localResearchVaultPackagePrefix}src/local-vault-paths.ts`,
  `${localResearchVaultPackagePrefix}src/model.ts`,
  `${localResearchVaultPackagePrefix}src/recovery-key-file.ts`,
  `${localResearchVaultPackagePrefix}src/sqlite-local-research-vault.test.ts`,
  `${localResearchVaultPackagePrefix}src/sqlite-local-research-vault.ts`,
  `${localResearchVaultPackagePrefix}src/vault-crypto.ts`,
  `${localResearchVaultPackagePrefix}src/vault-schema.ts`,
  `${localResearchVaultPackagePrefix}src/windows-owner-only-acl.test.ts`,
  localResearchVaultWindowsAclPath,
  `${localResearchVaultPackagePrefix}tsconfig.json`,
].sort();
const legacyLocalStateCleanupPath =
  "apps/web/src/lib/legacy-local-state-cleanup.ts" as const;
const legacyLocalStateCleanupComponentPath =
  "apps/web/src/features/research/LegacyLocalStateCleanup.tsx" as const;
const webRootLayoutPath = "apps/web/app/layout.tsx" as const;
const personalFilingCorpusPackagePrefix =
  "packages/personal-filing-corpus/" as const;
const cycle2rPersonalFilingCorpusPackagePaths = [
  `${personalFilingCorpusPackagePrefix}package.json`,
  `${personalFilingCorpusPackagePrefix}src/index.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-corpus-security.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-corpus.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-corpus.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity-security.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity.ts`,
  `${personalFilingCorpusPackagePrefix}tsconfig.json`,
].sort();
const cycle2sPersonalFilingCorpusPackagePaths = [
  ...cycle2rPersonalFilingCorpusPackagePaths,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-custody-security.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-custody.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-custody.ts`,
].sort();
const cycle2uPersonalFilingCorpusPackagePaths = [
  ...cycle2sPersonalFilingCorpusPackagePaths,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-normalization-security.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-normalization.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-normalization.ts`,
  `${personalFilingCorpusPackagePrefix}src/test-personal-filing-fact-builder.ts`,
].sort();
const cycle2vPersonalFilingCorpusPackagePaths = [
  ...cycle2uPersonalFilingCorpusPackagePaths,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-comparison-security.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-comparison.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-comparison.ts`,
  `${personalFilingCorpusPackagePrefix}src/test-personal-filing-fact-comparison-builder.ts`,
  `${personalFilingCorpusPackagePrefix}validator/personal_filing_fact_validator.py`,
].sort();
const cycle2wPersonalFilingCorpusPackagePaths = [
  ...cycle2vPersonalFilingCorpusPackagePaths,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-raw-fact-extraction-security.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-raw-fact-extraction.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-raw-fact-extraction.ts`,
  `${personalFilingCorpusPackagePrefix}src/test-personal-filing-raw-fact-extraction-builder.ts`,
  `${personalFilingCorpusPackagePrefix}validator/personal_filing_raw_fact_extractor.py`,
].sort();
const cycle2xPersonalFilingCorpusPackagePaths = [
  ...cycle2wPersonalFilingCorpusPackagePaths,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-quality-measurement-security.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-quality-measurement.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-quality-measurement.ts`,
  `${personalFilingCorpusPackagePrefix}src/test-personal-filing-quality-measurement-builder.ts`,
].sort();
const personalFilingCorpusPackagePaths = [
  ...cycle2xPersonalFilingCorpusPackagePaths,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-dossier-security.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-dossier.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-dossier.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-selected-fact-release.test.ts`,
  `${personalFilingCorpusPackagePrefix}src/personal-filing-selected-fact-release.ts`,
  `${personalFilingCorpusPackagePrefix}src/test-personal-filing-dossier-builder.ts`,
].sort();
const cycle2qBaselineRevision =
  "2f0534d2a5b4206221cc66ece5e03cf529e5d373" as const;
const cycle2qCorpusAdmissionPath =
  "packages/filing-parser/src/corpus-admission.ts" as const;
const cycle2qCorpusAdmissionBlob =
  "e456cae97cf9eb377e3b3e8aabc156fdb377e2c7" as const;
const cycle2qSourceRevision =
  "398bb280593b6de125c5561ac9dd1b1c0fe254bd" as const;
const cycle2rBaselineRevision =
  "436f7fed6af9efaec21a26e5709b90073610384e" as const;
const cycle2rSourceRevision =
  "e15ddd8aa923a43fdca730e233abfbe684101e78" as const;
const cycle2sBaselineRevision =
  "a13b51d2cd6862029aa598829e40209ce178c7be" as const;
const cycle2sSourceRevision =
  "78b3880632ff7e54ac493e9c208ee1d93a275aa1" as const;
const cycle2uBaselineRevision =
  "39f0ce974f84e278ec9d12193b284876c928110e" as const;
const cycle2uSourceRevision =
  "4df5549087660b5b5d473c478b03b17576fd4784" as const;
const cycle2vBaselineRevision =
  "90c20e6eeb6c387015af81f74ba4b8e7aebc444b" as const;
const cycle2wBaselineRevision =
  "ad5e3003d3670c84021dabe47c4fb3976274bb23" as const;
const cycle2wSourceRevision =
  "1f7ff096c9187386cad9ae60e1e44861e6e5f842" as const;
const cycle2xBaselineRevision =
  "716a3f6b7ad5a43c48a6a61d18b59c2cd5645018" as const;
const cycle2xSourceRevision =
  "c0138a3121361fc06f210e42febe6af4c6fa3e13" as const;
const cycle2xValidatorIsolationRevision =
  "7f7163d4673360645e332d0b7d28467c15656f8a" as const;
const cycle2qTransition = [
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
  { path: `${personalFilingCorpusPackagePrefix}package.json`, status: "A" },
  { path: `${personalFilingCorpusPackagePrefix}src/index.ts`, status: "A" },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-corpus-security.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-corpus.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-corpus.ts`,
    status: "A",
  },
  { path: `${personalFilingCorpusPackagePrefix}tsconfig.json`, status: "A" },
  { path: "pnpm-lock.yaml", status: "M" },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const cycle2qProtectedPaths = [
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  cycle2qCorpusAdmissionPath,
  ...cycle2qTransition
    .map(({ path }) => path)
    .filter(
      (path) =>
        path !==
        ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    ),
];
const cycle2rTransition = [
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
  { path: `${personalFilingCorpusPackagePrefix}src/index.ts`, status: "M" },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity-security.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity.ts`,
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const cycle2rProtectedPaths = [
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  cycle2qCorpusAdmissionPath,
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  ...cycle2rPersonalFilingCorpusPackagePaths,
  "scripts/verify-boundaries.ts",
];
const cycle2sTransition = [
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
  { path: `${personalFilingCorpusPackagePrefix}src/index.ts`, status: "M" },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-custody-security.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-custody.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-custody.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity-security.test.ts`,
    status: "M",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const cycle2sProtectedPaths = [
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  cycle2qCorpusAdmissionPath,
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  ...cycle2sPersonalFilingCorpusPackagePaths,
  "scripts/verify-boundaries.ts",
];
const cycle2uTransition = [
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
  { path: `${personalFilingCorpusPackagePrefix}src/index.ts`, status: "M" },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-normalization-security.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-normalization.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-normalization.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity-security.test.ts`,
    status: "M",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/test-personal-filing-fact-builder.ts`,
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const cycle2uProtectedPaths = [
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  cycle2qCorpusAdmissionPath,
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  ...cycle2uPersonalFilingCorpusPackagePaths,
  "scripts/verify-boundaries.ts",
];
const cycle2wTransition = [
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
  { path: `${personalFilingCorpusPackagePrefix}src/index.ts`, status: "M" },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity-security.test.ts`,
    status: "M",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-raw-fact-extraction-security.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-raw-fact-extraction.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-raw-fact-extraction.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/test-personal-filing-raw-fact-extraction-builder.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}validator/personal_filing_raw_fact_extractor.py`,
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const cycle2wProtectedPaths = [
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  cycle2qCorpusAdmissionPath,
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  ...cycle2wPersonalFilingCorpusPackagePaths,
  "scripts/verify-boundaries.ts",
];
const cycle2xTransition = [
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
  { path: `${personalFilingCorpusPackagePrefix}src/index.ts`, status: "M" },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity-security.test.ts`,
    status: "M",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-quality-measurement-security.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-quality-measurement.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-quality-measurement.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/test-personal-filing-quality-measurement-builder.ts`,
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const cycle2xValidatorIsolationTransition = [
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-comparison.test.ts`,
    status: "M",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-comparison.ts`,
    status: "M",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/test-personal-filing-fact-comparison-builder.ts`,
    status: "M",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const cycle2xRoutingClosureTransition = [
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
].sort((left, right) => left.path.localeCompare(right.path));
const cycle2xCorrectiveCumulativeTransition = [
  ...cycle2xTransition,
  ...cycle2xValidatorIsolationTransition.filter(
    (entry) =>
      !cycle2xTransition.some((sourceEntry) => sourceEntry.path === entry.path),
  ),
].sort((left, right) => left.path.localeCompare(right.path));
const cycle2xProtectedPaths = [
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  cycle2qCorpusAdmissionPath,
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  ...cycle2xPersonalFilingCorpusPackagePaths,
  "scripts/verify-boundaries.ts",
];

const cycle2vTransition = [
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
  { path: `${personalFilingCorpusPackagePrefix}src/index.ts`, status: "M" },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-comparison-security.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-comparison.test.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-comparison.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity-security.test.ts`,
    status: "M",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}src/test-personal-filing-fact-comparison-builder.ts`,
    status: "A",
  },
  {
    path: `${personalFilingCorpusPackagePrefix}validator/personal_filing_fact_validator.py`,
    status: "A",
  },
  { path: "scripts/verify-boundaries.ts", status: "M" },
].sort((left, right) => left.path.localeCompare(right.path));
const cycle2vProtectedPaths = [
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  cycle2qCorpusAdmissionPath,
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  ...cycle2vPersonalFilingCorpusPackagePaths,
  "scripts/verify-boundaries.ts",
];
const filingFactNormalizationModule =
  "@research-cockpit/filing-fact-normalization";
const filingFactNormalizationSourcePrefix =
  "packages/filing-fact-normalization/src/";
const filingFactNormalizationIndexPath = `${filingFactNormalizationSourcePrefix}index.ts`;
const filingFactNormalizationProductionPath = `${filingFactNormalizationSourcePrefix}filing-fact-normalization.ts`;
const filingFactNormalizationBuilderPath = `${filingFactNormalizationSourcePrefix}test-filing-fact-builder.ts`;
const filingFactNormalizationUnitTestPath = `${filingFactNormalizationSourcePrefix}filing-fact-normalization.test.ts`;
const filingFactNormalizationSecurityTestPath = `${filingFactNormalizationSourcePrefix}filing-fact-normalization-security.test.ts`;
const filingFactNormalizationPublicExports = [
  ["FILING_FACT_CONTRACTS", false],
  ["FILING_FACT_KEYS", false],
  ["FILING_FACT_NORMALIZATION_CHECKS", false],
  ["FILING_FACT_NORMALIZATION_CLAIM", false],
  ["FILING_FACT_NORMALIZATION_LIMITS", false],
  ["FILING_FACT_NORMALIZATION_NOT_PROVEN", false],
  ["FILING_FACT_NORMALIZATION_QUARANTINE_CODES", false],
  ["FILING_FACT_NORMALIZATION_SCHEMA_VERSION", false],
  ["FILING_FACT_PARSER_VERSION", false],
  ["FILING_FACT_TAXONOMY_FAMILY", false],
  ["FILING_FACT_TAXONOMY_VERSION", false],
  ["FilingFactProjectionError", false],
  ["normalizeSyntheticFilingFactPair", false],
  ["projectNormalizedFilingFactsAsKnown", false],
  ["FilingFactContract", true],
  ["FilingFactKey", true],
  ["FilingFactNormalizationAudit", true],
  ["FilingFactNormalizationQuarantineCode", true],
  ["FilingFactNormalizationQuarantinedResult", true],
  ["FilingFactNormalizationRecord", true],
  ["FilingFactNormalizationResult", true],
  ["FilingFactPeriodKind", true],
  ["FilingFactSupersession", true],
  ["FilingFactUnit", true],
  ["NormalizedFilingFactVersion", true],
] as const;
const filingFactNormalizationSourcePaths = new Set([
  filingFactNormalizationBuilderPath,
  filingFactNormalizationIndexPath,
  filingFactNormalizationProductionPath,
  filingFactNormalizationSecurityTestPath,
  filingFactNormalizationUnitTestPath,
]);
const filingFactNormalizationTestModules = new Map<string, readonly string[]>([
  [
    filingFactNormalizationUnitTestPath,
    ["vitest", "./filing-fact-normalization", "./test-filing-fact-builder"],
  ],
  [
    filingFactNormalizationSecurityTestPath,
    [
      "node:crypto",
      "vitest",
      "./filing-fact-normalization",
      "./test-filing-fact-builder",
    ],
  ],
]);
const filingParserNormalizationHandoffModule =
  "@research-cockpit/filing-parser-normalization-handoff";
const filingParserNormalizationExecutionModule =
  "@research-cockpit/filing-parser-normalization-execution";
const filingParserNormalizationExecutionPackagePrefix =
  "packages/filing-parser-normalization-execution/";
const filingParserNormalizationExecutionSourcePrefix = `${filingParserNormalizationExecutionPackagePrefix}src/`;
const filingParserNormalizationExecutionIndexPath = `${filingParserNormalizationExecutionSourcePrefix}index.ts`;
const filingParserNormalizationExecutionProductionPath = `${filingParserNormalizationExecutionSourcePrefix}filing-parser-normalization-execution.ts`;
const filingParserNormalizationExecutionBuilderPath = `${filingParserNormalizationExecutionSourcePrefix}test-filing-parser-normalization-execution-builder.ts`;
const filingParserNormalizationExecutionUnitTestPath = `${filingParserNormalizationExecutionSourcePrefix}filing-parser-normalization-execution.test.ts`;
const filingParserNormalizationExecutionSecurityTestPath = `${filingParserNormalizationExecutionSourcePrefix}filing-parser-normalization-execution-security.test.ts`;
const filingParserNormalizationExecutionWorkerDockerfilePath = `${filingParserNormalizationExecutionPackagePrefix}worker/Dockerfile`;
const filingParserNormalizationExecutionWorkerParserPath = `${filingParserNormalizationExecutionPackagePrefix}worker/parser.py`;
const filingParserNormalizationExecutionWorkerParserTestPath = `${filingParserNormalizationExecutionPackagePrefix}worker/parser_test.py`;
const filingParserNormalizationExecutionWorkerTaxonomyPath = `${filingParserNormalizationExecutionPackagePrefix}worker/taxonomy-v1.json`;
const filingParserNormalizationExecutionImageReviewPath = `${filingParserNormalizationExecutionPackagePrefix}acceptance/python-image.json`;
const filingParserNormalizationExecutionAcceptanceModule =
  "@research-cockpit/filing-parser-normalization-execution-acceptance";
const filingParserCrossEngineExecutionModule =
  "@research-cockpit/filing-parser-cross-engine-execution";
const filingParserCrossEngineExecutionAcceptanceModule =
  "@research-cockpit/filing-parser-cross-engine-execution-acceptance";
const filingParserCrossEngineExecutionPackagePrefix =
  "packages/filing-parser-cross-engine-execution/";
const filingParserCrossEngineExecutionAcceptancePackagePrefix =
  "packages/filing-parser-cross-engine-execution-acceptance/";
const filingParserCrossEngineExecutionAcceptanceSourcePrefix = `${filingParserCrossEngineExecutionAcceptancePackagePrefix}src/`;
const filingParserCrossEngineExecutionRootScriptAliases = [
  "filing-parser-cross-engine-execution:acceptance",
  "filing-parser-cross-engine-execution:evidence-review",
  "guardrails:filing-parser-cross-engine-execution-fixtures",
] as const;
const filingParserCycle2oTransitionPathCount = 39 as const;
const filingParserCycle2oTransitionNulFieldCount = 78 as const;
const filingParserCycle2oTransitionBareSha256 =
  "d830b547c4c0727bd948267819a01e8beba575e2d80d8a5e89fd1d8542b30212" as const;
const filingParserCycle2oTransitionSha256 =
  `sha256:${filingParserCycle2oTransitionBareSha256}` as const;
const filingParserCycle2oSourceRevision =
  "46408ec875755ef531c124846143e9b619c1961f" as const;
const filingParserCycle2oCorrectiveTransitionPaths = [
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
] as const;
const filingParserCycle2oCorrectiveTransitionPathCount = 14 as const;
const filingParserCycle2oCorrectiveTransitionNulFieldCount = 28 as const;
const filingParserCycle2oCorrectiveTransitionBareSha256 =
  "5104d3ef85cfcee8e62010d9a76e3efbf0479dcf7f777fa784e956620b02df63" as const;
const filingParserCycle2oCorrectiveTransitionSha256 =
  `sha256:${filingParserCycle2oCorrectiveTransitionBareSha256}` as const;
const filingParserCrossEngineExecutionCorePaths = [
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
] as const;
const filingParserCrossEngineExecutionAcceptanceSourceNames = [
  "filing-parser-cross-engine-execution-evidence-review.test.ts",
  "filing-parser-cross-engine-execution-evidence-review.ts",
  "filing-parser-cross-engine-execution-evidence-v5.test.ts",
  "filing-parser-cross-engine-execution-evidence-v5.ts",
  "filing-parser-cross-engine-execution-evidence-verifier-v5.test.ts",
  "filing-parser-cross-engine-execution-evidence-verifier-v5.ts",
  "filing-parser-cross-engine-execution-evidence-verifier.test.ts",
  "filing-parser-cross-engine-execution-evidence-verifier.ts",
  "filing-parser-cross-engine-execution-evidence.test.ts",
  "filing-parser-cross-engine-execution-evidence.ts",
  "index.ts",
  "run-filing-parser-cross-engine-execution-acceptance.test.ts",
  "run-filing-parser-cross-engine-execution-acceptance.ts",
  "run-filing-parser-cross-engine-execution-evidence-review.ts",
  "test-filing-parser-cross-engine-execution-evidence-builder.ts",
] as const;
const filingParserCrossEngineExecutionAcceptancePaths = [
  `${filingParserCrossEngineExecutionAcceptancePackagePrefix}package.json`,
  ...filingParserCrossEngineExecutionAcceptanceSourceNames.map(
    (name) =>
      `${filingParserCrossEngineExecutionAcceptancePackagePrefix}src/${name}`,
  ),
  `${filingParserCrossEngineExecutionAcceptancePackagePrefix}tsconfig.json`,
].sort();
const filingParserCrossEngineExecutionPublicExports = [
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_CHECKS", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_CLAIM", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_NOT_PROVEN", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_ROLES", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_SCHEMA_VERSION", false],
  ["FilingParserCrossEngineExecutionConfigurationError", false],
  ["createFilingParserCrossEngineExecutionBoundary", false],
  ["FilingParserCrossEngineExecutionBoundary", true],
  ["FilingParserCrossEngineExecutionConfiguration", true],
  ["FilingParserCrossEngineExecutionEngineConfiguration", true],
  ["FilingParserCrossEngineExecutionEngineProvenance", true],
  ["FilingParserCrossEngineExecutionOptions", true],
  ["FilingParserCrossEngineExecutionProvenance", true],
  ["FilingParserCrossEngineExecutionQuarantinedResult", true],
  ["FilingParserCrossEngineExecutionResult", true],
  ["FilingParserCrossEngineExecutionRole", true],
  ["FilingParserCrossEngineExecutionSuccess", true],
] as const;
const filingParserCrossEngineDirectExecutionPublicExports = [
  ["FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CHECKS", false],
  ["FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM", false],
  ["FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_MODE", false],
  ["FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_NOT_PROVEN", false],
  ["FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_SCHEMA_VERSION", false],
  ["createFilingParserCrossEngineDirectExecutionBoundary", false],
  ["FilingParserCrossEngineDirectExecutionBoundary", true],
  ["FilingParserCrossEngineDirectExecutionConfiguration", true],
  ["FilingParserCrossEngineDirectExecutionEngineConfiguration", true],
  ["FilingParserCrossEngineDirectExecutionEngineLifecycle", true],
  ["FilingParserCrossEngineDirectExecutionLifecycleReceipt", true],
  ["FilingParserCrossEngineDirectExecutionProvenance", true],
  ["FilingParserCrossEngineDirectExecutionQuarantinedResult", true],
  ["FilingParserCrossEngineDirectExecutionResult", true],
  ["FilingParserCrossEngineDirectExecutionSuccess", true],
] as const;
const filingParserCrossEngineExecutionEvidencePublicExports = [
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CHECKS", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CLAIM", false],
  [
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION",
    false,
  ],
  [
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION",
    false,
  ],
  [
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION",
    false,
  ],
  [
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION",
    false,
  ],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_NOT_PROVEN", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SCHEMA_VERSION", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SOURCE_PATHS", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_WORKFLOW", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CASE_IDS", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_SCHEMA_VERSION", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VALIDATION_STAGES", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VERSION", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_WORKFLOW", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CASE_IDS", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CHECKS", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CLAIM", false],
  [
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_DIRECT_EXECUTION_SCHEMA_VERSION",
    false,
  ],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_NOT_PROVEN", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_SCHEMA_VERSION", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_TRANSITION", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_VALIDATION_STAGES", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_VERSION", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_WORKFLOW", false],
  ["FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS", false],
  ["createFilingParserCrossEngineExecutionEvidence", false],
  ["createFilingParserCrossEngineExecutionEvidenceV3", false],
  ["createFilingParserCrossEngineExecutionEvidenceV4", false],
  ["filingParserCrossEngineExecutionEvidenceV3Sha256", false],
  ["filingParserCrossEngineExecutionEvidenceV4Sha256", false],
  ["filingParserCrossEngineExecutionEvidenceSha256", false],
  ["filingParserCrossEngineImplementationSha256", false],
  ["filingParserCrossEngineExecutionV3InvocationBindingSha256", false],
  ["filingParserCrossEngineExecutionV3LifecycleBindingSha256", false],
  ["filingParserCrossEngineExecutionV4CompositionCommitmentSha256", false],
  ["filingParserCrossEngineExecutionV4EvaluationBindingSha256", false],
  ["filingParserCrossEngineExecutionV4ProjectionBindingSha256", false],
  ["filingParserCrossEngineExecutionV4QualityDocumentSha256", false],
  ["parseCanonicalFilingParserCrossEngineExecutionEvidence", false],
  ["parseCanonicalFilingParserCrossEngineExecutionEvidenceV3", false],
  ["parseCanonicalFilingParserCrossEngineExecutionEvidenceV4", false],
  ["serializeCanonicalFilingParserCrossEngineExecutionEvidence", false],
  ["serializeCanonicalFilingParserCrossEngineExecutionEvidenceV3", false],
  ["serializeCanonicalFilingParserCrossEngineExecutionEvidenceV4", false],
  ["FilingParserCrossEngineExecutionEvidence", true],
  ["FilingParserCrossEngineExecutionEvidenceCaseOutcome", true],
  ["FilingParserCrossEngineExecutionEvidenceEngine", true],
  ["FilingParserCrossEngineExecutionEvidenceSourceHash", true],
  ["FilingParserCrossEngineExecutionEvidenceTransitionEntry", true],
  ["FilingParserCrossEngineExecutionEvidenceV3", true],
  ["FilingParserCrossEngineExecutionEvidenceV3CaseId", true],
  ["FilingParserCrossEngineExecutionEvidenceV3CaseOutcome", true],
  ["FilingParserCrossEngineExecutionEvidenceV3Invocation", true],
  ["FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt", true],
  ["FilingParserCrossEngineExecutionEvidenceV4", true],
  ["FilingParserCrossEngineExecutionEvidenceV4CaseId", true],
  ["FilingParserCrossEngineExecutionEvidenceV4CaseOutcome", true],
  ["FilingParserCrossEngineExecutionEvidenceV4Invocation", true],
  ["FilingParserCrossEngineExecutionEvidenceV4ProjectionReceipt", true],
  ["FilingParserCrossEngineExecutionEvidenceV4SourceExecution", true],
] as const;
const filingParserCrossEngineExecutionVerifierPublicExports = [
  [
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_PATH_COUNT",
    false,
  ],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_SHA256", false],
  ["filingParserCrossEngineExecutionV5ChainAllowed", false],
  ["filingParserCrossEngineExecutionV5TransitionAllowed", false],
  ["parseFilingParserCrossEngineExecutionEvidenceNulTransition", false],
  ["repositoryRelativePathIsContained", false],
  ["verifyFilingParserCrossEngineExecutionEvidenceOffline", false],
  ["FilingParserCrossEngineExecutionEvidenceReview", true],
  ["FilingParserCrossEngineExecutionEvidenceReviewOptions", true],
] as const;
const filingParserCrossEngineExecutionEvidenceV5PublicExports = [
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_HISTORY", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CASE_IDS", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CHECKS", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CLAIM", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_NOT_PROVEN", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_SCHEMA_VERSION", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_VALIDATION_STAGES", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_VERSION", false],
  ["FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_WORKFLOW", false],
  ["createFilingParserCrossEngineExecutionEvidenceV5", false],
  ["filingParserCrossEngineExecutionEvidenceV5Sha256", false],
  ["filingParserCrossEngineExecutionV5RequiredSourcePaths", false],
  ["parseCanonicalFilingParserCrossEngineExecutionEvidenceV5", false],
  ["serializeCanonicalFilingParserCrossEngineExecutionEvidenceV5", false],
  ["FilingParserCrossEngineExecutionEvidenceV5", true],
  ["FilingParserCrossEngineExecutionEvidenceV5CaseId", true],
  ["FilingParserCrossEngineExecutionEvidenceV5CaseOutcome", true],
  ["FilingParserCrossEngineExecutionEvidenceV5Invocation", true],
  ["FilingParserCrossEngineExecutionEvidenceV5ValidationStage", true],
] as const;
const filingParserNormalizationExecutionRootScriptAliases = new Set([
  "filing-parser-normalization-execution:acceptance",
  "filing-parser-normalization-execution:evidence-review",
  "guardrails:filing-parser-normalization-execution-fixtures",
]);
const filingParserNormalizationExecutionAcceptancePackagePrefix =
  "packages/filing-parser-normalization-execution-acceptance/";
const filingParserNormalizationExecutionAcceptanceSourcePrefix = `${filingParserNormalizationExecutionAcceptancePackagePrefix}src/`;
const filingParserNormalizationExecutionAcceptanceIndexPath = `${filingParserNormalizationExecutionAcceptanceSourcePrefix}index.ts`;
const filingParserNormalizationExecutionAcceptanceRunnerPath = `${filingParserNormalizationExecutionAcceptanceSourcePrefix}run-filing-parser-normalization-execution-acceptance.ts`;
const filingParserNormalizationExecutionAcceptanceRunnerTestPath = `${filingParserNormalizationExecutionAcceptanceSourcePrefix}run-filing-parser-normalization-execution-acceptance.test.ts`;
const filingParserNormalizationExecutionAcceptanceFailurePhases = [
  "environment",
  "repository_anchor",
  "source_inventory",
  "image_metadata",
  "staging",
  "image_build",
  "image_inspection",
  "audited_setup",
  "audited_success",
  "audited_replay",
  "audited_tamper",
  "audited_role_swap",
  "audited_residue",
  "production_setup",
  "production_success",
  "production_replay",
  "production_tamper",
  "production_residue",
  "evidence_assembly",
  "tool_versions",
  "image_removal",
  "evidence_write",
  "cleanup",
] as const;
const filingParserNormalizationExecutionAcceptanceMarkerSequence = [
  ...filingParserNormalizationExecutionAcceptanceFailurePhases.slice(0, 19),
  "tool_versions",
  "evidence_assembly",
  "image_removal",
  "evidence_write",
  "cleanup",
] as const;
const filingParserNormalizationExecutionAcceptanceNextStatementAnchors = [
  "const environment = acceptanceEnvironment();",
  "const revision = decodeExactLine(",
  "const sourceHashes = await committedSourceHashes(revision);",
  "const imageMetadata = await readPinnedImageMetadata();",
  "const temporaryDirectory = await mkdtemp(",
  "const build = await command(",
  "await verifyBuiltImage(imageId);",
  "const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();",
  "const successStart = recorder.documentOutputs.length;",
  "const replayStart = recorder.documentOutputs.length;",
  "const tamperedOriginal = Uint8Array.from(fixture.originalArchive);",
  "const swapped = await boundary.execute(",
  "recorder.assertComplete();",
  "const productionBoundary = createFilingParserNormalizationExecutionBoundary(",
  "const productionSuccess = await productionBoundary.execute(",
  "const productionReplay = await productionBoundary.execute(",
  "const productionRejected = await productionBoundary.execute(",
  "await assertZeroResidue();",
  "const outcomes: readonly FilingParserNormalizationExecutionEvidenceCaseOutcome[] = Object.freeze([",
  "const tools = await toolVersions();",
  "const evidence = createFilingParserNormalizationExecutionEvidence({",
  "await removeImage(imageId);",
  "temporaryEvidencePath = `${environment.evidencePath}.tmp`;",
  'await Promise.reject( error instanceof Error ? error : new Error("acceptance failed")',
] as const;
const filingParserNormalizationExecutionAcceptanceFailurePrefix =
  "filing_parser_normalization_execution_acceptance_failed phase=";
const filingParserNormalizationExecutionEvidenceReviewPath = `${filingParserNormalizationExecutionAcceptanceSourcePrefix}filing-parser-normalization-execution-evidence-review.ts`;
const filingParserNormalizationExecutionEvidenceReviewTestPath = `${filingParserNormalizationExecutionAcceptanceSourcePrefix}filing-parser-normalization-execution-evidence-review.test.ts`;
const filingParserNormalizationExecutionEvidenceVerifierPath = `${filingParserNormalizationExecutionAcceptanceSourcePrefix}filing-parser-normalization-execution-evidence-verifier.ts`;
const filingParserNormalizationExecutionEvidenceVerifierTestPath = `${filingParserNormalizationExecutionAcceptanceSourcePrefix}filing-parser-normalization-execution-evidence-verifier.test.ts`;
const filingParserNormalizationExecutionEvidencePath = `${filingParserNormalizationExecutionAcceptanceSourcePrefix}filing-parser-normalization-execution-evidence.ts`;
const filingParserNormalizationExecutionEvidenceTestPath = `${filingParserNormalizationExecutionAcceptanceSourcePrefix}filing-parser-normalization-execution-evidence.test.ts`;
const filingParserNormalizationExecutionEvidenceReviewRunnerPath = `${filingParserNormalizationExecutionAcceptanceSourcePrefix}run-filing-parser-normalization-execution-evidence-review.ts`;
const filingParserNormalizationExecutionEvidenceBuilderPath = `${filingParserNormalizationExecutionAcceptanceSourcePrefix}test-filing-parser-normalization-execution-evidence-builder.ts`;
const filingParserNormalizationExecutionFixtureGuardPath =
  "scripts/verify-filing-parser-normalization-execution-fixtures.ts";
const filingParserNormalizationExecutionWorkflowPath =
  ".github/workflows/filing-parser-normalization-execution-acceptance.yml";
const filingParserNormalizationExecutionPublicExports = [
  ["FILING_PARSER_NORMALIZATION_EXECUTION_CHECKS", false],
  ["FILING_PARSER_NORMALIZATION_EXECUTION_CLAIM", false],
  ["FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL", false],
  ["FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS", false],
  ["FILING_PARSER_NORMALIZATION_EXECUTION_NOT_PROVEN", false],
  ["FILING_PARSER_NORMALIZATION_EXECUTION_SCHEMA_VERSION", false],
  ["FilingParserNormalizationExecutionConfigurationError", false],
  ["createFilingParserNormalizationExecutionBoundary", false],
  ["FilingParserNormalizationExecutionBoundary", true],
  ["FilingParserNormalizationExecutionConfiguration", true],
  ["FilingParserNormalizationExecutionOptions", true],
  ["FilingParserNormalizationExecutionProcessRequest", true],
  ["FilingParserNormalizationExecutionProcessResult", true],
  ["FilingParserNormalizationExecutionProcessRunner", true],
  ["FilingParserNormalizationExecutionProvenance", true],
  ["FilingParserNormalizationExecutionQuarantinedResult", true],
  ["FilingParserNormalizationExecutionResult", true],
  ["FilingParserNormalizationExecutionSigner", true],
  ["FilingParserNormalizationExecutionSuccess", true],
] as const;
const filingParserNormalizationExecutionEvidencePublicExports = [
  ["FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CHECKS", false],
  ["FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CLAIM", false],
  ["FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_NOT_PROVEN", false],
  ["FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SCHEMA_VERSION", false],
  ["FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS", false],
  ["FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_WORKFLOW", false],
  ["createFilingParserNormalizationExecutionEvidence", false],
  ["filingParserNormalizationExecutionEvidenceSha256", false],
  ["parseCanonicalFilingParserNormalizationExecutionEvidence", false],
  ["serializeCanonicalFilingParserNormalizationExecutionEvidence", false],
  ["FilingParserNormalizationExecutionEvidence", true],
  ["FilingParserNormalizationExecutionEvidenceCaseOutcome", true],
  ["FilingParserNormalizationExecutionEvidenceSourceHash", true],
] as const;
const filingParserNormalizationExecutionEvidenceVerifierPublicExports = [
  ["verifyFilingParserNormalizationExecutionEvidenceOffline", false],
  ["FilingParserNormalizationExecutionEvidenceReview", true],
  ["FilingParserNormalizationExecutionEvidenceReviewOptions", true],
] as const;
const filingParserNormalizationExecutionSourcePaths = new Set([
  filingParserNormalizationExecutionBuilderPath,
  filingParserNormalizationExecutionIndexPath,
  filingParserNormalizationExecutionProductionPath,
  filingParserNormalizationExecutionSecurityTestPath,
  filingParserNormalizationExecutionUnitTestPath,
]);
const filingParserNormalizationExecutionTestModules = new Map<
  string,
  readonly string[]
>([
  [
    filingParserNormalizationExecutionUnitTestPath,
    [
      "node:crypto",
      "vitest",
      "./filing-parser-normalization-execution",
      "./test-filing-parser-normalization-execution-builder",
    ],
  ],
  [
    filingParserNormalizationExecutionSecurityTestPath,
    [
      "node:crypto",
      "vitest",
      "./filing-parser-normalization-execution",
      "./test-filing-parser-normalization-execution-builder",
    ],
  ],
]);
const filingParserNormalizationExecutionPackagePaths = [
  `${filingParserNormalizationExecutionPackagePrefix}package.json`,
  `${filingParserNormalizationExecutionPackagePrefix}tsconfig.json`,
  filingParserNormalizationExecutionImageReviewPath,
  filingParserNormalizationExecutionWorkerDockerfilePath,
  filingParserNormalizationExecutionWorkerParserPath,
  filingParserNormalizationExecutionWorkerParserTestPath,
  filingParserNormalizationExecutionWorkerTaxonomyPath,
  ...filingParserNormalizationExecutionSourcePaths,
].sort();
const filingParserNormalizationExecutionAcceptanceSourcePaths = new Set([
  filingParserNormalizationExecutionAcceptanceIndexPath,
  filingParserNormalizationExecutionAcceptanceRunnerPath,
  filingParserNormalizationExecutionAcceptanceRunnerTestPath,
  filingParserNormalizationExecutionEvidencePath,
  filingParserNormalizationExecutionEvidenceReviewPath,
  filingParserNormalizationExecutionEvidenceReviewRunnerPath,
  filingParserNormalizationExecutionEvidenceBuilderPath,
  filingParserNormalizationExecutionEvidenceReviewTestPath,
  filingParserNormalizationExecutionEvidenceTestPath,
  filingParserNormalizationExecutionEvidenceVerifierPath,
  filingParserNormalizationExecutionEvidenceVerifierTestPath,
]);
const filingParserNormalizationExecutionAcceptancePackagePaths = [
  `${filingParserNormalizationExecutionAcceptancePackagePrefix}package.json`,
  `${filingParserNormalizationExecutionAcceptancePackagePrefix}tsconfig.json`,
  ...filingParserNormalizationExecutionAcceptanceSourcePaths,
].sort();
const filingParserNormalizationExecutionAcceptanceModules = new Map<
  string,
  readonly string[]
>([
  [
    filingParserNormalizationExecutionAcceptanceIndexPath,
    [
      "./filing-parser-normalization-execution-evidence",
      "./filing-parser-normalization-execution-evidence-verifier",
    ],
  ],
  [filingParserNormalizationExecutionEvidencePath, ["node:crypto"]],
  [
    filingParserNormalizationExecutionEvidenceTestPath,
    [
      "vitest",
      "./filing-parser-normalization-execution-evidence",
      "./test-filing-parser-normalization-execution-evidence-builder",
    ],
  ],
  [
    filingParserNormalizationExecutionEvidenceVerifierPath,
    [
      "node:child_process",
      "node:crypto",
      "node:fs",
      "node:fs/promises",
      "node:path",
      "node:util",
      "./filing-parser-normalization-execution-evidence",
    ],
  ],
  [
    filingParserNormalizationExecutionEvidenceVerifierTestPath,
    [
      "node:child_process",
      "node:crypto",
      "node:fs/promises",
      "node:path",
      "node:os",
      "vitest",
      "./filing-parser-normalization-execution-evidence",
      "./filing-parser-normalization-execution-evidence-verifier",
      "./test-filing-parser-normalization-execution-evidence-builder",
    ],
  ],
  [
    filingParserNormalizationExecutionEvidenceReviewPath,
    ["./filing-parser-normalization-execution-evidence-verifier"],
  ],
  [
    filingParserNormalizationExecutionEvidenceReviewTestPath,
    ["vitest", "./filing-parser-normalization-execution-evidence-review"],
  ],
  [
    filingParserNormalizationExecutionEvidenceReviewRunnerPath,
    ["./filing-parser-normalization-execution-evidence-review"],
  ],
  [
    filingParserNormalizationExecutionEvidenceBuilderPath,
    ["./filing-parser-normalization-execution-evidence"],
  ],
  [
    filingParserNormalizationExecutionAcceptanceRunnerPath,
    [
      "node:crypto",
      "node:fs/promises",
      "node:path",
      "node:child_process",
      "node:url",
      filingParserNormalizationExecutionModule,
      `${filingParserNormalizationExecutionModule}/test`,
      "./filing-parser-normalization-execution-evidence",
    ],
  ],
  [
    filingParserNormalizationExecutionAcceptanceRunnerTestPath,
    [
      "node:child_process",
      "node:url",
      "vitest",
      filingParserNormalizationExecutionModule,
      "./run-filing-parser-normalization-execution-acceptance",
    ],
  ],
]);
const filingParserNormalizationExecutionMetadataLiteralPaths = new Set([
  "scripts/verify-boundaries.ts",
  filingParserNormalizationExecutionFixtureGuardPath,
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
]);
const filingParserNormalizationHandoffPackagePrefix =
  "packages/filing-parser-normalization-handoff/";
const filingParserNormalizationHandoffSourcePrefix = `${filingParserNormalizationHandoffPackagePrefix}src/`;
const filingParserNormalizationHandoffIndexPath = `${filingParserNormalizationHandoffSourcePrefix}index.ts`;
const filingParserNormalizationHandoffProductionPath = `${filingParserNormalizationHandoffSourcePrefix}filing-parser-normalization-handoff.ts`;
const filingParserNormalizationHandoffBuilderPath = `${filingParserNormalizationHandoffSourcePrefix}test-filing-parser-normalization-handoff-builder.ts`;
const filingParserNormalizationHandoffUnitTestPath = `${filingParserNormalizationHandoffSourcePrefix}filing-parser-normalization-handoff.test.ts`;
const filingParserNormalizationHandoffSecurityTestPath = `${filingParserNormalizationHandoffSourcePrefix}filing-parser-normalization-handoff-security.test.ts`;
const filingParserNormalizationHandoffPublicExports = [
  ["FILING_PARSER_NORMALIZATION_HANDOFF_CHECKS", false],
  ["FILING_PARSER_NORMALIZATION_HANDOFF_CLAIM", false],
  ["FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS", false],
  ["FILING_PARSER_NORMALIZATION_HANDOFF_NOT_PROVEN", false],
  ["FILING_PARSER_NORMALIZATION_HANDOFF_SCHEMA_VERSION", false],
  ["handoffAuthenticatedSyntheticFilingParserResults", false],
  ["FilingParserNormalizationHandoffOptions", true],
  ["FilingParserNormalizationHandoffProvenance", true],
  ["FilingParserNormalizationHandoffQuarantinedResult", true],
  ["FilingParserNormalizationHandoffResult", true],
  ["FilingParserNormalizationHandoffSuccess", true],
] as const;
const filingParserNormalizationHandoffSourcePaths = new Set([
  filingParserNormalizationHandoffBuilderPath,
  filingParserNormalizationHandoffIndexPath,
  filingParserNormalizationHandoffProductionPath,
  filingParserNormalizationHandoffSecurityTestPath,
  filingParserNormalizationHandoffUnitTestPath,
]);
const filingParserNormalizationHandoffMetadataLiteralPaths = new Set([
  "scripts/verify-boundaries.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  filingParserNormalizationExecutionEvidencePath,
]);
const boundaryChildProcessExecutionSinkNames = new Set([
  "exec",
  "execFile",
  "execFileSync",
  "execSync",
  "fork",
  "spawn",
  "spawnSync",
]);
const boundaryChildProcessModuleNames = new Set([
  "child_process",
  "node:child_process",
]);
const boundaryTsxExecutionSinkNames = new Set(["tsImport"]);
const filingParserNormalizationHandoffPackagePaths = [
  `${filingParserNormalizationHandoffPackagePrefix}package.json`,
  `${filingParserNormalizationHandoffPackagePrefix}tsconfig.json`,
  ...filingParserNormalizationHandoffSourcePaths,
].sort();
const forbiddenFilingFactNormalizationGlobals = new Set([
  "Bun",
  "Deno",
  "EventSource",
  "Function",
  "SharedWorker",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "console",
  "crypto",
  "eval",
  "fetch",
  "global",
  "globalThis",
  "module",
  "process",
  "require",
]);
const filingFactComparisonModule = "@research-cockpit/filing-fact-comparison";
const filingFactComparisonPackagePrefix = "packages/filing-fact-comparison/";
const filingFactComparisonSourcePrefix = `${filingFactComparisonPackagePrefix}src/`;
const filingFactComparisonIndexPath = `${filingFactComparisonSourcePrefix}index.ts`;
const filingFactComparisonProductionPath = `${filingFactComparisonSourcePrefix}filing-fact-comparison.ts`;
const filingFactComparisonValidatorAPath = `${filingFactComparisonSourcePrefix}declared-validator-a.ts`;
const filingFactComparisonValidatorBPath = `${filingFactComparisonSourcePrefix}declared-validator-b.ts`;
const filingFactComparisonBuilderPath = `${filingFactComparisonSourcePrefix}test-filing-fact-comparison-builder.ts`;
const filingFactComparisonUnitTestPath = `${filingFactComparisonSourcePrefix}filing-fact-comparison.test.ts`;
const filingFactComparisonSecurityTestPath = `${filingFactComparisonSourcePrefix}filing-fact-comparison-security.test.ts`;
const filingFactComparisonPublicExports = [
  ["FILING_FACT_COMPARISON_SCHEMA_VERSION", false],
  ["FILING_FACT_COMPARISON_CLAIM", false],
  ["FILING_FACT_COMPARISON_FACT_KEYS", false],
  ["FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS", false],
  ["FILING_FACT_COMPARISON_CHECKS", false],
  ["FILING_FACT_COMPARISON_NOT_PROVEN", false],
  ["FILING_FACT_COMPARISON_LIMITS", false],
  ["FILING_FACT_COMPARISON_QUARANTINE_CODES", false],
  ["compareSyntheticFilingFactValidatorReports", false],
  ["FilingFactComparisonDeclaredValidatorRole", true],
  ["FilingFactComparisonDeclaredValidatorBinding", true],
  ["FilingFactComparisonReceiptValidatorBinding", true],
  ["FilingFactComparisonAudit", true],
  ["FilingFactComparisonQuarantineCode", true],
  ["FilingFactComparisonAgreementReceipt", true],
  ["FilingFactComparisonQuarantinedResult", true],
  ["FilingFactComparisonResult", true],
] as const;
const filingFactComparisonSourcePaths = new Set([
  filingFactComparisonBuilderPath,
  filingFactComparisonIndexPath,
  filingFactComparisonProductionPath,
  filingFactComparisonSecurityTestPath,
  filingFactComparisonUnitTestPath,
  filingFactComparisonValidatorAPath,
  filingFactComparisonValidatorBPath,
]);
const filingFactComparisonPackagePaths = [
  `${filingFactComparisonPackagePrefix}package.json`,
  `${filingFactComparisonPackagePrefix}tsconfig.json`,
  filingFactComparisonIndexPath,
  filingFactComparisonProductionPath,
  filingFactComparisonValidatorAPath,
  filingFactComparisonValidatorBPath,
  filingFactComparisonBuilderPath,
  filingFactComparisonUnitTestPath,
  filingFactComparisonSecurityTestPath,
].sort();
const filingFactComparisonTestModules = new Map<string, readonly string[]>([
  [
    filingFactComparisonUnitTestPath,
    [
      "vitest",
      "./filing-fact-comparison",
      "./test-filing-fact-comparison-builder",
    ],
  ],
  [
    filingFactComparisonSecurityTestPath,
    [
      "node:crypto",
      "vitest",
      "./filing-fact-comparison",
      "./test-filing-fact-comparison-builder",
    ],
  ],
]);
const forbiddenFilingFactComparisonGlobals = new Set([
  "BroadcastChannel",
  "Bun",
  "Deno",
  "EventSource",
  "Function",
  "MessageChannel",
  "SharedWorker",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "console",
  "crypto",
  "eval",
  "fetch",
  "global",
  "globalThis",
  "module",
  "navigator",
  "process",
  "require",
  "setImmediate",
  "setInterval",
  "setTimeout",
]);
const filingQualityMeasurementModule =
  "@research-cockpit/filing-quality-measurement";
const filingQualityMeasurementPackagePrefix =
  "packages/filing-quality-measurement/";
const filingQualityMeasurementSourcePrefix = `${filingQualityMeasurementPackagePrefix}src/`;
const filingQualityMeasurementIndexPath = `${filingQualityMeasurementSourcePrefix}index.ts`;
const filingQualityMeasurementProductionPath = `${filingQualityMeasurementSourcePrefix}filing-quality-measurement.ts`;
const filingQualityMeasurementBuilderPath = `${filingQualityMeasurementSourcePrefix}test-filing-quality-measurement-builder.ts`;
const filingQualityMeasurementUnitTestPath = `${filingQualityMeasurementSourcePrefix}filing-quality-measurement.test.ts`;
const filingQualityMeasurementSecurityTestPath = `${filingQualityMeasurementSourcePrefix}filing-quality-measurement-security.test.ts`;
const filingQualityMeasurementPublicExports = [
  ["FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION", false],
  ["FILING_QUALITY_MEASUREMENT_CLAIM", false],
  ["FILING_QUALITY_MEASUREMENT_FACT_KEYS", false],
  ["FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS", false],
  ["FILING_QUALITY_MEASUREMENT_METRICS", false],
  ["FILING_QUALITY_MEASUREMENT_THRESHOLDS", false],
  ["FILING_QUALITY_MEASUREMENT_LIMITS", false],
  ["FILING_QUALITY_MEASUREMENT_DECLARATIONS", false],
  ["FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES", false],
  ["FILING_QUALITY_MEASUREMENT_QUARANTINE_CODES", false],
  ["FILING_QUALITY_MEASUREMENT_CHECKS", false],
  ["FILING_QUALITY_MEASUREMENT_NOT_PROVEN", false],
  ["measureSyntheticFilingQuality", false],
  ["FilingQualityMeasurementDeclaration", true],
  ["FilingQualityMeasurementQuarantineCode", true],
  ["FilingQualityMeasurementFailedThreshold", true],
  ["FilingQualityMeasurementRatioMetric", true],
  ["FilingQualityMeasurementSilentMetric", true],
  ["FilingQualityMeasurementCounts", true],
  ["FilingQualityMeasurementMetrics", true],
  ["FilingQualityMeasurementEvaluatedResult", true],
  ["FilingQualityMeasurementQuarantinedResult", true],
  ["FilingQualityMeasurementResult", true],
] as const;
const filingQualityMeasurementSourcePaths = new Set([
  filingQualityMeasurementBuilderPath,
  filingQualityMeasurementIndexPath,
  filingQualityMeasurementProductionPath,
  filingQualityMeasurementSecurityTestPath,
  filingQualityMeasurementUnitTestPath,
]);
const filingQualityMeasurementPackagePaths = [
  `${filingQualityMeasurementPackagePrefix}package.json`,
  `${filingQualityMeasurementPackagePrefix}tsconfig.json`,
  filingQualityMeasurementIndexPath,
  filingQualityMeasurementProductionPath,
  filingQualityMeasurementBuilderPath,
  filingQualityMeasurementUnitTestPath,
  filingQualityMeasurementSecurityTestPath,
].sort();
const filingQualityMeasurementTestModules = new Map<string, readonly string[]>([
  [
    filingQualityMeasurementUnitTestPath,
    [
      "vitest",
      "./filing-quality-measurement",
      "./test-filing-quality-measurement-builder",
    ],
  ],
  [
    filingQualityMeasurementSecurityTestPath,
    [
      "node:crypto",
      "vitest",
      "./filing-quality-measurement",
      "./test-filing-quality-measurement-builder",
    ],
  ],
]);
const forbiddenFilingQualityMeasurementGlobals = new Set([
  "Atomics",
  "BroadcastChannel",
  "Buffer",
  "Bun",
  "Date",
  "Deno",
  "EventSource",
  "Function",
  "MessageChannel",
  "Math",
  "SharedArrayBuffer",
  "SharedWorker",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "console",
  "crypto",
  "eval",
  "fetch",
  "global",
  "globalThis",
  "module",
  "navigator",
  "performance",
  "process",
  "require",
  "setImmediate",
  "setInterval",
  "setTimeout",
]);
const filingQualityPrecommitmentModule =
  "@research-cockpit/filing-quality-precommitment";
const filingQualityPrecommitmentPackagePrefix =
  "packages/filing-quality-precommitment/";
const filingQualityPrecommitmentSourcePrefix = `${filingQualityPrecommitmentPackagePrefix}src/`;
const filingQualityPrecommitmentIndexPath = `${filingQualityPrecommitmentSourcePrefix}index.ts`;
const filingQualityPrecommitmentProductionPath = `${filingQualityPrecommitmentSourcePrefix}filing-quality-precommitment.ts`;
const filingQualityPrecommitmentBuilderPath = `${filingQualityPrecommitmentSourcePrefix}test-filing-quality-precommitment-builder.ts`;
const filingQualityPrecommitmentUnitTestPath = `${filingQualityPrecommitmentSourcePrefix}filing-quality-precommitment.test.ts`;
const filingQualityPrecommitmentSecurityTestPath = `${filingQualityPrecommitmentSourcePrefix}filing-quality-precommitment-security.test.ts`;
const filingParserQualityCompositionModule =
  "@research-cockpit/filing-parser-quality-composition";
const filingParserQualityCompositionPackagePrefix =
  "packages/filing-parser-quality-composition/";
const filingParserQualityCompositionSourcePrefix = `${filingParserQualityCompositionPackagePrefix}src/`;
const filingParserQualityCompositionIndexPath = `${filingParserQualityCompositionSourcePrefix}index.ts`;
const filingParserQualityCompositionProductionPath = `${filingParserQualityCompositionSourcePrefix}filing-parser-quality-composition.ts`;
const filingParserQualityCompositionBuilderPath = `${filingParserQualityCompositionSourcePrefix}test-filing-parser-quality-composition-builder.ts`;
const filingParserQualityCompositionUnitTestPath = `${filingParserQualityCompositionSourcePrefix}filing-parser-quality-composition.test.ts`;
const filingParserQualityCompositionSecurityTestPath = `${filingParserQualityCompositionSourcePrefix}filing-parser-quality-composition-security.test.ts`;
const filingParserCustodyQualityCompositionModule =
  "@research-cockpit/filing-parser-custody-quality-composition";
const filingParserCustodyQualityCompositionPackagePrefix =
  "packages/filing-parser-custody-quality-composition/";
const filingParserCustodyQualityCompositionSourcePrefix = `${filingParserCustodyQualityCompositionPackagePrefix}src/`;
const filingParserCustodyQualityCompositionIndexPath = `${filingParserCustodyQualityCompositionSourcePrefix}index.ts`;
const filingParserCustodyQualityCompositionProductionPath = `${filingParserCustodyQualityCompositionSourcePrefix}filing-parser-custody-quality-composition.ts`;
const filingParserCustodyQualityCompositionBuilderPath = `${filingParserCustodyQualityCompositionSourcePrefix}test-filing-parser-custody-quality-composition-builder.ts`;
const filingParserCustodyQualityCompositionUnitTestPath = `${filingParserCustodyQualityCompositionSourcePrefix}filing-parser-custody-quality-composition.test.ts`;
const filingParserCustodyQualityCompositionSecurityTestPath = `${filingParserCustodyQualityCompositionSourcePrefix}filing-parser-custody-quality-composition-security.test.ts`;
const filingParserCustodyQualityCompositionPackagePaths = [
  `${filingParserCustodyQualityCompositionPackagePrefix}package.json`,
  `${filingParserCustodyQualityCompositionPackagePrefix}tsconfig.json`,
  filingParserCustodyQualityCompositionBuilderPath,
  filingParserCustodyQualityCompositionIndexPath,
  filingParserCustodyQualityCompositionProductionPath,
  filingParserCustodyQualityCompositionSecurityTestPath,
  filingParserCustodyQualityCompositionUnitTestPath,
].sort();
const filingParserCustodyQualityCompositionPublicExports = [
  ["FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CHECKS", false],
  ["FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM", false],
  ["FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE", false],
  ["FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_NOT_PROVEN", false],
  ["FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION", false],
  ["createFilingParserCustodyQualityCompositionProtocol", false],
  ["FilingParserCustodyQualityCompositionAudit", true],
  ["FilingParserCustodyQualityCompositionCapability", true],
  ["FilingParserCustodyQualityCompositionCommitResult", true],
  ["FilingParserCustodyQualityCompositionCommittedResult", true],
  ["FilingParserCustodyQualityCompositionConfiguration", true],
  ["FilingParserCustodyQualityCompositionCustody", true],
  ["FilingParserCustodyQualityCompositionEvaluatedResult", true],
  ["FilingParserCustodyQualityCompositionProtocol", true],
  ["FilingParserCustodyQualityCompositionQuality", true],
  ["FilingParserCustodyQualityCompositionQuarantinedResult", true],
  ["FilingParserCustodyQualityCompositionRevealResult", true],
] as const;
const filingParserQualityCompositionPackagePaths = [
  `${filingParserQualityCompositionPackagePrefix}package.json`,
  `${filingParserQualityCompositionPackagePrefix}tsconfig.json`,
  filingParserQualityCompositionBuilderPath,
  filingParserQualityCompositionIndexPath,
  filingParserQualityCompositionProductionPath,
  filingParserQualityCompositionSecurityTestPath,
  filingParserQualityCompositionUnitTestPath,
].sort();
const filingParserQualityCompositionPublicExports = [
  ["FILING_PARSER_QUALITY_COMPOSITION_CHECKS", false],
  ["FILING_PARSER_QUALITY_COMPOSITION_CLAIM", false],
  ["FILING_PARSER_QUALITY_COMPOSITION_LIMITS", false],
  ["FILING_PARSER_QUALITY_COMPOSITION_NOT_PROVEN", false],
  ["FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION", false],
  ["createFilingParserQualityCompositionProtocol", false],
  ["FilingParserQualityCompositionAudit", true],
  ["FilingParserQualityCompositionCapability", true],
  ["FilingParserQualityCompositionCommitResult", true],
  ["FilingParserQualityCompositionCommittedResult", true],
  ["FilingParserQualityCompositionConfiguration", true],
  ["FilingParserQualityCompositionEvaluatedResult", true],
  ["FilingParserQualityCompositionProjectionReceipt", true],
  ["FilingParserQualityCompositionProtocol", true],
  ["FilingParserQualityCompositionQuarantinedResult", true],
  ["FilingParserQualityCompositionRevealResult", true],
  ["FilingParserQualityCompositionSourceExecution", true],
] as const;
const filingParserCustodyQualityCompositionModules = new Map<
  string,
  readonly string[]
>([
  [
    filingParserCustodyQualityCompositionProductionPath,
    [
      "node:crypto",
      "node:util",
      filingPayloadCustodyModule,
      filingParserQualityCompositionModule,
    ],
  ],
  [
    filingParserCustodyQualityCompositionIndexPath,
    ["./filing-parser-custody-quality-composition"],
  ],
  [
    filingParserCustodyQualityCompositionBuilderPath,
    [
      "node:crypto",
      filingPayloadCustodyModule,
      filingParserQualityCompositionModule,
      "../../filing-parser-quality-composition/src/filing-parser-quality-composition",
      "../../filing-parser-quality-composition/src/test-filing-parser-quality-composition-builder",
      "./filing-parser-custody-quality-composition",
    ],
  ],
  [
    filingParserCustodyQualityCompositionUnitTestPath,
    [
      "vitest",
      filingParserQualityCompositionModule,
      "./filing-parser-custody-quality-composition",
      "./test-filing-parser-custody-quality-composition-builder",
    ],
  ],
  [
    filingParserCustodyQualityCompositionSecurityTestPath,
    [
      "vitest",
      filingPayloadCustodyModule,
      filingParserQualityCompositionModule,
      "../../filing-payload-custody/src/parser-archive-pair-custody",
      "./filing-parser-custody-quality-composition",
      "./index",
      "./test-filing-parser-custody-quality-composition-builder",
    ],
  ],
]);
const forbiddenFilingParserCustodyQualityCompositionGlobals = new Set([
  "Bun",
  "Deno",
  "EventSource",
  "Function",
  "SharedWorker",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "console",
  "crypto",
  "eval",
  "fetch",
  "global",
  "globalThis",
  "module",
  "navigator",
  "process",
  "require",
]);
const filingQualityPrecommitmentPublicExports = [
  ["FILING_QUALITY_PRECOMMITMENT_CHECKS", false],
  ["FILING_QUALITY_PRECOMMITMENT_CLAIM", false],
  ["FILING_QUALITY_PRECOMMITMENT_LIMITS", false],
  ["FILING_QUALITY_PRECOMMITMENT_NOT_PROVEN", false],
  ["FILING_QUALITY_PRECOMMITMENT_QUARANTINE_CODES", false],
  ["FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION", false],
  ["createSyntheticFilingQualityPrecommitmentProtocol", false],
  ["FilingQualityPrecommitmentAudit", true],
  ["FilingQualityPrecommitmentCapability", true],
  ["FilingQualityPrecommitmentCommitResult", true],
  ["FilingQualityPrecommitmentCommittedResult", true],
  ["FilingQualityPrecommitmentEvaluatedResult", true],
  ["FilingQualityPrecommitmentProtocol", true],
  ["FilingQualityPrecommitmentQuarantineCode", true],
  ["FilingQualityPrecommitmentQuarantinedResult", true],
  ["FilingQualityPrecommitmentRevealResult", true],
] as const;
const filingQualityPrecommitmentSourcePaths = new Set([
  filingQualityPrecommitmentBuilderPath,
  filingQualityPrecommitmentIndexPath,
  filingQualityPrecommitmentProductionPath,
  filingQualityPrecommitmentSecurityTestPath,
  filingQualityPrecommitmentUnitTestPath,
]);
const filingQualityPrecommitmentPackagePaths = [
  `${filingQualityPrecommitmentPackagePrefix}package.json`,
  `${filingQualityPrecommitmentPackagePrefix}tsconfig.json`,
  filingQualityPrecommitmentIndexPath,
  filingQualityPrecommitmentProductionPath,
  filingQualityPrecommitmentBuilderPath,
  filingQualityPrecommitmentUnitTestPath,
  filingQualityPrecommitmentSecurityTestPath,
].sort();
const filingQualityPrecommitmentTestModules = new Map<
  string,
  readonly string[]
>([
  [
    filingQualityPrecommitmentUnitTestPath,
    [
      "node:crypto",
      "vitest",
      "./filing-quality-precommitment",
      "./test-filing-quality-precommitment-builder",
    ],
  ],
  [
    filingQualityPrecommitmentSecurityTestPath,
    [
      "node:crypto",
      "vitest",
      "./filing-quality-precommitment",
      "./test-filing-quality-precommitment-builder",
    ],
  ],
]);
const forbiddenFilingQualityPrecommitmentGlobals = new Set([
  "Atomics",
  "BroadcastChannel",
  "Buffer",
  "Bun",
  "Date",
  "Deno",
  "EventSource",
  "Function",
  "MessageChannel",
  "Math",
  "SharedArrayBuffer",
  "SharedWorker",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "console",
  "crypto",
  "eval",
  "fetch",
  "global",
  "globalThis",
  "module",
  "navigator",
  "performance",
  "process",
  "require",
  "setImmediate",
  "setInterval",
  "setTimeout",
]);
const filingPayloadCustodySourcePrefix = "packages/filing-payload-custody/src/";
const filingPayloadCustodyIndexPath = `${filingPayloadCustodySourcePrefix}index.ts`;
const filingPayloadCustodyProductionPath = `${filingPayloadCustodySourcePrefix}payload-custody.ts`;
const filingParserArchivePairCustodyProductionPath = `${filingPayloadCustodySourcePrefix}parser-archive-pair-custody.ts`;
const filingParserArchivePairCustodyUnitTestPath = `${filingPayloadCustodySourcePrefix}parser-archive-pair-custody.test.ts`;
const filingParserArchivePairFixturePath = `${filingPayloadCustodySourcePrefix}parser-archive-pair-fixture.ts`;
const filingPayloadCustodyPackagePaths = [
  "packages/filing-payload-custody/package.json",
  "packages/filing-payload-custody/tsconfig.json",
  `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence-review.test.ts`,
  `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence-review.ts`,
  `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence-verifier.test.ts`,
  `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence-verifier.ts`,
  `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence.test.ts`,
  `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence.ts`,
  filingPayloadCustodyIndexPath,
  filingParserArchivePairCustodyProductionPath,
  filingParserArchivePairCustodyUnitTestPath,
  filingParserArchivePairFixturePath,
  `${filingPayloadCustodySourcePrefix}payload-custody-security.test.ts`,
  `${filingPayloadCustodySourcePrefix}payload-custody.test.ts`,
  filingPayloadCustodyProductionPath,
  `${filingPayloadCustodySourcePrefix}run-filing-payload-custody-acceptance.ts`,
  `${filingPayloadCustodySourcePrefix}run-filing-payload-custody-evidence-review.ts`,
  `${filingPayloadCustodySourcePrefix}test-payload-builder.ts`,
].sort();
const filingPayloadCustodyFixtureGuardPath =
  "scripts/verify-filing-payload-custody-fixtures.ts";
const filingPayloadCustodyFixtureGuardModules = [
  "node:crypto",
  "node:fs",
  "node:fs/promises",
  "node:path",
  "node:url",
  "../packages/filing-payload-custody/src/payload-custody",
  "../packages/filing-payload-custody/src/test-payload-builder",
] as const;
const filingPayloadCustodyPublicExports = [
  ["FILING_PAYLOAD_CUSTODY_ALGORITHM", false],
  ["FILING_PAYLOAD_CUSTODY_CLAIM", false],
  ["FILING_PAYLOAD_CUSTODY_ERROR_CODES", false],
  ["FILING_PAYLOAD_CUSTODY_FIXTURE", false],
  ["FILING_PAYLOAD_CUSTODY_LIMITS", false],
  ["FILING_PAYLOAD_CUSTODY_RETENTION_POLICY", false],
  ["FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION", false],
  ["FilingPayloadCustodyError", false],
  ["createFileSystemFilingPayloadCustodyBoundary", false],
  ["createSyntheticFilingPayloadFixture", false],
  ["createSyntheticInMemoryFilingPayloadKeyStore", false],
  ["FilingPayloadAuditCommand", true],
  ["FilingPayloadAuditRecord", true],
  ["FilingPayloadCustodyBoundary", true],
  ["FilingPayloadCustodyClock", true],
  ["FilingPayloadCustodyEntropy", true],
  ["FilingPayloadCustodyErrorCode", true],
  ["FilingPayloadCustodyOptions", true],
  ["FilingPayloadCustodyReceipt", true],
  ["FilingPayloadCustodyState", true],
  ["FilingPayloadExpireCommand", true],
  ["FilingPayloadKeyStore", true],
  ["FilingPayloadReadCommand", true],
  ["FilingPayloadStageCommand", true],
] as const;
const filingParserArchivePairCustodyPublicExports = [
  ["FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM", false],
  ["FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CHECKS", false],
  ["FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM", false],
  ["FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES", false],
  ["FILING_PARSER_ARCHIVE_PAIR_CUSTODY_NOT_PROVEN", false],
  ["FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION", false],
  ["createFilingParserArchivePairCustodyProtocol", false],
  ["FilingParserArchivePairCustodyProtocol", true],
  ["FilingParserArchivePairCustodyQuarantinedResult", true],
  ["FilingParserArchivePairCustodyReadbackResult", true],
  ["FilingParserArchivePairCustodyReceipt", true],
  ["FilingParserArchivePairCustodyResult", true],
] as const;
const filingParserArchivePairFixturePublicExports = [
  ["createSyntheticFilingParserArchivePairFixture", false],
  ["SyntheticFilingParserArchivePairFixture", true],
] as const;
const filingPayloadCustodyToolPaths = new Set([
  `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence-review.ts`,
  `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence-verifier.ts`,
  `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence.ts`,
  `${filingPayloadCustodySourcePrefix}run-filing-payload-custody-acceptance.ts`,
  `${filingPayloadCustodySourcePrefix}run-filing-payload-custody-evidence-review.ts`,
  `${filingPayloadCustodySourcePrefix}test-payload-builder.ts`,
]);
const filingPayloadCustodyToolModules = new Map<string, readonly string[]>([
  [
    `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence-review.ts`,
    ["./filing-payload-custody-evidence-verifier"],
  ],
  [
    `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence-verifier.ts`,
    [
      "node:crypto",
      "node:child_process",
      "node:fs",
      "node:fs/promises",
      "node:path",
      "./filing-payload-custody-evidence",
    ],
  ],
  [
    `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence.ts`,
    ["node:crypto", "./payload-custody"],
  ],
  [
    `${filingPayloadCustodySourcePrefix}run-filing-payload-custody-acceptance.ts`,
    [
      "node:crypto",
      "node:child_process",
      "node:fs/promises",
      "node:os",
      "node:path",
      "./filing-payload-custody-evidence",
      "./filing-payload-custody-evidence-verifier",
      "./payload-custody",
      "./test-payload-builder",
    ],
  ],
  [
    `${filingPayloadCustodySourcePrefix}run-filing-payload-custody-evidence-review.ts`,
    ["./filing-payload-custody-evidence-review"],
  ],
  [
    `${filingPayloadCustodySourcePrefix}test-payload-builder.ts`,
    ["./payload-custody"],
  ],
]);
const filingPayloadCustodyTestModules = new Set([
  "node:child_process",
  "node:crypto",
  "node:fs",
  "node:fs/promises",
  "node:os",
  "node:path",
  "vitest",
  "./filing-payload-custody-evidence",
  "./filing-payload-custody-evidence-review",
  "./filing-payload-custody-evidence-verifier",
  "./parser-archive-pair-custody",
  "./parser-archive-pair-fixture",
  "./payload-custody",
  "./test-payload-builder",
]);
const filingParserArchivePairCustodyModules = [
  "node:crypto",
  "node:fs",
  "node:fs/promises",
  "node:os",
  "node:path",
  "node:util",
] as const;
const filingParserArchivePairFixtureModules = [
  "node:crypto",
  "./parser-archive-pair-custody",
] as const;
const filingParserArchivePairCustodyTestModules = [
  "node:fs/promises",
  "node:os",
  "node:path",
  "vitest",
  "./parser-archive-pair-custody",
  "./parser-archive-pair-fixture",
] as const;
const forbiddenFilingPayloadCustodyGlobals = new Set([
  "Bun",
  "Deno",
  "EventSource",
  "Function",
  "SharedWorker",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "console",
  "crypto",
  "eval",
  "fetch",
  "global",
  "globalThis",
  "module",
  "process",
  "require",
]);
const forbiddenFilingPayloadCustodyTestGlobals = new Set(
  forbiddenFilingPayloadCustodyGlobals,
);
forbiddenFilingPayloadCustodyTestGlobals.delete("process");
const corpusAdmissionProductionPath =
  "packages/filing-parser/src/corpus-admission.ts";
const forbiddenCorpusAdmissionGlobals = new Set([
  "Bun",
  "Deno",
  "EventSource",
  "Function",
  "SharedWorker",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "console",
  "crypto",
  "eval",
  "fetch",
  "global",
  "globalThis",
  "module",
  "process",
  "require",
]);
const forbiddenWorkerPython = [
  /^\s*(?:from|import)\s+(?:ctypes|ftplib|http|importlib|os|requests|runpy|socket|subprocess|urllib)\b/m,
  /(?:^|[^\w.])(?:__import__|compile|eval|exec)\s*\(/m,
  /\b(?:importlib|runpy)\./,
  /\bos\.(?:popen|spawn\w*|system)\s*\(/,
  /\bsubprocess\./,
];
const allowedWorkerPythonImports = new Set([
  "from __future__ import annotations",
  "from datetime import date, datetime",
  "from pathlib import PurePosixPath",
  "from typing import Final",
  "from xml.etree import ElementTree",
  "import hashlib",
  "import json",
  "import re",
  "import stat",
  "import struct",
  "import sys",
  "import zipfile",
  "import zlib",
]);
const allowedFilingParserNormalizationExecutionWorkerPythonImports = new Set([
  "from __future__ import annotations",
  "from datetime import date, datetime",
  "from pathlib import PurePosixPath",
  "from typing import Final",
  "from xml.etree import ElementTree",
  "import hashlib",
  "import json",
  "import re",
  "import stat",
  "import struct",
  "import sys",
  "import zlib",
]);
const copiedAssetExtensions = new Set([
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);
const ignoredDirectories = new Set([
  ".git",
  ".hg",
  ".next",
  ".svn",
  "coverage",
  "dist",
  "node_modules",
]);
const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;
const exactDependencySections = new Set<DependencySection>([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
]);
const plainExactSemver =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-(?:(?:0|[1-9][0-9]*)|(?:[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))(?:\.(?:(?:0|[1-9][0-9]*)|(?:[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const expectedPnpmSettings = Object.freeze({
  autoInstallPeers: false,
  saveExact: true,
  sharedWorkspaceLockfile: true,
  strictPeerDependencies: true,
});
const expectedPnpmVersion = "11.19.0" as const;
const expectedPackageManager = `pnpm@${expectedPnpmVersion}` as const;
const legacyNpmrcPolicyKeys = new Map([
  ["autoinstallpeers", "autoInstallPeers"],
  ["saveexact", "saveExact"],
  ["sharedworkspacelockfile", "sharedWorkspaceLockfile"],
  ["strictpeerdependencies", "strictPeerDependencies"],
]);
const MAX_PNPM_CONFIG_BYTES = 65_536;
const MAX_TYPESCRIPT_CONFIG_BYTES = 1_048_576;
const MAX_TYPESCRIPT_CONFIG_CHAIN_DEPTH = 32;
const MAX_TYPESCRIPT_CONFIG_FILES = 128;
const violations: string[] = [];
const filesToInspect = new Set<string>();
const externalCompositionFilesToInspect = new Set<string>();
const explicitTypeScriptConfigSelectorFiles = new Set<string>();

for (const sourceRoot of sourceRoots) {
  for (const file of await walk(join(root, sourceRoot)))
    filesToInspect.add(file);
}
filesToInspect.add(join(root, filingPayloadCustodyFixtureGuardPath));
filesToInspect.add(
  join(root, filingParserNormalizationExecutionFixtureGuardPath),
);
for (const file of await walk(root)) {
  const fileName = basename(file).toLowerCase();
  const extension = extname(fileName);
  if (fileName === "package.json") {
    filesToInspect.add(file);
    explicitTypeScriptConfigSelectorFiles.add(file);
  }
  if (isTypeScriptConfigFileName(fileName)) filesToInspect.add(file);
  if (
    commandSurfaceExtensions.has(extension) &&
    (![".yaml", ".yml"].includes(extension) ||
      file.startsWith(join(root, ".github") + sep))
  )
    explicitTypeScriptConfigSelectorFiles.add(file);
  if (
    executableSourceExtensions.has(extension) ||
    (commandSurfaceExtensions.has(extension) &&
      (![".yaml", ".yml"].includes(extension) ||
        file.startsWith(join(root, ".github") + sep))) ||
    (extension === "" && !isDockerfileName(fileName))
  )
    externalCompositionFilesToInspect.add(file);
}
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const path = join(root, entry.name);
  if (isRootBoundaryFile(entry.name)) filesToInspect.add(path);
  if (executableSourceExtensions.has(extname(entry.name).toLowerCase()))
    externalCompositionFilesToInspect.add(path);
}
for (const file of filesToInspect) {
  if (executableSourceExtensions.has(extname(file).toLowerCase()))
    externalCompositionFilesToInspect.add(file);
}
for (const file of await walk(join(root, "scripts"))) {
  if (executableSourceExtensions.has(extname(file).toLowerCase()))
    externalCompositionFilesToInspect.add(file);
}
const explicitlySelectedTypeScriptConfigs =
  await discoverExplicitTypeScriptConfigFiles(
    explicitTypeScriptConfigSelectorFiles,
  );
violations.push(...explicitlySelectedTypeScriptConfigs.violations);
const typeScriptConfigDiscovery = await discoverTypeScriptConfigFiles([
  ...[...filesToInspect].filter((file) =>
    isTypeScriptConfigFileName(basename(file)),
  ),
  ...explicitlySelectedTypeScriptConfigs.files,
]);
for (const file of typeScriptConfigDiscovery.files) filesToInspect.add(file);
violations.push(...typeScriptConfigDiscovery.violations);
const typeScriptConfigFilesToInspect = typeScriptConfigDiscovery.files;
const typeScriptConfigContents = typeScriptConfigDiscovery.contents;
const workspacePackageNames =
  await collectWorkspacePackageNames(filesToInspect);
violations.push(
  ...(await personalFilingCorpusBoundaryViolations()),
  ...(await personalSecurityMasterBoundaryViolations()),
  ...(await connectedSourcePolicyBoundaryViolations()),
  ...(await localResearchVaultBoundaryViolations()),
  ...(await filingParserCrossEngineExecutionBoundaryViolations()),
  ...(await filingParserQualityCompositionBoundaryViolations()),
  ...(await filingPayloadCustodyReviewedSurfaceBoundaryViolations()),
  ...(await filingParserCustodyQualityCompositionBoundaryViolations()),
);

const filingFactComparisonTreeViolation =
  exactFilingFactComparisonTreeViolation(
    [...filesToInspect]
      .map((file) => relative(root, file).replaceAll("\\", "/"))
      .filter((path) => path.startsWith(filingFactComparisonPackagePrefix)),
  );
if (filingFactComparisonTreeViolation !== null)
  violations.push(
    `${filingFactComparisonPackagePrefix}: ${filingFactComparisonTreeViolation}`,
  );
const filingQualityMeasurementTreeViolation =
  exactFilingQualityMeasurementTreeViolation(
    [...filesToInspect]
      .map((file) => relative(root, file).replaceAll("\\", "/"))
      .filter((path) => path.startsWith(filingQualityMeasurementPackagePrefix)),
  );
if (filingQualityMeasurementTreeViolation !== null)
  violations.push(
    `${filingQualityMeasurementPackagePrefix}: ${filingQualityMeasurementTreeViolation}`,
  );
const filingQualityPrecommitmentTreeViolation =
  exactFilingQualityPrecommitmentTreeViolation(
    [...filesToInspect]
      .map((file) => relative(root, file).replaceAll("\\", "/"))
      .filter((path) =>
        path.startsWith(filingQualityPrecommitmentPackagePrefix),
      ),
  );
if (filingQualityPrecommitmentTreeViolation !== null)
  violations.push(
    `${filingQualityPrecommitmentPackagePrefix}: ${filingQualityPrecommitmentTreeViolation}`,
  );
const filingParserNormalizationHandoffTreeViolation =
  exactFilingParserNormalizationHandoffTreeViolation(
    [...filesToInspect]
      .map((file) => relative(root, file).replaceAll("\\", "/"))
      .filter((path) =>
        path.startsWith(filingParserNormalizationHandoffPackagePrefix),
      ),
  );
if (filingParserNormalizationHandoffTreeViolation !== null)
  violations.push(
    `${filingParserNormalizationHandoffPackagePrefix}: ${filingParserNormalizationHandoffTreeViolation}`,
  );
const filingParserNormalizationExecutionTreeViolation =
  exactFilingParserNormalizationExecutionTreeViolation(
    [...filesToInspect]
      .map((file) => relative(root, file).replaceAll("\\", "/"))
      .filter((path) =>
        path.startsWith(filingParserNormalizationExecutionPackagePrefix),
      ),
  );
if (filingParserNormalizationExecutionTreeViolation !== null)
  violations.push(
    `${filingParserNormalizationExecutionPackagePrefix}: ${filingParserNormalizationExecutionTreeViolation}`,
  );
const filingParserNormalizationExecutionAcceptanceTreeViolation =
  exactFilingParserNormalizationExecutionAcceptanceTreeViolation(
    [...filesToInspect]
      .map((file) => relative(root, file).replaceAll("\\", "/"))
      .filter((path) =>
        path.startsWith(
          filingParserNormalizationExecutionAcceptancePackagePrefix,
        ),
      ),
  );
if (filingParserNormalizationExecutionAcceptanceTreeViolation !== null)
  violations.push(
    `${filingParserNormalizationExecutionAcceptancePackagePrefix}: ${filingParserNormalizationExecutionAcceptanceTreeViolation}`,
  );

// Release-gate regression cases: these common root-level surfaces must remain
// classified even when their files are not present in a given checkout.
for (const expected of [
  "Dockerfile",
  "Dockerfile.production",
  "compose.yml",
  "compose.override.yaml",
  "docker-compose.test.yml",
  "postgresql.conf",
  "bootstrap.sql",
  "package.json",
  "tsconfig.json",
  "tsconfig.base.json",
]) {
  if (!isRootBoundaryFile(expected))
    throw new Error(`Boundary root-surface classifier missed ${expected}`);
}
for (const expected of [".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts"]) {
  if (
    !textExtensions.has(expected) ||
    !executableSourceExtensions.has(expected)
  )
    throw new Error(`Boundary executable-source classifier missed ${expected}`);
}
if (
  !isNodeSourceExecutable("tools/consume", "#!/usr/bin/env node\n") ||
  isNodeSourceExecutable("tools/readme", "plain text\n") ||
  !isCommandSurfaceExecutable("tools/run", "#!/bin/sh\n") ||
  isCommandSurfaceExecutable("tools/readme", "plain text\n")
)
  throw new Error("Boundary extensionless executable classifier regressed");
if (
  !externalCompositionFilesToInspect.has(
    join(root, "scripts", "verify-boundaries.ts"),
  )
)
  throw new Error("Boundary composition classifier missed scripts");
if (
  JSON.stringify(
    typeScriptConfigExtendsSpecifiers({
      extends: ["../../shared.json", "../../tsconfig.base.json"],
    }),
  ) !== JSON.stringify(["../../shared.json", "../../tsconfig.base.json"]) ||
  JSON.stringify(
    typeScriptConfigReferenceSpecifiers({
      references: [{ path: "../../packages/worker" }],
    }),
  ) !== JSON.stringify(["../../packages/worker"]) ||
  !localTypeScriptConfigExtendsCandidates(
    join(root, "apps", "api", "tsconfig.json"),
    "../../shared.json",
  ).includes(join(root, "shared.json")) ||
  JSON.stringify(
    localTypeScriptProjectReferenceCandidates(
      join(root, "apps", "api", "tsconfig.json"),
      "../../packages/worker",
    ),
  ) !== JSON.stringify([join(root, "packages", "worker", "tsconfig.json")]) ||
  !typeScriptConfigFilesToInspect.has(join(root, "tsconfig.base.json"))
)
  throw new Error(
    "Boundary TypeScript config inheritance classifier regressed",
  );
const explicitConfigSelectionRegression = explicitTypeScriptConfigSelection(
  "tsx --tsconfig custom.json src/index.ts && tsc -p configs/build.json; TSX_TSCONFIG_PATH='config/tsx.json' tsx src/worker.ts; TS_NODE_PROJECT=config/node.json ts-node src/node.ts",
);
const yamlConfigSelectionRegression = explicitTypeScriptConfigSelection(
  "env:\n  TS_NODE_PROJECT: configs/yaml.json\n",
);
const environmentFileSelectionRegression = explicitTypeScriptConfigSelection(
  "node --env-file=.env.ci --import tsx apps/api/src/index.ts",
);
const workflowConfigSelectionRegression = githubWorkflowCommandContexts(
  join(root, ".github", "workflows", "config-context-regression.yml"),
  `name: Config context regression
defaults:
  run:
    working-directory: apps/default
env:
  TSX_TSCONFIG_PATH: config/top.json
jobs:
  api:
    defaults:
      run:
        working-directory: apps/api
    steps:
      - run: cd src && node --env-file=.env --import tsx index.ts
  worker:
    steps:
      - run: node --env-file=../../shared.env --import tsx src/index.ts
        working-directory: packages/worker
        env:
          TS_NODE_PROJECT: config/worker.json
`,
);
const workflowConfigSelectionContexts =
  workflowConfigSelectionRegression.commands
    .map((context) => ({
      environmentFiles:
        explicitTypeScriptConfigCommandSelection(context).environmentFiles,
      resolutionBase: relative(root, context.resolutionBase).replaceAll(
        "\\",
        "/",
      ),
      specifiers: explicitTypeScriptConfigCommandSelection(context).specifiers,
    }))
    .sort((left, right) =>
      left.resolutionBase.localeCompare(right.resolutionBase),
    );
const sharedEnvironmentPath = join(root, "shared.env");
const sharedEnvironmentConfig =
  "TSX_TSCONFIG_PATH=config/runtime.json\nTS_NODE_PROJECT=config/node.json";
const sharedEnvironmentContexts = [
  join(root, "apps", "api"),
  join(root, "packages", "worker"),
];
const sharedEnvironmentConfigTargets = new Set(
  sharedEnvironmentContexts.flatMap((resolutionBase) =>
    explicitTypeScriptConfigSelection(sharedEnvironmentConfig).specifiers.map(
      (specifier) => resolvePath(resolutionBase, specifier),
    ),
  ),
);
const posixRuntimeDirectoryRegression = runtimeDirectoryCommandContexts({
  command: "cd apps/api && node --env-file=.env --import tsx src/index.ts",
  label: "package.json",
  modelRuntimeDirectoryChanges: true,
  resolutionBase: root,
  selectorPreamble: "",
});
const workflowRuntimeDirectoryRegression = runtimeDirectoryCommandContexts(
  workflowConfigSelectionRegression.commands[0] ?? {
    command: "",
    label: "",
    modelRuntimeDirectoryChanges: true,
    resolutionBase: "",
    selectorPreamble: "",
  },
);
const cmdRuntimeDirectoryRegression = runtimeDirectoryCommandContexts({
  command:
    "chdir /d packages\\worker & node --env-file=.env --import tsx src/index.ts",
  label: "scripts/run.cmd",
  modelRuntimeDirectoryChanges: true,
  resolutionBase: root,
  selectorPreamble: "",
});
const powershellRuntimeDirectoryRegression = runtimeDirectoryCommandContexts({
  command:
    "Set-Location -LiteralPath apps/api; $env:TS_NODE_PROJECT='config/node.json'; ts-node src/index.ts",
  label: "scripts/run.ps1",
  modelRuntimeDirectoryChanges: true,
  resolutionBase: root,
  selectorPreamble: "",
});
const dynamicRuntimeDirectoryRegression = runtimeDirectoryCommandContexts({
  command: "cd $TARGET && node --env-file=.env --import tsx src/index.ts",
  label: "package.json",
  modelRuntimeDirectoryChanges: true,
  resolutionBase: root,
  selectorPreamble: "",
});
const escapedRuntimeDirectoryRegression = runtimeDirectoryCommandContexts({
  command: "cd ../outside && node --env-file=.env --import tsx src/index.ts",
  label: "package.json",
  modelRuntimeDirectoryChanges: true,
  resolutionBase: root,
  selectorPreamble: "",
});
if (
  explicitConfigSelectionRegression.invalid ||
  JSON.stringify(explicitConfigSelectionRegression.specifiers) !==
    JSON.stringify([
      "custom.json",
      "configs/build.json",
      "config/tsx.json",
      "config/node.json",
    ]) ||
  !explicitTypeScriptConfigSelection(
    "tsx --tsconfig $UNREVIEWED_CONFIG src/index.ts",
  ).invalid ||
  !explicitTypeScriptConfigSelection("tsc --build custom.json").invalid ||
  !explicitTypeScriptConfigSelection("tsc -b custom.json sibling.json")
    .invalid ||
  yamlConfigSelectionRegression.invalid ||
  JSON.stringify(yamlConfigSelectionRegression.specifiers) !==
    JSON.stringify(["configs/yaml.json"]) ||
  environmentFileSelectionRegression.invalid ||
  JSON.stringify(environmentFileSelectionRegression.environmentFiles) !==
    JSON.stringify([".env.ci"]) ||
  workflowConfigSelectionRegression.violations.length !== 0 ||
  JSON.stringify(workflowConfigSelectionContexts) !==
    JSON.stringify([
      {
        environmentFiles: [".env"],
        resolutionBase: "apps/api",
        specifiers: ["config/top.json"],
      },
      {
        environmentFiles: ["../../shared.env"],
        resolutionBase: "packages/worker",
        specifiers: ["config/top.json", "config/worker.json"],
      },
    ]) ||
  environmentFileResolutionContextKey(
    sharedEnvironmentPath,
    sharedEnvironmentContexts[0] ?? "",
  ) ===
    environmentFileResolutionContextKey(
      sharedEnvironmentPath,
      sharedEnvironmentContexts[1] ?? "",
    ) ||
  sharedEnvironmentConfigTargets.size !== 4 ||
  posixRuntimeDirectoryRegression.invalid ||
  posixRuntimeDirectoryRegression.contexts.length !== 1 ||
  posixRuntimeDirectoryRegression.contexts[0]?.resolutionBase !==
    join(root, "apps", "api") ||
  JSON.stringify(
    explicitTypeScriptConfigCommandSelection(
      posixRuntimeDirectoryRegression.contexts[0] ?? {
        command: "",
        label: "",
        modelRuntimeDirectoryChanges: false,
        resolutionBase: "",
        selectorPreamble: "",
      },
    ).environmentFiles,
  ) !== JSON.stringify([".env"]) ||
  workflowRuntimeDirectoryRegression.invalid ||
  workflowRuntimeDirectoryRegression.contexts.length !== 1 ||
  workflowRuntimeDirectoryRegression.contexts[0]?.resolutionBase !==
    join(root, "apps", "api", "src") ||
  JSON.stringify(
    explicitTypeScriptConfigCommandSelection(
      workflowRuntimeDirectoryRegression.contexts[0] ?? {
        command: "",
        label: "",
        modelRuntimeDirectoryChanges: false,
        resolutionBase: "",
        selectorPreamble: "",
      },
    ).environmentFiles,
  ) !== JSON.stringify([".env"]) ||
  cmdRuntimeDirectoryRegression.invalid ||
  cmdRuntimeDirectoryRegression.contexts[0]?.resolutionBase !==
    join(root, "packages", "worker") ||
  powershellRuntimeDirectoryRegression.invalid ||
  powershellRuntimeDirectoryRegression.contexts.at(-1)?.resolutionBase !==
    join(root, "apps", "api") ||
  JSON.stringify(
    explicitTypeScriptConfigCommandSelection(
      powershellRuntimeDirectoryRegression.contexts.at(-1) ?? {
        command: "",
        label: "",
        modelRuntimeDirectoryChanges: false,
        resolutionBase: "",
        selectorPreamble: "",
      },
    ).specifiers,
  ) !== JSON.stringify(["config/node.json"]) ||
  !dynamicRuntimeDirectoryRegression.invalid ||
  !escapedRuntimeDirectoryRegression.invalid
)
  throw new Error("Boundary explicit TypeScript config classifier regressed");
verifyDependencyPolicyClassifiers();
const gitignoreViolation = npmrcGitignoreViolation(
  await readFile(join(root, ".gitignore"), "utf8"),
);
if (gitignoreViolation !== null)
  violations.push(`.gitignore: ${gitignoreViolation}`);
if (gitPathDisposition("check-ignore", ".npmrc") !== true)
  violations.push(".gitignore: .npmrc must be effectively ignored by git");
const localNpmrc = await readOptionalLocalNpmrc();
if (localNpmrc !== null) {
  if (gitPathDisposition("ls-files", ".npmrc") !== false)
    violations.push(".npmrc: a local auth file must remain untracked");
  const npmrcViolation = legacyNpmrcPolicyViolation(localNpmrc);
  if (npmrcViolation !== null) violations.push(`.npmrc: ${npmrcViolation}`);
}
const lockfileViolation = pnpmLockfileHeaderViolation(
  await readFile(join(root, "pnpm-lock.yaml"), "utf8"),
);
if (lockfileViolation !== null)
  violations.push(`pnpm-lock.yaml: ${lockfileViolation}`);
const effectivePnpmViolation = effectivePnpmSettingsViolation(
  readEffectivePnpmConfig(),
);
if (effectivePnpmViolation !== null)
  violations.push(`pnpm configuration: ${effectivePnpmViolation}`);
if (
  !referencesModule(
    'import { ResearchStateService } from "@research-cockpit/research-state";',
    "@research-cockpit/research-state",
  ) ||
  !referencesModule('const pg = await import("pg");', "pg") ||
  !referencesModule('import "pg";', "pg") ||
  !referencesModule('import/* boundary */"pg";', "pg") ||
  !referencesModule('void import("p" + "g");', "pg") ||
  !referencesModule('type Client = import("pg").Client;', "pg") ||
  !referencesModule('import "@research-cockpit/db";', "@research-cockpit/db") ||
  !referencesModule(
    'import "@research-cockpit/research-state";',
    "@research-cockpit/research-state",
  ) ||
  referencesModule(
    'import { buildDossier } from "@research-cockpit/research-core";',
    "@research-cockpit/research-state",
  ) ||
  forbiddenApiWriteDependencies.includes("@research-cockpit/research-state")
)
  throw new Error("Composition-boundary import classifier regressed");
if (
  !referencesModule(
    'import { createDockerFilingParserBoundary } from "@research-cockpit/filing-parser";',
    filingParserModule,
  )
)
  throw new Error("Filing-parser composition classifier regressed");
if (
  !referencesModule(
    'import { normalizeSyntheticFilingFactPair } from "@research-cockpit/filing-fact-normalization";',
    filingFactNormalizationModule,
  ) ||
  !referencesFilingFactNormalizationPath(
    "apps/api/src/index.ts",
    "../../../packages/filing-fact-normalization/src/index",
  ) ||
  !hasFilingFactNormalizationDependency(
    {
      dependencies: {
        "@research-cockpit/filing-fact-normalization": "workspace:*",
      },
    },
    "apps/api/package.json",
  ) ||
  hasFilingFactNormalizationDependency(
    { devDependencies: { typescript: "5.9.3" } },
    "apps/api/package.json",
  )
)
  throw new Error("Filing-fact-normalization composition classifier regressed");
const validFilingFactNormalizationManifest = {
  name: filingFactNormalizationModule,
  version: "0.1.0",
  private: true,
  type: "module",
  exports: { ".": "./src/index.ts" },
  scripts: {
    build: "tsc --noEmit",
    typecheck: "tsc --noEmit",
    test: "vitest run",
  },
};
if (
  filingFactNormalizationManifestViolation(
    validFilingFactNormalizationManifest,
  ) !== null ||
  filingFactNormalizationManifestViolation({
    ...validFilingFactNormalizationManifest,
    exports: {
      ...validFilingFactNormalizationManifest.exports,
      "./test": "./src/test-filing-fact-builder.ts",
    },
  }) === null ||
  filingFactNormalizationManifestViolation({
    ...validFilingFactNormalizationManifest,
    scripts: {
      ...validFilingFactNormalizationManifest.scripts,
      test: "curl https://example.invalid",
    },
  }) === null
)
  throw new Error("Filing-fact-normalization manifest classifier regressed");
const validFilingFactNormalizationSource = `import { createHash } from "node:crypto";
void createHash;
`;
const validFilingFactNormalizationIndexSource = `export {
  FILING_FACT_CONTRACTS,
  FILING_FACT_KEYS,
  FILING_FACT_NORMALIZATION_CHECKS,
  FILING_FACT_NORMALIZATION_CLAIM,
  FILING_FACT_NORMALIZATION_LIMITS,
  FILING_FACT_NORMALIZATION_NOT_PROVEN,
  FILING_FACT_NORMALIZATION_QUARANTINE_CODES,
  FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
  FILING_FACT_PARSER_VERSION,
  FILING_FACT_TAXONOMY_FAMILY,
  FILING_FACT_TAXONOMY_VERSION,
  FilingFactProjectionError,
  normalizeSyntheticFilingFactPair,
  projectNormalizedFilingFactsAsKnown,
  type FilingFactContract,
  type FilingFactKey,
  type FilingFactNormalizationAudit,
  type FilingFactNormalizationQuarantineCode,
  type FilingFactNormalizationQuarantinedResult,
  type FilingFactNormalizationRecord,
  type FilingFactNormalizationResult,
  type FilingFactPeriodKind,
  type FilingFactSupersession,
  type FilingFactUnit,
  type NormalizedFilingFactVersion,
} from "./filing-fact-normalization";
`;
const validFilingFactNormalizationBuilderSource = `import { FILING_FACT_CONTRACTS } from "./filing-fact-normalization";
void FILING_FACT_CONTRACTS;
`;
const validFilingFactNormalizationUnitTestSource = `import { describe } from "vitest";
import { normalizeSyntheticFilingFactPair } from "./filing-fact-normalization";
import { buildSyntheticFilingFactDocuments } from "./test-filing-fact-builder";
void describe;
void normalizeSyntheticFilingFactPair;
void buildSyntheticFilingFactDocuments;
`;
const validFilingFactNormalizationSecurityTestSource = `import { createHash } from "node:crypto";
import { describe } from "vitest";
import { normalizeSyntheticFilingFactPair } from "./filing-fact-normalization";
import { buildSyntheticFilingFactDocuments } from "./test-filing-fact-builder";
void createHash;
void describe;
void normalizeSyntheticFilingFactPair;
void buildSyntheticFilingFactDocuments;
`;
if (
  filingFactNormalizationImportViolation(
    filingFactNormalizationProductionPath,
    validFilingFactNormalizationSource,
  ) !== null ||
  filingFactNormalizationImportViolation(
    filingFactNormalizationProductionPath,
    validFilingFactNormalizationSource.replace("createHash", "randomBytes"),
  ) === null ||
  filingFactNormalizationImportViolation(
    filingFactNormalizationProductionPath,
    `${validFilingFactNormalizationSource}\nvoid fetch("");`,
  ) === null ||
  filingFactNormalizationImportViolation(
    filingFactNormalizationProductionPath,
    `${validFilingFactNormalizationSource}\nconst target = "node:fs"; void import(target);`,
  ) === null ||
  filingFactNormalizationImportViolation(
    filingFactNormalizationProductionPath,
    `${validFilingFactNormalizationSource}\nimport "./io-helper";`,
  ) === null ||
  filingFactNormalizationImportViolation(
    filingFactNormalizationIndexPath,
    validFilingFactNormalizationIndexSource,
  ) !== null ||
  filingFactNormalizationImportViolation(
    filingFactNormalizationIndexPath,
    `${validFilingFactNormalizationIndexSource}\nexport * from "./test-filing-fact-builder";`,
  ) === null ||
  filingFactNormalizationImportViolation(
    filingFactNormalizationBuilderPath,
    validFilingFactNormalizationBuilderSource,
  ) !== null ||
  filingFactNormalizationImportViolation(
    filingFactNormalizationBuilderPath,
    `${validFilingFactNormalizationBuilderSource}\nvoid process.env;`,
  ) === null ||
  filingFactNormalizationImportViolation(
    filingFactNormalizationUnitTestPath,
    validFilingFactNormalizationUnitTestSource,
  ) !== null ||
  filingFactNormalizationImportViolation(
    filingFactNormalizationSecurityTestPath,
    validFilingFactNormalizationSecurityTestSource,
  ) !== null ||
  filingFactNormalizationImportViolation(
    filingFactNormalizationSecurityTestPath,
    validFilingFactNormalizationSecurityTestSource.replace(
      "node:crypto",
      "node:https",
    ),
  ) === null ||
  filingFactNormalizationImportViolation(
    filingFactNormalizationSecurityTestPath,
    `${validFilingFactNormalizationSecurityTestSource}\nvoid process.getBuiltinModule("node:net");`,
  ) === null ||
  filingFactNormalizationImportViolation(
    `${filingFactNormalizationSourcePrefix}io-helper.ts`,
    'import "node:fs";',
  ) === null
)
  throw new Error("Filing-fact-normalization source classifier regressed");
if (
  !referencesModule(
    'import { handoffAuthenticatedSyntheticFilingParserResults } from "@research-cockpit/filing-parser-normalization-handoff";',
    filingParserNormalizationHandoffModule,
  ) ||
  !referencesFilingParserNormalizationHandoffPath(
    "apps/api/src/index.ts",
    "../../../packages/filing-parser-normalization-handoff/src/index",
  ) ||
  !hasFilingParserNormalizationHandoffDependency(
    {
      dependencies: {
        "@research-cockpit/filing-parser-normalization-handoff": "workspace:*",
      },
    },
    "apps/api/package.json",
  ) ||
  !hasFilingParserNormalizationHandoffDependency(
    {
      devDependencies: {
        "handoff-path-alias":
          "link:../../packages/filing-parser-normalization-handoff",
      },
    },
    "apps/api/package.json",
  ) ||
  hasFilingParserNormalizationHandoffDependency(
    { devDependencies: { typescript: "5.9.3" } },
    "apps/api/package.json",
  ) ||
  filingParserNormalizationHandoffTsconfigViolation("apps/api/tsconfig.json", {
    compilerOptions: { paths: { "@app/*": ["src/*"] } },
  }) !== null ||
  filingParserNormalizationHandoffTsconfigViolation("apps/api/tsconfig.json", {
    compilerOptions: {
      baseUrl: "../..",
      paths: {
        "@opaque-handoff": [
          "packages/filing-parser-normalization-handoff/src/index.ts",
        ],
      },
    },
  }) === null ||
  filingParserNormalizationHandoffTsconfigViolation("tsconfig.base.json", {
    compilerOptions: {
      paths: {
        "@opaque-handoff": [
          "packages/filing-parser-normalization-handoff/src/index.ts",
        ],
      },
    },
  }) === null ||
  filingParserNormalizationHandoffTsconfigViolation("apps/api/tsconfig.json", {
    compilerOptions: {
      baseUrl: "../../packages/filing-parser-normalization-handoff",
    },
  }) === null ||
  filingParserNormalizationHandoffTsconfigViolation("apps/api/tsconfig.json", {
    compilerOptions: {
      rootDirs: [
        "src",
        "../../packages/filing-parser-normalization-handoff/src",
      ],
    },
  }) === null ||
  filingParserNormalizationHandoffTsconfigViolation("apps/api/tsconfig.json", {
    compilerOptions: {
      jsxImportSource: filingParserNormalizationHandoffModule,
    },
  }) === null ||
  filingParserNormalizationHandoffTsconfigViolation("apps/api/custom.json", {
    extends: "../../packages/filing-parser-normalization-handoff/tsconfig.json",
  }) === null ||
  filingParserNormalizationHandoffTsconfigViolation("apps/api/custom.json", {
    include: ["../../packages/*/src/**/*.ts"],
  }) === null ||
  filingParserNormalizationHandoffTsconfigViolation("apps/api/custom.json", {
    include: ["../../packages/filing-parser-normalization-?andoff/src/**/*.ts"],
  }) === null ||
  filingParserNormalizationHandoffTsconfigViolation("apps/api/custom.json", {
    references: [
      { path: "../../packages/filing-parser-normalization-handoff" },
    ],
  }) === null ||
  filingParserNormalizationHandoffTsconfigViolation("apps/api/custom.json", {
    compilerOptions: {
      baseUrl: "../..",
      paths: {
        "@opaque/*": ["packages/*/src/index.ts"],
      },
    },
  }) === null ||
  filingParserNormalizationHandoffManifestCompositionViolation("package.json", {
    scripts: { verify: "pnpm test" },
  }) !== null ||
  filingParserNormalizationHandoffManifestCompositionViolation("package.json", {
    imports: {
      "#handoff": "./packages/filing-parser-normalization-handoff/src/index.ts",
    },
  }) === null ||
  filingParserNormalizationHandoffManifestCompositionViolation("package.json", {
    exports: {
      "./handoff":
        "./packages/filing-parser-normalization-handoff/src/index.ts",
    },
  }) === null ||
  filingParserNormalizationHandoffManifestCompositionViolation(
    "apps/api/package.json",
    {
      scripts: {
        handoff:
          "tsx ../../packages/filing-parser-normalization-handoff/src/index.ts",
      },
    },
  ) === null ||
  filingParserNormalizationHandoffManifestCompositionViolation(
    "apps/api/package.json",
    {
      scripts: {
        handoff:
          'tsx ../../packages/filing-parser-normalization-"handoff"/src/index.ts',
      },
    },
  ) === null ||
  filingParserNormalizationHandoffManifestCompositionViolation("package.json", {
    imports: {
      "#handoff":
        "./packages/filing-parser-normalization-%68andoff/src/index.ts",
    },
  }) === null ||
  filingParserNormalizationHandoffManifestCompositionViolation("package.json", {
    scripts: {
      handoff:
        "node -e import('./packages/filing-parser-normalization-%68andoff/src/index.ts')",
    },
  }) === null ||
  filingParserNormalizationHandoffManifestCompositionViolation("package.json", {
    typesVersions: {
      "*": {
        "handoff/*": ["packages/*/src/index.ts"],
      },
    },
  }) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void import("node:fs");',
  ) !== null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void import("../../../packages/filing-parser-normalization-%68andoff/src/index.ts");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void import("data:text/javascript;base64,ZXhwb3J0IGRlZmF1bHQgMQ==");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'const target = "../../../packages/filing-parser-normalization-handoff/src/index"; void import(target);',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'const target = "../../../packages/filing-parser-normalization-handoff/src/index"; void require(target);',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'import { createRequire } from "node:module"; void createRequire(import.meta.url)("../../../packages/filing-parser-normalization-handoff/src/index");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'import { createRequire as makeRequire } from "node:module"; const load = makeRequire(import.meta.url); void load("../../../packages/filing-parser-normalization-handoff/src/index");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void module.require("../../../packages/filing-parser-normalization-handoff/src/index");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'const load = require; void load("../../../packages/filing-parser-normalization-handoff/src/index");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void (require as any)("../../../packages/filing-parser-normalization-handoff/src/index");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    "const loaders = { load: require }; void loaders;",
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'const load = require.bind(undefined); void load("../../../packages/filing-parser-normalization-handoff/src/index");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'import * as nodeModule from "node:module"; void nodeModule.createRequire(import.meta.url)("../../../packages/filing-parser-normalization-handoff/src/index");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void module["req" + "uire"]("../../../packages/filing-parser-normalization-handoff/src/index");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    "const { require: load } = module; void load;",
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'import { createRequire } from "node:module"; const loaders = { load: createRequire(import.meta.url) }; void loaders;',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/shim.ts",
    'export { createRequire as factory } from "node:module";',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/shim.ts",
    'import { createRequire as factory } from "node:module"; export { factory };',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/shim.ts",
    'export * from "node:module";',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/shim.ts",
    'import * as nodeModule from "node:module"; export { nodeModule };',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'import { Module } from "node:module"; void Module.createRequire(import.meta.url).resolve("pg");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'import { register, registerHooks } from "node:module"; void register; void registerHooks;',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'import { tsImport } from "tsx/esm/api"; void tsImport("../../../packages/filing-parser-normalization-handoff/src/index.ts", import.meta.url);',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    'const documented = "packages/filing-parser-normalization-handoff/src/index.ts"; function spawn(value: string) { void value; } spawn(documented);',
  ) !== null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    'import { spawn as launch } from "node:child_process"; let target = "safe.ts"; target = "packages/filing-parser-normalization-handoff/src/index.ts"; launch("tsx", [target]);',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    'import { spawn } from "node:child_process"; let launch = (value: string) => void value; launch = spawn; const target = "packages/filing-parser-normalization-handoff/src/index.ts"; launch("tsx", [target]);',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    'const childProcess = require("node:child_process"); const { execFile: run } = childProcess; let arguments_: string[] = []; arguments_ = ["packages/filing-parser-normalization-handoff/src/index.ts"]; run("tsx", arguments_);',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    'import * as childProcess from "node:child_process"; const target = "packages/filing-parser-normalization-handoff/src/index.ts"; childProcess["spa" + "wn"]("tsx", [target]);',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    'import { spawnSync } from "node:child_process"; let launch: typeof spawnSync | undefined; launch ??= spawnSync; launch("tsx", ["packages/filing-parser-normalization-handoff/src/index.ts"]);',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    'import { spawn } from "node:child_process"; let target = "packages/filing-parser-normalization-"; target += "handoff/src/index.ts"; spawn("tsx", [target]);',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    'import { spawn } from "node:child_process"; const launch = (...arguments_: unknown[]) => spawn(...arguments_); launch("tsx", ["packages/filing-parser-normalization-handoff/src/index.ts"]);',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    'import { spawnSync } from "node:child_process"; Reflect.apply(spawnSync, undefined, ["tsx", ["packages/filing-parser-normalization-handoff/src/index.ts"]]);',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    'import { spawn } from "node:child_process"; spawn("tsx", ["packages/filing-parser-normalization-handoff/src/index.ts"]);',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void import("node:module");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    "void module.constructor;",
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.cjs",
    'void eval("require");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void Function("return 1")();',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void (() => {}).constructor("return 1")();',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void (() => {})[["con", "structor"].join("")];',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void (() => {})[["con", , "structor"].join("")];',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void (() => {})[["con", ...[,], "structor"].join("")];',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void (() => {})[["con", undefined, "structor"].join("")];',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void (() => {})[["con", null, "structor"].join("")];',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void (() => {})[["con", void 0, "structor"].join("")];',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'const get = process.getBuiltinModule; void get("node:module");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'const { getBuiltinModule: get } = process; void get("node:module");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'const key = "getBuiltinModule"; void process[key]("node:module");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void Object.getOwnPropertyDescriptor(process, "getBuiltinModule")?.value;',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'const read = Object.getOwnPropertyDescriptor; void read(process, "getBuiltinModule")?.value;',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'const runtime = process; const key = "getBuiltinModule"; void runtime[key]("node:module");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    "const box = { runtime: process }; void box;",
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void ["../../../packages/filing-parser-normalization-", "handoff/src/index.ts"].join("");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void ["../../../packages/filing-parser-normalization-", , "handoff/src/index.ts"].join("");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void ["../../../packages/filing-parser-normalization-hand", ...[,], "off/src/index.ts"].join("");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void ["../../../packages/filing-parser-normalization-hand", undefined, "off/src/index.ts"].join("");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void ["../../../packages/filing-parser-normalization-hand", null, "off/src/index.ts"].join("");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void ["../../../packages/filing-parser-normalization-hand", void 0, "off/src/index.ts"].join("");',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'import { runInThisContext } from "node:vm"; void runInThisContext;',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    '/// <reference path="../../../packages/filing-parser-normalization-handoff/src/index.ts" />\nexport {};',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "tools/consume",
    '#!/usr/bin/env node\nimport "../packages/filing-parser-normalization-handoff/src/index.ts";',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "tools/run-handoff.sh",
    "corepack pnpm exec tsx packages/filing-parser-normalization-handoff/src/index.ts",
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "tools/run-handoff.sh",
    'corepack pnpm exec tsx packages/filing-parser-normalization-"handoff"/src/index.ts',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "tools/run-handoff.sh",
    "corepack pnpm exec tsx packages/filing-parser-normalization-hand\\off/src/index.ts",
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "tools/run-handoff.sh",
    'corepack pnpm exec tsx packages/filing-parser-normalization-hand\\of"f"/src/index.ts',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "tools/run-handoff.sh",
    'corepack pnpm exec tsx "packages/filing-parser-normalization-hand\\o" + "ff/src/index.ts"',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    ".github/workflows/handoff.yml",
    'steps:\n  - run: corepack pnpm exec tsx "packages/filing-parser-normalization-" + "handoff/src/index.ts"',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "next.config.mjs",
    'export default { webpack(config) { config.resolve.alias.handoff = "./packages/filing-parser-normalization-handoff/src/index.ts"; return config; } };',
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'void require("node:fs");',
  ) !== null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'import { createRequire } from "node:module"; void createRequire(import.meta.url).resolve("pg");',
  ) !== null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    "apps/api/src/index.ts",
    'import { createRequire as makeRequire } from "node:module"; void makeRequire(import.meta.url).resolve("pg/package.json");',
  ) !== null
)
  throw new Error(
    "Filing-parser-normalization-handoff composition classifier regressed",
  );
const validFilingParserNormalizationHandoffManifest = {
  name: filingParserNormalizationHandoffModule,
  version: "0.1.0",
  private: true,
  type: "module",
  exports: { ".": "./src/index.ts" },
  scripts: {
    build: "tsc --noEmit",
    typecheck: "tsc --noEmit",
    test: "vitest run",
  },
  dependencies: {
    [filingFactNormalizationModule]: "workspace:*",
  },
};
if (
  filingParserNormalizationHandoffManifestViolation(
    validFilingParserNormalizationHandoffManifest,
  ) !== null ||
  filingParserNormalizationHandoffManifestViolation({
    ...validFilingParserNormalizationHandoffManifest,
    dependencies: {},
  }) === null ||
  filingParserNormalizationHandoffManifestViolation({
    ...validFilingParserNormalizationHandoffManifest,
    exports: {
      ...validFilingParserNormalizationHandoffManifest.exports,
      "./test": "./src/test-filing-parser-normalization-handoff-builder.ts",
    },
  }) === null
)
  throw new Error(
    "Filing-parser-normalization-handoff manifest classifier regressed",
  );
const validFilingParserNormalizationHandoffSource = `import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { types as utilTypes } from "node:util";
import {
  FILING_FACT_NORMALIZATION_LIMITS,
  normalizeSyntheticFilingFactPair,
  type FilingFactNormalizationRecord,
} from "@research-cockpit/filing-fact-normalization";
void createHash;
void createPublicKey;
void verifySignature;
void utilTypes;
void FILING_FACT_NORMALIZATION_LIMITS;
void normalizeSyntheticFilingFactPair;
`;
const validFilingParserNormalizationHandoffIndexSource = `export {
  FILING_PARSER_NORMALIZATION_HANDOFF_CHECKS,
  FILING_PARSER_NORMALIZATION_HANDOFF_CLAIM,
  FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS,
  FILING_PARSER_NORMALIZATION_HANDOFF_NOT_PROVEN,
  FILING_PARSER_NORMALIZATION_HANDOFF_SCHEMA_VERSION,
  handoffAuthenticatedSyntheticFilingParserResults,
  type FilingParserNormalizationHandoffOptions,
  type FilingParserNormalizationHandoffProvenance,
  type FilingParserNormalizationHandoffQuarantinedResult,
  type FilingParserNormalizationHandoffResult,
  type FilingParserNormalizationHandoffSuccess,
} from "./filing-parser-normalization-handoff";
`;
if (
  exactFilingParserNormalizationHandoffTreeViolation(
    filingParserNormalizationHandoffPackagePaths,
  ) !== null ||
  exactFilingParserNormalizationHandoffTreeViolation(
    filingParserNormalizationHandoffPackagePaths.slice(1),
  ) === null ||
  exactFilingParserNormalizationHandoffTreeViolation([
    ...filingParserNormalizationHandoffPackagePaths,
    `${filingParserNormalizationHandoffSourcePrefix}io-helper.ts`,
  ]) === null ||
  filingParserNormalizationHandoffImportViolation(
    filingParserNormalizationHandoffProductionPath,
    validFilingParserNormalizationHandoffSource,
  ) !== null ||
  filingParserNormalizationHandoffImportViolation(
    filingParserNormalizationHandoffProductionPath,
    validFilingParserNormalizationHandoffSource.replace(
      "createHash",
      "randomBytes",
    ),
  ) === null ||
  filingParserNormalizationHandoffImportViolation(
    filingParserNormalizationHandoffProductionPath,
    `${validFilingParserNormalizationHandoffSource}\nvoid fetch("");`,
  ) === null ||
  filingParserNormalizationHandoffImportViolation(
    filingParserNormalizationHandoffProductionPath,
    `${validFilingParserNormalizationHandoffSource}\nvoid Date.now();`,
  ) === null ||
  filingParserNormalizationHandoffImportViolation(
    filingParserNormalizationHandoffProductionPath,
    `${validFilingParserNormalizationHandoffSource}\nvoid Math.random();`,
  ) === null ||
  filingParserNormalizationHandoffImportViolation(
    filingParserNormalizationHandoffProductionPath,
    `${validFilingParserNormalizationHandoffSource}\nvoid crypto.getRandomValues(new Uint8Array(1));`,
  ) === null ||
  filingParserNormalizationHandoffImportViolation(
    filingParserNormalizationHandoffProductionPath,
    `${validFilingParserNormalizationHandoffSource}\nvoid setTimeout(() => undefined, 0);`,
  ) === null ||
  filingParserNormalizationHandoffImportViolation(
    filingParserNormalizationHandoffProductionPath,
    `${validFilingParserNormalizationHandoffSource}\nconst target = "node:fs"; void import(target);`,
  ) === null ||
  filingParserNormalizationHandoffImportViolation(
    filingParserNormalizationHandoffProductionPath,
    `${validFilingParserNormalizationHandoffSource}\nimport "node:fs";`,
  ) === null ||
  filingParserNormalizationHandoffImportViolation(
    filingParserNormalizationHandoffIndexPath,
    validFilingParserNormalizationHandoffIndexSource,
  ) !== null ||
  filingParserNormalizationHandoffImportViolation(
    filingParserNormalizationHandoffIndexPath,
    `${validFilingParserNormalizationHandoffIndexSource}\nexport * from "./test-filing-parser-normalization-handoff-builder";`,
  ) === null ||
  filingParserNormalizationHandoffImportViolation(
    `${filingParserNormalizationHandoffSourcePrefix}io-helper.ts`,
    'import "node:fs";',
  ) === null
)
  throw new Error(
    "Filing-parser-normalization-handoff source classifier regressed",
  );
const reviewedFilingParserNormalizationExecutionManifest = {
  name: filingParserNormalizationExecutionModule,
  version: "0.1.0",
  private: true,
  type: "module",
  exports: {
    ".": "./src/index.ts",
    "./test": "./src/test-filing-parser-normalization-execution-builder.ts",
  },
  scripts: {
    build: "tsc --noEmit",
    typecheck: "tsc --noEmit",
    test: "vitest run",
    "test:worker": "python -I -B worker/parser_test.py",
  },
  dependencies: {
    [filingParserNormalizationHandoffModule]: "workspace:*",
  },
};
const reviewedFilingParserNormalizationExecutionAcceptanceManifest = {
  name: filingParserNormalizationExecutionAcceptanceModule,
  version: "0.1.0",
  private: true,
  type: "module",
  exports: { ".": "./src/index.ts" },
  scripts: {
    build: "tsc --noEmit",
    typecheck: "tsc --noEmit",
    test: "vitest run",
  },
  dependencies: {
    [filingParserNormalizationExecutionModule]: "workspace:*",
  },
};
const reviewedFilingParserNormalizationExecutionTsconfig = {
  extends: "../../tsconfig.base.json",
  compilerOptions: { noEmit: true, types: ["node"] },
  include: ["src/**/*.ts"],
};
if (
  exactFilingParserNormalizationExecutionTreeViolation(
    filingParserNormalizationExecutionPackagePaths,
  ) !== null ||
  exactFilingParserNormalizationExecutionAcceptanceTreeViolation(
    filingParserNormalizationExecutionAcceptancePackagePaths,
  ) !== null ||
  filingParserNormalizationExecutionManifestViolation(
    reviewedFilingParserNormalizationExecutionManifest,
  ) !== null ||
  filingParserNormalizationExecutionAcceptanceManifestViolation(
    reviewedFilingParserNormalizationExecutionAcceptanceManifest,
  ) !== null
)
  throw new Error("Cycle 2j exact tree/manifest positive classifier regressed");
if (
  filingParserNormalizationExecutionTsconfigViolation(
    `${filingParserNormalizationExecutionPackagePrefix}tsconfig.json`,
    reviewedFilingParserNormalizationExecutionTsconfig,
  ) !== null ||
  !hasFilingParserNormalizationExecutionDependency(
    {
      dependencies: {
        [filingParserNormalizationExecutionModule]: "workspace:*",
      },
    },
    "apps/api/package.json",
  )
)
  throw new Error("Cycle 2j tsconfig/dependency positive classifier regressed");
if (
  exactFilingParserNormalizationExecutionTreeViolation(
    filingParserNormalizationExecutionPackagePaths.slice(1),
  ) === null ||
  exactFilingParserNormalizationExecutionTreeViolation([
    ...filingParserNormalizationExecutionPackagePaths,
    `${filingParserNormalizationExecutionSourcePrefix}loader.ts`,
  ]) === null ||
  exactFilingParserNormalizationExecutionAcceptanceTreeViolation(
    filingParserNormalizationExecutionAcceptancePackagePaths.slice(1),
  ) === null ||
  exactFilingParserNormalizationExecutionAcceptanceTreeViolation([
    ...filingParserNormalizationExecutionAcceptancePackagePaths,
    `${filingParserNormalizationExecutionAcceptanceSourcePrefix}loader.ts`,
  ]) === null ||
  filingParserNormalizationExecutionManifestViolation({
    ...reviewedFilingParserNormalizationExecutionManifest,
    exports: { ".": "./src/index.ts" },
  }) === null ||
  filingParserNormalizationExecutionManifestViolation({
    ...reviewedFilingParserNormalizationExecutionManifest,
    scripts: {
      ...reviewedFilingParserNormalizationExecutionManifest.scripts,
      "test:worker": "python worker/parser_test.py",
    },
  }) === null ||
  filingParserNormalizationExecutionAcceptanceManifestViolation({
    ...reviewedFilingParserNormalizationExecutionAcceptanceManifest,
    dependencies: {},
  }) === null
)
  throw new Error("Cycle 2j exact tree/manifest negative classifier regressed");
if (
  filingParserNormalizationExecutionTsconfigViolation(
    "apps/api/tsconfig.json",
    {
      compilerOptions: {
        baseUrl: "../..",
        paths: { "@cycle2j": ["packages/*/src/index.ts"] },
      },
    },
  ) === null ||
  !hasFilingParserNormalizationExecutionDependency(
    {
      devDependencies: {
        alias: "link:../filing-parser-normalization-execution",
      },
    },
    "packages/ui/package.json",
  ) ||
  hasFilingParserNormalizationExecutionDependency(
    { dependencies: { typescript: "5.9.3" } },
    "apps/api/package.json",
  )
)
  throw new Error("Cycle 2j tsconfig/dependency negative classifier regressed");
if (
  filingParserNormalizationExecutionManifestCompositionViolation(
    "apps/api/package.json",
    {
      exports: {
        "./cycle2j":
          "../../packages/filing-parser-normalization-execution/src/index.ts",
      },
    },
  ) === null ||
  filingParserNormalizationExecutionManifestCompositionViolation(
    "apps/api/package.json",
    {
      scripts: {
        cycle2j:
          "tsx ../../packages/filing-parser-normalization-execution/src/index.ts",
      },
    },
  ) === null
)
  throw new Error("Cycle 2j manifest composition classifier regressed");
if (
  filingParserNormalizationExecutionExternalCompositionViolation(
    "apps/api/src/index.ts",
    `import ${JSON.stringify(filingParserNormalizationExecutionModule)};`,
  ) === null ||
  filingParserNormalizationExecutionExternalCompositionViolation(
    "apps/api/src/index.ts",
    'const target = "@research-cockpit/filing-parser-normalization-execution"; void import(target);',
  ) === null ||
  filingParserNormalizationExecutionExternalCompositionViolation(
    ".github/workflows/unrelated.yml",
    "steps:\n  - run: pnpm filing-parser-normalization-execution:acceptance",
  ) === null
)
  throw new Error("Cycle 2j external composition classifier regressed");
if (
  filingParserNormalizationHandoffExternalCompositionViolation(
    filingParserNormalizationExecutionBuilderPath,
    `import ${JSON.stringify(filingParserNormalizationHandoffModule)};`,
  ) === null
)
  throw new Error("Cycle 2j reciprocal handoff classifier regressed");
const reviewedExecutionCoreSource = await readFile(
  join(root, filingParserNormalizationExecutionProductionPath),
  "utf8",
);
const reviewedExecutionIndexSource = await readFile(
  join(root, filingParserNormalizationExecutionIndexPath),
  "utf8",
);
const reviewedExecutionAcceptanceIndexSource = await readFile(
  join(root, filingParserNormalizationExecutionAcceptanceIndexPath),
  "utf8",
);
const reviewedExecutionAcceptanceRunnerSource = await readFile(
  join(root, filingParserNormalizationExecutionAcceptanceRunnerPath),
  "utf8",
);
const reviewedExecutionWorkerSource = await readFile(
  join(root, filingParserNormalizationExecutionWorkerParserPath),
  "utf8",
);
const reviewedExecutionWorkerTestSource = await readFile(
  join(root, filingParserNormalizationExecutionWorkerParserTestPath),
  "utf8",
);
const reviewedExecutionTaxonomySource = await readFile(
  join(root, filingParserNormalizationExecutionWorkerTaxonomyPath),
  "utf8",
);
const reviewedExecutionImageSource = await readFile(
  join(root, filingParserNormalizationExecutionImageReviewPath),
  "utf8",
);
if (
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource,
  ) !== null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      '"tool_versions",',
      '"tool_versions_removed",',
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      /return "filing_parser_normalization_execution_acceptance_failed phase=image_build\\n";/u,
      "return String(phase);",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    `${reviewedExecutionAcceptanceRunnerSource}\nprocess.stderr.write("secret");`,
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "}).catch(() => {",
      "}).catch((error) => {",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "filing_parser_normalization_execution_acceptance_failed phase=environment",
      "filing_parser_normalization_execution_acceptance_error phase=environment",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "return hadPrimaryFailure === false;",
      "return true;",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "acceptancePhase = phase;",
      'acceptancePhase = "environment";',
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "process.exitCode = 1;",
      "process.exitCode = 0;",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "  await main((phase) => {",
      "  void main((phase) => {",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    `${reviewedExecutionAcceptanceRunnerSource}\nconst runtime = process;\nruntime.stderr.write(runtime.env.SECRET ?? "");`,
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      'stdio: ["ignore", "pipe", "pipe"],',
      'stdio: "inherit",',
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    `${reviewedExecutionAcceptanceRunnerSource}\nvoid writeFile("/dev/stderr", "secret");`,
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      'markPhase("image_inspection");',
      'if (false) markPhase("image_inspection");',
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    `${reviewedExecutionAcceptanceRunnerSource}\nvoid main(() => undefined);`,
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "primaryFailure = true;",
      "primaryFailure = true;\n    primaryFailure &&= false;",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "}).catch(() => {",
      "}).catch(async () => {",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "invokedPath !== undefined &&",
      "invokedPath === invokedPath &&",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "isAbsolute, join, resolve }",
      "isAbsolute, join, resolve as pathResolve }",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource
      .replace('markPhase("image_inspection");', "void 0;")
      .replace(
        'markPhase("image_build");',
        'markPhase("image_build");\n    markPhase("image_inspection");',
      ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "async function main(markPhase: AcceptancePhaseMarker): Promise<void> {",
      "async function main(markPhase: AcceptancePhaseMarker): Promise<void> {\n  const filingParserNormalizationExecutionAcceptanceCleanupShouldReplacePhase = (): boolean => true;",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "export const ACCEPTANCE_PHASES",
      "const ACCEPTANCE_PHASES",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      'let acceptancePhase: AcceptancePhase = "environment";',
      'let acceptancePhase: AcceptancePhase = "environment", filingParserNormalizationExecutionAcceptanceFailureDiagnostic = (): string => "filing_parser_normalization_execution_acceptance_failed phase=environment\\n", leakedRevision = requiredEnvironment("GITHUB_SHA");',
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "const environment = acceptanceEnvironment();",
      'const environment = acceptanceEnvironment();\n  void writeFile("/dev/" + "stderr", environment.evidencePath);',
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    `${reviewedExecutionAcceptanceRunnerSource}\nthrow new Error(requiredEnvironment("GITHUB_SHA"));`,
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "const environment = acceptanceEnvironment();",
      'const environment = acceptanceEnvironment();\n  void setTimeout(() => { throw new Error(requiredEnvironment("GITHUB_SHA")); }, 0);',
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "const environment = acceptanceEnvironment();",
      'const environment = acceptanceEnvironment();\n  globalThis["console"].error(environment.evidencePath);',
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "const environment = acceptanceEnvironment();",
      "const environment = acceptanceEnvironment();\n  global.console.error(environment.evidencePath);",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "const environment = acceptanceEnvironment();",
      "const environment = acceptanceEnvironment();\n  void readFile(environment.evidencePath).then(() => undefined);",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "const environment = acceptanceEnvironment();",
      "const environment = acceptanceEnvironment();\n  readFile(environment.evidencePath).finally(() => undefined);",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "async function main(markPhase: AcceptancePhaseMarker): Promise<void> {",
      "async function main(markPhase: AcceptancePhaseMarker): Promise<void> {\n  const Promise = { reject: async (value: unknown): Promise<never> => await globalThis.Promise.reject(value) };",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "await Promise.reject(",
      "void Promise.reject(",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      "  writeFile,",
      "  appendFile,\n  writeFile,",
    ),
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    `${reviewedExecutionAcceptanceRunnerSource}\nclass LateAcceptanceBinding {}`,
  ) === null ||
  filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
    reviewedExecutionAcceptanceRunnerSource.replace(
      'import { spawn } from "node:child_process";',
      'import { exec, spawn } from "node:child_process";',
    ),
  ) === null
)
  throw new Error("Cycle 2j live acceptance diagnostic classifier regressed");
if (
  filingParserNormalizationExecutionImportViolation(
    filingParserNormalizationExecutionProductionPath,
    reviewedExecutionCoreSource,
  ) !== null ||
  filingParserNormalizationExecutionImportViolation(
    filingParserNormalizationExecutionProductionPath,
    `${reviewedExecutionCoreSource}\nvoid import(target);`,
  ) === null ||
  filingParserNormalizationExecutionImportViolation(
    filingParserNormalizationExecutionIndexPath,
    reviewedExecutionIndexSource,
  ) !== null ||
  filingParserNormalizationExecutionImportViolation(
    filingParserNormalizationExecutionIndexPath,
    `${reviewedExecutionIndexSource}\nexport * from "./test-filing-parser-normalization-execution-builder";`,
  ) === null ||
  filingParserNormalizationExecutionImportViolation(
    filingParserNormalizationExecutionAcceptanceIndexPath,
    reviewedExecutionAcceptanceIndexSource,
  ) !== null ||
  filingParserNormalizationExecutionImportViolation(
    filingParserNormalizationExecutionAcceptanceRunnerPath,
    reviewedExecutionAcceptanceRunnerSource,
  ) !== null ||
  filingParserNormalizationExecutionImportViolation(
    filingParserNormalizationExecutionAcceptanceRunnerPath,
    `${reviewedExecutionAcceptanceRunnerSource}\nimport "node:https";`,
  ) === null ||
  filingParserNormalizationHandoffExternalCompositionViolation(
    filingParserNormalizationExecutionProductionPath,
    reviewedExecutionCoreSource,
  ) !== null ||
  workerPythonImportViolation(
    reviewedExecutionWorkerSource,
    allowedFilingParserNormalizationExecutionWorkerPythonImports,
  ) !== null ||
  workerPythonImportViolation(
    `${reviewedExecutionWorkerSource}\nimport socket`,
    allowedFilingParserNormalizationExecutionWorkerPythonImports,
  ) === null ||
  filingParserNormalizationExecutionWorkerTestViolation(
    reviewedExecutionWorkerTestSource,
  ) !== null ||
  filingParserNormalizationExecutionWorkerTestViolation(
    `${reviewedExecutionWorkerTestSource}\nimport socket`,
  ) === null ||
  filingParserNormalizationExecutionTaxonomyViolation(
    reviewedExecutionTaxonomySource,
  ) !== null ||
  filingParserNormalizationExecutionTaxonomyViolation(
    reviewedExecutionTaxonomySource.replace(
      '"taxonomyVersion": "1.0.0"',
      '"taxonomyVersion": "9.0.0"',
    ),
  ) === null ||
  filingParserNormalizationExecutionImageReviewViolation(
    reviewedExecutionImageSource,
  ) !== null ||
  filingParserNormalizationExecutionImageReviewViolation(
    reviewedExecutionImageSource.replace(
      '"pythonVersion": "3.12.13"',
      '"pythonVersion": "3.13.0"',
    ),
  ) === null
)
  throw new Error(
    "Filing-parser-normalization-execution reviewed source classifier regressed",
  );
if (
  !referencesModule(
    'import { compareSyntheticFilingFactValidatorReports } from "@research-cockpit/filing-fact-comparison";',
    filingFactComparisonModule,
  ) ||
  !referencesModule(
    'void import("@research-cockpit/filing-fact-comparison");',
    filingFactComparisonModule,
  ) ||
  !referencesFilingFactComparisonPath(
    "apps/api/src/index.ts",
    "../../../packages/filing-fact-comparison/src/index",
  ) ||
  !hasFilingFactComparisonDependency(
    {
      dependencies: {
        "@research-cockpit/filing-fact-comparison": "workspace:*",
      },
    },
    "apps/api/package.json",
  ) ||
  !hasFilingFactComparisonDependency(
    {
      devDependencies: {
        comparison: "file:../packages/filing-fact-comparison",
      },
    },
    "apps/package.json",
  ) ||
  hasFilingFactComparisonDependency(
    { devDependencies: { typescript: "5.9.3" } },
    "apps/api/package.json",
  )
)
  throw new Error("Filing-fact-comparison composition classifier regressed");
const validFilingFactComparisonManifest = {
  name: filingFactComparisonModule,
  version: "0.1.0",
  private: true,
  type: "module",
  exports: { ".": "./src/index.ts" },
  scripts: {
    build: "tsc --noEmit",
    typecheck: "tsc --noEmit",
    test: "vitest run",
  },
};
if (
  filingFactComparisonManifestViolation(validFilingFactComparisonManifest) !==
    null ||
  filingFactComparisonManifestViolation({
    ...validFilingFactComparisonManifest,
    dependencies: { undici: "latest" },
  }) === null ||
  filingFactComparisonManifestViolation({
    ...validFilingFactComparisonManifest,
    exports: {
      ...validFilingFactComparisonManifest.exports,
      "./builder": "./src/test-filing-fact-comparison-builder.ts",
    },
  }) === null ||
  filingFactComparisonManifestViolation({
    ...validFilingFactComparisonManifest,
    scripts: {
      ...validFilingFactComparisonManifest.scripts,
      test: "curl https://example.invalid",
    },
  }) === null
)
  throw new Error("Filing-fact-comparison manifest classifier regressed");
if (
  exactFilingFactComparisonTreeViolation(filingFactComparisonPackagePaths) !==
    null ||
  exactFilingFactComparisonTreeViolation(
    filingFactComparisonPackagePaths.slice(1),
  ) === null ||
  exactFilingFactComparisonTreeViolation([
    ...filingFactComparisonPackagePaths,
    `${filingFactComparisonSourcePrefix}io-helper.ts`,
  ]) === null
)
  throw new Error("Filing-fact-comparison package-tree classifier regressed");
const validFilingFactComparisonCoreSource = `import { createHash } from "node:crypto";
import { validateDeclaredValidatorAEnvelope } from "./declared-validator-a";
import { validateDeclaredValidatorBEnvelope } from "./declared-validator-b";
void createHash;
void validateDeclaredValidatorAEnvelope;
void validateDeclaredValidatorBEnvelope;
`;
const validFilingFactComparisonValidatorSource = `import { createHash } from "node:crypto";
void createHash;
`;
const validFilingFactComparisonIndexSource = `export {
  FILING_FACT_COMPARISON_SCHEMA_VERSION,
  FILING_FACT_COMPARISON_CLAIM,
  FILING_FACT_COMPARISON_FACT_KEYS,
  FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS,
  FILING_FACT_COMPARISON_CHECKS,
  FILING_FACT_COMPARISON_NOT_PROVEN,
  FILING_FACT_COMPARISON_LIMITS,
  FILING_FACT_COMPARISON_QUARANTINE_CODES,
  compareSyntheticFilingFactValidatorReports,
  type FilingFactComparisonDeclaredValidatorRole,
  type FilingFactComparisonDeclaredValidatorBinding,
  type FilingFactComparisonReceiptValidatorBinding,
  type FilingFactComparisonAudit,
  type FilingFactComparisonQuarantineCode,
  type FilingFactComparisonAgreementReceipt,
  type FilingFactComparisonQuarantinedResult,
  type FilingFactComparisonResult,
} from "./filing-fact-comparison";
`;
const validFilingFactComparisonBuilderSource = `import { createHash } from "node:crypto";
import { FILING_FACT_COMPARISON_FACT_KEYS } from "./filing-fact-comparison";
void createHash;
void FILING_FACT_COMPARISON_FACT_KEYS;
`;
const validFilingFactComparisonUnitTestSource = `import { describe } from "vitest";
import { compareSyntheticFilingFactValidatorReports } from "./filing-fact-comparison";
import { buildSyntheticFilingFactComparisonEnvelopes } from "./test-filing-fact-comparison-builder";
void describe;
void compareSyntheticFilingFactValidatorReports;
void buildSyntheticFilingFactComparisonEnvelopes;
`;
const validFilingFactComparisonSecurityTestSource = `import { createHash } from "node:crypto";
import { describe } from "vitest";
import { compareSyntheticFilingFactValidatorReports } from "./filing-fact-comparison";
import { buildSyntheticFilingFactComparisonEnvelopes } from "./test-filing-fact-comparison-builder";
void createHash;
void describe;
void compareSyntheticFilingFactValidatorReports;
void buildSyntheticFilingFactComparisonEnvelopes;
`;
if (
  filingFactComparisonImportViolation(
    filingFactComparisonProductionPath,
    validFilingFactComparisonCoreSource,
  ) !== null ||
  filingFactComparisonImportViolation(
    filingFactComparisonProductionPath,
    validFilingFactComparisonCoreSource.replace("createHash", "randomBytes"),
  ) === null ||
  filingFactComparisonImportViolation(
    filingFactComparisonProductionPath,
    `${validFilingFactComparisonCoreSource}\nimport "node:fs";`,
  ) === null ||
  filingFactComparisonImportViolation(
    filingFactComparisonProductionPath,
    `${validFilingFactComparisonCoreSource}\nvoid fetch("");`,
  ) === null ||
  filingFactComparisonImportViolation(
    filingFactComparisonProductionPath,
    `${validFilingFactComparisonCoreSource}\nconst target = "node:fs"; void import(target);`,
  ) === null ||
  filingFactComparisonImportViolation(
    filingFactComparisonValidatorAPath,
    validFilingFactComparisonValidatorSource,
  ) !== null ||
  filingFactComparisonImportViolation(
    filingFactComparisonValidatorAPath,
    `${validFilingFactComparisonValidatorSource}\nimport "./shared";`,
  ) === null ||
  filingFactComparisonImportViolation(
    filingFactComparisonValidatorBPath,
    validFilingFactComparisonValidatorSource.replace(
      "node:crypto",
      "node:https",
    ),
  ) === null ||
  filingFactComparisonImportViolation(
    filingFactComparisonValidatorBPath,
    `${validFilingFactComparisonValidatorSource}\nvoid process.env;`,
  ) === null ||
  filingFactComparisonImportViolation(
    filingFactComparisonIndexPath,
    validFilingFactComparisonIndexSource,
  ) !== null ||
  filingFactComparisonImportViolation(
    filingFactComparisonIndexPath,
    validFilingFactComparisonIndexSource.replace(
      "FILING_FACT_COMPARISON_CLAIM,",
      "FILING_FACT_COMPARISON_CLAIM as claim,",
    ),
  ) === null ||
  filingFactComparisonImportViolation(
    filingFactComparisonBuilderPath,
    validFilingFactComparisonBuilderSource,
  ) !== null ||
  filingFactComparisonImportViolation(
    filingFactComparisonBuilderPath,
    `${validFilingFactComparisonBuilderSource}\nvoid globalThis.crypto;`,
  ) === null ||
  filingFactComparisonImportViolation(
    filingFactComparisonUnitTestPath,
    validFilingFactComparisonUnitTestSource,
  ) !== null ||
  filingFactComparisonImportViolation(
    filingFactComparisonSecurityTestPath,
    validFilingFactComparisonSecurityTestSource,
  ) !== null ||
  filingFactComparisonImportViolation(
    filingFactComparisonSecurityTestPath,
    validFilingFactComparisonSecurityTestSource.replace(
      "node:crypto",
      "node:https",
    ),
  ) === null ||
  filingFactComparisonImportViolation(
    `${filingFactComparisonSourcePrefix}io-helper.ts`,
    'import "node:fs";',
  ) === null
)
  throw new Error("Filing-fact-comparison source classifier regressed");
if (
  !referencesModule(
    'import { measureSyntheticFilingQuality } from "@research-cockpit/filing-quality-measurement";',
    filingQualityMeasurementModule,
  ) ||
  !referencesModule(
    'void import("@research-cockpit/filing-quality-measurement");',
    filingQualityMeasurementModule,
  ) ||
  !referencesFilingQualityMeasurementPath(
    "apps/api/src/index.ts",
    "../../../packages/filing-quality-measurement/src/index",
  ) ||
  !hasFilingQualityMeasurementDependency(
    {
      dependencies: {
        "@research-cockpit/filing-quality-measurement": "workspace:*",
      },
    },
    "apps/api/package.json",
  ) ||
  !hasFilingQualityMeasurementDependency(
    {
      devDependencies: {
        quality: "file:../packages/filing-quality-measurement",
      },
    },
    "apps/package.json",
  ) ||
  hasFilingQualityMeasurementDependency(
    { devDependencies: { typescript: "5.9.3" } },
    "apps/api/package.json",
  ) ||
  !isAllowedFilingQualityMeasurementExternalImport(
    filingQualityPrecommitmentProductionPath,
    filingQualityMeasurementModule,
  ) ||
  isAllowedFilingQualityMeasurementExternalImport(
    "apps/api/src/index.ts",
    filingQualityMeasurementModule,
  ) ||
  isAllowedFilingQualityMeasurementExternalImport(
    filingQualityPrecommitmentProductionPath,
    `${filingQualityMeasurementModule}/internal`,
  )
)
  throw new Error(
    "Filing-quality-measurement composition classifier regressed",
  );
const validFilingQualityMeasurementManifest = {
  name: filingQualityMeasurementModule,
  version: "0.1.0",
  private: true,
  type: "module",
  exports: { ".": "./src/index.ts" },
  scripts: {
    build: "tsc --noEmit",
    typecheck: "tsc --noEmit",
    test: "vitest run",
  },
};
if (
  filingQualityMeasurementManifestViolation(
    validFilingQualityMeasurementManifest,
  ) !== null ||
  filingQualityMeasurementManifestViolation({
    ...validFilingQualityMeasurementManifest,
    dependencies: { undici: "latest" },
  }) === null ||
  filingQualityMeasurementManifestViolation({
    ...validFilingQualityMeasurementManifest,
    exports: {
      ...validFilingQualityMeasurementManifest.exports,
      "./builder": "./src/test-filing-quality-measurement-builder.ts",
    },
  }) === null ||
  filingQualityMeasurementManifestViolation({
    ...validFilingQualityMeasurementManifest,
    scripts: {
      ...validFilingQualityMeasurementManifest.scripts,
      test: "curl https://example.invalid",
    },
  }) === null
)
  throw new Error("Filing-quality-measurement manifest classifier regressed");
if (
  exactFilingQualityMeasurementTreeViolation(
    filingQualityMeasurementPackagePaths,
  ) !== null ||
  exactFilingQualityMeasurementTreeViolation(
    filingQualityMeasurementPackagePaths.slice(1),
  ) === null ||
  exactFilingQualityMeasurementTreeViolation([
    ...filingQualityMeasurementPackagePaths,
    `${filingQualityMeasurementSourcePrefix}io-helper.ts`,
  ]) === null
)
  throw new Error(
    "Filing-quality-measurement package-tree classifier regressed",
  );
const validFilingQualityMeasurementCoreSource = `import { createHash } from "node:crypto";
void createHash;
`;
const validFilingQualityMeasurementIndexSource = `export {
  FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
  FILING_QUALITY_MEASUREMENT_CLAIM,
  FILING_QUALITY_MEASUREMENT_FACT_KEYS,
  FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS,
  FILING_QUALITY_MEASUREMENT_METRICS,
  FILING_QUALITY_MEASUREMENT_THRESHOLDS,
  FILING_QUALITY_MEASUREMENT_LIMITS,
  FILING_QUALITY_MEASUREMENT_DECLARATIONS,
  FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES,
  FILING_QUALITY_MEASUREMENT_QUARANTINE_CODES,
  FILING_QUALITY_MEASUREMENT_CHECKS,
  FILING_QUALITY_MEASUREMENT_NOT_PROVEN,
  measureSyntheticFilingQuality,
  type FilingQualityMeasurementDeclaration,
  type FilingQualityMeasurementQuarantineCode,
  type FilingQualityMeasurementFailedThreshold,
  type FilingQualityMeasurementRatioMetric,
  type FilingQualityMeasurementSilentMetric,
  type FilingQualityMeasurementCounts,
  type FilingQualityMeasurementMetrics,
  type FilingQualityMeasurementEvaluatedResult,
  type FilingQualityMeasurementQuarantinedResult,
  type FilingQualityMeasurementResult,
} from "./filing-quality-measurement";
`;
const validFilingQualityMeasurementBuilderSource = `import { createHash } from "node:crypto";
import { FILING_QUALITY_MEASUREMENT_FACT_KEYS } from "./filing-quality-measurement";
void createHash;
void FILING_QUALITY_MEASUREMENT_FACT_KEYS;
`;
const validFilingQualityMeasurementUnitTestSource = `import { describe } from "vitest";
import { measureSyntheticFilingQuality } from "./filing-quality-measurement";
import { buildSyntheticFilingQualityMeasurementDocuments } from "./test-filing-quality-measurement-builder";
void describe;
void measureSyntheticFilingQuality;
void buildSyntheticFilingQualityMeasurementDocuments;
`;
const validFilingQualityMeasurementSecurityTestSource = `import { createHash } from "node:crypto";
import { describe } from "vitest";
import { measureSyntheticFilingQuality } from "./filing-quality-measurement";
import { buildSyntheticFilingQualityMeasurementDocuments } from "./test-filing-quality-measurement-builder";
void createHash;
void describe;
void measureSyntheticFilingQuality;
void buildSyntheticFilingQualityMeasurementDocuments;
`;
if (
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementProductionPath,
    validFilingQualityMeasurementCoreSource,
  ) !== null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementProductionPath,
    validFilingQualityMeasurementCoreSource.replace(
      "createHash",
      "randomBytes",
    ),
  ) === null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementProductionPath,
    `${validFilingQualityMeasurementCoreSource}\nimport "node:fs";`,
  ) === null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementProductionPath,
    `${validFilingQualityMeasurementCoreSource}\nvoid fetch("");`,
  ) === null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementProductionPath,
    `${validFilingQualityMeasurementCoreSource}\nconst target = "node:fs"; void import(target);`,
  ) === null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementProductionPath,
    `${validFilingQualityMeasurementCoreSource}\nvoid Date.now();`,
  ) === null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementProductionPath,
    `${validFilingQualityMeasurementCoreSource}\nvoid Math.random();`,
  ) === null ||
  filingQualityMeasurementArithmeticViolation(
    filingQualityMeasurementProductionPath,
    "const met = 989 / 999 >= 0.99; void met;",
  ) === null ||
  filingQualityMeasurementArithmeticViolation(
    filingQualityMeasurementProductionPath,
    "const met = parseFloat('0.99') > 0; void met;",
  ) === null ||
  filingQualityMeasurementArithmeticViolation(
    filingQualityMeasurementProductionPath,
    "const value = (0.989).toFixed(2); void value;",
  ) === null ||
  filingQualityMeasurementArithmeticViolation(
    filingQualityMeasurementProductionPath,
    "const met = 0.99 + Number.EPSILON > 0; void met;",
  ) === null ||
  filingQualityMeasurementArithmeticViolation(
    filingQualityMeasurementProductionPath,
    "const met = 99 >= 100 * 0.99; void met;",
  ) === null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementIndexPath,
    validFilingQualityMeasurementIndexSource,
  ) !== null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementIndexPath,
    validFilingQualityMeasurementIndexSource.replace(
      "FILING_QUALITY_MEASUREMENT_CLAIM,",
      "FILING_QUALITY_MEASUREMENT_CLAIM as claim,",
    ),
  ) === null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementBuilderPath,
    validFilingQualityMeasurementBuilderSource,
  ) !== null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementBuilderPath,
    `${validFilingQualityMeasurementBuilderSource}\nvoid globalThis.crypto;`,
  ) === null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementUnitTestPath,
    validFilingQualityMeasurementUnitTestSource,
  ) !== null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementSecurityTestPath,
    validFilingQualityMeasurementSecurityTestSource,
  ) !== null ||
  filingQualityMeasurementImportViolation(
    filingQualityMeasurementSecurityTestPath,
    validFilingQualityMeasurementSecurityTestSource.replace(
      "node:crypto",
      "node:https",
    ),
  ) === null ||
  filingQualityMeasurementImportViolation(
    `${filingQualityMeasurementSourcePrefix}io-helper.ts`,
    'import "node:fs";',
  ) === null
)
  throw new Error("Filing-quality-measurement source classifier regressed");
if (
  !referencesModule(
    'import { createSyntheticFilingQualityPrecommitmentProtocol } from "@research-cockpit/filing-quality-precommitment";',
    filingQualityPrecommitmentModule,
  ) ||
  !referencesModule(
    'void import("@research-cockpit/filing-quality-precommitment");',
    filingQualityPrecommitmentModule,
  ) ||
  !referencesFilingQualityPrecommitmentPath(
    "apps/api/src/index.ts",
    "../../../packages/filing-quality-precommitment/src/index",
  ) ||
  !hasFilingQualityPrecommitmentDependency(
    {
      dependencies: {
        "@research-cockpit/filing-quality-precommitment": "workspace:*",
      },
    },
    "apps/api/package.json",
  ) ||
  !hasFilingQualityPrecommitmentDependency(
    {
      devDependencies: {
        precommitment: "file:../packages/filing-quality-precommitment",
      },
    },
    "apps/package.json",
  ) ||
  hasFilingQualityPrecommitmentDependency(
    { devDependencies: { typescript: "5.9.3" } },
    "apps/api/package.json",
  )
)
  throw new Error(
    "Filing-quality-precommitment composition classifier regressed",
  );
if (
  !referencesFilingParserQualityCompositionPath(
    "apps/api/src/index.ts",
    "../../../packages/filing-parser-quality-composition/src/index",
  ) ||
  !hasFilingParserQualityCompositionDependency(
    {
      dependencies: {
        "@research-cockpit/filing-parser-quality-composition": "workspace:*",
      },
    },
    "apps/api/package.json",
  ) ||
  hasFilingParserQualityCompositionDependency(
    { devDependencies: { typescript: "5.9.3" } },
    "apps/api/package.json",
  ) ||
  !isAllowedFilingParserQualityCompositionExternalImport(
    `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}evidence.ts`,
    filingParserQualityCompositionModule,
  ) ||
  isAllowedFilingParserQualityCompositionExternalImport(
    "apps/api/src/index.ts",
    filingParserQualityCompositionModule,
  ) ||
  isAllowedFilingParserQualityCompositionExternalImport(
    `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}evidence.ts`,
    `${filingParserQualityCompositionModule}/internal`,
  )
)
  throw new Error(
    "Filing-parser quality-composition isolation classifier regressed",
  );
const validFilingQualityPrecommitmentManifest = {
  name: filingQualityPrecommitmentModule,
  version: "0.1.0",
  private: true,
  type: "module",
  exports: { ".": "./src/index.ts" },
  scripts: {
    build: "tsc --noEmit",
    typecheck: "tsc --noEmit",
    test: "vitest run",
  },
  dependencies: {
    [filingQualityMeasurementModule]: "workspace:*",
  },
};
if (
  filingQualityPrecommitmentManifestViolation(
    validFilingQualityPrecommitmentManifest,
  ) !== null ||
  filingQualityPrecommitmentManifestViolation({
    ...validFilingQualityPrecommitmentManifest,
    dependencies: {
      ...validFilingQualityPrecommitmentManifest.dependencies,
      undici: "latest",
    },
  }) === null ||
  filingQualityPrecommitmentManifestViolation({
    ...validFilingQualityPrecommitmentManifest,
    exports: {
      ...validFilingQualityPrecommitmentManifest.exports,
      "./builder": "./src/test-filing-quality-precommitment-builder.ts",
    },
  }) === null ||
  filingQualityPrecommitmentManifestViolation({
    ...validFilingQualityPrecommitmentManifest,
    scripts: {
      ...validFilingQualityPrecommitmentManifest.scripts,
      test: "curl https://example.invalid",
    },
  }) === null
)
  throw new Error("Filing-quality-precommitment manifest classifier regressed");
if (
  exactFilingQualityPrecommitmentTreeViolation(
    filingQualityPrecommitmentPackagePaths,
  ) !== null ||
  exactFilingQualityPrecommitmentTreeViolation(
    filingQualityPrecommitmentPackagePaths.slice(1),
  ) === null ||
  exactFilingQualityPrecommitmentTreeViolation([
    ...filingQualityPrecommitmentPackagePaths,
    `${filingQualityPrecommitmentSourcePrefix}io-helper.ts`,
  ]) === null
)
  throw new Error(
    "Filing-quality-precommitment package-tree classifier regressed",
  );
const validFilingQualityPrecommitmentCoreSource = `import { createHash } from "node:crypto";
import {
  FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS,
  FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES,
  FILING_QUALITY_MEASUREMENT_CLAIM,
  FILING_QUALITY_MEASUREMENT_DECLARATIONS,
  FILING_QUALITY_MEASUREMENT_FACT_KEYS,
  FILING_QUALITY_MEASUREMENT_LIMITS,
  FILING_QUALITY_MEASUREMENT_METRICS,
  FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
  FILING_QUALITY_MEASUREMENT_THRESHOLDS,
  measureSyntheticFilingQuality,
  type FilingQualityMeasurementDeclaration,
  type FilingQualityMeasurementEvaluatedResult,
} from "@research-cockpit/filing-quality-measurement";
void createHash;
`;
const validFilingQualityPrecommitmentIndexSource = `export {
  FILING_QUALITY_PRECOMMITMENT_CHECKS,
  FILING_QUALITY_PRECOMMITMENT_CLAIM,
  FILING_QUALITY_PRECOMMITMENT_LIMITS,
  FILING_QUALITY_PRECOMMITMENT_NOT_PROVEN,
  FILING_QUALITY_PRECOMMITMENT_QUARANTINE_CODES,
  FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
  createSyntheticFilingQualityPrecommitmentProtocol,
  type FilingQualityPrecommitmentAudit,
  type FilingQualityPrecommitmentCapability,
  type FilingQualityPrecommitmentCommitResult,
  type FilingQualityPrecommitmentCommittedResult,
  type FilingQualityPrecommitmentEvaluatedResult,
  type FilingQualityPrecommitmentProtocol,
  type FilingQualityPrecommitmentQuarantineCode,
  type FilingQualityPrecommitmentQuarantinedResult,
  type FilingQualityPrecommitmentRevealResult,
} from "./filing-quality-precommitment";
`;
const validFilingQualityPrecommitmentBuilderSource = `import { createHash } from "node:crypto";
import { FILING_QUALITY_MEASUREMENT_FACT_KEYS } from "@research-cockpit/filing-quality-measurement";
import { FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION } from "./filing-quality-precommitment";
void createHash;
void FILING_QUALITY_MEASUREMENT_FACT_KEYS;
void FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION;
`;
const validFilingQualityPrecommitmentUnitTestSource = `import { createHash } from "node:crypto";
import { describe } from "vitest";
import { createSyntheticFilingQualityPrecommitmentProtocol } from "./filing-quality-precommitment";
import { buildSyntheticFilingQualityPrecommitmentDocuments } from "./test-filing-quality-precommitment-builder";
void createHash;
void describe;
void createSyntheticFilingQualityPrecommitmentProtocol;
void buildSyntheticFilingQualityPrecommitmentDocuments;
`;
const validFilingQualityPrecommitmentSecurityTestSource =
  validFilingQualityPrecommitmentUnitTestSource;
if (
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentProductionPath,
    validFilingQualityPrecommitmentCoreSource,
  ) !== null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentProductionPath,
    validFilingQualityPrecommitmentCoreSource.replace(
      "createHash",
      "randomBytes",
    ),
  ) === null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentProductionPath,
    `${validFilingQualityPrecommitmentCoreSource}\nimport "node:fs";`,
  ) === null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentProductionPath,
    `${validFilingQualityPrecommitmentCoreSource}\nvoid fetch("");`,
  ) === null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentProductionPath,
    `${validFilingQualityPrecommitmentCoreSource}\nconst target = "node:fs"; void import(target);`,
  ) === null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentProductionPath,
    `${validFilingQualityPrecommitmentCoreSource}\nvoid Date.now();`,
  ) === null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentProductionPath,
    `${validFilingQualityPrecommitmentCoreSource}\nvoid Math.random();`,
  ) === null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentProductionPath,
    `${validFilingQualityPrecommitmentCoreSource}\nvoid globalThis.crypto;`,
  ) === null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentIndexPath,
    validFilingQualityPrecommitmentIndexSource,
  ) !== null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentIndexPath,
    validFilingQualityPrecommitmentIndexSource.replace(
      "FILING_QUALITY_PRECOMMITMENT_CLAIM,",
      "FILING_QUALITY_PRECOMMITMENT_CLAIM as claim,",
    ),
  ) === null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentBuilderPath,
    validFilingQualityPrecommitmentBuilderSource,
  ) !== null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentBuilderPath,
    validFilingQualityPrecommitmentBuilderSource.replace(
      filingQualityMeasurementModule,
      `${filingQualityMeasurementModule}/internal`,
    ),
  ) === null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentUnitTestPath,
    validFilingQualityPrecommitmentUnitTestSource,
  ) !== null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentSecurityTestPath,
    validFilingQualityPrecommitmentSecurityTestSource,
  ) !== null ||
  filingQualityPrecommitmentImportViolation(
    filingQualityPrecommitmentSecurityTestPath,
    validFilingQualityPrecommitmentSecurityTestSource.replace(
      "node:crypto",
      "node:https",
    ),
  ) === null ||
  filingQualityPrecommitmentImportViolation(
    `${filingQualityPrecommitmentSourcePrefix}io-helper.ts`,
    'import "node:fs";',
  ) === null
)
  throw new Error("Filing-quality-precommitment source classifier regressed");
if (
  !referencesModule(
    'import { createFileSystemFilingPayloadCustodyBoundary } from "@research-cockpit/filing-payload-custody";',
    filingPayloadCustodyModule,
  ) ||
  !referencesFilingPayloadCustodyPath(
    "apps/api/src/index.ts",
    "../../../packages/filing-payload-custody/src/index",
  ) ||
  !referencesFilingPayloadCustodyPath(
    filingPayloadCustodyProductionPath,
    "./payload-custody",
  ) ||
  !hasFilingPayloadCustodyDependency(
    {
      dependencies: {
        "@research-cockpit/filing-payload-custody": "workspace:*",
      },
    },
    "apps/api/package.json",
  ) ||
  hasFilingPayloadCustodyDependency(
    { devDependencies: { typescript: "5.9.3" } },
    "apps/api/package.json",
  ) ||
  !isAllowedFilingPayloadCustodyExternalImport(
    filingPayloadCustodyFixtureGuardPath,
    "../packages/filing-payload-custody/src/payload-custody",
  ) ||
  !isAllowedFilingPayloadCustodyExternalImport(
    filingPayloadCustodyFixtureGuardPath,
    "../packages/filing-payload-custody/src/test-payload-builder",
  ) ||
  isAllowedFilingPayloadCustodyExternalImport(
    "scripts/other.ts",
    "../packages/filing-payload-custody/src/payload-custody",
  ) ||
  isAllowedFilingPayloadCustodyExternalImport(
    filingPayloadCustodyFixtureGuardPath,
    "../packages/filing-payload-custody/src/run-filing-payload-custody-acceptance",
  )
)
  throw new Error("Filing-payload-custody composition classifier regressed");
const validFilingPayloadCustodyFixtureGuardSource = `import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import "../packages/filing-payload-custody/src/payload-custody";
import "../packages/filing-payload-custody/src/test-payload-builder";
void createHash;
void constants;
void open;
void join;
void fileURLToPath;
process.stdout.write("");
`;
if (
  filingPayloadCustodyFixtureGuardViolation(
    validFilingPayloadCustodyFixtureGuardSource,
  ) !== null ||
  filingPayloadCustodyFixtureGuardViolation(
    validFilingPayloadCustodyFixtureGuardSource.replace(
      'import { createHash } from "node:crypto";',
      'import { request } from "node:https";',
    ),
  ) === null ||
  filingPayloadCustodyFixtureGuardViolation(
    `${validFilingPayloadCustodyFixtureGuardSource}\nvoid fetch("");`,
  ) === null
)
  throw new Error("Filing-payload-custody fixture guard classifier regressed");
const validFilingPayloadCustodyManifest = {
  name: filingPayloadCustodyModule,
  version: "0.1.0",
  private: true,
  type: "module",
  exports: { ".": "./src/index.ts" },
  scripts: {
    build: "tsc --noEmit",
    typecheck: "tsc --noEmit",
    test: "vitest run",
  },
};
if (
  filingPayloadCustodyManifestViolation(validFilingPayloadCustodyManifest) !==
    null ||
  filingPayloadCustodyManifestViolation({
    ...validFilingPayloadCustodyManifest,
    exports: {
      ...validFilingPayloadCustodyManifest.exports,
      "./test": "./src/payload-custody-security.test.ts",
    },
  }) === null ||
  filingPayloadCustodyManifestViolation({
    ...validFilingPayloadCustodyManifest,
    scripts: {
      ...validFilingPayloadCustodyManifest.scripts,
      test: "curl https://example.invalid",
    },
  }) === null
)
  throw new Error("Filing-payload-custody manifest classifier regressed");
const validFilingPayloadCustodySource = `import {
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";
import type { Stats } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rename,
  rm,
  unlink,
} from "node:fs/promises";
import {
  basename,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
  sep,
} from "node:path";
void createCipheriv;
void createDecipheriv;
void createHash;
let metadata: Stats | undefined;
void metadata;
void chmod;
void lstat;
void mkdir;
void mkdtemp;
void open;
void readdir;
void realpath;
void rename;
void rm;
void unlink;
void basename;
void isAbsolute;
void join;
void parse;
void relative;
void resolve;
void sep;
`;
const validFilingPayloadCustodyIndexSource = `export {
  FILING_PAYLOAD_CUSTODY_ALGORITHM,
  FILING_PAYLOAD_CUSTODY_CLAIM,
  FILING_PAYLOAD_CUSTODY_ERROR_CODES,
  FILING_PAYLOAD_CUSTODY_FIXTURE,
  FILING_PAYLOAD_CUSTODY_LIMITS,
  FILING_PAYLOAD_CUSTODY_RETENTION_POLICY,
  FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION,
  FilingPayloadCustodyError,
  createFileSystemFilingPayloadCustodyBoundary,
  createSyntheticFilingPayloadFixture,
  createSyntheticInMemoryFilingPayloadKeyStore,
  type FilingPayloadAuditCommand,
  type FilingPayloadAuditRecord,
  type FilingPayloadCustodyBoundary,
  type FilingPayloadCustodyClock,
  type FilingPayloadCustodyEntropy,
  type FilingPayloadCustodyErrorCode,
  type FilingPayloadCustodyOptions,
  type FilingPayloadCustodyReceipt,
  type FilingPayloadCustodyState,
  type FilingPayloadExpireCommand,
  type FilingPayloadKeyStore,
  type FilingPayloadReadCommand,
  type FilingPayloadStageCommand,
} from "./payload-custody";

export {
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CHECKS,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_NOT_PROVEN,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
  createFilingParserArchivePairCustodyProtocol,
  type FilingParserArchivePairCustodyProtocol,
  type FilingParserArchivePairCustodyQuarantinedResult,
  type FilingParserArchivePairCustodyReadbackResult,
  type FilingParserArchivePairCustodyReceipt,
  type FilingParserArchivePairCustodyResult,
} from "./parser-archive-pair-custody";

export {
  createSyntheticFilingParserArchivePairFixture,
  type SyntheticFilingParserArchivePairFixture,
} from "./parser-archive-pair-fixture";
`;
if (
  filingPayloadCustodyImportViolation(
    filingPayloadCustodyProductionPath,
    validFilingPayloadCustodySource,
  ) !== null ||
  filingPayloadCustodyImportViolation(
    filingPayloadCustodyProductionPath,
    `${validFilingPayloadCustodySource}\nvoid fetch("");`,
  ) === null ||
  filingPayloadCustodyImportViolation(
    filingPayloadCustodyProductionPath,
    `${validFilingPayloadCustodySource}\nvoid process.env;`,
  ) === null ||
  filingPayloadCustodyImportViolation(
    filingPayloadCustodyProductionPath,
    `${validFilingPayloadCustodySource}\nvoid crypto.subtle;`,
  ) === null ||
  filingPayloadCustodyImportViolation(
    filingPayloadCustodyProductionPath,
    `${validFilingPayloadCustodySource}\nconst target = "node:fs"; void import(target);`,
  ) === null ||
  filingPayloadCustodyImportViolation(
    filingPayloadCustodyProductionPath,
    `${validFilingPayloadCustodySource}\nimport "./payload-custody-io-helper";`,
  ) === null ||
  filingPayloadCustodyImportViolation(
    filingPayloadCustodyProductionPath,
    validFilingPayloadCustodySource.replace(
      "createHash,",
      "createHash,\n  randomBytes,",
    ),
  ) === null ||
  filingPayloadCustodyImportViolation(
    filingPayloadCustodyProductionPath,
    validFilingPayloadCustodySource.replace("  parse,\n", ""),
  ) === null ||
  filingPayloadCustodyImportViolation(
    filingPayloadCustodyIndexPath,
    validFilingPayloadCustodyIndexSource,
  ) !== null ||
  filingPayloadCustodyImportViolation(
    filingPayloadCustodyIndexPath,
    `${validFilingPayloadCustodyIndexSource}\nexport { createFileSystemFilingPayloadCustodyTestHarness } from "./payload-custody";`,
  ) === null ||
  filingPayloadCustodyImportViolation(
    filingPayloadCustodyIndexPath,
    'export * from "./payload-custody";',
  ) === null ||
  filingPayloadCustodyImportViolation(
    `${filingPayloadCustodySourcePrefix}payload-custody-io-helper.ts`,
    'import "node:fs";',
  ) === null ||
  filingPayloadCustodyImportViolation(
    "packages/filing-parser/src/parser-boundary.ts",
    'import "node:fs";',
  ) !== null
)
  throw new Error("Filing-payload-custody source classifier regressed");
const validFilingPayloadCustodyTestSource = `import { createHash } from "node:crypto";
import { describe } from "vitest";
import "./payload-custody";
if (process.platform === "win32") void createHash;
void describe;
`;
if (
  filingPayloadCustodyTestViolation(
    `${filingPayloadCustodySourcePrefix}boundary.test.ts`,
    validFilingPayloadCustodyTestSource,
  ) !== null ||
  filingPayloadCustodyTestViolation(
    `${filingPayloadCustodySourcePrefix}boundary.test.ts`,
    validFilingPayloadCustodyTestSource.replace("node:crypto", "node:https"),
  ) === null ||
  filingPayloadCustodyTestViolation(
    `${filingPayloadCustodySourcePrefix}boundary.test.ts`,
    `${validFilingPayloadCustodyTestSource}\nvoid fetch("");`,
  ) === null ||
  filingPayloadCustodyTestViolation(
    `${filingPayloadCustodySourcePrefix}boundary.test.ts`,
    `${validFilingPayloadCustodyTestSource}\nconst target = "node:net"; void import(target);`,
  ) === null ||
  filingPayloadCustodyTestViolation(
    `${filingPayloadCustodySourcePrefix}boundary.test.ts`,
    `${validFilingPayloadCustodyTestSource}\nvoid process.getBuiltinModule("node:net");`,
  ) === null
)
  throw new Error("Filing-payload-custody test classifier regressed");
const filingPayloadCustodyVerifierPath = `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence-verifier.ts`;
const validFilingPayloadCustodyVerifierProcessSource = `import { spawn } from "node:child_process";
function git(cwd: string, args: readonly string[], environment: NodeJS.ProcessEnv) {
  return spawn("git", gitArgumentsWithoutReplacementObjects(args), {
    cwd,
    env: environment,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
void git;
`;
if (
  filingPayloadCustodyChildProcessViolation(
    filingPayloadCustodyVerifierPath,
    validFilingPayloadCustodyVerifierProcessSource,
  ) !== null ||
  filingPayloadCustodyChildProcessViolation(
    filingPayloadCustodyVerifierPath,
    validFilingPayloadCustodyVerifierProcessSource.replace(
      'spawn("git"',
      'spawn("curl"',
    ),
  ) === null ||
  filingPayloadCustodyChildProcessViolation(
    filingPayloadCustodyVerifierPath,
    validFilingPayloadCustodyVerifierProcessSource.replace(
      "gitArgumentsWithoutReplacementObjects(args)",
      "args",
    ),
  ) === null ||
  filingPayloadCustodyChildProcessViolation(
    filingPayloadCustodyVerifierPath,
    `${validFilingPayloadCustodyVerifierProcessSource}\nconst unsafeSpawn = spawn; void unsafeSpawn;`,
  ) === null ||
  filingPayloadCustodyToolGlobalViolation(
    filingPayloadCustodyVerifierPath,
    "void process.getBuiltinModule;",
  ) === null
)
  throw new Error("Filing-payload-custody verifier process guard regressed");
const filingPayloadCustodyAcceptancePath = `${filingPayloadCustodySourcePrefix}run-filing-payload-custody-acceptance.ts`;
const validFilingPayloadCustodyAcceptanceProcessSource = `import { spawn } from "node:child_process";
void commandOutput("pnpm", []);
function git(cwd: string, args: readonly string[]) {
  return commandOutput("git", gitArgumentsWithoutReplacementObjects(args), cwd);
}
void git(".", []);
function commandOutput(
  command: string,
  args: readonly string[],
  cwd = ".",
  environment: NodeJS.ProcessEnv = {},
) {
  return spawn(command, args, {
    cwd,
    env: environment,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
`;
if (
  filingPayloadCustodyChildProcessViolation(
    filingPayloadCustodyAcceptancePath,
    validFilingPayloadCustodyAcceptanceProcessSource,
  ) !== null ||
  filingPayloadCustodyChildProcessViolation(
    filingPayloadCustodyAcceptancePath,
    validFilingPayloadCustodyAcceptanceProcessSource.replace(
      'commandOutput("pnpm"',
      'commandOutput("curl"',
    ),
  ) === null ||
  filingPayloadCustodyChildProcessViolation(
    filingPayloadCustodyAcceptancePath,
    validFilingPayloadCustodyAcceptanceProcessSource.replace(
      'void commandOutput("pnpm", []);',
      'const commandName = "pnpm"; void commandOutput(commandName, []);',
    ),
  ) === null ||
  filingPayloadCustodyChildProcessViolation(
    filingPayloadCustodyAcceptancePath,
    validFilingPayloadCustodyAcceptanceProcessSource.replace(
      "gitArgumentsWithoutReplacementObjects(args)",
      "args",
    ),
  ) === null ||
  filingPayloadCustodyChildProcessViolation(
    filingPayloadCustodyAcceptancePath,
    validFilingPayloadCustodyAcceptanceProcessSource.replace(
      "  return spawn(command, args, {",
      '  command = "curl";\n  return spawn(command, args, {',
    ),
  ) === null
)
  throw new Error("Filing-payload-custody acceptance process guard regressed");
if (
  !referencesFilingParserPath(
    "apps/api/src/index.ts",
    "../../../packages/filing-parser/src/index",
  ) ||
  !referencesFilingParserPath(
    "packages/ui/src/index.ts",
    "../../filing-parser/src/index",
  )
)
  throw new Error("Filing-parser relative-path classifier regressed");
if (
  !referencesExternalWorkspacePath(
    "packages/filing-parser/src/index.ts",
    "../../db/src/index",
  ) ||
  !referencesExternalWorkspacePath(
    "packages/filing-parser/src/index.ts",
    "../../../apps/api/src/index",
  ) ||
  !referencesExternalWorkspacePath(
    "packages/filing-parser/src/index.ts",
    "../../../config/private",
  ) ||
  referencesExternalWorkspacePath(
    "packages/filing-parser/src/index.ts",
    "./parser-boundary.js",
  ) ||
  referencesExternalWorkspacePath(
    "packages/filing-parser/src/index.ts",
    "../worker/worker-types.js",
  )
)
  throw new Error("Filing-parser relative-import containment regressed");
if (
  corpusAdmissionImportViolation(
    corpusAdmissionProductionPath,
    'import { createHash, createPublicKey, verify as verifySignature, type KeyObject } from "node:crypto";',
  ) !== null ||
  corpusAdmissionImportViolation(
    corpusAdmissionProductionPath,
    'import { createHash, generateKeyPairSync, verify as verifySignature, type KeyObject } from "node:crypto";',
  ) === null ||
  corpusAdmissionImportViolation(
    corpusAdmissionProductionPath,
    'import "node:fs";',
  ) === null ||
  corpusAdmissionImportViolation(
    corpusAdmissionProductionPath,
    'import "fs";',
  ) === null ||
  corpusAdmissionImportViolation(
    corpusAdmissionProductionPath,
    'void import("node:" + "https");',
  ) === null ||
  corpusAdmissionImportViolation(
    corpusAdmissionProductionPath,
    'const parser = require("./parser-boundary");',
  ) === null ||
  corpusAdmissionImportViolation(
    corpusAdmissionProductionPath,
    'import "./corpus-admission-io-helper";',
  ) === null ||
  corpusAdmissionImportViolation(
    corpusAdmissionProductionPath,
    'import { createHash, createPublicKey, verify as verifySignature, type KeyObject } from "node:crypto"; void fetch("");',
  ) === null ||
  corpusAdmissionImportViolation(
    corpusAdmissionProductionPath,
    'import { createHash, createPublicKey, verify as verifySignature, type KeyObject } from "node:crypto"; void process.env;',
  ) === null ||
  corpusAdmissionImportViolation(
    corpusAdmissionProductionPath,
    'import { createHash, createPublicKey, verify as verifySignature, type KeyObject } from "node:crypto"; void crypto.subtle;',
  ) === null ||
  corpusAdmissionImportViolation(
    corpusAdmissionProductionPath,
    'import { createHash, createPublicKey, verify as verifySignature, type KeyObject } from "node:crypto"; const target = "node:fs"; void import(target);',
  ) === null ||
  corpusAdmissionImportViolation(
    "packages/filing-parser/src/parser-boundary.ts",
    'import "node:fs";',
  ) !== null
)
  throw new Error("Filing-corpus metadata-only import classifier regressed");
for (const source of [
  "import importlib",
  "from runpy import run_module",
  'importlib.import_module("plugin")',
  'runpy.run_path("plugin.py")',
]) {
  if (!forbiddenWorkerPython.some((pattern) => pattern.test(source)))
    throw new Error("Filing-parser dynamic-load classifier regressed");
  if (
    workerPythonImportViolation(
      [...allowedWorkerPythonImports, "import antigravity"].join("\n"),
    ) === null ||
    workerPythonImportViolation([...allowedWorkerPythonImports].join("\n")) !==
      null
  )
    throw new Error("Filing-parser Python import allowlist regressed");
}
if (
  !isForbiddenFilingParserCompositionPath("packages/ui/package.json") ||
  !isForbiddenFilingParserCompositionPath("apps/api/src/index.ts") ||
  isForbiddenFilingParserCompositionPath(
    "packages/filing-parser/src/parser-boundary.ts",
  ) ||
  !hasFilingParserDependency(
    {
      peerDependencies: { "@research-cockpit/filing-parser": "workspace:*" },
    },
    "packages/ui/package.json",
  ) ||
  !hasFilingParserDependency(
    { dependencies: { parserAlias: "file:../filing-parser" } },
    "packages/ui/package.json",
  ) ||
  !hasFilingParserDependency(
    { optionalDependencies: { parserAlias: "link:../filing-parser" } },
    "packages/ui/package.json",
  ) ||
  !hasFilingParserDependency(
    { devDependencies: { parserAlias: "workspace:../filing-parser" } },
    "packages/ui/package.json",
  ) ||
  hasFilingParserDependency(
    { dependencies: { typescript: "5.9.3" } },
    "packages/ui/package.json",
  )
)
  throw new Error("Filing-parser dependency classifier regressed");
const validWorkerDockerfile = `FROM docker.io/library/python:3.12.13-slim-bookworm@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2

ENV LANG=C.UTF-8 \\
    LC_ALL=C.UTF-8 \\
    PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    TZ=UTC

WORKDIR /input
WORKDIR /worker

COPY --chown=0:0 --chmod=0444 worker/parser.py /worker/parser.py
COPY --chown=0:0 --chmod=0444 worker/taxonomy-v1.json /worker/taxonomy-v1.json

USER 65532:65532

ENTRYPOINT ["python", "-I", "-B", "/worker/parser.py"]
`;
const validFilingParserNormalizationExecutionWorkerDockerfile = `${validWorkerDockerfile.trimEnd()}
CMD []
`;
if (
  filingParserDockerfileViolation(validWorkerDockerfile) !== null ||
  filingParserDockerfileViolation(`${validWorkerDockerfile}EXPOSE 8080\n`) ===
    null ||
  filingParserDockerfileViolation(
    `${validWorkerDockerfile}HEALTHCHECK CMD true\n`,
  ) === null ||
  filingParserDockerfileViolation(
    `${validWorkerDockerfile}ENTRYPOINT ["python", "-c", "pass"]\n`,
  ) === null ||
  filingParserDockerfileViolation(
    validWorkerDockerfile.replace("USER 65532:65532", "USER root"),
  ) === null ||
  filingParserDockerfileViolation(
    validWorkerDockerfile.replace(
      'ENTRYPOINT ["python", "-I", "-B", "/worker/parser.py"]',
      'CMD ["python", "/worker/parser.py"]',
    ),
  ) === null
)
  throw new Error("Filing-parser Dockerfile classifier regressed");
if (
  filingParserNormalizationExecutionDockerfileViolation(
    validFilingParserNormalizationExecutionWorkerDockerfile,
  ) !== null ||
  filingParserNormalizationExecutionDockerfileViolation(
    validWorkerDockerfile,
  ) === null ||
  filingParserNormalizationExecutionDockerfileViolation(
    validFilingParserNormalizationExecutionWorkerDockerfile.replace(
      "CMD []",
      'CMD ["python3"]',
    ),
  ) === null
)
  throw new Error(
    "Filing-parser-normalization-execution Dockerfile classifier regressed",
  );

for (const file of filesToInspect) {
  const relativePath = relative(root, file).replaceAll("\\", "/");
  const extension = extname(file).toLowerCase();
  if (
    (relativePath.startsWith("packages/filing-parser/") ||
      relativePath.startsWith(
        filingParserNormalizationExecutionPackagePrefix,
      )) &&
    (extension === ".pyc" || relativePath.includes("/__pycache__/"))
  ) {
    violations.push(`${relativePath}: generated Python bytecode is forbidden`);
    continue;
  }
  if (copiedAssetExtensions.has(extension)) {
    violations.push(`${relativePath}: raster assets require provenance review`);
    continue;
  }
  if (
    !textExtensions.has(extension) &&
    !isDockerfileName(basename(file).toLowerCase())
  )
    continue;
  const content = typeScriptConfigFilesToInspect.has(file)
    ? typeScriptConfigContents.get(file)
    : await readFile(file, "utf8");
  if (content === undefined) continue;
  for (const pattern of forbiddenText) {
    if (pattern.test(content))
      violations.push(`${relativePath}: matched ${pattern}`);
  }
  const fileName = basename(file).toLowerCase();
  const isInfrastructureFile =
    (!relativePath.includes("/") && isRootInfrastructureFile(fileName)) ||
    relativePath.startsWith(".github/") ||
    relativePath.startsWith("config/") ||
    relativePath.startsWith("db/") ||
    relativePath.startsWith("infra/") ||
    relativePath.startsWith("packages/db/");
  const isDatabaseOrContainerSurface =
    extension === ".sql" ||
    extension === ".conf" ||
    isDockerfileName(fileName) ||
    isComposeFileName(fileName) ||
    (isInfrastructureFile &&
      [".ps1", ".sh", ".toml", ".yaml", ".yml"].includes(extension));
  if (isDatabaseOrContainerSurface) {
    for (const pattern of forbiddenDatabaseText) {
      if (pattern.test(content))
        violations.push(
          `${relativePath}: prohibited database import ${pattern}`,
        );
    }
  }
  if (file.endsWith("package.json")) {
    inspectDependencies(relativePath, JSON.parse(content) as unknown);
  }
  if (typeScriptConfigFilesToInspect.has(file)) {
    const parsed = ts.parseConfigFileTextToJson(relativePath, content);
    if (parsed.error !== undefined) {
      violations.push(
        `${relativePath}: TypeScript config must remain parseable`,
      );
    } else {
      const handoffAliasViolation =
        filingParserNormalizationHandoffTsconfigViolation(
          relativePath,
          parsed.config,
        );
      if (handoffAliasViolation !== null)
        violations.push(`${relativePath}: ${handoffAliasViolation}`);
      const executionAliasViolation =
        filingParserNormalizationExecutionTsconfigViolation(
          relativePath,
          parsed.config,
        );
      if (executionAliasViolation !== null)
        violations.push(`${relativePath}: ${executionAliasViolation}`);
    }
  }
  inspectCompositionBoundary(relativePath, content);
  inspectFilingParserWorker(relativePath, content);
}

for (const file of externalCompositionFilesToInspect) {
  if (filesToInspect.has(file)) continue;
  const relativePath = relative(root, file).replaceAll("\\", "/");
  const content = await readFile(file, "utf8");
  const handoffViolation =
    filingParserNormalizationHandoffExternalCompositionViolation(
      relativePath,
      content,
    );
  if (handoffViolation !== null)
    violations.push(`${relativePath}: ${handoffViolation}`);
  const executionViolation =
    filingParserNormalizationExecutionExternalCompositionViolation(
      relativePath,
      content,
    );
  if (executionViolation !== null)
    violations.push(`${relativePath}: ${executionViolation}`);
}

if (violations.length > 0) {
  throw new Error(
    `Clean-room boundary violations:\n- ${violations.join("\n- ")}`,
  );
}
console.log("Clean-room source and dependency boundary verified.");

function doubleQuotedShellArray(
  source: string,
  name: string,
): readonly string[] | null {
  const match = new RegExp(
    `(?:^|\\n)\\s*${name}=\\(\\r?\\n([\\s\\S]*?)\\r?\\n\\s*\\)`,
    "u",
  ).exec(source);
  if (match?.[1] === undefined) return null;
  const values: string[] = [];
  for (const rawLine of match[1].split(/\r?\n/u)) {
    const line = rawLine.trim();
    const value = /^"([^"\\]*)"$/u.exec(line)?.[1];
    if (value === undefined) return null;
    values.push(value);
  }
  return values;
}

function hasExactApiBuildEntries(content: string): boolean {
  return /\bentry:\s*\[\s*"src\/server\.ts",\s*"src\/connected-server\.ts",\s*"src\/security-master-server\.ts",\s*"src\/vault-server\.ts",?\s*\]/u.test(
    content,
  );
}

async function personalSecurityMasterBoundaryViolations(): Promise<string[]> {
  const found: string[] = [];
  const actualTree = [...filesToInspect]
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .filter((path) => path.startsWith(personalSecurityMasterPackagePrefix))
    .sort();
  if (
    JSON.stringify(actualTree) !==
    JSON.stringify(personalSecurityMasterPackagePaths)
  ) {
    found.push(
      `${personalSecurityMasterPackagePrefix}: Cycle 3e-a package tree must remain the exact manifest, tsconfig, root core/index/test surface, and isolated Cycle 3e-a1 source-preparation subpath`,
    );
  }

  const manifestPath = `${personalSecurityMasterPackagePrefix}package.json`;
  const manifest = await cycle2kJson(manifestPath, found);
  const expectedManifest = {
    name: personalSecurityMasterModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: {
      ".": "./src/index.ts",
      "./sec-openfigi-v1-source-preparation":
        "./src/sec-openfigi-v1-source-preparation.ts",
    },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
  };
  if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest)) {
    found.push(
      `${manifestPath}: Cycle 3e-a security master must remain private with the exact root and isolated source-preparation exports and zero production dependencies`,
    );
  }

  const tsconfigPath = `${personalSecurityMasterPackagePrefix}tsconfig.json`;
  const tsconfig = await cycle2kJson(tsconfigPath, found);
  const expectedTsconfig = {
    extends: "../../tsconfig.base.json",
    compilerOptions: { noEmit: true, types: ["node"] },
    include: ["src/**/*.ts"],
  };
  if (JSON.stringify(tsconfig) !== JSON.stringify(expectedTsconfig)) {
    found.push(`${tsconfigPath}: Cycle 3e-a tsconfig must remain exact`);
  }

  const corePath =
    `${personalSecurityMasterPackagePrefix}src/personal-security-master.ts` as const;
  const indexPath =
    `${personalSecurityMasterPackagePrefix}src/index.ts` as const;
  const builderPath =
    `${personalSecurityMasterPackagePrefix}src/test-personal-security-master-builder.ts` as const;
  const unitTestPath =
    `${personalSecurityMasterPackagePrefix}src/personal-security-master.test.ts` as const;
  const securityTestPath =
    `${personalSecurityMasterPackagePrefix}src/personal-security-master-security.test.ts` as const;
  const sourcePreparationPath =
    `${personalSecurityMasterPackagePrefix}src/sec-openfigi-v1-source-preparation.ts` as const;
  const sourcePreparationUnitTestPath =
    `${personalSecurityMasterPackagePrefix}src/sec-openfigi-v1-source-preparation.test.ts` as const;
  const sourcePreparationSecurityTestPath =
    `${personalSecurityMasterPackagePrefix}src/sec-openfigi-v1-source-preparation-security.test.ts` as const;
  const allowedTestModules = new Set([
    "node:crypto",
    "node:util/types",
    "vitest",
    "./index",
    "./personal-security-master",
    "./test-personal-security-master-builder",
  ]);
  const allowedSourcePreparationTestModules = new Set([
    "node:crypto",
    "node:util/types",
    "vitest",
    "./personal-security-master",
    "./sec-openfigi-v1-source-preparation",
  ]);
  for (const path of actualTree.filter((entry) => entry.endsWith(".ts"))) {
    const content = await cycle2kText(path, found);
    const modules = collectModuleSpecifiers(content);
    if (
      hasRuntimeDynamicImport(content) ||
      hasForbiddenDynamicCodeCapability(content) ||
      hasUnresolvedRuntimeModuleLoad(content) ||
      hasIndirectRuntimeModuleLoad(content)
    ) {
      found.push(
        `${path}: Cycle 3e-a runtime module loading and dynamic code are forbidden`,
      );
    }
    if (
      path === corePath &&
      JSON.stringify(modules) !==
        JSON.stringify(["node:crypto", "node:perf_hooks"])
    ) {
      found.push(
        `${path}: security-master core imports must remain exact and in-memory only`,
      );
    } else if (
      path === indexPath &&
      JSON.stringify(modules) !== JSON.stringify(["./personal-security-master"])
    ) {
      found.push(`${path}: public entry must remain one exact named re-export`);
    } else if (
      path === builderPath &&
      JSON.stringify(modules) !==
        JSON.stringify(["node:crypto", "./personal-security-master"])
    ) {
      found.push(`${path}: test builder imports must remain exact`);
    } else if (path === sourcePreparationPath) {
      const allowedProductionModules = new Set([
        "node:crypto",
        "./personal-security-master",
      ]);
      if (
        !modules.includes("./personal-security-master") ||
        new Set(modules).size !== modules.length ||
        modules.some((module) => !allowedProductionModules.has(module))
      ) {
        found.push(
          `${path}: Cycle 3e-a1 source preparation may import only node:crypto and the local security-master core`,
        );
      }
    } else if (
      path === sourcePreparationUnitTestPath ||
      path === sourcePreparationSecurityTestPath
    ) {
      if (
        !modules.includes("vitest") ||
        !modules.includes("./sec-openfigi-v1-source-preparation") ||
        modules.some(
          (module) => !allowedSourcePreparationTestModules.has(module),
        )
      ) {
        found.push(
          `${path}: Cycle 3e-a1 tests may use only the reviewed local, Vitest, crypto, and proxy-inspection imports`,
        );
      }
    } else if (
      (path === unitTestPath || path === securityTestPath) &&
      (!modules.includes("vitest") ||
        !modules.includes("./personal-security-master") ||
        modules.some((module) => !allowedTestModules.has(module)))
    ) {
      found.push(
        `${path}: security-master tests may use only the reviewed local, Vitest, crypto, and proxy-inspection imports`,
      );
    }
  }

  for (const path of [corePath, indexPath]) {
    const content = await cycle2kText(path, found);
    const productionViolation = personalSecurityMasterProductionViolation(
      path,
      content,
    );
    if (productionViolation !== null) {
      found.push(`${path}: ${productionViolation}`);
    }
  }
  const sourcePreparationContent = await cycle2kText(
    sourcePreparationPath,
    found,
  );
  const sourcePreparationViolation =
    personalSecurityMasterSourcePreparationProductionViolation(
      sourcePreparationContent,
    );
  if (sourcePreparationViolation !== null) {
    found.push(`${sourcePreparationPath}: ${sourcePreparationViolation}`);
  }

  const publicExports = [
    ["PERSONAL_SECURITY_MASTER_CHECKS", false],
    ["PERSONAL_SECURITY_MASTER_CLAIM", false],
    ["PERSONAL_SECURITY_MASTER_FAILURE_CODES", false],
    ["PERSONAL_SECURITY_MASTER_LIMITS", false],
    ["PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN", false],
    ["PERSONAL_SECURITY_MASTER_NOT_PROVEN", false],
    ["PERSONAL_SECURITY_MASTER_PROFILE", false],
    ["PERSONAL_SECURITY_MASTER_PROVIDER_MAPPING_TARGETS", false],
    ["PERSONAL_SECURITY_MASTER_SCHEMA_VERSION", false],
    ["PERSONAL_SECURITY_MASTER_SEARCH_NORMALIZATION", false],
    ["PERSONAL_SECURITY_MASTER_SEARCH_RANKING", false],
    ["PERSONAL_SECURITY_MASTER_SEARCH_TIE_BREAKS", false],
    ["PERSONAL_SECURITY_MASTER_SYMBOL_NORMALIZATION", false],
    ["PersonalSecurityMasterError", false],
    ["admitPersonalSecurityMasterSnapshot", false],
    ["measurePersonalSecurityMasterSearchP95", false],
    ["searchPersonalSecurityMaster", false],
    ["PersonalSecurityMasterAdmissionInput", true],
    ["PersonalSecurityMasterCatalog", true],
    ["PersonalSecurityMasterCatalogCoverage", true],
    ["PersonalSecurityMasterContentKind", true],
    ["PersonalSecurityMasterFailureCode", true],
    ["PersonalSecurityMasterInstrumentType", true],
    ["PersonalSecurityMasterMeasurement", true],
    ["PersonalSecurityMasterMeasurementInput", true],
    ["PersonalSecurityMasterProvenance", true],
    ["PersonalSecurityMasterProvenanceArtifact", true],
    ["PersonalSecurityMasterSearchInput", true],
    ["PersonalSecurityMasterSearchMatchKind", true],
    ["PersonalSecurityMasterSearchResponse", true],
    ["PersonalSecurityMasterSearchResult", true],
    ["PersonalSecurityMasterSourcePolicyCompatibility", true],
  ] as const;
  const indexSource = ts.createSourceFile(
    indexPath,
    await cycle2kText(indexPath, found),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (
    indexSource.statements.length !== 1 ||
    !isExactNamedReExportDeclaration(
      indexSource.statements[0],
      "./personal-security-master",
      publicExports,
    )
  ) {
    found.push(
      `${indexPath}: Cycle 3e-a public named export surface must remain exact`,
    );
  }

  const allowedApiImporters = new Map<string, readonly string[]>([
    [
      "apps/api/src/personal-security-master-routes.test.ts",
      ["admitPersonalSecurityMasterSnapshot"],
    ],
    [
      "apps/api/src/personal-security-master-routes.ts",
      [
        "PERSONAL_SECURITY_MASTER_LIMITS",
        "searchPersonalSecurityMaster",
        "type PersonalSecurityMasterCatalog",
      ],
    ],
    [
      "apps/api/src/security-master-app.ts",
      [
        "PERSONAL_SECURITY_MASTER_PROFILE",
        "searchPersonalSecurityMaster",
        "type PersonalSecurityMasterCatalog",
      ],
    ],
    [
      "apps/api/src/security-master-composition-root.ts",
      [
        "admitPersonalSecurityMasterSnapshot",
        "PERSONAL_SECURITY_MASTER_LIMITS",
      ],
    ],
  ]);
  for (const file of externalCompositionFilesToInspect) {
    const path = relative(root, file).replaceAll("\\", "/");
    const content = await readFile(file, "utf8");
    if (
      !path.startsWith(personalSecurityMasterPackagePrefix) &&
      personalSecurityMasterSourcePreparationExternalReference(path, content)
    ) {
      found.push(
        `${path}: Cycle 3e-a1 source preparation must remain outside API, web, vault, connected-source-policy, and all other runtime graphs`,
      );
    }
    if (
      !collectModuleSpecifiers(content).includes(personalSecurityMasterModule)
    ) {
      continue;
    }
    const expectedBindings = allowedApiImporters.get(path);
    if (expectedBindings === undefined) {
      found.push(
        `${path}: only the exact reviewed security-master API production files and route test may import ${personalSecurityMasterModule}`,
      );
    } else if (
      JSON.stringify(personalSecurityMasterImportBindings(content).sort()) !==
      JSON.stringify([...expectedBindings].sort())
    ) {
      found.push(
        `${path}: security-master imports must remain the exact reviewed bindings`,
      );
    }
  }
  for (const [path] of allowedApiImporters) {
    const content = await cycle2kText(path, found);
    if (
      !collectModuleSpecifiers(content).includes(personalSecurityMasterModule)
    ) {
      found.push(`${path}: required Cycle 3e-a package binding is missing`);
    }
  }
  for (const file of filesToInspect) {
    const path = relative(root, file).replaceAll("\\", "/");
    if (basename(path) !== "package.json") continue;
    const content = await readFile(file, "utf8");
    if (
      content.includes(personalSecurityMasterModule) &&
      path !== manifestPath &&
      path !== "apps/api/package.json"
    ) {
      found.push(
        `${path}: only apps/api may declare the security-master workspace package`,
      );
    }
  }
  const apiManifest = await cycle2kJson("apps/api/package.json", found);
  if (
    !isRecord(apiManifest?.dependencies) ||
    apiManifest.dependencies[personalSecurityMasterModule] !== "workspace:*"
  ) {
    found.push(
      "apps/api/package.json: exact Cycle 3e-a security-master workspace dependency is required",
    );
  }
  if (
    !isRecord(apiManifest?.scripts) ||
    apiManifest.scripts["dev:security-master"] !==
      "tsx watch src/security-master-server.ts" ||
    apiManifest.scripts["start:security-master"] !==
      "node dist/src/security-master-server.js"
  ) {
    found.push(
      "apps/api/package.json: distinct Cycle 3e-a security-master development and start entries are required",
    );
  }

  const securityMasterApiModulesByPath = new Map<string, readonly string[]>([
    [
      "apps/api/src/personal-security-master-routes.ts",
      [
        "@research-cockpit/contracts",
        personalSecurityMasterModule,
        "fastify",
        "./listen-options",
        "./personal-owner-session",
        "./personal-owner-session-routes",
      ],
    ],
    [
      "apps/api/src/security-master-app.ts",
      [
        "node:crypto",
        "@fastify/cors",
        "@fastify/helmet",
        "@research-cockpit/contracts",
        personalSecurityMasterModule,
        "fastify",
        "./listen-options",
        "./personal-owner-session",
        "./personal-owner-session-routes",
        "./personal-security-master-routes",
      ],
    ],
    [
      "apps/api/src/security-master-composition-root.ts",
      [
        "fastify",
        "node:fs",
        "node:fs/promises",
        "node:path",
        personalSecurityMasterModule,
        "./listen-options",
        "./personal-owner-session",
        "./security-master-app",
      ],
    ],
    [
      "apps/api/src/security-master-server.ts",
      ["./security-master-composition-root", "./listen-options"],
    ],
  ]);
  const securityMasterApiSources = new Map<string, string>();
  for (const [path, expectedModules] of securityMasterApiModulesByPath) {
    const content = await cycle2kText(path, found);
    securityMasterApiSources.set(path, content);
    if (
      JSON.stringify(collectModuleSpecifiers(content)) !==
      JSON.stringify(expectedModules)
    ) {
      found.push(
        `${path}: Cycle 3e-a runtime imports must remain the exact reviewed loopback, owner-session, file-admission, and search allowlist`,
      );
    }
  }
  const apiBoundaryViolation = personalSecurityMasterApiBoundaryViolation(
    securityMasterApiSources,
  );
  if (apiBoundaryViolation !== null) found.push(apiBoundaryViolation);

  const ordinaryComposition = await cycle2kText(
    "apps/api/src/composition-root.ts",
    found,
  );
  const connectedComposition = await cycle2kText(
    "apps/api/src/connected-composition-root.ts",
    found,
  );
  const vaultComposition = await cycle2kText(
    "apps/api/src/vault-composition-root.ts",
    found,
  );
  const apiMode = await cycle2kText("apps/api/src/api-mode.ts", found);
  if (
    !apiMode.includes('"personal_single_user_local_security_master"') ||
    !ordinaryComposition.includes(
      "SECURITY_MASTER_MODE_REQUIRES_SECURITY_MASTER_ENTRYPOINT",
    ) ||
    !ordinaryComposition.includes(
      "SECURITY_MASTER_CONFIGURATION_REQUIRES_SECURITY_MASTER_ENTRYPOINT",
    ) ||
    !connectedComposition.includes(
      '"PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH"',
    ) ||
    !connectedComposition.includes(
      '"PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256"',
    ) ||
    !vaultComposition.includes('"PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH"') ||
    !vaultComposition.includes('"PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256"')
  ) {
    found.push(
      "apps/api/: prior modes must reject the exact Cycle 3e-a mode and private snapshot configuration",
    );
  }

  const exactSourcePreparationProbeImports = `import { createHash } from "node:crypto";
import {
  PERSONAL_SECURITY_MASTER_PROFILE,
  PERSONAL_SECURITY_MASTER_SCHEMA_VERSION,
  admitPersonalSecurityMasterSnapshot,
  type PersonalSecurityMasterCatalog,
  type PersonalSecurityMasterContentKind,
  type PersonalSecurityMasterSourcePolicyCompatibility,
} from "./personal-security-master";`;
  const extraSourcePreparationCoreValueProbe =
    exactSourcePreparationProbeImports.replace(
      "  admitPersonalSecurityMasterSnapshot,",
      "  admitPersonalSecurityMasterSnapshot,\n  searchPersonalSecurityMaster,",
    );
  const widenedSourcePreparationCoreTypeProbe =
    exactSourcePreparationProbeImports.replace(
      "  type PersonalSecurityMasterCatalog,",
      "  PersonalSecurityMasterCatalog,",
    );
  const regressions = [
    JSON.stringify(personalSecurityMasterPackagePaths) !==
      JSON.stringify([...personalSecurityMasterPackagePaths].sort()),
    personalSecurityMasterProductionViolation(
      corePath,
      'import { createHash } from "node:crypto";\nimport { performance } from "node:perf_hooks";',
    ) !== null,
    personalSecurityMasterProductionViolation(
      corePath,
      'import { createHash } from "node:crypto";\nimport { performance } from "node:perf_hooks";\nvoid fetch("https://provider.example");',
    ) === null,
    personalSecurityMasterProductionViolation(
      corePath,
      'import { createHash } from "node:crypto";\nimport { performance } from "node:perf_hooks";\nconsole.log("private");',
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      `${exactSourcePreparationProbeImports}\nvoid createHash; const retainedSnapshot = new Uint8Array(3); const snapshotSha256 = "sha256:fixture"; void admitPersonalSecurityMasterSnapshot({ expectedSha256: snapshotSha256, snapshot: retainedSnapshot });`,
    ) !== null,
    personalSecurityMasterSourcePreparationProductionViolation(
      `${extraSourcePreparationCoreValueProbe}\nvoid createHash; const retainedSnapshot = new Uint8Array(3); const snapshotSha256 = "sha256:fixture"; void admitPersonalSecurityMasterSnapshot({ expectedSha256: snapshotSha256, snapshot: retainedSnapshot });`,
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      `${widenedSourcePreparationCoreTypeProbe}\nvoid createHash; const retainedSnapshot = new Uint8Array(3); const snapshotSha256 = "sha256:fixture"; void admitPersonalSecurityMasterSnapshot({ expectedSha256: snapshotSha256, snapshot: retainedSnapshot });`,
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      'import { readFile } from "node:fs/promises";\nimport { admitPersonalSecurityMasterSnapshot } from "./personal-security-master";\nvoid readFile; void admitPersonalSecurityMasterSnapshot;',
    ) === null,
    [
      "node:child_process",
      "node:dns",
      "node:fs",
      "node:http",
      "node:https",
      "node:net",
      "node:tls",
      "node:worker_threads",
      "@research-cockpit/connected-source-policy",
      "@research-cockpit/local-research-vault",
      "../../../apps/api/src/security-master-app",
      "../../../apps/web/app/layout",
      "./credentials",
    ].some(
      (forbiddenModule) =>
        personalSecurityMasterSourcePreparationProductionViolation(
          `import "${forbiddenModule}";\nimport { admitPersonalSecurityMasterSnapshot } from "./personal-security-master"; void admitPersonalSecurityMasterSnapshot;`,
        ) === null,
    ),
    personalSecurityMasterSourcePreparationProductionViolation(
      'import { admitPersonalSecurityMasterSnapshot } from "./personal-security-master";\nvoid fetch("https://provider.example"); void admitPersonalSecurityMasterSnapshot;',
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      'import { admitPersonalSecurityMasterSnapshot } from "./personal-security-master";\nvoid process.env.SECRET; void admitPersonalSecurityMasterSnapshot;',
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      'import { admitPersonalSecurityMasterSnapshot } from "./personal-security-master";\nconst credentials = { apiKey: "private" }; void credentials; void admitPersonalSecurityMasterSnapshot;',
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      'import { admitPersonalSecurityMasterSnapshot } from "./personal-security-master";\nvoid import("./personal-security-master"); void admitPersonalSecurityMasterSnapshot;',
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      'import { createHash, randomBytes } from "node:crypto";\nimport { admitPersonalSecurityMasterSnapshot } from "./personal-security-master";\nvoid createHash; void randomBytes(32); void admitPersonalSecurityMasterSnapshot;',
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      'import { createHash } from "node:crypto";\nimport { admitPersonalSecurityMasterSnapshot } from "./personal-security-master";\nvoid createHash; void Date.now(); void admitPersonalSecurityMasterSnapshot;',
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      'import { createHash } from "node:crypto";\nimport { admitPersonalSecurityMasterSnapshot } from "./personal-security-master";\nvoid createHash; void Math.random(); void admitPersonalSecurityMasterSnapshot;',
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      'import { createHash } from "node:crypto";\nimport { admitPersonalSecurityMasterSnapshot } from "./personal-security-master";\nvoid createHash; void performance.now(); void admitPersonalSecurityMasterSnapshot;',
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      `${exactSourcePreparationProbeImports}\nvoid createHash; const retainedSnapshot = new Uint8Array(3); const snapshotSha256 = "sha256:fixture"; void admitPersonalSecurityMasterSnapshot({ expectedSha256: snapshotSha256, snapshot: copyBytes(retainedSnapshot) });`,
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      `${exactSourcePreparationProbeImports}\nvoid createHash; const retainedSnapshot = new Uint8Array(3); const admissionSnapshot = retainedSnapshot; const snapshotSha256 = "sha256:fixture"; void admitPersonalSecurityMasterSnapshot({ expectedSha256: snapshotSha256, snapshot: admissionSnapshot });`,
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      `${exactSourcePreparationProbeImports}\nvoid createHash; const retainedSnapshot = new Uint8Array(3); const snapshotSha256 = "sha256:fixture"; void admitPersonalSecurityMasterSnapshot({ expectedSha256: snapshotSha256, snapshot: retainedSnapshot }); void admitPersonalSecurityMasterSnapshot({ expectedSha256: snapshotSha256, snapshot: retainedSnapshot });`,
    ) === null,
    personalSecurityMasterSourcePreparationProductionViolation(
      `import { prepare } from "${personalSecurityMasterSourcePreparationModule}"; void prepare;`,
    ) === null,
    !personalSecurityMasterSourcePreparationExternalReference(
      "apps/api/src/source-preparation-probe.ts",
      `import { prepare } from "${personalSecurityMasterSourcePreparationModule}"; void prepare;`,
    ),
    personalSecurityMasterSourcePreparationExternalReference(
      sourcePreparationUnitTestPath,
      'import { prepare } from "./sec-openfigi-v1-source-preparation"; void prepare;',
    ),
    personalSecurityMasterApiBoundaryViolation(
      new Map(
        [...securityMasterApiSources].map(([path, content]) => [
          path,
          path === "apps/api/src/security-master-app.ts"
            ? `${content}\nvoid fetch("https://provider.example");`
            : content,
        ]),
      ),
    ) === null,
  ];
  const regression = regressions.indexOf(true);
  if (regression !== -1) {
    throw new Error(
      `Cycle 3e-a security-master boundary classifier ${String(regression + 1)} regressed`,
    );
  }
  return found;
}

function personalSecurityMasterProductionViolation(
  path: string,
  content: string,
): string | null {
  const expectedModules =
    path === `${personalSecurityMasterPackagePrefix}src/index.ts`
      ? ["./personal-security-master"]
      : ["node:crypto", "node:perf_hooks"];
  if (
    JSON.stringify(collectModuleSpecifiers(content)) !==
    JSON.stringify(expectedModules)
  ) {
    return "production imports must remain the exact reviewed in-memory allowlist";
  }
  if (
    hasRuntimeDynamicImport(content) ||
    hasForbiddenDynamicCodeCapability(content) ||
    hasUnresolvedRuntimeModuleLoad(content) ||
    hasIndirectRuntimeModuleLoad(content)
  ) {
    return "runtime module loading and dynamic code are forbidden";
  }
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (
    findIdentifiers(
      source,
      new Set([
        "EventSource",
        "WebSocket",
        "XMLHttpRequest",
        "console",
        "fetch",
        "global",
        "globalThis",
        "process",
        "queueMicrotask",
        "self",
        "setImmediate",
        "setInterval",
        "setTimeout",
        "window",
      ]),
    ).length > 0
  ) {
    return "production source must not use network, process, logging, environment, or background globals";
  }
  let concreteEndpoint = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteralLike(node) &&
      /(?:https?|wss?):\/\//iu.test(node.text)
    ) {
      concreteEndpoint = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return concreteEndpoint
    ? "production source must remain source-neutral and embed no provider endpoint"
    : null;
}

function personalSecurityMasterSourcePreparationProductionViolation(
  content: string,
): string | null {
  const modules = collectModuleSpecifiers(content);
  const allowedModules = new Set(["node:crypto", "./personal-security-master"]);
  if (
    !modules.includes("./personal-security-master") ||
    new Set(modules).size !== modules.length ||
    modules.some((module) => !allowedModules.has(module))
  ) {
    return "Cycle 3e-a1 production imports may contain only node:crypto and the local security-master core";
  }
  if (
    hasRuntimeDynamicImport(content) ||
    hasForbiddenDynamicCodeCapability(content) ||
    hasUnresolvedRuntimeModuleLoad(content) ||
    hasIndirectRuntimeModuleLoad(content)
  ) {
    return "Cycle 3e-a1 runtime module loading and dynamic code are forbidden";
  }
  const source = ts.createSourceFile(
    "sec-openfigi-v1-source-preparation.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const cryptoImports = source.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "node:crypto",
  );
  if (
    cryptoImports.length !== 1 ||
    !isExactFilingPayloadCustodyImport(cryptoImports[0], "node:crypto", [
      ["createHash", "createHash"],
    ])
  ) {
    return "Cycle 3e-a1 production source must retain the exact named node:crypto createHash binding";
  }
  const coreImports = source.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "./personal-security-master",
  );
  if (
    coreImports.length !== 1 ||
    !isExactPersonalSecurityMasterSourcePreparationCoreImport(coreImports[0])
  ) {
    return "Cycle 3e-a1 production source must retain only the exact reviewed security-master value and type bindings";
  }
  const admissionLifecycleViolation =
    personalSecurityMasterSourcePreparationAdmissionLifecycleViolation(source);
  if (admissionLifecycleViolation !== null) return admissionLifecycleViolation;
  if (
    findIdentifiers(
      source,
      new Set([
        "Bun",
        "BroadcastChannel",
        "Deno",
        "EventSource",
        "MessageChannel",
        "SharedWorker",
        "WebTransport",
        "WebSocket",
        "Worker",
        "XMLHttpRequest",
        "caches",
        "console",
        "crypto",
        "document",
        "fetch",
        "getRandomValues",
        "global",
        "globalThis",
        "hrtime",
        "indexedDB",
        "localStorage",
        "location",
        "navigator",
        "performance",
        "process",
        "pseudoRandomBytes",
        "queueMicrotask",
        "random",
        "randomBytes",
        "randomFill",
        "randomFillSync",
        "randomInt",
        "randomUUID",
        "self",
        "sessionStorage",
        "setImmediate",
        "setInterval",
        "setTimeout",
        "Temporal",
        "timeOrigin",
        "uptime",
        "window",
      ]),
    ).length > 0
  ) {
    return "Cycle 3e-a1 production source must not use network, process/environment, logging, worker, clock, randomness, or background globals";
  }
  const credentialNames = new Set([
    "accessToken",
    "apiKey",
    "authorization",
    "credential",
    "credentials",
    "refreshToken",
    "secret",
    "secrets",
  ]);
  if (findIdentifiers(source, credentialNames).length > 0) {
    return "Cycle 3e-a1 production source must not accept, resolve, or retain credential material";
  }
  let environmentAccess = false;
  let credentialAccess = false;
  let ambientClockAccess = false;
  const clockPropertyNames = new Set(["now"]);
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    ) {
      const access = namedBoundaryPropertyAccess(node, clockPropertyNames);
      const owner =
        access === null ? null : unwrapBoundaryExpression(access.expression);
      if (owner !== null && ts.isIdentifier(owner) && owner.text === "Date") {
        ambientClockAccess = true;
        return;
      }
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const callee = unwrapBoundaryExpression(node.expression);
      if (
        ts.isIdentifier(callee) &&
        callee.text === "Date" &&
        (node.arguments?.length ?? 0) === 0
      ) {
        ambientClockAccess = true;
        return;
      }
    }
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      namedBoundaryPropertyAccess(node, new Set(["env"])) !== null
    ) {
      environmentAccess = true;
      return;
    }
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      namedBoundaryPropertyAccess(node, credentialNames) !== null
    ) {
      credentialAccess = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (ambientClockAccess) {
    return "Cycle 3e-a1 production source must not read an ambient clock";
  }
  if (environmentAccess) {
    return "Cycle 3e-a1 production source must not read an environment surface";
  }
  return credentialAccess
    ? "Cycle 3e-a1 production source must not access credential material"
    : null;
}

function isExactPersonalSecurityMasterSourcePreparationCoreImport(
  declaration: ts.ImportDeclaration | undefined,
): boolean {
  if (
    declaration === undefined ||
    declaration.attributes !== undefined ||
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== "./personal-security-master"
  ) {
    return false;
  }
  const clause = declaration.importClause;
  if (
    clause === undefined ||
    clause.isTypeOnly ||
    clause.name !== undefined ||
    clause.namedBindings === undefined ||
    !ts.isNamedImports(clause.namedBindings)
  ) {
    return false;
  }
  const actual = clause.namedBindings.elements.map((specifier) => ({
    imported: specifier.propertyName?.text ?? specifier.name.text,
    local: specifier.name.text,
    typeOnly: specifier.isTypeOnly,
  }));
  return (
    JSON.stringify(actual) ===
    JSON.stringify([
      {
        imported: "PERSONAL_SECURITY_MASTER_PROFILE",
        local: "PERSONAL_SECURITY_MASTER_PROFILE",
        typeOnly: false,
      },
      {
        imported: "PERSONAL_SECURITY_MASTER_SCHEMA_VERSION",
        local: "PERSONAL_SECURITY_MASTER_SCHEMA_VERSION",
        typeOnly: false,
      },
      {
        imported: "admitPersonalSecurityMasterSnapshot",
        local: "admitPersonalSecurityMasterSnapshot",
        typeOnly: false,
      },
      {
        imported: "PersonalSecurityMasterCatalog",
        local: "PersonalSecurityMasterCatalog",
        typeOnly: true,
      },
      {
        imported: "PersonalSecurityMasterContentKind",
        local: "PersonalSecurityMasterContentKind",
        typeOnly: true,
      },
      {
        imported: "PersonalSecurityMasterSourcePolicyCompatibility",
        local: "PersonalSecurityMasterSourcePolicyCompatibility",
        typeOnly: true,
      },
    ])
  );
}

function personalSecurityMasterSourcePreparationAdmissionLifecycleViolation(
  source: ts.SourceFile,
): string | null {
  const admissionName = "admitPersonalSecurityMasterSnapshot" as const;
  const coreImports = source.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "./personal-security-master",
  );
  const coreImport = coreImports[0];
  const clause = coreImport?.importClause;
  const namedBindings = clause?.namedBindings;
  const admissionImports =
    namedBindings !== undefined && ts.isNamedImports(namedBindings)
      ? namedBindings.elements.filter(
          (element) =>
            (element.propertyName ?? element.name).text === admissionName,
        )
      : [];
  if (
    coreImports.length !== 1 ||
    clause === undefined ||
    clause.isTypeOnly ||
    admissionImports.length !== 1 ||
    admissionImports[0]?.isTypeOnly === true ||
    admissionImports[0]?.propertyName !== undefined ||
    admissionImports[0]?.name.text !== admissionName
  ) {
    return "Cycle 3e-a1 admission must retain one exact unaliased runtime core binding";
  }

  const admissionCalls: ts.CallExpression[] = [];
  let shadowedAdmissionBinding = false;
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === admissionName) {
      const parent = node.parent;
      const binding =
        ((ts.isVariableDeclaration(parent) ||
          ts.isParameter(parent) ||
          ts.isBindingElement(parent) ||
          ts.isFunctionDeclaration(parent) ||
          ts.isFunctionExpression(parent) ||
          ts.isClassDeclaration(parent) ||
          ts.isClassExpression(parent) ||
          ts.isTypeAliasDeclaration(parent) ||
          ts.isInterfaceDeclaration(parent) ||
          ts.isEnumDeclaration(parent)) &&
          parent.name === node) ||
        (ts.isImportSpecifier(parent) && parent.name === node) ||
        (ts.isNamespaceImport(parent) && parent.name === node) ||
        (ts.isImportClause(parent) && parent.name === node);
      if (
        binding &&
        !(
          ts.isImportSpecifier(parent) &&
          parent === admissionImports[0] &&
          parent.name === node
        )
      ) {
        shadowedAdmissionBinding = true;
      }
    }
    if (
      ts.isCallExpression(node) &&
      node.questionDotToken === undefined &&
      ts.isIdentifier(unwrapBoundaryExpression(node.expression)) &&
      (unwrapBoundaryExpression(node.expression) as ts.Identifier).text ===
        admissionName
    ) {
      admissionCalls.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (shadowedAdmissionBinding || admissionCalls.length !== 1) {
    return "Cycle 3e-a1 must call the unshadowed admission boundary exactly once";
  }

  const call = admissionCalls[0];
  const input = call?.arguments[0];
  if (
    call?.arguments.length !== 1 ||
    input === undefined ||
    !ts.isObjectLiteralExpression(unwrapBoundaryExpression(input))
  ) {
    return "Cycle 3e-a1 admission must receive one exact object literal";
  }
  const objectLiteral = unwrapBoundaryExpression(
    input,
  ) as ts.ObjectLiteralExpression;
  if (
    objectLiteral.properties.length !== 2 ||
    objectLiteral.properties.some(
      (property) => !ts.isPropertyAssignment(property),
    )
  ) {
    return "Cycle 3e-a1 admission object must contain only exact digest and retained-snapshot assignments";
  }
  const properties =
    objectLiteral.properties as ts.NodeArray<ts.PropertyAssignment>;
  const expectedSha256Properties = properties.filter(
    (property) =>
      ts.isIdentifier(property.name) && property.name.text === "expectedSha256",
  );
  const snapshotProperties = properties.filter(
    (property) =>
      ts.isIdentifier(property.name) && property.name.text === "snapshot",
  );
  const snapshotInitializer = snapshotProperties[0]?.initializer;
  if (
    expectedSha256Properties.length !== 1 ||
    snapshotProperties.length !== 1 ||
    snapshotInitializer === undefined ||
    !ts.isIdentifier(unwrapBoundaryExpression(snapshotInitializer)) ||
    (unwrapBoundaryExpression(snapshotInitializer) as ts.Identifier).text !==
      "retainedSnapshot"
  ) {
    return "Cycle 3e-a1 admission snapshot must be the direct retainedSnapshot identifier";
  }
  return null;
}

function personalSecurityMasterSourcePreparationExternalReference(
  importerPath: string,
  content: string,
): boolean {
  if (importerPath.startsWith(personalSecurityMasterPackagePrefix)) {
    return false;
  }
  const sourcePreparationPath = `${personalSecurityMasterPackagePrefix}src/sec-openfigi-v1-source-preparation`;
  for (const rawSpecifier of collectModuleSpecifiers(content)) {
    const specifier = rawSpecifier.replaceAll("\\", "/");
    if (
      specifier === personalSecurityMasterSourcePreparationModule ||
      specifier.startsWith(
        `${personalSecurityMasterSourcePreparationModule}/`,
      ) ||
      specifier.includes(sourcePreparationPath)
    ) {
      return true;
    }
    if (!specifier.startsWith(".")) continue;
    const resolved = posixNormalize(
      `${posixDirname(importerPath)}/${specifier}`,
    ).replace(/\.(?:c|m)?[jt]sx?$/u, "");
    if (resolved === sourcePreparationPath) return true;
  }
  return false;
}

function personalSecurityMasterImportBindings(content: string): string[] {
  const source = ts.createSourceFile(
    "personal-security-master-import.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const bindings: string[] = [];
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== personalSecurityMasterModule
    ) {
      continue;
    }
    const clause = statement.importClause;
    if (clause === undefined) {
      bindings.push("<side-effect>");
      continue;
    }
    if (clause.name !== undefined) {
      bindings.push(`<default:${clause.name.text}>`);
    }
    const named = clause.namedBindings;
    if (named === undefined) continue;
    if (ts.isNamespaceImport(named)) {
      bindings.push(`<namespace:${named.name.text}>`);
      continue;
    }
    for (const element of named.elements) {
      const imported = (element.propertyName ?? element.name).text;
      const local = element.name.text;
      const binding = imported === local ? imported : `${imported} as ${local}`;
      bindings.push(
        clause.isTypeOnly || element.isTypeOnly ? `type ${binding}` : binding,
      );
    }
  }
  return bindings;
}

function personalSecurityMasterApiBoundaryViolation(
  sources: ReadonlyMap<string, string>,
): string | null {
  const requiredAnchors = new Map<string, readonly string[]>([
    [
      "apps/api/src/personal-security-master-routes.ts",
      [
        '"/v1/personal-filing/security-master/status"',
        '"/v1/personal-filing/security-master/search"',
        "exposeHeadRoute: false",
        "authorizePersonalRouteRequest(",
        "parseCanonicalSearchUrl(request.url)",
        "CONTROL_FORMAT_OR_SURROGATE_CHARACTER",
        "decodeURIComponent(",
        "encodeURIComponent(",
        "searchPersonalSecurityMaster(catalog,",
        "snapshotReceipt(catalog)",
      ],
    ],
    [
      "apps/api/src/security-master-app.ts",
      [
        "buildPersonalSecurityMasterApp(",
        "registerPersonalOwnerSessionRoutes(",
        "registerPersonalSecurityMasterRoutes(",
        'header("Cache-Control", "private, no-store")',
        'header("Pragma", "no-cache")',
        'header("Vary", "Origin")',
        "ownerSession.close()",
      ],
    ],
    [
      "apps/api/src/security-master-composition-root.ts",
      [
        '"personal_single_user_local_security_master"',
        '"PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH"',
        '"PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256"',
        '"personal-security-master.snapshot.json"',
        "capturedSecurityMasterApiEnvironments.add(captured)",
        "delete environment[key]",
        "SECURITY_MASTER_MODE_REJECTS_OTHER_PRIVATE_CONFIGURATION",
        "readStableSnapshot(snapshotPath)",
        "admitPersonalSecurityMasterSnapshot({",
        "snapshot.fill(0)",
        "buildPersonalSecurityMasterApp(",
        "constants.O_RDONLY | noFollow",
        "constants.O_NOFOLLOW",
        "sameFileState(",
      ],
    ],
    [
      "apps/api/src/security-master-server.ts",
      [
        "captureSecurityMasterApiEnvironment(process.env)",
        "resolveDemoApiListenOptions(environment)",
        "createSecurityMasterConfiguredApp(environment)",
        "app.listen({ host, port })",
        "process.stdout.write(",
        '"Research Cockpit personal security-master API is listening.\\n"',
        "process.stderr.write(",
        '"Research Cockpit personal security-master API failed to start.\\n"',
        "process.exitCode = 1",
      ],
    ],
  ]);
  for (const [path, anchors] of requiredAnchors) {
    const content = sources.get(path);
    if (
      content === undefined ||
      anchors.some((anchor) => !content.includes(anchor))
    ) {
      return `${path}: exact Cycle 3e-a mode, startup, stable-file, owner-auth, search, or private-response anchors regressed`;
    }
  }

  for (const [path, content] of sources) {
    if (
      hasRuntimeDynamicImport(content) ||
      hasForbiddenDynamicCodeCapability(content) ||
      hasUnresolvedRuntimeModuleLoad(content) ||
      hasIndirectRuntimeModuleLoad(content)
    ) {
      return `${path}: Cycle 3e-a API must not dynamically load modules or code`;
    }
    const source = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const forbiddenGlobals = new Set([
      "EventSource",
      "WebSocket",
      "XMLHttpRequest",
      "console",
      "fetch",
      "global",
      "globalThis",
      "queueMicrotask",
      "self",
      "setImmediate",
      "setInterval",
      "setTimeout",
      "window",
    ]);
    if (path !== "apps/api/src/security-master-server.ts") {
      forbiddenGlobals.add("process");
    }
    if (findIdentifiers(source, forbiddenGlobals).length > 0) {
      return `${path}: Cycle 3e-a API must not use provider-network, process, logging, or background globals outside exact startup`;
    }
    if (
      path === "apps/api/src/security-master-server.ts" &&
      findIdentifiers(source, new Set(["process"])).length !== 4
    ) {
      return `${path}: process access must remain exact environment capture, fixed stdout/stderr, and exitCode only`;
    }
    let concreteEndpoint = false;
    const visit = (node: ts.Node): void => {
      if (
        ts.isStringLiteralLike(node) &&
        /(?:https?|wss?):\/\//iu.test(node.text) &&
        !node.text.startsWith("https://research-cockpit.local/") &&
        !/^http:\/\/(?:\[::1\]|localhost|127\.0\.0\.1)(?::[0-9]+)?(?:\/|$)/u.test(
          node.text,
        )
      ) {
        concreteEndpoint = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (concreteEndpoint) {
      return `${path}: Cycle 3e-a API must embed no provider or real-network endpoint`;
    }
  }

  const routes =
    sources.get("apps/api/src/personal-security-master-routes.ts") ?? "";
  if (routes.includes("sourceLocator")) {
    return "apps/api/src/personal-security-master-routes.ts: owner-local composite-manifest locator must remain outside responses";
  }
  const composition =
    sources.get("apps/api/src/security-master-composition-root.ts") ?? "";
  const readPosition = composition.indexOf("readStableSnapshot(snapshotPath)");
  const admitPosition = composition.indexOf(
    "admitPersonalSecurityMasterSnapshot({",
  );
  const wipePosition = composition.indexOf("snapshot.fill(0)", admitPosition);
  const buildPosition = composition.indexOf(
    "buildPersonalSecurityMasterApp(",
    admitPosition,
  );
  if (
    readPosition < 0 ||
    admitPosition <= readPosition ||
    wipePosition <= admitPosition ||
    buildPosition <= wipePosition
  ) {
    return "apps/api/src/security-master-composition-root.ts: stable read, complete admission, byte wipe, and app construction order regressed";
  }
  return null;
}

async function personalFilingCorpusBoundaryViolations(): Promise<string[]> {
  const found: string[] = [];
  const actualTree = [...filesToInspect]
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .filter((path) => path.startsWith(personalFilingCorpusPackagePrefix))
    .sort();
  if (
    JSON.stringify(actualTree) !==
    JSON.stringify(personalFilingCorpusPackagePaths)
  )
    found.push(
      `${personalFilingCorpusPackagePrefix}: Cycle 3b package tree must remain the exact thirty-six-file manifest, payload-identity, payload-custody, fact-normalization, fact-comparison, raw-fact-extraction, quality-measurement, selected-fact-release, personal-dossier, two Python validators, tsconfig, index, five-builder, and seventeen-test surface`,
    );

  const manifest = await cycle2kJson(
    `${personalFilingCorpusPackagePrefix}package.json`,
    found,
  );
  if (
    JSON.stringify(manifest) !==
    JSON.stringify({
      name: personalFilingCorpusModule,
      version: "0.1.0",
      private: true,
      type: "module",
      exports: { ".": "./src/index.ts" },
      scripts: {
        build: "tsc --noEmit",
        typecheck: "tsc --noEmit",
        test: "vitest run",
      },
    })
  )
    found.push(
      `${personalFilingCorpusPackagePrefix}package.json: exact zero-production-dependency personal-use manifest is required`,
    );

  const tsconfig = await cycle2kJson(
    `${personalFilingCorpusPackagePrefix}tsconfig.json`,
    found,
  );
  if (
    JSON.stringify(tsconfig) !==
    JSON.stringify({
      extends: "../../tsconfig.base.json",
      compilerOptions: { noEmit: true, types: ["node"] },
      include: ["src/**/*.ts"],
    })
  )
    found.push(
      `${personalFilingCorpusPackagePrefix}tsconfig.json: exact bounded TypeScript configuration is required`,
    );

  const implementationPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-corpus.ts`;
  const indexPath = `${personalFilingCorpusPackagePrefix}src/index.ts`;
  const unitTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-corpus.test.ts`;
  const securityTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-corpus-security.test.ts`;
  const payloadIdentityPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity.ts`;
  const payloadIdentityUnitTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity.test.ts`;
  const payloadIdentitySecurityTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-identity-security.test.ts`;
  const payloadCustodyPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-custody.ts`;
  const payloadCustodyUnitTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-custody.test.ts`;
  const payloadCustodySecurityTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-payload-custody-security.test.ts`;
  const factNormalizationPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-normalization.ts`;
  const factNormalizationUnitTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-normalization.test.ts`;
  const factNormalizationSecurityTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-normalization-security.test.ts`;
  const factNormalizationBuilderPath = `${personalFilingCorpusPackagePrefix}src/test-personal-filing-fact-builder.ts`;
  const factComparisonPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-comparison.ts`;
  const factComparisonUnitTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-comparison.test.ts`;
  const factComparisonSecurityTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-fact-comparison-security.test.ts`;
  const factComparisonBuilderPath = `${personalFilingCorpusPackagePrefix}src/test-personal-filing-fact-comparison-builder.ts`;
  const factComparisonPythonValidatorPath = `${personalFilingCorpusPackagePrefix}validator/personal_filing_fact_validator.py`;
  const rawFactExtractionPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-raw-fact-extraction.ts`;
  const rawFactExtractionUnitTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-raw-fact-extraction.test.ts`;
  const rawFactExtractionSecurityTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-raw-fact-extraction-security.test.ts`;
  const rawFactExtractionBuilderPath = `${personalFilingCorpusPackagePrefix}src/test-personal-filing-raw-fact-extraction-builder.ts`;
  const rawFactExtractionPythonPath = `${personalFilingCorpusPackagePrefix}validator/personal_filing_raw_fact_extractor.py`;
  const qualityMeasurementPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-quality-measurement.ts`;
  const qualityMeasurementUnitTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-quality-measurement.test.ts`;
  const qualityMeasurementSecurityTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-quality-measurement-security.test.ts`;
  const qualityMeasurementBuilderPath = `${personalFilingCorpusPackagePrefix}src/test-personal-filing-quality-measurement-builder.ts`;
  const selectedFactReleasePath = `${personalFilingCorpusPackagePrefix}src/personal-filing-selected-fact-release.ts`;
  const selectedFactReleaseTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-selected-fact-release.test.ts`;
  const dossierPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-dossier.ts`;
  const dossierUnitTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-dossier.test.ts`;
  const dossierSecurityTestPath = `${personalFilingCorpusPackagePrefix}src/personal-filing-dossier-security.test.ts`;
  const dossierBuilderPath = `${personalFilingCorpusPackagePrefix}src/test-personal-filing-dossier-builder.ts`;
  const implementation = await cycle2kText(implementationPath, found);
  const index = await cycle2kText(indexPath, found);
  const unitTest = await cycle2kText(unitTestPath, found);
  const securityTest = await cycle2kText(securityTestPath, found);
  const payloadIdentity = await cycle2kText(payloadIdentityPath, found);
  const payloadIdentityUnitTest = await cycle2kText(
    payloadIdentityUnitTestPath,
    found,
  );
  const payloadIdentitySecurityTest = await cycle2kText(
    payloadIdentitySecurityTestPath,
    found,
  );
  const payloadCustody = await cycle2kText(payloadCustodyPath, found);
  const payloadCustodyUnitTest = await cycle2kText(
    payloadCustodyUnitTestPath,
    found,
  );
  const payloadCustodySecurityTest = await cycle2kText(
    payloadCustodySecurityTestPath,
    found,
  );
  const factNormalization = await cycle2kText(factNormalizationPath, found);
  const factNormalizationUnitTest = await cycle2kText(
    factNormalizationUnitTestPath,
    found,
  );
  const factNormalizationSecurityTest = await cycle2kText(
    factNormalizationSecurityTestPath,
    found,
  );
  const factNormalizationBuilder = await cycle2kText(
    factNormalizationBuilderPath,
    found,
  );
  const factComparison = await cycle2kText(factComparisonPath, found);
  const factComparisonUnitTest = await cycle2kText(
    factComparisonUnitTestPath,
    found,
  );
  const factComparisonSecurityTest = await cycle2kText(
    factComparisonSecurityTestPath,
    found,
  );
  const factComparisonBuilder = await cycle2kText(
    factComparisonBuilderPath,
    found,
  );
  const factComparisonPythonValidator = await cycle2kText(
    factComparisonPythonValidatorPath,
    found,
  );
  const rawFactExtraction = await cycle2kText(rawFactExtractionPath, found);
  const rawFactExtractionUnitTest = await cycle2kText(
    rawFactExtractionUnitTestPath,
    found,
  );
  const rawFactExtractionSecurityTest = await cycle2kText(
    rawFactExtractionSecurityTestPath,
    found,
  );
  const rawFactExtractionBuilder = await cycle2kText(
    rawFactExtractionBuilderPath,
    found,
  );
  const rawFactExtractionPython = await cycle2kText(
    rawFactExtractionPythonPath,
    found,
  );
  const qualityMeasurement = await cycle2kText(qualityMeasurementPath, found);
  const qualityMeasurementUnitTest = await cycle2kText(
    qualityMeasurementUnitTestPath,
    found,
  );
  const qualityMeasurementSecurityTest = await cycle2kText(
    qualityMeasurementSecurityTestPath,
    found,
  );
  const qualityMeasurementBuilder = await cycle2kText(
    qualityMeasurementBuilderPath,
    found,
  );
  const selectedFactRelease = await cycle2kText(selectedFactReleasePath, found);
  const selectedFactReleaseTest = await cycle2kText(
    selectedFactReleaseTestPath,
    found,
  );
  const dossier = await cycle2kText(dossierPath, found);
  const dossierUnitTest = await cycle2kText(dossierUnitTestPath, found);
  const dossierSecurityTest = await cycle2kText(dossierSecurityTestPath, found);
  const dossierBuilder = await cycle2kText(dossierBuilderPath, found);
  const manifestPublicExports = [
    ["PERSONAL_FILING_CORPUS_CHECKS", false],
    ["PERSONAL_FILING_CORPUS_CLAIM", false],
    ["PERSONAL_FILING_CORPUS_FAILURE_CODES", false],
    ["PERSONAL_FILING_CORPUS_LIMITS", false],
    ["PERSONAL_FILING_CORPUS_NOT_PROVEN", false],
    ["PERSONAL_FILING_CORPUS_PROFILE", false],
    ["PERSONAL_FILING_CORPUS_SCHEMA_VERSION", false],
    ["PersonalFilingCorpusError", false],
    ["verifyPersonalFilingCorpusManifest", false],
    ["PersonalFilingCorpusFailureCode", true],
    ["PersonalFilingCorpusInput", true],
    ["PersonalFilingCorpusRecord", true],
  ] as const;
  const payloadIdentityPublicExports = [
    ["PERSONAL_FILING_PAYLOAD_IDENTITY_CHECKS", false],
    ["PERSONAL_FILING_PAYLOAD_IDENTITY_CLAIM", false],
    ["PERSONAL_FILING_PAYLOAD_IDENTITY_FAILURE_CODES", false],
    ["PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS", false],
    ["PERSONAL_FILING_PAYLOAD_IDENTITY_NOT_PROVEN", false],
    ["PERSONAL_FILING_PAYLOAD_IDENTITY_SCHEMA_VERSION", false],
    ["PERSONAL_FILING_PAYLOAD_PATH_MAPPING", false],
    ["PersonalFilingPayloadIdentityError", false],
    ["personalFilingPayloadRelativePath", false],
    ["verifyPersonalFilingCorpusPayloadIdentity", false],
    ["PersonalFilingPayloadIdentityFailureCode", true],
    ["PersonalFilingPayloadIdentityInput", true],
    ["PersonalFilingPayloadIdentityRecord", true],
    ["PersonalFilingPayloadLinkAssurance", true],
  ] as const;
  const payloadCustodyPublicExports = [
    ["PERSONAL_FILING_PAYLOAD_CUSTODY_AUDIT_FILES", false],
    ["PERSONAL_FILING_PAYLOAD_CUSTODY_CHECKS", false],
    ["PERSONAL_FILING_PAYLOAD_CUSTODY_CLAIM", false],
    ["PERSONAL_FILING_PAYLOAD_CUSTODY_FAILURE_CODES", false],
    ["PERSONAL_FILING_PAYLOAD_CUSTODY_LIMITS", false],
    ["PERSONAL_FILING_PAYLOAD_CUSTODY_NOT_PROVEN", false],
    ["PERSONAL_FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION", false],
    ["PERSONAL_FILING_PAYLOAD_DELETE_CONFIRMATION", false],
    ["PERSONAL_FILING_PAYLOAD_DELETION_CLAIM", false],
    ["PersonalFilingPayloadCustodyError", false],
    ["deletePersonalFilingPayloadCustody", false],
    ["recordPersonalFilingPayloadCustody", false],
    ["PersonalFilingPayloadCustodyFailureCode", true],
    ["PersonalFilingPayloadCustodyInput", true],
    ["PersonalFilingPayloadCustodyRecord", true],
    ["PersonalFilingPayloadDeletionAssurance", true],
    ["PersonalFilingPayloadDeletionInput", true],
    ["PersonalFilingPayloadDeletionRecord", true],
  ] as const;
  const factNormalizationPublicExports = [
    ["PERSONAL_FILING_FACT_CONTRACTS", false],
    ["PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA", false],
    ["PERSONAL_FILING_FACT_KEYS", false],
    ["PERSONAL_FILING_FACT_NORMALIZATION_CHECKS", false],
    ["PERSONAL_FILING_FACT_NORMALIZATION_CLAIM", false],
    ["PERSONAL_FILING_FACT_NORMALIZATION_LIMITS", false],
    ["PERSONAL_FILING_FACT_NORMALIZATION_NOT_PROVEN", false],
    ["PERSONAL_FILING_FACT_NORMALIZATION_QUARANTINE_CODES", false],
    ["PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION", false],
    ["normalizePersonalFilingFacts", false],
    ["PersonalFilingFactContract", true],
    ["PersonalFilingFactDerivationOperand", true],
    ["PersonalFilingFactKey", true],
    ["PersonalFilingFactLineageStatus", true],
    ["PersonalFilingFactNormalizationAudit", true],
    ["PersonalFilingFactNormalizationInput", true],
    ["PersonalFilingFactNormalizationQuarantineCode", true],
    ["PersonalFilingFactNormalizationQuarantinedResult", true],
    ["PersonalFilingFactNormalizationRecord", true],
    ["PersonalFilingFactNormalizationResult", true],
    ["PersonalFilingFactPeriodKind", true],
    ["PersonalFilingFactSubtractionDerivation", true],
    ["PersonalFilingFactSupersession", true],
    ["PersonalFilingFactUnit", true],
    ["PersonalNormalizedFilingFactVersion", true],
  ] as const;
  const factComparisonPublicExports = [
    ["PERSONAL_FILING_FACT_COMPARISON_ASSURANCE", false],
    ["PERSONAL_FILING_FACT_COMPARISON_CHECKS", false],
    ["PERSONAL_FILING_FACT_COMPARISON_CLAIM", false],
    ["PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS", false],
    ["PERSONAL_FILING_FACT_COMPARISON_LIMITS", false],
    ["PERSONAL_FILING_FACT_COMPARISON_NOT_PROVEN", false],
    ["PERSONAL_FILING_FACT_COMPARISON_QUARANTINE_CODES", false],
    ["PERSONAL_FILING_FACT_COMPARISON_SCHEMA_VERSION", false],
    ["comparePersonalFilingFactValidation", false],
    ["PersonalFilingFactComparisonAgreementReceipt", true],
    ["PersonalFilingFactComparisonAudit", true],
    ["PersonalFilingFactComparisonImplementationBinding", true],
    ["PersonalFilingFactComparisonInput", true],
    ["PersonalFilingFactComparisonQuarantineCode", true],
    ["PersonalFilingFactComparisonQuarantinedResult", true],
    ["PersonalFilingFactComparisonReceiptBinding", true],
    ["PersonalFilingFactComparisonResult", true],
    ["PersonalFilingFactComparisonRuntimeFamily", true],
    ["PersonalFilingFactComparisonValidatorRole", true],
  ] as const;
  const rawFactExtractionPublicExports = [
    ["PERSONAL_FILING_RAW_FACT_EXTRACTION_ASSURANCE", false],
    ["PERSONAL_FILING_RAW_FACT_EXTRACTION_CHECKS", false],
    ["PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM", false],
    ["PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS", false],
    ["PERSONAL_FILING_RAW_FACT_EXTRACTION_NOT_PROVEN", false],
    ["PERSONAL_FILING_RAW_FACT_EXTRACTION_QUARANTINE_CODES", false],
    ["PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION", false],
    ["PERSONAL_FILING_RAW_FACT_EXTRACTOR_BINDING", false],
    ["comparePersonalFilingRawFactExtraction", false],
    ["PersonalFilingRawFactExtractionAgreementReceipt", true],
    ["PersonalFilingRawFactExtractionAudit", true],
    ["PersonalFilingRawFactExtractionInput", true],
    ["PersonalFilingRawFactExtractionQuarantineCode", true],
    ["PersonalFilingRawFactExtractionQuarantinedResult", true],
    ["PersonalFilingRawFactExtractionResult", true],
    ["PersonalFilingRawFactExtractorBinding", true],
  ] as const;
  const qualityMeasurementPublicExports = [
    ["PERSONAL_FILING_QUALITY_MEASUREMENT_ASSURANCE", false],
    ["PERSONAL_FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS", false],
    ["PERSONAL_FILING_QUALITY_MEASUREMENT_CHECKS", false],
    ["PERSONAL_FILING_QUALITY_MEASUREMENT_CLAIM", false],
    ["PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS", false],
    ["PERSONAL_FILING_QUALITY_MEASUREMENT_METRICS", false],
    ["PERSONAL_FILING_QUALITY_MEASUREMENT_NOT_PROVEN", false],
    ["PERSONAL_FILING_QUALITY_MEASUREMENT_QUARANTINE_CODES", false],
    ["PERSONAL_FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION", false],
    ["PERSONAL_FILING_QUALITY_MEASUREMENT_THRESHOLDS", false],
    ["createPersonalFilingQualityMeasurementProtocol", false],
    ["PersonalFilingQualityMeasurementAudit", true],
    ["PersonalFilingQualityMeasurementCapability", true],
    ["PersonalFilingQualityMeasurementCommitInput", true],
    ["PersonalFilingQualityMeasurementCommitResult", true],
    ["PersonalFilingQualityMeasurementCommittedResult", true],
    ["PersonalFilingQualityMeasurementCounts", true],
    ["PersonalFilingQualityMeasurementEvaluatedResult", true],
    ["PersonalFilingQualityMeasurementFailedThreshold", true],
    ["PersonalFilingQualityMeasurementMetrics", true],
    ["PersonalFilingQualityMeasurementProtocol", true],
    ["PersonalFilingQualityMeasurementQuarantineCode", true],
    ["PersonalFilingQualityMeasurementQuarantinedResult", true],
    ["PersonalFilingQualityMeasurementRatioMetric", true],
    ["PersonalFilingQualityMeasurementRevealResult", true],
  ] as const;
  const selectedFactReleasePublicExports = [
    ["PERSONAL_FILING_SELECTED_FACT_RELEASE_PLAN_ROLE", false],
    ["PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE", false],
    ["PERSONAL_FILING_SELECTED_FACT_RELEASE_ROLE", false],
    ["PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION", false],
    ["PERSONAL_FILING_SELECTED_FACT_RELEASE_SELECTION_RULE", false],
    ["preparePersonalFilingSelectedFactRelease", false],
    ["PersonalFilingSelectedFact", true],
    ["PersonalFilingSelectedFactReleaseExpectedBindings", true],
    ["PersonalFilingSelectedFactReleaseInput", true],
    ["PersonalFilingSelectedFactReleasePlan", true],
    ["PersonalFilingSelectedFactReleasePreparedResult", true],
    ["PersonalFilingSelectedFactReleaseQuarantinedResult", true],
    ["PersonalFilingSelectedFactReleaseResult", true],
  ] as const;
  const dossierPublicExports = [
    ["PERSONAL_FILING_DOSSIER_FACT_LABELS", false],
    ["PERSONAL_FILING_DOSSIER_PLAN_ROLE", false],
    ["PERSONAL_FILING_DOSSIER_PROFILE", false],
    ["PERSONAL_FILING_DOSSIER_ROLE", false],
    ["PERSONAL_FILING_DOSSIER_SCHEMA_VERSION", false],
    ["PERSONAL_FILING_DOSSIER_SNAPSHOT_RULE", false],
    ["preparePersonalFilingDossier", false],
    ["PersonalFilingDossierChart", true],
    ["PersonalFilingDossierChartSeries", true],
    ["PersonalFilingDossierDerivationOperand", true],
    ["PersonalFilingDossierEvidence", true],
    ["PersonalFilingDossierEvidenceId", true],
    ["PersonalFilingDossierFact", true],
    ["PersonalFilingDossierFactId", true],
    ["PersonalFilingDossierInput", true],
    ["PersonalFilingDossierLineage", true],
    ["PersonalFilingDossierLineageEvent", true],
    ["PersonalFilingDossierOmissions", true],
    ["PersonalFilingDossierPlan", true],
    ["PersonalFilingDossierPreparedResult", true],
    ["PersonalFilingDossierQuarantinedResult", true],
    ["PersonalFilingDossierResult", true],
    ["PersonalFilingDossierValuationInputs", true],
  ] as const;

  const indexSource = ts.createSourceFile(
    indexPath,
    index,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (
    indexSource.statements.length !== 9 ||
    !isExactNamedReExportDeclaration(
      indexSource.statements[0],
      "./personal-filing-corpus",
      manifestPublicExports,
    ) ||
    !isExactNamedReExportDeclaration(
      indexSource.statements[1],
      "./personal-filing-payload-identity",
      payloadIdentityPublicExports,
    ) ||
    !isExactNamedReExportDeclaration(
      indexSource.statements[2],
      "./personal-filing-payload-custody",
      payloadCustodyPublicExports,
    ) ||
    !isExactNamedReExportDeclaration(
      indexSource.statements[3],
      "./personal-filing-fact-normalization",
      factNormalizationPublicExports,
    ) ||
    !isExactNamedReExportDeclaration(
      indexSource.statements[4],
      "./personal-filing-fact-comparison",
      factComparisonPublicExports,
    ) ||
    !isExactNamedReExportDeclaration(
      indexSource.statements[5],
      "./personal-filing-raw-fact-extraction",
      rawFactExtractionPublicExports,
    ) ||
    !isExactNamedReExportDeclaration(
      indexSource.statements[6],
      "./personal-filing-quality-measurement",
      qualityMeasurementPublicExports,
    ) ||
    !isExactNamedReExportDeclaration(
      indexSource.statements[7],
      "./personal-filing-selected-fact-release",
      selectedFactReleasePublicExports,
    ) ||
    !isExactNamedReExportDeclaration(
      indexSource.statements[8],
      "./personal-filing-dossier",
      dossierPublicExports,
    )
  )
    found.push(
      `${indexPath}: Cycle 3b personal corpus public export surface must remain exact and test-only quality controls must stay private`,
    );
  const expectedImports = new Map<string, readonly string[]>([
    [implementationPath, ["node:crypto"]],
    [
      indexPath,
      [
        "./personal-filing-corpus",
        "./personal-filing-payload-identity",
        "./personal-filing-payload-custody",
        "./personal-filing-fact-normalization",
        "./personal-filing-fact-comparison",
        "./personal-filing-raw-fact-extraction",
        "./personal-filing-quality-measurement",
        "./personal-filing-selected-fact-release",
        "./personal-filing-dossier",
      ],
    ],
    [unitTestPath, ["node:crypto", "vitest", "./personal-filing-corpus"]],
    [securityTestPath, ["node:crypto", "vitest", "./personal-filing-corpus"]],
    [
      payloadIdentityPath,
      [
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:path",
        "./personal-filing-corpus",
      ],
    ],
    [
      payloadIdentityUnitTestPath,
      [
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "vitest",
        "./personal-filing-payload-identity",
      ],
    ],
    [
      payloadIdentitySecurityTestPath,
      [
        "node:crypto",
        "node:fs/promises",
        "node:os",
        "node:path",
        "vitest",
        "./index",
        "./personal-filing-payload-identity",
      ],
    ],
    [
      payloadCustodyPath,
      [
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:path",
        "./personal-filing-corpus",
        "./personal-filing-payload-identity",
      ],
    ],
    [
      payloadCustodyUnitTestPath,
      [
        "node:crypto",
        "node:fs/promises",
        "node:os",
        "node:path",
        "vitest",
        "./personal-filing-payload-custody",
        "./personal-filing-payload-identity",
      ],
    ],
    [
      payloadCustodySecurityTestPath,
      [
        "node:crypto",
        "node:fs/promises",
        "node:os",
        "node:path",
        "vitest",
        "./personal-filing-payload-custody",
        "./personal-filing-payload-identity",
      ],
    ],
    [
      factNormalizationPath,
      ["node:crypto", "node:util/types", "./personal-filing-corpus"],
    ],
    [
      factNormalizationUnitTestPath,
      [
        "vitest",
        "./personal-filing-fact-normalization",
        "./test-personal-filing-fact-builder",
      ],
    ],
    [
      factNormalizationSecurityTestPath,
      [
        "vitest",
        "./personal-filing-fact-normalization",
        "./test-personal-filing-fact-builder",
      ],
    ],
    [
      factNormalizationBuilderPath,
      ["node:crypto", "./personal-filing-fact-normalization"],
    ],
    [
      factComparisonPath,
      [
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:url",
        "node:util/types",
        "./personal-filing-corpus",
        "./personal-filing-fact-normalization",
      ],
    ],
    [
      factComparisonUnitTestPath,
      [
        "vitest",
        "./personal-filing-fact-comparison",
        "./test-personal-filing-fact-comparison-builder",
        "./test-personal-filing-fact-builder",
      ],
    ],
    [
      factComparisonSecurityTestPath,
      [
        "vitest",
        "./personal-filing-fact-comparison",
        "./test-personal-filing-fact-comparison-builder",
        "./test-personal-filing-fact-builder",
      ],
    ],
    [
      factComparisonBuilderPath,
      [
        "node:child_process",
        "node:url",
        "./personal-filing-fact-comparison",
        "./personal-filing-fact-normalization",
        "./test-personal-filing-fact-builder",
      ],
    ],
    [
      rawFactExtractionPath,
      [
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:url",
        "node:util/types",
        "./personal-filing-corpus",
        "./personal-filing-fact-comparison",
        "./personal-filing-fact-normalization",
      ],
    ],
    [
      rawFactExtractionUnitTestPath,
      [
        "vitest",
        "./personal-filing-raw-fact-extraction",
        "./test-personal-filing-raw-fact-extraction-builder",
        "./test-personal-filing-fact-builder",
      ],
    ],
    [
      rawFactExtractionSecurityTestPath,
      [
        "node:crypto",
        "vitest",
        "./personal-filing-raw-fact-extraction",
        "./test-personal-filing-raw-fact-extraction-builder",
        "./test-personal-filing-fact-builder",
      ],
    ],
    [
      rawFactExtractionBuilderPath,
      [
        "node:child_process",
        "node:url",
        "./personal-filing-raw-fact-extraction",
        "./test-personal-filing-fact-builder",
      ],
    ],
    [
      qualityMeasurementPath,
      [
        "node:crypto",
        "node:util/types",
        "./personal-filing-corpus",
        "./personal-filing-fact-normalization",
        "./personal-filing-raw-fact-extraction",
      ],
    ],
    [
      qualityMeasurementUnitTestPath,
      [
        "vitest",
        "./personal-filing-quality-measurement",
        "./test-personal-filing-quality-measurement-builder",
        "./test-personal-filing-fact-builder",
      ],
    ],
    [
      qualityMeasurementSecurityTestPath,
      [
        "node:crypto",
        "vitest",
        "./personal-filing-quality-measurement",
        "./test-personal-filing-quality-measurement-builder",
        "./test-personal-filing-fact-builder",
      ],
    ],
    [
      qualityMeasurementBuilderPath,
      [
        "./personal-filing-fact-normalization",
        "./personal-filing-quality-measurement",
        "./test-personal-filing-raw-fact-extraction-builder",
        "./test-personal-filing-fact-builder",
      ],
    ],
    [
      selectedFactReleasePath,
      [
        "node:util/types",
        "./personal-filing-corpus",
        "./personal-filing-fact-normalization",
        "./personal-filing-quality-measurement",
        "./personal-filing-raw-fact-extraction",
      ],
    ],
    [
      selectedFactReleaseTestPath,
      [
        "vitest",
        "./personal-filing-fact-normalization",
        "./personal-filing-quality-measurement",
        "./personal-filing-selected-fact-release",
        "./test-personal-filing-quality-measurement-builder",
      ],
    ],
    [
      dossierPath,
      [
        "node:util/types",
        "./personal-filing-fact-normalization",
        "./personal-filing-selected-fact-release",
        "./personal-filing-corpus",
        "./personal-filing-quality-measurement",
        "./personal-filing-raw-fact-extraction",
      ],
    ],
    [
      dossierUnitTestPath,
      [
        "vitest",
        "./personal-filing-dossier",
        "./personal-filing-selected-fact-release",
        "./test-personal-filing-dossier-builder",
      ],
    ],
    [
      dossierSecurityTestPath,
      [
        "vitest",
        "./personal-filing-dossier",
        "./test-personal-filing-dossier-builder",
      ],
    ],
    [
      dossierBuilderPath,
      [
        "./personal-filing-fact-normalization",
        "./personal-filing-dossier",
        "./personal-filing-quality-measurement",
        "./test-personal-filing-quality-measurement-builder",
      ],
    ],
  ]);
  for (const [path, content] of [
    [implementationPath, implementation],
    [indexPath, index],
    [unitTestPath, unitTest],
    [securityTestPath, securityTest],
    [payloadIdentityPath, payloadIdentity],
    [payloadIdentityUnitTestPath, payloadIdentityUnitTest],
    [payloadIdentitySecurityTestPath, payloadIdentitySecurityTest],
    [payloadCustodyPath, payloadCustody],
    [payloadCustodyUnitTestPath, payloadCustodyUnitTest],
    [payloadCustodySecurityTestPath, payloadCustodySecurityTest],
    [factNormalizationPath, factNormalization],
    [factNormalizationUnitTestPath, factNormalizationUnitTest],
    [factNormalizationSecurityTestPath, factNormalizationSecurityTest],
    [factNormalizationBuilderPath, factNormalizationBuilder],
    [factComparisonPath, factComparison],
    [factComparisonUnitTestPath, factComparisonUnitTest],
    [factComparisonSecurityTestPath, factComparisonSecurityTest],
    [factComparisonBuilderPath, factComparisonBuilder],
    [rawFactExtractionPath, rawFactExtraction],
    [rawFactExtractionUnitTestPath, rawFactExtractionUnitTest],
    [rawFactExtractionSecurityTestPath, rawFactExtractionSecurityTest],
    [rawFactExtractionBuilderPath, rawFactExtractionBuilder],
    [qualityMeasurementPath, qualityMeasurement],
    [qualityMeasurementUnitTestPath, qualityMeasurementUnitTest],
    [qualityMeasurementSecurityTestPath, qualityMeasurementSecurityTest],
    [qualityMeasurementBuilderPath, qualityMeasurementBuilder],
    [selectedFactReleasePath, selectedFactRelease],
    [selectedFactReleaseTestPath, selectedFactReleaseTest],
    [dossierPath, dossier],
    [dossierUnitTestPath, dossierUnitTest],
    [dossierSecurityTestPath, dossierSecurityTest],
    [dossierBuilderPath, dossierBuilder],
  ] as const) {
    if (
      JSON.stringify(collectModuleSpecifiers(content)) !==
      JSON.stringify(expectedImports.get(path))
    )
      found.push(
        `${path}: Cycle 2q/2r/2s/2u/2v/2w/2x/2z/3b imports must remain exact`,
      );
    if (
      hasRuntimeDynamicImport(content) ||
      hasForbiddenDynamicCodeCapability(content) ||
      hasUnresolvedRuntimeModuleLoad(content) ||
      hasIndirectRuntimeModuleLoad(content)
    )
      found.push(
        `${path}: runtime module loading and dynamic code are forbidden`,
      );
  }
  for (const required of [
    '"personal_single_user_local" as const',
    'readonly status: "verified_for_personal_use"',
    '"raw_payload_presence_or_declared_content_sha256_byte_equality"',
    '"legal_opinion_rights_authority_data_steward_or_external_approval"',
    '"multi_user_identity_tenancy_authorization_or_shared_service_safety"',
    '"database_api_web_composition_or_b15_v15"',
  ])
    if (!implementation.includes(required))
      found.push(
        `${implementationPath}: missing exact personal-use claim or nonclaim ${required}`,
      );
  if (
    implementation.includes('status: "admitted"') ||
    implementation.includes("rights_and_steward_approved")
  )
    found.push(
      `${implementationPath}: personal-use verification must not reuse enterprise admission claims`,
    );

  for (const required of [
    '"direct_root_accession_payload_v1" as const',
    '"bounded_streamed_local_payload_presence_length_and_sha256_verified_for_personal_single_user_local_use" as const',
    'readonly status: "payload_identity_verified_for_personal_use"',
    "verifyPersonalFilingCorpusManifest",
    "return `${accession}.payload`",
    '"sec_source_authenticity_attestation_or_complete_filing_provenance"',
    '"retention_enforcement_backup_deletion_or_cryptographic_erasure"',
    '"enterprise_rights_steward_approval_database_api_web_or_b15_v15"',
  ])
    if (!payloadIdentity.includes(required))
      found.push(
        `${payloadIdentityPath}: missing exact Cycle 2r payload-identity claim, binding, mapping, or nonclaim ${required}`,
      );
  if (
    payloadIdentity.includes('status: "admitted"') ||
    payloadIdentity.includes("rights_and_steward_approved") ||
    payloadIdentity.includes("rawPayload:") ||
    payloadIdentity.includes("payloadBytes:")
  )
    found.push(
      `${payloadIdentityPath}: payload identity must remain aggregate-only and must not reuse enterprise admission claims`,
    );

  for (const required of [
    '"bounded_separate_local_payload_and_audit_custody_recorded_for_personal_single_user_local_use" as const',
    '"bounded_owner_triggered_selected_live_payload_paths_observed_absent_for_personal_single_user_local_use" as const',
    'readonly status: "local_payload_custody_recorded_for_personal_use"',
    'readonly status: "live_payload_names_absent_after_explicit_personal_delete"',
    "verifyPersonalFilingCorpusPayloadIdentity",
    '"append_only_deletion_intent_published_before_any_payload_unlink"',
    '"transactional_atomicity_between_payload_and_audit_roots_or_rollback"',
    '"backup_cloud_sync_replica_snapshot_cache_temp_log_swap_recycle_bin_or_third_party_deletion"',
    '"filesystem_journal_history_recovery_tool_physical_media_overwrite_or_cryptographic_erasure"',
    '"enterprise_rights_steward_approval_database_b15_or_v15"',
  ])
    if (!payloadCustody.includes(required))
      found.push(
        `${payloadCustodyPath}: missing exact Cycle 2s custody/deletion claim, binding, sequencing, or nonclaim ${required}`,
      );
  if (
    payloadCustody.includes('status: "admitted"') ||
    payloadCustody.includes("rights_and_steward_approved") ||
    payloadCustody.includes("rawPayload:") ||
    payloadCustody.includes("payloadBytes:")
  )
    found.push(
      `${payloadCustodyPath}: personal custody/deletion must remain aggregate-only and must not reuse enterprise admission claims`,
    );

  for (const required of [
    '"bounded_private_ten_fact_normalization_and_manifest_linked_lineage_for_personal_single_user_local_use" as const',
    '"exact_one_10k_or_manifest_linked_10k_and_10k_amendment_closed_source_set"',
    '"exact_ten_fixed_fact_keys_once_per_parser_result"',
    '"free_cash_flow_only_fixed_subtraction_with_exact_qname_operands"',
    '"strict_decimal_numeric_38_12_without_binary_float_or_unit_conversion"',
    '"root_only_no_in_corpus_amendment" | "amendment_supersession_observed"',
    'readonly status: "normalized_for_personal_use"',
    "readonly synthetic: false",
    "readonly factVersions: readonly []",
    "readonly lineage: readonly []",
    '"raw_payload_presence_identity_or_declared_content_digest_byte_equality"',
    '"ixbrl_xbrl_parser_extraction_or_taxonomy_mapping_correctness"',
    '"independent_parser_validator_comparison_or_conflict_adjudication"',
    '"absence_of_amendments_or_corrections_outside_the_exact_frozen_manifest"',
    '"multi_user_shared_service_database_api_web_queue_or_production_readiness"',
    "verifyPersonalFilingCorpusManifest",
    "isProxy",
    "PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA",
    "sourceDocumentSha256",
    "knownToExclusive",
    "predecessorFactId",
    "successorFactId",
  ])
    if (!factNormalization.includes(required))
      found.push(
        `${factNormalizationPath}: missing exact Cycle 2u fact, lineage, quarantine, or nonclaim control ${required}`,
      );
  for (const key of [
    '"assets"',
    '"cash"',
    '"debt"',
    '"diluted_shares"',
    '"free_cash_flow"',
    '"gross_profit"',
    '"net_income"',
    '"operating_cash_flow"',
    '"operating_income"',
    '"revenue"',
  ])
    if (!factNormalization.includes(key))
      found.push(
        `${factNormalizationPath}: missing fixed Cycle 2u fact key ${key}`,
      );
  if (
    factNormalization.includes('status: "admitted"') ||
    factNormalization.includes("rights_and_steward_approved") ||
    factNormalization.includes("rawPayload:") ||
    factNormalization.includes("payloadBytes:") ||
    factNormalization.includes("synthetic: true")
  )
    found.push(
      `${factNormalizationPath}: personal normalization must remain parser-result-only, non-enterprise, and non-synthetic`,
    );

  for (const required of [
    '"bounded_repository_pinned_typescript_python_validator_exact_record_agreement_and_atomic_value_free_conflict_quarantine_for_personal_single_user_local_use" as const',
    '"distinct_repository_pinned_implementations_over_one_shared_parser_result_scope" as const',
    '"local_typescript_normalizer_reconstruction_precedes_any_agreement_decision"',
    '"secondary_validator_receives_no_primary_record_or_primary_record_digest"',
    '"byte_exact_complete_cycle2u_record_agreement_not_digest_or_subset_equality"',
    '"no_tolerance_coercion_reordering_merge_fallback_preference_or_silent_repair"',
    '"bounded_python_isolated_mode_stdin_subprocess_with_pinned_source_preflight"',
    'validatorVersion: "1.0.1"',
    'readonly status: "agreed_for_personal_use"',
    'readonly status: "matched_for_testing_only"',
    'readonly status: "quarantined"',
    "readonly factVersions: readonly []",
    "readonly lineage: readonly []",
    "readonly validatorBindings: readonly []",
    '"independent_raw_filing_parsing_extraction_or_taxonomy_mapping"',
    '"operator_host_key_process_failure_domain_or_code_lineage_independence"',
    '"absence_of_common_input_common_specification_errors_collusion_or_malicious_validators"',
    '"independently_adjudicated_ground_truth_precision_recall_or_quality_thresholds"',
    "comparePersonalFilingFactValidation",
    "normalizePersonalFilingFacts",
    '"validator_conflict"',
    '"validator_execution_failure"',
    "runPinnedPythonValidator",
    'spawnSync("python", ["-I", "-B", PYTHON_VALIDATOR_PATH]',
  ])
    if (!factComparison.includes(required))
      found.push(
        `${factComparisonPath}: missing exact Cycle 2v agreement, conflict, quarantine, or nonclaim control ${required}`,
      );
  if (
    factComparison.includes('status: "admitted"') ||
    factComparison.includes("rights_and_steward_approved") ||
    factComparison.includes("rawPayload:") ||
    factComparison.includes("payloadBytes:") ||
    factComparison.includes("synthetic: true")
  )
    found.push(
      `${factComparisonPath}: personal comparison must remain value-free on conflict, non-enterprise, and non-synthetic`,
    );
  for (const required of [
    "Independent validator for the personal filing fact normalization boundary",
    "only the Python standard library",
    "never reports input-derived details on failure",
    "FACT_ID_DOMAIN",
    "SOURCE_DOCUMENT_BYTES",
  ])
    if (!factComparisonPythonValidator.includes(required))
      found.push(
        `${factComparisonPythonValidatorPath}: missing exact Cycle 2v Python validator binding or conflict control ${required}`,
      );
  const typescriptClosureHash = createHash("sha256").update(
    "research-cockpit:typescript-implementation-closure:v1\0",
    "utf8",
  );
  for (const [path, content] of [
    [implementationPath, implementation],
    [factNormalizationPath, factNormalization],
  ] as const)
    typescriptClosureHash
      .update(path, "utf8")
      .update("\0", "utf8")
      .update(content.replace(/\r\n/gu, "\n"), "utf8")
      .update("\0", "utf8");
  const expectedTypescriptClosure = `sha256:${typescriptClosureHash.digest("hex")}`;
  if (!factComparison.includes(`"${expectedTypescriptClosure}"`))
    found.push(
      `${factComparisonPath}: repository-pinned TypeScript implementation-closure digest must match canonical LF corpus-verifier and normalizer source bytes`,
    );
  const expectedPython = `sha256:${createHash("sha256")
    .update(factComparisonPythonValidator.replace(/\r\n/gu, "\n"), "utf8")
    .digest("hex")}`;
  if (!factComparison.includes(`"${expectedPython}"`))
    found.push(
      `${factComparisonPath}: repository-pinned Python implementation digest must match canonical LF source bytes`,
    );
  for (const required of [
    '"bounded_repository_pinned_python_raw_ixbrl_ten_fact_projection_agreement_with_frozen_primary_parser_result_and_atomic_value_free_conflict_quarantine_for_personal_single_user_local_use" as const',
    '"secondary_raw_extractor_receives_no_primary_parser_result_normalized_record_or_digest" as const',
    '"extractor_stdin_contains_only_raw_filing_documents_and_target_qnames"',
    '"no_primary_parser_result_normalized_record_or_digest_crosses_extractor_boundary"',
    '"correctness_of_the_shared_normalization_plan_qname_mapping_or_fact_selection_specification"',
    'readonly status: "raw_extraction_agreed_for_personal_use"',
    'readonly status: "quarantined"',
    "readonly facts: readonly []",
    "readonly extractorBindings: readonly []",
    "comparePersonalFilingRawFactExtraction",
    "comparePersonalFilingFactValidation",
    "runPinnedPythonExtractor",
    "spawnSync(",
    '["-I", "-B", PYTHON_EXTRACTOR_PATH]',
  ])
    if (!rawFactExtraction.includes(required))
      found.push(
        `${rawFactExtractionPath}: missing exact Cycle 2w raw extraction, isolation, quarantine, or nonclaim control ${required}`,
      );
  if (
    rawFactExtraction.includes('status: "admitted"') ||
    rawFactExtraction.includes("rights_and_steward_approved") ||
    rawFactExtraction.includes("synthetic: true")
  )
    found.push(
      `${rawFactExtractionPath}: personal raw extraction must remain value-free on conflict, non-enterprise, and non-synthetic`,
    );

  const extractorStart = rawFactExtraction.indexOf(
    "function runPinnedPythonExtractor(",
  );
  const extractorEnd = rawFactExtraction.indexOf(
    "\nfunction ",
    extractorStart + 1,
  );
  const extractorSource =
    extractorStart >= 0 && extractorEnd > extractorStart
      ? rawFactExtraction.slice(extractorStart, extractorEnd)
      : "";
  for (const required of [
    "rawFilingDocuments: snapshot.rawFilingDocuments.map(base64)",
    "targetConcepts,",
  ])
    if (!extractorSource.includes(required))
      found.push(
        `${rawFactExtractionPath}: Python extractor stdin must contain exact rawFilingDocuments and targetConcepts source ${required}`,
      );
  for (const forbidden of [
    "snapshot.declaration",
    "snapshot.manifest",
    "snapshot.normalizationPlan",
    "snapshot.sourceDocuments",
    "normalizedRecord",
    "primaryRecord",
    "primaryBytes",
    "agreementSha256",
    "projectionSha256",
    "inputSetSha256",
  ])
    if (extractorSource.includes(forbidden))
      found.push(
        `${rawFactExtractionPath}: forbidden parser-result, normalized-record, plan, manifest, or digest material crosses Python extractor stdin: ${forbidden}`,
      );

  if (
    !rawFactExtractionPython.includes(
      'REQUEST_KEYS = frozenset(("rawFilingDocuments", "targetConcepts"))',
    )
  )
    found.push(
      `${rawFactExtractionPythonPath}: Python request contract must accept exactly rawFilingDocuments and targetConcepts`,
    );
  for (const forbidden of [
    "normalizationPlan",
    "sourceDocuments",
    "parserResult",
    "normalizedRecord",
    "primaryRecord",
    "primaryDigest",
    "recordSha256",
  ])
    if (rawFactExtractionPython.includes(forbidden))
      found.push(
        `${rawFactExtractionPythonPath}: forbidden plan, parser-result, normalized-record, or digest request material ${forbidden}`,
      );

  const expectedRawExtractor = `sha256:${createHash("sha256")
    .update(rawFactExtractionPython.replace(/\r\n/gu, "\n"), "utf8")
    .digest("hex")}`;
  if (!rawFactExtraction.includes(`"${expectedRawExtractor}"`))
    found.push(
      `${rawFactExtractionPath}: repository-pinned Python raw extractor digest must match canonical LF source bytes`,
    );

  for (const required of [
    '"bounded_owner_reviewed_frozen_reference_personal_filing_quality_measurement_with_predeclared_zero_tolerance_thresholds_and_atomic_value_free_quarantine_for_personal_single_user_local_use" as const',
    '"candidate_observations_committed_before_owner_reviewed_reference_content_reveal" as const',
    '"one_shot_open_candidate_committed_consumed_protocol_with_consuming_first_attempts"',
    '"commit_receives_reference_digest_only_and_no_reference_content_labels_or_expected_values"',
    '"caller_cannot_supply_counts_metrics_thresholds_weights_exclusions_or_outcomes"',
    '"owner_identity_independent_adjudication_or_owner_reviewed_label_correctness"',
    '"reference_set_representativeness_statistical_threshold_adequacy_or_generalization_beyond_exact_frozen_scope"',
    'readonly status: "candidate_committed_for_personal_use"',
    'readonly status: "quality_evaluated_for_personal_use"',
    'readonly status: "quarantined"',
    "readonly bindings: readonly []",
    "readonly counts: readonly []",
    "readonly metrics: readonly []",
    "readonly synthetic: false",
    "dateToleranceDays: 0",
    "maximumSilentCriticalFailures: 0",
    'unitTolerancePolicy: "exact_canonical_unit.v1"',
    "comparePersonalFilingRawFactExtraction",
    "normalizePersonalFilingFacts",
    "commitPersonalFilingQualityMeasurementForDossier",
    'status: "candidate_and_normalization_committed_for_dossier"',
    "createPersonalFilingQualityMeasurementProtocol",
  ])
    if (!qualityMeasurement.includes(required))
      found.push(
        `${qualityMeasurementPath}: missing exact Cycle 2x commit/reveal, zero-tolerance, aggregate-only quarantine, or nonclaim control ${required}`,
      );
  if (
    qualityMeasurement.includes('status: "admitted"') ||
    qualityMeasurement.includes("rights_and_steward_approved") ||
    qualityMeasurement.includes("synthetic: true")
  )
    found.push(
      `${qualityMeasurementPath}: personal quality measurement must remain owner-reviewed, non-enterprise, non-synthetic, and value-free on quarantine`,
    );

  for (const required of [
    '"personal_single_user_local" as const',
    '"personal_selected_fact_release_plan" as const',
    '"personal_selected_fact_release" as const',
    '"exact_candidate_document_index_and_fact_key.v1" as const',
    'readonly status: "prepared_selected_facts_for_personal_use"',
    'readonly status: "quarantined"',
    "readonly facts: readonly []",
    "candidateCommitmentSha256",
    "candidateObservationsSha256",
    "inputSetSha256",
    "ownerReviewedReferenceSha256",
    "qualityPlanSha256",
    "createPersonalFilingQualityMeasurementProtocol",
    "normalizePersonalFilingFacts",
    "normalization.audit.sourceDocumentCount !==",
    "committed.audit.succeededDocumentCount !==",
    "committed.audit.quarantinedDocumentCount !== 0",
    "PERSONAL_FILING_FACT_KEYS.indexOf",
    "seenBuffers.has(buffer as object)",
    "isProxy",
    "wipeSnapshot(snapshot)",
    "key: fact.key",
    "periodEnd: fact.periodEnd",
    "periodStart: fact.periodStart",
    "unit: fact.unit",
    "value: fact.value",
  ])
    if (!selectedFactRelease.includes(required))
      found.push(
        `${selectedFactReleasePath}: missing exact Cycle 2z same-snapshot binding, closed selection, frozen projection, or value-free quarantine control ${required}`,
      );
  for (const exactDeclaration of [
    `const INPUT_KEYS = [
  "declaration",
  "expectedBindings",
  "manifest",
  "normalizationPlan",
  "qualityPlan",
  "rawFilingDocuments",
  "releasePlan",
  "sourceDocuments",
] as const;`,
    `const BINDING_KEYS = [
  "candidateCommitmentSha256",
  "candidateObservationsSha256",
  "inputSetSha256",
  "ownerReviewedReferenceSha256",
  "qualityPlanSha256",
] as const;`,
    `const PLAN_KEYS = [
  "documentIndex",
  "factKeys",
  "profile",
  "role",
  "schemaVersion",
  "selectionRule",
] as const;`,
  ])
    if (!selectedFactRelease.includes(exactDeclaration))
      found.push(
        `${selectedFactReleasePath}: Cycle 2z input, five-hash binding, and release-plan descriptor closures must remain exact`,
      );
  for (const requiredTest of [
    '"requires every member of the exact five-hash binding tuple"',
    '"rejects aliases, Buffer carriers, proxies, accessors, and extra keys without invoking canaries"',
    '"owns the input snapshot and leaves a successful result immutable after caller mutation"',
    '"never releases partial values when normalization or selection cannot complete"',
  ])
    if (!selectedFactReleaseTest.includes(requiredTest))
      found.push(
        `${selectedFactReleaseTestPath}: missing exact Cycle 2z adversarial regression ${requiredTest}`,
      );
  for (const forbidden of [
    'status: "admitted"',
    "rights_and_steward_approved",
    "sourceConcept",
    "sourceContentSha256",
    "factId",
    "knownFrom",
    "knownToExclusive",
    "candidateDocuments",
    ".reveal(",
  ])
    if (selectedFactRelease.includes(forbidden))
      found.push(
        `${selectedFactReleasePath}: Cycle 2z selected-fact release must not expose provenance, reference content, candidate internals, enterprise admission, or reveal capability ${forbidden}`,
      );

  for (const required of [
    '"personal_dossier_release_plan" as const',
    '"personal_dossier" as const',
    '"exact_candidate_document_index.v1" as const',
    'readonly status: "prepared_personal_dossier_for_personal_use"',
    'readonly status: "quarantined"',
    "commitPersonalFilingQualityMeasurementForDossier",
    'admission.status !== "candidate_and_normalization_committed_for_dossier"',
    "const normalized = admission.normalization",
    "knownFrom: version.knownFrom",
    "knownToExclusive:",
    "derivationOperands:",
    '"minuend"',
    '"subtrahend"',
    "sourceContentSha256: version.sourceContentSha256",
    "sourceDocumentSha256: version.sourceDocumentSha256",
    "selectedDocumentFacts(versions, documentIndex, plan.factKeys)",
    "wipeSnapshot(snapshot)",
    "isProxy",
    'reasonCode: "NO_OWNER_APPROVED_CHART_FACTS"',
    'reasonCode: "REQUIRED_FACTS_NOT_RELEASED"',
    'reasonCode: "INPUT_OUT_OF_DOMAIN"',
  ])
    if (!dossier.includes(required))
      found.push(
        `${dossierPath}: missing exact Cycle 3b snapshot, provenance, derivation, closed-graph, unsupported-state, or quarantine control ${required}`,
      );
  for (const requiredTest of [
    '"composes one immutable current-and-superseded graph from one owner-authorized snapshot"',
    '"never looks ahead beyond the exact selected document index"',
    '"uses explicit unsupported states without synthetic or partial fallback"',
    '"rejects aliases, Buffer carriers, proxies, accessors, and extra keys without invoking canaries"',
    '"owns every input and control array before composition"',
    '"returns only the shared value-free quarantine graph after source corruption"',
    '"exposes only response-local fact identifiers and keeps every graph reference closed"',
  ])
    if (
      !dossierUnitTest.includes(requiredTest) &&
      !dossierSecurityTest.includes(requiredTest)
    )
      found.push(
        `${dossierPath}: missing exact Cycle 3b focused or adversarial regression ${requiredTest}`,
      );
  for (const forbidden of [
    'status: "admitted"',
    "rights_and_steward_approved",
    "synthetic: true",
    ".reveal(",
    "preparePersonalFilingSelectedFactRelease(",
    "normalizePersonalFilingFacts(",
  ])
    if (dossier.includes(forbidden))
      found.push(
        `${dossierPath}: Cycle 3b personal dossier must not claim enterprise admission, synthesize private values, or expose a reveal capability ${forbidden}`,
      );

  const workflowPath =
    ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml";
  const workflow = await cycle2kText(workflowPath, found);
  const cycle2xStart = workflow.indexOf("        id: cycle2x_source");
  const cycle2wStart = workflow.indexOf("        id: cycle2w_source");
  const cycle2vStart = workflow.indexOf("        id: cycle2v_source");
  const cycle2uStart = workflow.indexOf("        id: cycle2u_source");
  const cycle2sStart = workflow.indexOf("        id: cycle2s_source");
  const cycle2rStart = workflow.indexOf("        id: cycle2r_source");
  const cycle2qStart = workflow.indexOf("        id: cycle2q_source");
  const cycle2pStart = workflow.indexOf("        id: cycle2p_source");
  const cycle2xSection =
    cycle2xStart >= 0 && cycle2wStart > cycle2xStart
      ? workflow.slice(cycle2xStart, cycle2wStart)
      : "";
  if (
    cycle2xSection === "" ||
    !cycle2xSection.includes(`baseline="${cycle2xBaselineRevision}"`) ||
    !cycle2xSection.includes(`source="${cycle2xSourceRevision}"`) ||
    !cycle2xSection.includes(
      `validator_isolation="${cycle2xValidatorIsolationRevision}"`,
    ) ||
    JSON.stringify(doubleQuotedShellArray(cycle2xSection, "protected")) !==
      JSON.stringify(cycle2xProtectedPaths) ||
    JSON.stringify(
      doubleQuotedShellArray(cycle2xSection, "expected_source"),
    ) !==
      JSON.stringify(
        cycle2xTransition.flatMap(({ path, status }) => [status, path]),
      ) ||
    JSON.stringify(
      doubleQuotedShellArray(cycle2xSection, "expected_validator_isolation"),
    ) !==
      JSON.stringify(
        cycle2xValidatorIsolationTransition.flatMap(({ path, status }) => [
          status,
          path,
        ]),
      ) ||
    JSON.stringify(
      doubleQuotedShellArray(cycle2xSection, "expected_routing_closure"),
    ) !==
      JSON.stringify(
        cycle2xRoutingClosureTransition.flatMap(({ path, status }) => [
          status,
          path,
        ]),
      ) ||
    JSON.stringify(
      doubleQuotedShellArray(cycle2xSection, "expected_cumulative"),
    ) !==
      JSON.stringify(
        cycle2xCorrectiveCumulativeTransition.flatMap(({ path, status }) => [
          status,
          path,
        ]),
      ) ||
    !cycle2xSection.includes(
      'git diff --name-status --no-renames -z "$baseline" "$source" --',
    ) ||
    !cycle2xSection.includes(
      'git diff --name-status --no-renames -z "$source" "$validator_isolation" --',
    ) ||
    !cycle2xSection.includes(
      'git diff --name-status --no-renames -z "$validator_isolation" HEAD --',
    ) ||
    !cycle2xSection.includes(
      'git diff --name-status --no-renames -z "$baseline" HEAD --',
    ) ||
    !cycle2xSection.includes('[[ "$head_revision" == "$GITHUB_SHA" ]]') ||
    !cycle2xSection.includes('[[ "$head_revision" == "$source" ]]') ||
    !cycle2xSection.includes('[[ "$successor_count" == "1" ]]') ||
    !cycle2xSection.includes('[[ "$first_parent_count" == "1" ]]') ||
    !cycle2xSection.includes('[[ "$successor_count" == "3" ]]') ||
    !cycle2xSection.includes('[[ "$first_parent_count" == "3" ]]') ||
    !cycle2xSection.includes('[[ "${#topology[@]}" == "2" ]]') ||
    !cycle2xSection.includes('[[ "${topology[0]}" == "$GITHUB_SHA" ]]') ||
    !cycle2xSection.includes('[[ "${topology[1]}" == "$baseline" ]]') ||
    !cycle2xSection.includes(
      '[[ "${topology[1]}" == "$validator_isolation" ]]',
    ) ||
    !cycle2xSection.includes(
      '[[ "${#validator_isolation_topology[@]}" == "2" ]]',
    ) ||
    !cycle2xSection.includes(
      '[[ "${validator_isolation_topology[0]}" == "$validator_isolation" ]]',
    ) ||
    !cycle2xSection.includes(
      '[[ "${validator_isolation_topology[1]}" == "$source" ]]',
    ) ||
    !cycle2xSection.includes('[[ "${#source_topology[@]}" == "2" ]]') ||
    !cycle2xSection.includes('[[ "${source_topology[0]}" == "$source" ]]') ||
    !cycle2xSection.includes('[[ "${source_topology[1]}" == "$baseline" ]]') ||
    !cycle2xSection.includes("matches_exactly expected_source source_actual") ||
    !cycle2xSection.includes(
      "matches_exactly expected_validator_isolation validator_isolation_actual",
    ) ||
    !cycle2xSection.includes(
      "matches_exactly expected_routing_closure routing_closure_actual",
    ) ||
    !cycle2xSection.includes(
      "matches_exactly expected_cumulative cumulative_actual",
    ) ||
    !cycle2xSection.includes("required=true") ||
    !cycle2xSection.includes("exact=true") ||
    !cycle2xSection.includes('echo "required=$required" >> "$GITHUB_OUTPUT"') ||
    !cycle2xSection.includes('echo "exact=$exact" >> "$GITHUB_OUTPUT"') ||
    !cycle2xSection.includes(
      'if [[ "$required" == "true" && "$exact" != "true" ]]; then',
    )
  )
    found.push(
      `${workflowPath}: exact fail-closed Cycle 2x source and validator-isolation corrective closure with 1/1 and 3/3 topology are required before Cycle 2w`,
    );
  const cycle2wSection =
    cycle2wStart >= 0 && cycle2vStart > cycle2wStart
      ? workflow.slice(cycle2wStart, cycle2vStart)
      : "";
  if (
    cycle2wSection === "" ||
    !cycle2wSection.includes(`baseline="${cycle2wBaselineRevision}"`) ||
    JSON.stringify(doubleQuotedShellArray(cycle2wSection, "protected")) !==
      JSON.stringify(cycle2wProtectedPaths) ||
    JSON.stringify(doubleQuotedShellArray(cycle2wSection, "expected")) !==
      JSON.stringify(
        cycle2wTransition.flatMap(({ path, status }) => [status, path]),
      ) ||
    !cycle2wSection.includes(
      'git diff --name-status --no-renames -z "$baseline" HEAD --',
    ) ||
    !cycle2wSection.includes('[[ "$head_revision" == "$GITHUB_SHA" ]]') ||
    !cycle2wSection.includes('[[ "$successor_count" == "1" ]]') ||
    !cycle2wSection.includes('[[ "$first_parent_count" == "1" ]]') ||
    !cycle2wSection.includes('[[ "${#topology[@]}" == "2" ]]') ||
    !cycle2wSection.includes('[[ "${topology[0]}" == "$GITHUB_SHA" ]]') ||
    !cycle2wSection.includes('[[ "${topology[1]}" == "$baseline" ]]') ||
    !cycle2wSection.includes("matches_exactly expected actual") ||
    !cycle2wSection.includes(
      'if [[ "$required" == "true" && "$exact" != "true" ]]; then',
    )
  )
    found.push(
      `${workflowPath}: exact fail-closed Cycle 2w baseline, protected set, full tuple, and 1/1 topology are required before Cycle 2v`,
    );

  const cycle2vSection =
    cycle2vStart >= 0 && cycle2uStart > cycle2vStart
      ? workflow.slice(cycle2vStart, cycle2uStart)
      : "";
  const cycle2uSection =
    cycle2uStart >= 0 && cycle2sStart > cycle2uStart
      ? workflow.slice(cycle2uStart, cycle2sStart)
      : "";
  if (
    cycle2vSection === "" ||
    !cycle2vSection.includes(`baseline="${cycle2vBaselineRevision}"`) ||
    JSON.stringify(doubleQuotedShellArray(cycle2vSection, "protected")) !==
      JSON.stringify(cycle2vProtectedPaths) ||
    JSON.stringify(doubleQuotedShellArray(cycle2vSection, "expected")) !==
      JSON.stringify(
        cycle2vTransition.flatMap(({ path, status }) => [status, path]),
      ) ||
    !cycle2vSection.includes(
      'git diff --name-status --no-renames -z "$baseline" HEAD --',
    ) ||
    !cycle2vSection.includes('[[ "$head_revision" == "$GITHUB_SHA" ]]') ||
    !cycle2vSection.includes('[[ "$successor_count" == "1" ]]') ||
    !cycle2vSection.includes('[[ "$first_parent_count" == "1" ]]') ||
    !cycle2vSection.includes('[[ "${#topology[@]}" == "2" ]]') ||
    !cycle2vSection.includes('[[ "${topology[0]}" == "$GITHUB_SHA" ]]') ||
    !cycle2vSection.includes('[[ "${topology[1]}" == "$baseline" ]]') ||
    !cycle2vSection.includes("matches_exactly expected actual") ||
    !cycle2vSection.includes(
      'if [[ "$required" == "true" && "$exact" != "true" ]]; then',
    )
  )
    found.push(
      `${workflowPath}: exact fail-closed Cycle 2v baseline, protected set, full tuple, and 1/1 topology are required before Cycle 2u`,
    );
  const cycle2sSection =
    cycle2sStart >= 0 && cycle2rStart > cycle2sStart
      ? workflow.slice(cycle2sStart, cycle2rStart)
      : "";
  if (
    cycle2uSection === "" ||
    !cycle2uSection.includes(`baseline="${cycle2uBaselineRevision}"`) ||
    JSON.stringify(doubleQuotedShellArray(cycle2uSection, "protected")) !==
      JSON.stringify(cycle2uProtectedPaths) ||
    JSON.stringify(doubleQuotedShellArray(cycle2uSection, "expected")) !==
      JSON.stringify(
        cycle2uTransition.flatMap(({ path, status }) => [status, path]),
      ) ||
    !cycle2uSection.includes(
      'git diff --name-status --no-renames -z "$baseline" HEAD --',
    ) ||
    !cycle2uSection.includes('[[ "$head_revision" == "$GITHUB_SHA" ]]') ||
    !cycle2uSection.includes('[[ "$successor_count" == "1" ]]') ||
    !cycle2uSection.includes('[[ "$first_parent_count" == "1" ]]') ||
    !cycle2uSection.includes('[[ "${#topology[@]}" == "2" ]]') ||
    !cycle2uSection.includes('[[ "${topology[0]}" == "$GITHUB_SHA" ]]') ||
    !cycle2uSection.includes('[[ "${topology[1]}" == "$baseline" ]]') ||
    !cycle2uSection.includes("matches_exactly expected actual") ||
    !cycle2uSection.includes(
      'if [[ "$required" == "true" && "$exact" != "true" ]]; then',
    )
  )
    found.push(
      `${workflowPath}: exact fail-closed Cycle 2u baseline, protected set, full tuple, and 1/1 topology are required before Cycle 2s`,
    );
  const cycle2rSection =
    cycle2rStart >= 0 && cycle2qStart > cycle2rStart
      ? workflow.slice(cycle2rStart, cycle2qStart)
      : "";
  const cycle2qSection =
    cycle2qStart >= 0 && cycle2pStart > cycle2qStart
      ? workflow.slice(cycle2qStart, cycle2pStart)
      : "";
  if (
    cycle2sSection === "" ||
    !cycle2sSection.includes(`baseline="${cycle2sBaselineRevision}"`) ||
    JSON.stringify(doubleQuotedShellArray(cycle2sSection, "protected")) !==
      JSON.stringify(cycle2sProtectedPaths) ||
    JSON.stringify(doubleQuotedShellArray(cycle2sSection, "expected")) !==
      JSON.stringify(
        cycle2sTransition.flatMap(({ path, status }) => [status, path]),
      ) ||
    !cycle2sSection.includes(
      'git diff --name-status --no-renames -z "$baseline" HEAD --',
    ) ||
    !cycle2sSection.includes('[[ "$head_revision" == "$GITHUB_SHA" ]]') ||
    !cycle2sSection.includes('[[ "$successor_count" == "1" ]]') ||
    !cycle2sSection.includes('[[ "$first_parent_count" == "1" ]]') ||
    !cycle2sSection.includes('[[ "${#topology[@]}" == "2" ]]') ||
    !cycle2sSection.includes('[[ "${topology[0]}" == "$GITHUB_SHA" ]]') ||
    !cycle2sSection.includes('[[ "${topology[1]}" == "$baseline" ]]') ||
    !cycle2sSection.includes("matches_exactly expected actual") ||
    !cycle2sSection.includes(
      'if [[ "$required" == "true" && "$exact" != "true" ]]; then',
    )
  )
    found.push(
      `${workflowPath}: exact fail-closed Cycle 2s baseline, protected set, full tuple, and 1/1 topology are required before Cycle 2r`,
    );
  if (
    cycle2rSection === "" ||
    !cycle2rSection.includes(`baseline="${cycle2rBaselineRevision}"`) ||
    JSON.stringify(doubleQuotedShellArray(cycle2rSection, "protected")) !==
      JSON.stringify(cycle2rProtectedPaths) ||
    JSON.stringify(doubleQuotedShellArray(cycle2rSection, "expected")) !==
      JSON.stringify(
        cycle2rTransition.flatMap(({ path, status }) => [status, path]),
      ) ||
    !cycle2rSection.includes(
      'git diff --name-status --no-renames -z "$baseline" HEAD --',
    ) ||
    !cycle2rSection.includes('[[ "$head_revision" == "$GITHUB_SHA" ]]') ||
    !cycle2rSection.includes('[[ "$successor_count" == "1" ]]') ||
    !cycle2rSection.includes('[[ "$first_parent_count" == "1" ]]') ||
    !cycle2rSection.includes('[[ "${#topology[@]}" == "2" ]]') ||
    !cycle2rSection.includes('[[ "${topology[0]}" == "$GITHUB_SHA" ]]') ||
    !cycle2rSection.includes('[[ "${topology[1]}" == "$baseline" ]]') ||
    !cycle2rSection.includes("matches_exactly expected actual") ||
    !cycle2rSection.includes(
      'if [[ "$required" == "true" && "$exact" != "true" ]]; then',
    )
  )
    found.push(
      `${workflowPath}: exact fail-closed Cycle 2r baseline, protected set, full tuple, and 1/1 topology are required before Cycle 2q`,
    );
  if (
    cycle2qSection === "" ||
    !cycle2qSection.includes(`baseline="${cycle2qBaselineRevision}"`) ||
    JSON.stringify(doubleQuotedShellArray(cycle2qSection, "protected")) !==
      JSON.stringify(cycle2qProtectedPaths) ||
    JSON.stringify(doubleQuotedShellArray(cycle2qSection, "expected")) !==
      JSON.stringify(
        cycle2qTransition.flatMap(({ path, status }) => [status, path]),
      ) ||
    !cycle2qSection.includes(
      'git diff --name-status --no-renames -z "$baseline" HEAD --',
    ) ||
    !cycle2qSection.includes('[[ "$successor_count" == "1" ]]') ||
    !cycle2qSection.includes('[[ "$first_parent_count" == "1" ]]') ||
    !cycle2qSection.includes('[[ "${#topology[@]}" == "2" ]]') ||
    !cycle2qSection.includes('[[ "${topology[1]}" == "$baseline" ]]') ||
    !cycle2qSection.includes("matches_exactly expected actual") ||
    !cycle2qSection.includes(
      'if [[ "$required" == "true" && "$exact" != "true" ]]; then',
    )
  )
    found.push(
      `${workflowPath}: exact fail-closed Cycle 2q baseline, protected set, full tuple, and 1/1 topology are required before Cycle 2p`,
    );

  for (const classifier of [
    "cycle2w_source",
    "cycle2v_source",
    "cycle2u_source",
    "cycle2s_source",
    "cycle2r_source",
    "cycle2q_source",
    "cycle2p_source",
    "cycle2o_source",
    "admission_validity_bridge",
    "cycle2n_source",
    "legacy_bridge",
  ]) {
    const start = workflow.indexOf(`        id: ${classifier}`);
    const shell = start >= 0 ? workflow.indexOf("        shell:", start) : -1;
    const prelude =
      start >= 0 && shell > start ? workflow.slice(start, shell) : "";
    if (!prelude.includes("steps.cycle2x_source.outputs.exact != 'true'"))
      found.push(
        `${workflowPath}: inherited classifier ${classifier} must exclude exact Cycle 2x`,
      );
  }

  for (const classifier of [
    "cycle2v_source",
    "cycle2u_source",
    "cycle2s_source",
    "cycle2r_source",
    "cycle2q_source",
    "cycle2p_source",
    "cycle2o_source",
    "admission_validity_bridge",
    "cycle2n_source",
    "legacy_bridge",
  ]) {
    const start = workflow.indexOf(`        id: ${classifier}`);
    const shell = start >= 0 ? workflow.indexOf("        shell:", start) : -1;
    const prelude =
      start >= 0 && shell > start ? workflow.slice(start, shell) : "";
    if (!prelude.includes("steps.cycle2w_source.outputs.exact != 'true'"))
      found.push(
        `${workflowPath}: inherited classifier ${classifier} must exclude exact Cycle 2w`,
      );
  }

  for (const classifier of [
    "cycle2p_source",
    "cycle2o_source",
    "admission_validity_bridge",
    "cycle2n_source",
    "legacy_bridge",
  ]) {
    const start = workflow.indexOf(`        id: ${classifier}`);
    const shell = start >= 0 ? workflow.indexOf("        shell:", start) : -1;
    const prelude =
      start >= 0 && shell > start ? workflow.slice(start, shell) : "";
    if (!prelude.includes("steps.cycle2q_source.outputs.exact != 'true'"))
      found.push(
        `${workflowPath}: inherited classifier ${classifier} must exclude exact Cycle 2q`,
      );
  }
  for (const classifier of [
    "cycle2u_source",
    "cycle2s_source",
    "cycle2r_source",
    "cycle2q_source",
    "cycle2p_source",
    "cycle2o_source",
    "admission_validity_bridge",
    "cycle2n_source",
    "legacy_bridge",
  ]) {
    const start = workflow.indexOf(`        id: ${classifier}`);
    const shell = start >= 0 ? workflow.indexOf("        shell:", start) : -1;
    const prelude =
      start >= 0 && shell > start ? workflow.slice(start, shell) : "";
    if (!prelude.includes("steps.cycle2v_source.outputs.exact != 'true'"))
      found.push(
        `${workflowPath}: inherited classifier ${classifier} must exclude exact Cycle 2v`,
      );
  }
  for (const classifier of [
    "cycle2s_source",
    "cycle2r_source",
    "cycle2q_source",
    "cycle2p_source",
    "cycle2o_source",
    "admission_validity_bridge",
    "cycle2n_source",
    "legacy_bridge",
  ]) {
    const start = workflow.indexOf(`        id: ${classifier}`);
    const shell = start >= 0 ? workflow.indexOf("        shell:", start) : -1;
    const prelude =
      start >= 0 && shell > start ? workflow.slice(start, shell) : "";
    if (!prelude.includes("steps.cycle2u_source.outputs.exact != 'true'"))
      found.push(
        `${workflowPath}: inherited classifier ${classifier} must exclude exact Cycle 2u`,
      );
  }
  for (const classifier of [
    "cycle2q_source",
    "cycle2p_source",
    "cycle2o_source",
    "admission_validity_bridge",
    "cycle2n_source",
    "legacy_bridge",
  ]) {
    const start = workflow.indexOf(`        id: ${classifier}`);
    const shell = start >= 0 ? workflow.indexOf("        shell:", start) : -1;
    const prelude =
      start >= 0 && shell > start ? workflow.slice(start, shell) : "";
    if (!prelude.includes("steps.cycle2r_source.outputs.exact != 'true'"))
      found.push(
        `${workflowPath}: inherited classifier ${classifier} must exclude exact Cycle 2r`,
      );
  }
  for (const classifier of [
    "cycle2r_source",
    "cycle2q_source",
    "cycle2p_source",
    "cycle2o_source",
    "admission_validity_bridge",
    "cycle2n_source",
    "legacy_bridge",
  ]) {
    const start = workflow.indexOf(`        id: ${classifier}`);
    const shell = start >= 0 ? workflow.indexOf("        shell:", start) : -1;
    const prelude =
      start >= 0 && shell > start ? workflow.slice(start, shell) : "";
    if (!prelude.includes("steps.cycle2s_source.outputs.exact != 'true'"))
      found.push(
        `${workflowPath}: inherited classifier ${classifier} must exclude exact Cycle 2s`,
      );
  }
  for (const required of [
    "      - packages/personal-filing-corpus/**",
    `pnpm --filter ${personalFilingCorpusModule} typecheck`,
    `pnpm --filter ${personalFilingCorpusModule} test`,
    'test ! -e "$RUNNER_TEMP/research-cockpit-filing-parser-cross-engine-execution-v1.json"',
    'test ! -e "$RUNNER_TEMP/research-cockpit-filing-parser-cross-engine-execution-v5.json"',
    'if [[ "${{ steps.cycle2x_source.outputs.exact }}" == "true" ]]; then',
    "Cycle 2x is a personal local quality-measurement route only.",
    'if [[ "${{ steps.cycle2w_source.outputs.exact }}" == "true" ]]; then',
    "Cycle 2w is a personal local raw fact-extraction route only.",
    'if [[ "${{ steps.cycle2v_source.outputs.exact }}" == "true" ]]; then',
    "Cycle 2v is a personal local fact-comparison route only.",
    'if [[ "${{ steps.cycle2u_source.outputs.exact }}" == "true" ]]; then',
    "Cycle 2u is a personal local fact-normalization route only.",
    'if [[ "${{ steps.cycle2s_source.outputs.exact }}" == "true" ]]; then',
    "Cycle 2s is a personal local payload-custody route only.",
    'if [[ "${{ steps.cycle2r_source.outputs.exact }}" == "true" ]]; then',
    "Cycle 2r is a personal local payload-identity route only.",
    'if [[ "${{ steps.cycle2q_source.outputs.exact }}" == "true" ]]; then',
    "Cycle 2q is a personal-use profile route only.",
    "if: ${{ success() && steps.cycle2o_source.outputs.exact == 'true' }}",
  ])
    if (!workflow.includes(required))
      found.push(
        `${workflowPath}: missing exact Cycle 2q/2r/2s/2u/2v/2w/2x no-evidence control ${required}`,
      );

  for (const path of [
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  ]) {
    const verifier = await cycle2kText(path, found);
    for (const required of [
      cycle2xBaselineRevision,
      cycle2xSourceRevision,
      cycle2xValidatorIsolationRevision,
      cycle2wSourceRevision,
      "CYCLE_2X_SOURCE_TRANSITION",
      "CYCLE_2X_VALIDATOR_ISOLATION_TRANSITION",
      "CYCLE_2X_ROUTING_CLOSURE_TRANSITION",
      "CYCLE_2X_CORRECTIVE_CUMULATIVE_TRANSITION",
      "CYCLE_2X_PROTECTED_SURFACE_PATHS",
      "isCycle2xDirectChildAllowed",
      "isCycle2xCommitDiffSetAllowed",
      "isCycle2xCorrectiveChainAllowed",
      "isCycle2xValidatorIsolationCommitDiffSetAllowed",
      "isCycle2xRoutingClosureCommitDiffSetAllowed",
      "isCycle2xCorrectiveCumulativeDiffSetAllowed",
      "isCycle2xTransitionRoutingRequired",
      "await verifyCycle2xTransition(repositoryPath, revision)",
      "!cycle2xRoutingRequired &&",
      "await verifyCycle2wTransition(repositoryPath, CYCLE_2W_SOURCE_REVISION)",
      cycle2wBaselineRevision,
      "76bd8a1319d6b5feb05da412ca30fe6507c5bdbb",
      "CYCLE_2W_SOURCE_TRANSITION",
      "CYCLE_2W_PROTECTED_SURFACE_PATHS",
      "isCycle2wDirectChildAllowed",
      "isCycle2wCommitDiffSetAllowed",
      "isCycle2wTransitionRoutingRequired",
      "await verifyCycle2wTransition(repositoryPath, revision)",
      "!cycle2wRoutingRequired &&",
      "await verifyCycle2vTransition(repositoryPath, CYCLE_2V_SOURCE_REVISION)",
      cycle2vBaselineRevision,
      cycle2uSourceRevision,
      "CYCLE_2V_SOURCE_TRANSITION",
      "CYCLE_2V_PROTECTED_SURFACE_PATHS",
      "isCycle2vDirectChildAllowed",
      "isCycle2vCommitDiffSetAllowed",
      "isCycle2vTransitionRoutingRequired",
      "await verifyCycle2vTransition(repositoryPath, revision)",
      "!cycle2vRoutingRequired &&",
      "await verifyCycle2uTransition(repositoryPath, CYCLE_2U_SOURCE_REVISION)",
      cycle2uBaselineRevision,
      cycle2sSourceRevision,
      "CYCLE_2U_SOURCE_TRANSITION",
      "CYCLE_2U_PROTECTED_SURFACE_PATHS",
      "isCycle2uDirectChildAllowed",
      "isCycle2uCommitDiffSetAllowed",
      "isCycle2uTransitionRoutingRequired",
      "await verifyCycle2uTransition(repositoryPath, revision)",
      "!cycle2uRoutingRequired &&",
      "await verifyCycle2sTransition(repositoryPath, CYCLE_2S_SOURCE_REVISION)",
      cycle2sBaselineRevision,
      cycle2rSourceRevision,
      cycle2rBaselineRevision,
      cycle2qSourceRevision,
      cycle2qBaselineRevision,
      cycle2qCorpusAdmissionBlob,
      "CYCLE_2S_SOURCE_TRANSITION",
      "CYCLE_2S_PROTECTED_SURFACE_PATHS",
      "isCycle2sDirectChildAllowed",
      "isCycle2sCommitDiffSetAllowed",
      "isCycle2sTransitionRoutingRequired",
      "await verifyCycle2sTransition(repositoryPath, revision)",
      "!cycle2sRoutingRequired &&",
      "await verifyCycle2rTransition(repositoryPath, CYCLE_2R_SOURCE_REVISION)",
      "CYCLE_2R_SOURCE_TRANSITION",
      "CYCLE_2R_PROTECTED_SURFACE_PATHS",
      "isCycle2rDirectChildAllowed",
      "isCycle2rCommitDiffSetAllowed",
      "isCycle2rTransitionRoutingRequired",
      "await verifyCycle2rTransition(repositoryPath, revision)",
      "!cycle2rRoutingRequired &&",
      "await verifyCycle2qTransition(repositoryPath, CYCLE_2Q_SOURCE_REVISION)",
      "CYCLE_2Q_SOURCE_TRANSITION",
      "CYCLE_2Q_PROTECTED_SURFACE_PATHS",
      "isCycle2qDirectChildAllowed",
      "isCycle2qCommitDiffSetAllowed",
      "isCycle2qTransitionRoutingRequired",
      "await verifyCycle2qTransition(repositoryPath, revision)",
      "CYCLE_2P_CORRECTIVE_REVISION",
    ])
      if (!verifier.includes(required))
        found.push(
          `${path}: missing exact Cycle 2q/2r/2s/2u/2v/2w/2x routing control ${required}`,
        );
    for (const { path: transitionPath } of cycle2xTransition)
      if (!verifier.includes(transitionPath))
        found.push(
          `${path}: missing Cycle 2x transition path ${transitionPath}`,
        );
    for (const { path: transitionPath } of cycle2xValidatorIsolationTransition)
      if (!verifier.includes(transitionPath))
        found.push(
          `${path}: missing Cycle 2x validator-isolation transition path ${transitionPath}`,
        );
    for (const { path: transitionPath } of cycle2xRoutingClosureTransition)
      if (!verifier.includes(transitionPath))
        found.push(
          `${path}: missing Cycle 2x routing-closure transition path ${transitionPath}`,
        );
    const cycle2xVerifierStart = verifier.indexOf(
      "async function verifyCycle2xTransition(",
    );
    const cycle2wVerifierStart = verifier.indexOf(
      "async function verifyCycle2wTransition(",
      cycle2xVerifierStart,
    );
    const cycle2xVerifierSection =
      cycle2xVerifierStart >= 0 && cycle2wVerifierStart > cycle2xVerifierStart
        ? verifier
            .slice(cycle2xVerifierStart, cycle2wVerifierStart)
            .replace(/\s+/gu, " ")
        : "";
    const cycle2xVerifierOrder = [
      "revision === CYCLE_2X_SOURCE_REVISION",
      "const correctiveChain = isCycle2xCorrectiveChainAllowed(",
      "if (!directSource && !correctiveChain)",
      "if (directSource) {",
      "isCycle2xCommitDiffSetAllowed(entries)",
      "cycle2pDiffEntries( repositoryPath, CYCLE_2X_BASELINE_REVISION, CYCLE_2X_SOURCE_REVISION, )",
      "cycle2pDiffEntries( repositoryPath, CYCLE_2X_SOURCE_REVISION, CYCLE_2X_VALIDATOR_ISOLATION_REVISION, )",
      "cycle2pDiffEntries( repositoryPath, CYCLE_2X_VALIDATOR_ISOLATION_REVISION, revision, )",
      "cycle2pDiffEntries(repositoryPath, CYCLE_2X_BASELINE_REVISION, revision)",
      "isCycle2xCommitDiffSetAllowed(sourceEntries)",
      "isCycle2xValidatorIsolationCommitDiffSetAllowed( validatorIsolationEntries, )",
      "isCycle2xRoutingClosureCommitDiffSetAllowed(routingClosureEntries)",
      "isCycle2xCorrectiveCumulativeDiffSetAllowed(cumulativeEntries)",
      "await verifyCycle2wTransition(repositoryPath, CYCLE_2W_SOURCE_REVISION)",
    ].map((required) => cycle2xVerifierSection.indexOf(required));
    if (
      cycle2xVerifierSection === "" ||
      cycle2xVerifierOrder.some((index) => index < 0) ||
      cycle2xVerifierOrder.some(
        (index, position) =>
          position > 0 && index <= cycle2xVerifierOrder[position - 1]!,
      )
    )
      found.push(
        `${path}: Cycle 2x verifier must preserve the exact source pin, corrective chain, four diff ranges, four validations, and inherited Cycle 2w verification in order`,
      );
    for (const { path: transitionPath } of cycle2wTransition)
      if (!verifier.includes(transitionPath))
        found.push(
          `${path}: missing Cycle 2w transition path ${transitionPath}`,
        );
    for (const { path: transitionPath } of cycle2vTransition)
      if (!verifier.includes(transitionPath))
        found.push(
          `${path}: missing Cycle 2v transition path ${transitionPath}`,
        );
    for (const { path: transitionPath } of cycle2uTransition)
      if (!verifier.includes(transitionPath))
        found.push(
          `${path}: missing Cycle 2u transition path ${transitionPath}`,
        );
    for (const { path: transitionPath } of cycle2sTransition)
      if (!verifier.includes(transitionPath))
        found.push(
          `${path}: missing Cycle 2s transition path ${transitionPath}`,
        );
    for (const { path: transitionPath } of cycle2rTransition)
      if (!verifier.includes(transitionPath))
        found.push(
          `${path}: missing Cycle 2r transition path ${transitionPath}`,
        );
    for (const { path: transitionPath } of cycle2qTransition)
      if (!verifier.includes(transitionPath))
        found.push(
          `${path}: missing Cycle 2q transition path ${transitionPath}`,
        );
    const cycle2xRoute = verifier.indexOf("if (cycle2xRoutingRequired) {");
    const cycle2wRoute = verifier.indexOf(
      "else if (cycle2wRoutingRequired) {",
      cycle2xRoute,
    );
    const cycle2vRoute = verifier.indexOf(
      "else if (cycle2vRoutingRequired) {",
      cycle2wRoute,
    );
    const cycle2uRoute = verifier.indexOf(
      "else if (cycle2uRoutingRequired) {",
      cycle2vRoute,
    );
    const cycle2sRoute = verifier.indexOf(
      "else if (cycle2sRoutingRequired) {",
      cycle2uRoute,
    );
    const cycle2rRoute = verifier.indexOf(
      "if (cycle2rRoutingRequired)",
      cycle2sRoute,
    );
    const cycle2qRoute = verifier.indexOf(
      "if (cycle2qRoutingRequired)",
      cycle2rRoute,
    );
    const inheritedRoute = verifier.indexOf(
      "else if (isCycle2pTransitionRoutingRequired",
      cycle2qRoute,
    );
    if (
      cycle2xRoute < 0 ||
      cycle2wRoute <= cycle2xRoute ||
      cycle2vRoute <= cycle2wRoute ||
      cycle2uRoute <= cycle2vRoute ||
      cycle2sRoute <= cycle2uRoute ||
      cycle2rRoute <= cycle2sRoute ||
      cycle2qRoute <= cycle2rRoute ||
      inheritedRoute <= cycle2qRoute
    )
      found.push(
        `${path}: Cycle 2x must route before Cycle 2w, Cycle 2v, Cycle 2u, Cycle 2s, Cycle 2r, Cycle 2q, and Cycle 2p`,
      );
  }
  for (const path of [
    "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  ]) {
    const test = await cycle2kText(path, found);
    for (const required of [
      'describe("Cycle 2x personal quality-measurement routing"',
      "isCycle2xBaselineMergeBaseAllowed",
      "isCycle2xDirectChildAllowed",
      "isCycle2xCommitDiffSetAllowed",
      "isCycle2xCorrectiveChainAllowed",
      "isCycle2xValidatorIsolationCommitDiffSetAllowed",
      "isCycle2xRoutingClosureCommitDiffSetAllowed",
      "isCycle2xCorrectiveCumulativeDiffSetAllowed",
      "isCycle2xTransitionRoutingRequired",
      'describe("Cycle 2w personal raw fact-extraction routing"',
      "isCycle2wBaselineMergeBaseAllowed",
      "isCycle2wDirectChildAllowed",
      "isCycle2wCommitDiffSetAllowed",
      "isCycle2wTransitionRoutingRequired",
      'describe("Cycle 2v personal fact-comparison routing"',
      "isCycle2vBaselineMergeBaseAllowed",
      "isCycle2vDirectChildAllowed",
      "isCycle2vCommitDiffSetAllowed",
      "isCycle2vTransitionRoutingRequired",
      'describe("Cycle 2u personal fact-normalization routing"',
      "isCycle2uBaselineMergeBaseAllowed",
      "isCycle2uDirectChildAllowed",
      "isCycle2uCommitDiffSetAllowed",
      "isCycle2uTransitionRoutingRequired",
      'describe("Cycle 2s personal payload-custody routing"',
      "isCycle2sBaselineMergeBaseAllowed",
      "isCycle2sDirectChildAllowed",
      "isCycle2sCommitDiffSetAllowed",
      "isCycle2sTransitionRoutingRequired",
      'describe("Cycle 2r personal payload-identity routing"',
      "isCycle2rBaselineMergeBaseAllowed",
      "isCycle2rDirectChildAllowed",
      "isCycle2rCommitDiffSetAllowed",
      "isCycle2rTransitionRoutingRequired",
      'describe("Cycle 2q personal-use profile routing"',
      "isCycle2qBaselineMergeBaseAllowed",
      "isCycle2qDirectChildAllowed",
      "isCycle2qCommitDiffSetAllowed",
      "isCycle2qTransitionRoutingRequired",
    ])
      if (!test.includes(required))
        found.push(
          `${path}: missing Cycle 2q/2r/2s/2u/2v/2w/2x regression ${required}`,
        );
  }

  if (
    JSON.stringify(doubleQuotedShellArray('x=(\n  "a"\n  "b"\n)', "x")) !==
      JSON.stringify(["a", "b"]) ||
    doubleQuotedShellArray('x=(\n  "b" extra\n)', "x") !== null
  )
    throw new Error("Cycle 2q shell-array classifier regressed");
  return found;
}

async function filingParserCrossEngineExecutionBoundaryViolations(): Promise<
  string[]
> {
  const found: string[] = [];
  if (
    !cycle2kExactTree(
      filingParserCrossEngineExecutionCorePaths,
      filingParserCrossEngineExecutionCorePaths,
    ) ||
    cycle2kExactTree(
      filingParserCrossEngineExecutionCorePaths.slice(1),
      filingParserCrossEngineExecutionCorePaths,
    ) ||
    cycle2kExactTree(
      [...filingParserCrossEngineExecutionCorePaths, "loader.ts"],
      filingParserCrossEngineExecutionCorePaths,
    )
  )
    throw new Error("Cycle 2k exact-tree classifier regressed");
  const listed = [...filesToInspect]
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .filter(
      (path) =>
        path.startsWith(filingParserCrossEngineExecutionPackagePrefix) ||
        path.startsWith(
          filingParserCrossEngineExecutionAcceptancePackagePrefix,
        ),
    );
  const core = listed
    .filter((path) =>
      path.startsWith(filingParserCrossEngineExecutionPackagePrefix),
    )
    .sort();
  const acceptance = listed
    .filter((path) =>
      path.startsWith(filingParserCrossEngineExecutionAcceptancePackagePrefix),
    )
    .sort();
  if (!cycle2kExactTree(core, filingParserCrossEngineExecutionCorePaths))
    found.push(
      `${filingParserCrossEngineExecutionPackagePrefix}: Cycle 2k core tree must remain exact`,
    );
  if (
    !cycle2kExactTree(
      acceptance,
      filingParserCrossEngineExecutionAcceptancePaths,
    )
  )
    found.push(
      `${filingParserCrossEngineExecutionAcceptancePackagePrefix}: Cycle 2k acceptance tree must remain exact`,
    );

  const coreManifest = await cycle2kJson(
    `${filingParserCrossEngineExecutionPackagePrefix}package.json`,
    found,
  );
  const expectedCoreManifest = {
    name: filingParserCrossEngineExecutionModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run src && node --test worker/parser.test.mjs",
      "test:worker": "node --test worker/parser.test.mjs",
    },
    dependencies: {
      [filingParserNormalizationExecutionModule]: "workspace:*",
    },
  };
  if (JSON.stringify(coreManifest) !== JSON.stringify(expectedCoreManifest))
    found.push("Cycle 2k core manifest must remain exact");
  const acceptanceManifest = await cycle2kJson(
    `${filingParserCrossEngineExecutionAcceptancePackagePrefix}package.json`,
    found,
  );
  const expectedAcceptanceManifest = {
    name: filingParserCrossEngineExecutionAcceptanceModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
    dependencies: {
      [filingParserCrossEngineExecutionModule]: "workspace:*",
      [filingParserCustodyQualityCompositionModule]: "workspace:*",
      [filingParserQualityCompositionModule]: "workspace:*",
      [filingParserNormalizationExecutionModule]: "workspace:*",
    },
  };
  if (
    JSON.stringify(acceptanceManifest) !==
    JSON.stringify(expectedAcceptanceManifest)
  )
    found.push("Cycle 2k acceptance manifest must remain exact");
  const expectedCoreTsconfig = {
    extends: "../../tsconfig.base.json",
    compilerOptions: { allowJs: true, noEmit: true, types: ["node"] },
    include: ["src/**/*.ts", "worker/*.mjs"],
  };
  const coreTsconfig = await cycle2kJson(
    `${filingParserCrossEngineExecutionPackagePrefix}tsconfig.json`,
    found,
  );
  if (JSON.stringify(coreTsconfig) !== JSON.stringify(expectedCoreTsconfig))
    found.push(
      `${filingParserCrossEngineExecutionPackagePrefix}tsconfig.json: Cycle 2k tsconfig must remain exact`,
    );
  const expectedAcceptanceTsconfig = {
    extends: "../../tsconfig.base.json",
    compilerOptions: { noEmit: true, types: ["node"] },
    include: ["src/**/*.ts"],
  };
  const acceptanceTsconfig = await cycle2kJson(
    `${filingParserCrossEngineExecutionAcceptancePackagePrefix}tsconfig.json`,
    found,
  );
  if (
    JSON.stringify(acceptanceTsconfig) !==
    JSON.stringify(expectedAcceptanceTsconfig)
  )
    found.push(
      `${filingParserCrossEngineExecutionAcceptancePackagePrefix}tsconfig.json: Cycle 2k tsconfig must remain exact`,
    );

  const allowedCoreModules = new Set([
    "node:child_process",
    "node:crypto",
    "node:util",
    "vitest",
    filingParserNormalizationExecutionModule,
    `${filingParserNormalizationExecutionModule}/test`,
    "./filing-parser-cross-engine-direct-execution",
    "./filing-parser-cross-engine-execution",
    "./index",
    "./test-cross-engine-execution-builder",
  ]);
  const coreIndexPath = `${filingParserCrossEngineExecutionPackagePrefix}src/index.ts`;
  const coreIndex = ts.createSourceFile(
    coreIndexPath,
    await cycle2kText(coreIndexPath, found),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (
    coreIndex.statements.length !== 2 ||
    !isExactNamedReExportDeclaration(
      coreIndex.statements[0],
      "./filing-parser-cross-engine-execution",
      filingParserCrossEngineExecutionPublicExports,
    ) ||
    !isExactNamedReExportDeclaration(
      coreIndex.statements[1],
      "./filing-parser-cross-engine-direct-execution",
      filingParserCrossEngineDirectExecutionPublicExports,
    )
  )
    found.push("Cycle 2k core public export surface must remain exact");
  const acceptanceModulesByPath = new Map<string, readonly string[]>([
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}filing-parser-cross-engine-execution-evidence-review.test.ts`,
      [
        "vitest",
        "./filing-parser-cross-engine-execution-evidence",
        "./filing-parser-cross-engine-execution-evidence-review",
      ],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}filing-parser-cross-engine-execution-evidence-review.ts`,
      [
        "./filing-parser-cross-engine-execution-evidence-verifier",
        "./filing-parser-cross-engine-execution-evidence",
        "./filing-parser-cross-engine-execution-evidence-v5",
      ],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}filing-parser-cross-engine-execution-evidence-v5.test.ts`,
      [
        "node:crypto",
        "vitest",
        filingParserCustodyQualityCompositionModule,
        "./filing-parser-cross-engine-execution-evidence-v5",
        "./test-filing-parser-cross-engine-execution-evidence-builder",
      ],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}filing-parser-cross-engine-execution-evidence-v5.ts`,
      [
        "node:crypto",
        "node:util",
        filingParserCustodyQualityCompositionModule,
        "./filing-parser-cross-engine-execution-evidence",
      ],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}filing-parser-cross-engine-execution-evidence-verifier-v5.test.ts`,
      [
        "vitest",
        "./filing-parser-cross-engine-execution-evidence-verifier",
        "./filing-parser-cross-engine-execution-evidence-v5",
      ],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}filing-parser-cross-engine-execution-evidence-verifier-v5.ts`,
      [
        "./filing-parser-cross-engine-execution-evidence",
        "./filing-parser-cross-engine-execution-evidence-v5",
      ],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}filing-parser-cross-engine-execution-evidence-verifier.test.ts`,
      [
        "node:child_process",
        "node:crypto",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:url",
        "vitest",
        "./filing-parser-cross-engine-execution-evidence",
        "./filing-parser-cross-engine-execution-evidence-verifier",
        "./test-filing-parser-cross-engine-execution-evidence-builder",
      ],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}filing-parser-cross-engine-execution-evidence-verifier.ts`,
      [
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:path",
        "node:util",
        "./filing-parser-cross-engine-execution-evidence",
        "./filing-parser-cross-engine-execution-evidence-verifier-v5",
        "./filing-parser-cross-engine-execution-evidence-v5",
      ],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}filing-parser-cross-engine-execution-evidence.test.ts`,
      [
        "node:crypto",
        "vitest",
        filingParserCrossEngineExecutionModule,
        "./filing-parser-cross-engine-execution-evidence",
        "./test-filing-parser-cross-engine-execution-evidence-builder",
      ],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}filing-parser-cross-engine-execution-evidence.ts`,
      ["node:crypto"],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}index.ts`,
      [
        "./filing-parser-cross-engine-execution-evidence",
        "./filing-parser-cross-engine-execution-evidence-v5",
        "./filing-parser-cross-engine-execution-evidence-verifier",
      ],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}run-filing-parser-cross-engine-execution-acceptance.test.ts`,
      [
        "node:fs",
        "node:url",
        "vitest",
        "./filing-parser-cross-engine-execution-evidence",
        "./filing-parser-cross-engine-execution-evidence-v5",
        "./run-filing-parser-cross-engine-execution-acceptance",
      ],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}run-filing-parser-cross-engine-execution-acceptance.ts`,
      [
        "node:child_process",
        "node:crypto",
        "node:fs/promises",
        "node:path",
        "node:url",
        filingParserNormalizationExecutionModule,
        `${filingParserNormalizationExecutionModule}/test`,
        filingParserCustodyQualityCompositionModule,
        "./filing-parser-cross-engine-execution-evidence",
        "./filing-parser-cross-engine-execution-evidence-v5",
        "./test-filing-parser-cross-engine-execution-evidence-builder",
      ],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}run-filing-parser-cross-engine-execution-evidence-review.ts`,
      ["./filing-parser-cross-engine-execution-evidence-review"],
    ],
    [
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}test-filing-parser-cross-engine-execution-evidence-builder.ts`,
      [
        "node:crypto",
        filingParserCustodyQualityCompositionModule,
        "./filing-parser-cross-engine-execution-evidence",
        "./filing-parser-cross-engine-execution-evidence-v5",
      ],
    ],
  ]);
  const acceptanceIndexPath = `${filingParserCrossEngineExecutionAcceptancePackagePrefix}src/index.ts`;
  const acceptanceIndex = ts.createSourceFile(
    acceptanceIndexPath,
    await cycle2kText(acceptanceIndexPath, found),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (
    acceptanceIndex.statements.length !== 3 ||
    !isExactNamedReExportDeclaration(
      acceptanceIndex.statements[0],
      "./filing-parser-cross-engine-execution-evidence",
      filingParserCrossEngineExecutionEvidencePublicExports,
    ) ||
    !isExactNamedReExportDeclaration(
      acceptanceIndex.statements[1],
      "./filing-parser-cross-engine-execution-evidence-v5",
      filingParserCrossEngineExecutionEvidenceV5PublicExports,
    ) ||
    !isExactNamedReExportDeclaration(
      acceptanceIndex.statements[2],
      "./filing-parser-cross-engine-execution-evidence-verifier",
      filingParserCrossEngineExecutionVerifierPublicExports,
    )
  )
    found.push("Cycle 2k acceptance public export surface must remain exact");
  for (const path of [...core, ...acceptance].filter((path) =>
    path.endsWith(".ts"),
  )) {
    const content = await readFile(join(root, path), "utf8");
    const modules = collectModuleSpecifiers(content);
    if (
      path.startsWith(filingParserCrossEngineExecutionAcceptancePackagePrefix)
    ) {
      const expectedModules = acceptanceModulesByPath.get(path);
      if (expectedModules === undefined)
        found.push(`${path}: unclassified Cycle 2k/v5 acceptance source`);
      else if (JSON.stringify(modules) !== JSON.stringify(expectedModules))
        found.push(`${path}: Cycle 2k/v5 acceptance imports must remain exact`);
    } else {
      for (const module of modules)
        if (!allowedCoreModules.has(module))
          found.push(`${path}: unreviewed Cycle 2k import ${module}`);
    }
    if (
      /\b(?:import|require)\s*\(/u.test(content) ||
      /\b(?:eval|Function)\s*\(/u.test(content)
    )
      found.push(`${path}: dynamic loading or evaluation is forbidden`);
  }

  const docker = await cycle2kText(
    `${filingParserCrossEngineExecutionPackagePrefix}worker/Dockerfile`,
    found,
  );
  for (const required of [
    "node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df",
    "COPY --chown=0:0 --chmod=0444 worker/parser.mjs /worker/parser.mjs",
    "COPY --chown=0:0 --chmod=0444 worker/taxonomy-v1.json /worker/taxonomy-v1.json",
    "USER 65532:65532",
    'ENTRYPOINT ["node", "--disable-proto=throw", "/worker/parser.mjs"]',
  ])
    if (!docker.includes(required))
      found.push("Cycle 2k Dockerfile pin regressed");
  if (/^(?:ADD|RUN)\b/mu.test(docker))
    found.push("Cycle 2k Dockerfile must remain zero-install");
  const workerParserPath = `${filingParserCrossEngineExecutionPackagePrefix}worker/parser.mjs`;
  const workerTestPath = `${filingParserCrossEngineExecutionPackagePrefix}worker/parser.test.mjs`;
  const workerTaxonomyPath = `${filingParserCrossEngineExecutionPackagePrefix}worker/taxonomy-v1.json`;
  const workerParser = await cycle2kText(workerParserPath, found);
  const workerTest = await cycle2kText(workerTestPath, found);
  const workerTaxonomy = await cycle2kJson(workerTaxonomyPath, found);
  const workerParserLintDirective =
    "/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- The sealed dependency-free worker is plain JavaScript; exact source guards and adversarial runtime tests cover its untyped protocol boundary. */";
  const workerTestLintDirective =
    "/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- The sealed dependency-free worker test exercises intentionally untyped hostile inputs under exact source guards. */";
  for (const [path, content, directive] of [
    [workerParserPath, workerParser, workerParserLintDirective],
    [workerTestPath, workerTest, workerTestLintDirective],
  ] as const)
    if (
      !content.startsWith(`${directive}\n\n`) ||
      [...content.matchAll(/eslint-(?:disable|enable)/gu)].length !== 1
    )
      found.push(`${path}: exact scoped JavaScript lint directive is required`);
  for (const [path, content] of [
    [workerParserPath, workerParser],
    [workerTestPath, workerTest],
  ] as const) {
    const violation = cycle2kWorkerModuleViolation(path, content);
    if (violation !== null) found.push(`${path}: ${violation}`);
  }
  if (!cycle2kExactTaxonomy(workerTaxonomy))
    found.push(`${workerTaxonomyPath}: exact ordered taxonomy is required`);
  const reviewedWorkerParserImports = [
    'import "node:crypto";',
    'import "node:fs/promises";',
    'import "node:url";',
    'import "node:zlib";',
  ].join("\n");
  const reviewedWorkerTestImports = [
    'import "node:assert/strict";',
    'import "node:fs/promises";',
    'import "node:test";',
    'import "node:zlib";',
    'import "./parser.mjs";',
  ].join("\n");
  if (
    cycle2kWorkerModuleViolation(
      workerParserPath,
      reviewedWorkerParserImports,
    ) !== null ||
    cycle2kWorkerModuleViolation(workerTestPath, reviewedWorkerTestImports) !==
      null ||
    cycle2kWorkerModuleViolation(
      workerParserPath,
      `${reviewedWorkerParserImports}\nimport "node:net";`,
    ) === null ||
    cycle2kWorkerModuleViolation(
      workerParserPath,
      `${reviewedWorkerParserImports}\nvoid import("node:crypto");`,
    ) === null ||
    cycle2kExactTaxonomy({
      ...cycle2kExpectedTaxonomy(),
      facts: [
        ...cycle2kExpectedTaxonomy().facts,
        {
          key: "extra",
          concept: "rc-synthetic:Extra",
          periodKind: "instant",
          unit: "USD",
        },
      ],
    })
  )
    throw new Error("Cycle 2k worker/taxonomy classifier regressed");
  const image = await cycle2kJson(
    `${filingParserCrossEngineExecutionPackagePrefix}acceptance/node-image.json`,
    found,
  );
  if (
    !image ||
    image.indexDigest !==
      "sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df" ||
    image.platformManifestDigest !==
      "sha256:e5a8dee7bc1e6a215d224a7ef8206f7e77271bc3cabd5febf2beafac0674f174" ||
    image.containerPackageLicenseInventoryStatus !==
      "not_proven_ci_acceptance_only"
  )
    found.push("Cycle 2k Node image metadata pin regressed");

  const rootManifest = await cycle2kJson("package.json", found);
  const scripts =
    rootManifest && typeof rootManifest.scripts === "object"
      ? (rootManifest.scripts as Record<string, unknown>)
      : {};
  const expectedScripts = {
    "filing-parser-cross-engine-execution:acceptance":
      "tsx packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.ts",
    "filing-parser-cross-engine-execution:evidence-review":
      "tsx packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-evidence-review.ts",
    "guardrails:filing-parser-cross-engine-execution-fixtures":
      "tsx scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
  };
  for (const [name, command] of Object.entries(expectedScripts))
    if (scripts[name] !== command)
      found.push(`package.json: exact Cycle 2k script ${name} is required`);
  if (
    typeof scripts.guardrails !== "string" ||
    !scripts.guardrails.includes(
      "pnpm guardrails:filing-parser-normalization-execution-fixtures && pnpm guardrails:filing-parser-cross-engine-execution-fixtures && pnpm guardrails:filing-payload-custody-fixtures",
    )
  )
    found.push("package.json: exact Cycle 2k guardrail ordering is required");

  const boundSurfacePaths = [
    "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
    ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  ];
  for (const path of boundSurfacePaths) {
    const content = await cycle2kText(path, found);
    if (!content.includes("filing-parser-cross-engine-execution"))
      found.push(`${path}: Cycle 2k source binding is incomplete`);
  }
  const workflow = await cycle2kText(
    ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    found,
  );
  const cycle2oVerifier = await cycle2kText(
    `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}filing-parser-cross-engine-execution-evidence-verifier.ts`,
    found,
  );
  const cycle2oRunner = await cycle2kText(
    `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}run-filing-parser-cross-engine-execution-acceptance.ts`,
    found,
  );
  const cycle2oTransitionTupleViolation =
    filingParserCycle2oTransitionTupleViolation(
      cycle2oVerifier,
      cycle2oRunner,
      workflow,
    );
  if (cycle2oTransitionTupleViolation !== null)
    found.push(cycle2oTransitionTupleViolation);
  if (
    filingParserCycle2oTransitionTupleViolation(
      cycle2oVerifier.replace("  39 as const;", "  0 as const;"),
      cycle2oRunner,
      workflow,
    ) === null ||
    filingParserCycle2oTransitionTupleViolation(
      cycle2oVerifier,
      cycle2oRunner.replace(
        "const CYCLE_2O_TRANSITION_PATH_COUNT = 39;",
        "const CYCLE_2O_TRANSITION_PATH_COUNT = 0;",
      ),
      workflow,
    ) === null ||
    filingParserCycle2oTransitionTupleViolation(
      cycle2oVerifier.replace(
        "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CORRECTIVE_TRANSITION_PATH_COUNT =\n  14 as const;",
        "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CORRECTIVE_TRANSITION_PATH_COUNT =\n  0 as const;",
      ),
      cycle2oRunner,
      workflow,
    ) === null ||
    filingParserCycle2oTransitionTupleViolation(
      cycle2oVerifier,
      cycle2oRunner.replace(
        "const CYCLE_2O_CORRECTIVE_TRANSITION_PATH_COUNT = 14;",
        "const CYCLE_2O_CORRECTIVE_TRANSITION_PATH_COUNT = 0;",
      ),
      workflow,
    ) === null ||
    filingParserCycle2oTransitionTupleViolation(
      cycle2oVerifier,
      cycle2oRunner,
      workflow.replaceAll(
        "packages/filing-payload-custody/src/parser-archive-pair-custody.ts",
        "packages/filing-payload-custody/src/unreviewed.ts",
      ),
    ) === null ||
    filingParserCycle2oTransitionTupleViolation(
      cycle2oVerifier,
      cycle2oRunner,
      'run: |\n  if git diff --quiet "$baseline" HEAD -- transition-marker; then exact=true; fi\n',
    ) === null
  )
    throw new Error("Cycle 2o transition tuple classifier regressed");
  if (
    !workflow.startsWith(
      "name: Filing parser cross-engine execution acceptance\n\non:\n  workflow_dispatch:\n  push:\n",
    ) ||
    /^\s+pull_request:/mu.test(workflow)
  )
    found.push(
      "Cycle 2k live evidence workflow must remain push/dispatch-only",
    );
  for (const command of [
    "pnpm --filter @research-cockpit/filing-parser-normalization-execution typecheck",
    "pnpm --filter @research-cockpit/filing-parser-normalization-execution test",
    "pnpm --filter @research-cockpit/filing-parser-normalization-execution test:worker",
    "pnpm --filter @research-cockpit/filing-parser-cross-engine-execution typecheck",
    "pnpm --filter @research-cockpit/filing-parser-cross-engine-execution test",
    "pnpm --filter @research-cockpit/filing-parser-cross-engine-execution test:worker",
    "pnpm --filter @research-cockpit/filing-parser-cross-engine-execution-acceptance typecheck",
    "pnpm --filter @research-cockpit/filing-parser-cross-engine-execution-acceptance test",
    "pnpm guardrails:boundaries",
    "pnpm guardrails:filing-parser-cross-engine-execution-fixtures",
    "pnpm filing-parser-cross-engine-execution:acceptance",
    "pnpm filing-parser-cross-engine-execution:evidence-review",
    "if: ${{ success() }}",
  ])
    if (!workflow.includes(command))
      found.push(`Cycle 2k workflow is missing exact command ${command}`);
  const fixtureManifest = await cycle2kJson(
    "fixtures/synthetic/filing-parser-cross-engine-execution/v1/manifest.json",
    found,
  );
  const expectedFixtureSources = [
    "packages/filing-parser-normalization-execution/acceptance/python-image.json",
    "packages/filing-parser-normalization-execution/src/test-filing-parser-normalization-execution-builder.ts",
    "packages/filing-parser-normalization-execution/worker/Dockerfile",
    "packages/filing-parser-normalization-execution/worker/parser.py",
    "packages/filing-parser-normalization-execution/worker/parser_test.py",
    "packages/filing-parser-normalization-execution/worker/taxonomy-v1.json",
    "packages/filing-parser-cross-engine-execution/acceptance/node-image.json",
    "packages/filing-parser-cross-engine-execution/src/test-cross-engine-execution-builder.ts",
    "packages/filing-parser-cross-engine-execution/worker/Dockerfile",
    "packages/filing-parser-cross-engine-execution/worker/parser.mjs",
    "packages/filing-parser-cross-engine-execution/worker/parser.test.mjs",
    "packages/filing-parser-cross-engine-execution/worker/taxonomy-v1.json",
  ];
  const fixturePaths = Array.isArray(fixtureManifest?.files)
    ? fixtureManifest.files.map((entry) =>
        isRecord(entry) ? entry.path : undefined,
      )
    : [];
  if (JSON.stringify(fixturePaths) !== JSON.stringify(expectedFixtureSources))
    found.push("Cycle 2k fixture source inventory must remain exact");

  const externalAllow = new Set([
    ...core,
    ...acceptance,
    ...filingParserQualityCompositionPackagePaths,
    "scripts/verify-boundaries.ts",
    "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
    ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
    "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  ]);
  if (
    cycle2kExternalCompositionViolation(
      `${filingParserCrossEngineExecutionPackagePrefix}src/index.ts`,
      `export {} from ${JSON.stringify(filingParserCrossEngineExecutionModule)};`,
      externalAllow,
    ) ||
    !cycle2kExternalCompositionViolation(
      "apps/api/src/cycle2k.ts",
      `import ${JSON.stringify(filingParserCrossEngineExecutionModule)};`,
      externalAllow,
    ) ||
    !cycle2kExternalCompositionViolation(
      ".github/workflows/unrelated.yml",
      "run: pnpm filing-parser-cross-engine-execution:acceptance",
      externalAllow,
    ) ||
    !cycle2kExternalCompositionViolation(
      "apps/api/src/dynamic.ts",
      `void import(${JSON.stringify(filingParserCrossEngineExecutionModule)});`,
      externalAllow,
    )
  )
    throw new Error("Cycle 2k external-composition classifier regressed");
  for (const file of externalCompositionFilesToInspect) {
    const path = relative(root, file).replaceAll("\\", "/");
    const content = await readFile(file, "utf8");
    if (cycle2kExternalCompositionViolation(path, content, externalAllow))
      found.push(`${path}: external Cycle 2k composition is forbidden`);
  }
  return found;
}

async function filingParserQualityCompositionBoundaryViolations(): Promise<
  string[]
> {
  const found: string[] = [];
  const actualTree = [...filesToInspect]
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .filter((path) =>
      path.startsWith(filingParserQualityCompositionPackagePrefix),
    )
    .sort();
  if (
    JSON.stringify(actualTree) !==
    JSON.stringify(filingParserQualityCompositionPackagePaths)
  )
    found.push(
      `${filingParserQualityCompositionPackagePrefix}: Cycle 2n package tree must remain the exact manifest, tsconfig, core, index, builder, and two tests`,
    );

  const manifestPath = `${filingParserQualityCompositionPackagePrefix}package.json`;
  const manifest = await cycle2kJson(manifestPath, found);
  const expectedManifest = {
    name: filingParserQualityCompositionModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
    dependencies: {
      [filingParserCrossEngineExecutionModule]: "workspace:*",
      [filingQualityMeasurementModule]: "workspace:*",
      [filingQualityPrecommitmentModule]: "workspace:*",
    },
  };
  if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest))
    found.push("Cycle 2n quality-composition manifest must remain exact");

  const tsconfigPath = `${filingParserQualityCompositionPackagePrefix}tsconfig.json`;
  const tsconfig = await cycle2kJson(tsconfigPath, found);
  const expectedTsconfig = {
    extends: "../../tsconfig.base.json",
    compilerOptions: { noEmit: true, types: ["node"] },
    include: ["src/**/*.ts"],
  };
  if (JSON.stringify(tsconfig) !== JSON.stringify(expectedTsconfig))
    found.push("Cycle 2n quality-composition tsconfig must remain exact");

  const allowedModulesByPath = new Map<string, ReadonlySet<string>>([
    [
      filingParserQualityCompositionProductionPath,
      new Set([
        "node:crypto",
        "node:util",
        filingParserCrossEngineExecutionModule,
        filingQualityMeasurementModule,
        filingQualityPrecommitmentModule,
      ]),
    ],
    [
      filingParserQualityCompositionIndexPath,
      new Set(["./filing-parser-quality-composition"]),
    ],
    [
      filingParserQualityCompositionBuilderPath,
      new Set([
        "node:crypto",
        filingParserCrossEngineExecutionModule,
        filingQualityMeasurementModule,
      ]),
    ],
    [
      filingParserQualityCompositionUnitTestPath,
      new Set([
        "node:crypto",
        "vitest",
        "./filing-parser-quality-composition",
        "./test-filing-parser-quality-composition-builder",
      ]),
    ],
    [
      filingParserQualityCompositionSecurityTestPath,
      new Set([
        "vitest",
        filingParserCrossEngineExecutionModule,
        "./filing-parser-quality-composition",
        "./index",
        "./test-filing-parser-quality-composition-builder",
      ]),
    ],
  ]);
  for (const path of actualTree.filter((entry) => entry.endsWith(".ts"))) {
    const content = await cycle2kText(path, found);
    const modules = collectModuleSpecifiers(content);
    const allowedModules = allowedModulesByPath.get(path);
    if (allowedModules === undefined) {
      found.push(`${path}: unclassified Cycle 2n source`);
      continue;
    }
    if (
      new Set(modules).size !== allowedModules.size ||
      [...allowedModules].some((module) => !modules.includes(module))
    )
      found.push(`${path}: Cycle 2n imports must remain exact`);
    for (const module of modules)
      if (!allowedModules.has(module))
        found.push(`${path}: unreviewed Cycle 2n import ${module}`);
    if (
      /\b(?:import|require)\s*\(/u.test(content) ||
      /\b(?:eval|Function)\s*\(/u.test(content)
    )
      found.push(`${path}: dynamic loading or evaluation is forbidden`);
  }
  const index = await cycle2kText(
    filingParserQualityCompositionIndexPath,
    found,
  );
  const indexSource = ts.createSourceFile(
    filingParserQualityCompositionIndexPath,
    index,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const indexDeclaration = indexSource.statements[0];
  if (
    indexSource.statements.length !== 1 ||
    indexDeclaration === undefined ||
    !isExactNamedReExportDeclaration(
      indexDeclaration,
      "./filing-parser-quality-composition",
      filingParserQualityCompositionPublicExports,
    )
  )
    found.push("Cycle 2n quality-composition public index must remain exact");
  return found;
}

async function localResearchVaultBoundaryViolations(): Promise<string[]> {
  const found: string[] = [];
  const actualTree = [...filesToInspect]
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .filter((path) => path.startsWith(localResearchVaultPackagePrefix))
    .sort();
  if (!localResearchVaultExactTree(actualTree))
    found.push(
      `${localResearchVaultPackagePrefix}: Cycle 3d package tree must remain the exact twenty-file reviewed vault surface`,
    );

  const manifestPath = `${localResearchVaultPackagePrefix}package.json`;
  const manifest = await localResearchVaultJson(manifestPath, found);
  const expectedManifest = {
    name: localResearchVaultModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
  };
  if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest))
    found.push(
      `${manifestPath}: Cycle 3d vault must remain private, index-only, and zero-production-dependency`,
    );

  const tsconfigPath = `${localResearchVaultPackagePrefix}tsconfig.json`;
  const tsconfig = await localResearchVaultJson(tsconfigPath, found);
  const expectedTsconfig = {
    extends: "../../tsconfig.base.json",
    compilerOptions: { noEmit: true, types: ["node"] },
    include: ["src/**/*.ts"],
  };
  if (JSON.stringify(tsconfig) !== JSON.stringify(expectedTsconfig))
    found.push(`${tsconfigPath}: Cycle 3d tsconfig must remain exact`);

  const packageModules = localResearchVaultExpectedModulesByPath();
  for (const path of actualTree.filter((entry) => entry.endsWith(".ts"))) {
    const content = await localResearchVaultText(path, found);
    const expectedModules = packageModules.get(path);
    if (expectedModules === undefined) {
      found.push(`${path}: unclassified Cycle 3d vault source`);
      continue;
    }
    const sourceViolation = localResearchVaultSourceViolation(
      path,
      content,
      expectedModules,
    );
    if (sourceViolation !== null) found.push(`${path}: ${sourceViolation}`);
  }
  for (const path of packageModules.keys()) {
    if (!actualTree.includes(path))
      found.push(`${path}: required Cycle 3d vault source is missing`);
  }

  const indexPath = `${localResearchVaultPackagePrefix}src/index.ts`;
  const indexViolation = localResearchVaultIndexViolation(
    await localResearchVaultText(indexPath, found),
  );
  if (indexViolation !== null) found.push(`${indexPath}: ${indexViolation}`);

  const allowedApiBindings = localResearchVaultAllowedApiBindings();
  for (const file of externalCompositionFilesToInspect) {
    const path = relative(root, file).replaceAll("\\", "/");
    if (path.startsWith(localResearchVaultPackagePrefix)) continue;
    const content = await readFile(file, "utf8");
    const reference = localResearchVaultExternalReference(path, content);
    if (!reference.bare && !reference.deep) continue;
    if (reference.deep) {
      found.push(
        `${path}: deep or relative imports of the Cycle 3d vault package are forbidden`,
      );
      continue;
    }
    const expectedBindings = allowedApiBindings.get(path);
    if (expectedBindings === undefined) {
      found.push(
        `${path}: only the exact reviewed apps/api vault files may import ${localResearchVaultModule}`,
      );
      continue;
    }
    if (
      JSON.stringify(localResearchVaultImportBindings(content).sort()) !==
      JSON.stringify([...expectedBindings].sort())
    )
      found.push(
        `${path}: Cycle 3d vault imports must remain the exact reviewed bindings`,
      );
  }
  for (const [path, expectedBindings] of allowedApiBindings) {
    const content = await localResearchVaultText(path, found);
    if (
      !collectModuleSpecifiers(content).includes(localResearchVaultModule) ||
      JSON.stringify(localResearchVaultImportBindings(content).sort()) !==
        JSON.stringify([...expectedBindings].sort())
    )
      found.push(
        `${path}: required exact Cycle 3d vault package binding is missing`,
      );
  }

  for (const file of filesToInspect) {
    const path = relative(root, file).replaceAll("\\", "/");
    if (basename(path) !== "package.json") continue;
    const content = await readFile(file, "utf8");
    if (!content.includes(localResearchVaultModule)) continue;
    let candidate: unknown;
    try {
      candidate = JSON.parse(content) as unknown;
    } catch {
      continue;
    }
    for (const section of localResearchVaultDependencySections(candidate)) {
      if (path !== "apps/api/package.json" || section !== "dependencies")
        found.push(
          `${path}: only apps/api dependencies may declare the Cycle 3d vault package`,
        );
    }
  }

  const apiManifest = await localResearchVaultJson(
    "apps/api/package.json",
    found,
  );
  if (
    !isRecord(apiManifest?.dependencies) ||
    apiManifest.dependencies[localResearchVaultModule] !== "workspace:*"
  )
    found.push(
      "apps/api/package.json: exact Cycle 3d vault workspace dependency is required",
    );

  const apiGraphModules = localResearchVaultApiModulesByPath();
  const apiSources = new Map<string, string>();
  for (const path of [
    ...apiGraphModules.keys(),
    "apps/api/src/api-mode.ts",
    "apps/api/src/composition-root.ts",
    "apps/api/src/connected-composition-root.ts",
  ]) {
    if (!apiSources.has(path))
      apiSources.set(path, await localResearchVaultText(path, found));
  }
  for (const [path, expectedModules] of apiGraphModules) {
    const content = apiSources.get(path) ?? "";
    if (
      JSON.stringify(collectModuleSpecifiers(content)) !==
      JSON.stringify(expectedModules)
    )
      found.push(
        `${path}: runnable Cycle 3d API imports must remain the exact reviewed vault graph allowlist`,
      );
  }
  const apiGraphViolation = localResearchVaultApiGraphViolation(apiSources);
  if (apiGraphViolation !== null) found.push(apiGraphViolation);

  const apiConfigurationViolation = localResearchVaultApiConfigurationViolation(
    apiManifest,
    await localResearchVaultText("apps/api/tsup.config.ts", found),
    apiSources,
  );
  if (apiConfigurationViolation !== null) found.push(apiConfigurationViolation);

  const serverProcessViolation = localResearchVaultServerProcessViolation(
    apiSources.get("apps/api/src/vault-server.ts") ?? "",
  );
  if (serverProcessViolation !== null)
    found.push(`apps/api/src/vault-server.ts: ${serverProcessViolation}`);

  const authBoundarySources = new Map(apiSources);
  authBoundarySources.set(
    "apps/api/src/personal-vault-routes.ts",
    apiSources.get("apps/api/src/personal-vault-routes.ts") ?? "",
  );
  authBoundarySources.set(
    "apps/api/src/personal-owner-session-routes.ts",
    apiSources.get("apps/api/src/personal-owner-session-routes.ts") ?? "",
  );
  const authBoundaryViolation =
    localResearchVaultAuthBeforeParseViolation(authBoundarySources);
  if (authBoundaryViolation !== null) found.push(authBoundaryViolation);

  const allPaths = [...filesToInspect].map((file) =>
    relative(root, file).replaceAll("\\", "/"),
  );
  if (allPaths.includes("apps/web/src/lib/local-state.ts"))
    found.push(
      "apps/web/src/lib/local-state.ts: superseded durable browser storage module must remain absent",
    );
  for (const file of externalCompositionFilesToInspect) {
    const path = relative(root, file).replaceAll("\\", "/");
    if (!localResearchVaultIsProductionWebSource(path)) continue;
    const content = await readFile(file, "utf8");
    const storageViolation = localResearchVaultBrowserStorageViolation(
      path,
      content,
    );
    if (storageViolation !== null) found.push(`${path}: ${storageViolation}`);
  }

  const cleanup = await localResearchVaultText(
    legacyLocalStateCleanupPath,
    found,
  );
  const cleanupViolation = localResearchVaultLegacyCleanupViolation(cleanup);
  if (cleanupViolation !== null)
    found.push(`${legacyLocalStateCleanupPath}: ${cleanupViolation}`);
  const cleanupComponent = await localResearchVaultText(
    legacyLocalStateCleanupComponentPath,
    found,
  );
  const cleanupComponentViolation =
    localResearchVaultCleanupComponentViolation(cleanupComponent);
  if (cleanupComponentViolation !== null)
    found.push(
      `${legacyLocalStateCleanupComponentPath}: ${cleanupComponentViolation}`,
    );
  const layoutViolation = localResearchVaultLayoutCleanupViolation(
    await localResearchVaultText(webRootLayoutPath, found),
  );
  if (layoutViolation !== null)
    found.push(`${webRootLayoutPath}: ${layoutViolation}`);

  verifyLocalResearchVaultBoundaryClassifiers();
  return found;
}

async function localResearchVaultText(
  path: string,
  found: string[],
): Promise<string> {
  try {
    return await readFile(join(root, path), "utf8");
  } catch {
    found.push(`${path}: required Cycle 3d file is missing`);
    return "";
  }
}

async function localResearchVaultJson(
  path: string,
  found: string[],
): Promise<Record<string, unknown> | null> {
  const content = await localResearchVaultText(path, found);
  try {
    const value = JSON.parse(content) as unknown;
    return isRecord(value) ? value : null;
  } catch {
    found.push(`${path}: Cycle 3d JSON must parse`);
    return null;
  }
}

function localResearchVaultExactTree(actual: readonly string[]): boolean {
  return (
    JSON.stringify([...actual].sort()) ===
    JSON.stringify(localResearchVaultPackagePaths)
  );
}

function localResearchVaultExpectedModulesByPath(): ReadonlyMap<
  string,
  readonly string[]
> {
  return new Map([
    [
      `${localResearchVaultPackagePrefix}src/canonical-json.ts`,
      ["node:crypto", "./model", "./errors"],
    ],
    [
      localResearchVaultCrashRecoveryTestPath,
      [
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:sqlite",
        "node:child_process",
        "vitest",
        "./sqlite-local-research-vault",
      ],
    ],
    [
      `${localResearchVaultPackagePrefix}src/encrypted-vault-backup.test.ts`,
      [
        "node:fs/promises",
        "node:os",
        "node:path",
        "vitest",
        "./encrypted-vault-backup",
        "./errors",
        "./local-vault-paths",
        "./local-research-vault",
        "./sqlite-local-research-vault",
        "./windows-owner-only-acl",
      ],
    ],
    [
      `${localResearchVaultPackagePrefix}src/encrypted-vault-backup.ts`,
      [
        "node:crypto",
        "node:fs/promises",
        "node:path",
        "node:sqlite",
        "./canonical-json",
        "./errors",
        "./local-vault-paths",
        "./model",
        "./recovery-key-file",
        "./sqlite-local-research-vault",
        "./vault-crypto",
        "./vault-schema",
      ],
    ],
    [`${localResearchVaultPackagePrefix}src/errors.ts`, []],
    [
      `${localResearchVaultPackagePrefix}src/fixtures/cycle3d-crash-worker.ts`,
      ["node:sqlite", "../sqlite-local-research-vault"],
    ],
    [
      `${localResearchVaultPackagePrefix}src/index.ts`,
      [
        "./local-research-vault",
        "./local-research-vault",
        "./errors",
        "./errors",
        "./model",
        "./model",
        "./encrypted-vault-backup",
        "./local-vault-paths",
        "./local-vault-paths",
      ],
    ],
    [
      `${localResearchVaultPackagePrefix}src/local-research-vault.ts`,
      [
        "node:fs/promises",
        "./encrypted-vault-backup",
        "./errors",
        "./local-vault-paths",
        "./model",
        "./recovery-key-file",
        "./sqlite-local-research-vault",
        "./windows-owner-only-acl",
      ],
    ],
    [
      `${localResearchVaultPackagePrefix}src/local-vault-paths.test.ts`,
      [
        "node:fs/promises",
        "node:os",
        "node:path",
        "vitest",
        "./local-vault-paths.js",
        "./local-vault-paths.js",
      ],
    ],
    [
      `${localResearchVaultPackagePrefix}src/local-vault-paths.ts`,
      ["node:fs/promises", "node:fs", "node:path"],
    ],
    [`${localResearchVaultPackagePrefix}src/model.ts`, []],
    [
      `${localResearchVaultPackagePrefix}src/recovery-key-file.ts`,
      ["node:crypto", "node:fs/promises", "./errors", "./local-vault-paths"],
    ],
    [
      `${localResearchVaultPackagePrefix}src/sqlite-local-research-vault.test.ts`,
      [
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:sqlite",
        "vitest",
        "./errors",
        "./canonical-json",
        "./model",
        "./sqlite-local-research-vault",
        "./vault-crypto",
        "./vault-schema",
      ],
    ],
    [
      `${localResearchVaultPackagePrefix}src/sqlite-local-research-vault.ts`,
      [
        "node:crypto",
        "node:sqlite",
        "./canonical-json",
        "./errors",
        "./model",
        "./vault-schema",
        "./vault-crypto",
      ],
    ],
    [
      `${localResearchVaultPackagePrefix}src/vault-crypto.ts`,
      ["node:crypto", "./errors", "./model"],
    ],
    [
      `${localResearchVaultPackagePrefix}src/vault-schema.ts`,
      ["node:crypto", "node:sqlite", "./errors", "./model"],
    ],
    [
      `${localResearchVaultPackagePrefix}src/windows-owner-only-acl.test.ts`,
      [
        "node:fs/promises",
        "node:os",
        "node:path",
        "vitest",
        "./local-vault-paths",
        "./windows-owner-only-acl",
      ],
    ],
    [
      localResearchVaultWindowsAclPath,
      ["node:child_process", "node:path", "./local-vault-paths", "./errors"],
    ],
  ]);
}

function localResearchVaultSourceViolation(
  path: string,
  content: string,
  expectedModules: readonly string[],
): string | null {
  const modules = collectModuleSpecifiers(content);
  if (JSON.stringify(modules) !== JSON.stringify(expectedModules))
    return "Cycle 3d imports and re-exports must remain the exact reviewed per-file allowlist";
  if (
    hasRuntimeDynamicImport(content) ||
    hasForbiddenDynamicCodeCapability(content) ||
    hasUnresolvedRuntimeModuleLoad(content) ||
    hasIndirectRuntimeModuleLoad(content)
  )
    return "Cycle 3d runtime module loading and dynamic code are forbidden";

  const childProcessModule = /^(?:node:)?child_process(?:\/|$)/u;
  if (
    modules.some((module) => childProcessModule.test(module)) &&
    path !== localResearchVaultWindowsAclPath &&
    path !== localResearchVaultCrashRecoveryTestPath
  )
    return "production child_process capability is restricted to the Windows owner-only ACL adapter";
  const forbiddenNetworkModule =
    /^(?:node:)?(?:cluster|dgram|dns|http|http2|https|net|tls|worker_threads)(?:\/|$)/u;
  if (modules.some((module) => forbiddenNetworkModule.test(module)))
    return "network and worker modules are forbidden in the local vault package";

  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (
    findIdentifiers(
      source,
      new Set([
        "Bun",
        "Deno",
        "EventSource",
        "WebSocket",
        "XMLHttpRequest",
        "console",
        "fetch",
        "global",
        "globalThis",
        "navigator",
        "self",
        "window",
      ]),
    ).length > 0
  )
    return "network, global-runtime, and console logging capabilities are forbidden in the local vault package";

  let processLog = false;
  let concreteEndpoint = false;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      namedBoundaryPropertyAccess(node, new Set(["stderr", "stdout"])) !== null
    ) {
      const expression = unwrapBoundaryExpression(node.expression);
      if (ts.isIdentifier(expression) && expression.text === "process")
        processLog = true;
    }
    if (
      ts.isStringLiteralLike(node) &&
      /(?:https?|wss?):\/\//iu.test(node.text)
    )
      concreteEndpoint = true;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (processLog)
    return "process stdout/stderr logging is forbidden in the local vault package";
  return concreteEndpoint
    ? "concrete network endpoints are forbidden in the local vault package"
    : null;
}

function localResearchVaultExpectedIndexSurface(): readonly unknown[] {
  return [
    {
      module: "./local-research-vault",
      typeOnly: false,
      exports: [
        {
          exported: "LocalResearchVault",
          local: "LocalResearchVault",
          typeOnly: false,
        },
      ],
    },
    {
      module: "./local-research-vault",
      typeOnly: true,
      exports: [
        {
          exported: "LocalResearchVaultStartupOptions",
          local: "LocalResearchVaultStartupOptions",
          typeOnly: false,
        },
        {
          exported: "RestoredLocalResearchVaultRuntime",
          local: "RestoredLocalResearchVaultRuntime",
          typeOnly: false,
        },
      ],
    },
    {
      module: "./errors",
      typeOnly: false,
      exports: [
        {
          exported: "LocalResearchVaultError",
          local: "LocalResearchVaultError",
          typeOnly: false,
        },
      ],
    },
    {
      module: "./errors",
      typeOnly: true,
      exports: [
        {
          exported: "LocalResearchVaultErrorCode",
          local: "LocalResearchVaultErrorCode",
          typeOnly: false,
        },
      ],
    },
    {
      module: "./model",
      typeOnly: false,
      exports: [
        {
          exported: "LOCAL_RESEARCH_RECORD_KINDS",
          local: "LOCAL_RESEARCH_RECORD_KINDS",
          typeOnly: false,
        },
        {
          exported: "LOCAL_RESEARCH_VAULT_PROFILE",
          local: "LOCAL_RESEARCH_VAULT_PROFILE",
          typeOnly: false,
        },
      ],
    },
    {
      module: "./model",
      typeOnly: true,
      exports: [
        "DeleteLocalResearchRecordCommand",
        "JsonValue",
        "LocalResearchAttachment",
        "LocalResearchMutationReceipt",
        "LocalResearchRecord",
        "LocalResearchRecordKind",
        "LocalResearchRecordSummary",
        "LocalResearchVaultInventory",
        "PutLocalResearchAttachmentCommand",
        "PutLocalResearchRecordCommand",
      ].map((name) => ({
        exported: name,
        local: name,
        typeOnly: false,
      })),
    },
    {
      module: "./encrypted-vault-backup",
      typeOnly: true,
      exports: [
        {
          exported: "EncryptedLocalVaultBackupReceipt",
          local: "EncryptedLocalVaultBackupReceipt",
          typeOnly: false,
        },
      ],
    },
    {
      module: "./local-vault-paths",
      typeOnly: false,
      exports: [
        {
          exported: "WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE",
          local: "WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE",
          typeOnly: false,
        },
      ],
    },
    {
      module: "./local-vault-paths",
      typeOnly: true,
      exports: [
        "WindowsOwnerOnlyAclPort",
        "WindowsOwnerOnlyAclTarget",
        "WindowsOwnerOnlyAclVerificationReceipt",
      ].map((name) => ({
        exported: name,
        local: name,
        typeOnly: false,
      })),
    },
  ];
}

function localResearchVaultIndexViolation(content: string): string | null {
  const source = ts.createSourceFile(
    `${localResearchVaultPackagePrefix}src/index.ts`,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const surface: unknown[] = [];
  for (const statement of source.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    )
      return "Cycle 3d public index may contain only exact named re-exports";
    surface.push({
      module: statement.moduleSpecifier.text,
      typeOnly: statement.isTypeOnly,
      exports: statement.exportClause.elements.map((element) => ({
        exported: element.name.text,
        local: (element.propertyName ?? element.name).text,
        typeOnly: element.isTypeOnly,
      })),
    });
  }
  return JSON.stringify(surface) ===
    JSON.stringify(localResearchVaultExpectedIndexSurface())
    ? null
    : "Cycle 3d public value/type export surface must remain exact";
}

function localResearchVaultAllowedApiBindings(): ReadonlyMap<
  string,
  readonly string[]
> {
  return new Map([
    [
      "apps/api/src/personal-vault-routes.test.ts",
      [
        "LocalResearchVault",
        "WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE",
        "type WindowsOwnerOnlyAclPort",
        "type WindowsOwnerOnlyAclTarget",
        "type WindowsOwnerOnlyAclVerificationReceipt",
      ],
    ],
    [
      "apps/api/src/personal-vault-routes.ts",
      [
        "LOCAL_RESEARCH_RECORD_KINDS",
        "LOCAL_RESEARCH_VAULT_PROFILE",
        "LocalResearchVaultError",
        "type JsonValue",
        "type LocalResearchRecordKind",
        "type LocalResearchVault",
      ],
    ],
    [
      "apps/api/src/vault-app.ts",
      ["LOCAL_RESEARCH_VAULT_PROFILE", "type LocalResearchVault"],
    ],
    ["apps/api/src/vault-composition-root.ts", ["LocalResearchVault"]],
  ]);
}

function localResearchVaultImportBindings(content: string): string[] {
  const source = ts.createSourceFile(
    "local-research-vault-import.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const bindings: string[] = [];
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== localResearchVaultModule
    )
      continue;
    const clause = statement.importClause;
    if (clause === undefined) {
      bindings.push("<side-effect>");
      continue;
    }
    if (clause.name !== undefined)
      bindings.push(`<default:${clause.name.text}>`);
    const named = clause.namedBindings;
    if (named === undefined) continue;
    if (ts.isNamespaceImport(named)) {
      bindings.push(`<namespace:${named.name.text}>`);
      continue;
    }
    for (const element of named.elements) {
      const imported = (element.propertyName ?? element.name).text;
      const local = element.name.text;
      const binding = imported === local ? imported : `${imported} as ${local}`;
      bindings.push(
        clause.isTypeOnly || element.isTypeOnly ? `type ${binding}` : binding,
      );
    }
  }
  return bindings;
}

function localResearchVaultExternalReference(
  importerPath: string,
  content: string,
): { readonly bare: boolean; readonly deep: boolean } {
  let bare = false;
  let deep = false;
  for (const rawSpecifier of collectModuleSpecifiers(content)) {
    const specifier = rawSpecifier.replaceAll("\\", "/");
    if (specifier === localResearchVaultModule) {
      bare = true;
      continue;
    }
    if (
      specifier.startsWith(`${localResearchVaultModule}/`) ||
      specifier.includes(localResearchVaultPackagePrefix)
    ) {
      deep = true;
      continue;
    }
    if (!specifier.startsWith(".")) continue;
    const resolved = posixNormalize(
      `${posixDirname(importerPath)}/${specifier}`,
    );
    if (resolved.startsWith(localResearchVaultPackagePrefix)) deep = true;
  }
  return { bare, deep };
}

function localResearchVaultDependencySections(value: unknown): string[] {
  if (!isRecord(value)) return [];
  return dependencySections.filter(
    (section) =>
      isRecord(value[section]) &&
      Object.hasOwn(value[section], localResearchVaultModule),
  );
}

function localResearchVaultApiModulesByPath(): ReadonlyMap<
  string,
  readonly string[]
> {
  return new Map([
    ["apps/api/src/listen-options.ts", []],
    [
      "apps/api/src/personal-owner-session-routes.ts",
      [
        "@research-cockpit/contracts",
        "fastify",
        "./listen-options",
        "./personal-owner-session",
      ],
    ],
    [
      "apps/api/src/personal-owner-session.ts",
      ["node:crypto", "node:perf_hooks"],
    ],
    [
      "apps/api/src/personal-vault-routes.ts",
      [
        "@research-cockpit/contracts",
        localResearchVaultModule,
        "fastify",
        "./listen-options",
        "./personal-owner-session",
        "./personal-owner-session-routes",
      ],
    ],
    [
      "apps/api/src/vault-app.ts",
      [
        "node:crypto",
        "@fastify/cors",
        "@fastify/helmet",
        "@research-cockpit/contracts",
        localResearchVaultModule,
        "fastify",
        "./listen-options",
        "./personal-owner-session",
        "./personal-owner-session-routes",
        "./personal-vault-routes",
      ],
    ],
    [
      "apps/api/src/vault-composition-root.ts",
      [
        "fastify",
        localResearchVaultModule,
        "./listen-options",
        "./personal-owner-session",
        "./vault-app",
      ],
    ],
    [
      "apps/api/src/vault-server.ts",
      ["./vault-composition-root", "./listen-options"],
    ],
  ]);
}

function localResearchVaultApiGraphViolation(
  sources: ReadonlyMap<string, string>,
): string | null {
  const expected = [...localResearchVaultApiModulesByPath().keys()].sort();
  const pending = ["apps/api/src/vault-server.ts"];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const path = pending.pop();
    if (path === undefined || visited.has(path)) continue;
    visited.add(path);
    const content = sources.get(path);
    if (content === undefined) continue;
    for (const specifier of collectModuleSpecifiers(content)) {
      if (!specifier.startsWith(".")) continue;
      let target = posixNormalize(`${posixDirname(path)}/${specifier}`);
      target = target.replace(/\.(?:c|m)?js$/u, ".ts");
      if (!/\.[cm]?[jt]sx?$/u.test(target)) target += ".ts";
      pending.push(target);
    }
  }
  return JSON.stringify([...visited].sort()) === JSON.stringify(expected)
    ? null
    : "apps/api/src/vault-server.ts: Cycle 3d vault runtime graph must remain the exact seven-file isolated composition";
}

function localResearchVaultApiRequiredAnchors(): ReadonlyMap<
  string,
  readonly string[]
> {
  return new Map([
    [
      "apps/api/src/api-mode.ts",
      [
        '| "personal_single_user_local_vault"',
        'value !== "personal_single_user_local_vault"',
      ],
    ],
    [
      "apps/api/src/composition-root.ts",
      [
        '"RESEARCH_COCKPIT_VAULT_ROOT"',
        '"RESEARCH_COCKPIT_VAULT_STARTUP"',
        'mode === "personal_single_user_local_vault"',
        "VAULT_MODE_REQUIRES_VAULT_ENTRYPOINT",
        "hasVaultConfiguration",
        "VAULT_CONFIGURATION_REQUIRES_VAULT_ENTRYPOINT",
      ],
    ],
    [
      "apps/api/src/connected-composition-root.ts",
      [
        '"RESEARCH_COCKPIT_VAULT_ROOT"',
        '"RESEARCH_COCKPIT_VAULT_STARTUP"',
        "OFFLINE_PRIVATE_ENVIRONMENT_KEYS",
        "CONNECTED_MODE_REJECTS_OFFLINE_CONFIGURATION",
      ],
    ],
    [
      "apps/api/src/vault-composition-root.ts",
      [
        '"personal_single_user_local_vault"',
        '"RESEARCH_COCKPIT_VAULT_ROOT"',
        '"RESEARCH_COCKPIT_VAULT_STARTUP"',
        "FORBIDDEN_PRIVATE_CONFIGURATION_KEYS",
        "VAULT_PRIVATE_ENVIRONMENT_KEYS",
        "capturedVaultApiEnvironments.add(captured)",
        "delete environment[key]",
        "environment.RESEARCH_COCKPIT_MODE !== VAULT_API_MODE",
        "VAULT_MODE_REJECTS_OTHER_PRIVATE_CONFIGURATION",
        'startupAction !== "initialize" && startupAction !== "open"',
        "LocalResearchVault.initialize(startupOptions)",
        "LocalResearchVault.open(startupOptions)",
      ],
    ],
    [
      "apps/api/src/vault-server.ts",
      [
        "captureVaultApiEnvironment(process.env)",
        "createVaultConfiguredApp(environment)",
      ],
    ],
  ]);
}

function localResearchVaultApiConfigurationViolation(
  apiManifest: Record<string, unknown> | null,
  tsupConfig: string,
  sources: ReadonlyMap<string, string>,
): string | null {
  const scripts = isRecord(apiManifest?.scripts) ? apiManifest.scripts : null;
  if (
    scripts === null ||
    scripts["dev:vault"] !== "tsx watch src/vault-server.ts" ||
    scripts["start:vault"] !== "node dist/src/vault-server.js" ||
    new Set([scripts.dev, scripts["dev:connected"], scripts["dev:vault"]])
      .size !== 3 ||
    new Set([scripts.start, scripts["start:connected"], scripts["start:vault"]])
      .size !== 3
  )
    return "apps/api/package.json: distinct exact Cycle 3d vault development and start entries are required";
  if (
    JSON.stringify(collectModuleSpecifiers(tsupConfig)) !==
      JSON.stringify(["node:path", "tsup", "./src/build-source-identity"]) ||
    !hasExactApiBuildEntries(tsupConfig) ||
    !tsupConfig.includes("splitting: false")
  )
    return "apps/api/tsup.config.ts: ordinary, connected, security-master, and vault APIs require exact separate non-splitting build entries";
  for (const [path, anchors] of localResearchVaultApiRequiredAnchors()) {
    const content = sources.get(path);
    if (
      content === undefined ||
      anchors.some((anchor) => !content.includes(anchor))
    )
      return `${path}: exact Cycle 3d mode, environment capture, isolation, or startup anchors regressed`;
  }

  const vaultForbiddenConfiguration = localResearchVaultConstStringArray(
    sources.get("apps/api/src/vault-composition-root.ts") ?? "",
    "FORBIDDEN_PRIVATE_CONFIGURATION_KEYS",
  );
  const expectedVaultForbiddenConfiguration = [
    "CONNECTED_SOURCE_POLICY_BUNDLE_PATH",
    "CONNECTED_SOURCE_POLICY_BUNDLE_SHA256",
    "CONNECTED_SOURCE_POLICY_SECRET_REFERENCE",
    "PERSONAL_FILING_QUALITY_RESULT_PATH",
    "PERSONAL_FILING_QUALITY_RESULT_SHA256",
    "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH",
    "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256",
    "PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH",
    "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH",
    "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256",
    "PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH",
    "PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH",
    "PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256",
  ];
  if (
    JSON.stringify(vaultForbiddenConfiguration) !==
    JSON.stringify(expectedVaultForbiddenConfiguration)
  )
    return "apps/api/src/vault-composition-root.ts: vault mode must reject the exact connected, release, and security-master configuration surface";

  const connectedOfflineConfiguration = localResearchVaultConstStringArray(
    sources.get("apps/api/src/connected-composition-root.ts") ?? "",
    "OFFLINE_PRIVATE_ENVIRONMENT_KEYS",
  );
  const expectedConnectedOfflineConfiguration = [
    "PERSONAL_FILING_QUALITY_RESULT_PATH",
    "PERSONAL_FILING_QUALITY_RESULT_SHA256",
    "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH",
    "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256",
    "PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH",
    "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH",
    "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256",
    "PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH",
    "RESEARCH_COCKPIT_VAULT_ROOT",
    "RESEARCH_COCKPIT_VAULT_STARTUP",
    "PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH",
    "PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256",
  ];
  return JSON.stringify(connectedOfflineConfiguration) ===
    JSON.stringify(expectedConnectedOfflineConfiguration)
    ? null
    : "apps/api/src/connected-composition-root.ts: connected mode must reject the exact offline, vault, and security-master configuration surface";
}

function localResearchVaultConstStringArray(
  content: string,
  declarationName: string,
): string[] | null {
  const source = ts.createSourceFile(
    "cycle3d-configuration.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== declarationName ||
        declaration.initializer === undefined
      )
        continue;
      const initializer = unwrapBoundaryExpression(declaration.initializer);
      if (!ts.isArrayLiteralExpression(initializer)) return null;
      const values: string[] = [];
      for (const element of initializer.elements) {
        const value = staticStringValue(element);
        if (value === null) return null;
        values.push(value);
      }
      return values;
    }
  }
  return null;
}

function localResearchVaultServerProcessViolation(
  content: string,
): string | null {
  const source = ts.createSourceFile(
    "apps/api/src/vault-server.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const positions = {
    env: [] as number[],
    exitCode: [] as number[],
    stderr: [] as number[],
    stdout: [] as number[],
  };
  let invalid = false;
  const fixedWrites = new Map([
    ["stderr", "Research Cockpit personal vault API failed to start.\n"],
    ["stdout", "Research Cockpit personal vault API is listening.\n"],
  ]);
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === "process") {
      const access = node.parent;
      if (
        !ts.isPropertyAccessExpression(access) ||
        access.expression !== node
      ) {
        invalid = true;
      } else if (access.name.text === "env") {
        const call = access.parent;
        if (
          !ts.isCallExpression(call) ||
          !ts.isIdentifier(call.expression) ||
          call.expression.text !== "captureVaultApiEnvironment" ||
          call.arguments.length !== 1 ||
          call.arguments[0] !== access
        ) {
          invalid = true;
        } else {
          positions.env.push(access.getStart(source));
        }
      } else if (
        access.name.text === "stdout" ||
        access.name.text === "stderr"
      ) {
        const writeAccess = access.parent;
        const call = writeAccess.parent;
        const argument = ts.isCallExpression(call) ? call.arguments[0] : null;
        if (
          !ts.isPropertyAccessExpression(writeAccess) ||
          writeAccess.expression !== access ||
          writeAccess.name.text !== "write" ||
          !ts.isCallExpression(call) ||
          call.expression !== writeAccess ||
          call.arguments.length !== 1 ||
          argument === undefined ||
          argument === null ||
          !ts.isStringLiteralLike(argument) ||
          argument.text !== fixedWrites.get(access.name.text)
        ) {
          invalid = true;
        } else {
          positions[access.name.text].push(access.getStart(source));
        }
      } else if (access.name.text === "exitCode") {
        const assignment = access.parent;
        if (
          !ts.isBinaryExpression(assignment) ||
          assignment.left !== access ||
          assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
          !ts.isNumericLiteral(assignment.right) ||
          assignment.right.text !== "1"
        ) {
          invalid = true;
        } else {
          positions.exitCode.push(access.getStart(source));
        }
      } else {
        invalid = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (
    invalid ||
    positions.env.length !== 1 ||
    positions.stdout.length !== 1 ||
    positions.stderr.length !== 1 ||
    positions.exitCode.length !== 1 ||
    !(
      positions.env[0]! < positions.stdout[0]! &&
      positions.stdout[0]! < positions.stderr[0]! &&
      positions.stderr[0]! < positions.exitCode[0]!
    )
  )
    return "process access must remain one first-step environment capture followed only by fixed stdout/stderr messages and exitCode assignment";
  return null;
}

function localResearchVaultAuthBeforeParseViolation(
  sources: ReadonlyMap<string, string>,
): string | null {
  const routePath = "apps/api/src/personal-vault-routes.ts";
  const routes = sources.get(routePath);
  if (routes === undefined)
    return `${routePath}: Cycle 3d vault routes are missing`;
  const source = ts.createSourceFile(
    routePath,
    routes,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const mutationCalls: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "app" &&
      node.expression.name.text === "post"
    )
      mutationCalls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (mutationCalls.length !== 2)
    return `${routePath}: exactly two vault mutation routes must remain registered`;
  for (const call of mutationCalls) {
    const options = call.arguments[1];
    if (!options || !ts.isObjectLiteralExpression(options))
      return `${routePath}: vault mutation authorization must remain a route-level onRequest hook`;
    const onRequest = options.properties.find(
      (property) =>
        (ts.isPropertyAssignment(property) ||
          ts.isMethodDeclaration(property)) &&
        boundaryPropertyName(property.name) === "onRequest",
    );
    if (onRequest === undefined)
      return `${routePath}: vault mutation authorization must remain a route-level onRequest hook`;
    const guardText = onRequest.getText(source);
    if (
      !guardText.includes("authorizePersonalVaultMutationRouteRequest(") ||
      /\brequest\s*\.\s*body\b/u.test(guardText)
    )
      return `${routePath}: every vault mutation must authenticate before body parsing or access`;
  }

  const ownerBoundaryPath = "apps/api/src/personal-owner-session-routes.ts";
  const ownerBoundary = sources.get(ownerBoundaryPath) ?? "";
  const requiredOwnerBoundaryAnchors = [
    'body: "json" | "none"',
    'body === "json" ? "vault-json" : "vault-empty"',
    'bodyPolicy: "none" | "vault-empty" | "vault-json" = "none"',
    "request.raw.rawHeaders",
    'rawNames.includes("transfer-encoding")',
    "count(rawNames, PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME) !== 1",
    'bodyPolicy === "vault-json"',
    "Number(contentLength.value) > 300 * 1_024",
    'contentType.value.toLowerCase() !== "application/json"',
  ];
  return requiredOwnerBoundaryAnchors.every((anchor) =>
    ownerBoundary.includes(anchor),
  )
    ? null
    : `${ownerBoundaryPath}: exact auth-before-parse body framing and raw-header controls regressed`;
}

function localResearchVaultIsProductionWebSource(path: string): boolean {
  return (
    (path.startsWith("apps/web/app/") || path.startsWith("apps/web/src/")) &&
    executableSourceExtensions.has(extname(path).toLowerCase()) &&
    !/(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/iu.test(path)
  );
}

function localResearchVaultBrowserStorageViolation(
  path: string,
  content: string,
): string | null {
  const forbiddenStorageModule =
    /^(?:dexie|idb|localforage|local-storage|store2)(?:\/|$)/u;
  if (
    collectModuleSpecifiers(content).some((module) =>
      forbiddenStorageModule.test(module),
    )
  )
    return "browser durable-storage libraries are forbidden";
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const cleanup = path === legacyLocalStateCleanupPath;
  const forbiddenNames = new Set([
    "CacheStorage",
    "FileSystemDirectoryHandle",
    "FileSystemFileHandle",
    "IDBDatabase",
    "IDBFactory",
    "StorageManager",
    "caches",
    "cookieStore",
    "createWritable",
    "indexedDB",
    "openDatabase",
    "setItem",
    "showDirectoryPicker",
    "showSaveFilePicker",
  ]);
  if (!cleanup) {
    forbiddenNames.add("localStorage");
    forbiddenNames.add("removeItem");
    forbiddenNames.add("sessionStorage");
  } else {
    forbiddenNames.add("sessionStorage");
  }
  if (findIdentifiers(source, forbiddenNames).length > 0)
    return cleanup
      ? "legacy cleanup may only remove the two reviewed localStorage namespaces"
      : "browser durable storage reads and writes are forbidden outside the one-way legacy cleanup";

  let forbiddenProperty = false;
  const forbiddenProperties = new Set(forbiddenNames);
  const visit = (node: ts.Node): void => {
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      namedBoundaryPropertyAccess(node, forbiddenProperties) !== null
    )
      forbiddenProperty = true;
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      namedBoundaryPropertyAccess(node, new Set(["cookie"])) !== null
    ) {
      const owner = unwrapBoundaryExpression(node.expression);
      if (ts.isIdentifier(owner) && owner.text === "document")
        forbiddenProperty = true;
    }
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      namedBoundaryPropertyAccess(node, new Set(["storage"])) !== null
    ) {
      const owner = unwrapBoundaryExpression(node.expression);
      if (ts.isIdentifier(owner) && owner.text === "navigator")
        forbiddenProperty = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return forbiddenProperty
    ? "browser durable storage reads and writes are forbidden outside the one-way legacy cleanup"
    : null;
}

function localResearchVaultLegacyCleanupViolation(
  content: string,
): string | null {
  const storageViolation = localResearchVaultBrowserStorageViolation(
    legacyLocalStateCleanupPath,
    content,
  );
  if (storageViolation !== null) return storageViolation;
  if (collectModuleSpecifiers(content).length !== 0)
    return "legacy cleanup must remain dependency-free";
  const source = ts.createSourceFile(
    legacyLocalStateCleanupPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const prefixes: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteralLike(node) &&
      node.text.startsWith("research-cockpit:")
    )
      prefixes.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (
    JSON.stringify(prefixes) !==
    JSON.stringify(["research-cockpit:alert:", "research-cockpit:thesis:"])
  )
    return "legacy cleanup prefixes must remain the exact two superseded namespaces";
  const required = [
    "LEGACY_RESEARCH_STATE_PREFIXES.some((prefix) => key.startsWith(prefix))",
    "storage.removeItem(key)",
    "scrubLegacyLocalResearchState(window.localStorage)",
  ];
  if (
    required.some((anchor) => !content.includes(anchor)) ||
    content.split("storage.removeItem(key)").length !== 2
  )
    return "legacy cleanup must remain a bounded one-way removeItem scrub";
  return null;
}

function localResearchVaultCleanupComponentViolation(
  content: string,
): string | null {
  if (
    JSON.stringify(collectModuleSpecifiers(content)) !==
    JSON.stringify(["react", "@/lib/legacy-local-state-cleanup"])
  )
    return "cleanup component imports must remain exact";
  const required = [
    '"use client"',
    "export function LegacyLocalStateCleanup()",
    "useEffect(() => {",
    "scrubLegacyLocalResearchStateFromWindow()",
    "}, [])",
    "return null",
  ];
  return required.every((anchor) => content.includes(anchor))
    ? null
    : "cleanup component must run the one-way scrub once at global client mount";
}

function localResearchVaultLayoutCleanupViolation(
  content: string,
): string | null {
  const cleanupModule = "@/features/research/LegacyLocalStateCleanup" as const;
  const source = ts.createSourceFile(
    webRootLayoutPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const matchingImports = source.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteralLike(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === cleanupModule,
  );
  if (matchingImports.length !== 1)
    return "global layout must import the legacy cleanup exactly once";
  const clause = matchingImports[0]?.importClause;
  if (
    clause === undefined ||
    clause.name !== undefined ||
    clause.namedBindings === undefined ||
    !ts.isNamedImports(clause.namedBindings) ||
    clause.namedBindings.elements.length !== 1 ||
    clause.namedBindings.elements[0]?.name.text !== "LegacyLocalStateCleanup" ||
    clause.namedBindings.elements[0].propertyName !== undefined
  )
    return "global layout cleanup import binding must remain exact";

  let mountedInsideBody = 0;
  const visit = (node: ts.Node): void => {
    const tag = ts.isJsxSelfClosingElement(node)
      ? node.tagName
      : ts.isJsxOpeningElement(node)
        ? node.tagName
        : null;
    if (tag?.getText(source) === "LegacyLocalStateCleanup") {
      let current: ts.Node | undefined = node.parent;
      let insideBody = false;
      while (current !== undefined) {
        if (
          ts.isJsxElement(current) &&
          current.openingElement.tagName.getText(source) === "body"
        ) {
          insideBody = true;
          break;
        }
        current = current.parent;
      }
      if (insideBody) mountedInsideBody += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return mountedInsideBody === 1
    ? null
    : "global layout must mount exactly one legacy cleanup inside body";
}

function verifyLocalResearchVaultBoundaryClassifiers(): void {
  const canonicalSource = [
    'import "node:crypto";',
    'import "./model";',
    'import "./errors";',
  ].join("\n");
  const canonicalPath = `${localResearchVaultPackagePrefix}src/canonical-json.ts`;
  const canonicalModules = ["node:crypto", "./model", "./errors"];
  const exactIndex = `
    export { LocalResearchVault } from "./local-research-vault";
    export type { LocalResearchVaultStartupOptions, RestoredLocalResearchVaultRuntime } from "./local-research-vault";
    export { LocalResearchVaultError } from "./errors";
    export type { LocalResearchVaultErrorCode } from "./errors";
    export { LOCAL_RESEARCH_RECORD_KINDS, LOCAL_RESEARCH_VAULT_PROFILE } from "./model";
    export type {
      DeleteLocalResearchRecordCommand,
      JsonValue,
      LocalResearchAttachment,
      LocalResearchMutationReceipt,
      LocalResearchRecord,
      LocalResearchRecordKind,
      LocalResearchRecordSummary,
      LocalResearchVaultInventory,
      PutLocalResearchAttachmentCommand,
      PutLocalResearchRecordCommand,
    } from "./model";
    export type { EncryptedLocalVaultBackupReceipt } from "./encrypted-vault-backup";
    export { WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE } from "./local-vault-paths";
    export type { WindowsOwnerOnlyAclPort, WindowsOwnerOnlyAclTarget, WindowsOwnerOnlyAclVerificationReceipt } from "./local-vault-paths";
  `;

  const graphSources = new Map<string, string>();
  for (const [path, modules] of localResearchVaultApiModulesByPath())
    graphSources.set(
      path,
      modules.map((module) => `import ${JSON.stringify(module)};`).join("\n"),
    );
  const driftedGraphSources = new Map(graphSources);
  driftedGraphSources.set(
    "apps/api/src/vault-server.ts",
    `${driftedGraphSources.get("apps/api/src/vault-server.ts") ?? ""}\nimport "./app";`,
  );

  const configurationSources = new Map<string, string>();
  for (const [path, anchors] of localResearchVaultApiRequiredAnchors())
    configurationSources.set(path, anchors.join("\n"));
  configurationSources.set(
    "apps/api/src/vault-composition-root.ts",
    `${configurationSources.get("apps/api/src/vault-composition-root.ts") ?? ""}
      const FORBIDDEN_PRIVATE_CONFIGURATION_KEYS = [
        "CONNECTED_SOURCE_POLICY_BUNDLE_PATH",
        "CONNECTED_SOURCE_POLICY_BUNDLE_SHA256",
        "CONNECTED_SOURCE_POLICY_SECRET_REFERENCE",
        "PERSONAL_FILING_QUALITY_RESULT_PATH",
        "PERSONAL_FILING_QUALITY_RESULT_SHA256",
        "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH",
        "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256",
        "PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH",
        "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH",
        "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256",
        "PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH",
        "PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH",
        "PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256",
      ] as const;
    `,
  );
  configurationSources.set(
    "apps/api/src/connected-composition-root.ts",
    `${configurationSources.get("apps/api/src/connected-composition-root.ts") ?? ""}
      const OFFLINE_PRIVATE_ENVIRONMENT_KEYS = [
        "PERSONAL_FILING_QUALITY_RESULT_PATH",
        "PERSONAL_FILING_QUALITY_RESULT_SHA256",
        "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH",
        "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256",
        "PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH",
        "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH",
        "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256",
        "PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH",
        "RESEARCH_COCKPIT_VAULT_ROOT",
        "RESEARCH_COCKPIT_VAULT_STARTUP",
        "PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH",
        "PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256",
      ] as const;
    `,
  );
  const configurationManifest = {
    scripts: {
      dev: "tsx watch src/server.ts",
      "dev:connected": "tsx watch src/connected-server.ts",
      "dev:security-master": "tsx watch src/security-master-server.ts",
      "dev:vault": "tsx watch src/vault-server.ts",
      start: "node dist/src/server.js",
      "start:connected": "node dist/src/connected-server.js",
      "start:security-master": "node dist/src/security-master-server.js",
      "start:vault": "node dist/src/vault-server.js",
    },
  };
  const configurationTsup = `
    import "node:path";
    import "tsup";
    import "./src/build-source-identity";
    entry: ["src/server.ts", "src/connected-server.ts", "src/security-master-server.ts", "src/vault-server.ts"];
    splitting: false;
  `;

  const ownerBoundaryFixture = `
    body: "json" | "none"
    body === "json" ? "vault-json" : "vault-empty"
    bodyPolicy: "none" | "vault-empty" | "vault-json" = "none"
    request.raw.rawHeaders
    rawNames.includes("transfer-encoding")
    count(rawNames, PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME) !== 1
    bodyPolicy === "vault-json"
    Number(contentLength.value) > 300 * 1_024
    contentType.value.toLowerCase() !== "application/json"
  `;
  const mutationRouteFixture = `
    app.post("/one", {
      onRequest: async () => {
        authorizePersonalVaultMutationRouteRequest();
      },
    }, (request) => request.body);
    app.post("/two/delete", {
      onRequest: async () => {
        authorizePersonalVaultMutationRouteRequest();
      },
    }, () => undefined);
  `;
  const authSources = new Map([
    ["apps/api/src/personal-vault-routes.ts", mutationRouteFixture],
    ["apps/api/src/personal-owner-session-routes.ts", ownerBoundaryFixture],
  ]);
  const driftedAuthSources = new Map(authSources);
  driftedAuthSources.set(
    "apps/api/src/personal-vault-routes.ts",
    mutationRouteFixture.replace("onRequest:", "preHandler:"),
  );

  const cleanupFixture = `
    const LEGACY_RESEARCH_STATE_PREFIXES = [
      "research-cockpit:alert:",
      "research-cockpit:thesis:",
    ] as const;
    LEGACY_RESEARCH_STATE_PREFIXES.some((prefix) => key.startsWith(prefix));
    storage.removeItem(key);
    scrubLegacyLocalResearchState(window.localStorage);
  `;
  const cleanupComponentFixture = `
    "use client";
    import { useEffect } from "react";
    import { scrubLegacyLocalResearchStateFromWindow } from "@/lib/legacy-local-state-cleanup";
    export function LegacyLocalStateCleanup() {
      useEffect(() => {
        scrubLegacyLocalResearchStateFromWindow();
      }, []);
      return null;
    }
  `;
  const layoutFixture = `
    import { LegacyLocalStateCleanup } from "@/features/research/LegacyLocalStateCleanup";
    function RootLayout() {
      return <html><body><LegacyLocalStateCleanup /></body></html>;
    }
  `;
  const serverFixture = `
    const environment = captureVaultApiEnvironment(process.env);
    process.stdout.write("Research Cockpit personal vault API is listening.\\n");
    process.stderr.write("Research Cockpit personal vault API failed to start.\\n");
    process.exitCode = 1;
  `;

  const regressions = [
    !localResearchVaultExactTree(localResearchVaultPackagePaths),
    localResearchVaultExactTree([
      ...localResearchVaultPackagePaths,
      `${localResearchVaultPackagePrefix}src/network-client.ts`,
    ]),
    localResearchVaultSourceViolation(
      canonicalPath,
      canonicalSource,
      canonicalModules,
    ) !== null,
    localResearchVaultSourceViolation(
      canonicalPath,
      `${canonicalSource}\nvoid fetch("https://provider.invalid");`,
      canonicalModules,
    ) === null,
    localResearchVaultSourceViolation(
      canonicalPath,
      `${canonicalSource}\nvoid import("./runtime-module");`,
      canonicalModules,
    ) === null,
    localResearchVaultSourceViolation(
      canonicalPath,
      `${canonicalSource}\nconsole.log("private");`,
      canonicalModules,
    ) === null,
    localResearchVaultSourceViolation(
      `${localResearchVaultPackagePrefix}src/vault-schema.ts`,
      'import "node:child_process";',
      ["node:child_process"],
    ) === null,
    localResearchVaultSourceViolation(
      localResearchVaultWindowsAclPath,
      'import "node:child_process";',
      ["node:child_process"],
    ) !== null,
    localResearchVaultIndexViolation(exactIndex) !== null,
    localResearchVaultIndexViolation(
      `${exactIndex}\nexport { deep } from "./sqlite-local-research-vault";`,
    ) === null,
    localResearchVaultExternalReference(
      "apps/api/src/vault-app.ts",
      `import ${JSON.stringify(localResearchVaultModule)};`,
    ).deep,
    !localResearchVaultExternalReference(
      "apps/web/src/deep-vault.ts",
      'import "../../../packages/local-research-vault/src/model";',
    ).deep,
    JSON.stringify(
      localResearchVaultImportBindings(
        `import { LOCAL_RESEARCH_VAULT_PROFILE, type LocalResearchVault } from ${JSON.stringify(localResearchVaultModule)};`,
      ).sort(),
    ) !==
      JSON.stringify(
        ["LOCAL_RESEARCH_VAULT_PROFILE", "type LocalResearchVault"].sort(),
      ),
    JSON.stringify(
      localResearchVaultDependencySections({
        dependencies: { [localResearchVaultModule]: "workspace:*" },
      }),
    ) !== JSON.stringify(["dependencies"]),
    localResearchVaultApiGraphViolation(graphSources) !== null,
    localResearchVaultApiGraphViolation(driftedGraphSources) === null,
    localResearchVaultApiConfigurationViolation(
      configurationManifest,
      configurationTsup,
      configurationSources,
    ) !== null,
    localResearchVaultApiConfigurationViolation(
      configurationManifest,
      configurationTsup,
      new Map(
        [...configurationSources].map(([path, content]) => [
          path,
          path === "apps/api/src/api-mode.ts"
            ? content.replace(
                'value !== "personal_single_user_local_vault"',
                'value !== "drifted_vault_mode"',
              )
            : content,
        ]),
      ),
    ) === null,
    localResearchVaultServerProcessViolation(serverFixture) !== null,
    localResearchVaultServerProcessViolation(
      `process.stdout.write(process.env.PRIVATE_CANARY ?? "");\n${serverFixture}`,
    ) === null,
    localResearchVaultAuthBeforeParseViolation(authSources) !== null,
    localResearchVaultAuthBeforeParseViolation(driftedAuthSources) === null,
    localResearchVaultBrowserStorageViolation(
      legacyLocalStateCleanupPath,
      "storage.removeItem(key); window.localStorage;",
    ) !== null,
    localResearchVaultBrowserStorageViolation(
      "apps/web/src/features/research/ThesisMonitor.tsx",
      'window["local" + "Storage"].setItem("thesis", "private");',
    ) === null,
    localResearchVaultBrowserStorageViolation(
      "apps/web/src/features/research/ThesisMonitor.tsx",
      'storage.removeItem("private");',
    ) === null,
    localResearchVaultBrowserStorageViolation(
      "apps/web/src/features/research/ThesisMonitor.tsx",
      'indexedDB.open("private");',
    ) === null,
    localResearchVaultLegacyCleanupViolation(cleanupFixture) !== null,
    localResearchVaultLegacyCleanupViolation(
      cleanupFixture.replace(
        "storage.removeItem(key)",
        'storage.setItem(key, "private")',
      ),
    ) === null,
    localResearchVaultCleanupComponentViolation(cleanupComponentFixture) !==
      null,
    localResearchVaultLayoutCleanupViolation(layoutFixture) !== null,
    localResearchVaultLayoutCleanupViolation(
      layoutFixture.replace("<LegacyLocalStateCleanup />", ""),
    ) === null,
  ];
  const regression = regressions.indexOf(true);
  if (regression !== -1)
    throw new Error(
      `Cycle 3d local-research-vault boundary classifier ${String(regression + 1)} regressed`,
    );
}

async function connectedSourcePolicyBoundaryViolations(): Promise<string[]> {
  const found: string[] = [];
  const actualTree = [...filesToInspect]
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .filter((path) => path.startsWith(connectedSourcePolicyPackagePrefix))
    .sort();
  if (!connectedSourcePolicyExactTree(actualTree))
    found.push(
      `${connectedSourcePolicyPackagePrefix}: Cycle 3c package tree must remain the exact manifest, tsconfig, core, index, test builder, and two-test surface`,
    );

  const manifestPath = `${connectedSourcePolicyPackagePrefix}package.json`;
  const manifest = await cycle2kJson(manifestPath, found);
  const expectedManifest = {
    name: connectedSourcePolicyModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
  };
  if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest))
    found.push(
      `${manifestPath}: connected source policy must remain private, index-only, and zero-production-dependency`,
    );

  const tsconfigPath = `${connectedSourcePolicyPackagePrefix}tsconfig.json`;
  const tsconfig = await cycle2kJson(tsconfigPath, found);
  const expectedTsconfig = {
    extends: "../../tsconfig.base.json",
    compilerOptions: { noEmit: true, types: ["node"] },
    include: ["src/**/*.ts"],
  };
  if (JSON.stringify(tsconfig) !== JSON.stringify(expectedTsconfig))
    found.push(`${tsconfigPath}: Cycle 3c tsconfig must remain exact`);

  const expectedModulesByPath = new Map<string, readonly string[]>([
    [
      `${connectedSourcePolicyPackagePrefix}src/connected-source-policy.ts`,
      ["node:util/types"],
    ],
    [
      `${connectedSourcePolicyPackagePrefix}src/index.ts`,
      ["./connected-source-policy"],
    ],
    [
      `${connectedSourcePolicyPackagePrefix}src/connected-source-policy.test.ts`,
      [
        "vitest",
        "./connected-source-policy",
        "./test-connected-source-policy-builder",
      ],
    ],
    [
      `${connectedSourcePolicyPackagePrefix}src/connected-source-policy-security.test.ts`,
      [
        "vitest",
        "./connected-source-policy",
        "./test-connected-source-policy-builder",
      ],
    ],
    [
      `${connectedSourcePolicyPackagePrefix}src/test-connected-source-policy-builder.ts`,
      ["./connected-source-policy"],
    ],
  ]);
  for (const path of actualTree.filter((entry) => entry.endsWith(".ts"))) {
    const content = await cycle2kText(path, found);
    const expectedModules = expectedModulesByPath.get(path);
    if (expectedModules === undefined) {
      found.push(`${path}: unclassified Cycle 3c source`);
      continue;
    }
    const importViolation = connectedSourcePolicyImportViolation(
      content,
      expectedModules,
    );
    if (importViolation !== null) found.push(`${path}: ${importViolation}`);
  }

  const publicExports = [
    ["CONNECTED_SOURCE_POLICY_HARD_LIMITS", false],
    ["CONNECTED_SOURCE_POLICY_NOT_PROVEN", false],
    ["CONNECTED_SOURCE_POLICY_OPERATIONS", false],
    ["CONNECTED_SOURCE_POLICY_PROFILE", false],
    ["CONNECTED_SOURCE_POLICY_SCHEMA_VERSION", false],
    ["CONNECTED_SOURCE_POLICY_STATUSES", false],
    ["ConnectedSourcePolicyConfigurationError", false],
    ["createConnectedSourcePolicy", false],
    ["createConnectedSourceTransportCapability", false],
    ["isConnectedSourceAdmittedOperationCapability", false],
    ["parseConnectedSourcePolicyConfig", false],
    ["readConnectedSourceResponse", false],
    ["CapturedOwnerLocalSecret", true],
    ["ConnectedSourceAdmittedOperationCapability", true],
    ["ConnectedSourceAllowlistEntry", true],
    ["ConnectedSourceAuthorizationInput", true],
    ["ConnectedSourceAuthorizationResult", true],
    ["ConnectedSourceBudget", true],
    ["ConnectedSourceBudgetReservationInput", true],
    ["ConnectedSourceBudgetReservationCapability", true],
    ["ConnectedSourceBudgetReservationResult", true],
    ["ConnectedSourceBudgetStatus", true],
    ["ConnectedSourceClock", true],
    ["ConnectedSourceControlsPolicy", true],
    ["ConnectedSourceExecutionInput", true],
    ["ConnectedSourceExecutionResult", true],
    ["ConnectedSourceIntendedUse", true],
    ["ConnectedSourceKillResult", true],
    ["ConnectedSourceLegalPolicy", true],
    ["ConnectedSourceOperation", true],
    ["ConnectedSourcePolicy", true],
    ["ConnectedSourcePolicyAdmissionResult", true],
    ["ConnectedSourcePolicyConfig", true],
    ["ConnectedSourcePolicyConfigParseResult", true],
    ["ConnectedSourcePolicyDependencies", true],
    ["ConnectedSourcePolicyDocument", true],
    ["ConnectedSourcePolicyStatus", true],
    ["ConnectedSourcePolicyStatusValue", true],
    ["ConnectedSourceProviderPolicy", true],
    ["ConnectedSourceResponseCapability", true],
    ["ConnectedSourceStatusReason", true],
    ["ConnectedSourceTransportAdapter", true],
    ["ConnectedSourceTransportCapability", true],
    ["ConnectedSourceTransportRequest", true],
    ["ConnectedSourceTransportResult", true],
    ["ConnectedSourceUseScopePolicy", true],
    ["ConnectedSourceValidityPolicy", true],
    ["OwnerLocalSecretAdapter", true],
  ] as const;
  const indexPath = `${connectedSourcePolicyPackagePrefix}src/index.ts`;
  const indexSource = ts.createSourceFile(
    indexPath,
    await cycle2kText(indexPath, found),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (
    indexSource.statements.length !== 1 ||
    !isExactNamedReExportDeclaration(
      indexSource.statements[0],
      "./connected-source-policy",
      publicExports,
    )
  )
    found.push(
      `${indexPath}: Cycle 3c public named export surface must remain exact`,
    );

  for (const path of [
    `${connectedSourcePolicyPackagePrefix}src/connected-source-policy.ts`,
    `${connectedSourcePolicyPackagePrefix}src/index.ts`,
  ]) {
    const content = await cycle2kText(path, found);
    const productionViolation = connectedSourcePolicyProductionViolation(
      path,
      content,
    );
    if (productionViolation !== null)
      found.push(`${path}: ${productionViolation}`);
  }

  const allowedApiImportBindings = new Map<string, readonly string[]>([
    [
      "apps/api/src/connected-composition-root.ts",
      ["type ConnectedSourceClock"],
    ],
    [
      "apps/api/src/connected-source-policy-composition.ts",
      [
        "CONNECTED_SOURCE_POLICY_PROFILE",
        "CONNECTED_SOURCE_POLICY_SCHEMA_VERSION",
        "createConnectedSourcePolicy",
        "parseConnectedSourcePolicyConfig",
        "type ConnectedSourceClock",
        "type ConnectedSourcePolicy",
        "type ConnectedSourcePolicyStatus",
      ],
    ],
    [
      "apps/api/src/connected-source-policy-routes.ts",
      ["type ConnectedSourcePolicyStatus"],
    ],
    [
      "apps/api/src/test-connected-source-policy-builder.ts",
      [
        "type ConnectedSourceClock",
        "type ConnectedSourcePolicyConfig",
        "type ConnectedSourcePolicyDocument",
      ],
    ],
  ]);
  for (const file of externalCompositionFilesToInspect) {
    const path = relative(root, file).replaceAll("\\", "/");
    const content = await readFile(file, "utf8");
    if (!collectModuleSpecifiers(content).includes(connectedSourcePolicyModule))
      continue;
    const expectedBindings = allowedApiImportBindings.get(path);
    if (expectedBindings === undefined) {
      found.push(
        `${path}: only the exact reviewed apps/api files may import ${connectedSourcePolicyModule}`,
      );
      continue;
    }
    if (
      JSON.stringify(connectedSourcePolicyImportBindings(content).sort()) !==
      JSON.stringify([...expectedBindings].sort())
    )
      found.push(
        `${path}: connected source policy imports must remain the exact reviewed status/kill composition bindings`,
      );
  }
  for (const [path] of allowedApiImportBindings) {
    const content = await cycle2kText(path, found);
    if (!collectModuleSpecifiers(content).includes(connectedSourcePolicyModule))
      found.push(`${path}: required Cycle 3c package binding is missing`);
  }
  for (const file of filesToInspect) {
    const path = relative(root, file).replaceAll("\\", "/");
    if (basename(path) !== "package.json") continue;
    const content = await readFile(file, "utf8");
    if (
      content.includes(connectedSourcePolicyModule) &&
      path !== manifestPath &&
      path !== "apps/api/package.json"
    )
      found.push(
        `${path}: only apps/api may declare the connected source policy package`,
      );
  }
  const apiManifest = await cycle2kJson("apps/api/package.json", found);
  if (
    !isRecord(apiManifest?.dependencies) ||
    apiManifest.dependencies[connectedSourcePolicyModule] !== "workspace:*"
  )
    found.push(
      "apps/api/package.json: exact connected source policy workspace dependency is required",
    );
  if (
    !isRecord(apiManifest?.scripts) ||
    apiManifest.scripts["dev:connected"] !==
      "tsx watch src/connected-server.ts" ||
    apiManifest.scripts["start:connected"] !==
      "node dist/src/connected-server.js"
  )
    found.push(
      "apps/api/package.json: distinct Cycle 3c connected development and start entries are required",
    );

  const tsupConfigPath = "apps/api/tsup.config.ts";
  const tsupConfig = await cycle2kText(tsupConfigPath, found);
  if (
    JSON.stringify(collectModuleSpecifiers(tsupConfig)) !==
      JSON.stringify(["node:path", "tsup", "./src/build-source-identity"]) ||
    !hasExactApiBuildEntries(tsupConfig) ||
    !tsupConfig.includes("splitting: false")
  )
    found.push(
      `${tsupConfigPath}: Cycle 3c, Cycle 3d, and Cycle 3e-a require exact separate non-splitting ordinary, connected, security-master, and vault build entries`,
    );

  const apiPaths = [
    "apps/api/src/api-mode.ts",
    "apps/api/src/composition-root.ts",
    "apps/api/src/connected-app.ts",
    "apps/api/src/connected-composition-root.ts",
    "apps/api/src/connected-server.ts",
    "apps/api/src/connected-source-policy-composition.ts",
    "apps/api/src/connected-source-policy-routes.ts",
    "apps/api/src/listen-options.ts",
    "apps/api/src/personal-owner-session.ts",
    "apps/api/src/personal-owner-session-routes.ts",
    "apps/api/src/server.ts",
  ] as const;
  const apiSources = new Map<string, string>();
  for (const path of apiPaths)
    apiSources.set(path, await cycle2kText(path, found));
  const apiModulesByPath = new Map<string, readonly string[]>([
    ["apps/api/src/api-mode.ts", []],
    [
      "apps/api/src/composition-root.ts",
      [
        "fastify",
        "./api-mode",
        "./app",
        "./listen-options",
        "./personal-owner-session",
        "./personal-quality-readiness",
        "./personal-dossier-release",
        "./personal-selected-fact-release",
      ],
    ],
    [
      "apps/api/src/connected-app.ts",
      [
        "node:crypto",
        "@fastify/cors",
        "@fastify/helmet",
        "@research-cockpit/contracts",
        "fastify",
        "./connected-source-policy-composition",
        "./connected-source-policy-routes",
        "./listen-options",
        "./personal-owner-session",
        "./personal-owner-session-routes",
      ],
    ],
    [
      "apps/api/src/connected-composition-root.ts",
      [
        "fastify",
        connectedSourcePolicyModule,
        "./connected-app",
        "./connected-source-policy-composition",
        "./listen-options",
        "./personal-owner-session",
      ],
    ],
    [
      "apps/api/src/connected-server.ts",
      ["./connected-composition-root", "./listen-options"],
    ],
    [
      "apps/api/src/connected-source-policy-composition.ts",
      [
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:path",
        connectedSourcePolicyModule,
      ],
    ],
    [
      "apps/api/src/connected-source-policy-routes.ts",
      [
        connectedSourcePolicyModule,
        "@research-cockpit/contracts",
        "fastify",
        "./connected-source-policy-composition",
        "./listen-options",
        "./personal-owner-session",
        "./personal-owner-session-routes",
      ],
    ],
    [
      "apps/api/src/personal-owner-session-routes.ts",
      [
        "@research-cockpit/contracts",
        "fastify",
        "./listen-options",
        "./personal-owner-session",
      ],
    ],
    ["apps/api/src/listen-options.ts", []],
    [
      "apps/api/src/personal-owner-session.ts",
      ["node:crypto", "node:perf_hooks"],
    ],
    ["apps/api/src/server.ts", ["./composition-root", "./listen-options"]],
  ]);
  for (const [path, expectedModules] of apiModulesByPath) {
    const content = apiSources.get(path) ?? "";
    if (
      JSON.stringify(collectModuleSpecifiers(content)) !==
      JSON.stringify(expectedModules)
    )
      found.push(
        `${path}: runnable Cycle 3c API imports must remain the exact reviewed local/server/status-policy allowlist`,
      );
  }
  const connectedApiPaths = [
    "apps/api/src/connected-app.ts",
    "apps/api/src/connected-composition-root.ts",
    "apps/api/src/connected-server.ts",
    "apps/api/src/connected-source-policy-composition.ts",
    "apps/api/src/connected-source-policy-routes.ts",
    "apps/api/src/listen-options.ts",
    "apps/api/src/personal-owner-session.ts",
    "apps/api/src/personal-owner-session-routes.ts",
  ] as const;
  const connectedApiImportSurfaceDigests = new Map<string, string>([
    [
      "apps/api/src/connected-app.ts",
      "2d1da15dafa0f00aab0948a63fc3f30e602d7ac988051b852bd5b55ddc4a128a",
    ],
    [
      "apps/api/src/connected-composition-root.ts",
      "80c8f047a185d4080d603b533e7e83796be05ace4425c035be8dba4eda322655",
    ],
    [
      "apps/api/src/connected-server.ts",
      "c15c9ffedab7f62fde150cf37dfa7cd70c702bf832d70f8b0025c804d4548dc4",
    ],
    [
      "apps/api/src/connected-source-policy-composition.ts",
      "9341b5a2c3b70a852cec233238786e26f01e747a33d21d9f40b2466b6472b4b3",
    ],
    [
      "apps/api/src/connected-source-policy-routes.ts",
      "cfd5c9b7d3ea2f998637f866e2d570462ef9d99d9bdc3cf3ba7633629d675a61",
    ],
    [
      "apps/api/src/listen-options.ts",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ],
    [
      "apps/api/src/personal-owner-session-routes.ts",
      "0229a37524463b8314d16936db405aab3a48446541f4a8b782ecb6d6a8038ac4",
    ],
    [
      "apps/api/src/personal-owner-session.ts",
      "5179c3c22049380bf3ba893e1b98eafb501d27f59b1c9879eaeaec6da85f7d32",
    ],
  ]);
  const connectedApiSources = new Map(
    connectedApiPaths.map((path) => [path, apiSources.get(path) ?? ""]),
  );
  for (const [path, content] of connectedApiSources) {
    if (
      connectedSourcePolicyImportSurfaceDigest(content) !==
      connectedApiImportSurfaceDigests.get(path)
    )
      found.push(
        `${path}: connected API import clauses and bindings must remain exact`,
      );
  }
  const connectedServerProcessViolation =
    connectedSourcePolicyConnectedServerProcessViolation(
      connectedApiSources.get("apps/api/src/connected-server.ts") ?? "",
    );
  if (connectedServerProcessViolation !== null)
    found.push(
      `apps/api/src/connected-server.ts: ${connectedServerProcessViolation}`,
    );
  const apiSeamViolation =
    connectedSourcePolicyApiSeamViolation(connectedApiSources);
  if (apiSeamViolation !== null) found.push(apiSeamViolation);
  const apiAnchorViolation =
    connectedSourcePolicyApiAnchorViolation(apiSources);
  if (apiAnchorViolation !== null) found.push(apiAnchorViolation);

  const classifierRegressions = [
    !connectedSourcePolicyExactTree(connectedSourcePolicyPackagePaths),
    connectedSourcePolicyExactTree([
      ...connectedSourcePolicyPackagePaths,
      `${connectedSourcePolicyPackagePrefix}src/provider-client.ts`,
    ]),
    connectedSourcePolicyImportViolation(
      'import { isProxy } from "node:util/types";',
      ["node:util/types"],
    ) !== null,
    connectedSourcePolicyImportViolation(
      'import { isProxy } from "node:util/types";\nimport "node:net";',
      ["node:util/types"],
    ) === null,
    connectedSourcePolicyProductionViolation(
      `${connectedSourcePolicyPackagePrefix}src/connected-source-policy.ts`,
      'import { isProxy } from "node:util/types";\nvoid fetch("https://provider.example");',
    ) === null,
    connectedSourcePolicyProductionViolation(
      `${connectedSourcePolicyPackagePrefix}src/connected-source-policy.ts`,
      'import { isProxy } from "node:util/types";\nglobalThis["fetch"](["https", "provider.example"].join("://"));',
    ) === null,
    connectedSourcePolicyProductionViolation(
      `${connectedSourcePolicyPackagePrefix}src/connected-source-policy.ts`,
      'import { isProxy } from "node:util/types";\nconsole.log("private-canary");',
    ) === null,
    connectedSourcePolicyExternalImportViolation(
      "apps/api/src/connected-source-policy-composition.ts",
      `import ${JSON.stringify(connectedSourcePolicyModule)};`,
      allowedApiImportBindings,
    ),
    !connectedSourcePolicyExternalImportViolation(
      "apps/web/src/provider.ts",
      `import ${JSON.stringify(connectedSourcePolicyModule)};`,
      allowedApiImportBindings,
    ),
    connectedSourcePolicyApiSeamViolation(
      new Map([["apps/api/src/connected-app.ts", "status(); kill();"]]),
    ) !== null,
    connectedSourcePolicyApiSeamViolation(
      new Map([
        ["apps/api/src/connected-app.ts", "policy.status(); policy.execute();"],
      ]),
    ) === null,
    connectedSourcePolicyApiSeamViolation(
      new Map([
        [
          "apps/api/src/connected-source-policy-composition.ts",
          'void fetch("https://provider.example/v1");',
        ],
      ]),
    ) === null,
    connectedSourcePolicyApiSeamViolation(
      new Map([
        [
          "apps/api/src/connected-source-policy-composition.ts",
          'import "node:https";',
        ],
      ]),
    ) === null,
    connectedSourcePolicyApiSeamViolation(
      new Map([
        ["apps/api/src/connected-server.ts", 'import "./listen-options";'],
        [
          "apps/api/src/listen-options.ts",
          'void fetch("https://provider.example/v1");',
        ],
      ]),
    ) === null,
    connectedSourcePolicyApiSeamViolation(
      new Map([
        [
          "apps/api/src/connected-source-policy-routes.ts",
          "console.log(request.headers.cookie);",
        ],
      ]),
    ) === null,
    connectedSourcePolicyApiSeamViolation(
      new Map([
        [
          "apps/api/src/connected-source-policy-routes.ts",
          'globalThis["fetch"](["https", "provider.example"].join("://"));',
        ],
      ]),
    ) === null,
    connectedSourcePolicyConnectedServerProcessViolation(`
      process.stdout.write(process.env.PRIVATE_CANARY ?? "");
      const captured = captureConnectedApiEnvironment(process.env);
      process.stdout.write("Research Cockpit connected local API is listening.\\n");
      process.stderr.write("Research Cockpit connected local API failed to start.\\n");
      process.exitCode = 1;
    `) === null,
    connectedSourcePolicyImportSurfaceDigest(
      (
        apiSources.get("apps/api/src/connected-source-policy-composition.ts") ??
        ""
      ).replace(
        'import { lstat, open } from "node:fs/promises";',
        'import { lstat, open, writeFile } from "node:fs/promises";',
      ),
    ) ===
      connectedApiImportSurfaceDigests.get(
        "apps/api/src/connected-source-policy-composition.ts",
      ),
  ];
  const regressedClassifier = classifierRegressions.indexOf(true);
  if (regressedClassifier !== -1)
    throw new Error(
      `Cycle 3c connected-source boundary classifier ${String(regressedClassifier + 1)} regressed`,
    );

  return found;
}

function connectedSourcePolicyExactTree(actual: readonly string[]): boolean {
  return (
    JSON.stringify([...actual].sort()) ===
    JSON.stringify(connectedSourcePolicyPackagePaths)
  );
}

function connectedSourcePolicyImportViolation(
  content: string,
  expectedModules: readonly string[],
): string | null {
  if (
    JSON.stringify(collectModuleSpecifiers(content)) !==
    JSON.stringify(expectedModules)
  )
    return "Cycle 3c imports must remain the exact reviewed per-file allowlist";
  if (
    hasRuntimeDynamicImport(content) ||
    hasForbiddenDynamicCodeCapability(content) ||
    hasUnresolvedRuntimeModuleLoad(content) ||
    hasIndirectRuntimeModuleLoad(content)
  )
    return "Cycle 3c runtime module loading and dynamic code are forbidden";
  return null;
}

function connectedSourcePolicyProductionViolation(
  path: string,
  content: string,
): string | null {
  const expectedModules =
    path === `${connectedSourcePolicyPackagePrefix}src/index.ts`
      ? ["./connected-source-policy"]
      : ["node:util/types"];
  const importViolation = connectedSourcePolicyImportViolation(
    content,
    expectedModules,
  );
  if (importViolation !== null) return importViolation;
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const forbiddenGlobals = connectedSourcePolicyForbiddenGlobals();
  forbiddenGlobals.add("env");
  if (findIdentifiers(source, forbiddenGlobals).length > 0)
    return "production source must not use network, process, environment, or fetch globals";
  let concreteEndpoint = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteralLike(node) &&
      /(?:https?|wss?):\/\//iu.test(node.text)
    )
      concreteEndpoint = true;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return concreteEndpoint
    ? "production source must not embed a concrete provider or network endpoint"
    : null;
}

function connectedSourcePolicyImportBindings(content: string): string[] {
  const source = ts.createSourceFile(
    "connected-source-policy-import.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const bindings: string[] = [];
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== connectedSourcePolicyModule
    )
      continue;
    const clause = statement.importClause;
    if (clause === undefined) {
      bindings.push("<side-effect>");
      continue;
    }
    if (clause.name !== undefined)
      bindings.push(`<default:${clause.name.text}>`);
    const named = clause.namedBindings;
    if (named === undefined) continue;
    if (ts.isNamespaceImport(named)) {
      bindings.push(`<namespace:${named.name.text}>`);
      continue;
    }
    for (const element of named.elements) {
      const imported = (element.propertyName ?? element.name).text;
      const local = element.name.text;
      const binding = imported === local ? imported : `${imported} as ${local}`;
      bindings.push(
        clause.isTypeOnly || element.isTypeOnly ? `type ${binding}` : binding,
      );
    }
  }
  return bindings;
}

function connectedSourcePolicyImportSurfaceDigest(content: string): string {
  const source = ts.createSourceFile(
    "connected-source-policy-import-surface.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const surface = source.statements
    .filter(ts.isImportDeclaration)
    .map((declaration) => declaration.getText(source))
    .join("\n");
  return createHash("sha256").update(surface).digest("hex");
}

function connectedSourcePolicyExternalImportViolation(
  path: string,
  content: string,
  allowed: ReadonlyMap<string, readonly string[]>,
): boolean {
  if (!collectModuleSpecifiers(content).includes(connectedSourcePolicyModule))
    return false;
  return !allowed.has(path) || !path.startsWith("apps/api/");
}

function connectedSourcePolicyConnectedServerProcessViolation(
  content: string,
): string | null {
  const source = ts.createSourceFile(
    "apps/api/src/connected-server.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const positions = {
    env: [] as number[],
    exitCode: [] as number[],
    stderr: [] as number[],
    stdout: [] as number[],
  };
  let invalid = false;
  const fixedWrites = new Map([
    ["stderr", "Research Cockpit connected local API failed to start.\n"],
    ["stdout", "Research Cockpit connected local API is listening.\n"],
  ]);
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === "process") {
      const access = node.parent;
      if (
        !ts.isPropertyAccessExpression(access) ||
        access.expression !== node
      ) {
        invalid = true;
      } else if (access.name.text === "env") {
        const call = access.parent;
        if (
          !ts.isCallExpression(call) ||
          !ts.isIdentifier(call.expression) ||
          call.expression.text !== "captureConnectedApiEnvironment" ||
          call.arguments.length !== 1 ||
          call.arguments[0] !== access
        ) {
          invalid = true;
        } else {
          positions.env.push(access.getStart(source));
        }
      } else if (
        access.name.text === "stdout" ||
        access.name.text === "stderr"
      ) {
        const writeAccess = access.parent;
        const call = writeAccess.parent;
        const argument = ts.isCallExpression(call) ? call.arguments[0] : null;
        if (
          !ts.isPropertyAccessExpression(writeAccess) ||
          writeAccess.expression !== access ||
          writeAccess.name.text !== "write" ||
          !ts.isCallExpression(call) ||
          call.expression !== writeAccess ||
          call.arguments.length !== 1 ||
          argument === undefined ||
          argument === null ||
          !ts.isStringLiteralLike(argument) ||
          argument.text !== fixedWrites.get(access.name.text)
        ) {
          invalid = true;
        } else {
          positions[access.name.text].push(access.getStart(source));
        }
      } else if (access.name.text === "exitCode") {
        const assignment = access.parent;
        if (
          !ts.isBinaryExpression(assignment) ||
          assignment.left !== access ||
          assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
          !ts.isNumericLiteral(assignment.right) ||
          assignment.right.text !== "1"
        ) {
          invalid = true;
        } else {
          positions.exitCode.push(access.getStart(source));
        }
      } else {
        invalid = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (
    invalid ||
    positions.env.length !== 1 ||
    positions.stdout.length !== 1 ||
    positions.stderr.length !== 1 ||
    positions.exitCode.length !== 1 ||
    !(
      positions.env[0]! < positions.stdout[0]! &&
      positions.stdout[0]! < positions.stderr[0]! &&
      positions.stderr[0]! < positions.exitCode[0]!
    )
  ) {
    return "process access must remain one first-step environment capture followed only by fixed stdout/stderr messages and exitCode assignment";
  }
  return null;
}

function connectedSourcePolicyForbiddenGlobals(): Set<string> {
  return new Set([
    "EventSource",
    "WebSocket",
    "XMLHttpRequest",
    "console",
    "fetch",
    "global",
    "globalThis",
    "process",
    "queueMicrotask",
    "self",
    "setImmediate",
    "setInterval",
    "setTimeout",
    "window",
  ]);
}

function connectedSourcePolicyApiSeamViolation(
  sources: ReadonlyMap<string, string>,
): string | null {
  const forbidden =
    /\b(?:OwnerLocalSecretAdapter|ConnectedSourceAdmittedOperationCapability|ConnectedSourceResponseCapability|ConnectedSourceTransport\w*|authorizeOperation|createConnectedSourceTransportCapability|execute|readConnectedSourceResponse|reserveBudget|secretAdapter|transportCapability)\b/u;
  const forbiddenNetworkModule =
    /^(?:node:)?(?:child_process|cluster|dgram|dns|http|http2|https|net|tls|worker_threads)(?:\/|$)/u;
  for (const [path, content] of sources) {
    if (forbidden.test(content))
      return `${path}: runnable API must remain status/kill-only and must not compose transport, secret, execute, reserve, or authorize seams`;
    if (
      collectModuleSpecifiers(content).some((module) =>
        forbiddenNetworkModule.test(module),
      ) ||
      hasRuntimeDynamicImport(content) ||
      hasForbiddenDynamicCodeCapability(content) ||
      hasUnresolvedRuntimeModuleLoad(content) ||
      hasIndirectRuntimeModuleLoad(content)
    )
      return `${path}: runnable API must not compose provider SDKs, direct network modules, or dynamic runtime loading`;
    const source = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const forbiddenGlobals = connectedSourcePolicyForbiddenGlobals();
    if (path !== "apps/api/src/connected-server.ts")
      forbiddenGlobals.add("process");
    else forbiddenGlobals.delete("process");
    if (findIdentifiers(source, forbiddenGlobals).length > 0)
      return `${path}: connected API must not use direct network or background globals or access process state outside its reviewed startup entry`;
    if (
      /CONNECTED_SOURCE_POLICY_(?:API_KEY|CREDENTIAL|TOKEN|SECRET(?!_REFERENCE))/u.test(
        content,
      )
    )
      return `${path}: plaintext connected-source credential startup inputs are forbidden`;
    let concreteEndpoint = false;
    const visit = (node: ts.Node): void => {
      if (
        ts.isStringLiteralLike(node) &&
        /(?:https?|wss?):\/\//iu.test(node.text) &&
        !node.text.startsWith("https://research-cockpit.local/") &&
        !/^http:\/\/(?:\[::1\]|localhost|127\.0\.0\.1)(?::[0-9]+)?(?:\/|$)/u.test(
          node.text,
        )
      )
        concreteEndpoint = true;
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (concreteEndpoint)
      return `${path}: runnable API must not embed a concrete provider or real-network endpoint`;
  }
  return null;
}

function connectedSourcePolicyApiAnchorViolation(
  sources: ReadonlyMap<string, string>,
): string | null {
  const required = new Map<string, readonly string[]>([
    ["apps/api/src/api-mode.ts", ["personal_single_user_local_connected"]],
    [
      "apps/api/src/connected-source-policy-routes.ts",
      [
        '"/v1/personal-filing/connected-source-policy/status"',
        '"/v1/personal-filing/connected-source-policy/kill"',
        '"connected-source-policy-kill"',
        "authorizePersonalRouteRequest(",
        "authorizePersonalMutationRouteRequest(",
        'header("Cache-Control", "private, no-store")',
        "schemaVersion: status.schemaVersion",
        "profile: status.profile",
        "status: status.status",
        "reasonCode: status.reasonCode",
        "sourceId: status.sourceId",
        "policyId: status.policyId",
        "policyVersion: status.policyVersion",
        "budget: status.budget",
      ],
    ],
    [
      "apps/api/src/personal-owner-session-routes.ts",
      ['PersonalOwnerMutationIntent = "connected-source-policy-kill"'],
    ],
    [
      "apps/api/src/connected-source-policy-composition.ts",
      [
        '"CONNECTED_SOURCE_POLICY_BUNDLE_PATH"',
        '"CONNECTED_SOURCE_POLICY_BUNDLE_SHA256"',
        '"CONNECTED_SOURCE_POLICY_SECRET_REFERENCE"',
        "status(): ConnectedSourcePolicyStatus",
        "kill(): void",
        "createConnectedSourcePolicy(parsedConfig.config, { clock })",
        "status: () => policy.status()",
        "policy.kill()",
      ],
    ],
    [
      "apps/api/src/connected-composition-root.ts",
      [
        '"personal_single_user_local_connected"',
        "CONNECTED_MODE_REQUIRED",
        "CONNECTED_MODE_REJECTS_OFFLINE_CONFIGURATION",
        "CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY",
        "CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY",
        "CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY",
        "loadConnectedSourcePolicyAdministration(",
        "buildConnectedSourcePolicyApp(",
        "disposeCapturedConnectedApiEnvironment(",
      ],
    ],
    [
      "apps/api/src/connected-app.ts",
      [
        "buildConnectedSourcePolicyApp(",
        "registerPersonalOwnerSessionRoutes(",
        "registerConnectedSourcePolicyRoutes(",
        'header("Cache-Control", "private, no-store")',
      ],
    ],
    [
      "apps/api/src/connected-server.ts",
      [
        "captureConnectedApiEnvironment(process.env)",
        "createConnectedConfiguredApp(",
        "connectedSourceClock",
      ],
    ],
    [
      "apps/api/src/composition-root.ts",
      ["CONNECTED_MODE_REQUIRES_CONNECTED_ENTRYPOINT"],
    ],
  ]);
  for (const [path, anchors] of required) {
    const content = sources.get(path);
    if (
      content === undefined ||
      anchors.some((anchor) => !content.includes(anchor))
    )
      return `${path}: exact Cycle 3c mode, route, intent, status/kill, private-response, or startup-scrub anchors regressed`;
  }
  return null;
}

function filingPayloadCustodyReviewedSurfaceBoundaryViolations(): Promise<
  string[]
> {
  const found: string[] = [];
  const actualTree = [...filesToInspect]
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .filter((path) => path.startsWith("packages/filing-payload-custody/"))
    .sort();
  if (
    JSON.stringify(actualTree) !==
    JSON.stringify(filingPayloadCustodyPackagePaths)
  )
    found.push(
      "packages/filing-payload-custody/: custody package tree must remain the exact reviewed Cycle 2c v1 surfaces plus the three Cycle 2o exact-pair files",
    );
  return Promise.resolve(found);
}

async function filingParserCustodyQualityCompositionBoundaryViolations(): Promise<
  string[]
> {
  const found: string[] = [];
  const actualTree = [...filesToInspect]
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .filter((path) =>
      path.startsWith(filingParserCustodyQualityCompositionPackagePrefix),
    )
    .sort();
  if (
    JSON.stringify(actualTree) !==
    JSON.stringify(filingParserCustodyQualityCompositionPackagePaths)
  )
    found.push(
      `${filingParserCustodyQualityCompositionPackagePrefix}: Cycle 2o package tree must remain the exact seven-file manifest, tsconfig, core, index, builder, and two-test surface`,
    );

  const manifestPath = `${filingParserCustodyQualityCompositionPackagePrefix}package.json`;
  const manifest = await cycle2kJson(manifestPath, found);
  const expectedManifest = {
    name: filingParserCustodyQualityCompositionModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
    dependencies: {
      [filingParserQualityCompositionModule]: "workspace:*",
      [filingPayloadCustodyModule]: "workspace:*",
    },
  };
  if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest))
    found.push(
      "Cycle 2o custody-quality composition manifest must retain exactly its two reviewed workspace dependencies and index-only export surface",
    );

  const tsconfigPath = `${filingParserCustodyQualityCompositionPackagePrefix}tsconfig.json`;
  const tsconfig = await cycle2kJson(tsconfigPath, found);
  const expectedTsconfig = {
    extends: "../../tsconfig.base.json",
    compilerOptions: { noEmit: true, types: ["node"] },
    include: ["src/**/*.ts"],
  };
  if (JSON.stringify(tsconfig) !== JSON.stringify(expectedTsconfig))
    found.push(
      "Cycle 2o custody-quality composition tsconfig must remain exact",
    );

  for (const path of actualTree.filter((entry) => entry.endsWith(".ts"))) {
    const content = await cycle2kText(path, found);
    const violation = filingParserCustodyQualityCompositionImportViolation(
      path,
      content,
    );
    if (violation !== null) found.push(`${path}: ${violation}`);
  }

  const index = await cycle2kText(
    filingParserCustodyQualityCompositionIndexPath,
    found,
  );
  const indexSource = ts.createSourceFile(
    filingParserCustodyQualityCompositionIndexPath,
    index,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const indexDeclaration = indexSource.statements[0];
  if (
    indexSource.statements.length !== 1 ||
    indexDeclaration === undefined ||
    !isExactNamedReExportDeclaration(
      indexDeclaration,
      "./filing-parser-custody-quality-composition",
      filingParserCustodyQualityCompositionPublicExports,
    )
  )
    found.push(
      "Cycle 2o custody-quality composition public index must remain exact",
    );

  const externalAllow = new Set([
    ...filingParserCustodyQualityCompositionPackagePaths,
    "scripts/verify-boundaries.ts",
    "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
    ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
    "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  ]);
  if (
    filingParserCustodyQualityCompositionExternalViolation(
      `${filingParserCrossEngineExecutionAcceptanceSourcePrefix}evidence.ts`,
      `import ${JSON.stringify(filingParserCustodyQualityCompositionModule)};`,
      externalAllow,
    ) ||
    !filingParserCustodyQualityCompositionExternalViolation(
      "apps/api/src/cycle2o.ts",
      `import ${JSON.stringify(filingParserCustodyQualityCompositionModule)};`,
      externalAllow,
    ) ||
    !filingParserCustodyQualityCompositionExternalViolation(
      ".github/workflows/unrelated.yml",
      `run: pnpm --filter ${filingParserCustodyQualityCompositionModule} test`,
      externalAllow,
    )
  )
    throw new Error("Cycle 2o external-composition classifier regressed");
  const externalFiles = new Set([
    ...externalCompositionFilesToInspect,
    ...[...filesToInspect].filter((file) => {
      const name = basename(file).toLowerCase();
      return name === "package.json" || isTypeScriptConfigFileName(name);
    }),
  ]);
  for (const file of externalFiles) {
    const path = relative(root, file).replaceAll("\\", "/");
    const content = await readFile(file, "utf8");
    if (
      filingParserCustodyQualityCompositionExternalViolation(
        path,
        content,
        externalAllow,
      )
    )
      found.push(
        `${path}: Cycle 2o custody-quality composition is outside the exact reviewed acceptance/evidence boundary`,
      );
  }
  return found;
}

function filingParserCustodyQualityCompositionImportViolation(
  path: string,
  content: string,
): string | null {
  const expectedModules =
    filingParserCustodyQualityCompositionModules.get(path);
  if (expectedModules === undefined)
    return "unclassified Cycle 2o custody-quality composition source";
  const actualModules = collectModuleSpecifiers(content);
  if (JSON.stringify(actualModules) !== JSON.stringify(expectedModules))
    return "Cycle 2o imports must remain the exact reviewed per-file allowlist";
  if (
    hasRuntimeDynamicImport(content) ||
    hasForbiddenDynamicCodeCapability(content) ||
    hasUnresolvedRuntimeModuleLoad(content) ||
    hasIndirectRuntimeModuleLoad(content)
  )
    return "Cycle 2o runtime module loading and dynamic code are forbidden";

  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let forbiddenGlobal: string | null = null;
  const visit = (node: ts.Node): void => {
    if (
      forbiddenGlobal === null &&
      ts.isIdentifier(node) &&
      forbiddenFilingParserCustodyQualityCompositionGlobals.has(node.text)
    ) {
      forbiddenGlobal = node.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return forbiddenGlobal === null
    ? null
    : "Cycle 2o network, process, global crypto, logging, and dynamic-code globals are forbidden";
}

function filingParserCustodyQualityCompositionExternalViolation(
  path: string,
  content: string,
  allowedPaths: ReadonlySet<string>,
): boolean {
  if (
    allowedPaths.has(path) ||
    path.startsWith(filingParserCustodyQualityCompositionPackagePrefix) ||
    path.startsWith(filingParserCrossEngineExecutionAcceptancePackagePrefix)
  )
    return false;
  const normalizedContent = content.replaceAll("\\", "/");
  return (
    normalizedContent.includes(filingParserCustodyQualityCompositionModule) ||
    normalizedContent.includes(
      filingParserCustodyQualityCompositionPackagePrefix,
    ) ||
    collectModuleSpecifiers(content).some((specifier) =>
      referencesFilingParserCustodyQualityCompositionPath(path, specifier),
    )
  );
}

async function cycle2kText(path: string, found: string[]): Promise<string> {
  try {
    return await readFile(join(root, path), "utf8");
  } catch {
    found.push(`${path}: required Cycle 2k file is missing`);
    return "";
  }
}

function cycle2kExactTree(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
  );
}

function cycle2kExternalCompositionViolation(
  path: string,
  content: string,
  allowedPaths: ReadonlySet<string>,
): boolean {
  if (allowedPaths.has(path)) return false;
  return (
    content.includes(filingParserCrossEngineExecutionModule) ||
    content.includes(filingParserCrossEngineExecutionPackagePrefix) ||
    filingParserCrossEngineExecutionRootScriptAliases.some((alias) =>
      content.includes(alias),
    )
  );
}

function filingParserCycle2oTransitionTupleViolation(
  verifier: string,
  runner: string,
  workflow: string,
): string | null {
  const verifierTuple = filingParserCycle2oLiteralTuple(
    verifier,
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_PATH_COUNT",
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_SHA256",
    true,
    filingParserCycle2oTransitionPathCount,
    filingParserCycle2oTransitionSha256,
  );
  const runnerTuple = filingParserCycle2oLiteralTuple(
    runner,
    "CYCLE_2O_TRANSITION_PATH_COUNT",
    "CYCLE_2O_TRANSITION_SHA256",
    false,
    filingParserCycle2oTransitionPathCount,
    filingParserCycle2oTransitionSha256,
  );
  const correctiveVerifierTuple = filingParserCycle2oLiteralTuple(
    verifier,
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CORRECTIVE_TRANSITION_PATH_COUNT",
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CORRECTIVE_TRANSITION_SHA256",
    true,
    filingParserCycle2oCorrectiveTransitionPathCount,
    filingParserCycle2oCorrectiveTransitionSha256,
  );
  const correctiveRunnerTuple = filingParserCycle2oLiteralTuple(
    runner,
    "CYCLE_2O_CORRECTIVE_TRANSITION_PATH_COUNT",
    "CYCLE_2O_CORRECTIVE_TRANSITION_SHA256",
    false,
    filingParserCycle2oCorrectiveTransitionPathCount,
    filingParserCycle2oCorrectiveTransitionSha256,
  );
  const workflowHasExactClassifier =
    filingParserCycle2oTransitionNulFieldCount ===
      filingParserCycle2oTransitionPathCount * 2 &&
    workflow.includes(
      `mapfile -d '' -t actual < <(git diff --name-status --no-renames -z "$baseline" HEAD --)`,
    ) &&
    workflow.includes(
      `transition_sha256="$(git diff --name-status --no-renames -z "$baseline" HEAD -- | sha256sum | cut -d ' ' -f 1)"`,
    ) &&
    workflow.includes(
      `[[ "\${#actual[@]}" == "${filingParserCycle2oTransitionNulFieldCount}" ]]`,
    ) &&
    workflow.includes(
      `[[ "$transition_sha256" == "${filingParserCycle2oTransitionBareSha256}" ]]`,
    ) &&
    !workflow.includes(`sha256:${filingParserCycle2oTransitionBareSha256}`);
  const expectedCorrectiveFields = filingParserCycle2oCorrectiveTransitionPaths
    .flatMap((path) => ['            "M"', `            "${path}"`])
    .join("\n");
  const workflowHasExactCorrectiveClassifier =
    filingParserCycle2oCorrectiveTransitionNulFieldCount ===
      filingParserCycle2oCorrectiveTransitionPathCount * 2 &&
    filingParserCycle2oCorrectiveTransitionPaths.length ===
      filingParserCycle2oCorrectiveTransitionPathCount &&
    workflow.includes(`source="${filingParserCycle2oSourceRevision}"`) &&
    workflow.includes(
      `expected_corrective=(\n${expectedCorrectiveFields}\n          )`,
    ) &&
    workflow.includes(
      `mapfile -d '' -t actual_corrective < <(git diff --name-status --no-renames -z "$source" HEAD --)`,
    ) &&
    workflow.includes(
      `corrective_sha256="$(git diff --name-status --no-renames -z "$source" HEAD -- | sha256sum | cut -d ' ' -f 1)"`,
    ) &&
    workflow.includes(
      "matches_exactly expected_corrective actual_corrective",
    ) &&
    workflow.includes('[[ "$successor_count" == "2" ]]') &&
    workflow.includes('[[ "$first_parent_count" == "2" ]]') &&
    workflow.includes('[[ "${topology[1]}" == "$source" ]]') &&
    workflow.includes(
      `[[ "$corrective_sha256" == "${filingParserCycle2oCorrectiveTransitionBareSha256}" ]]`,
    ) &&
    !workflow.includes(
      `sha256:${filingParserCycle2oCorrectiveTransitionBareSha256}`,
    );
  if (
    !verifierTuple ||
    !runnerTuple ||
    !correctiveVerifierTuple ||
    !correctiveRunnerTuple ||
    !filingParserCycle2oRunnerChecksTuple(
      runner,
      "entries.length",
      "sha256(output)",
      "CYCLE_2O_TRANSITION_PATH_COUNT",
      "CYCLE_2O_TRANSITION_SHA256",
    ) ||
    !filingParserCycle2oRunnerChecksTuple(
      runner,
      "correctiveEntries.length",
      "sha256(correctiveOutput)",
      "CYCLE_2O_CORRECTIVE_TRANSITION_PATH_COUNT",
      "CYCLE_2O_CORRECTIVE_TRANSITION_SHA256",
    ) ||
    !verifier.includes(
      "filingParserCrossEngineExecutionV5CorrectiveTransitionAllowed(\n        correctiveTransition.length,\n        sha256(correctiveBytes),",
    ) ||
    !workflowHasExactClassifier ||
    !workflowHasExactCorrectiveClassifier
  )
    return "Cycle 2o transition classifiers must agree on the exact source and corrective-child NUL tuples and reject zero, drifted, or marker-only placeholders";
  return null;
}

function filingParserCycle2oLiteralTuple(
  content: string,
  countName: string,
  digestName: string,
  exported: boolean,
  expectedPathCount: number,
  expectedSha256: string,
): boolean {
  const sourceFile = ts.createSourceFile(
    "cycle2o-transition-tuple.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let countMatches = 0;
  let digestMatches = 0;
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const isExported =
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ) ?? false;
    if (
      isExported !== exported ||
      (statement.declarationList.flags & ts.NodeFlags.Const) === 0
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.initializer === undefined
      )
        continue;
      const initializer = unwrapBoundaryExpression(declaration.initializer);
      if (
        declaration.name.text === countName &&
        ts.isNumericLiteral(initializer) &&
        Number(initializer.text) === expectedPathCount
      )
        countMatches += 1;
      if (
        declaration.name.text === digestName &&
        ts.isStringLiteralLike(initializer) &&
        initializer.text === expectedSha256
      )
        digestMatches += 1;
    }
  }
  return countMatches === 1 && digestMatches === 1;
}

function filingParserCycle2oRunnerChecksTuple(
  content: string,
  entriesExpression: string,
  digestExpression: string,
  countName: string,
  digestName: string,
): boolean {
  const sourceFile = ts.createSourceFile(
    "cycle2o-transition-runner.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isIfStatement(node)) {
      let checksPathCount = false;
      let checksDigest = false;
      const inspectCondition = (condition: ts.Node): void => {
        if (
          ts.isBinaryExpression(condition) &&
          condition.operatorToken.kind ===
            ts.SyntaxKind.ExclamationEqualsEqualsToken
        ) {
          const left = condition.left.getText(sourceFile);
          const right = condition.right.getText(sourceFile);
          if (left === entriesExpression && right === countName)
            checksPathCount = true;
          if (left === digestExpression && right === digestName)
            checksDigest = true;
        }
        ts.forEachChild(condition, inspectCondition);
      };
      inspectCondition(node.expression);
      if (checksPathCount && checksDigest) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function cycle2kWorkerModuleViolation(
  path: string,
  content: string,
): string | null {
  const parserPath = `${filingParserCrossEngineExecutionPackagePrefix}worker/parser.mjs`;
  const testPath = `${filingParserCrossEngineExecutionPackagePrefix}worker/parser.test.mjs`;
  const expected =
    path === parserPath
      ? ["node:crypto", "node:fs/promises", "node:url", "node:zlib"]
      : path === testPath
        ? [
            "./parser.mjs",
            "node:assert/strict",
            "node:fs/promises",
            "node:test",
            "node:zlib",
          ]
        : null;
  if (expected === null) return "unreviewed worker module path";
  const actual = [...new Set(collectModuleSpecifiers(content))].sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort()))
    return "worker imports must remain the exact reviewed built-in/direct-parser set";
  if (
    /\bimport\s*\(/u.test(content) ||
    /\brequire\s*\(/u.test(content) ||
    /\b(?:eval|Function)\s*\(/u.test(content) ||
    /\b(?:fetch|WebSocket|EventSource|XMLHttpRequest|Worker)\b/u.test(
      content,
    ) ||
    /["'](?:node:)?(?:child_process|cluster|dgram|dns|http|https|net|tls|worker_threads)["']/u.test(
      content,
    )
  )
    return "dynamic code, networking, subprocesses, and worker threads are forbidden";
  return null;
}

function cycle2kExpectedTaxonomy(): {
  family: string;
  version: string;
  namespace: string;
  facts: Array<{
    key: string;
    concept: string;
    periodKind: string;
    unit: string;
  }>;
} {
  return {
    family: "rc-synthetic-ten-fact",
    version: "1.0.0",
    namespace:
      "urn:research-cockpit:synthetic:filing-normalization-execution:v1",
    facts: [
      {
        key: "assets",
        concept: "rc-synthetic:Assets",
        periodKind: "instant",
        unit: "USD",
      },
      {
        key: "cash",
        concept: "rc-synthetic:CashAndCashEquivalents",
        periodKind: "instant",
        unit: "USD",
      },
      {
        key: "debt",
        concept: "rc-synthetic:Debt",
        periodKind: "instant",
        unit: "USD",
      },
      {
        key: "diluted_shares",
        concept: "rc-synthetic:WeightedAverageDilutedShares",
        periodKind: "duration",
        unit: "shares",
      },
      {
        key: "free_cash_flow",
        concept: "rc-synthetic:FreeCashFlow",
        periodKind: "duration",
        unit: "USD",
      },
      {
        key: "gross_profit",
        concept: "rc-synthetic:GrossProfit",
        periodKind: "duration",
        unit: "USD",
      },
      {
        key: "net_income",
        concept: "rc-synthetic:NetIncome",
        periodKind: "duration",
        unit: "USD",
      },
      {
        key: "operating_cash_flow",
        concept: "rc-synthetic:OperatingCashFlow",
        periodKind: "duration",
        unit: "USD",
      },
      {
        key: "operating_income",
        concept: "rc-synthetic:OperatingIncome",
        periodKind: "duration",
        unit: "USD",
      },
      {
        key: "revenue",
        concept: "rc-synthetic:Revenue",
        periodKind: "duration",
        unit: "USD",
      },
    ],
  };
}

function cycle2kExactTaxonomy(value: unknown): boolean {
  return JSON.stringify(value) === JSON.stringify(cycle2kExpectedTaxonomy());
}

async function cycle2kJson(
  path: string,
  found: string[],
): Promise<Record<string, unknown> | null> {
  const text = await cycle2kText(path, found);
  try {
    const value = JSON.parse(text) as unknown;
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    found.push(`${path}: Cycle 2k JSON must parse`);
    return null;
  }
}

function exactFilingFactComparisonTreeViolation(
  packagePaths: readonly string[],
): string | null {
  const actual = [...packagePaths].sort();
  return JSON.stringify(actual) ===
    JSON.stringify(filingFactComparisonPackagePaths)
    ? null
    : "package tree must remain the exact reviewed manifest, tsconfig, core, two validators, index, builder, and two tests";
}

function exactFilingQualityMeasurementTreeViolation(
  packagePaths: readonly string[],
): string | null {
  const actual = [...packagePaths].sort();
  return JSON.stringify(actual) ===
    JSON.stringify(filingQualityMeasurementPackagePaths)
    ? null
    : "package tree must remain the exact reviewed manifest, tsconfig, core, index, builder, and two tests";
}

function exactFilingQualityPrecommitmentTreeViolation(
  packagePaths: readonly string[],
): string | null {
  const actual = [...packagePaths].sort();
  return JSON.stringify(actual) ===
    JSON.stringify(filingQualityPrecommitmentPackagePaths)
    ? null
    : "package tree must remain the exact reviewed manifest, tsconfig, core, index, builder, and two tests";
}

function exactFilingParserNormalizationHandoffTreeViolation(
  packagePaths: readonly string[],
): string | null {
  const actual = [...packagePaths].sort();
  return JSON.stringify(actual) ===
    JSON.stringify(filingParserNormalizationHandoffPackagePaths)
    ? null
    : "package tree must remain the exact reviewed manifest, tsconfig, core, index, builder, and two tests";
}

function exactFilingParserNormalizationExecutionTreeViolation(
  packagePaths: readonly string[],
): string | null {
  const actual = [...packagePaths].sort();
  return JSON.stringify(actual) ===
    JSON.stringify(filingParserNormalizationExecutionPackagePaths)
    ? null
    : "package tree must remain the exact reviewed manifest, tsconfig, image review, core, index, builder, two TypeScript tests, Dockerfile, parser, parser test, and taxonomy";
}

function exactFilingParserNormalizationExecutionAcceptanceTreeViolation(
  packagePaths: readonly string[],
): string | null {
  const actual = [...packagePaths].sort();
  return JSON.stringify(actual) ===
    JSON.stringify(filingParserNormalizationExecutionAcceptancePackagePaths)
    ? null
    : "acceptance package tree must remain the exact reviewed 13-file manifest, tsconfig, index, live runner and test, evidence model, verifier, review CLI, builder, and three evidence tests";
}

function inspectDependencies(path: string, manifest: unknown): void {
  if (!isRecord(manifest)) {
    violations.push(`${path}: package manifest must be an object`);
    return;
  }
  for (const violation of dependencyPolicyViolations(
    manifest,
    workspacePackageNames,
  ))
    violations.push(`${path}: ${violation}`);
  if (
    path === "package.json" &&
    manifest.packageManager !== expectedPackageManager
  )
    violations.push(
      `${path}: packageManager must remain exactly ${expectedPackageManager}`,
    );
  const dependencyNames = [
    ...recordKeys(manifest.dependencies),
    ...recordKeys(manifest.devDependencies),
    ...recordKeys(manifest.optionalDependencies),
    ...recordKeys(manifest.peerDependencies),
  ];
  if (
    isForbiddenFilingParserCompositionPath(path) &&
    hasFilingParserDependency(manifest, path)
  )
    violations.push(
      `${path}: disconnected filing-parser must not be an application/package dependency`,
    );
  if (
    path === "packages/filing-parser/package.json" &&
    dependencyNames.length > 0
  )
    violations.push(
      `${path}: disconnected zero-dependency filing-parser must not add package dependencies`,
    );
  if (
    path === "packages/filing-payload-custody/package.json" &&
    dependencyNames.length > 0
  )
    violations.push(
      `${path}: isolated zero-dependency filing-payload custody must not add package dependencies`,
    );
  if (
    path === "packages/filing-fact-normalization/package.json" &&
    dependencyNames.length > 0
  )
    violations.push(
      `${path}: isolated zero-dependency filing-fact normalization must not add package dependencies`,
    );
  if (
    path === `${filingFactComparisonPackagePrefix}package.json` &&
    dependencyNames.length > 0
  )
    violations.push(
      `${path}: isolated zero-dependency filing-fact comparison must not add package dependencies`,
    );
  if (
    path === `${filingQualityMeasurementPackagePrefix}package.json` &&
    dependencyNames.length > 0
  )
    violations.push(
      `${path}: isolated zero-dependency filing-quality measurement must not add package dependencies`,
    );
  if (path === "packages/filing-fact-normalization/package.json") {
    const manifestViolation =
      filingFactNormalizationManifestViolation(manifest);
    if (manifestViolation !== null)
      violations.push(`${path}: ${manifestViolation}`);
  }
  if (
    !path.startsWith("packages/filing-fact-normalization/") &&
    path !== `${filingParserNormalizationHandoffPackagePrefix}package.json` &&
    hasFilingFactNormalizationDependency(manifest, path)
  )
    violations.push(
      `${path}: synthetic filing-fact normalization must not be composed into another package`,
    );
  if (path === `${filingParserNormalizationHandoffPackagePrefix}package.json`) {
    const manifestViolation =
      filingParserNormalizationHandoffManifestViolation(manifest);
    if (manifestViolation !== null)
      violations.push(`${path}: ${manifestViolation}`);
  }
  if (
    !path.startsWith(filingParserNormalizationHandoffPackagePrefix) &&
    path !== `${filingParserNormalizationExecutionPackagePrefix}package.json` &&
    hasFilingParserNormalizationHandoffDependency(manifest, path)
  )
    violations.push(
      `${path}: Cycle 2i parser-normalization handoff must not be composed into another package`,
    );
  const handoffManifestCompositionViolation =
    filingParserNormalizationHandoffManifestCompositionViolation(
      path,
      manifest,
    );
  if (handoffManifestCompositionViolation !== null)
    violations.push(`${path}: ${handoffManifestCompositionViolation}`);
  if (
    path === `${filingParserNormalizationExecutionPackagePrefix}package.json`
  ) {
    const manifestViolation =
      filingParserNormalizationExecutionManifestViolation(manifest);
    if (manifestViolation !== null)
      violations.push(`${path}: ${manifestViolation}`);
  }
  if (
    path ===
    `${filingParserNormalizationExecutionAcceptancePackagePrefix}package.json`
  ) {
    const manifestViolation =
      filingParserNormalizationExecutionAcceptanceManifestViolation(manifest);
    if (manifestViolation !== null)
      violations.push(`${path}: ${manifestViolation}`);
  }
  if (
    !path.startsWith(filingParserNormalizationExecutionPackagePrefix) &&
    !path.startsWith(
      filingParserNormalizationExecutionAcceptancePackagePrefix,
    ) &&
    !path.startsWith(filingParserCrossEngineExecutionPackagePrefix) &&
    !path.startsWith(filingParserCrossEngineExecutionAcceptancePackagePrefix) &&
    hasFilingParserNormalizationExecutionDependency(manifest, path)
  )
    violations.push(
      `${path}: Cycle 2j parser-normalization execution must remain limited to its exact acceptance package`,
    );
  const executionManifestCompositionViolation =
    filingParserNormalizationExecutionManifestCompositionViolation(
      path,
      manifest,
    );
  if (executionManifestCompositionViolation !== null)
    violations.push(`${path}: ${executionManifestCompositionViolation}`);
  if (path === `${filingFactComparisonPackagePrefix}package.json`) {
    const manifestViolation = filingFactComparisonManifestViolation(manifest);
    if (manifestViolation !== null)
      violations.push(`${path}: ${manifestViolation}`);
  }
  if (
    !path.startsWith(filingFactComparisonPackagePrefix) &&
    hasFilingFactComparisonDependency(manifest, path)
  )
    violations.push(
      `${path}: synthetic filing-fact comparison must not be composed into another package`,
    );
  if (path === `${filingQualityMeasurementPackagePrefix}package.json`) {
    const manifestViolation =
      filingQualityMeasurementManifestViolation(manifest);
    if (manifestViolation !== null)
      violations.push(`${path}: ${manifestViolation}`);
  }
  if (
    !path.startsWith(filingQualityMeasurementPackagePrefix) &&
    path !== `${filingQualityPrecommitmentPackagePrefix}package.json` &&
    path !== `${filingParserQualityCompositionPackagePrefix}package.json` &&
    hasFilingQualityMeasurementDependency(manifest, path)
  )
    violations.push(
      `${path}: synthetic filing-quality measurement must not be composed into another package`,
    );
  if (path === `${filingQualityPrecommitmentPackagePrefix}package.json`) {
    const manifestViolation =
      filingQualityPrecommitmentManifestViolation(manifest);
    if (manifestViolation !== null)
      violations.push(`${path}: ${manifestViolation}`);
  }
  if (
    !path.startsWith(filingQualityPrecommitmentPackagePrefix) &&
    path !== `${filingParserQualityCompositionPackagePrefix}package.json` &&
    hasFilingQualityPrecommitmentDependency(manifest, path)
  )
    violations.push(
      `${path}: synthetic filing-quality precommitment must not be composed into another package`,
    );
  if (
    path !== `${filingParserQualityCompositionPackagePrefix}package.json` &&
    path !==
      `${filingParserCustodyQualityCompositionPackagePrefix}package.json` &&
    path !==
      `${filingParserCrossEngineExecutionAcceptancePackagePrefix}package.json` &&
    hasFilingParserQualityCompositionDependency(manifest, path)
  )
    violations.push(
      `${path}: Cycle 2n filing-parser quality composition must remain limited to its exact acceptance package`,
    );
  if (
    path !==
      `${filingParserCustodyQualityCompositionPackagePrefix}package.json` &&
    path !==
      `${filingParserCrossEngineExecutionAcceptancePackagePrefix}package.json` &&
    hasFilingParserCustodyQualityCompositionDependency(manifest, path)
  )
    violations.push(
      `${path}: Cycle 2o filing-parser custody-quality composition must remain limited to its exact acceptance package`,
    );
  if (path === "packages/filing-payload-custody/package.json") {
    const manifestViolation = filingPayloadCustodyManifestViolation(manifest);
    if (manifestViolation !== null)
      violations.push(`${path}: ${manifestViolation}`);
  }
  if (
    !path.startsWith("packages/filing-payload-custody/") &&
    path !==
      `${filingParserCustodyQualityCompositionPackagePrefix}package.json` &&
    hasFilingPayloadCustodyDependency(manifest, path)
  )
    violations.push(
      `${path}: synthetic filing-payload custody must not be composed into another package`,
    );
  for (const dependency of dependencyNames) {
    if (forbiddenDependencies.includes(dependency)) {
      violations.push(`${path}: forbidden dependency ${dependency}`);
    }
    if (
      path === "apps/web/package.json" &&
      forbiddenWebModuleImports.includes(dependency)
    )
      violations.push(`${path}: web must not depend on ${dependency}`);
    if (
      path === "apps/api/package.json" &&
      forbiddenApiWriteDependencies.includes(dependency)
    )
      violations.push(`${path}: API must not depend on ${dependency}`);
  }
}

type DependencySection = (typeof dependencySections)[number];

function dependencyPolicyViolations(
  manifest: Record<string, unknown>,
  workspaceNames: ReadonlySet<string>,
): string[] {
  const policyViolations: string[] = [];
  const seen = new Map<string, DependencySection>();
  for (const section of dependencySections) {
    const value = manifest[section];
    if (value === undefined) continue;
    if (!isRecord(value)) {
      policyViolations.push(`${section} must be an object`);
      continue;
    }
    for (const [name, specifier] of Object.entries(value).sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      const previous = seen.get(name);
      if (previous === undefined) seen.set(name, section);
      else
        policyViolations.push(
          `dependency ${JSON.stringify(name)} is duplicated in ${previous} and ${section}`,
        );
      if (name.length === 0) {
        policyViolations.push(`${section} contains an empty dependency name`);
        continue;
      }
      if (typeof specifier !== "string") {
        policyViolations.push(
          `${section} dependency ${JSON.stringify(name)} must have a string specifier`,
        );
        continue;
      }
      if (workspaceNames.has(name)) {
        if (specifier !== "workspace:*")
          policyViolations.push(
            `workspace dependency ${JSON.stringify(name)} in ${section} must use workspace:*`,
          );
        continue;
      }
      if (name.startsWith("@research-cockpit/")) {
        policyViolations.push(
          `${section} dependency ${JSON.stringify(name)} uses the reserved internal scope without a matching workspace package`,
        );
        continue;
      }
      if (specifier.startsWith("workspace:")) {
        policyViolations.push(
          `${section} dependency ${JSON.stringify(name)} references an unknown workspace package`,
        );
        continue;
      }
      if (
        exactDependencySections.has(section) &&
        !plainExactSemver.test(specifier)
      )
        policyViolations.push(
          `external dependency ${JSON.stringify(name)} in ${section} must use one plain exact semantic version`,
        );
      else if (section === "peerDependencies" && specifier.length === 0)
        policyViolations.push(
          `peer dependency ${JSON.stringify(name)} must have a non-empty specifier`,
        );
    }
  }
  return policyViolations;
}

async function collectWorkspacePackageNames(
  files: ReadonlySet<string>,
): Promise<ReadonlySet<string>> {
  const names = new Map<string, string>();
  for (const file of [...files].sort()) {
    const path = relative(root, file).replaceAll("\\", "/");
    if (!isWorkspacePackageManifestPath(path)) continue;
    const manifest = JSON.parse(await readFile(file, "utf8")) as unknown;
    if (
      !isRecord(manifest) ||
      typeof manifest.name !== "string" ||
      manifest.name.length === 0 ||
      manifest.name.trim() !== manifest.name
    ) {
      violations.push(`${path}: workspace package needs one non-empty name`);
      continue;
    }
    const previous = names.get(manifest.name);
    if (previous !== undefined)
      violations.push(
        `${path}: workspace package name duplicates the manifest at ${previous}`,
      );
    else names.set(manifest.name, path);
  }
  return new Set(names.keys());
}

function isWorkspacePackageManifestPath(path: string): boolean {
  return (
    path === "package.json" ||
    /^(?:apps|modules|packages)\/[^/]+\/package\.json$/u.test(path)
  );
}

function legacyNpmrcPolicyViolation(content: string): string | null {
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#") || line.startsWith(";"))
      continue;
    const equalsIndex = line.indexOf("=");
    const key = (equalsIndex === -1 ? line : line.slice(0, equalsIndex)).trim();
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const policyKey = legacyNpmrcPolicyKeys.get(normalizedKey);
    if (policyKey !== undefined)
      return `legacy non-auth setting ${policyKey} is forbidden; configure it in pnpm-workspace.yaml`;
  }
  return null;
}

function npmrcGitignoreViolation(content: string): string | null {
  const rules = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (rules.filter((line) => line === ".npmrc").length !== 1)
    return ".npmrc must have exactly one explicit ignore rule";
  if (rules.some((line) => line === "!.npmrc" || line === "!/.npmrc"))
    return ".npmrc must not be re-included after it is ignored";
  return null;
}

function gitPathDisposition(
  operation: "check-ignore" | "ls-files",
  path: string,
): boolean | null {
  const arguments_ = [
    "-c",
    `safe.directory=${root.replaceAll("\\", "/")}`,
    operation,
    ...(operation === "check-ignore"
      ? ["--no-index", "--quiet"]
      : ["--error-unmatch"]),
    "--",
    path,
  ];
  const result = spawnSync("git", arguments_, {
    cwd: root,
    shell: false,
    stdio: "ignore",
    timeout: 5_000,
    windowsHide: true,
  });
  if (result.error !== undefined || result.signal !== null) return null;
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  return null;
}

async function readOptionalLocalNpmrc(): Promise<string | null> {
  try {
    return await readFile(join(root, ".npmrc"), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  }
}

function pnpmLockfileHeaderViolation(content: string): string | null {
  const lines = content.split(/\r?\n/u);
  const meaningful = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#");
  });
  if (meaningful[0] !== "lockfileVersion: '9.0'")
    return "lockfileVersion must remain the pinned canonical 9.0 header";
  const canonicalTopLevelLines = [
    "lockfileVersion: '9.0'",
    "settings:",
    "importers:",
    "packages:",
    "ignoredOptionalDependencies:",
    "snapshots:",
  ] as const;
  const requiredTopLevelLines = new Set<
    (typeof canonicalTopLevelLines)[number]
  >(["lockfileVersion: '9.0'", "settings:"]);
  const topLevelCounts = new Map<
    (typeof canonicalTopLevelLines)[number],
    number
  >(canonicalTopLevelLines.map((line) => [line, 0] as const));
  const settingsLines: string[] = [];
  let insideSettings = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    if (!/^\s/u.test(line)) {
      insideSettings = line === "settings:";
      const canonicalLine = line as (typeof canonicalTopLevelLines)[number];
      const count = topLevelCounts.get(canonicalLine);
      if (count === undefined)
        return "top-level mappings must use only the canonical generated keys";
      topLevelCounts.set(canonicalLine, count + 1);
      continue;
    }
    if (insideSettings) settingsLines.push(line);
  }
  for (const [line, count] of topLevelCounts) {
    if (
      (requiredTopLevelLines.has(line) && count !== 1) ||
      (!requiredTopLevelLines.has(line) && count > 1)
    )
      return "required top-level keys must occur once and optional keys at most once";
  }
  if (
    JSON.stringify(settingsLines) !==
    JSON.stringify([
      "  autoInstallPeers: false",
      "  excludeLinksFromLockfile: false",
    ] as const)
  )
    return "settings must contain only the exact canonical generated values";
  return null;
}

function readEffectivePnpmConfig(): unknown {
  const pnpmCli = process.env.npm_execpath;
  if (typeof pnpmCli !== "string" || pnpmCli.length === 0) return null;
  const result = spawnSync(
    process.execPath,
    [pnpmCli, "config", "list", "--json"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: MAX_PNPM_CONFIG_BYTES,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5_000,
      windowsHide: true,
    },
  );
  if (
    result.error !== undefined ||
    result.status !== 0 ||
    result.signal !== null ||
    typeof result.stdout !== "string" ||
    Buffer.byteLength(result.stdout, "utf8") > MAX_PNPM_CONFIG_BYTES
  )
    return null;
  try {
    return JSON.parse(result.stdout) as unknown;
  } catch {
    return null;
  }
}

function effectivePnpmSettingsViolation(config: unknown): string | null {
  if (!isRecord(config))
    return "effective settings must be available as bounded JSON from the active pnpm CLI";
  for (const [key, expected] of Object.entries(expectedPnpmSettings)) {
    if (config[key] !== expected)
      return `effective ${key} must be ${String(expected)}`;
  }
  if (
    typeof config.userAgent !== "string" ||
    !config.userAgent.startsWith(`pnpm/${expectedPnpmVersion} `)
  )
    return `active pnpm must remain exactly ${expectedPnpmVersion}`;
  return null;
}

function verifyDependencyPolicyClassifiers(): void {
  const internalName = "@research-cockpit/dependency-policy-fixture";
  const workspaceNames = new Set([internalName]);
  const validManifest = {
    dependencies: {
      [internalName]: "workspace:*",
      runtime: "1.2.3",
    },
    devDependencies: { tool: "0.0.0-alpha.1+build.7" },
    optionalDependencies: { optional: "10.20.30" },
    peerDependencies: { peer: "^19.0.0" },
  };
  if (dependencyPolicyViolations(validManifest, workspaceNames).length !== 0)
    throw new Error("Dependency pin policy rejected its closed valid fixture");

  for (const valid of [
    "0.0.0",
    "1.2.3",
    "1.2.3-alpha.1",
    "1.2.3-alpha+build.7",
    "1.2.3+001",
  ]) {
    if (
      dependencyPolicyViolations(
        { dependencies: { external: valid } },
        workspaceNames,
      ).length !== 0
    )
      throw new Error(
        "Dependency pin policy rejected an exact semantic version",
      );
  }
  for (const invalid of [
    "^1.2.3",
    "~1.2.3",
    ">=1.2.3",
    "1.2",
    "01.2.3",
    "1.02.3",
    "1.2.03",
    "1.2.3-01",
    "1.2.3-alpha..1",
    "1.2.3+",
    "v1.2.3",
    "=1.2.3",
    "latest",
    "npm:other@1.2.3",
    "https://example.invalid/package.tgz",
    "git+https://example.invalid/repository.git",
    "file:../package",
    "link:../package",
    "workspace:*",
    " 1.2.3",
    "1.2.3 ",
  ]) {
    for (const section of exactDependencySections) {
      if (
        dependencyPolicyViolations(
          { [section]: { external: invalid } },
          workspaceNames,
        ).length === 0
      )
        throw new Error("Dependency pin policy admitted a non-exact specifier");
    }
  }
  for (const section of dependencySections) {
    if (
      dependencyPolicyViolations({ [section]: [] }, workspaceNames).length ===
        0 ||
      dependencyPolicyViolations(
        { [section]: { external: null } },
        workspaceNames,
      ).length === 0
    )
      throw new Error("Dependency pin policy admitted a malformed section");
    for (const invalid of [
      "1.2.3",
      "workspace:^",
      "workspace:~",
      "workspace:1.2.3",
      "link:../package",
    ]) {
      if (
        dependencyPolicyViolations(
          { [section]: { [internalName]: invalid } },
          workspaceNames,
        ).length === 0
      )
        throw new Error(
          "Dependency pin policy admitted a non-exact workspace specifier",
        );
    }
  }
  if (
    dependencyPolicyViolations(
      { peerDependencies: { unknown: "workspace:*" } },
      workspaceNames,
    ).length === 0 ||
    dependencyPolicyViolations(
      {
        dependencies: { duplicate: "1.2.3" },
        devDependencies: { duplicate: "1.2.3" },
      },
      workspaceNames,
    ).length === 0
  )
    throw new Error(
      "Dependency pin policy admitted an unknown or duplicate link",
    );
  for (const specifier of ["1.2.3", "workspace:*"]) {
    if (
      dependencyPolicyViolations(
        {
          dependencies: {
            "@research-cockpit/not-a-workspace-package": specifier,
          },
        },
        workspaceNames,
      ).length === 0
    )
      throw new Error(
        "Dependency pin policy admitted an unknown reserved-scope package",
      );
  }
  for (let left = 0; left < dependencySections.length; left += 1) {
    for (let right = left + 1; right < dependencySections.length; right += 1) {
      const leftSection = dependencySections[left];
      const rightSection = dependencySections[right];
      if (leftSection === undefined || rightSection === undefined)
        throw new Error("Dependency section fixture is incomplete");
      const manifest = {
        [leftSection]: {
          duplicate: leftSection === "peerDependencies" ? "^1.0.0" : "1.0.0",
        },
        [rightSection]: {
          duplicate: rightSection === "peerDependencies" ? "^1.0.0" : "1.0.0",
        },
      };
      if (dependencyPolicyViolations(manifest, workspaceNames).length === 0)
        throw new Error(
          "Dependency pin policy admitted a duplicate declaration",
        );
    }
  }

  const secretCanary = "dependency-policy-secret-canary";
  if (
    legacyNpmrcPolicyViolation(
      `registry=https://registry.npmjs.org/\n@scope:registry=https://registry.example.invalid/\n//registry.example.invalid/:_authToken=${secretCanary}\n//registry.example.invalid/:_password=save-exact=true\n`,
    ) !== null
  )
    throw new Error(
      "Npmrc policy rejected registry or authentication settings",
    );
  for (const key of [
    "auto-install-peers",
    "AUTO_INSTALL_PEERS",
    "autoInstallPeers",
    "save-exact",
    "SAVE_EXACT",
    "saveExact",
    "shared-workspace-lockfile",
    "SHARED_WORKSPACE_LOCKFILE",
    "sharedWorkspaceLockfile",
    "strict-peer-dependencies",
    "STRICT_PEER_DEPENDENCIES",
    "strictPeerDependencies",
  ]) {
    const violation = legacyNpmrcPolicyViolation(`${key}=${secretCanary}`);
    if (violation === null || violation.includes(secretCanary))
      throw new Error("Npmrc policy admitted or disclosed a legacy setting");
  }
  const validGitignore = "node_modules/\n.npmrc\n*.log\n";
  if (npmrcGitignoreViolation(validGitignore) !== null)
    throw new Error("Npmrc ignore policy rejected its exact rule");
  for (const invalid of [
    "node_modules/\n",
    ".npmrc\n.npmrc\n",
    ".npmrc\n!.npmrc\n",
    ".npmrc\n!/.npmrc\n",
  ]) {
    if (npmrcGitignoreViolation(invalid) === null)
      throw new Error("Npmrc ignore policy admitted an unsafe rule set");
  }

  const validLockfile = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: false
  excludeLinksFromLockfile: false

importers:
`;
  if (pnpmLockfileHeaderViolation(validLockfile) !== null)
    throw new Error("Lockfile policy rejected its canonical header");
  const invalidLockfiles = [
    validLockfile.replace("autoInstallPeers: false", "autoInstallPeers: true"),
    validLockfile.replace("  autoInstallPeers: false\n", ""),
    validLockfile.replace(
      "  autoInstallPeers: false",
      "  autoInstallPeers: false\n  autoInstallPeers: false",
    ),
    validLockfile.replace("settings:", "settings:\nsettings:"),
    validLockfile.replace("  autoInstallPeers", "    autoInstallPeers"),
    validLockfile.replace("lockfileVersion: '9.0'", "lockfileVersion: '8.0'"),
    validLockfile.replace(
      "lockfileVersion: '9.0'",
      "lockfileVersion: '9.0'\nlockfileVersion: '9.0'",
    ),
    validLockfile.replace("importers:", "importers:\nimporters:"),
    validLockfile.replace(
      "  excludeLinksFromLockfile: false",
      "  excludeLinksFromLockfile: true",
    ),
    validLockfile.replace(
      "settings:\n  autoInstallPeers: false",
      "settings: {autoInstallPeers: false}",
    ),
  ];
  for (const alternateSettings of [
    "settings: {autoInstallPeers: true}",
    "settings : {autoInstallPeers: true}",
    "'settings': {autoInstallPeers: true}",
    '"settings": {autoInstallPeers: true}',
    "? settings\n: {autoInstallPeers: true}",
    "!!str settings: {autoInstallPeers: true}",
    '"set\\x74ings": {autoInstallPeers: true}',
    "<<: {settings: {autoInstallPeers: true}}",
  ]) {
    invalidLockfiles.push(
      validLockfile.replace(
        "\nimporters:",
        `\n${alternateSettings}\n\nimporters:`,
      ),
    );
  }
  for (const alternateAutoInstallPeers of [
    "  autoInstallPeers : true",
    "  'autoInstallPeers': true",
    '  "autoInstallPeers": true',
    "  ? autoInstallPeers\n  : true",
    "  !!str autoInstallPeers: true",
    '  "autoInstall\\x50eers": true',
    "  <<: {autoInstallPeers: true}",
  ]) {
    invalidLockfiles.push(
      validLockfile.replace(
        "  excludeLinksFromLockfile: false",
        `${alternateAutoInstallPeers}\n  excludeLinksFromLockfile: false`,
      ),
    );
  }
  for (const invalid of invalidLockfiles) {
    if (pnpmLockfileHeaderViolation(invalid) === null)
      throw new Error("Lockfile policy admitted a non-canonical header");
  }

  const validEffectivePnpmSettings = {
    ...expectedPnpmSettings,
    userAgent: `pnpm/${expectedPnpmVersion} npm/? node/v24.18.0 test x64`,
  };
  if (effectivePnpmSettingsViolation(validEffectivePnpmSettings) !== null)
    throw new Error("Pnpm settings policy rejected its exact settings");
  for (const key of Object.keys(expectedPnpmSettings)) {
    const missing = { ...validEffectivePnpmSettings } as Record<
      string,
      unknown
    >;
    delete missing[key];
    const wrong = { ...validEffectivePnpmSettings, [key]: "wrong-type" };
    if (
      effectivePnpmSettingsViolation(missing) === null ||
      effectivePnpmSettingsViolation(wrong) === null
    )
      throw new Error("Pnpm settings policy admitted a missing or wrong value");
  }
  if (
    effectivePnpmSettingsViolation(null) === null ||
    effectivePnpmSettingsViolation([]) === null ||
    effectivePnpmSettingsViolation({
      ...validEffectivePnpmSettings,
      userAgent: "pnpm/11.19.1 npm/? node/v24.18.0 test x64",
    }) === null
  )
    throw new Error("Pnpm settings policy admitted a malformed carrier");
}

function filingFactNormalizationManifestViolation(
  manifest: unknown,
): string | null {
  if (!isRecord(manifest))
    return "filing-fact-normalization package manifest must be an exact object";
  const expected = {
    name: filingFactNormalizationModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
  };
  return JSON.stringify(manifest) === JSON.stringify(expected)
    ? null
    : "filing-fact-normalization package must retain its exact private, zero-dependency, index-only script and export surface";
}

function filingParserNormalizationHandoffManifestViolation(
  manifest: unknown,
): string | null {
  if (!isRecord(manifest))
    return "filing-parser-normalization-handoff package manifest must be an exact object";
  const expected = {
    name: filingParserNormalizationHandoffModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
    dependencies: {
      [filingFactNormalizationModule]: "workspace:*",
    },
  };
  return JSON.stringify(manifest) === JSON.stringify(expected)
    ? null
    : "filing-parser-normalization-handoff package must retain its exact private, Cycle 2d-only workspace dependency, index-only script and export surface";
}

function filingParserNormalizationExecutionManifestViolation(
  manifest: unknown,
): string | null {
  if (!isRecord(manifest))
    return "filing-parser-normalization-execution package manifest must be an exact object";
  const expected = {
    name: filingParserNormalizationExecutionModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: {
      ".": "./src/index.ts",
      "./test": "./src/test-filing-parser-normalization-execution-builder.ts",
    },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
      "test:worker": "python -I -B worker/parser_test.py",
    },
    dependencies: {
      [filingParserNormalizationHandoffModule]: "workspace:*",
    },
  };
  return JSON.stringify(manifest) === JSON.stringify(expected)
    ? null
    : "filing-parser-normalization-execution package must retain its exact private, Cycle 2i-only dependency, public index, test-builder subpath, and script surface";
}

function filingParserNormalizationExecutionAcceptanceManifestViolation(
  manifest: unknown,
): string | null {
  if (!isRecord(manifest))
    return "filing-parser-normalization-execution acceptance manifest must be an exact object";
  const expected = {
    name: filingParserNormalizationExecutionAcceptanceModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
    dependencies: {
      [filingParserNormalizationExecutionModule]: "workspace:*",
    },
  };
  return JSON.stringify(manifest) === JSON.stringify(expected)
    ? null
    : "filing-parser-normalization-execution acceptance package must retain its exact private, Cycle 2j-only dependency, index-only export, and script surface";
}

function filingFactComparisonManifestViolation(
  manifest: unknown,
): string | null {
  if (!isRecord(manifest))
    return "filing-fact-comparison package manifest must be an exact object";
  const expected = {
    name: filingFactComparisonModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
  };
  return JSON.stringify(manifest) === JSON.stringify(expected)
    ? null
    : "filing-fact-comparison package must retain its exact private, zero-dependency, index-only script and export surface";
}

function filingQualityMeasurementManifestViolation(
  manifest: unknown,
): string | null {
  if (!isRecord(manifest))
    return "filing-quality-measurement package manifest must be an exact object";
  const expected = {
    name: filingQualityMeasurementModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
  };
  return JSON.stringify(manifest) === JSON.stringify(expected)
    ? null
    : "filing-quality-measurement package must retain its exact private, zero-dependency, index-only script and export surface";
}

function filingQualityPrecommitmentManifestViolation(
  manifest: unknown,
): string | null {
  if (!isRecord(manifest))
    return "filing-quality-precommitment package manifest must be an exact object";
  const expected = {
    name: filingQualityPrecommitmentModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
    dependencies: {
      [filingQualityMeasurementModule]: "workspace:*",
    },
  };
  return JSON.stringify(manifest) === JSON.stringify(expected)
    ? null
    : "filing-quality-precommitment package must retain its exact private, Cycle2f-only workspace dependency, index-only script and export surface";
}

function filingPayloadCustodyManifestViolation(
  manifest: unknown,
): string | null {
  if (!isRecord(manifest))
    return "custody package manifest must be an exact object";
  const expected = {
    name: filingPayloadCustodyModule,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
  };
  return JSON.stringify(manifest) === JSON.stringify(expected)
    ? null
    : "custody package must retain its exact private, zero-dependency, index-only script and export surface";
}

function inspectCompositionBoundary(path: string, content: string): void {
  const moduleSpecifiers = collectModuleSpecifiers(content);
  if (path === filingPayloadCustodyFixtureGuardPath) {
    const fixtureGuardViolation =
      filingPayloadCustodyFixtureGuardViolation(content);
    if (fixtureGuardViolation !== null)
      violations.push(`${path}: ${fixtureGuardViolation}`);
  }
  if (
    path.startsWith("packages/filing-parser/") &&
    moduleSpecifiers.some((specifier) =>
      referencesExternalWorkspacePath(path, specifier),
    )
  )
    violations.push(
      `${path}: filing-parser must not import another workspace package`,
    );
  if (
    isForbiddenFilingParserCompositionPath(path) &&
    moduleSpecifiers.some((specifier) =>
      referencesFilingParserPath(path, specifier),
    )
  )
    violations.push(
      `${path}: disconnected filing-parser must not be composed into application or database code`,
    );
  const filingFactNormalizationViolation =
    filingFactNormalizationImportViolation(path, content);
  if (filingFactNormalizationViolation !== null)
    violations.push(`${path}: ${filingFactNormalizationViolation}`);
  if (
    !path.startsWith("packages/filing-fact-normalization/") &&
    moduleSpecifiers.some((specifier) =>
      referencesFilingFactNormalizationPath(path, specifier),
    ) &&
    !isAllowedFilingFactNormalizationExternalImportPath(path)
  )
    violations.push(
      `${path}: synthetic filing-fact normalization must remain package-isolated`,
    );
  const filingParserNormalizationHandoffViolation =
    filingParserNormalizationHandoffImportViolation(path, content);
  if (filingParserNormalizationHandoffViolation !== null)
    violations.push(`${path}: ${filingParserNormalizationHandoffViolation}`);
  const filingParserNormalizationHandoffExternalViolation =
    filingParserNormalizationHandoffExternalCompositionViolation(path, content);
  if (filingParserNormalizationHandoffExternalViolation !== null)
    violations.push(
      `${path}: ${filingParserNormalizationHandoffExternalViolation}`,
    );
  const filingParserNormalizationExecutionViolation =
    filingParserNormalizationExecutionImportViolation(path, content);
  if (filingParserNormalizationExecutionViolation !== null)
    violations.push(`${path}: ${filingParserNormalizationExecutionViolation}`);
  const filingParserNormalizationExecutionExternalViolation =
    filingParserNormalizationExecutionExternalCompositionViolation(
      path,
      content,
    );
  if (filingParserNormalizationExecutionExternalViolation !== null)
    violations.push(
      `${path}: ${filingParserNormalizationExecutionExternalViolation}`,
    );
  const filingFactComparisonViolation = filingFactComparisonImportViolation(
    path,
    content,
  );
  if (filingFactComparisonViolation !== null)
    violations.push(`${path}: ${filingFactComparisonViolation}`);
  if (
    !path.startsWith(filingFactComparisonPackagePrefix) &&
    moduleSpecifiers.some((specifier) =>
      referencesFilingFactComparisonPath(path, specifier),
    )
  )
    violations.push(
      `${path}: synthetic filing-fact comparison must remain package-isolated`,
    );
  const filingQualityMeasurementViolation =
    filingQualityMeasurementImportViolation(path, content);
  if (filingQualityMeasurementViolation !== null)
    violations.push(`${path}: ${filingQualityMeasurementViolation}`);
  if (
    !path.startsWith(filingQualityMeasurementPackagePrefix) &&
    moduleSpecifiers.some(
      (specifier) =>
        referencesFilingQualityMeasurementPath(path, specifier) &&
        !isAllowedFilingQualityMeasurementExternalImport(path, specifier),
    )
  )
    violations.push(
      `${path}: synthetic filing-quality measurement must remain package-isolated`,
    );
  const filingQualityPrecommitmentViolation =
    filingQualityPrecommitmentImportViolation(path, content);
  if (filingQualityPrecommitmentViolation !== null)
    violations.push(`${path}: ${filingQualityPrecommitmentViolation}`);
  if (
    !path.startsWith(filingQualityPrecommitmentPackagePrefix) &&
    moduleSpecifiers.some(
      (specifier) =>
        referencesFilingQualityPrecommitmentPath(path, specifier) &&
        !isAllowedFilingQualityPrecommitmentExternalImport(path, specifier),
    )
  )
    violations.push(
      `${path}: synthetic filing-quality precommitment must remain package-isolated`,
    );
  if (
    !path.startsWith(filingParserQualityCompositionPackagePrefix) &&
    moduleSpecifiers.some(
      (specifier) =>
        referencesFilingParserQualityCompositionPath(path, specifier) &&
        !isAllowedFilingParserQualityCompositionExternalImport(path, specifier),
    )
  )
    violations.push(
      `${path}: Cycle 2n filing-parser quality composition must remain package-isolated`,
    );
  if (
    !path.startsWith(filingParserCustodyQualityCompositionPackagePrefix) &&
    moduleSpecifiers.some(
      (specifier) =>
        referencesFilingParserCustodyQualityCompositionPath(path, specifier) &&
        !isAllowedFilingParserCustodyQualityCompositionExternalImport(
          path,
          specifier,
        ),
    )
  )
    violations.push(
      `${path}: Cycle 2o filing-parser custody-quality composition must remain package-isolated`,
    );
  const corpusAdmissionViolation = corpusAdmissionImportViolation(
    path,
    content,
  );
  if (corpusAdmissionViolation !== null)
    violations.push(`${path}: ${corpusAdmissionViolation}`);
  const filingPayloadCustodyViolation = filingPayloadCustodyImportViolation(
    path,
    content,
  );
  if (filingPayloadCustodyViolation !== null)
    violations.push(`${path}: ${filingPayloadCustodyViolation}`);
  if (
    !path.startsWith("packages/filing-payload-custody/") &&
    moduleSpecifiers.some(
      (specifier) =>
        referencesFilingPayloadCustodyPath(path, specifier) &&
        !isAllowedFilingPayloadCustodyExternalImport(path, specifier),
    )
  )
    violations.push(
      `${path}: synthetic filing-payload custody must remain package-isolated`,
    );
  if (path.startsWith("apps/web/")) {
    for (const moduleName of forbiddenWebModuleImports) {
      if (referencesModuleSpecifier(moduleSpecifiers, moduleName))
        violations.push(`${path}: web must not import ${moduleName}`);
    }
    if (/(?:modules[\\/]research-state|packages[\\/]db)/i.test(content))
      violations.push(
        `${path}: web must not reference research-state or database source paths`,
      );
  }
  if (path.startsWith("apps/api/")) {
    for (const moduleName of forbiddenApiWriteDependencies) {
      if (referencesModuleSpecifier(moduleSpecifiers, moduleName))
        violations.push(`${path}: API must not import ${moduleName}`);
    }
    if (/packages[\\/]db/i.test(content))
      violations.push(`${path}: API must not reference database source paths`);
  }
}

function filingFactNormalizationImportViolation(
  path: string,
  content: string,
): string | null {
  if (!path.startsWith(filingFactNormalizationSourcePrefix)) return null;
  if (!filingFactNormalizationSourcePaths.has(path))
    return "source set must remain the exact reviewed core, index, builder, and two tests";

  const moduleSpecifiers = collectModuleSpecifiers(content);
  if (path === filingFactNormalizationIndexPath) {
    return isExactFilingFactNormalizationIndex(content)
      ? null
      : "public index must retain the exact isolated production export surface";
  }
  if (path === filingFactNormalizationProductionPath) {
    if (JSON.stringify(moduleSpecifiers) !== JSON.stringify(["node:crypto"]))
      return "normalization core may import only its exact node:crypto hashing surface";
    const sourceFile = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const imports = sourceFile.statements.filter(ts.isImportDeclaration);
    if (
      imports.length !== 1 ||
      !isExactFilingPayloadCustodyImport(imports[0], "node:crypto", [
        ["createHash", "createHash"],
      ])
    )
      return "normalization core must retain its exact hash-only node:crypto binding";
    return filingFactNormalizationGlobalViolation(path, content, "core");
  }
  if (path === filingFactNormalizationBuilderPath) {
    if (
      JSON.stringify(moduleSpecifiers) !==
      JSON.stringify(["./filing-fact-normalization"])
    )
      return "synthetic builder may import only the direct normalization core";
    return filingFactNormalizationGlobalViolation(path, content, "builder");
  }

  const expectedTestModules = filingFactNormalizationTestModules.get(path);
  if (
    expectedTestModules === undefined ||
    JSON.stringify(moduleSpecifiers) !== JSON.stringify(expectedTestModules)
  )
    return "normalization tests may import only their exact Vitest, hash, core, and builder surfaces";
  if (path === filingFactNormalizationSecurityTestPath) {
    const sourceFile = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const cryptoImports = sourceFile.statements.filter(
      (statement): statement is ts.ImportDeclaration =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === "node:crypto",
    );
    if (
      cryptoImports.length !== 1 ||
      !isExactFilingPayloadCustodyImport(cryptoImports[0], "node:crypto", [
        ["createHash", "createHash"],
      ])
    )
      return "normalization security test must retain its exact hash-only crypto binding";
  }
  return filingFactNormalizationGlobalViolation(path, content, "test");
}

function filingParserNormalizationHandoffImportViolation(
  path: string,
  content: string,
): string | null {
  if (!path.startsWith(filingParserNormalizationHandoffSourcePrefix))
    return null;
  if (!filingParserNormalizationHandoffSourcePaths.has(path))
    return "source set must remain the exact reviewed core, index, builder, and two tests";
  if (hasRuntimeDynamicImport(content))
    return "handoff sources must not use runtime dynamic imports";
  if (
    path === filingParserNormalizationHandoffIndexPath &&
    !isExactFilingParserNormalizationHandoffIndex(content)
  )
    return "public index must retain the exact reviewed Cycle 2i export surface";

  const modules = collectModuleSpecifiers(content);
  const isTest =
    path === filingParserNormalizationHandoffUnitTestPath ||
    path === filingParserNormalizationHandoffSecurityTestPath;
  const allowed =
    path === filingParserNormalizationHandoffIndexPath
      ? new Set(["./filing-parser-normalization-handoff"])
      : path === filingParserNormalizationHandoffProductionPath
        ? new Set(["node:crypto", "node:util", filingFactNormalizationModule])
        : path === filingParserNormalizationHandoffBuilderPath
          ? new Set([
              "node:crypto",
              filingFactNormalizationModule,
              "./filing-parser-normalization-handoff",
            ])
          : new Set([
              "node:crypto",
              "vitest",
              "./filing-parser-normalization-handoff",
              "./test-filing-parser-normalization-handoff-builder",
            ]);
  if (
    modules.length !== new Set(modules).size ||
    modules.some((moduleName) => !allowed.has(moduleName)) ||
    (isTest
      ? ![
          "vitest",
          "./filing-parser-normalization-handoff",
          "./test-filing-parser-normalization-handoff-builder",
        ].every((moduleName) => modules.includes(moduleName))
      : modules.length !== allowed.size)
  )
    return "handoff source may import only its exact crypto, Cycle 2d, core, builder, and Vitest surfaces";
  if (
    path === filingParserNormalizationHandoffProductionPath &&
    !hasExactFilingParserNormalizationHandoffProductionImports(content)
  )
    return "handoff core must retain its exact hash, Ed25519 verifier, intrinsic-carrier, and Cycle 2d bindings";

  const forbiddenGlobals = new Set([
    "Atomics",
    "BroadcastChannel",
    "Bun",
    "Date",
    "Deno",
    "EventSource",
    "Function",
    "Math",
    "MessageChannel",
    "SharedWorker",
    "WebSocket",
    "Worker",
    "XMLHttpRequest",
    "console",
    "crypto",
    "eval",
    "fetch",
    "global",
    "globalThis",
    "module",
    "navigator",
    "performance",
    "process",
    "queueMicrotask",
    "require",
    "setImmediate",
    "setInterval",
    "setTimeout",
  ]);
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let forbidden: string | null = null;
  const visit = (node: ts.Node): void => {
    if (
      forbidden === null &&
      ts.isIdentifier(node) &&
      forbiddenGlobals.has(node.text)
    ) {
      forbidden = node.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return forbidden === null
    ? null
    : "handoff sources must not use clock, randomness, scheduling, network, process, logging, dynamic-code, or worker surfaces";
}

function filingParserNormalizationExecutionImportViolation(
  path: string,
  content: string,
): string | null {
  if (path === filingParserNormalizationExecutionFixtureGuardPath) {
    const modules = collectModuleSpecifiers(content);
    if (
      JSON.stringify(modules) !==
      JSON.stringify(["node:crypto", "node:fs/promises", "node:path"])
    )
      return "Cycle 2j fixture guard must retain its exact hash, filesystem, and path imports";
    return filingParserNormalizationExecutionDynamicLoadViolation(content);
  }
  if (path.startsWith(filingParserNormalizationExecutionSourcePrefix)) {
    if (!filingParserNormalizationExecutionSourcePaths.has(path))
      return "Cycle 2j source set must remain the exact reviewed core, index, builder, and two tests";
    const dynamicViolation =
      filingParserNormalizationExecutionDynamicLoadViolation(content);
    if (dynamicViolation !== null) return dynamicViolation;
    if (path === filingParserNormalizationExecutionIndexPath)
      return isExactFilingParserNormalizationExecutionIndex(content)
        ? null
        : "Cycle 2j public index must retain the exact reviewed production export surface";
    const modules = collectModuleSpecifiers(content);
    if (path === filingParserNormalizationExecutionProductionPath) {
      if (
        JSON.stringify(modules) !==
          JSON.stringify([
            "node:crypto",
            "node:child_process",
            "node:fs/promises",
            "node:os",
            "node:path",
            "node:util",
            filingParserNormalizationHandoffModule,
          ]) ||
        !hasExactFilingParserNormalizationExecutionProductionImports(content)
      )
        return "Cycle 2j core must retain its exact crypto, Docker spawn, staging, path, intrinsic-carrier, and Cycle 2i bindings";
      return filingParserNormalizationExecutionForbiddenGlobalViolation(
        path,
        content,
      );
    }
    if (path === filingParserNormalizationExecutionBuilderPath) {
      const sourceFile = ts.createSourceFile(
        path,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      const imports = sourceFile.statements.filter(ts.isImportDeclaration);
      if (
        JSON.stringify(modules) !== JSON.stringify(["node:crypto"]) ||
        imports.length !== 1 ||
        !isExactFilingParserNormalizationHandoffImport(
          imports[0],
          "node:crypto",
          [["createHash", "createHash", false]],
        )
      )
        return "Cycle 2j synthetic archive builder may import only exact node:crypto createHash";
      return filingParserNormalizationExecutionForbiddenGlobalViolation(
        path,
        content,
      );
    }
    const expectedTestModules =
      filingParserNormalizationExecutionTestModules.get(path);
    return expectedTestModules !== undefined &&
      JSON.stringify(modules) === JSON.stringify(expectedTestModules)
      ? null
      : "Cycle 2j tests may import only their exact Vitest, Ed25519, core, and builder surfaces";
  }
  if (
    !path.startsWith(filingParserNormalizationExecutionAcceptanceSourcePrefix)
  )
    return null;
  if (!filingParserNormalizationExecutionAcceptanceSourcePaths.has(path))
    return "Cycle 2j acceptance source set must remain the exact reviewed index, live runner, evidence model, verifier, review CLI, builder, and tests";
  const dynamicViolation =
    filingParserNormalizationExecutionDynamicLoadViolation(content);
  if (dynamicViolation !== null) return dynamicViolation;
  const expectedModules =
    filingParserNormalizationExecutionAcceptanceModules.get(path);
  const modules = collectModuleSpecifiers(content);
  if (
    expectedModules === undefined ||
    JSON.stringify(modules) !== JSON.stringify(expectedModules)
  )
    return "Cycle 2j acceptance source may import only its exact reviewed Node, Cycle 2j, evidence, CLI, builder, and Vitest surfaces";
  if (
    path === filingParserNormalizationExecutionAcceptanceIndexPath &&
    !isExactFilingParserNormalizationExecutionAcceptanceIndex(content)
  )
    return "Cycle 2j acceptance index must retain the exact evidence and offline-verifier export surface";
  return null;
}

function filingParserNormalizationExecutionDynamicLoadViolation(
  content: string,
): string | null {
  return hasRuntimeDynamicImport(content) ||
    hasUnresolvedRuntimeModuleLoad(content) ||
    hasForbiddenDynamicCodeCapability(content) ||
    hasForbiddenNodeModuleCapability(content) ||
    hasIndirectRuntimeModuleLoad(content)
    ? "Cycle 2j sources must not use runtime module loading, node:module recovery, or dynamic code"
    : null;
}

function filingParserNormalizationExecutionAcceptanceDiagnosticViolation(
  content: string,
): string | null {
  const violation =
    "Cycle 2j live acceptance must retain its exact value-free failure-phase diagnostic";
  const sourceFile = ts.createSourceFile(
    filingParserNormalizationExecutionAcceptanceRunnerPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const phaseDeclarations: ts.VariableDeclaration[] = [];
  const trackerDeclarations: ts.VariableDeclaration[] = [];
  const primaryDeclarations: ts.VariableDeclaration[] = [];
  const diagnosticFunctions: ts.FunctionDeclaration[] = [];
  const diagnosticBindings: ts.Identifier[] = [];
  const diagnosticReferences: ts.Identifier[] = [];
  const cleanupPrecedenceFunctions: ts.FunctionDeclaration[] = [];
  const mainFunctions: ts.FunctionDeclaration[] = [];
  const invokedPathDeclarations: ts.VariableDeclaration[] = [];
  const markerPhases: string[] = [];
  const markerCalls: ts.CallExpression[] = [];
  const markPhaseBindings: ts.Identifier[] = [];
  const markPhaseReferences: ts.Identifier[] = [];
  const cleanupPrecedenceBindings: ts.Identifier[] = [];
  const cleanupPrecedenceReferences: ts.Identifier[] = [];
  const mainReferences: ts.Identifier[] = [];
  const directMainCalls: ts.CallExpression[] = [];
  const primaryBindings: ts.Identifier[] = [];
  const primaryReferences: ts.Identifier[] = [];
  const primaryAssignments: ts.BinaryExpression[] = [];
  const processPropertyReferences: string[] = [];
  const stderrAccesses: ts.Node[] = [];
  const stdoutAccesses: ts.Node[] = [];
  const stderrWrites: ts.CallExpression[] = [];
  const stdioProperties: ts.PropertyAssignment[] = [];
  const resolveBindings: ts.Identifier[] = [];
  const pathToFileUrlBindings: ts.Identifier[] = [];
  const promiseBindings: ts.Identifier[] = [];
  const promiseReferences: ts.Identifier[] = [];
  const errorBindings: ts.Identifier[] = [];
  const promiseStaticCalls: ts.CallExpression[] = [];
  const promiseNewCalls: ts.NewExpression[] = [];
  const effectfulFsPromiseNames = new Set([
    "lstat",
    "mkdtemp",
    "readFile",
    "rename",
    "rm",
    "writeFile",
  ]);
  const effectfulFsPromiseBindings: ts.Identifier[] = [];
  const effectfulFsPromiseReferences: ts.Identifier[] = [];
  const effectfulFsPromiseCalls: ts.CallExpression[] = [];
  const writeFileBindings: ts.Identifier[] = [];
  const writeFileReferences: ts.Identifier[] = [];
  const writeFileCalls: ts.CallExpression[] = [];
  const spawnBindings: ts.Identifier[] = [];
  const spawnReferences: ts.Identifier[] = [];
  const spawnCalls: ts.CallExpression[] = [];
  const setTimeoutBindings: ts.Identifier[] = [];
  const setTimeoutReferences: ts.Identifier[] = [];
  const setTimeoutCalls: ts.CallExpression[] = [];
  const clearTimeoutBindings: ts.Identifier[] = [];
  const clearTimeoutReferences: ts.Identifier[] = [];
  const clearTimeoutCalls: ts.CallExpression[] = [];
  const promiseThenCalls: ts.CallExpression[] = [];
  const promiseFinallyCalls: ts.CallExpression[] = [];
  const promiseCatchCalls: ts.CallExpression[] = [];
  const addEventListenerCalls: ts.CallExpression[] = [];
  const removeEventListenerCalls: ts.CallExpression[] = [];
  const emitterOnCalls: ts.CallExpression[] = [];
  const emitterOnceCalls: ts.CallExpression[] = [];
  const mainCatches: {
    readonly callback: ts.ArrowFunction | ts.FunctionExpression;
    readonly mainCall: ts.CallExpression;
  }[] = [];
  let forbiddenFailureDetail = false;
  let forbiddenOutputTarget = false;
  let forbiddenGlobalRecovery = false;
  let forbiddenValueVoid = false;
  let invalidProcessReference = false;

  const isBindingIdentifier = (node: ts.Identifier): boolean => {
    const { parent } = node;
    return (
      ((ts.isVariableDeclaration(parent) ||
        ts.isParameter(parent) ||
        ts.isBindingElement(parent) ||
        ts.isFunctionDeclaration(parent) ||
        ts.isFunctionExpression(parent) ||
        ts.isClassDeclaration(parent) ||
        ts.isClassExpression(parent) ||
        ts.isTypeAliasDeclaration(parent) ||
        ts.isInterfaceDeclaration(parent) ||
        ts.isEnumDeclaration(parent)) &&
        parent.name === node) ||
      (ts.isImportSpecifier(parent) && parent.name === node) ||
      (ts.isNamespaceImport(parent) && parent.name === node) ||
      (ts.isImportClause(parent) && parent.name === node)
    );
  };

  const processStreamName = (node: ts.Node): string | null => {
    if (
      !ts.isPropertyAccessExpression(node) &&
      !ts.isElementAccessExpression(node)
    )
      return null;
    const receiver = unwrapBoundaryExpression(node.expression);
    if (!ts.isIdentifier(receiver) || receiver.text !== "process") return null;
    return ts.isPropertyAccessExpression(node)
      ? node.name.text
      : staticStringValue(node.argumentExpression);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (node.name.text === "ACCEPTANCE_PHASES") phaseDeclarations.push(node);
      if (node.name.text === "acceptancePhase") trackerDeclarations.push(node);
      if (node.name.text === "primaryFailure") primaryDeclarations.push(node);
      if (node.name.text === "invokedPath") invokedPathDeclarations.push(node);
    }
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text ===
        "filingParserNormalizationExecutionAcceptanceFailureDiagnostic"
    )
      diagnosticFunctions.push(node);
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text ===
        "filingParserNormalizationExecutionAcceptanceCleanupShouldReplacePhase"
    )
      cleanupPrecedenceFunctions.push(node);
    if (ts.isFunctionDeclaration(node) && node.name?.text === "main")
      mainFunctions.push(node);
    if (ts.isCallExpression(node)) {
      const callee = unwrapBoundaryExpression(node.expression);
      if (ts.isIdentifier(callee)) {
        if (effectfulFsPromiseNames.has(callee.text))
          effectfulFsPromiseCalls.push(node);
        if (callee.text === "writeFile") writeFileCalls.push(node);
        if (callee.text === "spawn") spawnCalls.push(node);
        if (callee.text === "setTimeout") setTimeoutCalls.push(node);
        if (callee.text === "clearTimeout") clearTimeoutCalls.push(node);
      }
      const chainedCall = namedBoundaryPropertyAccess(
        node.expression,
        new Set([
          "addEventListener",
          "catch",
          "finally",
          "on",
          "once",
          "removeEventListener",
          "then",
        ]),
      );
      if (chainedCall !== null) {
        const chainedName = ts.isPropertyAccessExpression(chainedCall)
          ? chainedCall.name.text
          : staticStringValue(chainedCall.argumentExpression);
        switch (chainedName) {
          case "addEventListener":
            addEventListenerCalls.push(node);
            break;
          case "catch":
            promiseCatchCalls.push(node);
            break;
          case "finally":
            promiseFinallyCalls.push(node);
            break;
          case "on":
            emitterOnCalls.push(node);
            break;
          case "once":
            emitterOnceCalls.push(node);
            break;
          case "removeEventListener":
            removeEventListenerCalls.push(node);
            break;
          case "then":
            promiseThenCalls.push(node);
            break;
        }
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "Promise"
      )
        promiseStaticCalls.push(node);
      if (ts.isIdentifier(callee) && callee.text === "main")
        directMainCalls.push(node);
      if (ts.isIdentifier(callee) && callee.text === "markPhase") {
        markerCalls.push(node);
        const markerArgument = node.arguments[0];
        const marker =
          node.arguments.length === 1 &&
          markerArgument !== undefined &&
          ts.isStringLiteral(markerArgument)
            ? markerArgument.text
            : null;
        if (marker !== null) markerPhases.push(marker);
      }
      const writeAccess = namedBoundaryPropertyAccess(
        node.expression,
        new Set(["write"]),
      );
      if (
        writeAccess !== null &&
        processStreamName(unwrapBoundaryExpression(writeAccess.expression)) ===
          "stderr"
      )
        stderrWrites.push(node);
      const catchAccess = namedBoundaryPropertyAccess(
        node.expression,
        new Set(["catch"]),
      );
      const catchReceiver =
        catchAccess === null
          ? null
          : unwrapBoundaryExpression(catchAccess.expression);
      if (
        catchReceiver !== null &&
        ts.isCallExpression(catchReceiver) &&
        ts.isIdentifier(unwrapBoundaryExpression(catchReceiver.expression)) &&
        unwrapBoundaryExpression(catchReceiver.expression).getText() ===
          "main" &&
        node.arguments.length === 1
      ) {
        const callbackArgument = node.arguments[0];
        if (callbackArgument !== undefined) {
          const callback = unwrapBoundaryExpression(callbackArgument);
          if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
            mainCatches.push({ callback, mainCall: catchReceiver });
        }
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(unwrapBoundaryExpression(node.left)) &&
      unwrapBoundaryExpression(node.left).getText() === "primaryFailure"
    )
      primaryAssignments.push(node);
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(unwrapBoundaryExpression(node.expression)) &&
      unwrapBoundaryExpression(node.expression).getText() === "Promise"
    )
      promiseNewCalls.push(node);
    if (
      ts.isPropertyAssignment(node) &&
      propertyNameText(node.name) === "stdio"
    )
      stdioProperties.push(node);
    if (ts.isIdentifier(node)) {
      if (effectfulFsPromiseNames.has(node.text)) {
        if (isBindingIdentifier(node)) effectfulFsPromiseBindings.push(node);
        else effectfulFsPromiseReferences.push(node);
      }
      if (["console", "global", "globalThis"].includes(node.text))
        forbiddenGlobalRecovery = true;
      if (node.text === "main") {
        if (!(
          ts.isFunctionDeclaration(node.parent) && node.parent.name === node
        ))
          mainReferences.push(node);
      } else if (node.text === "markPhase") {
        if (isBindingIdentifier(node)) markPhaseBindings.push(node);
        else markPhaseReferences.push(node);
      } else if (
        node.text ===
        "filingParserNormalizationExecutionAcceptanceFailureDiagnostic"
      ) {
        if (isBindingIdentifier(node)) diagnosticBindings.push(node);
        else diagnosticReferences.push(node);
      } else if (
        node.text ===
        "filingParserNormalizationExecutionAcceptanceCleanupShouldReplacePhase"
      ) {
        if (isBindingIdentifier(node)) cleanupPrecedenceBindings.push(node);
        else cleanupPrecedenceReferences.push(node);
      } else if (node.text === "primaryFailure") {
        if (isBindingIdentifier(node)) primaryBindings.push(node);
        else primaryReferences.push(node);
      } else if (node.text === "resolve" && isBindingIdentifier(node)) {
        resolveBindings.push(node);
      } else if (node.text === "pathToFileURL" && isBindingIdentifier(node)) {
        pathToFileUrlBindings.push(node);
      } else if (node.text === "Promise") {
        if (isBindingIdentifier(node)) promiseBindings.push(node);
        else if (!ts.isTypeReferenceNode(node.parent))
          promiseReferences.push(node);
      } else if (node.text === "Error" && isBindingIdentifier(node)) {
        errorBindings.push(node);
      } else if (node.text === "writeFile") {
        if (isBindingIdentifier(node)) writeFileBindings.push(node);
        else writeFileReferences.push(node);
      } else if (node.text === "spawn") {
        if (isBindingIdentifier(node)) spawnBindings.push(node);
        else spawnReferences.push(node);
      } else if (node.text === "setTimeout") {
        if (isBindingIdentifier(node)) setTimeoutBindings.push(node);
        else setTimeoutReferences.push(node);
      } else if (node.text === "clearTimeout") {
        if (isBindingIdentifier(node)) clearTimeoutBindings.push(node);
        else clearTimeoutReferences.push(node);
      } else if (node.text === "process") {
        const parent = node.parent;
        if (
          !ts.isPropertyAccessExpression(parent) ||
          parent.expression !== node ||
          parent.questionDotToken !== undefined
        ) {
          invalidProcessReference = true;
        } else {
          processPropertyReferences.push(parent.name.text);
          if (
            ["argv", "env", "stderr"].includes(parent.name.text) &&
            !(
              (ts.isPropertyAccessExpression(parent.parent) ||
                ts.isElementAccessExpression(parent.parent)) &&
              parent.parent.expression === parent
            )
          )
            invalidProcessReference = true;
        }
      }
    }
    if (ts.isVoidExpression(node)) forbiddenValueVoid = true;
    if (ts.isStringLiteralLike(node)) {
      const outputTarget = node.text.replaceAll("\\", "/").toLowerCase();
      if (
        outputTarget === "inherit" ||
        outputTarget.includes("/dev/stderr") ||
        outputTarget.includes("/dev/stdout") ||
        outputTarget.includes("/dev/fd/1") ||
        outputTarget.includes("/dev/fd/2") ||
        outputTarget.includes("/proc/self/fd/1") ||
        outputTarget.includes("/proc/self/fd/2") ||
        outputTarget.includes("conerr$") ||
        outputTarget.includes("conout$")
      )
        forbiddenOutputTarget = true;
    }
    const stream = processStreamName(node);
    if (stream === "stderr") stderrAccesses.push(node);
    if (stream === "stdout") stdoutAccesses.push(node);
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      ["message", "stack"].includes(
        ts.isPropertyAccessExpression(node)
          ? node.name.text
          : (staticStringValue(node.argumentExpression) ?? ""),
      )
    )
      forbiddenFailureDetail = true;
    if (ts.isIdentifier(node) && node.text === "console")
      forbiddenFailureDetail = true;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const hasExactUnaliasedImportBinding = (
    binding: ts.Identifier | undefined,
    moduleName: string,
  ): boolean => {
    if (binding === undefined || !ts.isImportSpecifier(binding.parent))
      return false;
    const specifier = binding.parent;
    let ancestor: ts.Node = specifier;
    while (!ts.isImportDeclaration(ancestor) && ancestor.parent !== undefined)
      ancestor = ancestor.parent;
    return (
      ts.isImportDeclaration(ancestor) &&
      ts.isStringLiteral(ancestor.moduleSpecifier) &&
      ancestor.moduleSpecifier.text === moduleName &&
      specifier.propertyName === undefined &&
      specifier.name === binding
    );
  };
  const exactNamedImportBindings = (
    moduleName: string,
    names: readonly string[],
  ): readonly ts.Identifier[] | null => {
    const imports = sourceFile.statements.filter(
      (statement): statement is ts.ImportDeclaration =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === moduleName,
    );
    const clause = imports[0]?.importClause;
    if (
      imports.length !== 1 ||
      clause === undefined ||
      clause.isTypeOnly ||
      clause.name !== undefined ||
      clause.namedBindings === undefined ||
      !ts.isNamedImports(clause.namedBindings) ||
      clause.namedBindings.elements.length !== names.length
    )
      return null;
    const bindings: ts.Identifier[] = [];
    for (let index = 0; index < names.length; index += 1) {
      const expected = names[index];
      const specifier = clause.namedBindings.elements[index];
      if (
        expected === undefined ||
        specifier === undefined ||
        specifier.isTypeOnly ||
        specifier.propertyName !== undefined ||
        specifier.name.text !== expected
      )
        return null;
      bindings.push(specifier.name);
    }
    return bindings;
  };
  const fsPromiseBindings = exactNamedImportBindings("node:fs/promises", [
    "lstat",
    "mkdtemp",
    "readFile",
    "rename",
    "rm",
    "writeFile",
  ]);
  const childProcessBindings = exactNamedImportBindings("node:child_process", [
    "spawn",
  ]);
  const topLevelIfStatements = sourceFile.statements.filter(ts.isIfStatement);
  const topLevelVariableStatements = sourceFile.statements.filter(
    ts.isVariableStatement,
  );
  const topLevelVariableNames = topLevelVariableStatements.flatMap(
    (statement) =>
      statement.declarationList.declarations.map((declaration) =>
        ts.isIdentifier(declaration.name) ? declaration.name.text : null,
      ),
  );
  const topLevelKindsValid = sourceFile.statements.every(
    (statement) =>
      ts.isImportDeclaration(statement) ||
      ts.isVariableStatement(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isIfStatement(statement),
  );
  let unexpectedTopLevelInitializerExecution = false;
  for (const statement of topLevelVariableStatements) {
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "ACCEPTANCE_PHASES"
      )
        continue;
      const inspectInitializer = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) ||
          ts.isNewExpression(node) ||
          ts.isAwaitExpression(node) ||
          ts.isTaggedTemplateExpression(node)
        ) {
          unexpectedTopLevelInitializerExecution = true;
          return;
        }
        ts.forEachChild(node, inspectInitializer);
      };
      if (declaration.initializer !== undefined)
        inspectInitializer(declaration.initializer);
    }
  }
  if (
    forbiddenFailureDetail ||
    forbiddenOutputTarget ||
    forbiddenGlobalRecovery ||
    forbiddenValueVoid ||
    invalidProcessReference ||
    JSON.stringify(processPropertyReferences) !==
      JSON.stringify([
        "version",
        "platform",
        "arch",
        "env",
        "env",
        "env",
        "env",
        "env",
        "argv",
        "stderr",
        "exitCode",
      ]) ||
    resolveBindings.length !== 1 ||
    !hasExactUnaliasedImportBinding(resolveBindings[0], "node:path") ||
    pathToFileUrlBindings.length !== 1 ||
    !hasExactUnaliasedImportBinding(pathToFileUrlBindings[0], "node:url") ||
    promiseBindings.length !== 0 ||
    errorBindings.length !== 0 ||
    fsPromiseBindings === null ||
    effectfulFsPromiseBindings.length !== fsPromiseBindings.length ||
    effectfulFsPromiseBindings.some(
      (binding, index) => binding !== fsPromiseBindings[index],
    ) ||
    JSON.stringify(
      effectfulFsPromiseReferences.map((reference) => reference.text),
    ) !==
      JSON.stringify([
        "mkdtemp",
        "readFile",
        "writeFile",
        "rename",
        "rm",
        "rm",
        "readFile",
        "lstat",
      ]) ||
    effectfulFsPromiseCalls.length !== effectfulFsPromiseReferences.length ||
    effectfulFsPromiseReferences.some(
      (reference, index) =>
        reference !== effectfulFsPromiseCalls[index]?.expression,
    ) ||
    fsPromiseBindings[5] !== writeFileBindings[0] ||
    childProcessBindings === null ||
    childProcessBindings[0] !== spawnBindings[0] ||
    writeFileBindings.length !== 1 ||
    writeFileReferences.length !== 1 ||
    writeFileCalls.length !== 1 ||
    writeFileReferences[0] !== writeFileCalls[0]?.expression ||
    spawnBindings.length !== 1 ||
    spawnReferences.length !== 1 ||
    spawnCalls.length !== 1 ||
    spawnReferences[0] !== spawnCalls[0]?.expression ||
    setTimeoutBindings.length !== 0 ||
    setTimeoutReferences.length !== 1 ||
    setTimeoutCalls.length !== 1 ||
    setTimeoutReferences[0] !== setTimeoutCalls[0]?.expression ||
    clearTimeoutBindings.length !== 0 ||
    clearTimeoutReferences.length !== 1 ||
    clearTimeoutCalls.length !== 1 ||
    clearTimeoutReferences[0] !== clearTimeoutCalls[0]?.expression ||
    promiseThenCalls.length !== 0 ||
    promiseFinallyCalls.length !== 0 ||
    promiseCatchCalls.length !== 2 ||
    addEventListenerCalls.length !== 1 ||
    removeEventListenerCalls.length !== 1 ||
    emitterOnCalls.length !== 2 ||
    emitterOnceCalls.length !== 2 ||
    JSON.stringify(
      promiseStaticCalls.map((call) =>
        ts.isPropertyAccessExpression(call.expression)
          ? call.expression.name.text
          : null,
      ),
    ) !== JSON.stringify(["resolve", "reject", "reject"]) ||
    promiseNewCalls.length !== 1 ||
    !topLevelKindsValid ||
    topLevelIfStatements.length !== 1 ||
    JSON.stringify(topLevelVariableNames) !==
      JSON.stringify([
        "BASE_INDEX_DIGEST",
        "BASE_PLATFORM_MANIFEST_DIGEST",
        "BASE_IMAGE",
        "KEY_ID",
        "EVIDENCE_FILE",
        "HASH",
        "COMMIT",
        "MAX_COMMAND_BYTES",
        "ACCEPTANCE_PHASES",
        "invokedPath",
      ]) ||
    unexpectedTopLevelInitializerExecution
  )
    return violation;
  const stdioProperty = stdioProperties[0];
  const stdioInitializer =
    stdioProperty === undefined
      ? undefined
      : unwrapBoundaryExpression(stdioProperty.initializer);
  if (
    stdioProperties.length !== 1 ||
    stdioInitializer === undefined ||
    !ts.isArrayLiteralExpression(stdioInitializer) ||
    JSON.stringify(
      stdioInitializer.elements.map((element) =>
        ts.isStringLiteral(element) ? element.text : null,
      ),
    ) !== JSON.stringify(["ignore", "pipe", "pipe"])
  )
    return violation;

  const phaseDeclaration = phaseDeclarations[0];
  const phaseVariableStatement =
    phaseDeclaration !== undefined &&
    ts.isVariableDeclarationList(phaseDeclaration.parent)
      ? phaseDeclaration.parent.parent
      : undefined;
  if (
    phaseDeclarations.length !== 1 ||
    phaseDeclaration === undefined ||
    phaseDeclaration.initializer === undefined ||
    !ts.isVariableDeclarationList(phaseDeclaration.parent) ||
    (phaseDeclaration.parent.flags & ts.NodeFlags.Const) === 0 ||
    phaseVariableStatement === undefined ||
    !ts.isVariableStatement(phaseVariableStatement) ||
    phaseVariableStatement.modifiers?.length !== 1 ||
    phaseVariableStatement.modifiers[0]?.kind !== ts.SyntaxKind.ExportKeyword
  )
    return violation;
  const frozenPhases = unwrapBoundaryExpression(phaseDeclaration.initializer);
  if (!ts.isCallExpression(frozenPhases)) return violation;
  const freeze = unwrapBoundaryExpression(frozenPhases.expression);
  if (
    !ts.isPropertyAccessExpression(freeze) ||
    freeze.name.text !== "freeze" ||
    !ts.isIdentifier(unwrapBoundaryExpression(freeze.expression)) ||
    unwrapBoundaryExpression(freeze.expression).getText() !== "Object" ||
    frozenPhases.arguments.length !== 1
  )
    return violation;
  const frozenPhaseArgument = frozenPhases.arguments[0];
  if (frozenPhaseArgument === undefined) return violation;
  const phaseArray = unwrapBoundaryExpression(frozenPhaseArgument);
  if (
    !ts.isArrayLiteralExpression(phaseArray) ||
    phaseArray.elements.some((element) => !ts.isStringLiteral(element)) ||
    JSON.stringify(
      phaseArray.elements.map((element) =>
        ts.isStringLiteral(element) ? element.text : null,
      ),
    ) !==
      JSON.stringify(filingParserNormalizationExecutionAcceptanceFailurePhases)
  )
    return violation;

  const diagnosticFunction = diagnosticFunctions[0];
  if (
    diagnosticFunctions.length !== 1 ||
    diagnosticFunction === undefined ||
    diagnosticFunction.name === undefined ||
    diagnosticBindings.length !== 1 ||
    diagnosticBindings[0] !== diagnosticFunction.name ||
    diagnosticReferences.length !== 1
  )
    return violation;
  const diagnosticParameter = diagnosticFunction.parameters[0];
  const diagnosticBody = diagnosticFunction.body;
  if (
    diagnosticFunction.modifiers?.length !== 1 ||
    diagnosticFunction.modifiers[0]?.kind !== ts.SyntaxKind.ExportKeyword ||
    diagnosticFunction.parameters.length !== 1 ||
    diagnosticParameter === undefined ||
    !ts.isIdentifier(diagnosticParameter.name) ||
    diagnosticParameter.name.text !== "phase" ||
    diagnosticParameter.type?.kind !== ts.SyntaxKind.UnknownKeyword ||
    diagnosticFunction.type?.kind !== ts.SyntaxKind.StringKeyword ||
    diagnosticBody === undefined ||
    diagnosticBody.statements.length !== 1
  )
    return violation;
  const switchStatement = diagnosticBody.statements[0];
  if (
    switchStatement === undefined ||
    !ts.isSwitchStatement(switchStatement) ||
    !ts.isIdentifier(switchStatement.expression) ||
    switchStatement.expression.text !== "phase" ||
    switchStatement.caseBlock.clauses.length !==
      filingParserNormalizationExecutionAcceptanceFailurePhases.length + 1
  )
    return violation;
  for (
    let index = 0;
    index < filingParserNormalizationExecutionAcceptanceFailurePhases.length;
    index += 1
  ) {
    const phase =
      filingParserNormalizationExecutionAcceptanceFailurePhases[index];
    const clause = switchStatement.caseBlock.clauses[index];
    const statement = clause?.statements[0];
    if (
      phase === undefined ||
      clause === undefined ||
      !ts.isCaseClause(clause) ||
      !ts.isStringLiteral(clause.expression) ||
      clause.expression.text !== phase ||
      clause.statements.length !== 1 ||
      statement === undefined ||
      !ts.isReturnStatement(statement) ||
      statement.expression === undefined ||
      !ts.isStringLiteral(statement.expression) ||
      statement.expression.text !==
        `${filingParserNormalizationExecutionAcceptanceFailurePrefix}${phase}\n`
    )
      return violation;
  }
  const defaultClause = switchStatement.caseBlock.clauses.at(-1);
  const defaultStatement = defaultClause?.statements[0];
  if (
    defaultClause === undefined ||
    !ts.isDefaultClause(defaultClause) ||
    defaultClause.statements.length !== 1 ||
    defaultStatement === undefined ||
    !ts.isReturnStatement(defaultStatement) ||
    defaultStatement.expression === undefined ||
    !ts.isStringLiteral(defaultStatement.expression) ||
    defaultStatement.expression.text !==
      `${filingParserNormalizationExecutionAcceptanceFailurePrefix}internal\n`
  )
    return violation;

  const cleanupPrecedenceFunction = cleanupPrecedenceFunctions[0];
  if (
    cleanupPrecedenceFunctions.length !== 1 ||
    cleanupPrecedenceFunction === undefined ||
    cleanupPrecedenceFunction.modifiers?.length !== 1 ||
    cleanupPrecedenceFunction.modifiers[0]?.kind !==
      ts.SyntaxKind.ExportKeyword ||
    cleanupPrecedenceFunction.parameters.length !== 1 ||
    cleanupPrecedenceFunction.type?.kind !== ts.SyntaxKind.BooleanKeyword ||
    cleanupPrecedenceFunction.body?.statements.length !== 1 ||
    cleanupPrecedenceFunction.name === undefined ||
    cleanupPrecedenceBindings.length !== 1 ||
    cleanupPrecedenceBindings[0] !== cleanupPrecedenceFunction.name ||
    cleanupPrecedenceReferences.length !== 1
  )
    return violation;
  const cleanupPrecedenceParameter = cleanupPrecedenceFunction.parameters[0];
  const cleanupPrecedenceReturn = cleanupPrecedenceFunction.body?.statements[0];
  if (
    cleanupPrecedenceParameter === undefined ||
    !ts.isIdentifier(cleanupPrecedenceParameter.name) ||
    cleanupPrecedenceParameter.name.text !== "hadPrimaryFailure" ||
    cleanupPrecedenceParameter.type?.kind !== ts.SyntaxKind.BooleanKeyword ||
    cleanupPrecedenceReturn === undefined ||
    !ts.isReturnStatement(cleanupPrecedenceReturn) ||
    cleanupPrecedenceReturn.expression === undefined ||
    !ts.isBinaryExpression(cleanupPrecedenceReturn.expression) ||
    cleanupPrecedenceReturn.expression.operatorToken.kind !==
      ts.SyntaxKind.EqualsEqualsEqualsToken ||
    !ts.isIdentifier(cleanupPrecedenceReturn.expression.left) ||
    cleanupPrecedenceReturn.expression.left.text !== "hadPrimaryFailure" ||
    cleanupPrecedenceReturn.expression.right.kind !== ts.SyntaxKind.FalseKeyword
  )
    return violation;

  const trackerDeclaration = trackerDeclarations[0];
  const mainFunction = mainFunctions[0];
  const mainParameter = mainFunction?.parameters[0];
  if (
    markerCalls.length !== markerPhases.length ||
    JSON.stringify(markerPhases) !==
      JSON.stringify(
        filingParserNormalizationExecutionAcceptanceMarkerSequence,
      ) ||
    trackerDeclarations.length !== 1 ||
    trackerDeclaration === undefined ||
    trackerDeclaration.initializer === undefined ||
    !ts.isStringLiteral(trackerDeclaration.initializer) ||
    trackerDeclaration.initializer.text !== "environment" ||
    !ts.isVariableDeclarationList(trackerDeclaration.parent) ||
    (trackerDeclaration.parent.flags & ts.NodeFlags.Let) === 0 ||
    trackerDeclaration.parent.declarations.length !== 1 ||
    mainFunctions.length !== 1 ||
    mainFunction === undefined ||
    mainFunction.modifiers?.length !== 1 ||
    mainFunction.modifiers[0]?.kind !== ts.SyntaxKind.AsyncKeyword ||
    mainFunction.parameters.length !== 1 ||
    mainParameter === undefined ||
    !ts.isIdentifier(mainParameter.name) ||
    mainParameter.name.text !== "markPhase" ||
    mainParameter.type?.getText(sourceFile) !== "AcceptancePhaseMarker" ||
    mainFunction.type?.getText(sourceFile) !== "Promise<void>" ||
    mainFunction.body === undefined ||
    markPhaseBindings.length !== 1 ||
    markPhaseBindings[0] !== mainParameter.name ||
    markPhaseReferences.length !== markerCalls.length ||
    markerCalls.some(
      (call, index) =>
        !ts.isIdentifier(call.expression) ||
        call.expression.text !== "markPhase" ||
        markPhaseReferences[index] !== call.expression,
    ) ||
    mainCatches.length !== 1 ||
    directMainCalls.length !== 1 ||
    mainReferences.length !== 1
  )
    return violation;
  const mainCatch = mainCatches[0];
  if (
    mainCatch === undefined ||
    directMainCalls[0] !== mainCatch.mainCall ||
    mainReferences[0] !== mainCatch.mainCall.expression ||
    !ts.isArrowFunction(mainCatch.callback) ||
    mainCatch.callback.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
    ) === true ||
    mainCatch.callback.parameters.length !== 0 ||
    mainCatch.mainCall.arguments.length !== 1 ||
    !ts.isBlock(mainCatch.callback.body) ||
    mainCatch.callback.body.statements.length !== 2
  )
    return violation;
  const mainCallProperty = mainCatch.mainCall.parent;
  const caughtMainCall = mainCallProperty.parent;
  const awaitedMainCall = caughtMainCall.parent;
  const invokedStatement = awaitedMainCall.parent;
  const invokedBlock = invokedStatement.parent;
  const invokedIf = invokedBlock.parent;
  if (
    !ts.isPropertyAccessExpression(mainCallProperty) ||
    mainCallProperty.expression !== mainCatch.mainCall ||
    mainCallProperty.name.text !== "catch" ||
    !ts.isCallExpression(caughtMainCall) ||
    caughtMainCall.expression !== mainCallProperty ||
    caughtMainCall.arguments[0] !== mainCatch.callback ||
    !ts.isAwaitExpression(awaitedMainCall) ||
    awaitedMainCall.expression !== caughtMainCall ||
    !ts.isExpressionStatement(invokedStatement) ||
    invokedStatement.expression !== awaitedMainCall ||
    !ts.isBlock(invokedBlock) ||
    invokedBlock.statements.length !== 2 ||
    invokedBlock.statements[1] !== invokedStatement ||
    !ts.isIfStatement(invokedIf) ||
    invokedIf.parent !== sourceFile ||
    topLevelIfStatements[0] !== invokedIf ||
    invokedIf.thenStatement !== invokedBlock ||
    invokedIf.elseStatement !== undefined ||
    invokedIf.expression.getText(sourceFile).replace(/\s+/gu, "") !==
      "invokedPath!==undefined&&import.meta.url===pathToFileURL(resolve(invokedPath)).href"
  )
    return violation;
  const trackerDeclarationList = trackerDeclaration.parent;
  const trackerVariableStatement = trackerDeclarationList.parent;
  if (
    !ts.isVariableStatement(trackerVariableStatement) ||
    invokedBlock.statements[0] !== trackerVariableStatement
  )
    return violation;
  const invokedPathDeclaration = invokedPathDeclarations[0];
  if (
    invokedPathDeclarations.length !== 1 ||
    invokedPathDeclaration === undefined ||
    invokedPathDeclaration.initializer === undefined ||
    !ts.isVariableDeclarationList(invokedPathDeclaration.parent) ||
    (invokedPathDeclaration.parent.flags & ts.NodeFlags.Const) === 0
  )
    return violation;
  const invokedPathInitializer = unwrapBoundaryExpression(
    invokedPathDeclaration.initializer,
  );
  const invokedPathVariableStatement = invokedPathDeclaration.parent.parent;
  const argvAccess = ts.isElementAccessExpression(invokedPathInitializer)
    ? unwrapBoundaryExpression(invokedPathInitializer.expression)
    : undefined;
  if (
    !ts.isElementAccessExpression(invokedPathInitializer) ||
    argvAccess === undefined ||
    !ts.isPropertyAccessExpression(argvAccess) ||
    !ts.isIdentifier(argvAccess.expression) ||
    argvAccess.expression.text !== "process" ||
    argvAccess.name.text !== "argv" ||
    !ts.isNumericLiteral(invokedPathInitializer.argumentExpression) ||
    invokedPathInitializer.argumentExpression.text !== "1" ||
    !ts.isVariableStatement(invokedPathVariableStatement) ||
    invokedPathVariableStatement.parent !== sourceFile ||
    sourceFile.statements.indexOf(invokedPathVariableStatement) + 1 !==
      sourceFile.statements.indexOf(invokedIf) ||
    sourceFile.statements.at(-2) !== invokedPathVariableStatement ||
    sourceFile.statements.at(-1) !== invokedIf
  )
    return violation;
  const markerCallbackArgument = mainCatch.mainCall.arguments[0];
  if (markerCallbackArgument === undefined) return violation;
  const markerCallback = unwrapBoundaryExpression(markerCallbackArgument);
  const markerParameter = ts.isArrowFunction(markerCallback)
    ? markerCallback.parameters[0]
    : undefined;
  if (
    !ts.isArrowFunction(markerCallback) ||
    markerCallback.parameters.length !== 1 ||
    markerParameter === undefined ||
    !ts.isIdentifier(markerParameter.name) ||
    markerParameter.name.text !== "phase" ||
    !ts.isBlock(markerCallback.body) ||
    markerCallback.body.statements.length !== 1
  )
    return violation;
  const trackerStatement = markerCallback.body.statements[0];
  if (
    trackerStatement === undefined ||
    !ts.isExpressionStatement(trackerStatement) ||
    !ts.isBinaryExpression(trackerStatement.expression) ||
    trackerStatement.expression.operatorToken.kind !==
      ts.SyntaxKind.EqualsToken ||
    !ts.isIdentifier(
      unwrapBoundaryExpression(trackerStatement.expression.left),
    ) ||
    unwrapBoundaryExpression(trackerStatement.expression.left).getText() !==
      "acceptancePhase" ||
    !ts.isIdentifier(
      unwrapBoundaryExpression(trackerStatement.expression.right),
    ) ||
    unwrapBoundaryExpression(trackerStatement.expression.right).getText() !==
      "phase"
  )
    return violation;

  if (
    stderrAccesses.length !== 1 ||
    stdoutAccesses.length !== 0 ||
    stderrWrites.length !== 1 ||
    forbiddenFailureDetail
  )
    return violation;
  const stderrWrite = stderrWrites[0];
  if (stderrWrite === undefined || stderrWrite.arguments.length !== 1)
    return violation;
  const stderrArgument = stderrWrite.arguments[0];
  const stderrWriteAccess = unwrapBoundaryExpression(stderrWrite.expression);
  const stderrStreamAccess =
    ts.isPropertyAccessExpression(stderrWriteAccess) &&
    stderrWriteAccess.name.text === "write"
      ? unwrapBoundaryExpression(stderrWriteAccess.expression)
      : undefined;
  if (
    stderrArgument === undefined ||
    !ts.isPropertyAccessExpression(stderrWriteAccess) ||
    stderrStreamAccess === undefined ||
    !ts.isPropertyAccessExpression(stderrStreamAccess) ||
    stderrStreamAccess.name.text !== "stderr" ||
    !ts.isIdentifier(stderrStreamAccess.expression) ||
    stderrStreamAccess.expression.text !== "process" ||
    !ts.isCallExpression(stderrArgument) ||
    !ts.isIdentifier(unwrapBoundaryExpression(stderrArgument.expression)) ||
    unwrapBoundaryExpression(stderrArgument.expression).getText() !==
      "filingParserNormalizationExecutionAcceptanceFailureDiagnostic" ||
    diagnosticReferences[0] !== stderrArgument.expression ||
    stderrArgument.arguments.length !== 1 ||
    !nodeIsWithin(stderrWrite, mainCatch.callback.body)
  )
    return violation;
  const catchStderrStatement = mainCatch.callback.body.statements[0];
  const catchExitStatement = mainCatch.callback.body.statements[1];
  const catchExitExpression =
    catchExitStatement !== undefined &&
    ts.isExpressionStatement(catchExitStatement)
      ? catchExitStatement.expression
      : undefined;
  const catchExitTarget =
    catchExitExpression !== undefined &&
    ts.isBinaryExpression(catchExitExpression) &&
    catchExitExpression.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ? unwrapBoundaryExpression(catchExitExpression.left)
      : undefined;
  if (
    catchStderrStatement === undefined ||
    !ts.isExpressionStatement(catchStderrStatement) ||
    catchStderrStatement.expression !== stderrWrite ||
    catchExitExpression === undefined ||
    !ts.isBinaryExpression(catchExitExpression) ||
    catchExitTarget === undefined ||
    !ts.isPropertyAccessExpression(catchExitTarget) ||
    catchExitTarget.name.text !== "exitCode" ||
    !ts.isIdentifier(catchExitTarget.expression) ||
    catchExitTarget.expression.text !== "process" ||
    !ts.isNumericLiteral(catchExitExpression.right) ||
    catchExitExpression.right.text !== "1"
  )
    return violation;
  const diagnosticPhaseArgument = stderrArgument.arguments[0];
  if (
    diagnosticPhaseArgument === undefined ||
    !ts.isIdentifier(unwrapBoundaryExpression(diagnosticPhaseArgument)) ||
    unwrapBoundaryExpression(diagnosticPhaseArgument).getText() !==
      "acceptancePhase"
  )
    return violation;

  const primaryDeclaration = primaryDeclarations[0];
  const primaryAssignment = primaryAssignments[0];
  if (
    primaryDeclarations.length !== 1 ||
    primaryDeclaration === undefined ||
    primaryDeclaration.initializer?.kind !== ts.SyntaxKind.FalseKeyword ||
    !ts.isVariableDeclarationList(primaryDeclaration.parent) ||
    (primaryDeclaration.parent.flags & ts.NodeFlags.Let) === 0 ||
    primaryBindings.length !== 1 ||
    primaryBindings[0] !== primaryDeclaration.name ||
    primaryReferences.length !== 2 ||
    primaryAssignments.length !== 1 ||
    primaryAssignment === undefined ||
    primaryAssignment.right.kind !== ts.SyntaxKind.TrueKeyword
  )
    return violation;
  const primaryAssignmentStatement = primaryAssignment.parent;
  if (!ts.isExpressionStatement(primaryAssignmentStatement)) return violation;
  const primaryCatchBlock = primaryAssignmentStatement.parent;
  if (
    !ts.isBlock(primaryCatchBlock) ||
    primaryCatchBlock.statements.length !== 2
  )
    return violation;
  const primaryCatch = primaryCatchBlock.parent;
  const primaryThrow = primaryCatchBlock.statements[1];
  const primaryCatchName = ts.isCatchClause(primaryCatch)
    ? primaryCatch.variableDeclaration?.name
    : undefined;
  if (
    !ts.isCatchClause(primaryCatch) ||
    primaryThrow === undefined ||
    !ts.isThrowStatement(primaryThrow) ||
    primaryCatchName === undefined ||
    !ts.isIdentifier(primaryCatchName) ||
    primaryCatchName.text !== "error" ||
    primaryThrow.expression === undefined ||
    !ts.isIdentifier(primaryThrow.expression) ||
    primaryThrow.expression.text !== "error"
  )
    return violation;
  const cleanupCall = markerCalls.at(-1);
  if (cleanupCall === undefined) return violation;
  const cleanupStatement = cleanupCall.parent;
  if (!ts.isExpressionStatement(cleanupStatement)) return violation;
  const cleanupIf = cleanupStatement.parent;
  const cleanupCondition = ts.isIfStatement(cleanupIf)
    ? unwrapBoundaryExpression(cleanupIf.expression)
    : undefined;
  const cleanupConditionCallee =
    cleanupCondition !== undefined && ts.isCallExpression(cleanupCondition)
      ? cleanupCondition.expression
      : undefined;
  if (
    !ts.isIfStatement(cleanupIf) ||
    cleanupIf.thenStatement !== cleanupStatement ||
    cleanupIf.elseStatement !== undefined ||
    cleanupCondition === undefined ||
    !ts.isCallExpression(cleanupCondition) ||
    cleanupConditionCallee === undefined ||
    !ts.isIdentifier(cleanupConditionCallee) ||
    cleanupConditionCallee.text !==
      "filingParserNormalizationExecutionAcceptanceCleanupShouldReplacePhase" ||
    cleanupPrecedenceReferences[0] !== cleanupConditionCallee ||
    cleanupCondition.arguments.length !== 1
  )
    return violation;
  const cleanupPrimaryArgument = cleanupCondition.arguments[0];
  if (
    cleanupPrimaryArgument === undefined ||
    !ts.isIdentifier(unwrapBoundaryExpression(cleanupPrimaryArgument)) ||
    unwrapBoundaryExpression(cleanupPrimaryArgument).getText() !==
      "primaryFailure" ||
    !ts.isIdentifier(unwrapBoundaryExpression(primaryAssignment.left)) ||
    primaryReferences[0] !== unwrapBoundaryExpression(primaryAssignment.left) ||
    primaryReferences[1] !== cleanupPrimaryArgument
  )
    return violation;
  const cleanupBlock = cleanupIf.parent;
  if (!ts.isBlock(cleanupBlock) || cleanupBlock.statements.length !== 2)
    return violation;
  const cleanupCatch = cleanupBlock.parent;
  const cleanupRejection = cleanupBlock.statements[1];
  const cleanupCatchName = ts.isCatchClause(cleanupCatch)
    ? cleanupCatch.variableDeclaration?.name
    : undefined;
  const cleanupAwait =
    cleanupRejection !== undefined &&
    ts.isExpressionStatement(cleanupRejection) &&
    ts.isAwaitExpression(cleanupRejection.expression)
      ? cleanupRejection.expression
      : undefined;
  const cleanupRejectCall =
    cleanupAwait !== undefined && ts.isCallExpression(cleanupAwait.expression)
      ? cleanupAwait.expression
      : undefined;
  const cleanupRejectAccess =
    cleanupRejectCall !== undefined &&
    ts.isPropertyAccessExpression(cleanupRejectCall.expression)
      ? cleanupRejectCall.expression
      : undefined;
  const cleanupRejectReason = cleanupRejectCall?.arguments[0];
  const cleanupReasonCondition =
    cleanupRejectReason !== undefined &&
    ts.isConditionalExpression(cleanupRejectReason)
      ? cleanupRejectReason.condition
      : undefined;
  const cleanupFallbackError =
    cleanupRejectReason !== undefined &&
    ts.isConditionalExpression(cleanupRejectReason)
      ? cleanupRejectReason.whenFalse
      : undefined;
  const cleanupFallbackMessage =
    cleanupFallbackError !== undefined &&
    ts.isNewExpression(cleanupFallbackError)
      ? cleanupFallbackError.arguments?.[0]
      : undefined;
  if (
    !ts.isCatchClause(cleanupCatch) ||
    cleanupAwait === undefined ||
    cleanupRejectCall === undefined ||
    cleanupRejectAccess === undefined ||
    cleanupRejectAccess.name.text !== "reject" ||
    !ts.isIdentifier(cleanupRejectAccess.expression) ||
    cleanupRejectAccess.expression.text !== "Promise" ||
    cleanupRejectCall.arguments.length !== 1 ||
    cleanupCatchName === undefined ||
    !ts.isIdentifier(cleanupCatchName) ||
    cleanupCatchName.text !== "error" ||
    cleanupRejectReason === undefined ||
    !ts.isConditionalExpression(cleanupRejectReason) ||
    cleanupReasonCondition === undefined ||
    !ts.isBinaryExpression(cleanupReasonCondition) ||
    cleanupReasonCondition.operatorToken.kind !==
      ts.SyntaxKind.InstanceOfKeyword ||
    !ts.isIdentifier(cleanupReasonCondition.left) ||
    cleanupReasonCondition.left.text !== "error" ||
    !ts.isIdentifier(cleanupReasonCondition.right) ||
    cleanupReasonCondition.right.text !== "Error" ||
    !ts.isIdentifier(cleanupRejectReason.whenTrue) ||
    cleanupRejectReason.whenTrue.text !== "error" ||
    cleanupFallbackError === undefined ||
    !ts.isNewExpression(cleanupFallbackError) ||
    !ts.isIdentifier(cleanupFallbackError.expression) ||
    cleanupFallbackError.expression.text !== "Error" ||
    cleanupFallbackError.arguments?.length !== 1 ||
    cleanupFallbackMessage === undefined ||
    !ts.isStringLiteral(cleanupFallbackMessage) ||
    cleanupFallbackMessage.text !== "acceptance failed"
  )
    return violation;
  const outerTry = primaryCatch.parent;
  const innerCleanupTry = cleanupCatch.parent;
  const mainBody = mainFunction.body;
  const primaryDeclarationStatement = primaryDeclaration.parent.parent;
  const markerHasExpectedNextStatement = (
    call: ts.CallExpression,
    index: number,
  ): boolean => {
    const markerStatement = call.parent;
    const anchor =
      filingParserNormalizationExecutionAcceptanceNextStatementAnchors[index];
    if (!ts.isExpressionStatement(markerStatement) || anchor === undefined)
      return false;
    let nextStatement: ts.Statement | undefined;
    if (markerPhases[index] === "cleanup") {
      if (markerStatement.parent !== cleanupIf) return false;
      const cleanupIndex = cleanupBlock.statements.indexOf(cleanupIf);
      nextStatement = cleanupBlock.statements[cleanupIndex + 1];
    } else {
      const markerBlock = markerStatement.parent;
      if (!ts.isBlock(markerBlock)) return false;
      const markerIndex = markerBlock.statements.indexOf(markerStatement);
      nextStatement = markerBlock.statements[markerIndex + 1];
    }
    return (
      nextStatement !== undefined &&
      nextStatement
        .getText(sourceFile)
        .replace(/\s+/gu, " ")
        .trim()
        .startsWith(anchor)
    );
  };
  if (
    !ts.isTryStatement(outerTry) ||
    outerTry.parent !== mainBody ||
    outerTry.catchClause !== primaryCatch ||
    outerTry.finallyBlock === undefined ||
    !ts.isTryStatement(innerCleanupTry) ||
    innerCleanupTry.catchClause !== cleanupCatch ||
    innerCleanupTry.parent !== outerTry.finallyBlock ||
    outerTry.finallyBlock.statements.length !== 1 ||
    outerTry.finallyBlock.statements[0] !== innerCleanupTry ||
    !ts.isVariableStatement(primaryDeclarationStatement) ||
    primaryDeclarationStatement.parent !== mainBody ||
    mainBody.statements.indexOf(primaryDeclarationStatement) + 1 !==
      mainBody.statements.indexOf(outerTry) ||
    markerCalls.some((call, index) => {
      const statement = call.parent;
      const phase = markerPhases[index];
      return (
        !markerHasExpectedNextStatement(call, index) ||
        !ts.isExpressionStatement(statement) ||
        (phase === "cleanup"
          ? statement.parent !== cleanupIf
          : statement.parent !== mainBody &&
            statement.parent !== outerTry.tryBlock)
      );
    })
  )
    return violation;

  const commandFunctions = sourceFile.statements.filter(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "command",
  );
  const commandFunction = commandFunctions[0];
  const normalizedFsPromiseCalls = effectfulFsPromiseCalls.map((call) =>
    call.getText(sourceFile).replace(/\s+/gu, " ").trim(),
  );
  if (
    JSON.stringify(normalizedFsPromiseCalls) !==
    JSON.stringify([
      'mkdtemp( join(environment.runnerTemp, "filing-normalization-execution-"), )',
      'readFile(imageIdFile, "utf8")',
      'writeFile( temporaryEvidencePath, serializeCanonicalFilingParserNormalizationExecutionEvidence(evidence), { encoding: "utf8", flag: "wx", mode: 0o600 }, )',
      "rename(temporaryEvidencePath, environment.evidencePath)",
      "rm(temporaryEvidencePath, { force: true })",
      "rm(temporaryDirectory, { force: true, recursive: true })",
      'readFile( "packages/filing-parser-normalization-execution/acceptance/python-image.json", "utf8", )',
      "lstat(path)",
    ])
  )
    return violation;
  const writeFileCall = writeFileCalls[0];
  const writeFileAwait = writeFileCall?.parent;
  const writeFileStatement = writeFileAwait?.parent;
  const writeFilePath = writeFileCall?.arguments[0];
  const writeFilePayload = writeFileCall?.arguments[1];
  if (
    commandFunctions.length !== 1 ||
    commandFunction === undefined ||
    commandFunction.body === undefined ||
    writeFileCall === undefined ||
    writeFileCall.arguments.length !== 3 ||
    writeFilePath === undefined ||
    !ts.isIdentifier(writeFilePath) ||
    writeFilePath.text !== "temporaryEvidencePath" ||
    writeFilePayload === undefined ||
    !ts.isCallExpression(writeFilePayload) ||
    !ts.isIdentifier(writeFilePayload.expression) ||
    writeFilePayload.expression.text !==
      "serializeCanonicalFilingParserNormalizationExecutionEvidence" ||
    writeFileAwait === undefined ||
    !ts.isAwaitExpression(writeFileAwait) ||
    writeFileStatement === undefined ||
    !ts.isExpressionStatement(writeFileStatement) ||
    writeFileStatement.parent !== outerTry.tryBlock
  )
    return violation;

  const spawnCall = spawnCalls[0];
  const spawnArguments = spawnCall?.arguments;
  const spawnExecutable = spawnArguments?.[0];
  const spawnArray = spawnArguments?.[1];
  const spawnOptions = spawnArguments?.[2];
  const spawnSpread =
    spawnArray !== undefined && ts.isArrayLiteralExpression(spawnArray)
      ? spawnArray.elements[0]
      : undefined;
  if (
    spawnCall === undefined ||
    spawnArguments?.length !== 3 ||
    spawnExecutable === undefined ||
    !ts.isIdentifier(spawnExecutable) ||
    spawnExecutable.text !== "executable" ||
    spawnArray === undefined ||
    !ts.isArrayLiteralExpression(spawnArray) ||
    spawnArray.elements.length !== 1 ||
    spawnSpread === undefined ||
    !ts.isSpreadElement(spawnSpread) ||
    !ts.isIdentifier(spawnSpread.expression) ||
    spawnSpread.expression.text !== "args" ||
    spawnOptions === undefined ||
    !ts.isObjectLiteralExpression(spawnOptions) ||
    !nodeIsWithin(spawnCall, commandFunction.body)
  )
    return violation;

  const setTimeoutCall = setTimeoutCalls[0];
  const clearTimeoutCall = clearTimeoutCalls[0];
  const timeoutCallback = setTimeoutCall?.arguments[0];
  const timeoutDuration = setTimeoutCall?.arguments[1];
  const clearTimeoutArgument = clearTimeoutCall?.arguments[0];
  if (
    setTimeoutCall === undefined ||
    setTimeoutCall.arguments.length !== 2 ||
    timeoutCallback === undefined ||
    !ts.isIdentifier(timeoutCallback) ||
    timeoutCallback.text !== "stop" ||
    timeoutDuration === undefined ||
    !ts.isIdentifier(timeoutDuration) ||
    timeoutDuration.text !== "timeoutMilliseconds" ||
    !nodeIsWithin(setTimeoutCall, commandFunction.body) ||
    clearTimeoutCall === undefined ||
    clearTimeoutCall.arguments.length !== 1 ||
    clearTimeoutArgument === undefined ||
    !ts.isIdentifier(clearTimeoutArgument) ||
    clearTimeoutArgument.text !== "timer" ||
    !nodeIsWithin(clearTimeoutCall, commandFunction.body)
  )
    return violation;

  const normalizedListenerCalls = [
    ...addEventListenerCalls,
    ...removeEventListenerCalls,
    ...emitterOnCalls,
    ...emitterOnceCalls,
  ].map((call) => call.getText(sourceFile).replace(/\s+/gu, " ").trim());
  if (
    promiseCatchCalls[1]?.arguments[0] !== mainCatch.callback ||
    promiseCatchCalls[0]?.getText(sourceFile).replace(/\s+/gu, " ").trim() !==
      "removeImage(imageId).catch(() => undefined)" ||
    JSON.stringify(normalizedListenerCalls) !==
      JSON.stringify([
        'signal?.addEventListener("abort", abort, { once: true })',
        'signal?.removeEventListener("abort", abort)',
        'child.stdout.on("data", (chunk: Buffer) => { stdoutBytes += chunk.byteLength; if (stdoutBytes > stdoutLimitBytes) stop(); else stdout.push(Buffer.from(chunk)); })',
        'child.stderr.on("data", (chunk: Buffer) => { stderrBytes += chunk.byteLength; if (stderrBytes > stderrLimitBytes) stop(); else stderr.push(Buffer.from(chunk)); })',
        'child.once("error", (error) => finish(error))',
        'child.once("close", (code, closeSignal) => { if ( failed || closeSignal !== null || code === null || !Number.isSafeInteger(code) || code < 0 || code > 255 ) { finish(new Error("acceptance failed")); return; } finish(undefined, { exitCode: code, stderr: Uint8Array.from(Buffer.concat(stderr)), stdout: Uint8Array.from(Buffer.concat(stdout)), }); })',
      ])
  )
    return violation;

  const promiseResolveCall = promiseStaticCalls[0];
  const cleanupPromiseRejectCall = promiseStaticCalls[1];
  const commandPromiseRejectCall = promiseStaticCalls[2];
  const promiseNewCall = promiseNewCalls[0];
  const commandRejectArgument = commandPromiseRejectCall?.arguments[0];
  const commandRejectMessage =
    commandRejectArgument !== undefined &&
    ts.isNewExpression(commandRejectArgument)
      ? commandRejectArgument.arguments?.[0]
      : undefined;
  const promiseRuntimeIdentifiers = [
    promiseResolveCall !== undefined &&
    ts.isPropertyAccessExpression(promiseResolveCall.expression)
      ? promiseResolveCall.expression.expression
      : undefined,
    cleanupPromiseRejectCall !== undefined &&
    ts.isPropertyAccessExpression(cleanupPromiseRejectCall.expression)
      ? cleanupPromiseRejectCall.expression.expression
      : undefined,
    commandPromiseRejectCall !== undefined &&
    ts.isPropertyAccessExpression(commandPromiseRejectCall.expression)
      ? commandPromiseRejectCall.expression.expression
      : undefined,
    promiseNewCall?.expression,
  ];
  const promiseExecutor = promiseNewCall?.arguments?.[0];
  if (
    promiseReferences.length !== 4 ||
    promiseResolveCall === undefined ||
    promiseResolveCall.arguments.length !== 1 ||
    cleanupPromiseRejectCall !== cleanupRejectCall ||
    commandPromiseRejectCall === undefined ||
    commandPromiseRejectCall.arguments.length !== 1 ||
    commandRejectArgument === undefined ||
    !ts.isNewExpression(commandRejectArgument) ||
    !ts.isIdentifier(commandRejectArgument.expression) ||
    commandRejectArgument.expression.text !== "Error" ||
    commandRejectMessage === undefined ||
    !ts.isStringLiteral(commandRejectMessage) ||
    commandRejectMessage.text !== "acceptance failed" ||
    !nodeIsWithin(commandPromiseRejectCall, commandFunction.body) ||
    promiseNewCall === undefined ||
    promiseNewCall.arguments?.length !== 1 ||
    promiseExecutor === undefined ||
    !ts.isArrowFunction(promiseExecutor) ||
    !nodeIsWithin(promiseNewCall, commandFunction.body) ||
    promiseRuntimeIdentifiers.some(
      (identifier, index) =>
        identifier === undefined ||
        !ts.isIdentifier(identifier) ||
        identifier.text !== "Promise" ||
        promiseReferences[index] !== identifier,
    )
  )
    return violation;
  return null;
}

function nodeIsWithin(node: ts.Node, ancestor: ts.Node): boolean {
  for (
    let current: ts.Node | undefined = node;
    current;
    current = current.parent
  )
    if (current === ancestor) return true;
  return false;
}

function filingParserNormalizationExecutionForbiddenGlobalViolation(
  path: string,
  content: string,
): string | null {
  const forbiddenGlobals = new Set([
    "Bun",
    "Deno",
    "EventSource",
    "Function",
    "SharedWorker",
    "WebSocket",
    "Worker",
    "XMLHttpRequest",
    "console",
    "crypto",
    "eval",
    "fetch",
    "global",
    "globalThis",
    "module",
    "navigator",
    "process",
    "require",
  ]);
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let forbidden: string | null = null;
  const visit = (node: ts.Node): void => {
    if (
      forbidden === null &&
      ts.isIdentifier(node) &&
      forbiddenGlobals.has(node.text)
    ) {
      forbidden = node.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return forbidden === null
    ? null
    : "Cycle 2j core and builder must not use network, process, logging, dynamic-code, ambient crypto, or worker globals";
}

function filingFactComparisonImportViolation(
  path: string,
  content: string,
): string | null {
  if (!path.startsWith(filingFactComparisonSourcePrefix)) return null;
  if (!filingFactComparisonSourcePaths.has(path))
    return "source set must remain the exact reviewed core, two validators, index, builder, and two tests";

  const moduleSpecifiers = collectModuleSpecifiers(content);
  if (path === filingFactComparisonIndexPath) {
    return isExactFilingFactComparisonIndex(content)
      ? null
      : "public index must retain the exact isolated production export surface";
  }
  if (path === filingFactComparisonProductionPath) {
    const expectedModules = [
      "node:crypto",
      "./declared-validator-a",
      "./declared-validator-b",
    ];
    if (JSON.stringify(moduleSpecifiers) !== JSON.stringify(expectedModules))
      return "comparison core may import only its exact hash and two declared-validator surfaces";
    const sourceFile = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const imports = sourceFile.statements.filter(ts.isImportDeclaration);
    if (
      imports.length !== 3 ||
      !isExactFilingPayloadCustodyImport(imports[0], "node:crypto", [
        ["createHash", "createHash"],
      ]) ||
      !isExactFilingPayloadCustodyImport(imports[1], "./declared-validator-a", [
        [
          "validateDeclaredValidatorAEnvelope",
          "validateDeclaredValidatorAEnvelope",
        ],
      ]) ||
      !isExactFilingPayloadCustodyImport(imports[2], "./declared-validator-b", [
        [
          "validateDeclaredValidatorBEnvelope",
          "validateDeclaredValidatorBEnvelope",
        ],
      ])
    )
      return "comparison core must retain its exact createHash and role-specific validator bindings";
    return filingFactComparisonGlobalViolation(path, content, "core");
  }
  if (
    path === filingFactComparisonValidatorAPath ||
    path === filingFactComparisonValidatorBPath
  ) {
    if (JSON.stringify(moduleSpecifiers) !== JSON.stringify(["node:crypto"]))
      return "declared validators may import only exact node:crypto createHash and no relative module";
    const cryptoViolation = exactCreateHashImportViolation(path, content);
    if (cryptoViolation !== null) return cryptoViolation;
    return filingFactComparisonGlobalViolation(path, content, "validator");
  }
  if (path === filingFactComparisonBuilderPath) {
    if (
      JSON.stringify(moduleSpecifiers) !==
      JSON.stringify(["node:crypto", "./filing-fact-comparison"])
    )
      return "comparison builder may import only exact node:crypto and the direct comparison core";
    const cryptoViolation = exactCreateHashImportViolation(path, content);
    if (cryptoViolation !== null) return cryptoViolation;
    return filingFactComparisonGlobalViolation(path, content, "builder");
  }

  const expectedTestModules = filingFactComparisonTestModules.get(path);
  if (
    expectedTestModules === undefined ||
    JSON.stringify(moduleSpecifiers) !== JSON.stringify(expectedTestModules)
  )
    return "comparison tests may import only their exact Vitest, hash, core, and builder surfaces";
  if (path === filingFactComparisonSecurityTestPath) {
    const cryptoViolation = exactCreateHashImportViolation(path, content);
    if (cryptoViolation !== null) return cryptoViolation;
  }
  return filingFactComparisonGlobalViolation(path, content, "test");
}

function exactCreateHashImportViolation(
  path: string,
  content: string,
): string | null {
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const cryptoImports = sourceFile.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "node:crypto",
  );
  return cryptoImports.length === 1 &&
    isExactFilingPayloadCustodyImport(cryptoImports[0], "node:crypto", [
      ["createHash", "createHash"],
    ])
    ? null
    : "comparison hash surface must retain its exact named node:crypto createHash binding";
}

function filingFactComparisonGlobalViolation(
  path: string,
  content: string,
  surface: "builder" | "core" | "test" | "validator",
): string | null {
  if (hasRuntimeDynamicImport(content))
    return `comparison ${surface} must not use runtime dynamic imports`;
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let forbiddenGlobal: string | null = null;
  const visit = (node: ts.Node): void => {
    if (
      forbiddenGlobal === null &&
      ts.isIdentifier(node) &&
      forbiddenFilingFactComparisonGlobals.has(node.text)
    ) {
      forbiddenGlobal = node.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return forbiddenGlobal === null
    ? null
    : `comparison ${surface} must not use network, filesystem, process, logging, timer, dynamic-code, global-crypto, or worker surfaces`;
}

function isExactFilingFactComparisonIndex(content: string): boolean {
  const sourceFile = ts.createSourceFile(
    filingFactComparisonIndexPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.statements.length !== 1) return false;
  const declaration = sourceFile.statements[0];
  if (
    declaration === undefined ||
    !ts.isExportDeclaration(declaration) ||
    declaration.isTypeOnly ||
    declaration.moduleSpecifier === undefined ||
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== "./filing-fact-comparison" ||
    declaration.exportClause === undefined ||
    !ts.isNamedExports(declaration.exportClause)
  )
    return false;
  const actual = declaration.exportClause.elements.map((specifier) => [
    specifier.propertyName?.text ?? specifier.name.text,
    specifier.name.text,
    specifier.isTypeOnly,
  ]);
  const expected = filingFactComparisonPublicExports.map(([name, typeOnly]) => [
    name,
    name,
    typeOnly,
  ]);
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function filingQualityMeasurementImportViolation(
  path: string,
  content: string,
): string | null {
  if (!path.startsWith(filingQualityMeasurementSourcePrefix)) return null;
  if (!filingQualityMeasurementSourcePaths.has(path))
    return "source set must remain the exact reviewed core, index, builder, and two tests";

  const moduleSpecifiers = collectModuleSpecifiers(content);
  if (path === filingQualityMeasurementIndexPath) {
    return isExactFilingQualityMeasurementIndex(content)
      ? null
      : "public index must retain the exact isolated production export surface";
  }
  if (path === filingQualityMeasurementProductionPath) {
    if (JSON.stringify(moduleSpecifiers) !== JSON.stringify(["node:crypto"]))
      return "quality core may import only its exact node:crypto hashing surface";
    const cryptoViolation = exactFilingQualityMeasurementCreateHashViolation(
      path,
      content,
    );
    if (cryptoViolation !== null) return cryptoViolation;
    const arithmeticViolation = filingQualityMeasurementArithmeticViolation(
      path,
      content,
    );
    if (arithmeticViolation !== null) return arithmeticViolation;
    return filingQualityMeasurementGlobalViolation(path, content, "core");
  }
  if (path === filingQualityMeasurementBuilderPath) {
    if (
      JSON.stringify(moduleSpecifiers) !==
      JSON.stringify(["node:crypto", "./filing-quality-measurement"])
    )
      return "quality builder may import only exact node:crypto and the direct quality core";
    const cryptoViolation = exactFilingQualityMeasurementCreateHashViolation(
      path,
      content,
    );
    if (cryptoViolation !== null) return cryptoViolation;
    return filingQualityMeasurementGlobalViolation(path, content, "builder");
  }

  const expectedTestModules = filingQualityMeasurementTestModules.get(path);
  if (
    expectedTestModules === undefined ||
    JSON.stringify(moduleSpecifiers) !== JSON.stringify(expectedTestModules)
  )
    return "quality tests may import only their exact Vitest, hash, core, and builder surfaces";
  if (path === filingQualityMeasurementSecurityTestPath) {
    const cryptoViolation = exactFilingQualityMeasurementCreateHashViolation(
      path,
      content,
    );
    if (cryptoViolation !== null) return cryptoViolation;
  }
  return filingQualityMeasurementGlobalViolation(path, content, "test");
}

function exactFilingQualityMeasurementCreateHashViolation(
  path: string,
  content: string,
): string | null {
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const cryptoImports = sourceFile.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "node:crypto",
  );
  return cryptoImports.length === 1 &&
    isExactFilingPayloadCustodyImport(cryptoImports[0], "node:crypto", [
      ["createHash", "createHash"],
    ])
    ? null
    : "quality hash surface must retain its exact named node:crypto createHash binding";
}

function filingQualityMeasurementArithmeticViolation(
  path: string,
  content: string,
): string | null {
  if (path !== filingQualityMeasurementProductionPath) return null;
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let violation: string | null = null;
  const visit = (node: ts.Node): void => {
    if (violation !== null) return;
    if (ts.isNumericLiteral(node) && !Number.isSafeInteger(Number(node.text))) {
      violation =
        "quality core must not contain fractional numeric literals or floating-point thresholds";
      return;
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.SlashToken
    ) {
      violation = "quality thresholds must not use floating-point division";
      return;
    }
    if (ts.isIdentifier(node) && ["parseFloat"].includes(node.text)) {
      violation = "quality thresholds must not parse floating-point ratios";
      return;
    }
    if (ts.isPropertyAccessExpression(node)) {
      const member = node.name.text;
      if (
        ["toExponential", "toFixed", "toPrecision"].includes(member) ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "Math" &&
          ["ceil", "floor", "round", "trunc"].includes(member)) ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "Number" &&
          member === "EPSILON")
      ) {
        violation =
          "quality thresholds must not round, format, truncate, or epsilon-adjust ratios";
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violation;
}

function filingQualityMeasurementGlobalViolation(
  path: string,
  content: string,
  surface: "builder" | "core" | "test",
): string | null {
  if (hasRuntimeDynamicImport(content))
    return `quality ${surface} must not use runtime dynamic imports`;
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let forbiddenGlobal: string | null = null;
  const visit = (node: ts.Node): void => {
    if (
      forbiddenGlobal === null &&
      ts.isIdentifier(node) &&
      forbiddenFilingQualityMeasurementGlobals.has(node.text) &&
      !(
        surface === "test" &&
        ["Buffer", "SharedArrayBuffer"].includes(node.text)
      )
    ) {
      forbiddenGlobal = node.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return forbiddenGlobal === null
    ? null
    : `quality ${surface} must not use network, filesystem, process, logging, timer, dynamic-code, global-crypto, or worker surfaces`;
}

function isExactFilingQualityMeasurementIndex(content: string): boolean {
  const sourceFile = ts.createSourceFile(
    filingQualityMeasurementIndexPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.statements.length !== 1) return false;
  const declaration = sourceFile.statements[0];
  if (
    declaration === undefined ||
    !ts.isExportDeclaration(declaration) ||
    declaration.isTypeOnly ||
    declaration.moduleSpecifier === undefined ||
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== "./filing-quality-measurement" ||
    declaration.exportClause === undefined ||
    !ts.isNamedExports(declaration.exportClause)
  )
    return false;
  const actual = declaration.exportClause.elements.map((specifier) => [
    specifier.propertyName?.text ?? specifier.name.text,
    specifier.name.text,
    specifier.isTypeOnly,
  ]);
  const expected = filingQualityMeasurementPublicExports.map(
    ([name, typeOnly]) => [name, name, typeOnly],
  );
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function filingQualityPrecommitmentImportViolation(
  path: string,
  content: string,
): string | null {
  if (!path.startsWith(filingQualityPrecommitmentSourcePrefix)) return null;
  if (!filingQualityPrecommitmentSourcePaths.has(path))
    return "source set must remain the exact reviewed core, index, builder, and two tests";

  const moduleSpecifiers = collectModuleSpecifiers(content);
  if (path === filingQualityPrecommitmentIndexPath) {
    return isExactFilingQualityPrecommitmentIndex(content)
      ? null
      : "public index must retain the exact isolated production export surface";
  }
  if (path === filingQualityPrecommitmentProductionPath) {
    if (
      JSON.stringify(moduleSpecifiers) !==
      JSON.stringify(["node:crypto", filingQualityMeasurementModule])
    )
      return "precommitment core may import only exact node:crypto hashing and the public Cycle2f measurement surface";
    const cryptoViolation = exactFilingQualityPrecommitmentCreateHashViolation(
      path,
      content,
    );
    if (cryptoViolation !== null) return cryptoViolation;
    const measurementViolation =
      exactFilingQualityPrecommitmentMeasurementImportViolation(path, content);
    if (measurementViolation !== null) return measurementViolation;
    return filingQualityPrecommitmentGlobalViolation(path, content, "core");
  }
  if (path === filingQualityPrecommitmentBuilderPath) {
    if (
      JSON.stringify(moduleSpecifiers) !==
      JSON.stringify([
        "node:crypto",
        filingQualityMeasurementModule,
        "./filing-quality-precommitment",
      ])
    )
      return "precommitment builder may import only exact node:crypto, public Cycle2f fixture constants, and the direct precommitment core";
    const cryptoViolation = exactFilingQualityPrecommitmentCreateHashViolation(
      path,
      content,
    );
    if (cryptoViolation !== null) return cryptoViolation;
    return filingQualityPrecommitmentGlobalViolation(path, content, "builder");
  }

  const expectedTestModules = filingQualityPrecommitmentTestModules.get(path);
  if (
    expectedTestModules === undefined ||
    JSON.stringify(moduleSpecifiers) !== JSON.stringify(expectedTestModules)
  )
    return "precommitment tests may import only their exact Vitest, hash, core, and builder surfaces";
  if (
    path === filingQualityPrecommitmentUnitTestPath ||
    path === filingQualityPrecommitmentSecurityTestPath
  ) {
    const cryptoViolation = exactFilingQualityPrecommitmentCreateHashViolation(
      path,
      content,
    );
    if (cryptoViolation !== null) return cryptoViolation;
  }
  return filingQualityPrecommitmentGlobalViolation(path, content, "test");
}

function exactFilingQualityPrecommitmentCreateHashViolation(
  path: string,
  content: string,
): string | null {
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const cryptoImports = sourceFile.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "node:crypto",
  );
  return cryptoImports.length === 1 &&
    isExactFilingPayloadCustodyImport(cryptoImports[0], "node:crypto", [
      ["createHash", "createHash"],
    ])
    ? null
    : "precommitment hash surface must retain its exact named node:crypto createHash binding";
}

function exactFilingQualityPrecommitmentMeasurementImportViolation(
  path: string,
  content: string,
): string | null {
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports = sourceFile.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === filingQualityMeasurementModule,
  );
  const declaration = imports[0];
  const clause = declaration?.importClause;
  if (
    imports.length !== 1 ||
    clause === undefined ||
    clause.isTypeOnly ||
    clause.name !== undefined ||
    clause.namedBindings === undefined ||
    !ts.isNamedImports(clause.namedBindings)
  )
    return "precommitment core must retain the exact named public Cycle2f bindings";
  const actual = clause.namedBindings.elements.map((specifier) => [
    specifier.propertyName?.text ?? specifier.name.text,
    specifier.name.text,
    specifier.isTypeOnly,
  ]);
  const expected = [
    [
      "FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS",
      "FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS",
      false,
    ],
    [
      "FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES",
      "FILING_QUALITY_MEASUREMENT_CANDIDATE_QUARANTINE_CODES",
      false,
    ],
    [
      "FILING_QUALITY_MEASUREMENT_CLAIM",
      "FILING_QUALITY_MEASUREMENT_CLAIM",
      false,
    ],
    [
      "FILING_QUALITY_MEASUREMENT_DECLARATIONS",
      "FILING_QUALITY_MEASUREMENT_DECLARATIONS",
      false,
    ],
    [
      "FILING_QUALITY_MEASUREMENT_FACT_KEYS",
      "FILING_QUALITY_MEASUREMENT_FACT_KEYS",
      false,
    ],
    [
      "FILING_QUALITY_MEASUREMENT_LIMITS",
      "FILING_QUALITY_MEASUREMENT_LIMITS",
      false,
    ],
    [
      "FILING_QUALITY_MEASUREMENT_METRICS",
      "FILING_QUALITY_MEASUREMENT_METRICS",
      false,
    ],
    [
      "FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION",
      "FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION",
      false,
    ],
    [
      "FILING_QUALITY_MEASUREMENT_THRESHOLDS",
      "FILING_QUALITY_MEASUREMENT_THRESHOLDS",
      false,
    ],
    ["measureSyntheticFilingQuality", "measureSyntheticFilingQuality", false],
    [
      "FilingQualityMeasurementDeclaration",
      "FilingQualityMeasurementDeclaration",
      true,
    ],
    [
      "FilingQualityMeasurementEvaluatedResult",
      "FilingQualityMeasurementEvaluatedResult",
      true,
    ],
  ];
  return JSON.stringify(actual) === JSON.stringify(expected)
    ? null
    : "precommitment core must retain the exact named public Cycle2f bindings";
}

function filingQualityPrecommitmentGlobalViolation(
  path: string,
  content: string,
  surface: "builder" | "core" | "test",
): string | null {
  if (hasRuntimeDynamicImport(content))
    return `precommitment ${surface} must not use runtime dynamic imports`;
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let forbiddenGlobal: string | null = null;
  const visit = (node: ts.Node): void => {
    if (
      forbiddenGlobal === null &&
      ts.isIdentifier(node) &&
      forbiddenFilingQualityPrecommitmentGlobals.has(node.text) &&
      !(
        surface === "test" &&
        ["Buffer", "SharedArrayBuffer"].includes(node.text)
      )
    ) {
      forbiddenGlobal = node.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return forbiddenGlobal === null
    ? null
    : `precommitment ${surface} must not use network, filesystem, process, logging, timer, entropy, dynamic-code, global-crypto, or worker surfaces`;
}

function isExactFilingQualityPrecommitmentIndex(content: string): boolean {
  const sourceFile = ts.createSourceFile(
    filingQualityPrecommitmentIndexPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.statements.length !== 1) return false;
  const declaration = sourceFile.statements[0];
  if (
    declaration === undefined ||
    !ts.isExportDeclaration(declaration) ||
    declaration.isTypeOnly ||
    declaration.moduleSpecifier === undefined ||
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== "./filing-quality-precommitment" ||
    declaration.exportClause === undefined ||
    !ts.isNamedExports(declaration.exportClause)
  )
    return false;
  const actual = declaration.exportClause.elements.map((specifier) => [
    specifier.propertyName?.text ?? specifier.name.text,
    specifier.name.text,
    specifier.isTypeOnly,
  ]);
  const expected = filingQualityPrecommitmentPublicExports.map(
    ([name, typeOnly]) => [name, name, typeOnly],
  );
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function filingFactNormalizationGlobalViolation(
  path: string,
  content: string,
  surface: "builder" | "core" | "test",
): string | null {
  if (hasRuntimeDynamicImport(content))
    return `normalization ${surface} must not use runtime dynamic imports`;
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let forbiddenGlobal: string | null = null;
  const visit = (node: ts.Node): void => {
    if (
      forbiddenGlobal === null &&
      ts.isIdentifier(node) &&
      forbiddenFilingFactNormalizationGlobals.has(node.text)
    ) {
      forbiddenGlobal = node.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return forbiddenGlobal === null
    ? null
    : `normalization ${surface} must not use network, process, logging, dynamic-code, global-crypto, or worker surfaces`;
}

function isExactFilingFactNormalizationIndex(content: string): boolean {
  const sourceFile = ts.createSourceFile(
    filingFactNormalizationIndexPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.statements.length !== 1) return false;
  const declaration = sourceFile.statements[0];
  if (
    declaration === undefined ||
    !ts.isExportDeclaration(declaration) ||
    declaration.isTypeOnly ||
    declaration.moduleSpecifier === undefined ||
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== "./filing-fact-normalization" ||
    declaration.exportClause === undefined ||
    !ts.isNamedExports(declaration.exportClause)
  )
    return false;
  const actual = declaration.exportClause.elements.map((specifier) => [
    specifier.propertyName?.text ?? specifier.name.text,
    specifier.name.text,
    specifier.isTypeOnly,
  ]);
  const expected = filingFactNormalizationPublicExports.map(
    ([name, typeOnly]) => [name, name, typeOnly],
  );
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function isExactFilingParserNormalizationHandoffIndex(
  content: string,
): boolean {
  const sourceFile = ts.createSourceFile(
    filingParserNormalizationHandoffIndexPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.statements.length !== 1) return false;
  const declaration = sourceFile.statements[0];
  if (
    declaration === undefined ||
    !ts.isExportDeclaration(declaration) ||
    declaration.isTypeOnly ||
    declaration.moduleSpecifier === undefined ||
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !==
      "./filing-parser-normalization-handoff" ||
    declaration.exportClause === undefined ||
    !ts.isNamedExports(declaration.exportClause)
  )
    return false;
  const actual = declaration.exportClause.elements.map((specifier) => [
    specifier.propertyName?.text ?? specifier.name.text,
    specifier.name.text,
    specifier.isTypeOnly,
  ]);
  const expected = filingParserNormalizationHandoffPublicExports.map(
    ([name, typeOnly]) => [name, name, typeOnly],
  );
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function isExactFilingParserNormalizationExecutionIndex(
  content: string,
): boolean {
  const sourceFile = ts.createSourceFile(
    filingParserNormalizationExecutionIndexPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.statements.length !== 1) return false;
  return isExactNamedReExportDeclaration(
    sourceFile.statements[0],
    "./filing-parser-normalization-execution",
    filingParserNormalizationExecutionPublicExports,
  );
}

function isExactFilingParserNormalizationExecutionAcceptanceIndex(
  content: string,
): boolean {
  const sourceFile = ts.createSourceFile(
    filingParserNormalizationExecutionAcceptanceIndexPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  return (
    sourceFile.statements.length === 2 &&
    isExactNamedReExportDeclaration(
      sourceFile.statements[0],
      "./filing-parser-normalization-execution-evidence",
      filingParserNormalizationExecutionEvidencePublicExports,
    ) &&
    isExactNamedReExportDeclaration(
      sourceFile.statements[1],
      "./filing-parser-normalization-execution-evidence-verifier",
      filingParserNormalizationExecutionEvidenceVerifierPublicExports,
    )
  );
}

function isExactNamedReExportDeclaration(
  declaration: ts.Statement | undefined,
  moduleName: string,
  expectedExports: ReadonlyArray<readonly [string, boolean]>,
): boolean {
  if (
    declaration === undefined ||
    !ts.isExportDeclaration(declaration) ||
    declaration.isTypeOnly ||
    declaration.moduleSpecifier === undefined ||
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== moduleName ||
    declaration.exportClause === undefined ||
    !ts.isNamedExports(declaration.exportClause)
  )
    return false;
  const actual = declaration.exportClause.elements.map((specifier) => [
    specifier.propertyName?.text ?? specifier.name.text,
    specifier.name.text,
    specifier.isTypeOnly,
  ]);
  const expected = expectedExports.map(([name, typeOnly]) => [
    name,
    name,
    typeOnly,
  ]);
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function hasExactFilingParserNormalizationExecutionProductionImports(
  content: string,
): boolean {
  const sourceFile = ts.createSourceFile(
    filingParserNormalizationExecutionProductionPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  return (
    imports.length === 7 &&
    isExactFilingParserNormalizationHandoffImport(imports[0], "node:crypto", [
      ["createHash", "createHash", false],
      ["createPublicKey", "createPublicKey", false],
      ["randomUUID", "randomUUID", false],
    ]) &&
    isExactFilingParserNormalizationHandoffImport(
      imports[1],
      "node:child_process",
      [["spawn", "spawn", false]],
    ) &&
    isExactFilingParserNormalizationHandoffImport(
      imports[2],
      "node:fs/promises",
      [
        ["mkdtemp", "mkdtemp", false],
        ["rm", "rm", false],
        ["writeFile", "writeFile", false],
      ],
    ) &&
    isExactFilingParserNormalizationHandoffImport(imports[3], "node:os", [
      ["tmpdir", "tmpdir", false],
    ]) &&
    isExactFilingParserNormalizationHandoffImport(imports[4], "node:path", [
      ["join", "join", false],
    ]) &&
    isExactFilingParserNormalizationHandoffImport(imports[5], "node:util", [
      ["types", "utilTypes", false],
    ]) &&
    isExactFilingParserNormalizationHandoffImport(
      imports[6],
      filingParserNormalizationHandoffModule,
      [
        [
          "handoffAuthenticatedSyntheticFilingParserResults",
          "handoffAuthenticatedSyntheticFilingParserResults",
          false,
        ],
        [
          "FilingParserNormalizationHandoffProvenance",
          "FilingParserNormalizationHandoffProvenance",
          true,
        ],
        [
          "FilingParserNormalizationHandoffSuccess",
          "FilingParserNormalizationHandoffSuccess",
          true,
        ],
      ],
    )
  );
}

function hasExactFilingParserNormalizationHandoffProductionImports(
  content: string,
): boolean {
  const sourceFile = ts.createSourceFile(
    filingParserNormalizationHandoffProductionPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  return (
    imports.length === 3 &&
    isExactFilingParserNormalizationHandoffImport(imports[0], "node:crypto", [
      ["createHash", "createHash", false],
      ["createPublicKey", "createPublicKey", false],
      ["verify", "verifySignature", false],
    ]) &&
    isExactFilingParserNormalizationHandoffImport(imports[1], "node:util", [
      ["types", "utilTypes", false],
    ]) &&
    isExactFilingParserNormalizationHandoffImport(
      imports[2],
      filingFactNormalizationModule,
      [
        [
          "FILING_FACT_NORMALIZATION_LIMITS",
          "FILING_FACT_NORMALIZATION_LIMITS",
          false,
        ],
        [
          "normalizeSyntheticFilingFactPair",
          "normalizeSyntheticFilingFactPair",
          false,
        ],
        [
          "FilingFactNormalizationRecord",
          "FilingFactNormalizationRecord",
          true,
        ],
      ],
    )
  );
}

function isExactFilingParserNormalizationHandoffImport(
  declaration: ts.ImportDeclaration | undefined,
  moduleName: string,
  expected: ReadonlyArray<readonly [string, string, boolean]>,
): boolean {
  if (
    declaration === undefined ||
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== moduleName
  )
    return false;
  const clause = declaration.importClause;
  if (
    clause === undefined ||
    clause.isTypeOnly ||
    clause.name !== undefined ||
    clause.namedBindings === undefined ||
    !ts.isNamedImports(clause.namedBindings)
  )
    return false;
  const actual = clause.namedBindings.elements.map((specifier) => [
    specifier.propertyName?.text ?? specifier.name.text,
    specifier.name.text,
    specifier.isTypeOnly,
  ]);
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function filingPayloadCustodyFixtureGuardViolation(
  content: string,
): string | null {
  if (
    JSON.stringify(collectModuleSpecifiers(content)) !==
    JSON.stringify(filingPayloadCustodyFixtureGuardModules)
  )
    return "custody fixture guard must retain its exact local verification imports";
  if (hasRuntimeDynamicImport(content))
    return "custody fixture guard must not use runtime dynamic imports";
  return filingPayloadCustodyToolGlobalViolation(
    filingPayloadCustodyFixtureGuardPath,
    content,
  );
}

function filingPayloadCustodyImportViolation(
  path: string,
  content: string,
): string | null {
  if (!path.startsWith(filingPayloadCustodySourcePrefix)) return null;
  if (path === filingParserArchivePairCustodyUnitTestPath) {
    if (
      JSON.stringify(collectModuleSpecifiers(content)) !==
      JSON.stringify(filingParserArchivePairCustodyTestModules)
    )
      return "exact-pair custody tests must retain their exact reviewed filesystem, local, and Vitest imports";
    return filingPayloadCustodyTestViolation(path, content);
  }
  if (path.endsWith(".test.ts"))
    return filingPayloadCustodyTestViolation(path, content);
  if (filingPayloadCustodyToolPaths.has(path)) {
    const toolSpecifiers = collectModuleSpecifiers(content);
    const expectedSpecifiers = filingPayloadCustodyToolModules.get(path);
    if (
      expectedSpecifiers === undefined ||
      JSON.stringify(toolSpecifiers) !== JSON.stringify(expectedSpecifiers)
    )
      return "custody evidence tools may import only their exact Node and same-package surfaces";
    if (hasRuntimeDynamicImport(content))
      return "custody evidence tools must not use runtime dynamic imports";
    const globalViolation = filingPayloadCustodyToolGlobalViolation(
      path,
      content,
    );
    if (globalViolation !== null) return globalViolation;
    return filingPayloadCustodyChildProcessViolation(path, content);
  }
  if (path === filingParserArchivePairCustodyProductionPath)
    return filingParserArchivePairCustodyProductionViolation(path, content);
  if (path === filingParserArchivePairFixturePath)
    return filingParserArchivePairFixtureViolation(path, content);
  if (
    path !== filingPayloadCustodyProductionPath &&
    path !== filingPayloadCustodyIndexPath
  )
    return "production source set must remain the exact reviewed boundary and index";

  const moduleSpecifiers = collectModuleSpecifiers(content);
  if (path === filingPayloadCustodyIndexPath) {
    return isExactFilingPayloadCustodyIndex(content)
      ? null
      : "public index must retain the exact isolated production export surface";
  }
  if (
    JSON.stringify(moduleSpecifiers) !==
    JSON.stringify(["node:crypto", "node:fs", "node:fs/promises", "node:path"])
  )
    return "payload custody may import only its exact reviewed Node crypto, filesystem, and path surfaces";

  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  if (
    imports.length !== 4 ||
    !isExactFilingPayloadCustodyImport(imports[0], "node:crypto", [
      ["createCipheriv", "createCipheriv"],
      ["createDecipheriv", "createDecipheriv"],
      ["createHash", "createHash"],
    ]) ||
    !isExactFilingPayloadCustodyImport(
      imports[1],
      "node:fs",
      [["Stats", "Stats"]],
      true,
    ) ||
    !isExactFilingPayloadCustodyImport(imports[2], "node:fs/promises", [
      ["chmod", "chmod"],
      ["lstat", "lstat"],
      ["mkdir", "mkdir"],
      ["mkdtemp", "mkdtemp"],
      ["open", "open"],
      ["readdir", "readdir"],
      ["realpath", "realpath"],
      ["rename", "rename"],
      ["rm", "rm"],
      ["unlink", "unlink"],
    ]) ||
    !isExactFilingPayloadCustodyImport(imports[3], "node:path", [
      ["basename", "basename"],
      ["isAbsolute", "isAbsolute"],
      ["join", "join"],
      ["parse", "parse"],
      ["relative", "relative"],
      ["resolve", "resolve"],
      ["sep", "sep"],
    ])
  )
    return "payload custody must retain the exact encryption, bounded filesystem, and path import bindings";

  let forbiddenGlobal: string | null = null;
  let runtimeDynamicImportFound = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      runtimeDynamicImportFound = true;
      return;
    }
    if (
      forbiddenGlobal === null &&
      ts.isIdentifier(node) &&
      forbiddenFilingPayloadCustodyGlobals.has(node.text)
    ) {
      forbiddenGlobal = node.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (runtimeDynamicImportFound)
    return "payload custody must not use runtime dynamic imports";
  if (forbiddenGlobal !== null)
    return "payload custody must not use network, process, logging, dynamic-code, global-crypto, or worker surfaces";
  return null;
}

function filingParserArchivePairCustodyProductionViolation(
  path: string,
  content: string,
): string | null {
  if (
    JSON.stringify(collectModuleSpecifiers(content)) !==
    JSON.stringify(filingParserArchivePairCustodyModules)
  )
    return "exact-pair custody may import only its exact reviewed crypto, filesystem, temp-directory, path, and util surfaces";
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  if (
    imports.length !== 6 ||
    !isExactFilingPayloadCustodyImport(imports[0], "node:crypto", [
      ["createCipheriv", "createCipheriv"],
      ["createDecipheriv", "createDecipheriv"],
      ["createHash", "createHash"],
      ["randomBytes", "randomBytes"],
    ]) ||
    !isExactFilingPayloadCustodyImport(
      imports[1],
      "node:fs",
      [["BigIntStats", "BigIntStats"]],
      true,
    ) ||
    !isExactFilingPayloadCustodyImport(imports[2], "node:fs/promises", [
      ["chmod", "chmod"],
      ["lstat", "lstat"],
      ["mkdir", "mkdir"],
      ["mkdtemp", "mkdtemp"],
      ["open", "open"],
      ["readFile", "readFile"],
      ["readdir", "readdir"],
      ["realpath", "realpath"],
      ["rename", "rename"],
      ["rm", "rm"],
    ]) ||
    !isExactFilingPayloadCustodyImport(imports[3], "node:os", [
      ["tmpdir", "tmpdir"],
    ]) ||
    !isExactFilingPayloadCustodyImport(imports[4], "node:path", [
      ["isAbsolute", "isAbsolute"],
      ["join", "join"],
      ["parse", "parse"],
      ["relative", "relative"],
      ["resolve", "resolve"],
      ["sep", "sep"],
    ]) ||
    !isExactFilingPayloadCustodyImport(imports[5], "node:util", [
      ["types", "utilTypes"],
    ])
  )
    return "exact-pair custody must retain the exact encryption, owned-workspace, path, and native-type import bindings";
  return filingPayloadCustodyClosedSourceViolation(path, content);
}

function filingParserArchivePairFixtureViolation(
  path: string,
  content: string,
): string | null {
  if (
    JSON.stringify(collectModuleSpecifiers(content)) !==
    JSON.stringify(filingParserArchivePairFixtureModules)
  )
    return "exact-pair fixture may import only createHash and the local custody contract";
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  if (
    imports.length !== 2 ||
    !isExactFilingPayloadCustodyImport(imports[0], "node:crypto", [
      ["createHash", "createHash"],
    ]) ||
    !isExactFilingPayloadCustodyImport(
      imports[1],
      "./parser-archive-pair-custody",
      [
        [
          "FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES",
          "FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES",
        ],
      ],
    )
  )
    return "exact-pair fixture must retain the exact digest and custody-profile import bindings";
  return filingPayloadCustodyClosedSourceViolation(path, content);
}

function filingPayloadCustodyClosedSourceViolation(
  path: string,
  content: string,
): string | null {
  if (
    hasRuntimeDynamicImport(content) ||
    hasForbiddenDynamicCodeCapability(content) ||
    hasUnresolvedRuntimeModuleLoad(content) ||
    hasIndirectRuntimeModuleLoad(content)
  )
    return "exact-pair custody sources must not use runtime module loading or dynamic code";
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let forbiddenGlobal: string | null = null;
  const visit = (node: ts.Node): void => {
    if (
      forbiddenGlobal === null &&
      ts.isIdentifier(node) &&
      forbiddenFilingPayloadCustodyGlobals.has(node.text)
    ) {
      forbiddenGlobal = node.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return forbiddenGlobal === null
    ? null
    : "exact-pair custody sources must not use network, process, logging, global-crypto, or worker globals";
}

function isExactFilingPayloadCustodyIndex(content: string): boolean {
  const sourceFile = ts.createSourceFile(
    filingPayloadCustodyIndexPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const [cycle2cDeclaration, custodyDeclaration, fixtureDeclaration] =
    sourceFile.statements;
  return (
    sourceFile.statements.length === 3 &&
    cycle2cDeclaration !== undefined &&
    custodyDeclaration !== undefined &&
    fixtureDeclaration !== undefined &&
    isExactNamedReExportDeclaration(
      cycle2cDeclaration,
      "./payload-custody",
      filingPayloadCustodyPublicExports,
    ) &&
    isExactNamedReExportDeclaration(
      custodyDeclaration,
      "./parser-archive-pair-custody",
      filingParserArchivePairCustodyPublicExports,
    ) &&
    isExactNamedReExportDeclaration(
      fixtureDeclaration,
      "./parser-archive-pair-fixture",
      filingParserArchivePairFixturePublicExports,
    )
  );
}

function isExactFilingPayloadCustodyImport(
  declaration: ts.ImportDeclaration | undefined,
  moduleName: string,
  expected: ReadonlyArray<readonly [string, string]>,
  typeOnly = false,
): boolean {
  if (
    declaration === undefined ||
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== moduleName
  )
    return false;
  const clause = declaration.importClause;
  if (
    clause === undefined ||
    clause.isTypeOnly !== typeOnly ||
    clause.name !== undefined ||
    clause.namedBindings === undefined ||
    !ts.isNamedImports(clause.namedBindings)
  )
    return false;
  const actual = clause.namedBindings.elements.map((specifier) => [
    specifier.propertyName?.text ?? specifier.name.text,
    specifier.name.text,
  ]);
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function hasRuntimeDynamicImport(content: string): boolean {
  const sourceFile = ts.createSourceFile(
    "payload-custody-tool.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function filingPayloadCustodyTestViolation(
  path: string,
  content: string,
): string | null {
  const moduleSpecifiers = collectModuleSpecifiers(content);
  if (
    moduleSpecifiers.some(
      (specifier) => !filingPayloadCustodyTestModules.has(specifier),
    )
  )
    return "custody tests may import only exact local test, crypto, and filesystem surfaces";
  if (hasRuntimeDynamicImport(content))
    return "custody tests must not use runtime dynamic imports";

  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let forbiddenGlobal: string | null = null;
  let invalidProcessUse = false;
  const visit = (node: ts.Node): void => {
    if (
      forbiddenGlobal === null &&
      ts.isIdentifier(node) &&
      forbiddenFilingPayloadCustodyTestGlobals.has(node.text)
    ) {
      forbiddenGlobal = node.text;
      return;
    }
    if (ts.isIdentifier(node) && node.text === "process") {
      const parent = node.parent;
      if (
        !ts.isPropertyAccessExpression(parent) ||
        parent.expression !== node ||
        !["env", "platform"].includes(parent.name.text)
      ) {
        invalidProcessUse = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (forbiddenGlobal !== null || invalidProcessUse)
    return "custody tests must not use network, child-process, dynamic-code, or non-platform process surfaces";
  return null;
}

function filingPayloadCustodyToolGlobalViolation(
  path: string,
  content: string,
): string | null {
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const allowedProcessProperties = new Set([
    "arch",
    "argv",
    "cwd",
    "env",
    "exitCode",
    "platform",
    "stderr",
    "stdout",
    "version",
  ]);
  let forbiddenGlobal: string | null = null;
  let invalidProcessUse = false;
  const visit = (node: ts.Node): void => {
    if (
      forbiddenGlobal === null &&
      ts.isIdentifier(node) &&
      forbiddenFilingPayloadCustodyTestGlobals.has(node.text)
    ) {
      forbiddenGlobal = node.text;
      return;
    }
    if (ts.isIdentifier(node) && node.text === "process") {
      const parent = node.parent;
      if (
        !ts.isPropertyAccessExpression(parent) ||
        parent.expression !== node ||
        !allowedProcessProperties.has(parent.name.text)
      ) {
        invalidProcessUse = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (forbiddenGlobal !== null || invalidProcessUse)
    return "custody evidence tools must not use network, dynamic-code, global-crypto, or unreviewed process surfaces";
  return null;
}

function filingPayloadCustodyChildProcessViolation(
  path: string,
  content: string,
): string | null {
  const verifierPath = `${filingPayloadCustodySourcePrefix}filing-payload-custody-evidence-verifier.ts`;
  const acceptancePath = `${filingPayloadCustodySourcePrefix}run-filing-payload-custody-acceptance.ts`;
  if (path !== verifierPath && path !== acceptancePath) return null;

  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const childProcessImports = sourceFile.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "node:child_process",
  );
  if (
    childProcessImports.length !== 1 ||
    !isExactFilingPayloadCustodyImport(
      childProcessImports[0],
      "node:child_process",
      [["spawn", "spawn"]],
    )
  )
    return "custody process tools must retain the exact spawn-only child-process binding";

  const spawnCalls: ts.CallExpression[] = [];
  const spawnReferences: ts.Identifier[] = [];
  const commandOutputCalls: ts.CallExpression[] = [];
  const commandOutputReferences: ts.Identifier[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === "spawn") {
      if (!isImportBindingIdentifier(node)) spawnReferences.push(node);
    }
    if (ts.isIdentifier(node) && node.text === "commandOutput") {
      if (!isFunctionDeclarationName(node)) commandOutputReferences.push(node);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "spawn") spawnCalls.push(node);
      if (node.expression.text === "commandOutput")
        commandOutputCalls.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (
    spawnCalls.length !== 1 ||
    spawnReferences.length !== spawnCalls.length ||
    !isClosedCustodySpawnCall(
      spawnCalls[0],
      path === verifierPath ? "git" : "command",
    )
  )
    return "custody process tools must retain one exact no-shell bounded spawn call";

  if (path === verifierPath) {
    if (commandOutputCalls.length !== 0 || commandOutputReferences.length !== 0)
      return "custody verifier may spawn only its fixed git command";
    return null;
  }

  const commands = commandOutputCalls.map((call) =>
    staticStringValue(call.arguments[0]),
  );
  const hardenedRepositoryGitCalls = commandOutputCalls.filter(
    (call) =>
      staticStringValue(call.arguments[0]) === "git" &&
      isGitArgumentsWithoutReplacementObjectsCall(call.arguments[1]),
  );
  const commandOutputDeclarations = sourceFile.statements.filter(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "commandOutput",
  );
  const commandOutputDeclaration = commandOutputDeclarations[0];
  const commandParameter = commandOutputDeclaration?.parameters[0]?.name;
  const argsParameter = commandOutputDeclaration?.parameters[1]?.name;
  const spawnCommand = spawnCalls[0]?.arguments[0];
  const spawnArgs = spawnCalls[0]?.arguments[1];
  const unexpectedCommandBridgeIdentifier =
    commandOutputDeclaration === undefined
      ? true
      : findIdentifiers(
          commandOutputDeclaration,
          new Set(["command", "args"]),
        ).some(
          (identifier) =>
            identifier !== commandParameter &&
            identifier !== argsParameter &&
            identifier !== spawnCommand &&
            identifier !== spawnArgs,
        );
  if (
    JSON.stringify(commands) !== JSON.stringify(["pnpm", "git"]) ||
    hardenedRepositoryGitCalls.length !== 1 ||
    commandOutputReferences.length !== commandOutputCalls.length ||
    commandOutputDeclarations.length !== 1 ||
    commandParameter === undefined ||
    !ts.isIdentifier(commandParameter) ||
    commandParameter.text !== "command" ||
    argsParameter === undefined ||
    !ts.isIdentifier(argsParameter) ||
    argsParameter.text !== "args" ||
    unexpectedCommandBridgeIdentifier
  )
    return "custody acceptance may invoke only its exact git and pnpm command sites";
  return null;
}

function findIdentifiers(
  node: ts.Node,
  names: ReadonlySet<string>,
): ts.Identifier[] {
  const identifiers: ts.Identifier[] = [];
  const visit = (candidate: ts.Node): void => {
    if (ts.isIdentifier(candidate) && names.has(candidate.text))
      identifiers.push(candidate);
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return identifiers;
}

function isImportBindingIdentifier(node: ts.Identifier): boolean {
  return ts.isImportSpecifier(node.parent) && node.parent.name === node;
}

function isFunctionDeclarationName(node: ts.Identifier): boolean {
  return ts.isFunctionDeclaration(node.parent) && node.parent.name === node;
}

function isClosedCustodySpawnCall(
  call: ts.CallExpression | undefined,
  expectedCommand: "command" | "git",
): boolean {
  if (call === undefined || call.arguments.length !== 3) return false;
  const [command, args, options] = call.arguments;
  if (
    command === undefined ||
    (expectedCommand === "git"
      ? staticStringValue(command) !== "git"
      : !ts.isIdentifier(command) || command.text !== "command") ||
    args === undefined ||
    (expectedCommand === "git"
      ? !isGitArgumentsWithoutReplacementObjectsCall(args)
      : !ts.isIdentifier(args) || args.text !== "args") ||
    options === undefined ||
    !ts.isObjectLiteralExpression(options) ||
    options.properties.length !== 4
  )
    return false;
  const [cwd, environment, shell, stdio] = options.properties;
  return (
    cwd !== undefined &&
    ts.isShorthandPropertyAssignment(cwd) &&
    cwd.name.text === "cwd" &&
    environment !== undefined &&
    ts.isPropertyAssignment(environment) &&
    propertyNameText(environment.name) === "env" &&
    ts.isIdentifier(environment.initializer) &&
    environment.initializer.text === "environment" &&
    shell !== undefined &&
    ts.isPropertyAssignment(shell) &&
    propertyNameText(shell.name) === "shell" &&
    shell.initializer.kind === ts.SyntaxKind.FalseKeyword &&
    stdio !== undefined &&
    ts.isPropertyAssignment(stdio) &&
    propertyNameText(stdio.name) === "stdio" &&
    ts.isArrayLiteralExpression(stdio.initializer) &&
    JSON.stringify(stdio.initializer.elements.map(staticStringValue)) ===
      JSON.stringify(["ignore", "pipe", "pipe"])
  );
}

function isGitArgumentsWithoutReplacementObjectsCall(
  node: ts.Expression | undefined,
): boolean {
  if (
    node === undefined ||
    !ts.isCallExpression(node) ||
    !ts.isIdentifier(node.expression) ||
    node.expression.text !== "gitArgumentsWithoutReplacementObjects" ||
    node.arguments.length !== 1
  )
    return false;
  const argument = node.arguments[0];
  return (
    argument !== undefined &&
    ts.isIdentifier(argument) &&
    argument.text === "args"
  );
}

function propertyNameText(name: ts.PropertyName): string | null {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name)
    ? name.text
    : null;
}

function corpusAdmissionImportViolation(
  path: string,
  content: string,
): string | null {
  if (path !== corpusAdmissionProductionPath) return null;
  const moduleSpecifiers = collectModuleSpecifiers(content);
  if (moduleSpecifiers.length !== 1 || moduleSpecifiers[0] !== "node:crypto")
    return "metadata-only corpus admission may have only its exact node:crypto verifier import";
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  if (imports.length !== 1 || !isExactCorpusAdmissionCryptoImport(imports[0]))
    return "metadata-only corpus admission must retain exact verifier-only node:crypto bindings";
  let forbiddenGlobal: string | null = null;
  let hasRuntimeDynamicImport = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      hasRuntimeDynamicImport = true;
      return;
    }
    if (
      forbiddenGlobal === null &&
      ts.isIdentifier(node) &&
      forbiddenCorpusAdmissionGlobals.has(node.text)
    ) {
      forbiddenGlobal = node.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (hasRuntimeDynamicImport)
    return "metadata-only corpus admission must not use runtime dynamic imports";
  if (forbiddenGlobal !== null)
    return "metadata-only corpus admission must not use file, network, process, logging, dynamic-code, or signing globals";
  return null;
}

function isExactCorpusAdmissionCryptoImport(
  declaration: ts.ImportDeclaration | undefined,
): boolean {
  if (
    declaration === undefined ||
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== "node:crypto"
  )
    return false;
  const clause = declaration.importClause;
  if (
    clause === undefined ||
    clause.isTypeOnly ||
    clause.name !== undefined ||
    clause.namedBindings === undefined ||
    !ts.isNamedImports(clause.namedBindings)
  )
    return false;
  const actual = clause.namedBindings.elements.map((specifier) => ({
    imported: specifier.propertyName?.text ?? specifier.name.text,
    isTypeOnly: specifier.isTypeOnly,
    local: specifier.name.text,
  }));
  return (
    JSON.stringify(actual) ===
    JSON.stringify([
      { imported: "createHash", isTypeOnly: false, local: "createHash" },
      {
        imported: "createPublicKey",
        isTypeOnly: false,
        local: "createPublicKey",
      },
      { imported: "verify", isTypeOnly: false, local: "verifySignature" },
      { imported: "KeyObject", isTypeOnly: true, local: "KeyObject" },
    ])
  );
}

function inspectFilingParserWorker(path: string, content: string): void {
  if (path === filingParserNormalizationExecutionImageReviewPath) {
    const violation =
      filingParserNormalizationExecutionImageReviewViolation(content);
    if (violation !== null) violations.push(`${path}: ${violation}`);
    return;
  }
  if (path === "packages/filing-parser/worker/Dockerfile") {
    const violation = filingParserDockerfileViolation(content);
    if (violation !== null) violations.push(`${path}: ${violation}`);
    return;
  }
  if (path === filingParserNormalizationExecutionWorkerDockerfilePath) {
    const violation =
      filingParserNormalizationExecutionDockerfileViolation(content);
    if (violation !== null) violations.push(`${path}: ${violation}`);
    return;
  }
  if (path === filingParserNormalizationExecutionWorkerTaxonomyPath) {
    const violation =
      filingParserNormalizationExecutionTaxonomyViolation(content);
    if (violation !== null) violations.push(`${path}: ${violation}`);
    return;
  }
  if (path === filingParserNormalizationExecutionWorkerParserTestPath) {
    const violation =
      filingParserNormalizationExecutionWorkerTestViolation(content);
    if (violation !== null) violations.push(`${path}: ${violation}`);
    return;
  }
  if (
    path !== "packages/filing-parser/worker/parser.py" &&
    path !== filingParserNormalizationExecutionWorkerParserPath
  )
    return;
  for (const pattern of forbiddenWorkerPython) {
    if (pattern.test(content))
      violations.push(`${path}: disconnected worker matched ${pattern}`);
  }
  const importViolation = workerPythonImportViolation(
    content,
    path === filingParserNormalizationExecutionWorkerParserPath
      ? allowedFilingParserNormalizationExecutionWorkerPythonImports
      : allowedWorkerPythonImports,
  );
  if (importViolation !== null) violations.push(`${path}: ${importViolation}`);
}

function filingParserNormalizationExecutionWorkerTestViolation(
  content: string,
): string | null {
  const imports = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^(?:from|import)\s/u.test(line));
  const expectedImports = [
    "from __future__ import annotations",
    "import importlib.util",
    "import json",
    "import unittest",
    "from pathlib import Path",
    "from types import ModuleType",
  ];
  if (JSON.stringify(imports) !== JSON.stringify(expectedImports))
    return "Cycle 2j worker test may import only its exact future, local-loader, JSON, unittest, Path, and type surfaces";
  if (
    /^\s*(?:from|import)\s+(?:ctypes|ftplib|http|os|requests|runpy|socket|subprocess|urllib)\b/mu.test(
      content,
    ) ||
    /(?:^|[^\w.])(?:__import__|compile|eval|exec)\s*\(/mu.test(content) ||
    !content.includes('Path(__file__).with_name("parser.py")') ||
    !content.includes(
      'importlib.util.spec_from_file_location("cycle2j_worker", path)',
    )
  )
    return "Cycle 2j worker test must load only the adjacent parser and must not gain network, process, plugin, or arbitrary dynamic-code capability";
  return null;
}

function filingParserNormalizationExecutionImageReviewViolation(
  content: string,
): string | null {
  if (
    !content.endsWith("\n") ||
    content.includes("\r") ||
    content.startsWith("\ufeff")
  )
    return "Cycle 2j image review must remain newline-terminated UTF-8 JSON";
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return "Cycle 2j image review must remain parseable JSON";
  }
  const expected = {
    schemaVersion: 1,
    image:
      "docker.io/library/python:3.12.13-slim-bookworm@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
    tag: "3.12.13-slim-bookworm",
    indexDigest:
      "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
    platform: "linux/amd64",
    platformManifestDigest:
      "sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af",
    pythonVersion: "3.12.13",
    distribution: "Debian GNU/Linux 12 (bookworm) slim",
    officialRegistryManifestUrl:
      "https://registry-1.docker.io/v2/library/python/manifests/3.12.13-slim-bookworm",
    officialImageDefinitionUrl:
      "https://github.com/docker-library/official-images/blob/master/library/python",
    cpythonLicense: "Python Software Foundation License Version 2",
    cpythonLicenseUrl: "https://docs.python.org/3.12/license.html",
    containerPackageLicenseInventoryStatus: "not_proven_ci_acceptance_only",
  };
  if (
    Object.keys(expected).some(
      (key) => content.split(JSON.stringify(key)).length !== 2,
    )
  )
    return "Cycle 2j image review must contain every exact field once without duplicate metadata";
  return JSON.stringify(parsed) === JSON.stringify(expected)
    ? null
    : "Cycle 2j image review must retain its exact version, base/index/platform digests, URLs, license, distribution, and nonclaim status";
}

function workerPythonImportViolation(
  content: string,
  allowedImports: ReadonlySet<string> = allowedWorkerPythonImports,
): string | null {
  const imports = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^(?:from|import)\s/u.test(line));
  if (
    imports.length !== allowedImports.size ||
    imports.some((line) => !allowedImports.has(line)) ||
    [...allowedImports].some(
      (expected) => imports.filter((line) => line === expected).length !== 1,
    )
  )
    return "worker imports must remain the exact reviewed standard-library allowlist";
  return null;
}

function filingParserNormalizationExecutionTaxonomyViolation(
  content: string,
): string | null {
  if (
    !content.endsWith("\n") ||
    content.includes("\r") ||
    content.startsWith("\ufeff") ||
    (content.match(/"facts"/gu) ?? []).length !== 1 ||
    (content.match(/"namespace"/gu) ?? []).length !== 1 ||
    (content.match(/"schemaVersion"/gu) ?? []).length !== 1 ||
    (content.match(/"taxonomyFamily"/gu) ?? []).length !== 1 ||
    (content.match(/"taxonomyVersion"/gu) ?? []).length !== 1 ||
    (content.match(/"concept"/gu) ?? []).length !== 10 ||
    (content.match(/"key"/gu) ?? []).length !== 10 ||
    (content.match(/"periodKind"/gu) ?? []).length !== 10 ||
    (content.match(/"unit"/gu) ?? []).length !== 10
  )
    return "Cycle 2j taxonomy must remain one newline-terminated, duplicate-free closed ten-fact JSON document";
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return "Cycle 2j taxonomy must remain parseable JSON";
  }
  const expected = {
    facts: [
      {
        concept: "rc-synthetic:Assets",
        key: "assets",
        periodKind: "instant",
        unit: "USD",
      },
      {
        concept: "rc-synthetic:CashAndCashEquivalents",
        key: "cash",
        periodKind: "instant",
        unit: "USD",
      },
      {
        concept: "rc-synthetic:Debt",
        key: "debt",
        periodKind: "instant",
        unit: "USD",
      },
      {
        concept: "rc-synthetic:WeightedAverageDilutedShares",
        key: "diluted_shares",
        periodKind: "duration",
        unit: "shares",
      },
      {
        concept: "rc-synthetic:FreeCashFlow",
        key: "free_cash_flow",
        periodKind: "duration",
        unit: "USD",
      },
      {
        concept: "rc-synthetic:GrossProfit",
        key: "gross_profit",
        periodKind: "duration",
        unit: "USD",
      },
      {
        concept: "rc-synthetic:NetIncome",
        key: "net_income",
        periodKind: "duration",
        unit: "USD",
      },
      {
        concept: "rc-synthetic:OperatingCashFlow",
        key: "operating_cash_flow",
        periodKind: "duration",
        unit: "USD",
      },
      {
        concept: "rc-synthetic:OperatingIncome",
        key: "operating_income",
        periodKind: "duration",
        unit: "USD",
      },
      {
        concept: "rc-synthetic:Revenue",
        key: "revenue",
        periodKind: "duration",
        unit: "USD",
      },
    ],
    namespace:
      "urn:research-cockpit:synthetic:filing-normalization-execution:v1",
    schemaVersion: "1.0.0",
    taxonomyFamily: "rc-synthetic-ten-fact",
    taxonomyVersion: "1.0.0",
  };
  return JSON.stringify(parsed) === JSON.stringify(expected)
    ? null
    : "Cycle 2j taxonomy must remain the exact closed ten-fact namespace, version, concept, key, period-kind, and unit mapping";
}

function filingParserDockerfileViolation(content: string): string | null {
  if (
    !content.startsWith(
      "FROM docker.io/library/python:3.12.13-slim-bookworm@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2\n",
    )
  )
    return "Python base image must retain the reviewed digest";
  if (
    /^\s*(?:ADD|CMD|EXPOSE|HEALTHCHECK|RUN)\b/im.test(content) ||
    /\b(?:apt|curl|pip|wget)\b/i.test(content)
  )
    return "worker image must remain a zero-install, no-listener build";
  if (
    (content.match(/^USER 65532:65532$/gm) ?? []).length !== 1 ||
    (content.match(/^\s*ENTRYPOINT\b/gim) ?? []).length !== 1 ||
    (
      content.match(
        /^ENTRYPOINT \["python", "-I", "-B", "\/worker\/parser\.py"\]$/gm,
      ) ?? []
    ).length !== 1 ||
    content.indexOf("USER 65532:65532") > content.indexOf("ENTRYPOINT [")
  )
    return "numeric non-root user and exact no-shell entrypoint must remain pinned";
  const instructions = [
    ...content.matchAll(
      /^\s*(ADD|ARG|CMD|COPY|ENTRYPOINT|ENV|EXPOSE|FROM|HEALTHCHECK|LABEL|MAINTAINER|ONBUILD|RUN|SHELL|STOPSIGNAL|USER|VOLUME|WORKDIR)\b/gim,
    ),
  ].map((match) => match[1]?.toUpperCase());
  if (
    JSON.stringify(instructions) !==
      JSON.stringify([
        "FROM",
        "ENV",
        "WORKDIR",
        "WORKDIR",
        "COPY",
        "COPY",
        "USER",
        "ENTRYPOINT",
      ]) ||
    content !== validWorkerDockerfile
  )
    return "worker Dockerfile must retain the exact reviewed instruction sequence";
  return null;
}

function filingParserNormalizationExecutionDockerfileViolation(
  content: string,
): string | null {
  return content === validFilingParserNormalizationExecutionWorkerDockerfile
    ? null
    : "Cycle 2j worker Dockerfile must clear the inherited base command and retain the exact reviewed zero-install instruction sequence";
}

function isForbiddenFilingParserCompositionPath(path: string): boolean {
  return (
    path.startsWith("apps/") ||
    path.startsWith("modules/") ||
    (path.startsWith("packages/") &&
      !path.startsWith("packages/filing-parser/"))
  );
}

function hasFilingParserDependency(
  manifest: unknown,
  manifestPath: string,
): boolean {
  if (!isRecord(manifest)) return false;
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((group) => {
    if (!isRecord(group)) return false;
    return Object.entries(group).some(([name, value]) => {
      if (name === filingParserModule) return true;
      if (typeof value !== "string") return false;
      const normalizedValue = value.replaceAll("\\", "/");
      if (normalizedValue.includes(filingParserModule)) return true;
      const pathValue = /^(?:file|link|workspace):(.+)$/u.exec(
        normalizedValue,
      )?.[1];
      return (
        pathValue !== undefined &&
        referencesFilingParserPath(manifestPath, pathValue)
      );
    });
  });
}

function hasFilingFactNormalizationDependency(
  manifest: unknown,
  manifestPath: string,
): boolean {
  if (!isRecord(manifest)) return false;
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((group) => {
    if (!isRecord(group)) return false;
    return Object.entries(group).some(([name, value]) => {
      if (name === filingFactNormalizationModule) return true;
      if (typeof value !== "string") return false;
      const normalizedValue = value.replaceAll("\\", "/");
      if (normalizedValue.includes(filingFactNormalizationModule)) return true;
      const pathValue = /^(?:file|link|workspace):(.+)$/u.exec(
        normalizedValue,
      )?.[1];
      return (
        pathValue !== undefined &&
        referencesFilingFactNormalizationPath(manifestPath, pathValue)
      );
    });
  });
}

function hasFilingParserNormalizationHandoffDependency(
  manifest: unknown,
  manifestPath: string,
): boolean {
  if (!isRecord(manifest)) return false;
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((group) => {
    if (!isRecord(group)) return false;
    return Object.entries(group).some(([name, value]) => {
      if (name === filingParserNormalizationHandoffModule) return true;
      if (typeof value !== "string") return false;
      const normalizedValue = value.replaceAll("\\", "/");
      if (normalizedValue.includes(filingParserNormalizationHandoffModule))
        return true;
      const pathValue = /^(?:file|link|workspace):(.+)$/u.exec(
        normalizedValue,
      )?.[1];
      return (
        pathValue !== undefined &&
        referencesFilingParserNormalizationHandoffPath(manifestPath, pathValue)
      );
    });
  });
}

function hasFilingParserNormalizationExecutionDependency(
  manifest: unknown,
  manifestPath: string,
): boolean {
  if (!isRecord(manifest)) return false;
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((group) => {
    if (!isRecord(group)) return false;
    return Object.entries(group).some(([name, value]) => {
      if (
        name === filingParserNormalizationExecutionModule ||
        name === filingParserNormalizationExecutionAcceptanceModule
      )
        return true;
      if (typeof value !== "string") return false;
      const normalizedValue = value.replaceAll("\\", "/");
      if (
        normalizedValue.includes(filingParserNormalizationExecutionModule) ||
        normalizedValue.includes(
          filingParserNormalizationExecutionAcceptanceModule,
        )
      )
        return true;
      const pathValue = /^(?:file|link|workspace):(.+)$/u.exec(
        normalizedValue,
      )?.[1];
      return (
        pathValue !== undefined &&
        referencesFilingParserNormalizationExecutionPath(
          manifestPath,
          pathValue,
        )
      );
    });
  });
}

function filingParserNormalizationHandoffManifestCompositionViolation(
  manifestPath: string,
  manifest: unknown,
): string | null {
  if (
    manifestPath.startsWith(filingParserNormalizationHandoffPackagePrefix) ||
    manifestPath ===
      `${filingParserNormalizationExecutionPackagePrefix}package.json` ||
    manifestPath ===
      `${filingParserCrossEngineExecutionPackagePrefix}package.json` ||
    manifestPath ===
      `${filingParserCrossEngineExecutionAcceptancePackagePrefix}package.json` ||
    !isRecord(manifest)
  )
    return null;
  for (const field of [
    "bin",
    "browser",
    "exports",
    "imports",
    "main",
    "module",
    "types",
    "typesVersions",
    "typings",
  ]) {
    if (
      manifestValueReferencesFilingParserNormalizationHandoff(
        manifestPath,
        manifest[field],
      )
    )
      return "package imports, exports, or entry points must not target the Cycle 2i handoff";
  }
  if (manifest.scripts === undefined) return null;
  if (!isRecord(manifest.scripts))
    return "package scripts must remain an object of literal commands";
  for (const command of Object.values(manifest.scripts)) {
    if (typeof command !== "string")
      return "package scripts must remain an object of literal commands";
    if (commandReferencesFilingParserNormalizationHandoff(command))
      return "package scripts must not execute or compose the Cycle 2i handoff";
  }
  return null;
}

function filingParserNormalizationExecutionManifestCompositionViolation(
  manifestPath: string,
  manifest: unknown,
): string | null {
  if (
    manifestPath ===
      `${filingParserNormalizationExecutionPackagePrefix}package.json` ||
    manifestPath ===
      `${filingParserNormalizationExecutionAcceptancePackagePrefix}package.json` ||
    manifestPath ===
      `${filingParserCrossEngineExecutionPackagePrefix}package.json` ||
    manifestPath ===
      `${filingParserCrossEngineExecutionAcceptancePackagePrefix}package.json` ||
    !isRecord(manifest)
  )
    return null;
  for (const field of [
    "bin",
    "browser",
    "exports",
    "imports",
    "main",
    "module",
    "types",
    "typesVersions",
    "typings",
  ]) {
    if (
      manifestValueReferencesFilingParserNormalizationExecution(
        manifestPath,
        manifest[field],
      )
    )
      return "package imports, exports, or entry points must not target Cycle 2j execution or acceptance";
  }
  if (manifest.scripts === undefined) return null;
  if (!isRecord(manifest.scripts))
    return "package scripts must remain an object of literal commands";
  const approvedRootScripts = new Map([
    [
      "guardrails",
      "pnpm guardrails:boundaries && pnpm guardrails:fixtures && pnpm guardrails:filing-parser-fixtures && pnpm guardrails:filing-parser-normalization-execution-fixtures && pnpm guardrails:filing-parser-cross-engine-execution-fixtures && pnpm guardrails:filing-payload-custody-fixtures && pnpm guardrails:migrations && pnpm guardrails:postgres-acceptance && pnpm guardrails:licenses",
    ],
    [
      "guardrails:filing-parser-normalization-execution-fixtures",
      "tsx scripts/verify-filing-parser-normalization-execution-fixtures.ts",
    ],
    [
      "filing-parser-normalization-execution:acceptance",
      "tsx packages/filing-parser-normalization-execution-acceptance/src/run-filing-parser-normalization-execution-acceptance.ts",
    ],
    [
      "filing-parser-normalization-execution:evidence-review",
      "tsx packages/filing-parser-normalization-execution-acceptance/src/run-filing-parser-normalization-execution-evidence-review.ts",
    ],
    [
      "guardrails:filing-parser-cross-engine-execution-fixtures",
      "tsx scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
    ],
    [
      "filing-parser-cross-engine-execution:acceptance",
      "tsx packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.ts",
    ],
    [
      "filing-parser-cross-engine-execution:evidence-review",
      "tsx packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-evidence-review.ts",
    ],
  ]);
  for (const [name, command] of Object.entries(manifest.scripts)) {
    if (typeof command !== "string")
      return "package scripts must remain an object of literal commands";
    if (!commandReferencesFilingParserNormalizationExecution(command)) continue;
    if (
      manifestPath === "package.json" &&
      approvedRootScripts.get(name) === command
    )
      continue;
    return "package scripts must not execute or compose Cycle 2j outside its exact root acceptance and review entrypoints";
  }
  return null;
}

function manifestValueReferencesFilingParserNormalizationExecution(
  manifestPath: string,
  value: unknown,
): boolean {
  const pending = [value];
  let inspectedValues = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    inspectedValues += 1;
    if (inspectedValues > 4096) return true;
    if (typeof current === "string") {
      const normalized = current.replaceAll("\\", "/");
      const resolvedPattern = normalized.startsWith(".")
        ? posixNormalize(`${posixDirname(manifestPath)}/${normalized}`)
        : posixNormalize(normalized);
      if (
        commandReferencesFilingParserNormalizationExecution(normalized) ||
        boundaryTargetPatternCanReachExecution(resolvedPattern) ||
        referencesFilingParserNormalizationExecutionPath(
          manifestPath,
          normalized,
        )
      )
        return true;
    } else if (Array.isArray(current)) {
      for (const item of current as unknown[]) pending.push(item);
    } else if (isRecord(current)) {
      pending.push(...Object.values(current));
    }
  }
  return false;
}

function commandReferencesFilingParserNormalizationExecution(
  command: string,
): boolean {
  if (hasUrlPercentEscape(command)) return true;
  const shellUnescaped = command
    .replace(/\\\r?\n/gu, "")
    .replace(/\\([^\r\n])/gu, "$1");
  const interpretations = new Set([
    command,
    command.replaceAll("\\", "/"),
    shellUnescaped,
  ]);
  for (const interpretation of [...interpretations]) {
    let literalConcatenation = interpretation.replace(/\\\r?\n/gu, "");
    let previous = "";
    while (literalConcatenation !== previous) {
      previous = literalConcatenation;
      literalConcatenation = literalConcatenation.replace(
        /(["'])\s*\+\s*(["'])/gu,
        "",
      );
    }
    literalConcatenation = literalConcatenation
      .replace(/\$(?=["'])/gu, "")
      .replace(/["']/gu, "");
    interpretations.add(literalConcatenation);
    interpretations.add(literalConcatenation.replace(/\\([^\r\n])/gu, "$1"));
  }
  return [...interpretations].some((candidate) =>
    staticStringCanReachExecution(candidate),
  );
}

function manifestValueReferencesFilingParserNormalizationHandoff(
  manifestPath: string,
  value: unknown,
): boolean {
  const pending = [value];
  let inspectedValues = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    inspectedValues += 1;
    if (inspectedValues > 4096) return true;
    if (typeof current === "string") {
      const normalized = current.replaceAll("\\", "/");
      const resolvedPattern = normalized.startsWith(".")
        ? posixNormalize(`${posixDirname(manifestPath)}/${normalized}`)
        : posixNormalize(normalized);
      if (
        commandReferencesFilingParserNormalizationHandoff(normalized) ||
        boundaryTargetPatternCanReachHandoff(resolvedPattern) ||
        referencesFilingParserNormalizationHandoffPath(manifestPath, normalized)
      )
        return true;
    } else if (Array.isArray(current)) {
      for (const item of current as unknown[]) pending.push(item);
    } else if (isRecord(current)) {
      pending.push(...Object.values(current));
    }
  }
  return false;
}

function commandReferencesFilingParserNormalizationHandoff(
  command: string,
): boolean {
  if (hasUrlPercentEscape(command)) return true;
  const shellUnescaped = command
    .replace(/\\\r?\n/gu, "")
    .replace(/\\([^\r\n])/gu, "$1");
  const interpretations = new Set([
    command,
    command.replaceAll("\\", "/"),
    shellUnescaped,
  ]);
  for (const interpretation of [...interpretations]) {
    let literalConcatenation = interpretation.replace(/\\\r?\n/gu, "");
    let previous = "";
    while (literalConcatenation !== previous) {
      previous = literalConcatenation;
      literalConcatenation = literalConcatenation.replace(
        /(["'])\s*\+\s*(["'])/gu,
        "",
      );
    }
    literalConcatenation = literalConcatenation
      .replace(/\$(?=["'])/gu, "")
      .replace(/["']/gu, "");
    interpretations.add(literalConcatenation);
    interpretations.add(literalConcatenation.replace(/\\([^\r\n])/gu, "$1"));
  }
  return [...interpretations].some((candidate) =>
    staticStringCanReachHandoff(candidate),
  );
}

function hasUrlPercentEscape(value: string): boolean {
  return /%[0-9a-f]{2}/iu.test(value);
}

function hasFilingFactComparisonDependency(
  manifest: unknown,
  manifestPath: string,
): boolean {
  if (!isRecord(manifest)) return false;
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((group) => {
    if (!isRecord(group)) return false;
    return Object.entries(group).some(([name, value]) => {
      if (name === filingFactComparisonModule) return true;
      if (typeof value !== "string") return false;
      const normalizedValue = value.replaceAll("\\", "/");
      if (normalizedValue.includes(filingFactComparisonModule)) return true;
      const pathValue = /^(?:file|link|workspace):(.+)$/u.exec(
        normalizedValue,
      )?.[1];
      return (
        pathValue !== undefined &&
        referencesFilingFactComparisonPath(manifestPath, pathValue)
      );
    });
  });
}

function hasFilingQualityMeasurementDependency(
  manifest: unknown,
  manifestPath: string,
): boolean {
  if (!isRecord(manifest)) return false;
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((group) => {
    if (!isRecord(group)) return false;
    return Object.entries(group).some(([name, value]) => {
      if (name === filingQualityMeasurementModule) return true;
      if (typeof value !== "string") return false;
      const normalizedValue = value.replaceAll("\\", "/");
      if (normalizedValue.includes(filingQualityMeasurementModule)) return true;
      const pathValue = /^(?:file|link|workspace):(.+)$/u.exec(
        normalizedValue,
      )?.[1];
      return (
        pathValue !== undefined &&
        referencesFilingQualityMeasurementPath(manifestPath, pathValue)
      );
    });
  });
}

function hasFilingQualityPrecommitmentDependency(
  manifest: unknown,
  manifestPath: string,
): boolean {
  if (!isRecord(manifest)) return false;
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((group) => {
    if (!isRecord(group)) return false;
    return Object.entries(group).some(([name, value]) => {
      if (name === filingQualityPrecommitmentModule) return true;
      if (typeof value !== "string") return false;
      const normalizedValue = value.replaceAll("\\", "/");
      if (normalizedValue.includes(filingQualityPrecommitmentModule))
        return true;
      const pathValue = /^(?:file|link|workspace):(.+)$/u.exec(
        normalizedValue,
      )?.[1];
      return (
        pathValue !== undefined &&
        referencesFilingQualityPrecommitmentPath(manifestPath, pathValue)
      );
    });
  });
}

function hasFilingParserQualityCompositionDependency(
  manifest: unknown,
  manifestPath: string,
): boolean {
  if (!isRecord(manifest)) return false;
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((group) => {
    if (!isRecord(group)) return false;
    return Object.entries(group).some(([name, value]) => {
      if (name === filingParserQualityCompositionModule) return true;
      if (typeof value !== "string") return false;
      const normalizedValue = value.replaceAll("\\", "/");
      if (normalizedValue.includes(filingParserQualityCompositionModule))
        return true;
      const pathValue = /^(?:file|link|workspace):(.+)$/u.exec(
        normalizedValue,
      )?.[1];
      return (
        pathValue !== undefined &&
        referencesFilingParserQualityCompositionPath(manifestPath, pathValue)
      );
    });
  });
}

function hasFilingParserCustodyQualityCompositionDependency(
  manifest: unknown,
  manifestPath: string,
): boolean {
  if (!isRecord(manifest)) return false;
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((group) => {
    if (!isRecord(group)) return false;
    return Object.entries(group).some(([name, value]) => {
      if (name === filingParserCustodyQualityCompositionModule) return true;
      if (typeof value !== "string") return false;
      const normalizedValue = value.replaceAll("\\", "/");
      if (normalizedValue.includes(filingParserCustodyQualityCompositionModule))
        return true;
      const pathValue = /^(?:file|link|workspace):(.+)$/u.exec(
        normalizedValue,
      )?.[1];
      return (
        pathValue !== undefined &&
        referencesFilingParserCustodyQualityCompositionPath(
          manifestPath,
          pathValue,
        )
      );
    });
  });
}

function hasFilingPayloadCustodyDependency(
  manifest: unknown,
  manifestPath: string,
): boolean {
  if (!isRecord(manifest)) return false;
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((group) => {
    if (!isRecord(group)) return false;
    return Object.entries(group).some(([name, value]) => {
      if (name === filingPayloadCustodyModule) return true;
      if (typeof value !== "string") return false;
      const normalizedValue = value.replaceAll("\\", "/");
      if (normalizedValue.includes(filingPayloadCustodyModule)) return true;
      const pathValue = /^(?:file|link|workspace):(.+)$/u.exec(
        normalizedValue,
      )?.[1];
      return (
        pathValue !== undefined &&
        referencesFilingPayloadCustodyPath(manifestPath, pathValue)
      );
    });
  });
}

function referencesFilingFactNormalizationPath(
  sourcePath: string,
  specifier: string,
): boolean {
  if (
    specifier === filingFactNormalizationModule ||
    specifier.startsWith(`${filingFactNormalizationModule}/`)
  )
    return true;
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const resolved = normalizedSpecifier.startsWith(".")
    ? posixNormalize(`${posixDirname(sourcePath)}/${normalizedSpecifier}`)
    : posixNormalize(normalizedSpecifier);
  return (
    resolved === "packages/filing-fact-normalization" ||
    resolved.startsWith("packages/filing-fact-normalization/") ||
    resolved.includes("/packages/filing-fact-normalization/")
  );
}

function isAllowedFilingFactNormalizationExternalImportPath(
  sourcePath: string,
): boolean {
  return (
    sourcePath === filingParserNormalizationHandoffProductionPath ||
    sourcePath === filingParserNormalizationHandoffBuilderPath
  );
}

function referencesFilingParserNormalizationHandoffPath(
  sourcePath: string,
  specifier: string,
): boolean {
  if (hasUrlPercentEscape(specifier)) return true;
  if (
    specifier === filingParserNormalizationHandoffModule ||
    specifier.startsWith(`${filingParserNormalizationHandoffModule}/`)
  )
    return true;
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const resolved = normalizedSpecifier.startsWith(".")
    ? posixNormalize(`${posixDirname(sourcePath)}/${normalizedSpecifier}`)
    : posixNormalize(normalizedSpecifier);
  return (
    resolved === "packages/filing-parser-normalization-handoff" ||
    resolved.startsWith(filingParserNormalizationHandoffPackagePrefix) ||
    resolved.includes("/packages/filing-parser-normalization-handoff/")
  );
}

function referencesFilingParserNormalizationExecutionPath(
  sourcePath: string,
  specifier: string,
): boolean {
  if (hasUrlPercentEscape(specifier)) return true;
  if (
    specifier === filingParserNormalizationExecutionModule ||
    specifier.startsWith(`${filingParserNormalizationExecutionModule}/`) ||
    specifier === filingParserNormalizationExecutionAcceptanceModule ||
    specifier.startsWith(
      `${filingParserNormalizationExecutionAcceptanceModule}/`,
    )
  )
    return true;
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const resolved = normalizedSpecifier.startsWith(".")
    ? posixNormalize(`${posixDirname(sourcePath)}/${normalizedSpecifier}`)
    : posixNormalize(normalizedSpecifier);
  return (
    resolved === "packages/filing-parser-normalization-execution" ||
    resolved.startsWith(filingParserNormalizationExecutionPackagePrefix) ||
    resolved === "packages/filing-parser-normalization-execution-acceptance" ||
    resolved.startsWith(
      filingParserNormalizationExecutionAcceptancePackagePrefix,
    ) ||
    resolved.includes("/packages/filing-parser-normalization-execution/") ||
    resolved.includes(
      "/packages/filing-parser-normalization-execution-acceptance/",
    )
  );
}

function referencesFilingFactComparisonPath(
  sourcePath: string,
  specifier: string,
): boolean {
  if (
    specifier === filingFactComparisonModule ||
    specifier.startsWith(`${filingFactComparisonModule}/`)
  )
    return true;
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const resolved = normalizedSpecifier.startsWith(".")
    ? posixNormalize(`${posixDirname(sourcePath)}/${normalizedSpecifier}`)
    : posixNormalize(normalizedSpecifier);
  return (
    resolved === "packages/filing-fact-comparison" ||
    resolved.startsWith(filingFactComparisonPackagePrefix) ||
    resolved.includes("/packages/filing-fact-comparison/")
  );
}

function referencesFilingQualityMeasurementPath(
  sourcePath: string,
  specifier: string,
): boolean {
  if (
    specifier === filingQualityMeasurementModule ||
    specifier.startsWith(`${filingQualityMeasurementModule}/`)
  )
    return true;
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const resolved = normalizedSpecifier.startsWith(".")
    ? posixNormalize(`${posixDirname(sourcePath)}/${normalizedSpecifier}`)
    : posixNormalize(normalizedSpecifier);
  return (
    resolved === "packages/filing-quality-measurement" ||
    resolved.startsWith(filingQualityMeasurementPackagePrefix) ||
    resolved.includes("/packages/filing-quality-measurement/")
  );
}

function isAllowedFilingQualityMeasurementExternalImport(
  sourcePath: string,
  specifier: string,
): boolean {
  return (
    (sourcePath === filingQualityPrecommitmentProductionPath ||
      sourcePath === filingQualityPrecommitmentBuilderPath ||
      sourcePath.startsWith(filingParserQualityCompositionSourcePrefix)) &&
    specifier === filingQualityMeasurementModule
  );
}

function isAllowedFilingQualityPrecommitmentExternalImport(
  sourcePath: string,
  specifier: string,
): boolean {
  return (
    sourcePath.startsWith(filingParserQualityCompositionSourcePrefix) &&
    specifier === filingQualityPrecommitmentModule
  );
}

function referencesFilingQualityPrecommitmentPath(
  sourcePath: string,
  specifier: string,
): boolean {
  if (
    specifier === filingQualityPrecommitmentModule ||
    specifier.startsWith(`${filingQualityPrecommitmentModule}/`)
  )
    return true;
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const resolved = normalizedSpecifier.startsWith(".")
    ? posixNormalize(`${posixDirname(sourcePath)}/${normalizedSpecifier}`)
    : posixNormalize(normalizedSpecifier);
  return (
    resolved === "packages/filing-quality-precommitment" ||
    resolved.startsWith(filingQualityPrecommitmentPackagePrefix) ||
    resolved.includes("/packages/filing-quality-precommitment/")
  );
}

function referencesFilingParserQualityCompositionPath(
  sourcePath: string,
  specifier: string,
): boolean {
  if (
    specifier === filingParserQualityCompositionModule ||
    specifier.startsWith(`${filingParserQualityCompositionModule}/`)
  )
    return true;
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const resolved = normalizedSpecifier.startsWith(".")
    ? posixNormalize(`${posixDirname(sourcePath)}/${normalizedSpecifier}`)
    : posixNormalize(normalizedSpecifier);
  return (
    resolved === "packages/filing-parser-quality-composition" ||
    resolved.startsWith(filingParserQualityCompositionPackagePrefix) ||
    resolved.includes("/packages/filing-parser-quality-composition/")
  );
}

function isAllowedFilingParserQualityCompositionExternalImport(
  sourcePath: string,
  specifier: string,
): boolean {
  return (
    (sourcePath.startsWith(
      filingParserCrossEngineExecutionAcceptanceSourcePrefix,
    ) ||
      sourcePath.startsWith(
        filingParserCustodyQualityCompositionSourcePrefix,
      )) &&
    (specifier === filingParserQualityCompositionModule ||
      (sourcePath === filingParserCustodyQualityCompositionBuilderPath &&
        [
          "../../filing-parser-quality-composition/src/filing-parser-quality-composition",
          "../../filing-parser-quality-composition/src/test-filing-parser-quality-composition-builder",
        ].includes(specifier)))
  );
}

function referencesFilingParserCustodyQualityCompositionPath(
  sourcePath: string,
  specifier: string,
): boolean {
  if (
    specifier === filingParserCustodyQualityCompositionModule ||
    specifier.startsWith(`${filingParserCustodyQualityCompositionModule}/`)
  )
    return true;
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const resolved = normalizedSpecifier.startsWith(".")
    ? posixNormalize(`${posixDirname(sourcePath)}/${normalizedSpecifier}`)
    : posixNormalize(normalizedSpecifier);
  return (
    resolved === "packages/filing-parser-custody-quality-composition" ||
    resolved.startsWith(filingParserCustodyQualityCompositionPackagePrefix) ||
    resolved.includes("/packages/filing-parser-custody-quality-composition/")
  );
}

function isAllowedFilingParserCustodyQualityCompositionExternalImport(
  sourcePath: string,
  specifier: string,
): boolean {
  return (
    sourcePath.startsWith(
      filingParserCrossEngineExecutionAcceptanceSourcePrefix,
    ) && specifier === filingParserCustodyQualityCompositionModule
  );
}

function referencesFilingPayloadCustodyPath(
  sourcePath: string,
  specifier: string,
): boolean {
  if (
    specifier === filingPayloadCustodyModule ||
    specifier.startsWith(`${filingPayloadCustodyModule}/`)
  )
    return true;
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const resolved = normalizedSpecifier.startsWith(".")
    ? posixNormalize(`${posixDirname(sourcePath)}/${normalizedSpecifier}`)
    : posixNormalize(normalizedSpecifier);
  return (
    resolved === "packages/filing-payload-custody" ||
    resolved.startsWith("packages/filing-payload-custody/") ||
    resolved.includes("/packages/filing-payload-custody/")
  );
}

function isAllowedFilingPayloadCustodyExternalImport(
  sourcePath: string,
  specifier: string,
): boolean {
  if (
    sourcePath.startsWith(filingParserCustodyQualityCompositionSourcePrefix)
  ) {
    if (specifier === filingPayloadCustodyModule) return true;
    return (
      sourcePath === filingParserCustodyQualityCompositionSecurityTestPath &&
      specifier ===
        "../../filing-payload-custody/src/parser-archive-pair-custody"
    );
  }
  if (sourcePath !== filingPayloadCustodyFixtureGuardPath) return false;
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const resolved = normalizedSpecifier.startsWith(".")
    ? posixNormalize(`${posixDirname(sourcePath)}/${normalizedSpecifier}`)
    : posixNormalize(normalizedSpecifier);
  return (
    resolved === filingPayloadCustodyProductionPath.replace(/\.ts$/u, "") ||
    resolved === `${filingPayloadCustodySourcePrefix}test-payload-builder`
  );
}

function referencesFilingParserPath(
  sourcePath: string,
  specifier: string,
): boolean {
  if (
    specifier === filingParserModule ||
    specifier.startsWith(`${filingParserModule}/`)
  )
    return true;
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const resolved = normalizedSpecifier.startsWith(".")
    ? posixNormalize(`${posixDirname(sourcePath)}/${normalizedSpecifier}`)
    : posixNormalize(normalizedSpecifier);
  return (
    resolved === "packages/filing-parser" ||
    resolved.startsWith("packages/filing-parser/") ||
    resolved.includes("/packages/filing-parser/")
  );
}

function referencesExternalWorkspacePath(
  sourcePath: string,
  specifier: string,
): boolean {
  if (specifier.startsWith("@research-cockpit/")) return true;
  if (!specifier.startsWith(".")) return false;
  const resolved = posixNormalize(
    `${posixDirname(sourcePath)}/${specifier.replaceAll("\\", "/")}`,
  );
  return (
    resolved !== "packages/filing-parser" &&
    !resolved.startsWith("packages/filing-parser/")
  );
}

function referencesModule(content: string, moduleName: string): boolean {
  return referencesModuleSpecifier(
    collectModuleSpecifiers(content),
    moduleName,
  );
}

function referencesModuleSpecifier(
  moduleSpecifiers: readonly string[],
  moduleName: string,
): boolean {
  return moduleSpecifiers.some(
    (specifier) =>
      specifier === moduleName || specifier.startsWith(`${moduleName}/`),
  );
}

function filingParserNormalizationHandoffExternalCompositionViolation(
  path: string,
  content: string,
): string | null {
  if (
    path.startsWith(filingParserNormalizationHandoffPackagePrefix) ||
    path.startsWith(filingParserCrossEngineExecutionPackagePrefix) ||
    path.startsWith(filingParserCrossEngineExecutionAcceptancePackagePrefix) ||
    path === filingParserNormalizationExecutionProductionPath ||
    path === filingParserNormalizationExecutionWorkflowPath ||
    path ===
      ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml" ||
    path ===
      "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts" ||
    path === "scripts/verify-boundaries.ts"
  )
    return null;
  if (!isNodeSourceExecutable(path, content)) {
    if (
      isCommandSurfaceExecutable(path, content) &&
      commandReferencesFilingParserNormalizationHandoff(content)
    )
      return "Cycle 2i parser-normalization handoff must remain package-isolated";
    return null;
  }
  const moduleSpecifiers = collectModuleSpecifiers(content);
  if (
    hasUnresolvedRuntimeModuleLoad(content) ||
    hasForbiddenDynamicCodeCapability(content) ||
    hasForbiddenNodeModuleCapability(content) ||
    hasIndirectRuntimeModuleLoad(content) ||
    hasFilingParserNormalizationHandoffStaticTarget(path, content) ||
    moduleSpecifiers.some(
      (specifier) =>
        /^(?:blob|data):/iu.test(specifier) ||
        specifier === "tsx" ||
        specifier.startsWith("tsx/") ||
        referencesFilingParserNormalizationHandoffPath(path, specifier),
    )
  )
    return "Cycle 2i parser-normalization handoff must remain package-isolated";
  return null;
}

function filingParserNormalizationExecutionExternalCompositionViolation(
  path: string,
  content: string,
): string | null {
  if (
    path.startsWith(filingParserNormalizationExecutionPackagePrefix) ||
    path.startsWith(
      filingParserNormalizationExecutionAcceptancePackagePrefix,
    ) ||
    path.startsWith(filingParserCrossEngineExecutionPackagePrefix) ||
    path.startsWith(filingParserCrossEngineExecutionAcceptancePackagePrefix) ||
    path === filingParserNormalizationExecutionWorkflowPath ||
    path ===
      ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml" ||
    path ===
      "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts" ||
    path === "scripts/verify-boundaries.ts"
  )
    return null;
  if (!isNodeSourceExecutable(path, content)) {
    if (
      isCommandSurfaceExecutable(path, content) &&
      commandReferencesFilingParserNormalizationExecution(content)
    )
      return "Cycle 2j execution and acceptance entrypoints must remain isolated";
    return null;
  }
  const moduleSpecifiers = collectModuleSpecifiers(content);
  if (
    hasUnresolvedRuntimeModuleLoad(content) ||
    hasForbiddenDynamicCodeCapability(content) ||
    hasForbiddenNodeModuleCapability(content) ||
    hasIndirectRuntimeModuleLoad(content) ||
    hasFilingParserNormalizationExecutionStaticTarget(path, content) ||
    moduleSpecifiers.some(
      (specifier) =>
        /^(?:blob|data):/iu.test(specifier) ||
        specifier === "tsx" ||
        specifier.startsWith("tsx/") ||
        referencesFilingParserNormalizationExecutionPath(path, specifier),
    )
  )
    return "Cycle 2j execution and acceptance packages must remain isolated";
  return null;
}

function filingParserNormalizationHandoffTsconfigViolation(
  configPath: string,
  config: unknown,
): string | null {
  if (!isRecord(config)) return null;
  const compilerOptions = isRecord(config.compilerOptions)
    ? config.compilerOptions
    : {};
  const {
    baseUrl,
    jsxImportSource,
    paths,
    plugins,
    rootDirs,
    typeRoots,
    types,
  } = compilerOptions;
  const externalConfig = !configPath.startsWith(
    filingParserNormalizationHandoffPackagePrefix,
  );
  if (externalConfig) {
    const extendsSpecifiers = typeScriptConfigExtendsSpecifiers(config) ?? [];
    if (
      extendsSpecifiers.some((target) =>
        typeScriptConfigTargetCanReachHandoff(configPath, target),
      )
    )
      return "TypeScript config inheritance must not target the Cycle 2i handoff package";
    for (const field of [config.files, config.include]) {
      if (
        Array.isArray(field) &&
        field.some(
          (target) =>
            typeof target === "string" &&
            typeScriptConfigTargetCanReachHandoff(configPath, target),
        )
      )
        return "TypeScript files/include must not reach the Cycle 2i handoff package";
    }
    if (
      Array.isArray(config.references) &&
      config.references.some(
        (reference) =>
          isRecord(reference) &&
          typeof reference.path === "string" &&
          typeScriptConfigTargetCanReachHandoff(configPath, reference.path),
      )
    )
      return "TypeScript project references must not target the Cycle 2i handoff package";
    if (
      typeof baseUrl === "string" &&
      typeScriptConfigTargetCanReachHandoff(configPath, baseUrl)
    )
      return "TypeScript baseUrl must not resolve into the Cycle 2i handoff package";
    if (
      Array.isArray(rootDirs) &&
      rootDirs.some(
        (rootDirectory) =>
          typeof rootDirectory === "string" &&
          typeScriptConfigTargetCanReachHandoff(configPath, rootDirectory),
      )
    )
      return "TypeScript rootDirs must not include the Cycle 2i handoff package";
    for (const field of [typeRoots, types]) {
      if (
        Array.isArray(field) &&
        field.some(
          (target) =>
            typeof target === "string" &&
            typeScriptConfigTargetCanReachHandoff(configPath, target),
        )
      )
        return "TypeScript type roots must not target the Cycle 2i handoff package";
    }
    if (
      Array.isArray(plugins) &&
      plugins.some(
        (plugin) =>
          isRecord(plugin) &&
          typeof plugin.name === "string" &&
          typeScriptConfigTargetCanReachHandoff(configPath, plugin.name),
      )
    )
      return "TypeScript plugins must not load the Cycle 2i handoff package";
    if (
      typeof jsxImportSource === "string" &&
      typeScriptConfigTargetCanReachHandoff(configPath, jsxImportSource)
    )
      return "TypeScript jsxImportSource must not target the Cycle 2i handoff package";
  }
  if (!isRecord(paths)) return null;
  const normalizedBaseUrl = typeof baseUrl === "string" ? baseUrl : ".";
  const resolutionBase = posixNormalize(
    `${posixDirname(configPath)}/${normalizedBaseUrl.replaceAll("\\", "/")}`,
  );
  for (const targets of Object.values(paths)) {
    if (!Array.isArray(targets)) continue;
    for (const target of targets) {
      if (typeof target !== "string") continue;
      const normalizedTarget = target.replaceAll("\\", "/");
      if (
        typeScriptConfigTargetCanReachHandoff(
          configPath,
          normalizedTarget,
          resolutionBase,
        )
      )
        return "TypeScript path aliases must not target the Cycle 2i handoff package";
    }
  }
  return null;
}

function filingParserNormalizationExecutionTsconfigViolation(
  configPath: string,
  config: unknown,
): string | null {
  if (!isRecord(config)) return null;
  if (
    configPath ===
      `${filingParserNormalizationExecutionPackagePrefix}tsconfig.json` ||
    configPath ===
      `${filingParserNormalizationExecutionAcceptancePackagePrefix}tsconfig.json`
  ) {
    const expected = {
      extends: "../../tsconfig.base.json",
      compilerOptions: { noEmit: true, types: ["node"] },
      include: ["src/**/*.ts"],
    };
    return JSON.stringify(config) === JSON.stringify(expected)
      ? null
      : "Cycle 2j package tsconfig must retain its exact base config, no-emit Node type surface, and local source include";
  }
  const compilerOptions = isRecord(config.compilerOptions)
    ? config.compilerOptions
    : {};
  const {
    baseUrl,
    jsxImportSource,
    paths,
    plugins,
    rootDirs,
    typeRoots,
    types,
  } = compilerOptions;
  const extendsSpecifiers = typeScriptConfigExtendsSpecifiers(config) ?? [];
  if (
    extendsSpecifiers.some((target) =>
      typeScriptConfigTargetCanReachExecution(configPath, target),
    )
  )
    return "TypeScript config inheritance must not target Cycle 2j execution or acceptance";
  for (const field of [config.files, config.include]) {
    if (
      Array.isArray(field) &&
      field.some(
        (target) =>
          typeof target === "string" &&
          typeScriptConfigTargetCanReachExecution(configPath, target),
      )
    )
      return "TypeScript files/include must not reach Cycle 2j execution or acceptance";
  }
  if (
    Array.isArray(config.references) &&
    config.references.some(
      (reference) =>
        isRecord(reference) &&
        typeof reference.path === "string" &&
        typeScriptConfigTargetCanReachExecution(configPath, reference.path),
    )
  )
    return "TypeScript project references must not target Cycle 2j execution or acceptance";
  if (
    typeof baseUrl === "string" &&
    typeScriptConfigTargetCanReachExecution(configPath, baseUrl)
  )
    return "TypeScript baseUrl must not resolve into Cycle 2j execution or acceptance";
  if (
    Array.isArray(rootDirs) &&
    rootDirs.some(
      (rootDirectory) =>
        typeof rootDirectory === "string" &&
        typeScriptConfigTargetCanReachExecution(configPath, rootDirectory),
    )
  )
    return "TypeScript rootDirs must not include Cycle 2j execution or acceptance";
  for (const field of [typeRoots, types]) {
    if (
      Array.isArray(field) &&
      field.some(
        (target) =>
          typeof target === "string" &&
          typeScriptConfigTargetCanReachExecution(configPath, target),
      )
    )
      return "TypeScript type roots must not target Cycle 2j execution or acceptance";
  }
  if (
    Array.isArray(plugins) &&
    plugins.some(
      (plugin) =>
        isRecord(plugin) &&
        typeof plugin.name === "string" &&
        typeScriptConfigTargetCanReachExecution(configPath, plugin.name),
    )
  )
    return "TypeScript plugins must not load Cycle 2j execution or acceptance";
  if (
    typeof jsxImportSource === "string" &&
    typeScriptConfigTargetCanReachExecution(configPath, jsxImportSource)
  )
    return "TypeScript jsxImportSource must not target Cycle 2j execution or acceptance";
  if (!isRecord(paths)) return null;
  const normalizedBaseUrl = typeof baseUrl === "string" ? baseUrl : ".";
  const resolutionBase = posixNormalize(
    `${posixDirname(configPath)}/${normalizedBaseUrl.replaceAll("\\", "/")}`,
  );
  for (const targets of Object.values(paths)) {
    if (!Array.isArray(targets)) continue;
    for (const target of targets) {
      if (
        typeof target === "string" &&
        typeScriptConfigTargetCanReachExecution(
          configPath,
          target,
          resolutionBase,
        )
      )
        return "TypeScript path aliases must not target Cycle 2j execution or acceptance";
    }
  }
  return null;
}

function typeScriptConfigTargetCanReachExecution(
  configPath: string,
  target: string,
  resolutionBase = posixDirname(configPath),
): boolean {
  if (referencesFilingParserNormalizationExecutionPath(configPath, target))
    return true;
  const normalizedTarget = target.replaceAll("\\", "/");
  const resolvedPattern =
    normalizedTarget.startsWith("@") ||
    normalizedTarget.startsWith("/") ||
    /^[a-z]:\//iu.test(normalizedTarget) ||
    normalizedTarget.startsWith("file:")
      ? posixNormalize(normalizedTarget)
      : posixNormalize(`${resolutionBase}/${normalizedTarget}`);
  return boundaryTargetPatternCanReachExecution(resolvedPattern);
}

function boundaryTargetPatternCanReachExecution(pattern: string): boolean {
  if (hasUrlPercentEscape(pattern)) return true;
  const wildcardIndex = pattern.search(/[*?]/u);
  if (wildcardIndex === -1) return false;
  const prefix = pattern.slice(0, wildcardIndex).replace(/\/+$/u, "");
  const absoluteExecutionPath = `${root.replaceAll("\\", "/")}/packages/filing-parser-normalization-execution`;
  const absoluteAcceptancePath = `${root.replaceAll("\\", "/")}/packages/filing-parser-normalization-execution-acceptance`;
  return [
    filingParserNormalizationExecutionModule,
    filingParserNormalizationExecutionAcceptanceModule,
    "packages/filing-parser-normalization-execution",
    "packages/filing-parser-normalization-execution-acceptance",
    absoluteExecutionPath,
    absoluteAcceptancePath,
    `file:///${absoluteExecutionPath}`,
    `file:///${absoluteAcceptancePath}`,
  ].some((candidate) => prefix.length === 0 || candidate.startsWith(prefix));
}

function typeScriptConfigTargetCanReachHandoff(
  configPath: string,
  target: string,
  resolutionBase = posixDirname(configPath),
): boolean {
  if (referencesFilingParserNormalizationHandoffPath(configPath, target))
    return true;
  const normalizedTarget = target.replaceAll("\\", "/");
  const resolvedPattern =
    normalizedTarget.startsWith("@") ||
    normalizedTarget.startsWith("/") ||
    /^[a-z]:\//iu.test(normalizedTarget) ||
    normalizedTarget.startsWith("file:")
      ? posixNormalize(normalizedTarget)
      : posixNormalize(`${resolutionBase}/${normalizedTarget}`);
  return boundaryTargetPatternCanReachHandoff(resolvedPattern);
}

function boundaryTargetPatternCanReachHandoff(pattern: string): boolean {
  if (hasUrlPercentEscape(pattern)) return true;
  const wildcardIndex = pattern.search(/[*?]/u);
  if (wildcardIndex === -1) return false;
  const prefix = pattern.slice(0, wildcardIndex).replace(/\/+$/u, "");
  const absoluteHandoffPath = `${root.replaceAll("\\", "/")}/packages/filing-parser-normalization-handoff`;
  return [
    filingParserNormalizationHandoffModule,
    "packages/filing-parser-normalization-handoff",
    absoluteHandoffPath,
    `file:///${absoluteHandoffPath}`,
  ].some((candidate) => prefix.length === 0 || candidate.startsWith(prefix));
}

function isNodeSourceExecutable(path: string, content: string): boolean {
  const extension = extname(path).toLowerCase();
  if (executableSourceExtensions.has(extension)) return true;
  if (extension !== "" || isDockerfileName(basename(path))) return false;
  const firstLine = content.split(/\r?\n/u, 1)[0] ?? "";
  return /^#!.*\b(?:bun|deno|node|ts-node|tsx)(?:\.exe)?\b/iu.test(firstLine);
}

function isCommandSurfaceExecutable(path: string, content: string): boolean {
  const extension = extname(path).toLowerCase();
  if (commandSurfaceExtensions.has(extension)) return true;
  if (extension !== "" || isDockerfileName(basename(path))) return false;
  const firstLine = content.split(/\r?\n/u, 1)[0] ?? "";
  return /^#!.*\b(?:bash|cmd|dash|fish|ksh|powershell|pwsh|sh|zsh)(?:\.exe)?\b/iu.test(
    firstLine,
  );
}

function hasFilingParserNormalizationHandoffStaticTarget(
  path: string,
  content: string,
): boolean {
  return hasFilingParserNormalizationStaticTarget(
    path,
    content,
    filingParserNormalizationHandoffMetadataLiteralPaths,
    staticStringCanReachHandoff,
  );
}

function hasFilingParserNormalizationExecutionStaticTarget(
  path: string,
  content: string,
): boolean {
  return hasFilingParserNormalizationStaticTarget(
    path,
    content,
    filingParserNormalizationExecutionMetadataLiteralPaths,
    staticStringCanReachExecution,
  );
}

function hasFilingParserNormalizationStaticTarget(
  path: string,
  content: string,
  metadataLiteralPaths: ReadonlySet<string>,
  canReachTarget: (value: string) => boolean,
): boolean {
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const metadataSurface = metadataLiteralPaths.has(path);
  const targetBearingIdentifiers = new Set<string>();
  const staticStringIdentifiers = metadataSurface
    ? collectBoundaryStaticStringIdentifierValues(sourceFile)
    : new Map<string, string>();
  for (const [name, value] of staticStringIdentifiers) {
    if (canReachTarget(value)) targetBearingIdentifiers.add(name);
  }
  const executionSinkAliases = collectBoundaryExecutionSinkAliases(sourceFile);
  if (metadataSurface) {
    let changed = true;
    while (changed) {
      changed = false;
      const collect = (node: ts.Node): void => {
        let assignedNames: readonly ts.Identifier[] = [];
        let assignedValue: ts.Expression | undefined;
        if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
          assignedNames = boundaryBindingIdentifiers(node.name);
          assignedValue = node.initializer;
        } else if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ) {
          assignedNames = boundaryAssignmentIdentifiers(node.left);
          assignedValue = node.right;
        }
        if (
          assignedValue !== undefined &&
          boundaryNodeContainsHandoffTarget(
            assignedValue,
            targetBearingIdentifiers,
            staticStringIdentifiers,
            canReachTarget,
          )
        ) {
          for (const name of assignedNames) {
            if (targetBearingIdentifiers.has(name.text)) continue;
            targetBearingIdentifiers.add(name.text);
            changed = true;
          }
        }
        ts.forEachChild(node, collect);
      };
      collect(sourceFile);
    }
  }
  let found = false;
  const visit = (node: ts.Node): void => {
    const executionArguments =
      metadataSurface && (ts.isCallExpression(node) || ts.isNewExpression(node))
        ? boundaryExecutionArguments(node, executionSinkAliases)
        : null;
    if (
      metadataSurface &&
      executionArguments?.some((argument) =>
        boundaryNodeContainsHandoffTarget(
          argument,
          targetBearingIdentifiers,
          staticStringIdentifiers,
          canReachTarget,
        ),
      )
    ) {
      found = true;
      return;
    }
    if (metadataSurface) {
      ts.forEachChild(node, visit);
      return;
    }
    let value: string | null = null;
    if (ts.isStringLiteralLike(node)) value = node.text;
    else if (ts.isBinaryExpression(node) || ts.isCallExpression(node))
      value = staticStringValue(node);
    if (value !== null && canReachTarget(value)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function collectBoundaryStaticStringIdentifierValues(
  sourceFile: ts.SourceFile,
): ReadonlyMap<string, string> {
  const values = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined
    ) {
      const value = boundaryStaticStringValue(node.initializer, values);
      if (value !== null) values.set(node.name.text, value);
    } else if (
      ts.isBinaryExpression(node) &&
      ts.isIdentifier(unwrapBoundaryExpression(node.left))
    ) {
      const name = unwrapBoundaryExpression(node.left) as ts.Identifier;
      if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const value = boundaryStaticStringValue(node.right, values);
        if (value !== null) values.set(name.text, value);
      } else if (node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) {
        const left = values.get(name.text);
        const right = boundaryStaticStringValue(node.right, values);
        if (left !== undefined && right !== null)
          values.set(name.text, left + right);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return values;
}

function boundaryStaticStringValue(
  expression: ts.Expression,
  identifiers: ReadonlyMap<string, string>,
): string | null {
  const value = unwrapBoundaryExpression(expression);
  if (ts.isIdentifier(value)) return identifiers.get(value.text) ?? null;
  if (
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = boundaryStaticStringValue(value.left, identifiers);
    const right = boundaryStaticStringValue(value.right, identifiers);
    return left === null || right === null ? null : left + right;
  }
  return staticStringValue(value);
}

interface BoundaryExecutionSinkAliases {
  readonly callableIdentifiers: ReadonlySet<string>;
  readonly childProcessNamespaces: ReadonlySet<string>;
  readonly tsxNamespaces: ReadonlySet<string>;
}

function collectBoundaryExecutionSinkAliases(
  sourceFile: ts.SourceFile,
): BoundaryExecutionSinkAliases {
  const callableIdentifiers = new Set<string>();
  const childProcessNamespaces = new Set<string>();
  const tsxNamespaces = new Set<string>();

  const addImportedBindings = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      !node.importClause?.isTypeOnly &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const moduleName = node.moduleSpecifier.text;
      const importClause = node.importClause;
      if (importClause !== undefined) {
        const namespaceAliases = boundaryChildProcessModuleNames.has(moduleName)
          ? childProcessNamespaces
          : isBoundaryTsxApiModule(moduleName)
            ? tsxNamespaces
            : null;
        const sinkNames = boundaryChildProcessModuleNames.has(moduleName)
          ? boundaryChildProcessExecutionSinkNames
          : isBoundaryTsxApiModule(moduleName)
            ? boundaryTsxExecutionSinkNames
            : null;
        if (namespaceAliases !== null && importClause.name !== undefined)
          namespaceAliases.add(importClause.name.text);
        if (
          namespaceAliases !== null &&
          importClause.namedBindings !== undefined
        ) {
          if (ts.isNamespaceImport(importClause.namedBindings)) {
            namespaceAliases.add(importClause.namedBindings.name.text);
          } else if (sinkNames !== null) {
            for (const element of importClause.namedBindings.elements) {
              if (
                !element.isTypeOnly &&
                sinkNames.has((element.propertyName ?? element.name).text)
              )
                callableIdentifiers.add(element.name.text);
            }
          }
        }
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression !== undefined &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      const moduleName = node.moduleReference.expression.text;
      if (boundaryChildProcessModuleNames.has(moduleName))
        childProcessNamespaces.add(node.name.text);
      else if (isBoundaryTsxApiModule(moduleName))
        tsxNamespaces.add(node.name.text);
    }
    ts.forEachChild(node, addImportedBindings);
  };
  addImportedBindings(sourceFile);

  let changed = true;
  while (changed) {
    changed = false;
    const addAlias = (
      name: ts.Identifier,
      initializer: ts.Expression,
    ): void => {
      if (
        (isBoundaryExecutionCallableExpression(initializer, {
          callableIdentifiers,
          childProcessNamespaces,
          tsxNamespaces,
        }) ||
          (isBoundaryFunctionWithBody(initializer) &&
            boundaryFunctionForwardsToExecutionSink(initializer, {
              callableIdentifiers,
              childProcessNamespaces,
              tsxNamespaces,
            }))) &&
        !callableIdentifiers.has(name.text)
      ) {
        callableIdentifiers.add(name.text);
        changed = true;
      }
      if (
        isBoundaryExecutionModuleNamespaceExpression(
          initializer,
          boundaryChildProcessModuleNames,
          childProcessNamespaces,
        ) &&
        !childProcessNamespaces.has(name.text)
      ) {
        childProcessNamespaces.add(name.text);
        changed = true;
      }
      if (
        isBoundaryExecutionModuleNamespaceExpression(
          initializer,
          null,
          tsxNamespaces,
        ) &&
        !tsxNamespaces.has(name.text)
      ) {
        const target = boundaryRuntimeModuleSpecifier(initializer);
        if (target === null || isBoundaryTsxApiModule(target)) {
          tsxNamespaces.add(name.text);
          changed = true;
        }
      }
    };
    const collectAliases = (node: ts.Node): void => {
      let binding: ts.BindingName | ts.Expression | undefined;
      let initializer: ts.Expression | undefined;
      if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
        binding = node.name;
        initializer = node.initializer;
      } else if (
        ts.isBinaryExpression(node) &&
        [
          ts.SyntaxKind.AmpersandAmpersandEqualsToken,
          ts.SyntaxKind.BarBarEqualsToken,
          ts.SyntaxKind.EqualsToken,
          ts.SyntaxKind.QuestionQuestionEqualsToken,
        ].includes(node.operatorToken.kind)
      ) {
        binding = node.left;
        initializer = node.right;
      }
      if (binding !== undefined && initializer !== undefined) {
        const names = boundaryAssignmentIdentifiers(binding);
        if (names.length === 1 && ts.isIdentifier(binding))
          addAlias(binding, initializer);
        else
          collectBoundaryExecutionBindingAliases(
            binding,
            initializer,
            callableIdentifiers,
            childProcessNamespaces,
            tsxNamespaces,
            () => {
              changed = true;
            },
          );
      }
      if (
        ts.isFunctionDeclaration(node) &&
        node.name !== undefined &&
        boundaryFunctionForwardsToExecutionSink(node, {
          callableIdentifiers,
          childProcessNamespaces,
          tsxNamespaces,
        }) &&
        !callableIdentifiers.has(node.name.text)
      ) {
        callableIdentifiers.add(node.name.text);
        changed = true;
      }
      ts.forEachChild(node, collectAliases);
    };
    collectAliases(sourceFile);
  }

  return { callableIdentifiers, childProcessNamespaces, tsxNamespaces };
}

function collectBoundaryExecutionBindingAliases(
  binding: ts.BindingName | ts.Expression,
  initializer: ts.Expression,
  callableIdentifiers: Set<string>,
  childProcessNamespaces: Set<string>,
  tsxNamespaces: Set<string>,
  changed: () => void,
): void {
  const childProcessNamespace = isBoundaryExecutionModuleNamespaceExpression(
    initializer,
    boundaryChildProcessModuleNames,
    childProcessNamespaces,
  );
  const tsxNamespace = isBoundaryExecutionModuleNamespaceExpression(
    initializer,
    null,
    tsxNamespaces,
  );
  const addCallable = (name: ts.Identifier, propertyName: string): void => {
    if (
      ((childProcessNamespace &&
        boundaryChildProcessExecutionSinkNames.has(propertyName)) ||
        (tsxNamespace && boundaryTsxExecutionSinkNames.has(propertyName))) &&
      !callableIdentifiers.has(name.text)
    ) {
      callableIdentifiers.add(name.text);
      changed();
    }
  };
  if (ts.isObjectBindingPattern(binding)) {
    for (const element of binding.elements) {
      if (!ts.isIdentifier(element.name)) continue;
      if (element.dotDotDotToken !== undefined) {
        const namespaceSet = childProcessNamespace
          ? childProcessNamespaces
          : tsxNamespace
            ? tsxNamespaces
            : null;
        if (namespaceSet !== null && !namespaceSet.has(element.name.text)) {
          namespaceSet.add(element.name.text);
          changed();
        }
        continue;
      }
      addCallable(
        element.name,
        boundaryBindingPropertyName(element) ?? element.name.text,
      );
    }
  } else if (ts.isObjectLiteralExpression(binding)) {
    for (const property of binding.properties) {
      if (
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(unwrapBoundaryExpression(property.initializer))
      )
        addCallable(
          unwrapBoundaryExpression(property.initializer) as ts.Identifier,
          boundaryPropertyName(property.name) ?? "",
        );
      else if (ts.isShorthandPropertyAssignment(property))
        addCallable(property.name, property.name.text);
    }
  }
}

function boundaryBindingIdentifiers(
  binding: ts.BindingName,
): readonly ts.Identifier[] {
  if (ts.isIdentifier(binding)) return [binding];
  return binding.elements.flatMap((element) =>
    ts.isOmittedExpression(element)
      ? []
      : boundaryBindingIdentifiers(element.name),
  );
}

function boundaryAssignmentIdentifiers(
  binding: ts.BindingName | ts.Expression,
): readonly ts.Identifier[] {
  const value = ts.isExpression(binding)
    ? unwrapBoundaryExpression(binding)
    : binding;
  if (ts.isIdentifier(value)) return [value];
  if (ts.isObjectBindingPattern(value) || ts.isArrayBindingPattern(value))
    return boundaryBindingIdentifiers(value);
  if (
    ts.isPropertyAccessExpression(value) ||
    ts.isElementAccessExpression(value)
  ) {
    const receiver = unwrapBoundaryExpression(value.expression);
    return ts.isIdentifier(receiver) ? [receiver] : [];
  }
  if (ts.isObjectLiteralExpression(value))
    return value.properties.flatMap((property) => {
      if (ts.isShorthandPropertyAssignment(property)) return [property.name];
      if (!ts.isPropertyAssignment(property)) return [];
      return boundaryAssignmentIdentifiers(property.initializer);
    });
  if (ts.isArrayLiteralExpression(value))
    return value.elements.flatMap((element) =>
      ts.isSpreadElement(element)
        ? boundaryAssignmentIdentifiers(element.expression)
        : boundaryAssignmentIdentifiers(element),
    );
  return [];
}

function boundaryBindingPropertyName(
  element: ts.BindingElement,
): string | null {
  return element.propertyName === undefined
    ? null
    : boundaryPropertyName(element.propertyName);
}

function boundaryPropertyName(
  name: ts.PropertyName | ts.BindingName,
): string | null {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteralLike(name) ||
    ts.isNumericLiteral(name)
  )
    return name.text;
  if (ts.isComputedPropertyName(name))
    return staticStringValue(name.expression);
  return null;
}

function isBoundaryTsxApiModule(moduleName: string): boolean {
  return moduleName === "tsx" || moduleName.startsWith("tsx/");
}

function boundaryRuntimeModuleSpecifier(
  expression: ts.Expression,
): string | null {
  const value = unwrapBoundaryExpression(expression);
  if (!ts.isCallExpression(value)) return null;
  const callee = unwrapBoundaryExpression(value.expression);
  if (
    value.expression.kind !== ts.SyntaxKind.ImportKeyword &&
    !(ts.isIdentifier(callee) && callee.text === "require")
  )
    return null;
  return staticStringValue(value.arguments[0]);
}

function isBoundaryExecutionModuleNamespaceExpression(
  expression: ts.Expression,
  moduleNames: ReadonlySet<string> | null,
  namespaceAliases: ReadonlySet<string>,
): boolean {
  const value = unwrapBoundaryExpression(expression);
  if (ts.isIdentifier(value)) return namespaceAliases.has(value.text);
  const moduleName = boundaryRuntimeModuleSpecifier(value);
  return (
    moduleName !== null &&
    (moduleNames === null
      ? isBoundaryTsxApiModule(moduleName)
      : moduleNames.has(moduleName))
  );
}

function isBoundaryExecutionCallableExpression(
  expression: ts.Expression,
  aliases: BoundaryExecutionSinkAliases,
): boolean {
  const target = unwrapBoundaryExpression(expression);
  if (ts.isIdentifier(target))
    return aliases.callableIdentifiers.has(target.text);
  const childProcessSink = namedBoundaryPropertyAccess(
    target,
    boundaryChildProcessExecutionSinkNames,
  );
  if (
    childProcessSink !== null &&
    isBoundaryExecutionModuleNamespaceExpression(
      childProcessSink.expression,
      boundaryChildProcessModuleNames,
      aliases.childProcessNamespaces,
    )
  )
    return true;
  const tsxSink = namedBoundaryPropertyAccess(
    target,
    boundaryTsxExecutionSinkNames,
  );
  if (
    tsxSink !== null &&
    isBoundaryExecutionModuleNamespaceExpression(
      tsxSink.expression,
      null,
      aliases.tsxNamespaces,
    )
  )
    return true;
  if (ts.isCallExpression(target)) {
    const bind = namedBoundaryPropertyAccess(
      target.expression,
      new Set(["bind"]),
    );
    return (
      bind !== null &&
      isBoundaryExecutionCallableExpression(bind.expression, aliases)
    );
  }
  return false;
}

type BoundaryFunctionWithBody =
  ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression;

function isBoundaryFunctionWithBody(
  node: ts.Node,
): node is BoundaryFunctionWithBody {
  return (
    ts.isArrowFunction(node) ||
    (ts.isFunctionDeclaration(node) && node.body !== undefined) ||
    (ts.isFunctionExpression(node) && node.body !== undefined)
  );
}

function boundaryFunctionForwardsToExecutionSink(
  node: BoundaryFunctionWithBody,
  aliases: BoundaryExecutionSinkAliases,
): boolean {
  if (node.body === undefined) return false;
  const parameterNames = new Set(
    node.parameters.flatMap((parameter) =>
      boundaryBindingIdentifiers(parameter.name).map((name) => name.text),
    ),
  );
  if (parameterNames.size === 0) return false;
  let forwards = false;
  const visit = (candidate: ts.Node): void => {
    if (forwards) return;
    if (ts.isCallExpression(candidate) || ts.isNewExpression(candidate)) {
      const arguments_ = boundaryExecutionArguments(candidate, aliases);
      if (
        arguments_?.some((argument) =>
          boundaryNodeReferencesIdentifier(argument, parameterNames),
        )
      ) {
        forwards = true;
        return;
      }
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node.body);
  return forwards;
}

function boundaryNodeReferencesIdentifier(
  node: ts.Node,
  names: ReadonlySet<string>,
): boolean {
  let found = false;
  const visit = (candidate: ts.Node): void => {
    if (ts.isIdentifier(candidate) && names.has(candidate.text)) {
      found = true;
      return;
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return found;
}

function boundaryExecutionArguments(
  node: ts.CallExpression | ts.NewExpression,
  aliases: BoundaryExecutionSinkAliases,
): readonly ts.Expression[] | null {
  if (isBoundaryExecutionSink(node.expression, aliases)) {
    const arguments_ = node.arguments ?? [];
    const executable = staticStringValue(arguments_[0]);
    return executable !== null && !boundaryRuntimeLauncherCommand(executable)
      ? arguments_.slice(0, 1)
      : arguments_;
  }
  if (!ts.isCallExpression(node)) return null;
  const reflectApply = namedBoundaryPropertyAccess(
    node.expression,
    new Set(["apply"]),
  );
  if (
    reflectApply === null ||
    !ts.isIdentifier(unwrapBoundaryExpression(reflectApply.expression)) ||
    unwrapBoundaryExpression(reflectApply.expression).getText() !== "Reflect"
  )
    return null;
  const callable = node.arguments[0];
  if (
    callable === undefined ||
    !isBoundaryExecutionCallableExpression(callable, aliases)
  )
    return null;
  return node.arguments.slice(2);
}

function boundaryRuntimeLauncherCommand(command: string): boolean {
  const executable = command
    .replaceAll("\\", "/")
    .split("/")
    .at(-1)
    ?.replace(/\.(?:bat|cmd|exe)$/iu, "");
  return (
    executable !== undefined &&
    new Set([
      "bash",
      "bun",
      "cmd",
      "corepack",
      "deno",
      "node",
      "npm",
      "npx",
      "pnpm",
      "powershell",
      "pwsh",
      "python",
      "python3",
      "sh",
      "ts-node",
      "tsx",
      "yarn",
    ]).has(executable.toLowerCase())
  );
}

function boundaryNodeContainsHandoffTarget(
  node: ts.Node,
  targetBearingIdentifiers: ReadonlySet<string>,
  staticStringIdentifiers: ReadonlyMap<string, string> = new Map(),
  canReachTarget: (value: string) => boolean = staticStringCanReachHandoff,
): boolean {
  let found = false;
  const visit = (candidate: ts.Node): void => {
    if (
      (ts.isIdentifier(candidate) &&
        (targetBearingIdentifiers.has(candidate.text) ||
          canReachTarget(staticStringIdentifiers.get(candidate.text) ?? ""))) ||
      ((ts.isStringLiteralLike(candidate) ||
        ts.isBinaryExpression(candidate) ||
        ts.isCallExpression(candidate)) &&
        canReachTarget(
          ts.isExpression(candidate)
            ? (boundaryStaticStringValue(candidate, staticStringIdentifiers) ??
                "")
            : "",
        ))
    ) {
      found = true;
      return;
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return found;
}

function isBoundaryExecutionSink(
  expression: ts.Expression,
  aliases: BoundaryExecutionSinkAliases,
): boolean {
  const target = unwrapBoundaryExpression(expression);
  if (target.kind === ts.SyntaxKind.ImportKeyword) return true;
  if (isBoundaryExecutionCallableExpression(target, aliases)) return true;
  const indirectInvocation = namedBoundaryPropertyAccess(
    target,
    new Set(["apply", "call"]),
  );
  return (
    indirectInvocation !== null &&
    isBoundaryExecutionCallableExpression(
      indirectInvocation.expression,
      aliases,
    )
  );
}

function staticStringCanReachHandoff(value: string): boolean {
  const candidates = [value];
  if (hasUrlPercentEscape(value)) {
    try {
      candidates.push(decodeURIComponent(value));
    } catch {
      return true;
    }
  }
  return candidates.some((candidate) => {
    const normalized = candidate.replaceAll("\\", "/");
    return (
      normalized.includes(filingParserNormalizationHandoffModule) ||
      normalized.includes("packages/filing-parser-normalization-handoff")
    );
  });
}

function staticStringCanReachExecution(value: string): boolean {
  const candidates = [value];
  if (hasUrlPercentEscape(value)) {
    try {
      candidates.push(decodeURIComponent(value));
    } catch {
      return true;
    }
  }
  return candidates.some((candidate) => {
    const normalized = candidate.replaceAll("\\", "/");
    const commandTokens = normalized.split(/[\s"'`;&|()]+/u);
    return (
      normalized.includes(filingParserNormalizationExecutionModule) ||
      normalized.includes(filingParserNormalizationExecutionAcceptanceModule) ||
      normalized.includes("packages/filing-parser-normalization-execution") ||
      commandTokens.some((token) =>
        filingParserNormalizationExecutionRootScriptAliases.has(token),
      )
    );
  });
}

function hasUnresolvedRuntimeModuleLoad(content: string): boolean {
  const sourceFile = ts.createSourceFile(
    "boundary-source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let found = false;
  const visit = (node: ts.Node): void => {
    const callTarget = ts.isCallExpression(node)
      ? unwrapBoundaryExpression(node.expression)
      : null;
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (callTarget !== null &&
          ts.isIdentifier(callTarget) &&
          callTarget.text === "require")) &&
      staticStringValue(node.arguments[0]) === null
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function hasForbiddenDynamicCodeCapability(content: string): boolean {
  const sourceFile = ts.createSourceFile(
    "boundary-source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const forbiddenIdentifiers = new Set(["AsyncFunction", "Function", "eval"]);
  const forbiddenProperties = new Set([
    "AsyncFunction",
    "Function",
    "binding",
    "dlopen",
    "eval",
    "getBuiltinModule",
    "mainModule",
    "require",
  ]);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      namedBoundaryPropertyAccess(node, new Set(["constructor"])) !== null
    ) {
      found = true;
      return;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.name.elements.some((element) => {
        const propertyName = element.propertyName ?? element.name;
        return (
          (ts.isIdentifier(propertyName) ||
            ts.isStringLiteralLike(propertyName)) &&
          forbiddenProperties.has(propertyName.text)
        );
      })
    ) {
      found = true;
      return;
    }
    if (
      ts.isIdentifier(node) &&
      forbiddenIdentifiers.has(node.text) &&
      !isBoundaryIdentifierDeclarationOrPropertyName(node)
    ) {
      found = true;
      return;
    }
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      namedBoundaryPropertyAccess(node, forbiddenProperties) !== null
    ) {
      found = true;
      return;
    }
    if (
      ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) ||
        (ts.isExportDeclaration(node) && !node.isTypeOnly)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      ["node:vm", "vm"].includes(node.moduleSpecifier.text)
    ) {
      found = true;
      return;
    }
    if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression !== undefined &&
      ts.isStringLiteralLike(node.moduleReference.expression) &&
      ["node:vm", "vm"].includes(node.moduleReference.expression.text)
    ) {
      found = true;
      return;
    }
    if (ts.isCallExpression(node)) {
      const callee = unwrapBoundaryExpression(node.expression);
      const target = staticStringValue(node.arguments[0]);
      if (
        ["node:vm", "vm"].includes(target ?? "") &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(callee) && callee.text === "require"))
      ) {
        found = true;
        return;
      }
      const reflectGet = namedBoundaryPropertyAccess(callee, new Set(["get"]));
      if (
        reflectGet !== null &&
        ts.isIdentifier(unwrapBoundaryExpression(reflectGet.expression)) &&
        unwrapBoundaryExpression(reflectGet.expression).getText() ===
          "Reflect" &&
        forbiddenProperties.has(staticStringValue(node.arguments[1]) ?? "")
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function hasForbiddenNodeModuleCapability(content: string): boolean {
  const sourceFile = ts.createSourceFile(
    "boundary-source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let found = false;
  const capabilitySources = new Set(["globalThis", "module", "process"]);
  const reflectionReaders = new Set<string>();
  let aliasesChanged = true;
  while (aliasesChanged) {
    aliasesChanged = false;
    const collectAliases = (node: ts.Node): void => {
      let name: ts.Identifier | undefined;
      let initializer: ts.Expression | undefined;
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        name = node.name;
        initializer = node.initializer;
      } else if (
        ts.isParameter(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer !== undefined
      ) {
        name = node.name;
        initializer = node.initializer;
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left)
      ) {
        name = node.left;
        initializer = node.right;
      }
      if (name !== undefined && initializer !== undefined) {
        if (
          isBoundaryCapabilitySource(initializer, capabilitySources) &&
          !capabilitySources.has(name.text)
        ) {
          capabilitySources.add(name.text);
          aliasesChanged = true;
        }
        const value = unwrapBoundaryExpression(initializer);
        if (
          (ts.isPropertyAccessExpression(value) ||
            ts.isElementAccessExpression(value)) &&
          ts.isIdentifier(unwrapBoundaryExpression(value.expression)) &&
          ["Object", "Reflect"].includes(
            unwrapBoundaryExpression(value.expression).getText(),
          ) &&
          !reflectionReaders.has(name.text)
        ) {
          reflectionReaders.add(name.text);
          aliasesChanged = true;
        }
      }
      ts.forEachChild(node, collectAliases);
    };
    collectAliases(sourceFile);
  }
  const visit = (node: ts.Node): void => {
    if (
      (ts.isPropertyAssignment(node) &&
        isBoundaryCapabilitySource(node.initializer, capabilitySources)) ||
      (ts.isShorthandPropertyAssignment(node) &&
        capabilitySources.has(node.name.text)) ||
      (ts.isArrayLiteralExpression(node) &&
        node.elements.some(
          (element) =>
            !ts.isSpreadElement(element) &&
            isBoundaryCapabilitySource(element, capabilitySources),
        )) ||
      (ts.isReturnStatement(node) &&
        isBoundaryCapabilitySource(node.expression, capabilitySources)) ||
      (ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        !ts.isIdentifier(node.left) &&
        isBoundaryCapabilitySource(node.right, capabilitySources)) ||
      ((ts.isCallExpression(node) || ts.isNewExpression(node)) &&
        node.arguments?.some((argument) =>
          isBoundaryCapabilitySource(argument, capabilitySources),
        ))
    ) {
      found = true;
      return;
    }
    if (
      ts.isImportDeclaration(node) &&
      !node.importClause?.isTypeOnly &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      ["module", "node:module"].includes(node.moduleSpecifier.text)
    ) {
      const importClause = node.importClause;
      if (
        importClause === undefined ||
        importClause.name !== undefined ||
        importClause.namedBindings === undefined ||
        ts.isNamespaceImport(importClause.namedBindings) ||
        importClause.namedBindings.elements.some(
          (element) =>
            !element.isTypeOnly &&
            (element.propertyName ?? element.name).text !== "createRequire",
        )
      ) {
        found = true;
        return;
      }
    }
    if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      ["module", "node:module"].includes(node.moduleSpecifier.text)
    ) {
      found = true;
      return;
    }
    if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression !== undefined &&
      ts.isStringLiteralLike(node.moduleReference.expression) &&
      ["module", "node:module"].includes(node.moduleReference.expression.text)
    ) {
      found = true;
      return;
    }
    if (ts.isCallExpression(node)) {
      const callee = unwrapBoundaryExpression(node.expression);
      const target = staticStringValue(node.arguments[0]);
      const reflection =
        ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)
          ? callee
          : null;
      if (
        ((reflection !== null &&
          ts.isIdentifier(unwrapBoundaryExpression(reflection.expression)) &&
          ["Object", "Reflect"].includes(
            unwrapBoundaryExpression(reflection.expression).getText(),
          )) ||
          (ts.isIdentifier(callee) && reflectionReaders.has(callee.text))) &&
        isBoundaryCapabilitySource(node.arguments[0], capabilitySources)
      ) {
        found = true;
        return;
      }
      const getBuiltinModule = namedBoundaryPropertyAccess(
        callee,
        new Set(["getBuiltinModule"]),
      );
      if (getBuiltinModule !== null) {
        found = true;
        return;
      }
      if (
        ["module", "node:module"].includes(target ?? "") &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(callee) && callee.text === "require"))
      ) {
        found = true;
        return;
      }
    }
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      isBoundaryCapabilitySource(node.expression, capabilitySources) &&
      ((ts.isElementAccessExpression(node) &&
        staticStringValue(node.argumentExpression) === null) ||
        unwrapBoundaryExpression(node.expression).getText() === "module" ||
        (unwrapBoundaryExpression(node.expression).getText() === "process" &&
          namedBoundaryPropertyAccess(node, new Set(["mainModule"])) !==
            null) ||
        (unwrapBoundaryExpression(node.expression).getText() === "globalThis" &&
          namedBoundaryPropertyAccess(node, new Set(["module", "process"])) !==
            null))
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function isBoundaryCapabilitySource(
  expression: ts.Expression | undefined,
  capabilitySources: ReadonlySet<string>,
): boolean {
  if (expression === undefined) return false;
  const value = unwrapBoundaryExpression(expression);
  if (ts.isIdentifier(value)) return capabilitySources.has(value.text);
  return (
    (ts.isPropertyAccessExpression(value) ||
      ts.isElementAccessExpression(value)) &&
    ts.isIdentifier(unwrapBoundaryExpression(value.expression)) &&
    unwrapBoundaryExpression(value.expression).getText() === "globalThis" &&
    namedBoundaryPropertyAccess(value, new Set(["module", "process"])) !== null
  );
}

function hasIndirectRuntimeModuleLoad(content: string): boolean {
  const sourceFile = ts.createSourceFile(
    "boundary-source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const createRequireFactories = new Set<string>();
  const moduleNamespaces = new Set(["module"]);
  const runtimeLoaders = new Set(["require"]);

  const collectImports = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      ["module", "node:module"].includes(node.moduleSpecifier.text)
    ) {
      const { importClause } = node;
      if (importClause.isTypeOnly) {
        ts.forEachChild(node, collectImports);
        return;
      }
      if (importClause.name !== undefined)
        moduleNamespaces.add(importClause.name.text);
      if (importClause.namedBindings !== undefined) {
        if (ts.isNamespaceImport(importClause.namedBindings)) {
          moduleNamespaces.add(importClause.namedBindings.name.text);
        } else {
          for (const element of importClause.namedBindings.elements) {
            const importedName = (element.propertyName ?? element.name).text;
            if (!element.isTypeOnly && importedName === "createRequire")
              createRequireFactories.add(element.name.text);
          }
        }
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression !== undefined &&
      ts.isStringLiteralLike(node.moduleReference.expression) &&
      ["module", "node:module"].includes(node.moduleReference.expression.text)
    ) {
      moduleNamespaces.add(node.name.text);
    }
    ts.forEachChild(node, collectImports);
  };
  collectImports(sourceFile);

  let changed = true;
  while (changed) {
    changed = false;
    const add = (set: Set<string>, value: string): void => {
      if (!set.has(value)) {
        set.add(value);
        changed = true;
      }
    };
    const classifyBinding = (
      name: ts.BindingName,
      initializer: ts.Expression | undefined,
    ): void => {
      if (initializer === undefined) return;
      if (ts.isIdentifier(name)) {
        if (isNodeModuleNamespaceExpression(initializer, moduleNamespaces))
          add(moduleNamespaces, name.text);
        if (
          isCreateRequireFactoryExpression(
            initializer,
            createRequireFactories,
            moduleNamespaces,
          )
        )
          add(createRequireFactories, name.text);
        if (
          isRuntimeLoaderExpression(
            initializer,
            runtimeLoaders,
            createRequireFactories,
            moduleNamespaces,
          )
        )
          add(runtimeLoaders, name.text);
        return;
      }
      if (
        !ts.isObjectBindingPattern(name) ||
        !isNodeModuleNamespaceExpression(initializer, moduleNamespaces)
      )
        return;
      for (const element of name.elements) {
        if (!ts.isIdentifier(element.name)) continue;
        const propertyName = element.propertyName ?? element.name;
        const exportedName =
          ts.isIdentifier(propertyName) || ts.isStringLiteralLike(propertyName)
            ? propertyName.text
            : null;
        if (exportedName === "createRequire")
          add(createRequireFactories, element.name.text);
        if (exportedName === "require") add(runtimeLoaders, element.name.text);
      }
    };
    const collectAliases = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node)) {
        classifyBinding(node.name, node.initializer);
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left)
      ) {
        classifyBinding(node.left, node.right);
      }
      ts.forEachChild(node, collectAliases);
    };
    collectAliases(sourceFile);
  }

  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      (isIndirectRuntimeLoaderInvocation(
        node,
        runtimeLoaders,
        createRequireFactories,
        moduleNamespaces,
      ) ||
        isRuntimeModuleLoaderEscape(
          node,
          runtimeLoaders,
          createRequireFactories,
          moduleNamespaces,
        ))
    ) {
      found = true;
      return;
    }
    if (
      !ts.isCallExpression(node) &&
      isRuntimeModuleLoaderEscape(
        node,
        runtimeLoaders,
        createRequireFactories,
        moduleNamespaces,
      )
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function isRuntimeModuleLoaderEscape(
  node: ts.Node,
  runtimeLoaders: ReadonlySet<string>,
  createRequireFactories: ReadonlySet<string>,
  moduleNamespaces: ReadonlySet<string>,
): boolean {
  if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
    const sourceModule =
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : null;
    if (["module", "node:module"].includes(sourceModule ?? "")) {
      if (
        node.exportClause === undefined ||
        ts.isNamespaceExport(node.exportClause)
      )
        return true;
      if (
        node.exportClause.elements.some(
          (element) =>
            !element.isTypeOnly &&
            ["createRequire", "default"].includes(
              (element.propertyName ?? element.name).text,
            ),
        )
      )
        return true;
    }
    if (
      node.exportClause !== undefined &&
      ts.isNamedExports(node.exportClause) &&
      node.exportClause.elements.some((element) => {
        if (element.isTypeOnly) return false;
        const localName = (element.propertyName ?? element.name).text;
        return (
          runtimeLoaders.has(localName) ||
          createRequireFactories.has(localName) ||
          moduleNamespaces.has(localName)
        );
      })
    )
      return true;
  }
  if (ts.isExportAssignment(node))
    return (
      isRuntimeLoaderExpression(
        node.expression,
        runtimeLoaders,
        createRequireFactories,
        moduleNamespaces,
      ) ||
      isCreateRequireFactoryExpression(
        node.expression,
        createRequireFactories,
        moduleNamespaces,
      ) ||
      isNodeModuleNamespaceExpression(node.expression, moduleNamespaces)
    );
  if (
    ts.isVariableDeclaration(node) &&
    ts.isObjectBindingPattern(node.name) &&
    node.initializer !== undefined &&
    isNodeModuleNamespaceExpression(node.initializer, moduleNamespaces)
  ) {
    for (const element of node.name.elements) {
      const propertyName = element.propertyName ?? element.name;
      if (
        (ts.isIdentifier(propertyName) ||
          ts.isStringLiteralLike(propertyName)) &&
        ["createRequire", "require"].includes(propertyName.text)
      )
        return true;
    }
  }
  if (ts.isIdentifier(node)) {
    if (isBoundaryIdentifierDeclarationOrPropertyName(node)) return false;
    if (createRequireFactories.has(node.text))
      return !isImmediatelyInvokedBoundaryExpression(node);
    if (runtimeLoaders.has(node.text))
      return (
        !isImmediatelyInvokedBoundaryExpression(node) &&
        !isImmediatelyInvokedBoundaryPropertyReceiver(
          node,
          new Set(["resolve"]),
        )
      );
    if (node.text !== "module" && moduleNamespaces.has(node.text))
      return !isImmediatelyInvokedBoundaryPropertyReceiver(
        node,
        new Set(["createRequire"]),
      );
    return false;
  }
  if (
    (ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)) &&
    isModuleRequireExpression(node, moduleNamespaces)
  )
    return (
      !isImmediatelyInvokedBoundaryExpression(node) &&
      !isImmediatelyInvokedBoundaryPropertyReceiver(node, new Set(["resolve"]))
    );
  if (
    (ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)) &&
    isCreateRequireFactoryExpression(
      node,
      createRequireFactories,
      moduleNamespaces,
    )
  )
    return !isImmediatelyInvokedBoundaryExpression(node);
  if (
    ts.isCallExpression(node) &&
    isCreateRequireInvocation(node, createRequireFactories, moduleNamespaces)
  )
    return (
      !isImmediatelyInvokedBoundaryExpression(node) &&
      !isImmediatelyInvokedBoundaryPropertyReceiver(node, new Set(["resolve"]))
    );
  if (
    ts.isCallExpression(node) &&
    isNodeModuleNamespaceExpression(node, moduleNamespaces)
  )
    return !isImmediatelyInvokedBoundaryPropertyReceiver(
      node,
      new Set(["createRequire"]),
    );
  return false;
}

function isBoundaryIdentifierDeclarationOrPropertyName(
  node: ts.Identifier,
): boolean {
  const { parent } = node;
  if (ts.isShorthandPropertyAssignment(parent)) return false;
  if (
    ts.isImportSpecifier(parent) &&
    (parent.name === node || parent.propertyName === node)
  )
    return true;
  if (ts.isExportSpecifier(parent)) return true;
  return (parent as ts.NamedDeclaration).name === node;
}

function isImmediatelyInvokedBoundaryExpression(
  expression: ts.Expression,
): boolean {
  const outerExpression = outermostBoundaryExpression(expression);
  return (
    ts.isCallExpression(outerExpression.parent) &&
    outerExpression.parent.expression === outerExpression
  );
}

function isImmediatelyInvokedBoundaryPropertyReceiver(
  expression: ts.Expression,
  names: ReadonlySet<string>,
): boolean {
  const outerExpression = outermostBoundaryExpression(expression);
  const propertyAccess =
    (ts.isPropertyAccessExpression(outerExpression.parent) ||
      ts.isElementAccessExpression(outerExpression.parent)) &&
    outerExpression.parent.expression === outerExpression
      ? namedBoundaryPropertyAccess(outerExpression.parent, names)
      : null;
  return (
    propertyAccess !== null &&
    isImmediatelyInvokedBoundaryExpression(propertyAccess)
  );
}

function outermostBoundaryExpression(expression: ts.Expression): ts.Expression {
  let value = expression;
  while (
    (ts.isParenthesizedExpression(value.parent) ||
      ts.isAsExpression(value.parent) ||
      ts.isTypeAssertionExpression(value.parent) ||
      ts.isNonNullExpression(value.parent) ||
      ts.isSatisfiesExpression(value.parent) ||
      ts.isAwaitExpression(value.parent)) &&
    value.parent.expression === value
  )
    value = value.parent;
  return value;
}

function isIndirectRuntimeLoaderInvocation(
  node: ts.CallExpression,
  runtimeLoaders: ReadonlySet<string>,
  createRequireFactories: ReadonlySet<string>,
  moduleNamespaces: ReadonlySet<string>,
): boolean {
  const callee = unwrapBoundaryExpression(node.expression);
  if (ts.isIdentifier(callee))
    return callee.text !== "require" && runtimeLoaders.has(callee.text);
  if (isModuleRequireExpression(callee, moduleNamespaces)) return true;
  if (
    ts.isCallExpression(callee) &&
    isCreateRequireInvocation(callee, createRequireFactories, moduleNamespaces)
  )
    return true;
  if (
    namedBoundaryPropertyAccess(callee, new Set(["apply", "call"])) !== null &&
    isRuntimeLoaderExpression(
      namedBoundaryPropertyAccess(callee, new Set(["apply", "call"]))
        ?.expression,
      runtimeLoaders,
      createRequireFactories,
      moduleNamespaces,
    )
  )
    return true;
  const reflectApply = namedBoundaryPropertyAccess(callee, new Set(["apply"]));
  return (
    reflectApply !== null &&
    ts.isIdentifier(unwrapBoundaryExpression(reflectApply.expression)) &&
    unwrapBoundaryExpression(reflectApply.expression).getText() === "Reflect" &&
    isRuntimeLoaderExpression(
      node.arguments[0],
      runtimeLoaders,
      createRequireFactories,
      moduleNamespaces,
    )
  );
}

function isRuntimeLoaderExpression(
  expression: ts.Expression | undefined,
  runtimeLoaders: ReadonlySet<string>,
  createRequireFactories: ReadonlySet<string>,
  moduleNamespaces: ReadonlySet<string>,
): boolean {
  if (expression === undefined) return false;
  const value = unwrapBoundaryExpression(expression);
  if (ts.isIdentifier(value)) return runtimeLoaders.has(value.text);
  if (isModuleRequireExpression(value, moduleNamespaces)) return true;
  if (
    ts.isCallExpression(value) &&
    isCreateRequireInvocation(value, createRequireFactories, moduleNamespaces)
  )
    return true;
  const bind =
    ts.isCallExpression(value) &&
    namedBoundaryPropertyAccess(value.expression, new Set(["bind"]));
  return (
    bind !== false &&
    bind !== null &&
    isRuntimeLoaderExpression(
      bind.expression,
      runtimeLoaders,
      createRequireFactories,
      moduleNamespaces,
    )
  );
}

function isCreateRequireInvocation(
  expression: ts.CallExpression,
  createRequireFactories: ReadonlySet<string>,
  moduleNamespaces: ReadonlySet<string>,
): boolean {
  return isCreateRequireFactoryExpression(
    expression.expression,
    createRequireFactories,
    moduleNamespaces,
  );
}

function isCreateRequireFactoryExpression(
  expression: ts.Expression,
  createRequireFactories: ReadonlySet<string>,
  moduleNamespaces: ReadonlySet<string>,
): boolean {
  const value = unwrapBoundaryExpression(expression);
  if (ts.isIdentifier(value)) return createRequireFactories.has(value.text);
  const createRequire = namedBoundaryPropertyAccess(
    value,
    new Set(["createRequire"]),
  );
  return (
    createRequire !== null &&
    isNodeModuleNamespaceExpression(createRequire.expression, moduleNamespaces)
  );
}

function isModuleRequireExpression(
  expression: ts.Expression,
  moduleNamespaces: ReadonlySet<string>,
): boolean {
  const value = unwrapBoundaryExpression(expression);
  const moduleRequire = namedBoundaryPropertyAccess(
    value,
    new Set(["require"]),
  );
  return (
    moduleRequire !== null &&
    isNodeModuleNamespaceExpression(moduleRequire.expression, moduleNamespaces)
  );
}

function isNodeModuleNamespaceExpression(
  expression: ts.Expression,
  moduleNamespaces: ReadonlySet<string>,
): boolean {
  const value = unwrapBoundaryExpression(expression);
  if (ts.isIdentifier(value)) return moduleNamespaces.has(value.text);
  const getBuiltinModule =
    ts.isCallExpression(value) &&
    namedBoundaryPropertyAccess(
      value.expression,
      new Set(["getBuiltinModule"]),
    );
  return (
    ts.isCallExpression(value) &&
    ((value.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ["module", "node:module"].includes(
        staticStringValue(value.arguments[0]) ?? "",
      )) ||
      (ts.isIdentifier(value.expression) &&
        value.expression.text === "require" &&
        ["module", "node:module"].includes(
          staticStringValue(value.arguments[0]) ?? "",
        )) ||
      (getBuiltinModule !== false &&
        getBuiltinModule !== null &&
        ts.isIdentifier(
          unwrapBoundaryExpression(getBuiltinModule.expression),
        ) &&
        unwrapBoundaryExpression(getBuiltinModule.expression).getText() ===
          "process" &&
        ["module", "node:module"].includes(
          staticStringValue(value.arguments[0]) ?? "",
        )))
  );
}

function namedBoundaryPropertyAccess(
  expression: ts.Expression,
  names: ReadonlySet<string>,
): ts.PropertyAccessExpression | ts.ElementAccessExpression | null {
  const value = unwrapBoundaryExpression(expression);
  if (ts.isPropertyAccessExpression(value))
    return names.has(value.name.text) ? value : null;
  if (
    ts.isElementAccessExpression(value) &&
    names.has(staticStringValue(value.argumentExpression) ?? "")
  )
    return value;
  return null;
}

function unwrapBoundaryExpression(expression: ts.Expression): ts.Expression {
  let value = expression;
  while (
    ts.isParenthesizedExpression(value) ||
    ts.isAsExpression(value) ||
    ts.isTypeAssertionExpression(value) ||
    ts.isNonNullExpression(value) ||
    ts.isSatisfiesExpression(value) ||
    ts.isAwaitExpression(value)
  )
    value = value.expression;
  return value;
}

function collectModuleSpecifiers(content: string): string[] {
  const sourceFile = ts.createSourceFile(
    "boundary-source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const specifiers: string[] = [
    ...sourceFile.referencedFiles.map((reference) => reference.fileName),
    ...sourceFile.typeReferenceDirectives.map(
      (reference) => reference.fileName,
    ),
    ...sourceFile.amdDependencies.map((dependency) => dependency.path),
  ];

  const visit = (node: ts.Node): void => {
    const callTarget = ts.isCallExpression(node)
      ? unwrapBoundaryExpression(node.expression)
      : null;
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      specifiers.push(node.moduleReference.expression.text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (callTarget !== null &&
          ts.isIdentifier(callTarget) &&
          callTarget.text === "require"))
    ) {
      const specifier = staticStringValue(node.arguments[0]);
      if (specifier !== null) specifiers.push(specifier);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

function staticStringValue(node: ts.Expression | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isParenthesizedExpression(node))
    return staticStringValue(node.expression);
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticStringValue(node.left);
    const right = staticStringValue(node.right);
    return left === null || right === null ? null : left + right;
  }
  if (
    ts.isCallExpression(node) &&
    node.arguments.length <= 1 &&
    namedBoundaryPropertyAccess(node.expression, new Set(["join"])) !== null
  ) {
    const joinAccess = namedBoundaryPropertyAccess(
      node.expression,
      new Set(["join"]),
    );
    const receiver =
      joinAccess === null
        ? null
        : unwrapBoundaryExpression(joinAccess.expression);
    const separator =
      node.arguments.length === 0 ? "," : staticStringValue(node.arguments[0]);
    if (
      receiver !== null &&
      ts.isArrayLiteralExpression(receiver) &&
      separator !== null
    ) {
      const values = staticArrayJoinValues(receiver);
      if (values !== null) return values.join(separator);
    }
  }
  return null;
}

function staticArrayJoinValues(
  array: ts.ArrayLiteralExpression,
  depth = 0,
): string[] | null {
  if (depth > 16) return null;
  const values: string[] = [];
  for (const element of array.elements) {
    if (values.length >= 64) return null;
    if (ts.isOmittedExpression(element)) {
      values.push("");
      continue;
    }
    if (ts.isSpreadElement(element)) {
      const spread = unwrapBoundaryExpression(element.expression);
      if (!ts.isArrayLiteralExpression(spread)) return null;
      const spreadValues = staticArrayJoinValues(spread, depth + 1);
      if (spreadValues === null || values.length + spreadValues.length > 64)
        return null;
      values.push(...spreadValues);
      continue;
    }
    const value = unwrapBoundaryExpression(element);
    if (
      (ts.isIdentifier(value) && value.text === "undefined") ||
      value.kind === ts.SyntaxKind.NullKeyword ||
      ts.isVoidExpression(value)
    ) {
      values.push("");
      continue;
    }
    const staticValue = staticStringValue(value);
    if (staticValue === null) return null;
    values.push(staticValue);
  }
  return values;
}

function recordKeys(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDockerfileName(fileName: string): boolean {
  return /^dockerfile(?:[.-].+)?$/i.test(fileName);
}

interface ExplicitTypeScriptConfigCommandContext {
  command: string;
  label: string;
  modelRuntimeDirectoryChanges: boolean;
  resolutionBase: string;
  selectorPreamble: string;
}

interface GitHubWorkflowYamlEntry {
  indent: number;
  key: string;
  keyIndent: number;
  lineIndex: number;
  sequence: boolean;
  value: string;
}

function environmentFileResolutionContextKey(
  canonicalEnvironmentPath: string,
  resolutionBase: string,
): string {
  const canonicalizedEnvironmentPath = resolvePath(canonicalEnvironmentPath);
  const canonicalizedResolutionBase = resolvePath(resolutionBase);
  const key = `${canonicalizedEnvironmentPath}\0${canonicalizedResolutionBase}`;
  return process.platform === "win32" ? key.toLowerCase() : key;
}

function isGitHubWorkflowPath(path: string): boolean {
  const relativePath = relative(root, path).replaceAll("\\", "/");
  return (
    relativePath.startsWith(".github/workflows/") &&
    [".yaml", ".yml"].includes(extname(relativePath).toLowerCase())
  );
}

interface RuntimeCommandSegment {
  command: string;
  separatorAfter: "&" | "&&" | ";" | "newline" | "pipe" | "||" | null;
}

interface RuntimeDirectoryChange {
  directory: string;
  supportsSingleAmpersand: boolean;
}

function explicitTypeScriptConfigCommandSelection(
  context: ExplicitTypeScriptConfigCommandContext,
): ReturnType<typeof explicitTypeScriptConfigSelection> {
  return explicitTypeScriptConfigSelection(
    [context.selectorPreamble, context.command]
      .filter((value) => value.length > 0)
      .join("\n"),
  );
}

function runtimeDirectoryCommandContexts(
  context: ExplicitTypeScriptConfigCommandContext,
): {
  contexts: ExplicitTypeScriptConfigCommandContext[];
  invalid: boolean;
} {
  if (!context.modelRuntimeDirectoryChanges)
    return { contexts: [context], invalid: false };
  const completeSelection = explicitTypeScriptConfigCommandSelection(context);
  const hasSelectors =
    completeSelection.invalid ||
    completeSelection.specifiers.length > 0 ||
    completeSelection.environmentFiles.length > 0;
  const segments = splitRuntimeCommandSegments(context.command);
  const contexts: ExplicitTypeScriptConfigCommandContext[] = [];
  let resolutionBase = context.resolutionBase;
  for (const segment of segments) {
    const directoryChange = runtimeDirectoryChange(segment.command);
    if (directoryChange !== null) {
      if (
        segment.separatorAfter === "pipe" ||
        segment.separatorAfter === "||" ||
        (segment.separatorAfter === "&" &&
          !directoryChange.supportsSingleAmpersand)
      )
        return { contexts: [], invalid: hasSelectors };
      const nextResolutionBase = runtimeDirectoryResolutionBase(
        resolutionBase,
        directoryChange.directory,
      );
      if (nextResolutionBase === null)
        return { contexts: [], invalid: hasSelectors };
      resolutionBase = nextResolutionBase;
      continue;
    }
    if (hasRuntimeDirectoryChangeIntent(segment.command))
      return { contexts: [], invalid: hasSelectors };
    const selectedContext: ExplicitTypeScriptConfigCommandContext = {
      command: segment.command,
      label: context.label,
      modelRuntimeDirectoryChanges: false,
      resolutionBase,
      selectorPreamble: context.selectorPreamble,
    };
    const selection = explicitTypeScriptConfigCommandSelection(selectedContext);
    if (
      selection.invalid ||
      selection.specifiers.length > 0 ||
      selection.environmentFiles.length > 0
    )
      contexts.push(selectedContext);
  }
  return { contexts, invalid: false };
}

function splitRuntimeCommandSegments(command: string): RuntimeCommandSegment[] {
  const segments: RuntimeCommandSegment[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  const push = (
    separatorAfter: RuntimeCommandSegment["separatorAfter"],
  ): void => {
    if (current.trim().length > 0)
      segments.push({ command: current.trim(), separatorAfter });
    current = "";
  };
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index] ?? "";
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (quote !== null) {
      current += character;
      if (character === "\\" || (quote === '"' && character === "`")) {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      current += character;
      continue;
    }
    const nextCharacter = command[index + 1] ?? "";
    if (character === "&") {
      if (nextCharacter === "&") index += 1;
      push(nextCharacter === "&" ? "&&" : "&");
      continue;
    }
    if (character === "|") {
      if (nextCharacter === "|") index += 1;
      push(nextCharacter === "|" ? "||" : "pipe");
      continue;
    }
    if (character === ";") {
      push(";");
      continue;
    }
    if (character === "\r" || character === "\n") {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      push("newline");
      continue;
    }
    current += character;
  }
  push(null);
  return segments;
}

function runtimeDirectoryChange(
  command: string,
): RuntimeDirectoryChange | null {
  const value = command.trim().replace(/^@/u, "");
  const cmdMatch = /^(cd|chdir)\s+(?:(\/d)\s+)?(.+)$/iu.exec(value);
  if (cmdMatch !== null) {
    const directory = literalRuntimeDirectory(cmdMatch[3] ?? "");
    if (directory === null) return null;
    return {
      directory,
      supportsSingleAmpersand:
        cmdMatch[1]?.toLowerCase() === "chdir" || cmdMatch[2] !== undefined,
    };
  }
  const powershellMatch =
    /^(?:set-location|sl)\s+(?:(?:-literalpath|-path)\s+)?(.+)$/iu.exec(value);
  if (powershellMatch === null) return null;
  const directory = literalRuntimeDirectory(powershellMatch[1] ?? "");
  return directory === null
    ? null
    : { directory, supportsSingleAmpersand: false };
}

function literalRuntimeDirectory(argument: string): string | null {
  const value = argument.replace(/\s+#.*$/u, "").trim();
  if (value.length === 0) return null;
  let directory = value;
  if (value.startsWith('"') || value.startsWith("'")) {
    const quote = value[0];
    if (value.at(-1) !== quote) return null;
    directory = value.slice(1, -1);
    if (quote === "'") directory = directory.replaceAll("''", "'");
  } else if (/\s/u.test(value)) {
    return null;
  }
  if (
    directory.length === 0 ||
    directory === "-" ||
    directory.startsWith("~") ||
    /[$%`!*?]/u.test(directory)
  )
    return null;
  return directory;
}

function runtimeDirectoryResolutionBase(
  resolutionBase: string,
  directory: string,
): string | null {
  if (isAbsolute(directory) || /^(?:[A-Za-z]:[\\/]|[\\/]{2})/u.test(directory))
    return null;
  const portableDirectory = directory.replace(/[\\/]/gu, sep);
  const nextResolutionBase = resolvePath(resolutionBase, portableDirectory);
  return isPathWithinRoot(root, nextResolutionBase) ? nextResolutionBase : null;
}

function hasRuntimeDirectoryChangeIntent(command: string): boolean {
  const value = command.trim().replace(/^@/u, "");
  return (
    /(?:^|[({:]|\b(?:call|command|do|if|then)\s+)(?:cd|chdir|set-location|sl|pushd|push-location|popd|pop-location)\b/iu.test(
      value,
    ) ||
    /\bprocess\s*\.\s*chdir\s*\(/iu.test(value) ||
    /\b(?:bash|cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh(?:\.exe)?|sh)\b[\s\S]*\b(?:cd|chdir|set-location|sl)\b/iu.test(
      value,
    )
  );
}

function githubWorkflowCommandContexts(
  sourcePath: string,
  content: string,
): {
  commands: ExplicitTypeScriptConfigCommandContext[];
  violations: string[];
} {
  const label = boundaryRelativePath(sourcePath);
  const commands: ExplicitTypeScriptConfigCommandContext[] = [];
  const workflowViolations: string[] = [];
  const rawLines = content.split(/\r?\n/u);
  if (rawLines.some((line) => /^\t+/u.test(line))) {
    return {
      commands,
      violations: [
        `${label}: GitHub workflow indentation must use spaces while discovering TypeScript config selectors`,
      ],
    };
  }
  const entries = githubWorkflowYamlEntries(rawLines);
  const topLevelEntries = entries.filter(
    (entry) => !entry.sequence && entry.keyIndent === 0,
  );
  const jobsEntry = topLevelEntries.find((entry) => entry.key === "jobs");
  const rawSelection = explicitTypeScriptConfigSelection(content);
  if (jobsEntry === undefined) {
    if (
      rawSelection.invalid ||
      rawSelection.specifiers.length > 0 ||
      rawSelection.environmentFiles.length > 0
    )
      workflowViolations.push(
        `${label}: GitHub workflow TypeScript config selectors must belong to a run step`,
      );
    return { commands, violations: workflowViolations };
  }

  const topDefaults = topLevelEntries.find((entry) => entry.key === "defaults");
  const topEnvironment = topLevelEntries.find((entry) => entry.key === "env");
  const topWorkingDirectory = githubWorkflowDefaultWorkingDirectory(
    entries,
    rawLines,
    topDefaults,
  );
  const topEnvironmentText = githubWorkflowEntryBlockText(
    entries,
    rawLines,
    topEnvironment,
  );
  const jobsEnd = githubWorkflowEntryEnd(entries, jobsEntry, rawLines.length);
  const jobs = githubWorkflowDirectMappingChildren(entries, jobsEntry, jobsEnd);
  for (const job of jobs) {
    const jobEnd = githubWorkflowEntryEnd(entries, job, jobsEnd);
    const jobChildren = githubWorkflowDirectMappingChildren(
      entries,
      job,
      jobEnd,
    );
    const jobDefaults = jobChildren.find((entry) => entry.key === "defaults");
    const jobEnvironment = jobChildren.find((entry) => entry.key === "env");
    const stepsEntry = jobChildren.find((entry) => entry.key === "steps");
    if (stepsEntry === undefined) continue;
    const jobWorkingDirectory = githubWorkflowDefaultWorkingDirectory(
      entries,
      rawLines,
      jobDefaults,
    );
    const jobEnvironmentText = githubWorkflowEntryBlockText(
      entries,
      rawLines,
      jobEnvironment,
    );
    const stepsEnd = githubWorkflowEntryEnd(entries, stepsEntry, jobEnd);
    const stepStarts = entries.filter(
      (entry) =>
        entry.sequence &&
        entry.lineIndex > stepsEntry.lineIndex &&
        entry.lineIndex < stepsEnd,
    );
    const stepIndent = Math.min(
      ...stepStarts.map((entry) => entry.indent),
      Number.POSITIVE_INFINITY,
    );
    const steps = stepStarts.filter((entry) => entry.indent === stepIndent);
    for (const [stepIndex, step] of steps.entries()) {
      const nextStep = steps[stepIndex + 1];
      const stepEnd = nextStep?.lineIndex ?? stepsEnd;
      const stepEntries = entries.filter(
        (entry) =>
          entry.lineIndex >= step.lineIndex &&
          entry.lineIndex < stepEnd &&
          entry.keyIndent === step.keyIndent,
      );
      const runEntry = stepEntries.find((entry) => entry.key === "run");
      if (runEntry === undefined) continue;
      const stepEnvironment = stepEntries.find((entry) => entry.key === "env");
      const stepWorkingDirectory = stepEntries.find(
        (entry) => entry.key === "working-directory",
      );
      const runCommand = githubWorkflowScalarValue(entries, rawLines, runEntry);
      if (runCommand === null || runCommand === undefined) {
        workflowViolations.push(
          `${label}: job ${JSON.stringify(job.key)} run step ${stepIndex + 1} must use a literal command while discovering TypeScript config selectors`,
        );
        continue;
      }
      const selectorPreamble = [
        topEnvironmentText,
        jobEnvironmentText,
        githubWorkflowEntryBlockText(entries, rawLines, stepEnvironment),
      ]
        .filter((value) => value.length > 0)
        .join("\n");
      const selection = explicitTypeScriptConfigSelection(
        [selectorPreamble, runCommand]
          .filter((value) => value.length > 0)
          .join("\n"),
      );
      const selectedWorkingDirectory =
        stepWorkingDirectory !== undefined
          ? githubWorkflowScalarValue(entries, rawLines, stepWorkingDirectory)
          : jobWorkingDirectory !== undefined
            ? jobWorkingDirectory
            : topWorkingDirectory !== undefined
              ? topWorkingDirectory
              : ".";
      const resolutionBase = githubWorkflowResolutionBase(
        selectedWorkingDirectory,
      );
      if (resolutionBase === null) {
        if (
          selection.invalid ||
          selection.specifiers.length > 0 ||
          selection.environmentFiles.length > 0
        )
          workflowViolations.push(
            `${label}: job ${JSON.stringify(job.key)} run step ${stepIndex + 1} must use a literal repository-local working-directory when selecting TypeScript configuration`,
          );
        continue;
      }
      commands.push({
        command: runCommand,
        label: `${label} (job ${job.key}, run step ${stepIndex + 1})`,
        modelRuntimeDirectoryChanges: true,
        resolutionBase,
        selectorPreamble,
      });
    }
  }

  const coveredSpecifiers = new Set<string>();
  const coveredEnvironmentFiles = new Set<string>();
  let coveredSelectionInvalid = false;
  for (const context of commands) {
    const selection = explicitTypeScriptConfigCommandSelection(context);
    coveredSelectionInvalid ||= selection.invalid;
    for (const specifier of selection.specifiers)
      coveredSpecifiers.add(specifier);
    for (const environmentFile of selection.environmentFiles)
      coveredEnvironmentFiles.add(environmentFile);
  }
  if (
    (rawSelection.invalid && !coveredSelectionInvalid) ||
    rawSelection.specifiers.some(
      (specifier) => !coveredSpecifiers.has(specifier),
    ) ||
    rawSelection.environmentFiles.some(
      (specifier) => !coveredEnvironmentFiles.has(specifier),
    )
  )
    workflowViolations.push(
      `${label}: GitHub workflow TypeScript config selectors must belong to supported run or env mappings`,
    );
  return { commands, violations: workflowViolations };
}

function githubWorkflowYamlEntries(
  rawLines: readonly string[],
): GitHubWorkflowYamlEntry[] {
  const entries: GitHubWorkflowYamlEntry[] = [];
  for (const [lineIndex, rawLine] of rawLines.entries()) {
    const match = /^( *)(-\s+)?([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/u.exec(
      rawLine,
    );
    if (match === null) continue;
    const indentation = match[1]?.length ?? 0;
    const sequence = match[2] !== undefined;
    entries.push({
      indent: indentation,
      key: match[3] ?? "",
      keyIndent: indentation + (sequence ? 2 : 0),
      lineIndex,
      sequence,
      value: match[4] ?? "",
    });
  }
  return entries;
}

function githubWorkflowEntryEnd(
  entries: readonly GitHubWorkflowYamlEntry[],
  entry: GitHubWorkflowYamlEntry,
  fallbackEnd: number,
): number {
  return (
    entries.find(
      (candidate) =>
        candidate.lineIndex > entry.lineIndex &&
        candidate.keyIndent <= entry.keyIndent,
    )?.lineIndex ?? fallbackEnd
  );
}

function githubWorkflowDirectMappingChildren(
  entries: readonly GitHubWorkflowYamlEntry[],
  parent: GitHubWorkflowYamlEntry,
  parentEnd: number,
): GitHubWorkflowYamlEntry[] {
  const descendants = entries.filter(
    (entry) =>
      !entry.sequence &&
      entry.lineIndex > parent.lineIndex &&
      entry.lineIndex < parentEnd &&
      entry.keyIndent > parent.keyIndent,
  );
  const directIndent = Math.min(
    ...descendants.map((entry) => entry.keyIndent),
    Number.POSITIVE_INFINITY,
  );
  return descendants.filter((entry) => entry.keyIndent === directIndent);
}

function githubWorkflowDefaultWorkingDirectory(
  entries: readonly GitHubWorkflowYamlEntry[],
  rawLines: readonly string[],
  defaultsEntry: GitHubWorkflowYamlEntry | undefined,
): string | null | undefined {
  if (defaultsEntry === undefined) return undefined;
  const defaultsEnd = githubWorkflowEntryEnd(
    entries,
    defaultsEntry,
    rawLines.length,
  );
  const runEntry = githubWorkflowDirectMappingChildren(
    entries,
    defaultsEntry,
    defaultsEnd,
  ).find((entry) => entry.key === "run");
  if (runEntry === undefined) return undefined;
  const runEnd = githubWorkflowEntryEnd(entries, runEntry, defaultsEnd);
  const workingDirectoryEntry = githubWorkflowDirectMappingChildren(
    entries,
    runEntry,
    runEnd,
  ).find((entry) => entry.key === "working-directory");
  if (workingDirectoryEntry === undefined) return undefined;
  return githubWorkflowScalarValue(entries, rawLines, workingDirectoryEntry);
}

function githubWorkflowEntryBlockText(
  entries: readonly GitHubWorkflowYamlEntry[],
  rawLines: readonly string[],
  entry: GitHubWorkflowYamlEntry | undefined,
): string {
  if (entry === undefined) return "";
  const end = githubWorkflowEntryEnd(entries, entry, rawLines.length);
  return rawLines.slice(entry.lineIndex, end).join("\n");
}

function githubWorkflowScalarValue(
  entries: readonly GitHubWorkflowYamlEntry[],
  rawLines: readonly string[],
  entry: GitHubWorkflowYamlEntry | undefined,
): string | null | undefined {
  if (entry === undefined) return undefined;
  const value = entry.value.trim();
  if (/^[|>][+-]?$/u.test(value)) {
    const end = githubWorkflowEntryEnd(entries, entry, rawLines.length);
    const body = rawLines.slice(entry.lineIndex + 1, end);
    const contentIndents = body
      .filter((line) => line.trim().length > 0)
      .map((line) => /^ */u.exec(line)?.[0].length ?? 0);
    const contentIndent = Math.min(...contentIndents, Number.POSITIVE_INFINITY);
    if (!Number.isFinite(contentIndent) || contentIndent <= entry.keyIndent)
      return null;
    return body
      .map((line) => line.slice(Math.min(contentIndent, line.length)))
      .join(value.startsWith(">") ? " " : "\n");
  }
  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === "string" ? parsed : null;
    } catch {
      return null;
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'")) return null;
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value.replace(/\s+#.*$/u, "").trim();
}

function githubWorkflowResolutionBase(
  workingDirectory: string | null | undefined,
): string | null {
  if (
    workingDirectory === null ||
    workingDirectory === undefined ||
    workingDirectory.length === 0 ||
    isAbsolute(workingDirectory) ||
    /^(?:[A-Za-z]:[\\/]|[\\/]{2})/u.test(workingDirectory) ||
    /[$%`]/u.test(workingDirectory)
  )
    return null;
  const resolutionBase = resolvePath(root, workingDirectory);
  return isPathWithinRoot(root, resolutionBase) ? resolutionBase : null;
}

async function discoverExplicitTypeScriptConfigFiles(
  candidateFiles: ReadonlySet<string>,
): Promise<{ files: Set<string>; violations: string[] }> {
  const files = new Set<string>();
  const discoveryViolations: string[] = [];
  const canonicalRoot = await realpath(root);
  const visitedEnvironmentResolutionContexts = new Set<string>();
  for (const sourcePath of [...candidateFiles].sort()) {
    let boundedSource: Awaited<ReturnType<typeof readBoundedUtf8File>>;
    try {
      boundedSource = await readBoundedUtf8File(
        sourcePath,
        MAX_TYPESCRIPT_CONFIG_BYTES,
      );
    } catch (error) {
      discoveryViolations.push(
        `${boundaryRelativePath(sourcePath)}: command surface must remain readable while discovering TypeScript config selectors (${boundaryErrorCode(error)})`,
      );
      continue;
    }
    if (!boundedSource.ok) {
      discoveryViolations.push(
        `${boundaryRelativePath(sourcePath)}: command surface must remain a bounded regular file while discovering TypeScript config selectors`,
      );
      continue;
    }
    const isPackageManifest =
      basename(sourcePath).toLowerCase() === "package.json";
    let commandContexts: ExplicitTypeScriptConfigCommandContext[] = [];
    if (isPackageManifest) {
      let manifest: unknown;
      try {
        manifest = JSON.parse(boundedSource.content) as unknown;
      } catch {
        continue;
      }
      if (!isRecord(manifest) || !isRecord(manifest.scripts)) continue;
      for (const command of Object.values(manifest.scripts)) {
        if (typeof command === "string")
          commandContexts.push({
            command,
            label: boundaryRelativePath(sourcePath),
            modelRuntimeDirectoryChanges: true,
            resolutionBase: dirname(sourcePath),
            selectorPreamble: "",
          });
      }
    } else if (isGitHubWorkflowPath(sourcePath)) {
      const workflowContexts = githubWorkflowCommandContexts(
        sourcePath,
        boundedSource.content,
      );
      commandContexts = workflowContexts.commands;
      discoveryViolations.push(...workflowContexts.violations);
    } else {
      commandContexts.push({
        command: boundedSource.content,
        label: boundaryRelativePath(sourcePath),
        modelRuntimeDirectoryChanges: true,
        resolutionBase: root,
        selectorPreamble: "",
      });
    }
    const pendingCommands = [...commandContexts];
    while (pendingCommands.length > 0) {
      const current = pendingCommands.shift();
      if (current === undefined) break;
      if (current.modelRuntimeDirectoryChanges) {
        const runtimeContexts = runtimeDirectoryCommandContexts(current);
        if (runtimeContexts.invalid) {
          discoveryViolations.push(
            `${current.label}: runtime directory changes must name literal repository-local directories when selecting TypeScript configuration`,
          );
          continue;
        }
        pendingCommands.unshift(...runtimeContexts.contexts);
        continue;
      }
      const selection = explicitTypeScriptConfigCommandSelection(current);
      if (selection.invalid) {
        discoveryViolations.push(
          `${current.label}: TypeScript config selectors and environment files must name literal local files`,
        );
        continue;
      }
      let canonicalResolutionBase: string;
      try {
        canonicalResolutionBase = await realpath(current.resolutionBase);
        const resolutionBaseStats = await stat(canonicalResolutionBase);
        if (
          !resolutionBaseStats.isDirectory() ||
          !isPathWithinRoot(canonicalRoot, canonicalResolutionBase)
        ) {
          discoveryViolations.push(
            `${current.label}: TypeScript config selector working directories must remain repository-local directories`,
          );
          continue;
        }
      } catch (error) {
        discoveryViolations.push(
          `${current.label}: TypeScript config selector working directory must remain readable (${boundaryErrorCode(error)})`,
        );
        continue;
      }
      for (const specifier of selection.specifiers) {
        if (/[$%`]/u.test(specifier)) {
          discoveryViolations.push(
            `${current.label}: TypeScript config selectors must not use shell expansion`,
          );
          continue;
        }
        files.add(resolvePath(canonicalResolutionBase, specifier));
      }
      for (const specifier of selection.environmentFiles) {
        const environmentPath = resolvePath(canonicalResolutionBase, specifier);
        let canonicalEnvironmentPath: string;
        try {
          canonicalEnvironmentPath = await realpath(environmentPath);
        } catch (error) {
          discoveryViolations.push(
            `${current.label}: selected environment file ${JSON.stringify(specifier)} must remain readable (${boundaryErrorCode(error)})`,
          );
          continue;
        }
        if (!isPathWithinRoot(canonicalRoot, canonicalEnvironmentPath)) {
          discoveryViolations.push(
            `${current.label}: selected environment files must remain inside the repository`,
          );
          continue;
        }
        const environmentResolutionContextKey =
          environmentFileResolutionContextKey(
            canonicalEnvironmentPath,
            canonicalResolutionBase,
          );
        if (
          visitedEnvironmentResolutionContexts.has(
            environmentResolutionContextKey,
          )
        )
          continue;
        if (
          visitedEnvironmentResolutionContexts.size >=
          MAX_TYPESCRIPT_CONFIG_FILES
        ) {
          discoveryViolations.push(
            `Environment-file discovery exceeds ${MAX_TYPESCRIPT_CONFIG_FILES} file-and-working-directory contexts`,
          );
          break;
        }
        visitedEnvironmentResolutionContexts.add(
          environmentResolutionContextKey,
        );
        let boundedEnvironment: Awaited<ReturnType<typeof readBoundedUtf8File>>;
        try {
          boundedEnvironment = await readBoundedUtf8File(
            canonicalEnvironmentPath,
            MAX_TYPESCRIPT_CONFIG_BYTES,
          );
        } catch (error) {
          discoveryViolations.push(
            `${boundaryRelativePath(canonicalEnvironmentPath)}: selected environment file must remain readable (${boundaryErrorCode(error)})`,
          );
          continue;
        }
        if (!boundedEnvironment.ok) {
          discoveryViolations.push(
            `${boundaryRelativePath(canonicalEnvironmentPath)}: selected environment file must remain a bounded regular file`,
          );
          continue;
        }
        pendingCommands.push({
          command: boundedEnvironment.content,
          label: boundaryRelativePath(canonicalEnvironmentPath),
          modelRuntimeDirectoryChanges: false,
          resolutionBase: canonicalResolutionBase,
          selectorPreamble: "",
        });
      }
    }
  }
  return { files, violations: discoveryViolations };
}

function explicitTypeScriptConfigSelection(command: string): {
  environmentFiles: readonly string[];
  invalid: boolean;
  specifiers: readonly string[];
} {
  const environmentFiles: string[] = [];
  const specifiers: string[] = [];
  let expectedSelectors = 0;
  let matchedSelectors = 0;
  const collect = (
    source: string,
    selector: RegExp,
    expected: RegExp,
    output: string[] = specifiers,
  ): void => {
    expectedSelectors += [...source.matchAll(expected)].length;
    for (const match of source.matchAll(selector)) {
      const value = match.slice(1).find((group) => group !== undefined);
      if (value !== undefined) {
        output.push(value);
        matchedSelectors += 1;
      }
    }
  };
  const literalArgument = String.raw`(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s;&|]+))`;
  collect(
    command,
    new RegExp(String.raw`--tsconfig(?:\s*=\s*|\s+)${literalArgument}`, "giu"),
    /--tsconfig(?:\s*=\s*|\s+)/giu,
  );
  for (const segment of command.split(/&&|\|\||[;|\r\n]/u)) {
    const usesTsc = /\btsc(?:\.cmd|\.exe)?\b/iu.test(segment);
    if (
      usesTsc &&
      /(?:^|\s)(?:--build|-b)(?:(?:\s*=\s*)|(?=\s|$))/iu.test(segment)
    )
      return {
        environmentFiles: [...new Set(environmentFiles)],
        invalid: true,
        specifiers: [...new Set(specifiers)],
      };
    if (!usesTsc && !/\bts-node(?:\.cmd|\.exe)?\b/iu.test(segment)) continue;
    collect(
      segment,
      new RegExp(
        String.raw`(?:--project|-p)(?:\s*=\s*|\s+)${literalArgument}`,
        "giu",
      ),
      /(?:--project|-p)(?:\s*=\s*|\s+)/giu,
    );
  }
  collect(
    command,
    new RegExp(
      String.raw`(?:\bset\s+"TSX_TSCONFIG_PATH=([^"\r\n]+)"|TSX_TSCONFIG_PATH\s*=\s*${literalArgument}|^\s*TSX_TSCONFIG_PATH\s*:\s*${literalArgument})`,
      "gimu",
    ),
    /(?:TSX_TSCONFIG_PATH\s*=|^\s*TSX_TSCONFIG_PATH\s*:)/gimu,
  );
  collect(
    command,
    new RegExp(
      String.raw`(?:\bset\s+"TS_NODE_PROJECT=([^"\r\n]+)"|TS_NODE_PROJECT\s*=\s*${literalArgument}|^\s*TS_NODE_PROJECT\s*:\s*${literalArgument})`,
      "gimu",
    ),
    /(?:TS_NODE_PROJECT\s*=|^\s*TS_NODE_PROJECT\s*:)/gimu,
  );
  collect(
    command,
    new RegExp(
      String.raw`--env-file(?:-if-exists)?(?:\s*=\s*|\s+)${literalArgument}`,
      "giu",
    ),
    /--env-file(?:-if-exists)?(?:\s*=\s*|\s+)/giu,
    environmentFiles,
  );
  return {
    environmentFiles: [...new Set(environmentFiles)],
    invalid:
      matchedSelectors !== expectedSelectors ||
      [...specifiers, ...environmentFiles].some((specifier) =>
        /[$%`]/u.test(specifier),
      ),
    specifiers: [...new Set(specifiers)],
  };
}

async function discoverTypeScriptConfigFiles(
  initialFiles: readonly string[],
): Promise<{
  contents: Map<string, string>;
  files: Set<string>;
  violations: string[];
}> {
  const contents = new Map<string, string>();
  const contentsByCanonicalPath = new Map<string, string>();
  const files = new Set<string>();
  const discoveryViolations: string[] = [];
  const canonicalRoot = await realpath(root);
  const visitedCanonicalPaths = new Set<string>();
  const queue = initialFiles.map((path) => ({ depth: 0, path }));

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    let canonicalPath: string;
    try {
      canonicalPath = await realpath(current.path);
    } catch (error) {
      discoveryViolations.push(
        `${boundaryRelativePath(current.path)}: TypeScript config must remain readable (${boundaryErrorCode(error)})`,
      );
      continue;
    }
    if (!isPathWithinRoot(canonicalRoot, canonicalPath)) {
      discoveryViolations.push(
        `${boundaryRelativePath(current.path)}: TypeScript config inheritance must remain inside the repository`,
      );
      continue;
    }
    if (visitedCanonicalPaths.has(canonicalPath)) {
      files.add(current.path);
      const cachedContent = contentsByCanonicalPath.get(canonicalPath);
      if (cachedContent !== undefined)
        contents.set(current.path, cachedContent);
      continue;
    }
    if (visitedCanonicalPaths.size >= MAX_TYPESCRIPT_CONFIG_FILES) {
      discoveryViolations.push(
        `TypeScript config inheritance exceeds ${MAX_TYPESCRIPT_CONFIG_FILES} files`,
      );
      break;
    }
    visitedCanonicalPaths.add(canonicalPath);
    files.add(current.path);
    if (current.depth > MAX_TYPESCRIPT_CONFIG_CHAIN_DEPTH) {
      discoveryViolations.push(
        `${boundaryRelativePath(current.path)}: TypeScript config inheritance exceeds depth ${MAX_TYPESCRIPT_CONFIG_CHAIN_DEPTH}`,
      );
      continue;
    }

    let boundedConfig:
      | { content: string; ok: true }
      | { ok: false; reason: "not_regular" | "too_large" };
    try {
      boundedConfig = await readBoundedUtf8File(
        canonicalPath,
        MAX_TYPESCRIPT_CONFIG_BYTES,
      );
    } catch (error) {
      discoveryViolations.push(
        `${boundaryRelativePath(current.path)}: TypeScript config must remain a readable file (${boundaryErrorCode(error)})`,
      );
      continue;
    }
    if (!boundedConfig.ok) {
      discoveryViolations.push(
        boundedConfig.reason === "too_large"
          ? `${boundaryRelativePath(current.path)}: TypeScript config exceeds ${MAX_TYPESCRIPT_CONFIG_BYTES} bytes`
          : `${boundaryRelativePath(current.path)}: TypeScript config must remain a regular file`,
      );
      continue;
    }
    contents.set(current.path, boundedConfig.content);
    contentsByCanonicalPath.set(canonicalPath, boundedConfig.content);
    const parsed = ts.parseConfigFileTextToJson(
      boundaryRelativePath(current.path),
      boundedConfig.content,
    );
    if (parsed.error !== undefined) continue;
    const extendsSpecifiers = typeScriptConfigExtendsSpecifiers(parsed.config);
    if (extendsSpecifiers === null) {
      discoveryViolations.push(
        `${boundaryRelativePath(current.path)}: TypeScript config extends must be a string or string array`,
      );
      continue;
    }
    const referenceSpecifiers = typeScriptConfigReferenceSpecifiers(
      parsed.config,
    );
    if (referenceSpecifiers === null) {
      discoveryViolations.push(
        `${boundaryRelativePath(current.path)}: TypeScript config references must contain literal paths`,
      );
      continue;
    }
    const configTargets = [
      ...extendsSpecifiers.map((specifier) => ({
        kind: "extends" as const,
        specifier,
      })),
      ...referenceSpecifiers.map((specifier) => ({
        kind: "project reference" as const,
        specifier,
      })),
    ];
    for (const { kind, specifier } of configTargets) {
      if (!specifier.startsWith(".") && !isAbsolute(specifier)) {
        discoveryViolations.push(
          `${boundaryRelativePath(current.path)}: TypeScript config ${kind} must resolve to a local repository file`,
        );
        continue;
      }
      const candidates =
        kind === "extends"
          ? localTypeScriptConfigExtendsCandidates(canonicalPath, specifier)
          : localTypeScriptProjectReferenceCandidates(canonicalPath, specifier);
      let inheritedPath: string | null = null;
      for (const candidate of candidates) {
        let candidateCanonicalPath: string;
        try {
          candidateCanonicalPath = await realpath(candidate);
        } catch (error) {
          if (isMissingPathError(error)) continue;
          throw error;
        }
        if (!isPathWithinRoot(canonicalRoot, candidateCanonicalPath)) {
          discoveryViolations.push(
            `${boundaryRelativePath(current.path)}: TypeScript config ${kind} must remain inside the repository`,
          );
          inheritedPath = candidateCanonicalPath;
          break;
        }
        try {
          const candidateStats = await stat(candidateCanonicalPath);
          if (!candidateStats.isFile()) continue;
        } catch (error) {
          if (isMissingPathError(error)) continue;
          throw error;
        }
        inheritedPath = candidateCanonicalPath;
        break;
      }
      if (inheritedPath === null) {
        discoveryViolations.push(
          `${boundaryRelativePath(current.path)}: TypeScript config ${kind} target ${JSON.stringify(specifier)} must remain readable`,
        );
        continue;
      }
      if (!isPathWithinRoot(canonicalRoot, inheritedPath)) continue;
      queue.push({ depth: current.depth + 1, path: inheritedPath });
    }
  }

  return { contents, files, violations: discoveryViolations };
}

async function readBoundedUtf8File(
  path: string,
  maximumBytes: number,
): Promise<
  | { content: string; ok: true }
  | { ok: false; reason: "not_regular" | "too_large" }
> {
  const handle = await open(path, "r");
  try {
    const fileStats = await handle.stat();
    if (!fileStats.isFile()) return { ok: false, reason: "not_regular" };
    if (fileStats.size > maximumBytes)
      return { ok: false, reason: "too_large" };
    const bytes = Buffer.allocUnsafe(maximumBytes + 1);
    let totalBytes = 0;
    while (totalBytes < bytes.length) {
      const { bytesRead } = await handle.read(
        bytes,
        totalBytes,
        bytes.length - totalBytes,
        totalBytes,
      );
      if (bytesRead === 0) break;
      totalBytes += bytesRead;
    }
    if (totalBytes > maximumBytes) return { ok: false, reason: "too_large" };
    return {
      content: bytes.toString("utf8", 0, totalBytes),
      ok: true,
    };
  } finally {
    await handle.close();
  }
}

function typeScriptConfigExtendsSpecifiers(
  config: unknown,
): readonly string[] | null {
  if (!isRecord(config) || config.extends === undefined) return [];
  if (typeof config.extends === "string") return [config.extends];
  if (
    Array.isArray(config.extends) &&
    config.extends.every((value) => typeof value === "string")
  )
    return config.extends;
  return null;
}

function typeScriptConfigReferenceSpecifiers(
  config: unknown,
): readonly string[] | null {
  if (!isRecord(config) || config.references === undefined) return [];
  if (!Array.isArray(config.references)) return null;
  const specifiers: string[] = [];
  for (const reference of config.references) {
    if (!isRecord(reference) || typeof reference.path !== "string") return null;
    specifiers.push(reference.path);
  }
  return specifiers;
}

function localTypeScriptConfigExtendsCandidates(
  configPath: string,
  specifier: string,
): readonly string[] {
  const base = resolvePath(dirname(configPath), specifier);
  if (extname(base).toLowerCase() === ".json") return [base];
  return [base, `${base}.json`, join(base, "tsconfig.json")];
}

function localTypeScriptProjectReferenceCandidates(
  configPath: string,
  specifier: string,
): readonly string[] {
  const base = resolvePath(dirname(configPath), specifier);
  return extname(base).toLowerCase() === ".json"
    ? [base]
    : [join(base, "tsconfig.json")];
}

function isPathWithinRoot(canonicalRoot: string, candidate: string): boolean {
  const pathFromRoot = relative(canonicalRoot, candidate);
  return (
    pathFromRoot === "" ||
    (!isAbsolute(pathFromRoot) &&
      pathFromRoot !== ".." &&
      !pathFromRoot.startsWith(`..${sep}`))
  );
}

function boundaryRelativePath(path: string): string {
  const relativePath = relative(root, path);
  return isAbsolute(relativePath)
    ? path.replaceAll("\\", "/")
    : relativePath.replaceAll("\\", "/");
}

function boundaryErrorCode(error: unknown): string {
  return error instanceof Error && "code" in error
    ? String(error.code)
    : "unknown error";
}

function isMissingPathError(error: unknown): boolean {
  return ["ENOENT", "ENOTDIR"].includes(boundaryErrorCode(error));
}

function isTypeScriptConfigFileName(fileName: string): boolean {
  return /^tsconfig(?:\.[a-z0-9_-]+)*\.json$/iu.test(fileName);
}

function isRootBoundaryFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return (
    lowerName === "package.json" ||
    lowerName === "pnpm-workspace.yaml" ||
    isTypeScriptConfigFileName(lowerName) ||
    isRootInfrastructureFile(lowerName)
  );
}

function isRootInfrastructureFile(fileName: string): boolean {
  return (
    isDockerfileName(fileName) ||
    isComposeFileName(fileName) ||
    [".conf", ".sql"].includes(extname(fileName))
  );
}

function isComposeFileName(fileName: string): boolean {
  return /^(?:docker-)?compose(?:[.-].*)?\.ya?ml$/i.test(fileName);
}

async function walk(directory: string): Promise<string[]> {
  const output: string[] = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return output;
    throw error;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(path)));
    else output.push(path);
  }
  return output;
}
