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
    expect(markup).not.toContain("financials-ttm-gate");
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("waits for a loaded response before assessing the selected company", () => {
    const onLoad = vi.fn();
    const markup = render({ onLoad, selection: selection() });

    expect(markup).not.toContain("financials-ttm-gate");
    expect(visibleText(markup)).toContain("Load quarterly financials");
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

  it("keeps TTM unavailable when all four reported values are known", () => {
    const base = quarterlyFinancials();
    const first = base.quarters[0]!;
    const financials = withQuarters(
      [4, 3, 2, 1].map((fiscalQuarter) => ({
        ...first,
        fiscalQuarter: fiscalQuarter as 1 | 2 | 3 | 4,
        reported: {
          ...first.reported,
          revenue: { status: "known", value: "0" },
          net_income: { status: "known", value: "-12.50" },
        },
      })),
    );
    const onLoad = vi.fn();
    const markup = render({ financials, onLoad, selection: selection() });
    const assessment = compatibilityMarkup(markup);

    for (const metric of ["Revenue", "Net income"]) {
      const text = visibleText(metricMarkup(markup, metric));
      expect(text).toContain("TTM unavailable");
      expect(text).toContain("4 of 4 reported values known");
      expect(text).toContain("All four values are present");
      expect(text).not.toContain("Value unknown");
      expect(text).not.toContain("Not returned");
    }
    expect(visibleText(assessment)).toContain(
      "Known reported values alone do not establish a compatible twelve-month period",
    );
    expect(assessment).not.toContain("$");
    expect(markup).toContain("−$12.50");
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("explains the six missing evidence categories once for both metrics", () => {
    const markup = render({
      financials: quarterlyFinancials(),
      selection: selection(),
    });
    const assessment = visibleText(compatibilityMarkup(markup));

    for (const reason of [
      "Actual period start/end dates",
      "A verified fiscal calendar",
      "Per-value currency, unit and scale evidence",
      "Consistent issuer and consolidated reporting scope",
      "Consistent accounting definitions and sign conventions",
      "Source references and compatible revisions",
    ]) {
      expect(assessment.split(reason)).toHaveLength(2);
    }
    expect(assessment).toContain("Statement dates are provider release dates");
    expect(assessment).not.toContain("Period ended");
    expect(assessment).not.toContain("2029-01-01");
  });

  it("assesses four expected coordinates across a fiscal-year boundary", () => {
    const first = quarterlyFinancials().quarters[0]!;
    const financials = withQuarters([
      { ...first, fiscalYear: 2030, fiscalQuarter: 1 },
      { ...first, fiscalYear: 2029, fiscalQuarter: 4 },
      { ...first, fiscalYear: 2029, fiscalQuarter: 3 },
      { ...first, fiscalYear: 2029, fiscalQuarter: 2 },
    ]);
    const markup = render({ financials, selection: selection() });
    const details = compatibilityDetails(markup);

    expect(visibleText(details)).toContain("Inspect the four fiscal quarters");
    expect(details.indexOf("FY 2029 Q2")).toBeLessThan(
      details.indexOf("FY 2029 Q3"),
    );
    expect(details.indexOf("FY 2029 Q3")).toBeLessThan(
      details.indexOf("FY 2029 Q4"),
    );
    expect(details.indexOf("FY 2029 Q4")).toBeLessThan(
      details.indexOf("FY 2030 Q1"),
    );
    expect(details).not.toContain("FY 2029 Q1");
    expect(details).not.toContain("open=");
    expect(details.match(/<li>/gu)).toHaveLength(4);
  });

  it("never replaces a missing expected quarter with an older returned row", () => {
    const first = quarterlyFinancials().quarters[0]!;
    const financials = withQuarters([
      { ...first, fiscalYear: 2029, fiscalQuarter: 4 },
      { ...first, fiscalYear: 2029, fiscalQuarter: 3 },
      { ...first, fiscalYear: 2029, fiscalQuarter: 1 },
      { ...first, fiscalYear: 2028, fiscalQuarter: 4 },
    ]);
    const markup = render({ financials, selection: selection() });

    expect(visibleText(metricMarkup(markup, "Revenue"))).toContain(
      "3 of 4 reported values known Not returned: FY 2029 Q2",
    );
    const details = visibleText(compatibilityDetails(markup));
    expect(details).toContain(
      "FY 2029 Q2 Revenue: quarter not returned Net income: quarter not returned",
    );
    expect(details).not.toContain("FY 2028 Q4");
  });

  it("distinguishes an unknown metric value from an absent fiscal quarter", () => {
    const base = quarterlyFinancials();
    const first = base.quarters[0]!;
    const financials = withQuarters([
      {
        ...first,
        reported: {
          ...first.reported,
          revenue: {
            status: "unknown",
            value: null,
            reason: "not_supplied_by_provider",
          },
        },
      },
      base.quarters[1]!,
    ]);
    const markup = render({ financials, selection: selection() });
    const revenue = visibleText(metricMarkup(markup, "Revenue"));
    const netIncome = visibleText(metricMarkup(markup, "Net income"));

    expect(revenue).toContain("1 of 4 reported values known");
    expect(revenue).toContain("Not returned: FY 2029 Q1, FY 2029 Q2");
    expect(revenue).toContain("Value unknown: FY 2029 Q4");
    expect(netIncome).toContain("2 of 4 reported values known");
    expect(netIncome).not.toContain("Value unknown");
    expect(visibleText(compatibilityDetails(markup))).toContain(
      "FY 2029 Q4 Revenue: value unknown · Statement date Jan 15, 2030 Net income: reported value known",
    );
  });

  it("withholds counts and evidence claims when the selection does not match", () => {
    const markup = render({
      financials: quarterlyFinancials(),
      selection: { ...selection(), listingId: "lst-other" },
    });
    const assessment = visibleText(compatibilityMarkup(markup));

    expect(assessment).toContain(
      "Quarterly compatibility could not be assessed",
    );
    expect(assessment).not.toContain("reported values known");
    expect(assessment).not.toContain("Evidence still needed");
    expect(assessment).not.toContain("Inspect the four fiscal quarters");
    expect(assessment).not.toContain("Per-value currency");
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

function withQuarters(
  quarters: PersonalQuarterlyFinancialsDto["quarters"],
): PersonalQuarterlyFinancialsDto {
  const base = quarterlyFinancials();
  const latest = quarters[0]!;
  const earliest = quarters[quarters.length - 1]!;
  const knownReportedCells = quarters.reduce(
    (total, quarter) =>
      total +
      Object.values(quarter.reported).filter((cell) => cell.status === "known")
        .length,
    0,
  );
  const missingFiscalQuarters = Array.from({ length: 16 }, (_, offset) => {
    const ordinal = latest.fiscalYear * 4 + latest.fiscalQuarter - 1 - offset;
    return {
      fiscalQuarter: ((ordinal % 4) + 1) as 1 | 2 | 3 | 4,
      fiscalYear: Math.floor(ordinal / 4),
    };
  }).filter(
    (coordinate) =>
      !quarters.some(
        (quarter) =>
          quarter.fiscalYear === coordinate.fiscalYear &&
          quarter.fiscalQuarter === coordinate.fiscalQuarter,
      ),
  );

  return {
    ...base,
    quarters,
    coverage: {
      ...base.coverage,
      earliestFiscalQuarter: earliest.fiscalQuarter,
      earliestFiscalYear: earliest.fiscalYear,
      latestFiscalQuarter: latest.fiscalQuarter,
      latestFiscalYear: latest.fiscalYear,
      knownReportedCells,
      unknownReportedCells:
        quarters.length * fieldKeys.length - knownReportedCells,
      missingFiscalQuarters,
      returnedQuarterlyPeriods: quarters.length,
    },
  };
}

function compatibilityMarkup(markup: string): string {
  const start = markup.indexOf(
    '<section aria-labelledby="quarterly-ttm-compatibility-title"',
  );
  const end = markup.indexOf('<div class="financial-statement-stack"', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return markup.slice(start, end);
}

function metricMarkup(markup: string, metric: string): string {
  const start = markup.indexOf(
    `<section aria-label="${metric} TTM compatibility"`,
  );
  const end = markup.indexOf("</section>", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return markup.slice(start, end);
}

function compatibilityDetails(markup: string): string {
  const start = markup.indexOf('<details class="financials-ttm-details"');
  const end = markup.indexOf("</details>", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return markup.slice(start, end);
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
