import {
  membershipMatchesResult,
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryResponseDto,
  type ManagedEodHistoryRange,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import type { TrialApiError } from "./api";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import {
  ManagedEodAccess,
  isManagedEodAuthenticationError,
  isManagedEodTransientError,
  type ManagedEodAccessSelection,
} from "./managed-eod-access";

import {
  MANAGED_PRICE_COVERAGE,
  hasManagedPriceCoverage,
} from "./managed-price-coverage";

export interface EodHistorySelection extends ManagedEodAccessSelection {
  readonly cik: string | null;
  readonly origin: "discover" | "watchlist" | "markets" | "route";
}
export interface ManagedEodHistorySeed {
  readonly response: ManagedEodHistoryResponseDto;
  readonly showingPrevious: boolean;
}
export interface ManagedEodHistoryState {
  readonly selection: EodHistorySelection | null;
  readonly available: boolean;
  readonly selectedRange: ManagedEodHistoryRange;
  readonly response: ManagedEodHistoryResponseDto | null;
  readonly responseOrigin: "markets" | "watchlist" | "company" | null;
  readonly showingPrevious: boolean;
  readonly running: boolean;
  readonly catalogChanged: boolean;
  readonly message: string;
  readonly error: boolean;
}
const empty = (): ManagedEodHistoryState => ({
  selection: null,
  available: false,
  selectedRange: "1m",
  response: null,
  responseOrigin: null,
  showingPrevious: false,
  running: false,
  catalogChanged: false,
  message: "",
  error: false,
});

/** Revalidate and own a handoff packet without changing its source dates. */
export function captureManagedEodHistorySeed(
  selection: EodHistorySelection,
  seed: ManagedEodHistorySeed,
): ManagedEodHistorySeed | null {
  if (
    (selection.origin !== "markets" && selection.origin !== "watchlist") ||
    typeof seed.showingPrevious !== "boolean"
  )
    return null;
  const response = parseManagedEodHistoryResponse(seed.response, {
    catalogSnapshotSha256: selection.catalogSnapshotSha256,
    listingId: selection.listing.listingId,
    range: "1m",
  });
  return response &&
    membershipMatchesResult(
      { ...selection.listing, note: "" },
      response.security,
    )
    ? Object.freeze({ response, showingPrevious: seed.showingPrevious })
    : null;
}

/** Session-only reads; a recoverable refresh keeps the last validated history. */
export class ManagedEodHistory {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private operation: AbortController | null = null;
  private retired = false;
  private readonly priceCoverage: readonly ManagedEodIdentity[];

  constructor(
    read: ManagedApi["eodHistory"],
    private readonly readError: (error: TrialApiError) => void,
    private readonly access = new ManagedEodAccess(read),
    priceCoverage: readonly ManagedEodIdentity[] = MANAGED_PRICE_COVERAGE,
    private readonly requestOrigin: "company" | "watchlist" = "company",
  ) {
    this.priceCoverage = Object.freeze(
      priceCoverage.map((entry) => Object.freeze({ ...entry })),
    );
  }
  getSnapshot = (): ManagedEodHistoryState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<ManagedEodHistoryState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }
  hasPriceCoverage(listing: EodHistorySelection["listing"]): boolean {
    return hasManagedPriceCoverage(listing, this.priceCoverage);
  }
  open(selection: EodHistorySelection, seed?: ManagedEodHistorySeed) {
    if (this.retired) return;
    this.close();
    const captured = Object.freeze({
      ...selection,
      listing: Object.freeze({ ...selection.listing }),
    });
    if (!this.hasPriceCoverage(captured.listing)) {
      this.update({
        selection: captured,
        message:
          "Price history is not available for this listing in this workspace.",
      });
      return;
    }
    const admitted = seed ? captureManagedEodHistorySeed(captured, seed) : null;
    const response = admitted?.response ?? null;
    const source = captured.origin === "watchlist" ? "watchlist" : "Markets";
    const guidance =
      this.requestOrigin === "company"
        ? "Choose a range and load raw closing prices when you are ready."
        : "Load one month of raw closing prices when you are ready.";
    this.update({
      selection: captured,
      available: true,
      response,
      responseOrigin: response
        ? captured.origin === "watchlist"
          ? "watchlist"
          : "markets"
        : null,
      showingPrevious: admitted?.showingPrevious ?? false,
      error: seed !== undefined && response === null,
      message: response
        ? `Loaded ${source} history is available in this company visit.`
        : seed !== undefined
          ? `The loaded ${source} history could not be reused. ${guidance}`
          : guidance,
    });
  }
  close() {
    this.operation?.abort();
    this.operation = null;
    this.state = empty();
    for (const listener of this.listeners) listener();
  }
  retire() {
    this.retired = true;
    this.close();
  }
  cancel() {
    if (!this.operation) return;
    this.operation.abort();
    this.operation = null;
    this.update({
      running: false,
      showingPrevious: this.state.response !== null,
      error: false,
      message: this.state.response
        ? "Close history refresh cancelled. Try again when ready."
        : "Close history request cancelled. Try again when ready.",
    });
  }
  selectRange(range: ManagedEodHistoryRange) {
    if (
      this.retired ||
      this.requestOrigin !== "company" ||
      !this.state.available ||
      this.operation ||
      this.state.catalogChanged ||
      (range !== "1m" && range !== "1y") ||
      range === this.state.selectedRange
    )
      return;
    this.update({ selectedRange: range });
  }
  async load() {
    const selection = this.state.selection;
    const range = this.state.selectedRange;
    if (
      this.retired ||
      !selection ||
      !this.state.available ||
      this.operation ||
      this.state.catalogChanged
    )
      return;
    const nextAllowedAt = this.access.getNextAllowedAt();
    if (nextAllowedAt) {
      this.update({
        showingPrevious: this.state.response !== null,
        error: false,
        message: this.cooldownMessage(nextAllowedAt),
      });
      return;
    }
    const operation = new AbortController();
    this.operation = operation;
    const current = () =>
      !this.retired &&
      this.operation === operation &&
      !operation.signal.aborted &&
      this.state.selection === selection;
    this.update({
      running: true,
      showingPrevious: this.state.response !== null,
      error: false,
      message: this.state.response
        ? `Refreshing close history for ${selection.listing.symbol}…`
        : `Loading close history for ${selection.listing.symbol}…`,
    });
    try {
      const response = await this.access.request(
        selection,
        range,
        operation.signal,
      );
      if (!current()) return;
      this.update({
        response,
        responseOrigin: this.requestOrigin,
        showingPrevious: false,
        message:
          range === "1m"
            ? "One-month raw closing prices loaded."
            : "Raw closing prices loaded for the one-year request.",
      });
    } catch (error) {
      if (!current()) return;
      if (isManagedEodAuthenticationError(error)) {
        this.readError(error);
        this.retire();
        return;
      }
      const showingPrevious =
        this.state.response !== null && isManagedEodTransientError(error);
      let message = showingPrevious
        ? "The close history refresh failed. Try again when ready."
        : "Close history could not be loaded. Try again when ready.";
      let catalogChanged = false;
      if (error instanceof ManagedCatalogChangedError) {
        catalogChanged = true;
        message =
          "The catalog changed. Refresh the catalog and select this listing again.";
      } else if (error instanceof ManagedEodCooldownError) {
        this.update({
          showingPrevious: this.state.response !== null,
          message: this.cooldownMessage(error.nextAllowedAt),
          error: false,
        });
        return;
      } else if (error instanceof ManagedEodHistoryError) {
        if (error.code === "source_rate_limited")
          message =
            "Tiingo is limiting requests. Try again later; no reset time was provided.";
        else if (error.code === "not_configured")
          message = "Close history is not configured for this workspace.";
        else if (error.code === "unsupported_listing")
          message = "Close history is not available for this exact listing.";
        else if (error.code === "request_timeout")
          message = showingPrevious
            ? "The close history refresh timed out. Try again when ready."
            : "The close history request timed out. Try again when ready.";
      }
      this.update({
        response: showingPrevious ? this.state.response : null,
        responseOrigin: showingPrevious ? this.state.responseOrigin : null,
        showingPrevious,
        message,
        error: true,
        catalogChanged,
      });
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        this.update({ running: false });
      }
    }
  }
  private cooldownMessage(nextAllowedAt: string) {
    return `Close history is available to request after ${nextAllowedAt}. Try again then.`;
  }
}
