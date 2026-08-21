import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import {
  FILING_PAYLOAD_CUSTODY_EVIDENCE_CHECKS,
  FILING_PAYLOAD_CUSTODY_EVIDENCE_NOT_PROVEN,
  FILING_PAYLOAD_CUSTODY_EVIDENCE_SCHEMA_VERSION,
  FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS,
  FILING_PAYLOAD_CUSTODY_EVIDENCE_WORKFLOW,
  createFilingPayloadCustodyEvidence,
  filingPayloadCustodyEvidenceSha256,
  serializeCanonicalFilingPayloadCustodyEvidence,
  type FilingPayloadCustodyEvidenceSourceHash,
} from "./filing-payload-custody-evidence";
import { verifyCycle2cCommitBoundary } from "./filing-payload-custody-evidence-verifier";
import {
  FILING_PAYLOAD_CUSTODY_ALGORITHM,
  FILING_PAYLOAD_CUSTODY_CLAIM,
  FILING_PAYLOAD_CUSTODY_FIXTURE,
  FILING_PAYLOAD_CUSTODY_LIMITS,
  FILING_PAYLOAD_CUSTODY_RETENTION_POLICY,
  FilingPayloadCustodyError,
  createFileSystemFilingPayloadCustodyTestHarness,
  type FilingPayloadCustodyEntropy,
  type FilingPayloadCustodyErrorCode,
  type FilingPayloadKeyStore,
  type FilingPayloadStageCommand,
} from "./payload-custody";
import { buildFilingPayloadCustodyAcceptanceCases } from "./test-payload-builder";

const EVIDENCE_FILE_NAME = "research-cockpit-filing-payload-custody-v1.json";
const MAX_COMMAND_BYTES = 4_194_304;

type Stage =
  | "bootstrap"
  | "commit_boundary"
  | "environment"
  | "fixture"
  | "first_lifecycle"
  | "second_lifecycle"
  | "source_hashes"
  | "tool_versions"
  | "evidence"
  | "write";

let stage: Stage = "bootstrap";

