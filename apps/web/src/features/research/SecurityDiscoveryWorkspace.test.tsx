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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as PersonalWorkspaceApiModule from "@/lib/personal-workspace-api";
import {
  PersonalWorkspaceApiError,
  type PersonalWatchlistMembership,
  type PersonalWatchlistPayload,
  type PersonalWatchlistRecord,
  type SavedPersonalWatchlist,
} from "@/lib/personal-workspace-api";

import type { PersonalCompanyResearchWorkspaceProps } from "./PersonalCompanyResearchWorkspace";
import type { PersonalCompanyResearchNoteProps } from "./PersonalCompanyResearchNote";
import {
  PersonalCompanyWatchlistAction,
  type PersonalCompanyWatchlistActionProps,
} from "./PersonalCompanyWatchlistAction";
import {
  PersonalCompanyResearchNavigation,
  type PersonalCompanyResearchNavigationProps,
} from "./PersonalCompanyResearchNavigation";
import type { PersonalAnnualFinancialsProps } from "./PersonalAnnualFinancials";
import type { OwnerSessionPanelProps } from "./OwnerSessionPanel";
import type { LocalWorkspaceAccessPanelProps } from "./LocalWorkspaceAccessPanel";
import type { PersonalSavedFcffDcfValuationProps } from "./PersonalSavedFcffDcfValuation";
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
  const effects: Array<{
    dependencies: readonly unknown[] | undefined;
    cleanup: (() => void) | undefined;
  }> = [];
  const pendingEffects: Array<() => void> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  const takePendingEffects = () => pendingEffects.splice(0);
  return {
    beginRender() {
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    reset() {
      states.splice(0);
      refs.splice(0);
      effects.splice(0);
      pendingEffects.splice(0);
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    takePendingEffects,
    commitEffects() {
      takePendingEffects().forEach((effect) => effect());
    },
    useEffect(
      this: void,
      callback: () => void | (() => void),
      dependencies?: readonly unknown[],
    ) {
      const index = effectIndex++;
      const previous = effects[index];
      if (
        previous !== undefined &&
        dependencies !== undefined &&
        previous.dependencies !== undefined &&
        dependencies.length === previous.dependencies.length &&
        dependencies.every((value, position) =>
          Object.is(value, previous.dependencies![position]),
        )
      )
        return;
      const effect = {
        dependencies: dependencies?.slice(),
        cleanup: previous?.cleanup,
      };
      effects[index] = effect;
      pendingEffects.push(() => {
        effect.cleanup?.();
        effect.cleanup = callback() ?? undefined;
      });
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
  CompanyResearch: () => null,
  CompanyResearchNote: () => null,
  AnnualFinancials: () => null,
  FcffDcfValuation: () => null,
  FinancialQualityScorecard: () => null,
  HistoricalMultipleValuation: () => null,
  ManualPeerComparison: () => null,
  MarketOverview: () => null,
  OwnerSession: () => null,
  LocalAccess: () => null,
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
  useEffect: hookHarness.useEffect,
  useRef: hookHarness.useRef,
  useState: hookHarness.useState,
}));
vi.mock("@/lib/personal-workspace-api", async () => ({
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
  normalizeWatchlistNote: (
    await vi.importActual<typeof PersonalWorkspaceApiModule>(
      "../../lib/personal-workspace-api",
    )
  ).normalizeWatchlistNote,
}));
vi.mock("./OwnerSessionPanel", () => ({
  OwnerSessionPanel: componentMocks.OwnerSession,
}));
vi.mock("./PersonalCompanyResearchWorkspace", () => ({
  PersonalCompanyResearchWorkspace: componentMocks.CompanyResearch,
}));
vi.mock("./PersonalCompanyResearchNote", () => ({
  PersonalCompanyResearchNote: componentMocks.CompanyResearchNote,
}));
vi.mock("./PersonalAnnualFinancials", () => ({
  PersonalAnnualFinancials: componentMocks.AnnualFinancials,
}));
vi.mock("./PersonalSavedFcffDcfValuation", () => ({
  PersonalSavedFcffDcfValuation: componentMocks.FcffDcfValuation,
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

vi.mock("./LocalWorkspaceAccessPanel", () => ({
  LocalWorkspaceAccessPanel: componentMocks.LocalAccess,
}));

afterEach(() => vi.unstubAllGlobals());

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
  it("groups all nine company panels into five stable sections without fetching on navigation or return", async () => {
    await activateWorkspace();
    const financial = findElement<PersonalFinancialScreenerProps>(
      renderWorkspace(),
      componentMocks.FinancialScreener,
    )!;
    expect(financial.props.marketDataStatus).toEqual(marketStatus());
    expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    financial.props.onOpenResearch(screenRow());
    let view = renderWorkspace();
    const company = requireCompanyResearch(view);
    expect(company.props.activeSection).toBe("financials");
    expect(company.props.backLabel).toBe("Back to financial results");
    expect(
      findElement(company.props.sections.price, componentMocks.MarketOverview),
    ).toBeDefined();
    expect(
      findElement(
        company.props.sections.financials,
        componentMocks.AnnualFinancials,
      ),
    ).toBeDefined();
    expect(
      findElement(
        company.props.sections.financials,
        componentMocks.QuarterlyFinancials,
      ),
    ).toBeDefined();
    expect(
      findElement(
        company.props.sections.financials,
        componentMocks.FinancialQualityScorecard,
      ),
    ).toBeDefined();
    expect(
      findElement(
        company.props.sections.valuation,
        componentMocks.ValuationHistory,
      ),
    ).toBeDefined();
    expect(
      findElement(
        company.props.sections.valuation,
        componentMocks.HistoricalMultipleValuation,
      ),
    ).toBeDefined();
    expect(
      findElement(
        company.props.sections.valuation,
        componentMocks.FcffDcfValuation,
      ),
    ).toBeDefined();
    expect(
      findElement(
        company.props.sections.peers,
        componentMocks.ManualPeerComparison,
      ),
    ).toBeDefined();
    expect(
      findElement(
        company.props.sections.sec,
        componentMocks.SecQuarterlyEvidence,
      ),
    ).toBeDefined();
    const dcfKey = requireFcffDcfValuation(view).key;
    const screenKey = financial.key;
    for (const section of [
      "price",
      "financials",
      "valuation",
      "peers",
      "sec",
    ] as const) {
      requireCompanyResearch(view).props.onSectionChange(section);
      view = renderWorkspace();
      expect(requireCompanyResearch(view).props.activeSection).toBe(section);
      expect(requireCompanyResearch(view).key).toBe(company.key);
      expect(requireFcffDcfValuation(view).key).toBe(dcfKey);
      expect(findElement(view, componentMocks.FinancialScreener)?.key).toBe(
        screenKey,
      );
      expect(findElement(view, componentMocks.StockScreener)).toBeDefined();
      expect(findElement(view, componentMocks.WatchlistFilings)).toBeDefined();
      expect(findElement(view, componentMocks.Portfolio)).toBeDefined();
    }
    requireCompanyResearch(view).props.onBack();
    await flushPromises();
    expect(requireCompanyResearch(renderWorkspace()).props.selection).toEqual(
      company.props.selection,
    );
    expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalQuarterlyFinancials).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalValuationHistory).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
  });

  it("retains admitted data, model identity and section through Back and an exact same-company reopen", async () => {
    await activateWorkspace();
    let view: unknown = await searchAndSelectMarket("ZERO");
    requireMarketOverview(view).props.onLoad("1y");
    requireAnnualFinancials(view).props.onLoad();
    requireQuarterlyFinancials(view).props.onLoad();
    requireValuationHistory(view).props.onLoad();
    await flushPromises();
    view = renderWorkspace();
    const companyKey = requireCompanyResearch(view).key;
    const dcfKey = requireFcffDcfValuation(view).key;
    const overview = requireMarketOverview(view).props.overview;
    const annual = requireAnnualFinancials(view).props.financials;
    const quarterly = requireQuarterlyFinancials(view).props.financials;
    const history = requireValuationHistory(view).props.history;
    expect(overview).not.toBeNull();
    expect(annual).not.toBeNull();
    expect(quarterly).not.toBeNull();
    expect(history).not.toBeNull();
    requireCompanyResearch(view).props.onSectionChange("valuation");
    requireCompanyResearch(renderWorkspace()).props.onBack();
    await flushPromises();
    findElement<PersonalPortfolioProps>(
      renderWorkspace(),
      componentMocks.Portfolio,
    )!.props.onOpenResearch!(searchResult("ZERO", "lst-zero"));
    view = renderWorkspace();
    expect(requireCompanyResearch(view).key).toBe(companyKey);
    expect(requireCompanyResearch(view).props.activeSection).toBe("valuation");
    expect(requireCompanyResearch(view).props.backLabel).toBe(
      "Back to My Portfolio",
    );
    expect(requireFcffDcfValuation(view).key).toBe(dcfKey);
    expect(requireMarketOverview(view).props.overview).toBe(overview);
    expect(requireAnnualFinancials(view).props.financials).toBe(annual);
    expect(requireQuarterlyFinancials(view).props.financials).toBe(quarterly);
    expect(requireValuationHistory(view).props.history).toBe(history);
    expect(apiMocks.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchPersonalAnnualFinancials).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchPersonalQuarterlyFinancials).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchPersonalValuationHistory).toHaveBeenCalledTimes(1);
  });

  it("does not cancel an in-flight company load when navigating or reopening its exact identity", async () => {
    await activateWorkspace();
    const loading = deferred<PersonalAnnualFinancialsDto>();
    apiMocks.fetchPersonalAnnualFinancials.mockReturnValueOnce(loading.promise);
    let view: unknown = await searchAndSelectMarket("ZERO");
    requireAnnualFinancials(view).props.onLoad();
    const signal = apiMocks.fetchPersonalAnnualFinancials.mock.calls[0]![1];
    requireCompanyResearch(view).props.onSectionChange("valuation");
    view = renderWorkspace();
    requireCompanyResearch(view).props.onBack();
    findElement<PersonalPortfolioProps>(view, componentMocks.Portfolio)!.props
      .onOpenResearch!(searchResult("ZERO", "lst-zero"));
    expect(signal.aborted).toBe(false);
    loading.resolve(annualFinancials());
    await flushPromises();
    expect(
      requireAnnualFinancials(renderWorkspace()).props.financials,
    ).not.toBeNull();
    expect(apiMocks.fetchPersonalAnnualFinancials).toHaveBeenCalledTimes(1);
  });

  it("clears and cancels the previous company's data and model for a changed shared identity even with the same listing ID", async () => {
    await activateWorkspace();
    const loading = deferred<PersonalAnnualFinancialsDto>();
    apiMocks.fetchPersonalAnnualFinancials.mockReturnValueOnce(loading.promise);
    const view = await searchAndSelectMarket("ZERO");
    const oldCompany = requireCompanyResearch(view);
    const oldAnnual = requireAnnualFinancials(view);
    oldAnnual.props.onLoad();
    const signal = apiMocks.fetchPersonalAnnualFinancials.mock.calls[0]![1];
    findElement<PersonalPortfolioProps>(view, componentMocks.Portfolio)!.props
      .onOpenResearch!({
      ...searchResult("ZERO", "lst-zero"),
      shareClassId: "changed-share-class",
    });
    let current = renderWorkspace();
    expect(requireCompanyResearch(current).key).not.toBe(oldCompany.key);
    expect(requireFcffDcfValuation(current).key).not.toBe(
      requireFcffDcfValuation(view).key,
    );
    expect(signal.aborted).toBe(true);
    oldCompany.props.onSectionChange("sec");
    oldCompany.props.onClear();
    oldAnnual.props.onLoad();
    expect(apiMocks.fetchPersonalAnnualFinancials).toHaveBeenCalledTimes(1);
    loading.resolve(annualFinancials());
    await flushPromises();
    current = renderWorkspace();
    expect(requireCompanyResearch(current).props.activeSection).toBe("price");
    expect(requireCompanyResearch(current).props.selection?.listingId).toBe(
      "lst-zero",
    );
    expect(requireAnnualFinancials(current).props.financials).toBeNull();
  });

  it("rejects a retired company's callbacks after the same identity is selected again", async () => {
    await activateWorkspace();
    const view = await searchAndSelectMarket("ZERO");
    const oldCompany = requireCompanyResearch(view);
    const oldAnnual = requireAnnualFinancials(view);
    const oldEvidence = findElement<PersonalSecQuarterlyEvidenceProps>(
      view,
      componentMocks.SecQuarterlyEvidence,
    )!;
    oldCompany.props.onClear();
    findElement<PersonalPortfolioProps>(
      renderWorkspace(),
      componentMocks.Portfolio,
    )!.props.onOpenResearch!(searchResult("ZERO", "lst-zero"));
    oldAnnual.props.onLoad();
    oldCompany.props.onSectionChange("sec");
    oldCompany.props.onClear();
    oldEvidence.props.onSessionUnavailable();
    const current = requireCompanyResearch(renderWorkspace());
    expect(current.props.selection?.listingId).toBe("lst-zero");
    expect(current.props.activeSection).toBe("price");
    expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();
    await flushPromises();
  });

  it.each([
    ["catalog", "Back to catalog results", "price"],
    ["financials", "Back to financial results", "financials"],
    ["portfolio", "Back to My Portfolio", "price"],
    ["filings", "Back to recent filings", "sec"],
  ] as const)(
    "records the explicit %s origin",
    async (origin, label, section) => {
      await activateWorkspace();
      const view = renderWorkspace();
      const identity = searchResult("ZERO", "lst-zero");
      if (origin === "catalog")
        requireStockScreener(view).props.onOpenResearch(screenRow());
      if (origin === "financials")
        findElement<PersonalFinancialScreenerProps>(
          view,
          componentMocks.FinancialScreener,
        )!.props.onOpenResearch(screenRow());
      if (origin === "portfolio")
        findElement<PersonalPortfolioProps>(view, componentMocks.Portfolio)!
          .props.onOpenResearch!(identity);
      if (origin === "filings")
        findElement<PersonalWatchlistFilingsProps>(
          view,
          componentMocks.WatchlistFilings,
        )!.props.onOpenResearch({ ...identity, note: "" });
      const company = requireCompanyResearch(renderWorkspace());
      expect(company.props.backLabel).toBe(label);
      expect(company.props.activeSection).toBe(section);
      expect(company.props.selection).not.toBeNull();
      expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    },
  );

  it("opens a saved company with a My Watchlist return target and preserves its unsaved note", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce({
      id: "main",
      version: 1,
      createdAt: "2030-01-15T01:00:00.000Z",
      updatedAt: "2030-01-15T01:00:00.000Z",
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: snapshot().snapshotSha256,
        memberships: [membership("ZERO", "lst-zero")],
      },
    });
    await activateWorkspace();
    const dom = companyFocusDocument("watchlist-title");
    const view = renderWorkspace();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(view, { id: "note-lst-zero" }).props.onChange({
      target: { value: "Keep this unsaved research note" },
    });
    requireElementByProps<{ onClick: () => void }>(view, {
      "aria-label": "Research ZERO",
    }).props.onClick();
    await flushPromises();
    const company = requireCompanyResearch(renderWorkspace());
    expect(company.props.backLabel).toBe("Back to My Watchlist");
    expect(company.props.selection?.listingId).toBe("lst-zero");
    company.props.onBack();
    await flushPromises();
    expect(dom.trigger.focus).toHaveBeenCalledTimes(1);
    expect(
      requireElementByProps<{ value: string }>(renderWorkspace(), {
        id: "note-lst-zero",
      }).props.value,
    ).toBe("Keep this unsaved research note");
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
  });

  it("returns focus to the live search trigger, then falls back to its heading if that trigger disappears", async () => {
    await activateWorkspace();
    const dom = companyFocusDocument("search-title");
    await searchAndSelectMarket("ZERO");
    await flushPromises();
    expect(dom.company.focus).toHaveBeenCalledTimes(1);
    expect(requireCompanyResearch(renderWorkspace()).props.backLabel).toBe(
      "Back to search results",
    );
    requireCompanyResearch(renderWorkspace()).props.onBack();
    await flushPromises();
    expect(dom.trigger.focus).toHaveBeenCalledTimes(1);
    expect(dom.trigger.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    dom.trigger.isConnected = false;
    requireCompanyResearch(renderWorkspace()).props.onBack();
    await flushPromises();
    expect(dom.origin.focus).toHaveBeenCalledTimes(1);
    expect(dom.origin.tabIndex).toBe(-1);
  });

  it.each(["hidden", "disabled", "unrelated"] as const)(
    "uses the financial heading when the captured trigger is %s",
    async (state) => {
      await activateWorkspace();
      const dom = companyFocusDocument(
        state === "unrelated"
          ? "search-title"
          : "personal-financial-screener-title",
      );
      findElement<PersonalFinancialScreenerProps>(
        renderWorkspace(),
        componentMocks.FinancialScreener,
      )!.props.onOpenResearch(screenRow());
      await flushPromises();
      if (state === "hidden") dom.trigger.visible = false;
      if (state === "disabled") dom.trigger.disabled = true;
      requireCompanyResearch(renderWorkspace()).props.onBack();
      await flushPromises();
      expect(dom.trigger.focus).not.toHaveBeenCalled();
      expect(dom.origin.focus).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps the return trigger and fallback bound to the most recent same-company origin", async () => {
    await activateWorkspace();
    const dom = companyFocusDocument("personal-financial-screener-title");
    findElement<PersonalFinancialScreenerProps>(
      renderWorkspace(),
      componentMocks.FinancialScreener,
    )!.props.onOpenResearch(screenRow());
    await flushPromises();
    const oldBack = requireCompanyResearch(renderWorkspace()).props.onBack;
    findElement<PersonalPortfolioProps>(
      renderWorkspace(),
      componentMocks.Portfolio,
    )!.props.onOpenResearch!(screenRow());
    await flushPromises();
    dom.getElementById.mockClear();
    oldBack();
    await flushPromises();
    expect(dom.getElementById).toHaveBeenCalledWith("personal-portfolio-title");
    expect(dom.getElementById).not.toHaveBeenCalledWith(
      "personal-financial-screener-title",
    );
  });

  it("discards pending open and return focus when selection or workspace is cleared", async () => {
    await activateWorkspace();
    const dom = companyFocusDocument("personal-financial-screener-title");
    const financial = findElement<PersonalFinancialScreenerProps>(
      renderWorkspace(),
      componentMocks.FinancialScreener,
    )!;
    financial.props.onOpenResearch(screenRow());
    requireCompanyResearch(renderWorkspace()).props.onClear();
    await flushPromises();
    expect(dom.company.focus).not.toHaveBeenCalled();
    expect(dom.trigger.focus).toHaveBeenCalledTimes(1);
    dom.trigger.focus.mockClear();
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection,
    ).toBeNull();
    financial.props.onOpenResearch(screenRow());
    await flushPromises();
    const staleCompany = requireCompanyResearch(renderWorkspace());
    staleCompany.props.onBack();
    financial.props.onSessionUnavailable();
    await flushPromises();
    expect(dom.trigger.focus).not.toHaveBeenCalled();
    expect(dom.origin.focus).not.toHaveBeenCalled();
    await activateWorkspace();
    financial.props.onOpenResearch(screenRow());
    staleCompany.props.onSectionChange("sec");
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection,
    ).toBeNull();
  });

  it("passes saved membership and version to financials and updates them after a watchlist save", async () => {
    await activateWorkspace();
    let financial = findElement<PersonalFinancialScreenerProps>(
      renderWorkspace(),
      componentMocks.FinancialScreener,
    )!;
    expect(financial.props.watchlistVersion).toBe(0);
    expect(financial.props.watchlistMemberships).toEqual([]);
    expect(financial.props.watchlistAvailable).toBe(true);
    const saving = deferred<SavedPersonalWatchlist>();
    apiMocks.saveMainPersonalWatchlist.mockReturnValueOnce(saving.promise);
    financial.props.onAddToWatchlist(screenRow());
    financial = findElement<PersonalFinancialScreenerProps>(
      renderWorkspace(),
      componentMocks.FinancialScreener,
    )!;
    expect(financial.props.watchlistAvailable).toBe(false);
    const payload = apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1];
    saving.resolve({ version: 1, payload });
    await flushPromises();
    financial = findElement<PersonalFinancialScreenerProps>(
      renderWorkspace(),
      componentMocks.FinancialScreener,
    )!;
    expect(financial.props.watchlistVersion).toBe(1);
    expect(financial.props.watchlistAvailable).toBe(true);
    expect(financial.props.watchlistMemberships).toEqual(payload.memberships);
  });

  it("keeps catalog financials mounted when the saved watchlist cannot be loaded", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("unavailable"),
    );
    await activateWorkspace();
    const financial = findElement<PersonalFinancialScreenerProps>(
      renderWorkspace(),
      componentMocks.FinancialScreener,
    )!;
    expect(financial.props.watchlistAvailable).toBe(false);
    expect(financial.props.watchlistMemberships).toEqual([]);
    expect(financial.props.disabled).not.toBe(true);
  });

  it("marks saved-company financials unavailable when watchlist catalog reconciliation is required", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce({
      id: "main",
      version: 4,
      createdAt: "2030-01-15T01:00:00.000Z",
      updatedAt: "2030-01-15T02:00:00.000Z",
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: `sha256:${"f".repeat(64)}`,
        memberships: [membership("ONE", "lst-one")],
      },
    });
    await activateWorkspace();
    const financial = findElement<PersonalFinancialScreenerProps>(
      renderWorkspace(),
      componentMocks.FinancialScreener,
    )!;
    expect(financial.props.watchlistVersion).toBe(4);
    expect(financial.props.watchlistMemberships).toHaveLength(1);
    expect(financial.props.watchlistAvailable).toBe(false);
  });

  it("selects only the explicit local panel and reconnects after an active operation loses access", async () => {
    let view = renderWorkspace("local");
    expect(findOwnerSession(view)).toBeUndefined();
    const local = findElement<LocalWorkspaceAccessPanelProps>(
      view,
      componentMocks.LocalAccess,
    )!;
    expect(local.props.invalidationKey).toBe(0);
    await local.props.onSessionChange(true, new AbortController().signal);
    local.props.onActivityHandlerChange?.(() => () => true);
    view = renderWorkspace("local");
    const screen = findElement<PersonalFinancialScreenerProps>(
      view,
      componentMocks.FinancialScreener,
    )!;
    expect(screen.props.onActivityStart()?.()).toBe(true);
    screen.props.onSessionUnavailable();
    view = renderWorkspace("local");
    expect(findElement(view, componentMocks.FinancialScreener)).toBeUndefined();
    const retry = findElement<LocalWorkspaceAccessPanelProps>(
      view,
      componentMocks.LocalAccess,
    )!;
    expect(retry.props.invalidationKey).toBe(1);
    apiMocks.fetchMainPersonalWatchlist.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    await expect(
      retry.props.onSessionChange(true, new AbortController().signal),
    ).resolves.toBe(false);
    expect(
      findElement<LocalWorkspaceAccessPanelProps>(
        renderWorkspace("local"),
        componentMocks.LocalAccess,
      )?.props.invalidationKey,
    ).toBe(1);
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
  });

  it.each(["bootstrap", "account"] as const)(
    "preserves the %s panel without exposing local access",
    (authMode) => {
      const view = renderWorkspace(authMode);
      expect(requireOwnerSession(view).props.authMode).toBe(authMode);
      expect(findElement(view, componentMocks.LocalAccess)).toBeUndefined();
      expect(apiMocks.fetchPersonalSecurityMasterStatus).not.toHaveBeenCalled();
    },
  );

  it("credits financial activity without reloading the workspace or its selected company", async () => {
    await activateWorkspace();
    const owner = requireOwnerSession(renderWorkspace());
    const complete = vi.fn(() => true);
    const start = vi.fn(() => complete);
    owner.props.onActivityHandlerChange?.(start);
    const financial = findElement<PersonalFinancialScreenerProps>(
      renderWorkspace(),
      componentMocks.FinancialScreener,
    );
    financial?.props.onOpenResearch(screenRow());
    const activity = financial?.props.onActivityStart();
    expect(start).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    expect(activity?.()).toBe(true);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchPersonalSecurityMasterStatus).toHaveBeenCalledTimes(1);
    expect(
      requireMarketOverview(renderWorkspace()).props.selection?.listingId,
    ).toBe("lst-screen");
  });

  it("rejects activity captured before workspace loss even after the same handler is registered again", async () => {
    await activateWorkspace();
    const complete = vi.fn(() => true);
    const start = vi.fn(() => complete);
    requireOwnerSession(renderWorkspace()).props.onActivityHandlerChange?.(
      start,
    );
    const financial = findElement<PersonalFinancialScreenerProps>(
      renderWorkspace(),
      componentMocks.FinancialScreener,
    );
    const obsoleteActivity = financial?.props.onActivityStart();
    financial?.props.onSessionUnavailable();
    expect(financial?.props.onActivityStart()).toBeUndefined();
    await activateWorkspace();
    requireOwnerSession(renderWorkspace()).props.onActivityHandlerChange?.(
      start,
    );
    expect(obsoleteActivity?.()).toBe(false);
    expect(complete).not.toHaveBeenCalled();
    const current = findElement<PersonalFinancialScreenerProps>(
      renderWorkspace(),
      componentMocks.FinancialScreener,
    );
    expect(current?.props.onActivityStart()?.()).toBe(true);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("fails closed while the owner activity handler is absent or replaced", async () => {
    await activateWorkspace();
    const owner = requireOwnerSession(renderWorkspace());
    const financial = findElement<PersonalFinancialScreenerProps>(
      renderWorkspace(),
      componentMocks.FinancialScreener,
    );
    expect(financial?.props.onActivityStart()).toBeUndefined();
    const complete = vi.fn(() => true);
    owner.props.onActivityHandlerChange?.(() => complete);
    const oldActivity = financial?.props.onActivityStart();
    owner.props.onActivityHandlerChange?.(null);
    expect(financial?.props.onActivityStart()).toBeUndefined();
    owner.props.onActivityHandlerChange?.(() => () => true);
    expect(oldActivity?.()).toBe(false);
    expect(complete).not.toHaveBeenCalled();
  });

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

  it("binds saved DCF inputs to the full off-page membership independently of the visible filter", async () => {
    const record = watchlistRecord(120);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    void filterWatchlist("SYN00001");
    const company = record.payload.memberships[60]!;
    openNoteCompany(company);
    const view = renderWorkspace();
    const valuation = requireFcffDcfValuation(view);
    const identity = Object.fromEntries(
      Object.entries(company).filter(([key]) => key !== "note"),
    );
    expect(Object.keys(valuation.props.savedContext.identity!)).toHaveLength(
      11,
    );
    expect(valuation.props.savedContext.identity).toEqual(identity);
    expect(valuation.props.savedContext.watchlistBinding).toEqual({
      catalogSnapshotSha256: snapshot().snapshotSha256,
      watchlistVersion: 7,
    });
    expect(valuation.props.savedContext.isCurrent()).toBe(true);
    expect(valuation.props.savedContext.enabled).toBe(true);
    expect(watchlistRowIds(view)).toEqual(["lst-syn-00001"]);
    expect(apiMocks.fetchMainPersonalWatchlist).toHaveBeenCalledTimes(1);
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalValuationHistory).not.toHaveBeenCalled();
  });

  it("invalidates saved DCF metadata across note writes while preserving the mounted company editor", async () => {
    const record = watchlistRecord(1);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    openNoteCompany(record.payload.memberships[0]!);
    const before = renderWorkspace();
    const valuation = requireFcffDcfValuation(before);
    const pending = deferred<SavedPersonalWatchlist>();
    apiMocks.saveMainPersonalWatchlist.mockReturnValueOnce(pending.promise);
    requireCompanyNote(before).props.onChange(
      "A note changes only the list version",
    );
    requireCompanyNote(renderWorkspace()).props.onSave();
    expect(valuation.props.savedContext.isCurrent()).toBe(false);
    const during = requireFcffDcfValuation(renderWorkspace());
    expect(during.key).toBe(valuation.key);
    expect(during.props.savedContext.contextKey).not.toBe(
      valuation.props.savedContext.contextKey,
    );
    expect(during.props.savedContext.watchlistBinding).toBeNull();
    pending.resolve({
      version: 8,
      payload: apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1],
    });
    await flushPromises();
    const settled = requireFcffDcfValuation(renderWorkspace());
    expect(settled.key).toBe(valuation.key);
    expect(requireCompanyResearch(renderWorkspace()).key).toBe(
      requireCompanyResearch(before).key,
    );
    expect(settled.props.savedContext.watchlistBinding?.watchlistVersion).toBe(
      8,
    );
    expect(settled.props.savedContext.isCurrent()).toBe(true);
    expect(valuation.props.savedContext.isCurrent()).toBe(false);
    expect(during.props.savedContext.isCurrent()).toBe(false);
  });

  it("retires saved DCF origin callbacks even when the selected identity stays the same", async () => {
    const record = watchlistRecord(1);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    openNoteCompany(record.payload.memberships[0]!);
    const before = requireFcffDcfValuation(renderWorkspace());
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    expect(before.props.savedContext.isCurrent()).toBe(false);
    const after = requireFcffDcfValuation(renderWorkspace());
    expect(after.key).toBe(before.key);
    expect(after.props.savedContext.contextKey).not.toBe(
      before.props.savedContext.contextKey,
    );
    expect(after.props.savedContext.identity).toEqual(
      before.props.savedContext.identity,
    );
    expect(after.props.savedContext.isCurrent()).toBe(true);
    requireCompanyResearch(renderWorkspace()).props.onClear();
    expect(after.props.savedContext.isCurrent()).toBe(false);
    openNoteCompany(record.payload.memberships[0]!);
    expect(before.props.savedContext.isCurrent()).toBe(false);
    expect(after.props.savedContext.isCurrent()).toBe(false);
    expect(
      requireFcffDcfValuation(renderWorkspace()).props.savedContext.isCurrent(),
    ).toBe(true);
  });

  it.each(["not saved", "stale catalog", "unavailable list"] as const)(
    "withholds saved DCF admission for %s without changing provider loading",
    async (state) => {
      const record = watchlistRecord(1);
      const selected = record.payload.memberships[0]!;
      if (state === "not saved") record.payload.memberships = [];
      if (state === "stale catalog")
        record.payload.snapshotSha256 = `sha256:${"d".repeat(64)}`;
      if (state === "unavailable list")
        apiMocks.fetchMainPersonalWatchlist.mockRejectedValueOnce(
          new Error("Synthetic unavailable list"),
        );
      else apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
      await activateWorkspace();
      openNoteCompany(selected);
      const valuation = requireFcffDcfValuation(renderWorkspace());
      expect(valuation.props.savedContext.watchlistBinding).toBeNull();
      expect(valuation.props.selection?.listingId).toBe(selected.listingId);
      expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();
      expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();
      expect(apiMocks.fetchPersonalValuationHistory).not.toHaveBeenCalled();
    },
  );

  it("clears the active company and retires saved DCF callbacks after session loss", async () => {
    const record = watchlistRecord(1);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    openNoteCompany(record.payload.memberships[0]!);
    const context =
      requireFcffDcfValuation(renderWorkspace()).props.savedContext;
    context.onSessionUnavailable();
    expect(context.isCurrent()).toBe(false);
    expect(findFcffDcfValuation(renderWorkspace())).toBeUndefined();
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
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

describe("My Watchlist navigation", () => {
  it("renders 120 saved companies as ordered pages of 50, 50 and 20 with global positions", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(120),
    );
    await activateWorkspace();
    let view = renderWorkspace();
    expect(watchlistRowIds(view)).toEqual(watchlistIds(1, 50));
    expect(watchlistPageButton(view, "Previous").props.disabled).toBe(true);
    expect(watchlistPageButton(view, "Next").props.disabled).toBe(false);
    expect(textContent(view)).toMatch(/Page\s+1\s+of\s+3/u);
    watchlistPageButton(view, "Next").props.onClick();
    view = renderWorkspace();
    expect(watchlistRowIds(view)).toEqual(watchlistIds(51, 100));
    expect(
      textContent(
        requireElementByProps(view, { className: "watchlist-position" }),
      ),
    ).toBe("51");
    watchlistPageButton(view, "Next").props.onClick();
    view = renderWorkspace();
    expect(watchlistRowIds(view)).toEqual(watchlistIds(101, 120));
    expect(textContent(view)).toMatch(/Page\s+3\s+of\s+3/u);
    expect(watchlistPageButton(view, "Next").props.disabled).toBe(true);
    expect(watchlistPageButton(view, "Previous").props.disabled).toBe(false);
    watchlistPageButton(view, "Previous").props.onClick();
    expect(watchlistRowIds(renderWorkspace())).toEqual(watchlistIds(51, 100));
  });

  it("bounds rendered rows and editors for the maximum admitted 10,000-membership payload", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(10_000),
    );
    await activateWorkspace();
    const view = renderWorkspace();
    expect(watchlistRowIds(view)).toEqual(watchlistIds(1, 50));
    expect(findAllElements(view, "textarea")).toHaveLength(50);
    expect(textContent(view)).toMatch(/10,?000/u);
    expect(textContent(view)).toMatch(/Page\s+1\s+of\s+200/u);
    const filtered = filterWatchlist("SYN10000");
    expect(watchlistRowIds(filtered)).toEqual(["lst-syn-10000"]);
    expect(findAllElements(filtered, "textarea")).toHaveLength(1);
  });

  it("matches ticker and canonically equivalent company text case-insensitively without searching notes or rewriting identities", async () => {
    const record = watchlistRecord(3);
    record.payload.memberships[0]!.issuerName = "Cafe\u0301 Growth";
    record.payload.memberships[1]!.issuerName = "Other Company";
    record.payload.memberships[1]!.note = "Caf\u00e9 hidden note";
    record.payload.memberships[2]!.issuerName = "CAF\u00c9 Income";
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    expect(watchlistFilter(renderWorkspace()).props.maxLength).toBe(128);
    expect(watchlistRowIds(filterWatchlist("  cAf\u00e9  "))).toEqual([
      "lst-syn-00001",
      "lst-syn-00003",
    ]);
    expect(watchlistRowIds(filterWatchlist("cafe\u0301"))).toEqual([
      "lst-syn-00001",
      "lst-syn-00003",
    ]);
    const tickerView = filterWatchlist("  syn00002  ");
    expect(watchlistRowIds(tickerView)).toEqual(["lst-syn-00002"]);
    const missing = filterWatchlist("missing company");
    expect(watchlistRowIds(missing)).toEqual([]);
    expect(textContent(missing)).toMatch(/no .*match/iu);
    expect(textContent(missing)).not.toContain("Your watchlist is empty");
    expect(watchlistRowIds(filterWatchlist("   "))).toEqual(watchlistIds(1, 3));
    expect(record.payload.memberships[0]!.issuerName).toBe("Cafe\u0301 Growth");
    expect(apiMocks.searchPersonalSecurities).not.toHaveBeenCalled();
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
  });

  it("resets a changed filter to page one and keeps matching and total counts distinct", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(120),
    );
    await activateWorkspace();
    watchlistPageButton(renderWorkspace(), "Next").props.onClick();
    const view = filterWatchlist("SYN001");
    expect(watchlistRowIds(view)).toEqual(watchlistIds(100, 120));
    expect(textContent(view)).toMatch(/\b21\b/u);
    expect(textContent(view)).toMatch(/\b120\b/u);
    expect(textContent(view)).toMatch(/Page\s+1\s+of\s+1/u);
    expect(watchlistRowIds(filterWatchlist(""))).toEqual(watchlistIds(1, 50));
  });

  it("keeps filter, paging, jump, Research and Back entirely local after initialization", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(120),
    );
    await activateWorkspace();
    const calls = Object.values(apiMocks).map((mock) => mock.mock.calls.length);
    const fetch = vi.fn();
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    const dom = companyFocusDocument("watchlist-title");
    void filterWatchlist(" SYN ");
    watchlistPageButton(renderWorkspace(), "Next").props.onClick();
    const jump = requireElementByProps<{ href: string; onClick?: unknown }>(
      renderWorkspace(),
      { href: "#watchlist-title" },
    );
    expect(jump.props.onClick).toBeUndefined();
    watchlistAction(renderWorkspace(), "Research SYN00051").props.onClick();
    await flushPromises();
    requireCompanyResearch(renderWorkspace()).props.onBack();
    await flushPromises();
    const view = renderWorkspace();
    expect(watchlistFilter(view).props.value).toBe(" SYN ");
    expect(watchlistRowIds(view)).toEqual(watchlistIds(51, 100));
    expect(dom.trigger.focus).toHaveBeenCalledOnce();
    expect(
      Object.values(apiMocks).map((mock) => mock.mock.calls.length),
    ).toEqual(calls);
    expect(fetch).not.toHaveBeenCalled();
    for (const mock of Object.values(storage))
      expect(mock).not.toHaveBeenCalled();
  });

  it("provides an unmodified native jump to the focusable heading only while the section exists", async () => {
    expect(
      findAllElements(renderWorkspace(), "a").some(
        (a) => a.props.href === "#watchlist-title",
      ),
    ).toBe(false);
    await activateWorkspace();
    const view = renderWorkspace();
    const link = requireElementByProps<{ onClick?: unknown }>(view, {
      href: "#watchlist-title",
    });
    expect(link.type).toBe("a");
    expect(link.props.onClick).toBeUndefined();
    const heading = requireElementByProps<{ tabIndex: number }>(view, {
      id: "watchlist-title",
    });
    expect(heading.type).toBe("h2");
    expect(heading.props.tabIndex).toBe(-1);
  });

  it("retains independent note drafts through filtering, paging and Research, then saves the full list explicitly", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(120),
    );
    await activateWorkspace();
    editWatchlistNote("lst-syn-00001", " First draft ");
    watchlistPageButton(renderWorkspace(), "Next").props.onClick();
    editWatchlistNote("lst-syn-00051", " Second draft ");
    void filterWatchlist("SYN00120");
    void filterWatchlist("");
    expect(watchlistNote(renderWorkspace(), "lst-syn-00001").props.value).toBe(
      " First draft ",
    );
    watchlistPageButton(renderWorkspace(), "Next").props.onClick();
    watchlistAction(renderWorkspace(), "Research SYN00051").props.onClick();
    requireCompanyResearch(renderWorkspace()).props.onBack();
    await flushPromises();
    const view = renderWorkspace();
    expect(watchlistNote(view, "lst-syn-00051").props.value).toBe(
      " Second draft ",
    );
    expect(watchlistRowIds(view)).toEqual(watchlistIds(51, 100));
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
    requireButton(
      watchlistRow(view, "lst-syn-00051"),
      "Save note",
    ).props.onClick();
    await flushPromises();
    const [version, payload] =
      apiMocks.saveMainPersonalWatchlist.mock.calls[0]!;
    expect(version).toBe(7);
    expect(payload.memberships).toHaveLength(120);
    expect(payload.memberships[50]!.note).toBe("Second draft");
    expect(payload.memberships[0]!.note).toBe("");
    watchlistPageButton(renderWorkspace(), "Previous").props.onClick();
    expect(watchlistNote(renderWorkspace(), "lst-syn-00001").props.value).toBe(
      " First draft ",
    );
  });

  it("keeps complete financial and filing inputs and bounded full-list peer candidates while one filtered company is visible", async () => {
    const record = watchlistRecord(300);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    void filterWatchlist("SYN00300");
    watchlistAction(renderWorkspace(), "Research SYN00300").props.onClick();
    const view = renderWorkspace();
    const financial = findElement<PersonalFinancialScreenerProps>(
      view,
      componentMocks.FinancialScreener,
    )!;
    const filings = findElement<PersonalWatchlistFilingsProps>(
      view,
      componentMocks.WatchlistFilings,
    )!;
    expect(financial.props.watchlistMemberships).toBe(
      record.payload.memberships,
    );
    expect(financial.props.watchlistVersion).toBe(7);
    expect(filings.props.memberships).toBe(record.payload.memberships);
    expect(filings.props.watchlistVersion).toBe(7);
    expect(watchlistRowIds(view)).toEqual(["lst-syn-00300"]);
    const peers = requireManualPeerComparison(view).props.candidates;
    expect(peers).toHaveLength(250);
    expect(peers.map((peer) => peer.listingId)).toEqual(watchlistIds(1, 250));
    expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();
  });

  it("moves across the 50/51 boundary using saved positions and prevents filtered reorder even through a retained handler", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(120),
    );
    await activateWorkspace();
    const retained = watchlistAction(renderWorkspace(), "Move SYN00050 down");
    watchlistPageButton(renderWorkspace(), "Next").props.onClick();
    const first = watchlistAction(renderWorkspace(), "Move SYN00051 up");
    expect(first.props.disabled).toBe(false);
    first.props.onClick();
    await flushPromises();
    const order =
      apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1].memberships.map(
        (m) => m.listingId,
      );
    expect(order).toEqual([
      ...watchlistIds(1, 49),
      "lst-syn-00051",
      "lst-syn-00050",
      ...watchlistIds(52, 120),
    ]);
    expect(watchlistRowIds(renderWorkspace())[0]).toBe("lst-syn-00050");
    const filtered = filterWatchlist("SYN00050");
    expect(textContent(filtered)).toContain(
      "Clear the filter to reorder My Watchlist",
    );
    for (const direction of ["up", "down"]) {
      const action = watchlistAction(filtered, `Move SYN00050 ${direction}`);
      expect(action.props.disabled).toBe(true);
      action.props.onClick();
    }
    retained.props.onClick();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
  });

  it("clamps a removed final page to the remaining page without losing earlier drafts", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(101),
    );
    await activateWorkspace();
    editWatchlistNote("lst-syn-00001", "Draft survives removal");
    watchlistPageButton(renderWorkspace(), "Next").props.onClick();
    watchlistPageButton(renderWorkspace(), "Next").props.onClick();
    requireButton(
      watchlistRow(renderWorkspace(), "lst-syn-00101"),
      "Remove",
    ).props.onClick();
    await flushPromises();
    const view = renderWorkspace();
    expect(watchlistRowIds(view)).toEqual(watchlistIds(51, 100));
    expect(textContent(view)).toMatch(/Page\s+2\s+of\s+2/u);
    expect(watchlistPageButton(view, "Next").props.disabled).toBe(true);
    watchlistPageButton(view, "Previous").props.onClick();
    expect(watchlistNote(renderWorkspace(), "lst-syn-00001").props.value).toBe(
      "Draft survives removal",
    );
  });

  it("passes all eleven identity fields to Research and preserves the same company's section and data", async () => {
    const record = watchlistRecord(2);
    record.payload.memberships[0] = {
      ...membership("ZERO", "lst-zero"),
      note: "Not part of the identity",
    };
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    watchlistAction(renderWorkspace(), "Research ZERO").props.onClick();
    let view = renderWorkspace();
    const expected = { ...record.payload.memberships[0] };
    const { note, ...identity } = expected;
    expect(note).toBe("Not part of the identity");
    expect(
      findElement<PersonalPortfolioProps>(view, componentMocks.Portfolio)!.props
        .selectedListing,
    ).toEqual(identity);
    expect(Object.keys(identity)).toHaveLength(11);
    requireMarketOverview(view).props.onLoad("1y");
    await flushPromises();
    view = renderWorkspace();
    const overview = requireMarketOverview(view).props.overview;
    const companyKey = requireCompanyResearch(view).key;
    requireCompanyResearch(view).props.onSectionChange("valuation");
    requireCompanyResearch(renderWorkspace()).props.onBack();
    watchlistAction(renderWorkspace(), "Research ZERO").props.onClick();
    view = renderWorkspace();
    expect(requireCompanyResearch(view).key).toBe(companyKey);
    expect(requireCompanyResearch(view).props.activeSection).toBe("valuation");
    expect(requireMarketOverview(view).props.overview).toBe(overview);
    watchlistAction(view, "Research SYN00002").props.onClick();
    view = renderWorkspace();
    expect(requireCompanyResearch(view).props.activeSection).toBe("price");
    expect(requireMarketOverview(view).props.overview).toBeNull();
    expect(apiMocks.fetchPersonalMarketOverview).toHaveBeenCalledOnce();
  });

  it.each(["version", "identity", "reorder", "remove"] as const)(
    "rejects retained row actions and note edits after a %s replacement before another render",
    async (change) => {
      const original = watchlistRecord(2);
      const latest = watchlistRecord(2, change === "version" ? 8 : 7);
      if (change === "identity")
        latest.payload.memberships[0] = {
          ...latest.payload.memberships[0]!,
          shareClassId: "shr-replaced",
        };
      if (change === "reorder") latest.payload.memberships.reverse();
      if (change === "remove") latest.payload.memberships.shift();
      apiMocks.fetchMainPersonalWatchlist
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(latest);
      apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
        new PersonalWorkspaceApiError("conflict"),
      );
      await activateWorkspace();
      const old = renderWorkspace();
      const row = watchlistRow(old, "lst-syn-00001");
      const note = watchlistNote(old, "lst-syn-00001");
      editWatchlistNote("lst-syn-00001", "Current draft");
      requireButton(
        watchlistRow(renderWorkspace(), "lst-syn-00001"),
        "Save note",
      ).props.onClick();
      await flushPromises();
      for (const button of findAllElements(row, "button"))
        (button.props.onClick as () => void)();
      note.props.onChange({ target: { value: "Stale overwrite" } });
      const view = renderWorkspace();
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
      expect(requireCompanyResearch(view).props.selection).toBeNull();
      expect(
        findElement<PersonalPortfolioProps>(view, componentMocks.Portfolio)!
          .props.selectedListing,
      ).toBeNull();
      if (change !== "remove")
        expect(watchlistNote(view, "lst-syn-00001").props.value).toBe(
          change === "identity" ? "" : "Current draft",
        );
    },
  );

  it("rejects retained off-page and filtered-out actions synchronously", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(120),
    );
    await activateWorkspace();
    const row = watchlistRow(renderWorkspace(), "lst-syn-00001");
    watchlistPageButton(renderWorkspace(), "Next").props.onClick();
    for (const button of findAllElements(row, "button"))
      (button.props.onClick as () => void)();
    let view = renderWorkspace();
    expect(requireCompanyResearch(view).props.selection).toBeNull();
    const second = watchlistRow(view, "lst-syn-00051");
    watchlistFilter(view).props.onChange({ target: { value: "SYN00120" } });
    for (const button of findAllElements(second, "button"))
      (button.props.onClick as () => void)();
    view = renderWorkspace();
    expect(requireCompanyResearch(view).props.selection).toBeNull();
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
  });

  it("cancels queued Research focus when its origin is filtered out before the microtask runs", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(2),
    );
    await activateWorkspace();
    const dom = companyFocusDocument("watchlist-title");
    const pending: Array<() => void> = [];
    vi.stubGlobal("queueMicrotask", (callback: () => void) =>
      pending.push(callback),
    );
    const view = renderWorkspace();
    watchlistAction(view, "Research SYN00001").props.onClick();
    watchlistFilter(view).props.onChange({ target: { value: "SYN00002" } });
    pending.forEach((callback) => callback());
    expect(dom.company.focus).not.toHaveBeenCalled();
    expect(dom.trigger.focus).not.toHaveBeenCalled();
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
    ).toBe("lst-syn-00001");
    expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();
  });

  it.each(["page", "filter", "identity", "remove", "session"] as const)(
    "invalidates delayed watchlist return focus after %s changes even when the old DOM trigger remains connected",
    async (change) => {
      const original = watchlistRecord(60);
      const latest = watchlistRecord(60, 8);
      latest.payload.memberships[0] = {
        ...latest.payload.memberships[0]!,
        securityName: "Replacement common shares",
      };
      if (change === "remove") latest.payload.memberships.shift();
      apiMocks.fetchMainPersonalWatchlist
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(latest);
      await activateWorkspace();
      const dom = companyFocusDocument("watchlist-title");
      watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
      await flushPromises();
      const pending: Array<() => void> = [];
      vi.stubGlobal("queueMicrotask", (callback: () => void) =>
        pending.push(callback),
      );
      requireCompanyResearch(renderWorkspace()).props.onBack();
      if (change === "page")
        watchlistPageButton(renderWorkspace(), "Next").props.onClick();
      if (change === "filter") void filterWatchlist("SYN00002");
      if (change === "identity" || change === "remove") {
        apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
          new PersonalWorkspaceApiError("conflict"),
        );
        requireButton(
          watchlistRow(renderWorkspace(), "lst-syn-00001"),
          "Save note",
        ).props.onClick();
        await flushPromises();
      }
      if (change === "session")
        await requireOwnerSession(renderWorkspace()).props.onSessionChange(
          false,
          new AbortController().signal,
        );
      void renderWorkspace();
      pending.forEach((callback) => callback());
      expect(dom.trigger.isConnected).toBe(true);
      expect(dom.trigger.focus).not.toHaveBeenCalled();
      if (change === "session") expect(dom.origin.focus).not.toHaveBeenCalled();
      else expect(dom.origin.focus).toHaveBeenCalledOnce();
    },
  );

  it("clears paging and filtering on session loss and rejects every retained private row callback", async () => {
    const record = watchlistRecord(120);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValue(record);
    await activateWorkspace();
    void filterWatchlist("SYN");
    watchlistPageButton(renderWorkspace(), "Next").props.onClick();
    const old = renderWorkspace();
    const row = watchlistRow(old, "lst-syn-00051");
    const oldNote = watchlistNote(old, "lst-syn-00051");
    const ending = requireOwnerSession(old).props.onSessionChange(
      false,
      new AbortController().signal,
    );
    for (const button of findAllElements(row, "button"))
      (button.props.onClick as () => void)();
    oldNote.props.onChange({ target: { value: "Must not reappear" } });
    await ending;
    expect(watchlistRowIds(renderWorkspace())).toEqual([]);
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
    await activateWorkspace();
    const view = renderWorkspace();
    expect(watchlistFilter(view).props.value).toBe("");
    expect(watchlistRowIds(view)).toEqual(watchlistIds(1, 50));
    expect(requireCompanyResearch(view).props.selection).toBeNull();
    watchlistPageButton(view, "Next").props.onClick();
    expect(watchlistNote(renderWorkspace(), "lst-syn-00051").props.value).toBe(
      "",
    );
  });
});

