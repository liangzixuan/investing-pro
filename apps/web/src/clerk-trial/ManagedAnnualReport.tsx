import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { SecAnnualEvidenceResult } from "../features/research/SecAnnualEvidenceResult";
import type { ManagedAnnualReport as AnnualReportModel } from "./managed-annual-report";
import {
  ManagedAnnualNoteAction,
  type ManagedAnnualNoteActions,
} from "./ManagedAnnualNoteAction";

export function ManagedAnnualReport({
  model,
  noteActions,
}: {
  model: AnnualReportModel;
  noteActions?: ManagedAnnualNoteActions;
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
      <h3 id="managed-annual-heading" ref={heading} tabIndex={-1}>
        Annual report
      </h3>
      <p>
        Observed SEC annual revenue, net income and net margin in USD. Revenue
        concepts stay separate. This view covers the observed report in current
        submissions; it does not provide complete filing history or prices.
      </p>
      <div className="trial-actions">
        <button
          ref={loadButton}
          disabled={state.running || state.catalogChanged}
          onClick={() => void model.load()}
        >
          {state.running
            ? state.response
              ? "Refreshing annual report…"
              : "Loading annual report…"
            : state.response
              ? "Refresh annual report"
              : "Load annual report"}
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
      <p role={state.error ? "alert" : "status"} aria-live="polite">
        {state.message}
      </p>
      {state.showingPrevious && state.response && (
        <p className="managed-annual-help">
          Showing the previous report, completed{" "}
          {state.response.evidence.generation.completedAt}. This refresh has not
          confirmed newer evidence. Source and observation times are unchanged.
        </p>
      )}
      <p className="managed-annual-help">
        Loading leaves your watchlist unchanged. Cancel stops this screen's
        pending load and keeps any previous report shown here. A request already
        admitted by the service may finish there.
      </p>
      {state.response && (
        <SecAnnualEvidenceResult
          key={state.response.evidence.generation.sha256}
          response={state.response}
          renderPairAction={(pair) =>
            noteActions && state.response ? (
              <ManagedAnnualNoteAction
                pair={pair}
                action={noteActions.getAction(state.response, pair)}
                onAppend={() => noteActions.append(state.response!, pair)}
              />
            ) : null
          }
        />
      )}
    </section>
  );
}
