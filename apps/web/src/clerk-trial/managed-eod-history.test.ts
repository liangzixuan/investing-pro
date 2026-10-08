import { afterEach, describe, expect, it, vi } from "vitest";
import { parseManagedEodHistoryResponse } from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import {
  ManagedEodHistory,
  type ManagedEodHistorySeed,
} from "./managed-eod-history";
import { ManagedEodAccess } from "./managed-eod-access";
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
  it("honors a shared board cooldown through panel close and retirement", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00.000Z"));
    const nextAllowedAt = "2026-10-04T00:01:00.000Z";
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockRejectedValueOnce(new ManagedEodCooldownError(nextAllowedAt));
    const access = new ManagedEodAccess(read);
    await expect(
      access.request(eodSelection, new AbortController().signal),
    ).rejects.toMatchObject({ nextAllowedAt });
    const model = new ManagedEodHistory(read, vi.fn(), access);
    model.open({ ...eodSelection, origin: "markets" });
    await model.load();
    expect(model.getSnapshot().message).toContain(nextAllowedAt);
    expect(model.getSnapshot()).toMatchObject({ running: false, error: false });
    model.close();
    model.retire();
    await expect(
      access.request(eodSelection, new AbortController().signal),
    ).rejects.toMatchObject({ nextAllowedAt });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("shares a panel cooldown with board requests and fences cancelled cooldowns", async () => {
    const read = vi.fn<ManagedApi["eodHistory"]>();
    const access = new ManagedEodAccess(read);
    const model = new ManagedEodHistory(read, vi.fn(), access);
    model.open(eodSelection);
    const held = deferred<ReturnType<typeof eodResponse>>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load();
    model.cancel();
    held.reject(new ManagedEodCooldownError("2099-10-04T00:01:00.000Z"));
    await pending;
    expect(access.getNextAllowedAt()).toBeNull();
    const nextAllowedAt = "2099-10-04T00:02:00.000Z";
    read.mockRejectedValueOnce(new ManagedEodCooldownError(nextAllowedAt));
    await model.load();
    expect(model.getSnapshot().message).toContain(nextAllowedAt);
    await expect(
      access.request(eodSelection, new AbortController().signal),
    ).rejects.toMatchObject({ nextAllowedAt });
    expect(read).toHaveBeenCalledTimes(2);
  });

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

describe("Markets history handoff", () => {
  const selection = { ...eodSelection, origin: "markets" as const, cik: null };

  it.each([false, true])(
    "owns an immutable seed without a request (previous: %s)",
    (showingPrevious) => {
      const { model, read, readError } = fixture();
      const original = eodResponse();
      const packet = {
        ...original,
        security: { ...original.security },
        window: { ...original.window },
        rows: original.rows.map((row) => ({ ...row })),
      };
      const seed = { response: packet, showingPrevious };
      model.open(selection, seed);
      const state = model.getSnapshot();
      expect(state).toMatchObject({
        selection,
        response: original,
        responseOrigin: "markets",
        showingPrevious,
        running: false,
        catalogChanged: false,
        error: false,
      });
      expect(state.response).not.toBe(packet);
      for (const value of [
        state.response,
        state.response?.security,
        state.response?.window,
        state.response?.rows,
        ...state.response!.rows,
      ])
        expect(Object.isFrozen(value)).toBe(true);
      packet.security.shareClassId = "other-class";
      packet.rows[0]!.close = "999.75";
      packet.window.startDate = "2026-08-21";
      seed.showingPrevious = !showingPrevious;
      expect(model.getSnapshot()).toBe(state);
      expect(state.response).toEqual(original);
      expect(state.showingPrevious).toBe(showingPrevious);
      expect(read).not.toHaveBeenCalled();
      expect(readError).not.toHaveBeenCalled();
    },
  );

  it.each(["discover", "watchlist", "route"] as const)(
    "rejects a seed for %s without a request or session error",
    (origin) => {
      const { model, read, readError } = fixture();
      model.open(
        { ...selection, origin },
        {
          response: eodResponse(),
          showingPrevious: false,
        },
      );
      expect(model.getSnapshot()).toMatchObject({
        selection: { ...selection, origin },
        response: null,
        responseOrigin: null,
        showingPrevious: false,
        running: false,
        catalogChanged: false,
        error: true,
      });
      expect(read).not.toHaveBeenCalled();
      expect(readError).not.toHaveBeenCalled();
    },
  );

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
  ] as const)("rejects a seed with a different %s", (field) => {
    const { model, read, readError } = fixture();
    const response = eodResponse();
    model.open(selection, { response, showingPrevious: false });
    model.open(selection, {
      response: {
        ...response,
        security: { ...response.security, [field]: "other" },
      },
      showingPrevious: false,
    });
    expect(model.getSnapshot()).toMatchObject({
      response: null,
      responseOrigin: null,
      showingPrevious: false,
      error: true,
      catalogChanged: false,
    });
    expect(read).not.toHaveBeenCalled();
    expect(readError).not.toHaveBeenCalled();
  });

  it("rejects malformed or wrong-catalog seeds and still permits an explicit load", async () => {
    const { model, read, readError } = fixture();
    const seeds: ManagedEodHistorySeed[] = [
      {
        response: {
          ...eodResponse(),
          catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
        },
        showingPrevious: false,
      },
      {
        response: {
          ...eodResponse(),
          rows: [{ date: "not-a-date", close: "100" }],
        },
        showingPrevious: false,
      },
      {
        response: eodResponse(),
        showingPrevious: "previous" as unknown as boolean,
      },
    ];
    for (const seed of seeds) {
      expect(() => model.open(selection, seed)).not.toThrow();
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        responseOrigin: null,
        showingPrevious: false,
        error: true,
        catalogChanged: false,
      });
      expect(model.getSnapshot().message).toContain("could not be reused");
    }
    expect(read).not.toHaveBeenCalled();
    expect(readError).not.toHaveBeenCalled();
    const loaded = eodResponse();
    read.mockResolvedValueOnce(loaded);
    await model.load();
    expect(model.getSnapshot().response).toBe(loaded);
    expect(model.getSnapshot()).toMatchObject({
      responseOrigin: "company",
      error: false,
      showingPrevious: false,
    });
    expect(read).toHaveBeenCalledOnce();
  });

  it.each([
    new ManagedEodHistoryError("request_timeout"),
    new ManagedEodHistoryError("unavailable"),
    new ManagedEodHistoryError("source_rate_limited"),
    new TrialApiError("unavailable"),
  ])(
    "keeps Markets provenance through recoverable refresh %s",
    async (error) => {
      const { model, read, readError } = fixture();
      model.open(selection, {
        response: eodResponse(),
        showingPrevious: false,
      });
      const retained = model.getSnapshot().response;
      read.mockRejectedValueOnce(error);
      await model.load();
      expect(model.getSnapshot().response).toBe(retained);
      expect(model.getSnapshot()).toMatchObject({
        responseOrigin: "markets",
        showingPrevious: true,
        error: true,
        running: false,
      });
      expect(readError).not.toHaveBeenCalled();
    },
  );

  it.each(["success", "authentication", "catalog", "cooldown"] as const)(
    "keeps a seeded response and shared cooldown after cancelled refresh settles with %s",
    async (settlement) => {
      const held = deferred<ReturnType<typeof eodResponse>>();
      const read = vi
        .fn<ManagedApi["eodHistory"]>()
        .mockReturnValueOnce(held.promise);
      const readError = vi.fn();
      const access = new ManagedEodAccess(read);
      const model = new ManagedEodHistory(read, readError, access);
      model.open(selection, {
        response: eodResponse(),
        showingPrevious: false,
      });
      const response = model.getSnapshot().response;
      const pending = model.load();
      expect(model.getSnapshot()).toMatchObject({
        responseOrigin: "markets",
        response,
        running: true,
        showingPrevious: true,
      });
      model.cancel();
      const cancelled = model.getSnapshot();
      expect(read.mock.calls[0]![1].aborted).toBe(true);
      if (settlement === "success") held.resolve(eodResponse());
      else if (settlement === "authentication")
        held.reject(new TrialApiError("unauthenticated"));
      else if (settlement === "catalog")
        held.reject(new ManagedCatalogChangedError());
      else held.reject(new ManagedEodCooldownError("2099-10-08T00:01:00.000Z"));
      await pending;
      expect(model.getSnapshot()).toBe(cancelled);
      expect(cancelled.response).toBe(response);
      expect(cancelled).toMatchObject({
        responseOrigin: "markets",
        showingPrevious: true,
        running: false,
        error: false,
      });
      expect(access.getNextAllowedAt()).toBeNull();
      expect(readError).not.toHaveBeenCalled();
      expect(read).toHaveBeenCalledOnce();
    },
  );

  it("keeps the shared cooldown and changes origin only on successful explicit company refresh", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T00:00:00.000Z"));
    const nextAllowedAt = "2026-10-08T00:01:00.000Z";
    const refreshed = eodResponse();
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockRejectedValueOnce(new ManagedEodCooldownError(nextAllowedAt))
      .mockResolvedValueOnce(refreshed);
    const access = new ManagedEodAccess(read);
    await expect(
      access.request(selection, new AbortController().signal),
    ).rejects.toMatchObject({ nextAllowedAt });
    const model = new ManagedEodHistory(read, vi.fn(), access);
    model.open(selection, { response: eodResponse(), showingPrevious: true });
    const retained = model.getSnapshot().response;
    await model.load();
    expect(model.getSnapshot().response).toBe(retained);
    expect(model.getSnapshot()).toMatchObject({
      responseOrigin: "markets",
      showingPrevious: true,
      running: false,
      error: false,
    });
    expect(model.getSnapshot().message).toContain(nextAllowedAt);
    expect(read).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledOnce();
    await model.load();
    expect(model.getSnapshot().response).toBe(refreshed);
    expect(model.getSnapshot()).toMatchObject({
      selection: { origin: "markets" },
      responseOrigin: "company",
      showingPrevious: false,
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("fences an old request when another visit supplies a new seed", async () => {
    const { model, read, readError } = fixture();
    const held = deferred<ReturnType<typeof eodResponse>>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load();
    model.open(selection, { response: eodResponse(), showingPrevious: false });
    const current = model.getSnapshot();
    held.resolve({
      ...eodResponse(),
      rows: [{ date: "2026-09-19", close: "999" }],
    });
    await pending;
    expect(read.mock.calls[0]![1].aborted).toBe(true);
    expect(model.getSnapshot()).toBe(current);
    expect(current.responseOrigin).toBe("markets");
    expect(current.response?.rows).toEqual(eodResponse().rows);
    expect(readError).not.toHaveBeenCalled();
  });

  it.each(["close", "retire", "reopen"] as const)(
    "clears a seed and its provenance on %s",
    (action) => {
      const { model, read } = fixture();
      const seed = { response: eodResponse(), showingPrevious: true };
      model.open(selection, seed);
      if (action === "close") model.close();
      else if (action === "retire") {
        model.retire();
        model.open(selection, seed);
      } else model.open(selection);
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        responseOrigin: null,
        showingPrevious: false,
        running: false,
      });
      expect(read).not.toHaveBeenCalled();
    },
  );

  it.each([
    new ManagedCatalogChangedError(),
    new ManagedEodHistoryError("not_configured"),
    new ManagedEodHistoryError("unsupported_listing"),
    new TrialApiError("invalid_response"),
    new TrialApiError("unauthenticated"),
  ])(
    "clears seeded prices and their origin on current fatal error %s",
    async (error) => {
      const { model, read } = fixture();
      model.open(selection, { response: eodResponse(), showingPrevious: true });
      read.mockRejectedValueOnce(error);
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        responseOrigin: null,
        showingPrevious: false,
        running: false,
      });
      expect(read).toHaveBeenCalledOnce();
    },
  );
});
