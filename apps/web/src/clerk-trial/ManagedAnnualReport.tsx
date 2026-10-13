import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import "./managed-annual-overview.css";
import { SecAnnualEvidenceResult } from "../features/research/SecAnnualEvidenceResult";
import type { ManagedAnnualReport as AnnualReportModel } from "./managed-annual-report";
import {
  ManagedAnnualNoteAction,
  type ManagedAnnualNoteActions,
} from "./ManagedAnnualNoteAction";
import {
  ManagedAnnualCashNoteAction,
  type ManagedAnnualCashNoteActions,
} from "./ManagedAnnualCashNoteAction";

export function ManagedAnnualReport({
  model,
  noteActions,
  cashNoteActions,
}: {
  model: AnnualReportModel;
  noteActions?: ManagedAnnualNoteActions;
  cashNoteActions?: ManagedAnnualCashNoteActions;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
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
      className="managed-annual-report"
      aria-labelledby="managed-annual-heading"
      aria-busy={state.running}
    >
      <div className="managed-annual-toolbar">
        <h3 id="managed-annual-heading" ref={heading} tabIndex={-1}>
          Annual report
        </h3>
        <div className="trial-actions">
          <button
            ref={loadButton}
            disabled={state.running || state.catalogChanged}
            onClick={() => void model.load()}
          >
            {annualLoadLabel(state.running, state.response !== null)}
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
              Cancel annual report
            </button>
          )}
        </div>
      </div>
      <p className="managed-annual-scope">
        Reported revenue, net income and cash generation from SEC Company Facts.
      </p>
      <p
        className="managed-annual-status"
        role={state.error ? "alert" : "status"}
        aria-live="polite"
      >
        {state.message}
      </p>
      {state.showingPrevious && state.response && (
        <p className="managed-annual-help">
          Showing the previous report, completed{" "}
          {state.response.evidence.generation.completedAt}. This refresh has not
          confirmed newer evidence. Source and observation times are unchanged.
        </p>
      )}
      {state.response && (
        <SecAnnualEvidenceResult
          response={state.response}
          appearance="financial"
          cashAction={
            cashNoteActions ? (
              <ManagedAnnualCashNoteAction
                response={state.response}
                actions={cashNoteActions}
              />
            ) : null
          }
          renderPairAction={(pair) =>
            noteActions && state.response ? (
              <ManagedAnnualNoteAction
                key={state.response.evidence.generation.sha256}
                pair={pair}
                action={noteActions.getAction(state.response, pair)}
                onAppend={() => noteActions.append(state.response!, pair)}
              />
            ) : null
          }
        />
      )}
      <p className="managed-annual-help">
        Loading leaves your watchlist unchanged. Cancel stops this screen's
        pending load and keeps any previous report shown here. A request already
        admitted by the service may finish there.
      </p>
    </section>
  );
}

function annualLoadLabel(running: boolean, hasResponse: boolean) {
  if (running)
    return hasResponse ? "Refreshing annual report…" : "Loading annual report…";
  return hasResponse ? "Refresh annual report" : "Load annual report";
}
