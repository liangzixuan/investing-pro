import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ManagedInterimReport as Model } from "./managed-interim-report";
import {
  ManagedInterimStatementsReview,
  type ManagedInterimStatementsActions,
} from "./ManagedInterimStatementsReview";
import "./managed-interim-statements.css";
export function ManagedInterimReport({
  model,
  actions,
  blockedReason,
  onLoad,
  onCancel,
}: {
  readonly model: Model;
  readonly actions: ManagedInterimStatementsActions;
  readonly blockedReason: string | null;
  readonly onLoad: () => void;
  readonly onCancel: () => void;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (state.selection) heading.current?.focus();
  }, [state.selection]);
  if (!state.selection) return null;
  return (
    <section
      id="managed-interim-report"
      className="managed-interim-report"
      aria-labelledby="managed-interim-heading"
      aria-busy={state.running}
    >
      <h3 id="managed-interim-heading" ref={heading} tabIndex={-1}>
        Interim reported-period review
      </h3>
      <p>
        {state.selection.listing.issuerName} ·{" "}
        {state.selection.listing.securityName} ·{" "}
        {state.selection.listing.symbol} · {state.selection.listing.exchangeMic}
      </p>
      <div className="trial-actions">
        <button
          type="button"
          id="interim-report-load"
          disabled={!state.supported || state.running || state.catalogChanged}
          onClick={onLoad}
        >
          {state.response ? "Refresh interim report" : "Load interim report"}
        </button>
        {state.running && (
          <button
            type="button"
            className="trial-secondary"
            id="interim-report-cancel"
            onClick={onCancel}
          >
            Cancel interim load
          </button>
        )}
      </div>
      {state.message && (
        <p role={state.error ? "alert" : "status"}>{state.message}</p>
      )}
      {state.showingPrevious && (
        <p>
          Retained previous report. The latest attempt has not established newer
          evidence; all original clocks remain.
        </p>
      )}
      {state.response && state.view && (
        <ManagedInterimStatementsReview
          response={state.response}
          actions={actions}
          blockedReason={
            state.running
              ? "Wait for the interim read to finish before preparing a note."
              : blockedReason
          }
        />
      )}
    </section>
  );
}
