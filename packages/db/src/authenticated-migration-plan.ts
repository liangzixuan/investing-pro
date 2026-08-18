import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLEAN_BOOTSTRAP_DATABASE_NAME,
  inspectEmbeddedSqlControls,
  maskSqlQuotedContent,
} from "./clean-bootstrap";
import { detectProhibitedSql } from "./check-migrations";

export const AUTHENTICATED_MIGRATION_PLAN_VERSION = 2 as const;
export const AUTHENTICATED_MIGRATION_PLAN_RELATIVE_DIRECTORY =
  "migration-plans/v2" as const;
export const AUTHENTICATED_MIGRATION_PLATFORM_FILE =
  "platform-bootstrap.sql" as const;
export const AUTHENTICATED_MIGRATION_APPLICATION_MANIFEST_FILE =
  "application-manifest.json" as const;
export const AUTHENTICATED_MIGRATION_APPLICATION_DIRECTORY =
  "application" as const;
export const AUTHENTICATED_MIGRATION_APPLICATION_FILES = Object.freeze([
  "0001_request_context_and_ledger.sql",
  "0002_canonical_entities.sql",
  "0003_temporal_constraints_and_indexes.sql",
  "0004_row_security_and_runtime_grants.sql",
  "0005_non_reusable_resource_ids.sql",
  "0006_null_safe_request_context.sql",
] as const);
const AUTHENTICATED_MIGRATION_APPLICATION_SHA256 = Object.freeze([
  "37d69e26b370e6a0c9f191e6f46a8d59579612f67c16f918e2ed78a5eb399e2f",
  "272dce4b0d91e96f58442896621b2d570e8e027fbfc843f83de5f36c005154f6",
  "d7a1a3d1991cb0a531a1643111fb8192dfad546efa4aa4913d0d8f8f34fed4d2",
  "ecaf289311eea9a58d8c4e4f342e9f7e40f86f0b05fdebc9d50975aa672930eb",
  "703205835c4689350ec0d49d4377adaa08dc2abdcc63bf669dda8dee7049d61d",
  "b3da4be6401accbd0140f0fe9a85d04d4093a06448eab129aa1c9c78be363f91",
] as const);
export const AUTHENTICATED_MIGRATION_PLATFORM_SHA256 =
  "21da4c90175b5b22f0e87a21fcd37ce2d6be651ed1c276d30fd01565c9eb41f1" as const;
export const AUTHENTICATED_MIGRATION_OWNER_ROLE =
  "research_cockpit_owner" as const;
export const AUTHENTICATED_MIGRATOR_LOGIN_ROLE =
  "research_cockpit_migrator_login" as const;
export const AUTHENTICATED_MIGRATION_DATABASE_NAME =
  CLEAN_BOOTSTRAP_DATABASE_NAME;
export const AUTHENTICATED_MIGRATION_RESTORE_DATABASE_NAME =
  "research_cockpit_acceptance_restore_test" as const;
export type AuthenticatedMigrationDatabaseName =
  | typeof AUTHENTICATED_MIGRATION_DATABASE_NAME
  | typeof AUTHENTICATED_MIGRATION_RESTORE_DATABASE_NAME;
export const AUTHENTICATED_MIGRATION_IDENTITY_MARKER =
  "b7-authenticated-migrator-identity-ok" as const;
export const AUTHENTICATED_MIGRATION_ROLE_RESET_MARKER =
  "b7-authenticated-migrator-role-reset-ok" as const;
export const AUTHENTICATED_MIGRATION_INJECTED_FAILURE_SQLSTATE =
  "22012" as const;

export const AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY =
  "818476709640328252" as const;
const APPLICATION_MIGRATION_COUNT =
  AUTHENTICATED_MIGRATION_APPLICATION_FILES.length;
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const reviewedPlanRoot = join(
  packageRoot,
  "migration-plans",
  `v${AUTHENTICATED_MIGRATION_PLAN_VERSION}`,
);

