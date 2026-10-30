import type { ValuationCollectionRecoveryState } from "./managed-valuation-collection-recovery";
import { CompletePayload } from "./ValuationAssumptionsPanels";
import {
  collectionCaptureVisible,
  type ValuationCollectionFileActions,
} from "./useValuationCollectionDraftFiles";
import type { ValuationCollectionFileFocus } from "./useValuationCollectionDraftFileFocus";
interface PanelProps {
  state: ValuationCollectionRecoveryState;
  available: boolean;
  focus: ValuationCollectionFileFocus;
  actions: ValuationCollectionFileActions;
}
function operationPending(state: ValuationCollectionRecoveryState) {
  return state.phase !== "idle" && state.phase !== "retired";
}
export function ValuationCollectionFileControls({
  state,
  available,
  focus,
  actions,
}: PanelProps) {
  return (
    <>
      <button
        id="managed-valuation-collection-capture"
        ref={focus.capture}
        type="button"
        disabled={!available || !state.canExport}
        onClick={(event) => actions.capture(event.currentTarget)}
      >
        Capture valuation collection
      </button>
      <label className="managed-draft-file-input">
        Select a valuation collection file
        <input
          id="managed-valuation-collection-file"
          ref={focus.input}
          type="file"
          accept="application/json,.json"
          disabled={!available || !state.canImport}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) actions.readFile(event.currentTarget, file);
          }}
        />
      </label>
      {!state.canImport && !operationPending(state) && (
        <p>
          Load the current saved valuation inputs first and finish any save,
          recovery or identity review. No editor input or calculation is
          required.
        </p>
      )}
    </>
  );
}
function CollectionReviewActions({
  state,
  available,
  actions,
}: Omit<PanelProps, "focus">) {
  return (
    <div className="trial-actions">
      {state.phase === "capture" && (
        <button
          id="managed-valuation-collection-save-file"
          type="button"
          disabled={!available}
          onClick={actions.saveFile}
        >
          Save captured collection file
        </button>
      )}
      {state.phase === "review" && (
        <button
          id="managed-valuation-collection-restore"
          type="button"
          disabled={!available}
          onClick={(event) => actions.restore(event.currentTarget)}
        >
          Restore collection to valuation draft
        </button>
      )}
    </div>
  );
}
export function ValuationCollectionFileReview({
  state,
  available,
  focus,
  actions,
}: PanelProps) {
  if (!state.preview || !state.currentDraft) return null;
  const captured = collectionCaptureVisible(state);
  return (
    <section
      className="trial-review"
      aria-labelledby="managed-valuation-collection-review-heading"
    >
      <h4
        id="managed-valuation-collection-review-heading"
        ref={focus.heading}
        tabIndex={-1}
      >
        {captured
          ? "Inspect the captured valuation collection"
          : "Review the complete collection file"}
      </h4>
      <p>
        Reported file capture time: {state.preview.capturedAt}. File metadata
        does not verify identities or assumptions. Current online save base:{" "}
        {state.currentSavedVersion}.
      </p>
      <CompletePayload
        label={
          captured
            ? "Captured staged valuation collection"
            : "Complete file collection"
        }
        payload={state.preview.payload}
      />
      {state.phase === "review" && (
        <CompletePayload
          label="Complete current draft that will be replaced"
          payload={state.currentDraft}
        />
      )}
      <CollectionReviewActions
        state={state}
        available={available}
        actions={actions}
      />
    </section>
  );
}
export function ValuationCollectionFileCancel({
  state,
  available,
  actions,
}: Omit<PanelProps, "focus">) {
  if (!operationPending(state)) return null;
  return (
    <button
      id="managed-valuation-collection-cancel"
      type="button"
      disabled={!available}
      className="trial-secondary"
      onClick={(event) => actions.cancel(event.currentTarget)}
    >
      Keep current draft / Cancel file operation
    </button>
  );
}
function statusMessage(state: ValuationCollectionRecoveryState) {
  if (state.phase === "reading") return "Reading the collection file locally…";
  if (state.phase === "exporting") return "Saving the collection file…";
  return state.message;
}
export function ValuationCollectionFileStatus({
  state,
}: Pick<PanelProps, "state">) {
  return <p role="status">{statusMessage(state)}</p>;
}
