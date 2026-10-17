import Decimal from "decimal.js";
import {
  calculateDcfEnterpriseValue,
  DcfCalculationDecimal,
} from "./dcf-calculation";
import {
  PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS,
  PERSONAL_FCFF_DCF_ROUNDING,
  PERSONAL_FCFF_DCF_SCENARIOS,
  PERSONAL_FCFF_DCF_SENSITIVITY_TERMINAL_GROWTH_DELTAS,
  PERSONAL_FCFF_DCF_SENSITIVITY_WACC_DELTAS,
} from "./personal-fcff-dcf-valuation";

export type AuthoredValuationScenario = "conservative" | "base" | "expansion";
export interface AuthoredCashFlowDcfInput {
  readonly startingUnleveredCashFlowUsd: string;
  /** Positive bridge is subtracted from enterprise value; negative bridge adds cash. */
  readonly enterpriseToEquityBridgeUsd: string;
  readonly dilutedShares: string;
  readonly forecastYears: number;
  readonly waccPercent: string;
  readonly terminalGrowthPercent: string;
  readonly scenarios: Readonly<
    Record<
      AuthoredValuationScenario,
      Readonly<{ annualCashFlowGrowthPercent: string }>
    >
  >;
}
export interface AuthoredCashFlowDcfScenarioBase {
  readonly scenario: AuthoredValuationScenario;
  readonly annualCashFlowGrowthPercent: string;
  readonly enterpriseValueUsd: string;
  readonly equityValueUsd: string;
  readonly presentValueOfExplicitCashFlowUsd: string;
  readonly presentValueOfTerminalValueUsd: string;
  readonly terminalValueUsd: string;
  readonly terminalValuePercentOfEnterpriseValue: string;
  readonly projection: readonly Readonly<{
    year: number;
    cashFlowUsd: string;
    presentValueUsd: string;
  }>[];
}
export type AuthoredCashFlowDcfScenarioResult =
  AuthoredCashFlowDcfScenarioBase &
    (
      | Readonly<{ status: "available"; valuePerShareUsd: string }>
      | Readonly<{ status: "unavailable"; reason: "nonpositive_equity_value" }>
    );
export type AuthoredCashFlowDcfSensitivityCell = Readonly<{
  waccPercent: string;
  terminalGrowthPercent: string;
}> &
  (
    | Readonly<{
        status: "available";
        valuePerShareUsd: string;
        enterpriseValueUsd: string;
        equityValueUsd: string;
      }>
    | Readonly<{
        status: "unavailable";
        reason:
          | "sensitivity_rate_out_of_bounds"
          | "discount_rate_not_above_terminal_growth";
      }>
    | Readonly<{
        status: "unavailable";
        reason: "nonpositive_equity_value";
        enterpriseValueUsd: string;
        equityValueUsd: string;
      }>
  );
export type AuthoredCashFlowDcfUnavailableReason =
  | "invalid_input"
  | "starting_cash_flow_nonpositive"
  | "shares_nonpositive"
  | "wacc_out_of_bounds"
  | "terminal_growth_out_of_bounds"
  | "forecast_years_out_of_bounds"
  | "scenario_growth_out_of_bounds"
  | "scenario_growth_not_ordered"
  | "discount_rate_not_above_terminal_growth";
