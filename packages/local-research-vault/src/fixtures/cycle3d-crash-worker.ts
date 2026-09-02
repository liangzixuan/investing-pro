import { DatabaseSync } from "node:sqlite";

import { SqliteLocalResearchVault } from "../sqlite-local-research-vault";

const mode = process.argv[2];
const databasePath = process.argv[3];
if (databasePath === undefined) process.exit(91);

if (mode === "committed-update") {
  const vault = SqliteLocalResearchVault.openExisting(
    databasePath,
    Buffer.alloc(32, 0x37),
    () => new Date("2026-09-01T12:01:00.000Z"),
  );
  vault.putRecord({
    kind: "job_state",
    id: "crash-job",
    expectedVersion: 1,
    idempotencyKey: "idempotency-crash-committed-update",
    payload: { phase: "committed-before-crash" },
  });
  process.exit(19);
}

if (mode === "uncommitted-audit") {
  const db = new DatabaseSync(databasePath, { timeout: 5_000 });
  db.exec("BEGIN IMMEDIATE");
  db.prepare(
    `INSERT INTO vault_audit(
       occurred_at, action, record_kind, record_id, from_version, to_version,
       request_sha256, result_sha256, attachment_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    "2026-09-01T12:02:00.000Z",
    "record_updated",
    "job_state",
    "crash-job",
    1,
    2,
    "a".repeat(64),
    "b".repeat(64),
  );
  process.exit(23);
}

process.exit(92);
