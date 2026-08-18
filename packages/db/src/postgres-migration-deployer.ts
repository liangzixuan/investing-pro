import type { Client } from "pg";

import {
  AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY,
  AUTHENTICATED_MIGRATION_DATABASE_NAME,
  AUTHENTICATED_MIGRATION_OWNER_ROLE,
  snapshotAuthenticatedMigrationPlan,
  type AuthenticatedMigrationPlan,
} from "./authenticated-migration-plan";

export const POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE =
  "research_cockpit_migration_deployer_login" as const;
export const POSTGRES_MIGRATION_DEPLOYMENT_STATEMENT_TIMEOUT_MILLISECONDS =
  15_000 as const;
export const POSTGRES_MIGRATION_DEPLOYMENT_LOCK_TIMEOUT_MILLISECONDS =
  10_000 as const;

const BEGIN_SQL = "BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE";
const COMMIT_SQL = "COMMIT";
const ROLLBACK_SQL = "ROLLBACK";
const RESET_ROLE_SQL = "RESET ROLE";
const OWNER_ROLE_SQL = `SET LOCAL ROLE ${AUTHENTICATED_MIGRATION_OWNER_ROLE}`;
const TIMEOUTS_SQL = `SELECT
  pg_catalog.set_config('statement_timeout', $1::text, true),
  pg_catalog.set_config('lock_timeout', $2::text, true)`;
const ADVISORY_LOCK_SQL = "SELECT pg_catalog.pg_advisory_xact_lock($1::bigint)";
const LEDGER_LOCK_SQL =
  "LOCK TABLE ONLY shared_data.schema_migrations IN SHARE ROW EXCLUSIVE MODE";
const LEDGER_ROWS_SQL = `SELECT
  migration_id::text,
  file_name::text,
  sha256::text
FROM shared_data.schema_migrations
ORDER BY migration_id COLLATE "C"`;
const INSERT_LEDGER_ROW_SQL = `INSERT INTO shared_data.schema_migrations (
  migration_id,
  file_name,
  sha256
)
VALUES ($1::text, $2::text, $3::character(64))
RETURNING migration_id::text`;
const INJECTED_FAILURE_SQL = "SELECT 1 / 0";
const POSTGRES_TEXT_OID = 25;

const IDENTITY_PREFLIGHT_SQL = `SELECT pg_catalog.json_build_object(
  'databaseName', pg_catalog.current_database(),
  'sessionUser', session_user,
  'currentUser', current_user,
  'systemUser', system_user,
  'transactionIsolation', pg_catalog.current_setting('transaction_isolation'),
  'transactionReadOnly', pg_catalog.current_setting('transaction_read_only'),
  'loginAttributesValid', EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = '${POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE}'
      AND rolcanlogin
      AND NOT rolsuper
      AND NOT rolcreatedb
      AND NOT rolcreaterole
      AND NOT rolreplication
      AND NOT rolinherit
      AND NOT rolbypassrls
      AND rolconnlimit = 2
  ),
  'capabilityRolesValid', (
    SELECT pg_catalog.count(*) = 4
      AND pg_catalog.bool_and(
        NOT rolcanlogin
        AND NOT rolsuper
        AND NOT rolcreatedb
        AND NOT rolcreaterole
        AND NOT rolreplication
        AND NOT rolinherit
        AND NOT rolbypassrls
      )
    FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'research_cockpit_owner',
      'research_cockpit_runtime',
      'research_cockpit_test_seed',
      'research_cockpit_backup'
    )
  ),
  'roleSettingsCount', (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_db_role_setting AS role_setting
    JOIN pg_catalog.pg_roles AS setting_role
      ON setting_role.oid = role_setting.setrole
    WHERE setting_role.rolname = '${POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE}'
  ),
  'exactMembershipCount', (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS granted_role
      ON granted_role.oid = membership.roleid
    JOIN pg_catalog.pg_roles AS member_role
      ON member_role.oid = membership.member
    WHERE granted_role.rolname = '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
      AND member_role.rolname = '${POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE}'
      AND NOT membership.admin_option
      AND NOT membership.inherit_option
      AND membership.set_option
  ),
  'relatedMembershipCount', (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS granted_role
      ON granted_role.oid = membership.roleid
    JOIN pg_catalog.pg_roles AS member_role
      ON member_role.oid = membership.member
    WHERE granted_role.rolname IN (
      'research_cockpit_owner',
      'research_cockpit_runtime',
      'research_cockpit_test_seed',
      'research_cockpit_backup',
      '${POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE}'
    ) OR member_role.rolname IN (
      'research_cockpit_owner',
      'research_cockpit_runtime',
      'research_cockpit_test_seed',
      'research_cockpit_backup',
      '${POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE}'
    )
  ),
  'ownedSchemaCount', (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_namespace AS namespace
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = namespace.nspowner
    WHERE namespace.nspname IN ('shared_data', 'private_data')
      AND owner_role.rolname = '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
  ),
  'platformExtensionCount', (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_extension AS extension_row
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = extension_row.extnamespace
    WHERE extension_row.extname = 'btree_gist'
      AND namespace.nspname = 'shared_data'
  )
)::text AS migration_deployment_identity`;

