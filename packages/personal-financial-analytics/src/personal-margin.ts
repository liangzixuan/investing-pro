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
