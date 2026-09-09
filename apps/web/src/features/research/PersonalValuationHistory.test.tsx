import type {
  PersonalMarketDataStatusDto,
  PersonalValuationHistoryDto,
} from "@research-cockpit/contracts";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./ValuationHistoryChart", async (importOriginal) => ({
  ...(await importOriginal()),
  ValuationHistoryChart: () => null,
}));

import {
  PersonalValuationHistory,
  type PersonalValuationHistoryProps,
  ValuationHistoryResult,
} from "./PersonalValuationHistory";
import {
  ValuationHistoryChart,
  type ValuationHistoryMetric,
} from "./ValuationHistoryChart";

describe("PersonalValuationHistory", () => {
  it("requires a selection and never requests valuation data automatically", () => {
    const props = defaultProps();
    const rendered = PersonalValuationHistory(props);

    expect(textContent(rendered)).toContain(
      "Choose a security to inspect its valuation history",
    );
    expect(textContent(rendered)).toContain("not a fair-value estimate");
    expect(props.onLoad).not.toHaveBeenCalled();
  });

  it("keeps the explicit request disabled when Tiingo is not configured", () => {
    const props = defaultProps({
      providerStatus: { ...status(), status: "not_configured" },
      selection: selection(),
    });
    const rendered = PersonalValuationHistory(props);

    expect(textContent(rendered)).toContain("Configure the owner-local Tiingo");
    expect(
      requireButton(rendered, "Load valuation history").props.disabled,
    ).toBe(true);
    expect(props.onLoad).not.toHaveBeenCalled();
  });

  it("renders exact latest cards, coverage, attribution, and one-scale chart control", () => {
    const props = defaultProps({
      history: valuationHistory(),
      selection: selection(),
    });
    const rendered = PersonalValuationHistory(props);
    const result = ValuationHistoryResult({
      history: props.history!,
      metric: props.metric,
      onMetricChange: props.onMetricChange,
    });
    const text = normalizeText(result);

    expect(text).toContain("P/E (provider)");
    expect(text).toContain("24.125×");
    expect(text).toContain("$125,000,000,000.25");
    expect(text).toContain("Unknown");
    expect(text).toContain("Not supplied by provider");
    expect(text).toContain("2 / 10");
    expect(text).toContain("Requested window");
    expect(text).toContain("Data attribution: Tiingo");
    expect(text).toContain("does not reinterpret P/E as verified TTM");

    const select = requireElement(result, "select") as React.ReactElement<{
      onChange: (event: { target: { value: string } }) => void;
    }>;
    select.props.onChange({ target: { value: "marketCapitalization" } });
    expect(props.onMetricChange).toHaveBeenCalledWith("marketCapitalization");

    const chart = requireElement(result, ValuationHistoryChart);
    expect(chart.props.metric).toBe("priceToEarnings");
    expect(chart.props.points).toBe(props.history?.history.points);

    requireButton(rendered, "Refresh valuation history").props.onClick();
    expect(props.onLoad).toHaveBeenCalledOnce();
  });

  it.each([
    ["not_entitled", "not included for this account"],
    ["not_covered", "not available for this listing"],
    ["credentials_invalid", "provider credential was rejected"],
    ["rate_limited", "provider rate limit was reached"],
    ["provider_unavailable", "valuation provider is unavailable"],
  ] as const)(
    "renders a retryable %s state without estimates",
    (code, copy) => {
      const props = defaultProps({ errorCode: code, selection: selection() });
      const rendered = PersonalValuationHistory(props);

      expect(textContent(rendered)).toContain(copy);
      expect(textContent(rendered)).toContain(
        "No value was estimated or substituted",
      );
      requireButton(rendered, "Retry valuation history").props.onClick();
      expect(props.onLoad).toHaveBeenCalledOnce();
    },
  );
});

function defaultProps(
  overrides: Partial<PersonalValuationHistoryProps> = {},
): PersonalValuationHistoryProps {
  return {
    errorCode: null,
    history: null,
    metric: "priceToEarnings",
    onLoad: vi.fn(),
    onMetricChange: vi.fn<(metric: ValuationHistoryMetric) => void>(),
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

function valuationHistory(): PersonalValuationHistoryDto {
  const first = valuationPoint("2030-01-14", "unknown");
  const latest = valuationPoint("2030-01-15", "known");
  return {
    asOf: "2030-01-15T22:00:00.000Z",
    coverage: {
      knownCells: 2,
      observationCount: 2,
      status: "partial",
      unknownCells: 8,
    },
    history: {
      endDate: "2030-01-15",
      latestPoint: latest,
      points: [first, latest],
      range: "1y",
      startDate: "2029-01-15",
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

function valuationPoint(date: string, state: "known" | "unknown") {
  const unknown = {
    reason: "not_supplied_by_provider",
    status: "unknown",
    unit: "ratio",
    value: null,
  } as const;
  return {
    date,
    enterpriseValue: {
      reason: "not_supplied_by_provider",
      status: "unknown",
      unit: "USD",
      value: null,
    } as const,
    marketCapitalization:
      state === "known"
        ? ({ status: "known", unit: "USD", value: "125000000000.25" } as const)
        : ({
            reason: "not_supplied_by_provider",
            status: "unknown",
            unit: "USD",
            value: null,
          } as const),
    priceToBook: unknown,
    priceToEarnings:
      state === "known"
        ? ({ status: "known", unit: "ratio", value: "24.125" } as const)
        : unknown,
    trailingPeg1Y: unknown,
  };
}

function requireButton(value: unknown, text: string) {
  const button = findAllElements(value, "button").find(
    (candidate) => textContent(candidate) === text,
  );
  if (button === undefined) throw new Error(`Expected button ${text}.`);
  return button as React.ReactElement<{
    disabled?: boolean;
    onClick: () => void;
  }>;
}

function requireElement(value: unknown, type: React.ElementType) {
  const element = findAllElements(value, type)[0];
  if (element === undefined) throw new Error(`Expected ${String(type)}.`);
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

function normalizeText(value: unknown): string {
  return textContent(value).replace(/\s+/gu, " ").trim();
}
