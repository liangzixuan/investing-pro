import Decimal from "decimal.js";

export const PERSONAL_MARKET_ANALYTICS_SCHEMA_VERSION = "1.0.0" as const;
export const PERSONAL_MARKET_ANALYTICS_FORMULA_SET_VERSION = "1.0.0" as const;
export const PERSONAL_MARKET_ANALYTICS_SESSION_POLICY =
  "observed_sessions_only_no_gap_filling" as const;

export const PERSONAL_MARKET_ANALYTICS_MODES = Object.freeze([
  "adjusted",
  "raw",
] as const);

export const PERSONAL_MARKET_ANALYTICS_METRIC_STATUSES = Object.freeze([
  "available",
  "insufficient_history",
  "zero_range",
] as const);

export const PERSONAL_MARKET_ANALYTICS_TREND_CLASSIFICATIONS = Object.freeze([
  "above",
  "below",
  "at",
] as const);

export const PERSONAL_MARKET_ANALYTICS_ROUNDING = freezeDeep({
  decimalPlaces: 4,
  method: "round_half_up",
  negativeZero: "normalize_to_positive_zero",
  unit: "percent",
} as const);

const SHARED_PARAMETERS = {
  calculationPrecision:
    "80_significant_decimal_digits_for_arithmetic_logarithms_and_roots",
  percentMultiplier: 100,
  roundingDecimalPlaces: PERSONAL_MARKET_ANALYTICS_ROUNDING.decimalPlaces,
  roundingMethod: PERSONAL_MARKET_ANALYTICS_ROUNDING.method,
  sessionPolicy: PERSONAL_MARKET_ANALYTICS_SESSION_POLICY,
} as const;

export const PERSONAL_MARKET_ANALYTICS_FORMULAS = freezeDeep({
  maximumDrawdown: {
    formulaId: "maximum_drawdown_magnitude_percent",
    formulaVersion: "1.0.0",
    parameters: {
      ...SHARED_PARAMETERS,
      definition: "maximum_of_running_peak_minus_close_over_running_peak",
      minimumSessions: 2,
      sign: "nonnegative_magnitude",
      tieBreak: "earliest_peak_then_earliest_trough",
    },
  },
  selectedWindowReturn: {
    formulaId: "selected_window_simple_return_percent",
    formulaVersion: "1.0.0",
    parameters: {
      ...SHARED_PARAMETERS,
      definition: "last_close_over_first_close_minus_one",
      minimumSessions: 2,
    },
  },
  sma20: {
    formulaId: "simple_moving_average_trend_20_session",
    formulaVersion: "1.0.0",
    parameters: {
      ...SHARED_PARAMETERS,
      averageType: "arithmetic_mean",
      classificationTolerance: "exact_decimal_comparison",
      comparison: "latest_close_to_trailing_mean",
      distanceDefinition: "latest_close_over_trailing_mean_minus_one",
      minimumSessions: 20,
      windowSessions: 20,
    },
  },
  sma50: {
    formulaId: "simple_moving_average_trend_50_session",
    formulaVersion: "1.0.0",
    parameters: {
      ...SHARED_PARAMETERS,
      averageType: "arithmetic_mean",
      classificationTolerance: "exact_decimal_comparison",
      comparison: "latest_close_to_trailing_mean",
      distanceDefinition: "latest_close_over_trailing_mean_minus_one",
      minimumSessions: 50,
      windowSessions: 50,
    },
  },
  sma200: {
    formulaId: "simple_moving_average_trend_200_session",
    formulaVersion: "1.0.0",
    parameters: {
      ...SHARED_PARAMETERS,
      averageType: "arithmetic_mean",
      classificationTolerance: "exact_decimal_comparison",
      comparison: "latest_close_to_trailing_mean",
      distanceDefinition: "latest_close_over_trailing_mean_minus_one",
      minimumSessions: 200,
      windowSessions: 200,
    },
  },
  trailing20SessionAnnualizedVolatility: {
    formulaId:
      "trailing_20_session_log_return_annualized_sample_volatility_percent",
    formulaVersion: "1.0.0",
    parameters: {
      ...SHARED_PARAMETERS,
      annualizationSessions: 252,
      annualizationTransform: "square_root",
      minimumSessions: 21,
      returnObservations: 20,
      returnType: "natural_log",
      varianceDenominator: "n_minus_one",
    },
  },
  trailing252SessionCloseRangePosition: {
    formulaId: "trailing_252_session_close_range_position_percent",
    formulaVersion: "1.0.0",
    parameters: {
      ...SHARED_PARAMETERS,
      definition: "last_close_minus_minimum_over_maximum_minus_minimum",
      maximumWindowSessions: 252,
      minimumSessions: 200,
      zeroRangeTreatment: "zero_range_status_without_value",
    },
  },
} as const);

