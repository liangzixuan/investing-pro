import type {
  ValuationInputDto,
  ValuationResultDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";

export function calculateValuation(
  input: ValuationInputDto,
): ValuationResultDto {
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
    schemaVersion: "1.0.0",
    modelVersion: "exit-multiple-v1",
    yearNRevenue: canonical(yearNRevenue, 3),
    yearNEbitda: canonical(yearNEbitda, 3),
    terminalEnterpriseValue: canonical(terminalEnterpriseValue, 3),
    presentEnterpriseValue: canonical(presentEnterpriseValue, 3),
    equityValue: canonical(equityValue, 3),
    valuePerShare: canonical(valuePerShare, 2),
    formulaTrace: [
      `Year ${input.horizonYears} revenue = ${baseRevenue.toFixed(3)} × (1 + ${growth.toFixed(2)}%)^${input.horizonYears}`,
      `Year ${input.horizonYears} EBITDA = year ${input.horizonYears} revenue × ${margin.toFixed(2)}%`,
      `Terminal enterprise value = year ${input.horizonYears} EBITDA × ${exitMultiple.toFixed(2)}×`,
      `Present enterprise value = terminal enterprise value ÷ (1 + ${discount.toFixed(2)}%)^${input.horizonYears}`,
      `Equity value = present enterprise value + ${cash.toFixed(3)} cash − ${debt.toFixed(3)} debt`,
      `Value per share = equity value ÷ ${shares.toFixed(3)} diluted shares`,
    ],
  };
}

function positive(value: string, field: string): Decimal {
  const decimal = parse(value, field);
  if (!decimal.isPositive()) throw new RangeError(`${field} must be positive`);
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
    return new Decimal(value);
  } catch {
    throw new RangeError(`${field} must be a decimal string`);
  }
}

function canonical(value: Decimal, decimals: number): string {
  return value
    .toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
    .toFixed(decimals);
}
