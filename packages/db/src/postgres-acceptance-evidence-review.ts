import { spawn } from "node:child_process";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { parsePostgresAcceptanceEvidence } from "./postgres-acceptance-evidence";
import {
  verifyPostgresAcceptanceEvidenceOffline,
  type VerifiedPostgresAcceptanceEvidence,
} from "./postgres-acceptance-evidence-verifier";

const MAX_EVIDENCE_BYTES = 32_768;
const MAX_GIT_STDERR_BYTES = 8_192;
const MAX_GIT_METADATA_BYTES = 64 * 1_024;
const MAX_IMAGE_CONFIG_BYTES = 32 * 1_024;
const MAX_WORKFLOW_BYTES = 128 * 1_024;
const MAX_FIXTURE_BYTES = 1 * 1_024 * 1_024;
const MAX_MANIFEST_BYTES = 64 * 1_024;
const MAX_ACCEPTANCE_RUNNER_BYTES = 2 * 1_024 * 1_024;
const MAX_PROJECTION_QUERY_BYTES = 2 * 1_024 * 1_024;
const MAX_PROJECTION_NORMALIZER_BYTES = 2 * 1_024 * 1_024;
const MAX_PLATFORM_BOOTSTRAP_V2_BYTES = 2 * 1_024 * 1_024;
const MAX_APPLICATION_MANIFEST_V2_BYTES = 64 * 1_024;
const MAX_AUTHENTICATED_MIGRATION_RENDERER_V2_BYTES = 2 * 1_024 * 1_024;
const MAX_RESTORE_PLATFORM_V1_BYTES = 2 * 1_024 * 1_024;
const MAX_AUTHENTICATED_BACKUP_RESTORE_PLAN_V1_BYTES = 2 * 1_024 * 1_024;
const MAX_MIGRATION_BYTES = 2 * 1_024 * 1_024;
const MAX_MIGRATION_COUNT = 100;
const MAX_TOTAL_MIGRATION_BYTES = 32 * 1_024 * 1_024;
const GIT_TIMEOUT_MILLISECONDS = 10_000;

const IMAGE_CONFIG_PATH = "packages/db/acceptance/postgres-image.json";
const WORKFLOW_PATH = ".github/workflows/postgres-acceptance.yml";
const FIXTURE_PATH = "packages/db/acceptance/synthetic-fixture.sql";
const MIGRATION_MANIFEST_PATH = "packages/db/migration-manifest.json";
const ACCEPTANCE_RUNNER_PATH = "packages/db/src/postgres-acceptance.ts";
const PROJECTION_QUERY_PATH = "packages/db/src/postgres-projection-query.ts";
const PROJECTION_NORMALIZER_PATH =
  "packages/db/src/projection-normalization.ts";
const MIGRATION_DIRECTORY = "packages/db/migrations";
const PLATFORM_BOOTSTRAP_V2_PATH =
  "packages/db/migration-plans/v2/platform-bootstrap.sql";
const APPLICATION_MANIFEST_V2_PATH =
  "packages/db/migration-plans/v2/application-manifest.json";
const AUTHENTICATED_MIGRATION_RENDERER_V2_PATH =
  "packages/db/src/authenticated-migration-plan.ts";
const APPLICATION_MIGRATION_V2_DIRECTORY =
  "packages/db/migration-plans/v2/application";
const MIGRATION_PLAN_V2_DIRECTORY = "packages/db/migration-plans/v2";
const BACKUP_RESTORE_PLAN_V1_DIRECTORY = "packages/db/backup-restore-plans/v1";
const RESTORE_PLATFORM_V1_PATH =
  "packages/db/backup-restore-plans/v1/restore-platform.sql";
const AUTHENTICATED_BACKUP_RESTORE_PLAN_V1_PATH =
  "packages/db/src/authenticated-backup-restore-plan.ts";

const REVIEW_INPUT_KEYS = [
  "evidencePath",
  "repositoryPath",
  "expectedEvidenceSha256",
  "expectedRepository",
  "expectedRepositoryId",
  "expectedCommit",
  "expectedRunId",
  "expectedRunAttempt",
] as const;
const MANIFEST_KEYS = ["schemaVersion", "algorithm", "migrations"] as const;
const APPLICATION_MANIFEST_V2_KEYS = [
  "schemaVersion",
  "planVersion",
  "algorithm",
  "migrations",
] as const;
const MIGRATION_KEYS = ["id", "file", "sha256"] as const;
const APPLICATION_MIGRATION_V2_FILES = Object.freeze([
  "0001_request_context_and_ledger.sql",
  "0002_canonical_entities.sql",
  "0003_temporal_constraints_and_indexes.sql",
  "0004_row_security_and_runtime_grants.sql",
  "0005_non_reusable_resource_ids.sql",
  "0006_null_safe_request_context.sql",
] as const);

