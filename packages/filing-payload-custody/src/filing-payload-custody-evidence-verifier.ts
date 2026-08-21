import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";

import {
  FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS,
  filingPayloadCustodyEvidenceSha256,
  parseCanonicalFilingPayloadCustodyEvidence,
  type FilingPayloadCustodyEvidence,
} from "./filing-payload-custody-evidence";

const BASELINE_REVISION = "ba97f43c10f7472151d4cd073c93904f04b1fdcf" as const;
const CYCLE_2D_BASELINE_REVISION =
  "c0bbab34535cdfd7c590d774a1dad521de92fee9" as const;
const MAX_EVIDENCE_BYTES = 1_048_576;
const MAX_GIT_BYTES = 4_194_304;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u;
const RUN_ID = /^[1-9][0-9]{0,19}$/u;
const CYCLE_2C_EVIDENCE_NOTE_PATH =
  "docs/FILING_PAYLOAD_CUSTODY_EVIDENCE.md" as const;
const CYCLE_2D_PACKAGE_TREE = Object.freeze(
  [
    "packages/filing-fact-normalization/package.json",
    "packages/filing-fact-normalization/src/filing-fact-normalization-security.test.ts",
    "packages/filing-fact-normalization/src/filing-fact-normalization.test.ts",
    "packages/filing-fact-normalization/src/filing-fact-normalization.ts",
    "packages/filing-fact-normalization/src/index.ts",
    "packages/filing-fact-normalization/src/test-filing-fact-builder.ts",
    "packages/filing-fact-normalization/tsconfig.json",
  ].sort(),
);
const CYCLE_2D_TRANSITION = Object.freeze(
  [
    { path: "LICENSE_POLICY.md", status: "M" },
    { path: "README.md", status: "M" },
    { path: "docs/BUILD_ROADMAP.md", status: "M" },
    { path: "docs/CANONICAL_MODEL.md", status: "M" },
    { path: "docs/CYCLE_2B_EXIT_MATRIX.md", status: "M" },
    { path: "docs/CYCLE_2C_EXIT_MATRIX.md", status: "M" },
    { path: "docs/CYCLE_2D_EXIT_MATRIX.md", status: "A" },
    { path: "docs/THREAT_MODEL.md", status: "M" },
    {
      path: "docs/adr/0029-fixed-public-filing-candidate-manifest-admission.md",
      status: "M",
    },
    {
      path: "docs/adr/0030-bounded-synthetic-filing-payload-custody.md",
      status: "M",
    },
    {
      path: "docs/adr/0031-bounded-synthetic-ten-fact-normalization-and-lineage.md",
      status: "A",
    },
    { path: "packages/filing-fact-normalization/package.json", status: "A" },
    {
      path: "packages/filing-fact-normalization/src/filing-fact-normalization-security.test.ts",
      status: "A",
    },
    {
      path: "packages/filing-fact-normalization/src/filing-fact-normalization.test.ts",
      status: "A",
    },
    {
      path: "packages/filing-fact-normalization/src/filing-fact-normalization.ts",
      status: "A",
    },
    { path: "packages/filing-fact-normalization/src/index.ts", status: "A" },
    {
      path: "packages/filing-fact-normalization/src/test-filing-fact-builder.ts",
      status: "A",
    },
    { path: "packages/filing-fact-normalization/tsconfig.json", status: "A" },
    {
      path: "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
      status: "M",
    },
    {
      path: "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
      status: "M",
    },
    {
      path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
      status: "M",
    },
    {
      path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
      status: "M",
    },
    { path: "pnpm-lock.yaml", status: "M" },
    { path: "scripts/verify-boundaries.ts", status: "M" },
  ].sort((left, right) => left.path.localeCompare(right.path)),
);
const CYCLE_2D_TRANSITION_PATHS = new Set(
  CYCLE_2D_TRANSITION.map((entry) => entry.path),
);

