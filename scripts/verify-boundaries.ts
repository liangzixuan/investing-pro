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