const SHA256_HEX = /^[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const MIGRATION_ID = /^[0-9]{4}$/;
const APPLICATION_MIGRATION_V2_ID = /^v2-[0-9]{4}$/;
const MIGRATION_FILE = /^[0-9]{4}_[a-z0-9_]+\.sql$/;

type DataRecord = Readonly<Record<string, unknown>>;

export interface PostgresAcceptanceEvidenceReviewInput {
  readonly evidencePath: string;
  readonly repositoryPath: string;
  readonly expectedEvidenceSha256: string;
  readonly expectedRepository: string;
  readonly expectedRepositoryId: string;
  readonly expectedCommit: string;
  readonly expectedRunId: string;
  readonly expectedRunAttempt: number;
}

interface MigrationManifestEntry {
  readonly id: string;
  readonly file: string;
  readonly sha256: string;
}

interface ApplicationMigrationV2ManifestEntry {
  readonly id: string;
  readonly file: string;
  readonly sha256: string;
}

interface GitTreeEntry {
  readonly mode: string;
  readonly type: string;
  readonly path: string;
}

/** Stable and deliberately value-free across filesystem, Git, and verifier failures. */
export class PostgresAcceptanceEvidenceReviewError extends Error {
  public readonly code = "POSTGRES_ACCEPTANCE_EVIDENCE_REVIEW_FAILED" as const;

  public constructor() {
    super("PostgreSQL acceptance evidence review failed.");
    this.name = "PostgresAcceptanceEvidenceReviewError";
  }
}

/**
 * Reviews one downloaded run record against explicit operator trust anchors
 * and immutable source blobs from the anchored local Git commit. It never
 * consults a remote, fetches objects, or reads source bytes from the worktree.
 */
export async function reviewPostgresAcceptanceEvidence(
  value: PostgresAcceptanceEvidenceReviewInput,
): Promise<VerifiedPostgresAcceptanceEvidence> {
  try {
    const input = normalizeReviewInput(value);
    const [evidenceBytes, repositoryPath] = await Promise.all([
      readBoundedRegularFile(input.evidencePath),
      canonicalRepositoryPath(input.repositoryPath),
    ]);
    const evidence = parsePostgresAcceptanceEvidence(decodeUtf8(evidenceBytes));

    await requireExactGitTopLevel(repositoryPath);
    await requireCommitObject(repositoryPath, input.expectedCommit);

    const [
      imageConfig,
      workflow,
      fixture,
      migrationManifest,
      acceptanceRunner,
    ] = await Promise.all([
      readFixedGitBlob(
        repositoryPath,
        input.expectedCommit,
        IMAGE_CONFIG_PATH,
        MAX_IMAGE_CONFIG_BYTES,
      ),
      readFixedGitBlob(
        repositoryPath,
        input.expectedCommit,
        WORKFLOW_PATH,
        MAX_WORKFLOW_BYTES,
      ),
      readFixedGitBlob(
        repositoryPath,
        input.expectedCommit,
        FIXTURE_PATH,
        MAX_FIXTURE_BYTES,
      ),
      readFixedGitBlob(
        repositoryPath,
        input.expectedCommit,
        MIGRATION_MANIFEST_PATH,
        MAX_MANIFEST_BYTES,
      ),
      readFixedGitBlob(
        repositoryPath,
        input.expectedCommit,
        ACCEPTANCE_RUNNER_PATH,
        MAX_ACCEPTANCE_RUNNER_BYTES,
      ),
    ]);

    const manifestEntries = parseMigrationManifest(migrationManifest);
    const migrations = await readExactMigrationTree(
      repositoryPath,
      input.expectedCommit,
      manifestEntries,
    );
    const projectionSources =
      evidence.schemaVersion === 4 ||
      evidence.schemaVersion === 5 ||
      evidence.schemaVersion === 6 ||
      evidence.schemaVersion === 7 ||
      evidence.schemaVersion === 8
        ? await readProjectionSources(repositoryPath, input.expectedCommit)
        : {};
    const migrationPlanV2Sources =
      evidence.schemaVersion === 7 || evidence.schemaVersion === 8
        ? await readMigrationPlanV2Sources(repositoryPath, input.expectedCommit)
        : {};
    const backupRestorePlanV1Sources =
      evidence.schemaVersion === 8
        ? await readBackupRestorePlanV1Sources(
            repositoryPath,
            input.expectedCommit,
          )
        : {};

    return verifyPostgresAcceptanceEvidenceOffline({
      evidenceBytes: Uint8Array.from(evidenceBytes),
      trustAnchors: {
        evidenceSha256: input.expectedEvidenceSha256,
        repository: input.expectedRepository,
        repositoryId: input.expectedRepositoryId,
        commitSha: input.expectedCommit,
        runId: input.expectedRunId,
        runAttempt: input.expectedRunAttempt,
      },
      sources: {
        imageConfig: Uint8Array.from(imageConfig),
        workflow: Uint8Array.from(workflow),
        fixture: Uint8Array.from(fixture),
        migrationManifest: Uint8Array.from(migrationManifest),
        acceptanceRunner: Uint8Array.from(acceptanceRunner),
        migrations,
        ...projectionSources,
        ...migrationPlanV2Sources,
        ...backupRestorePlanV1Sources,
      },
    });
  } catch {
    throw new PostgresAcceptanceEvidenceReviewError();
  }
}

async function readBackupRestorePlanV1Sources(
  repositoryPath: string,
  commit: string,
): Promise<{
  readonly restorePlatformV1: Uint8Array;
  readonly authenticatedBackupRestorePlanV1: Uint8Array;
}> {
  await requireExactBackupRestorePlanV1Tree(repositoryPath, commit);
  const [restorePlatformV1, authenticatedBackupRestorePlanV1] =
    await Promise.all([
      readFixedGitBlob(
        repositoryPath,
        commit,
        RESTORE_PLATFORM_V1_PATH,
        MAX_RESTORE_PLATFORM_V1_BYTES,
      ),
      readFixedGitBlob(
        repositoryPath,
        commit,
        AUTHENTICATED_BACKUP_RESTORE_PLAN_V1_PATH,
        MAX_AUTHENTICATED_BACKUP_RESTORE_PLAN_V1_BYTES,
      ),
    ]);
  return Object.freeze({
    restorePlatformV1: Uint8Array.from(restorePlatformV1),
    authenticatedBackupRestorePlanV1: Uint8Array.from(
      authenticatedBackupRestorePlanV1,
    ),
  });
}

async function requireExactBackupRestorePlanV1Tree(
  repositoryPath: string,
  commit: string,
): Promise<void> {
  const treeOutput = await executeGit(
    repositoryPath,
    [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      commit,
      "--",
      BACKUP_RESTORE_PLAN_V1_DIRECTORY,
    ],
    MAX_GIT_METADATA_BYTES,
  );
  const treeEntries = parseGitTree(treeOutput);
  if (
    treeEntries.length !== 1 ||
    treeEntries[0]?.mode !== "100644" ||
    treeEntries[0]?.type !== "blob" ||
    treeEntries[0]?.path !== RESTORE_PLATFORM_V1_PATH
  ) {
    invalid();
  }
}

async function readMigrationPlanV2Sources(
  repositoryPath: string,
  commit: string,
): Promise<{
  readonly platformBootstrapV2: Uint8Array;
  readonly applicationMigrationManifestV2: Uint8Array;
  readonly authenticatedMigrationRendererV2: Uint8Array;
  readonly applicationMigrationsV2: readonly {
    id: string;
    file: string;
    bytes: Uint8Array;
  }[];
}> {
  await requireExactMigrationPlanV2Tree(repositoryPath, commit);
  const [
    platformBootstrapV2,
    applicationMigrationManifestV2,
    authenticatedMigrationRendererV2,
  ] = await Promise.all([
    readFixedGitBlob(
      repositoryPath,
      commit,
      PLATFORM_BOOTSTRAP_V2_PATH,
      MAX_PLATFORM_BOOTSTRAP_V2_BYTES,
    ),
    readFixedGitBlob(
      repositoryPath,
      commit,
      APPLICATION_MANIFEST_V2_PATH,
      MAX_APPLICATION_MANIFEST_V2_BYTES,
    ),
    readFixedGitBlob(
      repositoryPath,
      commit,
      AUTHENTICATED_MIGRATION_RENDERER_V2_PATH,
      MAX_AUTHENTICATED_MIGRATION_RENDERER_V2_BYTES,
    ),
  ]);
  const manifestEntries = parseApplicationMigrationManifestV2(
    applicationMigrationManifestV2,
  );
  const applicationMigrationsV2 = await readExactApplicationMigrationV2Tree(
    repositoryPath,
    commit,
    manifestEntries,
  );
  return Object.freeze({
    platformBootstrapV2: Uint8Array.from(platformBootstrapV2),
    applicationMigrationManifestV2: Uint8Array.from(
      applicationMigrationManifestV2,
    ),
    authenticatedMigrationRendererV2: Uint8Array.from(
      authenticatedMigrationRendererV2,
    ),
    applicationMigrationsV2,
  });
}

async function requireExactMigrationPlanV2Tree(
  repositoryPath: string,
  commit: string,
): Promise<void> {
  const treeOutput = await executeGit(
    repositoryPath,
    [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      commit,
      "--",
      MIGRATION_PLAN_V2_DIRECTORY,
    ],
    MAX_GIT_METADATA_BYTES,
  );
  const treeEntries = parseGitTree(treeOutput);
  const expectedPaths = [
    PLATFORM_BOOTSTRAP_V2_PATH,
    APPLICATION_MANIFEST_V2_PATH,
    ...APPLICATION_MIGRATION_V2_FILES.map(
      (file) => `${APPLICATION_MIGRATION_V2_DIRECTORY}/${file}`,
    ),
  ].sort(compareCodeUnits);
  if (
    treeEntries.some(
      ({ mode, type }) => mode !== "100644" || type !== "blob",
    ) ||
    !sameStrings(
      treeEntries.map(({ path }) => path),
      expectedPaths,
    )
  ) {
    invalid();
  }
}

async function readProjectionSources(
  repositoryPath: string,
  commit: string,
): Promise<{
  readonly projectionQuery: Uint8Array;
  readonly projectionNormalizer: Uint8Array;
}> {
  const [projectionQuery, projectionNormalizer] = await Promise.all([
    readFixedGitBlob(
      repositoryPath,
      commit,
      PROJECTION_QUERY_PATH,
      MAX_PROJECTION_QUERY_BYTES,
    ),
    readFixedGitBlob(
      repositoryPath,
      commit,
      PROJECTION_NORMALIZER_PATH,
      MAX_PROJECTION_NORMALIZER_BYTES,
    ),
  ]);
  return Object.freeze({
    projectionQuery: Uint8Array.from(projectionQuery),
    projectionNormalizer: Uint8Array.from(projectionNormalizer),
  });
}

function normalizeReviewInput(
  value: unknown,
): PostgresAcceptanceEvidenceReviewInput {
  const input = exactPlainDataRecord(value, REVIEW_INPUT_KEYS);
  const evidencePath = boundedPath(input.evidencePath);
  const repositoryPath = boundedPath(input.repositoryPath);
  const expectedEvidenceSha256 = exactPattern(
    input.expectedEvidenceSha256,
    SHA256_HEX,
    64,
  );
  const expectedCommit = exactPattern(input.expectedCommit, COMMIT_SHA, 40);
  const expectedRepository = boundedText(input.expectedRepository, 201);
  const expectedRepositoryId = boundedText(input.expectedRepositoryId, 20);
  const expectedRunId = boundedText(input.expectedRunId, 20);
  if (
    typeof input.expectedRunAttempt !== "number" ||
    !Number.isSafeInteger(input.expectedRunAttempt) ||
    input.expectedRunAttempt <= 0
  ) {
    invalid();
  }
  return Object.freeze({
    evidencePath,
    repositoryPath,
    expectedEvidenceSha256,
    expectedRepository,
    expectedRepositoryId,
    expectedCommit,
    expectedRunId,
    expectedRunAttempt: input.expectedRunAttempt,
  });
}

async function canonicalRepositoryPath(path: string): Promise<string> {
  const canonical = await realpath(resolve(path));
  if (!(await stat(canonical)).isDirectory()) invalid();
  return canonical;
}

async function requireExactGitTopLevel(repositoryPath: string): Promise<void> {
  const output = await executeGit(
    repositoryPath,
    ["rev-parse", "--show-toplevel"],
    MAX_GIT_METADATA_BYTES,
  );
  const topLevel = singleLineUtf8(output);
  if (!isAbsolute(topLevel)) invalid();
  const canonicalTopLevel = await realpath(topLevel);
  if (!samePath(canonicalTopLevel, repositoryPath)) invalid();
}

async function requireCommitObject(
  repositoryPath: string,
  commit: string,
): Promise<void> {
  const output = await executeGit(
    repositoryPath,
    ["cat-file", "-t", commit],
    MAX_GIT_METADATA_BYTES,
  );
  if (singleLineUtf8(output) !== "commit") invalid();
}

async function readFixedGitBlob(
  repositoryPath: string,
  commit: string,
  path: string,
  maximumBytes: number,
): Promise<Buffer> {
  const treeOutput = await executeGit(
    repositoryPath,
    ["ls-tree", "-z", "--full-tree", commit, "--", path],
    MAX_GIT_METADATA_BYTES,
  );
  const entries = parseGitTree(treeOutput);
  if (
    entries.length !== 1 ||
    entries[0]?.path !== path ||
    entries[0].type !== "blob" ||
    entries[0].mode !== "100644"
  ) {
    invalid();
  }
  return executeGit(
    repositoryPath,
    ["cat-file", "blob", `${commit}:${path}`],
    maximumBytes,
  );
}

async function readExactMigrationTree(
  repositoryPath: string,
  commit: string,
  manifestEntries: readonly MigrationManifestEntry[],
): Promise<readonly { id: string; file: string; bytes: Uint8Array }[]> {
  const treeOutput = await executeGit(
    repositoryPath,
    ["ls-tree", "-r", "-z", "--full-tree", commit, "--", MIGRATION_DIRECTORY],
    MAX_GIT_METADATA_BYTES,
  );
  const treeEntries = parseGitTree(treeOutput);
  const expectedPaths = manifestEntries.map(
    ({ file }) => `${MIGRATION_DIRECTORY}/${file}`,
  );
  const actualPaths = treeEntries.map(({ path }) => path);
  if (
    treeEntries.some(
      ({ mode, type }) => mode !== "100644" || type !== "blob",
    ) ||
    !sameStrings(actualPaths, [...expectedPaths].sort(compareCodeUnits))
  ) {
    invalid();
  }

  const migrations: { id: string; file: string; bytes: Uint8Array }[] = [];
  let totalBytes = 0;
  for (const entry of manifestEntries) {
    const path = `${MIGRATION_DIRECTORY}/${entry.file}`;
    const bytes = await executeGit(
      repositoryPath,
      ["cat-file", "blob", `${commit}:${path}`],
      MAX_MIGRATION_BYTES,
    );
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_TOTAL_MIGRATION_BYTES) invalid();
    migrations.push(
      Object.freeze({
        id: entry.id,
        file: entry.file,
        bytes: Uint8Array.from(bytes),
      }),
    );
  }
  return Object.freeze(migrations);
}

