import { createHash, timingSafeEqual } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { basename, isAbsolute, sep } from "node:path";

import {
  CONNECTED_SOURCE_POLICY_PROFILE,
  CONNECTED_SOURCE_POLICY_SCHEMA_VERSION,
  createConnectedSourcePolicy,
  parseConnectedSourcePolicyConfig,
  type ConnectedSourceClock,
  type ConnectedSourcePolicy,
  type ConnectedSourcePolicyStatus,
} from "@research-cockpit/connected-source-policy";

export const CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY =
  "CONNECTED_SOURCE_POLICY_BUNDLE_PATH" as const;
export const CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY =
  "CONNECTED_SOURCE_POLICY_BUNDLE_SHA256" as const;
export const CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY =
  "CONNECTED_SOURCE_POLICY_SECRET_REFERENCE" as const;

const BUNDLE_FILENAME = "connected-source-policy.bundle.json";
const MAX_BUNDLE_BYTES = 256 * 1024;
const HASH = /^sha256:[0-9a-f]{64}$/u;
const SECRET_REFERENCE =
  /^owner-local-ref:v1:[a-z][a-z0-9_-]{0,31}:[a-z][a-z0-9_-]{0,63}$/u;
const ERROR_MESSAGE = "Connected source policy administration is unavailable.";

declare const connectedSourcePolicyAdministrationBrand: unique symbol;

export type ConnectedSourcePolicyEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type ConnectedSourcePolicyAdministration = Readonly<{
  [connectedSourcePolicyAdministrationBrand]: true;
  status(): ConnectedSourcePolicyStatus;
  kill(): void;
}>;

const administrationCapabilities = new WeakSet<object>();

export class ConnectedSourcePolicyCompositionError extends Error {
  constructor() {
    super(ERROR_MESSAGE);
    Object.defineProperty(this, "name", {
      configurable: true,
      value: "ConnectedSourcePolicyCompositionError",
    });
  }
}

export async function loadConnectedSourcePolicyAdministration(
  environment: ConnectedSourcePolicyEnvironment,
  clock?: ConnectedSourceClock,
): Promise<ConnectedSourcePolicyAdministration | undefined> {
  const bundlePath = environment[CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY];
  const expectedSha256 = environment[CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY];
  const secretReference =
    environment[CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY];
  if (
    bundlePath === undefined &&
    expectedSha256 === undefined &&
    secretReference === undefined
  ) {
    return undefined;
  }

  let bytes: Uint8Array | undefined;
  try {
    if (
      !validBundlePath(bundlePath) ||
      typeof expectedSha256 !== "string" ||
      !HASH.test(expectedSha256) ||
      typeof secretReference !== "string" ||
      !SECRET_REFERENCE.test(secretReference) ||
      !isConnectedSourceClock(clock)
    ) {
      fail();
    }

    bytes = await readStableRegularFile(bundlePath);
    if (!equalAscii(sha256(bytes), expectedSha256)) fail();
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(text);
    if (text !== `${canonicalJson(parsed)}\n`) fail();
    const wrapper = exactRecord(parsed, ["config", "policy", "schemaVersion"]);
    if (wrapper.schemaVersion !== CONNECTED_SOURCE_POLICY_SCHEMA_VERSION) {
      fail();
    }

    const parsedConfig = parseConnectedSourcePolicyConfig(wrapper.config);
    if (
      parsedConfig.status !== "parsed" ||
      parsedConfig.config.enabled !== true ||
      parsedConfig.config.profile !== CONNECTED_SOURCE_POLICY_PROFILE ||
      parsedConfig.config.secretReference !== secretReference
    ) {
      fail();
    }

    const policy = createConnectedSourcePolicy(parsedConfig.config, { clock });
    const admission = policy.admitSourcePolicy(wrapper.policy);
    if (
      !(
        admission.status === "admitted" &&
        admission.policyStatus.status === "ready" &&
        admission.policyStatus.reasonCode === null
      ) &&
      !(
        admission.status === "rejected" &&
        isInspectableTerminalAdmission(admission.policyStatus)
      )
    ) {
      fail();
    }
    return createAdministration(policy);
  } catch {
    throw new ConnectedSourcePolicyCompositionError();
  } finally {
    bytes?.fill(0);
  }
}