export interface AuthenticatedMigrationManifestEntry {
  readonly id: string;
  readonly file: string;
  readonly sha256: string;
}

export interface AuthenticatedMigrationManifest {
  readonly schemaVersion: 1;
  readonly planVersion: 2;
  readonly algorithm: "sha256";
  readonly migrations: readonly AuthenticatedMigrationManifestEntry[];
}

export interface AuthenticatedMigrationFile {
  readonly file: string;
  readonly sql: string;
}

export interface AuthenticatedMigrationLedgerRow {
  readonly migrationId: string;
  readonly fileName: string;
  readonly sha256: string;
}

export interface AuthenticatedMigrationPlan {
  readonly platformSql: string;
  readonly manifest: AuthenticatedMigrationManifest;
  readonly applicationFiles: readonly AuthenticatedMigrationFile[];
}

// The v2 plan is separate from the immutable historical clean-bootstrap lane.
export async function loadAuthenticatedMigrationPlan(
  root = reviewedPlanRoot,
): Promise<AuthenticatedMigrationPlan> {
  const rootEntries = (await readdir(root, { withFileTypes: true }))
    .map((entry) =>
      entry.isDirectory()
        ? `directory:${entry.name}`
        : entry.isFile()
          ? `file:${entry.name}`
          : `unsupported:${entry.name}`,
    )
    .sort(compareText);
  const expectedRootEntries = [
    `directory:${AUTHENTICATED_MIGRATION_APPLICATION_DIRECTORY}`,
    `file:${AUTHENTICATED_MIGRATION_APPLICATION_MANIFEST_FILE}`,
    `file:${AUTHENTICATED_MIGRATION_PLATFORM_FILE}`,
  ].sort(compareText);
  if (!sameStrings(rootEntries, expectedRootEntries)) {
    throw new Error(
      "Authenticated migration plan root contains missing or unexpected entries",
    );
  }

  const [platformSql, manifestValue] = await Promise.all([
    readFile(join(root, AUTHENTICATED_MIGRATION_PLATFORM_FILE), "utf8"),
    readFile(
      join(root, AUTHENTICATED_MIGRATION_APPLICATION_MANIFEST_FILE),
      "utf8",
    ).then((text) => JSON.parse(text) as unknown),
  ]);
  const manifest = parseAuthenticatedMigrationManifest(manifestValue);
  const applicationDirectory = join(
    root,
    AUTHENTICATED_MIGRATION_APPLICATION_DIRECTORY,
  );
  const fileNames = (
    await readdir(applicationDirectory, {
      withFileTypes: true,
    })
  )
    .map((entry) => {
      if (!entry.isFile()) {
        throw new Error(
          "Authenticated application directory may contain only migration files",
        );
      }
      return entry.name;
    })
    .sort(compareText);
  const applicationFiles = await Promise.all(
    fileNames.map(async (file) => ({
      file,
      sql: await readFile(join(applicationDirectory, file), "utf8"),
    })),
  );
  return snapshotAuthenticatedMigrationPlan({
    platformSql,
    manifest,
    applicationFiles,
  });
}

/**
 * Take one synchronous, validated snapshot before a migration transaction can
 * await. Callers may retain or mutate their input without changing the
 * reviewed plan used by the transaction.
 */
export function snapshotAuthenticatedMigrationPlan(
  plan: AuthenticatedMigrationPlan,
): AuthenticatedMigrationPlan {
  const snapshot = freezePlan({
    platformSql: plan.platformSql,
    manifest: parseAuthenticatedMigrationManifest({
      schemaVersion: plan.manifest.schemaVersion,
      planVersion: plan.manifest.planVersion,
      algorithm: plan.manifest.algorithm,
      migrations: plan.manifest.migrations.map((entry) => ({
        id: entry.id,
        file: entry.file,
        sha256: entry.sha256,
      })),
    }),
    applicationFiles: plan.applicationFiles.map((migration) => ({
      file: migration.file,
      sql: migration.sql,
    })),
  });
  validateAuthenticatedMigrationPlan(snapshot);
  return snapshot;
}

