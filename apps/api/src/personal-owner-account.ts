import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  openSync,
  readSync,
  renameSync,
  unlinkSync,
  writeSync,
  type BigIntStats,
} from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";

import {
  PersonalOwnerAccountConfigurationError,
  type PersonalOwnerAccountRecord,
  validatePersonalOwnerAccountRecord,
} from "./personal-owner-account-credentials";
export {
  createPersonalOwnerAccountRecord,
  isValidPersonalOwnerPassword,
  isValidPersonalOwnerUsername,
  PersonalOwnerAccountConfigurationError,
  type PersonalOwnerAccountRecord,
  validatePersonalOwnerAccountRecord,
  verifyPersonalOwnerAccountPassword,
} from "./personal-owner-account-credentials";

export const PERSONAL_OWNER_ACCOUNT_FILE_ENVIRONMENT_KEY =
  "RESEARCH_COCKPIT_OWNER_ACCOUNT_FILE" as const;

const ACCOUNT_FILE_LIMIT_BYTES = 2_048;
/** Opens only a fixed existing file. Values and native errors never escape. */
export function readPersonalOwnerAccountFile(
  path: string,
): PersonalOwnerAccountRecord {
  let descriptor: number | undefined;
  let bytes: Buffer | undefined;
  try {
    assertUnlinkedPath(path);
    const before = lstatSync(path, { bigint: true });
    assertAccountFile(before);
    assertOwnerOnly(path, before);
    descriptor = openSync(
      path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
    if (!sameFile(before, fstatSync(descriptor, { bigint: true }))) {
      throw new PersonalOwnerAccountConfigurationError();
    }
    bytes = Buffer.alloc(ACCOUNT_FILE_LIMIT_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(
        descriptor,
        bytes,
        length,
        bytes.length - length,
        null,
      );
      if (count === 0) break;
      length += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    assertUnlinkedPath(path);
    if (
      length !== Number(before.size) ||
      length > ACCOUNT_FILE_LIMIT_BYTES ||
      !sameFile(before, after) ||
      !sameFile(before, lstatSync(path, { bigint: true }))
    ) {
      throw new PersonalOwnerAccountConfigurationError();
    }
    assertOwnerOnly(path, after);
    const text = bytes.subarray(0, length).toString("utf8");
    if (!Buffer.from(text, "utf8").equals(bytes.subarray(0, length))) {
      throw new PersonalOwnerAccountConfigurationError();
    }
    return validatePersonalOwnerAccountRecord(JSON.parse(text) as unknown);
  } catch {
    throw new PersonalOwnerAccountConfigurationError();
  } finally {
    bytes?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

/** Offline setup/reset only. Initial setup never overwrites an existing account. */
export function writePersonalOwnerAccountFile(
  path: string,
  record: PersonalOwnerAccountRecord,
  options: { readonly replace?: boolean } = {},
): void {
  let temporary: string | undefined;
  let descriptor: number | undefined;
  let identity: BigIntStats | undefined;
  try {
    const validated = validatePersonalOwnerAccountRecord(record);
    assertUnlinkedPath(path, true);
    let previous: BigIntStats | undefined;
    try {
      previous = lstatSync(path, { bigint: true });
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    if (previous !== undefined) {
      if (options.replace !== true)
        throw new PersonalOwnerAccountConfigurationError();
      assertAccountFile(previous);
      assertOwnerOnly(path, previous);
    } else if (options.replace === true) {
      throw new PersonalOwnerAccountConfigurationError();
    }
    temporary = join(
      dirname(path),
      `.owner-account-${randomBytes(16).toString("hex")}.tmp`,
    );
    descriptor = openSync(temporary, "wx", 0o600);
    identity = fstatSync(descriptor, { bigint: true });
    setOwnerOnly(temporary);
    const serialized = Buffer.from(`${JSON.stringify(validated)}\n`, "utf8");
    try {
      let offset = 0;
      while (offset < serialized.length) {
        offset += writeSync(
          descriptor,
          serialized,
          offset,
          serialized.length - offset,
        );
      }
      fsyncSync(descriptor);
    } finally {
      serialized.fill(0);
    }
    closeSync(descriptor);
    descriptor = undefined;
    assertUnlinkedPath(path, true);
    if (previous === undefined) {
      // Atomic create-if-absent; unlike rename, an existing destination wins.
      linkSync(temporary, path);
      unlinkSync(temporary);
    } else {
      if (!sameFile(previous, lstatSync(path, { bigint: true }))) {
        throw new PersonalOwnerAccountConfigurationError();
      }
      renameSync(temporary, path);
    }
    temporary = undefined;
    readPersonalOwnerAccountFile(path);
  } catch {
    throw new PersonalOwnerAccountConfigurationError();
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (temporary !== undefined && identity !== undefined) {
      try {
        const current = lstatSync(temporary, { bigint: true });
        if (
          current.isFile() &&
          current.dev === identity.dev &&
          current.ino === identity.ino
        ) {
          unlinkSync(temporary);
        }
      } catch {
        // Never delete a path whose identity cannot be established.
      }
    }
  }
}

function assertUnlinkedPath(path: string, allowMissingLeaf = false): void {
  if (
    typeof path !== "string" ||
    !isAbsolute(path) ||
    path.includes("\0") ||
    resolve(path) !== path
  ) {
    throw new PersonalOwnerAccountConfigurationError();
  }
  const root = parse(path).root;
  const parts = relative(root, path).split(/[\\/]/u);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index] ?? "");
    let metadata: BigIntStats;
    try {
      metadata = lstatSync(current, { bigint: true });
    } catch (error) {
      if (allowMissingLeaf && index === parts.length - 1 && isMissing(error))
        return;
      throw error;
    }
    if (
      metadata.isSymbolicLink() ||
      (index < parts.length - 1 && !metadata.isDirectory())
    ) {
      throw new PersonalOwnerAccountConfigurationError();
    }
  }
}

function assertAccountFile(metadata: BigIntStats): void {
  if (
    !metadata.isFile() ||
    metadata.nlink !== 1n ||
    metadata.size < 1n ||
    metadata.size > BigInt(ACCOUNT_FILE_LIMIT_BYTES)
  ) {
    throw new PersonalOwnerAccountConfigurationError();
  }
}

function sameFile(left: BigIntStats, right: BigIntStats): boolean {
  return (
    right.isFile() &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function assertOwnerOnly(path: string, metadata: BigIntStats): void {
  if (process.platform === "win32") {
    windowsOwnerOnly(path, false);
  } else if (
    (metadata.mode & 0o077n) !== 0n ||
    metadata.uid !== BigInt(process.getuid?.() ?? -1)
  ) {
    throw new PersonalOwnerAccountConfigurationError();
  }
}

function setOwnerOnly(path: string): void {
  if (process.platform === "win32") windowsOwnerOnly(path, true);
}

function windowsOwnerOnly(path: string, apply: boolean): void {
  const systemRoot = process.env.SystemRoot;
  if (systemRoot === undefined || !isAbsolute(systemRoot)) {
    throw new PersonalOwnerAccountConfigurationError();
  }
  const script = `
$ErrorActionPreference = 'Stop'
$accountPath = $env:RESEARCH_COCKPIT_ACCOUNT_ACL_PATH
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
if ($env:RESEARCH_COCKPIT_ACCOUNT_ACL_APPLY -eq '1') {
  $security = [System.Security.AccessControl.FileSecurity]::new()
  $currentOwner = [System.IO.File]::GetAccessControl($accountPath).GetOwner([System.Security.Principal.SecurityIdentifier])
  if ($currentOwner.Value -ne $identity.Value) { $security.SetOwner($identity) }
  $security.SetAccessRuleProtection($true, $false)
  $rule = [System.Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'Allow')
  $security.AddAccessRule($rule)
  [System.IO.File]::SetAccessControl($accountPath, $security)
}
$security = [System.IO.File]::GetAccessControl($accountPath)
if ($security.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $identity.Value -or -not $security.AreAccessRulesProtected) { exit 1 }
$rules = @($security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
if ($rules.Count -eq 0) { exit 1 }
foreach ($rule in $rules) {
  if ($rule.IdentityReference.Value -ne $identity.Value -or $rule.AccessControlType -ne 'Allow' -or $rule.IsInherited) { exit 1 }
}
`;
  const environment: Record<string, string> = {
    SystemRoot: systemRoot,
    WINDIR: systemRoot,
    RESEARCH_COCKPIT_ACCOUNT_ACL_PATH: path,
    RESEARCH_COCKPIT_ACCOUNT_ACL_APPLY: apply ? "1" : "0",
  };
  for (const name of ["TEMP", "TMP"]) {
    const value = process.env[name];
    if (value !== undefined) environment[name] = value;
  }
  execFileSync(
    join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(script, "utf16le").toString("base64"),
    ],
    {
      env: environment,
      stdio: "ignore",
      timeout: 10_000,
      windowsHide: true,
    },
  );
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
