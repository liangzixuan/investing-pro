import Decimal from "decimal.js";

import type { PersonalPriceValuationScreenIdentity } from "./personal-price-valuation-screen";

export const PERSONAL_MARKET_BOARD_MAXIMUM_ROWS = 6;
export const PERSONAL_MARKET_BOARD_ROUNDING = Object.freeze({
  decimalPlaces: 4,
  method: "round_half_up",
  negativeZero: "normalize_to_positive_zero",
  calculationPrecision: 160,
} as const);
export const PERSONAL_EOD_REFERENCE_ROUNDING = Object.freeze({
  changeSignificantDigits: 15,
  method: "round_half_up",
  negativeZero: "normalize_to_positive_zero",
  previousClose: "round_half_up_at_15_significant_digits",
  price: "source_decimal_text",
} as const);

export type PersonalMarketBoardIdentity = PersonalPriceValuationScreenIdentity;
export interface PersonalMarketBoardBar {
  readonly date: string;
  readonly raw: { readonly close: string };
  readonly adjusted: { readonly close: string };
  readonly splitFactor: string;
}
export interface PersonalMarketBoardHistory {
  readonly security: PersonalMarketBoardIdentity;
  readonly bars: readonly PersonalMarketBoardBar[];
}
export interface PersonalMarketBoardInput {
  readonly rows: readonly {
    readonly identity: PersonalMarketBoardIdentity;
    readonly history: PersonalMarketBoardHistory | null;
  }[];
}
export type PersonalMarketBoardRow =
  | {
      readonly identity: PersonalMarketBoardIdentity;
      readonly status: "available";
      readonly latestDate: string;
      readonly rawClose: string;
      readonly adjustedClose: string;
      readonly previousDate: string | null;
      readonly adjustedChangePercent: string | null;
      readonly changeStatus: "available" | "insufficient_history";
    }
  | {
      readonly identity: PersonalMarketBoardIdentity;
      readonly status: "unavailable";
      readonly reason: "not_loaded" | "no_observations";
    };
export type PersonalMarketBoardRanking =
  | {
      readonly status: "available";
      readonly previousDate: string;
      readonly latestDate: string;
      /** All comparable listings, including unchanged/negative rows. */
      readonly descendingListingIds: readonly string[];
      readonly ascendingListingIds: readonly string[];
    }
  | { readonly status: "insufficient_rows" | "mixed_dates" };
export interface PersonalMarketBoardResult {
  readonly rows: readonly PersonalMarketBoardRow[];
  readonly ranking: PersonalMarketBoardRanking;
}
export interface PersonalEodReferenceInput {
  readonly bars: readonly PersonalMarketBoardBar[];
}
export type PersonalEodReferenceResult =
  | { readonly status: "unavailable"; readonly reason: "no_observations" }
  | {
      readonly status: "available";
      readonly sourceDate: string;
      readonly price: string;
      readonly previousDate: string | null;
      readonly previousClose: string | null;
      readonly change: string | null;
      readonly changePercent: string | null;
    };

