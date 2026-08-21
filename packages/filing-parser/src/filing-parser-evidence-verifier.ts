import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { spawn } from "node:child_process";

import {
  FILING_PARSER_EVIDENCE_SOURCE_PATHS,
  filingParserEvidenceSha256,
  parseCanonicalFilingParserEvidence,
  type FilingParserEvidence,
} from "./filing-parser-evidence";
import { FILING_PARSER_QUARANTINE_CODES } from "./parser-boundary";

const MAX_EVIDENCE_BYTES = 1_048_576;
const MAX_GIT_BLOB_BYTES = 4_194_304;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const RUN_ID = /^[1-9][0-9]{0,19}$/;
const CYCLE_2A_BASELINE_REVISION =
  "6d42175beb7e7c3f58a4143bc2e9b1fd73977439" as const;
const CYCLE_2A_DISCONNECTED_SUCCESSOR_SOURCE_PATHS = Object.freeze([
  "packages/filing-parser/src/corpus-admission-security.test.ts",
  "packages/filing-parser/src/corpus-admission.test.ts",
  "packages/filing-parser/src/corpus-admission.ts",
]);
const CYCLE_2C_DISCONNECTED_SUCCESSOR_TREE = Object.freeze(
  [
    "fixtures/synthetic/filing-payload-custody/v1/cases.json",
    "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
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
  ].sort(),
);
const CYCLE_2A_LEGACY_EVIDENCE_NOTE_TREE = Object.freeze([
  "docs/FILING_PARSER_ISOLATION_EVIDENCE.md",
]);
const CYCLE_2C_SUCCESSOR_EVIDENCE_NOTE_TREE = Object.freeze([
  ...CYCLE_2A_LEGACY_EVIDENCE_NOTE_TREE,
  "docs/FILING_PAYLOAD_CUSTODY_EVIDENCE.md",
]);

const CYCLE_2A_DIFF_ALLOWLIST = new Set([
  ".github/workflows/ci.yml",
  ".github/workflows/filing-parser-acceptance.yml",
  ".github/workflows/filing-payload-custody-acceptance.yml",
  "LICENSE_POLICY.md",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "docs/BUILD_ROADMAP.md",
  "docs/CANONICAL_MODEL.md",
  "docs/CYCLE_2A_EXIT_MATRIX.md",
  "docs/CYCLE_2B_EXIT_MATRIX.md",
  "docs/CYCLE_2C_EXIT_MATRIX.md",
  "docs/FILING_PARSER_ISOLATION_EVIDENCE.md",
  "docs/FILING_PAYLOAD_CUSTODY_EVIDENCE.md",
  "docs/THREAT_MODEL.md",
  "docs/adr/0028-bounded-synthetic-filing-parser-isolation.md",
  "docs/adr/0029-fixed-public-filing-candidate-manifest-admission.md",
  "docs/adr/0030-bounded-synthetic-filing-payload-custody.md",
  "fixtures/synthetic/filing-parser/v1/cases.json",
  "fixtures/synthetic/filing-parser/v1/manifest.json",
  "package.json",
  "packages/filing-parser/acceptance/python-image.json",
  "packages/filing-parser/package.json",
  "packages/filing-parser/src/filing-parser-evidence-review.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-parser/src/filing-parser-evidence.test.ts",
  "packages/filing-parser/src/filing-parser-evidence.ts",
  "packages/filing-parser/src/index.ts",
  "packages/filing-parser/src/parser-boundary.test.ts",
  "packages/filing-parser/src/parser-boundary.ts",
  "packages/filing-parser/src/parser-security.test.ts",
  "packages/filing-parser/src/run-filing-parser-acceptance.ts",
  "packages/filing-parser/src/run-filing-parser-evidence-review.ts",
  "packages/filing-parser/src/test-archive-builder.ts",
  "packages/filing-parser/tsconfig.json",
  "packages/filing-parser/worker/Dockerfile",
  "packages/filing-parser/worker/parser.py",
  "packages/filing-parser/worker/taxonomy-v1.json",
  "pnpm-lock.yaml",
  "scripts/verify-boundaries.ts",
  "scripts/verify-filing-parser-fixtures.ts",
  "scripts/verify-filing-payload-custody-fixtures.ts",
  ...CYCLE_2A_DISCONNECTED_SUCCESSOR_SOURCE_PATHS,
  ...CYCLE_2C_DISCONNECTED_SUCCESSOR_TREE,
]);