describe("Shared company research notes", () => {
  it("shares raw edits in both directions and saves the latest edit before rerendering", async () => {
    const record = watchlistRecord(2);
    record.payload.memberships[1]!.note = "Other saved note";
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    openNoteCompany(record.payload.memberships[0]!);
    const first = renderWorkspace();
    watchlistNote(first, "lst-syn-00001").props.onChange({
      target: { value: "  Draft from the row  " },
    });
    expect(requireCompanyNote(renderWorkspace()).props.value).toBe(
      "  Draft from the row  ",
    );
    requireCompanyNote(renderWorkspace()).props.onChange(
      "  Cafe\u0301 outlook  ",
    );
    const view = renderWorkspace();
    expect(watchlistNote(view, "lst-syn-00001").props.value).toBe(
      "  Cafe\u0301 outlook  ",
    );
    const editor = requireCompanyNote(view);
    editor.props.onChange("  Cafe\u0301 final thesis  ");
    editor.props.onSave();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    const [version, payload] =
      apiMocks.saveMainPersonalWatchlist.mock.calls[0]!;
    expect(version).toBe(7);
    expect(payload).toEqual({
      ...record.payload,
      memberships: [
        { ...record.payload.memberships[0], note: "Caf\u00e9 final thesis" },
        record.payload.memberships[1],
      ],
    });
    await flushPromises();
    expect(requireCompanyNote(renderWorkspace()).props.value).toBe(
      "Caf\u00e9 final thesis",
    );
    expect(watchlistNote(renderWorkspace(), "lst-syn-00001").props.value).toBe(
      "Caf\u00e9 final thesis",
    );
  });

  it.each(["company", "row"] as const)(
    "accepts only one write when %s saves and retained controls fire before rerender",
    async (origin) => {
      const record = watchlistRecord(1);
      apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
      const pending = deferred<SavedPersonalWatchlist>();
      apiMocks.saveMainPersonalWatchlist.mockReturnValueOnce(pending.promise);
      await activateWorkspace();
      openNoteCompany(record.payload.memberships[0]!);
      const view = renderWorkspace();
      const company = requireCompanyNote(view);
      const row = watchlistNote(view, "lst-syn-00001");
      const rowSave = requireButton(
        watchlistRow(view, "lst-syn-00001"),
        "Save note",
      );
      row.props.onChange({ target: { value: "  Save exactly this  " } });
      if (origin === "company") company.props.onSave();
      else rowSave.props.onClick();
      company.props.onSave();
      rowSave.props.onClick();
      company.props.onChange("Rejected company edit");
      row.props.onChange({ target: { value: "Rejected row edit" } });
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
      const payload = apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1];
      expect(payload.memberships[0]!.note).toBe("Save exactly this");
      expect(requireCompanyNote(renderWorkspace()).props.disabled).toBe(true);
      expect(
        watchlistNote(renderWorkspace(), "lst-syn-00001").props.disabled,
      ).toBe(true);
      expect(requireCompanyNote(renderWorkspace()).props.value).toBe(
        "  Save exactly this  ",
      );
      pending.resolve({ version: 8, payload });
      await flushPromises();
      expect(requireCompanyNote(renderWorkspace()).props.value).toBe(
        "Save exactly this",
      );
    },
  );

  it("keeps company A's note independent of the separately chosen holding B", async () => {
    const record = watchlistRecord(2);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    openNoteCompany(record.payload.memberships[0]!);
    watchlistAction(
      renderWorkspace(),
      "Choose SYN00002 for portfolio",
    ).props.onClick();
    const view = renderWorkspace();
    expect(
      findElement<PersonalPortfolioProps>(view, componentMocks.Portfolio)!.props
        .selectedListing?.listingId,
    ).toBe("lst-syn-00002");
    expect(requireCompanyResearch(view).props.selection?.listingId).toBe(
      "lst-syn-00001",
    );
    const editor = requireCompanyNote(view);
    editor.props.onChange("A's thesis");
    editor.props.onSave();
    await flushPromises();
    expect(
      apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1].memberships,
    ).toEqual([
      { ...record.payload.memberships[0], note: "A's thesis" },
      record.payload.memberships[1],
    ]);
  });

  it.each([
    ["exchangeMic", "XNYS"],
    ["instrumentType", "adr"],
    ["issuerId", "iss-replacement"],
    ["issuerName", "Replacement Issuer"],
    ["listingId", "lst-replacement"],
    ["securityId", "sec-replacement"],
    ["securityName", "Replacement Common Stock"],
    ["shareClassId", "shr-replacement"],
    ["shareClassName", "Class B"],
    ["symbol", "REPLACED"],
  ] as const)(
    "does not lend a saved note to a selected company with a different %s",
    async (field, value) => {
      const record = watchlistRecord(1);
      record.payload.memberships[0]!.note =
        "Belongs to the original full identity";
      apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
      await activateWorkspace();
      openNoteCompany(record.payload.memberships[0]!);
      const oldEditor = requireCompanyNote(renderWorkspace());
      openNoteCompany({ ...record.payload.memberships[0]!, [field]: value });
      oldEditor.props.onChange("Stale edit");
      oldEditor.props.onSave();
      const current = findCompanyNote(renderWorkspace());
      expect(current === undefined || current.props.disabled).toBe(true);
      expect(current?.props.value ?? "").not.toBe(
        "Belongs to the original full identity",
      );
      expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
      expect(
        watchlistNote(renderWorkspace(), "lst-syn-00001").props.value,
      ).toBe("Belongs to the original full identity");
    },
  );

  it.each(["page", "filter"] as const)(
    "edits an exact saved company while its row is outside the current %s",
    async (hiddenBy) => {
      const record = watchlistRecord(60);
      apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
      await activateWorkspace();
      openNoteCompany(record.payload.memberships[0]!);
      if (hiddenBy === "page")
        watchlistPageButton(renderWorkspace(), "Next").props.onClick();
      else void filterWatchlist("SYN00060");
      expect(watchlistRowIds(renderWorkspace())).not.toContain("lst-syn-00001");
      const editor = requireCompanyNote(renderWorkspace());
      expect(editor.props.disabled).toBe(false);
      editor.props.onChange("Off-page research");
      editor.props.onSave();
      await flushPromises();
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
      const payload = apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1];
      expect(payload.memberships).toHaveLength(60);
      expect(payload.memberships[0]!.note).toBe("Off-page research");
      expect(payload.memberships.slice(1)).toEqual(
        record.payload.memberships.slice(1),
      );
      if (hiddenBy === "page")
        watchlistPageButton(renderWorkspace(), "Previous").props.onClick();
      else void filterWatchlist("");
      expect(
        watchlistNote(renderWorkspace(), "lst-syn-00001").props.value,
      ).toBe("Off-page research");
    },
  );

  it("preserves the raw draft across a version conflict while retiring pre-reload controls", async () => {
    const original = watchlistRecord(1);
    const latest = watchlistRecord(1, 8);
    latest.payload.memberships[0]!.note = "Saved elsewhere";
    apiMocks.fetchMainPersonalWatchlist
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(latest);
    apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("conflict"),
    );
    await activateWorkspace();
    openNoteCompany(original.payload.memberships[0]!);
    const oldView = renderWorkspace();
    const old = requireCompanyNote(oldView);
    const oldRow = watchlistNote(oldView, "lst-syn-00001");
    const oldRowSave = requireButton(
      watchlistRow(oldView, "lst-syn-00001"),
      "Save note",
    );
    old.props.onChange("  Keep the unsaved thesis  ");
    old.props.onSave();
    await flushPromises(12);
    old.props.onChange("Stale company overwrite");
    old.props.onSave();
    oldRow.props.onChange({ target: { value: "Stale row overwrite" } });
    oldRowSave.props.onClick();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    const current = requireCompanyNote(renderWorkspace());
    expect(current.props.value).toBe("  Keep the unsaved thesis  ");
    expect(current.props.message).toMatch(/changed|conflict/iu);
    current.props.onSave();
    await flushPromises();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledTimes(2);
    expect(apiMocks.saveMainPersonalWatchlist.mock.calls[1]![0]).toBe(8);
    expect(
      apiMocks.saveMainPersonalWatchlist.mock.calls[1]![1].memberships[0]!.note,
    ).toBe("Keep the unsaved thesis");
  });

  it("does not claim a latest-version reload when conflict recovery fails", async () => {
    const record = watchlistRecord(1);
    apiMocks.fetchMainPersonalWatchlist
      .mockResolvedValueOnce(record)
      .mockRejectedValueOnce(new Error("Synthetic reload unavailable"));
    apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("conflict"),
    );
    await activateWorkspace();
    openNoteCompany(record.payload.memberships[0]!);
    const editor = requireCompanyNote(renderWorkspace());
    editor.props.onChange("  Preserve on failed reload  ");
    editor.props.onSave();
    await flushPromises(12);
    const current = requireCompanyNote(renderWorkspace());
    expect(current.props.value).toBe("  Preserve on failed reload  ");
    expect(current.props.message).toMatch(/could not|unavailable|failed/iu);
    expect(current.props.message).not.toMatch(
      /latest saved (?:list|version) is(?: now)? shown|latest watchlist (?:was|is|has been) loaded/iu,
    );
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
  });

  it.each(["identity replacement", "removal"] as const)(
    "prunes the exact draft after %s and never revives it when the original identity returns",
    async (change) => {
      const original = watchlistRecord(2);
      original.payload.memberships[0]!.note = "Original saved note";
      const latest = watchlistRecord(2, 8);
      if (change === "identity replacement")
        latest.payload.memberships[0] = {
          ...latest.payload.memberships[0]!,
          securityId: "sec-replaced",
          note: "Replacement saved note",
        };
      else latest.payload.memberships.shift();
      const returned = { ...original, version: 9 };
      apiMocks.fetchMainPersonalWatchlist
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(latest)
        .mockResolvedValueOnce(returned);
      apiMocks.saveMainPersonalWatchlist
        .mockRejectedValueOnce(new PersonalWorkspaceApiError("conflict"))
        .mockRejectedValueOnce(new PersonalWorkspaceApiError("conflict"));
      await activateWorkspace();
      openNoteCompany(original.payload.memberships[0]!);
      const old = requireCompanyNote(renderWorkspace());
      old.props.onChange("Never revive this unsaved draft");
      old.props.onSave();
      await flushPromises(12);
      old.props.onChange("Retired overwrite");
      old.props.onSave();
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
      expect(
        findCompanyNote(renderWorkspace())?.props.value ?? "",
      ).not.toContain("Never revive");
      if (change === "identity replacement")
        expect(
          watchlistNote(renderWorkspace(), "lst-syn-00001").props.value,
        ).toBe("Replacement saved note");
      else
        expect(watchlistRowIds(renderWorkspace())).not.toContain(
          "lst-syn-00001",
        );
      expect(textContent(renderWorkspace())).toMatch(
        /unsaved research notes.*(?:removed|changed).*discarded/iu,
      );
      requireButton(
        watchlistRow(renderWorkspace(), "lst-syn-00002"),
        "Save note",
      ).props.onClick();
      await flushPromises(12);
      old.props.onChange("Still retired after re-add");
      old.props.onSave();
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledTimes(2);
      openNoteCompany(original.payload.memberships[0]!);
      expect(requireCompanyNote(renderWorkspace()).props.value).toBe(
        "Original saved note",
      );
      expect(
        watchlistNote(renderWorkspace(), "lst-syn-00001").props.value,
      ).toBe("Original saved note");
    },
  );
});

