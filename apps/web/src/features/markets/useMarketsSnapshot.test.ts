import type {
  PersonalMarketOverviewDto,
  PersonalSecurityMasterSearchResultDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import type * as Loader from "./market-board-loader";
import {
  MARKET_BOARD_REFRESH_MILLISECONDS,
  type MarketBoardSnapshot,
} from "./market-board-loader";
import {
  useMarketsSnapshot,
  type MarketsSnapshotContext,
} from "./useMarketsSnapshot";

const hooks = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const effects: Array<{
    dependencies: readonly unknown[] | undefined;
    setup: () => void | (() => void);
    cleanup: (() => void) | undefined;
  }> = [];
  const pending: Array<() => void> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  let scheduledRender = false;
  return {
    beginRender() {
      scheduledRender = false;
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    reset() {
      states.splice(0);
      refs.splice(0);
      effects.splice(0);
      pending.splice(0);
      stateIndex = refIndex = effectIndex = 0;
      scheduledRender = false;
    },
    commit() {
      pending.splice(0).forEach((run) => run());
    },
    replayCommittedEffects() {
      if (pending.length !== 0)
        throw new Error("Commit effects before replaying their lifetime.");
      effects.forEach((effect) => effect.cleanup?.());
      effects.forEach((effect) => {
        effect.cleanup = effect.setup() ?? undefined;
      });
    },
    hasScheduledRender() {
      return scheduledRender;
    },
    unmount() {
      pending.splice(0);
      effects.forEach((effect) => effect.cleanup?.());
    },
    useState(this: void, initial: unknown) {
      const index = stateIndex++;
      if (!(index in states))
        states[index] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        states[index],
        (next: unknown) => {
          const value =
            typeof next === "function"
              ? (next as (current: unknown) => unknown)(states[index])
              : next;
          if (!Object.is(value, states[index])) scheduledRender = true;
          states[index] = value;
        },
      ];
    },
    useRef<T>(this: void, initial: T) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useEffect(
      this: void,
      callback: () => void | (() => void),
      dependencies?: readonly unknown[],
    ) {
      const index = effectIndex++;
      const old = effects[index];
      if (
        old !== undefined &&
        dependencies !== undefined &&
        old.dependencies !== undefined &&
        dependencies.length === old.dependencies.length &&
        dependencies.every((value, i) => Object.is(value, old.dependencies![i]))
      )
        return;
      const effect = {
        dependencies: dependencies?.slice(),
        setup: callback,
        cleanup: old?.cleanup,
      };
      effects[index] = effect;
      pending.push(() => {
        effect.cleanup?.();
        effect.cleanup = callback() ?? undefined;
      });
    },
  };
});
const client = vi.hoisted(() => ({
  load: vi.fn<typeof Loader.loadMarketBoard>(),
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: hooks.useState,
  useRef: hooks.useRef,
  useEffect: hooks.useEffect,
}));
vi.mock("./market-board-loader", async () => ({
  ...(await vi.importActual<typeof Loader>("./market-board-loader")),
  loadMarketBoard: client.load,
}));
const digest = `sha256:${"a".repeat(64)}`;
const otherDigest = `sha256:${"b".repeat(64)}`;
const startTime = Date.parse("2026-09-24T23:00:00Z");
const complete = vi.fn<() => boolean>();
const activity = vi.fn<MarketsSnapshotContext["onActivityStart"]>();
const unavailable = vi.fn();
const unexpectedFetch = vi.fn();
let context: MarketsSnapshotContext;
let current = true;
beforeEach(() => {
  hooks.reset();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(startTime);
  current = true;
  complete.mockReset().mockReturnValue(true);
  activity.mockReset().mockImplementation(() => complete);
  client.load.mockReset().mockResolvedValue(snapshot());
  unexpectedFetch.mockReset().mockImplementation(() => {
    throw new Error("Unexpected network request");
  });
  vi.stubGlobal("fetch", unexpectedFetch);
  context = {
    active: true,
    enabled: true,
    catalogSnapshotSha256: digest,
    sessionKey: 1,
    isCurrent: () => current,
    onActivityStart: activity,
    onSessionUnavailable: unavailable,
  };
});
afterEach(() => {
  hooks.unmount();
  expect(unexpectedFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Markets shared snapshot lifecycle", () => {
  it("loads once after initial StrictMode effect replay and retires the former controls", async () => {
    const beforeReplay = render();
    hooks.replayCommittedEffects();
    beforeReplay.onRefresh();
    expect(client.load).not.toHaveBeenCalled();
    await flush();
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(client.load.mock.calls[0]?.[0]).toBe(digest);
    expect(render()).toMatchObject({
      busy: false,
      attempted: true,
      snapshot: snapshot(),
      selectedListingId: "listing-AAPL",
    });
    expect(activity).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it("deduplicates entry and repeated refresh clicks while the first load is pending", async () => {
    const held = deferred<MarketBoardSnapshot>();
    client.load.mockReturnValue(held.promise);
    const view = render();
    view.onRefresh();
    view.onRefresh();
    await flush();
    render().onRefresh();
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(render()).toMatchObject({ busy: true, attempted: true });
    held.resolve(snapshot());
    await flush();
    expect(render().busy).toBe(false);
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it.each([
    { active: false },
    { enabled: false },
    { catalogSnapshotSha256: null },
  ])("does not load with an unavailable entry context: %j", async (change) => {
    context = { ...context, ...change };
    render();
    await flush();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    render().onRefresh();
    expect(client.load).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalled();
  });
  it("performs one entry load on activation and retains selection and cache on return", async () => {
    context = { ...context, active: false };
    render();
    await flush();
    context = { ...context, active: true };
    render();
    await flush();
    render().onSelect("listing-WMT");
    const beforeLeave = render();
    context = { ...context, active: false };
    expect(render()).toMatchObject({
      snapshot: snapshot(),
      selectedListingId: "listing-WMT",
      busy: false,
    });
    beforeLeave.onSelect("listing-MSFT");
    beforeLeave.onRefresh();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    context = { ...context, active: true };
    render();
    await flush();
    expect(render()).toMatchObject({
      snapshot: snapshot(),
      selectedListingId: "listing-WMT",
    });
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it("selects the first resolved declared listing even if its EOD history failed", async () => {
    const result = snapshot();
    client.load.mockResolvedValue({
      ...result,
      rows: result.rows.map((row, index) =>
        index === 0 ? { ...row, overview: null, error: "unavailable" } : row,
      ),
    });
    render();
    await flush();
    expect(render().selectedListingId).toBe("listing-AAPL");
  });
  it("rejects selection outside the exact loaded board and does not fetch on selection", async () => {
    const view = await loaded();
    view.onSelect("not-on-board");
    expect(render().selectedListingId).toBe("listing-AAPL");
    render().onSelect("listing-MSFT");
    expect(render().selectedListingId).toBe("listing-MSFT");
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it("enforces refresh spacing, keeps the previous snapshot while busy and preserves selection", async () => {
    const view = await loaded();
    view.onSelect("listing-MSFT");
    render().onRefresh();
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(render().nextRefreshAt).toBe(
      startTime + MARKET_BOARD_REFRESH_MILLISECONDS,
    );
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS - 1);
    render().onRefresh();
    expect(client.load).toHaveBeenCalledTimes(1);
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    const held = deferred<MarketBoardSnapshot>();
    client.load.mockReturnValue(held.promise);
    render().onRefresh();
    expect(render()).toMatchObject({
      busy: true,
      snapshot: snapshot(),
      selectedListingId: "listing-MSFT",
    });
    const newer = { ...snapshot(), loadedAt: "2026-09-24T23:15:00.000Z" };
    held.resolve(newer);
    await flush();
    expect(render()).toMatchObject({
      busy: false,
      snapshot: newer,
      selectedListingId: "listing-MSFT",
    });
    expect(client.load).toHaveBeenCalledTimes(2);
  });
  it("never polls, retries or refreshes merely because time passes", async () => {
    await loaded();
    await vi.advanceTimersByTimeAsync(30 * 24 * 60 * 60 * 1000);
    render();
    await flush();
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it("does not spend budget or request data when owner activity cannot start", async () => {
    activity.mockReturnValue(undefined);
    render();
    await flush();
    expect(client.load).not.toHaveBeenCalled();
    activity.mockReturnValue(complete);
    render().onRefresh();
    await flush();
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it("rechecks currentness after starting owner activity", async () => {
    activity.mockImplementation(() => {
      current = false;
      return complete;
    });
    render();
    await flush();
    expect(client.load).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });
  it.each([
    { sessionKey: 2 },
    { catalogSnapshotSha256: otherDigest },
    { enabled: false },
  ])(
    "clears visible state and aborts before effects when context changes: %j",
    async (change) => {
      const old = await loaded();
      vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
      const held = deferred<MarketBoardSnapshot>();
      client.load.mockReturnValue(held.promise);
      old.onRefresh();
      const signal = client.load.mock.calls[1]![1];
      context = { ...context, ...change };
      const cleared = render(false);
      expect(cleared).toMatchObject({
        snapshot: null,
        selectedListingId: null,
        busy: false,
      });
      expect(signal.aborted).toBe(true);
      old.onRefresh();
      old.onSelect("listing-WMT");
      expect(client.load).toHaveBeenCalledTimes(2);
      held.resolve(snapshot());
      await flush();
      expect(render(false).snapshot).toBeNull();
      expect(unavailable).not.toHaveBeenCalled();
    },
  );
  it.each([
    { sessionKey: 2 },
    { catalogSnapshotSha256: otherDigest },
    { active: false },
  ])(
    "retires an entry microtask before effect cleanup on context change: %j",
    async (change) => {
      render();
      context = { ...context, ...change };
      render(false);
      await flush();
      expect(client.load).not.toHaveBeenCalled();
      hooks.commit();
      await flush();
      expect(client.load).toHaveBeenCalledTimes(context.active ? 1 : 0);
      if (context.active)
        expect(client.load.mock.calls[0]?.[0]).toBe(
          context.catalogSnapshotSha256,
        );
    },
  );
  it("explains a deferred reload after session reconnection without presenting cleared data", async () => {
    await loaded();
    context = { ...context, enabled: false };
    render();
    await flush();
    context = { ...context, enabled: true, sessionKey: 2 };
    render();
    await flush();
    expect(render()).toMatchObject({
      snapshot: null,
      selectedListingId: null,
      busy: false,
      attempted: true,
      error: "refresh_deferred",
      nextRefreshAt: startTime + MARKET_BOARD_REFRESH_MILLISECONDS,
    });
    expect(client.load).toHaveBeenCalledTimes(1);
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    render().onRefresh();
    await flush();
    expect(render()).toMatchObject({
      snapshot: snapshot(),
      error: null,
      busy: false,
    });
    expect(client.load).toHaveBeenCalledTimes(2);
  });
  it("retains the consumed refresh budget across a catalog change", async () => {
    await loaded();
    context = { ...context, catalogSnapshotSha256: otherDigest };
    render();
    await flush();
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(render()).toMatchObject({
      snapshot: null,
      attempted: true,
      nextRefreshAt: startTime + MARKET_BOARD_REFRESH_MILLISECONDS,
    });
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    client.load.mockResolvedValue({
      ...snapshot(),
      snapshotSha256: otherDigest,
    });
    render().onRefresh();
    await flush();
    expect(client.load.mock.calls[1]?.[0]).toBe(otherDigest);
  });
  it("aborts pending work when currentness retires and never resurrects the old snapshot", async () => {
    await loaded();
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    const held = deferred<MarketBoardSnapshot>();
    client.load.mockReturnValue(held.promise);
    const prior = render();
    prior.onRefresh();
    const signal = client.load.mock.calls[1]![1];
    current = false;
    expect(render(false)).toMatchObject({
      snapshot: null,
      selectedListingId: null,
      busy: false,
    });
    expect(signal.aborted).toBe(true);
    current = true;
    prior.onRefresh();
    prior.onSelect("listing-MSFT");
    held.resolve(snapshot());
    await flush();
    expect(render().snapshot).toBeNull();
    expect(client.load).toHaveBeenCalledTimes(2);
  });
  it("ignores a late currentness-retired success before any rerender", async () => {
    const held = deferred<MarketBoardSnapshot>();
    client.load.mockReturnValue(held.promise);
    render();
    await flush();
    current = false;
    held.resolve(snapshot());
    await flush();
    expect(complete).not.toHaveBeenCalled();
    expect(render().snapshot).toBeNull();
    expect(unavailable).not.toHaveBeenCalled();
  });
  it.each(["session_unavailable", "unavailable"] as const)(
    "ignores late %s after route retirement",
    async (code) => {
      const held = deferred<MarketBoardSnapshot>();
      client.load.mockReturnValue(held.promise);
      const old = render();
      await flush();
      context = { ...context, active: false };
      render();
      held.reject(new PersonalWorkspaceApiError(code));
      await flush();
      old.onRefresh();
      expect(client.load).toHaveBeenCalledTimes(1);
      expect(complete).not.toHaveBeenCalled();
      expect(unavailable).not.toHaveBeenCalled();
      expect(render()).toMatchObject({
        snapshot: null,
        error: null,
        busy: false,
      });
    },
  );
  it("aborts an initial entry on leaving and does not automatically retry it on return", async () => {
    const held = deferred<MarketBoardSnapshot>();
    client.load.mockReturnValue(held.promise);
    render();
    await flush();
    const signal = client.load.mock.calls[0]![1];
    context = { ...context, active: false };
    render();
    expect(signal.aborted).toBe(true);
    context = { ...context, active: true };
    render();
    held.resolve(snapshot());
    await flush();
    expect(render()).toMatchObject({
      snapshot: null,
      attempted: true,
      busy: false,
    });
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it("clears cache and selection on session failure and reports it once", async () => {
    await loaded();
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    client.load.mockRejectedValue(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    render().onRefresh();
    await flush();
    expect(render()).toMatchObject({
      snapshot: null,
      selectedListingId: null,
      busy: false,
      error: null,
    });
    expect(unavailable).toHaveBeenCalledTimes(1);
  });
  it.each(["success", "failure"] as const)(
    "withholds a %s when owner activity completion expires",
    async (result) => {
      await loaded();
      vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
      complete.mockReturnValue(false);
      if (result === "failure")
        client.load.mockRejectedValue(
          new PersonalWorkspaceApiError("unavailable"),
        );
      render().onRefresh();
      await flush();
      expect(render()).toMatchObject({
        snapshot: null,
        selectedListingId: null,
        busy: false,
      });
      expect(unavailable).toHaveBeenCalledTimes(1);
    },
  );
  it("keeps the last snapshot after a refresh transport failure without an automatic retry", async () => {
    await loaded();
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    client.load.mockRejectedValue(new Error("synthetic transport failure"));
    render().onRefresh();
    await flush();
    expect(render()).toMatchObject({
      snapshot: snapshot(),
      error: "unavailable",
      busy: false,
    });
    await vi.advanceTimersByTimeAsync(MARKET_BOARD_REFRESH_MILLISECONDS);
    expect(client.load).toHaveBeenCalledTimes(2);
  });
  it("clears the mismatched catalog snapshot after a conflict", async () => {
    await loaded();
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    client.load.mockRejectedValue(new PersonalWorkspaceApiError("conflict"));
    render().onRefresh();
    await flush();
    expect(render()).toMatchObject({
      snapshot: null,
      error: "conflict",
      busy: false,
    });
  });
  it("retires pending work and handlers on unmount", async () => {
    const held = deferred<MarketBoardSnapshot>();
    client.load.mockReturnValue(held.promise);
    const old = render();
    await flush();
    hooks.unmount();
    expect(client.load.mock.calls[0]![1].aborted).toBe(true);
    held.reject(new PersonalWorkspaceApiError("session_unavailable"));
    await flush();
    old.onRefresh();
    old.onSelect("listing-MSFT");
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(unavailable).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });
  it("retains idle cache after replay but only fresh controls can refresh", async () => {
    const old = await loaded();
    old.onSelect("listing-WMT");
    render();
    hooks.replayCommittedEffects();
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    old.onRefresh();
    old.onSelect("listing-MSFT");
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(render()).toMatchObject({
      snapshot: snapshot(),
      selectedListingId: "listing-WMT",
      busy: false,
    });
    render().onRefresh();
    await flush();
    expect(client.load).toHaveBeenCalledTimes(2);
  });
  it("ignores a retired request's error while a newer explicit request is pending", async () => {
    const prior = deferred<MarketBoardSnapshot>();
    const fresh = deferred<MarketBoardSnapshot>();
    client.load
      .mockReturnValueOnce(prior.promise)
      .mockReturnValueOnce(fresh.promise);
    render();
    await flush();
    context = { ...context, active: false };
    render();
    context = { ...context, active: true };
    render();
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    render().onRefresh();
    expect(client.load).toHaveBeenCalledTimes(2);
    prior.reject(new PersonalWorkspaceApiError("session_unavailable"));
    await flush();
    expect(render()).toMatchObject({ busy: true, error: null, snapshot: null });
    expect(unavailable).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    fresh.resolve(snapshot());
    await flush();
    expect(render()).toMatchObject({ busy: false, snapshot: snapshot() });
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it("recovers from effect replay during IO without leaving busy state or reviving old work", async () => {
    const held = deferred<MarketBoardSnapshot>();
    client.load.mockReturnValue(held.promise);
    const old = render();
    await flush();
    hooks.replayCommittedEffects();
    expect(client.load.mock.calls[0]![1].aborted).toBe(true);
    expect(render()).toMatchObject({ busy: false, snapshot: null });
    old.onRefresh();
    held.resolve(snapshot());
    await flush();
    expect(render()).toMatchObject({ busy: false, snapshot: null });
    expect(client.load).toHaveBeenCalledTimes(1);
  });
});

function render(commit = true) {
  hooks.beginRender();
  const view = useMarketsSnapshot(context);
  if (commit) hooks.commit();
  return view;
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
async function loaded() {
  render();
  await flush();
  return render();
}
function identity(symbol: string): PersonalSecurityMasterSearchResultDto {
  return {
    cik: "0000000001",
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `issuer-${symbol}`,
    issuerName: `Synthetic ${symbol}`,
    listingId: `listing-${symbol}`,
    matchKind: "current_symbol_exact",
    matchedValue: symbol,
    securityId: `security-${symbol}`,
    securityName: "Common stock",
    shareClassId: `class-${symbol}`,
    shareClassName: "Common",
    symbol,
  };
}
function overview(symbol: string): PersonalMarketOverviewDto {
  const row = identity(symbol);
  const window = {
    range: "1m",
    startDate: "2026-08-24",
    endDate: "2026-09-24",
  } as const;
  return {
    schemaVersion: "2.0.0",
    profile: "personal_single_user_local_market_data",
    ingestedAt: "2026-09-24T23:00:00.000Z",
    security: {
      country: row.country,
      exchangeMic: row.exchangeMic,
      issuerName: row.issuerName,
      listingId: row.listingId,
      securityName: row.securityName,
      symbol,
    },
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      historyFeed: "tiingo_eod_composite",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      quoteFeed: "tiingo_iex_derived_reference",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
    },
    window,
    quote: { status: "not_requested" },
    history: {
      status: "available",
      value: { ...window, currency: "USD", bars: [] },
    },
  };
}
function snapshot(): MarketBoardSnapshot {
  return {
    snapshotSha256: digest,
    loadedAt: "2026-09-24T23:00:00.000Z",
    rows: ["AAPL", "MSFT", "WMT"].map((symbol) => ({
      symbol,
      identity: identity(symbol),
      overview: overview(symbol),
      error: null,
    })),
    stoppedBy: null,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
