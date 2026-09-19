"use client";

import type {
  PersonalPortfolioIdentity,
  PersonalAnnualFinancialsDto,
  PersonalMarketDataRangeDto,
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
  PersonalQuarterlyFinancialsDto,
  PersonalValuationHistoryDto,
  PersonalSecurityMasterSearchResultDto,
  PersonalSecurityMasterScreenRowDto,
  PersonalSecurityMasterSnapshotReceiptDto,
} from "@research-cockpit/contracts";
import type { PersonalHistoricalMultipleValuationMetric } from "@research-cockpit/personal-market-analytics";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  createEmptyPersonalWatchlist,
  fetchPersonalAnnualFinancials,
  fetchMainPersonalWatchlist,
  fetchPersonalMarketDataStatus,
  fetchPersonalMarketOverview,
  fetchPersonalQuarterlyFinancials,
  fetchPersonalValuationHistory,
  fetchPersonalSecurityMasterStatus,
  membershipFromSearchResult,
  normalizeWatchlistNote,
  PersonalWorkspaceApiError,
  saveMainPersonalWatchlist,
  searchPersonalSecurities,
  type PersonalWatchlistMembership,
  type PersonalWatchlistPayload,
  type PersonalWorkspaceApiErrorCode,
} from "@/lib/personal-workspace-api";

import { OwnerSessionPanel } from "./OwnerSessionPanel";
import { LocalWorkspaceAccessPanel } from "./LocalWorkspaceAccessPanel";
import type { OwnerSessionActivityStart } from "./owner-session-lifecycle";
import {
  PersonalCompanyResearchWorkspace,
  type PersonalCompanyResearchSection,
} from "./PersonalCompanyResearchWorkspace";
import { PersonalCompanyResearchNote } from "./PersonalCompanyResearchNote";
import { PersonalCompanyResearchNavigation } from "./PersonalCompanyResearchNavigation";
import { PersonalCompanyWatchlistAction } from "./PersonalCompanyWatchlistAction";
import { PersonalAnnualFinancials } from "./PersonalAnnualFinancials";
import { PersonalFcffDcfValuation } from "./PersonalFcffDcfValuation";
import { PersonalFinancialQualityScorecard } from "./PersonalFinancialQualityScorecard";
import { PersonalHistoricalMultipleValuation } from "./PersonalHistoricalMultipleValuation";
import {
  PersonalManualPeerComparison,
  PERSONAL_MANUAL_PEER_COMPARISON_MAXIMUM_PEERS,
  type PersonalManualPeerSelection,
  type PersonalManualPeerState,
} from "./PersonalManualPeerComparison";
import { PersonalQuarterlyFinancials } from "./PersonalQuarterlyFinancials";
import { PersonalSecQuarterlyEvidence } from "./PersonalSecQuarterlyEvidence";
import { PersonalStockScreener } from "./PersonalStockScreener";
import { PersonalFinancialScreener } from "./PersonalFinancialScreener";
import { PersonalWatchlistFilings } from "./PersonalWatchlistFilings";
import { PersonalPortfolio } from "./PersonalPortfolio";
import { PersonalValuationHistory } from "./PersonalValuationHistory";
import {
  PersonalMarketOverview,
  type PersonalMarketSelection,
} from "./PersonalMarketOverview";
import type { PriceAdjustmentMode } from "./PriceHistoryChart";
import type { ValuationHistoryMetric } from "./ValuationHistoryChart";

interface LoadedWorkspace {
  readonly snapshot: PersonalSecurityMasterSnapshotReceiptDto;
  readonly version: number;
  readonly watchlist: PersonalWatchlistPayload;
  readonly watchlistAvailable: boolean;
}

interface WatchlistRow {
  readonly membership: PersonalWatchlistMembership;
  readonly absoluteIndex: number;
}

interface WatchlistResearchCohort {
  readonly identities: readonly string[];
  readonly allIdentities: readonly string[];
  readonly snapshotSha256: string;
  readonly index: number;
  readonly invalidated: boolean;
}

interface CompanyWatchlistCandidate {
  readonly result:
    PersonalSecurityMasterSearchResultDto | PersonalSecurityMasterScreenRowDto;
  readonly identityKey: string;
  readonly snapshotSha256: string;
}

interface CompanyWatchlistFeedback {
  readonly candidate: CompanyWatchlistCandidate;
  readonly message: string;
  readonly pending: boolean;
}

interface CompanyOriginTarget {
  readonly headingId: string;
  readonly trigger: HTMLElement | null;
  readonly isCurrent?: () => boolean;
}

interface ReconciliationPreview {
  readonly matched: readonly PersonalWatchlistMembership[];
  readonly snapshotSha256: string;
  readonly unmatched: readonly PersonalWatchlistMembership[];
  readonly watchlistVersion: number;
}

interface ManualPeerRequest {
  readonly controller: AbortController;
  readonly priorAnnualErrorCode: PersonalWorkspaceApiErrorCode | null;
  readonly priorAnnualFinancials: PersonalAnnualFinancialsDto | null;
}

type CompanyResearchOrigin =
  "search" | "catalog" | "financials" | "portfolio" | "filings" | "watchlist";

const COMPANY_RESEARCH_ORIGINS: Readonly<
  Record<CompanyResearchOrigin, Readonly<{ label: string; headingId: string }>>
> = {
  search: { label: "Back to search results", headingId: "search-title" },
  catalog: {
    label: "Back to catalog results",
    headingId: "personal-stock-screener-title",
  },
  financials: {
    label: "Back to financial results",
    headingId: "personal-financial-screener-title",
  },
  portfolio: {
    label: "Back to My Portfolio",
    headingId: "personal-portfolio-title",
  },
  filings: {
    label: "Back to recent filings",
    headingId: "watchlist-filings-title",
  },
  watchlist: { label: "Back to My Watchlist", headingId: "watchlist-title" },
};

type RequestState = "idle" | "loading" | "saving";

interface WatchlistNoteDraft {
  readonly identityKey: string;
  readonly value: string;
}

interface WatchlistNoteFeedback {
  readonly identityKey: string;
  readonly message: string;
}

type WatchlistSaveOutcome =
  | "saved"
  | "conflict_reloaded"
  | "conflict_reload_failed"
  | "unavailable"
  | "inactive";

const SESSION_REVALIDATION_MESSAGE =
  "The owner session is no longer available. Revalidate the session before loading private data again.";
const MANUAL_PEER_PICKER_MAXIMUM_CANDIDATES = 250;
const WATCHLIST_PAGE_SIZE = 50;
const WATCHLIST_MAXIMUM_MEMBERSHIPS = 10_000;

class WorkspaceSnapshotChangedError extends Error {}

