import type { ManagedEodCloseDto } from "@research-cockpit/contracts";
import * as echarts from "echarts";
import { useEffect, useRef, type ReactNode } from "react";
import { RawCloseComparison } from "./RawCloseComparison";

const rawCloseSeriesId = "managed-raw-close";

function closeTooltip(
  params: echarts.TooltipComponentFormatterCallbackParams,
  rows: readonly ManagedEodCloseDto[],
  document: Document,
): HTMLElement | string {
  const points = Array.isArray(params) ? params : [params];
  const point = points[0];
  if (
    points.length !== 1 ||
    !point ||
    point.componentType !== "series" ||
    point.seriesType !== "line" ||
    point.seriesId !== rawCloseSeriesId ||
    point.seriesIndex !== 0 ||
    !Number.isInteger(point.dataIndex)
  ) {
    return "";
  }
  const row = rows[point.dataIndex];
  if (!row || point.name !== row.date) return "";

  const tooltip = document.createElement("div");
  tooltip.className = "managed-eod-tooltip";
  tooltip.setAttribute("role", "tooltip");
  const date = document.createElement("strong");
  date.className = "managed-eod-tooltip-date";
  date.textContent = row.date;
  const close = document.createElement("div");
  close.className = "managed-eod-tooltip-close";
  close.textContent = `Raw close (USD): ${row.close}`;
  tooltip.append(date, close);
  return tooltip;
}

export function CloseHistoryChart({
  rows,
  symbol,
  renderAction,
  appearance,
  actions,
}: {
  rows: readonly ManagedEodCloseDto[];
  symbol: string;
  renderAction?:
    | ((start: ManagedEodCloseDto, isCurrent: () => boolean) => ReactNode)
    | undefined;
  appearance?: "precision-desk";
  actions?: ReactNode;
}) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = element.current;
    if (!container || !rows.length) return;
    const precisionDesk = appearance === "precision-desk";
    let active = true;
    const chart = echarts.init(container, undefined, {
      renderer: "canvas",
    });
    chart.setOption({
      animation: false,
      aria: { enabled: true },
      ...(precisionDesk
        ? { color: ["#8796ff"], textStyle: { color: "#aeb4c0" } }
        : {}),
      grid: { left: 64, right: 20, top: 24, bottom: 48 },
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove|click",
        renderMode: "html",
        confine: true,
        ...(precisionDesk
          ? {
              backgroundColor: "#191b1f",
              borderColor: "#2c2f36",
              textStyle: { color: "#f2f3f5" },
            }
          : {}),
        axisPointer: { type: "line", axis: "x", label: { show: false } },
        extraCssText:
          "max-width: calc(100% - 16px); box-sizing: border-box; white-space: normal;",
        formatter: (params: echarts.TooltipComponentFormatterCallbackParams) =>
          active ? closeTooltip(params, rows, container.ownerDocument) : "",
      },
      xAxis: {
        type: "category",
        data: rows.map((row) => row.date),
        axisLabel: {
          hideOverlap: true,
          ...(precisionDesk ? { color: "#aeb4c0" } : {}),
        },
        ...(precisionDesk
          ? {
              axisLine: { lineStyle: { color: "#2c2f36" } },
              axisTick: { show: false },
            }
          : {}),
      },
      yAxis: {
        type: "value",
        name: "USD",
        scale: true,
        axisLabel: {
          hideOverlap: true,
          ...(precisionDesk ? { color: "#aeb4c0" } : {}),
        },
        ...(precisionDesk
          ? {
              nameTextStyle: { color: "#aeb4c0" },
              splitLine: { lineStyle: { color: "#2c2f36" } },
            }
          : {}),
      },
      series: [
        {
          id: rawCloseSeriesId,
          name: "Raw close",
          type: "line",
          data: rows.map((row) => Number(row.close)),
          showSymbol: rows.length <= 10,
          ...(precisionDesk
            ? {
                lineStyle: { color: "#8796ff", width: 2 },
                itemStyle: { color: "#8796ff" },
                areaStyle: { color: "rgba(135, 150, 255, 0.12)" },
              }
            : {}),
        },
      ],
    });
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => chart.resize());
    observer?.observe(container);
    return () => {
      active = false;
      observer?.disconnect();
      chart.dispose();
    };
  }, [rows, symbol, appearance]);
  const exactValues = (
    <div
      className="managed-eod-table-scroll"
      role="region"
      tabIndex={0}
      aria-label={`${symbol} exact raw closing prices`}
    >
      <table>
        <caption>One-month raw closing prices in USD</caption>
        <thead>
          <tr>
            <th scope="col">Trading date</th>
            <th scope="col" className="managed-numeric">
              Raw close (USD)
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <th scope="row">{row.date}</th>
              <td className="managed-numeric">{row.close}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const help = (
    <p className="managed-eod-chart-help">
      Point to or tap the chart to inspect a dated raw close. Exact values are
      also listed below.
    </p>
  );
  return (
    <div className="managed-eod-chart">
      {appearance !== "precision-desk" && help}
      <div
        ref={element}
        className="managed-eod-chart-canvas"
        role="img"
        aria-label={`${symbol} one-month raw close history in USD; exact values follow in the table`}
      />
      {appearance === "precision-desk" && help}
      {actions}
      <RawCloseComparison
        rows={rows}
        symbol={symbol}
        renderAction={renderAction}
      />
      {appearance === "precision-desk" ? (
        <details className="managed-eod-exact-values">
          <summary>Exact closing values</summary>
          {exactValues}
        </details>
      ) : (
        exactValues
      )}
    </div>
  );
}
