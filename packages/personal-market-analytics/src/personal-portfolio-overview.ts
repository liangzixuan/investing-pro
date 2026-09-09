import Decimal from "decimal.js";

export const PERSONAL_PORTFOLIO_OVERVIEW_ROUNDING = Object.freeze({
  calculationPrecision: 256,
  moneyDecimalPlaces: 2,
  percentDecimalPlaces: 2,
  method: "round_half_up",
  negativeZero: "normalize_to_positive_zero",
} as const);

type MarketIdentity = Readonly<{
  country: "US";
  exchangeMic: string;
  issuerName: string;
  listingId: string;
  securityName: string;
  symbol: string;
}>;

type Quote = Readonly<{
  change: string | null;
  changePercent: string | null;
  currency: "USD";
  freshness: "current" | "older_than_36_hours";
  ingestedAt: string;
  kind: "derived_realtime_reference" | "end_of_day_close";
  previousClose: string | null;
  price: string;
  sourceTime: string;
}>;

type Holding = Readonly<{
  identity: MarketIdentity;
  shares: string;
  totalCostBasisUsd: string | null;
  confirmedOn: string;
}>;

export interface PersonalPortfolioOverviewInput {
  readonly portfolio: Readonly<{
    currency: "USD";
    cashUsd: string | null;
    holdings: readonly Holding[];
  }>;
  readonly quotes: readonly Readonly<{
    security: MarketIdentity;
    quote: Quote;
  }>[];
  readonly evaluatedAt: string;
}

export interface PersonalPortfolioOverviewHolding {
  readonly listingId: string;
  readonly priceStatus: "priced" | "stale" | "unavailable";
  readonly unavailableReason:
    | null
    | "quote_not_loaded"
    | "invalid_quote"
    | "identity_mismatch"
    | "duplicate_quote"
    | "older_than_36_hours";
  readonly quote: Quote | null;
  readonly marketValueUsd: string | null;
  readonly unrealizedGainUsd: string | null;
  readonly unrealizedGainPercent: string | null;
  readonly allocationPercent: string | null;
}

export interface PersonalPortfolioOverviewResult {
  readonly schemaVersion: "1.0.0";
  readonly currency: "USD";
  readonly evaluatedAt: string;
  readonly holdings: readonly PersonalPortfolioOverviewHolding[];
  readonly coverage: Readonly<{
    totalHoldings: number;
    pricedHoldings: number;
    staleHoldings: number;
    unavailableHoldings: number;
    knownCostBasisHoldings: number;
  }>;
  readonly cashUsd: string | null;
  readonly knownCostBasisSubtotalUsd: string;
  readonly totalCostBasisUsd: string | null;
  readonly pricedHoldingsValueUsd: string;
  readonly pricedHoldingsCostBasisUsd: string | null;
  readonly pricedHoldingsUnrealizedGainUsd: string | null;
  readonly pricedHoldingsUnrealizedGainPercent: string | null;
  readonly holdingsValueUsd: string | null;
  readonly totalValueUsd: string | null;
  readonly unrealizedGainUsd: string | null;
  readonly unrealizedGainPercent: string | null;
  readonly cashAllocationPercent: string | null;
}

