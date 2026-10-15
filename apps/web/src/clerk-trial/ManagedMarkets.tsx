import {
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
} from "react";
import { RawCloseChange } from "./RawCloseChange";
import { CloseHistoryChart } from "../features/research/CloseHistoryChart";
import { ManagedPriceComparison } from "./ManagedPriceComparison";
import type {
  ManagedMarkets as Model,
  ManagedMarketsRow,
  ManagedMarketsState,
} from "./managed-markets";

interface ManagedMarketsProps {
  navigationPending: boolean;
  model: Model;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  sectionNavigation?: ReactNode;
  onResearch: (kind: "annual" | "eod", opener: HTMLButtonElement) => void;
  onWatchlist: () => void;
}

function PriceControls({
  state,
  loadRef,
  onLoad,
  onCancel,
  loadingSelected,
}: {
  state: Pick<
    ManagedMarketsState,
    "rows" | "running" | "resolving" | "catalogChanged"
  >;
  loadRef: Ref<HTMLButtonElement>;
  onLoad: () => void;
  onCancel: MouseEventHandler<HTMLButtonElement>;
  loadingSelected: boolean;
}) {
  const hasPrices = state.rows.some((row) => row.response !== null);
  return (
    <div className="trial-actions">
      <button
        ref={loadRef}
        disabled={
          !state.rows.length ||
          state.running ||
          state.resolving ||
          state.catalogChanged
        }
        onClick={onLoad}
      >
        {state.running && !loadingSelected
          ? "Loading prices…"
          : hasPrices
            ? "Refresh board prices"
            : "Load board prices"}
      </button>
      {state.running && (
        <button className="trial-secondary" onClick={onCancel}>
          {loadingSelected ? "Cancel price loading" : "Cancel board prices"}
        </button>
      )}
    </div>
  );
}

function MarketListingRow({
  row,
  active,
  onSelect,
}: {
  row: ManagedMarketsRow;
  active: boolean;
  onSelect: () => void;
}) {
  const descriptionId = useId();
  const priceId = `${descriptionId}-price`;
  const changeId = `${descriptionId}-change`;
  const last = row.response?.rows.at(-1);
  return (
    <li className="managed-market-listing" data-selected={active || undefined}>
      <button
        className="managed-market-row"
        aria-pressed={active}
        aria-label={`Select ${row.listing.symbol} on company board`}
        aria-describedby={row.response ? `${priceId} ${changeId}` : priceId}
        onClick={onSelect}
      >
        <span className="managed-market-identity">
          <strong>{row.listing.symbol}</strong>
          <span>{row.listing.issuerName}</span>
          <small>
            {row.listing.shareClassName} · {row.listing.exchangeMic}
          </small>
        </span>
        <span id={priceId} className="managed-market-close">
          <strong>{last ? `$${last.close}` : "Not loaded"}</strong>
          <small>
            {last ? `USD · ${last.date}` : "Load prices when ready"}
          </small>
        </span>
        {row.response && (
          <RawCloseChange rows={row.response.rows} id={changeId} compact />
        )}
      </button>
      <p
        className="managed-market-row-status"
        data-quiet={Boolean(
          row.response && !row.running && !row.error && !row.showingPrevious,
        )}
        role={row.error ? "alert" : "status"}
      >
        {row.message}
      </p>
      {row.showingPrevious && row.response && (
        <p className="managed-eod-previous">
          Previous history · completed {row.response.completedAt}. This refresh
          has not confirmed newer prices.
        </p>
      )}
    </li>
  );
}

