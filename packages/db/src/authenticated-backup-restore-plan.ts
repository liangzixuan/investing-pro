import { createHash, randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLEAN_BOOTSTRAP_DATABASE_NAME,
  inspectEmbeddedSqlControls,
  maskSqlQuotedContent,
} from "./clean-bootstrap";
import { detectProhibitedSql } from "./check-migrations";
import {
  AUTHENTICATED_MIGRATION_RESTORE_DATABASE_NAME,
  renderAuthenticatedApplicationMigration,
  type AuthenticatedMigrationPlan,
} from "./authenticated-migration-plan";

export const AUTHENTICATED_BACKUP_RESTORE_PLAN_VERSION = 1 as const;
export const AUTHENTICATED_BACKUP_RESTORE_PLAN_RELATIVE_DIRECTORY =
  "backup-restore-plans/v1" as const;
export const AUTHENTICATED_BACKUP_RESTORE_PLATFORM_FILE =
  "restore-platform.sql" as const;
export const AUTHENTICATED_BACKUP_RESTORE_PLATFORM_SHA256 =
  "78b566cc1321956f4660619b628ce586fabfa4f22a85c0dfb1c5df7e1456e5ae" as const;

export const AUTHENTICATED_BACKUP_SOURCE_DATABASE =
  CLEAN_BOOTSTRAP_DATABASE_NAME;
export const AUTHENTICATED_RESTORE_DATABASE =
  AUTHENTICATED_MIGRATION_RESTORE_DATABASE_NAME;
export const AUTHENTICATED_BACKUP_LOGIN_ROLE =
  "research_cockpit_backup_login" as const;
export const AUTHENTICATED_BACKUP_CAPABILITY_ROLE =
  "research_cockpit_backup" as const;
export const AUTHENTICATED_RESTORE_LOGIN_ROLE =
  "research_cockpit_restore_login" as const;
export const AUTHENTICATED_RESTORE_CAPABILITY_ROLE =
  "research_cockpit_test_seed" as const;

export const AUTHENTICATED_BACKUP_PASSFILE =
  "/tmp/research-cockpit-backup-login.pgpass" as const;
export const AUTHENTICATED_BACKUP_WRONG_PASSFILE =
  "/tmp/research-cockpit-backup-login-wrong.pgpass" as const;
export const AUTHENTICATED_RESTORE_PASSFILE =
  "/tmp/research-cockpit-restore-login.pgpass" as const;
export const AUTHENTICATED_RESTORE_WRONG_PASSFILE =
  "/tmp/research-cockpit-restore-login-wrong.pgpass" as const;
export const AUTHENTICATED_BACKUP_ARCHIVE =
  "/tmp/research-cockpit-authenticated-backup-v1.dump" as const;
export const AUTHENTICATED_BACKUP_NO_ROLE_ARCHIVE =
  "/tmp/research-cockpit-authenticated-backup-no-role-v1.dump" as const;
export const AUTHENTICATED_BACKUP_NO_RLS_ARCHIVE =
  "/tmp/research-cockpit-authenticated-backup-no-rls-v1.dump" as const;
export const AUTHENTICATED_BACKUP_WRONG_PASSWORD_ARCHIVE =
  "/tmp/research-cockpit-authenticated-backup-wrong-password-v1.dump" as const;

export const AUTHENTICATED_RESTORE_FAILURE_FUNCTION =
  "private_data.b8_restore_failure" as const;
export const AUTHENTICATED_RESTORE_FAILURE_TRIGGER =
  "b8_restore_failure" as const;
export const AUTHENTICATED_RESTORE_FAILURE_TABLE =
  "private_data.audit_events" as const;
export const AUTHENTICATED_RESTORE_FAILURE_SQLSTATE = "P0001" as const;
export const AUTHENTICATED_RESTORE_FAILURE_MESSAGE =
  "injected B8 restore failure" as const;

export const AUTHENTICATED_BACKUP_RESTORABLE_TABLES = Object.freeze([
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
  "shared_data.securities",
  "shared_data.share_classes",
  "shared_data.symbol_history",
] as const);

const BACKUP_RESTORE_ADVISORY_LOCK = "818476709640328253";
const BASE64URL_PASSWORD = /^[A-Za-z0-9_-]+$/;
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const reviewedPlanRoot = join(
  packageRoot,
  "backup-restore-plans",
  `v${AUTHENTICATED_BACKUP_RESTORE_PLAN_VERSION}`,
);

