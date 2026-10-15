import Decimal from "decimal.js";

const D = Decimal.clone({ defaults: true, precision: 256 });

/** Arithmetic only; source, filing and period admission belongs to the caller. */
export function calculatePersonalMarginPercent(
  numerator: string,
  revenue: string,
): string {
  for (const value of [numerator, revenue]) {
    if (
      typeof value !== "string" ||
      value.length > 64 ||
      !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)
    )
      throw new TypeError("Invalid margin amount.");
  }
  const denominator = new D(revenue);
  if (!denominator.gt(0)) throw new TypeError("Revenue must be positive.");
  const result = new D(numerator)
    .div(denominator)
    .times(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return result.isZero() ? "0" : result.toFixed();
}

export type PersonalMarginComparison = Readonly<{
  prior: string;
  current: string;
  difference: string;
  direction: "higher" | "lower" | "unchanged";
}>;

/** Positive-denominator arithmetic only; compare unrounded ratios, then round once. */
export function comparePersonalMargins(
  priorNumerator: string,
  priorRevenue: string,
  currentNumerator: string,
  currentRevenue: string,
): PersonalMarginComparison {
  const current = calculatePersonalMarginPercent(
    currentNumerator,
    currentRevenue,
  );
  const prior = calculatePersonalMarginPercent(priorNumerator, priorRevenue);
  const numerator = new D(currentNumerator)
    .times(priorRevenue)
    .minus(new D(priorNumerator).times(currentRevenue));
  const difference = numerator
    .div(new D(priorRevenue).times(currentRevenue))
    .times(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const value = difference.isZero() ? "0" : difference.toFixed();
  // Each source amount has at most 64 characters; each positive denominator is
  // at least 10^-62. The signed difference is below 2 * 10^128 percentage points.
  if (value.length > 134) throw new TypeError("Invalid margin difference.");
  return Object.freeze({
    prior,
    current,
    difference: value,
    direction: numerator.isZero()
      ? "unchanged"
      : numerator.isNegative()
        ? "lower"
        : "higher",
  });
}
