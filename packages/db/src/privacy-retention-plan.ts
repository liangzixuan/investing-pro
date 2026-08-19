import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUTHENTICATED_MIGRATION_OWNER_ROLE,
  AUTHENTICATED_MIGRATOR_LOGIN_ROLE,
  expectedAuthenticatedMigrationLedgerRows,
  snapshotAuthenticatedMigrationPlan,
  type AuthenticatedMigrationPlan,
} from "./authenticated-migration-plan";
import {
  assertResourceIdentifierTokenV1,
  type ResourceIdentifierTokenV1,
  type ResourceIdentifierTypeV1,
} from "./resource-identifier-token";

export const PRIVACY_RETENTION_PLAN_VERSION = 1 as const;
export const PRIVACY_RETENTION_PLAN_RELATIVE_DIRECTORY =
  "privacy-retention-plans/v1" as const;
export const PRIVACY_RETENTION_PLAN_POLICY_FILE = "policy.json" as const;
export const PRIVACY_RETENTION_PLAN_MANIFEST_FILE = "manifest.json" as const;
export const PRIVACY_RETENTION_PLAN_PLATFORM_FILE =
  "platform-bootstrap.sql" as const;
export const PRIVACY_RETENTION_PLAN_APPLICATION_DIRECTORY =
  "application" as const;
export const PRIVACY_RETENTION_PLAN_APPLICATION_FILES = Object.freeze([
  "application/0001_keyed_resource_identifier_lifecycle.sql",
] as const);
export const PRIVACY_RETENTION_PLAN_PLATFORM_SHA256 =
  "9451c594f06aeae596e66cc22a4416285b5432b74fcff65664429a1472814376" as const;
export const PRIVACY_RETENTION_PLAN_APPLICATION_SHA256 = Object.freeze([
  "37812d0742295cd581f4ba0505c1e0e4db6a9a8f4b5defdc1e69d388eeaa6e7c",
] as const);
export const PRIVACY_RETENTION_PLAN_MANIFEST_SHA256 =
  "729206ac2311dd247a7e5741b91ac26d7772ccbb9b0aca382bb89a4282a1f63f" as const;
export const PRIVACY_RETENTION_FIXTURE_RELATIVE_FILE =
  "acceptance/privacy-retention-fixture.sql" as const;
export const PRIVACY_RETENTION_FIXTURE_SHA256 =
  "9be0682dffbb981350bde888b2880b99e2bfa587da96acdfae281c41be67a6c7" as const;
export const PRIVACY_RETENTION_DATABASE_NAME =
  "research_cockpit_b13_privacy_retention_test" as const;
export const PRIVACY_RETENTION_CAPABILITY_ROLE =
  "research_cockpit_privacy_retention" as const;
export const PRIVACY_RETENTION_ACCEPTANCE_LOGIN_ROLE =
  "research_cockpit_b13_privacy_retention_login" as const;
export const PRIVACY_RETENTION_ADVISORY_LOCK_KEY =
  "818476709640328253" as const;
export const PRIVACY_RETENTION_INJECTED_FAILURE_SQLSTATE = "22012" as const;
export const PRIVACY_RETENTION_BASE_IDENTITY_MARKER =
  "b13-privacy-base-identity-ok" as const;
export const PRIVACY_RETENTION_SUFFIX_IDENTITY_MARKER =
  "b13-privacy-suffix-identity-ok" as const;
export const PRIVACY_RETENTION_ROLE_RESET_MARKER =
  "b13-privacy-role-reset-ok" as const;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const reviewedPlanRoot = join(
  packageRoot,
  "privacy-retention-plans",
  `v${PRIVACY_RETENTION_PLAN_VERSION}`,
);
const reviewedFixtureFile = join(
  packageRoot,
  "acceptance",
  "privacy-retention-fixture.sql",
);

export interface PrivacyRetentionPlanManifestEntryV1 {
  readonly id: "privacy-v1-0001";
  readonly file: (typeof PRIVACY_RETENTION_PLAN_APPLICATION_FILES)[number];
  readonly sha256: string;
}