try {
  await main();
} catch {
  process.stderr.write(
    `filing_payload_custody_acceptance_failed stage=${stage}\n`,
  );
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const repositoryPath = process.cwd();
  stage = "environment";
  const evidencePath = await trustedEvidencePath(
    requiredEnvironment("FILING_PAYLOAD_CUSTODY_EVIDENCE_PATH"),
    requiredEnvironment("RUNNER_TEMP"),
  );
  if (
    process.env.CI !== "true" ||
    process.platform !== "linux" ||
    process.arch !== "x64" ||
    (
      await git(repositoryPath, [
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
      ])
    ).byteLength !== 0
  )
    fail();
  const revision = text(await git(repositoryPath, ["rev-parse", "HEAD"]));
  if (!/^[0-9a-f]{40}$/u.test(revision)) fail();

  stage = "commit_boundary";
  await verifyCycle2cCommitBoundary(repositoryPath, revision);

  stage = "source_hashes";
  const committed = new Map<string, Uint8Array>();
  const sourceHashes: FilingPayloadCustodyEvidenceSourceHash[] = [];
  for (const path of FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS) {
    const bytes = await git(repositoryPath, ["show", `${revision}:${path}`]);
    committed.set(path, bytes);
    sourceHashes.push(Object.freeze({ path, sha256: sha256(bytes) }));
  }
  const manifestBytes = committed.get(
    "fixtures/synthetic/filing-payload-custody/v1/manifest.json",
  );
  if (manifestBytes === undefined) fail();
  const fixtureManifestSha256 = sha256(manifestBytes);

  stage = "fixture";
  const cases = buildFilingPayloadCustodyAcceptanceCases();
  const single = cases[0];
  if (
    cases.length !== 1 ||
    single === undefined ||
    single.expected.status !== "passed"
  )
    fail();
  const expectedPayload = Uint8Array.from(single.payload);
  const plaintextCanary = expectedPayload.slice(1_024, 1_088);
  if (plaintextCanary.byteLength !== 64) fail();
  const parent = await mkdtemp(join(tmpdir(), "payload-custody-acceptance-"));
  let currentTime = new Date();
  const clock = Object.freeze({ now: () => new Date(currentTime) });
  const sourceBindingSha256 = fixtureManifestSha256;
  const command = (payload: Uint8Array): FilingPayloadStageCommand => ({
    contentSha256: FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256,
    fixtureId: FILING_PAYLOAD_CUSTODY_FIXTURE.fixtureId,
    payload,
    retentionClass: FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.class,
    sourceBindingSha256,
  });

  let firstAuditCiphertext: string;
  let createdAt: string;
  let firstDekSha256: `sha256:${string}`;
  let firstKeyId: string;
  let firstNonceSha256: `sha256:${string}`;
  let payloadExpiresAt: string;
  let transitionedAt: string;
  try {
    stage = "first_lifecycle";
    const firstEntropy = observedEntropy();
    const firstKeyStore = observedKeyStore();
    const first = await createFileSystemFilingPayloadCustodyTestHarness({
      clock,
      entropy: firstEntropy.entropy,
      keyStore: firstKeyStore.keyStore,
      workspaceParentDirectory: parent,
    });
    const mutablePayload = Uint8Array.from(single.payload);
    const stagePromise = first.boundary.stage(command(mutablePayload));
    mutablePayload.fill(0);
    const receipt = await stagePromise;
    const firstInsertion = firstKeyStore.onlyInsertion();
    firstDekSha256 = firstInsertion.keySha256;
    firstKeyId = firstInsertion.keyId;
    firstNonceSha256 = firstEntropy.onlyNonceSha256();
    if (
      firstKeyStore.keyIds().length !== 1 ||
      firstKeyStore.read(firstKeyId) === undefined
    )
      fail();
    createdAt = receipt.createdAt;
    payloadExpiresAt = receipt.payloadExpiresAt;
    const readBeforeExpiry = await first.boundary.read({
      payloadId: receipt.payloadId,
    });
    if (!Buffer.from(readBeforeExpiry).equals(Buffer.from(expectedPayload)))
      fail();
    const replay = await first.boundary.stage(
      command(Uint8Array.from(expectedPayload)),
    );
    if (JSON.stringify(replay) !== JSON.stringify(receipt)) fail();
    const firstAudit = await first.boundary.inspectAudit({
      payloadId: receipt.payloadId,
    });
    firstAuditCiphertext = firstAudit.ciphertextSha256;
    if (
      !auditIsValueFree(firstAudit) ||
      !(await bytesAbsent(first.workspaceDirectory, plaintextCanary))
    )
      fail();
    await expectCode(
      first.boundary.expire({ payloadId: receipt.payloadId }),
      "retention_active",
    );
    currentTime = new Date(payloadExpiresAt);
    await expectCode(
      first.boundary.read({ payloadId: receipt.payloadId }),
      "payload_expired",
    );
    const expired = await first.boundary.expire({
      payloadId: receipt.payloadId,
    });
    if (
      expired.state !== "logical_key_unavailability" ||
      expired.transitionedAt !== payloadExpiresAt ||
      firstKeyStore.read(firstKeyId) !== undefined ||
      firstKeyStore.keyIds().length !== 0
    )
      fail();
    transitionedAt = expired.transitionedAt;
    await expectCode(
      first.boundary.read({ payloadId: receipt.payloadId }),
      "payload_unavailable",
    );
    await expectCode(
      first.boundary.stage(command(Uint8Array.from(expectedPayload))),
      "resurrection_blocked",
    );
    const repeatedExpiry = await first.boundary.expire({
      payloadId: receipt.payloadId,
    });
    if (JSON.stringify(repeatedExpiry) !== JSON.stringify(expired)) fail();
    const terminalAudit = await first.boundary.inspectAudit({
      payloadId: receipt.payloadId,
    });
    if (
      terminalAudit.state !== "logical_key_unavailability" ||
      !auditIsValueFree(terminalAudit)
    )
      fail();
    await first.boundary.close();

    stage = "second_lifecycle";
    currentTime = new Date(createdAt);
    const secondEntropy = observedEntropy();
    const secondKeyStore = observedKeyStore();
    const second = await createFileSystemFilingPayloadCustodyTestHarness({
      clock,
      entropy: secondEntropy.entropy,
      keyStore: secondKeyStore.keyStore,
      workspaceParentDirectory: parent,
    });
    const secondReceipt = await second.boundary.stage(
      command(Uint8Array.from(expectedPayload)),
    );
    const secondAudit = await second.boundary.inspectAudit({
      payloadId: secondReceipt.payloadId,
    });
    const secondInsertion = secondKeyStore.onlyInsertion();
    const secondNonceSha256 = secondEntropy.onlyNonceSha256();
    if (
      secondAudit.ciphertextSha256 === firstAuditCiphertext ||
      secondInsertion.keyId === firstKeyId ||
      secondInsertion.keySha256 === firstDekSha256 ||
      secondNonceSha256 === firstNonceSha256
    )
      fail();
    await second.boundary.close();
    if (
      secondKeyStore.keyIds().length !== 0 ||
      (await readdir(parent)).length !== 0
    )
      fail();
  } finally {
    await rm(parent, { force: true, recursive: true });
  }

  stage = "tool_versions";
  const tools = Object.freeze({
    git: text(await commandOutput("git", ["--version"])),
    node: process.version,
    pnpm: text(await commandOutput("pnpm", ["--version"])),
  });

  stage = "evidence";
  const evidence = createFilingPayloadCustodyEvidence({
    checksPassed: FILING_PAYLOAD_CUSTODY_EVIDENCE_CHECKS,
    claim: FILING_PAYLOAD_CUSTODY_CLAIM,
    completedAt: new Date().toISOString(),
    evidenceVersion: 1,
    fixtureManifestSha256,
    lifecycle: {
      auditValueFree: true,
      contentSha256: FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256,
      createdAt,
      distinctCiphertextObserved: true,
      earlyExpiryRejected: true,
      exactReplayMatched: true,
      keyUnavailableAfterExpiry: true,
      payloadBytes: FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength,
      payloadExpiresAt,
      plaintextCanaryAbsent: true,
      postExpiryReadDenied: true,
      preExpiryReadMatched: true,
      sourceBindingSha256,
      terminalState: "logical_key_unavailability",
      transitionedAt,
      zeroResidue: true,
    },
    notProven: FILING_PAYLOAD_CUSTODY_EVIDENCE_NOT_PROVEN,
    repository: requiredEnvironment("GITHUB_REPOSITORY"),
    revision,
    runtime: {
      algorithm: FILING_PAYLOAD_CUSTODY_ALGORITHM.name,
      architecture: "x64",
      keyBytes: FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes,
      maximumPayloadBytes: FILING_PAYLOAD_CUSTODY_LIMITS.payloadBytes,
      nonceBytes: FILING_PAYLOAD_CUSTODY_ALGORITHM.nonceBytes,
      operatingSystem: "linux",
      retentionMilliseconds:
        FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.payloadMilliseconds,
      tagBytes: FILING_PAYLOAD_CUSTODY_ALGORITHM.tagBytes,
    },
    schemaVersion: FILING_PAYLOAD_CUSTODY_EVIDENCE_SCHEMA_VERSION,
    sourceHashes,
    startedAt,
    status: "passed",
    synthetic: true,
    tools,
    workflow: {
      event: workflowEvent(requiredEnvironment("GITHUB_EVENT_NAME")),
      job: "acceptance",
      ref: requiredEnvironment("GITHUB_REF"),
      runAttempt: positiveInteger(requiredEnvironment("GITHUB_RUN_ATTEMPT")),
      runId: requiredEnvironment("GITHUB_RUN_ID"),
      workflowName: FILING_PAYLOAD_CUSTODY_EVIDENCE_WORKFLOW,
    },
  });

  stage = "write";
  const serialized = serializeCanonicalFilingPayloadCustodyEvidence(evidence);
  await writeFile(evidencePath, serialized, { flag: "wx", mode: 0o600 });
  const retained = new Uint8Array(await readFile(evidencePath));
  if (Buffer.from(retained).toString("utf8") !== serialized) fail();
  process.stdout.write(
    `filing_payload_custody_acceptance_passed evidence_sha256=${filingPayloadCustodyEvidenceSha256(evidence)}\n`,
  );
}