export type AuthenticatedBackupPassfile =
  | typeof AUTHENTICATED_BACKUP_PASSFILE
  | typeof AUTHENTICATED_BACKUP_WRONG_PASSFILE;
export type AuthenticatedRestorePassfile =
  | typeof AUTHENTICATED_RESTORE_PASSFILE
  | typeof AUTHENTICATED_RESTORE_WRONG_PASSFILE;
export type AuthenticatedBackupArchive =
  | typeof AUTHENTICATED_BACKUP_ARCHIVE
  | typeof AUTHENTICATED_BACKUP_NO_ROLE_ARCHIVE
  | typeof AUTHENTICATED_BACKUP_NO_RLS_ARCHIVE
  | typeof AUTHENTICATED_BACKUP_WRONG_PASSWORD_ARCHIVE;

export interface AuthenticatedBackupRestorePlan {
  readonly restorePlatformSql: string;
}

export interface AuthenticatedBackupRestoreInvocation {
  readonly environment: Readonly<Record<string, string>>;
  readonly command: readonly string[];
}

export interface AuthenticatedBackupDumpOptions {
  readonly archive?: AuthenticatedBackupArchive;
  readonly passfile?: AuthenticatedBackupPassfile;
  readonly requireScram?: boolean;
  readonly selectCapabilityRole?: boolean;
  readonly enableRowSecurity?: boolean;
}

export interface AuthenticatedRestoreOptions {
  readonly passfile?: AuthenticatedRestorePassfile;
  readonly requireScram?: boolean;
  readonly selectCapabilityRole?: boolean;
  readonly enableRowSecurity?: boolean;
}

export interface AuthenticatedBackupPsqlOptions {
  readonly passfile?: AuthenticatedBackupPassfile;
  readonly requireScram?: boolean;
  readonly verboseErrors?: boolean;
}

export interface AuthenticatedRestorePsqlOptions {
  readonly passfile?: AuthenticatedRestorePassfile;
  readonly requireScram?: boolean;
  readonly verboseErrors?: boolean;
}

export interface AuthenticatedBackupRestoreCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface AuthenticatedBackupArchiveTocEntry {
  readonly schema: "private_data" | "shared_data";
  readonly table: string;
  readonly qualifiedTable: string;
}

export interface AuthenticatedBackupFingerprintQuery {
  readonly table: (typeof AUTHENTICATED_BACKUP_RESTORABLE_TABLES)[number];
  readonly sql: string;
}

export async function loadAuthenticatedBackupRestorePlan(
  root = reviewedPlanRoot,
): Promise<AuthenticatedBackupRestorePlan> {
  const entries = (await readdir(root, { withFileTypes: true }))
    .map((entry) =>
      entry.isFile()
        ? `file:${entry.name}`
        : entry.isDirectory()
          ? `directory:${entry.name}`
          : `unsupported:${entry.name}`,
    )
    .sort(compareText);
  if (
    !sameStrings(entries, [
      `file:${AUTHENTICATED_BACKUP_RESTORE_PLATFORM_FILE}`,
    ])
  ) {
    throw new Error(
      "Authenticated backup/restore plan contains missing or unexpected entries",
    );
  }

  const plan = Object.freeze({
    restorePlatformSql: await readFile(
      join(root, AUTHENTICATED_BACKUP_RESTORE_PLATFORM_FILE),
      "utf8",
    ),
  });
  validateAuthenticatedBackupRestorePlan(plan);
  return plan;
}

export function renderAuthenticatedRestorePlatform(
  plan: AuthenticatedBackupRestorePlan,
  injectFailure = false,
): string {
  assertBoolean(injectFailure, "restore-platform injectFailure");
  validateAuthenticatedBackupRestorePlan(plan);
  const statements = [
    "BEGIN;",
    `SELECT pg_catalog.pg_advisory_xact_lock(${BACKUP_RESTORE_ADVISORY_LOCK}::bigint);`,
    stripTransaction(plan.restorePlatformSql),
  ];
  if (injectFailure) statements.push(renderInjectedFailure());
  statements.push("COMMIT;", "");
  return statements.join("\n");
}

export async function renderReviewedAuthenticatedRestorePlatform(
  injectFailure = false,
  root = reviewedPlanRoot,
): Promise<string> {
  return renderAuthenticatedRestorePlatform(
    await loadAuthenticatedBackupRestorePlan(root),
    injectFailure,
  );
}

