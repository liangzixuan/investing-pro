import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { types } from "node:util";

export const WATCHLIST_RESTORE_ARCHIVE = Object.freeze({
  bytes: 246893,
  sha256: "906be639684f977fa54b39e2fb5c50a2d8eb5e006f05198ea0c1989a27731427",
  filename: "function-code.tar.gz",
});

export function admitRestoreOperatorArtifact(
  bytes: Uint8Array,
  receipt: { readonly bytes: number; readonly sha256: string },
): Buffer {
  try {
    assert.ok(bytes instanceof Uint8Array);
    assert.ok(Number.isSafeInteger(receipt.bytes));
    assert.ok(receipt.bytes > 0 && receipt.bytes <= 2 * 1024 * 1024);
    assert.match(receipt.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(bytes.byteLength, receipt.bytes);
    const copy = Buffer.from(bytes);
    assert.equal(copy.byteLength, receipt.bytes);
    assert.equal(
      createHash("sha256").update(copy).digest("hex"),
      receipt.sha256,
    );
    return copy;
  } catch {
    throw new Error("Invalid restore operator artifact");
  }
}

function sdkFormatter(key: string, descriptor: PropertyDescriptor) {
  if (key !== "toString" || descriptor.enumerable) return false;
  if (!descriptor.configurable || !descriptor.writable) return false;
  return typeof descriptor.value === "function";
}
function jsonMembers(value: object, budget: { nodes: number }, depth: number) {
  assert.equal(types.isProxy(value), false);
  const prototype: unknown = Object.getPrototypeOf(value);
  assert.ok(
    prototype === Object.prototype ||
      prototype === Array.prototype ||
      prototype === null,
  );
  const descriptors = Object.getOwnPropertyDescriptors(value);
  assert.equal(Object.getOwnPropertySymbols(value).length, 0);
  const entries: [string, unknown][] = [];
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (Array.isArray(value) && key === "length") continue;
    // SDK29 adds this own nonenumerable formatter; it is never invoked.
    if (sdkFormatter(key, descriptor)) continue;
    assert.ok(descriptor.enumerable && "value" in descriptor);
    entries.push([key, jsonCopy(descriptor.value, budget, depth + 1)]);
  }
  return entries;
}
function jsonContainer(
  value: object,
  budget: { nodes: number },
  depth: number,
) {
  const entries = jsonMembers(value, budget, depth);
  if (!Array.isArray(value)) return Object.fromEntries(entries);
  assert.deepEqual(
    entries.map(([key]) => key),
    Array.from({ length: value.length }, (_, i) => String(i)),
  );
  return entries.map(([, entry]) => entry);
}
function jsonCopy(
  value: unknown,
  budget: { nodes: number },
  depth = 0,
): unknown {
  assert.ok(depth <= 32 && ++budget.nodes <= 50000);
  switch (typeof value) {
    case "boolean":
      return value;
    case "string":
      assert.ok(Buffer.byteLength(value) <= 1048576);
      return value;
    case "number":
      assert.ok(Number.isFinite(value));
      return value;
    case "object":
      return value === null ? null : jsonContainer(value, budget, depth);
    default:
      assert.fail("Unsupported evidence value");
  }
}

/** Retain original-result identity without persisting provider bodies or SDK formatters. */
export function restoreOperatorEvidenceDigest(value: unknown) {
  try {
    const encoded = JSON.stringify(jsonCopy(value, { nodes: 0 }));
    const bytes = Buffer.byteLength(encoded);
    assert.ok(bytes <= 1048576);
    return Object.freeze({
      bytes,
      sha256: createHash("sha256").update(encoded).digest("hex"),
    });
  } catch {
    throw new Error("Invalid restore operator evidence");
  }
}
