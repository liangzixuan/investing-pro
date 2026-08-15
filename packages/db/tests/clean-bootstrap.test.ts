import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  assertCleanBootstrapTarget,
  CLEAN_BOOTSTRAP_DATABASE_NAME,
  inspectEmbeddedSqlControls,
  renderCleanBootstrap,
  renderReviewedCleanBootstrap,
} from "../src/clean-bootstrap";
import {
  detectProhibitedSql,
  loadMigrationFiles,
  type MigrationFile,
} from "../src/check-migrations";

interface ManifestFixture {
  schemaVersion: number;
  algorithm: string;
  migrations: Array<{ id: string; file: string; sha256: string }>;
}

const target = {
  databaseName: CLEAN_BOOTSTRAP_DATABASE_NAME,
  containerId: "0123456789abcdef0123456789abcdef",
};

describe("clean PostgreSQL bootstrap rendering", () => {
  it("renders the reviewed bundle as one locked atomic transaction", async () => {
    const rendered = await renderReviewedCleanBootstrap(target);
    const manifest = await loadManifest();

    expect(rendered.match(/^BEGIN;$/gm)).toHaveLength(1);
    expect(rendered.match(/^COMMIT;$/gm)).toHaveLength(1);
    expect(rendered).toContain("pg_catalog.pg_advisory_xact_lock(");
    expect(rendered.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      rendered.indexOf("clean bootstrap requires an empty application target"),
    );
    expect(
      rendered.indexOf("clean bootstrap requires an empty application target"),
    ).toBeLessThan(rendered.indexOf("CREATE SCHEMA shared_data;"));
    expect(
      rendered.match(
        /INSERT INTO shared_data\.schema_migrations \(migration_id, file_name, sha256\)/g,
      ),
    ).toHaveLength(manifest.migrations.length);
    expect(rendered.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect(detectProhibitedSql(rendered)).toEqual([]);
    expect(rendered).not.toMatch(/\b(?:DROP|TRUNCATE)\b/i);
    expect(rendered).not.toContain(target.containerId);
  });

  it("places every ledger insert after its reviewed body and before commit", async () => {
    const rendered = await renderReviewedCleanBootstrap(target);
    const manifest = await loadManifest();
    const migrations = await loadMigrationFiles();
    let previousLedger = -1;

    for (const [index, entry] of manifest.migrations.entries()) {
      const migration = migrations[index];
      if (!migration) throw new Error(`Missing test migration ${entry.file}`);
      const bodyMarker = firstBodyStatement(migration.sql);
      const bodyPosition = rendered.indexOf(bodyMarker);
      const ledgerPosition = rendered.indexOf(
        `VALUES ('${entry.id}', '${entry.file}', '${entry.sha256}');`,
      );
      expect(bodyPosition).toBeGreaterThan(previousLedger);
      expect(ledgerPosition).toBeGreaterThan(bodyPosition);
      expect(ledgerPosition).toBeLessThan(rendered.lastIndexOf("COMMIT;"));
      previousLedger = ledgerPosition;
    }
  });

  it("refuses checksum drift before rendering any SQL", async () => {
    const input = await reviewedInput();
    input.manifest.migrations[0]!.sha256 = "0".repeat(64);

    expect(() => renderCleanBootstrap(input)).toThrow(/checksum differs/i);
  });

  it("refuses a rehashed migration containing destructive SQL", async () => {
    const input = await reviewedInput();
    replaceAndRehash(input, 0, (sql) =>
      sql.replace(
        "CREATE SCHEMA shared_data;",
        "DROP TABLE private_data.theses;\nCREATE SCHEMA shared_data;",
      ),
    );

    expect(() => renderCleanBootstrap(input)).toThrow(/prohibited SQL/i);
  });

  it("refuses reordered, missing, duplicated, and malformed manifest entries", async () => {
    const reordered = await reviewedInput();
    reordered.manifest.migrations.reverse();
    expect(() => renderCleanBootstrap(reordered)).toThrow(/ordered|exactly/i);

    const missing = await reviewedInput();
    missing.manifest.migrations.pop();
    expect(() => renderCleanBootstrap(missing)).toThrow(/exactly match/i);

    const unsortedFiles = await reviewedInput();
    unsortedFiles.migrations.reverse();
    expect(() => renderCleanBootstrap(unsortedFiles)).toThrow(
      /unique and sorted/i,
    );

    const duplicated = await reviewedInput();
    duplicated.manifest.migrations[1] = {
      ...duplicated.manifest.migrations[0]!,
    };
    expect(() => renderCleanBootstrap(duplicated)).toThrow(/unique|ordered/i);

    const unsupported = await reviewedInput();
    unsupported.manifest.algorithm = "sha512";
    expect(() => renderCleanBootstrap(unsupported)).toThrow(/unsupported/i);

    const extraField = await reviewedInput();
    expect(() =>
      renderCleanBootstrap({
        ...extraField,
        manifest: { ...extraField.manifest, unexpected: true },
      }),
    ).toThrow(/unexpected fields/i);
  });

  it.each([
    ["leading content", (sql: string) => `\n${sql}`],
    ["trailing content", (sql: string) => `${sql}SELECT 1;\n`],
    [
      "nested transaction wrapper",
      (sql: string) =>
        sql.replace(
          "CREATE SCHEMA shared_data;",
          "BEGIN;\nCREATE SCHEMA shared_data;",
        ),
    ],
    ["missing commit", (sql: string) => sql.replace(/COMMIT;\s*$/, "")],
  ])("requires an exact outer wrapper for %s", async (_label, transform) => {
    const input = await reviewedInput();
    replaceAndRehash(input, 0, transform);

    expect(() => renderCleanBootstrap(input)).toThrow(
      /exactly one outer BEGIN\/COMMIT wrapper/i,
    );
  });

  it.each([
    ["inline commit", "SELECT 1; COMMIT; SELECT 2;"],
    ["inline rollback", "SELECT 1; ROLLBACK; SELECT 2;"],
    ["psql gexec", "SELECT 'SELECT 1'; \\gexec"],
    ["psql include", "\\include hidden.sql"],
  ])("rejects an embedded %s control", async (_label, control) => {
    const input = await reviewedInput();
    replaceAndRehash(input, 0, (sql) =>
      sql.replace(
        "CREATE SCHEMA shared_data;",
        `${control}\nCREATE SCHEMA shared_data;`,
      ),
    );
    expect(() => renderCleanBootstrap(input)).toThrow(
      /embedded transaction or psql control/i,
    );
  });

  it("ignores transaction words inside quotes, comments, and procedure bodies", () => {
    expect(
      inspectEmbeddedSqlControls(`SELECT 'COMMIT;';
-- ROLLBACK;
DO $body$
BEGIN
  RAISE NOTICE 'BEGIN';
END;
$body$;`),
    ).toEqual([]);
  });

  it("accepts exact CRLF transaction wrappers", async () => {
    const input = await reviewedInput();
    replaceAndRehash(input, 0, (sql) => sql.replaceAll("\n", "\r\n"));

    expect(() => renderCleanBootstrap(input)).not.toThrow();
  });
});

describe("clean bootstrap target guard", () => {
  it("accepts only the fixed acceptance database and lowercase container IDs", () => {
    expect(() => assertCleanBootstrapTarget(target)).not.toThrow();
    expect(() =>
      assertCleanBootstrapTarget({ ...target, containerId: "a".repeat(12) }),
    ).not.toThrow();
    expect(() =>
      assertCleanBootstrapTarget({ ...target, containerId: "f".repeat(64) }),
    ).not.toThrow();
  });

  it.each([
    ["another_test", target.containerId],
    [CLEAN_BOOTSTRAP_DATABASE_NAME, "a".repeat(11)],
    [CLEAN_BOOTSTRAP_DATABASE_NAME, "a".repeat(65)],
    [CLEAN_BOOTSTRAP_DATABASE_NAME, "ABCDEF012345"],
    [CLEAN_BOOTSTRAP_DATABASE_NAME, "0123456789ab;echo"],
  ])("rejects unsafe target %s / %s", (databaseName, containerId) => {
    expect(() =>
      assertCleanBootstrapTarget({ databaseName, containerId }),
    ).toThrow();
  });

  it("rejects missing or unexpected target fields", () => {
    expect(() =>
      assertCleanBootstrapTarget({
        ...target,
        unexpected: true,
      } as never),
    ).toThrow(/unexpected fields/i);
    expect(() =>
      assertCleanBootstrapTarget({
        databaseName: target.databaseName,
      } as never),
    ).toThrow(/missing/i);
  });
});

async function reviewedInput(): Promise<{
  target: typeof target;
  manifest: ManifestFixture;
  migrations: MigrationFile[];
}> {
  return {
    target: { ...target },
    manifest: await loadManifest(),
    migrations: (await loadMigrationFiles()).map((migration) => ({
      ...migration,
    })),
  };
}

async function loadManifest(): Promise<ManifestFixture> {
  return JSON.parse(
    await readFile(
      new URL("../migration-manifest.json", import.meta.url),
      "utf8",
    ),
  ) as ManifestFixture;
}

function replaceAndRehash(
  input: Awaited<ReturnType<typeof reviewedInput>>,
  index: number,
  transform: (sql: string) => string,
): void {
  const migration = input.migrations[index];
  const entry = input.manifest.migrations[index];
  if (!migration || !entry) throw new Error("Missing migration test fixture");
  migration.sql = transform(migration.sql);
  entry.sha256 = createHash("sha256").update(migration.sql).digest("hex");
}

function firstBodyStatement(sql: string): string {
  const match = /^BEGIN;\r?\n\s*([\s\S]*?;)\r?\n/.exec(sql);
  if (!match?.[1]) throw new Error("Missing first migration statement");
  return match[1].trim();
}
