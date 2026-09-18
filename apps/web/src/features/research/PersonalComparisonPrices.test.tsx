import type {
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
  PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const states: unknown[] = [],
    refs: Array<{ current: unknown }> = [];
  const dependencies: Array<readonly unknown[] | undefined> = [];
  const memos: Array<{ deps: readonly unknown[]; value: unknown }> = [];
  const cleanup = new Map<number, () => void>();
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
const api = vi.hoisted(() => ({ fetchPersonalMarketOverview: vi.fn() }));
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
vi.mock("@/lib/personal-workspace-api", async () => ({
  ...(await import("../../lib/personal-workspace-api")),
  ...api,
}));
import { PersonalWorkspaceApiError } from "@/lib/personal-workspace-api";
import { PersonalComparisonPriceChart } from "./PersonalComparisonPriceChart";
import {
  PersonalComparisonPrices,
  type PersonalComparisonPricesProps,
} from "./PersonalComparisonPrices";

let props: PersonalComparisonPricesProps;
const complete = vi.fn<() => boolean>();
beforeEach(() => {
  harness.reset();
  api.fetchPersonalMarketOverview.mockReset();
  complete.mockReset().mockReturnValue(true);
  props = {
    contextKey: "snapshot-1",
    listings: [listing("AAA"), listing("BBB")],
    enabled: true,
    providerStatus: status(),
    onActivityStart: vi.fn(() => complete),
    onSessionUnavailable: vi.fn(),
  };
  api.fetchPersonalMarketOverview.mockImplementation(
    ({ symbol }: { symbol: string }) => Promise.resolve(overview(symbol)),
  );
});
afterEach(() => harness.unmount());

describe("PersonalComparisonPrices", () => {
  it("retains the chart aggregate across display-only rerenders and clears it on range change", async () => {
    api.fetchPersonalMarketOverview.mockImplementation(
      ({ symbol }: { symbol: string }) =>
        Promise.resolve(
          history(symbol, [
            ["2030-01-02", "100"],
            ["2030-01-03", "110"],
          ]),
        ),
    );
    click(render());
    await flush();
    const first = elements(render()).find(
      (element) => element.type === PersonalComparisonPriceChart,
    )?.props.result;
    expect(first).toBeDefined();
    props = {
      ...props,
      listings: props.listings.map((item) => ({ ...item })),
      providerStatus: status(),
    };
    const second = elements(render()).find(
      (element) => element.type === PersonalComparisonPriceChart,
    )?.props.result;
    expect(second).toBe(first);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
    changeRange(render(), "3m");
    expect(
      elements(render()).some(
        (element) => element.type === PersonalComparisonPriceChart,
      ),
    ).toBe(false);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
  });

  it("loads only after a click, sequentially, and retains only history close fields", async () => {
    props = { ...props, listings: [...props.listings, listing("CCC")] };
    const pending = [
      deferred<PersonalMarketOverviewDto>(),
      deferred<PersonalMarketOverviewDto>(),
      deferred<PersonalMarketOverviewDto>(),
    ];
    pending.forEach((item) =>
      api.fetchPersonalMarketOverview.mockImplementationOnce(
        () => item.promise,
      ),
    );
    const initial = render();
    render();
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    click(initial);
    click(initial);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    expect(api.fetchPersonalMarketOverview).toHaveBeenLastCalledWith(
      { listingId: "lst-aaa", symbol: "AAA", range: "1m" },
      expect.any(AbortSignal),
    );
    expect(card("AAA")).toContain("Loading price…");
    expect(card("BBB")).toContain("Waiting for the previous company.");
    pending[0]!.resolve(overview("AAA"));
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
    expect(card("AAA")).toContain("101.50 USD");
    expect(card("CCC")).toContain("Waiting");
    pending[1]!.resolve(overview("BBB"));
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(3);
    pending[2]!.resolve(overview("CCC"));
    await flush();
    expect(props.onActivityStart).toHaveBeenCalledTimes(3);
    expect(complete).toHaveBeenCalledTimes(3);
    expect(button(render()).props.disabled).toBe(false);
    const retained = JSON.stringify(harness.states);
    expect(retained).toContain('"bars"');
    expect(retained).toContain('"adjusted":{"close":"101.50"}');
    for (const field of [
      "open",
      "high",
      "low",
      "volume",
      "dividendCash",
      "splitFactor",
    ])
      expect(retained).not.toContain(`"${field}"`);
    const displayed = text(render());
    expect(displayed).toContain("Derived reference price");
    expect(displayed).toContain("Loaded at");
    expect(displayed).toContain("Freshness when loaded");
    expect(displayed).toContain("UTC");
  });

  it("waits for the complete batch and compares shared adjusted closes independently of quotes", async () => {
    const pending = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview
      .mockResolvedValueOnce(
        history("AAA", [
          ["2030-01-02", "40"],
          ["2030-01-03", "50"],
          ["2030-01-04", "60"],
        ]),
      )
      .mockImplementationOnce(() => pending.promise);
    click(render());
    await flush();
    expect(card("AAA")).toContain("101.50 USD");
    expect(performance()).toContain(
      "Waiting for every selected company's history",
    );
    expect(elements(render()).some((element) => element.type === "table")).toBe(
      false,
    );
    pending.resolve(
      history("BBB", [
        ["2030-01-02", "100"],
        ["2030-01-04", "90"],
        ["2030-01-05", "500"],
      ]),
    );
    await flush();
    const displayed = performance();
    expect(displayed).toContain(
      "Shared window: 2030-01-02 to 2030-01-04 · 2 shared observations",
    );
    expect(displayed).toContain("50.0000%");
    expect(displayed).toContain("-10.0000%");
    expect(displayed).toContain("Latest history bar 2030-01-05");
    expect(displayed).toContain("First history bar 2030-01-02");
    expect(displayed).toContain("Observed bars 3");
    expect(displayed).toContain(
      "not an independently reconstructed total return",
    );
    expect(displayed).toContain(
      "quote freshness does not establish history freshness",
    );
    const rows = elements(render()).filter((element) => element.type === "tr");
    expect(text(rows[1])).toMatch(/1\s*$/u);
    expect(text(rows[2])).toMatch(/1\s*$/u);
    const headers = elements(render()).filter(
      (element) => element.type === "th",
    );
    expect(
      headers.every((element) =>
        ["col", "row"].includes(element.props.scope as string),
      ),
    ).toBe(true);
    expect(
      elements(render()).some((element) => element.type === "caption"),
    ).toBe(true);
    expect(
      elements(render()).find((element) => element.props.role === "region")
        ?.props.tabIndex,
    ).toBe(0);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
  });

  it.each([0, 1])(
    "shows no changes with %s shared dates and keeps coverage visible",
    async (count) => {
      api.fetchPersonalMarketOverview
        .mockResolvedValueOnce(
          history("AAA", [
            ["2030-01-02", "40"],
            ["2030-01-03", "50"],
          ]),
        )
        .mockResolvedValueOnce(
          history("BBB", [
            [count === 0 ? "2030-01-04" : "2030-01-03", "100"],
            ["2030-01-05", "90"],
          ]),
        );
      click(render());
      await flush();
      const displayed = performance();
      expect(displayed).toContain(
        "at least 2 dates observed for every selected company are required",
      );
      expect(displayed).toContain(`${count} shared observations loaded`);
      expect(displayed).toContain("Loaded history coverage");
      expect(displayed).not.toContain("Adjusted-price change");
      expect(displayed).not.toContain("Shared window:");
      expect(card("AAA")).toContain("101.50 USD");
    },
  );

  it.each(["1m", "3m", "1y"] as const)(
    "requests the selected %s range only on explicit load",
    async (range) => {
      changeRange(render(), range);
      render();
      expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
      api.fetchPersonalMarketOverview.mockImplementation(
        ({ symbol }: { symbol: string }) => {
          const result = overview(symbol);
          return Promise.resolve({
            ...result,
            history: { ...result.history, range },
          });
        },
      );
      click(render());
      await flush();
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
      expect(api.fetchPersonalMarketOverview).toHaveBeenLastCalledWith(
        { listingId: "lst-bbb", symbol: "BBB", range },
        expect.any(AbortSignal),
      );
      expect(card("BBB")).toContain("101.50 USD");
    },
  );

  it("range changes clear loaded prices and history without persisting or fetching", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    vi.stubGlobal("sessionStorage", { setItem });
    try {
      api.fetchPersonalMarketOverview.mockImplementation(
        ({ symbol }: { symbol: string }) =>
          Promise.resolve(
            history(symbol, [
              ["2030-01-02", "40"],
              ["2030-01-03", "50"],
            ]),
          ),
      );
      click(render());
      await flush();
      expect(performance()).toContain("Shared window:");
      changeRange(render(), "3m");
      render();
      expect(card("AAA")).toContain("Price not loaded.");
      expect(performance()).toContain("Performance not loaded.");
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
      expect(setItem).not.toHaveBeenCalled();
      expect(JSON.stringify(harness.states)).not.toContain('"bars"');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects stale range results and obsolete clicks after 1m→3m→1m", async () => {
    const pending = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview.mockImplementationOnce(
      () => pending.promise,
    );
    const old = render();
    click(old);
    const signal = api.fetchPersonalMarketOverview.mock
      .calls[0]![1] as AbortSignal;
    changeRange(render(), "3m");
    expect(signal.aborted).toBe(true);
    render();
    changeRange(render(), "1m");
    render();
    click(old);
    pending.resolve(overview("AAA"));
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    expect(card("AAA")).toContain("Price not loaded.");
    click(render());
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(3);
    expect(card("BBB")).toContain("101.50 USD");
  });

  it("rejects a response for a different requested range", async () => {
    const result = overview("AAA");
    api.fetchPersonalMarketOverview.mockResolvedValueOnce({
      ...result,
      history: { ...result.history, range: "3m" },
    });
    click(render());
    await flush();
    expect(card("AAA")).toContain("did not match");
    expect(card("BBB")).toContain("101.50 USD");
    expect(performance()).toContain("No subset was compared.");
  });

  it("does not compare two successful members when the third selected member failed", async () => {
    props = { ...props, listings: [...props.listings, listing("CCC")] };
    api.fetchPersonalMarketOverview
      .mockResolvedValueOnce(
        history("AAA", [
          ["2030-01-02", "40"],
          ["2030-01-03", "50"],
        ]),
      )
      .mockRejectedValueOnce(new PersonalWorkspaceApiError("not_covered"))
      .mockResolvedValueOnce(
        history("CCC", [
          ["2030-01-02", "100"],
          ["2030-01-03", "90"],
        ]),
      );
    click(render());
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(3);
    expect(card("AAA")).toContain("101.50 USD");
    expect(card("CCC")).toContain("101.50 USD");
    expect(performance()).toContain("No subset was compared.");
    expect(performance()).not.toContain("Shared window:");
    expect(elements(render()).some((element) => element.type === "table")).toBe(
      false,
    );
  });

  it("fails closed when projected histories cannot support the comparison", async () => {
    api.fetchPersonalMarketOverview
      .mockResolvedValueOnce(
        history("AAA", [
          ["2030-01-02", "0"],
          ["2030-01-03", "50"],
        ]),
      )
      .mockResolvedValueOnce(
        history("BBB", [
          ["2030-01-02", "100"],
          ["2030-01-03", "90"],
        ]),
      );
    click(render());
    await flush();
    expect(card("AAA")).toContain("101.50 USD");
    expect(performance()).toContain(
      "the loaded histories could not be compared",
    );
    expect(performance()).not.toContain("Shared window:");
    expect(elements(render()).some((element) => element.type === "table")).toBe(
      false,
    );
  });

  it.each(["unavailable", "not_covered", "invalid_response"] as const)(
    "keeps other companies independent after %s",
    async (code) => {
      api.fetchPersonalMarketOverview.mockRejectedValueOnce(
        new PersonalWorkspaceApiError(code),
      );
      click(render());
      await flush();
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
      expect(card("AAA")).not.toContain("101.50 USD");
      expect(card("BBB")).toContain("101.50 USD");
      expect(props.onSessionUnavailable).not.toHaveBeenCalled();
      expect(performance()).toContain("No subset was compared.");
    },
  );

  it.each([
    "credentials_invalid",
    "not_entitled",
    "not_configured",
    "rate_limited",
  ] as const)(
    "stops the remaining batch after %s and preserves earlier success",
    async (code) => {
      props = { ...props, listings: [...props.listings, listing("CCC")] };
      api.fetchPersonalMarketOverview
        .mockResolvedValueOnce(overview("AAA"))
        .mockRejectedValueOnce(new PersonalWorkspaceApiError(code));
      click(render());
      await flush();
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
      expect(card("AAA")).toContain("101.50 USD");
      expect(card("CCC")).toContain(
        "Not requested because the price load stopped.",
      );
      expect(props.onSessionUnavailable).not.toHaveBeenCalled();
    },
  );

  it.each(["undefined-start", "expired-completion", "session-error"])(
    "clears all price context on %s",
    async (mode) => {
      if (mode === "undefined-start")
        props = { ...props, onActivityStart: vi.fn(() => undefined) };
      if (mode === "expired-completion") complete.mockReturnValue(false);
      if (mode === "session-error")
        api.fetchPersonalMarketOverview.mockRejectedValueOnce(
          new PersonalWorkspaceApiError("session_unavailable"),
        );
      click(render());
      await flush();
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(
        mode === "undefined-start" ? 0 : 1,
      );
      expect(props.onSessionUnavailable).toHaveBeenCalledOnce();
      expect(text(render())).not.toContain("101.50 USD");
      expect(card("BBB")).toContain("Price not loaded.");
    },
  );

  it.each(["membership", "snapshot", "disabled", "status", "unmount"])(
    "aborts and rejects late results after %s changes",
    async (change) => {
      const pending = deferred<PersonalMarketOverviewDto>();
      api.fetchPersonalMarketOverview.mockImplementationOnce(
        () => pending.promise,
      );
      click(render());
      const signal = api.fetchPersonalMarketOverview.mock
        .calls[0]![1] as AbortSignal;
      if (change === "membership")
        props = { ...props, listings: [listing("AAA"), listing("CCC")] };
      if (change === "snapshot") props = { ...props, contextKey: "snapshot-2" };
      if (change === "disabled") props = { ...props, enabled: false };
      if (change === "status")
        props = {
          ...props,
          providerStatus: { ...status(), status: "not_configured" },
        };
      if (change === "unmount") harness.unmount();
      else render();
      expect(signal.aborted).toBe(true);
      pending.resolve(overview("AAA"));
      await flush();
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
      expect(complete).not.toHaveBeenCalled();
      expect(props.onSessionUnavailable).not.toHaveBeenCalled();
      if (change !== "unmount")
        expect(text(render())).not.toContain("101.50 USD");
    },
  );

  it("rejects an obsolete click after A→B→A, while the new context can load", async () => {
    const old = render();
    props = { ...props, listings: [listing("AAA"), listing("CCC")] };
    render();
    props = { ...props, listings: [listing("AAA"), listing("BBB")] };
    render();
    click(old);
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    click(render());
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
  });

  it("preserves observations for equivalent membership and status values", async () => {
    click(render());
    await flush();
    props = {
      ...props,
      listings: props.listings.map((row) => ({ ...row })),
      providerStatus: structuredClone(status()),
    };
    render();
    expect(card("AAA")).toContain("101.50 USD");
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
    props = { ...props, providerStatus: null };
    render();
    expect(card("AAA")).toContain("Price not loaded.");
    props = { ...props, providerStatus: status() };
    render();
    expect(card("AAA")).toContain("Price not loaded.");
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
  });

  it.each([
    "none",
    "unconfigured",
    "disabled",
    "one",
    "four",
    "duplicate-listing",
    "duplicate-issuer",
  ])("does not load when eligibility is %s", (mode) => {
    if (mode === "none") props = { ...props, providerStatus: null };
    if (mode === "unconfigured")
      props = {
        ...props,
        providerStatus: { ...status(), status: "not_configured" },
      };
    if (mode === "disabled") props = { ...props, enabled: false };
    if (mode === "one") props = { ...props, listings: [listing("AAA")] };
    if (mode === "four")
      props = {
        ...props,
        listings: [
          listing("AAA"),
          listing("BBB"),
          listing("CCC"),
          listing("DDD"),
        ],
      };
    if (mode === "duplicate-listing")
      props = { ...props, listings: [listing("AAA"), listing("AAA")] };
    if (mode === "duplicate-issuer")
      props = {
        ...props,
        listings: [
          listing("AAA"),
          { ...listing("BBB"), issuerId: listing("AAA").issuerId },
        ],
      };
    const view = render();
    expect(button(view).props.disabled).toBe(true);
    click(view);
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
  });

  it.each([
    "country",
    "exchangeMic",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
  ] as const)(
    "rejects a mismatched %s without attaching it to another company",
    async (field) => {
      const result = overview("AAA");
      api.fetchPersonalMarketOverview.mockResolvedValueOnce({
        ...result,
        security: { ...result.security, [field]: "WRONG" },
      });
      click(render());
      await flush();
      expect(card("AAA")).toContain("did not match");
      expect(card("BBB")).toContain("101.50 USD");
    },
  );

  it("labels stale EOD on an early-close date with its assumed regular-session time", async () => {
    api.fetchPersonalMarketOverview.mockResolvedValueOnce(
      eod("AAA", "2030-11-29", "2030-11-29T21:00:00.000Z"),
    );
    click(render());
    await flush();
    const displayed = card("AAA");
    expect(displayed).toContain("End-of-day close");
    expect(displayed).toContain("2030-11-29");
    expect(displayed).toContain("Older than 36 hours");
    expect(displayed).toContain("Assumed regular-session close");
    expect(displayed).toContain("Early closes are not modeled");
  });

  it.each(["date", "close", "empty", "hour"])(
    "rejects inconsistent EOD %s evidence",
    async (mismatch) => {
      const result = eod("AAA", "2030-11-29", "2030-11-29T21:00:00.000Z");
      api.fetchPersonalMarketOverview.mockResolvedValueOnce({
        ...result,
        quote: {
          ...result.quote,
          ...(mismatch === "date"
            ? { sourceTime: "2030-11-28T21:00:00.000Z" }
            : mismatch === "close"
              ? { price: "102.50" }
              : mismatch === "hour"
                ? { sourceTime: "2030-11-29T18:00:00.000Z" }
                : {}),
        },
        history: {
          ...result.history,
          bars: mismatch === "empty" ? [] : result.history.bars,
        },
      });
      click(render());
      await flush();
      expect(card("AAA")).toContain("did not match");
      expect(card("BBB")).toContain("101.50 USD");
    },
  );
});

function render() {
  harness.begin();
  const view = PersonalComparisonPrices(props);
  harness.effects();
  return view;
}
async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function elements(
  value: unknown,
): Array<React.ReactElement<Record<string, unknown>>> {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement(value)) return [];
  const element = value as React.ReactElement<Record<string, unknown>>;
  return [
    element,
    ...elements(
      typeof element.type === "function"
        ? (Reflect.apply(element.type, undefined, [element.props]) as unknown)
        : element.props.children,
    ),
  ];
}
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (!React.isValidElement(value)) return "";
  const element = value as React.ReactElement<Record<string, unknown>>;
  return text(
    typeof element.type === "function"
      ? (Reflect.apply(element.type, undefined, [element.props]) as unknown)
      : element.props.children,
  ).replace(/\s+/gu, " ");
}
function button(value: unknown) {
  return elements(value).find((element) => element.type === "button")!;
}
function click(value: unknown) {
  (button(value).props.onClick as () => void)();
}
function changeRange(value: unknown, range: string) {
  const selector = elements(value).find(
    (element) => element.type === "select",
  )!;
  (selector.props.onChange as (event: { target: { value: string } }) => void)({
    target: { value: range },
  });
}
function performance() {
  return text(
    elements(render()).find(
      (element) =>
        element.props["aria-labelledby"] === "comparison-performance-title",
    ),
  );
}
function card(symbol: string) {
  return text(
    elements(render()).find(
      (element) => element.props["aria-label"] === `${symbol} price context`,
    ),
  );
}
function listing(symbol: string): PersonalSecurityMasterScreenRowDto {
  return {
    country: "US",
    cik: symbol === "AAA" ? "0000000001" : "0000000002",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `iss-${symbol}`,
    issuerName: `${symbol} Company`,
    listingId: `lst-${symbol.toLowerCase()}`,
    securityId: `sec-${symbol}`,
    securityName: `${symbol} Common Stock`,
    shareClassId: `shr-${symbol}`,
    shareClassName: "Common",
    symbol,
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
function overview(symbol: string): PersonalMarketOverviewDto {
  const { country, exchangeMic, issuerName, listingId, securityName } =
    listing(symbol);
  return {
    profile: "personal_single_user_local_market_data",
    provider: provider(),
    schemaVersion: "1.0.0",
    status: "available",
    security: {
      country,
      exchangeMic,
      issuerName,
      listingId,
      securityName,
      symbol,
    },
    history: {
      bars: [bar("2030-01-15")],
      startDate: "2030-01-15",
      endDate: "2030-01-15",
      range: "1m",
    },
    quote: {
      change: "1.50",
      changePercent: "1.50",
      currency: "USD",
      freshness: "current",
      ingestedAt: "2030-01-15T21:01:00.000Z",
      kind: "derived_realtime_reference",
      previousClose: "100.00",
      price: "101.50",
      sourceTime: "2030-01-15T21:00:00.000Z",
    },
  };
}
function eod(
  symbol: string,
  date: string,
  sourceTime: string,
): PersonalMarketOverviewDto {
  const result = overview(symbol);
  return {
    ...result,
    quote: {
      ...result.quote,
      kind: "end_of_day_close",
      freshness: "older_than_36_hours",
      sourceTime,
      ingestedAt: "2030-12-02T21:01:00.000Z",
    },
    history: {
      ...result.history,
      startDate: date,
      endDate: date,
      bars: [bar(date)],
    },
  };
}
function history(
  symbol: string,
  observations: readonly (readonly [string, string])[],
): PersonalMarketOverviewDto {
  const result = overview(symbol);
  return {
    ...result,
    history: {
      range: "1m",
      startDate: "2030-01-01",
      endDate: "2030-01-15",
      bars: observations.map(([date, adjustedClose]) => {
        const item = bar(date);
        return {
          ...item,
          adjusted: { ...item.adjusted, close: adjustedClose },
        };
      }),
    },
  };
}
function bar(
  date: string,
): PersonalMarketOverviewDto["history"]["bars"][number] {
  const prices = {
    close: "101.50",
    high: "102.00",
    low: "99.00",
    open: "100.00",
    volume: "1200000",
  };
  return {
    date,
    adjusted: prices,
    raw: prices,
    dividendCash: "0",
    splitFactor: "1",
  };
}
