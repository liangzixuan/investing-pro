import type { ManagedEodHistoryState } from "./managed-eod-history";

export function CompanySnapshotPrice({
  state,
  onOpen,
}: {
  state: ManagedEodHistoryState | null;
  onOpen: () => void;
}) {
  const price = state?.response;
  const last = price?.rows.at(-1);
  return (
    <section aria-label="Snapshot price">
      <h3>Price</h3>
      {price && last ? (
        <>
          <dl>
            <div>
              <dt>Last raw close · USD</dt>
              <dd className="managed-snapshot-amount">{last.close}</dd>
            </div>
            <div>
              <dt>Trading date</dt>
              <dd>{last.date}</dd>
            </div>
          </dl>
          <p>Tiingo · unadjusted for splits or dividends; not a live quote.</p>
          <p>
            Loaded request range:{" "}
            {price.range === "1y" ? "One year" : "One month"}.{" "}
            {price.rows.length} reported closes.
          </p>
          <p>
            Window {price.window.startDate} to {price.window.endDate}. Request
            started {price.requestStartedAt}; completed {price.completedAt}.
          </p>
          {price && (state?.running || state?.showingPrevious) && (
            <p className="discovery-warning">
              Showing previous close history. This refresh has not confirmed
              newer prices.
            </p>
          )}
        </>
      ) : (
        <p>
          {state?.available === false
            ? state.message
            : "No close history loaded for this company. Open Price to request it explicitly."}
        </p>
      )}
      <button className="trial-secondary" onClick={onOpen}>
        Open Price section
      </button>
    </section>
  );
}
