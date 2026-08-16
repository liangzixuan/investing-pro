import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildPostgresAcceptanceEvidence,
  serializePostgresAcceptanceEvidence,
} from "../src/postgres-acceptance-evidence";
import {
  PostgresAcceptanceEvidenceReviewError,
  reviewPostgresAcceptanceEvidence,
  type PostgresAcceptanceEvidenceReviewInput,
} from "../src/postgres-acceptance-evidence-review";
import {
  parsePostgresAcceptanceEvidenceReviewArguments,
  runPostgresAcceptanceEvidenceReviewCli,
} from "../src/run-postgres-acceptance-evidence-review";

const SOURCE_REPOSITORY = fileURLToPath(new URL("../../../", import.meta.url));
const FIXED_SOURCE_PATHS = [
  ".github/workflows/postgres-acceptance.yml",
  "packages/db/acceptance/postgres-image.json",
  "packages/db/acceptance/synthetic-fixture.sql",
  "packages/db/migration-manifest.json",
  "packages/db/src/postgres-acceptance.ts",
] as const;
const REPOSITORY = "example/research-cockpit";
const REPOSITORY_ID = "123456789";
const RUN_ID = "9876543210";
const RUN_ATTEMPT = 2;
const GIT_INTEGRATION_TEST_TIMEOUT_MILLISECONDS = 30_000;
const TEMP_DIRECTORIES: string[] = [];

interface ReviewFixture {
  readonly temporaryDirectory: string;
  readonly repositoryPath: string;
  readonly evidencePath: string;
  readonly commit: string;
  readonly evidenceBytes: Buffer;
  readonly input: PostgresAcceptanceEvidenceReviewInput;
}

