import Decimal from "decimal.js";

export const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SCHEMA_VERSION =
  "1.0.0" as const;
export const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULA_SET_VERSION =
  "1.0.0" as const;
export const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MINIMUM_OBSERVATIONS =
  60 as const;
export const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MAXIMUM_OBSERVATIONS =
  4096 as const;

export const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_METRICS = Object.freeze([
  "priceToEarnings",
  "priceToBook",
] as const);
export const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_RANGES = Object.freeze([
  "1m",
  "3m",
  "ytd",
  "1y",
  "5y",
  "10y",
] as const);
export const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_QUANTILE_PERCENTAGES =
  Object.freeze([25, 50, 75] as const);
export const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_UNAVAILABLE_REASONS =
  Object.freeze([
    "market_not_loaded",
    "valuation_history_not_loaded",
    "identity_mismatch",
    "range_mismatch",
    "no_common_date",
    "current_multiple_unavailable",
    "current_multiple_nonpositive",
    "reference_price_nonpositive",
    "insufficient_positive_observations",
  ] as const);

export const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING = freezeDeep({
  currentPercentileDecimalPlaces: 2,
  impliedPriceDecimalPlaces: 2,
  method: "round_half_up",
  multipleDecimalPlaces: 4,
  negativeZero: "normalize_to_positive_zero",
  percentDifferenceDecimalPlaces: 2,
} as const);

const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SHARED_PARAMETERS = {
  calculationPrecision: "80_significant_decimal_digits",
  eligibleObservation: "known_and_strictly_positive_selected_ratio",
  maximumObservations:
    PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MAXIMUM_OBSERVATIONS,
  minimumObservations:
    PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MINIMUM_OBSERVATIONS,
  missingObservationTreatment: "exclude_and_count_without_interpolation",
  roundingMethod: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING.method,
} as const;

export const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULAS = freezeDeep({
  currentPercentile: {
    formulaId: "weak_empirical_cdf_current_multiple_percentile",
    formulaVersion: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULA_SET_VERSION,
    parameters: {
      ...PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SHARED_PARAMETERS,
      comparison: "count_sample_values_less_than_or_equal_to_current",
      definition: "100_times_weak_count_divided_by_valid_sample_count",
      roundingDecimalPlaces:
        PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING.currentPercentileDecimalPlaces,
    },
  },
  impliedPrice: {
    formulaId: "historical_multiple_implied_price",
    formulaVersion: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULA_SET_VERSION,
    parameters: {
      ...PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SHARED_PARAMETERS,
      definition:
        "same_date_raw_close_times_target_multiple_divided_by_current_multiple",
      priceBasis: "latest_common_date_raw_end_of_day_close",
      roundingDecimalPlaces:
        PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING.impliedPriceDecimalPlaces,
      unit: "USD",
    },
  },
  percentDifference: {
    formulaId: "implied_price_difference_from_reference_percent",
    formulaVersion: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULA_SET_VERSION,
    parameters: {
      ...PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SHARED_PARAMETERS,
      definition: "100_times_implied_price_divided_by_raw_close_minus_one",
      roundingDecimalPlaces:
        PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING.percentDifferenceDecimalPlaces,
      unit: "percent",
    },
  },
  quantile: {
    formulaId: "historical_positive_multiple_quantile_r7",
    formulaVersion: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULA_SET_VERSION,
    parameters: {
      ...PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SHARED_PARAMETERS,
      definition:
        "sorted_linear_interpolation_at_zero_based_position_p_times_n_minus_one",
      method: "R-7",
      probabilities: "0.25_0.50_0.75",
      roundingDecimalPlaces:
        PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING.multipleDecimalPlaces,
    },
  },
} as const);

export const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_METHODOLOGY = freezeDeep({
  currentPercentile:
    PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULAS.currentPercentile,
  impliedPrice: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULAS.impliedPrice,
  percentDifference:
    PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULAS.percentDifference,
  quantile: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULAS.quantile,
  rounding: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING,
} as const);

