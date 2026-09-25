import type {
  PersonalAnnualFinancialReportedCellDto,
  PersonalAnnualFinancialReportedValuesDto,
  PersonalAnnualFinancialsDto,
} from "@research-cockpit/contracts";
import { PERSONAL_FINANCIAL_REPORTED_FIELDS } from "@research-cockpit/personal-financial-analytics";
import { describe, expect, it } from "vitest";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";
import { buildPersonalAnnualFinancialAnalytics } from "./personal-annual-financial-analytics";
import {
  PERSONAL_COMPANY_KEY_STATISTICS_FIELDS,
  projectPersonalCompanyKeyStatistics,
} from "./personal-company-key-statistics";

const selection: PersonalMarketSelection = {
  country: "US",
  exchangeMic: "XNAS",
  issuerId: "issuer-synthetic",
  issuerName: "Synthetic Company",
  listingId: "listing-synthetic",
  securityName: "Synthetic Common Stock",
  symbol: "SYN",
};
const unknown = {
  status: "unknown",
  reason: "not_supplied_by_provider",
  value: null,
} as const;
const known = (value: string): PersonalAnnualFinancialReportedCellDto => ({
  status: "known",
  value,
});

function year(
  fiscalYear: number,
  values: Partial<PersonalAnnualFinancialReportedValuesDto> = {},
) {
  return {
    fiscalYear,
    statementDate: `${String(fiscalYear + 1)}-02-17`,
    reported: Object.fromEntries(
      PERSONAL_FINANCIAL_REPORTED_FIELDS.map(({ fieldKey }) => [
        fieldKey,
        values[fieldKey] ?? unknown,
      ]),
    ) as PersonalAnnualFinancialReportedValuesDto,
  };
}
function packet(
  years = [
    year(2025, {
      revenue: known("100"),
      operating_income: known("12.345"),
      net_income: known("-2.5"),
      operating_cash_flow: known("0"),
      cash: known("20"),
      debt: known("5"),
      assets: known("40"),
    }),
    year(2024, { revenue: known("80") }),
  ],
): PersonalAnnualFinancialsDto {
  const latest = years[0]!.fiscalYear;
  const missingFiscalYears = Array.from(
    { length: 10 },
    (_, index) => latest - index,
  ).filter((fiscalYear) => !years.some((y) => y.fiscalYear === fiscalYear));
  const cells = years.flatMap((y) => Object.values(y.reported));
  const knownReportedCells = cells.filter((c) => c.status === "known").length;
  return {
    asOf: "2026-09-25T12:34:56.000Z",
    coverage: {
      earliestFiscalYear: years.at(-1)!.fiscalYear,
      latestFiscalYear: latest,
      requestedAnnualYears: 10,
      returnedAnnualYears: years.length,
      missingFiscalYears,
      knownReportedCells,
      unknownReportedCells: cells.length - knownReportedCells,
      status: "partial",
    },
    profile: "personal_single_user_local_fundamentals",
    schemaVersion: "1.1.0",
    status: "available",
    security: {
      country: selection.country,
      exchangeMic: selection.exchangeMic,
      issuerName: selection.issuerName,
      listingId: selection.listingId,
      securityName: selection.securityName,
      symbol: selection.symbol,
    },
    years,
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      statementFeed: "tiingo_fundamentals_statements",
      valueCurrency: "USD",
    },
  };
}

