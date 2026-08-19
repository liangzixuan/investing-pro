import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import {
  buildPostgresAcceptanceEvidence,
  POSTGRES_ACCEPTANCE_CHECKS_PASSED,
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
  serializePostgresAcceptanceEvidence,
} from "../src/postgres-acceptance-evidence";
import {
  POSTGRES_ACCEPTANCE_OFFLINE_VERIFICATION_CHECKS,
  POSTGRES_ACCEPTANCE_OFFLINE_VERIFIER_NOT_PROVEN,
  PostgresAcceptanceEvidenceVerificationError,
  verifyPostgresAcceptanceEvidenceOffline,
  type VerifyPostgresAcceptanceEvidenceOfflineInput,
} from "../src/postgres-acceptance-evidence-verifier";

const SECRET_CANARY = "offline-verifier-secret-canary";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let BASE_INPUT: VerifyPostgresAcceptanceEvidenceOfflineInput;

interface MutableInput {
  evidenceBytes: Uint8Array;
  trustAnchors: {
    evidenceSha256: string;
    repository: string;
    repositoryId: string;
    commitSha: string;
    runId: string;
    runAttempt: number;
  };
  sources: {
    imageConfig: Uint8Array;
    workflow: Uint8Array;
    fixture: Uint8Array;
    migrationManifest: Uint8Array;
    acceptanceRunner: Uint8Array;
    projectionQuery?: Uint8Array;
    projectionNormalizer?: Uint8Array;
    platformBootstrapV2?: Uint8Array;
    applicationMigrationManifestV2?: Uint8Array;
    authenticatedMigrationRendererV2?: Uint8Array;
    restorePlatformV1?: Uint8Array;
    authenticatedBackupRestorePlanV1?: Uint8Array;
    postgresProjectionAdapter?: Uint8Array;
    operationProjectionContract?: Uint8Array;
    databasePackageManifest?: Uint8Array;
    pnpmLockfile?: Uint8Array;
    postgresProjectionPool?: Uint8Array;
    postgresMigrationDeployer?: Uint8Array;
    postgresQueryPlanLoad?: Uint8Array;
    queryPlanLoadFixture?: Uint8Array;
    privacyRetentionPolicyV1?: Uint8Array;
    privacyRetentionPlanManifestV1?: Uint8Array;
    privacyRetentionPlanPlatformV1?: Uint8Array;
    privacyRetentionPolicySourceV1?: Uint8Array;
    privacyRetentionPlanSourceV1?: Uint8Array;
    resourceIdentifierTokenV1?: Uint8Array;
    privacyRetentionFixtureV1?: Uint8Array;
    privacyRetentionPlanMigrationsV1?: Array<{
      id: string;
      file: string;
      bytes: Uint8Array;
    }>;
    applicationMigrationsV2?: Array<{
      id: string;
      file: string;
      bytes: Uint8Array;
    }>;
    migrations: Array<{ id: string; file: string; bytes: Uint8Array }>;
  };
}

beforeAll(async () => {
  BASE_INPUT = await createValidInput();
});

function bytes(value: string): Uint8Array {
  return encoder.encode(value);
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function exactCopy(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}

function cloneInput(): MutableInput {
  return {
    evidenceBytes: exactCopy(BASE_INPUT.evidenceBytes),
    trustAnchors: { ...BASE_INPUT.trustAnchors },
    sources: {
      imageConfig: exactCopy(BASE_INPUT.sources.imageConfig),
      workflow: exactCopy(BASE_INPUT.sources.workflow),
      fixture: exactCopy(BASE_INPUT.sources.fixture),
      migrationManifest: exactCopy(BASE_INPUT.sources.migrationManifest),
      acceptanceRunner: exactCopy(BASE_INPUT.sources.acceptanceRunner),
      projectionQuery: exactCopy(BASE_INPUT.sources.projectionQuery!),
      projectionNormalizer: exactCopy(BASE_INPUT.sources.projectionNormalizer!),
      platformBootstrapV2: exactCopy(BASE_INPUT.sources.platformBootstrapV2!),
      applicationMigrationManifestV2: exactCopy(
        BASE_INPUT.sources.applicationMigrationManifestV2!,
      ),
      authenticatedMigrationRendererV2: exactCopy(
        BASE_INPUT.sources.authenticatedMigrationRendererV2!,
      ),
      restorePlatformV1: exactCopy(BASE_INPUT.sources.restorePlatformV1!),
      authenticatedBackupRestorePlanV1: exactCopy(
        BASE_INPUT.sources.authenticatedBackupRestorePlanV1!,
      ),
      postgresProjectionAdapter: exactCopy(
        BASE_INPUT.sources.postgresProjectionAdapter!,
      ),
      operationProjectionContract: exactCopy(
        BASE_INPUT.sources.operationProjectionContract!,
      ),
      databasePackageManifest: exactCopy(
        BASE_INPUT.sources.databasePackageManifest!,
      ),
      pnpmLockfile: exactCopy(BASE_INPUT.sources.pnpmLockfile!),
      postgresProjectionPool: exactCopy(
        BASE_INPUT.sources.postgresProjectionPool!,
      ),
      postgresMigrationDeployer: exactCopy(
        BASE_INPUT.sources.postgresMigrationDeployer!,
      ),
      postgresQueryPlanLoad: exactCopy(
        BASE_INPUT.sources.postgresQueryPlanLoad!,
      ),
      queryPlanLoadFixture: exactCopy(BASE_INPUT.sources.queryPlanLoadFixture!),
      privacyRetentionPolicyV1: exactCopy(
        BASE_INPUT.sources.privacyRetentionPolicyV1!,
      ),
      privacyRetentionPlanManifestV1: exactCopy(
        BASE_INPUT.sources.privacyRetentionPlanManifestV1!,
      ),
      privacyRetentionPlanPlatformV1: exactCopy(
        BASE_INPUT.sources.privacyRetentionPlanPlatformV1!,
      ),
      privacyRetentionPolicySourceV1: exactCopy(
        BASE_INPUT.sources.privacyRetentionPolicySourceV1!,
      ),
      privacyRetentionPlanSourceV1: exactCopy(
        BASE_INPUT.sources.privacyRetentionPlanSourceV1!,
      ),
      resourceIdentifierTokenV1: exactCopy(
        BASE_INPUT.sources.resourceIdentifierTokenV1!,
      ),
      privacyRetentionFixtureV1: exactCopy(
        BASE_INPUT.sources.privacyRetentionFixtureV1!,
      ),
      privacyRetentionPlanMigrationsV1:
        BASE_INPUT.sources.privacyRetentionPlanMigrationsV1!.map(
          (migration) => ({
            id: migration.id,
            file: migration.file,
            bytes: exactCopy(migration.bytes),
          }),
        ),
      applicationMigrationsV2: BASE_INPUT.sources.applicationMigrationsV2!.map(
        (migration) => ({
          id: migration.id,
          file: migration.file,
          bytes: exactCopy(migration.bytes),
        }),
      ),
      migrations: BASE_INPUT.sources.migrations.map((migration) => ({
        id: migration.id,
        file: migration.file,
        bytes: exactCopy(migration.bytes),
      })),
    },
  };
}

function canonicalJson(value: unknown): Uint8Array {
  return bytes(`${JSON.stringify(value, null, 2)}\n`);
}

function parsedEvidence(input: VerifyPostgresAcceptanceEvidenceOfflineInput) {
  return JSON.parse(decoder.decode(input.evidenceBytes)) as Record<
    string,
    unknown
  >;
}

function replaceEvidenceBytes(
  input: VerifyPostgresAcceptanceEvidenceOfflineInput,
  replacement: Uint8Array,
): MutableInput {
  const changed = cloneFrom(input);
  changed.evidenceBytes = replacement;
  changed.trustAnchors = {
    ...changed.trustAnchors,
    evidenceSha256: sha256(replacement),
  };
  return changed;
}

function mutateEvidence(
  input: VerifyPostgresAcceptanceEvidenceOfflineInput,
  mutate: (value: Record<string, unknown>) => void,
): MutableInput {
  const value = parsedEvidence(input);
  mutate(value);
  return replaceEvidenceBytes(input, canonicalJson(value));
}

function historicalInput(
  schemaVersion: 1 | 2 | 3,
  checksPassed:
    | typeof POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED
    | typeof POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED
    | typeof POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
  notProven:
    | typeof POSTGRES_ACCEPTANCE_V1_NOT_PROVEN
    | typeof POSTGRES_ACCEPTANCE_V2_NOT_PROVEN
    | typeof POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
): MutableInput {
  const input = mutateEvidence(v6Input(), (record) => {
    record.schemaVersion = schemaVersion;
    record.checksPassed = [...checksPassed];
    record.notProven = [...notProven];
    const hashes = record.sourceHashes as Record<string, unknown>;
    delete hashes.projectionQuerySha256;
    delete hashes.projectionNormalizerSha256;
  });
  delete input.sources.projectionQuery;
  delete input.sources.projectionNormalizer;
  return input;
}

function removeV7SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.platformBootstrapV2Sha256;
  delete hashes.applicationMigrationManifestV2Sha256;
  delete hashes.authenticatedMigrationRendererV2Sha256;
}