export interface PrivacyRetentionPlanManifestV1 {
  readonly schemaVersion: 1;
  readonly planVersion: 1;
  readonly algorithm: "sha256";
  readonly platform: {
    readonly file: typeof PRIVACY_RETENTION_PLAN_PLATFORM_FILE;
    readonly sha256: string;
  };
  readonly migrations: readonly PrivacyRetentionPlanManifestEntryV1[];
}

export interface PrivacyRetentionPlanFileV1 {
  readonly file: (typeof PRIVACY_RETENTION_PLAN_APPLICATION_FILES)[number];
  readonly sql: string;
}

export interface PrivacyRetentionPlanV1 {
  readonly platformSql: string;
  readonly manifest: PrivacyRetentionPlanManifestV1;
  readonly applicationFiles: readonly PrivacyRetentionPlanFileV1[];
}

export const PRIVACY_RETENTION_FIXTURE_TOKEN_NAMES_V1 = Object.freeze([
  "alphaThesis",
  "betaThesis",
  "alphaAlert",
  "betaAlert",
] as const);
export type PrivacyRetentionFixtureTokenNameV1 =
  (typeof PRIVACY_RETENTION_FIXTURE_TOKEN_NAMES_V1)[number];

export interface PrivacyRetentionFixtureTokenInputV1 {
  readonly privacyDomainId: string;
  readonly resourceType: ResourceIdentifierTypeV1;
  readonly resourceId: string;
}

export const PRIVACY_RETENTION_FIXTURE_TOKEN_INPUTS_V1 = deepFreeze({
  alphaThesis: {
    privacyDomainId: "33000000-0000-4000-8000-000000000001",
    resourceType: "thesis",
    resourceId: "53000000-0000-4000-8000-000000000001",
  },
  betaThesis: {
    privacyDomainId: "33000000-0000-4000-8000-000000000002",
    resourceType: "thesis",
    resourceId: "53000000-0000-4000-8000-000000000001",
  },
  alphaAlert: {
    privacyDomainId: "33000000-0000-4000-8000-000000000001",
    resourceType: "alert",
    resourceId: "53000000-0000-4000-8000-000000000002",
  },
  betaAlert: {
    privacyDomainId: "33000000-0000-4000-8000-000000000002",
    resourceType: "alert",
    resourceId: "53000000-0000-4000-8000-000000000002",
  },
} satisfies Record<
  PrivacyRetentionFixtureTokenNameV1,
  PrivacyRetentionFixtureTokenInputV1
>);

export type PrivacyRetentionFixtureTokensV1 = Readonly<
  Record<PrivacyRetentionFixtureTokenNameV1, ResourceIdentifierTokenV1>
>;

const fixtureTokenPlaceholders = Object.freeze({
  alphaThesis: "__PRIVACY_TOKEN_ALPHA_THESIS_HEX__",
  betaThesis: "__PRIVACY_TOKEN_BETA_THESIS_HEX__",
  alphaAlert: "__PRIVACY_TOKEN_ALPHA_ALERT_HEX__",
  betaAlert: "__PRIVACY_TOKEN_BETA_ALERT_HEX__",
} satisfies Record<PrivacyRetentionFixtureTokenNameV1, string>);

const privacyRetentionTenantTablesV1 = Object.freeze([
  "private_data.organizations",
  "private_data.principals",
  "private_data.organization_principals",
  "private_data.memberships",
  "private_data.entitlements",
  "private_data.theses",
  "private_data.alert_rules",
  "private_data.idempotency_records",
  "private_data.audit_events",
  "private_data.resource_id_registry",
] as const);

