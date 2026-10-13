import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  encodeMainWatchlistPayload,
  isMainWatchlistPayload,
  MANAGED_CATALOG_RESOLVE_LIMITS,
  MANAGED_WATCHLIST_LIMITS,
  membershipMatchesResult,
  normalizeWatchlistNote,
  parseManagedCatalogResolveResponse,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
  type ManagedCatalogResolveResponse,
  type ManagedEodCloseDto,
  type ManagedEodHistoryResponseDto,
  type ManagedEodIdentity,
  type ManagedSecFilingsResponseDto,
  type PersonalSecRecentFilingDto,
  type PersonalSecAnnualEvidenceResponseDto,
  type PersonalSecAnnualPairDto,
  type PersonalSecurityMasterSearchResultDto,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import { ManagedCatalogChangedError, type ManagedApi } from "./managed-api";
import {
  ManagedAnnualReport,
  type ManagedAnnualReportSeed,
} from "./managed-annual-report";
import {
  ManagedWatchlistAnnualComparison,
  type ManagedAnnualComparisonReportCapture,
  type ManagedWatchlistAnnualComparisonMember,
} from "./managed-watchlist-annual-comparison";
import {
  getAnnualComparisonNoteEvidence,
  type AnnualComparisonNoteCapture,
} from "./managed-watchlist-annual-comparison-note";
import {
  ManagedEodHistory,
  type ManagedEodHistorySeed,
} from "./managed-eod-history";
import { annualNoteExcerpt } from "./managed-annual-note";
import { annualCashNoteExcerpt } from "./managed-annual-cash-note";
import { annualLiquidityNoteExcerpt } from "./managed-annual-liquidity-note";
import { priceComparisonNoteExcerpt } from "./managed-price-note";
import { getManagedWatchlistComparisonNoteEvidence } from "./managed-watchlist-comparison-note";
import type { ManagedWatchlistComparisonSelection } from "./managed-watchlist-comparison";
import { filingReferenceNoteExcerpt } from "./managed-filings-note";
import {
  ManagedCompanyFilings,
  type ManagedCompanyFilingsSeed,
} from "./managed-company-filings";
import {
  ManagedWatchlistFilings,
  type ManagedWatchlistFilingsCapture,
} from "./managed-watchlist-filings";
import { ManagedSecAccess } from "./managed-sec-access";
import { ManagedEodAccess } from "./managed-eod-access";
import { ManagedMarkets } from "./managed-markets";
import {
  ManagedWatchlistPrices,
  type ManagedWatchlistPriceHandle,
} from "./managed-watchlist-prices";
import { ManagedFedAnnouncements } from "./managed-fed-announcements";
import { ManagedBeaReleaseAgenda } from "./managed-bea-release-agenda";
import { SaveCoordinator } from "./save-coordinator";
import {
  isManagedCompanyListingId,
  type ManagedCompanyRoute,
} from "./managed-company-route";
import type { TrialSession } from "./session";

type ResolvedListing = ManagedCatalogResolveResponse["results"][number];
export interface CatalogReview {
  readonly draft: MainWatchlistPayload;
  readonly snapshotSha256: string;
  readonly results: readonly ResolvedListing[];
}
export interface ManagedResearchVisit {
  readonly selection: ManagedResearchSelection;
  readonly section: "annual" | "eod" | "filings";
}
export interface ResearchWatchlistState {
  readonly member: WatchlistMembership | null;
  readonly canAdd: boolean;
  readonly canEdit: boolean;
  readonly reason: string | null;
}
export interface CompanyRouteState {
  readonly listingId: string;
  readonly section: "annual" | "eod" | "filings";
  readonly status:
    "waiting_catalog" | "resolving" | "unavailable" | "error" | "open";
  readonly message: string;
}
export interface ManagedDiscoveryState {
  readonly view: "markets" | "discover" | "watchlist";
  readonly query: string;
  readonly read: "status" | "search" | null;
  readonly reviewing: boolean;
  readonly snapshot: ManagedCatalogSnapshotDto | null;
  readonly results: readonly PersonalSecurityMasterSearchResultDto[];
  readonly totalMatches: number;
  readonly message: string;
  readonly review: CatalogReview | null;
  readonly research: ManagedResearchVisit | null;
  readonly companyRoute: CompanyRouteState | null;
}
const emptyDiscovery = (): ManagedDiscoveryState => ({
  view: "markets",
  query: "",
  read: null,
  reviewing: false,
  snapshot: null,
  results: [],
  totalMatches: 0,
  message: "",
  review: null,
  research: null,
  companyRoute: null,
});

interface DraftValidation {
  readonly payload: MainWatchlistPayload | null;
  readonly issue: string | null;
}
function capture(payload: MainWatchlistPayload): DraftValidation {
  const invalid = (issue: string): DraftValidation => ({
    payload: null,
    issue,
  });
  const base = { ...payload, memberships: [] };
  if (!isMainWatchlistPayload(base) || payload.memberships.length > 10_000)
    return invalid("Review the watchlist entries before saving.");
  const encoder = new TextEncoder();
  const baseBytes = encoder.encode(encodeMainWatchlistPayload(base)).byteLength;
  let bytes = baseBytes;
  const memberships: WatchlistMembership[] = [];
  for (const membership of payload.memberships) {
    const note = normalizeWatchlistNote(membership.note);
    if (note === null)
      return invalid(
        "Use at most 2,000 characters per note, without control characters.",
      );
    const normalized = { ...membership, note };
    const single = { ...payload, memberships: [normalized] };
    if (!isMainWatchlistPayload(single))
      return invalid("Review the watchlist entries before saving.");
    // Stop as soon as the canonical payload exceeds its budget. The empty
    // envelope is constant; each additional membership adds its JSON and comma.
    bytes +=
      encoder.encode(encodeMainWatchlistPayload(single)).byteLength -
      baseBytes +
      (memberships.length ? 1 : 0);
    if (bytes > MANAGED_WATCHLIST_LIMITS.payloadBytes)
      return invalid(
        "This watchlist is too large to save. Shorten notes or remove entries.",
      );
    memberships.push(normalized);
  }
  const normalized = { ...payload, memberships };
  if (!isMainWatchlistPayload(normalized))
    return invalid("Review the watchlist entries before saving.");
  const encoded = encodeMainWatchlistPayload(normalized);
  return { payload: JSON.parse(encoded) as MainWatchlistPayload, issue: null };
}

function listingIdentity(
  result: Omit<WatchlistMembership, "note">,
): Omit<WatchlistMembership, "note"> {
  return {
    country: result.country,
    exchangeMic: result.exchangeMic,
    instrumentType: result.instrumentType,
    issuerId: result.issuerId,
    issuerName: result.issuerName,
    listingId: result.listingId,
    securityId: result.securityId,
    securityName: result.securityName,
    shareClassId: result.shareClassId,
    shareClassName: result.shareClassName,
    symbol: result.symbol,
  };
}