export function renderAuthenticatedRestoreApplicationMigration(
  plan: AuthenticatedMigrationPlan,
  injectFailure = false,
): string {
  return renderAuthenticatedApplicationMigration(
    plan,
    injectFailure,
    AUTHENTICATED_RESTORE_DATABASE,
  );
}

export function generateAuthenticatedBackupRestorePassword(): string {
  return randomBytes(32).toString("base64url");
}

export function renderAuthenticatedBackupProvisioningSql(
  password: string,
): string {
  return renderProvisioningSql(
    AUTHENTICATED_BACKUP_LOGIN_ROLE,
    AUTHENTICATED_BACKUP_CAPABILITY_ROLE,
    password,
  );
}

export function renderAuthenticatedRestoreProvisioningSql(
  password: string,
): string {
  return renderProvisioningSql(
    AUTHENTICATED_RESTORE_LOGIN_ROLE,
    AUTHENTICATED_RESTORE_CAPABILITY_ROLE,
    password,
  );
}

export function renderAuthenticatedBackupPassfile(password: string): string {
  assertPassword(password);
  return `127.0.0.1:5432:${AUTHENTICATED_BACKUP_SOURCE_DATABASE}:${AUTHENTICATED_BACKUP_LOGIN_ROLE}:${password}\n`;
}

export function renderAuthenticatedRestorePassfile(password: string): string {
  assertPassword(password);
  return `127.0.0.1:5432:${AUTHENTICATED_RESTORE_DATABASE}:${AUTHENTICATED_RESTORE_LOGIN_ROLE}:${password}\n`;
}

export function renderAuthenticatedBackupCleanupSql(): string {
  return renderCleanupSql(AUTHENTICATED_BACKUP_LOGIN_ROLE);
}

export function renderAuthenticatedRestoreCleanupSql(): string {
  return renderCleanupSql(AUTHENTICATED_RESTORE_LOGIN_ROLE);
}

export function renderAuthenticatedBackupBackendDrainSql(): string {
  return renderBackendDrainSql(AUTHENTICATED_BACKUP_LOGIN_ROLE, "backup");
}

export function renderAuthenticatedRestoreBackendDrainSql(): string {
  return renderBackendDrainSql(AUTHENTICATED_RESTORE_LOGIN_ROLE, "restore");
}

export function buildAuthenticatedBackupPsqlInvocation(
  options: AuthenticatedBackupPsqlOptions = {},
): AuthenticatedBackupRestoreInvocation {
  const {
    passfile = AUTHENTICATED_BACKUP_PASSFILE,
    requireScram = true,
    verboseErrors = false,
  } = options;
  assertBackupPassfile(passfile);
  assertBoolean(requireScram, "backup psql requireScram");
  assertBoolean(verboseErrors, "backup psql verboseErrors");
  return buildAuthenticatedPsqlInvocation({
    passfile,
    requireScram,
    verboseErrors,
    loginRole: AUTHENTICATED_BACKUP_LOGIN_ROLE,
    databaseName: AUTHENTICATED_BACKUP_SOURCE_DATABASE,
  });
}

export function buildAuthenticatedRestorePsqlInvocation(
  options: AuthenticatedRestorePsqlOptions = {},
): AuthenticatedBackupRestoreInvocation {
  const {
    passfile = AUTHENTICATED_RESTORE_PASSFILE,
    requireScram = true,
    verboseErrors = false,
  } = options;
  assertRestorePassfile(passfile);
  assertBoolean(requireScram, "restore psql requireScram");
  assertBoolean(verboseErrors, "restore psql verboseErrors");
  return buildAuthenticatedPsqlInvocation({
    passfile,
    requireScram,
    verboseErrors,
    loginRole: AUTHENTICATED_RESTORE_LOGIN_ROLE,
    databaseName: AUTHENTICATED_RESTORE_DATABASE,
  });
}

export function assertAuthenticatedBackupWrongPasswordRejection(
  result: AuthenticatedBackupRestoreCommandResult,
): void {
  assertWrongPasswordPsqlRejection(
    result,
    AUTHENTICATED_BACKUP_LOGIN_ROLE,
    "backup",
  );
}

