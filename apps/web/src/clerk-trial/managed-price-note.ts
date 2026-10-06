import type {
  ManagedEodCloseDto,
  ManagedEodHistoryResponseDto,
} from "@research-cockpit/contracts";
import { calculatePersonalRawCloseChange } from "@research-cockpit/personal-market-analytics";

/** Formats a comparison from the already admitted history; never loads or saves. */
export function priceComparisonNoteExcerpt(
  response: ManagedEodHistoryResponseDto,
  start: ManagedEodCloseDto,
  showingPrevious: boolean,
): string | null {
  const index = response.rows.indexOf(start);
  const latest = response.rows.at(-1);
  if (index < 0 || index >= response.rows.length - 1 || !latest) return null;
  const change = calculatePersonalRawCloseChange({ rows: [start, latest] });
  if (change.status !== "available") return null;
  const money =
    change.direction === "down"
      ? `-$${change.change.slice(1)}`
      : `${change.direction === "up" ? "+" : ""}$${change.change}`;
  const percent =
    change.changePercent === "0.0000" && change.direction !== "unchanged"
      ? `less than 0.0001% ${change.direction === "up" ? "higher" : "lower"}`
      : `${change.direction === "up" ? "+" : ""}${change.changePercent}%`;
  return [
    `Observed raw-close comparison: ${response.security.symbol} (${response.security.exchangeMic}); ${start.date} USD ${start.close} to latest loaded ${latest.date} USD ${latest.close}; raw close change ${money} (${percent}).`,
    `Source: Tiingo; requested window ${response.window.startDate} to ${response.window.endDate}; original request started ${response.requestStartedAt}; completed ${response.completedAt}.`,
    "Raw closes are not adjusted for splits or dividends and are not live quotes.",
    ...(showingPrevious
      ? ["Retained previous history; newer prices were not confirmed."]
      : []),
    "Evidence dates are unchanged; this action does not refresh sources.",
  ].join(" ");
}
