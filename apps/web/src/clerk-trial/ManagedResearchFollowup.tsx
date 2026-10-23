import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { ManagedFollowupAssessment } from "./ManagedFollowupAssessment";
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
  const context = workspace.researchFollowupContext(selection);
  if (!context) return null;
  const current = () =>
    !navigationPending && routeActive() && context.isCurrent();
  const editable = context.editable && current();
  const entry = context.entry;
  return (
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
        Complete this check and save the full draft in Follow-ups. Source reads
        and My Watchlist Save stay separate.
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
  );
}
