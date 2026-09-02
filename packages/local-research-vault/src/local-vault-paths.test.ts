import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  LOCAL_VAULT_BACKUP_FILE_NAME,
  LOCAL_VAULT_FILE_NAMES,
  LOCAL_VAULT_PATH_PROFILE,
  LocalVaultPathError,
  WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
  initializeLocalVaultRoot,
  openLocalVaultRoot,
  provisionLocalVaultFileOwnerOnly,
  validateExistingLocalVaultBackupSource,
  validateNewLocalVaultBackupDestination,
  verifyLocalVaultFileOwnerOnly,
} from "./local-vault-paths.js";
import type {
  LocalVaultRootOptions,
  WindowsOwnerOnlyAclPort,
  WindowsOwnerOnlyAclTarget,
  WindowsOwnerOnlyAclVerificationReceipt,
} from "./local-vault-paths.js";

const temporaryDirectories = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...temporaryDirectories].map(async (path) => {
      await rm(path, { force: true, recursive: true });
      temporaryDirectories.delete(path);
    }),
  );
});

async function temporaryParent(): Promise<string> {
  const path = await mkdtemp(
    join(await realpath(tmpdir()), "cycle3d-local-vault-paths-"),
  );
  temporaryDirectories.add(path);
  return path;
}

function exactReceipt(
  target: WindowsOwnerOnlyAclTarget,
): WindowsOwnerOnlyAclVerificationReceipt {
  return {
    profile: WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
    canonicalRootPath: target.canonicalRootPath,
    verifiedPaths: [...target.targetPaths],
    ownerIdentity: "test-owner",
    inheritanceProtected: true,
    ownerOnly: true,
  };
}

function aclPort(): WindowsOwnerOnlyAclPort & {
  readonly provisioned: WindowsOwnerOnlyAclTarget[];
  readonly verified: WindowsOwnerOnlyAclTarget[];
} {
  const provisioned: WindowsOwnerOnlyAclTarget[] = [];
  const verified: WindowsOwnerOnlyAclTarget[] = [];
  return {
    provisioned,
    verified,
    provisionAndVerifyOwnerOnly(target) {
      provisioned.push(target);
      return Promise.resolve(exactReceipt(target));
    },
    verifyOwnerOnly(target) {
      verified.push(target);
      return Promise.resolve(exactReceipt(target));
    },
  };
}

function hostOptions(
  startupRootPath: string,
  windowsAcl = aclPort(),
): LocalVaultRootOptions {
  return {
    startupRootPath,
    permissionPlatform: process.platform,
    ...(process.platform === "win32" ? { windowsAcl } : {}),
  };
}

