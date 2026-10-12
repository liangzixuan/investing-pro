import { useId, useState } from "react";
import {
  changeManagedPriceComparisonInterval,
  createManagedPriceComparisonSelection,
  deriveManagedPriceComparison,
  deriveManagedPriceComparisonHistory,
  orderManagedPriceComparison,
  sameManagedPriceComparisonSources,
  type ManagedPriceComparisonHistory,
  type ManagedPriceComparisonInterval,
  type ManagedPriceComparisonOrder,
  type ManagedPriceComparisonResult,
  type ManagedPriceComparisonSelection,
  type ManagedPriceComparisonState,
} from "./managed-price-comparison";

type ActiveComparison = NonNullable<ManagedPriceComparisonResult>;
const ORDER_LABELS = {
  board: "Board order",
  highest: "Highest raw change",
  lowest: "Lowest raw change",
} as const;
const SORT_DIRECTIONS = {
  board: "none",
  highest: "descending",
  lowest: "ascending",
} as const;

export function ManagedPriceComparison({
  state,
}: {
  state: ManagedPriceComparisonState;
}) {
  const [order, setOrder] = useState<ManagedPriceComparisonOrder>("board");
  const history = deriveManagedPriceComparisonHistory(state);
  const [selection, setSelection] = useState(() =>
    createManagedPriceComparisonSelection(state, history),
  );
  const current = sameManagedPriceComparisonSources(selection, state);
  const displayed = current
    ? selection
    : createManagedPriceComparisonSelection(
        state,
        history,
        selection.hadHistory,
      );
  if (!current) setSelection(displayed);
  return (
    <ManagedPriceComparisonView
      history={history}
      selection={displayed}
      onDate={(field, date) =>
        setSelection((previous) =>
          sameManagedPriceComparisonSources(previous, state)
            ? changeManagedPriceComparisonInterval(
                previous,
                history,
                field,
                date,
              )
            : previous,
        )
      }
      order={order}
      onOrder={setOrder}
    />
  );
}

export function ManagedPriceComparisonView({
  history,
  selection,
  onDate,
  order,
  onOrder,
}: {
  history: ManagedPriceComparisonHistory;
  selection: ManagedPriceComparisonSelection;
  onDate: (field: keyof ManagedPriceComparisonInterval, date: string) => void;
  order: ManagedPriceComparisonOrder;
  onOrder: (order: ManagedPriceComparisonOrder) => void;
}) {
  const id = useId();
  const comparison = orderManagedPriceComparison(
    deriveManagedPriceComparison(history, selection),
    order,
  );
  if (!comparison) return null;
  return (
    <section
      className="managed-price-comparison"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Compare raw price changes</h3>
      <ComparisonControls
        id={id}
        history={history}
        selection={selection}
        onDate={onDate}
        order={order}
        onOrder={onOrder}
      />
      {comparison.status !== "unavailable" &&
        comparison.rows.some((row) => row.showingPrevious) && (
          <p className="managed-eod-previous">
            Previous history retained for{" "}
            {comparison.rows
              .filter((row) => row.showingPrevious)
              .map((row) => row.listing.symbol)
              .join(", ")}
            . Those original requests remain in this comparison.
          </p>
        )}
      {comparison.status === "available" && (
        <>
          <p className="managed-price-comparison-window">
            <time dateTime={comparison.firstDate}>{comparison.firstDate}</time>
            {" to "}
            <time dateTime={comparison.lastDate}>{comparison.lastDate}</time>
            {" · "}
            {comparison.intervalDateCount} shared observed dates in this
            interval
            {" · "}
            {comparison.sharedDateCount} across the loaded histories
          </p>
          <p id={`${id}-scroll`} className="managed-price-comparison-help">
            All three listings · {ORDER_LABELS[order]}. Scroll the table
            horizontally when needed; keyboard users can focus it and use the
            arrow keys.
          </p>
        </>
      )}
      <div
        className="managed-price-comparison-scroll"
        role="region"
        aria-label="Raw price comparison results"
        aria-describedby={
          comparison.status === "available" ? `${id}-scroll` : undefined
        }
        tabIndex={comparison.status === "available" ? 0 : -1}
      >
        {comparison.status === "available" ? (
          <ComparisonTable rows={comparison.rows} order={order} />
        ) : (
          <ComparisonStatus comparison={comparison} />
        )}
      </div>
      {comparison.status !== "unavailable" && (
        <p className="managed-price-comparison-help">
          Raw closes are not adjusted for splits or dividends. This compares
          shared observations within the loaded histories, not a full-month
          return. Histories can come from different requests; completion times
          record those requests, not a live market update.
        </p>
      )}
      <ComparisonCoverage comparison={comparison} />
    </section>
  );
}

