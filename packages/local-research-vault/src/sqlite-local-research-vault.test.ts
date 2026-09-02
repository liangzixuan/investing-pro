import { readFile, readdir, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import type { LocalResearchVaultError } from "./errors";
import { canonicalizeJson, sha256Hex } from "./canonical-json";
import { LOCAL_RESEARCH_RECORD_KINDS } from "./model";
import { SqliteLocalResearchVault } from "./sqlite-local-research-vault";
import { localVaultRecordAad, LocalVaultCryptography } from "./vault-crypto";
import {
  configureLocalResearchVaultDatabase,
  initializeLegacyLocalResearchVaultSchema,
  LOCAL_RESEARCH_VAULT_SCHEMA_VERSION,
} from "./vault-schema";

const KEY = Buffer.alloc(32, 0x37);
const OTHER_KEY = Buffer.alloc(32, 0x83);
const NOW = new Date("2026-09-01T12:00:00.000Z");
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map(async (root) => rm(root, { recursive: true, force: true })),
  );
});

describe("SQLite local research vault", () => {
  it("persists every personal record namespace across restart", async () => {
    const databasePath = await freshDatabasePath();
    const vault = SqliteLocalResearchVault.createNew(
      databasePath,
      KEY,
      () => NOW,
    );
    for (const [index, kind] of LOCAL_RESEARCH_RECORD_KINDS.entries()) {
      const receipt = vault.putRecord({
        kind,
        id: `record-${String(index)}`,
        expectedVersion: 0,
        idempotencyKey: `idempotency-create-${String(index).padStart(2, "0")}`,
        payload: { label: `${kind}-private-canary`, ordinal: index },
      });
      expect(receipt.version).toBe(1);
      expect(receipt.replayed).toBe(false);
    }
    vault.close();

    const reopened = SqliteLocalResearchVault.openExisting(
      databasePath,
      KEY,
      () => NOW,
    );
    for (const [index, kind] of LOCAL_RESEARCH_RECORD_KINDS.entries()) {
      expect(
        reopened.getRecord(kind, `record-${String(index)}`).payload,
      ).toEqual({
        label: `${kind}-private-canary`,
        ordinal: index,
      });
    }
    expect(reopened.inventory().records).toHaveLength(
      LOCAL_RESEARCH_RECORD_KINDS.length,
    );
    reopened.close();
  });

  it("commits CAS, durable idempotency, audit, and tombstones atomically", async () => {
    const databasePath = await freshDatabasePath();
    const vault = SqliteLocalResearchVault.createNew(
      databasePath,
      KEY,
      () => NOW,
    );
    const create = {
      kind: "thesis" as const,
      id: "abc-thesis",
      expectedVersion: 0,
      idempotencyKey: "idempotency-create-thesis",
      payload: { title: "Owner thesis" },
    };
    expect(vault.putRecord(create).replayed).toBe(false);
    expect(vault.putRecord(create).replayed).toBe(true);
    expect(() =>
      vault.putRecord({ ...create, payload: { title: "Different" } }),
    ).toThrowError(matchingCode("VAULT_IDEMPOTENCY_CONFLICT"));

    const update = vault.putRecord({
      ...create,
      expectedVersion: 1,
      idempotencyKey: "idempotency-update-thesis",
      payload: { title: "Updated thesis" },
    });
    expect(update.version).toBe(2);
    expect(() =>
      vault.putRecord({
        ...create,
        expectedVersion: 1,
        idempotencyKey: "idempotency-stale-thesis",
      }),
    ).toThrowError(matchingCode("VAULT_CONFLICT"));
    expect(vault.getRecord("thesis", "abc-thesis").payload).toEqual({
      title: "Updated thesis",
    });

    const deletion = vault.deleteRecord({
      kind: "thesis",
      id: "abc-thesis",
      expectedVersion: 2,
      idempotencyKey: "idempotency-delete-thesis",
    });
    expect(deletion.version).toBe(3);
    expect(
      vault.deleteRecord({
        kind: "thesis",
        id: "abc-thesis",
        expectedVersion: 2,
        idempotencyKey: "idempotency-delete-thesis",
      }).replayed,
    ).toBe(true);
    expect(() => vault.getRecord("thesis", "abc-thesis")).toThrowError(
      matchingCode("VAULT_DELETED"),
    );
    expect(() =>
      vault.putRecord({
        ...create,
        idempotencyKey: "idempotency-recreate-thesis",
      }),
    ).toThrowError(matchingCode("VAULT_DELETED"));
    vault.close();

    const raw = new DatabaseSync(databasePath, { readOnly: true });
    expect(
      raw.prepare("SELECT count(*) AS count FROM vault_audit").get()?.["count"],
    ).toBe(3);
    expect(
      raw.prepare("SELECT count(*) AS count FROM vault_idempotency").get()?.[
        "count"
      ],
    ).toBe(3);
    expect(
      raw.prepare("SELECT count(*) AS count FROM vault_tombstones").get()?.[
        "count"
      ],
    ).toBe(1);
    raw.close();
  });

  it("stores bounded encrypted attachments and removes them with their record", async () => {
    const databasePath = await freshDatabasePath();
    const vault = SqliteLocalResearchVault.createNew(
      databasePath,
      KEY,
      () => NOW,
    );
    vault.putRecord({
      kind: "portfolio",
      id: "portfolio-main",
      expectedVersion: 0,
      idempotencyKey: "idempotency-create-portfolio",
      payload: { name: "Personal" },
    });
    const expectedBytes = Buffer.from("private attachment canary", "utf8");
    const bytes = Buffer.from(expectedBytes);
    vault.putAttachment({
      attachmentId: "attachment-001",
      recordKind: "portfolio",
      recordId: "portfolio-main",
      expectedRecordVersion: 1,
      idempotencyKey: "idempotency-add-attachment",
      mediaType: "text/plain",
      bytes,
    });
    bytes.fill(0);
    expect(vault.getAttachment("attachment-001").bytes).toEqual(expectedBytes);
    expect(vault.inventory().attachments).toHaveLength(1);
    vault.deleteRecord({
      kind: "portfolio",
      id: "portfolio-main",
      expectedVersion: 1,
      idempotencyKey: "idempotency-delete-portfolio",
    });
    expect(() => vault.getAttachment("attachment-001")).toThrowError(
      matchingCode("VAULT_NOT_FOUND"),
    );
    vault.close();
  });

  it("rejects clock rollback without mutating records, attachments, or ledgers", async () => {
    const databasePath = await freshDatabasePath();
    let now = new Date("2026-09-01T13:00:00.000Z");
    const vault = SqliteLocalResearchVault.createNew(
      databasePath,
      KEY,
      () => now,
    );
    vault.putRecord({
      kind: "thesis",
      id: "clock-protected",
      expectedVersion: 0,
      idempotencyKey: "idempotency-clock-create",
      payload: { state: "original" },
    });
    const before = vault.verifyIntegrity();
    now = new Date("2026-09-01T12:59:59.999Z");

    expect(() =>
      vault.putRecord({
        kind: "thesis",
        id: "clock-protected",
        expectedVersion: 1,
        idempotencyKey: "idempotency-clock-update",
        payload: { state: "rolled-back" },
      }),
    ).toThrowError(matchingCode("VAULT_SECURITY_BOUNDARY_REJECTED"));
    expect(() =>
      vault.putAttachment({
        attachmentId: "clock-attachment",
        recordKind: "thesis",
        recordId: "clock-protected",
        expectedRecordVersion: 1,
        idempotencyKey: "idempotency-clock-attachment",
        mediaType: "text/plain",
        bytes: Buffer.from("must not commit", "utf8"),
      }),
    ).toThrowError(matchingCode("VAULT_SECURITY_BOUNDARY_REJECTED"));
    expect(() =>
      vault.deleteRecord({
        kind: "thesis",
        id: "clock-protected",
        expectedVersion: 1,
        idempotencyKey: "idempotency-clock-delete",
      }),
    ).toThrowError(matchingCode("VAULT_SECURITY_BOUNDARY_REJECTED"));

    expect(vault.verifyIntegrity()).toEqual(before);
    expect(vault.getRecord("thesis", "clock-protected")).toMatchObject({
      version: 1,
      payload: { state: "original" },
    });
    expect(() => vault.getAttachment("clock-attachment")).toThrowError(
      matchingCode("VAULT_NOT_FOUND"),
    );
    vault.close();
  });

  it("allows exactly one of two stale writers to advance the version", async () => {
    const databasePath = await freshDatabasePath();
    const first = SqliteLocalResearchVault.createNew(
      databasePath,
      KEY,
      () => NOW,
    );
    first.putRecord({
      kind: "watchlist",
      id: "primary",
      expectedVersion: 0,
      idempotencyKey: "idempotency-create-watchlist",
      payload: { symbols: ["SYN1"] },
    });
    const second = SqliteLocalResearchVault.openExisting(
      databasePath,
      KEY,
      () => NOW,
    );
    first.putRecord({
      kind: "watchlist",
      id: "primary",
      expectedVersion: 1,
      idempotencyKey: "idempotency-writer-first",
      payload: { symbols: ["SYN1", "SYN2"] },
    });
    expect(() =>
      second.putRecord({
        kind: "watchlist",
        id: "primary",
        expectedVersion: 1,
        idempotencyKey: "idempotency-writer-second",
        payload: { symbols: ["STALE"] },
      }),
    ).toThrowError(matchingCode("VAULT_CONFLICT"));
    expect(second.getRecord("watchlist", "primary").version).toBe(2);
    first.close();
    second.close();
  });

  it("fails closed for the wrong key and authenticated-row tampering", async () => {
    const databasePath = await freshDatabasePath();
    const vault = SqliteLocalResearchVault.createNew(
      databasePath,
      KEY,
      () => NOW,
    );
    vault.putRecord({
      kind: "settings",
      id: "owner-settings",
      expectedVersion: 0,
      idempotencyKey: "idempotency-owner-settings",
      payload: { privateCanary: "must-not-be-plaintext" },
    });
    vault.close();

    const wrongKey = SqliteLocalResearchVault.openExisting(
      databasePath,
      OTHER_KEY,
      () => NOW,
    );
    expect(() => wrongKey.verifyIntegrity()).toThrowError(
      matchingCode("VAULT_CORRUPT"),
    );
    wrongKey.close();

    const raw = new DatabaseSync(databasePath);
    raw
      .prepare(
        "UPDATE vault_records SET payload_ciphertext = zeroblob(length(payload_ciphertext))",
      )
      .run();
    raw.close();
    const tampered = SqliteLocalResearchVault.openExisting(
      databasePath,
      KEY,
      () => NOW,
    );
    expect(() => tampered.verifyIntegrity()).toThrowError(
      matchingCode("VAULT_CORRUPT"),
    );
    tampered.close();
  });

  it("detects missing tombstone, idempotency, and audit ledger evidence", async () => {
    const databasePath = await freshDatabasePath();
    const vault = SqliteLocalResearchVault.createNew(
      databasePath,
      KEY,
      () => NOW,
    );
    vault.putRecord({
      kind: "thesis",
      id: "ledger-thesis",
      expectedVersion: 0,
      idempotencyKey: "idempotency-ledger-create",
      payload: { thesis: "ledger protected" },
    });
    vault.deleteRecord({
      kind: "thesis",
      id: "ledger-thesis",
      expectedVersion: 1,
      idempotencyKey: "idempotency-ledger-delete",
    });
    vault.close();

    const raw = new DatabaseSync(databasePath);
    raw.prepare("DELETE FROM vault_tombstones").run();
    raw.close();
    const missingTombstone = SqliteLocalResearchVault.openExisting(
      databasePath,
      KEY,
      () => NOW,
    );
    expect(() => missingTombstone.verifyIntegrity()).toThrowError(
      matchingCode("VAULT_CORRUPT"),
    );
    expect(() =>
      missingTombstone.putRecord({
        kind: "thesis",
        id: "ledger-thesis",
        expectedVersion: 0,
        idempotencyKey: "idempotency-ledger-recreate",
        payload: { thesis: "must remain deleted" },
      }),
    ).toThrowError(matchingCode("VAULT_CORRUPT"));
    missingTombstone.close();

    const rawAgain = new DatabaseSync(databasePath);
    rawAgain
      .prepare(
        `INSERT INTO vault_tombstones(
           kind, record_id, deleted_version, prior_payload_sha256, deleted_at
         ) SELECT record_kind, record_id, to_version, result_sha256, occurred_at
             FROM vault_audit WHERE action = 'record_deleted'`,
      )
      .run();
    rawAgain
      .prepare("DELETE FROM vault_idempotency WHERE operation = 'delete'")
      .run();
    rawAgain
      .prepare("DELETE FROM vault_audit WHERE action = 'record_deleted'")
      .run();
    rawAgain.close();
    const missingLedgers = SqliteLocalResearchVault.openExisting(
      databasePath,
      KEY,
      () => NOW,
    );
    expect(() => missingLedgers.verifyIntegrity()).toThrowError(
      matchingCode("VAULT_CORRUPT"),
    );
    missingLedgers.close();
  });

  it("does not place personal payload canaries in SQLite, WAL, or SHM files", async () => {
    const databasePath = await freshDatabasePath();
    const vault = SqliteLocalResearchVault.createNew(
      databasePath,
      KEY,
      () => NOW,
    );
    const canary = "cycle3d-super-secret-canary-value";
    vault.putRecord({
      kind: "job_state",
      id: "job-one",
      expectedVersion: 0,
      idempotencyKey: "idempotency-create-job-state",
      payload: { canary },
    });
    const directory = join(databasePath, "..");
    for (const name of await readdir(directory)) {
      if (!name.startsWith("vault.sqlite3")) continue;
      const contents = await readFile(join(directory, name));
      expect(contents.includes(Buffer.from(canary, "utf8"))).toBe(false);
    }
    vault.close();
  });

  it("admits exactly 10,000 records of one kind and rejects the 10,001st atomically", async () => {
    const databasePath = await freshDatabasePath();
    SqliteLocalResearchVault.createNew(databasePath, KEY, () => NOW).close();
    seedValidTheses(databasePath, 9_999);
    const vault = SqliteLocalResearchVault.openExisting(
      databasePath,
      KEY,
      () => NOW,
    );
    expect(
      vault.putRecord({
        kind: "thesis",
        id: "capacity-09999",
        expectedVersion: 0,
        idempotencyKey: "idempotency-capacity-09999",
        payload: { seed: 9_999 },
      }).version,
    ).toBe(1);
    expect(() =>
      vault.putRecord({
        kind: "thesis",
        id: "capacity-10000",
        expectedVersion: 0,
        idempotencyKey: "idempotency-capacity-10000",
        payload: { seed: 10_000 },
      }),
    ).toThrowError(matchingCode("VAULT_CONFLICT"));
    expect(vault.getRecord("thesis", "capacity-09999").payload).toEqual({
      seed: 9_999,
    });
    vault.close();

    const raw = new DatabaseSync(databasePath, { readOnly: true });
    expect(
      raw
        .prepare(
          "SELECT count(*) AS count FROM vault_records WHERE kind = 'thesis'",
        )
        .get()?.["count"],
    ).toBe(10_000);
    raw.close();
  }, 30_000);

  it("migrates version one atomically and leaves a failed migration retryable", async () => {
    const databasePath = await freshDatabasePath();
    const legacy = new DatabaseSync(databasePath);
    configureLocalResearchVaultDatabase(legacy);
    initializeLegacyLocalResearchVaultSchema(legacy, NOW.toISOString());
    const duplicateRequest = "a".repeat(64);
    const insert = legacy.prepare(
      `INSERT INTO vault_idempotency(
         idempotency_key, request_sha256, operation, record_kind, record_id,
         resulting_version, result_sha256, attachment_id, committed_at
       ) VALUES (?, ?, 'put', 'thesis', ?, 1, ?, NULL, ?)`,
    );
    insert.run(
      "idempotency-legacy-duplicate-01",
      duplicateRequest,
      "legacy-one",
      "b".repeat(64),
      NOW.toISOString(),
    );
    insert.run(
      "idempotency-legacy-duplicate-02",
      duplicateRequest,
      "legacy-two",
      "c".repeat(64),
      NOW.toISOString(),
    );
    legacy.close();

    expect(() =>
      SqliteLocalResearchVault.openExisting(databasePath, KEY, () => NOW),
    ).toThrowError(matchingCode("VAULT_CORRUPT"));
    const afterFailure = new DatabaseSync(databasePath);
    expect(
      afterFailure.prepare("PRAGMA user_version").get()?.["user_version"],
    ).toBe(1);
    expect(
      afterFailure
        .prepare("SELECT count(*) AS count FROM vault_migrations")
        .get()?.["count"],
    ).toBe(1);
    afterFailure
      .prepare("DELETE FROM vault_idempotency WHERE idempotency_key = ?")
      .run("idempotency-legacy-duplicate-02");
    afterFailure.close();

    const migrated = SqliteLocalResearchVault.openExisting(
      databasePath,
      KEY,
      () => NOW,
    );
    migrated.close();
    const verified = new DatabaseSync(databasePath, { readOnly: true });
    expect(
      verified.prepare("PRAGMA user_version").get()?.["user_version"],
    ).toBe(LOCAL_RESEARCH_VAULT_SCHEMA_VERSION);
    expect(
      verified
        .prepare("SELECT count(*) AS count FROM vault_migrations")
        .get()?.["count"],
    ).toBe(2);
    verified.close();
  });
});

