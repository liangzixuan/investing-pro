import { createHash, randomBytes, type Hash } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  open,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

import {
  canonicalizeJson,
  parseCanonicalJson,
  sha256Hex,
} from "./canonical-json";
import { vaultError } from "./errors";
import {
  initializeLocalVaultRoot,
  provisionLocalVaultFileOwnerOnly,
  validateExistingLocalVaultBackupSource,
  validateNewLocalVaultBackupDestination,
  verifyLocalVaultFileOwnerOnly,
  WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
  type LocalVaultRootBoundary,
  type LocalVaultRootOptions,
  type WindowsOwnerOnlyAclPort,
  type WindowsOwnerOnlyAclVerificationReceipt,
} from "./local-vault-paths";
import {
  LOCAL_RESEARCH_RECORD_KINDS,
  LOCAL_RESEARCH_VAULT_PROFILE,
  type JsonValue,
  type LocalResearchRecordKind,
  type LocalResearchVaultInventory,
} from "./model";
import { createLocalVaultRecoveryKeyFile } from "./recovery-key-file";
import { SqliteLocalResearchVault } from "./sqlite-local-research-vault";
import {
  localVaultAttachmentAad,
  localVaultRecordAad,
  LocalVaultCryptography,
} from "./vault-crypto";
import {
  LOCAL_RESEARCH_VAULT_SCHEMA_VERSION,
  verifyLocalResearchVaultSchema,
} from "./vault-schema";

const BACKUP_PROFILE = "personal_single_user_local_vault_backup_v1" as const;
const MAGIC = Buffer.from("RCVAULTBACKUP\x00\x00\x01", "binary");
const HEADER_BYTES = 64;
const FORMAT_VERSION = 1;
const MAX_DATABASE_BYTES = 512 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 16 * 1024;
const MAX_BACKUP_BYTES = MAX_DATABASE_BYTES + MAX_MANIFEST_BYTES + 4;
const MAX_INVENTORY_RECORDS = 10_000 * LOCAL_RESEARCH_RECORD_KINDS.length;
const MAX_INVENTORY_ATTACHMENTS = 10_000;
const activeBackupDestinations = new Set<string>();

export interface EncryptedLocalVaultBackupReceipt {
  readonly profile: typeof BACKUP_PROFILE;
  readonly path: string;
  readonly createdAt: string;
  readonly databaseSha256: string;
  readonly inventorySha256: string;
  readonly recordCount: number;
  readonly attachmentCount: number;
  readonly oldBackupsMayContainDeletedRecords: true;
}

export interface CreateEncryptedLocalVaultBackupOptions {
  readonly destinationPath: string;
  readonly recoveryKey: Uint8Array;
  readonly rootBoundary: LocalVaultRootBoundary;
  readonly windowsAcl?: WindowsOwnerOnlyAclPort;
  readonly now?: () => Date;
}

export interface RestoreEncryptedLocalVaultBackupOptions extends LocalVaultRootOptions {
  readonly backupPath: string;
  readonly recoveryKey: Uint8Array;
}

export interface RestoredLocalResearchVault {
  readonly vault: SqliteLocalResearchVault;
  readonly rootBoundary: LocalVaultRootBoundary;
  readonly backupReceipt: EncryptedLocalVaultBackupReceipt;
}

interface BackupManifest {
  readonly profile: typeof BACKUP_PROFILE;
  readonly createdAt: string;
  readonly schemaVersion: number;
  readonly databaseByteLength: number;
  readonly databaseSha256: string;
  readonly inventorySha256: string;
  readonly recordCount: number;
  readonly attachmentCount: number;
  readonly oldBackupsMayContainDeletedRecords: true;
}