function isInspectableTerminalAdmission(
  status: ConnectedSourcePolicyStatus,
): boolean {
  return (
    (status.status === "expired" && status.reasonCode === "POLICY_EXPIRED") ||
    (status.status === "revoked" && status.reasonCode === "POLICY_REVOKED") ||
    (status.status === "incompatible" &&
      (status.reasonCode === "POLICY_INCOMPATIBLE" ||
        status.reasonCode === "POLICY_NOT_EFFECTIVE" ||
        status.reasonCode === "POLICY_REVIEW_DUE"))
  );
}

export function isConnectedSourcePolicyAdministration(
  value: unknown,
): value is ConnectedSourcePolicyAdministration {
  if (typeof value !== "object" || value === null) return false;
  try {
    return Object.isFrozen(value) && administrationCapabilities.has(value);
  } catch {
    return false;
  }
}

function createAdministration(
  policy: ConnectedSourcePolicy,
): ConnectedSourcePolicyAdministration {
  const capability = Object.freeze({
    status: () => policy.status(),
    kill: () => {
      policy.kill();
    },
  }) as ConnectedSourcePolicyAdministration;
  administrationCapabilities.add(capability);
  return capability;
}

async function readStableRegularFile(path: string): Promise<Uint8Array> {
  const pathBefore = await lstat(path, { bigint: true });
  if (
    !pathBefore.isFile() ||
    pathBefore.isSymbolicLink() ||
    pathBefore.nlink !== 1n
  ) {
    fail();
  }
  const noFollow = "O_NOFOLLOW" in constants ? constants.O_NOFOLLOW : 0;
  const handle = await open(path, constants.O_RDONLY | noFollow);
  let buffer: Buffer | undefined;
  try {
    const handleBefore = await handle.stat({ bigint: true });
    if (
      !handleBefore.isFile() ||
      !sameFileState(pathBefore, handleBefore) ||
      handleBefore.size <= 0n ||
      handleBefore.size > BigInt(MAX_BUNDLE_BYTES)
    ) {
      fail();
    }
    buffer = Buffer.alloc(Number(handleBefore.size));
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        offset,
        buffer.length - offset,
        offset,
      );
      if (bytesRead === 0) fail();
      offset += bytesRead;
    }
    const handleAfter = await handle.stat({ bigint: true });
    const pathAfter = await lstat(path, { bigint: true });
    if (
      !handleAfter.isFile() ||
      !pathAfter.isFile() ||
      pathAfter.isSymbolicLink() ||
      !sameFileState(handleBefore, handleAfter) ||
      !sameFileState(handleAfter, pathAfter)
    ) {
      fail();
    }
    return Uint8Array.from(buffer);
  } finally {
    buffer?.fill(0);
    await handle.close();
  }
}

function sameFileState(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function validBundlePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 4_096 &&
    isCanonicalLocalAbsolutePath(value) &&
    basename(value) === BUNDLE_FILENAME
  );
}

function isCanonicalLocalAbsolutePath(value: string): boolean {
  if (!isAbsolute(value)) return false;
  if (sep === "\\") {
    return /^[A-Za-z]:\\/.test(value);
  }
  return value.startsWith("/") && !value.startsWith("//");
}

function exactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): Record<Keys[number], unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify([...keys].sort())
  ) {
    fail();
  }
  return value as Record<Keys[number], unknown>;
}

function isConnectedSourceClock(value: unknown): value is ConnectedSourceClock {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { now?: unknown }).now === "function"
  );
}

function equalAscii(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "ascii");
  const rightBytes = Buffer.from(right, "ascii");
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail();
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail();
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function fail(): never {
  throw new ConnectedSourcePolicyCompositionError();
}
