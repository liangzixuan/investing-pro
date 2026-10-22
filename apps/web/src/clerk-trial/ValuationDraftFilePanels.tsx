import type { RefObject } from "react";
import {
  ValuationAssumptionReview,
  ValuationEditorReview,
} from "./ValuationAssumptionReview";
import type {
  ValuationDraftFileState,
  ValuationDraftFileActions,
} from "./useValuationDraftFiles";
interface ControlsProps {
  state: ValuationDraftFileState;
  input: RefObject<HTMLInputElement | null>;
  current: boolean;
  actions: ValuationDraftFileActions;
}
function DraftFileExport({ state, current, actions }: ControlsProps) {
  return (
    <button
      type="button"
      className="trial-secondary"
      disabled={!current || !state.canExport}
      aria-busy={state.phase === "exporting"}
      onClick={actions.exportInputs}
    >
      {state.phase === "exporting" ? "Saving inputs file…" : "Save inputs file"}
    </button>
  );
}
function DraftFileInput({ state, input, current, actions }: ControlsProps) {
  return (
    <label className="managed-draft-file-input">
      Select a valuation inputs file
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        disabled={!current || !state.canImport}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) actions.readFile(file);
        }}
      />
    </label>
  );
}
function DraftCaptureAvailability({ canExport }: { canExport: boolean }) {
  if (canExport) return null;
  return (
    <p>
      File capture needs unsaved inputs for the exact current company identity
      within the editor limits. Correct a rejected oversized entry or explicitly
      replace retained inputs with a different identity first.
    </p>
  );
}
function DraftFileAvailability({ state }: Pick<ControlsProps, "state">) {
  if (state.canImport)
    return <DraftCaptureAvailability canExport={state.canExport} />;
  if (state.preview) return null;
  return (
    <p>
      Return to the matching company and finish any saved-input operation or
      review before selecting a file. Loading saved inputs is not required.
    </p>
  );
}
function fileOperationPending(phase: ValuationDraftFileState["phase"]) {
  if (phase === "reading") return true;
  return phase === "exporting";
}
function DraftFileCancel({ state, current, actions }: ControlsProps) {
  if (!fileOperationPending(state.phase)) return null;
  return (
    <button
      type="button"
      className="trial-secondary"
      disabled={!current}
      onClick={(event) => actions.cancel(event.currentTarget)}
    >
      Cancel file operation
    </button>
  );
}
export function ValuationDraftFileControls(props: ControlsProps) {
  return (
    <>
      <DraftFileExport {...props} />
      <DraftFileInput {...props} />
      <DraftFileAvailability state={props.state} />
      <DraftFileCancel {...props} />
    </>
  );
}
interface ReviewProps {
  state: ValuationDraftFileState;
  heading: RefObject<HTMLHeadingElement | null>;
  current: boolean;
  actions: ValuationDraftFileActions;
}
export function ValuationDraftFileReview({
  state,
  heading,
  current,
  actions,
}: ReviewProps) {
  if (!state.preview) return null;
  if (!state.currentEditor) return null;
  return (
    <section
      className="trial-review"
      aria-labelledby="managed-valuation-file-review-heading"
    >
      <h3
        id="managed-valuation-file-review-heading"
        ref={heading}
        tabIndex={-1}
      >
        Review the complete file inputs
      </h3>
      <p>
        The file reports capture time {state.preview.capturedAt}. This metadata
        does not verify the capture time, listing identity or input contents.
      </p>
      <p>
        Restore replaces both complete model input maps in the current editor,
        marks the editor unsaved and clears calculated results. Raw text,
        including empty or invalid numbers, is retained without correction.
        Calculate, Stage, Review and Save remain separate actions.
      </p>
      <h4>File inputs</h4>
      <ValuationAssumptionReview entry={state.preview.entry} />
      <details>
        <summary>Current editor that will be replaced</summary>
        <ValuationEditorReview editor={state.currentEditor} />
      </details>
      <div className="trial-toolbar">
        <button
          type="button"
          disabled={!current || state.phase !== "review"}
          onClick={(event) => actions.restore(event.currentTarget)}
        >
          Restore file to current editor
        </button>
        <button
          type="button"
          className="trial-secondary"
          disabled={!current}
          onClick={(event) => actions.cancel(event.currentTarget)}
        >
          Keep current editor
        </button>
      </div>
    </section>
  );
}
export function ValuationDraftFileStatus({
  state,
}: {
  state: ValuationDraftFileState;
}) {
  return (
    <p role="status">
      {state.phase === "reading"
        ? "Reading the selected file locally…"
        : state.message}
    </p>
  );
}