export async function loadPrivacyRetentionPlanV1(
  root = reviewedPlanRoot,
): Promise<PrivacyRetentionPlanV1> {
  const entries = (await readdir(root, { withFileTypes: true }))
    .map((entry) =>
      entry.isDirectory()
        ? `directory:${entry.name}`
        : entry.isFile()
          ? `file:${entry.name}`
          : `unsupported:${entry.name}`,
    )
    .sort(compareText);
  const expectedEntries = [
    `directory:${PRIVACY_RETENTION_PLAN_APPLICATION_DIRECTORY}`,
    `file:${PRIVACY_RETENTION_PLAN_MANIFEST_FILE}`,
    `file:${PRIVACY_RETENTION_PLAN_PLATFORM_FILE}`,
    `file:${PRIVACY_RETENTION_PLAN_POLICY_FILE}`,
  ].sort(compareText);
  assertSameStrings(
    entries,
    expectedEntries,
    "Privacy retention plan root contains missing or unexpected entries",
  );

  const applicationDirectory = join(
    root,
    PRIVACY_RETENTION_PLAN_APPLICATION_DIRECTORY,
  );
  const applicationEntries = (
    await readdir(applicationDirectory, { withFileTypes: true })
  )
    .map((entry) => (entry.isFile() ? entry.name : `unsupported:${entry.name}`))
    .sort(compareText);
  const expectedApplicationEntries =
    PRIVACY_RETENTION_PLAN_APPLICATION_FILES.map((file) =>
      file.slice(`${PRIVACY_RETENTION_PLAN_APPLICATION_DIRECTORY}/`.length),
    );
  assertSameStrings(
    applicationEntries,
    expectedApplicationEntries,
    "Privacy retention application directory differs from the reviewed plan",
  );

  const [platformSql, manifestText, ...applicationSql] = await Promise.all([
    readFile(join(root, PRIVACY_RETENTION_PLAN_PLATFORM_FILE), "utf8"),
    readFile(join(root, PRIVACY_RETENTION_PLAN_MANIFEST_FILE), "utf8"),
    ...PRIVACY_RETENTION_PLAN_APPLICATION_FILES.map((file) =>
      readFile(join(root, file), "utf8"),
    ),
  ]);
  if (sha256(manifestText) !== PRIVACY_RETENTION_PLAN_MANIFEST_SHA256) {
    throw new Error(
      "Privacy retention manifest checksum differs from the reviewed v1 source",
    );
  }
  return snapshotPrivacyRetentionPlanV1({
    platformSql,
    manifest: parsePrivacyRetentionPlanManifestV1(
      JSON.parse(manifestText) as unknown,
    ),
    applicationFiles: PRIVACY_RETENTION_PLAN_APPLICATION_FILES.map(
      (file, index) => ({ file, sql: applicationSql[index] ?? "" }),
    ),
  });
}

export function snapshotPrivacyRetentionPlanV1(
  plan: PrivacyRetentionPlanV1,
): PrivacyRetentionPlanV1 {
  assertExactKeys(
    plan,
    ["platformSql", "manifest", "applicationFiles"],
    "privacy retention plan",
  );
  if (
    typeof plan.platformSql !== "string" ||
    !Array.isArray(plan.applicationFiles)
  ) {
    throw new Error("Privacy retention plan source is malformed");
  }
  const snapshot: PrivacyRetentionPlanV1 = Object.freeze({
    platformSql: plan.platformSql,
    manifest: parsePrivacyRetentionPlanManifestV1(plan.manifest),
    applicationFiles: Object.freeze(
      plan.applicationFiles.map((entry) => {
        assertExactKeys(entry, ["file", "sql"], "privacy migration source");
        if (typeof entry.file !== "string" || typeof entry.sql !== "string") {
          throw new Error("Privacy retention migration source is malformed");
        }
        return Object.freeze({
          file: entry.file,
          sql: entry.sql,
        }) as PrivacyRetentionPlanFileV1;
      }),
    ),
  });
  validatePrivacyRetentionPlanV1(snapshot);
  return snapshot;
}

