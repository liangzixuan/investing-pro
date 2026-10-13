import { calculatePersonalRawCloseIndex } from "@research-cockpit/personal-market-analytics";
import type { ManagedWatchlistComparisonProjection } from "./managed-watchlist-comparison";

/** Only the existing checked pair and interval supply this view. */
export function projectManagedWatchlistPricePath({
  comparison,
  history,
  left,
  right,
}: ManagedWatchlistComparisonProjection) {
  if (comparison?.status !== "available" || history?.status !== "loaded")
    return null;
  const dates = history.sharedDates.filter(
    (date) => date >= comparison.firstDate && date <= comparison.lastDate,
  );
  const series = comparison.rows.map((row) => ({
    listing: row.listing,
    points: dates.map((date) => {
      const close = row.response.rows.find(
        (value) => value.date === date,
      )!.close;
      return {
        close,
        ...calculatePersonalRawCloseIndex(close, row.firstClose),
      };
    }),
  }));
  const values = series.map((row) => row.points.map((point) => point.value));
  return {
    handles: [left!.handle, right!.handle],
    responses: comparison.rows.map((row) => row.response),
    dates,
    series,
    values,
    plottable: values.every((row) => row.every((value) => value !== null)),
    contentKey: JSON.stringify([
      dates,
      series,
      comparison.rows.map((row) => [
        row.response.catalogSnapshotSha256,
        row.response.requestStartedAt,
        row.response.completedAt,
        row.showingPrevious,
      ]),
    ]),
  };
}

export type ManagedWatchlistPricePath = NonNullable<
  ReturnType<typeof projectManagedWatchlistPricePath>
>;
