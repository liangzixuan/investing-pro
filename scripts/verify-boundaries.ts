import { spawnSync } from "node:child_process";
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
  if (
    path === "packages/filing-parser/worker/Dockerfile" ||
    path === filingParserNormalizationExecutionWorkerDockerfilePath
  ) {
    const violation = filingParserDockerfileViolation(content);
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
      "pnpm guardrails:boundaries && pnpm guardrails:fixtures && pnpm guardrails:filing-parser-fixtures && pnpm guardrails:filing-parser-normalization-execution-fixtures && pnpm guardrails:filing-payload-custody-fixtures && pnpm guardrails:migrations && pnpm guardrails:postgres-acceptance && pnpm guardrails:licenses",
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

function filingParserNormalizationHandoffExternalCompositionViolation(
  path: string,
  content: string,
): string | null {
  if (
    path.startsWith(filingParserNormalizationHandoffPackagePrefix) ||
    path === filingParserNormalizationExecutionProductionPath ||
    path === filingParserNormalizationExecutionWorkflowPath
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
    path === filingParserNormalizationExecutionWorkflowPath
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
