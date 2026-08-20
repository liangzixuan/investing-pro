import { createHash } from "node:crypto";

import {
  parsePostgresAcceptanceEvidence,
  serializePostgresAcceptanceEvidence,
  type PostgresAcceptanceEvidence,
} from "./postgres-acceptance-evidence";

export const POSTGRES_ACCEPTANCE_OFFLINE_VERIFICATION_CHECKS = Object.freeze([
  "canonical_record_bytes",
  "external_record_sha256",
  "metadata_anchor_match",
  "reviewed_target_at_commit",
  "recorded_source_hashes_at_commit",
  "migration_manifest_at_commit",
] as const);

export const POSTGRES_ACCEPTANCE_OFFLINE_VERIFIER_NOT_PROVEN = Object.freeze([
  "github_run_or_artifact_authenticity",
  "workflow_logs_or_database_execution",
  "commit_signature_or_branch_reachability",
  "trust_anchor_provenance",
] as const);

const INPUT_KEYS = ["evidenceBytes", "trustAnchors", "sources"] as const;
const TRUST_ANCHOR_KEYS = [
  "evidenceSha256",
  "repository",
  "repositoryId",
  "commitSha",
  "runId",
  "runAttempt",
] as const;
const HISTORICAL_SOURCE_KEYS = [
  "imageConfig",
  "workflow",
  "fixture",
  "migrationManifest",
  "acceptanceRunner",
  "migrations",
] as const;
const PROJECTION_SOURCE_KEYS = [
  ...HISTORICAL_SOURCE_KEYS,
  "projectionQuery",
  "projectionNormalizer",
] as const;
const V7_SOURCE_KEYS = [
  ...PROJECTION_SOURCE_KEYS,
  "platformBootstrapV2",
  "applicationMigrationManifestV2",
  "authenticatedMigrationRendererV2",
  "applicationMigrationsV2",
] as const;
const V8_SOURCE_KEYS = [
  ...V7_SOURCE_KEYS,
  "restorePlatformV1",
  "authenticatedBackupRestorePlanV1",
] as const;
const V9_SOURCE_KEYS = [
  ...V8_SOURCE_KEYS,
  "postgresProjectionAdapter",
  "operationProjectionContract",
  "databasePackageManifest",
  "pnpmLockfile",
] as const;
const V10_SOURCE_KEYS = [...V9_SOURCE_KEYS, "postgresProjectionPool"] as const;
const V11_SOURCE_KEYS = [
  ...V10_SOURCE_KEYS,
  "postgresMigrationDeployer",
] as const;
const V12_SOURCE_KEYS = [
  ...V11_SOURCE_KEYS,
  "postgresQueryPlanLoad",
  "queryPlanLoadFixture",
] as const;
const V13_SOURCE_KEYS = [
  ...V12_SOURCE_KEYS,
  "privacyRetentionPolicyV1",
  "privacyRetentionPlanManifestV1",
  "privacyRetentionPlanPlatformV1",
  "privacyRetentionPlanMigrationsV1",
  "privacyRetentionPolicySourceV1",
  "privacyRetentionPlanSourceV1",
  "resourceIdentifierTokenV1",
  "privacyRetentionFixtureV1",
] as const;
const V14_SOURCE_KEYS = [
  ...V13_SOURCE_KEYS,
  "populatedCutoverPlanManifestV1",
  "populatedCutoverPlanPlatformV1",
  "populatedCutoverPlanMigrationsV1",
  "populatedCutoverPlanSourceV1",
  "populatedCutoverFixtureV1",
] as const;
const MIGRATION_SOURCE_KEYS = ["id", "file", "bytes"] as const;
const IMAGE_CONFIG_KEYS = [
  "schemaVersion",
  "repository",
  "tag",
  "indexDigest",
  "reference",
  "mediaType",
  "expectedServerVersion",
  "expectedServerVersionNumber",
  "databaseName",
  "workflowSha256",
  "fixtureSha256",
  "verifiedOn",
  "runner",
] as const;
const V12_IMAGE_CONFIG_KEYS = [
  ...IMAGE_CONFIG_KEYS,
  "queryPlanLoadFixtureSha256",
] as const;
const V13_IMAGE_CONFIG_KEYS = [
  ...V12_IMAGE_CONFIG_KEYS,
  "privacyRetentionFixtureSha256",
] as const;
const V14_IMAGE_CONFIG_KEYS = [
  ...V13_IMAGE_CONFIG_KEYS,
  "populatedCutoverFixtureSha256",
] as const;
const IMAGE_RUNNER_KEYS = ["label", "os", "architecture"] as const;
const MANIFEST_KEYS = ["schemaVersion", "algorithm", "migrations"] as const;
const MANIFEST_ENTRY_KEYS = ["id", "file", "sha256"] as const;
const APPLICATION_MANIFEST_V2_KEYS = [
  "schemaVersion",
  "planVersion",
  "algorithm",
  "migrations",
] as const;
const PRIVACY_RETENTION_PLAN_MANIFEST_V1_KEYS = [
  "schemaVersion",
  "planVersion",
  "algorithm",
  "platform",
  "migrations",
] as const;
const PRIVACY_RETENTION_PLAN_PLATFORM_V1_KEYS = ["file", "sha256"] as const;
const POPULATED_CUTOVER_PLAN_MANIFEST_V1_KEYS = [
  "schemaVersion",
  "planVersion",
  "algorithm",
  "platform",
  "base",
  "target",
  "migrations",
] as const;
const POPULATED_CUTOVER_PLAN_PLATFORM_V1_KEYS = ["file", "sha256"] as const;
const POPULATED_CUTOVER_PLAN_BASE_V1_KEYS = [
  "planVersion",
  "manifestFile",
  "manifestSha256",
  "selectedMigrations",
  "excludedMigration",
] as const;
const POPULATED_CUTOVER_PLAN_TARGET_V1_KEYS = [
  "privacyPlanVersion",
  "manifestFile",
  "manifestSha256",
  "policyFile",
  "policySha256",
  "applicationFile",
  "applicationSha256",
] as const;
const POPULATED_CUTOVER_PLAN_EXCLUDED_MIGRATION_V1_KEYS = [
  "id",
  "file",
  "sha256",
  "reason",
] as const;
const POPULATED_CUTOVER_PLAN_MIGRATION_V1_KEYS = [
  "id",
  "phase",
  "file",
  "sha256",
] as const;
const PRIVACY_RETENTION_PLAN_PLATFORM_V1_FILE = "platform-bootstrap.sql";
const PRIVACY_RETENTION_PLAN_MIGRATION_V1_ID = "privacy-v1-0001";
const PRIVACY_RETENTION_PLAN_MIGRATION_V1_FILE =
  "application/0001_keyed_resource_identifier_lifecycle.sql";
const POPULATED_CUTOVER_PLAN_PLATFORM_V1_FILE = "platform-bootstrap.sql";
const POPULATED_CUTOVER_PLAN_MIGRATIONS_V1 = Object.freeze([
  Object.freeze({
    id: "populated-cutover-v1-0001",
    phase: "expand_capture_backfill",
    file: "application/0001_expand_capture_and_backfill.sql",
  }),
  Object.freeze({
    id: "populated-cutover-v1-0002",
    phase: "validate_contract",
    file: "application/0002_validate_and_contract.sql",
  }),
] as const);
const POPULATED_CUTOVER_BASE_SELECTED_MIGRATION_IDS_V1 = Object.freeze([
  "v2-0001",
  "v2-0002",
  "v2-0003",
  "v2-0004",
  "v2-0006",
] as const);
const APPLICATION_MIGRATION_V2_FILES = Object.freeze([
  "0001_request_context_and_ledger.sql",
  "0002_canonical_entities.sql",
  "0003_temporal_constraints_and_indexes.sql",
  "0004_row_security_and_runtime_grants.sql",
  "0005_non_reusable_resource_ids.sql",
  "0006_null_safe_request_context.sql",
] as const);

const MAX_EVIDENCE_BYTES = 32 * 1024;
const MAX_IMAGE_CONFIG_BYTES = 32 * 1024;
const MAX_WORKFLOW_BYTES = 128 * 1024;
const MAX_FIXTURE_BYTES = 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_RUNNER_BYTES = 2 * 1024 * 1024;
const MAX_PROJECTION_QUERY_BYTES = 2 * 1024 * 1024;
const MAX_PROJECTION_NORMALIZER_BYTES = 2 * 1024 * 1024;
const MAX_PLATFORM_BOOTSTRAP_V2_BYTES = 2 * 1024 * 1024;
const MAX_APPLICATION_MANIFEST_V2_BYTES = 64 * 1024;
const MAX_AUTHENTICATED_MIGRATION_RENDERER_V2_BYTES = 2 * 1024 * 1024;
const MAX_RESTORE_PLATFORM_V1_BYTES = 2 * 1024 * 1024;
const MAX_AUTHENTICATED_BACKUP_RESTORE_PLAN_V1_BYTES = 2 * 1024 * 1024;
const MAX_POSTGRES_PROJECTION_ADAPTER_BYTES = 2 * 1024 * 1024;
const MAX_OPERATION_PROJECTION_CONTRACT_BYTES = 2 * 1024 * 1024;
const MAX_DATABASE_PACKAGE_MANIFEST_BYTES = 64 * 1024;
const MAX_PNPM_LOCKFILE_BYTES = 512 * 1024;
const MAX_POSTGRES_PROJECTION_POOL_BYTES = 2 * 1024 * 1024;
const MAX_POSTGRES_MIGRATION_DEPLOYER_BYTES = 2 * 1024 * 1024;
const MAX_POSTGRES_QUERY_PLAN_LOAD_BYTES = 2 * 1024 * 1024;
const MAX_QUERY_PLAN_LOAD_FIXTURE_BYTES = 2 * 1024 * 1024;
const MAX_PRIVACY_RETENTION_POLICY_V1_BYTES = 64 * 1024;
const MAX_PRIVACY_RETENTION_PLAN_MANIFEST_V1_BYTES = 64 * 1024;
const MAX_PRIVACY_RETENTION_PLAN_PLATFORM_V1_BYTES = 2 * 1024 * 1024;
const MAX_PRIVACY_RETENTION_POLICY_SOURCE_V1_BYTES = 2 * 1024 * 1024;
const MAX_PRIVACY_RETENTION_PLAN_SOURCE_V1_BYTES = 2 * 1024 * 1024;
const MAX_RESOURCE_IDENTIFIER_TOKEN_V1_BYTES = 2 * 1024 * 1024;
const MAX_PRIVACY_RETENTION_FIXTURE_V1_BYTES = 2 * 1024 * 1024;
const MAX_POPULATED_CUTOVER_PLAN_MANIFEST_V1_BYTES = 64 * 1024;
const MAX_POPULATED_CUTOVER_PLAN_PLATFORM_V1_BYTES = 2 * 1024 * 1024;
const MAX_POPULATED_CUTOVER_PLAN_SOURCE_V1_BYTES = 2 * 1024 * 1024;
const MAX_POPULATED_CUTOVER_FIXTURE_V1_BYTES = 2 * 1024 * 1024;
const MAX_MIGRATION_BYTES = 2 * 1024 * 1024;
const MAX_MIGRATIONS = 100;