async function readExactApplicationMigrationV2Tree(
  repositoryPath: string,
  commit: string,
  manifestEntries: readonly ApplicationMigrationV2ManifestEntry[],
): Promise<readonly { id: string; file: string; bytes: Uint8Array }[]> {
  const treeOutput = await executeGit(
    repositoryPath,
    [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      commit,
      "--",
      APPLICATION_MIGRATION_V2_DIRECTORY,
    ],
    MAX_GIT_METADATA_BYTES,
  );
  const treeEntries = parseGitTree(treeOutput);
  const expectedPaths = manifestEntries.map(
    ({ file }) => `${APPLICATION_MIGRATION_V2_DIRECTORY}/${file}`,
  );
  const actualPaths = treeEntries.map(({ path }) => path);
  if (
    treeEntries.some(
      ({ mode, type }) => mode !== "100644" || type !== "blob",
    ) ||
    !sameStrings(actualPaths, [...expectedPaths].sort(compareCodeUnits))
  ) {
    invalid();
  }

  const migrations: { id: string; file: string; bytes: Uint8Array }[] = [];
  let totalBytes = 0;
  for (const entry of manifestEntries) {
    const path = `${APPLICATION_MIGRATION_V2_DIRECTORY}/${entry.file}`;
    const bytes = await executeGit(
      repositoryPath,
      ["cat-file", "blob", `${commit}:${path}`],
      MAX_MIGRATION_BYTES,
    );
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_TOTAL_MIGRATION_BYTES) invalid();
    migrations.push(
      Object.freeze({
        id: entry.id,
        file: entry.file,
        bytes: Uint8Array.from(bytes),
      }),
    );
  }
  return Object.freeze(migrations);
}

