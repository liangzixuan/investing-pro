import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialsDto,
  PersonalMarketDataIdentityDto,
  PersonalMarketOverviewDto,
  PersonalValuationHistoryDto,
} from "@research-cockpit/contracts";
import {
  PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
  PERSONAL_FCFF_DCF_MAXIMUM_DECIMAL_LENGTH,
} from "@research-cockpit/personal-market-analytics";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalFcffDcfValuation,
  type PersonalFcffDcfValuationProps,
} from "./PersonalFcffDcfValuation";

const stateHarness = vi.hoisted(() => {
  let state: unknown;
  return {
    reset() {
      state = undefined;
    },
    set(next: unknown) {
      state = next;
    },
    useState: (initial: unknown) => {
      if (state === undefined) {
        state =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      }
      return [
        state,
        (next: unknown) => {
          state =
            typeof next === "function"
              ? (next as (current: unknown) => unknown)(state)
              : next;
        },
      ];
    },
  };
});

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  useState: (initial: unknown) => stateHarness.useState(initial),
}));

beforeEach(() => stateHarness.reset());

describe("PersonalFcffDcfValuation", () => {
  it("starts with explicit selection guidance and the permanent decision limits", () => {
    const markup = render({
      annualFinancials: null,
      marketOverview: null,
      selection: null,
      valuationHistory: null,
    });

    expect(markup).toContain("Choose a security to build cash-flow scenarios");
    expect(markup).toContain("starting unlevered FCF proxy is mechanical");
    expect(markup).toContain("not audited FCFF");
    expect(markup).toContain("not appropriate for banks or insurers");
    expect(markup).toContain("REITs");
    expect(markup).toContain("not point-in-time or as-reported history");
    expect(markup).toContain("makes no fetch, persists nothing");
    expect(markup).toContain('aria-live="polite"');
  });

  it("shows each missing source and links back to its explicit loader", () => {
    const markup = render(
      defaultProps({
        annualFinancials: null,
        marketOverview: null,
        valuationHistory: null,
      }),
    );

    expect(markup).toContain("Load ZERO price history");
    expect(markup.match(/Not loaded/gu)).toHaveLength(3);
    expect(markup).toContain('href="#personal-market-overview"');
    expect(markup).toContain('href="#personal-valuation-history-title"');
    expect(markup).toContain('href="#personal-annual-financials-title"');
    expect(markup).toContain(
      "No DCF value, implied growth, sensitivity value, or recommendation was substituted",
    );
  });

  it("renders all forward, reverse, sensitivity, provenance, and formula context from exact loaded inputs", () => {
    const markup = render(defaultProps());

    expect(markup).toContain("Starting unlevered FCF proxy");
    expect(markup).toContain("$1,079.00");
    expect(markup).toContain("Market reference");
    expect(markup).toContain("$100.00");
    expect(markup).not.toContain("$999.00");
    expect(markup).toContain("Quote-consistent share-count proxy");
    expect(markup).toContain("100.000000");
    expect(markup).toContain("Conservative scenario");
    expect(markup).toContain("Base scenario");
    expect(markup).toContain("Expansion scenario");
    expect(markup).toContain("Projection and present-value bridge");
    expect(markup).toContain("Market-implied constant annual FCF-proxy growth");
    expect(markup).toContain("Cent-tie-out solver rate (audit)");
    expect(markup).toContain("It is not a forecast");
    expect(markup).toContain("WACC × terminal-growth sensitivity");
    expect(markup).toContain(
      "Base-scenario implied price per share; WACC by terminal growth",
    );
    expect(markup.match(/<td/gu)).toHaveLength(25);
    expect(markup).toContain('aria-label="Selected assumptions:');
    expect(markup).toContain("Signed reported FCF");
    expect(markup).toContain("−$100.00");
    expect(markup).toContain("its magnitude is $100.00");
    expect(markup).toContain("marginal tax-shield rate assumption");
    expect(markup).toContain("Provider EV-to-equity bridge");
    expect(markup).toContain("Exact source operands");
    expect(markup).toContain("<code>100</code> USD");
    expect(markup).toContain("provider statement date Dec 31, 2029");
    expect(markup).toContain(
      "reported_fcf_plus_after_tax_interest_mechanical_proxy",
    );
    expect(markup).toContain("perpetual_growth_terminal_value");
    expect(markup).toContain("Formula set 1.0.0 · result schema 1.0.0");
    expect(markup).toContain(
      'aria-label="ZERO unlevered FCF-proxy DCF scenarios"',
    );
    expect(markup).toContain('aria-label="ZERO base DCF sensitivity table"');
    expect(markup).toContain('role="region"');
    expect(markup).toContain("Reset illustrative assumptions");
    expect(markup).toContain('id="fcff-dcf-horizon"');
    expect(markup).toContain('value="5"');
    expect(markup).toContain('id="fcff-dcf-tax-rate"');
    expect(markup).toContain('value="21"');
    expect(markup).toContain("Allowed: 1 to 30 %; up to 4 decimal places.");
    expect(markup).toContain("WACC assumption");
    expect(markup).toContain("Allowed: -2 to 5 %; up to 4 decimal places.");
    expect(markup).toContain(
      'aria-describedby="fcff-dcf-wacc-range personal-fcff-dcf-assumption-guidance"',
    );
    expect(markup).toMatch(/id="fcff-dcf-wacc"[^>]*type="text"/u);
    expect(markup).toMatch(/id="fcff-dcf-horizon"[^>]*maxLength="2"/u);
    expect(markup).toMatch(/id="fcff-dcf-wacc"[^>]*maxLength="64"/u);
    expect(markup).toContain('id="fcff-dcf-conservative-growth"');
    expect(markup).toContain('id="fcff-dcf-base-growth"');
    expect(markup).toContain('id="fcff-dcf-expansion-growth"');
  });

  it("fails closed when the three loaded DTOs agree with each other but not the selected listing", () => {
    const other = identity({
      issuerName: "Other Issuer, Inc.",
      listingId: "lst-other",
      securityName: "OTHER Common Stock",
      symbol: "OTHER",
    });
    const markup = render(
      defaultProps({
        annualFinancials: annualFinancials(other),
        marketOverview: marketOverview(other),
        valuationHistory: valuationHistory(other),
      }),
    );

    expect(markup).toContain("Loaded inputs describe different listings");
    expect(markup.match(/Different listing/gu)).toHaveLength(3);
    expect(markup).not.toContain("Conservative scenario");
    expect(markup).not.toContain("WACC × terminal-growth sensitivity");
  });

  it("names unavailable annual inputs without substituting zero", () => {
    const annuals = annualFinancials();
    const markup = render(
      defaultProps({
        annualFinancials: {
          ...annuals,
          years: [
            {
              ...annuals.years[0]!,
              reported: {
                ...annuals.years[0]!.reported,
                interest_expense: unknownAnnualCell(),
              },
            },
          ],
        },
      }),
    );

    expect(markup).toContain("A required annual input is unavailable");
    expect(markup).toContain("Missing annual inputs: interest expense");
    expect(markup).not.toContain("Conservative scenario");
  });

  it("rejects annual information that occurs after the exact market reference date", () => {
    const annuals = annualFinancials();
    const markup = render(
      defaultProps({
        annualFinancials: {
          ...annuals,
          asOf: "2030-01-16T21:00:00.000Z",
          years: [{ ...annuals.years[0]!, statementDate: "2030-01-16" }],
        },
      }),
    );

    expect(markup).toContain(
      "annual statement is later than the market reference date",
    );
    expect(markup).toContain("will not combine a future annual statement");
    expect(markup).not.toContain("Base-scenario implied price");
  });

  it("warns when the computed WACC spread is valid but narrower than one percentage point", () => {
    stateHarness.set(
      draftAssumptions({
        terminalGrowthPercent: "5",
        waccPercent: "5.5",
      }),
    );

    const markup = render(defaultProps());

    expect(markup).toContain(
      "WACC is less than 1.00 percentage point above terminal growth",
    );
    expect(markup).toContain("valid but highly sensitive");
    expect(markup).toContain("Computed DCF assumptions");
    expect(markup).toContain("5.5000%");
    expect(markup).toContain("5.0000%");
    expect(markup).toContain(
      "Unavailable sensitivity: WACC must be greater than terminal growth.",
    );
    expect(markup).toContain(
      "Unavailable sensitivity: WACC or terminal growth is outside the global model bounds.",
    );
    expect(markup).toContain(
      "when either sensitivity rate leaves the global model bounds",
    );
  });

  it.each([
    { expected: false, terminalGrowthPercent: "3.1", waccPercent: "4.1" },
    { expected: true, terminalGrowthPercent: "3.1", waccPercent: "4.0999" },
  ])(
    "handles the exact one-percentage-point warning boundary without binary-float drift: $waccPercent vs $terminalGrowthPercent",
    ({ expected, terminalGrowthPercent, waccPercent }) => {
      stateHarness.set(
        draftAssumptions({
          terminalGrowthPercent,
          waccPercent,
        }),
      );

      const markup = render(defaultProps());
      const warning =
        "WACC is less than 1.00 percentage point above terminal growth";

      if (expected) expect(markup).toContain(warning);
      else expect(markup).not.toContain(warning);
    },
  );

  it("requires ordered independently editable scenario growth rates without auto-sorting", () => {
    stateHarness.set(
      draftAssumptions({
        scenarios: {
          conservative: { annualFcfProxyGrowthPercent: "10" },
          base: { annualFcfProxyGrowthPercent: "5" },
          expansion: { annualFcfProxyGrowthPercent: "0" },
        },
      }),
    );

    const markup = render(defaultProps());

    expect(markup).toContain(
      "Order growth from conservative through expansion",
    );
    expect(markup).toContain("does not auto-sort owner assumptions");
    expect(markup).not.toContain("Conservative scenario");
  });

  it("does not call the strict model with an incomplete editable decimal", () => {
    stateHarness.set(
      draftAssumptions({
        scenarios: {
          ...PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS.scenarios,
          base: { annualFcfProxyGrowthPercent: "" },
        },
      }),
    );

    const markup = render(defaultProps());

    expect(markup).toContain("Finish entering valid assumptions");
    expect(markup).toContain("no stale result is retained while you edit");
    expect(markup).not.toContain("Base-scenario implied price");
  });

  it("does not call the strict model with an oversized or over-precise editable rate", () => {
    for (const waccPercent of [
      "1".repeat(PERSONAL_FCFF_DCF_MAXIMUM_DECIMAL_LENGTH + 1),
      "5.00001",
    ]) {
      stateHarness.set(
        draftAssumptions({
          waccPercent,
        }),
      );

      const markup = render(defaultProps());

      expect(markup).toContain("Finish entering valid assumptions");
      expect(markup).toContain("ordinary decimal notation");
      expect(markup).toContain("no more than four decimal places");
      expect(markup).not.toContain("Base-scenario implied price");
    }
  });

  it("wires editable drafts, valid resumption, and reset through the actual control callbacks", () => {
    const props = defaultProps();
    changeControl(props, "fcff-dcf-wacc", "-");

    let markup = render(props);
    expect(markup).toContain("Finish entering valid assumptions");
    expect(markup).toContain('id="fcff-dcf-wacc"');
    expect(markup).toContain('value="-"');
    expect(markup).not.toContain("Base-scenario implied price");

    changeControl(props, "fcff-dcf-wacc", "9.5");
    markup = render(props);
    expect(markup).toContain("Base-scenario implied price");
    expect(markup).toContain('value="9.5"');

    changeControl(props, "fcff-dcf-horizon", "");
    markup = render(props);
    expect(markup).toContain("Finish entering valid assumptions");
    expect(markup).not.toContain('value="NaN"');
    expect(markup).not.toContain("Base-scenario implied price");

    changeControl(props, "fcff-dcf-horizon", "10");
    markup = render(props);
    expect(markup).toContain("Base-scenario implied price");
    expect(markup).toContain('value="10"');

    clickControl(props, "Reset illustrative assumptions");
    markup = render(props);
    expect(markup).toMatch(/id="fcff-dcf-horizon"[^>]*value="5"/u);
    expect(markup).toMatch(/id="fcff-dcf-wacc"[^>]*value="10"/u);
    expect(markup).toContain("Base-scenario implied price");
  });

  it.each(["", "-", "5.5", "1e1", "0xA", " 10"])(
    "keeps invalid forecast-horizon draft %j visible and out of the strict model",
    (forecastYears) => {
      stateHarness.set(draftAssumptions({ forecastYears }));

      const markup = render(defaultProps());

      expect(markup).toContain("Finish entering valid assumptions");
      expect(markup).toContain(
        "forecast horizon with an ordinary whole number",
      );
      expect(markup).toContain("no stale result is retained while you edit");
      expect(markup).not.toContain("Base-scenario implied price");
      expect(markup).not.toContain('value="NaN"');
    },
  );

  it("explains nonpositive residual-equity sensitivity cells", () => {
    const valuation = valuationHistory();
    const point = {
      ...valuation.history.points[0]!,
      enterpriseValue: knownMoney("1000000"),
    };
    const markup = render(
      defaultProps({
        valuationHistory: {
          ...valuation,
          history: {
            ...valuation.history,
            latestPoint: point,
            points: [point],
          },
        },
      }),
    );

    expect(markup).toContain(
      "Unavailable sensitivity: modeled residual equity value is not positive.",
    );
    expect(markup).toContain("No positive residual equity value");
  });
});

