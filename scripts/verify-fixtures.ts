import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface FixtureManifest {
  schemaVersion: string;
  status: string;
  evidenceHashes: Record<string, string>;
}

interface EvidenceRecord {
  id: string;
  excerpt: string;
  contentHash: string;
  rightsPolicyId: string;
  synthetic: boolean;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = parseManifest(
  await readJson(join(root, "fixtures", "manifest.json")),
);
const evidence = parseEvidence(
  await readJson(join(root, "fixtures", "synthetic", "v1", "evidence.json")),
);

assert(
  manifest.schemaVersion === "1.0.0",
  "Unexpected fixture manifest schema",
);
assert(
  manifest.status === "synthetic_demo_only",
  "Fixture status must remain synthetic_demo_only",
);
assert(evidence.length > 0, "Evidence fixture must be a non-empty array");

const ids = new Set<string>();
for (const record of evidence) {
  assert(!ids.has(record.id), `Duplicate evidence id: ${record.id}`);
  ids.add(record.id);
  assert(record.synthetic, `${record.id} must be explicitly synthetic`);
  assert(
    record.rightsPolicyId === "rights.synthetic.display.v1" ||
      record.rightsPolicyId === "rights.synthetic.restricted.v1",
    `${record.id} has an unexpected rights policy`,
  );

  const calculated = `sha256:${createHash("sha256").update(record.excerpt, "utf8").digest("hex")}`;
  assert(
    record.contentHash === calculated,
    `${record.id} contentHash does not match its excerpt`,
  );
  assert(
    manifest.evidenceHashes[record.id] === calculated,
    `${record.id} is missing from the manifest or has a stale manifest hash`,
  );
}

const manifestIds = Object.keys(manifest.evidenceHashes);
assert(
  manifestIds.length === ids.size && manifestIds.every((id) => ids.has(id)),
  "The manifest and evidence fixture must contain exactly the same evidence ids",
);
assert(
  evidence.some(
    (record) => record.rightsPolicyId === "rights.synthetic.restricted.v1",
  ),
  "The denial-path fixture must not be removed",
);

console.log(`Fixture integrity verified: ${evidence.length} evidence records.`);

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function parseManifest(value: unknown): FixtureManifest {
  assert(isRecord(value), "Fixture manifest must be an object");
  assert(
    typeof value.schemaVersion === "string",
    "Manifest needs schemaVersion",
  );
  assert(typeof value.status === "string", "Manifest needs status");
  assert(isRecord(value.evidenceHashes), "Manifest needs evidenceHashes");
  const evidenceHashes: Record<string, string> = {};
  for (const [id, hash] of Object.entries(value.evidenceHashes)) {
    assert(
      typeof hash === "string",
      `Manifest hash for ${id} must be a string`,
    );
    evidenceHashes[id] = hash;
  }
  return {
    schemaVersion: value.schemaVersion,
    status: value.status,
    evidenceHashes,
  };
}

function parseEvidence(value: unknown): EvidenceRecord[] {
  assert(Array.isArray(value), "Evidence fixture must be an array");
  return value.map((entry, index) => {
    assert(isRecord(entry), `Evidence record ${index} must be an object`);
    assert(
      typeof entry.id === "string",
      `Evidence record ${index} needs an id`,
    );
    assert(
      typeof entry.excerpt === "string",
      `Evidence record ${entry.id} needs an excerpt`,
    );
    assert(
      typeof entry.contentHash === "string",
      `Evidence record ${entry.id} needs a contentHash`,
    );
    assert(
      typeof entry.rightsPolicyId === "string",
      `Evidence record ${entry.id} needs a rightsPolicyId`,
    );
    assert(
      typeof entry.synthetic === "boolean",
      `Evidence record ${entry.id} needs a synthetic flag`,
    );
    return {
      id: entry.id,
      excerpt: entry.excerpt,
      contentHash: entry.contentHash,
      rightsPolicyId: entry.rightsPolicyId,
      synthetic: entry.synthetic,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
