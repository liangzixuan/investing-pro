import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserWatchlistExportAdapter } from "./browser-watchlist-export";
import type { SavedWatchlistExportDocument } from "./managed-watchlist-export-document";

const text = "Invented saved note: Café 😀\n";
const value: SavedWatchlistExportDocument = {
  version: 3,
  filename: "Investment-watchlist-v3.txt",
  text,
  byteLength: new TextEncoder().encode(text).byteLength,
  membershipCount: 1,
};

function fixture() {
  const controller = new AbortController();
  const isCurrent = vi.fn(() => true);
  let frame!: FrameRequestCallback;
  const anchor = {
    href: "",
    download: "",
    hidden: false,
    click: vi.fn(),
    remove: vi.fn(),
  };
  const createElement = vi.fn(() => anchor);
  const append = vi.fn();
  const createObjectURL = vi.fn<(blob: Blob) => string>(
    () => "blob:invented-export",
  );
  const revokeObjectURL = vi.fn();
  const cancelAnimationFrame = vi.fn();
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    frame = callback;
    return 42;
  });
  vi.stubGlobal("document", { createElement, body: { append } });
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.stubGlobal("window", { requestAnimationFrame, cancelAnimationFrame });
  return {
    controller,
    isCurrent,
    anchor,
    createElement,
    append,
    createObjectURL,
    revokeObjectURL,
    cancelAnimationFrame,
    requestAnimationFrame,
    context: { signal: controller.signal, isCurrent },
    frame: () => frame(1),
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("browser watchlist export delivery", () => {
  it("requests the exact UTF-8 file in the click task and releases its temporary resources after a frame", async () => {
    const test = fixture();
    const result = browserWatchlistExportAdapter.deliver(value, test.context);
    expect(test.anchor.click).toHaveBeenCalledOnce();
    expect(test.anchor).toMatchObject({
      href: "blob:invented-export",
      download: value.filename,
      hidden: true,
    });
    expect(test.append).toHaveBeenCalledExactlyOnceWith(test.anchor);
    expect(test.anchor.remove).toHaveBeenCalledOnce();
    const blob = test.createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe("text/plain;charset=utf-8");
    expect(blob.size).toBe(value.byteLength);
    expect(await blob.text()).toBe(text);
    expect(test.revokeObjectURL).not.toHaveBeenCalled();
    test.frame();
    await expect(result).resolves.toBe("download_requested");
    expect(test.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:invented-export",
    );
    expect(test.cancelAnimationFrame).toHaveBeenCalledWith(42);
    test.controller.abort();
    expect(test.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it.each(["aborted", "retired"])(
    "does not create a file for an already %s operation",
    async (kind) => {
      const test = fixture();
      if (kind === "aborted") test.controller.abort();
      else test.isCurrent.mockReturnValue(false);
      await expect(
        browserWatchlistExportAdapter.deliver(value, test.context),
      ).resolves.toBe("cancelled");
      expect(test.createObjectURL).not.toHaveBeenCalled();
      expect(test.anchor.click).not.toHaveBeenCalled();
    },
  );

  it("checks ownership again immediately before the download handoff", async () => {
    const test = fixture();
    test.append.mockImplementation(() => test.isCurrent.mockReturnValue(false));
    await expect(
      browserWatchlistExportAdapter.deliver(value, test.context),
    ).resolves.toBe("cancelled");
    expect(test.anchor.click).not.toHaveBeenCalled();
    expect(test.anchor.remove).toHaveBeenCalledOnce();
    expect(test.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it.each(["element", "click"])(
    "releases the URL and returns a bounded failure when %s creation/handoff fails",
    async (stage) => {
      const test = fixture();
      const failure = () => {
        throw new Error("private exception must not escape");
      };
      if (stage === "element") test.createElement.mockImplementation(failure);
      else test.anchor.click.mockImplementation(failure);
      await expect(
        browserWatchlistExportAdapter.deliver(value, test.context),
      ).rejects.toThrow("Watchlist export unavailable");
      expect(test.revokeObjectURL).toHaveBeenCalledOnce();
      expect(test.requestAnimationFrame).not.toHaveBeenCalled();
    },
  );

  it("releases an initiated download on cancellation without claiming it can be undone", async () => {
    const test = fixture();
    const result = browserWatchlistExportAdapter.deliver(value, test.context);
    test.controller.abort();
    await expect(result).resolves.toBe("download_requested");
    test.frame();
    expect(test.anchor.click).toHaveBeenCalledOnce();
    expect(test.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("still releases an initiated URL if scheduling its normal cleanup fails", async () => {
    const test = fixture();
    test.requestAnimationFrame.mockImplementation(() => {
      throw new Error("unavailable");
    });
    await expect(
      browserWatchlistExportAdapter.deliver(value, test.context),
    ).resolves.toBe("download_requested");
    expect(test.revokeObjectURL).toHaveBeenCalledOnce();
    test.controller.abort();
    expect(test.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it.each([
    { ...value, filename: "../../private.txt" },
    { ...value, byteLength: 1 },
    { ...value, text: "\ud800", byteLength: 3 },
  ])(
    "refuses malformed direct documents before allocating output",
    async (document) => {
      const test = fixture();
      await expect(
        browserWatchlistExportAdapter.deliver(document, test.context),
      ).rejects.toThrow("Watchlist export unavailable");
      expect(test.createObjectURL).not.toHaveBeenCalled();
    },
  );
});