function removeV8SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.restorePlatformV1Sha256;
  delete hashes.authenticatedBackupRestorePlanV1Sha256;
}

function removeV9SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.postgresProjectionAdapterSha256;
  delete hashes.operationProjectionContractSha256;
  delete hashes.databasePackageManifestSha256;
  delete hashes.pnpmLockfileSha256;
  delete (record.toolVersions as Record<string, unknown>).nodePostgres;
}

function removeV10SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.postgresProjectionPoolSha256;
  delete (record.toolVersions as Record<string, unknown>).nodePostgresPool;
}

function removeV11SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.postgresMigrationDeployerSha256;
}

function removeV12SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.postgresQueryPlanLoadSha256;
  delete hashes.queryPlanLoadFixtureSha256;
}

function removeV13SourceHashes(record: Record<string, unknown>): void {
  const hashes = record.sourceHashes as Record<string, unknown>;
  delete hashes.privacyRetentionPolicyV1Sha256;
  delete hashes.privacyRetentionPlanManifestV1Sha256;
  delete hashes.privacyRetentionPolicySourceV1Sha256;
  delete hashes.privacyRetentionPlanSourceV1Sha256;
  delete hashes.resourceIdentifierTokenV1Sha256;
  delete hashes.privacyRetentionFixtureV1Sha256;
}

function removeV7Sources(input: MutableInput): void {
  delete input.sources.platformBootstrapV2;
  delete input.sources.applicationMigrationManifestV2;
  delete input.sources.authenticatedMigrationRendererV2;
  delete input.sources.applicationMigrationsV2;
}

function removeV8Sources(input: MutableInput): void {
  delete input.sources.restorePlatformV1;
  delete input.sources.authenticatedBackupRestorePlanV1;
}

function removeV9Sources(input: MutableInput): void {
  delete input.sources.postgresProjectionAdapter;
  delete input.sources.operationProjectionContract;
  delete input.sources.databasePackageManifest;
  delete input.sources.pnpmLockfile;
}

function removeV10Sources(input: MutableInput): void {
  delete input.sources.postgresProjectionPool;
}

function removeV11Sources(input: MutableInput): void {
  delete input.sources.postgresMigrationDeployer;
}

function removeV12Sources(input: MutableInput): void {
  delete input.sources.postgresQueryPlanLoad;
  delete input.sources.queryPlanLoadFixture;
}

function removeV13Sources(input: MutableInput): void {
  delete input.sources.privacyRetentionPolicyV1;
  delete input.sources.privacyRetentionPlanManifestV1;
  delete input.sources.privacyRetentionPlanPlatformV1;
  delete input.sources.privacyRetentionPlanMigrationsV1;
  delete input.sources.privacyRetentionPolicySourceV1;
  delete input.sources.privacyRetentionPlanSourceV1;
  delete input.sources.resourceIdentifierTokenV1;
  delete input.sources.privacyRetentionFixtureV1;
}

function v12Input(): MutableInput {
  let input = mutateEvidence(cloneInput(), (record) => {
    record.schemaVersion = 12;
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V12_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V12_NOT_PROVEN];
    removeV13SourceHashes(record);
  });
  removeV13Sources(input);
  input = replaceCanonicalSourceJson(
    input,
    "imageConfig",
    (imageConfig) => {
      delete imageConfig.privacyRetentionFixtureSha256;
    },
    false,
  );
  return input;
}

function v11Input(): MutableInput {
  let input = mutateEvidence(v12Input(), (record) => {
    record.schemaVersion = 11;
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V11_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V11_NOT_PROVEN];
    removeV12SourceHashes(record);
  });
  removeV12Sources(input);
  input = replaceCanonicalSourceJson(
    input,
    "imageConfig",
    (imageConfig) => {
      delete imageConfig.queryPlanLoadFixtureSha256;
    },
    false,
  );
  return input;
}

function v10Input(): MutableInput {
  const input = mutateEvidence(v11Input(), (record) => {
    record.schemaVersion = 10;
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V10_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V10_NOT_PROVEN];
    removeV11SourceHashes(record);
  });
  removeV11Sources(input);
  return input;
}

function v9Input(): MutableInput {
  const input = mutateEvidence(v10Input(), (record) => {
    record.schemaVersion = 9;
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V9_NOT_PROVEN];
    removeV10SourceHashes(record);
  });
  removeV10Sources(input);
  return input;
}

function v8Input(): MutableInput {
  const input = mutateEvidence(v9Input(), (record) => {
    record.schemaVersion = 8;
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V8_NOT_PROVEN];
    removeV9SourceHashes(record);
  });
  removeV9Sources(input);
  return input;
}

function v7Input(): MutableInput {
  const input = mutateEvidence(v8Input(), (record) => {
    record.schemaVersion = 7;
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V7_NOT_PROVEN];
    removeV8SourceHashes(record);
  });
  removeV8Sources(input);
  return input;
}

function v6Input(): MutableInput {
  const input = mutateEvidence(v7Input(), (record) => {
    record.schemaVersion = 6;
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V6_NOT_PROVEN];
    removeV7SourceHashes(record);
  });
  removeV7Sources(input);
  return input;
}

function v4Input(): MutableInput {
  return mutateEvidence(v6Input(), (record) => {
    record.schemaVersion = 4;
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V4_NOT_PROVEN];
  });
}

function v5Input(): MutableInput {
  return mutateEvidence(v6Input(), (record) => {
    record.schemaVersion = 5;
    record.checksPassed = [...POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED];
    record.notProven = [...POSTGRES_ACCEPTANCE_V5_NOT_PROVEN];
  });
}

function replaceCanonicalSourceJson(
  input: VerifyPostgresAcceptanceEvidenceOfflineInput,
  key:
    | "imageConfig"
    | "migrationManifest"
    | "applicationMigrationManifestV2"
    | "privacyRetentionPlanManifestV1",
  mutate: (value: Record<string, unknown>) => void,
  updateRecordedHash: boolean,
): MutableInput {
  const next = cloneFrom(input);
  const value = JSON.parse(decoder.decode(next.sources[key])) as Record<
    string,
    unknown
  >;
  mutate(value);
  const replacement = canonicalJson(value);
  next.sources = { ...next.sources, [key]: replacement };
  if (
    (key === "migrationManifest" ||
      key === "applicationMigrationManifestV2" ||
      key === "privacyRetentionPlanManifestV1") &&
    updateRecordedHash
  ) {
    return mutateEvidence(next, (record) => {
      const hashes = record.sourceHashes as Record<string, unknown>;
      hashes[
        key === "migrationManifest"
          ? "migrationManifestSha256"
          : key === "applicationMigrationManifestV2"
            ? "applicationMigrationManifestV2Sha256"
            : "privacyRetentionPlanManifestV1Sha256"
      ] = sha256(replacement);
    });
  }
  return next;
}