const SHA256_HEX = /^[0-9a-f]{64}$/;
const SHA1_HEX = /^[0-9a-f]{40}$/;
const POSITIVE_DECIMAL = /^[1-9][0-9]*$/;
const REPOSITORY =
  /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9_.-]{1,100}$/;
const MIGRATION_ID = /^\d{4}$/;
const APPLICATION_MIGRATION_V2_ID = /^v2-\d{4}$/;
const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;

type DataRecord = Readonly<Record<string, unknown>>;

export interface PostgresAcceptanceEvidenceTrustAnchors {
  readonly evidenceSha256: string;
  readonly repository: string;
  readonly repositoryId: string;
  readonly commitSha: string;
  readonly runId: string;
  readonly runAttempt: number;
}

export interface PostgresAcceptanceMigrationSource {
  readonly id: string;
  readonly file: string;
  readonly bytes: Uint8Array;
}

export interface PostgresAcceptanceEvidenceSourceBundle {
  readonly imageConfig: Uint8Array;
  readonly workflow: Uint8Array;
  readonly fixture: Uint8Array;
  readonly migrationManifest: Uint8Array;
  readonly acceptanceRunner: Uint8Array;
  readonly migrations: readonly PostgresAcceptanceMigrationSource[];
  readonly projectionQuery?: Uint8Array;
  readonly projectionNormalizer?: Uint8Array;
  readonly platformBootstrapV2?: Uint8Array;
  readonly applicationMigrationManifestV2?: Uint8Array;
  readonly authenticatedMigrationRendererV2?: Uint8Array;
  readonly applicationMigrationsV2?: readonly PostgresAcceptanceMigrationSource[];
  readonly restorePlatformV1?: Uint8Array;
  readonly authenticatedBackupRestorePlanV1?: Uint8Array;
  readonly postgresProjectionAdapter?: Uint8Array;
  readonly operationProjectionContract?: Uint8Array;
  readonly databasePackageManifest?: Uint8Array;
  readonly pnpmLockfile?: Uint8Array;
  readonly postgresProjectionPool?: Uint8Array;
  readonly postgresMigrationDeployer?: Uint8Array;
  readonly postgresQueryPlanLoad?: Uint8Array;
  readonly queryPlanLoadFixture?: Uint8Array;
  readonly privacyRetentionPolicyV1?: Uint8Array;
  readonly privacyRetentionPlanManifestV1?: Uint8Array;
  readonly privacyRetentionPlanPlatformV1?: Uint8Array;
  readonly privacyRetentionPlanMigrationsV1?: readonly PostgresAcceptanceMigrationSource[];
  readonly privacyRetentionPolicySourceV1?: Uint8Array;
  readonly privacyRetentionPlanSourceV1?: Uint8Array;
  readonly resourceIdentifierTokenV1?: Uint8Array;
  readonly privacyRetentionFixtureV1?: Uint8Array;
  readonly populatedCutoverPlanManifestV1?: Uint8Array;
  readonly populatedCutoverPlanPlatformV1?: Uint8Array;
  readonly populatedCutoverPlanMigrationsV1?: readonly PostgresAcceptanceMigrationSource[];
  readonly populatedCutoverPlanSourceV1?: Uint8Array;
  readonly populatedCutoverFixtureV1?: Uint8Array;
}

export interface VerifyPostgresAcceptanceEvidenceOfflineInput {
  readonly evidenceBytes: Uint8Array;
  readonly trustAnchors: PostgresAcceptanceEvidenceTrustAnchors;
  readonly sources: PostgresAcceptanceEvidenceSourceBundle;
}

export interface VerifiedPostgresAcceptanceEvidence {
  readonly schemaVersion: 1;
  readonly verdict: "offline_consistent";
  readonly evidenceSha256: string;
  readonly repository: string;
  readonly repositoryId: string;
  readonly commitSha: string;
  readonly runId: string;
  readonly runAttempt: number;
  readonly completedAt: string;
  readonly verificationChecks: typeof POSTGRES_ACCEPTANCE_OFFLINE_VERIFICATION_CHECKS;
  readonly recordedChecksPassed: PostgresAcceptanceEvidence["checksPassed"];
  readonly recordedNotProven: PostgresAcceptanceEvidence["notProven"];
  readonly verifierNotProven: typeof POSTGRES_ACCEPTANCE_OFFLINE_VERIFIER_NOT_PROVEN;
}

interface NormalizedSources {
  readonly imageConfig: Uint8Array;
  readonly workflow: Uint8Array;
  readonly fixture: Uint8Array;
  readonly migrationManifest: Uint8Array;
  readonly acceptanceRunner: Uint8Array;
  readonly migrations: readonly NormalizedMigrationSource[];
  readonly projectionQuery?: Uint8Array;
  readonly projectionNormalizer?: Uint8Array;
  readonly platformBootstrapV2?: Uint8Array;
  readonly applicationMigrationManifestV2?: Uint8Array;
  readonly authenticatedMigrationRendererV2?: Uint8Array;
  readonly applicationMigrationsV2?: readonly NormalizedMigrationSource[];
  readonly restorePlatformV1?: Uint8Array;
  readonly authenticatedBackupRestorePlanV1?: Uint8Array;
  readonly postgresProjectionAdapter?: Uint8Array;
  readonly operationProjectionContract?: Uint8Array;
  readonly databasePackageManifest?: Uint8Array;
  readonly pnpmLockfile?: Uint8Array;
  readonly postgresProjectionPool?: Uint8Array;
  readonly postgresMigrationDeployer?: Uint8Array;
  readonly postgresQueryPlanLoad?: Uint8Array;
  readonly queryPlanLoadFixture?: Uint8Array;
  readonly privacyRetentionPolicyV1?: Uint8Array;
  readonly privacyRetentionPlanManifestV1?: Uint8Array;
  readonly privacyRetentionPlanPlatformV1?: Uint8Array;
  readonly privacyRetentionPlanMigrationsV1?: readonly NormalizedMigrationSource[];
  readonly privacyRetentionPolicySourceV1?: Uint8Array;
  readonly privacyRetentionPlanSourceV1?: Uint8Array;
  readonly resourceIdentifierTokenV1?: Uint8Array;
  readonly privacyRetentionFixtureV1?: Uint8Array;
  readonly populatedCutoverPlanManifestV1?: Uint8Array;
  readonly populatedCutoverPlanPlatformV1?: Uint8Array;
  readonly populatedCutoverPlanMigrationsV1?: readonly NormalizedMigrationSource[];
  readonly populatedCutoverPlanSourceV1?: Uint8Array;
  readonly populatedCutoverFixtureV1?: Uint8Array;
}

interface NormalizedMigrationSource {
  readonly id: string;
  readonly file: string;
  readonly bytes: Uint8Array;
}

interface ReviewedImageConfig {
  readonly indexDigest: string;
  readonly reference: string;
  readonly expectedServerVersion: string;
  readonly expectedServerVersionNumber: number;
  readonly databaseName: string;
  readonly workflowSha256: string;
  readonly fixtureSha256: string;
  readonly queryPlanLoadFixtureSha256: string | undefined;
  readonly privacyRetentionFixtureSha256: string | undefined;
  readonly populatedCutoverFixtureSha256: string | undefined;
}

/** A stable, value-free failure for every rejected offline verification. */
export class PostgresAcceptanceEvidenceVerificationError extends Error {
  public readonly code =
    "INVALID_POSTGRES_ACCEPTANCE_EVIDENCE_VERIFICATION" as const;

  public constructor() {
    super("PostgreSQL acceptance evidence offline verification failed.");
    this.name = "PostgresAcceptanceEvidenceVerificationError";
  }
}

/**
 * Verifies canonical evidence bytes against independent metadata anchors and
 * an exact raw source bundle supplied by a commit-aware adapter. This function
 * performs no I/O and does not establish that GitHub or PostgreSQL executed.
 */