export function parseAuthenticatedMigrationManifest(
  value: unknown,
): AuthenticatedMigrationManifest {
  assertRecord(value, "Authenticated migration manifest must be an object");
  assertExactKeys(
    value,
    ["schemaVersion", "planVersion", "algorithm", "migrations"],
    "authenticated migration manifest",
  );
  if (
    value.schemaVersion !== 1 ||
    value.planVersion !== AUTHENTICATED_MIGRATION_PLAN_VERSION ||
    value.algorithm !== "sha256"
  ) {
    throw new Error(
      "Authenticated migration manifest schema, plan version, or algorithm is unsupported",
    );
  }
  if (
    !Array.isArray(value.migrations) ||
    value.migrations.length !== APPLICATION_MIGRATION_COUNT
  ) {
    throw new Error(
      `Authenticated migration manifest must contain exactly ${APPLICATION_MIGRATION_COUNT} application migrations`,
    );
  }

  const migrations = value.migrations.map((entry, index) => {
    assertRecord(
      entry,
      `Authenticated manifest migration ${index} must be an object`,
    );
    assertExactKeys(
      entry,
      ["id", "file", "sha256"],
      `authenticated manifest migration ${index}`,
    );
    const sequence = String(index + 1).padStart(4, "0");
    if (
      entry.id !== `v2-${sequence}` ||
      typeof entry.file !== "string" ||
      entry.file !== AUTHENTICATED_MIGRATION_APPLICATION_FILES[index] ||
      typeof entry.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(entry.sha256)
    ) {
      throw new Error(
        `Authenticated manifest migration ${index} is malformed or out of order`,
      );
    }
    return Object.freeze({
      id: entry.id,
      file: entry.file,
      sha256: entry.sha256,
    });
  });
  const ids = migrations.map(({ id }) => id);
  const files = migrations.map(({ file }) => file);
  if (
    new Set(ids).size !== ids.length ||
    new Set(files).size !== files.length ||
    !sameStrings(files, [...files].sort(compareText))
  ) {
    throw new Error(
      "Authenticated migration IDs and files must be unique and ordered",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    planVersion: AUTHENTICATED_MIGRATION_PLAN_VERSION,
    algorithm: "sha256",
    migrations: Object.freeze(migrations),
  });
}

export function expectedAuthenticatedMigrationLedgerRows(
  manifest: AuthenticatedMigrationManifest,
): readonly AuthenticatedMigrationLedgerRow[] {
  return Object.freeze(
    manifest.migrations.map((entry) =>
      Object.freeze({
        migrationId: entry.id,
        fileName: entry.file,
        sha256: entry.sha256,
      }),
    ),
  );
}

export function renderAuthenticatedPlatformMigration(
  plan: AuthenticatedMigrationPlan,
  injectFailure = false,
): string {
  assertBoolean(injectFailure, "platform injectFailure");
  validateAuthenticatedMigrationPlan(plan);
  const lines = [
    "BEGIN;",
    `SELECT pg_catalog.pg_advisory_xact_lock(${AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY}::bigint);`,
    stripPlatformTransaction(plan.platformSql),
  ];
  if (injectFailure) lines.push(renderInjectedFailure());
  lines.push("COMMIT;", "");
  return lines.join("\n");
}