export async function createEncryptedLocalVaultBackup(
  vault: SqliteLocalResearchVault,
  options: CreateEncryptedLocalVaultBackupOptions,
): Promise<EncryptedLocalVaultBackupReceipt> {
  const destination = await validateNewLocalVaultBackupDestination(
    options.destinationPath,
  );
  if (isPathWithin(options.rootBoundary.paths.root, destination.parentPath)) {
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
  }
  if (activeBackupDestinations.has(destination.path)) {
    throw vaultError("VAULT_CONFLICT");
  }
  activeBackupDestinations.add(destination.path);
  let lease:
    ReturnType<SqliteLocalResearchVault["acquireBackupLease"]> | undefined;
  let snapshotPath: string | undefined;
  let snapshotIdentity: Readonly<{ dev: bigint; ino: bigint }> | undefined;
  let pendingPath: string | undefined;
  try {
    lease = vault.acquireBackupLease();
    await assertPrivateBackupParent(destination.parentPath, options.windowsAcl);
    snapshotPath = join(
      destination.parentPath,
      `.research-cockpit-vault.snapshot-${randomBytes(16).toString("hex")}.sqlite3`,
    );
    const snapshotReservation = await open(snapshotPath, "wx", 0o600);
    try {
      await snapshotReservation.sync();
    } finally {
      await snapshotReservation.close();
    }
    const reservedMetadata = await lstat(snapshotPath, {
      bigint: true,
    });
    if (!reservedMetadata.isFile() || reservedMetadata.nlink !== 1n) {
      throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
    }
    snapshotIdentity = {
      dev: reservedMetadata.dev,
      ino: reservedMetadata.ino,
    };
    await provisionExternalOwnerOnly(
      destination.parentPath,
      snapshotPath,
      options.windowsAcl,
    );
    await assertSameFileIdentity(snapshotPath, snapshotIdentity);
    await backup(lease.database, snapshotPath, {
      rate: 128,
    });
    await assertSameFileIdentity(snapshotPath, snapshotIdentity);
    normalizePortableSnapshot(snapshotPath);
    await assertSameFileIdentity(snapshotPath, snapshotIdentity);
    const snapshotInventory = readAndVerifySnapshotInventory(
      snapshotPath,
      options.recoveryKey,
    );
    if (!inventoriesMatch(snapshotInventory, lease.inventory)) {
      throw vaultError("VAULT_CORRUPT");
    }
    const databaseBytes = await readBoundedFile(
      snapshotPath,
      MAX_DATABASE_BYTES,
    );
    const createdAt = exactNow(options.now);
    const inventorySha256 = inventoryDigestSha256(lease.inventory);
    const manifest: BackupManifest = {
      profile: BACKUP_PROFILE,
      createdAt,
      schemaVersion: LOCAL_RESEARCH_VAULT_SCHEMA_VERSION,
      databaseByteLength: databaseBytes.byteLength,
      databaseSha256: sha256Hex(databaseBytes),
      inventorySha256,
      recordCount: lease.inventory.records.length,
      attachmentCount: lease.inventory.attachments.length,
      oldBackupsMayContainDeletedRecords: true,
    };
    const container = encryptContainer(
      manifest,
      databaseBytes,
      options.recoveryKey,
    );
    pendingPath = join(
      destination.parentPath,
      `.research-cockpit-vault.pending-${randomBytes(16).toString("hex")}`,
    );
    const pending = await open(pendingPath, "wx", 0o600);
    try {
      await pending.writeFile(container);
      await pending.sync();
    } finally {
      await pending.close();
    }
    await provisionExternalOwnerOnly(
      destination.parentPath,
      pendingPath,
      options.windowsAcl,
    );
    await publishWithoutReplacement(pendingPath, destination.path);
    pendingPath = undefined;
    await verifyExternalOwnerOnly(
      destination.parentPath,
      destination.path,
      options.windowsAcl,
    );
    const verified = await readAndDecryptBackup(
      destination.path,
      options.recoveryKey,
    );
    if (
      verified.manifest.databaseSha256 !== manifest.databaseSha256 ||
      verified.manifest.inventorySha256 !== manifest.inventorySha256
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
    return receiptFromManifest(destination.path, manifest);
  } finally {
    lease?.release();
    activeBackupDestinations.delete(destination.path);
    if (pendingPath !== undefined) await unlinkKnownTemporary(pendingPath);
    if (snapshotPath !== undefined && snapshotIdentity !== undefined) {
      await unlinkIfSame(snapshotPath, snapshotIdentity);
    }
  }
}

export async function restoreEncryptedLocalVaultBackup(
  options: RestoreEncryptedLocalVaultBackupOptions,
): Promise<RestoredLocalResearchVault> {
  const source = await validateExistingLocalVaultBackupSource(
    options.backupPath,
  );
  const decrypted = await readAndDecryptBackup(
    source.path,
    options.recoveryKey,
  );
  const boundary = await initializeLocalVaultRoot(options);
  let vault: SqliteLocalResearchVault | undefined;
  try {
    const persistedRecoveryKey = await createLocalVaultRecoveryKeyFile(
      boundary,
      options.windowsAcl,
      options.recoveryKey,
    );
    persistedRecoveryKey.fill(0);
    const staging = await open(boundary.paths.backupStaging, "wx", 0o600);
    try {
      await staging.writeFile(decrypted.databaseBytes);
      await staging.sync();
    } finally {
      await staging.close();
    }
    await provisionLocalVaultFileOwnerOnly(
      boundary,
      "backupStaging",
      aclOptions(options.windowsAcl),
    );
    const snapshotInventory = readAndVerifySnapshotInventory(
      boundary.paths.backupStaging,
      options.recoveryKey,
    );
    if (!inventoryMatchesManifest(snapshotInventory, decrypted.manifest)) {
      throw vaultError("VAULT_CORRUPT");
    }
    await rename(boundary.paths.backupStaging, boundary.paths.database);
    await provisionLocalVaultFileOwnerOnly(
      boundary,
      "database",
      aclOptions(options.windowsAcl),
    );
    vault = SqliteLocalResearchVault.openExisting(
      boundary.paths.database,
      options.recoveryKey,
    );
    for (const key of ["writeAheadLog", "sharedMemory"] as const) {
      if (await fileExists(boundary.paths[key])) {
        await provisionLocalVaultFileOwnerOnly(
          boundary,
          key,
          aclOptions(options.windowsAcl),
        );
      }
    }
    const restoredInventory = vault.verifyIntegrity();
    if (!inventoryMatchesManifest(restoredInventory, decrypted.manifest)) {
      throw vaultError("VAULT_CORRUPT");
    }
    await verifyLocalVaultFileOwnerOnly(
      boundary,
      "database",
      aclOptions(options.windowsAcl),
    );
    return {
      vault,
      rootBoundary: boundary,
      backupReceipt: receiptFromManifest(source.path, decrypted.manifest),
    };
  } catch (error) {
    vault?.close();
    // Recovery evidence is deliberately retained; the destination is never
    // recursively erased or silently replaced with a blank vault.
    throw error;
  }
}

function encryptContainer(
  manifest: BackupManifest,
  databaseBytes: Buffer,
  recoveryKey: Uint8Array,
): Buffer {
  const manifestBytes = Buffer.from(canonical(manifest), "utf8");
  if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) {
    throw vaultError("VAULT_INVALID_INPUT");
  }
  const plaintext = Buffer.allocUnsafe(
    4 + manifestBytes.byteLength + databaseBytes.byteLength,
  );
  plaintext.writeUInt32BE(manifestBytes.byteLength, 0);
  manifestBytes.copy(plaintext, 4);
  databaseBytes.copy(plaintext, 4 + manifestBytes.byteLength);
  if (plaintext.byteLength > MAX_BACKUP_BYTES) {
    throw vaultError("VAULT_INVALID_INPUT");
  }
  const header = newBackupHeader(plaintext.byteLength);
  const cryptography = new LocalVaultCryptography(recoveryKey);
  try {
    const encrypted = cryptography.encryptBackup(plaintext, backupAad(header));
    encrypted.nonce.copy(header, 20);
    encrypted.tag.copy(header, 32);
    return Buffer.concat([header, encrypted.ciphertext]);
  } finally {
    plaintext.fill(0);
    cryptography.close();
  }
}