const LEDGER_SHAPE_SQL = `SELECT pg_catalog.json_build_object(
  'relationValid', EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = class.relnamespace
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = class.relowner
    WHERE namespace.nspname = 'shared_data'
      AND class.relname = 'schema_migrations'
      AND class.relkind = 'r'
      AND class.relpersistence = 'p'
      AND NOT class.relrowsecurity
      AND NOT class.relforcerowsecurity
      AND owner_role.rolname = '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
  ),
  'columnsValid', (
    SELECT pg_catalog.count(*) = 5
      AND pg_catalog.bool_and(
        CASE attribute.attnum
          WHEN 1 THEN attribute.attname = 'migration_id'
            AND pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) = 'text'
            AND attribute.attnotnull
            AND NOT attribute.atthasdef
          WHEN 2 THEN attribute.attname = 'file_name'
            AND pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) = 'text'
            AND attribute.attnotnull
            AND NOT attribute.atthasdef
          WHEN 3 THEN attribute.attname = 'sha256'
            AND pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) = 'character(64)'
            AND attribute.attnotnull
            AND NOT attribute.atthasdef
          WHEN 4 THEN attribute.attname = 'applied_at'
            AND pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) = 'timestamp with time zone'
            AND attribute.attnotnull
            AND pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid) = 'transaction_timestamp()'
          WHEN 5 THEN attribute.attname = 'applied_by'
            AND pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) = 'text'
            AND attribute.attnotnull
            AND pg_catalog.lower(
              pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid)
            ) = 'session_user'
          ELSE false
        END
      )
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_class AS class
      ON class.oid = attribute.attrelid
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = class.relnamespace
    LEFT JOIN pg_catalog.pg_attrdef AS default_value
      ON default_value.adrelid = attribute.attrelid
      AND default_value.adnum = attribute.attnum
    WHERE namespace.nspname = 'shared_data'
      AND class.relname = 'schema_migrations'
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  ),
  'constraintsValid', (
    SELECT pg_catalog.count(*) = 3
      AND pg_catalog.bool_and(
        CASE constraint_row.conname
          WHEN 'schema_migrations_pkey' THEN
            constraint_row.contype = 'p'
            AND constraint_row.conkey = ARRAY[1]::smallint[]
            AND constraint_row.conindid <> 0
            AND pg_catalog.pg_get_constraintdef(constraint_row.oid, false)
              = 'PRIMARY KEY (migration_id)'
          WHEN 'schema_migrations_file_name_key' THEN
            constraint_row.contype = 'u'
            AND constraint_row.conkey = ARRAY[2]::smallint[]
            AND constraint_row.conindid <> 0
            AND pg_catalog.pg_get_constraintdef(constraint_row.oid, false)
              = 'UNIQUE (file_name)'
          WHEN 'schema_migrations_sha256_check' THEN
            constraint_row.contype = 'c'
            AND constraint_row.conkey = ARRAY[3]::smallint[]
            AND constraint_row.conindid = 0
            AND pg_catalog.pg_get_constraintdef(constraint_row.oid, false)
              IN (
                'CHECK ((sha256 ~ ''^[0-9a-f]{64}$''::text))',
                'CHECK (((sha256)::text ~ ''^[0-9a-f]{64}$''::text))'
              )
          ELSE false
        END
        AND NOT constraint_row.condeferrable
        AND NOT constraint_row.condeferred
        AND constraint_row.convalidated
        AND NOT constraint_row.connoinherit
        AND constraint_row.conparentid = 0
      )
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'shared_data.schema_migrations'::pg_catalog.regclass
  ),
  'publicPrivilegesAbsent', NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = class.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        class.relacl,
        pg_catalog.acldefault('r', class.relowner)
      )
    ) AS privilege
    WHERE namespace.nspname = 'shared_data'
      AND class.relname = 'schema_migrations'
      AND privilege.grantee = 0
  ),
  'runtimePrivilegesAbsent', NOT pg_catalog.has_table_privilege(
    'research_cockpit_runtime',
    'shared_data.schema_migrations',
    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
  )
)::text AS migration_ledger_shape`;