export function parsePrivacyRetentionPlanManifestV1(
  value: unknown,
): PrivacyRetentionPlanManifestV1 {
  assertExactKeys(
    value,
    ["schemaVersion", "planVersion", "algorithm", "platform", "migrations"],
    "privacy retention manifest",
  );
  if (
    value.schemaVersion !== 1 ||
    value.planVersion !== PRIVACY_RETENTION_PLAN_VERSION ||
    value.algorithm !== "sha256"
  ) {
    throw new Error("Privacy retention manifest version is unsupported");
  }
  assertExactKeys(value.platform, ["file", "sha256"], "privacy platform entry");
  if (
    value.platform.file !== PRIVACY_RETENTION_PLAN_PLATFORM_FILE ||
    typeof value.platform.sha256 !== "string" ||
    !isSha256(value.platform.sha256)
  ) {
    throw new Error("Privacy retention platform manifest entry is malformed");
  }
  if (!Array.isArray(value.migrations) || value.migrations.length !== 1) {
    throw new Error(
      "Privacy retention manifest must contain exactly one migration",
    );
  }
  const entry: unknown = value.migrations[0];
  assertExactKeys(entry, ["id", "file", "sha256"], "privacy migration entry");
  if (
    entry.id !== "privacy-v1-0001" ||
    entry.file !== PRIVACY_RETENTION_PLAN_APPLICATION_FILES[0] ||
    typeof entry.sha256 !== "string" ||
    !isSha256(entry.sha256)
  ) {
    throw new Error("Privacy retention migration manifest entry is malformed");
  }
  return Object.freeze({
    schemaVersion: 1,
    planVersion: 1,
    algorithm: "sha256",
    platform: Object.freeze({
      file: PRIVACY_RETENTION_PLAN_PLATFORM_FILE,
      sha256: value.platform.sha256,
    }),
    migrations: Object.freeze([
      Object.freeze({
        id: "privacy-v1-0001",
        file: PRIVACY_RETENTION_PLAN_APPLICATION_FILES[0],
        sha256: entry.sha256,
      }),
    ]),
  });
}

export function renderPrivacyRetentionPlatformMigration(
  plan: PrivacyRetentionPlanV1,
  injectFailure = false,
): string {
  assertBoolean(injectFailure, "privacy platform injectFailure");
  const snapshot = snapshotPrivacyRetentionPlanV1(plan);
  const lines = [
    "BEGIN;",
    `SELECT pg_catalog.pg_advisory_xact_lock(${PRIVACY_RETENTION_ADVISORY_LOCK_KEY}::bigint);`,
    stripTransaction(snapshot.platformSql),
  ];
  if (injectFailure) lines.push(renderInjectedFailure());
  lines.push("COMMIT;", "");
  return lines.join("\n");
}

export function renderPrivacyRetentionBaseMigration(
  authenticatedPlan: AuthenticatedMigrationPlan,
  injectFailure = false,
): string {
  assertBoolean(injectFailure, "privacy base injectFailure");
  const base = snapshotAuthenticatedMigrationPlan(authenticatedPlan);
  const lines = [
    "BEGIN;",
    `SELECT pg_catalog.pg_advisory_xact_lock(${PRIVACY_RETENTION_ADVISORY_LOCK_KEY}::bigint);`,
    `SET LOCAL ROLE ${AUTHENTICATED_MIGRATION_OWNER_ROLE};`,
    renderPrivacyBasePreflight(),
  ];
  for (const [index, entry] of base.manifest.migrations.entries()) {
    const migration = base.applicationFiles[index];
    if (!migration || migration.file !== entry.file) {
      throw new Error(`Missing authenticated base migration ${entry.file}`);
    }
    lines.push(
      `-- privacy base migration ${entry.id}: ${entry.file}`,
      migration.sql.trimEnd(),
      "INSERT INTO shared_data.schema_migrations (migration_id, file_name, sha256)",
      `VALUES ('${entry.id}', '${entry.file}', '${entry.sha256}');`,
    );
  }
  if (injectFailure) lines.push(renderInjectedFailure());
  lines.push(
    renderRoleIdentityAssertion(
      AUTHENTICATED_MIGRATOR_LOGIN_ROLE,
      PRIVACY_RETENTION_BASE_IDENTITY_MARKER,
    ),
    "COMMIT;",
    renderRoleResetAssertion(
      AUTHENTICATED_MIGRATOR_LOGIN_ROLE,
      PRIVACY_RETENTION_ROLE_RESET_MARKER,
    ),
    "",
  );
  return lines.join("\n");
}

