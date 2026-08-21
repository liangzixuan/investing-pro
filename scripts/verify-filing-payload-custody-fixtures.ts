import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FILING_PAYLOAD_CUSTODY_FIXTURE,
  createSyntheticFilingPayloadFixture,
} from "../packages/filing-payload-custody/src/payload-custody";
import {
  FILING_PAYLOAD_CUSTODY_ACCEPTANCE_CASES,
  buildFilingPayloadCustodyAcceptanceCases,
} from "../packages/filing-payload-custody/src/test-payload-builder";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDirectory = join(
  root,
  "fixtures",
  "synthetic",
  "filing-payload-custody",
  "v1",
);
const casesPath = join(fixtureDirectory, "cases.json");
const manifestPath = join(fixtureDirectory, "manifest.json");
const EXPECTED_FILES = [
  "packages/filing-payload-custody/src/payload-custody-security.test.ts",
  "packages/filing-payload-custody/src/payload-custody.test.ts",
  "packages/filing-payload-custody/src/payload-custody.ts",
  "packages/filing-payload-custody/src/test-payload-builder.ts",
] as const;

const casesBytes = await readRegularFile(casesPath, 65_536);
const manifestBytes = await readRegularFile(manifestPath, 65_536);
const cases = parseCanonicalJson(casesBytes);
const manifest = parseCanonicalJson(manifestBytes);

assertExact(cases, ["cases", "schemaVersion", "synthetic"]);
assert(cases.schemaVersion === "1.0.0", "Cases schema changed");
assert(cases.synthetic === true, "Cases must remain synthetic");
assert(Array.isArray(cases.cases), "Cases inventory must be an array");
assert(cases.cases.length === 1, "Exactly one lifecycle case is required");
assert(
  canonicalJson(cases.cases) ===
    canonicalJson(FILING_PAYLOAD_CUSTODY_ACCEPTANCE_CASES),
  "Cases inventory drifted",
);

const generated = buildFilingPayloadCustodyAcceptanceCases();
const fresh = buildFilingPayloadCustodyAcceptanceCases();
assert(generated.length === 1 && fresh.length === 1, "Generator count drifted");
const generatedCase = generated[0];
const freshCase = fresh[0];
assert(
  generatedCase !== undefined && freshCase !== undefined,
  "Generator case missing",
);
assert(
  generatedCase.payload !== freshCase.payload &&
    Buffer.from(generatedCase.payload).equals(Buffer.from(freshCase.payload)),
  "Generator must return fresh deterministic bytes",
);
assert(
  generatedCase.payload.byteLength ===
    FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength &&
    sha256(generatedCase.payload) ===
      FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256 &&
    sha256(createSyntheticFilingPayloadFixture()) ===
      FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256,
  "Synthetic payload fixture drifted",
);

assertExact(manifest, [
  "caseCount",
  "casesSha256",
  "files",
  "schemaVersion",
  "synthetic",
]);
assert(manifest.schemaVersion === "1.0.0", "Manifest schema changed");
assert(manifest.synthetic === true, "Manifest must remain synthetic");
assert(manifest.caseCount === 1, "Manifest case count drifted");
assert(manifest.casesSha256 === sha256(casesBytes), "Cases hash drifted");
const manifestFiles = unknownArray(manifest.files);
assert(
  manifestFiles.length === EXPECTED_FILES.length,
  "Manifest file count drifted",
);
for (let index = 0; index < EXPECTED_FILES.length; index += 1) {
  const expectedPath = EXPECTED_FILES[index];
  const entry = manifestFiles[index];
  assert(
    expectedPath !== undefined && isRecord(entry),
    `Manifest file ${index} invalid`,
  );
  assertExact(entry, ["path", "sha256"]);
  assert(
    entry.path === expectedPath,
    `Manifest file ${index} path/order drifted`,
  );
  assert(
    entry.sha256 ===
      sha256(await readRegularFile(join(root, expectedPath), 4_194_304)),
    `${expectedPath} hash drifted`,
  );
}

process.stdout.write(
  `Filing payload custody fixture verified: cases=1, bytes=${FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength}.\n`,
);

async function readRegularFile(
  path: string,
  maximumBytes: number,
): Promise<Uint8Array> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    assert(
      before.isFile() && before.size > 0 && before.size <= maximumBytes,
      `${path} must be a bounded regular file`,
    );
    const bounded = Buffer.alloc(before.size + 1);
    let offset = 0;
    while (offset < bounded.byteLength) {
      const { bytesRead } = await handle.read(
        bounded,
        offset,
        bounded.byteLength - offset,
        offset,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await handle.stat();
    assert(
      offset === before.size &&
        after.size === before.size &&
        after.dev === before.dev &&
        after.ino === before.ino &&
        after.mtimeMs === before.mtimeMs &&
        after.ctimeMs === before.ctimeMs,
      `${path} changed during bounded read`,
    );
    return new Uint8Array(bounded.subarray(0, offset));
  } finally {
    await handle.close();
  }
}

function parseCanonicalJson(bytes: Uint8Array): Record<string, unknown> {
  let text: string;
  let value: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
    value = JSON.parse(text);
  } catch {
    throw new Error("Filing payload custody fixture JSON is invalid");
  }
  assert(
    `${JSON.stringify(value, null, 2)}\n` === text,
    "Fixture JSON must be canonical",
  );
  assert(isRecord(value), "Fixture document must be an object");
  return value;
}

function assertExact(
  value: Record<string, unknown>,
  keys: readonly string[],
): void {
  assert(
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0"),
    "Fixture keys changed",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownArray(value: unknown): readonly unknown[] {
  assert(Array.isArray(value), "Manifest files must be an array");
  return value as readonly unknown[];
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  assert(isRecord(value), "Fixture value is not canonical JSON");
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
