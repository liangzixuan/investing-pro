"use client";

import { PERSONAL_FINANCIAL_REPORTED_FIELDS } from "@research-cockpit/personal-financial-analytics";
import * as echarts from "echarts";
import { useEffect, useRef, useState } from "react";
import {
  PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS,
  type PersonalAnnualFinancialTrendField,
  type PersonalAnnualFinancialTrendProjection,
  type PersonalAnnualFinancialTrendSlot,
} from "./personal-annual-financial-trend-input";

type ReadyProjection = Extract<
  PersonalAnnualFinancialTrendProjection,
  { status: "ready" }
>;

export interface PersonalAnnualFinancialTrendProps {
  readonly projection: ReadyProjection;
}

export function PersonalAnnualFinancialTrend({
  projection,
}: PersonalAnnualFinancialTrendProps) {
  const chartElement = useRef<HTMLDivElement>(null);
  const [field, setField] =
    useState<PersonalAnnualFinancialTrendField>("revenue");
  const [failure, setFailure] = useState<{
    contentKey: string;
    field: PersonalAnnualFinancialTrendField;
  } | null>(null);
  const { contentKey } = projection;
  const failed = failure?.contentKey === contentKey && failure.field === field;
  if (failure !== null && !failed) setFailure(null);
  const plot = projection.plots[field];
  const unavailable = plot.status === "unavailable" || failed;
  const label = fieldLabel(field);
  const summary = `${projection.identity.symbol} · ${projection.identity.exchangeMic}: ${label} in USD across ten fiscal years, oldest to newest. Negative values extend below zero. Missing and unknown values have no bar; known zero has zero height. Exact values are available below.`;

  useEffect(() => {
    if (chartElement.current === null || unavailable) return;
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
      // Release every resource even if the chart library fails during cleanup.
      for (const release of [
        () => observer?.disconnect(),
        () => window.removeEventListener("resize", resize),
        () => motion?.removeEventListener?.("change", changeMotion),
        () => chart?.dispatchAction({ type: "hideTip" }),
        () => chart?.dispose(),
      ]) {
        try {
          release();
        } catch {
          // A failed release must not skip the remaining independent resources.
        }
      }
    };
    try {
      chart = echarts.init(chartElement.current, undefined, {
        renderer: "canvas",
      });
      chart.setOption(
        chartOption(projection, field, summary, !motion?.matches),
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
      setFailure({ contentKey, field });
    }
    return cleanup;
    // The projection's content key covers every rendered input. Equivalent
    // fresh projections keep the existing canvas and native selector mounted.
  }, [contentKey, field, unavailable]);

  return (
    <section
      className="annual-financial-trend"
      aria-label="Annual business trends"
    >
      <h4>Annual business trends</h4>
      <label className="annual-financial-trend-selector">
        <span>Annual trend metric</span>
        <select
          value={field}
          onChange={(event) => {
            const value = event.currentTarget.value;
            if (isTrendField(value)) setField(value);
          }}
        >
          {PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS.map((option) => (
            <option key={option} value={option}>
              {fieldLabel(option)}
            </option>
          ))}
        </select>
      </label>
      {unavailable ? (
        <p role="status">
          {failed
            ? "Chart unavailable: the chart could not be displayed."
            : plot.status === "unavailable" &&
                plot.reason === "unsafe_plot_value"
              ? "Chart unavailable: one or more values cannot be safely plotted."
              : "Chart unavailable: no known values for this metric in the ten-year window."}{" "}
          Exact annual values remain available below.
        </p>
      ) : (
        <div
          ref={chartElement}
          className="annual-financial-trend-canvas"
          role="img"
          aria-label={summary}
        />
      )}
      <p className="market-scope-note">
        Nominal USD, with a zero baseline. Chart coordinates are approximations;
        inspect the exact values below. Missing years and unknown values are not
        filled or treated as zero. A known zero has a zero-height bar.
      </p>
      <p className="market-scope-note">
        Free cash flow is provider-reported, not reconstructed cash flow for the
        DCF model. Fiscal-year labels and provider statement/release dates are
        distinct. Loaded data may include later corrections; this is not
        point-in-time history. Response as of{" "}
        <time dateTime={projection.asOf}>{projection.asOf}</time>.
      </p>
      <details
        key={contentKey}
        className="data-table-disclosure annual-financial-trend-data"
      >
        <summary>Inspect exact annual trend values</summary>
        <div
          className="annual-financial-trend-table-wrap"
          role="region"
          aria-label="Exact annual business trend values"
          tabIndex={0}
        >
          <table>
            <caption>
              Annual business trend values · USD · oldest to newest
            </caption>
            <thead>
              <tr>
                <th scope="col">Fiscal year</th>
                <th scope="col">Provider statement/release date</th>
                {PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS.map((column) => (
                  <th key={column} scope="col">
                    {fieldLabel(column)} (USD)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projection.slots.map((slot) => (
                <tr key={slot.fiscalYear}>
                  <th scope="row">{slot.fiscalYear}</th>
                  <td>
                    {slot.statementDate === null ? (
                      "Missing year"
                    ) : (
                      <time dateTime={slot.statementDate}>
                        {slot.statementDate}
                      </time>
                    )}
                  </td>
                  {PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS.map((column) => (
                    <td key={column}>{exactValue(slot, column)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function fieldLabel(field: PersonalAnnualFinancialTrendField): string {
  if (field === "free_cash_flow") return "Provider-reported free cash flow";
  return PERSONAL_FINANCIAL_REPORTED_FIELDS.find(
    (item) => item.fieldKey === field,
  )!.label;
}

function isTrendField(
  value: string,
): value is PersonalAnnualFinancialTrendField {
  return PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS.some(
    (field) => field === value,
  );
}

function exactValue(
  slot: PersonalAnnualFinancialTrendSlot,
  field: PersonalAnnualFinancialTrendField,
): string {
  if (slot.status === "missing_year") return "Missing year";
  const cell = slot.cells[field];
  return cell.status === "known" ? cell.value : "Unknown";
}

function chartOption(
  projection: ReadyProjection,
  field: PersonalAnnualFinancialTrendField,
  summary: string,
  animation: boolean,
) {
  const plot = projection.plots[field];
  return {
    animation,
    aria: { enabled: true, description: summary },
    grid: { left: 12, right: 16, top: 36, bottom: 48, containLabel: true },
    tooltip: {
      trigger: "axis",
      renderMode: "richText",
      confine: true,
      padding: 8,
      textStyle: { fontSize: 12, lineHeight: 14 },
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const item: unknown = Array.isArray(params) ? params[0] : params;
        if (
          !item ||
          typeof item !== "object" ||
          !("dataIndex" in item) ||
          typeof item.dataIndex !== "number" ||
          !Number.isInteger(item.dataIndex)
        )
          return "Fiscal year unavailable";
        const slot = projection.slots[item.dataIndex];
        if (!slot) return "Fiscal year unavailable";
        const lines = [
          `Fiscal year ${slot.fiscalYear}`,
          fieldLabel(field),
          `USD: ${exactValue(slot, field)}`,
          ...(slot.statementDate === null
            ? []
            : [`Statement/release: ${slot.statementDate}`]),
        ].flatMap((line) => line.match(/.{1,22}/gu) ?? []);
        return lines.length > 11
          ? `Fiscal year ${slot.fiscalYear}\nLong value: inspect the\nexact annual table below.`
          : lines.join("\n");
      },
    },
    xAxis: {
      type: "category",
      data: projection.slots.map((slot) => String(slot.fiscalYear)),
      name: "Fiscal year",
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
      name: "USD",
      scale: false,
      axisLabel: {
        color: "#626b67",
        formatter: (value: number) =>
          new Intl.NumberFormat("en-US", {
            notation:
              value !== 0 && Math.abs(value) < 0.01 ? "scientific" : "compact",
            maximumSignificantDigits: 3,
          }).format(value),
      },
      splitLine: { lineStyle: { color: "#e9e7df" } },
    },
    series: [
      {
        name: fieldLabel(field),
        type: "bar",
        data: plot.status === "ready" ? [...plot.values] : [],
        barMaxWidth: 36,
        itemStyle: { color: "#176b56" },
        markLine: {
          silent: true,
          symbol: "none",
          label: { show: false },
          lineStyle: { color: "#626b67", type: "solid" },
          data: [{ yAxis: 0 }],
        },
      },
    ],
  };
}
