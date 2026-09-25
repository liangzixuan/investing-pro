import type {
  PersonalAnnualFinancialReportedValuesDto,
  PersonalAnnualFinancialsDto,
  PersonalMarketOverviewDto,
} from "@research-cockpit/contracts";
import { PERSONAL_FINANCIAL_REPORTED_FIELDS } from "@research-cockpit/personal-financial-analytics";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  PersonalCompanyOverview,
  type PersonalCompanyOverviewProps,
} from "./PersonalCompanyOverview";
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
const security = {
  country: selection.country,
  exchangeMic: selection.exchangeMic,
  issuerName: selection.issuerName,
  listingId: selection.listingId,
  securityName: selection.securityName,
  symbol: selection.symbol,
};
function financials(): PersonalAnnualFinancialsDto {
  const reported = Object.fromEntries(
    PERSONAL_FINANCIAL_REPORTED_FIELDS.map(({ fieldKey }) => [
      fieldKey,
      { status: "unknown", reason: "not_supplied_by_provider", value: null },
    ]),
  ) as PersonalAnnualFinancialReportedValuesDto;
  return {
    schemaVersion: "1.1.0",
    status: "available",
    profile: "personal_single_user_local_fundamentals",
    asOf: "2026-09-25T12:34:56.000Z",
    security,
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
      earliestFiscalYear: 2025,
      latestFiscalYear: 2025,
      requestedAnnualYears: 10,
      returnedAnnualYears: 1,
      missingFiscalYears: [
        2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016,
      ],
      knownReportedCells: 2,
      unknownReportedCells: 28,
      status: "partial",
    },
    years: [
      {
        fiscalYear: 2025,
        statementDate: "2026-02-17",
        reported: {
          ...reported,
          revenue: { status: "known", value: "9007199254740993.125" },
          net_income: { status: "known", value: "0" },
        },
      },
    ],
  };
}
function market(): PersonalMarketOverviewDto {
  const window = {
    range: "1m",
    startDate: "2026-08-24",
    endDate: "2026-09-24",
  } as const;
  const ohlcv = {
    open: "10",
    high: "10",
    low: "10",
    close: "10",
    volume: "10",
  };
  return {
    schemaVersion: "2.0.0",
    profile: "personal_single_user_local_market_data",
    security,
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
    ingestedAt: "2026-09-25T12:00:00.000Z",
    window,
    history: {
      status: "available",
      value: {
        ...window,
        currency: "USD",
        bars: [
          {
            date: "2026-09-24",
            raw: ohlcv,
            adjusted: ohlcv,
            splitFactor: "1",
            dividendCash: "0",
          },
        ],
      },
    },
    quote: { status: "not_requested" },
  };
}
function props(
  overrides: Partial<PersonalCompanyOverviewProps> = {},
): PersonalCompanyOverviewProps {
  return {
    selection,
    marketOverview: null,
    annualFinancials: null,
    marketErrorCode: null,
    annualErrorCode: null,
    busy: false,
    activeDomain: null,
    action: "load",
    canLoad: true,
    deferralMessage: null,
    onLoad: vi.fn(),
    ...overrides,
  };
}
const render = (input: PersonalCompanyOverviewProps) =>
  renderToStaticMarkup(<PersonalCompanyOverview {...input} />);
const text = (value: string) =>
  value.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ");
type Element = ReactElement<{
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}
function button(input: PersonalCompanyOverviewProps) {
  const result = elements(PersonalCompanyOverview(input)).find(
    (element) => element.type === "button",
  );
  if (!result) throw Error("Expected overview action");
  return result;
}

