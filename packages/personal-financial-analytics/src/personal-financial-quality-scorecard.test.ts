import { describe, expect, it } from "vitest";

import {
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_CHECK_IDS,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULAS,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_GROUP_IDS,
  buildPersonalFinancialQualityScorecard,
  type PersonalFinancialQualityScorecardAnnualPeriodInput,
  type PersonalFinancialQualityScorecardCheck,
  type PersonalFinancialQualityScorecardFactInput,
  type PersonalFinancialQualityScorecardFactKey,
  type PersonalFinancialQualityScorecardInput,
  type PersonalFinancialQualityScorecardReadyResult,
} from "./index";

describe("personal financial quality scorecard", () => {
  it("evaluates the twelve transparent checks against a hand-calculated golden case", () => {
    const result = ready(
      buildPersonalFinancialQualityScorecard(
        input([annual(2025, currentGolden()), annual(2024, priorGolden())]),
      ),
    );

    expect(result.counts).toEqual({
      evaluated: 12,
      met: 12,
      notMet: 0,
      total: 12,
      unavailable: 0,
    });
    expect(result.groups.map((group) => group.groupId)).toEqual(
      PERSONAL_FINANCIAL_QUALITY_SCORECARD_GROUP_IDS,
    );
    expect(result.groups.map((group) => group.checks.length)).toEqual([
      4, 4, 4,
    ]);
    expect(allChecks(result).map((check) => check.checkId)).toEqual(
      PERSONAL_FINANCIAL_QUALITY_SCORECARD_CHECK_IDS,
    );
    expect(
      check(result, "operating_cash_flow_exceeds_net_income"),
    ).toMatchObject({
      currentObservation: {
        fiscalYear: 2025,
        inputRefs: [
          {
            factKey: "operating_cash_flow",
            sourceRef: "filing-2025-operating_cash_flow",
          },
          { factKey: "net_income", sourceRef: "filing-2025-net_income" },
        ],
        statementDate: "2026-02-15",
        unit: "USD",
        value: "50",
      },
      priorObservation: null,
      status: "met",
    });
    expect(check(result, "positive_revenue_growth")).toMatchObject({
      currentObservation: { fiscalYear: 2025, unit: "USD", value: "1000" },
      priorObservation: { fiscalYear: 2024, unit: "USD", value: "900" },
      status: "met",
    });
    expect(check(result, "gross_margin_not_declining")).toMatchObject({
      currentObservation: { unit: "ratio", value: "0.5" },
      priorObservation: { unit: "ratio", value: "0.5" },
      status: "met",
    });
    expect(check(result, "operating_margin_not_declining")).toMatchObject({
      currentObservation: { value: "0.2" },
      priorObservation: { value: "0.19" },
      status: "met",
    });
    expect(
      check(result, "revenue_to_ending_assets_not_declining"),
    ).toMatchObject({
      currentObservation: { value: "1" },
      priorObservation: { value: "1" },
      status: "met",
    });
    expect(check(result, "current_ratio_at_least_one")).toMatchObject({
      currentObservation: { value: "1.5" },
      status: "met",
    });
    expect(check(result, "current_ratio_not_declining")).toMatchObject({
      currentObservation: { value: "1.5" },
      priorObservation: { value: "1.2" },
      status: "met",
    });
    expect(check(result, "debt_to_assets_not_rising")).toMatchObject({
      currentObservation: { value: "0.2" },
      priorObservation: { value: "0.25" },
      status: "met",
    });
  });

  it("reports every evaluated false branch as not_met without turning it into a grade", () => {
    const result = ready(
      buildPersonalFinancialQualityScorecard(
        input([
          annual(2025, {
            assets: "1000",
            current_assets: "100",
            current_liabilities: "200",
            debt: "500",
            free_cash_flow: "0",
            gross_profit: "100",
            net_income: "0",
            operating_cash_flow: "0",
            operating_income: "50",
            revenue: "800",
            shareholders_equity: "0",
          }),
          annual(2024, {
            ...priorGolden(),
            current_assets: "200",
            current_liabilities: "200",
            debt: "180",
          }),
        ]),
      ),
    );

    expect(result.counts).toEqual({
      evaluated: 12,
      met: 0,
      notMet: 12,
      total: 12,
      unavailable: 0,
    });
    expect(allChecks(result).every((item) => item.status === "not_met")).toBe(
      true,
    );
    expect(result).not.toHaveProperty("grade");
    expect(result).not.toHaveProperty("rating");
    expect(result).not.toHaveProperty("score");
    expect(result).not.toHaveProperty("signal");
  });

  it("makes only checks that depend on a missing operand unavailable", () => {
    const current = annual(2025, currentGolden());
    const result = ready(
      buildPersonalFinancialQualityScorecard(
        input([
          {
            ...current,
            facts: current.facts.filter((fact) => fact.key !== "net_income"),
          },
          annual(2024, priorGolden()),
        ]),
      ),
    );

    expect(result.counts).toEqual({
      evaluated: 10,
      met: 10,
      notMet: 0,
      total: 12,
      unavailable: 2,
    });
    expect(check(result, "positive_net_income")).toMatchObject({
      reason: "missing_input",
      status: "unavailable",
    });
    expect(
      check(result, "operating_cash_flow_exceeds_net_income"),
    ).toMatchObject({ reason: "missing_input", status: "unavailable" });
    expect(check(result, "positive_operating_cash_flow").status).toBe("met");
    expect(check(result, "positive_revenue_growth").status).toBe("met");
  });

  it.each([
    ["invalid_decimal", { value: "NaN" }],
    ["invalid_unit", { unit: "shares" }],
    ["invalid_source_ref", { sourceRef: "  " }],
  ] as const)(
    "contains malformed fact data as a dependent-check %s state",
    (reason, mutation) => {
      const current = annual(2025, currentGolden());
      const facts = current.facts.map((candidate) =>
        candidate.key === "shareholders_equity"
          ? { ...candidate, ...mutation }
          : candidate,
      ) as PersonalFinancialQualityScorecardFactInput[];
      const result = ready(
        buildPersonalFinancialQualityScorecard(
          input([{ ...current, facts }, annual(2024, priorGolden())]),
        ),
      );

      expect(check(result, "positive_shareholders_equity")).toMatchObject({
        reason,
        status: "unavailable",
      });
      expect(result.counts.unavailable).toBe(1);
      expect(result.counts.evaluated).toBe(11);
    },
  );

  it("marks duplicate facts ambiguous only where that fact is required", () => {
    const current = annual(2025, currentGolden());
    const result = ready(
      buildPersonalFinancialQualityScorecard(
        input([
          {
            ...current,
            facts: [
              ...current.facts,
              fact(2025, "free_cash_flow", "999", "duplicate-fcf"),
            ],
          },
          annual(2024, priorGolden()),
        ]),
      ),
    );

    expect(check(result, "positive_free_cash_flow")).toMatchObject({
      currentObservation: { value: null },
      reason: "ambiguous_fact",
      status: "unavailable",
    });
    expect(
      check(result, "positive_free_cash_flow").currentObservation?.inputRefs,
    ).toHaveLength(2);
    expect(result.counts.unavailable).toBe(1);
    expect(check(result, "positive_net_income").status).toBe("met");
  });

  it("never falls back from a missing latest fact to an older good year", () => {
    const latest = annual(2025, currentGolden());
    const result = ready(
      buildPersonalFinancialQualityScorecard(
        input([
          {
            ...latest,
            facts: latest.facts.filter((fact) => fact.key !== "revenue"),
          },
          annual(2024, priorGolden()),
          annual(2023, priorGolden()),
        ]),
      ),
    );

    for (const checkId of [
      "positive_revenue_growth",
      "gross_margin_not_declining",
      "operating_margin_not_declining",
      "revenue_to_ending_assets_not_declining",
    ] as const) {
      expect(check(result, checkId)).toMatchObject({
        currentObservation: { fiscalYear: 2025, value: null },
        priorObservation: { fiscalYear: 2024 },
        reason: "missing_input",
        status: "unavailable",
      });
    }
    expect(
      allChecks(result).some(
        (item) => item.priorObservation?.fiscalYear === 2023,
      ),
    ).toBe(false);
  });

  it("requires the immediately prior array member to be the consecutive fiscal year", () => {
    const result = ready(
      buildPersonalFinancialQualityScorecard(
        input([
          annual(2025, currentGolden()),
          annual(2023, priorGolden()),
          annual(2022, priorGolden()),
        ]),
      ),
    );

    for (const item of allChecks(result).filter(
      (candidate) => candidate.priorObservation !== null,
    )) {
      expect(item).toMatchObject({
        currentObservation: { fiscalYear: 2025 },
        priorObservation: { fiscalYear: 2023 },
        reason: "non_consecutive_fiscal_years",
        status: "unavailable",
      });
    }
    expect(result.counts).toEqual({
      evaluated: 6,
      met: 6,
      notMet: 0,
      total: 12,
      unavailable: 6,
    });
  });

  it("reports insufficient periods for every check that cannot select its required observation", () => {
    const empty = ready(buildPersonalFinancialQualityScorecard(input([])));
    expect(empty.counts.unavailable).toBe(12);
    expect(
      allChecks(empty).every(
        (item) =>
          item.status === "unavailable" &&
          item.reason === "insufficient_periods" &&
          item.currentObservation === null,
      ),
    ).toBe(true);

    const one = ready(
      buildPersonalFinancialQualityScorecard(
        input([annual(2025, currentGolden())]),
      ),
    );
    expect(one.counts).toEqual({
      evaluated: 6,
      met: 6,
      notMet: 0,
      total: 12,
      unavailable: 6,
    });
    expect(check(one, "positive_revenue_growth")).toMatchObject({
      currentObservation: { fiscalYear: 2025, value: "1000" },
      priorObservation: null,
      reason: "insufficient_periods",
      status: "unavailable",
    });
  });

  it("uses an explicit nonpositive-denominator state for ratios and revenue growth", () => {
    const currentValues = {
      ...currentGolden(),
      assets: "0",
      current_liabilities: "0",
    };
    const priorValues = {
      ...priorGolden(),
      assets: "-1",
      current_liabilities: "-2",
      revenue: "0",
    };
    const result = ready(
      buildPersonalFinancialQualityScorecard(
        input([annual(2025, currentValues), annual(2024, priorValues)]),
      ),
    );

    for (const checkId of [
      "positive_revenue_growth",
      "gross_margin_not_declining",
      "operating_margin_not_declining",
      "revenue_to_ending_assets_not_declining",
      "current_ratio_at_least_one",
      "current_ratio_not_declining",
      "debt_to_assets_not_rising",
    ] as const) {
      expect(check(result, checkId)).toMatchObject({
        reason: "nonpositive_denominator",
        status: "unavailable",
      });
    }
    expect(check(result, "positive_net_income").status).toBe("met");
  });

  it("publishes the exact formula identity and observation references for every check", () => {
    const result = ready(
      buildPersonalFinancialQualityScorecard(
        input([annual(2025, currentGolden()), annual(2024, priorGolden())]),
      ),
    );

    for (const item of allChecks(result)) {
      const formula =
        PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULAS[item.checkId];
      expect(item).toMatchObject({
        expression: formula.expression,
        formulaId: formula.formulaId,
        formulaVersion: "1.0.0",
        groupId: formula.groupId,
        label: formula.label,
      });
      expect(item.currentObservation?.inputRefs.length).toBeGreaterThan(0);
    }
  });
});

