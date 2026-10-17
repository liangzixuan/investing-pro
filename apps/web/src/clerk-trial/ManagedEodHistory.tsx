import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { CloseHistoryChart } from "../features/research/CloseHistoryChart";
import type { ManagedEodHistory as Model } from "./managed-eod-history";
import { ObservedRawCloseRange } from "./ObservedRawCloseRange";
import { ManagedPriceStudies } from "./ManagedPriceStudies";
import type { ManagedPriceStudiesActions } from "./managed-price-studies-note";
import {
  ManagedPriceNoteAction,
  type ManagedPriceNoteActions,
} from "./ManagedPriceNoteAction";

export function ManagedEodHistory({
  model,
  noteActions,
  studiesActions,
  studiesBlockedReason = null,
}: {
  model: Model;
  noteActions?: ManagedPriceNoteActions;
  studiesActions?: ManagedPriceStudiesActions;
  studiesBlockedReason?: string | null;
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
            Raw end-of-day closing prices in USD from Tiingo. Prices are not
            adjusted for splits or dividends and are not live quotes. Use Load
            or Refresh to request prices; they stay for this company visit.
            Cancel stops loading here and keeps previous history. An accepted
            request may still finish and use the service's request budget.
          </p>
          <div className="managed-eod-range">
            <label htmlFor="managed-eod-range">History range</label>
            <select
              id="managed-eod-range"
              value={state.selectedRange}
              disabled={state.running || state.catalogChanged}
              onChange={(event) => {
                const range = event.currentTarget.value;
                if (range === "1m" || range === "1y") model.selectRange(range);
              }}
            >
              <option value="1m">One month</option>
              <option value="1y">One year</option>
            </select>
          </div>
          <p className="managed-eod-help">
            Choose a range, then select Load or Refresh. Changing the range does
            not request prices or change the history already shown.
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
                : response?.range === state.selectedRange
                  ? "Refresh close history"
                  : state.selectedRange === "1y"
                    ? "Load one-year close history"
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
          {response &&
            (state.responseOrigin === "markets" ||
              state.responseOrigin === "watchlist") && (
              <p className="managed-eod-origin">
                Showing history loaded in{" "}
                {state.responseOrigin === "watchlist"
                  ? "My Watchlist"
                  : "Markets"}
                . Original dates and request times are unchanged.
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
              <ObservedRawCloseRange response={response} />
              <CloseHistoryChart
                appearance="precision-desk"
                rows={response.rows}
                symbol={response.security.symbol}
                renderAction={
                  noteActions
                    ? (start, end, isCurrent) => (
                        <ManagedPriceNoteAction
                          key={`${start.date}:${end.date}`}
                          action={noteActions.getAction(response, start, end)}
                          isCurrent={isCurrent}
                          onAppend={() =>
                            noteActions.append(response, start, end)
                          }
                        />
                      )
                    : undefined
                }
              />
              {studiesActions && (
                <ManagedPriceStudies
                  response={response}
                  showingPrevious={state.showingPrevious}
                  blockedReason={
                    state.running
                      ? "Wait for the price request to finish before preparing study results."
                      : state.catalogChanged
                        ? "The catalog changed. Reopen this company before preparing study results."
                        : studiesBlockedReason
                  }
                  actions={studiesActions}
                />
              )}
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
