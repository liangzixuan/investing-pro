import type { ValuationAssumptionsView } from "./useValuationAssumptionsView";
export function ValuationLoadStageActions({
  view,
}: {
  readonly view: ValuationAssumptionsView;
}) {
  const { model, saved, editor, ready, idle, editable, pendingReview } = view;
  return (
    <>
      <button
        id="managed-valuation-load"
        className="trial-secondary"
        disabled={!idle || saved.uncertain || Boolean(pendingReview)}
        onClick={() => {
          if (ready() && idle && !saved.uncertain && !pendingReview)
            void model.coordinator.load();
        }}
      >
        Load saved inputs
      </button>
      <button
        id="managed-valuation-stage-review"
        className="trial-secondary"
        disabled={
          !editable ||
          !editor.editable ||
          Boolean(editor.inputIssue) ||
          !saved.draft
        }
        onClick={() => {
          if (ready() && editable) void model.prepareStage();
        }}
      >
        Review current inputs for staging
      </button>
    </>
  );
}
export function ValuationSaveActions({
  view,
}: {
  readonly view: ValuationAssumptionsView;
}) {
  const {
    model,
    saved,
    ready,
    idle,
    editable,
    pendingReview,
    canSave,
    reviewDraft,
  } = view;
  return (
    <>
      <button
        id="managed-valuation-review"
        className="trial-secondary"
        disabled={!editable || !saved.dirty || !model.canSavePayload()}
        onClick={() => {
          reviewDraft();
        }}
      >
        Review valuation draft
      </button>
      <button
        id="managed-valuation-save"
        disabled={!canSave}
        onClick={() => {
          if (ready() && canSave && model.canSavePayload())
            void model.coordinator.save();
        }}
      >
        Save valuation inputs
      </button>
      {saved.uncertain && (
        <button
          id="managed-valuation-reconcile"
          disabled={!idle || Boolean(pendingReview)}
          onClick={() => {
            if (ready() && idle && !pendingReview)
              void model.coordinator.reconcile();
          }}
        >
          Reconcile original valuation save
        </button>
      )}
    </>
  );
}
export function ValuationResourceStatus({
  view,
}: {
  readonly view: ValuationAssumptionsView;
}) {
  const { saved, state } = view;
  return (
    <>
      <p>
        {saved.saved
          ? `Loaded saved version ${saved.saved.version}.`
          : "Saved inputs have not been loaded."}{" "}
        {saved.baseVersion !== null
          ? `Draft based on version ${saved.baseVersion}.`
          : ""}{" "}
        {saved.dirty ? "Unsaved valuation draft changes." : ""}
      </p>
      <p role="status" aria-live="polite">
        {saved.message} {state.message}
      </p>
    </>
  );
}
export function ValuationCancelActions({
  view,
}: {
  readonly view: ValuationAssumptionsView;
}) {
  const { model, state, ready, pendingReview, navigationPending } = view;
  return (
    <>
      {pendingReview && (
        <button
          id="managed-valuation-cancel-review"
          className="trial-secondary"
          disabled={navigationPending}
          onClick={() => {
            if (ready()) model.cancelReview();
          }}
        >
          Cancel input review
        </button>
      )}
      {state.reviewing && (
        <button
          id="managed-valuation-cancel-resolve"
          className="trial-secondary"
          disabled={navigationPending}
          onClick={() => {
            if (ready()) model.cancelReview();
          }}
        >
          Cancel catalog read
        </button>
      )}
    </>
  );
}
