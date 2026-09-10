import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialsDto,
  PersonalMarketDataRangeDto,
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
  PersonalQuarterlyFinancialsDto,
  PersonalValuationHistoryDto,
  PersonalSecurityMasterSearchResponseDto,
  PersonalSecurityMasterSearchResultDto,
  PersonalSecurityMasterScreenRowDto,
  PersonalSecurityMasterSnapshotReceiptDto,
} from "@research-cockpit/contracts";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalWorkspaceApiError,
  type PersonalWatchlistPayload,
  type PersonalWatchlistRecord,
  type SavedPersonalWatchlist,
} from "@/lib/personal-workspace-api";

import type { PersonalAnnualFinancialsProps } from "./PersonalAnnualFinancials";
import type { PersonalFcffDcfValuationProps } from "./PersonalFcffDcfValuation";
import type { PersonalFinancialQualityScorecardProps } from "./PersonalFinancialQualityScorecard";
import type { PersonalHistoricalMultipleValuationProps } from "./PersonalHistoricalMultipleValuation";
import type { PersonalManualPeerComparisonProps } from "./PersonalManualPeerComparison";
import type { PersonalMarketOverviewProps } from "./PersonalMarketOverview";
import type { PersonalQuarterlyFinancialsProps } from "./PersonalQuarterlyFinancials";
import type { PersonalSecQuarterlyEvidenceProps } from "./PersonalSecQuarterlyEvidence";
import type { PersonalStockScreenerProps } from "./PersonalStockScreener";
import type { PersonalFinancialScreenerProps } from "./PersonalFinancialScreener";
import type { PersonalWatchlistFilingsProps } from "./PersonalWatchlistFilings";
import type { PersonalPortfolioProps } from "./PersonalPortfolio";
import type { PersonalValuationHistoryProps } from "./PersonalValuationHistory";