function ComparisonControls({
  id,
  history,
  selection,
  onDate,
  order,
  onOrder,
}: {
  id: string;
  history: ManagedPriceComparisonHistory;
  selection: ManagedPriceComparisonSelection;
  onDate: (field: keyof ManagedPriceComparisonInterval, date: string) => void;
  order: ManagedPriceComparisonOrder;
  onOrder: (order: ManagedPriceComparisonOrder) => void;
}) {
  const dates = history?.status === "loaded" ? history.sharedDates : [];
  return (
    <>
      <div className="managed-price-comparison-controls">
        <ComparisonDate
          id={`${id}-start`}
          label="Shared comparison start date"
          className="managed-price-comparison-start-select"
          dates={dates.slice(0, -1)}
          value={selection.startDate}
          onChange={(date) => onDate("startDate", date)}
        />
        <ComparisonDate
          id={`${id}-end`}
          label="Shared comparison end date"
          className="managed-price-comparison-end-select"
          dates={dates.slice(1).filter((date) => date > selection.startDate)}
          value={selection.endDate}
          onChange={(date) => onDate("endDate", date)}
        />
        <ComparisonOrder id={`${id}-order`} order={order} onOrder={onOrder} />
      </div>
      <p className="managed-price-comparison-reset" role="status">
        {selection.resetNotice &&
          "Loaded histories changed; showing the full shared span."}
      </p>
    </>
  );
}

function ComparisonDate({
  id,
  label,
  className,
  dates,
  value,
  onChange,
}: {
  id: string;
  label: string;
  className: string;
  dates: readonly string[];
  value: string;
  onChange: (date: string) => void;
}) {
  return (
    <label className="managed-price-comparison-date" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        className={className}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">
          {dates.length
            ? "Choose an observed date"
            : "No shared dates available"}
        </option>
        {dates.map((date) => (
          <option key={date} value={date}>
            {date}
          </option>
        ))}
      </select>
    </label>
  );
}