const IDENTITY_ASSERTION_SQL = `SELECT pg_catalog.json_build_object(
  'sessionUser', session_user,
  'currentUser', current_user
)::text AS migration_deployment_identity`;

export type PostgresMigrationClient = Pick<Client, "query">;

export type PostgresMigrationDeploymentErrorCode =
  "POSTGRES_MIGRATION_LEDGER_DRIFT" | "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE";

/** A stable, value-free failure for the complete migration boundary. */
export class PostgresMigrationDeploymentError extends Error {
  public readonly code: PostgresMigrationDeploymentErrorCode;

  public constructor(code: PostgresMigrationDeploymentErrorCode) {
    super("PostgreSQL migration deployment failed.");
    this.name = "PostgresMigrationDeploymentError";
    this.code = code;
  }
}

export interface PostgresMigrationDeploymentOptions {
  readonly injectFailure?: boolean;
}

export type PostgresMigrationDeploymentStatus = "applied" | "current";

export interface PostgresMigrationDeploymentResult {
  readonly status: PostgresMigrationDeploymentStatus;
  readonly appliedMigrationIds: readonly string[];
}

type DeployerState = "ready" | "busy" | "poisoned";

/**
 * A non-owning sequential deployer over one exclusively leased, authenticated
 * client. The caller must not share the client and remains responsible for
 * ending it. A failed rollback or an ambiguous commit poisons this instance.
 */
export class PostgresMigrationDeployer {
  readonly #client: PostgresMigrationClient;
  readonly #plan: AuthenticatedMigrationPlan;
  #state: DeployerState = "ready";

  public constructor(
    client: PostgresMigrationClient,
    plan: AuthenticatedMigrationPlan,
  ) {
    try {
      if (typeof client.query !== "function") invalid();
      this.#client = client;
      this.#plan = snapshotAuthenticatedMigrationPlan(plan);
    } catch {
      invalid();
    }
  }

