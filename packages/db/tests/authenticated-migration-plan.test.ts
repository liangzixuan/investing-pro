import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  AUTHENTICATED_MIGRATION_APPLICATION_DIRECTORY,
  AUTHENTICATED_MIGRATION_APPLICATION_FILES,
  AUTHENTICATED_MIGRATION_APPLICATION_MANIFEST_FILE,
  AUTHENTICATED_MIGRATION_IDENTITY_MARKER,
  AUTHENTICATED_MIGRATION_INJECTED_FAILURE_SQLSTATE,
  AUTHENTICATED_MIGRATION_OWNER_ROLE,
  AUTHENTICATED_MIGRATION_PLAN_RELATIVE_DIRECTORY,
  AUTHENTICATED_MIGRATION_PLAN_VERSION,
  AUTHENTICATED_MIGRATION_PLATFORM_FILE,
  AUTHENTICATED_MIGRATION_PLATFORM_SHA256,
  AUTHENTICATED_MIGRATION_ROLE_RESET_MARKER,
  AUTHENTICATED_MIGRATOR_LOGIN_ROLE,
  expectedAuthenticatedMigrationLedgerRows,
  loadAuthenticatedMigrationPlan,
  parseAuthenticatedMigrationManifest,
  renderAuthenticatedApplicationMigration,
  renderAuthenticatedPlatformMigration,
  type AuthenticatedMigrationPlan,
} from "../src/authenticated-migration-plan";

const expectedFiles = [
  "0001_request_context_and_ledger.sql",
  "0002_canonical_entities.sql",
  "0003_temporal_constraints_and_indexes.sql",
  "0004_row_security_and_runtime_grants.sql",
  "0005_non_reusable_resource_ids.sql",
  "0006_null_safe_request_context.sql",
] as const;

describe("versioned authenticated migration source plan", () => {
  it("loads one closed v2 platform/application inventory with immutable hashes", async () => {
    const plan = await loadAuthenticatedMigrationPlan();

    expect(AUTHENTICATED_MIGRATION_PLAN_VERSION).toBe(2);
    expect(AUTHENTICATED_MIGRATION_PLAN_RELATIVE_DIRECTORY).toBe(
      "migration-plans/v2",
    );
    expect(AUTHENTICATED_MIGRATION_PLATFORM_FILE).toBe(
      "platform-bootstrap.sql",
    );
    expect(AUTHENTICATED_MIGRATION_APPLICATION_MANIFEST_FILE).toBe(
      "application-manifest.json",
    );
    expect(AUTHENTICATED_MIGRATION_APPLICATION_DIRECTORY).toBe("application");
    expect(AUTHENTICATED_MIGRATION_APPLICATION_FILES).toEqual(expectedFiles);
    expect(sha256(plan.platformSql)).toBe(
      AUTHENTICATED_MIGRATION_PLATFORM_SHA256,
    );
    expect(plan.manifest).toMatchObject({
      schemaVersion: 1,
      planVersion: 2,
      algorithm: "sha256",
    });
    expect(plan.applicationFiles.map(({ file }) => file)).toEqual(
      expectedFiles,
    );
    expect(plan.manifest.migrations.map(({ id }) => id)).toEqual(
      expectedFiles.map(
        (_file, index) => `v2-${String(index + 1).padStart(4, "0")}`,
      ),
    );
    for (const [index, migration] of plan.applicationFiles.entries()) {
      expect(sha256(migration.sql)).toBe(
        plan.manifest.migrations[index]?.sha256,
      );
      expect(migration.sql).toContain("immutable migrations/ lane remains");
    }
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.manifest.migrations)).toBe(true);
    expect(Object.isFrozen(plan.applicationFiles)).toBe(true);
  });

  it("keeps the historical seven-file manifest separate and byte-valid", async () => {
    const historical = JSON.parse(
      await readFile(
        new URL("../migration-manifest.json", import.meta.url),
        "utf8",
      ),
    ) as {
      migrations: Array<{ file: string; sha256: string }>;
    };

    expect(historical.migrations).toHaveLength(7);
    for (const entry of historical.migrations) {
      const sql = await readFile(
        new URL(`../migrations/${entry.file}`, import.meta.url),
        "utf8",
      );
      expect(sha256(sql)).toBe(entry.sha256);
    }
  });

  it("exposes the exact frozen ledger expectation without widening applied_by", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const rows = expectedAuthenticatedMigrationLedgerRows(plan.manifest);

    expect(rows).toEqual(
      plan.manifest.migrations.map((entry) => ({
        migrationId: entry.id,
        fileName: entry.file,
        sha256: entry.sha256,
      })),
    );
    expect(Object.isFrozen(rows)).toBe(true);
    expect(rows.every((row) => Object.isFrozen(row))).toBe(true);
    expect(plan.applicationFiles[0]?.sql).toContain(
      "applied_by text NOT NULL DEFAULT session_user",
    );
    expect(plan.applicationFiles.map(({ sql }) => sql).join("\n")).not.toMatch(
      /\bapplied_by\s*=/i,
    );
  });
});

