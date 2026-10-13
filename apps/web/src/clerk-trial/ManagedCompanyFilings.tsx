import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

import { ManagedFilingsResults } from "./ManagedFilingsResults";
import type { ManagedFilingsNoteActions } from "./ManagedFilingsNoteAction";
import type { ManagedAnnualReport as AnnualModel } from "./managed-annual-report";
import { getManagedFilingsAnnualBaseline } from "./managed-filings-annual-baseline";

import {
  type ManagedCompanyFilingsState,
  type ManagedCompanyFilings as FilingsModel,
} from "./managed-company-filings";

import "./managed-company-filings.css";

function loadLabel(running: boolean, hasResponse: boolean) {
  if (running) return hasResponse ? "Refreshing filings…" : "Loading filings…";

  return hasResponse ? "Refresh filings" : "Load filings";
}

export function ManagedCompanyFilings({
  model,
  annual,
  noteActions,
}: {
  model: FilingsModel;
  annual: AnnualModel;
  noteActions?: ManagedFilingsNoteActions;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const annualState = useSyncExternalStore(
    annual.subscribe,
    annual.getSnapshot,
    annual.getSnapshot,
  );
  const baseline = getManagedFilingsAnnualBaseline(annualState, state);

  const heading = useRef<HTMLHeadingElement>(null);

  const loadButton = useRef<HTMLButtonElement>(null);

  const restoreLoadFocus = useRef(false);

  useLayoutEffect(() => {
    if (state.selection) heading.current?.focus();
  }, [state.selection]);

  useLayoutEffect(() => {
    if (!state.running && restoreLoadFocus.current) {
      restoreLoadFocus.current = false;
      loadButton.current?.focus();
    }
  }, [state.running]);

  if (!state.selection) return null;

  return (
    <section
      className="managed-company-filings"
      aria-labelledby="managed-filings-heading"
      aria-busy={state.running}
    >
      <div className="managed-filings-toolbar">
        <h3 id="managed-filings-heading" ref={heading} tabIndex={-1}>
          SEC filings
        </h3>

        <div className="trial-actions">
          <button
            ref={loadButton}
            disabled={state.running || state.catalogChanged}
            onClick={() => void model.load()}
          >
            {loadLabel(state.running, state.response !== null)}
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
              Cancel filings
            </button>
          )}
        </div>
      </div>

      <p className="managed-filings-scope">
        Recent filing links for this issuer, across forms. Load explicitly to
        check the last 90 days.
      </p>

      <p
        className="managed-filings-status"
        role={state.error ? "alert" : "status"}
        aria-live="polite"
      >
        {state.message}
      </p>

      <PreviousFilingsAttempt state={state} />
      {state.response && (
        <ManagedFilingsResults
          response={state.response}
          refreshComparison={
            state.refreshComparison?.current === state.response
              ? state.refreshComparison
              : null
          }
          baseline={baseline}
          annualPrevious={annualState.showingPrevious}
          annualFromComparison={
            annualState.responseOrigin === "watchlist-comparison"
          }
          {...(noteActions ? { noteActions } : {})}
        />
      )}

      <p className="managed-filings-scope">
        Loading and paging leave your watchlist and notes unchanged. Cancel
        stops this screen's pending load; a request already admitted by the
        service may finish there.
      </p>
    </section>
  );
}

function PreviousFilingsAttempt({
  state,
}: {
  state: ManagedCompanyFilingsState;
}) {
  return (
    <>
      {state.showingPrevious && state.response && (
        <p className="managed-filings-warning">
          Showing the previous filings response, completed{" "}
          {state.response.completedAt}. This attempt has not confirmed newer
          filings; its original dates and source metadata remain unchanged.
        </p>
      )}

      {state.showingPrevious &&
        state.lastCheck &&
        state.lastCheck !== state.response && (
          <p className="managed-filings-source">
            Latest source attempt checked {state.lastCheck.issuer.fetchedAt};
            completed {state.lastCheck.completedAt}.
          </p>
        )}
    </>
  );
}
