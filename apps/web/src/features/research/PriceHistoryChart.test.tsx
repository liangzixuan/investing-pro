import type { PersonalMarketDataDailyBarDto } from "@research-cockpit/contracts";
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

import { PriceHistoryChart, summarizePriceHistory } from "./PriceHistoryChart";

afterEach(() => {
  hooks.reset();
  for (const mock of Object.values(chart)) mock.mockReset();
  vi.unstubAllGlobals();
});

describe("PriceHistoryChart", () => {
  it("renders a semantic summary and exact adjusted-data table", () => {
    const rendered = PriceHistoryChart({
      bars: bars(),
      mode: "adjusted",
      symbol: "ZERO",
    });
    const text = textContent(rendered);

    expect(text).toContain("ZERO adjusted close history");
    expect(text).toContain("2 sessions");
    expect(text).toContain("1 corporate-action session");
    expect(text).toContain("Inspect exact price, volume, and action data");
    expect(text).toContain("100.25");
    expect(text).toContain("0.25");
    expect(text).toContain("2");
    expect(
      findAllElements(rendered, "div").find(
        (element) => element.props.role === "img",
      )?.props["aria-label"],
    ).toContain("ZERO adjusted close history");
  });

  it("initializes, resizes, disables motion, and disposes ECharts", () => {
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

    PriceHistoryChart({ bars: bars(), mode: "raw", symbol: "ZERO" });
    const cleanup = hooks.runEffect();

    expect(chart.init).toHaveBeenCalledWith(hooks.chartElement, undefined, {
      renderer: "canvas",
    });
    const option = chart.setOption.mock.calls[0]?.[0] as
      | {
          animation?: unknown;
          aria?: { enabled?: unknown };
          series?: readonly { name?: unknown; type?: unknown }[];
        }
      | undefined;
    expect(option?.animation).toBe(false);
    expect(option?.aria?.enabled).toBe(true);
    expect(option?.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Raw close", type: "line" }),
        expect.objectContaining({ name: "Raw volume", type: "bar" }),
      ]),
    );
    expect(chart.observe).toHaveBeenCalledWith(hooks.chartElement);
    cleanup?.();
    expect(chart.disconnect).toHaveBeenCalledOnce();
    expect(chart.dispose).toHaveBeenCalledOnce();
  });

  it("returns an honest empty-history state", () => {
    expect(summarizePriceHistory([], "raw", "ZERO")).toBe(
      "ZERO has no price history in this range.",
    );
    expect(
      textContent(PriceHistoryChart({ bars: [], mode: "raw", symbol: "ZERO" })),
    ).toContain("No price-history sessions are available");
  });
});

function bars(): readonly PersonalMarketDataDailyBarDto[] {
  return [
    {
      adjusted: ohlcv("100.25", "900"),
      date: "2030-01-14",
      dividendCash: "0",
      raw: ohlcv("50.125", "450"),
      splitFactor: "1",
    },
    {
      adjusted: ohlcv("102.50", "1000"),
      date: "2030-01-15",
      dividendCash: "0.25",
      raw: ohlcv("51.25", "500"),
      splitFactor: "2",
    },
  ];
}

function ohlcv(close: string, volume: string) {
  return {
    close,
    high: "103.00",
    low: "49.00",
    open: "100.00",
    volume,
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
