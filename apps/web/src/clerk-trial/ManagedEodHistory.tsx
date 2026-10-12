import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { CloseHistoryChart } from "../features/research/CloseHistoryChart";
import type { ManagedEodHistory as Model } from "./managed-eod-history";
import {
  ManagedPriceNoteAction,
  type ManagedPriceNoteActions,
} from "./ManagedPriceNoteAction";

export function ManagedEodHistory({
  model,
  noteActions,
}: {
  model: Model;
  noteActions?: ManagedPriceNoteActions;
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
      className="managed-eod-history"
      aria-labelledby="managed-eod-heading"
      aria-busy={state.running}
    >
      <h3 id="managed-eod-heading" ref={heading} tabIndex={-1}>
        EOD close history
      </h3>
      {!state.available ? (
        <p>{state.message}</p>
      ) : (
        <>
          <p className="managed-eod-help">
            One month of raw end-of-day closing prices in USD from Tiingo.
            Prices are not adjusted for splits or dividends and are not live
            quotes. Use Load or Refresh to request prices; they stay for this
            company visit. Cancel stops loading here and keeps previous history.
            An accepted request may still finish and use the service's request
            budget.
          </p>
          <div className="trial-actions">
            <button
              ref={load}
              disabled={state.running || state.catalogChanged}
              onClick={() => void model.load()}
            >
              {state.running
                ? response
                  ? "Refreshing close history…"
                  : "Loading close history…"
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
          {response && state.responseOrigin === "markets" && (
            <p className="managed-eod-origin">
              Showing history loaded in Markets. Original dates and request
              times are unchanged.
            </p>
          )}
          {state.showingPrevious && response && (
            <p className="managed-eod-previous">
              Showing previous close history, completed {response.completedAt}.
              This refresh has not confirmed newer prices. Trading dates,
              requested window and request times are unchanged.
            </p>
          )}
          {response && last && (
            <>
              <dl className="managed-metadata managed-eod-quote">
                <dt>Last raw close (USD)</dt>
                <dd>{last.close}</dd>
                <dt>Last trading date</dt>
                <dd>{last.date}</dd>
              </dl>
              <CloseHistoryChart
                appearance="precision-desk"
                rows={response.rows}
                symbol={response.security.symbol}
                renderAction={
                  noteActions
                    ? (start, isCurrent) => (
                        <ManagedPriceNoteAction
                          key={start.date}
                          action={noteActions.getAction(response, start)}
                          isCurrent={isCurrent}
                          onAppend={() => noteActions.append(response, start)}
                        />
                      )
                    : undefined
                }
              />
              <details className="managed-eod-source">
                <summary>Source and request dates</summary>
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
                  Data provided by Tiingo. Completion time records this request,
                  not a live market update.
                </p>
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
