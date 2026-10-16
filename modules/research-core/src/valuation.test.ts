import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  calculateAuthoredExitMultiple,
  calculateValuation,
  type AuthoredExitMultipleInput,
} from "./valuation";

const base = {
  baseRevenue: "116.4",
  cash: "24.0",
  debt: "40.0",
  dilutedShares: "25.0",
  annualRevenueGrowthPercent: "10.0",
  targetEbitdaMarginPercent: "20.0",
  discountRatePercent: "10.0",
  exitMultiple: "12.0",
  horizonYears: 5,
};
const input: AuthoredExitMultipleInput = {
  baseRevenue: base.baseRevenue,
  cash: base.cash,
  debt: base.debt,
  dilutedShares: base.dilutedShares,
  horizonYears: base.horizonYears,
  discountRatePercent: base.discountRatePercent,
  scenarios: {
    conservative: {
      annualRevenueGrowthPercent: "0",
      targetEbitdaMarginPercent: "10",
      exitMultiple: "8",
    },
    base: {
      annualRevenueGrowthPercent: base.annualRevenueGrowthPercent,
      targetEbitdaMarginPercent: base.targetEbitdaMarginPercent,
      exitMultiple: base.exitMultiple,
    },
    expansion: {
      annualRevenueGrowthPercent: "20",
      targetEbitdaMarginPercent: "30",
      exitMultiple: "16",
    },
  },
};
describe("exit-multiple admission and authored scenarios", () => {
  it("retains exact operands in the formula trace instead of rounding the inputs before display", () => {
    const result = calculateValuation({
      ...base,
      baseRevenue: "100.0000001",
      annualRevenueGrowthPercent: "10.1234",
      targetEbitdaMarginPercent: "20.4321",
      discountRatePercent: "10.0001",
      exitMultiple: "12.0000001",
      cash: "24.0000001",
      debt: "40.0000001",
      dilutedShares: "25.0000001",
    });
    for (const value of [
      "100.0000001",
      "10.1234",
      "20.4321",
      "10.0001",
      "12.0000001",
      "24.0000001",
      "40.0000001",
      "25.0000001",
    ])
      expect(result.formulaTrace.join(" ")).toContain(value);
  });
  it("retains the existing golden and runs every scenario and sensitivity through that engine", () => {
    expect(calculateValuation(base).valuePerShare).toBe("10.53");
    const result = calculateAuthoredExitMultiple(input);
    if (result.status !== "available") throw new Error();
    expect(result.scenarios.base.valuePerShare).toBe("10.53");
    for (const scenario of Object.values(result.scenarios)) {
      const exact = calculateValuation(scenario.inputs);
      expect(scenario).toMatchObject(exact);
      expect(scenario.formulaTrace).toHaveLength(6);
    }
    expect(result.sensitivity.cells).toHaveLength(25);
    for (const cell of result.sensitivity.cells)
      if ("result" in cell)
        expect(cell.result).toMatchObject(
          calculateValuation(cell.result.inputs),
        );
    expect(result.inputs).toEqual(input);
    expect(result.inputs).not.toBe(input);
    expect(Object.isFrozen(result.scenarios.base.formulaTrace)).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
  it.each([
    "NaN",
    "Infinity",
    "-Infinity",
    "",
    " ",
    "1e2",
    "+1",
    "01",
    "9".repeat(65),
    "1000000000000000000000000000001",
    "0.0000000000000000001",
    null,
    100,
  ])("refuses invalid raw decimals %j", (value) => {
    expect(() =>
      calculateValuation({ ...base, baseRevenue: value as string }),
    ).toThrow();
    const raw = { ...input, baseRevenue: value };
    const before = JSON.stringify(raw);
    expect(calculateAuthoredExitMultiple(raw)).toMatchObject({
      status: "unavailable",
      reason: "invalid_input",
    });
    expect(JSON.stringify(raw)).toBe(before);
  });
  it("requires positive operands, explicit known zero cash/debt, and bounded rates", () => {
    for (const field of [
      "baseRevenue",
      "dilutedShares",
      "exitMultiple",
    ] as const)
      for (const value of ["0", "-0", "-1"])
        expect(() => calculateValuation({ ...base, [field]: value })).toThrow();
    for (const field of ["cash", "debt"] as const)
      expect(() => calculateValuation({ ...base, [field]: "" })).toThrow();
    expect(
      Number(calculateValuation({ ...base, cash: "0", debt: "0" }).equityValue),
    ).toBeGreaterThan(0);
    expect(
      calculateAuthoredExitMultiple({
        ...input,
        discountRatePercent: "10.00001",
      }).status,
    ).toBe("unavailable");
    expect(
      calculateAuthoredExitMultiple({ ...input, horizonYears: 11 }).status,
    ).toBe("unavailable");
    expect(
      calculateAuthoredExitMultiple({ ...input, cash: undefined }).status,
    ).toBe("unavailable");
  });
  it("retains nonpositive equity as an inspected outcome and isolates refused sensitivity cells", () => {
    const result = calculateAuthoredExitMultiple({
      ...input,
      debt: "200",
      discountRatePercent: "1",
      scenarios: {
        ...input.scenarios,
        base: { ...input.scenarios.base, exitMultiple: "1" },
      },
    });
    if (result.status !== "available") throw new Error();
    expect(result.scenarios.conservative).toMatchObject({
      status: "unavailable",
      reason: "nonpositive_equity_value",
    });
    expect(Number(result.scenarios.conservative.equityValue)).toBeLessThan(0);
    expect(result.scenarios.expansion.status).toBe("available");
    expect(
      result.sensitivity.cells.some(
        (c) =>
          c.status === "unavailable" &&
          c.reason === "sensitivity_input_out_of_bounds",
      ),
    ).toBe(true);
    expect(result.sensitivity.cells.some((c) => "result" in c)).toBe(true);
    const tiny = calculateAuthoredExitMultiple({
      ...input,
      baseRevenue: "0.000000000000000001",
      cash: "0",
      debt: "0",
      scenarios: {
        ...input.scenarios,
        base: { ...input.scenarios.base, targetEbitdaMarginPercent: "-0.0001" },
      },
    });
    if (tiny.status !== "available") throw new Error();
    expect(tiny.scenarios.base).toMatchObject({
      status: "unavailable",
      reason: "nonpositive_equity_value",
      equityValue: "0.000",
    });
  });
  it("isolates arithmetic from global Decimal configuration", () => {
    const expected = calculateValuation(base);
    const settings = {
      precision: Decimal.precision,
      rounding: Decimal.rounding,
    };
    try {
      Decimal.set({ precision: 3, rounding: Decimal.ROUND_DOWN });
      expect(calculateValuation(base)).toEqual(expected);
    } finally {
      Decimal.set(settings);
    }
  });
});