export function verifyPostgresAcceptanceEvidenceOffline(
  value: VerifyPostgresAcceptanceEvidenceOfflineInput,
): VerifiedPostgresAcceptanceEvidence {
  try {
    const input = exactPlainDataRecord(value, INPUT_KEYS);
    const evidenceBytes = exactBytes(input.evidenceBytes, MAX_EVIDENCE_BYTES);
    const anchors = normalizeTrustAnchors(input.trustAnchors);
    const evidenceSha256 = sha256(evidenceBytes);
    if (evidenceSha256 !== anchors.evidenceSha256) invalid();

    const evidenceText = decodeUtf8(evidenceBytes);
    const evidence = parsePostgresAcceptanceEvidence(evidenceText);
    const canonicalBytes = new TextEncoder().encode(
      serializePostgresAcceptanceEvidence(evidence),
    );
    if (!sameBytes(evidenceBytes, canonicalBytes)) invalid();

    if (
      evidence.repository !== anchors.repository ||
      evidence.repositoryId !== anchors.repositoryId ||
      evidence.commitSha !== anchors.commitSha ||
      evidence.runId !== anchors.runId ||
      evidence.runAttempt !== anchors.runAttempt
    ) {
      invalid();
    }

    const sources = normalizeSources(input.sources, evidence.schemaVersion);

    const imageConfig = parseReviewedImageConfig(
      sources.imageConfig,
      evidence.schemaVersion,
    );
    if (
      evidence.reviewedImageReference !== imageConfig.reference ||
      evidence.reviewedImageIndexDigest !== imageConfig.indexDigest ||
      evidence.databaseName !== imageConfig.databaseName ||
      evidence.serverVersion !== imageConfig.expectedServerVersion ||
      evidence.serverVersionNumber !==
        String(imageConfig.expectedServerVersionNumber)
    ) {
      invalid();
    }

    if (
      evidence.schemaVersion === 4 ||
      evidence.schemaVersion === 5 ||
      evidence.schemaVersion === 6 ||
      evidence.schemaVersion === 7 ||
      evidence.schemaVersion === 8 ||
      evidence.schemaVersion === 9 ||
      evidence.schemaVersion === 10 ||
      evidence.schemaVersion === 11 ||
      evidence.schemaVersion === 12 ||
      evidence.schemaVersion === 13 ||
      evidence.schemaVersion === 14
    ) {
      if (
        sources.projectionQuery === undefined ||
        sources.projectionNormalizer === undefined ||
        evidence.sourceHashes.projectionQuerySha256 !==
          sha256(sources.projectionQuery) ||
        evidence.sourceHashes.projectionNormalizerSha256 !==
          sha256(sources.projectionNormalizer)
      ) {
        invalid();
      }
    }

    if (
      evidence.schemaVersion === 7 ||
      evidence.schemaVersion === 8 ||
      evidence.schemaVersion === 9 ||
      evidence.schemaVersion === 10 ||
      evidence.schemaVersion === 11 ||
      evidence.schemaVersion === 12 ||
      evidence.schemaVersion === 13 ||
      evidence.schemaVersion === 14
    ) {
      if (
        sources.platformBootstrapV2 === undefined ||
        sources.applicationMigrationManifestV2 === undefined ||
        sources.authenticatedMigrationRendererV2 === undefined ||
        sources.applicationMigrationsV2 === undefined ||
        evidence.sourceHashes.platformBootstrapV2Sha256 !==
          sha256(sources.platformBootstrapV2) ||
        evidence.sourceHashes.applicationMigrationManifestV2Sha256 !==
          sha256(sources.applicationMigrationManifestV2) ||
        evidence.sourceHashes.authenticatedMigrationRendererV2Sha256 !==
          sha256(sources.authenticatedMigrationRendererV2)
      ) {
        invalid();
      }
      verifyApplicationMigrationManifestV2(
        sources.applicationMigrationManifestV2,
        sources.applicationMigrationsV2,
      );
    }

    if (
      evidence.schemaVersion === 8 ||
      evidence.schemaVersion === 9 ||
      evidence.schemaVersion === 10 ||
      evidence.schemaVersion === 11 ||
      evidence.schemaVersion === 12 ||
      evidence.schemaVersion === 13 ||
      evidence.schemaVersion === 14
    ) {
      if (
        sources.restorePlatformV1 === undefined ||
        sources.authenticatedBackupRestorePlanV1 === undefined ||
        evidence.sourceHashes.restorePlatformV1Sha256 !==
          sha256(sources.restorePlatformV1) ||
        evidence.sourceHashes.authenticatedBackupRestorePlanV1Sha256 !==
          sha256(sources.authenticatedBackupRestorePlanV1)
      ) {
        invalid();
      }
    }

    if (
      evidence.schemaVersion === 9 ||
      evidence.schemaVersion === 10 ||
      evidence.schemaVersion === 11 ||
      evidence.schemaVersion === 12 ||
      evidence.schemaVersion === 13 ||
      evidence.schemaVersion === 14
    ) {
      if (
        sources.postgresProjectionAdapter === undefined ||
        sources.operationProjectionContract === undefined ||
        sources.databasePackageManifest === undefined ||
        sources.pnpmLockfile === undefined ||
        evidence.sourceHashes.postgresProjectionAdapterSha256 !==
          sha256(sources.postgresProjectionAdapter) ||
        evidence.sourceHashes.operationProjectionContractSha256 !==
          sha256(sources.operationProjectionContract) ||
        evidence.sourceHashes.databasePackageManifestSha256 !==
          sha256(sources.databasePackageManifest) ||
        evidence.sourceHashes.pnpmLockfileSha256 !==
          sha256(sources.pnpmLockfile)
      ) {
        invalid();
      }
    }

    if (
      evidence.schemaVersion === 10 ||
      evidence.schemaVersion === 11 ||
      evidence.schemaVersion === 12 ||
      evidence.schemaVersion === 13 ||
      evidence.schemaVersion === 14
    ) {
      if (
        sources.postgresProjectionPool === undefined ||
        evidence.sourceHashes.postgresProjectionPoolSha256 !==
          sha256(sources.postgresProjectionPool)
      ) {
        invalid();
      }
    }

    if (
      evidence.schemaVersion === 11 ||
      evidence.schemaVersion === 12 ||
      evidence.schemaVersion === 13 ||
      evidence.schemaVersion === 14
    ) {
      if (
        sources.postgresMigrationDeployer === undefined ||
        evidence.sourceHashes.postgresMigrationDeployerSha256 !==
          sha256(sources.postgresMigrationDeployer)
      ) {
        invalid();
      }
    }

    if (
      evidence.schemaVersion === 12 ||
      evidence.schemaVersion === 13 ||
      evidence.schemaVersion === 14
    ) {
      if (
        sources.postgresQueryPlanLoad === undefined ||
        sources.queryPlanLoadFixture === undefined ||
        evidence.sourceHashes.postgresQueryPlanLoadSha256 !==
          sha256(sources.postgresQueryPlanLoad) ||
        evidence.sourceHashes.queryPlanLoadFixtureSha256 !==
          sha256(sources.queryPlanLoadFixture) ||
        imageConfig.queryPlanLoadFixtureSha256 !==
          evidence.sourceHashes.queryPlanLoadFixtureSha256
      ) {
        invalid();
      }
    }

    if (evidence.schemaVersion === 13 || evidence.schemaVersion === 14) {
      if (
        sources.privacyRetentionPolicyV1 === undefined ||
        sources.privacyRetentionPlanManifestV1 === undefined ||
        sources.privacyRetentionPlanPlatformV1 === undefined ||
        sources.privacyRetentionPlanMigrationsV1 === undefined ||
        sources.privacyRetentionPolicySourceV1 === undefined ||
        sources.privacyRetentionPlanSourceV1 === undefined ||
        sources.resourceIdentifierTokenV1 === undefined ||
        sources.privacyRetentionFixtureV1 === undefined ||
        evidence.sourceHashes.privacyRetentionPolicyV1Sha256 !==
          sha256(sources.privacyRetentionPolicyV1) ||
        evidence.sourceHashes.privacyRetentionPlanManifestV1Sha256 !==
          sha256(sources.privacyRetentionPlanManifestV1) ||
        evidence.sourceHashes.privacyRetentionPolicySourceV1Sha256 !==
          sha256(sources.privacyRetentionPolicySourceV1) ||
        evidence.sourceHashes.privacyRetentionPlanSourceV1Sha256 !==
          sha256(sources.privacyRetentionPlanSourceV1) ||
        evidence.sourceHashes.resourceIdentifierTokenV1Sha256 !==
          sha256(sources.resourceIdentifierTokenV1) ||
        evidence.sourceHashes.privacyRetentionFixtureV1Sha256 !==
          sha256(sources.privacyRetentionFixtureV1) ||
        imageConfig.privacyRetentionFixtureSha256 !==
          evidence.sourceHashes.privacyRetentionFixtureV1Sha256
      ) {
        invalid();
      }
      verifyPrivacyRetentionPlanManifestV1(
        sources.privacyRetentionPlanManifestV1,
        sources.privacyRetentionPlanPlatformV1,
        sources.privacyRetentionPlanMigrationsV1,
      );
    }

    if (evidence.schemaVersion === 14) {
      if (
        sources.populatedCutoverPlanManifestV1 === undefined ||
        sources.populatedCutoverPlanPlatformV1 === undefined ||
        sources.populatedCutoverPlanMigrationsV1 === undefined ||
        sources.populatedCutoverPlanSourceV1 === undefined ||
        sources.populatedCutoverFixtureV1 === undefined ||
        sources.applicationMigrationManifestV2 === undefined ||
        sources.privacyRetentionPolicyV1 === undefined ||
        sources.privacyRetentionPlanManifestV1 === undefined ||
        evidence.sourceHashes.populatedCutoverPlanManifestV1Sha256 !==
          sha256(sources.populatedCutoverPlanManifestV1) ||
        evidence.sourceHashes.populatedCutoverPlanSourceV1Sha256 !==
          sha256(sources.populatedCutoverPlanSourceV1) ||
        evidence.sourceHashes.populatedCutoverFixtureV1Sha256 !==
          sha256(sources.populatedCutoverFixtureV1) ||
        imageConfig.populatedCutoverFixtureSha256 !==
          evidence.sourceHashes.populatedCutoverFixtureV1Sha256
      ) {
        invalid();
      }
      verifyPopulatedCutoverPlanManifestV1(
        sources.populatedCutoverPlanManifestV1,
        sources.populatedCutoverPlanPlatformV1,
        sources.populatedCutoverPlanMigrationsV1,
        sources.applicationMigrationManifestV2,
        sources.privacyRetentionPolicyV1,
        sources.privacyRetentionPlanManifestV1,
      );
    }

    const workflowSha256 = sha256(sources.workflow);
    const fixtureSha256 = sha256(sources.fixture);
    const migrationManifestSha256 = sha256(sources.migrationManifest);
    const acceptanceRunnerSha256 = sha256(sources.acceptanceRunner);
    if (
      evidence.sourceHashes.workflowSha256 !== workflowSha256 ||
      evidence.sourceHashes.fixtureSha256 !== fixtureSha256 ||
      evidence.sourceHashes.migrationManifestSha256 !==
        migrationManifestSha256 ||
      evidence.sourceHashes.acceptanceRunnerSha256 !== acceptanceRunnerSha256 ||
      imageConfig.workflowSha256 !== workflowSha256 ||
      imageConfig.fixtureSha256 !== fixtureSha256
    ) {
      invalid();
    }

    verifyMigrationManifest(sources.migrationManifest, sources.migrations);

    return Object.freeze({
      schemaVersion: 1,
      verdict: "offline_consistent",
      evidenceSha256,
      repository: evidence.repository,
      repositoryId: evidence.repositoryId,
      commitSha: evidence.commitSha,
      runId: evidence.runId,
      runAttempt: evidence.runAttempt,
      completedAt: evidence.completedAt,
      verificationChecks: POSTGRES_ACCEPTANCE_OFFLINE_VERIFICATION_CHECKS,
      recordedChecksPassed: evidence.checksPassed,
      recordedNotProven: evidence.notProven,
      verifierNotProven: POSTGRES_ACCEPTANCE_OFFLINE_VERIFIER_NOT_PROVEN,
    });
  } catch {
    throw new PostgresAcceptanceEvidenceVerificationError();
  }
}