const hookHarness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  let stateIndex = 0;
  let refIndex = 0;
  return {
    beginRender() {
      stateIndex = 0;
      refIndex = 0;
    },
    reset() {
      states.splice(0);
      refs.splice(0);
      stateIndex = 0;
      refIndex = 0;
    },
    useCallback: <T,>(callback: T): T => callback,
    useRef: <T,>(initial: T) => {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useState: (initial: unknown) => {
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

const apiMocks = vi.hoisted(() => ({
  fetchMainPersonalWatchlist:
    vi.fn<(signal: AbortSignal) => Promise<PersonalWatchlistRecord | null>>(),
  fetchPersonalAnnualFinancials:
    vi.fn<
      (
        input: Readonly<{ listingId: string; symbol: string }>,
        signal: AbortSignal,
      ) => Promise<PersonalAnnualFinancialsDto>
    >(),
  fetchPersonalMarketDataStatus:
    vi.fn<(signal: AbortSignal) => Promise<PersonalMarketDataStatusDto>>(),
  fetchPersonalMarketOverview: vi.fn<
    (
      input: Readonly<{
        listingId: string;
        range: PersonalMarketDataRangeDto;
        symbol: string;
      }>,
      signal: AbortSignal,
    ) => Promise<PersonalMarketOverviewDto>
  >(),
  fetchPersonalQuarterlyFinancials:
    vi.fn<
      (
        input: Readonly<{ listingId: string; symbol: string }>,
        signal: AbortSignal,
      ) => Promise<PersonalQuarterlyFinancialsDto>
    >(),
  fetchPersonalValuationHistory: vi.fn<
    (
      input: Readonly<{
        listingId: string;
        range: PersonalMarketDataRangeDto;
        symbol: string;
      }>,
      signal: AbortSignal,
    ) => Promise<PersonalValuationHistoryDto>
  >(),
  fetchPersonalSecurityMasterStatus: vi.fn<
    (signal: AbortSignal) => Promise<{
      snapshot: PersonalSecurityMasterSnapshotReceiptDto;
    }>
  >(),
  saveMainPersonalWatchlist:
    vi.fn<
      (
        version: number,
        payload: PersonalWatchlistPayload,
        signal: AbortSignal,
      ) => Promise<SavedPersonalWatchlist>
    >(),
  searchPersonalSecurities:
    vi.fn<
      (
        query: string,
        signal: AbortSignal,
        limit: number,
      ) => Promise<PersonalSecurityMasterSearchResponseDto>
    >(),
}));
const componentMocks = vi.hoisted(() => ({
  AnnualFinancials: () => null,
  FcffDcfValuation: () => null,
  FinancialQualityScorecard: () => null,
  HistoricalMultipleValuation: () => null,
  ManualPeerComparison: () => null,
  MarketOverview: () => null,
  OwnerSession: () => null,
  QuarterlyFinancials: () => null,
  SecQuarterlyEvidence: () => null,
  StockScreener: () => null,
  FinancialScreener: () => null,
  WatchlistFilings: () => null,
  Portfolio: () => null,
  ValuationHistory: () => null,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  useCallback: hookHarness.useCallback,
  useRef: hookHarness.useRef,
  useState: hookHarness.useState,
}));
vi.mock("@/lib/personal-workspace-api", () => ({
  ...apiMocks,
  PersonalWorkspaceApiError: class PersonalWorkspaceApiError extends Error {
    constructor(readonly code: string) {
      super("Personal workspace request failed.");
    }
  },
  createEmptyPersonalWatchlist: (snapshotSha256: string) => ({
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256,
    memberships: [],
  }),
  membershipFromSearchResult: (
    result: PersonalSecurityMasterSearchResultDto,
  ) => ({
    country: result.country,
    exchangeMic: result.exchangeMic,
    instrumentType: result.instrumentType,
    issuerId: result.issuerId,
    issuerName: result.issuerName,
    listingId: result.listingId,
    note: "",
    securityId: result.securityId,
    securityName: result.securityName,
    shareClassId: result.shareClassId,
    shareClassName: result.shareClassName,
    symbol: result.symbol,
  }),
  normalizeWatchlistNote: (value: string) => value.trim(),
}));
vi.mock("./OwnerSessionPanel", () => ({
  OwnerSessionPanel: componentMocks.OwnerSession,
}));
vi.mock("./PersonalAnnualFinancials", () => ({
  PersonalAnnualFinancials: componentMocks.AnnualFinancials,
}));
vi.mock("./PersonalFcffDcfValuation", () => ({
  PersonalFcffDcfValuation: componentMocks.FcffDcfValuation,
}));
vi.mock("./PersonalFinancialQualityScorecard", () => ({
  PersonalFinancialQualityScorecard: componentMocks.FinancialQualityScorecard,
}));
vi.mock("./PersonalHistoricalMultipleValuation", () => ({
  PersonalHistoricalMultipleValuation:
    componentMocks.HistoricalMultipleValuation,
}));
vi.mock("./PersonalMarketOverview", () => ({
  PersonalMarketOverview: componentMocks.MarketOverview,
}));
vi.mock("./PersonalManualPeerComparison", () => ({
  PERSONAL_MANUAL_PEER_COMPARISON_MAXIMUM_PEERS: 3,
  PersonalManualPeerComparison: componentMocks.ManualPeerComparison,
}));
vi.mock("./PersonalQuarterlyFinancials", () => ({
  PersonalQuarterlyFinancials: componentMocks.QuarterlyFinancials,
}));
vi.mock("./PersonalSecQuarterlyEvidence", () => ({
  PersonalSecQuarterlyEvidence: componentMocks.SecQuarterlyEvidence,
}));
vi.mock("./PersonalStockScreener", () => ({
  PersonalStockScreener: componentMocks.StockScreener,
}));
vi.mock("./PersonalFinancialScreener", () => ({
  PersonalFinancialScreener: componentMocks.FinancialScreener,
}));
vi.mock("./PersonalWatchlistFilings", () => ({
  PersonalWatchlistFilings: componentMocks.WatchlistFilings,
}));
vi.mock("./PersonalPortfolio", () => ({
  PersonalPortfolio: componentMocks.Portfolio,
}));
vi.mock("./PersonalValuationHistory", () => ({
  PersonalValuationHistory: componentMocks.ValuationHistory,
}));

import { SecurityDiscoveryWorkspace } from "./SecurityDiscoveryWorkspace";

beforeEach(() => {
  hookHarness.reset();
  for (const mock of Object.values(apiMocks)) mock.mockReset();
  apiMocks.fetchPersonalSecurityMasterStatus.mockResolvedValue({
    snapshot: snapshot(),
  });
  apiMocks.fetchMainPersonalWatchlist.mockResolvedValue(null);
  apiMocks.fetchPersonalAnnualFinancials.mockResolvedValue(annualFinancials());
  apiMocks.fetchPersonalMarketDataStatus.mockResolvedValue(marketStatus());
  apiMocks.fetchPersonalMarketOverview.mockResolvedValue(marketOverview());
  apiMocks.fetchPersonalQuarterlyFinancials.mockResolvedValue(
    quarterlyFinancials(),
  );
  apiMocks.fetchPersonalValuationHistory.mockResolvedValue(valuationHistory());
  apiMocks.searchPersonalSecurities.mockResolvedValue({
    limitApplied: 15,
    normalizedQuery: "ZERO",
    results: [searchResult("ZERO", "lst-zero")],
    snapshot: snapshot(),
    totalMatches: 1,
  });
  apiMocks.saveMainPersonalWatchlist.mockImplementation(
    (version: number, payload: PersonalWatchlistPayload) =>
      Promise.resolve({ version: version + 1, payload }),
  );
});

describe("SecurityDiscoveryWorkspace", () => {
  it("starts locked and makes no private request before owner confirmation", () => {
    const rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(textContent(rendered)).toContain("No browser storage");
    expect(apiMocks.fetchPersonalSecurityMasterStatus).not.toHaveBeenCalled();
    expect(apiMocks.fetchMainPersonalWatchlist).not.toHaveBeenCalled();
    expect(findOwnerSession(rendered)).toBeDefined();
  });

  it("loads the real local universe and an empty durable watchlist after authentication", async () => {
    let rendered = renderWorkspace();
    const owner = requireOwnerSession(rendered);

    await expect(
      owner.props.onSessionChange(true, new AbortController().signal),
    ).resolves.toBe(true);
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("3,001");
    expect(textContent(rendered)).toContain("My Watchlist");
    expect(textContent(rendered)).toContain("Your watchlist is empty");
    expect(apiMocks.fetchPersonalSecurityMasterStatus).toHaveBeenCalledOnce();
    expect(apiMocks.fetchMainPersonalWatchlist).toHaveBeenCalledOnce();
  });

  it("places the local screener in discovery and routes exact rows to research and My Watchlist", async () => {
    await activateWorkspace();
    let rendered = renderWorkspace();
    const screener = requireStockScreener(rendered);
    const row = screenRow();

    expect(screener.props.snapshot.snapshotSha256).toBe(
      snapshot().snapshotSha256,
    );
    expect(screener.props.savedListingIds.size).toBe(0);
    expect(screener.props.canAddToWatchlist).toBe(true);

    screener.props.onOpenResearch(row);
    rendered = renderWorkspace();
    expect(requireMarketOverview(rendered).props.selection).toMatchObject({
      issuerId: "iss-screen",
      listingId: "lst-screen",
      symbol: "SCRN",
    });

    requireStockScreener(rendered).props.onAddToWatchlist(row);
    await flushPromises();
    rendered = renderWorkspace();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        memberships: [
          expect.objectContaining({
            issuerId: "iss-screen",
            listingId: "lst-screen",
            symbol: "SCRN",
          }),
        ],
      }),
      expect.any(AbortSignal),
    );
    expect(
      requireStockScreener(rendered).props.savedListingIds.has("lst-screen"),
    ).toBe(true);
  });

  it("carries complete admitted identities to the portfolio and clears private selection on session loss", async () => {
    await activateWorkspace();
    const getPanel = () =>
      findElement<PersonalPortfolioProps>(
        renderWorkspace(),
        componentMocks.Portfolio,
      );
    expect(getPanel()?.props.selectedListing).toBeNull();
    requireStockScreener(renderWorkspace()).props.onOpenResearch(screenRow());
    const panel = getPanel();
    expect(panel?.props.enabled).toBe(true);
    expect(panel?.props.catalogSnapshotSha256).toBe(snapshot().snapshotSha256);
    expect(panel?.props.selectedListing).toMatchObject({
      listingId: "lst-screen",
      issuerId: "iss-screen",
      symbol: "SCRN",
      securityId: screenRow().securityId,
      shareClassId: screenRow().shareClassId,
    });
    expect(Object.keys(panel?.props.selectedListing ?? {})).toHaveLength(11);
    panel?.props.onSessionUnavailable();
    expect(getPanel()).toBeUndefined();
    await activateWorkspace();
    expect(getPanel()?.props.selectedListing).toBeNull();
  });

  it("binds filing checks to the saved watchlist and clears them after session loss", async () => {
    await activateWorkspace();
    let panel = findElement<PersonalWatchlistFilingsProps>(
      renderWorkspace(),
      componentMocks.WatchlistFilings,
    );
    expect(panel?.props.enabled).toBe(false);
    requireStockScreener(renderWorkspace()).props.onAddToWatchlist(screenRow());
    await flushPromises();
    panel = findElement<PersonalWatchlistFilingsProps>(
      renderWorkspace(),
      componentMocks.WatchlistFilings,
    );
    expect(panel?.props.enabled).toBe(true);
    expect(panel?.props.catalogSnapshotSha256).toBe(snapshot().snapshotSha256);
    expect(panel?.props.watchlistVersion).toBe(1);
    const membership = panel?.props.memberships[0];
    expect(membership?.listingId).toBe("lst-screen");
    if (membership) panel?.props.onOpenResearch(membership);
    expect(
      requireMarketOverview(renderWorkspace()).props.selection?.listingId,
    ).toBe("lst-screen");
    panel?.props.onSessionUnavailable();
    expect(
      findElement(renderWorkspace(), componentMocks.WatchlistFilings),
    ).toBeUndefined();
  });

  it("binds SEC quarterly evidence to the selected company independently of Tiingo setup", async () => {
    apiMocks.fetchPersonalMarketDataStatus.mockResolvedValue({
      ...marketStatus(),
      status: "not_configured",
    });
    await activateWorkspace();
    const getPanel = () =>
      findElement<PersonalSecQuarterlyEvidenceProps>(
        renderWorkspace(),
        componentMocks.SecQuarterlyEvidence,
      );
    expect(getPanel()?.props.selection).toBeNull();
    requireStockScreener(renderWorkspace()).props.onOpenResearch(screenRow());
    const panel = getPanel();
    expect(panel?.props.enabled).toBe(true);
    expect(panel?.props.catalogSnapshotSha256).toBe(snapshot().snapshotSha256);
    expect(panel?.props.selection).toEqual({
      country: screenRow().country,
      exchangeMic: screenRow().exchangeMic,
      issuerId: screenRow().issuerId,
      issuerName: screenRow().issuerName,
      listingId: screenRow().listingId,
      securityName: screenRow().securityName,
      symbol: screenRow().symbol,
    });
    expect(apiMocks.fetchPersonalQuarterlyFinancials).not.toHaveBeenCalled();
    requireMarketOverview(renderWorkspace()).props.onClear();
    expect(getPanel()?.props.selection).toBeNull();
  });

  it("removes SEC quarterly evidence immediately on session loss and revalidates its catalog context", async () => {
    await activateWorkspace();
    requireStockScreener(renderWorkspace()).props.onOpenResearch(screenRow());
    const panel = findElement<PersonalSecQuarterlyEvidenceProps>(
      renderWorkspace(),
      componentMocks.SecQuarterlyEvidence,
    );
    panel?.props.onSessionUnavailable();
    expect(
      findElement(renderWorkspace(), componentMocks.SecQuarterlyEvidence),
    ).toBeUndefined();
    const changedSnapshot = {
      ...snapshot(),
      snapshotSha256: `sha256:${"b".repeat(64)}` as const,
    };
    apiMocks.fetchPersonalSecurityMasterStatus.mockResolvedValue({
      snapshot: changedSnapshot,
    });
    await activateWorkspace();
    const revalidated = findElement<PersonalSecQuarterlyEvidenceProps>(
      renderWorkspace(),
      componentMocks.SecQuarterlyEvidence,
    );
    expect(revalidated?.props.catalogSnapshotSha256).toBe(
      changedSnapshot.snapshotSha256,
    );
    expect(revalidated?.props.selection).toBeNull();
  });

  it("routes annual financial screen identities and clears discovery after session loss", async () => {
    await activateWorkspace();
    let rendered = renderWorkspace();
    const financial = findElement<PersonalFinancialScreenerProps>(
      rendered,
      componentMocks.FinancialScreener,
    );
    expect(financial).toBeDefined();
    expect(financial?.props.snapshot.snapshotSha256).toBe(
      snapshot().snapshotSha256,
    );
    financial?.props.onOpenResearch(screenRow());
    rendered = renderWorkspace();
    expect(requireMarketOverview(rendered).props.selection?.listingId).toBe(
      "lst-screen",
    );
    financial?.props.onAddToWatchlist(screenRow());
    await flushPromises();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        memberships: [expect.objectContaining({ listingId: "lst-screen" })],
      }),
      expect.any(AbortSignal),
    );
    financial?.props.onSessionUnavailable();
    expect(
      findElement(renderWorkspace(), componentMocks.FinancialScreener),
    ).toBeUndefined();
  });

  it("keeps discovery available when the saved watchlist cannot be loaded", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockRejectedValueOnce(
      new Error("malformed main watchlist"),
    );
    let rendered = renderWorkspace();
    const owner = requireOwnerSession(rendered);

    await expect(
      owner.props.onSessionChange(true, new AbortController().signal),
    ).resolves.toBe(true);
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Find a company");
    expect(textContent(rendered)).toContain(
      "Security search is still available, but watchlist changes are disabled",
    );
    expect(textContent(rendered)).toContain("My Watchlist is unavailable");
    expect(textContent(rendered)).not.toContain("Your watchlist is empty");

    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "security-query" }).props.onChange({
      target: { value: "ZERO" },
    });
    rendered = renderWorkspace();
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, { className: "security-search-form" }).props.onSubmit({
      preventDefault: vi.fn(),
    });
    await flushPromises();
    rendered = renderWorkspace();

    expect(apiMocks.searchPersonalSecurities).toHaveBeenCalledOnce();
    expect(requireButton(rendered, "Add").props.disabled).toBe(true);
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
  });

  it("keeps the initial workspace locked when the parallel watchlist read loses authorization", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    const owner = requireOwnerSession(renderWorkspace());

    await expect(
      owner.props.onSessionChange(true, new AbortController().signal),
    ).resolves.toBe(false);
    const rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(textContent(rendered)).toContain("Revalidate the session");
    expect(textContent(rendered)).not.toContain("3,001");
    expect(textContent(rendered)).not.toContain("Your watchlist is empty");
  });

  it("searches, adds a stable-ID result, and renders the saved membership", async () => {
    await activateWorkspace();
    let rendered = renderWorkspace();
    const searchInput = requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, {
      id: "security-query",
    });
    searchInput.props.onChange({ target: { value: " zero " } });
    rendered = renderWorkspace();
    const form = requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, {
      className: "security-search-form",
    });
    form.props.onSubmit({ preventDefault: vi.fn() });
    await flushPromises();
    rendered = renderWorkspace();

    expect(apiMocks.searchPersonalSecurities).toHaveBeenCalledWith(
      "zero",
      expect.any(AbortSignal),
      15,
    );
    const add = requireButton(rendered, "Add");
    add.props.onClick();
    await flushPromises();
    rendered = renderWorkspace();

    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        schemaVersion: 1,
        snapshotSha256: snapshot().snapshotSha256,
        memberships: [
          expect.objectContaining({
            issuerId: "iss-zero",
            listingId: "lst-zero",
            securityId: "sec-zero",
            shareClassId: "shr-zero",
            symbol: "ZERO",
          }),
        ],
      }),
      expect.any(AbortSignal),
    );
    expect(textContent(rendered)).toContain("ZERO was added");
  });

  it("shows provider readiness and loads market data only after an explicit request", async () => {
    await activateWorkspace();
    let rendered = renderWorkspace();
    let market = requireMarketOverview(rendered);

    expect(market.props.providerStatus).toMatchObject({ status: "configured" });
    expect(market.props.selection).toBeNull();
    expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();

    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "security-query" }).props.onChange({
      target: { value: "ZERO" },
    });
    rendered = renderWorkspace();
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, { className: "security-search-form" }).props.onSubmit({
      preventDefault: vi.fn(),
    });
    await flushPromises();
    rendered = renderWorkspace();

    requireButton(rendered, "View market").props.onClick();
    rendered = renderWorkspace();
    market = requireMarketOverview(rendered);
    expect(market.props.selection).toMatchObject({
      listingId: "lst-zero",
      symbol: "ZERO",
    });
    expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();

    market.props.onLoad("1y");
    await flushPromises();
    rendered = renderWorkspace();
    market = requireMarketOverview(rendered);

    expect(
      apiMocks.fetchPersonalMarketOverview,
    ).toHaveBeenCalledExactlyOnceWith(
      { listingId: "lst-zero", range: "1y", symbol: "ZERO" },
      expect.any(AbortSignal),
    );
    expect(market.props.overview).toMatchObject({
      status: "available",
      security: { listingId: "lst-zero", symbol: "ZERO" },
    });
  });

  it("loads annual financials only after the user explicitly requests them", async () => {
    await activateWorkspace();
    let rendered = renderWorkspace();

    expect(requireAnnualFinancials(rendered).props.selection).toBeNull();
    expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();

    rendered = await searchAndSelectMarket("ZERO");
    let annual = requireAnnualFinancials(rendered);
    expect(annual.props.selection).toMatchObject({
      listingId: "lst-zero",
      symbol: "ZERO",
    });
    expect(annual.props.financials).toBeNull();
    expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();

    annual.props.onLoad();
    rendered = renderWorkspace();
    expect(requireAnnualFinancials(rendered).props.requestState).toBe(
      "loading",
    );
    await flushPromises();
    rendered = renderWorkspace();
    annual = requireAnnualFinancials(rendered);

    expect(
      apiMocks.fetchPersonalAnnualFinancials,
    ).toHaveBeenCalledExactlyOnceWith(
      { listingId: "lst-zero", symbol: "ZERO" },
      expect.any(AbortSignal),
    );
    expect(annual.props.requestState).toBe("idle");
    expect(annual.props.financials).toMatchObject({
      coverage: { returnedAnnualYears: 1 },
      security: { listingId: "lst-zero", symbol: "ZERO" },
    });
  });

  it("loads quarterly financials only after the user explicitly requests them", async () => {
    await activateWorkspace();
    let rendered = renderWorkspace();

    expect(requireQuarterlyFinancials(rendered).props.selection).toBeNull();
    expect(apiMocks.fetchPersonalQuarterlyFinancials).not.toHaveBeenCalled();

    rendered = await searchAndSelectMarket("ZERO");
    let quarterly = requireQuarterlyFinancials(rendered);
    expect(quarterly.props.selection).toMatchObject({
      listingId: "lst-zero",
      symbol: "ZERO",
    });
    expect(quarterly.props.financials).toBeNull();
    expect(apiMocks.fetchPersonalQuarterlyFinancials).not.toHaveBeenCalled();

    quarterly.props.onLoad();
    rendered = renderWorkspace();
    expect(requireQuarterlyFinancials(rendered).props.requestState).toBe(
      "loading",
    );
    await flushPromises();
    rendered = renderWorkspace();
    quarterly = requireQuarterlyFinancials(rendered);

    expect(
      apiMocks.fetchPersonalQuarterlyFinancials,
    ).toHaveBeenCalledExactlyOnceWith(
      { listingId: "lst-zero", symbol: "ZERO" },
      expect.any(AbortSignal),
    );
    expect(quarterly.props.requestState).toBe("idle");
    expect(quarterly.props.financials).toMatchObject({
      coverage: { returnedQuarterlyPeriods: 1 },
      security: { listingId: "lst-zero", symbol: "ZERO" },
    });
  });

  it("loads valuation history for the selected listing and range only after an explicit request", async () => {
    await activateWorkspace();
    let rendered = renderWorkspace();

    expect(requireValuationHistory(rendered).props.selection).toBeNull();
    expect(apiMocks.fetchPersonalValuationHistory).not.toHaveBeenCalled();

    rendered = await searchAndSelectMarket("ZERO");
    let valuation = requireValuationHistory(rendered);
    expect(valuation.props.selection).toMatchObject({
      listingId: "lst-zero",
      symbol: "ZERO",
    });
    expect(valuation.props.history).toBeNull();
    expect(valuation.props.range).toBe("1y");
    expect(apiMocks.fetchPersonalValuationHistory).not.toHaveBeenCalled();

    valuation.props.onLoad();
    rendered = renderWorkspace();
    expect(requireValuationHistory(rendered).props.requestState).toBe(
      "loading",
    );
    await flushPromises();
    rendered = renderWorkspace();
    valuation = requireValuationHistory(rendered);

    expect(
      apiMocks.fetchPersonalValuationHistory,
    ).toHaveBeenCalledExactlyOnceWith(
      { listingId: "lst-zero", range: "1y", symbol: "ZERO" },
      expect.any(AbortSignal),
    );
    expect(valuation.props.requestState).toBe("idle");
    expect(valuation.props.history).toMatchObject({
      coverage: { observationCount: 2 },
      history: { range: "1y" },
      security: { listingId: "lst-zero", symbol: "ZERO" },
    });
  });

  it("composes historical-multiple scenarios only from the explicitly loaded selected inputs", async () => {
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");
    let valuation = requireHistoricalMultipleValuation(rendered);

    expect(valuation.props).toMatchObject({
      marketOverview: null,
      metric: "priceToEarnings",
      selection: { listingId: "lst-zero", symbol: "ZERO" },
      valuationHistory: null,
    });
    expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalValuationHistory).not.toHaveBeenCalled();

    requireMarketOverview(rendered).props.onLoad("1y");
    await flushPromises();
    rendered = renderWorkspace();
    requireValuationHistory(rendered).props.onLoad();
    await flushPromises();
    rendered = renderWorkspace();
    valuation = requireHistoricalMultipleValuation(rendered);

    expect(valuation.props.marketOverview).toMatchObject({
      history: { range: "1y" },
      security: { listingId: "lst-zero", symbol: "ZERO" },
    });
    expect(valuation.props.valuationHistory).toMatchObject({
      history: { range: "1y" },
      security: { listingId: "lst-zero", symbol: "ZERO" },
    });

    valuation.props.onMetricChange("priceToBook");
    rendered = renderWorkspace();
    expect(requireHistoricalMultipleValuation(rendered).props.metric).toBe(
      "priceToBook",
    );

    requireMarketOverview(rendered).props.onLoad("5y");
    rendered = renderWorkspace();
    valuation = requireHistoricalMultipleValuation(rendered);
    expect(valuation.props.marketOverview).toBeNull();
    expect(valuation.props.valuationHistory).toBeNull();
  });

  it("composes the DCF workspace only from the explicitly loaded selected inputs", async () => {
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");
    let valuation = requireFcffDcfValuation(rendered);

    expect(valuation.props).toMatchObject({
      annualFinancials: null,
      marketOverview: null,
      selection: { listingId: "lst-zero", symbol: "ZERO" },
      valuationHistory: null,
    });
    expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalValuationHistory).not.toHaveBeenCalled();

    requireMarketOverview(rendered).props.onLoad("1y");
    requireAnnualFinancials(rendered).props.onLoad();
    await flushPromises();
    rendered = renderWorkspace();
    requireValuationHistory(rendered).props.onLoad();
    await flushPromises();
    rendered = renderWorkspace();
    valuation = requireFcffDcfValuation(rendered);

    expect(valuation.props.marketOverview).toMatchObject({
      history: { range: "1y" },
      security: { listingId: "lst-zero", symbol: "ZERO" },
    });
    expect(valuation.props.annualFinancials).toMatchObject({
      coverage: { returnedAnnualYears: 1 },
      security: { listingId: "lst-zero", symbol: "ZERO" },
    });
    expect(valuation.props.valuationHistory).toMatchObject({
      history: { range: "1y" },
      security: { listingId: "lst-zero", symbol: "ZERO" },
    });

    requireMarketOverview(rendered).props.onLoad("5y");
    rendered = renderWorkspace();
    valuation = requireFcffDcfValuation(rendered);
    expect(valuation.props.marketOverview).toBeNull();
    expect(valuation.props.valuationHistory).toBeNull();
    expect(valuation.props.annualFinancials).not.toBeNull();
  });

  it("feeds the quality scorecard only the explicitly loaded selected annual financials", async () => {
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");
    let scorecard = requireFinancialQualityScorecard(rendered);

    expect(scorecard.props).toMatchObject({
      financials: null,
      selection: { listingId: "lst-zero", symbol: "ZERO" },
    });
    expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();

    requireAnnualFinancials(rendered).props.onLoad();
    await flushPromises();
    rendered = renderWorkspace();
    scorecard = requireFinancialQualityScorecard(rendered);

    expect(scorecard.props.financials).toMatchObject({
      security: { listingId: "lst-zero", symbol: "ZERO" },
    });
    expect(apiMocks.fetchPersonalAnnualFinancials).toHaveBeenCalledTimes(1);
  });

  it("adds a manual peer without a request and loads only that peer after the explicit action", async () => {
    const subject = searchResult("ZERO", "lst-zero");
    const peer = searchResult("PEER", "lst-peer");
    apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
      limitApplied: 15,
      normalizedQuery: "ZERO",
      results: [subject, peer],
      snapshot: snapshot(),
      totalMatches: 2,
    });
    apiMocks.fetchPersonalAnnualFinancials.mockImplementation((input) =>
      Promise.resolve(annualFinancials(input.listingId, input.symbol)),
    );
    apiMocks.fetchPersonalValuationHistory.mockImplementation((input) =>
      Promise.resolve(valuationHistory(input.listingId, input.symbol)),
    );
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");

    requireAnnualFinancials(rendered).props.onLoad();
    requireValuationHistory(rendered).props.onLoad();
    await flushPromises();
    rendered = renderWorkspace();
    apiMocks.fetchPersonalAnnualFinancials.mockClear();
    apiMocks.fetchPersonalValuationHistory.mockClear();

    let comparison = requireManualPeerComparison(rendered);
    const candidate = comparison.props.candidates.find(
      (value) => value.listingId === "lst-peer",
    );
    expect(candidate).toMatchObject({
      issuerId: "iss-peer",
      listingId: "lst-peer",
      symbol: "PEER",
    });
    if (candidate === undefined) throw new Error("Expected peer candidate.");
    comparison.props.onAddPeer(candidate);
    rendered = renderWorkspace();
    comparison = requireManualPeerComparison(rendered);

    expect(comparison.props.peers).toHaveLength(1);
    expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalValuationHistory).not.toHaveBeenCalled();

    comparison.props.onLoadPeerData("lst-peer");
    rendered = renderWorkspace();
    expect(requireManualPeerComparison(rendered).props.peers[0]).toMatchObject({
      annualFinancials: null,
      requestState: "loading",
      valuationHistory: null,
    });
    expect(
      apiMocks.fetchPersonalAnnualFinancials,
    ).toHaveBeenCalledExactlyOnceWith(
      { listingId: "lst-peer", symbol: "PEER" },
      expect.any(AbortSignal),
    );
    expect(
      apiMocks.fetchPersonalValuationHistory,
    ).toHaveBeenCalledExactlyOnceWith(
      { listingId: "lst-peer", range: "1y", symbol: "PEER" },
      expect.any(AbortSignal),
    );

    await flushPromises();
    rendered = renderWorkspace();
    expect(requireManualPeerComparison(rendered).props.peers[0]).toMatchObject({
      annualErrorCode: null,
      annualFinancials: {
        security: { listingId: "lst-peer", symbol: "PEER" },
      },
      requestState: "idle",
      valuationErrorCode: null,
      valuationHistory: {
        security: { listingId: "lst-peer", symbol: "PEER" },
      },
    });
  });

  it("does not start a peer request before the selected-company inputs are ready", async () => {
    apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
      limitApplied: 15,
      normalizedQuery: "ZERO",
      results: [
        searchResult("ZERO", "lst-zero"),
        searchResult("PEER", "lst-peer"),
      ],
      snapshot: snapshot(),
      totalMatches: 2,
    });
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");
    let comparison = requireManualPeerComparison(rendered);
    const candidate = comparison.props.candidates[0];
    if (candidate === undefined) throw new Error("Expected peer candidate.");
    comparison.props.onAddPeer(candidate);
    rendered = renderWorkspace();
    comparison = requireManualPeerComparison(rendered);
    comparison.props.onLoadPeerData("lst-peer");
    await flushPromises();

    expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalValuationHistory).not.toHaveBeenCalled();
    expect(
      requireManualPeerComparison(renderWorkspace()).props.peers[0],
    ).toMatchObject({ requestState: "idle" });

    rendered = renderWorkspace();
    requireAnnualFinancials(rendered).props.onLoad();
    await flushPromises();
    rendered = renderWorkspace();
    apiMocks.fetchPersonalAnnualFinancials.mockClear();
    apiMocks.fetchPersonalValuationHistory.mockClear();
    requireManualPeerComparison(rendered).props.onLoadPeerData("lst-peer");
    await flushPromises();
    expect(apiMocks.fetchPersonalAnnualFinancials).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchPersonalValuationHistory).toHaveBeenCalledTimes(1);
  });

  it("allows peer acquisition from a same-range valuation-only primary", async () => {
    apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
      limitApplied: 15,
      normalizedQuery: "ZERO",
      results: [
        searchResult("ZERO", "lst-zero"),
        searchResult("PEER", "lst-peer"),
      ],
      snapshot: snapshot(),
      totalMatches: 2,
    });
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");
    requireValuationHistory(rendered).props.onLoad();
    await flushPromises();
    rendered = renderWorkspace();
    const candidate = requireManualPeerComparison(rendered).props.candidates[0];
    if (candidate === undefined) throw new Error("Expected peer candidate.");
    requireManualPeerComparison(rendered).props.onAddPeer(candidate);
    rendered = renderWorkspace();
    apiMocks.fetchPersonalAnnualFinancials.mockClear();
    apiMocks.fetchPersonalValuationHistory.mockClear();

    requireManualPeerComparison(rendered).props.onLoadPeerData("lst-peer");
    await flushPromises();
    expect(apiMocks.fetchPersonalAnnualFinancials).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchPersonalValuationHistory).toHaveBeenCalledTimes(1);
  });

  it("isolates manual-peer partial failures and caps provider work at two concurrent requests", async () => {
    const peers = [
      searchResult("ONE", "lst-one"),
      searchResult("TWO", "lst-two"),
    ];
    apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
      limitApplied: 15,
      normalizedQuery: "ZERO",
      results: [searchResult("ZERO", "lst-zero"), ...peers],
      snapshot: snapshot(),
      totalMatches: 3,
    });
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");
    requireAnnualFinancials(rendered).props.onLoad();
    requireValuationHistory(rendered).props.onLoad();
    await flushPromises();
    rendered = renderWorkspace();
    apiMocks.fetchPersonalAnnualFinancials.mockClear();
    apiMocks.fetchPersonalValuationHistory.mockClear();

    let comparison = requireManualPeerComparison(rendered);
    for (const candidate of comparison.props.candidates) {
      comparison.props.onAddPeer(candidate);
      rendered = renderWorkspace();
      comparison = requireManualPeerComparison(rendered);
    }
    const pendingAnnual = deferred<PersonalAnnualFinancialsDto>();
    apiMocks.fetchPersonalAnnualFinancials.mockReturnValueOnce(
      pendingAnnual.promise,
    );
    apiMocks.fetchPersonalValuationHistory.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("not_entitled"),
    );

    comparison.props.onLoadPeerData("lst-one");
    comparison.props.onLoadPeerData("lst-two");
    expect(apiMocks.fetchPersonalAnnualFinancials).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchPersonalValuationHistory).toHaveBeenCalledTimes(1);

    pendingAnnual.resolve(annualFinancials("lst-one", "ONE"));
    await flushPromises();
    rendered = renderWorkspace();
    expect(requireManualPeerComparison(rendered).props.peers[0]).toMatchObject({
      annualErrorCode: null,
      annualFinancials: {
        security: { listingId: "lst-one", symbol: "ONE" },
      },
      requestState: "idle",
      valuationErrorCode: "not_entitled",
      valuationHistory: null,
    });
  });

  it("aborts manual-peer work and clears stale peer data on subject changes", async () => {
    const pendingAnnual = deferred<PersonalAnnualFinancialsDto>();
    const pendingValuation = deferred<PersonalValuationHistoryDto>();
    const subject = searchResult("ZERO", "lst-zero");
    const peer = searchResult("PEER", "lst-peer");
    apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
      limitApplied: 15,
      normalizedQuery: "ZERO",
      results: [subject, peer],
      snapshot: snapshot(),
      totalMatches: 2,
    });
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");
    requireAnnualFinancials(rendered).props.onLoad();
    requireValuationHistory(rendered).props.onLoad();
    await flushPromises();
    rendered = renderWorkspace();
    const comparison = requireManualPeerComparison(rendered);
    const candidate = comparison.props.candidates[0];
    if (candidate === undefined) throw new Error("Expected peer candidate.");
    comparison.props.onAddPeer(candidate);
    rendered = renderWorkspace();
    apiMocks.fetchPersonalAnnualFinancials.mockReturnValueOnce(
      pendingAnnual.promise,
    );
    apiMocks.fetchPersonalValuationHistory.mockReturnValueOnce(
      pendingValuation.promise,
    );
    requireManualPeerComparison(rendered).props.onLoadPeerData("lst-peer");
    rendered = renderWorkspace();
    const annualSignal =
      apiMocks.fetchPersonalAnnualFinancials.mock.calls.at(-1)?.[1];
    const valuationSignal =
      apiMocks.fetchPersonalValuationHistory.mock.calls.at(-1)?.[1];

    const viewButtons = findAllElements(rendered, "button").filter(
      (button) => textContent(button) === "View market",
    ) as React.ReactElement<{ onClick: () => void }>[];
    viewButtons[1]?.props.onClick();
    expect(annualSignal?.aborted).toBe(true);
    expect(valuationSignal?.aborted).toBe(true);
    pendingAnnual.resolve(annualFinancials("lst-peer", "PEER"));
    pendingValuation.resolve(valuationHistory("lst-peer", "PEER"));
    await flushPromises();
    rendered = renderWorkspace();

    expect(requireManualPeerComparison(rendered).props.peers).toEqual([]);
    expect(requireManualPeerComparison(rendered).props.selection).toMatchObject(
      {
        listingId: "lst-peer",
        symbol: "PEER",
      },
    );
  });

  it("clears the owner workspace immediately when either peer read loses the session", async () => {
    const pendingValuation = deferred<PersonalValuationHistoryDto>();
    apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
      limitApplied: 15,
      normalizedQuery: "ZERO",
      results: [
        searchResult("ZERO", "lst-zero"),
        searchResult("PEER", "lst-peer"),
      ],
      snapshot: snapshot(),
      totalMatches: 2,
    });
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");
    requireAnnualFinancials(rendered).props.onLoad();
    requireValuationHistory(rendered).props.onLoad();
    await flushPromises();
    rendered = renderWorkspace();
    const comparison = requireManualPeerComparison(rendered);
    const candidate = comparison.props.candidates[0];
    if (candidate === undefined) throw new Error("Expected peer candidate.");
    comparison.props.onAddPeer(candidate);
    rendered = renderWorkspace();
    apiMocks.fetchPersonalAnnualFinancials.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    apiMocks.fetchPersonalValuationHistory.mockReturnValueOnce(
      pendingValuation.promise,
    );
    requireManualPeerComparison(rendered).props.onLoadPeerData("lst-peer");
    await flushPromises();
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(findManualPeerComparison(rendered)).toBeUndefined();
    expect(
      apiMocks.fetchPersonalValuationHistory.mock.calls.at(-1)?.[1].aborted,
    ).toBe(true);
  });

  it("restores loaded peer annuals when a range change interrupts a refresh", async () => {
    apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
      limitApplied: 15,
      normalizedQuery: "ZERO",
      results: [
        searchResult("ZERO", "lst-zero"),
        searchResult("PEER", "lst-peer"),
      ],
      snapshot: snapshot(),
      totalMatches: 2,
    });
    apiMocks.fetchPersonalAnnualFinancials.mockImplementation((input) =>
      Promise.resolve(annualFinancials(input.listingId, input.symbol)),
    );
    apiMocks.fetchPersonalValuationHistory.mockImplementation((input) =>
      Promise.resolve(valuationHistory(input.listingId, input.symbol)),
    );
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");
    requireAnnualFinancials(rendered).props.onLoad();
    requireValuationHistory(rendered).props.onLoad();
    await flushPromises();
    rendered = renderWorkspace();
    const candidate = requireManualPeerComparison(rendered).props.candidates[0];
    if (candidate === undefined) throw new Error("Expected peer candidate.");
    requireManualPeerComparison(rendered).props.onAddPeer(candidate);
    rendered = renderWorkspace();
    requireManualPeerComparison(rendered).props.onLoadPeerData("lst-peer");
    await flushPromises();
    rendered = renderWorkspace();
    expect(requireManualPeerComparison(rendered).props.peers[0]).toMatchObject({
      annualFinancials: {
        security: { listingId: "lst-peer", symbol: "PEER" },
      },
      valuationHistory: {
        history: { range: "1y" },
        security: { listingId: "lst-peer", symbol: "PEER" },
      },
    });

    const pendingAnnual = deferred<PersonalAnnualFinancialsDto>();
    const pendingValuation = deferred<PersonalValuationHistoryDto>();
    apiMocks.fetchPersonalAnnualFinancials.mockReturnValueOnce(
      pendingAnnual.promise,
    );
    apiMocks.fetchPersonalValuationHistory.mockReturnValueOnce(
      pendingValuation.promise,
    );
    requireManualPeerComparison(rendered).props.onLoadPeerData("lst-peer");
    rendered = renderWorkspace();
    const annualSignal =
      apiMocks.fetchPersonalAnnualFinancials.mock.calls.at(-1)?.[1];
    const valuationSignal =
      apiMocks.fetchPersonalValuationHistory.mock.calls.at(-1)?.[1];
    requireMarketOverview(rendered).props.onLoad("5y");
    expect(annualSignal?.aborted).toBe(true);
    expect(valuationSignal?.aborted).toBe(true);
    rendered = renderWorkspace();
    expect(requireManualPeerComparison(rendered).props.peers[0]).toMatchObject({
      annualFinancials: {
        security: { listingId: "lst-peer", symbol: "PEER" },
      },
      requestState: "idle",
      valuationErrorCode: null,
      valuationHistory: null,
    });

    pendingAnnual.resolve(annualFinancials("lst-peer", "PEER"));
    pendingValuation.resolve(valuationHistory("lst-peer", "PEER"));
    await flushPromises();
    expect(
      requireManualPeerComparison(renderWorkspace()).props.peers[0]
        ?.valuationHistory,
    ).toBeNull();
  });

  it("aborts and clears valuation history when the selected market range changes", async () => {
    const pending = deferred<PersonalValuationHistoryDto>();
    apiMocks.fetchPersonalValuationHistory.mockReturnValueOnce(pending.promise);
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");

    requireValuationHistory(rendered).props.onLoad();
    rendered = renderWorkspace();
    const pendingSignal =
      apiMocks.fetchPersonalValuationHistory.mock.calls[0]?.[1];
    requireMarketOverview(rendered).props.onLoad("5y");
    expect(pendingSignal?.aborted).toBe(true);
    pending.resolve(valuationHistory());
    await flushPromises();
    rendered = renderWorkspace();

    const valuation = requireValuationHistory(rendered);
    expect(valuation.props.range).toBe("5y");
    expect(valuation.props.history).toBeNull();
    expect(valuation.props.requestState).toBe("idle");
  });

  it("aborts and clears a pending valuation response when the owner session ends", async () => {
    const pending = deferred<PersonalValuationHistoryDto>();
    apiMocks.fetchPersonalValuationHistory.mockReturnValueOnce(pending.promise);
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");

    requireValuationHistory(rendered).props.onLoad();
    rendered = renderWorkspace();
    const pendingSignal =
      apiMocks.fetchPersonalValuationHistory.mock.calls[0]?.[1];
    const sessionChange = requireOwnerSession(rendered).props.onSessionChange(
      false,
      new AbortController().signal,
    );
    expect(pendingSignal?.aborted).toBe(true);
    pending.resolve(valuationHistory());
    await sessionChange;
    await flushPromises();
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(findValuationHistory(rendered)).toBeUndefined();
  });

  it("keeps a fundamentals entitlement failure distinct from session loss", async () => {
    apiMocks.fetchPersonalAnnualFinancials.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("not_entitled"),
    );
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");

    requireAnnualFinancials(rendered).props.onLoad();
    await flushPromises();
    rendered = renderWorkspace();

    expect(requireAnnualFinancials(rendered).props.errorCode).toBe(
      "not_entitled",
    );
    expect(textContent(rendered)).toContain("Find a company");
    expect(findOwnerSession(rendered)).toBeDefined();
  });

  it("ignores an older annual-financials response after another security is selected", async () => {
    const first = deferred<PersonalAnnualFinancialsDto>();
    apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
      limitApplied: 15,
      normalizedQuery: "PAIR",
      results: [
        searchResult("ZERO", "lst-zero"),
        searchResult("TWO", "lst-two"),
      ],
      snapshot: snapshot(),
      totalMatches: 2,
    });
    apiMocks.fetchPersonalAnnualFinancials.mockReturnValueOnce(first.promise);
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("PAIR");

    requireAnnualFinancials(rendered).props.onLoad();
    rendered = renderWorkspace();
    const firstSignal =
      apiMocks.fetchPersonalAnnualFinancials.mock.calls[0]?.[1];
    const viewButtons = findAllElements(rendered, "button").filter(
      (button) => textContent(button) === "View market",
    ) as React.ReactElement<{ onClick: () => void }>[];
    viewButtons[1]?.props.onClick();
    expect(firstSignal?.aborted).toBe(true);

    first.resolve(annualFinancials("lst-zero", "ZERO"));
    await flushPromises();
    rendered = renderWorkspace();

    const annual = requireAnnualFinancials(rendered);
    expect(annual.props.selection).toMatchObject({
      listingId: "lst-two",
      symbol: "TWO",
    });
    expect(annual.props.financials).toBeNull();
    expect(annual.props.requestState).toBe("idle");
  });

  it("clears a pending annual-financials response when the owner session ends", async () => {
    const pending = deferred<PersonalAnnualFinancialsDto>();
    apiMocks.fetchPersonalAnnualFinancials.mockReturnValueOnce(pending.promise);
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");

    requireAnnualFinancials(rendered).props.onLoad();
    rendered = renderWorkspace();
    const pendingSignal =
      apiMocks.fetchPersonalAnnualFinancials.mock.calls[0]?.[1];
    const sessionChange = requireOwnerSession(rendered).props.onSessionChange(
      false,
      new AbortController().signal,
    );
    expect(pendingSignal?.aborted).toBe(true);
    pending.resolve(annualFinancials());
    await sessionChange;
    await flushPromises();
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(findAnnualFinancials(rendered)).toBeUndefined();

    await expect(
      requireOwnerSession(rendered).props.onSessionChange(
        true,
        new AbortController().signal,
      ),
    ).resolves.toBe(true);
    rendered = renderWorkspace();
    expect(requireAnnualFinancials(rendered).props.financials).toBeNull();
    expect(apiMocks.fetchPersonalAnnualFinancials).toHaveBeenCalledOnce();
  });

  it("ignores an older quarterly-financials response after another security is selected", async () => {
    const first = deferred<PersonalQuarterlyFinancialsDto>();
    apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
      limitApplied: 15,
      normalizedQuery: "PAIR",
      results: [
        searchResult("ZERO", "lst-zero"),
        searchResult("TWO", "lst-two"),
      ],
      snapshot: snapshot(),
      totalMatches: 2,
    });
    apiMocks.fetchPersonalQuarterlyFinancials.mockReturnValueOnce(
      first.promise,
    );
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("PAIR");

    requireQuarterlyFinancials(rendered).props.onLoad();
    rendered = renderWorkspace();
    const firstSignal =
      apiMocks.fetchPersonalQuarterlyFinancials.mock.calls[0]?.[1];
    const viewButtons = findAllElements(rendered, "button").filter(
      (button) => textContent(button) === "View market",
    ) as React.ReactElement<{ onClick: () => void }>[];
    viewButtons[1]?.props.onClick();
    expect(firstSignal?.aborted).toBe(true);

    first.resolve(quarterlyFinancials("lst-zero", "ZERO"));
    await flushPromises();
    rendered = renderWorkspace();

    const quarterly = requireQuarterlyFinancials(rendered);
    expect(quarterly.props.selection).toMatchObject({
      listingId: "lst-two",
      symbol: "TWO",
    });
    expect(quarterly.props.financials).toBeNull();
    expect(quarterly.props.requestState).toBe("idle");
  });

  it("clears a pending quarterly-financials response when the owner session ends", async () => {
    const pending = deferred<PersonalQuarterlyFinancialsDto>();
    apiMocks.fetchPersonalQuarterlyFinancials.mockReturnValueOnce(
      pending.promise,
    );
    await activateWorkspace();
    let rendered: React.ReactNode = await searchAndSelectMarket("ZERO");

    requireQuarterlyFinancials(rendered).props.onLoad();
    rendered = renderWorkspace();
    const pendingSignal =
      apiMocks.fetchPersonalQuarterlyFinancials.mock.calls[0]?.[1];
    const sessionChange = requireOwnerSession(rendered).props.onSessionChange(
      false,
      new AbortController().signal,
    );
    expect(pendingSignal?.aborted).toBe(true);
    pending.resolve(quarterlyFinancials());
    await sessionChange;
    await flushPromises();
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(findQuarterlyFinancials(rendered)).toBeUndefined();

    await expect(
      requireOwnerSession(rendered).props.onSessionChange(
        true,
        new AbortController().signal,
      ),
    ).resolves.toBe(true);
    rendered = renderWorkspace();
    expect(requireQuarterlyFinancials(rendered).props.financials).toBeNull();
    expect(apiMocks.fetchPersonalQuarterlyFinancials).toHaveBeenCalledOnce();
  });

  it("clears a selected market graph synchronously when its request loses the session", async () => {
    apiMocks.fetchPersonalMarketOverview.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    await activateWorkspace();
    let rendered = renderWorkspace();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "security-query" }).props.onChange({
      target: { value: "ZERO" },
    });
    rendered = renderWorkspace();
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, { className: "security-search-form" }).props.onSubmit({
      preventDefault: vi.fn(),
    });
    await flushPromises();
    rendered = renderWorkspace();
    requireButton(rendered, "View market").props.onClick();
    rendered = renderWorkspace();

    requireMarketOverview(rendered).props.onLoad("1y");
    await flushPromises();
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(textContent(rendered)).toContain("Revalidate the session");
    expect(findMarketOverview(rendered)).toBeUndefined();
  });

  it("ignores an older market response after another security is selected", async () => {
    const first = deferred<PersonalMarketOverviewDto>();
    apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
      limitApplied: 15,
      normalizedQuery: "PAIR",
      results: [
        searchResult("ZERO", "lst-zero"),
        searchResult("TWO", "lst-two"),
      ],
      snapshot: snapshot(),
      totalMatches: 2,
    });
    apiMocks.fetchPersonalMarketOverview.mockReturnValueOnce(first.promise);
    await activateWorkspace();
    let rendered = renderWorkspace();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "security-query" }).props.onChange({
      target: { value: "PAIR" },
    });
    rendered = renderWorkspace();
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, { className: "security-search-form" }).props.onSubmit({
      preventDefault: vi.fn(),
    });
    await flushPromises();
    rendered = renderWorkspace();
    const viewButtons = findAllElements(rendered, "button").filter(
      (button) => textContent(button) === "View market",
    ) as React.ReactElement<{ onClick: () => void }>[];
    viewButtons[0]?.props.onClick();
    rendered = renderWorkspace();
    requireMarketOverview(rendered).props.onLoad("1y");

    viewButtons[1]?.props.onClick();
    first.resolve(marketOverview());
    await flushPromises();
    rendered = renderWorkspace();

    const market = requireMarketOverview(rendered);
    expect(market.props.selection).toMatchObject({
      listingId: "lst-two",
      symbol: "TWO",
    });
    expect(market.props.overview).toBeNull();
  });

  it("persists reordering, inline notes, and removal", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce({
      id: "main",
      version: 4,
      createdAt: "2030-01-15T01:00:00.000Z",
      updatedAt: "2030-01-15T02:00:00.000Z",
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: snapshot().snapshotSha256,
        memberships: [
          membership("ONE", "lst-one"),
          membership("TWO", "lst-two"),
        ],
      },
    });
    await activateWorkspace();
    let rendered = renderWorkspace();

    requireElementByProps<{ onClick: () => void }>(rendered, {
      "aria-label": "Move TWO up",
    }).props.onClick();
    await flushPromises();
    expect(
      apiMocks.saveMainPersonalWatchlist.mock.calls[0]?.[1].memberships.map(
        (entry: { symbol: string }) => entry.symbol,
      ),
    ).toEqual(["TWO", "ONE"]);

    rendered = renderWorkspace();
    const note = requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "note-lst-two" });
    note.props.onChange({ target: { value: "  Watch margins  " } });
    rendered = renderWorkspace();
    requireButton(rendered, "Save note").props.onClick();
    await flushPromises();
    const notePayload = apiMocks.saveMainPersonalWatchlist.mock.calls[1]?.[1];
    expect(notePayload?.memberships[0]).toMatchObject({
      symbol: "TWO",
      note: "Watch margins",
    });

    rendered = renderWorkspace();
    requireButton(rendered, "Remove").props.onClick();
    await flushPromises();
    const removePayload = apiMocks.saveMainPersonalWatchlist.mock.calls[2]?.[1];
    expect(removePayload?.memberships).toHaveLength(1);
  });

  it("previews heuristic misses without saving and removes them only after separate confirmation", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce({
      id: "main",
      version: 7,
      createdAt: "2030-01-15T01:00:00.000Z",
      updatedAt: "2030-01-15T02:00:00.000Z",
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: `sha256:${"d".repeat(64)}`,
        memberships: [
          { ...membership("OLD", "lst-retained"), note: "Keep this note" },
          membership("DROP", "lst-unmatched"),
        ],
      },
    });
    apiMocks.searchPersonalSecurities.mockImplementation(
      (query: string, _signal: AbortSignal, limit: number) =>
        Promise.resolve({
          limitApplied: limit,
          normalizedQuery: query,
          results:
            query === "OLD" ? [searchResult("CURRENT", "lst-retained")] : [],
          snapshot: snapshot(),
          totalMatches: query === "OLD" ? 1 : 0,
        }),
    );
    await activateWorkspace();
    let rendered = renderWorkspace();

    expect(requireButton(rendered, "Remove").props.disabled).toBe(true);
    expect(
      requireElementByProps<{ disabled?: boolean }>(rendered, {
        id: "note-lst-retained",
      }).props.disabled,
    ).toBe(true);
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();

    requireButton(rendered, "Reconcile watchlist").props.onClick();
    await flushPromises(16);
    rendered = renderWorkspace();

    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
    expect(textContent(rendered)).toContain(
      "Preview only — no changes were saved",
    );
    expect(textContent(rendered)).toContain("DROP");

    requireButton(
      rendered,
      "Remove 1 unmatched and finish reconciliation",
    ).props.onClick();
    await flushPromises();
    rendered = renderWorkspace();

    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    const saved = apiMocks.saveMainPersonalWatchlist.mock.calls[0]?.[1];
    expect(saved?.snapshotSha256).toBe(snapshot().snapshotSha256);
    expect(saved?.memberships).toEqual([
      expect.objectContaining({
        listingId: "lst-retained",
        note: "Keep this note",
        symbol: "CURRENT",
      }),
    ]);
    expect(textContent(rendered)).toContain(
      "1 unmatched entry was removed (DROP)",
    );
  });

  it("retains an edited note through a conflicted save and reload", async () => {
    const storedRecord: PersonalWatchlistRecord = {
      id: "main",
      version: 2,
      createdAt: "2030-01-15T01:00:00.000Z",
      updatedAt: "2030-01-15T02:00:00.000Z",
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: snapshot().snapshotSha256,
        memberships: [membership("ONE", "lst-one")],
      },
    };
    apiMocks.fetchMainPersonalWatchlist
      .mockResolvedValueOnce(storedRecord)
      .mockResolvedValueOnce({ ...storedRecord, version: 3 });
    apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("conflict"),
    );
    await activateWorkspace();
    let rendered = renderWorkspace();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "note-lst-one" }).props.onChange({
      target: { value: "  Unsaved margin note  " },
    });
    rendered = renderWorkspace();

    requireButton(rendered, "Save note").props.onClick();
    await flushPromises();
    rendered = renderWorkspace();

    expect(
      requireElementByProps<{ value: string }>(rendered, {
        id: "note-lst-one",
      }).props.value,
    ).toBe("  Unsaved margin note  ");
    expect(textContent(rendered)).toContain(
      "The watchlist changed in another tab",
    );
  });

  it("prevents note edits while a save is in flight", async () => {
    const storedRecord: PersonalWatchlistRecord = {
      id: "main",
      version: 2,
      createdAt: "2030-01-15T01:00:00.000Z",
      updatedAt: "2030-01-15T02:00:00.000Z",
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: snapshot().snapshotSha256,
        memberships: [membership("ONE", "lst-one")],
      },
    };
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(storedRecord);
    let finishSave: ((saved: SavedPersonalWatchlist) => void) | undefined;
    apiMocks.saveMainPersonalWatchlist.mockImplementationOnce(
      (_version: number, payload: PersonalWatchlistPayload) =>
        new Promise((resolve) => {
          finishSave = resolve;
          void payload;
        }),
    );
    await activateWorkspace();
    let rendered = renderWorkspace();

    requireButton(rendered, "Save note").props.onClick();
    rendered = renderWorkspace();

    expect(
      requireElementByProps<{ disabled?: boolean }>(rendered, {
        id: "note-lst-one",
      }).props.disabled,
    ).toBe(true);
    const pendingPayload =
      apiMocks.saveMainPersonalWatchlist.mock.calls[0]?.[1];
    if (pendingPayload === undefined || finishSave === undefined) {
      throw new Error("Expected pending watchlist save.");
    }
    finishSave({ version: 3, payload: pendingPayload });
    await flushPromises();
  });

  it("clears rendered private data when an operation loses the owner session", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce({
      id: "main",
      version: 2,
      createdAt: "2030-01-15T01:00:00.000Z",
      updatedAt: "2030-01-15T02:00:00.000Z",
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: snapshot().snapshotSha256,
        memberships: [membership("PRIVATE", "lst-private")],
      },
    });
    apiMocks.searchPersonalSecurities.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    await activateWorkspace();
    let rendered = renderWorkspace();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "security-query" }).props.onChange({
      target: { value: "PRIVATE" },
    });
    rendered = renderWorkspace();
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, { className: "security-search-form" }).props.onSubmit({
      preventDefault: vi.fn(),
    });
    await flushPromises();
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(textContent(rendered)).toContain("Revalidate the session");
    expect(textContent(rendered)).not.toContain("PRIVATE");
    expect(textContent(rendered)).not.toContain("3,001");

    await expect(
      requireOwnerSession(rendered).props.onSessionChange(
        true,
        new AbortController().signal,
      ),
    ).resolves.toBe(true);
    rendered = renderWorkspace();
    expect(
      requireElementByProps<{ value: string }>(rendered, {
        id: "security-query",
      }).props.value,
    ).toBe("");
  });

  it("does not present transport failures as valid empty search results", async () => {
    apiMocks.searchPersonalSecurities.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("unavailable"),
    );
    await activateWorkspace();
    let rendered = renderWorkspace();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "security-query" }).props.onChange({
      target: { value: "MISSING" },
    });
    rendered = renderWorkspace();
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, { className: "security-search-form" }).props.onSubmit({
      preventDefault: vi.fn(),
    });
    await flushPromises();
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain(
      "Search is temporarily unavailable",
    );
    expect(textContent(rendered)).not.toContain("No results to show");
  });

  it("clears private results synchronously when the owner session ends", async () => {
    await activateWorkspace();
    let rendered = renderWorkspace();
    expect(textContent(rendered)).toContain("Find a company");
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "security-query" }).props.onChange({
      target: { value: "SHOULD CLEAR" },
    });
    rendered = renderWorkspace();

    const clearing = requireOwnerSession(rendered).props.onSessionChange(
      false,
      new AbortController().signal,
    );
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(textContent(rendered)).not.toContain("3,001");
    await expect(clearing).resolves.toBe(false);

    await expect(
      requireOwnerSession(rendered).props.onSessionChange(
        true,
        new AbortController().signal,
      ),
    ).resolves.toBe(true);
    rendered = renderWorkspace();
    expect(
      requireElementByProps<{ value: string }>(rendered, {
        id: "security-query",
      }).props.value,
    ).toBe("");
  });
});

