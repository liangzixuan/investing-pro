import type {
  ManagedCompanyFilingsSeed,
  ManagedCompanyFilingsState,
} from "./managed-company-filings";
import type {
  ManagedEodHistorySeed,
  ManagedEodHistoryState,
} from "./managed-eod-history";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedWatchlistFilingsMember } from "./managed-watchlist-filings";

export type WatchlistDailyReviewSource = "price" | "filings";
export type WatchlistDailyReviewDisposition =
  "missing" | "retained" | "unsupported" | "not-selected";
export interface WatchlistDailyReviewPlanRow {
  readonly member: ManagedWatchlistFilingsMember;
  readonly source: WatchlistDailyReviewSource;
  readonly disposition: WatchlistDailyReviewDisposition;
  readonly price: ManagedEodHistoryState;
  readonly filings: ManagedCompanyFilingsState;
}
export interface WatchlistDailyReviewPlan {
  readonly names: readonly WatchlistDailyReviewSource[];
  readonly rows: readonly WatchlistDailyReviewPlanRow[];
}
export type WatchlistDailyReviewOutcomeStatus =
  | Exclude<WatchlistDailyReviewDisposition, "missing">
  | "unattempted"
  | "running"
  | "loaded"
  | "verified-empty"
  | "unavailable"
  | "failed"
  | "cooldown"
  | "cancelled";
export interface WatchlistDailyReviewOutcome extends WatchlistDailyReviewPlanRow {
  readonly status: WatchlistDailyReviewOutcomeStatus;
}
export interface WatchlistDailyReviewState {
  readonly phase: "ready" | "running" | "settled" | "finished";
  readonly plan: WatchlistDailyReviewPlan | null;
  readonly outcomes: readonly WatchlistDailyReviewOutcome[];
}
export interface ManagedWatchlistDailyReviewCapture {
  readonly member: ManagedWatchlistFilingsMember;
  readonly price: ManagedEodHistoryState;
  readonly filings: ManagedCompanyFilingsState;
}
export interface ManagedWatchlistDailyReviewHandoff {
  readonly selection: ManagedResearchSelection;
  readonly priceSeed: ManagedEodHistorySeed | null;
  readonly filingsSeed: ManagedCompanyFilingsSeed | null;
}

/** A complete passive plan. Admission and consumption belong to the group owner. */
export function watchlistDailyReviewPlan(
  rows: readonly ManagedWatchlistDailyReviewCapture[],
  names: readonly WatchlistDailyReviewSource[],
): WatchlistDailyReviewPlan | null {
  if (
    !rows.length ||
    rows.length > 5 ||
    new Set(rows.map((row) => row.member)).size !== rows.length ||
    !names.length ||
    names.length > 2 ||
    new Set(names).size !== names.length ||
    names.some((name) => name !== "price" && name !== "filings")
  )
    return null;
  const sources = ["price", "filings"] as const;
  return Object.freeze({
    names: Object.freeze(sources.filter((source) => names.includes(source))),
    rows: Object.freeze(
      rows.flatMap((row) =>
        sources.map((source): WatchlistDailyReviewPlanRow =>
          Object.freeze({
            ...row,
            source,
            disposition: !names.includes(source)
              ? "not-selected"
              : row[source].response
                ? "retained"
                : (
                      source === "price"
                        ? row.price.available
                        : row.filings.supported
                    )
                  ? "missing"
                  : "unsupported",
          }),
        ),
      ),
    ),
  });
}
export function dailyReviewOutcomes(
  plan: WatchlistDailyReviewPlan,
): readonly WatchlistDailyReviewOutcome[] {
  return Object.freeze(
    plan.rows.map((row) =>
      Object.freeze({
        ...row,
        status: row.disposition === "missing" ? "unattempted" : row.disposition,
      }),
    ),
  );
}

/** Classify the settled source without discarding retained response evidence. */
export function watchlistDailyReviewResult(
  source: WatchlistDailyReviewSource,
  price: ManagedEodHistoryState,
  filings: ManagedCompanyFilingsState,
  cooldown: boolean,
): WatchlistDailyReviewOutcomeStatus {
  if (cooldown) return "cooldown";
  if (source === "price") {
    if (!price.response || price.error) return "failed";
    return price.response.rows.length ? "loaded" : "verified-empty";
  }
  if (filings.response?.issuer.status === "available")
    return filings.response.issuer.filings.length ? "loaded" : "verified-empty";
  if (filings.lastCheck?.issuer.status === "rate_limited") return "cooldown";
  return filings.response ? "unavailable" : "failed";
}
