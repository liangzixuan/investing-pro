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
  type ManagedEodIdentity,
  type PersonalSecurityMasterSearchResultDto,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import { ManagedCatalogChangedError, type ManagedApi } from "./managed-api";
import {
  ManagedAnnualReport,
  type AnnualReportSelection,
} from "./managed-annual-report";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedEodAccess } from "./managed-eod-access";
import { ManagedMarkets } from "./managed-markets";
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
  readonly selection: AnnualReportSelection;
  readonly section: "annual" | "eod";
}
export interface ResearchWatchlistState {
  readonly member: WatchlistMembership | null;
  readonly canAdd: boolean;
  readonly canEdit: boolean;
  readonly reason: string | null;
}
export interface CompanyRouteState {
  readonly listingId: string;
  readonly section: "annual" | "eod";
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
  readonly eod: ManagedEodHistory;
  readonly markets: ManagedMarkets;
  private state = emptyDiscovery();
  private readonly listeners = new Set<() => void>();
  private searchOperation: AbortController | null = null;
  private resolveOperation: AbortController | null = null;
  private companyRouteOperation: AbortController | null = null;
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
    options: { marketsCohort?: readonly ManagedEodIdentity[] } = {},
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
    );
    const eodAccess = new ManagedEodAccess((request, signal) =>
      api.eodHistory(request, signal),
    );
    this.eod = new ManagedEodHistory(
      (request, signal) => api.eodHistory(request, signal),
      (error) => this.coordinator.readError(error),
      eodAccess,
    );
    this.markets = new ManagedMarkets(
      api,
      eodAccess,
      (error) => this.coordinator.readError(error),
      () => this.invalidateCatalog(),
      options.marketsCohort,
    );
    this.annual.subscribe(() => {
      if (this.annual.getSnapshot().catalogChanged) this.invalidateCatalog();
    });
    this.eod.subscribe(() => {
      if (this.eod.getSnapshot().catalogChanged) this.invalidateCatalog();
    });
    this.coordinator.subscribe(() => {
      const saved = this.coordinator.getSnapshot();
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
    for (const listener of this.listeners) listener();
  }
  private clear() {
    this.retired = true;
    this.closeResearch();
    this.annual.retire();
    this.eod.retire();
    this.markets.retire();
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
    if (view === "markets")
      this.markets.enter(this.state.snapshot?.snapshotSha256 ?? null);
    else this.markets.leave();
    this.update({ view });
  }
  private invalidateCatalog() {
    if (this.retired || !this.state.snapshot) return;
    this.searchOperation?.abort();
    this.searchOperation = null;
    this.cancelReview();
    this.markets.leave();
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
    this.openResearch(
      {
        catalogSnapshotSha256: this.state.snapshot.snapshotSha256,
        listing: listingIdentity(member),
        cik: null,
        origin: "watchlist",
      },
      "eod",
    );
  }
  openMarketResearch(kind: "annual" | "eod", listingId?: string) {
    const selection = this.markets.selection(listingId);
    if (
      this.retired ||
      this.state.view !== "markets" ||
      !selection ||
      selection.catalogSnapshotSha256 !== this.state.snapshot?.snapshotSha256
    )
      return;
    this.markets.cancel();
    this.openResearch(selection, kind);
  }
  async setCompanyRoute(route: ManagedCompanyRoute | null) {
    if (this.retired) return;
    if (
      !route ||
      !isManagedCompanyListingId(route.listingId) ||
      (route.section !== "annual" && route.section !== "eod")
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
        { ...activeRoute, status: "open", message: "" },
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
    selection: AnnualReportSelection,
    section: ManagedResearchVisit["section"],
    companyRoute: CompanyRouteState | null = null,
  ) {
    this.clearResearch();
    this[section].open(selection);
    const captured = this[section].getSnapshot().selection;
    if (captured)
      this.update({
        research: Object.freeze({ selection: captured, section }),
        companyRoute,
      });
  }
  closeResearch() {
    if (this.clearResearch()) this.update({});
  }
  private clearResearch() {
    const hadResearch =
      this.state.research !== null || this.state.companyRoute !== null;
    this.companyRouteOperation?.abort();
    this.companyRouteOperation = null;
    // Model close notifications must never expose the visit with a cleared section.
    if (hadResearch)
      this.state = { ...this.state, research: null, companyRoute: null };
    this.annual.close();
    this.eod.close();
    return hadResearch;
  }
  private canSwitchResearch(selection: AnnualReportSelection | null) {
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
    selection: AnnualReportSelection,
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
  addResearchToWatchlist(selection: AnnualReportSelection) {
    if (!this.getResearchWatchlist(selection).canAdd) return;
    const draft = this.coordinator.getSnapshot().draft!;
    this.edit([
      ...draft.memberships,
      { ...listingIdentity(selection.listing), note: "" },
    ]);
  }
  noteResearch(selection: AnnualReportSelection, note: string) {
    if (!this.getResearchWatchlist(selection).canEdit) return;
    this.note(selection.listing.listingId, note);
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