export const AUTHORED_DCF_BOUNDS = Object.freeze({
  maximumDecimalLength: 64,
  maximumAbsoluteOperand: "1000000000000000000000000000000",
  maximumFractionalDigits: 18,
  maximumRateFractionalDigits: 4,
  forecastYears: PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS.forecastYears,
  annualCashFlowGrowthPercent:
    PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS.annualFcfProxyGrowthPercent,
  waccPercent: PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS.waccPercent,
  terminalGrowthPercent:
    PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS.terminalGrowthPercent,
});
export const AUTHORED_DCF_METHODOLOGY = freeze({
  cashFlowBasis:
    "authored_starting_unlevered_cash_flow_assumption_not_reported_fcff",
  bridgeConvention: "equity_value_equals_enterprise_value_minus_signed_bridge",
  discountConvention: "year_end",
  shareBasis: "authored_positive_diluted_shares",
  units: {
    cashFlow: "USD",
    enterpriseValue: "USD",
    equityValue: "USD",
    dilutedShares: "shares",
    rates: "percent",
    valuePerShare: "USD/share",
  },
  formulas: {
    cashFlow: "starting_unlevered_cash_flow * (1 + annual_growth_rate) ^ year",
    presentValue: "cash_flow / (1 + wacc) ^ year",
    terminalValue:
      "final_cash_flow * (1 + terminal_growth_rate) / (wacc - terminal_growth_rate)",
    enterpriseValue:
      "sum(explicit_present_values) + terminal_value / (1 + wacc) ^ forecast_years",
    equityValue: "enterprise_value - signed_enterprise_to_equity_bridge",
    valuePerShare: "equity_value / diluted_shares",
  },
  bounds: AUTHORED_DCF_BOUNDS,
  rounding: PERSONAL_FCFF_DCF_ROUNDING,
  decisionUse: "authored_scenario_context_not_a_recommendation",
});
interface AuthoredDcfResultBase {
  readonly schemaVersion: "1.0.0";
  readonly modelVersion: "authored-cash-flow-dcf-v1";
  readonly methodology: typeof AUTHORED_DCF_METHODOLOGY;
}
export type AuthoredCashFlowDcfResult = AuthoredDcfResultBase &
  (
    | Readonly<{
        status: "unavailable";
        reason: AuthoredCashFlowDcfUnavailableReason;
      }>
    | Readonly<{
        status: "available";
        inputs: AuthoredCashFlowDcfInput;
        scenarios: Readonly<
          Record<AuthoredValuationScenario, AuthoredCashFlowDcfScenarioResult>
        >;
        sensitivity: Readonly<{
          scenario: "base";
          waccDeltasPercentagePoints: readonly string[];
          terminalGrowthDeltasPercentagePoints: readonly string[];
          cells: readonly AuthoredCashFlowDcfSensitivityCell[];
        }>;
      }>
  );
const RESULT_BASE = {
  schemaVersion: "1.0.0",
  modelVersion: "authored-cash-flow-dcf-v1",
  methodology: AUTHORED_DCF_METHODOLOGY,
} as const;

