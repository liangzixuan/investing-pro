import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

export const POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME =
  "research-cockpit-postgres-acceptance-v9.json";

export const POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED = Object.freeze([
  "pristine_target",
  "atomic_bootstrap_rollback",
  "clean_bootstrap",
  "migration_ledger",
  "replay_rejection",
  "synthetic_fixture_load",
  "catalog_contract",
  "backup_capability_catalog",
  "request_context_cleanup",
  "tenant_isolation",
  "operation_rights",
  "write_denials",
] as const);

export const POSTGRES_ACCEPTANCE_V1_NOT_PROVEN = Object.freeze([
  "resolved_platform_image_manifest",
  "authenticated_database_sessions",
  "production_identity_tls_secrets_or_pooling",
  "concurrent_sessions_cancellation_or_timeouts",
  "dump_restore_or_disaster_recovery",
  "real_or_licensed_market_data",
] as const);

export const POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED = Object.freeze([
  ...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
  "bounded_container_local_scram_runtime_probe",
] as const);

export const POSTGRES_ACCEPTANCE_V2_NOT_PROVEN = Object.freeze([
  "resolved_platform_image_manifest",
  "external_or_production_authenticated_database_sessions",
  "authenticated_migrator_test_loader_or_backup_sessions",
  "full_authenticated_runtime_authorization_matrix",
  "end_user_identity_or_tenant_binding",
  "production_identity_tls_secrets_or_pooling",
  "concurrent_sessions_cancellation_or_timeouts",
  "dump_restore_or_disaster_recovery",
  "real_or_licensed_market_data",
] as const);

export const POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED = Object.freeze([
  ...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
  "authenticated_runtime_authorization_matrix",
] as const);

export const POSTGRES_ACCEPTANCE_V3_NOT_PROVEN = Object.freeze([
  "resolved_platform_image_manifest",
  "external_or_production_authenticated_database_sessions",
  "authenticated_migrator_test_loader_or_backup_sessions",
  "end_user_identity_or_tenant_binding",
  "production_identity_tls_secrets_or_pooling",
  "concurrent_sessions_cancellation_or_timeouts",
  "dump_restore_or_disaster_recovery",
  "real_or_licensed_market_data",
] as const);

export const POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED = Object.freeze([
  ...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
  "authenticated_financial_fact_projection_query",
] as const);

export const POSTGRES_ACCEPTANCE_V4_NOT_PROVEN = Object.freeze([
  ...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
  "application_driver_pool_or_composition_root",
  "complete_dossier_history_timeline_or_dimensioned_projection",
] as const);

export const POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED = Object.freeze([
  ...POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED,
  "authenticated_test_loader_fixture_load",
] as const);

export const POSTGRES_ACCEPTANCE_V5_NOT_PROVEN = Object.freeze([
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
] as const);

export const POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED = Object.freeze([
  ...POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED,
  "authenticated_owner_ddl_canary",
] as const);

export const POSTGRES_ACCEPTANCE_V6_NOT_PROVEN =
  POSTGRES_ACCEPTANCE_V5_NOT_PROVEN;

export const POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED = Object.freeze([
  ...POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED,
  "authenticated_clean_application_migrations_after_platform_bootstrap",
] as const);

export const POSTGRES_ACCEPTANCE_V7_NOT_PROVEN = Object.freeze([
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
] as const);

export const POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED = Object.freeze([
  ...POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED,
  "authenticated_policy_scoped_application_data_dump_and_bounded_clean_restore",
] as const);

export const POSTGRES_ACCEPTANCE_V8_NOT_PROVEN = Object.freeze([
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
] as const);

export const POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED = Object.freeze([
  ...POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED,
  "authenticated_single_client_read_only_financial_fact_projection_adapter",
] as const);

export const POSTGRES_ACCEPTANCE_V9_NOT_PROVEN = Object.freeze([
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
  "application_pool_or_composition_root",
  "complete_dossier_history_timeline_or_dimensioned_projection",
] as const);

/** The exact completed-check list emitted by the current evidence builder. */
export const POSTGRES_ACCEPTANCE_CHECKS_PASSED =
  POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED;

/** The exact limitation list emitted by the current evidence builder. */
export const POSTGRES_ACCEPTANCE_NOT_PROVEN = POSTGRES_ACCEPTANCE_V9_NOT_PROVEN;

const BUILD_INPUT_KEYS = [
  "githubEnvironment",
  "reviewedImageReference",
  "reviewedImageIndexDigest",
  "toolVersions",
  "sourceHashes",
  "completedAt",
] as const;

