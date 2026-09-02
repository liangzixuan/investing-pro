import {
  chmod,
  lstat,
  mkdir,
  readdir,
  realpath,
  rmdir,
} from "node:fs/promises";
import type { BigIntStats } from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";

export const LOCAL_VAULT_PATH_PROFILE =
  "personal_single_user_local_vault_paths_v1" as const;
export const WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE =
  "personal_single_user_local_vault_windows_acl_v1" as const;

export const LOCAL_VAULT_FILE_NAMES = Object.freeze({
  recoveryKey: "vault-recovery.key",
  database: "vault.sqlite3",
  writeAheadLog: "vault.sqlite3-wal",
  sharedMemory: "vault.sqlite3-shm",
  backupStaging: "vault-backup.staging",
} as const);

export const LOCAL_VAULT_BACKUP_FILE_NAME =
  "research-cockpit-vault.backup" as const;

export type LocalVaultFileKey = keyof typeof LOCAL_VAULT_FILE_NAMES;

export type LocalVaultPathErrorCode =
  | "ambiguous_path"
  | "backup_destination_exists"
  | "backup_source_missing"
  | "hardlinked_file"
  | "insecure_permissions"
  | "invalid_acl_receipt"
  | "invalid_backup_name"
  | "non_canonical_parent"
  | "non_regular_file"
  | "parent_changed"
  | "parent_missing"
  | "root_changed"
  | "root_exists"
  | "root_missing"
  | "symlink_rejected"
  | "unexpected_root_entry"
  | "windows_acl_port_required";

export class LocalVaultPathError extends Error {
  public readonly code: LocalVaultPathErrorCode;

  public constructor(code: LocalVaultPathErrorCode, message: string) {
    super(message);
    this.name = "LocalVaultPathError";
    this.code = code;
  }
}

export interface WindowsOwnerOnlyAclTarget {
  readonly canonicalRootPath: string;
  readonly targetPaths: readonly string[];
}

/**
 * A trusted Windows adapter must inspect the effective ACL after applying it.
 * A successful command exit, chmod, or a requested ACL is not a receipt.
 */
export interface WindowsOwnerOnlyAclVerificationReceipt {
  readonly profile: typeof WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE;
  readonly canonicalRootPath: string;
  readonly verifiedPaths: readonly string[];
  readonly ownerIdentity: string;
  readonly inheritanceProtected: true;
  readonly ownerOnly: true;
}

export interface WindowsOwnerOnlyAclPort {
  provisionAndVerifyOwnerOnly(
    target: WindowsOwnerOnlyAclTarget,
  ): Promise<WindowsOwnerOnlyAclVerificationReceipt>;
  verifyOwnerOnly(
    target: WindowsOwnerOnlyAclTarget,
  ): Promise<WindowsOwnerOnlyAclVerificationReceipt>;
}

export interface LocalVaultPaths {
  readonly root: string;
  readonly recoveryKey: string;
  readonly database: string;
  readonly writeAheadLog: string;
  readonly sharedMemory: string;
  readonly backupStaging: string;
}

export interface LocalVaultRootBoundary {
  readonly profile: typeof LOCAL_VAULT_PATH_PROFILE;
  readonly permissionPlatform: NodeJS.Platform;
  readonly paths: LocalVaultPaths;
  readonly existingFiles: readonly LocalVaultFileKey[];
  readonly aclReceipt?: WindowsOwnerOnlyAclVerificationReceipt;
}

export interface LocalVaultRootOptions {
  /** Fixed once at process startup; never populate this from an HTTP request. */
  readonly startupRootPath: string;
  readonly permissionPlatform?: NodeJS.Platform;
  readonly windowsAcl?: WindowsOwnerOnlyAclPort;
}

export interface LocalVaultFilePermissionOptions {
  readonly windowsAcl?: WindowsOwnerOnlyAclPort;
}

export interface NewLocalVaultBackupDestination {
  readonly parentPath: string;
  readonly path: string;
  readonly fileName: typeof LOCAL_VAULT_BACKUP_FILE_NAME;
  readonly overwrite: false;
}

