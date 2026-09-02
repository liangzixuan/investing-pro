import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { SqliteLocalResearchVault } from "./sqlite-local-research-vault";

const roots: string[] = [];
const worker = resolve(
  import.meta.dirname,
  "fixtures",
  "cycle3d-crash-worker.ts",
);

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map(async (root) => rm(root, { recursive: true, force: true })),
  );
});

describe("local research vault crash recovery", () => {
  it("recovers wholly committed work and discards an uncommitted transaction", async () => {
    const root = await mkdtemp(join(tmpdir(), "cycle3d-crash-recovery-"));
    roots.push(root);
    const databasePath = join(root, "vault.sqlite3");
    const vault = SqliteLocalResearchVault.createNew(
      databasePath,
      Buffer.alloc(32, 0x37),
      () => new Date("2026-09-01T12:00:00.000Z"),
    );
    vault.putRecord({
      kind: "job_state",
      id: "crash-job",
      expectedVersion: 0,
      idempotencyKey: "idempotency-crash-initial-create",
      payload: { phase: "initial" },
    });
    vault.close();

    const uncommitted = runWorker("uncommitted-audit", databasePath);
    expect(uncommitted.status).toBe(23);
    const raw = new DatabaseSync(databasePath, { readOnly: true });
    expect(
      raw.prepare("SELECT count(*) AS count FROM vault_audit").get()?.["count"],
    ).toBe(1);
    raw.close();

    const committed = runWorker("committed-update", databasePath);
    expect(committed.status).toBe(19);
    const reopened = SqliteLocalResearchVault.openExisting(
      databasePath,
      Buffer.alloc(32, 0x37),
    );
    expect(reopened.getRecord("job_state", "crash-job")).toMatchObject({
      version: 2,
      payload: { phase: "committed-before-crash" },
    });
    expect(
      reopened.putRecord({
        kind: "job_state",
        id: "crash-job",
        expectedVersion: 1,
        idempotencyKey: "idempotency-crash-committed-update",
        payload: { phase: "committed-before-crash" },
      }).replayed,
    ).toBe(true);
    reopened.close();
  }, 30_000);
});

function runWorker(mode: string, databasePath: string) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", worker, mode, databasePath],
    { encoding: "utf8", timeout: 15_000, windowsHide: true },
  );
}