export type PersonalHistoricalMultipleValuationMetric =
  (typeof PERSONAL_HISTORICAL_MULTIPLE_VALUATION_METRICS)[number];
export type PersonalHistoricalMultipleValuationRange =
  (typeof PERSONAL_HISTORICAL_MULTIPLE_VALUATION_RANGES)[number];
export type PersonalHistoricalMultipleValuationQuantilePercent =
  (typeof PERSONAL_HISTORICAL_MULTIPLE_VALUATION_QUANTILE_PERCENTAGES)[number];

export interface PersonalHistoricalMultipleValuationIdentity {
  readonly country: "US";
  readonly exchangeMic: string;
  readonly issuerName: string;
  readonly listingId: string;
  readonly securityName: string;
  readonly symbol: string;
}

export interface PersonalHistoricalMultipleValuationMarketBar {
  readonly date: string;
  readonly raw: Readonly<{ close: string }>;
}

export interface PersonalHistoricalMultipleValuationMarketInput {
  readonly bars: readonly PersonalHistoricalMultipleValuationMarketBar[];
  readonly range: PersonalHistoricalMultipleValuationRange;
  readonly security: PersonalHistoricalMultipleValuationIdentity;
}

export type PersonalHistoricalMultipleValuationRatioCell =
  | Readonly<{
      status: "known";
      unit: "ratio";
      value: string;
    }>
  | Readonly<{
      reason: "not_supplied_by_provider";
      status: "unknown";
      unit: "ratio";
      value: null;
    }>;

export interface PersonalHistoricalMultipleValuationPoint {
  readonly date: string;
  readonly priceToBook: PersonalHistoricalMultipleValuationRatioCell;
  readonly priceToEarnings: PersonalHistoricalMultipleValuationRatioCell;
}

export interface PersonalHistoricalMultipleValuationHistoryInput {
  readonly points: readonly PersonalHistoricalMultipleValuationPoint[];
  readonly range: PersonalHistoricalMultipleValuationRange;
  readonly security: PersonalHistoricalMultipleValuationIdentity;
}

export interface PersonalHistoricalMultipleValuationInput {
  readonly market: PersonalHistoricalMultipleValuationMarketInput | null;
  readonly metric: PersonalHistoricalMultipleValuationMetric;
  readonly valuation: PersonalHistoricalMultipleValuationHistoryInput | null;
}

export interface PersonalHistoricalMultipleValuationCoverage {
  readonly minimumRequiredObservations: typeof PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MINIMUM_OBSERVATIONS;
  readonly nonpositiveExcludedObservations: number;
  readonly sampleFirstDate: string | null;
  readonly sampleLastDate: string | null;
  readonly totalObservations: number;
  readonly unknownExcludedObservations: number;
  readonly validPositiveObservations: number;
}

export interface PersonalHistoricalMultipleValuationReference {
  readonly currentMultiple: string;
  readonly date: string;
  readonly rawCloseUsd: string;
}

export interface PersonalHistoricalMultipleValuationBand {
  readonly differencePercent: string;
  readonly impliedPriceUsd: string;
  readonly quantilePercent: PersonalHistoricalMultipleValuationQuantilePercent;
  readonly targetMultiple: string;
}

export interface PersonalHistoricalMultipleValuationBands {
  readonly p25: PersonalHistoricalMultipleValuationBand;
  readonly p50: PersonalHistoricalMultipleValuationBand;
  readonly p75: PersonalHistoricalMultipleValuationBand;
}

export type PersonalHistoricalMultipleValuationMethodology =
  typeof PERSONAL_HISTORICAL_MULTIPLE_VALUATION_METHODOLOGY;

export type PersonalHistoricalMultipleValuationUnavailableReason =
  (typeof PERSONAL_HISTORICAL_MULTIPLE_VALUATION_UNAVAILABLE_REASONS)[number];