export function renderPrivacyRetentionApplicationMigration(
  authenticatedPlan: AuthenticatedMigrationPlan,
  privacyPlan: PrivacyRetentionPlanV1,
  injectFailure = false,
): string {
  assertBoolean(injectFailure, "privacy suffix injectFailure");
  const base = snapshotAuthenticatedMigrationPlan(authenticatedPlan);
  const privacy = snapshotPrivacyRetentionPlanV1(privacyPlan);
  const migration = privacy.applicationFiles[0];
  const entry = privacy.manifest.migrations[0];
  if (!migration || !entry || migration.file !== entry.file) {
    throw new Error("Privacy retention suffix source is incomplete");
  }
  const lines = [
    "BEGIN;",
    `SELECT pg_catalog.pg_advisory_xact_lock(${PRIVACY_RETENTION_ADVISORY_LOCK_KEY}::bigint);`,
    renderPrivacyTenantWriteBarrier(),
    renderPrivacySuffixSuperuserPreflight(base),
    `SET LOCAL ROLE ${AUTHENTICATED_MIGRATION_OWNER_ROLE};`,
    `-- privacy retention migration ${entry.id}: ${entry.file}`,
    migration.sql.trimEnd(),
    "INSERT INTO shared_data.schema_migrations (migration_id, file_name, sha256)",
    `VALUES ('${entry.id}', '${entry.file}', '${entry.sha256}');`,
  ];
  if (injectFailure) lines.push(renderInjectedFailure());
  lines.push(
    renderSuperuserToOwnerIdentityAssertion(),
    "COMMIT;",
    renderSuperuserRoleResetAssertion(),
    "",
  );
  return lines.join("\n");
}

export async function loadPrivacyRetentionFixture(): Promise<string> {
  const sql = await readFile(reviewedFixtureFile, "utf8");
  validatePrivacyRetentionFixture(sql);
  return sql;
}

export function renderPrivacyRetentionFixture(
  fixtureSql: string,
  tokens: PrivacyRetentionFixtureTokensV1,
): string {
  validatePrivacyRetentionFixture(fixtureSql);
  assertExactKeys(
    tokens,
    PRIVACY_RETENTION_FIXTURE_TOKEN_NAMES_V1,
    "privacy fixture tokens",
  );
  let rendered = fixtureSql;
  for (const name of PRIVACY_RETENTION_FIXTURE_TOKEN_NAMES_V1) {
    const token = tokens[name];
    assertResourceIdentifierTokenV1(token, `privacy fixture token ${name}`);
    const placeholder = fixtureTokenPlaceholders[name];
    if (countOccurrences(rendered, placeholder) !== 1) {
      throw new Error(`Privacy fixture placeholder ${name} must occur once`);
    }
    rendered = rendered.replace(placeholder, token);
  }
  if (/__PRIVACY_TOKEN_[A-Z_]+__/.test(rendered)) {
    throw new Error("Privacy fixture contains an unresolved token placeholder");
  }
  return [
    "BEGIN;",
    "SET LOCAL ROLE research_cockpit_test_seed;",
    rendered.trimEnd(),
    "COMMIT;",
    "",
  ].join("\n");
}

export function renderCreatePrivacyRetentionDatabaseSql(): string {
  return `DO $privacy_database_create_preflight$
BEGIN
  IF pg_catalog.current_database() <> 'postgres'
    OR session_user <> current_user
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = current_user AND rolsuper
    )
  THEN
    RAISE EXCEPTION
      'privacy database creation requires the maintenance superuser identity';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_database
    WHERE datname = '${PRIVACY_RETENTION_DATABASE_NAME}'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'bounded privacy target must be absent before creation';
  END IF;
END;
$privacy_database_create_preflight$;
CREATE DATABASE ${PRIVACY_RETENTION_DATABASE_NAME}
  OWNER postgres
  TEMPLATE template0
  ENCODING 'UTF8';
`;
}

