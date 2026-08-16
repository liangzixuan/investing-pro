import { describe, expect, it } from "vitest";

import {
  checkMigrations,
  detectProhibitedSql,
  inspectStaticContractNotice,
  inspectSqlBundle,
  loadMigrationFiles,
  type MigrationFile,
} from "../src/check-migrations";

describe("PostgreSQL migration manifest", () => {
  it("matches every ordered forward migration and immutable checksum", async () => {
    await expect(checkMigrations()).resolves.toEqual([]);
  });
});

describe("static SQL security harness", () => {
  it("accepts the reviewed migration bundle", async () => {
    expect(inspectSqlBundle(await loadMigrationFiles())).toEqual([]);
  });

  it("rejects destructive, public, and definer-based escape hatches", () => {
    expect(detectProhibitedSql("DROP TABLE private_data.theses;")).toContain(
      "destructive DROP is prohibited",
    );
    expect(
      detectProhibitedSql(
        "GRANT SELECT ON private_data.audit_events TO PUBLIC;",
      ),
    ).toContain("grants to PUBLIC are prohibited");
    expect(
      detectProhibitedSql(
        "CREATE FUNCTION unsafe() RETURNS integer SECURITY DEFINER LANGUAGE sql AS 'SELECT 1';",
      ),
    ).toContain("SECURITY DEFINER is prohibited in this harness");
    expect(
      detectProhibitedSql(
        "ALTER TABLE private_data.theses DISABLE TRIGGER theses_tombstone_after_delete;",
      ),
    ).toContain("triggers may not be disabled");
    expect(
      detectProhibitedSql(
        "ALTER TABLE private_data.theses DROP CONSTRAINT theses_require_live_registered_id;",
      ),
    ).toContain("destructive constraint or column removal is prohibited");
    expect(
      detectProhibitedSql("DROP TRIGGER theses_tombstone_after_delete;"),
    ).toContain("destructive DROP is prohibited");
    expect(
      detectProhibitedSql(
        "CREATE OR REPLACE VIEW private_data.escape AS SELECT 1;",
      ),
    ).toContain("forward migrations may not replace unreviewed objects");
    expect(
      detectProhibitedSql(
        "CREATE OR REPLACE PROCEDURE private_data.set_request_context() LANGUAGE sql AS 'SELECT 1';",
      ),
    ).not.toContain("forward migrations may not replace unreviewed objects");
    expect(
      detectProhibitedSql("CREATE ROLE acceptance_escape LOGIN BYPASSRLS;"),
    ).toContain("unreviewed role creation is prohibited");
    expect(
      detectProhibitedSql(
        "CREATE VIEW private_data.runtime_escape AS SELECT * FROM private_data.theses;",
      ),
    ).toContain("unreviewed relation types are prohibited");
    expect(
      detectProhibitedSql(
        "GRANT SELECT ON private_data.theses TO research_cockpit_runtime WITH GRANT OPTION;",
      ),
    ).toContain("grant options are prohibited");
    expect(detectProhibitedSql("CREATE SCHEMA runtime_escape;")).toContain(
      "unreviewed schema creation is prohibited",
    );
    expect(
      detectProhibitedSql(
        "GRANT CREATE ON SCHEMA public TO research_cockpit_runtime;",
      ),
    ).toContain(
      "capability roles may not receive schema or database creation privileges",
    );
    expect(
      detectProhibitedSql(
        "CREATE TRIGGER disabled AFTER DELETE ON private_data.theses FOR EACH ROW WHEN (false) EXECUTE FUNCTION private_data.tombstone_resource_id_after_delete('thesis');",
      ),
    ).toContain("conditional triggers are prohibited in this harness");
  });

  it("requires database-level PUBLIC creation privileges to be revoked", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0007_database_privilege_lockdown.sql",
      (sql) => sql.replace("REVOKE CREATE, TEMPORARY", "REVOKE CREATE"),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "PUBLIC must lose database CREATE and TEMPORARY privileges",
    );
  });

  it("requires extension routines to lose default PUBLIC execution", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0004_row_security_and_runtime_grants.sql",
      (sql) =>
        sql.replace(
          "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shared_data FROM PUBLIC;",
          "",
        ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "PUBLIC must lose extension-routine execution in shared_data",
    );
  });

  it("detects removal of forced RLS from a protected table", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0004_row_security_and_runtime_grants.sql",
      (sql) =>
        sql.replace(
          "ALTER TABLE private_data.theses FORCE ROW LEVEL SECURITY;",
          "",
        ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "private_data.theses must FORCE ROW LEVEL SECURITY",
    );
  });

  it("requires every RLS policy to target its intended capability role", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0004_row_security_and_runtime_grants.sql",
      (sql) =>
        sql.replace(
          "CREATE POLICY principals_read_self ON private_data.principals\n  FOR SELECT TO research_cockpit_runtime",
          "CREATE POLICY principals_read_self ON private_data.principals\n  FOR SELECT",
        ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "principals_read_self policy must target only research_cockpit_runtime",
    );
  });

  it("detects payload-bearing audit columns", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0002_canonical_entities.sql", (sql) =>
      sql.replace("reason_code text NOT NULL", "payload jsonb NOT NULL"),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "audit_events must remain payload-free metadata",
    );
  });

  it("detects a fact that no longer freezes the rights-policy version", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0002_canonical_entities.sql", (sql) => {
      const marker = "CREATE TABLE shared_data.financial_facts";
      const index = sql.indexOf(marker);
      if (index < 0) throw new Error("financial_facts marker missing");
      return (
        sql.slice(0, index) +
        sql.slice(index).replace("  rights_policy_version text NOT NULL,\n", "")
      );
    });
    expect(inspectSqlBundle(mutated)).toContain(
      "shared_data.financial_facts must freeze rights_policy_version",
    );
  });

  it("detects a request setting changed from transaction-local to session-wide", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0001_schemas_context_and_ledger.sql",
      (sql) =>
        sql.replace(
          "set_config('app.principal_id', principal_id::text, true)",
          "set_config('app.principal_id', principal_id::text, false)",
        ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "request context app.principal_id must be transaction-local",
    );
  });

  it("requires null-safe request-context validation", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0006_null_safe_request_context.sql", (sql) =>
      sql
        .replace("purpose IS NULL\n    OR ", "")
        .replace("channel IS NULL OR ", "")
        .replace("territory IS DISTINCT FROM", "territory <>")
        .replace(
          "data_classification IS DISTINCT FROM",
          "data_classification <>",
        ),
    );
    expect(inspectSqlBundle(mutated)).toEqual(
      expect.arrayContaining([
        "request context must reject a null purpose",
        "request context must reject a null channel",
        "request context must reject a null or foreign territory",
        "request context must reject a null or foreign classification",
      ]),
    );
  });

  it("rejects membership authorization that ignores principal deactivation", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0004_row_security_and_runtime_grants.sql",
      (sql) => sql.replace("        AND principal.active\n", ""),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "active membership authorization must require an active synthetic principal",
    );
  });

  it("requires direct membership reads to be current and principal-active", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0004_row_security_and_runtime_grants.sql",
      (sql) =>
        mutateAfterMarker(sql, "CREATE POLICY memberships_read_self", (tail) =>
          tail
            .replace("    AND active_from <= transaction_timestamp()\n", "")
            .replace("        AND current_principal.active\n", ""),
        ),
    );
    const violations = inspectSqlBundle(mutated);
    expect(violations).toContain(
      "memberships_read_self must require a current half-open membership window",
    );
    expect(violations).toContain(
      "memberships_read_self must require an active synthetic current principal",
    );
  });

  it("requires association reads to have a current active membership", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0004_row_security_and_runtime_grants.sql",
      (sql) =>
        mutateAfterMarker(
          sql,
          "CREATE POLICY organization_principals_read_self",
          (tail) =>
            tail.replace(
              "        AND active_membership.active_from <= transaction_timestamp()\n",
              "",
            ),
        ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "organization_principals_read_self must require the current active membership",
    );
  });

  it("requires every other private runtime read to use active membership", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0005_non_reusable_resource_ids.sql", (sql) =>
      mutateAfterMarker(
        sql,
        "CREATE POLICY resource_id_registry_read_current_organization",
        (tail) =>
          tail.replace(
            "private_data.has_active_membership(",
            "private_data.has_unchecked_membership(",
          ),
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "private_data.resource_id_registry runtime reads must require active membership authorization",
    );
  });

  it("rejects any runtime write privilege", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0004_row_security_and_runtime_grants.sql",
      (sql) =>
        sql.replace(
          "COMMIT;",
          "GRANT INSERT ON private_data.theses TO research_cockpit_runtime;\n\nCOMMIT;",
        ),
    );
    expect(inspectSqlBundle(mutated)).toContainEqual(
      expect.stringContaining("research_cockpit_runtime must remain read-only"),
    );
  });

  it("requires every separated capability role to remain non-login and non-bypass", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0001_schemas_context_and_ledger.sql",
      (sql) =>
        sql.replace(
          "CREATE ROLE research_cockpit_backup\n      NOLOGIN",
          "CREATE ROLE research_cockpit_backup\n      LOGIN",
        ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "research_cockpit_backup must declare NOLOGIN",
    );
  });

  it("requires every capability role to remain non-replicating", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0001_schemas_context_and_ledger.sql",
      (sql) =>
        sql.replace(
          "CREATE ROLE research_cockpit_backup\n      NOLOGIN\n      NOSUPERUSER\n      NOCREATEDB\n      NOCREATEROLE\n      NOREPLICATION",
          "CREATE ROLE research_cockpit_backup\n      NOLOGIN\n      NOSUPERUSER\n      NOCREATEDB\n      NOCREATEROLE\n      REPLICATION",
        ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "research_cockpit_backup must declare NOREPLICATION",
    );
  });

  it("rejects a pre-existing replication-capable role", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0001_schemas_context_and_ledger.sql",
      (sql) =>
        mutateAfterMarker(
          sql,
          "WHERE rolname = 'research_cockpit_runtime'",
          (tail) => tail.replace("        OR rolreplication\n", ""),
        ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "research_cockpit_runtime must reject an unsafe pre-existing role",
    );
  });

  it("rejects a role bootstrap that silently accepts an unsafe existing role", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0001_schemas_context_and_ledger.sql",
      (sql) =>
        sql.replace(
          "RAISE EXCEPTION 'unsafe pre-existing capability role: research_cockpit_runtime';",
          "NULL;",
        ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "research_cockpit_runtime must reject an unsafe pre-existing role",
    );
  });

  it("rejects pre-existing capability membership in either direction", async () => {
    const files = await loadMigrationFiles();
    const withoutInboundCheck = mutate(
      files,
      "0001_schemas_context_and_ledger.sql",
      (sql) =>
        sql.replace(
          "    WHERE granted_role.rolname = 'research_cockpit_owner'\n       OR member_role.rolname = 'research_cockpit_owner'",
          "    WHERE member_role.rolname = 'research_cockpit_owner'",
        ),
    );
    expect(inspectSqlBundle(withoutInboundCheck)).toContain(
      "research_cockpit_owner must reject inbound and outbound role memberships",
    );

    const withoutOutboundCheck = mutate(
      files,
      "0001_schemas_context_and_ledger.sql",
      (sql) =>
        sql.replace(
          "       OR member_role.rolname = 'research_cockpit_backup'",
          "",
        ),
    );
    expect(inspectSqlBundle(withoutOutboundCheck)).toContain(
      "research_cockpit_backup must reject inbound and outbound role memberships",
    );
  });

  it("rejects a membership bootstrap guard changed to silently continue", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(
      files,
      "0001_schemas_context_and_ledger.sql",
      (sql) =>
        sql.replace(
          "RAISE EXCEPTION 'unsafe pre-existing capability role membership: research_cockpit_runtime';",
          "NULL;",
        ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "research_cockpit_runtime must reject inbound and outbound role memberships",
    );
  });

  it("rejects capability-role chaining", () => {
    expect(
      detectProhibitedSql("GRANT external_writer TO research_cockpit_runtime;"),
    ).toContain("capability-role chaining is prohibited");
    expect(
      detectProhibitedSql(
        "ALTER ROLE research_cockpit_runtime WITH BYPASSRLS;",
      ),
    ).toContain("capability-role privilege escalation is prohibited");
    expect(
      detectProhibitedSql(
        "ALTER ROLE research_cockpit_runtime WITH REPLICATION;",
      ),
    ).toContain("capability-role privilege escalation is prohibited");
  });

  it("detects removal of a tenant-composite creator association", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0002_canonical_entities.sql", (sql) => {
      const marker = "CREATE TABLE private_data.theses";
      const start = sql.indexOf(marker);
      if (start < 0) throw new Error("theses marker missing");
      const tail = sql
        .slice(start)
        .replace(
          / {2}FOREIGN KEY \(organization_id, created_by\)[\s\S]*?principal_id\n {4}\),\n/,
          "",
        );
      return sql.slice(0, start) + tail;
    });
    expect(inspectSqlBundle(mutated)).toContain(
      "thesis creator needs a tenant-composite association FK",
    );
  });

  it("rejects ambiguous fact effective time and a missing known/system guard", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0002_canonical_entities.sql", (sql) => {
      const marker = "CREATE TABLE shared_data.financial_facts";
      const start = sql.indexOf(marker);
      if (start < 0) throw new Error("financial_facts marker missing");
      const tail = sql
        .slice(start)
        .replace(
          "known_from timestamptz NOT NULL",
          "effective_from timestamptz NOT NULL",
        )
        .replace("  CHECK (known_from <= system_from)\n", "");
      return sql.slice(0, start) + tail;
    });
    const violations = inspectSqlBundle(mutated);
    expect(violations).toContain(
      "financial facts may not use the ambiguous effective interval name",
    );
    expect(violations).toContain(
      "financial facts require known_from <= system_from",
    );
  });

  it("requires the application-aligned sha256 idempotency fingerprint", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0002_canonical_entities.sql", (sql) =>
      sql.replace(
        "request_fingerprint ~ '^sha256:[0-9a-f]{64}$'",
        "request_fingerprint ~ '^[0-9a-f]{64}$'",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "idempotency fingerprint must use sha256:<64 lowercase hex>",
    );
  });

  it("rejects reintroduction of soft-delete state", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0002_canonical_entities.sql", (sql) =>
      sql.replace(
        "  version integer NOT NULL DEFAULT 1 CHECK (version > 0),",
        "  version integer NOT NULL DEFAULT 1 CHECK (version > 0),\n  deleted_at timestamptz,",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "thesis and alert persistence must use the hard-delete contract without deleted_at",
    );
  });

  it("requires a payload-free tenant-scoped resource ID registry", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0005_non_reusable_resource_ids.sql", (sql) =>
      sql.replace(
        "  registered_at timestamptz NOT NULL,",
        "  registered_at timestamptz NOT NULL,\n  payload jsonb,",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "resource_id_registry must remain payload-free metadata",
    );
  });

  it("rejects an innocuously named payload column in the tombstone registry", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0005_non_reusable_resource_ids.sql", (sql) =>
      sql.replace(
        "  registered_at timestamptz NOT NULL,",
        "  registered_at timestamptz NOT NULL,\n  deleted_summary text,",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "resource_id_registry must contain only its exact payload-free marker columns",
    );
  });

  it("requires tombstone identity to include tenant, type, and resource ID", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0005_non_reusable_resource_ids.sql", (sql) =>
      sql.replace(
        "PRIMARY KEY (organization_id, resource_type, resource_id)",
        "PRIMARY KEY (organization_id, resource_id)",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "resource_id_registry must key tenant, resource type, and resource ID",
    );
  });

  it("requires live thesis and alert rows to reference exact registry state", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0005_non_reusable_resource_ids.sql", (sql) =>
      sql.replace(
        "ADD CONSTRAINT theses_require_live_registered_id",
        "ADD CONSTRAINT theses_without_live_registered_id",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "private_data.theses must reference the exact live tenant-scoped registry row",
    );
  });

  it("rejects a registry guard that permits tombstone revival", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0005_non_reusable_resource_ids.sql", (sql) =>
      sql.replace(
        "OLD.lifecycle_state IS DISTINCT FROM 'live'",
        "OLD.lifecycle_state IS DISTINCT FROM 'deleted'",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "resource_id_registry guard must reject deletion, revival, and non-terminal updates",
    );
  });

  it("rejects an unterminated registry trigger function block", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0005_non_reusable_resource_ids.sql", (sql) =>
      sql.replace(
        "  RETURN NEW;\nEND;\n$function$;\n\nCREATE FUNCTION private_data.tombstone_resource_id_after_delete",
        "  RETURN NEW;\nEND\n$function$;\n\nCREATE FUNCTION private_data.tombstone_resource_id_after_delete",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "guard_resource_id_registry must be a terminated PL/pgSQL block",
    );
  });

  it("requires every hard delete to atomically tombstone its resource ID", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0005_non_reusable_resource_ids.sql", (sql) =>
      sql.replace(
        "CREATE TRIGGER alert_rules_tombstone_after_delete\n  AFTER DELETE",
        "CREATE TRIGGER alert_rules_tombstone_after_delete\n  AFTER UPDATE",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "private_data.alert_rules hard deletion must invoke its tombstone trigger",
    );
  });

  it("requires tombstone triggers to execute once per deleted row", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0005_non_reusable_resource_ids.sql", (sql) =>
      sql.replace(
        "CREATE TRIGGER theses_tombstone_after_delete\n  AFTER DELETE ON private_data.theses\n  FOR EACH ROW",
        "CREATE TRIGGER theses_tombstone_after_delete\n  AFTER DELETE ON private_data.theses",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "private_data.theses hard deletion must invoke its tombstone trigger",
    );
  });

  it("requires the delete trigger to target the exact tenant resource row", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0005_non_reusable_resource_ids.sql", (sql) =>
      sql.replace(
        "  WHERE organization_id = OLD.organization_id",
        "  WHERE organization_id IS NOT NULL",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "hard deletion must atomically tombstone exactly one live resource identity",
    );
  });

  it("keeps every declared non-owner capability unable to delete", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0005_non_reusable_resource_ids.sql", (sql) =>
      sql.replace(
        "COMMIT;",
        "GRANT UPDATE ON private_data.resource_id_registry TO research_cockpit_test_seed;\n\nCOMMIT;",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "research_cockpit_test_seed must not gain a database deletion path in this increment",
    );
  });

  it("enforces application-aligned idempotency and audit bounds", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0002_canonical_entities.sql", (sql) =>
      sql
        .replace(
          "char_length(idempotency_key) BETWEEN 8 AND 128",
          "char_length(idempotency_key) BETWEEN 8 AND 200",
        )
        .replace(
          "resource_type IN ('thesis', 'alert')",
          "resource_type IN ('thesis', 'alert', 'research_export')",
        )
        .replace(
          "char_length(request_id) BETWEEN 1 AND 128",
          "char_length(request_id) BETWEEN 1 AND 200",
        ),
    );
    const violations = inspectSqlBundle(mutated);
    expect(violations).toContain("idempotency key must be 8 to 128 characters");
    expect(violations).toContain(
      "idempotency resource_type must allow only thesis and alert",
    );
    expect(violations).toContain(
      "audit request ID must be 1 to 128 characters",
    );
  });

  it("requires non-empty thesis evidence and risk fields", async () => {
    const files = await loadMigrationFiles();
    const mutated = mutate(files, "0002_canonical_entities.sql", (sql) =>
      sql.replace(
        "char_length(evidence_note) BETWEEN 1 AND 8000",
        "char_length(evidence_note) <= 8000",
      ),
    );
    expect(inspectSqlBundle(mutated)).toContain(
      "thesis evidence_note must be non-empty and at most 8000 characters",
    );
  });

  it("requires the bounded-live-workflow warning and gate disclosure", () => {
    expect(inspectStaticContractNotice("")).not.toEqual([]);
  });
});

function mutate(
  files: MigrationFile[],
  file: string,
  transform: (sql: string) => string,
): MigrationFile[] {
  return files.map((migration) =>
    migration.file === file
      ? { ...migration, sql: transform(migration.sql) }
      : migration,
  );
}

function mutateAfterMarker(
  sql: string,
  marker: string,
  transform: (tail: string) => string,
): string {
  const index = sql.indexOf(marker);
  if (index < 0) throw new Error(`${marker} marker missing`);
  return sql.slice(0, index) + transform(sql.slice(index));
}
