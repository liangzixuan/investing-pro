import type { ManagedEodCloseDto } from "@research-cockpit/contracts";
import { calculatePersonalRawCloseChange } from "@research-cockpit/personal-market-analytics";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface RawCloseComparisonProps {
  rows: readonly ManagedEodCloseDto[];
  symbol: string;
  renderAction?:
    | ((start: ManagedEodCloseDto, isCurrent: () => boolean) => ReactNode)
    | undefined;
}

export function RawCloseComparison({
  rows,
  symbol,
  renderAction,
}: RawCloseComparisonProps) {
  const id = useId();
  const [selection, setSelection] = useState({ rows, symbol, date: "" });
  const committed = useRef<typeof selection | null>(null);
  useLayoutEffect(() => {
    committed.current = selection;
    return () => {
      committed.current = null;
    };
  }, [selection]);
  const current = selection.rows === rows && selection.symbol === symbol;
  if (!current) setSelection({ rows, symbol, date: "" });
  const earlier = rows.slice(0, -1);
  const date = current ? selection.date : "";
  const start = earlier.find((row) => row.date === date);
  const latest = rows.at(-1);
  const change =
    start && latest
      ? calculatePersonalRawCloseChange({ rows: [start, latest] })
      : null;
  const money =
    change?.status === "available"
      ? change.direction === "down"
        ? `-$${change.change.slice(1)}`
        : `${change.direction === "up" ? "+" : ""}$${change.change}`
      : "";
  const percent =
    change?.status === "available"
      ? change.changePercent === "0.0000" && change.direction !== "unchanged"
        ? `less than 0.0001% ${change.direction === "up" ? "higher" : "lower"}`
        : `${change.direction === "up" ? "+" : ""}${change.changePercent}%`
      : "";

  return (
    <section
      className="managed-raw-close-comparison"
      aria-labelledby={`${id}-label`}
    >
      <label id={`${id}-label`} htmlFor={`${id}-date`}>
        {symbol} comparison start date
      </label>
      <select
        id={`${id}-date`}
        aria-describedby={`${id}-help`}
        value={date}
        disabled={!earlier.length}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setSelection((previous) =>
            previous.rows === rows && previous.symbol === symbol
              ? {
                  rows,
                  symbol,
                  date: earlier.some((row) => row.date === next) ? next : "",
                }
              : previous,
          );
        }}
      >
        <option value="">Choose an observed date</option>
        {earlier.map((row) => (
          <option key={row.date} value={row.date}>
            {row.date}
          </option>
        ))}
      </select>
      <p id={`${id}-help`}>
        {earlier.length
          ? "Compare an earlier observed date with the latest loaded close."
          : "Comparison unavailable: two dated closes needed."}{" "}
        Raw closes are not adjusted for splits or dividends.
      </p>
      <div
        className="managed-raw-close-comparison-result"
        role="status"
        aria-live="polite"
      >
        {start && latest && change?.status === "available" && (
          <>
            <dl>
              <dt>Starting raw close (USD)</dt>
              <dd>
                <time
                  className="managed-raw-close-comparison-start-date"
                  dateTime={start.date}
                >
                  {start.date}
                </time>
                {": "}
                <span className="managed-raw-close-comparison-start-close">
                  {start.close}
                </span>
              </dd>
              <dt>Latest loaded raw close (USD)</dt>
              <dd>
                <time
                  className="managed-raw-close-comparison-latest-date"
                  dateTime={latest.date}
                >
                  {latest.date}
                </time>
                {": "}
                <span className="managed-raw-close-comparison-latest-close">
                  {latest.close}
                </span>
              </dd>
            </dl>
            <strong className="managed-raw-close-comparison-change">
              Raw close change: {money} ({percent})
            </strong>
          </>
        )}
      </div>
      {start &&
        latest &&
        change?.status === "available" &&
        renderAction?.(start, () => current && committed.current === selection)}
    </section>
  );
}
