import type { ManagedAnnualAmountChartInput } from "./managed-annual-amount-plot";
import type { EChartsOption } from "echarts";
import type {
  ManagedAnnualTrendMetric,
  ManagedAnnualTrendProjection,
} from "./managed-annual-trend-input";

export type ReadyAnnualTrend = Extract<
  ManagedAnnualTrendProjection,
  { status: "ready" }
>;
export const annualTrendMetricLabel = (metric: ManagedAnnualTrendMetric) =>
  metric === "revenue" ? "Revenue" : "Net income";

export function annualTrendSummary(
  projection: ReadyAnnualTrend,
  metric: ManagedAnnualTrendMetric,
) {
  return `${projection.concept}: ${annualTrendMetricLabel(metric)} in USD across ${projection.periods.length} reported annual periods, oldest to newest. Negative amounts extend below zero; known zero has zero height. Exact amounts and dates remain in the tables below.`;
}

export function annualTrendChartInput(
  projection: ReadyAnnualTrend,
  metric: ManagedAnnualTrendMetric,
): ManagedAnnualAmountChartInput {
  return Object.freeze({
    contentKey: JSON.stringify([projection.contentKey, metric]),
    label: annualTrendMetricLabel(metric),
    summary: annualTrendSummary(projection, metric),
    unit: "USD",
    periods: Object.freeze(
      projection.periods.map((period) =>
        Object.freeze({
          startDate: period.startDate,
          endDate: period.endDate,
          amount: metric === "revenue" ? period.revenue : period.netIncome,
        }),
      ),
    ),
    plot: projection.plots[metric],
  });
}

export function managedAnnualTrendChartOption(
  input: ManagedAnnualAmountChartInput,
  animation: boolean,
  colors: {
    ink: string;
    line: string;
    bar: string;
    surface: string;
    text: string;
  },
): EChartsOption {
  const plot = input.plot;
  return {
    animation,
    aria: {
      enabled: true,
      description: input.summary,
    },
    grid: { left: 8, right: 12, top: 32, bottom: 24, containLabel: true },
    tooltip: {
      trigger: "axis",
      renderMode: "richText",
      confine: true,
      padding: 8,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      textStyle: { color: colors.text, fontSize: 12, lineHeight: 15 },
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => annualTrendTooltip(input, params),
    },
    xAxis: {
      type: "category",
      data: input.periods.map((period) => period.endDate),
      axisLabel: { hideOverlap: true, color: colors.ink },
    },
    yAxis: {
      type: "value",
      name: "USD",
      scale: false,
      axisLabel: { color: colors.ink, formatter: compactAmount },
      splitLine: { lineStyle: { color: colors.line } },
    },
    series: [
      {
        name: input.label,
        type: "bar",
        data: plot.status === "ready" ? [...plot.values] : [],
        barMaxWidth: 48,
        itemStyle: { color: colors.bar },
        markLine: {
          silent: true,
          symbol: "none",
          label: { show: false },
          lineStyle: { color: colors.ink, type: "solid" },
          data: [{ yAxis: 0 }],
        },
      },
    ],
  };
}

function compactAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value !== 0 && Math.abs(value) < 0.01 ? "scientific" : "compact",
    maximumSignificantDigits: 3,
  }).format(value);
}

export function annualTrendTooltip(
  input: ManagedAnnualAmountChartInput,
  params: unknown,
) {
  const item: unknown = Array.isArray(params) ? params[0] : params;
  if (
    !item ||
    typeof item !== "object" ||
    !("dataIndex" in item) ||
    typeof item.dataIndex !== "number" ||
    !Number.isInteger(item.dataIndex)
  )
    return "Annual period unavailable";
  const period = input.periods[item.dataIndex];
  if (!period) return "Annual period unavailable";
  const lines = [
    input.label,
    `${period.startDate} to`,
    period.endDate,
    `USD: ${period.amount}`,
  ].flatMap((line) => line.match(/.{1,24}/gu) ?? []);
  return lines.length > 10
    ? `${period.startDate} to\n${period.endDate}\nLong value: inspect the\nexact amounts table below.`
    : lines.join("\n");
}