const EVIDENCE_KEYS = [
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
] as const;

const TOOL_VERSION_KEYS = ["postgres", "psql", "pgDump", "pgRestore"] as const;
const V9_TOOL_VERSION_KEYS = [...TOOL_VERSION_KEYS, "nodePostgres"] as const;
const HISTORICAL_SOURCE_HASH_KEYS = [
  "workflowSha256",
  "fixtureSha256",
  "migrationManifestSha256",
  "acceptanceRunnerSha256",
] as const;
const V4_SOURCE_HASH_KEYS = [
  ...HISTORICAL_SOURCE_HASH_KEYS,
  "projectionQuerySha256",
  "projectionNormalizerSha256",
] as const;
const V7_SOURCE_HASH_KEYS = [
  ...V4_SOURCE_HASH_KEYS,
  "platformBootstrapV2Sha256",
  "applicationMigrationManifestV2Sha256",
  "authenticatedMigrationRendererV2Sha256",
] as const;
const V8_SOURCE_HASH_KEYS = [
  ...V7_SOURCE_HASH_KEYS,
  "restorePlatformV1Sha256",
  "authenticatedBackupRestorePlanV1Sha256",
] as const;
const V9_SOURCE_HASH_KEYS = [
  ...V8_SOURCE_HASH_KEYS,
  "postgresProjectionAdapterSha256",
  "operationProjectionContractSha256",
  "databasePackageManifestSha256",
  "pnpmLockfileSha256",
] as const;

const SHA256_HEX = /^[0-9a-f]{64}$/;
const SHA1_HEX = /^[0-9a-f]{40}$/;
const POSITIVE_DECIMAL = /^[1-9][0-9]*$/;
const REPOSITORY =
  /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9_.-]{1,100}$/;
const IMAGE_REFERENCE =
  /^[a-z0-9.-]+(?::[0-9]+)?\/[a-z0-9._/-]+:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}@sha256:[0-9a-f]{64}$/;
const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type Environment = Readonly<Record<string, string | undefined>>;
type DataRecord = Readonly<Record<string, unknown>>;

export interface PostgresAcceptanceToolVersions {
  readonly postgres: string;
  readonly psql: string;
  readonly pgDump: string;
  readonly pgRestore: string;
}

export interface PostgresAcceptanceV9ToolVersions extends PostgresAcceptanceToolVersions {
  readonly nodePostgres: "8.23.0";
}

export interface HistoricalPostgresAcceptanceSourceHashes {
  readonly workflowSha256: string;
  readonly fixtureSha256: string;
  readonly migrationManifestSha256: string;
  readonly acceptanceRunnerSha256: string;
}

export interface PostgresAcceptanceSourceHashes extends HistoricalPostgresAcceptanceSourceHashes {
  readonly projectionQuerySha256: string;
  readonly projectionNormalizerSha256: string;
}

export interface PostgresAcceptanceV7SourceHashes extends PostgresAcceptanceSourceHashes {
  readonly platformBootstrapV2Sha256: string;
  readonly applicationMigrationManifestV2Sha256: string;
  readonly authenticatedMigrationRendererV2Sha256: string;
}

export interface PostgresAcceptanceV8SourceHashes extends PostgresAcceptanceV7SourceHashes {
  readonly restorePlatformV1Sha256: string;
  readonly authenticatedBackupRestorePlanV1Sha256: string;
}

export interface PostgresAcceptanceV9SourceHashes extends PostgresAcceptanceV8SourceHashes {
  readonly postgresProjectionAdapterSha256: string;
  readonly operationProjectionContractSha256: string;
  readonly databasePackageManifestSha256: string;
  readonly pnpmLockfileSha256: string;
}

export interface BuildPostgresAcceptanceEvidenceInput {
  /**
   * The complete environment may be supplied, but the builder reads only the
   * explicitly reviewed GitHub keys used by the public evidence schema.
   */
  readonly githubEnvironment: Environment;
  readonly reviewedImageReference: string;
  readonly reviewedImageIndexDigest: string;
  readonly toolVersions: PostgresAcceptanceV9ToolVersions;
  readonly sourceHashes: PostgresAcceptanceV9SourceHashes;
  readonly completedAt: string;
}

interface PostgresAcceptanceEvidenceFields<
  SourceHashes extends HistoricalPostgresAcceptanceSourceHashes,
  ToolVersions extends PostgresAcceptanceToolVersions =
    PostgresAcceptanceToolVersions,