const LEGACY_CYCLE_2A_PARSER_DOMAIN_TREE = Object.freeze(
  [...CYCLE_2A_DIFF_ALLOWLIST]
    .filter(
      (path) =>
        (path.startsWith("packages/filing-parser/") ||
          path.startsWith("fixtures/synthetic/filing-parser/v1/")) &&
        !CYCLE_2A_DISCONNECTED_SUCCESSOR_SOURCE_PATHS.includes(path),
    )
    .sort(),
);
const SUCCESSOR_COMPATIBLE_CYCLE_2A_PARSER_DOMAIN_TREE = Object.freeze(
  [
    ...LEGACY_CYCLE_2A_PARSER_DOMAIN_TREE,
    ...CYCLE_2A_DISCONNECTED_SUCCESSOR_SOURCE_PATHS,
  ].sort(),
);

const PYTHON_IMAGE = Object.freeze({
  cpythonLicense: "Python Software Foundation License Version 2",
  cpythonLicenseUrl: "https://docs.python.org/3.12/license.html",
  containerPackageLicenseInventoryStatus: "not_proven_ci_acceptance_only",
  distribution: "Debian GNU/Linux 12 (bookworm) slim",
  image:
    "docker.io/library/python:3.12.13-slim-bookworm@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
  indexDigest:
    "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
  officialImageDefinitionUrl:
    "https://github.com/docker-library/official-images/blob/master/library/python",
  officialRegistryManifestUrl:
    "https://registry-1.docker.io/v2/library/python/manifests/3.12.13-slim-bookworm",
  platform: "linux/amd64",
  platformManifestDigest:
    "sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af",
  pythonVersion: "3.12.13",
  schemaVersion: 1,
  tag: "3.12.13-slim-bookworm",
});

const FROZEN_POSTGRES_V14_SOURCE_HASHES = Object.freeze([
  {
    path: ".github/workflows/postgres-acceptance.yml",
    sha256:
      "sha256:5f8ab0336cfb9fc35363f5b69d5db4564eaa79c7dd7fc16eecb266aa902e844f",
  },
  {
    path: "packages/db/src/postgres-acceptance-evidence.ts",
    sha256:
      "sha256:4988f3e358923c22d84ef1defc34c8078085f65bccc34a0f3996ce4520001b4e",
  },
  {
    path: "packages/db/src/postgres-acceptance-evidence-verifier.ts",
    sha256:
      "sha256:290b3ba06e1077c528cd3d636de48049ebde9ef1c70819e3527da0d46e38d3cb",
  },
  {
    path: "packages/db/src/postgres-acceptance-evidence-review.ts",
    sha256:
      "sha256:089034320a561c5768f1beaf630a19f106e9839093ca52f87fed2efbb27708dc",
  },
  {
    path: "packages/db/src/run-postgres-acceptance-evidence-review.ts",
    sha256:
      "sha256:7c4f2abd9310cbab7df55474ace97c69ef12ce35b585c528a46a538b4cd1f87c",
  },
] as const);

export interface FilingParserEvidenceReviewOptions {
  readonly evidencePath: string;
  readonly expectedEvidenceSha256: `sha256:${string}`;
  readonly expectedRepository: string;
  readonly expectedRevision: string;
  readonly expectedRunAttempt: number;
  readonly expectedRunId: string;
  readonly repositoryPath: string;
}

export interface FilingParserEvidenceReview {
  readonly evidenceSha256: `sha256:${string}`;
  readonly recordedChecksPassed: FilingParserEvidence["checksPassed"];
  readonly recordedNotProven: FilingParserEvidence["notProven"];
  readonly repository: string;
  readonly revision: string;
  readonly runAttempt: number;
  readonly runId: string;
  readonly sourceHashCount: number;
  readonly verdict: "offline_consistent";
}

export async function verifyFilingParserEvidenceOffline(
  options: FilingParserEvidenceReviewOptions,
): Promise<FilingParserEvidenceReview> {
  try {
    return await verifyFilingParserEvidenceOfflineInternal(options);
  } catch {
    return invalidReview();
  }
}

