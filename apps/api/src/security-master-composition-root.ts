import type { FastifyInstance } from "fastify";
import { constants, type BigIntStats } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { basename, isAbsolute, normalize, resolve, sep } from "node:path";

import {
  admitPersonalSecurityMasterSnapshot,
  PERSONAL_SECURITY_MASTER_LIMITS,
} from "@research-cockpit/personal-security-master";

import { resolveDemoApiListenOptions } from "./listen-options";
import {
  PersonalOwnerSessionAuthority,
  PersonalOwnerSessionConfigurationError,
  PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY,
} from "./personal-owner-session";
import { buildPersonalSecurityMasterApp } from "./security-master-app";

export const SECURITY_MASTER_API_MODE =
  "personal_single_user_local_security_master" as const;
export const PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY =
  "PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH" as const;
export const PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY =
  "PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256" as const;
export const PERSONAL_SECURITY_MASTER_SNAPSHOT_FILENAME =
  "personal-security-master.snapshot.json" as const;

export type SecurityMasterApiEnvironment = Readonly<
  Record<string, string | undefined>
>;
type MutableSecurityMasterApiEnvironment = Record<string, string | undefined>;

const HASH = /^sha256:[0-9a-f]{64}$/u;
const capturedSecurityMasterApiEnvironments = new WeakSet<object>();
const FORBIDDEN_PRIVATE_CONFIGURATION_KEYS = [
  "CONNECTED_SOURCE_POLICY_BUNDLE_PATH",
  "CONNECTED_SOURCE_POLICY_BUNDLE_SHA256",
  "CONNECTED_SOURCE_POLICY_SECRET_REFERENCE",
  "PERSONAL_FILING_QUALITY_RESULT_PATH",
  "PERSONAL_FILING_QUALITY_RESULT_SHA256",
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH",
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256",
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH",
  "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH",
  "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256",
  "PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH",
  "RESEARCH_COCKPIT_VAULT_ROOT",
  "RESEARCH_COCKPIT_VAULT_STARTUP",
] as const;
const SECURITY_MASTER_PRIVATE_ENVIRONMENT_KEYS = [
  PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY,
  PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY,
  PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY,
  ...FORBIDDEN_PRIVATE_CONFIGURATION_KEYS,
] as const;

export class SecurityMasterApiCompositionError extends Error {
  readonly code:
    | "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID"
    | "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED"
    | "SECURITY_MASTER_CONFIGURATION_REQUIRED"
    | "SECURITY_MASTER_MODE_REJECTS_OTHER_PRIVATE_CONFIGURATION"
    | "SECURITY_MASTER_MODE_REQUIRED"
    | "SECURITY_MASTER_UNAVAILABLE";

  constructor(code: SecurityMasterApiCompositionError["code"]) {
    super("The personal security-master API composition is unavailable.");
    this.name = "SecurityMasterApiCompositionError";
    this.code = code;
  }
}

export function captureSecurityMasterApiEnvironment(
  environment: MutableSecurityMasterApiEnvironment,
): SecurityMasterApiEnvironment {
  const captured: MutableSecurityMasterApiEnvironment = {
    HOST: environment.HOST,
    PORT: environment.PORT,
    RESEARCH_COCKPIT_MODE: environment.RESEARCH_COCKPIT_MODE,
  };
  for (const key of SECURITY_MASTER_PRIVATE_ENVIRONMENT_KEYS) {
    captured[key] = environment[key];
    delete environment[key];
  }
  capturedSecurityMasterApiEnvironments.add(captured);
  return captured;
}

export function disposeCapturedSecurityMasterApiEnvironment(
  environment: SecurityMasterApiEnvironment,
): void {
  if (!capturedSecurityMasterApiEnvironments.has(environment)) return;
  for (const key of SECURITY_MASTER_PRIVATE_ENVIRONMENT_KEYS) {
    delete (environment as MutableSecurityMasterApiEnvironment)[key];
  }
  capturedSecurityMasterApiEnvironments.delete(environment);
}

export function createSecurityMasterConfiguredApp(
  environment: SecurityMasterApiEnvironment,
): Promise<FastifyInstance> {
  try {
    return prepareSecurityMasterConfiguredApp(environment);
  } catch (error) {
    return Promise.reject(
      error instanceof Error
        ? error
        : new Error(
            "The personal security-master API composition is unavailable.",
          ),
    );
  } finally {
    disposeCapturedSecurityMasterApiEnvironment(environment);
  }
}

