import {
  membershipMatchesResult,
  parseManagedCatalogResolveResponse,
  type ManagedCatalogResolveRequest,
  type ManagedEodHistoryResponseDto,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import {
  isManagedEodAuthenticationError,
  isManagedEodTransientError,
  type ManagedEodAccess,
} from "./managed-eod-access";
import type { EodHistorySelection } from "./managed-eod-history";

export type ManagedMarketsCohortEntry = ManagedEodIdentity;

/** Declared price cohort; runtime configuration and provider refusals remain authoritative. */
export const MANAGED_MARKETS_COHORT: readonly ManagedMarketsCohortEntry[] =
  Object.freeze(
    [
      {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "oid-issuer-0e4ae79b2a6b4443b11946c6b9171c45",
        issuerName: "Apple Inc.",
        listingId: "oid-listing-fdc1a316c06e4efca10b09944c908bbc",
        securityId: "oid-security-2c607f13eb744e61a209f61b7a1e172d",
        securityName: "Common Stock, $0.00001 par value per share",
        shareClassId: "oid-share-class-de665b6392eb4a03b7ec2c09ba97dc1c",
        shareClassName: "Common Stock, $0.00001 par value per share",
        symbol: "AAPL",
      },
      {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "oid-issuer-2744343830e3421ab970a3e5f4e4a719",
        issuerName: "Alphabet Inc.",
        listingId: "oid-listing-44bc5fe9c57246a3adef40bbcbcb88a7",
        securityId: "oid-security-b3826929532e4221a42d3c753046c7c8",
        securityName: "Class C Capital Stock, $0.001 par value",
        shareClassId: "oid-share-class-f81365021c5a4909aa983603a54f634d",
        shareClassName: "Class C Capital Stock, $0.001 par value",
        symbol: "GOOG",
      },
      {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "oid-issuer-2744343830e3421ab970a3e5f4e4a719",
        issuerName: "Alphabet Inc.",
        listingId: "oid-listing-5acae2cd933a4a32a3ac19e428ab27ce",
        securityId: "oid-security-0377495156384622865c558c1bf79449",
        securityName: "Class A Common Stock, $0.001 par value",
        shareClassId: "oid-share-class-75f07939ba714dbcbfac6a097deba503",
        shareClassName: "Class A Common Stock, $0.001 par value",
        symbol: "GOOGL",
      },
    ].map((listing) => Object.freeze(listing)) as ManagedMarketsCohortEntry[],
  );

export interface ManagedMarketsRow {
  readonly listing: ManagedEodIdentity;
  readonly response: ManagedEodHistoryResponseDto | null;
  readonly showingPrevious: boolean;
  readonly running: boolean;
  readonly error: boolean;
  readonly message: string;
}
export interface ManagedMarketsState {
  readonly active: boolean;
  readonly catalogSnapshotSha256: `sha256:${string}` | null;
  readonly rows: readonly ManagedMarketsRow[];
  readonly selectedListingId: string | null;
  readonly resolving: boolean;
  readonly running: boolean;
  readonly catalogChanged: boolean;
  readonly error: boolean;
  readonly message: string;
}
const empty = (): ManagedMarketsState => ({
  active: false,
  catalogSnapshotSha256: null,
  rows: [],
  selectedListingId: null,
  resolving: false,
  running: false,
  catalogChanged: false,
  error: false,
  message: "",
});
const catalogFailure = (error: unknown) =>
  error instanceof ManagedCatalogChangedError ||
  (error instanceof ManagedEodHistoryError && error.code === "catalog_changed");

/** Admit the complete declared cohort before creating any price row. */
function admitCohort(
  response: unknown,
  request: ManagedCatalogResolveRequest,
  cohort: readonly ManagedMarketsCohortEntry[],
): readonly ManagedEodIdentity[] {
  const checked = parseManagedCatalogResolveResponse(response, request);
  if (!checked) throw new TrialApiError("invalid_response");
  return checked.results.map((result, index) => {
    const listing = result.listing;
    if (
      !listing ||
      !membershipMatchesResult({ ...cohort[index]!, note: "" }, listing)
    )
      throw new TrialApiError("invalid_response");
    return listing;
  });
}

interface RowFailure {
  readonly keepPrevious: boolean;
  readonly message: string;
  readonly error: boolean;
  readonly stop: boolean;
}

/** Row retention and batch admission are explicit decisions for each typed refusal. */
function rowFailure(error: unknown, action: string): RowFailure {
  const failure = {
    keepPrevious: isManagedEodTransientError(error),
    message: "Price history could not be loaded. Try again when ready.",
    error: true,
    stop: false,
  };
  if (error instanceof ManagedEodCooldownError)
    return {
      keepPrevious: true,
      message: `Price requests are available after ${error.nextAllowedAt}. Select ${action} again then.`,
      error: false,
      stop: true,
    };
  if (!(error instanceof ManagedEodHistoryError)) return failure;
  switch (error.code) {
    case "source_rate_limited":
      return {
        ...failure,
        message:
          "Tiingo is limiting requests. Try again later; no reset time was provided.",
        stop: true,
      };
    case "not_configured":
      return {
        ...failure,
        message: "Price history is not configured for this workspace.",
        stop: true,
      };
    case "unsupported_listing":
      return {
        ...failure,
        message: "Price history is not available for this exact listing.",
      };
    case "request_timeout":
      return {
        ...failure,
        message: "Price history timed out. Try again when ready.",
      };
    default:
      return failure;
  }
}

/** Prices belong to one Markets visit; panels have their own independent snapshots. */
export class ManagedMarkets {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private resolution: AbortController | null = null;
  private operation: AbortController | null = null;
  private queued = new Set<string>();
  private retired = false;
  private readonly cohort: readonly ManagedMarketsCohortEntry[];

  constructor(
    private readonly api: Pick<ManagedApi, "resolve">,
    private readonly access: ManagedEodAccess,
    private readonly onReadError: (error: TrialApiError) => void,
    private readonly onCatalogChanged: () => void,
    cohort: readonly ManagedMarketsCohortEntry[] = MANAGED_MARKETS_COHORT,
  ) {
    if (
      cohort.length !== 3 ||
      (["listingId", "securityId", "shareClassId", "symbol"] as const).some(
        (key) => new Set(cohort.map((listing) => listing[key])).size !== 3,
      )
    )
      throw new Error("Markets requires three distinct exact listings.");
    this.cohort = Object.freeze(
      cohort.map((listing) => Object.freeze({ ...listing })),
    );
  }

  getSnapshot = (): ManagedMarketsState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<ManagedMarketsState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }
  private updateRow(listingId: string, next: Partial<ManagedMarketsRow>) {
    this.update({
      rows: this.state.rows.map((row) =>
        row.listing.listingId === listingId ? { ...row, ...next } : row,
      ),
    });
  }
  private visitDigest() {
    return !this.retired && this.state.active
      ? this.state.catalogSnapshotSha256
      : null;
  }
  private retireFailedRead(error: unknown): boolean {
    if (isManagedEodAuthenticationError(error)) {
      this.retire();
      this.onReadError(error);
      return true;
    }
    if (catalogFailure(error)) {
      this.catalogChanged();
      this.onCatalogChanged();
      return true;
    }
    return false;
  }
  private priceAction() {
    return this.state.rows.some((row) => row.response)
      ? "Refresh board prices"
      : "Load board prices";
  }
  private finishQueue() {
    const queued = this.queued;
    this.queued = new Set();
    return this.state.rows.map((row) =>
      queued.has(row.listing.listingId)
        ? {
            ...row,
            message: row.response
              ? "Not requested. Previous history retained."
              : "Not requested. Prices not loaded.",
          }
        : row,
    );
  }

  enter(catalogSnapshotSha256: `sha256:${string}` | null) {
    if (
      this.retired ||
      (this.state.active &&
        this.state.catalogSnapshotSha256 === catalogSnapshotSha256)
    )
      return;
    this.leave();
    this.update({
      active: true,
      catalogSnapshotSha256,
      message: catalogSnapshotSha256
        ? "Resolve the three Markets listings before loading prices."
        : "Waiting for the catalog. Use Refresh catalog if it cannot be loaded.",
    });
    if (catalogSnapshotSha256) void this.resolve();
  }
  leave() {
    this.resolution?.abort();
    this.resolution = null;
    this.operation?.abort();
    this.operation = null;
    this.queued.clear();
    this.state = empty();
    for (const listener of this.listeners) listener();
  }
  retire() {
    this.retired = true;
    this.leave();
  }
  catalogChanged() {
    this.leave();
    this.update({
      catalogChanged: true,
      error: true,
      message: "The catalog changed. Refresh the catalog to use Markets again.",
    });
  }
  async resolve() {
    const digest = this.visitDigest();
    if (!digest || this.resolution || this.state.rows.length > 0) return;
    const operation = new AbortController();
    this.resolution = operation;
    const current = () =>
      this.resolution === operation &&
      !operation.signal.aborted &&
      this.visitDigest() === digest;
    this.update({
      resolving: true,
      error: false,
      message: "Resolving Markets listings…",
    });
    const request = {
      snapshotSha256: digest,
      listingIds: this.cohort.map((listing) => listing.listingId),
    };
    try {
      const response = await this.api.resolve(request, operation.signal);
      if (!current()) return;
      const listings = admitCohort(response, request, this.cohort);
      this.update({
        rows: listings.map((listing) => ({
          listing,
          response: null,
          showingPrevious: false,
          running: false,
          error: false,
          message: "Prices not loaded.",
        })),
        selectedListingId: request.listingIds[0]!,
        message: "Load one month of raw closing prices when you are ready.",
      });
    } catch (error) {
      if (!current()) return;
      if (this.retireFailedRead(error)) return;
      this.update({
        error: true,
        message:
          "Markets listings could not be resolved. Select Retry board listings to try again.",
      });
    } finally {
      if (this.resolution === operation) {
        this.resolution = null;
        this.update({ resolving: false });
      }
    }
  }
  select(listingId: string) {
    if (this.selection(listingId))
      this.update({ selectedListingId: listingId });
  }
  selection(
    listingId = this.state.selectedListingId,
  ): EodHistorySelection | null {
    const digest = this.visitDigest();
    const row = this.state.rows.find(
      (entry) => entry.listing.listingId === listingId,
    );
    return digest && row
      ? {
          catalogSnapshotSha256: digest,
          listing: row.listing,
          cik: null,
          origin: "markets",
        }
      : null;
  }
  cancel() {
    if (!this.operation) return;
    this.operation.abort();
    this.operation = null;
    this.update({
      running: false,
      error: false,
      message:
        "Price loading cancelled. Completed and previous histories remain visible.",
      rows: this.finishQueue().map((row) =>
        row.running
          ? {
              ...row,
              running: false,
              showingPrevious: row.response !== null,
              error: false,
              message: row.response
                ? "Refresh cancelled. Previous history retained."
                : "Price loading cancelled.",
            }
          : row,
      ),
    });
  }
  async load() {
    const digest = this.visitDigest();
    if (
      !digest ||
      this.operation ||
      this.state.resolving ||
      this.state.rows.length !== 3 ||
      this.state.catalogChanged
    )
      return;
    const operation = new AbortController();
    this.operation = operation;
    const current = () =>
      this.operation === operation &&
      !operation.signal.aborted &&
      this.visitDigest() === digest;
    const rows = this.state.rows;
    this.queued = new Set(rows.map((row) => row.listing.listingId));
    this.update({
      running: true,
      error: false,
      message: "Loading up to three price histories in order…",
      rows: rows.map((row) => ({
        ...row,
        showingPrevious: row.response !== null,
        error: false,
        message: "Waiting for this price request.",
      })),
    });
    try {
      for (const row of rows) {
        if (!current()) return;
        if (!(await this.loadRow(row, digest, operation.signal, current)))
          return;
      }
      if (current()) {
        const failed = this.state.rows.some((row) => row.error);
        this.update({
          error: failed,
          message: failed
            ? `Price loading finished with row errors. Select ${this.priceAction()} to try again.`
            : "All three price histories loaded. Each row shows its own trading date.",
        });
      }
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        this.update({ running: false, rows: this.finishQueue() });
      }
    }
  }
  private async loadRow(
    row: ManagedMarketsRow,
    digest: `sha256:${string}`,
    signal: AbortSignal,
    current: () => boolean,
  ): Promise<boolean> {
    const { listing } = row;
    this.queued.delete(listing.listingId);
    this.updateRow(listing.listingId, {
      running: true,
      showingPrevious: row.response !== null,
      error: false,
      message: row.response
        ? "Refreshing price history…"
        : "Loading price history…",
    });
    try {
      const response = await this.access.request(
        { catalogSnapshotSha256: digest, listing },
        signal,
      );
      if (!current()) return false;
      this.updateRow(listing.listingId, {
        response,
        showingPrevious: false,
        running: false,
        error: false,
        message: "One-month raw closing prices loaded.",
      });
      return true;
    } catch (error) {
      if (!current()) return false;
      if (this.retireFailedRead(error)) return false;
      return this.settleRowFailure(row, error);
    }
  }
  private settleRowFailure(row: ManagedMarketsRow, error: unknown): boolean {
    const failure = rowFailure(error, this.priceAction());
    this.updateRow(row.listing.listingId, {
      response: failure.keepPrevious ? row.response : null,
      showingPrevious: failure.keepPrevious && row.response !== null,
      running: false,
      error: failure.error,
      message: failure.message,
    });
    if (failure.stop)
      this.update({
        message: `Remaining price requests stopped. ${failure.message}`,
        error: failure.error,
      });
    return !failure.stop;
  }
}