async function activateWorkspace() {
  const owner = requireOwnerSession(renderWorkspace());
  await owner.props.onSessionChange(true, new AbortController().signal);
}

function renderWorkspace(): React.ReactNode {
  hookHarness.beginRender();
  return SecurityDiscoveryWorkspace();
}

function findOwnerSession(value: unknown) {
  return findElement<{
    onSessionChange: (active: boolean, signal: AbortSignal) => Promise<boolean>;
  }>(value, componentMocks.OwnerSession);
}

function findMarketOverview(value: unknown) {
  return findElement<PersonalMarketOverviewProps>(
    value,
    componentMocks.MarketOverview,
  );
}

function findManualPeerComparison(value: unknown) {
  return findElement<PersonalManualPeerComparisonProps>(
    value,
    componentMocks.ManualPeerComparison,
  );
}

function findStockScreener(value: unknown) {
  return findElement<PersonalStockScreenerProps>(
    value,
    componentMocks.StockScreener,
  );
}

function requireStockScreener(value: unknown) {
  const screener = findStockScreener(value);
  if (screener === undefined) throw new Error("Expected stock screener.");
  return screener;
}

function findAnnualFinancials(value: unknown) {
  return findElement<PersonalAnnualFinancialsProps>(
    value,
    componentMocks.AnnualFinancials,
  );
}