export type PersonalMarketAnalyticsMode =
  (typeof PERSONAL_MARKET_ANALYTICS_MODES)[number];
export type PersonalMarketAnalyticsMetricStatus =
  (typeof PERSONAL_MARKET_ANALYTICS_METRIC_STATUSES)[number];
export type PersonalMarketAnalyticsTrendClassification =
  (typeof PERSONAL_MARKET_ANALYTICS_TREND_CLASSIFICATIONS)[number];

export interface PersonalMarketAnalyticsBar {
  readonly adjusted: {
    readonly close: string;
  };
  readonly date: string;
  readonly raw: {
    readonly close: string;
  };
}

export interface PersonalMarketAnalyticsInput {
  readonly asOfDate: string;
  readonly bars: readonly PersonalMarketAnalyticsBar[];
  readonly mode: PersonalMarketAnalyticsMode;
}

export type PersonalMarketAnalyticsFormulaParameters =
  (typeof PERSONAL_MARKET_ANALYTICS_FORMULAS)[keyof typeof PERSONAL_MARKET_ANALYTICS_FORMULAS]["parameters"];

export interface PersonalMarketAnalyticsMetricBase<
  FormulaId extends string,
  Parameters extends PersonalMarketAnalyticsFormulaParameters,
> {
  readonly formulaId: FormulaId;
  readonly formulaVersion: typeof PERSONAL_MARKET_ANALYTICS_FORMULA_SET_VERSION;
  readonly parameters: Parameters;
}

export interface PersonalMarketAnalyticsAvailablePercentMetric {
  readonly observedSessions: number;
  readonly sampleFirstDate: string | null;
  readonly sampleLastDate: string | null;
  readonly status: "available";
  readonly valuePercent: string;
}

export interface PersonalMarketAnalyticsInsufficientHistory {
  readonly observedSessions: number;
  readonly requiredSessions: number;
  readonly sampleFirstDate: string | null;
  readonly sampleLastDate: string | null;
  readonly status: "insufficient_history";
}

type SelectedWindowReturnFormula =
  (typeof PERSONAL_MARKET_ANALYTICS_FORMULAS)["selectedWindowReturn"];
type TrailingVolatilityFormula =
  (typeof PERSONAL_MARKET_ANALYTICS_FORMULAS)["trailing20SessionAnnualizedVolatility"];
type MaximumDrawdownFormula =
  (typeof PERSONAL_MARKET_ANALYTICS_FORMULAS)["maximumDrawdown"];
type RangePositionFormula =
  (typeof PERSONAL_MARKET_ANALYTICS_FORMULAS)["trailing252SessionCloseRangePosition"];
type Sma20Formula = (typeof PERSONAL_MARKET_ANALYTICS_FORMULAS)["sma20"];
type Sma50Formula = (typeof PERSONAL_MARKET_ANALYTICS_FORMULAS)["sma50"];
type Sma200Formula = (typeof PERSONAL_MARKET_ANALYTICS_FORMULAS)["sma200"];

export type PersonalMarketAnalyticsSelectedWindowReturnMetric =
  PersonalMarketAnalyticsMetricBase<
    SelectedWindowReturnFormula["formulaId"],
    SelectedWindowReturnFormula["parameters"]
  > &
    (
      | PersonalMarketAnalyticsAvailablePercentMetric
      | PersonalMarketAnalyticsInsufficientHistory
    );

