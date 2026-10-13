import type { EChartsOption } from "echarts";
import type { ManagedWatchlistPricePath } from "./managed-watchlist-price-path";

export function watchlistPricePathSummary(path: ManagedWatchlistPricePath) {
  return `${path.series.map((row) => `${row.listing.symbol} ${row.listing.shareClassName} ${row.listing.exchangeMic}`).join("; ")}: raw closes indexed to 100 on ${path.dates[0]}, through ${path.dates.at(-1)}. ${path.dates.length} shared observations. Exact values follow the chart.`;
}

export function watchlistPricePathOption(
  path: ManagedWatchlistPricePath,
  animation: boolean,
  style: CSSStyleDeclaration,
): EChartsOption {
  const color = (name: string) =>
    style.getPropertyValue(`--managed-${name}`).trim();
  return {
    animation,
    aria: { enabled: true, description: watchlistPricePathSummary(path) },
    grid: { left: 8, right: 12, top: 32, bottom: 24, containLabel: true },
    tooltip: {
      trigger: "axis",
      renderMode: "richText",
      confine: true,
      backgroundColor: color("surface"),
      borderColor: color("line"),
      textStyle: { color: color("ink"), fontSize: 12, lineHeight: 15 },
      formatter: (params: unknown) => watchlistPricePathTooltip(path, params),
    },
    xAxis: {
      type: "category",
      data: path.dates,
      boundaryGap: false,
      axisLabel: {
        color: color("muted"),
        hideOverlap: true,
        showMinLabel: true,
        showMaxLabel: true,
        alignMinLabel: "left",
        alignMaxLabel: "right",
      },
    },
    yAxis: {
      type: "value",
      name: "Start = 100",
      nameTextStyle: { color: color("muted") },
      scale: true,
      axisLabel: { color: color("muted") },
      splitLine: { lineStyle: { color: color("line") } },
    },
    series: path.series.map((row, index) => ({
      type: "line",
      name: `${row.listing.symbol} ${row.listing.shareClassName} ${row.listing.exchangeMic}`,
      data: path.values[index]!,
      smooth: false,
      connectNulls: false,
      symbol: index === 0 ? "circle" : "diamond",
      symbolSize: 7,
      lineStyle: { type: index === 0 ? "solid" : "dashed", width: 2 },
      itemStyle: { color: color(index === 0 ? "action" : "positive") },
    })),
  };
}

export function watchlistPricePathTooltip(
  path: ManagedWatchlistPricePath,
  params: unknown,
): string {
  const item: unknown = Array.isArray(params) ? params[0] : params;
  if (
    !item ||
    typeof item !== "object" ||
    !("dataIndex" in item) ||
    !Number.isInteger(item.dataIndex)
  )
    return "Observation unavailable";
  const index = item.dataIndex as number;
  const date = path.dates[index];
  if (!date) return "Observation unavailable";
  const lines = [
    date,
    ...path.series.flatMap((row) => [
      `${row.listing.symbol} ${row.listing.shareClassName} ${row.listing.exchangeMic}`,
      `USD ${row.points[index]!.close}`,
      `Index ${row.points[index]!.index}`,
    ]),
  ].flatMap((line) => line.match(/.{1,24}/gu) ?? []);
  return lines.length > 14
    ? `${date}\nLong values: inspect the\nexact data table below.`
    : lines.join("\n");
}
