import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { types as utilTypes } from "node:util";

import {
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS,
  filingParserNormalizationExecutionEvidenceSha256,
  parseCanonicalFilingParserNormalizationExecutionEvidence,
} from "./filing-parser-normalization-execution-evidence";

export interface FilingParserNormalizationExecutionEvidenceReviewOptions {
  readonly evidencePath: string;
  readonly expectedEvidenceSha256: `sha256:${string}`;
  readonly expectedRepository: string;
  readonly expectedRevision: string;
  readonly expectedRunAttempt: number;
  readonly expectedRunId: string;
  readonly repositoryPath: string;
}

export interface FilingParserNormalizationExecutionEvidenceReview {
  readonly evidenceSha256: `sha256:${string}`;
  readonly repository: string;
  readonly revision: string;
  readonly runAttempt: number;
  readonly runId: string;
  readonly sourceHashCount: number;
  readonly verdict: "offline_consistent";
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u;
const MAX_EVIDENCE_BYTES = 1_048_576;
const MAX_GIT_OUTPUT_BYTES = 4_194_304;
const isProxy = utilTypes.isProxy;

export async function verifyFilingParserNormalizationExecutionEvidenceOffline(
  options: FilingParserNormalizationExecutionEvidenceReviewOptions,
): Promise<FilingParserNormalizationExecutionEvidenceReview> {
  const normalizedOptions =
    normalizeFilingParserNormalizationExecutionEvidenceReviewOptions(options);
  if (
    !HASH.test(normalizedOptions.expectedEvidenceSha256) ||
    !COMMIT.test(normalizedOptions.expectedRevision) ||
    !Number.isSafeInteger(normalizedOptions.expectedRunAttempt) ||
    normalizedOptions.expectedRunAttempt < 1 ||
    !/^[1-9][0-9]{0,19}$/u.test(normalizedOptions.expectedRunId) ||
    !isAbsolute(normalizedOptions.repositoryPath)
  )
    return invalid();
  const repositoryPath = await realpath(normalizedOptions.repositoryPath);
  const topLevel = decodeExactLine(
    await git(repositoryPath, ["rev-parse", "--show-toplevel"]),
  );
  if (resolve(topLevel) !== resolve(repositoryPath)) return invalid();
  await git(repositoryPath, [
    "cat-file",
    "-e",
    `${normalizedOptions.expectedRevision}^{commit}`,
  ]);
  const revision = decodeRevisionLine(
    await git(repositoryPath, [
      "rev-parse",
      `${normalizedOptions.expectedRevision}^{commit}`,
    ]),
  );
  if (revision !== normalizedOptions.expectedRevision) return invalid();

  const evidenceBytes = await readExactRegularFile(
    normalizedOptions.evidencePath,
  );
  const evidence =
    parseCanonicalFilingParserNormalizationExecutionEvidence(evidenceBytes);
  const evidenceSha256 =
    filingParserNormalizationExecutionEvidenceSha256(evidence);
  if (
    evidenceSha256 !== normalizedOptions.expectedEvidenceSha256 ||
    evidence.repository !== normalizedOptions.expectedRepository ||
    evidence.revision !== normalizedOptions.expectedRevision ||
    evidence.workflow.runAttempt !== normalizedOptions.expectedRunAttempt ||
    evidence.workflow.runId !== normalizedOptions.expectedRunId ||
    evidence.sourceHashes.length !==
      FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS.length
  )
    return invalid();

  for (const [
    index,
    expectedPath,
  ] of FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS.entries()) {
    const source = evidence.sourceHashes[index];
    if (source?.path !== expectedPath) return invalid();
    const committed = await git(repositoryPath, [
      "show",
      `${normalizedOptions.expectedRevision}:${expectedPath}`,
    ]);
    if (sha256(committed) !== source.sha256) return invalid();
  }
  const fixtureManifest = evidence.sourceHashes.find(
    ({ path }) =>
      path ===
      "fixtures/synthetic/filing-parser-normalization-execution/v1/manifest.json",
  );
  if (fixtureManifest?.sha256 !== evidence.fixtureManifestSha256)
    return invalid();

  return Object.freeze({
    evidenceSha256,
    repository: evidence.repository,
    revision: evidence.revision,
    runAttempt: evidence.workflow.runAttempt,
    runId: evidence.workflow.runId,
    sourceHashCount: evidence.sourceHashes.length,
    verdict: "offline_consistent" as const,
  });
}

/** @internal Exported for hostile-anchor regression tests. */
export function normalizeFilingParserNormalizationExecutionEvidenceReviewOptions(
  options: FilingParserNormalizationExecutionEvidenceReviewOptions,
): FilingParserNormalizationExecutionEvidenceReviewOptions {
  try {
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
      isProxy(options) ||
      Object.getPrototypeOf(options) !== Object.prototype
    )
      return invalid();
    const ownKeys = Reflect.ownKeys(options);
    if (
      ownKeys.some((key) => typeof key !== "string") ||
      JSON.stringify((ownKeys as string[]).sort()) !==
        JSON.stringify([...keys].sort())
    )
      return invalid();
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
      return invalid();
    const values = Object.fromEntries(
      keys.map((key) => [key, descriptors[key]?.value]),
    ) as Record<(typeof keys)[number], unknown>;
    if (
      typeof values.evidencePath !== "string" ||
      !isAbsolute(values.evidencePath) ||
      typeof values.repositoryPath !== "string" ||
      !isAbsolute(values.repositoryPath) ||
      typeof values.expectedEvidenceSha256 !== "string" ||
      !HASH.test(values.expectedEvidenceSha256) ||
      typeof values.expectedRepository !== "string" ||
      !REPOSITORY.test(values.expectedRepository) ||
      typeof values.expectedRevision !== "string" ||
      !COMMIT.test(values.expectedRevision) ||
      !Number.isSafeInteger(values.expectedRunAttempt) ||
      (values.expectedRunAttempt as number) < 1 ||
      typeof values.expectedRunId !== "string" ||
      !/^[1-9][0-9]{0,19}$/u.test(values.expectedRunId)
    )
      return invalid();
    return Object.freeze({
      evidencePath: values.evidencePath,
      expectedEvidenceSha256:
        values.expectedEvidenceSha256 as `sha256:${string}`,
      expectedRepository: values.expectedRepository,
      expectedRevision: values.expectedRevision,
      expectedRunAttempt: values.expectedRunAttempt as number,
      expectedRunId: values.expectedRunId,
      repositoryPath: values.repositoryPath,
    });
  } catch {
    return invalid();
  }
}