export function renderDropPrivacyRetentionDatabaseSql(): string {
  return `DO $privacy_database_drop_preflight$
BEGIN
  IF pg_catalog.current_database() <> 'postgres'
    OR session_user <> current_user
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = current_user AND rolsuper
    )
  THEN
    RAISE EXCEPTION
      'privacy database cleanup requires the maintenance superuser identity';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_database
    WHERE datname = '${PRIVACY_RETENTION_DATABASE_NAME}'
  ) THEN
    RAISE EXCEPTION 'bounded privacy target is absent during cleanup';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_stat_activity
    WHERE datname = '${PRIVACY_RETENTION_DATABASE_NAME}'
  ) THEN
    RAISE EXCEPTION 'bounded privacy target has active backends';
  END IF;
END;
$privacy_database_drop_preflight$;
DROP DATABASE ${PRIVACY_RETENTION_DATABASE_NAME};
`;
}

function validatePrivacyRetentionPlanV1(plan: PrivacyRetentionPlanV1): void {
  const manifest = parsePrivacyRetentionPlanManifestV1(plan.manifest);
  if (
    sha256(plan.platformSql) !== PRIVACY_RETENTION_PLAN_PLATFORM_SHA256 ||
    manifest.platform.sha256 !== PRIVACY_RETENTION_PLAN_PLATFORM_SHA256
  ) {
    throw new Error(
      "Privacy platform checksum differs from the reviewed v1 source",
    );
  }
  if (
    !/^BEGIN;\r?\n[\s\S]*\r?\nCOMMIT;(?:\r?\n)?$/.test(plan.platformSql) ||
    !plan.platformSql.includes(PRIVACY_RETENTION_DATABASE_NAME) ||
    !plan.platformSql.includes(
      `CREATE ROLE ${PRIVACY_RETENTION_CAPABILITY_ROLE}`,
    )
  ) {
    throw new Error("Privacy platform source is missing its fixed boundary");
  }
  if (plan.applicationFiles.length !== 1) {
    throw new Error(
      "Privacy retention plan must contain exactly one migration",
    );
  }
  const migration = plan.applicationFiles[0];
  const entry = manifest.migrations[0];
  if (
    !migration ||
    !entry ||
    migration.file !== PRIVACY_RETENTION_PLAN_APPLICATION_FILES[0] ||
    migration.file !== entry.file ||
    sha256(migration.sql) !== entry.sha256 ||
    entry.sha256 !== PRIVACY_RETENTION_PLAN_APPLICATION_SHA256[0]
  ) {
    throw new Error(
      "Privacy application checksum differs from the reviewed v1 source",
    );
  }
  if (
    /^(?:(?:BEGIN|COMMIT|ROLLBACK);|\\[^\n]*)$/im.test(migration.sql) ||
    !migration.sql.startsWith(
      "-- Privacy-retention plan v1 is an empty-data suffix",
    ) ||
    !migration.sql.includes("privacy-retention v1 requires empty tenant data")
  ) {
    throw new Error(
      "Privacy application source crosses its fixed SQL boundary",
    );
  }
}

function validatePrivacyRetentionFixture(sql: string): void {
  if (
    typeof sql !== "string" ||
    sha256(sql) !== PRIVACY_RETENTION_FIXTURE_SHA256
  ) {
    throw new Error(
      "Privacy fixture checksum differs from the reviewed synthetic source",
    );
  }
  const decodeValues = Array.from(
    sql.matchAll(/pg_catalog\.decode\(\s*'([^']+)'\s*,\s*'hex'\s*\)/g),
    (match) => match[1] ?? "",
  );
  const placeholders = PRIVACY_RETENTION_FIXTURE_TOKEN_NAMES_V1.map(
    (name) => fixtureTokenPlaceholders[name],
  );
  assertSameStrings(
    decodeValues,
    placeholders,
    "Privacy fixture token slots must be exact ordered placeholders",
  );
  for (const placeholder of placeholders) {
    if (countOccurrences(sql, placeholder) !== 1) {
      throw new Error("Privacy fixture token placeholders must be one-use");
    }
  }
}

