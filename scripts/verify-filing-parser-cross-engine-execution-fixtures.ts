import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const fixtureRoot = resolve(
  root,
  "fixtures/synthetic/filing-parser-cross-engine-execution",
);
const HASH = /^sha256:[0-9a-f]{64}$/u;
const SAFE = /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const FILES = Object.freeze([
  "packages/filing-parser-normalization-execution/acceptance/python-image.json",
  "packages/filing-parser-normalization-execution/src/test-filing-parser-normalization-execution-builder.ts",
  "packages/filing-parser-normalization-execution/worker/Dockerfile",
  "packages/filing-parser-normalization-execution/worker/parser.py",
  "packages/filing-parser-normalization-execution/worker/parser_test.py",
  "packages/filing-parser-normalization-execution/worker/taxonomy-v1.json",
  "packages/filing-parser-cross-engine-execution/acceptance/node-image.json",
  "packages/filing-parser-cross-engine-execution/src/test-cross-engine-execution-builder.ts",
  "packages/filing-parser-cross-engine-execution/worker/Dockerfile",
  "packages/filing-parser-cross-engine-execution/worker/parser.mjs",
  "packages/filing-parser-cross-engine-execution/worker/parser.test.mjs",
  "packages/filing-parser-cross-engine-execution/worker/taxonomy-v1.json",
]);
const CASES_V1 = {
  cases: [
    {
      caseId: "exact-original-amendment-cross-engine-pair",
      expectedStatus: "agreed",
      replay: true,
    },
    {
      caseId: "cross-engine-normalization-mismatch",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "original-archive-tamper",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "original-amendment-role-swap",
      expectedStatus: "quarantined",
      replay: false,
    },
  ],
  schemaVersion: "1.0.0",
  synthetic: true,
};
const CASES_V2 = {
  cases: [
    {
      caseId: "exact-original-amendment-cross-engine-bound-pair",
      expectedStatus: "agreed",
      replay: true,
    },
    {
      caseId: "cached-genuine-child-receipts-under-different-archives",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "common-mode-lineage-mutation",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "cross-engine-normalization-mismatch",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "original-archive-tamper",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "original-amendment-role-swap",
      expectedStatus: "quarantined",
      replay: false,
    },
  ],
  schemaVersion: "2.0.0",
  synthetic: true,
};
const CASES_V3 = {
  cases: [
    {
      caseId: "same-input-direct-docker-distinct-lifecycle-invocations",
      expectedStatus: "agreed",
      replay: true,
    },
    {
      caseId: "unknown-python-image",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "pre-aborted-signal",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "original-archive-tamper",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "original-amendment-role-swap",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "identical-archives",
      expectedStatus: "quarantined",
      replay: false,
    },
  ],
  schemaVersion: "3.0.0",
  synthetic: true,
};
const CASES_V4 = {
  cases: [
    {
      caseId: "same-input-quality-evaluation-distinct-lifecycle-invocations",
      expectedStatus: "evaluated_not_met",
      replay: true,
    },
    {
      caseId: "declared-reference-digest-mismatch",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "quality-capability-replay",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "reference-content-at-commit",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "original-archive-tamper",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "original-amendment-role-swap",
      expectedStatus: "quarantined",
      replay: false,
    },
  ],
  schemaVersion: "4.0.0",
  synthetic: true,
};
const CASES_V5 = {
  cases: [
    {
      caseId:
        "same-input-custody-quality-evaluation-distinct-custody-invocations",
      expectedStatus: "evaluated_not_met",
      replay: true,
    },
    {
      caseId: "declared-reference-digest-mismatch",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "custody-quality-capability-replay",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "reference-content-at-commit",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "original-archive-tamper",
      expectedStatus: "quarantined",
      replay: false,
    },
    {
      caseId: "original-amendment-role-swap",
      expectedStatus: "quarantined",
      replay: false,
    },
  ],
  schemaVersion: "5.0.0",
  synthetic: true,
};

await verify();
async function verify(): Promise<void> {
  await verifyVersion("v1", CASES_V1, "1.0.0", 4, 3);
  await verifyVersion("v2", CASES_V2, "2.0.0", 6, 5);
  await verifyVersion("v3", CASES_V3, "3.0.0", 6, 5);
  await verifyVersion("v4", CASES_V4, "4.0.0", 6, 5);
  await verifyVersion("v5", CASES_V5, "5.0.0", 6, 5);
}
async function verifyVersion(
  version: "v1" | "v2" | "v3" | "v4" | "v5",
  expectedCases: unknown,
  schemaVersion: "1.0.0" | "2.0.0" | "3.0.0" | "4.0.0" | "5.0.0",
  caseCount: 4 | 6,
  quarantinedCases: 3 | 5,
): Promise<void> {
  const directory = resolve(fixtureRoot, version);
  if (
    relative(root, directory).startsWith("..") ||
    (await realpath(directory)) !== directory
  )
    fail();
  const entries = await readdir(directory, { withFileTypes: true });
  if (
    entries.length !== 2 ||
    entries.some(
      (e) => !e.isFile() || !["cases.json", "manifest.json"].includes(e.name),
    )
  )
    fail();
  const casesBytes = await exact(resolve(directory, "cases.json"), 65_536);
  const cases = strictJson(casesBytes);
  if (JSON.stringify(cases) !== JSON.stringify(expectedCases)) fail();
  const successCountKey =
    version === "v4" || version === "v5"
      ? "evaluatedNotMetCases"
      : "agreedCases";
  const manifest = record(
    strictJson(await exact(resolve(directory, "manifest.json"), 65_536)),
    [
      successCountKey,
      "caseCount",
      "casesSha256",
      "files",
      "quarantinedCases",
      "schemaVersion",
      "synthetic",
    ],
  );
  if (
    manifest[successCountKey] !== 1 ||
    manifest.caseCount !== caseCount ||
    manifest.quarantinedCases !== quarantinedCases ||
    manifest.schemaVersion !== schemaVersion ||
    manifest.synthetic !== true ||
    manifest.casesSha256 !== sha(casesBytes) ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== FILES.length
  )
    fail();
  for (const [index, path] of FILES.entries()) {
    const entry = record(manifest.files[index], ["path", "sha256"]);
    if (
      entry.path !== path ||
      typeof entry.sha256 !== "string" ||
      !HASH.test(entry.sha256) ||
      !SAFE.test(path) ||
      isAbsolute(path)
    )
      fail();
    const target = resolve(root, path);
    if (
      relative(root, target).startsWith("..") ||
      sha(await exact(target, 2_097_152)) !== entry.sha256
    )
      fail();
  }
}
async function exact(path: string, max: number): Promise<Uint8Array> {
  const info = await lstat(path);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size <= 0 ||
    info.size > max ||
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
    parsed = JSON.parse(text);
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
function sha(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
function fail(): never {
  throw new Error("Filing parser cross-engine execution fixtures are invalid.");
}