interface PersonalHistoricalMultipleValuationResultBase {
  readonly formulaSetVersion: typeof PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULA_SET_VERSION;
  readonly methodology: PersonalHistoricalMultipleValuationMethodology;
  readonly metric: PersonalHistoricalMultipleValuationMetric;
  readonly schemaVersion: typeof PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SCHEMA_VERSION;
}

export interface PersonalHistoricalMultipleValuationAvailableResult extends PersonalHistoricalMultipleValuationResultBase {
  readonly bands: PersonalHistoricalMultipleValuationBands;
  readonly coverage: PersonalHistoricalMultipleValuationCoverage;
  readonly currentPercentilePercent: string;
  readonly reference: PersonalHistoricalMultipleValuationReference;
  readonly status: "available";
}

export interface PersonalHistoricalMultipleValuationUnavailableResult extends PersonalHistoricalMultipleValuationResultBase {
  readonly coverage: PersonalHistoricalMultipleValuationCoverage | null;
  readonly reason: PersonalHistoricalMultipleValuationUnavailableReason;
  readonly reference: PersonalHistoricalMultipleValuationReference | null;
  readonly status: "unavailable";
}

export type PersonalHistoricalMultipleValuationResult =
  | PersonalHistoricalMultipleValuationAvailableResult
  | PersonalHistoricalMultipleValuationUnavailableResult;

interface PersonalHistoricalMultipleValuationValidatedMarket {
  readonly bars: readonly Readonly<{ date: string; rawClose: string }>[];
  readonly range: PersonalHistoricalMultipleValuationRange;
  readonly security: PersonalHistoricalMultipleValuationIdentity;
}

interface PersonalHistoricalMultipleValuationValidatedPoint {
  readonly date: string;
  readonly priceToBook: PersonalHistoricalMultipleValuationRatioCell;
  readonly priceToEarnings: PersonalHistoricalMultipleValuationRatioCell;
}

interface PersonalHistoricalMultipleValuationValidatedHistory {
  readonly points: readonly PersonalHistoricalMultipleValuationValidatedPoint[];
  readonly range: PersonalHistoricalMultipleValuationRange;
  readonly security: PersonalHistoricalMultipleValuationIdentity;
}

interface PersonalHistoricalMultipleValuationValidatedInput {
  readonly market: PersonalHistoricalMultipleValuationValidatedMarket | null;
  readonly metric: PersonalHistoricalMultipleValuationMetric;
  readonly valuation: PersonalHistoricalMultipleValuationValidatedHistory | null;
}

interface PersonalHistoricalMultipleValuationCalculatedCoverage {
  readonly coverage: PersonalHistoricalMultipleValuationCoverage;
  readonly positiveValues: readonly Decimal[];
}