export interface ExistingLocalVaultBackupSource {
  readonly parentPath: string;
  readonly path: string;
  readonly fileName: typeof LOCAL_VAULT_BACKUP_FILE_NAME;
}

interface CanonicalChildCandidate {
  readonly canonicalParentPath: string;
  readonly candidatePath: string;
  readonly parentIdentity: FileIdentity;
}

interface FileIdentity {
  readonly device: bigint;
  readonly inode: bigint;
}

interface FixedRootEntryInspection {
  readonly key: LocalVaultFileKey;
  readonly identity: FileIdentity;
}

const ALLOWED_ROOT_ENTRIES = new Map<string, LocalVaultFileKey>(
  Object.entries(LOCAL_VAULT_FILE_NAMES).map(([key, value]) => [
    value,
    key as LocalVaultFileKey,
  ]),
);

function fail(code: LocalVaultPathErrorCode, message: string): never {
  throw new LocalVaultPathError(code, message);
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error;
}

function samePath(left: string, right: string): boolean {
  const canonicalLeft = normalize(resolve(left));
  const canonicalRight = normalize(resolve(right));
  return process.platform === "win32"
    ? canonicalLeft.toLowerCase() === canonicalRight.toLowerCase()
    : canonicalLeft === canonicalRight;
}

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function identityOf(metadata: BigIntStats): FileIdentity {
  return { device: metadata.dev, inode: metadata.ino };
}

function assertUnambiguousAbsolutePath(input: string): void {
  if (
    input.length === 0 ||
    input.trim() !== input ||
    input.includes("\0") ||
    /^file:/iu.test(input)
  ) {
    fail(
      "ambiguous_path",
      "The local vault path is not an absolute file-system path.",
    );
  }

  if (/^(?:[/\\]{2}|[/\\]{2}[?.][/\\])/u.test(input)) {
    fail(
      "ambiguous_path",
      "UNC, device, and double-root paths are prohibited.",
    );
  }

  if (!isAbsolute(input)) {
    fail("ambiguous_path", "The local vault path must be absolute.");
  }

  if (input.endsWith("/") || input.endsWith("\\")) {
    fail("ambiguous_path", "A trailing path separator is prohibited.");
  }

  const segments = input.split(/[\\/]/u);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    fail("ambiguous_path", "Dot path segments are prohibited.");
  }

  if (normalize(input) !== input) {
    fail(
      "ambiguous_path",
      "The local vault path must use one normalized spelling.",
    );
  }

  if (process.platform === "win32") {
    const withoutDrive = input.slice(2);
    if (!/^[A-Za-z]:\\/u.test(input) || withoutDrive.includes(":")) {
      fail(
        "ambiguous_path",
        "The Windows vault path has an ambiguous drive or stream spelling.",
      );
    }
  } else if (input.includes("\\") || input.includes(":")) {
    fail(
      "ambiguous_path",
      "Cross-platform separator and URI ambiguity is prohibited.",
    );
  }
}

