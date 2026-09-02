import { lstat } from "node:fs/promises";

import {
  createEncryptedLocalVaultBackup,
  restoreEncryptedLocalVaultBackup,
  type CreateEncryptedLocalVaultBackupOptions,
  type EncryptedLocalVaultBackupReceipt,
  type RestoreEncryptedLocalVaultBackupOptions,
} from "./encrypted-vault-backup";
import { vaultError } from "./errors";
import {
  initializeLocalVaultRoot,
  openLocalVaultRoot,
  provisionLocalVaultFileOwnerOnly,
  verifyLocalVaultFileOwnerOnly,
  type LocalVaultRootBoundary,
  type LocalVaultRootOptions,
  type WindowsOwnerOnlyAclPort,
} from "./local-vault-paths";
import type {
  DeleteLocalResearchRecordCommand,
  LocalResearchAttachment,
  LocalResearchMutationReceipt,
  LocalResearchRecord,
  LocalResearchRecordKind,
  LocalResearchVaultInventory,
  PutLocalResearchAttachmentCommand,
  PutLocalResearchRecordCommand,
} from "./model";
import {
  createLocalVaultRecoveryKeyFile,
  readLocalVaultRecoveryKeyFile,
} from "./recovery-key-file";
import { SqliteLocalResearchVault } from "./sqlite-local-research-vault";
import { createNativeWindowsOwnerOnlyAclPort } from "./windows-owner-only-acl";

export interface LocalResearchVaultStartupOptions extends LocalVaultRootOptions {
  readonly now?: () => Date;
}

export interface RestoredLocalResearchVaultRuntime {
  readonly vault: LocalResearchVault;
  readonly backupReceipt: EncryptedLocalVaultBackupReceipt;
}

export class LocalResearchVault {
  readonly #adapter: SqliteLocalResearchVault;
  readonly #recoveryKey: Buffer;
  readonly #windowsAcl: WindowsOwnerOnlyAclPort | undefined;
  readonly #rootBoundary: LocalVaultRootBoundary;
  #closed = false;

  private constructor(
    adapter: SqliteLocalResearchVault,
    recoveryKey: Buffer,
    rootBoundary: LocalVaultRootBoundary,
    windowsAcl: WindowsOwnerOnlyAclPort | undefined,
  ) {
    this.#adapter = adapter;
    this.#recoveryKey = recoveryKey;
    this.#rootBoundary = rootBoundary;
    this.#windowsAcl = windowsAcl;
  }

  static async initialize(
    options: LocalResearchVaultStartupOptions,
  ): Promise<LocalResearchVault> {
    const windowsAcl = resolveWindowsAcl(options);
    const rootBoundary = await initializeLocalVaultRoot({
      ...options,
      ...(windowsAcl === undefined ? {} : { windowsAcl }),
    });
    const recoveryKey = await createLocalVaultRecoveryKeyFile(
      rootBoundary,
      windowsAcl,
    );
    let adapter: SqliteLocalResearchVault | undefined;
    try {
      adapter = SqliteLocalResearchVault.createNew(
        rootBoundary.paths.database,
        recoveryKey,
        options.now,
      );
      await provisionCreatedSqliteFiles(rootBoundary, windowsAcl);
      const verifiedBoundary = await openLocalVaultRoot({
        ...options,
        ...(windowsAcl === undefined ? {} : { windowsAcl }),
      });
      assertOperationalFileSet(verifiedBoundary);
      return new LocalResearchVault(
        adapter,
        recoveryKey,
        verifiedBoundary,
        windowsAcl,
      );
    } catch (error) {
      adapter?.close();
      recoveryKey.fill(0);
      throw error;
    }
  }

  static async open(
    options: LocalResearchVaultStartupOptions,
  ): Promise<LocalResearchVault> {
    const windowsAcl = resolveWindowsAcl(options);
    const rootBoundary = await openLocalVaultRoot({
      ...options,
      ...(windowsAcl === undefined ? {} : { windowsAcl }),
    });
    assertOperationalFileSet(rootBoundary);
    const recoveryKey = await readLocalVaultRecoveryKeyFile(
      rootBoundary,
      windowsAcl,
    );
    const before = await fileIdentity(rootBoundary.paths.database);
    let adapter: SqliteLocalResearchVault | undefined;
    try {
      adapter = SqliteLocalResearchVault.openExisting(
        rootBoundary.paths.database,
        recoveryKey,
        options.now,
      );
      const after = await fileIdentity(rootBoundary.paths.database);
      if (!sameIdentity(before, after)) {
        throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
      }
      await provisionCreatedSqliteFiles(rootBoundary, windowsAcl);
      await verifyOperationalSqliteFiles(rootBoundary, windowsAcl);
      adapter.verifyIntegrity();
      return new LocalResearchVault(
        adapter,
        recoveryKey,
        rootBoundary,
        windowsAcl,
      );
    } catch (error) {
      adapter?.close();
      recoveryKey.fill(0);
      throw error;
    }
  }