const CYCLE_2C_DIFF_ALLOWLIST = new Set([
  ".github/workflows/filing-payload-custody-acceptance.yml",
  "LICENSE_POLICY.md",
  "README.md",
  "docs/BUILD_ROADMAP.md",
  "docs/CANONICAL_MODEL.md",
  "docs/CYCLE_2C_EXIT_MATRIX.md",
  CYCLE_2C_EVIDENCE_NOTE_PATH,
  "docs/THREAT_MODEL.md",
  "docs/adr/0030-bounded-synthetic-filing-payload-custody.md",
  "fixtures/synthetic/filing-payload-custody/v1/cases.json",
  "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
  "package.json",
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-parser/src/parser-boundary.test.ts",
  "packages/filing-payload-custody/package.json",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-review.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-review.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence.ts",
  "packages/filing-payload-custody/src/index.ts",
  "packages/filing-payload-custody/src/payload-custody-security.test.ts",
  "packages/filing-payload-custody/src/payload-custody.test.ts",
  "packages/filing-payload-custody/src/payload-custody.ts",
  "packages/filing-payload-custody/src/run-filing-payload-custody-acceptance.ts",
  "packages/filing-payload-custody/src/run-filing-payload-custody-evidence-review.ts",
  "packages/filing-payload-custody/src/test-payload-builder.ts",
  "packages/filing-payload-custody/tsconfig.json",
  "pnpm-lock.yaml",
  "scripts/verify-boundaries.ts",
  "scripts/verify-filing-payload-custody-fixtures.ts",
]);
const CYCLE_2C_DIFF_PATHS = Object.freeze([...CYCLE_2C_DIFF_ALLOWLIST].sort());
const CYCLE_2C_LEGACY_DIFF_PATHS = Object.freeze(
  CYCLE_2C_DIFF_PATHS.filter((path) => path !== CYCLE_2C_EVIDENCE_NOTE_PATH),
);
const CYCLE_2D_CUMULATIVE_DIFF_PATHS = Object.freeze(
  [
    ...new Set([
      ...CYCLE_2C_DIFF_PATHS,
      ...CYCLE_2D_TRANSITION.map((entry) => entry.path),
    ]),
  ].sort(),
);

const EXPECTED_PACKAGE_TREE = [...CYCLE_2C_DIFF_ALLOWLIST]
  .filter((path) => path.startsWith("packages/filing-payload-custody/"))
  .sort();
const EXPECTED_FIXTURE_TREE = [...CYCLE_2C_DIFF_ALLOWLIST]
  .filter((path) =>
    path.startsWith("fixtures/synthetic/filing-payload-custody/v1/"),
  )
  .sort();
const EXPECTED_MANIFEST_FILES = [
  "packages/filing-payload-custody/src/payload-custody-security.test.ts",
  "packages/filing-payload-custody/src/payload-custody.test.ts",
  "packages/filing-payload-custody/src/payload-custody.ts",
  "packages/filing-payload-custody/src/test-payload-builder.ts",
] as const;

export interface FilingPayloadCustodyEvidenceReviewOptions {
  readonly evidencePath: string;
  readonly expectedEvidenceSha256: `sha256:${string}`;
  readonly expectedRepository: string;
  readonly expectedRevision: string;
  readonly expectedRunAttempt: number;
  readonly expectedRunId: string;
  readonly repositoryPath: string;
}

export interface FilingPayloadCustodyEvidenceReview {
  readonly evidenceSha256: `sha256:${string}`;
  readonly recordedChecksPassed: FilingPayloadCustodyEvidence["checksPassed"];
  readonly recordedNotProven: FilingPayloadCustodyEvidence["notProven"];
  readonly repository: string;
  readonly revision: string;
  readonly runAttempt: number;
  readonly runId: string;
  readonly sourceHashCount: number;
  readonly verdict: "offline_consistent";
}