function renderPrivacyBasePreflight(): string {
  const capabilities = [
    AUTHENTICATED_MIGRATION_OWNER_ROLE,
    "research_cockpit_runtime",
    "research_cockpit_test_seed",
    "research_cockpit_backup",
    PRIVACY_RETENTION_CAPABILITY_ROLE,
  ];
  return `DO $privacy_base_preflight$
DECLARE
  capability_role text;
  exact_membership_count integer;
  related_membership_count integer;
BEGIN
  IF pg_catalog.current_database() <> '${PRIVACY_RETENTION_DATABASE_NAME}'
    OR session_user <> '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
    OR current_user <> '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
    OR session_user = current_user
  THEN
    RAISE EXCEPTION 'privacy base migration identity is invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
      AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb
      AND NOT rolcreaterole AND NOT rolreplication AND NOT rolinherit
      AND NOT rolbypassrls AND rolconnlimit = 1
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_db_role_setting AS role_setting
    JOIN pg_catalog.pg_roles AS setting_role
      ON setting_role.oid = role_setting.setrole
    WHERE setting_role.rolname = '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
  ) THEN
    RAISE EXCEPTION 'privacy base migrator login is unsafe';
  END IF;
  FOREACH capability_role IN ARRAY ARRAY[${capabilities
    .map((role) => `'${role}'`)
    .join(", ")}]::text[]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = capability_role AND NOT rolcanlogin AND NOT rolsuper
        AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
        AND NOT rolinherit AND NOT rolbypassrls
    ) THEN
      RAISE EXCEPTION 'unsafe privacy capability role: %', capability_role;
    END IF;
  END LOOP;
  SELECT pg_catalog.count(*)::integer INTO exact_membership_count
  FROM pg_catalog.pg_auth_members AS membership
  JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
  JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
  WHERE granted_role.rolname = '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
    AND member_role.rolname = '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
    AND NOT membership.admin_option AND NOT membership.inherit_option
    AND membership.set_option;
  SELECT pg_catalog.count(*)::integer INTO related_membership_count
  FROM pg_catalog.pg_auth_members AS membership
  JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
  JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
  WHERE granted_role.rolname IN (${capabilities.map((role) => `'${role}'`).join(", ")})
     OR member_role.rolname IN (${capabilities.map((role) => `'${role}'`).join(", ")})
     OR granted_role.rolname = '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
     OR member_role.rolname = '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}';
  IF exact_membership_count <> 1 OR related_membership_count <> 1 THEN
    RAISE EXCEPTION 'privacy base membership graph is invalid';
  END IF;
  IF pg_catalog.to_regclass('shared_data.schema_migrations') IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = class.relnamespace
      WHERE namespace.nspname IN ('shared_data', 'private_data')
        AND class.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'privacy base migration requires a pristine application target';
  END IF;
END;
$privacy_base_preflight$;`;
}

