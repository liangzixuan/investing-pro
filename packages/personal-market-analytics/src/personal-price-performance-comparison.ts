import Decimal from "decimal.js";

import {
  calculatePersonalMarketAnalytics,
  type PersonalMarketAnalyticsBar,
  type PersonalMarketAnalyticsMaximumDrawdownMetric,
  type PersonalMarketAnalyticsSelectedWindowReturnMetric,
} from "./personal-market-analytics";

export interface PersonalPricePerformanceComparisonSeries {
  readonly listingId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly bars: readonly PersonalMarketAnalyticsBar[];
}

export interface PersonalPricePerformanceComparisonInput {
  readonly series: readonly PersonalPricePerformanceComparisonSeries[];
}

export interface PersonalPricePerformanceComparisonRow {
  readonly listingId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly loadedSessionCount: number;
  readonly excludedSessionCount: number;
  readonly observedFirstDate: string | null;
  readonly observedLastDate: string | null;
}

export interface PersonalPricePerformanceComparisonIndexedObservation {
  readonly date: string;
  readonly adjustedClose: string;
  readonly indexedAdjustedClose: string;
}

export interface PersonalPricePerformanceComparisonAvailableRow extends PersonalPricePerformanceComparisonRow {
  readonly firstAdjustedClose: string;
  readonly lastAdjustedClose: string;
  readonly indexedObservations: readonly PersonalPricePerformanceComparisonIndexedObservation[];
  readonly maximumDrawdown: Extract<
    PersonalMarketAnalyticsMaximumDrawdownMetric,
    { readonly status: "available" }
  >;
  readonly selectedWindowReturn: Extract<
    PersonalMarketAnalyticsSelectedWindowReturnMetric,
    { readonly status: "available" }
  >;
}

interface ComparisonWindow {
  readonly sharedDates: readonly string[];
  readonly sharedSessionCount: number;
}

export interface PersonalPricePerformanceComparisonAvailableResult extends ComparisonWindow {
  readonly status: "available";
  readonly firstDate: string;
  readonly lastDate: string;
  readonly rows: readonly PersonalPricePerformanceComparisonAvailableRow[];
}

export interface PersonalPricePerformanceComparisonInsufficientHistoryResult extends ComparisonWindow {
  readonly status: "insufficient_history";
  readonly firstDate: string | null;
  readonly lastDate: string | null;
  readonly rows: readonly PersonalPricePerformanceComparisonRow[];
}

export type PersonalPricePerformanceComparisonResult =
  | PersonalPricePerformanceComparisonAvailableResult
  | PersonalPricePerformanceComparisonInsufficientHistoryResult;

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const MAXIMUM_SESSIONS = 4_096;
const SERIES_KEYS = ["listingId", "startDate", "endDate", "bars"] as const;

export function calculatePersonalPricePerformanceComparison(
  input: PersonalPricePerformanceComparisonInput,
): PersonalPricePerformanceComparisonResult {
  try {
    return compareValidated(validateInput(input));
  } catch {
    throw new TypeError();
  }
}