export function assertAuthenticatedRestoreWrongPasswordRejection(
  result: AuthenticatedBackupRestoreCommandResult,
): void {
  assertWrongPasswordPsqlRejection(
    result,
    AUTHENTICATED_RESTORE_LOGIN_ROLE,
    "restore",
  );
}

export function buildAuthenticatedBackupDumpInvocation(
  options: AuthenticatedBackupDumpOptions = {},
): AuthenticatedBackupRestoreInvocation {
  const {
    archive = AUTHENTICATED_BACKUP_ARCHIVE,
    passfile = AUTHENTICATED_BACKUP_PASSFILE,
    requireScram = true,
    selectCapabilityRole = true,
    enableRowSecurity = true,
  } = options;
  assertBackupArchive(archive);
  assertBackupPassfile(passfile);
  assertBoolean(requireScram, "backup requireScram");
  assertBoolean(selectCapabilityRole, "backup selectCapabilityRole");
  assertBoolean(enableRowSecurity, "backup enableRowSecurity");

  return freezeInvocation({
    environment: authenticatedEnvironment(passfile, requireScram),
    command: [
      "pg_dump",
      "--no-password",
      "--host=127.0.0.1",
      "--port=5432",
      `--username=${AUTHENTICATED_BACKUP_LOGIN_ROLE}`,
      `--dbname=${AUTHENTICATED_BACKUP_SOURCE_DATABASE}`,
      ...(selectCapabilityRole
        ? [`--role=${AUTHENTICATED_BACKUP_CAPABILITY_ROLE}`]
        : []),
      "--format=custom",
      `--file=${archive}`,
      "--data-only",
      "--column-inserts",
      ...(enableRowSecurity ? ["--enable-row-security"] : []),
      "--schema=private_data",
      "--schema=shared_data",
      "--exclude-table-data=shared_data.schema_migrations",
      "--no-large-objects",
      "--no-owner",
      "--no-privileges",
      "--no-comments",
      "--no-publications",
      "--no-security-labels",
      "--no-subscriptions",
      "--no-tablespaces",
      "--strict-names",
      "--lock-wait-timeout=5000",
    ],
  });
}

export function buildAuthenticatedRestoreInvocation(
  options: AuthenticatedRestoreOptions = {},
): AuthenticatedBackupRestoreInvocation {
  const {
    passfile = AUTHENTICATED_RESTORE_PASSFILE,
    requireScram = true,
    selectCapabilityRole = true,
    enableRowSecurity = true,
  } = options;
  assertRestorePassfile(passfile);
  assertBoolean(requireScram, "restore requireScram");
  assertBoolean(selectCapabilityRole, "restore selectCapabilityRole");
  assertBoolean(enableRowSecurity, "restore enableRowSecurity");

  return freezeInvocation({
    environment: authenticatedEnvironment(passfile, requireScram),
    command: [
      "pg_restore",
      "--no-password",
      "--host=127.0.0.1",
      "--port=5432",
      `--username=${AUTHENTICATED_RESTORE_LOGIN_ROLE}`,
      `--dbname=${AUTHENTICATED_RESTORE_DATABASE}`,
      ...(selectCapabilityRole
        ? [`--role=${AUTHENTICATED_RESTORE_CAPABILITY_ROLE}`]
        : []),
      "--data-only",
      ...(enableRowSecurity ? ["--enable-row-security"] : []),
      "--single-transaction",
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      AUTHENTICATED_BACKUP_ARCHIVE,
    ],
  });
}

export function renderCreateAuthenticatedRestoreDatabaseSql(): string {
  return `DO $restore_database_create_preflight$
BEGIN
  IF pg_catalog.current_database() <> 'postgres'
    OR session_user <> current_user
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = current_user AND rolsuper
    )
  THEN
    RAISE EXCEPTION
      'restore database creation requires the maintenance superuser identity';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_database
    WHERE datname = '${AUTHENTICATED_BACKUP_SOURCE_DATABASE}'
  ) THEN
    RAISE EXCEPTION 'authenticated backup source database is absent';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_database
    WHERE datname = '${AUTHENTICATED_RESTORE_DATABASE}'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'bounded restore target must be absent before creation';
  END IF;
END;
$restore_database_create_preflight$;
CREATE DATABASE ${AUTHENTICATED_RESTORE_DATABASE}
  OWNER postgres
  TEMPLATE template0
  ENCODING 'UTF8';
`;
}

