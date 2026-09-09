import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
  PERSONAL_FCFF_DCF_FORMULAS,
  PERSONAL_FCFF_DCF_FORMULA_SET_VERSION,
  PERSONAL_FCFF_DCF_METHODOLOGY,
  PERSONAL_FCFF_DCF_REVERSE_BISECTION_ITERATIONS,
  PERSONAL_FCFF_DCF_REVERSE_EXACT_RATE_DECIMAL_PLACES,
  PERSONAL_FCFF_DCF_ROUNDING,
  PERSONAL_FCFF_DCF_SCHEMA_VERSION,
  calculatePersonalFcffDcfValuation,
  type PersonalFcffDcfAnnualCell,
  type PersonalFcffDcfAssumptions,
  type PersonalFcffDcfInput,
  type PersonalFcffDcfMoneyCell,
} from "./personal-fcff-dcf-valuation";

describe("personal starting-unlevered-FCF-proxy DCF valuation", () => {
  it("publishes frozen versioned formulas, defaults, bounds, and limitations", () => {
    expect(PERSONAL_FCFF_DCF_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_FCFF_DCF_FORMULA_SET_VERSION).toBe("1.0.0");
    expect(PERSONAL_FCFF_DCF_REVERSE_BISECTION_ITERATIONS).toBe(256);
    expect(PERSONAL_FCFF_DCF_REVERSE_EXACT_RATE_DECIMAL_PLACES).toBe(80);
    expect(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS).toEqual({
      forecastYears: 5,
      scenarios: {
        base: { annualFcfProxyGrowthPercent: "5" },
        conservative: { annualFcfProxyGrowthPercent: "0" },
        expansion: { annualFcfProxyGrowthPercent: "10" },
      },
      taxShieldRatePercent: "21",
      terminalGrowthPercent: "2.5",
      waccPercent: "10",
    });
    expect(PERSONAL_FCFF_DCF_FORMULAS.enterpriseToEquityBridge.expression).toBe(
      "provider_enterprise_value - provider_market_capitalization",
    );
    expect(PERSONAL_FCFF_DCF_ROUNDING).toMatchObject({
      calculationPrecision: 256,
      method: "round_half_up",
      negativeZero: "normalize_to_positive_zero",
    });
    expect(PERSONAL_FCFF_DCF_METHODOLOGY.limitations.shareBasis).toContain(
      "not_diluted_share_count",
    );
    expect(PERSONAL_FCFF_DCF_METHODOLOGY.limitations.cashFlowBasis).toContain(
      "not_audited_fcff",
    );
    expectDeepFrozen(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS);
    expectDeepFrozen(PERSONAL_FCFF_DCF_METHODOLOGY);
  });

  it("matches an independently solvable five-year three-scenario golden case", () => {
    const result = calculatePersonalFcffDcfValuation(
      completeInput({
        forecastYears: 5,
        scenarios: {
          base: { annualFcfProxyGrowthPercent: "10" },
          conservative: { annualFcfProxyGrowthPercent: "0" },
          expansion: { annualFcfProxyGrowthPercent: "20" },
        },
        taxShieldRatePercent: "21",
        terminalGrowthPercent: "0",
        waccPercent: "10",
      }),
    );

    expect(result).toMatchObject({
      assumptions: {
        forecastYears: 5,
        scenarios: {
          base: { annualFcfProxyGrowthPercent: "10" },
          conservative: { annualFcfProxyGrowthPercent: "0" },
          expansion: { annualFcfProxyGrowthPercent: "20" },
        },
        taxShieldRatePercent: "21",
        terminalGrowthPercent: "0",
        waccPercent: "10",
      },
      formulaSetVersion: "1.0.0",
      reference: {
        annualFiscalYear: 2025,
        date: "2025-12-31",
        enterpriseValueUsd: "1000.00",
        impliedShareCount: "10.000000",
        marketCapitalizationUsd: "900.00",
        startingUnleveredFcfProxyUsd: "100.00",
        providerEvToEquityBridgeUsd: "100.00",
        rawCloseUsd: "90.00",
        sourceOperands: {
          enterpriseValueUsd: "1000",
          marketCapitalizationUsd: "900",
          rawCloseUsd: "90",
          reportedFreeCashFlowUsd: "100",
          reportedInterestExpenseUsd: "0",
        },
      },
      schemaVersion: "1.0.0",
      status: "available",
    });
    if (result.status !== "available") throw new TypeError();
    expect(result.scenarios.conservative).toEqual({
      annualFcfProxyGrowthPercent: "0.0000",
      differencePercent: "0.00",
      enterpriseValueUsd: "1000.00",
      equityValueUsd: "900.00",
      impliedPriceUsd: "90.00",
      presentValueOfExplicitFcfProxyUsd: "379.08",
      presentValueOfTerminalValueUsd: "620.92",
      projection: [
        { fcfProxyUsd: "100.00", presentValueUsd: "90.91", year: 1 },
        { fcfProxyUsd: "100.00", presentValueUsd: "82.64", year: 2 },
        { fcfProxyUsd: "100.00", presentValueUsd: "75.13", year: 3 },
        { fcfProxyUsd: "100.00", presentValueUsd: "68.30", year: 4 },
        { fcfProxyUsd: "100.00", presentValueUsd: "62.09", year: 5 },
      ],
      scenario: "conservative",
      status: "available",
      terminalValuePercentOfEnterpriseValue: "62.09",
      terminalValueUsd: "1000.00",
    });
    expect(result.scenarios.base).toMatchObject({
      annualFcfProxyGrowthPercent: "10.0000",
      differencePercent: "55.56",
      enterpriseValueUsd: "1500.00",
      equityValueUsd: "1400.00",
      impliedPriceUsd: "140.00",
      scenario: "base",
      status: "available",
    });
    expect(result.scenarios.expansion).toMatchObject({
      annualFcfProxyGrowthPercent: "20.0000",
      differencePercent: "133.23",
      enterpriseValueUsd: "2199.11",
      equityValueUsd: "2099.11",
      impliedPriceUsd: "209.91",
      scenario: "expansion",
      status: "available",
    });
    expect(result.reverseDcf).toEqual({
      impliedAnnualFcfProxyGrowthPercent: "0.0000",
      iterations: 256,
      resolvedAnnualFcfProxyGrowthPercent:
        "0.00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      searchLowerBoundPercent: "-50",
      searchUpperBoundPercent: "50",
      solvedEnterpriseValueUsd: "1000.00",
      status: "available",
      targetEnterpriseValueUsd: "1000.00",
    });
    expectDeepFrozen(result);
  });

  it("mechanically converts reported FCF with absolute after-tax interest", () => {
    const input = completeInput({
      ...fiveYearAssumptions(),
      taxShieldRatePercent: "20",
    });
    const latest = input.annuals!.years[0]!;
    const result = calculatePersonalFcffDcfValuation({
      ...input,
      annuals: {
        ...input.annuals!,
        years: [
          {
            ...latest,
            reported: {
              free_cash_flow: knownAnnual("80"),
              interest_expense: knownAnnual("-25"),
            },
          },
        ],
      },
    });

    expect(result).toMatchObject({
      reference: {
        afterTaxInterestAddBackUsd: "20.00",
        reportedInterestExpenseMagnitudeUsd: "25.00",
        startingUnleveredFcfProxyUsd: "100.00",
        reportedFreeCashFlowUsd: "80.00",
        reportedInterestExpenseUsd: "-25.00",
        sourceOperands: {
          reportedFreeCashFlowUsd: "80",
          reportedInterestExpenseUsd: "-25",
        },
        taxShieldRatePercent: "20.0000",
      },
      status: "available",
    });
  });

  it("admits a negative reported FCF only when the mechanical add-back makes the starting proxy positive", () => {
    let input = completeInput({
      ...fiveYearAssumptions(),
      taxShieldRatePercent: "20",
    });
    input = replaceAnnualCell(input, "free_cash_flow", knownAnnual("-10"));
    input = replaceAnnualCell(input, "interest_expense", knownAnnual("25"));

    expect(calculatePersonalFcffDcfValuation(input)).toMatchObject({
      reference: {
        afterTaxInterestAddBackUsd: "20.00",
        reportedFreeCashFlowUsd: "-10.00",
        startingUnleveredFcfProxyUsd: "10.00",
      },
      status: "available",
    });
  });

  it("freezes the bridge on the latest exact shared daily date", () => {
    const input = completeInput(fiveYearAssumptions());
    const result = calculatePersonalFcffDcfValuation({
      ...input,
      market: {
        ...input.market!,
        bars: [
          { date: "2025-12-30", raw: { close: "80" } },
          { date: "2025-12-31", raw: { close: "90" } },
          { date: "2026-01-02", raw: { close: "200" } },
        ],
      },
      valuation: {
        ...input.valuation!,
        points: [
          {
            date: "2025-12-30",
            enterpriseValue: knownMoney("900"),
            marketCapitalization: knownMoney("800"),
          },
          {
            date: "2025-12-31",
            enterpriseValue: knownMoney("1000"),
            marketCapitalization: knownMoney("900"),
          },
        ],
      },
    });

    expect(result).toMatchObject({
      reference: {
        date: "2025-12-31",
        enterpriseValueUsd: "1000.00",
        marketCapitalizationUsd: "900.00",
        rawCloseUsd: "90.00",
      },
      status: "available",
    });
  });

  it("does not fall back when the latest shared date has an unavailable operand", () => {
    const input = completeInput(fiveYearAssumptions());
    const result = calculatePersonalFcffDcfValuation({
      ...input,
      market: {
        ...input.market!,
        bars: [
          { date: "2025-12-30", raw: { close: "80" } },
          { date: "2025-12-31", raw: { close: "90" } },
        ],
      },
      valuation: {
        ...input.valuation!,
        points: [
          {
            date: "2025-12-30",
            enterpriseValue: knownMoney("900"),
            marketCapitalization: knownMoney("800"),
          },
          {
            date: "2025-12-31",
            enterpriseValue: unknownMoney(),
            marketCapitalization: knownMoney("900"),
          },
        ],
      },
    });

    expect(result).toMatchObject({
      reason: "reference_enterprise_value_unavailable",
      status: "unavailable",
    });
  });

  it("builds a live 5x5 base-case WACC by terminal-growth sensitivity", () => {
    const result = calculatePersonalFcffDcfValuation(completeInput());
    if (result.status !== "available") throw new TypeError();

    expect(result.sensitivity).toMatchObject({
      scenario: "base",
      terminalGrowthDeltasPercentagePoints: ["-1", "-0.5", "0", "0.5", "1"],
      waccDeltasPercentagePoints: ["-2", "-1", "0", "1", "2"],
    });
    expect(result.sensitivity.cells).toHaveLength(25);
    const center = result.sensitivity.cells.find(
      (cell) =>
        cell.waccPercent === "10.0000" &&
        cell.terminalGrowthPercent === "2.5000",
    );
    expect(center).toMatchObject({
      impliedPriceUsd:
        result.scenarios.base.status === "available"
          ? result.scenarios.base.impliedPriceUsd
          : undefined,
      status: "available",
    });
    const lowWacc = result.sensitivity.cells.find(
      (cell) =>
        cell.waccPercent === "8.0000" &&
        cell.terminalGrowthPercent === "2.5000",
    );
    const highWacc = result.sensitivity.cells.find(
      (cell) =>
        cell.waccPercent === "12.0000" &&
        cell.terminalGrowthPercent === "2.5000",
    );
    if (lowWacc?.status !== "available" || highWacc?.status !== "available") {
      throw new TypeError();
    }
    expect(Number(lowWacc.impliedPriceUsd)).toBeGreaterThan(
      Number(highWacc.impliedPriceUsd),
    );
    const lowTerminalGrowth = result.sensitivity.cells.find(
      (cell) =>
        cell.waccPercent === "10.0000" &&
        cell.terminalGrowthPercent === "1.5000",
    );
    const highTerminalGrowth = result.sensitivity.cells.find(
      (cell) =>
        cell.waccPercent === "10.0000" &&
        cell.terminalGrowthPercent === "3.5000",
    );
    if (
      lowTerminalGrowth?.status !== "available" ||
      highTerminalGrowth?.status !== "available"
    ) {
      throw new TypeError();
    }
    expect(Number(lowTerminalGrowth.impliedPriceUsd)).toBeLessThan(
      Number(highTerminalGrowth.impliedPriceUsd),
    );
  });

  it("returns typed reverse-growth bounds instead of clamping", () => {
    const lowTarget = replaceReferenceValuation(
      completeInput(),
      "1",
      "0.9",
      "0.09",
    );
    const highTarget = replaceReferenceValuation(
      completeInput(),
      "1000000000",
      "999999900",
      "90",
    );
    const low = calculatePersonalFcffDcfValuation(lowTarget);
    const high = calculatePersonalFcffDcfValuation(highTarget);
    if (low.status !== "available" || high.status !== "available")
      throw new TypeError();

    expect(low.reverseDcf).toMatchObject({
      reason: "target_below_growth_search_bound",
      status: "unavailable",
    });
    expect(high.reverseDcf).toMatchObject({
      reason: "target_above_growth_search_bound",
      status: "unavailable",
    });
  });

  it("resolves max-magnitude reverse DCF targets to the displayed cent", () => {
    const startingFcf = `1${"0".repeat(62)}`;
    const targetEnterpriseValue = `1${"0".repeat(63)}`;
    let input = replaceReferenceValuation(
      completeInput(fiveYearAssumptions()),
      targetEnterpriseValue,
      targetEnterpriseValue,
      "1",
    );
    input = replaceAnnualCell(
      input,
      "free_cash_flow",
      knownAnnual(startingFcf),
    );
    const result = calculatePersonalFcffDcfValuation(input);
    if (result.status !== "available") throw new TypeError();

    expect(result.reverseDcf).toEqual({
      impliedAnnualFcfProxyGrowthPercent: "0.0000",
      iterations: 256,
      resolvedAnnualFcfProxyGrowthPercent:
        "0.00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      searchLowerBoundPercent: "-50",
      searchUpperBoundPercent: "50",
      solvedEnterpriseValueUsd: `${targetEnterpriseValue}.00`,
      status: "available",
      targetEnterpriseValueUsd: `${targetEnterpriseValue}.00`,
    });
  });

  it("publishes the exact solver rate needed to reproduce the target EV", () => {
    let input = replaceReferenceValuation(
      completeInput(),
      "1234567890123",
      "1200000000000",
      "120",
    );
    input = replaceAnnualCell(
      input,
      "free_cash_flow",
      knownAnnual("100000000000"),
    );
    const result = calculatePersonalFcffDcfValuation(input);
    if (
      result.status !== "available" ||
      result.reverseDcf.status !== "available"
    )
      throw new TypeError();

    const reproduced = independentEnterpriseValue(
      "100000000000",
      result.reverseDcf.resolvedAnnualFcfProxyGrowthPercent,
      result.assumptions.waccPercent,
      result.assumptions.terminalGrowthPercent,
      result.assumptions.forecastYears,
    );
    expect(result.reverseDcf.impliedAnnualFcfProxyGrowthPercent).toBe("0.1296");
    expect(reproduced).toBe(result.reverseDcf.targetEnterpriseValueUsd);
    expect(result.reverseDcf.solvedEnterpriseValueUsd).toBe(
      result.reverseDcf.targetEnterpriseValueUsd,
    );
  });

  it.each([
    ["999.995", "1000.00"],
    ["1000.025", "1000.03"],
  ] as const)(
    "selects a money-resolving reverse candidate at half-cent target %s",
    (targetEnterpriseValue, roundedTarget) => {
      const result = calculatePersonalFcffDcfValuation(
        replaceReferenceValuation(
          completeInput(fiveYearAssumptions()),
          targetEnterpriseValue,
          targetEnterpriseValue,
          "10",
        ),
      );
      if (result.status !== "available") throw new TypeError();

      expect(result.reverseDcf).toMatchObject({
        solvedEnterpriseValueUsd: roundedTarget,
        status: "available",
        targetEnterpriseValueUsd: roundedTarget,
      });
    },
  );

  it.each([
    ["-50.0000", "70.08"],
    ["50.0000", "1888.32"],
  ] as const)(
    "preserves an exact reverse-search endpoint at %s growth",
    (impliedGrowth, targetEnterpriseValue) => {
      const assumptions: PersonalFcffDcfAssumptions = {
        ...fiveYearAssumptions(),
        waccPercent: "25",
      };
      const result = calculatePersonalFcffDcfValuation(
        replaceReferenceValuation(
          completeInput(assumptions),
          targetEnterpriseValue,
          targetEnterpriseValue,
          "10",
        ),
      );
      if (result.status !== "available") throw new TypeError();

      expect(result.reverseDcf).toMatchObject({
        impliedAnnualFcfProxyGrowthPercent: impliedGrowth,
        resolvedAnnualFcfProxyGrowthPercent: `${impliedGrowth}${"0".repeat(76)}`,
        solvedEnterpriseValueUsd: targetEnterpriseValue,
        status: "available",
        targetEnterpriseValueUsd: targetEnterpriseValue,
      });
    },
  );

  it("keeps forward per-share arithmetic cent-accurate across the accepted numeric domain", () => {
    const maximumInteger = "9".repeat(64);
    const minimumPositive = `0.${"0".repeat(61)}1`;
    let input = replaceReferenceValuation(
      completeInput(fiveYearAssumptions()),
      minimumPositive,
      minimumPositive,
      maximumInteger,
    );
    input = replaceAnnualCell(
      input,
      "free_cash_flow",
      knownAnnual(maximumInteger),
    );
    const result = calculatePersonalFcffDcfValuation(input);
    if (result.status !== "available") throw new TypeError();
    const expectedPrice = `${(
      BigInt(maximumInteger) *
      BigInt(maximumInteger) *
      10n ** 63n
    ).toString()}.00`;

    expect(result.scenarios.base).toMatchObject({
      impliedPriceUsd: expectedPrice,
      status: "available",
    });
  });

  it("marks a scenario unavailable instead of emitting a nonpositive share value", () => {
    const input = replaceReferenceValuation(
      completeInput(fiveYearAssumptions()),
      "3000",
      "100",
      "10",
    );
    const result = calculatePersonalFcffDcfValuation(input);
    if (result.status !== "available") throw new TypeError();

    expect(result.scenarios.base).toMatchObject({
      enterpriseValueUsd: "1000.00",
      equityValueUsd: "-1900.00",
      reason: "nonpositive_equity_value",
      status: "unavailable",
    });
  });

  it.each([
    ["selection_not_loaded", () => ({ ...completeInput(), selection: null })],
    ["market_not_loaded", () => ({ ...completeInput(), market: null })],
    [
      "valuation_history_not_loaded",
      () => ({ ...completeInput(), valuation: null }),
    ],
    [
      "annual_financials_not_loaded",
      () => ({ ...completeInput(), annuals: null }),
    ],
    [
      "identity_mismatch",
      () => {
        const input = completeInput();
        return {
          ...input,
          annuals: {
            ...input.annuals!,
            security: { ...input.annuals!.security, listingId: "lst-other" },
          },
        };
      },
    ],
    [
      "range_mismatch",
      () => {
        const input = completeInput();
        return {
          ...input,
          valuation: { ...input.valuation!, range: "5y" as const },
        };
      },
    ],
    [
      "no_common_date",
      () => {
        const input = completeInput();
        return {
          ...input,
          market: {
            ...input.market!,
            bars: [{ date: "2025-12-30", raw: { close: "90" } }],
          },
        };
      },
    ],
    [
      "reference_price_nonpositive",
      () => replaceReferencePrice(completeInput(), "0"),
    ],
    [
      "reference_market_cap_unavailable",
      () => replaceMarketCap(completeInput(), unknownMoney()),
    ],
    [
      "reference_market_cap_nonpositive",
      () => replaceMarketCap(completeInput(), knownMoney("0")),
    ],
    [
      "reference_enterprise_value_unavailable",
      () => replaceEnterpriseValue(completeInput(), unknownMoney()),
    ],
    [
      "reference_enterprise_value_nonpositive",
      () => replaceEnterpriseValue(completeInput(), knownMoney("0")),
    ],
    [
      "no_annual_periods",
      () => {
        const input = completeInput();
        return { ...input, annuals: { ...input.annuals!, years: [] } };
      },
    ],
    [
      "annual_statement_after_reference_date",
      () => {
        const input = completeInput();
        const latest = input.annuals!.years[0]!;
        return {
          ...input,
          annuals: {
            ...input.annuals!,
            years: [{ ...latest, statementDate: "2026-01-01" }],
          },
        };
      },
    ],
    [
      "required_annual_input_unavailable",
      () =>
        replaceAnnualCell(completeInput(), "interest_expense", unknownAnnual()),
    ],
    [
      "starting_unlevered_fcf_proxy_nonpositive",
      () =>
        replaceAnnualCell(completeInput(), "free_cash_flow", knownAnnual("-1")),
    ],
    [
      "tax_shield_rate_out_of_bounds",
      () => replaceAssumptions(completeInput(), { taxShieldRatePercent: "51" }),
    ],
    [
      "scenario_growth_out_of_bounds",
      () => {
        const input = completeInput();
        return replaceAssumptions(input, {
          scenarios: {
            ...input.assumptions.scenarios,
            expansion: { annualFcfProxyGrowthPercent: "51" },
          },
        });
      },
    ],
    [
      "scenario_growth_not_ordered",
      () => {
        const input = completeInput();
        return replaceAssumptions(input, {
          scenarios: {
            ...input.assumptions.scenarios,
            conservative: { annualFcfProxyGrowthPercent: "6" },
          },
        });
      },
    ],
    [
      "wacc_out_of_bounds",
      () => replaceAssumptions(completeInput(), { waccPercent: "0" }),
    ],
    [
      "terminal_growth_out_of_bounds",
      () => replaceAssumptions(completeInput(), { terminalGrowthPercent: "6" }),
    ],
    [
      "forecast_years_out_of_bounds",
      () => replaceAssumptions(completeInput(), { forecastYears: 11 }),
    ],
    [
      "discount_rate_not_above_terminal_growth",
      () =>
        replaceAssumptions(completeInput(), {
          terminalGrowthPercent: "5",
          waccPercent: "5",
        }),
    ],
  ] as const)("returns typed unavailable reason %s", (reason, build) => {
    expect(calculatePersonalFcffDcfValuation(build())).toMatchObject({
      reason,
      status: "unavailable",
    });
  });

  it("reports every missing latest-period annual operand", () => {
    let input = completeInput();
    input = replaceAnnualCell(input, "free_cash_flow", unknownAnnual());
    input = replaceAnnualCell(input, "interest_expense", unknownAnnual());

    expect(calculatePersonalFcffDcfValuation(input)).toMatchObject({
      missingAnnualInputs: ["free_cash_flow", "interest_expense"],
      reason: "required_annual_input_unavailable",
      status: "unavailable",
    });
  });

  it("rejects mutually consistent stale source DTOs for a different current selection", () => {
    const input = completeInput();

    expect(
      calculatePersonalFcffDcfValuation({
        ...input,
        selection: {
          ...input.selection!,
          issuerName: "Current Issuer",
          listingId: "lst-current",
          securityName: "Current Security",
          symbol: "CURR",
        },
      }),
    ).toMatchObject({
      reason: "identity_mismatch",
      status: "unavailable",
    });
  });
});

