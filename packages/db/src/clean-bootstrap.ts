import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkMigrations,
  detectProhibitedSql,
  loadMigrationFiles,
  type MigrationFile,
} from "./check-migrations";

export const CLEAN_BOOTSTRAP_DATABASE_NAME = "research_cockpit_acceptance_test";

const CLEAN_BOOTSTRAP_ADVISORY_LOCK = "818476709640328251";
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

interface MigrationManifestEntry {
  id: string;
  file: string;
  sha256: string;
}

interface MigrationManifest {
  schemaVersion: 1;
  algorithm: "sha256";
  migrations: MigrationManifestEntry[];
}

export interface CleanBootstrapTarget {
  databaseName: string;
  containerId: string;
}

export interface CleanBootstrapInput {
  target: CleanBootstrapTarget;
  manifest: unknown;
  migrations: MigrationFile[];
}

/**
 * Loads the reviewed package contract and renders a CI-only, clean-database
 * bootstrap. This is deliberately not an incremental deployment runner.
 */
export async function renderReviewedCleanBootstrap(
  target: CleanBootstrapTarget,
): Promise<string> {
  const violations = await checkMigrations(packageRoot);
  if (violations.length > 0) {
    throw new Error(
      `Refusing clean bootstrap because the migration contract is invalid:\n- ${violations.join("\n- ")}`,
    );
  }

  const manifest = JSON.parse(
    await readFile(join(packageRoot, "migration-manifest.json"), "utf8"),
  ) as unknown;
  const migrations = await loadMigrationFiles(join(packageRoot, "migrations"));
  return renderCleanBootstrap({ target, manifest, migrations });
}

/**
 * Renders exactly one transaction. Every reviewed migration body and its
 * ledger record therefore succeeds or rolls back as one clean bootstrap.
 */
export function renderCleanBootstrap(input: CleanBootstrapInput): string {
  assertExactKeys(input, ["target", "manifest", "migrations"], "input");
  assertCleanBootstrapTarget(input.target);
  const manifest = parseManifest(input.manifest);
  const orderedMigrations = validateMigrationPlan(manifest, input.migrations);

  const lines = [
    "BEGIN;",
    `SELECT pg_catalog.pg_advisory_xact_lock(${CLEAN_BOOTSTRAP_ADVISORY_LOCK}::bigint);`,
    renderCleanTargetPreflight(),
  ];

  for (const { entry, body } of orderedMigrations) {
    lines.push(
      `-- reviewed migration ${entry.id}: ${entry.file}`,
      body,
      "INSERT INTO shared_data.schema_migrations (migration_id, file_name, sha256)",
      `VALUES ('${entry.id}', '${entry.file}', '${entry.sha256}');`,
    );
  }
  lines.push("COMMIT;", "");

  const rendered = lines.join("\n");
  const prohibited = detectProhibitedSql(rendered);
  if (prohibited.length > 0) {
    throw new Error(
      `Refusing clean bootstrap with prohibited SQL:\n- ${prohibited.join("\n- ")}`,
    );
  }
  return rendered;
}

