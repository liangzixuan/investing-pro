import {
  isPersonalPortfolioIdentity,
  projectPersonalPortfolioLedger,
  type PersonalMarketDataRangeDto,
  type PersonalMarketOverviewDto,
  type PersonalPortfolioIdentity,
  type PersonalPortfolioLedgerPayload,
} from "@research-cockpit/contracts";

import { assessPortfolioHistory } from "./personal-portfolio-history";

export interface PersonalPortfolioValuationHistoryInput {
  readonly ledger: PersonalPortfolioLedgerPayload;
  readonly startDate: string;
  readonly endDate: string;
  readonly histories: readonly Readonly<{
    identity: PersonalPortfolioIdentity;
    history: PersonalMarketOverviewDto["history"];
  }>[];
  readonly priorSplitReviewDates?: Readonly<Record<string, readonly string[]>>;
}

export interface PersonalPortfolioValuationHistoryPoint {
  readonly date: string;
  readonly cashUsd: string | null;
  readonly pricedHoldingsValueUsd: string;
  readonly holdingsValueUsd: string | null;
  readonly totalValueUsd: string | null;
  readonly activeHoldings: number;
  readonly pricedHoldings: number;
  readonly missingPriceListingIds: readonly string[];
  readonly splitReviewListingIds: readonly string[];
  readonly netExternalFlowUsd: string;
}

export type PersonalPortfolioValuationHistoryResult =
  | Readonly<{ status: "invalid"; reason: string }>
  | Readonly<{
      status: "available";
      startDate: string;
      effectiveStartDate: string;
      endDate: string;
      points: readonly PersonalPortfolioValuationHistoryPoint[];
      coverage: Readonly<{
        totalDates: number;
        completeDates: number;
        missingPriceDates: number;
        unknownCashDates: number;
        splitReviewDates: number;
      }>;
      comparison: Readonly<{
        firstDate: string | null;
        lastDate: string | null;
        firstValueUsd: string | null;
        lastValueUsd: string | null;
        netExternalFlowsUsd: string | null;
        changeAfterExternalFlowsUsd: string | null;
      }>;
    }>;

type Price = Readonly<{ coefficient: bigint; places: number }>;
type Endpoint = Readonly<{
  date: string;
  value: bigint;
  externalFlows: bigint;
}>;
const DAY_MS = 86_400_000;
const MAX_DAYS = 3_660;
const MAX_BARS = 4_096;
const IDENTITY_KEYS = [
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "issuerName",
  "listingId",
  "securityId",
  "securityName",
  "shareClassId",
  "shareClassName",
  "symbol",
] as const;

/** UTC calendar subtraction, clamped to the target month's last day like the provider. */
export function getPersonalPortfolioValuationWindow(
  range: PersonalMarketDataRangeDto,
  asOfDate: string,
): Readonly<{ startDate: string; endDate: string }> | null {
  if (!calendarDate(asOfDate)) return null;
  const date = new Date(`${asOfDate}T00:00:00.000Z`);
  let years = 0;
  let months = 0;
  switch (range) {
    case "1m":
      months = 1;
      break;
    case "3m":
      months = 3;
      break;
    case "1y":
      years = 1;
      break;
    case "5y":
      years = 5;
      break;
    case "10y":
      years = 10;
      break;
    case "ytd":
      return Object.freeze({
        startDate: `${asOfDate.slice(0, 4)}-01-01`,
        endDate: asOfDate,
      });
    default:
      return null;
  }
  const ordinal = date.getUTCMonth() - months;
  const year = date.getUTCFullYear() - years + Math.floor(ordinal / 12);
  const month = ((ordinal % 12) + 12) % 12;
  const day = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  );
  const startDate = new Date(Date.UTC(year, month, day))
    .toISOString()
    .slice(0, 10);
  return calendarDate(startDate)
    ? Object.freeze({ startDate, endDate: asOfDate })
    : null;
}

/** Recorded end-of-day balances valued only with exact-date raw closing observations. */
export function calculatePersonalPortfolioValuationHistory(
  input: PersonalPortfolioValuationHistoryInput,
): PersonalPortfolioValuationHistoryResult {
  try {
    return calculate(input);
  } catch {
    return invalid("invalid_input");
  }
}

