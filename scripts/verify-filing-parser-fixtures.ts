import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FILING_PARSER_QUARANTINE_CODES,
  type FilingParserQuarantineCode,
} from "../packages/filing-parser/src/index";
import {
  TEST_FILING_MANIFEST_CANONICAL,
  TEST_FILING_XML_CANONICAL,
  buildParserSecurityCases,
} from "../packages/filing-parser/src/test-archive-builder";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDirectory = join(
  root,
  "fixtures",
  "synthetic",
  "filing-parser",
  "v1",
);
const casesPath = join(fixtureDirectory, "cases.json");
const manifestPath = join(fixtureDirectory, "manifest.json");
const EXPECTED_FILES = [
  "packages/filing-parser/acceptance/python-image.json",
  "packages/filing-parser/src/test-archive-builder.ts",
  "packages/filing-parser/worker/Dockerfile",
  "packages/filing-parser/worker/parser.py",
  "packages/filing-parser/worker/taxonomy-v1.json",
] as const;

const casesBytes = await readRegularFile(casesPath, 2_097_152);
const manifestBytes = await readRegularFile(manifestPath, 65_536);
const casesDocument = parseCanonicalJson(casesBytes, "cases");
const manifest = parseCanonicalJson(manifestBytes, "manifest");

assertExactKeys(
  casesDocument,
  ["cases", "schemaVersion", "synthetic"],
  "cases",
);
assert(casesDocument.schemaVersion === "1.0.0", "Cases schema version changed");
assert(
  casesDocument.synthetic === true,
  "Cases must remain explicitly synthetic",
);
assert(Array.isArray(casesDocument.cases), "Cases inventory must be an array");

const generatedCases = buildParserSecurityCases();
const freshCases = buildParserSecurityCases();
assert(
  generatedCases.length === 103,
  "Cycle 2a corpus must contain exactly 103 cases",
);
assert(
  freshCases.length === generatedCases.length,
  "Fresh corpus count changed",
);
assert(
  casesDocument.cases.length === generatedCases.length,
  "Cases inventory count does not match the generator",
);

const ids = new Set<string>();
let acceptedCases = 0;
let quarantinedCases = 0;
for (let index = 0; index < generatedCases.length; index += 1) {
  const generated = generatedCases[index];
  const fresh = freshCases[index];
  const recorded: unknown = casesDocument.cases[index];
  assert(
    generated !== undefined && fresh !== undefined,
    "Generator index is missing",
  );
  assert(isRecord(recorded), `Case ${index} must be an object`);
  assertExactKeys(
    recorded,
    ["archiveSha256", "expected", "id"],
    `case ${index}`,
  );
  assert(
    typeof recorded.id === "string" &&
      /^[a-z][a-z0-9_]{2,79}$/u.test(recorded.id),
    `Case ${index} has an invalid id`,
  );
  assert(!ids.has(recorded.id), `Duplicate case id: ${recorded.id}`);
  ids.add(recorded.id);
  assert(
    recorded.id === generated.id && fresh.id === generated.id,
    `Case ${index} order drifted`,
  );
  assert(
    generated.archive !== fresh.archive &&
      Buffer.from(generated.archive).equals(Buffer.from(fresh.archive)),
    `${generated.id} must return fresh deterministic archive bytes`,
  );
  assert(
    recorded.archiveSha256 === sha256(generated.archive),
    `${generated.id} archive hash drifted`,
  );
  const recordedExpected = recorded.expected;
  assert(
    isRecord(recordedExpected),
    `${generated.id} expected outcome must be an object`,
  );
  assert(
    canonicalJson(recordedExpected) === canonicalJson(generated.expected),
    `${generated.id} expected outcome drifted`,
  );
  if (generated.expected.status === "accepted") {
    acceptedCases += 1;
    assertExactKeys(
      recordedExpected,
      ["status"],
      `${generated.id} accepted result`,
    );
  } else {
    quarantinedCases += 1;
    assertExactKeys(
      recordedExpected,
      ["code", "status"],
      `${generated.id} quarantine`,
    );
    assert(
      typeof recordedExpected.code === "string" &&
        FILING_PARSER_QUARANTINE_CODES.includes(
          recordedExpected.code as FilingParserQuarantineCode,
        ),
      `${generated.id} has an unrecognized quarantine code`,
    );
  }
}
assert(
  acceptedCases === 3,
  "Cycle 2a corpus must retain exactly 3 accepted cases",
);
assert(
  quarantinedCases === 100,
  "Cycle 2a corpus must retain exactly 100 quarantines",
);
assert(
  ids.has("accepted_canonical") &&
    ids.has("accepted_exact_replay") &&
    ids.has("accepted_decimal_boundaries"),
  "Accepted sentinel cases changed",
);
const canonical = generatedCases.find(
  (entry) => entry.id === "accepted_canonical",
);
const replay = generatedCases.find(
  (entry) => entry.id === "accepted_exact_replay",
);
assert(
  canonical !== undefined &&
    replay !== undefined &&
    sha256(canonical.archive) === sha256(replay.archive),
  "Exact-byte replay inputs must remain identical",
);

