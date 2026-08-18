import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Client, Pool, type PoolClient } from "pg";

import type {
  FinancialFact,
  OperationProjectionQuery,
  OperationProjectionSourceResult,
  ProjectionOperation,
} from "@research-cockpit/research-core";

import {
  CLEAN_BOOTSTRAP_DATABASE_NAME,
  maskSqlQuotedContent,
  renderReviewedCleanBootstrap,
} from "./clean-bootstrap";
import { loadMigrationFiles } from "./check-migrations";
import {
  AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY,
  AUTHENTICATED_MIGRATION_IDENTITY_MARKER,
  AUTHENTICATED_MIGRATION_DATABASE_NAME,
  AUTHENTICATED_MIGRATION_ROLE_RESET_MARKER,
  AUTHENTICATED_MIGRATOR_LOGIN_ROLE,
  expectedAuthenticatedMigrationLedgerRows,
  loadAuthenticatedMigrationPlan,
  renderAuthenticatedApplicationMigration,
  renderAuthenticatedPlatformMigration,
  type AuthenticatedMigrationLedgerRow,
  type AuthenticatedMigrationDatabaseName,
  type AuthenticatedMigrationPlan,
} from "./authenticated-migration-plan";
import {
  POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE,
  PostgresMigrationDeployer,
  PostgresMigrationDeploymentError,
  renderAuthenticatedMigrationV2PrefixFiveReconstruction,
  type PostgresMigrationDeploymentResult,
} from "./postgres-migration-deployer";
import {
  AUTHENTICATED_BACKUP_ARCHIVE,
  AUTHENTICATED_BACKUP_CAPABILITY_ROLE,
  AUTHENTICATED_BACKUP_LOGIN_ROLE,
  AUTHENTICATED_BACKUP_NO_RLS_ARCHIVE,
  AUTHENTICATED_BACKUP_NO_ROLE_ARCHIVE,
  AUTHENTICATED_BACKUP_PASSFILE,
  AUTHENTICATED_BACKUP_RESTORABLE_TABLES,
  AUTHENTICATED_BACKUP_WRONG_PASSFILE,
  AUTHENTICATED_BACKUP_WRONG_PASSWORD_ARCHIVE,
  AUTHENTICATED_RESTORE_CAPABILITY_ROLE,
  AUTHENTICATED_RESTORE_DATABASE,
  AUTHENTICATED_RESTORE_FAILURE_MESSAGE,
  AUTHENTICATED_RESTORE_FAILURE_TABLE,
  AUTHENTICATED_RESTORE_LOGIN_ROLE,
  AUTHENTICATED_RESTORE_PASSFILE,
  AUTHENTICATED_RESTORE_WRONG_PASSFILE,
  assertAuthenticatedBackupWrongPasswordRejection,
  assertAuthenticatedRestoreWrongPasswordRejection,
  buildAuthenticatedBackupDumpInvocation,
  buildAuthenticatedBackupPsqlInvocation,
  buildAuthenticatedRestoreInvocation,
  buildAuthenticatedRestorePsqlInvocation,
  generateAuthenticatedBackupRestorePassword,
  loadAuthenticatedBackupRestorePlan,
  parseAuthenticatedBackupArchiveToc,
  renderAuthenticatedBackupBackendDrainSql,
  renderAuthenticatedBackupCleanupSql,
  renderAuthenticatedBackupFingerprintQueries,
  renderAuthenticatedBackupPassfile,
  renderAuthenticatedBackupProvisioningSql,
  renderAuthenticatedRestoreBackendDrainSql,
  renderAuthenticatedRestoreCleanupSql,
  renderAuthenticatedRestoreFailureCleanupSql,
  renderAuthenticatedRestoreFailureCreateSql,
  renderAuthenticatedRestoreFailureResidueSql,
  renderAuthenticatedRestorePassfile,
  renderAuthenticatedRestorePlatform,
  renderAuthenticatedRestoreProvisioningSql,
  renderCreateAuthenticatedRestoreDatabaseSql,
  renderDropAuthenticatedRestoreDatabaseSql,
  renderRestorableApplicationTablesEmptySql,
  type AuthenticatedBackupRestorePlan,
} from "./authenticated-backup-restore-plan";
import {
  buildPostgresAcceptanceEvidence,
  POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME,
  writePostgresAcceptanceEvidence,
  type PostgresAcceptanceV11SourceHashes,
  type PostgresAcceptanceV11ToolVersions,
} from "./postgres-acceptance-evidence";
import {
  normalizePostgresFinancialFactProjectionRows,
  parsePostgresFinancialFactProjectionRows,
  postgresProjectionOperationContext,
  renderPostgresFinancialFactProjectionQuery,
} from "./postgres-projection-query";
import {
  PostgresFinancialFactProjectionSource,
  PostgresProjectionAdapterError,
  type PostgresProjectionActorContext,
} from "./postgres-projection-adapter";
import {
  PooledPostgresFinancialFactProjectionSource,
  PostgresProjectionPoolError,
} from "./postgres-projection-pool";

const acceptanceRunnerPath = fileURLToPath(import.meta.url);
const packageRoot = join(dirname(acceptanceRunnerPath), "..");
const repositoryRoot = join(packageRoot, "..", "..");
const nodePostgresPackagePath = createRequire(import.meta.url).resolve(
  "pg/package.json",
);
const nodePostgresPoolEntryPath = createRequire(
  nodePostgresPackagePath,
).resolve("pg-pool");
const nodePostgresPoolPackagePath = join(
  dirname(nodePostgresPoolEntryPath),
  "package.json",
);
const imageConfigPath = join(packageRoot, "acceptance", "postgres-image.json");
const migrationManifestPath = join(packageRoot, "migration-manifest.json");
const workflowPath = join(
  repositoryRoot,
  ".github",
  "workflows",
  "postgres-acceptance.yml",
);
const syntheticFixturePath = join(
  packageRoot,
  "acceptance",
  "synthetic-fixture.sql",
);
const projectionQueryPath = join(
  packageRoot,
  "src",
  "postgres-projection-query.ts",
);
const projectionNormalizerPath = join(
  packageRoot,
  "src",
  "projection-normalization.ts",
);
const platformBootstrapV2Path = join(
  packageRoot,
  "migration-plans",
  "v2",
  "platform-bootstrap.sql",
);
const applicationMigrationManifestV2Path = join(
  packageRoot,
  "migration-plans",
  "v2",
  "application-manifest.json",
);
const authenticatedMigrationRendererV2Path = join(
  packageRoot,
  "src",
  "authenticated-migration-plan.ts",
);
const restorePlatformV1Path = join(
  packageRoot,
  "backup-restore-plans",
  "v1",
  "restore-platform.sql",
);
const authenticatedBackupRestorePlanV1Path = join(
  packageRoot,
  "src",
  "authenticated-backup-restore-plan.ts",
);
const postgresProjectionAdapterPath = join(
  packageRoot,
  "src",
  "postgres-projection-adapter.ts",
);
const postgresProjectionPoolAdapterPath = join(
  packageRoot,
  "src",
  "postgres-projection-pool.ts",
);
const postgresMigrationDeployerPath = join(
  packageRoot,
  "src",
  "postgres-migration-deployer.ts",
);
const operationProjectionContractPath = join(
  repositoryRoot,
  "modules",
  "research-core",
  "src",
  "projection-contract.ts",
);
const databasePackageManifestPath = join(packageRoot, "package.json");
const pnpmLockfilePath = join(repositoryRoot, "pnpm-lock.yaml");

const EXPECTED_IMAGE_REFERENCE =
  "docker.io/library/postgres:17.11-bookworm@sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad";
const EXPECTED_SERVER_VERSION = "17.11";
const EXPECTED_UPLOAD_ARTIFACT_ACTION =
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a";
const EXPECTED_EVIDENCE_ARTIFACT_NAME =
  "postgres-acceptance-evidence-v11-${{ github.sha }}-${{ github.run_attempt }}";
const EXPECTED_EVIDENCE_ARTIFACT_PATH = `\${{ runner.temp }}/${POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME}`;
const EXPECTED_NODE_POSTGRES_VERSION = "8.23.0" as const;
const EXPECTED_NODE_POSTGRES_POOL_VERSION = "3.14.0" as const;
const POSTGRES_PROJECTION_ADAPTER_APPLICATION_NAME =
  "research-cockpit-b9-acceptance" as const;
const POSTGRES_PROJECTION_POOL_APPLICATION_NAME =
  "research-cockpit-b10-pool" as const;
const POSTGRES_PROJECTION_POOL_BLOCKER_APPLICATION_NAME =
  "research-cockpit-b10-lock-blocker" as const;
const POSTGRES_PROJECTION_POOL_MAX = 2 as const;
const POSTGRES_PROJECTION_POOL_CONNECTION_TIMEOUT_MILLISECONDS = 500;
const POSTGRES_PROJECTION_POOL_STATEMENT_TIMEOUT_MILLISECONDS = 3_000;
const POSTGRES_PROJECTION_POOL_BLOCKED_BACKEND_DEADLINE_MILLISECONDS =
  POSTGRES_PROJECTION_POOL_STATEMENT_TIMEOUT_MILLISECONDS -
  POSTGRES_PROJECTION_POOL_CONNECTION_TIMEOUT_MILLISECONDS -
  1_000;
const POSTGRES_MIGRATION_DEPLOYER_ADMIN_PASSWORD =
  "postgres-acceptance-only" as const;
const POSTGRES_MIGRATION_DEPLOYER_APPLICATION_A =
  "research-cockpit-b11-deployer-a" as const;
const POSTGRES_MIGRATION_DEPLOYER_APPLICATION_B =
  "research-cockpit-b11-deployer-b" as const;
const POSTGRES_MIGRATION_DEPLOYER_BARRIER_APPLICATION =
  "research-cockpit-b11-ledger-barrier" as const;
const POSTGRES_MIGRATION_DEPLOYER_BLOCKED_DEADLINE_MILLISECONDS = 2_000;
const POSTGRES_MIGRATION_DEPLOYER_DRIFT_SHA256 = "0".repeat(64);
export const RUNTIME_AUTH_LOGIN_ROLE =
  "research_cockpit_runtime_login" as const;
export const RUNTIME_AUTH_CAPABILITY_ROLE = "research_cockpit_runtime" as const;
export const RUNTIME_AUTH_PASSFILE =
  "/tmp/research-cockpit-runtime-login.pgpass" as const;
export const RUNTIME_AUTH_WRONG_PASSFILE =
  "/tmp/research-cockpit-runtime-login-wrong.pgpass" as const;
export const TEST_LOADER_AUTH_LOGIN_ROLE =
  "research_cockpit_test_loader_login" as const;
export const TEST_LOADER_AUTH_CAPABILITY_ROLE =
  "research_cockpit_test_seed" as const;
export const TEST_LOADER_AUTH_PASSFILE =
  "/tmp/research-cockpit-test-loader-login.pgpass" as const;
export const TEST_LOADER_AUTH_WRONG_PASSFILE =
  "/tmp/research-cockpit-test-loader-login-wrong.pgpass" as const;
export const OWNER_DDL_AUTH_LOGIN_ROLE =
  "research_cockpit_owner_ddl_login" as const;
export const OWNER_DDL_AUTH_CAPABILITY_ROLE = "research_cockpit_owner" as const;
export const OWNER_DDL_AUTH_PASSFILE =
  "/tmp/research-cockpit-owner-ddl-login.pgpass" as const;
export const OWNER_DDL_AUTH_WRONG_PASSFILE =
  "/tmp/research-cockpit-owner-ddl-login-wrong.pgpass" as const;
export const MIGRATOR_AUTH_LOGIN_ROLE = AUTHENTICATED_MIGRATOR_LOGIN_ROLE;
export const MIGRATOR_AUTH_CAPABILITY_ROLE = "research_cockpit_owner" as const;
export const MIGRATOR_AUTH_PASSFILE =
  "/tmp/research-cockpit-migrator-login.pgpass" as const;
export const MIGRATOR_AUTH_WRONG_PASSFILE =
  "/tmp/research-cockpit-migrator-login-wrong.pgpass" as const;
export const MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE =
  POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE;
export const MIGRATION_DEPLOYER_AUTH_CAPABILITY_ROLE =
  "research_cockpit_owner" as const;
export const AUTHENTICATED_BACKUP_FORBIDDEN_SET_ROLES = Object.freeze([
  "research_cockpit_owner",
  "research_cockpit_runtime",
  "research_cockpit_test_seed",
  "postgres",
] as const);
export const AUTHENTICATED_RESTORE_FORBIDDEN_SET_ROLES = Object.freeze([
  "research_cockpit_owner",
  "research_cockpit_runtime",
  "research_cockpit_backup",
  "postgres",
] as const);
const AUTHENTICATED_BACKUP_MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;
const AUTHENTICATED_BACKUP_ARCHIVE_PATHS = Object.freeze([
  AUTHENTICATED_BACKUP_ARCHIVE,
  AUTHENTICATED_BACKUP_NO_ROLE_ARCHIVE,
  AUTHENTICATED_BACKUP_NO_RLS_ARCHIVE,
  AUTHENTICATED_BACKUP_WRONG_PASSWORD_ARCHIVE,
] as const);
const AUTHENTICATED_BACKUP_RESTORE_FILE_PATHS = Object.freeze([
  AUTHENTICATED_BACKUP_PASSFILE,
  AUTHENTICATED_BACKUP_WRONG_PASSFILE,
  AUTHENTICATED_RESTORE_PASSFILE,
  AUTHENTICATED_RESTORE_WRONG_PASSFILE,
  ...AUTHENTICATED_BACKUP_ARCHIVE_PATHS,
] as const);
export const OWNER_DDL_AUTH_CANARY_TABLE =
  "private_data.b6_owner_ddl_canary" as const;
export const OWNER_DDL_AUTH_FORBIDDEN_SET_ROLES = Object.freeze([
  "research_cockpit_runtime",
  "research_cockpit_test_seed",
  "research_cockpit_backup",
  "postgres",
] as const);
export const OWNER_DDL_AUTH_FORBIDDEN_SESSION_AUTHORIZATION_ROLES =
  Object.freeze([
    "research_cockpit_owner",
    "research_cockpit_runtime",
    "research_cockpit_test_seed",
    "research_cockpit_backup",
    "postgres",
  ] as const);
export const MIGRATOR_AUTH_FORBIDDEN_SET_ROLES = Object.freeze([
  "research_cockpit_runtime",
  "research_cockpit_test_seed",
  "research_cockpit_backup",
  "postgres",
] as const);
export const MIGRATOR_AUTH_FORBIDDEN_SESSION_AUTHORIZATION_ROLES =
  Object.freeze([
    "research_cockpit_owner",
    "research_cockpit_runtime",
    "research_cockpit_test_seed",
    "research_cockpit_backup",
    "postgres",
  ] as const);
export const TEST_LOADER_AUTH_FORBIDDEN_SET_ROLES = Object.freeze([
  "research_cockpit_owner",
  "research_cockpit_runtime",
  "research_cockpit_backup",
  "postgres",
] as const);
export const RUNTIME_AUTH_FORBIDDEN_SET_ROLES = Object.freeze([
  "research_cockpit_owner",
  "research_cockpit_test_seed",
  "research_cockpit_backup",
  "postgres",
] as const);
const BASE64URL_RUNTIME_AUTH_PASSWORD = /^[A-Za-z0-9_-]+$/;
const REVIEWED_FIXTURE_PREFIX = `SET SESSION AUTHORIZATION ${TEST_LOADER_AUTH_CAPABILITY_ROLE};

BEGIN;

`;
const REVIEWED_FIXTURE_SUFFIX = `

COMMIT;

RESET SESSION AUTHORIZATION;
`;
const TEST_LOADER_AUTH_IDENTITY_MARKER = `b5-test-loader-identity|${TEST_LOADER_AUTH_LOGIN_ROLE}|${TEST_LOADER_AUTH_CAPABILITY_ROLE}|scram-sha-256:${TEST_LOADER_AUTH_LOGIN_ROLE}`;
const TEST_LOADER_AUTH_RESET_MARKER = `b5-test-loader-reset|${TEST_LOADER_AUTH_LOGIN_ROLE}|${TEST_LOADER_AUTH_LOGIN_ROLE}|scram-sha-256:${TEST_LOADER_AUTH_LOGIN_ROLE}`;
const OWNER_DDL_AUTH_IDENTITY_MARKER = `b6-owner-ddl-identity|${OWNER_DDL_AUTH_LOGIN_ROLE}|${OWNER_DDL_AUTH_CAPABILITY_ROLE}|scram-sha-256:${OWNER_DDL_AUTH_LOGIN_ROLE}`;
const OWNER_DDL_AUTH_CATALOG_MARKER = `b6-owner-ddl-catalog|${OWNER_DDL_AUTH_CANARY_TABLE}|${OWNER_DDL_AUTH_CAPABILITY_ROLE}|no-non-owner-acl`;
const OWNER_DDL_AUTH_RESET_MARKER = `b6-owner-ddl-reset|${OWNER_DDL_AUTH_LOGIN_ROLE}|${OWNER_DDL_AUTH_LOGIN_ROLE}|scram-sha-256:${OWNER_DDL_AUTH_LOGIN_ROLE}`;
const OWNER_DDL_AUTH_DROP_MARKER = `b6-owner-ddl-drop|${OWNER_DDL_AUTH_CANARY_TABLE}|absent`;
const CAPABILITY_ROLES = [
  "research_cockpit_backup",
  "research_cockpit_owner",
  "research_cockpit_runtime",
  "research_cockpit_test_seed",
] as const;
const CATALOG_FALSE = "false";
const CATALOG_TRUE = "true";
export const EXPECTED_CAPABILITY_ROLE_ATTRIBUTE_ROWS = Object.freeze(
  CAPABILITY_ROLES.map((role) =>
    [role, ...Array<string>(7).fill(CATALOG_FALSE)].join("|"),
  ),
);
const APPLICATION_TABLES = [
  "private_data.alert_rules",
  "private_data.audit_events",
  "private_data.entitlements",
  "private_data.idempotency_records",
  "private_data.memberships",
  "private_data.organization_principals",
  "private_data.organizations",
  "private_data.principals",
  "private_data.resource_id_registry",
  "private_data.theses",
  "shared_data.evidence",
  "shared_data.exchanges",
  "shared_data.financial_facts",
  "shared_data.issuers",
  "shared_data.listings",
  "shared_data.metric_definitions",
  "shared_data.rights_grants",
  "shared_data.rights_policies",
  "shared_data.schema_migrations",
  "shared_data.securities",
  "shared_data.share_classes",
  "shared_data.symbol_history",
] as const;
const LEGACY_MIGRATION_LEDGER_ROWS = Object.freeze([
  "0001|0001_schemas_context_and_ledger.sql|e46088d6915fda15fdbc281c48463b7f9478effc90d8aa26d5fcfe84cf6c4890",
  "0002|0002_canonical_entities.sql|41e8164fb29c1d823f4bc65b600dbea6ed5e96d0256f77c7604baf8c2ff6c1ef",
  "0003|0003_temporal_constraints_and_indexes.sql|c3d9dc4c015b3727e98f66e0ab4440a0fcd95821e1863fcf2953f82dc2601dc8",
  "0004|0004_row_security_and_runtime_grants.sql|179188d037fc671c891f0d2d81f5df4748d839a943a2734a7f176f6759271282",
  "0005|0005_non_reusable_resource_ids.sql|a537000c692ea246e8bce9dd5aaa73a576127455aa0ba412db5cbfdf3161889a",
  "0006|0006_null_safe_request_context.sql|1b6ab85eff6dab4a9016278233a333b9d1f819b1d29828c916ad314198146c07",
  "0007|0007_database_privilege_lockdown.sql|7887f8066cff3b0bf22397a2f5ee19352c1c678a7619b6588a5c95e28430c0e6",
]);
const PROTECTED_TABLES = APPLICATION_TABLES.filter(
  (table) => table !== "shared_data.schema_migrations",
);
const RUNTIME_SELECT_TABLES = APPLICATION_TABLES.filter(
  (table) =>
    table !== "private_data.audit_events" &&
    table !== "shared_data.schema_migrations",
);
const RUNTIME_EXECUTE_ROUTINES = [
  "private_data.current_channel",
  "private_data.current_data_classification",
  "private_data.current_organization_id",
  "private_data.current_principal_id",
  "private_data.current_purpose",
  "private_data.current_territory",
  "private_data.has_active_entitlement",
  "private_data.has_active_membership",
  "private_data.set_request_context",
  "shared_data.rights_allow_current_use",
] as const;
const OWNED_APPLICATION_ROUTINES = [
  ...RUNTIME_EXECUTE_ROUTINES,
  "private_data.guard_live_resource_identity",
  "private_data.guard_resource_id_registry",
  "private_data.tombstone_resource_id_after_delete",
].sort();
const EXPECTED_CONSTRAINT_COUNTS = [
  "private_data.alert_rules|c|6",
  "private_data.alert_rules|f|6",
  "private_data.alert_rules|p|1",
  "private_data.audit_events|c|9",
  "private_data.audit_events|f|2",
  "private_data.audit_events|p|1",
  "private_data.entitlements|c|3",
  "private_data.entitlements|f|2",
  "private_data.entitlements|p|1",
  "private_data.entitlements|u|1",
  "private_data.idempotency_records|c|7",
  "private_data.idempotency_records|f|2",
  "private_data.idempotency_records|p|1",
  "private_data.memberships|c|3",
  "private_data.memberships|f|1",
  "private_data.memberships|p|1",
  "private_data.memberships|x|1",
  "private_data.organization_principals|c|1",
  "private_data.organization_principals|f|2",
  "private_data.organization_principals|p|1",
  "private_data.organizations|c|3",
  "private_data.organizations|p|1",
  "private_data.organizations|u|1",
  "private_data.principals|c|3",
  "private_data.principals|p|1",
  "private_data.principals|u|1",
  "private_data.resource_id_registry|c|5",
  "private_data.resource_id_registry|f|1",
  "private_data.resource_id_registry|p|1",
  "private_data.resource_id_registry|u|1",
  "private_data.theses|c|7",
  "private_data.theses|f|5",
  "private_data.theses|p|1",
  "shared_data.evidence|c|7",
  "shared_data.evidence|f|1",
  "shared_data.evidence|p|1",
  "shared_data.evidence|u|1",
  "shared_data.exchanges|c|4",
  "shared_data.exchanges|p|1",
  "shared_data.exchanges|u|1",
  "shared_data.financial_facts|c|13",
  "shared_data.financial_facts|f|2",
  "shared_data.financial_facts|p|1",
  "shared_data.financial_facts|x|1",
  "shared_data.issuers|c|3",
  "shared_data.issuers|p|1",
  "shared_data.listings|c|4",
  "shared_data.listings|f|2",
  "shared_data.listings|p|1",
  "shared_data.metric_definitions|c|7",
  "shared_data.metric_definitions|p|1",
  "shared_data.rights_grants|c|2",
  "shared_data.rights_grants|f|1",
  "shared_data.rights_grants|p|1",
  "shared_data.rights_policies|c|3",
  "shared_data.rights_policies|p|1",
  "shared_data.schema_migrations|c|1",
  "shared_data.schema_migrations|p|1",
  "shared_data.schema_migrations|u|1",
  "shared_data.securities|c|4",
  "shared_data.securities|f|1",
  "shared_data.securities|p|1",
  "shared_data.share_classes|c|2",
  "shared_data.share_classes|f|1",
  "shared_data.share_classes|p|1",
  "shared_data.symbol_history|c|4",
  "shared_data.symbol_history|f|1",
  "shared_data.symbol_history|p|1",
  "shared_data.symbol_history|x|1",
] as const;

const ORGANIZATION_ALPHA = "10000000-0000-4000-8000-000000000001";
const ORGANIZATION_BETA = "10000000-0000-4000-8000-000000000002";
const PRINCIPAL_ALPHA = "20000000-0000-4000-8000-000000000001";
const PRINCIPAL_BETA = "20000000-0000-4000-8000-000000000002";
const PRINCIPAL_INACTIVE = "20000000-0000-4000-8000-000000000003";
const PRINCIPAL_NO_MEMBERSHIP = "20000000-0000-4000-8000-000000000004";
const PRINCIPAL_EXPIRED = "20000000-0000-4000-8000-000000000005";
const PRINCIPAL_FUTURE = "20000000-0000-4000-8000-000000000006";
const POSTGRES_PROJECTION_LISTING_ID = "listing-syn1";
const POSTGRES_PROJECTION_MISSING_LISTING_ID = "listing-missing";
const POSTGRES_PROJECTION_PUBLIC_KNOWN_AT = "2025-01-01T00:00:01.000Z";
const POSTGRES_PROJECTION_PRE_PUBLIC_KNOWN_AT = "2024-12-31T23:59:59.999Z";
const POSTGRES_PROJECTION_SYSTEM_RECORDED_AT = "2025-01-01T00:00:02.000Z";
const POSTGRES_PROJECTION_EVALUATED_AT = "2026-08-17T12:00:00.000Z";
const POSTGRES_PROJECTION_PREPARED_STATEMENT = "b4_financial_fact_projection";
const POSTGRES_PROJECTION_IDENTITY_MARKER = `b4-projection-identity|${RUNTIME_AUTH_LOGIN_ROLE}|${RUNTIME_AUTH_CAPABILITY_ROLE}|scram-sha-256:${RUNTIME_AUTH_LOGIN_ROLE}`;

interface RuntimeProjectionExpectedCandidate {
  readonly rowId: string;
  readonly conceptKey: string;
  readonly value: string;
  readonly evidenceId: string;
  readonly rightsPolicyId: string;
}

interface RuntimeProjectionAcceptanceCase {
  readonly label: string;
  readonly principalId: string;
  readonly organizationId: string;
  readonly query: OperationProjectionQuery;
  readonly expectedCandidates: readonly RuntimeProjectionExpectedCandidate[];
  readonly expectedPolicyIds: readonly string[];
}

interface AuthenticatedBackupTableFingerprint {
  readonly table: (typeof AUTHENTICATED_BACKUP_RESTORABLE_TABLES)[number];
  readonly rowCount: number;
  readonly sha256: string;
}

interface MigrationDeployerLedgerRow {
  readonly migrationId: string;
  readonly fileName: string;
  readonly sha256: string;
  readonly appliedAt: string;
  readonly appliedBy: string;
}

interface MigrationDeployerProcedureState {
  readonly oid: number;
  readonly owner: string;
  readonly source: string;
  readonly accessControlFingerprint: string;
  readonly configuration: string;
  readonly securityDefiner: boolean;
  readonly kind: string;
}

interface MigrationDeployerTargetState {
  readonly ledger: readonly MigrationDeployerLedgerRow[];
  readonly procedure: MigrationDeployerProcedureState;
}

interface MigrationDeployerClientState {
  readonly backendPid: number;
  readonly sessionUser: string;
  readonly currentUser: string;
  readonly systemUser: string;
  readonly applicationName: string;
  readonly transactionReadOnly: string;
  readonly ssl: boolean;
}

interface AcceptanceImageConfig {
  schemaVersion: 1;
  repository: "docker.io/library/postgres";
  tag: "17.11-bookworm";
  indexDigest: `sha256:${string}`;
  reference: string;
  mediaType: "application/vnd.oci.image.index.v1+json";
  expectedServerVersion: "17.11";
  expectedServerVersionNumber: 170011;
  databaseName: typeof CLEAN_BOOTSTRAP_DATABASE_NAME;
  workflowSha256: string;
  fixtureSha256: string;
  verifiedOn: string;
  runner: {
    label: "ubuntu-24.04";
    os: "linux";
    architecture: "amd64";
  };
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface PostgresProjectionAdapterEndpoint {
  readonly host: "127.0.0.1";
  readonly port: number;
}

export interface RuntimeAuthPsqlInvocation {
  environment: Readonly<Record<string, string>>;
  command: readonly string[];
}

export interface RuntimeAuthPsqlInvocationOptions {
  readonly requireScram?: boolean;
  readonly verboseErrors?: boolean;
}

export interface TestLoaderAuthPsqlInvocation {
  environment: Readonly<Record<string, string>>;
  command: readonly string[];
}

export interface TestLoaderAuthPsqlInvocationOptions {
  readonly requireScram?: boolean;
  readonly verboseErrors?: boolean;
}

export interface OwnerDdlAuthPsqlInvocation {
  environment: Readonly<Record<string, string>>;
  command: readonly string[];
}

export interface OwnerDdlAuthPsqlInvocationOptions {
  readonly requireScram?: boolean;
  readonly verboseErrors?: boolean;
}

export interface MigratorAuthPsqlInvocation {
  environment: Readonly<Record<string, string>>;
  command: readonly string[];
}

export interface MigratorAuthPsqlInvocationOptions {
  readonly requireScram?: boolean;
  readonly verboseErrors?: boolean;
  readonly databaseName?: AuthenticatedMigrationDatabaseName;
}

export interface RuntimeAuthBestEffortOperation {
  label: string;
  run: () => Promise<void>;
}

export interface RuntimeAuthOperationFailure {
  label: string;
  error: unknown;
}

export interface PsqlFailureExpectation {
  label: string;
  sqlState: string;
  message: string;
}

interface PrivateVisibility {
  principalIds: string;
  membershipIds: string;
  associationIds: string;
  organizationIds: string;
  entitlementIds: string;
  thesisIds: string;
  alertIds: string;
  idempotencyIds: string;
  registryIds: string;
  evidenceIds: string;
}

export type RuntimeAuthorizationMatrixMode = "impersonated" | "authenticated";

interface RuntimeAuthorizationMatrixClient {
  readonly mode: RuntimeAuthorizationMatrixMode;
  readonly scalar: (sql: string) => Promise<string>;
}

export interface AcceptanceArtifacts {
  config: unknown;
  workflow: string;
  fixture: string;
}

export function generateRuntimeAuthPassword(): string {
  return randomBytes(32).toString("base64url");
}

export function renderRuntimeAuthProvisioningSql(password: string): string {
  return renderRuntimeAuthProvisioningSqlWithConnectionLimit(password, 1);
}

export function renderPostgresProjectionPoolProvisioningSql(
  password: string,
): string {
  return renderRuntimeAuthProvisioningSqlWithConnectionLimit(
    password,
    POSTGRES_PROJECTION_POOL_MAX,
  );
}

function renderRuntimeAuthProvisioningSqlWithConnectionLimit(
  password: string,
  connectionLimit: 1 | typeof POSTGRES_PROJECTION_POOL_MAX,
): string {
  assertRuntimeAuthPassword(password);
  return `BEGIN;
SET LOCAL log_statement = 'none';
SET LOCAL log_min_error_statement = 'panic';
SET LOCAL log_duration = off;
SET LOCAL log_min_duration_statement = -1;
SET LOCAL log_min_duration_sample = -1;
SET LOCAL log_statement_sample_rate = 0;
SET LOCAL log_transaction_sample_rate = 0;
SET LOCAL password_encryption = 'scram-sha-256';
CREATE ROLE ${RUNTIME_AUTH_LOGIN_ROLE}
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOINHERIT
  NOBYPASSRLS
  CONNECTION LIMIT ${connectionLimit}
  PASSWORD '${password}';
GRANT ${RUNTIME_AUTH_CAPABILITY_ROLE}
  TO ${RUNTIME_AUTH_LOGIN_ROLE}
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
COMMIT;
`;
}

export function renderRuntimeAuthPassfile(password: string): string {
  assertRuntimeAuthPassword(password);
  return `127.0.0.1:5432:${CLEAN_BOOTSTRAP_DATABASE_NAME}:${RUNTIME_AUTH_LOGIN_ROLE}:${password}\n`;
}

export function renderRuntimeAuthCleanupSql(): string {
  return `BEGIN;
DROP ROLE IF EXISTS ${RUNTIME_AUTH_LOGIN_ROLE};
COMMIT;
`;
}

export function renderRuntimeAuthBackendDrainSql(): string {
  return `DO $runtime_auth_backend_drain$
DECLARE
  deadline timestamptz := pg_catalog.clock_timestamp() + interval '5 seconds';
BEGIN
  LOOP
    PERFORM pg_catalog.pg_stat_clear_snapshot();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_stat_activity
      WHERE usename = '${RUNTIME_AUTH_LOGIN_ROLE}'
        AND backend_type = 'client backend'
    );
    IF pg_catalog.clock_timestamp() >= deadline THEN
      RAISE EXCEPTION 'ephemeral runtime login backend did not drain'
        USING ERRCODE = '55000';
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
END;
$runtime_auth_backend_drain$;
`;
}

export function buildRuntimeAuthPsqlInvocation(
  passfile: typeof RUNTIME_AUTH_PASSFILE | typeof RUNTIME_AUTH_WRONG_PASSFILE,
  options: RuntimeAuthPsqlInvocationOptions = {},
): RuntimeAuthPsqlInvocation {
  const { requireScram = true, verboseErrors = false } = options;
  const environment: Record<string, string> = {
    PGPASSFILE: passfile,
    PGSSLMODE: "disable",
    PGCONNECT_TIMEOUT: "5",
  };
  if (requireScram) {
    // libpq treats an empty PGREQUIREAUTH as configured during request
    // enforcement, so the negative-password probe must omit it entirely.
    environment.PGREQUIREAUTH = "scram-sha-256";
  }

  return Object.freeze({
    environment: Object.freeze(environment),
    command: Object.freeze([
      "psql",
      "--no-psqlrc",
      "--no-password",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      ...(verboseErrors ? ["--set=VERBOSITY=verbose"] : []),
      "--host=127.0.0.1",
      "--port=5432",
      `--username=${RUNTIME_AUTH_LOGIN_ROLE}`,
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ]),
  });
}

export function assertRuntimeWrongPasswordRejection(
  result: CommandResult,
): void {
  if (result.exitCode === 0) {
    throw new Error(
      "Wrong-password runtime authentication unexpectedly succeeded",
    );
  }
  if (result.exitCode !== 2) {
    throw new Error(
      "Wrong-password runtime authentication returned an unexpected exit code",
    );
  }
  if (result.stdout.trim() !== "") {
    throw new Error(
      "Wrong-password runtime authentication returned unexpected output",
    );
  }

  const diagnostic = result.stderr.toLowerCase().replace(/\s+/g, " ");
  if (
    !diagnostic.includes(
      `fatal: password authentication failed for user "${RUNTIME_AUTH_LOGIN_ROLE}"`,
    )
  ) {
    throw new Error(
      "Wrong-password runtime authentication did not return the expected rejection",
    );
  }
}

export function generateTestLoaderAuthPassword(): string {
  return randomBytes(32).toString("base64url");
}

export function renderTestLoaderAuthProvisioningSql(password: string): string {
  assertTestLoaderAuthPassword(password);
  return `BEGIN;
SET LOCAL log_statement = 'none';
SET LOCAL log_min_error_statement = 'panic';
SET LOCAL log_duration = off;
SET LOCAL log_min_duration_statement = -1;
SET LOCAL log_min_duration_sample = -1;
SET LOCAL log_statement_sample_rate = 0;
SET LOCAL log_transaction_sample_rate = 0;
SET LOCAL password_encryption = 'scram-sha-256';
CREATE ROLE ${TEST_LOADER_AUTH_LOGIN_ROLE}
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOINHERIT
  NOBYPASSRLS
  CONNECTION LIMIT 1
  PASSWORD '${password}';
GRANT ${TEST_LOADER_AUTH_CAPABILITY_ROLE}
  TO ${TEST_LOADER_AUTH_LOGIN_ROLE}
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
COMMIT;
`;
}

export function renderTestLoaderAuthPassfile(password: string): string {
  assertTestLoaderAuthPassword(password);
  return `127.0.0.1:5432:${CLEAN_BOOTSTRAP_DATABASE_NAME}:${TEST_LOADER_AUTH_LOGIN_ROLE}:${password}\n`;
}

export function renderTestLoaderAuthCleanupSql(): string {
  return `BEGIN;
DROP ROLE IF EXISTS ${TEST_LOADER_AUTH_LOGIN_ROLE};
COMMIT;
`;
}

export function renderTestLoaderAuthBackendDrainSql(): string {
  return `DO $test_loader_auth_backend_drain$
DECLARE
  deadline timestamptz := pg_catalog.clock_timestamp() + interval '5 seconds';
BEGIN
  LOOP
    PERFORM pg_catalog.pg_stat_clear_snapshot();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_stat_activity
      WHERE usename = '${TEST_LOADER_AUTH_LOGIN_ROLE}'
        AND backend_type = 'client backend'
    );
    IF pg_catalog.clock_timestamp() >= deadline THEN
      RAISE EXCEPTION 'ephemeral test-loader login backend did not drain'
        USING ERRCODE = '55000';
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
END;
$test_loader_auth_backend_drain$;
`;
}

export function buildTestLoaderAuthPsqlInvocation(
  passfile:
    typeof TEST_LOADER_AUTH_PASSFILE | typeof TEST_LOADER_AUTH_WRONG_PASSFILE,
  options: TestLoaderAuthPsqlInvocationOptions = {},
): TestLoaderAuthPsqlInvocation {
  const { requireScram = true, verboseErrors = false } = options;
  const environment: Record<string, string> = {
    PGPASSFILE: passfile,
    PGSSLMODE: "disable",
    PGCONNECT_TIMEOUT: "5",
  };
  if (requireScram) environment.PGREQUIREAUTH = "scram-sha-256";

  return Object.freeze({
    environment: Object.freeze(environment),
    command: Object.freeze([
      "psql",
      "--no-psqlrc",
      "--no-password",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      ...(verboseErrors ? ["--set=VERBOSITY=verbose"] : []),
      "--host=127.0.0.1",
      "--port=5432",
      `--username=${TEST_LOADER_AUTH_LOGIN_ROLE}`,
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ]),
  });
}

export function assertTestLoaderWrongPasswordRejection(
  result: CommandResult,
): void {
  if (result.exitCode === 0) {
    throw new Error(
      "Wrong-password test-loader authentication unexpectedly succeeded",
    );
  }
  if (result.exitCode !== 2) {
    throw new Error(
      "Wrong-password test-loader authentication returned an unexpected exit code",
    );
  }
  if (result.stdout.trim() !== "") {
    throw new Error(
      "Wrong-password test-loader authentication returned unexpected output",
    );
  }

  const diagnostic = result.stderr.toLowerCase().replace(/\s+/g, " ");
  if (
    !diagnostic.includes(
      `fatal: password authentication failed for user "${TEST_LOADER_AUTH_LOGIN_ROLE}"`,
    )
  ) {
    throw new Error(
      "Wrong-password test-loader authentication did not return the expected rejection",
    );
  }
}

export function generateOwnerDdlAuthPassword(): string {
  return randomBytes(32).toString("base64url");
}

export function renderOwnerDdlAuthProvisioningSql(password: string): string {
  assertOwnerDdlAuthPassword(password);
  return `BEGIN;
SET LOCAL log_statement = 'none';
SET LOCAL log_min_error_statement = 'panic';
SET LOCAL log_duration = off;
SET LOCAL log_min_duration_statement = -1;
SET LOCAL log_min_duration_sample = -1;
SET LOCAL log_statement_sample_rate = 0;
SET LOCAL log_transaction_sample_rate = 0;
SET LOCAL password_encryption = 'scram-sha-256';
CREATE ROLE ${OWNER_DDL_AUTH_LOGIN_ROLE}
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOINHERIT
  NOBYPASSRLS
  CONNECTION LIMIT 1
  PASSWORD '${password}';
GRANT ${OWNER_DDL_AUTH_CAPABILITY_ROLE}
  TO ${OWNER_DDL_AUTH_LOGIN_ROLE}
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
COMMIT;
`;
}

export function renderOwnerDdlAuthPassfile(password: string): string {
  assertOwnerDdlAuthPassword(password);
  return `127.0.0.1:5432:${CLEAN_BOOTSTRAP_DATABASE_NAME}:${OWNER_DDL_AUTH_LOGIN_ROLE}:${password}\n`;
}

export function renderOwnerDdlAuthCleanupSql(): string {
  return `BEGIN;
DROP ROLE IF EXISTS ${OWNER_DDL_AUTH_LOGIN_ROLE};
COMMIT;
`;
}

export function renderOwnerDdlAuthCanaryCleanupSql(): string {
  return `BEGIN;
DROP TABLE IF EXISTS ${OWNER_DDL_AUTH_CANARY_TABLE};
COMMIT;
`;
}

export function renderOwnerDdlAuthBackendDrainSql(): string {
  return `DO $owner_ddl_auth_backend_drain$
DECLARE
  deadline timestamptz := pg_catalog.clock_timestamp() + interval '5 seconds';
BEGIN
  LOOP
    PERFORM pg_catalog.pg_stat_clear_snapshot();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_stat_activity
      WHERE usename = '${OWNER_DDL_AUTH_LOGIN_ROLE}'
        AND backend_type = 'client backend'
    );
    IF pg_catalog.clock_timestamp() >= deadline THEN
      RAISE EXCEPTION 'ephemeral owner-DDL login backend did not drain'
        USING ERRCODE = '55000';
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
END;
$owner_ddl_auth_backend_drain$;
`;
}

export function buildOwnerDdlAuthPsqlInvocation(
  passfile:
    typeof OWNER_DDL_AUTH_PASSFILE | typeof OWNER_DDL_AUTH_WRONG_PASSFILE,
  options: OwnerDdlAuthPsqlInvocationOptions = {},
): OwnerDdlAuthPsqlInvocation {
  const { requireScram = true, verboseErrors = false } = options;
  const environment: Record<string, string> = {
    PGPASSFILE: passfile,
    PGSSLMODE: "disable",
    PGCONNECT_TIMEOUT: "5",
  };
  if (requireScram) environment.PGREQUIREAUTH = "scram-sha-256";

  return Object.freeze({
    environment: Object.freeze(environment),
    command: Object.freeze([
      "psql",
      "--no-psqlrc",
      "--no-password",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      ...(verboseErrors ? ["--set=VERBOSITY=verbose"] : []),
      "--host=127.0.0.1",
      "--port=5432",
      `--username=${OWNER_DDL_AUTH_LOGIN_ROLE}`,
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ]),
  });
}

export function assertOwnerDdlWrongPasswordRejection(
  result: CommandResult,
): void {
  if (result.exitCode === 0) {
    throw new Error(
      "Wrong-password owner-DDL authentication unexpectedly succeeded",
    );
  }
  if (result.exitCode !== 2) {
    throw new Error(
      "Wrong-password owner-DDL authentication returned an unexpected exit code",
    );
  }
  if (result.stdout.trim() !== "") {
    throw new Error(
      "Wrong-password owner-DDL authentication returned unexpected output",
    );
  }

  const diagnostic = result.stderr.toLowerCase().replace(/\s+/g, " ");
  if (
    !diagnostic.includes(
      `fatal: password authentication failed for user "${OWNER_DDL_AUTH_LOGIN_ROLE}"`,
    )
  ) {
    throw new Error(
      "Wrong-password owner-DDL authentication did not return the expected rejection",
    );
  }
}

export function generateMigratorAuthPassword(): string {
  return randomBytes(32).toString("base64url");
}

export function renderMigratorAuthProvisioningSql(password: string): string {
  assertMigratorAuthPassword(password);
  return `BEGIN;
SET LOCAL log_statement = 'none';
SET LOCAL log_min_error_statement = 'panic';
SET LOCAL log_duration = off;
SET LOCAL log_min_duration_statement = -1;
SET LOCAL log_min_duration_sample = -1;
SET LOCAL log_statement_sample_rate = 0;
SET LOCAL log_transaction_sample_rate = 0;
SET LOCAL password_encryption = 'scram-sha-256';
CREATE ROLE ${MIGRATOR_AUTH_LOGIN_ROLE}
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOINHERIT
  NOBYPASSRLS
  CONNECTION LIMIT 1
  PASSWORD '${password}';
GRANT ${MIGRATOR_AUTH_CAPABILITY_ROLE}
  TO ${MIGRATOR_AUTH_LOGIN_ROLE}
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
COMMIT;
`;
}

export function renderMigratorAuthPassfile(
  password: string,
  databaseName: AuthenticatedMigrationDatabaseName = AUTHENTICATED_MIGRATION_DATABASE_NAME,
): string {
  assertMigratorAuthPassword(password);
  return `127.0.0.1:5432:${databaseName}:${MIGRATOR_AUTH_LOGIN_ROLE}:${password}\n`;
}

export function renderMigratorAuthCleanupSql(): string {
  return `BEGIN;
DROP ROLE IF EXISTS ${MIGRATOR_AUTH_LOGIN_ROLE};
COMMIT;
`;
}

export function renderMigratorAuthBackendDrainSql(): string {
  return `DO $migrator_auth_backend_drain$
DECLARE
  deadline timestamptz := pg_catalog.clock_timestamp() + interval '5 seconds';
BEGIN
  LOOP
    PERFORM pg_catalog.pg_stat_clear_snapshot();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_stat_activity
      WHERE usename = '${MIGRATOR_AUTH_LOGIN_ROLE}'
        AND backend_type = 'client backend'
    );
    IF pg_catalog.clock_timestamp() >= deadline THEN
      RAISE EXCEPTION 'ephemeral migrator login backend did not drain'
        USING ERRCODE = '55000';
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
END;
$migrator_auth_backend_drain$;
`;
}

export function buildMigratorAuthPsqlInvocation(
  passfile: typeof MIGRATOR_AUTH_PASSFILE | typeof MIGRATOR_AUTH_WRONG_PASSFILE,
  options: MigratorAuthPsqlInvocationOptions = {},
): MigratorAuthPsqlInvocation {
  const {
    requireScram = true,
    verboseErrors = false,
    databaseName = AUTHENTICATED_MIGRATION_DATABASE_NAME,
  } = options;
  const environment: Record<string, string> = {
    PGPASSFILE: passfile,
    PGSSLMODE: "disable",
    PGCONNECT_TIMEOUT: "5",
  };
  if (requireScram) environment.PGREQUIREAUTH = "scram-sha-256";

  return Object.freeze({
    environment: Object.freeze(environment),
    command: Object.freeze([
      "psql",
      "--no-psqlrc",
      "--no-password",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      ...(verboseErrors ? ["--set=VERBOSITY=verbose"] : []),
      "--host=127.0.0.1",
      "--port=5432",
      `--username=${MIGRATOR_AUTH_LOGIN_ROLE}`,
      `--dbname=${databaseName}`,
    ]),
  });
}

export function assertMigratorWrongPasswordRejection(
  result: CommandResult,
): void {
  if (result.exitCode === 0) {
    throw new Error(
      "Wrong-password migrator authentication unexpectedly succeeded",
    );
  }
  if (result.exitCode !== 2) {
    throw new Error(
      "Wrong-password migrator authentication returned an unexpected exit code",
    );
  }
  if (result.stdout.trim() !== "") {
    throw new Error(
      "Wrong-password migrator authentication returned unexpected output",
    );
  }

  const diagnostic = result.stderr.toLowerCase().replace(/\s+/g, " ");
  if (
    !diagnostic.includes(
      `fatal: password authentication failed for user "${MIGRATOR_AUTH_LOGIN_ROLE}"`,
    )
  ) {
    throw new Error(
      "Wrong-password migrator authentication did not return the expected rejection",
    );
  }
}

export function generateMigrationDeployerAuthPassword(): string {
  return randomBytes(32).toString("base64url");
}

export function renderMigrationDeployerAuthProvisioningSql(
  password: string,
): string {
  assertMigrationDeployerAuthPassword(password);
  return `BEGIN;
SET LOCAL log_statement = 'none';
SET LOCAL log_min_error_statement = 'panic';
SET LOCAL log_duration = off;
SET LOCAL log_min_duration_statement = -1;
SET LOCAL log_min_duration_sample = -1;
SET LOCAL log_statement_sample_rate = 0;
SET LOCAL log_transaction_sample_rate = 0;
SET LOCAL password_encryption = 'scram-sha-256';
CREATE ROLE ${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOINHERIT
  NOBYPASSRLS
  CONNECTION LIMIT 2
  PASSWORD '${password}';
GRANT ${MIGRATION_DEPLOYER_AUTH_CAPABILITY_ROLE}
  TO ${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
COMMIT;
`;
}

export function renderMigrationDeployerAuthCleanupSql(): string {
  return `BEGIN;
DROP ROLE IF EXISTS ${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE};
COMMIT;
`;
}

export function renderMigrationDeployerAuthBackendDrainSql(): string {
  return `DO $migration_deployer_auth_backend_drain$
DECLARE
  deadline timestamptz := pg_catalog.clock_timestamp() + interval '5 seconds';
BEGIN
  LOOP
    PERFORM pg_catalog.pg_stat_clear_snapshot();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_stat_activity
      WHERE usename = '${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}'
        AND backend_type = 'client backend'
    );
    IF pg_catalog.clock_timestamp() >= deadline THEN
      RAISE EXCEPTION 'ephemeral migration deployer login backend did not drain'
        USING ERRCODE = '55000';
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
END;
$migration_deployer_auth_backend_drain$;
`;
}

export function renderAuthenticatedOwnerDdlCanaryCreateSql(): string {
  return renderAuthenticatedOwnerDdlCanaryCreate(false);
}

export function renderAuthenticatedOwnerDdlCanaryRollbackProbeSql(): string {
  return renderAuthenticatedOwnerDdlCanaryCreate(true);
}

export function renderAuthenticatedOwnerDdlCanaryDropSql(): string {
  return `BEGIN;
SET LOCAL ROLE ${OWNER_DDL_AUTH_CAPABILITY_ROLE};
DROP TABLE ${OWNER_DDL_AUTH_CANARY_TABLE};
SELECT CASE
  WHEN session_user = '${OWNER_DDL_AUTH_LOGIN_ROLE}'
    AND current_user = '${OWNER_DDL_AUTH_CAPABILITY_ROLE}'
    AND system_user = 'scram-sha-256:${OWNER_DDL_AUTH_LOGIN_ROLE}'
    AND pg_catalog.to_regclass('${OWNER_DDL_AUTH_CANARY_TABLE}') IS NULL
  THEN '${OWNER_DDL_AUTH_DROP_MARKER}'
  ELSE 'b6-owner-ddl-drop-invalid'
END;
COMMIT;
${renderOwnerDdlResetMarkerSql()}`;
}

export function assertAuthenticatedOwnerDdlCanaryCreateResult(
  result: CommandResult,
): void {
  if (result.exitCode !== 0 || result.stderr.trim() !== "") {
    throw new Error("Authenticated owner-DDL canary create failed");
  }
  if (
    !sameStrings(splitLines(result.stdout), [
      OWNER_DDL_AUTH_IDENTITY_MARKER,
      OWNER_DDL_AUTH_CATALOG_MARKER,
      OWNER_DDL_AUTH_RESET_MARKER,
    ])
  ) {
    throw new Error(
      "Authenticated owner-DDL canary create markers are invalid",
    );
  }
}

export function assertAuthenticatedOwnerDdlCanaryRollbackFailure(
  result: CommandResult,
): void {
  if (
    result.exitCode !== 3 ||
    !result.stderr.includes("22012") ||
    !result.stderr.toLowerCase().includes("division by zero") ||
    /\b(?:warning|notice):/i.test(result.stderr)
  ) {
    throw new Error(
      "Authenticated owner-DDL canary rollback probe failed for the wrong reason",
    );
  }
  if (
    !sameStrings(splitLines(result.stdout), [
      OWNER_DDL_AUTH_IDENTITY_MARKER,
      OWNER_DDL_AUTH_CATALOG_MARKER,
    ])
  ) {
    throw new Error(
      "Authenticated owner-DDL canary rollback probe returned invalid markers",
    );
  }
}

export function assertAuthenticatedOwnerDdlCanaryDropResult(
  result: CommandResult,
): void {
  if (result.exitCode !== 0 || result.stderr.trim() !== "") {
    throw new Error("Authenticated owner-DDL canary drop failed");
  }
  if (
    !sameStrings(splitLines(result.stdout), [
      OWNER_DDL_AUTH_DROP_MARKER,
      OWNER_DDL_AUTH_RESET_MARKER,
    ])
  ) {
    throw new Error("Authenticated owner-DDL canary drop markers are invalid");
  }
}

function renderAuthenticatedOwnerDdlCanaryCreate(
  injectFailure: boolean,
): string {
  const failure = injectFailure ? "\nSELECT 1 / 0;" : "";
  return `BEGIN;
SET LOCAL ROLE ${OWNER_DDL_AUTH_CAPABILITY_ROLE};
SELECT CASE
  WHEN session_user = '${OWNER_DDL_AUTH_LOGIN_ROLE}'
    AND current_user = '${OWNER_DDL_AUTH_CAPABILITY_ROLE}'
    AND system_user = 'scram-sha-256:${OWNER_DDL_AUTH_LOGIN_ROLE}'
  THEN '${OWNER_DDL_AUTH_IDENTITY_MARKER}'
  ELSE 'b6-owner-ddl-identity-invalid'
END;
CREATE TABLE ${OWNER_DDL_AUTH_CANARY_TABLE} (
  canary_id integer NOT NULL,
  marker text NOT NULL,
  CONSTRAINT b6_owner_ddl_canary_pkey PRIMARY KEY (canary_id),
  CONSTRAINT b6_owner_ddl_canary_marker_check
    CHECK (marker = 'synthetic-owner-ddl-canary')
);
SELECT CASE
  WHEN (
    SELECT count(*) = 1
      AND pg_catalog.bool_and(
        pg_catalog.pg_get_userbyid(class.relowner) = '${OWNER_DDL_AUTH_CAPABILITY_ROLE}'
        AND class.relkind = 'r'
        AND class.relpersistence = 'p'
      )
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'private_data'
      AND class.relname = 'b6_owner_ddl_canary'
  )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = class.relnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        coalesce(class.relacl, pg_catalog.acldefault('r', class.relowner))
      ) AS privilege
      WHERE namespace.nspname = 'private_data'
        AND class.relname = 'b6_owner_ddl_canary'
        AND privilege.grantee <> class.relowner
    )
  THEN '${OWNER_DDL_AUTH_CATALOG_MARKER}'
  ELSE 'b6-owner-ddl-catalog-invalid'
END;${failure}
COMMIT;
${renderOwnerDdlResetMarkerSql()}`;
}

function renderOwnerDdlResetMarkerSql(): string {
  return `SELECT CASE
  WHEN session_user = '${OWNER_DDL_AUTH_LOGIN_ROLE}'
    AND current_user = session_user
    AND system_user = 'scram-sha-256:${OWNER_DDL_AUTH_LOGIN_ROLE}'
  THEN '${OWNER_DDL_AUTH_RESET_MARKER}'
  ELSE 'b6-owner-ddl-reset-invalid'
END;`;
}

export function extractReviewedSyntheticFixtureBody(
  fixtureSql: string,
): string {
  const normalized = fixtureSql.replaceAll("\r\n", "\n");
  if (normalized.includes("\r")) invalidSyntheticFixtureEnvelope();
  if (
    !normalized.startsWith(REVIEWED_FIXTURE_PREFIX) ||
    !normalized.endsWith(REVIEWED_FIXTURE_SUFFIX)
  ) {
    invalidSyntheticFixtureEnvelope();
  }
  if (inspectInsertOnlyFixture(normalized).length > 0) {
    invalidSyntheticFixtureEnvelope();
  }

  const body = normalized.slice(
    REVIEWED_FIXTURE_PREFIX.length,
    normalized.length - REVIEWED_FIXTURE_SUFFIX.length,
  );
  const visible = maskSqlQuotedContent(body);
  if (
    body.length === 0 ||
    visible.includes("\\") ||
    /\b(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET|RESET|COPY|SELECT|WITH|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO|RETURNING)\b/i.test(
      visible,
    ) ||
    /\bON\s+CONFLICT\b/i.test(visible)
  ) {
    invalidSyntheticFixtureEnvelope();
  }
  for (const statement of visible
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)) {
    if (
      !/^INSERT\s+INTO\s+[a-z_]+\.[a-z_]+\s*\([\s\S]+\)\s*VALUES\b/i.test(
        statement,
      )
    ) {
      invalidSyntheticFixtureEnvelope();
    }
  }
  return body;
}

export function renderAuthenticatedTestLoaderFixtureSql(
  fixtureSql: string,
): string {
  return renderAuthenticatedTestLoaderFixture(
    extractReviewedSyntheticFixtureBody(fixtureSql),
    false,
  );
}

export function renderAuthenticatedTestLoaderFixtureRollbackProbeSql(
  fixtureSql: string,
): string {
  return renderAuthenticatedTestLoaderFixture(
    extractReviewedSyntheticFixtureBody(fixtureSql),
    true,
  );
}

export function assertAuthenticatedTestLoaderFixtureResult(
  result: CommandResult,
): void {
  if (result.exitCode !== 0 || result.stderr.trim() !== "") {
    throw new Error("Authenticated test-loader fixture execution failed");
  }
  if (
    !sameStrings(splitLines(result.stdout), [
      TEST_LOADER_AUTH_IDENTITY_MARKER,
      TEST_LOADER_AUTH_RESET_MARKER,
    ])
  ) {
    throw new Error("Authenticated test-loader fixture markers are invalid");
  }
}

export function assertAuthenticatedTestLoaderFixtureRollbackFailure(
  result: CommandResult,
): void {
  if (
    result.exitCode !== 3 ||
    !result.stderr.includes("22012") ||
    !result.stderr.toLowerCase().includes("division by zero")
  ) {
    throw new Error(
      "Authenticated test-loader rollback probe failed for the wrong reason",
    );
  }
  if (
    !sameStrings(splitLines(result.stdout), [TEST_LOADER_AUTH_IDENTITY_MARKER])
  ) {
    throw new Error(
      "Authenticated test-loader rollback probe returned invalid markers",
    );
  }
}

function renderAuthenticatedTestLoaderFixture(
  body: string,
  injectFailure: boolean,
): string {
  const failure = injectFailure ? "\nSELECT 1 / 0;" : "";
  return `BEGIN;
SET LOCAL ROLE ${TEST_LOADER_AUTH_CAPABILITY_ROLE};
SELECT CASE
  WHEN session_user = '${TEST_LOADER_AUTH_LOGIN_ROLE}'
    AND current_user = '${TEST_LOADER_AUTH_CAPABILITY_ROLE}'
    AND system_user = 'scram-sha-256:${TEST_LOADER_AUTH_LOGIN_ROLE}'
  THEN '${TEST_LOADER_AUTH_IDENTITY_MARKER}'
  ELSE 'b5-test-loader-identity-invalid'
END;
${body}${failure}
COMMIT;
SELECT CASE
  WHEN session_user = '${TEST_LOADER_AUTH_LOGIN_ROLE}'
    AND current_user = session_user
    AND system_user = 'scram-sha-256:${TEST_LOADER_AUTH_LOGIN_ROLE}'
  THEN '${TEST_LOADER_AUTH_RESET_MARKER}'
  ELSE 'b5-test-loader-reset-invalid'
END;`;
}

function invalidSyntheticFixtureEnvelope(): never {
  throw new Error("Reviewed synthetic fixture envelope is invalid");
}

export async function collectRuntimeAuthOperationFailures(
  operations: readonly RuntimeAuthBestEffortOperation[],
): Promise<RuntimeAuthOperationFailure[]> {
  const failures: RuntimeAuthOperationFailure[] = [];
  for (const operation of operations) {
    try {
      await operation.run();
    } catch (error) {
      failures.push({ label: operation.label, error });
    }
  }
  return failures;
}

export async function runRuntimeAuthCommandWithDrain<T>(
  runCommand: () => Promise<T>,
  drainBackends: () => Promise<void>,
): Promise<T> {
  let result: T;
  try {
    result = await runCommand();
  } catch (commandError) {
    try {
      await drainBackends();
    } catch (drainError) {
      throw new AggregateError(
        [commandError, drainError],
        "Runtime-auth command and backend drain both failed",
        { cause: drainError },
      );
    }
    throw commandError;
  }

  await drainBackends();
  return result;
}

function throwRuntimeAuthOperationFailures(
  failures: readonly RuntimeAuthOperationFailure[],
  message: string,
): void {
  if (failures.length === 0) return;

  const errors = failures.map(
    ({ label, error }) => new Error(`${label} failed`, { cause: error }),
  );
  throw new AggregateError(errors, message, { cause: errors[0] });
}

export async function checkPostgresAcceptanceHarness(
  root = repositoryRoot,
): Promise<string[]> {
  const config = JSON.parse(
    await readFile(
      join(root, "packages", "db", "acceptance", "postgres-image.json"),
      "utf8",
    ),
  ) as unknown;
  const workflow = await readFile(
    join(root, ".github", "workflows", "postgres-acceptance.yml"),
    "utf8",
  );
  const fixture = await readFile(
    join(root, "packages", "db", "acceptance", "synthetic-fixture.sql"),
    "utf8",
  );
  return inspectPostgresAcceptanceHarness({ config, workflow, fixture });
}

export function inspectPostgresAcceptanceHarness(
  artifacts: AcceptanceArtifacts,
): string[] {
  const violations: string[] = [];
  let config: AcceptanceImageConfig | undefined;
  try {
    config = parseImageConfig(artifacts.config);
  } catch (error) {
    violations.push(
      error instanceof Error ? error.message : "Invalid image config",
    );
  }

  if (config) {
    if (normalizedSha256(artifacts.workflow) !== config.workflowSha256) {
      violations.push("workflow differs from its reviewed SHA-256");
    }
    if (normalizedSha256(artifacts.fixture) !== config.fixtureSha256) {
      violations.push("synthetic fixture differs from its reviewed SHA-256");
    }
    requireText(
      artifacts.workflow,
      `image: ${config.reference}`,
      "workflow image must match the immutable declaration",
      violations,
    );
    requireText(
      artifacts.workflow,
      `POSTGRES_DB: ${config.databaseName}`,
      "workflow database must match the fixed acceptance target",
      violations,
    );
  }
  requireText(
    artifacts.workflow,
    "runs-on: ubuntu-24.04",
    "acceptance must use the fixed Ubuntu 24.04 runner",
    violations,
  );
  requireText(
    artifacts.workflow,
    "RESEARCH_COCKPIT_PG_CONTAINER_ID: ${{ job.services.postgres.id }}",
    "workflow must pass the GitHub service container ID",
    violations,
  );
  requireText(
    artifacts.workflow,
    "RESEARCH_COCKPIT_PG_ADAPTER_HOST: 127.0.0.1",
    "workflow must pass the exact loopback B9 adapter host",
    violations,
  );
  requireText(
    artifacts.workflow,
    "RESEARCH_COCKPIT_PG_ADAPTER_PORT: ${{ job.services.postgres.ports[5432] }}",
    "workflow must pass the dynamically mapped B9 adapter port",
    violations,
  );
  requireText(
    artifacts.workflow,
    "POSTGRES_HOST_AUTH_METHOD: scram-sha-256",
    "acceptance service must require SCRAM for host authentication",
    violations,
  );
  requireText(
    artifacts.workflow,
    "POSTGRES_INITDB_ARGS: --auth-host=scram-sha-256",
    "acceptance service must initialize loopback host rules with SCRAM",
    violations,
  );
  requireText(
    artifacts.workflow,
    "pnpm --filter @research-cockpit/db acceptance:postgres:ci",
    "workflow must invoke the reviewed package acceptance command",
    violations,
  );
  violations.push(...inspectEvidenceUploadStep(artifacts.workflow));
  violations.push(...inspectProjectionAdapterWorkflow(artifacts.workflow));
  for (const triggerPath of [
    "modules/research-core/**",
    "package.json",
    "packages/db/**",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
  ]) {
    requireText(
      artifacts.workflow,
      `- ${triggerPath}`,
      `workflow must rerun when ${triggerPath} changes`,
      violations,
    );
  }
  for (const [pattern, message] of [
    [/DATABASE_URL/i, "workflow must not construct a database URL"],
    [/localhost|0\.0\.0\.0/i, "workflow must use only exact IPv4 loopback"],
    [
      /postgres:(?:latest|17)(?:\s|$)/i,
      "workflow must not use a mutable PostgreSQL tag",
    ],
  ] as const) {
    if (pattern.test(artifacts.workflow)) violations.push(message);
  }

  for (const marker of [
    "SET SESSION AUTHORIZATION research_cockpit_test_seed;",
    "BEGIN;",
    "COMMIT;",
    "RESET SESSION AUTHORIZATION;",
    "INSERT INTO private_data.resource_id_registry",
    "INSERT INTO private_data.theses",
    "INSERT INTO private_data.alert_rules",
    "synthetic.full",
    "synthetic.display-only",
    "synthetic.expired",
    "synthetic.denied",
  ]) {
    requireText(
      artifacts.fixture,
      marker,
      `synthetic fixture is missing ${marker}`,
      violations,
    );
  }
  if (/\b(?:DROP|TRUNCATE|DELETE|UPDATE)\b/i.test(artifacts.fixture)) {
    violations.push("synthetic fixture must remain insert-only");
  }
  if (/\bCOPY\b[\s\S]*?\bFROM\b/i.test(artifacts.fixture)) {
    violations.push("synthetic fixture must not import external data");
  }
  if (/https?:\/\//i.test(artifacts.fixture)) {
    violations.push("synthetic fixture must not contain network locations");
  }
  violations.push(...inspectInsertOnlyFixture(artifacts.fixture));
  const registryPosition = artifacts.fixture.indexOf(
    "INSERT INTO private_data.resource_id_registry",
  );
  for (const table of ["theses", "alert_rules"] as const) {
    const livePosition = artifacts.fixture.indexOf(
      `INSERT INTO private_data.${table}`,
    );
    if (registryPosition < 0 || livePosition < registryPosition) {
      violations.push(`resource registry rows must precede ${table}`);
    }
  }
  return violations;
}

export function parsePostgresProjectionAdapterEndpoint(
  environment: Readonly<Record<string, string | undefined>>,
): PostgresProjectionAdapterEndpoint {
  if (environment.RESEARCH_COCKPIT_PG_ADAPTER_HOST !== "127.0.0.1") {
    throw new Error(
      "The B9 PostgreSQL adapter host must be the exact loopback address",
    );
  }
  const portText = environment.RESEARCH_COCKPIT_PG_ADAPTER_PORT;
  if (
    portText === undefined ||
    !/^[1-9][0-9]{0,4}$/.test(portText) ||
    Number(portText) > 65_535
  ) {
    throw new Error(
      "The B9 PostgreSQL adapter port must be one canonical mapped port",
    );
  }
  return Object.freeze({
    host: "127.0.0.1",
    port: Number(portText),
  });
}

export async function runPostgresAcceptance(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (environment.CI !== "true" || environment.GITHUB_ACTIONS !== "true") {
    throw new Error(
      "Live PostgreSQL acceptance is restricted to the isolated GitHub Actions job",
    );
  }
  const containerId = environment.RESEARCH_COCKPIT_PG_CONTAINER_ID;
  if (!containerId) {
    throw new Error("GitHub service container ID is required");
  }
  const adapterEndpoint = parsePostgresProjectionAdapterEndpoint(environment);
  await verifyCheckedOutCommit(environment);

  const violations = await checkPostgresAcceptanceHarness();
  if (violations.length > 0) {
    throw new Error(
      `PostgreSQL acceptance harness violations:\n- ${violations.join("\n- ")}`,
    );
  }
  const config = parseImageConfig(
    JSON.parse(await readFile(imageConfigPath, "utf8")) as unknown,
  );
  const bootstrap = await renderReviewedCleanBootstrap({
    databaseName: config.databaseName,
    containerId,
  });
  const authenticatedMigrationPlan = await loadAuthenticatedMigrationPlan();
  const authenticatedBackupRestorePlan =
    await loadAuthenticatedBackupRestorePlan();
  const fixtureSql = await readFile(syntheticFixturePath, "utf8");

  await verifyContainerIdentity(containerId, config);
  const toolVersions = await verifyToolVersions(
    containerId,
    config.expectedServerVersion,
    config.expectedServerVersionNumber,
  );
  await verifyPristineTarget(containerId);
  const rollbackProbe = injectBootstrapFailure(bootstrap);
  await expectPsqlFailure(containerId, rollbackProbe, {
    label: "injected clean-bootstrap rollback",
    sqlState: "22012",
    message: "division by zero",
  });
  await verifyPristineTarget(containerId);
  await psql(containerId, bootstrap);
  await verifyMigrationLedger(containerId);
  await expectPsqlFailure(containerId, bootstrap, {
    label: "clean-bootstrap replay",
    sqlState: "P0001",
    message: "clean bootstrap requires an empty application target",
  });
  await verifyMigrationLedger(containerId);

  await verifyAuthenticatedTestLoaderSession(containerId, fixtureSql);
  await verifyAuthenticatedOwnerDdlCanarySession(containerId);
  await verifyCatalogContract(containerId);
  await verifyBackupCapability(containerId);
  await verifyContextCleanup(containerId);
  const impersonatedRuntimeMatrix = runtimeAuthorizationMatrixClient(
    containerId,
    "impersonated",
  );
  await verifyRuntimeAuthorizationMatrix(impersonatedRuntimeMatrix);
  await verifyWriteDenials(containerId);
  await verifyAuthenticatedRuntimeSession(containerId, adapterEndpoint);
  await verifyVersionedAuthenticatedMigrationPlan(
    containerId,
    authenticatedMigrationPlan,
    fixtureSql,
    adapterEndpoint,
  );
  await verifyAuthenticatedPostgresMigrationDeployment(
    containerId,
    adapterEndpoint,
    authenticatedMigrationPlan,
  );
  await verifyAuthenticatedPostgresProjectionPool(containerId, adapterEndpoint);
  await verifyAuthenticatedBackupAndBoundedRestore(
    containerId,
    authenticatedMigrationPlan,
    authenticatedBackupRestorePlan,
  );

  await verifyCheckedOutCommit(environment);
  const sourceHashes = await collectAcceptanceSourceHashes(config);
  const evidence = buildPostgresAcceptanceEvidence({
    githubEnvironment: environment,
    reviewedImageReference: config.reference,
    reviewedImageIndexDigest: config.indexDigest,
    toolVersions,
    sourceHashes,
    completedAt: new Date().toISOString(),
  });
  const writtenEvidence = await writePostgresAcceptanceEvidence(
    evidence,
    environment,
  );

  process.stdout.write(
    `PostgreSQL acceptance evidence SHA-256: ${writtenEvidence.sha256}\n` +
      "PostgreSQL 17.11 legacy clean-bootstrap regression, versioned platform bootstrap, authenticated clean application migrations, locked migration-ledger checksum-drift refusal, one-time suffix replay, injected rollback, concurrent deployment serialization, authenticated policy-scoped application-data dump and bounded clean restore, impersonated-capability, authenticated test-loader, authenticated owner-DDL canary, container-local SCRAM runtime, driverless financial-fact projection, single-client read-only financial-fact projection adapter, and bounded two-client pool lifecycle/concurrency/cancellation/timeout recovery acceptance passed; the version 11 success-only run record was written.\n",
  );
}

async function verifyVersionedAuthenticatedMigrationPlan(
  containerId: string,
  plan: AuthenticatedMigrationPlan,
  fixtureSql: string,
  adapterEndpoint: PostgresProjectionAdapterEndpoint,
): Promise<void> {
  // Freeze the inherited result before destructively replacing the disposable
  // target with the independently reviewed v2 platform/application plan.
  await verifyCatalogContract(containerId);
  await resetAcceptanceTargetForAuthenticatedMigrations(containerId);

  await expectPsqlFailure(
    containerId,
    renderAuthenticatedPlatformMigration(plan, true),
    {
      label: "injected B7 platform-bootstrap rollback",
      sqlState: "22012",
      message: "division by zero",
    },
  );
  await verifyB7PristineTarget(containerId);

  const platformResult = await psql(
    containerId,
    renderAuthenticatedPlatformMigration(plan),
  );
  assertEqual(
    platformResult.stderr.trim(),
    "",
    "B7 platform-bootstrap diagnostics",
  );
  await verifyAuthenticatedMigrationPlatformState(containerId);
  await expectPsqlFailure(
    containerId,
    renderAuthenticatedPlatformMigration(plan),
    {
      label: "B7 platform-bootstrap replay",
      sqlState: "P0001",
      message: "versioned platform bootstrap requires a pristine target",
    },
  );
  await verifyAuthenticatedMigrationPlatformState(containerId);

  const ledgerRows = expectedAuthenticatedMigrationLedgerRows(plan.manifest);
  const expectedLedger = ledgerRows.map(
    ({ migrationId, fileName, sha256 }) =>
      `${migrationId}|${fileName}|${sha256}`,
  );
  await verifyAuthenticatedApplicationMigrationSession(
    containerId,
    plan,
    ledgerRows,
  );
  await verifyMigrationLedger(containerId, expectedLedger);
  await verifyCatalogContract(containerId);
  await verifyB7PlatformArtifactsAfterApplication(containerId);

  // Re-run the stateful inherited boundaries on the v2 result so the split is
  // proven to produce the same catalog and synthetic authorization behavior.
  await verifyAuthenticatedTestLoaderSession(
    containerId,
    fixtureSql,
    expectedLedger,
  );
  await verifyAuthenticatedOwnerDdlCanarySession(containerId, expectedLedger);
  await verifyCatalogContract(containerId);
  await verifyBackupCapability(containerId);
  await verifyContextCleanup(containerId);
  const impersonatedRuntimeMatrix = runtimeAuthorizationMatrixClient(
    containerId,
    "impersonated",
  );
  await verifyRuntimeAuthorizationMatrix(impersonatedRuntimeMatrix);
  await verifyWriteDenials(containerId);
  await verifyAuthenticatedRuntimeSession(containerId, adapterEndpoint);
  await verifyMigrationLedger(containerId, expectedLedger);
  await verifyB7PlatformArtifactsAfterApplication(containerId);
}

async function verifyAuthenticatedPostgresMigrationDeployment(
  containerId: string,
  endpoint: PostgresProjectionAdapterEndpoint,
  plan: AuthenticatedMigrationPlan,
): Promise<void> {
  await verifyMigrationDeployerAuthResidueAbsent(containerId);
  const password = generateMigrationDeployerAuthPassword();
  const clients: Array<{
    readonly client: Client;
    readonly removeErrorListener: () => void;
  }> = [];
  const unexpectedClientErrors: string[] = [];
  let clientA: Client | undefined;
  let clientB: Client | undefined;
  let barrierClient: Client | undefined;
  let barrierOpen = false;
  let targetModified = false;
  const pendingDeployments: Promise<PostgresMigrationDeploymentResult>[] = [];
  let probeError: unknown;
  let cleanupError: unknown;

  const registerClient = (client: Client, label: string): Client => {
    const recordUnexpectedError = () => {
      unexpectedClientErrors.push(label);
    };
    client.on("error", recordUnexpectedError);
    clients.push({
      client,
      removeErrorListener: () =>
        client.removeListener("error", recordUnexpectedError),
    });
    return client;
  };

  try {
    await provisionMigrationDeployerAuthLogin(containerId, password);
    await verifyMigrationDeployerAuthRoleCatalog(containerId);

    clientA = registerClient(
      createPostgresMigrationDeployerClient(
        endpoint,
        password,
        POSTGRES_MIGRATION_DEPLOYER_APPLICATION_A,
      ),
      "deployer-a",
    );
    await clientA.connect();
    const clientAState = await assertPostgresMigrationDeployerClientIdle(
      clientA,
      POSTGRES_MIGRATION_DEPLOYER_APPLICATION_A,
    );
    const deployerA = new PostgresMigrationDeployer(clientA, plan);

    await psql(
      containerId,
      renderAuthenticatedMigrationV2PrefixFiveReconstruction(plan),
    );
    targetModified = true;
    const injectedPrefix =
      await collectMigrationDeployerTargetState(containerId);
    assertMigrationDeployerTargetPrefix(injectedPrefix, plan);
    const injectedError = await captureMigrationDeploymentError(
      deployerA.deploy({ injectFailure: true }),
    );
    assertMigrationDeploymentError(
      injectedError,
      "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    );
    const afterInjectedFailure =
      await collectMigrationDeployerTargetState(containerId);
    assertEqual(
      JSON.stringify(afterInjectedFailure),
      JSON.stringify(injectedPrefix),
      "B11 injected deployment rollback target fingerprint",
    );
    await assertPostgresMigrationDeployerClientIdle(
      clientA,
      POSTGRES_MIGRATION_DEPLOYER_APPLICATION_A,
      clientAState.backendPid,
    );

    assertMigrationDeploymentResult(await deployerA.deploy(), "applied");
    const serialAppliedState =
      await collectMigrationDeployerTargetState(containerId);
    assertMigrationDeployerTargetCurrent(serialAppliedState, plan);
    const replayResult = await deployerA.deploy();
    assertMigrationDeploymentResult(replayResult, "current");
    const afterReplay = await collectMigrationDeployerTargetState(containerId);
    assertEqual(
      JSON.stringify(afterReplay),
      JSON.stringify(serialAppliedState),
      "B11 one-time replay target fingerprint",
    );
    await assertPostgresMigrationDeployerClientIdle(
      clientA,
      POSTGRES_MIGRATION_DEPLOYER_APPLICATION_A,
      clientAState.backendPid,
    );

    await verifyMigrationDeployerLiveChecksumDrift(
      containerId,
      plan,
      deployerA,
      serialAppliedState,
    );

    clientB = registerClient(
      createPostgresMigrationDeployerClient(
        endpoint,
        password,
        POSTGRES_MIGRATION_DEPLOYER_APPLICATION_B,
      ),
      "deployer-b",
    );
    await clientB.connect();
    const clientBState = await assertPostgresMigrationDeployerClientIdle(
      clientB,
      POSTGRES_MIGRATION_DEPLOYER_APPLICATION_B,
    );
    await verifyMigrationDeployerConnectionLimit(endpoint, password);

    await psql(
      containerId,
      renderAuthenticatedMigrationV2PrefixFiveReconstruction(plan),
    );
    assertMigrationDeployerTargetPrefix(
      await collectMigrationDeployerTargetState(containerId),
      plan,
    );

    barrierClient = registerClient(
      createPostgresMigrationDeployerAdminClient(endpoint),
      "ledger-barrier",
    );
    await barrierClient.connect();
    const barrierPid = await beginMigrationDeployerLedgerBarrier(barrierClient);
    barrierOpen = true;

    const deployerB = new PostgresMigrationDeployer(clientB, plan);
    const deploymentA = deployerA.deploy();
    pendingDeployments.push(deploymentA);
    await waitForMigrationDeployerBlockingChain(barrierClient, {
      barrierPid,
      deployerAPid: clientAState.backendPid,
    });
    const deploymentB = deployerB.deploy();
    pendingDeployments.push(deploymentB);
    await waitForMigrationDeployerBlockingChain(barrierClient, {
      barrierPid,
      deployerAPid: clientAState.backendPid,
      deployerBPid: clientBState.backendPid,
    });

    await releaseMigrationDeployerLedgerBarrier(barrierClient);
    barrierOpen = false;
    const concurrentResults =
      await settleMigrationDeployments(pendingDeployments);
    assertConcurrentMigrationDeploymentResults(concurrentResults);
    assertMigrationDeployerTargetCurrent(
      await collectMigrationDeployerTargetState(containerId),
      plan,
    );
    await assertPostgresMigrationDeployerClientIdle(
      clientA,
      POSTGRES_MIGRATION_DEPLOYER_APPLICATION_A,
      clientAState.backendPid,
    );
    await assertPostgresMigrationDeployerClientIdle(
      clientB,
      POSTGRES_MIGRATION_DEPLOYER_APPLICATION_B,
      clientBState.backendPid,
    );
    if (unexpectedClientErrors.length > 0) {
      throw new Error("B11 migration deployer client emitted an idle error");
    }
  } catch (error) {
    probeError = error;
  } finally {
    try {
      const cleanupFailures: RuntimeAuthBestEffortOperation[] = [];
      if (barrierOpen && barrierClient !== undefined) {
        const clientToRelease = barrierClient;
        cleanupFailures.push({
          label: "release B11 ledger barrier",
          run: () => releaseMigrationDeployerLedgerBarrier(clientToRelease),
        });
      }
      if (pendingDeployments.length > 0) {
        cleanupFailures.push({
          label: "settle B11 migration deployments",
          run: async () => {
            await settleMigrationDeployments(pendingDeployments);
          },
        });
      }
      for (const registered of clients) {
        cleanupFailures.push({
          label: "close B11 PostgreSQL client",
          run: async () => {
            try {
              await registered.client.end();
            } finally {
              registered.removeErrorListener();
            }
          },
        });
      }
      cleanupFailures.push(
        {
          label: "repair B11 acceptance target",
          run: () =>
            repairMigrationDeployerTarget(containerId, plan, targetModified),
        },
        {
          label: "drain B11 migration deployer backends",
          run: () => waitForMigrationDeployerAuthBackendDrain(containerId),
        },
        {
          label: "drop B11 migration deployer login",
          run: () => cleanupMigrationDeployerAuthProbe(containerId),
        },
        {
          label: "verify B11 migration deployer residue",
          run: () => verifyMigrationDeployerAuthResidueAbsent(containerId),
        },
        {
          label: "verify B11 final ledger and catalog",
          run: () =>
            verifyMigrationDeployerFinalTarget(
              containerId,
              plan,
              targetModified,
            ),
        },
      );
      throwRuntimeAuthOperationFailures(
        await collectRuntimeAuthOperationFailures(cleanupFailures),
        "B11 migration deployment cleanup failed",
      );
    } catch (error) {
      cleanupError = error;
    }
  }

  if (probeError !== undefined && cleanupError !== undefined) {
    throw new AggregateError(
      [probeError, cleanupError],
      "B11 migration deployment probe and mandatory cleanup both failed",
      { cause: probeError },
    );
  }
  if (probeError !== undefined) throw migrationDeployerHarnessError(probeError);
  if (cleanupError !== undefined)
    throw migrationDeployerHarnessError(cleanupError);
}

async function provisionMigrationDeployerAuthLogin(
  containerId: string,
  password: string,
): Promise<void> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ],
    renderMigrationDeployerAuthProvisioningSql(password),
  );
  assertSensitiveCommandSuccess(
    result,
    "provision ephemeral B11 migration deployer login",
  );
}

async function verifyMigrationDeployerAuthRoleCatalog(
  containerId: string,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT rolname || '|' || rolcanlogin || '|' || rolsuper || '|' ||
  rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' ||
  rolinherit || '|' || rolbypassrls || '|' || rolconnlimit || '|' ||
  (rolpassword LIKE 'SCRAM-SHA-256$%')
FROM pg_catalog.pg_authid
WHERE rolname = '${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}';`,
    ),
    `${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}|true|false|false|false|false|false|false|2|true`,
    "B11 migration deployer login attributes and SCRAM verifier",
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT granted_role.rolname || '|' || member_role.rolname || '|' ||
  membership.admin_option || '|' || membership.inherit_option || '|' ||
  membership.set_option
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
WHERE granted_role.rolname = '${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}'
   OR member_role.rolname = '${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}';`,
    ),
    `${MIGRATION_DEPLOYER_AUTH_CAPABILITY_ROLE}|${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}|false|false|true`,
    "B11 migration deployer SET-only owner membership",
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `WITH deployer AS (
  SELECT oid FROM pg_catalog.pg_roles
  WHERE rolname = '${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}'
), direct_acl AS (
  SELECT privilege.grantee
  FROM pg_catalog.pg_database AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.datacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_namespace AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.nspacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_class AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.relacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_proc AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.proacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_attribute AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.attacl) AS privilege
)
SELECT (
  SELECT count(*) FROM pg_catalog.pg_db_role_setting
  WHERE setrole = (SELECT oid FROM deployer)
) || '|' || (
  SELECT count(*) FROM direct_acl
  WHERE grantee = (SELECT oid FROM deployer)
);`,
    ),
    "0|0",
    "B11 migration deployer role settings and direct ACLs",
  );
}

function createPostgresMigrationDeployerClient(
  endpoint: PostgresProjectionAdapterEndpoint,
  password: string,
  applicationName:
    | typeof POSTGRES_MIGRATION_DEPLOYER_APPLICATION_A
    | typeof POSTGRES_MIGRATION_DEPLOYER_APPLICATION_B,
): Client {
  assertMigrationDeployerAuthPassword(password);
  return new Client({
    host: endpoint.host,
    port: endpoint.port,
    database: CLEAN_BOOTSTRAP_DATABASE_NAME,
    user: MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE,
    password,
    ssl: false,
    application_name: applicationName,
    connectionTimeoutMillis: 2_000,
  });
}

function createPostgresMigrationDeployerAdminClient(
  endpoint: PostgresProjectionAdapterEndpoint,
): Client {
  return new Client({
    host: endpoint.host,
    port: endpoint.port,
    database: CLEAN_BOOTSTRAP_DATABASE_NAME,
    user: "postgres",
    password: POSTGRES_MIGRATION_DEPLOYER_ADMIN_PASSWORD,
    ssl: false,
    application_name: POSTGRES_MIGRATION_DEPLOYER_BARRIER_APPLICATION,
    connectionTimeoutMillis: 2_000,
  });
}

async function assertPostgresMigrationDeployerClientIdle(
  client: Client,
  expectedApplicationName:
    | typeof POSTGRES_MIGRATION_DEPLOYER_APPLICATION_A
    | typeof POSTGRES_MIGRATION_DEPLOYER_APPLICATION_B,
  expectedBackendPid?: number,
): Promise<MigrationDeployerClientState> {
  const result = await client.query<{ state: string }>({
    text: `SELECT pg_catalog.json_build_object(
  'backendPid', pg_catalog.pg_backend_pid(),
  'sessionUser', session_user,
  'currentUser', current_user,
  'systemUser', system_user,
  'applicationName', pg_catalog.current_setting('application_name'),
  'transactionReadOnly', pg_catalog.current_setting('transaction_read_only'),
  'ssl', EXISTS (
    SELECT 1 FROM pg_catalog.pg_stat_ssl
    WHERE pid = pg_catalog.pg_backend_pid() AND ssl
  )
)::text AS state;`,
  });
  const text = result.rows[0]?.state;
  if (result.command !== "SELECT" || result.rowCount !== 1 || !text) {
    throw new Error("B11 migration deployer client state is invalid");
  }
  const value = JSON.parse(text) as unknown;
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.backendPid) ||
    (value.backendPid as number) <= 0 ||
    (expectedBackendPid !== undefined &&
      value.backendPid !== expectedBackendPid) ||
    value.sessionUser !== MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE ||
    value.currentUser !== MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE ||
    value.systemUser !==
      `scram-sha-256:${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}` ||
    value.applicationName !== expectedApplicationName ||
    value.transactionReadOnly !== "off" ||
    value.ssl !== false
  ) {
    throw new Error("B11 migration deployer client state is unsafe");
  }
  return Object.freeze({
    backendPid: value.backendPid as number,
    sessionUser: value.sessionUser,
    currentUser: value.currentUser,
    systemUser: value.systemUser,
    applicationName: expectedApplicationName,
    transactionReadOnly: value.transactionReadOnly,
    ssl: value.ssl,
  });
}

async function verifyMigrationDeployerConnectionLimit(
  endpoint: PostgresProjectionAdapterEndpoint,
  password: string,
): Promise<void> {
  const third = createPostgresMigrationDeployerClient(
    endpoint,
    password,
    POSTGRES_MIGRATION_DEPLOYER_APPLICATION_A,
  );
  let rejected = false;
  let cleanupFailed = false;
  try {
    await third.connect();
  } catch (error) {
    rejected = postgresErrorCode(error) === "53300";
  } finally {
    try {
      await third.end();
    } catch {
      cleanupFailed = true;
    }
  }
  if (!rejected || cleanupFailed) {
    throw new Error("B11 migration deployer connection limit was not enforced");
  }
}

async function collectMigrationDeployerTargetState(
  containerId: string,
): Promise<MigrationDeployerTargetState> {
  const value = JSON.parse(
    await psqlScalar(
      containerId,
      `SELECT pg_catalog.json_build_object(
  'ledger', (
    SELECT coalesce(
      pg_catalog.json_agg(
        pg_catalog.json_build_object(
          'migrationId', ledger.migration_id,
          'fileName', ledger.file_name,
          'sha256', ledger.sha256,
          'appliedAt', ledger.applied_at::text,
          'appliedBy', ledger.applied_by
        ) ORDER BY ledger.migration_id
      ),
      '[]'::json
    )
    FROM shared_data.schema_migrations AS ledger
  ),
  'procedure', (
    SELECT pg_catalog.json_build_object(
      'oid', procedure.oid,
      'owner', pg_catalog.pg_get_userbyid(procedure.proowner),
      'source', procedure.prosrc,
      'accessControlFingerprint', (
        SELECT count(*) || '|' ||
          count(*) FILTER (WHERE privilege.grantee = 0) || '|' ||
          count(*) FILTER (WHERE privilege.grantee = procedure.proowner) || '|' ||
          count(*) FILTER (
            WHERE privilege.grantee = (
              SELECT oid FROM pg_catalog.pg_roles
              WHERE rolname = 'research_cockpit_runtime'
            )
          ) || '|' ||
          count(*) FILTER (
            WHERE privilege.grantee NOT IN (
              0,
              procedure.proowner,
              (SELECT oid FROM pg_catalog.pg_roles
               WHERE rolname = 'research_cockpit_runtime')
            )
          ) || '|' ||
          count(*) FILTER (
            WHERE privilege.privilege_type <> 'EXECUTE'
               OR privilege.grantor <> procedure.proowner
               OR privilege.is_grantable
          )
        FROM pg_catalog.aclexplode(
          coalesce(
            procedure.proacl,
            pg_catalog.acldefault('f', procedure.proowner)
          )
        ) AS privilege
      ),
      'configuration', coalesce(
        pg_catalog.array_to_string(procedure.proconfig, ','), ''
      ),
      'securityDefiner', procedure.prosecdef,
      'kind', procedure.prokind
    )
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = 'private_data.set_request_context(uuid,uuid,text,text,text,text)'::pg_catalog.regprocedure
  )
)::text;`,
    ),
  ) as unknown;
  if (!isRecord(value) || !Array.isArray(value.ledger)) {
    throw new Error("B11 migration deployer target state is invalid");
  }
  const ledger = value.ledger.map((row, index) => {
    if (
      !isRecord(row) ||
      typeof row.migrationId !== "string" ||
      typeof row.fileName !== "string" ||
      typeof row.sha256 !== "string" ||
      typeof row.appliedAt !== "string" ||
      row.appliedAt.length === 0 ||
      typeof row.appliedBy !== "string"
    ) {
      throw new Error(`B11 migration deployer ledger row ${index} is invalid`);
    }
    return Object.freeze({
      migrationId: row.migrationId,
      fileName: row.fileName,
      sha256: row.sha256,
      appliedAt: row.appliedAt,
      appliedBy: row.appliedBy,
    });
  });
  if (!isRecord(value.procedure)) {
    throw new Error("B11 migration deployer procedure state is invalid");
  }
  const procedure = value.procedure;
  if (
    !Number.isSafeInteger(procedure.oid) ||
    (procedure.oid as number) <= 0 ||
    typeof procedure.owner !== "string" ||
    typeof procedure.source !== "string" ||
    typeof procedure.accessControlFingerprint !== "string" ||
    typeof procedure.configuration !== "string" ||
    typeof procedure.securityDefiner !== "boolean" ||
    typeof procedure.kind !== "string"
  ) {
    throw new Error("B11 migration deployer procedure catalog is invalid");
  }
  return Object.freeze({
    ledger: Object.freeze(ledger),
    procedure: Object.freeze({
      oid: procedure.oid as number,
      owner: procedure.owner,
      source: procedure.source,
      accessControlFingerprint: procedure.accessControlFingerprint,
      configuration: procedure.configuration,
      securityDefiner: procedure.securityDefiner,
      kind: procedure.kind,
    }),
  });
}

function assertMigrationDeployerTargetPrefix(
  state: MigrationDeployerTargetState,
  plan: AuthenticatedMigrationPlan,
): void {
  assertMigrationDeployerLedgerRows(state.ledger, plan, 5);
  assertMigrationDeployerProcedureState(
    state.procedure,
    extractMigrationDeployerProcedureSource(plan.applicationFiles[0]?.sql),
  );
}

function assertMigrationDeployerTargetCurrent(
  state: MigrationDeployerTargetState,
  plan: AuthenticatedMigrationPlan,
): void {
  assertMigrationDeployerLedgerRows(state.ledger, plan, 6);
  assertMigrationDeployerProcedureState(
    state.procedure,
    extractMigrationDeployerProcedureSource(plan.applicationFiles[5]?.sql),
  );
}

function assertMigrationDeployerLedgerRows(
  actual: readonly MigrationDeployerLedgerRow[],
  plan: AuthenticatedMigrationPlan,
  count: 5 | 6,
): void {
  const expected = plan.manifest.migrations.slice(0, count);
  if (actual.length !== expected.length) {
    throw new Error("B11 migration deployer ledger length differs");
  }
  for (const [index, entry] of expected.entries()) {
    const row = actual[index];
    const expectedAppliedBy =
      index < 5 ? MIGRATOR_AUTH_LOGIN_ROLE : MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE;
    if (
      row?.migrationId !== entry.id ||
      row.fileName !== entry.file ||
      row.sha256 !== entry.sha256 ||
      row.appliedBy !== expectedAppliedBy
    ) {
      throw new Error("B11 migration deployer ledger differs");
    }
  }
}

function assertMigrationDeployerProcedureState(
  actual: MigrationDeployerProcedureState,
  expectedSource: string,
): void {
  if (
    actual.owner !== MIGRATION_DEPLOYER_AUTH_CAPABILITY_ROLE ||
    actual.source !== expectedSource ||
    actual.configuration !== "search_path=pg_catalog" ||
    actual.securityDefiner ||
    actual.kind !== "p" ||
    actual.accessControlFingerprint !== "2|0|1|1|0|0"
  ) {
    throw new Error("B11 migration deployer procedure state differs");
  }
}

function extractMigrationDeployerProcedureSource(
  sql: string | undefined,
): string {
  if (sql === undefined) {
    throw new Error("B11 migration deployer procedure source is missing");
  }
  const matches = [
    ...sql.matchAll(
      /CREATE(?: OR REPLACE)? PROCEDURE private_data\.set_request_context\([\s\S]*?AS \$procedure\$([\s\S]*?)\$procedure\$;/g,
    ),
  ];
  if (matches.length !== 1 || matches[0]?.[1] === undefined) {
    throw new Error("B11 migration deployer procedure source is ambiguous");
  }
  return matches[0][1];
}

function assertMigrationDeploymentResult(
  result: PostgresMigrationDeploymentResult,
  expectedStatus: "applied" | "current",
): void {
  const expectedIds = expectedStatus === "applied" ? ["v2-0006"] : [];
  if (
    result.status !== expectedStatus ||
    JSON.stringify(result.appliedMigrationIds) !== JSON.stringify(expectedIds)
  ) {
    throw new Error("B11 migration deployment result differs");
  }
}

async function captureMigrationDeploymentError(
  promise: Promise<PostgresMigrationDeploymentResult>,
): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("B11 migration deployment unexpectedly succeeded");
}

function assertMigrationDeploymentError(
  error: unknown,
  expectedCode:
    "POSTGRES_MIGRATION_LEDGER_DRIFT" | "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
): void {
  if (
    !(error instanceof PostgresMigrationDeploymentError) ||
    error.code !== expectedCode ||
    error.message !== "PostgreSQL migration deployment failed." ||
    Object.hasOwn(error, "cause")
  ) {
    throw new Error("B11 migration deployment error differs");
  }
}

async function verifyMigrationDeployerLiveChecksumDrift(
  containerId: string,
  plan: AuthenticatedMigrationPlan,
  deployer: PostgresMigrationDeployer,
  baseline: MigrationDeployerTargetState,
): Promise<void> {
  const driftEntry = plan.manifest.migrations[2];
  if (
    driftEntry === undefined ||
    driftEntry.sha256 === POSTGRES_MIGRATION_DEPLOYER_DRIFT_SHA256
  ) {
    throw new Error("B11 checksum-drift fixture is invalid");
  }
  let driftInstalled = false;
  let probeError: unknown;
  let restoreError: unknown;
  try {
    await setMigrationDeployerLedgerChecksum(
      containerId,
      driftEntry.id,
      driftEntry.file,
      driftEntry.sha256,
      POSTGRES_MIGRATION_DEPLOYER_DRIFT_SHA256,
    );
    driftInstalled = true;
    const drifted = await collectMigrationDeployerTargetState(containerId);
    assertMigrationDeployerTargetCurrentWithDrift(drifted, plan, driftEntry.id);
    const driftError = await captureMigrationDeploymentError(deployer.deploy());
    assertMigrationDeploymentError(
      driftError,
      "POSTGRES_MIGRATION_LEDGER_DRIFT",
    );
    assertEqual(
      JSON.stringify(await collectMigrationDeployerTargetState(containerId)),
      JSON.stringify(drifted),
      "B11 checksum-drift refusal target fingerprint",
    );
  } catch (error) {
    probeError = error;
  } finally {
    if (driftInstalled) {
      try {
        await setMigrationDeployerLedgerChecksum(
          containerId,
          driftEntry.id,
          driftEntry.file,
          POSTGRES_MIGRATION_DEPLOYER_DRIFT_SHA256,
          driftEntry.sha256,
        );
        assertEqual(
          JSON.stringify(
            await collectMigrationDeployerTargetState(containerId),
          ),
          JSON.stringify(baseline),
          "B11 checksum-drift repair target fingerprint",
        );
      } catch (error) {
        restoreError = error;
      }
    }
  }
  if (probeError !== undefined && restoreError !== undefined) {
    throw new AggregateError(
      [probeError, restoreError],
      "B11 checksum-drift probe and repair both failed",
      { cause: probeError },
    );
  }
  if (probeError !== undefined) throw migrationDeployerHarnessError(probeError);
  if (restoreError !== undefined)
    throw migrationDeployerHarnessError(restoreError);
}

function migrationDeployerHarnessError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error("B11 PostgreSQL migration-deployment harness failed", {
        cause: error,
      });
}

function assertMigrationDeployerTargetCurrentWithDrift(
  state: MigrationDeployerTargetState,
  plan: AuthenticatedMigrationPlan,
  driftedMigrationId: string,
): void {
  if (state.ledger.length !== plan.manifest.migrations.length) {
    throw new Error("B11 checksum-drift ledger length differs");
  }
  for (const [index, entry] of plan.manifest.migrations.entries()) {
    const row = state.ledger[index];
    if (
      row?.migrationId !== entry.id ||
      row.fileName !== entry.file ||
      row.sha256 !==
        (entry.id === driftedMigrationId
          ? POSTGRES_MIGRATION_DEPLOYER_DRIFT_SHA256
          : entry.sha256) ||
      row.appliedBy !==
        (index < 5
          ? MIGRATOR_AUTH_LOGIN_ROLE
          : MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE)
    ) {
      throw new Error("B11 checksum-drift ledger differs");
    }
  }
  assertMigrationDeployerProcedureState(
    state.procedure,
    extractMigrationDeployerProcedureSource(plan.applicationFiles[5]?.sql),
  );
}

async function setMigrationDeployerLedgerChecksum(
  containerId: string,
  migrationId: string,
  fileName: string,
  expectedSha256: string,
  replacementSha256: string,
): Promise<void> {
  const result = await psql(
    containerId,
    `BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(${AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY}::bigint);
SET LOCAL ROLE ${MIGRATION_DEPLOYER_AUTH_CAPABILITY_ROLE};
LOCK TABLE ONLY shared_data.schema_migrations IN SHARE ROW EXCLUSIVE MODE;
DO $b11_checksum_drift$
BEGIN
  UPDATE shared_data.schema_migrations
  SET sha256 = '${replacementSha256}'
  WHERE migration_id = '${migrationId}'
    AND file_name = '${fileName}'
    AND sha256 = '${expectedSha256}';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'B11 checksum-drift source row differs'
      USING ERRCODE = '55000';
  END IF;
END;
$b11_checksum_drift$;
COMMIT;
`,
  );
  assertEqual(
    result.stderr.trim(),
    "",
    "B11 checksum-drift mutation diagnostics",
  );
}

async function beginMigrationDeployerLedgerBarrier(
  client: Client,
): Promise<number> {
  await client.query("BEGIN READ WRITE");
  await client.query(
    "SET LOCAL statement_timeout = '10s'; SET LOCAL lock_timeout = '5s'",
  );
  await client.query(
    "LOCK TABLE ONLY shared_data.schema_migrations IN ROW EXCLUSIVE MODE",
  );
  const result = await client.query<{ backend_pid: number }>(
    "SELECT pg_catalog.pg_backend_pid() AS backend_pid",
  );
  const backendPid = result.rows[0]?.backend_pid;
  if (
    result.command !== "SELECT" ||
    result.rowCount !== 1 ||
    !Number.isSafeInteger(backendPid) ||
    (backendPid as number) <= 0
  ) {
    throw new Error("B11 ledger barrier backend PID is invalid");
  }
  return backendPid as number;
}

async function releaseMigrationDeployerLedgerBarrier(
  client: Client,
): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    try {
      await client.end();
    } catch (endError) {
      throw new AggregateError(
        [rollbackError, endError],
        "B11 ledger barrier rollback and client close both failed",
        { cause: endError },
      );
    }
    throw rollbackError;
  }
}

async function waitForMigrationDeployerBlockingChain(
  observer: Client,
  expected: {
    readonly barrierPid: number;
    readonly deployerAPid: number;
    readonly deployerBPid?: number;
  },
): Promise<void> {
  const deadline =
    Date.now() + POSTGRES_MIGRATION_DEPLOYER_BLOCKED_DEADLINE_MILLISECONDS;
  for (;;) {
    await observer.query("SELECT pg_catalog.pg_stat_clear_snapshot()");
    const result = await observer.query<{ valid: boolean }>({
      text: `SELECT (
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_locks AS held
    WHERE held.pid = $1::integer
      AND held.locktype = 'relation'
      AND held.relation = 'shared_data.schema_migrations'::pg_catalog.regclass
      AND held.mode = 'RowExclusiveLock'
      AND held.granted
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_stat_activity AS activity
    JOIN pg_catalog.pg_locks AS waiting
      ON waiting.pid = activity.pid
    WHERE activity.pid = $2::integer
      AND activity.usename = $3::name
      AND activity.application_name = $4::text
      AND activity.state = 'active'
      AND activity.wait_event_type = 'Lock'
      AND waiting.locktype = 'relation'
      AND waiting.relation = 'shared_data.schema_migrations'::pg_catalog.regclass
      AND waiting.mode = 'ShareRowExclusiveLock'
      AND NOT waiting.granted
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_locks AS held
    WHERE held.pid = $2::integer
      AND held.locktype = 'advisory'
      AND held.mode = 'ExclusiveLock'
      AND held.granted
  )
  AND $1::integer = ANY (pg_catalog.pg_blocking_pids($2::integer))
  AND (
    $5::integer IS NULL
    OR (
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_stat_activity AS activity
        JOIN pg_catalog.pg_locks AS waiting
          ON waiting.pid = activity.pid
        WHERE activity.pid = $5::integer
          AND activity.usename = $3::name
          AND activity.application_name = $6::text
          AND activity.state = 'active'
          AND activity.wait_event_type = 'Lock'
          AND activity.wait_event = 'advisory'
          AND waiting.locktype = 'advisory'
          AND waiting.mode = 'ExclusiveLock'
          AND NOT waiting.granted
      )
      AND $2::integer = ANY (pg_catalog.pg_blocking_pids($5::integer))
    )
  )
) AS valid;`,
      values: [
        expected.barrierPid,
        expected.deployerAPid,
        MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE,
        POSTGRES_MIGRATION_DEPLOYER_APPLICATION_A,
        expected.deployerBPid ?? null,
        POSTGRES_MIGRATION_DEPLOYER_APPLICATION_B,
      ],
    });
    const valid =
      result.command === "SELECT" &&
      result.rowCount === 1 &&
      result.rows[0]?.valid === true;
    const now = Date.now();
    if (valid && now <= deadline) return;
    if (now >= deadline) {
      throw new Error(
        "B11 migration deployment blocking chain was not observed",
      );
    }
    await delayMigrationDeployerPoll();
  }
}

function delayMigrationDeployerPoll(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 25);
  });
}

async function settleMigrationDeployments(
  deployments: readonly Promise<PostgresMigrationDeploymentResult>[],
): Promise<readonly PostgresMigrationDeploymentResult[]> {
  const settled = await Promise.allSettled(deployments);
  const failures = settled.flatMap((result) =>
    result.status === "rejected" ? [result.reason as unknown] : [],
  );
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      "B11 concurrent migration deployment failed",
      { cause: failures[0] },
    );
  }
  return Object.freeze(
    settled.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    ),
  );
}

function assertConcurrentMigrationDeploymentResults(
  results: readonly PostgresMigrationDeploymentResult[],
): void {
  if (results.length !== 2) {
    throw new Error("B11 concurrent migration deployment count differs");
  }
  const statuses = results.map(({ status }) => status).sort();
  if (JSON.stringify(statuses) !== JSON.stringify(["applied", "current"])) {
    throw new Error("B11 concurrent migration deployment statuses differ");
  }
  for (const result of results) {
    assertMigrationDeploymentResult(result, result.status);
  }
}

async function repairMigrationDeployerTarget(
  containerId: string,
  plan: AuthenticatedMigrationPlan,
  targetModified: boolean,
): Promise<void> {
  const state = await collectMigrationDeployerTargetState(containerId);
  if (!targetModified) {
    assertMigrationDeployerB7Baseline(state, plan);
    return;
  }
  if (isMigrationDeployerCanonicalCurrent(state, plan)) return;
  assertMigrationDeployerRepairableState(state, plan);

  const driftEntry = plan.manifest.migrations[2];
  const suffixEntry = plan.manifest.migrations[5];
  const suffixMigration = plan.applicationFiles[5];
  if (
    driftEntry === undefined ||
    suffixEntry === undefined ||
    suffixMigration?.file !== suffixEntry.file
  ) {
    throw new Error("B11 cleanup migration plan is incomplete");
  }
  const result = await psql(
    containerId,
    `BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(${AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY}::bigint);
SET LOCAL ROLE ${MIGRATION_DEPLOYER_AUTH_CAPABILITY_ROLE};
LOCK TABLE ONLY shared_data.schema_migrations IN SHARE ROW EXCLUSIVE MODE;
UPDATE shared_data.schema_migrations
SET sha256 = '${driftEntry.sha256}'
WHERE migration_id = '${driftEntry.id}'
  AND file_name = '${driftEntry.file}'
  AND sha256 IN (
    '${driftEntry.sha256}',
    '${POSTGRES_MIGRATION_DEPLOYER_DRIFT_SHA256}'
  );
${suffixMigration.sql.trimEnd()}
INSERT INTO shared_data.schema_migrations (
  migration_id,
  file_name,
  sha256,
  applied_by
) VALUES (
  '${suffixEntry.id}',
  '${suffixEntry.file}',
  '${suffixEntry.sha256}',
  '${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}'
)
ON CONFLICT (migration_id) DO UPDATE
SET file_name = EXCLUDED.file_name,
    sha256 = EXCLUDED.sha256,
    applied_by = EXCLUDED.applied_by;
COMMIT;
`,
  );
  assertEqual(
    result.stderr.trim(),
    "",
    "B11 acceptance target repair diagnostics",
  );
  assertMigrationDeployerTargetCurrent(
    await collectMigrationDeployerTargetState(containerId),
    plan,
  );
}

function isMigrationDeployerCanonicalCurrent(
  state: MigrationDeployerTargetState,
  plan: AuthenticatedMigrationPlan,
): boolean {
  try {
    assertMigrationDeployerTargetCurrent(state, plan);
    return true;
  } catch {
    return false;
  }
}

function assertMigrationDeployerB7Baseline(
  state: MigrationDeployerTargetState,
  plan: AuthenticatedMigrationPlan,
): void {
  if (state.ledger.length !== plan.manifest.migrations.length) {
    throw new Error("B11 inherited B7 ledger length differs");
  }
  for (const [index, entry] of plan.manifest.migrations.entries()) {
    const row = state.ledger[index];
    if (
      row?.migrationId !== entry.id ||
      row.fileName !== entry.file ||
      row.sha256 !== entry.sha256 ||
      row.appliedBy !== MIGRATOR_AUTH_LOGIN_ROLE
    ) {
      throw new Error("B11 inherited B7 ledger differs");
    }
  }
  assertMigrationDeployerProcedureState(
    state.procedure,
    extractMigrationDeployerProcedureSource(plan.applicationFiles[5]?.sql),
  );
}

function assertMigrationDeployerRepairableState(
  state: MigrationDeployerTargetState,
  plan: AuthenticatedMigrationPlan,
): void {
  if (state.ledger.length !== 5 && state.ledger.length !== 6) {
    throw new Error("B11 cleanup refuses an unknown ledger length");
  }
  for (const [index, row] of state.ledger.entries()) {
    const entry = plan.manifest.migrations[index];
    if (
      entry === undefined ||
      row.migrationId !== entry.id ||
      row.fileName !== entry.file ||
      (row.sha256 !== entry.sha256 &&
        !(
          index === 2 && row.sha256 === POSTGRES_MIGRATION_DEPLOYER_DRIFT_SHA256
        )) ||
      row.appliedBy !==
        (index < 5
          ? MIGRATOR_AUTH_LOGIN_ROLE
          : MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE)
    ) {
      throw new Error("B11 cleanup refuses unknown ledger drift");
    }
  }
  const prefixSource = extractMigrationDeployerProcedureSource(
    plan.applicationFiles[0]?.sql,
  );
  const currentSource = extractMigrationDeployerProcedureSource(
    plan.applicationFiles[5]?.sql,
  );
  if (
    state.procedure.source !== prefixSource &&
    state.procedure.source !== currentSource
  ) {
    throw new Error("B11 cleanup refuses unknown procedure drift");
  }
  assertMigrationDeployerProcedureState(
    state.procedure,
    state.procedure.source,
  );
}

async function cleanupMigrationDeployerAuthProbe(
  containerId: string,
): Promise<void> {
  await psql(containerId, renderMigrationDeployerAuthCleanupSql());
}

async function waitForMigrationDeployerAuthBackendDrain(
  containerId: string,
): Promise<void> {
  await psql(containerId, renderMigrationDeployerAuthBackendDrainSql());
}

async function verifyMigrationDeployerAuthResidueAbsent(
  containerId: string,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `WITH deployer AS (
  SELECT oid FROM pg_catalog.pg_roles
  WHERE rolname = '${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}'
)
SELECT (
  SELECT count(*) FROM deployer
) || '|' || (
  SELECT count(*) FROM pg_catalog.pg_auth_members
  WHERE roleid IN (SELECT oid FROM deployer)
     OR member IN (SELECT oid FROM deployer)
) || '|' || (
  SELECT count(*) FROM pg_catalog.pg_stat_activity
  WHERE usename = '${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}'
) || '|' || (
  SELECT count(*) FROM pg_catalog.pg_stat_activity
  WHERE application_name IN (
    '${POSTGRES_MIGRATION_DEPLOYER_APPLICATION_A}',
    '${POSTGRES_MIGRATION_DEPLOYER_APPLICATION_B}',
    '${POSTGRES_MIGRATION_DEPLOYER_BARRIER_APPLICATION}'
  )
);`,
    ),
    "0|0|0|0",
    "B11 migration deployer role, edge, backend, and application residue",
  );
}

async function verifyMigrationDeployerFinalTarget(
  containerId: string,
  plan: AuthenticatedMigrationPlan,
  targetModified: boolean,
): Promise<void> {
  const state = await collectMigrationDeployerTargetState(containerId);
  if (targetModified) {
    assertMigrationDeployerTargetCurrent(state, plan);
  } else {
    assertMigrationDeployerB7Baseline(state, plan);
  }
  await verifyMigrationLedger(
    containerId,
    expectedAuthenticatedMigrationLedgerRows(plan.manifest).map(
      ({ migrationId, fileName, sha256 }) =>
        `${migrationId}|${fileName}|${sha256}`,
    ),
  );
  await verifyCatalogContract(containerId);
  await verifyB7PlatformArtifactsAfterApplication(containerId);
  await verifyContextCleanup(containerId);
}

async function verifyAuthenticatedPostgresProjectionPool(
  containerId: string,
  endpoint: PostgresProjectionAdapterEndpoint,
): Promise<void> {
  await verifyRuntimeAuthResidueAbsent(containerId);

  const password = generateRuntimeAuthPassword();
  let wrongPassword = generateRuntimeAuthPassword();
  while (wrongPassword === password) {
    wrongPassword = generateRuntimeAuthPassword();
  }
  let pool: Pool | null = null;
  let source: PooledPostgresFinancialFactProjectionSource | null = null;
  let actor: PostgresProjectionActorContext = Object.freeze({
    principalId: PRINCIPAL_ALPHA,
    organizationId: ORGANIZATION_ALPHA,
  });
  let probeError: unknown;
  const cleanupErrors: unknown[] = [];

  try {
    await provisionPostgresProjectionPoolLogin(containerId, password);
    await verifyPostgresProjectionPoolRoleCatalog(containerId);
    await verifyPostgresProjectionPoolWrongPasswordRejection(
      containerId,
      endpoint,
      wrongPassword,
    );
    pool = createPostgresProjectionPool(endpoint, password);

    const dirtyBackendPid =
      await verifyPostgresProjectionPoolCapacityAndDirtyLease(pool);
    source = new PooledPostgresFinancialFactProjectionSource(pool, {
      current: () => actor,
    });

    const displayCase = runtimeProjectionAcceptanceCases()[0];
    if (displayCase === undefined)
      throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
    const resetResult = await source.load(displayCase.query);
    assertPostgresProjectionPoolResult(
      { ...displayCase, label: "B10 dirty-checkout reset" },
      resetResult,
    );
    await verifyPostgresProjectionPoolDiscardedSessionState(
      containerId,
      dirtyBackendPid,
    );

    actor = Object.freeze({
      principalId: PRINCIPAL_BETA,
      organizationId: ORGANIZATION_BETA,
    });
    const betaReuse = await source.load(displayCase.query);
    assertPostgresProjectionPoolResult(
      {
        ...displayCase,
        label: "B10 beta sequential pooled reuse",
        principalId: PRINCIPAL_BETA,
        organizationId: ORGANIZATION_BETA,
      },
      betaReuse,
    );

    actor = Object.freeze({
      principalId: PRINCIPAL_ALPHA,
      organizationId: ORGANIZATION_ALPHA,
    });
    await verifyPostgresProjectionPoolConcurrentTenantIsolation(
      containerId,
      source,
      displayCase,
      () => {
        actor = Object.freeze({
          principalId: PRINCIPAL_BETA,
          organizationId: ORGANIZATION_BETA,
        });
      },
    );

    actor = Object.freeze({
      principalId: PRINCIPAL_ALPHA,
      organizationId: ORGANIZATION_ALPHA,
    });
    const abortDiscardedPid = await verifyPostgresProjectionPoolActiveAbort(
      containerId,
      source,
      displayCase,
    );
    const timeoutDiscardedPid =
      await verifyPostgresProjectionPoolStatementTimeout(
        containerId,
        source,
        displayCase,
      );

    const replacementResult = await source.load(displayCase.query);
    assertPostgresProjectionPoolResult(
      { ...displayCase, label: "B10 post-discard replacement" },
      replacementResult,
    );
    await assertPostgresProjectionPoolReplacementBackend(containerId, [
      abortDiscardedPid,
      timeoutDiscardedPid,
    ]);
  } catch (error) {
    probeError = error;
  } finally {
    if (source !== null) {
      const sourceToClose = source;
      let closePromise: Promise<void> | null = null;
      try {
        closePromise = sourceToClose.close();
        const secondClose = sourceToClose.close();
        if (closePromise !== secondClose) {
          cleanupErrors.push(
            new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE"),
          );
        }
      } catch (error) {
        cleanupErrors.push(error);
      }
      if (closePromise !== null) {
        try {
          await closePromise;
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
      try {
        await capturePostgresProjectionPoolError(
          () => sourceToClose.load(runtimeProjectionQuery("display_api")),
          "POSTGRES_PROJECTION_POOL_FAILURE",
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
      if (
        pool === null ||
        pool.totalCount !== 0 ||
        pool.idleCount !== 0 ||
        pool.waitingCount !== 0
      ) {
        cleanupErrors.push(
          new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE"),
        );
      }
    } else if (pool !== null) {
      try {
        await pool.end();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    for (const cleanup of [
      () => waitForRuntimeAuthBackendDrain(containerId),
      () => assertPostgresProjectionPoolBackendResidueAbsent(containerId),
      () => cleanupRuntimeAuthProbe(containerId),
      () => verifyRuntimeAuthResidueAbsent(containerId),
    ]) {
      try {
        await cleanup();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }

  if (probeError !== undefined && cleanupErrors.length > 0) {
    throw new AggregateError(
      [probeError, ...cleanupErrors],
      "Authenticated PostgreSQL pool probe and mandatory cleanup both failed",
      { cause: probeError },
    );
  }
  if (probeError !== undefined) {
    throw postgresProjectionPoolHarnessError(probeError);
  }
  if (cleanupErrors.length === 1) {
    throw postgresProjectionPoolHarnessError(cleanupErrors[0]);
  }
  if (cleanupErrors.length > 1) {
    throw new AggregateError(
      cleanupErrors,
      "Authenticated PostgreSQL pool mandatory cleanup failed",
      { cause: cleanupErrors[0] },
    );
  }
}

async function provisionPostgresProjectionPoolLogin(
  containerId: string,
  password: string,
): Promise<void> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ],
    renderPostgresProjectionPoolProvisioningSql(password),
  );
  assertSensitiveCommandSuccess(
    result,
    "provision ephemeral PostgreSQL projection-pool login",
  );
}

async function verifyPostgresProjectionPoolRoleCatalog(
  containerId: string,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT rolname || '|' || rolcanlogin || '|' || rolsuper || '|' ||
  rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' ||
  rolinherit || '|' || rolbypassrls || '|' || rolconnlimit || '|' ||
  (rolpassword LIKE 'SCRAM-SHA-256$%')
FROM pg_catalog.pg_authid
WHERE rolname = '${RUNTIME_AUTH_LOGIN_ROLE}';`,
    ),
    `${RUNTIME_AUTH_LOGIN_ROLE}|true|false|false|false|false|false|false|${POSTGRES_PROJECTION_POOL_MAX}|true`,
    "ephemeral PostgreSQL projection-pool login attributes",
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT granted_role.rolname || '|' || member_role.rolname || '|' ||
  membership.admin_option || '|' || membership.inherit_option || '|' ||
  membership.set_option
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role
  ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role
  ON member_role.oid = membership.member
WHERE granted_role.rolname = '${RUNTIME_AUTH_LOGIN_ROLE}'
   OR member_role.rolname = '${RUNTIME_AUTH_LOGIN_ROLE}';`,
    ),
    `${RUNTIME_AUTH_CAPABILITY_ROLE}|${RUNTIME_AUTH_LOGIN_ROLE}|false|false|true`,
    "ephemeral PostgreSQL projection-pool membership",
  );
}

function createPostgresProjectionPool(
  endpoint: PostgresProjectionAdapterEndpoint,
  password: string,
): Pool {
  return new Pool({
    host: endpoint.host,
    port: endpoint.port,
    database: CLEAN_BOOTSTRAP_DATABASE_NAME,
    user: RUNTIME_AUTH_LOGIN_ROLE,
    password,
    ssl: false,
    application_name: POSTGRES_PROJECTION_POOL_APPLICATION_NAME,
    max: POSTGRES_PROJECTION_POOL_MAX,
    connectionTimeoutMillis:
      POSTGRES_PROJECTION_POOL_CONNECTION_TIMEOUT_MILLISECONDS,
    statement_timeout: POSTGRES_PROJECTION_POOL_STATEMENT_TIMEOUT_MILLISECONDS,
    idleTimeoutMillis: 10_000,
  });
}

async function verifyPostgresProjectionPoolWrongPasswordRejection(
  containerId: string,
  endpoint: PostgresProjectionAdapterEndpoint,
  wrongPassword: string,
): Promise<void> {
  const pool = createPostgresProjectionPool(endpoint, wrongPassword);
  const source = new PooledPostgresFinancialFactProjectionSource(pool, {
    current: () =>
      Object.freeze({
        principalId: PRINCIPAL_ALPHA,
        organizationId: ORGANIZATION_ALPHA,
      }),
  });
  let failed = false;
  try {
    await capturePostgresProjectionPoolError(
      () => source.load(runtimeProjectionQuery("display_api")),
      "POSTGRES_PROJECTION_POOL_FAILURE",
    );
  } finally {
    try {
      await source.close();
    } catch {
      failed = true;
    }
    try {
      await waitForRuntimeAuthBackendDrain(containerId);
    } catch {
      failed = true;
    }
  }
  if (
    failed ||
    pool.totalCount !== 0 ||
    pool.idleCount !== 0 ||
    pool.waitingCount !== 0
  ) {
    throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
  }
}

async function verifyPostgresProjectionPoolCapacityAndDirtyLease(
  pool: Pool,
): Promise<number> {
  let first: PoolClient | null = null;
  let second: PoolClient | null = null;
  let firstReleased = false;
  let secondReleased = false;
  try {
    first = await pool.connect();
    second = await pool.connect();
    const firstPid = await queryPostgresProjectionPoolBackendPid(first);
    const secondPid = await queryPostgresProjectionPoolBackendPid(second);
    if (
      firstPid === secondPid ||
      pool.totalCount !== 2 ||
      pool.idleCount !== 0
    ) {
      throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
    }

    if (pool.waitingCount !== 0 || pool.totalCount !== 2) {
      throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
    }

    first.release();
    firstReleased = true;
    await second.query(
      "SELECT pg_catalog.set_config('app.b10_session_canary', 'must-discard', false)",
    );
    await second.query("PREPARE b10_discard_canary AS SELECT 1");
    await second.query("SELECT pg_catalog.pg_advisory_lock(10210)");
    await second.query("BEGIN READ WRITE");
    await second.query(`SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE}`);
    await second.query({
      text: `CALL private_data.set_request_context(
  $1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text
)`,
      values: [
        PRINCIPAL_BETA,
        ORGANIZATION_BETA,
        "display",
        "api",
        "demo_only",
        "synthetic",
      ],
    });
    second.release();
    secondReleased = true;
    return secondPid;
  } finally {
    if (first !== null && !firstReleased) first.release(true);
    if (second !== null && !secondReleased) second.release(true);
  }
}

async function verifyPostgresProjectionPoolDiscardedSessionState(
  containerId: string,
  expectedBackendPid: number,
): Promise<void> {
  const stateText = await psqlScalar(
    containerId,
    `SELECT pg_catalog.json_build_object(
  'backendPid', activity.pid,
  'userName', activity.usename,
  'applicationName', activity.application_name,
  'state', activity.state,
  'transactionIdle', activity.xact_start IS NULL
    AND activity.backend_xid IS NULL,
  'advisoryLockCount', (
    SELECT count(*) FROM pg_catalog.pg_locks AS held_lock
    WHERE held_lock.pid = activity.pid
      AND held_lock.locktype = 'advisory'
  ),
  'ssl', coalesce(ssl.ssl, false)
)::text
FROM pg_catalog.pg_stat_activity AS activity
LEFT JOIN pg_catalog.pg_stat_ssl AS ssl ON ssl.pid = activity.pid
WHERE activity.pid = ${expectedBackendPid}
  AND activity.backend_type = 'client backend';`,
  );
  if (stateText === "") {
    throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  assertJsonEqual(
    JSON.parse(stateText) as unknown,
    {
      backendPid: expectedBackendPid,
      userName: RUNTIME_AUTH_LOGIN_ROLE,
      applicationName: POSTGRES_PROJECTION_POOL_APPLICATION_NAME,
      state: "idle",
      transactionIdle: true,
      advisoryLockCount: 0,
      ssl: false,
    },
    "B10 pooled DISCARD ALL admin-visible backend reset",
  );
}

async function queryPostgresProjectionPoolBackendPid(
  client: PoolClient,
): Promise<number> {
  const result = await client.query<{ backend_pid: number }>(
    "SELECT pg_catalog.pg_backend_pid() AS backend_pid",
  );
  const backendPid = result.rows[0]?.backend_pid;
  if (
    result.command !== "SELECT" ||
    result.rowCount !== 1 ||
    !Number.isSafeInteger(backendPid) ||
    (backendPid as number) <= 0
  ) {
    throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  return backendPid as number;
}

async function verifyPostgresProjectionPoolConcurrentTenantIsolation(
  containerId: string,
  source: PooledPostgresFinancialFactProjectionSource,
  displayCase: RuntimeProjectionAcceptanceCase,
  selectBetaActor: () => void,
): Promise<void> {
  await withPostgresProjectionPoolTableLock(
    containerId,
    async (releaseLock) => {
      const initialBlockedBackendDeadline =
        Date.now() +
        POSTGRES_PROJECTION_POOL_BLOCKED_BACKEND_DEADLINE_MILLISECONDS;
      const alphaLoad = source.load(displayCase.query);
      selectBetaActor();
      const betaLoad = source.load(displayCase.query);
      const loads = [alphaLoad, betaLoad] as const;
      let thirdLoad: Promise<unknown> | null = null;
      try {
        const blockedPids = await waitForPostgresProjectionPoolBlockedBackends(
          containerId,
          2,
          initialBlockedBackendDeadline,
        );
        if (new Set(blockedPids).size !== 2) {
          throw new PostgresProjectionPoolError(
            "POSTGRES_PROJECTION_POOL_FAILURE",
          );
        }
        const queuedLoad = source.load(displayCase.query);
        thirdLoad = queuedLoad;
        await capturePostgresProjectionPoolError(
          () => queuedLoad,
          "POSTGRES_PROJECTION_POOL_TIMEOUT",
        );
        const stillBlockedPids =
          await waitForPostgresProjectionPoolBlockedBackends(
            containerId,
            2,
            initialBlockedBackendDeadline +
              POSTGRES_PROJECTION_POOL_CONNECTION_TIMEOUT_MILLISECONDS +
              250,
          );
        assertJsonEqual(
          stillBlockedPids,
          blockedPids,
          "B10 acquisition timeout preserved both leased backends",
        );
        await releaseLock();
        const [alphaResult, betaResult] = await Promise.all(loads);
        assertPostgresProjectionPoolResult(
          { ...displayCase, label: "B10 simultaneous alpha backend" },
          alphaResult,
        );
        assertPostgresProjectionPoolResult(
          {
            ...displayCase,
            label: "B10 simultaneous beta backend",
            principalId: PRINCIPAL_BETA,
            organizationId: ORGANIZATION_BETA,
          },
          betaResult,
        );
      } finally {
        await releaseLock();
        if (thirdLoad !== null) await Promise.allSettled([thirdLoad]);
        await Promise.allSettled(loads);
      }
    },
  );
}

async function verifyPostgresProjectionPoolActiveAbort(
  containerId: string,
  source: PooledPostgresFinancialFactProjectionSource,
  displayCase: RuntimeProjectionAcceptanceCase,
): Promise<number> {
  return withPostgresProjectionPoolTableLock(containerId, async () => {
    const controller = new AbortController();
    const secretCanary = "b10-active-abort-secret-canary";
    const loading = source.load(displayCase.query, {
      signal: controller.signal,
    });
    const [blockedPid] = await waitForPostgresProjectionPoolBlockedBackends(
      containerId,
      1,
    );
    if (blockedPid === undefined) {
      throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
    }
    controller.abort(new Error(secretCanary));
    const error = await capturePostgresProjectionPoolError(
      () => loading,
      "POSTGRES_PROJECTION_POOL_ABORTED",
    );
    if (String(error).includes(secretCanary)) {
      throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
    }
    await assertPostgresProjectionPoolBackendQuerySettled(
      containerId,
      blockedPid,
    );
    await waitForPostgresProjectionPoolBackendPidDrain(containerId, blockedPid);
    return blockedPid;
  });
}

async function verifyPostgresProjectionPoolStatementTimeout(
  containerId: string,
  source: PooledPostgresFinancialFactProjectionSource,
  displayCase: RuntimeProjectionAcceptanceCase,
): Promise<number> {
  return withPostgresProjectionPoolTableLock(containerId, async () => {
    const loading = source.load(displayCase.query);
    const [blockedPid] = await waitForPostgresProjectionPoolBlockedBackends(
      containerId,
      1,
    );
    if (blockedPid === undefined) {
      throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
    }
    await capturePostgresProjectionPoolError(
      () => loading,
      "POSTGRES_PROJECTION_POOL_TIMEOUT",
    );
    await waitForPostgresProjectionPoolBackendPidDrain(containerId, blockedPid);
    return blockedPid;
  });
}

async function capturePostgresProjectionPoolError(
  run: () => Promise<unknown>,
  expectedCode:
    | "POSTGRES_PROJECTION_POOL_FAILURE"
    | "POSTGRES_PROJECTION_POOL_ABORTED"
    | "POSTGRES_PROJECTION_POOL_TIMEOUT",
): Promise<PostgresProjectionPoolError> {
  let error: unknown;
  try {
    await run();
  } catch (caught) {
    error = caught;
  }
  if (
    !(error instanceof PostgresProjectionPoolError) ||
    error.code !== expectedCode ||
    error.message !== "PostgreSQL projection pool failed." ||
    Object.hasOwn(error, "cause")
  ) {
    throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  return error;
}

function postgresProjectionPoolHarnessError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error("B10 PostgreSQL projection-pool harness failed", {
        cause: error,
      });
}

function assertPostgresProjectionPoolResult(
  acceptanceCase: RuntimeProjectionAcceptanceCase,
  result: OperationProjectionSourceResult<FinancialFact> | null,
): void {
  if (result === null) {
    throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  assertRuntimeAuthenticatedFinancialFactProjectionResult(
    acceptanceCase,
    result,
  );
}

async function withPostgresProjectionPoolTableLock<T>(
  containerId: string,
  run: (releaseLock: () => Promise<void>) => Promise<T>,
): Promise<T> {
  const blockerState = { settled: false };
  const blockerOutcome: Promise<{
    result: CommandResult | null;
    error: unknown;
  }> = startPostgresProjectionPoolTableLock(containerId).then(
    (result) => {
      blockerState.settled = true;
      return { result, error: undefined };
    },
    (error: unknown) => {
      blockerState.settled = true;
      return { result: null, error };
    },
  );
  let blockerPid: number | null = null;
  let releasePromise: Promise<void> | null = null;
  let operationCompleted = false;
  let operationResult: T | undefined;
  let operationError: unknown;
  let cleanupError: unknown;

  try {
    const acquiredBlockerPid =
      await waitForPostgresProjectionPoolTableLock(containerId);
    blockerPid = acquiredBlockerPid;
    const releaseLock = () => {
      releasePromise ??= releasePostgresProjectionPoolTableLock(
        containerId,
        acquiredBlockerPid,
        blockerOutcome,
      );
      return releasePromise;
    };
    operationResult = await run(releaseLock);
    operationCompleted = true;
  } catch (error) {
    operationError = error;
  }

  try {
    if (blockerPid === null) {
      await terminatePostgresProjectionPoolTableLockByApplication(
        containerId,
        blockerState,
        blockerOutcome,
      );
    } else {
      releasePromise ??= releasePostgresProjectionPoolTableLock(
        containerId,
        blockerPid,
        blockerOutcome,
      );
      await releasePromise;
    }
  } catch (error) {
    cleanupError = error;
  }

  if (
    operationError !== undefined &&
    cleanupError !== undefined &&
    operationError !== cleanupError
  ) {
    throw new AggregateError(
      [operationError, cleanupError],
      "B10 projection table-lock probe and mandatory cleanup both failed",
      { cause: operationError },
    );
  }
  if (operationError !== undefined) {
    throw postgresProjectionPoolHarnessError(operationError);
  }
  if (cleanupError !== undefined) {
    throw postgresProjectionPoolHarnessError(cleanupError);
  }
  if (!operationCompleted) {
    throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  return operationResult as T;
}

async function releasePostgresProjectionPoolTableLock(
  containerId: string,
  blockerPid: number,
  blockerOutcome: Promise<{
    result: CommandResult | null;
    error: unknown;
  }>,
): Promise<void> {
  const errors: unknown[] = [];
  let canceled = false;
  try {
    assertEqual(
      await psqlScalar(
        containerId,
        `SELECT pg_catalog.pg_cancel_backend(${blockerPid});`,
      ),
      "t",
      "B10 projection table-lock release",
    );
    canceled = true;
  } catch (error) {
    errors.push(error);
  }
  if (!canceled) {
    try {
      await terminatePostgresProjectionPoolBackend(containerId, blockerPid);
    } catch (error) {
      errors.push(error);
    }
  }

  const outcome = await blockerOutcome;
  if (outcome.error !== undefined) {
    errors.push(outcome.error);
  } else if (
    canceled &&
    (outcome.result === null ||
      outcome.result.exitCode === 0 ||
      !outcome.result.stderr.includes("57014") ||
      !outcome.result.stderr.includes(
        "canceling statement due to user request",
      ))
  ) {
    errors.push(
      new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE"),
    );
  }
  try {
    await waitForPostgresProjectionPoolBackendPidDrain(containerId, blockerPid);
  } catch (error) {
    errors.push(error);
  }

  if (errors.length === 1) {
    throw postgresProjectionPoolHarnessError(errors[0]);
  }
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      "B10 projection table-lock release failed",
      {
        cause: errors[0],
      },
    );
  }
}

async function terminatePostgresProjectionPoolTableLockByApplication(
  containerId: string,
  blockerState: { settled: boolean },
  blockerOutcome: Promise<{
    result: CommandResult | null;
    error: unknown;
  }>,
): Promise<void> {
  const errors: unknown[] = [];
  const deadline = Date.now() + 5_000;
  while (!blockerState.settled && Date.now() < deadline) {
    try {
      const value = await psqlScalar(
        containerId,
        `SELECT coalesce(pg_catalog.string_agg(pid::text, ',' ORDER BY pid), '')
FROM pg_catalog.pg_stat_activity
WHERE application_name = '${POSTGRES_PROJECTION_POOL_BLOCKER_APPLICATION_NAME}'
  AND usename = 'postgres'
  AND backend_type = 'client backend';`,
      );
      const blockerPids = value === "" ? [] : value.split(",").map(Number);
      if (blockerPids.some((pid) => !Number.isSafeInteger(pid) || pid <= 0)) {
        throw new PostgresProjectionPoolError(
          "POSTGRES_PROJECTION_POOL_FAILURE",
        );
      }
      if (blockerPids.length > 0) {
        for (const pid of blockerPids) {
          await terminatePostgresProjectionPoolBackend(containerId, pid);
        }
        break;
      }
    } catch (error) {
      errors.push(error);
      break;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }

  const outcome = await blockerOutcome;
  if (outcome.error !== undefined) errors.push(outcome.error);
  try {
    assertEqual(
      await psqlScalar(
        containerId,
        `SELECT count(*) FROM pg_catalog.pg_stat_activity
WHERE application_name = '${POSTGRES_PROJECTION_POOL_BLOCKER_APPLICATION_NAME}'
  AND backend_type = 'client backend';`,
      ),
      "0",
      "B10 projection table-lock emergency cleanup",
    );
  } catch (error) {
    errors.push(error);
  }

  if (errors.length === 1) {
    throw postgresProjectionPoolHarnessError(errors[0]);
  }
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      "B10 projection table-lock emergency cleanup failed",
      { cause: errors[0] },
    );
  }
}

async function terminatePostgresProjectionPoolBackend(
  containerId: string,
  backendPid: number,
): Promise<void> {
  const terminated = await psqlScalar(
    containerId,
    `SELECT pg_catalog.pg_terminate_backend(${backendPid});`,
  );
  if (terminated !== "t" && terminated !== "f") {
    throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  await waitForPostgresProjectionPoolBackendPidDrain(containerId, backendPid);
}

function startPostgresProjectionPoolTableLock(
  containerId: string,
): Promise<CommandResult> {
  return dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      "--set=VERBOSITY=verbose",
      "--username=postgres",
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ],
    `SELECT pg_catalog.set_config(
  'application_name',
  '${POSTGRES_PROJECTION_POOL_BLOCKER_APPLICATION_NAME}',
  false
);
BEGIN;
LOCK TABLE shared_data.financial_facts IN ACCESS EXCLUSIVE MODE;
SELECT pg_catalog.pg_sleep(30);
ROLLBACK;
`,
  );
}

async function waitForPostgresProjectionPoolTableLock(
  containerId: string,
): Promise<number> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const value = await psqlScalar(
      containerId,
      `SELECT coalesce(pg_catalog.max(activity.pid)::text, '')
FROM pg_catalog.pg_stat_activity AS activity
JOIN pg_catalog.pg_locks AS lock ON lock.pid = activity.pid
JOIN pg_catalog.pg_class AS relation ON relation.oid = lock.relation
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = relation.relnamespace
WHERE activity.application_name = '${POSTGRES_PROJECTION_POOL_BLOCKER_APPLICATION_NAME}'
  AND activity.usename = 'postgres'
  AND activity.state = 'active'
  AND lock.mode = 'AccessExclusiveLock'
  AND lock.granted
  AND namespace.nspname = 'shared_data'
  AND relation.relname = 'financial_facts';`,
    );
    if (/^[1-9][0-9]*$/.test(value)) return Number(value);
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
}

async function waitForPostgresProjectionPoolBlockedBackends(
  containerId: string,
  expectedCount: 1 | 2,
  deadline = Date.now() +
    POSTGRES_PROJECTION_POOL_BLOCKED_BACKEND_DEADLINE_MILLISECONDS,
): Promise<number[]> {
  while (Date.now() < deadline) {
    const value = await psqlScalar(
      containerId,
      `SELECT coalesce(pg_catalog.string_agg(
  pid::text, ',' ORDER BY pid
), '')
FROM pg_catalog.pg_stat_activity
WHERE application_name = '${POSTGRES_PROJECTION_POOL_APPLICATION_NAME}'
  AND usename = '${RUNTIME_AUTH_LOGIN_ROLE}'
  AND state = 'active'
  AND wait_event_type = 'Lock'
  AND query LIKE 'WITH bounded_projection AS%';`,
    );
    const pids = value === "" ? [] : value.split(",").map(Number);
    if (
      Date.now() < deadline &&
      pids.length === expectedCount &&
      pids.every((pid) => Number.isSafeInteger(pid) && pid > 0)
    ) {
      return pids;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
}

async function assertPostgresProjectionPoolBackendQuerySettled(
  containerId: string,
  backendPid: number,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*) FROM pg_catalog.pg_stat_activity
WHERE pid = ${backendPid}
  AND state = 'active'
  AND wait_event_type = 'Lock'
  AND query LIKE 'WITH bounded_projection AS%';`,
    ),
    "0",
    "B10 PostgreSQL projection-pool backend query settled before source return",
  );
}

async function waitForPostgresProjectionPoolBackendPidDrain(
  containerId: string,
  backendPid: number,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (
      (await psqlScalar(
        containerId,
        `SELECT count(*) FROM pg_catalog.pg_stat_activity
WHERE pid = ${backendPid}
  AND backend_type = 'client backend';`,
      )) === "0"
    ) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
}

async function assertPostgresProjectionPoolReplacementBackend(
  containerId: string,
  discardedBackendPids: readonly number[],
): Promise<void> {
  const value = await psqlScalar(
    containerId,
    `SELECT coalesce(pg_catalog.string_agg(
  pid::text, ',' ORDER BY pid
), '')
FROM pg_catalog.pg_stat_activity
WHERE application_name = '${POSTGRES_PROJECTION_POOL_APPLICATION_NAME}'
  AND usename = '${RUNTIME_AUTH_LOGIN_ROLE}'
  AND state = 'idle'
  AND backend_type = 'client backend';`,
  );
  const backendPids = value === "" ? [] : value.split(",").map(Number);
  if (
    backendPids.length < 1 ||
    backendPids.length > POSTGRES_PROJECTION_POOL_MAX ||
    backendPids.some((pid) => discardedBackendPids.includes(pid)) ||
    backendPids.some((pid) => !Number.isSafeInteger(pid) || pid <= 0)
  ) {
    throw new PostgresProjectionPoolError("POSTGRES_PROJECTION_POOL_FAILURE");
  }
}

async function assertPostgresProjectionPoolBackendResidueAbsent(
  containerId: string,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*) FROM pg_catalog.pg_stat_activity
WHERE application_name IN (
  '${POSTGRES_PROJECTION_POOL_APPLICATION_NAME}',
  '${POSTGRES_PROJECTION_POOL_BLOCKER_APPLICATION_NAME}'
)
  AND backend_type = 'client backend';`,
    ),
    "0",
    "B10 PostgreSQL projection-pool backend residue",
  );
}

async function verifyAuthenticatedBackupAndBoundedRestore(
  containerId: string,
  migrationPlan: AuthenticatedMigrationPlan,
  backupRestorePlan: AuthenticatedBackupRestorePlan,
): Promise<void> {
  await verifyAuthenticatedBackupRestoreResidueAbsent(containerId);
  const sourceBefore = await collectAuthenticatedBackupFingerprints(
    containerId,
    CLEAN_BOOTSTRAP_DATABASE_NAME,
  );

  let probeFailed = false;
  let probeError: unknown;
  let cleanupFailed = false;
  let cleanupError: unknown;
  try {
    const archiveSha256 =
      await createAuthenticatedPolicyScopedBackup(containerId);
    const sourceAfterDump = await collectAuthenticatedBackupFingerprints(
      containerId,
      CLEAN_BOOTSTRAP_DATABASE_NAME,
    );
    assertAuthenticatedBackupFingerprintsEqual(
      sourceAfterDump,
      sourceBefore,
      "source data changed while producing the authenticated backup",
    );

    await createBoundedRestoreTarget(
      containerId,
      migrationPlan,
      backupRestorePlan,
    );
    await verifyRestorableApplicationTablesEmpty(containerId);
    await restoreAuthenticatedPolicyScopedBackup(containerId, archiveSha256);

    const restored = await collectAuthenticatedBackupFingerprints(
      containerId,
      AUTHENTICATED_RESTORE_DATABASE,
    );
    assertAuthenticatedBackupFingerprintsEqual(
      restored,
      sourceBefore,
      "restored application data differs from the authenticated backup source",
    );
    const expectedLedgerRows = expectedAuthenticatedMigrationLedgerRows(
      migrationPlan.manifest,
    );
    const expectedLedger = expectedLedgerRows.map(
      ({ migrationId, fileName, sha256 }) =>
        `${migrationId}|${fileName}|${sha256}`,
    );
    await verifyMigrationLedger(
      containerId,
      expectedLedger,
      AUTHENTICATED_RESTORE_DATABASE,
    );
    await verifyCatalogContract(containerId, AUTHENTICATED_RESTORE_DATABASE);
    await verifyB7PlatformArtifactsAfterApplication(
      containerId,
      AUTHENTICATED_RESTORE_DATABASE,
    );
    await verifyBackupCapability(containerId, AUTHENTICATED_RESTORE_DATABASE);
    await verifyContextCleanup(containerId, AUTHENTICATED_RESTORE_DATABASE);
    await verifyRuntimeAuthorizationMatrix(
      runtimeAuthorizationMatrixClient(
        containerId,
        "impersonated",
        AUTHENTICATED_RESTORE_DATABASE,
      ),
    );
    await verifyWriteDenials(containerId, AUTHENTICATED_RESTORE_DATABASE);

    const sourceAfterRestore = await collectAuthenticatedBackupFingerprints(
      containerId,
      CLEAN_BOOTSTRAP_DATABASE_NAME,
    );
    assertAuthenticatedBackupFingerprintsEqual(
      sourceAfterRestore,
      sourceBefore,
      "source data changed during bounded restore verification",
    );
    assertEqual(
      await authenticatedBackupArchiveSha256(containerId),
      archiveSha256,
      "authenticated backup archive after restore verification",
    );
  } catch (error) {
    probeFailed = true;
    probeError = error;
  } finally {
    try {
      throwRuntimeAuthOperationFailures(
        await collectRuntimeAuthOperationFailures([
          {
            label: "B8 ephemeral principals and files cleanup",
            run: () =>
              cleanupAuthenticatedBackupRestoreFilesAndRoles(containerId),
          },
          {
            label: "B8 bounded restore database cleanup",
            run: () => dropBoundedRestoreTargetIfPresent(containerId),
          },
          {
            label: "B8 final residue verification",
            run: () =>
              verifyAuthenticatedBackupRestoreResidueAbsent(containerId),
          },
        ]),
        "Authenticated backup/restore cleanup failed",
      );
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
    }
  }

  if (probeFailed && cleanupFailed) {
    throw new AggregateError(
      [probeError, cleanupError],
      "Authenticated backup/restore probe and mandatory cleanup both failed",
      { cause: probeError },
    );
  }
  if (probeFailed) throw probeError;
  if (cleanupFailed) throw cleanupError;
}

async function createBoundedRestoreTarget(
  containerId: string,
  migrationPlan: AuthenticatedMigrationPlan,
  backupRestorePlan: AuthenticatedBackupRestorePlan,
): Promise<void> {
  await psqlMaintenance(
    containerId,
    renderCreateAuthenticatedRestoreDatabaseSql(),
  );
  await verifyB8PristineRestoreTarget(containerId);
  await expectPsqlFailure(
    containerId,
    renderAuthenticatedRestorePlatform(backupRestorePlan, true),
    {
      label: "injected B8 restore-platform rollback",
      sqlState: "22012",
      message: "division by zero",
    },
    AUTHENTICATED_RESTORE_DATABASE,
  );
  await verifyB8PristineRestoreTarget(containerId);

  const platformResult = await psql(
    containerId,
    renderAuthenticatedRestorePlatform(backupRestorePlan),
    AUTHENTICATED_RESTORE_DATABASE,
  );
  assertEqual(
    platformResult.stderr.trim(),
    "",
    "B8 restore-platform diagnostics",
  );
  await verifyAuthenticatedMigrationPlatformState(
    containerId,
    0,
    AUTHENTICATED_RESTORE_DATABASE,
  );
  await expectPsqlFailure(
    containerId,
    renderAuthenticatedRestorePlatform(backupRestorePlan),
    {
      label: "B8 restore-platform replay",
      sqlState: "P0001",
      message: "restore platform bootstrap requires a pristine target",
    },
    AUTHENTICATED_RESTORE_DATABASE,
  );
  await verifyAuthenticatedMigrationPlatformState(
    containerId,
    0,
    AUTHENTICATED_RESTORE_DATABASE,
  );

  const expectedLedgerRows = expectedAuthenticatedMigrationLedgerRows(
    migrationPlan.manifest,
  );
  await verifyAuthenticatedApplicationMigrationSession(
    containerId,
    migrationPlan,
    expectedLedgerRows,
    AUTHENTICATED_RESTORE_DATABASE,
  );
  await verifyAuthenticatedMigrationLedger(
    containerId,
    expectedLedgerRows,
    AUTHENTICATED_RESTORE_DATABASE,
  );
  await verifyCatalogContract(containerId, AUTHENTICATED_RESTORE_DATABASE);
  await verifyB7PlatformArtifactsAfterApplication(
    containerId,
    AUTHENTICATED_RESTORE_DATABASE,
  );
}

async function verifyB8PristineRestoreTarget(
  containerId: string,
): Promise<void> {
  assertEqual(
    await psqlMaintenanceScalar(
      containerId,
      `SELECT datname || '|' || pg_catalog.pg_get_userbyid(datdba) || '|' ||
  datistemplate || '|' || datallowconn || '|' || datconnlimit || '|' ||
  pg_catalog.pg_encoding_to_char(encoding)
FROM pg_catalog.pg_database
WHERE datname = '${AUTHENTICATED_RESTORE_DATABASE}';`,
    ),
    `${AUTHENTICATED_RESTORE_DATABASE}|postgres|false|true|-1|UTF8`,
    "B8 pristine restore database identity",
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT (
  SELECT count(*) FROM pg_catalog.pg_namespace
  WHERE nspname IN ('private_data', 'shared_data')
) || '|' || (
  SELECT count(*) FROM pg_catalog.pg_extension
  WHERE extname = 'btree_gist'
) || '|' || (
  SELECT count(*)
  FROM pg_catalog.pg_default_acl AS defaults
  JOIN pg_catalog.pg_roles AS role ON role.oid = defaults.defaclrole
  WHERE role.rolname = 'research_cockpit_owner'
);`,
      AUTHENTICATED_RESTORE_DATABASE,
    ),
    "0|0|0",
    "B8 pristine restore platform artifacts",
  );
  assertJsonEqual(
    splitLines(
      await psqlScalar(
        containerId,
        `SELECT CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_database AS database
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(database.datacl, pg_catalog.acldefault('d', database.datdba))
) AS privilege
WHERE database.datname = pg_catalog.current_database()
  AND privilege.grantee <> database.datdba
ORDER BY 1;`,
        AUTHENTICATED_RESTORE_DATABASE,
      ),
    ),
    [`PUBLIC|CONNECT|${CATALOG_FALSE}`, `PUBLIC|TEMPORARY|${CATALOG_FALSE}`],
    "B8 pristine restore database ACL",
  );
  assertJsonEqual(
    splitLines(
      await psqlScalar(
        containerId,
        `SELECT CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_namespace AS namespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))
) AS privilege
WHERE namespace.nspname = 'public'
  AND privilege.grantee <> namespace.nspowner
ORDER BY 1;`,
        AUTHENTICATED_RESTORE_DATABASE,
      ),
    ),
    [`PUBLIC|USAGE|${CATALOG_FALSE}`],
    "B8 pristine restore public-schema ACL",
  );
  assertJsonEqual(
    splitLines(
      await psqlScalar(
        containerId,
        `SELECT rolname || '|' || rolcanlogin || '|' || rolsuper || '|' ||
  rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' ||
  rolinherit || '|' || rolbypassrls
FROM pg_catalog.pg_roles
WHERE rolname <> 'postgres'
  AND pg_catalog.left(rolname, 3) <> 'pg_'
ORDER BY rolname;`,
        AUTHENTICATED_RESTORE_DATABASE,
      ),
    ),
    EXPECTED_CAPABILITY_ROLE_ATTRIBUTE_ROWS,
    "B8 pristine restore capability roles",
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*)
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
WHERE granted_role.rolname LIKE 'research_cockpit_%'
   OR member_role.rolname LIKE 'research_cockpit_%';`,
      AUTHENTICATED_RESTORE_DATABASE,
    ),
    "0",
    "B8 pristine restore capability membership edges",
  );
}

async function createAuthenticatedPolicyScopedBackup(
  containerId: string,
): Promise<string> {
  const password = generateAuthenticatedBackupRestorePassword();
  let wrongPassword = generateAuthenticatedBackupRestorePassword();
  while (wrongPassword === password) {
    wrongPassword = generateAuthenticatedBackupRestorePassword();
  }

  let probeFailed = false;
  let probeError: unknown;
  let cleanupFailed = false;
  let cleanupError: unknown;
  let archiveSha256 = "";
  try {
    await provisionAuthenticatedBackupLogin(containerId, password);
    await verifyAuthenticatedBackupLoginCatalog(containerId);
    await writeAuthenticatedBackupRestoreFile(
      containerId,
      AUTHENTICATED_BACKUP_PASSFILE,
      renderAuthenticatedBackupPassfile(password),
    );
    await writeAuthenticatedBackupRestoreFile(
      containerId,
      AUTHENTICATED_BACKUP_WRONG_PASSFILE,
      renderAuthenticatedBackupPassfile(wrongPassword),
    );
    for (const archive of AUTHENTICATED_BACKUP_ARCHIVE_PATHS) {
      await createAuthenticatedBackupArchivePath(containerId, archive);
    }

    await verifyAuthenticatedBackupWrongPassword(containerId);
    await verifyAuthenticatedBackupLoginBeforeSetRole(containerId);
    await verifyAuthenticatedBackupRoleEscalationDenials(containerId);
    await verifyAuthenticatedBackupCapabilitySession(containerId);
    await verifyAuthenticatedBackupFailClosedVariants(containerId);

    const invocation = buildAuthenticatedBackupDumpInvocation();
    const result = await runRuntimeAuthCommandWithDrain(
      () =>
        dockerExecWithEnvironment(
          containerId,
          invocation.environment,
          invocation.command,
        ),
      () => waitForAuthenticatedBackupBackendDrain(containerId),
    );
    if (
      result.exitCode !== 0 ||
      result.stdout.trim() !== "" ||
      result.stderr.trim() !== ""
    ) {
      throw new Error("Authenticated policy-scoped pg_dump failed");
    }
    await verifyAuthenticatedBackupArchiveFile(containerId);
    const tocResult = await dockerExec(containerId, [
      "pg_restore",
      "--list",
      AUTHENTICATED_BACKUP_ARCHIVE,
    ]);
    assertSuccess(tocResult, "inspect authenticated backup archive TOC");
    if (tocResult.stderr.trim() !== "") {
      throw new Error("Authenticated backup archive TOC returned diagnostics");
    }
    const toc = parseAuthenticatedBackupArchiveToc(tocResult.stdout);
    assertEqual(
      String(toc.length),
      String(AUTHENTICATED_BACKUP_RESTORABLE_TABLES.length),
      "authenticated backup archive TABLE DATA count",
    );
    if (
      toc.findIndex(
        ({ qualifiedTable }) =>
          qualifiedTable === AUTHENTICATED_RESTORE_FAILURE_TABLE,
      ) <= 0
    ) {
      throw new Error(
        "Authenticated backup archive cannot exercise a late restore failure",
      );
    }
    archiveSha256 = await authenticatedBackupArchiveSha256(containerId);
  } catch (error) {
    probeFailed = true;
    probeError = error;
  } finally {
    try {
      throwRuntimeAuthOperationFailures(
        await collectRuntimeAuthOperationFailures([
          {
            label: "authenticated backup backend drain",
            run: () => waitForAuthenticatedBackupBackendDrain(containerId),
          },
          ...[
            AUTHENTICATED_BACKUP_PASSFILE,
            AUTHENTICATED_BACKUP_WRONG_PASSFILE,
            AUTHENTICATED_BACKUP_NO_ROLE_ARCHIVE,
            AUTHENTICATED_BACKUP_NO_RLS_ARCHIVE,
            AUTHENTICATED_BACKUP_WRONG_PASSWORD_ARCHIVE,
          ].map((path) => ({
            label: `remove authenticated backup probe file: ${path}`,
            run: () => removeContainerPath(containerId, path),
          })),
          {
            label: "drop authenticated backup login",
            run: () =>
              psql(containerId, renderAuthenticatedBackupCleanupSql()).then(
                () => undefined,
              ),
          },
          {
            label: "verify authenticated backup login residue",
            run: () =>
              verifyEphemeralLoginResidueAbsent(
                containerId,
                AUTHENTICATED_BACKUP_LOGIN_ROLE,
                [
                  AUTHENTICATED_BACKUP_PASSFILE,
                  AUTHENTICATED_BACKUP_WRONG_PASSFILE,
                  AUTHENTICATED_BACKUP_NO_ROLE_ARCHIVE,
                  AUTHENTICATED_BACKUP_NO_RLS_ARCHIVE,
                  AUTHENTICATED_BACKUP_WRONG_PASSWORD_ARCHIVE,
                ],
              ),
          },
        ]),
        "Authenticated backup cleanup failed",
      );
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
    }
  }

  if (probeFailed && cleanupFailed) {
    throw new AggregateError(
      [probeError, cleanupError],
      "Authenticated backup probe and cleanup both failed",
      { cause: probeError },
    );
  }
  if (probeFailed) throw probeError;
  if (cleanupFailed) throw cleanupError;
  if (!/^[0-9a-f]{64}$/.test(archiveSha256)) {
    throw new Error("Authenticated backup archive hash was not collected");
  }
  return archiveSha256;
}

async function provisionAuthenticatedBackupLogin(
  containerId: string,
  password: string,
): Promise<void> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ],
    renderAuthenticatedBackupProvisioningSql(password),
  );
  assertSensitiveCommandSuccess(result, "provision authenticated backup login");
}

async function verifyAuthenticatedBackupLoginCatalog(
  containerId: string,
): Promise<void> {
  await verifyEphemeralLoginCatalog(
    containerId,
    AUTHENTICATED_BACKUP_LOGIN_ROLE,
    AUTHENTICATED_BACKUP_CAPABILITY_ROLE,
  );
}

async function verifyAuthenticatedBackupWrongPassword(
  containerId: string,
): Promise<void> {
  const invocation = buildAuthenticatedBackupPsqlInvocation({
    passfile: AUTHENTICATED_BACKUP_WRONG_PASSFILE,
    requireScram: false,
  });
  const result = await runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        invocation.environment,
        invocation.command,
        "SELECT 1;",
      ),
    () => waitForAuthenticatedBackupBackendDrain(containerId),
  );
  assertAuthenticatedBackupWrongPasswordRejection(result);
}

async function verifyAuthenticatedBackupLoginBeforeSetRole(
  containerId: string,
): Promise<void> {
  const identity = parseJsonObject(
    await authenticatedBackupPsqlScalar(
      containerId,
      renderAuthenticatedLoginIdentitySql(
        AUTHENTICATED_BACKUP_CAPABILITY_ROLE,
        "backup",
      ),
    ),
  );
  assertJsonEqual(
    identity,
    authenticatedLoginIdentityExpectation(
      AUTHENTICATED_BACKUP_LOGIN_ROLE,
      "backup",
    ),
    "authenticated backup login identity before SET ROLE",
  );
  for (const [label, sql, message] of [
    [
      "backup login data access before SET ROLE",
      "SELECT count(*) FROM private_data.organizations;",
      "permission denied for schema private_data",
    ],
    [
      "backup login context routine before SET ROLE",
      `CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'display', 'api', 'demo_only', 'synthetic'
);`,
      "permission denied for schema private_data",
    ],
    [
      "backup login temporary DDL before SET ROLE",
      "CREATE TEMPORARY TABLE b8_backup_pre_role_escape (id integer);",
      "permission denied to create temporary tables",
    ],
  ] as const) {
    await expectAuthenticatedBackupPsqlFailure(containerId, sql, {
      label,
      sqlState: "42501",
      message,
    });
  }
}

async function verifyAuthenticatedBackupRoleEscalationDenials(
  containerId: string,
): Promise<void> {
  for (const role of AUTHENTICATED_BACKUP_FORBIDDEN_SET_ROLES) {
    await expectAuthenticatedBackupPsqlFailure(
      containerId,
      `SET ROLE ${role};`,
      {
        label: `backup login SET ROLE ${role}`,
        sqlState: "42501",
        message: "permission denied to set role",
      },
    );
  }
  for (const role of [
    AUTHENTICATED_BACKUP_CAPABILITY_ROLE,
    "postgres",
  ] as const) {
    await expectAuthenticatedBackupPsqlFailure(
      containerId,
      `SET SESSION AUTHORIZATION ${role};`,
      {
        label: `backup login SET SESSION AUTHORIZATION ${role}`,
        sqlState: "42501",
        message: "permission denied to set session authorization",
      },
    );
  }
}

async function verifyAuthenticatedBackupCapabilitySession(
  containerId: string,
): Promise<void> {
  const visibility = parseJsonObject(
    await authenticatedBackupPsqlScalar(
      containerId,
      `BEGIN;
SET LOCAL ROLE ${AUTHENTICATED_BACKUP_CAPABILITY_ROLE};
SELECT pg_catalog.json_build_object(
  'organizations', (SELECT count(*) FROM private_data.organizations),
  'evidence', (SELECT count(*) FROM shared_data.evidence)
)::text;
COMMIT;`,
    ),
  );
  assertJsonEqual(
    visibility,
    { organizations: 2, evidence: 5 },
    "authenticated backup synthetic visibility",
  );
  await expectAuthenticatedBackupPsqlFailure(
    containerId,
    `BEGIN;
SET LOCAL ROLE ${AUTHENTICATED_BACKUP_CAPABILITY_ROLE};
INSERT INTO private_data.organizations (id, slug, name, created_at)
VALUES (
  '10000000-0000-4000-8000-000000000094',
  'authenticated-backup-write-probe',
  'Authenticated backup write probe',
  transaction_timestamp()
);
ROLLBACK;`,
    {
      label: "authenticated backup write",
      sqlState: "42501",
      message: "permission denied for table organizations",
    },
  );

  for (const [label, sql, message] of [
    [
      "authenticated backup update",
      "UPDATE private_data.organizations SET name = name WHERE false;",
      "permission denied for table organizations",
    ],
    [
      "authenticated backup delete",
      "DELETE FROM private_data.organizations WHERE false;",
      "permission denied for table organizations",
    ],
    [
      "authenticated backup truncate",
      "TRUNCATE private_data.organizations;",
      "permission denied for table organizations",
    ],
    [
      "authenticated backup context mutation",
      `CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'display', 'api', 'demo_only', 'synthetic'
);`,
      "permission denied for procedure set_request_context",
    ],
    [
      "authenticated backup persistent DDL",
      "CREATE TABLE private_data.b8_backup_escape (id integer);",
      "permission denied for schema private_data",
    ],
    [
      "authenticated backup temporary DDL",
      "CREATE TEMPORARY TABLE b8_backup_escape (id integer);",
      "permission denied to create temporary tables",
    ],
  ] as const) {
    await expectAuthenticatedBackupPsqlFailure(
      containerId,
      `BEGIN;
SET LOCAL ROLE ${AUTHENTICATED_BACKUP_CAPABILITY_ROLE};
${sql}
ROLLBACK;`,
      { label, sqlState: "42501", message },
    );
  }
}

async function verifyAuthenticatedBackupFailClosedVariants(
  containerId: string,
): Promise<void> {
  const wrongPassword = buildAuthenticatedBackupDumpInvocation({
    archive: AUTHENTICATED_BACKUP_WRONG_PASSWORD_ARCHIVE,
    passfile: AUTHENTICATED_BACKUP_WRONG_PASSFILE,
    requireScram: false,
  });
  const wrongPasswordResult = await runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        wrongPassword.environment,
        wrongPassword.command,
      ),
    () => waitForAuthenticatedBackupBackendDrain(containerId),
  );
  if (
    wrongPasswordResult.exitCode !== 1 ||
    wrongPasswordResult.stdout.trim() !== "" ||
    !wrongPasswordResult.stderr
      .toLowerCase()
      .replace(/\s+/g, " ")
      .includes(
        `fatal: password authentication failed for user "${AUTHENTICATED_BACKUP_LOGIN_ROLE}"`,
      )
  ) {
    throw new Error(
      "Wrong-password authenticated pg_dump did not fail for the expected reason",
    );
  }

  const noRole = buildAuthenticatedBackupDumpInvocation({
    archive: AUTHENTICATED_BACKUP_NO_ROLE_ARCHIVE,
    selectCapabilityRole: false,
  });
  const noRoleResult = await runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        noRole.environment,
        noRole.command,
      ),
    () => waitForAuthenticatedBackupBackendDrain(containerId),
  );
  if (
    noRoleResult.exitCode !== 1 ||
    noRoleResult.stdout.trim() !== "" ||
    !noRoleResult.stderr.toLowerCase().includes("permission denied")
  ) {
    throw new Error(
      "Authenticated pg_dump without the backup role did not fail closed",
    );
  }

  const noRowSecurity = buildAuthenticatedBackupDumpInvocation({
    archive: AUTHENTICATED_BACKUP_NO_RLS_ARCHIVE,
    enableRowSecurity: false,
  });
  const noRowSecurityResult = await runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        noRowSecurity.environment,
        noRowSecurity.command,
      ),
    () => waitForAuthenticatedBackupBackendDrain(containerId),
  );
  if (
    noRowSecurityResult.exitCode !== 1 ||
    noRowSecurityResult.stdout.trim() !== "" ||
    !noRowSecurityResult.stderr
      .toLowerCase()
      .includes("would be affected by row-level security policy")
  ) {
    throw new Error(
      "Authenticated pg_dump without row-security enablement did not fail closed",
    );
  }
}

async function authenticatedBackupPsqlScalar(
  containerId: string,
  sql: string,
): Promise<string> {
  const result = await authenticatedBackupPsql(containerId, sql);
  assertSuccess(result, "execute authenticated backup SQL");
  return result.stdout.trim();
}

async function expectAuthenticatedBackupPsqlFailure(
  containerId: string,
  sql: string,
  expectation: PsqlFailureExpectation,
): Promise<void> {
  const result = await authenticatedBackupPsql(containerId, sql, true);
  assertExpectedPsqlFailure(result, expectation);
}

async function authenticatedBackupPsql(
  containerId: string,
  sql: string,
  verboseErrors = false,
): Promise<CommandResult> {
  const invocation = buildAuthenticatedBackupPsqlInvocation({ verboseErrors });
  return runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        invocation.environment,
        invocation.command,
        sql,
      ),
    () => waitForAuthenticatedBackupBackendDrain(containerId),
  );
}

async function waitForAuthenticatedBackupBackendDrain(
  containerId: string,
): Promise<void> {
  await psql(containerId, renderAuthenticatedBackupBackendDrainSql());
}

async function createAuthenticatedBackupArchivePath(
  containerId: string,
  path: (typeof AUTHENTICATED_BACKUP_ARCHIVE_PATHS)[number],
): Promise<void> {
  await verifyContainerPathAbsent(containerId, path);
  const install = await dockerExec(containerId, [
    "install",
    "--mode=0600",
    "/dev/null",
    path,
  ]);
  assertSuccess(install, "create authenticated backup archive path");
  await verifyContainerRegularFile(containerId, path, "backup archive");
}

async function verifyAuthenticatedBackupArchiveFile(
  containerId: string,
): Promise<void> {
  await verifyContainerRegularFile(
    containerId,
    AUTHENTICATED_BACKUP_ARCHIVE,
    "authenticated backup archive",
  );
  const size = await dockerExec(containerId, [
    "stat",
    "--format=%s",
    AUTHENTICATED_BACKUP_ARCHIVE,
  ]);
  assertSuccess(size, "inspect authenticated backup archive size");
  const parsed = Number(size.stdout.trim());
  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0 ||
    parsed > AUTHENTICATED_BACKUP_MAX_ARCHIVE_BYTES
  ) {
    throw new Error("Authenticated backup archive size is outside the bound");
  }
}

async function authenticatedBackupArchiveSha256(
  containerId: string,
): Promise<string> {
  const result = await dockerExec(containerId, [
    "sha256sum",
    "--",
    AUTHENTICATED_BACKUP_ARCHIVE,
  ]);
  assertSuccess(result, "hash authenticated backup archive");
  if (result.stderr.trim() !== "") {
    throw new Error("Authenticated backup archive hash returned diagnostics");
  }
  const hash = result.stdout.trim().split(/\s+/)[0] ?? "";
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error("Authenticated backup archive hash is malformed");
  }
  return hash;
}

async function restoreAuthenticatedPolicyScopedBackup(
  containerId: string,
  archiveSha256: string,
): Promise<void> {
  const password = generateAuthenticatedBackupRestorePassword();
  let wrongPassword = generateAuthenticatedBackupRestorePassword();
  while (wrongPassword === password) {
    wrongPassword = generateAuthenticatedBackupRestorePassword();
  }

  let probeFailed = false;
  let probeError: unknown;
  let cleanupFailed = false;
  let cleanupError: unknown;
  try {
    await provisionAuthenticatedRestoreLogin(containerId, password);
    await verifyAuthenticatedRestoreLoginCatalog(containerId);
    await writeAuthenticatedBackupRestoreFile(
      containerId,
      AUTHENTICATED_RESTORE_PASSFILE,
      renderAuthenticatedRestorePassfile(password),
    );
    await writeAuthenticatedBackupRestoreFile(
      containerId,
      AUTHENTICATED_RESTORE_WRONG_PASSFILE,
      renderAuthenticatedRestorePassfile(wrongPassword),
    );
    await verifyAuthenticatedRestoreWrongPassword(containerId);
    await verifyAuthenticatedRestoreLoginBeforeSetRole(containerId);
    await verifyAuthenticatedRestoreRoleEscalationDenials(containerId);
    await verifyAuthenticatedRestoreFailClosedVariants(
      containerId,
      archiveSha256,
    );

    await psql(
      containerId,
      renderAuthenticatedRestoreFailureCreateSql(),
      AUTHENTICATED_RESTORE_DATABASE,
    );
    const failedRestore = await runAuthenticatedRestoreCommand(containerId);
    if (
      failedRestore.exitCode !== 1 ||
      failedRestore.stdout.trim() !== "" ||
      !failedRestore.stderr.includes(AUTHENTICATED_RESTORE_FAILURE_MESSAGE)
    ) {
      throw new Error(
        "Injected authenticated restore did not fail for the reviewed reason",
      );
    }
    assertEqual(
      await authenticatedBackupArchiveSha256(containerId),
      archiveSha256,
      "authenticated backup archive after failed restore",
    );
    await verifyRestorableApplicationTablesEmpty(containerId);
    await psql(
      containerId,
      renderAuthenticatedRestoreFailureCleanupSql(),
      AUTHENTICATED_RESTORE_DATABASE,
    );
    assertEqual(
      await psqlScalar(
        containerId,
        renderAuthenticatedRestoreFailureResidueSql(),
        AUTHENTICATED_RESTORE_DATABASE,
      ),
      "0|0",
      "B8 restore-failure trigger and routine residue",
    );

    const restored = await runAuthenticatedRestoreCommand(containerId);
    if (
      restored.exitCode !== 0 ||
      restored.stdout.trim() !== "" ||
      restored.stderr.trim() !== ""
    ) {
      throw new Error("Authenticated bounded pg_restore failed");
    }
    assertEqual(
      await authenticatedBackupArchiveSha256(containerId),
      archiveSha256,
      "authenticated backup archive after successful restore",
    );

    const replay = await runAuthenticatedRestoreCommand(containerId);
    if (
      replay.exitCode !== 1 ||
      replay.stdout.trim() !== "" ||
      !replay.stderr.toLowerCase().includes("duplicate key")
    ) {
      throw new Error(
        "Authenticated bounded restore replay did not fail closed",
      );
    }
    assertEqual(
      await authenticatedBackupArchiveSha256(containerId),
      archiveSha256,
      "authenticated backup archive after restore replay",
    );
  } catch (error) {
    probeFailed = true;
    probeError = error;
  } finally {
    try {
      throwRuntimeAuthOperationFailures(
        await collectRuntimeAuthOperationFailures([
          {
            label: "authenticated restore backend drain",
            run: () => waitForAuthenticatedRestoreBackendDrain(containerId),
          },
          ...[
            AUTHENTICATED_RESTORE_PASSFILE,
            AUTHENTICATED_RESTORE_WRONG_PASSFILE,
          ].map((path) => ({
            label: `remove authenticated restore passfile: ${path}`,
            run: () => removeContainerPath(containerId, path),
          })),
          {
            label: "drop authenticated restore login",
            run: () =>
              psql(containerId, renderAuthenticatedRestoreCleanupSql()).then(
                () => undefined,
              ),
          },
          {
            label: "verify authenticated restore login residue",
            run: () =>
              verifyEphemeralLoginResidueAbsent(
                containerId,
                AUTHENTICATED_RESTORE_LOGIN_ROLE,
                [
                  AUTHENTICATED_RESTORE_PASSFILE,
                  AUTHENTICATED_RESTORE_WRONG_PASSFILE,
                ],
              ),
          },
        ]),
        "Authenticated restore cleanup failed",
      );
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
    }
  }

  if (probeFailed && cleanupFailed) {
    throw new AggregateError(
      [probeError, cleanupError],
      "Authenticated restore probe and cleanup both failed",
      { cause: probeError },
    );
  }
  if (probeFailed) throw probeError;
  if (cleanupFailed) throw cleanupError;
}

async function provisionAuthenticatedRestoreLogin(
  containerId: string,
  password: string,
): Promise<void> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      `--dbname=${AUTHENTICATED_RESTORE_DATABASE}`,
    ],
    renderAuthenticatedRestoreProvisioningSql(password),
  );
  assertSensitiveCommandSuccess(
    result,
    "provision authenticated restore login",
  );
}

async function verifyAuthenticatedRestoreLoginCatalog(
  containerId: string,
): Promise<void> {
  await verifyEphemeralLoginCatalog(
    containerId,
    AUTHENTICATED_RESTORE_LOGIN_ROLE,
    AUTHENTICATED_RESTORE_CAPABILITY_ROLE,
    AUTHENTICATED_RESTORE_DATABASE,
  );
}

async function verifyAuthenticatedRestoreWrongPassword(
  containerId: string,
): Promise<void> {
  const invocation = buildAuthenticatedRestorePsqlInvocation({
    passfile: AUTHENTICATED_RESTORE_WRONG_PASSFILE,
    requireScram: false,
  });
  const result = await runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        invocation.environment,
        invocation.command,
        "SELECT 1;",
      ),
    () => waitForAuthenticatedRestoreBackendDrain(containerId),
  );
  assertAuthenticatedRestoreWrongPasswordRejection(result);
}

async function verifyAuthenticatedRestoreLoginBeforeSetRole(
  containerId: string,
): Promise<void> {
  const identity = parseJsonObject(
    await authenticatedRestorePsqlScalar(
      containerId,
      renderAuthenticatedLoginIdentitySql(
        AUTHENTICATED_RESTORE_CAPABILITY_ROLE,
        "restore",
      ),
    ),
  );
  assertJsonEqual(
    identity,
    authenticatedLoginIdentityExpectation(
      AUTHENTICATED_RESTORE_LOGIN_ROLE,
      "restore",
    ),
    "authenticated restore login identity before SET ROLE",
  );
  for (const [label, sql, message] of [
    [
      "restore login data access before SET ROLE",
      "SELECT count(*) FROM private_data.organizations;",
      "permission denied for schema private_data",
    ],
    [
      "restore login context routine before SET ROLE",
      `CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'display', 'api', 'demo_only', 'synthetic'
);`,
      "permission denied for schema private_data",
    ],
    [
      "restore login temporary DDL before SET ROLE",
      "CREATE TEMPORARY TABLE b8_restore_pre_role_escape (id integer);",
      "permission denied to create temporary tables",
    ],
  ] as const) {
    await expectAuthenticatedRestorePsqlFailure(containerId, sql, {
      label,
      sqlState: "42501",
      message,
    });
  }
}

async function verifyAuthenticatedRestoreRoleEscalationDenials(
  containerId: string,
): Promise<void> {
  for (const role of AUTHENTICATED_RESTORE_FORBIDDEN_SET_ROLES) {
    await expectAuthenticatedRestorePsqlFailure(
      containerId,
      `SET ROLE ${role};`,
      {
        label: `restore login SET ROLE ${role}`,
        sqlState: "42501",
        message: "permission denied to set role",
      },
    );
  }
  for (const role of [
    AUTHENTICATED_RESTORE_CAPABILITY_ROLE,
    "postgres",
  ] as const) {
    await expectAuthenticatedRestorePsqlFailure(
      containerId,
      `SET SESSION AUTHORIZATION ${role};`,
      {
        label: `restore login SET SESSION AUTHORIZATION ${role}`,
        sqlState: "42501",
        message: "permission denied to set session authorization",
      },
    );
  }
}

async function verifyAuthenticatedRestoreFailClosedVariants(
  containerId: string,
  archiveSha256: string,
): Promise<void> {
  const wrongPassword = buildAuthenticatedRestoreInvocation({
    passfile: AUTHENTICATED_RESTORE_WRONG_PASSFILE,
    requireScram: false,
  });
  const wrongPasswordResult = await runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        wrongPassword.environment,
        wrongPassword.command,
      ),
    () => waitForAuthenticatedRestoreBackendDrain(containerId),
  );
  if (
    wrongPasswordResult.exitCode !== 1 ||
    wrongPasswordResult.stdout.trim() !== "" ||
    !wrongPasswordResult.stderr
      .toLowerCase()
      .replace(/\s+/g, " ")
      .includes(
        `fatal: password authentication failed for user "${AUTHENTICATED_RESTORE_LOGIN_ROLE}"`,
      )
  ) {
    throw new Error(
      "Wrong-password authenticated pg_restore did not fail for the expected reason",
    );
  }
  await verifyRestorableApplicationTablesEmpty(containerId);
  assertEqual(
    await authenticatedBackupArchiveSha256(containerId),
    archiveSha256,
    "wrong-password authenticated restore archive integrity",
  );

  for (const [label, invocation, marker] of [
    [
      "authenticated restore without test-seed role",
      buildAuthenticatedRestoreInvocation({ selectCapabilityRole: false }),
      "permission denied",
    ],
    [
      "authenticated restore without row-security enablement",
      buildAuthenticatedRestoreInvocation({ enableRowSecurity: false }),
      "row-level security policy",
    ],
  ] as const) {
    const result = await runRuntimeAuthCommandWithDrain(
      () =>
        dockerExecWithEnvironment(
          containerId,
          invocation.environment,
          invocation.command,
        ),
      () => waitForAuthenticatedRestoreBackendDrain(containerId),
    );
    if (
      result.exitCode !== 1 ||
      result.stdout.trim() !== "" ||
      !result.stderr.toLowerCase().includes(marker)
    ) {
      throw new Error(`${label} did not fail closed`);
    }
    await verifyRestorableApplicationTablesEmpty(containerId);
    assertEqual(
      await authenticatedBackupArchiveSha256(containerId),
      archiveSha256,
      `${label} archive integrity`,
    );
  }
}

async function runAuthenticatedRestoreCommand(
  containerId: string,
): Promise<CommandResult> {
  const invocation = buildAuthenticatedRestoreInvocation();
  return runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        invocation.environment,
        invocation.command,
      ),
    () => waitForAuthenticatedRestoreBackendDrain(containerId),
  );
}

async function authenticatedRestorePsqlScalar(
  containerId: string,
  sql: string,
): Promise<string> {
  const result = await authenticatedRestorePsql(containerId, sql);
  assertSuccess(result, "execute authenticated restore SQL");
  return result.stdout.trim();
}

async function expectAuthenticatedRestorePsqlFailure(
  containerId: string,
  sql: string,
  expectation: PsqlFailureExpectation,
): Promise<void> {
  const result = await authenticatedRestorePsql(containerId, sql, true);
  assertExpectedPsqlFailure(result, expectation);
}

async function authenticatedRestorePsql(
  containerId: string,
  sql: string,
  verboseErrors = false,
): Promise<CommandResult> {
  const invocation = buildAuthenticatedRestorePsqlInvocation({ verboseErrors });
  return runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        invocation.environment,
        invocation.command,
        sql,
      ),
    () => waitForAuthenticatedRestoreBackendDrain(containerId),
  );
}

async function waitForAuthenticatedRestoreBackendDrain(
  containerId: string,
): Promise<void> {
  await psql(containerId, renderAuthenticatedRestoreBackendDrainSql());
}

async function verifyRestorableApplicationTablesEmpty(
  containerId: string,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      renderRestorableApplicationTablesEmptySql(),
      AUTHENTICATED_RESTORE_DATABASE,
    ),
    "0",
    "B8 bounded restore data-table rollback",
  );
}

function renderAuthenticatedLoginIdentitySql(
  capabilityRole:
    | typeof AUTHENTICATED_BACKUP_CAPABILITY_ROLE
    | typeof AUTHENTICATED_RESTORE_CAPABILITY_ROLE,
  label: "backup" | "restore",
): string {
  return `SELECT pg_catalog.json_build_object(
  'sessionUser', session_user,
  'currentUser', current_user,
  'systemUser', system_user,
  'clientAddress', pg_catalog.host(pg_catalog.inet_client_addr()),
  'serverAddress', pg_catalog.host(pg_catalog.inet_server_addr()),
  'ssl', EXISTS (
    SELECT 1 FROM pg_catalog.pg_stat_ssl
    WHERE pid = pg_catalog.pg_backend_pid() AND ssl
  ),
  '${label}Member', pg_catalog.pg_has_role(
    session_user, '${capabilityRole}', 'MEMBER'
  ),
  '${label}Usage', pg_catalog.pg_has_role(
    session_user, '${capabilityRole}', 'USAGE'
  ),
  '${label}Set', pg_catalog.pg_has_role(
    session_user, '${capabilityRole}', 'SET'
  )
)::text;`;
}

function authenticatedLoginIdentityExpectation(
  loginRole:
    | typeof AUTHENTICATED_BACKUP_LOGIN_ROLE
    | typeof AUTHENTICATED_RESTORE_LOGIN_ROLE,
  label: "backup" | "restore",
): Record<string, unknown> {
  return {
    sessionUser: loginRole,
    currentUser: loginRole,
    systemUser: `scram-sha-256:${loginRole}`,
    clientAddress: "127.0.0.1",
    serverAddress: "127.0.0.1",
    ssl: false,
    [`${label}Member`]: true,
    [`${label}Usage`]: false,
    [`${label}Set`]: true,
  };
}

async function verifyEphemeralLoginCatalog(
  containerId: string,
  loginRole:
    | typeof AUTHENTICATED_BACKUP_LOGIN_ROLE
    | typeof AUTHENTICATED_RESTORE_LOGIN_ROLE,
  capabilityRole:
    | typeof AUTHENTICATED_BACKUP_CAPABILITY_ROLE
    | typeof AUTHENTICATED_RESTORE_CAPABILITY_ROLE,
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT rolname || '|' || rolcanlogin || '|' || rolsuper || '|' ||
  rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' ||
  rolinherit || '|' || rolbypassrls || '|' || rolconnlimit || '|' ||
  (rolpassword LIKE 'SCRAM-SHA-256$%')
FROM pg_catalog.pg_authid
WHERE rolname = '${loginRole}';`,
      databaseName,
    ),
    `${loginRole}|true|false|false|false|false|false|false|1|true`,
    `${loginRole} attributes and SCRAM verifier`,
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT granted_role.rolname || '|' || member_role.rolname || '|' ||
  membership.admin_option || '|' || membership.inherit_option || '|' ||
  membership.set_option
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
WHERE granted_role.rolname = '${loginRole}'
   OR member_role.rolname = '${loginRole}';`,
      databaseName,
    ),
    `${capabilityRole}|${loginRole}|false|false|true`,
    `${loginRole} exact SET-only membership`,
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `WITH login AS (
  SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${loginRole}'
), direct_acl AS (
  SELECT privilege.grantee
  FROM pg_catalog.pg_database AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.datacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_namespace AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.nspacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_class AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.relacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_proc AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.proacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_attribute AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.attacl) AS privilege
)
SELECT (
  SELECT count(*) FROM pg_catalog.pg_db_role_setting
  WHERE setrole = (SELECT oid FROM login)
) || '|' || (
  SELECT count(*) FROM direct_acl WHERE grantee = (SELECT oid FROM login)
);`,
      databaseName,
    ),
    "0|0",
    `${loginRole} settings and direct ACLs`,
  );
}

async function writeAuthenticatedBackupRestoreFile(
  containerId: string,
  path: string,
  contents: string,
): Promise<void> {
  await verifyContainerPathAbsent(containerId, path);
  const install = await dockerExec(containerId, [
    "install",
    "--mode=0600",
    "/dev/null",
    path,
  ]);
  assertSensitiveCommandSuccess(
    install,
    "create authenticated backup/restore file",
  );
  const write = await dockerExec(
    containerId,
    ["dd", `of=${path}`, "status=none"],
    contents,
  );
  assertSensitiveCommandSuccess(
    write,
    "write authenticated backup/restore file",
  );
  await verifyContainerRegularFile(
    containerId,
    path,
    "authenticated backup/restore file",
  );
}

async function verifyContainerRegularFile(
  containerId: string,
  path: string,
  label: string,
): Promise<void> {
  const regular = await dockerExec(containerId, ["test", "-f", path]);
  assertSuccess(regular, `verify ${label} is regular`);
  const notSymlink = await dockerExec(containerId, ["test", "!", "-L", path]);
  assertSuccess(notSymlink, `verify ${label} is not a symlink`);
  const mode = await dockerExec(containerId, ["stat", "--format=%a", path]);
  assertSuccess(mode, `inspect ${label} mode`);
  assertEqual(mode.stdout.trim(), "600", `${label} mode`);
}

async function verifyContainerPathAbsent(
  containerId: string,
  path: string,
): Promise<void> {
  const absent = await dockerExec(containerId, ["test", "!", "-e", path]);
  assertSuccess(absent, "verify reviewed container path is absent");
  const noSymlink = await dockerExec(containerId, ["test", "!", "-L", path]);
  assertSuccess(noSymlink, "verify reviewed container symlink is absent");
}

async function removeContainerPath(
  containerId: string,
  path: string,
): Promise<void> {
  const result = await dockerExec(containerId, ["rm", "-f", "--", path]);
  assertSuccess(result, "remove reviewed container path");
}

async function collectAuthenticatedBackupFingerprints(
  containerId: string,
  databaseName:
    | typeof CLEAN_BOOTSTRAP_DATABASE_NAME
    | typeof AUTHENTICATED_RESTORE_DATABASE,
): Promise<readonly AuthenticatedBackupTableFingerprint[]> {
  const fingerprints: AuthenticatedBackupTableFingerprint[] = [];
  for (const query of renderAuthenticatedBackupFingerprintQueries()) {
    const result = await psql(containerId, query.sql, databaseName);
    if (result.stderr.trim() !== "") {
      throw new Error("Authenticated backup fingerprint returned diagnostics");
    }
    const canonical = result.stdout.replace(/\r?\n$/, "");
    if (
      canonical.length === 0 ||
      canonical.includes("\n") ||
      canonical.includes("\r")
    ) {
      throw new Error(
        "Authenticated backup fingerprint is not one canonical row",
      );
    }
    const parsed = parseJsonObject(canonical);
    if (parsed.table !== query.table || !Array.isArray(parsed.rows)) {
      throw new Error("Authenticated backup fingerprint shape is invalid");
    }
    fingerprints.push(
      Object.freeze({
        table: query.table,
        rowCount: parsed.rows.length,
        sha256: createHash("sha256").update(canonical).digest("hex"),
      }),
    );
  }
  return Object.freeze(fingerprints);
}

function assertAuthenticatedBackupFingerprintsEqual(
  actual: readonly AuthenticatedBackupTableFingerprint[],
  expected: readonly AuthenticatedBackupTableFingerprint[],
  label: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(label);
  }
}

async function cleanupAuthenticatedBackupRestoreFilesAndRoles(
  containerId: string,
): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    {
      label: "drain authenticated backup backends",
      run: () => waitForAuthenticatedBackupBackendDrain(containerId),
    },
    {
      label: "drain authenticated restore backends",
      run: () => waitForAuthenticatedRestoreBackendDrain(containerId),
    },
    {
      label: "drain authenticated migrator backends",
      run: () => waitForMigratorAuthBackendDrain(containerId),
    },
    ...AUTHENTICATED_BACKUP_RESTORE_FILE_PATHS.map((path) => ({
      label: `remove B8 reviewed path: ${path}`,
      run: () => removeContainerPath(containerId, path),
    })),
    {
      label: "drop residual authenticated backup login",
      run: () =>
        psql(containerId, renderAuthenticatedBackupCleanupSql()).then(
          () => undefined,
        ),
    },
    {
      label: "drop residual authenticated restore login",
      run: () =>
        psql(containerId, renderAuthenticatedRestoreCleanupSql()).then(
          () => undefined,
        ),
    },
    {
      label: "drop residual authenticated migrator login",
      run: () =>
        psql(containerId, renderMigratorAuthCleanupSql()).then(() => undefined),
    },
  ];
  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    "B8 files and ephemeral-principal cleanup failed",
  );
}

async function dropBoundedRestoreTargetIfPresent(
  containerId: string,
): Promise<void> {
  const exists = await psqlMaintenanceScalar(
    containerId,
    `SELECT count(*) FROM pg_catalog.pg_database
WHERE datname = '${AUTHENTICATED_RESTORE_DATABASE}';`,
  );
  if (exists === "0") return;
  if (exists !== "1") {
    throw new Error("Bounded restore target inventory is invalid");
  }
  await waitForBoundedRestoreDatabaseDrain(containerId);
  await psqlMaintenance(
    containerId,
    renderDropAuthenticatedRestoreDatabaseSql(),
  );
}

async function waitForBoundedRestoreDatabaseDrain(
  containerId: string,
): Promise<void> {
  await psqlMaintenance(
    containerId,
    `DO $bounded_restore_database_drain$
DECLARE
  deadline timestamptz := pg_catalog.clock_timestamp() + interval '5 seconds';
BEGIN
  LOOP
    PERFORM pg_catalog.pg_stat_clear_snapshot();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_stat_activity
      WHERE datname = '${AUTHENTICATED_RESTORE_DATABASE}'
    );
    IF pg_catalog.clock_timestamp() >= deadline THEN
      RAISE EXCEPTION 'bounded restore database backends did not drain'
        USING ERRCODE = '55000';
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
END;
$bounded_restore_database_drain$;`,
  );
}

async function verifyEphemeralLoginResidueAbsent(
  containerId: string,
  loginRole:
    | typeof AUTHENTICATED_BACKUP_LOGIN_ROLE
    | typeof AUTHENTICATED_RESTORE_LOGIN_ROLE,
  paths: readonly string[],
): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    {
      label: `verify ${loginRole} is absent`,
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*) FROM pg_catalog.pg_roles
WHERE rolname = '${loginRole}';`,
          ),
          "0",
          `${loginRole} role residue`,
        );
      },
    },
    {
      label: `verify ${loginRole} membership is absent`,
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*)
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
WHERE granted_role.rolname = '${loginRole}'
   OR member_role.rolname = '${loginRole}';`,
          ),
          "0",
          `${loginRole} membership residue`,
        );
      },
    },
    {
      label: `verify ${loginRole} backend is absent`,
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*) FROM pg_catalog.pg_stat_activity
WHERE usename = '${loginRole}';`,
          ),
          "0",
          `${loginRole} backend residue`,
        );
      },
    },
    ...paths.map((path) => ({
      label: `verify reviewed path is absent: ${path}`,
      run: () => verifyContainerPathAbsent(containerId, path),
    })),
  ];
  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    `${loginRole} residue verification failed`,
  );
}

async function verifyAuthenticatedBackupRestoreResidueAbsent(
  containerId: string,
): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    {
      label: "verify B8 ephemeral roles and membership residue",
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `WITH named_roles AS (
  SELECT oid FROM pg_catalog.pg_roles
  WHERE rolname IN (
    '${AUTHENTICATED_BACKUP_LOGIN_ROLE}',
    '${AUTHENTICATED_RESTORE_LOGIN_ROLE}',
    '${MIGRATOR_AUTH_LOGIN_ROLE}'
  )
)
SELECT (
  SELECT count(*) FROM named_roles
) || '|' || (
  SELECT count(*) FROM pg_catalog.pg_auth_members
  WHERE roleid IN (SELECT oid FROM named_roles)
     OR member IN (SELECT oid FROM named_roles)
) || '|' || (
  SELECT count(*) FROM pg_catalog.pg_stat_activity
  WHERE usename IN (
    '${AUTHENTICATED_BACKUP_LOGIN_ROLE}',
    '${AUTHENTICATED_RESTORE_LOGIN_ROLE}',
    '${MIGRATOR_AUTH_LOGIN_ROLE}'
  )
);`,
          ),
          "0|0|0",
          "B8 ephemeral role, edge, and backend residue",
        );
      },
    },
    {
      label: "verify B8 bounded restore database is absent",
      run: async () => {
        assertEqual(
          await psqlMaintenanceScalar(
            containerId,
            `SELECT count(*) FROM pg_catalog.pg_database
WHERE datname = '${AUTHENTICATED_RESTORE_DATABASE}';`,
          ),
          "0",
          "B8 bounded restore database residue",
        );
      },
    },
    ...AUTHENTICATED_BACKUP_RESTORE_FILE_PATHS.map((path) => ({
      label: `verify B8 path is absent: ${path}`,
      run: () => verifyContainerPathAbsent(containerId, path),
    })),
    {
      label: "verify source catalog after B8 cleanup",
      run: () => verifyCatalogContract(containerId),
    },
    {
      label: "verify source platform artifacts after B8 cleanup",
      run: () => verifyB7PlatformArtifactsAfterApplication(containerId),
    },
  ];
  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    "B8 residue verification failed",
  );
}

async function verifyAuthenticatedApplicationMigrationSession(
  containerId: string,
  plan: AuthenticatedMigrationPlan,
  expectedLedgerRows: readonly AuthenticatedMigrationLedgerRow[],
  databaseName: AuthenticatedMigrationDatabaseName = AUTHENTICATED_MIGRATION_DATABASE_NAME,
): Promise<void> {
  await verifyMigratorAuthResidueAbsent(containerId);
  const password = generateMigratorAuthPassword();
  let wrongPassword = generateMigratorAuthPassword();
  while (wrongPassword === password) {
    wrongPassword = generateMigratorAuthPassword();
  }

  let probeFailed = false;
  let probeError: unknown;
  let cleanupFailed = false;
  let cleanupError: unknown;
  try {
    await provisionMigratorAuthLogin(containerId, password);
    await verifyMigratorAuthRoleCatalog(containerId);
    await writeMigratorAuthPassfile(
      containerId,
      MIGRATOR_AUTH_PASSFILE,
      renderMigratorAuthPassfile(password, databaseName),
    );
    await writeMigratorAuthPassfile(
      containerId,
      MIGRATOR_AUTH_WRONG_PASSFILE,
      renderMigratorAuthPassfile(wrongPassword, databaseName),
    );
    await verifyMigratorWrongPasswordRejection(containerId, databaseName);
    await verifyMigratorLoginBeforeSetRole(containerId, databaseName);
    await verifyMigratorRoleEscalationDenials(containerId, databaseName);
    await verifyAuthenticatedMigrationPlatformState(
      containerId,
      1,
      databaseName,
    );

    const rollbackResult = await migratorAuthenticatedPsql(
      containerId,
      MIGRATOR_AUTH_PASSFILE,
      renderAuthenticatedApplicationMigration(plan, true, databaseName),
      { verboseErrors: true, databaseName },
    );
    assertExpectedPsqlFailure(rollbackResult, {
      label: "injected authenticated application-migration rollback",
      sqlState: "22012",
      message: "division by zero",
    });
    if (splitLines(rollbackResult.stdout).length !== 0) {
      throw new Error(
        "Authenticated application rollback returned unexpected output",
      );
    }
    await verifyAuthenticatedMigrationPlatformState(
      containerId,
      1,
      databaseName,
    );

    const successResult = await migratorAuthenticatedPsql(
      containerId,
      MIGRATOR_AUTH_PASSFILE,
      renderAuthenticatedApplicationMigration(plan, false, databaseName),
      { databaseName },
    );
    if (successResult.exitCode !== 0 || successResult.stderr.trim() !== "") {
      throw new Error("Authenticated application migration failed");
    }
    assertJsonEqual(
      splitLines(successResult.stdout),
      [
        AUTHENTICATED_MIGRATION_IDENTITY_MARKER,
        AUTHENTICATED_MIGRATION_ROLE_RESET_MARKER,
      ],
      "authenticated application migration markers",
    );
    await verifyAuthenticatedMigrationLedger(
      containerId,
      expectedLedgerRows,
      databaseName,
    );
    await verifyMigratorOwnsNoObjects(containerId, databaseName);

    await expectMigratorAuthenticatedPsqlFailure(
      containerId,
      renderAuthenticatedApplicationMigration(plan, false, databaseName),
      {
        label: "authenticated application-migration replay",
        sqlState: "P0001",
        message: "versioned application migration requires an empty ledger",
      },
      databaseName,
    );
    await verifyAuthenticatedMigrationLedger(
      containerId,
      expectedLedgerRows,
      databaseName,
    );
    await verifyMigratorOwnsNoObjects(containerId, databaseName);
  } catch (error) {
    probeFailed = true;
    probeError = error;
  } finally {
    try {
      throwRuntimeAuthOperationFailures(
        await collectRuntimeAuthOperationFailures([
          {
            label: "migrator-auth cleanup",
            run: () => cleanupMigratorAuthProbe(containerId),
          },
          {
            label: "migrator-auth residue verification",
            run: () => verifyMigratorAuthResidueAbsent(containerId),
          },
        ]),
        "Authenticated migrator cleanup and residue verification failed",
      );
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
    }
  }

  if (probeFailed && cleanupFailed) {
    throw new AggregateError(
      [probeError, cleanupError],
      "Authenticated migration probe and mandatory cleanup both failed",
      { cause: probeError },
    );
  }
  if (probeFailed) throw probeError;
  if (cleanupFailed) throw cleanupError;
}

async function verifyAuthenticatedMigrationLedger(
  containerId: string,
  expectedRows: readonly AuthenticatedMigrationLedgerRow[],
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): Promise<void> {
  assertJsonEqual(
    splitLines(
      await psqlScalar(
        containerId,
        `SELECT migration_id || '|' || file_name || '|' || sha256 || '|' || applied_by
FROM shared_data.schema_migrations
ORDER BY migration_id;`,
        databaseName,
      ),
    ),
    expectedRows.map(
      ({ migrationId, fileName, sha256 }) =>
        `${migrationId}|${fileName}|${sha256}|${MIGRATOR_AUTH_LOGIN_ROLE}`,
    ),
    "authenticated application migration ledger and session identity",
  );
}

async function verifyB7PlatformArtifactsAfterApplication(
  containerId: string,
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): Promise<void> {
  const scalar = (sql: string) => psqlScalar(containerId, sql, databaseName);
  assertEqual(
    await scalar(
      `SELECT extension.extname || '|' || namespace.nspname || '|' ||
  pg_catalog.pg_get_userbyid(extension.extowner) || '|' ||
  (extension.extversion = available.default_version)
FROM pg_catalog.pg_extension AS extension
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = extension.extnamespace
JOIN pg_catalog.pg_available_extensions AS available
  ON available.name = extension.extname
WHERE extension.extname = 'btree_gist';`,
    ),
    "btree_gist|shared_data|postgres|true",
    "B7 final platform extension identity",
  );
  assertEqual(
    await scalar(
      `SELECT count(*)
FROM pg_catalog.pg_extension AS extension
JOIN pg_catalog.pg_depend AS dependency
  ON dependency.refclassid = 'pg_catalog.pg_extension'::regclass
 AND dependency.refobjid = extension.oid
 AND dependency.deptype = 'e'
JOIN pg_catalog.pg_proc AS procedure
  ON dependency.classid = 'pg_catalog.pg_proc'::regclass
 AND dependency.objid = procedure.oid
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
) AS privilege
WHERE extension.extname = 'btree_gist'
  AND privilege.grantee = 0;`,
    ),
    "0",
    "B7 final extension routine PUBLIC privileges",
  );
  assertEqual(
    await scalar(
      `SELECT count(DISTINCT defaults.oid) FILTER (
    WHERE defaults.defaclnamespace = 0
      AND defaults.defaclobjtype = 'f'
  ) || '|' || count(*) FILTER (
    WHERE defaults.defaclnamespace = 0
      AND defaults.defaclobjtype = 'f'
      AND privilege.grantee = 0
  )
FROM pg_catalog.pg_default_acl AS defaults
JOIN pg_catalog.pg_roles AS role ON role.oid = defaults.defaclrole
LEFT JOIN LATERAL pg_catalog.aclexplode(defaults.defaclacl) AS privilege
  ON true
WHERE role.rolname = 'research_cockpit_owner';`,
    ),
    "1|0",
    "B7 owner global function defaults and PUBLIC privileges",
  );
}

async function verifyCheckedOutCommit(
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const expectedCommit = environment.GITHUB_SHA;
  if (expectedCommit === undefined || !/^[0-9a-f]{40}$/.test(expectedCommit)) {
    throw new Error("A canonical GitHub checkout commit is required");
  }
  const result = await executeGit(["rev-parse", "HEAD"]);
  assertSuccess(result, "resolve the checked-out commit");
  if (result.stdout.trim() !== expectedCommit) {
    throw new Error("The checked-out commit does not match GITHUB_SHA");
  }
  const status = await executeGit([
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  assertSuccess(status, "verify the acceptance checkout is clean");
  if (status.stdout.trim().length > 0) {
    throw new Error("PostgreSQL acceptance requires a clean checkout");
  }
}

async function collectAcceptanceSourceHashes(
  config: AcceptanceImageConfig,
): Promise<PostgresAcceptanceV11SourceHashes> {
  const [
    workflowSha256,
    fixtureSha256,
    migrationManifestSha256,
    acceptanceRunnerSha256,
    projectionQuerySha256,
    projectionNormalizerSha256,
    platformBootstrapV2Sha256,
    applicationMigrationManifestV2Sha256,
    authenticatedMigrationRendererV2Sha256,
    restorePlatformV1Sha256,
    authenticatedBackupRestorePlanV1Sha256,
    postgresProjectionAdapterSha256,
    operationProjectionContractSha256,
    databasePackageManifestSha256,
    pnpmLockfileSha256,
    postgresProjectionPoolSha256,
    postgresMigrationDeployerSha256,
  ] = await Promise.all([
    exactFileSha256(workflowPath),
    exactFileSha256(syntheticFixturePath),
    exactFileSha256(migrationManifestPath),
    exactFileSha256(acceptanceRunnerPath),
    exactFileSha256(projectionQueryPath),
    exactFileSha256(projectionNormalizerPath),
    exactFileSha256(platformBootstrapV2Path),
    exactFileSha256(applicationMigrationManifestV2Path),
    exactFileSha256(authenticatedMigrationRendererV2Path),
    exactFileSha256(restorePlatformV1Path),
    exactFileSha256(authenticatedBackupRestorePlanV1Path),
    exactFileSha256(postgresProjectionAdapterPath),
    exactFileSha256(operationProjectionContractPath),
    exactFileSha256(databasePackageManifestPath),
    exactFileSha256(pnpmLockfilePath),
    exactFileSha256(postgresProjectionPoolAdapterPath),
    exactFileSha256(postgresMigrationDeployerPath),
  ]);
  if (
    workflowSha256 !== config.workflowSha256 ||
    fixtureSha256 !== config.fixtureSha256
  ) {
    throw new Error("Reviewed acceptance source bytes changed during the run");
  }
  return Object.freeze({
    workflowSha256,
    fixtureSha256,
    migrationManifestSha256,
    acceptanceRunnerSha256,
    projectionQuerySha256,
    projectionNormalizerSha256,
    platformBootstrapV2Sha256,
    applicationMigrationManifestV2Sha256,
    authenticatedMigrationRendererV2Sha256,
    restorePlatformV1Sha256,
    authenticatedBackupRestorePlanV1Sha256,
    postgresProjectionAdapterSha256,
    operationProjectionContractSha256,
    databasePackageManifestSha256,
    pnpmLockfileSha256,
    postgresProjectionPoolSha256,
    postgresMigrationDeployerSha256,
  });
}

async function exactFileSha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function verifyBackupCapability(
  containerId: string,
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): Promise<void> {
  const visibility = parseJsonObject(
    await psqlScalar(
      containerId,
      `SET SESSION AUTHORIZATION research_cockpit_backup;
SELECT pg_catalog.json_build_object(
  'organizations', (SELECT count(*) FROM private_data.organizations),
  'evidence', (SELECT count(*) FROM shared_data.evidence)
)::text;
RESET SESSION AUTHORIZATION;`,
      databaseName,
    ),
  );
  assertJsonEqual(
    visibility,
    { organizations: 2, evidence: 5 },
    "backup synthetic-read capability",
  );

  await expectPsqlFailure(
    containerId,
    `SET SESSION AUTHORIZATION research_cockpit_backup;
BEGIN;
INSERT INTO private_data.organizations (id, slug, name, created_at)
VALUES (
  '10000000-0000-4000-8000-000000000098',
  'backup-write-probe',
  'Backup write probe',
  transaction_timestamp()
);
ROLLBACK;
RESET SESSION AUTHORIZATION;`,
    {
      label: "backup write",
      sqlState: "42501",
      message: "permission denied for table organizations",
    },
    databaseName,
  );
}

async function verifyPristineTarget(containerId: string): Promise<void> {
  const state = parseJsonObject(
    await psqlScalar(
      containerId,
      `SELECT pg_catalog.json_build_object(
  'applicationSchemas', count(*) FILTER (
    WHERE namespace.nspname IN ('private_data', 'shared_data')
  ),
  'capabilityRoles', (
    SELECT count(*)
    FROM pg_catalog.pg_roles
    WHERE rolname = ANY (ARRAY[
      'research_cockpit_backup',
      'research_cockpit_owner',
      'research_cockpit_runtime',
      'research_cockpit_test_seed'
    ])
  )
)::text
FROM pg_catalog.pg_namespace AS namespace;`,
    ),
  );
  assertJsonEqual(
    state,
    { applicationSchemas: 0, capabilityRoles: 0 },
    "pristine target and bootstrap rollback",
  );
}

async function resetAcceptanceTargetForAuthenticatedMigrations(
  containerId: string,
): Promise<void> {
  assertEqual(
    await psqlMaintenanceScalar(
      containerId,
      `SELECT count(*)
FROM pg_catalog.pg_stat_activity
WHERE datname = '${CLEAN_BOOTSTRAP_DATABASE_NAME}'
;`,
    ),
    "0",
    "legacy acceptance backends before B7 target reset",
  );
  await psqlMaintenance(containerId, renderB7AcceptanceTargetResetSql());
  assertEqual(
    await psqlMaintenanceScalar(
      containerId,
      `SELECT datname || '|' || pg_catalog.pg_get_userbyid(datdba) || '|' ||
  datistemplate || '|' || datallowconn || '|' || datconnlimit || '|' ||
  pg_catalog.pg_encoding_to_char(encoding)
FROM pg_catalog.pg_database
WHERE datname = '${CLEAN_BOOTSTRAP_DATABASE_NAME}';`,
    ),
    `${CLEAN_BOOTSTRAP_DATABASE_NAME}|postgres|false|true|-1|UTF8`,
    "recreated B7 acceptance database",
  );
  await verifyB7PristineTarget(containerId);
}

async function verifyB7PristineTarget(containerId: string): Promise<void> {
  await verifyPristineTarget(containerId);
  assertEqual(
    await psqlScalar(
      containerId,
      "SELECT count(*) FROM pg_catalog.pg_extension WHERE extname = 'btree_gist';",
    ),
    "0",
    "B7 pristine trusted-extension absence",
  );
  assertJsonEqual(
    splitLines(
      await psqlScalar(
        containerId,
        `SELECT CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_database AS database
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(database.datacl, pg_catalog.acldefault('d', database.datdba))
) AS privilege
WHERE database.datname = pg_catalog.current_database()
  AND privilege.grantee <> database.datdba
ORDER BY 1;`,
      ),
    ),
    [`PUBLIC|CONNECT|${CATALOG_FALSE}`, `PUBLIC|TEMPORARY|${CATALOG_FALSE}`],
    "B7 pristine database ACL",
  );
  assertJsonEqual(
    splitLines(
      await psqlScalar(
        containerId,
        `SELECT CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_namespace AS namespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))
) AS privilege
WHERE namespace.nspname = 'public'
  AND privilege.grantee <> namespace.nspowner
ORDER BY 1;`,
      ),
    ),
    [`PUBLIC|USAGE|${CATALOG_FALSE}`],
    "B7 pristine public-schema ACL",
  );
}

async function verifyAuthenticatedMigrationPlatformState(
  containerId: string,
  expectedMembershipEdges = 0,
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): Promise<void> {
  const scalar = (sql: string) => psqlScalar(containerId, sql, databaseName);
  assertJsonEqual(
    splitLines(
      await scalar(
        `SELECT rolname || '|' || rolcanlogin || '|' || rolsuper || '|' ||
  rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' ||
  rolinherit || '|' || rolbypassrls
FROM pg_catalog.pg_roles
WHERE rolname = ANY (ARRAY[
  'research_cockpit_backup',
  'research_cockpit_owner',
  'research_cockpit_runtime',
  'research_cockpit_test_seed'
])
ORDER BY rolname;`,
      ),
    ),
    EXPECTED_CAPABILITY_ROLE_ATTRIBUTE_ROWS,
    "B7 platform capability roles",
  );
  assertEqual(
    await scalar(
      `SELECT count(*)
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
WHERE granted_role.rolname LIKE 'research_cockpit_%'
   OR member_role.rolname LIKE 'research_cockpit_%';`,
    ),
    String(expectedMembershipEdges),
    "B7 platform capability membership edges",
  );
  assertJsonEqual(
    splitLines(
      await scalar(
        `SELECT nspname || '|' || pg_catalog.pg_get_userbyid(nspowner)
FROM pg_catalog.pg_namespace
WHERE nspname IN ('private_data', 'shared_data')
ORDER BY nspname;`,
      ),
    ),
    [
      "private_data|research_cockpit_owner",
      "shared_data|research_cockpit_owner",
    ],
    "B7 platform schemas",
  );
  assertJsonEqual(
    splitLines(
      await scalar(
        `SELECT namespace.nspname || '|' ||
  CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_namespace AS namespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))
) AS privilege
WHERE namespace.nspname IN ('private_data', 'public', 'shared_data')
  AND privilege.grantee <> namespace.nspowner
ORDER BY 1;`,
      ),
    ),
    [],
    "B7 platform non-owner schema ACLs",
  );
  assertEqual(
    await scalar(
      `SELECT extension.extname || '|' || namespace.nspname || '|' ||
  pg_catalog.pg_get_userbyid(extension.extowner) || '|' ||
  (extension.extversion = available.default_version)
FROM pg_catalog.pg_extension AS extension
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = extension.extnamespace
JOIN pg_catalog.pg_available_extensions AS available
  ON available.name = extension.extname
WHERE extension.extname = 'btree_gist';`,
    ),
    "btree_gist|shared_data|postgres|true",
    "B7 platform trusted extension identity",
  );
  assertEqual(
    await scalar(
      `SELECT count(*)
FROM pg_catalog.pg_extension AS extension
JOIN pg_catalog.pg_depend AS dependency
  ON dependency.refclassid = 'pg_catalog.pg_extension'::regclass
 AND dependency.refobjid = extension.oid
 AND dependency.deptype = 'e'
JOIN pg_catalog.pg_proc AS procedure
  ON dependency.classid = 'pg_catalog.pg_proc'::regclass
 AND dependency.objid = procedure.oid
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(
    procedure.proacl,
    pg_catalog.acldefault('f', procedure.proowner)
  )
) AS privilege
WHERE extension.extname = 'btree_gist'
  AND privilege.grantee = 0;`,
    ),
    "0",
    "B7 platform extension routine PUBLIC privileges",
  );
  const expectedApplicationRelations = APPLICATION_TABLES.map(
    (table) => `'${table}'`,
  ).join(",\n  ");
  assertEqual(
    await scalar(
      `SELECT count(*)
FROM pg_catalog.unnest(ARRAY[
  ${expectedApplicationRelations}
]::text[]) AS expected(relation_name)
WHERE pg_catalog.to_regclass(expected.relation_name) IS NOT NULL;`,
    ),
    "0",
    "B7 platform application relation absence",
  );
  assertEqual(
    await scalar(
      `SELECT count(*)
FROM pg_catalog.pg_proc AS procedure
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname IN ('private_data', 'shared_data')
  AND procedure.proname = ANY (ARRAY[
    'current_channel',
    'current_data_classification',
    'current_organization_id',
    'current_principal_id',
    'current_purpose',
    'current_territory',
    'guard_live_resource_identity',
    'guard_resource_id_registry',
    'has_active_entitlement',
    'has_active_membership',
    'rights_allow_current_use',
    'set_request_context',
    'tombstone_resource_id_after_delete'
  ]);`,
    ),
    "0",
    "B7 platform application routine absence",
  );
  assertEqual(
    await scalar(
      `SELECT count(*)
FROM pg_catalog.pg_policy AS policy
JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
WHERE namespace.nspname IN ('private_data', 'shared_data');`,
    ),
    "0",
    "B7 platform application policy absence",
  );
  assertEqual(
    await scalar(
      `SELECT count(*)
FROM pg_catalog.pg_default_acl AS defaults
JOIN pg_catalog.pg_roles AS role ON role.oid = defaults.defaclrole
WHERE role.rolname = 'research_cockpit_owner';`,
    ),
    "0",
    "B7 platform application default-privilege absence",
  );
  assertJsonEqual(
    splitLines(
      await scalar(
        `SELECT CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_database AS database
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(database.datacl, pg_catalog.acldefault('d', database.datdba))
) AS privilege
WHERE database.datname = pg_catalog.current_database()
  AND privilege.grantee <> database.datdba
ORDER BY 1;`,
      ),
    ),
    [`PUBLIC|CONNECT|${CATALOG_FALSE}`],
    "B7 platform database ACL",
  );
}

export function injectBootstrapFailure(bootstrap: string): string {
  const finalCommit = /\nCOMMIT;\n?$/;
  if (!finalCommit.test(bootstrap)) {
    throw new Error("Reviewed bootstrap final COMMIT is missing");
  }
  const injected = bootstrap.replace(finalCommit, "\nSELECT 1 / 0;\nCOMMIT;\n");
  if (injected === bootstrap) {
    throw new Error("Reviewed bootstrap rollback probe was not injected");
  }
  return injected;
}

export function renderB7AcceptanceTargetResetSql(): string {
  return `DROP DATABASE ${CLEAN_BOOTSTRAP_DATABASE_NAME};
DROP ROLE research_cockpit_backup;
DROP ROLE research_cockpit_runtime;
DROP ROLE research_cockpit_test_seed;
DROP ROLE research_cockpit_owner;
CREATE DATABASE ${CLEAN_BOOTSTRAP_DATABASE_NAME}
  WITH OWNER postgres TEMPLATE template0;
`;
}

async function verifyContainerIdentity(
  containerId: string,
  config: AcceptanceImageConfig,
): Promise<void> {
  const result = await executeDocker([
    "inspect",
    "--format",
    "{{.Config.Image}}",
    containerId,
  ]);
  assertSuccess(result, "inspect the PostgreSQL service container");
  assertEqual(
    result.stdout.trim(),
    config.reference,
    "service image reference",
  );
}

async function verifyToolVersions(
  containerId: string,
  expectedVersion: string,
  expectedVersionNumber: number,
): Promise<PostgresAcceptanceV11ToolVersions> {
  const serverVersionNumber = await psqlScalar(
    containerId,
    "SHOW server_version_num;",
  );
  assertEqual(
    serverVersionNumber,
    String(expectedVersionNumber),
    "server version number",
  );
  const versions: {
    postgres?: string;
    psql?: string;
    pgDump?: string;
    pgRestore?: string;
  } = {};
  for (const tool of ["postgres", "psql", "pg_dump", "pg_restore"] as const) {
    const result = await dockerExec(containerId, [tool, "--version"]);
    assertSuccess(result, `${tool} version`);
    if (
      !new RegExp(`\\b${escapeRegExp(expectedVersion)}\\b`).test(result.stdout)
    ) {
      throw new Error(`${tool} does not report PostgreSQL ${expectedVersion}`);
    }
    const observed = result.stdout.trim();
    if (tool === "postgres") versions.postgres = observed;
    if (tool === "psql") versions.psql = observed;
    if (tool === "pg_dump") versions.pgDump = observed;
    if (tool === "pg_restore") versions.pgRestore = observed;
  }
  if (
    versions.postgres === undefined ||
    versions.psql === undefined ||
    versions.pgDump === undefined ||
    versions.pgRestore === undefined
  ) {
    throw new Error("PostgreSQL tool-version collection was incomplete");
  }
  const nodePostgresPackage = JSON.parse(
    await readFile(nodePostgresPackagePath, "utf8"),
  ) as unknown;
  if (
    !isRecord(nodePostgresPackage) ||
    nodePostgresPackage.version !== EXPECTED_NODE_POSTGRES_VERSION
  ) {
    throw new Error("The installed node-postgres version is not reviewed");
  }
  const nodePostgresPoolPackage = JSON.parse(
    await readFile(nodePostgresPoolPackagePath, "utf8"),
  ) as unknown;
  if (
    !isRecord(nodePostgresPoolPackage) ||
    nodePostgresPoolPackage.name !== "pg-pool" ||
    nodePostgresPoolPackage.version !== EXPECTED_NODE_POSTGRES_POOL_VERSION
  ) {
    throw new Error("The installed node-postgres pool version is not reviewed");
  }
  return Object.freeze({
    postgres: versions.postgres,
    psql: versions.psql,
    pgDump: versions.pgDump,
    pgRestore: versions.pgRestore,
    nodePostgres: nodePostgresPackage.version,
    nodePostgresPool: nodePostgresPoolPackage.version,
  });
}

async function verifyMigrationLedger(
  containerId: string,
  expected: readonly string[] = LEGACY_MIGRATION_LEDGER_ROWS,
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): Promise<void> {
  const actual = splitLines(
    await psqlScalar(
      containerId,
      `SELECT migration_id || '|' || file_name || '|' || sha256
FROM shared_data.schema_migrations
ORDER BY migration_id;`,
      databaseName,
    ),
  );
  assertJsonEqual(actual, expected, "migration ledger");
}

async function verifyAuthenticatedTestLoaderSession(
  containerId: string,
  fixtureSql: string,
  expectedLedger: readonly string[] = LEGACY_MIGRATION_LEDGER_ROWS,
): Promise<void> {
  await verifyTestLoaderAuthResidueAbsent(containerId);

  const password = generateTestLoaderAuthPassword();
  let wrongPassword = generateTestLoaderAuthPassword();
  while (wrongPassword === password) {
    wrongPassword = generateTestLoaderAuthPassword();
  }

  let probeFailed = false;
  let probeError: unknown;
  let cleanupFailed = false;
  let cleanupError: unknown;
  try {
    await provisionTestLoaderAuthLogin(containerId, password);
    await verifyTestLoaderAuthRoleCatalog(containerId);
    await writeTestLoaderAuthPassfile(
      containerId,
      TEST_LOADER_AUTH_PASSFILE,
      renderTestLoaderAuthPassfile(password),
    );
    await writeTestLoaderAuthPassfile(
      containerId,
      TEST_LOADER_AUTH_WRONG_PASSFILE,
      renderTestLoaderAuthPassfile(wrongPassword),
    );
    await verifyTestLoaderWrongPasswordRejection(containerId);
    await verifyTestLoaderLoginBeforeSetRole(containerId);
    await verifyTestLoaderRoleEscalationDenials(containerId);
    await verifyFixtureTablesEmpty(containerId);
    await verifyAuthenticatedTestLoaderRollback(
      containerId,
      fixtureSql,
      expectedLedger,
    );
    await verifyAuthenticatedTestLoaderFixtureLoad(containerId, fixtureSql);
    await verifyAuthenticatedTestLoaderDenials(containerId, expectedLedger);
  } catch (error) {
    probeFailed = true;
    probeError = error;
  } finally {
    try {
      throwRuntimeAuthOperationFailures(
        await collectRuntimeAuthOperationFailures([
          {
            label: "test-loader-auth cleanup",
            run: () => cleanupTestLoaderAuthProbe(containerId),
          },
          {
            label: "test-loader-auth residue verification",
            run: () => verifyTestLoaderAuthResidueAbsent(containerId),
          },
        ]),
        "Authenticated test-loader cleanup and residue verification failed",
      );
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
    }
  }

  if (probeFailed && cleanupFailed) {
    throw new AggregateError(
      [probeError, cleanupError],
      "Authenticated test-loader probe and mandatory cleanup both failed",
      { cause: probeError },
    );
  }
  if (probeFailed) throw probeError;
  if (cleanupFailed) throw cleanupError;
}

async function provisionTestLoaderAuthLogin(
  containerId: string,
  password: string,
): Promise<void> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ],
    renderTestLoaderAuthProvisioningSql(password),
  );
  assertSensitiveCommandSuccess(
    result,
    "provision ephemeral test-loader login",
  );
}

async function verifyTestLoaderAuthRoleCatalog(
  containerId: string,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT rolname || '|' || rolcanlogin || '|' || rolsuper || '|' ||
  rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' ||
  rolinherit || '|' || rolbypassrls || '|' || rolconnlimit || '|' ||
  (rolpassword LIKE 'SCRAM-SHA-256$%')
FROM pg_catalog.pg_authid
WHERE rolname = '${TEST_LOADER_AUTH_LOGIN_ROLE}';`,
    ),
    `${TEST_LOADER_AUTH_LOGIN_ROLE}|true|false|false|false|false|false|false|1|true`,
    "ephemeral test-loader login attributes and SCRAM verifier",
  );

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT granted_role.rolname || '|' || member_role.rolname || '|' ||
  membership.admin_option || '|' || membership.inherit_option || '|' ||
  membership.set_option
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role
  ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role
  ON member_role.oid = membership.member
WHERE granted_role.rolname = '${TEST_LOADER_AUTH_LOGIN_ROLE}'
   OR member_role.rolname = '${TEST_LOADER_AUTH_LOGIN_ROLE}';`,
    ),
    `${TEST_LOADER_AUTH_CAPABILITY_ROLE}|${TEST_LOADER_AUTH_LOGIN_ROLE}|false|false|true`,
    "ephemeral test-loader login membership",
  );

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*)
FROM pg_catalog.pg_db_role_setting
WHERE setrole = (
  SELECT oid FROM pg_catalog.pg_roles
  WHERE rolname = '${TEST_LOADER_AUTH_LOGIN_ROLE}'
);`,
    ),
    "0",
    "ephemeral test-loader login role settings",
  );
}

async function writeTestLoaderAuthPassfile(
  containerId: string,
  path:
    typeof TEST_LOADER_AUTH_PASSFILE | typeof TEST_LOADER_AUTH_WRONG_PASSFILE,
  contents: string,
): Promise<void> {
  const install = await dockerExec(containerId, [
    "install",
    "--mode=0600",
    "/dev/null",
    path,
  ]);
  assertSensitiveCommandSuccess(install, "create test-loader-auth passfile");
  const write = await dockerExec(
    containerId,
    ["dd", `of=${path}`, "status=none"],
    contents,
  );
  assertSensitiveCommandSuccess(write, "write test-loader-auth passfile");
  const regularFile = await dockerExec(containerId, ["test", "-f", path]);
  assertSuccess(regularFile, "verify test-loader-auth passfile type");
  const symlink = await dockerExec(containerId, ["test", "!", "-L", path]);
  assertSuccess(symlink, "verify test-loader-auth passfile is not a symlink");
  const mode = await dockerExec(containerId, ["stat", "--format=%a", path]);
  assertSuccess(mode, "inspect test-loader-auth passfile mode");
  assertEqual(mode.stdout.trim(), "600", "test-loader-auth passfile mode");
}

async function verifyTestLoaderWrongPasswordRejection(
  containerId: string,
): Promise<void> {
  const result = await testLoaderAuthenticatedPsql(
    containerId,
    TEST_LOADER_AUTH_WRONG_PASSFILE,
    "SELECT 1;",
    { requireScram: false },
  );
  assertTestLoaderWrongPasswordRejection(result);
}

async function verifyTestLoaderLoginBeforeSetRole(
  containerId: string,
): Promise<void> {
  const identity = parseJsonObject(
    await testLoaderAuthenticatedPsqlScalar(
      containerId,
      `SELECT pg_catalog.json_build_object(
  'sessionUser', session_user,
  'currentUser', current_user,
  'systemUser', system_user,
  'clientAddress', pg_catalog.host(pg_catalog.inet_client_addr()),
  'serverAddress', pg_catalog.host(pg_catalog.inet_server_addr()),
  'ssl', EXISTS (
    SELECT 1
    FROM pg_catalog.pg_stat_ssl
    WHERE pid = pg_catalog.pg_backend_pid() AND ssl
  ),
  'testSeedMember', pg_catalog.pg_has_role(
    session_user, '${TEST_LOADER_AUTH_CAPABILITY_ROLE}', 'MEMBER'
  ),
  'testSeedUsage', pg_catalog.pg_has_role(
    session_user, '${TEST_LOADER_AUTH_CAPABILITY_ROLE}', 'USAGE'
  ),
  'testSeedSet', pg_catalog.pg_has_role(
    session_user, '${TEST_LOADER_AUTH_CAPABILITY_ROLE}', 'SET'
  )
)::text;`,
    ),
  );
  assertJsonEqual(
    identity,
    {
      sessionUser: TEST_LOADER_AUTH_LOGIN_ROLE,
      currentUser: TEST_LOADER_AUTH_LOGIN_ROLE,
      systemUser: `scram-sha-256:${TEST_LOADER_AUTH_LOGIN_ROLE}`,
      clientAddress: "127.0.0.1",
      serverAddress: "127.0.0.1",
      ssl: false,
      testSeedMember: true,
      testSeedUsage: false,
      testSeedSet: true,
    },
    "authenticated test-loader login identity before SET ROLE",
  );

  for (const [label, sql, message] of [
    [
      "test-loader login data access before SET ROLE",
      "SELECT count(*) FROM private_data.organizations;",
      "permission denied for schema private_data",
    ],
    [
      "test-loader login insert before SET ROLE",
      `INSERT INTO private_data.organizations (id, slug, name, created_at)
VALUES (
  '10000000-0000-4000-8000-000000000096',
  'test-loader-pre-role',
  'Test loader pre-role probe',
  transaction_timestamp()
);`,
      "permission denied for schema private_data",
    ],
    [
      "test-loader login context routine before SET ROLE",
      `CALL private_data.set_request_context(
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'display',
  'api',
  'demo_only',
  'synthetic'
);`,
      "permission denied for schema private_data",
    ],
    [
      "test-loader login temporary table before SET ROLE",
      "CREATE TEMPORARY TABLE test_loader_pre_role_escape (id integer);",
      "permission denied to create temporary tables",
    ],
  ] as const) {
    await expectTestLoaderAuthenticatedPsqlFailure(containerId, sql, {
      label,
      sqlState: "42501",
      message,
    });
  }
}

async function verifyTestLoaderRoleEscalationDenials(
  containerId: string,
): Promise<void> {
  for (const role of TEST_LOADER_AUTH_FORBIDDEN_SET_ROLES) {
    await expectTestLoaderAuthenticatedPsqlFailure(
      containerId,
      `SET ROLE ${role};`,
      {
        label: `test-loader login SET ROLE ${role}`,
        sqlState: "42501",
        message: "permission denied to set role",
      },
    );
  }
  for (const role of [TEST_LOADER_AUTH_CAPABILITY_ROLE, "postgres"] as const) {
    await expectTestLoaderAuthenticatedPsqlFailure(
      containerId,
      `SET SESSION AUTHORIZATION ${role};`,
      {
        label: `test-loader login SET SESSION AUTHORIZATION ${role}`,
        sqlState: "42501",
        message: "permission denied to set session authorization",
      },
    );
  }
}

async function verifyAuthenticatedTestLoaderRollback(
  containerId: string,
  fixtureSql: string,
  expectedLedger: readonly string[],
): Promise<void> {
  const result = await testLoaderAuthenticatedPsql(
    containerId,
    TEST_LOADER_AUTH_PASSFILE,
    renderAuthenticatedTestLoaderFixtureRollbackProbeSql(fixtureSql),
    { verboseErrors: true },
  );
  assertAuthenticatedTestLoaderFixtureRollbackFailure(result);
  await verifyFixtureTablesEmpty(containerId);
  await verifyMigrationLedger(containerId, expectedLedger);
}

async function verifyAuthenticatedTestLoaderFixtureLoad(
  containerId: string,
  fixtureSql: string,
): Promise<void> {
  const result = await testLoaderAuthenticatedPsql(
    containerId,
    TEST_LOADER_AUTH_PASSFILE,
    renderAuthenticatedTestLoaderFixtureSql(fixtureSql),
  );
  assertAuthenticatedTestLoaderFixtureResult(result);
}

async function verifyAuthenticatedTestLoaderDenials(
  containerId: string,
  expectedLedger: readonly string[],
): Promise<void> {
  for (const [label, sql, message] of [
    [
      "test-loader non-synthetic insert",
      `INSERT INTO private_data.organizations (
  id, slug, name, data_classification, created_at
)
VALUES (
  '10000000-0000-4000-8000-000000000095',
  'test-loader-non-synthetic',
  'Test loader non-synthetic probe',
  'production',
  transaction_timestamp()
);`,
      "new row violates row-level security policy",
    ],
    [
      "authenticated test-loader update",
      `UPDATE private_data.organizations
SET name = 'Mutation probe'
WHERE id = '${ORGANIZATION_ALPHA}';`,
      "permission denied for table organizations",
    ],
    [
      "authenticated test-loader delete",
      `DELETE FROM private_data.idempotency_records
WHERE organization_id = '${ORGANIZATION_ALPHA}';`,
      "permission denied for table idempotency_records",
    ],
    [
      "authenticated test-loader truncate",
      "TRUNCATE TABLE private_data.audit_events;",
      "permission denied for table audit_events",
    ],
    [
      "authenticated test-loader ledger read",
      "SELECT count(*) FROM shared_data.schema_migrations;",
      "permission denied for table schema_migrations",
    ],
    [
      "authenticated test-loader ledger write",
      `INSERT INTO shared_data.schema_migrations (migration_id, file_name, sha256)
VALUES ('9999', 'test-loader-probe.sql', '${"0".repeat(64)}');`,
      "permission denied for table schema_migrations",
    ],
    [
      "authenticated test-loader persistent DDL",
      "CREATE TABLE public.test_loader_persistent_escape (id integer);",
      "permission denied for schema public",
    ],
    [
      "authenticated test-loader temporary DDL",
      "CREATE TEMPORARY TABLE test_loader_temporary_escape (id integer);",
      "permission denied to create temporary tables",
    ],
  ] as const) {
    await expectTestLoaderAuthenticatedPsqlFailure(
      containerId,
      renderTestLoaderCapabilitySql(sql),
      { label, sqlState: "42501", message },
    );
  }

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*) FROM private_data.organizations
WHERE id IN (
  '10000000-0000-4000-8000-000000000095',
  '10000000-0000-4000-8000-000000000096'
);`,
    ),
    "0",
    "failed authenticated test-loader inserts",
  );
  await verifyMigrationLedger(containerId, expectedLedger);
}

function renderTestLoaderCapabilitySql(sql: string): string {
  return `BEGIN;
SET LOCAL ROLE ${TEST_LOADER_AUTH_CAPABILITY_ROLE};
${sql}
ROLLBACK;`;
}

async function verifyFixtureTablesEmpty(containerId: string): Promise<void> {
  const fixtureTables = APPLICATION_TABLES.filter(
    (table) => table !== "shared_data.schema_migrations",
  );
  const countSql = fixtureTables
    .map((table) => `SELECT count(*)::bigint AS row_count FROM ${table}`)
    .join("\nUNION ALL\n");
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT coalesce(sum(row_count), 0)::text
FROM (
${countSql}
) AS fixture_rows;`,
    ),
    "0",
    "fixture tables before authenticated commit",
  );
}

async function cleanupTestLoaderAuthProbe(containerId: string): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    {
      label: "drain test-loader-auth backends",
      run: () => waitForTestLoaderAuthBackendDrain(containerId),
    },
    ...[TEST_LOADER_AUTH_PASSFILE, TEST_LOADER_AUTH_WRONG_PASSFILE].map(
      (path) => ({
        label: `remove test-loader-auth passfile: ${path}`,
        run: async () => {
          const remove = await dockerExec(containerId, [
            "rm",
            "-f",
            "--",
            path,
          ]);
          assertSuccess(remove, "remove test-loader-auth passfile");
        },
      }),
    ),
    {
      label: "drop ephemeral test-loader login",
      run: async () => {
        await psql(containerId, renderTestLoaderAuthCleanupSql());
      },
    },
  ];
  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    "Authenticated test-loader cleanup failed",
  );
}

async function verifyTestLoaderAuthResidueAbsent(
  containerId: string,
): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    {
      label: "verify ephemeral test-loader login is absent",
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*)
FROM pg_catalog.pg_roles
WHERE rolname = '${TEST_LOADER_AUTH_LOGIN_ROLE}';`,
          ),
          "0",
          "ephemeral test-loader login residue",
        );
      },
    },
    {
      label: "verify ephemeral test-loader membership is absent",
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*)
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role
  ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role
  ON member_role.oid = membership.member
WHERE granted_role.rolname = '${TEST_LOADER_AUTH_LOGIN_ROLE}'
   OR member_role.rolname = '${TEST_LOADER_AUTH_LOGIN_ROLE}';`,
          ),
          "0",
          "ephemeral test-loader membership residue",
        );
      },
    },
    {
      label: "verify ephemeral test-loader backend is absent",
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*)
FROM pg_catalog.pg_stat_activity
WHERE usename = '${TEST_LOADER_AUTH_LOGIN_ROLE}'
  AND backend_type = 'client backend';`,
          ),
          "0",
          "ephemeral test-loader backend residue",
        );
      },
    },
  ];

  for (const path of [
    TEST_LOADER_AUTH_PASSFILE,
    TEST_LOADER_AUTH_WRONG_PASSFILE,
  ]) {
    operations.push(
      {
        label: `verify test-loader-auth passfile is absent: ${path}`,
        run: async () => {
          const regularPath = await dockerExec(containerId, [
            "test",
            "!",
            "-e",
            path,
          ]);
          assertSuccess(
            regularPath,
            "verify test-loader-auth passfile is absent",
          );
        },
      },
      {
        label: `verify test-loader-auth passfile symlink is absent: ${path}`,
        run: async () => {
          const symlinkPath = await dockerExec(containerId, [
            "test",
            "!",
            "-L",
            path,
          ]);
          assertSuccess(
            symlinkPath,
            "verify test-loader-auth passfile symlink is absent",
          );
        },
      },
    );
  }
  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    "Authenticated test-loader residue verification failed",
  );
}

async function testLoaderAuthenticatedPsqlScalar(
  containerId: string,
  sql: string,
): Promise<string> {
  const result = await testLoaderAuthenticatedPsql(
    containerId,
    TEST_LOADER_AUTH_PASSFILE,
    sql,
  );
  assertSuccess(result, "execute authenticated test-loader SQL");
  return result.stdout.trim();
}

async function expectTestLoaderAuthenticatedPsqlFailure(
  containerId: string,
  sql: string,
  expectation: PsqlFailureExpectation,
): Promise<void> {
  const result = await testLoaderAuthenticatedPsql(
    containerId,
    TEST_LOADER_AUTH_PASSFILE,
    sql,
    { verboseErrors: true },
  );
  assertExpectedPsqlFailure(result, expectation);
}

async function testLoaderAuthenticatedPsql(
  containerId: string,
  passfile:
    typeof TEST_LOADER_AUTH_PASSFILE | typeof TEST_LOADER_AUTH_WRONG_PASSFILE,
  sql: string,
  options: TestLoaderAuthPsqlInvocationOptions = {},
): Promise<CommandResult> {
  const invocation = buildTestLoaderAuthPsqlInvocation(passfile, options);
  return runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        invocation.environment,
        invocation.command,
        sql,
      ),
    () => waitForTestLoaderAuthBackendDrain(containerId),
  );
}

async function waitForTestLoaderAuthBackendDrain(
  containerId: string,
): Promise<void> {
  await psql(containerId, renderTestLoaderAuthBackendDrainSql());
}

async function verifyAuthenticatedOwnerDdlCanarySession(
  containerId: string,
  expectedLedger: readonly string[] = LEGACY_MIGRATION_LEDGER_ROWS,
): Promise<void> {
  await verifyOwnerDdlAuthResidueAbsent(containerId, expectedLedger);

  const password = generateOwnerDdlAuthPassword();
  let wrongPassword = generateOwnerDdlAuthPassword();
  while (wrongPassword === password) {
    wrongPassword = generateOwnerDdlAuthPassword();
  }

  let probeFailed = false;
  let probeError: unknown;
  let cleanupFailed = false;
  let cleanupError: unknown;
  try {
    await provisionOwnerDdlAuthLogin(containerId, password);
    await verifyOwnerDdlAuthRoleCatalog(containerId);
    await writeOwnerDdlAuthPassfile(
      containerId,
      OWNER_DDL_AUTH_PASSFILE,
      renderOwnerDdlAuthPassfile(password),
    );
    await writeOwnerDdlAuthPassfile(
      containerId,
      OWNER_DDL_AUTH_WRONG_PASSFILE,
      renderOwnerDdlAuthPassfile(wrongPassword),
    );
    await verifyOwnerDdlWrongPasswordRejection(containerId);
    await verifyOwnerDdlLoginBeforeSetRole(containerId);
    await verifyOwnerDdlRoleEscalationDenials(containerId);
    await verifyMigrationLedger(containerId, expectedLedger);
    await verifyAuthenticatedOwnerDdlRollback(containerId, expectedLedger);
    await verifyAuthenticatedOwnerDdlCreate(containerId);
    await verifyOwnerDdlCanaryPresent(containerId);
    await verifyMigrationLedger(containerId, expectedLedger);
    await verifyAuthenticatedOwnerDdlDrop(containerId);
    await verifyOwnerDdlCanaryAbsent(containerId);
    await verifyMigrationLedger(containerId, expectedLedger);
  } catch (error) {
    probeFailed = true;
    probeError = error;
  } finally {
    try {
      throwRuntimeAuthOperationFailures(
        await collectRuntimeAuthOperationFailures([
          {
            label: "owner-DDL-auth cleanup",
            run: () => cleanupOwnerDdlAuthProbe(containerId),
          },
          {
            label: "owner-DDL-auth residue verification",
            run: () =>
              verifyOwnerDdlAuthResidueAbsent(containerId, expectedLedger),
          },
        ]),
        "Authenticated owner-DDL cleanup and residue verification failed",
      );
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
    }
  }

  if (probeFailed && cleanupFailed) {
    throw new AggregateError(
      [probeError, cleanupError],
      "Authenticated owner-DDL probe and mandatory cleanup both failed",
      { cause: probeError },
    );
  }
  if (probeFailed) throw probeError;
  if (cleanupFailed) throw cleanupError;
}

async function provisionOwnerDdlAuthLogin(
  containerId: string,
  password: string,
): Promise<void> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ],
    renderOwnerDdlAuthProvisioningSql(password),
  );
  assertSensitiveCommandSuccess(result, "provision ephemeral owner-DDL login");
}

async function verifyOwnerDdlAuthRoleCatalog(
  containerId: string,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT rolname || '|' || rolcanlogin || '|' || rolsuper || '|' ||
  rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' ||
  rolinherit || '|' || rolbypassrls || '|' || rolconnlimit || '|' ||
  (rolpassword LIKE 'SCRAM-SHA-256$%')
FROM pg_catalog.pg_authid
WHERE rolname = '${OWNER_DDL_AUTH_LOGIN_ROLE}';`,
    ),
    `${OWNER_DDL_AUTH_LOGIN_ROLE}|true|false|false|false|false|false|false|1|true`,
    "ephemeral owner-DDL login attributes and SCRAM verifier",
  );

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT granted_role.rolname || '|' || member_role.rolname || '|' ||
  membership.admin_option || '|' || membership.inherit_option || '|' ||
  membership.set_option
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role
  ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role
  ON member_role.oid = membership.member
WHERE granted_role.rolname = '${OWNER_DDL_AUTH_LOGIN_ROLE}'
   OR member_role.rolname = '${OWNER_DDL_AUTH_LOGIN_ROLE}';`,
    ),
    `${OWNER_DDL_AUTH_CAPABILITY_ROLE}|${OWNER_DDL_AUTH_LOGIN_ROLE}|false|false|true`,
    "ephemeral owner-DDL login membership",
  );

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*)
FROM pg_catalog.pg_db_role_setting
WHERE setrole = (
  SELECT oid FROM pg_catalog.pg_roles
  WHERE rolname = '${OWNER_DDL_AUTH_LOGIN_ROLE}'
);`,
    ),
    "0",
    "ephemeral owner-DDL login role settings",
  );

  assertEqual(
    await psqlScalar(
      containerId,
      `WITH login AS (
  SELECT oid FROM pg_catalog.pg_roles
  WHERE rolname = '${OWNER_DDL_AUTH_LOGIN_ROLE}'
), direct_acl AS (
  SELECT privilege.grantee
  FROM pg_catalog.pg_database AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.datacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_namespace AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.nspacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_class AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.relacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_proc AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.proacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_attribute AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.attacl) AS privilege
)
SELECT count(*)
FROM direct_acl
WHERE grantee = (SELECT oid FROM login);`,
    ),
    "0",
    "ephemeral owner-DDL login direct ACLs",
  );
}

async function writeOwnerDdlAuthPassfile(
  containerId: string,
  path: typeof OWNER_DDL_AUTH_PASSFILE | typeof OWNER_DDL_AUTH_WRONG_PASSFILE,
  contents: string,
): Promise<void> {
  const install = await dockerExec(containerId, [
    "install",
    "--mode=0600",
    "/dev/null",
    path,
  ]);
  assertSensitiveCommandSuccess(install, "create owner-DDL-auth passfile");
  const write = await dockerExec(
    containerId,
    ["dd", `of=${path}`, "status=none"],
    contents,
  );
  assertSensitiveCommandSuccess(write, "write owner-DDL-auth passfile");
  const regularFile = await dockerExec(containerId, ["test", "-f", path]);
  assertSuccess(regularFile, "verify owner-DDL-auth passfile type");
  const symlink = await dockerExec(containerId, ["test", "!", "-L", path]);
  assertSuccess(symlink, "verify owner-DDL-auth passfile is not a symlink");
  const mode = await dockerExec(containerId, ["stat", "--format=%a", path]);
  assertSuccess(mode, "inspect owner-DDL-auth passfile mode");
  assertEqual(mode.stdout.trim(), "600", "owner-DDL-auth passfile mode");
}

async function verifyOwnerDdlWrongPasswordRejection(
  containerId: string,
): Promise<void> {
  const result = await ownerDdlAuthenticatedPsql(
    containerId,
    OWNER_DDL_AUTH_WRONG_PASSFILE,
    "SELECT 1;",
    { requireScram: false },
  );
  assertOwnerDdlWrongPasswordRejection(result);
}

async function verifyOwnerDdlLoginBeforeSetRole(
  containerId: string,
): Promise<void> {
  const identity = parseJsonObject(
    await ownerDdlAuthenticatedPsqlScalar(
      containerId,
      `SELECT pg_catalog.json_build_object(
  'sessionUser', session_user,
  'currentUser', current_user,
  'systemUser', system_user,
  'clientAddress', pg_catalog.host(pg_catalog.inet_client_addr()),
  'serverAddress', pg_catalog.host(pg_catalog.inet_server_addr()),
  'ssl', EXISTS (
    SELECT 1
    FROM pg_catalog.pg_stat_ssl
    WHERE pid = pg_catalog.pg_backend_pid() AND ssl
  ),
  'ownerMember', pg_catalog.pg_has_role(
    session_user, '${OWNER_DDL_AUTH_CAPABILITY_ROLE}', 'MEMBER'
  ),
  'ownerUsage', pg_catalog.pg_has_role(
    session_user, '${OWNER_DDL_AUTH_CAPABILITY_ROLE}', 'USAGE'
  ),
  'ownerSet', pg_catalog.pg_has_role(
    session_user, '${OWNER_DDL_AUTH_CAPABILITY_ROLE}', 'SET'
  )
)::text;`,
    ),
  );
  assertJsonEqual(
    identity,
    {
      sessionUser: OWNER_DDL_AUTH_LOGIN_ROLE,
      currentUser: OWNER_DDL_AUTH_LOGIN_ROLE,
      systemUser: `scram-sha-256:${OWNER_DDL_AUTH_LOGIN_ROLE}`,
      clientAddress: "127.0.0.1",
      serverAddress: "127.0.0.1",
      ssl: false,
      ownerMember: true,
      ownerUsage: false,
      ownerSet: true,
    },
    "authenticated owner-DDL login identity before SET ROLE",
  );

  for (const [label, sql, message] of [
    [
      "owner-DDL login data access before SET ROLE",
      "SELECT count(*) FROM private_data.organizations;",
      "permission denied for schema private_data",
    ],
    [
      "owner-DDL login ledger read before SET ROLE",
      "SELECT count(*) FROM shared_data.schema_migrations;",
      "permission denied for schema shared_data",
    ],
    [
      "owner-DDL login context routine before SET ROLE",
      `CALL private_data.set_request_context(
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'display',
  'api',
  'demo_only',
  'synthetic'
);`,
      "permission denied for schema private_data",
    ],
    [
      "owner-DDL login persistent DDL before SET ROLE",
      "CREATE TABLE private_data.b6_owner_ddl_pre_role_escape (id integer);",
      "permission denied for schema private_data",
    ],
    [
      "owner-DDL login public DDL before SET ROLE",
      "CREATE TABLE public.b6_owner_ddl_public_escape (id integer);",
      "permission denied for schema public",
    ],
    [
      "owner-DDL login temporary DDL before SET ROLE",
      "CREATE TEMPORARY TABLE b6_owner_ddl_temp_escape (id integer);",
      "permission denied to create temporary tables",
    ],
  ] as const) {
    await expectOwnerDdlAuthenticatedPsqlFailure(containerId, sql, {
      label,
      sqlState: "42501",
      message,
    });
  }
}

async function verifyOwnerDdlRoleEscalationDenials(
  containerId: string,
): Promise<void> {
  for (const role of OWNER_DDL_AUTH_FORBIDDEN_SET_ROLES) {
    await expectOwnerDdlAuthenticatedPsqlFailure(
      containerId,
      `SET ROLE ${role};`,
      {
        label: `owner-DDL login SET ROLE ${role}`,
        sqlState: "42501",
        message: "permission denied to set role",
      },
    );
  }
  for (const role of OWNER_DDL_AUTH_FORBIDDEN_SESSION_AUTHORIZATION_ROLES) {
    await expectOwnerDdlAuthenticatedPsqlFailure(
      containerId,
      `SET SESSION AUTHORIZATION ${role};`,
      {
        label: `owner-DDL login SET SESSION AUTHORIZATION ${role}`,
        sqlState: "42501",
        message: "permission denied to set session authorization",
      },
    );
  }
}

async function verifyAuthenticatedOwnerDdlRollback(
  containerId: string,
  expectedLedger: readonly string[],
): Promise<void> {
  const result = await ownerDdlAuthenticatedPsql(
    containerId,
    OWNER_DDL_AUTH_PASSFILE,
    renderAuthenticatedOwnerDdlCanaryRollbackProbeSql(),
    { verboseErrors: true },
  );
  assertAuthenticatedOwnerDdlCanaryRollbackFailure(result);
  await verifyOwnerDdlCanaryAbsent(containerId);
  await verifyMigrationLedger(containerId, expectedLedger);
}

async function verifyAuthenticatedOwnerDdlCreate(
  containerId: string,
): Promise<void> {
  const result = await ownerDdlAuthenticatedPsql(
    containerId,
    OWNER_DDL_AUTH_PASSFILE,
    renderAuthenticatedOwnerDdlCanaryCreateSql(),
  );
  assertAuthenticatedOwnerDdlCanaryCreateResult(result);
}

async function verifyAuthenticatedOwnerDdlDrop(
  containerId: string,
): Promise<void> {
  const result = await ownerDdlAuthenticatedPsql(
    containerId,
    OWNER_DDL_AUTH_PASSFILE,
    renderAuthenticatedOwnerDdlCanaryDropSql(),
  );
  assertAuthenticatedOwnerDdlCanaryDropResult(result);
}

async function verifyOwnerDdlCanaryPresent(containerId: string): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT pg_catalog.pg_get_userbyid(class.relowner) || '|' ||
  class.relkind::text || '|' || class.relpersistence::text || '|' ||
  (
    SELECT count(*)
    FROM pg_catalog.aclexplode(
      coalesce(class.relacl, pg_catalog.acldefault('r', class.relowner))
    ) AS privilege
    WHERE privilege.grantee <> class.relowner
  )
FROM pg_catalog.pg_class AS class
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = class.relnamespace
WHERE namespace.nspname = 'private_data'
  AND class.relname = 'b6_owner_ddl_canary';`,
    ),
    `${OWNER_DDL_AUTH_CAPABILITY_ROLE}|r|p|0`,
    "authenticated owner-DDL canary ownership and ACL",
  );

  assertJsonEqual(
    splitLines(
      await psqlScalar(
        containerId,
        `SELECT attribute.attname || '|' ||
  pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) || '|' ||
  attribute.attnotnull
FROM pg_catalog.pg_attribute AS attribute
WHERE attribute.attrelid = '${OWNER_DDL_AUTH_CANARY_TABLE}'::regclass
  AND attribute.attnum > 0
  AND NOT attribute.attisdropped
ORDER BY attribute.attnum;`,
      ),
    ),
    ["canary_id|integer|true", "marker|text|true"],
    "authenticated owner-DDL canary columns",
  );

  assertJsonEqual(
    splitLines(
      await psqlScalar(
        containerId,
        `SELECT constraint_row.conname || '|' || constraint_row.contype::text
FROM pg_catalog.pg_constraint AS constraint_row
WHERE constraint_row.conrelid = '${OWNER_DDL_AUTH_CANARY_TABLE}'::regclass
ORDER BY constraint_row.conname;`,
      ),
    ),
    ["b6_owner_ddl_canary_marker_check|c", "b6_owner_ddl_canary_pkey|p"],
    "authenticated owner-DDL canary constraints",
  );
}

async function verifyOwnerDdlCanaryAbsent(containerId: string): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*)
FROM pg_catalog.pg_class AS class
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = class.relnamespace
WHERE namespace.nspname = 'private_data'
  AND class.relname = 'b6_owner_ddl_canary';`,
    ),
    "0",
    "authenticated owner-DDL canary residue",
  );
}

async function cleanupOwnerDdlAuthProbe(containerId: string): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    {
      label: "drain owner-DDL-auth backends",
      run: () => waitForOwnerDdlAuthBackendDrain(containerId),
    },
    ...[OWNER_DDL_AUTH_PASSFILE, OWNER_DDL_AUTH_WRONG_PASSFILE].map((path) => ({
      label: `remove owner-DDL-auth passfile: ${path}`,
      run: async () => {
        const remove = await dockerExec(containerId, ["rm", "-f", "--", path]);
        assertSuccess(remove, "remove owner-DDL-auth passfile");
      },
    })),
    {
      label: "drop owner-DDL canary residue",
      run: async () => {
        await psql(containerId, renderOwnerDdlAuthCanaryCleanupSql());
      },
    },
    {
      label: "drop ephemeral owner-DDL login",
      run: async () => {
        await psql(containerId, renderOwnerDdlAuthCleanupSql());
      },
    },
  ];
  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    "Authenticated owner-DDL cleanup failed",
  );
}

async function verifyOwnerDdlAuthResidueAbsent(
  containerId: string,
  expectedLedger: readonly string[] = LEGACY_MIGRATION_LEDGER_ROWS,
): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    {
      label: "verify ephemeral owner-DDL login is absent",
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*)
FROM pg_catalog.pg_roles
WHERE rolname = '${OWNER_DDL_AUTH_LOGIN_ROLE}';`,
          ),
          "0",
          "ephemeral owner-DDL login residue",
        );
      },
    },
    {
      label: "verify ephemeral owner-DDL membership is absent",
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*)
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role
  ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role
  ON member_role.oid = membership.member
WHERE granted_role.rolname = '${OWNER_DDL_AUTH_LOGIN_ROLE}'
   OR member_role.rolname = '${OWNER_DDL_AUTH_LOGIN_ROLE}';`,
          ),
          "0",
          "ephemeral owner-DDL membership residue",
        );
      },
    },
    {
      label: "verify ephemeral owner-DDL backend is absent",
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*)
FROM pg_catalog.pg_stat_activity
WHERE usename = '${OWNER_DDL_AUTH_LOGIN_ROLE}'
  AND backend_type = 'client backend';`,
          ),
          "0",
          "ephemeral owner-DDL backend residue",
        );
      },
    },
    {
      label: "verify owner-DDL canary is absent",
      run: () => verifyOwnerDdlCanaryAbsent(containerId),
    },
  ];

  for (const path of [OWNER_DDL_AUTH_PASSFILE, OWNER_DDL_AUTH_WRONG_PASSFILE]) {
    operations.push(
      {
        label: `verify owner-DDL-auth passfile is absent: ${path}`,
        run: async () => {
          const regularPath = await dockerExec(containerId, [
            "test",
            "!",
            "-e",
            path,
          ]);
          assertSuccess(
            regularPath,
            "verify owner-DDL-auth passfile is absent",
          );
        },
      },
      {
        label: `verify owner-DDL-auth passfile symlink is absent: ${path}`,
        run: async () => {
          const symlinkPath = await dockerExec(containerId, [
            "test",
            "!",
            "-L",
            path,
          ]);
          assertSuccess(
            symlinkPath,
            "verify owner-DDL-auth passfile symlink is absent",
          );
        },
      },
    );
  }
  operations.push({
    label: "verify migration ledger after owner-DDL cleanup",
    run: () => verifyMigrationLedger(containerId, expectedLedger),
  });
  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    "Authenticated owner-DDL residue verification failed",
  );
}

async function provisionMigratorAuthLogin(
  containerId: string,
  password: string,
): Promise<void> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ],
    renderMigratorAuthProvisioningSql(password),
  );
  assertSensitiveCommandSuccess(result, "provision ephemeral migrator login");
}

async function verifyMigratorAuthRoleCatalog(
  containerId: string,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT rolname || '|' || rolcanlogin || '|' || rolsuper || '|' ||
  rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' ||
  rolinherit || '|' || rolbypassrls || '|' || rolconnlimit || '|' ||
  (rolpassword LIKE 'SCRAM-SHA-256$%')
FROM pg_catalog.pg_authid
WHERE rolname = '${MIGRATOR_AUTH_LOGIN_ROLE}';`,
    ),
    `${MIGRATOR_AUTH_LOGIN_ROLE}|true|false|false|false|false|false|false|1|true`,
    "ephemeral migrator login attributes and SCRAM verifier",
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT granted_role.rolname || '|' || member_role.rolname || '|' ||
  membership.admin_option || '|' || membership.inherit_option || '|' ||
  membership.set_option
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
WHERE granted_role.rolname = '${MIGRATOR_AUTH_LOGIN_ROLE}'
   OR member_role.rolname = '${MIGRATOR_AUTH_LOGIN_ROLE}';`,
    ),
    `${MIGRATOR_AUTH_CAPABILITY_ROLE}|${MIGRATOR_AUTH_LOGIN_ROLE}|false|false|true`,
    "ephemeral migrator membership",
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*)
FROM pg_catalog.pg_db_role_setting
WHERE setrole = (
  SELECT oid FROM pg_catalog.pg_roles
  WHERE rolname = '${MIGRATOR_AUTH_LOGIN_ROLE}'
);`,
    ),
    "0",
    "ephemeral migrator role settings",
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `WITH login AS (
  SELECT oid FROM pg_catalog.pg_roles
  WHERE rolname = '${MIGRATOR_AUTH_LOGIN_ROLE}'
), direct_acl AS (
  SELECT privilege.grantee
  FROM pg_catalog.pg_database AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.datacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_namespace AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.nspacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_class AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.relacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_proc AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.proacl) AS privilege
  UNION ALL
  SELECT privilege.grantee
  FROM pg_catalog.pg_attribute AS object_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(object_row.attacl) AS privilege
)
SELECT count(*)
FROM direct_acl
WHERE grantee = (SELECT oid FROM login);`,
    ),
    "0",
    "ephemeral migrator direct ACLs",
  );
}

async function writeMigratorAuthPassfile(
  containerId: string,
  path: typeof MIGRATOR_AUTH_PASSFILE | typeof MIGRATOR_AUTH_WRONG_PASSFILE,
  contents: string,
): Promise<void> {
  const install = await dockerExec(containerId, [
    "install",
    "--mode=0600",
    "/dev/null",
    path,
  ]);
  assertSensitiveCommandSuccess(install, "create migrator-auth passfile");
  const write = await dockerExec(
    containerId,
    ["dd", `of=${path}`, "status=none"],
    contents,
  );
  assertSensitiveCommandSuccess(write, "write migrator-auth passfile");
  const regularFile = await dockerExec(containerId, ["test", "-f", path]);
  assertSuccess(regularFile, "verify migrator-auth passfile type");
  const symlink = await dockerExec(containerId, ["test", "!", "-L", path]);
  assertSuccess(symlink, "verify migrator-auth passfile is not a symlink");
  const mode = await dockerExec(containerId, ["stat", "--format=%a", path]);
  assertSuccess(mode, "inspect migrator-auth passfile mode");
  assertEqual(mode.stdout.trim(), "600", "migrator-auth passfile mode");
}

async function verifyMigratorWrongPasswordRejection(
  containerId: string,
  databaseName: AuthenticatedMigrationDatabaseName = AUTHENTICATED_MIGRATION_DATABASE_NAME,
): Promise<void> {
  const result = await migratorAuthenticatedPsql(
    containerId,
    MIGRATOR_AUTH_WRONG_PASSFILE,
    "SELECT 1;",
    { requireScram: false, databaseName },
  );
  assertMigratorWrongPasswordRejection(result);
}

async function verifyMigratorLoginBeforeSetRole(
  containerId: string,
  databaseName: AuthenticatedMigrationDatabaseName = AUTHENTICATED_MIGRATION_DATABASE_NAME,
): Promise<void> {
  const identity = parseJsonObject(
    await migratorAuthenticatedPsqlScalar(
      containerId,
      `SELECT pg_catalog.json_build_object(
  'sessionUser', session_user,
  'currentUser', current_user,
  'systemUser', system_user,
  'clientAddress', pg_catalog.host(pg_catalog.inet_client_addr()),
  'serverAddress', pg_catalog.host(pg_catalog.inet_server_addr()),
  'ssl', EXISTS (
    SELECT 1 FROM pg_catalog.pg_stat_ssl
    WHERE pid = pg_catalog.pg_backend_pid() AND ssl
  ),
  'ownerMember', pg_catalog.pg_has_role(
    session_user, '${MIGRATOR_AUTH_CAPABILITY_ROLE}', 'MEMBER'
  ),
  'ownerUsage', pg_catalog.pg_has_role(
    session_user, '${MIGRATOR_AUTH_CAPABILITY_ROLE}', 'USAGE'
  ),
  'ownerSet', pg_catalog.pg_has_role(
    session_user, '${MIGRATOR_AUTH_CAPABILITY_ROLE}', 'SET'
  )
)::text;`,
      databaseName,
    ),
  );
  assertJsonEqual(
    identity,
    {
      sessionUser: MIGRATOR_AUTH_LOGIN_ROLE,
      currentUser: MIGRATOR_AUTH_LOGIN_ROLE,
      systemUser: `scram-sha-256:${MIGRATOR_AUTH_LOGIN_ROLE}`,
      clientAddress: "127.0.0.1",
      serverAddress: "127.0.0.1",
      ssl: false,
      ownerMember: true,
      ownerUsage: false,
      ownerSet: true,
    },
    "authenticated migrator identity before SET ROLE",
  );

  for (const [label, sql, message] of [
    [
      "migrator persistent DDL before SET ROLE",
      "CREATE TABLE private_data.b7_migrator_pre_role_escape (id integer);",
      "permission denied for schema private_data",
    ],
    [
      "migrator public DDL before SET ROLE",
      "CREATE TABLE public.b7_migrator_public_escape (id integer);",
      "permission denied for schema public",
    ],
    [
      "migrator schema DDL before SET ROLE",
      "CREATE SCHEMA b7_migrator_schema_escape;",
      `permission denied for database ${databaseName}`,
    ],
    [
      "migrator trusted extension DDL before SET ROLE",
      "CREATE EXTENSION hstore WITH SCHEMA shared_data;",
      "permission denied to create extension",
    ],
    [
      "migrator temporary DDL before SET ROLE",
      "CREATE TEMPORARY TABLE b7_migrator_temp_escape (id integer);",
      "permission denied to create temporary tables",
    ],
  ] as const) {
    await expectMigratorAuthenticatedPsqlFailure(
      containerId,
      sql,
      { label, sqlState: "42501", message },
      databaseName,
    );
  }
}

async function verifyMigratorRoleEscalationDenials(
  containerId: string,
  databaseName: AuthenticatedMigrationDatabaseName = AUTHENTICATED_MIGRATION_DATABASE_NAME,
): Promise<void> {
  for (const role of MIGRATOR_AUTH_FORBIDDEN_SET_ROLES) {
    await expectMigratorAuthenticatedPsqlFailure(
      containerId,
      `SET ROLE ${role};`,
      {
        label: `migrator login SET ROLE ${role}`,
        sqlState: "42501",
        message: "permission denied to set role",
      },
      databaseName,
    );
  }
  for (const role of MIGRATOR_AUTH_FORBIDDEN_SESSION_AUTHORIZATION_ROLES) {
    await expectMigratorAuthenticatedPsqlFailure(
      containerId,
      `SET SESSION AUTHORIZATION ${role};`,
      {
        label: `migrator login SET SESSION AUTHORIZATION ${role}`,
        sqlState: "42501",
        message: "permission denied to set session authorization",
      },
      databaseName,
    );
  }
}

async function verifyMigratorOwnsNoObjects(
  containerId: string,
  databaseName: AuthenticatedMigrationDatabaseName = AUTHENTICATED_MIGRATION_DATABASE_NAME,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `WITH login AS (
  SELECT oid FROM pg_catalog.pg_roles
  WHERE rolname = '${MIGRATOR_AUTH_LOGIN_ROLE}'
), owned AS (
  SELECT datdba AS owner FROM pg_catalog.pg_database
  UNION ALL SELECT nspowner FROM pg_catalog.pg_namespace
  UNION ALL SELECT relowner FROM pg_catalog.pg_class
  UNION ALL SELECT proowner FROM pg_catalog.pg_proc
  UNION ALL SELECT typowner FROM pg_catalog.pg_type
  UNION ALL SELECT extowner FROM pg_catalog.pg_extension
  UNION ALL SELECT oprowner FROM pg_catalog.pg_operator
  UNION ALL SELECT conowner FROM pg_catalog.pg_conversion
  UNION ALL SELECT collowner FROM pg_catalog.pg_collation
)
SELECT count(*) FROM owned WHERE owner = (SELECT oid FROM login);`,
      databaseName,
    ),
    "0",
    "ephemeral migrator owned objects",
  );
}

async function cleanupMigratorAuthProbe(containerId: string): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    {
      label: "drain migrator-auth backends",
      run: () => waitForMigratorAuthBackendDrain(containerId),
    },
    ...[MIGRATOR_AUTH_PASSFILE, MIGRATOR_AUTH_WRONG_PASSFILE].map((path) => ({
      label: `remove migrator-auth passfile: ${path}`,
      run: async () => {
        const remove = await dockerExec(containerId, ["rm", "-f", "--", path]);
        assertSuccess(remove, "remove migrator-auth passfile");
      },
    })),
    {
      label: "drop ephemeral migrator login",
      run: async () => {
        await psql(containerId, renderMigratorAuthCleanupSql());
      },
    },
  ];
  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    "Authenticated migrator cleanup failed",
  );
}

async function verifyMigratorAuthResidueAbsent(
  containerId: string,
): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    {
      label: "verify ephemeral migrator login is absent",
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*) FROM pg_catalog.pg_roles
WHERE rolname = '${MIGRATOR_AUTH_LOGIN_ROLE}';`,
          ),
          "0",
          "ephemeral migrator login residue",
        );
      },
    },
    {
      label: "verify ephemeral migrator membership is absent",
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*)
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
WHERE granted_role.rolname = '${MIGRATOR_AUTH_LOGIN_ROLE}'
   OR member_role.rolname = '${MIGRATOR_AUTH_LOGIN_ROLE}';`,
          ),
          "0",
          "ephemeral migrator membership residue",
        );
      },
    },
    {
      label: "verify ephemeral migrator backend is absent",
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*) FROM pg_catalog.pg_stat_activity
WHERE usename = '${MIGRATOR_AUTH_LOGIN_ROLE}';`,
          ),
          "0",
          "ephemeral migrator backend residue",
        );
      },
    },
  ];
  for (const path of [MIGRATOR_AUTH_PASSFILE, MIGRATOR_AUTH_WRONG_PASSFILE]) {
    operations.push(
      {
        label: `verify migrator-auth passfile is absent: ${path}`,
        run: async () => {
          const absent = await dockerExec(containerId, [
            "test",
            "!",
            "-e",
            path,
          ]);
          assertSuccess(absent, "verify migrator-auth passfile is absent");
        },
      },
      {
        label: `verify migrator-auth symlink is absent: ${path}`,
        run: async () => {
          const absent = await dockerExec(containerId, [
            "test",
            "!",
            "-L",
            path,
          ]);
          assertSuccess(absent, "verify migrator-auth symlink is absent");
        },
      },
    );
  }
  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    "Authenticated migrator residue verification failed",
  );
}

async function migratorAuthenticatedPsqlScalar(
  containerId: string,
  sql: string,
  databaseName: AuthenticatedMigrationDatabaseName = AUTHENTICATED_MIGRATION_DATABASE_NAME,
): Promise<string> {
  const result = await migratorAuthenticatedPsql(
    containerId,
    MIGRATOR_AUTH_PASSFILE,
    sql,
    { databaseName },
  );
  assertSuccess(result, "execute authenticated migrator SQL");
  return result.stdout.trim();
}

async function expectMigratorAuthenticatedPsqlFailure(
  containerId: string,
  sql: string,
  expectation: PsqlFailureExpectation,
  databaseName: AuthenticatedMigrationDatabaseName = AUTHENTICATED_MIGRATION_DATABASE_NAME,
): Promise<void> {
  const result = await migratorAuthenticatedPsql(
    containerId,
    MIGRATOR_AUTH_PASSFILE,
    sql,
    { verboseErrors: true, databaseName },
  );
  assertExpectedPsqlFailure(result, expectation);
}

async function migratorAuthenticatedPsql(
  containerId: string,
  passfile: typeof MIGRATOR_AUTH_PASSFILE | typeof MIGRATOR_AUTH_WRONG_PASSFILE,
  sql: string,
  options: MigratorAuthPsqlInvocationOptions = {},
): Promise<CommandResult> {
  const invocation = buildMigratorAuthPsqlInvocation(passfile, options);
  return runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        invocation.environment,
        invocation.command,
        sql,
      ),
    () => waitForMigratorAuthBackendDrain(containerId),
  );
}

async function waitForMigratorAuthBackendDrain(
  containerId: string,
): Promise<void> {
  await psql(containerId, renderMigratorAuthBackendDrainSql());
}

async function ownerDdlAuthenticatedPsqlScalar(
  containerId: string,
  sql: string,
): Promise<string> {
  const result = await ownerDdlAuthenticatedPsql(
    containerId,
    OWNER_DDL_AUTH_PASSFILE,
    sql,
  );
  assertSuccess(result, "execute authenticated owner-DDL SQL");
  return result.stdout.trim();
}

async function expectOwnerDdlAuthenticatedPsqlFailure(
  containerId: string,
  sql: string,
  expectation: PsqlFailureExpectation,
): Promise<void> {
  const result = await ownerDdlAuthenticatedPsql(
    containerId,
    OWNER_DDL_AUTH_PASSFILE,
    sql,
    { verboseErrors: true },
  );
  assertExpectedPsqlFailure(result, expectation);
}

async function ownerDdlAuthenticatedPsql(
  containerId: string,
  passfile:
    typeof OWNER_DDL_AUTH_PASSFILE | typeof OWNER_DDL_AUTH_WRONG_PASSFILE,
  sql: string,
  options: OwnerDdlAuthPsqlInvocationOptions = {},
): Promise<CommandResult> {
  const invocation = buildOwnerDdlAuthPsqlInvocation(passfile, options);
  return runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        invocation.environment,
        invocation.command,
        sql,
      ),
    () => waitForOwnerDdlAuthBackendDrain(containerId),
  );
}

async function waitForOwnerDdlAuthBackendDrain(
  containerId: string,
): Promise<void> {
  await psql(containerId, renderOwnerDdlAuthBackendDrainSql());
}

async function verifyCatalogContract(
  containerId: string,
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): Promise<void> {
  const scalar = (sql: string) => psqlScalar(containerId, sql, databaseName);
  const roles = splitLines(
    await scalar(
      `SELECT rolname || '|' || rolcanlogin || '|' || rolsuper || '|' ||
  rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' ||
  rolinherit || '|' || rolbypassrls
FROM pg_catalog.pg_roles
WHERE rolname <> 'postgres'
  AND pg_catalog.left(rolname, 3) <> 'pg_'
ORDER BY rolname;`,
    ),
  );
  assertJsonEqual(
    roles,
    EXPECTED_CAPABILITY_ROLE_ATTRIBUTE_ROWS,
    "capability role attributes",
  );

  assertEqual(
    await scalar(
      `SELECT count(*)
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
WHERE granted_role.rolname LIKE 'research_cockpit_%'
   OR member_role.rolname LIKE 'research_cockpit_%';`,
    ),
    "0",
    "capability role membership edges",
  );

  const schemas = splitLines(
    await scalar(
      `SELECT nspname || '|' || pg_catalog.pg_get_userbyid(nspowner)
FROM pg_catalog.pg_namespace
WHERE nspname <> 'information_schema'
  AND pg_catalog.left(nspname, 3) <> 'pg_'
ORDER BY nspname;`,
    ),
  );
  assertJsonEqual(
    schemas,
    [
      "private_data|research_cockpit_owner",
      "public|pg_database_owner",
      "shared_data|research_cockpit_owner",
    ],
    "complete non-system schema inventory and ownership",
  );

  const relationState = splitLines(
    await scalar(
      `SELECT namespace.nspname || '.' || class.relname || '|' ||
  class.relkind::text || '|' || pg_catalog.pg_get_userbyid(class.relowner) || '|' ||
  class.relrowsecurity || '|' || class.relforcerowsecurity
FROM pg_catalog.pg_class AS class
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
WHERE namespace.nspname IN ('private_data', 'shared_data')
  AND class.relkind IN ('r', 'p', 'v', 'm', 'f', 'S', 'c')
ORDER BY namespace.nspname, class.relname;`,
    ),
  );
  assertJsonEqual(
    relationState,
    APPLICATION_TABLES.map(
      (table) =>
        `${table}|r|research_cockpit_owner|${
          table === "shared_data.schema_migrations"
            ? `${CATALOG_FALSE}|${CATALOG_FALSE}`
            : `${CATALOG_TRUE}|${CATALOG_TRUE}`
        }`,
    ),
    "application table and prohibited relation-kind inventory, ownership, and RLS state",
  );

  const tablePrivileges = splitLines(
    await scalar(
      `SELECT namespace.nspname || '.' || class.relname || '|' ||
  CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_class AS class
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(
    class.relacl,
    pg_catalog.acldefault('r', class.relowner)
  )
) AS privilege
WHERE namespace.nspname IN ('private_data', 'shared_data')
  AND class.relkind = 'r'
  AND privilege.grantee <> class.relowner
ORDER BY 1;`,
    ),
  );
  const expectedTablePrivileges = [
    ...APPLICATION_TABLES.map(
      (table) => `${table}|research_cockpit_backup|SELECT`,
    ),
    ...RUNTIME_SELECT_TABLES.map(
      (table) => `${table}|research_cockpit_runtime|SELECT`,
    ),
    ...PROTECTED_TABLES.flatMap((table) => [
      `${table}|research_cockpit_test_seed|INSERT|${CATALOG_FALSE}`,
      `${table}|research_cockpit_test_seed|SELECT|${CATALOG_FALSE}`,
    ]),
  ]
    .map((line) =>
      line.endsWith(`|${CATALOG_FALSE}`) ? line : `${line}|${CATALOG_FALSE}`,
    )
    .sort();
  assertJsonEqual(
    tablePrivileges,
    expectedTablePrivileges,
    "exact capability table ACLs",
  );

  const schemaPrivileges = splitLines(
    await scalar(
      `SELECT namespace.nspname || '|' ||
  CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_namespace AS namespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(
    namespace.nspacl,
    pg_catalog.acldefault('n', namespace.nspowner)
  )
) AS privilege
WHERE namespace.nspname <> 'information_schema'
  AND pg_catalog.left(namespace.nspname, 3) <> 'pg_'
  AND privilege.grantee <> namespace.nspowner
ORDER BY 1;`,
    ),
  );
  assertJsonEqual(
    schemaPrivileges,
    ["private_data", "shared_data"].flatMap((schema) =>
      [
        "research_cockpit_backup",
        "research_cockpit_runtime",
        "research_cockpit_test_seed",
      ].map((role) => `${schema}|${role}|USAGE|${CATALOG_FALSE}`),
    ),
    "exact capability schema ACLs",
  );

  const databasePrivileges = splitLines(
    await scalar(
      `SELECT CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_database AS database
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(
    database.datacl,
    pg_catalog.acldefault('d', database.datdba)
  )
) AS privilege
WHERE database.datname = pg_catalog.current_database()
  AND privilege.grantee <> database.datdba
ORDER BY 1;`,
    ),
  );
  assertJsonEqual(
    databasePrivileges,
    [`PUBLIC|CONNECT|${CATALOG_FALSE}`],
    "exact acceptance-database non-owner ACLs",
  );

  assertEqual(
    await scalar(
      `SELECT count(*)
FROM pg_catalog.pg_attribute AS attribute
JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS privilege
WHERE namespace.nspname IN ('private_data', 'shared_data')
  AND attribute.attnum > 0
  AND NOT attribute.attisdropped
  AND privilege.grantee <> class.relowner;`,
    ),
    "0",
    "column-level capability ACLs",
  );

  const routinePrivileges = splitLines(
    await scalar(
      `SELECT namespace.nspname || '.' || procedure.proname || '|' ||
  CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_proc AS procedure
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(
    procedure.proacl,
    pg_catalog.acldefault('f', procedure.proowner)
  )
) AS privilege
WHERE namespace.nspname IN ('private_data', 'shared_data')
  AND privilege.grantee <> procedure.proowner
ORDER BY 1;`,
    ),
  );
  assertJsonEqual(
    routinePrivileges,
    RUNTIME_EXECUTE_ROUTINES.map(
      (routine) =>
        `${routine}|research_cockpit_runtime|EXECUTE|${CATALOG_FALSE}`,
    ).sort(),
    "exact capability routine ACLs",
  );

  const routineOwners = splitLines(
    await scalar(
      `SELECT namespace.nspname || '.' || procedure.proname || '|' ||
  pg_catalog.pg_get_userbyid(procedure.proowner)
FROM pg_catalog.pg_proc AS procedure
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname IN ('private_data', 'shared_data')
  AND procedure.proname = ANY (ARRAY[
    'current_channel',
    'current_data_classification',
    'current_organization_id',
    'current_principal_id',
    'current_purpose',
    'current_territory',
    'guard_live_resource_identity',
    'guard_resource_id_registry',
    'has_active_entitlement',
    'has_active_membership',
    'rights_allow_current_use',
    'set_request_context',
    'tombstone_resource_id_after_delete'
  ])
ORDER BY 1;`,
    ),
  );
  assertJsonEqual(
    routineOwners,
    OWNED_APPLICATION_ROUTINES.map(
      (routine) => `${routine}|research_cockpit_owner`,
    ),
    "application routine ownership",
  );

  const policies = splitLines(
    await scalar(
      `SELECT namespace.nspname || '.' || class.relname || '|' ||
  policy.polname || '|' ||
  CASE policy.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END || '|' ||
  CASE pg_catalog.cardinality(policy.polroles)
    WHEN 1 THEN pg_catalog.pg_get_userbyid(policy.polroles[1])
    ELSE '<invalid-role-count>'
  END
FROM pg_catalog.pg_policy AS policy
JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
WHERE namespace.nspname IN ('private_data', 'shared_data')
ORDER BY 1;`,
    ),
  );
  assertJsonEqual(
    policies,
    await expectedPolicyCatalogLines(),
    "exact RLS policy table, command, and role bindings",
  );
  assertEqual(
    await scalar(
      `SELECT namespace.nspname || '|' || extension.extversion
FROM pg_catalog.pg_extension AS extension
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = extension.extnamespace
WHERE extension.extname = 'btree_gist';`,
    ).then((value) => value.split("|")[0] ?? ""),
    "shared_data",
    "btree_gist extension schema",
  );
  assertJsonEqual(
    splitLines(
      await scalar(
        `SELECT namespace.nspname || '.' || class.relname || '|' ||
  constraint_row.contype::text || '|' || count(*)
FROM pg_catalog.pg_constraint AS constraint_row
JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
WHERE namespace.nspname IN ('private_data', 'shared_data')
GROUP BY namespace.nspname, class.relname, constraint_row.contype
ORDER BY 1;`,
      ),
    ),
    EXPECTED_CONSTRAINT_COUNTS,
    "complete application constraint type counts",
  );
  assertJsonEqual(
    splitLines(
      await scalar(
        `SELECT class.relname || '|' || constraint_row.conname
FROM pg_catalog.pg_constraint AS constraint_row
JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
WHERE constraint_row.conname IN (
  'memberships_no_overlap',
  'symbol_history_no_system_overlap',
  'financial_facts_no_system_overlap',
  'theses_require_live_registered_id',
  'alert_rules_require_live_registered_id'
)
ORDER BY 1;`,
      ),
    ),
    [
      "alert_rules|alert_rules_require_live_registered_id",
      "financial_facts|financial_facts_no_system_overlap",
      "memberships|memberships_no_overlap",
      "symbol_history|symbol_history_no_system_overlap",
      "theses|theses_require_live_registered_id",
    ],
    "reviewed exclusion and live-state constraints",
  );
  assertJsonEqual(
    splitLines(
      await scalar(
        `SELECT namespace.nspname || '.' || class.relname || '|' ||
  trigger.tgname || '|' || trigger.tgenabled::text || '|' || trigger.tgtype || '|' ||
  function_namespace.nspname || '.' || procedure.proname || '|' ||
  coalesce(
    pg_catalog.pg_get_expr(trigger.tgqual, trigger.tgrelid),
    '<none>'
  ) || '|' || pg_catalog.encode(trigger.tgargs, 'hex')
FROM pg_catalog.pg_trigger AS trigger
JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
JOIN pg_catalog.pg_proc AS procedure ON procedure.oid = trigger.tgfoid
JOIN pg_catalog.pg_namespace AS function_namespace
  ON function_namespace.oid = procedure.pronamespace
WHERE NOT trigger.tgisinternal
  AND namespace.nspname IN ('private_data', 'shared_data')
ORDER BY 1;`,
      ),
    ),
    [
      "private_data.alert_rules|alert_rules_identity_immutable|O|19|private_data.guard_live_resource_identity|<none>|",
      "private_data.alert_rules|alert_rules_tombstone_after_delete|O|9|private_data.tombstone_resource_id_after_delete|<none>|616c65727400",
      "private_data.resource_id_registry|resource_id_registry_append_only|O|27|private_data.guard_resource_id_registry|<none>|",
      "private_data.theses|theses_identity_immutable|O|19|private_data.guard_live_resource_identity|<none>|",
      "private_data.theses|theses_tombstone_after_delete|O|9|private_data.tombstone_resource_id_after_delete|<none>|74686573697300",
    ],
    "exact non-internal application trigger bindings",
  );
}

async function expectedPolicyCatalogLines(): Promise<string[]> {
  const sql = (await loadMigrationFiles())
    .map((migration) => migration.sql)
    .join("\n");
  const declaredPolicies = sql.match(/\bCREATE\s+POLICY\b/gi)?.length ?? 0;
  const lines = [
    ...sql.matchAll(
      /CREATE\s+POLICY\s+([a-z][a-z0-9_]*)\s+ON\s+([a-z_]+\.[a-z_]+)\s+FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\s+TO\s+(research_cockpit_(?:runtime|test_seed|backup))/gi,
    ),
  ].map((match) => {
    const [, policy, table, command, role] = match;
    if (!policy || !table || !command || !role) {
      throw new Error("Unable to parse a reviewed RLS policy declaration");
    }
    return `${table.toLowerCase()}|${policy.toLowerCase()}|${command.toUpperCase()}|${role.toLowerCase()}`;
  });
  if (lines.length !== declaredPolicies) {
    throw new Error(
      `Parsed ${lines.length} of ${declaredPolicies} reviewed RLS policies`,
    );
  }
  return lines.sort();
}

async function verifyContextCleanup(
  containerId: string,
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): Promise<void> {
  const scalar = (sql: string) => psqlScalar(containerId, sql, databaseName);
  const expectFailure = (sql: string, expectation: PsqlFailureExpectation) =>
    expectPsqlFailure(containerId, sql, expectation, databaseName);
  const missing = parseJsonObject(
    await scalar(
      runtimeWithoutContextSql(`SELECT pg_catalog.json_build_object(
  'privateRows',
    (SELECT count(*) FROM private_data.alert_rules) +
    (SELECT count(*) FROM private_data.entitlements) +
    (SELECT count(*) FROM private_data.idempotency_records) +
    (SELECT count(*) FROM private_data.memberships) +
    (SELECT count(*) FROM private_data.organization_principals) +
    (SELECT count(*) FROM private_data.organizations) +
    (SELECT count(*) FROM private_data.principals) +
    (SELECT count(*) FROM private_data.resource_id_registry) +
    (SELECT count(*) FROM private_data.theses),
  'sharedRows',
    (SELECT count(*) FROM shared_data.evidence) +
    (SELECT count(*) FROM shared_data.exchanges) +
    (SELECT count(*) FROM shared_data.financial_facts) +
    (SELECT count(*) FROM shared_data.issuers) +
    (SELECT count(*) FROM shared_data.listings) +
    (SELECT count(*) FROM shared_data.metric_definitions) +
    (SELECT count(*) FROM shared_data.rights_grants) +
    (SELECT count(*) FROM shared_data.rights_policies) +
    (SELECT count(*) FROM shared_data.securities) +
    (SELECT count(*) FROM shared_data.share_classes) +
    (SELECT count(*) FROM shared_data.symbol_history)
)::text;`),
    ),
  );
  assertJsonEqual(
    missing,
    { privateRows: 0, sharedRows: 0 },
    "missing context visibility",
  );

  const cleanup = splitLines(await scalar(contextCleanupSql()));
  assertJsonEqual(
    cleanup,
    ["cleared", "cleared", "cleared"],
    "context cleanup",
  );

  const malformed = await scalar(malformedContextSql());
  assertEqual(malformed, "cleared", "malformed context side effects");
  for (const [label, arguments_, message] of [
    [
      "null principal",
      `NULL::uuid, '${ORGANIZATION_ALPHA}'::uuid,
  'display', 'api', 'demo_only', 'synthetic'`,
      "principal and organization context are required",
    ],
    [
      "null organization",
      `'${PRINCIPAL_ALPHA}'::uuid, NULL::uuid,
  'display', 'api', 'demo_only', 'synthetic'`,
      "principal and organization context are required",
    ],
    [
      "null purpose",
      `'${PRINCIPAL_ALPHA}'::uuid, '${ORGANIZATION_ALPHA}'::uuid,
  NULL::text, 'api', 'demo_only', 'synthetic'`,
      "unsupported data purpose",
    ],
    [
      "null channel",
      `'${PRINCIPAL_ALPHA}'::uuid, '${ORGANIZATION_ALPHA}'::uuid,
  'display', NULL::text, 'demo_only', 'synthetic'`,
      "unsupported data channel",
    ],
    [
      "null territory",
      `'${PRINCIPAL_ALPHA}'::uuid, '${ORGANIZATION_ALPHA}'::uuid,
  'display', 'api', NULL::text, 'synthetic'`,
      "the static harness accepts synthetic demo context only",
    ],
    [
      "null classification",
      `'${PRINCIPAL_ALPHA}'::uuid, '${ORGANIZATION_ALPHA}'::uuid,
  'display', 'api', 'demo_only', NULL::text`,
      "the static harness accepts synthetic demo context only",
    ],
  ] as const) {
    await expectFailure(
      `SET SESSION AUTHORIZATION research_cockpit_runtime;
BEGIN;
CALL private_data.set_request_context(${arguments_});
ROLLBACK;
RESET SESSION AUTHORIZATION;`,
      { label, sqlState: "P0001", message },
    );
  }
  await expectFailure(
    `SET SESSION AUTHORIZATION research_cockpit_runtime;
BEGIN;
SELECT pg_catalog.set_config('app.principal_id', 'not-a-uuid', true);
SELECT private_data.current_principal_id();
ROLLBACK;
RESET SESSION AUTHORIZATION;`,
    {
      label: "malformed direct context",
      sqlState: "22P02",
      message: "invalid input syntax for type uuid",
    },
  );
}

async function verifyRuntimeAuthorizationMatrix(
  client: RuntimeAuthorizationMatrixClient,
): Promise<void> {
  await verifyTenantIsolation(client);
  await verifyOperationRights(client);
}

async function verifyTenantIsolation(
  client: RuntimeAuthorizationMatrixClient,
): Promise<void> {
  const alpha = await privateVisibility(
    client,
    PRINCIPAL_ALPHA,
    ORGANIZATION_ALPHA,
  );
  assertJsonEqual(
    alpha,
    {
      principalIds: PRINCIPAL_ALPHA,
      membershipIds: `${ORGANIZATION_ALPHA}|${PRINCIPAL_ALPHA}|owner`,
      associationIds: `${ORGANIZATION_ALPHA}|${PRINCIPAL_ALPHA}`,
      organizationIds: ORGANIZATION_ALPHA,
      entitlementIds: `${ORGANIZATION_ALPHA}|30000000-0000-4000-8000-000000000001`,
      thesisIds: `${ORGANIZATION_ALPHA}|40000000-0000-4000-8000-000000000001|Synthetic Alpha thesis.`,
      alertIds: `${ORGANIZATION_ALPHA}|40000000-0000-4000-8000-000000000002|above`,
      idempotencyIds: `${ORGANIZATION_ALPHA}|synthetic-alpha-key`,
      registryIds: `${ORGANIZATION_ALPHA}|alert|40000000-0000-4000-8000-000000000002,${ORGANIZATION_ALPHA}|thesis|40000000-0000-4000-8000-000000000001`,
      evidenceIds: "evidence-display-only,evidence-full-v1",
    },
    "alpha tenant visibility",
  );
  const beta = await privateVisibility(
    client,
    PRINCIPAL_BETA,
    ORGANIZATION_BETA,
  );
  assertJsonEqual(
    beta,
    {
      principalIds: PRINCIPAL_BETA,
      membershipIds: `${ORGANIZATION_BETA}|${PRINCIPAL_BETA}|owner`,
      associationIds: `${ORGANIZATION_BETA}|${PRINCIPAL_BETA}`,
      organizationIds: ORGANIZATION_BETA,
      entitlementIds: `${ORGANIZATION_BETA}|30000000-0000-4000-8000-000000000002`,
      thesisIds: `${ORGANIZATION_BETA}|40000000-0000-4000-8000-000000000001|Synthetic Beta thesis.`,
      alertIds: `${ORGANIZATION_BETA}|40000000-0000-4000-8000-000000000002|below`,
      idempotencyIds: `${ORGANIZATION_BETA}|synthetic-beta-key`,
      registryIds: `${ORGANIZATION_BETA}|alert|40000000-0000-4000-8000-000000000002,${ORGANIZATION_BETA}|thesis|40000000-0000-4000-8000-000000000001`,
      evidenceIds: "evidence-display-only,evidence-full-v1",
    },
    "beta tenant visibility",
  );

  const directIsolation = parseJsonObject(
    await client.scalar(
      renderRuntimeContextSql(
        client.mode,
        PRINCIPAL_ALPHA,
        ORGANIZATION_ALPHA,
        "display",
        "api",
        `SELECT pg_catalog.json_build_object(
  'foreignOrganization', (
    SELECT count(*) FROM private_data.organizations
    WHERE id = '${ORGANIZATION_BETA}'
  ),
  'foreignThesisJoin', (
    SELECT count(*)
    FROM private_data.theses AS thesis
    JOIN private_data.organizations AS organization
      ON organization.id = thesis.organization_id
    WHERE thesis.organization_id = '${ORGANIZATION_BETA}'
  ),
  'foreignExists', EXISTS (
    SELECT 1 FROM private_data.alert_rules
    WHERE organization_id = '${ORGANIZATION_BETA}'
  ),
  'foreignScalar', coalesce((
    SELECT slug FROM private_data.organizations
    WHERE id = '${ORGANIZATION_BETA}'
  ), '<hidden>'),
  'sameThesisIdVisible', (
    SELECT count(*) FROM private_data.theses
    WHERE id = '40000000-0000-4000-8000-000000000001'
  )
)::text;`,
      ),
    ),
  );
  assertJsonEqual(
    directIsolation,
    {
      foreignOrganization: 0,
      foreignThesisJoin: 0,
      foreignExists: false,
      foreignScalar: "<hidden>",
      sameThesisIdVisible: 1,
    },
    "direct, join, EXISTS, scalar, and duplicate-ID tenant isolation",
  );

  for (const [label, principal, expectedPrincipalRows] of [
    ["inactive", PRINCIPAL_INACTIVE, 0],
    ["no membership", PRINCIPAL_NO_MEMBERSHIP, 1],
    ["expired membership", PRINCIPAL_EXPIRED, 1],
    ["future membership", PRINCIPAL_FUTURE, 1],
  ] as const) {
    const visibility = await privateVisibility(
      client,
      principal,
      ORGANIZATION_ALPHA,
    );
    assertJsonEqual(
      visibility,
      {
        principalIds: expectedPrincipalRows === 1 ? principal : "<none>",
        membershipIds: "<none>",
        associationIds: "<none>",
        organizationIds: "<none>",
        entitlementIds: "<none>",
        thesisIds: "<none>",
        alertIds: "<none>",
        idempotencyIds: "<none>",
        registryIds: "<none>",
        evidenceIds: "<none>",
      },
      `${label} visibility`,
    );
  }

  const alternating = splitLines(
    await client.scalar(renderAlternatingPreparedStatementSql(client.mode)),
  ).map((line) => parseJsonObject(line));
  assertJsonEqual(
    alternating,
    [
      { organization: ORGANIZATION_ALPHA, theses: 1 },
      { organization: ORGANIZATION_BETA, theses: 1 },
      { organization: ORGANIZATION_ALPHA, theses: 1 },
      { organization: ORGANIZATION_BETA, theses: 1 },
    ],
    "alternating prepared-statement tenant contexts",
  );
}

async function verifyOperationRights(
  client: RuntimeAuthorizationMatrixClient,
): Promise<void> {
  for (const expectation of [
    {
      purpose: "display",
      channel: "api",
      evidence: ["evidence-display-only", "evidence-full-v1"],
      facts:
        "fact-display-only|synthetic.display-only|1.0.0,fact-full-v1|synthetic.full|1.0.0",
    },
    {
      purpose: "derive",
      channel: "api",
      evidence: ["evidence-full-v1"],
      facts: "fact-full-v1|synthetic.full|1.0.0",
    },
    {
      purpose: "alert",
      channel: "local_alert",
      evidence: ["evidence-full-v1"],
      facts: "fact-full-v1|synthetic.full|1.0.0",
    },
  ] as const) {
    const actual = parseJsonObject(
      await client.scalar(
        renderRuntimeContextSql(
          client.mode,
          PRINCIPAL_ALPHA,
          ORGANIZATION_ALPHA,
          expectation.purpose,
          expectation.channel,
          `SELECT pg_catalog.json_build_object(
  'evidence', (
    SELECT coalesce(
      pg_catalog.json_agg(id ORDER BY id),
      '[]'::json
    )
    FROM shared_data.evidence
  ),
  'facts', (SELECT coalesce(pg_catalog.string_agg(
    id || '|' || rights_policy_id || '|' || rights_policy_version,
    ',' ORDER BY id
  ), '<none>') FROM shared_data.financial_facts)
)::text;`,
        ),
      ),
    );
    assertJsonEqual(
      actual,
      { evidence: expectation.evidence, facts: expectation.facts },
      `${expectation.purpose}/${expectation.channel} rights visibility`,
    );
  }
}

async function verifyWriteDenials(
  containerId: string,
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): Promise<void> {
  const expectFailure = (sql: string, expectation: PsqlFailureExpectation) =>
    expectPsqlFailure(containerId, sql, expectation, databaseName);
  await expectFailure(
    renderRuntimeContextSql(
      "impersonated",
      PRINCIPAL_ALPHA,
      ORGANIZATION_ALPHA,
      "display",
      "api",
      `INSERT INTO private_data.organizations (id, slug, name, created_at)
VALUES (
  '10000000-0000-4000-8000-000000000099',
  'runtime-write-probe',
  'Runtime write probe',
  transaction_timestamp()
);`,
    ),
    {
      label: "runtime write",
      sqlState: "42501",
      message: "permission denied for table organizations",
    },
  );
  for (const [label, sql, message] of [
    [
      "test-seed update",
      `UPDATE private_data.organizations
SET name = 'Mutation probe'
WHERE id = '${ORGANIZATION_ALPHA}';`,
      "permission denied for table organizations",
    ],
    [
      "test-seed delete",
      `DELETE FROM private_data.idempotency_records
WHERE organization_id = '${ORGANIZATION_ALPHA}';`,
      "permission denied for table idempotency_records",
    ],
    [
      "test-seed truncate",
      "TRUNCATE TABLE private_data.audit_events;",
      "permission denied for table audit_events",
    ],
    [
      "test-seed ledger read",
      "SELECT count(*) FROM shared_data.schema_migrations;",
      "permission denied for table schema_migrations",
    ],
  ] as const) {
    await expectFailure(
      `SET SESSION AUTHORIZATION research_cockpit_test_seed;
BEGIN;
${sql}
ROLLBACK;
RESET SESSION AUTHORIZATION;`,
      { label, sqlState: "42501", message },
    );
  }

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*) FROM private_data.organizations
WHERE id = '10000000-0000-4000-8000-000000000099';`,
      databaseName,
    ),
    "0",
    "failed runtime write rollback",
  );
}

async function verifyAuthenticatedRuntimeSession(
  containerId: string,
  adapterEndpoint: PostgresProjectionAdapterEndpoint,
): Promise<void> {
  await verifyRuntimeAuthResidueAbsent(containerId);

  const password = generateRuntimeAuthPassword();
  let wrongPassword = generateRuntimeAuthPassword();
  while (wrongPassword === password) {
    wrongPassword = generateRuntimeAuthPassword();
  }

  let probeFailed = false;
  let probeError: unknown;
  let cleanupFailed = false;
  let cleanupError: unknown;
  try {
    await provisionRuntimeAuthLogin(containerId, password);
    await verifyRuntimeAuthRoleCatalog(containerId);
    await writeRuntimeAuthPassfile(
      containerId,
      RUNTIME_AUTH_PASSFILE,
      renderRuntimeAuthPassfile(password),
    );
    await writeRuntimeAuthPassfile(
      containerId,
      RUNTIME_AUTH_WRONG_PASSFILE,
      renderRuntimeAuthPassfile(wrongPassword),
    );
    await verifyRuntimeWrongPasswordRejection(containerId);
    await verifyRuntimeLoginBeforeSetRole(containerId);
    await verifyRuntimeRoleEscalationDenials(containerId);
    await verifyRuntimeAuthenticatedContext(containerId);
    await verifyRuntimeAuthenticatedWriteDenial(containerId);
    await verifyRuntimeAuthorizationMatrix(
      runtimeAuthorizationMatrixClient(containerId, "authenticated"),
    );
    await verifyRuntimeAuthenticatedFinancialFactProjection(containerId);
    await verifyPostgresProjectionAdapterWrongPasswordRejection(
      containerId,
      adapterEndpoint,
      wrongPassword,
    );
    await verifyPostgresProjectionAdapter(
      containerId,
      adapterEndpoint,
      password,
    );
  } catch (error) {
    probeFailed = true;
    probeError = error;
  } finally {
    try {
      throwRuntimeAuthOperationFailures(
        await collectRuntimeAuthOperationFailures([
          {
            label: "runtime-auth cleanup",
            run: () => cleanupRuntimeAuthProbe(containerId),
          },
          {
            label: "runtime-auth residue verification",
            run: () => verifyRuntimeAuthResidueAbsent(containerId),
          },
        ]),
        "Authenticated runtime cleanup and residue verification failed",
      );
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
    }
  }

  if (probeFailed && cleanupFailed) {
    throw new AggregateError(
      [probeError, cleanupError],
      "Authenticated runtime probe and mandatory cleanup both failed",
      { cause: probeError },
    );
  }
  if (probeFailed) throw probeError;
  if (cleanupFailed) throw cleanupError;
}

async function verifyRuntimeAuthenticatedFinancialFactProjection(
  containerId: string,
): Promise<void> {
  for (const acceptanceCase of runtimeProjectionAcceptanceCases()) {
    const stdout = await runtimeAuthenticatedPsqlScalar(
      containerId,
      renderRuntimeAuthenticatedFinancialFactProjectionSql(
        acceptanceCase.query,
        acceptanceCase.principalId,
        acceptanceCase.organizationId,
      ),
    );
    const result = normalizeRuntimeAuthenticatedFinancialFactProjectionOutput(
      acceptanceCase.query,
      stdout,
    );
    assertRuntimeAuthenticatedFinancialFactProjectionResult(
      acceptanceCase,
      result,
    );
  }
}

function runtimeProjectionAcceptanceCases(): readonly RuntimeProjectionAcceptanceCase[] {
  const displayOnly: RuntimeProjectionExpectedCandidate = Object.freeze({
    rowId: "fact-display-only",
    conceptKey: "synthetic_display_only",
    value: "200.00",
    evidenceId: "evidence-display-only",
    rightsPolicyId: "synthetic.display-only",
  });
  const full: RuntimeProjectionExpectedCandidate = Object.freeze({
    rowId: "fact-full-v1",
    conceptKey: "synthetic_full_v1",
    value: "100.00",
    evidenceId: "evidence-full-v1",
    rightsPolicyId: "synthetic.full",
  });
  return Object.freeze([
    {
      label: "display/API",
      principalId: PRINCIPAL_ALPHA,
      organizationId: ORGANIZATION_ALPHA,
      query: runtimeProjectionQuery("display_api"),
      expectedCandidates: [displayOnly, full],
      expectedPolicyIds: ["synthetic.display-only", "synthetic.full"],
    },
    {
      label: "derive/API",
      principalId: PRINCIPAL_ALPHA,
      organizationId: ORGANIZATION_ALPHA,
      query: runtimeProjectionQuery("derive_api"),
      expectedCandidates: [full],
      expectedPolicyIds: ["synthetic.full"],
    },
    {
      label: "alert/local-alert",
      principalId: PRINCIPAL_ALPHA,
      organizationId: ORGANIZATION_ALPHA,
      query: runtimeProjectionQuery("alert_local_alert"),
      expectedCandidates: [full],
      expectedPolicyIds: ["synthetic.full"],
    },
    {
      label: "missing listing",
      principalId: PRINCIPAL_ALPHA,
      organizationId: ORGANIZATION_ALPHA,
      query: runtimeProjectionQuery(
        "display_api",
        POSTGRES_PROJECTION_MISSING_LISTING_ID,
      ),
      expectedCandidates: [],
      expectedPolicyIds: [],
    },
    {
      label: "pre-cutoff",
      principalId: PRINCIPAL_ALPHA,
      organizationId: ORGANIZATION_ALPHA,
      query: runtimeProjectionQuery(
        "display_api",
        POSTGRES_PROJECTION_LISTING_ID,
        POSTGRES_PROJECTION_PRE_PUBLIC_KNOWN_AT,
      ),
      expectedCandidates: [],
      expectedPolicyIds: [],
    },
    {
      label: "inactive principal",
      principalId: PRINCIPAL_INACTIVE,
      organizationId: ORGANIZATION_ALPHA,
      query: runtimeProjectionQuery("display_api"),
      expectedCandidates: [],
      expectedPolicyIds: [],
    },
    {
      label: "no current membership",
      principalId: PRINCIPAL_NO_MEMBERSHIP,
      organizationId: ORGANIZATION_ALPHA,
      query: runtimeProjectionQuery("display_api"),
      expectedCandidates: [],
      expectedPolicyIds: [],
    },
  ]);
}

export function assertPostgresProjectionAdapterWrongPasswordRejection(
  error: unknown,
): void {
  try {
    if (isRecord(error) && error.code === "28P01") return;
  } catch {
    // The public failure below deliberately excludes the rejected driver value.
  }
  throw new PostgresProjectionAdapterError();
}

async function verifyPostgresProjectionAdapterWrongPasswordRejection(
  containerId: string,
  endpoint: PostgresProjectionAdapterEndpoint,
  wrongPassword: string,
): Promise<void> {
  const client = createPostgresProjectionAdapterClient(endpoint, wrongPassword);
  let rejected = false;
  let failed = false;
  const ignoreIdleError = () => undefined;
  client.on("error", ignoreIdleError);
  try {
    await client.connect();
  } catch (error) {
    try {
      assertPostgresProjectionAdapterWrongPasswordRejection(error);
      rejected = true;
    } catch {
      failed = true;
    }
  } finally {
    try {
      await client.end();
    } catch {
      failed = true;
    }
    client.removeListener("error", ignoreIdleError);
    try {
      await waitForRuntimeAuthBackendDrain(containerId);
    } catch {
      failed = true;
    }
  }
  if (!rejected || failed) throw new PostgresProjectionAdapterError();
}

async function verifyPostgresProjectionAdapter(
  containerId: string,
  endpoint: PostgresProjectionAdapterEndpoint,
  password: string,
): Promise<void> {
  const client = createPostgresProjectionAdapterClient(endpoint, password);
  let idleClientFailed = false;
  let probeFailed = false;
  let cleanupFailed = false;
  const recordIdleError = () => {
    idleClientFailed = true;
  };
  client.on("error", recordIdleError);
  try {
    await client.connect();
    const backendPid = await assertPostgresProjectionAdapterClientIdle(client);
    await verifyPostgresProjectionAdapterReadOnlyBoundary(client, backendPid);

    let actor: PostgresProjectionActorContext = Object.freeze({
      principalId: PRINCIPAL_ALPHA,
      organizationId: ORGANIZATION_ALPHA,
    });
    const actorProvider = Object.freeze({ current: () => actor });
    const source = new PostgresFinancialFactProjectionSource(
      client,
      actorProvider,
    );
    const baselineCases = runtimeProjectionAcceptanceCases();
    const displayCase = baselineCases[0];
    if (displayCase === undefined) throw new PostgresProjectionAdapterError();
    await verifyPostgresProjectionAdapterOuterTransactionReset(
      client,
      actorProvider,
      displayCase,
      backendPid,
    );
    const sequentialCases: readonly RuntimeProjectionAcceptanceCase[] = [
      ...baselineCases,
      {
        ...displayCase,
        label: "B9 alpha sequential read",
      },
      {
        ...displayCase,
        label: "B9 beta sequential read",
        principalId: PRINCIPAL_BETA,
        organizationId: ORGANIZATION_BETA,
      },
      {
        ...displayCase,
        label: "B9 alpha sequential reuse",
      },
      {
        ...displayCase,
        label: "B9 cross-tenant actor mismatch",
        principalId: PRINCIPAL_ALPHA,
        organizationId: ORGANIZATION_BETA,
        expectedCandidates: [],
        expectedPolicyIds: [],
      },
    ];
    for (const acceptanceCase of sequentialCases) {
      actor = Object.freeze({
        principalId: acceptanceCase.principalId,
        organizationId: acceptanceCase.organizationId,
      });
      const result = await source.load(acceptanceCase.query);
      if (result === null) throw new PostgresProjectionAdapterError();
      assertRuntimeAuthenticatedFinancialFactProjectionResult(
        acceptanceCase,
        result,
      );
      await assertPostgresProjectionAdapterClientIdle(client, backendPid);
    }

    actor = Object.freeze({
      principalId: PRINCIPAL_ALPHA,
      organizationId: ORGANIZATION_ALPHA,
    });
    await verifyPostgresProjectionAdapterInjectedRollback(
      client,
      actorProvider,
      displayCase,
      backendPid,
    );
    if (idleClientFailed) throw new PostgresProjectionAdapterError();
  } catch {
    probeFailed = true;
  } finally {
    client.removeListener("error", recordIdleError);
    try {
      await client.end();
    } catch {
      cleanupFailed = true;
    }
    try {
      await waitForRuntimeAuthBackendDrain(containerId);
    } catch {
      cleanupFailed = true;
    }
  }
  if (probeFailed || cleanupFailed || idleClientFailed) {
    throw new PostgresProjectionAdapterError();
  }
}

function createPostgresProjectionAdapterClient(
  endpoint: PostgresProjectionAdapterEndpoint,
  password: string,
): Client {
  return new Client({
    host: endpoint.host,
    port: endpoint.port,
    database: CLEAN_BOOTSTRAP_DATABASE_NAME,
    user: RUNTIME_AUTH_LOGIN_ROLE,
    password,
    ssl: false,
    application_name: POSTGRES_PROJECTION_ADAPTER_APPLICATION_NAME,
  });
}

async function assertPostgresProjectionAdapterClientIdle(
  client: Client,
  expectedBackendPid?: number,
): Promise<number> {
  const result = await client.query<{ state: string }>(`SELECT
  pg_catalog.json_build_object(
    'backendPid', pg_catalog.pg_backend_pid(),
    'sessionUser', session_user,
    'currentUser', current_user,
    'systemUser', system_user,
    'transactionReadOnly', pg_catalog.current_setting('transaction_read_only'),
    'applicationName', pg_catalog.current_setting('application_name'),
    'contextCleared', (
      coalesce(pg_catalog.current_setting('app.principal_id', true), '') = ''
      AND coalesce(pg_catalog.current_setting('app.organization_id', true), '') = ''
      AND coalesce(pg_catalog.current_setting('app.purpose', true), '') = ''
      AND coalesce(pg_catalog.current_setting('app.channel', true), '') = ''
      AND coalesce(pg_catalog.current_setting('app.territory', true), '') = ''
      AND coalesce(
        pg_catalog.current_setting('app.data_classification', true), ''
      ) = ''
    ),
    'ssl', EXISTS (
      SELECT 1 FROM pg_catalog.pg_stat_ssl
      WHERE pid = pg_catalog.pg_backend_pid() AND ssl
    )
  )::text AS state;`);
  const stateText = result.rows[0]?.state;
  if (result.command !== "SELECT" || result.rowCount !== 1 || !stateText) {
    throw new PostgresProjectionAdapterError();
  }
  const state = JSON.parse(stateText) as unknown;
  if (
    !isRecord(state) ||
    !Number.isSafeInteger(state.backendPid) ||
    (state.backendPid as number) <= 0 ||
    (expectedBackendPid !== undefined &&
      state.backendPid !== expectedBackendPid) ||
    state.sessionUser !== RUNTIME_AUTH_LOGIN_ROLE ||
    state.currentUser !== RUNTIME_AUTH_LOGIN_ROLE ||
    state.systemUser !== `scram-sha-256:${RUNTIME_AUTH_LOGIN_ROLE}` ||
    state.transactionReadOnly !== "off" ||
    state.applicationName !== POSTGRES_PROJECTION_ADAPTER_APPLICATION_NAME ||
    state.contextCleared !== true ||
    state.ssl !== false
  ) {
    throw new PostgresProjectionAdapterError();
  }
  return state.backendPid as number;
}

async function verifyPostgresProjectionAdapterOuterTransactionReset(
  client: Client,
  actorProvider: { current(): PostgresProjectionActorContext },
  acceptanceCase: RuntimeProjectionAcceptanceCase,
  backendPid: number,
): Promise<void> {
  let probeFailed = false;
  let cleanupFailed = false;
  let adapterTransactionObserved = false;
  const forwardQuery = client.query.bind(client) as (
    input: unknown,
  ) => Promise<unknown>;
  const probeClient = Object.freeze({
    query: (async (input: unknown) => {
      if (
        isRecord(input) &&
        typeof input.text === "string" &&
        input.text.startsWith("WITH bounded_projection AS")
      ) {
        const state = await client.query<{ valid: boolean }>({
          text: `SELECT (
  pg_catalog.pg_backend_pid() = $1::integer
  AND session_user = $2::name
  AND current_user = $3::name
  AND pg_catalog.current_setting('transaction_read_only') = 'on'
  AND pg_catalog.current_setting(
    'app.b9_outer_transaction_canary', true
  ) = 'baseline'
) AS valid;`,
          values: [
            backendPid,
            RUNTIME_AUTH_LOGIN_ROLE,
            RUNTIME_AUTH_CAPABILITY_ROLE,
          ],
        });
        if (state.rowCount !== 1 || state.rows[0]?.valid !== true) {
          throw new PostgresProjectionAdapterError();
        }
        adapterTransactionObserved = true;
      }
      return forwardQuery(input);
    }) as unknown as Client["query"],
  });
  const source = new PostgresFinancialFactProjectionSource(
    probeClient,
    actorProvider,
  );
  try {
    await client.query(`SELECT pg_catalog.set_config(
  'app.b9_outer_transaction_canary',
  'baseline',
  false
);`);
    await client.query("BEGIN READ WRITE");
    await client.query(`SELECT pg_catalog.set_config(
  'app.b9_outer_transaction_canary',
  'outer-must-rollback',
  false
);`);
    const result = await source.load(acceptanceCase.query);
    if (result === null) throw new PostgresProjectionAdapterError();
    assertRuntimeAuthenticatedFinancialFactProjectionResult(
      acceptanceCase,
      result,
    );
    const state = await client.query<{ valid: boolean }>({
      text: `SELECT (
  pg_catalog.pg_backend_pid() = $1::integer
  AND pg_catalog.current_setting('transaction_read_only') = 'off'
  AND pg_catalog.current_setting(
    'app.b9_outer_transaction_canary', true
  ) = 'baseline'
) AS valid;`,
      values: [backendPid],
    });
    if (
      !adapterTransactionObserved ||
      state.rowCount !== 1 ||
      state.rows[0]?.valid !== true
    ) {
      throw new PostgresProjectionAdapterError();
    }
  } catch {
    probeFailed = true;
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      cleanupFailed = true;
    }
    try {
      await client.query("RESET app.b9_outer_transaction_canary");
    } catch {
      cleanupFailed = true;
    }
  }
  if (probeFailed || cleanupFailed) throw new PostgresProjectionAdapterError();
  await assertPostgresProjectionAdapterClientIdle(client, backendPid);
}

async function verifyPostgresProjectionAdapterReadOnlyBoundary(
  client: Client,
  backendPid: number,
): Promise<void> {
  let mutationDenied = false;
  await client.query("BEGIN READ ONLY");
  try {
    await client.query(`SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE}`);
    await client.query({
      text: `CALL private_data.set_request_context(
  $1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text
)`,
      values: [
        PRINCIPAL_ALPHA,
        ORGANIZATION_ALPHA,
        "display",
        "api",
        "demo_only",
        "synthetic",
      ],
    });
    const state = await client.query<{ valid: boolean }>({
      text: `SELECT (
  pg_catalog.pg_backend_pid() = $1::integer
  AND session_user = $2::name
  AND current_user = $3::name
  AND system_user = $4::text
  AND pg_catalog.current_setting('transaction_read_only') = 'on'
  AND private_data.current_principal_id() = $5::uuid
  AND private_data.current_organization_id() = $6::uuid
  AND private_data.current_purpose() = 'display'
  AND private_data.current_channel() = 'api'
  AND private_data.current_territory() = 'demo_only'
  AND private_data.current_data_classification() = 'synthetic'
) AS valid;`,
      values: [
        backendPid,
        RUNTIME_AUTH_LOGIN_ROLE,
        RUNTIME_AUTH_CAPABILITY_ROLE,
        `scram-sha-256:${RUNTIME_AUTH_LOGIN_ROLE}`,
        PRINCIPAL_ALPHA,
        ORGANIZATION_ALPHA,
      ],
    });
    if (state.rowCount !== 1 || state.rows[0]?.valid !== true) {
      throw new PostgresProjectionAdapterError();
    }
    try {
      await client.query(`INSERT INTO private_data.organizations (
  id, slug, name, created_at
) VALUES (
  '10000000-0000-4000-8000-000000000096',
  'b9-read-only-probe',
  'B9 read-only probe',
  transaction_timestamp()
);`);
    } catch (error) {
      mutationDenied = postgresErrorCode(error) === "25006";
    }
  } finally {
    await client.query("ROLLBACK");
  }
  if (!mutationDenied) throw new PostgresProjectionAdapterError();
  await assertPostgresProjectionAdapterClientIdle(client, backendPid);
}

async function verifyPostgresProjectionAdapterInjectedRollback(
  client: Client,
  actorProvider: { current(): PostgresProjectionActorContext },
  acceptanceCase: RuntimeProjectionAcceptanceCase,
  backendPid: number,
): Promise<void> {
  const secretCanary = "b9-injected-driver-secret-canary";
  const forwardQuery = client.query.bind(client) as (
    input: unknown,
  ) => Promise<unknown>;
  let injectFailure = true;
  const injectedClient = Object.freeze({
    query: (async (input: unknown) => {
      if (
        injectFailure &&
        isRecord(input) &&
        typeof input.text === "string" &&
        input.text.startsWith("WITH bounded_projection AS")
      ) {
        injectFailure = false;
        throw new Error(secretCanary);
      }
      return forwardQuery(input);
    }) as unknown as Client["query"],
  });
  const source = new PostgresFinancialFactProjectionSource(
    injectedClient,
    actorProvider,
  );
  let failure: unknown;
  try {
    await source.load(acceptanceCase.query);
  } catch (error) {
    failure = error;
  }
  if (
    !(failure instanceof PostgresProjectionAdapterError) ||
    failure.code !== "POSTGRES_PROJECTION_ADAPTER_FAILURE" ||
    String(failure).includes(secretCanary) ||
    Object.hasOwn(failure, "cause") ||
    injectFailure
  ) {
    throw new PostgresProjectionAdapterError();
  }
  await assertPostgresProjectionAdapterClientIdle(client, backendPid);
  const result = await source.load(acceptanceCase.query);
  if (result === null) throw new PostgresProjectionAdapterError();
  assertRuntimeAuthenticatedFinancialFactProjectionResult(
    acceptanceCase,
    result,
  );
  await assertPostgresProjectionAdapterClientIdle(client, backendPid);
}

function postgresErrorCode(error: unknown): string | null {
  try {
    return isRecord(error) && typeof error.code === "string"
      ? error.code
      : null;
  } catch {
    return null;
  }
}

function runtimeProjectionQuery(
  operation: ProjectionOperation,
  instrumentId = POSTGRES_PROJECTION_LISTING_ID,
  publicKnownAt = POSTGRES_PROJECTION_PUBLIC_KNOWN_AT,
): OperationProjectionQuery {
  return {
    scope: {
      instrumentId,
      publicKnownAt,
      systemRecordedAt: POSTGRES_PROJECTION_SYSTEM_RECORDED_AT,
    },
    operation,
    context: {
      territory: "demo_only",
      evaluatedAt: POSTGRES_PROJECTION_EVALUATED_AT,
    },
  };
}

export function renderRuntimeAuthenticatedFinancialFactProjectionSql(
  query: OperationProjectionQuery,
  principalId: string,
  organizationId: string,
): string {
  const operationContext = postgresProjectionOperationContext(query.operation);
  const projectionSql = renderPostgresFinancialFactProjectionQuery(
    query.operation,
  );
  const statement = `SELECT pg_catalog.concat(
  'b4-projection-identity|',
  session_user, '|', current_user, '|', system_user
);
PREPARE ${POSTGRES_PROJECTION_PREPARED_STATEMENT} (
  text, timestamptz, timestamptz
) AS
${projectionSql}
EXECUTE ${POSTGRES_PROJECTION_PREPARED_STATEMENT}(
  ${postgresSqlTextLiteral(query.scope.instrumentId)},
  ${postgresSqlTextLiteral(query.scope.publicKnownAt)},
  ${postgresSqlTextLiteral(query.scope.systemRecordedAt)}
);
DEALLOCATE ${POSTGRES_PROJECTION_PREPARED_STATEMENT};`;

  return renderRuntimeContextSql(
    "authenticated",
    principalId,
    organizationId,
    operationContext.purpose,
    operationContext.channel,
    statement,
  );
}

function normalizeRuntimeAuthenticatedFinancialFactProjectionOutput(
  query: OperationProjectionQuery,
  stdout: string,
): OperationProjectionSourceResult<FinancialFact> {
  const lines = stdout.split(/\r?\n/);
  const identity = lines.shift();
  if (identity !== POSTGRES_PROJECTION_IDENTITY_MARKER) {
    throw new Error(
      "Authenticated financial-fact projection identity mismatch",
    );
  }
  const rows = parsePostgresFinancialFactProjectionRows(lines.join("\n"));
  return normalizePostgresFinancialFactProjectionRows(query, rows);
}

function assertRuntimeAuthenticatedFinancialFactProjectionResult(
  acceptanceCase: RuntimeProjectionAcceptanceCase,
  result: OperationProjectionSourceResult<FinancialFact>,
): void {
  const query = acceptanceCase.query;
  assertRuntimeProjectionCondition(
    result.operation === query.operation &&
      JSON.stringify(result.scope) === JSON.stringify(query.scope),
    acceptanceCase.label,
  );
  assertRuntimeProjectionCondition(
    result.completeness.state === "unknown" &&
      result.completeness.reason === "rls_filtered",
    acceptanceCase.label,
  );
  assertRuntimeProjectionCondition(
    result.candidates.length === acceptanceCase.expectedCandidates.length &&
      result.policies.length === acceptanceCase.expectedPolicyIds.length,
    acceptanceCase.label,
  );

  for (const [index, expected] of acceptanceCase.expectedCandidates.entries()) {
    const candidate = result.candidates[index];
    assertRuntimeProjectionCondition(
      candidate !== undefined &&
        candidate.rowId === expected.rowId &&
        candidate.instrumentId === query.scope.instrumentId &&
        candidate.rightsPolicyId === expected.rightsPolicyId &&
        candidate.rightsPolicyVersion === "1.0.0" &&
        candidate.value.id === expected.rowId &&
        candidate.value.instrumentId === query.scope.instrumentId &&
        candidate.value.key === expected.conceptKey &&
        candidate.value.value === expected.value &&
        candidate.value.unit === "USD_MILLIONS" &&
        candidate.value.reportingPeriodEnd === "2024-12-31" &&
        candidate.value.publicKnownFrom ===
          POSTGRES_PROJECTION_PUBLIC_KNOWN_AT &&
        candidate.value.publicKnownTo === null &&
        candidate.value.systemRecordedFrom ===
          POSTGRES_PROJECTION_SYSTEM_RECORDED_AT &&
        candidate.value.systemRecordedTo === null &&
        candidate.value.sourceAvailableAt === "2025-01-01T00:00:00.000Z" &&
        candidate.value.evidenceId === expected.evidenceId &&
        candidate.value.rightsPolicyId === expected.rightsPolicyId &&
        candidate.value.rightsPolicyVersion === "1.0.0" &&
        candidate.value.qualityState === "verified_fixture",
      acceptanceCase.label,
    );
  }

  const operationContext = postgresProjectionOperationContext(query.operation);
  for (const [
    index,
    expectedPolicyId,
  ] of acceptanceCase.expectedPolicyIds.entries()) {
    const policy = result.policies[index];
    assertRuntimeProjectionCondition(
      policy !== undefined &&
        policy.id === expectedPolicyId &&
        policy.version === "1.0.0" &&
        policy.classification === "synthetic" &&
        policy.territory === "demo_only" &&
        policy.expiresAt === null &&
        policy.grants.length === 1 &&
        policy.grants[0]?.purpose === operationContext.purpose &&
        policy.grants[0]?.channel === operationContext.channel &&
        policy.grants[0]?.allowed === true,
      acceptanceCase.label,
    );
  }
}

function assertRuntimeProjectionCondition(
  condition: boolean,
  label: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      `Authenticated financial-fact projection ${label} mismatch`,
    );
  }
}

function postgresSqlTextLiteral(value: string): string {
  if (value.includes("\0")) {
    throw new Error("Authenticated financial-fact projection input is invalid");
  }
  return `'${value.replaceAll("'", "''")}'`;
}

async function verifyRuntimeAuthResidueAbsent(
  containerId: string,
): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    {
      label: "verify ephemeral runtime login is absent",
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*)
FROM pg_catalog.pg_roles
WHERE rolname = '${RUNTIME_AUTH_LOGIN_ROLE}';`,
          ),
          "0",
          "ephemeral runtime login residue",
        );
      },
    },
  ];

  for (const path of [RUNTIME_AUTH_PASSFILE, RUNTIME_AUTH_WRONG_PASSFILE]) {
    operations.push(
      {
        label: `verify runtime-auth passfile is absent: ${path}`,
        run: async () => {
          const regularPath = await dockerExec(containerId, [
            "test",
            "!",
            "-e",
            path,
          ]);
          assertSuccess(regularPath, "verify runtime-auth passfile is absent");
        },
      },
      {
        label: `verify runtime-auth passfile symlink is absent: ${path}`,
        run: async () => {
          const symlinkPath = await dockerExec(containerId, [
            "test",
            "!",
            "-L",
            path,
          ]);
          assertSuccess(
            symlinkPath,
            "verify runtime-auth passfile symlink is absent",
          );
        },
      },
    );
  }

  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    "Authenticated runtime residue verification failed",
  );
}

async function provisionRuntimeAuthLogin(
  containerId: string,
  password: string,
): Promise<void> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ],
    renderRuntimeAuthProvisioningSql(password),
  );
  assertSensitiveCommandSuccess(result, "provision ephemeral runtime login");
}

async function verifyRuntimeAuthRoleCatalog(
  containerId: string,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT rolname || '|' || rolcanlogin || '|' || rolsuper || '|' ||
  rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' ||
  rolinherit || '|' || rolbypassrls || '|' || rolconnlimit || '|' ||
  (rolpassword LIKE 'SCRAM-SHA-256$%')
FROM pg_catalog.pg_authid
WHERE rolname = '${RUNTIME_AUTH_LOGIN_ROLE}';`,
    ),
    `${RUNTIME_AUTH_LOGIN_ROLE}|true|false|false|false|false|false|false|1|true`,
    "ephemeral runtime login attributes and SCRAM verifier",
  );

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT granted_role.rolname || '|' || member_role.rolname || '|' ||
  membership.admin_option || '|' || membership.inherit_option || '|' ||
  membership.set_option
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role
  ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role
  ON member_role.oid = membership.member
WHERE granted_role.rolname = '${RUNTIME_AUTH_LOGIN_ROLE}'
   OR member_role.rolname = '${RUNTIME_AUTH_LOGIN_ROLE}';`,
    ),
    `${RUNTIME_AUTH_CAPABILITY_ROLE}|${RUNTIME_AUTH_LOGIN_ROLE}|false|false|true`,
    "ephemeral runtime login membership",
  );

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*)
FROM pg_catalog.pg_db_role_setting
WHERE setrole = (
  SELECT oid FROM pg_catalog.pg_roles
  WHERE rolname = '${RUNTIME_AUTH_LOGIN_ROLE}'
);`,
    ),
    "0",
    "ephemeral runtime login role settings",
  );
}

async function writeRuntimeAuthPassfile(
  containerId: string,
  path: typeof RUNTIME_AUTH_PASSFILE | typeof RUNTIME_AUTH_WRONG_PASSFILE,
  contents: string,
): Promise<void> {
  const install = await dockerExec(containerId, [
    "install",
    "--mode=0600",
    "/dev/null",
    path,
  ]);
  assertSensitiveCommandSuccess(install, "create runtime-auth passfile");
  const write = await dockerExec(
    containerId,
    ["dd", `of=${path}`, "status=none"],
    contents,
  );
  assertSensitiveCommandSuccess(write, "write runtime-auth passfile");
  const regularFile = await dockerExec(containerId, ["test", "-f", path]);
  assertSuccess(regularFile, "verify runtime-auth passfile type");
  const symlink = await dockerExec(containerId, ["test", "!", "-L", path]);
  assertSuccess(symlink, "verify runtime-auth passfile is not a symlink");
  const mode = await dockerExec(containerId, ["stat", "--format=%a", path]);
  assertSuccess(mode, "inspect runtime-auth passfile mode");
  assertEqual(mode.stdout.trim(), "600", "runtime-auth passfile mode");
}

async function verifyRuntimeWrongPasswordRejection(
  containerId: string,
): Promise<void> {
  const result = await runtimeAuthenticatedPsql(
    containerId,
    RUNTIME_AUTH_WRONG_PASSFILE,
    "SELECT 1;",
    { requireScram: false },
  );
  assertRuntimeWrongPasswordRejection(result);
}

async function verifyRuntimeLoginBeforeSetRole(
  containerId: string,
): Promise<void> {
  const identity = parseJsonObject(
    await runtimeAuthenticatedPsqlScalar(
      containerId,
      `SELECT pg_catalog.json_build_object(
  'sessionUser', session_user,
  'currentUser', current_user,
  'systemUser', system_user,
  'clientAddress', pg_catalog.host(pg_catalog.inet_client_addr()),
  'serverAddress', pg_catalog.host(pg_catalog.inet_server_addr()),
  'ssl', EXISTS (
    SELECT 1
    FROM pg_catalog.pg_stat_ssl
    WHERE pid = pg_catalog.pg_backend_pid() AND ssl
  ),
  'runtimeMember', pg_catalog.pg_has_role(
    session_user, '${RUNTIME_AUTH_CAPABILITY_ROLE}', 'MEMBER'
  ),
  'runtimeUsage', pg_catalog.pg_has_role(
    session_user, '${RUNTIME_AUTH_CAPABILITY_ROLE}', 'USAGE'
  ),
  'runtimeSet', pg_catalog.pg_has_role(
    session_user, '${RUNTIME_AUTH_CAPABILITY_ROLE}', 'SET'
  )
)::text;`,
    ),
  );
  assertJsonEqual(
    identity,
    {
      sessionUser: RUNTIME_AUTH_LOGIN_ROLE,
      currentUser: RUNTIME_AUTH_LOGIN_ROLE,
      systemUser: `scram-sha-256:${RUNTIME_AUTH_LOGIN_ROLE}`,
      clientAddress: "127.0.0.1",
      serverAddress: "127.0.0.1",
      ssl: false,
      runtimeMember: true,
      runtimeUsage: false,
      runtimeSet: true,
    },
    "authenticated runtime login identity before SET ROLE",
  );

  await expectRuntimeAuthenticatedPsqlFailure(
    containerId,
    "SELECT count(*) FROM private_data.organizations;",
    {
      label: "runtime login data access before SET ROLE",
      sqlState: "42501",
      message: "permission denied for schema private_data",
    },
  );
  await expectRuntimeAuthenticatedPsqlFailure(
    containerId,
    `CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'display', 'api', 'demo_only', 'synthetic'
);`,
    {
      label: "runtime login context call before SET ROLE",
      sqlState: "42501",
      message: "permission denied for schema private_data",
    },
  );
  await expectRuntimeAuthenticatedPsqlFailure(
    containerId,
    "CREATE TEMPORARY TABLE runtime_auth_escape (id integer);",
    {
      label: "runtime login temporary table before SET ROLE",
      sqlState: "42501",
      message: "permission denied to create temporary tables",
    },
  );
}

async function verifyRuntimeRoleEscalationDenials(
  containerId: string,
): Promise<void> {
  for (const role of RUNTIME_AUTH_FORBIDDEN_SET_ROLES) {
    await expectRuntimeAuthenticatedPsqlFailure(
      containerId,
      `SET ROLE ${role};`,
      {
        label: `runtime login SET ROLE ${role}`,
        sqlState: "42501",
        message: "permission denied to set role",
      },
    );
  }
  await expectRuntimeAuthenticatedPsqlFailure(
    containerId,
    "SET SESSION AUTHORIZATION postgres;",
    {
      label: "runtime login SET SESSION AUTHORIZATION postgres",
      sqlState: "42501",
      message: "permission denied to set session authorization",
    },
  );
}

async function verifyRuntimeAuthenticatedContext(
  containerId: string,
): Promise<void> {
  const resetState = (label: string) => `SELECT CASE
  WHEN current_user = session_user
    AND ${requestContextClearedExpression()}
  THEN '${label}-cleared'
  ELSE '${label}-leaked'
END;`;
  const result = splitLines(
    await runtimeAuthenticatedPsqlScalar(
      containerId,
      `BEGIN;
SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE};
SELECT pg_catalog.json_build_object(
  'organizations', (SELECT count(*) FROM private_data.organizations),
  'evidence', (SELECT count(*) FROM shared_data.evidence),
  'theses', (SELECT count(*) FROM private_data.theses)
)::text;
ROLLBACK;
${resetState("missing-context")}
BEGIN;
SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE};
CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'display', 'api', 'demo_only', 'synthetic'
);
SELECT pg_catalog.json_build_object(
  'sessionUser', session_user,
  'currentUser', current_user,
  'systemUser', system_user,
  'organizations', (
    SELECT count(*) FROM private_data.organizations
  ),
  'foreignOrganizations', (
    SELECT count(*) FROM private_data.organizations
    WHERE id = '${ORGANIZATION_BETA}'
  ),
  'theses', (SELECT count(*) FROM private_data.theses),
  'foreignTheses', (
    SELECT count(*) FROM private_data.theses
    WHERE organization_id = '${ORGANIZATION_BETA}'
  )
)::text;
COMMIT;
${resetState("commit")}
BEGIN;
SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE};
CALL private_data.set_request_context(
  '${PRINCIPAL_BETA}', '${ORGANIZATION_BETA}',
  'derive', 'api', 'demo_only', 'synthetic'
);
ROLLBACK;
${resetState("rollback")}
BEGIN;
SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE};
CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'alert', 'local_alert', 'demo_only', 'synthetic'
);
DO $handled_runtime_auth_error$
BEGIN
  BEGIN
    PERFORM 1 / 0;
  EXCEPTION WHEN division_by_zero THEN
    NULL;
  END;
END;
$handled_runtime_auth_error$;
COMMIT;
${resetState("error")}`,
    ),
  );
  if (result.length !== 6 || !result[0] || !result[2]) {
    throw new Error("Authenticated runtime context probe returned wrong shape");
  }
  assertJsonEqual(
    parseJsonObject(result[0]),
    { organizations: 0, evidence: 0, theses: 0 },
    "authenticated runtime missing-context visibility",
  );
  assertEqual(
    result[1] ?? "",
    "missing-context-cleared",
    "authenticated runtime missing-context rollback",
  );
  assertJsonEqual(
    parseJsonObject(result[2]),
    {
      sessionUser: RUNTIME_AUTH_LOGIN_ROLE,
      currentUser: RUNTIME_AUTH_CAPABILITY_ROLE,
      systemUser: `scram-sha-256:${RUNTIME_AUTH_LOGIN_ROLE}`,
      organizations: 1,
      foreignOrganizations: 0,
      theses: 1,
      foreignTheses: 0,
    },
    "authenticated runtime tenant read",
  );
  assertJsonEqual(
    result.slice(3),
    ["commit-cleared", "rollback-cleared", "error-cleared"],
    "authenticated runtime role and context cleanup",
  );
}

async function verifyRuntimeAuthenticatedWriteDenial(
  containerId: string,
): Promise<void> {
  await expectRuntimeAuthenticatedPsqlFailure(
    containerId,
    `BEGIN;
SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE};
CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'display', 'api', 'demo_only', 'synthetic'
);
INSERT INTO private_data.organizations (id, slug, name, created_at)
VALUES (
  '10000000-0000-4000-8000-000000000097',
  'authenticated-runtime-write-probe',
  'Authenticated runtime write probe',
  transaction_timestamp()
);`,
    {
      label: "authenticated runtime write",
      sqlState: "42501",
      message: "permission denied for table organizations",
    },
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*) FROM private_data.organizations
WHERE id = '10000000-0000-4000-8000-000000000097';`,
    ),
    "0",
    "failed authenticated runtime write rollback",
  );
}

async function cleanupRuntimeAuthProbe(containerId: string): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    ...[RUNTIME_AUTH_PASSFILE, RUNTIME_AUTH_WRONG_PASSFILE].map((path) => ({
      label: `remove runtime-auth passfile: ${path}`,
      run: async () => {
        const remove = await dockerExec(containerId, ["rm", "-f", "--", path]);
        assertSuccess(remove, "remove runtime-auth passfile");
      },
    })),
    {
      label: "drop ephemeral runtime login",
      run: async () => {
        await psql(containerId, renderRuntimeAuthCleanupSql());
      },
    },
  ];

  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    "Authenticated runtime cleanup failed",
  );
}

async function runtimeAuthenticatedPsqlScalar(
  containerId: string,
  sql: string,
): Promise<string> {
  const result = await runtimeAuthenticatedPsql(
    containerId,
    RUNTIME_AUTH_PASSFILE,
    sql,
  );
  assertSuccess(result, "execute authenticated runtime SQL");
  return result.stdout.trim();
}

async function expectRuntimeAuthenticatedPsqlFailure(
  containerId: string,
  sql: string,
  expectation: PsqlFailureExpectation,
): Promise<void> {
  const result = await runtimeAuthenticatedPsql(
    containerId,
    RUNTIME_AUTH_PASSFILE,
    sql,
    { verboseErrors: true },
  );
  assertExpectedPsqlFailure(result, expectation);
}

async function runtimeAuthenticatedPsql(
  containerId: string,
  passfile: typeof RUNTIME_AUTH_PASSFILE | typeof RUNTIME_AUTH_WRONG_PASSFILE,
  sql: string,
  options: RuntimeAuthPsqlInvocationOptions = {},
): Promise<CommandResult> {
  const invocation = buildRuntimeAuthPsqlInvocation(passfile, options);
  return runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        invocation.environment,
        invocation.command,
        sql,
      ),
    () => waitForRuntimeAuthBackendDrain(containerId),
  );
}

async function waitForRuntimeAuthBackendDrain(
  containerId: string,
): Promise<void> {
  await psql(containerId, renderRuntimeAuthBackendDrainSql());
}

function assertSensitiveCommandSuccess(
  result: CommandResult,
  operation: string,
): void {
  if (result.exitCode !== 0) {
    throw new Error(`${operation} failed with exit ${result.exitCode}`);
  }
}

function runtimeAuthorizationMatrixClient(
  containerId: string,
  mode: RuntimeAuthorizationMatrixMode,
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): RuntimeAuthorizationMatrixClient {
  if (
    mode === "authenticated" &&
    databaseName !== CLEAN_BOOTSTRAP_DATABASE_NAME
  ) {
    throw new Error(
      "Authenticated runtime matrix is restricted to the reviewed source database",
    );
  }
  return Object.freeze({
    mode,
    scalar: (sql: string) =>
      mode === "authenticated"
        ? runtimeAuthenticatedPsqlScalar(containerId, sql)
        : psqlScalar(containerId, sql, databaseName),
  });
}

async function privateVisibility(
  client: RuntimeAuthorizationMatrixClient,
  principalId: string,
  organizationId: string,
): Promise<PrivateVisibility> {
  return parseJsonObject(
    await client.scalar(
      renderRuntimeContextSql(
        client.mode,
        principalId,
        organizationId,
        "display",
        "api",
        `SELECT pg_catalog.json_build_object(
  'principalIds', (SELECT coalesce(
    pg_catalog.string_agg(id::text, ',' ORDER BY id), '<none>'
  ) FROM private_data.principals),
  'membershipIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || principal_id::text || '|' || role,
    ',' ORDER BY organization_id, principal_id, active_from
  ), '<none>') FROM private_data.memberships),
  'associationIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || principal_id::text,
    ',' ORDER BY organization_id, principal_id
  ), '<none>') FROM private_data.organization_principals),
  'organizationIds', (SELECT coalesce(
    pg_catalog.string_agg(id::text, ',' ORDER BY id), '<none>'
  ) FROM private_data.organizations),
  'entitlementIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || id::text,
    ',' ORDER BY organization_id, id
  ), '<none>') FROM private_data.entitlements),
  'thesisIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || id::text || '|' || claim,
    ',' ORDER BY organization_id, id
  ), '<none>') FROM private_data.theses),
  'alertIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || id::text || '|' || operator,
    ',' ORDER BY organization_id, id
  ), '<none>') FROM private_data.alert_rules),
  'idempotencyIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || idempotency_key,
    ',' ORDER BY organization_id, idempotency_key
  ), '<none>') FROM private_data.idempotency_records),
  'registryIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || resource_type || '|' || resource_id::text,
    ',' ORDER BY organization_id, resource_type, resource_id
  ), '<none>') FROM private_data.resource_id_registry),
  'evidenceIds', (SELECT coalesce(
    pg_catalog.string_agg(id, ',' ORDER BY id), '<none>'
  ) FROM shared_data.evidence)
)::text;`,
      ),
    ),
  ) as unknown as PrivateVisibility;
}

export function renderRuntimeContextSql(
  mode: RuntimeAuthorizationMatrixMode,
  principalId: string,
  organizationId: string,
  purpose: "display" | "derive" | "alert",
  channel: "api" | "local_alert",
  statement: string,
): string {
  const localRole =
    mode === "authenticated"
      ? `SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE};\n`
      : "";
  const transaction = `BEGIN;
${localRole}CALL private_data.set_request_context(
  '${principalId}',
  '${organizationId}',
  '${purpose}',
  '${channel}',
  'demo_only',
  'synthetic'
);
${statement}
COMMIT;`;
  return mode === "authenticated"
    ? transaction
    : `SET SESSION AUTHORIZATION ${RUNTIME_AUTH_CAPABILITY_ROLE};
${transaction}
RESET SESSION AUTHORIZATION;`;
}

function runtimeWithoutContextSql(statement: string): string {
  return `SET SESSION AUTHORIZATION research_cockpit_runtime;
BEGIN;
${statement}
ROLLBACK;
RESET SESSION AUTHORIZATION;`;
}

function contextCleanupSql(): string {
  const cleanupProbe = `SELECT CASE
  WHEN ${requestContextClearedExpression()} THEN 'cleared'
  ELSE 'leaked'
END;`;
  return `SET SESSION AUTHORIZATION research_cockpit_runtime;
BEGIN;
CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'display', 'api', 'demo_only', 'synthetic'
);
COMMIT;
${cleanupProbe}
BEGIN;
CALL private_data.set_request_context(
  '${PRINCIPAL_BETA}', '${ORGANIZATION_BETA}',
  'derive', 'api', 'demo_only', 'synthetic'
);
ROLLBACK;
${cleanupProbe}
BEGIN;
CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'alert', 'local_alert', 'demo_only', 'synthetic'
);
DO $handled_error$
BEGIN
  BEGIN
    PERFORM 1 / 0;
  EXCEPTION WHEN division_by_zero THEN
    NULL;
  END;
END;
$handled_error$;
COMMIT;
${cleanupProbe}
RESET SESSION AUTHORIZATION;`;
}

function malformedContextSql(): string {
  return `SET SESSION AUTHORIZATION research_cockpit_runtime;
BEGIN;
DO $malformed_context$
DECLARE
  rejected boolean := false;
BEGIN
  BEGIN
    CALL private_data.set_request_context(
      '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
      'unsupported', 'api', 'demo_only', 'synthetic'
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'unsupported data purpose' THEN
      RAISE;
    END IF;
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'malformed context was accepted';
  END IF;
END;
$malformed_context$;
SELECT CASE WHEN
    ${requestContextClearedExpression()}
  THEN 'cleared' ELSE 'leaked' END;
ROLLBACK;
RESET SESSION AUTHORIZATION;`;
}

function requestContextClearedExpression(): string {
  const settings = [
    "principal_id",
    "organization_id",
    "purpose",
    "channel",
    "territory",
    "data_classification",
  ];
  const cleared = settings
    .map(
      (setting) =>
        `coalesce(nullif(pg_catalog.current_setting('app.${setting}', true), ''), '<null>') = '<null>'`,
    )
    .join(" AND\n    ");
  return cleared;
}

export function renderAlternatingPreparedStatementSql(
  mode: RuntimeAuthorizationMatrixMode,
): string {
  const localRole =
    mode === "authenticated"
      ? `SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE};\n`
      : "";
  const prepare = `PREPARE tenant_visibility AS
SELECT pg_catalog.json_build_object(
  'organization', (SELECT id FROM private_data.organizations),
  'theses', (SELECT count(*) FROM private_data.theses)
)::text;`;
  const executeFor = (principal: string, organization: string) => `BEGIN;
${localRole}CALL private_data.set_request_context(
  '${principal}', '${organization}',
  'display', 'api', 'demo_only', 'synthetic'
);
EXECUTE tenant_visibility;
COMMIT;`;
  const executions = [
    executeFor(PRINCIPAL_ALPHA, ORGANIZATION_ALPHA),
    executeFor(PRINCIPAL_BETA, ORGANIZATION_BETA),
    executeFor(PRINCIPAL_ALPHA, ORGANIZATION_ALPHA),
    executeFor(PRINCIPAL_BETA, ORGANIZATION_BETA),
  ].join("\n");
  const matrix = `${executions}
DEALLOCATE tenant_visibility;`;
  // PREPARE is session-scoped, so authenticated preparation and all four
  // executions intentionally remain in this one client/backend script.
  return mode === "authenticated"
    ? `BEGIN;
${localRole.trimEnd()}
${prepare}
COMMIT;
${matrix}`
    : `SET SESSION AUTHORIZATION ${RUNTIME_AUTH_CAPABILITY_ROLE};
${prepare}
${matrix}
RESET SESSION AUTHORIZATION;`;
}

async function psqlScalar(
  containerId: string,
  sql: string,
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): Promise<string> {
  const result = await psql(containerId, sql, databaseName);
  return result.stdout.trim();
}

async function psqlMaintenanceScalar(
  containerId: string,
  sql: string,
): Promise<string> {
  const result = await psqlMaintenance(containerId, sql);
  return result.stdout.trim();
}

async function psqlMaintenance(
  containerId: string,
  sql: string,
): Promise<CommandResult> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      "--dbname=postgres",
    ],
    sql,
  );
  assertSuccess(result, "execute reviewed PostgreSQL maintenance SQL");
  return result;
}

async function psql(
  containerId: string,
  sql: string,
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): Promise<CommandResult> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      `--dbname=${databaseName}`,
    ],
    sql,
  );
  assertSuccess(result, "execute reviewed PostgreSQL acceptance SQL");
  return result;
}

async function expectPsqlFailure(
  containerId: string,
  sql: string,
  expectation: PsqlFailureExpectation,
  databaseName: string = CLEAN_BOOTSTRAP_DATABASE_NAME,
): Promise<void> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      "--set=VERBOSITY=verbose",
      "--username=postgres",
      `--dbname=${databaseName}`,
    ],
    sql,
  );
  assertExpectedPsqlFailure(result, expectation);
}

export function assertExpectedPsqlFailure(
  result: CommandResult,
  expectation: PsqlFailureExpectation,
): void {
  if (result.exitCode === 0) {
    throw new Error(`${expectation.label} unexpectedly succeeded`);
  }
  if (!result.stderr.includes(expectation.sqlState)) {
    throw new Error(
      `${expectation.label} failed with the wrong SQLSTATE: ${result.stderr.trim()}`,
    );
  }
  if (
    !result.stderr.toLowerCase().includes(expectation.message.toLowerCase())
  ) {
    throw new Error(
      `${expectation.label} failed for the wrong reason: ${result.stderr.trim()}`,
    );
  }
}

async function dockerExec(
  containerId: string,
  command: readonly string[],
  input?: string,
): Promise<CommandResult> {
  return executeDocker(
    ["exec", ...(input === undefined ? [] : ["-i"]), containerId, ...command],
    input,
  );
}

async function dockerExecWithEnvironment(
  containerId: string,
  environment: Readonly<Record<string, string>>,
  command: readonly string[],
  input?: string,
): Promise<CommandResult> {
  const environmentArguments = Object.entries(environment).flatMap(
    ([name, value]) => ["--env", `${name}=${value}`],
  );
  return executeDocker(
    [
      "exec",
      ...(input === undefined ? [] : ["-i"]),
      ...environmentArguments,
      containerId,
      ...command,
    ],
    input,
  );
}

async function executeDocker(
  arguments_: readonly string[],
  input?: string,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", arguments_, {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({
        exitCode: code ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    child.stdin.end(input);
  });
}

async function executeGit(
  arguments_: readonly string[],
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", arguments_, {
      cwd: repositoryRoot,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({
        exitCode: code ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function parseImageConfig(value: unknown): AcceptanceImageConfig {
  if (!isRecord(value))
    throw new Error("PostgreSQL image config must be an object");
  const expectedKeys = [
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
  ];
  if (!sameStrings(Object.keys(value).sort(), expectedKeys.sort())) {
    throw new Error(
      "PostgreSQL image config contains missing or unexpected fields",
    );
  }
  if (!isRecord(value.runner)) {
    throw new Error("PostgreSQL image runner config must be an object");
  }
  if (
    value.schemaVersion !== 1 ||
    value.repository !== "docker.io/library/postgres" ||
    value.tag !== "17.11-bookworm" ||
    value.indexDigest !==
      "sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad" ||
    value.reference !== EXPECTED_IMAGE_REFERENCE ||
    value.mediaType !== "application/vnd.oci.image.index.v1+json" ||
    value.expectedServerVersion !== EXPECTED_SERVER_VERSION ||
    value.expectedServerVersionNumber !== 170011 ||
    value.databaseName !== CLEAN_BOOTSTRAP_DATABASE_NAME ||
    value.workflowSha256 !==
      "73bc100eb27a1e7884d05f6feb642bc00c224d56e7b480899ba901cd9934f24a" ||
    value.fixtureSha256 !==
      "0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7" ||
    typeof value.verifiedOn !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.verifiedOn) ||
    value.runner.label !== "ubuntu-24.04" ||
    value.runner.os !== "linux" ||
    value.runner.architecture !== "amd64" ||
    !sameStrings(
      Object.keys(value.runner).sort(),
      ["label", "os", "architecture"].sort(),
    )
  ) {
    throw new Error("PostgreSQL image config does not match the reviewed pin");
  }
  return value as unknown as AcceptanceImageConfig;
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!isRecord(parsed)) throw new Error("Expected a PostgreSQL JSON object");
  return parsed;
}

function assertRuntimeAuthPassword(password: string): void {
  if (
    password.length !== 43 ||
    !BASE64URL_RUNTIME_AUTH_PASSWORD.test(password)
  ) {
    throw new Error(
      "Runtime-auth password must be a 32-byte base64url value without padding",
    );
  }
}

function assertTestLoaderAuthPassword(password: string): void {
  if (
    password.length !== 43 ||
    !BASE64URL_RUNTIME_AUTH_PASSWORD.test(password)
  ) {
    throw new Error(
      "Test-loader-auth password must be a 32-byte base64url value without padding",
    );
  }
}

function assertOwnerDdlAuthPassword(password: string): void {
  if (
    password.length !== 43 ||
    !BASE64URL_RUNTIME_AUTH_PASSWORD.test(password)
  ) {
    throw new Error(
      "Owner-DDL-auth password must be a 32-byte base64url value without padding",
    );
  }
}

function assertMigratorAuthPassword(password: string): void {
  const decoded = Buffer.from(password, "base64url");
  if (
    password.length !== 43 ||
    !BASE64URL_RUNTIME_AUTH_PASSWORD.test(password) ||
    decoded.length !== 32 ||
    decoded.toString("base64url") !== password
  ) {
    throw new Error(
      "Migrator-auth password must be a 32-byte base64url value without padding",
    );
  }
}

function assertMigrationDeployerAuthPassword(password: string): void {
  const decoded = Buffer.from(password, "base64url");
  if (
    password.length !== 43 ||
    !BASE64URL_RUNTIME_AUTH_PASSWORD.test(password) ||
    decoded.length !== 32 ||
    decoded.toString("base64url") !== password
  ) {
    throw new Error(
      "Migration deployer authentication password must be a 32-byte base64url value without padding",
    );
  }
}

function assertSuccess(result: CommandResult, operation: string): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `${operation} failed with exit ${result.exitCode}: ${result.stderr.trim()}`,
    );
  }
}

function assertEqual(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label} mismatch: expected ${expected}, received ${actual}`,
    );
  }
}

function assertJsonEqual(
  actual: unknown,
  expected: unknown,
  label: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

function requireText(
  value: string,
  marker: string,
  message: string,
  violations: string[],
): void {
  if (!value.includes(marker)) violations.push(message);
}

function inspectProjectionAdapterWorkflow(workflow: string): string[] {
  const violations: string[] = [];
  const lines = workflow.replaceAll("\r\n", "\n").split("\n");
  const portsIndexes = lines
    .map((line, index) => (/^\s*ports:\s*$/.test(line) ? index : -1))
    .filter((index) => index >= 0);
  if (portsIndexes.length !== 1) {
    violations.push(
      "PostgreSQL service must declare exactly one B9 adapter port block",
    );
  } else {
    const portsIndex = portsIndexes[0];
    if (portsIndex === undefined) {
      violations.push("PostgreSQL service port block is unavailable");
    } else {
      const mappings: string[] = [];
      for (let index = portsIndex + 1; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (/^ {8}\S/.test(line)) break;
        if (/^ {10}- /.test(line)) mappings.push(line);
      }
      if (
        mappings.length !== 1 ||
        mappings[0] !== '          - "127.0.0.1::5432"'
      ) {
        violations.push(
          "PostgreSQL service must publish only one random loopback mapping for target 5432",
        );
      }
    }
  }

  const ipv4Literals = [
    ...workflow.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g),
  ].map((match) => match[0]);
  if (
    ipv4Literals.length !== 2 ||
    ipv4Literals.some((literal) => literal !== "127.0.0.1")
  ) {
    violations.push(
      "workflow must contain only the two reviewed IPv4 loopback host literals",
    );
  }

  for (const [pattern, message] of [
    [
      /^\s*expose\s*:/im,
      "PostgreSQL service must not declare an alternate expose block",
    ],
    [
      /^\s*(?:host|hostname|network|network_mode|extra_hosts)\s*:/im,
      "workflow must not declare alternate host or network plumbing",
    ],
    [
      /(?:^|\s)--(?:add-host|network|publish|publish-all)(?:[=\s]|$)/im,
      "workflow must not declare alternate Docker host or port plumbing",
    ],
    [
      /^\s+(?!(?:RESEARCH_COCKPIT_PG_ADAPTER_HOST|RESEARCH_COCKPIT_PG_ADAPTER_PORT)\s*:)[A-Z][A-Z0-9_]*(?:_HOST|_HOSTNAME|_PORT|_URL)\s*:/m,
      "workflow must not declare an alternate host, port, or URL environment variable",
    ],
    [
      /\b(?:PGHOST|PGPORT)\s*:/i,
      "workflow must not declare PostgreSQL implicit host environment variables",
    ],
    [
      /(?:postgres|postgresql):\/\//i,
      "workflow must not declare a PostgreSQL connection URL",
    ],
    [
      /(?:host\.docker\.internal|\[?::1\]?)/i,
      "workflow must not use an alternate loopback host spelling",
    ],
  ] as const) {
    if (pattern.test(workflow)) violations.push(message);
  }

  const acceptanceSteps = workflowStepBlocks(workflow).filter((step) =>
    step.includes("      - name: Run PostgreSQL acceptance"),
  );
  if (acceptanceSteps.length !== 1) {
    violations.push(
      "workflow must define exactly one acceptance execution step",
    );
    return violations;
  }
  const acceptanceStep = acceptanceSteps[0] ?? "";
  for (const [line, message] of [
    [
      "          RESEARCH_COCKPIT_PG_CONTAINER_ID: ${{ job.services.postgres.id }}",
      "acceptance step must receive the exact service container ID",
    ],
    [
      "          RESEARCH_COCKPIT_PG_ADAPTER_HOST: 127.0.0.1",
      "acceptance step must receive only the exact loopback adapter host",
    ],
    [
      "          RESEARCH_COCKPIT_PG_ADAPTER_PORT: ${{ job.services.postgres.ports[5432] }}",
      "acceptance step must receive only the dynamic target-5432 adapter port",
    ],
  ] as const) {
    if (!acceptanceStep.split("\n").includes(line)) violations.push(message);
  }
  for (const key of [
    "RESEARCH_COCKPIT_PG_CONTAINER_ID",
    "RESEARCH_COCKPIT_PG_ADAPTER_HOST",
    "RESEARCH_COCKPIT_PG_ADAPTER_PORT",
  ] as const) {
    if ([...workflow.matchAll(new RegExp(`${key}:`, "g"))].length !== 1) {
      violations.push(`workflow must declare ${key} exactly once`);
    }
  }
  return violations;
}

function inspectEvidenceUploadStep(workflow: string): string[] {
  const violations: string[] = [];
  const uploadSteps = workflowStepBlocks(workflow).filter((step) =>
    /^\s*uses:\s*actions\/upload-artifact(?:@|\s|$)/m.test(step),
  );
  if (uploadSteps.length !== 1) {
    violations.push(
      "workflow must define exactly one PostgreSQL evidence upload step",
    );
    return violations;
  }

  const uploadStep = uploadSteps[0];
  if (!uploadStep) return violations;
  for (const [line, message] of [
    [
      "      - name: Upload PostgreSQL acceptance evidence",
      "evidence upload step must retain its reviewed identity",
    ],
    [
      "        if: ${{ success() }}",
      "evidence upload must run only after successful acceptance",
    ],
    [
      `        uses: ${EXPECTED_UPLOAD_ARTIFACT_ACTION} # v7.0.1`,
      "evidence upload action must use the reviewed immutable SHA",
    ],
    [
      `          name: ${EXPECTED_EVIDENCE_ARTIFACT_NAME}`,
      "evidence artifact name must include the commit SHA and run attempt",
    ],
    [
      `          path: ${EXPECTED_EVIDENCE_ARTIFACT_PATH}`,
      "evidence upload path must be the exact runner-temporary evidence file",
    ],
    [
      "          if-no-files-found: error",
      "evidence upload must fail when the evidence file is missing",
    ],
    [
      "          retention-days: 30",
      "evidence artifact retention must be exactly 30 days",
    ],
  ] as const) {
    if (!uploadStep.split("\n").includes(line)) violations.push(message);
  }
  if (/^\s*continue-on-error\s*:/m.test(uploadStep)) {
    violations.push("evidence upload must not continue on error");
  }
  return violations;
}

function workflowStepBlocks(workflow: string): string[] {
  const lines = workflow.replaceAll("\r\n", "\n").split("\n");
  const steps: string[] = [];
  let step: string[] | undefined;
  for (const line of lines) {
    if (/^ {6}- /.test(line)) {
      if (step) steps.push(step.join("\n"));
      step = [line];
    } else if (step) {
      step.push(line);
    }
  }
  if (step) steps.push(step.join("\n"));
  return steps;
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedSha256(value: string): string {
  return createHash("sha256")
    .update(value.replaceAll("\r\n", "\n"))
    .digest("hex");
}

function inspectInsertOnlyFixture(sql: string): string[] {
  const violations: string[] = [];
  const visible = maskSqlQuotedContent(sql);
  if (visible.includes("\\")) {
    violations.push("synthetic fixture must not contain psql meta-commands");
  }
  const statements = visible
    .split(";")
    .map((statement) => statement.trim().replace(/\s+/g, " "))
    .filter((statement) => statement.length > 0);
  if (
    statements[0] !== "SET SESSION AUTHORIZATION research_cockpit_test_seed"
  ) {
    violations.push(
      "synthetic fixture must assume test-seed authorization first",
    );
  }
  if (statements[1] !== "BEGIN") {
    violations.push(
      "synthetic fixture must open exactly one transaction second",
    );
  }
  if (statements.at(-2) !== "COMMIT") {
    violations.push("synthetic fixture must commit after its final insert");
  }
  if (statements.at(-1) !== "RESET SESSION AUTHORIZATION") {
    violations.push("synthetic fixture must reset authorization last");
  }

  const allowedTables = [
    "private_data.organizations",
    "private_data.principals",
    "private_data.organization_principals",
    "private_data.memberships",
    "private_data.entitlements",
    "shared_data.rights_policies",
    "shared_data.rights_grants",
    "shared_data.issuers",
    "shared_data.securities",
    "shared_data.share_classes",
    "shared_data.exchanges",
    "shared_data.listings",
    "shared_data.symbol_history",
    "shared_data.evidence",
    "shared_data.financial_facts",
    "shared_data.metric_definitions",
    "private_data.resource_id_registry",
    "private_data.theses",
    "private_data.alert_rules",
    "private_data.idempotency_records",
    "private_data.audit_events",
  ] as const;
  const inserts = statements.slice(2, -2);
  const actualTables: string[] = [];
  for (const statement of inserts) {
    const table = /^INSERT INTO ([a-z_]+\.[a-z_]+) \(/i.exec(statement)?.[1];
    if (!table) {
      violations.push(
        "synthetic fixture may contain only direct INSERT statements",
      );
      continue;
    }
    actualTables.push(table.toLowerCase());
  }
  if (!sameStrings(actualTables, allowedTables)) {
    violations.push(
      "synthetic fixture table order must match the reviewed allowlist",
    );
  }
  return violations;
}
