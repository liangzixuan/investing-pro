"use client";

import type { PersonalSecurityMasterScreenRowDto } from "@research-cockpit/contracts";
import type { PersonalPricePerformanceComparisonAvailableResult } from "@research-cockpit/personal-market-analytics";
import * as echarts from "echarts";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 25;
const MAXIMUM_PLOT_INDEX_SCALED = BigInt(Number.MAX_SAFE_INTEGER) * 10_000n;
const SERIES_STYLES = [
  { color: "#176b56", line: "solid", symbol: "circle", marker: "●" },
  { color: "#315b91", line: "dashed", symbol: "diamond", marker: "◆" },
  { color: "#a35417", line: "dotted", symbol: "triangle", marker: "▲" },
] as const;

export interface PersonalComparisonPriceChartProps {
  readonly result: PersonalPricePerformanceComparisonAvailableResult;
  readonly listings: readonly PersonalSecurityMasterScreenRowDto[];
}

export function PersonalComparisonPriceChart({
  result,
  listings,
}: PersonalComparisonPriceChartProps) {
  const chartElement = useRef<HTMLDivElement>(null);
  const [inspection, setInspection] = useState({
    result,
    open: false,
    page: 0,
    failed: false,
  });
  const current =
    inspection.result === result
      ? inspection
      : { result, open: false, page: 0, failed: false };
  // Replace obsolete history references, as well as resetting visible state.
  // Same-result renders (including table paging) preserve the current inspection.
  if (inspection.result !== result) setInspection(current);
  const numericSeries = useMemo(() => plotValues(result), [result]);
  const labelsKey = JSON.stringify(listingLabels(result, listings));
  const labels = useMemo(() => JSON.parse(labelsKey) as string[], [labelsKey]);
  const unavailable = numericSeries === null || current.failed;
  const summary = `${labels.join("; ")}: indexed adjusted closes from ${result.firstDate} to ${result.lastDate}, ${result.sharedSessionCount} shared observations. First shared date = 100.`;

  useEffect(() => {
    if (chartElement.current === null || numericSeries === null || unavailable)
      return;
    let chart: echarts.ECharts | null = null;
    let observer: ResizeObserver | null = null;
    let disposed = false;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const resize = () => {
      if (!disposed) chart?.resize();
    };
    const changeMotion = (event: MediaQueryListEvent) => {
      if (!disposed) chart?.setOption({ animation: !event.matches });
    };
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      motion?.removeEventListener?.("change", changeMotion);
      chart?.dispatchAction({ type: "hideTip" });
      chart?.dispose();
    };
    try {
      chart = echarts.init(chartElement.current, undefined, {
        renderer: "canvas",
      });
      chart.setOption(
        chartOption(result, labels, numericSeries, summary, !motion?.matches),
      );
      if (typeof ResizeObserver === "undefined") {
        window.addEventListener("resize", resize);
      } else {
        observer = new ResizeObserver(resize);
        observer.observe(chartElement.current);
      }
      motion?.addEventListener?.("change", changeMotion);
    } catch {
      cleanup();
      setInspection({ result, open: false, page: 0, failed: true });
    }
    return cleanup;
  }, [labels, numericSeries, result, summary, unavailable]);

  const pageCount = Math.ceil(result.sharedSessionCount / PAGE_SIZE);
  const start = current.page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, result.sharedSessionCount);

  return (
    <section
      className="comparison-price-chart"
      aria-label="Indexed adjusted-price comparison"
    >
      <h6>Indexed adjusted-price comparison</h6>
      <p>Indexed adjusted close (first shared date = 100)</p>
      <ul
        className="comparison-price-chart-legend"
        aria-label="Company line styles"
      >
        {labels.map((label, index) => {
          const style = SERIES_STYLES[index]!;
          return (
            <li key={result.rows[index]!.listingId}>
              <span
                aria-hidden="true"
                className={`comparison-price-chart-key comparison-price-chart-key--${style.line}`}
                style={{ color: style.color }}
              >
                {style.marker}
              </span>
              {label} · {style.line} line, {style.symbol} markers
            </li>
          );
        })}
      </ul>
      {unavailable ? (
        <p role="status">
          Chart unavailable: one or more indexed values cannot be safely
          plotted, or the chart could not be displayed. Exact values and
          comparison metrics remain available.
        </p>
      ) : (
        <div
          className="comparison-price-chart-canvas"
          ref={chartElement}
          role="img"
          aria-label={summary}
        />
      )}
      <p className="market-scope-note">
        Index = 100 × adjusted close / first shared adjusted close, rounded to
        four decimal places. Chart coordinates are approximations; inspect the
        exact strings below. Straight lines only guide the eye between observed
        points. Dates are spaced by observation; calendar gaps are not
        represented. Missing dates are not filled, and omitted observations can
        hide declines. An index is not a USD price, invested wealth, benchmark
        or total return.
      </p>
      <details
        className="data-table-disclosure comparison-price-chart-data"
        open={current.open}
        onToggle={(event) =>
          setInspection({
            ...current,
            open: event.currentTarget.open,
          })
        }
      >
        <summary>
          Inspect exact adjusted closes and index values (
          {result.sharedSessionCount} observations)
        </summary>
        {current.open && (
          <>
            <div
              className="comparison-price-chart-pagination"
              aria-label="Exact-data pages"
            >
              <button
                type="button"
                disabled={current.page === 0}
                onClick={() =>
                  setInspection({
                    ...current,
                    open: true,
                    page: current.page - 1,
                  })
                }
              >
                Previous dates
              </button>
              <p role="status">
                Observations {start + 1}–{end} of {result.sharedSessionCount} ·
                Page {current.page + 1} of {pageCount}
              </p>
              <button
                type="button"
                disabled={current.page + 1 >= pageCount}
                onClick={() =>
                  setInspection({
                    ...current,
                    open: true,
                    page: current.page + 1,
                  })
                }
              >
                Next dates
              </button>
            </div>
            <div
              className="comparison-price-chart-table-wrap"
              role="region"
              aria-label="Exact shared-date adjusted closes and index values"
              tabIndex={0}
            >
              <table>
                <caption>
                  Shared observations {start + 1}–{end} of{" "}
                  {result.sharedSessionCount}; adjusted closes in USD and index
                  values with first shared date = 100.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    {labels.map((label, index) => (
                      <Fragment key={result.rows[index]!.listingId}>
                        <th scope="col">{label} adjusted close (USD)</th>
                        <th scope="col">{label} index</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.sharedDates.slice(start, end).map((date, offset) => (
                    <tr key={date}>
                      <th scope="row">
                        <time dateTime={date}>{date}</time>
                      </th>
                      {result.rows.map((row) => (
                        <Fragment key={row.listingId}>
                          <td>
                            {row.indexedObservations[start + offset]
                              ?.adjustedClose ?? "Unavailable"}
                          </td>
                          <td>
                            {row.indexedObservations[start + offset]
                              ?.indexedAdjustedClose ?? "Unavailable"}
                          </td>
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </details>
    </section>
  );
}

function plotValues(
  result: PersonalPricePerformanceComparisonAvailableResult,
): number[][] | null {
  const series: number[][] = [];
  for (const row of result.rows) {
    if (row.indexedObservations.length !== result.sharedDates.length)
      return null;
    const values: number[] = [];
    for (const [index, point] of row.indexedObservations.entries()) {
      if (!/^\d+\.\d{4}$/u.test(point.indexedAdjustedClose)) return null;
      // Compare the exact fixed-four decimal before native-number rounding can
      // hide a value just beyond MAX_SAFE_INTEGER (for example, +0.0001).
      const scaled = BigInt(point.indexedAdjustedClose.replace(".", ""));
      if (scaled <= 0n || scaled > MAXIMUM_PLOT_INDEX_SCALED) return null;
      const value = Number(point.indexedAdjustedClose);
      // Positive source closes may round to a zero index. Do not plot that as a
      // genuine zero, or coerce an unsafe magnitude into a finite coordinate.
      if (
        point.date !== result.sharedDates[index] ||
        !Number.isFinite(value) ||
        value <= 0 ||
        value > Number.MAX_SAFE_INTEGER
      )
        return null;
      values.push(value);
    }
    series.push(values);
  }
  return series;
}

function listingLabels(
  result: PersonalPricePerformanceComparisonAvailableResult,
  listings: readonly PersonalSecurityMasterScreenRowDto[],
): string[] {
  const labels = result.rows.map((row) => {
    const listing = listings.find((item) => item.listingId === row.listingId);
    return listing
      ? `${listing.symbol} · ${listing.exchangeMic}`
      : row.listingId;
  });
  return labels.map((label, index) =>
    labels.filter((value) => value === label).length > 1
      ? `${label} (${result.rows[index]!.listingId})`
      : label,
  );
}

function chartOption(
  result: PersonalPricePerformanceComparisonAvailableResult,
  labels: readonly string[],
  numericSeries: readonly number[][],
  summary: string,
  animation: boolean,
) {
  return {
    animation,
    aria: { enabled: true, description: summary },
    grid: { left: 72, right: 16, top: 24, bottom: 48, containLabel: true },
    tooltip: {
      trigger: "axis",
      renderMode: "richText",
      axisPointer: { type: "line", snap: true },
      confine: true,
      padding: 8,
      textStyle: { fontSize: 12, lineHeight: 14 },
      formatter: (params: unknown) => {
        const item: unknown = Array.isArray(params) ? params[0] : params;
        if (
          !item ||
          typeof item !== "object" ||
          !("dataIndex" in item) ||
          typeof item.dataIndex !== "number" ||
          !Number.isInteger(item.dataIndex) ||
          item.dataIndex < 0 ||
          item.dataIndex >= result.sharedDates.length
        )
          return "Observation unavailable";
        const index = item.dataIndex;
        const lines = [
          result.sharedDates[index],
          ...result.rows.flatMap((row, rowIndex) => {
            const point = row.indexedObservations[index]!;
            return [
              ...tooltipLines(labels[rowIndex]!),
              ...tooltipLines(`Index: ${point.indexedAdjustedClose}`),
              ...tooltipLines(`Adjusted USD: ${point.adjustedClose}`),
            ];
          }),
        ];
        return lines.length > 12
          ? `${result.sharedDates[index]}\nLong values: inspect the\nexact-data table below.`
          : lines.join("\n");
      },
    },
    xAxis: {
      type: "category",
      data: [...result.sharedDates],
      boundaryGap: false,
      name: "Shared observation date",
      nameLocation: "middle",
      nameGap: 32,
      axisLabel: {
        hideOverlap: true,
        alignMinLabel: "left",
        alignMaxLabel: "right",
        color: "#626b67",
      },
    },
    yAxis: {
      type: "value",
      name: "Indexed adjusted close\n(first shared date = 100)",
      nameLocation: "middle",
      nameGap: 54,
      nameTextStyle: { fontSize: 11 },
      scale: true,
      axisLabel: { color: "#626b67" },
      splitLine: { lineStyle: { color: "#e9e7df" } },
    },
    series: numericSeries.map((data, index) => ({
      id: result.rows[index]!.listingId,
      name: labels[index],
      type: "line",
      data,
      smooth: false,
      connectNulls: false,
      showSymbol: result.sharedSessionCount <= 100,
      symbol: SERIES_STYLES[index]!.symbol,
      symbolSize: 6,
      lineStyle: {
        color: SERIES_STYLES[index]!.color,
        type: SERIES_STYLES[index]!.line,
        width: 2,
      },
      itemStyle: { color: SERIES_STYLES[index]!.color },
    })),
  };
}

function tooltipLines(value: string): string[] {
  return value.match(/.{1,22}/gu) ?? [];
}