describe("Company research note lifecycle", () => {
  it("does not revive a draft or feedback after session loss during conflict recovery", async () => {
    const record = watchlistRecord(1);
    const reload = deferred<PersonalWatchlistRecord | null>();
    apiMocks.fetchMainPersonalWatchlist
      .mockResolvedValueOnce(record)
      .mockReturnValueOnce(reload.promise)
      .mockResolvedValueOnce(record);
    apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("conflict"),
    );
    await activateWorkspace();
    openNoteCompany(record.payload.memberships[0]!);
    const oldView = renderWorkspace();
    const editor = requireCompanyNote(oldView);
    editor.props.onChange("Clear this private draft");
    editor.props.onSave();
    await flushPromises(6);
    expect(apiMocks.fetchMainPersonalWatchlist).toHaveBeenCalledTimes(2);
    const end = requireOwnerSession(renderWorkspace()).props.onSessionChange(
      false,
      new AbortController().signal,
    );
    editor.props.onChange("Retired session edit");
    editor.props.onSave();
    await end;
    reload.resolve({ ...record, version: 8 });
    await flushPromises(12);
    expect(
      findElement(renderWorkspace(), componentMocks.CompanyResearch),
    ).toBeUndefined();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    await activateWorkspace();
    openNoteCompany(record.payload.memberships[0]!);
    const current = requireCompanyNote(renderWorkspace());
    expect(current.props.value).toBe("");
    expect(current.props.message ?? "").not.toMatch(
      /saved|latest|conflict|another tab/iu,
    );
  });

  it("does not erase company B's equally worded draft or feedback when company A's save finishes", async () => {
    const record = watchlistRecord(2);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    const pending = deferred<SavedPersonalWatchlist>();
    apiMocks.saveMainPersonalWatchlist.mockReturnValueOnce(pending.promise);
    await activateWorkspace();
    openNoteCompany(record.payload.memberships[1]!);
    requireCompanyNote(renderWorkspace()).props.onChange("  Same draft text  ");
    openNoteCompany(record.payload.memberships[0]!);
    const editorA = requireCompanyNote(renderWorkspace());
    editorA.props.onChange("  Same draft text  ");
    editorA.props.onSave();
    openNoteCompany(record.payload.memberships[1]!);
    const before = requireCompanyNote(renderWorkspace());
    expect(before.props.value).toBe("  Same draft text  ");
    const feedbackB = before.props.message;
    editorA.props.onChange("Stale A edit while B is selected");
    editorA.props.onSave();
    pending.resolve({
      version: 8,
      payload: apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1],
    });
    await flushPromises(12);
    const after = requireCompanyNote(renderWorkspace());
    expect(after.props.value).toBe("  Same draft text  ");
    expect(after.props.message).toBe(feedbackB);
    expect(after.props.message ?? "").not.toMatch(/SYN00001|saved/iu);
    expect(watchlistNote(renderWorkspace(), "lst-syn-00002").props.value).toBe(
      "  Same draft text  ",
    );
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    openNoteCompany(record.payload.memberships[0]!);
    expect(requireCompanyNote(renderWorkspace()).props.value).toBe(
      "Same draft text",
    );
  });

  it("keeps failed saves and their draft associated with the initiating company", async () => {
    const record = watchlistRecord(2);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    const pending = deferred<void>();
    apiMocks.saveMainPersonalWatchlist.mockImplementationOnce(async () => {
      await pending.promise;
      throw new Error("Synthetic write unavailable");
    });
    await activateWorkspace();
    openNoteCompany(record.payload.memberships[0]!);
    const editor = requireCompanyNote(renderWorkspace());
    editor.props.onChange("  Retry this company later  ");
    editor.props.onSave();
    openNoteCompany(record.payload.memberships[1]!);
    const feedbackB = requireCompanyNote(renderWorkspace()).props.message;
    pending.resolve();
    await flushPromises(12);
    expect(requireCompanyNote(renderWorkspace()).props.value).toBe("");
    expect(requireCompanyNote(renderWorkspace()).props.message).toBe(feedbackB);
    openNoteCompany(record.payload.memberships[0]!);
    expect(requireCompanyNote(renderWorkspace()).props.value).toBe(
      "  Retry this company later  ",
    );
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
  });

  it.each([
    ["overlength", "x".repeat(2_001)],
    ["control character", "Before\u0000after"],
    ["format character", "Before\u202eafter"],
    ["unpaired surrogate", "Before\ud800after"],
  ])(
    "preserves but never writes a draft containing %s",
    async (_case, value) => {
      const record = watchlistRecord(1);
      apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
      await activateWorkspace();
      openNoteCompany(record.payload.memberships[0]!);
      const editor = requireCompanyNote(renderWorkspace());
      editor.props.onChange(value);
      editor.props.onSave();
      await flushPromises();
      const view = renderWorkspace();
      expect(requireCompanyNote(view).props.value).toBe(value);
      expect(watchlistNote(view, "lst-syn-00001").props.value).toBe(value);
      expect(requireCompanyNote(view).props.message).toMatch(
        /2,000|control|invalid/iu,
      );
      requireButton(
        watchlistRow(view, "lst-syn-00001"),
        "Save note",
      ).props.onClick();
      await flushPromises();
      expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
    },
  );

  it.each(["", "x".repeat(2_000)])(
    "allows an explicitly saved empty or maximum-length note",
    async (value) => {
      const record = watchlistRecord(1);
      record.payload.memberships[0]!.note = "Previously saved";
      apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
      await activateWorkspace();
      openNoteCompany(record.payload.memberships[0]!);
      const editor = requireCompanyNote(renderWorkspace());
      editor.props.onChange(value);
      editor.props.onSave();
      await flushPromises();
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
      expect(
        apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1].memberships[0]!
          .note,
      ).toBe(value);
    },
  );

  it.each(["not saved", "stale catalog", "unavailable list"] as const)(
    "does not provide an editable note for a company with %s membership",
    async (state) => {
      const record = watchlistRecord(1);
      const identity = record.payload.memberships[0]!;
      if (state === "not saved") record.payload.memberships = [];
      if (state === "stale catalog")
        record.payload.snapshotSha256 = `sha256:${"d".repeat(64)}`;
      if (state === "unavailable list")
        apiMocks.fetchMainPersonalWatchlist.mockRejectedValueOnce(
          new Error("Synthetic read unavailable"),
        );
      else apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
      await activateWorkspace();
      openNoteCompany(identity);
      const editor = findCompanyNote(renderWorkspace());
      expect(editor === undefined || editor.props.disabled).toBe(true);
      editor?.props.onChange("Cannot edit this membership");
      editor?.props.onSave();
      await flushPromises();
      expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
    },
  );

  it("preserves drafts through company sections, Back and Clear without additional reads or storage", async () => {
    const record = watchlistRecord(2);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    const calls = Object.values(apiMocks).map((mock) => mock.mock.calls.length);
    const fetch = vi.fn();
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    openNoteCompany(record.payload.memberships[0]!);
    requireCompanyNote(renderWorkspace()).props.onChange(
      "  Local research draft  ",
    );
    for (const section of [
      "financials",
      "valuation",
      "peers",
      "sec",
      "price",
    ] as const) {
      requireCompanyResearch(renderWorkspace()).props.onSectionChange(section);
      expect(requireCompanyNote(renderWorkspace()).props.value).toBe(
        "  Local research draft  ",
      );
    }
    requireCompanyResearch(renderWorkspace()).props.onBack();
    expect(watchlistNote(renderWorkspace(), "lst-syn-00001").props.value).toBe(
      "  Local research draft  ",
    );
    requireCompanyResearch(renderWorkspace()).props.onClear();
    openNoteCompany(record.payload.memberships[1]!);
    expect(requireCompanyNote(renderWorkspace()).props.value).toBe("");
    openNoteCompany(record.payload.memberships[0]!);
    expect(requireCompanyNote(renderWorkspace()).props.value).toBe(
      "  Local research draft  ",
    );
    await flushPromises();
    expect(
      Object.values(apiMocks).map((mock) => mock.mock.calls.length),
    ).toEqual(calls);
    expect(fetch).not.toHaveBeenCalled();
    for (const method of Object.values(storage))
      expect(method).not.toHaveBeenCalled();
  });
});

