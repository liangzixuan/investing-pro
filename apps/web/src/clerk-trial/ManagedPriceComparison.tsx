import { useId } from "react";
import {
  deriveManagedPriceComparison,
  type ManagedPriceComparisonState,
} from "./managed-price-comparison";

export function ManagedPriceComparison({
  state,
}: {
  state: ManagedPriceComparisonState;
}) {
  const id = useId();
  const comparison = deriveManagedPriceComparison(state);
  if (!comparison) return null;
  return (
    <section
      className="managed-price-comparison"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Compare raw price changes</h3>
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
            {comparison.sharedDateCount} shared observed dates
          </p>
          <p id={`${id}-scroll`} className="managed-price-comparison-help">
            All three listings in board order. Scroll the table horizontally
            when needed; keyboard users can focus it and use the arrow keys.
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
          <table className="managed-price-comparison-values">
            <caption className="sr-only">
              Raw USD closes and percentage changes between the earliest and
              latest dates observed for all three listings
            </caption>
            <thead>
              <tr>
                <th scope="col">Listing</th>
                <th scope="col">First close (USD)</th>
                <th scope="col">Last close (USD)</th>
                <th scope="col">Raw price change</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
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
        ) : (
          <p role="status">
            {comparison.status === "unavailable" ? (
              <>
                Comparison unavailable. Load price histories for all three board
                listings. A missing or cleared history prevents a complete
                comparison.
              </>
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
              Data provided by Tiingo. Change = (last shared raw close − first
              shared raw close) / first shared raw close × 100, rounded to four
              decimal places. Omitted observations have dates absent from
              another listing's loaded history. Missing dates are not filled.
              This comparison makes no additional price request.
            </p>
          </>
        )}
      </details>
    </section>
  );
}
