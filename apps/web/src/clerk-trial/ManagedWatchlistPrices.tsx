import { useLayoutEffect, useRef } from "react";
import {
  membershipMatchesResult,
  type ManagedEodHistoryResponseDto,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import { RawCloseChange } from "./RawCloseChange";
import type {
  ManagedWatchlistPriceHandle,
  ManagedWatchlistPriceRow,
  ManagedWatchlistPricesState,
} from "./managed-watchlist-prices";

export function watchlistPriceRow(
  state: ManagedWatchlistPricesState,
  member: WatchlistMembership,
) {
  return state.rows.find((row) => membershipMatchesResult(member, row.listing));
}

function LastClose({
  response,
  id,
}: {
  response: ManagedEodHistoryResponseDto | null;
  id: string;
}) {
  const last = response?.rows.at(-1);
  if (!last || !response) return <strong>Price not loaded</strong>;
  return (
    <>
      <strong>${last.close}</strong>
      <small>USD raw close · {last.date}</small>
      <RawCloseChange rows={response.rows} id={`${id}-change`} compact />
    </>
  );
}

/** Readout only: the surrounding listing button owns selection. */
export function ManagedWatchlistPriceReadout({
  row,
  id,
}: {
  row: ManagedWatchlistPriceRow | undefined;
  id: string;
}) {
  return (
    <span id={id} className="managed-watchlist-price-readout">
      {row ? (
        <LastClose response={row.history.response} id={id} />
      ) : (
        <strong>Price unavailable</strong>
      )}
      {row?.history.showingPrevious && row.history.response && (
        <span className="managed-watchlist-price-previous">
          Previous history
        </span>
      )}
      {row?.history.running && <small>Loading price…</small>}
    </span>
  );
}

function canLoadPrice(state: ManagedWatchlistPricesState, active: boolean) {
  return (
    active &&
    state.active &&
    state.canRead &&
    !state.pending &&
    !state.catalogChanged
  );
}

function PriceEvidence({ row }: { row: ManagedWatchlistPriceRow }) {
  const { response, showingPrevious } = row.history;
  if (!response) return null;
  return (
    <>
      {showingPrevious && (
        <p className="managed-eod-previous">
          Showing previous history completed {response.completedAt}. This
          request has not confirmed newer prices. Dates and values are
          unchanged.
        </p>
      )}
      <details className="managed-watchlist-price-source">
        <summary>Price source and request dates</summary>
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
        <p>
          Data provided by Tiingo. Completion records this request, not a live
          market update.
        </p>
      </details>
    </>
  );
}

interface LoadOrigin {
  handle: ManagedWatchlistPriceHandle;
  control: HTMLButtonElement;
}
interface CancelFocus extends LoadOrigin {
  cancel: HTMLButtonElement;
}

function restoreCancelledLoad(
  request: CancelFocus,
  row: ManagedWatchlistPriceRow | undefined,
  active: boolean,
) {
  const control = request.control;
  if (
    !active ||
    row?.handle !== request.handle ||
    !control.isConnected ||
    control.disabled ||
    control.getClientRects().length === 0
  )
    return;
  if (
    document.activeElement === request.cancel ||
    document.activeElement === document.body
  )
    control.focus();
}

export function ManagedWatchlistPrices({
  selected,
  state,
  active,
  identityReady,
  onLoad,
}: {
  selected: WatchlistMembership;
  state: ManagedWatchlistPricesState;
  active: boolean;
  identityReady: boolean;
  onLoad: (handle: ManagedWatchlistPriceHandle) => void;
}) {
  const row = watchlistPriceRow(state, selected);
  const origin = useRef<LoadOrigin | null>(null);
  const restore = useRef<CancelFocus | null>(null);
  const pending = state.pending;
  const currentPending = useRef(pending);
  const enabled = canLoadPrice(state, active);
  useLayoutEffect(() => {
    currentPending.current = pending;
    const request = restore.current;
    if (!request) return;
    restore.current = null;
    if (!pending) restoreCancelledLoad(request, row, active && state.active);
  }, [pending, row, active, state.active]);
  return (
    <section
      className="managed-watchlist-prices"
      aria-labelledby="managed-watchlist-price-heading"
    >
      <h4 id="managed-watchlist-price-heading">Dated price</h4>
      {row ? (
        <>
          <ManagedWatchlistPriceReadout
            row={row}
            id="managed-watchlist-selected-price"
          />
          <div className="trial-actions">
            <button
              type="button"
              data-watchlist-price-load
              disabled={!enabled}
              onClick={(event) => {
                if (!enabled) return;
                origin.current = {
                  handle: row.handle,
                  control: event.currentTarget,
                };
                onLoad(row.handle);
              }}
            >
              {row.history.response ? "Refresh" : "Load"} {selected.symbol}{" "}
              price
            </button>
          </div>
          <p
            className="managed-watchlist-price-status"
            role={row.history.error ? "alert" : "status"}
          >
            {row.history.message}
          </p>
          <PriceEvidence row={row} />
        </>
      ) : (
        <p className="managed-watchlist-price-status">
          {identityReady
            ? "Price history is not available for this listing in this workspace. No price request is made."
            : "Price loading is unavailable until this listing is confirmed in the current catalog."}
        </p>
      )}
      {pending && (
        <div className="managed-watchlist-price-pending">
          <p role="status">
            Loading {pending.listing.symbol} price ·{" "}
            {pending.listing.shareClassName} · {pending.listing.exchangeMic}
          </p>
          <button
            type="button"
            className="trial-secondary"
            onClick={(event) => {
              if (currentPending.current !== pending) return;
              const started = origin.current;
              if (started && document.activeElement === event.currentTarget)
                restore.current = { ...started, cancel: event.currentTarget };
              pending.cancel();
            }}
          >
            Cancel {pending.listing.symbol} price
          </button>
        </div>
      )}
      {row && (
        <p className="managed-watchlist-price-help">
          Raw USD closes from Tiingo, not live quotes. Change uses this
          listing's last two observed dates and is not adjusted for splits or
          dividends. Listings can have different dates. Open EOD close history
          to inspect the loaded values. Loading prices does not save your draft.
        </p>
      )}
    </section>
  );
}
