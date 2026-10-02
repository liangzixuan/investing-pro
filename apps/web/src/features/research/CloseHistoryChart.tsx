import type { ManagedEodCloseDto } from "@research-cockpit/contracts";
import * as echarts from "echarts";
import { useEffect, useRef } from "react";

export function CloseHistoryChart({
  rows,
  symbol,
}: {
  rows: readonly ManagedEodCloseDto[];
  symbol: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current || !rows.length) return;
    const chart = echarts.init(element.current, undefined, {
      renderer: "canvas",
    });
    chart.setOption({
      animation: false,
      aria: { enabled: true },
      grid: { left: 64, right: 20, top: 24, bottom: 48 },
      xAxis: {
        type: "category",
        data: rows.map((row) => row.date),
        axisLabel: { hideOverlap: true },
      },
      yAxis: {
        type: "value",
        name: "USD",
        scale: true,
        axisLabel: { hideOverlap: true },
      },
      series: [
        {
          name: "Raw close",
          type: "line",
          data: rows.map((row) => Number(row.close)),
          showSymbol: rows.length <= 10,
        },
      ],
    });
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => chart.resize());
    observer?.observe(element.current);
    return () => {
      observer?.disconnect();
      chart.dispose();
    };
  }, [rows, symbol]);
  return (
    <div className="managed-eod-chart">
      <div
        ref={element}
        className="managed-eod-chart-canvas"
        role="img"
        aria-label={`${symbol} one-month raw close history in USD; exact values follow in the table`}
      />
      <div className="managed-eod-table-scroll">
        <table>
          <caption>One-month raw closing prices in USD</caption>
          <thead>
            <tr>
              <th scope="col">Trading date</th>
              <th scope="col">Raw close (USD)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <th scope="row">{row.date}</th>
                <td>{row.close}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