describe("authenticated platform renderer", () => {
  it("renders the reviewed privileged bootstrap as one guarded transaction", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const sql = renderAuthenticatedPlatformMigration(plan);

    expect(sql.match(/^BEGIN;$/gm)).toHaveLength(1);
    expect(sql.match(/^COMMIT;$/gm)).toHaveLength(1);
    expect(sql.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      sql.indexOf("DO $platform_preflight$"),
    );
    expect(sql).toContain(
      "versioned platform bootstrap requires a pristine target",
    );
    expect(sql).toContain("CREATE ROLE research_cockpit_owner");
    expect(sql).toContain("CREATE SCHEMA shared_data;");
    expect(sql).toContain(
      "CREATE EXTENSION btree_gist WITH SCHEMA shared_data;",
    );
    expect(sql).toContain(
      "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shared_data FROM PUBLIC;",
    );
    expect(sql).toContain(
      "REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC",
    );
    expect(sql).not.toMatch(
      /\bCREATE\s+(?:TABLE|FUNCTION|PROCEDURE|POLICY|TRIGGER|INDEX)\b/i,
    );
    expect(sql).not.toContain("SET LOCAL ROLE");
  });

  it("offers only a deterministic pre-commit platform rollback variant", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const success = renderAuthenticatedPlatformMigration(plan);
    const rollback = renderAuthenticatedPlatformMigration(plan, true);

    expect(success).not.toContain("SELECT 1 / 0;");
    expect(rollback.match(/SELECT 1 \/ 0;/g)).toHaveLength(1);
    expect(rollback).toContain(
      `division_by_zero has SQLSTATE ${AUTHENTICATED_MIGRATION_INJECTED_FAILURE_SQLSTATE}`,
    );
    expect(rollback.indexOf("SELECT 1 / 0;")).toBeLessThan(
      rollback.lastIndexOf("COMMIT;"),
    );
    expect(() =>
      renderAuthenticatedPlatformMigration(plan, "yes" as never),
    ).toThrow(/must be boolean/i);
  });
});

