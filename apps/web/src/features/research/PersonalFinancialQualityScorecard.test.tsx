import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialReportedValuesDto,
  PersonalAnnualFinancialsDto,
} from "@research-cockpit/contracts";
import { PERSONAL_FINANCIAL_REPORTED_FIELDS } from "@research-cockpit/personal-financial-analytics";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PersonalFinancialQualityScorecard,
  type PersonalFinancialQualityScorecardProps,
} from "./PersonalFinancialQualityScorecard";

describe("PersonalFinancialQualityScorecard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tells the owner to select a company and load its annual financials", () => {
    const noSelection = render();
    const noFinancials = render({ selection: selection() });

    expect(visibleText(noSelection)).toContain(
      "Select a company and load annual financials",
    );
    expect(visibleText(noSelection)).toContain(
      "then load annual financials for that exact admitted listing",
    );
    expect(visibleText(noFinancials)).toContain(
      "Load annual financials for ZERO",
    );
    expect(visibleText(noFinancials)).toContain(
      "load provider-reported annual statements before running these checks",
    );
    expect(noSelection).not.toContain("<table");
    expect(noFinancials).not.toContain("<table");
  });

  it("renders the golden twelve-check result with exact grouped counts", () => {
    const markup = render({
      financials: financials([
        financialYear(2029, strongValues("current")),
        financialYear(2028, strongValues("prior")),
      ]),
      selection: selection(),
    });
    const text = visibleText(markup);

    expect(text).toContain("12 met · 0 not met · 0 unavailable");
    expect(text).toContain("Checks evaluated 12 / 12");
    expect(text).toContain("Profitability & cash");
    expect(text).toContain("Growth & efficiency");
    expect(text).toContain("Balance sheet");
    expect(markup.match(/data-status="met"/gu)).toHaveLength(12);
    expect(text).toContain("ZERO annual diagnostic is ready");
    expect(text).toContain("provider-most-recent basis");
    expect(text).toContain("source response 2030-03-01T15:00:00.000Z");
    expect(text).toContain("calculated in browser memory");
  });

  it("shows missing checks, formulas, periods, and exact source references", () => {
    const latest = financialYear(2029, strongValues("current"), {
      free_cash_flow: unknownCell(),
    });
    const prior = financialYear(2028, strongValues("prior"));
    const markup = render({
      financials: financials([latest, prior]),
      selection: selection(),
    });
    const text = visibleText(markup);

    expect(text).toContain("unavailable");
    expect(text).toContain("Unavailable");
    expect(text).toContain("Reason: Missing input (missing_input)");
    expect(text).toContain("Exact test");
    expect(text).toContain("formula 1.0.0");
    expect(text).toContain("FY 2029");
    expect(text).toContain("FY 2028");
    expect(text).toContain("revenue ← 2029:revenue");
    expect(text).toContain("revenue ← 2028:revenue");
    expect(text).toContain("free_cash_flow");
    expect(text).toContain("Statement 2030-02-15");
  });

  it("distinguishes a transparent not-met test from unavailable data", () => {
    const markup = render({
      financials: financials([
        financialYear(2029, {
          ...strongValues("current"),
          net_income: "-10",
        }),
        financialYear(2028, strongValues("prior")),
      ]),
      selection: selection(),
    });
    const text = visibleText(markup);

    expect(text).toContain("11 met · 1 not met · 0 unavailable");
    expect(markup).toContain('data-status="not_met"');
    expect(markup).toContain('aria-label="Positive net income: Not met"');
    expect(text).toContain("net_income > 0");
    expect(text).toContain("FY 2029 · USD -10");
    expect(text).not.toContain("Reason: Missing input");
  });

  it("withholds every derived value when the engine quarantines the source packet", () => {
    const duplicate = financialYear(2029, {
      ...strongValues("current"),
      revenue: "999999123456",
    });
    const markup = render({
      financials: financials([duplicate, duplicate]),
      selection: selection(),
    });
    const text = visibleText(markup);

    expect(markup).toContain('role="alert"');
    expect(text).toContain("Financial quality checks were withheld");
    expect(text).toContain("No derived check, count, or observation is shown");
    expect(text).toContain("duplicate_fiscal_year");
    expect(text).not.toContain("999999123456");
    expect(text).not.toContain("Checks evaluated");
    expect(markup).not.toContain("data-status=");
    expect(markup).not.toContain("<table");
  });

  it("uses labelled sections, group headings, tables, row headers, and a visible methodology note", () => {
    const markup = render({
      financials: financials([
        financialYear(2029, strongValues("current")),
        financialYear(2028, strongValues("prior")),
      ]),
      selection: selection(),
    });
    const text = visibleText(markup);

    expect(markup).toContain(
      'aria-labelledby="personal-financial-quality-title"',
    );
    expect(markup).toContain(
      'aria-describedby="personal-financial-quality-intro personal-financial-quality-caveat"',
    );
    expect(markup.match(/role="region"/gu)).toHaveLength(3);
    expect(markup.match(/tabindex="0"/gu)).toHaveLength(3);
    expect(markup.match(/<table\b/gu)).toHaveLength(3);
    expect(markup).toContain('<th scope="col">Check</th>');
    expect(markup.match(/<th scope="row">/gu)).toHaveLength(12);
    expect(markup).toContain('role="note"');
    expect(text).toContain("not sector-adjusted");
    expect(text).toContain("not a Piotroski F-Score");
    expect(text).toContain("Altman Z-Score");
    expect(text).toContain("Beneish M-Score");
    expect(text).toContain("not a health grade, rating, or buy/sell signal");
    expect(text).toContain("active-session browser memory only");
    expect(text).toContain("makes no network request");
    expect(text).toContain("persists nothing");
  });

  it("does not mutate inputs, request data, or touch browser storage", () => {
    const fetch = vi.fn();
    const localStorage = {
      clear: vi.fn(),
      getItem: vi.fn(),
      key: vi.fn(),
      length: 0,
      removeItem: vi.fn(),
      setItem: vi.fn(),
    } satisfies Storage;
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("localStorage", localStorage);
    const immutableSelection = freezeDeep(selection());
    const immutableFinancials = freezeDeep(
      financials([
        financialYear(2029, strongValues("current")),
        financialYear(2028, strongValues("prior")),
      ]),
    );

    expect(() =>
      render({
        financials: immutableFinancials,
        selection: immutableSelection,
      }),
    ).not.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(Object.isFrozen(immutableFinancials)).toBe(true);
    expect(Object.isFrozen(immutableFinancials.years[0]?.reported)).toBe(true);
  });

  it("ignores financials loaded for a different listing", () => {
    const loaded = financials([
      financialYear(2029, strongValues("current")),
      financialYear(2028, strongValues("prior")),
    ]);
    const markup = render({
      financials: {
        ...loaded,
        security: { ...loaded.security, listingId: "lst-other" },
      },
      selection: selection(),
    });

    expect(visibleText(markup)).toContain(
      "loaded statements belong to a different listing and are ignored",
    );
    expect(markup).not.toContain("<table");

    const nonUsMarkup = render({
      financials: {
        ...loaded,
        security: {
          ...loaded.security,
          country: "CA",
        } as unknown as PersonalAnnualFinancialsDto["security"],
      },
      selection: selection(),
    });
    expect(visibleText(nonUsMarkup)).toContain(
      "loaded statements belong to a different listing and are ignored",
    );
    expect(nonUsMarkup).not.toContain("<table");
  });
});