async function freshDatabasePath(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "local-research-vault-test-"));
  roots.push(root);
  return join(root, "vault.sqlite3");
}

function matchingCode(code: LocalResearchVaultError["code"]): Error {
  return expect.objectContaining({ code }) as Error;
}

function seedValidTheses(databasePath: string, count: number): void {
  const database = new DatabaseSync(databasePath);
  const cryptography = new LocalVaultCryptography(KEY);
  const statement = database.prepare(
    `INSERT INTO vault_records(
       kind, record_id, version, payload_nonce, payload_ciphertext,
       payload_tag, payload_sha256, created_at, updated_at
     ) VALUES ('thesis', ?, 1, ?, ?, ?, ?, ?, ?)`,
  );
  database.exec("BEGIN IMMEDIATE");
  try {
    for (let index = 0; index < count; index += 1) {
      const id = `capacity-${String(index).padStart(5, "0")}`;
      const payload = canonicalizeJson({ seed: index });
      const digest = sha256Hex(payload);
      const encrypted = cryptography.encryptRecord(
        Buffer.from(payload, "utf8"),
        localVaultRecordAad(
          "thesis",
          id,
          1,
          digest,
          NOW.toISOString(),
          NOW.toISOString(),
        ),
      );
      statement.run(
        id,
        encrypted.nonce,
        encrypted.ciphertext,
        encrypted.tag,
        digest,
        NOW.toISOString(),
        NOW.toISOString(),
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    cryptography.close();
    database.close();
  }
}