async function expectCode(
  operation: Promise<unknown>,
  code: FilingPayloadCustodyErrorCode,
): Promise<void> {
  try {
    await operation;
  } catch (error) {
    if (
      error instanceof FilingPayloadCustodyError &&
      error.code === code &&
      error.message === "FILING_PAYLOAD_CUSTODY_FAILURE"
    )
      return;
  }
  fail();
}

function auditIsValueFree(value: object): boolean {
  const record = value as Record<string, unknown>;
  return (
    !("keyId" in record) &&
    !("nonce" in record) &&
    !("authTag" in record) &&
    !JSON.stringify(value).includes(
      "research-cockpit:synthetic-filing-payload-custody",
    )
  );
}

async function bytesAbsent(
  directory: string,
  canary: Uint8Array,
): Promise<boolean> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) return false;
    if (entry.isDirectory()) {
      if (!(await bytesAbsent(path, canary))) return false;
    } else if (
      !entry.isFile() ||
      Buffer.from(await readFile(path)).includes(Buffer.from(canary))
    )
      return false;
  }
  return true;
}

function observedEntropy(): {
  readonly entropy: FilingPayloadCustodyEntropy;
  readonly onlyNonceSha256: () => `sha256:${string}`;
} {
  const nonceHashes: `sha256:${string}`[] = [];
  return Object.freeze({
    entropy: Object.freeze({
      bytes: (length: number): Uint8Array => {
        const value = Uint8Array.from(randomBytes(length));
        if (length === FILING_PAYLOAD_CUSTODY_ALGORITHM.nonceBytes)
          nonceHashes.push(sha256(value));
        return value;
      },
    }),
    onlyNonceSha256: (): `sha256:${string}` =>
      nonceHashes.length === 1 && nonceHashes[0] !== undefined
        ? nonceHashes[0]
        : fail(),
  });
}

