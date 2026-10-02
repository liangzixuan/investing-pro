import {
  membershipMatchesResult,
  parseManagedEodError,
  type ManagedEodHistoryResponseDto,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";

export interface EodHistorySelection {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listing: Omit<WatchlistMembership, "note">;
  readonly origin: "discover" | "watchlist";
}
export interface ManagedEodHistoryState {
  readonly selection: EodHistorySelection | null;
  readonly response: ManagedEodHistoryResponseDto | null;
  readonly running: boolean;
  readonly catalogChanged: boolean;
  readonly message: string;
  readonly error: boolean;
}
const empty = (): ManagedEodHistoryState => ({
  selection: null,
  response: null,
  running: false,
  catalogChanged: false,
  message: "",
  error: false,
});

/** Session-only reads; closing or refreshing discards every previously loaded price. */
export class ManagedEodHistory {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private operation: AbortController | null = null;
  private retired = false;
  private nextAllowedAt: string | null = null;

  constructor(
    private readonly read: ManagedApi["eodHistory"],
    private readonly readError: (error: TrialApiError) => void,
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
    this.nextAllowedAt = null;
    this.close();
  }
  cancel() {
    if (!this.operation) return;
    this.operation.abort();
    this.operation = null;
    this.update({
      response: null,
      running: false,
      error: false,
      message: "Close history request cancelled. Load again when ready.",
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
    this.update({ response: null, error: false, message: "" });
    if (this.nextAllowedAt && Date.now() < Date.parse(this.nextAllowedAt)) {
      this.update({
        message: `Close history is available to request after ${this.nextAllowedAt}. Select Load again then.`,
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
      message: `Loading close history for ${selection.listing.symbol}…`,
    });
    try {
      const response = await this.read(
        {
          catalogSnapshotSha256: selection.catalogSnapshotSha256,
          listingId: selection.listing.listingId,
          range: "1m",
        },
        operation.signal,
      );
      if (!current()) return;
      if (
        response.catalogSnapshotSha256 !== selection.catalogSnapshotSha256 ||
        !membershipMatchesResult(
          { ...selection.listing, note: "" },
          response.security,
        )
      )
        throw new TrialApiError("invalid_response");
      this.update({
        response,
        message: "One-month raw closing prices loaded.",
      });
    } catch (error) {
      if (!current()) return;
      if (
        error instanceof TrialApiError &&
        ["unauthenticated", "access_denied", "origin_denied"].includes(
          error.code,
        )
      ) {
        this.readError(error);
        this.retire();
        return;
      }
      let message =
        "Close history could not be loaded. Select Load to try again.";
      let catalogChanged = false;
      if (error instanceof ManagedCatalogChangedError) {
        catalogChanged = true;
        message =
          "The catalog changed. Refresh the catalog and select this listing again.";
      } else if (error instanceof ManagedEodCooldownError) {
        const checked = parseManagedEodError({
          error: "rate_limited",
          nextAllowedAt: error.nextAllowedAt,
        });
        if (checked?.error === "rate_limited") {
          this.nextAllowedAt = checked.nextAllowedAt;
          message = `Close history is available to request after ${checked.nextAllowedAt}. Select Load again then.`;
        }
      } else if (error instanceof ManagedEodHistoryError) {
        if (error.code === "source_rate_limited")
          message =
            "Tiingo is limiting requests. Try loading again later; no reset time was provided.";
        else if (error.code === "not_configured")
          message = "Close history is not configured for this workspace.";
        else if (error.code === "unsupported_listing")
          message = "Close history is not available for this exact listing.";
        else if (error.code === "request_timeout")
          message =
            "The close history request timed out. Select Load to try again.";
      }
      this.update({ response: null, message, error: true, catalogChanged });
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        this.update({ running: false });
      }
    }
  }
}