function parseMigrationManifest(
  bytes: Buffer,
): readonly MigrationManifestEntry[] {
  const manifest = exactPlainDataRecord(
    parseJsonBytes(bytes, MAX_MANIFEST_BYTES),
    MANIFEST_KEYS,
  );
  if (
    manifest.schemaVersion !== 1 ||
    manifest.algorithm !== "sha256" ||
    !Array.isArray(manifest.migrations) ||
    Object.getPrototypeOf(manifest.migrations) !== Array.prototype ||
    manifest.migrations.length === 0 ||
    manifest.migrations.length > MAX_MIGRATION_COUNT
  ) {
    invalid();
  }

  const ids = new Set<string>();
  const files = new Set<string>();
  const entries: MigrationManifestEntry[] = [];
  for (const value of manifest.migrations) {
    const entry = exactPlainDataRecord(value, MIGRATION_KEYS);
    const id = exactPattern(entry.id, MIGRATION_ID, 8);
    const file = exactPattern(entry.file, MIGRATION_FILE, 240);
    const sha256 = exactPattern(entry.sha256, SHA256_HEX, 64);
    if (!file.startsWith(`${id}_`)) invalid();
    if (ids.has(id) || files.has(file)) invalid();
    ids.add(id);
    files.add(file);
    entries.push(Object.freeze({ id, file, sha256 }));
  }
  if (
    !sameStrings(
      entries.map(({ id }) => id),
      [...entries.map(({ id }) => id)].sort(compareCodeUnits),
    )
  ) {
    invalid();
  }
  return Object.freeze(entries);
}

