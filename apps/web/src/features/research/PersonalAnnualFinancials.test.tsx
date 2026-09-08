import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialReportedValuesDto,
  PersonalAnnualFinancialsDto,
  PersonalMarketDataStatusDto,
} from "@research-cockpit/contracts";
import { PERSONAL_FINANCIAL_REPORTED_FIELDS } from "@research-cockpit/personal-financial-analytics";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  PersonalAnnualFinancials,
  type PersonalAnnualFinancialsProps,
} from "./PersonalAnnualFinancials";

describe("PersonalAnnualFinancials", () => {
  it("renders ten complete annual statements with transparent latest-year metrics", () => {
    const markup = render(
      defaultProps({
        financials: financials(
          Array.from({ length: 10 }, (_, offset) =>
            financialYear(2029 - offset, annualValues(2029 - offset)),
          ),
        ),
        selection: selection(),
      }),
    );
    const text = visibleText(markup);

    expect(markup).toContain(
      'aria-labelledby="personal-annual-financials-title"',
    );
    expect(markup).toContain('aria-busy="false"');
    expect(text).toContain("Annual periods returned 10 / 10");
    expect(text).toContain("Reported values known 300 / 300");
    expect(text).not.toContain("Missing annual years");
    expect(text).toContain("Income statement · USD · newest to oldest");
    expect(text).toContain("FY 2029 Statement date Feb 15, 2030");
    expect(text).toContain("Annual statements loaded for ZERO");
    expect(text).toContain("Refresh annual financials");
    expect(markup).toContain(
      'aria-label="Income statement financial statement table"',
    );
    expect(markup).toContain('role="region"');
    expect(markup).toContain('tabindex="0"');
    expect(text).toContain("Balance sheet · USD · newest to oldest");
    expect(text).toContain("Cash flow · USD · newest to oldest");
    expect(text).toContain("Gross margin 40.00% FY 2029");
    expect(text).toContain("Operating margin 20.00% FY 2029");
    expect(text).toContain("Net debt −$200.00 Net cash position");
    expect(text).toContain("Revenue growth +25.00% FY 2028 → FY 2029");
    expect(text).toContain("Free-cash-flow growth +50.00%");
    expect(text).toContain("gross_profit / revenue * 100");
    expect(text).toContain("inputs 2029:gross_profit + 2029:revenue");
    expect(text).toContain("(current_revenue / prior_revenue - 1) * 100");
    expect(text).toContain("inputs 2029:revenue + 2028:revenue");
    expect(text).toContain("exact decimal arithmetic");
    expect(text).toContain("provider's most-recent corrected history");
  });

  it("leaves missing years and unknown provider cells visibly blank", () => {
    const latest = financialYear(2029, annualValues(2029), {
      gross_profit: unknownCell(),
    });
    const older = financialYear(2027, annualValues(2027));
    const markup = render(
      defaultProps({
        financials: financials([latest, older]),
        selection: selection(),
      }),
    );
    const text = visibleText(markup);

    expect(text).toContain("Annual periods returned 2 / 10");
    expect(text).toContain("Reported values known 59 / 60");
    expect(text).toContain(
      "Missing annual years: 2028, 2026, 2025, 2024, 2023, 2022, 2021, 2020",
    );
    expect(text).toContain("later years are never shifted into their place");
    expect(markup).toContain(
      'aria-label="Gross profit unknown for fiscal year 2029"',
    );
    expect(markup).toContain('aria-label="Fiscal year 2028 not returned"');
    expect(text).toContain(
      "Gross margin Unknown Required reported input is missing",
    );
    expect(text).toContain(
      "Revenue growth Unknown The latest two annual periods are not consecutive",
    );
    expect(text).not.toContain("Gross margin 40.00%");
  });

  it("distinguishes a fundamentals entitlement from credential and provider failures", () => {
    const entitledMarkup = render(
      defaultProps({
        errorCode: "not_entitled",
        selection: selection(),
      }),
    );
    const credentialMarkup = render(
      defaultProps({
        errorCode: "credentials_invalid",
        selection: selection(),
      }),
    );

    expect(entitledMarkup).toContain('role="alert"');
    expect(visibleText(entitledMarkup)).toContain(
      "Annual financials are not included for this account",
    );
    expect(visibleText(entitledMarkup)).toContain(
      "The price feed can still work",
    );
    expect(visibleText(entitledMarkup)).toContain(
      "eligible evaluation symbol or fundamentals entitlement",
    );
    expect(visibleText(entitledMarkup)).toContain("Retry annual financials");
    expect(visibleText(entitledMarkup)).toContain(
      "No reported or derived value was substituted",
    );

    expect(visibleText(credentialMarkup)).toContain(
      "The provider credential was rejected",
    );
    expect(visibleText(credentialMarkup)).toContain(
      "Replace the owner-local provider credential before retrying",
    );
    expect(visibleText(credentialMarkup)).not.toContain(
      "fundamentals entitlement",
    );
  });

  it("exposes an announced loading state and readable no-selection guidance", () => {
    const loadingMarkup = render(
      defaultProps({
        requestState: "loading",
        selection: selection(),
      }),
    );
    const emptyMarkup = render(defaultProps());

    expect(loadingMarkup).toContain('aria-busy="true"');
    expect(loadingMarkup).toContain('aria-live="polite"');
    expect(loadingMarkup).toContain("disabled");
    expect(visibleText(loadingMarkup)).toContain(
      "Loading annual statements for ZERO",
    );
    expect(visibleText(loadingMarkup)).toContain("Loading annual financials");
    expect(visibleText(emptyMarkup)).toContain(
      "Choose a security to inspect its financials",
    );
    expect(visibleText(emptyMarkup)).toContain(
      "request annual statements for that exact admitted listing",
    );
  });

  it("distinguishes an unavailable provider status from explicit configuration", () => {
    const unavailableMarkup = render(
      defaultProps({ providerStatus: null, selection: selection() }),
    );
    const unconfiguredMarkup = render(
      defaultProps({
        providerStatus: providerStatus("not_configured"),
        selection: selection(),
      }),
    );

    expect(visibleText(unavailableMarkup)).toContain(
      "Provider status is unavailable. Revalidate the owner session",
    );
    expect(visibleText(unavailableMarkup)).not.toContain(
      "Configure the owner-local Tiingo credential",
    );
    expect(visibleText(unconfiguredMarkup)).toContain(
      "Configure the owner-local Tiingo credential",
    );
    expect(visibleText(unconfiguredMarkup)).toContain("Load annual financials");
  });
});