async function prepareSecurityMasterConfiguredApp(
  environment: SecurityMasterApiEnvironment,
): Promise<FastifyInstance> {
  if (environment.RESEARCH_COCKPIT_MODE !== SECURITY_MASTER_API_MODE) {
    throw new SecurityMasterApiCompositionError(
      "SECURITY_MASTER_MODE_REQUIRED",
    );
  }
  if (
    FORBIDDEN_PRIVATE_CONFIGURATION_KEYS.some(
      (key) => environment[key] !== undefined,
    )
  ) {
    throw new SecurityMasterApiCompositionError(
      "SECURITY_MASTER_MODE_REJECTS_OTHER_PRIVATE_CONFIGURATION",
    );
  }

  const snapshotPath =
    environment[PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY];
  const expectedSha256 =
    environment[PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY];
  if (
    !isValidSnapshotPath(snapshotPath) ||
    typeof expectedSha256 !== "string" ||
    !HASH.test(expectedSha256)
  ) {
    throw new SecurityMasterApiCompositionError(
      "SECURITY_MASTER_CONFIGURATION_REQUIRED",
    );
  }

  const bootstrapSecret = environment[PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY];
  if (bootstrapSecret === undefined) {
    throw new SecurityMasterApiCompositionError(
      "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED",
    );
  }
  let ownerSession: PersonalOwnerSessionAuthority;
  try {
    ownerSession = PersonalOwnerSessionAuthority.create(bootstrapSecret);
  } catch (error) {
    if (error instanceof PersonalOwnerSessionConfigurationError) {
      throw new SecurityMasterApiCompositionError(
        "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID",
      );
    }
    throw error;
  }

  let snapshot: Uint8Array | undefined;
  try {
    snapshot = await readStableSnapshot(snapshotPath);
    const catalog = admitPersonalSecurityMasterSnapshot({
      expectedSha256: expectedSha256 as `sha256:${string}`,
      snapshot,
    });
    snapshot.fill(0);
    snapshot = undefined;
    return await buildPersonalSecurityMasterApp(
      catalog,
      ownerSession,
      resolveDemoApiListenOptions(environment),
    );
  } catch {
    ownerSession.close();
    throw new SecurityMasterApiCompositionError("SECURITY_MASTER_UNAVAILABLE");
  } finally {
    snapshot?.fill(0);
  }
}

async function readStableSnapshot(path: string): Promise<Uint8Array> {
  let bytes: Uint8Array | undefined;
  try {
    const resolvedPath = resolve(path);
    const canonicalBefore = await realpath(path);
    const pathBefore = await lstat(path, { bigint: true });
    if (
      !samePath(resolvedPath, path) ||
      !samePath(canonicalBefore, path) ||
      !isExpectedFile(pathBefore)
    ) {
      fail();
    }

    const noFollow = "O_NOFOLLOW" in constants ? constants.O_NOFOLLOW : 0;
    const handle = await open(path, constants.O_RDONLY | noFollow);
    try {
      const opened = await handle.stat({ bigint: true });
      if (
        !isExpectedFile(opened) ||
        !sameFileState(pathBefore, opened) ||
        opened.size > BigInt(PERSONAL_SECURITY_MASTER_LIMITS.snapshotBytes)
      ) {
        fail();
      }
      bytes = new Uint8Array(Number(opened.size));
      let offset = 0;
      while (offset < bytes.byteLength) {
        const { bytesRead } = await handle.read(
          bytes,
          offset,
          bytes.byteLength - offset,
          offset,
        );
        if (bytesRead < 1) fail();
        offset += bytesRead;
      }
      const extra = new Uint8Array(1);
      let extraBytes: number;
      try {
        ({ bytesRead: extraBytes } = await handle.read(
          extra,
          0,
          1,
          bytes.byteLength,
        ));
      } finally {
        extra.fill(0);
      }
      const openedAfter = await handle.stat({ bigint: true });
      const pathAfter = await lstat(path, { bigint: true });
      const canonicalAfter = await realpath(path);
      if (
        extraBytes !== 0 ||
        !isExpectedFile(openedAfter) ||
        !isExpectedFile(pathAfter) ||
        !sameFileState(opened, openedAfter) ||
        !sameFileState(openedAfter, pathAfter) ||
        !samePath(canonicalBefore, canonicalAfter) ||
        !samePath(canonicalAfter, path)
      ) {
        fail();
      }
    } finally {
      await handle.close();
    }
    const owned = bytes;
    bytes = undefined;
    return owned;
  } catch (error) {
    bytes?.fill(0);
    if (error instanceof SecurityMasterApiCompositionError) throw error;
    fail();
  }
}

function isExpectedFile(metadata: BigIntStats): boolean {
  return (
    metadata.isFile() &&
    !metadata.isSymbolicLink() &&
    metadata.ino > 0n &&
    metadata.nlink === 1n &&
    metadata.size > 0n &&
    metadata.size <= BigInt(PERSONAL_SECURITY_MASTER_LIMITS.snapshotBytes)
  );
}

/** @internal Pure regression seam for platform-specific snapshot state checks. */
export function isSecurityMasterSnapshotFileStateStable(
  left: Pick<
    BigIntStats,
    "ctimeNs" | "dev" | "ino" | "mode" | "mtimeNs" | "nlink" | "size"
  >,
  right: Pick<
    BigIntStats,
    "ctimeNs" | "dev" | "ino" | "mode" | "mtimeNs" | "nlink" | "size"
  >,
  runtimeFamily: "posix" | "win32" = sep === "\\" ? "win32" : "posix",
): boolean {
  // Windows ctime is not a portable snapshot-byte identity signal across
  // pathname and descriptor metadata views.
  const ctimeIsStable =
    runtimeFamily === "win32" || left.ctimeNs === right.ctimeNs;
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    ctimeIsStable
  );
}

function sameFileState(left: BigIntStats, right: BigIntStats): boolean {
  return isSecurityMasterSnapshotFileStateStable(left, right);
}

function isValidSnapshotPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 4_096 &&
    !value.includes("\u0000") &&
    isCanonicalLocalAbsolutePath(value) &&
    normalize(value) === value &&
    basename(value) === PERSONAL_SECURITY_MASTER_SNAPSHOT_FILENAME
  );
}

function isCanonicalLocalAbsolutePath(value: string): boolean {
  if (!isAbsolute(value)) return false;
  if (sep === "\\") return /^[A-Za-z]:\\/u.test(value);
  return value.startsWith("/") && !value.startsWith("//");
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = normalize(resolve(left));
  const normalizedRight = normalize(resolve(right));
  return sep === "\\"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function fail(): never {
  throw new SecurityMasterApiCompositionError("SECURITY_MASTER_UNAVAILABLE");
}
