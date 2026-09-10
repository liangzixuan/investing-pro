import type {
  PersonalMarketDataDailyBarDto,
  PersonalMarketOverviewDto,
  PersonalPortfolioIdentity,
  PersonalPortfolioLedgerPayloadV3,
} from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "@/lib/personal-workspace-api";
import {
  PersonalPortfolioHistoryCoverage,
  type PersonalPortfolioHistoryCoverageProps,
} from "./PersonalPortfolioHistoryCoverage";

const api = vi.hoisted(() => ({
  fetchPersonalMarketOverview: vi.fn(),
  searchPersonalSecurities: vi.fn(),
  savePersonalPortfolio: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => harness.useState(initial),
  useRef: <T,>(initial: T) => harness.useRef(initial),
  useEffect: (
    effect: () => (() => void) | void,
    deps: readonly unknown[] | undefined,
  ) => harness.useEffect(effect, deps),
}));
vi.mock("@/lib/personal-workspace-api", async () => ({
  ...(await import("../../lib/personal-workspace-api")),
  fetchPersonalMarketOverview: api.fetchPersonalMarketOverview,
  searchPersonalSecurities: api.searchPersonalSecurities,
}));
vi.mock("@/lib/personal-portfolio-api", () => ({
  savePersonalPortfolio: api.savePersonalPortfolio,
}));
vi.mock(
  "@/lib/personal-portfolio-history",
  () => import("../../lib/personal-portfolio-history"),
);

let props: PersonalPortfolioHistoryCoverageProps;
beforeEach(() => {
  harness.reset();
  api.savePersonalPortfolio.mockReset();
  api.searchPersonalSecurities
    .mockReset()
    .mockImplementation((symbol: string) =>
      Promise.resolve(
        search(
          props.ledger.identities.filter((entry) => entry.symbol === symbol),
        ),
      ),
    );
  api.fetchPersonalMarketOverview
    .mockReset()
    .mockImplementation((input: { listingId: string }) =>
      Promise.resolve(
        market(
          props.ledger.identities.findIndex(
            (entry) => entry.listingId === input.listingId,
          ),
        ),
      ),
    );
  props = {
    ledger: ledger(),
    catalogSnapshotSha256: digest("a"),
    ledgerContext: "saved-ledger-v3-context",
    disabled: false,
    onSessionUnavailable: vi.fn(),
    onAssessment: vi.fn(),
  };
});
afterEach(() => {
  harness.unmount();
  vi.unstubAllGlobals();
});

