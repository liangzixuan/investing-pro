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

describe("PersonalMarketOverview", () => {
  it("shows provider readiness without requesting data before selection", () => {
    const props = defaultProps();
    const rendered = PersonalMarketOverview(props);

    expect(textContent(rendered)).toContain("Tiingo configured");
    expect(textContent(rendered)).toContain("Choose a security to inspect");
    expect(textContent(rendered)).toContain("synthetic prices are never used");
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
    const quote = textContent(QuoteSummary({ overview: overview() }));

    expect(quote).toContain("$101.50");
    expect(quote).toContain("Up +$1.50 (+1.5%)");
    expect(quote).toContain("Derived real-time reference");
    expect(quote).toContain("Current");
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
    expect(analytics.props.bars).toBe(props.overview?.history.bars);
    expect(analytics.props.mode).toBe("adjusted");
  });

  it("uses the last observed session as the analytics as-of date", () => {
    const loaded = overview();
    const rendered = PersonalMarketOverview(
      defaultProps({
        overview: {
          ...loaded,
          history: { ...loaded.history, endDate: "2030-01-20" },
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
    exchangeMic: "XNAS",
    issuerName: "Zero Alpha, Inc.",
    listingId: "lst-zero",
    securityName: "Zero Alpha Common Stock",
    symbol: "ZERO",
  };
}

function overview(): PersonalMarketOverviewDto {
  return {
    history: {
      bars: [bar("2030-01-14", "100.00"), bar("2030-01-15", "101.50")],
      endDate: "2030-01-15",
      range: "1y",
      startDate: "2030-01-14",
    },
    profile: "personal_single_user_local_market_data",
    provider: provider(),
    quote: {
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