function normalizeTrustAnchors(
  value: unknown,
): PostgresAcceptanceEvidenceTrustAnchors {
  const anchors = exactPlainDataRecord(value, TRUST_ANCHOR_KEYS);
  return Object.freeze({
    evidenceSha256: sha256Hex(anchors.evidenceSha256),
    repository: githubRepository(anchors.repository),
    repositoryId: positiveDecimalString(anchors.repositoryId),
    commitSha: sha1Hex(anchors.commitSha),
    runId: positiveDecimalString(anchors.runId),
    runAttempt: positiveSafeInteger(anchors.runAttempt),
  });
}

function normalizeSources(
  value: unknown,
  schemaVersion: PostgresAcceptanceEvidence["schemaVersion"],
): NormalizedSources {
  if (schemaVersion === 14) {
    const sources = exactPlainDataRecord(value, V14_SOURCE_KEYS);
    return normalizeSourceFields(
      sources,
      {
        projectionQuery: exactBytes(
          sources.projectionQuery,
          MAX_PROJECTION_QUERY_BYTES,
        ),
        projectionNormalizer: exactBytes(
          sources.projectionNormalizer,
          MAX_PROJECTION_NORMALIZER_BYTES,
        ),
      },
      {
        platformBootstrapV2: exactBytes(
          sources.platformBootstrapV2,
          MAX_PLATFORM_BOOTSTRAP_V2_BYTES,
        ),
        applicationMigrationManifestV2: exactBytes(
          sources.applicationMigrationManifestV2,
          MAX_APPLICATION_MANIFEST_V2_BYTES,
        ),
        authenticatedMigrationRendererV2: exactBytes(
          sources.authenticatedMigrationRendererV2,
          MAX_AUTHENTICATED_MIGRATION_RENDERER_V2_BYTES,
        ),
        applicationMigrationsV2: Object.freeze(
          exactDataArray(
            sources.applicationMigrationsV2,
            APPLICATION_MIGRATION_V2_FILES.length,
            false,
          ).map((migration) => normalizeApplicationMigrationV2(migration)),
        ),
        restorePlatformV1: exactBytes(
          sources.restorePlatformV1,
          MAX_RESTORE_PLATFORM_V1_BYTES,
        ),
        authenticatedBackupRestorePlanV1: exactBytes(
          sources.authenticatedBackupRestorePlanV1,
          MAX_AUTHENTICATED_BACKUP_RESTORE_PLAN_V1_BYTES,
        ),
      },
      {
        postgresProjectionAdapter: exactBytes(
          sources.postgresProjectionAdapter,
          MAX_POSTGRES_PROJECTION_ADAPTER_BYTES,
        ),
        operationProjectionContract: exactBytes(
          sources.operationProjectionContract,
          MAX_OPERATION_PROJECTION_CONTRACT_BYTES,
        ),
        databasePackageManifest: exactBytes(
          sources.databasePackageManifest,
          MAX_DATABASE_PACKAGE_MANIFEST_BYTES,
        ),
        pnpmLockfile: exactBytes(sources.pnpmLockfile, MAX_PNPM_LOCKFILE_BYTES),
      },
      {
        postgresProjectionPool: exactBytes(
          sources.postgresProjectionPool,
          MAX_POSTGRES_PROJECTION_POOL_BYTES,
        ),
      },
      {
        postgresMigrationDeployer: exactBytes(
          sources.postgresMigrationDeployer,
          MAX_POSTGRES_MIGRATION_DEPLOYER_BYTES,
        ),
      },
      {
        postgresQueryPlanLoad: exactBytes(
          sources.postgresQueryPlanLoad,
          MAX_POSTGRES_QUERY_PLAN_LOAD_BYTES,
        ),
        queryPlanLoadFixture: exactBytes(
          sources.queryPlanLoadFixture,
          MAX_QUERY_PLAN_LOAD_FIXTURE_BYTES,
        ),
      },
      {
        privacyRetentionPolicyV1: exactBytes(
          sources.privacyRetentionPolicyV1,
          MAX_PRIVACY_RETENTION_POLICY_V1_BYTES,
        ),
        privacyRetentionPlanManifestV1: exactBytes(
          sources.privacyRetentionPlanManifestV1,
          MAX_PRIVACY_RETENTION_PLAN_MANIFEST_V1_BYTES,
        ),
        privacyRetentionPlanPlatformV1: exactBytes(
          sources.privacyRetentionPlanPlatformV1,
          MAX_PRIVACY_RETENTION_PLAN_PLATFORM_V1_BYTES,
        ),
        privacyRetentionPlanMigrationsV1: Object.freeze(
          exactDataArray(
            sources.privacyRetentionPlanMigrationsV1,
            1,
            false,
          ).map((migration) =>
            normalizePrivacyRetentionPlanMigrationV1(migration),
          ),
        ),
        privacyRetentionPolicySourceV1: exactBytes(
          sources.privacyRetentionPolicySourceV1,
          MAX_PRIVACY_RETENTION_POLICY_SOURCE_V1_BYTES,
        ),
        privacyRetentionPlanSourceV1: exactBytes(
          sources.privacyRetentionPlanSourceV1,
          MAX_PRIVACY_RETENTION_PLAN_SOURCE_V1_BYTES,
        ),
        resourceIdentifierTokenV1: exactBytes(
          sources.resourceIdentifierTokenV1,
          MAX_RESOURCE_IDENTIFIER_TOKEN_V1_BYTES,
        ),
        privacyRetentionFixtureV1: exactBytes(
          sources.privacyRetentionFixtureV1,
          MAX_PRIVACY_RETENTION_FIXTURE_V1_BYTES,
        ),
      },
      {
        populatedCutoverPlanManifestV1: exactBytes(
          sources.populatedCutoverPlanManifestV1,
          MAX_POPULATED_CUTOVER_PLAN_MANIFEST_V1_BYTES,
        ),
        populatedCutoverPlanPlatformV1: exactBytes(
          sources.populatedCutoverPlanPlatformV1,
          MAX_POPULATED_CUTOVER_PLAN_PLATFORM_V1_BYTES,
        ),
        populatedCutoverPlanMigrationsV1: Object.freeze(
          exactDataArray(
            sources.populatedCutoverPlanMigrationsV1,
            2,
            false,
          ).map((migration) =>
            normalizePopulatedCutoverPlanMigrationV1(migration),
          ),
        ),
        populatedCutoverPlanSourceV1: exactBytes(
          sources.populatedCutoverPlanSourceV1,
          MAX_POPULATED_CUTOVER_PLAN_SOURCE_V1_BYTES,
        ),
        populatedCutoverFixtureV1: exactBytes(
          sources.populatedCutoverFixtureV1,
          MAX_POPULATED_CUTOVER_FIXTURE_V1_BYTES,
        ),
      },
    );
  }
  if (schemaVersion === 13) {
    const sources = exactPlainDataRecord(value, V13_SOURCE_KEYS);
    return normalizeSourceFields(
      sources,
      {
        projectionQuery: exactBytes(
          sources.projectionQuery,
          MAX_PROJECTION_QUERY_BYTES,
        ),
        projectionNormalizer: exactBytes(
          sources.projectionNormalizer,
          MAX_PROJECTION_NORMALIZER_BYTES,
        ),
      },
      {
        platformBootstrapV2: exactBytes(
          sources.platformBootstrapV2,
          MAX_PLATFORM_BOOTSTRAP_V2_BYTES,
        ),
        applicationMigrationManifestV2: exactBytes(
          sources.applicationMigrationManifestV2,
          MAX_APPLICATION_MANIFEST_V2_BYTES,
        ),
        authenticatedMigrationRendererV2: exactBytes(
          sources.authenticatedMigrationRendererV2,
          MAX_AUTHENTICATED_MIGRATION_RENDERER_V2_BYTES,
        ),
        applicationMigrationsV2: Object.freeze(
          exactDataArray(
            sources.applicationMigrationsV2,
            APPLICATION_MIGRATION_V2_FILES.length,
            false,
          ).map((migration) => normalizeApplicationMigrationV2(migration)),
        ),
        restorePlatformV1: exactBytes(
          sources.restorePlatformV1,
          MAX_RESTORE_PLATFORM_V1_BYTES,
        ),
        authenticatedBackupRestorePlanV1: exactBytes(
          sources.authenticatedBackupRestorePlanV1,
          MAX_AUTHENTICATED_BACKUP_RESTORE_PLAN_V1_BYTES,
        ),
      },
      {
        postgresProjectionAdapter: exactBytes(
          sources.postgresProjectionAdapter,
          MAX_POSTGRES_PROJECTION_ADAPTER_BYTES,
        ),
        operationProjectionContract: exactBytes(
          sources.operationProjectionContract,
          MAX_OPERATION_PROJECTION_CONTRACT_BYTES,
        ),
        databasePackageManifest: exactBytes(
          sources.databasePackageManifest,
          MAX_DATABASE_PACKAGE_MANIFEST_BYTES,
        ),
        pnpmLockfile: exactBytes(sources.pnpmLockfile, MAX_PNPM_LOCKFILE_BYTES),
      },
      {
        postgresProjectionPool: exactBytes(
          sources.postgresProjectionPool,
          MAX_POSTGRES_PROJECTION_POOL_BYTES,
        ),
      },
      {
        postgresMigrationDeployer: exactBytes(
          sources.postgresMigrationDeployer,
          MAX_POSTGRES_MIGRATION_DEPLOYER_BYTES,
        ),
      },
      {
        postgresQueryPlanLoad: exactBytes(
          sources.postgresQueryPlanLoad,
          MAX_POSTGRES_QUERY_PLAN_LOAD_BYTES,
        ),
        queryPlanLoadFixture: exactBytes(
          sources.queryPlanLoadFixture,
          MAX_QUERY_PLAN_LOAD_FIXTURE_BYTES,
        ),
      },
      {
        privacyRetentionPolicyV1: exactBytes(
          sources.privacyRetentionPolicyV1,
          MAX_PRIVACY_RETENTION_POLICY_V1_BYTES,
        ),
        privacyRetentionPlanManifestV1: exactBytes(
          sources.privacyRetentionPlanManifestV1,
          MAX_PRIVACY_RETENTION_PLAN_MANIFEST_V1_BYTES,
        ),
        privacyRetentionPlanPlatformV1: exactBytes(
          sources.privacyRetentionPlanPlatformV1,
          MAX_PRIVACY_RETENTION_PLAN_PLATFORM_V1_BYTES,
        ),
        privacyRetentionPlanMigrationsV1: Object.freeze(
          exactDataArray(
            sources.privacyRetentionPlanMigrationsV1,
            1,
            false,
          ).map((migration) =>
            normalizePrivacyRetentionPlanMigrationV1(migration),
          ),
        ),
        privacyRetentionPolicySourceV1: exactBytes(
          sources.privacyRetentionPolicySourceV1,
          MAX_PRIVACY_RETENTION_POLICY_SOURCE_V1_BYTES,
        ),
        privacyRetentionPlanSourceV1: exactBytes(
          sources.privacyRetentionPlanSourceV1,
          MAX_PRIVACY_RETENTION_PLAN_SOURCE_V1_BYTES,
        ),
        resourceIdentifierTokenV1: exactBytes(
          sources.resourceIdentifierTokenV1,
          MAX_RESOURCE_IDENTIFIER_TOKEN_V1_BYTES,
        ),
        privacyRetentionFixtureV1: exactBytes(
          sources.privacyRetentionFixtureV1,
          MAX_PRIVACY_RETENTION_FIXTURE_V1_BYTES,
        ),
      },
    );
  }
  if (schemaVersion === 12) {
    const sources = exactPlainDataRecord(value, V12_SOURCE_KEYS);
    return normalizeSourceFields(
      sources,
      {
        projectionQuery: exactBytes(
          sources.projectionQuery,
          MAX_PROJECTION_QUERY_BYTES,
        ),
        projectionNormalizer: exactBytes(
          sources.projectionNormalizer,
          MAX_PROJECTION_NORMALIZER_BYTES,
        ),
      },
      {
        platformBootstrapV2: exactBytes(
          sources.platformBootstrapV2,
          MAX_PLATFORM_BOOTSTRAP_V2_BYTES,
        ),
        applicationMigrationManifestV2: exactBytes(
          sources.applicationMigrationManifestV2,
          MAX_APPLICATION_MANIFEST_V2_BYTES,
        ),
        authenticatedMigrationRendererV2: exactBytes(
          sources.authenticatedMigrationRendererV2,
          MAX_AUTHENTICATED_MIGRATION_RENDERER_V2_BYTES,
        ),
        applicationMigrationsV2: Object.freeze(
          exactDataArray(
            sources.applicationMigrationsV2,
            APPLICATION_MIGRATION_V2_FILES.length,
            false,
          ).map((migration) => normalizeApplicationMigrationV2(migration)),
        ),
        restorePlatformV1: exactBytes(
          sources.restorePlatformV1,
          MAX_RESTORE_PLATFORM_V1_BYTES,
        ),
        authenticatedBackupRestorePlanV1: exactBytes(
          sources.authenticatedBackupRestorePlanV1,
          MAX_AUTHENTICATED_BACKUP_RESTORE_PLAN_V1_BYTES,
        ),
      },
      {
        postgresProjectionAdapter: exactBytes(
          sources.postgresProjectionAdapter,
          MAX_POSTGRES_PROJECTION_ADAPTER_BYTES,
        ),
        operationProjectionContract: exactBytes(
          sources.operationProjectionContract,
          MAX_OPERATION_PROJECTION_CONTRACT_BYTES,
        ),
        databasePackageManifest: exactBytes(
          sources.databasePackageManifest,
          MAX_DATABASE_PACKAGE_MANIFEST_BYTES,
        ),
        pnpmLockfile: exactBytes(sources.pnpmLockfile, MAX_PNPM_LOCKFILE_BYTES),
      },
      {
        postgresProjectionPool: exactBytes(
          sources.postgresProjectionPool,
          MAX_POSTGRES_PROJECTION_POOL_BYTES,
        ),
      },
      {
        postgresMigrationDeployer: exactBytes(
          sources.postgresMigrationDeployer,
          MAX_POSTGRES_MIGRATION_DEPLOYER_BYTES,
        ),
      },
      {
        postgresQueryPlanLoad: exactBytes(
          sources.postgresQueryPlanLoad,
          MAX_POSTGRES_QUERY_PLAN_LOAD_BYTES,
        ),
        queryPlanLoadFixture: exactBytes(
          sources.queryPlanLoadFixture,
          MAX_QUERY_PLAN_LOAD_FIXTURE_BYTES,
        ),
      },
    );
  }
  if (schemaVersion === 11) {
    const sources = exactPlainDataRecord(value, V11_SOURCE_KEYS);
    return normalizeSourceFields(
      sources,
      {
        projectionQuery: exactBytes(
          sources.projectionQuery,
          MAX_PROJECTION_QUERY_BYTES,
        ),
        projectionNormalizer: exactBytes(
          sources.projectionNormalizer,
          MAX_PROJECTION_NORMALIZER_BYTES,
        ),
      },
      {
        platformBootstrapV2: exactBytes(
          sources.platformBootstrapV2,
          MAX_PLATFORM_BOOTSTRAP_V2_BYTES,
        ),
        applicationMigrationManifestV2: exactBytes(
          sources.applicationMigrationManifestV2,
          MAX_APPLICATION_MANIFEST_V2_BYTES,
        ),
        authenticatedMigrationRendererV2: exactBytes(
          sources.authenticatedMigrationRendererV2,
          MAX_AUTHENTICATED_MIGRATION_RENDERER_V2_BYTES,
        ),
        applicationMigrationsV2: Object.freeze(
          exactDataArray(
            sources.applicationMigrationsV2,
            APPLICATION_MIGRATION_V2_FILES.length,
            false,
          ).map((migration) => normalizeApplicationMigrationV2(migration)),
        ),
        restorePlatformV1: exactBytes(
          sources.restorePlatformV1,
          MAX_RESTORE_PLATFORM_V1_BYTES,
        ),
        authenticatedBackupRestorePlanV1: exactBytes(
          sources.authenticatedBackupRestorePlanV1,
          MAX_AUTHENTICATED_BACKUP_RESTORE_PLAN_V1_BYTES,
        ),
      },
      {
        postgresProjectionAdapter: exactBytes(
          sources.postgresProjectionAdapter,
          MAX_POSTGRES_PROJECTION_ADAPTER_BYTES,
        ),
        operationProjectionContract: exactBytes(
          sources.operationProjectionContract,
          MAX_OPERATION_PROJECTION_CONTRACT_BYTES,
        ),
        databasePackageManifest: exactBytes(
          sources.databasePackageManifest,
          MAX_DATABASE_PACKAGE_MANIFEST_BYTES,
        ),
        pnpmLockfile: exactBytes(sources.pnpmLockfile, MAX_PNPM_LOCKFILE_BYTES),
      },
      {
        postgresProjectionPool: exactBytes(
          sources.postgresProjectionPool,
          MAX_POSTGRES_PROJECTION_POOL_BYTES,
        ),
      },
      {
        postgresMigrationDeployer: exactBytes(
          sources.postgresMigrationDeployer,
          MAX_POSTGRES_MIGRATION_DEPLOYER_BYTES,
        ),
      },
    );
  }
  if (schemaVersion === 10) {
    const sources = exactPlainDataRecord(value, V10_SOURCE_KEYS);
    return normalizeSourceFields(
      sources,
      {
        projectionQuery: exactBytes(
          sources.projectionQuery,
          MAX_PROJECTION_QUERY_BYTES,
        ),
        projectionNormalizer: exactBytes(
          sources.projectionNormalizer,
          MAX_PROJECTION_NORMALIZER_BYTES,
        ),
      },
      {
        platformBootstrapV2: exactBytes(
          sources.platformBootstrapV2,
          MAX_PLATFORM_BOOTSTRAP_V2_BYTES,
        ),
        applicationMigrationManifestV2: exactBytes(
          sources.applicationMigrationManifestV2,
          MAX_APPLICATION_MANIFEST_V2_BYTES,
        ),
        authenticatedMigrationRendererV2: exactBytes(
          sources.authenticatedMigrationRendererV2,
          MAX_AUTHENTICATED_MIGRATION_RENDERER_V2_BYTES,
        ),
        applicationMigrationsV2: Object.freeze(
          exactDataArray(
            sources.applicationMigrationsV2,
            APPLICATION_MIGRATION_V2_FILES.length,
            false,
          ).map((migration) => normalizeApplicationMigrationV2(migration)),
        ),
        restorePlatformV1: exactBytes(
          sources.restorePlatformV1,
          MAX_RESTORE_PLATFORM_V1_BYTES,
        ),
        authenticatedBackupRestorePlanV1: exactBytes(
          sources.authenticatedBackupRestorePlanV1,
          MAX_AUTHENTICATED_BACKUP_RESTORE_PLAN_V1_BYTES,
        ),
      },
      {
        postgresProjectionAdapter: exactBytes(
          sources.postgresProjectionAdapter,
          MAX_POSTGRES_PROJECTION_ADAPTER_BYTES,
        ),
        operationProjectionContract: exactBytes(
          sources.operationProjectionContract,
          MAX_OPERATION_PROJECTION_CONTRACT_BYTES,
        ),
        databasePackageManifest: exactBytes(
          sources.databasePackageManifest,
          MAX_DATABASE_PACKAGE_MANIFEST_BYTES,
        ),
        pnpmLockfile: exactBytes(sources.pnpmLockfile, MAX_PNPM_LOCKFILE_BYTES),
      },
      {
        postgresProjectionPool: exactBytes(
          sources.postgresProjectionPool,
          MAX_POSTGRES_PROJECTION_POOL_BYTES,
        ),
      },
    );
  }
  if (schemaVersion === 9) {
    const sources = exactPlainDataRecord(value, V9_SOURCE_KEYS);
    return normalizeSourceFields(
      sources,
      {
        projectionQuery: exactBytes(
          sources.projectionQuery,
          MAX_PROJECTION_QUERY_BYTES,
        ),
        projectionNormalizer: exactBytes(
          sources.projectionNormalizer,
          MAX_PROJECTION_NORMALIZER_BYTES,
        ),
      },
      {
        platformBootstrapV2: exactBytes(
          sources.platformBootstrapV2,
          MAX_PLATFORM_BOOTSTRAP_V2_BYTES,
        ),
        applicationMigrationManifestV2: exactBytes(
          sources.applicationMigrationManifestV2,
          MAX_APPLICATION_MANIFEST_V2_BYTES,
        ),
        authenticatedMigrationRendererV2: exactBytes(
          sources.authenticatedMigrationRendererV2,
          MAX_AUTHENTICATED_MIGRATION_RENDERER_V2_BYTES,
        ),
        applicationMigrationsV2: Object.freeze(
          exactDataArray(
            sources.applicationMigrationsV2,
            APPLICATION_MIGRATION_V2_FILES.length,
            false,
          ).map((migration) => normalizeApplicationMigrationV2(migration)),
        ),
        restorePlatformV1: exactBytes(
          sources.restorePlatformV1,
          MAX_RESTORE_PLATFORM_V1_BYTES,
        ),
        authenticatedBackupRestorePlanV1: exactBytes(
          sources.authenticatedBackupRestorePlanV1,
          MAX_AUTHENTICATED_BACKUP_RESTORE_PLAN_V1_BYTES,
        ),
      },
      {
        postgresProjectionAdapter: exactBytes(
          sources.postgresProjectionAdapter,
          MAX_POSTGRES_PROJECTION_ADAPTER_BYTES,
        ),
        operationProjectionContract: exactBytes(
          sources.operationProjectionContract,
          MAX_OPERATION_PROJECTION_CONTRACT_BYTES,
        ),
        databasePackageManifest: exactBytes(
          sources.databasePackageManifest,
          MAX_DATABASE_PACKAGE_MANIFEST_BYTES,
        ),
        pnpmLockfile: exactBytes(sources.pnpmLockfile, MAX_PNPM_LOCKFILE_BYTES),
      },
    );
  }
  if (schemaVersion === 8) {
    const sources = exactPlainDataRecord(value, V8_SOURCE_KEYS);
    return normalizeSourceFields(
      sources,
      {
        projectionQuery: exactBytes(
          sources.projectionQuery,
          MAX_PROJECTION_QUERY_BYTES,
        ),
        projectionNormalizer: exactBytes(
          sources.projectionNormalizer,
          MAX_PROJECTION_NORMALIZER_BYTES,
        ),
      },
      {
        platformBootstrapV2: exactBytes(
          sources.platformBootstrapV2,
          MAX_PLATFORM_BOOTSTRAP_V2_BYTES,
        ),
        applicationMigrationManifestV2: exactBytes(
          sources.applicationMigrationManifestV2,
          MAX_APPLICATION_MANIFEST_V2_BYTES,
        ),
        authenticatedMigrationRendererV2: exactBytes(
          sources.authenticatedMigrationRendererV2,
          MAX_AUTHENTICATED_MIGRATION_RENDERER_V2_BYTES,
        ),
        applicationMigrationsV2: Object.freeze(
          exactDataArray(
            sources.applicationMigrationsV2,
            APPLICATION_MIGRATION_V2_FILES.length,
            false,
          ).map((migration) => normalizeApplicationMigrationV2(migration)),
        ),
        restorePlatformV1: exactBytes(
          sources.restorePlatformV1,
          MAX_RESTORE_PLATFORM_V1_BYTES,
        ),
        authenticatedBackupRestorePlanV1: exactBytes(
          sources.authenticatedBackupRestorePlanV1,
          MAX_AUTHENTICATED_BACKUP_RESTORE_PLAN_V1_BYTES,
        ),
      },
    );
  }
  if (schemaVersion === 7) {
    const sources = exactPlainDataRecord(value, V7_SOURCE_KEYS);
    return normalizeSourceFields(
      sources,
      {
        projectionQuery: exactBytes(
          sources.projectionQuery,
          MAX_PROJECTION_QUERY_BYTES,
        ),
        projectionNormalizer: exactBytes(
          sources.projectionNormalizer,
          MAX_PROJECTION_NORMALIZER_BYTES,
        ),
      },
      {
        platformBootstrapV2: exactBytes(
          sources.platformBootstrapV2,
          MAX_PLATFORM_BOOTSTRAP_V2_BYTES,
        ),
        applicationMigrationManifestV2: exactBytes(
          sources.applicationMigrationManifestV2,
          MAX_APPLICATION_MANIFEST_V2_BYTES,
        ),
        authenticatedMigrationRendererV2: exactBytes(
          sources.authenticatedMigrationRendererV2,
          MAX_AUTHENTICATED_MIGRATION_RENDERER_V2_BYTES,
        ),
        applicationMigrationsV2: Object.freeze(
          exactDataArray(
            sources.applicationMigrationsV2,
            APPLICATION_MIGRATION_V2_FILES.length,
            false,
          ).map((migration) => normalizeApplicationMigrationV2(migration)),
        ),
      },
    );
  }
  if (usesProjectionSources(schemaVersion)) {
    const sources = exactPlainDataRecord(value, PROJECTION_SOURCE_KEYS);
    return normalizeSourceFields(sources, {
      projectionQuery: exactBytes(
        sources.projectionQuery,
        MAX_PROJECTION_QUERY_BYTES,
      ),
      projectionNormalizer: exactBytes(
        sources.projectionNormalizer,
        MAX_PROJECTION_NORMALIZER_BYTES,
      ),
    });
  }
  return normalizeSourceFields(
    exactPlainDataRecord(value, HISTORICAL_SOURCE_KEYS),
  );
}

