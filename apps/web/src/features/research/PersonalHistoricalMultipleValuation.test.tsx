import type {
  PersonalMarketDataIdentityDto,
  PersonalMarketDataRangeDto,
  PersonalMarketOverviewDto,
  PersonalValuationHistoryDto,
  PersonalValuationHistoryPointDto,
} from "@research-cockpit/contracts";
import type { PersonalHistoricalMultipleValuationMetric } from "@research-cockpit/personal-market-analytics";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  PersonalHistoricalMultipleValuation,
  type PersonalHistoricalMultipleValuationProps,
} from "./PersonalHistoricalMultipleValuation";

describe("PersonalHistoricalMultipleValuation", () => {
  it("starts with explicit load guidance and makes the product limits visible", () => {
    const rendered = render(
      defaultProps({
        marketOverview: null,
        selection: null,
        valuationHistory: null,
      }),
    );

    expect(rendered.text).toContain(
      "Choose a security to build historical-multiple scenarios",
    );
    expect(rendered.text).toContain("provider-most-recent valuation history");
    expect(rendered.text).toContain("not point-in-time or as-reported history");
    expect(rendered.text).toContain("not intrinsic fair value");
    expect(rendered.text).toContain("not a price target");
    expect(rendered.text).toContain("not a buy/sell recommendation");
    expect(rendered.text).toContain("makes no fetch, persists nothing");
    expect(rendered.markup).toContain('aria-live="polite"');
    expect(rendered.markup).toContain(
      'aria-label="Historical multiple metric"',
    );
    expect(rendered.markup).toContain('role="group"');
  });

  it("maps full provider DTOs into the strict model and renders all decision context", () => {
    const loaded = loadedInputs(62, {
      pe: (index) =>
        index === 0
          ? unknownRatio()
          : knownRatio(index === 1 ? "0" : String(index + 8)),
    });
    const rendered = render(
      defaultProps({
        marketOverview: loaded.market,
        selection: selection(),
        valuationHistory: loaded.valuation,
      }),
    );

    expect(rendered.text).toContain("ZERO P/E scenarios are available");
    expect(rendered.text).toContain("Reference date");
    expect(rendered.text).toContain("Mar 3, 2030");
    expect(rendered.text).toContain("Raw close");
    expect(rendered.text).toContain("$100.25");
    expect(rendered.text).toContain("Reference-date P/E");
    expect(rendered.text).toContain("69×");
    expect(rendered.text).toContain("Reference multiple percentile");
    expect(rendered.text).toContain("100.00%");
    expect(rendered.text).toContain("Lower quartile · P25");
    expect(rendered.text).toContain("Median · P50");
    expect(rendered.text).toContain("Upper quartile · P75");
    expect(rendered.text).toContain("Target multiple");
    expect(rendered.text).toContain("Difference from raw close");
    expect(rendered.text).toContain("60 of 62 · minimum 60");
    expect(rendered.text).toContain("2 total · 1 unknown · 1 nonpositive");
    expect(rendered.text).toContain("Jan 3, 2030–Mar 3, 2030");
    expect(rendered.text).toContain("historical_positive_multiple_quantile_r7");
    expect(rendered.text).toContain("historical_multiple_implied_price");
    expect(rendered.text).toContain("Round half up");
    expect(rendered.text).toContain("Formula set 1.0.0 · result schema 1.0.0");
    expect(rendered.text).toContain("Price input");
    expect(rendered.text).toContain("Tiingo EOD composite");
    expect(rendered.text).toContain("Valuation input");
    expect(rendered.text).toContain("Tiingo fundamentals daily");
    expect(rendered.text).toContain("response as of");
    expect(rendered.text).toContain(
      "holds the reference-date earnings or book-value-per-share basis constant",
    );
    expect(rendered.markup).toContain("<details");
    expect(rendered.markup).toContain(
      'aria-label="ZERO P/E historical-multiple scenarios"',
    );
  });

  it("exposes an accessible P/E and P/B switch through the only callback", () => {
    const props = defaultProps({ selection: selection() });
    const tree = PersonalHistoricalMultipleValuation(props);
    const pe = requireButton(tree, "P/E");
    const pb = requireButton(tree, "P/B");

    expect(pe.props["aria-pressed"]).toBe(true);
    expect(pb.props["aria-pressed"]).toBe(false);
    expect(pb.props["aria-label"]).toBe("Use price-to-book history");
    pb.props.onClick();
    expect(props.onMetricChange).toHaveBeenCalledOnce();
    expect(props.onMetricChange).toHaveBeenCalledWith("priceToBook");
  });

  it("renders P/B independently from the same bounded inputs", () => {
    const loaded = loadedInputs(60, {
      pb: (index) => knownRatio(String(index + 1)),
    });
    const rendered = render(
      defaultProps({
        marketOverview: loaded.market,
        metric: "priceToBook",
        selection: selection(),
        valuationHistory: loaded.valuation,
      }),
    );

    expect(rendered.text).toContain("ZERO P/B scenarios are available");
    expect(rendered.text).toContain("Reference-date P/B");
    expect(rendered.text).toContain("60×");
    expect(rendered.text).not.toContain("Reference-date P/E");
  });

  it("uses raw close and exposes the independently loaded source windows", () => {
    const loaded = loadedInputs(60);
    const rendered = render(
      defaultProps({
        marketOverview: {
          ...loaded.market,
          history: {
            ...loaded.market.history,
            bars: loaded.market.history.bars.map((bar) => ({
              ...bar,
              adjusted: ohlcv("999.99"),
            })),
            startDate: "2029-12-15",
          },
        },
        selection: selection(),
        valuationHistory: {
          ...loaded.valuation,
          asOf: "2030-03-02T22:00:00.000Z",
          history: {
            ...loaded.valuation.history,
            startDate: "2029-12-20",
          },
        },
      }),
    );

    expect(rendered.text).toContain("Raw close $100.25");
    expect(rendered.text).not.toContain("$999.99");
    expect(rendered.text).toContain(
      "Tiingo EOD composite · requested window Dec 15, 2029–Mar 1, 2030",
    );
    expect(rendered.text).toContain(
      "Tiingo fundamentals daily · requested window Dec 20, 2029–Mar 1, 2030",
    );
    expect(rendered.markup).toContain(
      '<time dateTime="2030-03-02T22:00:00.000Z">',
    );
  });

  it.each([
    {
      expected: "Load ZERO price and valuation histories to calculate",
      name: "both source histories missing",
      props: () =>
        defaultProps({
          marketOverview: null,
          selection: selection(),
          valuationHistory: null,
        }),
    },
    {
      expected: "Load ZERO price history to calculate",
      name: "missing market history",
      props: () => {
        const loaded = loadedInputs(60);
        return defaultProps({
          marketOverview: null,
          selection: selection(),
          valuationHistory: loaded.valuation,
        });
      },
    },
    {
      expected: "Load ZERO valuation history to calculate",
      name: "missing valuation history",
      props: () => {
        const loaded = loadedInputs(60);
        return defaultProps({
          marketOverview: loaded.market,
          selection: selection(),
          valuationHistory: null,
        });
      },
    },
    {
      expected: "Loaded histories describe different listings",
      name: "identity mismatch",
      props: () => {
        const loaded = loadedInputs(60, {
          valuationIdentity: identity({
            issuerName: "Other Issuer, Inc.",
            listingId: "lst-other",
            securityName: "Other Common Stock",
            symbol: "OTHER",
          }),
        });
        return defaultProps({
          marketOverview: loaded.market,
          selection: selection(),
          valuationHistory: loaded.valuation,
        });
      },
    },
    {
      expected: "Price and valuation ranges do not match",
      name: "range mismatch",
      props: () => {
        const loaded = loadedInputs(60, { valuationRange: "5y" });
        return defaultProps({
          marketOverview: loaded.market,
          selection: selection(),
          valuationHistory: loaded.valuation,
        });
      },
    },
    {
      expected: "No common reference date is available",
      name: "no common date",
      props: () => {
        const loaded = loadedInputs(60, { valuationYear: 2028 });
        return defaultProps({
          marketOverview: loaded.market,
          selection: selection(),
          valuationHistory: loaded.valuation,
        });
      },
    },
    {
      expected: "Reference-date P/E is unavailable",
      name: "unknown current multiple",
      props: () => {
        const loaded = loadedInputs(60, {
          pe: (index) => (index === 59 ? unknownRatio() : knownRatio("20")),
        });
        return defaultProps({
          marketOverview: loaded.market,
          selection: selection(),
          valuationHistory: loaded.valuation,
        });
      },
    },
    {
      expected: "Reference-date P/E is nonpositive and not applicable",
      name: "nonpositive current multiple",
      props: () => {
        const loaded = loadedInputs(61, {
          pe: (index) => knownRatio(index === 60 ? "0" : "20"),
        });
        return defaultProps({
          marketOverview: loaded.market,
          selection: selection(),
          valuationHistory: loaded.valuation,
        });
      },
    },
    {
      expected: "The reference raw close is not usable",
      name: "nonpositive reference price",
      props: () => {
        const loaded = loadedInputs(60, {
          rawClose: (index) => (index === 59 ? "0" : "100.25"),
        });
        return defaultProps({
          marketOverview: loaded.market,
          selection: selection(),
          valuationHistory: loaded.valuation,
        });
      },
    },
    {
      expected: "More positive valuation history is needed",
      name: "insufficient positive sample",
      props: () => {
        const loaded = loadedInputs(4);
        return defaultProps({
          marketOverview: loaded.market,
          selection: selection(),
          valuationHistory: loaded.valuation,
        });
      },
    },
  ])("explains $name without inventing a scenario", ({ expected, props }) => {
    const rendered = render(props());

    expect(rendered.text).toContain(expected);
    expect(rendered.text).toContain(
      "No multiple, implied price, or recommendation was substituted",
    );
    expect(rendered.text).not.toContain("Lower quartile · P25");
  });

  it("suppresses a valid calculation when both loaded DTOs are stale for the selection", () => {
    const loaded = loadedInputs(60);
    const rendered = render(
      defaultProps({
        marketOverview: loaded.market,
        selection: {
          exchangeMic: "XNYS",
          issuerName: "Different Issuer, Inc.",
          listingId: "lst-different",
          securityName: "Different Common Stock",
          symbol: "DIFF",
        },
        valuationHistory: loaded.valuation,
      }),
    );

    expect(rendered.text).toContain("Reload inputs for DIFF");
    expect(rendered.text).toContain("no stale value is shown");
    expect(rendered.text).not.toContain("Lower quartile · P25");
  });
});