function renderPrivacySuffixSuperuserPreflight(
  base: AuthenticatedMigrationPlan,
): string {
  const ledgerValues = expectedAuthenticatedMigrationLedgerRows(base.manifest)
    .map((row) => `('${row.migrationId}', '${row.fileName}', '${row.sha256}')`)
    .join(",\n      ");
  return `DO $privacy_suffix_superuser_preflight$
BEGIN
  IF pg_catalog.current_database() <> '${PRIVACY_RETENTION_DATABASE_NAME}'
    OR session_user <> current_user
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = current_user AND rolsuper
    )
  THEN
    RAISE EXCEPTION 'privacy suffix requires the authenticated superuser identity';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = '${PRIVACY_RETENTION_CAPABILITY_ROLE}'
      AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb
      AND NOT rolcreaterole AND NOT rolreplication AND NOT rolinherit
      AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'privacy retention capability role is unsafe';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM shared_data.schema_migrations) <> 6
    OR EXISTS (
      (VALUES
        ${ledgerValues}
      )
      EXCEPT
      SELECT migration_id, file_name, sha256::text
      FROM shared_data.schema_migrations
    )
    OR EXISTS (
      SELECT migration_id, file_name, sha256::text
      FROM shared_data.schema_migrations
      EXCEPT
      (VALUES
        ${ledgerValues}
      )
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'privacy suffix requires the exact six-row v2 ledger';
  END IF;
  IF EXISTS (SELECT 1 FROM private_data.organizations LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.principals LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.organization_principals LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.memberships LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.entitlements LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.theses LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.alert_rules LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.idempotency_records LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.audit_events LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.resource_id_registry LIMIT 1)
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'privacy-retention v1 requires empty tenant data';
  END IF;
END;
$privacy_suffix_superuser_preflight$;`;
}

function renderPrivacyTenantWriteBarrier(): string {
  return [
    "LOCK TABLE",
    privacyRetentionTenantTablesV1
      .map(
        (table, index) =>
          `  ONLY ${table}${index + 1 === privacyRetentionTenantTablesV1.length ? "" : ","}`,
      )
      .join("\n"),
    "IN SHARE ROW EXCLUSIVE MODE;",
  ].join("\n");
}

function renderRoleIdentityAssertion(
  sessionRole: string,
  marker: string,
): string {
  return `DO $privacy_role_identity$
BEGIN
  IF session_user <> '${sessionRole}'
    OR current_user <> '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
  THEN
    RAISE EXCEPTION 'privacy migration identity changed';
  END IF;
END;
$privacy_role_identity$;
SELECT '${marker}';`;
}

function renderRoleResetAssertion(sessionRole: string, marker: string): string {
  return `DO $privacy_role_reset$
BEGIN
  IF session_user <> '${sessionRole}' OR current_user <> session_user THEN
    RAISE EXCEPTION 'privacy migration role did not reset';
  END IF;
END;
$privacy_role_reset$;
SELECT '${marker}';`;
}

function renderSuperuserToOwnerIdentityAssertion(): string {
  return `DO $privacy_suffix_identity$
BEGIN
  IF current_user <> '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = session_user AND rolsuper
    )
  THEN
    RAISE EXCEPTION 'privacy suffix identity changed';
  END IF;
END;
$privacy_suffix_identity$;
SELECT '${PRIVACY_RETENTION_SUFFIX_IDENTITY_MARKER}';`;
}

function renderSuperuserRoleResetAssertion(): string {
  return `DO $privacy_suffix_role_reset$
BEGIN
  IF current_user <> session_user OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = session_user AND rolsuper
  ) THEN
    RAISE EXCEPTION 'privacy suffix role did not reset';
  END IF;
END;
$privacy_suffix_role_reset$;
SELECT '${PRIVACY_RETENTION_ROLE_RESET_MARKER}';`;
}

function stripTransaction(sql: string): string {
  const match = /^BEGIN;\r?\n([\s\S]*)\r?\nCOMMIT;(?:\r?\n)?$/.exec(sql);
  if (!match?.[1]) {
    throw new Error("Privacy platform source lacks its transaction wrapper");
  }
  return match[1];
}

function renderInjectedFailure(): string {
  return `-- deterministic B13 rollback probe; division_by_zero has SQLSTATE ${PRIVACY_RETENTION_INJECTED_FAILURE_SQLSTATE}
SELECT 1 / 0;`;
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
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort(compareText);
  const expected = [...expectedKeys].sort(compareText);
  assertSameStrings(
    actual,
    expected,
    `${label} contains missing or unexpected fields`,
  );
}

function assertSameStrings(
  actual: readonly string[],
  expected: readonly string[],
  message: string,
): void {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new Error(message);
  }
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