function cloneFrom(
  input: VerifyPostgresAcceptanceEvidenceOfflineInput,
): MutableInput {
  return {
    evidenceBytes: exactCopy(input.evidenceBytes),
    trustAnchors: { ...input.trustAnchors },
    sources: {
      imageConfig: exactCopy(input.sources.imageConfig),
      workflow: exactCopy(input.sources.workflow),
      fixture: exactCopy(input.sources.fixture),
      migrationManifest: exactCopy(input.sources.migrationManifest),
      acceptanceRunner: exactCopy(input.sources.acceptanceRunner),
      ...(input.sources.projectionQuery === undefined
        ? {}
        : { projectionQuery: exactCopy(input.sources.projectionQuery) }),
      ...(input.sources.projectionNormalizer === undefined
        ? {}
        : {
            projectionNormalizer: exactCopy(input.sources.projectionNormalizer),
          }),
      ...(input.sources.platformBootstrapV2 === undefined
        ? {}
        : {
            platformBootstrapV2: exactCopy(input.sources.platformBootstrapV2),
          }),
      ...(input.sources.applicationMigrationManifestV2 === undefined
        ? {}
        : {
            applicationMigrationManifestV2: exactCopy(
              input.sources.applicationMigrationManifestV2,
            ),
          }),
      ...(input.sources.authenticatedMigrationRendererV2 === undefined
        ? {}
        : {
            authenticatedMigrationRendererV2: exactCopy(
              input.sources.authenticatedMigrationRendererV2,
            ),
          }),
      ...(input.sources.restorePlatformV1 === undefined
        ? {}
        : {
            restorePlatformV1: exactCopy(input.sources.restorePlatformV1),
          }),
      ...(input.sources.authenticatedBackupRestorePlanV1 === undefined
        ? {}
        : {
            authenticatedBackupRestorePlanV1: exactCopy(
              input.sources.authenticatedBackupRestorePlanV1,
            ),
          }),
      ...(input.sources.postgresProjectionAdapter === undefined
        ? {}
        : {
            postgresProjectionAdapter: exactCopy(
              input.sources.postgresProjectionAdapter,
            ),
          }),
      ...(input.sources.operationProjectionContract === undefined
        ? {}
        : {
            operationProjectionContract: exactCopy(
              input.sources.operationProjectionContract,
            ),
          }),
      ...(input.sources.databasePackageManifest === undefined
        ? {}
        : {
            databasePackageManifest: exactCopy(
              input.sources.databasePackageManifest,
            ),
          }),
      ...(input.sources.pnpmLockfile === undefined
        ? {}
        : { pnpmLockfile: exactCopy(input.sources.pnpmLockfile) }),
      ...(input.sources.postgresProjectionPool === undefined
        ? {}
        : {
            postgresProjectionPool: exactCopy(
              input.sources.postgresProjectionPool,
            ),
          }),
      ...(input.sources.postgresMigrationDeployer === undefined
        ? {}
        : {
            postgresMigrationDeployer: exactCopy(
              input.sources.postgresMigrationDeployer,
            ),
          }),
      ...(input.sources.postgresQueryPlanLoad === undefined
        ? {}
        : {
            postgresQueryPlanLoad: exactCopy(
              input.sources.postgresQueryPlanLoad,
            ),
          }),
      ...(input.sources.queryPlanLoadFixture === undefined
        ? {}
        : {
            queryPlanLoadFixture: exactCopy(input.sources.queryPlanLoadFixture),
          }),
      ...(input.sources.privacyRetentionPolicyV1 === undefined
        ? {}
        : {
            privacyRetentionPolicyV1: exactCopy(
              input.sources.privacyRetentionPolicyV1,
            ),
          }),
      ...(input.sources.privacyRetentionPlanManifestV1 === undefined
        ? {}
        : {
            privacyRetentionPlanManifestV1: exactCopy(
              input.sources.privacyRetentionPlanManifestV1,
            ),
          }),
      ...(input.sources.privacyRetentionPlanPlatformV1 === undefined
        ? {}
        : {
            privacyRetentionPlanPlatformV1: exactCopy(
              input.sources.privacyRetentionPlanPlatformV1,
            ),
          }),
      ...(input.sources.privacyRetentionPolicySourceV1 === undefined
        ? {}
        : {
            privacyRetentionPolicySourceV1: exactCopy(
              input.sources.privacyRetentionPolicySourceV1,
            ),
          }),
      ...(input.sources.privacyRetentionPlanSourceV1 === undefined
        ? {}
        : {
            privacyRetentionPlanSourceV1: exactCopy(
              input.sources.privacyRetentionPlanSourceV1,
            ),
          }),
      ...(input.sources.resourceIdentifierTokenV1 === undefined
        ? {}
        : {
            resourceIdentifierTokenV1: exactCopy(
              input.sources.resourceIdentifierTokenV1,
            ),
          }),
      ...(input.sources.privacyRetentionFixtureV1 === undefined
        ? {}
        : {
            privacyRetentionFixtureV1: exactCopy(
              input.sources.privacyRetentionFixtureV1,
            ),
          }),
      ...(input.sources.privacyRetentionPlanMigrationsV1 === undefined
        ? {}
        : {
            privacyRetentionPlanMigrationsV1:
              input.sources.privacyRetentionPlanMigrationsV1.map(
                (migration) => ({
                  id: migration.id,
                  file: migration.file,
                  bytes: exactCopy(migration.bytes),
                }),
              ),
          }),
      ...(input.sources.applicationMigrationsV2 === undefined
        ? {}
        : {
            applicationMigrationsV2: input.sources.applicationMigrationsV2.map(
              (migration) => ({
                id: migration.id,
                file: migration.file,
                bytes: exactCopy(migration.bytes),
              }),
            ),
          }),
      migrations: input.sources.migrations.map((migration) => ({
        id: migration.id,
        file: migration.file,
        bytes: exactCopy(migration.bytes),
      })),
    },
  };
}

function changedByte(value: Uint8Array): Uint8Array {
  const changed = exactCopy(value);
  changed[0] = (changed[0] ?? 0) ^ 1;
  return changed;
}

function expectValueFreeFailure(run: () => unknown): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(PostgresAcceptanceEvidenceVerificationError);
  if (!(caught instanceof PostgresAcceptanceEvidenceVerificationError)) {
    throw new Error("expected PostgresAcceptanceEvidenceVerificationError");
  }
  expect(caught).toMatchObject({
    name: "PostgresAcceptanceEvidenceVerificationError",
    code: "INVALID_POSTGRES_ACCEPTANCE_EVIDENCE_VERIFICATION",
  });
  expect(caught.message).toBe(
    "PostgreSQL acceptance evidence offline verification failed.",
  );
  expect(caught.message).not.toContain(SECRET_CANARY);
  expect(caught).not.toHaveProperty("cause");
  expect(caught).not.toHaveProperty("field");
  expect(caught).not.toHaveProperty("value");
}

