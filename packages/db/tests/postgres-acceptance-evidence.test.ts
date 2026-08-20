import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildPostgresAcceptanceEvidence,
  parsePostgresAcceptanceEvidence,
  POSTGRES_ACCEPTANCE_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME,
  POSTGRES_ACCEPTANCE_NOT_PROVEN,
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
  POSTGRES_ACCEPTANCE_V13_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V13_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V14_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V14_NOT_PROVEN,
  PostgresAcceptanceEvidenceError,
  serializePostgresAcceptanceEvidence,
  writePostgresAcceptanceEvidence,
  type BuildPostgresAcceptanceEvidenceInput,
  type PostgresAcceptanceEvidence,
  type PostgresAcceptanceEvidenceV1,
  type PostgresAcceptanceEvidenceV2,
  type PostgresAcceptanceEvidenceV3,
  type PostgresAcceptanceEvidenceV4,
  type PostgresAcceptanceEvidenceV5,
  type PostgresAcceptanceEvidenceV6,
  type PostgresAcceptanceEvidenceV7,
  type PostgresAcceptanceEvidenceV8,
  type PostgresAcceptanceEvidenceV9,
  type PostgresAcceptanceEvidenceV10,
  type PostgresAcceptanceEvidenceV11,
  type PostgresAcceptanceEvidenceV12,
  type PostgresAcceptanceEvidenceV13,
  type PostgresAcceptanceEvidenceV14,
} from "../src/postgres-acceptance-evidence";

const IMAGE_DIGEST = `sha256:${"a".repeat(64)}`;
const SECRET_CANARY = "never-copy-this-secret-canary";
const TEMP_DIRECTORIES: string[] = [];

function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    CI: "true",
    GITHUB_ACTIONS: "true",
    GITHUB_JOB: "postgres-acceptance",
    GITHUB_WORKFLOW: "PostgreSQL acceptance",
    GITHUB_REPOSITORY: "example/research-cockpit",
    GITHUB_REPOSITORY_ID: "123456789",
    GITHUB_SHA: "b".repeat(40),
    GITHUB_RUN_ID: "9876543210",
    GITHUB_RUN_ATTEMPT: "2",
    ACTIONS_RUNTIME_TOKEN: SECRET_CANARY,
    DATABASE_PASSWORD: `${SECRET_CANARY}-database`,
    ...overrides,
  };
}

function input(
  overrides: Partial<BuildPostgresAcceptanceEvidenceInput> = {},
): BuildPostgresAcceptanceEvidenceInput {
  return {
    githubEnvironment: environment(),
    reviewedImageReference: `docker.io/library/postgres:17.11-bookworm@${IMAGE_DIGEST}`,
    reviewedImageIndexDigest: IMAGE_DIGEST,
    toolVersions: {
      postgres: "postgres (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      psql: "psql (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      pgDump: "pg_dump (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      pgRestore: "pg_restore (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      nodePostgres: "8.23.0",
      nodePostgresPool: "3.14.0",
    },
    sourceHashes: {
      workflowSha256: "1".repeat(64),
      fixtureSha256: "2".repeat(64),
      migrationManifestSha256: "3".repeat(64),
      acceptanceRunnerSha256: "4".repeat(64),
      projectionQuerySha256: "5".repeat(64),
      projectionNormalizerSha256: "6".repeat(64),
      platformBootstrapV2Sha256: "7".repeat(64),
      applicationMigrationManifestV2Sha256: "8".repeat(64),
      authenticatedMigrationRendererV2Sha256: "9".repeat(64),
      restorePlatformV1Sha256: "a".repeat(64),
      authenticatedBackupRestorePlanV1Sha256: "b".repeat(64),
      postgresProjectionAdapterSha256: "c".repeat(64),
      operationProjectionContractSha256: "d".repeat(64),
      databasePackageManifestSha256: "e".repeat(64),
      pnpmLockfileSha256: "f".repeat(64),
      postgresProjectionPoolSha256: "0".repeat(64),
      postgresMigrationDeployerSha256: "1".repeat(64),
      postgresQueryPlanLoadSha256: "2".repeat(64),
      queryPlanLoadFixtureSha256: "3".repeat(64),
      privacyRetentionPolicyV1Sha256: "4".repeat(64),
      privacyRetentionPlanManifestV1Sha256: "5".repeat(64),
      privacyRetentionPolicySourceV1Sha256: "6".repeat(64),
      privacyRetentionPlanSourceV1Sha256: "7".repeat(64),
      resourceIdentifierTokenV1Sha256: "8".repeat(64),
      privacyRetentionFixtureV1Sha256: "9".repeat(64),
      populatedCutoverPlanManifestV1Sha256: "a".repeat(64),
      populatedCutoverPlanSourceV1Sha256: "b".repeat(64),
      populatedCutoverFixtureV1Sha256: "c".repeat(64),
    },
    completedAt: "2026-08-15T23:59:58.123Z",
    ...overrides,
  };
}

function evidence(): PostgresAcceptanceEvidenceV14 {
  return buildPostgresAcceptanceEvidence(input());
}

function historicalSourceHashes(): Record<string, unknown> {
  const hashes = input().sourceHashes;
  return {
    workflowSha256: hashes.workflowSha256,
    fixtureSha256: hashes.fixtureSha256,
    migrationManifestSha256: hashes.migrationManifestSha256,
    acceptanceRunnerSha256: hashes.acceptanceRunnerSha256,
  };
}

function mutableEvidence(): Record<string, unknown> {
  return JSON.parse(serializePostgresAcceptanceEvidence(evidence())) as Record<
    string,
    unknown
  >;
}

function mutableHistoricalEvidence(): Record<string, unknown> {
  const historical = mutableEvidence();
  delete (historical.toolVersions as Record<string, unknown>).nodePostgres;
  delete (historical.toolVersions as Record<string, unknown>).nodePostgresPool;
  return historical;
}

function mutableV1Evidence(): Record<string, unknown> {
  return {
    ...mutableHistoricalEvidence(),
    schemaVersion: 1,
    sourceHashes: historicalSourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V1_NOT_PROVEN],
  };
}

function mutableV2Evidence(): Record<string, unknown> {
  return {
    ...mutableHistoricalEvidence(),
    schemaVersion: 2,
    sourceHashes: historicalSourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V2_NOT_PROVEN],
  };
}

function mutableV3Evidence(): Record<string, unknown> {
  return {
    ...mutableHistoricalEvidence(),
    schemaVersion: 3,
    sourceHashes: historicalSourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN],
  };
}

function mutableV4Evidence(): Record<string, unknown> {
  return {
    ...mutableHistoricalEvidence(),
    schemaVersion: 4,
    sourceHashes: v4SourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V4_NOT_PROVEN],
  };
}

function mutableV5Evidence(): Record<string, unknown> {
  return {
    ...mutableHistoricalEvidence(),
    schemaVersion: 5,
    sourceHashes: v4SourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V5_NOT_PROVEN],
  };
}

function v4SourceHashes(): Record<string, unknown> {
  const hashes = input().sourceHashes;
  return {
    ...historicalSourceHashes(),
    projectionQuerySha256: hashes.projectionQuerySha256,
    projectionNormalizerSha256: hashes.projectionNormalizerSha256,
  };
}

