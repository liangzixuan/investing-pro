import Decimal from "decimal.js";
import { PERSONAL_FINANCIAL_ANALYTICS_ROUNDING } from "./personal-financial-analytics";

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
    throw new TypeError("Invalid liquidity amount.");
  return new D(value);
}

/** Callers admit the source, balance date and accession before calculating. */
export function calculatePersonalCurrentAssetsLessCurrentLiabilities(
  currentAssets: string,
  currentLiabilities: string,
):
  | Readonly<{ status: "available"; value: string }>
  | Readonly<{ status: "unavailable"; reason: "unsupported_sign" }> {
  const assets = amount(currentAssets);
  const liabilities = amount(currentLiabilities);
  if (assets.lt(0) || liabilities.lt(0))
    return Object.freeze({ status: "unavailable", reason: "unsupported_sign" });
  const result = assets.minus(liabilities);
  return Object.freeze({
    status: "available",
    value: result.isZero() ? "0" : result.toFixed(),
  });
}

/** A rounded multiple, independent of the exact working-capital calculation. */
export function calculatePersonalCurrentRatio(
  currentAssets: string,
  currentLiabilities: string,
):
  | Readonly<{ status: "available"; value: string }>
  | Readonly<{
      status: "unavailable";
      reason: "nonpositive_current_liabilities" | "unsupported_sign";
    }> {
  const assets = amount(currentAssets);
  const liabilities = amount(currentLiabilities);
  if (!liabilities.gt(0))
    return Object.freeze({
      status: "unavailable",
      reason: "nonpositive_current_liabilities",
    });
  if (assets.lt(0))
    return Object.freeze({ status: "unavailable", reason: "unsupported_sign" });
  const places = PERSONAL_FINANCIAL_ANALYTICS_ROUNDING.decimalPlaces;
  const rounded = assets
    .div(liabilities)
    .toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  return Object.freeze({
    status: "available",
    value: rounded.isZero() ? "0.00" : rounded.toFixed(places),
  });
}