export async function verifyFilingPayloadCustodyEvidenceOffline(
  options: FilingPayloadCustodyEvidenceReviewOptions,
): Promise<FilingPayloadCustodyEvidenceReview> {
  try {
    const normalizedOptions = normalizeOptions(options);
    const evidenceBytes = await readSmallRegularFile(
      normalizedOptions.evidencePath,
      MAX_EVIDENCE_BYTES,
    );
    const evidence = parseCanonicalFilingPayloadCustodyEvidence(evidenceBytes);
    const evidenceSha256 = filingPayloadCustodyEvidenceSha256(evidence);
    if (
      evidenceSha256 !== normalizedOptions.expectedEvidenceSha256 ||
      evidence.repository !== normalizedOptions.expectedRepository ||
      evidence.revision !== normalizedOptions.expectedRevision ||
      evidence.workflow.runAttempt !== normalizedOptions.expectedRunAttempt ||
      evidence.workflow.runId !== normalizedOptions.expectedRunId
    )
      invalid();

    const repositoryPath = await realpath(normalizedOptions.repositoryPath);
    const repository = await lstat(repositoryPath);
    if (!repository.isDirectory() || repository.isSymbolicLink()) invalid();
    await git(
      repositoryPath,
      ["cat-file", "-e", `${normalizedOptions.expectedRevision}^{commit}`],
      0,
    );
    await verifyCycle2cCommitBoundary(
      repositoryPath,
      normalizedOptions.expectedRevision,
    );

    const committed = new Map<string, Uint8Array>();
    for (
      let index = 0;
      index < FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS.length;
      index += 1
    ) {
      const path = FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS[index];
      const recorded = evidence.sourceHashes[index];
      if (
        path === undefined ||
        recorded === undefined ||
        recorded.path !== path
      )
        invalid();
      const bytes = await git(repositoryPath, [
        "show",
        `${normalizedOptions.expectedRevision}:${path}`,
      ]);
      if (sha256(bytes) !== recorded.sha256) invalid();
      committed.set(path, bytes);
    }

    const manifestBytes = required(
      committed,
      "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
    );
    if (sha256(manifestBytes) !== evidence.fixtureManifestSha256) invalid();
    verifyFixtureChain(committed, manifestBytes, evidence.sourceHashes);

    return Object.freeze({
      evidenceSha256,
      recordedChecksPassed: evidence.checksPassed,
      recordedNotProven: evidence.notProven,
      repository: evidence.repository,
      revision: evidence.revision,
      runAttempt: evidence.workflow.runAttempt,
      runId: evidence.workflow.runId,
      sourceHashCount: evidence.sourceHashes.length,
      verdict: "offline_consistent",
    });
  } catch {
    return invalid();
  }
}

export async function verifyCycle2cCommitBoundary(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${BASELINE_REVISION}^{commit}`],
    0,
  );
  await git(
    repositoryPath,
    ["merge-base", "--is-ancestor", BASELINE_REVISION, revision],
    0,
  );
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "-z",
      BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2cCommitDiffSetAllowed(entries)) invalid();
  const packageTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-payload-custody",
  );
  const fixtureTree = await tree(
    repositoryPath,
    revision,
    "fixtures/synthetic/filing-payload-custody/v1",
  );
  const normalizationTree = await tree(
    repositoryPath,
    revision,
    "packages/filing-fact-normalization",
  );
  if (
    !exactList(packageTree, EXPECTED_PACKAGE_TREE) ||
    !exactList(fixtureTree, EXPECTED_FIXTURE_TREE) ||
    !isCycle2dNormalizationTreeAllowed(normalizationTree)
  )
    invalid();
  if (normalizationTree.length > 0)
    await verifyCycle2dTransition(repositoryPath, revision);
}

/** @internal Exact commit-boundary regression seam. */
export function isCycle2cCommitDiffEntryAllowed(
  status: string | undefined,
  path: string | undefined,
): boolean {
  return (
    (status === "A" || status === "M") &&
    path !== undefined &&
    (CYCLE_2C_DIFF_ALLOWLIST.has(path) || CYCLE_2D_TRANSITION_PATHS.has(path))
  );
}

/** @internal Exact cumulative milestone-diff regression seam. */
export function isCycle2cCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const paths = entries.map((entry) => entry.path).sort();
  return (
    entries.every((entry) =>
      isCycle2cCommitDiffEntryAllowed(entry.status, entry.path),
    ) &&
    (exactList(paths, CYCLE_2C_LEGACY_DIFF_PATHS) ||
      exactList(paths, CYCLE_2C_DIFF_PATHS) ||
      exactList(paths, CYCLE_2D_CUMULATIVE_DIFF_PATHS))
  );
}

/** @internal Exact package/fixture tree regression seam. */
export function isCycle2cTreeAllowed(
  packagePaths: readonly string[],
  fixturePaths: readonly string[],
): boolean {
  return (
    exactList(packagePaths, EXPECTED_PACKAGE_TREE) &&
    exactList(fixturePaths, EXPECTED_FIXTURE_TREE)
  );
}

/** @internal Exact disconnected-successor tree regression seam. */
export function isCycle2dNormalizationTreeAllowed(
  paths: readonly string[],
): boolean {
  return paths.length === 0 || exactList(paths, CYCLE_2D_PACKAGE_TREE);
}

/** @internal Exact successor-transition regression seam. */
export function isCycle2dCommitDiffSetAllowed(
  entries: readonly {
    readonly path: string;
    readonly status: string;
  }[],
): boolean {
  const sorted = [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  return (
    sorted.length === CYCLE_2D_TRANSITION.length &&
    sorted.every((entry, index) => {
      const expected = CYCLE_2D_TRANSITION[index];
      return (
        expected !== undefined &&
        entry.path === expected.path &&
        entry.status === expected.status
      );
    })
  );
}

async function verifyCycle2dTransition(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2D_BASELINE_REVISION}^{commit}`],
    0,
  );
  await git(
    repositoryPath,
    ["merge-base", "--is-ancestor", CYCLE_2D_BASELINE_REVISION, revision],
    0,
  );
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "-z",
      CYCLE_2D_BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (diff.length % 2 !== 0) invalid();
  const entries: Array<{ readonly path: string; readonly status: string }> = [];
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (status === undefined || path === undefined) invalid();
    entries.push(Object.freeze({ path, status }));
  }
  if (!isCycle2dCommitDiffSetAllowed(entries)) invalid();
}