function parseApplicationMigrationManifestV2(
  bytes: Buffer,
): readonly ApplicationMigrationV2ManifestEntry[] {
  const manifest = exactPlainDataRecord(
    parseJsonBytes(bytes, MAX_APPLICATION_MANIFEST_V2_BYTES),
    APPLICATION_MANIFEST_V2_KEYS,
  );
  if (
    manifest.schemaVersion !== 1 ||
    manifest.planVersion !== 2 ||
    manifest.algorithm !== "sha256" ||
    !Array.isArray(manifest.migrations) ||
    Object.getPrototypeOf(manifest.migrations) !== Array.prototype ||
    manifest.migrations.length !== APPLICATION_MIGRATION_V2_FILES.length
  ) {
    invalid();
  }

  const entries: ApplicationMigrationV2ManifestEntry[] = [];
  for (const [index, value] of manifest.migrations.entries()) {
    const entry = exactPlainDataRecord(value, MIGRATION_KEYS);
    const id = exactPattern(entry.id, APPLICATION_MIGRATION_V2_ID, 8);
    const file = exactPattern(entry.file, MIGRATION_FILE, 240);
    const sha256 = exactPattern(entry.sha256, SHA256_HEX, 64);
    if (
      id !== `v2-${String(index + 1).padStart(4, "0")}` ||
      file !== APPLICATION_MIGRATION_V2_FILES[index]
    ) {
      invalid();
    }
    entries.push(Object.freeze({ id, file, sha256 }));
  }
  return Object.freeze(entries);
}