export function renderDropAuthenticatedRestoreDatabaseSql(): string {
  return `DO $restore_database_drop_preflight$
BEGIN
  IF pg_catalog.current_database() <> 'postgres'
    OR session_user <> current_user
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = current_user AND rolsuper
    )
  THEN
    RAISE EXCEPTION
      'restore database cleanup requires the maintenance superuser identity';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_database
    WHERE datname = '${AUTHENTICATED_RESTORE_DATABASE}'
  ) THEN
    RAISE EXCEPTION 'bounded restore target is absent during cleanup';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_stat_activity
    WHERE datname = '${AUTHENTICATED_RESTORE_DATABASE}'
  ) THEN
    RAISE EXCEPTION 'bounded restore target has active backends';
  END IF;
END;
$restore_database_drop_preflight$;
DROP DATABASE ${AUTHENTICATED_RESTORE_DATABASE};
`;
}

export function renderAuthenticatedRestoreFailureCreateSql(): string {
  return `BEGIN;
SET LOCAL ROLE research_cockpit_owner;
CREATE FUNCTION ${AUTHENTICATED_RESTORE_FAILURE_FUNCTION}()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '${AUTHENTICATED_RESTORE_FAILURE_SQLSTATE}',
    MESSAGE = '${AUTHENTICATED_RESTORE_FAILURE_MESSAGE}';
END;
$function$;
REVOKE ALL ON FUNCTION ${AUTHENTICATED_RESTORE_FAILURE_FUNCTION}() FROM PUBLIC;
CREATE TRIGGER ${AUTHENTICATED_RESTORE_FAILURE_TRIGGER}
  BEFORE INSERT ON ${AUTHENTICATED_RESTORE_FAILURE_TABLE}
  FOR EACH ROW
  EXECUTE FUNCTION ${AUTHENTICATED_RESTORE_FAILURE_FUNCTION}();
COMMIT;
`;
}

export function renderAuthenticatedRestoreFailureCleanupSql(): string {
  return `BEGIN;
SET LOCAL ROLE research_cockpit_owner;
DROP TRIGGER ${AUTHENTICATED_RESTORE_FAILURE_TRIGGER}
  ON ${AUTHENTICATED_RESTORE_FAILURE_TABLE};
DROP FUNCTION ${AUTHENTICATED_RESTORE_FAILURE_FUNCTION}();
COMMIT;
`;
}

export function renderAuthenticatedRestoreFailureResidueSql(): string {
  return `SELECT (
  SELECT count(*)
  FROM pg_catalog.pg_trigger AS trigger
  JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'private_data'
    AND class.relname = 'audit_events'
    AND trigger.tgname = '${AUTHENTICATED_RESTORE_FAILURE_TRIGGER}'
    AND NOT trigger.tgisinternal
) || '|' || (
  SELECT count(*)
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'private_data'
    AND procedure.proname = 'b8_restore_failure'
);`;
}

export function parseAuthenticatedBackupArchiveToc(
  value: string,
): readonly AuthenticatedBackupArchiveTocEntry[] {
  if (typeof value !== "string") {
    throw new Error("Authenticated backup archive TOC must be text");
  }
  const entries: AuthenticatedBackupArchiveTocEntry[] = [];
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith(";")) continue;
    const match =
      /^\d+;\s+\d+\s+\d+\s+TABLE DATA\s+(private_data|shared_data)\s+([a-z][a-z0-9_]*)\s+research_cockpit_owner$/.exec(
        line,
      );
    if (!match?.[1] || !match[2]) {
      throw new Error(
        "Authenticated backup archive TOC contains an unreviewed entry",
      );
    }
    const schema = match[1] as "private_data" | "shared_data";
    const table = match[2];
    entries.push(
      Object.freeze({
        schema,
        table,
        qualifiedTable: `${schema}.${table}`,
      }),
    );
  }

  const qualifiedTables = entries.map(({ qualifiedTable }) => qualifiedTable);
  if (
    new Set(qualifiedTables).size !== qualifiedTables.length ||
    !sameStrings(
      [...qualifiedTables].sort(compareText),
      [...AUTHENTICATED_BACKUP_RESTORABLE_TABLES].sort(compareText),
    )
  ) {
    throw new Error(
      "Authenticated backup archive TOC does not exactly match the restorable table inventory",
    );
  }
  return Object.freeze(entries);
}