export function assertCleanBootstrapTarget(target: CleanBootstrapTarget): void {
  assertExactKeys(target, ["databaseName", "containerId"], "target");
  if (target.databaseName !== CLEAN_BOOTSTRAP_DATABASE_NAME) {
    throw new Error(
      `Clean bootstrap database must be exactly ${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    );
  }
  if (!/^[0-9a-f]{12,64}$/.test(target.containerId)) {
    throw new Error(
      "Clean bootstrap container ID must be 12-64 lowercase hexadecimal characters",
    );
  }
}

function renderCleanTargetPreflight(): string {
  return `DO $clean_bootstrap$
BEGIN
  IF pg_catalog.current_database() <> '${CLEAN_BOOTSTRAP_DATABASE_NAME}' THEN
    RAISE EXCEPTION 'clean bootstrap refused for database %',
      pg_catalog.current_database();
  END IF;
  IF pg_catalog.to_regnamespace('shared_data') IS NOT NULL
    OR pg_catalog.to_regnamespace('private_data') IS NOT NULL
  THEN
    RAISE EXCEPTION 'clean bootstrap requires an empty application target';
  END IF;
END;
$clean_bootstrap$;`;
}

function validateMigrationPlan(
  manifest: MigrationManifest,
  migrations: MigrationFile[],
): Array<{ entry: MigrationManifestEntry; body: string }> {
  if (!Array.isArray(migrations)) {
    throw new Error("Clean bootstrap migrations must be an array");
  }

  for (const [index, migration] of migrations.entries()) {
    assertExactKeys(migration, ["file", "sql"], `migration ${index}`);
    if (
      typeof migration.file !== "string" ||
      typeof migration.sql !== "string"
    ) {
      throw new Error(`Clean bootstrap migration ${index} is malformed`);
    }
  }

  const diskFiles = migrations.map(({ file }) => file);
  const sortedDiskFiles = [...diskFiles].sort(compareText);
  if (
    new Set(diskFiles).size !== diskFiles.length ||
    !sameStrings(diskFiles, sortedDiskFiles)
  ) {
    throw new Error(
      "Clean bootstrap migration files must be unique and sorted",
    );
  }

  const manifestFiles = manifest.migrations.map(({ file }) => file);
  if (!sameStrings(manifestFiles, diskFiles)) {
    throw new Error(
      "Clean bootstrap manifest must exactly match the ordered migration files",
    );
  }

  return manifest.migrations.map((entry, index) => {
    const migration = migrations[index];
    if (!migration || migration.file !== entry.file) {
      throw new Error(`Missing reviewed migration: ${entry.file}`);
    }
    const actualHash = createHash("sha256").update(migration.sql).digest("hex");
    if (actualHash !== entry.sha256) {
      throw new Error(
        `Migration checksum differs from manifest: ${entry.file}`,
      );
    }
    const prohibited = detectProhibitedSql(migration.sql);
    if (prohibited.length > 0) {
      throw new Error(
        `${entry.file} contains prohibited SQL:\n- ${prohibited.join("\n- ")}`,
      );
    }
    return { entry, body: stripExactOuterTransaction(migration) };
  });
}

function stripExactOuterTransaction(migration: MigrationFile): string {
  const wrapper = /^BEGIN;\r?\n([\s\S]*)\r?\nCOMMIT;(?:\r?\n)?$/.exec(
    migration.sql,
  );
  const beginLines = migration.sql.match(/^BEGIN;\s*$/gm)?.length ?? 0;
  const commitLines = migration.sql.match(/^COMMIT;\s*$/gm)?.length ?? 0;
  if (!wrapper || beginLines !== 1 || commitLines !== 1) {
    throw new Error(
      `${migration.file} must have exactly one outer BEGIN/COMMIT wrapper`,
    );
  }
  const body = wrapper[1];
  if (!body || body.trim().length === 0) {
    throw new Error(`${migration.file} must contain a migration body`);
  }
  const controls = inspectEmbeddedSqlControls(body);
  if (controls.length > 0) {
    throw new Error(
      `${migration.file} contains embedded transaction or psql control: ${controls.join(", ")}`,
    );
  }
  return body;
}

export function inspectEmbeddedSqlControls(sql: string): string[] {
  const visible = maskSqlQuotedContent(sql);
  const violations: string[] = [];
  if (visible.includes("\\")) violations.push("psql meta-command");

  const prohibitedStatement =
    /^(?:BEGIN\b|START\s+TRANSACTION\b|COMMIT\b|END\b|ROLLBACK\b|ABORT\b|SAVEPOINT\b|RELEASE\b|PREPARE\s+TRANSACTION\b|SET\s+TRANSACTION\b|SET\s+SESSION\s+CHARACTERISTICS\b|SET\s+ROLE\b|RESET\s+ROLE\b|SET\s+SESSION\s+AUTHORIZATION\b|RESET\s+SESSION\s+AUTHORIZATION\b|DISCARD\s+ALL\b)/i;
  for (const statement of visible.split(";")) {
    const normalized = statement.trim();
    const match = prohibitedStatement.exec(normalized);
    if (match?.[0]) violations.push(match[0].replace(/\s+/g, " "));
  }
  return [...new Set(violations)];
}

export function maskSqlQuotedContent(sql: string): string {
  const characters = sql.split("");
  const masked = [...characters];
  let index = 0;

  const maskRange = (start: number, end: number): void => {
    for (let position = start; position < end; position += 1) {
      if (masked[position] !== "\n" && masked[position] !== "\r") {
        masked[position] = " ";
      }
    }
  };

  while (index < characters.length) {
    const current = characters[index];
    const next = characters[index + 1];
    if (current === "-" && next === "-") {
      const start = index;
      index += 2;
      while (index < characters.length && characters[index] !== "\n")
        index += 1;
      maskRange(start, index);
      continue;
    }
    if (current === "/" && next === "*") {
      const start = index;
      let depth = 1;
      index += 2;
      while (index < characters.length && depth > 0) {
        if (characters[index] === "/" && characters[index + 1] === "*") {
          depth += 1;
          index += 2;
        } else if (characters[index] === "*" && characters[index + 1] === "/") {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      if (depth !== 0)
        throw new Error("SQL contains an unterminated block comment");
      maskRange(start, index);
      continue;
    }
    if (current === "'" || current === '"') {
      const quote = current;
      const start = index;
      index += 1;
      let closed = false;
      while (index < characters.length) {
        if (characters[index] === quote) {
          if (characters[index + 1] === quote) {
            index += 2;
            continue;
          }
          index += 1;
          closed = true;
          break;
        }
        index += 1;
      }
      if (!closed) throw new Error("SQL contains an unterminated quoted value");
      maskRange(start, index);
      continue;
    }
    if (current === "$") {
      const remainder = characters.slice(index).join("");
      const delimiter = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(remainder)?.[0];
      if (delimiter) {
        const start = index;
        index += delimiter.length;
        const closing = sql.indexOf(delimiter, index);
        if (closing < 0)
          throw new Error("SQL contains an unterminated dollar quote");
        index = closing + delimiter.length;
        maskRange(start, index);
        continue;
      }
    }
    index += 1;
  }
  return masked.join("");
}

function parseManifest(value: unknown): MigrationManifest {
  assertRecord(value, "Migration manifest must be an object");
  assertExactKeys(
    value,
    ["schemaVersion", "algorithm", "migrations"],
    "manifest",
  );
  if (value.schemaVersion !== 1 || value.algorithm !== "sha256") {
    throw new Error("Migration manifest schema and algorithm are unsupported");
  }
  if (!Array.isArray(value.migrations) || value.migrations.length === 0) {
    throw new Error("Migration manifest needs at least one migration");
  }

  const migrations = value.migrations.map((entry, index) => {
    assertRecord(entry, `Manifest migration ${index} must be an object`);
    assertExactKeys(
      entry,
      ["id", "file", "sha256"],
      `manifest migration ${index}`,
    );
    if (
      typeof entry.id !== "string" ||
      !/^\d{4}$/.test(entry.id) ||
      typeof entry.file !== "string" ||
      !/^\d{4}_[a-z0-9_]+\.sql$/.test(entry.file) ||
      !entry.file.startsWith(`${entry.id}_`) ||
      typeof entry.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(entry.sha256)
    ) {
      throw new Error(`Manifest migration ${index} is malformed`);
    }
    return {
      id: entry.id,
      file: entry.file,
      sha256: entry.sha256,
    };
  });

  const ids = migrations.map(({ id }) => id);
  if (
    new Set(ids).size !== ids.length ||
    !sameStrings(ids, [...ids].sort(compareText))
  ) {
    throw new Error("Migration manifest IDs must be unique and ordered");
  }
  return { schemaVersion: 1, algorithm: "sha256", migrations };
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
