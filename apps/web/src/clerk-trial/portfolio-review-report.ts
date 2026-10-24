import {
  parsePortfolioPayload,
  parseManagedEodHistoryResponse,
  projectPersonalPortfolioLedger,
  type ManagedPortfolioPayload,
  type PersonalPortfolioPayload,
} from "@research-cockpit/contracts";
import {
  calculateAuthoredPortfolioCloseReview,
  type AuthoredPortfolioCloseReviewResult,
} from "@research-cockpit/personal-market-analytics";
import type {
  PortfolioCloseRow,
  PortfolioCloseState,
} from "./managed-portfolio-close-review";

export interface PreparedPortfolioReviewReport {
  readonly kind: "portfolio_holdings_review";
  readonly preparedAt: string;
  readonly ledger: ManagedPortfolioPayload;
  readonly portfolio: PersonalPortfolioPayload;
  readonly review: AuthoredPortfolioCloseReviewResult;
  readonly sourceRows: readonly PortfolioCloseRow[];
  readonly selectedDate: string;
  readonly dates: readonly string[];
  readonly message: string;
}
interface Input {
  readonly ledger: ManagedPortfolioPayload;
  readonly portfolio: PersonalPortfolioPayload;
  readonly state: PortfolioCloseState;
  readonly review: AuthoredPortfolioCloseReviewResult;
  readonly preparedAt: string;
}
const owned = new WeakSet<object>();
export function isPreparedPortfolioReviewReport(
  value: unknown,
): value is PreparedPortfolioReviewReport {
  return typeof value === "object" && value !== null && owned.has(value);
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}
function same(left: unknown, right: unknown) {
  return canonical(left) === canonical(right);
}
function validUnicode(value: unknown): boolean {
  if (typeof value === "string") return !/\p{Cs}/u.test(value);
  return (
    value === null ||
    typeof value !== "object" ||
    Object.values(value).every(validUnicode)
  );
}
function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
function captureRows(
  state: PortfolioCloseState,
  portfolio: PersonalPortfolioPayload,
) {
  if (
    state.running !== false ||
    state.rows.length !== portfolio.holdings.length
  )
    return null;
  const rows: PortfolioCloseRow[] = [];
  for (const [index, row] of state.rows.entries()) {
    const holding = portfolio.holdings[index];
    if (
      !holding ||
      !same(holding, row.holding) ||
      row.running !== false ||
      typeof row.available !== "boolean" ||
      typeof row.showingPrevious !== "boolean" ||
      typeof row.message !== "string"
    )
      return null;
    const response =
      row.response === null
        ? null
        : parseManagedEodHistoryResponse(row.response, {
            catalogSnapshotSha256:
              portfolio.snapshotSha256 as `sha256:${string}`,
            listingId: holding.identity.listingId,
            range: "1m",
          });
    if (
      row.response !== null &&
      (!response ||
        !row.available ||
        !same(response.security, holding.identity))
    )
      return null;
    if (row.showingPrevious && !response) return null;
    rows.push({
      holding,
      available: row.available,
      response,
      showingPrevious: row.showingPrevious,
      running: false,
      message: row.message,
    });
  }
  return rows;
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
/** Copies one completed, internally consistent review. No request or save occurs. */
export function preparePortfolioReviewReport(
  input: Input,
): PreparedPortfolioReviewReport | null {
  try {
    const { preparedAt, state } = input;
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(preparedAt) ||
      new Date(preparedAt).toISOString() !== preparedAt
    )
      return null;
    const ledger = parsePortfolioPayload(input.ledger);
    if (!ledger) return null;
    const projection = projectPersonalPortfolioLedger(
      ledger,
      preparedAt.slice(0, 10),
    );
    if (
      projection.status !== "valid" ||
      !same(projection.portfolio, input.portfolio)
    )
      return null;
    const portfolio = projection.portfolio;
    const sourceRows = captureRows(state, portfolio);
    if (!sourceRows || typeof state.message !== "string") return null;
    const dates = [
      ...new Set(
        sourceRows.flatMap(
          (row) => row.response?.rows.map((bar) => bar.date) ?? [],
        ),
      ),
    ]
      .sort()
      .reverse();
    if (!dates.includes(state.selectedDate) || !same(dates, state.dates))
      return null;
    const review = capturedReview(
      ledger,
      portfolio,
      sourceRows,
      state.selectedDate,
    );
    if (!same(review, input.review)) return null;
    const report: PreparedPortfolioReviewReport = {
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
    const json = JSON.stringify(report);
    if (
      !validUnicode(report) ||
      new TextEncoder().encode(json).byteLength > 8 * 1024 * 1024
    )
      return null;
    freezeDeep(report);
    owned.add(report);
    return report;
  } catch {
    return null;
  }
}
