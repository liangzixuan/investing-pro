import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const fixtureDirectory = resolve(
  root,
  "fixtures/synthetic/filing-parser-normalization-execution/v1",
);
const casesPath = resolve(fixtureDirectory, "cases.json");
const manifestPath = resolve(fixtureDirectory, "manifest.json");
const HASH = /^sha256:[0-9a-f]{64}$/u;
const SAFE_PATH =
  /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const EXPECTED_FILES = Object.freeze([
  "packages/filing-parser-normalization-execution/acceptance/python-image.json",
  "packages/filing-parser-normalization-execution/src/test-filing-parser-normalization-execution-builder.ts",
  "packages/filing-parser-normalization-execution/worker/Dockerfile",
  "packages/filing-parser-normalization-execution/worker/parser.py",
  "packages/filing-parser-normalization-execution/worker/parser_test.py",
  "packages/filing-parser-normalization-execution/worker/taxonomy-v1.json",
]);
const EXPECTED_CASES = Object.freeze({
  cases: Object.freeze([
    Object.freeze({
      caseId: "exact-original-amendment-pair",
      expectedStatus: "normalized",
      replay: true,
    }),
    Object.freeze({
      caseId: "original-archive-tamper",
      expectedStatus: "quarantined",
      replay: false,
    }),
    Object.freeze({
      caseId: "original-amendment-role-swap",
      expectedStatus: "quarantined",
      replay: false,
    }),
  ]),
  schemaVersion: "1.0.0",
  synthetic: true,
});

await verifyFixtureInventory();

async function verifyFixtureInventory(): Promise<void> {
  if (
    relative(root, fixtureDirectory).startsWith("..") ||
    (await realpath(fixtureDirectory)) !== fixtureDirectory
  )
    fail();
  const entries = await readdir(fixtureDirectory, { withFileTypes: true });
  if (
    entries.length !== 2 ||
    entries.some(
      (entry) =>
        !entry.isFile() ||
        !["cases.json", "manifest.json"].includes(entry.name),
    )
  )
    fail();
  const casesBytes = await exactFile(casesPath, 65_536);
  const cases = strictJson(casesBytes);
  if (JSON.stringify(cases) !== JSON.stringify(EXPECTED_CASES)) fail();

  const manifest = record(strictJson(await exactFile(manifestPath, 65_536)), [
    "caseCount",
    "casesSha256",
    "files",
    "normalizedCases",
    "quarantinedCases",
    "schemaVersion",
    "synthetic",
  ]);
  if (
    manifest.caseCount !== 3 ||
    manifest.normalizedCases !== 1 ||
    manifest.quarantinedCases !== 2 ||
    manifest.schemaVersion !== "1.0.0" ||
    manifest.synthetic !== true ||
    manifest.casesSha256 !== sha256(casesBytes)
  )
    fail();
  if (
    !Array.isArray(manifest.files) ||
    manifest.files.length !== EXPECTED_FILES.length
  )
    fail();
  for (const [index, expectedPath] of EXPECTED_FILES.entries()) {
    const entry = record(manifest.files[index], ["path", "sha256"]);
    if (
      entry.path !== expectedPath ||
      typeof entry.sha256 !== "string" ||
      !HASH.test(entry.sha256) ||
      !SAFE_PATH.test(expectedPath) ||
      isAbsolute(expectedPath)
    )
      fail();
    const target = resolve(root, expectedPath);
    if (relative(root, target).startsWith("..")) fail();
    const bytes = await exactFile(target, 2_097_152);
    if (sha256(bytes) !== entry.sha256) fail();
  }
}

async function exactFile(
  path: string,
  maximumBytes: number,
): Promise<Uint8Array> {
  const info = await lstat(path);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size <= 0 ||
    info.size > maximumBytes ||
    (await realpath(path)) !== path
  )
    fail();
  return Uint8Array.from(await readFile(path));
}

function strictJson(bytes: Uint8Array): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return fail();
  }
  if (!text.endsWith("\n") || text.startsWith("\ufeff")) fail();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return fail();
  }
  if (`${JSON.stringify(parsed, null, 2)}\n` !== text) fail();
  return parsed;
}

function record(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify([...keys].sort())
  )
    fail();
  return value as Record<string, unknown>;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fail(): never {
  throw new Error(
    "Filing parser normalization execution fixtures are invalid.",
  );
}