async function readAndDecryptBackup(
  path: string,
  recoveryKey: Uint8Array,
): Promise<Readonly<{ manifest: BackupManifest; databaseBytes: Buffer }>> {
  const container = await readBoundedFile(
    path,
    MAX_BACKUP_BYTES + HEADER_BYTES,
  );
  if (container.byteLength < HEADER_BYTES + 5) {
    throw vaultError("VAULT_CORRUPT");
  }
  const header = container.subarray(0, HEADER_BYTES);
  verifyBackupHeader(header, container.byteLength - HEADER_BYTES);
  const cryptography = new LocalVaultCryptography(recoveryKey);
  let plaintext: Buffer;
  try {
    plaintext = cryptography.decryptBackup(
      {
        nonce: Buffer.from(header.subarray(20, 32)),
        tag: Buffer.from(header.subarray(32, 48)),
        ciphertext: Buffer.from(container.subarray(HEADER_BYTES)),
      },
      backupAad(header),
    );
  } finally {
    cryptography.close();
  }
  const manifestLength = plaintext.readUInt32BE(0);
  if (
    manifestLength < 2 ||
    manifestLength > MAX_MANIFEST_BYTES ||
    4 + manifestLength >= plaintext.byteLength
  ) {
    plaintext.fill(0);
    throw vaultError("VAULT_CORRUPT");
  }
  const manifestText = plaintext
    .subarray(4, 4 + manifestLength)
    .toString("utf8");
  const manifest = validateManifest(parseCanonicalJson(manifestText));
  const databaseBytes = Buffer.from(plaintext.subarray(4 + manifestLength));
  plaintext.fill(0);
  if (
    databaseBytes.byteLength !== manifest.databaseByteLength ||
    sha256Hex(databaseBytes) !== manifest.databaseSha256
  ) {
    databaseBytes.fill(0);
    throw vaultError("VAULT_CORRUPT");
  }
  return { manifest, databaseBytes };
}