function render(props: PersonalFcffDcfValuationProps): string {
  return renderToStaticMarkup(<PersonalFcffDcfValuation {...props} />);
}

function changeControl(
  props: PersonalFcffDcfValuationProps,
  id: string,
  value: string,
): void {
  const input = findHostElement(
    PersonalFcffDcfValuation(props),
    (element) => element.type === "input" && element.props.id === id,
  );
  const onChange = input?.props.onChange;
  if (typeof onChange !== "function") throw new TypeError();
  (onChange as (event: { target: { value: string } }) => void)({
    target: { value },
  });
}

function clickControl(
  props: PersonalFcffDcfValuationProps,
  label: string,
): void {
  const button = findHostElement(
    PersonalFcffDcfValuation(props),
    (element) => element.type === "button" && element.props.children === label,
  );
  const onClick = button?.props.onClick;
  if (typeof onClick !== "function") throw new TypeError();
  (onClick as () => void)();
}

function findHostElement(
  node: React.ReactNode,
  matches: (element: React.ReactElement<Record<string, unknown>>) => boolean,
): React.ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node as readonly React.ReactNode[]) {
      const match = findHostElement(child, matches);
      if (match !== null) return match;
    }
    return null;
  }
  if (!React.isValidElement(node)) return null;
  const element = node as React.ReactElement<Record<string, unknown>>;
  if (typeof element.type === "function") {
    return findHostElement(
      (element.type as (props: Record<string, unknown>) => React.ReactNode)(
        element.props,
      ),
      matches,
    );
  }
  if (matches(element)) return element;
  return findHostElement(element.props.children as React.ReactNode, matches);
}