function SelectedHistory({
  navigationPending,
  selected,
  loading,
  loadRef,
  onLoad,
  onResearch,
  onWatchlist,
}: {
  navigationPending: boolean;
  selected: ManagedMarketsRow;
  loading: boolean;
  loadRef: Ref<HTMLButtonElement>;
  onLoad: () => void;
  onResearch: ManagedMarketsProps["onResearch"];
  onWatchlist: ManagedMarketsProps["onWatchlist"];
}) {
  const response = selected.response;
  const last = response?.rows.at(-1);
  const changeId = useId();
  const actions = (
    <div className="trial-actions managed-market-research-actions">
      <button
        className="trial-secondary"
        aria-label={`Board price history for ${selected.listing.symbol}`}
        disabled={navigationPending}
        onClick={(event) => onResearch("eod", event.currentTarget)}
      >
        Price history
      </button>
      <button
        className="trial-secondary"
        aria-label={`Board Annual report for ${selected.listing.symbol}`}
        disabled={navigationPending}
        onClick={(event) => onResearch("annual", event.currentTarget)}
      >
        Annual report
      </button>
      <button
        className="trial-secondary"
        disabled={navigationPending}
        onClick={onWatchlist}
      >
        Open My Watchlist
      </button>
    </div>
  );
  return (
    <div
      className="managed-market-detail"
      aria-labelledby="managed-market-detail-heading"
    >
      <header className="managed-market-detail-header">
        <h3 id="managed-market-detail-heading">
          {selected.listing.issuerName}
        </h3>
        <p className="managed-market-detail-identity">
          <strong>{selected.listing.symbol}</strong> ·{" "}
          {selected.listing.exchangeMic} · {selected.listing.shareClassName}
        </p>
        {last && response ? (
          <div className="managed-market-quote">
            <p className="managed-market-quote-value">
              <span className="sr-only">Last raw close: </span>${last.close}
            </p>
            <RawCloseChange rows={response.rows} id={changeId} />
            <p className="managed-market-quote-date">
              Last trading date <time dateTime={last.date}>{last.date}</time> ·
              USD raw close
            </p>
          </div>
        ) : (
          <p className="managed-market-quote-unloaded">Price not loaded</p>
        )}
      </header>
      <div className="managed-market-chart-toolbar">
        <p className="managed-market-period">
          {selected.listing.symbol} · one month
        </p>
        <div className="trial-actions">
          <button ref={loadRef} disabled={loading} onClick={onLoad}>
            {selected.running
              ? `Loading ${selected.listing.symbol} price…`
              : `${response ? "Refresh" : "Load"} ${selected.listing.symbol} price`}
          </button>
        </div>
      </div>
      {response ? (
        <>
          {selected.showingPrevious && (
            <p className="managed-eod-previous">
              Showing previous history completed {response.completedAt}. Dates
              and values are unchanged.
            </p>
          )}
          <CloseHistoryChart
            rows={response.rows}
            symbol={selected.listing.symbol}
            appearance="precision-desk"
            actions={actions}
          />
          <details className="managed-market-source">
            <summary>Source and request dates</summary>
            <p>
              Data provided by Tiingo. Raw closes are not adjusted for splits or
              dividends. Completion records this request, not a live market
              update.
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
        <>
          <p className="managed-market-empty">
            Load {selected.listing.symbol} price to see its dated chart and
            exact closing values. Selecting a listing makes no price request.
          </p>
          {actions}
        </>
      )}
    </div>
  );
}

export function ManagedMarkets({
  navigationPending,
  model,
  headingRef,
  sectionNavigation,
  onResearch,
  onWatchlist,
}: ManagedMarketsProps) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const load = useRef<HTMLButtonElement>(null);
  const loadSelected = useRef<HTMLButtonElement>(null);
  const loadingSelected = useRef(false);
  const restoreLoad = useRef(false);
  useLayoutEffect(() => {
    if (!state.running && restoreLoad.current) {
      restoreLoad.current = false;
      (loadingSelected.current ? loadSelected : load).current?.focus();
    }
  }, [state.running]);
  const selected = state.rows.find(
    (row) => row.listing.listingId === state.selectedListingId,
  );
  const handleCancel: MouseEventHandler<HTMLButtonElement> = (event) => {
    restoreLoad.current = document.activeElement === event.currentTarget;
    model.cancel();
  };
  return (
    <section
      className="trial-panel managed-markets"
      aria-labelledby="managed-markets-heading"
    >
      <div className="trial-toolbar managed-markets-toolbar">
        <div>
          <h2 id="managed-markets-heading" ref={headingRef} tabIndex={-1}>
            Markets
          </h2>
          <p className="managed-markets-subtitle">Your company board</p>
        </div>
        <PriceControls
          state={state}
          loadRef={load}
          onLoad={() => {
            loadingSelected.current = false;
            void model.load();
          }}
          onCancel={handleCancel}
          loadingSelected={loadingSelected.current}
        />
      </div>
      {sectionNavigation}
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
        <div className="managed-market-list">
          <p className="managed-market-list-heading">
            {state.rows.length} listings
          </p>
          <ul
            className="managed-market-rows"
            aria-label="Company board listings"
          >
            {state.rows.map((row) => (
              <MarketListingRow
                key={row.listing.listingId}
                row={row}
                active={row.listing.listingId === state.selectedListingId}
                onSelect={() => model.select(row.listing.listingId)}
              />
            ))}
          </ul>
          <p className="managed-markets-help">
            Load board prices requests all three listings in order. Load or
            Refresh one listing makes one request and keeps other histories.
            Cancel keeps completed histories. Leaving Markets clears prices.
          </p>
        </div>
        {selected && (
          <SelectedHistory
            navigationPending={navigationPending}
            selected={selected}
            loading={state.running || state.resolving || state.catalogChanged}
            loadRef={loadSelected}
            onLoad={() => {
              loadingSelected.current = true;
              void model.loadSelected();
            }}
            onResearch={onResearch}
            onWatchlist={onWatchlist}
          />
        )}
      </div>
      <ManagedPriceComparison state={state} />
    </section>
  );
}
