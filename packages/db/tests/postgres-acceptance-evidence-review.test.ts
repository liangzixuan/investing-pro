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
  POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V1_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V2_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V4_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V5_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V6_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V7_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V8_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V9_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V10_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V10_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V11_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V11_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V12_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V12_NOT_PROVEN,
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
  "packages/db/src/postgres-projection-query.ts",
  "packages/db/src/projection-normalization.ts",
  "packages/db/migration-plans/v2/platform-bootstrap.sql",
  "packages/db/migration-plans/v2/application-manifest.json",
  "packages/db/src/authenticated-migration-plan.ts",
  "packages/db/backup-restore-plans/v1/restore-platform.sql",
  "packages/db/src/authenticated-backup-restore-plan.ts",
  "packages/db/src/postgres-projection-adapter.ts",
  "modules/research-core/src/projection-contract.ts",
  "packages/db/package.json",
  "pnpm-lock.yaml",
  "packages/db/src/postgres-projection-pool.ts",
  "packages/db/src/postgres-migration-deployer.ts",
  "packages/db/src/postgres-query-plan-load.ts",
  "packages/db/acceptance/query-plan-load-fixture.sql",
  "packages/db/privacy-retention-plans/v1/policy.json",
  "packages/db/privacy-retention-plans/v1/manifest.json",
  "packages/db/privacy-retention-plans/v1/platform-bootstrap.sql",
  "packages/db/src/privacy-retention-policy.ts",
  "packages/db/src/privacy-retention-plan.ts",
  "packages/db/src/resource-identifier-token.ts",
  "packages/db/acceptance/privacy-retention-fixture.sql",
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
      rm(directory, {
        force: true,
        recursive: true,
        maxRetries: 5,
        retryDelay: 50,
      }),
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

  it("reviews a canonical historical v1 record at its anchored commit", async () => {
    const fixture = await createFixture();
    await writeHistoricalImageConfig(fixture.repositoryPath);
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "historical v1 config"]);
    const historicalCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.schemaVersion = 1;
    record.commitSha = historicalCommit;
    deleteV4SourceHashes(record);
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V1_NOT_PROVEN];
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);
    const input = {
      ...fixture.input,
      expectedCommit: historicalCommit,
      expectedEvidenceSha256: createHash("sha256")
        .update(evidenceBytes)
        .digest("hex"),
    };

    const result = await reviewPostgresAcceptanceEvidence(input);

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V1_NOT_PROVEN,
    ]);
  });

  it("reviews a canonical historical v2 record at its anchored commit", async () => {
    const fixture = await createFixture();
    await writeHistoricalImageConfig(fixture.repositoryPath);
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "historical v2 config"]);
    const historicalCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.schemaVersion = 2;
    record.commitSha = historicalCommit;
    deleteV4SourceHashes(record);
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V2_NOT_PROVEN];
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);
    const input = {
      ...fixture.input,
      expectedCommit: historicalCommit,
      expectedEvidenceSha256: createHash("sha256")
        .update(evidenceBytes)
        .digest("hex"),
    };

    const result = await reviewPostgresAcceptanceEvidence(input);

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V2_NOT_PROVEN,
    ]);
  });

  it("reviews historical v3 at a commit without either v4 source blob", async () => {
    const fixture = await createFixture();
    await writeHistoricalImageConfig(fixture.repositoryPath);
    await Promise.all([
      rm(
        join(
          fixture.repositoryPath,
          "packages/db/src/postgres-projection-query.ts",
        ),
      ),
      rm(
        join(
          fixture.repositoryPath,
          "packages/db/src/projection-normalization.ts",
        ),
      ),
    ]);
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "historical v3 sources"]);
    const historicalCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.schemaVersion = 3;
    record.commitSha = historicalCommit;
    deleteV4SourceHashes(record);
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN];
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);

    const result = await reviewPostgresAcceptanceEvidence({
      ...fixture.input,
      expectedCommit: historicalCommit,
      expectedEvidenceSha256: createHash("sha256")
        .update(evidenceBytes)
        .digest("hex"),
    });

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
    ]);
  });

  it("reviews a canonical historical v4 record at its anchored commit", async () => {
    const fixture = await createFixture();
    await writeHistoricalImageConfig(fixture.repositoryPath);
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "historical v4 config"]);
    const historicalCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.schemaVersion = 4;
    record.commitSha = historicalCommit;
    deleteV7SourceHashes(record);
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V4_NOT_PROVEN];
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);

    const result = await reviewPostgresAcceptanceEvidence({
      ...fixture.input,
      expectedCommit: historicalCommit,
      expectedEvidenceSha256: createHash("sha256")
        .update(evidenceBytes)
        .digest("hex"),
    });

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V4_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_test_loader_fixture_load",
    );
  });

  it("reviews a canonical historical v5 record at its anchored commit", async () => {
    const fixture = await createFixture();
    await writeHistoricalImageConfig(fixture.repositoryPath);
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "historical v5 config"]);
    const historicalCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.schemaVersion = 5;
    record.commitSha = historicalCommit;
    deleteV7SourceHashes(record);
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V5_NOT_PROVEN];
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);

    const result = await reviewPostgresAcceptanceEvidence({
      ...fixture.input,
      expectedCommit: historicalCommit,
      expectedEvidenceSha256: createHash("sha256")
        .update(evidenceBytes)
        .digest("hex"),
    });

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V5_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_owner_ddl_canary",
    );
  });

  it("reviews a canonical historical v6 record at its anchored commit", async () => {
    const fixture = await createFixture();
    await writeHistoricalImageConfig(fixture.repositoryPath);
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "historical v6 config"]);
    const historicalCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.schemaVersion = 6;
    record.commitSha = historicalCommit;
    deleteV7SourceHashes(record);
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V6_NOT_PROVEN];
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);

    const result = await reviewPostgresAcceptanceEvidence({
      ...fixture.input,
      expectedCommit: historicalCommit,
      expectedEvidenceSha256: createHash("sha256")
        .update(evidenceBytes)
        .digest("hex"),
    });

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V6_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_clean_application_migrations_after_platform_bootstrap",
    );
  });

  it("reviews historical v7 at a commit without either v8 source blob", async () => {
    const fixture = await createFixture();
    await writeHistoricalImageConfig(fixture.repositoryPath);
    await Promise.all([
      rm(
        join(
          fixture.repositoryPath,
          "packages/db/backup-restore-plans/v1/restore-platform.sql",
        ),
      ),
      rm(
        join(
          fixture.repositoryPath,
          "packages/db/src/authenticated-backup-restore-plan.ts",
        ),
      ),
    ]);
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "historical v7 sources"]);
    const historicalCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.schemaVersion = 7;
    record.commitSha = historicalCommit;
    deleteV8SourceHashes(record);
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V7_NOT_PROVEN];
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);

    const result = await reviewPostgresAcceptanceEvidence({
      ...fixture.input,
      expectedCommit: historicalCommit,
      expectedEvidenceSha256: createHash("sha256")
        .update(evidenceBytes)
        .digest("hex"),
    });

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V7_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_policy_scoped_application_data_dump_and_bounded_clean_restore",
    );
  });

  it("reviews historical v8 at a commit without any v9 source blob", async () => {
    const fixture = await createFixture();
    await writeHistoricalImageConfig(fixture.repositoryPath);
    await Promise.all([
      rm(
        join(
          fixture.repositoryPath,
          "packages/db/src/postgres-projection-adapter.ts",
        ),
      ),
      rm(
        join(
          fixture.repositoryPath,
          "modules/research-core/src/projection-contract.ts",
        ),
      ),
      rm(join(fixture.repositoryPath, "packages/db/package.json")),
      rm(join(fixture.repositoryPath, "pnpm-lock.yaml")),
    ]);
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "historical v8 sources"]);
    const historicalCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.schemaVersion = 8;
    record.commitSha = historicalCommit;
    deleteV9SourceHashes(record);
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V8_NOT_PROVEN];
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);

    const result = await reviewPostgresAcceptanceEvidence({
      ...fixture.input,
      expectedCommit: historicalCommit,
      expectedEvidenceSha256: createHash("sha256")
        .update(evidenceBytes)
        .digest("hex"),
    });

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V8_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_single_client_read_only_financial_fact_projection_adapter",
    );
  });

  it("reviews historical v9 at a commit without the v10 pool source blob", async () => {
    const fixture = await createFixture();
    await writeHistoricalImageConfig(fixture.repositoryPath);
    await rm(
      join(
        fixture.repositoryPath,
        "packages/db/src/postgres-projection-pool.ts",
      ),
    );
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "historical v9 sources"]);
    const historicalCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.schemaVersion = 9;
    record.commitSha = historicalCommit;
    deleteV10SourceHashes(record);
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V9_NOT_PROVEN];
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);

    const result = await reviewPostgresAcceptanceEvidence({
      ...fixture.input,
      expectedCommit: historicalCommit,
      expectedEvidenceSha256: createHash("sha256")
        .update(evidenceBytes)
        .digest("hex"),
    });

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V9_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_bounded_pool_lifecycle_concurrency_cancellation_and_timeout_recovery",
    );
  });

  it("reviews historical v10 at a commit without the v11 deployer source blob", async () => {
    const fixture = await createFixture();
    await writeHistoricalImageConfig(fixture.repositoryPath);
    await rm(
      join(
        fixture.repositoryPath,
        "packages/db/src/postgres-migration-deployer.ts",
      ),
    );
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "historical v10 sources"]);
    const historicalCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.schemaVersion = 10;
    record.commitSha = historicalCommit;
    deleteV11SourceHashes(record);
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V10_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V10_NOT_PROVEN];
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);

    const result = await reviewPostgresAcceptanceEvidence({
      ...fixture.input,
      expectedCommit: historicalCommit,
      expectedEvidenceSha256: createHash("sha256")
        .update(evidenceBytes)
        .digest("hex"),
    });

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V10_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V10_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_locked_migration_ledger_checksum_drift_refusal_one_time_replay_rollback_and_concurrent_deployment",
    );
  });

  it("reviews historical v11 at a commit without either v12 source blob", async () => {
    const fixture = await createFixture();
    await writeHistoricalImageConfig(fixture.repositoryPath);
    await Promise.all([
      rm(
        join(
          fixture.repositoryPath,
          "packages/db/src/postgres-query-plan-load.ts",
        ),
      ),
      rm(
        join(
          fixture.repositoryPath,
          "packages/db/acceptance/query-plan-load-fixture.sql",
        ),
      ),
    ]);
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "historical v11 sources"]);
    const historicalCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.schemaVersion = 11;
    record.commitSha = historicalCommit;
    deleteV12SourceHashes(record);
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V11_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V11_NOT_PROVEN];
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);

    const result = await reviewPostgresAcceptanceEvidence({
      ...fixture.input,
      expectedCommit: historicalCommit,
      expectedEvidenceSha256: createHash("sha256")
        .update(evidenceBytes)
        .digest("hex"),
    });

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V11_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V11_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_rls_indexed_query_plans_and_bounded_2000_read_load",
    );
  });

  it("reviews historical v12 at a commit without any v13 privacy-retention source blob", async () => {
    const fixture = await createFixture();
    await writeV12ImageConfig(fixture.repositoryPath);
    await Promise.all([
      rm(
        join(fixture.repositoryPath, "packages/db/privacy-retention-plans/v1"),
        { recursive: true },
      ),
      rm(
        join(
          fixture.repositoryPath,
          "packages/db/src/privacy-retention-policy.ts",
        ),
      ),
      rm(
        join(
          fixture.repositoryPath,
          "packages/db/src/privacy-retention-plan.ts",
        ),
      ),
      rm(
        join(
          fixture.repositoryPath,
          "packages/db/src/resource-identifier-token.ts",
        ),
      ),
      rm(
        join(
          fixture.repositoryPath,
          "packages/db/acceptance/privacy-retention-fixture.sql",
        ),
      ),
    ]);
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "historical v12 sources"]);
    const historicalCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.schemaVersion = 12;
    record.commitSha = historicalCommit;
    deleteV13SourceHashes(record);
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V12_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V12_NOT_PROVEN];
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);

    const result = await reviewPostgresAcceptanceEvidence({
      ...fixture.input,
      expectedCommit: historicalCommit,
      expectedEvidenceSha256: createHash("sha256")
        .update(evidenceBytes)
        .digest("hex"),
    });

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V12_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V12_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "versioned_privacy_retention_decision_contract",
    );
  });

  it("rejects a changed v10 projection source at the anchored commit", async () => {
    const fixture = await createFixture();
    await writeFile(
      join(
        fixture.repositoryPath,
        "packages/db/src/postgres-projection-query.ts",
      ),
      "export const changed = true;\n",
    );
    git(fixture.repositoryPath, ["add", "--all"]);
    git(fixture.repositoryPath, ["commit", "-m", "changed projection source"]);
    const changedCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);
    const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    record.commitSha = changedCommit;
    const evidenceBytes = Buffer.from(
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    await writeFile(fixture.evidencePath, evidenceBytes);

    await expect(
      reviewPostgresAcceptanceEvidence({
        ...fixture.input,
        expectedCommit: changedCommit,
        expectedEvidenceSha256: createHash("sha256")
          .update(evidenceBytes)
          .digest("hex"),
      }),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
  });

  it("rejects changed v10 platform, renderer, and application-body sources at the anchored commit", async () => {
    for (const path of [
      "packages/db/migration-plans/v2/platform-bootstrap.sql",
      "packages/db/src/authenticated-migration-plan.ts",
      "packages/db/migration-plans/v2/application/0001_request_context_and_ledger.sql",
    ]) {
      const fixture = await createFixture();
      await writeFile(join(fixture.repositoryPath, path), "SELECT 1;\n");
      git(fixture.repositoryPath, ["add", "--all"]);
      git(fixture.repositoryPath, ["commit", "-m", "changed v10 source"]);
      const changedCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);

      await expect(
        reviewPostgresAcceptanceEvidence(
          await inputAtCommit(fixture, changedCommit),
        ),
      ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
    }
  });

  it("rejects changed v10 backup/restore plan sources at the anchored commit", async () => {
    for (const path of [
      "packages/db/backup-restore-plans/v1/restore-platform.sql",
      "packages/db/src/authenticated-backup-restore-plan.ts",
    ]) {
      const fixture = await createFixture();
      await writeFile(join(fixture.repositoryPath, path), "SELECT 1;\n");
      git(fixture.repositoryPath, ["add", "--all"]);
      git(fixture.repositoryPath, ["commit", "-m", "changed v10 source"]);
      const changedCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);

      await expect(
        reviewPostgresAcceptanceEvidence(
          await inputAtCommit(fixture, changedCommit),
        ),
      ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
    }
  });

  it("rejects changed v10 adapter, contract, package, and lockfile sources at the anchored commit", async () => {
    for (const path of [
      "packages/db/src/postgres-projection-adapter.ts",
      "modules/research-core/src/projection-contract.ts",
      "packages/db/package.json",
      "pnpm-lock.yaml",
    ]) {
      const fixture = await createFixture();
      await writeFile(
        join(fixture.repositoryPath, path),
        "changed v10 source\n",
      );
      git(fixture.repositoryPath, ["add", "--all"]);
      git(fixture.repositoryPath, ["commit", "-m", "changed v10 source"]);
      const changedCommit = git(fixture.repositoryPath, ["rev-parse", "HEAD"]);

      await expect(
        reviewPostgresAcceptanceEvidence(
          await inputAtCommit(fixture, changedCommit),
        ),
      ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
    }
  });

  it("rejects a changed or missing v10 pool source at the anchored commit", async () => {
    const changed = await createFixture();
    await writeFile(
      join(
        changed.repositoryPath,
        "packages/db/src/postgres-projection-pool.ts",
      ),
      "changed v10 pool source\n",
    );
    git(changed.repositoryPath, ["add", "--all"]);
    git(changed.repositoryPath, ["commit", "-m", "changed v10 pool source"]);
    const changedCommit = git(changed.repositoryPath, ["rev-parse", "HEAD"]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(changed, changedCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const missing = await createFixture();
    await rm(
      join(
        missing.repositoryPath,
        "packages/db/src/postgres-projection-pool.ts",
      ),
    );
    git(missing.repositoryPath, ["add", "--all"]);
    git(missing.repositoryPath, ["commit", "-m", "missing v10 pool source"]);
    const missingCommit = git(missing.repositoryPath, ["rev-parse", "HEAD"]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(missing, missingCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
  });

  it("rejects a changed or missing v11 migration deployer at the anchored commit", async () => {
    const changed = await createFixture();
    await writeFile(
      join(
        changed.repositoryPath,
        "packages/db/src/postgres-migration-deployer.ts",
      ),
      "changed v11 migration deployer\n",
    );
    git(changed.repositoryPath, ["add", "--all"]);
    git(changed.repositoryPath, [
      "commit",
      "-m",
      "changed v11 migration deployer",
    ]);
    const changedCommit = git(changed.repositoryPath, ["rev-parse", "HEAD"]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(changed, changedCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const missing = await createFixture();
    await rm(
      join(
        missing.repositoryPath,
        "packages/db/src/postgres-migration-deployer.ts",
      ),
    );
    git(missing.repositoryPath, ["add", "--all"]);
    git(missing.repositoryPath, [
      "commit",
      "-m",
      "missing v11 migration deployer",
    ]);
    const missingCommit = git(missing.repositoryPath, ["rev-parse", "HEAD"]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(missing, missingCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
  });

  it("rejects changed or missing v12 query-plan/load sources at the anchored commit", async () => {
    for (const path of [
      "packages/db/src/postgres-query-plan-load.ts",
      "packages/db/acceptance/query-plan-load-fixture.sql",
    ]) {
      const changed = await createFixture();
      await writeFile(
        join(changed.repositoryPath, path),
        "changed v12 query-plan/load source\n",
      );
      git(changed.repositoryPath, ["add", "--all"]);
      git(changed.repositoryPath, ["commit", "-m", "changed v12 source"]);
      const changedCommit = git(changed.repositoryPath, ["rev-parse", "HEAD"]);
      await expect(
        reviewPostgresAcceptanceEvidence(
          await inputAtCommit(changed, changedCommit),
        ),
      ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

      const missing = await createFixture();
      await rm(join(missing.repositoryPath, path));
      git(missing.repositoryPath, ["add", "--all"]);
      git(missing.repositoryPath, ["commit", "-m", "missing v12 source"]);
      const missingCommit = git(missing.repositoryPath, ["rev-parse", "HEAD"]);
      await expect(
        reviewPostgresAcceptanceEvidence(
          await inputAtCommit(missing, missingCommit),
        ),
      ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
    }
  });

  it("rejects changed, missing, or extra v13 privacy-retention plan and source blobs at the anchored commit", async () => {
    for (const path of [
      "packages/db/privacy-retention-plans/v1/policy.json",
      "packages/db/privacy-retention-plans/v1/platform-bootstrap.sql",
      "packages/db/privacy-retention-plans/v1/application/0001_keyed_resource_identifier_lifecycle.sql",
      "packages/db/src/privacy-retention-plan.ts",
      "packages/db/acceptance/privacy-retention-fixture.sql",
    ]) {
      const changed = await createFixture();
      await writeFile(
        join(changed.repositoryPath, path),
        "changed v13 privacy-retention source\n",
      );
      git(changed.repositoryPath, ["add", "--all"]);
      git(changed.repositoryPath, ["commit", "-m", "changed v13 source"]);
      const changedCommit = git(changed.repositoryPath, ["rev-parse", "HEAD"]);
      await expect(
        reviewPostgresAcceptanceEvidence(
          await inputAtCommit(changed, changedCommit),
        ),
      ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
    }

    const missing = await createFixture();
    await rm(
      join(
        missing.repositoryPath,
        "packages/db/privacy-retention-plans/v1/manifest.json",
      ),
    );
    git(missing.repositoryPath, ["add", "--all"]);
    git(missing.repositoryPath, ["commit", "-m", "missing v13 manifest"]);
    const missingCommit = git(missing.repositoryPath, ["rev-parse", "HEAD"]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(missing, missingCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const extra = await createFixture();
    await writeFile(
      join(
        extra.repositoryPath,
        "packages/db/privacy-retention-plans/v1/application/9999_extra.sql",
      ),
      "SELECT 1;\n",
    );
    git(extra.repositoryPath, ["add", "--all"]);
    git(extra.repositoryPath, ["commit", "-m", "extra v13 plan body"]);
    const extraCommit = git(extra.repositoryPath, ["rev-parse", "HEAD"]);
    await expect(
      reviewPostgresAcceptanceEvidence(await inputAtCommit(extra, extraCommit)),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
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
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(unexpected, unexpectedCommit),
      ),
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
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(missing, missingCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
  });

  it("rejects unexpected, missing, and non-regular v2 migration-plan blobs", async () => {
    const unexpected = await createFixture();
    await writeFile(
      join(
        unexpected.repositoryPath,
        "packages/db/migration-plans/v2/unreviewed.sql",
      ),
      "SELECT 1;\n",
    );
    git(unexpected.repositoryPath, ["add", "--all"]);
    git(unexpected.repositoryPath, ["commit", "-m", "unexpected v2 source"]);
    const unexpectedCommit = git(unexpected.repositoryPath, [
      "rev-parse",
      "HEAD",
    ]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(unexpected, unexpectedCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const missing = await createFixture();
    const applicationManifestV2 = JSON.parse(
      await readFile(
        join(
          missing.repositoryPath,
          "packages/db/migration-plans/v2/application-manifest.json",
        ),
        "utf8",
      ),
    ) as { migrations: { file: string }[] };
    const missingFile = applicationManifestV2.migrations[0]?.file;
    if (missingFile === undefined) {
      throw new Error("missing v2 fixture migration");
    }
    await rm(
      join(
        missing.repositoryPath,
        "packages/db/migration-plans/v2/application",
        missingFile,
      ),
    );
    git(missing.repositoryPath, ["add", "--all"]);
    git(missing.repositoryPath, ["commit", "-m", "missing v2 source"]);
    const missingCommit = git(missing.repositoryPath, ["rev-parse", "HEAD"]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(missing, missingCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const nonRegular = await createFixture();
    const platformPath = join(
      nonRegular.repositoryPath,
      "packages/db/migration-plans/v2/platform-bootstrap.sql",
    );
    const platformBlob = git(nonRegular.repositoryPath, [
      "hash-object",
      "-w",
      platformPath,
    ]);
    git(nonRegular.repositoryPath, [
      "update-index",
      "--cacheinfo",
      `120000,${platformBlob},packages/db/migration-plans/v2/platform-bootstrap.sql`,
    ]);
    git(nonRegular.repositoryPath, ["commit", "-m", "symlink v2 source"]);
    const nonRegularCommit = git(nonRegular.repositoryPath, [
      "rev-parse",
      "HEAD",
    ]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(nonRegular, nonRegularCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);
  });

  it("rejects unexpected, missing, and non-regular v1 backup/restore source blobs", async () => {
    const unexpected = await createFixture();
    await writeFile(
      join(
        unexpected.repositoryPath,
        "packages/db/backup-restore-plans/v1/unreviewed.sql",
      ),
      "SELECT 1;\n",
    );
    git(unexpected.repositoryPath, ["add", "--all"]);
    git(unexpected.repositoryPath, [
      "commit",
      "-m",
      "unexpected v1 backup restore source",
    ]);
    const unexpectedCommit = git(unexpected.repositoryPath, [
      "rev-parse",
      "HEAD",
    ]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(unexpected, unexpectedCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const missing = await createFixture();
    await rm(
      join(
        missing.repositoryPath,
        "packages/db/backup-restore-plans/v1/restore-platform.sql",
      ),
    );
    git(missing.repositoryPath, ["add", "--all"]);
    git(missing.repositoryPath, [
      "commit",
      "-m",
      "missing v1 backup restore source",
    ]);
    const missingCommit = git(missing.repositoryPath, ["rev-parse", "HEAD"]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(missing, missingCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const nonRegular = await createFixture();
    const platformPath = join(
      nonRegular.repositoryPath,
      "packages/db/backup-restore-plans/v1/restore-platform.sql",
    );
    const platformBlob = git(nonRegular.repositoryPath, [
      "hash-object",
      "-w",
      platformPath,
    ]);
    git(nonRegular.repositoryPath, [
      "update-index",
      "--cacheinfo",
      `120000,${platformBlob},packages/db/backup-restore-plans/v1/restore-platform.sql`,
    ]);
    git(nonRegular.repositoryPath, [
      "commit",
      "-m",
      "symlink v1 backup restore source",
    ]);
    const nonRegularCommit = git(nonRegular.repositoryPath, [
      "rev-parse",
      "HEAD",
    ]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(nonRegular, nonRegularCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const missingRenderer = await createFixture();
    await rm(
      join(
        missingRenderer.repositoryPath,
        "packages/db/src/authenticated-backup-restore-plan.ts",
      ),
    );
    git(missingRenderer.repositoryPath, ["add", "--all"]);
    git(missingRenderer.repositoryPath, [
      "commit",
      "-m",
      "missing v1 backup restore renderer",
    ]);
    const missingRendererCommit = git(missingRenderer.repositoryPath, [
      "rev-parse",
      "HEAD",
    ]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(missingRenderer, missingRendererCommit),
      ),
    ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceReviewError);

    const nonRegularRenderer = await createFixture();
    const rendererPath = join(
      nonRegularRenderer.repositoryPath,
      "packages/db/src/authenticated-backup-restore-plan.ts",
    );
    const rendererBlob = git(nonRegularRenderer.repositoryPath, [
      "hash-object",
      "-w",
      rendererPath,
    ]);
    git(nonRegularRenderer.repositoryPath, [
      "update-index",
      "--cacheinfo",
      `120000,${rendererBlob},packages/db/src/authenticated-backup-restore-plan.ts`,
    ]);
    git(nonRegularRenderer.repositoryPath, [
      "commit",
      "-m",
      "symlink v1 backup restore renderer",
    ]);
    const nonRegularRendererCommit = git(nonRegularRenderer.repositoryPath, [
      "rev-parse",
      "HEAD",
    ]);
    await expect(
      reviewPostgresAcceptanceEvidence(
        await inputAtCommit(nonRegularRenderer, nonRegularRendererCommit),
      ),
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

async function inputAtCommit(
  fixture: ReviewFixture,
  commit: string,
): Promise<PostgresAcceptanceEvidenceReviewInput> {
  const record = JSON.parse(fixture.evidenceBytes.toString("utf8")) as Record<
    string,
    unknown
  >;
  record.commitSha = commit;
  const evidenceBytes = Buffer.from(
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
  await writeFile(fixture.evidencePath, evidenceBytes);
  return {
    ...fixture.input,
    expectedCommit: commit,
    expectedEvidenceSha256: createHash("sha256")
      .update(evidenceBytes)
      .digest("hex"),
  };
}

async function writeHistoricalImageConfig(
  repositoryPath: string,
): Promise<void> {
  await writeV12ImageConfig(repositoryPath);
  const path = join(
    repositoryPath,
    "packages/db/acceptance/postgres-image.json",
  );
  const config = JSON.parse(await readFile(path, "utf8")) as Record<
    string,
    unknown
  >;
  delete config.queryPlanLoadFixtureSha256;
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function writeV12ImageConfig(repositoryPath: string): Promise<void> {
  const path = join(
    repositoryPath,
    "packages/db/acceptance/postgres-image.json",
  );
  const config = JSON.parse(await readFile(path, "utf8")) as Record<
    string,
    unknown
  >;
  delete config.privacyRetentionFixtureSha256;
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
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
  const applicationManifestV2 = JSON.parse(
    await readFile(
      join(
        repositoryPath,
        "packages/db/migration-plans/v2/application-manifest.json",
      ),
      "utf8",
    ),
  ) as { migrations: { file: string }[] };
  for (const { file } of applicationManifestV2.migrations) {
    const path = join("packages/db/migration-plans/v2/application", file);
    const destination = join(repositoryPath, path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(SOURCE_REPOSITORY, path), destination);
  }
  const privacyRetentionManifestV1 = JSON.parse(
    await readFile(
      join(
        repositoryPath,
        "packages/db/privacy-retention-plans/v1/manifest.json",
      ),
      "utf8",
    ),
  ) as { migrations: { file: string }[] };
  for (const { file } of privacyRetentionManifestV1.migrations) {
    const path = join("packages/db/privacy-retention-plans/v1", file);
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
      nodePostgres: "8.23.0",
      nodePostgresPool: "3.14.0",
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
      projectionQuerySha256: await fileSha256(
        join(repositoryPath, "packages/db/src/postgres-projection-query.ts"),
      ),
      projectionNormalizerSha256: await fileSha256(
        join(repositoryPath, "packages/db/src/projection-normalization.ts"),
      ),
      platformBootstrapV2Sha256: await fileSha256(
        join(
          repositoryPath,
          "packages/db/migration-plans/v2/platform-bootstrap.sql",
        ),
      ),
      applicationMigrationManifestV2Sha256: await fileSha256(
        join(
          repositoryPath,
          "packages/db/migration-plans/v2/application-manifest.json",
        ),
      ),
      authenticatedMigrationRendererV2Sha256: await fileSha256(
        join(repositoryPath, "packages/db/src/authenticated-migration-plan.ts"),
      ),
      restorePlatformV1Sha256: await fileSha256(
        join(
          repositoryPath,
          "packages/db/backup-restore-plans/v1/restore-platform.sql",
        ),
      ),
      authenticatedBackupRestorePlanV1Sha256: await fileSha256(
        join(
          repositoryPath,
          "packages/db/src/authenticated-backup-restore-plan.ts",
        ),
      ),
      postgresProjectionAdapterSha256: await fileSha256(
        join(repositoryPath, "packages/db/src/postgres-projection-adapter.ts"),
      ),
      operationProjectionContractSha256: await fileSha256(
        join(
          repositoryPath,
          "modules/research-core/src/projection-contract.ts",
        ),
      ),
      databasePackageManifestSha256: await fileSha256(
        join(repositoryPath, "packages/db/package.json"),
      ),
      pnpmLockfileSha256: await fileSha256(
        join(repositoryPath, "pnpm-lock.yaml"),
      ),
      postgresProjectionPoolSha256: await fileSha256(
        join(repositoryPath, "packages/db/src/postgres-projection-pool.ts"),
      ),
      postgresMigrationDeployerSha256: await fileSha256(
        join(repositoryPath, "packages/db/src/postgres-migration-deployer.ts"),
      ),
      postgresQueryPlanLoadSha256: await fileSha256(
        join(repositoryPath, "packages/db/src/postgres-query-plan-load.ts"),
      ),
      queryPlanLoadFixtureSha256: await fileSha256(
        join(
          repositoryPath,
          "packages/db/acceptance/query-plan-load-fixture.sql",
        ),
      ),
      privacyRetentionPolicyV1Sha256: await fileSha256(
        join(
          repositoryPath,
          "packages/db/privacy-retention-plans/v1/policy.json",
        ),
      ),
      privacyRetentionPlanManifestV1Sha256: await fileSha256(
        join(
          repositoryPath,
          "packages/db/privacy-retention-plans/v1/manifest.json",
        ),
      ),
      privacyRetentionPolicySourceV1Sha256: await fileSha256(
        join(repositoryPath, "packages/db/src/privacy-retention-policy.ts"),
      ),
      privacyRetentionPlanSourceV1Sha256: await fileSha256(
        join(repositoryPath, "packages/db/src/privacy-retention-plan.ts"),
      ),
      resourceIdentifierTokenV1Sha256: await fileSha256(
        join(repositoryPath, "packages/db/src/resource-identifier-token.ts"),
      ),
      privacyRetentionFixtureV1Sha256: await fileSha256(
        join(
          repositoryPath,
          "packages/db/acceptance/privacy-retention-fixture.sql",
        ),
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

function deleteV4SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.projectionQuerySha256;
  delete hashes.projectionNormalizerSha256;
  deleteV7SourceHashes(record);
}

function deleteV7SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.platformBootstrapV2Sha256;
  delete hashes.applicationMigrationManifestV2Sha256;
  delete hashes.authenticatedMigrationRendererV2Sha256;
  deleteV8SourceHashes(record);
}

function deleteV8SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.restorePlatformV1Sha256;
  delete hashes.authenticatedBackupRestorePlanV1Sha256;
  deleteV9SourceHashes(record);
}

function deleteV9SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.postgresProjectionAdapterSha256;
  delete hashes.operationProjectionContractSha256;
  delete hashes.databasePackageManifestSha256;
  delete hashes.pnpmLockfileSha256;
  delete (record.toolVersions as Record<string, unknown>).nodePostgres;
  deleteV10SourceHashes(record);
}

function deleteV10SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.postgresProjectionPoolSha256;
  delete (record.toolVersions as Record<string, unknown>).nodePostgresPool;
  deleteV11SourceHashes(record);
}

function deleteV11SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.postgresMigrationDeployerSha256;
  deleteV12SourceHashes(record);
}

function deleteV12SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.postgresQueryPlanLoadSha256;
  delete hashes.queryPlanLoadFixtureSha256;
  deleteV13SourceHashes(record);
}

function deleteV13SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.privacyRetentionPolicyV1Sha256;
  delete hashes.privacyRetentionPlanManifestV1Sha256;
  delete hashes.privacyRetentionPolicySourceV1Sha256;
  delete hashes.privacyRetentionPlanSourceV1Sha256;
  delete hashes.resourceIdentifierTokenV1Sha256;
  delete hashes.privacyRetentionFixtureV1Sha256;
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
