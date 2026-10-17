import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  calculateAuthoredCashFlowDcf,
  calculateAuthoredPriceComparison,
  type AuthoredCashFlowDcfInput,
} from "./authored-cash-flow-dcf";

const input: AuthoredCashFlowDcfInput = {
  startingUnleveredCashFlowUsd: "100",
  enterpriseToEquityBridgeUsd: "100",
  dilutedShares: "10",
  forecastYears: 5,
  waccPercent: "10",
  terminalGrowthPercent: "0",
  scenarios: {
    conservative: { annualCashFlowGrowthPercent: "0" },
    base: { annualCashFlowGrowthPercent: "10" },
    expansion: { annualCashFlowGrowthPercent: "20" },
  },
};
describe("authored cash-flow DCF", () => {
  it("reuses exact DCF goldens without a price or provider input", () => {
    const result = calculateAuthoredCashFlowDcf(input);
    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error();
    expect(
      [
        result.scenarios.conservative,
        result.scenarios.base,
        result.scenarios.expansion,
      ].map((s) => (s.status === "available" ? s.valuePerShareUsd : s.reason)),
    ).toEqual(["90.00", "140.00", "209.91"]);
    expect(result.scenarios.base.projection).toHaveLength(5);
    expect(result.scenarios.base.projection[0]).toEqual({
      year: 1,
      cashFlowUsd: "110.00",
      presentValueUsd: "100.00",
    });
    expect(result.scenarios.base.enterpriseValueUsd).toBe("1500.00");
    expect(result.scenarios.base.equityValueUsd).toBe("1400.00");
    expect(result.sensitivity.cells).toHaveLength(25);
    expect(JSON.stringify(result)).not.toMatch(
      /rawClose|provider_market|differencePercent/,
    );
    expect(result.inputs).toEqual(input);
    expect(result.inputs).not.toBe(input);
    expect(Object.isFrozen(result.scenarios.base.projection)).toBe(true);
  });
  it("applies both bridge signs and isolates nonpositive residual outcomes", () => {
    const cash = calculateAuthoredCashFlowDcf({
      ...input,
      enterpriseToEquityBridgeUsd: "-100",
    });
    expect(
      cash.status === "available" &&
        cash.scenarios.conservative.status === "available" &&
        cash.scenarios.conservative.valuePerShareUsd,
    ).toBe("110.00");
    const result = calculateAuthoredCashFlowDcf({
      ...input,
      enterpriseToEquityBridgeUsd: "1500",
    });
    if (result.status !== "available") throw new Error();
    expect(result.scenarios.conservative).toMatchObject({
      status: "unavailable",
      reason: "nonpositive_equity_value",
      enterpriseValueUsd: "1000.00",
      equityValueUsd: "-500.00",
    });
    expect(result.scenarios.base).toMatchObject({
      status: "unavailable",
      equityValueUsd: "0.00",
    });
    expect(result.scenarios.expansion.status).toBe("available");
    expect(result.sensitivity.cells.some((c) => c.status === "available")).toBe(
      true,
    );
    expect(
      result.sensitivity.cells.some(
        (c) =>
          c.status === "unavailable" && c.reason === "nonpositive_equity_value",
      ),
    ).toBe(true);
  });
  it("refuses sensitivity cells independently at bounds and the rate gap", () => {
    const bounded = calculateAuthoredCashFlowDcf({
      ...input,
      waccPercent: "1",
    });
    if (bounded.status !== "available") throw new Error();
    expect(
      bounded.sensitivity.cells.filter((c) => c.status === "unavailable")
        .length,
    ).toBeGreaterThan(0);
    expect(
      bounded.sensitivity.cells.filter((c) => c.status === "available").length,
    ).toBeGreaterThan(0);
    const gap = calculateAuthoredCashFlowDcf({
      ...input,
      waccPercent: "5",
      terminalGrowthPercent: "4",
    });
    if (gap.status !== "available") throw new Error();
    expect(
      gap.sensitivity.cells.some(
        (c) =>
          c.status === "unavailable" &&
          c.reason === "discount_rate_not_above_terminal_growth",
      ),
    ).toBe(true);
  });
  it.each([
    "",
    " ",
    "NaN",
    "Infinity",
    "-Infinity",
    "1e3",
    "+1",
    "01",
    "1.",
    "9".repeat(65),
    "1000000000000000000000000000001",
    "0.0000000000000000001",
    null,
    100,
  ])(
    "refuses malformed or oversized operands %j without changing the draft",
    (value) => {
      const raw = { ...input, startingUnleveredCashFlowUsd: value };
      const before = JSON.stringify(raw);
      expect(calculateAuthoredCashFlowDcf(raw)).toMatchObject({
        status: "unavailable",
        reason: "invalid_input",
      });
      expect(JSON.stringify(raw)).toBe(before);
    },
  );
  it.each([
    [{ dilutedShares: "0" }, "shares_nonpositive"],
    [{ startingUnleveredCashFlowUsd: "0" }, "starting_cash_flow_nonpositive"],
    [{ waccPercent: "31" }, "wacc_out_of_bounds"],
    [{ terminalGrowthPercent: "6" }, "terminal_growth_out_of_bounds"],
    [{ forecastYears: 4 }, "forecast_years_out_of_bounds"],
    [
      { waccPercent: "4", terminalGrowthPercent: "4" },
      "discount_rate_not_above_terminal_growth",
    ],
    [
      {
        scenarios: {
          ...input.scenarios,
          conservative: { annualCashFlowGrowthPercent: "11" },
        },
      },
      "scenario_growth_not_ordered",
    ],
    [
      {
        scenarios: {
          ...input.scenarios,
          expansion: { annualCashFlowGrowthPercent: "51" },
        },
      },
      "scenario_growth_out_of_bounds",
    ],
    [{ waccPercent: "10.00001" }, "invalid_input"],
    [{ forecastYears: Infinity }, "invalid_input"],
  ])("enforces assumption admission %j", (patch, reason) => {
    expect(calculateAuthoredCashFlowDcf({ ...input, ...patch })).toMatchObject({
      status: "unavailable",
      reason,
    });
  });
  it("rejects missing and extra inputs", () => {
    const { enterpriseToEquityBridgeUsd: omitted, ...missing } = input;
    expect(omitted).toBe("100");
    expect(calculateAuthoredCashFlowDcf(missing).status).toBe("unavailable");
    expect(
      calculateAuthoredCashFlowDcf({ ...input, referencePrice: "10" }).status,
    ).toBe("unavailable");
  });
  it("isolates Decimal settings and serializes a reproducible result", () => {
    const expected = calculateAuthoredCashFlowDcf(input);
    const settings = {
      precision: Decimal.precision,
      rounding: Decimal.rounding,
    };
    try {
      Decimal.set({ precision: 3, rounding: Decimal.ROUND_DOWN });
      expect(calculateAuthoredCashFlowDcf(input)).toEqual(expected);
    } finally {
      Decimal.set(settings);
    }
    expect(JSON.parse(JSON.stringify(expected))).toEqual(expected);
  });
  it("keeps optional price comparison separate and refuses missing prices", () => {
    expect(calculateAuthoredPriceComparison("140", "100")).toEqual({
      status: "available",
      differencePercent: "40.00",
    });
    for (const price of [null, undefined, "", "0", "NaN", "Infinity"])
      expect(calculateAuthoredPriceComparison("140", price).status).toBe(
        "unavailable",
      );
  });
});