describe("authenticated application renderer", () => {
  it("renders six migrations atomically under the fixed owner role and resets it", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const sql = renderAuthenticatedApplicationMigration(plan);

    expect(sql.match(/^BEGIN;$/gm)).toHaveLength(1);
    expect(sql.match(/^COMMIT;$/gm)).toHaveLength(1);
    expect(
      sql.match(/^SET LOCAL ROLE research_cockpit_owner;$/gm),
    ).toHaveLength(1);
    expect(sql.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      sql.indexOf(`SET LOCAL ROLE ${AUTHENTICATED_MIGRATION_OWNER_ROLE};`),
    );
    expect(sql).toContain(
      `session_user <> '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'`,
    );
    expect(sql).toContain(
      "versioned application migration requires an empty ledger",
    );
    expect(
      sql.match(
        /INSERT INTO shared_data\.schema_migrations \(migration_id, file_name, sha256\)/g,
      ),
    ).toHaveLength(6);
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner\s+REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;/,
    );
    expect(sql).not.toMatch(
      /ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner IN SCHEMA [^;]+\s+REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;/,
    );

    let previousLedger = -1;
    for (const row of expectedAuthenticatedMigrationLedgerRows(plan.manifest)) {
      const bodyPosition = sql.indexOf(
        `-- authenticated application migration ${row.migrationId}: ${row.fileName}`,
      );
      const ledgerPosition = sql.indexOf(
        `VALUES ('${row.migrationId}', '${row.fileName}', '${row.sha256}');`,
      );
      expect(bodyPosition).toBeGreaterThan(previousLedger);
      expect(ledgerPosition).toBeGreaterThan(bodyPosition);
      previousLedger = ledgerPosition;
    }
    expect(
      sql.indexOf(AUTHENTICATED_MIGRATION_IDENTITY_MARKER),
    ).toBeGreaterThan(previousLedger);
    expect(sql.indexOf(AUTHENTICATED_MIGRATION_IDENTITY_MARKER)).toBeLessThan(
      sql.lastIndexOf("COMMIT;"),
    );
    expect(
      sql.indexOf(AUTHENTICATED_MIGRATION_ROLE_RESET_MARKER),
    ).toBeGreaterThan(sql.lastIndexOf("COMMIT;"));
    expect(sql).not.toContain("SELECT 1 / 0;");
  });

  it("offers only a deterministic pre-identity application rollback variant", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const rollback = renderAuthenticatedApplicationMigration(plan, true);

    expect(rollback.match(/SELECT 1 \/ 0;/g)).toHaveLength(1);
    expect(rollback.indexOf("SELECT 1 / 0;")).toBeGreaterThan(
      rollback.lastIndexOf("INSERT INTO shared_data.schema_migrations"),
    );
    expect(rollback.indexOf("SELECT 1 / 0;")).toBeLessThan(
      rollback.indexOf(AUTHENTICATED_MIGRATION_IDENTITY_MARKER),
    );
    expect(rollback.indexOf("SELECT 1 / 0;")).toBeLessThan(
      rollback.lastIndexOf("COMMIT;"),
    );
    expect(() =>
      renderAuthenticatedApplicationMigration(plan, 1 as never),
    ).toThrow(/must be boolean/i);
  });

  it("rejects checksum drift and platform controls inside application assets", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const drifted = mutablePlan(plan);
    drifted.applicationFiles[0]!.sql += "\nSELECT 1;\n";
    expect(() => renderAuthenticatedApplicationMigration(drifted)).toThrow(
      /checksum differs/i,
    );

    const crossed = mutablePlan(plan);
    crossed.applicationFiles[0]!.sql += "\nCREATE SCHEMA escaped;\n";
    crossed.manifest.migrations[0]!.sha256 = sha256(
      crossed.applicationFiles[0]!.sql,
    );
    expect(() => renderAuthenticatedApplicationMigration(crossed)).toThrow(
      /prohibited|platform boundary/i,
    );

    const controlled = mutablePlan(plan);
    controlled.applicationFiles[0]!.sql += "\nCOMMIT;\n";
    controlled.manifest.migrations[0]!.sha256 = sha256(
      controlled.applicationFiles[0]!.sql,
    );
    expect(() => renderAuthenticatedApplicationMigration(controlled)).toThrow(
      /transaction or psql control/i,
    );
  });

  it("rejects platform drift before rendering either phase", async () => {
    const plan = mutablePlan(await loadAuthenticatedMigrationPlan());
    plan.platformSql = plan.platformSql.replace(
      "CREATE EXTENSION btree_gist",
      "CREATE EXTENSION hstore",
    );

    expect(() => renderAuthenticatedPlatformMigration(plan)).toThrow(
      /platform bootstrap checksum differs/i,
    );
    expect(() => renderAuthenticatedApplicationMigration(plan)).toThrow(
      /platform bootstrap checksum differs/i,
    );
  });
});

describe("authenticated migration manifest parser", () => {
  it("rejects extra fields, wrong versions, malformed paths, and reordering", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const manifest = mutablePlan(plan).manifest;

    expect(() =>
      parseAuthenticatedMigrationManifest({
        ...manifest,
        unexpected: true,
      }),
    ).toThrow(/unexpected fields/i);
    expect(() =>
      parseAuthenticatedMigrationManifest({
        ...manifest,
        planVersion: 1,
      }),
    ).toThrow(/unsupported/i);

    const traversal = structuredClone(manifest);
    traversal.migrations[0]!.file = "../0001_escape.sql";
    expect(() => parseAuthenticatedMigrationManifest(traversal)).toThrow(
      /malformed|out of order/i,
    );

    const reordered = structuredClone(manifest);
    reordered.migrations.reverse();
    expect(() => parseAuthenticatedMigrationManifest(reordered)).toThrow(
      /malformed|out of order/i,
    );
  });
});

function mutablePlan(plan: AuthenticatedMigrationPlan): {
  platformSql: string;
  manifest: {
    schemaVersion: 1;
    planVersion: 2;
    algorithm: "sha256";
    migrations: Array<{ id: string; file: string; sha256: string }>;
  };
  applicationFiles: Array<{ file: string; sql: string }>;
} {
  return {
    platformSql: plan.platformSql,
    manifest: {
      schemaVersion: 1,
      planVersion: 2,
      algorithm: "sha256",
      migrations: plan.manifest.migrations.map((entry) => ({ ...entry })),
    },
    applicationFiles: plan.applicationFiles.map((migration) => ({
      ...migration,
    })),
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