const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_CALCULATION_PRECISION = 80;
const PersonalHistoricalMultipleValuationValidationDecimal = Decimal.clone({
  defaults: true,
  precision: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_CALCULATION_PRECISION,
  rounding: Decimal.ROUND_HALF_UP,
});
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MAXIMUM_DECIMAL_LENGTH = 64;
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})$/u;
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_DECIMAL_PATTERN =
  /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_CONTROL_PATTERN =
  /[\p{Cc}\p{Cf}\p{Cs}]/u;
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_IDENTIFIER_PATTERN =
  /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_EXCHANGE_MIC_PATTERN =
  /^[A-Z0-9]{4}$/u;
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SYMBOL_PATTERN =
  /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_INPUT_KEYS = Object.freeze([
  "market",
  "metric",
  "valuation",
] as const);
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MARKET_KEYS = Object.freeze([
  "bars",
  "range",
  "security",
] as const);
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_HISTORY_KEYS = Object.freeze([
  "points",
  "range",
  "security",
] as const);
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_IDENTITY_KEYS = Object.freeze([
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const);
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_BAR_KEYS = Object.freeze([
  "date",
  "raw",
] as const);
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_RAW_KEYS = Object.freeze([
  "close",
] as const);
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_POINT_KEYS = Object.freeze([
  "date",
  "priceToBook",
  "priceToEarnings",
] as const);
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_KNOWN_CELL_KEYS = Object.freeze([
  "status",
  "unit",
  "value",
] as const);
const PERSONAL_HISTORICAL_MULTIPLE_VALUATION_UNKNOWN_CELL_KEYS = Object.freeze([
  "reason",
  "status",
  "unit",
  "value",
] as const);

export function calculatePersonalHistoricalMultipleValuation(
  input: PersonalHistoricalMultipleValuationInput,
): PersonalHistoricalMultipleValuationResult {
  try {
    return calculatePersonalHistoricalMultipleValuationValidated(
      validatePersonalHistoricalMultipleValuationInput(input),
    );
  } catch {
    throw new TypeError();
  }
}

function calculatePersonalHistoricalMultipleValuationValidated(
  input: PersonalHistoricalMultipleValuationValidatedInput,
): PersonalHistoricalMultipleValuationResult {
  if (input.market === null) {
    return unavailable(input.metric, "market_not_loaded", null, null);
  }
  if (input.valuation === null) {
    return unavailable(
      input.metric,
      "valuation_history_not_loaded",
      null,
      null,
    );
  }
  if (!sameIdentity(input.market.security, input.valuation.security)) {
    return unavailable(input.metric, "identity_mismatch", null, null);
  }
  if (input.market.range !== input.valuation.range) {
    return unavailable(input.metric, "range_mismatch", null, null);
  }

  const CalculationDecimal = Decimal.clone({
    defaults: true,
    precision: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_CALCULATION_PRECISION,
    rounding: Decimal.ROUND_HALF_UP,
  });
  const common = latestCommonObservation(
    input.market.bars,
    input.valuation.points,
  );
  if (common === null) {
    return unavailable(input.metric, "no_common_date", null, null);
  }
  const calculatedCoverage = calculateCoverage(
    input.valuation.points,
    input.metric,
    common.point.date,
    CalculationDecimal,
  );

  const currentCell = common.point[input.metric];
  if (currentCell.status === "unknown") {
    return unavailable(
      input.metric,
      "current_multiple_unavailable",
      calculatedCoverage.coverage,
      null,
    );
  }
  const currentMultiple = new CalculationDecimal(currentCell.value);
  const rawClose = new CalculationDecimal(common.bar.rawClose);
  const reference = freezeDeep({
    currentMultiple: currentCell.value,
    date: common.point.date,
    rawCloseUsd: common.bar.rawClose,
  });
  if (!currentMultiple.gt(0)) {
    return unavailable(
      input.metric,
      "current_multiple_nonpositive",
      calculatedCoverage.coverage,
      reference,
    );
  }
  if (!rawClose.gt(0)) {
    return unavailable(
      input.metric,
      "reference_price_nonpositive",
      calculatedCoverage.coverage,
      reference,
    );
  }
  if (
    calculatedCoverage.positiveValues.length <
    PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MINIMUM_OBSERVATIONS
  ) {
    return unavailable(
      input.metric,
      "insufficient_positive_observations",
      calculatedCoverage.coverage,
      reference,
    );
  }

  const sorted = [...calculatedCoverage.positiveValues].sort((left, right) =>
    left.comparedTo(right),
  );
  const band = (
    quantilePercent: PersonalHistoricalMultipleValuationQuantilePercent,
  ) => {
    const target = r7Quantile(
      sorted,
      new CalculationDecimal(quantilePercent).div(100),
      CalculationDecimal,
    );
    const impliedPrice = rawClose.times(target).div(currentMultiple);
    const difference = impliedPrice.div(rawClose).minus(1).times(100);
    return freezeDeep({
      differencePercent: formatDecimal(
        difference,
        PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING.percentDifferenceDecimalPlaces,
      ),
      impliedPriceUsd: formatDecimal(
        impliedPrice,
        PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING.impliedPriceDecimalPlaces,
      ),
      quantilePercent,
      targetMultiple: formatDecimal(
        target,
        PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING.multipleDecimalPlaces,
      ),
    });
  };
  const weakCount = sorted.reduce(
    (count, value) => count + (value.lte(currentMultiple) ? 1 : 0),
    0,
  );
  const currentPercentile = new CalculationDecimal(weakCount)
    .div(sorted.length)
    .times(100);

  return freezeDeep({
    bands: {
      p25: band(25),
      p50: band(50),
      p75: band(75),
    },
    coverage: calculatedCoverage.coverage,
    currentPercentilePercent: formatDecimal(
      currentPercentile,
      PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING.currentPercentileDecimalPlaces,
    ),
    formulaSetVersion:
      PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULA_SET_VERSION,
    methodology: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_METHODOLOGY,
    metric: input.metric,
    reference,
    schemaVersion: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SCHEMA_VERSION,
    status: "available",
  });
}

function calculateCoverage(
  points: readonly PersonalHistoricalMultipleValuationValidatedPoint[],
  metric: PersonalHistoricalMultipleValuationMetric,
  referenceDate: string,
  CalculationDecimal: typeof Decimal,
): PersonalHistoricalMultipleValuationCalculatedCoverage {
  const positiveValues: Decimal[] = [];
  const positiveDates: string[] = [];
  let nonpositiveExcludedObservations = 0;
  let totalObservations = 0;
  let unknownExcludedObservations = 0;
  for (const point of points) {
    if (point.date > referenceDate) break;
    totalObservations += 1;
    const cell = point[metric];
    if (cell.status === "unknown") {
      unknownExcludedObservations += 1;
      continue;
    }
    const value = new CalculationDecimal(cell.value);
    if (!value.gt(0)) {
      nonpositiveExcludedObservations += 1;
      continue;
    }
    positiveValues.push(value);
    positiveDates.push(point.date);
  }
  return {
    coverage: freezeDeep({
      minimumRequiredObservations:
        PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MINIMUM_OBSERVATIONS,
      nonpositiveExcludedObservations,
      sampleFirstDate: positiveDates[0] ?? null,
      sampleLastDate: positiveDates.at(-1) ?? null,
      totalObservations,
      unknownExcludedObservations,
      validPositiveObservations: positiveValues.length,
    }),
    positiveValues,
  };
}

function latestCommonObservation(
  bars: readonly Readonly<{ date: string; rawClose: string }>[],
  points: readonly PersonalHistoricalMultipleValuationValidatedPoint[],
): Readonly<{
  bar: Readonly<{ date: string; rawClose: string }>;
  point: PersonalHistoricalMultipleValuationValidatedPoint;
}> | null {
  let barIndex = bars.length - 1;
  let pointIndex = points.length - 1;
  while (barIndex >= 0 && pointIndex >= 0) {
    const bar = bars[barIndex];
    const point = points[pointIndex];
    if (bar === undefined || point === undefined) throw new TypeError();
    if (bar.date === point.date) return { bar, point };
    if (bar.date > point.date) barIndex -= 1;
    else pointIndex -= 1;
  }
  return null;
}

function r7Quantile(
  sorted: readonly Decimal[],
  probability: Decimal,
  CalculationDecimal: typeof Decimal,
): Decimal {
  if (sorted.length === 0) throw new TypeError();
  const position = new CalculationDecimal(sorted.length - 1).times(probability);
  const lowerIndex = position.floor().toNumber();
  const upperIndex = position.ceil().toNumber();
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];
  if (lower === undefined || upper === undefined) throw new TypeError();
  if (lowerIndex === upperIndex) return lower;
  return lower.plus(upper.minus(lower).times(position.minus(lowerIndex)));
}