function ComparisonOrder({
  id,
  order,
  onOrder,
}: {
  id: string;
  order: ManagedPriceComparisonOrder;
  onOrder: (order: ManagedPriceComparisonOrder) => void;
}) {
  return (
    <label className="managed-price-comparison-order" htmlFor={id}>
      <span>Comparison order</span>
      <select
        id={id}
        value={order}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value === "board" || value === "highest" || value === "lowest")
            onOrder(value);
        }}
      >
        {Object.entries(ORDER_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ComparisonStatus({
  comparison,
}: {
  comparison: Exclude<ActiveComparison, { status: "available" }>;
}) {
  return (
    <p className="managed-price-comparison-status" role="status">
      {comparison.status === "unavailable" ? (
        <>
          Comparison unavailable. Load price histories for all three board
          listings. A missing or cleared history prevents a complete comparison.
        </>
      ) : comparison.status === "interval_required" ? (
        comparison.reason === "end_required" ? (
          "Choose an ending date after the starting date."
        ) : (
          "Choose a starting date before the ending date."
        )
      ) : (
        <>
          Comparison needs at least two dates observed for every listing.{" "}
          {comparison.sharedDateCount === 1
            ? "1 shared observed date is loaded."
            : `${comparison.sharedDateCount} shared observed dates are loaded.`}
          {comparison.firstDate && (
            <>
              {" "}
              Shared date:{" "}
              <time dateTime={comparison.firstDate}>
                {comparison.firstDate}
              </time>
              .
            </>
          )}
        </>
      )}
    </p>
  );
}

function ComparisonTable({
  rows,
  order,
}: {
  rows: Extract<ActiveComparison, { status: "available" }>["rows"];
  order: ManagedPriceComparisonOrder;
}) {
  return (
    <table className="managed-price-comparison-values">
      <caption className="sr-only">
        Raw USD closes and percentage changes between the selected dates
        observed for all three listings
      </caption>
      <thead>
        <tr>
          <th scope="col">Listing</th>
          <th scope="col">First close (USD)</th>
          <th scope="col">Last close (USD)</th>
          <th scope="col" aria-sort={SORT_DIRECTIONS[order]}>
            Raw price change
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.listing.listingId}>
            <th scope="row">
              <strong>{row.listing.symbol}</strong>
              <span>{row.listing.exchangeMic}</span>
              {row.showingPrevious && (
                <span className="managed-price-comparison-previous">
                  Previous history retained
                </span>
              )}
              <small>
                Request completed{" "}
                <time dateTime={row.response.completedAt}>
                  {row.response.completedAt}
                </time>
              </small>
            </th>
            <td>{row.firstClose}</td>
            <td>{row.lastClose}</td>
            <td data-direction={row.change.direction}>
              {row.change.changePercent === "0.0000" &&
              row.change.direction !== "unchanged"
                ? `Less than 0.0001% ${row.change.direction === "up" ? "higher" : "lower"}`
                : `${row.change.direction === "up" ? "+" : ""}${row.change.changePercent}%`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ComparisonCoverage({ comparison }: { comparison: ActiveComparison }) {
  return (
    <details className="managed-price-comparison-source">
      <summary>Comparison coverage and request dates</summary>
      {comparison.status === "unavailable" ? (
        <p>
          Load histories for all three listings to inspect their coverage and
          request dates.
        </p>
      ) : (
        <>
          <div className="managed-price-comparison-provenance">
            {comparison.rows.map((row) => (
              <section key={row.listing.listingId}>
                <h4>
                  {row.listing.symbol} · {row.listing.exchangeMic}
                </h4>
                <p>
                  {row.listing.issuerName} · {row.listing.shareClassName}
                </p>
                {row.showingPrevious && (
                  <p className="managed-eod-previous">
                    Previous history retained. This refresh has not confirmed
                    newer prices.
                  </p>
                )}
                <dl className="managed-metadata">
                  <dt>Requested window</dt>
                  <dd>
                    {row.response.window.startDate} to{" "}
                    {row.response.window.endDate}
                  </dd>
                  <dt>Observed dates</dt>
                  <dd>
                    {row.response.rows[0]!.date} to{" "}
                    {row.response.rows.at(-1)!.date}
                  </dd>
                  <dt>Loaded / omitted observations</dt>
                  <dd>
                    {row.response.rows.length} /{" "}
                    {row.response.rows.length - comparison.sharedDateCount}
                  </dd>
                  <dt>Request started</dt>
                  <dd>{row.response.requestStartedAt}</dd>
                  <dt>Source request completed</dt>
                  <dd>{row.response.completedAt}</dd>
                </dl>
              </section>
            ))}
          </div>
          <p>
            Data provided by Tiingo. Change = (ending raw close − starting raw
            close) / starting raw close × 100, rounded to four decimal places.
            Omitted observations have dates absent from another listing's loaded
            history, not dates outside the selected interval. Missing dates are
            not filled. This comparison makes no additional price request.
          </p>
          <p>
            Ordering uses exact endpoint ratios before rounding. Exact ties use
            symbol, exchange MIC and listing ID in that order.
          </p>
        </>
      )}
    </details>
  );
}