async function verifyFilingParserEvidenceOfflineInternal(
  options: FilingParserEvidenceReviewOptions,
): Promise<FilingParserEvidenceReview> {
  validateOptions(options);
  const evidenceBytes = await readSmallRegularFile(
    options.evidencePath,
    MAX_EVIDENCE_BYTES,
  );
  const evidence = parseCanonicalFilingParserEvidence(evidenceBytes);
  const evidenceSha256 = filingParserEvidenceSha256(evidence);
  if (
    evidenceSha256 !== options.expectedEvidenceSha256 ||
    evidence.repository !== options.expectedRepository ||
    evidence.revision !== options.expectedRevision ||
    evidence.workflow.runId !== options.expectedRunId ||
    evidence.workflow.runAttempt !== options.expectedRunAttempt
  )
    invalidReview();

  const repositoryPath = await realpath(options.repositoryPath);
  const repositoryStat = await lstat(repositoryPath);
  if (!repositoryStat.isDirectory() || repositoryStat.isSymbolicLink())
    invalidReview();
  await git(
    repositoryPath,
    ["cat-file", "-e", `${options.expectedRevision}^{commit}`],
    0,
  );
  await verifyCycle2aCommitBoundary(repositoryPath, options.expectedRevision);

  const committedSources = new Map<string, Uint8Array>();
  for (
    let index = 0;
    index < FILING_PARSER_EVIDENCE_SOURCE_PATHS.length;
    index += 1
  ) {
    const path = FILING_PARSER_EVIDENCE_SOURCE_PATHS[index];
    const recorded = evidence.sourceHashes[index];
    if (path === undefined || recorded === undefined || recorded.path !== path)
      invalidReview();
    const bytes = await git(repositoryPath, [
      "show",
      `${options.expectedRevision}:${path}`,
    ]);
    committedSources.set(path, bytes);
    if (sha256(bytes) !== recorded.sha256) invalidReview();
  }

  const imageConfig = parseExactJson(
    requiredSource(
      committedSources,
      "packages/filing-parser/acceptance/python-image.json",
    ),
  );
  if (canonicalJson(imageConfig) !== canonicalJson(PYTHON_IMAGE))
    invalidReview();
  if (
    evidence.image.baseIndexDigest !== PYTHON_IMAGE.indexDigest ||
    evidence.image.basePlatformManifestDigest !==
      PYTHON_IMAGE.platformManifestDigest
  )
    invalidReview();

  const dockerfile = new TextDecoder("utf-8", { fatal: true }).decode(
    requiredSource(
      committedSources,
      "packages/filing-parser/worker/Dockerfile",
    ),
  );
  if (`FROM ${PYTHON_IMAGE.image}` !== dockerfile.split(/\r?\n/u)[0])
    invalidReview();

  const manifestBytes = requiredSource(
    committedSources,
    "fixtures/synthetic/filing-parser/v1/manifest.json",
  );
  if (sha256(manifestBytes) !== evidence.fixtureManifestSha256) invalidReview();
  verifyFixtureManifestChain(committedSources, manifestBytes, evidence);

  for (const historical of FROZEN_POSTGRES_V14_SOURCE_HASHES) {
    const bytes = await git(repositoryPath, [
      "show",
      `${options.expectedRevision}:${historical.path}`,
    ]);
    if (sha256(bytes) !== historical.sha256) invalidReview();
  }

  return Object.freeze({
    evidenceSha256,
    recordedChecksPassed: evidence.checksPassed,
    recordedNotProven: evidence.notProven,
    repository: evidence.repository,
    revision: evidence.revision,
    runAttempt: evidence.workflow.runAttempt,
    runId: evidence.workflow.runId,
    sourceHashCount: evidence.sourceHashes.length,
    verdict: "offline_consistent" as const,
  });
}

