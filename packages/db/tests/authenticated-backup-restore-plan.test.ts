import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  AUTHENTICATED_BACKUP_ARCHIVE,
  AUTHENTICATED_BACKUP_CAPABILITY_ROLE,
  AUTHENTICATED_BACKUP_LOGIN_ROLE,
  AUTHENTICATED_BACKUP_NO_RLS_ARCHIVE,
  AUTHENTICATED_BACKUP_PASSFILE,
  AUTHENTICATED_BACKUP_RESTORABLE_TABLES,
  AUTHENTICATED_BACKUP_RESTORE_PLATFORM_SHA256,
  AUTHENTICATED_BACKUP_SOURCE_DATABASE,
  AUTHENTICATED_BACKUP_WRONG_PASSFILE,
  AUTHENTICATED_RESTORE_CAPABILITY_ROLE,
  AUTHENTICATED_RESTORE_DATABASE,
  AUTHENTICATED_RESTORE_FAILURE_FUNCTION,
  AUTHENTICATED_RESTORE_FAILURE_MESSAGE,
  AUTHENTICATED_RESTORE_FAILURE_TABLE,
  AUTHENTICATED_RESTORE_FAILURE_TRIGGER,
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
  renderAuthenticatedRestoreApplicationMigration,
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
} from "../src/authenticated-backup-restore-plan";
import { loadAuthenticatedMigrationPlan } from "../src/authenticated-migration-plan";

