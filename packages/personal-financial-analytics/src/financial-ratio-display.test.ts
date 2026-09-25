import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { formatPersonalFinancialRatio } from "./financial-ratio-display";

describe("formatPersonalFinancialRatio", () => {
  it.each([
    ["0", "0 ratio", false],
    ["-0.0000", "0 ratio", false],
    ["1.2500", "1.25 ratio", false],
    ["-2.5", "-2.5 ratio", false],
    ["0.333333333333333333333333333333", "≈ 0.3333 ratio", true],
    ["1.23445", "≈ 1.2345 ratio", true],
    ["-1.23445", "≈ -1.2345 ratio", true],
    ["0.00005", "≈ 0.0001 ratio", true],
    ["-0.00005", "≈ -0.0001 ratio", true],
    ["0.00000001", "0 < ratio < 0.0001", true],
    ["-0.00000001", "-0.0001 < ratio < 0", true],
    ["1000000000", "1e+9 ratio", false],
    ["1234567890", "≈ 1.2346e+9 ratio", true],
    ["-1234567890", "≈ -1.2346e+9 ratio", true],
    ["999999999", "999999999 ratio", false],
  ])("formats %s without altering its source", (value, label, rounded) => {
    const result = formatPersonalFinancialRatio(value);
    expect(result).toMatchObject({ label, exactValue: value, rounded });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("bounds a huge ratio and retains all 256 calculation digits", () => {
    const value = "9".repeat(256);
    const result = formatPersonalFinancialRatio(value)!;
    expect(result.label).toBe("≈ 1e+256 ratio");
    expect(result.exactValue).toBe(value);
    expect(result.notation).toBe("scientific");
  });

  it.each([
    "NaN",
    "Infinity",
    "1e3",
    " 1",
    "1 ",
    "",
    ".5",
    "01",
    "+1",
    "1,000",
  ])("refuses non-canonical input %s", (value) => {
    expect(formatPersonalFinancialRatio(value)).toBeNull();
  });

  it("does not change the shared Decimal configuration", () => {
    const precision = Decimal.precision;
    const rounding = Decimal.rounding;
    formatPersonalFinancialRatio("1.23445");
    expect(Decimal.precision).toBe(precision);
    expect(Decimal.rounding).toBe(rounding);
  });

  it("keeps different exact values distinct even when their labels round alike", () => {
    const first = formatPersonalFinancialRatio("0.33331")!;
    const second = formatPersonalFinancialRatio("0.33332")!;
    expect(first.label).toBe(second.label);
    expect(first.exactValue).not.toBe(second.exactValue);
  });
});