  public async deploy(
    options?: PostgresMigrationDeploymentOptions,
  ): Promise<PostgresMigrationDeploymentResult> {
    if (this.#state !== "ready") invalid();
    const injectFailure = deploymentInjectFailure(options);
    this.#state = "busy";

    let transaction:
      "absent" | "begin_ambiguous" | "open" | "commit_ambiguous" = "absent";
    let clientAmbiguous = true;
    let committed = false;
    try {
      await this.#client.query(ROLLBACK_SQL);
      await this.#client.query(RESET_ROLE_SQL);
      clientAmbiguous = false;

      clientAmbiguous = true;
      transaction = "begin_ambiguous";
      await this.#client.query(BEGIN_SQL);
      clientAmbiguous = false;
      transaction = "open";

      await this.#client.query({
        text: TIMEOUTS_SQL,
        values: [
          `${POSTGRES_MIGRATION_DEPLOYMENT_STATEMENT_TIMEOUT_MILLISECONDS}ms`,
          `${POSTGRES_MIGRATION_DEPLOYMENT_LOCK_TIMEOUT_MILLISECONDS}ms`,
        ],
      });
      await this.#client.query({
        text: ADVISORY_LOCK_SQL,
        values: [AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY],
      });
      await this.#client.query(OWNER_ROLE_SQL);
      await this.#assertIdentityPreflight();

      try {
        await this.#client.query(LEDGER_LOCK_SQL);
      } catch (error) {
        const code = postgresErrorCode(error);
        if (code === "42P01" || code === "42501" || code === "42809") {
          drift();
        }
        throw error;
      }
      await this.#assertLedgerShape();
      const appliedCount = await this.#validatedAppliedPrefixLength();
      const pending = this.#plan.manifest.migrations.slice(appliedCount);
      if (injectFailure && pending.length === 0) invalid();

      for (const entry of pending) {
        const migration = this.#plan.applicationFiles.find(
          ({ file }) => file === entry.file,
        );
        if (migration === undefined) invalid();
        await this.#client.query(migration.sql);
        const inserted = await this.#client.query<
          [string],
          [string, string, string]
        >({
          text: INSERT_LEDGER_ROW_SQL,
          values: [entry.id, entry.file, entry.sha256],
          rowMode: "array",
        });
        const rows = exactQueryRows(inserted, "INSERT", ["migration_id"]);
        if (rows.length !== 1 || rows[0]?.[0] !== entry.id) invalid();
      }

      if (injectFailure) {
        await this.#client.query(INJECTED_FAILURE_SQL);
        invalid();
      }
      await this.#assertTransactionIdentity();

      transaction = "commit_ambiguous";
      await this.#client.query(COMMIT_SQL);
      transaction = "absent";
      committed = true;
      await this.#assertRoleReset();

      this.#state = "ready";
      const appliedMigrationIds = Object.freeze(pending.map(({ id }) => id));
      return Object.freeze({
        status: appliedMigrationIds.length === 0 ? "current" : "applied",
        appliedMigrationIds,
      });
    } catch (error) {
      let cleanupFailed =
        clientAmbiguous || transaction === "commit_ambiguous" || committed;
      if (
        transaction === "begin_ambiguous" ||
        transaction === "open" ||
        transaction === "commit_ambiguous"
      ) {
        try {
          await this.#client.query(ROLLBACK_SQL);
        } catch {
          cleanupFailed = true;
        }
      }
      try {
        await this.#client.query(RESET_ROLE_SQL);
      } catch {
        cleanupFailed = true;
      }
      this.#state = cleanupFailed ? "poisoned" : "ready";
      if (!cleanupFailed && error instanceof PostgresMigrationDeploymentError) {
        invalid(error.code);
      }
      invalid();
    } finally {
      if (this.#state === "busy") this.#state = "poisoned";
    }
    return invalid();
  }

  async #assertIdentityPreflight(): Promise<void> {
    const result = await this.#client.query<[string]>({
      text: IDENTITY_PREFLIGHT_SQL,
      rowMode: "array",
    });
    const actual = singleJsonRecord(result, "migration_deployment_identity");
    assertExactRecord(
      actual,
      {
        databaseName: AUTHENTICATED_MIGRATION_DATABASE_NAME,
        sessionUser: POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE,
        currentUser: AUTHENTICATED_MIGRATION_OWNER_ROLE,
        systemUser: `scram-sha-256:${POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE}`,
        transactionIsolation: "read committed",
        transactionReadOnly: "off",
        loginAttributesValid: true,
        capabilityRolesValid: true,
        roleSettingsCount: 0,
        exactMembershipCount: 1,
        relatedMembershipCount: 1,
        ownedSchemaCount: 2,
        platformExtensionCount: 1,
      },
      "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    );
  }

  async #assertLedgerShape(): Promise<void> {
    const result = await this.#client.query<[string]>({
      text: LEDGER_SHAPE_SQL,
      rowMode: "array",
    });
    const actual = singleJsonRecord(result, "migration_ledger_shape");
    try {
      assertExactRecord(
        actual,
        {
          relationValid: true,
          columnsValid: true,
          constraintsValid: true,
          publicPrivilegesAbsent: true,
          runtimePrivilegesAbsent: true,
        },
        "POSTGRES_MIGRATION_LEDGER_DRIFT",
      );
    } catch {
      drift();
    }
  }

  async #validatedAppliedPrefixLength(): Promise<number> {
    const result = await this.#client.query<[string, string, string]>({
      text: LEDGER_ROWS_SQL,
      rowMode: "array",
    });
    const rows = exactQueryRows(result, "SELECT", [
      "migration_id",
      "file_name",
      "sha256",
    ]);
    if (
      rows.length === 0 ||
      rows.length > this.#plan.manifest.migrations.length
    ) {
      drift();
    }
    for (const [index, row] of rows.entries()) {
      const expected = this.#plan.manifest.migrations[index];
      if (
        expected === undefined ||
        row.length !== 3 ||
        row[0] !== expected.id ||
        row[1] !== expected.file ||
        row[2] !== expected.sha256
      ) {
        drift();
      }
    }
    return rows.length;
  }

  async #assertTransactionIdentity(): Promise<void> {
    const result = await this.#client.query<[string]>({
      text: IDENTITY_ASSERTION_SQL,
      rowMode: "array",
    });
    assertExactRecord(
      singleJsonRecord(result, "migration_deployment_identity"),
      {
        sessionUser: POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE,
        currentUser: AUTHENTICATED_MIGRATION_OWNER_ROLE,
      },
      "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    );
  }

  async #assertRoleReset(): Promise<void> {
    const result = await this.#client.query<[string]>({
      text: IDENTITY_ASSERTION_SQL,
      rowMode: "array",
    });
    assertExactRecord(
      singleJsonRecord(result, "migration_deployment_identity"),
      {
        sessionUser: POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE,
        currentUser: POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE,
      },
      "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    );
  }
}