function completeInput(
  assumptions: PersonalFcffDcfAssumptions = PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
): PersonalFcffDcfInput {
  return {
    annuals: {
      asOf: "2026-01-02T00:00:00.000Z",
      security: identity(),
      valueCurrency: "USD",
      years: [
        {
          fiscalYear: 2025,
          reported: {
            free_cash_flow: knownAnnual("100"),
            interest_expense: knownAnnual("0"),
          },
          statementDate: "2025-12-31",
        },
      ],
    },
    assumptions,
    market: {
      bars: [{ date: "2025-12-31", raw: { close: "90" } }],
      priceCurrency: "USD",
      range: "1y",
      security: identity(),
    },
    selection: identity(),
    valuation: {
      asOf: "2026-01-02T00:00:00.000Z",
      points: [
        {
          date: "2025-12-31",
          enterpriseValue: knownMoney("1000"),
          marketCapitalization: knownMoney("900"),
        },
      ],
      range: "1y",
      security: identity(),
    },
  };
}

function fiveYearAssumptions(): PersonalFcffDcfAssumptions {
  return {
    forecastYears: 5,
    scenarios: {
      base: { annualFcfProxyGrowthPercent: "0" },
      conservative: { annualFcfProxyGrowthPercent: "0" },
      expansion: { annualFcfProxyGrowthPercent: "0" },
    },
    taxShieldRatePercent: "21",
    terminalGrowthPercent: "0",
    waccPercent: "10",
  };
}

