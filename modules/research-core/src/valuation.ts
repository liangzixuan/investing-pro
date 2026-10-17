import type {
  ValuationInputDto,
  ValuationResultDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";

export const VALUATION_ARITHMETIC = Object.freeze({
  calculationPrecision: 256,
  maximumDecimalLength: 64,
  maximumFractionalDigits: 18,
  maximumAbsoluteOperand: "1000000000000000000000000000000",
  moneyDecimalPlaces: 3,
  valuePerShareDecimalPlaces: 2,
  rounding: "round_half_up",
});
const CalculationDecimal = Decimal.clone({
  defaults: true,
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
});

export function calculateValuation(
  input: ValuationInputDto,
): ValuationResultDto {
  return calculateValuationCalculation(input).result;
}

function calculateValuationCalculation(
  input: ValuationInputDto,
): Readonly<{ result: ValuationResultDto; equityPositive: boolean }> {
  if (
    !Number.isInteger(input.horizonYears) ||
    input.horizonYears < 1 ||
    input.horizonYears > 10
  ) {
    throw new RangeError("horizonYears must be an integer between 1 and 10");
  }

  const baseRevenue = positive(input.baseRevenue, "baseRevenue");
  const cash = nonNegative(input.cash, "cash");
  const debt = nonNegative(input.debt, "debt");
  const shares = positive(input.dilutedShares, "dilutedShares");
  const growth = boundedPercent(
    input.annualRevenueGrowthPercent,
    "annualRevenueGrowthPercent",
    -50,
    100,
  );
  const margin = boundedPercent(
    input.targetEbitdaMarginPercent,
    "targetEbitdaMarginPercent",
    -20,
    80,
  );
  const discount = boundedPercent(
    input.discountRatePercent,
    "discountRatePercent",
    0.1,
    80,
  );
  const exitMultiple = positive(input.exitMultiple, "exitMultiple");

  const growthFactor = growth.div(100).plus(1).pow(input.horizonYears);
  const discountFactor = discount.div(100).plus(1).pow(input.horizonYears);
  const yearNRevenue = baseRevenue.mul(growthFactor);
  const yearNEbitda = yearNRevenue.mul(margin.div(100));
  const terminalEnterpriseValue = yearNEbitda.mul(exitMultiple);
  const presentEnterpriseValue = terminalEnterpriseValue.div(discountFactor);
  const equityValue = presentEnterpriseValue.plus(cash).minus(debt);
  const valuePerShare = equityValue.div(shares);

  return {
    equityPositive: equityValue.gt(0),
    result: {
      schemaVersion: "1.0.0",
      modelVersion: "exit-multiple-v1",
      yearNRevenue: canonical(yearNRevenue, 3),
      yearNEbitda: canonical(yearNEbitda, 3),
      terminalEnterpriseValue: canonical(terminalEnterpriseValue, 3),
      presentEnterpriseValue: canonical(presentEnterpriseValue, 3),
      equityValue: canonical(equityValue, 3),
      valuePerShare: canonical(valuePerShare, 2),
      formulaTrace: [
        `Year ${input.horizonYears} revenue = ${baseRevenue.toFixed()} × (1 + ${growth.toFixed()}%)^${input.horizonYears}`,
        `Year ${input.horizonYears} EBITDA = year ${input.horizonYears} revenue × ${margin.toFixed()}%`,
        `Terminal enterprise value = year ${input.horizonYears} EBITDA × ${exitMultiple.toFixed()}×`,
        `Present enterprise value = terminal enterprise value ÷ (1 + ${discount.toFixed()}%)^${input.horizonYears}`,
        `Equity value = present enterprise value + ${cash.toFixed()} cash − ${debt.toFixed()} debt`,
        `Value per share = equity value ÷ ${shares.toFixed()} diluted shares`,
      ],
    },
  };
}

function positive(value: string, field: string): Decimal {
  const decimal = parse(value, field);
  if (!decimal.gt(0)) throw new RangeError(`${field} must be positive`);
  return decimal;
}

function nonNegative(value: string, field: string): Decimal {
  const decimal = parse(value, field);
  if (decimal.isNegative())
    throw new RangeError(`${field} must not be negative`);
  return decimal;
}

function boundedPercent(
  value: string,
  field: string,
  minimum: number,
  maximum: number,
): Decimal {
  const decimal = parse(value, field);
  if (decimal.lt(minimum) || decimal.gt(maximum)) {
    throw new RangeError(`${field} must be between ${minimum} and ${maximum}`);
  }
  return decimal;
}

function parse(value: string, field: string): Decimal {
  try {
    if (
      typeof value !== "string" ||
      value.length > VALUATION_ARITHMETIC.maximumDecimalLength ||
      !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value) ||
      (value.split(".")[1]?.length ?? 0) >
        VALUATION_ARITHMETIC.maximumFractionalDigits
    )
      throw new TypeError();
    const parsed = new CalculationDecimal(value);
    if (
      !parsed.isFinite() ||
      parsed.abs().gt(VALUATION_ARITHMETIC.maximumAbsoluteOperand)
    )
      throw new TypeError();
    return parsed;
  } catch {
    throw new RangeError(`${field} must be a decimal string`);
  }
}