function findFcffDcfValuation(value: unknown) {
  return findElement<PersonalFcffDcfValuationProps>(
    value,
    componentMocks.FcffDcfValuation,
  );
}

function findFinancialQualityScorecard(value: unknown) {
  return findElement<PersonalFinancialQualityScorecardProps>(
    value,
    componentMocks.FinancialQualityScorecard,
  );
}

function findHistoricalMultipleValuation(value: unknown) {
  return findElement<PersonalHistoricalMultipleValuationProps>(
    value,
    componentMocks.HistoricalMultipleValuation,
  );
}

function findQuarterlyFinancials(value: unknown) {
  return findElement<PersonalQuarterlyFinancialsProps>(
    value,
    componentMocks.QuarterlyFinancials,
  );
}

function findValuationHistory(value: unknown) {
  return findElement<PersonalValuationHistoryProps>(
    value,
    componentMocks.ValuationHistory,
  );
}

function requireAnnualFinancials(value: unknown) {
  const annual = findAnnualFinancials(value);
  if (annual === undefined) throw new Error("Expected annual financials.");
  return annual;
}

function requireFcffDcfValuation(value: unknown) {
  const valuation = findFcffDcfValuation(value);
  if (valuation === undefined) throw new Error("Expected FCFF DCF valuation.");
  return valuation;
}

