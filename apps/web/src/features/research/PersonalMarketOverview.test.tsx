import {
  getPersonalMarketHistory,
  getPersonalMarketReference,
} from "../../lib/personal-market-snapshot";
import type {
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
} from "@research-cockpit/contracts";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./PriceHistoryChart", () => ({
  PriceHistoryChart: () => null,
}));

import {
  PersonalMarketOverview,
  QuoteSummary,
  type PersonalMarketOverviewProps,
} from "./PersonalMarketOverview";
import {
  PersonalMarketAnalytics,
  type PersonalMarketAnalyticsProps,
} from "./PersonalMarketAnalytics";
import { PriceHistoryChart } from "./PriceHistoryChart";

describe("PersonalMarketOverview", () => {
  it("keeps compact chart content ahead of mounted analytics and company details", () => {
    const props = defaultProps({
      overview: overview(),
      selection: selection(),
    });
    const view = PersonalMarketOverview(props);
    const elements = findAllElements(view);
    const chart = requireElement(view, PriceHistoryChart);
    const analyticsDetails = requireDisclosure(view, "Trend & risk");
    const dataDetails = requireDisclosure(view, "Price data details");
    expect(elements.indexOf(chart)).toBeLessThan(
      elements.indexOf(analyticsDetails),
    );
    expect(elements.indexOf(analyticsDetails)).toBeLessThan(
      elements.indexOf(dataDetails),
    );
    expect(analyticsDetails.props.open).toBeUndefined();
    expect(dataDetails.props.open).toBeUndefined();
    expect(
      requireElement(analyticsDetails, PersonalMarketAnalytics).props.bars,
    ).toBe(getPersonalMarketHistory(props.overview)!.bars);
    expect(requireElement(view, PriceHistoryChart).props).toMatchObject({
      bars: getPersonalMarketHistory(props.overview)!.bars,
      mode: "adjusted",
      symbol: "ZERO",
    });
    expect(
      findAllElements(view, "button").filter(
        (button) => textContent(button) === "Close market view",
      ),
    ).toHaveLength(1);
    expect(textContent(dataDetails)).toContain("Zero Alpha Common Stock");
    expect(textContent(dataDetails)).toContain(
      "synthetic prices are never used",
    );
    requireButton(dataDetails, "Close market view").props.onClick();
    expect(props.onClear).toHaveBeenCalledOnce();
    expect(props.onLoad).not.toHaveBeenCalled();
  });

  it("preserves compact range and adjustment actions without loading on render", () => {
    const props = defaultProps({
      overview: overview(),
      selection: selection(),
    });
    const view = PersonalMarketOverview(props);
    expect(props.onLoad).not.toHaveBeenCalled();
    requireButton(view, "3M").props.onClick();
    requireButton(view, "Raw").props.onClick();
    expect(props.onLoad).toHaveBeenCalledExactlyOnceWith("3m");
    expect(props.onAdjustmentModeChange).toHaveBeenCalledExactlyOnceWith("raw");
    const blocked = PersonalMarketOverview({ ...props, requestBlocked: true });
    expect(requireButton(blocked, "3M").props.disabled).toBe(true);
  });

  it("keeps retained compact history errors, dates and attribution outside disclosures", () => {
    const props = defaultProps({
      overview: overview(),
      selection: selection(),
      errorCode: "provider_unavailable",
      requestState: "loading",
    });
    const view = PersonalMarketOverview(props);
    const disclosed = findAllElements(view, "details").flatMap((details) =>
      findAllElements(details),
    );
    const visible = findAllElements(view).filter(
      (element) => !disclosed.includes(element),
    );
    expect(
      visible.some(
        (element) =>
          element.props.role === "alert" &&
          textContent(element).includes("market-data provider is unavailable"),
      ),
    ).toBe(true);
    expect(
      visible.some(
        (element) =>
          element.props["aria-live"] === "polite" &&
          textContent(element).includes("Loading 1Y history"),
      ),
    ).toBe(true);
    expect(
      visible.some(
        (element) =>
          element.props.className === "market-attribution" &&
          textContent(element).includes("Tiingo"),
      ),
    ).toBe(true);
    expect(requireElement(view, QuoteSummary).props.reference).toEqual(
      getPersonalMarketReference(props.overview),
    );
    expect(requireElement(view, PriceHistoryChart).props.bars).toBe(
      getPersonalMarketHistory(props.overview)!.bars,
    );
  });

  it.each(["quote", "eod"] as const)(
    "keeps the exact %s source date visible while compact reference metadata stays mounted",
    (kind) => {
      const loaded: PersonalMarketOverviewDto =
        kind === "quote"
          ? overview()
          : { ...overview(), quote: { status: "not_requested" } };
      const reference = getPersonalMarketReference(loaded)!;
      const view = QuoteSummary({ reference });
      const details = requireDisclosure(view, "Reference details");
      const visibleSource = findAllElements(view, "p").find(
        (element) => element.props.className === "market-reference-source-date",
      );
      expect(visibleSource).toBeDefined();
      expect(findAllElements(details)).not.toContain(visibleSource);
      expect(requireElement(visibleSource, "time").props.dateTime).toBe(
        kind === "quote" ? "2030-01-15T21:00:00.000Z" : "2030-01-15",
      );
      expect(textContent(view)).toContain(
        kind === "quote" ? "Derived real-time reference" : "End-of-day close",
      );
      expect(details.props.open).toBeUndefined();
      expect(textContent(details)).toContain("Previous close");
      expect(textContent(details)).toContain("Ingested");
      if (kind === "eod") {
        expect(textContent(details)).toContain(
          "not an observed closing-trade time",
        );
      }
    },
  );

  it("describes an EOD-only initial load without claiming a quote request", () => {
    const props = defaultProps({
      selection: selection(),
      requestState: "loading",
      range: "1m",
    });
    const view = PersonalMarketOverview(props);
    expect(textContent(view)).toContain("Loading 1M market data…");
    expect(textContent(view)).not.toContain("quote and history");
    expect(requireButton(view, "Loading market data…").props.disabled).toBe(
      true,
    );
    expect(props.onLoad).not.toHaveBeenCalled();
  });
  it("disables market acquisition while the shared annual request is active", () => {
    const props = defaultProps({
      selection: selection(),
      requestBlocked: true,
    });
    const view = PersonalMarketOverview(props);
    expect(requireButton(view, "Load market data").props.disabled).toBe(true);
    expect(requireButton(view, "1M").props.disabled).toBe(true);
    expect(textContent(view)).not.toContain("Loading market data");
  });
  it("retains EOD history when the quote feed denies access and labels the modeled reference", () => {
    const loaded: PersonalMarketOverviewDto = {
      ...overview(),
      quote: { status: "unavailable", reason: "access_denied" },
    };
    const view = PersonalMarketOverview(
      defaultProps({ overview: loaded, selection: selection() }),
    );
    expect(requireElement(view, PersonalMarketAnalytics).props.bars).toBe(
      getPersonalMarketHistory(loaded)!.bars,
    );
    expect(textContent(view)).toContain("End-of-day history remains available");
    const quote = textContent(
      QuoteSummary({ reference: getPersonalMarketReference(loaded)! }),
    );
    expect(quote).toContain("2030-01-15");
    expect(quote).toContain("Modeled age policy");
    expect(quote).toContain("not an observed closing-trade time");
    expect(quote).not.toContain("Current");
  });
  it("keeps a quote-only result visible and offers history retry", () => {
    const loaded: PersonalMarketOverviewDto = {
      ...overview(),
      history: { status: "unavailable", reason: "upstream_unavailable" },
    };
    const props = defaultProps({ overview: loaded, selection: selection() });
    const view = PersonalMarketOverview(props);
    expect(requireElement(view, QuoteSummary).props.reference).toEqual(
      getPersonalMarketReference(loaded),
    );
    expect(textContent(view)).toContain("End-of-day history unavailable");
    requireButton(view, "Retry market data").props.onClick();
    expect(props.onLoad).toHaveBeenCalledOnce();
  });
  it("shows provider readiness without requesting data before selection", () => {
    const props = defaultProps();
    const rendered = PersonalMarketOverview(props);

    expect(textContent(rendered)).toContain("Tiingo configured");
    expect(textContent(rendered)).toContain("Choose a security to inspect");
    expect(textContent(rendered)).toContain(
      "Checking provider configuration does not request market data",
    );
    expect(props.onLoad).not.toHaveBeenCalled();
  });

  it("keeps loading disabled and explains an unconfigured provider", () => {
    const props = defaultProps({
      providerStatus: { ...status(), status: "not_configured" },
      selection: selection(),
    });
    const rendered = PersonalMarketOverview(props);

    expect(textContent(rendered)).toContain("Tiingo is not configured");
    expect(requireButton(rendered, "Load market data").props.disabled).toBe(
      true,
    );
    expect(props.onLoad).not.toHaveBeenCalled();
  });

  it("lets the owner choose any range before the first successful load", () => {
    const props = defaultProps({ selection: selection() });
    const rendered = PersonalMarketOverview(props);

    const tenYears = requireButton(rendered, "10Y");
    expect(tenYears.props.disabled).toBe(false);
    tenYears.props.onClick();
    expect(props.onLoad).toHaveBeenCalledWith("10y");
  });

  it("labels quote direction, freshness, provenance, and interactive controls", () => {
    const props = defaultProps({
      overview: overview(),
      selection: selection(),
    });
    const rendered = PersonalMarketOverview(props);
    const quote = textContent(
      QuoteSummary({ reference: getPersonalMarketReference(overview())! }),
    );

    expect(quote).toContain("$101.50");
    expect(quote).toContain("Up +$1.50 (+1.5%)");
    expect(quote).toContain("Derived real-time reference");
    expect(quote).toContain("Within 36 hours");
    expect(textContent(rendered)).toContain("Data attribution:");
    expect(textContent(rendered)).toContain("Tiingo");

    const fiveYears = requireButton(rendered, "5Y");
    expect(fiveYears.props["aria-pressed"]).toBe(false);
    fiveYears.props.onClick();
    expect(props.onLoad).toHaveBeenCalledWith("5y");

    const raw = requireButton(rendered, "Raw");
    expect(raw.props["aria-pressed"]).toBe(false);
    raw.props.onClick();
    expect(props.onAdjustmentModeChange).toHaveBeenCalledWith("raw");
    expect(props.onLoad).toHaveBeenCalledTimes(1);

    const analytics = requireElement(
      rendered,
      PersonalMarketAnalytics,
    ) as unknown as React.ReactElement<PersonalMarketAnalyticsProps>;
    expect(analytics.props.asOfDate).toBe("2030-01-15");
    expect(analytics.props.bars).toBe(
      getPersonalMarketHistory(props.overview)!.bars,
    );
    expect(analytics.props.mode).toBe("adjusted");
  });

  it("uses the last observed session as the analytics as-of date", () => {
    const loaded = overview();
    const rendered = PersonalMarketOverview(
      defaultProps({
        overview: {
          ...loaded,
          history: {
            status: "available",
            value: {
              ...getPersonalMarketHistory(loaded)!,
              endDate: "2030-01-20",
            },
          },
        },
        selection: selection(),
      }),
    );

    const analytics = requireElement(
      rendered,
      PersonalMarketAnalytics,
    ) as unknown as React.ReactElement<PersonalMarketAnalyticsProps>;
    expect(analytics.props.asOfDate).toBe("2030-01-15");
  });

  it.each([
    ["credentials_invalid", "provider credential was rejected"],
    ["rate_limited", "provider rate limit was reached"],
    ["not_covered", "listing is not covered"],
    ["provider_unavailable", "market-data provider is unavailable"],
  ] as const)("renders a retryable %s state without fallback", (code, text) => {
    const props = defaultProps({
      errorCode: code,
      selection: selection(),
    });
    const rendered = PersonalMarketOverview(props);

    expect(textContent(rendered)).toContain(text);
    expect(textContent(rendered)).toContain(
      "No synthetic value was substituted",
    );
    const retry = requireButton(rendered, "Retry market data");
    retry.props.onClick();
    expect(props.onLoad).toHaveBeenCalledWith("1y");

    const oneMonth = requireButton(rendered, "1M");
    oneMonth.props.onClick();
    expect(props.onLoad).toHaveBeenCalledWith("1m");
  });
});

