import type { PersonalValuationHistoryPointDto } from "@research-cockpit/contracts";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => {
  let effect: (() => (() => void) | void) | undefined;
  const chartElement = {};
  return {
    chartElement,
    reset() {
      effect = undefined;
    },
    runEffect() {
      return effect?.();
    },
    useEffect(next: () => (() => void) | void) {
      effect = next;
    },
    useRef: () => ({ current: chartElement }),
  };
});

const chart = vi.hoisted(() => ({
  disconnect: vi.fn(),
  dispose: vi.fn(),
  init: vi.fn(),
  observe: vi.fn(),
  resize: vi.fn(),
  setOption: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  useEffect: (next: () => (() => void) | void) => hooks.useEffect(next),
  useRef: hooks.useRef,
}));
vi.mock("echarts", () => ({ init: chart.init }));

import {
  summarizeValuationHistory,
  ValuationHistoryChart,
} from "./ValuationHistoryChart";

afterEach(() => {
  hooks.reset();
  for (const mock of Object.values(chart)) mock.mockReset();
  vi.unstubAllGlobals();
});

describe("ValuationHistoryChart", () => {
  it("renders an accessible summary and exact selected-metric table", () => {
    const rendered = ValuationHistoryChart({
      metric: "priceToEarnings",
      points: points(),
      symbol: "ZERO",
    });
    const text = normalizeText(rendered);

    expect(text).toContain("ZERO P/E (provider)");
    expect(text).toContain("1 known of 2 daily observations");
    expect(text).toContain("Inspect exact p/e (provider) history");
    expect(text).toContain("24.125×");
    expect(text).toContain("Unknown — not supplied by provider");
    expect(
      findAllElements(rendered, "div").find(
        (element) => element.props.role === "img",
      )?.props["aria-label"],
    ).toContain("ZERO P/E (provider)");
  });

  it("uses one SVG series, exact tooltips, resize cleanup, and reduced motion", () => {
    chart.init.mockReturnValue({
      dispose: chart.dispose,
      resize: chart.resize,
      setOption: chart.setOption,
    });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect = chart.disconnect;
        observe = chart.observe;
        constructor(private readonly callback: () => void) {
          this.callback();
        }
      },
    );

    ValuationHistoryChart({
      metric: "marketCapitalization",
      points: points(),
      symbol: "ZERO",
    });
    const cleanup = hooks.runEffect();

    expect(chart.init).toHaveBeenCalledWith(hooks.chartElement, undefined, {
      renderer: "svg",
    });
    const option = chart.setOption.mock.calls[0]?.[0] as
      | {
          animation?: unknown;
          aria?: { enabled?: unknown };
          series?: readonly { name?: unknown; type?: unknown }[];
          tooltip?: { formatter?: (value: unknown) => string };
          yAxis?: { name?: unknown };
        }
      | undefined;
    expect(option?.animation).toBe(false);
    expect(option?.aria?.enabled).toBe(true);
    expect(option?.series).toEqual([
      expect.objectContaining({
        name: "Market capitalization",
        type: "line",
      }),
    ]);
    expect(option?.yAxis?.name).toBe("USD");
    expect(
      option?.tooltip?.formatter?.([{ axisValue: "2030-01-15" }]),
    ).toContain("$125,000,000,000.25");
    expect(chart.observe).toHaveBeenCalledWith(hooks.chartElement);
    cleanup?.();
    expect(chart.disconnect).toHaveBeenCalledOnce();
    expect(chart.dispose).toHaveBeenCalledOnce();
  });

  it("describes all-unknown and empty series honestly", () => {
    expect(
      summarizeValuationHistory(points(), "enterpriseValue", "ZERO"),
    ).toContain("provider supplied no values");
    expect(summarizeValuationHistory([], "priceToBook", "ZERO")).toBe(
      "ZERO has no p/b (provider) observations in this range.",
    );
  });
});

function points(): readonly PersonalValuationHistoryPointDto[] {
  return [point("2030-01-14", false), point("2030-01-15", true)];
}

function point(date: string, known: boolean): PersonalValuationHistoryPointDto {
  const unknownRatio = {
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
    },
    marketCapitalization: known
      ? { status: "known", unit: "USD", value: "125000000000.25" }
      : {
          reason: "not_supplied_by_provider",
          status: "unknown",
          unit: "USD",
          value: null,
        },
    priceToBook: unknownRatio,
    priceToEarnings: known
      ? { status: "known", unit: "ratio", value: "24.125" }
      : unknownRatio,
    trailingPeg1Y: unknownRatio,
  };
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