async function lstatIfPresent(path: string): Promise<BigIntStats | undefined> {
  try {
    return await lstat(path, { bigint: true });
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function canonicalDirectChildCandidate(
  inputPath: string,
): Promise<CanonicalChildCandidate> {
  assertUnambiguousAbsolutePath(inputPath);
  const suppliedParentPath = dirname(inputPath);
  const childName = basename(inputPath);
  if (childName.length === 0 || childName === "." || childName === "..") {
    fail("ambiguous_path", "The path must name one direct child.");
  }

  const parentBefore = await lstatIfPresent(suppliedParentPath);
  if (parentBefore === undefined) {
    fail("parent_missing", "The local vault parent must already exist.");
  }
  if (parentBefore.isSymbolicLink()) {
    fail(
      "symlink_rejected",
      "The local vault parent cannot be a symbolic link.",
    );
  }
  if (!parentBefore.isDirectory()) {
    fail("parent_missing", "The local vault parent must be a directory.");
  }

  const canonicalParentPath = await realpath(suppliedParentPath);
  if (!samePath(canonicalParentPath, suppliedParentPath)) {
    fail(
      "non_canonical_parent",
      "The local vault parent must be canonical and symlink-free.",
    );
  }

  const candidatePath = join(canonicalParentPath, childName);
  if (
    !samePath(candidatePath, inputPath) ||
    relative(canonicalParentPath, candidatePath) !== childName ||
    childName.includes(sep)
  ) {
    fail(
      "ambiguous_path",
      "The path must be a direct child of its canonical parent.",
    );
  }

  const parentAfter = await lstat(suppliedParentPath, { bigint: true });
  if (
    !parentAfter.isDirectory() ||
    parentAfter.isSymbolicLink() ||
    !sameIdentity(identityOf(parentBefore), identityOf(parentAfter)) ||
    !samePath(await realpath(suppliedParentPath), canonicalParentPath)
  ) {
    fail("parent_changed", "The local vault parent changed during validation.");
  }

  return {
    canonicalParentPath,
    candidatePath,
    parentIdentity: identityOf(parentAfter),
  };
}

function deriveFixedPaths(root: string): LocalVaultPaths {
  return Object.freeze({
    root,
    recoveryKey: join(root, LOCAL_VAULT_FILE_NAMES.recoveryKey),
    database: join(root, LOCAL_VAULT_FILE_NAMES.database),
    writeAheadLog: join(root, LOCAL_VAULT_FILE_NAMES.writeAheadLog),
    sharedMemory: join(root, LOCAL_VAULT_FILE_NAMES.sharedMemory),
    backupStaging: join(root, LOCAL_VAULT_FILE_NAMES.backupStaging),
  });
}

function assertExpectedAclReceipt(
  receipt: WindowsOwnerOnlyAclVerificationReceipt,
  expected: WindowsOwnerOnlyAclTarget,
): void {
  const expectedPaths = [...expected.targetPaths].sort((left, right) =>
    left.localeCompare(right),
  );
  const receiptPaths = [...receipt.verifiedPaths].sort((left, right) =>
    left.localeCompare(right),
  );
  const pathsMatch =
    expectedPaths.length === receiptPaths.length &&
    expectedPaths.every((path, index) => {
      const receiptPath = receiptPaths[index];
      return receiptPath !== undefined && samePath(path, receiptPath);
    });

  if (
    receipt.profile !== WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE ||
    !samePath(receipt.canonicalRootPath, expected.canonicalRootPath) ||
    receipt.ownerIdentity.trim().length === 0 ||
    receipt.inheritanceProtected !== true ||
    receipt.ownerOnly !== true ||
    !pathsMatch
  ) {
    fail(
      "invalid_acl_receipt",
      "The Windows ACL adapter did not return an exact verification receipt.",
    );
  }
}

function requireWindowsAclPort(
  port: WindowsOwnerOnlyAclPort | undefined,
): WindowsOwnerOnlyAclPort {
  if (port === undefined) {
    fail(
      "windows_acl_port_required",
      "Windows requires an owner-only ACL verifier.",
    );
  }
  return port;
}

async function provisionOwnerOnly(
  platform: NodeJS.Platform,
  canonicalRootPath: string,
  targetPaths: readonly string[],
  windowsAcl: WindowsOwnerOnlyAclPort | undefined,
): Promise<WindowsOwnerOnlyAclVerificationReceipt | undefined> {
  if (platform === "win32") {
    const port = requireWindowsAclPort(windowsAcl);
    const target = { canonicalRootPath, targetPaths };
    const receipt = await port.provisionAndVerifyOwnerOnly(target);
    assertExpectedAclReceipt(receipt, target);
    return receipt;
  }

  for (const targetPath of targetPaths) {
    const metadata = await lstat(targetPath, { bigint: true });
    await chmod(targetPath, metadata.isDirectory() ? 0o700 : 0o600);
  }
  await verifyPosixPermissions(targetPaths);
  return undefined;
}

async function verifyOwnerOnly(
  platform: NodeJS.Platform,
  canonicalRootPath: string,
  targetPaths: readonly string[],
  windowsAcl: WindowsOwnerOnlyAclPort | undefined,
): Promise<WindowsOwnerOnlyAclVerificationReceipt | undefined> {
  if (platform === "win32") {
    const port = requireWindowsAclPort(windowsAcl);
    const target = { canonicalRootPath, targetPaths };
    const receipt = await port.verifyOwnerOnly(target);
    assertExpectedAclReceipt(receipt, target);
    return receipt;
  }
  await verifyPosixPermissions(targetPaths);
  return undefined;
}

async function verifyPosixPermissions(
  targetPaths: readonly string[],
): Promise<void> {
  for (const targetPath of targetPaths) {
    const metadata = await lstat(targetPath, { bigint: true });
    const expected = metadata.isDirectory() ? 0o700 : 0o600;
    if ((Number(metadata.mode) & 0o777) !== expected) {
      fail(
        "insecure_permissions",
        `Expected owner-only mode ${expected.toString(8)} for ${basename(targetPath)}.`,
      );
    }
  }
}

async function assertStableRoot(
  rootPath: string,
  expectedIdentity: FileIdentity,
): Promise<void> {
  const metadata = await lstat(rootPath, { bigint: true });
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    !sameIdentity(identityOf(metadata), expectedIdentity) ||
    !samePath(await realpath(rootPath), rootPath)
  ) {
    fail("root_changed", "The local vault root changed during validation.");
  }
}

async function assertStableParent(
  candidate: CanonicalChildCandidate,
): Promise<void> {
  const metadata = await lstat(candidate.canonicalParentPath, { bigint: true });
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    !sameIdentity(identityOf(metadata), candidate.parentIdentity) ||
    !samePath(
      await realpath(candidate.canonicalParentPath),
      candidate.canonicalParentPath,
    )
  ) {
    fail("parent_changed", "The canonical parent changed during validation.");
  }
}