function verifyFixtureManifestChain(
  sources: ReadonlyMap<string, Uint8Array>,
  manifestBytes: Uint8Array,
  evidence: FilingParserEvidence,
): void {
  const manifest = exactRecord(parseExactJson(manifestBytes), [
    "acceptedCases",
    "caseCount",
    "casesSha256",
    "files",
    "quarantinedCases",
    "schemaVersion",
    "synthetic",
  ]);
  const casesBytes = requiredSource(
    sources,
    "fixtures/synthetic/filing-parser/v1/cases.json",
  );
  if (
    manifest.acceptedCases !== 3 ||
    manifest.caseCount !== 103 ||
    manifest.casesSha256 !== sha256(casesBytes) ||
    manifest.quarantinedCases !== 100 ||
    manifest.schemaVersion !== "1.0.0" ||
    manifest.synthetic !== true
  )
    invalidReview();

  const expectedFiles = [
    "packages/filing-parser/acceptance/python-image.json",
    "packages/filing-parser/src/test-archive-builder.ts",
    "packages/filing-parser/worker/Dockerfile",
    "packages/filing-parser/worker/parser.py",
    "packages/filing-parser/worker/taxonomy-v1.json",
  ] as const;
  if (
    !Array.isArray(manifest.files) ||
    manifest.files.length !== expectedFiles.length
  )
    invalidReview();
  for (let index = 0; index < expectedFiles.length; index += 1) {
    const path = expectedFiles[index];
    const file = exactRecord(manifest.files[index], ["path", "sha256"]);
    if (
      path === undefined ||
      file.path !== path ||
      file.sha256 !== sha256(requiredSource(sources, path))
    )
      invalidReview();
  }

  const casesDocument = exactRecord(parseExactJson(casesBytes), [
    "cases",
    "schemaVersion",
    "synthetic",
  ]);
  if (
    casesDocument.schemaVersion !== "1.0.0" ||
    casesDocument.synthetic !== true ||
    !Array.isArray(casesDocument.cases) ||
    casesDocument.cases.length !== 103 ||
    evidence.caseOutcomes.length !== 103
  )
    invalidReview();
  const ids = new Set<string>();
  let accepted = 0;
  let quarantined = 0;
  for (let index = 0; index < casesDocument.cases.length; index += 1) {
    const fixtureCase = exactRecord(casesDocument.cases[index], [
      "archiveSha256",
      "expected",
      "id",
    ]);
    const id = stringMatching(fixtureCase.id, /^[a-z][a-z0-9_]{2,79}$/u);
    const archiveSha256 = stringMatching(
      fixtureCase.archiveSha256,
      SHA256,
    ) as `sha256:${string}`;
    if (ids.has(id)) invalidReview();
    ids.add(id);
    const expected = fixtureCase.expected;
    if (!isRecord(expected)) invalidReview();
    let expectedStatus: "accepted" | "quarantined";
    let expectedCode: string | null;
    if (expected.status === "accepted") {
      exactRecord(expected, ["status"]);
      accepted += 1;
      expectedStatus = "accepted";
      expectedCode = null;
    } else {
      const quarantine = exactRecord(expected, ["code", "status"]);
      if (
        quarantine.status !== "quarantined" ||
        !FILING_PARSER_QUARANTINE_CODES.includes(quarantine.code as never)
      )
        invalidReview();
      quarantined += 1;
      expectedStatus = "quarantined";
      expectedCode = quarantine.code as string;
    }
    const outcome = evidence.caseOutcomes[index];
    if (
      outcome === undefined ||
      outcome.caseId !== id ||
      outcome.sourceSha256 !== archiveSha256 ||
      outcome.expectedStatus !== expectedStatus ||
      outcome.observedStatus !== expectedStatus ||
      outcome.quarantineCode !== expectedCode
    )
      invalidReview();
  }
  if (
    accepted !== 3 ||
    quarantined !== 100 ||
    !ids.has("accepted_canonical") ||
    !ids.has("accepted_exact_replay") ||
    !ids.has("accepted_decimal_boundaries")
  )
    invalidReview();
}

export async function verifyCycle2aCommitBoundary(
  repositoryPath: string,
  revision: string,
): Promise<void> {
  await git(
    repositoryPath,
    ["cat-file", "-e", `${CYCLE_2A_BASELINE_REVISION}^{commit}`],
    0,
  );
  await git(
    repositoryPath,
    ["merge-base", "--is-ancestor", CYCLE_2A_BASELINE_REVISION, revision],
    0,
  );
  const diff = splitNul(
    await git(repositoryPath, [
      "diff",
      "--name-status",
      "-z",
      CYCLE_2A_BASELINE_REVISION,
      revision,
      "--",
    ]),
  );
  if (diff.length % 2 !== 0) invalidReview();
  for (let index = 0; index < diff.length; index += 2) {
    const status = diff[index];
    const path = diff[index + 1];
    if (!isCycle2aCommitDiffEntryAllowed(status, path)) invalidReview();
  }

  const evidenceNoteTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      ...CYCLE_2C_SUCCESSOR_EVIDENCE_NOTE_TREE,
    ]),
  );
  const evidenceNotePaths = evidenceNoteTreeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (!isCycle2aEvidenceNoteTreeAllowed(evidenceNotePaths)) invalidReview();

  const treeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-parser",
      "fixtures/synthetic/filing-parser/v1",
    ]),
  );
  const paths = treeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (!isCycle2aParserDomainTreeAllowed(paths)) invalidReview();

  const custodyTreeEntries = splitNul(
    await git(repositoryPath, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      revision,
      "--",
      "packages/filing-payload-custody",
      "fixtures/synthetic/filing-payload-custody/v1",
    ]),
  );
  const custodyPaths = custodyTreeEntries.map((entry) => {
    const match = /^100644 blob [0-9a-f]{40}\t(.+)$/u.exec(entry);
    return match?.[1] ?? invalidReview();
  });
  if (!isCycle2aDisconnectedCustodyTreeAllowed(custodyPaths)) invalidReview();
}

