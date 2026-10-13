import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import generated from "virtual:investment-third-party-notices";
import { compressedNotices, readCompressedNotices } from "./compressed-notices";

const source = new URL(
  "./clerk-trial/third-party-notices.txt",
  import.meta.url,
);

describe("compressed notices build module", () => {
  it("preserves every canonical byte in deterministic gzip", () => {
    const original = readFileSync(source);
    const payload = readCompressedNotices();
    expect(gunzipSync(Buffer.from(payload.base64, "base64"))).toEqual(original);
    expect(payload.byteLength).toBe(original.byteLength);
    expect(readCompressedNotices()).toEqual(payload);
    expect(generated).toEqual(payload);
    expect(payload.base64.length).toBeLessThan(original.byteLength);
  });

  it("resolves only its exact ID and watches only the authoritative file", () => {
    const plugin = compressedNotices();
    const resolve = plugin.resolveId;
    const load = plugin.load;
    if (typeof resolve !== "function" || typeof load !== "function") {
      throw new Error("Expected direct module hooks.");
    }
    const addWatchFile = vi.fn();
    const resolved: unknown = Reflect.apply(resolve, {}, [
      "virtual:investment-third-party-notices",
    ]);
    expect(resolved).toBe("\0virtual:investment-third-party-notices");
    expect(Reflect.apply(resolve, {}, ["virtual:other"])).toBeNull();
    expect(Reflect.apply(load, { addWatchFile }, ["virtual:other"])).toBeNull();
    const code: unknown = Reflect.apply(load, { addWatchFile }, [resolved]);
    expect(code).toBe(`export default ${JSON.stringify(generated)};`);
    expect(addWatchFile).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/[/\\]clerk-trial[/\\]third-party-notices\.txt$/),
    );
  });
});