function usesProjectionSources(
  schemaVersion: PostgresAcceptanceEvidence["schemaVersion"],
): schemaVersion is 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 {
  return (
    schemaVersion === 4 ||
    schemaVersion === 5 ||
    schemaVersion === 6 ||
    schemaVersion === 7 ||
    schemaVersion === 8 ||
    schemaVersion === 9 ||
    schemaVersion === 10 ||
    schemaVersion === 11 ||
    schemaVersion === 12 ||
    schemaVersion === 13 ||
    schemaVersion === 14
  );
}

function normalizeSourceFields(
  sources: DataRecord & {
    readonly imageConfig: unknown;
    readonly workflow: unknown;
    readonly fixture: unknown;
    readonly migrationManifest: unknown;
    readonly acceptanceRunner: unknown;
    readonly migrations: unknown;
  },
  v4Sources: Pick<
    NormalizedSources,
    "projectionQuery" | "projectionNormalizer"
  > = {},
  v7Sources: Pick<
    NormalizedSources,
    | "platformBootstrapV2"
    | "applicationMigrationManifestV2"
    | "authenticatedMigrationRendererV2"
    | "applicationMigrationsV2"
    | "restorePlatformV1"
    | "authenticatedBackupRestorePlanV1"
  > = {},
  v9Sources: Pick<
    NormalizedSources,
    | "postgresProjectionAdapter"
    | "operationProjectionContract"
    | "databasePackageManifest"
    | "pnpmLockfile"
  > = {},
  v10Sources: Pick<NormalizedSources, "postgresProjectionPool"> = {},
  v11Sources: Pick<NormalizedSources, "postgresMigrationDeployer"> = {},
  v12Sources: Pick<
    NormalizedSources,
    "postgresQueryPlanLoad" | "queryPlanLoadFixture"
  > = {},
  v13Sources: Pick<
    NormalizedSources,
    | "privacyRetentionPolicyV1"
    | "privacyRetentionPlanManifestV1"
    | "privacyRetentionPlanPlatformV1"
    | "privacyRetentionPlanMigrationsV1"
    | "privacyRetentionPolicySourceV1"
    | "privacyRetentionPlanSourceV1"
    | "resourceIdentifierTokenV1"
    | "privacyRetentionFixtureV1"
  > = {},
  v14Sources: Pick<
    NormalizedSources,
    | "populatedCutoverPlanManifestV1"
    | "populatedCutoverPlanPlatformV1"
    | "populatedCutoverPlanMigrationsV1"
    | "populatedCutoverPlanSourceV1"
    | "populatedCutoverFixtureV1"
  > = {},
): NormalizedSources {
  const migrations = exactDataArray(sources.migrations, MAX_MIGRATIONS, false);
  return Object.freeze({
    imageConfig: exactBytes(sources.imageConfig, MAX_IMAGE_CONFIG_BYTES),
    workflow: exactBytes(sources.workflow, MAX_WORKFLOW_BYTES),
    fixture: exactBytes(sources.fixture, MAX_FIXTURE_BYTES),
    migrationManifest: exactBytes(
      sources.migrationManifest,
      MAX_MANIFEST_BYTES,
    ),
    acceptanceRunner: exactBytes(sources.acceptanceRunner, MAX_RUNNER_BYTES),
    migrations: Object.freeze(
      migrations.map((migration) => normalizeMigrationSource(migration)),
    ),
    ...v4Sources,
    ...v7Sources,
    ...v9Sources,
    ...v10Sources,
    ...v11Sources,
    ...v12Sources,
    ...v13Sources,
    ...v14Sources,
  });
}