function unavailable(
  metric: PersonalHistoricalMultipleValuationMetric,
  reason: PersonalHistoricalMultipleValuationUnavailableReason,
  coverage: PersonalHistoricalMultipleValuationCoverage | null,
  reference: PersonalHistoricalMultipleValuationReference | null,
): PersonalHistoricalMultipleValuationUnavailableResult {
  return freezeDeep({
    coverage,
    formulaSetVersion:
      PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULA_SET_VERSION,
    methodology: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_METHODOLOGY,
    metric,
    reason,
    reference,
    schemaVersion: PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SCHEMA_VERSION,
    status: "unavailable",
  });
}

function validatePersonalHistoricalMultipleValuationInput(
  input: unknown,
): PersonalHistoricalMultipleValuationValidatedInput {
  if (
    !isPlainRecord(input) ||
    !hasExactKeys(input, PERSONAL_HISTORICAL_MULTIPLE_VALUATION_INPUT_KEYS) ||
    !isMetric(input.metric)
  ) {
    throw new TypeError();
  }
  return {
    market:
      input.market === null
        ? null
        : validatePersonalHistoricalMultipleValuationMarket(input.market),
    metric: input.metric,
    valuation:
      input.valuation === null
        ? null
        : validatePersonalHistoricalMultipleValuationHistory(input.valuation),
  };
}

