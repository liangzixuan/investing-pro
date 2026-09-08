import { describe, expect, it } from "vitest";

import {
  PERSONAL_FINANCIAL_ANALYTICS_FORMULAS,
  PERSONAL_FINANCIAL_ANALYTICS_GROWTH_KEYS,
  PERSONAL_FINANCIAL_ANALYTICS_METRIC_KEYS,
  PERSONAL_FINANCIAL_ANALYTICS_ROUNDING,
  buildPersonalFinancialAnalytics,
  type PersonalFinancialAnalyticsAnnualPeriodInput,
  type PersonalFinancialAnalyticsFactInput,
  type PersonalFinancialAnalyticsFactKey,
  type PersonalFinancialAnalyticsInput,
  type PersonalFinancialAnalyticsReadyResult,
} from "./index";

describe("personal financial analytics", () => {
  it("builds three statements, eight exact metrics per annual period, and latest YoY growth", () => {
    const result = ready(
      buildPersonalFinancialAnalytics(
        input([
          annual(2025, {
            revenue: "1000",
            gross_profit: "400",
            operating_income: "150",
            net_income: "100",
            operating_cash_flow: "200",
            free_cash_flow: "120",
            assets: "800",
            cash: "100",
            debt: "250",
          }),
          annual(2024, {
            revenue: "800",
            gross_profit: "320",
            operating_income: "120",
            net_income: "80",
            operating_cash_flow: "160",
            free_cash_flow: "100",
            assets: "700",
            cash: "90",
            debt: "220",
          }),
        ]),
      ),
    );

    expect(result.periods).toHaveLength(2);
    expect(
      result.periods[0]!.statements.income.lineItems.map(
        (line) => line.factKey,
      ),
    ).toEqual(["revenue", "gross_profit", "operating_income", "net_income"]);
    expect(
      result.periods[0]!.statements.balanceSheet.lineItems.map(
        (line) => line.factKey,
      ),
    ).toEqual(["assets", "cash", "debt"]);
    expect(
      result.periods[0]!.statements.cashFlow.lineItems.map(
        (line) => line.factKey,
      ),
    ).toEqual(["operating_cash_flow", "free_cash_flow"]);
    expect(Object.keys(result.periods[0]!.metrics)).toEqual(
      PERSONAL_FINANCIAL_ANALYTICS_METRIC_KEYS,
    );
    expect(metricValues(result, 0)).toEqual({
      grossMargin: "40.00",
      operatingMargin: "15.00",
      netMargin: "10.00",
      operatingCashFlowMargin: "20.00",
      freeCashFlowMargin: "12.00",
      netDebt: "150.00",
      debtToAssets: "31.25",
      cashToAssets: "12.50",
    });
    expect(Object.keys(result.growth)).toEqual(
      PERSONAL_FINANCIAL_ANALYTICS_GROWTH_KEYS,
    );
    expect(result.growth.revenue).toMatchObject({
      fromFiscalYear: 2024,
      status: "available",
      toFiscalYear: 2025,
      value: "25.00",
    });
    expect(result.growth.netIncome).toMatchObject({
      status: "available",
      value: "25.00",
    });
    expect(result.growth.freeCashFlow).toMatchObject({
      status: "available",
      value: "20.00",
    });
    expect(result.growth.revenue.inputRefs).toEqual([
      { factKey: "revenue", sourceRef: "filing-2025-revenue" },
      { factKey: "revenue", sourceRef: "filing-2024-revenue" },
    ]);
  });

  it("uses decimal half-up rounding, supports negative values, and normalizes negative zero", () => {
    const period = annual(2025, {
      revenue: "6",
      gross_profit: "1",
      operating_income: "-1",
      net_income: "-0",
      operating_cash_flow: "1",
      free_cash_flow: "-1",
      assets: "6",
      cash: "0",
      debt: "-0",
    });
    const result = ready(buildPersonalFinancialAnalytics(input([period])));
    expect(result.periods[0]!.metrics.grossMargin).toMatchObject({
      status: "available",
      value: "16.67",
    });
    expect(result.periods[0]!.metrics.operatingMargin).toMatchObject({
      status: "available",
      value: "-16.67",
    });
    expect(result.periods[0]!.metrics.netDebt).toMatchObject({
      status: "available",
      value: "0.00",
    });
    expect(result.periods[0]!.statements.income.lineItems[3]).toMatchObject({
      status: "available",
      value: "0",
    });
    expect(PERSONAL_FINANCIAL_ANALYTICS_ROUNDING).toEqual({
      decimalPlaces: 2,
      method: "round_half_up",
      negativeZero: "normalize_to_positive_zero",
    });
  });

  it("retains enough precision for every accepted 64-character fixed decimal", () => {
    const result = ready(
      buildPersonalFinancialAnalytics(
        input([
          annual(2025, {
            ...fullValues(),
            gross_profit: "9".repeat(64),
            revenue: "0.000000000000000000007",
          }),
        ]),
      ),
    );

    expect(result.periods[0]?.metrics.grossMargin).toMatchObject({
      status: "available",
      value:
        "142857142857142857142857142857142857142857142857142857142857142842857142857142857142857.14",
    });
  });

  it("reports missing inputs and never substitutes another field", () => {
    const period = annual(2025, {
      revenue: "100",
      assets: "200",
      cash: "10",
      debt: "20",
    });
    const result = ready(buildPersonalFinancialAnalytics(input([period])));
    expect(result.periods[0]!.metrics.grossMargin).toMatchObject({
      inputRefs: [{ factKey: "revenue", sourceRef: "filing-2025-revenue" }],
      reason: "missing_input",
      status: "unavailable",
    });
    expect(result.periods[0]!.statements.cashFlow.lineItems[0]).toMatchObject({
      inputRefs: [],
      reason: "missing_input",
      status: "unavailable",
    });
  });

  it("marks duplicate same-year facts ambiguous and does not interpret them as restatements or growth", () => {
    const current = annual(2025, fullValues());
    const duplicated: PersonalFinancialAnalyticsAnnualPeriodInput = {
      ...current,
      facts: [
        ...current.facts,
        fact(2025, "revenue", "999", "restated-revenue"),
      ],
    };
    const result = ready(
      buildPersonalFinancialAnalytics(
        input([duplicated, annual(2024, fullValues())]),
      ),
    );
    expect(result.periods[0]!.statements.income.lineItems[0]).toMatchObject({
      reason: "ambiguous_fact",
      status: "unavailable",
    });
    expect(result.periods[0]!.metrics.grossMargin).toMatchObject({
      reason: "ambiguous_fact",
      status: "unavailable",
    });
    expect(result.growth.revenue).toMatchObject({
      reason: "ambiguous_fact",
      status: "unavailable",
    });
    expect(result.growth.revenue.inputRefs).toHaveLength(3);
  });

  it.each([
    ["invalid_decimal", { value: "NaN" }],
    ["invalid_decimal", { value: "Infinity" }],
    ["invalid_unit", { unit: "shares" }],
    ["invalid_source_ref", { sourceRef: "  " }],
  ] as const)(
    "makes a bad fact unavailable with reason %s",
    (reason, mutation) => {
      const period = annual(2025, fullValues());
      const facts = period.facts.map((candidate) =>
        candidate.key === "revenue" ? { ...candidate, ...mutation } : candidate,
      ) as PersonalFinancialAnalyticsFactInput[];
      const result = ready(
        buildPersonalFinancialAnalytics(input([{ ...period, facts }])),
      );
      expect(result.periods[0]!.metrics.grossMargin).toMatchObject({
        reason,
        status: "unavailable",
      });
      expect(result.periods[0]!.statements.income.lineItems[0]).toMatchObject({
        reason,
        status: "unavailable",
      });
    },
  );

  it("returns zero-denominator states for ratios and growth", () => {
    const result = ready(
      buildPersonalFinancialAnalytics(
        input([
          annual(2025, { ...fullValues(), revenue: "0", assets: "0" }),
          annual(2024, {
            ...fullValues(),
            revenue: "0",
            net_income: "0",
            free_cash_flow: "0",
          }),
        ]),
      ),
    );
    expect(result.periods[0]!.metrics.grossMargin).toMatchObject({
      reason: "zero_denominator",
      status: "unavailable",
    });
    expect(result.periods[0]!.metrics.debtToAssets).toMatchObject({
      reason: "zero_denominator",
      status: "unavailable",
    });
    for (const growth of Object.values(result.growth))
      expect(growth).toMatchObject({
        reason: "zero_denominator",
        status: "unavailable",
      });
  });

  it.each([
    ["narrows a loss", "-50"],
    ["crosses from loss to profit", "50"],
  ] as const)(
    "marks growth not meaningful when the prior value is negative and the current year %s",
    (_scenario, currentValue) => {
      const result = ready(
        buildPersonalFinancialAnalytics(
          input([
            annual(2025, {
              ...fullValues(),
              net_income: currentValue,
              free_cash_flow: currentValue,
            }),
            annual(2024, {
              ...fullValues(),
              net_income: "-100",
              free_cash_flow: "-100",
            }),
          ]),
        ),
      );

      for (const growth of [
        result.growth.netIncome,
        result.growth.freeCashFlow,
      ]) {
        expect(growth).toMatchObject({
          fromFiscalYear: 2024,
          reason: "nonpositive_prior",
          status: "unavailable",
          toFiscalYear: 2025,
        });
        expect(growth.inputRefs).toHaveLength(2);
      }
      expect(result.growth.revenue.status).toBe("available");
    },
  );

  it("requires two consecutive distinct fiscal years for growth", () => {
    const one = ready(
      buildPersonalFinancialAnalytics(input([annual(2025, fullValues())])),
    );
    expect(one.growth.revenue).toMatchObject({
      fromFiscalYear: null,
      reason: "insufficient_periods",
      status: "unavailable",
      toFiscalYear: 2025,
    });
    const gap = ready(
      buildPersonalFinancialAnalytics(
        input([annual(2025, fullValues()), annual(2023, fullValues())]),
      ),
    );
    expect(gap.growth.revenue).toMatchObject({
      fromFiscalYear: 2023,
      inputRefs: [],
      reason: "non_consecutive_fiscal_years",
      status: "unavailable",
      toFiscalYear: 2025,
    });
  });

  it("preserves formula identity, expression, units, year, and source references on every metric", () => {
    const result = ready(
      buildPersonalFinancialAnalytics(input([annual(2025, fullValues())])),
    );
    for (const [key, metric] of Object.entries(result.periods[0]!.metrics)) {
      expect(metric).toMatchObject({
        fiscalYear: 2025,
        formulaVersion: "1.0.0",
      });
      expect(metric.formulaId).toBe(
        PERSONAL_FINANCIAL_ANALYTICS_FORMULAS[
          key as keyof typeof PERSONAL_FINANCIAL_ANALYTICS_FORMULAS
        ].formulaId,
      );
      expect(metric.expression.length).toBeGreaterThan(0);
      expect(metric.inputRefs).toHaveLength(2);
      expect(["USD", "percent"]).toContain(metric.unit);
    }
  });
});