function normalizeMigrationSource(value: unknown): NormalizedMigrationSource {
  const migration = exactPlainDataRecord(value, MIGRATION_SOURCE_KEYS);
  return Object.freeze({
    id: migrationId(migration.id),
    file: migrationFile(migration.file),
    bytes: exactBytes(migration.bytes, MAX_MIGRATION_BYTES),
  });
}

function normalizeApplicationMigrationV2(
  value: unknown,
): NormalizedMigrationSource {
  const migration = exactPlainDataRecord(value, MIGRATION_SOURCE_KEYS);
  const id = migrationIdV2(migration.id);
  const file = migrationFile(migration.file);
  const expectedIndex = Number(id.slice("v2-".length)) - 1;
  if (APPLICATION_MIGRATION_V2_FILES[expectedIndex] !== file) invalid();
  return Object.freeze({
    id,
    file,
    bytes: exactBytes(migration.bytes, MAX_MIGRATION_BYTES),
  });
}

function normalizePrivacyRetentionPlanMigrationV1(
  value: unknown,
): NormalizedMigrationSource {
  const migration = exactPlainDataRecord(value, MIGRATION_SOURCE_KEYS);
  if (
    migration.id !== PRIVACY_RETENTION_PLAN_MIGRATION_V1_ID ||
    migration.file !== PRIVACY_RETENTION_PLAN_MIGRATION_V1_FILE
  ) {
    invalid();
  }
  return Object.freeze({
    id: migration.id,
    file: migration.file,
    bytes: exactBytes(migration.bytes, MAX_MIGRATION_BYTES),
  });
}