export function listingMembership(
  result: PersonalSecurityMasterSearchResultDto,
): WatchlistMembership {
  return { ...listingIdentity(result), note: "" };
}

/** Owns catalog reads and company visits; the shared coordinator owns every save. */
export class ManagedWorkspace {
  readonly coordinator: SaveCoordinator<MainWatchlistPayload>;
  readonly annual: ManagedAnnualReport;
  readonly annualComparison: ManagedWatchlistAnnualComparison;
  readonly filings: ManagedCompanyFilings;
  readonly watchlistFilings: ManagedWatchlistFilings;
  private readonly secAccess = new ManagedSecAccess();
  readonly eod: ManagedEodHistory;
  readonly markets: ManagedMarkets;
  readonly watchlistPrices: ManagedWatchlistPrices;
  readonly agenda: ManagedBeaReleaseAgenda;
  readonly announcements: ManagedFedAnnouncements;
  private navigationBlocked = false;
  private state = emptyDiscovery();
  private readonly listeners = new Set<() => void>();
  private searchOperation: AbortController | null = null;
  private resolveOperation: AbortController | null = null;
  private companyRouteOperation: AbortController | null = null;
  private researchOperation = Symbol();
  private retired = false;
  private draft: MainWatchlistPayload | null = null;
  private validation: {
    draft: MainWatchlistPayload;
    digest: string | null;
    result: DraftValidation;
  } | null = null;

