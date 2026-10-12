import { describe, expect, it, vi } from "vitest";
import {
  createNativeWatchlistExportAdapter,
  type InvestmentWatchlistExportPlugin,
} from "./native-watchlist-export";
import {
  MANAGED_WATCHLIST_EXPORT_MAX_BYTES,
  type SavedWatchlistExportDocument,
} from "./managed-watchlist-export-document";

const handle = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const text = "Invented saved note\n零 · café 😀\n";
function document(): SavedWatchlistExportDocument {
  return {
    version: 3,
    filename: "Investment-watchlist-v3.txt",
    text,
    byteLength: new TextEncoder().encode(text).byteLength,
    membershipCount: 2,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture() {
  const plugin: InvestmentWatchlistExportPlugin = {
    choose: vi
      .fn<InvestmentWatchlistExportPlugin["choose"]>()
      .mockResolvedValue({ status: "chosen", handle }),
    write: vi
      .fn<InvestmentWatchlistExportPlugin["write"]>()
      .mockResolvedValue({ status: "written" }),
    cancel: vi
      .fn<InvestmentWatchlistExportPlugin["cancel"]>()
      .mockResolvedValue(),
  };
  const abort = new AbortController();
  const isCurrent = vi.fn(() => true);
  return {
    plugin,
    abort,
    isCurrent,
    context: { signal: abort.signal, isCurrent },
    adapter: createNativeWatchlistExportAdapter(plugin),
  };
}

describe("native saved-watchlist export delivery", () => {
  it("chooses with metadata only, then writes the captured exact UTF-8 text and same operation", async () => {
    const { plugin, context, adapter } = fixture();
    await expect(adapter.deliver(document(), context)).resolves.toBe("written");
    const options = vi.mocked(plugin.choose).mock.calls[0]![0];
    expect(Object.keys(options).sort()).toEqual(["operationId", "version"]);
    expect(options.version).toBe(3);
    expect(options.operationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(plugin.write).toHaveBeenCalledExactlyOnceWith({
      operationId: options.operationId,
      handle,
      text,
    });
    expect(plugin.cancel).toHaveBeenCalledExactlyOnceWith({
      operationId: options.operationId,
    });
  });

  it("writes the captured document even if the caller mutates the original object", async () => {
    const { plugin, context, adapter } = fixture();
    const held =
      deferred<
        Awaited<ReturnType<InvestmentWatchlistExportPlugin["choose"]>>
      >();
    vi.mocked(plugin.choose).mockReturnValueOnce(held.promise);
    const original = document();
    const pending = adapter.deliver(original, context);
    Object.assign(original, { version: 4, text: "Later unsaved content" });
    held.resolve({ status: "chosen", handle });
    await expect(pending).resolves.toBe("written");
    expect(vi.mocked(plugin.write).mock.calls[0]![0].text).toBe(text);
  });

  it.each(["signal", "saved identity"] as const)(
    "refuses a late picker result after %s retires the captured version",
    async (kind) => {
      const { plugin, context, adapter, abort, isCurrent } = fixture();
      const held =
        deferred<
          Awaited<ReturnType<InvestmentWatchlistExportPlugin["choose"]>>
        >();
      vi.mocked(plugin.choose).mockReturnValueOnce(held.promise);
      const pending = adapter.deliver(document(), context);
      if (kind === "signal") abort.abort();
      else isCurrent.mockReturnValue(false);
      held.resolve({ status: "chosen", handle });
      await expect(pending).resolves.toBe("cancelled");
      expect(plugin.write).not.toHaveBeenCalled();
      expect(plugin.cancel).toHaveBeenCalledOnce();
    },
  );

  it("does not choose when the initiating view is already retired", async () => {
    const { plugin, context, adapter, abort } = fixture();
    abort.abort();
    await expect(adapter.deliver(document(), context)).resolves.toBe(
      "cancelled",
    );
    expect(plugin.choose).not.toHaveBeenCalled();
  });

  it("refuses duplicate operations and permits a fresh operation only after settlement", async () => {
    const { plugin, context, adapter } = fixture();
    const held =
      deferred<
        Awaited<ReturnType<InvestmentWatchlistExportPlugin["choose"]>>
      >();
    vi.mocked(plugin.choose).mockReturnValueOnce(held.promise);
    const pending = adapter.deliver(document(), context);
    await expect(adapter.deliver(document(), context)).rejects.toThrow(
      "Watchlist export unavailable",
    );
    expect(plugin.choose).toHaveBeenCalledOnce();
    held.resolve({ status: "cancelled" });
    await expect(pending).resolves.toBe("cancelled");
    await expect(adapter.deliver(document(), context)).resolves.toBe("written");
    const calls = vi.mocked(plugin.choose).mock.calls;
    expect(calls[0]![0].operationId).not.toBe(calls[1]![0].operationId);
    expect(plugin.write).toHaveBeenCalledOnce();
  });

  it.each([
    { text: "\ud800", byteLength: 3 },
    {
      text: "x".repeat(MANAGED_WATCHLIST_EXPORT_MAX_BYTES + 1),
      byteLength: MANAGED_WATCHLIST_EXPORT_MAX_BYTES + 1,
    },
    { byteLength: 1 },
    { filename: "private-note.txt" },
  ])(
    "refuses malformed direct input before any picker or write",
    async (change) => {
      const { plugin, context, adapter } = fixture();
      await expect(
        adapter.deliver({ ...document(), ...change }, context),
      ).rejects.toThrow("Watchlist export unavailable");
      expect(plugin.choose).not.toHaveBeenCalled();
      expect(plugin.write).not.toHaveBeenCalled();
    },
  );

  it("rejects a malformed native handle without delivering text", async () => {
    const { plugin, context, adapter } = fixture();
    vi.mocked(plugin.choose).mockResolvedValueOnce({
      status: "chosen",
      handle: "content://untrusted/path",
    });
    await expect(adapter.deliver(document(), context)).rejects.toThrow(
      "Watchlist export unavailable",
    );
    expect(plugin.write).not.toHaveBeenCalled();
    expect(plugin.cancel).toHaveBeenCalledOnce();
  });

  it("bounds write errors and contains cancellation errors without retrying", async () => {
    const { plugin, context, adapter } = fixture();
    vi.mocked(plugin.write).mockRejectedValueOnce(
      new Error("private URI and note content"),
    );
    vi.mocked(plugin.cancel).mockImplementationOnce(() => {
      throw new Error("private native state");
    });
    await expect(adapter.deliver(document(), context)).rejects.toThrow(
      /^Watchlist export unavailable$/u,
    );
    expect(plugin.write).toHaveBeenCalledOnce();
    expect(plugin.choose).toHaveBeenCalledOnce();
  });

  it("does not report a late written result into a retired view", async () => {
    const { plugin, context, adapter, abort } = fixture();
    const held = deferred<{ status: "written" }>();
    vi.mocked(plugin.write).mockReturnValueOnce(held.promise);
    const pending = adapter.deliver(document(), context);
    await Promise.resolve();
    expect(plugin.write).toHaveBeenCalledOnce();
    abort.abort();
    held.resolve({ status: "written" });
    await expect(pending).resolves.toBe("cancelled");
    expect(plugin.write).toHaveBeenCalledOnce();
  });
});
