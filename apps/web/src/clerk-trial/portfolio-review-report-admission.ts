import {
  parsePortfolioPayload,
  projectPersonalPortfolioLedger,
  type ManagedPortfolioPayload,
  type PersonalPortfolioPayload,
} from "@research-cockpit/contracts";
import { calculateAuthoredPortfolioCloseReview } from "@research-cockpit/personal-market-analytics";
import type {
  PortfolioCloseRow,
  PortfolioCloseState,
} from "./managed-portfolio-close-review";
import type {
  PortfolioReviewReportInput,
  PreparedPortfolioReviewReport,
} from "./portfolio-review-report-types";
import { samePortfolioReportData } from "./portfolio-review-report-data";
import { capturePortfolioReportSources } from "./portfolio-review-report-sources";

function assertPreparationTime(preparedAt: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(preparedAt))
    throw new TypeError("Portfolio preparation time is invalid.");
  if (new Date(preparedAt).toISOString() !== preparedAt)
    throw new TypeError("Portfolio preparation time is not canonical.");
}
function captureProjection(
  ledger: ManagedPortfolioPayload,
  input: PortfolioReviewReportInput,
) {
  const projection = projectPersonalPortfolioLedger(
    ledger,
    input.preparedAt.slice(0, 10),
  );
  if (projection.status !== "valid")
    throw new TypeError("Portfolio ledger projection is invalid.");
  if (!samePortfolioReportData(projection.portfolio, input.portfolio))
    throw new TypeError("Portfolio ledger projection differs.");
  return projection.portfolio;
}
function captureLedger(input: PortfolioReviewReportInput) {
  assertPreparationTime(input.preparedAt);
  const ledger = parsePortfolioPayload(input.ledger);
  if (!ledger) throw new TypeError("Portfolio ledger is invalid.");
  return { ledger, portfolio: captureProjection(ledger, input) };
}
function captureObservedDates(
  state: PortfolioCloseState,
  sourceRows: readonly PortfolioCloseRow[],
) {
  const dates = [
    ...new Set(
      sourceRows.flatMap(
        (row) => row.response?.rows.map((bar) => bar.date) ?? [],
      ),
    ),
  ]
    .sort()
    .reverse();
  if (!dates.includes(state.selectedDate))
    throw new TypeError("Portfolio close date was not observed.");
  if (!samePortfolioReportData(dates, state.dates))
    throw new TypeError("Portfolio observed dates differ.");
  return dates;
}
function capturedReview(
  ledger: ManagedPortfolioPayload,
  portfolio: PersonalPortfolioPayload,
  rows: readonly PortfolioCloseRow[],
  date: string,
) {
  return calculateAuthoredPortfolioCloseReview({
    holdings: portfolio.holdings.map((holding) => ({
      listingId: holding.identity.listingId,
      shares: holding.shares,
      confirmedOn: holding.confirmedOn,
    })),
    cashUsd: portfolio.cashUsd,
    balancesOn: ledger.transactions.at(-1)?.date ?? ledger.opening.asOfDate,
    asOfDate: date,
    prices: rows.flatMap(
      (row) =>
        row.response?.rows.map((bar) => ({
          listingId: row.holding.identity.listingId,
          date: bar.date,
          close: bar.close,
        })) ?? [],
    ),
  });
}

function captureCheckedReview(
  input: PortfolioReviewReportInput,
  ledger: ManagedPortfolioPayload,
  portfolio: PersonalPortfolioPayload,
  sourceRows: readonly PortfolioCloseRow[],
) {
  const review = capturedReview(
    ledger,
    portfolio,
    sourceRows,
    input.state.selectedDate,
  );
  if (!samePortfolioReportData(review, input.review))
    throw new TypeError("Portfolio close review differs.");
  return review;
}
/** Admit the ledger, observed sources and exact calculation as one consistent capture. */
export function admitPortfolioReviewReport(
  input: PortfolioReviewReportInput,
): PreparedPortfolioReviewReport {
  const { preparedAt, state } = input;
  const { ledger, portfolio } = captureLedger(input);
  const sourceRows = capturePortfolioReportSources(state, portfolio);
  if (typeof state.message !== "string")
    throw new TypeError("Portfolio review message is invalid.");
  const dates = captureObservedDates(state, sourceRows);
  const review = captureCheckedReview(input, ledger, portfolio, sourceRows);
  return {
    kind: "portfolio_holdings_review",
    preparedAt,
    ledger,
    portfolio,
    review,
    sourceRows,
    selectedDate: state.selectedDate,
    dates,
    message: state.message,
  };
}