function newBackupHeader(ciphertextLength: number): Buffer {
  const header = Buffer.alloc(HEADER_BYTES);
  MAGIC.copy(header, 0);
  header.writeUInt32BE(FORMAT_VERSION, 16);
  header.writeUInt32BE(ciphertextLength, 48);
  return header;
}

function verifyBackupHeader(
  header: Buffer,
  actualCiphertextLength: number,
): void {
  if (
    !header.subarray(0, MAGIC.byteLength).equals(MAGIC) ||
    header.readUInt32BE(16) !== FORMAT_VERSION ||
    header.readUInt32BE(48) !== actualCiphertextLength ||
    actualCiphertextLength < 5 ||
    actualCiphertextLength > MAX_BACKUP_BYTES ||
    header.subarray(52, HEADER_BYTES).some((byte) => byte !== 0)
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
}

function backupAad(header: Buffer): Buffer {
  return Buffer.concat([header.subarray(0, 20), header.subarray(48, 64)]);
}

function readAndVerifySnapshotInventory(
  path: string,
  recoveryKey: Uint8Array,
): LocalResearchVaultInventory {
  const db = new DatabaseSync(path, {
    allowExtension: false,
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
    readOnly: true,
  });
  const cryptography = new LocalVaultCryptography(recoveryKey);
  try {
    verifyLocalResearchVaultSchema(db);
    const records = db
      .prepare(
        `SELECT kind, record_id, version, payload_nonce, payload_ciphertext,
                payload_tag, payload_sha256, created_at, updated_at
           FROM vault_records ORDER BY kind, record_id LIMIT ?`,
      )
      .all(MAX_INVENTORY_RECORDS + 1)
      .map((row) => {
        const kind = exactKind(row["kind"]);
        const id = exactString(row["record_id"]);
        const version = exactPositiveInteger(row["version"]);
        const payloadSha256 = exactSha256(row["payload_sha256"]);
        const createdAt = exactTimestamp(row["created_at"]);
        const updatedAt = exactTimestamp(row["updated_at"]);
        if (createdAt > updatedAt) throw vaultError("VAULT_CORRUPT");
        const plaintext = cryptography.decryptRecord(
          {
            nonce: exactBytes(row["payload_nonce"], 12),
            ciphertext: exactBytes(row["payload_ciphertext"]),
            tag: exactBytes(row["payload_tag"], 16),
          },
          localVaultRecordAad(
            kind,
            id,
            version,
            payloadSha256,
            createdAt,
            updatedAt,
          ),
        );
        const canonicalPayload = plaintext.toString("utf8");
        plaintext.fill(0);
        if (sha256Hex(canonicalPayload) !== payloadSha256) {
          throw vaultError("VAULT_CORRUPT");
        }
        parseCanonicalJson(canonicalPayload);
        return {
          profile: LOCAL_RESEARCH_VAULT_PROFILE,
          kind,
          id,
          version,
          payloadSha256,
          createdAt,
          updatedAt,
        };
      });
    const attachments = db
      .prepare(
        `SELECT attachment_id, record_kind, record_id, record_version,
                media_type, byte_length, content_nonce, content_ciphertext,
                content_tag, content_sha256, created_at
           FROM vault_attachments ORDER BY attachment_id LIMIT ?`,
      )
      .all(MAX_INVENTORY_ATTACHMENTS + 1)
      .map((row) => {
        const attachmentId = exactString(row["attachment_id"]);
        const recordKind = exactKind(row["record_kind"]);
        const recordId = exactString(row["record_id"]);
        const recordVersion = exactPositiveInteger(row["record_version"]);
        const mediaType = exactString(row["media_type"]);
        const byteLength = exactNonnegativeInteger(row["byte_length"]);
        const contentSha256 = exactSha256(row["content_sha256"]);
        const createdAt = exactTimestamp(row["created_at"]);
        const bytes = cryptography.decryptAttachment(
          {
            nonce: exactBytes(row["content_nonce"], 12),
            ciphertext: exactBytes(row["content_ciphertext"]),
            tag: exactBytes(row["content_tag"], 16),
          },
          localVaultAttachmentAad(
            attachmentId,
            recordKind,
            recordId,
            recordVersion,
            mediaType,
            byteLength,
            contentSha256,
            createdAt,
          ),
        );
        const verified =
          bytes.byteLength === byteLength && sha256Hex(bytes) === contentSha256;
        bytes.fill(0);
        if (!verified) throw vaultError("VAULT_CORRUPT");
        return {
          attachmentId,
          recordKind,
          recordId,
          recordVersion,
          mediaType,
          byteLength,
          contentSha256,
          createdAt,
        };
      });
    if (
      records.length > MAX_INVENTORY_RECORDS ||
      attachments.length > MAX_INVENTORY_ATTACHMENTS
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
    return {
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      schemaVersion: LOCAL_RESEARCH_VAULT_SCHEMA_VERSION,
      records,
      attachments,
    };
  } finally {
    cryptography.close();
    db.close();
  }
}

function normalizePortableSnapshot(path: string): void {
  const db = new DatabaseSync(path, {
    allowExtension: false,
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
    timeout: 5_000,
  });
  try {
    db.exec("PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL;");
  } finally {
    db.close();
  }
}

function validateManifest(value: JsonValue): BackupManifest {
  const object = exactObject(value, [
    "createdAt",
    "databaseByteLength",
    "databaseSha256",
    "attachmentCount",
    "inventorySha256",
    "oldBackupsMayContainDeletedRecords",
    "profile",
    "recordCount",
    "schemaVersion",
  ]);
  if (
    object["profile"] !== BACKUP_PROFILE ||
    object["schemaVersion"] !== LOCAL_RESEARCH_VAULT_SCHEMA_VERSION ||
    object["oldBackupsMayContainDeletedRecords"] !== true
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  return {
    profile: BACKUP_PROFILE,
    createdAt: exactTimestamp(object["createdAt"]),
    schemaVersion: LOCAL_RESEARCH_VAULT_SCHEMA_VERSION,
    databaseByteLength: exactPositiveInteger(object["databaseByteLength"]),
    databaseSha256: exactSha256(object["databaseSha256"]),
    inventorySha256: exactSha256(object["inventorySha256"]),
    recordCount: exactNonnegativeInteger(object["recordCount"]),
    attachmentCount: exactNonnegativeInteger(object["attachmentCount"]),
    oldBackupsMayContainDeletedRecords: true,
  };
}

function exactObject(
  value: JsonValue | undefined,
  expectedKeys: readonly string[],
): Readonly<Record<string, JsonValue>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw vaultError("VAULT_CORRUPT");
  }
  const keys = Object.keys(value).sort(compareText);
  if (
    JSON.stringify(keys) !== JSON.stringify([...expectedKeys].sort(compareText))
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  return value as Readonly<Record<string, JsonValue>>;
}

function exactKind(value: unknown): LocalResearchRecordKind {
  if (
    typeof value !== "string" ||
    !LOCAL_RESEARCH_RECORD_KINDS.some((kind) => kind === value)
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  return value as LocalResearchRecordKind;
}

function exactString(value: unknown): string {
  if (typeof value !== "string") throw vaultError("VAULT_CORRUPT");
  return value;
}

function exactSha256(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw vaultError("VAULT_CORRUPT");
  }
  return value;
}

function exactBytes(value: unknown, length?: number): Buffer {
  if (!(value instanceof Uint8Array)) throw vaultError("VAULT_CORRUPT");
  const bytes = Buffer.from(value);
  if (length !== undefined && bytes.byteLength !== length) {
    throw vaultError("VAULT_CORRUPT");
  }
  return bytes;
}

function exactTimestamp(value: unknown): string {
  const timestamp = exactString(value);
  const parsed = new Date(timestamp);
  if (
    !Number.isFinite(parsed.valueOf()) ||
    parsed.toISOString() !== timestamp
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  return timestamp;
}

function exactPositiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw vaultError("VAULT_CORRUPT");
  }
  return value;
}

function exactNonnegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw vaultError("VAULT_CORRUPT");
  }
  return value;
}

