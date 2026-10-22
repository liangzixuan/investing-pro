import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { ThesisFollowupContext } from "./managed-thesis-followup";
import type { NextCheckCapture } from "./managed-research-followups";
import { isResearchFollowupDueDate } from "./managed-research-followups-date";

interface Props {
  id: string;
  next: string;
  disabled: boolean;
  context: ThesisFollowupContext;
}
interface Action extends Omit<Props, "id"> {
  dueOn: string;
  capture: NextCheckCapture | null;
}
interface Notice {
  next: string;
  message: string;
}
type CommittedAction = RefObject<Action | null>;

function actionIsCurrent(action: Action, committed: CommittedAction) {
  return (
    committed.current === action &&
    !action.disabled &&
    action.context.isCurrent()
  );
}
function loadHostIsCurrent(action: Action, committed: CommittedAction) {
  const live = committed.current;
  return (
    live !== null &&
    !live.disabled &&
    live.context.model === action.context.model &&
    live.context.member === action.context.member &&
    live.context.isCurrent()
  );
}
function sourceCommands(
  action: Action,
  committed: CommittedAction,
  onNotice: (notice: Notice) => void,
) {
  const { model, member } = action.context;
  return {
    load: () => {
      if (!actionIsCurrent(action, committed)) return;
      void model.loadForNextCheck(member, () =>
        loadHostIsCurrent(action, committed),
      );
    },
    create: () => {
      if (!actionIsCurrent(action, committed) || !action.capture) return;
      const created = model.createNextCheck(action.capture, () =>
        actionIsCurrent(action, committed),
      );
      if (committed.current === action)
        onNotice({
          next: action.next,
          message: created
            ? "Created in the Follow-ups draft. Open Follow-ups to review and Save follow-ups. My Watchlist is unchanged."
            : "The creation context changed. Review the current check, date and drafts before creating.",
        });
    },
  };
}
function statusMessage(
  props: Props,
  notice: Notice | null,
  reason: string | null,
) {
  if (notice?.next === props.next && notice.message) return notice.message;
  if (props.disabled)
    return "Thesis actions are paused. Your fields remain visible.";
  return (
    reason ||
    "Create the complete displayed check and chosen date in Follow-ups."
  );
}
function useThesisFollowup(props: Props) {
  const { context, next, disabled } = props;
  const { model, member } = context;
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const saved = useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  const [dueOn, setDueOn] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const prepared = model.prepareNextCheck(member, next, dueOn);
  const action: Action = {
    context,
    next,
    dueOn,
    disabled,
    capture: prepared.capture,
  };
  const committed = useRef<Action | null>(null);
  useLayoutEffect(() => {
    committed.current = action;
    return () => {
      committed.current = null;
    };
  });
  const cancel = () => {
    committed.current = null;
    setDueOn("");
    setNotice(null);
  };
  return {
    saved,
    prepared,
    dueOn,
    status: statusMessage(props, notice, prepared.reason),
    cancel,
    editDate: (raw: string) => {
      committed.current = null;
      setDueOn(raw);
      setNotice(null);
    },
    ...sourceCommands(action, committed, setNotice),
  };
}
type Controls = ReturnType<typeof useThesisFollowup>;

function initialLoad(props: Props, controls: Controls) {
  const { saved } = controls;
  if (saved.draft) return null;
  const { model, member } = props.context;
  return (
    <>
      <button
        id={`${props.id}-followup-load`}
        type="button"
        className="trial-secondary"
        disabled={
          props.disabled ||
          !model.canLoadForNextCheck(member) ||
          !props.context.isCurrent()
        }
        onClick={controls.load}
      >
        {saved.phase === "loading"
          ? "Loading follow-ups…"
          : "Load follow-ups for this check"}
      </button>
      {saved.message && <p role="status">{saved.message}</p>}
    </>
  );
}
function followupForm(props: Props, controls: Controls) {
  const { id, next, disabled, context } = props;
  const { member } = context;
  const { dueOn, prepared } = controls;
  return (
    <details
      className="managed-thesis-review managed-thesis-followup"
      onToggle={(event) => {
        if (!event.currentTarget.open) controls.cancel();
      }}
    >
      <summary>Make Next check a dated follow-up</summary>
      <p>
        Your assessment for {member.symbol} · {member.shareClassName} ·{" "}
        {member.exchangeMic}. This copies only the authored Next check, without
        reading a note or a financial source.
      </p>
      {initialLoad(props, controls)}
      <p className="trial-saved-note" id={`${id}-followup-check`}>
        {prepared.capture?.check ?? next}
      </p>
      <div className="managed-thesis-review-fields">
        <div>
          <label htmlFor={`${id}-followup-date`}>
            Follow-up due date (required, UTC, YYYY-MM-DD)
          </label>
          <input
            id={`${id}-followup-date`}
            type="text"
            placeholder="YYYY-MM-DD"
            value={dueOn}
            disabled={disabled}
            aria-invalid={dueOn !== "" && !isResearchFollowupDueDate(dueOn)}
            aria-describedby={`${id}-followup-status ${id}-followup-help`}
            onChange={(event) => controls.editDate(event.currentTarget.value)}
          />
        </div>
      </div>
      <div className="trial-actions">
        <button
          id={`${id}-followup-create`}
          type="button"
          className="trial-secondary"
          disabled={disabled || !prepared.capture || !context.isCurrent()}
          onClick={controls.create}
        >
          Create follow-up draft
        </button>
        <button
          type="button"
          className="trial-secondary"
          onClick={controls.cancel}
        >
          Cancel follow-up
        </button>
      </div>
      <p id={`${id}-followup-status`} role="status">
        {controls.status}
      </p>
      <p id={`${id}-followup-help`}>
        Next check: 1–500 characters on one line. No text is clipped. Load
        Follow-ups explicitly here before creation. Leaving the thesis editor
        resets its unadded fields. Saving your watchlist note and saving
        Follow-ups are separate actions. Closing this disclosure clears the
        chosen date.
      </p>
    </details>
  );
}

/** Explicit creation in the separately loaded Follow-ups draft. */
export function ManagedThesisFollowup(props: Props) {
  const controls = useThesisFollowup(props);
  return followupForm(props, controls);
}
