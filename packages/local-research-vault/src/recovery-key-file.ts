import { randomBytes } from "node:crypto";
import { lstat, open, readFile } from "node:fs/promises";

import { vaultError } from "./errors";
import {
  provisionLocalVaultFileOwnerOnly,
  verifyLocalVaultFileOwnerOnly,
  type LocalVaultRootBoundary,
  type WindowsOwnerOnlyAclPort,
} from "./local-vault-paths";

const RECOVERY_KEY_BYTES = 32;

export async function createLocalVaultRecoveryKeyFile(
  boundary: LocalVaultRootBoundary,
  windowsAcl?: WindowsOwnerOnlyAclPort,
  suppliedKey?: Uint8Array,
): Promise<Buffer> {
  if (
    suppliedKey !== undefined &&
    suppliedKey.byteLength !== RECOVERY_KEY_BYTES
  ) {
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
  }
  const key =
    suppliedKey === undefined
      ? randomBytes(RECOVERY_KEY_BYTES)
      : Buffer.from(suppliedKey);
  const handle = await open(boundary.paths.recoveryKey, "wx", 0o600);
  try {
    await handle.writeFile(key);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await provisionLocalVaultFileOwnerOnly(
      boundary,
      "recoveryKey",
      windowsAcl === undefined ? {} : { windowsAcl },
    );
    return key;
  } catch (error) {
    key.fill(0);
    throw error;
  }
}

export async function readLocalVaultRecoveryKeyFile(
  boundary: LocalVaultRootBoundary,
  windowsAcl?: WindowsOwnerOnlyAclPort,
): Promise<Buffer> {
  await verifyLocalVaultFileOwnerOnly(
    boundary,
    "recoveryKey",
    windowsAcl === undefined ? {} : { windowsAcl },
  );
  const before = await lstat(boundary.paths.recoveryKey, { bigint: true });
  if (!before.isFile() || before.nlink !== 1n || before.size !== 32n) {
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
  }
  const key = await readFile(boundary.paths.recoveryKey);
  const after = await lstat(boundary.paths.recoveryKey, { bigint: true });
  if (
    key.byteLength !== RECOVERY_KEY_BYTES ||
    !after.isFile() ||
    after.nlink !== 1n ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size
  ) {
    key.fill(0);
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
  }
  return key;
}
