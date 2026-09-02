import { createHash } from "node:crypto";
import { constants, DatabaseSync } from "node:sqlite";

import { vaultError } from "./errors";
import { LOCAL_RESEARCH_VAULT_PROFILE } from "./model";

export const LOCAL_RESEARCH_VAULT_APPLICATION_ID = 0x52_43_56_31;
export const LOCAL_RESEARCH_VAULT_SCHEMA_VERSION = 2;
const LEGACY_SCHEMA_VERSION = 1;

const CREATE_SCHEMA_V1_SQL = `
CREATE TABLE vault_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL CHECK(length(sha256) = 64),
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE vault_meta (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  profile TEXT NOT NULL CHECK(profile = '${LOCAL_RESEARCH_VAULT_PROFILE}'),
  schema_version INTEGER NOT NULL CHECK(schema_version IN (1, 2)),
  schema_sha256 TEXT NOT NULL CHECK(length(schema_sha256) = 64),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE vault_records (
  kind TEXT NOT NULL CHECK(kind IN ('thesis','settings','watchlist','alert_definition','job_state','portfolio')),
  record_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version >= 1),
  payload_nonce BLOB NOT NULL CHECK(length(payload_nonce) = 12),
  payload_ciphertext BLOB NOT NULL,
  payload_tag BLOB NOT NULL CHECK(length(payload_tag) = 16),
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(kind, record_id)
) STRICT;

CREATE TABLE vault_attachments (
  attachment_id TEXT PRIMARY KEY,
  record_kind TEXT NOT NULL,
  record_id TEXT NOT NULL,
  record_version INTEGER NOT NULL CHECK(record_version >= 1),
  media_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK(byte_length >= 0 AND byte_length <= 16777216),
  content_nonce BLOB NOT NULL CHECK(length(content_nonce) = 12),
  content_ciphertext BLOB NOT NULL,
  content_tag BLOB NOT NULL CHECK(length(content_tag) = 16),
  content_sha256 TEXT NOT NULL CHECK(length(content_sha256) = 64),
  created_at TEXT NOT NULL,
  FOREIGN KEY(record_kind, record_id)
    REFERENCES vault_records(kind, record_id) ON DELETE CASCADE
) STRICT;

CREATE TABLE vault_tombstones (
  kind TEXT NOT NULL,
  record_id TEXT NOT NULL,
  deleted_version INTEGER NOT NULL CHECK(deleted_version >= 2),
  prior_payload_sha256 TEXT NOT NULL CHECK(length(prior_payload_sha256) = 64),
  deleted_at TEXT NOT NULL,
  PRIMARY KEY(kind, record_id)
) STRICT;

CREATE TABLE vault_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  request_sha256 TEXT NOT NULL CHECK(length(request_sha256) = 64),
  operation TEXT NOT NULL CHECK(operation IN ('put','delete','put_attachment')),
  record_kind TEXT NOT NULL,
  record_id TEXT NOT NULL,
  resulting_version INTEGER NOT NULL CHECK(resulting_version >= 1),
  result_sha256 TEXT NOT NULL CHECK(length(result_sha256) = 64),
  attachment_id TEXT,
  committed_at TEXT NOT NULL
) STRICT;

CREATE TABLE vault_audit (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('record_created','record_updated','record_deleted','attachment_added')),
  record_kind TEXT NOT NULL,
  record_id TEXT NOT NULL,
  from_version INTEGER NOT NULL CHECK(from_version >= 0),
  to_version INTEGER NOT NULL CHECK(to_version >= 1),
  request_sha256 TEXT NOT NULL CHECK(length(request_sha256) = 64),
  result_sha256 TEXT NOT NULL CHECK(length(result_sha256) = 64),
  attachment_id TEXT
) STRICT;

CREATE INDEX vault_records_kind_idx
  ON vault_records(kind, record_id);
CREATE INDEX vault_attachments_record_idx
  ON vault_attachments(record_kind, record_id, attachment_id);
CREATE INDEX vault_audit_occurred_idx
  ON vault_audit(occurred_at, sequence);
`;

