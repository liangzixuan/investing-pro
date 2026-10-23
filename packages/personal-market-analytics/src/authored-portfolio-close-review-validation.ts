import Decimal from "decimal.js";

import type { AuthoredPortfolioCloseReviewInput } from "./authored-portfolio-close-review";

const ValidationDecimal = Decimal.clone({
  defaults: true,
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
});
const UNSIGNED_DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;

export function validateCloseReviewInput(
  input: AuthoredPortfolioCloseReviewInput,
): void {
  requireValid(plainRecord(input));
  validateDatesAndCash(input);
  requireValid(Array.isArray(input.holdings));
  requireValid(input.holdings.length <= 20);
  requireValid(Array.isArray(input.prices));
  validateHoldings(input.holdings);
  validatePrices(input.prices);
}

function validateDatesAndCash(input: AuthoredPortfolioCloseReviewInput): void {
  requireValid(calendarDate(input.asOfDate));
  requireValid(calendarDate(input.balancesOn));
  if (input.cashUsd !== null) {
    requireValid(boundedDecimal(input.cashUsd, 2, "1000000000000", true));
  }
}

function validateHoldings(
  holdings: AuthoredPortfolioCloseReviewInput["holdings"],
): void {
  const listingIds = new Set<string>();
  for (const holding of holdings) {
    requireValid(plainRecord(holding));
    requireValid(listingId(holding.listingId));
    requireValid(!listingIds.has(holding.listingId));
    requireValid(boundedDecimal(holding.shares, 6, "1000000000", false));
    requireValid(calendarDate(holding.confirmedOn));
    listingIds.add(holding.listingId);
  }
}

function validatePrices(
  prices: AuthoredPortfolioCloseReviewInput["prices"],
): void {
  const priceDates = new Map<string, Set<string>>();
  for (const price of prices) {
    requireValid(plainRecord(price));
    requireValid(listingId(price.listingId));
    requireValid(calendarDate(price.date));
    requireValid(positiveClose(price.close));
    const dates = priceDates.get(price.listingId) ?? new Set<string>();
    requireValid(!dates.has(price.date));
    dates.add(price.date);
    priceDates.set(price.listingId, dates);
  }
}

function positiveClose(value: unknown): boolean {
  if (!decimalText(value, 64)) return false;
  return new ValidationDecimal(value).greaterThan(0);
}

function boundedDecimal(
  value: unknown,
  scale: number,
  maximum: string,
  allowZero: boolean,
): value is string {
  if (!decimalText(value, 20)) return false;
  if ((value.split(".")[1]?.length ?? 0) > scale) return false;
  const parsed = new ValidationDecimal(value);
  if (parsed.greaterThan(maximum)) return false;
  return allowZero ? parsed.greaterThanOrEqualTo(0) : parsed.greaterThan(0);
}

function decimalText(value: unknown, maximumLength: number): value is string {
  if (typeof value !== "string") return false;
  if (value.length > maximumLength) return false;
  return UNSIGNED_DECIMAL.test(value);
}

function listingId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return value.trim().length > 0;
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString().slice(0, 10) === value;
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object") return false;
  if (value === null) return false;
  if (Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireValid(valid: boolean): void {
  if (!valid) throw new TypeError();
}