function exactNow(clock: (() => Date) | undefined): string {
  const value = (clock ?? (() => new Date()))();
  if (!(value instanceof Date) || !Number.isFinite(value.valueOf())) {
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
  }
  return value.toISOString();
}

function receiptFromManifest(
  path: string,
  manifest: BackupManifest,
): EncryptedLocalVaultBackupReceipt {
  return {
    profile: BACKUP_PROFILE,
    path,
    createdAt: manifest.createdAt,
    databaseSha256: manifest.databaseSha256,
    inventorySha256: manifest.inventorySha256,
    recordCount: manifest.recordCount,
    attachmentCount: manifest.attachmentCount,
    oldBackupsMayContainDeletedRecords: true,
  };
}

function inventoryMatchesManifest(
  inventory: LocalResearchVaultInventory,
  manifest: BackupManifest,
): boolean {
  return (
    inventory.records.length === manifest.recordCount &&
    inventory.attachments.length === manifest.attachmentCount &&
    inventoryDigestSha256(inventory) === manifest.inventorySha256
  );
}

function inventoriesMatch(
  left: LocalResearchVaultInventory,
  right: LocalResearchVaultInventory,
): boolean {
  return (
    left.records.length === right.records.length &&
    left.attachments.length === right.attachments.length &&
    inventoryDigestSha256(left) === inventoryDigestSha256(right)
  );
}