function requireFinancialQualityScorecard(value: unknown) {
  const scorecard = findFinancialQualityScorecard(value);
  if (scorecard === undefined)
    throw new Error("Expected financial quality scorecard.");
  return scorecard;
}

function requireQuarterlyFinancials(value: unknown) {
  const quarterly = findQuarterlyFinancials(value);
  if (quarterly === undefined)
    throw new Error("Expected quarterly financials.");
  return quarterly;
}

function requireHistoricalMultipleValuation(value: unknown) {
  const valuation = findHistoricalMultipleValuation(value);
  if (valuation === undefined)
    throw new Error("Expected historical-multiple valuation.");
  return valuation;
}

function requireValuationHistory(value: unknown) {
  const valuation = findValuationHistory(value);
  if (valuation === undefined) throw new Error("Expected valuation history.");
  return valuation;
}

function requireMarketOverview(value: unknown) {
  const market = findMarketOverview(value);
  if (market === undefined) throw new Error("Expected market overview.");
  return market;
}

function requireManualPeerComparison(value: unknown) {
  const comparison = findManualPeerComparison(value);
  if (comparison === undefined)
    throw new Error("Expected manual peer comparison.");
  return comparison;
}

function requireOwnerSession(value: unknown) {
  const owner = findOwnerSession(value);
  if (owner === undefined) throw new Error("Expected owner-session panel.");
  return owner;
}