describe("offline PostgreSQL acceptance evidence verifier", () => {
  it("returns only the fixed offline-consistency result", () => {
    const result = verifyPostgresAcceptanceEvidenceOffline(cloneInput());
    expect(Object.keys(result)).toEqual([
      "schemaVersion",
      "verdict",
      "evidenceSha256",
      "repository",
      "repositoryId",
      "commitSha",
      "runId",
      "runAttempt",
      "completedAt",
      "verificationChecks",
      "recordedChecksPassed",
      "recordedNotProven",
      "verifierNotProven",
    ]);
    expect(result).toEqual({
      schemaVersion: 1,
      verdict: "offline_consistent",
      evidenceSha256: BASE_INPUT.trustAnchors.evidenceSha256,
      repository: BASE_INPUT.trustAnchors.repository,
      repositoryId: BASE_INPUT.trustAnchors.repositoryId,
      commitSha: BASE_INPUT.trustAnchors.commitSha,
      runId: BASE_INPUT.trustAnchors.runId,
      runAttempt: BASE_INPUT.trustAnchors.runAttempt,
      completedAt: "2026-08-16T02:03:04.567Z",
      verificationChecks: [...POSTGRES_ACCEPTANCE_OFFLINE_VERIFICATION_CHECKS],
      recordedChecksPassed: [...POSTGRES_ACCEPTANCE_CHECKS_PASSED],
      recordedNotProven: [...POSTGRES_ACCEPTANCE_NOT_PROVEN],
      verifierNotProven: [...POSTGRES_ACCEPTANCE_OFFLINE_VERIFIER_NOT_PROVEN],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.verificationChecks)).toBe(true);
    expect(Object.isFrozen(result.recordedChecksPassed)).toBe(true);
    expect(Object.isFrozen(result.recordedNotProven)).toBe(true);
    expect(Object.isFrozen(result.verifierNotProven)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(
      /live_verified|database_verified/,
    );
  });

  it("verifies canonical historical v1 evidence with its v1 claims", () => {
    const input = historicalInput(
      1,
      POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
      POSTGRES_ACCEPTANCE_V1_NOT_PROVEN,
    );

    const result = verifyPostgresAcceptanceEvidenceOffline(input);

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V1_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "bounded_container_local_scram_runtime_probe",
    );
  });

  it("verifies canonical historical v2 evidence with its v2 claims", () => {
    const input = historicalInput(
      2,
      POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
      POSTGRES_ACCEPTANCE_V2_NOT_PROVEN,
    );

    const result = verifyPostgresAcceptanceEvidenceOffline(input);

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V2_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_runtime_authorization_matrix",
    );
    expect(result.recordedNotProven).toContain(
      "full_authenticated_runtime_authorization_matrix",
    );
  });

  it("verifies canonical historical v3 evidence without v4 source blobs", () => {
    const input = historicalInput(
      3,
      POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
      POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
    );

    const result = verifyPostgresAcceptanceEvidenceOffline(input);

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_financial_fact_projection_query",
    );
  });

  it("verifies canonical historical v4 evidence with its exact six-source bundle", () => {
    const result = verifyPostgresAcceptanceEvidenceOffline(v4Input());

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

  it("verifies canonical historical v5 evidence with its exact six-source bundle", () => {
    const result = verifyPostgresAcceptanceEvidenceOffline(v5Input());

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

  it("verifies canonical historical v6 evidence with its exact six-source bundle", () => {
    const result = verifyPostgresAcceptanceEvidenceOffline(v6Input());

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V6_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_clean_application_migrations_after_platform_bootstrap",
    );
    expect(result.recordedNotProven).toContain(
      "authenticated_migrator_sessions",
    );
  });

  it("verifies canonical historical v7 evidence with its exact nine-source bundle", () => {
    const result = verifyPostgresAcceptanceEvidenceOffline(v7Input());

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V7_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_policy_scoped_application_data_dump_and_bounded_clean_restore",
    );
    expect(result.recordedNotProven).toContain("authenticated_backup_sessions");
  });

  it("verifies canonical historical v8 evidence without v9 driver sources", () => {
    const result = verifyPostgresAcceptanceEvidenceOffline(v8Input());

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V8_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_single_client_read_only_financial_fact_projection_adapter",
    );
    expect(result.recordedNotProven).toContain(
      "application_driver_pool_or_composition_root",
    );
  });

  it("verifies canonical historical v9 evidence without the v10 pool source or tool", () => {
    const result = verifyPostgresAcceptanceEvidenceOffline(v9Input());

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V9_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_bounded_pool_lifecycle_concurrency_cancellation_and_timeout_recovery",
    );
    expect(result.recordedNotProven).toContain(
      "application_pool_or_composition_root",
    );
  });

  it("verifies canonical historical v10 evidence without the v11 deployer source", () => {
    const result = verifyPostgresAcceptanceEvidenceOffline(v10Input());

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V10_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V10_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_locked_migration_ledger_checksum_drift_refusal_one_time_replay_rollback_and_concurrent_deployment",
    );
    expect(result.recordedNotProven).toContain(
      "external_production_or_incremental_authenticated_migrations",
    );
  });

  it("verifies canonical historical v11 evidence without v12 load sources or config field", () => {
    const result = verifyPostgresAcceptanceEvidenceOffline(v11Input());

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V11_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V11_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_rls_indexed_query_plans_and_bounded_2000_read_load",
    );
    expect(result.recordedNotProven).not.toContain(
      "thousand_simultaneous_database_backends_or_connections",
    );
  });

  it("verifies canonical historical v12 evidence without v13 privacy-retention sources or config field", () => {
    const result = verifyPostgresAcceptanceEvidenceOffline(v12Input());

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V12_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V12_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "versioned_privacy_retention_decision_contract",
    );
    expect(result.recordedNotProven).not.toContain(
      "real_customer_tenant_or_personal_data",
    );
  });

  it("rejects evidence that mixes claims and source bundles across versions", () => {
    for (const input of [
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 1;
        record.notProven = [...POSTGRES_ACCEPTANCE_V1_NOT_PROVEN];
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.checksPassed = [...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED];
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 2;
        record.notProven = [...POSTGRES_ACCEPTANCE_V2_NOT_PROVEN];
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.checksPassed = [...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED];
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 3;
        record.checksPassed = [...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED];
        record.notProven = [...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN];
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 4;
        record.checksPassed = [...POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED];
        record.notProven = [...POSTGRES_ACCEPTANCE_V5_NOT_PROVEN];
      }),
      mutateEvidence(v4Input(), (record) => {
        record.schemaVersion = 5;
      }),
      mutateEvidence(v5Input(), (record) => {
        record.schemaVersion = 6;
      }),
      mutateEvidence(v6Input(), (record) => {
        record.schemaVersion = 7;
      }),
      mutateEvidence(v7Input(), (record) => {
        record.schemaVersion = 8;
      }),
      mutateEvidence(v8Input(), (record) => {
        record.schemaVersion = 9;
      }),
      mutateEvidence(v9Input(), (record) => {
        record.schemaVersion = 10;
      }),
      mutateEvidence(v10Input(), (record) => {
        record.schemaVersion = 11;
      }),
      mutateEvidence(v11Input(), (record) => {
        record.schemaVersion = 12;
      }),
      mutateEvidence(v12Input(), (record) => {
        record.schemaVersion = 13;
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 12;
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 11;
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 10;
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 9;
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 8;
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 7;
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 5;
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 4;
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.checksPassed = [...POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED];
        record.notProven = [...POSTGRES_ACCEPTANCE_V4_NOT_PROVEN];
      }),
    ]) {
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }
  });

  it("requires the exact version-specific source bundle", () => {
    for (const key of [
      "privacyRetentionPolicyV1",
      "privacyRetentionPlanManifestV1",
      "privacyRetentionPlanPlatformV1",
      "privacyRetentionPlanMigrationsV1",
      "privacyRetentionPolicySourceV1",
      "privacyRetentionPlanSourceV1",
      "resourceIdentifierTokenV1",
      "privacyRetentionFixtureV1",
    ] as const) {
      const missing = cloneInput();
      delete missing.sources[key];
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(missing),
      );
    }

    const missingV12Module = cloneInput();
    delete missingV12Module.sources.postgresQueryPlanLoad;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV12Module),
    );

    const missingV12Fixture = cloneInput();
    delete missingV12Fixture.sources.queryPlanLoadFixture;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV12Fixture),
    );

    const missingV11 = cloneInput();
    delete missingV11.sources.postgresMigrationDeployer;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV11),
    );

    const missingV10 = v10Input();
    delete missingV10.sources.postgresProjectionPool;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV10),
    );

    const missingV9 = v9Input();
    delete missingV9.sources.postgresProjectionAdapter;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV9),
    );

    const missingV8 = cloneInput();
    delete missingV8.sources.restorePlatformV1;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV8),
    );

    const missingV7 = v7Input();
    delete missingV7.sources.platformBootstrapV2;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV7),
    );

    const missingV6 = v6Input();
    delete missingV6.sources.projectionQuery;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV6),
    );

    const missingV5 = v5Input();
    delete missingV5.sources.projectionNormalizer;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV5),
    );

    const missingV4 = v4Input();
    delete missingV4.sources.projectionNormalizer;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV4),
    );

    const extraHistorical = historicalInput(
      3,
      POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
      POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
    );
    (
      extraHistorical.sources as unknown as Record<string, unknown>
    ).projectionQuery = exactCopy(BASE_INPUT.sources.projectionQuery!);
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extraHistorical),
    );

    const extraV6 = v6Input();
    (
      extraV6.sources as unknown as Record<string, unknown>
    ).platformBootstrapV2 = exactCopy(BASE_INPUT.sources.platformBootstrapV2!);
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extraV6),
    );

    const extraV7 = v7Input();
    (extraV7.sources as unknown as Record<string, unknown>).restorePlatformV1 =
      exactCopy(BASE_INPUT.sources.restorePlatformV1!);
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extraV7),
    );

    const extraV8 = v8Input();
    (
      extraV8.sources as unknown as Record<string, unknown>
    ).postgresProjectionAdapter = exactCopy(
      BASE_INPUT.sources.postgresProjectionAdapter!,
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extraV8),
    );

    const extraV9 = v9Input();
    (
      extraV9.sources as unknown as Record<string, unknown>
    ).postgresProjectionPool = exactCopy(
      BASE_INPUT.sources.postgresProjectionPool!,
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extraV9),
    );

    const extraV10 = v10Input();
    (
      extraV10.sources as unknown as Record<string, unknown>
    ).postgresMigrationDeployer = exactCopy(
      BASE_INPUT.sources.postgresMigrationDeployer!,
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extraV10),
    );

    const extraV11 = v11Input();
    (
      extraV11.sources as unknown as Record<string, unknown>
    ).postgresQueryPlanLoad = exactCopy(
      BASE_INPUT.sources.postgresQueryPlanLoad!,
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extraV11),
    );

    const extraV12 = v12Input();
    (
      extraV12.sources as unknown as Record<string, unknown>
    ).privacyRetentionPolicyV1 = exactCopy(
      BASE_INPUT.sources.privacyRetentionPolicyV1!,
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extraV12),
    );

    expect(POSTGRES_ACCEPTANCE_CHECKS_PASSED).toBe(
      POSTGRES_ACCEPTANCE_V13_CHECKS_PASSED,
    );
    expect(POSTGRES_ACCEPTANCE_NOT_PROVEN).toBe(
      POSTGRES_ACCEPTANCE_V13_NOT_PROVEN,
    );
  });

  it(
    "uses defensive byte copies and does not mutate the input",
    { timeout: 30_000 },
    () => {
      const input = cloneInput();
      const before = structuredClone(input);
      const result = verifyPostgresAcceptanceEvidenceOffline(input);
      expect(input).toEqual(before);
      input.evidenceBytes.fill(0);
      input.sources.workflow.fill(0);
      expect(result.evidenceSha256).toBe(
        BASE_INPUT.trustAnchors.evidenceSha256,
      );
      expect(result.verdict).toBe("offline_consistent");
    },
  );

  it.each([
    "evidenceSha256",
    "repository",
    "repositoryId",
    "commitSha",
    "runId",
    "runAttempt",
  ] as const)("rejects an independently mismatched %s anchor", (key) => {
    const input = cloneInput();
    const replacements = {
      evidenceSha256: "f".repeat(64),
      repository: "different/repository",
      repositoryId: "999999",
      commitSha: "f".repeat(40),
      runId: "999999",
      runAttempt: 99,
    } as const;
    input.trustAnchors = {
      ...input.trustAnchors,
      [key]: replacements[key],
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(input),
    );
  });

  it.each([
    ["evidenceSha256", `sha256:${"a".repeat(64)}`],
    ["repository", "no-slash"],
    ["repositoryId", "01"],
    ["commitSha", "A".repeat(40)],
    ["runId", "0"],
    ["runAttempt", "1"],
    ["runAttempt", 0],
    ["runAttempt", 1.5],
  ] as const)("rejects malformed anchor %s", (key, replacement) => {
    const input = cloneInput();
    input.trustAnchors = {
      ...input.trustAnchors,
      [key]: replacement,
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(input),
    );
  });

  it("rejects missing, additional, inherited, accessor, and symbol input fields", () => {
    const missing = cloneInput() as unknown as Record<string, unknown>;
    delete missing.sources;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(
        missing as unknown as VerifyPostgresAcceptanceEvidenceOfflineInput,
      ),
    );

    const additional = cloneInput() as unknown as Record<string, unknown>;
    additional.secret = SECRET_CANARY;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(
        additional as unknown as VerifyPostgresAcceptanceEvidenceOfflineInput,
      ),
    );

    const inherited = Object.assign(
      Object.create({ secret: SECRET_CANARY }) as Record<string, unknown>,
      cloneInput(),
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(inherited),
    );

    const accessor = cloneInput() as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, "sources", {
      enumerable: true,
      get() {
        throw new Error(SECRET_CANARY);
      },
    });
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(
        accessor as unknown as VerifyPostgresAcceptanceEvidenceOfflineInput,
      ),
    );

    const symbol = cloneInput() as unknown as Record<PropertyKey, unknown>;
    symbol[Symbol("secret")] = SECRET_CANARY;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(
        symbol as unknown as VerifyPostgresAcceptanceEvidenceOfflineInput,
      ),
    );
  });

  it("rejects non-plain nested records and accessor-backed migration entries", () => {
    const anchorInput = cloneInput();
    const nullPrototypeAnchors = { ...anchorInput.trustAnchors };
    Object.setPrototypeOf(nullPrototypeAnchors, null);
    anchorInput.trustAnchors = nullPrototypeAnchors;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(anchorInput),
    );

    const sourceInput = cloneInput();
    const migration = sourceInput.sources.migrations[0]!;
    Object.defineProperty(migration, "bytes", {
      enumerable: true,
      get() {
        throw new Error(SECRET_CANARY);
      },
    });
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(sourceInput),
    );
  });

  it("requires genuine bounded Uint8Array values", () => {
    const bufferInput = cloneInput();
    bufferInput.evidenceBytes = Buffer.from(bufferInput.evidenceBytes);
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(bufferInput),
    );

    const decoratedInput = cloneInput();
    Object.defineProperty(decoratedInput.evidenceBytes, "secret", {
      enumerable: true,
      value: SECRET_CANARY,
    });
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(decoratedInput),
    );

    const oversized = cloneInput();
    oversized.evidenceBytes = new Uint8Array(32 * 1024 + 1);
    oversized.trustAnchors = {
      ...oversized.trustAnchors,
      evidenceSha256: sha256(oversized.evidenceBytes),
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(oversized),
    );
  });

  it.each(["leading", "trailing", "compact", "crlf", "bom"] as const)(
    "rejects %s noncanonical evidence bytes even with a matching outer hash",
    (variant) => {
      const input = cloneInput();
      const text = decoder.decode(input.evidenceBytes);
      const replacements = {
        leading: bytes(` ${text}`),
        trailing: bytes(`${text}\n`),
        compact: bytes(JSON.stringify(JSON.parse(text) as unknown)),
        crlf: bytes(text.replaceAll("\n", "\r\n")),
        bom: Uint8Array.from([0xef, 0xbb, 0xbf, ...input.evidenceBytes]),
      };
      const changed = replaceEvidenceBytes(input, replacements[variant]);
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(changed),
      );
    },
  );

  it("rejects duplicate top-level and nested members instead of JSON last-wins", () => {
    for (const duplicate of [
      decoder
        .decode(BASE_INPUT.evidenceBytes)
        .replace(
          '  "repository":',
          `  "repository": "${SECRET_CANARY}/forged",\n  "repository":`,
        ),
      decoder
        .decode(BASE_INPUT.evidenceBytes)
        .replace(
          '    "workflowSha256":',
          `    "workflowSha256": "${"0".repeat(64)}",\n    "workflowSha256":`,
        ),
    ]) {
      const changed = replaceEvidenceBytes(cloneInput(), bytes(duplicate));
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(changed),
      );
    }
  });

  it("rejects canonical records with altered success claims or closed lists", () => {
    const changes: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        value.outcome = "failed";
      },
      (value) => {
        (value.checksPassed as unknown[]).pop();
      },
      (value) => {
        (value.notProven as unknown[]).push(SECRET_CANARY);
      },
      (value) => {
        delete (value.sourceHashes as Record<string, unknown>)
          .acceptanceRunnerSha256;
      },
    ];
    for (const change of changes) {
      const input = mutateEvidence(cloneInput(), change);
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }
  });

  it("rejects malformed UTF-8 before interpreting evidence", () => {
    const input = replaceEvidenceBytes(cloneInput(), Uint8Array.of(0xff));
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(input),
    );
  });

  it("rejects every changed recorded source byte", { timeout: 30_000 }, () => {
    for (const key of [
      "workflow",
      "fixture",
      "migrationManifest",
      "acceptanceRunner",
      "projectionQuery",
      "projectionNormalizer",
      "platformBootstrapV2",
      "applicationMigrationManifestV2",
      "authenticatedMigrationRendererV2",
      "restorePlatformV1",
      "authenticatedBackupRestorePlanV1",
      "postgresProjectionAdapter",
      "operationProjectionContract",
      "databasePackageManifest",
      "pnpmLockfile",
      "postgresProjectionPool",
      "postgresMigrationDeployer",
      "postgresQueryPlanLoad",
      "queryPlanLoadFixture",
      "privacyRetentionPolicyV1",
      "privacyRetentionPlanManifestV1",
      "privacyRetentionPlanPlatformV1",
      "privacyRetentionPolicySourceV1",
      "privacyRetentionPlanSourceV1",
      "resourceIdentifierTokenV1",
      "privacyRetentionFixtureV1",
    ] as const) {
      const input = cloneInput();
      input.sources = {
        ...input.sources,
        [key]: changedByte(input.sources[key]!),
      };
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }

    const changedPrivacyMigration = cloneInput();
    changedPrivacyMigration.sources.privacyRetentionPlanMigrationsV1![0] = {
      ...changedPrivacyMigration.sources.privacyRetentionPlanMigrationsV1![0]!,
      bytes: changedByte(
        changedPrivacyMigration.sources.privacyRetentionPlanMigrationsV1![0]!
          .bytes,
      ),
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(changedPrivacyMigration),
    );
  });

  it("rejects image target, version, runner, and reviewed-input inconsistencies", () => {
    const changes: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        value.indexDigest = `sha256:${"0".repeat(64)}`;
      },
      (value) => {
        value.reference = `docker.io/library/postgres:17.11-bookworm@sha256:${"0".repeat(64)}`;
      },
      (value) => {
        value.expectedServerVersionNumber = 170012;
      },
      (value) => {
        value.databaseName = "another_database";
      },
      (value) => {
        value.workflowSha256 = "0".repeat(64);
      },
      (value) => {
        value.queryPlanLoadFixtureSha256 = "0".repeat(64);
      },
      (value) => {
        value.privacyRetentionFixtureSha256 = "0".repeat(64);
      },
      (value) => {
        (value.runner as Record<string, unknown>).architecture = "arm64";
      },
    ];
    for (const change of changes) {
      const input = replaceCanonicalSourceJson(
        cloneInput(),
        "imageConfig",
        change,
        false,
      );
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }
  });

  it("requires canonical exact-schema image config bytes", () => {
    const noncanonical = cloneInput();
    noncanonical.sources = {
      ...noncanonical.sources,
      imageConfig: bytes(
        ` ${decoder.decode(noncanonical.sources.imageConfig)}`,
      ),
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(noncanonical),
    );

    const missingV12FixtureHash = replaceCanonicalSourceJson(
      cloneInput(),
      "imageConfig",
      (value) => {
        delete value.queryPlanLoadFixtureSha256;
      },
      false,
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV12FixtureHash),
    );

    const missingV13FixtureHash = replaceCanonicalSourceJson(
      cloneInput(),
      "imageConfig",
      (value) => {
        delete value.privacyRetentionFixtureSha256;
      },
      false,
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV13FixtureHash),
    );

    const extra = replaceCanonicalSourceJson(
      cloneInput(),
      "imageConfig",
      (value) => {
        value.secret = SECRET_CANARY;
      },
      false,
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extra),
    );
  });

  it("requires the manifest and migration source inventories to match exactly", () => {
    const missing = cloneInput();
    missing.sources = {
      ...missing.sources,
      migrations: missing.sources.migrations.slice(1),
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missing),
    );

    const extra = cloneInput();
    extra.sources = {
      ...extra.sources,
      migrations: [
        ...extra.sources.migrations,
        {
          id: "0008",
          file: "0008_unexpected.sql",
          bytes: bytes("SELECT 1;\n"),
        },
      ],
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extra),
    );

    const reordered = cloneInput();
    reordered.sources = {
      ...reordered.sources,
      migrations: [...reordered.sources.migrations].reverse(),
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(reordered),
    );
  });

  it("rejects migration ID, filename, and exact-byte hash mismatches", () => {
    for (const mutate of [
      (input: MutableInput) => {
        const migrations = [...input.sources.migrations];
        migrations[0] = { ...migrations[0]!, id: "0002" };
        input.sources = { ...input.sources, migrations };
      },
      (input: MutableInput) => {
        const migrations = [...input.sources.migrations];
        migrations[0] = { ...migrations[0]!, file: "0001_wrong.sql" };
        input.sources = { ...input.sources, migrations };
      },
      (input: MutableInput) => {
        const migrations = [...input.sources.migrations];
        migrations[0] = {
          ...migrations[0]!,
          bytes: changedByte(migrations[0]!.bytes),
        };
        input.sources = { ...input.sources, migrations };
      },
    ]) {
      const input = cloneInput();
      mutate(input);
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }
  });

  it("rejects reordered, duplicated, malformed, and mis-hashed manifest entries", () => {
    const changes: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        (value.migrations as unknown[]).reverse();
      },
      (value) => {
        const migrations = value.migrations as Array<Record<string, unknown>>;
        migrations[1] = { ...migrations[0]! };
      },
      (value) => {
        const migrations = value.migrations as Array<Record<string, unknown>>;
        migrations[0]!.file = "0002_wrong_prefix.sql";
      },
      (value) => {
        const migrations = value.migrations as Array<Record<string, unknown>>;
        migrations[0]!.sha256 = "A".repeat(64);
      },
    ];
    for (const change of changes) {
      const input = replaceCanonicalSourceJson(
        cloneInput(),
        "migrationManifest",
        change,
        true,
      );
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }
  });

  it("rejects noncanonical, duplicate-key, and extra-field manifests", () => {
    const text = decoder.decode(BASE_INPUT.sources.migrationManifest);
    for (const replacement of [
      bytes(` ${text}`),
      bytes(
        text.replace(
          '  "algorithm":',
          '  "algorithm": "sha512",\n  "algorithm":',
        ),
      ),
    ]) {
      let input = cloneInput();
      input.sources = { ...input.sources, migrationManifest: replacement };
      input = mutateEvidence(input, (record) => {
        (
          record.sourceHashes as Record<string, unknown>
        ).migrationManifestSha256 = sha256(replacement);
      });
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }

    const extra = replaceCanonicalSourceJson(
      cloneInput(),
      "migrationManifest",
      (value) => {
        value.secret = SECRET_CANARY;
      },
      true,
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extra),
    );
  });

  it("requires the exact v2 application manifest and source inventory", () => {
    const missing = cloneInput();
    missing.sources = {
      ...missing.sources,
      applicationMigrationsV2:
        missing.sources.applicationMigrationsV2!.slice(1),
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missing),
    );

    const extra = cloneInput();
    extra.sources = {
      ...extra.sources,
      applicationMigrationsV2: [
        ...extra.sources.applicationMigrationsV2!,
        {
          id: "v2-0007",
          file: "0007_unreviewed.sql",
          bytes: bytes("SELECT 1;\n"),
        },
      ],
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extra),
    );

    const reordered = cloneInput();
    reordered.sources = {
      ...reordered.sources,
      applicationMigrationsV2: [
        ...reordered.sources.applicationMigrationsV2!,
      ].reverse(),
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(reordered),
    );
  });

  it("rejects v2 application migration ID, filename, and byte mismatches", () => {
    for (const mutate of [
      (input: MutableInput) => {
        const migrations = [...input.sources.applicationMigrationsV2!];
        migrations[0] = { ...migrations[0]!, id: "v2-0002" };
        input.sources = {
          ...input.sources,
          applicationMigrationsV2: migrations,
        };
      },
      (input: MutableInput) => {
        const migrations = [...input.sources.applicationMigrationsV2!];
        migrations[0] = { ...migrations[0]!, file: "0001_wrong.sql" };
        input.sources = {
          ...input.sources,
          applicationMigrationsV2: migrations,
        };
      },
      (input: MutableInput) => {
        const migrations = [...input.sources.applicationMigrationsV2!];
        migrations[0] = {
          ...migrations[0]!,
          bytes: changedByte(migrations[0]!.bytes),
        };
        input.sources = {
          ...input.sources,
          applicationMigrationsV2: migrations,
        };
      },
    ]) {
      const input = cloneInput();
      mutate(input);
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }
  });

  it("rejects malformed, reordered, mis-hashed, and noncanonical v2 application manifests", () => {
    const changes: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        (value.migrations as unknown[]).reverse();
      },
      (value) => {
        const migrations = value.migrations as Array<Record<string, unknown>>;
        migrations[0]!.id = "v2-0002";
      },
      (value) => {
        const migrations = value.migrations as Array<Record<string, unknown>>;
        migrations[0]!.file = "0001_wrong.sql";
      },
      (value) => {
        const migrations = value.migrations as Array<Record<string, unknown>>;
        migrations[0]!.sha256 = "A".repeat(64);
      },
      (value) => {
        value.planVersion = 3;
      },
      (value) => {
        value.secret = SECRET_CANARY;
      },
    ];
    for (const change of changes) {
      const input = replaceCanonicalSourceJson(
        cloneInput(),
        "applicationMigrationManifestV2",
        change,
        true,
      );
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }

    const input = cloneInput();
    const replacement = bytes(
      ` ${decoder.decode(input.sources.applicationMigrationManifestV2)}`,
    );
    input.sources = {
      ...input.sources,
      applicationMigrationManifestV2: replacement,
    };
    const changed = mutateEvidence(input, (record) => {
      const hashes = record.sourceHashes as Record<string, unknown>;
      hashes.applicationMigrationManifestV2Sha256 = sha256(replacement);
    });
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(changed),
    );
  });

  it("validates every body named by the exact v1 privacy-retention plan manifest", () => {
    const changes: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        value.planVersion = 2;
      },
      (value) => {
        (value.platform as Record<string, unknown>).file = "wrong.sql";
      },
      (value) => {
        (value.platform as Record<string, unknown>).sha256 = "0".repeat(64);
      },
      (value) => {
        const migrations = value.migrations as Array<Record<string, unknown>>;
        migrations[0]!.id = "privacy-v1-0002";
      },
      (value) => {
        const migrations = value.migrations as Array<Record<string, unknown>>;
        migrations[0]!.file = "application/0001_wrong.sql";
      },
      (value) => {
        const migrations = value.migrations as Array<Record<string, unknown>>;
        migrations[0]!.sha256 = "0".repeat(64);
      },
      (value) => {
        (value.migrations as unknown[]).push(
          (value.migrations as unknown[])[0],
        );
      },
      (value) => {
        value.secret = SECRET_CANARY;
      },
    ];
    for (const change of changes) {
      const input = replaceCanonicalSourceJson(
        cloneInput(),
        "privacyRetentionPlanManifestV1",
        change,
        true,
      );
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }

    const noncanonical = cloneInput();
    const replacement = bytes(
      ` ${decoder.decode(noncanonical.sources.privacyRetentionPlanManifestV1)}`,
    );
    noncanonical.sources.privacyRetentionPlanManifestV1 = replacement;
    const changed = mutateEvidence(noncanonical, (record) => {
      const hashes = record.sourceHashes as Record<string, unknown>;
      hashes.privacyRetentionPlanManifestV1Sha256 = sha256(replacement);
    });
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(changed),
    );
  });

  it("rejects accessor-backed and symbol-decorated migration arrays", () => {
    const accessor = cloneInput();
    const migrations = [...accessor.sources.migrations];
    Object.defineProperty(migrations, "0", {
      enumerable: true,
      get() {
        throw new Error(SECRET_CANARY);
      },
    });
    accessor.sources = { ...accessor.sources, migrations };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(accessor),
    );

    const symbol = cloneInput();
    const decorated = [...symbol.sources.migrations] as Array<unknown> & {
      [key: symbol]: unknown;
    };
    decorated[Symbol("secret")] = SECRET_CANARY;
    symbol.sources = {
      ...symbol.sources,
      migrations: decorated as unknown as MutableInput["sources"]["migrations"],
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(symbol),
    );
  });
});

