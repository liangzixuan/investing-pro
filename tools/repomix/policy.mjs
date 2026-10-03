import path from "node:path";

export const LIMITS = Object.freeze({
  files: 5000,
  path: 1024,
  file: 8388608,
  total: 134217728,
  output: 268435456,
  curatedFile: 262144,
});
const roots = new Set([
  "apps",
  "modules",
  "packages",
  "scripts",
  "docs",
  "specs",
  "fixtures",
  ".github",
  "tools",
]);
const rootFiles = new Set([
  "README.md",
  "AGENTS.md",
  "LICENSE",
  "LICENSE.md",
  "LICENSE_POLICY.md",
  "THIRD_PARTY_NOTICES.md",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "tsconfig.base.json",
  "eslint.config.mjs",
  "browserstack.yml",
  "design-qa.md",
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".node-version",
  ".python-version",
  ".prettierignore",
]);
const extensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".md",
  ".txt",
  ".css",
  ".html",
  ".xml",
  ".sql",
  ".sh",
  ".ps1",
  ".psm1",
  ".cmd",
  ".bat",
  ".py",
  ".java",
  ".kt",
  ".kts",
  ".gradle",
  ".properties",
  ".toml",
]);
const forbiddenSegments = new Set([
  ".git",
  ".owner-local",
  "node_modules",
  ".pnpm",
  ".gradle",
  ".next",
  "dist",
  "build",
  "coverage",
  "tmp",
  "delivery",
  "logs",
  "test-results",
  "playwright-report",
  ".browserstack",
  "repomix-output",
]);
const overviewGuides = new Set(
  [
    "AI_CONTEXT",
    "CURRENT_WORK",
    "ARCHITECTURE",
    "PRODUCT_ROADMAP",
    "CAPABILITY_STATUS",
    "ANDROID_CLIENT",
    "APPWRITE_DELIVERY",
    "APPWRITE_WATCHLIST",
    "MANAGED_SECURITY_CATALOG",
    "MANAGED_SEC_ANNUAL",
    "MANAGED_EOD_HISTORY",
  ].map((name) => `docs/${name}.md`),
);
const syntheticSecurityExamples = new Set([
  "apps/web/src/clerk-trial/config.test.ts",
  "packages/contracts/src/managed-workspace.test.ts",
  "scripts/verify-boundaries.ts",
]);

export function hasMachineReference(text) {
  return /\b[a-z]:[\\/]+(?:users|documents and settings)[\\/]|\/(?:Users|home)\/[^/\s]+\//iu.test(
    text,
  );
}

export function hasLocalReference(text) {
  return (
    hasMachineReference(text) ||
    /\]\([^\r\n)]*(?:\.owner-local\/|(?:\.\.\/)*tmp\/|\.\.\/(?:CURRENT|LAUNCH_ROADMAP)\.md)/iu.test(
      text,
    )
  );
}

export function safePath(name) {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= LIMITS.path &&
    !Array.from(name).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    }) &&
    !/[\\:{}*?!]/u.test(name) &&
    !name.startsWith("/") &&
    name
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

export function classify(name, mode, bytes) {
  if (!safePath(name)) throw new Error("unsafe tracked path");
  if (!["overview", "curated", "full"].includes(mode))
    throw new Error("unknown pack mode");
  if (syntheticSecurityExamples.has(name))
    return "excluded:synthetic-security-example";
  const parts = name.split("/");
  const base = parts.at(-1).toLowerCase();
  if (
    parts.some((part) => forbiddenSegments.has(part.toLowerCase())) ||
    base.startsWith(".env") ||
    [
      ".npmrc",
      "owner-account.json",
      "credentials.json",
      "secrets.json",
      "appwrite.json",
      "local.properties",
      "google-services.json",
    ].includes(base) ||
    base.startsWith("repomix-output") ||
    /\.(p12|pfx|jks|keystore|key|pem|sqlite|sqlite3|db|apk|aab|log)$/u.test(
      base,
    )
  )
    return "excluded:private-or-generated";
  if (!(rootFiles.has(name) || roots.has(parts[0])))
    return "excluded:outside-source-scope";
  if (
    !rootFiles.has(name) &&
    !extensions.has(path.posix.extname(name).toLowerCase()) &&
    !["Dockerfile", "Makefile", "gradlew"].includes(parts.at(-1))
  )
    return "excluded:non-text-type";
  if (mode === "overview") {
    const inventory =
      base.endsWith("lock.yaml") ||
      base.endsWith("lock.json") ||
      /third[-_]party[-_]notices/iu.test(base);
    const selected =
      rootFiles.has(name) ||
      base === "package.json" ||
      overviewGuides.has(name) ||
      name.startsWith("tools/repomix/") ||
      [".github/workflows/repomix.yml", ".github/dependabot.yml"].includes(
        name,
      );
    if (inventory || !selected) return "detail:source-reference";
  }
  if (mode === "curated") {
    if (name.startsWith("docs/history/")) return "detail:historical-docs";
    if (
      parts.some((part) =>
        ["fixtures", "__fixtures__", "test", "tests", "androidTest"].includes(
          part,
        ),
      ) ||
      /\.(test|spec)\.[^.]+$/u.test(base)
    )
      return "detail:tests-and-fixtures";
    if (
      base.endsWith("lock.yaml") ||
      base.endsWith("lock.json") ||
      /third[-_]party[-_]notices/iu.test(base)
    )
      return "detail:lock-or-license-inventory";
    if (bytes > LIMITS.curatedFile) return "detail:large-file";
  }
  if (bytes > LIMITS.file) throw new Error("admitted file exceeds size limit");
  return "included";
}

export function admitPackResult(result, names) {
  if (
    result.suspiciousFilesResults.length ||
    result.suspiciousGitDiffResults.length ||
    result.suspiciousGitLogResults.length
  )
    throw new Error("security scan rejected source; artifact withheld");
  if (result.skippedFiles.length)
    throw new Error("unexpected skipped source; artifact withheld");
  const actual = result.processedFiles.map((file) => file.path).sort();
  if (
    JSON.stringify(actual) !== JSON.stringify([...names].sort()) ||
    result.totalFiles !== names.length ||
    JSON.stringify([...result.safeFilePaths].sort()) !==
      JSON.stringify([...names].sort())
  )
    throw new Error("packed source coverage mismatch; artifact withheld");
}