function normalizePopulatedCutoverPlanMigrationV1(
  value: unknown,
): NormalizedMigrationSource {
  const migration = exactPlainDataRecord(value, MIGRATION_SOURCE_KEYS);
  const expected = [
    {
      id: "populated-cutover-v1-0001",
      file: "application/0001_expand_capture_and_backfill.sql",
    },
    {
      id: "populated-cutover-v1-0002",
      file: "application/0002_validate_and_contract.sql",
    },
  ] as const;
  const match = expected.find(
    (entry) => entry.id === migration.id && entry.file === migration.file,
  );
  if (match === undefined) invalid();
  return Object.freeze({
    id: match.id,
    file: match.file,
    bytes: exactBytes(migration.bytes, MAX_MIGRATION_BYTES),
  });
}

function parseReviewedImageConfig(
  bytes: Uint8Array,
  schemaVersion: PostgresAcceptanceEvidence["schemaVersion"],
): ReviewedImageConfig {
  const value = exactPlainDataRecord(
    parseCanonicalJson(bytes),
    schemaVersion === 14
      ? V14_IMAGE_CONFIG_KEYS
      : schemaVersion === 13
        ? V13_IMAGE_CONFIG_KEYS
        : schemaVersion === 12
          ? V12_IMAGE_CONFIG_KEYS
          : IMAGE_CONFIG_KEYS,
  );
  const runner = exactPlainDataRecord(value.runner, IMAGE_RUNNER_KEYS);
  const indexDigest = sha256Digest(value.indexDigest);
  const workflowSha256 = sha256Hex(value.workflowSha256);
  const fixtureSha256 = sha256Hex(value.fixtureSha256);
  const queryPlanLoadFixtureSha256 =
    schemaVersion === 12 || schemaVersion === 13 || schemaVersion === 14
      ? sha256Hex(value.queryPlanLoadFixtureSha256)
      : undefined;
  const privacyRetentionFixtureSha256 =
    schemaVersion === 13 || schemaVersion === 14
      ? sha256Hex(value.privacyRetentionFixtureSha256)
      : undefined;
  const populatedCutoverFixtureSha256 =
    schemaVersion === 14
      ? sha256Hex(value.populatedCutoverFixtureSha256)
      : undefined;
  if (
    value.schemaVersion !== 1 ||
    value.repository !== "docker.io/library/postgres" ||
    value.tag !== "17.11-bookworm" ||
    value.reference !== `${value.repository}:${value.tag}@${indexDigest}` ||
    value.mediaType !== "application/vnd.oci.image.index.v1+json" ||
    value.expectedServerVersion !== "17.11" ||
    value.expectedServerVersionNumber !== 170011 ||
    value.databaseName !== "research_cockpit_acceptance_test" ||
    !isCanonicalDate(value.verifiedOn) ||
    runner.label !== "ubuntu-24.04" ||
    runner.os !== "linux" ||
    runner.architecture !== "amd64"
  ) {
    invalid();
  }
  return Object.freeze({
    indexDigest,
    reference: value.reference,
    expectedServerVersion: value.expectedServerVersion,
    expectedServerVersionNumber: value.expectedServerVersionNumber,
    databaseName: value.databaseName,
    workflowSha256,
    fixtureSha256,
    queryPlanLoadFixtureSha256,
    privacyRetentionFixtureSha256,
    populatedCutoverFixtureSha256,
  });
}

function verifyMigrationManifest(
  manifestBytes: Uint8Array,
  migrationSources: readonly NormalizedMigrationSource[],
): void {
  const manifest = exactPlainDataRecord(
    parseCanonicalJson(manifestBytes),
    MANIFEST_KEYS,
  );
  if (manifest.schemaVersion !== 1 || manifest.algorithm !== "sha256") {
    invalid();
  }
  const entries = exactDataArray(manifest.migrations, MAX_MIGRATIONS, false);
  if (entries.length !== migrationSources.length) invalid();

  entries.forEach((entryValue, index) => {
    const entry = exactPlainDataRecord(entryValue, MANIFEST_ENTRY_KEYS);
    const id = migrationId(entry.id);
    const file = migrationFile(entry.file);
    const expectedId = String(index + 1).padStart(4, "0");
    const expectedHash = sha256Hex(entry.sha256);
    const source = migrationSources[index];
    if (
      source === undefined ||
      id !== expectedId ||
      !file.startsWith(`${id}_`) ||
      source.id !== id ||
      source.file !== file ||
      sha256(source.bytes) !== expectedHash
    ) {
      invalid();
    }
  });
}

function verifyApplicationMigrationManifestV2(
  manifestBytes: Uint8Array,
  migrationSources: readonly NormalizedMigrationSource[],
): void {
  const manifest = exactPlainDataRecord(
    parseCanonicalJson(manifestBytes),
    APPLICATION_MANIFEST_V2_KEYS,
  );
  if (
    manifest.schemaVersion !== 1 ||
    manifest.planVersion !== 2 ||
    manifest.algorithm !== "sha256"
  ) {
    invalid();
  }
  const entries = exactDataArray(
    manifest.migrations,
    APPLICATION_MIGRATION_V2_FILES.length,
    false,
  );
  if (
    entries.length !== APPLICATION_MIGRATION_V2_FILES.length ||
    entries.length !== migrationSources.length
  ) {
    invalid();
  }

  entries.forEach((entryValue, index) => {
    const entry = exactPlainDataRecord(entryValue, MANIFEST_ENTRY_KEYS);
    const id = migrationIdV2(entry.id);
    const file = migrationFile(entry.file);
    const expectedId = `v2-${String(index + 1).padStart(4, "0")}`;
    const expectedFile = APPLICATION_MIGRATION_V2_FILES[index];
    const expectedHash = sha256Hex(entry.sha256);
    const source = migrationSources[index];
    if (
      source === undefined ||
      id !== expectedId ||
      file !== expectedFile ||
      source.id !== id ||
      source.file !== file ||
      sha256(source.bytes) !== expectedHash
    ) {
      invalid();
    }
  });
}

function verifyPrivacyRetentionPlanManifestV1(
  manifestBytes: Uint8Array,
  platformBytes: Uint8Array,
  migrationSources: readonly NormalizedMigrationSource[],
): void {
  const manifest = exactPlainDataRecord(
    parseCanonicalJson(manifestBytes),
    PRIVACY_RETENTION_PLAN_MANIFEST_V1_KEYS,
  );
  if (
    manifest.schemaVersion !== 1 ||
    manifest.planVersion !== 1 ||
    manifest.algorithm !== "sha256"
  ) {
    invalid();
  }

  const platform = exactPlainDataRecord(
    manifest.platform,
    PRIVACY_RETENTION_PLAN_PLATFORM_V1_KEYS,
  );
  if (
    platform.file !== PRIVACY_RETENTION_PLAN_PLATFORM_V1_FILE ||
    sha256(platformBytes) !== sha256Hex(platform.sha256)
  ) {
    invalid();
  }

  const migrations = exactDataArray(manifest.migrations, 1, false);
  if (migrations.length !== 1 || migrationSources.length !== 1) invalid();
  const entry = exactPlainDataRecord(migrations[0], MANIFEST_ENTRY_KEYS);
  const source = migrationSources[0];
  if (
    entry.id !== PRIVACY_RETENTION_PLAN_MIGRATION_V1_ID ||
    entry.file !== PRIVACY_RETENTION_PLAN_MIGRATION_V1_FILE ||
    source === undefined ||
    source.id !== entry.id ||
    source.file !== entry.file ||
    sha256(source.bytes) !== sha256Hex(entry.sha256)
  ) {
    invalid();
  }
}