async function searchAndSelectMarket(query: string, resultIndex = 0) {
  let rendered = renderWorkspace();
  requireElementByProps<{
    onChange: (event: { target: { value: string } }) => void;
  }>(rendered, { id: "security-query" }).props.onChange({
    target: { value: query },
  });
  rendered = renderWorkspace();
  requireElementByProps<{
    onSubmit: (event: { preventDefault: () => void }) => void;
  }>(rendered, { className: "security-search-form" }).props.onSubmit({
    preventDefault: vi.fn(),
  });
  await flushPromises();
  rendered = renderWorkspace();
  const viewButtons = findAllElements(rendered, "button").filter(
    (button) => textContent(button) === "View market",
  ) as React.ReactElement<{ onClick: () => void }>[];
  const selected = viewButtons[resultIndex];
  if (selected === undefined) throw new Error("Expected market selection.");
  selected.props.onClick();
  return renderWorkspace();
}

function requireButton(value: unknown, text: string) {
  const button = findAllElements(value, "button").find(
    (candidate) => textContent(candidate) === text,
  );
  if (button === undefined) throw new Error(`Expected button ${text}.`);
  return button as React.ReactElement<{
    disabled?: boolean;
    onClick: () => void;
  }>;
}

function requireElementByProps<Props extends object>(
  value: unknown,
  expected: Record<string, unknown>,
): React.ReactElement<Props> {
  const element = findAllElements(value).find((candidate) =>
    Object.entries(expected).every(
      ([key, expectedValue]) => candidate.props[key] === expectedValue,
    ),
  );
  if (element === undefined) throw new Error("Expected matching element.");
  return element as unknown as React.ReactElement<Props>;
}

