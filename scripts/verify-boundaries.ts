import { spawnSync } from "node:child_process";
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
const workspacePackageNames =
  await collectWorkspacePackageNames(filesToInspect);

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
    hasFilingFactNormalizationDependency(manifest, path)
  )
    violations.push(
      `${path}: synthetic filing-fact normalization must not be composed into another package`,
    );
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
    hasFilingQualityPrecommitmentDependency(manifest, path)
  )
    violations.push(
      `${path}: synthetic filing-quality precommitment must not be composed into another package`,
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
    )
  )
    violations.push(
      `${path}: synthetic filing-fact normalization must remain package-isolated`,
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
    moduleSpecifiers.some((specifier) =>
      referencesFilingQualityPrecommitmentPath(path, specifier),
    )
  )
    violations.push(
      `${path}: synthetic filing-quality precommitment must remain package-isolated`,
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
      sourcePath === filingQualityPrecommitmentBuilderPath) &&
    specifier === filingQualityMeasurementModule
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