> {
  readonly suite: "research-cockpit-postgresql-acceptance";
  readonly outcome: "passed";
  readonly job: "postgres-acceptance";
  readonly workflow: "PostgreSQL acceptance";
  readonly repository: string;
  readonly repositoryId: string;
  readonly commitSha: string;
  readonly runId: string;
  readonly runAttempt: number;
  readonly reviewedImageReference: string;
  readonly reviewedImageIndexDigest: string;
  readonly databaseName: "research_cockpit_acceptance_test";
  readonly serverVersionNumber: "170011";
  readonly serverVersion: "17.11";
  readonly toolVersions: ToolVersions;
  readonly sourceHashes: SourceHashes;
  readonly completedAt: string;
}

export interface PostgresAcceptanceEvidenceV1 extends PostgresAcceptanceEvidenceFields<HistoricalPostgresAcceptanceSourceHashes> {
  readonly schemaVersion: 1;
  readonly checksPassed: typeof POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED;
  readonly notProven: typeof POSTGRES_ACCEPTANCE_V1_NOT_PROVEN;
}

export interface PostgresAcceptanceEvidenceV2 extends PostgresAcceptanceEvidenceFields<HistoricalPostgresAcceptanceSourceHashes> {
  readonly schemaVersion: 2;
  readonly checksPassed: typeof POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED;
  readonly notProven: typeof POSTGRES_ACCEPTANCE_V2_NOT_PROVEN;
}

export interface PostgresAcceptanceEvidenceV3 extends PostgresAcceptanceEvidenceFields<HistoricalPostgresAcceptanceSourceHashes> {
  readonly schemaVersion: 3;
  readonly checksPassed: typeof POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED;
  readonly notProven: typeof POSTGRES_ACCEPTANCE_V3_NOT_PROVEN;
}

export interface PostgresAcceptanceEvidenceV4 extends PostgresAcceptanceEvidenceFields<PostgresAcceptanceSourceHashes> {
  readonly schemaVersion: 4;
  readonly checksPassed: typeof POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED;
  readonly notProven: typeof POSTGRES_ACCEPTANCE_V4_NOT_PROVEN;
}

export interface PostgresAcceptanceEvidenceV5 extends PostgresAcceptanceEvidenceFields<PostgresAcceptanceSourceHashes> {
  readonly schemaVersion: 5;
  readonly checksPassed: typeof POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED;
  readonly notProven: typeof POSTGRES_ACCEPTANCE_V5_NOT_PROVEN;
}

export interface PostgresAcceptanceEvidenceV6 extends PostgresAcceptanceEvidenceFields<PostgresAcceptanceSourceHashes> {
  readonly schemaVersion: 6;
  readonly checksPassed: typeof POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED;
  readonly notProven: typeof POSTGRES_ACCEPTANCE_V6_NOT_PROVEN;
}

export interface PostgresAcceptanceEvidenceV7 extends PostgresAcceptanceEvidenceFields<PostgresAcceptanceV7SourceHashes> {
  readonly schemaVersion: 7;
  readonly checksPassed: typeof POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED;
  readonly notProven: typeof POSTGRES_ACCEPTANCE_V7_NOT_PROVEN;
}

export interface PostgresAcceptanceEvidenceV8 extends PostgresAcceptanceEvidenceFields<PostgresAcceptanceV8SourceHashes> {
  readonly schemaVersion: 8;
  readonly checksPassed: typeof POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED;
  readonly notProven: typeof POSTGRES_ACCEPTANCE_V8_NOT_PROVEN;
}

export interface PostgresAcceptanceEvidenceV9 extends PostgresAcceptanceEvidenceFields<
  PostgresAcceptanceV9SourceHashes,
  PostgresAcceptanceV9ToolVersions
> {
  readonly schemaVersion: 9;
  readonly checksPassed: typeof POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED;
  readonly notProven: typeof POSTGRES_ACCEPTANCE_V9_NOT_PROVEN;
}

export type PostgresAcceptanceEvidence =
  | PostgresAcceptanceEvidenceV1
  | PostgresAcceptanceEvidenceV2
  | PostgresAcceptanceEvidenceV3
  | PostgresAcceptanceEvidenceV4
  | PostgresAcceptanceEvidenceV5
  | PostgresAcceptanceEvidenceV6
  | PostgresAcceptanceEvidenceV7
  | PostgresAcceptanceEvidenceV8
  | PostgresAcceptanceEvidenceV9;