function findAllElements(
  value: unknown,
  type?: React.ElementType,
): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) {
    return value.flatMap((child) => findAllElements(child, type));
  }
  if (!React.isValidElement(value)) return [];
  const own =
    type === undefined || value.type === type
      ? [value as React.ReactElement<Record<string, unknown>>]
      : [];
  return [
    ...own,
    ...findAllElements((value.props as { children?: unknown }).children, type),
  ];
}

function findElement<Props>(
  value: unknown,
  type: React.ElementType,
): React.ReactElement<Props> | undefined {
  return findAllElements(value, type)[0] as
    React.ReactElement<Props> | undefined;
}

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(textContent).join(" ");
  if (!React.isValidElement(value)) return "";
  return textContent((value.props as { children?: unknown }).children);
}

function snapshot(): PersonalSecurityMasterSnapshotReceiptDto {
  return {
    asOf: "2030-01-15T00:00:00.000Z",
    catalogId: "synthetic-browser-catalog",
    catalogVersion: "1.0.0",
    claim: "bounded_exact_owner_local_security_master_snapshot_admitted",
    coverage: {
      activeEligibleSecurities: 3_001,
      activeListings: 3_001,
      admittedSourceRecords: 3_001,
      basis: "owner_declared_snapshot_only",
      eligibleSecurityBand: "at_least_3000",
      formerTickerEntries: 0,
      ineligibleSourceRecords: 0,
      inactiveSecurities: 0,
      issuers: 2_990,
      providerMappings: 6_002,
      quarantinedSourceRecords: 0,
      sourceRecords: 3_001,
      staleSourceRecords: 0,
      shareClasses: 3_001,
      totalSecurities: 3_001,
      unsupportedSourceRecords: 0,
    },
    generatedAt: "2030-01-14T23:30:00.000Z",
    profile: "personal_single_user_local_security_master",
    provenance: {
      acquiredAt: "2030-01-14T23:00:00.000Z",
      artifacts: [],
      attribution: "Owner-local",
      contentKind: "owner_local_source",
      sourceId: "source-one",
      sourceRevision: `sha256:${"b".repeat(64)}`,
    },
    schemaVersion: "1.0.0",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    sourcePolicyCompatibility: {
      attribution: "required",
      cache: "permitted_owner_local",
      decision: "compatible",
      deleteOnRequest: true,
      display: "permitted_owner_local",
      effectiveAt: "2029-01-01T00:00:00.000Z",
      expiresAt: "2031-01-01T00:00:00.000Z",
      export: "prohibited",
      intendedUse: "personal_security_research",
      localOnly: true,
      operation: "fetch_snapshot",
      policyDocumentSha256: `sha256:${"c".repeat(64)}`,
      policyId: "policy-one",
      policyProfile: "personal_single_user_local_connected",
      policySchemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      redistribution: "prohibited",
      retention: "permitted_owner_local",
      reviewedAt: "2029-12-01T00:00:00.000Z",
      revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
      revokedAt: null,
      rightsBasis: "owner_reviewed_rights_compatible",
      search: "permitted_owner_local",
      sourceId: "source-one",
    },
    status: "admitted_for_personal_local_search",
  };
}