export type PersonalMarketAnalyticsTrailingVolatilityMetric =
  PersonalMarketAnalyticsMetricBase<
    TrailingVolatilityFormula["formulaId"],
    TrailingVolatilityFormula["parameters"]
  > &
    (
      | PersonalMarketAnalyticsAvailablePercentMetric
      | PersonalMarketAnalyticsInsufficientHistory
    );

export type PersonalMarketAnalyticsMaximumDrawdownMetric =
  PersonalMarketAnalyticsMetricBase<
    MaximumDrawdownFormula["formulaId"],
    MaximumDrawdownFormula["parameters"]
  > &
    (
      | (PersonalMarketAnalyticsAvailablePercentMetric & {
          readonly peakDate: string;
          readonly troughDate: string;
        })
      | PersonalMarketAnalyticsInsufficientHistory
    );

export type PersonalMarketAnalyticsRangePositionMetric =
  PersonalMarketAnalyticsMetricBase<
    RangePositionFormula["formulaId"],
    RangePositionFormula["parameters"]
  > &
    (
      | PersonalMarketAnalyticsAvailablePercentMetric
      | PersonalMarketAnalyticsInsufficientHistory
      | {
          readonly observedSessions: number;
          readonly sampleFirstDate: string | null;
          readonly sampleLastDate: string | null;
          readonly status: "zero_range";
        }
    );

export type PersonalMarketAnalyticsSmaMetric<
  Formula extends Sma20Formula | Sma50Formula | Sma200Formula,
> = PersonalMarketAnalyticsMetricBase<
  Formula["formulaId"],
  Formula["parameters"]
> &
  (
    | {
        readonly classification: PersonalMarketAnalyticsTrendClassification;
        readonly distancePercent: string;
        readonly observedSessions: number;
        readonly sampleFirstDate: string | null;
        readonly sampleLastDate: string | null;
        readonly status: "available";
      }
    | PersonalMarketAnalyticsInsufficientHistory
  );

export interface PersonalMarketAnalyticsSmaTrendMetrics {
  readonly sma20: PersonalMarketAnalyticsSmaMetric<Sma20Formula>;
  readonly sma50: PersonalMarketAnalyticsSmaMetric<Sma50Formula>;
  readonly sma200: PersonalMarketAnalyticsSmaMetric<Sma200Formula>;
}

export interface PersonalMarketAnalyticsMetrics {
  readonly maximumDrawdown: PersonalMarketAnalyticsMaximumDrawdownMetric;
  readonly selectedWindowReturn: PersonalMarketAnalyticsSelectedWindowReturnMetric;
  readonly smaTrend: PersonalMarketAnalyticsSmaTrendMetrics;
  readonly trailing20SessionAnnualizedVolatility: PersonalMarketAnalyticsTrailingVolatilityMetric;
  readonly trailing252SessionCloseRangePosition: PersonalMarketAnalyticsRangePositionMetric;
}

export interface PersonalMarketAnalyticsInputWindow {
  readonly firstDate: string | null;
  readonly lastDate: string | null;
  readonly sessionCount: number;
  readonly sessionPolicy: typeof PERSONAL_MARKET_ANALYTICS_SESSION_POLICY;
}

export interface PersonalMarketAnalyticsResult {
  readonly asOfDate: string;
  readonly formulaSetVersion: typeof PERSONAL_MARKET_ANALYTICS_FORMULA_SET_VERSION;
  readonly inputWindow: PersonalMarketAnalyticsInputWindow;
  readonly metrics: PersonalMarketAnalyticsMetrics;
  readonly mode: PersonalMarketAnalyticsMode;
  readonly schemaVersion: typeof PERSONAL_MARKET_ANALYTICS_SCHEMA_VERSION;
}

interface ValidatedBar {
  readonly adjustedClose: string;
  readonly date: string;
  readonly rawClose: string;
}

