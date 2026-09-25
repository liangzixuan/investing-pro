import type {
  PersonalAnnualFinancialReportedValuesDto,
  PersonalAnnualFinancialsDto,
} from "@research-cockpit/contracts";
import { PERSONAL_FINANCIAL_REPORTED_FIELDS } from "@research-cockpit/personal-financial-analytics";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PersonalCompanyKeyStatistics,
  type PersonalCompanyKeyStatisticsProps,
} from "./PersonalCompanyKeyStatistics";
import type { PersonalMarketSelection } from "./PersonalMarketOverview";

const selection: PersonalMarketSelection = {
  country: "US",
  exchangeMic: "XNAS",
  issuerId: "issuer-synthetic",
  issuerName: "Synthetic Company",
  listingId: "listing-synthetic",
  securityName: "Synthetic Common Stock",
  symbol: "SYN",
};
const values = {
  revenue: "200",
  operating_income: "40",
  net_income: "-10",
  operating_cash_flow: "60",
  debt: "30",
  cash: "50",
  assets: "100",
};
function financials(
  priorFiscalYear: number | null = 2024,
  overrides: Partial<PersonalAnnualFinancialReportedValuesDto> = {},
): PersonalAnnualFinancialsDto {
  const year = (fiscalYear: number, prior: boolean) => ({
    fiscalYear,
    statementDate: `${String(fiscalYear + 1)}-02-17`,
    reported: Object.fromEntries(
      PERSONAL_FINANCIAL_REPORTED_FIELDS.map(({ fieldKey }) => [
        fieldKey,
        (!prior && overrides[fieldKey]) || {
          status: "known",
          value:
            fieldKey === "revenue" && prior
              ? "100"
              : (values[fieldKey as keyof typeof values] ?? "1"),
        },
      ]),
    ) as PersonalAnnualFinancialReportedValuesDto,
  });
  const years = [
    year(2025, false),
    ...(priorFiscalYear === null ? [] : [year(priorFiscalYear, true)]),
  ];
  const cells = years.flatMap((item) => Object.values(item.reported));
  return {
    schemaVersion: "1.1.0",
    status: "available",
    profile: "personal_single_user_local_fundamentals",
    asOf: "2026-09-25T12:34:56.000Z",
    security: {
      country: selection.country,
      exchangeMic: selection.exchangeMic,
      issuerName: selection.issuerName,
      listingId: selection.listingId,
      securityName: selection.securityName,
      symbol: selection.symbol,
    },
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
    coverage: {
      earliestFiscalYear: priorFiscalYear ?? 2025,
      latestFiscalYear: 2025,
      requestedAnnualYears: 10,
      returnedAnnualYears: years.length,
      missingFiscalYears: Array.from(
        { length: 10 },
        (_, index) => 2025 - index,
      ).filter((fy) => !years.some((item) => item.fiscalYear === fy)),
      knownReportedCells: cells.filter((cell) => cell.status === "known")
        .length,
      unknownReportedCells: cells.filter((cell) => cell.status === "unknown")
        .length,
      status: "partial",
    },
    years,
  };
}
function props(
  overrides: Partial<PersonalCompanyKeyStatisticsProps> = {},
): PersonalCompanyKeyStatisticsProps {
  return {
    selection,
    annualFinancials: null,
    annualErrorCode: null,
    busy: false,
    ...overrides,
  };
}
const render = (overrides: Partial<PersonalCompanyKeyStatisticsProps> = {}) =>
  renderToStaticMarkup(<PersonalCompanyKeyStatistics {...props(overrides)} />);
const text = (markup: string) =>
  markup.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ");