describe("PersonalCompanyOverview", () => {
  it.each(["marketErrorCode", "annualErrorCode"] as const)(
    "explains a cleared %s catalog conflict",
    (field) => {
      const markup = render(props({ [field]: "conflict", action: "retry" }));
      expect(markup).toContain('role="alert"');
      expect(text(markup)).toContain(
        "The company catalog changed. Reload the workspace before loading again.",
      );
      expect(text(markup)).toContain("Retry company overview");
    },
  );
  it("offers one explicit load action without invoking it during render", () => {
    const input = props();
    const markup = render(input);
    expect(markup).toContain(
      'aria-labelledby="personal-company-overview-title"',
    );
    expect(markup).toContain('aria-busy="false"');
    expect(markup.match(/<button\b/gu)).toHaveLength(1);
    expect(text(markup)).toContain("Load company overview");
    expect(text(markup)).toContain(
      "Load the overview to see annual business figures",
    );
    expect(input.onLoad).not.toHaveBeenCalled();
    button(input).props.onClick?.();
    expect(input.onLoad).toHaveBeenCalledOnce();
  });

  it("shows exact known/zero/missing values with separate fiscal, statement and source dates", () => {
    const markup = render(
      props({
        annualFinancials: financials(),
        marketOverview: market(),
        action: "refresh",
      }),
    );
    expect(text(markup)).toContain("$9,007,199,254,740,993.125");
    expect(text(markup)).toContain("Net income $0");
    expect(text(markup)).toContain(
      "Operating cash flow Unknown Not supplied by provider",
    );
    expect(text(markup)).toContain("2 of 3 overview fields known for FY 2025");
    expect(text(markup)).toContain(
      "Annual history: 1 of 10 fiscal years returned. 9 fiscal years are missing.",
    );
    expect(text(markup)).toContain("Statement date 2026-02-17");
    expect(text(markup)).toContain("Retrieved 2026-09-25T12:34:56.000Z");
    expect(text(markup)).toContain("Price source bar date: 2026-09-24");
    expect(text(markup)).toContain(
      "Tiingo annual statements · USD · Provider most recent",
    );
    expect(text(markup)).toContain("not TTM or SEC-verified");
    expect(markup).toContain('href="#personal-annual-financials-title"');
    expect(markup).toContain('href="#personal-market-overview"');
  });

  it("preserves the price date when annual access fails and offers only the hook-selected retry", () => {
    const input = props({
      marketOverview: market(),
      annualErrorCode: "not_entitled",
      action: "retry",
    });
    const markup = render(input);
    expect(markup).toContain('role="alert"');
    expect(text(markup)).toContain(
      "Annual financials: This feed is not included for this account",
    );
    expect(text(markup)).toContain("Price source bar date: 2026-09-24");
    expect(text(markup)).toContain("Retry company overview");
    expect(markup).not.toContain('class="company-overview-values"');
    expect(input.onLoad).not.toHaveBeenCalled();
  });

  it("retains annual figures when the price request fails", () => {
    const markup = render(
      props({
        annualFinancials: financials(),
        marketErrorCode: "not_covered",
        action: "retry",
      }),
    );
    expect(text(markup)).toContain(
      "Price history: This feed has no data for this listing",
    );
    expect(text(markup)).toContain("$9,007,199,254,740,993.125");
    expect(text(markup)).toContain(
      "Annual financials are available. Price history is not loaded",
    );
  });

  it("keeps retained values and clocks visible during refresh while refusing another action", () => {
    const input = props({
      annualFinancials: financials(),
      marketOverview: market(),
      busy: true,
      activeDomain: "annual",
      action: "refresh",
      deferralMessage: "Refresh is available after 12:49 UTC.",
    });
    const markup = render(input);
    expect(markup).toContain('aria-busy="true"');
    expect(text(markup)).toContain("Loading annual financials");
    expect(text(markup)).not.toContain("Refresh is available after 12:49 UTC");
    expect(text(markup)).toContain(
      "Previous annual figures remain visible with their original dates",
    );
    expect(text(markup)).toContain(
      "Previous price history remains visible with its original dates",
    );
    expect(text(markup)).toContain("2026-09-25T12:34:56.000Z");
    expect(button(input).props.disabled).toBe(true);
    button(input).props.onClick?.();
    expect(input.onLoad).not.toHaveBeenCalled();
  });

  it("labels retained annual data after failed refresh without claiming a new observation", () => {
    const markup = render(
      props({
        annualFinancials: financials(),
        annualErrorCode: "provider_unavailable",
        action: "retry",
      }),
    );
    expect(text(markup)).toContain(
      "Previous annual figures remain visible with their original dates",
    );
    expect(text(markup)).toContain("Retrieved 2026-09-25T12:34:56.000Z");
    expect(text(markup)).toContain("The provider is unavailable. Retry later");
  });

  it("shows a shared pacing deferral and does not call a disabled action", () => {
    const input = props({
      annualFinancials: financials(),
      canLoad: false,
      action: "refresh",
      deferralMessage: "Refresh is available after 12:49 UTC.",
    });
    const markup = render(input);
    expect(text(markup)).toContain("Refresh is available after 12:49 UTC");
    expect(markup).toContain('role="status"');
    button(input).props.onClick?.();
    expect(input.onLoad).not.toHaveBeenCalled();
    expect(text(markup)).toContain("Retrieved 2026-09-25T12:34:56.000Z");
  });

  it("rejects mismatched annual and price identities without exposing their values or dates", () => {
    const markup = render(
      props({
        selection: { ...selection, listingId: "another-listing" },
        annualFinancials: financials(),
        marketOverview: market(),
      }),
    );
    expect(text(markup)).toContain(
      "The loaded annual financials do not match this company",
    );
    expect(text(markup)).toContain(
      "The loaded price history does not match this company",
    );
    expect(markup).not.toContain("9,007,199");
    expect(markup).not.toContain('datetime="2026-09-24"');
  });

  it("does not present numbers from quarantined annual input", () => {
    const data = financials();
    const markup = render(
      props({
        annualFinancials: { ...data, years: [...data.years, ...data.years] },
      }),
    );
    expect(text(markup)).toContain("The annual input did not pass validation");
    expect(markup).not.toContain("9,007,199");
  });

  it("separates access refusal from an entitlement conclusion", () => {
    const markup = render(
      props({ annualErrorCode: "access_denied", action: "retry" }),
    );
    expect(text(markup)).toContain("The provider denied access");
    expect(markup).not.toContain("not included for this account");
  });

  it("shows no company action or data when selection is absent", () => {
    const input = props({
      selection: null,
      annualFinancials: financials(),
      marketOverview: market(),
    });
    const markup = render(input);
    expect(text(markup)).toContain("Choose a company");
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("9,007,199");
    expect(input.onLoad).not.toHaveBeenCalled();
  });
});