describe("Sequential My Watchlist research", () => {
  it("moves through all 120 saved identities across page boundaries without changing the list, holding or issuing requests", async () => {
    const record = watchlistRecord(120);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    const calls = Object.values(apiMocks).map((mock) => mock.mock.calls.length);
    const fetch = vi.fn();
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    watchlistAction(renderWorkspace(), "Research SYN00050").props.onClick();
    watchlistAction(
      renderWorkspace(),
      "Choose SYN00001 for portfolio",
    ).props.onClick();
    let view = renderWorkspace();
    expect(requireCompanyNavigation(view).props).toMatchObject({
      position: 50,
      total: 120,
      disabled: false,
      invalidated: false,
    });
    requireCompanyNavigation(view).props.onNext();
    view = renderWorkspace();
    expect(requireCompanyResearch(view).props.selection?.listingId).toBe(
      "lst-syn-00051",
    );
    expect(watchlistRowIds(view)).toEqual(watchlistIds(1, 50));
    expect(requireCompanyNavigation(view).props.position).toBe(51);
    watchlistPageButton(view, "Next").props.onClick();
    view = renderWorkspace();
    expect(requireCompanyNavigation(view).props.disabled).toBe(false);
    requireCompanyNavigation(view).props.onPrevious();
    view = renderWorkspace();
    expect(requireCompanyResearch(view).props.selection?.listingId).toBe(
      "lst-syn-00050",
    );
    expect(watchlistRowIds(view)).toEqual(watchlistIds(51, 100));
    for (let position = 51; position <= 120; position += 1) {
      requireCompanyNavigation(view).props.onNext();
      view = renderWorkspace();
      expect(requireCompanyNavigation(view).props.position).toBe(position);
      expect(requireCompanyResearch(view).props.selection?.listingId).toBe(
        watchlistIds(position, position)[0],
      );
    }
    requireCompanyNavigation(view).props.onNext();
    expect(requireCompanyNavigation(renderWorkspace()).props.position).toBe(
      120,
    );
    requireCompanyResearch(renderWorkspace()).props.onSectionChange(
      "valuation",
    );
    requireCompanyResearch(renderWorkspace()).props.onBack();
    await flushPromises();
    view = renderWorkspace();
    expect(
      findElement<PersonalPortfolioProps>(view, componentMocks.Portfolio)!.props
        .selectedListing?.listingId,
    ).toBe("lst-syn-00001");
    expect(
      findElement<PersonalFinancialScreenerProps>(
        view,
        componentMocks.FinancialScreener,
      )!.props.watchlistMemberships,
    ).toEqual(record.payload.memberships);
    expect(
      findElement<PersonalWatchlistFilingsProps>(
        view,
        componentMocks.WatchlistFilings,
      )!.props.memberships,
    ).toEqual(record.payload.memberships);
    expect(
      Object.values(apiMocks).map((mock) => mock.mock.calls.length),
    ).toEqual(calls);
    expect(fetch).not.toHaveBeenCalled();
    for (const method of Object.values(storage))
      expect(method).not.toHaveBeenCalled();
  });

  it("captures all filtered matches in saved order and never wraps or skips at either endpoint", async () => {
    const record = watchlistRecord(4);
    record.payload.memberships = [
      record.payload.memberships[3]!,
      record.payload.memberships[1]!,
      record.payload.memberships[0]!,
      record.payload.memberships[2]!,
    ];
    for (const member of record.payload.memberships)
      member.issuerName =
        member.symbol === "SYN00002" ? "Excluded" : "Selected group";
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    void filterWatchlist("selected");
    watchlistAction(renderWorkspace(), "Research SYN00004").props.onClick();
    expect(requireCompanyNavigation(renderWorkspace()).props).toMatchObject({
      position: 1,
      total: 3,
    });
    requireCompanyNavigation(renderWorkspace()).props.onPrevious();
    for (const id of ["lst-syn-00001", "lst-syn-00003"]) {
      requireCompanyNavigation(renderWorkspace()).props.onNext();
      expect(
        requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
      ).toBe(id);
    }
    requireCompanyNavigation(renderWorkspace()).props.onNext();
    expect(requireCompanyNavigation(renderWorkspace()).props.position).toBe(3);
    requireCompanyNavigation(renderWorkspace()).props.onPrevious();
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
    ).toBe("lst-syn-00001");
    void filterWatchlist("SYN00001");
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    const singleton = requireCompanyNavigation(renderWorkspace());
    expect(singleton.props).toMatchObject({
      position: 1,
      total: 1,
      invalidated: false,
    });
    singleton.props.onPrevious();
    singleton.props.onNext();
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
    ).toBe("lst-syn-00001");
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
  });

  it("keeps raw notes for A and B through A-to-B-to-A while changing research only", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(3),
    );
    await activateWorkspace();
    editWatchlistNote("lst-syn-00001", "  A's raw thesis  ");
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    watchlistAction(
      renderWorkspace(),
      "Choose SYN00003 for portfolio",
    ).props.onClick();
    expect(requireCompanyNote(renderWorkspace()).props.value).toBe(
      "  A's raw thesis  ",
    );
    requireCompanyNavigation(renderWorkspace()).props.onNext();
    requireCompanyNote(renderWorkspace()).props.onChange(
      " B's separate draft\n",
    );
    requireCompanyNavigation(renderWorkspace()).props.onPrevious();
    let view = renderWorkspace();
    expect(requireCompanyNote(view).props.value).toBe("  A's raw thesis  ");
    expect(watchlistNote(view, "lst-syn-00002").props.value).toBe(
      " B's separate draft\n",
    );
    requireCompanyNote(view).props.onChange(
      "  A updated in company research  ",
    );
    requireCompanyNavigation(renderWorkspace()).props.onNext();
    view = renderWorkspace();
    expect(requireCompanyNote(view).props.value).toBe(" B's separate draft\n");
    expect(watchlistNote(view, "lst-syn-00001").props.value).toBe(
      "  A updated in company research  ",
    );
    expect(
      findElement<PersonalPortfolioProps>(view, componentMocks.Portfolio)!.props
        .selectedListing?.listingId,
    ).toBe("lst-syn-00003");
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
  });

  it("admits only one invocation of retained Next and retires callbacks and model mounts after A-to-B-to-A", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(3),
    );
    await activateWorkspace();
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    const original = renderWorkspace();
    const oldCompany = requireCompanyResearch(original);
    const next = requireCompanyNavigation(original).props.onNext;
    next();
    next();
    const second = renderWorkspace();
    expect(requireCompanyNavigation(second).props.position).toBe(2);
    const retiredSecondNext = requireCompanyNavigation(second).props.onNext;
    requireCompanyNavigation(second).props.onPrevious();
    next();
    retiredSecondNext();
    oldCompany.props.onSectionChange("valuation");
    oldCompany.props.onClear();
    const returned = renderWorkspace();
    expect(requireCompanyResearch(returned).props.selection?.listingId).toBe(
      "lst-syn-00001",
    );
    expect(requireCompanyResearch(returned).props.activeSection).toBe("price");
    // A different parent key remounts the DCF even if React batches A -> B -> A.
    expect(requireCompanyResearch(returned).key).not.toBe(oldCompany.key);
    expect(requireCompanyNavigation(returned).props.position).toBe(1);
    requireCompanyNavigation(returned).props.onNext();
    expect(requireCompanyNavigation(renderWorkspace()).props.position).toBe(2);
  });

  it("preserves the original row Back target while independently focusing an off-page next company", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(120),
    );
    await activateWorkspace();
    const dom = companyFocusDocument("watchlist-title");
    watchlistAction(renderWorkspace(), "Research SYN00050").props.onClick();
    await flushPromises();
    dom.company.focus.mockClear();
    // Next is activated inside the company panel, not from the original row.
    vi.stubGlobal("document", {
      activeElement: dom.company,
      getElementById: dom.getElementById,
    });
    requireCompanyNavigation(renderWorkspace()).props.onNext();
    await flushPromises();
    expect(dom.company.focus).toHaveBeenCalledOnce();
    requireCompanyResearch(renderWorkspace()).props.onBack();
    await flushPromises();
    expect(dom.trigger.focus).toHaveBeenCalledOnce();
    dom.trigger.focus.mockClear();
    watchlistPageButton(renderWorkspace(), "Next").props.onClick();
    requireCompanyNavigation(renderWorkspace()).props.onNext();
    await flushPromises();
    expect(dom.company.focus).toHaveBeenCalledTimes(2);
    requireCompanyResearch(renderWorkspace()).props.onBack();
    await flushPromises();
    expect(dom.trigger.isConnected).toBe(true);
    expect(dom.trigger.focus).not.toHaveBeenCalled();
    expect(dom.origin.focus).toHaveBeenCalledOnce();
    expect(watchlistRowIds(renderWorkspace())).toEqual(watchlistIds(51, 100));
  });

  it("retires a cohort on filter A-to-B-to-A and recaptures it only on explicit same-company row Research", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(3),
    );
    await activateWorkspace();
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    const old = requireCompanyNavigation(renderWorkspace());
    const key = requireCompanyResearch(renderWorkspace()).key;
    requireCompanyResearch(renderWorkspace()).props.onSectionChange(
      "valuation",
    );
    void filterWatchlist("SYN");
    void filterWatchlist("");
    old.props.onNext();
    expect(requireCompanyNavigation(renderWorkspace()).props).toMatchObject({
      disabled: true,
      invalidated: true,
    });
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
    ).toBe("lst-syn-00001");
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    old.props.onNext();
    const current = renderWorkspace();
    expect(requireCompanyNavigation(current).props).toMatchObject({
      position: 1,
      total: 3,
      disabled: false,
      invalidated: false,
    });
    expect(requireCompanyResearch(current).key).toBe(key);
    expect(requireCompanyResearch(current).props.activeSection).toBe(
      "valuation",
    );
    requireCompanyNavigation(current).props.onNext();
    expect(requireCompanyNavigation(renderWorkspace()).props.position).toBe(2);
  });

  it.each(["search", "catalog", "financials", "filings", "portfolio"] as const)(
    "clears the cohort before the same-company early return from %s Research",
    async (origin) => {
      const record = watchlistRecord(2);
      const identity = record.payload.memberships[0]!;
      apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
      await activateWorkspace();
      watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
      const view = renderWorkspace();
      const old = requireCompanyNavigation(view);
      const key = requireCompanyResearch(view).key;
      if (origin === "search") {
        apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
          limitApplied: 15,
          normalizedQuery: identity.symbol,
          results: [
            {
              ...searchResult(identity.symbol, identity.listingId),
              ...identity,
            },
          ],
          snapshot: snapshot(),
          totalMatches: 1,
        });
        await searchAndSelectMarket(identity.symbol);
      }
      if (origin === "catalog") openNoteCompany(identity);
      if (origin === "financials")
        findElement<PersonalFinancialScreenerProps>(
          view,
          componentMocks.FinancialScreener,
        )!.props.onOpenResearch({ ...identity, cik: "0000000001" });
      if (origin === "filings")
        findElement<PersonalWatchlistFilingsProps>(
          view,
          componentMocks.WatchlistFilings,
        )!.props.onOpenResearch(identity);
      if (origin === "portfolio")
        findElement<PersonalPortfolioProps>(view, componentMocks.Portfolio)!
          .props.onOpenResearch!(identity);
      old.props.onNext();
      const current = renderWorkspace();
      expect(findCompanyNavigation(current)).toBeUndefined();
      expect(requireCompanyResearch(current).key).toBe(key);
      expect(requireCompanyResearch(current).props.selection?.listingId).toBe(
        identity.listingId,
      );
      expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
    },
  );

  it.each(["saved", "conflict"] as const)(
    "retains the sequence after a note-only %s version change while retiring old navigation controls",
    async (outcome) => {
      const original = watchlistRecord(3);
      const latest = watchlistRecord(3, 8);
      latest.payload.memberships[0]!.note = "Saved elsewhere";
      apiMocks.fetchMainPersonalWatchlist
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(latest);
      const pending = deferred<SavedPersonalWatchlist>();
      if (outcome === "saved")
        apiMocks.saveMainPersonalWatchlist.mockReturnValueOnce(pending.promise);
      else
        apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
          new PersonalWorkspaceApiError("conflict"),
        );
      await activateWorkspace();
      watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
      const old = requireCompanyNavigation(renderWorkspace());
      const editor = requireCompanyNote(renderWorkspace());
      editor.props.onChange("  Retain through version change  ");
      editor.props.onSave();
      old.props.onNext();
      const busy = requireCompanyNavigation(renderWorkspace());
      expect(busy.props.disabled).toBe(true);
      busy.props.onNext();
      if (outcome === "saved")
        pending.resolve({
          version: 8,
          payload: apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1],
        });
      await flushPromises(12);
      old.props.onNext();
      busy.props.onNext();
      let view = renderWorkspace();
      expect(requireCompanyNavigation(view).props).toMatchObject({
        position: 1,
        total: 3,
        disabled: false,
        invalidated: false,
      });
      expect(requireCompanyNote(view).props.value).toBe(
        outcome === "saved"
          ? "Retain through version change"
          : "  Retain through version change  ",
      );
      requireCompanyNavigation(view).props.onNext();
      requireCompanyNavigation(renderWorkspace()).props.onPrevious();
      view = renderWorkspace();
      expect(requireCompanyNote(view).props.value).toBe(
        outcome === "saved"
          ? "Retain through version change"
          : "  Retain through version change  ",
      );
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    },
  );

  it("blocks navigation throughout a delayed conflict reload without discarding the retained sequence", async () => {
    const reload = deferred<PersonalWatchlistRecord | null>();
    apiMocks.fetchMainPersonalWatchlist
      .mockResolvedValueOnce(watchlistRecord(2))
      .mockReturnValueOnce(reload.promise);
    apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("conflict"),
    );
    await activateWorkspace();
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    requireCompanyNote(renderWorkspace()).props.onSave();
    await flushPromises();
    const reconciling = requireCompanyNavigation(renderWorkspace());
    expect(reconciling.props.disabled).toBe(true);
    reconciling.props.onNext();
    reload.resolve(watchlistRecord(2, 8));
    await flushPromises(12);
    reconciling.props.onNext();
    expect(requireCompanyNavigation(renderWorkspace()).props.position).toBe(1);
    requireCompanyNavigation(renderWorkspace()).props.onNext();
    expect(requireCompanyNavigation(renderWorkspace()).props.position).toBe(2);
  });

  it.each(["addition", "removal", "reorder"] as const)(
    "invalidates on an off-filter %s even though every captured match is unchanged",
    async (change) => {
      const original = watchlistRecord(4);
      for (const member of original.payload.memberships.slice(0, 2))
        member.issuerName = "Captured group";
      const latest = {
        ...original,
        version: 8,
        payload: {
          ...original.payload,
          memberships: [...original.payload.memberships],
        },
      };
      if (change === "addition")
        latest.payload.memberships.push(membership("EXTRA", "lst-extra"));
      if (change === "removal") latest.payload.memberships.pop();
      if (change === "reorder")
        [latest.payload.memberships[2], latest.payload.memberships[3]] = [
          latest.payload.memberships[3]!,
          latest.payload.memberships[2]!,
        ];
      apiMocks.fetchMainPersonalWatchlist
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(latest);
      apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
        new PersonalWorkspaceApiError("conflict"),
      );
      await activateWorkspace();
      void filterWatchlist("Captured");
      watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
      const old = requireCompanyNavigation(renderWorkspace());
      requireCompanyNote(renderWorkspace()).props.onSave();
      await flushPromises(12);
      old.props.onNext();
      const current = requireCompanyNavigation(renderWorkspace());
      expect(current.props).toMatchObject({
        position: 1,
        total: 2,
        disabled: true,
        invalidated: true,
      });
      current.props.onNext();
      expect(
        requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
      ).toBe("lst-syn-00001");
      expect(watchlistRowIds(renderWorkspace())).toEqual(watchlistIds(1, 2));
    },
  );

  // Country is admitted only as literal US; the remaining ten identity fields
  // can change while the catalog and watchlist remain otherwise well formed.
  it.each([
    ["exchangeMic", "XNYS"],
    ["instrumentType", "adr"],
    ["issuerId", "iss-replacement"],
    ["issuerName", "Replacement Issuer"],
    ["listingId", "lst-replacement"],
    ["securityId", "sec-replacement"],
    ["securityName", "Replacement Common Stock"],
    ["shareClassId", "shr-replacement"],
    ["shareClassName", "Class B"],
    ["symbol", "REPLACED"],
  ] as const)(
    "invalidates a target whose full identity changes at %s instead of substituting it",
    async (field, value) => {
      const original = watchlistRecord(2);
      const latest = watchlistRecord(2, 8);
      latest.payload.memberships[1] = {
        ...latest.payload.memberships[1]!,
        [field]: value,
      };
      apiMocks.fetchMainPersonalWatchlist
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(latest);
      apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
        new PersonalWorkspaceApiError("conflict"),
      );
      await activateWorkspace();
      watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
      const next = requireCompanyNavigation(renderWorkspace()).props.onNext;
      requireCompanyNote(renderWorkspace()).props.onSave();
      await flushPromises(12);
      next();
      const current = requireCompanyNavigation(renderWorkspace());
      expect(current.props).toMatchObject({
        disabled: true,
        invalidated: true,
      });
      current.props.onNext();
      expect(
        requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
      ).toBe("lst-syn-00001");
    },
  );

  it("never revives an invalidated sequence when a removed company is added back", async () => {
    const original = watchlistRecord(2);
    const removed = watchlistRecord(1, 8);
    apiMocks.fetchMainPersonalWatchlist
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(removed)
      .mockResolvedValueOnce({ ...original, version: 9 });
    apiMocks.saveMainPersonalWatchlist
      .mockRejectedValueOnce(new PersonalWorkspaceApiError("conflict"))
      .mockRejectedValueOnce(new PersonalWorkspaceApiError("conflict"));
    await activateWorkspace();
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    const old = requireCompanyNavigation(renderWorkspace());
    requireCompanyNote(renderWorkspace()).props.onSave();
    await flushPromises(12);
    requireCompanyNote(renderWorkspace()).props.onSave();
    await flushPromises(12);
    old.props.onNext();
    const current = requireCompanyNavigation(renderWorkspace());
    expect(current.props.invalidated).toBe(true);
    current.props.onNext();
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
    ).toBe("lst-syn-00001");
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    requireCompanyNavigation(renderWorkspace()).props.onNext();
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
    ).toBe("lst-syn-00002");
  });

  it("invalidates navigation when conflict reload returns a watchlist bound to another catalog", async () => {
    const latest = watchlistRecord(2, 8);
    latest.payload.snapshotSha256 = `sha256:${"d".repeat(64)}`;
    apiMocks.fetchMainPersonalWatchlist
      .mockResolvedValueOnce(watchlistRecord(2))
      .mockResolvedValueOnce(latest);
    apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("conflict"),
    );
    await activateWorkspace();
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    const old = requireCompanyNavigation(renderWorkspace());
    requireCompanyNote(renderWorkspace()).props.onSave();
    await flushPromises(12);
    old.props.onNext();
    const current = requireCompanyNavigation(renderWorkspace());
    expect(current.props).toMatchObject({ invalidated: true, disabled: true });
    current.props.onNext();
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
    ).toBe("lst-syn-00001");
  });

  it("clears the sequence when an explicit search discovers a changed catalog snapshot", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValue(watchlistRecord(2));
    apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
      limitApplied: 15,
      normalizedQuery: "SYN",
      results: [],
      totalMatches: 0,
      snapshot: { ...snapshot(), snapshotSha256: `sha256:${"d".repeat(64)}` },
    });
    await activateWorkspace();
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    const old = requireCompanyNavigation(renderWorkspace());
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(renderWorkspace(), { id: "security-query" }).props.onChange({
      target: { value: "SYN" },
    });
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(renderWorkspace(), { className: "security-search-form" }).props.onSubmit(
      { preventDefault: vi.fn() },
    );
    await flushPromises();
    old.props.onNext();
    expect(findCompanyNavigation(renderWorkspace())).toBeUndefined();
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
    ).toBe("lst-syn-00001");
    expect(textContent(renderWorkspace())).toMatch(/snapshot changed/iu);
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    expect(findCompanyNavigation(renderWorkspace())).toBeUndefined();
    await activateWorkspace();
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    old.props.onNext();
    expect(requireCompanyNavigation(renderWorkspace()).props).toMatchObject({
      position: 1,
      total: 2,
      disabled: false,
      invalidated: false,
    });
    requireCompanyNavigation(renderWorkspace()).props.onNext();
    expect(requireCompanyNavigation(renderWorkspace()).props.position).toBe(2);
  });

  it.each(["next", "row"] as const)(
    "cancels queued %s heading focus after a note-only workspace replacement",
    async (action) => {
      apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
        watchlistRecord(2),
      );
      await activateWorkspace();
      const dom = companyFocusDocument("watchlist-title");
      watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
      await flushPromises();
      dom.company.focus.mockClear();
      const pending: Array<() => void> = [];
      vi.stubGlobal("queueMicrotask", (callback: () => void) =>
        pending.push(callback),
      );
      if (action === "next")
        requireCompanyNavigation(renderWorkspace()).props.onNext();
      else
        watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
      requireCompanyNote(renderWorkspace()).props.onSave();
      await flushPromises(12);
      pending.forEach((callback) => callback());
      expect(dom.company.focus).not.toHaveBeenCalled();
      expect(requireCompanyNavigation(renderWorkspace()).props).toMatchObject({
        disabled: false,
        invalidated: false,
      });
    },
  );

  it.each(["transition", "filter", "session"] as const)(
    "rejects delayed heading focus after a later %s",
    async (change) => {
      apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
        watchlistRecord(3),
      );
      await activateWorkspace();
      const dom = companyFocusDocument("watchlist-title");
      watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
      await flushPromises();
      dom.company.focus.mockClear();
      const pending: Array<() => void> = [];
      vi.stubGlobal("queueMicrotask", (callback: () => void) =>
        pending.push(callback),
      );
      requireCompanyNavigation(renderWorkspace()).props.onNext();
      const retired = pending.splice(0);
      if (change === "transition")
        requireCompanyNavigation(renderWorkspace()).props.onNext();
      if (change === "filter") void filterWatchlist("SYN");
      if (change === "session")
        await requireOwnerSession(renderWorkspace()).props.onSessionChange(
          false,
          new AbortController().signal,
        );
      retired.forEach((callback) => callback());
      expect(dom.company.focus).not.toHaveBeenCalled();
      pending.forEach((callback) => callback());
      expect(dom.company.focus).toHaveBeenCalledTimes(
        change === "transition" ? 1 : 0,
      );
    },
  );

  it("retires row-capture heading focus when a filter edit still leaves the original row visible", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(2),
    );
    await activateWorkspace();
    const dom = companyFocusDocument("watchlist-title");
    const pending: Array<() => void> = [];
    vi.stubGlobal("queueMicrotask", (callback: () => void) =>
      pending.push(callback),
    );
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    void filterWatchlist("SYN");
    pending.forEach((callback) => callback());
    expect(dom.company.focus).not.toHaveBeenCalled();
    expect(watchlistRowIds(renderWorkspace())).toEqual(watchlistIds(1, 2));
  });

  it("clears the sequence on Clear and session loss and rejects old callbacks after reactivation", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValue(watchlistRecord(2));
    await activateWorkspace();
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    const beforeClear = requireCompanyNavigation(renderWorkspace());
    requireCompanyResearch(renderWorkspace()).props.onClear();
    beforeClear.props.onNext();
    expect(findCompanyNavigation(renderWorkspace())).toBeUndefined();
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection,
    ).toBeNull();
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    const beforeSession = requireCompanyNavigation(renderWorkspace());
    await requireOwnerSession(renderWorkspace()).props.onSessionChange(
      false,
      new AbortController().signal,
    );
    beforeSession.props.onNext();
    await activateWorkspace();
    expect(findCompanyNavigation(renderWorkspace())).toBeUndefined();
    watchlistAction(renderWorkspace(), "Research SYN00001").props.onClick();
    beforeSession.props.onNext();
    beforeClear.props.onNext();
    expect(requireCompanyNavigation(renderWorkspace()).props.position).toBe(1);
    requireCompanyNavigation(renderWorkspace()).props.onNext();
    expect(requireCompanyNavigation(renderWorkspace()).props.position).toBe(2);
  });

  it("aborts explicit company loads on Next and rejects their late results even after returning to A", async () => {
    const record = watchlistRecord(2);
    record.payload.memberships[0] = membership("ZERO", "lst-zero");
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    const loading = deferred<PersonalAnnualFinancialsDto>();
    apiMocks.fetchPersonalAnnualFinancials.mockReturnValueOnce(loading.promise);
    await activateWorkspace();
    watchlistAction(renderWorkspace(), "Research ZERO").props.onClick();
    let view = renderWorkspace();
    const oldAnnual = requireAnnualFinancials(view);
    oldAnnual.props.onLoad();
    requireMarketOverview(view).props.onLoad("1y");
    requireQuarterlyFinancials(view).props.onLoad();
    requireValuationHistory(view).props.onLoad();
    await flushPromises();
    view = renderWorkspace();
    expect(requireMarketOverview(view).props.overview).not.toBeNull();
    expect(requireQuarterlyFinancials(view).props.financials).not.toBeNull();
    expect(requireValuationHistory(view).props.history).not.toBeNull();
    requireCompanyResearch(view).props.onSectionChange("valuation");
    const originalKey = requireCompanyResearch(renderWorkspace()).key;
    requireCompanyNavigation(renderWorkspace()).props.onNext();
    expect(
      apiMocks.fetchPersonalAnnualFinancials.mock.calls[0]![1].aborted,
    ).toBe(true);
    view = renderWorkspace();
    expect(requireCompanyResearch(view).props.activeSection).toBe("price");
    expect(requireMarketOverview(view).props.overview).toBeNull();
    expect(requireQuarterlyFinancials(view).props.financials).toBeNull();
    expect(requireValuationHistory(view).props.history).toBeNull();
    requireCompanyNavigation(view).props.onPrevious();
    oldAnnual.props.onLoad();
    loading.resolve(annualFinancials());
    await flushPromises();
    view = renderWorkspace();
    expect(requireCompanyResearch(view).key).not.toBe(originalKey);
    expect(requireCompanyResearch(view).props.activeSection).toBe("price");
    expect(requireAnnualFinancials(view).props.financials).toBeNull();
    expect(requireFcffDcfValuation(view).props).toMatchObject({
      annualFinancials: null,
      marketOverview: null,
      valuationHistory: null,
    });
    expect(apiMocks.fetchPersonalAnnualFinancials).toHaveBeenCalledOnce();
    expect(apiMocks.fetchPersonalMarketOverview).toHaveBeenCalledOnce();
    expect(apiMocks.fetchPersonalQuarterlyFinancials).toHaveBeenCalledOnce();
    expect(apiMocks.fetchPersonalValuationHistory).toHaveBeenCalledOnce();
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
  });
});

