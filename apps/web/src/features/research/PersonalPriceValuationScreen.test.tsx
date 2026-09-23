import type {
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
  PersonalValuationHistoryDto,
} from "@research-cockpit/contracts";
import type { PersonalWatchlistMembership } from "../../lib/personal-workspace-api";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => {
  const states: unknown[] = [],
    refs: Array<{ current: unknown }> = [];
  const dependencies: Array<readonly unknown[] | undefined> = [];
  const memos: Array<{ deps: readonly unknown[]; value: unknown }> = [];
  const cleanup = new Map<number, () => void>();
  const effectBodies = new Map<number, () => (() => void) | void>();
  let pending: Array<() => void> = [],
    stateIndex = 0,
    refIndex = 0,
    effectIndex = 0,
    memoIndex = 0;
  return {
    states,
    reset() {
      states.splice(0);
      refs.splice(0);
      dependencies.splice(0);
      memos.splice(0);
      cleanup.clear();
      effectBodies.clear();
      pending = [];
    },
    begin() {
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
      memoIndex = 0;
    },
    effects() {
      const effects = pending;
      pending = [];
      effects.forEach((effect) => effect());
    },
    unmount() {
      cleanup.forEach((fn) => fn());
      cleanup.clear();
    },
    replay() {
      cleanup.forEach((fn) => fn());
      cleanup.clear();
      effectBodies.forEach((effect, index) => {
        const returned = effect();
        if (returned) cleanup.set(index, returned);
      });
    },
    useEffect(
      effect: () => (() => void) | void,
      next: readonly unknown[] | undefined,
    ) {
      const index = effectIndex++,
        previous = dependencies[index];
      if (
        previous !== undefined &&
        next !== undefined &&
        previous.length === next.length &&
        next.every((item, i) => Object.is(item, previous[i]))
      )
        return;
      dependencies[index] = next;
      effectBodies.set(index, effect);
      pending.push(() => {
        cleanup.get(index)?.();
        const returned = effect();
        if (returned) cleanup.set(index, returned);
      });
    },
    useRef<T>(initial: T) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useMemo<T>(factory: () => T, deps: readonly unknown[]): T {
      const index = memoIndex++;
      const previous = memos[index];
      if (
        !previous ||
        previous.deps.length !== deps.length ||
        !deps.every((value, offset) => Object.is(value, previous.deps[offset]))
      ) {
        memos[index] = { deps, value: factory() };
      }
      return memos[index]!.value as T;
    },
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (next: unknown) => {
          states[index] =
            typeof next === "function"
              ? (next as (previous: unknown) => unknown)(states[index])
              : next;
        },
      ];
    },
  };
});
const api = vi.hoisted(() => ({
  fetchPersonalMarketOverview: vi.fn(),
  fetchPersonalValuationHistory: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useMemo: <T,>(factory: () => T, deps: readonly unknown[]) =>
    harness.useMemo(factory, deps),
  useState: (initial: unknown) => harness.useState(initial),
  useRef: <T,>(initial: T) => harness.useRef(initial),
  useEffect: (
    effect: () => (() => void) | void,
    deps: readonly unknown[] | undefined,
  ) => harness.useEffect(effect, deps),
}));
vi.mock("../../lib/personal-workspace-api", async () => ({
  ...(await import("../../lib/personal-workspace-api")),
  ...api,
}));
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import {
  PersonalPriceValuationScreen,
  type PersonalPriceValuationScreenProps,
} from "./PersonalPriceValuationScreen";

let props: PersonalPriceValuationScreenProps;
beforeEach(() => {
  harness.reset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-23T12:00:00.000Z"));
  api.fetchPersonalMarketOverview
    .mockReset()
    .mockImplementation(({ symbol }: { symbol: string }) =>
      Promise.resolve(overview(symbol)),
    );
  api.fetchPersonalValuationHistory
    .mockReset()
    .mockImplementation(({ symbol }: { symbol: string }) =>
      Promise.resolve(valuation(symbol)),
    );
  props = {
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    watchlistVersion: 2,
    memberships: [member("AAA"), member("BBB")],
    enabled: true,
    providerStatus: status(),
    onActivityStart: vi.fn(() => {
      let completed = false;
      return () => {
        if (completed) return false;
        completed = true;
        return true;
      };
    }),
    onSessionUnavailable: vi.fn(),
    onOpenResearch: vi.fn(),
  };
});
afterEach(() => {
  harness.unmount();
  vi.useRealTimers();
});