afterEach(async () => {
  await Promise.all(
    TEMP_DIRECTORIES.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe(
  "PostgreSQL acceptance evidence Git/file review adapter",
  { timeout: GIT_INTEGRATION_TEST_TIMEOUT_MILLISECONDS },
  evidenceAdapterTests,
);

function evidenceAdapterTests(): void {
  it("reviews a historical commit and ignores a dirty worktree", async () => {
    const fixture = await createFixture();
    await writeFile(
      join(fixture.repositoryPath, "later.txt"),
      "second commit\n",
    );
    git(fixture.repositoryPath, ["add", "later.txt"]);
    git(fixture.repositoryPath, ["commit", "-m", "later commit"]);
    await writeFile(
      join(fixture.repositoryPath, "packages/db/src/postgres-acceptance.ts"),
      "dirty worktree canary\n",
    );
    await writeFile(
      join(fixture.repositoryPath, "untracked-network-canary.txt"),
      "must remain untouched\n",
    );
    const statusBefore = git(fixture.repositoryPath, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]);

    const result = await reviewPostgresAcceptanceEvidence(fixture.input);

    expect(result).toMatchObject({
      schemaVersion: 1,
      verdict: "offline_consistent",
      evidenceSha256: fixture.input.expectedEvidenceSha256,
      repository: REPOSITORY,
      repositoryId: REPOSITORY_ID,
      commitSha: fixture.commit,
      runId: RUN_ID,
      runAttempt: RUN_ATTEMPT,
    });
    expect(result.verifierNotProven).toContain(
      "workflow_logs_or_database_execution",
    );
    expect(
      git(fixture.repositoryPath, [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
      ]),
    ).toBe(statusBefore);
    expect(await readFile(fixture.evidencePath)).toEqual(fixture.evidenceBytes);
  });

  it("requires every independent trust anchor", async () => {
    const fixture = await createFixture();
    const changes: Partial<PostgresAcceptanceEvidenceReviewInput>[] = [
      { expectedEvidenceSha256: "f".repeat(64) },
      { expectedRepository: "example/different" },
      { expectedRepositoryId: "999" },
      { expectedCommit: "a".repeat(40) },
      { expectedRunId: "999" },
      { expectedRunAttempt: 3 },
    ];
    for (const change of changes) {
      await expect(
        reviewPostgresAcceptanceEvidence({ ...fixture.input, ...change }),
      ).rejects.toEqual(
        expect.objectContaining({
          name: "PostgresAcceptanceEvidenceReviewError",
          code: "POSTGRES_ACCEPTANCE_EVIDENCE_REVIEW_FAILED",
          message: "PostgreSQL acceptance evidence review failed.",
        }),
      );
    }
  });

  it("rejects a directory, oversized file, and symbolic-link evidence path", async () => {
    const fixture = await createFixture();
    await expect(
      reviewPostgresAcceptanceEvidence({
        ...fixture.input,
        evidencePath: fixture.temporaryDirectory,
      }),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const oversized = join(fixture.temporaryDirectory, "oversized.json");
    await writeFile(oversized, Buffer.alloc(32_769, 0x20));
    await expect(
      reviewPostgresAcceptanceEvidence({
        ...fixture.input,
        evidencePath: oversized,
      }),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const link = join(fixture.temporaryDirectory, "evidence-link.json");
    try {
      await symlink(fixture.evidencePath, link, "file");
    } catch (error) {
      if (
        process.platform === "win32" &&
        error instanceof Error &&
        "code" in error &&
        error.code === "EPERM"
      ) {
        await symlink(fixture.temporaryDirectory, link, "junction");
      } else {
        throw error;
      }
    }
    await expect(
      reviewPostgresAcceptanceEvidence({
        ...fixture.input,
        evidencePath: link,
      }),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
  });

  it("rejects nonexistent and non-commit object anchors", async () => {
    const fixture = await createFixture();
    await expect(
      reviewPostgresAcceptanceEvidence({
        ...fixture.input,
        expectedCommit: "a".repeat(40),
      }),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const blob = git(fixture.repositoryPath, [
      "hash-object",
      "packages/db/migration-manifest.json",
    ]);
    expect(blob).toMatch(/^[0-9a-f]{40}$/);
    await expect(
      reviewPostgresAcceptanceEvidence({
        ...fixture.input,
        expectedCommit: blob,
      }),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
  });

  it("requires the supplied repository path to be the exact Git top level", async () => {
    const fixture = await createFixture();
    await expect(
      reviewPostgresAcceptanceEvidence({
        ...fixture.input,
        repositoryPath: join(fixture.repositoryPath, "packages/db"),
      }),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
    await expect(
      reviewPostgresAcceptanceEvidence({
        ...fixture.input,
        repositoryPath: ".",
      }),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
    await expect(
      reviewPostgresAcceptanceEvidence({
        ...fixture.input,
        evidencePath: "evidence.json",
      }),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
  });

  it("rejects unexpected and missing migration-tree blobs", async () => {
    const unexpected = await createFixture();
    await writeFile(
      join(
        unexpected.repositoryPath,
        "packages/db/migrations/9999_unreviewed.sql",
      ),
      "SELECT 1;\n",
    );
    git(unexpected.repositoryPath, ["add", "--all"]);
    git(unexpected.repositoryPath, ["commit", "-m", "unexpected migration"]);
    const unexpectedCommit = git(unexpected.repositoryPath, [
      "rev-parse",
      "HEAD",
    ]);
    await expect(
      reviewPostgresAcceptanceEvidence({
        ...unexpected.input,
        expectedCommit: unexpectedCommit,
      }),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const missing = await createFixture();
    const manifest = JSON.parse(
      await readFile(
        join(missing.repositoryPath, "packages/db/migration-manifest.json"),
        "utf8",
      ),
    ) as { migrations: { file: string }[] };
    const missingFile = manifest.migrations[0]?.file;
    if (missingFile === undefined) throw new Error("missing fixture migration");
    await rm(
      join(missing.repositoryPath, "packages/db/migrations", missingFile),
    );
    git(missing.repositoryPath, ["add", "--all"]);
    git(missing.repositoryPath, ["commit", "-m", "missing migration"]);
    const missingCommit = git(missing.repositoryPath, ["rev-parse", "HEAD"]);
    await expect(
      reviewPostgresAcceptanceEvidence({
        ...missing.input,
        expectedCommit: missingCommit,
      }),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
  });

  it("does not consult a configured origin and rejects commit argument injection", async () => {
    const fixture = await createFixture("--repo-with-leading-dashes");
    git(fixture.repositoryPath, [
      "remote",
      "add",
      "origin",
      "https://127.0.0.1:9/must-not-connect.git",
    ]);

    await writeFile(
      join(fixture.repositoryPath, "packages/db/src/postgres-acceptance.ts"),
      "replacement-object network canary\n",
    );
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "replacement commit"]);
    const replacementCommit = git(fixture.repositoryPath, [
      "rev-parse",
      "HEAD",
    ]);
    git(fixture.repositoryPath, ["replace", fixture.commit, replacementCommit]);

    const inheritedGitVariables = {
      GIT_DIR: join(fixture.temporaryDirectory, "network-canary-git-dir"),
      GIT_WORK_TREE: join(
        fixture.temporaryDirectory,
        "network-canary-worktree",
      ),
      GIT_OBJECT_DIRECTORY: join(
        fixture.temporaryDirectory,
        "network-canary-objects",
      ),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: join(
        fixture.temporaryDirectory,
        "network-canary-alternates",
      ),
      GIT_REPLACE_REF_BASE: "refs/network-canary/",
      GCM_INTERACTIVE: "Always",
    } as const;
    const previousValues = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(inheritedGitVariables)) {
      previousValues.set(key, process.env[key]);
      process.env[key] = value;
    }

    try {
      await expect(
        reviewPostgresAcceptanceEvidence(fixture.input),
      ).resolves.toMatchObject({ verdict: "offline_consistent" });
    } finally {
      for (const [key, value] of previousValues) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    await expect(
      reviewPostgresAcceptanceEvidence({
        ...fixture.input,
        expectedCommit: `${fixture.commit} --upload-pack=network-canary`,
      }),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
  });
}

describe(
  "PostgreSQL acceptance evidence review CLI",
  { timeout: GIT_INTEGRATION_TEST_TIMEOUT_MILLISECONDS },
  evidenceReviewCliTests,
);

function evidenceReviewCliTests(): void {
  it("requires the closed flag set with no defaults, duplicates, or extras", async () => {
    const fixture = await createFixture();
    const arguments_ = cliArguments(fixture.input);
    expect(parsePostgresAcceptanceEvidenceReviewArguments(arguments_)).toEqual(
      fixture.input,
    );

    for (const invalidArguments of [
      arguments_.slice(0, -2),
      [...arguments_, "--extra", "value"],
      [...arguments_.slice(0, -2), "--evidence", fixture.evidencePath],
      arguments_.map((value) =>
        value === "--expected-run-attempt" ? "--unknown" : value,
      ),
      arguments_.map((value) => (value === "2" ? "02" : value)),
      arguments_.map((value) =>
        value === fixture.evidencePath ? "relative-evidence.json" : value,
      ),
      arguments_.map((value) =>
        value === fixture.repositoryPath ? "relative-repository" : value,
      ),
    ]) {
      expect(() =>
        parsePostgresAcceptanceEvidenceReviewArguments(invalidArguments),
      ).toThrow(PostgresAcceptanceEvidenceReviewError);
    }
  });

  it("prints exactly one safe canonical JSON result on success", async () => {
    const fixture = await createFixture();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runPostgresAcceptanceEvidenceReviewCli(
      cliArguments(fixture.input),
      {
        stdout: { write: (value) => stdout.push(value) },
        stderr: { write: (value) => stderr.push(value) },
      },
    );
    const directResult = await reviewPostgresAcceptanceEvidence(fixture.input);

    expect(exitCode).toBe(0);
    expect(stdout).toEqual([`${JSON.stringify(directResult, null, 2)}\n`]);
    expect(stderr).toEqual([]);
    expect(stdout[0]).not.toContain(fixture.evidencePath);
    expect(stdout[0]).not.toContain(fixture.repositoryPath);
    expect(JSON.parse(stdout[0] ?? "")).toEqual(directResult);
  });

  it("prints one stable value-free failure and exits one", async () => {
    const fixture = await createFixture();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const arguments_ = cliArguments({
      ...fixture.input,
      expectedEvidenceSha256: "f".repeat(64),
    });
    const exitCode = await runPostgresAcceptanceEvidenceReviewCli(arguments_, {
      stdout: { write: (value) => stdout.push(value) },
      stderr: { write: (value) => stderr.push(value) },
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual(["PostgreSQL acceptance evidence review failed.\n"]);
    expect(stderr.join("")).not.toContain(fixture.evidencePath);
    expect(stderr.join("")).not.toContain(fixture.commit);
  });
}

async function createFixture(
  repositoryDirectoryName = "repository",
): Promise<ReviewFixture> {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "rc-pg-evidence-review-"),
  );
  TEMP_DIRECTORIES.push(temporaryDirectory);
  const repositoryPath = join(temporaryDirectory, repositoryDirectoryName);
  await mkdir(repositoryPath, { recursive: true });
  git(repositoryPath, ["init"]);
  git(repositoryPath, ["config", "user.email", "tests@example.invalid"]);
  git(repositoryPath, ["config", "user.name", "Research Cockpit Tests"]);

  for (const path of FIXED_SOURCE_PATHS) {
    const destination = join(repositoryPath, path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(SOURCE_REPOSITORY, path), destination);
  }
  const manifest = JSON.parse(
    await readFile(
      join(repositoryPath, "packages/db/migration-manifest.json"),
      "utf8",
    ),
  ) as { migrations: { file: string }[] };
  for (const { file } of manifest.migrations) {
    const path = join("packages/db/migrations", file);
    const destination = join(repositoryPath, path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(SOURCE_REPOSITORY, path), destination);
  }
  git(repositoryPath, ["add", "--all"]);
  git(repositoryPath, ["commit", "-m", "reviewed acceptance sources"]);
  const commit = git(repositoryPath, ["rev-parse", "HEAD"]);

  const imageConfig = JSON.parse(
    await readFile(
      join(repositoryPath, "packages/db/acceptance/postgres-image.json"),
      "utf8",
    ),
  ) as { reference: string; indexDigest: string };
  const evidence = buildPostgresAcceptanceEvidence({
    githubEnvironment: {
      CI: "true",
      GITHUB_ACTIONS: "true",
      GITHUB_JOB: "postgres-acceptance",
      GITHUB_WORKFLOW: "PostgreSQL acceptance",
      GITHUB_REPOSITORY: REPOSITORY,
      GITHUB_REPOSITORY_ID: REPOSITORY_ID,
      GITHUB_SHA: commit,
      GITHUB_RUN_ID: RUN_ID,
      GITHUB_RUN_ATTEMPT: String(RUN_ATTEMPT),
    },
    reviewedImageReference: imageConfig.reference,
    reviewedImageIndexDigest: imageConfig.indexDigest,
    toolVersions: {
      postgres: "postgres (PostgreSQL) 17.11 (Debian test)",
      psql: "psql (PostgreSQL) 17.11 (Debian test)",
      pgDump: "pg_dump (PostgreSQL) 17.11 (Debian test)",
      pgRestore: "pg_restore (PostgreSQL) 17.11 (Debian test)",
    },
    sourceHashes: {
      workflowSha256: await fileSha256(
        join(repositoryPath, ".github/workflows/postgres-acceptance.yml"),
      ),
      fixtureSha256: await fileSha256(
        join(repositoryPath, "packages/db/acceptance/synthetic-fixture.sql"),
      ),
      migrationManifestSha256: await fileSha256(
        join(repositoryPath, "packages/db/migration-manifest.json"),
      ),
      acceptanceRunnerSha256: await fileSha256(
        join(repositoryPath, "packages/db/src/postgres-acceptance.ts"),
      ),
    },
    completedAt: "2026-08-16T01:02:03.004Z",
  });
  const evidenceBytes = Buffer.from(
    serializePostgresAcceptanceEvidence(evidence),
    "utf8",
  );
  const evidencePath = join(temporaryDirectory, "evidence.json");
  await writeFile(evidencePath, evidenceBytes);
  const expectedEvidenceSha256 = createHash("sha256")
    .update(evidenceBytes)
    .digest("hex");

  return {
    temporaryDirectory,
    repositoryPath,
    evidencePath,
    commit,
    evidenceBytes,
    input: {
      evidencePath,
      repositoryPath,
      expectedEvidenceSha256,
      expectedRepository: REPOSITORY,
      expectedRepositoryId: REPOSITORY_ID,
      expectedCommit: commit,
      expectedRunId: RUN_ID,
      expectedRunAttempt: RUN_ATTEMPT,
    },
  };
}

function cliArguments(input: PostgresAcceptanceEvidenceReviewInput): string[] {
  return [
    "--evidence",
    input.evidencePath,
    "--repo",
    input.repositoryPath,
    "--expected-evidence-sha256",
    input.expectedEvidenceSha256,
    "--expected-repository",
    input.expectedRepository,
    "--expected-repository-id",
    input.expectedRepositoryId,
    "--expected-commit",
    input.expectedCommit,
    "--expected-run-id",
    input.expectedRunId,
    "--expected-run-attempt",
    String(input.expectedRunAttempt),
  ];
}

async function fileSha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

function git(repositoryPath: string, arguments_: readonly string[]): string {
  const result = spawnSync("git", ["-C", repositoryPath, ...arguments_], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`test Git command failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}
