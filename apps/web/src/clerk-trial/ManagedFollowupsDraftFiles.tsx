import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedFollowupsDraftFileDeliveryAdapter } from "./followups-draft-file-delivery";
import {
  ManagedFollowupsDraftRecovery,
  type FollowupsDraftRecoveryState,
} from "./managed-followups-draft-recovery";
import { FollowupsDraftDetails } from "./ManagedFollowupsDraftDetails";

interface Props {
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ManagedFollowupsDraftFileDeliveryAdapter | undefined;
  routeActive: () => boolean;
  onRestored: () => void;
}
const empty: FollowupsDraftRecoveryState = Object.freeze({
  phase: "idle",
  preview: null,
  currentDraft: null,
  currentSavedVersion: null,
  canExport: false,
  canImport: false,
  message: "",
});
const noop = () => () => {};
const emptySnapshot = () => empty;

function useDraftFiles(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const [controller, setController] =
    useState<ManagedFollowupsDraftRecovery | null>(null);
  const { workspace, accountScope, delivery } = props;
  useLayoutEffect(() => {
    const next = new ManagedFollowupsDraftRecovery({
      workspace,
      accountScope,
      delivery,
      routeActive: () => latest.current.routeActive(),
    });
    setController(next);
    return () => next.dispose();
  }, [workspace, accountScope, delivery]);
  useLayoutEffect(() => controller?.reconcile());
  const state = useSyncExternalStore(
    controller?.subscribe ?? noop,
    controller?.getSnapshot ?? emptySnapshot,
    controller?.getSnapshot ?? emptySnapshot,
  );
  return { controller, state };
}

function focusCompletedReview(
  previous: FollowupsDraftRecoveryState["phase"],
  state: FollowupsDraftRecoveryState,
  input: RefObject<HTMLInputElement | null>,
  heading: RefObject<HTMLHeadingElement | null>,
) {
  if (previous !== "reading") return;
  if (state.phase !== "review") return;
  if (document.activeElement !== input.current) return;
  heading.current?.focus();
}

function focusCancelledInput(
  requested: RefObject<boolean>,
  state: FollowupsDraftRecoveryState,
  input: RefObject<HTMLInputElement | null>,
) {
  if (!requested.current) return;
  if (state.phase === "retired") requested.current = false;
  if (state.phase !== "idle") return;
  requested.current = false;
  if (state.canImport) input.current?.focus();
}

function useDraftFileFocus(state: FollowupsDraftRecoveryState) {
  const input = useRef<HTMLInputElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const previousPhase = useRef(state.phase);
  const restoreInputFocus = useRef(false);
  useLayoutEffect(() => {
    focusCancelledInput(restoreInputFocus, state, input);
    focusCompletedReview(previousPhase.current, state, input, heading);
    previousPhase.current = state.phase;
  }, [state.phase, state.canImport]);
  return {
    input,
    heading,
    requestInputFocus: () => {
      restoreInputFocus.current = true;
    },
  };
}

interface ActionsProps {
  state: FollowupsDraftRecoveryState;
  controller: ManagedFollowupsDraftRecovery | null;
  input: RefObject<HTMLInputElement | null>;
  cancel: () => void;
}

function DraftFileInput({ state, controller, input }: ActionsProps) {
  return (
    <label className="managed-draft-file-input">
      Select a Follow-ups draft file
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        disabled={!state.canImport}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void controller?.readFile(file);
        }}
      />
    </label>
  );
}

function DraftFileAvailability({ state }: Pick<ActionsProps, "state">) {
  if (state.canImport) {
    if (state.canExport) return null;
    return (
      <p>
        Edit follow-ups to save a valid, unsaved draft file. Invalid text or
        dates must be corrected first; capture never changes your text.
      </p>
    );
  }
  if (state.preview) return null;
  return (
    <p>
      Load follow-ups and finish any save or identity review before selecting a
      file.
    </p>
  );
}

function DraftFileCancel({
  state,
  cancel,
}: Pick<ActionsProps, "state" | "cancel">) {
  if (state.phase !== "reading" && state.phase !== "exporting") return null;
  return (
    <button type="button" className="trial-secondary" onClick={cancel}>
      Cancel file operation
    </button>
  );
}

function DraftFileControls(props: ActionsProps) {
  const { state, controller } = props;
  return (
    <>
      <button
        type="button"
        className="trial-secondary"
        disabled={!state.canExport}
        aria-busy={state.phase === "exporting"}
        onClick={() => void controller?.exportDraft()}
      >
        {state.phase === "exporting" ? "Saving draft file…" : "Save draft file"}
      </button>
      <DraftFileInput {...props} />
      <DraftFileAvailability state={state} />
      <DraftFileCancel state={state} cancel={props.cancel} />
    </>
  );
}

interface ReviewProps {
  state: FollowupsDraftRecoveryState;
  heading: RefObject<HTMLHeadingElement | null>;
  restore: () => void;
  cancel: () => void;
}

function DraftFileReview({ state, heading, restore, cancel }: ReviewProps) {
  const preview = state.preview,
    current = state.currentDraft;
  if (!preview) return null;
  if (!current) return null;
  return (
    <section
      className="trial-review"
      aria-labelledby="managed-followups-file-review-heading"
    >
      <h3
        id="managed-followups-file-review-heading"
        ref={heading}
        tabIndex={-1}
      >
        Review the complete file draft
      </h3>
      <p>
        File reports capture time {preview.capturedAt} and base version{" "}
        {preview.baseVersion}. Loaded saved version {state.currentSavedVersion}{" "}
        will remain unchanged.
      </p>
      <p>
        Restoring replaces the complete current draft, including every check,
        due date, result and completion state. Another device can still save a
        newer version; the normal Save conflict checks apply.
      </p>
      <p>
        File metadata does not verify its contents or capture time. After
        restoration, use Review identities to check each listing against the
        current catalog before company research. Saving retains the existing
        server validation rules.
      </p>
      <h4>File draft · {preview.draft.entries.length} checks</h4>
      <FollowupsDraftDetails draft={preview.draft} />
      <details>
        <summary>
          Current draft that will be replaced · {current.entries.length} checks
        </summary>
        <FollowupsDraftDetails draft={current} />
      </details>
      <div className="trial-toolbar">
        <button type="button" onClick={restore}>
          Restore file to current draft
        </button>
        <button type="button" className="trial-secondary" onClick={cancel}>
          Keep current draft
        </button>
      </div>
    </section>
  );
}

export function ManagedFollowupsDraftFiles(props: Props) {
  const { controller, state } = useDraftFiles(props);
  const { input, heading, requestInputFocus } = useDraftFileFocus(state);
  function cancel() {
    requestInputFocus();
    controller?.cancel();
  }
  function restore() {
    if (controller?.restoreDraft()) props.onRestored();
  }
  return (
    <details id="managed-followups-draft-files">
      <summary>Follow-ups draft files</summary>
      <p>
        Keep a copy of valid, unsaved follow-ups before leaving. The JSON file
        contains your checks, results and listing identities in plain text.
        Store it privately. This does not replace a saved-record backup.
      </p>
      <p>
        Selecting a file reads it locally. Restoring it replaces only this
        screen&apos;s draft. Save follow-ups remains separate.
      </p>
      <DraftFileControls
        state={state}
        controller={controller}
        input={input}
        cancel={cancel}
      />
      <DraftFileReview
        state={state}
        heading={heading}
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