const CalculationDecimal = Decimal.clone({
  defaults: true,
  precision: PERSONAL_PORTFOLIO_OVERVIEW_ROUNDING.calculationPrecision,
  rounding: Decimal.ROUND_HALF_UP,
});
const FRESHNESS_MILLISECONDS = 36 * 60 * 60 * 1_000;
const FUTURE_SKEW_MILLISECONDS = 5 * 60 * 1_000;
const MARKET_IDENTITY_KEYS = [
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;

/** Pure valuation of entered holdings; no transaction, tax, or return ledger. */
export function calculatePersonalPortfolioOverview(
  input: PersonalPortfolioOverviewInput,
): PersonalPortfolioOverviewResult {
  try {
    validateInput(input);
    return calculateValidated(input);
  } catch {
    throw new TypeError("Portfolio overview input is invalid.");
  }
}

function calculateValidated(
  input: PersonalPortfolioOverviewInput,
): PersonalPortfolioOverviewResult {
  const { portfolio } = input;
  const evaluatedMilliseconds = Date.parse(input.evaluatedAt);
  let pricedValue = new CalculationDecimal(0);
  let knownBasis = new CalculationDecimal(0);
  let pricedBasis = new CalculationDecimal(0);
  let pricedBasesKnown = true;
  let knownCostBasisHoldings = 0;
  const values: (Decimal | null)[] = [];
  const rows = portfolio.holdings.map((holding) => {
    const basis =
      holding.totalCostBasisUsd === null
        ? null
        : new CalculationDecimal(holding.totalCostBasisUsd);
    if (basis !== null) {
      knownBasis = knownBasis.plus(basis);
      knownCostBasisHoldings += 1;
    }
    const candidates = input.quotes.filter(
      (entry) => entry.security.listingId === holding.identity.listingId,
    );
    const candidate = candidates[0];
    let quote: Quote | null = null;
    let priceStatus: PersonalPortfolioOverviewHolding["priceStatus"] =
      "unavailable";
    let reason: PersonalPortfolioOverviewHolding["unavailableReason"] = null;
    if (candidate === undefined) reason = "quote_not_loaded";
    else if (candidates.length !== 1) reason = "duplicate_quote";
    else if (
      !MARKET_IDENTITY_KEYS.every(
        (key) => candidate.security[key] === holding.identity[key],
      )
    ) {
      reason = "identity_mismatch";
    } else if (!validQuote(candidate.quote, evaluatedMilliseconds)) {
      reason = "invalid_quote";
    } else {
      quote = { ...candidate.quote };
      if (
        quote.freshness === "older_than_36_hours" ||
        evaluatedMilliseconds - Date.parse(quote.sourceTime) >
          FRESHNESS_MILLISECONDS
      ) {
        priceStatus = "stale";
        reason = "older_than_36_hours";
      } else priceStatus = "priced";
    }
    const marketValue =
      priceStatus === "priced" && quote !== null
        ? new CalculationDecimal(holding.shares).times(quote.price)
        : null;
    values.push(marketValue);
    if (marketValue !== null) {
      pricedValue = pricedValue.plus(marketValue);
      if (basis === null) pricedBasesKnown = false;
      else pricedBasis = pricedBasis.plus(basis);
    }
    const gain =
      marketValue === null || basis === null ? null : marketValue.minus(basis);
    return {
      listingId: holding.identity.listingId,
      priceStatus,
      unavailableReason: reason,
      quote,
      marketValueUsd: money(marketValue),
      unrealizedGainUsd: money(gain),
      unrealizedGainPercent: percentage(gain, basis),
      allocationPercent: null,
    } satisfies PersonalPortfolioOverviewHolding;
  });
  const pricedHoldings = rows.filter(
    (row) => row.priceStatus === "priced",
  ).length;
  const staleHoldings = rows.filter(
    (row) => row.priceStatus === "stale",
  ).length;
  const allPriced = pricedHoldings === rows.length;
  const allBasisKnown = knownCostBasisHoldings === rows.length;
  const cash =
    portfolio.cashUsd === null
      ? null
      : new CalculationDecimal(portfolio.cashUsd);
  const totalValue = allPriced && cash !== null ? pricedValue.plus(cash) : null;
  const gain =
    allPriced && allBasisKnown ? pricedValue.minus(knownBasis) : null;
  const pricedGain = pricedBasesKnown ? pricedValue.minus(pricedBasis) : null;
  return freezeDeep({
    schemaVersion: "1.0.0",
    currency: "USD",
    evaluatedAt: input.evaluatedAt,
    holdings: rows.map((row, index) => ({
      ...row,
      allocationPercent: percentage(values[index] ?? null, totalValue),
    })),
    coverage: {
      totalHoldings: rows.length,
      pricedHoldings,
      staleHoldings,
      unavailableHoldings: rows.length - pricedHoldings - staleHoldings,
      knownCostBasisHoldings,
    },
    cashUsd: money(cash),
    knownCostBasisSubtotalUsd: format(knownBasis),
    totalCostBasisUsd: allBasisKnown ? format(knownBasis) : null,
    pricedHoldingsValueUsd: format(pricedValue),
    pricedHoldingsCostBasisUsd: pricedBasesKnown ? format(pricedBasis) : null,
    pricedHoldingsUnrealizedGainUsd: money(pricedGain),
    pricedHoldingsUnrealizedGainPercent: percentage(
      pricedGain,
      pricedBasesKnown ? pricedBasis : null,
    ),
    holdingsValueUsd: allPriced ? format(pricedValue) : null,
    totalValueUsd: money(totalValue),
    unrealizedGainUsd: money(gain),
    unrealizedGainPercent: percentage(gain, allBasisKnown ? knownBasis : null),
    cashAllocationPercent: percentage(cash, totalValue),
  });
}

function validateInput(input: PersonalPortfolioOverviewInput): void {
  if (
    !plainRecord(input) ||
    !instant(input.evaluatedAt) ||
    !plainRecord(input.portfolio) ||
    input.portfolio.currency !== "USD" ||
    (input.portfolio.cashUsd !== null &&
      !manualDecimal(input.portfolio.cashUsd, 2, "1000000000000", true)) ||
    !Array.isArray(input.portfolio.holdings) ||
    input.portfolio.holdings.length > 20 ||
    !Array.isArray(input.quotes) ||
    input.quotes.length > 20
  ) {
    throw new TypeError();
  }
  const listingIds = new Set<string>();
  for (const holding of input.portfolio.holdings) {
    if (
      !plainRecord(holding) ||
      !marketIdentity(holding.identity) ||
      !manualDecimal(holding.shares, 6, "1000000000", false) ||
      (holding.totalCostBasisUsd !== null &&
        !manualDecimal(holding.totalCostBasisUsd, 2, "1000000000000", true)) ||
      !calendarDate(holding.confirmedOn) ||
      holding.confirmedOn > input.evaluatedAt.slice(0, 10) ||
      listingIds.has(holding.identity.listingId)
    ) {
      throw new TypeError();
    }
    listingIds.add(holding.identity.listingId);
  }
  for (const entry of input.quotes) {
    if (
      !plainRecord(entry) ||
      !plainRecord(entry.security) ||
      typeof entry.security.listingId !== "string"
    ) {
      throw new TypeError();
    }
  }
}

function validQuote(value: unknown, now: number): value is Quote {
  if (
    !plainRecord(value) ||
    Reflect.ownKeys(value).length !== 9 ||
    !Object.values(Object.getOwnPropertyDescriptors(value)).every(
      (descriptor) => "value" in descriptor && descriptor.enumerable === true,
    ) ||
    value.currency !== "USD" ||
    (value.kind !== "derived_realtime_reference" &&
      value.kind !== "end_of_day_close") ||
    (value.freshness !== "current" &&
      value.freshness !== "older_than_36_hours") ||
    !ordinaryDecimal(value.price, false) ||
    !instant(value.sourceTime) ||
    !instant(value.ingestedAt) ||
    Date.parse(value.sourceTime) - now > FUTURE_SKEW_MILLISECONDS ||
    Date.parse(value.ingestedAt) - now > FUTURE_SKEW_MILLISECONDS ||
    Date.parse(value.sourceTime) - Date.parse(value.ingestedAt) >
      FUTURE_SKEW_MILLISECONDS ||
    (value.previousClose !== null &&
      !ordinaryDecimal(value.previousClose, false)) ||
    (value.change !== null && !ordinaryDecimal(value.change, true)) ||
    (value.changePercent !== null &&
      !ordinaryDecimal(value.changePercent, true))
  ) {
    return false;
  }
  return true;
}

function manualDecimal(
  value: unknown,
  scale: number,
  maximum: string,
  allowZero: boolean,
): value is string {
  if (
    typeof value !== "string" ||
    value.length > 20 ||
    !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value) ||
    (value.split(".")[1]?.length ?? 0) > scale
  ) {
    return false;
  }
  const parsed = new CalculationDecimal(value);
  return (
    (allowZero ? parsed.greaterThanOrEqualTo(0) : parsed.greaterThan(0)) &&
    parsed.lessThanOrEqualTo(maximum)
  );
}

