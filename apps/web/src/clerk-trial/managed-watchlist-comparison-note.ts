import type { ManagedPriceComparisonResult } from "./managed-price-comparison";
import { rawCloseChangeNoteText } from "./managed-price-note";
import {
  projectManagedWatchlistComparison,
  type ManagedWatchlistComparisonSelection,
} from "./managed-watchlist-comparison";
import type { ManagedWatchlistPricesState } from "./managed-watchlist-prices";

type AvailableComparison = Extract<
  NonNullable<ManagedPriceComparisonResult>,
  { status: "available" }
>;

function listingEvidence(
  row: AvailableComparison["rows"][number],
  comparison: AvailableComparison,
): string {
  const { listing, response } = row;
  return [
    `${listing.symbol} (${listing.issuerName}; ${listing.securityName}; ${listing.shareClassName}; ${listing.exchangeMic}, ${listing.country}): ${comparison.firstDate} USD ${row.firstClose} to ${comparison.lastDate} USD ${row.lastClose}; ${rawCloseChangeNoteText(row.change)}.`,
    `Source: ${response.provider}; requested window ${response.window.startDate} to ${response.window.endDate}; original request started ${response.requestStartedAt}; completed ${response.completedAt}.`,
    ...(row.showingPrevious
      ? [
          "Retained previous history for this listing; newer prices were not confirmed.",
        ]
      : []),
  ].join(" ");
}

/** Formats only the captured current pair; never reads, edits or saves a note. */
export function getManagedWatchlistComparisonNoteEvidence(
  selection: ManagedWatchlistComparisonSelection,
  prices: ManagedWatchlistPricesState,
): { excerpt: string | null; reason: string | null } {
  const projection = projectManagedWatchlistComparison(selection, prices);
  if (projection.selection !== selection)
    return {
      excerpt: null,
      reason:
        "The loaded comparison changed. Choose the comparison again before adding it.",
    };
  if (
    projection.reason !== null ||
    !projection.left ||
    !projection.right ||
    projection.left.listing.listingId === projection.right.listing.listingId
  )
    return {
      excerpt: null,
      reason:
        "Choose two distinct watchlist listings with loaded histories before adding a comparison.",
    };
  if (projection.left.history.running || projection.right.history.running)
    return {
      excerpt: null,
      reason:
        "Wait for the selected histories to finish refreshing or cancel them before adding the comparison.",
    };
  const comparison = projection.comparison;
  if (comparison?.status !== "available")
    return {
      excerpt: null,
      reason:
        "Choose two shared observed dates in increasing order before adding the comparison.",
    };
  return {
    excerpt: [
      `Observed raw-close watchlist comparison: ${comparison.firstDate} to ${comparison.lastDate}; ${comparison.intervalDateCount} shared observed dates in this interval, ${comparison.sharedDateCount} across the loaded histories.`,
      ...comparison.rows.map((row) => listingEvidence(row, comparison)),
      "Raw closes are not adjusted for splits or dividends and are not live quotes. Missing dates are not filled.",
      "Evidence dates are unchanged; this action does not refresh sources.",
    ].join(" "),
    reason: null,
  };
}