export function renderAuthenticatedBackupFingerprintQueries(): readonly AuthenticatedBackupFingerprintQuery[] {
  return Object.freeze(
    AUTHENTICATED_BACKUP_RESTORABLE_TABLES.map((table) =>
      Object.freeze({
        table,
        sql: `BEGIN;
SET LOCAL ROLE ${AUTHENTICATED_BACKUP_CAPABILITY_ROLE};
SET LOCAL TIME ZONE 'UTC';
SELECT pg_catalog.jsonb_build_object(
  'table', '${table}',
  'rows', coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(source_row)
      ORDER BY pg_catalog.to_jsonb(source_row)::text
    ),
    '[]'::jsonb
  )
)::text
FROM ${table} AS source_row;
COMMIT;`,
      }),
    ),
  );
}

export function renderRestorableApplicationTablesEmptySql(): string {
  return `SELECT count(*)
FROM (
${AUTHENTICATED_BACKUP_RESTORABLE_TABLES.map(
  (table) => `  SELECT 1 FROM ${table}`,
).join("\n  UNION ALL\n")}
) AS restored_row;`;
}

function validateAuthenticatedBackupRestorePlan(
  plan: AuthenticatedBackupRestorePlan,
): void {
  if (
    typeof plan !== "object" ||
    plan === null ||
    Array.isArray(plan) ||
    !sameStrings(Object.keys(plan), ["restorePlatformSql"]) ||
    typeof plan.restorePlatformSql !== "string"
  ) {
    throw new Error("Authenticated backup/restore plan is malformed");
  }
  if (
    sha256(plan.restorePlatformSql) !==
    AUTHENTICATED_BACKUP_RESTORE_PLATFORM_SHA256
  ) {
    throw new Error(
      "Authenticated restore platform checksum differs from the reviewed source",
    );
  }

  const wrapper = /^BEGIN;\r?\n([\s\S]*)\r?\nCOMMIT;(?:\r?\n)?$/.exec(
    plan.restorePlatformSql,
  );
  if (
    !wrapper?.[1] ||
    (plan.restorePlatformSql.match(/^BEGIN;$/gm)?.length ?? 0) !== 1 ||
    (plan.restorePlatformSql.match(/^COMMIT;$/gm)?.length ?? 0) !== 1
  ) {
    throw new Error(
      "Authenticated restore platform needs exactly one BEGIN/COMMIT wrapper",
    );
  }
  const controls = inspectEmbeddedSqlControls(wrapper[1]);
  if (controls.length > 0) {
    throw new Error(
      `Authenticated restore platform contains an embedded transaction or psql control: ${controls.join(", ")}`,
    );
  }
  const prohibited = detectProhibitedSql(plan.restorePlatformSql);
  if (prohibited.length > 0) {
    throw new Error(
      `Authenticated restore platform contains prohibited SQL: ${prohibited.join(", ")}`,
    );
  }

  const visible = maskSqlQuotedContent(wrapper[1]);
  for (const pattern of [
    /\b(?:CREATE|ALTER|DROP)\s+ROLE\b/i,
    /\b(?:GRANT|REVOKE)\s+(?![^;]*\bON\b)[^;]+\b(?:TO|FROM)\b/i,
    /\bCREATE\s+(?:TABLE|FUNCTION|PROCEDURE|POLICY|TRIGGER|INDEX)\b/i,
    /\bALTER\s+(?:TABLE|FUNCTION|PROCEDURE)\b/i,
    /\bDROP\s+(?:DATABASE|SCHEMA|EXTENSION|TABLE|FUNCTION|PROCEDURE)\b/i,
    /\bSET\s+(?:LOCAL\s+)?ROLE\b/i,
    /\bSET\s+SESSION\s+AUTHORIZATION\b/i,
    /\bCOPY\b/i,
  ]) {
    if (pattern.test(visible)) {
      throw new Error(
        "Authenticated restore platform crosses its reviewed platform boundary",
      );
    }
  }
  for (const required of [
    /research_cockpit_acceptance_restore_test/i,
    /restore platform bootstrap requires the authenticated superuser identity/i,
    /restore platform bootstrap requires the exact capability roles/i,
    /restore platform bootstrap requires zero capability-role memberships/i,
    /restore platform bootstrap requires zero capability-role settings/i,
    /FROM\s+pg_catalog\.pg_authid/i,
    /CREATE\s+SCHEMA\s+shared_data\s*;/i,
    /CREATE\s+SCHEMA\s+private_data\s*;/i,
    /ALTER\s+SCHEMA\s+shared_data\s+OWNER\s+TO\s+research_cockpit_owner\s*;/i,
    /ALTER\s+SCHEMA\s+private_data\s+OWNER\s+TO\s+research_cockpit_owner\s*;/i,
    /REVOKE\s+ALL\s+ON\s+SCHEMA\s+public\s+FROM\s+PUBLIC\s*;/i,
    /CREATE\s+EXTENSION\s+btree_gist\s+WITH\s+SCHEMA\s+shared_data\s*;/i,
    /REVOKE\s+ALL\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+shared_data\s+FROM\s+PUBLIC\s*;/i,
    /REVOKE\s+CREATE\s*,\s*TEMPORARY\s+ON\s+DATABASE\s+%I\s+FROM\s+PUBLIC/i,
  ]) {
    if (!required.test(plan.restorePlatformSql)) {
      throw new Error(
        "Authenticated restore platform is missing a required boundary",
      );
    }
  }
}