function defaultProps(
  overrides: Partial<PersonalMarketOverviewProps> = {},
): PersonalMarketOverviewProps {
  return {
    adjustmentMode: "adjusted",
    errorCode: null,
    onAdjustmentModeChange: vi.fn(),
    onClear: vi.fn(),
    onLoad: vi.fn(),
    overview: null,
    providerStatus: status(),
    range: "1y",
    requestState: "idle",
    selection: null,
    ...overrides,
  };
}

function status(): PersonalMarketDataStatusDto {
  return {
    profile: "personal_single_user_local_market_data",
    provider: provider(),
    schemaVersion: "1.0.0",
    status: "configured",
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

function overview(): PersonalMarketOverviewDto {
  return {
    history: {
      status: "available",
      value: {
        currency: "USD",
        bars: [bar("2030-01-14", "100.00"), bar("2030-01-15", "101.50")],
        endDate: "2030-01-15",
        range: "1y",
        startDate: "2030-01-14",
      },
    },
    profile: "personal_single_user_local_market_data",
    provider: provider(),
    quote: {
      status: "available",
      value: {
        change: "1.50",
        changePercent: "1.50",
        currency: "USD",
        freshness: "current",
        ingestedAt: "2030-01-15T21:01:00.000Z",
        kind: "derived_realtime_reference",
        previousClose: "100.00",
        price: "101.50",
        sourceTime: "2030-01-15T21:00:00.000Z",
      },
    },
    schemaVersion: "2.0.0",
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common Stock",
      symbol: "ZERO",
    },
    ingestedAt: "2030-01-15T21:01:00.000Z",
    window: { range: "1y", startDate: "2030-01-14", endDate: "2030-01-15" },
  };
}

function provider() {
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

function bar(date: string, close: string) {
  return {
    adjusted: {
      close,
      high: "102.00",
      low: "99.00",
      open: "100.00",
      volume: "1200000",
    },
    date,
    dividendCash: "0",
    raw: {
      close,
      high: "102.00",
      low: "99.00",
      open: "100.00",
      volume: "1200000",
    },
    splitFactor: "1",
  } as const;
}

function requireButton(value: unknown, text: string) {
  const button = findAllElements(value, "button").find(
    (candidate) => textContent(candidate) === text,
  );
  if (button === undefined) throw new Error(`Expected button ${text}.`);
  return button as React.ReactElement<{
    "aria-pressed"?: boolean;
    disabled?: boolean;
    onClick: () => void;
  }>;
}

function requireDisclosure(value: unknown, summary: string) {
  const details = findAllElements(value, "details").find((candidate) =>
    findAllElements(candidate, "summary").some(
      (element) => textContent(element) === summary,
    ),
  );
  if (details === undefined) throw new Error(`Expected disclosure ${summary}.`);
  return details;
}

function requireElement(value: unknown, type: React.ElementType) {
  const element = findAllElements(value, type)[0];
  if (element === undefined) {
    throw new Error(`Expected element ${String(type)}.`);
  }
  return element;
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
