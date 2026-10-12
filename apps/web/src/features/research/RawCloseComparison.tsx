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
    | ((
        start: ManagedEodCloseDto,
        end: ManagedEodCloseDto,
        isCurrent: () => boolean,
      ) => ReactNode)
    | undefined;
}

interface ComparisonSelection {
  rows: readonly ManagedEodCloseDto[];
  symbol: string;
  startDate: string;
  endDate: string;
}

function initialSelection(
  rows: readonly ManagedEodCloseDto[],
  symbol: string,
): ComparisonSelection {
  return {
    rows,
    symbol,
    startDate: "",
    endDate: rows.length > 1 ? rows.at(-1)!.date : "",
  };
}

function comparisonHelp(hasEarlier: boolean, endDate: string) {
  if (!hasEarlier) return "Comparison unavailable: two dated closes needed.";
  return endDate
    ? "Compare two observed dates from the loaded history."
    : "Choose an ending date after the starting date.";
}

function ComparisonFigures({
  start,
  end,
}: {
  start: ManagedEodCloseDto;
  end: ManagedEodCloseDto;
}) {
  const change = calculatePersonalRawCloseChange({ rows: [start, end] });
  if (change.status !== "available") return null;
  const money =
    change.direction === "down"
      ? `-$${change.change.slice(1)}`
      : `${change.direction === "up" ? "+" : ""}$${change.change}`;
  const percent =
    change.changePercent === "0.0000" && change.direction !== "unchanged"
      ? `less than 0.0001% ${change.direction === "up" ? "higher" : "lower"}`
      : `${change.direction === "up" ? "+" : ""}${change.changePercent}%`;
  return (
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
        <dt>Ending raw close (USD)</dt>
        <dd>
          <time
            className="managed-raw-close-comparison-end-date"
            dateTime={end.date}
          >
            {end.date}
          </time>
          {": "}
          <span className="managed-raw-close-comparison-end-close">
            {end.close}
          </span>
        </dd>
      </dl>
      <strong className="managed-raw-close-comparison-change">
        Raw close change: {money} ({percent})
      </strong>
    </>
  );
}

export function RawCloseComparison({
  rows,
  symbol,
  renderAction,
}: RawCloseComparisonProps) {
  const id = useId();
  const [selection, setSelection] = useState(() =>
    initialSelection(rows, symbol),
  );
  const committed = useRef<typeof selection | null>(null);
  useLayoutEffect(() => {
    committed.current = selection;
    return () => {
      committed.current = null;
    };
  }, [selection]);
  const current = selection.rows === rows && selection.symbol === symbol;
  if (!current) setSelection(initialSelection(rows, symbol));
  const displayed = current ? selection : initialSelection(rows, symbol);
  const earlier = rows.slice(0, -1);
  const endings = rows.slice(1).filter((row) => row.date > displayed.startDate);
  const start = earlier.find((row) => row.date === displayed.startDate);
  const end = endings.find((row) => row.date === displayed.endDate);

  return (
    <section
      className="managed-raw-close-comparison"
      aria-labelledby={`${id}-label`}
    >
      <div className="managed-raw-close-comparison-dates">
        <div>
          <label id={`${id}-label`} htmlFor={`${id}-start-date`}>
            {symbol} comparison start date
          </label>
          <select
            id={`${id}-start-date`}
            className="managed-raw-close-comparison-start-select"
            aria-describedby={`${id}-help`}
            value={displayed.startDate}
            disabled={!earlier.length}
            onChange={(event) => {
              const next = event.currentTarget.value;
              setSelection((previous) => {
                if (previous.rows !== rows || previous.symbol !== symbol)
                  return previous;
                const startDate = earlier.some((row) => row.date === next)
                  ? next
                  : "";
                return {
                  ...previous,
                  startDate,
                  endDate: previous.endDate > startDate ? previous.endDate : "",
                };
              });
            }}
          >
            <option value="">Choose an observed date</option>
            {earlier.map((row) => (
              <option key={row.date} value={row.date}>
                {row.date}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-end-date`}>{symbol} comparison end date</label>
          <select
            id={`${id}-end-date`}
            className="managed-raw-close-comparison-end-select"
            aria-describedby={`${id}-help`}
            value={displayed.endDate}
            disabled={!earlier.length}
            onChange={(event) => {
              const next = event.currentTarget.value;
              setSelection((previous) => {
                if (previous.rows !== rows || previous.symbol !== symbol)
                  return previous;
                const endDate = rows
                  .slice(1)
                  .some(
                    (row) => row.date === next && row.date > previous.startDate,
                  )
                  ? next
                  : "";
                return { ...previous, endDate };
              });
            }}
          >
            <option value="">Choose an observed date</option>
            {endings.map((row) => (
              <option key={row.date} value={row.date}>
                {row.date}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p id={`${id}-help`}>
        {comparisonHelp(earlier.length > 0, displayed.endDate)} Raw closes are
        not adjusted for splits or dividends.
      </p>
      <div
        className="managed-raw-close-comparison-result"
        role="status"
        aria-live="polite"
      >
        {start && end && <ComparisonFigures start={start} end={end} />}
      </div>
      {start &&
        end &&
        renderAction?.(
          start,
          end,
          () => current && committed.current === selection,
        )}
    </section>
  );
}
