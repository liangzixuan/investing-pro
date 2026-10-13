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