async function inspectRegularFile(path: string): Promise<FileIdentity> {
  const metadata = await lstat(path, { bigint: true });
  if (metadata.isSymbolicLink()) {
    fail(
      "symlink_rejected",
      `Symbolic links are prohibited for ${basename(path)}.`,
    );
  }
  if (!metadata.isFile()) {
    fail("non_regular_file", `${basename(path)} must be a regular file.`);
  }
  if (metadata.nlink !== 1n) {
    fail(
      "hardlinked_file",
      `Hardlinked files are prohibited for ${basename(path)}.`,
    );
  }
  if (!samePath(await realpath(path), path)) {
    fail(
      "symlink_rejected",
      `${basename(path)} must resolve to its fixed direct-child path.`,
    );
  }
  return identityOf(metadata);
}

async function inspectFixedRootEntries(
  paths: LocalVaultPaths,
): Promise<readonly FixedRootEntryInspection[]> {
  const existing: FixedRootEntryInspection[] = [];
  const entries = await readdir(paths.root, { withFileTypes: true });
  for (const entry of entries) {
    const key = ALLOWED_ROOT_ENTRIES.get(entry.name);
    if (key === undefined) {
      fail(
        "unexpected_root_entry",
        `Unexpected local vault root entry: ${entry.name}.`,
      );
    }
    if (entry.isSymbolicLink()) {
      fail(
        "symlink_rejected",
        `Symbolic links are prohibited for ${entry.name}.`,
      );
    }
    existing.push({ key, identity: await inspectRegularFile(paths[key]) });
  }
  return Object.freeze(
    existing.sort((left, right) => left.key.localeCompare(right.key)),
  );
}

function assertSameRootEntries(
  before: readonly FixedRootEntryInspection[],
  after: readonly FixedRootEntryInspection[],
): void {
  if (
    before.length !== after.length ||
    before.some((entry, index) => {
      const next = after[index];
      return (
        next === undefined ||
        next.key !== entry.key ||
        !sameIdentity(next.identity, entry.identity)
      );
    })
  ) {
    fail("root_changed", "A fixed local vault file changed during validation.");
  }
}

function assertFixedBoundary(boundary: LocalVaultRootBoundary): void {
  if (boundary.profile !== LOCAL_VAULT_PATH_PROFILE) {
    fail("ambiguous_path", "The local vault boundary profile is invalid.");
  }
  assertUnambiguousAbsolutePath(boundary.paths.root);
  const expected = deriveFixedPaths(boundary.paths.root);
  const keys: readonly LocalVaultFileKey[] = [
    "recoveryKey",
    "database",
    "writeAheadLog",
    "sharedMemory",
    "backupStaging",
  ];
  if (keys.some((key) => boundary.paths[key] !== expected[key])) {
    fail(
      "ambiguous_path",
      "The local vault boundary contains a non-fixed child path.",
    );
  }
}