function defaultProps(
  overrides: Partial<PersonalHistoricalMultipleValuationProps> = {},
): PersonalHistoricalMultipleValuationProps {
  return {
    marketOverview: null,
    metric: "priceToEarnings",
    onMetricChange:
      vi.fn<(metric: PersonalHistoricalMultipleValuationMetric) => void>(),
    selection: null,
    valuationHistory: null,
    ...overrides,
  };
}

function loadedInputs(
  count: number,
  options: Readonly<{
    marketIdentity?: PersonalMarketDataIdentityDto;
    marketRange?: PersonalMarketDataRangeDto;
    pb?: (index: number) => ReturnType<typeof knownRatio>;
    pe?: (
      index: number,
    ) => ReturnType<typeof knownRatio> | ReturnType<typeof unknownRatio>;
    rawClose?: (index: number) => string;
    valuationIdentity?: PersonalMarketDataIdentityDto;
    valuationRange?: PersonalMarketDataRangeDto;
    valuationYear?: number;
  }> = {},
): Readonly<{
  market: PersonalMarketOverviewDto;
  valuation: PersonalValuationHistoryDto;
}> {
  const marketDates = Array.from({ length: count }, (_, index) =>
    dateAt(index, 2030),
  );
  const valuationDates = Array.from({ length: count }, (_, index) =>
    dateAt(index, options.valuationYear ?? 2030),
  );
  const marketIdentity = options.marketIdentity ?? identity();
  const valuationIdentity = options.valuationIdentity ?? identity();
  const marketRange = options.marketRange ?? "1y";
  const valuationRange = options.valuationRange ?? "1y";
  const bars = marketDates.map((date, index) =>
    bar(date, options.rawClose?.(index) ?? "100.25"),
  );
  const points = valuationDates.map((date, index) =>
    valuationPoint(
      date,
      options.pe?.(index) ?? knownRatio(String(index + 10)),
      options.pb?.(index) ?? knownRatio("2"),
    ),
  );
  const latestPoint = points.at(-1);
  if (latestPoint === undefined) throw new Error("A test needs one point.");
  const latestBar = bars.at(-1);
  if (latestBar === undefined) throw new Error("A test needs one bar.");

  return {
    market: {
      history: {
        bars,
        endDate: latestBar.date,
        range: marketRange,
        startDate: bars[0]?.date ?? latestBar.date,
      },
      profile: "personal_single_user_local_market_data",
      provider: marketProvider(),
      quote: {
        change: null,
        changePercent: null,
        currency: "USD",
        freshness: "current",
        ingestedAt: `${latestBar.date}T21:01:00.000Z`,
        kind: "end_of_day_close",
        previousClose: null,
        price: latestBar.raw.close,
        sourceTime: `${latestBar.date}T21:00:00.000Z`,
      },
      schemaVersion: "1.0.0",
      security: marketIdentity,
      status: "available",
    },
    valuation: {
      asOf: `${latestPoint.date}T22:00:00.000Z`,
      coverage: {
        knownCells: points.length * 2,
        observationCount: points.length,
        status: "partial",
        unknownCells: points.length * 3,
      },
      history: {
        endDate: latestPoint.date,
        latestPoint,
        points,
        range: valuationRange,
        startDate: points[0]?.date ?? latestPoint.date,
      },
      profile: "personal_single_user_local_valuation",
      provider: valuationProvider(),
      schemaVersion: "1.0.0",
      security: valuationIdentity,
      status: "available",
    },
  };
}