/** @internal Strict NUL-framed Git output regression seam. */
export function decodeCycle2cGitNulList(bytes: Uint8Array): readonly string[] {
  return Object.freeze(splitNul(bytes));
}

function verifyFixtureChain(
  sources: ReadonlyMap<string, Uint8Array>,
  manifestBytes: Uint8Array,
  sourceHashes: readonly { readonly path: string; readonly sha256: string }[],
): void {
  const manifest = parseExactJson(manifestBytes);
  if (
    !isExactRecord(manifest, [
      "caseCount",
      "casesSha256",
      "files",
      "schemaVersion",
      "synthetic",
    ])
  )
    invalid();
  if (
    manifest.caseCount !== 1 ||
    manifest.schemaVersion !== "1.0.0" ||
    manifest.synthetic !== true
  )
    invalid();
  const manifestFiles = unknownArray(manifest.files);
  const cases = required(
    sources,
    "fixtures/synthetic/filing-payload-custody/v1/cases.json",
  );
  if (manifest.casesSha256 !== sha256(cases)) invalid();
  const caseDocument = parseExactJson(cases);
  if (!isExactRecord(caseDocument, ["cases", "schemaVersion", "synthetic"]))
    invalid();
  if (
    caseDocument.schemaVersion !== "1.0.0" ||
    caseDocument.synthetic !== true ||
    !Array.isArray(caseDocument.cases) ||
    caseDocument.cases.length !== 1 ||
    canonicalJson(caseDocument.cases[0]) !==
      '{"expected":{"status":"passed"},"id":"single_generated_payload_lifecycle"}'
  )
    invalid();
  if (manifestFiles.length !== EXPECTED_MANIFEST_FILES.length) invalid();
  for (let index = 0; index < EXPECTED_MANIFEST_FILES.length; index += 1) {
    const path = EXPECTED_MANIFEST_FILES[index];
    const entry = manifestFiles[index];
    if (
      path === undefined ||
      !isExactRecord(entry, ["path", "sha256"]) ||
      entry.path !== path ||
      entry.sha256 !== sha256(required(sources, path)) ||
      sourceHashes.find((source) => source.path === path)?.sha256 !==
        entry.sha256
    )
      invalid();
  }
}