function canonical(value: Decimal, decimals: number): string {
  const rounded = value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  return (rounded.isZero() ? new CalculationDecimal(0) : rounded).toFixed(
    decimals,
  );
}

type Scenario = "conservative" | "base" | "expansion";
const SCENARIOS = ["conservative", "base", "expansion"] as const;
const DELTAS = ["-2", "-1", "0", "1", "2"] as const;
export interface AuthoredExitMultipleScenarioInput {
  readonly annualRevenueGrowthPercent: string;
  readonly targetEbitdaMarginPercent: string;
  readonly exitMultiple: string;
}
export interface AuthoredExitMultipleInput {
  readonly baseRevenue: string;
  readonly cash: string;
  readonly debt: string;
  readonly dilutedShares: string;
  readonly horizonYears: number;
  readonly discountRatePercent: string;
  readonly scenarios: Readonly<
    Record<Scenario, AuthoredExitMultipleScenarioInput>
  >;
}
export type AuthoredExitMultipleScenarioResult = Readonly<ValuationResultDto> &
  Readonly<{ scenario: Scenario; inputs: Readonly<ValuationInputDto> }> &
  (
    | Readonly<{ status: "available" }>
    | Readonly<{ status: "unavailable"; reason: "nonpositive_equity_value" }>
  );
export type AuthoredExitMultipleSensitivityCell = Readonly<{
  discountRatePercent: string;
  exitMultiple: string;
}> &
  (
    | Readonly<{
        status: "unavailable";
        reason: "sensitivity_input_out_of_bounds";
      }>
    | Readonly<{
        status: "available";
        result: AuthoredExitMultipleScenarioResult;
      }>
    | Readonly<{
        status: "unavailable";
        reason: "nonpositive_equity_value";
        result: AuthoredExitMultipleScenarioResult;
      }>
  );
export const AUTHORED_EXIT_MULTIPLE_BOUNDS = freeze({
  ...VALUATION_ARITHMETIC,
  horizonYears: { minimum: 1, maximum: 10 },
  annualRevenueGrowthPercent: { minimum: "-50", maximum: "100" },
  targetEbitdaMarginPercent: { minimum: "-20", maximum: "80" },
  discountRatePercent: { minimum: "0.1", maximum: "80" },
  maximumRateFractionalDigits: 4,
  exitMultiple: {
    minimumExclusive: "0",
    maximum: VALUATION_ARITHMETIC.maximumAbsoluteOperand,
  },
});
export const AUTHORED_EXIT_MULTIPLE_METHODOLOGY = freeze({
  engine: "exit-multiple-v1",
  basis:
    "authored_revenue_growth_margin_exit_multiple_cash_debt_and_diluted_shares",
  discountConvention: "year_end_terminal_enterprise_value_only",
  units: {
    baseRevenue: "USD",
    cash: "USD",
    debt: "USD",
    dilutedShares: "shares",
    annualRevenueGrowthPercent: "percent",
    targetEbitdaMarginPercent: "percent",
    discountRatePercent: "percent",
    exitMultiple: "times",
    horizonYears: "years",
    values: "USD",
    valuePerShare: "USD/share",
  },
  bounds: AUTHORED_EXIT_MULTIPLE_BOUNDS,
  decisionUse: "authored_scenario_context_not_a_recommendation",
});
const RESULT_BASE = {
  schemaVersion: "1.0.0",
  modelVersion: "authored-exit-multiple-v1",
  methodology: AUTHORED_EXIT_MULTIPLE_METHODOLOGY,
} as const;
export type AuthoredExitMultipleResult = typeof RESULT_BASE &
  (
    | Readonly<{ status: "unavailable"; reason: "invalid_input" }>
    | Readonly<{
        status: "available";
        inputs: AuthoredExitMultipleInput;
        scenarios: Readonly<
          Record<Scenario, AuthoredExitMultipleScenarioResult>
        >;
        sensitivity: Readonly<{
          scenario: "base";
          discountRateDeltasPercentagePoints: readonly string[];
          exitMultipleDeltas: readonly string[];
          cells: readonly AuthoredExitMultipleSensitivityCell[];
        }>;
      }>
  );

