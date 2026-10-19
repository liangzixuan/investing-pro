import { describe, expect, it, vi } from "vitest";
import {
  createNativeWatchlistDraftFileAdapter,
  type InvestmentWatchlistDraftFilePlugin,
} from "./native-watchlist-draft-file";
import { formatManagedWatchlistDraftFile } from "./managed-watchlist-draft-file";

const handle = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
function document() {
  return formatManagedWatchlistDraftFile({
    accountScope: "sha256:" + "a".repeat(64),
    capturedAt: "2026-10-18T18:00:00.000Z",
    baseVersion: 3,
    draft: {
      name: "My Watchlist",
      schemaVersion: 1,
      snapshotSha256: "sha256:" + "b".repeat(64),
      memberships: [],
    },
  })!;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture() {
  const plugin: InvestmentWatchlistDraftFilePlugin = {
    choose: vi
      .fn<InvestmentWatchlistDraftFilePlugin["choose"]>()
      .mockResolvedValue({ status: "chosen", handle }),
    write: vi
      .fn<InvestmentWatchlistDraftFilePlugin["write"]>()
      .mockResolvedValue({ status: "written" }),
    cancel: vi
      .fn<InvestmentWatchlistDraftFilePlugin["cancel"]>()
      .mockResolvedValue(),
  };
  const abort = new AbortController(),
    isCurrent = vi.fn(() => true);
  return {
    plugin,
    abort,
    isCurrent,
    context: { signal: abort.signal, isCurrent },
    adapter: createNativeWatchlistDraftFileAdapter(plugin),
  };
}
describe("native unconfirmed Watchlist draft file delivery", () => {
  it("chooses with bounded capture metadata only, then writes the exact captured document", async () => {
    const f = fixture(),
      value = document();
    await expect(f.adapter.deliver(value, f.context)).resolves.toBe("written");
    const options = vi.mocked(f.plugin.choose).mock.calls[0]![0];
    expect(Object.keys(options).sort()).toEqual([
      "baseVersion",
      "capturedAt",
      "operationId",
    ]);
    expect(options).toMatchObject({
      capturedAt: value.capturedAt,
      baseVersion: 3,
    });
    expect(options.operationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(f.plugin.write).toHaveBeenCalledExactlyOnceWith({
      operationId: options.operationId,
      handle,
      text: value.text,
    });
    expect(f.plugin.cancel).toHaveBeenCalledExactlyOnceWith({
      operationId: options.operationId,
    });
  });
  it("writes its immutable capture when the caller changes the wrapper during selection", async () => {
    const f = fixture(),
      held =
        deferred<
          Awaited<ReturnType<InvestmentWatchlistDraftFilePlugin["choose"]>>
        >();
    vi.mocked(f.plugin.choose).mockReturnValueOnce(held.promise);
    const value = { ...document() },
      text = value.text;
    const result = f.adapter.deliver(value, f.context);
    Object.assign(value, {
      baseVersion: 9,
      capturedAt: "2026-10-19T18:00:00.000Z",
      text: "Later draft",
    });
    held.resolve({ status: "chosen", handle });
    await expect(result).resolves.toBe("written");
    expect(vi.mocked(f.plugin.write).mock.calls[0]![0].text).toBe(text);
    expect(vi.mocked(f.plugin.choose).mock.calls[0]![0].baseVersion).toBe(3);
  });
  it.each(["signal", "draft identity"])(
    "discards a late chooser after %s changes",
    async (kind) => {
      const f = fixture(),
        held =
          deferred<
            Awaited<ReturnType<InvestmentWatchlistDraftFilePlugin["choose"]>>
          >();
      vi.mocked(f.plugin.choose).mockReturnValueOnce(held.promise);
      const result = f.adapter.deliver(document(), f.context);
      if (kind === "signal") f.abort.abort();
      else f.isCurrent.mockReturnValue(false);
      held.resolve({ status: "chosen", handle });
      await expect(result).resolves.toBe("cancelled");
      expect(f.plugin.write).not.toHaveBeenCalled();
      expect(f.plugin.cancel).toHaveBeenCalledOnce();
    },
  );
  it("does not choose for an already retired view", async () => {
    const f = fixture();
    f.abort.abort();
    await expect(f.adapter.deliver(document(), f.context)).resolves.toBe(
      "cancelled",
    );
    expect(f.plugin.choose).not.toHaveBeenCalled();
  });
  it("rejects duplicate operations until the first chooser settles", async () => {
    const f = fixture(),
      held =
        deferred<
          Awaited<ReturnType<InvestmentWatchlistDraftFilePlugin["choose"]>>
        >();
    vi.mocked(f.plugin.choose).mockReturnValueOnce(held.promise);
    const first = f.adapter.deliver(document(), f.context);
    await expect(f.adapter.deliver(document(), f.context)).rejects.toThrow(
      /^Watchlist draft file unavailable$/u,
    );
    held.resolve({ status: "cancelled" });
    await expect(first).resolves.toBe("cancelled");
    expect(f.plugin.write).not.toHaveBeenCalled();
    await expect(f.adapter.deliver(document(), f.context)).resolves.toBe(
      "written",
    );
    const choices = vi.mocked(f.plugin.choose).mock.calls;
    expect(choices[0]![0].operationId).not.toBe(choices[1]![0].operationId);
  });
  it.each([
    { filename: "foreign.json" },
    { byteLength: 1 },
    { baseVersion: 4 },
    { capturedAt: "2026-10-19T18:00:00.000Z" },
    { text: "\ud800", byteLength: 3 },
  ])(
    "rejects an inconsistent document %j without a native operation",
    async (change) => {
      const f = fixture();
      await expect(
        f.adapter.deliver({ ...document(), ...change }, f.context),
      ).rejects.toThrow(/^Watchlist draft file unavailable$/u);
      expect(f.plugin.choose).not.toHaveBeenCalled();
      expect(f.plugin.write).not.toHaveBeenCalled();
    },
  );
  it("rejects a returned native URI instead of accepting it as a handle", async () => {
    const f = fixture();
    vi.mocked(f.plugin.choose).mockResolvedValueOnce({
      status: "chosen",
      handle: "content://untrusted/path",
    });
    await expect(f.adapter.deliver(document(), f.context)).rejects.toThrow(
      /^Watchlist draft file unavailable$/u,
    );
    expect(f.plugin.write).not.toHaveBeenCalled();
    expect(f.plugin.cancel).toHaveBeenCalledOnce();
  });
  it("bounds write and cancellation errors and never retries", async () => {
    const f = fixture();
    vi.mocked(f.plugin.write).mockRejectedValueOnce(
      new Error("private destination and draft"),
    );
    vi.mocked(f.plugin.cancel).mockRejectedValueOnce(
      new Error("private native state"),
    );
    await expect(f.adapter.deliver(document(), f.context)).rejects.toThrow(
      /^Watchlist draft file unavailable$/u,
    );
    expect(f.plugin.write).toHaveBeenCalledOnce();
    expect(f.plugin.choose).toHaveBeenCalledOnce();
  });
  it("does not publish a late write acknowledgment to a retired draft view", async () => {
    const f = fixture(),
      held = deferred<{ status: "written" }>();
    vi.mocked(f.plugin.write).mockReturnValueOnce(held.promise);
    const result = f.adapter.deliver(document(), f.context);
    await Promise.resolve();
    expect(f.plugin.write).toHaveBeenCalledOnce();
    f.abort.abort();
    held.resolve({ status: "written" });
    await expect(result).resolves.toBe("cancelled");
    expect(f.plugin.write).toHaveBeenCalledOnce();
  });
});