function identity() {
  return {
    country: "US" as const,
    exchangeMic: "XNYS",
    issuerName: "Example Corporation",
    listingId: "lst-example",
    securityName: "Example common stock",
    symbol: "EXM",
  };
}

function knownMoney(value: string): PersonalFcffDcfMoneyCell {
  return { status: "known", unit: "USD", value };
}

function unknownMoney(): PersonalFcffDcfMoneyCell {
  return {
    reason: "not_supplied_by_provider",
    status: "unknown",
    unit: "USD",
    value: null,
  };
}

function knownAnnual(value: string): PersonalFcffDcfAnnualCell {
  return { status: "known", value };
}

function unknownAnnual(): PersonalFcffDcfAnnualCell {
  return {
    reason: "not_supplied_by_provider",
    status: "unknown",
    value: null,
  };
}

function replaceReferencePrice(
  input: PersonalFcffDcfInput,
  close: string,
): PersonalFcffDcfInput {
  return {
    ...input,
    market: {
      ...input.market!,
      bars: [{ ...input.market!.bars[0]!, raw: { close } }],
    },
  };
}

function replaceMarketCap(
  input: PersonalFcffDcfInput,
  marketCapitalization: PersonalFcffDcfMoneyCell,
): PersonalFcffDcfInput {
  const point = input.valuation!.points[0]!;
  return {
    ...input,
    valuation: {
      ...input.valuation!,
      points: [{ ...point, marketCapitalization }],
    },
  };
}