function input(
  periods: readonly PersonalFinancialAnalyticsAnnualPeriodInput[],
): PersonalFinancialAnalyticsInput {
  return { asOf: "2026-02-15T12:00:00.000Z", periods };
}
function annual(
  fiscalYear: number,
  values: Partial<Record<PersonalFinancialAnalyticsFactKey, string>>,
): PersonalFinancialAnalyticsAnnualPeriodInput {
  return {
    facts: Object.entries(values).map(([key, value]) =>
      fact(fiscalYear, key as PersonalFinancialAnalyticsFactKey, value),
    ),
    fiscalYear,
    statementDate: `${fiscalYear + 1}-02-15`,
  };
}
function fact(
  fiscalYear: number,
  key: PersonalFinancialAnalyticsFactKey,
  value: string,
  suffix: string = key,
): PersonalFinancialAnalyticsFactInput {
  return {
    key,
    sourceRef: `filing-${fiscalYear}-${suffix}`,
    unit: "USD",
    value,
  };
}
function fullValues(): Record<PersonalFinancialAnalyticsFactKey, string> {
  return {
    assets: "800",
    cash: "100",
    debt: "250",
    free_cash_flow: "120",
    gross_profit: "400",
    net_income: "100",
    operating_cash_flow: "200",
    operating_income: "150",
    revenue: "1000",
  };
}
function ready(
  result: ReturnType<typeof buildPersonalFinancialAnalytics>,
): PersonalFinancialAnalyticsReadyResult {
  expect(result.status).toBe("ready");
  if (result.status !== "ready") throw new Error("expected ready result");
  return result;
}
function metricValues(
  result: PersonalFinancialAnalyticsReadyResult,
  index: number,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(result.periods[index]!.metrics).map(([key, metric]) => [
      key,
      metric.status === "available" ? metric.value : metric.reason,
    ]),
  );
}