interface ValidatedInput {
  readonly asOfDate: string;
  readonly bars: readonly ValidatedBar[];
  readonly mode: PersonalMarketAnalyticsMode;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const UNSIGNED_DECIMAL_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;
const MAXIMUM_DECIMAL_LENGTH = 64;
const INPUT_KEYS = Object.freeze(["asOfDate", "bars", "mode"] as const);
const BAR_KEYS = Object.freeze(["adjusted", "date", "raw"] as const);
const CLOSE_KEYS = Object.freeze(["close"] as const);
const CALCULATION_PRECISION = 80;

export function calculatePersonalMarketAnalytics(
  input: PersonalMarketAnalyticsInput,
): PersonalMarketAnalyticsResult {
  try {
    return calculateValidated(validateInput(input));
  } catch {
    throw new TypeError();
  }
}

function calculateValidated(
  input: ValidatedInput,
): PersonalMarketAnalyticsResult {
  const CalculationDecimal = Decimal.clone({
    defaults: true,
    precision: CALCULATION_PRECISION,
    rounding: Decimal.ROUND_HALF_UP,
  });
  const closes = input.bars.map(
    (bar) =>
      new CalculationDecimal(
        input.mode === "adjusted" ? bar.adjustedClose : bar.rawClose,
      ),
  );
  const dates = input.bars.map((bar) => bar.date);

  return freezeDeep({
    asOfDate: input.asOfDate,
    formulaSetVersion: PERSONAL_MARKET_ANALYTICS_FORMULA_SET_VERSION,
    inputWindow: {
      firstDate: dates[0] ?? null,
      lastDate: dates.at(-1) ?? null,
      sessionCount: dates.length,
      sessionPolicy: PERSONAL_MARKET_ANALYTICS_SESSION_POLICY,
    },
    metrics: {
      maximumDrawdown: calculateMaximumDrawdown(closes, dates),
      selectedWindowReturn: calculateSelectedWindowReturn(closes, dates),
      smaTrend: {
        sma20: calculateSmaMetric(closes, dates, "sma20"),
        sma50: calculateSmaMetric(closes, dates, "sma50"),
        sma200: calculateSmaMetric(closes, dates, "sma200"),
      },
      trailing20SessionAnnualizedVolatility: calculateTrailingVolatility(
        closes,
        dates,
      ),
      trailing252SessionCloseRangePosition: calculateRangePosition(
        closes,
        dates,
      ),
    },
    mode: input.mode,
    schemaVersion: PERSONAL_MARKET_ANALYTICS_SCHEMA_VERSION,
  });
}

function calculateSelectedWindowReturn(
  closes: readonly Decimal[],
  dates: readonly string[],
): PersonalMarketAnalyticsSelectedWindowReturnMetric {
  const formula = PERSONAL_MARKET_ANALYTICS_FORMULAS.selectedWindowReturn;
  const sample = sampleMetadata(dates);
  if (closes.length < formula.parameters.minimumSessions) {
    return freezeDeep({
      ...formula,
      ...sample,
      requiredSessions: formula.parameters.minimumSessions,
      status: "insufficient_history",
    });
  }

  const first = closes[0];
  const last = closes.at(-1);
  if (first === undefined || last === undefined) throw new TypeError();
  const value = last.div(first).minus(1).times(100);
  return freezeDeep({
    ...formula,
    ...sample,
    status: "available",
    valuePercent: formatPercent(value),
  });
}

function calculateTrailingVolatility(
  closes: readonly Decimal[],
  dates: readonly string[],
): PersonalMarketAnalyticsTrailingVolatilityMetric {
  const formula =
    PERSONAL_MARKET_ANALYTICS_FORMULAS.trailing20SessionAnnualizedVolatility;
  if (closes.length < formula.parameters.minimumSessions) {
    return freezeDeep({
      ...formula,
      ...sampleMetadata(dates),
      requiredSessions: formula.parameters.minimumSessions,
      status: "insufficient_history",
    });
  }

  const window = closes.slice(-formula.parameters.minimumSessions);
  const sample = sampleMetadata(dates, formula.parameters.minimumSessions);
  const returns: Decimal[] = [];
  for (let index = 1; index < window.length; index += 1) {
    const previous = window[index - 1];
    const current = window[index];
    if (previous === undefined || current === undefined) throw new TypeError();
    returns.push(current.div(previous).ln());
  }

  const sum = returns.reduce(
    (total, value) => total.plus(value),
    zeroLike(returns[0]),
  );
  const mean = sum.div(returns.length);
  const squaredDeviationSum = returns.reduce(
    (total, value) => total.plus(value.minus(mean).pow(2)),
    zeroLike(returns[0]),
  );
  const sampleVariance = squaredDeviationSum.div(returns.length - 1);
  const value = sampleVariance
    .sqrt()
    .times(zeroLike(returns[0]).plus(252).sqrt())
    .times(100);

  return freezeDeep({
    ...formula,
    ...sample,
    status: "available",
    valuePercent: formatPercent(value),
  });
}

function calculateMaximumDrawdown(
  closes: readonly Decimal[],
  dates: readonly string[],
): PersonalMarketAnalyticsMaximumDrawdownMetric {
  const formula = PERSONAL_MARKET_ANALYTICS_FORMULAS.maximumDrawdown;
  const sample = sampleMetadata(dates);
  if (closes.length < formula.parameters.minimumSessions) {
    return freezeDeep({
      ...formula,
      ...sample,
      requiredSessions: formula.parameters.minimumSessions,
      status: "insufficient_history",
    });
  }

  let peak = closes[0];
  if (peak === undefined) throw new TypeError();
  let peakIndex = 0;
  let maximumDrawdown = peak.minus(peak);
  let maximumPeakIndex = 0;
  let maximumTroughIndex = 0;

  for (let index = 1; index < closes.length; index += 1) {
    const close = closes[index];
    if (close === undefined) throw new TypeError();
    if (close.gt(peak)) {
      peak = close;
      peakIndex = index;
    }

    const drawdown = peak.minus(close).div(peak).times(100);
    if (drawdown.gt(maximumDrawdown)) {
      maximumDrawdown = drawdown;
      maximumPeakIndex = peakIndex;
      maximumTroughIndex = index;
    }
  }

  const peakDate = dates[maximumPeakIndex];
  const troughDate = dates[maximumTroughIndex];
  if (peakDate === undefined || troughDate === undefined) throw new TypeError();
  return freezeDeep({
    ...formula,
    ...sample,
    peakDate,
    status: "available",
    troughDate,
    valuePercent: formatPercent(maximumDrawdown),
  });
}

function calculateRangePosition(
  closes: readonly Decimal[],
  dates: readonly string[],
): PersonalMarketAnalyticsRangePositionMetric {
  const formula =
    PERSONAL_MARKET_ANALYTICS_FORMULAS.trailing252SessionCloseRangePosition;
  if (closes.length < formula.parameters.minimumSessions) {
    return freezeDeep({
      ...formula,
      ...sampleMetadata(dates),
      requiredSessions: formula.parameters.minimumSessions,
      status: "insufficient_history",
    });
  }

  const window = closes.slice(-formula.parameters.maximumWindowSessions);
  const sample = sampleMetadata(
    dates,
    formula.parameters.maximumWindowSessions,
  );
  const last = window.at(-1);
  const first = window[0];
  if (last === undefined || first === undefined) throw new TypeError();
  let minimum = first;
  let maximum = first;
  for (const close of window.slice(1)) {
    if (close.lt(minimum)) minimum = close;
    if (close.gt(maximum)) maximum = close;
  }

  if (maximum.eq(minimum)) {
    return freezeDeep({
      ...formula,
      ...sample,
      status: "zero_range",
    });
  }

  const value = last.minus(minimum).div(maximum.minus(minimum)).times(100);
  return freezeDeep({
    ...formula,
    ...sample,
    status: "available",
    valuePercent: formatPercent(value),
  });
}

function calculateSmaMetric<Key extends "sma20" | "sma50" | "sma200">(
  closes: readonly Decimal[],
  dates: readonly string[],
  key: Key,
): PersonalMarketAnalyticsSmaMetric<
  (typeof PERSONAL_MARKET_ANALYTICS_FORMULAS)[Key]
> {
  const formula = PERSONAL_MARKET_ANALYTICS_FORMULAS[key];
  if (closes.length < formula.parameters.minimumSessions) {
    return freezeDeep({
      ...formula,
      ...sampleMetadata(dates),
      requiredSessions: formula.parameters.minimumSessions,
      status: "insufficient_history",
    });
  }

  const window = closes.slice(-formula.parameters.windowSessions);
  const sample = sampleMetadata(dates, formula.parameters.windowSessions);
  const last = window.at(-1);
  if (last === undefined) throw new TypeError();
  const sum = window.reduce(
    (total, close) => total.plus(close),
    zeroLike(window[0]),
  );
  const mean = sum.div(window.length);
  const comparison = last.comparedTo(mean);
  const classification: PersonalMarketAnalyticsTrendClassification =
    comparison > 0 ? "above" : comparison < 0 ? "below" : "at";
  const distance = last.div(mean).minus(1).times(100);

  return freezeDeep({
    ...formula,
    ...sample,
    classification,
    distancePercent: formatPercent(distance),
    status: "available",
  });
}

function validateInput(input: unknown): ValidatedInput {
  if (!isPlainRecord(input) || !hasExactKeys(input, INPUT_KEYS)) {
    throw new TypeError();
  }
  const { asOfDate, bars, mode } = input;
  if (
    !isCanonicalDate(asOfDate) ||
    !Array.isArray(bars) ||
    (mode !== "adjusted" && mode !== "raw")
  ) {
    throw new TypeError();
  }

  const validatedBars: ValidatedBar[] = [];
  let previousDate: string | undefined;
  for (const bar of bars) {
    if (!isPlainRecord(bar) || !hasExactKeys(bar, BAR_KEYS)) {
      throw new TypeError();
    }
    const { adjusted, date, raw } = bar;
    if (
      !isCanonicalDate(date) ||
      date > asOfDate ||
      (previousDate !== undefined && date <= previousDate) ||
      !isPlainRecord(adjusted) ||
      !hasExactKeys(adjusted, CLOSE_KEYS) ||
      !isPlainRecord(raw) ||
      !hasExactKeys(raw, CLOSE_KEYS) ||
      !isPositiveFiniteDecimal(adjusted.close) ||
      !isPositiveFiniteDecimal(raw.close)
    ) {
      throw new TypeError();
    }
    validatedBars.push({
      adjustedClose: adjusted.close,
      date,
      rawClose: raw.close,
    });
    previousDate = date;
  }

  return { asOfDate, bars: validatedBars, mode };
}

function isCanonicalDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= (daysInMonth[month - 1] ?? 0);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isPositiveFiniteDecimal(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > MAXIMUM_DECIMAL_LENGTH ||
    !UNSIGNED_DECIMAL_PATTERN.test(value)
  ) {
    return false;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
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

function formatPercent(value: Decimal): string {
  const rounded = value.toDecimalPlaces(
    PERSONAL_MARKET_ANALYTICS_ROUNDING.decimalPlaces,
    Decimal.ROUND_HALF_UP,
  );
  if (!rounded.isFinite()) throw new TypeError();
  return rounded.isZero()
    ? "0.0000"
    : rounded.toFixed(PERSONAL_MARKET_ANALYTICS_ROUNDING.decimalPlaces);
}

function sampleMetadata(
  dates: readonly string[],
  maximumSessions = dates.length,
): {
  readonly observedSessions: number;
  readonly sampleFirstDate: string | null;
  readonly sampleLastDate: string | null;
} {
  const sampleDates = dates.slice(-maximumSessions);
  return {
    observedSessions: sampleDates.length,
    sampleFirstDate: sampleDates[0] ?? null,
    sampleLastDate: sampleDates.at(-1) ?? null,
  };
}

function zeroLike(value: Decimal | undefined): Decimal {
  if (value === undefined) throw new TypeError();
  return value.minus(value);
}

function freezeDeep<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) freezeDeep(nested);
  return Object.freeze(value);
}