function draftAssumptions(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    ...structuredClone(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS),
    forecastYears: String(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS.forecastYears),
    ...overrides,
  };
}

function defaultProps(
  overrides: Partial<PersonalFcffDcfValuationProps> = {},
): PersonalFcffDcfValuationProps {
  return {
    annualFinancials: annualFinancials(),
    marketOverview: marketOverview(),
    selection: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "ZERO Common Stock",
      symbol: "ZERO",
    },
    valuationHistory: valuationHistory(),
    ...overrides,
  };
}

function identity(
  overrides: Partial<PersonalMarketDataIdentityDto> = {},
): PersonalMarketDataIdentityDto {
  return {
    country: "US",
    exchangeMic: "XNAS",
    issuerName: "Zero Alpha, Inc.",
    listingId: "lst-zero",
    securityName: "ZERO Common Stock",
    symbol: "ZERO",
    ...overrides,
  };
}

function marketOverview(
  security: PersonalMarketDataIdentityDto = identity(),
): PersonalMarketOverviewDto {
  return {
    history: {
      bars: [
        {
          adjusted: ohlcv("999"),
          date: "2030-01-15",
          dividendCash: "0",
          raw: ohlcv("100"),
          splitFactor: "1",
        },
      ],
      endDate: "2030-01-15",
      range: "1y",
      startDate: "2030-01-15",
    },
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
    quote: {
      change: "0",
      changePercent: "0",
      currency: "USD",
      freshness: "current",
      ingestedAt: "2030-01-15T22:01:00.000Z",
      kind: "derived_realtime_reference",
      previousClose: "100",
      price: "100",
      sourceTime: "2030-01-15T22:00:00.000Z",
    },
    schemaVersion: "1.0.0",
    security,
    status: "available",
  };
}

