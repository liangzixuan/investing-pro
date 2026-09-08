"use client";

import type { PersonalValuationHistoryPointDto } from "@research-cockpit/contracts";
import * as echarts from "echarts";
import { useEffect, useRef } from "react";

export type ValuationHistoryMetric =
  | "enterpriseValue"
  | "marketCapitalization"
  | "priceToBook"
  | "priceToEarnings"
  | "trailingPeg1Y";

export const VALUATION_HISTORY_METRICS = Object.freeze({
  enterpriseValue: Object.freeze({ label: "Enterprise value", unit: "USD" }),
  marketCapitalization: Object.freeze({
    label: "Market capitalization",
    unit: "USD",
  }),
  priceToBook: Object.freeze({ label: "P/B (provider)", unit: "ratio" }),
  priceToEarnings: Object.freeze({ label: "P/E (provider)", unit: "ratio" }),
  trailingPeg1Y: Object.freeze({ label: "Trailing PEG 1Y", unit: "ratio" }),
} satisfies Readonly<
  Record<
    ValuationHistoryMetric,
    Readonly<{ label: string; unit: "USD" | "ratio" }>
  >
>);

export function ValuationHistoryChart({
  metric,
  points,
  symbol,
}: {
  readonly metric: ValuationHistoryMetric;
  readonly points: readonly PersonalValuationHistoryPointDto[];
  readonly symbol: string;
}) {
  const chartElement = useRef<HTMLDivElement>(null);
  const summary = summarizeValuationHistory(points, metric, symbol);

  useEffect(() => {
    if (chartElement.current === null || points.length === 0) return;
    const chart = echarts.init(chartElement.current, undefined, {
      renderer: "svg",
    });
    chart.setOption(valuationHistoryChartOption(points, metric, summary));
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => chart.resize());
    observer?.observe(chartElement.current);
    return () => {
      observer?.disconnect();
      chart.dispose();
    };
  }, [metric, points, summary]);

  const definition = VALUATION_HISTORY_METRICS[metric];
  return (
    <div className="valuation-history-chart">
      <p className="market-chart-summary">{summary}</p>
      <div
        aria-label={summary}
        className="valuation-chart-canvas"
        ref={chartElement}
        role="img"
      />
      <details className="data-table-disclosure valuation-data-table">
        <summary>
          Inspect exact {definition.label.toLowerCase()} history
        </summary>
        <div className="table-scroll" tabIndex={0}>
          <table>
            <caption>
              {symbol} {definition.label} daily history · {definition.unit}
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Exact value</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => {
                const cell = point[metric];
                return (
                  <tr key={point.date}>
                    <th scope="row">{point.date}</th>
                    <td>
                      {cell.status === "known"
                        ? formatExactValue(cell.value, definition.unit)
                        : "Unknown — not supplied by provider"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function summarizeValuationHistory(
  points: readonly PersonalValuationHistoryPointDto[],
  metric: ValuationHistoryMetric,
  symbol: string,
): string {
  const definition = VALUATION_HISTORY_METRICS[metric];
  const known = points.filter((point) => point[metric].status === "known");
  if (points.length === 0) {
    return `${symbol} has no ${definition.label.toLowerCase()} observations in this range.`;
  }
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined) {
    return `${symbol} has no ${definition.label.toLowerCase()} observations in this range.`;
  }
  return `${symbol} ${definition.label} from ${first.date} through ${last.date}: ${known.length.toLocaleString("en-US")} known of ${points.length.toLocaleString("en-US")} daily observations${known.length === 0 ? "; the provider supplied no values for this metric" : ""}.`;
}

function valuationHistoryChartOption(
  points: readonly PersonalValuationHistoryPointDto[],
  metric: ValuationHistoryMetric,
  summary: string,
) {
  const definition = VALUATION_HISTORY_METRICS[metric];
  const exactByDate = new Map(
    points.flatMap((point) => {
      const cell = point[metric];
      return cell.status === "known" ? [[point.date, cell.value] as const] : [];
    }),
  );
  return {
    animation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    aria: { description: summary, enabled: true },
    color: ["#176b56"],
    dataZoom: [{ type: "inside" }],
    grid: { bottom: 48, left: 76, right: 24, top: 28 },
    tooltip: {
      axisPointer: { type: "cross" },
      backgroundColor: "#172321",
      borderWidth: 0,
      formatter: (params: unknown) => {
        const item: unknown = Array.isArray(params)
          ? (params as unknown[])[0]
          : params;
        if (!isTooltipItem(item)) return "Value unavailable";
        const exact = exactByDate.get(item.axisValue);
        return exact === undefined
          ? `${item.axisValue}<br/>${definition.label}: Unknown`
          : `${item.axisValue}<br/>${definition.label}: ${formatExactValue(exact, definition.unit)}`;
      },
      textStyle: { color: "#f5f2e9" },
      trigger: "axis",
    },
    xAxis: {
      axisLabel: { color: "#626b67", hideOverlap: true },
      axisLine: { lineStyle: { color: "#cad1cc" } },
      axisTick: { show: false },
      data: points.map((point) => point.date),
      type: "category",
    },
    yAxis: {
      axisLabel: {
        color: "#626b67",
        formatter: definition.unit === "USD" ? compactUsdAxisLabel : "{value}",
      },
      name: definition.unit,
      nameTextStyle: { color: "#78817d" },
      scale: true,
      splitLine: { lineStyle: { color: "#e9e7df" } },
      type: "value",
    },
    series: [
      {
        connectNulls: false,
        data: points.map((point) => {
          const cell = point[metric];
          return cell.status === "known" ? Number(cell.value) : null;
        }),
        lineStyle: { width: 2.5 },
        name: definition.label,
        showSymbol: false,
        type: "line",
      },
    ],
  };
}

function isTooltipItem(
  value: unknown,
): value is { readonly axisValue: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "axisValue" in value &&
    typeof value.axisValue === "string"
  );
}

function compactUsdAxisLabel(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  const absolute = Math.abs(numeric);
  if (absolute >= 1_000_000_000_000)
    return `$${String(numeric / 1_000_000_000_000)}T`;
  if (absolute >= 1_000_000_000) return `$${String(numeric / 1_000_000_000)}B`;
  if (absolute >= 1_000_000) return `$${String(numeric / 1_000_000)}M`;
  return `$${String(numeric)}`;
}

function formatExactValue(value: string, unit: "USD" | "ratio"): string {
  return unit === "USD" ? formatExactUsd(value) : `${value}×`;
}

function formatExactUsd(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${negative ? "−" : ""}$${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}