describe("Save the researched company to My Watchlist", () => {
  it.each(["search", "catalog", "financials"] as const)(
    "appends the exact admitted %s identity once with an empty note and preserves existing order and notes",
    async (origin) => {
      const record = watchlistRecord(2);
      record.payload.memberships[0]!.note = "First saved thesis";
      record.payload.memberships[1]!.note = "Second saved thesis";
      apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
      const candidate = {
        ...searchResult("NEW", "lst-new"),
        exchangeMic: "XNYS",
        instrumentType: "adr" as const,
        issuerName: "Exact Research Issuer",
        securityId: "sec-research-only",
        securityName: "Exact Depositary Shares",
        shareClassId: "shr-research-only",
        shareClassName: "Class B Depositary Shares",
      };
      await activateWorkspace();
      if (origin === "search") {
        apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
          limitApplied: 15,
          normalizedQuery: "NEW",
          results: [candidate],
          snapshot: snapshot(),
          totalMatches: 1,
        });
        await searchAndSelectMarket("NEW");
      } else if (origin === "catalog") {
        requireStockScreener(renderWorkspace()).props.onOpenResearch(candidate);
      } else {
        requireFinancialScreener(renderWorkspace()).props.onOpenResearch(
          candidate,
        );
      }
      const before = Object.values(apiMocks).map(
        (mock) => mock.mock.calls.length,
      );
      const action = requireCompanyWatchlistAction(renderWorkspace());
      expect(action.props).toMatchObject({
        saved: false,
        disabled: false,
        pending: false,
        unavailableReason: null,
      });
      expect(findCompanyNote(renderWorkspace())).toBeUndefined();
      expect(
        Object.values(apiMocks).map((mock) => mock.mock.calls.length),
      ).toEqual(before);
      action.props.onAdd();
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
      const [version, payload] =
        apiMocks.saveMainPersonalWatchlist.mock.calls[0]!;
      expect(version).toBe(7);
      expect(payload).toEqual({
        ...record.payload,
        memberships: [
          ...record.payload.memberships,
          {
            country: "US",
            exchangeMic: "XNYS",
            instrumentType: "adr",
            issuerId: "iss-new",
            issuerName: "Exact Research Issuer",
            listingId: "lst-new",
            note: "",
            securityId: "sec-research-only",
            securityName: "Exact Depositary Shares",
            shareClassId: "shr-research-only",
            shareClassName: "Class B Depositary Shares",
            symbol: "NEW",
          },
        ],
      });
      await flushPromises(12);
      expect(requireCompanyWatchlistAction(renderWorkspace()).props.saved).toBe(
        true,
      );
      expect(requireCompanyNote(renderWorkspace()).props.value).toBe("");
      expect(apiMocks.fetchMainPersonalWatchlist).toHaveBeenCalledOnce();
      expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();
      expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();
      expect(apiMocks.fetchPersonalQuarterlyFinancials).not.toHaveBeenCalled();
      expect(apiMocks.fetchPersonalValuationHistory).not.toHaveBeenCalled();
    },
  );

  it("accepts the full financial comparison callback identity independently of visible rows and a different holding", async () => {
    const record = watchlistRecord(120);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    watchlistPageButton(renderWorkspace(), "Next").props.onClick();
    void filterWatchlist("SYN00060");
    const candidate = {
      ...screenRow(),
      securityId: "sec-off-page-comparison",
      shareClassName: "Comparison Class C",
    };
    // The real screener resolves off-page comparison members before this parent
    // callback; this root test deliberately supplies a DTO absent from visible rows.
    requireFinancialScreener(renderWorkspace()).props.onOpenResearch(candidate);
    watchlistAction(
      renderWorkspace(),
      "Choose SYN00060 for portfolio",
    ).props.onClick();
    const before = requireCompanyResearch(renderWorkspace());
    requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
    await flushPromises(12);
    expect(
      apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1].memberships.at(-1),
    ).toMatchObject({
      listingId: candidate.listingId,
      securityId: candidate.securityId,
      shareClassName: candidate.shareClassName,
      note: "",
    });
    expect(requireCompanyResearch(renderWorkspace()).key).toBe(before.key);
    expect(requireCompanyResearch(renderWorkspace()).props.backLabel).toBe(
      "Back to financial results",
    );
    expect(
      findElement<PersonalPortfolioProps>(
        renderWorkspace(),
        componentMocks.Portfolio,
      )!.props.selectedListing?.listingId,
    ).toBe("lst-syn-00060");
    expect(watchlistFilter(renderWorkspace()).props.value).toBe("SYN00060");
    expect(apiMocks.searchPersonalSecurities).not.toHaveBeenCalled();
  });

  it("keeps loaded research, DCF mount, section, holding and original Back target through the single Add", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(1),
    );
    await activateWorkspace();
    const view = await searchAndSelectMarket("ZERO");
    requireMarketOverview(view).props.onLoad("1y");
    requireAnnualFinancials(view).props.onLoad();
    requireQuarterlyFinancials(view).props.onLoad();
    requireValuationHistory(view).props.onLoad();
    await flushPromises(12);
    requireCompanyResearch(renderWorkspace()).props.onSectionChange(
      "valuation",
    );
    watchlistAction(
      renderWorkspace(),
      "Choose SYN00001 for portfolio",
    ).props.onClick();
    const before = renderWorkspace();
    const calls = Object.values(apiMocks).map((mock) => mock.mock.calls.length);
    requireCompanyWatchlistAction(before).props.onAdd();
    await flushPromises(12);
    const after = renderWorkspace();
    expect(requireCompanyResearch(after).key).toBe(
      requireCompanyResearch(before).key,
    );
    expect(requireCompanyResearch(after).props.activeSection).toBe("valuation");
    expect(requireCompanyResearch(after).props.backLabel).toBe(
      "Back to search results",
    );
    expect(requireFcffDcfValuation(after).key).toBe(
      requireFcffDcfValuation(before).key,
    );
    expect(requireMarketOverview(after).props.overview).toBe(
      requireMarketOverview(before).props.overview,
    );
    expect(requireAnnualFinancials(after).props.financials).toBe(
      requireAnnualFinancials(before).props.financials,
    );
    expect(requireQuarterlyFinancials(after).props.financials).toBe(
      requireQuarterlyFinancials(before).props.financials,
    );
    expect(requireValuationHistory(after).props.history).toBe(
      requireValuationHistory(before).props.history,
    );
    expect(
      findElement<PersonalPortfolioProps>(after, componentMocks.Portfolio)!
        .props.selectedListing?.listingId,
    ).toBe("lst-syn-00001");
    expect(
      Object.values(apiMocks).map((mock) => mock.mock.calls.length),
    ).toEqual(
      Object.entries(apiMocks).map(
        ([name], index) =>
          calls[index]! + (name === "saveMainPersonalWatchlist" ? 1 : 0),
      ),
    );
    expect(findCompanyNavigation(after)).toBeUndefined();
    const note = requireCompanyNote(after);
    note.props.onChange("  Explicit later note  ");
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    note.props.onSave();
    await flushPromises(12);
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledTimes(2);
    expect(apiMocks.saveMainPersonalWatchlist.mock.calls[1]![0]).toBe(8);
    expect(
      apiMocks.saveMainPersonalWatchlist.mock.calls[1]![1].memberships.at(-1)!
        .note,
    ).toBe("Explicit later note");
  });

  it("admits only one write across double clicks, results-side Add and retained pending controls", async () => {
    const pending = deferred<SavedPersonalWatchlist>();
    apiMocks.saveMainPersonalWatchlist.mockReturnValueOnce(pending.promise);
    await activateWorkspace();
    const view = await searchAndSelectMarket("ZERO");
    const action = requireCompanyWatchlistAction(view);
    const resultsAdd = requireButton(view, "Add");
    action.props.onAdd();
    action.props.onAdd();
    resultsAdd.props.onClick();
    const busy = requireCompanyWatchlistAction(renderWorkspace());
    expect(busy.props).toMatchObject({ pending: true, disabled: true });
    busy.props.onAdd();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    pending.resolve({
      version: 1,
      payload: apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1],
    });
    await flushPromises(12);
    action.props.onAdd();
    busy.props.onAdd();
    requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    expect(requireCompanyNote(renderWorkspace()).props.value).toBe("");
  });

  it.each([
    "company B",
    "A to B to A",
    "same identity portfolio",
    "same identity catalog",
    "Clear",
    "session",
  ] as const)(
    "retires an Add callback after %s without silently re-admitting it",
    async (change) => {
      await activateWorkspace();
      const initial = await searchAndSelectMarket("ZERO");
      const old = requireCompanyWatchlistAction(initial).props.onAdd;
      if (change === "company B" || change === "A to B to A") {
        requireStockScreener(renderWorkspace()).props.onOpenResearch(
          screenRow(),
        );
        if (change === "A to B to A")
          requireStockScreener(renderWorkspace()).props.onOpenResearch(
            searchResult("ZERO", "lst-zero"),
          );
      }
      if (change === "same identity portfolio")
        findElement<PersonalPortfolioProps>(
          renderWorkspace(),
          componentMocks.Portfolio,
        )!.props.onOpenResearch!(searchResult("ZERO", "lst-zero"));
      if (change === "same identity catalog")
        requireStockScreener(renderWorkspace()).props.onOpenResearch(
          searchResult("ZERO", "lst-zero"),
        );
      if (change === "Clear")
        requireCompanyResearch(renderWorkspace()).props.onClear();
      if (change === "session")
        await requireOwnerSession(renderWorkspace()).props.onSessionChange(
          false,
          new AbortController().signal,
        );
      old();
      await flushPromises();
      expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
      if (change === "same identity portfolio") {
        const current = requireCompanyWatchlistAction(renderWorkspace());
        expect(
          findAllElements(
            PersonalCompanyWatchlistAction(current.props),
            "button",
          ),
        ).toHaveLength(0);
        expect(current.props.unavailableReason).toBeTruthy();
        current.props.onAdd();
        expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
      }
    },
  );

  it.each([
    ["exchangeMic", "XNYS"],
    ["instrumentType", "adr"],
    ["issuerId", "iss-other"],
    ["issuerName", "Different issuer"],
    ["securityId", "sec-other"],
    ["securityName", "Different security"],
    ["shareClassId", "shr-other"],
    ["shareClassName", "Class B"],
    ["symbol", "OTHER"],
  ] as const)(
    "does not overwrite a same-listing saved member differing in %s",
    async (field, value) => {
      const record = watchlistRecord(0);
      record.payload.memberships.push({
        ...membership("ZERO", "lst-zero"),
        [field]: value,
        note: "Keep original identity note",
      });
      apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
      await activateWorkspace();
      const view = await searchAndSelectMarket("ZERO");
      const action = requireCompanyWatchlistAction(view);
      expect(action.props.saved).toBe(false);
      expect(
        findAllElements(PersonalCompanyWatchlistAction(action.props), "button"),
      ).toHaveLength(0);
      expect(action.props.unavailableReason).toBeTruthy();
      expect(findCompanyNote(view)).toBeUndefined();
      action.props.onAdd();
      await flushPromises();
      expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
      expect(watchlistNote(renderWorkspace(), "lst-zero").props.value).toBe(
        "Keep original identity note",
      );
    },
  );

  it("recognizes exact saved membership outside the current watchlist page/filter without another write", async () => {
    const record = watchlistRecord(60);
    record.payload.memberships[59]!.note = "Already saved off-page";
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    await activateWorkspace();
    void filterWatchlist("SYN00001");
    openNoteCompany(record.payload.memberships[59]!);
    const view = renderWorkspace();
    expect(watchlistRowIds(view)).not.toContain("lst-syn-00060");
    expect(requireCompanyWatchlistAction(view).props.saved).toBe(true);
    expect(requireCompanyNote(view).props.value).toBe("Already saved off-page");
    requireCompanyWatchlistAction(view).props.onAdd();
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
  });

  it.each([
    "full",
    "unavailable",
    "stale catalog",
    "portfolio only",
    "historical filing",
  ] as const)(
    "keeps %s research ineligible for an implicit admission or write",
    async (state) => {
      const record = watchlistRecord(state === "full" ? 10_000 : 0);
      if (state === "stale catalog")
        record.payload.snapshotSha256 = `sha256:${"d".repeat(64)}`;
      if (state === "unavailable")
        apiMocks.fetchMainPersonalWatchlist.mockRejectedValueOnce(
          new Error("Synthetic read failed"),
        );
      else apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
      await activateWorkspace();
      const candidate = searchResult("ZERO", "lst-zero");
      if (state === "portfolio only")
        findElement<PersonalPortfolioProps>(
          renderWorkspace(),
          componentMocks.Portfolio,
        )!.props.onOpenResearch!(candidate);
      else if (state === "historical filing")
        findElement<PersonalWatchlistFilingsProps>(
          renderWorkspace(),
          componentMocks.WatchlistFilings,
        )!.props.onOpenResearch({
          ...membership("ZERO", "lst-zero"),
          note: "Historical",
        });
      else
        requireStockScreener(renderWorkspace()).props.onOpenResearch(candidate);
      const action = requireCompanyWatchlistAction(renderWorkspace());
      expect(
        findAllElements(PersonalCompanyWatchlistAction(action.props), "button"),
      ).toHaveLength(0);
      expect(action.props.unavailableReason).toBeTruthy();
      action.props.onAdd();
      await flushPromises();
      expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
      expect(apiMocks.searchPersonalSecurities).not.toHaveBeenCalled();
      expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    },
  );

  it("retires the prior Add after an unrelated successful note version change but permits a fresh explicit Add", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(1),
    );
    await activateWorkspace();
    await searchAndSelectMarket("ZERO");
    const old = requireCompanyWatchlistAction(renderWorkspace()).props.onAdd;
    editWatchlistNote("lst-syn-00001", "Updated independently");
    requireButton(
      watchlistRow(renderWorkspace(), "lst-syn-00001"),
      "Save note",
    ).props.onClick();
    await flushPromises(12);
    old();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
    await flushPromises(12);
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledTimes(2);
    expect(apiMocks.saveMainPersonalWatchlist.mock.calls[1]![0]).toBe(8);
    expect(
      apiMocks.saveMainPersonalWatchlist.mock.calls[1]![1].memberships[0]!.note,
    ).toBe("Updated independently");
  });

  it("blocks the captured candidate and later screening reopens after an explicit catalog mismatch until revalidation", async () => {
    await activateWorkspace();
    await searchAndSelectMarket("ZERO");
    const old = requireCompanyWatchlistAction(renderWorkspace()).props.onAdd;
    apiMocks.searchPersonalSecurities.mockResolvedValueOnce({
      limitApplied: 15,
      normalizedQuery: "NEW",
      results: [],
      totalMatches: 0,
      snapshot: { ...snapshot(), snapshotSha256: `sha256:${"d".repeat(64)}` },
    });
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(renderWorkspace(), { id: "security-query" }).props.onChange({
      target: { value: "NEW" },
    });
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(renderWorkspace(), { className: "security-search-form" }).props.onSubmit(
      { preventDefault: vi.fn() },
    );
    await flushPromises(12);
    old();
    const invalidated = requireCompanyWatchlistAction(renderWorkspace());
    expect(invalidated.props.unavailableReason).toMatch(/catalog|revalidate/iu);
    invalidated.props.onAdd();
    requireStockScreener(renderWorkspace()).props.onOpenResearch(
      searchResult("ZERO", "lst-zero"),
    );
    requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
    await activateWorkspace();
    requireStockScreener(renderWorkspace()).props.onOpenResearch(
      searchResult("ZERO", "lst-zero"),
    );
    old();
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
    requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
    await flushPromises(12);
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
  });

  it("keeps the admitted DTO copied at research entry instead of accepting later caller mutation", async () => {
    await activateWorkspace();
    const candidate = { ...screenRow() };
    requireStockScreener(renderWorkspace()).props.onOpenResearch(candidate);
    candidate.securityId = "sec-mutated-after-entry";
    candidate.shareClassName = "Changed after admission";
    requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
    await flushPromises(12);
    expect(
      apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1].memberships[0],
    ).toMatchObject({
      securityId: "sec-screen",
      shareClassName: "Common",
    });
  });

  it.each([
    "unrelated change",
    "exact concurrent addition",
    "changed identity",
    "reload failed",
  ] as const)(
    "handles conflict with %s through one reload and no automatic retry",
    async (outcome) => {
      const original = watchlistRecord(1);
      const latest = watchlistRecord(2, 8);
      if (
        outcome === "exact concurrent addition" ||
        outcome === "changed identity"
      )
        latest.payload.memberships.push({
          ...membership("ZERO", "lst-zero"),
          ...(outcome === "changed identity"
            ? { securityId: "sec-replacement" }
            : {}),
          note: "Saved in another tab",
        });
      apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(original);
      if (outcome === "reload failed")
        apiMocks.fetchMainPersonalWatchlist.mockRejectedValueOnce(
          new Error("Synthetic reload failure"),
        );
      else apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(latest);
      apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
        new PersonalWorkspaceApiError("conflict"),
      );
      await activateWorkspace();
      await searchAndSelectMarket("ZERO");
      const old = requireCompanyWatchlistAction(renderWorkspace()).props.onAdd;
      old();
      await flushPromises(12);
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
      expect(apiMocks.fetchMainPersonalWatchlist).toHaveBeenCalledTimes(2);
      old();
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
      const current = requireCompanyWatchlistAction(renderWorkspace());
      if (outcome === "exact concurrent addition") {
        expect(current.props.saved).toBe(true);
        expect(requireCompanyNote(renderWorkspace()).props.value).toBe(
          "Saved in another tab",
        );
        current.props.onAdd();
        expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
      } else if (outcome === "unrelated change") {
        expect(current.props.disabled).toBe(false);
        current.props.onAdd();
        await flushPromises(12);
        expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledTimes(2);
        expect(apiMocks.saveMainPersonalWatchlist.mock.calls[1]![0]).toBe(8);
        expect(
          apiMocks.saveMainPersonalWatchlist.mock.calls[1]![1].memberships.slice(
            0,
            2,
          ),
        ).toEqual(latest.payload.memberships);
      } else {
        expect(
          findAllElements(
            PersonalCompanyWatchlistAction(current.props),
            "button",
          ),
        ).toHaveLength(0);
        expect(findCompanyNote(renderWorkspace())).toBeUndefined();
        current.props.onAdd();
        expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
        if (outcome === "reload failed")
          expect(
            current.props.message ?? current.props.unavailableReason,
          ).not.toMatch(/latest saved version is now shown/iu);
      }
    },
  );

  it("does not claim a failed ordinary save succeeded and allows only a fresh explicit retry", async () => {
    apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
      new Error("Synthetic save failed"),
    );
    await activateWorkspace();
    await searchAndSelectMarket("ZERO");
    const old = requireCompanyWatchlistAction(renderWorkspace()).props.onAdd;
    old();
    await flushPromises(12);
    const current = requireCompanyWatchlistAction(renderWorkspace());
    expect(current.props).toMatchObject({
      saved: false,
      pending: false,
      disabled: false,
    });
    expect(current.props.message).toMatch(
      /not added|not saved|could not|failed/iu,
    );
    expect(findCompanyNote(renderWorkspace())).toBeUndefined();
    old();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    current.props.onAdd();
    await flushPromises(12);
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchMainPersonalWatchlist).toHaveBeenCalledOnce();
  });

  it("blocks a newly selected company after the previous Add conflict cannot reload its shared workspace", async () => {
    const reload = deferred<void>();
    apiMocks.fetchMainPersonalWatchlist
      .mockResolvedValueOnce(watchlistRecord(1))
      .mockImplementationOnce(async () => {
        await reload.promise;
        throw new Error("Synthetic late reload failure");
      });
    apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("conflict"),
    );
    await activateWorkspace();
    await searchAndSelectMarket("ZERO");
    requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
    await flushPromises();
    expect(apiMocks.fetchMainPersonalWatchlist).toHaveBeenCalledTimes(2);
    requireStockScreener(renderWorkspace()).props.onOpenResearch(screenRow());
    const during = requireCompanyWatchlistAction(renderWorkspace());
    expect(during.props.disabled).toBe(true);
    during.props.onAdd();
    reload.resolve();
    await flushPromises(12);
    const after = requireCompanyWatchlistAction(renderWorkspace());
    expect(after.props.message).toBeNull();
    expect(after.props.unavailableReason).toMatch(
      /could not be reloaded|reload/iu,
    );
    after.props.onAdd();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
    ).toBe("lst-screen");
    await activateWorkspace();
    requireStockScreener(renderWorkspace()).props.onOpenResearch(screenRow());
    expect(
      requireCompanyWatchlistAction(renderWorkspace()).props.unavailableReason,
    ).toBeNull();
  });

  it.each([
    "retained button",
    "native blur",
    "unowned focus",
    "focus moved and returned",
    "pointer elsewhere",
    "Back",
    "same identity origin",
  ] as const)(
    "hands successful Add focus to the note only when appropriate after %s",
    async (caseName) => {
      const pending = deferred<SavedPersonalWatchlist>();
      apiMocks.saveMainPersonalWatchlist.mockReturnValueOnce(pending.promise);
      await activateWorkspace();
      await searchAndSelectMarket("ZERO");
      await flushPromises();
      const dom = companyAddFocusDocument();
      if (caseName === "unowned focus") dom.document.activeElement = dom.other;
      requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
      if (caseName === "native blur") dom.document.activeElement = dom.body;
      if (caseName === "focus moved and returned") {
        dom.move("focusin", dom.other);
        dom.document.activeElement = dom.body;
      }
      if (caseName === "pointer elsewhere") {
        dom.move("pointerdown", dom.body);
        dom.document.activeElement = dom.body;
      }
      if (caseName === "Back")
        requireCompanyResearch(renderWorkspace()).props.onBack();
      if (caseName === "same identity origin")
        findElement<PersonalPortfolioProps>(
          renderWorkspace(),
          componentMocks.Portfolio,
        )!.props.onOpenResearch!(searchResult("ZERO", "lst-zero"));
      pending.resolve({
        version: 1,
        payload: apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1],
      });
      await flushPromises(16);
      const settled = renderWorkspace();
      expect(dom.note.focus).toHaveBeenCalledTimes(
        caseName === "retained button" || caseName === "native blur" ? 1 : 0,
      );
      expect(dom.listenerCount()).toBe(0);
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
      expect(requireCompanyNote(settled).props.value).toBe("");
    },
  );

  it("waits for the newly saved note to mount before handing Add focus to it", async () => {
    const pending = deferred<SavedPersonalWatchlist>();
    apiMocks.saveMainPersonalWatchlist.mockReturnValueOnce(pending.promise);
    await activateWorkspace();
    await searchAndSelectMarket("ZERO");
    await flushPromises();
    const dom = companyAddFocusDocument(false);
    const before = renderWorkspace();
    expect(findCompanyNote(before)).toBeUndefined();
    requireCompanyWatchlistAction(before).props.onAdd();
    dom.document.activeElement = dom.body;
    pending.resolve({
      version: 1,
      payload: apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1],
    });
    await flushPromises(16);
    expect(dom.document.getElementById("company-watchlist-note")).toBeNull();
    expect(dom.note.focus).not.toHaveBeenCalled();
    expect(dom.listenerCount()).toBe(2);

    const settled = renderWorkspace(undefined, { commitEffects: false });
    expect(requireCompanyNote(settled).props.value).toBe("");
    expect(requireCompanyResearch(settled).key).toBe(
      requireCompanyResearch(before).key,
    );
    expect(dom.note.focus).not.toHaveBeenCalled();
    dom.mountNote();
    hookHarness.commitEffects();
    expect(dom.note.focus).toHaveBeenCalledOnce();
    expect(dom.listenerCount()).toBe(0);
    void renderWorkspace();
    hookHarness.commitEffects();
    expect(dom.note.focus).toHaveBeenCalledOnce();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    expect(apiMocks.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalAnnualFinancials).not.toHaveBeenCalled();
  });

  it("does not let an earlier pending render consume the saved note's focus handoff", async () => {
    const pending = deferred<SavedPersonalWatchlist>();
    apiMocks.saveMainPersonalWatchlist.mockReturnValueOnce(pending.promise);
    await activateWorkspace();
    await searchAndSelectMarket("ZERO");
    await flushPromises();
    const dom = companyAddFocusDocument(false);
    requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
    const pendingView = renderWorkspace(undefined, { commitEffects: false });
    expect(requireCompanyWatchlistAction(pendingView).props.pending).toBe(true);
    expect(findCompanyNote(pendingView)).toBeUndefined();
    const earlierEffects = hookHarness.takePendingEffects();
    expect(earlierEffects).not.toHaveLength(0);
    pending.resolve({
      version: 1,
      payload: apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1],
    });
    await flushPromises(16);
    earlierEffects.forEach((effect) => effect());
    expect(dom.note.focus).not.toHaveBeenCalled();
    expect(dom.listenerCount()).toBe(2);

    const settled = renderWorkspace(undefined, { commitEffects: false });
    expect(requireCompanyNote(settled).props.value).toBe("");
    dom.mountNote();
    hookHarness.commitEffects();
    expect(dom.note.focus).toHaveBeenCalledOnce();
    expect(dom.listenerCount()).toBe(0);
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
  });

  it.each(["Clear", "focus moved and returned"] as const)(
    "retires a settled Add focus handoff after %s before the note commit",
    async (change) => {
      await activateWorkspace();
      await searchAndSelectMarket("ZERO");
      await flushPromises();
      const dom = companyAddFocusDocument(false);
      const before = renderWorkspace();
      requireCompanyWatchlistAction(before).props.onAdd();
      await flushPromises(16);
      expect(dom.note.focus).not.toHaveBeenCalled();
      expect(dom.listenerCount()).toBe(2);
      if (change === "Clear") {
        requireCompanyResearch(before).props.onClear();
        expect(dom.listenerCount()).toBe(0);
      } else {
        dom.move("focusin", dom.other);
        dom.document.activeElement = dom.body;
      }
      const settled = renderWorkspace(undefined, { commitEffects: false });
      if (change === "Clear") expect(findCompanyNote(settled)).toBeUndefined();
      else {
        expect(requireCompanyNote(settled).props.value).toBe("");
        dom.mountNote();
      }
      hookHarness.commitEffects();
      expect(dom.note.focus).not.toHaveBeenCalled();
      expect(dom.listenerCount()).toBe(0);
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    },
  );

  it("cancels a queued successful Add focus handoff after another workspace version replaces the saved list", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(
      watchlistRecord(1),
    );
    await activateWorkspace();
    await searchAndSelectMarket("ZERO");
    await flushPromises();
    const dom = companyAddFocusDocument();
    requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
    await flushPromises(12);
    const settled = renderWorkspace(undefined, { commitEffects: false });
    expect(requireCompanyNote(settled).props.value).toBe("");
    const queued = hookHarness.takePendingEffects();
    expect(queued).not.toHaveLength(0);
    editWatchlistNote("lst-syn-00001", "Explicit separate version change");
    requireButton(
      watchlistRow(renderWorkspace(), "lst-syn-00001"),
      "Save note",
    ).props.onClick();
    await flushPromises(12);
    queued.forEach((callback) => callback());
    expect(dom.note.focus).not.toHaveBeenCalled();
    expect(dom.listenerCount()).toBe(0);
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledTimes(2);
  });

  it.each(["Clear", "session loss"] as const)(
    "removes pending Add focus listeners immediately on %s without waiting for the request",
    async (change) => {
      const pending = deferred<SavedPersonalWatchlist>();
      apiMocks.saveMainPersonalWatchlist.mockReturnValueOnce(pending.promise);
      await activateWorkspace();
      await searchAndSelectMarket("ZERO");
      await flushPromises();
      const dom = companyAddFocusDocument();
      requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
      expect(dom.listenerCount()).toBe(2);
      if (change === "Clear")
        requireCompanyResearch(renderWorkspace()).props.onClear();
      else
        await requireOwnerSession(renderWorkspace()).props.onSessionChange(
          false,
          new AbortController().signal,
        );
      expect(dom.listenerCount()).toBe(0);
      pending.resolve({
        version: 1,
        payload: apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1],
      });
      await flushPromises(12);
      expect(dom.note.focus).not.toHaveBeenCalled();
      expect(dom.listenerCount()).toBe(0);
    },
  );

  it("does not let a retired Add settlement remove a newer session's focus listeners", async () => {
    const first = deferred<SavedPersonalWatchlist>();
    const second = deferred<SavedPersonalWatchlist>();
    apiMocks.saveMainPersonalWatchlist
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await activateWorkspace();
    await searchAndSelectMarket("ZERO");
    await flushPromises();
    const dom = companyAddFocusDocument();
    requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
    const firstPayload = apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1];
    await requireOwnerSession(renderWorkspace()).props.onSessionChange(
      false,
      new AbortController().signal,
    );
    expect(dom.listenerCount()).toBe(0);
    await activateWorkspace();
    requireStockScreener(renderWorkspace()).props.onOpenResearch(screenRow());
    await flushPromises();
    dom.document.activeElement = dom.button;
    requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledTimes(2);
    expect(dom.listenerCount()).toBe(2);
    first.resolve({ version: 1, payload: firstPayload });
    await flushPromises(12);
    expect(dom.listenerCount()).toBe(2);
    expect(dom.note.focus).not.toHaveBeenCalled();
    second.resolve({
      version: 1,
      payload: apiMocks.saveMainPersonalWatchlist.mock.calls[1]![1],
    });
    await flushPromises(12);
    void renderWorkspace();
    expect(dom.listenerCount()).toBe(0);
    expect(dom.note.focus).toHaveBeenCalledOnce();
    expect(
      requireCompanyResearch(renderWorkspace()).props.selection?.listingId,
    ).toBe("lst-screen");
  });

  it("lets a late Add update the global list without changing another company's note, feedback, section or holding", async () => {
    const record = watchlistRecord(1);
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(record);
    const pending = deferred<SavedPersonalWatchlist>();
    apiMocks.saveMainPersonalWatchlist.mockReturnValueOnce(pending.promise);
    await activateWorkspace();
    openNoteCompany(record.payload.memberships[0]!);
    requireCompanyNote(renderWorkspace()).props.onChange(
      "  Keep B's unsaved thesis  ",
    );
    await searchAndSelectMarket("ZERO");
    requireCompanyWatchlistAction(renderWorkspace()).props.onAdd();
    openNoteCompany(record.payload.memberships[0]!);
    requireCompanyResearch(renderWorkspace()).props.onSectionChange("sec");
    const before = renderWorkspace();
    const feedback = requireCompanyWatchlistAction(before).props.message;
    pending.resolve({
      version: 8,
      payload: apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1],
    });
    await flushPromises(12);
    const after = renderWorkspace();
    expect(requireCompanyResearch(after).key).toBe(
      requireCompanyResearch(before).key,
    );
    expect(requireCompanyResearch(after).props.selection?.listingId).toBe(
      "lst-syn-00001",
    );
    expect(requireCompanyResearch(after).props.activeSection).toBe("sec");
    expect(requireCompanyWatchlistAction(after).props.message).toBe(feedback);
    expect(requireCompanyNote(after).props.value).toBe(
      "  Keep B's unsaved thesis  ",
    );
    expect(
      findElement<PersonalPortfolioProps>(after, componentMocks.Portfolio)!
        .props.selectedListing?.listingId,
    ).toBe("lst-syn-00001");
    expect(watchlistRowIds(after)).toContain("lst-zero");
    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
  });

  it.each(["Clear", "session loss"] as const)(
    "does not revive the selected company or feedback after %s during a held Add",
    async (change) => {
      const pending = deferred<SavedPersonalWatchlist>();
      apiMocks.saveMainPersonalWatchlist.mockReturnValueOnce(pending.promise);
      await activateWorkspace();
      await searchAndSelectMarket("ZERO");
      const old = requireCompanyWatchlistAction(renderWorkspace()).props.onAdd;
      old();
      if (change === "Clear")
        requireCompanyResearch(renderWorkspace()).props.onClear();
      else
        await requireOwnerSession(renderWorkspace()).props.onSessionChange(
          false,
          new AbortController().signal,
        );
      pending.resolve({
        version: 1,
        payload: apiMocks.saveMainPersonalWatchlist.mock.calls[0]![1],
      });
      await flushPromises(12);
      old();
      expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
      if (change === "Clear") {
        expect(
          requireCompanyResearch(renderWorkspace()).props.selection,
        ).toBeNull();
        const current = requireCompanyWatchlistAction(renderWorkspace());
        expect(current.props.message).toBeNull();
        expect(
          findAllElements(
            PersonalCompanyWatchlistAction(current.props),
            "button",
          ),
        ).toHaveLength(0);
      } else {
        expect(
          findElement(renderWorkspace(), componentMocks.CompanyResearch),
        ).toBeUndefined();
        await activateWorkspace();
        expect(
          requireCompanyResearch(renderWorkspace()).props.selection,
        ).toBeNull();
      }
    },
  );
});

