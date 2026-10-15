import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { comparePersonalMargins } from "./personal-margin";

function fraction(value: string) {
  const [whole, digits = ""] = value.replace(/^-/, "").split(".");
  return {
    numerator: BigInt(whole! + digits) * (value.startsWith("-") ? -1n : 1n),
    denominator: 10n ** BigInt(digits.length),
  };
}

// Independent integer quotient/remainder oracle; no Decimal arithmetic or rounding.
function exactDifference(
  prior: string,
  priorRevenue: string,
  current: string,
  currentRevenue: string,
) {
  const p = fraction(prior),
    pr = fraction(priorRevenue);
  const c = fraction(current),
    cr = fraction(currentRevenue);
  const n =
    c.numerator * cr.denominator * p.denominator * pr.numerator -
    p.numerator * pr.denominator * c.denominator * cr.numerator;
  const d = c.denominator * cr.numerator * p.denominator * pr.numerator;
  const scaled = (n < 0n ? -n : n) * 10000n;
  const cents = scaled / d + ((scaled % d) * 2n >= d ? 1n : 0n);
  const digits = cents.toString().padStart(3, "0");
  const unsigned = `${digits.slice(0, -2)}.${digits.slice(-2)}`
    .replace(/0+$/, "")
    .replace(/\.$/, "");
  return {
    difference: cents === 0n ? "0" : `${n < 0n ? "-" : ""}${unsigned}`,
    direction: n === 0n ? "unchanged" : n < 0n ? "lower" : "higher",
  };
}

describe("positive-denominator margin comparison", () => {
  it.each([
    ["10", "100", "15", "120", "10", "12.5", "2.5", "higher"],
    ["-10", "100", "15", "120", "-10", "12.5", "22.5", "higher"],
    ["10", "100", "-15", "120", "10", "-12.5", "-22.5", "lower"],
    ["-0.00", "100", "0", "120", "0", "0", "0", "unchanged"],
    ["10", "100", "12", "120", "10", "10", "0", "unchanged"],
    ["0.999", "100", "1.004", "100", "1", "1", "0.01", "higher"],
    ["1.004", "100", "0.999", "100", "1", "1", "-0.01", "lower"],
    ["1.004", "100", "1.005", "100", "1", "1.01", "0", "higher"],
    ["1.005", "100", "1.004", "100", "1.01", "1", "0", "lower"],
  ])(
    "compares exact %s/%s with %s/%s before rounding",
    (p, pr, c, cr, prior, current, difference, direction) => {
      const result = comparePersonalMargins(p, pr, c, cr);
      expect(result).toEqual({ prior, current, difference, direction });
      expect(result).toMatchObject(exactDifference(p, pr, c, cr));
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.keys(result)).toEqual([
        "prior",
        "current",
        "difference",
        "direction",
      ]);
    },
  );

  it("preserves the direction of almost cancelling full-width cross products", () => {
    const a = "9".repeat(64);
    const b = `${"9".repeat(63)}8`;
    const c = `${"9".repeat(63)}7`;
    // (a-1)^2 - a*(a-2) is exactly one, despite both products having 128 digits.
    const result = comparePersonalMargins(a, b, b, c);
    expect(result).toEqual({
      prior: "100",
      current: "100",
      difference: "0",
      direction: "higher",
    });
    expect(result).toMatchObject(exactDifference(a, b, b, c));
  });

  it("matches an integer rational oracle across signed and extreme 64-character operands", () => {
    const numerators = [
      "0",
      "-0",
      "1",
      "-1",
      "9".repeat(64),
      `-${"9".repeat(63)}`,
      `0.${"0".repeat(61)}1`,
      `-0.${"0".repeat(60)}1`,
    ];
    const revenues = [
      "1",
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
      `0.${"0".repeat(60)}11`,
    ];
    let maxCharacters = 0;
    for (const p of numerators)
      for (const c of numerators)
        for (const pr of revenues)
          for (const cr of revenues) {
            const result = comparePersonalMargins(p, pr, c, cr);
            expect(result).toMatchObject(exactDifference(p, pr, c, cr));
            expect(result.difference.length).toBeLessThanOrEqual(134);
            expect(result.difference).not.toBe("-0");
            maxCharacters = Math.max(maxCharacters, result.difference.length);
          }
    expect(maxCharacters).toBe(133);
  });

  it("retains full fixed notation near the 134-character guard without using Number", () => {
    const tiny = `0.${"0".repeat(61)}1`;
    const result = comparePersonalMargins(
      "9".repeat(64),
      tiny,
      "-1.23456789",
      "3",
    );
    const expected = `-${"9".repeat(64)}${"0".repeat(62)}41.15`;
    expect(result.difference).toBe(expected);
    expect(result.difference).toHaveLength(132);
    expect(result).toMatchObject(
      exactDifference("9".repeat(64), tiny, "-1.23456789", "3"),
    );
  });

  it("uses isolated defaults when global Decimal precision and rounding change", () => {
    const original = {
      precision: Decimal.precision,
      rounding: Decimal.rounding,
    };
    try {
      Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN });
      expect(
        comparePersonalMargins("0.999", "100", "1.004", "100"),
      ).toMatchObject({ difference: "0.01", direction: "higher" });
    } finally {
      Decimal.set(original);
    }
  });

  it.each(["", "01", "1e3", "NaN", "Infinity", " 1", "+1", "9".repeat(65)])(
    "rejects malformed or oversized operand %s in every position",
    (invalid) => {
      for (const index of [0, 1, 2, 3]) {
        const args: [string, string, string, string] = ["1", "2", "3", "4"];
        args[index] = invalid;
        expect(() => comparePersonalMargins(...args)).toThrow(TypeError);
      }
    },
  );
  it.each(["0", "-0.00", "-1"])(
    "requires both denominators to be positive: %s",
    (invalid) => {
      expect(() => comparePersonalMargins("1", invalid, "3", "4")).toThrow(
        "Revenue must be positive.",
      );
      expect(() => comparePersonalMargins("1", "2", "3", invalid)).toThrow(
        "Revenue must be positive.",
      );
    },
  );
});