function selection() {
  const selected = identity();
  return {
    exchangeMic: selected.exchangeMic,
    issuerName: selected.issuerName,
    listingId: selected.listingId,
    securityName: selected.securityName,
    symbol: selected.symbol,
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
    securityName: "Zero Alpha Common Stock",
    symbol: "ZERO",
    ...overrides,
  };
}

function marketProvider() {
  return {
    attribution: "Tiingo" as const,
    export: "prohibited" as const,
    historyFeed: "tiingo_eod_composite" as const,
    id: "tiingo" as const,
    name: "Tiingo" as const,
    persistence: "none" as const,
    quoteFeed: "tiingo_iex_derived_reference" as const,
    redistribution: "prohibited" as const,
    retention: "active_owner_session_memory_only" as const,
  };
}

function valuationProvider() {
  return {
    attribution: "Tiingo" as const,
    export: "prohibited" as const,
    id: "tiingo" as const,
    name: "Tiingo" as const,
    persistence: "none" as const,
    redistribution: "prohibited" as const,
    retention: "active_owner_session_memory_only" as const,
    revisionBasis: "provider_most_recent" as const,
    valuationFeed: "tiingo_fundamentals_daily" as const,
    valueCurrency: "USD" as const,
  };
}

function bar(date: string, close: string) {
  return {
    adjusted: ohlcv(close),
    date,
    dividendCash: "0",
    raw: ohlcv(close),
    splitFactor: "1",
  };
}