function valuationHistory(
  security: PersonalMarketDataIdentityDto = identity(),
): PersonalValuationHistoryDto {
  const point = {
    date: "2030-01-15",
    enterpriseValue: knownMoney("15000"),
    marketCapitalization: knownMoney("10000"),
    priceToBook: knownRatio("2"),
    priceToEarnings: knownRatio("20"),
    trailingPeg1Y: knownRatio("1.5"),
  } as const;
  return {
    asOf: "2030-01-15T22:00:00.000Z",
    coverage: {
      knownCells: 5,
      observationCount: 1,
      status: "complete",
      unknownCells: 0,
    },
    history: {
      endDate: point.date,
      latestPoint: point,
      points: [point],
      range: "1y",
      startDate: point.date,
    },
    profile: "personal_single_user_local_valuation",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      valuationFeed: "tiingo_fundamentals_daily",
      valueCurrency: "USD",
    },
    schemaVersion: "1.0.0",
    security,
    status: "available",
  };
}

function annualFinancials(
  security: PersonalMarketDataIdentityDto = identity(),
): PersonalAnnualFinancialsDto {
  const reported = Object.fromEntries(
    annualFieldKeys.map((key) => [key, knownAnnualCell("1")]),
  ) as PersonalAnnualFinancialsDto["years"][number]["reported"];
  const exactReported = {
    ...reported,
    free_cash_flow: knownAnnualCell("1000"),
    interest_expense: knownAnnualCell("-100"),
  };
  return {
    asOf: "2030-01-15T21:00:00.000Z",
    coverage: {
      earliestFiscalYear: 2029,
      knownReportedCells: 30,
      latestFiscalYear: 2029,
      missingFiscalYears: [
        2028, 2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020,
      ],
      requestedAnnualYears: 10,
      returnedAnnualYears: 1,
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
    schemaVersion: "1.1.0",
    security,
    status: "available",
    years: [
      {
        fiscalYear: 2029,
        reported: exactReported,
        statementDate: "2029-12-31",
      },
    ],
  };
}

function ohlcv(close: string) {
  return { close, high: close, low: close, open: close, volume: "1000" };
}

function knownMoney(value: string) {
  return { status: "known", unit: "USD", value } as const;
}

function knownRatio(value: string) {
  return { status: "known", unit: "ratio", value } as const;
}

function knownAnnualCell(value: string) {
  return { status: "known", value } as const;
}

function unknownAnnualCell() {
  return {
    reason: "not_supplied_by_provider",
    status: "unknown",
    value: null,
  } as const;
}

const annualFieldKeys = [
  "accounts_receivable",
  "assets",
  "capital_expenditures",
  "cash",
  "cost_of_revenue",
  "current_assets",
  "current_liabilities",
  "debt",
  "depreciation_and_amortization",
  "ebitda",
  "financing_cash_flow",
  "free_cash_flow",
  "gross_profit",
  "income_tax_expense",
  "intangibles",
  "inventory",
  "investing_cash_flow",
  "liabilities",
  "net_income",
  "operating_cash_flow",
  "operating_expenses",
  "operating_income",
  "pretax_income",
  "property_plant_equipment_net",
  "research_and_development",
  "revenue",
  "selling_general_and_administrative",
  "share_based_compensation",
  "shareholders_equity",
  "interest_expense",
] as const satisfies readonly PersonalAnnualFinancialReportedFieldKeyDto[];