describe("PersonalCompanyKeyStatistics", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("keeps entry idle with existing loader guidance and no new action", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const markup = render();
    expect(text(markup)).toContain("Use Load company overview above");
    expect(markup).toContain('href="#personal-annual-financials-title"');
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("<dl");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("asks for a selection without exposing mismatched values", () => {
    const markup = render({ selection: null, annualFinancials: financials() });
    expect(text(markup)).toContain("Choose a company");
    expect(markup).not.toContain("<dl");
  });
  it("renders six existing metrics with independent period and history coverage", () => {
    const markup = render({ annualFinancials: financials() });
    const body = text(markup);
    expect(body).toContain("20.00%");
    expect(body).toContain("-5.00%");
    expect(body).toContain("30.00%");
    expect(body).toContain("−$20.00");
    expect(body).toContain("100.00%");
    expect(body).toContain("6 of 6 selected metrics available");
    expect(body).toContain("2 of 10 fiscal years returned");
    expect(body).toContain("8 fiscal years are missing");
    expect(body).toContain("FY 2025");
    expect(body).toContain("2026-02-17");
    expect(body).toContain("2026-09-25T12:34:56.000Z");
    expect(body).toContain("FY 2024 to FY 2025");
    expect(body).toContain("2025:operating_income");
    expect(markup.match(/<details /gu)).toHaveLength(6);
    expect(markup.match(/<summary /gu)).toHaveLength(6);
    expect(markup).toContain(
      'aria-label="Operating margin: formula and sources"',
    );
    expect(markup).not.toContain("<details open");
    expect(body).not.toContain("P/E");
  });
  it("does not substitute an older known numerator for a missing latest value", () => {
    const source = financials(2024, {
      operating_income: {
        status: "unknown",
        reason: "not_supplied_by_provider",
        value: null,
      },
    });
    const body = text(render({ annualFinancials: source }));
    expect(body).toContain("5 of 6 selected metrics available");
    expect(body).toContain("Required annual input is missing");
    expect(body).toContain("missing_input");
    expect(body).not.toContain("20.00%");
  });
  it("shows the actual nonconsecutive year pair and its unavailable growth", () => {
    const body = text(render({ annualFinancials: financials(2023) }));
    expect(body).toContain("FY 2023 to FY 2025");
    expect(body).toContain("The available fiscal years are not consecutive");
    expect(body).toContain("non_consecutive_fiscal_years");
    expect(body).toContain("5 of 6 selected metrics available");
  });
  it("keeps a single latest year usable while growth lacks a prior period", () => {
    const body = text(render({ annualFinancials: financials(null) }));
    expect(body).toContain("5 of 6 selected metrics available");
    expect(body).toContain("A prior annual period is missing");
    expect(body).toContain("1 of 10 fiscal years returned");
  });
  it("distinguishes exact zero from a zero denominator", () => {
    const body = text(
      render({
        annualFinancials: financials(2024, {
          operating_income: { status: "known", value: "0" },
          assets: { status: "known", value: "0" },
        }),
      }),
    );
    expect(body).toContain("0.00%");
    expect(body).toContain("The denominator is zero");
    expect(body).toContain("zero_denominator");
  });
  it.each([
    "listingId",
    "issuerName",
    "securityName",
    "symbol",
    "exchangeMic",
    "country",
  ] as const)("withholds mismatched %s source", (field) => {
    const source = financials();
    const markup = render({
      annualFinancials: {
        ...source,
        security: { ...source.security, [field]: "different" },
      },
    });
    expect(text(markup)).toContain("do not match this company");
    expect(markup).not.toContain("<dl");
  });
  it("retains good dated data on a failed refresh without a new request", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const source = financials();
    const before = JSON.stringify(source);
    const markup = render({
      annualFinancials: source,
      annualErrorCode: "provider_unavailable",
    });
    expect(text(markup)).toContain(
      "Previously loaded annual statistics remain visible",
    );
    expect(text(markup)).toContain("Annual refresh did not complete");
    expect(markup).toContain('role="alert"');
    expect(text(markup)).toContain("6 of 6 selected metrics available");
    expect(JSON.stringify(source)).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps retained values while the shared company request is busy", () => {
    const markup = render({ annualFinancials: financials(), busy: true });
    expect(markup).toContain('aria-busy="true"');
    expect(text(markup)).toContain("Previously loaded annual statistics");
    expect(text(markup)).toContain("6 of 6");
  });
  it("explains catalog conflict instead of silently showing an empty panel", () => {
    expect(text(render({ annualErrorCode: "conflict" }))).toContain(
      "Re-select the company",
    );
  });
});