/**
 * Acceptance-only reconstruction of the exact v2-0005 prefix. The helper
 * derives the pre-0006 procedure from the reviewed v2-0001 bytes and refuses
 * to delete v2-0006 unless the complete ledger first matches the manifest.
 */
export function renderAuthenticatedMigrationV2PrefixFiveReconstruction(
  planValue: AuthenticatedMigrationPlan,
): string {
  let plan: AuthenticatedMigrationPlan;
  try {
    plan = snapshotAuthenticatedMigrationPlan(planValue);
  } catch {
    invalid();
  }
  const first = plan.applicationFiles[0];
  const last = plan.manifest.migrations.at(-1);
  if (
    first?.file !== "0001_request_context_and_ledger.sql" ||
    last?.id !== "v2-0006" ||
    last.file !== "0006_null_safe_request_context.sql" ||
    plan.manifest.migrations.length !== 6
  ) {
    invalid();
  }

  const procedureStartToken =
    "CREATE PROCEDURE private_data.set_request_context(";
  const procedureEndToken = "$procedure$;";
  const start = first.sql.indexOf(procedureStartToken);
  const endStart = first.sql.indexOf(procedureEndToken, start);
  if (
    start < 0 ||
    endStart < start ||
    first.sql.indexOf(procedureStartToken, start + 1) >= 0 ||
    first.sql.indexOf(procedureEndToken, endStart + 1) >= 0
  ) {
    invalid();
  }
  const previousProcedure = first.sql
    .slice(start, endStart + procedureEndToken.length)
    .replace(/^CREATE PROCEDURE/, "CREATE OR REPLACE PROCEDURE");
  if (
    !previousProcedure.includes(
      "purpose NOT IN ('display', 'derive', 'alert', 'export', 'ai')",
    ) ||
    previousProcedure.includes("purpose IS NULL") ||
    previousProcedure.includes("IS DISTINCT FROM")
  ) {
    invalid();
  }

  const manifestValues = plan.manifest.migrations
    .map(
      (entry) =>
        `(${sqlLiteral(entry.id)}, ${sqlLiteral(entry.file)}, ${sqlLiteral(entry.sha256)})`,
    )
    .join(",\n      ");

  return `BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE;
SET LOCAL statement_timeout = '${POSTGRES_MIGRATION_DEPLOYMENT_STATEMENT_TIMEOUT_MILLISECONDS}ms';
SET LOCAL lock_timeout = '${POSTGRES_MIGRATION_DEPLOYMENT_LOCK_TIMEOUT_MILLISECONDS}ms';
SELECT pg_catalog.pg_advisory_xact_lock(${AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY}::bigint);
SET LOCAL ROLE ${AUTHENTICATED_MIGRATION_OWNER_ROLE};
LOCK TABLE ONLY shared_data.schema_migrations IN SHARE ROW EXCLUSIVE MODE;
DO $b11_exact_ledger$
BEGIN
  IF EXISTS (
    (SELECT migration_id, file_name, sha256::text
     FROM shared_data.schema_migrations
     EXCEPT
     SELECT expected.migration_id, expected.file_name, expected.sha256
     FROM (VALUES
      ${manifestValues}
     ) AS expected(migration_id, file_name, sha256))
    UNION ALL
    (SELECT expected.migration_id, expected.file_name, expected.sha256
     FROM (VALUES
      ${manifestValues}
     ) AS expected(migration_id, file_name, sha256)
     EXCEPT
     SELECT migration_id, file_name, sha256::text
     FROM shared_data.schema_migrations)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'B11 prefix reconstruction requires the exact complete ledger';
  END IF;
END;
$b11_exact_ledger$;
${previousProcedure}
DO $b11_delete_last_ledger_row$
DECLARE
  deleted_rows bigint;
BEGIN
  DELETE FROM shared_data.schema_migrations
  WHERE migration_id = ${sqlLiteral(last.id)}
    AND file_name = ${sqlLiteral(last.file)}
    AND sha256 = ${sqlLiteral(last.sha256)};
  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  IF deleted_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'B11 prefix reconstruction did not delete one ledger row';
  END IF;
END;
$b11_delete_last_ledger_row$;
COMMIT;
`;
}