describe("local vault fixed path boundary", () => {
  it("creates one new direct-child root and derives only fixed live paths", async () => {
    const parent = await temporaryParent();
    const root = join(parent, "owner-vault");
    const windowsAcl = aclPort();
    const boundary = await initializeLocalVaultRoot(
      hostOptions(root, windowsAcl),
    );

    expect(boundary).toMatchObject({
      profile: LOCAL_VAULT_PATH_PROFILE,
      permissionPlatform: process.platform,
      existingFiles: [],
      paths: {
        root,
        recoveryKey: join(root, "vault-recovery.key"),
        database: join(root, "vault.sqlite3"),
        writeAheadLog: join(root, "vault.sqlite3-wal"),
        sharedMemory: join(root, "vault.sqlite3-shm"),
        backupStaging: join(root, "vault-backup.staging"),
      },
    });
    expect((await lstat(root)).isDirectory()).toBe(true);

    if (process.platform === "win32") {
      expect(windowsAcl.provisioned).toEqual([
        { canonicalRootPath: root, targetPaths: [root] },
      ]);
      expect(boundary.aclReceipt?.ownerOnly).toBe(true);
    } else {
      expect((await lstat(root)).mode & 0o777).toBe(0o700);
      expect(boundary.aclReceipt).toBeUndefined();
    }
  });

  it("never initializes over an existing live root", async () => {
    const parent = await temporaryParent();
    const root = join(parent, "owner-vault");
    await mkdir(root);

    await expect(
      initializeLocalVaultRoot(hostOptions(root)),
    ).rejects.toMatchObject({
      code: "root_exists",
    });
  });

  it.each([
    ["relative", "owner-vault"],
    ["file URI", "file:///tmp/owner-vault"],
    ["UNC", "\\\\server\\share\\owner-vault"],
    ["device", "\\\\?\\C:\\owner-vault"],
  ])("rejects an ambiguous %s startup path", async (_label, root) => {
    await expect(
      initializeLocalVaultRoot(hostOptions(root)),
    ).rejects.toBeInstanceOf(LocalVaultPathError);
  });

  it("rejects trailing separators and dot-segment spellings before touching disk", async () => {
    const parent = await temporaryParent();
    const trailing = `${join(parent, "owner-vault")}${sep}`;
    const dotted = `${parent}${sep}.${sep}owner-vault`;

    await expect(
      initializeLocalVaultRoot(hostOptions(trailing)),
    ).rejects.toMatchObject({
      code: "ambiguous_path",
    });
    await expect(
      initializeLocalVaultRoot(hostOptions(dotted)),
    ).rejects.toMatchObject({
      code: "ambiguous_path",
    });
  });

  it("rejects a symlink or junction as the live root", async () => {
    const parent = await temporaryParent();
    const target = join(parent, "actual-vault");
    const root = join(parent, "owner-vault");
    await mkdir(target);
    await symlink(
      target,
      root,
      process.platform === "win32" ? "junction" : "dir",
    );

    await expect(openLocalVaultRoot(hostOptions(root))).rejects.toMatchObject({
      code: "symlink_rejected",
    });
  });

  it("rejects unknown, symlinked, and hardlinked root entries", async () => {
    const parent = await temporaryParent();

    const unknownRoot = join(parent, "unknown-vault");
    await initializeLocalVaultRoot(hostOptions(unknownRoot));
    await writeFile(join(unknownRoot, "operator-name.txt"), "no");
    await expect(
      openLocalVaultRoot(hostOptions(unknownRoot)),
    ).rejects.toMatchObject({
      code: "unexpected_root_entry",
    });

    const hardlinkRoot = join(parent, "hardlink-vault");
    await initializeLocalVaultRoot(hostOptions(hardlinkRoot));
    const outside = join(parent, "outside.sqlite3");
    await writeFile(outside, "sqlite");
    await link(outside, join(hardlinkRoot, LOCAL_VAULT_FILE_NAMES.database));
    await expect(
      openLocalVaultRoot(hostOptions(hardlinkRoot)),
    ).rejects.toMatchObject({
      code: "hardlinked_file",
    });

    const symlinkRoot = join(parent, "symlink-vault");
    await initializeLocalVaultRoot(hostOptions(symlinkRoot));
    const symlinkTarget =
      process.platform === "win32"
        ? join(parent, "outside-directory")
        : outside;
    if (process.platform === "win32") await mkdir(symlinkTarget);
    await symlink(
      symlinkTarget,
      join(symlinkRoot, LOCAL_VAULT_FILE_NAMES.database),
      process.platform === "win32" ? "junction" : "file",
    );
    await expect(
      openLocalVaultRoot(hostOptions(symlinkRoot)),
    ).rejects.toMatchObject({
      code: "symlink_rejected",
    });
  });

  it("provisions and verifies each created fixed file without accepting a filename", async () => {
    const parent = await temporaryParent();
    const root = join(parent, "owner-vault");
    const windowsAcl = aclPort();
    const boundary = await initializeLocalVaultRoot(
      hostOptions(root, windowsAcl),
    );
    await writeFile(boundary.paths.database, "sqlite", { mode: 0o666 });

    const provisionReceipt = await provisionLocalVaultFileOwnerOnly(
      boundary,
      "database",
      { windowsAcl },
    );
    const verifyReceipt = await verifyLocalVaultFileOwnerOnly(
      boundary,
      "database",
      {
        windowsAcl,
      },
    );

    if (process.platform === "win32") {
      expect(provisionReceipt?.verifiedPaths).toEqual([
        boundary.paths.root,
        boundary.paths.database,
      ]);
      expect(verifyReceipt?.ownerOnly).toBe(true);
    } else {
      expect((await lstat(boundary.paths.database)).mode & 0o777).toBe(0o600);
      expect(provisionReceipt).toBeUndefined();
      expect(verifyReceipt).toBeUndefined();
    }
  });

  it("requires an exact Windows ACL verification receipt and removes a failed new root", async () => {
    const parent = await temporaryParent();
    const root = join(parent, "owner-vault");
    const forgedPort: WindowsOwnerOnlyAclPort = {
      provisionAndVerifyOwnerOnly(target) {
        return Promise.resolve({
          ...exactReceipt(target),
          verifiedPaths: [],
        });
      },
      verifyOwnerOnly(target) {
        return Promise.resolve(exactReceipt(target));
      },
    };

    await expect(
      initializeLocalVaultRoot({
        startupRootPath: root,
        permissionPlatform: "win32",
        windowsAcl: forgedPort,
      }),
    ).rejects.toMatchObject({ code: "invalid_acl_receipt" });
    await expect(lstat(root)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("requires a Windows ACL port instead of treating chmod as Windows proof", async () => {
    const parent = await temporaryParent();
    const root = join(parent, "owner-vault");

    await expect(
      initializeLocalVaultRoot({
        startupRootPath: root,
        permissionPlatform: "win32",
      }),
    ).rejects.toMatchObject({ code: "windows_acl_port_required" });
  });

  const posixIt = process.platform === "win32" ? it.skip : it;
  posixIt(
    "rejects insecure POSIX modes when opening an existing vault",
    async () => {
      const parent = await temporaryParent();
      const root = join(parent, "owner-vault");
      await initializeLocalVaultRoot({
        startupRootPath: root,
        permissionPlatform: "linux",
      });
      await chmod(root, 0o750);

      await expect(
        openLocalVaultRoot({
          startupRootPath: root,
          permissionPlatform: "linux",
        }),
      ).rejects.toMatchObject({ code: "insecure_permissions" });
    },
  );
});

describe("operator backup path boundary", () => {
  it("accepts only an absent fixed-name direct child of a canonical real parent", async () => {
    const parent = await temporaryParent();
    const backupPath = join(parent, LOCAL_VAULT_BACKUP_FILE_NAME);

    await expect(
      validateNewLocalVaultBackupDestination(backupPath),
    ).resolves.toEqual({
      parentPath: parent,
      path: backupPath,
      fileName: LOCAL_VAULT_BACKUP_FILE_NAME,
      overwrite: false,
    });

    await writeFile(backupPath, "encrypted-backup", { mode: 0o600 });
    await expect(
      validateNewLocalVaultBackupDestination(backupPath),
    ).rejects.toMatchObject({
      code: "backup_destination_exists",
    });
    await expect(
      validateExistingLocalVaultBackupSource(backupPath),
    ).resolves.toEqual({
      parentPath: parent,
      path: backupPath,
      fileName: LOCAL_VAULT_BACKUP_FILE_NAME,
    });
  });

  it("rejects an operator filename, symlink, and hardlinked backup", async () => {
    const parent = await temporaryParent();
    await expect(
      validateNewLocalVaultBackupDestination(join(parent, "chosen.backup")),
    ).rejects.toMatchObject({ code: "invalid_backup_name" });

    const source = join(parent, "source.backup");
    const backupPath = join(parent, LOCAL_VAULT_BACKUP_FILE_NAME);
    const symlinkSource =
      process.platform === "win32" ? join(parent, "backup-directory") : source;
    if (process.platform === "win32") {
      await mkdir(symlinkSource);
    } else {
      await writeFile(source, "encrypted-backup", { mode: 0o600 });
    }
    await symlink(
      symlinkSource,
      backupPath,
      process.platform === "win32" ? "junction" : "file",
    );
    await expect(
      validateExistingLocalVaultBackupSource(backupPath),
    ).rejects.toMatchObject({
      code: "symlink_rejected",
    });
    await rm(backupPath, { recursive: process.platform === "win32" });
    if (process.platform === "win32") {
      await writeFile(source, "encrypted-backup", { mode: 0o600 });
    }
    await link(source, backupPath);
    await expect(
      validateExistingLocalVaultBackupSource(backupPath),
    ).rejects.toMatchObject({
      code: "hardlinked_file",
    });
  });
});
