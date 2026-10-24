import {
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryResponseDto,
  type PersonalPortfolioPayload,
} from "@research-cockpit/contracts";
import type {
  PortfolioCloseRow,
  PortfolioCloseState,
} from "./managed-portfolio-close-review";
import { samePortfolioReportData } from "./portfolio-review-report-data";

type Holding = PersonalPortfolioPayload["holdings"][number];
function assertCompletedRow(row: PortfolioCloseRow) {
  if (row.running !== false)
    throw new TypeError("Portfolio source is running.");
  if (
    ![row.available, row.showingPrevious].every(
      (value) => typeof value === "boolean",
    )
  )
    throw new TypeError("Portfolio source flags are invalid.");
  if (typeof row.message !== "string")
    throw new TypeError("Portfolio source message is invalid.");
}
function assertSourceHolding(
  row: PortfolioCloseRow,
  source: ManagedEodHistoryResponseDto,
  holding: Holding,
) {
  if (!row.available)
    throw new TypeError("Portfolio source is outside declared coverage.");
  if (!samePortfolioReportData(source.security, holding.identity))
    throw new TypeError("Portfolio source identity differs.");
}
function captureSource(
  row: PortfolioCloseRow,
  holding: Holding,
  portfolio: PersonalPortfolioPayload,
) {
  if (row.response === null) return null;
  const response = parseManagedEodHistoryResponse(row.response, {
    catalogSnapshotSha256: portfolio.snapshotSha256 as `sha256:${string}`,
    listingId: holding.identity.listingId,
    range: "1m",
  });
  if (!response) throw new TypeError("Portfolio source packet is invalid.");
  assertSourceHolding(row, response, holding);
  return response;
}
function assertRetainedSource(
  row: PortfolioCloseRow,
  source: ManagedEodHistoryResponseDto | null,
) {
  if (!row.showingPrevious) return;
  if (!source) throw new TypeError("Portfolio retained source is missing.");
}
function captureRow(
  row: PortfolioCloseRow,
  holding: Holding | undefined,
  portfolio: PersonalPortfolioPayload,
): PortfolioCloseRow {
  if (!holding) throw new TypeError("Portfolio holding is missing.");
  if (!samePortfolioReportData(holding, row.holding))
    throw new TypeError("Portfolio holding differs.");
  assertCompletedRow(row);
  const response = captureSource(row, holding, portfolio);
  assertRetainedSource(row, response);
  return {
    holding,
    available: row.available,
    response,
    showingPrevious: row.showingPrevious,
    running: false,
    message: row.message,
  };
}
/** Own every completed source row and bind its exact identity to the projection. */
export function capturePortfolioReportSources(
  state: PortfolioCloseState,
  portfolio: PersonalPortfolioPayload,
): readonly PortfolioCloseRow[] {
  if (state.running !== false)
    throw new TypeError("Portfolio source loads are running.");
  if (state.rows.length !== portfolio.holdings.length)
    throw new TypeError("Portfolio source rows differ.");
  return state.rows.map((row, index) =>
    captureRow(row, portfolio.holdings[index], portfolio),
  );
}
