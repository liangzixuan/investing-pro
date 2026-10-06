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
      <p>
        One month of end-of-day raw closing prices in USD from Tiingo. Prices
        are not adjusted for splits or dividends and are not live quotes. Load
        or refresh explicitly to request prices. Prices stay only during this
        company visit. Cancel stops this screen's pending request and keeps any
        previous history shown here. An already admitted service request may
        finish and consume its existing budget.
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
      {state.showingPrevious && response && (
        <p className="managed-eod-previous">
          Showing previous close history, completed {response.completedAt}. This
          refresh has not confirmed newer prices. Trading dates, requested
          window and request times are unchanged.
        </p>
      )}
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
        </>
      )}
    </section>
  );
}
