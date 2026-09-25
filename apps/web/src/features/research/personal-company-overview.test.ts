import type {
  PersonalAnnualFinancialReportedCellDto,
  PersonalAnnualFinancialReportedValuesDto,
  PersonalAnnualFinancialsDto,
} from "@research-cockpit/contracts";
import { PERSONAL_FINANCIAL_REPORTED_FIELDS } from "@research-cockpit/personal-financial-analytics";
import { describe, expect, it } from "vitest";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";
import {
  buildPersonalAnnualFinancialAnalytics,
  formatPersonalFinancialUsd,
} from "./personal-annual-financial-analytics";
import { projectPersonalCompanyOverview } from "./personal-company-overview";

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
      revenue: known("1000.125"),
      net_income: known("-25.375"),
      operating_cash_flow: known("0"),
    }),
  ],
): PersonalAnnualFinancialsDto {
  const latest = years[0]!.fiscalYear;
  const missingFiscalYears = Array.from(
    { length: 10 },
    (_, i) => latest - i,
  ).filter((fy) => !years.some((y) => y.fiscalYear === fy));
  const cells = years.flatMap((y) => Object.values(y.reported));
  const knownReportedCells = cells.filter((c) => c.status === "known").length;
  const security = {
    country: selection.country,
    exchangeMic: selection.exchangeMic,
    issuerName: selection.issuerName,
    listingId: selection.listingId,
    securityName: selection.securityName,
    symbol: selection.symbol,
  };
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
    security,
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

describe("company overview annual projection", () => {
  it("keeps exact signed/zero values and distinct fiscal, statement and retrieval clocks", () => {
    const input = packet();
    const before = JSON.stringify(input);
    expect(
      projectPersonalCompanyOverview({ selection, financials: input }),
    ).toEqual({
      status: "ready",
      fiscalYear: 2025,
      statementDate: "2026-02-17",
      asOf: "2026-09-25T12:34:56.000Z",
      attribution: "Tiingo",
      unit: "USD",
      fieldCount: 3,
      knownFieldCount: 3,
      returnedAnnualYears: 1,
      requestedAnnualYears: 10,
      missingFiscalYears: [
        2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016,
      ],
      cells: {
        revenue: known("1000.125"),
        net_income: known("-25.375"),
        operating_cash_flow: known("0"),
      },
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("does not fill a missing latest cell with an older known value or count other reported fields", () => {
    const result = projectPersonalCompanyOverview({
      selection,
      financials: packet([
        year(2025, {
          revenue: known("0"),
          operating_cash_flow: known("1"),
          assets: known("999"),
        }),
        year(2023, { net_income: known("500") }),
      ]),
    });
    expect(result).toMatchObject({
      status: "ready",
      fiscalYear: 2025,
      knownFieldCount: 2,
      fieldCount: 3,
      cells: { revenue: known("0"), net_income: unknown },
    });
  });

  it("reports a returned year with three unknown cells as zero known fields, not a failed request", () => {
    expect(
      projectPersonalCompanyOverview({
        selection,
        financials: packet([year(2025)]),
      }),
    ).toMatchObject({
      status: "ready",
      knownFieldCount: 0,
      cells: {
        revenue: unknown,
        net_income: unknown,
        operating_cash_flow: unknown,
      },
    });
  });

  it("preserves exact large decimals even when an annual chart cannot plot them safely", () => {
    const value = "9007199254740993123456789.000001";
    expect(
      projectPersonalCompanyOverview({
        selection,
        financials: packet([year(2025, { revenue: known(value) })]),
      }),
    ).toMatchObject({ status: "ready", cells: { revenue: known(value) } });
  });

  it.each([
    "country",
    "exchangeMic",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
  ] as const)("refuses mismatched %s identity", (field) => {
    const input = packet();
    const wrong = {
      ...input,
      security: { ...input.security, [field]: "different" },
    } as PersonalAnnualFinancialsDto;
    expect(
      projectPersonalCompanyOverview({ selection, financials: wrong }),
    ).toEqual({ status: "unavailable", reason: "identity_mismatch" });
  });

  it("retains real analytics quarantine for duplicate fiscal years", () => {
    expect(
      projectPersonalCompanyOverview({
        selection,
        financials: packet([year(2025), year(2025)]),
      }),
    ).toEqual({ status: "unavailable", reason: "quarantined" });
  });

  it("does not promote an older returned year when coverage claims a missing latest year", () => {
    const input = packet([year(2024)]);
    const wrong = {
      ...input,
      coverage: { ...input.coverage, latestFiscalYear: 2025 },
    };
    expect(
      projectPersonalCompanyOverview({ selection, financials: wrong }),
    ).toEqual({ status: "unavailable", reason: "invalid_input" });
  });

  it.each(["1e3", "NaN", "1,000", "--3"])(
    "refuses malformed known decimal %s",
    (value) => {
      expect(
        projectPersonalCompanyOverview({
          selection,
          financials: packet([year(2025, { revenue: known(value) })]),
        }),
      ).toEqual({ status: "unavailable", reason: "invalid_input" });
    },
  );

  it("separates unloaded annuals from an absent selection", () => {
    expect(
      projectPersonalCompanyOverview({ selection, financials: null }),
    ).toEqual({ status: "unavailable", reason: "not_loaded" });
    expect(
      projectPersonalCompanyOverview({ selection: null, financials: packet() }),
    ).toEqual({ status: "unavailable", reason: "no_selection" });
  });

  it("returns frozen summary cells independent from later input mutation", () => {
    const input = packet();
    const result = projectPersonalCompanyOverview({
      selection,
      financials: input,
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw Error("Expected ready projection");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.cells)).toBe(true);
    expect(Object.isFrozen(result.cells.revenue)).toBe(true);
    (input.years[0]!.reported.revenue as { value: string }).value = "999";
    expect(result.cells.revenue).toEqual(known("1000.125"));
  });
});

describe("shared annual analytics mapping", () => {
  it("uses the existing decimal engine and registry source references for reported facts and derived metrics", () => {
    const result = buildPersonalAnnualFinancialAnalytics(
      packet([
        year(2025, {
          revenue: known("100"),
          net_income: known("12.345"),
          operating_cash_flow: known("0"),
          free_cash_flow: known("3"),
          cash: known("20"),
          debt: known("5"),
        }),
        year(2024, { revenue: known("80"), net_income: known("10") }),
      ]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw Error("Expected analytics");
    expect(result.periods[0]!.metrics.netMargin).toMatchObject({
      status: "available",
      value: "12.35",
      inputRefs: [
        { factKey: "net_income", sourceRef: "2025:net_income" },
        { factKey: "revenue", sourceRef: "2025:revenue" },
      ],
    });
    expect(result.periods[0]!.metrics.netDebt).toMatchObject({
      status: "available",
      value: "-15.00",
    });
    expect(result.growth.revenue).toMatchObject({
      status: "available",
      value: "25.00",
    });
    expect(
      result.periods[0]!.statements.cashFlow.lineItems.find(
        (x) => x.factKey === "operating_cash_flow",
      ),
    ).toMatchObject({ status: "available", value: "0" });
  });

  it("keeps unknown reported inputs unavailable and does not infer growth across missing years", () => {
    const result = buildPersonalAnnualFinancialAnalytics(
      packet([
        year(2025, { revenue: known("100") }),
        year(2023, { revenue: known("50") }),
      ]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw Error("Expected analytics");
    expect(result.periods[0]!.metrics.netMargin).toMatchObject({
      status: "unavailable",
      reason: "missing_input",
    });
    expect(result.growth.revenue).toMatchObject({
      status: "unavailable",
      reason: "non_consecutive_fiscal_years",
    });
  });

  it.each([
    ["0", "$0"],
    ["-12.345", "−$12.345"],
    [
      "9007199254740993123456789.000001",
      "$9,007,199,254,740,993,123,456,789.000001",
    ],
  ])("formats %s without losing exact decimal precision", (value, expected) => {
    expect(formatPersonalFinancialUsd(value)).toBe(expected);
  });
});
