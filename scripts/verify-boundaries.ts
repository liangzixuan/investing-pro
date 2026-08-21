import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
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
  ".css",
  ".json",
  ".md",
  ".mjs",
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
const filingPayloadCustodySourcePrefix = "packages/filing-payload-custody/src/";
const filingPayloadCustodyIndexPath = `${filingPayloadCustodySourcePrefix}index.ts`;
const filingPayloadCustodyProductionPath = `${filingPayloadCustodySourcePrefix}payload-custody.ts`;
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
  "node:crypto",
  "node:fs",
  "node:fs/promises",
  "node:os",
  "node:path",
  "vitest",
  "./filing-payload-custody-evidence",
  "./filing-payload-custody-evidence-review",
  "./filing-payload-custody-evidence-verifier",
  "./payload-custody",
  "./test-payload-builder",
]);
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
const copiedAssetExtensions = new Set([
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);
const ignoredDirectories = new Set([
  ".next",
  "coverage",
  "dist",
  "node_modules",
]);
const violations: string[] = [];
const filesToInspect = new Set<string>();

for (const sourceRoot of sourceRoots) {
  for (const file of await walk(join(root, sourceRoot)))
    filesToInspect.add(file);
}
filesToInspect.add(join(root, filingPayloadCustodyFixtureGuardPath));
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && isRootBoundaryFile(entry.name))
    filesToInspect.add(join(root, entry.name));
}

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
]) {
  if (!isRootBoundaryFile(expected))
    throw new Error(`Boundary root-surface classifier missed ${expected}`);
}
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
function git(cwd: string, args: readonly string[]) {
  return spawn("git", args, {
    cwd,
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
void commandOutput("git", []);
void commandOutput("pnpm", []);
void commandOutput("git", []);
function commandOutput(
  command: string,
  args: readonly string[],
  cwd = ".",
) {
  return spawn(command, args, {
    cwd,
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
      'void commandOutput("git", []);',
      'const commandName = "git"; void commandOutput(commandName, []);',
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

for (const file of filesToInspect) {
  const relativePath = relative(root, file).replaceAll("\\", "/");
  const extension = extname(file).toLowerCase();
  if (
    relativePath.startsWith("packages/filing-parser/") &&
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
  const content = await readFile(file, "utf8");
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
  inspectCompositionBoundary(relativePath, content);
  inspectFilingParserWorker(relativePath, content);
}

if (violations.length > 0) {
  throw new Error(
    `Clean-room boundary violations:\n- ${violations.join("\n- ")}`,
  );
}
console.log("Clean-room source and dependency boundary verified.");

function inspectDependencies(path: string, manifest: unknown): void {
  if (!isRecord(manifest)) {
    violations.push(`${path}: package manifest must be an object`);
    return;
  }
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
  if (path === "packages/filing-fact-normalization/package.json") {
    const manifestViolation =
      filingFactNormalizationManifestViolation(manifest);
    if (manifestViolation !== null)
      violations.push(`${path}: ${manifestViolation}`);
  }
  if (
    !path.startsWith("packages/filing-fact-normalization/") &&
    hasFilingFactNormalizationDependency(manifest, path)
  )
    violations.push(
      `${path}: synthetic filing-fact normalization must not be composed into another package`,
    );
  if (path === "packages/filing-payload-custody/package.json") {
    const manifestViolation = filingPayloadCustodyManifestViolation(manifest);
    if (manifestViolation !== null)
      violations.push(`${path}: ${manifestViolation}`);
  }
  if (
    !path.startsWith("packages/filing-payload-custody/") &&
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
    )
  )
    violations.push(
      `${path}: synthetic filing-fact normalization must remain package-isolated`,
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

function isExactFilingPayloadCustodyIndex(content: string): boolean {
  const sourceFile = ts.createSourceFile(
    filingPayloadCustodyIndexPath,
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
    declaration.moduleSpecifier.text !== "./payload-custody" ||
    declaration.exportClause === undefined ||
    !ts.isNamedExports(declaration.exportClause)
  )
    return false;
  const actual = declaration.exportClause.elements.map((specifier) => [
    specifier.propertyName?.text ?? specifier.name.text,
    specifier.name.text,
    specifier.isTypeOnly,
  ]);
  const expected = filingPayloadCustodyPublicExports.map(([name, typeOnly]) => [
    name,
    name,
    typeOnly,
  ]);
  return JSON.stringify(actual) === JSON.stringify(expected);
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
        parent.name.text !== "platform"
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
    JSON.stringify(commands) !== JSON.stringify(["git", "pnpm", "git"]) ||
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
    !ts.isIdentifier(args) ||
    args.text !== "args" ||
    options === undefined ||
    !ts.isObjectLiteralExpression(options) ||
    options.properties.length !== 3
  )
    return false;
  const [cwd, shell, stdio] = options.properties;
  return (
    cwd !== undefined &&
    ts.isShorthandPropertyAssignment(cwd) &&
    cwd.name.text === "cwd" &&
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
  if (path === "packages/filing-parser/worker/Dockerfile") {
    const violation = filingParserDockerfileViolation(content);
    if (violation !== null) violations.push(`${path}: ${violation}`);
    return;
  }
  if (path !== "packages/filing-parser/worker/parser.py") return;
  for (const pattern of forbiddenWorkerPython) {
    if (pattern.test(content))
      violations.push(`${path}: disconnected worker matched ${pattern}`);
  }
  const importViolation = workerPythonImportViolation(content);
  if (importViolation !== null) violations.push(`${path}: ${importViolation}`);
}

function workerPythonImportViolation(content: string): string | null {
  const imports = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^(?:from|import)\s/u.test(line));
  if (
    imports.length !== allowedWorkerPythonImports.size ||
    imports.some((line) => !allowedWorkerPythonImports.has(line)) ||
    [...allowedWorkerPythonImports].some(
      (expected) => imports.filter((line) => line === expected).length !== 1,
    )
  )
    return "worker imports must remain the exact reviewed standard-library allowlist";
  return null;
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

function collectModuleSpecifiers(content: string): string[] {
  const sourceFile = ts.createSourceFile(
    "boundary-source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const specifiers: string[] = [];

  const visit = (node: ts.Node): void => {
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
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
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
  return null;
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

function isRootBoundaryFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return (
    lowerName === "package.json" ||
    lowerName === "pnpm-workspace.yaml" ||
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