describe("company annual key statistics projection", () => {
  it("selects six original formula results with exact signed values, dates and source references", () => {
    const financials = packet();
    const before = JSON.stringify(financials);
    const analytics = buildPersonalAnnualFinancialAnalytics(financials);
    const result = projectPersonalCompanyKeyStatistics({
      selection,
      financials,
    });
    expect(analytics.status).toBe("ready");
    expect(result.status).toBe("ready");
    if (result.status !== "ready" || analytics.status !== "ready")
      throw Error("Expected valid annual results");
    expect(result).toMatchObject({
      fiscalYear: 2025,
      statementDate: "2026-02-17",
      asOf: "2026-09-25T12:34:56.000Z",
      attribution: "Tiingo",
      availableMetricCount: 6,
      metricCount: 6,
      returnedAnnualYears: 2,
      requestedAnnualYears: 10,
      missingFiscalYears: [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016],
    });
    const values = ["12.35", "-2.50", "0.00", "-15.00", "12.50", "25.00"];
    PERSONAL_COMPANY_KEY_STATISTICS_FIELDS.forEach(([key], index) => {
      expect(result.metrics[key]).toEqual(
        key === "revenueGrowth"
          ? analytics.growth.revenue
          : analytics.periods[0]!.metrics[key],
      );
      expect(result.metrics[key]).toMatchObject({
        status: "available",
        value: values[index],
      });
    });
    expect(result.metrics.revenueGrowth).toMatchObject({
      fromFiscalYear: 2024,
      toFiscalYear: 2025,
      inputRefs: [
        { factKey: "revenue", sourceRef: "2025:revenue" },
        { factKey: "revenue", sourceRef: "2024:revenue" },
      ],
    });
    expect(JSON.stringify(financials)).toBe(before);
  });

  it("keeps latest-year missing inputs unavailable despite older usable statistics", () => {
    const older = { ...packet().years[0]!, fiscalYear: 2024 };
    const result = projectPersonalCompanyKeyStatistics({
      selection,
      financials: packet([year(2025), older]),
    });
    expect(result).toMatchObject({
      status: "ready",
      fiscalYear: 2025,
      availableMetricCount: 0,
      metricCount: 6,
    });
    if (result.status !== "ready") throw Error("Expected missing metrics");
    for (const metric of Object.values(result.metrics)) {
      expect(metric).toMatchObject({
        status: "unavailable",
        reason: "missing_input",
      });
      expect(metric).not.toHaveProperty("value");
    }
  });

  it.each([
    ["0", "zero_denominator"],
    ["-80", "nonpositive_prior"],
  ])("preserves growth's %s prior-revenue reason", (prior, reason) => {
    const result = projectPersonalCompanyKeyStatistics({
      selection,
      financials: packet([
        packet().years[0]!,
        year(2024, { revenue: known(prior) }),
      ]),
    });
    expect(result).toMatchObject({
      status: "ready",
      availableMetricCount: 5,
      metrics: {
        revenueGrowth: {
          status: "unavailable",
          reason,
          fromFiscalYear: 2024,
          toFiscalYear: 2025,
        },
      },
    });
  });

  it("preserves zero-denominator margins without treating a real zero net debt as missing", () => {
    const result = projectPersonalCompanyKeyStatistics({
      selection,
      financials: packet([
        year(2025, {
          revenue: known("0"),
          operating_income: known("0"),
          net_income: known("0"),
          operating_cash_flow: known("0"),
          cash: known("5"),
          debt: known("5"),
          assets: known("0"),
        }),
      ]),
    });
    expect(result).toMatchObject({
      status: "ready",
      availableMetricCount: 1,
      metrics: {
        operatingMargin: { status: "unavailable", reason: "zero_denominator" },
        netMargin: { status: "unavailable", reason: "zero_denominator" },
        operatingCashFlowMargin: {
          status: "unavailable",
          reason: "zero_denominator",
        },
        debtToAssets: { status: "unavailable", reason: "zero_denominator" },
        netDebt: { status: "available", value: "0.00" },
        revenueGrowth: {
          status: "unavailable",
          reason: "insufficient_periods",
        },
      },
    });
  });

  it("preserves nonconsecutive growth years without inventing a prior year", () => {
    const result = projectPersonalCompanyKeyStatistics({
      selection,
      financials: packet([
        packet().years[0]!,
        year(2023, { revenue: known("50") }),
      ]),
    });
    expect(result).toMatchObject({
      status: "ready",
      availableMetricCount: 5,
      returnedAnnualYears: 2,
      missingFiscalYears: [2024, 2022, 2021, 2020, 2019, 2018, 2017, 2016],
      metrics: {
        revenueGrowth: {
          status: "unavailable",
          reason: "non_consecutive_fiscal_years",
          fromFiscalYear: 2023,
          toFiscalYear: 2025,
          inputRefs: [],
        },
      },
    });
  });

  it.each([
    "country",
    "exchangeMic",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
  ] as const)("rejects mismatched %s", (field) => {
    const financials = packet();
    expect(
      projectPersonalCompanyKeyStatistics({
        selection,
        financials: {
          ...financials,
          security: { ...financials.security, [field]: "different" },
        },
      }),
    ).toEqual({ status: "unavailable", reason: "identity_mismatch" });
  });

  it("requires the selected issuer authority and separates absent selection from unloaded data", () => {
    expect(
      projectPersonalCompanyKeyStatistics({
        selection: null,
        financials: packet(),
      }),
    ).toEqual({ status: "unavailable", reason: "no_selection" });
    expect(
      projectPersonalCompanyKeyStatistics({ selection, financials: null }),
    ).toEqual({ status: "unavailable", reason: "not_loaded" });
    expect(
      projectPersonalCompanyKeyStatistics({
        selection: { ...selection, issuerId: "" },
        financials: packet(),
      }),
    ).toEqual({ status: "unavailable", reason: "invalid_input" });
  });

  it("keeps duplicate fiscal years quarantined", () => {
    expect(
      projectPersonalCompanyKeyStatistics({
        selection,
        financials: packet([year(2025), year(2025)]),
      }),
    ).toEqual({ status: "unavailable", reason: "quarantined" });
  });

  it("rejects missing latest fiscal years and inconsistent coverage without promoting older results", () => {
    const financials = packet();
    for (const coverage of [
      { ...financials.coverage, latestFiscalYear: 2026 },
      { ...financials.coverage, returnedAnnualYears: 3 },
      { ...financials.coverage, missingFiscalYears: [] },
    ])
      expect(
        projectPersonalCompanyKeyStatistics({
          selection,
          financials: { ...financials, coverage },
        }),
      ).toEqual({ status: "unavailable", reason: "invalid_input" });
  });

  it("returns frozen copied metric references and coverage without modifying the provider input", () => {
    const financials = packet();
    const before = JSON.stringify(financials);
    const result = projectPersonalCompanyKeyStatistics({
      selection,
      financials,
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw Error("Expected ready statistics");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.metrics)).toBe(true);
    expect(Object.isFrozen(result.missingFiscalYears)).toBe(true);
    for (const metric of Object.values(result.metrics)) {
      expect(Object.isFrozen(metric)).toBe(true);
      expect(Object.isFrozen(metric.inputRefs)).toBe(true);
      expect(metric.inputRefs.every(Object.isFrozen)).toBe(true);
    }
    expect(JSON.stringify(financials)).toBe(before);
    (financials.years[0]!.reported.revenue as { value: string }).value = "999";
    expect(result.metrics.operatingMargin).toMatchObject({ value: "12.35" });
    expect(result.metrics.revenueGrowth).toMatchObject({ value: "25.00" });
  });
});
