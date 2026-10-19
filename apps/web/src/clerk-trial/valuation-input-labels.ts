import type {
  DcfField,
  ExitField,
  ExitScenarioField,
} from "./managed-valuation-workbench";
export const dcfFields: readonly (readonly [DcfField, string])[] = [
  ["startingUnleveredCashFlowUsd", "Starting unlevered cash flow (full USD)"],
  [
    "enterpriseToEquityBridgeUsd",
    "Enterprise-to-equity bridge (signed full USD)",
  ],
  ["dilutedShares", "Diluted shares (share count)"],
  ["forecastYears", "Forecast years (whole number, 5–10)"],
  ["waccPercent", "WACC (%)"],
  ["terminalGrowthPercent", "Terminal growth (%)"],
];
export const exitFields: readonly (readonly [ExitField, string])[] = [
  ["baseRevenue", "Starting revenue (full USD)"],
  ["cash", "Cash (full USD)"],
  ["debt", "Debt (full USD)"],
  ["dilutedShares", "Diluted shares (share count)"],
  ["horizonYears", "Horizon years (whole number, 1–10)"],
  ["discountRatePercent", "Discount rate (%)"],
];
export const exitScenarioFields: readonly (readonly [
  ExitScenarioField,
  string,
])[] = [
  ["annualRevenueGrowthPercent", "Annual revenue growth (%)"],
  ["targetEbitdaMarginPercent", "Target EBITDA margin (%)"],
  ["exitMultiple", "Exit EBITDA multiple (times)"],
];