function render(
  overrides: Partial<PersonalFinancialQualityScorecardProps> = {},
): string {
  return renderToStaticMarkup(
    <PersonalFinancialQualityScorecard
      financials={null}
      selection={null}
      {...overrides}
    />,
  );
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

function financials(
  years: readonly PersonalAnnualFinancialsDto["years"][number][],
): PersonalAnnualFinancialsDto {
  const latestFiscalYear = years[0]?.fiscalYear ?? 2029;
  const earliestFiscalYear = years.at(-1)?.fiscalYear ?? latestFiscalYear;
  const cells = years.flatMap((year) => Object.values(year.reported));
  const unknownReportedCells = cells.filter(
    (cell) => cell.status === "unknown",
  ).length;
  return {
    asOf: "2030-03-01T15:00:00.000Z",
    coverage: {
      earliestFiscalYear,
      knownReportedCells: cells.length - unknownReportedCells,
      latestFiscalYear,
      missingFiscalYears: [],
      requestedAnnualYears: 10,
      returnedAnnualYears: years.length,
      status: unknownReportedCells === 0 ? "complete" : "partial",
      unknownReportedCells,
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

function strongValues(
  period: "current" | "prior",
): Readonly<
  Partial<Record<PersonalAnnualFinancialReportedFieldKeyDto, string>>
> {
  return period === "current"
    ? {
        assets: "2000",
        current_assets: "800",
        current_liabilities: "400",
        debt: "300",
        free_cash_flow: "180",
        gross_profit: "500",
        net_income: "150",
        operating_cash_flow: "240",
        operating_income: "220",
        revenue: "1200",
        shareholders_equity: "1200",
      }
    : {
        assets: "1800",
        current_assets: "700",
        current_liabilities: "350",
        debt: "350",
        free_cash_flow: "140",
        gross_profit: "400",
        net_income: "120",
        operating_cash_flow: "200",
        operating_income: "180",
        revenue: "1000",
        shareholders_equity: "1050",
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
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&quot;", '"');
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