describe("PersonalPortfolioHistoryCoverage", () => {
  it("waits for demand, displays observed coverage and matching terms, and never changes or saves the ledger", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    vi.stubGlobal("sessionStorage", { setItem });
    const before = JSON.stringify(props.ledger);
    await mount();
    expect(api.searchPersonalSecurities).not.toHaveBeenCalled();
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    click(render(), "Review history");
    await flush();
    expect(api.searchPersonalSecurities).toHaveBeenCalledWith(
      "ONE",
      expect.any(AbortSignal),
      25,
    );
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledWith(
      { listingId: "listing-one", symbol: "ONE", range: "1y" },
      expect.any(AbortSignal),
    );
    expect(text(render())).toContain("3 daily observations");
    expect(text(render())).toMatch(/Opening date 2026-01-01\s*:\s*observed/u);
    expect(text(render())).toContain("Activity dates observed: 1 of 1");
    expect(text(render())).toContain("Recorded ratio matches");
    expect(text(render())).toContain("Dividend observation only");
    expect(props.onAssessment).toHaveBeenCalledWith(
      props.ledgerContext,
      "listing-one",
      false,
      expect.objectContaining({
        observedDates: ["2026-01-01", "2026-01-03", "2026-01-04"],
        splitReviewDates: [],
        requiresSplitReview: false,
      }),
    );
    expect(api.savePersonalPortfolio).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.stringify(props.ledger)).toBe(before);
  });

  it("requests registered identities sequentially, including closed and currently empty positions", async () => {
    props = { ...props, ledger: ledger(3) };
    const pending = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview.mockReturnValueOnce(pending.promise);
    await mount();
    click(render(), "Review history");
    await flush();
    expect(api.searchPersonalSecurities).toHaveBeenCalledTimes(1);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    expect(button(render(), "Review history").props.disabled).toBe(true);
    expect(input(render()).props.disabled).toBe(true);
    pending.resolve(market());
    await flush();
    expect(
      api.searchPersonalSecurities.mock.calls.map((call) => String(call[0])),
    ).toEqual(["ONE", "TWO", "THREE"]);
    expect(
      api.fetchPersonalMarketOverview.mock.calls.map(
        (call): unknown => call[0],
      ),
    ).toEqual([
      { listingId: "listing-one", symbol: "ONE", range: "1y" },
      { listingId: "listing-two", symbol: "TWO", range: "1y" },
      { listingId: "listing-three", symbol: "THREE", range: "1y" },
    ]);
    expect(props.onAssessment).toHaveBeenCalledTimes(3);
    expect(text(render())).toContain("No prior-day shares recorded");
    expect(text(render())).toContain("History review finished");
  });

  it.each([
    "country",
    "exchangeMic",
    "instrumentType",
    "issuerId",
    "issuerName",
    "listingId",
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "symbol",
  ] as const)(
    "requires exact admitted identity field %s before provider loading",
    async (field) => {
      api.searchPersonalSecurities.mockResolvedValue(
        search([{ ...identity(), [field]: "changed" }]),
      );
      await review();
      expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
      expect(props.onAssessment).not.toHaveBeenCalled();
      expect(text(render())).toContain("Historical identity is unavailable");
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
    "rejects mismatched normalized provider identity field %s",
    async (field) => {
      const value = market();
      api.fetchPersonalMarketOverview.mockResolvedValue({
        ...value,
        security: { ...value.security, [field]: "changed" },
      });
      await review();
      expect(props.onAssessment).not.toHaveBeenCalled();
      expect(text(render())).toContain("History unavailable for this listing");
      expect(text(render())).not.toContain("Recorded ratio matches");
    },
  );

  it("requires a current portfolio snapshot and stops on a changed search snapshot", async () => {
    props = { ...props, ledger: { ...ledger(), snapshotSha256: digest("b") } };
    await mount();
    expect(button(render(), "Review history").props.disabled).toBe(true);
    expect(text(render())).toContain("Reconcile");
    expect(api.searchPersonalSecurities).not.toHaveBeenCalled();
    props = { ...props, ledger: ledger(2), ledgerContext: "reconciled-ledger" };
    render();
    api.searchPersonalSecurities.mockResolvedValue({
      ...search([identity()]),
      snapshot: { snapshotSha256: digest("b") },
    });
    click(render(), "Review history");
    await flush();
    expect(api.searchPersonalSecurities).toHaveBeenCalledTimes(1);
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(props.onAssessment).not.toHaveBeenCalled();
    expect(text(render())).toContain("Catalog changed");
  });

  it.each([
    "rate_limited",
    "not_configured",
    "credentials_invalid",
    "not_entitled",
  ] as const)(
    "stops the batch after %s without clearing successful prior assessments",
    async (code) => {
      props = { ...props, ledger: ledger(3) };
      api.fetchPersonalMarketOverview
        .mockResolvedValueOnce(market())
        .mockRejectedValueOnce(new PersonalWorkspaceApiError(code));
      await review();
      expect(api.searchPersonalSecurities).toHaveBeenCalledTimes(2);
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
      expect(props.onAssessment).toHaveBeenCalledTimes(1);
      expect(text(render())).toContain("Remaining listings were not requested");
      expect(text(render())).toContain("Recorded ratio matches");
      expect(button(render(), "Review history").props.disabled).toBe(false);
    },
  );

  it("continues after one unavailable listing and only reports valid assessments", async () => {
    props = { ...props, ledger: ledger(2) };
    api.fetchPersonalMarketOverview.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("not_covered"),
    );
    await review();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
    expect(props.onAssessment).toHaveBeenCalledTimes(1);
    expect(props.onAssessment).toHaveBeenCalledWith(
      props.ledgerContext,
      "listing-two",
      false,
      expect.objectContaining({ listingId: "listing-two" }),
    );
    expect(text(render())).toContain("History unavailable for this listing");
    expect(text(render())).toContain("TWO · XNYS");
  });

  it("rejects invalid history without sending a clearing assessment", async () => {
    const value = market();
    api.fetchPersonalMarketOverview.mockResolvedValue({
      ...value,
      history: { ...value.history, bars: [bar("2026-01-03", "0")] },
    });
    await review();
    expect(props.onAssessment).not.toHaveBeenCalled();
    expect(text(render())).toContain("History unavailable");
  });

  it("reports observed split discrepancies and distinguishes an unobserved recorded date", async () => {
    const value = market();
    api.fetchPersonalMarketOverview.mockResolvedValueOnce({
      ...value,
      history: {
        ...value.history,
        bars: [bar("2026-01-01"), bar("2026-01-03", "3")],
      },
    });
    await review();
    expect(text(render())).toContain("Review differing ratios");
    expect(props.onAssessment).toHaveBeenLastCalledWith(
      props.ledgerContext,
      "listing-one",
      true,
      expect.objectContaining({
        observedDates: ["2026-01-01", "2026-01-03"],
        splitReviewDates: ["2026-01-03"],
      }),
    );
    api.fetchPersonalMarketOverview.mockResolvedValueOnce({
      ...value,
      history: { ...value.history, bars: [bar("2026-01-04")] },
    });
    click(render(), "Review history");
    await flush();
    expect(text(render())).toContain("No exact-date observation");
    expect(props.onAssessment).toHaveBeenLastCalledWith(
      props.ledgerContext,
      "listing-one",
      false,
      expect.objectContaining({
        observedDates: ["2026-01-04"],
        splitReviewDates: [],
      }),
    );
  });

  it.each(["ledger", "catalog", "disabled", "unmount"] as const)(
    "aborts and rejects late provider results after %s changes",
    async (kind) => {
      const pending = deferred<PersonalMarketOverviewDto>();
      api.fetchPersonalMarketOverview.mockReturnValueOnce(pending.promise);
      await mount();
      click(render(), "Review history");
      await flush();
      const signal = api.fetchPersonalMarketOverview.mock
        .calls[0]?.[1] as AbortSignal;
      if (kind === "ledger")
        props = { ...props, ledgerContext: "new-ledger-context" };
      if (kind === "catalog")
        props = { ...props, catalogSnapshotSha256: digest("b") };
      if (kind === "disabled") props = { ...props, disabled: true };
      if (kind === "unmount") harness.unmount();
      else render();
      expect(signal.aborted).toBe(true);
      pending.resolve(market());
      await flush();
      expect(props.onAssessment).not.toHaveBeenCalled();
      if (kind !== "unmount")
        expect(text(render())).not.toContain("Recorded ratio matches");
    },
  );

  it("rejects late catalog results after cancellation before any provider request", async () => {
    const pending = deferred<ReturnType<typeof search>>();
    api.searchPersonalSecurities.mockReturnValueOnce(pending.promise);
    await mount();
    click(render(), "Review history");
    const signal = api.searchPersonalSecurities.mock
      .calls[0]?.[1] as AbortSignal;
    click(render(), "Cancel history review");
    expect(signal.aborted).toBe(true);
    pending.resolve(search([identity()]));
    await flush();
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(props.onAssessment).not.toHaveBeenCalled();
    expect(text(render())).toContain("History review cancelled");
  });

  it("keeps completed observations on cancellation and ignores the outstanding listing", async () => {
    props = { ...props, ledger: ledger(2) };
    const pending = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview
      .mockResolvedValueOnce(market())
      .mockReturnValueOnce(pending.promise);
    await mount();
    click(render(), "Review history");
    await flush();
    expect(text(render())).toContain("Recorded ratio matches");
    click(render(), "Cancel history review");
    pending.resolve(market(1));
    await flush();
    expect(props.onAssessment).toHaveBeenCalledTimes(1);
    expect(text(render())).toContain("Recorded ratio matches");
    expect(text(render())).not.toContain("TWO · XNYS");
  });

  it("clears session observations on authorization loss and does not continue the batch", async () => {
    props = { ...props, ledger: ledger(3) };
    api.fetchPersonalMarketOverview
      .mockResolvedValueOnce(market())
      .mockRejectedValueOnce(
        new PersonalWorkspaceApiError("session_unavailable"),
      );
    await review();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
    expect(props.onSessionUnavailable).toHaveBeenCalledOnce();
    expect(props.onAssessment).toHaveBeenCalledTimes(1);
    expect(text(render())).not.toContain("Recorded ratio matches");
    expect(text(render())).toContain("Owner session expired");
    const signal = api.fetchPersonalMarketOverview.mock
      .calls[1]?.[1] as AbortSignal;
    expect(signal.aborted).toBe(true);
    props = { ...props, disabled: true };
    render();
    props = { ...props, disabled: false };
    render();
    expect(text(render())).not.toContain("Recorded ratio matches");
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
  });

  it("clears completed observations on range, ledger or disabled changes without automatic reload", async () => {
    await review();
    changeRange("1m");
    render();
    expect(text(render())).not.toContain("Recorded ratio matches");
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    click(render(), "Review history");
    await flush();
    expect(api.fetchPersonalMarketOverview.mock.calls[1]?.[0]).toMatchObject({
      range: "1m",
    });
    props = { ...props, ledgerContext: "changed-ledger" };
    render();
    expect(text(render())).not.toContain("Recorded ratio matches");
    props = { ...props, disabled: true };
    render();
    expect(button(render(), "Review history").props.disabled).toBe(true);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
  });

  it("uses the latest callbacks while retaining the request's ledger context", async () => {
    const previous = props.onAssessment;
    const pending = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview.mockReturnValueOnce(pending.promise);
    await mount();
    click(render(), "Review history");
    await flush();
    props = { ...props, onAssessment: vi.fn() };
    render();
    pending.resolve(market());
    await flush();
    expect(previous).not.toHaveBeenCalled();
    expect(props.onAssessment).toHaveBeenCalledWith(
      "saved-ledger-v3-context",
      "listing-one",
      false,
      expect.any(Object),
    );
  });

  it("paginates action observations locally and resets the page on the next review", async () => {
    const value = market();
    const bars = Array.from({ length: 101 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, index + 2))
        .toISOString()
        .slice(0, 10);
      return bar(date, "1", "0.10");
    });
    api.fetchPersonalMarketOverview.mockResolvedValue({
      ...value,
      history: { ...value.history, bars },
    });
    await review();
    expect(actionRowCount(render())).toBe(50);
    click(render(), "Show more actions for ONE");
    expect(actionRowCount(render())).toBe(100);
    click(render(), "Show more actions for ONE");
    expect(actionRowCount(render())).toBe(101);
    expect(
      elements(render()).some(
        (element) =>
          element.type === "button" &&
          text(element) === "Show more actions for ONE",
      ),
    ).toBe(false);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    click(render(), "Review history");
    await flush();
    expect(actionRowCount(render())).toBe(50);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
  });

  it("keeps the review disabled when no identities are registered", async () => {
    props = {
      ...props,
      ledger: {
        ...ledger(),
        identities: [],
        opening: { ...ledger().opening, holdings: [] },
        transactions: [],
      },
    };
    await mount();
    expect(button(render(), "Review history").props.disabled).toBe(true);
    expect(api.searchPersonalSecurities).not.toHaveBeenCalled();
  });
});