function mutableV6Evidence(): Record<string, unknown> {
  return {
    ...mutableHistoricalEvidence(),
    schemaVersion: 6,
    sourceHashes: v4SourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V6_NOT_PROVEN],
  };
}

function v7SourceHashes(): Record<string, unknown> {
  const hashes = input().sourceHashes;
  return {
    ...v4SourceHashes(),
    platformBootstrapV2Sha256: hashes.platformBootstrapV2Sha256,
    applicationMigrationManifestV2Sha256:
      hashes.applicationMigrationManifestV2Sha256,
    authenticatedMigrationRendererV2Sha256:
      hashes.authenticatedMigrationRendererV2Sha256,
  };
}

function v8SourceHashes(): Record<string, unknown> {
  const hashes = input().sourceHashes;
  return {
    ...v7SourceHashes(),
    restorePlatformV1Sha256: hashes.restorePlatformV1Sha256,
    authenticatedBackupRestorePlanV1Sha256:
      hashes.authenticatedBackupRestorePlanV1Sha256,
  };
}

function v9SourceHashes(): Record<string, unknown> {
  const hashes = input().sourceHashes;
  return {
    ...v8SourceHashes(),
    postgresProjectionAdapterSha256: hashes.postgresProjectionAdapterSha256,
    operationProjectionContractSha256: hashes.operationProjectionContractSha256,
    databasePackageManifestSha256: hashes.databasePackageManifestSha256,
    pnpmLockfileSha256: hashes.pnpmLockfileSha256,
  };
}

function v10SourceHashes(): Record<string, unknown> {
  const hashes = input().sourceHashes;
  return {
    ...v9SourceHashes(),
    postgresProjectionPoolSha256: hashes.postgresProjectionPoolSha256,
  };
}

function v11SourceHashes(): Record<string, unknown> {
  const hashes = input().sourceHashes;
  return {
    ...v10SourceHashes(),
    postgresMigrationDeployerSha256: hashes.postgresMigrationDeployerSha256,
  };
}

function v12SourceHashes(): Record<string, unknown> {
  const hashes = input().sourceHashes;
  return {
    ...v11SourceHashes(),
    postgresQueryPlanLoadSha256: hashes.postgresQueryPlanLoadSha256,
    queryPlanLoadFixtureSha256: hashes.queryPlanLoadFixtureSha256,
  };
}

function v13SourceHashes(): Record<string, unknown> {
  const hashes = input().sourceHashes;
  return {
    ...v12SourceHashes(),
    privacyRetentionPolicyV1Sha256: hashes.privacyRetentionPolicyV1Sha256,
    privacyRetentionPlanManifestV1Sha256:
      hashes.privacyRetentionPlanManifestV1Sha256,
    privacyRetentionPolicySourceV1Sha256:
      hashes.privacyRetentionPolicySourceV1Sha256,
    privacyRetentionPlanSourceV1Sha256:
      hashes.privacyRetentionPlanSourceV1Sha256,
    resourceIdentifierTokenV1Sha256: hashes.resourceIdentifierTokenV1Sha256,
    privacyRetentionFixtureV1Sha256: hashes.privacyRetentionFixtureV1Sha256,
  };
}

function mutableV13Evidence(): Record<string, unknown> {
  return {
    ...mutableEvidence(),
    schemaVersion: 13,
    sourceHashes: v13SourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V13_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V13_NOT_PROVEN],
  };
}

function mutableV12Evidence(): Record<string, unknown> {
  return {
    ...mutableEvidence(),
    schemaVersion: 12,
    sourceHashes: v12SourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V12_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V12_NOT_PROVEN],
  };
}

function mutableV11Evidence(): Record<string, unknown> {
  return {
    ...mutableEvidence(),
    schemaVersion: 11,
    sourceHashes: v11SourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V11_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V11_NOT_PROVEN],
  };
}

function mutableV10Evidence(): Record<string, unknown> {
  return {
    ...mutableEvidence(),
    schemaVersion: 10,
    sourceHashes: v10SourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V10_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V10_NOT_PROVEN],
  };
}

function mutableV9Evidence(): Record<string, unknown> {
  const current = mutableEvidence();
  delete (current.toolVersions as Record<string, unknown>).nodePostgresPool;
  return {
    ...current,
    schemaVersion: 9,
    sourceHashes: v9SourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V9_NOT_PROVEN],
  };
}

function mutableV8Evidence(): Record<string, unknown> {
  const current = mutableHistoricalEvidence();
  return {
    ...current,
    schemaVersion: 8,
    sourceHashes: v8SourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V8_NOT_PROVEN],
  };
}

function mutableV7Evidence(): Record<string, unknown> {
  return {
    ...mutableHistoricalEvidence(),
    schemaVersion: 7,
    sourceHashes: v7SourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V7_NOT_PROVEN],
  };
}

function v1Evidence(): PostgresAcceptanceEvidenceV1 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV1Evidence()),
  );
  if (parsed.schemaVersion !== 1) {
    throw new Error("expected historical v1 evidence");
  }
  return parsed;
}

function v2Evidence(): PostgresAcceptanceEvidenceV2 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV2Evidence()),
  );
  if (parsed.schemaVersion !== 2) {
    throw new Error("expected historical v2 evidence");
  }
  return parsed;
}

function v3Evidence(): PostgresAcceptanceEvidenceV3 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV3Evidence()),
  );
  if (parsed.schemaVersion !== 3) {
    throw new Error("expected historical v3 evidence");
  }
  return parsed;
}

function v4Evidence(): PostgresAcceptanceEvidenceV4 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV4Evidence()),
  );
  if (parsed.schemaVersion !== 4) {
    throw new Error("expected historical v4 evidence");
  }
  return parsed;
}

function v5Evidence(): PostgresAcceptanceEvidenceV5 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV5Evidence()),
  );
  if (parsed.schemaVersion !== 5) {
    throw new Error("expected historical v5 evidence");
  }
  return parsed;
}

function v6Evidence(): PostgresAcceptanceEvidenceV6 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV6Evidence()),
  );
  if (parsed.schemaVersion !== 6) {
    throw new Error("expected historical v6 evidence");
  }
  return parsed;
}

function v7Evidence(): PostgresAcceptanceEvidenceV7 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV7Evidence()),
  );
  if (parsed.schemaVersion !== 7) {
    throw new Error("expected historical v7 evidence");
  }
  return parsed;
}

function v8Evidence(): PostgresAcceptanceEvidenceV8 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV8Evidence()),
  );
  if (parsed.schemaVersion !== 8) {
    throw new Error("expected historical v8 evidence");
  }
  return parsed;
}

function v9Evidence(): PostgresAcceptanceEvidenceV9 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV9Evidence()),
  );
  if (parsed.schemaVersion !== 9) {
    throw new Error("expected historical v9 evidence");
  }
  return parsed;
}

function v10Evidence(): PostgresAcceptanceEvidenceV10 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV10Evidence()),
  );
  if (parsed.schemaVersion !== 10) {
    throw new Error("expected historical v10 evidence");
  }
  return parsed;
}

function v11Evidence(): PostgresAcceptanceEvidenceV11 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV11Evidence()),
  );
  if (parsed.schemaVersion !== 11) {
    throw new Error("expected historical v11 evidence");
  }
  return parsed;
}

