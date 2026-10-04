import {
  encodeMainWatchlistPayload,
  isMainWatchlistPayload,
  MANAGED_CATALOG_RESOLVE_LIMITS,
  MANAGED_WATCHLIST_LIMITS,
  membershipMatchesResult,
  normalizeWatchlistNote,
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
import type { TrialSession } from "./session";

type ResolvedListing = ManagedCatalogResolveResponse["results"][number];
export interface CatalogReview {
  readonly draft: MainWatchlistPayload;
  readonly snapshotSha256: string;
  readonly results: readonly ResolvedListing[];
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

/** Owns catalog reads and their lifetime; the shared coordinator owns every save. */
export class ManagedWorkspace {
  readonly coordinator: SaveCoordinator<MainWatchlistPayload>;
  readonly annual: ManagedAnnualReport;
  readonly eod: ManagedEodHistory;
  readonly markets: ManagedMarkets;
  private state = emptyDiscovery();
  private readonly listeners = new Set<() => void>();
  private searchOperation: AbortController | null = null;
  private resolveOperation: AbortController | null = null;
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
      const selection = this.annual.getSnapshot().selection;
      if (selection?.origin === "watchlist") {
        const member = saved.draft?.memberships.find(
          (item) => item.listingId === selection.listing.listingId,
        );
        if (
          !member ||
          saved.draft?.snapshotSha256 !== selection.catalogSnapshotSha256 ||
          !membershipMatchesResult(member, selection.listing)
        )
          this.annual.close();
      }
      const eodSelection = this.eod.getSnapshot().selection;
      if (eodSelection?.origin === "watchlist") {
        const member = saved.draft?.memberships.find(
          (item) => item.listingId === eodSelection.listing.listingId,
        );
        if (
          !member ||
          saved.draft?.snapshotSha256 !== eodSelection.catalogSnapshotSha256 ||
          !membershipMatchesResult(member, eodSelection.listing)
        )
          this.eod.close();
      }
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
    this.annual.close();
    this.eod.close();
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
    this.update({
      snapshot: null,
      results: [],
      totalMatches: 0,
      read: null,
      message:
        "The catalog changed. Refresh the catalog before requesting research again.",
    });
    this.annual.close();
    this.eod.close();
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
        this.cancelReview();
        this.annual.close();
        this.eod.close();
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
    this.eod.close();
    this.annual.open({
      catalogSnapshotSha256: snapshot.snapshotSha256,
      listing: listingIdentity(result),
      cik: result.cik,
      origin: "discover",
    });
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
    this.eod.close();
    this.annual.open({
      catalogSnapshotSha256: this.state.snapshot.snapshotSha256,
      listing: listingIdentity(member),
      cik: null,
      origin: "watchlist",
    });
  }
  openDiscoveryEod(result: PersonalSecurityMasterSearchResultDto) {
    const snapshot = this.state.snapshot;
    if (this.retired || !snapshot || !this.state.results.includes(result))
      return;
    this.annual.close();
    this.eod.open({
      catalogSnapshotSha256: snapshot.snapshotSha256,
      listing: listingIdentity(result),
      cik: result.cik,
      origin: "discover",
    });
  }
  canOpenWatchlistEod(member: WatchlistMembership) {
    return this.canOpenWatchlistAnnual(member);
  }
  openWatchlistEod(member: WatchlistMembership) {
    if (!this.canOpenWatchlistEod(member) || !this.state.snapshot) return;
    this.annual.close();
    this.eod.open({
      catalogSnapshotSha256: this.state.snapshot.snapshotSha256,
      listing: listingIdentity(member),
      cik: null,
      origin: "watchlist",
    });
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
    this.annual.close();
    this.eod.close();
    if (kind === "annual") this.annual.open(selection);
    else this.eod.open(selection);
  }
  private canSwitchResearch(selection: AnnualReportSelection | null) {
    if (
      this.retired ||
      !selection ||
      selection.catalogSnapshotSha256 !== this.state.snapshot?.snapshotSha256
    )
      return false;
    if (selection.origin === "discover") return true;
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
    const { selection, catalogChanged } = this.eod.getSnapshot();
    if (!selection || catalogChanged || !this.canSwitchResearch(selection))
      return;
    this.eod.close();
    this.annual.open(selection);
  }
  switchToEod() {
    const { selection, catalogChanged } = this.annual.getSnapshot();
    if (!selection || catalogChanged || !this.canSwitchResearch(selection))
      return;
    this.annual.close();
    this.eod.open(selection);
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
