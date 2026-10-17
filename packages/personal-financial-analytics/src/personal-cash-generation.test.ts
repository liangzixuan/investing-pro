import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  calculatePersonalOperatingCashFlowLessPpePurchases as subtract,
  calculatePersonalOperatingCashFlowLessPpePurchasesMargin as margin,
  PERSONAL_CASH_GENERATION_MARGIN_MAX_CHARACTERS as limit,
} from "./personal-cash-generation";

function decimal(value: string) {
  const [integer, fraction = ""] = value.split(".");
  return { coefficient: BigInt(integer! + fraction), scale: fraction.length };
}

/** Independent integer oracle: exact signed quotient, one half-up rounding. */
function exact(ocf: string, ppe: string, revenue: string): string {
  const a = decimal(ocf),
    b = decimal(ppe),
    c = decimal(revenue);
  const scale = Math.max(a.scale, b.scale);
  const difference =
    a.coefficient * 10n ** BigInt(scale - a.scale) -
    b.coefficient * 10n ** BigInt(scale - b.scale);
  const numerator = difference * 10n ** BigInt(c.scale) * 10_000n;
  const denominator = c.coefficient * 10n ** BigInt(scale);
  const absolute = numerator < 0n ? -numerator : numerator;
  const rounded =
    absolute / denominator +
    ((absolute % denominator) * 2n >= denominator ? 1n : 0n);
  return `${numerator < 0n && rounded !== 0n ? "-" : ""}${rounded / 100n}.${(rounded % 100n).toString().padStart(2, "0")}`;
}

const smallest = "0." + "0".repeat(61) + "1";
const largest = "9".repeat(64);
const negative = "-" + "9".repeat(63);

describe("cash generation percentage arithmetic", () => {
  it.each([
    ["120.125", "200.25", "1000", "-8.01"],
    ["120", "20", "1000", "10.00"],
    ["0", "0", "100", "0.00"],
    ["-5", "0", "2", "-250.00"],
    ["1", "0", "32", "3.13"],
    ["0", "1", "32", "-3.13"],
    ["0", "0.00001", "100", "0.00"],
    ["1.00004", "1", "0.001", "4.00"],
    ["0", "-0", "2", "0.00"],
  ])("uses exact raw values %s - %s over %s", (ocf, ppe, revenue, expected) => {
    const result = margin(ocf, ppe, revenue);
    expect(result).toEqual({ status: "available", value: expected });
    expect(result).toEqual({
      status: "available",
      value: exact(ocf, ppe, revenue),
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("reaches the proven 133-character bound without changing the raw 64-character contract", () => {
    const result = margin(negative, largest, smallest);
    expect([negative.length, largest.length, smallest.length]).toEqual([
      64, 64, 64,
    ]);
    expect(result).toEqual({
      status: "available",
      value: exact(negative, largest, smallest),
    });
    if (result.status !== "available")
      throw new Error("Expected boundary value");
    expect(limit).toBe(133);
    expect(result.value.length).toBe(limit);
    expect(result.value).not.toMatch(/[eE]/u);
  });

  it.each([
    [largest, smallest, smallest],
    [negative, largest, smallest],
    [
      smallest,
      largest,
      "0.000000000000000000000000000000000000000000000000000000000001",
    ],
    [largest, "9".repeat(63), "7".repeat(64)],
    ["1." + "0".repeat(60) + "1", "1", "7".repeat(64)],
    ["0", smallest, largest],
    ["1", "0", "20000"],
    [
      "0.99999999999999999999999999999999999999999999999999999999999999",
      "0",
      "20000",
    ],
    [
      "1.00000000000000000000000000000000000000000000000000000000000001",
      "0",
      "20000",
    ],
  ])(
    "matches independent integer arithmetic at long/rounding boundaries (%s, %s, %s)",
    (ocf, ppe, revenue) => {
      const expected = exact(ocf, ppe, revenue);
      expect(margin(ocf, ppe, revenue)).toEqual({
        status: "available",
        value: expected,
      });
      expect(expected.length).toBeLessThanOrEqual(limit);
    },
  );

  it.each([
    ["1", "-1", "0", "unsupported_sign"],
    ["1", "-1", "-1", "unsupported_sign"],
    ["1", "0", "0", "nonpositive_revenue"],
    ["1", "0", "-1", "nonpositive_revenue"],
  ])(
    "preserves sign-refusal priority (%s, %s, %s)",
    (ocf, ppe, revenue, reason) => {
      const result = margin(ocf, ppe, revenue);
      expect(result).toEqual({ status: "unavailable", reason });
      expect(Object.isFrozen(result)).toBe(true);
    },
  );

  it.each([
    "",
    " 1",
    "+1",
    "01",
    ".5",
    "1.",
    "1e4",
    "NaN",
    "Infinity",
    "9".repeat(65),
  ])("keeps raw admission unchanged for %j in every position", (invalid) => {
    expect(() => margin(invalid, "0", "1")).toThrow(TypeError);
    expect(() => margin("1", invalid, "1")).toThrow(TypeError);
    expect(() => margin("1", "0", invalid)).toThrow(TypeError);
    expect(() => subtract(invalid, "0")).toThrow(TypeError);
  });

  it("uses its isolated 256-digit clone regardless of mutable global Decimal settings", () => {
    const precision = Decimal.precision,
      rounding = Decimal.rounding;
    try {
      Decimal.set({ precision: 3, rounding: Decimal.ROUND_DOWN });
      expect(margin(negative, largest, smallest)).toEqual({
        status: "available",
        value: exact(negative, largest, smallest),
      });
      expect(margin("1", "0", "32")).toEqual({
        status: "available",
        value: "3.13",
      });
    } finally {
      Decimal.set({ precision, rounding });
    }
  });
});