export interface WrittenPostgresAcceptanceEvidence {
  readonly path: string;
  readonly byteLength: number;
  /** SHA-256 of the exact UTF-8 bytes written to `path`, without a prefix. */
  readonly sha256: string;
}

/** A stable error that deliberately contains no rejected field or value. */
export class PostgresAcceptanceEvidenceError extends Error {
  public readonly code = "INVALID_POSTGRES_ACCEPTANCE_EVIDENCE" as const;

  public constructor() {
    super("PostgreSQL acceptance evidence failed validation.");
    this.name = "PostgresAcceptanceEvidenceError";
  }
}

/**
 * Builds a success-only evidence record. The caller cannot supply the outcome,
 * check list, limitations, job identity, or workflow identity.
 */
export function buildPostgresAcceptanceEvidence(
  value: BuildPostgresAcceptanceEvidenceInput,
): PostgresAcceptanceEvidenceV9 {
  try {
    const input = exactPlainDataRecord(value, BUILD_INPUT_KEYS);
    const environment = environmentRecord(input.githubEnvironment);

    if (
      environmentValue(environment, "CI") !== "true" ||
      environmentValue(environment, "GITHUB_ACTIONS") !== "true" ||
      environmentValue(environment, "GITHUB_JOB") !== "postgres-acceptance" ||
      environmentValue(environment, "GITHUB_WORKFLOW") !==
        "PostgreSQL acceptance"
    ) {
      invalid();
    }

    const repository = githubRepository(
      environmentValue(environment, "GITHUB_REPOSITORY"),
    );
    const repositoryId = positiveDecimalString(
      environmentValue(environment, "GITHUB_REPOSITORY_ID"),
    );
    const commitSha = sha1(environmentValue(environment, "GITHUB_SHA"));
    const runId = positiveDecimalString(
      environmentValue(environment, "GITHUB_RUN_ID"),
    );
    const runAttempt = positiveSafeIntegerString(
      environmentValue(environment, "GITHUB_RUN_ATTEMPT"),
    );
    const reviewedImageIndexDigest = sha256Digest(
      input.reviewedImageIndexDigest,
    );
    const reviewedImageReference = imageReference(
      input.reviewedImageReference,
      reviewedImageIndexDigest,
    );
    const toolVersions = normalizeV9ToolVersions(input.toolVersions);
    const sourceHashes = normalizeV9SourceHashes(input.sourceHashes);
    const completedAt = canonicalTimestamp(input.completedAt);

    return freezeEvidence({
      schemaVersion: 9,
      suite: "research-cockpit-postgresql-acceptance",
      outcome: "passed",
      job: "postgres-acceptance",
      workflow: "PostgreSQL acceptance",
      repository,
      repositoryId,
      commitSha,
      runId,
      runAttempt,
      reviewedImageReference,
      reviewedImageIndexDigest,
      databaseName: "research_cockpit_acceptance_test",
      serverVersionNumber: "170011",
      serverVersion: "17.11",
      toolVersions,
      sourceHashes,
      checksPassed: POSTGRES_ACCEPTANCE_CHECKS_PASSED,
      notProven: POSTGRES_ACCEPTANCE_NOT_PROVEN,
      completedAt,
    });
  } catch {
    throw new PostgresAcceptanceEvidenceError();
  }
}

/** Parses JSON and reconstructs the canonical exact-schema evidence object. */
export function parsePostgresAcceptanceEvidence(
  serialized: string,
): PostgresAcceptanceEvidence {
  try {
    if (typeof serialized !== "string" || serialized.length > 32_768) {
      invalid();
    }
    return normalizeEvidence(JSON.parse(serialized) as unknown);
  } catch {
    throw new PostgresAcceptanceEvidenceError();
  }
}

/** Produces deterministic UTF-8 JSON text with a single terminal LF. */
export function serializePostgresAcceptanceEvidence(
  value: PostgresAcceptanceEvidence,
): string {
  try {
    return `${JSON.stringify(normalizeEvidence(value), null, 2)}\n`;
  } catch {
    throw new PostgresAcceptanceEvidenceError();
  }
}

/**
 * Atomically creates the one reviewed runner-temporary evidence file. A
 * pre-existing path is never replaced. The returned digest covers the exact
 * bytes passed to `writeFile`.
 */
