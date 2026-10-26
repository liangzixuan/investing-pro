import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchFollowupContext } from "./managed-research-followup-context";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { ManagedFollowupAssessment } from "./ManagedFollowupAssessment";
import { ManagedFollowupReviewNote } from "./ManagedFollowupReviewNote";
import type { FollowupReviewNoteContext } from "./managed-followup-review-note-context";
import "./managed-research-followup.css";

export function ManagedResearchFollowup({
  workspace,
  selection,
  navigationPending,
  routeActive,
  onReview,
}: {
  workspace: ManagedWorkspace;
  selection: ManagedResearchSelection;
  navigationPending: boolean;
  routeActive: () => boolean;
  onReview: () => void;
}) {
  useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const model = workspace.followups;
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
    workspace.sessionOwner.getSnapshot,
  );
  useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
    workspace.coordinator.getSnapshot,
  );
  const context = workspace.researchFollowupContext(selection);
  if (!context) return null;
  return renderResearchFollowup(
    context,
    () => !navigationPending && routeActive() && context.isCurrent(),
    onReview,
    workspace.captureFollowupReviewNote(selection, routeActive),
  );
}

/** Render the current check separately from its live resource subscriptions. */
function renderResearchFollowup(
  context: ManagedResearchFollowupContext,
  current: () => boolean,
  onReview: () => void,
  noteContext: FollowupReviewNoteContext | null,
) {
  const editable = context.editable && current();
  const entry = context.entry;
  return (
    <>
      <section
        className="managed-research-followup"
        aria-labelledby="managed-research-followup-heading"
      >
        <h3 id="managed-research-followup-heading">
          Research check for {entry.listing.symbol}
        </h3>
        <p className="managed-research-followup-check">{entry.check}</p>
        <p>Due date (UTC): {entry.dueOn}</p>
        <p>
          {entry.status === "completed"
            ? `Completed for ${entry.completedOn}.`
            : "Open check."}
        </p>
        <details id="managed-research-followup-assessment">
          <summary>Record assessment</summary>
          <ManagedFollowupAssessment
            id="managed-research-followup-result"
            value={entry.result}
            readOnly={!editable}
            onChange={(raw) => {
              if (current()) context.editAssessment(raw);
            }}
          />
        </details>
        {context.reason && <p role="status">{context.reason}</p>}
        <p className="managed-research-followup-help">
          {context.dirty ? "Follow-ups has unsaved changes. " : ""}
          Complete this check and save the full draft in Follow-ups. Source
          reads and My Watchlist Save stay separate. Write an assessment to
          preview it in the company note.
        </p>
        <button
          id="managed-research-followup-review"
          className="trial-secondary"
          disabled={!current()}
          onClick={() => {
            if (current()) onReview();
          }}
        >
          Review follow-ups
        </button>
      </section>
      {noteContext && entry.result.trim().length > 0 && (
        <section
          className="managed-research-followup-note"
          aria-label="Company note assessment"
        >
          <ManagedFollowupReviewNote context={noteContext} />
        </section>
      )}
    </>
  );
}