const MIGRATION_V2_SQL = `
CREATE UNIQUE INDEX vault_idempotency_request_idx
  ON vault_idempotency(request_sha256);
CREATE UNIQUE INDEX vault_audit_request_idx
  ON vault_audit(request_sha256);
`;

const LEGACY_SCHEMA_SHA256 = createHash("sha256")
  .update(CREATE_SCHEMA_V1_SQL, "utf8")
  .digest("hex");
const MIGRATION_V2_SHA256 = createHash("sha256")
  .update(MIGRATION_V2_SQL, "utf8")
  .digest("hex");

export const LOCAL_RESEARCH_VAULT_SCHEMA_SHA256 = createHash("sha256")
  .update(CREATE_SCHEMA_V1_SQL, "utf8")
  .update(MIGRATION_V2_SQL, "utf8")
  .digest("hex");

const EXPECTED_TABLES = [
  "vault_attachments",
  "vault_audit",
  "vault_idempotency",
  "vault_meta",
  "vault_migrations",
  "vault_records",
  "vault_tombstones",
] as const;

const EXPECTED_INDEXES = [
  "vault_attachments_record_idx",
  "vault_audit_occurred_idx",
  "vault_audit_request_idx",
  "vault_idempotency_request_idx",
  "vault_records_kind_idx",
] as const;

const LEGACY_EXPECTED_INDEXES = [
  "vault_attachments_record_idx",
  "vault_audit_occurred_idx",
  "vault_records_kind_idx",
] as const;

const EXPECTED_SCHEMA_INVENTORY_SHA256 = referenceSchemaInventorySha256([
  CREATE_SCHEMA_V1_SQL,
  MIGRATION_V2_SQL,
]);
const LEGACY_SCHEMA_INVENTORY_SHA256 = referenceSchemaInventorySha256([
  CREATE_SCHEMA_V1_SQL,
]);

