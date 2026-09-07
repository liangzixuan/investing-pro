"use client";

import type { PersonalMarketDataDailyBarDto } from "@research-cockpit/contracts";
import * as echarts from "echarts";
import { useEffect, useRef } from "react";

export type PriceAdjustmentMode = "adjusted" | "raw";

export function PriceHistoryChart({
  bars,
  mode,
  symbol,
}: {
  readonly bars: readonly PersonalMarketDataDailyBarDto[];
  readonly mode: PriceAdjustmentMode;
  readonly symbol: string;
}) {
  const chartElement = useRef<HTMLDivElement>(null);
  const summary = summarizePriceHistory(bars, mode, symbol);

  useEffect(() => {
    if (chartElement.current === null || bars.length === 0) return;
    const chart = echarts.init(chartElement.current, undefined, {
      renderer: "canvas",
    });
    chart.setOption(priceHistoryChartOption(bars, mode, summary));

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => chart.resize());
    observer?.observe(chartElement.current);
    return () => {
      observer?.disconnect();
      chart.dispose();
    };
  }, [bars, mode, summary]);

  if (bars.length === 0) {
    return (
      <p className="market-chart-empty" role="status">
        No price-history sessions are available for this range.
      </p>
    );
  }

  return (
    <div className="price-history-chart">
      <p className="market-chart-summary">{summary}</p>
      <div
        aria-label={summary}
        className="market-chart-canvas"
        ref={chartElement}
        role="img"
      />
      <details className="data-table-disclosure market-data-table">
        <summary>Inspect exact price, volume, and action data</summary>
        <div className="table-scroll" tabIndex={0}>
          <table>
            <caption>
              {symbol} {mode} daily price and volume history in USD
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Open</th>
                <th scope="col">High</th>
                <th scope="col">Low</th>
                <th scope="col">Close</th>
                <th scope="col">Volume</th>
                <th scope="col">Dividend</th>
                <th scope="col">Split factor</th>
              </tr>
            </thead>
            <tbody>
              {bars.map((bar) => {
                const values = bar[mode];
                return (
                  <tr key={bar.date}>
                    <th scope="row">{bar.date}</th>
                    <td>{values.open}</td>
                    <td>{values.high}</td>
                    <td>{values.low}</td>
                    <td>{values.close}</td>
                    <td>{values.volume}</td>
                    <td>{bar.dividendCash}</td>
                    <td>{bar.splitFactor}</td>
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

export function summarizePriceHistory(
  bars: readonly PersonalMarketDataDailyBarDto[],
  mode: PriceAdjustmentMode,
  symbol: string,
): string {
  if (bars.length === 0) return `${symbol} has no price history in this range.`;
  const closes = bars.map((bar) => Number(bar[mode].close));
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const first = bars[0];
  const last = bars.at(-1);
  if (first === undefined || last === undefined) {
    return `${symbol} has no price history in this range.`;
  }
  const actionCount = bars.filter(
    (bar) => Number(bar.dividendCash) !== 0 || Number(bar.splitFactor) !== 1,
  ).length;
  return `${symbol} ${mode} close history from ${first.date} through ${last.date}: ${bars.length.toLocaleString("en-US")} sessions, close range ${formatUsd(low)} to ${formatUsd(high)}, ${actionCount.toLocaleString("en-US")} corporate-action ${actionCount === 1 ? "session" : "sessions"}.`;
}

function priceHistoryChartOption(
  bars: readonly PersonalMarketDataDailyBarDto[],
  mode: PriceAdjustmentMode,
  summary: string,
) {
  const dates = bars.map((bar) => bar.date);
  const closes = bars.map((bar) => Number(bar[mode].close));
  const volumes = bars.map((bar) => Number(bar[mode].volume));
  const actions = bars.flatMap((bar) => {
    const labels: string[] = [];
    if (Number(bar.dividendCash) !== 0) {
      labels.push(`Dividend ${bar.dividendCash}`);
    }
    if (Number(bar.splitFactor) !== 1) {
      labels.push(`Split ${bar.splitFactor}`);
    }
    return labels.length === 0
      ? []
      : [
          {
            coord: [bar.date, Number(bar[mode].close)],
            name: labels.join(" · "),
            value:
              labels.length > 1
                ? "A"
                : labels[0]?.startsWith("Dividend")
                  ? "D"
                  : "S",
          },
        ];
  });
  return {
    animation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    aria: { description: summary, enabled: true },
    color: ["#176b56", "#163146"],
    dataZoom: [{ type: "inside", xAxisIndex: [0, 1] }],
    grid: [
      { bottom: 112, left: 62, right: 24, top: 28 },
      { bottom: 42, height: 48, left: 62, right: 24 },
    ],
    tooltip: {
      axisPointer: { type: "cross" },
      backgroundColor: "#172321",
      borderWidth: 0,
      textStyle: { color: "#f5f2e9" },
      trigger: "axis",
    },
    xAxis: [
      {
        axisLabel: { color: "#626b67", hideOverlap: true },
        axisLine: { lineStyle: { color: "#cad1cc" } },
        axisTick: { show: false },
        data: dates,
        gridIndex: 0,
        type: "category",
      },
      {
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        data: dates,
        gridIndex: 1,
        type: "category",
      },
    ],
    yAxis: [
      {
        axisLabel: { color: "#626b67", formatter: "${value}" },
        gridIndex: 0,
        name: "USD",
        nameTextStyle: { color: "#78817d" },
        scale: true,
        splitLine: { lineStyle: { color: "#e9e7df" } },
        type: "value",
      },
      {
        axisLabel: { color: "#626b67" },
        gridIndex: 1,
        name: "Volume",
        nameTextStyle: { color: "#78817d" },
        splitLine: { show: false },
        type: "value",
      },
    ],
    series: [
      {
        data: closes,
        lineStyle: { width: 2.5 },
        markPoint: {
          data: actions,
          label: { color: "#fffdf8", fontSize: 10, fontWeight: 800 },
          symbol: "pin",
          symbolSize: 34,
        },
        name: mode === "adjusted" ? "Adjusted close" : "Raw close",
        showSymbol: false,
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
      },
      {
        data: volumes,
        name: mode === "adjusted" ? "Adjusted volume" : "Raw volume",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
      },
    ],
  };
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}