function verifyPopulatedCutoverPlanManifestV1(
  manifestBytes: Uint8Array,
  platformBytes: Uint8Array,
  migrationSources: readonly NormalizedMigrationSource[],
  applicationManifestV2Bytes: Uint8Array,
  privacyPolicyV1Bytes: Uint8Array,
  privacyManifestV1Bytes: Uint8Array,
): void {
  const manifest = exactPlainDataRecord(
    parseCanonicalJson(manifestBytes),
    POPULATED_CUTOVER_PLAN_MANIFEST_V1_KEYS,
  );
  if (
    manifest.schemaVersion !== 1 ||
    manifest.planVersion !== 1 ||
    manifest.algorithm !== "sha256"
  ) {
    invalid();
  }

  const platform = exactPlainDataRecord(
    manifest.platform,
    POPULATED_CUTOVER_PLAN_PLATFORM_V1_KEYS,
  );
  if (
    platform.file !== POPULATED_CUTOVER_PLAN_PLATFORM_V1_FILE ||
    sha256(platformBytes) !== sha256Hex(platform.sha256)
  ) {
    invalid();
  }

  const applicationManifestV2 = exactPlainDataRecord(
    parseCanonicalJson(applicationManifestV2Bytes),
    APPLICATION_MANIFEST_V2_KEYS,
  );
  if (
    applicationManifestV2.schemaVersion !== 1 ||
    applicationManifestV2.planVersion !== 2 ||
    applicationManifestV2.algorithm !== "sha256"
  ) {
    invalid();
  }
  const applicationEntries = exactDataArray(
    applicationManifestV2.migrations,
    APPLICATION_MIGRATION_V2_FILES.length,
    false,
  ).map((value, index) => {
    const entry = exactPlainDataRecord(value, MANIFEST_ENTRY_KEYS);
    const id = migrationIdV2(entry.id);
    const file = migrationFile(entry.file);
    if (
      id !== `v2-${String(index + 1).padStart(4, "0")}` ||
      file !== APPLICATION_MIGRATION_V2_FILES[index]
    ) {
      invalid();
    }
    return Object.freeze({ id, file, sha256: sha256Hex(entry.sha256) });
  });

  const base = exactPlainDataRecord(
    manifest.base,
    POPULATED_CUTOVER_PLAN_BASE_V1_KEYS,
  );
  if (
    base.planVersion !== 2 ||
    base.manifestFile !==
      "../../migration-plans/v2/application-manifest.json" ||
    sha256Hex(base.manifestSha256) !== sha256(applicationManifestV2Bytes)
  ) {
    invalid();
  }
  const selected = exactDataArray(
    base.selectedMigrations,
    POPULATED_CUTOVER_BASE_SELECTED_MIGRATION_IDS_V1.length,
    false,
  );
  if (
    selected.length !== POPULATED_CUTOVER_BASE_SELECTED_MIGRATION_IDS_V1.length
  ) {
    invalid();
  }
  selected.forEach((value, index) => {
    const entry = exactPlainDataRecord(value, MANIFEST_ENTRY_KEYS);
    const expectedId = POPULATED_CUTOVER_BASE_SELECTED_MIGRATION_IDS_V1[index];
    const expected = applicationEntries.find(
      (candidate) => candidate.id === expectedId,
    );
    if (
      expected === undefined ||
      entry.id !== expected.id ||
      entry.file !== expected.file ||
      sha256Hex(entry.sha256) !== expected.sha256
    ) {
      invalid();
    }
  });
  const excluded = exactPlainDataRecord(
    base.excludedMigration,
    POPULATED_CUTOVER_PLAN_EXCLUDED_MIGRATION_V1_KEYS,
  );
  const expectedExcluded = applicationEntries[4];
  if (
    expectedExcluded === undefined ||
    excluded.id !== expectedExcluded.id ||
    excluded.file !== expectedExcluded.file ||
    sha256Hex(excluded.sha256) !== expectedExcluded.sha256 ||
    excluded.reason !== "replaced_by_audited_populated_cutover"
  ) {
    invalid();
  }

  const privacyManifestV1 = exactPlainDataRecord(
    parseCanonicalJson(privacyManifestV1Bytes),
    PRIVACY_RETENTION_PLAN_MANIFEST_V1_KEYS,
  );
  const privacyMigrations = exactDataArray(
    privacyManifestV1.migrations,
    1,
    false,
  );
  const privacyApplication = exactPlainDataRecord(
    privacyMigrations[0],
    MANIFEST_ENTRY_KEYS,
  );
  const target = exactPlainDataRecord(
    manifest.target,
    POPULATED_CUTOVER_PLAN_TARGET_V1_KEYS,
  );
  if (
    target.privacyPlanVersion !== 1 ||
    target.manifestFile !== "../../privacy-retention-plans/v1/manifest.json" ||
    sha256Hex(target.manifestSha256) !== sha256(privacyManifestV1Bytes) ||
    target.policyFile !== "../../privacy-retention-plans/v1/policy.json" ||
    sha256Hex(target.policySha256) !== sha256(privacyPolicyV1Bytes) ||
    target.applicationFile !==
      "../../privacy-retention-plans/v1/application/0001_keyed_resource_identifier_lifecycle.sql" ||
    target.applicationFile !==
      `../../privacy-retention-plans/v1/${String(privacyApplication.file)}` ||
    sha256Hex(target.applicationSha256) !== sha256Hex(privacyApplication.sha256)
  ) {
    invalid();
  }

  const migrations = exactDataArray(
    manifest.migrations,
    POPULATED_CUTOVER_PLAN_MIGRATIONS_V1.length,
    false,
  );
  if (
    migrations.length !== POPULATED_CUTOVER_PLAN_MIGRATIONS_V1.length ||
    migrationSources.length !== POPULATED_CUTOVER_PLAN_MIGRATIONS_V1.length
  ) {
    invalid();
  }
  migrations.forEach((value, index) => {
    const entry = exactPlainDataRecord(
      value,
      POPULATED_CUTOVER_PLAN_MIGRATION_V1_KEYS,
    );
    const expected = POPULATED_CUTOVER_PLAN_MIGRATIONS_V1[index];
    const source = migrationSources[index];
    if (
      expected === undefined ||
      source === undefined ||
      entry.id !== expected.id ||
      entry.phase !== expected.phase ||
      entry.file !== expected.file ||
      source.id !== expected.id ||
      source.file !== expected.file ||
      sha256(source.bytes) !== sha256Hex(entry.sha256)
    ) {
      invalid();
    }
  });
}

function parseCanonicalJson(bytes: Uint8Array): unknown {
  const text = decodeUtf8(bytes);
  const parsed = JSON.parse(text) as unknown;
  const canonical = new TextEncoder().encode(
    `${JSON.stringify(parsed, null, 2)}\n`,
  );
  if (!sameBytes(bytes, canonical)) invalid();
  return parsed;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
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

function exactDataArray(
  value: unknown,
  maximumLength: number,
  allowEmpty: boolean,
): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length > maximumLength ||
    (!allowEmpty && value.length === 0)
  ) {
    invalid();
  }
  const keys = Reflect.ownKeys(value);
  const expectedKeys = [
    ...Array.from({ length: value.length }, (_, index) => String(index)),
    "length",
  ];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    invalid();
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.value !== value.length
  ) {
    invalid();
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) invalid();
  }
  return value;
}

function exactBytes(value: unknown, maximumLength: number): Uint8Array {
  if (
    !(value instanceof Uint8Array) ||
    Object.getPrototypeOf(value) !== Uint8Array.prototype ||
    !(value.buffer instanceof ArrayBuffer) ||
    value.byteLength === 0 ||
    value.byteLength > maximumLength
  ) {
    invalid();
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== value.byteLength ||
    keys.some((key, index) => key !== String(index))
  ) {
    invalid();
  }
  return new Uint8Array(value);
}

function githubRepository(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 201 ||
    !REPOSITORY.test(value)
  ) {
    invalid();
  }
  return value;
}

function positiveDecimalString(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 20 ||
    !POSITIVE_DECIMAL.test(value)
  ) {
    invalid();
  }
  return value;
}

function positiveSafeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    invalid();
  }
  return value;
}

function sha1Hex(value: unknown): string {
  if (typeof value !== "string" || !SHA1_HEX.test(value)) invalid();
  return value;
}

function sha256Hex(value: unknown): string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) invalid();
  return value;
}

function sha256Digest(value: unknown): string {
  if (typeof value !== "string" || !SHA256_DIGEST.test(value)) invalid();
  return value;
}

function migrationId(value: unknown): string {
  if (typeof value !== "string" || !MIGRATION_ID.test(value)) invalid();
  return value;
}

function migrationIdV2(value: unknown): string {
  if (typeof value !== "string" || !APPLICATION_MIGRATION_V2_ID.test(value)) {
    invalid();
  }
  return value;
}

function migrationFile(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 240 ||
    !MIGRATION_FILE.test(value)
  ) {
    invalid();
  }
  return value;
}

function isCanonicalDate(value: unknown): boolean {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString() === `${value}T00:00:00.000Z`
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function invalid(): never {
  throw new Error("invalid");
}
