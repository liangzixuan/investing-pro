import type { ManagedEodHistoryResponseDto } from "@research-cockpit/contracts";
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

export interface EodHistorySelection extends ManagedEodAccessSelection {
  readonly cik: string | null;
  readonly origin: "discover" | "watchlist" | "markets" | "route";
}
export interface ManagedEodHistoryState {
  readonly selection: EodHistorySelection | null;
  readonly response: ManagedEodHistoryResponseDto | null;
  readonly showingPrevious: boolean;
  readonly running: boolean;
  readonly catalogChanged: boolean;
  readonly message: string;
  readonly error: boolean;
}
const empty = (): ManagedEodHistoryState => ({
  selection: null,
  response: null,
  showingPrevious: false,
  running: false,
  catalogChanged: false,
  message: "",
  error: false,
});

/** Session-only reads; a recoverable refresh keeps the last validated history. */
export class ManagedEodHistory {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private operation: AbortController | null = null;
  private retired = false;

  constructor(
    read: ManagedApi["eodHistory"],
    private readonly readError: (error: TrialApiError) => void,
    private readonly access = new ManagedEodAccess(read),
  ) {}
  getSnapshot = (): ManagedEodHistoryState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<ManagedEodHistoryState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }
  open(selection: EodHistorySelection) {
    if (this.retired) return;
    this.close();
    this.update({
      selection: Object.freeze({
        ...selection,
        listing: Object.freeze({ ...selection.listing }),
      }),
      message: "Load one month of raw closing prices when you are ready.",
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
        ? "Close history refresh cancelled. Refresh again when ready."
        : "Close history request cancelled. Load again when ready.",
    });
  }
  async load() {
    const selection = this.state.selection;
    if (
      this.retired ||
      !selection ||
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
      const response = await this.access.request(selection, operation.signal);
      if (!current()) return;
      this.update({
        response,
        showingPrevious: false,
        message: "One-month raw closing prices loaded.",
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
        ? "The close history refresh failed. Select Refresh to try again."
        : "Close history could not be loaded. Select Load to try again.";
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
          message = showingPrevious
            ? "Tiingo is limiting requests. Try refreshing again later; no reset time was provided."
            : "Tiingo is limiting requests. Try loading again later; no reset time was provided.";
        else if (error.code === "not_configured")
          message = "Close history is not configured for this workspace.";
        else if (error.code === "unsupported_listing")
          message = "Close history is not available for this exact listing.";
        else if (error.code === "request_timeout")
          message = showingPrevious
            ? "The close history refresh timed out. Select Refresh to try again."
            : "The close history request timed out. Select Load to try again.";
      }
      this.update({
        response: showingPrevious ? this.state.response : null,
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
    return this.state.response
      ? `Refresh deferred. Close history is available to request after ${nextAllowedAt}. Select Refresh again then.`
      : `Close history is available to request after ${nextAllowedAt}. Select Load again then.`;
  }
}
