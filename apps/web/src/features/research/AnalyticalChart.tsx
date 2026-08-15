"use client";

import type { HistoricalPointDto } from "@research-cockpit/contracts";
import * as echarts from "echarts";
import { useEffect, useRef } from "react";

import type { EvidenceSelection } from "./evidence-selection";

export function AnalyticalChart({
  history,
  onInspect,
}: {
  history: HistoricalPointDto[];
  onInspect: (selection: EvidenceSelection) => void;
}) {
  const chartElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartElement.current) return;
    const chart = echarts.init(chartElement.current, undefined, {
      renderer: "canvas",
    });
    chart.setOption({
      animation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      aria: {
        enabled: true,
        description:
          "Synthetic annual revenue shown as bars and adjusted EBITDA shown as a line from 2022 through 2025. Exact values are available in the table below.",
      },
      color: ["#78c8b0", "#ff8b6a"],
      grid: { top: 44, right: 20, bottom: 36, left: 54 },
      legend: {
        top: 4,
        right: 8,
        textStyle: { color: "#49524f", fontSize: 12 },
      },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: unknown) => `$${String(value)}M`,
        backgroundColor: "#172321",
        borderWidth: 0,
        textStyle: { color: "#f5f2e9" },
      },
      xAxis: {
        type: "category",
        data: history.map((point) => point.period),
        axisLine: { lineStyle: { color: "#cad1cc" } },
        axisTick: { show: false },
        axisLabel: { color: "#626b67" },
      },
      yAxis: {
        type: "value",
        name: "USD millions",
        nameTextStyle: { color: "#78817d" },
        splitLine: { lineStyle: { color: "#e9e7df" } },
        axisLabel: { color: "#626b67" },
      },
      series: [
        {
          name: "Revenue",
          type: "bar",
          data: history.map((point) => point.revenue),
          barMaxWidth: 34,
          itemStyle: { borderRadius: [7, 7, 0, 0] },
        },
        {
          name: "Adjusted EBITDA",
          type: "line",
          data: history.map((point) => point.ebitda),
          symbol: "circle",
          symbolSize: 8,
          lineStyle: { width: 3 },
        },
      ],
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(chartElement.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [history]);

  return (
    <div>
      <div
        className="chart-canvas"
        ref={chartElement}
        role="img"
        aria-label="Synthetic revenue and adjusted EBITDA history. Exact values follow in a table."
      />
      <details className="data-table-disclosure">
        <summary>Inspect chart data and evidence</summary>
        <div className="table-scroll" tabIndex={0}>
          <table>
            <caption>
              Annual synthetic revenue and adjusted EBITDA, USD millions
            </caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Revenue</th>
                <th scope="col">EBITDA</th>
                <th scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {history.map((point) => (
                <tr key={point.period}>
                  <th scope="row">{point.period}</th>
                  <td>{point.revenueDisplay}</td>
                  <td>{point.ebitdaDisplay}</td>
                  <td>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() =>
                        onInspect({
                          title: `${point.period} chart values`,
                          formula:
                            "Synthetic fixture values; no external market data",
                          formulaInputs: [],
                          evidenceIds: point.evidenceIds,
                        })
                      }
                    >
                      Open passport
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
