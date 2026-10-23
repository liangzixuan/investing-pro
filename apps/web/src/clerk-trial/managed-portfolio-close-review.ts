import {
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryResponseDto,
  type ManagedPortfolioPayload,
  type ManagedEodIdentity,
  type PersonalPortfolioPayload,
} from "@research-cockpit/contracts";
import {
  calculateAuthoredPortfolioCloseReview,
  type AuthoredPortfolioCloseReviewResult,
} from "@research-cockpit/personal-market-analytics";
import {
  type ManagedEodAccess,
  isManagedEodAuthenticationError,
  isManagedEodTransientError,
} from "./managed-eod-access";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
} from "./managed-api";
import { TrialApiError } from "./api";
import {
  hasManagedPriceCoverage,
  MANAGED_PRICE_COVERAGE,
} from "./managed-price-coverage";

export interface PortfolioCloseContext {
  readonly ledger: ManagedPortfolioPayload;
  readonly portfolio: PersonalPortfolioPayload;
  readonly current: () => boolean;
}
export interface PortfolioCloseRow {
  readonly holding: PersonalPortfolioPayload["holdings"][number];
  readonly available: boolean;
  readonly response: ManagedEodHistoryResponseDto | null;
  readonly showingPrevious: boolean;
  readonly running: boolean;
  readonly message: string;
}
export interface PortfolioCloseState {
  readonly rows: readonly PortfolioCloseRow[];
  readonly running: boolean;
  readonly selectedDate: string;
  readonly dates: readonly string[];
  readonly message: string;
}
const empty = (): PortfolioCloseState => ({
  rows: [],
  running: false,
  selectedDate: "",
  dates: [],
  message: "",
});

interface CloseLoad {
  readonly context: PortfolioCloseContext;
  readonly operation: AbortController;
  readonly current: () => boolean;
}
function stopsQueue(error: unknown) {
  if (error instanceof ManagedEodCooldownError) return true;
  if (!(error instanceof ManagedEodHistoryError)) return false;
  return ["source_rate_limited", "not_configured"].includes(error.code);
}
function failedHistory(
  row: PortfolioCloseRow,
  error: unknown,
): Partial<PortfolioCloseRow> {
  const cooldown = error instanceof ManagedEodCooldownError;
  const retain = cooldown || isManagedEodTransientError(error);
  let message =
    "Close history could not be loaded. This holding remains unpriced.";
  if (cooldown)
    message = `Requests are available after ${error.nextAllowedAt}. Previous source dates are unchanged.`;
  else if (retain && row.response)
    message =
      "Refresh failed. Previous history retained with its original dates.";
  return {
    response: retain ? row.response : null,
    running: false,
    showingPrevious: retain && row.response !== null,
    message,
  };
}

function captureCloseHistory(
  received: ManagedEodHistoryResponseDto,
  catalogSnapshotSha256: `sha256:${string}`,
  listingId: string,
) {
  const response = parseManagedEodHistoryResponse(received, {
    catalogSnapshotSha256,
    listingId,
    range: "1m",
  });
  if (!response) throw new TrialApiError("invalid_response");
  return response;
}