function ordinaryDecimal(value: unknown, signed: boolean): value is string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value)
  ) {
    return false;
  }
  const parsed = new CalculationDecimal(value);
  return parsed.isFinite() && (signed || parsed.greaterThan(0));
}

function money(value: Decimal | null): string | null {
  return value === null ? null : format(value);
}

function format(value: Decimal): string {
  const rounded = value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return rounded.isZero() ? "0.00" : rounded.toFixed(2);
}

function percentage(
  numerator: Decimal | null,
  denominator: Decimal | null,
): string | null {
  return numerator === null ||
    denominator === null ||
    !denominator.greaterThan(0)
    ? null
    : format(numerator.dividedBy(denominator).times(100));
}

function marketIdentity(value: unknown): value is MarketIdentity {
  return (
    plainRecord(value) &&
    value.country === "US" &&
    typeof value.exchangeMic === "string" &&
    /^[A-Z0-9]{4}$/u.test(value.exchangeMic) &&
    typeof value.listingId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value.listingId) &&
    typeof value.symbol === "string" &&
    /^[A-Z0-9][A-Z0-9.-]{0,14}$/u.test(value.symbol) &&
    displayText(value.issuerName) &&
    displayText(value.securityName)
  );
}

function displayText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    [...value].length <= 512 &&
    !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)
  );
}

function instant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.\d{3}Z$/u.test(
      value,
    )
  ) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function calendarDate(value: unknown): value is string {
  return typeof value === "string" && instant(`${value}T00:00:00.000Z`);
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) freezeDeep(entry);
    Object.freeze(value);
  }
  return value;
}