function parseGitTree(value: Buffer): GitTreeEntry[] {
  const text = decodeUtf8(value);
  if (text.length === 0) return [];
  if (!text.endsWith("\0")) invalid();
  const entries: GitTreeEntry[] = [];
  for (const record of text.slice(0, -1).split("\0")) {
    const match = /^(\d{6}) (blob|tree) ([0-9a-f]{40,64})\t(.+)$/.exec(record);
    if (
      !match ||
      match[1] === undefined ||
      match[2] === undefined ||
      match[4] === undefined
    ) {
      invalid();
    }
    const path = match[4];
    if (containsControlCharacter(path) || path.includes("\\")) invalid();
    entries.push({ mode: match[1], type: match[2], path });
  }
  return entries.sort((left, right) => compareCodeUnits(left.path, right.path));
}

async function readBoundedRegularFile(pathValue: string): Promise<Buffer> {
  const path = resolve(pathValue);
  const before = await lstat(path);
  if (
    before.isSymbolicLink() ||
    !before.isFile() ||
    before.size > MAX_EVIDENCE_BYTES
  ) {
    invalid();
  }

  const noFollow = fileConstants.O_NOFOLLOW ?? 0;
  const handle = await open(path, fileConstants.O_RDONLY | noFollow);
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.size > MAX_EVIDENCE_BYTES ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino
    ) {
      invalid();
    }

    const output = Buffer.alloc(MAX_EVIDENCE_BYTES + 1);
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
    if (offset > MAX_EVIDENCE_BYTES) invalid();

    const after = await handle.stat();
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.mtimeMs !== opened.mtimeMs ||
      offset !== after.size
    ) {
      invalid();
    }
    return output.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

