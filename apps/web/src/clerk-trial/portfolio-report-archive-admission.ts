import {
  assertPersonalSecJsonUniqueKeys,
  parseManagedEodHistoryResponse,
  parsePortfolioPayload,
  projectPersonalPortfolioLedger,
  type PersonalPortfolioPayload,
} from "@research-cockpit/contracts";
import { calculateAuthoredPortfolioCloseReview } from "@research-cockpit/personal-market-analytics";
import type { PortfolioCloseRow } from "./managed-portfolio-close-review";
import { admitPortfolioReviewReport } from "./portfolio-review-report-admission";
import { samePortfolioReportData } from "./portfolio-review-report-data";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!isObject(value))
    throw new TypeError("Portfolio archive object is invalid.");
  return value;
}
function string(value: unknown): string {
  if (typeof value !== "string" || /\p{Cs}/u.test(value))
    throw new TypeError("Portfolio archive text is invalid.");
  return value;
}
function hash(value: string): value is `sha256:${string}` {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}
function unicode(value: unknown): void {
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) || Object.is(value, -0))
  )
    throw new TypeError("Portfolio archive number is invalid.");
  if (typeof value === "string") string(value);
  else if (Array.isArray(value)) value.forEach(unicode);
  else if (typeof value === "object" && value !== null)
    Object.entries(value).forEach(([key, entry]) => {
      string(key);
      unicode(entry);
    });
}
function sourceRows(raw: unknown, portfolio: PersonalPortfolioPayload) {
  if (!Array.isArray(raw) || raw.length !== portfolio.holdings.length)
    throw new TypeError("Portfolio archive source roster differs.");
  const snapshot = portfolio.snapshotSha256;
  if (!hash(snapshot))
    throw new TypeError("Portfolio archive catalog is invalid.");
  return portfolio.holdings.map((holding, index): PortfolioCloseRow => {
    const row = object(raw[index]);
    if (
      row.running !== false ||
      typeof row.available !== "boolean" ||
      typeof row.showingPrevious !== "boolean" ||
      !samePortfolioReportData(row.holding, holding)
    )
      throw new TypeError("Portfolio archive source identity or flags differ.");
    const response =
      row.response === null
        ? null
        : parseManagedEodHistoryResponse(row.response, {
            catalogSnapshotSha256: snapshot,
            listingId: holding.identity.listingId,
            range: "1m",
          });
    if (
      row.response !== null &&
      (!response || !samePortfolioReportData(response, row.response))
    )
      throw new TypeError("Portfolio archive source packet is invalid.");
    return {
      holding,
      response,
      available: row.available,
      showingPrevious: row.showingPrevious,
      running: false,
      message: string(row.message),
    };
  });
}

/** Reconstruct typed data through the existing contracts, then re-admit the complete capture. */
export function admitPortfolioReportArchiveJson(text: string) {
  assertPersonalSecJsonUniqueKeys(text);
  const raw = object(JSON.parse(text));
  unicode(raw);
  const preparedAt = string(raw.preparedAt);
  const ledger = parsePortfolioPayload(raw.ledger);
  if (!ledger) throw new TypeError("Portfolio archive ledger is invalid.");
  const projection = projectPersonalPortfolioLedger(
    ledger,
    preparedAt.slice(0, 10),
  );
  if (
    projection.status !== "valid" ||
    !samePortfolioReportData(raw.portfolio, projection.portfolio)
  )
    throw new TypeError("Portfolio archive projection differs.");
  const portfolio = projection.portfolio;
  const rows = sourceRows(raw.sourceRows, portfolio);
  const selectedDate = string(raw.selectedDate);
  if (!Array.isArray(raw.dates))
    throw new TypeError("Portfolio archive dates are invalid.");
  const dates = raw.dates.map(string);
  const message = string(raw.message);
  const review = calculateAuthoredPortfolioCloseReview({
    holdings: portfolio.holdings.map(({ identity, shares, confirmedOn }) => ({
      listingId: identity.listingId,
      shares,
      confirmedOn,
    })),
    cashUsd: portfolio.cashUsd,
    balancesOn: ledger.transactions.at(-1)?.date ?? ledger.opening.asOfDate,
    asOfDate: selectedDate,
    prices: rows.flatMap(
      (row) =>
        row.response?.rows.map((bar) => ({
          listingId: row.holding.identity.listingId,
          date: bar.date,
          close: bar.close,
        })) ?? [],
    ),
  });
  const admitted = admitPortfolioReviewReport({
    ledger,
    portfolio,
    preparedAt,
    review,
    state: { rows, selectedDate, dates, message, running: false },
  });
  // Includes every original field: no unknown properties, dropped source fields or forged totals.
  if (!samePortfolioReportData(raw, admitted))
    throw new TypeError(
      "Portfolio archive capture differs from its admitted evidence.",
    );
  return admitted;
}