export async function initializeLocalVaultRoot(
  options: LocalVaultRootOptions,
): Promise<LocalVaultRootBoundary> {
  const candidate = await canonicalDirectChildCandidate(
    options.startupRootPath,
  );
  if ((await lstatIfPresent(candidate.candidatePath)) !== undefined) {
    fail(
      "root_exists",
      "Initialization never opens or overwrites an existing vault root.",
    );
  }

  await mkdir(candidate.candidatePath, { mode: 0o700 });
  const rootMetadata = await lstat(candidate.candidatePath, { bigint: true });
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    fail(
      "root_changed",
      "The newly created vault root is not a real directory.",
    );
  }
  const rootIdentity = identityOf(rootMetadata);
  const platform = options.permissionPlatform ?? process.platform;

  let aclReceipt: WindowsOwnerOnlyAclVerificationReceipt | undefined;
  try {
    aclReceipt = await provisionOwnerOnly(
      platform,
      candidate.candidatePath,
      [candidate.candidatePath],
      options.windowsAcl,
    );
    await assertStableRoot(candidate.candidatePath, rootIdentity);
    await assertStableParent(candidate);
  } catch (error: unknown) {
    try {
      const cleanupMetadata = await lstat(candidate.candidatePath, {
        bigint: true,
      });
      if (
        cleanupMetadata.isDirectory() &&
        !cleanupMetadata.isSymbolicLink() &&
        sameIdentity(identityOf(cleanupMetadata), rootIdentity)
      ) {
        await rmdir(candidate.candidatePath);
      }
    } catch {
      // A non-empty or replaced root is deliberately left untouched.
    }
    throw error;
  }

  const paths = deriveFixedPaths(await realpath(candidate.candidatePath));
  return Object.freeze({
    profile: LOCAL_VAULT_PATH_PROFILE,
    permissionPlatform: platform,
    paths,
    existingFiles: Object.freeze([]),
    ...(aclReceipt === undefined ? {} : { aclReceipt }),
  });
}

export async function openLocalVaultRoot(
  options: LocalVaultRootOptions,
): Promise<LocalVaultRootBoundary> {
  const candidate = await canonicalDirectChildCandidate(
    options.startupRootPath,
  );
  const rootMetadata = await lstatIfPresent(candidate.candidatePath);
  if (rootMetadata === undefined) {
    fail("root_missing", "The local vault root does not exist.");
  }
  if (rootMetadata.isSymbolicLink()) {
    fail("symlink_rejected", "The local vault root cannot be a symbolic link.");
  }
  if (!rootMetadata.isDirectory()) {
    fail("root_missing", "The local vault root must be a directory.");
  }
  const rootIdentity = identityOf(rootMetadata);
  if (
    !samePath(await realpath(candidate.candidatePath), candidate.candidatePath)
  ) {
    fail(
      "symlink_rejected",
      "The local vault root must be canonical and symlink-free.",
    );
  }

  const paths = deriveFixedPaths(await realpath(candidate.candidatePath));
  const entriesBeforeVerification = await inspectFixedRootEntries(paths);
  const existingFiles = Object.freeze(
    entriesBeforeVerification.map((entry) => entry.key),
  );
  const platform = options.permissionPlatform ?? process.platform;
  const verifiedPaths = [paths.root, ...existingFiles.map((key) => paths[key])];
  const aclReceipt = await verifyOwnerOnly(
    platform,
    paths.root,
    verifiedPaths,
    options.windowsAcl,
  );
  await assertStableRoot(paths.root, rootIdentity);
  assertSameRootEntries(
    entriesBeforeVerification,
    await inspectFixedRootEntries(paths),
  );
  await assertStableParent(candidate);

  return Object.freeze({
    profile: LOCAL_VAULT_PATH_PROFILE,
    permissionPlatform: platform,
    paths,
    existingFiles,
    ...(aclReceipt === undefined ? {} : { aclReceipt }),
  });
}