function observedKeyStore(): {
  readonly keyIds: () => readonly string[];
  readonly keyStore: FilingPayloadKeyStore;
  readonly onlyInsertion: () => {
    readonly keyId: string;
    readonly keySha256: `sha256:${string}`;
  };
  readonly read: (keyId: string) => Uint8Array | undefined;
} {
  const insertions: {
    keyId: string;
    keySha256: `sha256:${string}`;
  }[] = [];
  const keys = new Map<string, Uint8Array>();
  const read = (keyId: string): Uint8Array | undefined => {
    const value = keys.get(keyId);
    return value === undefined ? undefined : Uint8Array.from(value);
  };
  return Object.freeze({
    keyIds: () => [...keys.keys()].sort(),
    keyStore: Object.freeze({
      forget: (keyId: string): "forgotten" | "missing" => {
        const value = keys.get(keyId);
        if (value === undefined) return "missing";
        value.fill(0);
        keys.delete(keyId);
        return "forgotten";
      },
      putIfAbsent: (keyId: string, key: Uint8Array): boolean => {
        if (keys.has(keyId)) return false;
        const snapshot = Uint8Array.from(key);
        keys.set(keyId, snapshot);
        insertions.push({ keyId, keySha256: sha256(snapshot) });
        return true;
      },
      read,
    }),
    onlyInsertion: () => {
      const insertion = insertions[0];
      return insertions.length === 1 && insertion !== undefined
        ? { keyId: insertion.keyId, keySha256: insertion.keySha256 }
        : fail();
    },
    read,
  });
}

async function trustedEvidencePath(
  evidencePath: string,
  runnerTemp: string,
): Promise<string> {
  if (
    !isAbsolute(evidencePath) ||
    !isAbsolute(runnerTemp) ||
    resolve(evidencePath) !== evidencePath ||
    resolve(runnerTemp) !== runnerTemp ||
    basename(evidencePath) !== EVIDENCE_FILE_NAME
  )
    fail();
  const trustedParent = await realpath(runnerTemp);
  const evidenceParent = await realpath(dirname(evidencePath));
  const metadata = await lstat(trustedParent);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    evidenceParent !== trustedParent ||
    evidencePath !== join(trustedParent, EVIDENCE_FILE_NAME)
  )
    fail();
  return evidencePath;
}

async function git(cwd: string, args: readonly string[]): Promise<Uint8Array> {
  return commandOutput("git", args, cwd);
}

async function commandOutput(
  command: string,
  args: readonly string[],
  cwd = process.cwd(),
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let total = 0;
    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > MAX_COMMAND_BYTES) child.kill();
      else target.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0 || total > MAX_COMMAND_BYTES || stderr.length > 0)
        reject(new Error("command failed"));
      else resolve(new Uint8Array(Buffer.concat(stdout)));
    });
  });
}

function requiredEnvironment(key: string): string {
  const value = process.env[key];
  return value === undefined || value.length === 0 ? fail() : value;
}

function workflowEvent(
  value: string,
): "pull_request" | "push" | "workflow_dispatch" {
  return value === "pull_request" ||
    value === "push" ||
    value === "workflow_dispatch"
    ? value
    : fail();
}

function positiveInteger(value: string): number {
  if (!/^[1-9][0-9]{0,8}$/u.test(value)) fail();
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fail();
}

function text(bytes: Uint8Array): string {
  const value = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
    .decode(bytes)
    .trim();
  return /^[\x20-\x7e]{1,200}$/u.test(value) ? value : fail();
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fail(): never {
  throw new Error("Filing payload custody acceptance failed.");
}