async function createValidInput(): Promise<VerifyPostgresAcceptanceEvidenceOfflineInput> {
  const [
    imageConfig,
    workflow,
    fixture,
    migrationManifest,
    acceptanceRunner,
    projectionQuery,
    projectionNormalizer,
    platformBootstrapV2,
    applicationMigrationManifestV2,
    authenticatedMigrationRendererV2,
    restorePlatformV1,
    authenticatedBackupRestorePlanV1,
    postgresProjectionAdapter,
    operationProjectionContract,
    databasePackageManifest,
    pnpmLockfile,
    postgresProjectionPool,
    postgresMigrationDeployer,
    postgresQueryPlanLoad,
    queryPlanLoadFixture,
    privacyRetentionPolicyV1,
    privacyRetentionPlanManifestV1,
    privacyRetentionPlanPlatformV1,
    privacyRetentionPolicySourceV1,
    privacyRetentionPlanSourceV1,
    resourceIdentifierTokenV1,
    privacyRetentionFixtureV1,
  ] = await Promise.all([
    readExact(new URL("../acceptance/postgres-image.json", import.meta.url)),
    readExact(
      new URL(
        "../../../.github/workflows/postgres-acceptance.yml",
        import.meta.url,
      ),
    ),
    readExact(new URL("../acceptance/synthetic-fixture.sql", import.meta.url)),
    readExact(new URL("../migration-manifest.json", import.meta.url)),
    readExact(new URL("../src/postgres-acceptance.ts", import.meta.url)),
    readExact(new URL("../src/postgres-projection-query.ts", import.meta.url)),
    readExact(new URL("../src/projection-normalization.ts", import.meta.url)),
    readExact(
      new URL("../migration-plans/v2/platform-bootstrap.sql", import.meta.url),
    ),
    readExact(
      new URL(
        "../migration-plans/v2/application-manifest.json",
        import.meta.url,
      ),
    ),
    readExact(
      new URL("../src/authenticated-migration-plan.ts", import.meta.url),
    ),
    readExact(
      new URL(
        "../backup-restore-plans/v1/restore-platform.sql",
        import.meta.url,
      ),
    ),
    readExact(
      new URL("../src/authenticated-backup-restore-plan.ts", import.meta.url),
    ),
    readExact(
      new URL("../src/postgres-projection-adapter.ts", import.meta.url),
    ),
    readExact(
      new URL(
        "../../../modules/research-core/src/projection-contract.ts",
        import.meta.url,
      ),
    ),
    readExact(new URL("../package.json", import.meta.url)),
    readExact(new URL("../../../pnpm-lock.yaml", import.meta.url)),
    readExact(new URL("../src/postgres-projection-pool.ts", import.meta.url)),
    readExact(
      new URL("../src/postgres-migration-deployer.ts", import.meta.url),
    ),
    readExact(new URL("../src/postgres-query-plan-load.ts", import.meta.url)),
    readExact(
      new URL("../acceptance/query-plan-load-fixture.sql", import.meta.url),
    ),
    readExact(
      new URL("../privacy-retention-plans/v1/policy.json", import.meta.url),
    ),
    readExact(
      new URL("../privacy-retention-plans/v1/manifest.json", import.meta.url),
    ),
    readExact(
      new URL(
        "../privacy-retention-plans/v1/platform-bootstrap.sql",
        import.meta.url,
      ),
    ),
    readExact(new URL("../src/privacy-retention-policy.ts", import.meta.url)),
    readExact(new URL("../src/privacy-retention-plan.ts", import.meta.url)),
    readExact(new URL("../src/resource-identifier-token.ts", import.meta.url)),
    readExact(
      new URL("../acceptance/privacy-retention-fixture.sql", import.meta.url),
    ),
  ]);
  const image = JSON.parse(decoder.decode(imageConfig)) as {
    reference: string;
    indexDigest: string;
  };
  const manifest = JSON.parse(decoder.decode(migrationManifest)) as {
    migrations: Array<{ id: string; file: string }>;
  };
  const migrationNames = (
    await readdir(new URL("../migrations/", import.meta.url))
  )
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  expect(migrationNames).toEqual(
    manifest.migrations.map((migration) => migration.file),
  );
  const migrations = await Promise.all(
    manifest.migrations.map(async (migration) => ({
      id: migration.id,
      file: migration.file,
      bytes: await readExact(
        new URL(`../migrations/${migration.file}`, import.meta.url),
      ),
    })),
  );
  const applicationManifestV2 = JSON.parse(
    decoder.decode(applicationMigrationManifestV2),
  ) as {
    migrations: Array<{ id: string; file: string }>;
  };
  const applicationMigrationNames = (
    await readdir(
      new URL("../migration-plans/v2/application/", import.meta.url),
    )
  )
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  expect(applicationMigrationNames).toEqual(
    applicationManifestV2.migrations.map((migration) => migration.file),
  );
  const applicationMigrationsV2 = await Promise.all(
    applicationManifestV2.migrations.map(async (migration) => ({
      id: migration.id,
      file: migration.file,
      bytes: await readExact(
        new URL(
          `../migration-plans/v2/application/${migration.file}`,
          import.meta.url,
        ),
      ),
    })),
  );
  const privacyRetentionManifestV1 = JSON.parse(
    decoder.decode(privacyRetentionPlanManifestV1),
  ) as {
    migrations: Array<{ id: string; file: string }>;
  };
  const privacyRetentionPlanMigrationsV1 = await Promise.all(
    privacyRetentionManifestV1.migrations.map(async (migration) => ({
      id: migration.id,
      file: migration.file,
      bytes: await readExact(
        new URL(
          `../privacy-retention-plans/v1/${migration.file}`,
          import.meta.url,
        ),
      ),
    })),
  );

  const repository = "example/research-cockpit";
  const repositoryId = "123456789";
  const commitSha = "b".repeat(40);
  const runId = "9876543210";
  const runAttempt = 2;
  const evidence = buildPostgresAcceptanceEvidence({
    githubEnvironment: {
      CI: "true",
      GITHUB_ACTIONS: "true",
      GITHUB_JOB: "postgres-acceptance",
      GITHUB_WORKFLOW: "PostgreSQL acceptance",
      GITHUB_REPOSITORY: repository,
      GITHUB_REPOSITORY_ID: repositoryId,
      GITHUB_SHA: commitSha,
      GITHUB_RUN_ID: runId,
      GITHUB_RUN_ATTEMPT: String(runAttempt),
      SECRET: SECRET_CANARY,
    },
    reviewedImageReference: image.reference,
    reviewedImageIndexDigest: image.indexDigest,
    toolVersions: {
      postgres: "postgres (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      psql: "psql (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      pgDump: "pg_dump (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      pgRestore: "pg_restore (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      nodePostgres: "8.23.0",
      nodePostgresPool: "3.14.0",
    },
    sourceHashes: {
      workflowSha256: sha256(workflow),
      fixtureSha256: sha256(fixture),
      migrationManifestSha256: sha256(migrationManifest),
      acceptanceRunnerSha256: sha256(acceptanceRunner),
      projectionQuerySha256: sha256(projectionQuery),
      projectionNormalizerSha256: sha256(projectionNormalizer),
      platformBootstrapV2Sha256: sha256(platformBootstrapV2),
      applicationMigrationManifestV2Sha256: sha256(
        applicationMigrationManifestV2,
      ),
      authenticatedMigrationRendererV2Sha256: sha256(
        authenticatedMigrationRendererV2,
      ),
      restorePlatformV1Sha256: sha256(restorePlatformV1),
      authenticatedBackupRestorePlanV1Sha256: sha256(
        authenticatedBackupRestorePlanV1,
      ),
      postgresProjectionAdapterSha256: sha256(postgresProjectionAdapter),
      operationProjectionContractSha256: sha256(operationProjectionContract),
      databasePackageManifestSha256: sha256(databasePackageManifest),
      pnpmLockfileSha256: sha256(pnpmLockfile),
      postgresProjectionPoolSha256: sha256(postgresProjectionPool),
      postgresMigrationDeployerSha256: sha256(postgresMigrationDeployer),
      postgresQueryPlanLoadSha256: sha256(postgresQueryPlanLoad),
      queryPlanLoadFixtureSha256: sha256(queryPlanLoadFixture),
      privacyRetentionPolicyV1Sha256: sha256(privacyRetentionPolicyV1),
      privacyRetentionPlanManifestV1Sha256: sha256(
        privacyRetentionPlanManifestV1,
      ),
      privacyRetentionPolicySourceV1Sha256: sha256(
        privacyRetentionPolicySourceV1,
      ),
      privacyRetentionPlanSourceV1Sha256: sha256(privacyRetentionPlanSourceV1),
      resourceIdentifierTokenV1Sha256: sha256(resourceIdentifierTokenV1),
      privacyRetentionFixtureV1Sha256: sha256(privacyRetentionFixtureV1),
    },
    completedAt: "2026-08-16T02:03:04.567Z",
  });
  const evidenceBytes = bytes(serializePostgresAcceptanceEvidence(evidence));
  return {
    evidenceBytes,
    trustAnchors: {
      evidenceSha256: sha256(evidenceBytes),
      repository,
      repositoryId,
      commitSha,
      runId,
      runAttempt,
    },
    sources: {
      imageConfig,
      workflow,
      fixture,
      migrationManifest,
      acceptanceRunner,
      projectionQuery,
      projectionNormalizer,
      platformBootstrapV2,
      applicationMigrationManifestV2,
      authenticatedMigrationRendererV2,
      restorePlatformV1,
      authenticatedBackupRestorePlanV1,
      postgresProjectionAdapter,
      operationProjectionContract,
      databasePackageManifest,
      pnpmLockfile,
      postgresProjectionPool,
      postgresMigrationDeployer,
      postgresQueryPlanLoad,
      queryPlanLoadFixture,
      privacyRetentionPolicyV1,
      privacyRetentionPlanManifestV1,
      privacyRetentionPlanPlatformV1,
      privacyRetentionPlanMigrationsV1,
      privacyRetentionPolicySourceV1,
      privacyRetentionPlanSourceV1,
      resourceIdentifierTokenV1,
      privacyRetentionFixtureV1,
      applicationMigrationsV2,
      migrations,
    },
  };
}

async function readExact(url: URL): Promise<Uint8Array> {
  return new Uint8Array(await readFile(url));
}