/** @internal Exported only for exact commit-boundary regression tests. */
export function isCycle2aCommitDiffEntryAllowed(
  status: string | undefined,
  path: string | undefined,
): boolean {
  return (
    (status === "A" || status === "M") &&
    path !== undefined &&
    CYCLE_2A_DIFF_ALLOWLIST.has(path)
  );
}

/** @internal Exported only for exact historical-note regression tests. */
export function isCycle2aEvidenceNoteTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2A_LEGACY_EVIDENCE_NOTE_TREE) ||
    exactPathList(paths, CYCLE_2C_SUCCESSOR_EVIDENCE_NOTE_TREE)
  );
}

/** @internal Exported only for exact commit-boundary regression tests. */
export function isCycle2aParserDomainTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    exactPathList(paths, LEGACY_CYCLE_2A_PARSER_DOMAIN_TREE) ||
    exactPathList(paths, SUCCESSOR_COMPATIBLE_CYCLE_2A_PARSER_DOMAIN_TREE)
  );
}

/** @internal Exported only for exact disconnected-successor regression tests. */
export function isCycle2aDisconnectedCustodyTreeAllowed(
  paths: readonly string[],
): boolean {
  return (
    paths.length === 0 ||
    exactPathList(paths, CYCLE_2C_DISCONNECTED_SUCCESSOR_TREE)
  );
}

function exactPathList(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((path, index) => path === expected[index])
  );
}

function validateOptions(options: FilingParserEvidenceReviewOptions): void {
  if (
    typeof options !== "object" ||
    options === null ||
    typeof options.evidencePath !== "string" ||
    options.evidencePath.length === 0 ||
    typeof options.repositoryPath !== "string" ||
    options.repositoryPath.length === 0 ||
    !SHA256.test(options.expectedEvidenceSha256) ||
    !REPOSITORY.test(options.expectedRepository) ||
    !COMMIT_SHA.test(options.expectedRevision) ||
    !RUN_ID.test(options.expectedRunId) ||
    !Number.isSafeInteger(options.expectedRunAttempt) ||
    options.expectedRunAttempt < 1
  )
    invalidReview();
}

async function readSmallRegularFile(
  path: string,
  maximumBytes: number,
): Promise<Uint8Array> {
  const stat = await lstat(path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size < 2 ||
    stat.size > maximumBytes
  )
    invalidReview();
  return Uint8Array.from(await readFile(path));
}

function requiredSource(
  sources: ReadonlyMap<string, Uint8Array>,
  path: string,
): Uint8Array {
  const value = sources.get(path);
  return value ?? invalidReview();
}

function parseExactJson(bytes: Uint8Array): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value = JSON.parse(text) as unknown;
    if (`${JSON.stringify(value, null, 2)}\n` !== text) invalidReview();
    return value;
  } catch {
    return invalidReview();
  }
}

function exactRecord<const TKeys extends readonly string[]>(
  value: unknown,
  keys: TKeys,
): Readonly<Record<TKeys[number], unknown>> {
  if (!isRecord(value)) invalidReview();
  const actual = Object.keys(value);
  if (
    actual.length !== keys.length ||
    actual.some((key) => !keys.includes(key))
  )
    invalidReview();
  return value as Readonly<Record<TKeys[number], unknown>>;
}

function stringMatching(value: unknown, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) invalidReview();
  return value;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) invalidReview();
    return String(value);
  }
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (!isRecord(value)) invalidReview();
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function splitNul(value: Uint8Array): string[] {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    return invalidReview();
  }
  if (text.length === 0) return [];
  if (!text.endsWith("\u0000")) return invalidReview();
  return text.slice(0, -1).split("\u0000");
}

function git(
  repositoryPath: string,
  args: readonly string[],
  maximumOutputBytes = MAX_GIT_BLOB_BYTES,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["-C", repositoryPath, ...args], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let failed = false;
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > maximumOutputBytes) {
        failed = true;
        child.kill("SIGKILL");
        return;
      }
      stdout.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > 16_384) {
        failed = true;
        child.kill("SIGKILL");
      }
    });
    child.on("error", () =>
      reject(new Error("Offline evidence review failed.")),
    );
    child.on("close", (code) => {
      if (failed || code !== 0 || stderrBytes !== 0) {
        reject(new Error("Offline evidence review failed."));
        return;
      }
      resolve(Uint8Array.from(Buffer.concat(stdout)));
    });
  });
}

function invalidReview(): never {
  throw new Error("Offline evidence review failed.");
}