  static async restore(
    options: RestoreEncryptedLocalVaultBackupOptions,
  ): Promise<RestoredLocalResearchVaultRuntime> {
    const windowsAcl = resolveWindowsAcl(options);
    if (
      !(options.recoveryKey instanceof Uint8Array) ||
      options.recoveryKey.byteLength !== 32
    ) {
      throw vaultError("VAULT_INVALID_INPUT");
    }
    const recoveryKey = Buffer.from(options.recoveryKey);
    try {
      const restored = await restoreEncryptedLocalVaultBackup({
        ...options,
        recoveryKey,
        ...(windowsAcl === undefined ? {} : { windowsAcl }),
      });
      return {
        vault: new LocalResearchVault(
          restored.vault,
          recoveryKey,
          restored.rootBoundary,
          windowsAcl,
        ),
        backupReceipt: restored.backupReceipt,
      };
    } catch (error) {
      recoveryKey.fill(0);
      throw error;
    }
  }

  get profile(): "personal_single_user_local_vault" {
    return "personal_single_user_local_vault";
  }

  getRecord(kind: LocalResearchRecordKind, id: string): LocalResearchRecord {
    this.#assertOpen();
    return this.#adapter.getRecord(kind, id);
  }

  listRecords(kind: LocalResearchRecordKind): readonly LocalResearchRecord[] {
    this.#assertOpen();
    return this.#adapter.listRecords(kind);
  }

  putRecord(
    command: PutLocalResearchRecordCommand,
  ): LocalResearchMutationReceipt {
    this.#assertOpen();
    return this.#adapter.putRecord(command);
  }

  deleteRecord(
    command: DeleteLocalResearchRecordCommand,
  ): LocalResearchMutationReceipt {
    this.#assertOpen();
    return this.#adapter.deleteRecord(command);
  }

  putAttachment(
    command: PutLocalResearchAttachmentCommand,
  ): LocalResearchMutationReceipt {
    this.#assertOpen();
    return this.#adapter.putAttachment(command);
  }

  getAttachment(attachmentId: string): LocalResearchAttachment {
    this.#assertOpen();
    return this.#adapter.getAttachment(attachmentId);
  }

  inventory(): LocalResearchVaultInventory {
    this.#assertOpen();
    return this.#adapter.verifyIntegrity();
  }

  createEncryptedBackup(
    destinationPath: string,
    now?: () => Date,
  ): Promise<EncryptedLocalVaultBackupReceipt> {
    this.#assertOpen();
    const options: CreateEncryptedLocalVaultBackupOptions = {
      destinationPath,
      recoveryKey: this.#recoveryKey,
      rootBoundary: this.#rootBoundary,
      ...(this.#windowsAcl === undefined
        ? {}
        : { windowsAcl: this.#windowsAcl }),
      ...(now === undefined ? {} : { now }),
    };
    return createEncryptedLocalVaultBackup(this.#adapter, options);
  }

  close(): void {
    if (this.#closed) return;
    this.#adapter.close();
    this.#recoveryKey.fill(0);
    this.#closed = true;
  }

  #assertOpen(): void {
    if (this.#closed) throw vaultError("VAULT_CLOSED");
  }
}

function resolveWindowsAcl(
  options: LocalVaultRootOptions,
): WindowsOwnerOnlyAclPort | undefined {
  const platform = options.permissionPlatform ?? process.platform;
  if (platform !== "win32") return undefined;
  return options.windowsAcl ?? createNativeWindowsOwnerOnlyAclPort();
}

async function provisionCreatedSqliteFiles(
  boundary: LocalVaultRootBoundary,
  windowsAcl: WindowsOwnerOnlyAclPort | undefined,
): Promise<void> {
  for (const key of ["database", "writeAheadLog", "sharedMemory"] as const) {
    if (!(await pathExists(boundary.paths[key]))) continue;
    await provisionLocalVaultFileOwnerOnly(
      boundary,
      key,
      windowsAcl === undefined ? {} : { windowsAcl },
    );
  }
}

async function verifyOperationalSqliteFiles(
  boundary: LocalVaultRootBoundary,
  windowsAcl: WindowsOwnerOnlyAclPort | undefined,
): Promise<void> {
  for (const key of ["database", "writeAheadLog", "sharedMemory"] as const) {
    if (!(await pathExists(boundary.paths[key]))) continue;
    await verifyLocalVaultFileOwnerOnly(
      boundary,
      key,
      windowsAcl === undefined ? {} : { windowsAcl },
    );
  }
}

function assertOperationalFileSet(boundary: LocalVaultRootBoundary): void {
  const files = new Set(boundary.existingFiles);
  if (
    !files.has("database") ||
    !files.has("recoveryKey") ||
    files.has("backupStaging")
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function fileIdentity(
  path: string,
): Promise<Readonly<{ dev: bigint; ino: bigint }>> {
  const metadata = await lstat(path, { bigint: true });
  if (!metadata.isFile() || metadata.nlink !== 1n) {
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
  }
  return { dev: metadata.dev, ino: metadata.ino };
}

function sameIdentity(
  left: Readonly<{ dev: bigint; ino: bigint }>,
  right: Readonly<{ dev: bigint; ino: bigint }>,
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}