export function calculateAuthoredCashFlowDcf(
  raw: unknown,
): AuthoredCashFlowDcfResult {
  let input: AuthoredCashFlowDcfInput;
  try {
    input = admit(raw);
  } catch {
    return freeze({
      ...RESULT_BASE,
      status: "unavailable",
      reason: "invalid_input",
    });
  }
  const unavailable = (
    reason: AuthoredCashFlowDcfUnavailableReason,
  ): AuthoredCashFlowDcfResult =>
    freeze({ ...RESULT_BASE, status: "unavailable", reason });
  const start = decimal(input.startingUnleveredCashFlowUsd);
  const bridge = decimal(input.enterpriseToEquityBridgeUsd);
  const shares = decimal(input.dilutedShares);
  const wacc = decimal(input.waccPercent).div(100);
  const terminal = decimal(input.terminalGrowthPercent).div(100);
  if (!start.gt(0)) return unavailable("starting_cash_flow_nonpositive");
  if (!shares.gt(0)) return unavailable("shares_nonpositive");
  if (!within(input.waccPercent, AUTHORED_DCF_BOUNDS.waccPercent))
    return unavailable("wacc_out_of_bounds");
  if (
    !within(
      input.terminalGrowthPercent,
      AUTHORED_DCF_BOUNDS.terminalGrowthPercent,
    )
  )
    return unavailable("terminal_growth_out_of_bounds");
  if (input.forecastYears < 5 || input.forecastYears > 10)
    return unavailable("forecast_years_out_of_bounds");
  const growth = Object.fromEntries(
    PERSONAL_FCFF_DCF_SCENARIOS.map((s) => [
      s,
      decimal(input.scenarios[s].annualCashFlowGrowthPercent),
    ]),
  ) as Record<AuthoredValuationScenario, Decimal>;
  if (
    PERSONAL_FCFF_DCF_SCENARIOS.some(
      (s) =>
        !within(
          input.scenarios[s].annualCashFlowGrowthPercent,
          AUTHORED_DCF_BOUNDS.annualCashFlowGrowthPercent,
        ),
    )
  )
    return unavailable("scenario_growth_out_of_bounds");
  if (growth.conservative.gt(growth.base) || growth.base.gt(growth.expansion))
    return unavailable("scenario_growth_not_ordered");
  if (wacc.lte(terminal))
    return unavailable("discount_rate_not_above_terminal_growth");
  const scenario = (
    s: AuthoredValuationScenario,
    discount: Decimal,
    terminalGrowth: Decimal,
  ): AuthoredCashFlowDcfScenarioResult => {
    const calculation = calculateDcfEnterpriseValue(
      start,
      growth[s].div(100),
      discount,
      terminalGrowth,
      input.forecastYears,
    );
    const equity = calculation.enterpriseValue.minus(bridge);
    const base = {
      scenario: s,
      annualCashFlowGrowthPercent: rounded(growth[s], 4),
      enterpriseValueUsd: rounded(calculation.enterpriseValue),
      equityValueUsd: rounded(equity),
      presentValueOfExplicitCashFlowUsd: rounded(
        calculation.explicitPresentValue,
      ),
      presentValueOfTerminalValueUsd: rounded(calculation.terminalPresentValue),
      terminalValueUsd: rounded(calculation.terminalValue),
      terminalValuePercentOfEnterpriseValue: rounded(
        calculation.terminalPresentValue
          .div(calculation.enterpriseValue)
          .mul(100),
      ),
      projection: calculation.projection.map((p) => ({
        year: p.year,
        cashFlowUsd: rounded(p.fcff),
        presentValueUsd: rounded(p.presentValue),
      })),
    };
    return equity.gt(0)
      ? {
          ...base,
          status: "available",
          valuePerShareUsd: rounded(equity.div(shares)),
        }
      : { ...base, status: "unavailable", reason: "nonpositive_equity_value" };
  };
  const scenarios = Object.fromEntries(
    PERSONAL_FCFF_DCF_SCENARIOS.map((s) => [s, scenario(s, wacc, terminal)]),
  ) as Record<AuthoredValuationScenario, AuthoredCashFlowDcfScenarioResult>;
  const cells = PERSONAL_FCFF_DCF_SENSITIVITY_WACC_DELTAS.flatMap((w) =>
    PERSONAL_FCFF_DCF_SENSITIVITY_TERMINAL_GROWTH_DELTAS.map(
      (t): AuthoredCashFlowDcfSensitivityCell => {
        const discount = wacc.plus(decimal(w).div(100));
        const terminalGrowth = terminal.plus(decimal(t).div(100));
        const base = {
          waccPercent: rounded(discount.mul(100), 4),
          terminalGrowthPercent: rounded(terminalGrowth.mul(100), 4),
        };
        if (
          !within(base.waccPercent, AUTHORED_DCF_BOUNDS.waccPercent) ||
          !within(
            base.terminalGrowthPercent,
            AUTHORED_DCF_BOUNDS.terminalGrowthPercent,
          )
        )
          return {
            ...base,
            status: "unavailable",
            reason: "sensitivity_rate_out_of_bounds",
          };
        if (discount.lte(terminalGrowth))
          return {
            ...base,
            status: "unavailable",
            reason: "discount_rate_not_above_terminal_growth",
          };
        const result = scenario("base", discount, terminalGrowth);
        const values = {
          enterpriseValueUsd: result.enterpriseValueUsd,
          equityValueUsd: result.equityValueUsd,
        };
        return result.status === "available"
          ? {
              ...base,
              ...values,
              status: "available",
              valuePerShareUsd: result.valuePerShareUsd,
            }
          : {
              ...base,
              ...values,
              status: "unavailable",
              reason: result.reason,
            };
      },
    ),
  );
  return freeze({
    ...RESULT_BASE,
    status: "available",
    inputs: input,
    scenarios,
    sensitivity: {
      scenario: "base",
      waccDeltasPercentagePoints: PERSONAL_FCFF_DCF_SENSITIVITY_WACC_DELTAS,
      terminalGrowthDeltasPercentagePoints:
        PERSONAL_FCFF_DCF_SENSITIVITY_TERMINAL_GROWTH_DELTAS,
      cells,
    },
  });
}