function calculate(
  input: PersonalPortfolioValuationHistoryInput,
): PersonalPortfolioValuationHistoryResult {
  const { ledger, startDate, endDate, histories } = input;
  if (projectPersonalPortfolioLedger(ledger).status !== "valid")
    return invalid("invalid_ledger");
  if (!calendarDate(startDate) || !calendarDate(endDate) || startDate > endDate)
    return invalid("invalid_window");
  const startTime = Date.parse(`${startDate}T00:00:00.000Z`);
  const endTime = Date.parse(`${endDate}T00:00:00.000Z`);
  if ((endTime - startTime) / DAY_MS + 1 > MAX_DAYS)
    return invalid("window_limit");
  if (endDate < ledger.opening.asOfDate)
    return invalid("window_before_opening");
  if (!Array.isArray(histories) || histories.length > 20)
    return invalid("invalid_histories");
  const effectiveStartDate =
    startDate < ledger.opening.asOfDate ? ledger.opening.asOfDate : startDate;
  const identities = new Map(
    ledger.identities.map((identity) => [identity.listingId, identity]),
  );
  const reviews = new Map<string, Set<string>>();
  const prices = new Map<string, Map<string, Price>>();
  let pricePlaces = 0;
  const prior = input.priorSplitReviewDates;
  if (prior !== undefined) {
    if (typeof prior !== "object" || prior === null || Array.isArray(prior))
      return invalid("invalid_split_reviews");
    for (const listingId of identities.keys()) {
      if (!Object.hasOwn(prior, listingId)) continue;
      const dates = prior[listingId];
      if (!Array.isArray(dates) || dates.length > MAX_BARS)
        return invalid("invalid_split_reviews");
      const checkedDates: readonly unknown[] = Array.from(dates);
      if (!checkedDates.every(calendarDate))
        return invalid("invalid_split_reviews");
      reviews.set(listingId, new Set(checkedDates));
    }
  }
  for (const entry of histories as PersonalPortfolioValuationHistoryInput["histories"]) {
    if (!isPersonalPortfolioIdentity(entry.identity))
      return invalid("invalid_history_identity");
    const identity = identities.get(entry.identity.listingId);
    if (
      !identity ||
      !IDENTITY_KEYS.every((key) => identity[key] === entry.identity[key]) ||
      prices.has(identity.listingId)
    )
      return invalid("invalid_history_identity");
    const assessment = assessPortfolioHistory(
      ledger,
      identity.listingId,
      entry.history,
    );
    if (assessment === null) return invalid("invalid_history");
    const observations = new Map<string, Price>();
    for (const bar of entry.history.bars) {
      const close = parseDecimal(bar.raw?.close);
      if (close === null || close.coefficient <= 0n)
        return invalid("invalid_history_price");
      observations.set(bar.date, close);
      pricePlaces = Math.max(pricePlaces, close.places);
    }
    prices.set(identity.listingId, observations);
    const dates = reviews.get(identity.listingId) ?? new Set<string>();
    for (const date of assessment.observedDates) dates.delete(date);
    for (const date of assessment.splitReviewDates) dates.add(date);
    reviews.set(identity.listingId, dates);
  }
  // An absent manual split observation blocks later dates even outside the
  // displayed window, and even when recorded sales appear to close the position.
  for (const activity of ledger.transactions) {
    if (
      activity.type !== "split" ||
      prices.get(activity.listingId)?.has(activity.date)
    )
      continue;
    const dates = reviews.get(activity.listingId) ?? new Set<string>();
    dates.add(activity.date);
    reviews.set(activity.listingId, dates);
  }
  const firstReview = new Map(
    [...reviews]
      .filter(([, dates]) => dates.size > 0)
      .map(([id, dates]) => [id, [...dates].sort()[0]!]),
  );
  const priceScale = 10n ** BigInt(pricePlaces + 4);
  const shares = new Map(
    ledger.opening.holdings.map((holding) => [
      holding.listingId,
      scaled(holding.shares, 6),
    ]),
  );
  let cash =
    ledger.opening.cashUsd === null ? null : scaled(ledger.opening.cashUsd, 2);
  let activityIndex = 0;
  let externalFlows = 0n;
  let first: Endpoint | null = null;
  let last: Endpoint | null = null;
  const points: PersonalPortfolioValuationHistoryPoint[] = [];
  const coverage = {
    totalDates: 0,
    completeDates: 0,
    missingPriceDates: 0,
    unknownCashDates: 0,
    splitReviewDates: 0,
  };
  for (
    let instant = Date.parse(`${effectiveStartDate}T00:00:00.000Z`);
    instant <= endTime;
    instant += DAY_MS
  ) {
    const date = new Date(instant).toISOString().slice(0, 10);
    let dailyExternalFlow = 0n;
    while (activityIndex < ledger.transactions.length) {
      const activity = ledger.transactions[activityIndex]!;
      if (activity.date > date) break;
      const id = activity.listingId;
      if (activity.type === "split") {
        shares.set(
          activity.listingId,
          (shares.get(activity.listingId)! * BigInt(activity.ratioNumerator)) /
            BigInt(activity.ratioDenominator),
        );
      } else {
        const gross = scaled(activity.grossUsd, 2);
        const fee = scaled(activity.feeUsd, 2);
        let cashChange: bigint;
        switch (activity.type) {
          case "buy":
            shares.set(
              id!,
              (shares.get(id!) ?? 0n) + scaled(activity.shares!, 6),
            );
            cashChange = -gross - fee;
            break;
          case "sell":
            shares.set(id!, shares.get(id!)! - scaled(activity.shares!, 6));
            cashChange = gross - fee;
            break;
          case "deposit":
            cashChange = gross;
            externalFlows += gross;
            if (activity.date === date) dailyExternalFlow += gross;
            break;
          case "withdrawal":
            cashChange = -gross;
            externalFlows -= gross;
            if (activity.date === date) dailyExternalFlow -= gross;
            break;
          case "dividend":
            cashChange = gross;
            break;
          case "fee":
            cashChange = -gross;
            break;
        }
        if (cash !== null) cash += cashChange;
      }
      activityIndex += 1;
    }
    const missingPriceListingIds: string[] = [];
    const splitReviewListingIds = [...identities.keys()].filter((id) => {
      const reviewDate = firstReview.get(id);
      return reviewDate !== undefined && reviewDate <= date;
    });
    let activeHoldings = 0;
    let pricedHoldings = 0;
    let pricedValue = 0n;
    for (const id of identities.keys()) {
      const quantity = shares.get(id) ?? 0n;
      if (quantity === 0n) continue;
      activeHoldings += 1;
      const price = prices.get(id)?.get(date);
      if (!price) missingPriceListingIds.push(id);
      if (!price || splitReviewListingIds.includes(id)) continue;
      pricedHoldings += 1;
      pricedValue +=
        quantity *
        price.coefficient *
        10n ** BigInt(pricePlaces - price.places);
    }
    const completeHoldings =
      missingPriceListingIds.length === 0 && splitReviewListingIds.length === 0;
    const value =
      completeHoldings && cash !== null
        ? pricedValue + cash * priceScale
        : null;
    if (value !== null) {
      const endpoint = { date, value, externalFlows };
      first ??= endpoint;
      last = endpoint;
      coverage.completeDates += 1;
    }
    coverage.totalDates += 1;
    if (missingPriceListingIds.length > 0) coverage.missingPriceDates += 1;
    if (cash === null) coverage.unknownCashDates += 1;
    if (splitReviewListingIds.length > 0) coverage.splitReviewDates += 1;
    points.push(
      Object.freeze({
        date,
        cashUsd: cash === null ? null : cents(cash),
        pricedHoldingsValueUsd: roundedMoney(pricedValue, priceScale),
        holdingsValueUsd: completeHoldings
          ? roundedMoney(pricedValue, priceScale)
          : null,
        totalValueUsd: value === null ? null : roundedMoney(value, priceScale),
        activeHoldings,
        pricedHoldings,
        missingPriceListingIds: Object.freeze(missingPriceListingIds),
        splitReviewListingIds: Object.freeze(splitReviewListingIds),
        netExternalFlowUsd: cents(dailyExternalFlow),
      }),
    );
  }
  const comparison =
    first !== null && last !== null && first.date !== last.date
      ? {
          firstDate: first.date,
          lastDate: last.date,
          firstValueUsd: roundedMoney(first.value, priceScale),
          lastValueUsd: roundedMoney(last.value, priceScale),
          netExternalFlowsUsd: cents(last.externalFlows - first.externalFlows),
          // Reconcile the displayed endpoint cents with the recorded cash flows.
          // Each endpoint already sums exact position values before rounding.
          changeAfterExternalFlowsUsd: cents(
            roundScaledCents(last.value, priceScale) -
              roundScaledCents(first.value, priceScale) -
              (last.externalFlows - first.externalFlows),
          ),
        }
      : {
          firstDate: null,
          lastDate: null,
          firstValueUsd: null,
          lastValueUsd: null,
          netExternalFlowsUsd: null,
          changeAfterExternalFlowsUsd: null,
        };
  return Object.freeze({
    status: "available",
    startDate,
    effectiveStartDate,
    endDate,
    points: Object.freeze(points),
    coverage: Object.freeze(coverage),
    comparison: Object.freeze(comparison),
  });
}

function parseDecimal(value: unknown): Price | null {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value)
  )
    return null;
  const [whole = "0", fraction = ""] = value.split(".");
  return {
    coefficient: BigInt(`${whole}${fraction}`),
    places: fraction.length,
  };
}

function scaled(value: string, places: number): bigint {
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(`${whole}${fraction.padEnd(places, "0")}`);
}

function roundedMoney(value: bigint, scale: bigint): string {
  return cents(roundScaledCents(value, scale));
}

function roundScaledCents(value: bigint, scale: bigint): bigint {
  const magnitude = value < 0n ? -value : value;
  const rounded =
    magnitude / scale + (2n * (magnitude % scale) >= scale ? 1n : 0n);
  return value < 0n ? -rounded : rounded;
}

function cents(value: bigint): string {
  const digits = (value < 0n ? -value : value).toString().padStart(3, "0");
  return `${value < 0n ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

function calendarDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u.test(value)
  )
    return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
}

function invalid(reason: string): PersonalPortfolioValuationHistoryResult {
  return Object.freeze({ status: "invalid", reason });
}
