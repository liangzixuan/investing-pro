import { afterEach, describe, expect, it, vi } from "vitest";
import { parseManagedEodHistoryResponse } from "@research-cockpit/contracts";
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
  it("waits for explicit Load and retains the exact response during refresh and Cancel", async () => {
    const { model, read } = fixture();
    expect(read).not.toHaveBeenCalled();
    expect(model.getSnapshot().selection).not.toBe(eodSelection);
    expect(Object.isFrozen(model.getSnapshot().selection?.listing)).toBe(true);
    const held = deferred<ReturnType<typeof eodResponse>>();
    const previous = eodResponse();
    read.mockResolvedValueOnce(previous).mockReturnValueOnce(held.promise);
    await model.load();
    expect(read).toHaveBeenNthCalledWith(
      1,
      eodRequest(),
      expect.any(AbortSignal),
    );
    expect(model.getSnapshot().response).toBe(previous);
    expect(model.getSnapshot().showingPrevious).toBe(false);
    const refreshing = model.load();
    await model.load();
    expect(read).toHaveBeenCalledTimes(2);
    expect(model.getSnapshot()).toMatchObject({
      response: previous,
      showingPrevious: true,
      running: true,
    });
    model.cancel();
    expect(read.mock.calls[1]![1].aborted).toBe(true);
    expect(model.getSnapshot().response).toBe(previous);
    expect(model.getSnapshot().message).toContain("refresh cancelled");
    held.resolve({
      ...eodResponse(),
      rows: [{ date: "2026-09-19", close: "999" }],
    });
    await refreshing;
    expect(model.getSnapshot()).toMatchObject({
      response: previous,
      showingPrevious: true,
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
    read.mockResolvedValueOnce(response).mockResolvedValueOnce({
      ...response,
      security: { ...response.security, [field]: "other" },
    });
    await model.load();
    await model.load();
    expect(model.getSnapshot()).toMatchObject({
      response: null,
      showingPrevious: false,
      error: true,
    });
  });
  it("rejects another catalog even when full identity matches", async () => {
    const { read, model } = fixture();
    read.mockResolvedValueOnce(eodResponse()).mockResolvedValueOnce({
      ...eodResponse(),
      catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
    });
    await model.load();
    await model.load();
    expect(model.getSnapshot()).toMatchObject({
      response: null,
      showingPrevious: false,
      error: true,
    });
  });
  it.each(["close", "retire", "selection", "cancel"])(
    "fences both late success and late auth failure after %s",
    async (action) => {
      for (const rejects of [false, true]) {
        const { read, model, readError } = fixture();
        const held = deferred<ReturnType<typeof eodResponse>>();
        read
          .mockResolvedValueOnce(eodResponse())
          .mockReturnValueOnce(held.promise)
          .mockResolvedValueOnce(eodResponse());
        await model.load();
        const pending = model.load();
        if (action === "selection")
          model.open({ ...eodSelection, origin: "watchlist" });
        else if (action === "close") model.close();
        else if (action === "retire") model.retire();
        else model.cancel();
        expect(read.mock.calls[1]![1].aborted).toBe(true);
        if (action !== "cancel") {
          expect(model.getSnapshot()).toMatchObject({
            response: null,
            showingPrevious: false,
            running: false,
          });
        }
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
          expect(read).toHaveBeenCalledTimes(2);
        }
      }
    },
  );
  it.each(["success", "authentication failure"])(
    "keeps a newer refresh running when the cancelled refresh settles with %s",
    async (settlement) => {
      const { model, read, readError } = fixture();
      const previous = eodResponse();
      const old = deferred<ReturnType<typeof eodResponse>>();
      const next = deferred<ReturnType<typeof eodResponse>>();
      read
        .mockResolvedValueOnce(previous)
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(next.promise);
      await model.load();
      const oldPending = model.load();
      model.cancel();
      expect(read.mock.calls[1]![1].aborted).toBe(true);
      const newPending = model.load();
      const current = model.getSnapshot();
      expect(current).toMatchObject({
        response: previous,
        showingPrevious: true,
        running: true,
      });
      if (settlement === "authentication failure")
        old.reject(new TrialApiError("unauthenticated"));
      else old.resolve(eodResponse());
      await oldPending;
      expect(model.getSnapshot()).toBe(current);
      expect(model.getSnapshot().running).toBe(true);
      expect(read.mock.calls[2]![1].aborted).toBe(false);
      expect(readError).not.toHaveBeenCalled();
      expect(read).toHaveBeenCalledTimes(3);
      const replacement = eodResponse();
      next.resolve(replacement);
      await newPending;
      expect(model.getSnapshot().response).toBe(replacement);
      expect(model.getSnapshot()).toMatchObject({
        showingPrevious: false,
        running: false,
        error: false,
      });
    },
  );
  it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
    "retires on current own-session %s",
    async (code) => {
      const { model, read, readError } = fixture();
      read
        .mockResolvedValueOnce(eodResponse())
        .mockRejectedValueOnce(new TrialApiError(code));
      await model.load();
      await model.load();
      expect(readError).toHaveBeenCalledWith(expect.objectContaining({ code }));
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        showingPrevious: false,
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
    new ManagedEodHistoryError("request_timeout"),
    new ManagedEodHistoryError("unavailable"),
    new ManagedEodHistoryError("source_rate_limited"),
    new TrialApiError("unavailable"),
  ])(
    "retains validated history only for recoverable refresh error %s",
    async (error) => {
      const { model, read, readError } = fixture();
      const previous = eodResponse();
      const originalBytes = JSON.stringify(previous);
      read.mockResolvedValueOnce(previous).mockRejectedValueOnce(error);
      await model.load();
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        response: previous,
        showingPrevious: true,
        running: false,
        error: true,
      });
      expect(model.getSnapshot().response).toBe(previous);
      expect(JSON.stringify(previous)).toBe(originalBytes);
      expect(model.getSnapshot().message.toLowerCase()).toContain("refresh");
      expect(readError).not.toHaveBeenCalled();
      expect(read).toHaveBeenCalledTimes(2);
    },
  );
  it("keeps dated history through checked cooldown without a timer request", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T00:00:00.000Z"));
    const { model, read } = fixture();
    const previous = eodResponse();
    read
      .mockResolvedValueOnce(previous)
      .mockRejectedValueOnce(
        new ManagedEodCooldownError("2026-10-02T00:00:20.000Z"),
      )
      .mockResolvedValueOnce(eodResponse());
    await model.load();
    await model.load();
    expect(model.getSnapshot()).toMatchObject({
      showingPrevious: true,
      error: false,
      running: false,
    });
    expect(model.getSnapshot().response).toBe(previous);
    expect(model.getSnapshot().message).toContain("Refresh deferred.");
    await model.load();
    expect(read).toHaveBeenCalledTimes(2);
    expect(model.getSnapshot().response).toBe(previous);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(read).toHaveBeenCalledTimes(2);
    await model.load();
    expect(read).toHaveBeenCalledTimes(3);
    expect(model.getSnapshot().showingPrevious).toBe(false);
  });
  it("replaces the whole previous response after an explicit refresh on a new calendar day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T12:00:00.000Z"));
    const { model, read } = fixture();
    const previous = eodResponse();
    const next = parseManagedEodHistoryResponse(
      {
        ...previous,
        window: { startDate: "2026-08-21", endDate: "2026-09-21" },
        requestStartedAt: "2026-09-21T00:00:00.000Z",
        completedAt: "2026-09-21T00:00:01.000Z",
        rows: [{ date: "2026-09-20", close: "102.75" }],
      },
      eodRequest(),
    );
    if (!next) throw new Error("Invalid invented next-day history");
    const held = deferred<ReturnType<typeof eodResponse>>();
    read.mockResolvedValueOnce(previous).mockReturnValueOnce(held.promise);
    await model.load();
    await vi.advanceTimersByTimeAsync(86_400_000);
    expect(read).toHaveBeenCalledOnce();
    const pending = model.load();
    expect(model.getSnapshot().response).toBe(previous);
    expect(model.getSnapshot().showingPrevious).toBe(true);
    held.resolve(next);
    await pending;
    expect(model.getSnapshot().response).toBe(next);
    expect(model.getSnapshot()).toMatchObject({
      showingPrevious: false,
      error: false,
      running: false,
    });
    expect(model.getSnapshot().response?.rows).toEqual([
      { date: "2026-09-20", close: "102.75" },
    ]);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1]![0]).toEqual(eodRequest());
  });
  it.each(["close", "retire", "selection"])(
    "clears previously loaded history on %s",
    async (action) => {
      const { model, read } = fixture();
      read.mockResolvedValue(eodResponse());
      await model.load();
      if (action === "selection")
        model.open({ ...eodSelection, origin: "watchlist" });
      else if (action === "close") model.close();
      else model.retire();
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        showingPrevious: false,
        running: false,
      });
      expect(read).toHaveBeenCalledOnce();
    },
  );
  it.each([
    new ManagedEodHistoryError("not_configured"),
    new ManagedEodHistoryError("unsupported_listing"),
    new ManagedEodHistoryError("invalid_request"),
    new ManagedEodCooldownError("not-a-time"),
    new TrialApiError("invalid_response"),
    new TrialApiError("invalid_request"),
    new Error("unknown"),
    Object.assign(new Error("unavailable"), { code: "unavailable" }),
  ])(
    "clears previous values on a failed refresh without retiring for %s",
    async (error) => {
      const { model, read, readError } = fixture();
      read.mockResolvedValueOnce(eodResponse()).mockRejectedValueOnce(error);
      await model.load();
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        showingPrevious: false,
        running: false,
        error: true,
      });
      expect(readError).not.toHaveBeenCalled();
    },
  );
  it("requires a new selection after a catalog change", async () => {
    const { model, read } = fixture();
    read
      .mockResolvedValueOnce(eodResponse())
      .mockRejectedValueOnce(new ManagedCatalogChangedError())
      .mockResolvedValueOnce(eodResponse());
    await model.load();
    await model.load();
    await model.load();
    expect(read).toHaveBeenCalledTimes(2);
    expect(model.getSnapshot()).toMatchObject({
      response: null,
      showingPrevious: false,
      catalogChanged: true,
    });
    model.open(eodSelection);
    await model.load();
    expect(read).toHaveBeenCalledTimes(3);
  });
});