export async function writePostgresAcceptanceEvidence(
  value: PostgresAcceptanceEvidenceV9,
  environment: Environment,
): Promise<WrittenPostgresAcceptanceEvidence> {
  let bytes: Buffer;
  let path: string;
  try {
    const normalized = normalizeEvidence(value);
    if (normalized.schemaVersion !== 9) invalid();
    bytes = Buffer.from(
      serializePostgresAcceptanceEvidence(normalized),
      "utf8",
    );
    const runnerTemp = runnerTemporaryDirectory(environment);
    path = resolve(runnerTemp, POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME);
  } catch {
    throw new PostgresAcceptanceEvidenceError();
  }

  await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
  return Object.freeze({
    path,
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

function normalizeEvidence(value: unknown): PostgresAcceptanceEvidence {
  const evidence = exactPlainDataRecord(value, EVIDENCE_KEYS);
  if (
    evidence.suite !== "research-cockpit-postgresql-acceptance" ||
    evidence.outcome !== "passed" ||
    evidence.job !== "postgres-acceptance" ||
    evidence.workflow !== "PostgreSQL acceptance" ||
    evidence.databaseName !== "research_cockpit_acceptance_test" ||
    evidence.serverVersionNumber !== "170011" ||
    evidence.serverVersion !== "17.11"
  ) {
    invalid();
  }

  const repository = githubRepository(evidence.repository);
  const repositoryId = positiveDecimalString(evidence.repositoryId);
  const commitSha = sha1(evidence.commitSha);
  const runId = positiveDecimalString(evidence.runId);
  const runAttempt = positiveSafeInteger(evidence.runAttempt);
  const reviewedImageIndexDigest = sha256Digest(
    evidence.reviewedImageIndexDigest,
  );
  const reviewedImageReference = imageReference(
    evidence.reviewedImageReference,
    reviewedImageIndexDigest,
  );
  const completedAt = canonicalTimestamp(evidence.completedAt);

  const common = {
    suite: "research-cockpit-postgresql-acceptance",
    outcome: "passed",
    job: "postgres-acceptance",
    workflow: "PostgreSQL acceptance",
    repository,
    repositoryId,
    commitSha,
    runId,
    runAttempt,
    reviewedImageReference,
    reviewedImageIndexDigest,
    databaseName: "research_cockpit_acceptance_test",
    serverVersionNumber: "170011",
    serverVersion: "17.11",
  } as const;

  if (evidence.schemaVersion === 1) {
    const sourceHashes = normalizeHistoricalSourceHashes(evidence.sourceHashes);
    exactLiteralArray(
      evidence.checksPassed,
      POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
    );
    exactLiteralArray(evidence.notProven, POSTGRES_ACCEPTANCE_V1_NOT_PROVEN);
    return freezeEvidence({
      schemaVersion: 1,
      ...common,
      toolVersions: normalizeToolVersions(evidence.toolVersions),
      sourceHashes,
      checksPassed: POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
      notProven: POSTGRES_ACCEPTANCE_V1_NOT_PROVEN,
      completedAt,
    });
  }

  if (evidence.schemaVersion === 2) {
    const sourceHashes = normalizeHistoricalSourceHashes(evidence.sourceHashes);
    exactLiteralArray(
      evidence.checksPassed,
      POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
    );
    exactLiteralArray(evidence.notProven, POSTGRES_ACCEPTANCE_V2_NOT_PROVEN);
    return freezeEvidence({
      schemaVersion: 2,
      ...common,
      toolVersions: normalizeToolVersions(evidence.toolVersions),
      sourceHashes,
      checksPassed: POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
      notProven: POSTGRES_ACCEPTANCE_V2_NOT_PROVEN,
      completedAt,
    });
  }

  if (evidence.schemaVersion === 3) {
    const sourceHashes = normalizeHistoricalSourceHashes(evidence.sourceHashes);
    exactLiteralArray(
      evidence.checksPassed,
      POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
    );
    exactLiteralArray(evidence.notProven, POSTGRES_ACCEPTANCE_V3_NOT_PROVEN);
    return freezeEvidence({
      schemaVersion: 3,
      ...common,
      toolVersions: normalizeToolVersions(evidence.toolVersions),
      sourceHashes,
      checksPassed: POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
      notProven: POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
      completedAt,
    });
  }

  if (evidence.schemaVersion === 4) {
    const sourceHashes = normalizeV4SourceHashes(evidence.sourceHashes);
    exactLiteralArray(
      evidence.checksPassed,
      POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED,
    );
    exactLiteralArray(evidence.notProven, POSTGRES_ACCEPTANCE_V4_NOT_PROVEN);
    return freezeEvidence({
      schemaVersion: 4,
      ...common,
      toolVersions: normalizeToolVersions(evidence.toolVersions),
      sourceHashes,
      checksPassed: POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED,
      notProven: POSTGRES_ACCEPTANCE_V4_NOT_PROVEN,
      completedAt,
    });
  }

  if (evidence.schemaVersion === 5) {
    const sourceHashes = normalizeV4SourceHashes(evidence.sourceHashes);
    exactLiteralArray(
      evidence.checksPassed,
      POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED,
    );
    exactLiteralArray(evidence.notProven, POSTGRES_ACCEPTANCE_V5_NOT_PROVEN);
    return freezeEvidence({
      schemaVersion: 5,
      ...common,
      toolVersions: normalizeToolVersions(evidence.toolVersions),
      sourceHashes,
      checksPassed: POSTGRES_ACCEPTANCE_V5_CHECKS_PASSED,
      notProven: POSTGRES_ACCEPTANCE_V5_NOT_PROVEN,
      completedAt,
    });
  }

  if (evidence.schemaVersion === 6) {
    const sourceHashes = normalizeV4SourceHashes(evidence.sourceHashes);
    exactLiteralArray(
      evidence.checksPassed,
      POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED,
    );
    exactLiteralArray(evidence.notProven, POSTGRES_ACCEPTANCE_V6_NOT_PROVEN);
    return freezeEvidence({
      schemaVersion: 6,
      ...common,
      toolVersions: normalizeToolVersions(evidence.toolVersions),
      sourceHashes,
      checksPassed: POSTGRES_ACCEPTANCE_V6_CHECKS_PASSED,
      notProven: POSTGRES_ACCEPTANCE_V6_NOT_PROVEN,
      completedAt,
    });
  }

  if (evidence.schemaVersion === 7) {
    const sourceHashes = normalizeV7SourceHashes(evidence.sourceHashes);
    exactLiteralArray(
      evidence.checksPassed,
      POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED,
    );
    exactLiteralArray(evidence.notProven, POSTGRES_ACCEPTANCE_V7_NOT_PROVEN);
    return freezeEvidence({
      schemaVersion: 7,
      ...common,
      toolVersions: normalizeToolVersions(evidence.toolVersions),
      sourceHashes,
      checksPassed: POSTGRES_ACCEPTANCE_V7_CHECKS_PASSED,
      notProven: POSTGRES_ACCEPTANCE_V7_NOT_PROVEN,
      completedAt,
    });
  }

  if (evidence.schemaVersion === 8) {
    const sourceHashes = normalizeV8SourceHashes(evidence.sourceHashes);
    exactLiteralArray(
      evidence.checksPassed,
      POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED,
    );
    exactLiteralArray(evidence.notProven, POSTGRES_ACCEPTANCE_V8_NOT_PROVEN);
    return freezeEvidence({
      schemaVersion: 8,
      ...common,
      toolVersions: normalizeToolVersions(evidence.toolVersions),
      sourceHashes,
      checksPassed: POSTGRES_ACCEPTANCE_V8_CHECKS_PASSED,
      notProven: POSTGRES_ACCEPTANCE_V8_NOT_PROVEN,
      completedAt,
    });
  }

  if (evidence.schemaVersion === 9) {
    const sourceHashes = normalizeV9SourceHashes(evidence.sourceHashes);
    exactLiteralArray(
      evidence.checksPassed,
      POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED,
    );
    exactLiteralArray(evidence.notProven, POSTGRES_ACCEPTANCE_V9_NOT_PROVEN);
    return freezeEvidence({
      schemaVersion: 9,
      ...common,
      toolVersions: normalizeV9ToolVersions(evidence.toolVersions),
      sourceHashes,
      checksPassed: POSTGRES_ACCEPTANCE_V9_CHECKS_PASSED,
      notProven: POSTGRES_ACCEPTANCE_V9_NOT_PROVEN,
      completedAt,
    });
  }

  invalid();
}

function normalizeToolVersions(value: unknown): PostgresAcceptanceToolVersions {
  const versions = exactPlainDataRecord(value, TOOL_VERSION_KEYS);
  return Object.freeze({
    postgres: toolVersion(versions.postgres, "postgres"),
    psql: toolVersion(versions.psql, "psql"),
    pgDump: toolVersion(versions.pgDump, "pg_dump"),
    pgRestore: toolVersion(versions.pgRestore, "pg_restore"),
  });
}

function normalizeV9ToolVersions(
  value: unknown,
): PostgresAcceptanceV9ToolVersions {
  const versions = exactPlainDataRecord(value, V9_TOOL_VERSION_KEYS);
  if (versions.nodePostgres !== "8.23.0") invalid();
  return Object.freeze({
    postgres: toolVersion(versions.postgres, "postgres"),
    psql: toolVersion(versions.psql, "psql"),
    pgDump: toolVersion(versions.pgDump, "pg_dump"),
    pgRestore: toolVersion(versions.pgRestore, "pg_restore"),
    nodePostgres: "8.23.0",
  });
}

function normalizeHistoricalSourceHashes(
  value: unknown,
): HistoricalPostgresAcceptanceSourceHashes {
  const hashes = exactPlainDataRecord(value, HISTORICAL_SOURCE_HASH_KEYS);
  return Object.freeze({
    workflowSha256: sha256Hex(hashes.workflowSha256),
    fixtureSha256: sha256Hex(hashes.fixtureSha256),
    migrationManifestSha256: sha256Hex(hashes.migrationManifestSha256),
    acceptanceRunnerSha256: sha256Hex(hashes.acceptanceRunnerSha256),
  });
}

function normalizeV4SourceHashes(
  value: unknown,
): PostgresAcceptanceSourceHashes {
  const hashes = exactPlainDataRecord(value, V4_SOURCE_HASH_KEYS);
  return Object.freeze({
    workflowSha256: sha256Hex(hashes.workflowSha256),
    fixtureSha256: sha256Hex(hashes.fixtureSha256),
    migrationManifestSha256: sha256Hex(hashes.migrationManifestSha256),
    acceptanceRunnerSha256: sha256Hex(hashes.acceptanceRunnerSha256),
    projectionQuerySha256: sha256Hex(hashes.projectionQuerySha256),
    projectionNormalizerSha256: sha256Hex(hashes.projectionNormalizerSha256),
  });
}

function normalizeV7SourceHashes(
  value: unknown,
): PostgresAcceptanceV7SourceHashes {
  const hashes = exactPlainDataRecord(value, V7_SOURCE_HASH_KEYS);
  return Object.freeze({
    workflowSha256: sha256Hex(hashes.workflowSha256),
    fixtureSha256: sha256Hex(hashes.fixtureSha256),
    migrationManifestSha256: sha256Hex(hashes.migrationManifestSha256),
    acceptanceRunnerSha256: sha256Hex(hashes.acceptanceRunnerSha256),
    projectionQuerySha256: sha256Hex(hashes.projectionQuerySha256),
    projectionNormalizerSha256: sha256Hex(hashes.projectionNormalizerSha256),
    platformBootstrapV2Sha256: sha256Hex(hashes.platformBootstrapV2Sha256),
    applicationMigrationManifestV2Sha256: sha256Hex(
      hashes.applicationMigrationManifestV2Sha256,
    ),
    authenticatedMigrationRendererV2Sha256: sha256Hex(
      hashes.authenticatedMigrationRendererV2Sha256,
    ),
  });
}

function normalizeV8SourceHashes(
  value: unknown,
): PostgresAcceptanceV8SourceHashes {
  const hashes = exactPlainDataRecord(value, V8_SOURCE_HASH_KEYS);
  return Object.freeze({
    workflowSha256: sha256Hex(hashes.workflowSha256),
    fixtureSha256: sha256Hex(hashes.fixtureSha256),
    migrationManifestSha256: sha256Hex(hashes.migrationManifestSha256),
    acceptanceRunnerSha256: sha256Hex(hashes.acceptanceRunnerSha256),
    projectionQuerySha256: sha256Hex(hashes.projectionQuerySha256),
    projectionNormalizerSha256: sha256Hex(hashes.projectionNormalizerSha256),
    platformBootstrapV2Sha256: sha256Hex(hashes.platformBootstrapV2Sha256),
    applicationMigrationManifestV2Sha256: sha256Hex(
      hashes.applicationMigrationManifestV2Sha256,
    ),
    authenticatedMigrationRendererV2Sha256: sha256Hex(
      hashes.authenticatedMigrationRendererV2Sha256,
    ),
    restorePlatformV1Sha256: sha256Hex(hashes.restorePlatformV1Sha256),
    authenticatedBackupRestorePlanV1Sha256: sha256Hex(
      hashes.authenticatedBackupRestorePlanV1Sha256,
    ),
  });
}

function normalizeV9SourceHashes(
  value: unknown,
): PostgresAcceptanceV9SourceHashes {
  const hashes = exactPlainDataRecord(value, V9_SOURCE_HASH_KEYS);
  return Object.freeze({
    workflowSha256: sha256Hex(hashes.workflowSha256),
    fixtureSha256: sha256Hex(hashes.fixtureSha256),
    migrationManifestSha256: sha256Hex(hashes.migrationManifestSha256),
    acceptanceRunnerSha256: sha256Hex(hashes.acceptanceRunnerSha256),
    projectionQuerySha256: sha256Hex(hashes.projectionQuerySha256),
    projectionNormalizerSha256: sha256Hex(hashes.projectionNormalizerSha256),
    platformBootstrapV2Sha256: sha256Hex(hashes.platformBootstrapV2Sha256),
    applicationMigrationManifestV2Sha256: sha256Hex(
      hashes.applicationMigrationManifestV2Sha256,
    ),
    authenticatedMigrationRendererV2Sha256: sha256Hex(
      hashes.authenticatedMigrationRendererV2Sha256,
    ),
    restorePlatformV1Sha256: sha256Hex(hashes.restorePlatformV1Sha256),
    authenticatedBackupRestorePlanV1Sha256: sha256Hex(
      hashes.authenticatedBackupRestorePlanV1Sha256,
    ),
    postgresProjectionAdapterSha256: sha256Hex(
      hashes.postgresProjectionAdapterSha256,
    ),
    operationProjectionContractSha256: sha256Hex(
      hashes.operationProjectionContractSha256,
    ),
    databasePackageManifestSha256: sha256Hex(
      hashes.databasePackageManifestSha256,
    ),
    pnpmLockfileSha256: sha256Hex(hashes.pnpmLockfileSha256),
  });
}

function freezeEvidence<const Evidence extends PostgresAcceptanceEvidence>(
  evidence: Evidence,
): Evidence {
  return Object.freeze(evidence);
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
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      invalid();
    }
  }
  return value as DataRecord & {
    readonly [Key in Keys[number]]: unknown;
  };
}

function environmentRecord(value: unknown): object {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid();
  }
  return value;
}

