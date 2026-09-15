import { execFile } from "node:child_process";
import { join } from "node:path";

import {
  WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
  type WindowsOwnerOnlyAclPort,
  type WindowsOwnerOnlyAclTarget,
  type WindowsOwnerOnlyAclVerificationReceipt,
} from "./local-vault-paths";
import { vaultError } from "./errors";

const REQUEST_ENVIRONMENT_KEY =
  "RESEARCH_COCKPIT_WINDOWS_ACL_REQUEST_BASE64" as const;

const ACL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$PSModuleAutoLoadingPreference = 'None'
[Console]::Error.WriteLine('acl:script_started')
function Assert-OwnerOnlyAcl {
  param(
    [Security.AccessControl.FileSystemSecurity]$Security,
    [bool]$IsContainer,
    [Security.Principal.SecurityIdentifier]$ExpectedOwner,
    [Security.Principal.SecurityIdentifier]$ExpectedTrustee
  )
  if (-not $Security.AreAccessRulesProtected) { throw 'inheritance enabled' }
  $verifiedOwner = $Security.GetOwner([Security.Principal.SecurityIdentifier])
  if ($verifiedOwner.Value -ne $ExpectedOwner.Value) { throw 'wrong owner' }
  $rules = @($Security.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
  if ($rules.Count -ne 1) { throw 'unexpected access rule count' }
  $access = $rules[0]
  if ($access.IdentityReference.Value -ne $ExpectedTrustee.Value) { throw 'wrong trustee' }
  if ($access.IsInherited) { throw 'inherited rule' }
  if ($access.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { throw 'deny rule' }
  if ($access.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) { throw 'unexpected rights' }
  if ($access.PropagationFlags -ne [Security.AccessControl.PropagationFlags]::None) { throw 'propagation mismatch' }
  if ($IsContainer) {
    $requiredInheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    if ($access.InheritanceFlags -ne $requiredInheritance) { throw 'missing child inheritance' }
  } elseif ($access.InheritanceFlags -ne [Security.AccessControl.InheritanceFlags]::None) {
    throw 'file inheritance mismatch'
  }
}
$encoded = [Environment]::GetEnvironmentVariable('RESEARCH_COCKPIT_WINDOWS_ACL_REQUEST_BASE64', 'Process')
if ([String]::IsNullOrWhiteSpace($encoded)) { throw 'missing request' }
$parts = [Text.UTF8Encoding]::new($false, $true).GetString([Convert]::FromBase64String($encoded)).Split([char]0)
if ($parts.Length -lt 2 -or ($parts[0] -cne 'provision' -and $parts[0] -cne 'verify')) { throw 'invalid request' }
$mode = $parts[0]
foreach ($path in $parts[1..($parts.Length - 1)]) {
  if ([String]::IsNullOrWhiteSpace($path)) { throw 'missing target' }
}
[Console]::Error.WriteLine('acl:request_decoded')
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$owner = $identity.User
$tokenOwner = $identity.Owner
if ($null -eq $owner -or $null -eq $tokenOwner) { throw 'missing owner' }
[Console]::Error.WriteLine('acl:identity_resolved')
foreach ($targetPath in $parts[1..($parts.Length - 1)]) {
  [Console]::Error.WriteLine('acl:target_started')
  $isContainer = ([IO.File]::GetAttributes($targetPath) -band [IO.FileAttributes]::Directory) -ne 0
  if ($mode -eq 'provision') {
    if ($isContainer) {
      $security = [IO.Directory]::GetAccessControl($targetPath)
      $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    } else {
      $security = [IO.File]::GetAccessControl($targetPath)
      $inheritance = [Security.AccessControl.InheritanceFlags]::None
    }
    $existingOwner = $security.GetOwner([Security.Principal.SecurityIdentifier])
    if ($existingOwner.Value -ne $owner.Value -and $existingOwner.Value -ne $tokenOwner.Value) {
      throw 'wrong owner before provision'
    }
    $security.SetAccessRuleProtection($true, $false)
    $existingRules = @($security.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier]))
    foreach ($existingRule in $existingRules) {
      [void]$security.RemoveAccessRuleSpecific($existingRule)
    }
    $rule = [Security.AccessControl.FileSystemAccessRule]::new(
      $owner,
      [Security.AccessControl.FileSystemRights]::FullControl,
      $inheritance,
      [Security.AccessControl.PropagationFlags]::None,
      [Security.AccessControl.AccessControlType]::Allow
    )
    [void]$security.AddAccessRule($rule)
    if ($isContainer) {
      [IO.Directory]::SetAccessControl($targetPath, $security)
    } else {
      [IO.File]::SetAccessControl($targetPath, $security)
    }
    if ($existingOwner.Value -ne $owner.Value) {
      if ($isContainer) {
        $narrowed = [IO.Directory]::GetAccessControl($targetPath)
      } else {
        $narrowed = [IO.File]::GetAccessControl($targetPath)
      }
      Assert-OwnerOnlyAcl $narrowed ([bool]$isContainer) $tokenOwner $owner
      $narrowed.SetOwner($owner)
      if ($isContainer) {
        [IO.Directory]::SetAccessControl($targetPath, $narrowed)
      } else {
        [IO.File]::SetAccessControl($targetPath, $narrowed)
      }
    }
  }
  if ($isContainer) {
    $verified = [IO.Directory]::GetAccessControl($targetPath)
  } else {
    $verified = [IO.File]::GetAccessControl($targetPath)
  }
  Assert-OwnerOnlyAcl $verified ([bool]$isContainer) $owner $owner
  [Console]::Error.WriteLine('acl:target_verified')
}
[Console]::Out.Write($owner.Value)
`;

const ENCODED_ACL_SCRIPT = Buffer.from(ACL_SCRIPT, "utf16le").toString(
  "base64",
);

export interface WindowsAclCommandExecutor {
  execute(requestBase64: string): Promise<string>;
}

export function createNativeWindowsOwnerOnlyAclPort(
  executor: WindowsAclCommandExecutor = nativeWindowsAclExecutor(),
): WindowsOwnerOnlyAclPort {
  return {
    provisionAndVerifyOwnerOnly: (target) =>
      runAclOperation(executor, "provision", target),
    verifyOwnerOnly: (target) => runAclOperation(executor, "verify", target),
  };
}

function nativeWindowsAclExecutor(): WindowsAclCommandExecutor {
  return {
    execute(requestBase64) {
      if (process.platform !== "win32") {
        return Promise.reject(vaultError("VAULT_SECURITY_BOUNDARY_REJECTED"));
      }
      const systemRoot = process.env["SystemRoot"];
      if (
        systemRoot === undefined ||
        !/^[A-Za-z]:\\[^\0]*$/u.test(systemRoot)
      ) {
        return Promise.reject(vaultError("VAULT_SECURITY_BOUNDARY_REJECTED"));
      }
      const executable = join(
        systemRoot,
        "System32",
        "WindowsPowerShell",
        "v1.0",
        "powershell.exe",
      );
      return new Promise<string>((resolve, reject) => {
        execFile(
          executable,
          [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            ENCODED_ACL_SCRIPT,
          ],
          {
            encoding: "utf8",
            env: { ...process.env, [REQUEST_ENVIRONMENT_KEY]: requestBase64 },
            maxBuffer: 16 * 1024,
            windowsHide: true,
            timeout: 15_000,
          },
          (error, stdout, stderr) => {
            if (error !== null) {
              // Native error text can contain a private target path. Retain only
              // bounded process metadata and fixed script stages, never the
              // command, request, SID, stdout, or arbitrary PowerShell stderr.
              const stages = stderr.match(
                /^acl:(?:script_started|request_decoded|identity_resolved|target_started|target_verified)\r?$/gmu,
              );
              reject(
                vaultError("VAULT_SECURITY_BOUNDARY_REJECTED", {
                  stage: stages?.at(-1)?.trim().slice(4) ?? "process_start",
                  code:
                    typeof error.code === "number" ||
                    (typeof error.code === "string" &&
                      /^[A-Z][A-Z0-9_]{0,63}$/u.test(error.code))
                      ? error.code
                      : null,
                  killed: error.killed === true,
                  signal:
                    typeof error.signal === "string" &&
                    /^SIG[A-Z0-9]{1,16}$/u.test(error.signal)
                      ? error.signal
                      : null,
                }),
              );
              return;
            }
            resolve(stdout);
          },
        );
      });
    },
  };
}

async function runAclOperation(
  executor: WindowsAclCommandExecutor,
  mode: "provision" | "verify",
  target: WindowsOwnerOnlyAclTarget,
): Promise<WindowsOwnerOnlyAclVerificationReceipt> {
  // Windows paths cannot contain NUL. A fixed delimiter avoids PowerShell's
  // JSON cmdlet/module discovery while keeping paths out of executable code.
  if (
    target.targetPaths.length === 0 ||
    target.targetPaths.some(
      (path) =>
        path.trim() === "" ||
        path.includes("\0") ||
        Buffer.from(path, "utf8").toString("utf8") !== path,
    )
  ) {
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
  }
  const requestBase64 = Buffer.from(
    [mode, ...target.targetPaths].join("\0"),
    "utf8",
  ).toString("base64");
  let ownerIdentity: string;
  try {
    ownerIdentity = (await executor.execute(requestBase64)).trim();
  } catch (error) {
    if (error instanceof Error && "code" in error) throw error;
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED", error);
  }
  if (!/^S-1-(?:\d+-){1,14}\d+$/u.test(ownerIdentity)) {
    throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
  }
  return Object.freeze({
    profile: WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
    canonicalRootPath: target.canonicalRootPath,
    verifiedPaths: Object.freeze([...target.targetPaths]),
    ownerIdentity,
    inheritanceProtected: true,
    ownerOnly: true,
  });
}