  constructor(
    private readonly api: ManagedApi,
    session: TrialSession,
    newKey?: () => string,
    options: {
      marketsCohort?: readonly ManagedEodIdentity[];
      priceCoverage?: readonly ManagedEodIdentity[];
    } = {},
  ) {
    this.coordinator = new SaveCoordinator<MainWatchlistPayload>(
      {
        mode: "managed",
        empty: () => null,
        copy: (payload) => structuredClone(payload),
        capture: (payload) => this.validateDraft(payload).payload,
        load: (signal) => api.load(signal),
        save: (command, signal) => api.save(command, signal),
      },
      session,
      { ...(newKey ? { newKey } : {}), onRetire: () => this.clear() },
    );
    this.annual = new ManagedAnnualReport(
      (request, signal) => api.annualReport(request, signal),
      (error) => this.coordinator.readError(error),
      this.secAccess,
    );
    this.annualComparison = new ManagedWatchlistAnnualComparison(
      (request, signal) => api.annualReport(request, signal),
      (error) => this.coordinator.readError(error),
      this.secAccess,
    );
    this.annualComparison.subscribe(() => {
      if (this.annualComparison.getSnapshot().catalogChanged)
        this.invalidateCatalog();
    });
    this.filings = new ManagedCompanyFilings(
      (request, signal) => api.recentFilings(request, signal),
      (error) => this.coordinator.readError(error),
      this.secAccess,
    );
    this.filings.subscribe(() => {
      if (this.filings.getSnapshot().catalogChanged) this.invalidateCatalog();
    });
    this.watchlistFilings = new ManagedWatchlistFilings(
      (request, signal) => api.recentFilings(request, signal),
      (error) => this.coordinator.readError(error),
      this.secAccess,
    );
    this.watchlistFilings.subscribe(() => {
      if (this.watchlistFilings.getSnapshot().catalogChanged)
        this.invalidateCatalog();
    });
    this.announcements = new ManagedFedAnnouncements(
      (signal) => api.monetaryAnnouncements(signal),
      (error) => this.coordinator.readError(error),
    );
    this.agenda = new ManagedBeaReleaseAgenda(
      (signal) => api.economicCalendar(signal),
      (error) => this.coordinator.readError(error),
    );
    const eodAccess = new ManagedEodAccess((request, signal) =>
      api.eodHistory(request, signal),
    );
    this.eod = new ManagedEodHistory(
      (request, signal) => api.eodHistory(request, signal),
      (error) => this.coordinator.readError(error),
      eodAccess,
      options.priceCoverage,
    );
    this.markets = new ManagedMarkets(
      api,
      eodAccess,
      (error) => this.coordinator.readError(error),
      () => this.invalidateCatalog(),
      options.marketsCohort,
    );
    this.watchlistPrices = new ManagedWatchlistPrices(
      (request, signal) => api.eodHistory(request, signal),
      (error) => this.coordinator.readError(error),
      eodAccess,
      options.priceCoverage,
    );
    this.watchlistPrices.subscribe(() => {
      if (this.watchlistPrices.getSnapshot().catalogChanged)
        this.invalidateCatalog();
    });
    this.annual.subscribe(() => {
      if (this.annual.getSnapshot().catalogChanged) this.invalidateCatalog();
    });
    this.eod.subscribe(() => {
      if (this.eod.getSnapshot().catalogChanged) this.invalidateCatalog();
    });
    this.coordinator.subscribe(() => {
      const saved = this.coordinator.getSnapshot();
      this.syncWatchlistPrices();
      this.syncAnnualComparison();
      this.syncWatchlistFilings();
      const selection = this.state.research?.selection;
      if (
        selection?.origin === "watchlist" &&
        !this.canSwitchResearch(selection)
      )
        this.closeResearch();
      if (
        this.draft !== saved.draft ||
        saved.uncertain ||
        saved.conflict ||
        saved.replayPending
      ) {
        this.draft = saved.draft;
        this.cancelReview();
      }
    });
  }
  getSnapshot = (): ManagedDiscoveryState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<ManagedDiscoveryState>) {
    this.state = { ...this.state, ...next };
    this.syncAnnouncements();
    this.syncWatchlistPrices();
    this.syncAnnualComparison();
    this.syncWatchlistFilings();
    for (const listener of this.listeners) listener();
  }
  setNavigationBlocked(blocked: boolean) {
    this.navigationBlocked = blocked;
    this.syncAnnouncements();
    this.syncAnnualComparison();
    this.syncWatchlistFilings();
  }
  private syncWatchlistFilings() {
    if (this.retired || this.state.view !== "watchlist") {
      this.watchlistFilings.leave();
      return;
    }
    this.watchlistFilings.reconcile(
      this.coordinator.getSnapshot().draft,
      this.state.snapshot?.snapshotSha256 ?? null,
      !this.navigationBlocked &&
        !this.state.research &&
        !this.state.companyRoute,
      this.canEdit(),
    );
  }
  selectWatchlistFilingsMember(member: WatchlistMembership | null) {
    if (
      this.retired ||
      this.navigationBlocked ||
      this.state.view !== "watchlist" ||
      this.state.research ||
      this.state.companyRoute
    )
      return;
    this.syncWatchlistFilings();
    const current = this.watchlistFilings.getSnapshot();
    if (member === null) {
      this.watchlistFilings.select(current, null);
      return;
    }
    if (!this.coordinator.getSnapshot().draft?.memberships.includes(member))
      return;
    const selected = current.memberships.find((entry) =>
      membershipMatchesResult(member, entry.listing),
    );
    if (selected) this.watchlistFilings.select(current, selected);
  }
  private syncAnnouncements() {
    if (
      this.retired ||
      this.navigationBlocked ||
      this.state.view !== "markets" ||
      this.state.research ||
      this.state.companyRoute
    )
      this.announcements.leave();
    else this.announcements.enter();
  }
  private syncAnnualComparison() {
    const active =
      !this.retired &&
      !this.navigationBlocked &&
      this.state.view === "watchlist" &&
      !this.state.research &&
      !this.state.companyRoute;
    this.annualComparison.reconcile(
      this.coordinator.getSnapshot().draft,
      this.state.snapshot?.snapshotSha256 ?? null,
      active,
      this.canEdit(),
    );
  }
  private syncWatchlistPrices() {
    if (this.retired || this.state.view !== "watchlist") {
      this.watchlistPrices.leave();
      return;
    }
    const draft = this.coordinator.getSnapshot().draft;
    const digest = this.state.snapshot?.snapshotSha256 ?? null;
    const canRead =
      this.canEdit() &&
      !this.state.research &&
      !this.state.companyRoute &&
      digest !== null &&
      draft?.snapshotSha256 === digest;
    this.watchlistPrices.enter(draft, digest, canRead);
  }
  loadWatchlistPrice(handle: ManagedWatchlistPriceHandle) {
    this.syncWatchlistPrices();
    return this.watchlistPrices.load(handle);
  }
  private clear() {
    this.retired = true;
    this.closeResearch();
    this.annual.retire();
    this.annualComparison.retire();
    this.filings.retire();
    this.watchlistFilings.retire();
    this.secAccess.retire();
    this.eod.retire();
    this.markets.retire();
    this.watchlistPrices.retire();
    this.agenda.retire();
    this.announcements.retire();
    this.searchOperation?.abort();
    this.resolveOperation?.abort();
    this.searchOperation = null;
    this.resolveOperation = null;
    this.draft = null;
    this.validation = null;
    this.state = emptyDiscovery();
    for (const listener of this.listeners) listener();
  }
  private cancelReview() {
    this.resolveOperation?.abort();
    this.resolveOperation = null;
    if (this.state.review || this.state.reviewing)
      this.update({ review: null, reviewing: false });
  }
  private catalogError(error: unknown, action: "status" | "search" | "review") {
    if (
      error instanceof TrialApiError &&
      ["unauthenticated", "access_denied", "origin_denied"].includes(error.code)
    ) {
      this.coordinator.readError(error);
      return;
    }
    let message = {
      status:
        "The catalog could not be loaded. Select Refresh catalog to try again.",
      search: "The search could not be completed. Select Search to try again.",
      review:
        "The catalog review could not be completed. Select Review catalog changes to try again.",
    }[action];
    if (error instanceof ManagedCatalogChangedError) {
      this.invalidateCatalog();
      message =
        "The catalog changed during review. Refresh the catalog and start the review again.";
    } else if (
      action === "search" &&
      error instanceof TrialApiError &&
      error.code === "invalid_request"
    )
      message = "Enter a company name or ticker of at most 128 characters.";
    this.update({ message });
  }
  setQuery(query: string) {
    if (this.retired) return;
    this.searchOperation?.abort();
    this.searchOperation = null;
    this.update({
      query,
      read: null,
      results: [],
      totalMatches: 0,
      message: "",
    });
  }
  setView(view: ManagedDiscoveryState["view"]) {
    if (this.retired) return;
    this.closeResearch();
    if (view === this.state.view) return;
    if (view === "markets") {
      this.markets.enter(this.state.snapshot?.snapshotSha256 ?? null);
      this.agenda.enter();
    } else {
      this.markets.leave();
      this.agenda.leave();
    }
    this.update({ view });
  }
  private invalidateCatalog() {
    if (this.retired || !this.state.snapshot) return;
    this.state = { ...this.state, snapshot: null };
    this.searchOperation?.abort();
    this.searchOperation = null;
    this.cancelReview();
    this.markets.leave();
    this.watchlistPrices.leave();
    this.watchlistFilings.leave();
    this.closeResearch();
    this.update({
      snapshot: null,
      results: [],
      totalMatches: 0,
      read: null,
      message:
        "The catalog changed. Refresh the catalog before requesting research again.",
    });
  }
  async refreshCatalog() {
    await this.readCatalog("status");
  }
  async search() {
    await this.readCatalog("search");
  }
  private async readCatalog(read: "status" | "search") {
    if (this.retired) return;
    this.searchOperation?.abort();
    const operation = new AbortController();
    this.searchOperation = operation;
    const query = this.state.query;
    this.update({ read, message: "", results: [], totalMatches: 0 });
    try {
      const matches =
        read === "search"
          ? await this.api.search(query, operation.signal)
          : null;
      const result = matches ?? (await this.api.status(operation.signal));
      if (
        this.retired ||
        this.searchOperation !== operation ||
        operation.signal.aborted
      )
        return;
      if (
        result.snapshot.snapshotSha256 !== this.state.snapshot?.snapshotSha256
      ) {
        const waitingRoute =
          this.state.snapshot === null &&
          this.state.companyRoute?.status === "waiting_catalog"
            ? this.state.companyRoute
            : null;
        this.cancelReview();
        this.clearResearch();
        if (waitingRoute)
          this.state = { ...this.state, companyRoute: waitingRoute };
      }
      this.update({
        snapshot: result.snapshot,
        ...(matches
          ? {
              results: matches.results,
              totalMatches: matches.totalMatches,
              message: matches.totalMatches
                ? `${matches.totalMatches} matching listings in this catalog.`
                : "No matching listings in this catalog.",
            }
          : {}),
      });
      if (this.state.view === "markets")
        this.markets.enter(result.snapshot.snapshotSha256);
      await this.resolveCompanyRoute();
    } catch (error) {
      if (
        !this.retired &&
        this.searchOperation === operation &&
        !operation.signal.aborted
      )
        this.catalogError(error, read);
    } finally {
      if (this.searchOperation === operation) {
        this.searchOperation = null;
        this.update({ read: null });
      }
    }
  }
  canEdit() {
    const saved = this.coordinator.getSnapshot();
    return (
      !this.retired &&
      this.coordinator.canEdit() &&
      !saved.conflict &&
      saved.draft !== null
    );
  }
  openDiscoveryAnnual(result: PersonalSecurityMasterSearchResultDto) {
    const snapshot = this.state.snapshot;
    if (this.retired || !snapshot || !this.state.results.includes(result))
      return;
    this.openResearch(
      {
        catalogSnapshotSha256: snapshot.snapshotSha256,
        listing: listingIdentity(result),
        cik: result.cik,
        origin: "discover",
      },
      "annual",
    );
  }
  canOpenWatchlistAnnual(member: WatchlistMembership) {
    const draft = this.coordinator.getSnapshot().draft;
    return (
      !this.retired &&
      this.state.snapshot !== null &&
      draft?.snapshotSha256 === this.state.snapshot.snapshotSha256 &&
      draft.memberships.includes(member)
    );
  }
  openWatchlistAnnual(member: WatchlistMembership) {
    if (!this.canOpenWatchlistAnnual(member) || !this.state.snapshot) return;
    this.openResearch(
      {
        catalogSnapshotSha256: this.state.snapshot.snapshotSha256,
        listing: listingIdentity(member),
        cik: null,
        origin: "watchlist",
      },
      "annual",
    );
  }
  private canOpenAnnualComparisonReport(
    capture: ManagedAnnualComparisonReportCapture,
  ) {
    const draft = this.coordinator.getSnapshot().draft;
    return (
      !this.retired &&
      !this.navigationBlocked &&
      this.state.view === "watchlist" &&
      !this.state.research &&
      !this.state.companyRoute &&
      this.state.snapshot !== null &&
      draft?.snapshotSha256 === this.state.snapshot.snapshotSha256 &&
      draft.memberships.some((member) =>
        membershipMatchesResult(member, capture.member.listing),
      ) &&
      this.annualComparison.canAdmitReport(capture)
    );
  }
  openAnnualComparisonReport(capture: ManagedAnnualComparisonReportCapture) {
    if (!this.canOpenAnnualComparisonReport(capture)) return;
    const handoff = this.annualComparison.admitReport(capture);
    if (!handoff || !this.canOpenAnnualComparisonReport(capture)) return;
    this.openResearch(handoff.selection, "annual", {
      annualSeed: handoff.seed,
      admit: () => this.canOpenAnnualComparisonReport(capture),
    });
  }
  private canOpenWatchlistFilings(capture: ManagedWatchlistFilingsCapture) {
    const draft = this.coordinator.getSnapshot().draft;
    return (
      !this.retired &&
      !this.navigationBlocked &&
      this.state.view === "watchlist" &&
      !this.state.research &&
      !this.state.companyRoute &&
      this.state.snapshot !== null &&
      draft?.snapshotSha256 === this.state.snapshot.snapshotSha256 &&
      draft.memberships.some((member) =>
        membershipMatchesResult(member, capture.member.listing),
      ) &&
      this.watchlistFilings.canAdmitFilings(capture)
    );
  }
  openWatchlistFilings(capture: ManagedWatchlistFilingsCapture) {
    if (!this.canOpenWatchlistFilings(capture)) return;
    const handoff = this.watchlistFilings.admitFilings(capture);
    if (!handoff || !this.canOpenWatchlistFilings(capture)) return;
    this.openResearch(handoff.selection, "filings", {
      filingsSeed: handoff.seed,
      admit: () => this.canOpenWatchlistFilings(capture),
    });
  }
  openDiscoveryEod(result: PersonalSecurityMasterSearchResultDto) {
    const snapshot = this.state.snapshot;
    if (this.retired || !snapshot || !this.state.results.includes(result))
      return;
    this.openResearch(
      {
        catalogSnapshotSha256: snapshot.snapshotSha256,
        listing: listingIdentity(result),
        cik: result.cik,
        origin: "discover",
      },
      "eod",
    );
  }
  canOpenWatchlistEod(member: WatchlistMembership) {
    return this.canOpenWatchlistAnnual(member);
  }
  openWatchlistEod(member: WatchlistMembership) {
    if (!this.canOpenWatchlistEod(member) || !this.state.snapshot) return;
    this.watchlistPrices.cancel();
    if (!this.canOpenWatchlistEod(member) || !this.state.snapshot) return;
    const row = this.watchlistPrices
      .getSnapshot()
      .rows.find((entry) => membershipMatchesResult(member, entry.listing));
    const seed = row
      ? (this.watchlistPrices.seed(row.handle) ?? undefined)
      : undefined;
    this.openResearch(
      {
        catalogSnapshotSha256: this.state.snapshot.snapshotSha256,
        listing: listingIdentity(member),
        cik: null,
        origin: "watchlist",
      },
      "eod",
      { priceSeed: seed },
    );
  }
  openMarketResearch(kind: "annual" | "eod" | "filings", listingId?: string) {
    const requested = this.markets.selection(listingId);
    if (
      this.retired ||
      this.state.view !== "markets" ||
      !requested ||
      requested.catalogSnapshotSha256 !== this.state.snapshot?.snapshotSha256
    )
      return;
    this.markets.cancel();
    // Cancellation settles previous-history status before the visit captures it.
    const selection = this.markets.selection(requested.listing.listingId);
    if (
      this.retired ||
      this.state.view !== "markets" ||
      !selection ||
      selection.catalogSnapshotSha256 !== this.state.snapshot?.snapshotSha256
    )
      return;
    const row = this.markets
      .getSnapshot()
      .rows.find(
        (entry) => entry.listing.listingId === selection.listing.listingId,
      );
    this.openResearch(selection, kind, {
      priceSeed: row?.response
        ? { response: row.response, showingPrevious: row.showingPrevious }
        : undefined,
    });
  }
  async setCompanyRoute(route: ManagedCompanyRoute | null) {
    if (this.retired) return;
    this.watchlistPrices.cancel();
    if (
      !route ||
      !isManagedCompanyListingId(route.listingId) ||
      (route.section !== "annual" &&
        route.section !== "eod" &&
        route.section !== "filings")
    ) {
      this.closeResearch();
      return;
    }
    const research = this.state.research;
    if (
      research?.selection.listing.listingId === route.listingId &&
      this.canSwitchResearch(research.selection)
    ) {
      this.switchResearch(route.section);
      if (this.state.research)
        this.update({
          companyRoute: {
            listingId: route.listingId,
            section: route.section,
            status: "open",
            message: "",
          },
        });
      return;
    }
    const pending = this.state.companyRoute;
    if (pending?.listingId === route.listingId && pending.status !== "open") {
      this.update({ companyRoute: { ...pending, section: route.section } });
      return;
    }
    this.clearResearch();
    this.markets.cancel();
    this.update({
      companyRoute: {
        listingId: route.listingId,
        section: route.section,
        status: "waiting_catalog",
        message: "Load the catalog to open this company link.",
      },
    });
    await this.resolveCompanyRoute();
  }
  async retryCompanyRoute() {
    const route = this.state.companyRoute;
    if (
      this.retired ||
      !route ||
      this.companyRouteOperation ||
      (route.status !== "error" && route.status !== "unavailable")
    )
      return;
    this.update({
      companyRoute: {
        ...route,
        status: "waiting_catalog",
        message: "Load the catalog to open this company link.",
      },
    });
    await this.resolveCompanyRoute();
  }
  private async resolveCompanyRoute() {
    const route = this.state.companyRoute;
    const snapshot = this.state.snapshot;
    if (
      this.retired ||
      !route ||
      !snapshot ||
      this.companyRouteOperation ||
      route.status !== "waiting_catalog"
    )
      return;
    const operation = new AbortController();
    this.companyRouteOperation = operation;
    const current = () =>
      !this.retired &&
      this.companyRouteOperation === operation &&
      !operation.signal.aborted &&
      this.state.companyRoute?.listingId === route.listingId &&
      this.state.snapshot?.snapshotSha256 === snapshot.snapshotSha256;
    this.update({
      companyRoute: {
        ...route,
        status: "resolving",
        message: "Resolving company link.",
      },
    });
    const request = {
      snapshotSha256: snapshot.snapshotSha256,
      listingIds: [route.listingId],
    };
    try {
      const response = await this.api.resolve(request, operation.signal);
      if (!current()) return;
      const admitted = parseManagedCatalogResolveResponse(response, request);
      if (!admitted) throw new TrialApiError("invalid_response");
      const listing = admitted.results[0]!.listing;
      const activeRoute = this.state.companyRoute!;
      if (!listing) {
        this.update({
          companyRoute: {
            ...activeRoute,
            status: "unavailable",
            message:
              "This listing is not available in the current catalog. Check the link or choose another company.",
          },
        });
        return;
      }
      this.companyRouteOperation = null;
      this.openResearch(
        {
          catalogSnapshotSha256: snapshot.snapshotSha256,
          listing: listingIdentity(listing),
          cik: null,
          origin: "route",
        },
        activeRoute.section,
        { companyRoute: { ...activeRoute, status: "open", message: "" } },
      );
    } catch (error) {
      if (!current()) return;
      if (error instanceof ManagedCatalogChangedError) {
        this.invalidateCatalog();
      } else if (
        error instanceof TrialApiError &&
        ["unauthenticated", "access_denied", "origin_denied"].includes(
          error.code,
        )
      ) {
        this.coordinator.readError(error);
      } else {
        this.update({
          companyRoute: {
            ...this.state.companyRoute!,
            status: "error",
            message:
              "The company link could not be resolved. Select Retry company link to try again.",
          },
        });
      }
    } finally {
      if (this.companyRouteOperation === operation)
        this.companyRouteOperation = null;
    }
  }
  private openResearch(
    selection: ManagedResearchSelection,
    section: ManagedResearchVisit["section"],
    options: {
      companyRoute?: CompanyRouteState;
      priceSeed?: ManagedEodHistorySeed | undefined;
      annualSeed?: ManagedAnnualReportSeed;
      filingsSeed?: ManagedCompanyFilingsSeed;
      admit?: () => boolean;
    } = {},
  ) {
    const operation = Symbol();
    this.researchOperation = operation;
    const owns = () => this.researchOperation === operation;
    const admitted = () => !this.retired && (options.admit?.() ?? true);
    this.watchlistPrices.cancel();
    if (!owns() || !admitted()) return;
    this.watchlistFilings.cancel();
    if (!owns() || !admitted()) return;
    this.clearResearch(operation);
    if (!owns() || !admitted()) return;
    if (section === "eod" || options.priceSeed)
      this.eod.open(selection, options.priceSeed);
    if (!owns()) return;
    if (section === "annual") this.annual.open(selection, options.annualSeed);
    if (!owns()) return;
    if (section === "filings")
      this.filings.open(selection, options.filingsSeed);
    if (!owns()) return;
    if (!admitted()) {
      this.clearResearch(operation);
      return;
    }
    const captured = this[section].getSnapshot().selection;
    if (captured)
      this.update({
        research: Object.freeze({ selection: captured, section }),
        companyRoute: options.companyRoute ?? null,
      });
  }
  closeResearch() {
    if (this.clearResearch()) this.update({});
  }
  private clearResearch(operation = Symbol()) {
    this.researchOperation = operation;
    const hadResearch =
      this.state.research !== null || this.state.companyRoute !== null;
    this.companyRouteOperation?.abort();
    this.companyRouteOperation = null;
    // Model close notifications must never expose the visit with a cleared section.
    if (hadResearch)
      this.state = { ...this.state, research: null, companyRoute: null };
    this.annual.close();
    if (this.researchOperation !== operation) return hadResearch;
    this.filings.close();
    if (this.researchOperation !== operation) return hadResearch;
    this.eod.close();
    return hadResearch;
  }
  private canSwitchResearch(selection: ManagedResearchSelection | null) {
    if (
      this.retired ||
      !selection ||
      selection.catalogSnapshotSha256 !== this.state.snapshot?.snapshotSha256
    )
      return false;
    if (selection.origin === "discover") return true;
    if (selection.origin === "route") return selection.cik === null;
    if (selection.origin === "markets") {
      const current = this.markets.selection(selection.listing.listingId);
      return (
        current !== null &&
        current.catalogSnapshotSha256 === selection.catalogSnapshotSha256 &&
        membershipMatchesResult(
          { ...selection.listing, note: "" },
          current.listing,
        )
      );
    }
    const draft = this.coordinator.getSnapshot().draft;
    return (
      selection.cik === null &&
      draft?.snapshotSha256 === selection.catalogSnapshotSha256 &&
      draft.memberships.some((member) =>
        membershipMatchesResult(member, selection.listing),
      )
    );
  }
  switchToFilings() {
    this.switchResearch("filings");
  }
  switchToAnnual() {
    this.switchResearch("annual");
  }
  switchToEod() {
    this.switchResearch("eod");
  }
  private switchResearch(section: ManagedResearchVisit["section"]) {
    const research = this.state.research;
    if (!research) return;
    if (
      !this.canSwitchResearch(research.selection) ||
      this.filings.getSnapshot().catalogChanged ||
      this.annual.getSnapshot().catalogChanged ||
      this.eod.getSnapshot().catalogChanged
    ) {
      this.closeResearch();
      return;
    }
    if (research.section === section) return;
    this[research.section].cancel();
    if (!this[section].getSnapshot().selection)
      this[section].open(research.selection);
    this.update({ research: Object.freeze({ ...research, section }) });
  }
  getResearchWatchlist(
    selection: ManagedResearchSelection,
  ): ResearchWatchlistState {
    const blocked = (
      reason: string,
      member: WatchlistMembership | null = null,
    ): ResearchWatchlistState => ({
      member,
      canAdd: false,
      canEdit: false,
      reason,
    });
    if (this.retired || selection !== this.state.research?.selection)
      return blocked(
        "Open this company again before editing its watchlist note.",
      );
    if (
      !this.canSwitchResearch(selection) ||
      this.filings.getSnapshot().catalogChanged ||
      this.annual.getSnapshot().catalogChanged ||
      this.eod.getSnapshot().catalogChanged
    )
      return blocked(
        "Refresh the catalog and reopen this company before editing.",
      );
    const saved = this.coordinator.getSnapshot();
    const draft = saved.draft;
    if (!draft)
      return blocked("Load My Watchlist before adding or editing a note.");
    if (draft.snapshotSha256 !== selection.catalogSnapshotSha256)
      return blocked("Review catalog changes in My Watchlist before editing.");
    const member =
      draft.memberships.find(
        (entry) => entry.listingId === selection.listing.listingId,
      ) ?? null;
    if (member && !membershipMatchesResult(member, selection.listing))
      return blocked("Review this listing's changed identity in My Watchlist.");
    if (!this.canEdit()) {
      const reason =
        saved.uncertain || saved.replayPending || saved.phase === "reconciling"
          ? "Review the pending save in My Watchlist before editing."
          : saved.conflict
            ? "Resolve the conflict in My Watchlist before editing."
            : "Wait for the current My Watchlist operation to finish before editing.";
      return blocked(reason, member);
    }
    if (!member && draft.memberships.length >= 10_000)
      return blocked(
        "Remove an entry from My Watchlist before adding this company.",
      );
    return {
      member,
      canAdd: member === null,
      canEdit: member !== null,
      reason: null,
    };
  }
  addResearchToWatchlist(selection: ManagedResearchSelection) {
    if (!this.getResearchWatchlist(selection).canAdd) return;
    const draft = this.coordinator.getSnapshot().draft!;
    this.edit([
      ...draft.memberships,
      { ...listingIdentity(selection.listing), note: "" },
    ]);
  }
  noteResearch(selection: ManagedResearchSelection, note: string) {
    if (!this.getResearchWatchlist(selection).canEdit) return;
    this.note(selection.listing.listingId, note);
  }
  private annualNoteProposal(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualEvidenceResponseDto,
    pair: PersonalSecAnnualPairDto,
  ): { note: string | null; reason: string | null } {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        note: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before adding Annual evidence.",
      };
    const annual = this.annual.getSnapshot();
    if (
      this.state.research?.section !== "annual" ||
      annual.response !== response
    )
      return {
        note: null,
        reason:
          "Choose evidence from the current Annual report before adding it.",
      };
    if (annual.running)
      return {
        note: null,
        reason: "Wait for the Annual report request to finish or cancel it.",
      };
    const excerpt = annualNoteExcerpt(response, pair, annual.showingPrevious);
    if (excerpt === null)
      return {
        note: null,
        reason: "Choose an eligible pair from the observed Annual report.",
      };
    const note =
      watchlist.member.note + (watchlist.member.note ? " " : "") + excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, reason: null };
  }
  getAnnualNoteAction(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualEvidenceResponseDto,
    pair: PersonalSecAnnualPairDto,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.annualNoteProposal(selection, response, pair);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendAnnualToResearchNote(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualEvidenceResponseDto,
    pair: PersonalSecAnnualPairDto,
  ): { appended: boolean; message: string } {
    const proposal = this.annualNoteProposal(selection, response, pair);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason! };
    this.noteResearch(selection, proposal.note);
    return {
      appended: true,
      message:
        "Annual evidence added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
  private annualCashNoteProposal(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualEvidenceResponseDto,
  ): { note: string | null; reason: string | null } {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        note: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before adding cash generation.",
      };
    const annual = this.annual.getSnapshot();
    if (
      this.state.research?.section !== "annual" ||
      annual.response !== response
    )
      return {
        note: null,
        reason:
          "Choose cash generation from the current Annual report before adding it.",
      };
    if (annual.running)
      return {
        note: null,
        reason: "Wait for the Annual report request to finish or cancel it.",
      };
    const excerpt = annualCashNoteExcerpt(response, annual.showingPrevious);
    if (excerpt === null)
      return {
        note: null,
        reason:
          "Cash generation needs available operating cash flow and PP&E purchases from the same filing and annual period.",
      };
    const current = watchlist.member.note;
    if (current.includes(excerpt))
      return {
        note: null,
        reason:
          "This exact cash-generation reference is already in the note draft.",
      };
    const note = current + (current ? " " : "") + excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, reason: null };
  }
  getAnnualCashNoteAction(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualEvidenceResponseDto,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.annualCashNoteProposal(selection, response);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendAnnualCashToResearchNote(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualEvidenceResponseDto,
  ): { appended: boolean; message: string } {
    const proposal = this.annualCashNoteProposal(selection, response);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason! };
    this.noteResearch(selection, proposal.note);
    return {
      appended: true,
      message:
        "Cash generation added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
  private annualLiquidityNoteProposal(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualEvidenceResponseDto,
  ): { note: string | null; reason: string | null } {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        note: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before adding liquidity.",
      };
    const annual = this.annual.getSnapshot();
    if (
      this.state.research?.section !== "annual" ||
      annual.response !== response
    )
      return {
        note: null,
        reason:
          "Choose liquidity from the current Annual report before adding it.",
      };
    if (annual.running)
      return {
        note: null,
        reason: "Wait for the Annual report request to finish or cancel it.",
      };
    const excerpt = annualLiquidityNoteExcerpt(
      response,
      annual.showingPrevious,
    );
    if (excerpt === null)
      return {
        note: null,
        reason:
          "Liquidity needs available nonnegative current assets and liabilities from the same filing and balance date.",
      };
    const current = watchlist.member.note;
    if (current.includes(excerpt))
      return {
        note: null,
        reason: "This exact liquidity reference is already in the note draft.",
      };
    const note = current + (current ? " " : "") + excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, reason: null };
  }
  getAnnualLiquidityNoteAction(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualEvidenceResponseDto,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.annualLiquidityNoteProposal(selection, response);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendAnnualLiquidityToResearchNote(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualEvidenceResponseDto,
  ): { appended: boolean; message: string } {
    const proposal = this.annualLiquidityNoteProposal(selection, response);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason! };
    this.noteResearch(selection, proposal.note);
    return {
      appended: true,
      message:
        "Liquidity added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
  private priceNoteProposal(
    selection: ManagedResearchSelection,
    response: ManagedEodHistoryResponseDto,
    start: ManagedEodCloseDto,
    end: ManagedEodCloseDto,
  ): { note: string | null; reason: string | null } {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        note: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before adding a price comparison.",
      };
    const eod = this.eod.getSnapshot();
    if (this.state.research?.section !== "eod" || eod.response !== response)
      return {
        note: null,
        reason:
          "Choose a comparison from the current Price history before adding it.",
      };
    if (eod.running)
      return {
        note: null,
        reason: "Wait for the close history request to finish or cancel it.",
      };
    const excerpt = priceComparisonNoteExcerpt(
      response,
      start,
      end,
      eod.showingPrevious,
    );
    if (excerpt === null)
      return {
        note: null,
        reason:
          "Choose two observed dates in increasing order from the loaded close history.",
      };
    const note =
      watchlist.member.note + (watchlist.member.note ? " " : "") + excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, reason: null };
  }
  getPriceNoteAction(
    selection: ManagedResearchSelection,
    response: ManagedEodHistoryResponseDto,
    start: ManagedEodCloseDto,
    end: ManagedEodCloseDto,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.priceNoteProposal(selection, response, start, end);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendPriceComparisonToResearchNote(
    selection: ManagedResearchSelection,
    response: ManagedEodHistoryResponseDto,
    start: ManagedEodCloseDto,
    end: ManagedEodCloseDto,
  ): { appended: boolean; message: string } {
    const proposal = this.priceNoteProposal(selection, response, start, end);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason! };
    this.noteResearch(selection, proposal.note);
    return {
      appended: true,
      message:
        "Price comparison added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
  private watchlistComparisonNoteProposal(
    selection: ManagedWatchlistComparisonSelection,
    destination: ManagedEodIdentity | null,
  ):
    | { note: string; member: WatchlistMembership; reason: null }
    | { note: null; member: null; reason: string } {
    const draft = this.coordinator.getSnapshot().draft;
    const prices = this.watchlistPrices.getSnapshot();
    if (
      !this.canEdit() ||
      !draft ||
      this.state.view !== "watchlist" ||
      this.state.research ||
      this.state.companyRoute ||
      !prices.canRead ||
      this.state.snapshot?.snapshotSha256 !== draft.snapshotSha256
    )
      return {
        note: null,
        member: null,
        reason:
          "Return to an editable watchlist before adding comparison evidence.",
      };
    const evidence = getManagedWatchlistComparisonNoteEvidence(
      selection,
      prices,
    );
    if (evidence.excerpt === null)
      return { note: null, member: null, reason: evidence.reason! };
    const member = destination
      ? draft.memberships.find((item) =>
          membershipMatchesResult(item, destination),
        )
      : null;
    const paired =
      destination &&
      [selection.left, selection.right].some(
        (source) =>
          source &&
          membershipMatchesResult({ ...destination, note: "" }, source.listing),
      );
    if (!member || !paired)
      return {
        note: null,
        member: null,
        reason: "Choose one of these two listings as the note destination.",
      };
    const note = member.note + (member.note ? " " : "") + evidence.excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        member: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, member, reason: null };
  }
  getWatchlistComparisonNoteAction(
    selection: ManagedWatchlistComparisonSelection,
    destination: ManagedEodIdentity | null,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.watchlistComparisonNoteProposal(
      selection,
      destination,
    );
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendWatchlistComparisonToNote(
    selection: ManagedWatchlistComparisonSelection,
    destination: ManagedEodIdentity | null,
  ): { appended: boolean; message: string } {
    const proposal = this.watchlistComparisonNoteProposal(
      selection,
      destination,
    );
    if (proposal.note === null)
      return { appended: false, message: proposal.reason };
    this.note(proposal.member.listingId, proposal.note);
    return {
      appended: true,
      message: `Comparison added to the ${proposal.member.symbol} (${proposal.member.shareClassName}, ${proposal.member.exchangeMic}) note draft. Review and save all changes in My Watchlist.`,
    };
  }
  private annualComparisonNoteProposal(
    capture: AnnualComparisonNoteCapture,
    destination: ManagedWatchlistAnnualComparisonMember | null,
  ):
    | { note: string; member: WatchlistMembership; reason: null }
    | { note: null; member: null; reason: string } {
    const draft = this.coordinator.getSnapshot().draft;
    const comparison = this.annualComparison.getSnapshot();
    const refuse = (reason: string) => ({ note: null, member: null, reason });
    if (
      !this.canEdit() ||
      !draft ||
      this.state.view !== "watchlist" ||
      this.state.research ||
      this.state.companyRoute ||
      !comparison.active ||
      !comparison.canRead ||
      comparison.catalogChanged ||
      this.state.snapshot?.snapshotSha256 !== draft.snapshotSha256
    )
      return refuse(
        "Return to an editable watchlist before adding Annual comparison evidence.",
      );
    if (comparison.pending)
      return refuse(
        "Wait for the Annual comparison request to finish or cancel it.",
      );
    for (const side of ["left", "right"] as const) {
      const current = comparison[side];
      const observed = capture[side];
      if (
        current.selected !== observed.member ||
        current.report.response !== observed.response ||
        current.report.showingPrevious !== observed.showingPrevious ||
        current.report.running ||
        observed.response.catalogSnapshotSha256 !== draft.snapshotSha256
      )
        return refuse(
          "Choose evidence from the current Annual comparison before adding it.",
        );
    }
    if (
      !destination ||
      ![capture.left.member, capture.right.member].includes(destination)
    )
      return refuse(
        "Choose one of these two listings as the note destination.",
      );
    const member = draft.memberships.find((item) =>
      membershipMatchesResult(item, destination.listing),
    );
    if (!member)
      return refuse(
        "Choose one of these two listings as the note destination.",
      );
    const evidence = getAnnualComparisonNoteEvidence(capture);
    if (evidence.excerpt === null) return refuse(evidence.reason!);
    if (member.note.includes(evidence.excerpt))
      return refuse(
        "This exact Annual comparison reference is already in the note draft.",
      );
    const note = member.note + (member.note ? " " : "") + evidence.excerpt;
    if (normalizeWatchlistNote(note) === null)
      return refuse(
        "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      );
    return { note, member, reason: null };
  }
  getAnnualComparisonNoteAction(
    capture: AnnualComparisonNoteCapture,
    destination: ManagedWatchlistAnnualComparisonMember | null,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.annualComparisonNoteProposal(capture, destination);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendAnnualComparisonToNote(
    capture: AnnualComparisonNoteCapture,
    destination: ManagedWatchlistAnnualComparisonMember | null,
  ): { appended: boolean; message: string } {
    const proposal = this.annualComparisonNoteProposal(capture, destination);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason };
    this.note(proposal.member.listingId, proposal.note);
    return {
      appended: true,
      message: `Annual comparison added to the ${proposal.member.symbol} (${proposal.member.shareClassName}, ${proposal.member.exchangeMic}) note draft. Review and save all changes in My Watchlist.`,
    };
  }
  private filingsNoteProposal(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ): { note: string | null; reason: string | null } {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        note: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before adding a filing reference.",
      };
    const filings = this.filings.getSnapshot();
    if (
      this.state.research?.section !== "filings" ||
      filings.response !== response
    )
      return {
        note: null,
        reason:
          "Choose a filing from the current Filings result before adding it.",
      };
    if (filings.running)
      return {
        note: null,
        reason: "Wait for the filings request to finish or cancel it.",
      };
    const excerpt = filingReferenceNoteExcerpt(
      response,
      filing,
      filings.showingPrevious,
    );
    if (excerpt === null)
      return {
        note: null,
        reason: "Choose a filing from the observed Filings result.",
      };
    const current = watchlist.member.note;
    if (current.includes(excerpt))
      return {
        note: null,
        reason: "This exact filing reference is already in the note draft.",
      };
    const note = current + (current ? " " : "") + excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, reason: null };
  }
  getFilingsNoteAction(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.filingsNoteProposal(selection, response, filing);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendFilingReferenceToResearchNote(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ): { appended: boolean; message: string } {
    const proposal = this.filingsNoteProposal(selection, response, filing);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason! };
    this.noteResearch(selection, proposal.note);
    return {
      appended: true,
      message:
        "Filing reference added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
  private validateDraft(draft: MainWatchlistPayload): DraftValidation {
    const digest = this.state.snapshot?.snapshotSha256 ?? null;
    if (this.validation?.draft === draft && this.validation.digest === digest)
      return this.validation.result;
    const result =
      digest === null
        ? { payload: null, issue: "Load the catalog before saving." }
        : digest !== draft.snapshotSha256
          ? { payload: null, issue: "Review catalog changes before saving." }
          : capture(draft);
    this.validation = { draft, digest, result };
    return result;
  }
  canSavePayload() {
    const draft = this.coordinator.getSnapshot().draft;
    return draft !== null && this.validateDraft(draft).payload !== null;
  }
  saveIssue() {
    const draft = this.coordinator.getSnapshot().draft;
    return draft === null ? null : this.validateDraft(draft).issue;
  }
  private edit(memberships: readonly WatchlistMembership[]) {
    const draft = this.coordinator.getSnapshot().draft;
    if (!this.canEdit() || !draft) return;
    this.coordinator.replaceDraft({ ...draft, memberships });
  }
  add(result: PersonalSecurityMasterSearchResultDto) {
    const draft = this.coordinator.getSnapshot().draft;
    if (
      !this.canEdit() ||
      !draft ||
      !this.state.results.includes(result) ||
      this.state.snapshot?.snapshotSha256 !== draft.snapshotSha256 ||
      draft.memberships.length >= 10_000 ||
      draft.memberships.some((member) => member.listingId === result.listingId)
    )
      return;
    this.edit([...draft.memberships, listingMembership(result)]);
  }
  note(listingId: string, note: string) {
    const draft = this.coordinator.getSnapshot().draft;
    if (draft)
      this.edit(
        draft.memberships.map((member) =>
          member.listingId === listingId ? { ...member, note } : member,
        ),
      );
  }
  remove(listingId: string) {
    const draft = this.coordinator.getSnapshot().draft;
    if (draft)
      this.edit(
        draft.memberships.filter((member) => member.listingId !== listingId),
      );
  }
  move(listingId: string, direction: -1 | 1) {
    const draft = this.coordinator.getSnapshot().draft;
    if (!draft) return;
    const members = [...draft.memberships];
    const index = members.findIndex((member) => member.listingId === listingId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= members.length) return;
    [members[index], members[target]] = [members[target]!, members[index]!];
    this.edit(members);
  }
  async reviewCatalog() {
    const draft = this.coordinator.getSnapshot().draft;
    const snapshot = this.state.snapshot;
    if (!this.canEdit() || !draft || !snapshot || this.resolveOperation) return;
    this.update({
      review: { draft, snapshotSha256: snapshot.snapshotSha256, results: [] },
      message: "",
    });
    await this.nextReviewBatch();
  }
  async nextReviewBatch() {
    const review = this.state.review;
    if (
      !this.canEdit() ||
      !review ||
      this.resolveOperation ||
      this.coordinator.getSnapshot().draft !== review.draft
    )
      return;
    const listingIds = review.draft.memberships
      .slice(
        review.results.length,
        review.results.length + MANAGED_CATALOG_RESOLVE_LIMITS.listingIds,
      )
      .map((member) => member.listingId);
    if (!listingIds.length) return;
    const operation = new AbortController();
    this.resolveOperation = operation;
    this.update({ reviewing: true });
    try {
      const result = await this.api.resolve(
        { snapshotSha256: review.snapshotSha256, listingIds },
        operation.signal,
      );
      if (
        this.retired ||
        this.resolveOperation !== operation ||
        this.state.review !== review ||
        this.coordinator.getSnapshot().draft !== review.draft ||
        operation.signal.aborted
      )
        return;
      this.update({
        review: { ...review, results: [...review.results, ...result.results] },
      });
    } catch (error) {
      if (
        !this.retired &&
        this.resolveOperation === operation &&
        !operation.signal.aborted
      ) {
        this.update({ review: null });
        this.catalogError(error, "review");
      }
    } finally {
      if (this.resolveOperation === operation) {
        this.resolveOperation = null;
        this.update({ reviewing: false });
      }
    }
  }
  applyReview() {
    const review = this.state.review;
    if (
      !this.canEdit() ||
      this.resolveOperation ||
      !review ||
      this.coordinator.getSnapshot().draft !== review.draft ||
      review.results.length !== review.draft.memberships.length ||
      review.snapshotSha256 !== this.state.snapshot?.snapshotSha256
    )
      return;
    const memberships = review.results.flatMap((result, index) =>
      result.listing
        ? [{ ...result.listing, note: review.draft.memberships[index]!.note }]
        : [],
    );
    this.coordinator.replaceDraft({
      ...review.draft,
      snapshotSha256: review.snapshotSha256,
      memberships,
    });
    this.update({
      review: null,
      message: "Catalog changes applied.",
    });
  }
}

export function reviewChanges(review: CatalogReview) {
  return review.results.flatMap((result, index) => {
    const previous = review.draft.memberships[index]!;
    return result.listing && membershipMatchesResult(previous, result.listing)
      ? []
      : [{ previous, listing: result.listing }];
  });
}