function input(
  periods: readonly PersonalFinancialQualityScorecardAnnualPeriodInput[],
): PersonalFinancialQualityScorecardInput {
  return { asOf: "2026-06-15T12:00:00.000Z", periods };
}

function annual(
  fiscalYear: number,
  values: Record<PersonalFinancialQualityScorecardFactKey, string>,
): PersonalFinancialQualityScorecardAnnualPeriodInput {
  return {
    facts: Object.entries(values).map(([key, value]) =>
      fact(fiscalYear, key as PersonalFinancialQualityScorecardFactKey, value),
    ),
    fiscalYear,
    statementDate: `${fiscalYear + 1}-02-15`,
  };
}

function fact(
  fiscalYear: number,
  key: PersonalFinancialQualityScorecardFactKey,
  value: string,
  suffix: string = key,
): PersonalFinancialQualityScorecardFactInput {
  return {
    key,
    sourceRef: `filing-${fiscalYear}-${suffix}`,
    unit: "USD",
    value,
  };
}

function currentGolden(): Record<
  PersonalFinancialQualityScorecardFactKey,
  string
> {
  return {
    assets: "1000",
    current_assets: "300",
    current_liabilities: "200",
    debt: "200",
    free_cash_flow: "120",
    gross_profit: "500",
    net_income: "100",
    operating_cash_flow: "150",
    operating_income: "200",
    revenue: "1000",
    shareholders_equity: "600",
  };
}

function priorGolden(): Record<
  PersonalFinancialQualityScorecardFactKey,
  string
> {
  return {
    assets: "900",
    current_assets: "240",
    current_liabilities: "200",
    debt: "225",
    free_cash_flow: "100",
    gross_profit: "450",
    net_income: "80",
    operating_cash_flow: "130",
    operating_income: "171",
    revenue: "900",
    shareholders_equity: "550",
  };
}

function ready(
  result: ReturnType<typeof buildPersonalFinancialQualityScorecard>,
): PersonalFinancialQualityScorecardReadyResult {
  expect(result.status).toBe("ready");
  if (result.status !== "ready") throw new Error("expected ready result");
  return result;
}

function allChecks(
  result: PersonalFinancialQualityScorecardReadyResult,
): PersonalFinancialQualityScorecardCheck[] {
  return result.groups.flatMap((group) => group.checks);
}

function check(
  result: PersonalFinancialQualityScorecardReadyResult,
  checkId: PersonalFinancialQualityScorecardCheck["checkId"],
): PersonalFinancialQualityScorecardCheck {
  const found = allChecks(result).find((item) => item.checkId === checkId);
  if (found === undefined) throw new Error(`missing check ${checkId}`);
  return found;
}
