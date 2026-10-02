import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { CloseHistoryChart } from "../features/research/CloseHistoryChart";
import type { ManagedEodHistory as Model } from "./managed-eod-history";

export function ManagedEodHistory({
  model,
  onBack,
}: {
  model: Model;
  onBack: () => void;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const load = useRef<HTMLButtonElement>(null);
  const restoreLoadFocus = useRef(false);
  useEffect(() => {
    if (state.selection) heading.current?.focus();
  }, [state.selection]);
  useLayoutEffect(() => {
    if (!state.running && restoreLoadFocus.current) {
      restoreLoadFocus.current = false;
      load.current?.focus();
    }
  }, [state.running]);
  if (!state.selection) return null;
  const response = state.response;
  const last = response?.rows.at(-1);
  return (
    <section
      className="trial-panel managed-eod-history"
      aria-labelledby="managed-eod-heading"
      aria-busy={state.running}
    >
      <div className="trial-toolbar">
        <h2 id="managed-eod-heading" ref={heading} tabIndex={-1}>
          EOD close history · {state.selection.listing.symbol}
        </h2>
        <button className="trial-secondary" onClick={onBack}>
          Back to workspace
        </button>
      </div>
      <p>
        {state.selection.listing.issuerName} ·{" "}
        {state.selection.listing.shareClassName} ·{" "}
        {state.selection.listing.exchangeMic}
      </p>
      <p>
        One month of end-of-day raw closing prices in USD from Tiingo. Prices
        are not adjusted for splits or dividends and are not live quotes.
        Loading or refreshing sends one request. Prices stay only in this open
        panel.
      </p>
      <div className="trial-actions">
        <button
          ref={load}
          disabled={state.running || state.catalogChanged}
          onClick={() => void model.load()}
        >
          {state.running
            ? "Loading close history…"
            : response
              ? "Refresh close history"
              : "Load one-month close history"}
        </button>
        {state.running && (
          <button
            className="trial-secondary"
            onClick={(event) => {
              restoreLoadFocus.current =
                document.activeElement === event.currentTarget;
              model.cancel();
            }}
          >
            Cancel close history
          </button>
        )}
      </div>
      <p role={state.error ? "alert" : "status"} aria-live="polite">
        {state.message}
      </p>
      {response && last && (
        <>
          <dl className="managed-metadata">
            <dt>Last raw close (USD)</dt>
            <dd>{last.close}</dd>
            <dt>Last trading date</dt>
            <dd>{last.date}</dd>
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
            Data provided by Tiingo. Completion time records this request, not a
            live market update.
          </p>
          <CloseHistoryChart
            rows={response.rows}
            symbol={response.security.symbol}
          />
        </>
      )}
    </section>
  );
}