describe("authenticated backup and bounded restore plan", () => {
  it("loads the sole checksum-bound restore-platform source", async () => {
    const plan = await loadAuthenticatedBackupRestorePlan();
    expect(Object.keys(plan)).toEqual(["restorePlatformSql"]);
    expect(
      createHash("sha256").update(plan.restorePlatformSql).digest("hex"),
    ).toBe(AUTHENTICATED_BACKUP_RESTORE_PLATFORM_SHA256);
    expect(
      createHash("sha256")
        .update(
          await readFile(
            new URL(
              "../backup-restore-plans/v1/restore-platform.sql",
              import.meta.url,
            ),
          ),
        )
        .digest("hex"),
    ).toBe(AUTHENTICATED_BACKUP_RESTORE_PLATFORM_SHA256);
  });

  it("renders one closed restore-platform transaction and rollback injection", async () => {
    const plan = await loadAuthenticatedBackupRestorePlan();
    const success = renderAuthenticatedRestorePlatform(plan);
    expect(success.match(/^BEGIN;$/gm)).toHaveLength(1);
    expect(success.match(/^COMMIT;$/gm)).toHaveLength(1);
    expect(success).toContain(
      "SELECT pg_catalog.pg_advisory_xact_lock(818476709640328253::bigint);",
    );
    expect(success).toContain(AUTHENTICATED_RESTORE_DATABASE);
    expect(success).toContain(
      "restore platform bootstrap requires the exact capability roles",
    );
    expect(success).toContain(
      "restore platform bootstrap requires zero capability-role memberships",
    );
    expect(success).toContain(
      "restore platform bootstrap requires zero capability-role settings",
    );
    expect(success).toContain("FROM pg_catalog.pg_authid");
    for (const roleAttribute of [
      "rolconnlimit = -1",
      "rolpassword IS NULL",
      "rolvaliduntil IS NULL",
    ]) {
      expect(success).toContain(roleAttribute);
    }
    expect(success).toContain(
      "CREATE EXTENSION btree_gist WITH SCHEMA shared_data;",
    );
    expect(success).not.toMatch(/\bCREATE\s+ROLE\b/i);
    expect(success).not.toMatch(/\bDROP\s+DATABASE\b/i);

    const rollback = renderAuthenticatedRestorePlatform(plan, true);
    expect(rollback).toContain("PERFORM 1 / 0;");
    expect(rollback.indexOf("PERFORM 1 / 0;")).toBeGreaterThan(
      rollback.indexOf("CREATE EXTENSION btree_gist"),
    );
    expect(rollback.indexOf("PERFORM 1 / 0;")).toBeLessThan(
      rollback.lastIndexOf("COMMIT;"),
    );
    expect(() =>
      renderAuthenticatedRestorePlatform(
        { restorePlatformSql: `${plan.restorePlatformSql}\nSELECT 1;` },
        false,
      ),
    ).toThrow(/checksum/i);
  });

  it("reuses the exact v2 application plan against only the fixed restore target", async () => {
    const sql = renderAuthenticatedRestoreApplicationMigration(
      await loadAuthenticatedMigrationPlan(),
    );
    expect(sql).toContain(
      `IF pg_catalog.current_database() <> '${AUTHENTICATED_RESTORE_DATABASE}' THEN`,
    );
    expect(sql).not.toContain(
      `IF pg_catalog.current_database() <> '${AUTHENTICATED_BACKUP_SOURCE_DATABASE}' THEN`,
    );
    expect(sql).toContain("SET LOCAL ROLE research_cockpit_owner;");
    expect(sql).toContain("b7-authenticated-migrator-identity-ok");
    expect(sql).toContain("b7-authenticated-migrator-role-reset-ok");
  });

  it.each([
    [
      "backup",
      AUTHENTICATED_BACKUP_LOGIN_ROLE,
      AUTHENTICATED_BACKUP_CAPABILITY_ROLE,
      renderAuthenticatedBackupProvisioningSql,
      renderAuthenticatedBackupCleanupSql,
      renderAuthenticatedBackupBackendDrainSql,
    ],
    [
      "restore",
      AUTHENTICATED_RESTORE_LOGIN_ROLE,
      AUTHENTICATED_RESTORE_CAPABILITY_ROLE,
      renderAuthenticatedRestoreProvisioningSql,
      renderAuthenticatedRestoreCleanupSql,
      renderAuthenticatedRestoreBackendDrainSql,
    ],
  ] as const)(
    "renders the exact ephemeral %s login, set-only edge, and cleanup",
    (_label, login, capability, provision, cleanup, drain) => {
      const password = "A".repeat(43);
      const sql = provision(password);
      expect(sql).toContain(`CREATE ROLE ${login}`);
      for (const attribute of [
        "LOGIN",
        "NOSUPERUSER",
        "NOCREATEDB",
        "NOCREATEROLE",
        "NOREPLICATION",
        "NOINHERIT",
        "NOBYPASSRLS",
        "CONNECTION LIMIT 1",
      ]) {
        expect(sql).toContain(attribute);
      }
      expect(sql).toContain(
        `GRANT ${capability}\n  TO ${login}\n  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
      );
      expect(sql.match(new RegExp(password, "g"))).toHaveLength(1);
      expect(cleanup()).toContain(`DROP ROLE IF EXISTS ${login};`);
      expect(cleanup()).not.toMatch(/DROP OWNED|REASSIGN OWNED/i);
      expect(drain()).toContain(`WHERE usename = '${login}'`);
      expect(drain()).toContain("backend_type = 'client backend'");
    },
  );

  it("uses canonical 32-byte credentials and fixed 0600-passfile contents", () => {
    const passwords = Array.from({ length: 8 }, () =>
      generateAuthenticatedBackupRestorePassword(),
    );
    expect(new Set(passwords).size).toBe(passwords.length);
    for (const password of passwords) {
      expect(password).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
    const password = passwords[0];
    if (!password) throw new Error("Missing generated backup password");
    expect(renderAuthenticatedBackupPassfile(password)).toBe(
      `127.0.0.1:5432:${AUTHENTICATED_BACKUP_SOURCE_DATABASE}:${AUTHENTICATED_BACKUP_LOGIN_ROLE}:${password}\n`,
    );
    expect(renderAuthenticatedRestorePassfile(password)).toBe(
      `127.0.0.1:5432:${AUTHENTICATED_RESTORE_DATABASE}:${AUTHENTICATED_RESTORE_LOGIN_ROLE}:${password}\n`,
    );
    for (const invalid of [
      "A".repeat(42),
      "A".repeat(44),
      `${"A".repeat(42)}=`,
      `${"A".repeat(43)}\n`,
      `${"A".repeat(42)}'`,
    ]) {
      expect(() => renderAuthenticatedBackupPassfile(invalid)).toThrow(
        /32-byte base64url/i,
      );
      expect(() => renderAuthenticatedRestoreProvisioningSql(invalid)).toThrow(
        /32-byte base64url/i,
      );
    }
  });

  it("freezes the authenticated RLS-scoped data-only pg_dump invocation", () => {
    const invocation = buildAuthenticatedBackupDumpInvocation();
    expect(invocation.environment).toEqual({
      PGPASSFILE: AUTHENTICATED_BACKUP_PASSFILE,
      PGREQUIREAUTH: "scram-sha-256",
      PGSSLMODE: "disable",
      PGCONNECT_TIMEOUT: "5",
    });
    expect(invocation.command).toEqual([
      "pg_dump",
      "--no-password",
      "--host=127.0.0.1",
      "--port=5432",
      `--username=${AUTHENTICATED_BACKUP_LOGIN_ROLE}`,
      `--dbname=${AUTHENTICATED_BACKUP_SOURCE_DATABASE}`,
      `--role=${AUTHENTICATED_BACKUP_CAPABILITY_ROLE}`,
      "--format=custom",
      `--file=${AUTHENTICATED_BACKUP_ARCHIVE}`,
      "--data-only",
      "--column-inserts",
      "--enable-row-security",
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
    ]);
    expect(Object.isFrozen(invocation)).toBe(true);
    expect(Object.isFrozen(invocation.environment)).toBe(true);
    expect(Object.isFrozen(invocation.command)).toBe(true);
    expect(invocation.command.join(" ")).not.toMatch(
      /PGPASSWORD|password=|--clean|--create|--disable-triggers/i,
    );
  });

  it("freezes the backup and restore psql probes and classifies wrong-password rejection", () => {
    const backup = buildAuthenticatedBackupPsqlInvocation();
    expect(backup.environment).toEqual({
      PGPASSFILE: AUTHENTICATED_BACKUP_PASSFILE,
      PGREQUIREAUTH: "scram-sha-256",
      PGSSLMODE: "disable",
      PGCONNECT_TIMEOUT: "5",
    });
    expect(backup.command).toEqual([
      "psql",
      "--no-psqlrc",
      "--no-password",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      "--host=127.0.0.1",
      "--port=5432",
      `--username=${AUTHENTICATED_BACKUP_LOGIN_ROLE}`,
      `--dbname=${AUTHENTICATED_BACKUP_SOURCE_DATABASE}`,
    ]);

    const restore = buildAuthenticatedRestorePsqlInvocation({
      passfile: AUTHENTICATED_RESTORE_WRONG_PASSFILE,
      requireScram: false,
      verboseErrors: true,
    });
    expect(restore.environment).toEqual({
      PGPASSFILE: AUTHENTICATED_RESTORE_WRONG_PASSFILE,
      PGSSLMODE: "disable",
      PGCONNECT_TIMEOUT: "5",
    });
    expect(restore.command).toContain("--set=VERBOSITY=verbose");
    expect(restore.command).toContain(
      `--username=${AUTHENTICATED_RESTORE_LOGIN_ROLE}`,
    );
    expect(restore.command).toContain(
      `--dbname=${AUTHENTICATED_RESTORE_DATABASE}`,
    );
    for (const invocation of [backup, restore]) {
      expect(Object.isFrozen(invocation)).toBe(true);
      expect(Object.isFrozen(invocation.environment)).toBe(true);
      expect(Object.isFrozen(invocation.command)).toBe(true);
    }

    expect(() =>
      assertAuthenticatedBackupWrongPasswordRejection({
        exitCode: 2,
        stdout: "",
        stderr: `psql: error: connection failed: FATAL: password authentication failed for user "${AUTHENTICATED_BACKUP_LOGIN_ROLE}"\n`,
      }),
    ).not.toThrow();
    expect(() =>
      assertAuthenticatedRestoreWrongPasswordRejection({
        exitCode: 2,
        stdout: "",
        stderr: `FATAL: password authentication failed for user "${AUTHENTICATED_RESTORE_LOGIN_ROLE}"\n`,
      }),
    ).not.toThrow();
    expect(() =>
      assertAuthenticatedRestoreWrongPasswordRejection({
        exitCode: 0,
        stdout: "unexpected",
        stderr: "",
      }),
    ).toThrow(/unexpectedly succeeded/i);
  });

  it("builds only closed negative pg_dump variants", () => {
    const noRole = buildAuthenticatedBackupDumpInvocation({
      archive: AUTHENTICATED_BACKUP_NO_RLS_ARCHIVE,
      passfile: AUTHENTICATED_BACKUP_WRONG_PASSFILE,
      requireScram: false,
      selectCapabilityRole: false,
      enableRowSecurity: false,
    });
    expect(noRole.environment).toEqual({
      PGPASSFILE: AUTHENTICATED_BACKUP_WRONG_PASSFILE,
      PGSSLMODE: "disable",
      PGCONNECT_TIMEOUT: "5",
    });
    expect(noRole.command).not.toContain(
      `--role=${AUTHENTICATED_BACKUP_CAPABILITY_ROLE}`,
    );
    expect(noRole.command).not.toContain("--enable-row-security");
    expect(noRole.command).toContain(
      `--file=${AUTHENTICATED_BACKUP_NO_RLS_ARCHIVE}`,
    );
    expect(() =>
      buildAuthenticatedBackupDumpInvocation({
        archive: "/tmp/unreviewed.dump" as typeof AUTHENTICATED_BACKUP_ARCHIVE,
      }),
    ).toThrow(/archive path/i);
  });

  it("freezes the authenticated test-seed pg_restore invocation", () => {
    const invocation = buildAuthenticatedRestoreInvocation();
    expect(invocation.environment).toEqual({
      PGPASSFILE: AUTHENTICATED_RESTORE_PASSFILE,
      PGREQUIREAUTH: "scram-sha-256",
      PGSSLMODE: "disable",
      PGCONNECT_TIMEOUT: "5",
    });
    expect(invocation.command).toEqual([
      "pg_restore",
      "--no-password",
      "--host=127.0.0.1",
      "--port=5432",
      `--username=${AUTHENTICATED_RESTORE_LOGIN_ROLE}`,
      `--dbname=${AUTHENTICATED_RESTORE_DATABASE}`,
      `--role=${AUTHENTICATED_RESTORE_CAPABILITY_ROLE}`,
      "--data-only",
      "--enable-row-security",
      "--single-transaction",
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      AUTHENTICATED_BACKUP_ARCHIVE,
    ]);
    expect(invocation.command.join(" ")).not.toMatch(
      /--clean|--create|--disable-triggers|--jobs/i,
    );

    const wrongPassword = buildAuthenticatedRestoreInvocation({
      passfile: AUTHENTICATED_RESTORE_WRONG_PASSFILE,
      requireScram: false,
    });
    expect(wrongPassword.environment).not.toHaveProperty("PGREQUIREAUTH");
    expect(wrongPassword.command).toEqual(invocation.command);
  });

  it("creates and drops only the fixed template0 restore database without FORCE", () => {
    const create = renderCreateAuthenticatedRestoreDatabaseSql();
    expect(create).toContain("pg_catalog.current_database() <> 'postgres'");
    expect(create).toContain(
      `CREATE DATABASE ${AUTHENTICATED_RESTORE_DATABASE}\n  OWNER postgres\n  TEMPLATE template0\n  ENCODING 'UTF8';`,
    );
    expect(create).toContain(AUTHENTICATED_BACKUP_SOURCE_DATABASE);
    expect(create).not.toMatch(/DROP DATABASE|\bFORCE\b/i);

    const drop = renderDropAuthenticatedRestoreDatabaseSql();
    expect(drop).toContain(
      `WHERE datname = '${AUTHENTICATED_RESTORE_DATABASE}'`,
    );
    expect(drop).toContain(`DROP DATABASE ${AUTHENTICATED_RESTORE_DATABASE};`);
    expect(drop).not.toContain(
      `DROP DATABASE ${AUTHENTICATED_BACKUP_SOURCE_DATABASE}`,
    );
    expect(drop).not.toContain("backend_type = 'client backend'");
    expect(drop).toContain("bounded restore target has active backends");
    expect(drop).not.toMatch(/\bFORCE\b|DROP DATABASE IF EXISTS/i);
  });

  it("renders a target-only late restore failure and exact cleanup", () => {
    const create = renderAuthenticatedRestoreFailureCreateSql();
    expect(create).toContain(
      `CREATE FUNCTION ${AUTHENTICATED_RESTORE_FAILURE_FUNCTION}()`,
    );
    expect(create).toContain(
      `BEFORE INSERT ON ${AUTHENTICATED_RESTORE_FAILURE_TABLE}`,
    );
    expect(create).toContain(
      `MESSAGE = '${AUTHENTICATED_RESTORE_FAILURE_MESSAGE}'`,
    );
    expect(create).toContain(
      `REVOKE ALL ON FUNCTION ${AUTHENTICATED_RESTORE_FAILURE_FUNCTION}() FROM PUBLIC;`,
    );

    const cleanup = renderAuthenticatedRestoreFailureCleanupSql();
    expect(cleanup).toContain(
      `DROP TRIGGER ${AUTHENTICATED_RESTORE_FAILURE_TRIGGER}`,
    );
    expect(cleanup).toContain(
      `DROP FUNCTION ${AUTHENTICATED_RESTORE_FAILURE_FUNCTION}();`,
    );
    const residue = renderAuthenticatedRestoreFailureResidueSql();
    expect(residue).toContain(AUTHENTICATED_RESTORE_FAILURE_TRIGGER);
    expect(residue).toContain("procedure.proname = 'b8_restore_failure'");
  });

  it("accepts only the exact 21-entry TABLE DATA archive TOC", () => {
    const toc = renderToc(AUTHENTICATED_BACKUP_RESTORABLE_TABLES);
    const parsed = parseAuthenticatedBackupArchiveToc(toc);
    expect(parsed.map(({ qualifiedTable }) => qualifiedTable)).toEqual(
      AUTHENTICATED_BACKUP_RESTORABLE_TABLES,
    );
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(parsed.every((entry) => Object.isFrozen(entry))).toBe(true);
    expect(
      parsed.findIndex(
        ({ qualifiedTable }) =>
          qualifiedTable === AUTHENTICATED_RESTORE_FAILURE_TABLE,
      ),
    ).toBeGreaterThan(0);

    expect(() =>
      parseAuthenticatedBackupArchiveToc(
        renderToc(AUTHENTICATED_BACKUP_RESTORABLE_TABLES.slice(1)),
      ),
    ).toThrow(/inventory/i);
    expect(() =>
      parseAuthenticatedBackupArchiveToc(
        `${toc}999; 0 999 TABLE DATA shared_data schema_migrations research_cockpit_owner\n`,
      ),
    ).toThrow(/inventory/i);
    expect(() =>
      parseAuthenticatedBackupArchiveToc(
        toc.replace("research_cockpit_owner", "postgres"),
      ),
    ).toThrow(/unreviewed entry/i);
    expect(() =>
      parseAuthenticatedBackupArchiveToc(
        `${toc}999; 0 999 SEQUENCE SET private_data sequence_name research_cockpit_owner\n`,
      ),
    ).toThrow(/unreviewed entry/i);
  });

  it("builds closed UTC canonical fingerprints and an all-table rollback check", () => {
    const queries = renderAuthenticatedBackupFingerprintQueries();
    expect(queries.map(({ table }) => table)).toEqual(
      AUTHENTICATED_BACKUP_RESTORABLE_TABLES,
    );
    expect(Object.isFrozen(queries)).toBe(true);
    for (const query of queries) {
      expect(Object.isFrozen(query)).toBe(true);
      expect(query.sql).toContain(
        `SET LOCAL ROLE ${AUTHENTICATED_BACKUP_CAPABILITY_ROLE};`,
      );
      expect(query.sql).toContain("SET LOCAL TIME ZONE 'UTC';");
      expect(query.sql).toContain(`FROM ${query.table} AS source_row;`);
      expect(query.sql).toContain(
        "ORDER BY pg_catalog.to_jsonb(source_row)::text",
      );
      expect(query.sql).not.toContain("shared_data.schema_migrations");
    }

    const empty = renderRestorableApplicationTablesEmptySql();
    for (const table of AUTHENTICATED_BACKUP_RESTORABLE_TABLES) {
      expect(empty).toContain(`SELECT 1 FROM ${table}`);
    }
    expect(empty).not.toContain("shared_data.schema_migrations");
  });
});

function renderToc(tables: readonly string[]): string {
  return `;
; Archive created by pg_dump 17.11
; Selected TOC Entries:
;
${tables
  .map((qualifiedTable, index) => {
    const [schema, table] = qualifiedTable.split(".");
    return `${index + 1}; 0 ${index + 100} TABLE DATA ${schema} ${table} research_cockpit_owner`;
  })
  .join("\n")}
`;
}