async function readExactRegularFile(path: string): Promise<Uint8Array> {
  if (!isAbsolute(path)) return invalid();
  const canonicalBefore = await realpath(path);
  if (!samePath(canonicalBefore, resolve(path))) return invalid();
  const before = await lstat(path);
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.size <= 0 ||
    before.size > MAX_EVIDENCE_BYTES
  )
    return invalid();
  const noFollow = process.platform === "win32" ? 0 : fsConstants.O_NOFOLLOW;
  const handle = await open(path, fsConstants.O_RDONLY | noFollow);
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.size !== before.size ||
      (before.ino !== 0 && opened.ino !== before.ino) ||
      (before.dev !== 0 && opened.dev !== before.dev)
    )
      return invalid();
    const output = new Uint8Array(opened.size + 1);
    let offset = 0;
    while (offset < output.byteLength) {
      const { bytesRead } = await handle.read(
        output,
        offset,
        output.byteLength - offset,
        offset,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await handle.stat();
    const pathAfter = await lstat(path);
    const canonicalAfter = await realpath(path);
    if (
      after.size !== opened.size ||
      after.mtimeMs !== opened.mtimeMs ||
      after.ctimeMs !== opened.ctimeMs ||
      pathAfter.isSymbolicLink() ||
      !pathAfter.isFile() ||
      pathAfter.size !== opened.size ||
      pathAfter.mtimeMs !== opened.mtimeMs ||
      pathAfter.ctimeMs !== opened.ctimeMs ||
      !samePath(canonicalAfter, canonicalBefore) ||
      (opened.ino !== 0 && after.ino !== opened.ino) ||
      (opened.dev !== 0 && after.dev !== opened.dev) ||
      (opened.ino !== 0 && pathAfter.ino !== opened.ino) ||
      (opened.dev !== 0 && pathAfter.dev !== opened.dev) ||
      offset !== opened.size
    )
      return invalid();
    return output.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

function samePath(left: string, right: string): boolean {
  return relative(left, right) === "" && relative(right, left) === "";
}

async function git(
  repositoryPath: string,
  args: readonly string[],
): Promise<Uint8Array> {
  const executable = await trustedGitExecutable();
  const environment = cleanGitEnvironment(process.env);
  const fullArgs = filingParserNormalizationExecutionGitArguments(
    repositoryPath,
    args,
  );
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, fullArgs, {
      env: environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const finish = (error?: Error, value?: Uint8Array): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error !== undefined) rejectPromise(error);
      else resolvePromise(value ?? new Uint8Array());
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("Offline evidence review failed."));
    }, 30_000);
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > MAX_GIT_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(new Error("Offline evidence review failed."));
      } else stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > 65_536) {
        child.kill("SIGKILL");
        finish(new Error("Offline evidence review failed."));
      }
    });
    child.once("error", (error) => finish(error));
    child.once("close", (code, signal) => {
      if (code !== 0 || signal !== null || stderrBytes !== 0)
        finish(new Error("Offline evidence review failed."));
      else finish(undefined, Uint8Array.from(Buffer.concat(stdout)));
    });
  });
}