export function renderAuthenticatedApplicationMigration(
  plan: AuthenticatedMigrationPlan,
  injectFailure = false,
  databaseName: AuthenticatedMigrationDatabaseName = AUTHENTICATED_MIGRATION_DATABASE_NAME,
): string {
  assertBoolean(injectFailure, "application injectFailure");
  assertAuthenticatedMigrationDatabaseName(databaseName);
  validateAuthenticatedMigrationPlan(plan);
  const lines = [
    "BEGIN;",
    `SELECT pg_catalog.pg_advisory_xact_lock(${AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY}::bigint);`,
    `SET LOCAL ROLE ${AUTHENTICATED_MIGRATION_OWNER_ROLE};`,
    renderAuthenticatedApplicationPreflight(databaseName),
  ];

  for (const [index, entry] of plan.manifest.migrations.entries()) {
    const migration = plan.applicationFiles[index];
    if (!migration || migration.file !== entry.file) {
      throw new Error(
        `Missing authenticated application migration ${entry.file}`,
      );
    }
    lines.push(
      `-- authenticated application migration ${entry.id}: ${entry.file}`,
      migration.sql.trimEnd(),
      "INSERT INTO shared_data.schema_migrations (migration_id, file_name, sha256)",
      `VALUES ('${entry.id}', '${entry.file}', '${entry.sha256}');`,
    );
  }
  if (injectFailure) lines.push(renderInjectedFailure());
  lines.push(
    renderAuthenticatedIdentityAssertion(),
    `SELECT '${AUTHENTICATED_MIGRATION_IDENTITY_MARKER}';`,
    "COMMIT;",
    renderAuthenticatedRoleResetAssertion(),
    `SELECT '${AUTHENTICATED_MIGRATION_ROLE_RESET_MARKER}';`,
    "",
  );
  return lines.join("\n");
}

export async function renderReviewedAuthenticatedPlatformMigration(
  injectFailure = false,
  root = reviewedPlanRoot,
): Promise<string> {
  return renderAuthenticatedPlatformMigration(
    await loadAuthenticatedMigrationPlan(root),
    injectFailure,
  );
}

export async function renderReviewedAuthenticatedApplicationMigration(
  injectFailure = false,
  root = reviewedPlanRoot,
  databaseName: AuthenticatedMigrationDatabaseName = AUTHENTICATED_MIGRATION_DATABASE_NAME,
): Promise<string> {
  return renderAuthenticatedApplicationMigration(
    await loadAuthenticatedMigrationPlan(root),
    injectFailure,
    databaseName,
  );
}

function validateAuthenticatedMigrationPlan(
  plan: AuthenticatedMigrationPlan,
): void {
  validateExactKeys(
    plan,
    ["platformSql", "manifest", "applicationFiles"],
    "authenticated migration plan",
  );
  if (typeof plan.platformSql !== "string") {
    throw new Error("Authenticated platform bootstrap must be SQL text");
  }
  const manifest = parseAuthenticatedMigrationManifest(plan.manifest);
  if (!isArrayValue(plan.applicationFiles)) {
    throw new Error("Authenticated application migrations must be an array");
  }
  for (const [index, migration] of plan.applicationFiles.entries()) {
    validateExactKeys(
      migration,
      ["file", "sql"],
      `authenticated application migration ${index}`,
    );
    if (
      typeof migration.file !== "string" ||
      typeof migration.sql !== "string"
    ) {
      throw new Error(
        `Authenticated application migration ${index} is malformed`,
      );
    }
  }

  const platformHash = sha256(plan.platformSql);
  if (platformHash !== AUTHENTICATED_MIGRATION_PLATFORM_SHA256) {
    throw new Error(
      "Authenticated platform bootstrap checksum differs from the reviewed v2 source",
    );
  }
  validatePlatformSql(plan.platformSql);

  const diskFiles = plan.applicationFiles.map(({ file }) => file);
  const manifestFiles = manifest.migrations.map(({ file }) => file);
  if (
    new Set(diskFiles).size !== diskFiles.length ||
    !sameStrings(diskFiles, [...diskFiles].sort(compareText)) ||
    !sameStrings(diskFiles, manifestFiles)
  ) {
    throw new Error(
      "Authenticated application files must exactly match the ordered v2 manifest",
    );
  }
  for (const [index, entry] of manifest.migrations.entries()) {
    const migration = plan.applicationFiles[index];
    if (!migration || sha256(migration.sql) !== entry.sha256) {
      throw new Error(
        `Authenticated application checksum differs from manifest: ${entry.file}`,
      );
    }
    validateApplicationSql(migration);
    if (entry.sha256 !== AUTHENTICATED_MIGRATION_APPLICATION_SHA256[index]) {
      throw new Error(
        `Authenticated application checksum differs from the reviewed v2 source: ${entry.file}`,
      );
    }
  }
  validateApplicationBundle(plan.applicationFiles);
}