function renderProvisioningSql(
  loginRole:
    | typeof AUTHENTICATED_BACKUP_LOGIN_ROLE
    | typeof AUTHENTICATED_RESTORE_LOGIN_ROLE,
  capabilityRole:
    | typeof AUTHENTICATED_BACKUP_CAPABILITY_ROLE
    | typeof AUTHENTICATED_RESTORE_CAPABILITY_ROLE,
  password: string,
): string {
  assertPassword(password);
  return `BEGIN;
SET LOCAL log_statement = 'none';
SET LOCAL log_min_error_statement = 'panic';
SET LOCAL log_duration = off;
SET LOCAL log_min_duration_statement = -1;
SET LOCAL log_min_duration_sample = -1;
SET LOCAL log_statement_sample_rate = 0;
SET LOCAL log_transaction_sample_rate = 0;
SET LOCAL password_encryption = 'scram-sha-256';
CREATE ROLE ${loginRole}
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOINHERIT
  NOBYPASSRLS
  CONNECTION LIMIT 1
  PASSWORD '${password}';
GRANT ${capabilityRole}
  TO ${loginRole}
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
COMMIT;
`;
}

function renderCleanupSql(
  loginRole:
    | typeof AUTHENTICATED_BACKUP_LOGIN_ROLE
    | typeof AUTHENTICATED_RESTORE_LOGIN_ROLE,
): string {
  return `BEGIN;
DROP ROLE IF EXISTS ${loginRole};
COMMIT;
`;
}

function renderBackendDrainSql(
  loginRole:
    | typeof AUTHENTICATED_BACKUP_LOGIN_ROLE
    | typeof AUTHENTICATED_RESTORE_LOGIN_ROLE,
  label: "backup" | "restore",
): string {
  return `DO $authenticated_${label}_backend_drain$
DECLARE
  deadline timestamptz := pg_catalog.clock_timestamp() + interval '5 seconds';
BEGIN
  LOOP
    PERFORM pg_catalog.pg_stat_clear_snapshot();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_stat_activity
      WHERE usename = '${loginRole}'
        AND backend_type = 'client backend'
    );
    IF pg_catalog.clock_timestamp() >= deadline THEN
      RAISE EXCEPTION 'ephemeral ${label} login backend did not drain'
        USING ERRCODE = '55000';
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
END;
$authenticated_${label}_backend_drain$;
`;
}

function buildAuthenticatedPsqlInvocation(value: {
  readonly passfile: AuthenticatedBackupPassfile | AuthenticatedRestorePassfile;
  readonly requireScram: boolean;
  readonly verboseErrors: boolean;
  readonly loginRole:
    | typeof AUTHENTICATED_BACKUP_LOGIN_ROLE
    | typeof AUTHENTICATED_RESTORE_LOGIN_ROLE;
  readonly databaseName:
    | typeof AUTHENTICATED_BACKUP_SOURCE_DATABASE
    | typeof AUTHENTICATED_RESTORE_DATABASE;
}): AuthenticatedBackupRestoreInvocation {
  return freezeInvocation({
    environment: authenticatedEnvironment(value.passfile, value.requireScram),
    command: [
      "psql",
      "--no-psqlrc",
      "--no-password",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      ...(value.verboseErrors ? ["--set=VERBOSITY=verbose"] : []),
      "--host=127.0.0.1",
      "--port=5432",
      `--username=${value.loginRole}`,
      `--dbname=${value.databaseName}`,
    ],
  });
}