function defaultProps(
  overrides: Partial<PersonalAnnualFinancialsProps> = {},
): PersonalAnnualFinancialsProps {
  return {
    errorCode: null,
    financials: null,
    onLoad: vi.fn(),
    providerStatus: providerStatus(),
    requestState: "idle",
    selection: null,
    ...overrides,
  };
}

function financials(
  years: readonly PersonalAnnualFinancialsDto["years"][number][],
): PersonalAnnualFinancialsDto {
  const latestFiscalYear = years[0]?.fiscalYear;
  const earliestFiscalYear = years.at(-1)?.fiscalYear;
  if (latestFiscalYear === undefined || earliestFiscalYear === undefined) {
    throw new Error("The test fixture requires at least one annual period.");
  }
  const presentYears = new Set(years.map(({ fiscalYear }) => fiscalYear));
  const missingFiscalYears = Array.from(
    { length: 10 },
    (_, offset) => latestFiscalYear - offset,
  ).filter((fiscalYear) => !presentYears.has(fiscalYear));
  const cells = years.flatMap((year) => Object.values(year.reported));
  const unknownReportedCells = cells.filter(
    (cell) => cell.status === "unknown",
  ).length;

  return {
    asOf: "2030-01-16T15:00:00.000Z",
    coverage: {
      earliestFiscalYear,
      knownReportedCells: cells.length - unknownReportedCells,
      latestFiscalYear,
      missingFiscalYears,
      requestedAnnualYears: 10,
      returnedAnnualYears: years.length,
      status:
        missingFiscalYears.length === 0 && unknownReportedCells === 0
          ? "complete"
          : "partial",
      unknownReportedCells,
    },
    profile: "personal_single_user_local_fundamentals",
    provider: financialsProvider(),
    schemaVersion: "1.1.0",
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common Stock",
      symbol: "ZERO",
    },
    status: "available",
    years,
  };
}

function financialYear(
  fiscalYear: number,
  values: Readonly<
    Partial<Record<PersonalAnnualFinancialReportedFieldKeyDto, string>>
  >,
  overrides: Readonly<
    Partial<
      Record<
        PersonalAnnualFinancialReportedFieldKeyDto,
        PersonalAnnualFinancialReportedValuesDto[PersonalAnnualFinancialReportedFieldKeyDto]
      >
    >
  > = {},
): PersonalAnnualFinancialsDto["years"][number] {
  const reported = Object.fromEntries(
    PERSONAL_FINANCIAL_REPORTED_FIELDS.map(({ fieldKey }) => [
      fieldKey,
      overrides[fieldKey] ?? knownCell(values[fieldKey] ?? "1"),
    ]),
  ) as PersonalAnnualFinancialReportedValuesDto;
  return {
    fiscalYear,
    reported,
    statementDate: `${String(fiscalYear + 1)}-02-15`,
  };
}

function annualValues(
  fiscalYear: number,
): Readonly<
  Partial<Record<PersonalAnnualFinancialReportedFieldKeyDto, string>>
> {
  if (fiscalYear === 2029) {
    return {
      assets: "2000",
      cash: "500",
      debt: "300",
      free_cash_flow: "150",
      gross_profit: "400",
      net_income: "100",
      operating_cash_flow: "250",
      operating_income: "200",
      revenue: "1000",
    };
  }
  if (fiscalYear === 2028) {
    return {
      assets: "1800",
      cash: "450",
      debt: "280",
      free_cash_flow: "100",
      gross_profit: "320",
      net_income: "80",
      operating_cash_flow: "200",
      operating_income: "160",
      revenue: "800",
    };
  }
  return {
    assets: "1600",
    cash: "400",
    debt: "250",
    free_cash_flow: "90",
    gross_profit: "300",
    net_income: "70",
    operating_cash_flow: "180",
    operating_income: "140",
    revenue: "750",
  };
}

function knownCell(value: string) {
  return { status: "known" as const, value };
}

function unknownCell() {
  return {
    reason: "not_supplied_by_provider" as const,
    status: "unknown" as const,
    value: null,
  };
}

function selection() {
  return {
    exchangeMic: "XNAS",
    issuerName: "Zero Alpha, Inc.",
    listingId: "lst-zero",
    securityName: "Zero Alpha Common Stock",
    symbol: "ZERO",
  };
}

function providerStatus(
  status: PersonalMarketDataStatusDto["status"] = "configured",
): PersonalMarketDataStatusDto {
  return {
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
    status,
  };
}

function financialsProvider(): PersonalAnnualFinancialsDto["provider"] {
  return {
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
  };
}

function render(props: PersonalAnnualFinancialsProps): string {
  return renderToStaticMarkup(<PersonalAnnualFinancials {...props} />);
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