function deploymentInjectFailure(
  options: PostgresMigrationDeploymentOptions | undefined,
): boolean {
  if (options === undefined) return false;
  try {
    const record = exactDataRecord(options, ["injectFailure"], true);
    const value = record.injectFailure;
    if (value !== undefined && typeof value !== "boolean") invalid();
    return value ?? false;
  } catch (error) {
    if (error instanceof PostgresMigrationDeploymentError) throw error;
    invalid();
  }
}

function singleJsonRecord(result: unknown, fieldName: string): object {
  const rows = exactQueryRows(result, "SELECT", [fieldName]);
  if (rows.length !== 1 || rows[0]?.length !== 1) invalid();
  const value = rows[0][0];
  if (typeof value !== "string") invalid();
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      invalid();
    }
    return parsed;
  } catch (error) {
    if (error instanceof PostgresMigrationDeploymentError) throw error;
    invalid();
  }
}

function assertExactRecord(
  actual: object,
  expected: Readonly<Record<string, unknown>>,
  code: PostgresMigrationDeploymentErrorCode,
): void {
  const actualRecord = exactDataRecord(actual, Object.keys(expected));
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (actualRecord[key] !== expectedValue) invalid(code);
  }
}

function exactQueryRows(
  result: unknown,
  expectedCommand: "SELECT" | "INSERT",
  expectedFieldNames: readonly string[],
): readonly (readonly unknown[])[] {
  const record = exactDataRecord(
    result,
    ["command", "rowCount", "oid", "rows", "fields"],
    true,
    true,
  );
  const rows = denseArray(record.rows).map((row) => denseArray(row));
  const fields = denseArray(record.fields);
  if (
    record.command !== expectedCommand ||
    record.rowCount !== rows.length ||
    fields.length !== expectedFieldNames.length
  ) {
    invalid();
  }
  for (const [index, field] of fields.entries()) {
    if (
      ownDataField(field, "name") !== expectedFieldNames[index] ||
      ownDataField(field, "dataTypeID") !== POSTGRES_TEXT_OID
    ) {
      invalid();
    }
  }
  if (rows.some((row) => row.length !== expectedFieldNames.length)) invalid();
  return rows;
}

function exactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
  allowExtra = false,
  allowNonPlainPrototype = false,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid();
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (
    !allowNonPlainPrototype &&
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    invalid();
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== "string") ||
    (!allowExtra &&
      (keys.length !== expectedKeys.length ||
        keys.some((key) => !expectedKeys.includes(key as string))))
  ) {
    invalid();
  }
  const output: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    output[key] = optionalOwnDataField(value, key);
  }
  return output;
}

function denseArray(value: unknown): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    invalid();
  }
  const length = value.length;
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    Reflect.ownKeys(value).length !== length + 1
  ) {
    invalid();
  }
  const output: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    output.push(ownDataField(value, String(index)));
  }
  return output;
}

function ownDataField(value: unknown, key: PropertyKey): unknown {
  const result = optionalOwnDataField(value, key);
  if (result === undefined) invalid();
  return result;
}

function optionalOwnDataField(value: unknown, key: PropertyKey): unknown {
  if (
    (typeof value !== "object" && typeof value !== "function") ||
    value === null
  ) {
    invalid();
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) return undefined;
  if (!("value" in descriptor) || !descriptor.enumerable) invalid();
  return descriptor.value;
}

function postgresErrorCode(error: unknown): string | null {
  try {
    const code = optionalOwnDataField(error, "code");
    return typeof code === "string" ? code : null;
  } catch {
    return null;
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function drift(): never {
  return invalid("POSTGRES_MIGRATION_LEDGER_DRIFT");
}

function invalid(
  code: PostgresMigrationDeploymentErrorCode = "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
): never {
  throw new PostgresMigrationDeploymentError(code);
}