function ohlcv(close: string) {
  return {
    close,
    high: close,
    low: close,
    open: close,
    volume: "1000",
  };
}

function valuationPoint(
  date: string,
  priceToEarnings:
    ReturnType<typeof knownRatio> | ReturnType<typeof unknownRatio>,
  priceToBook: ReturnType<typeof knownRatio>,
): PersonalValuationHistoryPointDto {
  const unknown = unknownRatio();
  return {
    date,
    enterpriseValue: {
      reason: "not_supplied_by_provider",
      status: "unknown",
      unit: "USD",
      value: null,
    },
    marketCapitalization: {
      reason: "not_supplied_by_provider",
      status: "unknown",
      unit: "USD",
      value: null,
    },
    priceToBook,
    priceToEarnings,
    trailingPeg1Y: unknown,
  };
}

function knownRatio(value: string) {
  return { status: "known", unit: "ratio", value } as const;
}

function unknownRatio() {
  return {
    reason: "not_supplied_by_provider",
    status: "unknown",
    unit: "ratio",
    value: null,
  } as const;
}

function dateAt(index: number, year: number): string {
  return new Date(Date.UTC(year, 0, index + 1)).toISOString().slice(0, 10);
}

function render(props: PersonalHistoricalMultipleValuationProps): Readonly<{
  markup: string;
  text: string;
}> {
  const markup = renderToStaticMarkup(
    <PersonalHistoricalMultipleValuation {...props} />,
  );
  return { markup, text: visibleText(markup) };
}

function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]*>/gu, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function requireButton(value: ReactNode, text: string) {
  const button = findAllElements(value, "button").find(
    (candidate) => textContent(candidate) === text,
  );
  if (button === undefined) throw new Error(`Expected button ${text}.`);
  return button as React.ReactElement<{
    "aria-label": string;
    "aria-pressed": boolean;
    onClick: () => void;
  }>;
}

function findAllElements(
  value: unknown,
  type?: React.ElementType,
): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) {
    return value.flatMap((child) => findAllElements(child, type));
  }
  if (!React.isValidElement(value)) return [];
  const own =
    type === undefined || value.type === type
      ? [value as React.ReactElement<Record<string, unknown>>]
      : [];
  return [
    ...own,
    ...findAllElements((value.props as { children?: unknown }).children, type),
  ];
}

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(textContent).join(" ");
  if (!React.isValidElement(value)) return "";
  return textContent((value.props as { children?: unknown }).children);
}
