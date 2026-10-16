import Decimal from "decimal.js";

// Isolated precision is shared by the authored and provider adapters.
export const DcfCalculationDecimal = Decimal.clone({
  defaults: true,
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
});
const CalculationDecimal = DcfCalculationDecimal;

export interface DcfEnterpriseCalculation {
  readonly enterpriseValue: Decimal;
  readonly explicitPresentValue: Decimal;
  readonly projection: readonly Readonly<{
    fcff: Decimal;
    presentValue: Decimal;
    year: number;
  }>[];
  readonly terminalPresentValue: Decimal;
  readonly terminalValue: Decimal;
}

export function calculateDcfEnterpriseValue(
  startingUnleveredFcfProxy: Decimal,
  growth: Decimal,
  wacc: Decimal,
  terminalGrowth: Decimal,
  forecastYears: number,
): DcfEnterpriseCalculation {
  const one = new CalculationDecimal(1);
  const growthFactor = one.plus(growth);
  const discountFactor = one.plus(wacc);
  const projection = Array.from({ length: forecastYears }, (_, index) => {
    const year = index + 1;
    const fcff = startingUnleveredFcfProxy.mul(growthFactor.pow(year));
    return {
      fcff,
      presentValue: fcff.div(discountFactor.pow(year)),
      year,
    };
  });
  const explicitPresentValue = projection.reduce(
    (total, period) => total.plus(period.presentValue),
    new CalculationDecimal(0),
  );
  const finalFcff = projection.at(-1)?.fcff;
  if (finalFcff === undefined) throw new TypeError();
  const terminalValue = finalFcff
    .mul(one.plus(terminalGrowth))
    .div(wacc.minus(terminalGrowth));
  const terminalPresentValue = terminalValue.div(
    discountFactor.pow(forecastYears),
  );
  return {
    enterpriseValue: explicitPresentValue.plus(terminalPresentValue),
    explicitPresentValue,
    projection,
    terminalPresentValue,
    terminalValue,
  };
}
