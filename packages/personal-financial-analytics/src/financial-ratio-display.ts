import Decimal from "decimal.js";

export interface PersonalFinancialRatioDisplay {
  readonly label: string;
  readonly exactValue: string;
  readonly rounded: boolean;
  readonly notation: "decimal" | "scientific" | "nonzero_interval";
}

const DisplayDecimal = Decimal.clone({ precision: 256 });

/** Display only. Calculations and comparisons must keep using the original value. */
export function formatPersonalFinancialRatio(
  value: string,
): PersonalFinancialRatioDisplay | null {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) return null;
  const exact = new DisplayDecimal(value);
  if (!exact.isFinite()) return null;
  const fixed = exact.toFixed(4, DisplayDecimal.ROUND_HALF_UP);
  if (!exact.isZero() && new DisplayDecimal(fixed).isZero()) {
    return Object.freeze({
      label: exact.isNegative() ? "-0.0001 < ratio < 0" : "0 < ratio < 0.0001",
      exactValue: value,
      rounded: true,
      notation: "nonzero_interval",
    });
  }
  const scientific = exact.abs().gte("1000000000");
  const rendered = exact.isZero()
    ? "0"
    : scientific
      ? exact.toExponential(4, DisplayDecimal.ROUND_HALF_UP)
      : fixed;
  const [mantissa, exponent] = rendered.split("e");
  const shortMantissa = mantissa!.includes(".")
    ? mantissa!.replace(/0+$/u, "").replace(/\.$/u, "")
    : mantissa!;
  const short =
    exponent === undefined ? shortMantissa : `${shortMantissa}e${exponent}`;
  const rounded = !new DisplayDecimal(rendered).eq(exact);
  return Object.freeze({
    label: `${rounded ? "≈ " : ""}${short} ratio`,
    exactValue: value,
    rounded,
    notation: scientific ? "scientific" : "decimal",
  });
}
