import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
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
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
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

for (const file of filesToInspect) {
  const relativePath = relative(root, file).replaceAll("\\", "/");
  const extension = extname(file).toLowerCase();
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
  ];
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

function inspectCompositionBoundary(path: string, content: string): void {
  const moduleSpecifiers = collectModuleSpecifiers(content);
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