function environmentValue(environment: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(environment, key);
  if (!descriptor?.enumerable || !("value" in descriptor)) {
    invalid();
  }
  return descriptor.value;
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

function positiveSafeIntegerString(value: unknown): number {
  if (typeof value !== "string" || !POSITIVE_DECIMAL.test(value)) {
    invalid();
  }
  return positiveSafeInteger(Number(value));
}

function positiveSafeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    invalid();
  }
  return value;
}

function sha1(value: unknown): string {
  if (typeof value !== "string" || !SHA1_HEX.test(value)) invalid();
  return value;
}

function sha256Hex(value: unknown): string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) invalid();
  return value;
}

function sha256Digest(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("sha256:") ||
    !SHA256_HEX.test(value.slice("sha256:".length))
  ) {
    invalid();
  }
  return value;
}

function imageReference(value: unknown, digest: string): string {
  if (
    typeof value !== "string" ||
    value.length > 512 ||
    !IMAGE_REFERENCE.test(value) ||
    !value.endsWith(`@${digest}`)
  ) {
    invalid();
  }
  return value;
}

function toolVersion(value: unknown, executable: string): string {
  if (
    typeof value !== "string" ||
    value.length > 240 ||
    !new RegExp(
      `^${escapeRegExp(executable)} \\(PostgreSQL\\) 17\\.11(?: [\\x20-\\x7e]+)?$`,
    ).test(value)
  ) {
    invalid();
  }
  return value;
}

function canonicalTimestamp(value: unknown): string {
  if (
    typeof value !== "string" ||
    !CANONICAL_UTC_TIMESTAMP.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value
  ) {
    invalid();
  }
  return value;
}

function exactLiteralArray(value: unknown, expected: readonly string[]): void {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    invalid();
  }
  const keys = Reflect.ownKeys(value);
  const expectedKeys = [...expected.map((_, index) => String(index)), "length"];
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    keys.length !== expectedKeys.length ||
    keys.some(
      (key) => typeof key !== "string" || !expectedKeys.includes(key),
    ) ||
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.value !== expected.length ||
    expected.some((literal, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      return (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        descriptor.value !== literal
      );
    })
  ) {
    invalid();
  }
}

function runnerTemporaryDirectory(environment: Environment): string {
  const value = environmentValue(environmentRecord(environment), "RUNNER_TEMP");
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 4_096 ||
    value.trim() !== value ||
    containsControlCharacter(value) ||
    !isAbsolute(value)
  ) {
    invalid();
  }
  return value;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function invalid(): never {
  throw new Error("invalid");
}
