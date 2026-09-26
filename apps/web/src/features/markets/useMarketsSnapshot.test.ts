import type {
  PersonalMarketOverviewDto,
  PersonalSecurityMasterSearchResultDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import type * as Loader from "./market-board-loader";
import {
  MARKET_BOARD_REFRESH_MILLISECONDS,
  marketBoardCohortKey,
  marketBoardIdentityKey,
  type MarketBoardDefinition,
  type MarketBoardMember,
  type MarketBoardAdmission,
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
  render().onLoad();
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
      value: {
        ...window,
        currency: "USD",
        bars: [
          {
            date: "2026-09-24",
            raw: {
              open: "10",
              high: "11",
              low: "9",
              close: "10",
              volume: "100",
            },
            adjusted: {
              open: "10",
              high: "11",
              low: "9",
              close: "10",
              volume: "100",
            },
            splitFactor: "1",
            dividendCash: "0",
          },
        ],
      },
    },
  };
}
function snapshot(
  board: MarketBoardDefinition = { kind: "default" },
  snapshotSha256 = digest,
): MarketBoardSnapshot {
  const symbols =
    board.kind === "default"
      ? ["AAPL", "MSFT", "WMT"]
      : board.members.map((member) => member.symbol);
  return {
    definition: board,
    cohortKey: marketBoardCohortKey(board, snapshotSha256),
    snapshotSha256,
    loadedAt: "2026-09-24T23:00:00.000Z",
    rows: symbols.map((symbol) => ({
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
const client = vi.hoisted(() => ({
  admit: vi.fn<typeof Loader.admitMarketBoard>(),
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
  admitMarketBoard: client.admit,
  loadMarketBoard: client.load,
}));
const digest = "sha256:" + "a".repeat(64);
const otherDigest = "sha256:" + "b".repeat(64);
const startTime = Date.parse("2026-09-24T23:00:00Z");
const complete = vi.fn<() => boolean>();
const activity = vi.fn<MarketsSnapshotContext["onActivityStart"]>();
const unavailable = vi.fn();
const unexpectedFetch = vi.fn();
let context: MarketsSnapshotContext;
let current = true;
let viewEpoch = 0;
let members: readonly MarketBoardMember[];
beforeEach(() => {
  hooks.reset();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(startTime);
  current = true;
  viewEpoch = 0;
  members = ["AAPL", "MSFT", "WMT", "IBM", "ORCL", "COST", "AMZN"].map(member);
  complete.mockReset().mockReturnValue(true);
  activity.mockReset().mockImplementation(() => complete);
  client.admit
    .mockReset()
    .mockImplementation((board, sha) => Promise.resolve(admission(board, sha)));
  client.load
    .mockReset()
    .mockImplementation((admitted) =>
      Promise.resolve(snapshot(admitted.definition, admitted.snapshotSha256)),
    );
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
    isActive: () => viewEpoch === 0,
    watchlist: { status: "available", members },
    isWatchlistCurrent: (expected) =>
      context.watchlist.status === "available" &&
      expected.every((entry) =>
        members.some(
          (saved) =>
            marketBoardIdentityKey(saved) === marketBoardIdentityKey(entry),
        ),
      ),
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

describe("Markets explicit cohort lifecycle", () => {
  it("rejects a queued checkbox callback when an unchecked same-listing identity was replaced", () => {
    render().onModeChange("watchlist");
    const old = render();
    members = members.map((entry) =>
      entry.symbol === "AAPL"
        ? { ...entry, shareClassId: "replacement-class" }
        : entry,
    );
    context = { ...context, watchlist: { status: "available", members } };
    render();
    old.onToggleWatchlist("listing-AAPL", true);
    expect(render().draft).toEqual({ kind: "watchlist", members: [] });
    render().onToggleWatchlist("listing-AAPL", true);
    expect(render().draft).toEqual({
      kind: "watchlist",
      members: [members[0]],
    });
    expect(client.admit).not.toHaveBeenCalled();
  });
  it("prunes a hidden retired watchlist copy without aborting an unrelated paid default request", async () => {
    choose("AAPL");
    render().onModeChange("default");
    const held = deferred<MarketBoardSnapshot>();
    client.load.mockReturnValueOnce(held.promise);
    render().onLoad();
    await flush();
    const signal = client.load.mock.calls[0]![1];
    members = members.slice(1);
    context = { ...context, watchlist: { status: "available", members } };
    expect(render().busy).toBe(true);
    expect(signal.aborted).toBe(false);
    held.resolve(snapshot());
    await flush();
    expect(render().snapshot).toEqual(snapshot());
    expect(complete).toHaveBeenCalledOnce();
    render().onModeChange("watchlist");
    expect(render().draft).toEqual({ kind: "watchlist", members: [] });
    expect(client.load).toHaveBeenCalledTimes(1);
  });

  it("rechecks authority if owner completion retires the view", async () => {
    complete.mockImplementation(() => {
      viewEpoch = 1;
      return true;
    });
    await loaded();
    expect(render().snapshot).toBeNull();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(unavailable).not.toHaveBeenCalled();
  });

  it("never loads on entry, StrictMode replay, mode/checkbox edits, time passage or Back", async () => {
    const stale = render();
    hooks.replayCommittedEffects();
    stale.onLoad();
    render().onModeChange("watchlist");
    render().onToggleWatchlist("listing-AAPL", true);
    render().onModeChange("default");
    context = { ...context, active: false };
    render();
    context = { ...context, active: true };
    render();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    await flush();
    expect(client.admit).not.toHaveBeenCalled();
    expect(client.load).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalled();
    expect(render().draft).toEqual({ kind: "default" });
  });
  it("starts empty and preserves copied selections in saved order across modes", () => {
    render().onModeChange("watchlist");
    expect(render().draft).toEqual({ kind: "watchlist", members: [] });
    expect(render().canLoad).toBe(false);
    render().onLoad();
    render().onToggleWatchlist("listing-WMT", true);
    render().onToggleWatchlist("listing-AAPL", true);
    const chosen = render().draft;
    expect(chosen).toEqual({
      kind: "watchlist",
      members: [member("AAPL"), member("WMT")],
    });
    if (chosen.kind === "watchlist") {
      expect(chosen.members[0]).not.toBe(members[0]);
      expect(Object.isFrozen(chosen.members[0])).toBe(true);
    }
    render().onModeChange("default");
    render().onModeChange("watchlist");
    expect(render().draft).toEqual(chosen);
    expect(client.admit).not.toHaveBeenCalled();
  });
  it("caps selection at six, ignores unknown/ADR/duplicate entries and allows removal", () => {
    members = [...members, { ...member("ADR"), instrumentType: "adr" }];
    context = { ...context, watchlist: { status: "available", members } };
    render().onModeChange("watchlist");
    render().onToggleWatchlist("listing-ADR", true);
    render().onToggleWatchlist("missing", true);
    for (const entry of members)
      render().onToggleWatchlist(entry.listingId, true);
    const draft = render().draft;
    expect(draft.kind === "watchlist" && draft.members.length).toBe(6);
    render().onToggleWatchlist("listing-AAPL", true);
    render().onToggleWatchlist("listing-AAPL", false);
    render().onToggleWatchlist("listing-AMZN", true);
    expect(render().draft).toEqual({
      kind: "watchlist",
      members: members.slice(1, 7),
    });
    expect(client.admit).not.toHaveBeenCalled();
  });
  it("deduplicates clicks across local admission and acquisition using one signal", async () => {
    const pendingAdmission = deferred<MarketBoardAdmission>();
    const pendingLoad = deferred<MarketBoardSnapshot>();
    client.admit.mockReturnValue(pendingAdmission.promise);
    client.load.mockReturnValue(pendingLoad.promise);
    const view = render();
    view.onLoad();
    view.onLoad();
    render().onLoad();
    expect(client.admit).toHaveBeenCalledTimes(1);
    expect(client.load).not.toHaveBeenCalled();
    pendingAdmission.resolve(admission());
    await flush();
    render().onLoad();
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(client.load.mock.calls[0]![1]).toBe(client.admit.mock.calls[0]![2]);
    pendingLoad.resolve(snapshot());
    await flush();
    expect(render()).toMatchObject({
      busy: false,
      attempted: true,
      selectedListingId: "listing-AAPL",
      snapshot: snapshot(),
    });
    expect(activity).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it.each([
    { active: false },
    { enabled: false },
    { catalogSnapshotSha256: null },
    { isActive: () => false },
    { isCurrent: () => false },
  ])("refuses an unavailable action context: %j", async (change) => {
    context = { ...context, ...change };
    render().onLoad();
    await flush();
    expect(client.admit).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalled();
  });
  it.each(["unavailable", "stale", "reconciling"] as const)(
    "disables %s watchlist without affecting default loading",
    async (status) => {
      choose("AAPL");
      context = { ...context, watchlist: { status, members } };
      expect(render().canLoad).toBe(false);
      render().onLoad();
      expect(client.admit).not.toHaveBeenCalled();
      render().onModeChange("default");
      await loaded();
      expect(client.load).toHaveBeenCalledTimes(1);
    },
  );
  it("refuses owner activity failure and rechecks authority after activity starts without spending budget", async () => {
    activity.mockReturnValue(undefined);
    render().onLoad();
    expect(client.admit).not.toHaveBeenCalled();
    activity.mockImplementation(() => {
      current = false;
      return complete;
    });
    render().onLoad();
    expect(client.admit).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    current = true;
    activity.mockReturnValue(complete);
    await loaded();
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it("prechecks cadence before owner/local IO and charges after delayed admission before EOD", async () => {
    const held = deferred<MarketBoardAdmission>();
    client.admit.mockReturnValueOnce(held.promise);
    render().onLoad();
    expect(render().nextRefreshAt).toBeNull();
    vi.setSystemTime(startTime + 1000);
    held.resolve(admission());
    await flush();
    expect(render().nextRefreshAt).toBe(
      startTime + 1000 + MARKET_BOARD_REFRESH_MILLISECONDS,
    );
    render().onLoad();
    expect(render().error).toBe("refresh_deferred");
    expect(client.admit).toHaveBeenCalledTimes(1);
    expect(activity).toHaveBeenCalledTimes(1);
    vi.setSystemTime(startTime + 1000 + MARKET_BOARD_REFRESH_MILLISECONDS);
    render().onLoad();
    await flush();
    expect(client.load).toHaveBeenCalledTimes(2);
  });
  it("does not charge for an empty or wholly inadmissible cohort and keeps explicit failure rows", async () => {
    render().onModeChange("watchlist");
    render().onLoad();
    expect(client.admit).not.toHaveBeenCalled();
    render().onToggleWatchlist("listing-AAPL", true);
    client.admit.mockImplementationOnce((board, sha) =>
      Promise.resolve({
        ...admission(board, sha),
        rows: [{ symbol: "AAPL", identity: null, error: "not_in_catalog" }],
      }),
    );
    client.load.mockImplementationOnce((admitted) =>
      Promise.resolve({
        ...snapshot(admitted.definition),
        rows: admitted.rows.map((row) => ({ ...row, overview: null })),
      }),
    );
    render().onLoad();
    await flush();
    expect(render()).toMatchObject({
      error: "unavailable",
      nextRefreshAt: null,
    });
    expect(render().snapshot?.rows[0]?.error).toBe("not_in_catalog");
    render().onModeChange("default");
    await loaded();
    expect(client.admit).toHaveBeenCalledTimes(2);
    expect(render().nextRefreshAt).toBe(
      startTime + MARKET_BOARD_REFRESH_MILLISECONDS,
    );
  });
  it("shares nonrefundable cadence across failure, modes, catalog and session resets", async () => {
    client.load.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("unavailable"),
    );
    await loaded();
    choose("AAPL");
    render().onLoad();
    expect(client.admit).toHaveBeenCalledTimes(1);
    context = { ...context, sessionKey: 2, catalogSnapshotSha256: otherDigest };
    render().onLoad();
    expect(render()).toMatchObject({
      snapshot: null,
      error: "refresh_deferred",
    });
    expect(client.admit).toHaveBeenCalledTimes(1);
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    await loaded();
    expect(client.load).toHaveBeenCalledTimes(2);
  });
  it("permits at most four starts before the rolling hour boundary across cohort switches", async () => {
    for (let index = 0; index < 4; index++) {
      vi.setSystemTime(startTime + index * MARKET_BOARD_REFRESH_MILLISECONDS);
      if (index % 2) choose("AAPL");
      else render().onModeChange("default");
      await loaded();
    }
    vi.setSystemTime(startTime + 60 * 60 * 1000 - 1);
    render().onLoad();
    expect(client.load).toHaveBeenCalledTimes(4);
    expect(client.admit).toHaveBeenCalledTimes(4);
    vi.setSystemTime(startTime + 60 * 60 * 1000);
    await loaded();
    expect(client.load).toHaveBeenCalledTimes(5);
  });
  it("checks authority after admission before charging or starting EOD", async () => {
    const held = deferred<MarketBoardAdmission>();
    client.admit.mockReturnValueOnce(held.promise);
    const old = render();
    old.onLoad();
    viewEpoch = 1;
    held.resolve(admission());
    await flush();
    expect(client.load).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    context = { ...context, isActive: () => viewEpoch === 1 };
    await loaded();
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(render().error).toBeNull();
  });
  it("retains cache and selection on Back without automatic IO", async () => {
    await loaded();
    render().onSelect("listing-WMT");
    const old = render();
    context = { ...context, active: false };
    expect(render().snapshot).toEqual(snapshot());
    old.onLoad();
    expect(old.onSelect("listing-MSFT")).toBe(false);
    context = { ...context, active: true };
    await flush();
    expect(render().selectedListingId).toBe("listing-WMT");
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it("hides unmatched data and retires company/select controls synchronously after draft edits", async () => {
    const old = await loaded();
    expect(old.isSnapshotCurrent()).toBe(true);
    old.onModeChange("watchlist");
    expect(old.isSnapshotCurrent()).toBe(false);
    expect(old.onSelect("listing-MSFT")).toBe(false);
    expect(render().snapshot).toBeNull();
    render().onToggleWatchlist("listing-AAPL", true);
    expect(render().snapshot).toBeNull();
    render().onModeChange("default");
    expect(render().snapshot).toEqual(snapshot());
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it("keeps one snapshot and cannot relabel another cohort after a failed load", async () => {
    await loaded();
    choose("AAPL");
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    const failed = {
      ...snapshot(render().draft),
      rows: [
        {
          symbol: "AAPL",
          identity: identity("AAPL"),
          overview: null,
          error: "unavailable" as const,
        },
      ],
    };
    client.load.mockResolvedValueOnce(failed);
    await loaded();
    expect(render().snapshot).toEqual(failed);
    render().onModeChange("default");
    expect(render().snapshot).toBeNull();
  });
  it.each(["rows", "empty", "transport"] as const)(
    "retains same-cohort original dates on zero usable %s refresh",
    async (failure) => {
      const before = await loaded();
      vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
      if (failure === "transport")
        client.load.mockRejectedValueOnce(
          new Error("fixture transport failure"),
        );
      else
        client.load.mockResolvedValueOnce({
          ...snapshot(),
          loadedAt: "2026-09-24T23:15:00Z",
          rows: snapshot().rows.map((row) => ({
            ...row,
            error: failure === "rows" ? "unavailable" : null,
            overview: failure === "rows" ? null : emptyOverview(row.symbol),
          })),
        });
      await loaded();
      expect(render().snapshot).toBe(before.snapshot);
      expect(render().error).toBe("unavailable");
      await vi.advanceTimersByTimeAsync(MARKET_BOARD_REFRESH_MILLISECONDS);
      expect(client.load).toHaveBeenCalledTimes(2);
    },
  );
  it("replaces the whole snapshot on usable partial data including one valid observation", async () => {
    const before = await loaded();
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    const partial = {
      ...snapshot(),
      loadedAt: "2026-09-24T23:15:00Z",
      rows: snapshot().rows.map((row, i) =>
        i === 0
          ? row
          : { ...row, overview: null, error: "unavailable" as const },
      ),
    };
    client.load.mockResolvedValueOnce(partial);
    await loaded();
    expect(render().snapshot).toBe(partial);
    expect(render().snapshot).not.toBe(before.snapshot);
    expect(render().snapshot?.rows[1]?.overview).toBeNull();
    expect(render().error).toBeNull();
  });
  it("selection never fetches and rejects a listing outside the cohort", async () => {
    await loaded();
    expect(render().onSelect("missing")).toBe(false);
    expect(render().onSelect("listing-MSFT")).toBe(true);
    expect(render().selectedListingId).toBe("listing-MSFT");
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it("preserves pending work and accepted data through note-only and unrelated member replacement", async () => {
    choose("AAPL");
    const held = deferred<MarketBoardSnapshot>();
    client.load.mockReturnValueOnce(held.promise);
    render().onLoad();
    await flush();
    members = members.map((entry) =>
      entry.symbol === "MSFT"
        ? { ...entry, issuerName: "Unrelated changed name" }
        : { ...entry },
    );
    context = { ...context, watchlist: { status: "available", members } };
    render();
    expect(client.load.mock.calls[0]![1].aborted).toBe(false);
    held.resolve(snapshot(render().draft));
    await flush();
    const accepted = render().snapshot;
    context = {
      ...context,
      watchlist: { status: "available", members: [...members] },
    };
    expect(render().snapshot).toBe(accepted);
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it.each(["remove", "identity"] as const)(
    "retires a selected member on %s without substitution",
    async (change) => {
      choose("AAPL");
      await loaded();
      vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
      const held = deferred<MarketBoardSnapshot>();
      client.load.mockReturnValueOnce(held.promise);
      const old = render();
      old.onLoad();
      await flush();
      const oldDefinition = old.draft;
      members =
        change === "remove"
          ? members.slice(1)
          : members.map((entry) =>
              entry.symbol === "AAPL"
                ? { ...entry, shareClassName: "Replacement" }
                : entry,
            );
      context = { ...context, watchlist: { status: "available", members } };
      expect(render(false)).toMatchObject({
        snapshot: null,
        draft: { kind: "watchlist", members: [] },
        busy: false,
      });
      expect(client.load.mock.calls[1]![1].aborted).toBe(true);
      expect(old.isSnapshotCurrent()).toBe(false);
      held.resolve(snapshot(oldDefinition));
      await flush();
      expect(render().snapshot).toBeNull();
    },
  );
  it("checks a hidden snapshot's own authority rather than the current default draft", async () => {
    choose("AAPL");
    await loaded();
    render().onModeChange("default");
    members = members.slice(1);
    context = { ...context, watchlist: { status: "available", members } };
    render();
    render().onModeChange("watchlist");
    expect(render().snapshot).toBeNull();
    expect(render().draft).toEqual({ kind: "watchlist", members: [] });
  });
  it("retires stale watchlist data but preserves an unrelated default snapshot", async () => {
    choose("AAPL");
    await loaded();
    context = { ...context, watchlist: { status: "stale", members } };
    expect(render().snapshot).toBeNull();
    context = { ...context, watchlist: { status: "available", members } };
    expect(render().snapshot).toBeNull();
    render().onModeChange("default");
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    await loaded();
    context = { ...context, watchlist: { status: "stale", members } };
    expect(render().snapshot).toEqual(snapshot());
  });
  it.each([
    { sessionKey: 2 },
    { catalogSnapshotSha256: otherDigest },
    { enabled: false },
  ])(
    "resets draft/data and aborts before effects on lifetime change: %j",
    async (change) => {
      choose("AAPL");
      await loaded();
      vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
      const held = deferred<MarketBoardSnapshot>();
      client.load.mockReturnValueOnce(held.promise);
      const old = render();
      old.onLoad();
      await flush();
      context = { ...context, ...change };
      expect(render(false)).toMatchObject({
        draft: { kind: "default" },
        snapshot: null,
        busy: false,
      });
      expect(client.load.mock.calls[1]![1].aborted).toBe(true);
      old.onLoad();
      held.resolve(snapshot());
      await flush();
      expect(render().snapshot).toBeNull();
      expect(unavailable).not.toHaveBeenCalled();
    },
  );
  it("rejects synchronous hide/return completion and old controls before rerender", async () => {
    const held = deferred<MarketBoardSnapshot>();
    client.load.mockReturnValueOnce(held.promise);
    const old = render();
    old.onLoad();
    await flush();
    viewEpoch = 2;
    context = { ...context, isActive: () => viewEpoch === 2 };
    held.resolve(snapshot());
    await flush();
    old.onLoad();
    expect(complete).not.toHaveBeenCalled();
    expect(render().snapshot).toBeNull();
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it("rejects selected-member replacement before rerender or completion", async () => {
    choose("AAPL");
    const held = deferred<MarketBoardSnapshot>();
    client.load.mockReturnValueOnce(held.promise);
    const old = render();
    old.onLoad();
    await flush();
    members = members.slice(1);
    held.resolve(snapshot(old.draft));
    await flush();
    expect(complete).not.toHaveBeenCalled();
    context = { ...context, watchlist: { status: "available", members } };
    expect(render().snapshot).toBeNull();
  });
  it.each(["session_unavailable", "conflict"] as const)(
    "clears retained data on current %s",
    async (code) => {
      await loaded();
      vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
      client.admit.mockRejectedValueOnce(new PersonalWorkspaceApiError(code));
      await loaded();
      expect(render().snapshot).toBeNull();
      expect(render().selectedListingId).toBeNull();
      expect(unavailable).toHaveBeenCalledTimes(
        code === "session_unavailable" ? 1 : 0,
      );
    },
  );
  it.each(["success", "failure"] as const)(
    "clears data when owner completion expires on %s",
    async (result) => {
      await loaded();
      vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
      complete.mockReturnValue(false);
      if (result === "failure")
        client.load.mockRejectedValueOnce(new Error("fixture failure"));
      await loaded();
      expect(render().snapshot).toBeNull();
      expect(unavailable).toHaveBeenCalledTimes(1);
    },
  );
  it("ignores old errors while a newer explicit request is pending, without refunding starts", async () => {
    const old = deferred<MarketBoardSnapshot>(),
      fresh = deferred<MarketBoardSnapshot>();
    client.load
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    render().onLoad();
    await flush();
    context = { ...context, active: false };
    render();
    context = { ...context, active: true };
    render();
    vi.setSystemTime(startTime + MARKET_BOARD_REFRESH_MILLISECONDS);
    render().onLoad();
    await flush();
    old.reject(new PersonalWorkspaceApiError("session_unavailable"));
    await flush();
    expect(render()).toMatchObject({ busy: true, error: null, snapshot: null });
    expect(unavailable).not.toHaveBeenCalled();
    fresh.resolve(snapshot());
    await flush();
    expect(render().snapshot).toEqual(snapshot());
    expect(complete).toHaveBeenCalledTimes(1);
    render().onLoad();
    expect(client.load).toHaveBeenCalledTimes(2);
  });
  it("retires requests and controls on unmount and StrictMode effect replay", async () => {
    const held = deferred<MarketBoardSnapshot>();
    client.load.mockReturnValueOnce(held.promise);
    const old = render();
    old.onLoad();
    await flush();
    hooks.replayCommittedEffects();
    expect(client.load.mock.calls[0]![1].aborted).toBe(true);
    old.onLoad();
    held.resolve(snapshot());
    await flush();
    expect(render()).toMatchObject({ busy: false, snapshot: null });
    hooks.unmount();
    old.onLoad();
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
  });
});
function member(symbol: string): MarketBoardMember {
  const value = identity(symbol);
  return {
    country: value.country,
    exchangeMic: value.exchangeMic,
    instrumentType: value.instrumentType,
    issuerId: value.issuerId,
    issuerName: value.issuerName,
    listingId: value.listingId,
    securityId: value.securityId,
    securityName: value.securityName,
    shareClassId: value.shareClassId,
    shareClassName: value.shareClassName,
    symbol: value.symbol,
  };
}
function choose(...symbols: string[]) {
  render().onModeChange("watchlist");
  for (const symbol of symbols)
    render().onToggleWatchlist("listing-" + symbol, true);
}
function admission(
  board: MarketBoardDefinition = { kind: "default" },
  snapshotSha256 = digest,
): MarketBoardAdmission {
  return {
    ...snapshot(board, snapshotSha256),
    rows: snapshot(board, snapshotSha256).rows.map(({ symbol, identity }) => ({
      symbol,
      identity,
      error: null,
    })),
  };
}
function emptyOverview(symbol: string): PersonalMarketOverviewDto {
  const value = overview(symbol);
  if (value.history.status !== "available")
    throw Error("Fixture expected history");
  return {
    ...value,
    history: {
      status: "available",
      value: { ...value.history.value, bars: [] },
    },
  };
}
