import { parseManagedEodHistoryResponse } from "@research-cockpit/contracts";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import {
  createManagedWatchlistComparisonSelection,
  selectManagedWatchlistComparisonRow,
  projectManagedWatchlistComparison,
} from "./managed-watchlist-comparison";
import type {
  ManagedWatchlistPriceRow,
  ManagedWatchlistPricesState,
} from "./managed-watchlist-prices";

export const pathDates = ["2026-09-17", "2026-09-18", "2026-09-19"] as const;
export function pathRow(
  symbol: string,
  closes = ["100", "110", "90"],
  dates: readonly string[] = pathDates,
  display: { symbol?: string; shareClassName?: string } = {},
): ManagedWatchlistPriceRow {
  const listing = {
    ...eodSelection.listing,
    issuerId: `issuer-${symbol.toLowerCase()}`,
    issuerName: `${symbol} Company`,
    securityId: `security-${symbol.toLowerCase()}`,
    securityName: `${symbol} Class A`,
    shareClassId: `class-${symbol.toLowerCase()}`,
    listingId: `listing-${symbol.toLowerCase()}`,
    symbol: display.symbol ?? symbol,
    shareClassName:
      display.shareClassName ?? eodSelection.listing.shareClassName,
  };
  const base = eodResponse();
  const response = parseManagedEodHistoryResponse(
    {
      ...base,
      security: listing,
      rows: dates.map((date, index) => ({ date, close: closes[index]! })),
    },
    {
      catalogSnapshotSha256: base.catalogSnapshotSha256,
      listingId: listing.listingId,
      range: "1m",
    },
  );
  if (!response) throw new Error("Invalid invented price path");
  return {
    handle: Symbol(symbol),
    listing,
    history: {
      selection: { ...eodSelection, listing, origin: "watchlist" },
      available: true,
      response,
      responseOrigin: "watchlist",
      showingPrevious: false,
      running: false,
      catalogChanged: false,
      message: "",
      error: false,
    },
  };
}
export function pathFixture(
  rows = [pathRow("ALFA"), pathRow("BETA", ["100", "95", "120"])],
) {
  const prices: ManagedWatchlistPricesState = {
    active: true,
    canRead: true,
    rows,
    pending: null,
    catalogChanged: false,
  };
  let selection = createManagedWatchlistComparisonSelection();
  for (const [index, side] of ["left", "right"].entries()) {
    selection = selectManagedWatchlistComparisonRow(
      selection,
      selection,
      prices,
      side as "left" | "right",
      rows[index]!,
    );
  }
  return {
    prices,
    selection,
    projection: projectManagedWatchlistComparison(selection, prices),
  };
}
