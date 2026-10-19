import type { ValuationAssumptionsView } from "./useValuationAssumptionsView";
export function ValuationLoadStageActions({
  view,
}: {
  readonly view: ValuationAssumptionsView;
}) {
  const { model, ready, canLoad, canStage } = view;
  return (
    <>
      <button
        id="managed-valuation-load"
        className="trial-secondary"
        disabled={!canLoad}
        onClick={() => {
          if (ready() && canLoad) void model.coordinator.load();
        }}
      >
        Load saved inputs
      </button>
      <button
        id="managed-valuation-stage-review"
        className="trial-secondary"
        disabled={!canStage}
        onClick={() => {
          if (ready() && canStage) void model.prepareStage();
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
  const { model, saved, ready, canSave, canReview, canRecover, reviewDraft } =
    view;
  return (
    <>
      <button
        id="managed-valuation-review"
        className="trial-secondary"
        disabled={!canReview}
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
          if (!ready()) return;
          if (!canSave) return;
          if (!model.canSavePayload()) return;
          void model.coordinator.save();
        }}
      >
        Save valuation inputs
      </button>
      {saved.uncertain && (
        <button
          id="managed-valuation-reconcile"
          disabled={!canRecover}
          onClick={() => {
            if (ready() && canRecover) void model.coordinator.reconcile();
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