export function calculateAuthoredExitMultiple(
  raw: unknown,
): AuthoredExitMultipleResult {
  let input: AuthoredExitMultipleInput;
  let scenarios: Record<Scenario, AuthoredExitMultipleScenarioResult>;
  try {
    input = admit(raw);
    scenarios = Object.fromEntries(
      SCENARIOS.map((s) => [s, run(input, s)]),
    ) as Record<Scenario, AuthoredExitMultipleScenarioResult>;
  } catch {
    return freeze({
      ...RESULT_BASE,
      status: "unavailable",
      reason: "invalid_input",
    });
  }
  const cells = DELTAS.flatMap((d) =>
    DELTAS.map((m): AuthoredExitMultipleSensitivityCell => {
      const discountRatePercent = new CalculationDecimal(
        input.discountRatePercent,
      )
        .plus(d)
        .toFixed();
      const exitMultiple = new CalculationDecimal(
        input.scenarios.base.exitMultiple,
      )
        .plus(m)
        .toFixed();
      const base = { discountRatePercent, exitMultiple };
      try {
        const result = run(input, "base", discountRatePercent, exitMultiple);
        return result.status === "available"
          ? { ...base, status: "available", result }
          : { ...base, status: "unavailable", reason: result.reason, result };
      } catch {
        return {
          ...base,
          status: "unavailable",
          reason: "sensitivity_input_out_of_bounds",
        };
      }
    }),
  );
  return freeze({
    ...RESULT_BASE,
    status: "available",
    inputs: input,
    scenarios,
    sensitivity: {
      scenario: "base",
      discountRateDeltasPercentagePoints: DELTAS,
      exitMultipleDeltas: DELTAS,
      cells,
    },
  });
}
function run(
  input: AuthoredExitMultipleInput,
  scenario: Scenario,
  discount = input.discountRatePercent,
  multiple = input.scenarios[scenario].exitMultiple,
): AuthoredExitMultipleScenarioResult {
  const inputs: ValuationInputDto = {
    baseRevenue: input.baseRevenue,
    cash: input.cash,
    debt: input.debt,
    dilutedShares: input.dilutedShares,
    horizonYears: input.horizonYears,
    discountRatePercent: discount,
    ...input.scenarios[scenario],
    exitMultiple: multiple,
  };
  const calculation = calculateValuationCalculation(inputs);
  const result = calculation.result;
  const available = calculation.equityPositive;
  return available
    ? { ...result, inputs, scenario, status: "available" }
    : {
        ...result,
        inputs,
        scenario,
        status: "unavailable",
        reason: "nonpositive_equity_value",
      };
}
function admit(raw: unknown): AuthoredExitMultipleInput {
  const input = record(raw, [
    "baseRevenue",
    "cash",
    "debt",
    "dilutedShares",
    "horizonYears",
    "discountRatePercent",
    "scenarios",
  ]);
  if (
    typeof input.horizonYears !== "number" ||
    !Number.isSafeInteger(input.horizonYears)
  )
    throw new TypeError();
  const scenarios = record(input.scenarios, SCENARIOS);
  const admitted = Object.fromEntries(
    SCENARIOS.map((s) => {
      const item = record(scenarios[s], [
        "annualRevenueGrowthPercent",
        "targetEbitdaMarginPercent",
        "exitMultiple",
      ]);
      return [
        s,
        {
          annualRevenueGrowthPercent: lexeme(
            item.annualRevenueGrowthPercent,
            4,
          ),
          targetEbitdaMarginPercent: lexeme(item.targetEbitdaMarginPercent, 4),
          exitMultiple: lexeme(item.exitMultiple),
        },
      ];
    }),
  ) as AuthoredExitMultipleInput["scenarios"];
  return {
    baseRevenue: lexeme(input.baseRevenue),
    cash: lexeme(input.cash),
    debt: lexeme(input.debt),
    dilutedShares: lexeme(input.dilutedShares),
    discountRatePercent: lexeme(input.discountRatePercent, 4),
    horizonYears: input.horizonYears,
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
function lexeme(value: unknown, fraction = 18): string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value) ||
    (value.split(".")[1]?.length ?? 0) > fraction
  )
    throw new TypeError();
  const d = new CalculationDecimal(value);
  if (!d.isFinite() || d.abs().gt(VALUATION_ARITHMETIC.maximumAbsoluteOperand))
    throw new TypeError();
  return value;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
