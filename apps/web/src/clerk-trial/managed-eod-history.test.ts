import { afterEach, describe, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import { ManagedEodHistory } from "./managed-eod-history";
import { eodRequest, eodResponse, eodSelection } from "./eod-history-fixture";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const read = vi.fn<ManagedApi["eodHistory"]>();
  const readError = vi.fn();
  const model = new ManagedEodHistory(read, readError);
  model.open(eodSelection);
  return { read, readError, model };
}
afterEach(() => vi.useRealTimers());
describe("session-only managed EOD history", () => {
  it("owns the selection and waits for explicit Load, then clears every price at refresh and cancel", async () => {
    const { model, read } = fixture();
    expect(read).not.toHaveBeenCalled();
    expect(model.getSnapshot().selection).not.toBe(eodSelection);
    expect(Object.isFrozen(model.getSnapshot().selection?.listing)).toBe(true);
    const held = deferred<ReturnType<typeof eodResponse>>();
    read.mockResolvedValueOnce(eodResponse()).mockReturnValueOnce(held.promise);
    await model.load();
    expect(read).toHaveBeenNthCalledWith(
      1,
      eodRequest(),
      expect.any(AbortSignal),
    );
    expect(model.getSnapshot().response?.rows).toEqual(eodResponse().rows);
    const refreshing = model.load();
    await model.load();
    expect(read).toHaveBeenCalledTimes(2);
    expect(model.getSnapshot()).toMatchObject({
      response: null,
      running: true,
    });
    model.cancel();
    expect(read.mock.calls[1]![1].aborted).toBe(true);
    held.resolve(eodResponse());
    await refreshing;
    expect(model.getSnapshot()).toMatchObject({
      response: null,
      running: false,
      error: false,
    });
  });
  it.each([
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "issuerId",
    "issuerName",
    "symbol",
    "country",
    "exchangeMic",
    "instrumentType",
    "listingId",
  ] as const)("rejects a response whose exact %s differs", async (field) => {
    const { read, model } = fixture();
    const response = eodResponse();
    read.mockResolvedValue({
      ...response,
      security: { ...response.security, [field]: "other" },
    });
    await model.load();
    expect(model.getSnapshot()).toMatchObject({ response: null, error: true });
  });
  it("rejects another catalog even when full identity matches", async () => {
    const { read, model } = fixture();
    read.mockResolvedValue({
      ...eodResponse(),
      catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
    });
    await model.load();
    expect(model.getSnapshot()).toMatchObject({ response: null, error: true });
  });
  it.each(["close", "retire", "selection", "cancel"])(
    "fences both late success and late auth failure after %s",
    async (action) => {
      for (const rejects of [false, true]) {
        const { read, model, readError } = fixture();
        const held = deferred<ReturnType<typeof eodResponse>>();
        read
          .mockReturnValueOnce(held.promise)
          .mockResolvedValueOnce(eodResponse());
        const pending = model.load();
        if (action === "selection")
          model.open({ ...eodSelection, origin: "watchlist" });
        else if (action === "close") model.close();
        else if (action === "retire") model.retire();
        else model.cancel();
        expect(read.mock.calls[0]![1].aborted).toBe(true);
        if (action === "selection" || action === "cancel") await model.load();
        const current = model.getSnapshot();
        if (rejects) held.reject(new TrialApiError("unauthenticated"));
        else held.resolve(eodResponse());
        await pending;
        expect(model.getSnapshot()).toBe(current);
        expect(readError).not.toHaveBeenCalled();
        if (action === "retire") {
          model.open(eodSelection);
          await model.load();
          expect(read).toHaveBeenCalledOnce();
        }
      }
    },
  );
  it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
    "retires on current own-session %s",
    async (code) => {
      const { model, read, readError } = fixture();
      read.mockRejectedValue(new TrialApiError(code));
      await model.load();
      expect(readError).toHaveBeenCalledWith(expect.objectContaining({ code }));
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        selection: null,
      });
    },
  );
  it("shares only a checked local cooldown across selections without scheduling a retry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T00:00:00.000Z"));
    const { model, read } = fixture();
    read
      .mockRejectedValueOnce(
        new ManagedEodCooldownError("2026-10-02T00:00:20.000Z"),
      )
      .mockResolvedValue(eodResponse());
    await model.load();
    model.open({ ...eodSelection, origin: "watchlist" });
    await model.load();
    expect(read).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(read).toHaveBeenCalledOnce();
    await model.load();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it.each([
    new ManagedEodCooldownError("not-a-time"),
    new ManagedEodHistoryError("source_rate_limited"),
  ])(
    "does not invent a local reset or schedule retry for %s",
    async (error) => {
      const { model, read, readError } = fixture();
      read.mockRejectedValueOnce(error).mockResolvedValueOnce(eodResponse());
      await model.load();
      expect(model.getSnapshot().message).not.toContain("after ");
      expect(readError).not.toHaveBeenCalled();
      expect(read).toHaveBeenCalledOnce();
      await model.load();
      expect(read).toHaveBeenCalledTimes(2);
    },
  );
  it.each([
    new ManagedEodHistoryError("not_configured"),
    new ManagedEodHistoryError("unsupported_listing"),
    new ManagedEodHistoryError("request_timeout"),
    new ManagedEodHistoryError("unavailable"),
    new TrialApiError("invalid_response"),
    new Error("unknown"),
  ])(
    "clears previous values on a failed refresh without retiring for %s",
    async (error) => {
      const { model, read, readError } = fixture();
      read.mockResolvedValueOnce(eodResponse()).mockRejectedValueOnce(error);
      await model.load();
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        running: false,
        error: true,
      });
      expect(readError).not.toHaveBeenCalled();
    },
  );
  it("requires a new selection after a catalog change", async () => {
    const { model, read } = fixture();
    read
      .mockRejectedValueOnce(new ManagedCatalogChangedError())
      .mockResolvedValueOnce(eodResponse());
    await model.load();
    await model.load();
    expect(read).toHaveBeenCalledOnce();
    expect(model.getSnapshot().catalogChanged).toBe(true);
    model.open(eodSelection);
    await model.load();
    expect(read).toHaveBeenCalledTimes(2);
  });
});