function validatePlatformSql(sql: string): void {
  const wrapper = /^BEGIN;\r?\n([\s\S]*)\r?\nCOMMIT;(?:\r?\n)?$/.exec(sql);
  if (
    !wrapper?.[1] ||
    (sql.match(/^BEGIN;$/gm)?.length ?? 0) !== 1 ||
    (sql.match(/^COMMIT;$/gm)?.length ?? 0) !== 1
  ) {
    throw new Error(
      "Authenticated platform bootstrap needs exactly one BEGIN/COMMIT wrapper",
    );
  }
  const controls = inspectEmbeddedSqlControls(wrapper[1]);
  if (controls.length > 0) {
    throw new Error(
      `Authenticated platform bootstrap contains an embedded transaction or psql control: ${controls.join(", ")}`,
    );
  }
  const prohibited = detectProhibitedSql(sql);
  if (prohibited.length > 0) {
    throw new Error(
      `Authenticated platform bootstrap contains prohibited SQL: ${prohibited.join(", ")}`,
    );
  }
  const visible = maskSqlQuotedContent(wrapper[1]);
  for (const prohibitedPattern of [
    /\bCREATE\s+(?:TABLE|FUNCTION|PROCEDURE|POLICY|TRIGGER|INDEX)\b/i,
    /\bALTER\s+(?:TABLE|FUNCTION|PROCEDURE)\b/i,
    /\bSET\s+(?:LOCAL\s+)?ROLE\b/i,
    /\bSET\s+SESSION\s+AUTHORIZATION\b/i,
  ]) {
    if (prohibitedPattern.test(visible)) {
      throw new Error(
        "Authenticated platform bootstrap crosses into application-owned DDL",
      );
    }
  }
  for (const required of [
    /CREATE\s+SCHEMA\s+shared_data\s*;/i,
    /CREATE\s+SCHEMA\s+private_data\s*;/i,
    /ALTER\s+SCHEMA\s+shared_data\s+OWNER\s+TO\s+research_cockpit_owner\s*;/i,
    /ALTER\s+SCHEMA\s+private_data\s+OWNER\s+TO\s+research_cockpit_owner\s*;/i,
    /REVOKE\s+ALL\s+ON\s+SCHEMA\s+public\s+FROM\s+PUBLIC\s*;/i,
    /CREATE\s+EXTENSION\s+btree_gist\s+WITH\s+SCHEMA\s+shared_data\s*;/i,
    /REVOKE\s+ALL\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+shared_data\s+FROM\s+PUBLIC\s*;/i,
    /REVOKE\s+CREATE\s*,\s*TEMPORARY\s+ON\s+DATABASE\s+%I\s+FROM\s+PUBLIC/i,
  ]) {
    if (!required.test(sql)) {
      throw new Error(
        "Authenticated platform bootstrap is missing a required privileged boundary",
      );
    }
  }
  for (const role of ["owner", "runtime", "test_seed", "backup"]) {
    const roleName = `research_cockpit_${role}`;
    const declaration = new RegExp(
      `CREATE\\s+ROLE\\s+${roleName}([\\s\\S]*?);`,
      "i",
    ).exec(sql)?.[1];
    if (!declaration) {
      throw new Error(
        `Authenticated platform bootstrap is missing ${roleName}`,
      );
    }
    for (const attribute of [
      "NOLOGIN",
      "NOSUPERUSER",
      "NOCREATEDB",
      "NOCREATEROLE",
      "NOREPLICATION",
      "NOINHERIT",
      "NOBYPASSRLS",
    ]) {
      if (!new RegExp(`\\b${attribute}\\b`, "i").test(declaration)) {
        throw new Error(
          `Authenticated platform bootstrap ${roleName} is missing ${attribute}`,
        );
      }
    }
    if (
      !new RegExp(
        `unsafe pre-existing capability role membership: ${roleName}`,
        "i",
      ).test(sql)
    ) {
      throw new Error(
        `Authenticated platform bootstrap must reject ${roleName} membership residue`,
      );
    }
  }
}

