import Decimal from "decimal.js";

export interface AuthoredPortfolioCloseReviewHolding {
  readonly listingId: string;
  readonly shares: string;
  readonly confirmedOn: string;
}

export interface AuthoredPortfolioCloseReviewPrice {
  readonly listingId: string;
  readonly date: string;
  readonly close: string;
}

export interface AuthoredPortfolioCloseReviewInput {
  readonly holdings: readonly AuthoredPortfolioCloseReviewHolding[];
  readonly cashUsd: string | null;
  readonly balancesOn: string;
  readonly asOfDate: string;
  readonly prices: readonly AuthoredPortfolioCloseReviewPrice[];
}

export type AuthoredPortfolioCloseReviewLine =
  AuthoredPortfolioCloseReviewHolding &
    (
      | Readonly<{
          status: "priced";
          reason: null;
          close: string;
          valueUsd: string;
        }>
      | Readonly<{
          status: "unavailable";
          reason: "balance_after_close" | "close_not_loaded";
          close: null;
          valueUsd: null;
        }>
    );

export interface AuthoredPortfolioCloseReviewResult {
  readonly asOfDate: string;
  readonly balancesOn: string;
  readonly holdings: readonly AuthoredPortfolioCloseReviewLine[];
  readonly pricedHoldings: number;
  readonly totalHoldings: number;
  readonly pricedHoldingsSubtotalUsd: string;
  readonly holdingsValueUsd: string | null;
  readonly cashUsd: string | null;
  readonly totalValueUsd: string | null;
  readonly method: "each_holding_round_half_up_to_cents_then_sum";
}

const CalculationDecimal = Decimal.clone({
  defaults: true,
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
});
const UNSIGNED_DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;

/** Values current authored balances using one exact close date. */
export function calculateAuthoredPortfolioCloseReview(
  input: AuthoredPortfolioCloseReviewInput,
): AuthoredPortfolioCloseReviewResult {
  try {
    validateInput(input);
    return calculateValidated(input);
  } catch {
    throw new TypeError("Portfolio close review input is invalid.");
  }
}

function calculateValidated(
  input: AuthoredPortfolioCloseReviewInput,
): AuthoredPortfolioCloseReviewResult {
  const prices = new Map(
    input.prices
      .filter((price) => price.date === input.asOfDate)
      .map((price) => [price.listingId, price.close]),
  );
  const balancesEligible = input.asOfDate >= input.balancesOn;
  let subtotal = new CalculationDecimal(0);
  let pricedHoldings = 0;
  const holdings = input.holdings.map(
    (holding): AuthoredPortfolioCloseReviewLine => {
      const copied = {
        listingId: holding.listingId,
        shares: holding.shares,
        confirmedOn: holding.confirmedOn,
      };
      if (!balancesEligible || input.asOfDate < holding.confirmedOn) {
        return Object.freeze({
          ...copied,
          status: "unavailable",
          reason: "balance_after_close",
          close: null,
          valueUsd: null,
        });
      }
      const close = prices.get(holding.listingId);
      if (close === undefined) {
        return Object.freeze({
          ...copied,
          status: "unavailable",
          reason: "close_not_loaded",
          close: null,
          valueUsd: null,
        });
      }
      const valueUsd = new CalculationDecimal(holding.shares)
        .times(close)
        .toFixed(2, Decimal.ROUND_HALF_UP);
      subtotal = subtotal.plus(valueUsd);
      pricedHoldings += 1;
      return Object.freeze({
        ...copied,
        status: "priced",
        reason: null,
        close,
        valueUsd,
      });
    },
  );
  const complete = balancesEligible && pricedHoldings === holdings.length;
  const cashUsd =
    input.cashUsd === null
      ? null
      : new CalculationDecimal(input.cashUsd).toFixed(2);
  return Object.freeze({
    asOfDate: input.asOfDate,
    balancesOn: input.balancesOn,
    holdings: Object.freeze(holdings),
    pricedHoldings,
    totalHoldings: holdings.length,
    pricedHoldingsSubtotalUsd: subtotal.toFixed(2),
    holdingsValueUsd: complete ? subtotal.toFixed(2) : null,
    cashUsd,
    totalValueUsd:
      complete && cashUsd !== null ? subtotal.plus(cashUsd).toFixed(2) : null,
    method: "each_holding_round_half_up_to_cents_then_sum",
  });
}

function validateInput(input: AuthoredPortfolioCloseReviewInput): void {
  if (
    !plainRecord(input) ||
    !calendarDate(input.asOfDate) ||
    !calendarDate(input.balancesOn) ||
    !Array.isArray(input.holdings) ||
    input.holdings.length > 20 ||
    !Array.isArray(input.prices) ||
    (input.cashUsd !== null &&
      !boundedDecimal(input.cashUsd, 2, "1000000000000", true))
  ) {
    throw new TypeError();
  }
  const listingIds = new Set<string>();
  for (const holding of input.holdings) {
    if (
      !plainRecord(holding) ||
      !listingId(holding.listingId) ||
      listingIds.has(holding.listingId) ||
      !boundedDecimal(holding.shares, 6, "1000000000", false) ||
      !calendarDate(holding.confirmedOn)
    ) {
      throw new TypeError();
    }
    listingIds.add(holding.listingId);
  }
  const priceDates = new Map<string, Set<string>>();
  for (const price of input.prices) {
    if (
      !plainRecord(price) ||
      !listingId(price.listingId) ||
      !calendarDate(price.date) ||
      !decimalText(price.close, 64) ||
      !new CalculationDecimal(price.close).greaterThan(0)
    ) {
      throw new TypeError();
    }
    const dates = priceDates.get(price.listingId) ?? new Set<string>();
    if (dates.has(price.date)) throw new TypeError();
    dates.add(price.date);
    priceDates.set(price.listingId, dates);
  }
}

function boundedDecimal(
  value: unknown,
  scale: number,
  maximum: string,
  allowZero: boolean,
): value is string {
  if (!decimalText(value, 20) || (value.split(".")[1]?.length ?? 0) > scale) {
    return false;
  }
  const parsed = new CalculationDecimal(value);
  return (
    (allowZero ? parsed.greaterThanOrEqualTo(0) : parsed.greaterThan(0)) &&
    parsed.lessThanOrEqualTo(maximum)
  );
}

function decimalText(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length <= maximumLength &&
    UNSIGNED_DECIMAL.test(value)
  );
}

function listingId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function calendarDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u.test(value)
  ) {
    return false;
  }
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
