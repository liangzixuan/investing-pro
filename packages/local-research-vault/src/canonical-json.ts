import { createHash } from "node:crypto";

import type { JsonValue } from "./model";
import { vaultError } from "./errors";

export const MAX_CANONICAL_PAYLOAD_BYTES = 256 * 1024;
const MAX_DEPTH = 32;
const MAX_CONTAINER_ENTRIES = 4_096;

export function canonicalizeJson(value: JsonValue): string {
  const output = serialize(value, 0, new Set<object>());
  if (Buffer.byteLength(output, "utf8") > MAX_CANONICAL_PAYLOAD_BYTES) {
    throw vaultError("VAULT_INVALID_INPUT");
  }
  return output;
}

export function parseCanonicalJson(value: string): JsonValue {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    throw vaultError("VAULT_CORRUPT", error);
  }
  const canonical = canonicalizeUnknown(parsed);
  if (canonical !== value) throw vaultError("VAULT_CORRUPT");
  return parsed as JsonValue;
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalizeUnknown(value: unknown): string {
  return serialize(value, 0, new Set<object>());
}

function serialize(
  value: unknown,
  depth: number,
  ancestors: Set<object>,
): string {
  if (depth > MAX_DEPTH) throw vaultError("VAULT_INVALID_INPUT");
  if (value === null || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw vaultError("VAULT_INVALID_INPUT");
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") throw vaultError("VAULT_INVALID_INPUT");
  if (ancestors.has(value)) throw vaultError("VAULT_INVALID_INPUT");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_CONTAINER_ENTRIES) {
        throw vaultError("VAULT_INVALID_INPUT");
      }
      return `[${value
        .map((entry) => serialize(entry, depth + 1, ancestors))
        .join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw vaultError("VAULT_INVALID_INPUT");
    }
    const entries = Object.entries(value) as [string, unknown][];
    if (entries.length > MAX_CONTAINER_ENTRIES) {
      throw vaultError("VAULT_INVALID_INPUT");
    }
    return `{${entries
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, entry]) => {
        if (entry === undefined) throw vaultError("VAULT_INVALID_INPUT");
        return `${JSON.stringify(key)}:${serialize(
          entry,
          depth + 1,
          ancestors,
        )}`;
      })
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