function assertWrongPasswordPsqlRejection(
  result: AuthenticatedBackupRestoreCommandResult,
  loginRole:
    | typeof AUTHENTICATED_BACKUP_LOGIN_ROLE
    | typeof AUTHENTICATED_RESTORE_LOGIN_ROLE,
  label: "backup" | "restore",
): void {
  if (result.exitCode === 0) {
    throw new Error(
      `Wrong-password ${label} authentication unexpectedly succeeded`,
    );
  }
  if (result.exitCode !== 2) {
    throw new Error(
      `Wrong-password ${label} authentication returned an unexpected exit code`,
    );
  }
  if (result.stdout.trim() !== "") {
    throw new Error(
      `Wrong-password ${label} authentication returned unexpected output`,
    );
  }
  const diagnostic = result.stderr.toLowerCase().replace(/\s+/g, " ");
  if (
    !diagnostic.includes(
      `fatal: password authentication failed for user "${loginRole}"`,
    )
  ) {
    throw new Error(
      `Wrong-password ${label} authentication did not return the expected rejection`,
    );
  }
}

function authenticatedEnvironment(
  passfile: AuthenticatedBackupPassfile | AuthenticatedRestorePassfile,
  requireScram: boolean,
): Readonly<Record<string, string>> {
  const environment: Record<string, string> = {
    PGPASSFILE: passfile,
    PGSSLMODE: "disable",
    PGCONNECT_TIMEOUT: "5",
  };
  if (requireScram) environment.PGREQUIREAUTH = "scram-sha-256";
  return Object.freeze(environment);
}

function freezeInvocation(value: {
  environment: Readonly<Record<string, string>>;
  command: readonly string[];
}): AuthenticatedBackupRestoreInvocation {
  return Object.freeze({
    environment: Object.freeze({ ...value.environment }),
    command: Object.freeze([...value.command]),
  });
}

function stripTransaction(sql: string): string {
  const wrapper = /^BEGIN;\r?\n([\s\S]*)\r?\nCOMMIT;(?:\r?\n)?$/.exec(sql);
  if (!wrapper?.[1]) {
    throw new Error("Authenticated restore platform wrapper is malformed");
  }
  return wrapper[1].trimEnd();
}

function renderInjectedFailure(): string {
  return `DO $restore_platform_injected_failure$
BEGIN
  PERFORM 1 / 0;
END;
$restore_platform_injected_failure$;`;
}

function assertPassword(password: string): void {
  const decoded = Buffer.from(password, "base64url");
  if (
    password.length !== 43 ||
    !BASE64URL_PASSWORD.test(password) ||
    decoded.length !== 32 ||
    decoded.toString("base64url") !== password
  ) {
    throw new Error(
      "Authenticated backup/restore password must be a 32-byte base64url value without padding",
    );
  }
}

function assertBackupArchive(
  value: string,
): asserts value is AuthenticatedBackupArchive {
  if (
    ![
      AUTHENTICATED_BACKUP_ARCHIVE,
      AUTHENTICATED_BACKUP_NO_ROLE_ARCHIVE,
      AUTHENTICATED_BACKUP_NO_RLS_ARCHIVE,
      AUTHENTICATED_BACKUP_WRONG_PASSWORD_ARCHIVE,
    ].includes(value as AuthenticatedBackupArchive)
  ) {
    throw new Error("Authenticated backup archive path is not reviewed");
  }
}

function assertBackupPassfile(
  value: string,
): asserts value is AuthenticatedBackupPassfile {
  if (
    value !== AUTHENTICATED_BACKUP_PASSFILE &&
    value !== AUTHENTICATED_BACKUP_WRONG_PASSFILE
  ) {
    throw new Error("Authenticated backup passfile path is not reviewed");
  }
}

function assertRestorePassfile(
  value: string,
): asserts value is AuthenticatedRestorePassfile {
  if (
    value !== AUTHENTICATED_RESTORE_PASSFILE &&
    value !== AUTHENTICATED_RESTORE_WRONG_PASSFILE
  ) {
    throw new Error("Authenticated restore passfile path is not reviewed");
  }
}

function assertBoolean(
  value: unknown,
  label: string,
): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be boolean`);
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