/**
 * Call after SQLite creates a fixed file and before using or exposing its data.
 * The key is a closed union; callers cannot smuggle an arbitrary child name.
 */
export async function provisionLocalVaultFileOwnerOnly(
  boundary: LocalVaultRootBoundary,
  key: LocalVaultFileKey,
  options: LocalVaultFilePermissionOptions = {},
): Promise<WindowsOwnerOnlyAclVerificationReceipt | undefined> {
  assertFixedBoundary(boundary);
  const rootMetadata = await lstat(boundary.paths.root, { bigint: true });
  const rootIdentity = identityOf(rootMetadata);
  const path = boundary.paths[key];
  const fileIdentity = await inspectRegularFile(path);
  const receipt = await provisionOwnerOnly(
    boundary.permissionPlatform,
    boundary.paths.root,
    [boundary.paths.root, path],
    options.windowsAcl,
  );
  await assertStableRoot(boundary.paths.root, rootIdentity);
  if (!sameIdentity(await inspectRegularFile(path), fileIdentity)) {
    fail(
      "root_changed",
      `${LOCAL_VAULT_FILE_NAMES[key]} changed during permission provisioning.`,
    );
  }
  return receipt;
}

export async function verifyLocalVaultFileOwnerOnly(
  boundary: LocalVaultRootBoundary,
  key: LocalVaultFileKey,
  options: LocalVaultFilePermissionOptions = {},
): Promise<WindowsOwnerOnlyAclVerificationReceipt | undefined> {
  assertFixedBoundary(boundary);
  const path = boundary.paths[key];
  const fileIdentity = await inspectRegularFile(path);
  const receipt = await verifyOwnerOnly(
    boundary.permissionPlatform,
    boundary.paths.root,
    [boundary.paths.root, path],
    options.windowsAcl,
  );
  if (!sameIdentity(await inspectRegularFile(path), fileIdentity)) {
    fail(
      "root_changed",
      `${LOCAL_VAULT_FILE_NAMES[key]} changed during permission verification.`,
    );
  }
  return receipt;
}

async function canonicalBackupCandidate(
  path: string,
): Promise<CanonicalChildCandidate> {
  const candidate = await canonicalDirectChildCandidate(path);
  if (basename(candidate.candidatePath) !== LOCAL_VAULT_BACKUP_FILE_NAME) {
    fail(
      "invalid_backup_name",
      `The backup path must use the fixed name ${LOCAL_VAULT_BACKUP_FILE_NAME}.`,
    );
  }
  return candidate;
}

/** Validate geometry and non-existence only; create the file later with an exclusive flag. */
export async function validateNewLocalVaultBackupDestination(
  path: string,
): Promise<NewLocalVaultBackupDestination> {
  const candidate = await canonicalBackupCandidate(path);
  if ((await lstatIfPresent(candidate.candidatePath)) !== undefined) {
    fail(
      "backup_destination_exists",
      "A local vault backup destination is never overwritten.",
    );
  }
  await assertStableParent(candidate);
  return Object.freeze({
    parentPath: candidate.canonicalParentPath,
    path: candidate.candidatePath,
    fileName: LOCAL_VAULT_BACKUP_FILE_NAME,
    overwrite: false,
  });
}

export async function validateExistingLocalVaultBackupSource(
  path: string,
): Promise<ExistingLocalVaultBackupSource> {
  const candidate = await canonicalBackupCandidate(path);
  if ((await lstatIfPresent(candidate.candidatePath)) === undefined) {
    fail(
      "backup_source_missing",
      "The local vault backup source does not exist.",
    );
  }
  const fileIdentity = await inspectRegularFile(candidate.candidatePath);
  await assertStableParent(candidate);
  if (
    !sameIdentity(
      await inspectRegularFile(candidate.candidatePath),
      fileIdentity,
    )
  ) {
    fail(
      "root_changed",
      "The local vault backup source changed during validation.",
    );
  }
  return Object.freeze({
    parentPath: candidate.canonicalParentPath,
    path: candidate.candidatePath,
    fileName: LOCAL_VAULT_BACKUP_FILE_NAME,
  });
}