function replaceEnterpriseValue(
  input: PersonalFcffDcfInput,
  enterpriseValue: PersonalFcffDcfMoneyCell,
): PersonalFcffDcfInput {
  const point = input.valuation!.points[0]!;
  return {
    ...input,
    valuation: {
      ...input.valuation!,
      points: [{ ...point, enterpriseValue }],
    },
  };
}

function replaceReferenceValuation(
  input: PersonalFcffDcfInput,
  enterpriseValue: string,
  marketCapitalization: string,
  rawClose: string,
): PersonalFcffDcfInput {
  return replaceReferencePrice(
    replaceEnterpriseValue(
      replaceMarketCap(input, knownMoney(marketCapitalization)),
      knownMoney(enterpriseValue),
    ),
    rawClose,
  );
}

function replaceAnnualCell(
  input: PersonalFcffDcfInput,
  key: "free_cash_flow" | "interest_expense",
  cell: PersonalFcffDcfAnnualCell,
): PersonalFcffDcfInput {
  const latest = input.annuals!.years[0]!;
  return {
    ...input,
    annuals: {
      ...input.annuals!,
      years: [
        {
          ...latest,
          reported: { ...latest.reported, [key]: cell },
        },
      ],
    },
  };
}

function replaceAssumptions(
  input: PersonalFcffDcfInput,
  patch: Partial<PersonalFcffDcfAssumptions>,
): PersonalFcffDcfInput {
  return { ...input, assumptions: { ...input.assumptions, ...patch } };
}

function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}

function independentEnterpriseValue(
  startingFcf: string,
  growthPercent: string,
  waccPercent: string,
  terminalGrowthPercent: string,
  forecastYears: number,
): string {
  const PreciseDecimal = Decimal.clone({ precision: 300 });
  const one = new PreciseDecimal(1);
  const growth = new PreciseDecimal(growthPercent).div(100);
  const wacc = new PreciseDecimal(waccPercent).div(100);
  const terminalGrowth = new PreciseDecimal(terminalGrowthPercent).div(100);
  let explicitPresentValue = new PreciseDecimal(0);
  let finalFcf = new PreciseDecimal(startingFcf);
  for (let year = 1; year <= forecastYears; year += 1) {
    finalFcf = new PreciseDecimal(startingFcf).mul(one.plus(growth).pow(year));
    explicitPresentValue = explicitPresentValue.plus(
      finalFcf.div(one.plus(wacc).pow(year)),
    );
  }
  const terminalPresentValue = finalFcf
    .mul(one.plus(terminalGrowth))
    .div(wacc.minus(terminalGrowth))
    .div(one.plus(wacc).pow(forecastYears));
  return explicitPresentValue
    .plus(terminalPresentValue)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}