describe("PersonalPriceValuationScreen", () => {
  it("refuses a stale Load handler after selection changes away and back", async () => {
    select("AAA");
    const old = render();
    change(checks(render())[0]!, false);
    select("AAA");
    click(old, "Load prices and valuation");
    await flush();
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    click(render(), "Load prices and valuation");
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
  });

  it("an old Cancel handler cannot cancel a newer request", async () => {
    const first = deferred<PersonalMarketOverviewDto>(),
      second = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    select("AAA");
    click(render(), "Load prices and valuation");
    const old = render();
    click(old, "Cancel load");
    click(render(), "Load prices and valuation");
    click(old, "Cancel load");
    expect(
      (api.fetchPersonalMarketOverview.mock.calls[1]![1] as AbortSignal)
        .aborted,
    ).toBe(false);
    first.resolve(overview("AAA"));
    second.resolve(overview("AAA"));
    await flush();
    expect(text(row("AAA"))).toContain("101.5");
  });

  it("preserves completed narrow rows on cancel while naming unfinished rows accurately", async () => {
    const pending = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview
      .mockResolvedValueOnce(overview("AAA"))
      .mockImplementationOnce(() => pending.promise);
    select("AAA");
    select("BBB");
    click(render(), "Load prices and valuation");
    await flush();
    click(render(), "Cancel load");
    expect(text(row("AAA"))).toContain("101.5");
    expect(text(row("BBB"))).toContain("Canceled before this row completed");
    expect(text(row("BBB"))).not.toContain("Loading price");
    pending.resolve(overview("BBB"));
    await flush();
    expect(api.fetchPersonalValuationHistory).toHaveBeenCalledTimes(1);
  });

  it("accepts the market client's trailing-zero close spelling exactly", async () => {
    const value = overview("AAA");
    api.fetchPersonalMarketOverview.mockResolvedValueOnce({
      ...value,
      history: {
        ...value.history,
        bars: value.history.bars.map((bar) => ({
          ...bar,
          raw: { ...bar.raw, close: "101.500" },
        })),
      },
    });
    select("AAA");
    click(render(), "Load prices and valuation");
    await flush();
    expect(text(row("AAA"))).toContain("101.5");
    expect(text(row("AAA"))).not.toContain("did not match");
  });
  it("retires handlers across effect cleanup and setup with identical props", async () => {
    select("AAA");
    const old = render();
    harness.replay();
    const fresh = render();
    click(old, "Load prices and valuation");
    change(checks(old)[0]!, true);
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(text(render())).toContain("0 /20");
    change(checks(fresh)[0]!, true);
    click(render(), "Load prices and valuation");
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
  });

  it("fails malformed setup safely and allows a later valid context to load", async () => {
    props = {
      ...props,
      memberships: [{ ...member("AAA"), issuerName: "x".repeat(513) }],
    };
    select("AAA");
    click(render(), "Load prices and valuation");
    await flush();
    expect(text(render())).toContain("Saved identities could not be used");
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    props = { ...props, memberships: [member("AAA")] };
    render();
    select("AAA");
    click(render(), "Load prices and valuation");
    await flush();
    expect(text(row("AAA"))).toContain("101.5");
  });
  it("starts empty, with no fetch, and uses native keyboard controls", () => {
    const tree = render();
    expect(button(tree, "Load prices and valuation").props.disabled).toBe(true);
    expect(text(tree)).toContain("0 /20");
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(api.fetchPersonalValuationHistory).not.toHaveBeenCalled();
    expect(
      elements(tree).find(
        (item) => item.props.id === "personal-price-valuation-screen-title",
      )?.props.tabIndex,
    ).toBe(-1);
    expect(
      elements(tree)
        .filter((item) => item.type === "button")
        .every((item) => item.props.type === "button"),
    ).toBe(true);
    expect(
      elements(tree).find((item) => item.props.role === "region")?.props
        .tabIndex,
    ).toBe(0);
    expect(
      elements(tree)
        .filter((item) => item.type === "th")
        .every((item) => item.props.scope === "col"),
    ).toBe(true);
  });

  it("serializes overview then valuation then next listing, rejects duplicate clicks and retains narrow rows only", async () => {
    const first = deferred<PersonalMarketOverviewDto>(),
      second = deferred<PersonalValuationHistoryDto>();
    api.fetchPersonalMarketOverview.mockImplementationOnce(() => first.promise);
    api.fetchPersonalValuationHistory.mockImplementationOnce(
      () => second.promise,
    );
    select("AAA");
    select("BBB");
    const tree = render();
    click(tree, "Load prices and valuation");
    click(tree, "Load prices and valuation");
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    expect(api.fetchPersonalValuationHistory).not.toHaveBeenCalled();
    first.resolve(overview("AAA"));
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    expect(api.fetchPersonalValuationHistory).toHaveBeenCalledTimes(1);
    second.resolve(valuation("AAA"));
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
    expect(api.fetchPersonalValuationHistory).toHaveBeenCalledTimes(2);
    expect(props.onActivityStart).toHaveBeenCalledTimes(4);
    expect(text(render())).toContain("2 rows · 2 matches");
    expect(text(render())).toContain("1 days old at load");
    expect(text(render())).toContain("101.5");
    const retained = JSON.stringify(harness.states);
    for (const field of [
      "bars",
      "points",
      "quote",
      "open",
      "high",
      "low",
      "volume",
      "marketCapitalization",
      "trailingPeg1Y",
      "note",
    ])
      expect(retained).not.toContain(`"${field}"`);
    expect(retained).toContain('"metrics"');
  });

  it("searches the full list, pages at50 and reaches listings beyond the first page", () => {
    props = {
      ...props,
      memberships: Array.from({ length: 102 }, (_, index) =>
        member(`S${index}`),
      ),
    };
    expect(checks(render())).toHaveLength(50);
    click(render(), "Next companies");
    expect(checks(render())).toHaveLength(50);
    click(render(), "Next companies");
    expect(checks(render())).toHaveLength(2);
    changeLabel("Search saved companies", "S101");
    expect(checks(render())).toHaveLength(1);
    select("S101");
    expect(text(render())).toContain("1 /20");
    expect(props.memberships).toHaveLength(102);
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
  });

  it("enforces20 selections and the40 local-call cap without slicing memberships", async () => {
    props = {
      ...props,
      memberships: Array.from({ length: 21 }, (_, index) =>
        member(`S${index}`),
      ),
    };
    for (let index = 0; index < 20; index += 1) select(`S${index}`);
    const last = checks(render()).find(
      (item) => item.props["aria-label"] === "Select S20 · XNAS",
    )!;
    expect(last.props.disabled).toBe(true);
    change(last, true);
    click(render(), "Load prices and valuation");
    await flush(180);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(20);
    expect(api.fetchPersonalValuationHistory).toHaveBeenCalledTimes(20);
    expect(text(render())).toContain("20 rows");
    expect(props.memberships).toHaveLength(21);
  });

  it.each(["overview", "valuation"] as const)(
    "stops all remaining calls after fatal %s failure",
    async (stage) => {
      const fn =
        stage === "overview"
          ? api.fetchPersonalMarketOverview
          : api.fetchPersonalValuationHistory;
      fn.mockRejectedValueOnce(new PersonalWorkspaceApiError("rate_limited"));
      select("AAA");
      select("BBB");
      click(render(), "Load prices and valuation");
      await flush();
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
      expect(api.fetchPersonalValuationHistory).toHaveBeenCalledTimes(
        stage === "overview" ? 0 : 1,
      );
      expect(text(render())).toContain("Batch stopped");
      expect(text(render())).toContain("rate limit");
      expect(resultRows()).toHaveLength(2);
    },
  );

  it.each(["not_configured", "credentials_invalid", "not_entitled"] as const)(
    "stops on %s before valuation",
    async (code) => {
      api.fetchPersonalMarketOverview.mockRejectedValueOnce(
        new PersonalWorkspaceApiError(code),
      );
      select("AAA");
      select("BBB");
      click(render(), "Load prices and valuation");
      await flush();
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
      expect(api.fetchPersonalValuationHistory).not.toHaveBeenCalled();
    },
  );

  it("keeps ordinary listing errors unknown and continues the batch", async () => {
    api.fetchPersonalMarketOverview.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("not_covered"),
    );
    select("AAA");
    select("BBB");
    click(render(), "Load prices and valuation");
    await flush();
    expect(api.fetchPersonalValuationHistory).toHaveBeenCalledTimes(2);
    expect(text(row("AAA"))).toContain("not covered");
    expect(text(row("AAA"))).toContain("Price history unavailable");
    expect(text(row("BBB"))).toContain("101.5");
  });

  it.each([
    "country",
    "exchangeMic",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
  ] as const)(
    "refuses overview mismatch in full identity field %s",
    async (field) => {
      const bad = overview("AAA");
      api.fetchPersonalMarketOverview.mockResolvedValueOnce({
        ...bad,
        security: { ...bad.security, [field]: "OTHER" },
      });
      select("AAA");
      click(render(), "Load prices and valuation");
      await flush();
      expect(text(row("AAA"))).toContain("Unknown");
      expect(text(row("AAA"))).not.toContain("101.5");
      expect(text(row("AAA"))).toContain("did not match");
    },
  );
  it.each([
    "country",
    "exchangeMic",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
  ] as const)(
    "refuses valuation mismatch in full identity field %s",
    async (field) => {
      const bad = valuation("AAA");
      api.fetchPersonalValuationHistory.mockResolvedValueOnce({
        ...bad,
        security: { ...bad.security, [field]: "OTHER" },
      });
      select("AAA");
      click(render(), "Load prices and valuation");
      await flush();
      expect(text(row("AAA"))).not.toContain("101.5");
      expect(text(row("AAA"))).toContain("did not match");
    },
  );

  it("keeps the latest valuation date with unknown ratios rather than falling back", async () => {
    const value = valuation("AAA");
    const prior = { ...value.history.latestPoint, date: "2026-09-21" };
    const latest = {
      ...value.history.latestPoint,
      priceToEarnings: unknownRatio(),
      priceToBook: unknownRatio(),
    };
    api.fetchPersonalValuationHistory.mockResolvedValueOnce({
      ...value,
      history: {
        ...value.history,
        startDate: "2026-08-22",
        points: [prior, latest],
        latestPoint: latest,
      },
    });
    select("AAA");
    click(render(), "Load prices and valuation");
    await flush();
    expect(text(row("AAA"))).toContain("2026-09-22");
    expect(text(row("AAA"))).toContain("Not supplied by Tiingo");
    expect(text(row("AAA"))).toContain("101.5");
  });

  it("withholds all cells when the latest date has no raw close and preserves age", async () => {
    const value = overview("AAA");
    api.fetchPersonalMarketOverview.mockResolvedValueOnce({
      ...value,
      history: {
        ...value.history,
        startDate: "2026-08-21",
        endDate: "2026-09-21",
        bars: [{ ...value.history.bars[0]!, date: "2026-09-21" }],
      },
    });
    select("AAA");
    click(render(), "Load prices and valuation");
    await flush();
    expect(text(row("AAA"))).toContain(
      "No raw close on the latest valuation date",
    );
    expect(text(row("AAA"))).toContain("1 days old at load");
    expect(text(row("AAA"))).not.toContain("101.5");
  });

  it("freezes one loadDate across UTC midnight", async () => {
    vi.setSystemTime(new Date("2026-09-23T23:59:59.000Z"));
    const wait = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview.mockImplementationOnce(() => wait.promise);
    select("AAA");
    select("BBB");
    click(render(), "Load prices and valuation");
    vi.setSystemTime(new Date("2026-09-24T00:00:01.000Z"));
    wait.resolve(overview("AAA"));
    await flush();
    expect(text(row("AAA"))).toContain("Loaded 2026-09-23");
    expect(text(row("BBB"))).toContain("Loaded 2026-09-23");
  });

  it("rejects malformed narrow histories rather than admitting numeric cells", async () => {
    const value = valuation("AAA");
    api.fetchPersonalValuationHistory.mockResolvedValueOnce({
      ...value,
      history: {
        ...value.history,
        latestPoint: { ...value.history.latestPoint, date: "2026-09-21" },
      },
    });
    select("AAA");
    click(render(), "Load prices and valuation");
    await flush();
    expect(text(row("AAA"))).toContain("did not match");
    expect(text(row("AAA"))).not.toContain("101.5");
  });

  it("cancels late completion without starting valuation, and permits a new explicit load", async () => {
    const wait = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview.mockImplementationOnce(() => wait.promise);
    select("AAA");
    click(render(), "Load prices and valuation");
    const signal = api.fetchPersonalMarketOverview.mock
      .calls[0]![1] as AbortSignal;
    click(render(), "Cancel load");
    expect(signal.aborted).toBe(true);
    wait.resolve(overview("AAA"));
    await flush();
    expect(api.fetchPersonalValuationHistory).not.toHaveBeenCalled();
    expect(text(render())).toContain("Load canceled");
    click(render(), "Load prices and valuation");
    await flush();
    expect(text(row("AAA"))).toContain("101.5");
  });

  it("selection edits abort immediately and clear results", async () => {
    const wait = deferred<PersonalValuationHistoryDto>();
    api.fetchPersonalValuationHistory.mockImplementationOnce(
      () => wait.promise,
    );
    select("AAA");
    click(render(), "Load prices and valuation");
    await flush();
    select("BBB");
    expect(
      (api.fetchPersonalValuationHistory.mock.calls[0]![1] as AbortSignal)
        .aborted,
    ).toBe(true);
    wait.resolve(valuation("AAA"));
    await flush();
    expect(resultRows()).toHaveLength(0);
    expect(text(render())).toContain("Selection changed");
  });

  it.each(["catalog", "version", "membership", "enabled", "provider"] as const)(
    "retire results and requests when %s changes",
    async (field) => {
      const wait = deferred<PersonalMarketOverviewDto>();
      api.fetchPersonalMarketOverview.mockImplementationOnce(
        () => wait.promise,
      );
      select("AAA");
      click(render(), "Load prices and valuation");
      if (field === "catalog")
        props = { ...props, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` };
      if (field === "version") props = { ...props, watchlistVersion: 3 };
      if (field === "membership")
        props = {
          ...props,
          memberships: props.memberships.map((item) => ({
            ...item,
            note: "changed",
          })),
        };
      if (field === "enabled") props = { ...props, enabled: false };
      if (field === "provider") props = { ...props, providerStatus: null };
      render();
      wait.resolve(overview("AAA"));
      await flush();
      expect(resultRows()).toHaveLength(0);
      expect(api.fetchPersonalValuationHistory).not.toHaveBeenCalled();
      expect(
        (api.fetchPersonalMarketOverview.mock.calls[0]![1] as AbortSignal)
          .aborted,
      ).toBe(true);
    },
  );

  it("rejects A→B→A completion before effects can run", async () => {
    const wait = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview.mockImplementationOnce(() => wait.promise);
    select("AAA");
    click(render(), "Load prices and valuation");
    const original = props;
    props = { ...props, watchlistVersion: 3 };
    render(false);
    props = original;
    render(false);
    wait.resolve(overview("AAA"));
    await flush();
    expect(api.fetchPersonalValuationHistory).not.toHaveBeenCalled();
    expect(resultRows()).toHaveLength(0);
  });

  it("unmount aborts and late completion cannot publish", async () => {
    const wait = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview.mockImplementationOnce(() => wait.promise);
    select("AAA");
    click(render(), "Load prices and valuation");
    harness.unmount();
    const retained = JSON.stringify(harness.states);
    wait.resolve(overview("AAA"));
    await flush();
    expect(JSON.stringify(harness.states)).toBe(retained);
    expect(api.fetchPersonalValuationHistory).not.toHaveBeenCalled();
  });

  it.each(["start", "complete", "response"] as const)(
    "clears all results on session loss at %s",
    async (at) => {
      if (at === "start")
        props = { ...props, onActivityStart: vi.fn(() => undefined) };
      if (at === "complete")
        props = { ...props, onActivityStart: vi.fn(() => () => false) };
      if (at === "response")
        api.fetchPersonalMarketOverview.mockRejectedValueOnce(
          new PersonalWorkspaceApiError("session_unavailable"),
        );
      select("AAA");
      select("BBB");
      click(render(), "Load prices and valuation");
      await flush();
      expect(props.onSessionUnavailable).toHaveBeenCalledTimes(1);
      expect(api.fetchPersonalValuationHistory).not.toHaveBeenCalled();
      expect(resultRows()).toHaveLength(0);
    },
  );

  it("checks the second operation's distinct activity lease", async () => {
    props = {
      ...props,
      onActivityStart: vi
        .fn()
        .mockReturnValueOnce(() => true)
        .mockReturnValueOnce(undefined),
    };
    select("AAA");
    click(render(), "Load prices and valuation");
    await flush();
    expect(props.onActivityStart).toHaveBeenCalledTimes(2);
    expect(api.fetchPersonalValuationHistory).not.toHaveBeenCalled();
    expect(props.onSessionUnavailable).toHaveBeenCalledTimes(1);
  });

  it("filters signed/zero ratios, false dominates unknown, and every result view stays reachable without fetching", async () => {
    props = {
      ...props,
      memberships: [member("AAA"), member("BBB"), member("CCC")],
    };
    api.fetchPersonalValuationHistory.mockImplementation(
      ({ symbol }: { symbol: string }) =>
        Promise.resolve(
          valuation(
            symbol,
            symbol === "AAA" ? "0" : symbol === "BBB" ? "-1" : null,
          ),
        ),
    );
    select("AAA");
    select("BBB");
    select("CCC");
    click(render(), "Load prices and valuation");
    await flush();
    changeAria("P/E minimum", "0");
    expect(text(render())).toContain(
      "3 rows · 1 matches · 1 unknown · 1 nonmatches",
    );
    changeLabel("Show rows", "match");
    expect(resultRows()).toHaveLength(1);
    expect(text(row("AAA"))).toContain("Match");
    changeLabel("Show rows", "unknown");
    expect(resultRows()).toHaveLength(1);
    expect(text(row("CCC"))).toContain("Unknown");
    changeLabel("Show rows", "non_match");
    expect(resultRows()).toHaveLength(1);
    expect(text(row("BBB"))).toContain("Nonmatch");
    changeAria("Price (USD) maximum", "10");
    expect(text(render())).toContain("3 nonmatches");
    changeLabel("Show rows", "all");
    expect(resultRows()).toHaveLength(3);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(3);
    expect(api.fetchPersonalValuationHistory).toHaveBeenCalledTimes(3);
  });

  it("keeps unknown last in descending sort and deterministic identity order for equal values", async () => {
    props = {
      ...props,
      memberships: [member("BBB"), member("AAA"), member("CCC")],
    };
    api.fetchPersonalValuationHistory.mockImplementation(
      ({ symbol }: { symbol: string }) =>
        Promise.resolve(valuation(symbol, symbol === "CCC" ? null : "2")),
    );
    select("BBB");
    select("AAA");
    select("CCC");
    click(render(), "Load prices and valuation");
    await flush();
    changeLabel("Sort by", "priceToEarnings");
    changeLabel("Direction", "desc");
    expect(resultRows().map((item) => text(item).slice(0, 3))).toEqual([
      "AAA",
      "BBB",
      "CCC",
    ]);
  });

  it.each(["1e3", "NaN", "10.2.3"])(
    "retains rows and explains invalid bound %s",
    async (value) => {
      select("AAA");
      click(render(), "Load prices and valuation");
      await flush();
      changeAria("P/E minimum", value);
      expect(text(render())).toContain("Enter valid decimal bounds");
      expect(resultRows()).toHaveLength(1);
      expect(text(row("AAA"))).toContain("Invalid filters");
    },
  );

  it("opens Research with a lifetime guard, retains results, and retires old origins on selection change", async () => {
    select("AAA");
    click(render(), "Load prices and valuation");
    await flush();
    const origin = fakeButton();
    const action = button(render(), "Research AAA");
    (
      action.props.onClick as (event: {
        currentTarget: HTMLButtonElement;
      }) => void
    )({ currentTarget: origin });
    expect(vi.mocked(props.onOpenResearch).mock.calls).toHaveLength(1);
    expect(vi.mocked(props.onOpenResearch).mock.calls[0]!.slice(0, 2)).toEqual([
      member("AAA"),
      origin,
    ]);
    const guard = vi.mocked(props.onOpenResearch).mock.calls[0]![2];
    expect(typeof guard).toBe("function");
    expect(guard()).toBe(true);
    props = {
      ...props,
      memberships: props.memberships.map((item) => ({ ...item })),
    };
    render();
    expect(guard()).toBe(true);
    expect(resultRows()).toHaveLength(1);
    select("BBB");
    expect(guard()).toBe(false);
    (
      action.props.onClick as (event: {
        currentTarget: HTMLButtonElement;
      }) => void
    )({ currentTarget: origin });
    expect(props.onOpenResearch).toHaveBeenCalledTimes(1);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
  });

  it("refuses disconnected or hidden Research origins", async () => {
    select("AAA");
    click(render(), "Load prices and valuation");
    await flush();
    const action = button(render(), "Research AAA");
    for (const origin of [
      fakeButton({ isConnected: false }),
      fakeButton({ closest: () => ({}) }),
      fakeButton({ ownerDocument: { visibilityState: "hidden" } }),
    ])
      (
        action.props.onClick as (event: {
          currentTarget: HTMLButtonElement;
        }) => void
      )({ currentTarget: origin });
    expect(props.onOpenResearch).not.toHaveBeenCalled();
  });

  it("does not load when disabled, unconfigured or memberships duplicate", () => {
    select("AAA");
    props = {
      ...props,
      providerStatus: { ...status(), status: "not_configured" },
    };
    click(render(), "Load prices and valuation");
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    props = {
      ...props,
      providerStatus: status(),
      memberships: [member("AAA"), member("AAA")],
    };
    expect(text(render())).toContain("identities are inconsistent");
    click(render(), "Load prices and valuation");
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
  });
});

function render(effects = true) {
  harness.begin();
  const tree = PersonalPriceValuationScreen(props);
  if (effects) harness.effects();
  return tree;
}
function elements(
  value: unknown,
): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value))
    return value.map(text).join(" ").replace(/\s+/gu, " ");
  if (React.isValidElement<Record<string, unknown>>(value))
    return text(value.props.children);
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
function button(tree: unknown, name: string) {
  const found = elements(tree).find(
    (item) => item.type === "button" && text(item) === name,
  );
  expect(found, name).toBeDefined();
  return found!;
}
function click(tree: unknown, name: string) {
  (button(tree, name).props.onClick as () => void)();
}
function change(
  element: React.ReactElement<Record<string, unknown>>,
  value: string | boolean,
) {
  (
    element.props.onChange as (event: {
      target: { value: string; checked: boolean };
    }) => void
  )({ target: { value: String(value), checked: value === true } });
}
function changeAria(label: string, value: string) {
  change(
    elements(render()).find((item) => item.props["aria-label"] === label)!,
    value,
  );
}
function changeLabel(label: string, value: string) {
  const parent = elements(render()).find(
    (item) => item.type === "label" && text(item).startsWith(label),
  )!;
  change(
    elements(parent).find(
      (item) => item.type === "input" || item.type === "select",
    )!,
    value,
  );
}
function checks(tree: unknown) {
  return elements(tree).filter(
    (item) => item.type === "input" && item.props.type === "checkbox",
  );
}
function select(symbol: string) {
  const tree = render();
  change(
    checks(tree).find(
      (item) => item.props["aria-label"] === `Select ${symbol} · XNAS`,
    )!,
    true,
  );
}
function resultRows() {
  const body = elements(render()).find((item) => item.type === "tbody");
  return elements(body).filter((item) => item.type === "tr");
}
function row(symbol: string) {
  return resultRows().find((item) => text(item).startsWith(`${symbol} ·`));
}
function fakeButton(
  overrides: Record<string, unknown> = {},
): HTMLButtonElement {
  return {
    isConnected: true,
    disabled: false,
    closest: () => null,
    ownerDocument: { visibilityState: "visible" },
    ...overrides,
  } as unknown as HTMLButtonElement;
}
async function flush(count = 32) {
  for (let i = 0; i < count; i += 1) await Promise.resolve();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function member(symbol: string): PersonalWatchlistMembership {
  return {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `iss-${symbol}`,
    issuerName: `${symbol} Company`,
    listingId: `lst-${symbol.toLowerCase()}`,
    note: "private owner note",
    securityId: `sec-${symbol}`,
    securityName: `${symbol} Common Stock`,
    shareClassId: `shr-${symbol}`,
    shareClassName: "Common",
    symbol,
  };
}
function identity(symbol: string) {
  const value = member(symbol);
  return {
    country: value.country,
    exchangeMic: value.exchangeMic,
    issuerName: value.issuerName,
    listingId: value.listingId,
    securityName: value.securityName,
    symbol,
  };
}
function provider(): PersonalMarketOverviewDto["provider"] {
  return {
    attribution: "Tiingo",
    export: "prohibited",
    historyFeed: "tiingo_eod_composite",
    id: "tiingo",
    name: "Tiingo",
    persistence: "none",
    quoteFeed: "tiingo_iex_derived_reference",
    redistribution: "prohibited",
    retention: "active_owner_session_memory_only",
  };
}
function status(): PersonalMarketDataStatusDto {
  return {
    profile: "personal_single_user_local_market_data",
    provider: provider(),
    schemaVersion: "1.0.0",
    status: "configured",
  };
}
function overview(symbol: string): PersonalMarketOverviewDto {
  const prices = {
    close: "101.5",
    high: "102",
    low: "99",
    open: "100",
    volume: "1200000",
  };
  return {
    profile: "personal_single_user_local_market_data",
    provider: provider(),
    schemaVersion: "1.0.0",
    status: "available",
    security: identity(symbol),
    history: {
      bars: [
        {
          date: "2026-09-22",
          adjusted: prices,
          raw: prices,
          dividendCash: "0",
          splitFactor: "1",
        },
      ],
      startDate: "2026-08-22",
      endDate: "2026-09-22",
      range: "1m",
    },
    quote: {
      change: "1.5",
      changePercent: "1.5",
      currency: "USD",
      freshness: "current",
      ingestedAt: "2026-09-22T21:01:00.000Z",
      kind: "derived_realtime_reference",
      previousClose: "100",
      price: "101.5",
      sourceTime: "2026-09-22T21:00:00.000Z",
    },
  };
}
function ratio(value: string | null) {
  return value === null
    ? unknownRatio()
    : { status: "known" as const, unit: "ratio" as const, value };
}
function unknownRatio() {
  return {
    status: "unknown" as const,
    unit: "ratio" as const,
    value: null,
    reason: "not_supplied_by_provider" as const,
  };
}
function valuation(
  symbol: string,
  pe: string | null = "15",
): PersonalValuationHistoryDto {
  const point = {
    date: "2026-09-22",
    priceToEarnings: ratio(pe),
    priceToBook: ratio("2"),
    trailingPeg1Y: ratio("1"),
    enterpriseValue: {
      status: "known" as const,
      unit: "USD" as const,
      value: "1000",
    },
    marketCapitalization: {
      status: "known" as const,
      unit: "USD" as const,
      value: "900",
    },
  };
  return {
    asOf: "2026-09-23T12:00:00.000Z",
    coverage: {
      knownCells: pe === null ? 4 : 5,
      observationCount: 1,
      status: pe === null ? "partial" : "complete",
      unknownCells: pe === null ? 1 : 0,
    },
    history: {
      endDate: point.date,
      latestPoint: point,
      points: [point],
      range: "1m",
      startDate: "2026-08-22",
    },
    profile: "personal_single_user_local_valuation",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      valuationFeed: "tiingo_fundamentals_daily",
      valueCurrency: "USD",
    },
    schemaVersion: "1.0.0",
    security: identity(symbol),
    status: "available",
  };
}