// Products of two bounded 64-character decimals remain exact at this precision.
// Division is rounded only for outputs; displayed percentages never determine rank.
const ExactDecimal = Decimal.clone({
  defaults: true,
  precision: PERSONAL_MARKET_BOARD_ROUNDING.calculationPrecision,
  rounding: Decimal.ROUND_HALF_UP,
});
const IDENTITY_KEYS = [
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;
const MAXIMUM_BARS = 4_096;
interface ComparableRow {
  readonly identity: PersonalMarketBoardIdentity;
  readonly latest: PersonalMarketBoardBar;
  readonly previous: PersonalMarketBoardBar;
}

/** Narrow projections only. Catalog/provider admission remains the caller's job. */
export function calculatePersonalMarketBoard(
  input: PersonalMarketBoardInput,
): PersonalMarketBoardResult {
  try {
    const value = record(input, ["rows"]);
    const inputs = denseArray(value.rows, PERSONAL_MARKET_BOARD_MAXIMUM_ROWS);
    if (inputs.length === 0) throw new TypeError();
    const listingIds = new Set<string>();
    const venueSymbols = new Set<string>();
    const comparable: ComparableRow[] = [];
    const rows = inputs.map((candidate): PersonalMarketBoardRow => {
      const entry = record(candidate, ["identity", "history"]);
      const identity = copyIdentity(entry.identity);
      const venueSymbol = `${identity.exchangeMic}:${identity.symbol}`;
      if (listingIds.has(identity.listingId) || venueSymbols.has(venueSymbol))
        throw new TypeError();
      listingIds.add(identity.listingId);
      venueSymbols.add(venueSymbol);
      if (entry.history === null)
        return { identity, status: "unavailable", reason: "not_loaded" };
      const history = record(entry.history, ["security", "bars"]);
      const security = copyIdentity(history.security);
      if (IDENTITY_KEYS.some((key) => identity[key] !== security[key]))
        throw new TypeError();
      const bars = copyBars(history.bars);
      const latest = bars.at(-1);
      if (latest === undefined)
        return { identity, status: "unavailable", reason: "no_observations" };
      const previous = bars.at(-2);
      if (previous !== undefined)
        comparable.push({ identity, latest, previous });
      return {
        identity,
        status: "available",
        latestDate: latest.date,
        rawClose: latest.raw.close,
        adjustedClose: latest.adjusted.close,
        previousDate: previous?.date ?? null,
        adjustedChangePercent:
          previous === undefined
            ? null
            : percent(
                new ExactDecimal(latest.adjusted.close)
                  .div(previous.adjusted.close)
                  .minus(1)
                  .times(100),
              ),
        changeStatus:
          previous === undefined ? "insufficient_history" : "available",
      };
    });
    return freezeDeep({ rows, ranking: rank(comparable) });
  } catch {
    throw new TypeError("Invalid market board input.");
  }
}

/** EOD reference uses raw prices, correcting the previous close for the latest split. */
export function calculatePersonalEodReference(
  input: PersonalEodReferenceInput,
): PersonalEodReferenceResult {
  try {
    const bars = copyBars(record(input, ["bars"]).bars);
    const latest = bars.at(-1);
    if (latest === undefined)
      return Object.freeze({
        status: "unavailable",
        reason: "no_observations",
      });
    const previous = bars.at(-2);
    const split = new ExactDecimal(latest.splitFactor);
    const latestOnPreviousBasis = new ExactDecimal(latest.raw.close).times(
      split,
    );
    return Object.freeze({
      status: "available",
      sourceDate: latest.date,
      price: latest.raw.close,
      previousDate: previous?.date ?? null,
      previousClose:
        previous === undefined
          ? null
          : referenceChange(new ExactDecimal(previous.raw.close).div(split)),
      change:
        previous === undefined
          ? null
          : referenceChange(
              latestOnPreviousBasis.minus(previous.raw.close).div(split),
            ),
      changePercent:
        previous === undefined
          ? null
          : referenceChange(
              latestOnPreviousBasis.div(previous.raw.close).minus(1).times(100),
            ),
    });
  } catch {
    throw new TypeError("Invalid EOD reference input.");
  }
}

function rank(rows: readonly ComparableRow[]): PersonalMarketBoardRanking {
  const first = rows[0];
  if (rows.length < 2 || first === undefined)
    return { status: "insufficient_rows" };
  if (
    rows.some(
      (row) =>
        row.latest.date !== first.latest.date ||
        row.previous.date !== first.previous.date,
    )
  )
    return { status: "mixed_dates" };
  const ordered = (direction: 1 | -1) =>
    [...rows]
      .sort((left, right) => {
        const comparison = new ExactDecimal(left.latest.adjusted.close)
          .times(right.previous.adjusted.close)
          .cmp(
            new ExactDecimal(right.latest.adjusted.close).times(
              left.previous.adjusted.close,
            ),
          );
        return (
          comparison * direction ||
          compareText(left.identity.symbol, right.identity.symbol) ||
          compareText(left.identity.exchangeMic, right.identity.exchangeMic) ||
          compareText(left.identity.listingId, right.identity.listingId)
        );
      })
      .map((row) => row.identity.listingId);
  return {
    status: "available",
    previousDate: first.previous.date,
    latestDate: first.latest.date,
    descendingListingIds: ordered(-1),
    ascendingListingIds: ordered(1),
  };
}

function copyIdentity(value: unknown): PersonalMarketBoardIdentity {
  const identity = record(value, IDENTITY_KEYS);
  if (
    identity.country !== "US" ||
    typeof identity.exchangeMic !== "string" ||
    !/^[A-Z0-9]{4}$/u.test(identity.exchangeMic) ||
    typeof identity.listingId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(identity.listingId) ||
    typeof identity.symbol !== "string" ||
    !/^[A-Z0-9][A-Z0-9.-]{0,31}$/u.test(identity.symbol) ||
    !plainText(identity.issuerName) ||
    !plainText(identity.securityName)
  )
    throw new TypeError();
  return {
    country: "US",
    exchangeMic: identity.exchangeMic,
    issuerName: identity.issuerName,
    listingId: identity.listingId,
    securityName: identity.securityName,
    symbol: identity.symbol,
  };
}
function copyBars(value: unknown): readonly PersonalMarketBoardBar[] {
  let previousDate: string | undefined;
  return denseArray(value, MAXIMUM_BARS).map((candidate) => {
    const bar = record(candidate, ["date", "raw", "adjusted", "splitFactor"]);
    if (
      typeof bar.date !== "string" ||
      !validDate(bar.date) ||
      (previousDate !== undefined && bar.date <= previousDate)
    )
      throw new TypeError();
    previousDate = bar.date;
    return {
      date: bar.date,
      raw: { close: positiveDecimal(record(bar.raw, ["close"]).close) },
      adjusted: {
        close: positiveDecimal(record(bar.adjusted, ["close"]).close),
      },
      splitFactor: positiveDecimal(bar.splitFactor),
    };
  });
}
function positiveDecimal(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value) ||
    !new ExactDecimal(value).gt(0)
  )
    throw new TypeError();
  return value;
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
function denseArray(value: unknown, maximum: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new TypeError();
  for (let index = 0; index < value.length; index += 1)
    if (!Object.hasOwn(value, index)) throw new TypeError();
  return value;
}
function record(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError();
  const prototype: unknown = Object.getPrototypeOf(value);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Reflect.ownKeys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    throw new TypeError();
  return value as Record<string, unknown>;
}
function plainText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[^\p{Cc}\p{Cf}\p{Cs}]+$/u.test(value)
  );
}
function percent(value: Decimal): string {
  const rounded = value.toDecimalPlaces(
    PERSONAL_MARKET_BOARD_ROUNDING.decimalPlaces,
  );
  return (rounded.isZero() ? new ExactDecimal(0) : rounded).toFixed(
    PERSONAL_MARKET_BOARD_ROUNDING.decimalPlaces,
  );
}
function referenceChange(value: Decimal): string {
  const rounded = value.toSignificantDigits(
    PERSONAL_EOD_REFERENCE_ROUNDING.changeSignificantDigits,
  );
  return rounded.isZero() ? "0" : rounded.toFixed();
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function freezeDeep<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  for (const nested of Object.values(value)) freezeDeep(nested);
  return Object.freeze(value);
}
