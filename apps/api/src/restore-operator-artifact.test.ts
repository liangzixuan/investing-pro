import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  admitRestoreOperatorArtifact,
  restoreOperatorEvidenceDigest,
  WATCHLIST_RESTORE_ARCHIVE,
} from "./restore-operator-artifact";
import { WATCHLIST_RESTORE_SOURCE_CREATES } from "./watchlist-restore-operator-plan";

const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
describe("restore operator immutable upload", () => {
  it("cannot change a fixed resource or its grants through exported plan references", () => {
    const operation = WATCHLIST_RESTORE_SOURCE_CREATES[0];
    expect(Reflect.set(operation.params, "databaseId", "other-database")).toBe(
      false,
    );
    expect(operation.params.databaseId).toBe("investment_backup_watchlist_v1");
    for (const step of WATCHLIST_RESTORE_SOURCE_CREATES) {
      expect(Object.isFrozen(step)).toBe(true);
      expect(Object.isFrozen(step.params)).toBe(true);
      if ("permissions" in step.params)
        expect(Object.isFrozen(step.params.permissions)).toBe(true);
    }
    expect(Object.isFrozen(WATCHLIST_RESTORE_SOURCE_CREATES)).toBe(true);
  });
  it("copies accepted bytes and refuses a changed artifact", () => {
    const bytes = Buffer.from("invented offline archive");
    const receipt = { bytes: bytes.length, sha256: hash(bytes) };
    const copy = admitRestoreOperatorArtifact(bytes, receipt);
    bytes.fill(0);
    expect(copy.toString()).toBe("invented offline archive");
    expect(() => admitRestoreOperatorArtifact(bytes, receipt)).toThrow(
      "Invalid restore operator artifact",
    );
  });
  it.each([
    { bytes: 0, sha256: "a".repeat(64) },
    { bytes: 2 * 1024 * 1024 + 1, sha256: "a".repeat(64) },
    { bytes: 1, sha256: "invalid" },
    { bytes: 1.5, sha256: "a".repeat(64) },
    { bytes: 9, sha256: hash(Buffer.from("x")) },
  ])("refuses an invalid receipt %j", (receipt) => {
    expect(() =>
      admitRestoreOperatorArtifact(Buffer.from("x"), receipt),
    ).toThrow("Invalid restore operator artifact");
  });
  it("pins the reviewed unchanged archive without reading a local path", () => {
    expect(WATCHLIST_RESTORE_ARCHIVE).toEqual({
      bytes: 246893,
      sha256:
        "906be639684f977fa54b39e2fb5c50a2d8eb5e006f05198ea0c1989a27731427",
      filename: "function-code.tar.gz",
    });
    expect(Object.isFrozen(WATCHLIST_RESTORE_ARCHIVE)).toBe(true);
  });
});
describe("safe original response identity", () => {
  it("hashes exact primitive values and property order without retaining bodies", () => {
    const value = { id: "invented", rows: [1, true, null, "東京"] };
    const encoded = Buffer.from(JSON.stringify(value));
    expect(restoreOperatorEvidenceDigest(value)).toEqual({
      bytes: encoded.length,
      sha256: hash(encoded),
    });
  });
  it("never invokes the SDK formatter", () => {
    const value = { id: "invented" },
      format = vi.fn(() => "private body");
    Object.defineProperty(value, "toString", {
      value: format,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    expect(restoreOperatorEvidenceDigest(value)).toEqual(
      restoreOperatorEvidenceDigest({ id: "invented" }),
    );
    expect(format).not.toHaveBeenCalled();
  });
  it("refuses accessors without reading them", () => {
    const get = vi.fn(() => "private"),
      value = {};
    Object.defineProperty(value, "data", { get, enumerable: true });
    expect(() => restoreOperatorEvidenceDigest(value)).toThrow();
    expect(get).not.toHaveBeenCalled();
  });
  it("refuses a toJSON hook without calling it", () => {
    const toJSON = vi.fn(() => ({ changed: true }));
    expect(() => restoreOperatorEvidenceDigest({ toJSON })).toThrow();
    expect(toJSON).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    NaN,
    Infinity,
    1n,
    () => true,
    new Date(),
    { nested: undefined },
    { data: "x".repeat(1048577) },
    { [Symbol("hidden")]: "private" },
  ])("refuses non-JSON or excessive evidence %#", (value) => {
    expect(() => restoreOperatorEvidenceDigest(value)).toThrow();
  });
  it("refuses sparse arrays, extra array keys, cycles and excessive nesting", () => {
    const sparse = Array(2) as unknown[];
    const extra = Object.assign([1], { extra: 2 });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    let deep: unknown = null;
    for (let i = 0; i < 40; i++) deep = { deep };
    for (const value of [sparse, extra, cyclic, deep])
      expect(() => restoreOperatorEvidenceDigest(value)).toThrow();
  });
});
