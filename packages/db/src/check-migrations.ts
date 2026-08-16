import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface MigrationFile {
  file: string;
  sql: string;
}

interface MigrationManifest {
  schemaVersion: number;
  algorithm: string;
  migrations: Array<{
    id: string;
    file: string;
    sha256: string;
  }>;
}

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = join(packageRoot, "migrations");

const protectedTables = [
  "private_data.organizations",
  "private_data.principals",
  "private_data.organization_principals",
  "private_data.memberships",
  "private_data.entitlements",
  "private_data.resource_id_registry",
  "private_data.theses",
  "private_data.alert_rules",
  "private_data.idempotency_records",
  "private_data.audit_events",
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
] as const;

const tenantCompositeTables = [
  "private_data.organization_principals",
  "private_data.memberships",
  "private_data.entitlements",
  "private_data.resource_id_registry",
  "private_data.theses",
  "private_data.alert_rules",
  "private_data.idempotency_records",
  "private_data.audit_events",
] as const;

const writePolicyTables = [
  "private_data.resource_id_registry",
  "private_data.theses",
  "private_data.alert_rules",
  "private_data.idempotency_records",
  "private_data.audit_events",
] as const;

export async function loadMigrationFiles(
  directory = migrationsDirectory,
): Promise<MigrationFile[]> {
  const names = (await readdir(directory))
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  return Promise.all(
    names.map(async (file) => ({
      file,
      sql: await readFile(join(directory, file), "utf8"),
    })),
  );
}

export async function checkMigrations(root = packageRoot): Promise<string[]> {
  const directory = join(root, "migrations");
  const files = await loadMigrationFiles(directory);
  const manifest = parseManifest(
    JSON.parse(
      await readFile(join(root, "migration-manifest.json"), "utf8"),
    ) as unknown,
  );
  const readme = await readFile(join(root, "README.md"), "utf8");
  return [
    ...validateManifest(manifest, files),
    ...inspectSqlBundle(files),
    ...inspectStaticContractNotice(readme),
  ];
}

