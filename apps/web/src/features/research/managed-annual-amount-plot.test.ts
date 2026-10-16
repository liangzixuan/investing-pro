import { describe, expect, it } from "vitest";
import { projectManagedAnnualAmountPlot } from "./managed-annual-amount-plot";

describe("managed annual amount coordinates", () => {
  it.each([
    "0",
    "-1",
    "1.25",
    "-0.0001",
    "9007199254740991",
    "-9007199254740991",
    "9007199254740990.9",
    `0.${"0".repeat(61)}1`,
    `-0.${"0".repeat(60)}1`,
  ])("retains the approximate signed coordinate for %s", (amount) => {
    const result = projectManagedAnnualAmountPlot([amount]);
    expect(result).toEqual({ status: "ready", values: [Number(amount)] });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.status === "ready")
      expect(Object.isFrozen(result.values)).toBe(true);
  });

  it.each([
    "9007199254740992",
    "-9007199254740992",
    "9007199254740991.1",
    "-9007199254740991.1",
    "9".repeat(64),
    `0.${"0".repeat(400)}1`,
    `-0.${"0".repeat(400)}1`,
  ])("withholds the entire plot for %s without dropping a period", (amount) => {
    const amounts = Object.freeze(["12", amount, "0"]);
    expect(projectManagedAnnualAmountPlot(amounts)).toEqual({
      status: "unavailable",
      reason: "unsafe_plot_value",
    });
    expect(amounts).toEqual(["12", amount, "0"]);
  });
});