function digest(character: string): `sha256:${string}` {
  return `sha256:${character.repeat(64)}`;
}
function identity(index = 0): PersonalPortfolioIdentity {
  const suffix = ["one", "two", "three"][index] ?? String(index);
  return {
    country: "US",
    exchangeMic: "XNYS",
    instrumentType: "common_stock",
    issuerId: `issuer-${suffix}`,
    issuerName: `Issuer ${suffix}`,
    listingId: `listing-${suffix}`,
    securityId: `security-${suffix}`,
    securityName: `Security ${suffix}`,
    shareClassId: `class-${suffix}`,
    shareClassName: "Common",
    symbol: ["ONE", "TWO", "THREE"][index] ?? `S${String(index)}`,
  };
}
function ledger(count = 1): PersonalPortfolioLedgerPayloadV3 {
  return {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: digest("a"),
    basisMethod: "fifo_with_opening_pool",
    identities: Array.from({ length: count }, (_, index) => identity(index)),
    opening: {
      asOfDate: "2026-01-01",
      cashUsd: "100",
      holdings: Array.from({ length: Math.min(count, 2) }, (_, index) => ({
        listingId: identity(index).listingId,
        shares: "10",
        totalCostBasisUsd: "100",
        confirmedOn: "2026-01-01",
      })),
    },
    transactions: [
      ...(count > 1
        ? [
            {
              id: "close-second",
              date: "2026-01-02",
              type: "sell" as const,
              listingId: "listing-two",
              shares: "10",
              grossUsd: "120",
              feeUsd: "0",
            },
          ]
        : []),
      {
        id: "split-one",
        date: "2026-01-03",
        type: "split",
        listingId: "listing-one",
        ratioNumerator: "2",
        ratioDenominator: "1",
      },
    ],
  };
}
function search(results: readonly unknown[]) {
  return { snapshot: { snapshotSha256: digest("a") }, results };
}
function bar(
  date: string,
  splitFactor = "1",
  dividendCash = "0",
): PersonalMarketDataDailyBarDto {
  const ohlcv = {
    open: "10",
    high: "11",
    low: "9",
    close: "10",
    volume: "100",
  };
  return {
    date,
    splitFactor,
    dividendCash,
    raw: { ...ohlcv },
    adjusted: { ...ohlcv },
  };
}
function market(index = 0): PersonalMarketOverviewDto {
  const listing = identity(index);
  return {
    schemaVersion: "1.0.0",
    profile: "personal_single_user_local_market_data",
    status: "available",
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
    security: {
      country: listing.country,
      exchangeMic: listing.exchangeMic,
      issuerName: listing.issuerName,
      listingId: listing.listingId,
      securityName: listing.securityName,
      symbol: listing.symbol,
    },
    quote: {
      change: "0",
      changePercent: "0",
      currency: "USD",
      freshness: "current",
      ingestedAt: "2026-09-09T10:00:00.000Z",
      kind: "derived_realtime_reference",
      previousClose: "10",
      price: "10",
      sourceTime: "2026-09-09T09:59:00.000Z",
    },
    history: {
      range: "1y",
      startDate: "2025-09-09",
      endDate: "2026-09-09",
      bars: [
        bar("2026-01-01"),
        bar("2026-01-03", "2"),
        bar("2026-01-04", "1", "0.25"),
      ],
    },
  };
}

