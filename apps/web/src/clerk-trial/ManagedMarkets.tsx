import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { CloseHistoryChart } from "../features/research/CloseHistoryChart";
import type { ManagedMarkets as Model } from "./managed-markets";

export function ManagedMarkets({
  model,
  onResearch,
  onWatchlist,
}: {
  model: Model;
  onResearch: (kind: "annual" | "eod", opener: HTMLButtonElement) => void;
  onWatchlist: () => void;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const load = useRef<HTMLButtonElement>(null);
  const restoreLoad = useRef(false);
  useLayoutEffect(() => {
    if (!state.running && restoreLoad.current) {
      restoreLoad.current = false;
      load.current?.focus();
    }
  }, [state.running]);
  const selected = state.rows.find(
    (row) => row.listing.listingId === state.selectedListingId,
  );
  const hasPrices = state.rows.some((row) => row.response !== null);
  const response = selected?.response;
  return (
    <section
      className="trial-panel managed-markets"
      aria-labelledby="managed-markets-heading"
    >
      <div className="trial-toolbar managed-markets-toolbar">
        <div>
          <p className="trial-eyebrow">Company board</p>
          <h2 id="managed-markets-heading" tabIndex={-1}>
            Markets
          </h2>
        </div>
        <div className="trial-actions">
          <button
            ref={load}
            disabled={
              !state.rows.length ||
              state.running ||
              state.resolving ||
              state.catalogChanged
            }
            onClick={() => void model.load()}
          >
            {state.running
              ? "Loading prices…"
              : hasPrices
                ? "Refresh board prices"
                : "Load board prices"}
          </button>
          {state.running && (
            <button
              className="trial-secondary"
              onClick={(event) => {
                restoreLoad.current =
                  document.activeElement === event.currentTarget;
                model.cancel();
              }}
            >
              Cancel board prices
            </button>
          )}
        </div>
      </div>
      <p className="managed-markets-scope">
        Three listings, two companies. Raw USD closes from Tiingo, with each
        listing's own trading date. These are end-of-day observations, not live
        quotes or adjusted returns.
      </p>
      <p role={state.error ? "alert" : "status"} aria-live="polite">
        {state.message}
      </p>
      {!state.rows.length &&
        state.catalogSnapshotSha256 &&
        !state.catalogChanged &&
        !state.resolving && (
          <button
            className="trial-secondary"
            onClick={() => void model.resolve()}
          >
            Retry board listings
          </button>
        )}
      <div className="managed-markets-layout">
        <div>
          <ul
            className="managed-market-rows"
            aria-label="Company board listings"
          >
            {state.rows.map((row) => {
              const last = row.response?.rows.at(-1);
              const active = row.listing.listingId === state.selectedListingId;
              return (
                <li key={row.listing.listingId}>
                  <button
                    className="managed-market-row"
                    aria-pressed={active}
                    aria-label={`Select ${row.listing.symbol} on company board`}
                    onClick={() => model.select(row.listing.listingId)}
                  >
                    <span className="managed-market-identity">
                      <strong>{row.listing.symbol}</strong>
                      <span>{row.listing.issuerName}</span>
                      <small>
                        {row.listing.shareClassName} · {row.listing.exchangeMic}
                      </small>
                    </span>
                    <span className="managed-market-close">
                      <strong>{last ? `$${last.close}` : "Not loaded"}</strong>
                      <small>
                        {last ? `USD · ${last.date}` : "Load prices when ready"}
                      </small>
                    </span>
                  </button>
                  <p
                    className="managed-market-row-status"
                    role={row.error ? "alert" : "status"}
                  >
                    {row.message}
                  </p>
                  {row.showingPrevious && row.response && (
                    <p className="managed-eod-previous">
                      Previous history · completed {row.response.completedAt}.
                      This refresh has not confirmed newer prices.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="managed-markets-help">
            Load requests the listings in order, up to three separate requests.
            Cancel keeps completed histories. Prices clear when you leave
            Markets.
          </p>
        </div>
        {selected && (
          <div
            className="managed-market-detail"
            aria-labelledby="managed-market-detail-heading"
          >
            <h3 id="managed-market-detail-heading">
              {selected.listing.symbol} · one month
            </h3>
            <p>{selected.listing.shareClassName}</p>
            <div className="trial-actions">
              <button
                className="trial-secondary"
                aria-label={`Board Annual report for ${selected.listing.symbol}`}
                onClick={(event) => onResearch("annual", event.currentTarget)}
              >
                Annual report
              </button>
              <button
                className="trial-secondary"
                aria-label={`Board price history for ${selected.listing.symbol}`}
                onClick={(event) => onResearch("eod", event.currentTarget)}
              >
                Price history
              </button>
              <button className="trial-secondary" onClick={onWatchlist}>
                Open My Watchlist
              </button>
            </div>
            {response ? (
              <>
                <p>
                  Last trading date {response.rows.at(-1)?.date} · USD raw close
                </p>
                {selected.showingPrevious && (
                  <p className="managed-eod-previous">
                    Showing previous history completed {response.completedAt}.
                    Dates and values are unchanged.
                  </p>
                )}
                <CloseHistoryChart
                  rows={response.rows}
                  symbol={selected.listing.symbol}
                />
                <details className="managed-market-source">
                  <summary>Source and request dates</summary>
                  <p>
                    Data provided by Tiingo. Raw closes are not adjusted for
                    splits or dividends. Completion records this request, not a
                    live market update.
                  </p>
                  <dl className="managed-metadata">
                    <dt>Requested window</dt>
                    <dd>
                      {response.window.startDate} to {response.window.endDate}
                    </dd>
                    <dt>Request started</dt>
                    <dd>{response.requestStartedAt}</dd>
                    <dt>Source request completed</dt>
                    <dd>{response.completedAt}</dd>
                  </dl>
                </details>
              </>
            ) : (
              <p className="managed-market-empty">
                Load board prices to see this listing's dated chart and exact
                closing values. Selecting a listing makes no price request.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