export function calculateAuthoredPriceComparison(
  valuePerShareUsd: unknown,
  referencePriceUsd: unknown,
):
  | Readonly<{ status: "available"; differencePercent: string }>
  | Readonly<{
      status: "unavailable";
      reason: "price_comparison_input_invalid";
    }> {
  try {
    const value = decimal(lexeme(valuePerShareUsd));
    const price = decimal(lexeme(referencePriceUsd));
    if (!value.gt(0) || !price.gt(0)) throw new TypeError();
    return freeze({
      status: "available",
      differencePercent: rounded(value.div(price).minus(1).mul(100)),
    });
  } catch {
    return freeze({
      status: "unavailable",
      reason: "price_comparison_input_invalid",
    });
  }
}
function admit(raw: unknown): AuthoredCashFlowDcfInput {
  const input = record(raw, [
    "startingUnleveredCashFlowUsd",
    "enterpriseToEquityBridgeUsd",
    "dilutedShares",
    "forecastYears",
    "waccPercent",
    "terminalGrowthPercent",
    "scenarios",
  ]);
  if (
    typeof input.forecastYears !== "number" ||
    !Number.isSafeInteger(input.forecastYears)
  )
    throw new TypeError();
  const scenarios = record(input.scenarios, PERSONAL_FCFF_DCF_SCENARIOS);
  const admitted = Object.fromEntries(
    PERSONAL_FCFF_DCF_SCENARIOS.map((s) => {
      const item = record(scenarios[s], ["annualCashFlowGrowthPercent"]);
      return [
        s,
        {
          annualCashFlowGrowthPercent: lexeme(
            item.annualCashFlowGrowthPercent,
            4,
          ),
        },
      ];
    }),
  ) as AuthoredCashFlowDcfInput["scenarios"];
  return {
    startingUnleveredCashFlowUsd: lexeme(input.startingUnleveredCashFlowUsd),
    enterpriseToEquityBridgeUsd: lexeme(input.enterpriseToEquityBridgeUsd),
    dilutedShares: lexeme(input.dilutedShares),
    forecastYears: input.forecastYears,
    waccPercent: lexeme(input.waccPercent, 4),
    terminalGrowthPercent: lexeme(input.terminalGrowthPercent, 4),
    scenarios: admitted,
  };
}
function record(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(value, k))
  )
    throw new TypeError();
  return value as Record<string, unknown>;
}
function lexeme(value: unknown, fractionalDigits = 18): string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value) ||
    (value.split(".")[1]?.length ?? 0) > fractionalDigits
  )
    throw new TypeError();
  const parsed = decimal(value);
  if (
    !parsed.isFinite() ||
    parsed.abs().gt(AUTHORED_DCF_BOUNDS.maximumAbsoluteOperand)
  )
    throw new TypeError();
  return value;
}
function decimal(value: string): Decimal {
  return new DcfCalculationDecimal(value);
}
function within(
  value: string,
  bounds: Readonly<{ minimum: string; maximum: string }>,
): boolean {
  const d = decimal(value);
  return d.gte(bounds.minimum) && d.lte(bounds.maximum);
}
function rounded(value: Decimal, places = 2): string {
  const d = value.toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  return (d.isZero() ? decimal("0") : d).toFixed(places);
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