function inventoryDigestSha256(inventory: LocalResearchVaultInventory): string {
  const hash = createHash("sha256");
  hash.update("research-cockpit:local-research-vault:inventory:v1\0", "utf8");
  updateFramedHash(
    hash,
    "header",
    canonical({
      profile: inventory.profile,
      schemaVersion: inventory.schemaVersion,
    }),
  );
  updateFramedHash(hash, "record-count", String(inventory.records.length));
  for (const record of inventory.records) {
    updateFramedHash(hash, "record", canonical(record));
  }
  updateFramedHash(
    hash,
    "attachment-count",
    String(inventory.attachments.length),
  );
  for (const attachment of inventory.attachments) {
    updateFramedHash(hash, "attachment", canonical(attachment));
  }
  return hash.digest("hex");
}

function updateFramedHash(hash: Hash, label: string, value: string): void {
  const bytes = Buffer.from(value, "utf8");
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(bytes.byteLength);
  hash.update(label, "utf8");
  hash.update("\0", "utf8");
  hash.update(length);
  hash.update(bytes);
}

async function assertPrivateBackupParent(
  parentPath: string,
  windowsAcl: WindowsOwnerOnlyAclPort | undefined,
): Promise<void> {
  if (process.platform === "win32") {
    if (windowsAcl === undefined) {
      throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
    }
    const receipt = await windowsAcl.verifyOwnerOnly({
      canonicalRootPath: parentPath,
      targetPaths: [parentPath],
    });
    assertExternalAclReceipt(receipt, parentPath, [parentPath]);
    return;
  }
  const metadata = await lstat(parentPath, { bigint: true });
  if (!metadata.isDirectory() || (Number(metadata.mode) & 0o777) !== 0o700) {
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
  }
}

async function provisionExternalOwnerOnly(
  parentPath: string,
  filePath: string,
  windowsAcl: WindowsOwnerOnlyAclPort | undefined,
): Promise<void> {
  if (process.platform === "win32") {
    if (windowsAcl === undefined) {
      throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
    }
    const paths = [parentPath, filePath];
    const receipt = await windowsAcl.provisionAndVerifyOwnerOnly({
      canonicalRootPath: parentPath,
      targetPaths: paths,
    });
    assertExternalAclReceipt(receipt, parentPath, paths);
    return;
  }
  await chmod(filePath, 0o600);
}