function validateApplicationSql(migration: AuthenticatedMigrationFile): void {
  if (!migration.sql.startsWith("-- Versioned v2 application migration.")) {
    throw new Error(
      `${migration.file}: v2 source must preserve the historical-lane notice`,
    );
  }
  const controls = inspectEmbeddedSqlControls(migration.sql);
  if (controls.length > 0) {
    throw new Error(
      `${migration.file}: application source contains transaction or psql control: ${controls.join(", ")}`,
    );
  }
  const prohibited = detectProhibitedSql(migration.sql);
  if (prohibited.length > 0) {
    throw new Error(
      `${migration.file}: application source contains prohibited SQL: ${prohibited.join(", ")}`,
    );
  }
  const visible = maskSqlQuotedContent(migration.sql);
  for (const pattern of [
    /\b(?:CREATE|ALTER|DROP)\s+ROLE\b/i,
    /\b(?:CREATE|ALTER|DROP)\s+(?:DATABASE|TABLESPACE|USER|GROUP)\b/i,
    /\b(?:CREATE|ALTER|DROP)\s+SCHEMA\b/i,
    /\b(?:CREATE|ALTER|DROP)\s+EXTENSION\b/i,
    /\bALTER\s+SYSTEM\b/i,
    /\bCOPY\b[^;]*\bPROGRAM\b/i,
    /\bGRANT\s+(?![^;]*\bON\b)[^;]+\bTO\b/i,
    /\bREVOKE\s+(?![^;]*\bON\b)[^;]+\bFROM\b/i,
    /\bOWNER\s+TO\b/i,
    /\bON\s+DATABASE\b/i,
    /\bSET\s+(?:LOCAL\s+)?ROLE\b/i,
    /\bRESET\s+ROLE\b/i,
    /\bSET\s+SESSION\s+AUTHORIZATION\b/i,
    /\bREVOKE\s+ALL\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\b/i,
  ]) {
    if (pattern.test(visible)) {
      throw new Error(
        `${migration.file}: application source crosses the v2 platform boundary`,
      );
    }
  }
  if (
    /\bDO\s+\$/i.test(migration.sql) ||
    /\bEXECUTE\s+(?:pg_catalog\.)?format\s*\(/i.test(migration.sql)
  ) {
    throw new Error(
      `${migration.file}: application source may not hide dynamic platform SQL`,
    );
  }
}

function validateApplicationBundle(
  migrations: readonly AuthenticatedMigrationFile[],
): void {
  const combined = migrations.map(({ sql }) => sql).join("\n");
  for (const required of [
    /CREATE\s+TABLE\s+shared_data\.schema_migrations\s*\(/i,
    /applied_by\s+text\s+NOT\s+NULL\s+DEFAULT\s+session_user/i,
    /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+research_cockpit_owner/i,
    /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+research_cockpit_owner\s+REVOKE\s+EXECUTE\s+ON\s+FUNCTIONS\s+FROM\s+PUBLIC/i,
    /CREATE\s+FUNCTION\s+private_data\.current_principal_id\(\)/i,
    /CREATE\s+TABLE\s+private_data\.organizations\s*\(/i,
    /ALTER\s+TABLE\s+private_data\.organizations\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/i,
    /CREATE\s+TRIGGER\s+resource_id_registry_append_only/i,
    /CREATE\s+OR\s+REPLACE\s+PROCEDURE\s+private_data\.set_request_context/i,
    /REVOKE\s+ALL\s+ON\s+FUNCTION\s+shared_data\.rights_allow_current_use\(text,\s*text\)\s+FROM\s+PUBLIC/i,
  ]) {
    if (!required.test(combined)) {
      throw new Error(
        "Authenticated application bundle is missing a required reviewed contract",
      );
    }
  }
  if (
    (combined.match(/CREATE\s+TABLE\s+shared_data\.schema_migrations\s*\(/gi)
      ?.length ?? 0) !== 1
  ) {
    throw new Error(
      "Authenticated application bundle must create the migration ledger exactly once",
    );
  }
  if (
    /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+research_cockpit_owner\s+IN\s+SCHEMA\s+[^;]+\s+REVOKE\s+EXECUTE\s+ON\s+FUNCTIONS\s+FROM\s+PUBLIC/i.test(
      combined,
    )
  ) {
    throw new Error(
      "Authenticated application function defaults must remove the global PUBLIC EXECUTE privilege",
    );
  }
}

function renderAuthenticatedApplicationPreflight(
  databaseName: AuthenticatedMigrationDatabaseName,
): string {
  const capabilityRoles = [
    "research_cockpit_owner",
    "research_cockpit_runtime",
    "research_cockpit_test_seed",
    "research_cockpit_backup",
  ]
    .map((role) => `'${role}'`)
    .join(", ");
  return `DO $authenticated_migration_preflight$
DECLARE
  capability_role text;
  exact_membership_count integer;
  related_membership_count integer;
BEGIN
  IF pg_catalog.current_database() <> '${databaseName}' THEN
    RAISE EXCEPTION 'authenticated migration refused for database %',
      pg_catalog.current_database();
  END IF;
  IF session_user <> '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
    OR current_user <> '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
    OR session_user = current_user
  THEN
    RAISE EXCEPTION 'authenticated migration identity is invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
      AND rolcanlogin
      AND NOT rolsuper
      AND NOT rolcreatedb
      AND NOT rolcreaterole
      AND NOT rolreplication
      AND NOT rolinherit
      AND NOT rolbypassrls
      AND rolconnlimit = 1
  ) THEN
    RAISE EXCEPTION 'authenticated migrator login attributes are invalid';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_db_role_setting AS role_setting
    JOIN pg_catalog.pg_roles AS setting_role
      ON setting_role.oid = role_setting.setrole
    WHERE setting_role.rolname = '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
  ) THEN
    RAISE EXCEPTION 'authenticated migrator role settings are prohibited';
  END IF;
  FOREACH capability_role IN ARRAY ARRAY[${capabilityRoles}]::text[]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_roles
      WHERE rolname = capability_role
        AND NOT rolcanlogin
        AND NOT rolsuper
        AND NOT rolcreatedb
        AND NOT rolcreaterole
        AND NOT rolreplication
        AND NOT rolinherit
        AND NOT rolbypassrls
    ) THEN
      RAISE EXCEPTION 'unsafe capability role: %', capability_role;
    END IF;
  END LOOP;
  SELECT pg_catalog.count(*)::integer
    INTO exact_membership_count
  FROM pg_catalog.pg_auth_members AS membership
  JOIN pg_catalog.pg_roles AS granted_role
    ON granted_role.oid = membership.roleid
  JOIN pg_catalog.pg_roles AS member_role
    ON member_role.oid = membership.member
  WHERE granted_role.rolname = '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
    AND member_role.rolname = '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
    AND NOT membership.admin_option
    AND NOT membership.inherit_option
    AND membership.set_option;
  SELECT pg_catalog.count(*)::integer
    INTO related_membership_count
  FROM pg_catalog.pg_auth_members AS membership
  JOIN pg_catalog.pg_roles AS granted_role
    ON granted_role.oid = membership.roleid
  JOIN pg_catalog.pg_roles AS member_role
    ON member_role.oid = membership.member
  WHERE granted_role.rolname IN (${capabilityRoles})
     OR member_role.rolname IN (${capabilityRoles})
     OR granted_role.rolname = '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
     OR member_role.rolname = '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}';
  IF exact_membership_count <> 1 OR related_membership_count <> 1 THEN
    RAISE EXCEPTION 'authenticated migrator membership graph is invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_namespace AS namespace
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = namespace.nspowner
    WHERE namespace.nspname = 'shared_data'
      AND owner_role.rolname = '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_namespace AS namespace
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = namespace.nspowner
    WHERE namespace.nspname = 'private_data'
      AND owner_role.rolname = '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
  ) THEN
    RAISE EXCEPTION 'authenticated migration schema ownership is invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_extension AS extension_row
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = extension_row.extnamespace
    WHERE extension_row.extname = 'btree_gist'
      AND namespace.nspname = 'shared_data'
  ) THEN
    RAISE EXCEPTION 'authenticated migration platform extension is missing';
  END IF;
  IF pg_catalog.to_regclass('shared_data.schema_migrations') IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'versioned application migration requires an empty ledger';
  END IF;
  IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = class.relnamespace
      WHERE namespace.nspname IN ('shared_data', 'private_data')
        AND class.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'versioned application migration requires a pristine application target';
  END IF;
END;
$authenticated_migration_preflight$;`;
}

function assertAuthenticatedMigrationDatabaseName(
  value: string,
): asserts value is AuthenticatedMigrationDatabaseName {
  if (
    value !== AUTHENTICATED_MIGRATION_DATABASE_NAME &&
    value !== AUTHENTICATED_MIGRATION_RESTORE_DATABASE_NAME
  ) {
    throw new Error("Authenticated migration database target is unsupported");
  }
}

function renderAuthenticatedIdentityAssertion(): string {
  return `DO $authenticated_migration_identity$
BEGIN
  IF session_user <> '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
    OR current_user <> '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
  THEN
    RAISE EXCEPTION 'authenticated migration identity changed';
  END IF;
END;
$authenticated_migration_identity$;`;
}

function renderAuthenticatedRoleResetAssertion(): string {
  return `DO $authenticated_migration_role_reset$
BEGIN
  IF session_user <> '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
    OR current_user <> session_user
  THEN
    RAISE EXCEPTION 'authenticated migration role did not reset';
  END IF;
END;
$authenticated_migration_role_reset$;`;
}

function stripPlatformTransaction(sql: string): string {
  const wrapper = /^BEGIN;\r?\n([\s\S]*)\r?\nCOMMIT;(?:\r?\n)?$/.exec(sql);
  if (!wrapper?.[1]) {
    throw new Error(
      "Authenticated platform bootstrap is missing its exact transaction wrapper",
    );
  }
  return wrapper[1];
}

function renderInjectedFailure(): string {
  return `-- deterministic B7 rollback probe; division_by_zero has SQLSTATE ${AUTHENTICATED_MIGRATION_INJECTED_FAILURE_SQLSTATE}
SELECT 1 / 0;`;
}

function freezePlan(plan: {
  platformSql: string;
  manifest: AuthenticatedMigrationManifest;
  applicationFiles: AuthenticatedMigrationFile[];
}): AuthenticatedMigrationPlan {
  return Object.freeze({
    platformSql: plan.platformSql,
    manifest: plan.manifest,
    applicationFiles: Object.freeze(
      plan.applicationFiles.map((migration) => Object.freeze(migration)),
    ),
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertBoolean(
  value: unknown,
  label: string,
): asserts value is boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean`);
}

function assertExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  assertRecord(value, `${label} must be an object`);
  const actual = Object.keys(value).sort(compareText);
  const expected = [...expectedKeys].sort(compareText);
  if (!sameStrings(actual, expected)) {
    throw new Error(`${label} contains missing or unexpected fields`);
  }
}

function validateExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): void {
  assertExactKeys(value, expectedKeys, label);
}

function isArrayValue(value: unknown): boolean {
  return Array.isArray(value);
}

function assertRecord(
  value: unknown,
  message: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
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