function findCompanyWatchlistAction(value: unknown) {
  return findElement<PersonalCompanyWatchlistActionProps>(
    requireCompanyResearch(value).props.researchNote,
    PersonalCompanyWatchlistAction,
  );
}

function requireCompanyWatchlistAction(value: unknown) {
  const action = findCompanyWatchlistAction(value);
  if (action === undefined)
    throw new Error("Expected researched company watchlist action.");
  return action;
}

function requireFinancialScreener(value: unknown) {
  const screener = findElement<PersonalFinancialScreenerProps>(
    value,
    componentMocks.FinancialScreener,
  );
  if (screener === undefined) throw new Error("Expected financial screener.");
  return screener;
}

function companyAddFocusDocument(noteMounted = true) {
  const base = companyFocusDocument("security-search-title");
  const button = base.trigger;
  const note = base.origin;
  const other = base.company;
  const body = {};
  const listeners = new Map<string, Set<(event: Event) => void>>();
  const document = {
    activeElement: button as object,
    body,
    visibilityState: "visible",
    getElementById: vi.fn((id: string) =>
      id === "company-watchlist-add"
        ? button
        : id === "company-watchlist-note"
          ? noteMounted
            ? note
            : null
          : other,
    ),
    addEventListener: vi.fn(
      (type: string, listener: (event: Event) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(listener);
      },
    ),
    removeEventListener: vi.fn(
      (type: string, listener: (event: Event) => void) => {
        listeners.get(type)?.delete(listener);
      },
    ),
  };
  vi.stubGlobal("document", document);
  return {
    document,
    button,
    note,
    other,
    body,
    mountNote() {
      noteMounted = true;
    },
    listenerCount: () =>
      [...listeners.values()].reduce(
        (count, handlers) => count + handlers.size,
        0,
      ),
    move(type: string, target: object) {
      document.activeElement = target;
      const event = new Event(type);
      Object.defineProperty(event, "target", { value: target });
      listeners.get(type)?.forEach((listener) => listener(event));
    },
  };
}

