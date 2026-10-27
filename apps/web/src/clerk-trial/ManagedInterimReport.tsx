import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type {
  ManagedInterimReport as Model,
  ManagedInterimReportState as State,
} from "./managed-interim-report";
import {
  ManagedInterimStatementsReview,
  type ManagedInterimStatementsActions,
} from "./ManagedInterimStatementsReview";
import "./managed-interim-statements.css";
interface Props {
  readonly model: Model;
  readonly actions: ManagedInterimStatementsActions;
  readonly blockedReason: string | null;
  readonly onLoad: () => void;
  readonly onCancel: () => void;
}
function interimLoadBlocked(state: State) {
  return !state.supported || state.running || state.catalogChanged;
}
function InterimLoadControls({
  state,
  onLoad,
  onCancel,
}: { readonly state: State } & Pick<Props, "onLoad" | "onCancel">) {
  return (
    <div className="trial-actions">
      <button
        type="button"
        id="interim-report-load"
        disabled={interimLoadBlocked(state)}
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
  );
}
function InterimReadStatus({ state }: { readonly state: State }) {
  return (
    <>
      {state.message && (
        <p role={state.error ? "alert" : "status"}>{state.message}</p>
      )}
      {state.showingPrevious && (
        <p>
          Retained previous report. The latest attempt has not established newer
          evidence; all original clocks remain.
        </p>
      )}
    </>
  );
}
function LoadedInterimReview({
  state,
  actions,
  blockedReason,
}: { readonly state: State } & Pick<Props, "actions" | "blockedReason">) {
  if (!state.response || !state.view) return null;
  return (
    <ManagedInterimStatementsReview
      response={state.response}
      actions={actions}
      blockedReason={
        state.running
          ? "Wait for the interim read to finish before preparing a note."
          : blockedReason
      }
    />
  );
}
export function ManagedInterimReport({
  model,
  actions,
  blockedReason,
  onLoad,
  onCancel,
}: Props) {
  const state = useSyncExternalStore(
      model.subscribe,
      model.getSnapshot,
      model.getSnapshot,
    ),
    heading = useRef<HTMLHeadingElement>(null);
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
      <InterimLoadControls state={state} onLoad={onLoad} onCancel={onCancel} />
      <InterimReadStatus state={state} />
      <LoadedInterimReview
        state={state}
        actions={actions}
        blockedReason={blockedReason}
      />
    </section>
  );
}
