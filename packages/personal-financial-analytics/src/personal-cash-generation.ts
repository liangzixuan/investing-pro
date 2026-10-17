import Decimal from "decimal.js";

const D = Decimal.clone({
  defaults: true,
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -256,
  toExpPos: 256,
});

function amount(value: string): Decimal {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)
  )
    throw new TypeError("Invalid cash generation amount.");
  return new D(value);
}

/** Source/period admission belongs to the caller; preserve reported signs. */
export function calculatePersonalOperatingCashFlowLessPpePurchases(
  operatingCashFlow: string,
  ppePurchases: string,
):
  | Readonly<{ status: "available"; value: string }>
  | Readonly<{ status: "unavailable"; reason: "unsupported_sign" }> {
  const operating = amount(operatingCashFlow);
  const purchases = amount(ppePurchases);
  if (purchases.lt(0))
    return Object.freeze({ status: "unavailable", reason: "unsupported_sign" });
  const result = operating.minus(purchases);
  return Object.freeze({
    status: "available",
    value: result.isZero() ? "0" : result.toFixed(),
  });
}

// Each raw amount has at most 64 characters. The negative difference has
// magnitude below 1.1 * 10^64; positive revenue is at least 10^-62. After
// multiplying by 100, at most 129 integer digits, a sign and ".00" are needed.
export const PERSONAL_CASH_GENERATION_MARGIN_MAX_CHARACTERS = 133;

/** Exact raw operands; source, filing and period admission belongs to the caller. */
export function calculatePersonalOperatingCashFlowLessPpePurchasesMargin(
  operatingCashFlow: string,
  ppePurchases: string,
  revenue: string,
):
  | Readonly<{ status: "available"; value: string }>
  | Readonly<{
      status: "unavailable";
      reason: "unsupported_sign" | "nonpositive_revenue";
    }> {
  const operating = amount(operatingCashFlow);
  const purchases = amount(ppePurchases);
  const denominator = amount(revenue);
  if (purchases.lt(0))
    return Object.freeze({ status: "unavailable", reason: "unsupported_sign" });
  if (!denominator.gt(0))
    return Object.freeze({
      status: "unavailable",
      reason: "nonpositive_revenue",
    });
  const result = operating
    .minus(purchases)
    .div(denominator)
    .times(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const value = result.isZero() ? "0.00" : result.toFixed(2);
  if (value.length > PERSONAL_CASH_GENERATION_MARGIN_MAX_CHARACTERS)
    throw new TypeError("Invalid cash generation margin.");
  return Object.freeze({ status: "available", value });
}