const harness = vi.hoisted(() => {
  const states: unknown[] = [],
    refs: Array<{ current: unknown }> = [],
    dependencies: Array<readonly unknown[] | undefined> = [];
  const cleanup = new Map<number, () => void>();
  let pending: Array<() => void> = [],
    stateIndex = 0,
    refIndex = 0,
    effectIndex = 0;
  return {
    reset() {
      states.splice(0);
      refs.splice(0);
      dependencies.splice(0);
      cleanup.clear();
      pending = [];
    },
    begin() {
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
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
function render() {
  harness.begin();
  const view = PersonalPortfolioHistoryCoverage(props);
  harness.effects();
  return view;
}
async function mount() {
  render();
  await flush();
  return render();
}
async function review() {
  await mount();
  click(render(), "Review history");
  await flush();
  return render();
}
async function flush() {
  for (let index = 0; index < 24; index += 1) await Promise.resolve();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value))
    return value.map(text).join(" ").replace(/\s+/gu, " ");
  if (!React.isValidElement(value)) return "";
  return text(
    (value as React.ReactElement<Record<string, unknown>>).props.children,
  );
}
function elements(
  value: unknown,
): Array<React.ReactElement<Record<string, unknown>>> {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement(value)) return [];
  const element = value as React.ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props.children)];
}
function button(value: unknown, label: string) {
  const found = elements(value).find(
    (element) => element.type === "button" && text(element) === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found as React.ReactElement<{
    disabled?: boolean;
    onClick?: () => void;
  }>;
}
function click(value: unknown, label: string) {
  const found = button(value, label);
  if (found.props.disabled) throw new Error(`Disabled button: ${label}`);
  found.props.onClick?.();
}
function input(value: unknown) {
  const found = elements(value).find(
    (element) => element.props["aria-label"] === "Portfolio history window",
  );
  if (!found) throw new Error("Missing history window");
  return found as React.ReactElement<{
    disabled: boolean;
    onChange: (event: { target: { value: string } }) => void;
  }>;
}
function changeRange(value: string) {
  input(render()).props.onChange({ target: { value } });
}
function actionRowCount(value: unknown) {
  return elements(value)
    .filter((element) => element.type === "tbody")
    .reduce(
      (sum, body) =>
        sum + elements(body).filter((element) => element.type === "tr").length,
      0,
    );
}