function validatePersonalHistoricalMultipleValuationMarket(
  value: unknown,
): PersonalHistoricalMultipleValuationValidatedMarket {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MARKET_KEYS) ||
    !Array.isArray(value.bars) ||
    value.bars.length >
      PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MAXIMUM_OBSERVATIONS ||
    !isRange(value.range)
  ) {
    throw new TypeError();
  }
  const bars: { date: string; rawClose: string }[] = [];
  let priorDate: string | undefined;
  for (const candidate of value.bars) {
    if (
      !isPlainRecord(candidate) ||
      !hasExactKeys(
        candidate,
        PERSONAL_HISTORICAL_MULTIPLE_VALUATION_BAR_KEYS,
      ) ||
      !isCanonicalDate(candidate.date) ||
      (priorDate !== undefined && candidate.date <= priorDate) ||
      !isPlainRecord(candidate.raw) ||
      !hasExactKeys(
        candidate.raw,
        PERSONAL_HISTORICAL_MULTIPLE_VALUATION_RAW_KEYS,
      ) ||
      !isCanonicalDecimal(candidate.raw.close)
    ) {
      throw new TypeError();
    }
    bars.push({ date: candidate.date, rawClose: candidate.raw.close });
    priorDate = candidate.date;
  }
  return {
    bars,
    range: value.range,
    security: validatePersonalHistoricalMultipleValuationIdentity(
      value.security,
    ),
  };
}

function validatePersonalHistoricalMultipleValuationHistory(
  value: unknown,
): PersonalHistoricalMultipleValuationValidatedHistory {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, PERSONAL_HISTORICAL_MULTIPLE_VALUATION_HISTORY_KEYS) ||
    !Array.isArray(value.points) ||
    value.points.length >
      PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MAXIMUM_OBSERVATIONS ||
    !isRange(value.range)
  ) {
    throw new TypeError();
  }
  const points: PersonalHistoricalMultipleValuationValidatedPoint[] = [];
  let priorDate: string | undefined;
  for (const candidate of value.points) {
    if (
      !isPlainRecord(candidate) ||
      !hasExactKeys(
        candidate,
        PERSONAL_HISTORICAL_MULTIPLE_VALUATION_POINT_KEYS,
      ) ||
      !isCanonicalDate(candidate.date) ||
      (priorDate !== undefined && candidate.date <= priorDate)
    ) {
      throw new TypeError();
    }
    points.push({
      date: candidate.date,
      priceToBook: validateRatioCell(candidate.priceToBook),
      priceToEarnings: validateRatioCell(candidate.priceToEarnings),
    });
    priorDate = candidate.date;
  }
  return {
    points,
    range: value.range,
    security: validatePersonalHistoricalMultipleValuationIdentity(
      value.security,
    ),
  };
}

