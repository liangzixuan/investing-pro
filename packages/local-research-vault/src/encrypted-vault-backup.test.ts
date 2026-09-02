import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createEncryptedLocalVaultBackup } from "./encrypted-vault-backup";
import { vaultError } from "./errors";
import {
  LOCAL_VAULT_BACKUP_FILE_NAME,
  type LocalVaultRootBoundary,
} from "./local-vault-paths";
import { LocalResearchVault } from "./local-research-vault";
import type { SqliteLocalResearchVault } from "./sqlite-local-research-vault";
import { createNativeWindowsOwnerOnlyAclPort } from "./windows-owner-only-acl";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (path) => rm(path, { recursive: true, force: true })),
  );
});

describe("encrypted local research vault backup", () => {
  it("round-trips record and attachment digests into a clean vault", async () => {
    const parent = await privateTemporaryDirectory();
    const liveRoot = join(parent, "live-vault");
    const backupDirectory = join(parent, "portable-backup");
    await createPrivateDirectory(backupDirectory);
    const backupPath = join(backupDirectory, LOCAL_VAULT_BACKUP_FILE_NAME);
    const vault = await LocalResearchVault.initialize({
      startupRootPath: liveRoot,
    });
    vault.putRecord({
      kind: "thesis",
      id: "durable-thesis",
      expectedVersion: 0,
      idempotencyKey: "idempotency-durable-thesis",
      payload: { title: "private-backup-canary" },
    });
    vault.putRecord({
      kind: "settings",
      id: "owner-settings",
      expectedVersion: 0,
      idempotencyKey: "idempotency-durable-settings",
      payload: { theme: "dark" },
    });
    vault.putAttachment({
      attachmentId: "supporting-note",
      recordKind: "thesis",
      recordId: "durable-thesis",
      expectedRecordVersion: 1,
      idempotencyKey: "idempotency-supporting-note",
      mediaType: "text/plain",
      bytes: Buffer.from("attachment-private-canary", "utf8"),
    });
    const before = vault.inventory();
    const receipt = await vault.createEncryptedBackup(
      backupPath,
      () => new Date("2026-09-01T13:00:00.000Z"),
    );
    expect(receipt).toMatchObject({
      recordCount: 2,
      attachmentCount: 1,
      oldBackupsMayContainDeletedRecords: true,
    });
    const backupBytes = await readFile(backupPath);
    expect(backupBytes.includes(Buffer.from("private-backup-canary"))).toBe(
      false,
    );
    expect(backupBytes.includes(Buffer.from("attachment-private-canary"))).toBe(
      false,
    );
    await expect(vault.createEncryptedBackup(backupPath)).rejects.toMatchObject(
      {
        code: "backup_destination_exists",
      },
    );
    vault.close();

    const recoveryKey = await readFile(join(liveRoot, "vault-recovery.key"));
    const restoredRoot = join(parent, "restored-vault");
    const restore = LocalResearchVault.restore({
      startupRootPath: restoredRoot,
      backupPath,
      recoveryKey,
    });
    recoveryKey.fill(0xff);
    const restored = await restore;
    expect(restored.vault.inventory()).toEqual(before);
    expect(
      restored.vault.getRecord("thesis", "durable-thesis").payload,
    ).toEqual({ title: "private-backup-canary" });
    expect(restored.vault.getAttachment("supporting-note").bytes).toEqual(
      Buffer.from("attachment-private-canary", "utf8"),
    );
    restored.vault.close();

    const reopened = await LocalResearchVault.open({
      startupRootPath: restoredRoot,
    });
    expect(reopened.inventory()).toEqual(before);
    reopened.close();
    recoveryKey.fill(0);
  }, 30_000);

  it("rejects a wrong recovery key before creating the restore target", async () => {
    const parent = await privateTemporaryDirectory();
    const liveRoot = join(parent, "live-vault");
    const backupDirectory = join(parent, "portable-backup");
    await createPrivateDirectory(backupDirectory);
    const backupPath = join(backupDirectory, LOCAL_VAULT_BACKUP_FILE_NAME);
    const vault = await LocalResearchVault.initialize({
      startupRootPath: liveRoot,
    });
    vault.putRecord({
      kind: "watchlist",
      id: "main-watchlist",
      expectedVersion: 0,
      idempotencyKey: "idempotency-main-watchlist",
      payload: { symbols: ["SYN1"] },
    });
    await vault.createEncryptedBackup(backupPath);
    vault.close();

    const rejectedRoot = join(parent, "rejected-restore");
    await expect(
      LocalResearchVault.restore({
        startupRootPath: rejectedRoot,
        backupPath,
        recoveryKey: Buffer.alloc(32, 0xff),
      }),
    ).rejects.toMatchObject({ code: "VAULT_CORRUPT" });
    await expect(lstat(rejectedRoot)).rejects.toMatchObject({ code: "ENOENT" });
  }, 30_000);

  it("rejects an in-root backup without poisoning the live vault", async () => {
    const parent = await privateTemporaryDirectory();
    const liveRoot = join(parent, "live-vault");
    const backupPath = join(liveRoot, LOCAL_VAULT_BACKUP_FILE_NAME);
    const vault = await LocalResearchVault.initialize({
      startupRootPath: liveRoot,
    });

    await expect(vault.createEncryptedBackup(backupPath)).rejects.toMatchObject(
      { code: "VAULT_SECURITY_BOUNDARY_REJECTED" },
    );
    await expect(lstat(backupPath)).rejects.toMatchObject({ code: "ENOENT" });
    vault.close();

    const reopened = await LocalResearchVault.open({
      startupRootPath: liveRoot,
    });
    expect(reopened.inventory().records).toEqual([]);
    reopened.close();
  }, 30_000);

  it("releases a destination reservation when a concurrent backup owns the lease", async () => {
    const parent = await privateTemporaryDirectory();
    const backupDirectory = join(parent, "portable-backup");
    await createPrivateDirectory(backupDirectory);
    const backupPath = join(backupDirectory, LOCAL_VAULT_BACKUP_FILE_NAME);
    const firstConflict = vaultError("VAULT_CONFLICT");
    const retryReached = new Error("retry reached the lease boundary");
    let attempts = 0;
    const unavailableVault = {
      acquireBackupLease() {
        attempts += 1;
        throw attempts === 1 ? firstConflict : retryReached;
      },
    } as unknown as SqliteLocalResearchVault;
    const options = {
      destinationPath: backupPath,
      recoveryKey: Buffer.alloc(32, 0x11),
      rootBoundary: {
        paths: { root: join(parent, "unrelated-live-root") },
      } as LocalVaultRootBoundary,
    };

    await expect(
      createEncryptedLocalVaultBackup(unavailableVault, options),
    ).rejects.toBe(firstConflict);
    await expect(
      createEncryptedLocalVaultBackup(unavailableVault, options),
    ).rejects.toBe(retryReached);
    expect(attempts).toBe(2);
  });
});

async function privateTemporaryDirectory(): Promise<string> {
  const path = await mkdtemp(
    join(await realpath(tmpdir()), "cycle3d-backup-test-"),
  );
  temporaryDirectories.push(path);
  if (process.platform === "win32") {
    const port = createNativeWindowsOwnerOnlyAclPort();
    await port.provisionAndVerifyOwnerOnly({
      canonicalRootPath: path,
      targetPaths: [path],
    });
  } else {
    await chmod(path, 0o700);
  }
  return path;
}

async function createPrivateDirectory(path: string): Promise<void> {
  await mkdir(path, { mode: 0o700 });
  if (process.platform === "win32") {
    const port = createNativeWindowsOwnerOnlyAclPort();
    await port.provisionAndVerifyOwnerOnly({
      canonicalRootPath: path,
      targetPaths: [path],
    });
  } else {
    await chmod(path, 0o700);
  }
}