function executeGit(
  repositoryPath: string,
  arguments_: readonly string[],
  maximumStdoutBytes: number,
): Promise<Buffer> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      "git",
      ["--no-pager", "-C", repositoryPath, ...arguments_],
      {
        env: gitEnvironment(),
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    const stdout: Buffer[] = [];
    let stdoutLength = 0;
    let stderrLength = 0;
    let rejected = false;

    const fail = (): void => {
      if (rejected) return;
      rejected = true;
      child.kill();
      rejectPromise(new Error("invalid"));
    };
    const timer = setTimeout(fail, GIT_TIMEOUT_MILLISECONDS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutLength += chunk.byteLength;
      if (stdoutLength > maximumStdoutBytes) {
        fail();
        return;
      }
      stdout.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrLength += chunk.byteLength;
      if (stderrLength > MAX_GIT_STDERR_BYTES) fail();
    });
    child.once("error", fail);
    child.once("close", (code) => {
      clearTimeout(timer);
      if (rejected) return;
      if (code !== 0) {
        fail();
        return;
      }
      resolvePromise(Buffer.concat(stdout, stdoutLength));
    });
  });
}

function parseJsonBytes(value: Buffer, maximumBytes: number): unknown {
  if (value.byteLength > maximumBytes) invalid();
  return JSON.parse(decodeUtf8(value)) as unknown;
}

function singleLineUtf8(value: Buffer): string {
  const text = decodeUtf8(value);
  const normalized = text.endsWith("\r\n")
    ? text.slice(0, -2)
    : text.endsWith("\n")
      ? text.slice(0, -1)
      : text;
  if (
    normalized.length === 0 ||
    normalized.includes("\n") ||
    normalized.includes("\r") ||
    containsControlCharacter(normalized)
  ) {
    invalid();
  }
  return normalized;
}

function decodeUtf8(value: Buffer): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(value);
}

function exactPlainDataRecord<const Keys extends readonly string[]>(
  value: unknown,
  expectedKeys: Keys,
): DataRecord & { readonly [Key in Keys[number]]: unknown } {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    invalid();
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !keys.includes(key)) ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    invalid();
  }
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) invalid();
  }
  return value as DataRecord & {
    readonly [Key in Keys[number]]: unknown;
  };
}

function boundedPath(value: unknown): string {
  const path = boundedText(value, 4_096);
  if (!isAbsolute(path)) invalid();
  return path;
}

function gitEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!/^GIT_/i.test(key) && key.toUpperCase() !== "GCM_INTERACTIVE") {
      environment[key] = value;
    }
  }
  environment.GIT_OPTIONAL_LOCKS = "0";
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.GCM_INTERACTIVE = "Never";
  environment.GIT_NO_REPLACE_OBJECTS = "1";
  environment.GIT_NO_LAZY_FETCH = "1";
  return environment;
}

function boundedText(value: unknown, maximumLength: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value.trim() !== value ||
    containsControlCharacter(value)
  ) {
    invalid();
  }
  return value;
}

function exactPattern(
  value: unknown,
  pattern: RegExp,
  maximumLength: number,
): string {
  const text = boundedText(value, maximumLength);
  if (!pattern.test(text)) invalid();
  return text;
}

function samePath(left: string, right: string): boolean {
  return relative(left, right) === "" && relative(right, left) === "";
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f)) {
      return true;
    }
  }
  return false;
}

function invalid(): never {
  throw new Error("invalid");
}