/** One mounted, exact-ledger review. Reads are explicit and share the workspace cooldown. */
export class ManagedPortfolioCloseReview {
  private state = empty();
  private context: PortfolioCloseContext | null = null;
  private operation: AbortController | null = null;
  private retired = false;
  private readonly listeners = new Set<() => void>();
  private readonly coverage: readonly ManagedEodIdentity[];
  constructor(
    private readonly access: ManagedEodAccess,
    private readonly readError: (error: TrialApiError) => void,
    private readonly catalogChanged: () => void,
    coverage: readonly ManagedEodIdentity[] = MANAGED_PRICE_COVERAGE,
  ) {
    this.coverage = Object.freeze(
      coverage.map((entry) => Object.freeze({ ...entry })),
    );
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<PortfolioCloseState>) {
    this.state = Object.freeze({ ...this.state, ...next });
    for (const listener of this.listeners) listener();
  }
  enter(context: PortfolioCloseContext | null) {
    if (this.retired || this.context === context) return;
    this.operation?.abort();
    this.operation = null;
    this.context = context;
    this.state = empty();
    const rows = context?.current()
      ? context.portfolio.holdings.map((holding) => {
          const available = hasManagedPriceCoverage(
            holding.identity,
            this.coverage,
          );
          return Object.freeze({
            holding,
            available,
            response: null,
            showingPrevious: false,
            running: false,
            message: available
              ? "Prices not loaded."
              : "Price history is outside this workspace's declared coverage.",
          });
        })
      : [];
    this.update({ rows: Object.freeze(rows) });
  }
  clear() {
    this.operation?.abort();
    this.operation = null;
    this.context = null;
    this.state = empty();
    this.update({});
  }
  retire() {
    this.retired = true;
    this.clear();
  }
  private active(context = this.context) {
    return (
      !this.retired &&
      context !== null &&
      this.context === context &&
      context.current()
    );
  }
  isCurrent(context: PortfolioCloseContext | null) {
    return this.active(context);
  }
  private row(listingId: string, next: Partial<PortfolioCloseRow>) {
    this.update({
      rows: Object.freeze(
        this.state.rows.map((row) =>
          row.holding.identity.listingId === listingId
            ? Object.freeze({ ...row, ...next })
            : row,
        ),
      ),
    });
  }
  private dates() {
    const dates = [
      ...new Set(
        this.state.rows.flatMap(
          (row) => row.response?.rows.map((bar) => bar.date) ?? [],
        ),
      ),
    ]
      .sort()
      .reverse();
    this.update({
      dates: Object.freeze(dates),
      selectedDate: dates.includes(this.state.selectedDate)
        ? this.state.selectedDate
        : (dates[0] ?? ""),
    });
  }
  selectDate(date: string) {
    if (!this.active() || this.operation) return;
    if (!this.state.dates.includes(date)) return;
    this.update({ selectedDate: date });
  }
  cancel() {
    if (!this.operation) return;
    this.operation.abort();
    this.operation = null;
    this.update({
      running: false,
      rows: Object.freeze(
        this.state.rows.map((row) =>
          row.running
            ? Object.freeze({
                ...row,
                running: false,
                showingPrevious: row.response !== null,
                message: row.response
                  ? "Refresh cancelled. Previous history retained."
                  : "Request cancelled.",
              })
            : row,
        ),
      ),
      message: "Loading cancelled. No ledger or saved record changed.",
    });
  }
  review(): AuthoredPortfolioCloseReviewResult | null {
    const context = this.context;
    if (!context || !this.active(context)) return null;
    if (!this.state.selectedDate) return null;
    const ledger = context.ledger;
    const balancesOn =
      ledger.transactions.at(-1)?.date ?? ledger.opening.asOfDate;
    return calculateAuthoredPortfolioCloseReview({
      holdings: context.portfolio.holdings.map((holding) => ({
        listingId: holding.identity.listingId,
        shares: holding.shares,
        confirmedOn: holding.confirmedOn,
      })),
      cashUsd: context.portfolio.cashUsd,
      balancesOn,
      asOfDate: this.state.selectedDate,
      prices: this.state.rows.flatMap(
        (row) =>
          row.response?.rows.map((bar) => ({
            listingId: row.holding.identity.listingId,
            date: bar.date,
            close: bar.close,
          })) ?? [],
      ),
    });
  }
  private failRow(
    error: unknown,
    row: PortfolioCloseRow,
    current: () => boolean,
  ) {
    if (isManagedEodAuthenticationError(error)) {
      this.clear();
      this.readError(error);
      return false;
    }
    if (error instanceof ManagedCatalogChangedError) {
      this.clear();
      this.catalogChanged();
      return false;
    }
    this.row(row.holding.identity.listingId, failedHistory(row, error));
    if (!current()) return false;
    this.dates();
    if (!current()) return false;
    if (!stopsQueue(error)) return true;
    this.update({
      message:
        "Loading stopped. Remaining holdings were not requested; review available values and original source dates.",
    });
    return false;
  }
  private async readRow(row: PortfolioCloseRow, load: CloseLoad) {
    if (!load.current()) return false;
    const id = row.holding.identity.listingId;
    this.row(id, {
      running: true,
      showingPrevious: row.response !== null,
      message: "Loading raw closes…",
    });
    if (!load.current()) return false;
    try {
      const catalogSnapshotSha256 = load.context.ledger
        .snapshotSha256 as `sha256:${string}`;
      const received = await this.access.request(
        { catalogSnapshotSha256, listing: row.holding.identity },
        "1m",
        load.operation.signal,
      );
      if (!load.current()) return false;
      const response = captureCloseHistory(received, catalogSnapshotSha256, id);
      this.row(id, {
        response,
        running: false,
        showingPrevious: false,
        message: "One-month raw closes loaded.",
      });
      if (!load.current()) return false;
      this.dates();
      return load.current();
    } catch (error) {
      if (!load.current()) return false;
      return this.failRow(error, row, load.current);
    }
  }
  private finishLoad(load: CloseLoad) {
    if (this.operation !== load.operation) return;
    this.operation = null;
    if (this.active(load.context)) this.update({ running: false });
    else this.clear();
  }
  private currentLoad(
    context: PortfolioCloseContext,
    operation: AbortController,
  ) {
    return (
      this.active(context) &&
      this.operation === operation &&
      !operation.signal.aborted
    );
  }
  async load() {
    const context = this.context;
    if (!context) return;
    if (!this.active(context) || this.operation) return;
    const rows = this.state.rows.filter((row) => row.available);
    if (!rows.length) return;
    const operation = new AbortController();
    this.operation = operation;
    const load = {
      context,
      operation,
      current: () => this.currentLoad(context, operation),
    };
    this.update({
      running: true,
      message: "Loading eligible holding closes one at a time…",
    });
    try {
      for (const row of rows) {
        if (!(await this.readRow(row, load))) return;
      }
      if (load.current())
        this.update({
          message:
            "Loading finished. Review one observed close date; missing values stay unavailable.",
        });
    } finally {
      this.finishLoad(load);
    }
  }
}
