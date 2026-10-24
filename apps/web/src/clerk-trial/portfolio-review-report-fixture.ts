import {
  projectPersonalPortfolioLedger,
  type ManagedPortfolioPayload,
} from "@research-cockpit/contracts";
import { calculateAuthoredPortfolioCloseReview } from "@research-cockpit/personal-market-analytics";
import type { PortfolioCloseState } from "./managed-portfolio-close-review";
import { eodResponse, eodSelection } from "./eod-history-fixture";

/** Invented capture input only; no provider or saved owner data. */
export function portfolioReviewReportFixture() {
  const ledger: ManagedPortfolioPayload = {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: eodSelection.catalogSnapshotSha256,
    basisMethod: "fifo_with_opening_pool",
    identities: [eodSelection.listing],
    opening: {
      asOfDate: "2026-09-01",
      cashUsd: "10.00",
      holdings: [
        {
          listingId: eodSelection.listing.listingId,
          shares: "2",
          totalCostBasisUsd: null,
          confirmedOn: "2026-09-01",
        },
      ],
    },
    transactions: [],
  };
  return portfolioReviewReportInput(ledger);
}
export function portfolioReviewReportInput(
  ledger: ManagedPortfolioPayload,
  date = "2026-09-19",
  responses = [eodResponse()],
) {
  const projection = projectPersonalPortfolioLedger(ledger);
  if (projection.status !== "valid") throw new Error("Invalid invented ledger");
  const portfolio = projection.portfolio;
  const rows = portfolio.holdings.map((holding, index) => ({
    holding,
    available: index < responses.length,
    response: responses[index] ?? null,
    showingPrevious: false,
    running: false,
    message:
      index < responses.length
        ? "One-month raw closes loaded."
        : "Outside declared coverage.",
  }));
  const state: PortfolioCloseState = {
    rows,
    selectedDate: date,
    dates: [
      ...new Set(
        rows.flatMap((row) => row.response?.rows.map((bar) => bar.date) ?? []),
      ),
    ]
      .sort()
      .reverse(),
    running: false,
    message: "Loading finished.",
  };
  const review = calculateAuthoredPortfolioCloseReview({
    holdings: portfolio.holdings.map((h) => ({
      listingId: h.identity.listingId,
      shares: h.shares,
      confirmedOn: h.confirmedOn,
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
  return {
    ledger,
    portfolio,
    state,
    review,
    preparedAt: "2026-10-24T03:00:00.123Z",
  };
}