assertExactKeys(
  manifest,
  [
    "acceptedCases",
    "caseCount",
    "casesSha256",
    "files",
    "quarantinedCases",
    "schemaVersion",
    "synthetic",
  ],
  "manifest",
);
assert(manifest.schemaVersion === "1.0.0", "Manifest schema version changed");
assert(
  manifest.synthetic === true,
  "Manifest must remain explicitly synthetic",
);
assert(
  manifest.caseCount === generatedCases.length,
  "Manifest case count drifted",
);
assert(
  manifest.acceptedCases === acceptedCases,
  "Manifest accepted count drifted",
);
assert(
  manifest.quarantinedCases === quarantinedCases,
  "Manifest quarantine count drifted",
);
assert(
  manifest.casesSha256 === sha256(casesBytes),
  "Manifest cases hash drifted",
);
assert(Array.isArray(manifest.files), "Manifest files must be an array");
assert(
  manifest.files.length === EXPECTED_FILES.length,
  "Manifest file count drifted",
);

for (let index = 0; index < EXPECTED_FILES.length; index += 1) {
  const expectedPath = EXPECTED_FILES[index];
  const entry: unknown = manifest.files[index];
  assert(
    expectedPath !== undefined && isRecord(entry),
    `Manifest file ${index} is invalid`,
  );
  assertExactKeys(entry, ["path", "sha256"], `manifest file ${index}`);
  assert(
    entry.path === expectedPath,
    `Manifest file ${index} path/order drifted`,
  );
  const bytes = await readRegularFile(join(root, expectedPath), 4_194_304);
  assert(entry.sha256 === sha256(bytes), `${expectedPath} hash drifted`);
}

const filingManifest = parseInlineCanonicalJson(
  TEST_FILING_MANIFEST_CANONICAL,
  "synthetic filing manifest",
);
assert(
  filingManifest.synthetic === true &&
    typeof filingManifest.accession === "string" &&
    /^SYN-[0-9]{10}-[0-9]{2}-[0-9]{6}$/u.test(filingManifest.accession) &&
    filingManifest.document === "filing.xml",
  "Accepted manifest lost its closed synthetic identity",
);
assert(
  TEST_FILING_XML_CANONICAL.includes(
    'xmlns="urn:research-cockpit:synthetic:filing:v1"',
  ) &&
    TEST_FILING_XML_CANONICAL.includes('concept="net_income"') &&
    TEST_FILING_XML_CANONICAL.includes('concept="revenue"'),
  "Accepted XML lost its synthetic namespace or sentinel concepts",
);

console.log(
  `Filing parser fixture integrity verified: ${generatedCases.length} synthetic cases (${acceptedCases} accepted, ${quarantinedCases} quarantined).`,
);

async function readRegularFile(
  path: string,
  maximumBytes: number,
): Promise<Uint8Array> {
  const stat = await lstat(path);
  assert(
    stat.isFile() && !stat.isSymbolicLink(),
    `${path} must be a regular file`,
  );
  assert(
    stat.size > 0 && stat.size <= maximumBytes,
    `${path} size is outside its bound`,
  );
  return Uint8Array.from(await readFile(path));
}

function parseCanonicalJson(
  bytes: Uint8Array,
  label: string,
): Record<string, unknown> {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} must be UTF-8`);
  }
  const value = parseInlineCanonicalJson(text, label);
  assert(
    `${JSON.stringify(value, null, 2)}\n` === text,
    `${label} must use canonical source formatting`,
  );
  return value;
}

function parseInlineCanonicalJson(
  text: string,
  label: string,
): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label} must be JSON`);
  }
  assert(isRecord(value), `${label} must be an object`);
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(
    canonicalJson(actual) === canonicalJson(expected),
    `${label} keys drifted`,
  );
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    assert(
      Number.isSafeInteger(value),
      "Fixture JSON numbers must be safe integers",
    );
    return String(value);
  }
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  assert(isRecord(value), "Fixture JSON value is unsupported");
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