function validateRatioCell(
  value: unknown,
): PersonalHistoricalMultipleValuationRatioCell {
  if (!isPlainRecord(value)) throw new TypeError();
  if (
    hasExactKeys(
      value,
      PERSONAL_HISTORICAL_MULTIPLE_VALUATION_KNOWN_CELL_KEYS,
    ) &&
    value.status === "known" &&
    value.unit === "ratio" &&
    isCanonicalDecimal(value.value)
  ) {
    return { status: "known", unit: "ratio", value: value.value };
  }
  if (
    hasExactKeys(
      value,
      PERSONAL_HISTORICAL_MULTIPLE_VALUATION_UNKNOWN_CELL_KEYS,
    ) &&
    value.reason === "not_supplied_by_provider" &&
    value.status === "unknown" &&
    value.unit === "ratio" &&
    value.value === null
  ) {
    return {
      reason: "not_supplied_by_provider",
      status: "unknown",
      unit: "ratio",
      value: null,
    };
  }
  throw new TypeError();
}

function validatePersonalHistoricalMultipleValuationIdentity(
  value: unknown,
): PersonalHistoricalMultipleValuationIdentity {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(
      value,
      PERSONAL_HISTORICAL_MULTIPLE_VALUATION_IDENTITY_KEYS,
    ) ||
    value.country !== "US" ||
    typeof value.exchangeMic !== "string" ||
    !PERSONAL_HISTORICAL_MULTIPLE_VALUATION_EXCHANGE_MIC_PATTERN.test(
      value.exchangeMic,
    ) ||
    !isBoundedDisplayText(value.issuerName, 256) ||
    typeof value.listingId !== "string" ||
    !PERSONAL_HISTORICAL_MULTIPLE_VALUATION_IDENTIFIER_PATTERN.test(
      value.listingId,
    ) ||
    !isBoundedDisplayText(value.securityName, 256) ||
    typeof value.symbol !== "string" ||
    !PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SYMBOL_PATTERN.test(value.symbol)
  ) {
    throw new TypeError();
  }
  return {
    country: "US",
    exchangeMic: value.exchangeMic,
    issuerName: value.issuerName,
    listingId: value.listingId,
    securityName: value.securityName,
    symbol: value.symbol,
  };
}

function isMetric(
  value: unknown,
): value is PersonalHistoricalMultipleValuationMetric {
  return value === "priceToEarnings" || value === "priceToBook";
}

function isRange(
  value: unknown,
): value is PersonalHistoricalMultipleValuationRange {
  return PERSONAL_HISTORICAL_MULTIPLE_VALUATION_RANGES.some(
    (range) => range === value,
  );
}

function sameIdentity(
  left: PersonalHistoricalMultipleValuationIdentity,
  right: PersonalHistoricalMultipleValuationIdentity,
): boolean {
  return (
    left.country === right.country &&
    left.exchangeMic === right.exchangeMic &&
    left.issuerName === right.issuerName &&
    left.listingId === right.listingId &&
    left.securityName === right.securityName &&
    left.symbol === right.symbol
  );
}

function isCanonicalDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = PERSONAL_HISTORICAL_MULTIPLE_VALUATION_DATE_PATTERN.exec(value);
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

function isCanonicalDecimal(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length >
      PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MAXIMUM_DECIMAL_LENGTH ||
    !PERSONAL_HISTORICAL_MULTIPLE_VALUATION_DECIMAL_PATTERN.test(value)
  ) {
    return false;
  }
  try {
    return new PersonalHistoricalMultipleValuationValidationDecimal(
      value,
    ).isFinite();
  } catch {
    return false;
  }
}

function isBoundedDisplayText(
  value: unknown,
  maximumCodePoints: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    [...value].length <= maximumCodePoints &&
    !PERSONAL_HISTORICAL_MULTIPLE_VALUATION_CONTROL_PATTERN.test(value)
  );
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

function formatDecimal(value: Decimal, decimalPlaces: number): string {
  if (value.isZero()) return value.abs().toFixed(decimalPlaces);
  return value
    .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
    .toFixed(decimalPlaces);
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