/** @internal Exported for hostile-environment regression tests. */
export function filingParserNormalizationExecutionGitArguments(
  repositoryPath: string,
  args: readonly string[],
): readonly string[] {
  return Object.freeze([
    "--no-replace-objects",
    "--no-lazy-fetch",
    "-c",
    "advice.graftFileDeprecated=false",
    "-C",
    repositoryPath,
    ...args,
  ]);
}

/** @internal Exported for hostile-environment regression tests. */
export function cleanGitEnvironment(
  ambient: Readonly<NodeJS.ProcessEnv>,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(ambient)) {
    if (
      !/^GIT_/iu.test(key) &&
      key.toUpperCase() !== "GCM_INTERACTIVE" &&
      !/^(?:LD|DYLD)_/iu.test(key)
    )
      environment[key] = value;
  }
  const nullDevice = platform === "win32" ? "NUL" : "/dev/null";
  environment.GIT_ATTR_NOSYSTEM = "1";
  environment.GIT_CONFIG_COUNT = "0";
  environment.GIT_CONFIG_GLOBAL = nullDevice;
  environment.GIT_CONFIG_NOSYSTEM = "1";
  environment.GIT_CONFIG_SYSTEM = nullDevice;
  environment.GIT_GRAFT_FILE = nullDevice;
  environment.GIT_NO_LAZY_FETCH = "1";
  environment.GIT_NO_REPLACE_OBJECTS = "1";
  environment.GIT_OPTIONAL_LOCKS = "0";
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.GCM_INTERACTIVE = "Never";
  return Object.freeze(environment);
}

async function trustedGitExecutable(): Promise<string> {
  const candidates =
    process.platform === "win32"
      ? [
          join("C:\\Program Files", "Git", "cmd", "git.exe"),
          join("C:\\Program Files", "Git", "bin", "git.exe"),
        ]
      : ["/usr/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"];
  for (const candidate of candidates) {
    try {
      const resolved = await realpath(candidate);
      const info = await lstat(resolved);
      if (isAbsolute(resolved) && info.isFile() && !info.isSymbolicLink())
        return resolved;
    } catch {
      // Try only the next fixed absolute installation path.
    }
  }
  return invalid();
}

function decodeExactLine(value: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      value,
    );
  } catch {
    return invalid();
  }
  if (
    text.includes("\ufeff") ||
    !text.endsWith("\n") ||
    text.length <= 1 ||
    /[\0\r\n]/u.test(text.slice(0, -1))
  )
    return invalid();
  return text.slice(0, -1);
}

function decodeRevisionLine(value: Uint8Array): string {
  const revision = decodeExactLine(value);
  if (!COMMIT.test(revision)) return invalid();
  return revision;
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function invalid(): never {
  throw new Error(
    "Offline filing parser normalization execution evidence review failed.",
  );
}
