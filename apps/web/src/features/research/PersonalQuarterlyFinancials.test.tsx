import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalQuarterlyFinancialsDto,
} from "@research-cockpit/contracts";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  PersonalQuarterlyFinancials,
  type PersonalQuarterlyFinancialsProps,
} from "./PersonalQuarterlyFinancials";

const fieldKeys = [
  "revenue",
  "cost_of_revenue",
  "gross_profit",
  "research_and_development",
  "selling_general_and_administrative",
  "operating_expenses",
  "operating_income",
  "interest_expense",
  "pretax_income",
  "income_tax_expense",
  "net_income",
  "ebitda",
  "cash",
  "accounts_receivable",
  "inventory",
  "current_assets",
  "property_plant_equipment_net",
  "intangibles",
  "assets",
  "current_liabilities",
  "debt",
  "liabilities",
  "shareholders_equity",
  "depreciation_and_amortization",
  "share_based_compensation",
  "operating_cash_flow",
  "capital_expenditures",
  "free_cash_flow",
  "investing_cash_flow",
  "financing_cash_flow",
] as const satisfies readonly PersonalAnnualFinancialReportedFieldKeyDto[];

describe("PersonalQuarterlyFinancials", () => {
  it("requires a selected listing and never starts a request itself", () => {
    const onLoad = vi.fn();
    const markup = render({ onLoad });

    expect(visibleText(markup)).toContain(
      "Choose a security to inspect quarterly statements",
    );
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("renders exact quarterly coordinates, explicit gaps, and no invented TTM", () => {
    const markup = render({
      financials: quarterlyFinancials(),
      selection: selection(),
    });
    const text = visibleText(markup);

    expect(text).toContain("2 / 16");
    expect(text).toContain("FY 2029 Q4");
    expect(text).toContain("FY 2029 Q3");
    expect(text).toContain("FY 2029 Q2");
    expect(text).toContain("Statement date Jan 15, 2030");
    expect(text).toContain("Missing fiscal quarters: FY 2029 Q2");
    expect(text).toContain("Trailing 12 months is not calculated yet");
    expect(text).toContain("cumulative year-to-date amount");
    expect(text).not.toContain("Period ended");
  });

  it("keeps missing cells blank and explains provider entitlement errors", () => {
    const base = quarterlyFinancials();
    const first = base.quarters[0]!;
    const financials: PersonalQuarterlyFinancialsDto = {
      ...base,
      coverage: {
        ...base.coverage,
        knownReportedCells: 59,
        unknownReportedCells: 1,
      },
      quarters: [
        {
          ...first,
          reported: {
            ...first.reported,
            revenue: {
              reason: "not_supplied_by_provider",
              status: "unknown",
              value: null,
            },
          },
        },
        base.quarters[1]!,
      ],
    };
    const markup = render({
      errorCode: "not_entitled",
      financials,
      selection: selection(),
    });
    const text = visibleText(markup);

    expect(text).toContain(
      "Quarterly financials are not included for this account",
    );
    expect(markup).toContain('aria-label="Revenue unknown for FY 2029 Q4"');
  });
});

function defaultProps(
  overrides: Partial<PersonalQuarterlyFinancialsProps> = {},
): PersonalQuarterlyFinancialsProps {
  return {
    errorCode: null,
    financials: null,
    onLoad: vi.fn(),
    providerStatus: {
      profile: "personal_single_user_local_market_data",
      provider: {
        attribution: "Tiingo",
        export: "prohibited",
        historyFeed: "tiingo_eod_composite",
        id: "tiingo",
        name: "Tiingo",
        persistence: "none",
        quoteFeed: "tiingo_iex_derived_reference",
        redistribution: "prohibited",
        retention: "active_owner_session_memory_only",
      },
      schemaVersion: "1.0.0",
      status: "configured",
    },
    requestState: "idle",
    selection: null,
    ...overrides,
  };
}

function quarterlyFinancials(): PersonalQuarterlyFinancialsDto {
  const reported = Object.fromEntries(
    fieldKeys.map((key, index) => [
      key,
      { status: "known", value: String((index + 1) * 10) },
    ]),
  ) as PersonalQuarterlyFinancialsDto["quarters"][number]["reported"];
  return {
    asOf: "2030-01-16T15:00:00.000Z",
    coverage: {
      earliestFiscalQuarter: 3,
      earliestFiscalYear: 2029,
      knownReportedCells: 60,
      latestFiscalQuarter: 4,
      latestFiscalYear: 2029,
      missingFiscalQuarters: [
        { fiscalQuarter: 2, fiscalYear: 2029 },
        { fiscalQuarter: 1, fiscalYear: 2029 },
        { fiscalQuarter: 4, fiscalYear: 2028 },
        { fiscalQuarter: 3, fiscalYear: 2028 },
        { fiscalQuarter: 2, fiscalYear: 2028 },
        { fiscalQuarter: 1, fiscalYear: 2028 },
        { fiscalQuarter: 4, fiscalYear: 2027 },
        { fiscalQuarter: 3, fiscalYear: 2027 },
        { fiscalQuarter: 2, fiscalYear: 2027 },
        { fiscalQuarter: 1, fiscalYear: 2027 },
        { fiscalQuarter: 4, fiscalYear: 2026 },
        { fiscalQuarter: 3, fiscalYear: 2026 },
        { fiscalQuarter: 2, fiscalYear: 2026 },
        { fiscalQuarter: 1, fiscalYear: 2026 },
      ],
      requestedQuarterlyPeriods: 16,
      returnedQuarterlyPeriods: 2,
      status: "partial",
      unknownReportedCells: 0,
    },
    profile: "personal_single_user_local_fundamentals",
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
    quarters: [
      {
        fiscalQuarter: 4,
        fiscalYear: 2029,
        reported,
        statementDate: "2030-01-15",
      },
      {
        fiscalQuarter: 3,
        fiscalYear: 2029,
        reported,
        statementDate: "2029-10-15",
      },
    ],
    schemaVersion: "1.0.0",
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common Stock",
      symbol: "ZERO",
    },
    status: "available",
  };
}

function selection() {
  return {
    country: "US" as const,
    exchangeMic: "XNAS",
    issuerId: "issuer-zero",
    issuerName: "Zero Alpha, Inc.",
    listingId: "lst-zero",
    securityName: "Zero Alpha Common Stock",
    symbol: "ZERO",
  };
}

function render(
  overrides: Partial<PersonalQuarterlyFinancialsProps> = {},
): string {
  return renderToStaticMarkup(
    <PersonalQuarterlyFinancials {...defaultProps(overrides)} />,
  );
}

function visibleText(markup: string): string {
  return decodeEntities(markup.replace(/<[^>]*>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&apos;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"');
}