async function verifyExternalOwnerOnly(
  parentPath: string,
  filePath: string,
  windowsAcl: WindowsOwnerOnlyAclPort | undefined,
): Promise<void> {
  if (process.platform === "win32") {
    if (windowsAcl === undefined) {
      throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
    }
    const paths = [parentPath, filePath];
    const receipt = await windowsAcl.verifyOwnerOnly({
      canonicalRootPath: parentPath,
      targetPaths: paths,
    });
    assertExternalAclReceipt(receipt, parentPath, paths);
    return;
  }
  const metadata = await lstat(filePath, { bigint: true });
  if (
    !metadata.isFile() ||
    metadata.nlink !== 1n ||
    (Number(metadata.mode) & 0o777) !== 0o600
  ) {
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
  }
}

function assertExternalAclReceipt(
  receipt: WindowsOwnerOnlyAclVerificationReceipt,
  root: string,
  paths: readonly string[],
): void {
  if (
    receipt.profile !== WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE ||
    receipt.canonicalRootPath !== root ||
    receipt.ownerIdentity.length === 0 ||
    receipt.inheritanceProtected !== true ||
    receipt.ownerOnly !== true ||
    canonical([...receipt.verifiedPaths].sort(compareText)) !==
      canonical([...paths].sort(compareText))
  ) {
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
  }
}

async function readBoundedFile(
  path: string,
  maximumBytes: number,
): Promise<Buffer> {
  const metadata = await lstat(path, { bigint: true });
  if (
    !metadata.isFile() ||
    metadata.nlink !== 1n ||
    metadata.size < 1n ||
    metadata.size > BigInt(maximumBytes)
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  const bytes = await readFile(path);
  if (bytes.byteLength !== Number(metadata.size)) {
    throw vaultError("VAULT_CORRUPT");
  }
  return bytes;
}

async function publishWithoutReplacement(
  pendingPath: string,
  destinationPath: string,
): Promise<void> {
  try {
    await link(pendingPath, destinationPath);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw vaultError("VAULT_ALREADY_EXISTS");
    }
    throw error;
  }
  await unlink(pendingPath);
}

async function assertSameFileIdentity(
  path: string,
  expected: Readonly<{ dev: bigint; ino: bigint }>,
): Promise<void> {
  const metadata = await lstat(path, { bigint: true });
  if (
    !metadata.isFile() ||
    metadata.nlink !== 1n ||
    metadata.dev !== expected.dev ||
    metadata.ino !== expected.ino
  ) {
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
  }
}

function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const fromRoot = relative(rootPath, candidatePath);
  return (
    fromRoot === "" ||
    (!isAbsolute(fromRoot) &&
      fromRoot !== ".." &&
      !fromRoot.startsWith(`..${sep}`))
  );
}

async function fileExists(path: string): Promise<boolean> {
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

async function unlinkKnownTemporary(path: string): Promise<void> {
  try {
    const metadata = await lstat(path, { bigint: true });
    if (metadata.isFile() && metadata.nlink === 1n) await unlink(path);
  } catch (error: unknown) {
    if (!(
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    )) {
      // Unknown temporary state is retained rather than erased.
    }
  }
}

async function unlinkIfSame(
  path: string,
  expected: Readonly<{ dev: bigint; ino: bigint }>,
): Promise<void> {
  try {
    const metadata = await lstat(path, { bigint: true });
    if (
      metadata.isFile() &&
      metadata.nlink === 1n &&
      metadata.dev === expected.dev &&
      metadata.ino === expected.ino
    ) {
      await unlink(path);
    }
  } catch (error: unknown) {
    if (!(
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    )) {
      // Unknown staging state is retained for operator recovery.
    }
  }
}

function canonical(value: unknown): string {
  return canonicalizeJson(value as JsonValue);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function aclOptions(
  windowsAcl: WindowsOwnerOnlyAclPort | undefined,
): Readonly<{ windowsAcl?: WindowsOwnerOnlyAclPort }> {
  return windowsAcl === undefined ? {} : { windowsAcl };
}