function normalizeOptions(
  options: FilingPayloadCustodyEvidenceReviewOptions,
): FilingPayloadCustodyEvidenceReviewOptions {
  const keys = [
    "evidencePath",
    "expectedEvidenceSha256",
    "expectedRepository",
    "expectedRevision",
    "expectedRunAttempt",
    "expectedRunId",
    "repositoryPath",
  ] as const;
  if (
    typeof options !== "object" ||
    options === null ||
    Object.getPrototypeOf(options) !== Object.prototype ||
    !exactList(
      Reflect.ownKeys(options)
        .map((key) => (typeof key === "string" ? key : invalid()))
        .sort(),
      [...keys].sort(),
    )
  )
    invalid();
  const descriptors = Object.getOwnPropertyDescriptors(options);
  if (
    keys.some((key) => {
      const descriptor = descriptors[key];
      return (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      );
    })
  )
    invalid();
  const values = Object.fromEntries(
    keys.map((key) => [key, descriptors[key]?.value]),
  ) as Record<(typeof keys)[number], unknown>;
  if (
    typeof values.evidencePath !== "string" ||
    values.evidencePath.length === 0 ||
    typeof values.repositoryPath !== "string" ||
    values.repositoryPath.length === 0 ||
    typeof values.expectedEvidenceSha256 !== "string" ||
    !SHA256.test(values.expectedEvidenceSha256) ||
    typeof values.expectedRepository !== "string" ||
    !REPOSITORY.test(values.expectedRepository) ||
    typeof values.expectedRevision !== "string" ||
    !COMMIT.test(values.expectedRevision) ||
    typeof values.expectedRunId !== "string" ||
    !RUN_ID.test(values.expectedRunId) ||
    !Number.isSafeInteger(values.expectedRunAttempt) ||
    (values.expectedRunAttempt as number) < 1
  )
    invalid();
  return Object.freeze({
    evidencePath: values.evidencePath,
    expectedEvidenceSha256: values.expectedEvidenceSha256 as `sha256:${string}`,
    expectedRepository: values.expectedRepository,
    expectedRevision: values.expectedRevision,
    expectedRunAttempt: values.expectedRunAttempt as number,
    expectedRunId: values.expectedRunId,
    repositoryPath: values.repositoryPath,
  });
}

async function tree(
  repositoryPath: string,
  revision: string,
  path: string,
): Promise<string[]> {
  return splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      path,
    ]),
  ).map(
    (entry) =>
      /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry)?.[1] ?? invalid(),
  );
}

async function readSmallRegularFile(
  path: string,
  limit: number,
): Promise<Uint8Array> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size < 1 || before.size > limit) invalid();
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
    if (
      offset !== before.size ||
      after.size !== before.size ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs
    )
      invalid();
    return new Uint8Array(bounded.subarray(0, offset));
  } finally {
    await handle.close();
  }
}

async function git(
  cwd: string,
  args: readonly string[],
  expectedExit = 0,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > MAX_GIT_BYTES) child.kill();
      else target.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== expectedExit || bytes > MAX_GIT_BYTES || stderr.length > 0)
        reject(new Error("git failed"));
      else resolve(new Uint8Array(Buffer.concat(stdout)));
    });
  });
}

function required(
  values: ReadonlyMap<string, Uint8Array>,
  path: string,
): Uint8Array {
  return values.get(path) ?? invalid();
}

function parseExactJson(bytes: Uint8Array): unknown {
  let text: string;
  let value: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
    value = JSON.parse(text);
  } catch {
    return invalid();
  }
  if (`${JSON.stringify(value, null, 2)}\n` !== text) invalid();
  return value;
}

function isExactRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
  );
}

function unknownArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? (value as readonly unknown[]) : invalid();
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null) invalid();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function splitNul(bytes: Uint8Array): string[] {
  const text = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  if (text.length === 0) return [];
  if (text.includes("\ufeff") || !text.endsWith("\0")) invalid();
  const entries = text.slice(0, -1).split("\0");
  if (entries.some((entry) => entry.length === 0)) invalid();
  return entries;
}

function exactList(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index])
  );
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function invalid(): never {
  throw new Error("Offline filing payload custody evidence review failed.");
}
