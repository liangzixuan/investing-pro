import type {
  PersonalMarketDataDailyBarDto,
  PersonalMarketOverviewDto,
  PersonalPortfolioIdentity,
  PersonalPortfolioLedgerPayloadV3,
} from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonalPortfolioValuationHistoryResult } from "../../lib/personal-portfolio-valuation-history";
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
  useMemo: <T,>(factory: () => T) => factory(),
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
vi.mock(
  "@/lib/personal-portfolio-valuation-history",
  () => import("../../lib/personal-portfolio-valuation-history"),
);
vi.mock("./PersonalPortfolioValuationHistory", () => ({
  PersonalPortfolioValuationHistory: (viewProps: { result: unknown }) =>
    React.createElement("div", {
      "data-testid": "portfolio-valuation-history",
      "data-result": viewProps.result,
    }),
}));

let props: PersonalPortfolioHistoryCoverageProps;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T10:00:00.000Z"));
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PersonalPortfolioHistoryCoverage", () => {
  it("reuses loaded raw closes for valuation and leaves unobserved calendar dates incomplete", async () => {
    const value = market();
    api.fetchPersonalMarketOverview.mockResolvedValue({
      ...value,
      quote: { ...value.quote, price: "999" },
      history: {
        ...value.history,
        bars: value.history.bars.map((entry) => ({
          ...entry,
          raw: {
            open: "15",
            high: "15",
            low: "15",
            close: "15",
            volume: "100",
          },
          adjusted: {
            open: "99",
            high: "99",
            low: "99",
            close: "99",
            volume: "100",
          },
        })),
      },
    });
    await review();
    expect(point(render(), "2026-01-01")).toMatchObject({
      cashUsd: "100.00",
      holdingsValueUsd: "150.00",
      totalValueUsd: "250.00",
    });
    expect(point(render(), "2026-01-03")).toMatchObject({
      cashUsd: "100.00",
      holdingsValueUsd: "300.00",
      totalValueUsd: "400.00",
      netExternalFlowUsd: "0.00",
    });
    for (const date of ["2026-01-02", "2026-01-05"]) {
      expect(point(render(), date)).toMatchObject({
        holdingsValueUsd: null,
        totalValueUsd: null,
        missingPriceListingIds: ["listing-one"],
      });
    }
    expect(valuation(render())).toMatchObject({
      comparison: {
        firstDate: "2026-01-01",
        lastDate: "2026-01-04",
        firstValueUsd: "250.00",
        lastValueUsd: "400.00",
        endpointReturn: { status: "available", percent: "60.00" },
        modifiedDietzReturn: { status: "available", percent: "60.00" },
      },
    });
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    expect(api.searchPersonalSecurities).toHaveBeenCalledTimes(1);
    expect(api.savePersonalPortfolio).not.toHaveBeenCalled();
  });

  it("shows available valuation during a partial batch and keeps unrequested prices missing on cancellation", async () => {
    props = { ...props, ledger: ledger(2) };
    const pending = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview
      .mockResolvedValueOnce(market())
      .mockReturnValueOnce(pending.promise);
    await mount();
    click(render(), "Review history");
    await flush();
    expect(point(render(), "2026-01-01")).toMatchObject({
      activeHoldings: 2,
      pricedHoldings: 1,
      pricedHoldingsValueUsd: "100.00",
      holdingsValueUsd: null,
      totalValueUsd: null,
      missingPriceListingIds: ["listing-two"],
    });
    expect(point(render(), "2026-01-03")).toMatchObject({
      activeHoldings: 1,
      cashUsd: "220.00",
      holdingsValueUsd: "200.00",
      totalValueUsd: "420.00",
    });
    expect(valuation(render())).toMatchObject({
      comparison: {
        firstDate: "2026-01-03",
        lastDate: "2026-01-04",
        endpointReturn: { status: "available", percent: "0.00" },
        modifiedDietzReturn: { status: "available", percent: "0.00" },
      },
    });
    click(render(), "Cancel history review");
    pending.resolve(market(1));
    await flush();
    expect(point(render(), "2026-01-01")).toMatchObject({
      pricedHoldings: 1,
      missingPriceListingIds: ["listing-two"],
    });
    expect(valuation(render())).toMatchObject({
      comparison: {
        firstDate: "2026-01-03",
        endpointReturn: { status: "available", percent: "0.00" },
        modifiedDietzReturn: { status: "available", percent: "0.00" },
      },
    });
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
  });

  it("clears all prior-batch prices before a new review and never restores them after failure", async () => {
    await review();
    expect(point(render(), "2026-01-03")).toMatchObject({
      totalValueUsd: "300.00",
    });
    props = {
      ...props,
      priorSplitReviewDates: { "listing-one": ["2026-01-02"] },
    };
    const pending = deferred<ReturnType<typeof search>>();
    api.searchPersonalSecurities.mockReturnValueOnce(pending.promise);
    api.fetchPersonalMarketOverview.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("not_covered"),
    );
    click(render(), "Review history");
    expect(point(render(), "2026-01-03")).toMatchObject({
      pricedHoldings: 0,
      totalValueUsd: null,
      missingPriceListingIds: ["listing-one"],
    });
    pending.resolve(search([identity()]));
    await flush();
    expect(point(render(), "2026-01-03")).toMatchObject({
      pricedHoldings: 0,
      totalValueUsd: null,
      splitReviewListingIds: ["listing-one"],
    });
    expect(valuation(render())).toMatchObject({
      comparison: {
        modifiedDietzReturn: {
          status: "unavailable",
          reason: "insufficient_complete_dates",
        },
      },
    });
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
  });

  it("recomputes carried split warnings without refetching or aborting an active batch", async () => {
    props = { ...props, ledger: ledger(2) };
    const pending = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview
      .mockResolvedValueOnce(market())
      .mockReturnValueOnce(pending.promise);
    await mount();
    click(render(), "Review history");
    await flush();
    const signal = api.fetchPersonalMarketOverview.mock
      .calls[1]?.[1] as AbortSignal;
    expect(point(render(), "2026-01-04")).toMatchObject({
      totalValueUsd: "420.00",
    });
    expect(valuation(render())).toMatchObject({
      comparison: {
        modifiedDietzReturn: { status: "available", percent: "0.00" },
      },
    });
    props = {
      ...props,
      priorSplitReviewDates: { "listing-one": ["2026-01-02"] },
    };
    render();
    expect(point(render(), "2026-01-04")).toMatchObject({
      totalValueUsd: null,
      splitReviewListingIds: ["listing-one"],
    });
    expect(valuation(render())).toMatchObject({
      comparison: {
        modifiedDietzReturn: {
          status: "unavailable",
          reason: "insufficient_complete_dates",
        },
      },
    });
    expect(signal.aborted).toBe(false);
    expect(api.searchPersonalSecurities).toHaveBeenCalledTimes(2);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
    props = { ...props, priorSplitReviewDates: {} };
    render();
    expect(point(render(), "2026-01-04")).toMatchObject({
      totalValueUsd: "420.00",
    });
    expect(valuation(render())).toMatchObject({
      comparison: {
        modifiedDietzReturn: { status: "available", percent: "0.00" },
      },
    });
    pending.resolve(market(1));
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
  });

  it("applies a newly observed split discrepancy before parent assessment state updates", async () => {
    const value = market();
    api.fetchPersonalMarketOverview.mockResolvedValue({
      ...value,
      history: {
        ...value.history,
        bars: [bar("2026-01-01"), bar("2026-01-03", "3"), bar("2026-01-04")],
      },
    });
    await review();
    expect(point(render(), "2026-01-01")).toMatchObject({
      totalValueUsd: "200.00",
    });
    for (const date of ["2026-01-03", "2026-01-04"]) {
      expect(point(render(), date)).toMatchObject({
        holdingsValueUsd: null,
        totalValueUsd: null,
        splitReviewListingIds: ["listing-one"],
      });
    }
    expect(props.priorSplitReviewDates).toBeUndefined();
    expect(props.onAssessment).toHaveBeenCalledOnce();
  });

  it("retains prior warning dates outside a shorter review's observed window", async () => {
    props = {
      ...props,
      priorSplitReviewDates: { "listing-one": ["2026-01-03"] },
    };
    const value = market();
    api.fetchPersonalMarketOverview.mockResolvedValue({
      ...value,
      history: {
        range: "1m",
        startDate: "2026-08-09",
        endDate: "2026-09-09",
        bars: [bar("2026-09-08")],
      },
    });
    await mount();
    changeRange("1m");
    render();
    click(render(), "Review history");
    await flush();
    expect(point(render(), "2026-09-08")).toMatchObject({
      totalValueUsd: null,
      splitReviewListingIds: ["listing-one"],
    });
    expect(props.onAssessment).toHaveBeenCalledWith(
      props.ledgerContext,
      "listing-one",
      false,
      expect.objectContaining({
        observedDates: ["2026-09-08"],
        splitReviewDates: [],
      }),
    );
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
  });

  it.each(["ledger", "catalog", "disabled", "range"] as const)(
    "hides previous values on the first render after a %s change",
    async (kind) => {
      await review();
      expect(valuation(render())).toMatchObject({
        comparison: {
          modifiedDietzReturn: { status: "available", percent: "50.00" },
        },
      });
      if (kind === "ledger")
        props = { ...props, ledgerContext: "new-saved-version" };
      if (kind === "catalog")
        props = { ...props, catalogSnapshotSha256: digest("b") };
      if (kind === "disabled") props = { ...props, disabled: true };
      if (kind === "range") changeRange("1m");
      const firstChangedView = render();
      expect(valuation(firstChangedView)).toBeNull();
      expect(text(firstChangedView)).not.toContain("Recorded ratio matches");
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    },
  );

  it("ignores old review and cancel handlers after a newer context starts loading", async () => {
    const first = deferred<PersonalMarketOverviewDto>();
    const second = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await mount();
    const oldReview = button(render(), "Review history").props.onClick;
    oldReview?.();
    await flush();
    const oldCancel = button(render(), "Cancel history review").props.onClick;
    props = { ...props, ledgerContext: "new-ledger-version" };
    render();
    click(render(), "Review history");
    await flush();
    const newSignal = api.fetchPersonalMarketOverview.mock
      .calls[1]?.[1] as AbortSignal;
    oldReview?.();
    oldCancel?.();
    expect(newSignal.aborted).toBe(false);
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
    first.resolve(market());
    await flush();
    expect(point(render(), "2026-01-03")).toMatchObject({
      totalValueUsd: null,
    });
    second.resolve(market());
    await flush();
    expect(point(render(), "2026-01-03")).toMatchObject({
      totalValueUsd: "300.00",
    });
  });

  it("waits for demand, displays observed coverage and matching terms, and never changes or saves the ledger", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    vi.stubGlobal("sessionStorage", { setItem });
    const before = JSON.stringify(props.ledger);
    await mount();
    expect(api.searchPersonalSecurities).not.toHaveBeenCalled();
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(valuation(render())).toBeNull();
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
    expect(point(render(), "2026-01-03")).toMatchObject({
      cashUsd: "100.00",
      holdingsValueUsd: "200.00",
      totalValueUsd: "300.00",
    });
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
      expect(point(render(), "2026-01-03")).toMatchObject({
        totalValueUsd: null,
        missingPriceListingIds: ["listing-one"],
      });
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
      expect(point(render(), "2026-01-03")).toMatchObject({
        totalValueUsd: null,
        missingPriceListingIds: ["listing-one"],
      });
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
      expect(point(render(), "2026-01-01")).toMatchObject({
        pricedHoldings: 1,
        totalValueUsd: null,
        missingPriceListingIds: ["listing-two"],
      });
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
      if (kind !== "unmount") {
        expect(text(render())).not.toContain("Recorded ratio matches");
        expect(valuation(render())).toBeNull();
      }
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
    expect(valuation(render())).toBeNull();
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
    expect(valuation(render())).toBeNull();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    click(render(), "Review history");
    await flush();
    expect(api.fetchPersonalMarketOverview.mock.calls[1]?.[0]).toMatchObject({
      range: "1m",
    });
    props = { ...props, ledgerContext: "changed-ledger" };
    render();
    expect(text(render())).not.toContain("Recorded ratio matches");
    expect(valuation(render())).toBeNull();
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

  it("uses the captured calendar window for a full year of cash-only values and recorded external flows", async () => {
    props = {
      ...props,
      ledger: {
        ...ledger(),
        identities: [],
        opening: { asOfDate: "2025-01-01", cashUsd: "100", holdings: [] },
        transactions: [
          {
            id: "cash-deposit",
            date: "2026-01-02",
            type: "deposit",
            listingId: null,
            shares: null,
            grossUsd: "25",
            feeUsd: "0",
          },
          {
            id: "cash-withdrawal",
            date: "2026-01-03",
            type: "withdrawal",
            listingId: null,
            shares: null,
            grossUsd: "5",
            feeUsd: "0",
          },
        ],
      },
    };
    await review();
    const result = valuation(render());
    expect(result).toMatchObject({
      status: "available",
      startDate: "2025-09-09",
      effectiveStartDate: "2025-09-09",
      endDate: "2026-09-09",
      coverage: {
        totalDates: 366,
        completeDates: 366,
        missingPriceDates: 0,
        unknownCashDates: 0,
        splitReviewDates: 0,
      },
      comparison: {
        firstDate: "2025-09-09",
        lastDate: "2026-09-09",
        firstValueUsd: "100.00",
        lastValueUsd: "120.00",
        netExternalFlowsUsd: "20.00",
        changeAfterExternalFlowsUsd: "0.00",
        endpointReturn: { status: "unavailable", reason: "external_flows" },
        modifiedDietzReturn: { status: "available", percent: "0.00" },
      },
    });
    if (result?.status !== "available")
      throw new Error("Expected available valuation");
    expect(result.points).toHaveLength(366);
    expect(new Set(result.points.map((entry) => entry.date)).size).toBe(366);
    expect(point(render(), "2026-01-02")).toMatchObject({
      totalValueUsd: "125.00",
      netExternalFlowUsd: "25.00",
    });
    expect(point(render(), "2026-01-03")).toMatchObject({
      totalValueUsd: "120.00",
      netExternalFlowUsd: "-5.00",
    });
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(api.searchPersonalSecurities).not.toHaveBeenCalled();
  });

  it("keeps unknown opening cash unknown and suppresses complete endpoint comparisons", async () => {
    props = {
      ...props,
      ledger: { ...ledger(), opening: { ...ledger().opening, cashUsd: null } },
    };
    await review();
    expect(point(render(), "2026-01-03")).toMatchObject({
      cashUsd: null,
      holdingsValueUsd: "200.00",
      totalValueUsd: null,
    });
    expect(valuation(render())).toMatchObject({
      coverage: { completeDates: 0, unknownCashDates: 252 },
      comparison: {
        firstDate: null,
        lastDate: null,
        firstValueUsd: null,
        lastValueUsd: null,
        netExternalFlowsUsd: null,
        changeAfterExternalFlowsUsd: null,
        endpointReturn: {
          status: "unavailable",
          reason: "insufficient_complete_dates",
        },
        modifiedDietzReturn: {
          status: "unavailable",
          reason: "insufficient_complete_dates",
        },
      },
    });
  });

  it("keeps the requested valuation window fixed if the provider batch crosses UTC midnight", async () => {
    const pending = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview.mockReturnValueOnce(pending.promise);
    await mount();
    click(render(), "Review history");
    await flush();
    vi.setSystemTime(new Date("2026-09-10T00:00:01.000Z"));
    pending.resolve(market());
    await flush();
    expect(valuation(render())).toMatchObject({
      startDate: "2025-09-09",
      endDate: "2026-09-09",
    });
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    click(render(), "Review history");
    await flush();
    expect(valuation(render())).toMatchObject({
      startDate: "2025-09-10",
      endDate: "2026-09-10",
    });
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
  });

  it("values a cash-only ledger on demand without requesting a catalog or provider", async () => {
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
    expect(button(render(), "Review history").props.disabled).toBe(false);
    expect(valuation(render())).toBeNull();
    click(render(), "Review history");
    await flush();
    expect(api.searchPersonalSecurities).not.toHaveBeenCalled();
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(props.onAssessment).not.toHaveBeenCalled();
    expect(point(render(), "2026-01-01")).toMatchObject({
      cashUsd: "100.00",
      holdingsValueUsd: "0.00",
      totalValueUsd: "100.00",
      activeHoldings: 0,
      pricedHoldings: 0,
    });
    expect(point(render(), "2026-09-09")).toMatchObject({
      totalValueUsd: "100.00",
    });
    expect(valuation(render())).toMatchObject({
      comparison: {
        endpointReturn: { status: "available", percent: "0.00" },
        modifiedDietzReturn: { status: "available", percent: "0.00" },
      },
    });
  });

  it.each([
    ["2026-01-02", "50.00", "0.00"],
    ["2026-01-03", "48.00", "25.00"],
  ])(
    "weights offsetting flows ending on %s and clears both returns across range and session changes",
    async (withdrawalDate, estimatePercent, depositDateNetFlow) => {
      props = {
        ...props,
        ledger: {
          ...ledger(),
          transactions: [
            {
              id: "offsetting-deposit",
              date: "2026-01-02",
              type: "deposit",
              listingId: null,
              shares: null,
              grossUsd: "25",
              feeUsd: "0",
            },
            {
              id: "offsetting-withdrawal",
              date: withdrawalDate,
              type: "withdrawal",
              listingId: null,
              shares: null,
              grossUsd: "25",
              feeUsd: "0",
            },
            ...ledger().transactions,
          ],
        },
      };
      await review();
      expect(point(render(), "2026-01-02")).toMatchObject({
        totalValueUsd: null,
        netExternalFlowUsd: depositDateNetFlow,
      });
      expect(valuation(render())).toMatchObject({
        comparison: {
          firstDate: "2026-01-01",
          lastDate: "2026-01-04",
          netExternalFlowsUsd: "0.00",
          changeAfterExternalFlowsUsd: "100.00",
          endpointReturn: { status: "unavailable", reason: "external_flows" },
          modifiedDietzReturn: {
            status: "available",
            percent: estimatePercent,
          },
        },
      });
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
      expect(api.searchPersonalSecurities).toHaveBeenCalledTimes(1);

      changeRange("1m");
      expect(valuation(render())).toBeNull();
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
      api.fetchPersonalMarketOverview.mockRejectedValueOnce(
        new PersonalWorkspaceApiError("session_unavailable"),
      );
      click(render(), "Review history");
      await flush();
      expect(valuation(render())).toBeNull();
      expect(props.onSessionUnavailable).toHaveBeenCalledOnce();
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
      expect(api.searchPersonalSecurities).toHaveBeenCalledTimes(2);
      expect(api.savePersonalPortfolio).not.toHaveBeenCalled();
    },
  );
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
  return [
    element,
    ...elements(
      typeof element.type === "function"
        ? (Reflect.apply(element.type, undefined, [element.props]) as unknown)
        : element.props.children,
    ),
  ];
}
function valuation(
  value: unknown,
): PersonalPortfolioValuationHistoryResult | null {
  return (elements(value).find(
    (element) => element.props["data-testid"] === "portfolio-valuation-history",
  )?.props["data-result"] ??
    null) as PersonalPortfolioValuationHistoryResult | null;
}
function point(value: unknown, date: string): unknown {
  const result = valuation(value);
  const found =
    result?.status === "available"
      ? result.points.find((entry) => entry.date === date)
      : undefined;
  if (!found) throw new Error(`Missing valuation date: ${date}`);
  return found;
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
