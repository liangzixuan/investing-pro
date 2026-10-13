import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeThirdPartyNotices,
  loadThirdPartyNotices,
} from "./load-third-party-notices";

const signal = () => new AbortController().signal;
function payload(bytes: Uint8Array = Buffer.from("Exact notice Café 😀\r\n")) {
  return {
    base64: gzipSync(bytes).toString("base64"),
    byteLength: bytes.byteLength,
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("software license decoder", () => {
  it("loads the complete canonical notices, icons and font without requests", async () => {
    const fetch = vi.fn(() => {
      throw new Error("No source requests allowed.");
    });
    vi.stubGlobal("fetch", fetch);
    const notice = readFileSync(
      new URL("../../clerk-trial/third-party-notices.txt", import.meta.url),
      "utf8",
    );
    const icons = readFileSync(
      new URL("./icons/LICENSE.txt", import.meta.url),
      "utf8",
    );
    const font = readFileSync(
      new URL("./fonts/OFL.txt", import.meta.url),
      "utf8",
    );
    expect(await loadThirdPartyNotices(signal())).toBe(
      `${notice}\n\nTabler Icons\n\n${icons}\n\nInter\n\n${font}`,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves Unicode, line endings and a source BOM", async () => {
    const text = "\ufeffExact notice Café 😀\r\n\nCopyright ©\t2026";
    expect(
      await decodeThirdPartyNotices(payload(Buffer.from(text)), signal()),
    ).toBe(text);
  });

  it.each([0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "refuses invalid source length %s",
    async (byteLength) => {
      await expect(
        decodeThirdPartyNotices({ ...payload(), byteLength }, signal()),
      ).rejects.toThrow();
    },
  );

  it.each([-1, 1])(
    "refuses a source length mismatch %s without partial text",
    async (difference) => {
      const value = payload();
      await expect(
        decodeThirdPartyNotices(
          { ...value, byteLength: value.byteLength + difference },
          signal(),
        ),
      ).rejects.toThrow();
    },
  );

  it.each([
    "invalid-base64",
    "invalid-gzip",
    "truncated",
    "checksum",
    "trailing",
  ])("rejects %s instead of showing incomplete notices", async (kind) => {
    const value = payload();
    let bytes = Buffer.from(value.base64, "base64");
    if (kind === "invalid-gzip") bytes = Buffer.from("not gzip");
    if (kind === "truncated") bytes = bytes.subarray(0, bytes.length - 4);
    if (kind === "checksum")
      bytes[bytes.length - 8] = bytes[bytes.length - 8]! ^ 1;
    if (kind === "trailing") bytes = Buffer.concat([bytes, Buffer.from([1])]);
    const base64 = kind === "invalid-base64" ? "!" : bytes.toString("base64");
    await expect(
      decodeThirdPartyNotices({ ...value, base64 }, signal()),
    ).rejects.toThrow();
  });

  it("rejects invalid UTF-8 rather than replacing source bytes", async () => {
    await expect(
      decodeThirdPartyNotices(payload(new Uint8Array([0xff])), signal()),
    ).rejects.toThrow();
  });

  it("fails clearly when the platform decoder is unavailable", async () => {
    vi.stubGlobal("DecompressionStream", undefined);
    await expect(decodeThirdPartyNotices(payload(), signal())).rejects.toThrow(
      "unavailable",
    );
  });

  it("refuses an already aborted load before import/decompression", async () => {
    const controller = new AbortController();
    controller.abort();
    const stream = vi.spyOn(Blob.prototype, "stream");
    await expect(loadThirdPartyNotices(controller.signal)).rejects.toThrow();
    expect(stream).not.toHaveBeenCalled();
  });

  it("cancels an in-progress gzip read without publishing a prefix", async () => {
    const controller = new AbortController();
    const value = payload();
    const cancel = vi.fn();
    let started!: () => void;
    const reading = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.spyOn(Blob.prototype, "stream").mockReturnValue(
      new ReadableStream({
        start(stream) {
          stream.enqueue(
            new Uint8Array(Buffer.from(value.base64, "base64").subarray(0, 10)),
          );
          started();
        },
        cancel,
      }),
    );
    const result = decodeThirdPartyNotices(value, controller.signal);
    await reading;
    controller.abort();
    await expect(result).rejects.toThrow();
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  });
});
