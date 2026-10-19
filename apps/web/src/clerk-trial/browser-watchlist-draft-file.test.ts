import { afterEach, describe, expect, it, vi } from "vitest";
import { browserWatchlistDraftFileAdapter } from "./browser-watchlist-draft-file";
import { formatManagedWatchlistDraftFile } from "./managed-watchlist-draft-file";

const value = formatManagedWatchlistDraftFile({
  accountScope: "sha256:" + "a".repeat(64),
  capturedAt: "2026-10-18T18:00:00.000Z",
  baseVersion: 3,
  draft: {
    name: "My Watchlist",
    schemaVersion: 1,
    snapshotSha256: "sha256:" + "b".repeat(64),
    memberships: [
      {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "invented-issuer",
        issuerName: "Invented issuer",
        listingId: "invented-listing",
        securityId: "invented-security",
        securityName: "Invented security",
        shareClassId: "invented-class",
        shareClassName: "Invented common",
        symbol: "ZERO",
        note: "  Unconfirmed raw note\n零 · café 😀\n  ",
      },
    ],
  },
})!;
function fixture() {
  const controller = new AbortController(),
    isCurrent = vi.fn(() => true);
  let frame!: FrameRequestCallback;
  const anchor = {
    href: "",
    download: "",
    hidden: false,
    click: vi.fn(),
    remove: vi.fn(),
  };
  const append = vi.fn(),
    createObjectURL = vi.fn<(blob: Blob) => string>(
      () => "blob:invented-draft",
    );
  const revokeObjectURL = vi.fn(),
    createElement = vi.fn(() => anchor);
  vi.stubGlobal("document", { createElement, body: { append } });
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.stubGlobal("window", {
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      frame = callback;
      return 42;
    }),
    cancelAnimationFrame: vi.fn(),
  });
  return {
    controller,
    isCurrent,
    anchor,
    append,
    createElement,
    createObjectURL,
    revokeObjectURL,
    context: { signal: controller.signal, isCurrent },
    frame: () => frame(1),
  };
}
afterEach(() => vi.unstubAllGlobals());

describe("browser unconfirmed Watchlist draft file delivery", () => {
  it("downloads the exact admitted JSON and raw notes in the click task", async () => {
    const f = fixture();
    const result = browserWatchlistDraftFileAdapter.deliver(value, f.context);
    expect(f.anchor.click).toHaveBeenCalledOnce();
    expect(f.anchor.download).toBe(
      "Investment-watchlist-draft-2026-10-18T18-00-00-000Z.json",
    );
    const blob = f.createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe("application/json;charset=utf-8");
    expect(blob.size).toBe(value.byteLength);
    expect(await blob.text()).toBe(value.text);
    expect(f.anchor.remove).toHaveBeenCalledOnce();
    expect(f.revokeObjectURL).not.toHaveBeenCalled();
    f.frame();
    await expect(result).resolves.toBe("download_requested");
    expect(f.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:invented-draft",
    );
  });
  it.each(["aborted", "retired"])(
    "does not allocate for an already %s lifetime",
    async (kind) => {
      const f = fixture();
      if (kind === "aborted") f.controller.abort();
      else f.isCurrent.mockReturnValue(false);
      await expect(
        browserWatchlistDraftFileAdapter.deliver(value, f.context),
      ).resolves.toBe("cancelled");
      expect(f.createObjectURL).not.toHaveBeenCalled();
      expect(f.anchor.click).not.toHaveBeenCalled();
    },
  );
  it("rechecks the captured draft lifetime immediately before handing off", async () => {
    const f = fixture();
    f.append.mockImplementation(() => f.isCurrent.mockReturnValue(false));
    await expect(
      browserWatchlistDraftFileAdapter.deliver(value, f.context),
    ).resolves.toBe("cancelled");
    expect(f.anchor.click).not.toHaveBeenCalled();
    expect(f.anchor.remove).toHaveBeenCalledOnce();
    expect(f.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it.each([
    { filename: "../../unconfirmed.json" },
    { byteLength: 1 },
    { baseVersion: 4 },
    { mime: "text/plain" },
    { accountScope: "sha256:" + "c".repeat(64) },
    { extra: "not allowed" },
  ])(
    "refuses mismatched wrapper metadata %j before allocation",
    async (change) => {
      const f = fixture();
      await expect(
        browserWatchlistDraftFileAdapter.deliver(
          { ...value, ...change } as typeof value,
          f.context,
        ),
      ).rejects.toThrow(/^Watchlist draft file unavailable$/u);
      expect(f.createObjectURL).not.toHaveBeenCalled();
    },
  );
  it("sanitizes handoff errors and releases the URL", async () => {
    const f = fixture();
    f.anchor.click.mockImplementation(() => {
      throw new Error("private chosen destination");
    });
    await expect(
      browserWatchlistDraftFileAdapter.deliver(value, f.context),
    ).rejects.toThrow(/^Watchlist draft file unavailable$/u);
    expect(f.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it("cleans up after a handed-off download without claiming cancellation undid it", async () => {
    const f = fixture();
    const result = browserWatchlistDraftFileAdapter.deliver(value, f.context);
    f.controller.abort();
    await expect(result).resolves.toBe("download_requested");
    f.frame();
    expect(f.revokeObjectURL).toHaveBeenCalledOnce();
    expect(f.anchor.click).toHaveBeenCalledOnce();
  });
});
