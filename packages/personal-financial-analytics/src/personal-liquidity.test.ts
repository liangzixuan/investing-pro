import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  calculatePersonalCurrentAssetsLessCurrentLiabilities as difference,
  calculatePersonalCurrentRatio as ratio,
} from "./personal-liquidity";

describe("liquidity arithmetic", () => {
  it.each([
    ["120", "80", "40", "1.50"],
    ["1", "8", "-7", "0.13"],
    ["0", "1", "-1", "0.00"],
    ["1.005", "1", "0.005", "1.01"],
    ["1.004999999999999999", "1", "0.004999999999999999", "1.00"],
    ["100.000000000000000001", "100", "0.000000000000000001", "1.00"],
  ])(
    "keeps exact difference and independent rounded ratio for %s / %s",
    (a, l, d, r) => {
      expect(difference(a, l)).toEqual({ status: "available", value: d });
      expect(ratio(a, l)).toEqual({ status: "available", value: r });
    },
  );

  it("allows zero liabilities only for working capital", () => {
    expect(difference("5", "0")).toEqual({ status: "available", value: "5" });
    expect(difference("0", "0")).toEqual({ status: "available", value: "0" });
    expect(ratio("5", "0")).toEqual({
      status: "unavailable",
      reason: "nonpositive_current_liabilities",
    });
  });

  it.each([
    ["-1", "2"],
    ["1", "-2"],
    ["-1", "-2"],
  ])("refuses signed operands %s / %s without reversing them", (a, l) => {
    expect(difference(a, l)).toEqual({
      status: "unavailable",
      reason: "unsupported_sign",
    });
    expect(ratio(a, l)).toEqual({
      status: "unavailable",
      reason: l.startsWith("-")
        ? "nonpositive_current_liabilities"
        : "unsupported_sign",
    });
  });

  it("retains the established maximal 128/129-character derived outputs", () => {
    const small = `0.${"0".repeat(61)}1`;
    const large = "9".repeat(64);
    const d = difference(small, large);
    const r = ratio(large, small);
    expect(d).toEqual({
      status: "available",
      value: `-${"9".repeat(63)}8.${"9".repeat(61)}9`,
    });
    expect(r).toEqual({
      status: "available",
      value: `${large}${"0".repeat(62)}.00`,
    });
    if (d.status === "available" && r.status === "available") {
      expect(d.value).toHaveLength(128);
      expect(r.value).toHaveLength(129);
    }
  });

  it("isolates calculation precision and rounding from global Decimal configuration", () => {
    const precision = Decimal.precision;
    const rounding = Decimal.rounding;
    try {
      Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN });
      expect(difference("100.000000000000000001", "100")).toEqual({
        status: "available",
        value: "0.000000000000000001",
      });
      expect(ratio("1", "8")).toEqual({ status: "available", value: "0.13" });
    } finally {
      Decimal.set({ precision, rounding });
    }
  });

  it.each(["NaN", "Infinity", "1e5", "01", "", "9".repeat(65)])(
    "rejects malformed or over-bound input %s",
    (value) => {
      expect(() => difference(value, "1")).toThrow(TypeError);
      expect(() => ratio("1", value)).toThrow(TypeError);
    },
  );
});