export function inspectSqlBundle(files: MigrationFile[]): string[] {
  const violations: string[] = [];
  const combined = files.map(({ sql }) => sql).join("\n");

  for (const migration of files) {
    const normalized = migration.sql.trim();
    if (!/^BEGIN;/i.test(normalized) || !/COMMIT;$/i.test(normalized)) {
      violations.push(
        `${migration.file}: migration must be transaction wrapped`,
      );
    }
    violations.push(
      ...detectProhibitedSql(migration.sql).map(
        (message) => `${migration.file}: ${message}`,
      ),
    );
  }

  requirePattern(
    combined,
    /CREATE\s+SCHEMA\s+shared_data\s*;/i,
    "shared_data schema is required",
    violations,
  );
  inspectCapabilityRoles(combined, violations);
  inspectRuntimeReadOnly(combined, violations);
  inspectPolicyRoles(combined, violations);
  requirePattern(
    combined,
    /CREATE\s+SCHEMA\s+private_data\s*;/i,
    "private_data schema is required",
    violations,
  );
  requirePattern(
    combined,
    /CREATE\s+TABLE\s+shared_data\.schema_migrations\s*\(/i,
    "migration ledger is required",
    violations,
  );
  requirePattern(
    combined,
    /REVOKE\s+ALL\s+ON\s+SCHEMA\s+public\s+FROM\s+PUBLIC\s*;/i,
    "PUBLIC must lose CREATE/USAGE on the public schema",
    violations,
  );
  requirePattern(
    combined,
    /REVOKE\s+CREATE\s*,\s*TEMPORARY\s+ON\s+DATABASE\s+%I\s+FROM\s+PUBLIC/i,
    "PUBLIC must lose database CREATE and TEMPORARY privileges",
    violations,
  );
  requirePattern(
    combined,
    /REVOKE\s+ALL\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+shared_data\s+FROM\s+PUBLIC\s*;/i,
    "PUBLIC must lose extension-routine execution in shared_data",
    violations,
  );
  requirePattern(
    combined,
    /CREATE\s+ROLE\s+research_cockpit_runtime[\s\S]*?NOBYPASSRLS\s*;/i,
    "runtime role must be explicitly NOBYPASSRLS",
    violations,
  );

  for (const setting of [
    "principal_id",
    "organization_id",
    "purpose",
    "channel",
    "territory",
    "data_classification",
  ]) {
    const pattern = new RegExp(
      `set_config\\(\\s*'app\\.${setting}'\\s*,[^,]+,\\s*true\\s*\\)`,
      "i",
    );
    requirePattern(
      combined,
      pattern,
      `request context app.${setting} must be transaction-local`,
      violations,
    );
    const sessionWidePattern = new RegExp(
      `set_config\\(\\s*'app\\.${setting}'\\s*,[^,]+,\\s*false\\s*\\)`,
      "i",
    );
    if (sessionWidePattern.test(combined)) {
      violations.push(
        `request context app.${setting} must be transaction-local`,
      );
    }
  }

  for (const table of protectedTables) {
    requirePattern(
      combined,
      new RegExp(
        `ALTER\\s+TABLE\\s+${escapeRegExp(table)}\\s+OWNER\\s+TO\\s+research_cockpit_owner\\s*;`,
        "i",
      ),
      `${table} must be owned by the NOLOGIN owner role`,
      violations,
    );
    requirePattern(
      combined,
      new RegExp(
        `ALTER\\s+TABLE\\s+${escapeRegExp(table)}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY\\s*;`,
        "i",
      ),
      `${table} must ENABLE ROW LEVEL SECURITY`,
      violations,
    );
    requirePattern(
      combined,
      new RegExp(
        `ALTER\\s+TABLE\\s+${escapeRegExp(table)}\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY\\s*;`,
        "i",
      ),
      `${table} must FORCE ROW LEVEL SECURITY`,
      violations,
    );
    requirePattern(
      combined,
      new RegExp(
        `CREATE\\s+POLICY[\\s\\S]{0,500}?ON\\s+${escapeRegExp(table)}\\b`,
        "i",
      ),
      `${table} needs at least one RLS policy`,
      violations,
    );
  }

  for (const table of tenantCompositeTables) {
    const body = extractCreateTable(combined, table);
    if (!body) {
      violations.push(`${table} CREATE TABLE body was not found`);
      continue;
    }
    if (!/organization_id\s+uuid\s+NOT\s+NULL/i.test(body)) {
      violations.push(`${table} needs a non-null organization_id`);
    }
    if (!/PRIMARY\s+KEY\s*\([\s\S]*?organization_id/i.test(body)) {
      violations.push(`${table} primary key must begin with tenant identity`);
    }
  }

  for (const table of writePolicyTables) {
    const policyPattern = new RegExp(
      `CREATE\\s+POLICY[\\s\\S]{0,1400}?ON\\s+${escapeRegExp(table)}[\\s\\S]{0,1400}?WITH\\s+CHECK\\s*\\(`,
      "i",
    );
    requirePattern(
      combined,
      policyPattern,
      `${table} write policy needs WITH CHECK`,
      violations,
    );
  }

  inspectExactRightsVersion(combined, "shared_data.evidence", violations);
  inspectExactRightsVersion(
    combined,
    "shared_data.financial_facts",
    violations,
  );
  inspectTenantPrincipalAssociations(combined, violations);
  inspectActivePrincipalMembership(combined, violations);
  inspectPrivateRuntimeReadGuards(combined, violations);
  inspectFactNumerics(combined, violations);
  inspectFactTimeSemantics(combined, violations);
  inspectHalfOpenTime(combined, violations);
  inspectIdempotencyFingerprint(combined, violations);
  inspectHardDeleteContract(combined, violations);
  inspectNonReusableResourceIds(combined, violations);
  inspectApplicationContractBounds(combined, violations);
  inspectAuditTable(combined, violations);

  return violations;
}

export function detectProhibitedSql(sql: string): string[] {
  const checks: Array<[RegExp, string]> = [
    [
      /\bDROP\s+(?:TABLE|SCHEMA|DATABASE|ROLE|TRIGGER|FUNCTION|POLICY)\b/i,
      "destructive DROP is prohibited",
    ],
    [
      /\bALTER\s+TABLE\b[^;]*\bDROP\s+(?:CONSTRAINT|COLUMN)\b/i,
      "destructive constraint or column removal is prohibited",
    ],
    [/\bTRUNCATE\b/i, "TRUNCATE is prohibited"],
    [/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i, "RLS may not be disabled"],
    [/\bDISABLE\s+TRIGGER\b/i, "triggers may not be disabled"],
    [
      /\bCREATE\s+TRIGGER\b[^;]*\bWHEN\s*\(/i,
      "conditional triggers are prohibited in this harness",
    ],
    [
      /\bSECURITY\s+DEFINER\b/i,
      "SECURITY DEFINER is prohibited in this harness",
    ],
    [
      /\bCREATE\s+(?:TEMP|TEMPORARY|UNLOGGED)\s+TABLE\b/i,
      "non-durable tables are prohibited",
    ],
    [
      /\bCREATE\s+(?:(?:OR\s+REPLACE|MATERIALIZED)\s+)?VIEW\b|\bCREATE\s+FOREIGN\s+TABLE\b|\bCREATE\s+SEQUENCE\b/i,
      "unreviewed relation types are prohibited",
    ],
    [
      /\bCREATE\s+SCHEMA\s+(?!shared_data\b|private_data\b)[a-z_][a-z0-9_]*\b/i,
      "unreviewed schema creation is prohibited",
    ],
    [/\bGRANT\b[^;]*\bTO\s+PUBLIC\b/i, "grants to PUBLIC are prohibited"],
    [/\bWITH\s+GRANT\s+OPTION\b/i, "grant options are prohibited"],
    [
      /\bGRANT\b[^;]*\b(?:CREATE|TEMPORARY|TEMP|ALL(?:\s+PRIVILEGES)?)\b[^;]*\bON\s+(?:SCHEMA|DATABASE)\b[^;]*\bTO\s+research_cockpit_(?:owner|runtime|test_seed|backup)\b/i,
      "capability roles may not receive schema or database creation privileges",
    ],
    [
      /\bGRANT\s+(?![^;]*\bON\b)[^;]+\bTO\s+research_cockpit_(?:owner|runtime|test_seed|backup)\b/i,
      "capability-role chaining is prohibited",
    ],
    [
      /\bALTER\s+ROLE\s+research_cockpit_(?:owner|runtime|test_seed|backup)[^;]*\b(?:LOGIN|SUPERUSER|CREATEDB|CREATEROLE|REPLICATION|INHERIT|BYPASSRLS)\b/i,
      "capability-role privilege escalation is prohibited",
    ],
    [
      /\bCREATE\s+ROLE\s+(?!research_cockpit_(?:owner|runtime|test_seed|backup)\b)[a-z_][a-z0-9_]*\b/i,
      "unreviewed role creation is prohibited",
    ],
  ];
  const violations = checks.flatMap(([pattern, message]) =>
    pattern.test(sql) ? [message] : [],
  );
  const reviewedContextReplacement =
    /\bCREATE\s+OR\s+REPLACE\s+PROCEDURE\s+private_data\.set_request_context\s*\(/gi;
  const replacementCount = [...sql.matchAll(reviewedContextReplacement)].length;
  const unreviewedReplacements = sql.replace(
    reviewedContextReplacement,
    "CREATE PROCEDURE private_data.set_request_context(",
  );
  if (/\bCREATE\s+OR\s+REPLACE\b/i.test(unreviewedReplacements)) {
    violations.push("forward migrations may not replace unreviewed objects");
  }
  if (replacementCount > 1) {
    violations.push("request-context replacement may appear only once");
  }
  return violations;
}

export function inspectStaticContractNotice(readme: string): string[] {
  const violations: string[] = [];
  for (const required of [
    /CLEAN-ONLY LIVE ACCEPTANCE PASSED/i,
    /NOT DEPLOYED PERSISTENCE/i,
    /authenticated bootstrap\/migrator account is external/i,
    /do not grant any capability role to any other role/i,
    /Mandatory live PostgreSQL gates/i,
  ]) {
    if (!required.test(readme))
      violations.push(`README is missing required warning ${required}`);
  }
  return violations;
}

function validateManifest(
  manifest: MigrationManifest,
  files: MigrationFile[],
): string[] {
  const violations: string[] = [];
  if (manifest.schemaVersion !== 1)
    violations.push("manifest schemaVersion must equal 1");
  if (manifest.algorithm !== "sha256")
    violations.push("manifest algorithm must be sha256");

  const manifestFiles = manifest.migrations.map((migration) => migration.file);
  const diskFiles = files.map((migration) => migration.file);
  if (JSON.stringify(manifestFiles) !== JSON.stringify(diskFiles)) {
    violations.push("manifest files must exactly match sorted migration files");
  }

  const ids = manifest.migrations.map((migration) => migration.id);
  if (new Set(ids).size !== ids.length)
    violations.push("manifest migration IDs must be unique");
  if (JSON.stringify(ids) !== JSON.stringify([...ids].sort()))
    violations.push("manifest migration IDs must be ordered");

  const fileByName = new Map(
    files.map((migration) => [migration.file, migration.sql]),
  );
  for (const migration of manifest.migrations) {
    if (!/^\d{4}$/.test(migration.id))
      violations.push(`${migration.file}: migration ID must be four digits`);
    if (!migration.file.startsWith(`${migration.id}_`))
      violations.push(
        `${migration.file}: file must start with its migration ID`,
      );
    if (!/^[0-9a-f]{64}$/.test(migration.sha256)) {
      violations.push(`${migration.file}: manifest hash is not SHA-256 hex`);
      continue;
    }
    const sql = fileByName.get(migration.file);
    if (sql === undefined) continue;
    const actual = createHash("sha256").update(sql).digest("hex");
    if (actual !== migration.sha256)
      violations.push(
        `${migration.file}: checksum differs from immutable manifest`,
      );
  }
  return violations;
}

function parseManifest(value: unknown): MigrationManifest {
  if (!isRecord(value)) throw new Error("migration manifest must be an object");
  if (!Array.isArray(value.migrations))
    throw new Error("migration manifest needs a migrations array");
  const migrations = value.migrations.map((entry, index) => {
    if (!isRecord(entry))
      throw new Error(`manifest migration ${index} must be an object`);
    if (
      typeof entry.id !== "string" ||
      typeof entry.file !== "string" ||
      typeof entry.sha256 !== "string"
    ) {
      throw new Error(`manifest migration ${index} is malformed`);
    }
    return { id: entry.id, file: entry.file, sha256: entry.sha256 };
  });
  return {
    schemaVersion:
      typeof value.schemaVersion === "number" ? value.schemaVersion : -1,
    algorithm: typeof value.algorithm === "string" ? value.algorithm : "",
    migrations,
  };
}

function inspectExactRightsVersion(
  sql: string,
  table: string,
  violations: string[],
): void {
  const body = extractCreateTable(sql, table);
  if (!body) {
    violations.push(`${table} CREATE TABLE body was not found`);
    return;
  }
  if (!/rights_policy_id\s+text\s+NOT\s+NULL/i.test(body))
    violations.push(`${table} must freeze rights_policy_id`);
  if (!/rights_policy_version\s+text\s+NOT\s+NULL/i.test(body))
    violations.push(`${table} must freeze rights_policy_version`);
  if (
    !/FOREIGN\s+KEY\s*\(\s*rights_policy_id\s*,\s*rights_policy_version\s*\)/i.test(
      body,
    ) &&
    !/FOREIGN\s+KEY\s*\(\s*evidence_id\s*,\s*rights_policy_id\s*,\s*rights_policy_version\s*\)/i.test(
      body,
    )
  ) {
    violations.push(`${table} must reference an exact rights-policy version`);
  }
}

function inspectCapabilityRoles(sql: string, violations: string[]): void {
  for (const role of ["owner", "runtime", "test_seed", "backup"] as const) {
    const name = `research_cockpit_${role}`;
    const statement = new RegExp(`CREATE\\s+ROLE\\s+${name}([^;]*);`, "i").exec(
      sql,
    )?.[1];
    if (!statement) {
      violations.push(`${name} capability role must be declared`);
      continue;
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
      if (!new RegExp(`\\b${attribute}\\b`, "i").test(statement))
        violations.push(`${name} must declare ${attribute}`);
    }
    const unsafeExistingRoleGuard = new RegExp(
      `IF\\s+EXISTS\\s*\\([\\s\\S]{0,900}?rolname\\s*=\\s*'${name}'[\\s\\S]{0,900}?rolcanlogin[\\s\\S]{0,200}?rolsuper[\\s\\S]{0,200}?rolcreatedb[\\s\\S]{0,200}?rolcreaterole[\\s\\S]{0,200}?rolreplication[\\s\\S]{0,200}?rolinherit[\\s\\S]{0,200}?rolbypassrls[\\s\\S]{0,300}?RAISE\\s+EXCEPTION\\s+'unsafe pre-existing capability role: ${name}'`,
      "i",
    );
    if (!unsafeExistingRoleGuard.test(sql))
      violations.push(`${name} must reject an unsafe pre-existing role`);
    const unsafeMembershipGuard = new RegExp(
      `IF\\s+EXISTS\\s*\\([\\s\\S]{0,300}?FROM\\s+pg_catalog\\.pg_auth_members\\s+AS\\s+membership[\\s\\S]{0,350}?granted_role\\.oid\\s*=\\s*membership\\.roleid[\\s\\S]{0,350}?member_role\\.oid\\s*=\\s*membership\\.member[\\s\\S]{0,250}?granted_role\\.rolname\\s*=\\s*'${name}'[\\s\\S]{0,120}?OR\\s+member_role\\.rolname\\s*=\\s*'${name}'[\\s\\S]{0,250}?RAISE\\s+EXCEPTION\\s+'unsafe pre-existing capability role membership: ${name}'`,
      "i",
    );
    if (!unsafeMembershipGuard.test(sql)) {
      violations.push(
        `${name} must reject inbound and outbound role memberships`,
      );
    }
  }
  requirePattern(
    sql,
    /DO\s+\$role\$[\s\S]*?END;\s*\$role\$;/i,
    "capability-role bootstrap must be a terminated PL/pgSQL block",
    violations,
  );
  requirePattern(
    sql,
    /ALTER\s+SCHEMA\s+shared_data\s+OWNER\s+TO\s+research_cockpit_owner\s*;/i,
    "shared_data schema must be owned by the NOLOGIN owner role",
    violations,
  );
  requirePattern(
    sql,
    /ALTER\s+SCHEMA\s+private_data\s+OWNER\s+TO\s+research_cockpit_owner\s*;/i,
    "private_data schema must be owned by the NOLOGIN owner role",
    violations,
  );
  for (const schema of ["shared_data", "private_data"]) {
    requirePattern(
      sql,
      new RegExp(
        `ALTER\\s+DEFAULT\\s+PRIVILEGES\\s+FOR\\s+ROLE\\s+research_cockpit_owner\\s+IN\\s+SCHEMA\\s+${schema}[\\s\\S]{0,120}?REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTIONS\\s+FROM\\s+PUBLIC\\s*;`,
        "i",
      ),
      `${schema} owner defaults must revoke PUBLIC function execution`,
      violations,
    );
  }
  requirePattern(
    sql,
    /GRANT\s+SELECT\s*,\s*INSERT\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+private_data\s+TO\s+research_cockpit_test_seed\s*;/i,
    "test-seed capability must be limited to synthetic SELECT/INSERT",
    violations,
  );
  requirePattern(
    sql,
    /REVOKE\s+ALL\s+ON\s+TABLE\s+shared_data\.schema_migrations\s+FROM\s+research_cockpit_test_seed\s*;/i,
    "test-seed capability must not touch the migration ledger",
    violations,
  );
  requirePattern(
    sql,
    /GRANT\s+SELECT\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+private_data\s+TO\s+research_cockpit_backup\s*;/i,
    "backup capability must remain SELECT-only",
    violations,
  );
  requirePattern(
    sql,
    /CREATE\s+PROCEDURE\s+private_data\.set_request_context\([\s\S]*?AS\s+\$procedure\$[\s\S]*?END;\s*\$procedure\$;/i,
    "request-context procedure must be a terminated PL/pgSQL block",
    violations,
  );
  for (const [pattern, message] of [
    [
      /\bpurpose\s+IS\s+NULL\s+OR\s+purpose\s+NOT\s+IN\s*\(/i,
      "request context must reject a null purpose",
    ],
    [
      /\bchannel\s+IS\s+NULL\s+OR\s+channel\s+NOT\s+IN\s*\(/i,
      "request context must reject a null channel",
    ],
    [
      /\bterritory\s+IS\s+DISTINCT\s+FROM\s+'demo_only'/i,
      "request context must reject a null or foreign territory",
    ],
    [
      /\bdata_classification\s+IS\s+DISTINCT\s+FROM\s+'synthetic'/i,
      "request context must reject a null or foreign classification",
    ],
  ] as const) {
    requirePattern(sql, pattern, message, violations);
  }
}

function inspectRuntimeReadOnly(sql: string, violations: string[]): void {
  const grants = sql.matchAll(
    /\bGRANT\s+([^;]*?)\s+ON\s+[^;]*?\s+TO\s+research_cockpit_runtime\s*;/gi,
  );
  for (const grant of grants) {
    const privileges = grant[1] ?? "";
    if (
      /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|ALL(?:\s+PRIVILEGES)?)\b/i.test(
        privileges,
      )
    ) {
      violations.push(
        `research_cockpit_runtime must remain read-only; rejected GRANT ${privileges.trim()}`,
      );
    }
  }
  requirePattern(
    sql,
    /GRANT\s+SELECT\s+ON\s+shared_data\.financial_facts\s+TO\s+research_cockpit_runtime\s*;/i,
    "runtime needs explicit SELECT-only access to rights-filtered facts",
    violations,
  );
}

function inspectPolicyRoles(sql: string, violations: string[]): void {
  for (const match of sql.matchAll(
    /CREATE\s+POLICY\s+([a-z][a-z0-9_]*)[\s\S]*?;/gi,
  )) {
    const policyName = match[1] ?? "unnamed_policy";
    const statement = match[0];
    const expectedRole = policyName.startsWith("test_seed_")
      ? "research_cockpit_test_seed"
      : policyName.startsWith("backup_read_")
        ? "research_cockpit_backup"
        : "research_cockpit_runtime";
    const exactTarget = new RegExp(
      `\\bFOR\\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)\\s+TO\\s+${expectedRole}\\s+(?:USING|WITH\\s+CHECK)\\s*\\(`,
      "i",
    );
    if (!exactTarget.test(statement)) {
      violations.push(`${policyName} policy must target only ${expectedRole}`);
    }
  }
}

function inspectTenantPrincipalAssociations(
  sql: string,
  violations: string[],
): void {
  const association = extractCreateTable(
    sql,
    "private_data.organization_principals",
  );
  if (!association) {
    violations.push(
      "private_data.organization_principals stable association is required",
    );
    return;
  }
  if (
    !/PRIMARY\s+KEY\s*\(\s*organization_id\s*,\s*principal_id\s*\)/i.test(
      association,
    )
  ) {
    violations.push(
      "organization_principals must key (organization_id, principal_id)",
    );
  }

  for (const [table, principalColumn, label] of [
    ["private_data.memberships", "principal_id", "membership principal"],
    ["private_data.entitlements", "principal_id", "entitlement principal"],
    ["private_data.theses", "created_by", "thesis creator"],
    ["private_data.theses", "updated_by", "thesis updater"],
    ["private_data.alert_rules", "created_by", "alert creator"],
    ["private_data.alert_rules", "updated_by", "alert updater"],
    [
      "private_data.idempotency_records",
      "principal_id",
      "idempotency principal",
    ],
    ["private_data.audit_events", "principal_id", "audit principal"],
  ] as const) {
    const body = extractCreateTable(sql, table);
    if (!body) continue;
    const pattern = new RegExp(
      `FOREIGN\\s+KEY\\s*\\(\\s*organization_id\\s*,\\s*${principalColumn}\\s*\\)\\s*REFERENCES\\s+private_data\\.organization_principals\\s*\\(\\s*organization_id\\s*,\\s*principal_id\\s*\\)`,
      "i",
    );
    if (!pattern.test(body))
      violations.push(`${label} needs a tenant-composite association FK`);
  }

  const entitlement = extractCreateTable(sql, "private_data.entitlements");
  if (
    entitlement &&
    !/REFERENCES\s+private_data\.organization_principals\s*\([\s\S]*?\)\s+MATCH\s+SIMPLE/i.test(
      entitlement,
    )
  ) {
    violations.push(
      "nullable entitlement principal association must use MATCH SIMPLE",
    );
  }
}

function inspectActivePrincipalMembership(
  sql: string,
  violations: string[],
): void {
  const helper =
    /CREATE\s+FUNCTION\s+private_data\.has_active_membership\([\s\S]*?AS\s+\$function\$([\s\S]*?)\$function\$;/i.exec(
      sql,
    )?.[1];
  if (
    !helper ||
    !/JOIN\s+private_data\.principals\s+AS\s+principal\s+ON\s+principal\.id\s*=\s*membership\.principal_id/i.test(
      helper,
    ) ||
    !/principal\.active/i.test(helper) ||
    !/principal\.data_classification\s*=\s*'synthetic'/i.test(helper)
  ) {
    violations.push(
      "active membership authorization must require an active synthetic principal",
    );
  }
}

function inspectPrivateRuntimeReadGuards(
  sql: string,
  violations: string[],
): void {
  const principals = extractCreatePolicy(sql, "principals_read_self");
  if (
    !principals ||
    !/id\s*=\s*private_data\.current_principal_id\(\)/i.test(principals) ||
    !/\bactive\b/i.test(principals) ||
    !/data_classification\s*=\s*'synthetic'/i.test(principals)
  ) {
    violations.push(
      "principals_read_self must require the current active synthetic principal",
    );
  }

  const memberships = extractCreatePolicy(sql, "memberships_read_self");
  if (
    !memberships ||
    !/active_from\s*<=\s*transaction_timestamp\(\)/i.test(memberships) ||
    !/active_to\s+IS\s+NULL[\s\S]{0,100}?transaction_timestamp\(\)\s*<\s*active_to/i.test(
      memberships,
    )
  ) {
    violations.push(
      "memberships_read_self must require a current half-open membership window",
    );
  }
  if (
    !memberships ||
    !/FROM\s+private_data\.principals\s+AS\s+current_principal[\s\S]{0,220}?current_principal\.id\s*=\s*private_data\.current_principal_id\(\)[\s\S]{0,120}?current_principal\.active[\s\S]{0,150}?current_principal\.data_classification\s*=\s*'synthetic'/i.test(
      memberships,
    )
  ) {
    violations.push(
      "memberships_read_self must require an active synthetic current principal",
    );
  }

  const associations = extractCreatePolicy(
    sql,
    "organization_principals_read_self",
  );
  if (
    !associations ||
    !/FROM\s+private_data\.memberships\s+AS\s+active_membership[\s\S]{0,220}?active_membership\.organization_id\s*=\s*organization_principals\.organization_id[\s\S]{0,180}?active_membership\.principal_id\s*=\s*organization_principals\.principal_id[\s\S]{0,180}?active_membership\.active_from\s*<=\s*transaction_timestamp\(\)[\s\S]{0,180}?transaction_timestamp\(\)\s*<\s*active_membership\.active_to[\s\S]{0,180}?active_membership\.data_classification\s*=\s*'synthetic'/i.test(
      associations,
    )
  ) {
    violations.push(
      "organization_principals_read_self must require the current active membership",
    );
  }

  for (const [policyName, table] of [
    ["organizations_read_member", "private_data.organizations"],
    ["entitlements_read_current", "private_data.entitlements"],
    ["theses_read_current_organization", "private_data.theses"],
    ["alert_rules_read_current_organization", "private_data.alert_rules"],
    ["idempotency_read_own", "private_data.idempotency_records"],
    [
      "resource_id_registry_read_current_organization",
      "private_data.resource_id_registry",
    ],
  ] as const) {
    const policy = extractCreatePolicy(sql, policyName);
    if (!policy || !/private_data\.has_active_membership\s*\(/i.test(policy)) {
      violations.push(
        `${table} runtime reads must require active membership authorization`,
      );
    }
  }
}

function inspectFactNumerics(sql: string, violations: string[]): void {
  const body = extractCreateTable(sql, "shared_data.financial_facts");
  if (!body) return;
  if (
    !/value_numeric\s+numeric\s*\(\s*38\s*,\s*12\s*\)\s+NOT\s+NULL/i.test(body)
  )
    violations.push("financial facts require fixed numeric(38,12) values");
  if (!/value_scale\s+smallint\s+NOT\s+NULL/i.test(body))
    violations.push("financial facts require explicit output scale");
  if (/\b(?:real|float|double\s+precision)\b/i.test(body))
    violations.push("financial facts may not use floating-point SQL types");
}

function inspectFactTimeSemantics(sql: string, violations: string[]): void {
  const body = extractCreateTable(sql, "shared_data.financial_facts");
  if (!body) return;
  if (/\beffective_(?:from|to)\b/i.test(body))
    violations.push(
      "financial facts may not use the ambiguous effective interval name",
    );
  for (const field of [
    "period_end date NOT NULL",
    "known_from timestamptz NOT NULL",
    "known_to timestamptz",
    "system_from timestamptz NOT NULL",
    "system_to timestamptz",
    "available_at timestamptz NOT NULL",
  ]) {
    if (!body.toLowerCase().includes(field.toLowerCase()))
      violations.push(`financial facts require ${field}`);
  }
  if (!/available_at\s*<=\s*known_from/i.test(body))
    violations.push("financial facts require available_at <= known_from");
  if (!/known_from\s*<=\s*system_from/i.test(body))
    violations.push("financial facts require known_from <= system_from");
  requirePattern(
    sql,
    /ALTER\s+TABLE\s+shared_data\.financial_facts[\s\S]{0,500}?ADD\s+COLUMN\s+known_window\s+tstzrange[\s\S]{0,200}?tstzrange\(known_from,\s*known_to,\s*'\[\)'\)/i,
    "financial facts require a half-open public-known range",
    violations,
  );
}

function inspectHalfOpenTime(sql: string, violations: string[]): void {
  const halfOpenRanges = sql.match(/tstzrange\([^)]*'\[\)'\)/gi)?.length ?? 0;
  if (halfOpenRanges < 6)
    violations.push(
      "temporal schema must define all important ranges as half-open [from,to)",
    );
  for (const pair of [
    ["effective_to", "effective_from"],
    ["system_to", "system_from"],
    ["known_to", "known_from"],
    ["active_to", "active_from"],
  ] as const) {
    const pattern = new RegExp(
      `${pair[0]}\\s+IS\\s+NULL\\s+OR\\s+${pair[0]}\\s*>\\s*${pair[1]}`,
      "i",
    );
    requirePattern(
      sql,
      pattern,
      `${pair[0]}/${pair[1]} requires a strict half-open interval check`,
      violations,
    );
  }
}

function inspectIdempotencyFingerprint(
  sql: string,
  violations: string[],
): void {
  const body = extractCreateTable(sql, "private_data.idempotency_records");
  if (!body) return;
  if (
    !/request_fingerprint\s+text\s+NOT\s+NULL\s+CHECK\s*\(\s*request_fingerprint\s*~\s*'\^sha256:\[0-9a-f\]\{64\}\$'/i.test(
      body,
    )
  ) {
    violations.push(
      "idempotency fingerprint must use sha256:<64 lowercase hex>",
    );
  }
}

function inspectHardDeleteContract(sql: string, violations: string[]): void {
  if (/\bdeleted_at\b/i.test(sql))
    violations.push(
      "thesis and alert persistence must use the hard-delete contract without deleted_at",
    );
}

function inspectNonReusableResourceIds(
  sql: string,
  violations: string[],
): void {
  const table = "private_data.resource_id_registry";
  const body = extractCreateTable(sql, table);
  if (!body) {
    violations.push(`${table} payload-free tombstone registry is required`);
    return;
  }

  if (
    /\b(?:json|jsonb|payload|body|content|excerpt|claim|evidence_note|risks|invalidation|instrument_id|threshold)\b/i.test(
      body,
    )
  ) {
    violations.push("resource_id_registry must remain payload-free metadata");
  }
  const expectedColumns = [
    "organization_id",
    "resource_type",
    "resource_id",
    "lifecycle_state",
    "registered_at",
    "tombstoned_at",
    "data_classification",
  ].sort();
  const actualColumns = [...body.matchAll(/^ {2}([a-z][a-z0-9_]*)\s+[a-z]/gim)]
    .map((match) => match[1]?.toLowerCase() ?? "")
    .filter(
      (column) =>
        column.length > 0 &&
        !["primary", "unique", "check", "foreign", "constraint"].includes(
          column,
        ),
    )
    .sort();
  if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns)) {
    violations.push(
      "resource_id_registry must contain only its exact payload-free marker columns",
    );
  }
  for (const field of [
    "organization_id uuid NOT NULL",
    "resource_id uuid NOT NULL",
    "registered_at timestamptz NOT NULL",
    "tombstoned_at timestamptz",
  ]) {
    if (!body.toLowerCase().includes(field.toLowerCase()))
      violations.push(`resource_id_registry requires ${field}`);
  }
  if (
    !/resource_type\s+text\s+NOT\s+NULL\s+CHECK\s*\(\s*resource_type\s+IN\s*\(\s*'thesis'\s*,\s*'alert'\s*\)\s*\)/i.test(
      body,
    )
  ) {
    violations.push("resource_id_registry must cover only thesis and alert");
  }
  if (
    !/lifecycle_state\s+text\s+NOT\s+NULL\s+DEFAULT\s+'live'[\s\S]{0,120}?lifecycle_state\s+IN\s*\(\s*'live'\s*,\s*'deleted'\s*\)/i.test(
      body,
    )
  ) {
    violations.push(
      "resource_id_registry requires live/deleted lifecycle state",
    );
  }
  if (
    !/PRIMARY\s+KEY\s*\(\s*organization_id\s*,\s*resource_type\s*,\s*resource_id\s*\)/i.test(
      body,
    )
  ) {
    violations.push(
      "resource_id_registry must key tenant, resource type, and resource ID",
    );
  }
  if (
    !/UNIQUE\s*\(\s*organization_id\s*,\s*resource_type\s*,\s*resource_id\s*,\s*lifecycle_state\s*\)/i.test(
      body,
    )
  ) {
    violations.push(
      "resource_id_registry live-state foreign keys require the lifecycle unique key",
    );
  }
  if (
    !/lifecycle_state\s*=\s*'live'\s+AND\s+tombstoned_at\s+IS\s+NULL[\s\S]{0,120}?lifecycle_state\s*=\s*'deleted'\s+AND\s+tombstoned_at\s+IS\s+NOT\s+NULL/i.test(
      body,
    )
  ) {
    violations.push(
      "resource_id_registry must pair live/deleted state with tombstone time",
    );
  }
  if (
    !/tombstoned_at\s+IS\s+NULL\s+OR\s+tombstoned_at\s*>=\s*registered_at/i.test(
      body,
    )
  ) {
    violations.push(
      "resource_id_registry tombstone time may not precede registration",
    );
  }

  for (const [tableName, resourceType, constraintName] of [
    ["private_data.theses", "thesis", "theses_require_live_registered_id"],
    [
      "private_data.alert_rules",
      "alert",
      "alert_rules_require_live_registered_id",
    ],
  ] as const) {
    requirePattern(
      sql,
      new RegExp(
        `ALTER\\s+TABLE\\s+${escapeRegExp(tableName)}[\\s\\S]{0,1800}?ADD\\s+COLUMN\\s+registered_resource_type\\s+text\\s+GENERATED\\s+ALWAYS\\s+AS\\s*\\(\\s*'${resourceType}'::text\\s*\\)\\s+STORED[\\s\\S]{0,500}?ADD\\s+COLUMN\\s+registered_lifecycle_state\\s+text\\s+GENERATED\\s+ALWAYS\\s+AS\\s*\\(\\s*'live'::text\\s*\\)\\s+STORED`,
        "i",
      ),
      `${tableName} must materialize constant ${resourceType}/live registry keys`,
      violations,
    );
    requirePattern(
      sql,
      new RegExp(
        `ADD\\s+CONSTRAINT\\s+${constraintName}\\s+FOREIGN\\s+KEY\\s*\\(\\s*organization_id\\s*,\\s*registered_resource_type\\s*,\\s*id\\s*,\\s*registered_lifecycle_state\\s*\\)\\s*REFERENCES\\s+private_data\\.resource_id_registry\\s*\\(\\s*organization_id\\s*,\\s*resource_type\\s*,\\s*resource_id\\s*,\\s*lifecycle_state\\s*\\)[\\s\\S]{0,120}?ON\\s+UPDATE\\s+RESTRICT[\\s\\S]{0,80}?ON\\s+DELETE\\s+RESTRICT`,
        "i",
      ),
      `${tableName} must reference the exact live tenant-scoped registry row`,
      violations,
    );
  }

  requirePattern(
    sql,
    /CREATE\s+TRIGGER\s+resource_id_registry_append_only\s+BEFORE\s+UPDATE\s+OR\s+DELETE\s+ON\s+private_data\.resource_id_registry[\s\S]{0,100}?FOR\s+EACH\s+ROW[\s\S]{0,100}?EXECUTE\s+FUNCTION\s+private_data\.guard_resource_id_registry\(\)/i,
    "resource_id_registry must guard updates and deletion with a row trigger",
    violations,
  );
  requirePattern(
    sql,
    /CREATE\s+FUNCTION\s+private_data\.guard_resource_id_registry\(\)[\s\S]{0,180}?SECURITY\s+INVOKER[\s\S]{0,500}?TG_OP\s*=\s*'DELETE'[\s\S]{0,180}?RAISE\s+EXCEPTION[\s\S]{0,1000}?OLD\.lifecycle_state\s+IS\s+DISTINCT\s+FROM\s+'live'[\s\S]{0,180}?NEW\.lifecycle_state\s+IS\s+DISTINCT\s+FROM\s+'deleted'[\s\S]{0,250}?RAISE\s+EXCEPTION/i,
    "resource_id_registry guard must reject deletion, revival, and non-terminal updates",
    violations,
  );
  requirePattern(
    sql,
    /CREATE\s+FUNCTION\s+private_data\.guard_resource_id_registry\(\)[\s\S]{0,1200}?NEW\.organization_id\s+IS\s+DISTINCT\s+FROM\s+OLD\.organization_id[\s\S]{0,180}?NEW\.resource_type\s+IS\s+DISTINCT\s+FROM\s+OLD\.resource_type[\s\S]{0,180}?NEW\.resource_id\s+IS\s+DISTINCT\s+FROM\s+OLD\.resource_id[\s\S]{0,450}?RAISE\s+EXCEPTION/i,
    "resource_id_registry guard must keep tenant, type, and ID immutable",
    violations,
  );
  requirePattern(
    sql,
    /CREATE\s+FUNCTION\s+private_data\.tombstone_resource_id_after_delete\(\)[\s\S]{0,180}?SECURITY\s+INVOKER[\s\S]{0,500}?UPDATE\s+private_data\.resource_id_registry[\s\S]{0,180}?lifecycle_state\s*=\s*'deleted'[\s\S]{0,250}?organization_id\s*=\s*OLD\.organization_id[\s\S]{0,120}?resource_type\s*=\s*TG_ARGV\[0\][\s\S]{0,120}?resource_id\s*=\s*OLD\.id[\s\S]{0,120}?lifecycle_state\s*=\s*'live'[\s\S]{0,300}?affected_rows\s*<>\s*1[\s\S]{0,100}?RAISE\s+EXCEPTION/i,
    "hard deletion must atomically tombstone exactly one live resource identity",
    violations,
  );
  requirePattern(
    sql,
    /CREATE\s+FUNCTION\s+private_data\.guard_live_resource_identity\(\)[\s\S]{0,180}?SECURITY\s+INVOKER[\s\S]{0,450}?NEW\.organization_id\s+IS\s+DISTINCT\s+FROM\s+OLD\.organization_id[\s\S]{0,120}?NEW\.id\s+IS\s+DISTINCT\s+FROM\s+OLD\.id[\s\S]{0,120}?RAISE\s+EXCEPTION/i,
    "live resource identity guard must reject tenant or ID mutation",
    violations,
  );

  for (const [tableName, triggerName, resourceType] of [
    ["private_data.theses", "theses_tombstone_after_delete", "thesis"],
    ["private_data.alert_rules", "alert_rules_tombstone_after_delete", "alert"],
  ] as const) {
    requirePattern(
      sql,
      new RegExp(
        `CREATE\\s+TRIGGER\\s+${triggerName}\\s+AFTER\\s+DELETE\\s+ON\\s+${escapeRegExp(tableName)}[\\s\\S]{0,100}?FOR\\s+EACH\\s+ROW[\\s\\S]{0,100}?EXECUTE\\s+FUNCTION\\s+private_data\\.tombstone_resource_id_after_delete\\(\\s*'${resourceType}'\\s*\\)`,
        "i",
      ),
      `${tableName} hard deletion must invoke its tombstone trigger`,
      violations,
    );
  }

  for (const [tableName, triggerName] of [
    ["private_data.theses", "theses_identity_immutable"],
    ["private_data.alert_rules", "alert_rules_identity_immutable"],
  ] as const) {
    requirePattern(
      sql,
      new RegExp(
        `CREATE\\s+TRIGGER\\s+${triggerName}\\s+BEFORE\\s+UPDATE\\s+ON\\s+${escapeRegExp(tableName)}[\\s\\S]{0,100}?FOR\\s+EACH\\s+ROW[\\s\\S]{0,100}?EXECUTE\\s+FUNCTION\\s+private_data\\.guard_live_resource_identity\\(\\)`,
        "i",
      ),
      `${tableName} tenant and resource ID must be immutable`,
      violations,
    );
  }

  requirePattern(
    sql,
    /GRANT\s+SELECT\s+ON\s+private_data\.resource_id_registry\s+TO\s+research_cockpit_runtime\s*;/i,
    "runtime needs tenant-scoped SELECT-only access to the resource registry",
    violations,
  );
  requirePattern(
    sql,
    /GRANT\s+SELECT\s*,\s*INSERT\s+ON\s+private_data\.resource_id_registry\s+TO\s+research_cockpit_test_seed\s*;/i,
    "test-seed registry access must remain SELECT/INSERT-only",
    violations,
  );
  requirePattern(
    sql,
    /REVOKE\s+ALL\s+ON\s+TABLE\s+private_data\.resource_id_registry\s+FROM\s+PUBLIC\s*;/i,
    "resource_id_registry must explicitly revoke PUBLIC table access",
    violations,
  );
  for (const grant of sql.matchAll(
    /\bGRANT\s+([^;]*?)\s+ON\s+([^;]*?)\s+TO\s+(research_cockpit_(?:runtime|test_seed|backup))\s*;/gi,
  )) {
    const privileges = grant[1] ?? "";
    const target = grant[2] ?? "";
    const role = grant[3] ?? "non-owner capability";
    const targetsRegistry = /\bprivate_data\.resource_id_registry\b/i.test(
      target,
    );
    const targetsPrivateSchema =
      /\bALL\s+TABLES\s+IN\s+SCHEMA\s+private_data\b/i.test(target);
    const targetsLiveResource =
      /\bprivate_data\.(?:theses|alert_rules)\b/i.test(target);
    const grantsAll = /\bALL(?:\s+PRIVILEGES)?\b/i.test(privileges);
    if (
      ((targetsRegistry || targetsPrivateSchema) &&
        (grantsAll || /\bUPDATE\b/i.test(privileges))) ||
      ((targetsLiveResource || targetsPrivateSchema) &&
        (grantsAll || /\b(?:DELETE|TRUNCATE)\b/i.test(privileges)))
    ) {
      violations.push(
        `${role} must not gain a database deletion path in this increment`,
      );
    }
  }
  for (const functionName of [
    "guard_resource_id_registry",
    "tombstone_resource_id_after_delete",
    "guard_live_resource_identity",
  ]) {
    const functionBody = extractZeroArgumentFunctionBody(
      sql,
      `private_data.${functionName}`,
    );
    if (!functionBody || !/\bEND;\s*$/i.test(functionBody)) {
      violations.push(`${functionName} must be a terminated PL/pgSQL block`);
    }
    requirePattern(
      sql,
      new RegExp(
        `ALTER\\s+FUNCTION\\s+private_data\\.${functionName}\\(\\)\\s+OWNER\\s+TO\\s+research_cockpit_owner\\s*;`,
        "i",
      ),
      `${functionName} must be owned by the NOLOGIN owner role`,
      violations,
    );
    requirePattern(
      sql,
      new RegExp(
        `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+private_data\\.${functionName}\\(\\)\\s+FROM\\s+PUBLIC\\s*;`,
        "i",
      ),
      `${functionName} must revoke PUBLIC execution`,
      violations,
    );
  }
}

function inspectApplicationContractBounds(
  sql: string,
  violations: string[],
): void {
  const theses = extractCreateTable(sql, "private_data.theses");
  if (theses) {
    for (const field of ["evidence_note", "risks"] as const) {
      const pattern = new RegExp(
        `${field}\\s+text\\s+NOT\\s+NULL\\s+CHECK\\s*\\(\\s*char_length\\(${field}\\)\\s+BETWEEN\\s+1\\s+AND\\s+8000\\s*\\)`,
        "i",
      );
      if (!pattern.test(theses))
        violations.push(
          `thesis ${field} must be non-empty and at most 8000 characters`,
        );
    }
  }

  const idempotency = extractCreateTable(
    sql,
    "private_data.idempotency_records",
  );
  if (idempotency) {
    if (
      !/char_length\(idempotency_key\)\s+BETWEEN\s+8\s+AND\s+128/i.test(
        idempotency,
      )
    ) {
      violations.push("idempotency key must be 8 to 128 characters");
    }
    if (
      !/resource_type\s+IN\s*\(\s*'thesis'\s*,\s*'alert'\s*\)/i.test(
        idempotency,
      ) ||
      /research_export/i.test(idempotency)
    ) {
      violations.push(
        "idempotency resource_type must allow only thesis and alert",
      );
    }
  }

  const audit = extractCreateTable(sql, "private_data.audit_events");
  if (
    audit &&
    !/char_length\(request_id\)\s+BETWEEN\s+1\s+AND\s+128/i.test(audit)
  ) {
    violations.push("audit request ID must be 1 to 128 characters");
  }
}

function inspectAuditTable(sql: string, violations: string[]): void {
  const body = extractCreateTable(sql, "private_data.audit_events");
  if (!body) {
    violations.push(
      "private_data.audit_events CREATE TABLE body was not found",
    );
    return;
  }
  if (
    /\b(?:json|jsonb|payload|body|content|excerpt|claim|evidence_note)\b/i.test(
      body,
    )
  )
    violations.push("audit_events must remain payload-free metadata");
}

function extractCreateTable(sql: string, table: string): string | null {
  const match = new RegExp(
    `CREATE\\s+TABLE\\s+${escapeRegExp(table)}\\s*\\(([\\s\\S]*?)\\n\\);`,
    "i",
  ).exec(sql);
  return match?.[1] ?? null;
}

function extractCreatePolicy(sql: string, policyName: string): string | null {
  const match = new RegExp(
    `CREATE\\s+POLICY\\s+${escapeRegExp(policyName)}\\b([\\s\\S]*?);`,
    "i",
  ).exec(sql);
  return match?.[1] ?? null;
}

function extractZeroArgumentFunctionBody(
  sql: string,
  functionName: string,
): string | null {
  const match = new RegExp(
    `CREATE\\s+FUNCTION\\s+${escapeRegExp(functionName)}\\(\\)[\\s\\S]*?AS\\s+\\$function\\$([\\s\\S]*?)\\$function\\$;`,
    "i",
  ).exec(sql);
  return match?.[1]?.trim() ?? null;
}

function requirePattern(
  text: string,
  pattern: RegExp,
  message: string,
  violations: string[],
): void {
  if (!pattern.test(text)) violations.push(message);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = await checkMigrations();
  if (violations.length > 0) {
    throw new Error(
      `PostgreSQL static security violations:\n- ${violations.join("\n- ")}`,
    );
  }
  process.stdout.write(
    "PostgreSQL migration manifest and static security harness verified.\n",
  );
}