function findCompanyNavigation(value: unknown) {
  return findElement<PersonalCompanyResearchNavigationProps>(
    requireCompanyResearch(value).props.navigation,
    PersonalCompanyResearchNavigation,
  );
}

function requireCompanyNavigation(value: unknown) {
  const navigation = findCompanyNavigation(value);
  if (navigation === undefined)
    throw new Error("Expected My Watchlist company navigation.");
  return navigation;
}

function findCompanyNote(value: unknown) {
  return findElement<PersonalCompanyResearchNoteProps>(
    requireCompanyResearch(value).props.researchNote,
    componentMocks.CompanyResearchNote,
  );
}

function requireCompanyNote(value: unknown) {
  const editor = findCompanyNote(value);
  if (editor === undefined)
    throw new Error("Expected selected company's saved research note.");
  return editor;
}

function openNoteCompany(identity: PersonalWatchlistMembership) {
  requireStockScreener(renderWorkspace()).props.onOpenResearch({
    ...identity,
    cik: "0000000001",
  });
}

function watchlistRecord(count: number, version = 7) {
  return {
    id: "main" as const,
    version,
    createdAt: "2030-01-15T01:00:00.000Z",
    updatedAt: "2030-01-15T02:00:00.000Z",
    payload: {
      schemaVersion: 1 as const,
      name: "My Watchlist" as const,
      snapshotSha256: snapshot().snapshotSha256,
      memberships: Array.from({ length: count }, (_, index) => {
        const suffix = String(index + 1).padStart(5, "0");
        return {
          ...membership(`SYN${suffix}`, `lst-syn-${suffix}`),
          issuerName: `Synthetic Company ${suffix}`,
        };
      }),
    },
  };
}