export function SecurityDiscoveryWorkspace({
  authMode = "bootstrap",
}: { authMode?: "account" | "bootstrap" | "local" } = {}) {
  const [workspace, setWorkspace] = useState<LoadedWorkspace | null>(null);
  const [localAccessInvalidation, setLocalAccessInvalidation] = useState(0);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [portfolioSelection, setPortfolioSelection] =
    useState<PersonalPortfolioIdentity | null>(null);
  const [results, setResults] = useState<
    readonly PersonalSecurityMasterSearchResultDto[]
  >([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchState, setSearchState] = useState<RequestState>("idle");
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [watchlistState, setWatchlistState] = useState<RequestState>("idle");
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<
    Record<string, WatchlistNoteDraft>
  >({});
  const currentNoteDrafts = useRef(noteDrafts);
  currentNoteDrafts.current = noteDrafts;
  const [noteFeedback, setNoteFeedback] =
    useState<WatchlistNoteFeedback | null>(null);
  const currentNoteFeedback = useRef(noteFeedback);
  currentNoteFeedback.current = noteFeedback;
  const [noteDraftNotice, setNoteDraftNotice] = useState<string | null>(null);
  const [watchlistQuery, setWatchlistQuery] = useState("");
  const [watchlistPage, setWatchlistPage] = useState(0);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationPreview, setReconciliationPreview] =
    useState<ReconciliationPreview | null>(null);
  const [marketDataStatus, setMarketDataStatus] =
    useState<PersonalMarketDataStatusDto | null>(null);
  const [marketSelection, setMarketSelection] =
    useState<PersonalMarketSelection | null>(null);
  const [companySection, setCompanySection] =
    useState<PersonalCompanyResearchSection>("price");
  const [companyIdentityKey, setCompanyIdentityKey] = useState<string | null>(
    null,
  );
  const [companyOrigin, setCompanyOrigin] =
    useState<CompanyResearchOrigin>("search");
  const companyIdentity = useRef<string | null>(null);
  const companyOriginTarget = useRef<CompanyOriginTarget | null>(null);
  const companyNavigationEpoch = useRef(0);
  const companySelectionEpoch = useRef(0);
  const [researchCohort, setResearchCohort] =
    useState<WatchlistResearchCohort | null>(null);
  const currentResearchCohort = useRef(researchCohort);
  const researchCatalogInvalidatedEpoch = useRef<number | null>(null);
  const [companyWatchlistCandidate, setCompanyWatchlistCandidate] =
    useState<CompanyWatchlistCandidate | null>(null);
  const currentCompanyWatchlistCandidate = useRef(companyWatchlistCandidate);
  const [companyWatchlistFeedback, setCompanyWatchlistFeedback] =
    useState<CompanyWatchlistFeedback | null>(null);
  const currentCompanyAddOperation = useRef<object | null>(null);
  const currentCompanyAddFocusCleanup = useRef<(() => void) | null>(null);
  const currentCompanyAddFocusHandoff = useRef<{
    feedback: CompanyWatchlistFeedback;
    run: () => void;
  } | null>(null);
  const failedCompanyAddReloadWorkspace = useRef<LoadedWorkspace | null>(null);
  const [marketOverview, setMarketOverview] =
    useState<PersonalMarketOverviewDto | null>(null);
  const [marketRange, setMarketRange] =
    useState<PersonalMarketDataRangeDto>("1y");
  const [marketAdjustmentMode, setMarketAdjustmentMode] =
    useState<PriceAdjustmentMode>("adjusted");
  const [marketRequestState, setMarketRequestState] = useState<
    "idle" | "loading"
  >("idle");
  const [marketErrorCode, setMarketErrorCode] =
    useState<PersonalWorkspaceApiErrorCode | null>(null);
  const [annualFinancials, setAnnualFinancials] =
    useState<PersonalAnnualFinancialsDto | null>(null);
  const [annualFinancialsRequestState, setAnnualFinancialsRequestState] =
    useState<"idle" | "loading">("idle");
  const [annualFinancialsErrorCode, setAnnualFinancialsErrorCode] =
    useState<PersonalWorkspaceApiErrorCode | null>(null);
  const [quarterlyFinancials, setQuarterlyFinancials] =
    useState<PersonalQuarterlyFinancialsDto | null>(null);
  const [quarterlyFinancialsRequestState, setQuarterlyFinancialsRequestState] =
    useState<"idle" | "loading">("idle");
  const [quarterlyFinancialsErrorCode, setQuarterlyFinancialsErrorCode] =
    useState<PersonalWorkspaceApiErrorCode | null>(null);
  const [valuationHistory, setValuationHistory] =
    useState<PersonalValuationHistoryDto | null>(null);
  const [valuationHistoryMetric, setValuationHistoryMetric] =
    useState<ValuationHistoryMetric>("priceToEarnings");
  const [historicalMultipleMetric, setHistoricalMultipleMetric] =
    useState<PersonalHistoricalMultipleValuationMetric>("priceToEarnings");
  const [valuationHistoryRequestState, setValuationHistoryRequestState] =
    useState<"idle" | "loading">("idle");
  const [valuationHistoryErrorCode, setValuationHistoryErrorCode] =
    useState<PersonalWorkspaceApiErrorCode | null>(null);
  const [manualPeers, setManualPeers] = useState<
    readonly PersonalManualPeerState[]
  >([]);
  const workspaceEpoch = useRef(0);
  const searchEpoch = useRef(0);
  const marketEpoch = useRef(0);
  const marketController = useRef<AbortController | null>(null);
  const annualFinancialsEpoch = useRef(0);
  const annualFinancialsController = useRef<AbortController | null>(null);
  const quarterlyFinancialsEpoch = useRef(0);
  const quarterlyFinancialsController = useRef<AbortController | null>(null);
  const valuationHistoryEpoch = useRef(0);
  const valuationHistoryController = useRef<AbortController | null>(null);
  const manualPeerControllers = useRef(new Map<string, ManualPeerRequest>());
  const ownerActivityStart = useRef<OwnerSessionActivityStart | null>(null);
  const workspaceActivityReady = useRef(false);
  const renderedWorkspaceEpoch = workspaceEpoch.current;
  const renderedCompanyEpoch = companySelectionEpoch.current;
  const renderedWatchlistVersion = workspace?.version;
  const renderedSearchEpoch = searchEpoch.current;

  const normalizedWatchlistQuery = normalizeWatchlistQuery(watchlistQuery);
  const matchingWatchlistRows = (workspace?.watchlist.memberships ?? [])
    .map((membership, absoluteIndex) => ({ membership, absoluteIndex }))
    .filter(({ membership }) =>
      matchesWatchlistQuery(membership, normalizedWatchlistQuery),
    );
  const watchlistPageCount = Math.max(
    1,
    Math.ceil(matchingWatchlistRows.length / WATCHLIST_PAGE_SIZE),
  );
  const currentWatchlistPage = Math.min(watchlistPage, watchlistPageCount - 1);
  if (watchlistPage !== currentWatchlistPage)
    setWatchlistPage(currentWatchlistPage);
  const visibleWatchlistRows = matchingWatchlistRows.slice(
    currentWatchlistPage * WATCHLIST_PAGE_SIZE,
    (currentWatchlistPage + 1) * WATCHLIST_PAGE_SIZE,
  );
  const watchlistView = useRef({
    workspace,
    query: watchlistQuery,
    page: currentWatchlistPage,
    saving: watchlistState === "saving",
    reconciling,
    generation: 0,
  });
  if (
    watchlistView.current.workspace !== workspace ||
    watchlistView.current.query !== watchlistQuery ||
    watchlistView.current.page !== currentWatchlistPage ||
    watchlistView.current.saving !== (watchlistState === "saving") ||
    watchlistView.current.reconciling !== reconciling
  ) {
    watchlistView.current = {
      workspace,
      query: watchlistQuery,
      page: currentWatchlistPage,
      saving: watchlistState === "saving",
      reconciling,
      generation: watchlistView.current.generation + 1,
    };
  }
  const renderedWatchlistGeneration = watchlistView.current.generation;

  useEffect(() => {
    const handoff = currentCompanyAddFocusHandoff.current;
    if (handoff === null || handoff.feedback !== companyWatchlistFeedback)
      return;
    currentCompanyAddFocusHandoff.current = null;
    handoff.run();
  }, [companyWatchlistFeedback]);

  function replaceWorkspace(next: LoadedWorkspace | null) {
    if (next === null) {
      replaceCompanyWatchlistCandidate(null);
      failedCompanyAddReloadWorkspace.current = null;
    }
    if (next === null) replaceResearchCohort(null);
    else if (
      currentResearchCohort.current !== null &&
      !cohortMatchesWorkspace(currentResearchCohort.current, next)
    )
      invalidateResearchCohort();
    if (next === null) {
      replaceNoteDrafts({});
      replaceNoteFeedback(null);
      setNoteDraftNotice(null);
    } else {
      retainNoteDrafts(next.watchlist.memberships);
      const feedback = currentNoteFeedback.current;
      if (
        feedback !== null &&
        !next.watchlist.memberships.some(
          (member) =>
            companyResearchIdentityKey(member) === feedback.identityKey,
        )
      )
        replaceNoteFeedback(null);
    }
    watchlistView.current.workspace = next;
    watchlistView.current.generation += 1;
    setWorkspace(next);
  }

  function replaceNoteDrafts(next: Record<string, WatchlistNoteDraft>) {
    currentNoteDrafts.current = next;
    setNoteDrafts(next);
  }

  function replaceNoteFeedback(next: WatchlistNoteFeedback | null) {
    currentNoteFeedback.current = next;
    setNoteFeedback(next);
  }

  function replaceResearchCohort(next: WatchlistResearchCohort | null) {
    currentResearchCohort.current = next;
    setResearchCohort(next);
  }

  function replaceCompanyWatchlistCandidate(
    next: CompanyWatchlistCandidate | null,
  ) {
    currentCompanyAddFocusCleanup.current?.();
    currentCompanyAddFocusHandoff.current = null;
    currentCompanyWatchlistCandidate.current = next;
    currentCompanyAddOperation.current = null;
    setCompanyWatchlistCandidate(next);
    setCompanyWatchlistFeedback(null);
  }

  function invalidateResearchCohort() {
    const current = currentResearchCohort.current;
    if (current !== null && !current.invalidated)
      replaceResearchCohort(Object.freeze({ ...current, invalidated: true }));
  }

  function isCurrentResearchCohort() {
    return (
      researchCohort !== null &&
      researchCohort === currentResearchCohort.current &&
      !researchCohort.invalidated &&
      workspace !== null &&
      workspace === watchlistView.current.workspace &&
      renderedWatchlistVersion === workspace.version &&
      renderedWorkspaceEpoch === workspaceEpoch.current &&
      renderedCompanyEpoch === companySelectionEpoch.current &&
      researchCatalogInvalidatedEpoch.current !== workspaceEpoch.current &&
      workspaceActivityReady.current &&
      !watchlistView.current.saving &&
      !watchlistView.current.reconciling &&
      companyIdentityKey === companyIdentity.current &&
      researchCohort.identities[researchCohort.index] === companyIdentityKey &&
      cohortMatchesWorkspace(researchCohort, workspace)
    );
  }

  function isCurrentNoteMember(membership: PersonalWatchlistMembership) {
    return (
      workspace !== null &&
      workspace === watchlistView.current.workspace &&
      renderedWatchlistVersion === workspace.version &&
      renderedWorkspaceEpoch === workspaceEpoch.current &&
      workspaceActivityReady.current &&
      workspace.watchlistAvailable &&
      hasCurrentWatchlistSnapshot(workspace) &&
      !watchlistView.current.saving &&
      !watchlistView.current.reconciling &&
      workspace.watchlist.memberships.some(
        (member) =>
          companyResearchIdentityKey(member) ===
          companyResearchIdentityKey(membership),
      )
    );
  }

  function noteValue(membership: PersonalWatchlistMembership) {
    const draft = noteDrafts[membership.listingId];
    return draft?.identityKey === companyResearchIdentityKey(membership)
      ? draft.value
      : membership.note;
  }

  function editNote(membership: PersonalWatchlistMembership, value: string) {
    if (!isCurrentNoteMember(membership)) return;
    const identityKey = companyResearchIdentityKey(membership);
    replaceNoteDrafts({
      ...currentNoteDrafts.current,
      [membership.listingId]: Object.freeze({ identityKey, value }),
    });
    replaceNoteFeedback({ identityKey, message: "Unsaved changes." });
    setNoteDraftNotice(null);
  }

  function resetWatchlistNavigation() {
    watchlistView.current.query = "";
    watchlistView.current.page = 0;
    watchlistView.current.generation += 1;
    setWatchlistQuery("");
    setWatchlistPage(0);
  }

  function isCurrentWatchlistView() {
    return (
      workspace !== null &&
      workspace === watchlistView.current.workspace &&
      renderedWatchlistGeneration === watchlistView.current.generation &&
      renderedWorkspaceEpoch === workspaceEpoch.current &&
      workspaceActivityReady.current
    );
  }

  function withCurrentWatchlistRow(row: WatchlistRow, action: () => void) {
    if (
      !isCurrentWatchlistView() ||
      workspace === null ||
      !workspace.watchlistAvailable ||
      !hasCurrentWatchlistSnapshot(workspace) ||
      watchlistView.current.saving ||
      watchlistView.current.reconciling
    )
      return;
    const current = workspace.watchlist.memberships[row.absoluteIndex];
    if (
      current === undefined ||
      companyResearchIdentityKey(current) !==
        companyResearchIdentityKey(row.membership) ||
      !visibleWatchlistRows.some(
        (visible) => visible.absoluteIndex === row.absoluteIndex,
      )
    )
      return;
    action();
  }

  function changeWatchlistQuery(value: string) {
    if (!isCurrentWatchlistView()) return;
    const next = value.slice(0, 128);
    if (next !== watchlistView.current.query) invalidateResearchCohort();
    watchlistView.current.query = next;
    watchlistView.current.page = 0;
    watchlistView.current.generation += 1;
    setWatchlistQuery(next);
    setWatchlistPage(0);
  }

  function changeWatchlistPage(direction: -1 | 1) {
    if (!isCurrentWatchlistView()) return;
    const next = currentWatchlistPage + direction;
    if (next < 0 || next >= watchlistPageCount) return;
    watchlistView.current.page = next;
    watchlistView.current.generation += 1;
    setWatchlistPage(next);
  }

  function isCurrentWatchlistOrigin(identityKey: string) {
    const current = watchlistView.current;
    const currentWorkspace = current.workspace;
    if (
      !workspaceActivityReady.current ||
      currentWorkspace === null ||
      !currentWorkspace.watchlistAvailable ||
      !hasCurrentWatchlistSnapshot(currentWorkspace) ||
      current.saving ||
      current.reconciling
    )
      return false;
    const query = normalizeWatchlistQuery(current.query);
    return currentWorkspace.watchlist.memberships
      .filter((member) => matchesWatchlistQuery(member, query))
      .slice(
        current.page * WATCHLIST_PAGE_SIZE,
        (current.page + 1) * WATCHLIST_PAGE_SIZE,
      )
      .some((member) => companyResearchIdentityKey(member) === identityKey);
  }

  const handleOwnerActivityChange = useCallback(
    (start: OwnerSessionActivityStart | null) => {
      ownerActivityStart.current = start;
    },
    [],
  );

  const handleFinancialActivityStart =
    useCallback<OwnerSessionActivityStart>(() => {
      const epoch = workspaceEpoch.current;
      const start = ownerActivityStart.current;
      if (!workspaceActivityReady.current || start === null) return undefined;
      const complete = start();
      if (complete === undefined) return undefined;
      return () =>
        workspaceActivityReady.current &&
        epoch === workspaceEpoch.current &&
        start === ownerActivityStart.current &&
        complete();
    }, []);

  const handleOwnerSessionChange = useCallback(
    async (active: boolean, signal: AbortSignal) => {
      workspaceActivityReady.current = false;
      ownerActivityStart.current = null;
      const epoch = ++workspaceEpoch.current;
      searchEpoch.current += 1;
      replaceWorkspace(null);
      resetWatchlistNavigation();
      setQuery("");
      setResults([]);
      setHasSearched(false);
      setSearchState("idle");
      setSearchMessage(null);
      setWatchlistState("idle");
      setWatchlistMessage(null);
      replaceNoteDrafts({});
      setReconciling(false);
      setReconciliationPreview(null);
      clearMarketState();
      if (!active) {
        setWorkspaceMessage((current) =>
          current === SESSION_REVALIDATION_MESSAGE ? current : null,
        );
        return false;
      }
      setWorkspaceMessage("Loading the local security universe and watchlist…");
      const [statusResult, watchlistResult, marketStatusResult] =
        await Promise.allSettled([
          fetchPersonalSecurityMasterStatus(signal),
          fetchMainPersonalWatchlist(signal),
          fetchPersonalMarketDataStatus(signal),
        ]);
      if (signal.aborted || epoch !== workspaceEpoch.current) return false;
      if (statusResult.status === "rejected") {
        setWorkspaceMessage(
          "The local security search service is unavailable.",
        );
        return false;
      }
      if (
        watchlistResult.status === "rejected" &&
        isSessionUnavailable(watchlistResult.reason)
      ) {
        clearWorkspaceForSessionLoss();
        return false;
      }
      if (
        marketStatusResult.status === "rejected" &&
        isSessionUnavailable(marketStatusResult.reason)
      ) {
        clearWorkspaceForSessionLoss();
        return false;
      }

      try {
        const status = statusResult.value;
        const watchlistAvailable = watchlistResult.status === "fulfilled";
        const record = watchlistAvailable ? watchlistResult.value : null;
        if (signal.aborted || epoch !== workspaceEpoch.current) return false;
        const watchlist =
          record?.payload ??
          createEmptyPersonalWatchlist(status.snapshot.snapshotSha256);
        replaceWorkspace({
          snapshot: status.snapshot,
          version: record?.version ?? 0,
          watchlist,
          watchlistAvailable,
        });
        setMarketDataStatus(
          marketStatusResult.status === "fulfilled"
            ? marketStatusResult.value
            : null,
        );
        setWorkspaceMessage(null);
        workspaceActivityReady.current = true;
        return true;
      } catch (error) {
        if (signal.aborted || epoch !== workspaceEpoch.current) return false;
        void error;
        setWorkspaceMessage(
          "The local security search service is unavailable.",
        );
        return false;
      }
    },
    [authMode],
  );

  function clearWorkspaceForSessionLoss() {
    if (authMode === "local" && workspaceActivityReady.current)
      setLocalAccessInvalidation((value) => value + 1);
    workspaceActivityReady.current = false;
    ownerActivityStart.current = null;
    workspaceEpoch.current += 1;
    searchEpoch.current += 1;
    replaceWorkspace(null);
    resetWatchlistNavigation();
    setWorkspaceMessage(
      authMode === "local"
        ? "The local workspace connection is unavailable."
        : SESSION_REVALIDATION_MESSAGE,
    );
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setSearchState("idle");
    setSearchMessage(null);
    setWatchlistState("idle");
    setWatchlistMessage(null);
    replaceNoteDrafts({});
    setReconciling(false);
    setReconciliationPreview(null);
    clearMarketState();
  }

  function clearMarketState() {
    clearCompanyNavigation();
    setPortfolioSelection(null);
    marketController.current?.abort();
    marketController.current = null;
    marketEpoch.current += 1;
    setMarketDataStatus(null);
    setMarketSelection(null);
    setMarketOverview(null);
    setMarketRange("1y");
    setMarketAdjustmentMode("adjusted");
    setMarketRequestState("idle");
    setMarketErrorCode(null);
    annualFinancialsController.current?.abort();
    annualFinancialsController.current = null;
    annualFinancialsEpoch.current += 1;
    setAnnualFinancials(null);
    setAnnualFinancialsRequestState("idle");
    setAnnualFinancialsErrorCode(null);
    quarterlyFinancialsController.current?.abort();
    quarterlyFinancialsController.current = null;
    quarterlyFinancialsEpoch.current += 1;
    setQuarterlyFinancials(null);
    setQuarterlyFinancialsRequestState("idle");
    setQuarterlyFinancialsErrorCode(null);
    clearManualPeerState();
    clearValuationHistoryState();
  }

  async function runSearch() {
    const activeWorkspace = workspace;
    if (activeWorkspace === null) return;
    const normalized = query.trim().normalize("NFC");
    if (normalized.length === 0) {
      setSearchMessage("Enter a ticker or company name.");
      setResults([]);
      setHasSearched(false);
      return;
    }
    const request = ++searchEpoch.current;
    const epoch = workspaceEpoch.current;
    const controller = new AbortController();
    setSearchState("loading");
    setSearchMessage(null);
    setHasSearched(true);
    try {
      const response = await searchPersonalSecurities(
        normalized,
        controller.signal,
        15,
      );
      if (epoch !== workspaceEpoch.current || request !== searchEpoch.current) {
        return;
      }
      if (
        response.snapshot.snapshotSha256 !==
        activeWorkspace.snapshot.snapshotSha256
      ) {
        researchCatalogInvalidatedEpoch.current = epoch;
        replaceResearchCohort(null);
        replaceCompanyWatchlistCandidate(null);
        setResults([]);
        setHasSearched(false);
        setSearchMessage(
          "The local security snapshot changed. Revalidate the owner session and search again.",
        );
        return;
      }
      setQuery(normalized);
      setResults(response.results);
      setSearchMessage(
        response.results.length === 0
          ? `No local matches for “${normalized}”.`
          : `${String(response.totalMatches)} local match${response.totalMatches === 1 ? "" : "es"}.`,
      );
    } catch (error) {
      if (epoch !== workspaceEpoch.current || request !== searchEpoch.current) {
        return;
      }
      if (isSessionUnavailable(error)) {
        clearWorkspaceForSessionLoss();
        return;
      }
      setResults([]);
      setHasSearched(false);
      setSearchMessage(
        error instanceof PersonalWorkspaceApiError &&
          error.code === "invalid_request"
          ? "Use a ticker or company name of at most 128 characters."
          : "Search is temporarily unavailable.",
      );
    } finally {
      if (epoch === workspaceEpoch.current && request === searchEpoch.current) {
        setSearchState("idle");
      }
    }
  }

  function selectPortfolioSecurity(identity: PersonalPortfolioIdentity) {
    setPortfolioSelection(portfolioIdentity(identity));
    if (typeof document !== "undefined") {
      queueMicrotask(() =>
        document.getElementById("personal-portfolio")?.focus(),
      );
    }
  }

  function clearCompanyNavigation() {
    replaceResearchCohort(null);
    replaceCompanyWatchlistCandidate(null);
    replaceNoteFeedback(null);
    companySelectionEpoch.current += 1;
    companyIdentity.current = null;
    companyOriginTarget.current = null;
    companyNavigationEpoch.current += 1;
    setCompanyIdentityKey(null);
    setCompanySection("price");
    setCompanyOrigin("search");
  }

  function withCurrentCompany(action: () => void) {
    if (
      companyIdentityKey === null ||
      companyIdentityKey !== companyIdentity.current ||
      renderedCompanyEpoch !== companySelectionEpoch.current ||
      renderedWorkspaceEpoch !== workspaceEpoch.current ||
      !workspaceActivityReady.current
    )
      return;
    action();
  }

  function returnFromCompany() {
    withCurrentCompany(() => {
      const navigation = ++companyNavigationEpoch.current;
      const origin = companyOriginTarget.current;
      if (origin === null) return;
      const identity = companyIdentity.current;
      queueMicrotask(() => {
        if (
          typeof document === "undefined" ||
          navigation !== companyNavigationEpoch.current ||
          identity !== companyIdentity.current ||
          origin !== companyOriginTarget.current ||
          renderedWorkspaceEpoch !== workspaceEpoch.current ||
          !workspaceActivityReady.current
        )
          return;
        focusCompanyOrigin(origin);
      });
    });
  }

  function selectMarketSecurity(
    membership:
      | PersonalSecurityMasterSearchResultDto
      | PersonalSecurityMasterScreenRowDto
      | PersonalWatchlistMembership
      | PersonalPortfolioIdentity,
    origin: CompanyResearchOrigin,
    admittedResult?:
      | PersonalSecurityMasterSearchResultDto
      | PersonalSecurityMasterScreenRowDto,
  ) {
    if (
      workspace === null ||
      renderedWorkspaceEpoch !== workspaceEpoch.current ||
      !workspaceActivityReady.current
    )
      return;
    const identity = portfolioIdentity(membership);
    const identityKey = companyResearchIdentityKey(identity);
    replaceCompanyWatchlistCandidate(
      admittedResult !== undefined &&
        (origin === "search" ||
          origin === "catalog" ||
          origin === "financials") &&
        companyResearchIdentityKey(admittedResult) === identityKey &&
        workspace === watchlistView.current.workspace &&
        renderedWatchlistVersion === workspace.version &&
        researchCatalogInvalidatedEpoch.current !== workspaceEpoch.current &&
        (origin !== "search" ||
          (renderedSearchEpoch === searchEpoch.current &&
            searchState !== "loading" &&
            results.some((result) => result === admittedResult)))
        ? Object.freeze({
            result: Object.freeze({ ...admittedResult }),
            identityKey,
            snapshotSha256: workspace.snapshot.snapshotSha256,
          })
        : null,
    );
    if (
      origin === "watchlist" &&
      researchCatalogInvalidatedEpoch.current !== workspaceEpoch.current
    ) {
      const identities = matchingWatchlistRows.map(({ membership: member }) =>
        companyResearchIdentityKey(member),
      );
      const index = identities.indexOf(identityKey);
      replaceResearchCohort(
        index < 0
          ? null
          : Object.freeze({
              identities: Object.freeze(identities),
              allIdentities: Object.freeze(
                workspace.watchlist.memberships.map(companyResearchIdentityKey),
              ),
              snapshotSha256: workspace.snapshot.snapshotSha256,
              index,
              invalidated: false,
            }),
      );
    } else replaceResearchCohort(null);
    const navigation = ++companyNavigationEpoch.current;
    setPortfolioSelection(identity);
    setCompanyOrigin(origin);
    const headingId = COMPANY_RESEARCH_ORIGINS[origin].headingId;
    const active =
      typeof document === "undefined" ? null : document.activeElement;
    companyOriginTarget.current = {
      headingId,
      ...(origin === "watchlist"
        ? { isCurrent: () => isCurrentWatchlistOrigin(identityKey) }
        : {}),
      trigger:
        active !== null &&
        active instanceof HTMLElement &&
        active.closest(`[aria-labelledby~="${headingId}"]`) !== null
          ? active
          : null,
    };
    const originTarget = companyOriginTarget.current;
    const capturedCohort = currentResearchCohort.current;
    queueMicrotask(() => {
      if (
        typeof document === "undefined" ||
        navigation !== companyNavigationEpoch.current ||
        identityKey !== companyIdentity.current ||
        originTarget.isCurrent?.() === false ||
        (origin === "watchlist" &&
          (capturedCohort !== currentResearchCohort.current ||
            workspace !== watchlistView.current.workspace ||
            renderedWatchlistVersion !== workspace.version)) ||
        renderedWorkspaceEpoch !== workspaceEpoch.current ||
        !workspaceActivityReady.current
      )
        return;
      focusCompanyTarget(
        document.getElementById("personal-company-research-title"),
      );
    });
    selectCompanyIdentity(identity, origin);
  }

  function moveResearchCompany(direction: -1 | 1) {
    if (
      !isCurrentResearchCohort() ||
      researchCohort === null ||
      workspace === null
    )
      return;
    const index = researchCohort.index + direction;
    if (index < 0 || index >= researchCohort.identities.length) return;
    const identityKey = researchCohort.identities[index];
    const member = workspace.watchlist.memberships.find(
      (candidate) => companyResearchIdentityKey(candidate) === identityKey,
    );
    if (member === undefined) return;
    const next = Object.freeze({ ...researchCohort, index });
    replaceResearchCohort(next);
    replaceCompanyWatchlistCandidate(null);
    const navigation = ++companyNavigationEpoch.current;
    selectCompanyIdentity(member, "watchlist");
    const selectionEpoch = companySelectionEpoch.current;
    queueMicrotask(() => {
      if (
        typeof document === "undefined" ||
        navigation !== companyNavigationEpoch.current ||
        currentResearchCohort.current !== next ||
        selectionEpoch !== companySelectionEpoch.current ||
        identityKey !== companyIdentity.current ||
        workspace !== watchlistView.current.workspace ||
        renderedWatchlistVersion !== workspace.version ||
        renderedWorkspaceEpoch !== workspaceEpoch.current ||
        !workspaceActivityReady.current ||
        watchlistView.current.saving ||
        watchlistView.current.reconciling ||
        !cohortMatchesWorkspace(next, workspace)
      )
        return;
      focusCompanyTarget(
        document.getElementById("personal-company-research-title"),
      );
    });
  }

  function selectCompanyIdentity(
    membership: PersonalPortfolioIdentity,
    origin: CompanyResearchOrigin,
  ) {
    const identityKey = companyResearchIdentityKey(membership);
    if (identityKey === companyIdentity.current) return;
    replaceNoteFeedback(null);
    companySelectionEpoch.current += 1;
    companyIdentity.current = identityKey;
    setCompanyIdentityKey(identityKey);
    setCompanySection(
      origin === "financials"
        ? "financials"
        : origin === "filings"
          ? "sec"
          : "price",
    );
    marketController.current?.abort();
    marketController.current = null;
    marketEpoch.current += 1;
    setMarketSelection(
      Object.freeze({
        country: membership.country,
        exchangeMic: membership.exchangeMic,
        issuerId: membership.issuerId,
        issuerName: membership.issuerName,
        listingId: membership.listingId,
        securityName: membership.securityName,
        symbol: membership.symbol,
      }),
    );
    setMarketOverview(null);
    setMarketRange("1y");
    setMarketAdjustmentMode("adjusted");
    setMarketRequestState("idle");
    setMarketErrorCode(
      marketDataStatus?.status === "not_configured" ? "not_configured" : null,
    );
    annualFinancialsController.current?.abort();
    annualFinancialsController.current = null;
    annualFinancialsEpoch.current += 1;
    setAnnualFinancials(null);
    setAnnualFinancialsRequestState("idle");
    setAnnualFinancialsErrorCode(null);
    quarterlyFinancialsController.current?.abort();
    quarterlyFinancialsController.current = null;
    quarterlyFinancialsEpoch.current += 1;
    setQuarterlyFinancials(null);
    setQuarterlyFinancialsRequestState("idle");
    setQuarterlyFinancialsErrorCode(null);
    clearManualPeerState();
    clearValuationHistoryState();
  }

  function clearSelectedCompany() {
    withCurrentCompany(() => {
      const origin = companyOriginTarget.current;
      closeMarketView();
      const navigation = companyNavigationEpoch.current;
      queueMicrotask(() => {
        if (
          typeof document === "undefined" ||
          origin === null ||
          navigation !== companyNavigationEpoch.current ||
          companyIdentity.current !== null ||
          renderedWorkspaceEpoch !== workspaceEpoch.current ||
          !workspaceActivityReady.current
        )
          return;
        focusCompanyOrigin(origin);
      });
    });
  }

  function closeMarketView() {
    clearCompanyNavigation();
    marketController.current?.abort();
    marketController.current = null;
    marketEpoch.current += 1;
    setMarketSelection(null);
    setMarketOverview(null);
    setMarketRange("1y");
    setMarketAdjustmentMode("adjusted");
    setMarketRequestState("idle");
    setMarketErrorCode(null);
    annualFinancialsController.current?.abort();
    annualFinancialsController.current = null;
    annualFinancialsEpoch.current += 1;
    setAnnualFinancials(null);
    setAnnualFinancialsRequestState("idle");
    setAnnualFinancialsErrorCode(null);
    quarterlyFinancialsController.current?.abort();
    quarterlyFinancialsController.current = null;
    quarterlyFinancialsEpoch.current += 1;
    setQuarterlyFinancials(null);
    setQuarterlyFinancialsRequestState("idle");
    setQuarterlyFinancialsErrorCode(null);
    clearManualPeerState();
    clearValuationHistoryState();
  }

  function clearValuationHistoryState(resetMetric = true) {
    valuationHistoryController.current?.abort();
    valuationHistoryController.current = null;
    valuationHistoryEpoch.current += 1;
    setValuationHistory(null);
    if (resetMetric) {
      setValuationHistoryMetric("priceToEarnings");
      setHistoricalMultipleMetric("priceToEarnings");
    }
    setValuationHistoryRequestState("idle");
    setValuationHistoryErrorCode(null);
  }

  function abortManualPeerRequests() {
    for (const request of manualPeerControllers.current.values()) {
      request.controller.abort();
    }
    manualPeerControllers.current.clear();
  }

  function clearManualPeerState() {
    abortManualPeerRequests();
    setManualPeers([]);
  }

  function clearManualPeerValuationState() {
    const activeRequests = new Map(manualPeerControllers.current);
    abortManualPeerRequests();
    setManualPeers((current) =>
      Object.freeze(
        current.map((peer) => {
          const interrupted = activeRequests.get(peer.selection.listingId);
          return Object.freeze({
            ...peer,
            annualErrorCode:
              interrupted?.priorAnnualErrorCode ?? peer.annualErrorCode,
            annualFinancials:
              interrupted?.priorAnnualFinancials ?? peer.annualFinancials,
            requestState: "idle" as const,
            valuationErrorCode: null,
            valuationHistory: null,
          });
        }),
      ),
    );
  }

  function addManualPeer(candidate: PersonalManualPeerSelection) {
    if (marketSelection === null) return;
    const admitted = manualPeerCandidates.find(
      (selection) =>
        selection.listingId === candidate.listingId &&
        sameManualPeerSelection(selection, candidate),
    );
    if (admitted === undefined) return;
    setManualPeers((current) => {
      if (
        current.length >= PERSONAL_MANUAL_PEER_COMPARISON_MAXIMUM_PEERS ||
        current.some(
          (peer) =>
            peer.selection.listingId === admitted.listingId ||
            peer.selection.issuerId === admitted.issuerId,
        ) ||
        admitted.listingId === marketSelection.listingId ||
        admitted.issuerId === marketSelection.issuerId
      ) {
        return current;
      }
      return Object.freeze([
        ...current,
        Object.freeze({
          annualErrorCode: null,
          annualFinancials: null,
          requestState: "idle" as const,
          selection: admitted,
          valuationErrorCode: null,
          valuationHistory: null,
        }),
      ]);
    });
  }

  function removeManualPeer(listingId: string) {
    const request = manualPeerControllers.current.get(listingId);
    request?.controller.abort();
    if (request !== undefined) {
      manualPeerControllers.current.delete(listingId);
    }
    setManualPeers((current) =>
      Object.freeze(
        current.filter((peer) => peer.selection.listingId !== listingId),
      ),
    );
  }

  async function loadManualPeerData(listingId: string) {
    const peer = manualPeers.find(
      (candidate) => candidate.selection.listingId === listingId,
    );
    if (
      peer === undefined ||
      (annualFinancials === null &&
        (valuationHistory === null ||
          valuationHistory.history.range !== marketRange)) ||
      manualPeerControllers.current.size > 0 ||
      manualPeers.some((candidate) => candidate.requestState === "loading")
    ) {
      return;
    }
    const unavailableCode =
      marketDataStatus?.status === "not_configured"
        ? "not_configured"
        : marketDataStatus === null
          ? "unavailable"
          : null;
    if (unavailableCode !== null) {
      setManualPeers((current) =>
        updateManualPeer(current, listingId, (candidate) => ({
          ...candidate,
          annualErrorCode: unavailableCode,
          annualFinancials: null,
          requestState: "idle",
          valuationErrorCode: unavailableCode,
          valuationHistory: null,
        })),
      );
      return;
    }

    const controller = new AbortController();
    manualPeerControllers.current.set(listingId, {
      controller,
      priorAnnualErrorCode: peer.annualErrorCode,
      priorAnnualFinancials: peer.annualFinancials,
    });
    const epoch = workspaceEpoch.current;
    const requestedRange = marketRange;
    const observePeerFailure = (error: unknown): never => {
      if (
        isSessionUnavailable(error) &&
        !controller.signal.aborted &&
        epoch === workspaceEpoch.current &&
        manualPeerControllers.current.get(listingId)?.controller === controller
      ) {
        clearWorkspaceForSessionLoss();
      }
      throw error;
    };
    setManualPeers((current) =>
      updateManualPeer(current, listingId, (candidate) => ({
        ...candidate,
        annualErrorCode: null,
        annualFinancials: null,
        requestState: "loading",
        valuationErrorCode: null,
        valuationHistory: null,
      })),
    );

    const [annualResult, valuationResult] = await Promise.allSettled([
      fetchPersonalAnnualFinancials(
        {
          listingId: peer.selection.listingId,
          symbol: peer.selection.symbol,
        },
        controller.signal,
      ).catch(observePeerFailure),
      fetchPersonalValuationHistory(
        {
          listingId: peer.selection.listingId,
          range: requestedRange,
          symbol: peer.selection.symbol,
        },
        controller.signal,
      ).catch(observePeerFailure),
    ]);

    if (
      controller.signal.aborted ||
      epoch !== workspaceEpoch.current ||
      manualPeerControllers.current.get(listingId)?.controller !== controller
    ) {
      return;
    }
    if (
      (annualResult.status === "rejected" &&
        isSessionUnavailable(annualResult.reason)) ||
      (valuationResult.status === "rejected" &&
        isSessionUnavailable(valuationResult.reason))
    ) {
      clearWorkspaceForSessionLoss();
      return;
    }

    setManualPeers((current) =>
      updateManualPeer(current, listingId, (candidate) => ({
        ...candidate,
        annualErrorCode:
          annualResult.status === "fulfilled"
            ? null
            : personalRequestErrorCode(annualResult.reason),
        annualFinancials:
          annualResult.status === "fulfilled" ? annualResult.value : null,
        requestState: "idle",
        valuationErrorCode:
          valuationResult.status === "fulfilled"
            ? null
            : personalRequestErrorCode(valuationResult.reason),
        valuationHistory:
          valuationResult.status === "fulfilled" ? valuationResult.value : null,
      })),
    );
    if (
      manualPeerControllers.current.get(listingId)?.controller === controller
    ) {
      manualPeerControllers.current.delete(listingId);
    }
  }

  async function loadMarketData(range: PersonalMarketDataRangeDto) {
    const selection = marketSelection;
    if (selection === null || marketRequestState === "loading") return;
    if (marketDataStatus?.status === "not_configured") {
      setMarketErrorCode("not_configured");
      return;
    }
    if (marketDataStatus === null) {
      setMarketErrorCode("unavailable");
      return;
    }

    marketController.current?.abort();
    if (range !== marketRange) {
      clearValuationHistoryState(false);
      clearManualPeerValuationState();
    }
    const controller = new AbortController();
    marketController.current = controller;
    const request = ++marketEpoch.current;
    const epoch = workspaceEpoch.current;
    setMarketRange(range);
    setMarketOverview(null);
    setMarketErrorCode(null);
    setMarketRequestState("loading");
    try {
      const loaded = await fetchPersonalMarketOverview(
        {
          listingId: selection.listingId,
          range,
          symbol: selection.symbol,
        },
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        epoch !== workspaceEpoch.current ||
        request !== marketEpoch.current
      ) {
        return;
      }
      setMarketOverview(loaded);
    } catch (error) {
      if (
        controller.signal.aborted ||
        epoch !== workspaceEpoch.current ||
        request !== marketEpoch.current
      ) {
        return;
      }
      if (isSessionUnavailable(error)) {
        clearWorkspaceForSessionLoss();
        return;
      }
      setMarketErrorCode(
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable",
      );
    } finally {
      if (epoch === workspaceEpoch.current && request === marketEpoch.current) {
        marketController.current = null;
        setMarketRequestState("idle");
      }
    }
  }

  async function loadAnnualFinancials() {
    const selection = marketSelection;
    if (selection === null || annualFinancialsRequestState === "loading") {
      return;
    }
    if (marketDataStatus?.status === "not_configured") {
      setAnnualFinancialsErrorCode("not_configured");
      return;
    }
    if (marketDataStatus === null) {
      setAnnualFinancialsErrorCode("unavailable");
      return;
    }

    annualFinancialsController.current?.abort();
    const controller = new AbortController();
    annualFinancialsController.current = controller;
    const request = ++annualFinancialsEpoch.current;
    const epoch = workspaceEpoch.current;
    setAnnualFinancials(null);
    setAnnualFinancialsErrorCode(null);
    setAnnualFinancialsRequestState("loading");
    try {
      const loaded = await fetchPersonalAnnualFinancials(
        {
          listingId: selection.listingId,
          symbol: selection.symbol,
        },
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        epoch !== workspaceEpoch.current ||
        request !== annualFinancialsEpoch.current
      ) {
        return;
      }
      setAnnualFinancials(loaded);
    } catch (error) {
      if (
        controller.signal.aborted ||
        epoch !== workspaceEpoch.current ||
        request !== annualFinancialsEpoch.current
      ) {
        return;
      }
      if (isSessionUnavailable(error)) {
        clearWorkspaceForSessionLoss();
        return;
      }
      setAnnualFinancialsErrorCode(
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable",
      );
    } finally {
      if (
        epoch === workspaceEpoch.current &&
        request === annualFinancialsEpoch.current
      ) {
        annualFinancialsController.current = null;
        setAnnualFinancialsRequestState("idle");
      }
    }
  }

  async function loadQuarterlyFinancials() {
    const selection = marketSelection;
    if (selection === null || quarterlyFinancialsRequestState === "loading") {
      return;
    }
    if (marketDataStatus?.status === "not_configured") {
      setQuarterlyFinancialsErrorCode("not_configured");
      return;
    }
    if (marketDataStatus === null) {
      setQuarterlyFinancialsErrorCode("unavailable");
      return;
    }

    quarterlyFinancialsController.current?.abort();
    const controller = new AbortController();
    quarterlyFinancialsController.current = controller;
    const request = ++quarterlyFinancialsEpoch.current;
    const epoch = workspaceEpoch.current;
    setQuarterlyFinancials(null);
    setQuarterlyFinancialsErrorCode(null);
    setQuarterlyFinancialsRequestState("loading");
    try {
      const loaded = await fetchPersonalQuarterlyFinancials(
        {
          listingId: selection.listingId,
          symbol: selection.symbol,
        },
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        epoch !== workspaceEpoch.current ||
        request !== quarterlyFinancialsEpoch.current
      ) {
        return;
      }
      setQuarterlyFinancials(loaded);
    } catch (error) {
      if (
        controller.signal.aborted ||
        epoch !== workspaceEpoch.current ||
        request !== quarterlyFinancialsEpoch.current
      ) {
        return;
      }
      if (isSessionUnavailable(error)) {
        clearWorkspaceForSessionLoss();
        return;
      }
      setQuarterlyFinancialsErrorCode(
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable",
      );
    } finally {
      if (
        epoch === workspaceEpoch.current &&
        request === quarterlyFinancialsEpoch.current
      ) {
        quarterlyFinancialsController.current = null;
        setQuarterlyFinancialsRequestState("idle");
      }
    }
  }

  async function loadValuationHistory() {
    const selection = marketSelection;
    if (selection === null || valuationHistoryRequestState === "loading") {
      return;
    }
    if (marketDataStatus?.status === "not_configured") {
      setValuationHistoryErrorCode("not_configured");
      return;
    }
    if (marketDataStatus === null) {
      setValuationHistoryErrorCode("unavailable");
      return;
    }

    valuationHistoryController.current?.abort();
    const controller = new AbortController();
    valuationHistoryController.current = controller;
    const request = ++valuationHistoryEpoch.current;
    const epoch = workspaceEpoch.current;
    const range = marketRange;
    setValuationHistory(null);
    setValuationHistoryErrorCode(null);
    setValuationHistoryRequestState("loading");
    try {
      const loaded = await fetchPersonalValuationHistory(
        {
          listingId: selection.listingId,
          range,
          symbol: selection.symbol,
        },
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        epoch !== workspaceEpoch.current ||
        request !== valuationHistoryEpoch.current
      ) {
        return;
      }
      setValuationHistory(loaded);
    } catch (error) {
      if (
        controller.signal.aborted ||
        epoch !== workspaceEpoch.current ||
        request !== valuationHistoryEpoch.current
      ) {
        return;
      }
      if (isSessionUnavailable(error)) {
        clearWorkspaceForSessionLoss();
        return;
      }
      setValuationHistoryErrorCode(
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable",
      );
    } finally {
      if (
        epoch === workspaceEpoch.current &&
        request === valuationHistoryEpoch.current
      ) {
        valuationHistoryController.current = null;
        setValuationHistoryRequestState("idle");
      }
    }
  }

  async function persistWatchlist(
    next: PersonalWatchlistPayload,
    successMessage: string,
  ): Promise<WatchlistSaveOutcome> {
    const activeWorkspace = workspace;
    if (
      activeWorkspace === null ||
      activeWorkspace !== watchlistView.current.workspace ||
      renderedWorkspaceEpoch !== workspaceEpoch.current ||
      !workspaceActivityReady.current ||
      !activeWorkspace.watchlistAvailable ||
      watchlistView.current.saving
    ) {
      return "inactive";
    }
    const epoch = workspaceEpoch.current;
    const controller = new AbortController();
    watchlistView.current.saving = true;
    watchlistView.current.generation += 1;
    setWatchlistState("saving");
    setWatchlistMessage(null);
    try {
      const saved = await saveMainPersonalWatchlist(
        activeWorkspace.version,
        next,
        controller.signal,
      );
      if (epoch !== workspaceEpoch.current) return "inactive";
      replaceWorkspace({
        ...activeWorkspace,
        version: saved.version,
        watchlist: saved.payload,
      });
      setReconciliationPreview(null);
      setWatchlistMessage(successMessage);
      return "saved";
    } catch (error) {
      if (epoch !== workspaceEpoch.current) return "inactive";
      if (isSessionUnavailable(error)) {
        clearWorkspaceForSessionLoss();
        return "inactive";
      } else if (
        error instanceof PersonalWorkspaceApiError &&
        error.code === "conflict"
      ) {
        const reloaded = await reloadAfterConflict(
          activeWorkspace.snapshot,
          epoch,
        );
        return reloaded === "inactive"
          ? "inactive"
          : reloaded === "reloaded"
            ? "conflict_reloaded"
            : "conflict_reload_failed";
      } else {
        setWatchlistMessage(
          "The watchlist change was not saved. Your prior saved list is unchanged.",
        );
      }
      return "unavailable";
    } finally {
      if (epoch === workspaceEpoch.current) {
        watchlistView.current.saving = false;
        watchlistView.current.generation += 1;
        setWatchlistState("idle");
      }
    }
  }

  async function reloadAfterConflict(
    snapshot: PersonalSecurityMasterSnapshotReceiptDto,
    epoch: number,
  ): Promise<"reloaded" | "failed" | "inactive"> {
    try {
      const latest = await fetchMainPersonalWatchlist(
        new AbortController().signal,
      );
      if (epoch !== workspaceEpoch.current) return "inactive";
      replaceWorkspace({
        snapshot,
        version: latest?.version ?? 0,
        watchlist:
          latest?.payload ??
          createEmptyPersonalWatchlist(snapshot.snapshotSha256),
        watchlistAvailable: true,
      });
      setReconciliationPreview(null);
      setWatchlistMessage(
        "The watchlist changed in another tab. The latest saved version is now shown; try your change again.",
      );
      return "reloaded";
    } catch (error) {
      if (epoch !== workspaceEpoch.current) return "inactive";
      if (isSessionUnavailable(error)) {
        clearWorkspaceForSessionLoss();
        return "inactive";
      } else {
        setWatchlistMessage(
          "The watchlist changed elsewhere and could not be reloaded.",
        );
      }
      return "failed";
    }
  }

  function addResult(
    result:
      | PersonalSecurityMasterSearchResultDto
      | PersonalSecurityMasterScreenRowDto,
  ) {
    if (
      workspace === null ||
      !workspace.watchlistAvailable ||
      !hasCurrentWatchlistSnapshot(workspace)
    ) {
      return;
    }
    if (
      workspace.watchlist.memberships.some(
        (membership) => membership.listingId === result.listingId,
      )
    ) {
      setWatchlistMessage(`${result.symbol} is already in My Watchlist.`);
      return;
    }
    const membership = membershipFromSearchResult(result);
    void persistWatchlist(
      withMemberships(workspace.watchlist, [
        ...workspace.watchlist.memberships,
        membership,
      ]),
      `${result.symbol} was added to My Watchlist.`,
    );
  }

  function companyWatchlistUnavailableReason(): string | null {
    if (workspace === null || !workspace.watchlistAvailable)
      return "My Watchlist is unavailable. Reload the workspace before adding this company.";
    if (
      !hasCurrentWatchlistSnapshot(workspace) ||
      researchCatalogInvalidatedEpoch.current === workspaceEpoch.current
    )
      return "Revalidate the workspace and reconcile My Watchlist with the current catalog before adding this company.";
    if (failedCompanyAddReloadWorkspace.current === workspace)
      return "The changed watchlist could not be reloaded. Reload the workspace before adding a company.";
    if (
      companyWatchlistCandidate === null ||
      companyWatchlistCandidate !== currentCompanyWatchlistCandidate.current ||
      companyWatchlistCandidate.identityKey !== companyIdentityKey ||
      companyWatchlistCandidate.snapshotSha256 !==
        workspace.snapshot.snapshotSha256
    )
      return "Research notes are available for companies saved in My Watchlist. Open this company from current search or screening results to add it.";
    if (
      workspace.watchlist.memberships.some(
        (member) =>
          member.listingId === companyWatchlistCandidate.result.listingId,
      )
    )
      return "My Watchlist already contains this listing with a different identity. Reconcile the list before adding it.";
    if (workspace.watchlist.memberships.length >= WATCHLIST_MAXIMUM_MEMBERSHIPS)
      return "My Watchlist has reached its 10,000-company limit. Remove a company before adding another.";
    return null;
  }

  async function addResearchedCompany() {
    const candidate = companyWatchlistCandidate;
    const activeWorkspace = workspace;
    if (
      candidate === null ||
      activeWorkspace === null ||
      candidate !== currentCompanyWatchlistCandidate.current ||
      companyWatchlistUnavailableReason() !== null ||
      companyIdentityKey !== companyIdentity.current ||
      renderedCompanyEpoch !== companySelectionEpoch.current ||
      renderedWorkspaceEpoch !== workspaceEpoch.current ||
      activeWorkspace !== watchlistView.current.workspace ||
      renderedWatchlistGeneration !== watchlistView.current.generation ||
      renderedWatchlistVersion !== activeWorkspace.version ||
      !workspaceActivityReady.current ||
      watchlistView.current.saving ||
      watchlistView.current.reconciling
    )
      return;

    const operation = {};
    currentCompanyAddFocusCleanup.current?.();
    currentCompanyAddFocusHandoff.current = null;
    currentCompanyAddOperation.current = operation;
    const selectionEpoch = companySelectionEpoch.current;
    const sessionEpoch = workspaceEpoch.current;
    const navigationEpoch = companyNavigationEpoch.current;
    const button =
      typeof document === "undefined"
        ? null
        : document.getElementById("company-watchlist-add");
    const ownedFocus = button !== null && document.activeElement === button;
    let focusMoved = false;
    const observeFocusMove = (event: Event) => {
      if (event.target !== button) focusMoved = true;
    };
    if (ownedFocus) {
      document.addEventListener?.("focusin", observeFocusMove, true);
      document.addEventListener?.("pointerdown", observeFocusMove, true);
    }
    let focusObservationReleased = false;
    const releaseFocusObservation = () => {
      if (focusObservationReleased) return;
      focusObservationReleased = true;
      if (ownedFocus) {
        document.removeEventListener?.("focusin", observeFocusMove, true);
        document.removeEventListener?.("pointerdown", observeFocusMove, true);
      }
      if (currentCompanyAddFocusCleanup.current === releaseFocusObservation)
        currentCompanyAddFocusCleanup.current = null;
    };
    currentCompanyAddFocusCleanup.current = releaseFocusObservation;
    let focusHandoffQueued = false;
    const ownsCompletion = () =>
      currentCompanyAddOperation.current === operation &&
      currentCompanyWatchlistCandidate.current === candidate &&
      selectionEpoch === companySelectionEpoch.current &&
      sessionEpoch === workspaceEpoch.current &&
      candidate.identityKey === companyIdentity.current &&
      workspaceActivityReady.current &&
      researchCatalogInvalidatedEpoch.current !== workspaceEpoch.current;

    setCompanyWatchlistFeedback({
      candidate,
      pending: true,
      message: "Adding this company to My Watchlist…",
    });
    try {
      const membership = membershipFromSearchResult(candidate.result);
      const outcome = await persistWatchlist(
        withMemberships(activeWorkspace.watchlist, [
          ...activeWorkspace.watchlist.memberships,
          membership,
        ]),
        `${membership.symbol} was added to My Watchlist.`,
      );
      // A failed reload leaves the old workspace stale, even after navigation.
      if (
        outcome === "conflict_reload_failed" &&
        sessionEpoch === workspaceEpoch.current &&
        watchlistView.current.workspace === activeWorkspace
      )
        failedCompanyAddReloadWorkspace.current = activeWorkspace;
      if (!ownsCompletion()) return;
      const currentWorkspace = watchlistView.current.workspace;
      const savedMember = currentWorkspace?.watchlist.memberships.find(
        (member) =>
          companyResearchIdentityKey(member) === candidate.identityKey,
      );
      const currentCatalog =
        currentWorkspace !== null &&
        currentWorkspace.watchlistAvailable &&
        hasCurrentWatchlistSnapshot(currentWorkspace) &&
        currentWorkspace.snapshot.snapshotSha256 === candidate.snapshotSha256;
      const saved = savedMember !== undefined && currentCatalog;
      const feedback: CompanyWatchlistFeedback = {
        candidate,
        pending: false,
        message:
          outcome === "saved" && saved
            ? `${membership.symbol} was added to My Watchlist. You can now write a research note.`
            : outcome === "conflict_reloaded"
              ? saved
                ? "This company is already in the latest My Watchlist. Its saved research note is shown."
                : "My Watchlist changed elsewhere. Review the latest list, then explicitly try adding again."
              : outcome === "conflict_reload_failed"
                ? "My Watchlist changed elsewhere and could not be reloaded. Reload the workspace before trying again."
                : "Could not confirm whether this company was added to My Watchlist. Reload the workspace to check the latest saved list.",
      };
      setCompanyWatchlistFeedback(feedback);
      if ((outcome === "saved" || outcome === "conflict_reloaded") && saved) {
        focusHandoffQueued = true;
        currentCompanyAddFocusHandoff.current = {
          feedback,
          run: () => {
            try {
              if (
                !ownedFocus ||
                focusMoved ||
                !ownsCompletion() ||
                navigationEpoch !== companyNavigationEpoch.current ||
                watchlistView.current.workspace !== currentWorkspace ||
                watchlistView.current.saving ||
                watchlistView.current.reconciling ||
                typeof document === "undefined" ||
                document.visibilityState === "hidden" ||
                (document.activeElement !== button &&
                  document.activeElement !== document.body)
              )
                return;
              document.getElementById("company-watchlist-note")?.focus();
            } finally {
              releaseFocusObservation();
            }
          },
        };
      }
    } catch {
      if (ownsCompletion())
        setCompanyWatchlistFeedback({
          candidate,
          pending: false,
          message:
            "This company could not be added. Reopen it from current search or screening results and try again.",
        });
    } finally {
      // A successful handoff waits for its completion render to mount the note.
      if (!focusHandoffQueued) releaseFocusObservation();
    }
  }

  function removeMembership(membership: PersonalWatchlistMembership) {
    if (
      workspace === null ||
      !workspace.watchlistAvailable ||
      !hasCurrentWatchlistSnapshot(workspace)
    ) {
      return;
    }
    void persistWatchlist(
      withMemberships(
        workspace.watchlist,
        workspace.watchlist.memberships.filter(
          (candidate) => candidate.listingId !== membership.listingId,
        ),
      ),
      `${membership.symbol} was removed from My Watchlist.`,
    );
  }

  function moveMembership(index: number, direction: -1 | 1) {
    if (
      workspace === null ||
      !workspace.watchlistAvailable ||
      !hasCurrentWatchlistSnapshot(workspace)
    ) {
      return;
    }
    const destination = index + direction;
    if (
      destination < 0 ||
      destination >= workspace.watchlist.memberships.length
    ) {
      return;
    }
    const memberships = [...workspace.watchlist.memberships];
    const selected = memberships[index];
    const displaced = memberships[destination];
    if (selected === undefined || displaced === undefined) return;
    memberships[index] = displaced;
    memberships[destination] = selected;
    void persistWatchlist(
      withMemberships(workspace.watchlist, memberships),
      `${selected.symbol} was reordered.`,
    );
  }

  async function saveNote(membership: PersonalWatchlistMembership) {
    if (workspace === null || !isCurrentNoteMember(membership)) return;
    const identityKey = companyResearchIdentityKey(membership);
    const slot = currentNoteDrafts.current[membership.listingId];
    const capturedDraft = slot?.identityKey === identityKey ? slot : undefined;
    const note = normalizeWatchlistNote(
      capturedDraft?.value ?? membership.note,
    );
    if (note === null) {
      const message =
        "Notes must be at most 2,000 characters and cannot contain control characters.";
      setWatchlistMessage(message);
      replaceNoteFeedback({ identityKey, message });
      return;
    }
    const epoch = workspaceEpoch.current;
    const pendingFeedback = Object.freeze({
      identityKey,
      message: "Saving research note…",
    });
    replaceNoteFeedback(pendingFeedback);
    const memberships = workspace.watchlist.memberships.map((candidate) =>
      companyResearchIdentityKey(candidate) === identityKey
        ? Object.freeze({ ...candidate, note })
        : candidate,
    );
    const outcome = await persistWatchlist(
      withMemberships(workspace.watchlist, memberships),
      `${membership.symbol} note was saved.`,
    );
    if (
      outcome === "saved" &&
      capturedDraft !== undefined &&
      currentNoteDrafts.current[membership.listingId] === capturedDraft
    ) {
      const next = { ...currentNoteDrafts.current };
      delete next[membership.listingId];
      replaceNoteDrafts(next);
    }
    if (
      outcome === "inactive" ||
      epoch !== workspaceEpoch.current ||
      !workspaceActivityReady.current ||
      currentNoteFeedback.current !== pendingFeedback ||
      !watchlistView.current.workspace?.watchlistAvailable ||
      !watchlistView.current.workspace.watchlist.memberships.some(
        (member) => companyResearchIdentityKey(member) === identityKey,
      )
    )
      return;
    const messages = {
      saved: "Research note saved to My Watchlist.",
      conflict_reloaded:
        "My Watchlist changed in another tab. The latest saved list is shown and your draft is retained. Review it before saving again.",
      conflict_reload_failed:
        "The note was not saved, and the latest watchlist could not be loaded. Your draft is retained.",
      unavailable:
        "Could not confirm that the research note was saved. Your draft is retained.",
    };
    replaceNoteFeedback({ identityKey, message: messages[outcome] });
  }

  async function reconcileStaleWatchlist() {
    const activeWorkspace = workspace;
    if (
      activeWorkspace === null ||
      !activeWorkspace.watchlistAvailable ||
      hasCurrentWatchlistSnapshot(activeWorkspace) ||
      reconciling ||
      watchlistState === "saving"
    ) {
      return;
    }

    const epoch = workspaceEpoch.current;
    const controller = new AbortController();
    watchlistView.current.reconciling = true;
    watchlistView.current.generation += 1;
    setReconciling(true);
    setReconciliationPreview(null);
    setWatchlistMessage(null);
    try {
      const matched: PersonalWatchlistMembership[] = [];
      const unmatched: PersonalWatchlistMembership[] = [];
      for (const membership of activeWorkspace.watchlist.memberships) {
        const resolved = await resolveCurrentMembership(
          membership,
          activeWorkspace.snapshot.snapshotSha256,
          controller.signal,
        );
        if (epoch !== workspaceEpoch.current) return;
        if (resolved === null) unmatched.push(membership);
        else matched.push(resolved);
      }

      if (unmatched.length > 0) {
        setReconciliationPreview(
          Object.freeze({
            matched: Object.freeze(matched),
            snapshotSha256: activeWorkspace.snapshot.snapshotSha256,
            unmatched: Object.freeze(unmatched),
            watchlistVersion: activeWorkspace.version,
          }),
        );
        setWatchlistMessage(reconciliationPreviewMessage(unmatched));
        return;
      }
      await persistWatchlist(
        Object.freeze({
          ...activeWorkspace.watchlist,
          snapshotSha256: activeWorkspace.snapshot.snapshotSha256,
          memberships: Object.freeze(matched),
        }),
        reconciliationSuccessMessage(matched.length, []),
      );
    } catch (error) {
      if (epoch !== workspaceEpoch.current) return;
      if (isSessionUnavailable(error)) {
        clearWorkspaceForSessionLoss();
      } else {
        setWatchlistMessage(
          error instanceof WorkspaceSnapshotChangedError
            ? "The security snapshot changed again. Revalidate the owner session before reconciling."
            : "The watchlist could not be reconciled. No saved entries were changed.",
        );
      }
    } finally {
      if (epoch === workspaceEpoch.current) setReconciling(false);
    }
  }

  async function finishReconciliationWithRemovals() {
    const activeWorkspace = workspace;
    const preview = reconciliationPreview;
    if (
      activeWorkspace === null ||
      preview === null ||
      !activeWorkspace.watchlistAvailable ||
      hasCurrentWatchlistSnapshot(activeWorkspace) ||
      reconciling ||
      watchlistState === "saving"
    ) {
      return;
    }
    if (
      preview.snapshotSha256 !== activeWorkspace.snapshot.snapshotSha256 ||
      preview.watchlistVersion !== activeWorkspace.version
    ) {
      setReconciliationPreview(null);
      setWatchlistMessage(
        "The watchlist or security snapshot changed. Run reconciliation again; no changes were saved.",
      );
      return;
    }

    const epoch = workspaceEpoch.current;
    watchlistView.current.reconciling = true;
    watchlistView.current.generation += 1;
    setReconciling(true);
    try {
      await persistWatchlist(
        Object.freeze({
          ...activeWorkspace.watchlist,
          snapshotSha256: preview.snapshotSha256,
          memberships: preview.matched,
        }),
        reconciliationSuccessMessage(preview.matched.length, preview.unmatched),
      );
    } finally {
      if (epoch === workspaceEpoch.current) setReconciling(false);
    }
  }

  function retainNoteDrafts(
    memberships: readonly PersonalWatchlistMembership[],
  ) {
    const identities = new Map(
      memberships.map((membership) => [
        membership.listingId,
        companyResearchIdentityKey(membership),
      ]),
    );
    const drafts = Object.entries(currentNoteDrafts.current);
    const retained = drafts.filter(
      ([listingId, draft]) => identities.get(listingId) === draft.identityKey,
    );
    if (retained.length !== drafts.length) {
      replaceNoteDrafts(Object.fromEntries(retained));
      setNoteDraftNotice(
        "Unsaved research notes for removed or changed companies were discarded.",
      );
    }
  }

  const savedListingIds = new Set(
    workspace?.watchlist.memberships.map(
      (membership) => membership.listingId,
    ) ?? [],
  );
  const snapshotChanged =
    workspace !== null && !hasCurrentWatchlistSnapshot(workspace);
  const companyNoteMembership =
    companyIdentityKey === null
      ? undefined
      : workspace?.watchlist.memberships.find(
          (membership) =>
            companyResearchIdentityKey(membership) === companyIdentityKey,
        );
  const manualPeerCandidates = collectManualPeerCandidates(
    results,
    workspace !== null &&
      workspace.watchlistAvailable &&
      hasCurrentWatchlistSnapshot(workspace)
      ? workspace.watchlist.memberships
      : [],
    marketSelection,
    manualPeers,
  );

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to security discovery
      </a>
      <header className="app-header personal-app-header">
        <Link className="wordmark" href="/discover">
          <span>RC</span> Research Cockpit
        </Link>
        {workspace !== null && (
          <nav aria-label="Workspace sections" className="watchlist-jump">
            <a href="#watchlist-title">My Watchlist</a>
          </nav>
        )}
        <div className="mode-chips" aria-label="Data mode">
          <span className="personal-dossier-chip">Personal · local only</span>
        </div>
      </header>
      <div className="personal-disclosure" role="note">
        <strong>Personal workspace.</strong> Search and watchlists stay on this
        machine. No browser storage or synthetic fallback is used.
      </div>
      <main className="research-shell discovery-shell" id="main-content">
        {authMode === "local" ? (
          <LocalWorkspaceAccessPanel
            invalidationKey={localAccessInvalidation}
            onActivityHandlerChange={handleOwnerActivityChange}
            onSessionChange={handleOwnerSessionChange}
          />
        ) : (
          <OwnerSessionPanel
            authMode={authMode}
            onActivityHandlerChange={handleOwnerActivityChange}
            onSessionChange={handleOwnerSessionChange}
          />
        )}
        {workspace === null ? (
          <section className="personal-locked-state" aria-live="polite">
            <p className="eyebrow">
              {authMode === "local"
                ? "Local connection"
                : "Security discovery locked"}
            </p>
            <h1>
              {authMode === "local"
                ? "Connect to the local workspace to search companies."
                : authMode === "account"
                  ? "Sign in to search companies."
                  : "Start or revalidate the owner session to search companies."}
            </h1>
            <p>
              {workspaceMessage ??
                (authMode === "local"
                  ? "Your local universe and watchlist load after the API confirms local access."
                  : "Your local universe and durable watchlist load only after owner access is confirmed.")}
            </p>
          </section>
        ) : (
          <>
            <section
              className="discovery-hero"
              aria-labelledby="discover-title"
            >
              <div>
                <p className="eyebrow">Discover</p>
                <h1 id="discover-title">
                  Find a company. Keep the ones that matter.
                </h1>
                <p>
                  Search{" "}
                  {formatCount(
                    workspace.snapshot.coverage.activeEligibleSecurities,
                  )}{" "}
                  active U.S.-listed stocks and ADRs in your admitted local
                  snapshot.
                </p>
              </div>
              <dl className="discovery-snapshot-card">
                <div>
                  <dt>Universe</dt>
                  <dd>
                    {formatCount(
                      workspace.snapshot.coverage.activeEligibleSecurities,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>As of</dt>
                  <dd>{formatDate(workspace.snapshot.asOf)}</dd>
                </div>
              </dl>
            </section>

            <section
              className="security-search-panel"
              aria-labelledby="search-title"
            >
              <div className="discovery-section-heading">
                <div>
                  <p className="eyebrow">Local security search</p>
                  <h2 id="search-title">Ticker or company name</h2>
                </div>
                <span>Symbols, former symbols, and names</span>
              </div>
              <form
                className="security-search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runSearch();
                }}
              >
                <label htmlFor="security-query">Search securities</label>
                <div>
                  <input
                    autoComplete="off"
                    id="security-query"
                    maxLength={128}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Try a ticker or company name"
                    spellCheck={false}
                    value={query}
                  />
                  <button
                    className="primary-action compact-action"
                    disabled={searchState === "loading"}
                    type="submit"
                  >
                    {searchState === "loading" ? "Searching…" : "Search"}
                  </button>
                </div>
              </form>
              <p className="discovery-status" aria-live="polite">
                {searchMessage ??
                  "Search stays inside the loaded local snapshot."}
              </p>
              {results.length > 0 && (
                <ul
                  className="security-result-list"
                  aria-label="Security search results"
                >
                  {results.map((result) => {
                    const saved = savedListingIds.has(result.listingId);
                    return (
                      <li key={result.listingId}>
                        <SecurityIdentity membership={result} />
                        <div className="security-result-actions">
                          <button
                            className="secondary-action compact-action"
                            onClick={() =>
                              selectMarketSecurity(result, "search", result)
                            }
                            type="button"
                          >
                            View market
                          </button>
                          <button
                            className="secondary-action compact-action"
                            onClick={() => selectPortfolioSecurity(result)}
                            type="button"
                          >
                            Choose holding
                          </button>
                          <button
                            className="secondary-action compact-action"
                            disabled={
                              saved ||
                              !workspace.watchlistAvailable ||
                              watchlistState === "saving" ||
                              reconciling ||
                              snapshotChanged
                            }
                            onClick={() => addResult(result)}
                            type="button"
                          >
                            {saved ? "In watchlist" : "Add"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {hasSearched &&
                results.length === 0 &&
                searchState !== "loading" && (
                  <div className="discovery-empty-state">
                    <strong>No results to show</strong>
                    <span>Try a shorter ticker or a broader company name.</span>
                  </div>
                )}
            </section>

            <PersonalStockScreener
              key={workspace.snapshot.snapshotSha256}
              canAddToWatchlist={
                workspace.watchlistAvailable &&
                watchlistState !== "saving" &&
                !reconciling &&
                !snapshotChanged
              }
              onAddToWatchlist={addResult}
              onOpenResearch={(selection) =>
                selectMarketSecurity(selection, "catalog", selection)
              }
              onSessionUnavailable={clearWorkspaceForSessionLoss}
              savedListingIds={savedListingIds}
              snapshot={workspace.snapshot}
            />

            <PersonalFinancialScreener
              key={`financial-${workspace.snapshot.snapshotSha256}-${renderedWorkspaceEpoch}`}
              marketDataStatus={marketDataStatus}
              watchlistVersion={workspace.version}
              watchlistMemberships={workspace.watchlist.memberships}
              watchlistAvailable={
                workspace.watchlistAvailable &&
                !snapshotChanged &&
                watchlistState !== "saving" &&
                !reconciling
              }
              onActivityStart={handleFinancialActivityStart}
              canAddToWatchlist={
                workspace.watchlistAvailable &&
                watchlistState !== "saving" &&
                !reconciling &&
                !snapshotChanged
              }
              onAddToWatchlist={addResult}
              onOpenResearch={(selection) =>
                selectMarketSecurity(selection, "financials", selection)
              }
              onSessionUnavailable={clearWorkspaceForSessionLoss}
              savedListingIds={savedListingIds}
              snapshot={workspace.snapshot}
            />

            <PersonalPortfolio
              catalogSnapshotSha256={workspace.snapshot.snapshotSha256}
              enabled
              selectedListing={portfolioSelection}
              onOpenResearch={(selection) =>
                selectMarketSecurity(selection, "portfolio")
              }
              onSessionUnavailable={clearWorkspaceForSessionLoss}
            />

            <PersonalCompanyResearchWorkspace
              key={`${companyIdentityKey ?? "no-selection"}:${renderedCompanyEpoch}`}
              selection={marketSelection}
              activeSection={companySection}
              onSectionChange={(section) =>
                withCurrentCompany(() => {
                  companyNavigationEpoch.current += 1;
                  setCompanySection(section);
                })
              }
              backLabel={COMPANY_RESEARCH_ORIGINS[companyOrigin].label}
              onBack={returnFromCompany}
              onClear={clearSelectedCompany}
              navigationDescriptionId={
                researchCohort === null
                  ? undefined
                  : "company-research-navigation-status"
              }
              navigation={
                researchCohort === null ? undefined : (
                  <PersonalCompanyResearchNavigation
                    position={researchCohort.index + 1}
                    total={researchCohort.identities.length}
                    disabled={!isCurrentResearchCohort()}
                    invalidated={researchCohort.invalidated}
                    onPrevious={() => moveResearchCompany(-1)}
                    onNext={() => moveResearchCompany(1)}
                  />
                )
              }
              researchNote={
                <>
                  <PersonalCompanyWatchlistAction
                    saved={companyNoteMembership !== undefined}
                    pending={
                      companyWatchlistFeedback?.candidate ===
                        companyWatchlistCandidate &&
                      companyWatchlistFeedback?.pending === true
                    }
                    disabled={watchlistState === "saving" || reconciling}
                    unavailableReason={companyWatchlistUnavailableReason()}
                    message={
                      companyWatchlistFeedback?.candidate ===
                      companyWatchlistCandidate
                        ? (companyWatchlistFeedback?.message ?? null)
                        : null
                    }
                    onAdd={() => void addResearchedCompany()}
                  />
                  {companyNoteMembership !== undefined && (
                    <PersonalCompanyResearchNote
                      value={noteValue(companyNoteMembership)}
                      disabled={
                        !workspace.watchlistAvailable ||
                        snapshotChanged ||
                        watchlistState === "saving" ||
                        reconciling
                      }
                      message={
                        !workspace.watchlistAvailable
                          ? "My Watchlist is unavailable. Research notes cannot be edited right now."
                          : snapshotChanged
                            ? "Reconcile My Watchlist with the current catalog before editing this note."
                            : noteFeedback?.identityKey === companyIdentityKey
                              ? noteFeedback.message
                              : null
                      }
                      onChange={(value) =>
                        withCurrentCompany(() =>
                          editNote(companyNoteMembership, value),
                        )
                      }
                      onSave={() =>
                        withCurrentCompany(
                          () => void saveNote(companyNoteMembership),
                        )
                      }
                    />
                  )}
                </>
              }
              sections={{
                price: (
                  <>
                    <PersonalMarketOverview
                      adjustmentMode={marketAdjustmentMode}
                      errorCode={marketErrorCode}
                      onAdjustmentModeChange={(mode) =>
                        withCurrentCompany(() => setMarketAdjustmentMode(mode))
                      }
                      onClear={clearSelectedCompany}
                      onLoad={(range) =>
                        withCurrentCompany(() => void loadMarketData(range))
                      }
                      overview={marketOverview}
                      providerStatus={marketDataStatus}
                      range={marketRange}
                      requestState={marketRequestState}
                      selection={marketSelection}
                    />
                  </>
                ),
                financials: (
                  <>
                    <PersonalAnnualFinancials
                      errorCode={annualFinancialsErrorCode}
                      financials={annualFinancials}
                      onLoad={() =>
                        withCurrentCompany(() => void loadAnnualFinancials())
                      }
                      providerStatus={marketDataStatus}
                      requestState={annualFinancialsRequestState}
                      selection={marketSelection}
                    />
                    <PersonalQuarterlyFinancials
                      errorCode={quarterlyFinancialsErrorCode}
                      financials={quarterlyFinancials}
                      onLoad={() =>
                        withCurrentCompany(() => void loadQuarterlyFinancials())
                      }
                      providerStatus={marketDataStatus}
                      requestState={quarterlyFinancialsRequestState}
                      selection={marketSelection}
                    />
                    <PersonalFinancialQualityScorecard
                      financials={annualFinancials}
                      selection={marketSelection}
                    />
                  </>
                ),
                valuation: (
                  <>
                    <PersonalValuationHistory
                      errorCode={valuationHistoryErrorCode}
                      history={valuationHistory}
                      metric={valuationHistoryMetric}
                      onLoad={() =>
                        withCurrentCompany(() => void loadValuationHistory())
                      }
                      onMetricChange={(metric) =>
                        withCurrentCompany(() =>
                          setValuationHistoryMetric(metric),
                        )
                      }
                      providerStatus={marketDataStatus}
                      range={marketRange}
                      requestState={valuationHistoryRequestState}
                      selection={marketSelection}
                    />
                    <PersonalHistoricalMultipleValuation
                      marketOverview={marketOverview}
                      metric={historicalMultipleMetric}
                      onMetricChange={(metric) =>
                        withCurrentCompany(() =>
                          setHistoricalMultipleMetric(metric),
                        )
                      }
                      selection={marketSelection}
                      valuationHistory={valuationHistory}
                    />
                    <PersonalFcffDcfValuation
                      key={companyIdentityKey ?? "no-selection"}
                      annualFinancials={annualFinancials}
                      marketOverview={marketOverview}
                      selection={marketSelection}
                      valuationHistory={valuationHistory}
                    />
                  </>
                ),
                peers: (
                  <>
                    <PersonalManualPeerComparison
                      annualFinancials={annualFinancials}
                      candidates={manualPeerCandidates}
                      onAddPeer={(peer) =>
                        withCurrentCompany(() => addManualPeer(peer))
                      }
                      onLoadPeerData={(listingId) =>
                        withCurrentCompany(
                          () => void loadManualPeerData(listingId),
                        )
                      }
                      onRemovePeer={(listingId) =>
                        withCurrentCompany(() => removeManualPeer(listingId))
                      }
                      peers={manualPeers}
                      providerStatus={marketDataStatus}
                      range={marketRange}
                      selection={marketSelection}
                      valuationHistory={valuationHistory}
                    />
                  </>
                ),
                sec: (
                  <>
                    <PersonalSecQuarterlyEvidence
                      catalogSnapshotSha256={workspace.snapshot.snapshotSha256}
                      selection={marketSelection}
                      enabled
                      onSessionUnavailable={() =>
                        withCurrentCompany(clearWorkspaceForSessionLoss)
                      }
                    />
                  </>
                ),
              }}
            />

            <PersonalWatchlistFilings
              catalogSnapshotSha256={workspace.snapshot.snapshotSha256}
              watchlistVersion={workspace.version}
              memberships={workspace.watchlist.memberships}
              enabled={
                workspace.watchlistAvailable &&
                workspace.version > 0 &&
                !snapshotChanged &&
                watchlistState !== "saving" &&
                !reconciling
              }
              onOpenResearch={(selection) =>
                selectMarketSecurity(selection, "filings")
              }
              onSessionUnavailable={clearWorkspaceForSessionLoss}
            />

            <section
              className="watchlist-panel"
              aria-labelledby="watchlist-title"
            >
              <div className="discovery-section-heading">
                <div>
                  <p className="eyebrow">Durable local list</p>
                  <h2 id="watchlist-title" tabIndex={-1}>
                    {workspace.watchlist.name}
                  </h2>
                </div>
                <span>
                  {String(workspace.watchlist.memberships.length)} saved securit
                  {workspace.watchlist.memberships.length === 1 ? "y" : "ies"}
                </span>
              </div>
              {noteDraftNotice !== null && (
                <p className="discovery-warning" role="alert">
                  {noteDraftNotice}
                </p>
              )}
              {snapshotChanged && (
                <div className="discovery-warning" role="alert">
                  <p>
                    This watchlist was saved against an older security snapshot.
                    All changes are paused. Reconcile re-resolves every saved
                    listing against the current snapshot and preserves notes and
                    order for matches. If anything is unmatched, the first pass
                    saves nothing and shows a preview that requires a separate
                    removal confirmation.
                  </p>
                  {reconciliationPreview === null ? (
                    <button
                      className="secondary-action compact-action snapshot-reconciliation-action"
                      disabled={reconciling || watchlistState === "saving"}
                      onClick={() => void reconcileStaleWatchlist()}
                      type="button"
                    >
                      {reconciling ? "Reconciling…" : "Reconcile watchlist"}
                    </button>
                  ) : (
                    <div className="snapshot-reconciliation-preview">
                      <strong>Preview only — no changes were saved.</strong>
                      <span>Unmatched saved symbols:</span>
                      <ul>
                        {reconciliationPreview.unmatched.map((membership) => (
                          <li key={membership.listingId}>
                            {membership.symbol}
                          </li>
                        ))}
                      </ul>
                      <div>
                        <button
                          className="secondary-action compact-action snapshot-reconciliation-action"
                          disabled={reconciling || watchlistState === "saving"}
                          onClick={() =>
                            void finishReconciliationWithRemovals()
                          }
                          type="button"
                        >
                          {reconciling
                            ? "Finishing reconciliation…"
                            : `Remove ${String(reconciliationPreview.unmatched.length)} unmatched and finish reconciliation`}
                        </button>
                        <button
                          className="text-button"
                          disabled={reconciling || watchlistState === "saving"}
                          onClick={() => {
                            setReconciliationPreview(null);
                            setWatchlistMessage(
                              "Reconciliation preview cancelled. No changes were saved.",
                            );
                          }}
                          type="button"
                        >
                          Cancel preview
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!workspace.watchlistAvailable && (
                <p className="discovery-warning" role="alert">
                  My Watchlist could not be loaded. Security search is still
                  available, but watchlist changes are disabled.
                </p>
              )}
              <p className="discovery-status" aria-live="polite">
                {!workspace.watchlistAvailable
                  ? "My Watchlist is read-only until its saved record can be loaded."
                  : reconciling
                    ? "Re-resolving saved listings against the current local snapshot…"
                    : watchlistState === "saving"
                      ? "Saving to the encrypted local vault…"
                      : (watchlistMessage ??
                        "Changes survive browser and API restarts.")}
              </p>
              {workspace.watchlistAvailable &&
                workspace.watchlist.memberships.length > 0 && (
                  <div className="watchlist-navigation">
                    <label htmlFor="watchlist-filter">
                      Filter My Watchlist by ticker or company
                    </label>
                    <input
                      id="watchlist-filter"
                      maxLength={128}
                      onChange={(event) =>
                        changeWatchlistQuery(event.target.value)
                      }
                      type="search"
                      value={watchlistQuery}
                    />
                    <p aria-live="polite" className="watchlist-match-count">
                      {String(matchingWatchlistRows.length)} matching of{" "}
                      {String(workspace.watchlist.memberships.length)} saved
                      securities.
                    </p>
                    {normalizedWatchlistQuery !== "" && (
                      <p id="watchlist-reorder-guidance">
                        Clear the filter to reorder My Watchlist.
                      </p>
                    )}
                    {matchingWatchlistRows.length > 0 && (
                      <nav
                        aria-label="My Watchlist pages"
                        className="watchlist-pagination"
                      >
                        <button
                          className="secondary-action compact-action"
                          disabled={currentWatchlistPage === 0}
                          onClick={() => changeWatchlistPage(-1)}
                          type="button"
                        >
                          Previous watchlist page
                        </button>
                        <span aria-live="polite">
                          Page {String(currentWatchlistPage + 1)} of{" "}
                          {String(watchlistPageCount)}
                        </span>
                        <button
                          className="secondary-action compact-action"
                          disabled={
                            currentWatchlistPage === watchlistPageCount - 1
                          }
                          onClick={() => changeWatchlistPage(1)}
                          type="button"
                        >
                          Next watchlist page
                        </button>
                      </nav>
                    )}
                  </div>
                )}
              {!workspace.watchlistAvailable ? (
                <div className="discovery-empty-state watchlist-empty-state">
                  <strong>My Watchlist is unavailable.</strong>
                  <span>
                    Search is ready. Revalidate the owner session before saving
                    watchlist changes.
                  </span>
                </div>
              ) : workspace.watchlist.memberships.length === 0 ? (
                <div className="discovery-empty-state watchlist-empty-state">
                  <strong>Your watchlist is empty.</strong>
                  <span>
                    Search above and add the first company you want to follow.
                  </span>
                </div>
              ) : matchingWatchlistRows.length === 0 ? (
                <div className="discovery-empty-state watchlist-empty-state">
                  <strong>No saved companies match this filter.</strong>
                  <span>
                    Change or clear the filter to see your saved list.
                  </span>
                </div>
              ) : (
                <ol className="watchlist-members">
                  {visibleWatchlistRows.map((row) => {
                    const { membership, absoluteIndex: index } = row;
                    return (
                      <li key={membership.listingId}>
                        <div className="watchlist-member-heading">
                          <span className="watchlist-position">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <SecurityIdentity membership={membership} />
                          <div className="watchlist-actions">
                            <button
                              aria-label={`Research ${membership.symbol}`}
                              disabled={
                                !workspace.watchlistAvailable ||
                                snapshotChanged ||
                                watchlistState === "saving" ||
                                reconciling
                              }
                              onClick={() =>
                                withCurrentWatchlistRow(row, () =>
                                  selectMarketSecurity(membership, "watchlist"),
                                )
                              }
                              type="button"
                            >
                              Research
                            </button>
                            <button
                              aria-label={`Choose ${membership.symbol} for portfolio`}
                              disabled={
                                snapshotChanged ||
                                reconciling ||
                                watchlistState === "saving"
                              }
                              onClick={() =>
                                withCurrentWatchlistRow(row, () =>
                                  selectPortfolioSecurity(membership),
                                )
                              }
                              type="button"
                            >
                              Choose holding
                            </button>
                            <button
                              aria-label={`Move ${membership.symbol} up`}
                              aria-describedby={
                                normalizedWatchlistQuery !== ""
                                  ? "watchlist-reorder-guidance"
                                  : undefined
                              }
                              disabled={
                                !workspace.watchlistAvailable ||
                                snapshotChanged ||
                                index === 0 ||
                                normalizedWatchlistQuery !== "" ||
                                watchlistState === "saving" ||
                                reconciling
                              }
                              onClick={() =>
                                withCurrentWatchlistRow(row, () => {
                                  if (normalizedWatchlistQuery === "")
                                    moveMembership(index, -1);
                                })
                              }
                              type="button"
                            >
                              ↑
                            </button>
                            <button
                              aria-label={`Move ${membership.symbol} down`}
                              aria-describedby={
                                normalizedWatchlistQuery !== ""
                                  ? "watchlist-reorder-guidance"
                                  : undefined
                              }
                              disabled={
                                !workspace.watchlistAvailable ||
                                snapshotChanged ||
                                index ===
                                  workspace.watchlist.memberships.length - 1 ||
                                normalizedWatchlistQuery !== "" ||
                                watchlistState === "saving" ||
                                reconciling
                              }
                              onClick={() =>
                                withCurrentWatchlistRow(row, () => {
                                  if (normalizedWatchlistQuery === "")
                                    moveMembership(index, 1);
                                })
                              }
                              type="button"
                            >
                              ↓
                            </button>
                            <button
                              className="watchlist-remove"
                              disabled={
                                !workspace.watchlistAvailable ||
                                snapshotChanged ||
                                watchlistState === "saving" ||
                                reconciling
                              }
                              onClick={() =>
                                withCurrentWatchlistRow(row, () =>
                                  removeMembership(membership),
                                )
                              }
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="watchlist-note-row">
                          <label htmlFor={`note-${membership.listingId}`}>
                            Research note
                          </label>
                          <textarea
                            id={`note-${membership.listingId}`}
                            disabled={
                              !workspace.watchlistAvailable ||
                              snapshotChanged ||
                              watchlistState === "saving" ||
                              reconciling
                            }
                            maxLength={2_000}
                            onChange={(event) => {
                              const value = event.target.value;
                              withCurrentWatchlistRow(row, () =>
                                editNote(membership, value),
                              );
                            }}
                            placeholder="Why is this company on the list?"
                            rows={2}
                            value={noteValue(membership)}
                          />
                          <button
                            className="text-button"
                            disabled={
                              !workspace.watchlistAvailable ||
                              snapshotChanged ||
                              watchlistState === "saving" ||
                              reconciling
                            }
                            onClick={() =>
                              withCurrentWatchlistRow(
                                row,
                                () => void saveNote(membership),
                              )
                            }
                            type="button"
                          >
                            Save note
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
      <footer className="app-footer">
        <span>Research Cockpit · personal security discovery</span>
        <span>Owner-only · durable local watchlist</span>
        <code>private no-store</code>
      </footer>
    </>
  );
}

function companyResearchIdentityKey(
  identity: PersonalPortfolioIdentity,
): string {
  return JSON.stringify([
    identity.country,
    identity.exchangeMic,
    identity.instrumentType,
    identity.issuerId,
    identity.issuerName,
    identity.listingId,
    identity.securityId,
    identity.securityName,
    identity.shareClassId,
    identity.shareClassName,
    identity.symbol,
  ]);
}

function cohortMatchesWorkspace(
  cohort: WatchlistResearchCohort,
  workspace: LoadedWorkspace,
): boolean {
  return (
    workspace.watchlistAvailable &&
    hasCurrentWatchlistSnapshot(workspace) &&
    cohort.snapshotSha256 === workspace.snapshot.snapshotSha256 &&
    cohort.allIdentities.length === workspace.watchlist.memberships.length &&
    workspace.watchlist.memberships.every(
      (member, index) =>
        companyResearchIdentityKey(member) === cohort.allIdentities[index],
    )
  );
}

function normalizeWatchlistQuery(query: string): string {
  return query.trim().normalize("NFC").toLocaleLowerCase("en-US");
}

function matchesWatchlistQuery(
  membership: PersonalWatchlistMembership,
  query: string,
): boolean {
  return `${membership.symbol} ${membership.issuerName}`
    .normalize("NFC")
    .toLocaleLowerCase("en-US")
    .includes(query);
}

function isVisibleFocusTarget(
  target: HTMLElement | null,
): target is HTMLElement {
  return (
    target !== null &&
    target.isConnected &&
    target.closest("[hidden], [inert]") === null &&
    !target.matches(":disabled") &&
    target.getClientRects().length > 0
  );
}

function focusCompanyOrigin(origin: CompanyOriginTarget) {
  const target =
    (origin.isCurrent?.() ?? true) && isVisibleFocusTarget(origin.trigger)
      ? origin.trigger
      : document.getElementById(origin.headingId);
  focusCompanyTarget(target);
}

function focusCompanyTarget(target: HTMLElement | null) {
  if (!isVisibleFocusTarget(target)) return;
  if (
    !target.hasAttribute("tabindex") &&
    !target.matches("button, input, select, textarea, a[href]")
  ) {
    target.tabIndex = -1;
  }
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
}

function collectManualPeerCandidates(
  searchResults: readonly PersonalSecurityMasterSearchResultDto[],
  watchlist: readonly PersonalWatchlistMembership[],
  selection: PersonalManualPeerSelection | null,
  peers: readonly PersonalManualPeerState[],
): readonly PersonalManualPeerSelection[] {
  if (selection === null) return Object.freeze([]);
  const excludedListings = new Set([
    selection.listingId,
    ...peers.map((peer) => peer.selection.listingId),
  ]);
  const excludedIssuers = new Set([
    selection.issuerId,
    ...peers.map((peer) => peer.selection.issuerId),
  ]);
  const candidates = new Map<string, PersonalManualPeerSelection>();
  const candidateIssuerIds = new Set<string>();
  for (const source of [...searchResults, ...watchlist]) {
    if (candidates.size >= MANUAL_PEER_PICKER_MAXIMUM_CANDIDATES) break;
    if (
      excludedListings.has(source.listingId) ||
      excludedIssuers.has(source.issuerId) ||
      candidates.has(source.listingId) ||
      candidateIssuerIds.has(source.issuerId)
    ) {
      continue;
    }
    candidates.set(
      source.listingId,
      Object.freeze({
        country: source.country,
        exchangeMic: source.exchangeMic,
        issuerId: source.issuerId,
        issuerName: source.issuerName,
        listingId: source.listingId,
        securityName: source.securityName,
        symbol: source.symbol,
      }),
    );
    candidateIssuerIds.add(source.issuerId);
  }
  return Object.freeze([...candidates.values()]);
}

function sameManualPeerSelection(
  left: PersonalManualPeerSelection,
  right: PersonalManualPeerSelection,
): boolean {
  return (
    left.country === right.country &&
    left.exchangeMic === right.exchangeMic &&
    left.issuerId === right.issuerId &&
    left.issuerName === right.issuerName &&
    left.listingId === right.listingId &&
    left.securityName === right.securityName &&
    left.symbol === right.symbol
  );
}

function updateManualPeer(
  peers: readonly PersonalManualPeerState[],
  listingId: string,
  update: (peer: PersonalManualPeerState) => PersonalManualPeerState,
): readonly PersonalManualPeerState[] {
  return Object.freeze(
    peers.map((peer) =>
      peer.selection.listingId === listingId
        ? Object.freeze(update(peer))
        : peer,
    ),
  );
}

function personalRequestErrorCode(
  error: unknown,
): PersonalWorkspaceApiErrorCode {
  return error instanceof PersonalWorkspaceApiError
    ? error.code
    : "unavailable";
}

function SecurityIdentity({
  membership,
}: {
  membership:
    | PersonalSecurityMasterSearchResultDto
    | PersonalSecurityMasterScreenRowDto
    | PersonalWatchlistMembership;
}) {
  return (
    <div className="security-identity">
      <strong>{membership.symbol}</strong>
      <div>
        <b>{membership.issuerName}</b>
        <span>
          {membership.securityName} · {membership.exchangeMic} ·{" "}
          {formatInstrumentType(membership.instrumentType)}
        </span>
      </div>
    </div>
  );
}

function hasCurrentWatchlistSnapshot(workspace: LoadedWorkspace): boolean {
  return (
    workspace.watchlist.snapshotSha256 === workspace.snapshot.snapshotSha256
  );
}

async function resolveCurrentMembership(
  membership: PersonalWatchlistMembership,
  expectedSnapshotSha256: string,
  signal: AbortSignal,
): Promise<PersonalWatchlistMembership | null> {
  const queries = reconciliationQueries(membership);
  for (const query of queries) {
    const response = await searchPersonalSecurities(query, signal, 25);
    if (response.snapshot.snapshotSha256 !== expectedSnapshotSha256) {
      throw new WorkspaceSnapshotChangedError();
    }
    const match = response.results.find(
      (candidate) => candidate.listingId === membership.listingId,
    );
    if (match !== undefined) {
      return Object.freeze({
        ...membershipFromSearchResult(match),
        note: membership.note,
      });
    }
  }
  return null;
}

function reconciliationQueries(
  membership: PersonalWatchlistMembership,
): readonly string[] {
  const queries = [
    membership.symbol,
    membership.issuerName,
    membership.securityName,
    membership.shareClassName,
  ];
  return [
    ...new Set(
      queries
        .map((query) => query.trim().normalize("NFC"))
        .filter((query) => query.length > 0 && [...query].length <= 128),
    ),
  ];
}

function reconciliationPreviewMessage(
  unmatched: readonly PersonalWatchlistMembership[],
): string {
  const symbols = unmatched.map((membership) => membership.symbol);
  const visibleSymbols = symbols.slice(0, 5).join(", ");
  const remainder =
    symbols.length > 5 ? ` and ${String(symbols.length - 5)} more` : "";
  return `Reconciliation preview: ${String(unmatched.length)} unmatched ${unmatched.length === 1 ? "entry" : "entries"} (${visibleSymbols}${remainder}). No changes were saved; confirm removal to finish.`;
}

function reconciliationSuccessMessage(
  retainedCount: number,
  removed: readonly PersonalWatchlistMembership[],
): string {
  if (removed.length === 0) {
    return `Watchlist reconciled to the current snapshot. ${String(retainedCount)} saved ${retainedCount === 1 ? "entry was" : "entries were"} retained; no entries were removed.`;
  }
  const symbols = removed.map((membership) => membership.symbol);
  const visibleSymbols = symbols.slice(0, 5).join(", ");
  const remainder =
    symbols.length > 5 ? ` and ${String(symbols.length - 5)} more` : "";
  return `Watchlist reconciled to the current snapshot. ${String(retainedCount)} ${retainedCount === 1 ? "entry was" : "entries were"} retained; ${String(removed.length)} unmatched ${removed.length === 1 ? "entry was" : "entries were"} removed (${visibleSymbols}${remainder}).`;
}

function isSessionUnavailable(error: unknown): boolean {
  return (
    error instanceof PersonalWorkspaceApiError &&
    error.code === "session_unavailable"
  );
}

function withMemberships(
  watchlist: PersonalWatchlistPayload,
  memberships: readonly PersonalWatchlistMembership[],
): PersonalWatchlistPayload {
  return Object.freeze({
    ...watchlist,
    memberships: Object.freeze(memberships),
  });
}

function portfolioIdentity(
  value: PersonalPortfolioIdentity,
): PersonalPortfolioIdentity {
  return Object.freeze({
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
  });
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatInstrumentType(value: "adr" | "common_stock"): string {
  return value === "adr" ? "ADR" : "Common stock";
}