export function configureLocalResearchVaultDatabase(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA trusted_schema = OFF;
    PRAGMA secure_delete = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA wal_autocheckpoint = 256;
    PRAGMA journal_size_limit = 16777216;
    PRAGMA max_page_count = 131072;
  `);
}

export function initializeLocalResearchVaultSchema(
  db: DatabaseSync,
  createdAt: string,
): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    applyVersionOneSchema(db, createdAt);
    applyVersionTwoMigration(db, createdAt);
    db.exec("COMMIT");
  } catch (error) {
    rollbackOrClose(db, error);
  }
}

export function initializeLegacyLocalResearchVaultSchema(
  db: DatabaseSync,
  createdAt: string,
): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    applyVersionOneSchema(db, createdAt);
    db.exec("COMMIT");
  } catch (error) {
    rollbackOrClose(db, error);
  }
}

export function migrateLocalResearchVaultSchema(
  db: DatabaseSync,
  appliedAt: string,
): void {
  const applicationId = readSinglePragmaNumber(db, "application_id");
  const userVersion = readSinglePragmaNumber(db, "user_version");
  if (applicationId !== LOCAL_RESEARCH_VAULT_APPLICATION_ID) {
    throw vaultError("VAULT_CORRUPT");
  }
  if (userVersion === LOCAL_RESEARCH_VAULT_SCHEMA_VERSION) return;
  if (userVersion !== LEGACY_SCHEMA_VERSION) {
    throw vaultError("VAULT_CORRUPT");
  }
  verifyVersionOneSchema(db);
  db.exec("BEGIN IMMEDIATE");
  try {
    applyVersionTwoMigration(db, appliedAt);
    db.exec("COMMIT");
  } catch (error) {
    rollbackOrClose(db, error);
  }
}

function applyVersionOneSchema(db: DatabaseSync, createdAt: string): void {
  db.exec(CREATE_SCHEMA_V1_SQL);
  db.prepare(
    "INSERT INTO vault_migrations(version, name, sha256, applied_at) VALUES (?, ?, ?, ?)",
  ).run(
    LEGACY_SCHEMA_VERSION,
    "initial-personal-local-vault",
    LEGACY_SCHEMA_SHA256,
    createdAt,
  );
  db.prepare(
    "INSERT INTO vault_meta(singleton, profile, schema_version, schema_sha256, created_at) VALUES (1, ?, ?, ?, ?)",
  ).run(
    LOCAL_RESEARCH_VAULT_PROFILE,
    LEGACY_SCHEMA_VERSION,
    LEGACY_SCHEMA_SHA256,
    createdAt,
  );
  db.exec(
    `PRAGMA application_id = ${String(LOCAL_RESEARCH_VAULT_APPLICATION_ID)};`,
  );
  db.exec(`PRAGMA user_version = ${String(LEGACY_SCHEMA_VERSION)};`);
}

function applyVersionTwoMigration(db: DatabaseSync, appliedAt: string): void {
  db.exec(MIGRATION_V2_SQL);
  db.prepare(
    "INSERT INTO vault_migrations(version, name, sha256, applied_at) VALUES (?, ?, ?, ?)",
  ).run(2, "unique-ledger-request-bindings", MIGRATION_V2_SHA256, appliedAt);
  db.prepare(
    "UPDATE vault_meta SET schema_version = ?, schema_sha256 = ? WHERE singleton = 1",
  ).run(
    LOCAL_RESEARCH_VAULT_SCHEMA_VERSION,
    LOCAL_RESEARCH_VAULT_SCHEMA_SHA256,
  );
  db.exec(
    `PRAGMA user_version = ${String(LOCAL_RESEARCH_VAULT_SCHEMA_VERSION)};`,
  );
}

export function verifyLocalResearchVaultSchema(db: DatabaseSync): void {
  const integrityCheck = db.prepare("PRAGMA integrity_check(1)").all();
  if (
    integrityCheck.length !== 1 ||
    integrityCheck[0]?.["integrity_check"] !== "ok"
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  if (db.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw vaultError("VAULT_CORRUPT");
  }
  const applicationId = readSinglePragmaNumber(db, "application_id");
  const userVersion = readSinglePragmaNumber(db, "user_version");
  if (
    applicationId !== LOCAL_RESEARCH_VAULT_APPLICATION_ID ||
    userVersion !== LOCAL_RESEARCH_VAULT_SCHEMA_VERSION
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  const meta = db
    .prepare(
      "SELECT profile, schema_version, schema_sha256 FROM vault_meta WHERE singleton = 1",
    )
    .get();
  const migrations = db
    .prepare(
      "SELECT version, name, sha256 FROM vault_migrations ORDER BY version",
    )
    .all();
  if (
    meta?.["profile"] !== LOCAL_RESEARCH_VAULT_PROFILE ||
    meta["schema_version"] !== LOCAL_RESEARCH_VAULT_SCHEMA_VERSION ||
    meta["schema_sha256"] !== LOCAL_RESEARCH_VAULT_SCHEMA_SHA256 ||
    JSON.stringify(migrations) !==
      JSON.stringify([
        {
          version: 1,
          name: "initial-personal-local-vault",
          sha256: LEGACY_SCHEMA_SHA256,
        },
        {
          version: 2,
          name: "unique-ledger-request-bindings",
          sha256: MIGRATION_V2_SHA256,
        },
      ])
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((row) => row["name"]);
  const indexes = db
    .prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((row) => row["name"]);
  if (
    JSON.stringify(tables) !== JSON.stringify(EXPECTED_TABLES) ||
    JSON.stringify(indexes) !== JSON.stringify(EXPECTED_INDEXES)
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  if (schemaInventorySha256(db) !== EXPECTED_SCHEMA_INVENTORY_SHA256) {
    throw vaultError("VAULT_CORRUPT");
  }
}

function verifyVersionOneSchema(db: DatabaseSync): void {
  const integrityCheck = db.prepare("PRAGMA integrity_check(1)").all();
  const meta = db
    .prepare(
      "SELECT profile, schema_version, schema_sha256 FROM vault_meta WHERE singleton = 1",
    )
    .get();
  const migrations = db
    .prepare(
      "SELECT version, name, sha256 FROM vault_migrations ORDER BY version",
    )
    .all();
  const tables = schemaObjectNames(db, "table");
  const indexes = schemaObjectNames(db, "index");
  if (
    integrityCheck.length !== 1 ||
    integrityCheck[0]?.["integrity_check"] !== "ok" ||
    db.prepare("PRAGMA foreign_key_check").all().length !== 0 ||
    meta?.["profile"] !== LOCAL_RESEARCH_VAULT_PROFILE ||
    meta["schema_version"] !== LEGACY_SCHEMA_VERSION ||
    meta["schema_sha256"] !== LEGACY_SCHEMA_SHA256 ||
    JSON.stringify(migrations) !==
      JSON.stringify([
        {
          version: 1,
          name: "initial-personal-local-vault",
          sha256: LEGACY_SCHEMA_SHA256,
        },
      ]) ||
    JSON.stringify(tables) !== JSON.stringify(EXPECTED_TABLES) ||
    JSON.stringify(indexes) !== JSON.stringify(LEGACY_EXPECTED_INDEXES) ||
    schemaInventorySha256(db) !== LEGACY_SCHEMA_INVENTORY_SHA256
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
}

export function installLocalResearchVaultAuthorizer(db: DatabaseSync): void {
  const denied = new Set([
    constants.SQLITE_ALTER_TABLE,
    constants.SQLITE_ANALYZE,
    constants.SQLITE_ATTACH,
    constants.SQLITE_CREATE_INDEX,
    constants.SQLITE_CREATE_TABLE,
    constants.SQLITE_CREATE_TEMP_INDEX,
    constants.SQLITE_CREATE_TEMP_TABLE,
    constants.SQLITE_CREATE_TEMP_TRIGGER,
    constants.SQLITE_CREATE_TEMP_VIEW,
    constants.SQLITE_CREATE_TRIGGER,
    constants.SQLITE_CREATE_VIEW,
    constants.SQLITE_DETACH,
    constants.SQLITE_DROP_INDEX,
    constants.SQLITE_DROP_TABLE,
    constants.SQLITE_DROP_TEMP_INDEX,
    constants.SQLITE_DROP_TEMP_TABLE,
    constants.SQLITE_DROP_TEMP_TRIGGER,
    constants.SQLITE_DROP_TEMP_VIEW,
    constants.SQLITE_DROP_TRIGGER,
    constants.SQLITE_DROP_VIEW,
    constants.SQLITE_REINDEX,
  ]);
  db.setAuthorizer((actionCode, arg1, arg2) => {
    if (denied.has(actionCode)) return constants.SQLITE_DENY;
    if (actionCode === constants.SQLITE_PRAGMA) {
      const readOnlyIntegrityPragma =
        (arg1 === "integrity_check" && (arg2 === null || arg2 === "1")) ||
        (arg2 === null &&
          (arg1 === "application_id" ||
            arg1 === "foreign_key_check" ||
            arg1 === "user_version"));
      return readOnlyIntegrityPragma
        ? constants.SQLITE_OK
        : constants.SQLITE_DENY;
    }
    return constants.SQLITE_OK;
  });
}

export function rollbackOrClose(db: DatabaseSync, cause: unknown): never {
  try {
    if (db.isTransaction) db.exec("ROLLBACK");
  } catch (rollbackError) {
    try {
      db.close();
    } catch {
      // The original and rollback failures are intentionally not disclosed.
    }
    throw vaultError("VAULT_CORRUPT", rollbackError);
  }
  throw cause;
}

function readSinglePragmaNumber(db: DatabaseSync, pragma: string): number {
  const row = db.prepare(`PRAGMA ${pragma}`).get();
  const value = row?.[pragma];
  return typeof value === "number" ? value : Number.NaN;
}

function schemaInventorySha256(db: DatabaseSync): string {
  const rows = db
    .prepare(
      `SELECT type, name, tbl_name, sql
         FROM sqlite_schema
        WHERE name NOT LIKE 'sqlite_%'
        ORDER BY type, name`,
    )
    .all();
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

function schemaObjectNames(
  db: DatabaseSync,
  type: "index" | "table",
): unknown[] {
  return db
    .prepare(
      "SELECT name FROM sqlite_schema WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all(type)
    .map((row) => row["name"]);
}

function referenceSchemaInventorySha256(statements: readonly string[]): string {
  const reference = new DatabaseSync(":memory:", {
    allowExtension: false,
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
  });
  try {
    for (const statement of statements) reference.exec(statement);
    return schemaInventorySha256(reference);
  } finally {
    reference.close();
  }
}