function watchlistIds(first: number, last: number) {
  return Array.from(
    { length: last - first + 1 },
    (_, index) => `lst-syn-${String(first + index).padStart(5, "0")}`,
  );
}

function watchlistRows(value: unknown) {
  const list = findAllElements(value, "ol").find(
    (element) => element.props.className === "watchlist-members",
  );
  return list === undefined ? [] : findAllElements(list, "li");
}

function watchlistRowIds(value: unknown) {
  return watchlistRows(value).map((row) => row.key);
}

function watchlistRow(value: unknown, listingId: string) {
  const row = watchlistRows(value).find(
    (candidate) => candidate.key === listingId,
  );
  if (row === undefined)
    throw new Error(`Expected visible watchlist row ${listingId}.`);
  return row;
}

function watchlistAction(value: unknown, label: string) {
  return requireElementByProps<{ disabled?: boolean; onClick: () => void }>(
    value,
    { "aria-label": label },
  );
}

function watchlistPageButton(value: unknown, direction: "Previous" | "Next") {
  return requireButton(value, `${direction} watchlist page`);
}

function watchlistFilter(value: unknown) {
  return requireElementByProps<{
    value: string;
    maxLength: number;
    onChange: (event: { target: { value: string } }) => void;
  }>(value, { id: "watchlist-filter" });
}

function filterWatchlist(query: string) {
  watchlistFilter(renderWorkspace()).props.onChange({
    target: { value: query },
  });
  return renderWorkspace();
}

function watchlistNote(value: unknown, listingId: string) {
  return requireElementByProps<{
    value: string;
    disabled?: boolean;
    onChange: (event: { target: { value: string } }) => void;
  }>(value, { id: `note-${listingId}` });
}

function editWatchlistNote(listingId: string, value: string) {
  watchlistNote(renderWorkspace(), listingId).props.onChange({
    target: { value },
  });
}

async function activateWorkspace() {
  const owner = requireOwnerSession(renderWorkspace());
  await owner.props.onSessionChange(true, new AbortController().signal);
}

function renderWorkspace(
  authMode?: "account" | "bootstrap" | "local",
  options: Readonly<{ commitEffects?: boolean }> = {},
): React.ReactNode {
  hookHarness.beginRender();
  const view = SecurityDiscoveryWorkspace(
    authMode === undefined ? undefined : { authMode },
  );
  if (options.commitEffects !== false) hookHarness.commitEffects();
  return view;
}

function requireCompanyResearch(value: unknown) {
  const company = findElement<PersonalCompanyResearchWorkspaceProps>(
    value,
    componentMocks.CompanyResearch,
  );
  if (company === undefined)
    throw new Error("Expected company research workspace.");
  return company;
}

function companyFocusDocument(triggerHeadingId: string) {
  class FocusTarget {
    isConnected = true;
    visible = true;
    disabled = false;
    tabIndex = 0;
    focus = vi.fn();
    scrollIntoView = vi.fn();
    constructor(readonly headingId = "") {}
    closest(selector: string) {
      if (selector === "[hidden], [inert]") return this.visible ? null : this;
      return selector === `[aria-labelledby~="${this.headingId}"]`
        ? this
        : null;
    }
    matches(selector: string) {
      return selector === ":disabled" && this.disabled;
    }
    hasAttribute() {
      return false;
    }
    getClientRects() {
      return this.visible ? [{}] : [];
    }
  }
  const trigger = new FocusTarget(triggerHeadingId);
  const origin = new FocusTarget();
  const company = new FocusTarget();
  vi.stubGlobal("HTMLElement", FocusTarget);
  const getElementById = vi.fn((id: string) =>
    id === "personal-company-research-title" ? company : origin,
  );
  vi.stubGlobal("document", { activeElement: trigger, getElementById });
  return { trigger, origin, company, getElementById };
}

function findOwnerSession(value: unknown) {
  return findElement<OwnerSessionPanelProps>(
    value,
    componentMocks.OwnerSession,
  );
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
  return findElement<PersonalSavedFcffDcfValuationProps>(
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
    ...(value.type === componentMocks.CompanyResearch
      ? Object.values(
          (value.props as PersonalCompanyResearchWorkspaceProps).sections,
        ).flatMap((section) => findAllElements(section, type))
      : []),
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
