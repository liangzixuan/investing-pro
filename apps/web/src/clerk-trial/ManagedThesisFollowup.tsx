import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ThesisFollowupContext } from "./managed-thesis-followup";
import { isResearchFollowupDueDate } from "./managed-research-followups-date";

/** Explicit creation in the separately loaded Follow-ups draft. */
export function ManagedThesisFollowup({
  id,
  next,
  disabled,
  context,
}: {
  id: string;
  next: string;
  disabled: boolean;
  context: ThesisFollowupContext;
}) {
  const { model, member } = context;
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const saved = useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  const [dueOn, setDueOn] = useState("");
  const [notice, setNotice] = useState<{
    next: string;
    message: string;
  } | null>(null);
  const prepared = model.prepareNextCheck(member, next, dueOn);
  const action = { context, next, dueOn, disabled, capture: prepared.capture };
  const committed = useRef<typeof action | null>(null);
  useLayoutEffect(() => {
    committed.current = action;
    return () => {
      committed.current = null;
    };
  });
  const current = () =>
    committed.current === action && !disabled && context.isCurrent();
  const cancel = () => {
    committed.current = null;
    setDueOn("");
    setNotice(null);
  };
  return (
    <details
      className="managed-thesis-review managed-thesis-followup"
      onToggle={(event) => {
        if (!event.currentTarget.open) cancel();
      }}
    >
      <summary>Make Next check a dated follow-up</summary>
      <p>
        Your assessment for {member.symbol} · {member.shareClassName} ·{" "}
        {member.exchangeMic}. This copies only the authored Next check, without
        reading a note or a financial source.
      </p>
      {!saved.draft && (
        <button
          id={`${id}-followup-load`}
          type="button"
          className="trial-secondary"
          disabled={
            disabled ||
            !model.canLoadForNextCheck(member) ||
            !context.isCurrent()
          }
          onClick={() => {
            if (!current()) return;
            void model.loadForNextCheck(member, () => {
              const live = committed.current;
              return (
                live !== null &&
                !live.disabled &&
                live.context.model === model &&
                live.context.member === member &&
                live.context.isCurrent()
              );
            });
          }}
        >
          {saved.phase === "loading"
            ? "Loading follow-ups…"
            : "Load follow-ups for this check"}
        </button>
      )}
      {!saved.draft && saved.message && <p role="status">{saved.message}</p>}
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
            onChange={(event) => {
              committed.current = null;
              setDueOn(event.currentTarget.value);
              setNotice(null);
            }}
          />
        </div>
      </div>
      <div className="trial-actions">
        <button
          id={`${id}-followup-create`}
          type="button"
          className="trial-secondary"
          disabled={disabled || !prepared.capture || !context.isCurrent()}
          onClick={() => {
            if (!current() || !action.capture) return;
            const created = model.createNextCheck(action.capture, current);
            if (committed.current === action)
              setNotice({
                next,
                message: created
                  ? "Created in the Follow-ups draft. Open Follow-ups to review and Save follow-ups. My Watchlist is unchanged."
                  : "The creation context changed. Review the current check, date and drafts before creating.",
              });
          }}
        >
          Create follow-up draft
        </button>
        <button type="button" className="trial-secondary" onClick={cancel}>
          Cancel follow-up
        </button>
      </div>
      <p id={`${id}-followup-status`} role="status">
        {(notice?.next === next ? notice.message : "") ||
          (disabled
            ? "Thesis actions are paused. Your fields remain visible."
            : prepared.reason) ||
          "Create the complete displayed check and chosen date in Follow-ups."}
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
