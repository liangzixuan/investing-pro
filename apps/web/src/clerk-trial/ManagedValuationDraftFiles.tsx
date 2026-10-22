import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedValuationDraftFileDeliveryAdapter } from "./valuation-draft-file-delivery";
import { ManagedValuationDraftRecovery } from "./managed-valuation-draft-recovery";
import {
  ValuationAssumptionReview,
  ValuationEditorReview,
} from "./ValuationAssumptionReview";

interface Props {
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ManagedValuationDraftFileDeliveryAdapter | undefined;
  selection: ManagedResearchSelection;
  navigationPending: boolean;
  routeActive: () => boolean;
}
type RecoveryState = ReturnType<ManagedValuationDraftRecovery["getSnapshot"]>;
const empty: RecoveryState = Object.freeze({
  phase: "idle",
  preview: null,
  currentEditor: null,
  canExport: false,
  canImport: false,
  message: "",
});
const noop = () => () => {};
const emptySnapshot = () => empty;

function useDraftFiles(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const active = useRef<{
    controller: ManagedValuationDraftRecovery;
    workspace: ManagedWorkspace;
    accountScope: Promise<string>;
    delivery: Props["delivery"];
  } | null>(null);
  const [controller, setController] =
    useState<ManagedValuationDraftRecovery | null>(null);
  const { workspace, accountScope, delivery } = props;
  useLayoutEffect(() => {
    const next = new ManagedValuationDraftRecovery({
      workspace,
      accountScope,
      delivery,
      selection: () => latest.current.selection,
      routeActive: () =>
        !latest.current.navigationPending && latest.current.routeActive(),
    });
    active.current = { controller: next, workspace, accountScope, delivery };
    setController(next);
    return () => {
      if (active.current?.controller === next) active.current = null;
      next.dispose();
    };
  }, [workspace, accountScope, delivery]);
  useLayoutEffect(() => controller?.reconcile());
  const state = useSyncExternalStore(
    controller?.subscribe ?? noop,
    controller?.getSnapshot ?? emptySnapshot,
    controller?.getSnapshot ?? emptySnapshot,
  );
  const isCurrent = () =>
    controller !== null &&
    active.current?.controller === controller &&
    active.current.workspace === latest.current.workspace &&
    active.current.accountScope === latest.current.accountScope &&
    active.current.delivery === latest.current.delivery &&
    latest.current.selection === props.selection &&
    !latest.current.navigationPending &&
    latest.current.routeActive() &&
    controller.getSnapshot() === state;
  return { controller, state, isCurrent };
}

type FocusRequest = { source: HTMLElement } | null;
function useDraftFileFocus(state: RecoveryState, isCurrent: () => boolean) {
  const input = useRef<HTMLInputElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const previous = useRef(state.phase);
  const requested = useRef<FocusRequest>(null);
  useLayoutEffect(() => {
    const request = requested.current;
    if (state.phase === "retired") requested.current = null;
    if (request && state.phase === "idle") {
      requested.current = null;
      const stillOwned =
        document.activeElement === request.source ||
        (!request.source.isConnected &&
          document.activeElement === document.body);
      if (stillOwned && state.canImport && isCurrent()) input.current?.focus();
    }
    if (
      previous.current === "reading" &&
      state.phase === "review" &&
      document.activeElement === input.current &&
      isCurrent()
    ) {
      heading.current?.focus();
    }
    previous.current = state.phase;
  }, [state.phase, state.canImport, isCurrent]);
  return { input, heading, requested };
}

interface ControlsProps {
  state: RecoveryState;
  input: RefObject<HTMLInputElement | null>;
  current: boolean;
  readFile: (file: File) => void;
  exportInputs: () => void;
  cancel: (source: HTMLButtonElement) => void;
}
function DraftFileControls({
  state,
  input,
  current,
  readFile,
  exportInputs,
  cancel,
}: ControlsProps) {
  const busy = state.phase === "reading" || state.phase === "exporting";
  return (
    <>
      <button
        type="button"
        className="trial-secondary"
        disabled={!current || !state.canExport}
        aria-busy={state.phase === "exporting"}
        onClick={exportInputs}
      >
        {state.phase === "exporting"
          ? "Saving inputs file…"
          : "Save inputs file"}
      </button>
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
            if (file) readFile(file);
          }}
        />
      </label>
      {!state.preview && !state.canImport && (
        <p>
          Return to the matching company and finish any saved-input operation or
          review before selecting a file. Loading saved inputs is not required.
        </p>
      )}
      {state.canImport && !state.canExport && (
        <p>
          File capture needs unsaved inputs for the exact current company
          identity within the editor limits. Correct a rejected oversized entry
          or explicitly replace retained inputs with a different identity first.
        </p>
      )}
      {busy && (
        <button
          type="button"
          className="trial-secondary"
          disabled={!current}
          onClick={(event) => cancel(event.currentTarget)}
        >
          Cancel file operation
        </button>
      )}
    </>
  );
}

interface ReviewProps {
  state: RecoveryState;
  heading: RefObject<HTMLHeadingElement | null>;
  current: boolean;
  restore: (source: HTMLButtonElement) => void;
  cancel: (source: HTMLButtonElement) => void;
}
function DraftFileReview({
  state,
  heading,
  current,
  restore,
  cancel,
}: ReviewProps) {
  if (!state.preview || !state.currentEditor) return null;
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
          onClick={(event) => restore(event.currentTarget)}
        >
          Restore file to current editor
        </button>
        <button
          type="button"
          className="trial-secondary"
          disabled={!current}
          onClick={(event) => cancel(event.currentTarget)}
        >
          Keep current editor
        </button>
      </div>
    </section>
  );
}

export function ManagedValuationDraftFiles(props: Props) {
  const { controller, state, isCurrent } = useDraftFiles(props);
  const { input, heading, requested } = useDraftFileFocus(state, isCurrent);
  function cancel(source: HTMLButtonElement) {
    if (!isCurrent()) return;
    requested.current = { source };
    controller?.cancel();
  }
  function restore(source: HTMLButtonElement) {
    if (!isCurrent() || state.phase !== "review") return;
    requested.current = { source };
    if (!controller?.restore()) requested.current = null;
  }
  return (
    <details
      id="managed-valuation-draft-files"
      className="managed-valuation-input-files"
    >
      <summary>Valuation inputs files</summary>
      <p>
        Keep a file copy of both complete editor models before leaving. The JSON
        file contains listing identities and your raw assumptions in plain text.
        Store it privately. It does not replace a saved-record backup.
      </p>
      <p>
        Selecting a file reads it locally for comparison before explicit
        restore. Restoring changes only the editor. It does not calculate, stage
        or save online. Empty and invalid numeric text within the editor limits
        can be kept in the file. Loading saved inputs is not required.
      </p>
      <DraftFileControls
        state={state}
        input={input}
        current={isCurrent()}
        exportInputs={() => {
          if (isCurrent() && state.canExport) void controller?.exportInputs();
        }}
        readFile={(file) => {
          if (isCurrent() && state.canImport) void controller?.readFile(file);
        }}
        cancel={cancel}
      />
      <DraftFileReview
        state={state}
        heading={heading}
        current={isCurrent()}
        restore={restore}
        cancel={cancel}
      />
      <p role="status">
        {state.phase === "reading"
          ? "Reading the selected file locally…"
          : state.message}
      </p>
    </details>
  );
}