function compareValidated(
  series: readonly PersonalPricePerformanceComparisonSeries[],
): PersonalPricePerformanceComparisonResult {
  const firstSeries = series[0];
  if (firstSeries === undefined) throw new TypeError();
  const datesBySeries = series.map(
    (entry) => new Set(entry.bars.map((bar) => bar.date)),
  );
  const sharedDates = firstSeries.bars
    .map((bar) => bar.date)
    .filter((date) => datesBySeries.every((dates) => dates.has(date)));
  const commonDates = new Set(sharedDates);
  const firstDate = sharedDates[0] ?? null;
  const lastDate = sharedDates.at(-1) ?? null;
  const coverageRows = series.map((entry) => ({
    listingId: entry.listingId,
    startDate: entry.startDate,
    endDate: entry.endDate,
    loadedSessionCount: entry.bars.length,
    excludedSessionCount: entry.bars.length - sharedDates.length,
    observedFirstDate: entry.bars[0]?.date ?? null,
    observedLastDate: entry.bars.at(-1)?.date ?? null,
  }));
  const commonWindow = { sharedDates, sharedSessionCount: sharedDates.length };

  if (sharedDates.length < 2 || firstDate === null || lastDate === null) {
    return freezeDeep({
      ...commonWindow,
      status: "insufficient_history",
      firstDate,
      lastDate,
      rows: coverageRows,
    });
  }

  const IndexDecimal = Decimal.clone({
    defaults: true,
    precision: 80,
    rounding: Decimal.ROUND_HALF_UP,
  });
  const rows = series.map((entry, index) => {
    const alignedBars = entry.bars.filter((bar) => commonDates.has(bar.date));
    const firstBar = alignedBars[0];
    const lastBar = alignedBars.at(-1);
    const coverage = coverageRows[index];
    const { maximumDrawdown, selectedWindowReturn } =
      calculatePersonalMarketAnalytics({
        asOfDate: lastDate,
        bars: alignedBars,
        mode: "adjusted",
      }).metrics;
    if (
      firstBar === undefined ||
      lastBar === undefined ||
      coverage === undefined ||
      maximumDrawdown.status !== "available" ||
      selectedWindowReturn.status !== "available"
    ) {
      throw new TypeError();
    }
    const firstClose = new IndexDecimal(firstBar.adjusted.close);
    // Rebase only shared observations: 100 × adjusted close / first shared close.
    // Four-place chart rounding never feeds back into return or drawdown.
    const indexedObservations = alignedBars.map((bar) => ({
      date: bar.date,
      adjustedClose: bar.adjusted.close,
      indexedAdjustedClose: new IndexDecimal(bar.adjusted.close)
        .times(100)
        .div(firstClose)
        .toFixed(4),
    }));
    return {
      ...coverage,
      firstAdjustedClose: firstBar.adjusted.close,
      lastAdjustedClose: lastBar.adjusted.close,
      indexedObservations,
      maximumDrawdown,
      selectedWindowReturn,
    };
  });

  return freezeDeep({
    ...commonWindow,
    status: "available",
    firstDate,
    lastDate,
    rows,
  });
}

function validateInput(
  input: unknown,
): readonly PersonalPricePerformanceComparisonSeries[] {
  if (!isPlainRecord(input) || !hasExactKeys(input, ["series"])) {
    throw new TypeError();
  }
  const { series } = input;
  if (!Array.isArray(series) || series.length < 2 || series.length > 3) {
    throw new TypeError();
  }
  for (let index = 0; index < series.length; index += 1) {
    if (!Object.hasOwn(series, index)) throw new TypeError();
  }

  const listingIds = new Set<string>();
  return series.map((entry: unknown) => {
    if (!isPlainRecord(entry) || !hasExactKeys(entry, SERIES_KEYS)) {
      throw new TypeError();
    }
    const { listingId, startDate, endDate, bars } = entry;
    if (
      typeof listingId !== "string" ||
      !IDENTIFIER_PATTERN.test(listingId) ||
      listingIds.has(listingId) ||
      typeof startDate !== "string" ||
      typeof endDate !== "string" ||
      startDate > endDate ||
      !Array.isArray(bars) ||
      bars.length > MAXIMUM_SESSIONS
    ) {
      throw new TypeError();
    }
    listingIds.add(listingId);
    const copiedBars = bars.map(copyBar);

    // Validate both request bounds and every original bar before alignment can
    // exclude dates. Reuse the admitted analytics date and decimal contract.
    calculatePersonalMarketAnalytics({
      asOfDate: startDate,
      bars: [],
      mode: "adjusted",
    });
    const original = calculatePersonalMarketAnalytics({
      asOfDate: endDate,
      bars: copiedBars,
      mode: "adjusted",
    });
    if (
      original.inputWindow.firstDate !== null &&
      original.inputWindow.firstDate < startDate
    ) {
      throw new TypeError();
    }
    return {
      listingId,
      startDate,
      endDate,
      bars: copiedBars,
    };
  });
}

function copyBar(value: unknown): PersonalMarketAnalyticsBar {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, ["date", "adjusted", "raw"])
  ) {
    throw new TypeError();
  }
  const { date, adjusted, raw } = value;
  if (
    typeof date !== "string" ||
    !isPlainRecord(adjusted) ||
    !hasExactKeys(adjusted, ["close"]) ||
    !isPlainRecord(raw) ||
    !hasExactKeys(raw, ["close"])
  ) {
    throw new TypeError();
  }
  const adjustedClose = adjusted.close;
  const rawClose = raw.close;
  if (typeof adjustedClose !== "string" || typeof rawClose !== "string") {
    throw new TypeError();
  }
  return { date, adjusted: { close: adjustedClose }, raw: { close: rawClose } };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function freezeDeep<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) freezeDeep(nested);
  return Object.freeze(value);
}