function v12Evidence(): PostgresAcceptanceEvidenceV12 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV12Evidence()),
  );
  if (parsed.schemaVersion !== 12) {
    throw new Error("expected historical v12 evidence");
  }
  return parsed;
}

function v13Evidence(): PostgresAcceptanceEvidenceV13 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV13Evidence()),
  );
  if (parsed.schemaVersion !== 13) {
    throw new Error("expected historical v13 evidence");
  }
  return parsed;
}

function expectValueFreeValidationFailure(run: () => unknown): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(PostgresAcceptanceEvidenceError);
  if (!(caught instanceof PostgresAcceptanceEvidenceError)) {
    throw new Error("expected PostgresAcceptanceEvidenceError");
  }
  expect(caught).toMatchObject({
    name: "PostgresAcceptanceEvidenceError",
    code: "INVALID_POSTGRES_ACCEPTANCE_EVIDENCE",
  });
  expect(caught.message).toBe(
    "PostgreSQL acceptance evidence failed validation.",
  );
  expect(caught.message).not.toContain(SECRET_CANARY);
  expect(caught).not.toHaveProperty("cause");
  expect(caught).not.toHaveProperty("field");
  expect(caught).not.toHaveProperty("value");
}

afterEach(async () => {
  await Promise.all(
    TEMP_DIRECTORIES.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("PostgreSQL acceptance success evidence", () => {
  it("builds the exact success-only v14 schema in its canonical order", () => {
    const result = evidence();
    expect(POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME).toBe(
      "research-cockpit-postgres-acceptance-v14.json",
    );
    expect(Object.keys(result)).toEqual([
      "schemaVersion",
      "suite",
      "outcome",
      "job",
      "workflow",
      "repository",
      "repositoryId",
      "commitSha",
      "runId",
      "runAttempt",
      "reviewedImageReference",
      "reviewedImageIndexDigest",
      "databaseName",
      "serverVersionNumber",
      "serverVersion",
      "toolVersions",
      "sourceHashes",
      "checksPassed",
      "notProven",
      "completedAt",
    ]);
    expect(result).toEqual({
      schemaVersion: 14,
      suite: "research-cockpit-postgresql-acceptance",
      outcome: "passed",
      job: "postgres-acceptance",
      workflow: "PostgreSQL acceptance",
      repository: "example/research-cockpit",
      repositoryId: "123456789",
      commitSha: "b".repeat(40),
      runId: "9876543210",
      runAttempt: 2,
      reviewedImageReference: `docker.io/library/postgres:17.11-bookworm@${IMAGE_DIGEST}`,
      reviewedImageIndexDigest: IMAGE_DIGEST,
      databaseName: "research_cockpit_acceptance_test",
      serverVersionNumber: "170011",
      serverVersion: "17.11",
      toolVersions: input().toolVersions,
      sourceHashes: input().sourceHashes,
      checksPassed: [...POSTGRES_ACCEPTANCE_CHECKS_PASSED],
      notProven: [...POSTGRES_ACCEPTANCE_NOT_PROVEN],
      completedAt: "2026-08-15T23:59:58.123Z",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.toolVersions)).toBe(true);
    expect(Object.isFrozen(result.sourceHashes)).toBe(true);
    expect(Object.isFrozen(result.checksPassed)).toBe(true);
    expect(Object.isFrozen(result.notProven)).toBe(true);
  });

  it("preserves exact historical v1 parsing and canonical serialization", () => {
    const historical = mutableV1Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V1_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.checksPassed)).toBe(true);
    expect(Object.isFrozen(parsed.notProven)).toBe(true);
  });

  it("preserves exact historical v2 parsing and canonical serialization", () => {
    const historical = mutableV2Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V2_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.checksPassed)).toBe(true);
    expect(Object.isFrozen(parsed.notProven)).toBe(true);
  });

  it("preserves exact historical v3 parsing and canonical serialization", () => {
    const historical = mutableV3Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.keys(parsed.sourceHashes)).toEqual([
      "workflowSha256",
      "fixtureSha256",
      "migrationManifestSha256",
      "acceptanceRunnerSha256",
    ]);
  });

  it("preserves exact historical v4 parsing and canonical serialization", () => {
    const historical = mutableV4Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(4);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V4_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.keys(parsed.sourceHashes)).toEqual([
      "workflowSha256",
      "fixtureSha256",
      "migrationManifestSha256",
      "acceptanceRunnerSha256",
      "projectionQuerySha256",
      "projectionNormalizerSha256",
    ]);
  });

  it("preserves exact historical v5 parsing and canonical serialization", () => {
    const historical = mutableV5Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(5);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V5_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.keys(parsed.sourceHashes)).toEqual(
      Object.keys(v4Evidence().sourceHashes),
    );
  });

  it("preserves exact historical v6 parsing and canonical serialization", () => {
    const historical = mutableV6Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(6);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V6_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.keys(parsed.sourceHashes)).toEqual(
      Object.keys(v5Evidence().sourceHashes),
    );
  });

  it("preserves exact historical v7 parsing and canonical serialization", () => {
    const historical = mutableV7Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(7);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V7_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.keys(parsed.sourceHashes)).toEqual(
      Object.keys(v7Evidence().sourceHashes),
    );
  });

  it("preserves exact historical v8 parsing and canonical serialization", () => {
    const historical = mutableV8Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(8);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V8_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.keys(parsed.toolVersions)).toEqual([
      "postgres",
      "psql",
      "pgDump",
      "pgRestore",
    ]);
    expect(Object.keys(parsed.sourceHashes)).toEqual(
      Object.keys(v8Evidence().sourceHashes),
    );
  });

  it("preserves exact historical v9 parsing and canonical serialization", () => {
    const historical = mutableV9Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(9);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V9_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.keys(parsed.toolVersions)).toEqual([
      "postgres",
      "psql",
      "pgDump",
      "pgRestore",
      "nodePostgres",
    ]);
    expect(Object.keys(parsed.sourceHashes)).toEqual(
      Object.keys(v9Evidence().sourceHashes),
    );
  });

  it("preserves exact historical v10 parsing and canonical serialization", () => {
    const historical = mutableV10Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(10);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V10_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V10_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.keys(parsed.toolVersions)).toEqual([
      "postgres",
      "psql",
      "pgDump",
      "pgRestore",
      "nodePostgres",
      "nodePostgresPool",
    ]);
    expect(Object.keys(parsed.sourceHashes)).toEqual(
      Object.keys(v10Evidence().sourceHashes),
    );
  });

  it("preserves exact historical v11 parsing and canonical serialization", () => {
    const historical = mutableV11Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(11);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V11_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V11_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(parsed.toolVersions).toEqual(v10Evidence().toolVersions);
    expect(Object.keys(parsed.sourceHashes)).toEqual(
      Object.keys(v11Evidence().sourceHashes),
    );
  });

  it("preserves exact historical v12 parsing and canonical serialization", () => {
    const historical = mutableV12Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(12);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V12_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V12_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(parsed.toolVersions).toEqual(v11Evidence().toolVersions);
    expect(Object.keys(parsed.sourceHashes)).toEqual(
      Object.keys(v12Evidence().sourceHashes),
    );
  });

  it("preserves exact historical v13 parsing and canonical serialization", () => {
    const historical = mutableV13Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(13);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V13_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V13_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(parsed.toolVersions).toEqual(v12Evidence().toolVersions);
    expect(Object.keys(parsed.sourceHashes)).toEqual(
      Object.keys(v13Evidence().sourceHashes),
    );
  });

  it("adds only the authenticated matrix claim between v2 and v3", () => {
    expect(POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
      "authenticated_runtime_authorization_matrix",
    ]);
    expect(POSTGRES_ACCEPTANCE_V3_NOT_PROVEN).toEqual(
      POSTGRES_ACCEPTANCE_V2_NOT_PROVEN.filter(
        (limitation) =>
          limitation !== "full_authenticated_runtime_authorization_matrix",
      ),
    );
  });

  it("adds the exact projection claim, source hashes, and limitations in v4", () => {
    expect(POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
      "authenticated_financial_fact_projection_query",
    ]);
    expect(POSTGRES_ACCEPTANCE_V4_NOT_PROVEN).toEqual([
      ...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
      "application_driver_pool_or_composition_root",
      "complete_dossier_history_timeline_or_dimensioned_projection",
    ]);
    expect(Object.keys(v4Evidence().sourceHashes)).toEqual([
      "workflowSha256",
      "fixtureSha256",
      "migrationManifestSha256",
      "acceptanceRunnerSha256",
      "projectionQuerySha256",
      "projectionNormalizerSha256",
    ]);
  });

  it("adds only the authenticated test-loader claim and exact split limitations in v5", () => {
    expect(POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED,
      "authenticated_test_loader_fixture_load",
    ]);
    expect(POSTGRES_ACCEPTANCE_V5_NOT_PROVEN).toEqual([
      "resolved_platform_image_manifest",
      "external_or_production_authenticated_database_sessions",
      "authenticated_migrator_sessions",
      "authenticated_backup_sessions",
      "end_user_identity_or_tenant_binding",
      "production_identity_tls_secrets_or_pooling",
      "concurrent_sessions_cancellation_or_timeouts",
      "dump_restore_or_disaster_recovery",
      "real_or_licensed_market_data",
      "application_driver_pool_or_composition_root",
      "complete_dossier_history_timeline_or_dimensioned_projection",
    ]);
    expect(POSTGRES_ACCEPTANCE_V5_NOT_PROVEN).not.toContain(
      "authenticated_migrator_test_loader_or_backup_sessions",
    );
    expect(Object.keys(v5Evidence().sourceHashes)).toEqual(
      Object.keys(v4Evidence().sourceHashes),
    );
  });

  it("adds only the bounded owner-DDL canary claim in v6", () => {
    expect(POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED,
      "authenticated_owner_ddl_canary",
    ]);
    expect(POSTGRES_ACCEPTANCE_V6_NOT_PROVEN).toBe(
      POSTGRES_ACCEPTANCE_V5_NOT_PROVEN,
    );
    expect(POSTGRES_ACCEPTANCE_V6_NOT_PROVEN).toContain(
      "authenticated_migrator_sessions",
    );
    expect(Object.keys(v6Evidence().sourceHashes)).toEqual(
      Object.keys(v5Evidence().sourceHashes),
    );
  });

  it("adds the exact authenticated migration claim, limitations, and source hashes in v7", () => {
    expect(POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED,
      "authenticated_clean_application_migrations_after_platform_bootstrap",
    ]);
    expect(POSTGRES_ACCEPTANCE_V7_NOT_PROVEN).toEqual([
      "resolved_platform_image_manifest",
      "external_or_production_authenticated_database_sessions",
      "external_production_or_incremental_authenticated_migrations",
      "globally_atomic_platform_and_application_bootstrap",
      "authenticated_backup_sessions",
      "end_user_identity_or_tenant_binding",
      "production_identity_tls_secrets_or_pooling",
      "concurrent_sessions_cancellation_or_timeouts",
      "dump_restore_or_disaster_recovery",
      "real_or_licensed_market_data",
      "application_driver_pool_or_composition_root",
      "complete_dossier_history_timeline_or_dimensioned_projection",
    ]);
    expect(POSTGRES_ACCEPTANCE_V7_NOT_PROVEN).not.toContain(
      "authenticated_migrator_sessions",
    );
    expect(Object.keys(v7Evidence().sourceHashes)).toEqual([
      ...Object.keys(v6Evidence().sourceHashes),
      "platformBootstrapV2Sha256",
      "applicationMigrationManifestV2Sha256",
      "authenticatedMigrationRendererV2Sha256",
    ]);
  });

  it("adds the exact authenticated data backup/restore claim and sources in v8", () => {
    expect(POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED,
      "authenticated_policy_scoped_application_data_dump_and_bounded_clean_restore",
    ]);
    expect(POSTGRES_ACCEPTANCE_V8_NOT_PROVEN).toEqual([
      "resolved_platform_image_manifest",
      "external_or_production_authenticated_database_sessions",
      "external_production_or_incremental_authenticated_migrations",
      "globally_atomic_platform_and_application_bootstrap",
      "external_production_incremental_or_continuous_authenticated_backups",
      "end_user_identity_or_tenant_binding",
      "production_identity_tls_secrets_or_pooling",
      "concurrent_sessions_cancellation_or_timeouts",
      "full_schema_global_object_cross_cluster_or_cross_version_restore",
      "disaster_recovery_storage_encryption_retention_rpo_or_rto",
      "real_or_licensed_market_data",
      "application_driver_pool_or_composition_root",
      "complete_dossier_history_timeline_or_dimensioned_projection",
    ]);
    expect(POSTGRES_ACCEPTANCE_V8_NOT_PROVEN).not.toContain(
      "authenticated_backup_sessions",
    );
    expect(POSTGRES_ACCEPTANCE_V8_NOT_PROVEN).not.toContain(
      "dump_restore_or_disaster_recovery",
    );
    expect(Object.keys(v8Evidence().sourceHashes)).toEqual([
      ...Object.keys(v7Evidence().sourceHashes),
      "restorePlatformV1Sha256",
      "authenticatedBackupRestorePlanV1Sha256",
    ]);
  });

  it("adds the exact single-client adapter claim, narrows the limitation, and binds v9 sources", () => {
    expect(POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED,
      "authenticated_single_client_read_only_financial_fact_projection_adapter",
    ]);
    expect(POSTGRES_ACCEPTANCE_V9_NOT_PROVEN).toEqual(
      POSTGRES_ACCEPTANCE_V8_NOT_PROVEN.map((limitation) =>
        limitation === "application_driver_pool_or_composition_root"
          ? "application_pool_or_composition_root"
          : limitation,
      ),
    );
    expect(POSTGRES_ACCEPTANCE_V9_NOT_PROVEN).not.toContain(
      "application_driver_pool_or_composition_root",
    );
    expect(Object.keys(v9Evidence().toolVersions)).toEqual([
      "postgres",
      "psql",
      "pgDump",
      "pgRestore",
      "nodePostgres",
    ]);
    expect(v9Evidence().toolVersions.nodePostgres).toBe("8.23.0");
    expect(Object.keys(v9Evidence().sourceHashes)).toEqual([
      ...Object.keys(v8Evidence().sourceHashes),
      "postgresProjectionAdapterSha256",
      "operationProjectionContractSha256",
      "databasePackageManifestSha256",
      "pnpmLockfileSha256",
    ]);
  });

  it("adds the exact bounded pool claim, narrows only pool limitations, and binds the v10 source and tool", () => {
    expect(POSTGRES_ACCEPTANCE_V10_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED,
      "authenticated_bounded_pool_lifecycle_concurrency_cancellation_and_timeout_recovery",
    ]);
    expect(POSTGRES_ACCEPTANCE_V10_NOT_PROVEN).toEqual([
      "resolved_platform_image_manifest",
      "external_or_production_authenticated_database_sessions",
      "external_production_or_incremental_authenticated_migrations",
      "globally_atomic_platform_and_application_bootstrap",
      "external_production_incremental_or_continuous_authenticated_backups",
      "end_user_identity_or_tenant_binding",
      "production_identity_tls_secrets_or_load_ready_pooling",
      "production_load_capacity_pool_tuning_or_failover",
      "prompt_queued_abort_graceful_cancel_request_or_reusable_canceled_backend",
      "full_schema_global_object_cross_cluster_or_cross_version_restore",
      "disaster_recovery_storage_encryption_retention_rpo_or_rto",
      "real_or_licensed_market_data",
      "application_composition_root",
      "complete_dossier_history_timeline_or_dimensioned_projection",
    ]);
    expect(POSTGRES_ACCEPTANCE_V10_NOT_PROVEN).not.toContain(
      "concurrent_sessions_cancellation_or_timeouts",
    );
    expect(POSTGRES_ACCEPTANCE_V10_NOT_PROVEN).not.toContain(
      "application_pool_or_composition_root",
    );
    expect(Object.keys(v10Evidence().toolVersions)).toEqual([
      "postgres",
      "psql",
      "pgDump",
      "pgRestore",
      "nodePostgres",
      "nodePostgresPool",
    ]);
    expect(v10Evidence().toolVersions.nodePostgres).toBe("8.23.0");
    expect(v10Evidence().toolVersions.nodePostgresPool).toBe("3.14.0");
    expect(Object.keys(v10Evidence().sourceHashes)).toEqual([
      ...Object.keys(v9Evidence().sourceHashes),
      "postgresProjectionPoolSha256",
    ]);
  });

  it("adds the exact locked migration claim, narrows only its limitations, and binds the v11 deployer source", () => {
    expect(POSTGRES_ACCEPTANCE_V11_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V10_CHECKS_PASSED,
      "authenticated_locked_migration_ledger_checksum_drift_refusal_one_time_replay_rollback_and_concurrent_deployment",
    ]);
    expect(POSTGRES_ACCEPTANCE_V11_NOT_PROVEN).toEqual([
      "resolved_platform_image_manifest",
      "external_or_production_authenticated_database_sessions",
      "external_or_production_incremental_migrator_credentials",
      "arbitrary_manifest_multi_release_or_general_incremental_migrations",
      "globally_atomic_platform_and_application_bootstrap",
      "production_migration_orchestration_crash_recovery_cancellation_or_failover",
      "external_production_incremental_or_continuous_authenticated_backups",
      "end_user_identity_or_tenant_binding",
      "production_identity_tls_secrets_or_load_ready_pooling",
      "production_load_capacity_pool_tuning_or_failover",
      "prompt_queued_abort_graceful_cancel_request_or_reusable_canceled_backend",
      "full_schema_global_object_cross_cluster_or_cross_version_restore",
      "disaster_recovery_storage_encryption_retention_rpo_or_rto",
      "real_or_licensed_market_data",
      "application_composition_root",
      "complete_dossier_history_timeline_or_dimensioned_projection",
    ]);
    expect(POSTGRES_ACCEPTANCE_V11_NOT_PROVEN).not.toContain(
      "external_production_or_incremental_authenticated_migrations",
    );
    expect(v11Evidence().toolVersions).toEqual(v10Evidence().toolVersions);
    expect(Object.keys(v11Evidence().sourceHashes)).toEqual([
      ...Object.keys(v10Evidence().sourceHashes),
      "postgresMigrationDeployerSha256",
    ]);
  });

  it("adds only the bounded query-plan/load claim and two reviewed sources in v12", () => {
    expect(POSTGRES_ACCEPTANCE_V12_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V11_CHECKS_PASSED,
      "authenticated_rls_indexed_query_plans_and_bounded_2000_read_load",
    ]);
    expect(POSTGRES_ACCEPTANCE_V12_NOT_PROVEN).toEqual([
      "resolved_platform_image_manifest",
      "external_or_production_authenticated_database_sessions",
      "external_or_production_incremental_migrator_credentials",
      "arbitrary_manifest_multi_release_or_general_incremental_migrations",
      "globally_atomic_platform_and_application_bootstrap",
      "production_migration_orchestration_crash_recovery_cancellation_or_failover",
      "external_production_incremental_or_continuous_authenticated_backups",
      "end_user_identity_or_tenant_binding",
      "production_identity_tls_secrets_or_load_ready_pooling",
      "production_load_capacity_pool_tuning_or_failover",
      "thousand_simultaneous_database_backends_or_connections",
      "prompt_queued_abort_graceful_cancel_request_or_reusable_canceled_backend",
      "full_schema_global_object_cross_cluster_or_cross_version_restore",
      "disaster_recovery_storage_encryption_retention_rpo_or_rto",
      "real_or_licensed_market_data",
      "application_composition_root",
      "complete_dossier_history_timeline_or_dimensioned_projection",
    ]);
    expect(v12Evidence().toolVersions).toEqual(v11Evidence().toolVersions);
    expect(Object.keys(v12Evidence().sourceHashes)).toEqual([
      ...Object.keys(v11Evidence().sourceHashes),
      "postgresQueryPlanLoadSha256",
      "queryPlanLoadFixtureSha256",
    ]);
  });

  it("adds the exact privacy-retention decision and bounded lifecycle claims and six reviewed sources in v13", () => {
    expect(POSTGRES_ACCEPTANCE_V13_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V12_CHECKS_PASSED,
      "versioned_privacy_retention_decision_contract",
      "authenticated_bounded_synthetic_resource_identifier_privacy_retention_lifecycle",
    ]);
    expect(POSTGRES_ACCEPTANCE_V13_NOT_PROVEN).toEqual([
      ...POSTGRES_ACCEPTANCE_V12_NOT_PROVEN,
      "production_privacy_legal_approval_lawful_basis_notices_or_legal_holds",
      "verified_data_subject_identity_or_production_dsar_fulfillment",
      "production_tenant_offboarding_retention_scheduler_or_monitoring",
      "external_kms_hsm_key_custody_rotation_destruction_or_recovery",
      "database_verification_of_externally_keyed_resource_tokens",
      "cryptographic_erasure_of_plaintext_database_or_backup_data",
      "production_primary_replica_cache_log_search_analytics_or_third_party_deletion",
      "production_backup_archive_expiry_deletion_restore_suppression_or_media_sanitization",
      "populated_database_privacy_migration_backfill_or_online_cutover",
      "globally_complete_or_independently_audited_deletion_proof",
      "real_customer_tenant_or_personal_data",
    ]);
    expect(v13Evidence().toolVersions).toEqual(v12Evidence().toolVersions);
    expect(Object.keys(v13Evidence().sourceHashes)).toEqual([
      ...Object.keys(v12Evidence().sourceHashes),
      "privacyRetentionPolicyV1Sha256",
      "privacyRetentionPlanManifestV1Sha256",
      "privacyRetentionPolicySourceV1Sha256",
      "privacyRetentionPlanSourceV1Sha256",
      "resourceIdentifierTokenV1Sha256",
      "privacyRetentionFixtureV1Sha256",
    ]);
  });

  it("adds the exact populated cutover contract and bounded online-cutover claims and three reviewed sources in v14", () => {
    expect(POSTGRES_ACCEPTANCE_V14_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V13_CHECKS_PASSED,
      "versioned_populated_resource_identifier_cutover_contract",
      "authenticated_bounded_synthetic_populated_resource_identifier_online_cutover",
    ]);
    expect(POSTGRES_ACCEPTANCE_V14_NOT_PROVEN).not.toContain(
      "populated_database_privacy_migration_backfill_or_online_cutover",
    );
    expect(POSTGRES_ACCEPTANCE_V14_NOT_PROVEN).toEqual([
      ...POSTGRES_ACCEPTANCE_V12_NOT_PROVEN,
      "production_privacy_legal_approval_lawful_basis_notices_or_legal_holds",
      "verified_data_subject_identity_or_production_dsar_fulfillment",
      "production_tenant_offboarding_retention_scheduler_or_monitoring",
      "external_kms_hsm_key_custody_rotation_destruction_or_recovery",
      "database_verification_of_externally_keyed_resource_tokens",
      "cryptographic_erasure_of_plaintext_database_or_backup_data",
      "production_primary_replica_cache_log_search_analytics_or_third_party_deletion",
      "production_backup_archive_expiry_deletion_restore_suppression_or_media_sanitization",
      "external_or_production_populated_database_privacy_migration_or_cutover",
      "zero_downtime_uninterrupted_writes_or_application_dual_write_deployment",
      "production_application_writer_integration_authorization_or_dual_write_protocol",
      "production_cutover_volume_duration_slo_or_lock_budget",
      "migration_process_or_cluster_crash_recovery_resume_or_post_commit_downgrade",
      "long_running_prepared_transaction_ddl_replication_or_failover_concurrency",
      "real_customer_tenant_personal_or_non_synthetic_cutover",
      "recovery_of_resource_identifiers_deleted_before_b14_capture_boundary",
      "globally_complete_or_independently_audited_deletion_proof",
      "real_customer_tenant_or_personal_data",
    ]);
    expect(evidence().toolVersions).toEqual(v13Evidence().toolVersions);
    expect(Object.keys(evidence().sourceHashes)).toEqual([
      ...Object.keys(v13Evidence().sourceHashes),
      "populatedCutoverPlanManifestV1Sha256",
      "populatedCutoverPlanSourceV1Sha256",
      "populatedCutoverFixtureV1Sha256",
    ]);
  });

  it("rejects cross-version check and limitation combinations", () => {
    const v3AsV1 = mutableV3Evidence();
    v3AsV1.schemaVersion = 1;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v3AsV1)),
    );

    const v1AsV2 = mutableV1Evidence();
    v1AsV2.schemaVersion = 2;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v1AsV2)),
    );

    const v2AsV3 = mutableV2Evidence();
    v2AsV3.schemaVersion = 3;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v2AsV3)),
    );

    const v3AsV4 = mutableV3Evidence();
    v3AsV4.schemaVersion = 4;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v3AsV4)),
    );

    const v4AsV3 = mutableV4Evidence();
    v4AsV3.schemaVersion = 3;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v4AsV3)),
    );

    const v4AsV5 = mutableV4Evidence();
    v4AsV5.schemaVersion = 5;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v4AsV5)),
    );

    const v5AsV4 = mutableV5Evidence();
    v5AsV4.schemaVersion = 4;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v5AsV4)),
    );

    const mixedV5 = mutableV5Evidence();
    mixedV5.notProven = [...POSTGRES_ACCEPTANCE_V4_NOT_PROVEN];
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(mixedV5)),
    );

    const v5AsV6 = mutableV5Evidence();
    v5AsV6.schemaVersion = 6;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v5AsV6)),
    );

    const v6AsV5 = mutableV6Evidence();
    v6AsV5.schemaVersion = 5;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v6AsV5)),
    );

    const v6AsV7 = mutableV6Evidence();
    v6AsV7.schemaVersion = 7;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v6AsV7)),
    );

    const v7AsV6 = mutableV7Evidence();
    v7AsV6.schemaVersion = 6;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v7AsV6)),
    );

    const v7AsV8 = mutableV7Evidence();
    v7AsV8.schemaVersion = 8;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v7AsV8)),
    );

    const v8AsV7 = mutableV8Evidence();
    v8AsV7.schemaVersion = 7;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v8AsV7)),
    );

    const v8AsV9 = mutableV8Evidence();
    v8AsV9.schemaVersion = 9;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v8AsV9)),
    );

    const v9AsV8 = mutableV9Evidence();
    v9AsV8.schemaVersion = 8;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v9AsV8)),
    );

    const v9AsV10 = mutableV9Evidence();
    v9AsV10.schemaVersion = 10;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v9AsV10)),
    );

    const v10AsV9 = mutableV10Evidence();
    v10AsV9.schemaVersion = 9;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v10AsV9)),
    );

    const v10AsV11 = mutableV10Evidence();
    v10AsV11.schemaVersion = 11;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v10AsV11)),
    );

    const v11AsV10 = mutableV11Evidence();
    v11AsV10.schemaVersion = 10;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v11AsV10)),
    );

    const v11AsV12 = mutableV11Evidence();
    v11AsV12.schemaVersion = 12;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v11AsV12)),
    );

    const v12AsV11 = mutableV12Evidence();
    v12AsV11.schemaVersion = 11;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v12AsV11)),
    );

    const v12AsV13 = mutableV12Evidence();
    v12AsV13.schemaVersion = 13;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v12AsV13)),
    );

    const v13AsV12 = mutableV13Evidence();
    v13AsV12.schemaVersion = 12;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v13AsV12)),
    );

    const v13AsV14 = mutableV13Evidence();
    v13AsV14.schemaVersion = 14;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v13AsV14)),
    );

    const v14AsV13 = mutableEvidence();
    v14AsV13.schemaVersion = 13;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v14AsV13)),
    );

    const mixedV1 = mutableV1Evidence();
    mixedV1.notProven = [...POSTGRES_ACCEPTANCE_NOT_PROVEN];
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(mixedV1)),
    );

    const mixedV2 = mutableV2Evidence();
    mixedV2.checksPassed = [...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED];
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(mixedV2)),
    );

    const mixedV3 = mutableV3Evidence();
    mixedV3.notProven = [...POSTGRES_ACCEPTANCE_V2_NOT_PROVEN];
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(mixedV3)),
    );

    expect(POSTGRES_ACCEPTANCE_CHECKS_PASSED).toBe(
      POSTGRES_ACCEPTANCE_V14_CHECKS_PASSED,
    );
    expect(POSTGRES_ACCEPTANCE_NOT_PROVEN).toBe(
      POSTGRES_ACCEPTANCE_V14_NOT_PROVEN,
    );
  });

  it("selects only reviewed GitHub metadata and never serializes environment secrets", () => {
    const result = buildPostgresAcceptanceEvidence(
      input({
        githubEnvironment: environment({
          GITHUB_TOKEN: `${SECRET_CANARY}-github`,
          INPUT_PASSWORD: `${SECRET_CANARY}-input`,
          RUNNER_TEMP: `${SECRET_CANARY}-path`,
        }),
      }),
    );
    const serialized = serializePostgresAcceptanceEvidence(result);
    expect(serialized).not.toContain(SECRET_CANARY);
    expect(serialized).not.toMatch(/TOKEN|PASSWORD|RUNNER_TEMP/);
    expect(Object.keys(result)).not.toContain("githubEnvironment");
  });

  it("does not inspect unrelated environment accessors", () => {
    const githubEnvironment = environment();
    Object.defineProperty(githubEnvironment, "SECRET_GETTER", {
      enumerable: true,
      get() {
        throw new Error(SECRET_CANARY);
      },
    });
    expect(() =>
      buildPostgresAcceptanceEvidence(input({ githubEnvironment })),
    ).not.toThrow();
  });

  it("serializes deterministic exact bytes and round-trips them", () => {
    const first = serializePostgresAcceptanceEvidence(evidence());
    const second = serializePostgresAcceptanceEvidence(
      buildPostgresAcceptanceEvidence(input()),
    );
    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(first.endsWith("\n\n")).toBe(false);
    expect(first).not.toContain("\r");
    expect(
      serializePostgresAcceptanceEvidence(
        parsePostgresAcceptanceEvidence(first),
      ),
    ).toBe(first);
  });

  it("parses non-canonical JSON but always reserializes canonically", () => {
    const compact = JSON.stringify(mutableEvidence());
    const parsed = parsePostgresAcceptanceEvidence(`  ${compact}\n`);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(
      serializePostgresAcceptanceEvidence(evidence()),
    );
  });

  it.each([
    ["schemaVersion", 15],
    ["suite", "different-suite"],
    ["outcome", "failed"],
    ["job", "different-job"],
    ["workflow", "Different workflow"],
    ["databaseName", "postgres"],
    ["serverVersionNumber", "170012"],
    ["serverVersion", "17.12"],
  ])("rejects a changed fixed field %s", (field, replacement) => {
    const changed = mutableEvidence();
    changed[field] = replacement;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(changed)),
    );
  });

  it("rejects missing, additional, inherited, accessor, and symbol fields", () => {
    const missing = mutableEvidence();
    delete missing.completedAt;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(missing)),
    );

    const additional = mutableEvidence();
    additional.secret = SECRET_CANARY;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(additional)),
    );

    const inherited = Object.assign(
      Object.create({ inherited: SECRET_CANARY }) as Record<string, unknown>,
      mutableEvidence(),
    );
    expectValueFreeValidationFailure(() =>
      serializePostgresAcceptanceEvidence(
        inherited as unknown as PostgresAcceptanceEvidence,
      ),
    );

    const accessor = mutableEvidence();
    Object.defineProperty(accessor, "completedAt", {
      enumerable: true,
      get: () => {
        throw new Error(SECRET_CANARY);
      },
    });
    expectValueFreeValidationFailure(() =>
      serializePostgresAcceptanceEvidence(
        accessor as unknown as PostgresAcceptanceEvidence,
      ),
    );

    const symbol = mutableEvidence();
    Object.defineProperty(symbol, Symbol("secret"), {
      enumerable: true,
      value: SECRET_CANARY,
    });
    expectValueFreeValidationFailure(() =>
      serializePostgresAcceptanceEvidence(
        symbol as unknown as PostgresAcceptanceEvidence,
      ),
    );
  });

  it("rejects missing and additional nested fields", () => {
    for (const key of ["toolVersions", "sourceHashes"] as const) {
      const missing = mutableEvidence();
      const nested = missing[key] as Record<string, unknown>;
      delete nested[Object.keys(nested)[0]!];
      expectValueFreeValidationFailure(() =>
        parsePostgresAcceptanceEvidence(JSON.stringify(missing)),
      );

      const additional = mutableEvidence();
      (additional[key] as Record<string, unknown>).secret = SECRET_CANARY;
      expectValueFreeValidationFailure(() =>
        parsePostgresAcceptanceEvidence(JSON.stringify(additional)),
      );
    }
  });

  it("requires the fixed ordered checks and limitations without extras", () => {
    for (const key of ["checksPassed", "notProven"] as const) {
      const changed = mutableEvidence();
      (changed[key] as unknown[]).reverse();
      expectValueFreeValidationFailure(() =>
        parsePostgresAcceptanceEvidence(JSON.stringify(changed)),
      );

      const missing = mutableEvidence();
      (missing[key] as unknown[]).pop();
      expectValueFreeValidationFailure(() =>
        parsePostgresAcceptanceEvidence(JSON.stringify(missing)),
      );

      const additional = mutableEvidence();
      (additional[key] as unknown[]).push(SECRET_CANARY);
      expectValueFreeValidationFailure(() =>
        parsePostgresAcceptanceEvidence(JSON.stringify(additional)),
      );
    }
  });

  it("rejects fixed-array accessors without invoking them", () => {
    const changed = mutableEvidence();
    const checks = changed.checksPassed as unknown[];
    let accessed = false;
    Object.defineProperty(checks, "0", {
      enumerable: true,
      configurable: true,
      get() {
        accessed = true;
        return POSTGRES_ACCEPTANCE_CHECKS_PASSED[0];
      },
    });
    expectValueFreeValidationFailure(() =>
      serializePostgresAcceptanceEvidence(
        changed as unknown as PostgresAcceptanceEvidence,
      ),
    );
    expect(accessed).toBe(false);
  });

  it.each(["2", 0, 1.5, 9_007_199_254_740_992])(
    "rejects a non-positive-integer artifact run attempt %s",
    (runAttempt) => {
      const changed = mutableEvidence();
      changed.runAttempt = runAttempt;
      expectValueFreeValidationFailure(() =>
        parsePostgresAcceptanceEvidence(JSON.stringify(changed)),
      );
    },
  );

  it.each([
    ["GITHUB_REPOSITORY", "missing-slash"],
    ["GITHUB_REPOSITORY_ID", "0"],
    ["GITHUB_REPOSITORY_ID", "01"],
    ["GITHUB_SHA", "B".repeat(40)],
    ["GITHUB_SHA", "b".repeat(39)],
    ["GITHUB_RUN_ID", "1e3"],
    ["GITHUB_RUN_ATTEMPT", "0"],
    ["GITHUB_RUN_ATTEMPT", "1.5"],
    ["GITHUB_RUN_ATTEMPT", "9007199254740992"],
    ["GITHUB_JOB", "another-job"],
    ["GITHUB_WORKFLOW", "Another workflow"],
    ["GITHUB_ACTIONS", "false"],
    ["CI", "false"],
  ])("rejects invalid GitHub metadata %s", (key, replacement) => {
    expectValueFreeValidationFailure(() =>
      buildPostgresAcceptanceEvidence(
        input({ githubEnvironment: environment({ [key]: replacement }) }),
      ),
    );
  });

  it("rejects absent selected GitHub metadata without coercion", () => {
    for (const key of [
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_SHA",
      "GITHUB_RUN_ID",
      "GITHUB_RUN_ATTEMPT",
    ]) {
      expectValueFreeValidationFailure(() =>
        buildPostgresAcceptanceEvidence(
          input({ githubEnvironment: environment({ [key]: undefined }) }),
        ),
      );
    }
  });

  it("rejects mismatched, malformed, and uppercase image digests", () => {
    for (const badInput of [
      input({ reviewedImageIndexDigest: `sha256:${"A".repeat(64)}` }),
      input({ reviewedImageIndexDigest: `sha256:${"a".repeat(63)}` }),
      input({
        reviewedImageReference: `docker.io/library/postgres:17.11-bookworm@sha256:${"c".repeat(64)}`,
      }),
      input({ reviewedImageReference: `postgres:17.11@${IMAGE_DIGEST}` }),
    ]) {
      expectValueFreeValidationFailure(() =>
        buildPostgresAcceptanceEvidence(badInput),
      );
    }
  });

  it("requires every exact lowercase SHA-256 source hash", () => {
    for (const key of [
      "workflowSha256",
      "fixtureSha256",
      "migrationManifestSha256",
      "acceptanceRunnerSha256",
      "projectionQuerySha256",
      "projectionNormalizerSha256",
      "platformBootstrapV2Sha256",
      "applicationMigrationManifestV2Sha256",
      "authenticatedMigrationRendererV2Sha256",
      "restorePlatformV1Sha256",
      "authenticatedBackupRestorePlanV1Sha256",
      "postgresProjectionAdapterSha256",
      "operationProjectionContractSha256",
      "databasePackageManifestSha256",
      "pnpmLockfileSha256",
      "postgresProjectionPoolSha256",
      "postgresMigrationDeployerSha256",
      "postgresQueryPlanLoadSha256",
      "queryPlanLoadFixtureSha256",
      "privacyRetentionPolicyV1Sha256",
      "privacyRetentionPlanManifestV1Sha256",
      "privacyRetentionPolicySourceV1Sha256",
      "privacyRetentionPlanSourceV1Sha256",
      "resourceIdentifierTokenV1Sha256",
      "privacyRetentionFixtureV1Sha256",
      "populatedCutoverPlanManifestV1Sha256",
      "populatedCutoverPlanSourceV1Sha256",
      "populatedCutoverFixtureV1Sha256",
    ] as const) {
      for (const replacement of [
        "f".repeat(63),
        "F".repeat(64),
        `sha256:${"f".repeat(64)}`,
      ]) {
        expectValueFreeValidationFailure(() =>
          buildPostgresAcceptanceEvidence(
            input({
              sourceHashes: { ...input().sourceHashes, [key]: replacement },
            }),
          ),
        );
      }
    }
  });

  it("rejects inexact tool identities, versions, and control characters", () => {
    for (const [key, replacement] of [
      ["postgres", "psql (PostgreSQL) 17.11"],
      ["psql", "psql (PostgreSQL) 17.12"],
      ["pgDump", "pg-dump (PostgreSQL) 17.11"],
      ["pgRestore", `pg_restore (PostgreSQL) 17.11\n${SECRET_CANARY}`],
    ] as const) {
      expectValueFreeValidationFailure(() =>
        buildPostgresAcceptanceEvidence(
          input({
            toolVersions: { ...input().toolVersions, [key]: replacement },
          }),
        ),
      );
    }
  });

  it.each(["8.22.0", "8.23.1", "v8.23.0", "8.23.0\nsecret"])(
    "rejects an inexact node-postgres version %s",
    (nodePostgres) => {
      expectValueFreeValidationFailure(() =>
        buildPostgresAcceptanceEvidence(
          input({
            toolVersions: {
              ...input().toolVersions,
              nodePostgres: nodePostgres as "8.23.0",
            },
          }),
        ),
      );
    },
  );

  it.each(["3.13.0", "3.14.1", "v3.14.0", "3.14.0\nsecret"])(
    "rejects an inexact node-postgres-pool version %s",
    (nodePostgresPool) => {
      expectValueFreeValidationFailure(() =>
        buildPostgresAcceptanceEvidence(
          input({
            toolVersions: {
              ...input().toolVersions,
              nodePostgresPool: nodePostgresPool as "3.14.0",
            },
          }),
        ),
      );
    },
  );

  it.each([
    "2026-08-15T23:59:58Z",
    "2026-08-15T18:59:58.123-05:00",
    "2026-02-30T23:59:58.123Z",
    "2026-08-15T23:59:58.123000Z",
    "2026-08-15 23:59:58.123Z",
  ])("rejects noncanonical or impossible completion time %s", (completedAt) => {
    expectValueFreeValidationFailure(() =>
      buildPostgresAcceptanceEvidence(input({ completedAt })),
    );
  });

  it("rejects malformed JSON with the same value-free error", () => {
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(`{"secret":"${SECRET_CANARY}"`),
    );
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(" ".repeat(32_769)),
    );
  });

  it("writes only the fixed RUNNER_TEMP path with exact-byte SHA-256", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rc-pg-evidence-"));
    TEMP_DIRECTORIES.push(directory);
    const expectedBytes = Buffer.from(
      serializePostgresAcceptanceEvidence(evidence()),
      "utf8",
    );

    const result = await writePostgresAcceptanceEvidence(evidence(), {
      RUNNER_TEMP: directory,
      SECRET: SECRET_CANARY,
    });

    expect(dirname(result.path)).toBe(directory);
    expect(basename(result.path)).toBe(POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME);
    expect(await readFile(result.path)).toEqual(expectedBytes);
    expect(result.byteLength).toBe(expectedBytes.byteLength);
    expect(result.sha256).toBe(
      createHash("sha256").update(expectedBytes).digest("hex"),
    );
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(result)).toBe(true);

    if (process.platform !== "win32") {
      expect((await stat(result.path)).mode & 0o777).toBe(0o600);
    }
  });

  it("never writes a historical v1 through v13 record under the v14 filename", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rc-pg-evidence-"));
    TEMP_DIRECTORIES.push(directory);

    for (const historical of [
      v1Evidence(),
      v2Evidence(),
      v3Evidence(),
      v4Evidence(),
      v5Evidence(),
      v6Evidence(),
      v7Evidence(),
      v8Evidence(),
      v9Evidence(),
      v10Evidence(),
      v11Evidence(),
      v12Evidence(),
      v13Evidence(),
    ]) {
      await expect(
        writePostgresAcceptanceEvidence(
          historical as unknown as PostgresAcceptanceEvidenceV14,
          { RUNNER_TEMP: directory },
        ),
      ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceError);
    }
  });

  it("fails atomically and preserves a pre-existing evidence file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rc-pg-evidence-"));
    TEMP_DIRECTORIES.push(directory);
    const path = join(directory, POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME);
    const sentinel = Buffer.from(SECRET_CANARY, "utf8");
    await writeFile(path, sentinel);

    await expect(
      writePostgresAcceptanceEvidence(evidence(), { RUNNER_TEMP: directory }),
    ).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(path)).toEqual(sentinel);
  });

  it.each([undefined, "", "relative/path", " /absolute/path", "/path\nsecret"])(
    "rejects an invalid runner temporary directory %s",
    async (runnerTemp) => {
      await expect(
        writePostgresAcceptanceEvidence(evidence(), {
          RUNNER_TEMP: runnerTemp,
        }),
      ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceError);
    },
  );
});
