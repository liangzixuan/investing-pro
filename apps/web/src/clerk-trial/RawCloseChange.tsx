import type { ManagedEodCloseDto } from "@research-cockpit/contracts";
import { calculatePersonalRawCloseChange } from "@research-cockpit/personal-market-analytics";

export function RawCloseChange({
  rows,
  id,
  compact = false,
}: {
  rows: readonly ManagedEodCloseDto[];
  id: string;
  compact?: boolean;
}) {
  const change = calculatePersonalRawCloseChange({ rows });
  if (change.status === "insufficient_history")
    return (
      <span
        id={id}
        className="managed-market-change"
        data-direction="unavailable"
      >
        Raw close change unavailable: two dated closes needed.
      </span>
    );
  const money =
    change.direction === "down"
      ? `-$${change.change.slice(1)}`
      : `${change.direction === "up" ? "+" : ""}$${change.change}`;
  const percent =
    change.changePercent === "0.0000" && change.direction !== "unchanged"
      ? `less than 0.0001% ${change.direction === "up" ? "higher" : "lower"}`
      : `${change.direction === "up" ? "+" : ""}${change.changePercent}%`;
  return (
    <span
      id={id}
      className="managed-market-change"
      data-direction={change.direction}
    >
      <strong>
        <span className={compact ? "sr-only" : undefined}>
          Raw close change:{" "}
        </span>
        {money} ({percent})
      </strong>
      <span className="managed-market-change-basis">
        <time dateTime={change.previousDate}>{change.previousDate}</time> to{" "}
        <time dateTime={change.latestDate}>{change.latestDate}</time>
        <span className={compact ? "sr-only" : undefined}>
          {" "}
          · not adjusted for splits or dividends.
        </span>
      </span>
    </span>
  );
}