function searchResult(
  symbol: string,
  listingId: string,
): PersonalSecurityMasterSearchResultDto {
  const suffix = symbol.toLowerCase();
  return {
    cik: "0000000001",
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `iss-${suffix}`,
    issuerName: "Zero Alpha, Inc.",
    listingId,
    matchKind: "current_symbol_exact",
    matchedValue: symbol,
    securityId: `sec-${suffix}`,
    securityName: `${symbol} Common Stock`,
    shareClassId: `shr-${suffix}`,
    shareClassName: "Common",
    symbol,
  };
}

function screenRow(): PersonalSecurityMasterScreenRowDto {
  return {
    cik: "0000000002",
    country: "US",
    exchangeMic: "XNYS",
    instrumentType: "common_stock",
    issuerId: "iss-screen",
    issuerName: "Screen Company, Inc.",
    listingId: "lst-screen",
    securityId: "sec-screen",
    securityName: "Screen Company Common Stock",
    shareClassId: "shr-screen",
    shareClassName: "Common",
    symbol: "SCRN",
  };
}

function membership(symbol: string, listingId: string) {
  const result = searchResult(symbol, listingId);
  return {
    country: result.country,
    exchangeMic: result.exchangeMic,
    instrumentType: result.instrumentType,
    issuerId: result.issuerId,
    issuerName: result.issuerName,
    listingId: result.listingId,
    note: "",
    securityId: result.securityId,
    securityName: result.securityName,
    shareClassId: result.shareClassId,
    shareClassName: result.shareClassName,
    symbol: result.symbol,
  };
}

function marketStatus(): PersonalMarketDataStatusDto {
  return {
    profile: "personal_single_user_local_market_data",
    provider: marketProvider(),
    schemaVersion: "1.0.0",
    status: "configured",
  };
}

function marketOverview(): PersonalMarketOverviewDto {
  return {
    history: {
      bars: [
        {
          adjusted: {
            close: "101.50",
            high: "102.00",
            low: "99.00",
            open: "100.00",
            volume: "1200000",
          },
          date: "2030-01-14",
          dividendCash: "0",
          raw: {
            close: "101.50",
            high: "102.00",
            low: "99.00",
            open: "100.00",
            volume: "1200000",
          },
          splitFactor: "1",
        },
      ],
      endDate: "2030-01-14",
      range: "1y",
      startDate: "2030-01-14",
    },
    profile: "personal_single_user_local_market_data",
    provider: marketProvider(),
    quote: {
      change: "1.50",
      changePercent: "1.50",
      currency: "USD",
      freshness: "current",
      ingestedAt: "2030-01-15T00:01:00.000Z",
      kind: "derived_realtime_reference",
      previousClose: "100.00",
      price: "101.50",
      sourceTime: "2030-01-15T00:00:00.000Z",
    },
    schemaVersion: "1.0.0",
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "ZERO Common Stock",
      symbol: "ZERO",
    },
    status: "available",
  };
}

const annualFinancialReportedFieldKeys = [
  "revenue",
  "cost_of_revenue",
  "gross_profit",
  "research_and_development",
  "selling_general_and_administrative",
  "operating_expenses",
  "operating_income",
  "interest_expense",
  "pretax_income",
  "income_tax_expense",
  "net_income",
  "ebitda",
  "cash",
  "accounts_receivable",
  "inventory",
  "current_assets",
  "property_plant_equipment_net",
  "intangibles",
  "assets",
  "current_liabilities",
  "debt",
  "liabilities",
  "shareholders_equity",
  "depreciation_and_amortization",
  "share_based_compensation",
  "operating_cash_flow",
  "capital_expenditures",
  "free_cash_flow",
  "investing_cash_flow",
  "financing_cash_flow",
] as const satisfies readonly PersonalAnnualFinancialReportedFieldKeyDto[];

function annualFinancials(
  listingId = "lst-zero",
  symbol = "ZERO",
): PersonalAnnualFinancialsDto {
  return {
    asOf: "2030-01-15T21:01:00.000Z",
    coverage: {
      earliestFiscalYear: 2029,
      knownReportedCells: 30,
      latestFiscalYear: 2029,
      missingFiscalYears: [
        2028, 2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020,
      ],
      requestedAnnualYears: 10,
      returnedAnnualYears: 1,
      status: "partial",
      unknownReportedCells: 0,
    },
    profile: "personal_single_user_local_fundamentals",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      statementFeed: "tiingo_fundamentals_statements",
      valueCurrency: "USD",
    },
    schemaVersion: "1.1.0",
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: "Zero Alpha, Inc.",
      listingId,
      securityName: `${symbol} Common Stock`,
      symbol,
    },
    status: "available",
    years: [
      {
        fiscalYear: 2029,
        reported: Object.fromEntries(
          annualFinancialReportedFieldKeys.map((key, index) => [
            key,
            { status: "known", value: String((index + 1) * 100) },
          ]),
        ) as PersonalAnnualFinancialsDto["years"][number]["reported"],
        statementDate: "2030-01-15",
      },
    ],
  };
}

function quarterlyFinancials(
  listingId = "lst-zero",
  symbol = "ZERO",
): PersonalQuarterlyFinancialsDto {
  const reported = Object.fromEntries(
    annualFinancialReportedFieldKeys.map((key, index) => [
      key,
      { status: "known", value: String((index + 1) * 10) },
    ]),
  ) as PersonalQuarterlyFinancialsDto["quarters"][number]["reported"];
  return {
    asOf: "2030-01-15T21:01:00.000Z",
    coverage: {
      earliestFiscalQuarter: 4,
      earliestFiscalYear: 2029,
      knownReportedCells: 30,
      latestFiscalQuarter: 4,
      latestFiscalYear: 2029,
      missingFiscalQuarters: [
        { fiscalQuarter: 3, fiscalYear: 2029 },
        { fiscalQuarter: 2, fiscalYear: 2029 },
        { fiscalQuarter: 1, fiscalYear: 2029 },
        { fiscalQuarter: 4, fiscalYear: 2028 },
        { fiscalQuarter: 3, fiscalYear: 2028 },
        { fiscalQuarter: 2, fiscalYear: 2028 },
        { fiscalQuarter: 1, fiscalYear: 2028 },
        { fiscalQuarter: 4, fiscalYear: 2027 },
        { fiscalQuarter: 3, fiscalYear: 2027 },
        { fiscalQuarter: 2, fiscalYear: 2027 },
        { fiscalQuarter: 1, fiscalYear: 2027 },
        { fiscalQuarter: 4, fiscalYear: 2026 },
        { fiscalQuarter: 3, fiscalYear: 2026 },
        { fiscalQuarter: 2, fiscalYear: 2026 },
        { fiscalQuarter: 1, fiscalYear: 2026 },
      ],
      requestedQuarterlyPeriods: 16,
      returnedQuarterlyPeriods: 1,
      status: "partial",
      unknownReportedCells: 0,
    },
    profile: "personal_single_user_local_fundamentals",
    provider: annualFinancials(listingId, symbol).provider,
    quarters: [
      {
        fiscalQuarter: 4,
        fiscalYear: 2029,
        reported,
        statementDate: "2030-01-15",
      },
    ],
    schemaVersion: "1.0.0",
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: "Zero Alpha, Inc.",
      listingId,
      securityName: `${symbol} Common Stock`,
      symbol,
    },
    status: "available",
  };
}

function valuationHistory(
  listingId = "lst-zero",
  symbol = "ZERO",
): PersonalValuationHistoryDto {
  const points = [
    valuationPoint("2029-01-15", "23.5"),
    valuationPoint("2030-01-15", "24.125"),
  ] as const;
  return {
    asOf: "2030-01-15T22:00:00.000Z",
    coverage: {
      knownCells: 10,
      observationCount: 2,
      status: "complete",
      unknownCells: 0,
    },
    history: {
      endDate: "2030-01-15",
      latestPoint: points[1],
      points,
      range: "1y",
      startDate: "2029-01-15",
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
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: "Zero Alpha, Inc.",
      listingId,
      securityName: `${symbol} Common Stock`,
      symbol,
    },
    status: "available",
  };
}

function valuationPoint(date: string, pe: string) {
  return {
    date,
    enterpriseValue: {
      status: "known",
      unit: "USD",
      value: "130000000000.5",
    },
    marketCapitalization: {
      status: "known",
      unit: "USD",
      value: "125000000000.25",
    },
    priceToBook: { status: "known", unit: "ratio", value: "6.25" },
    priceToEarnings: { status: "known", unit: "ratio", value: pe },
    trailingPeg1Y: { status: "known", unit: "ratio", value: "1.75" },
  } as const;
}

function marketProvider() {
  return {
    attribution: "Tiingo" as const,
    export: "prohibited" as const,
    historyFeed: "tiingo_eod_composite" as const,
    id: "tiingo" as const,
    name: "Tiingo" as const,
    persistence: "none" as const,
    quoteFeed: "tiingo_iex_derived_reference" as const,
    redistribution: "prohibited" as const,
    retention: "active_owner_session_memory_only" as const,
  };
}

async function flushPromises(iterations = 3) {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
