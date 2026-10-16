import { useSyncExternalStore, type Ref } from "react";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import { ListingIdentity } from "./ManagedListingIdentity";
import { groupResearchFollowupsByDueDate } from "./managed-research-followups-date";
import type { ManagedWorkspace } from "./managed-workspace";
import "./managed-daily-research-review.css";

interface Props {
  readonly workspace: ManagedWorkspace;
  readonly navigationPending: boolean;
  readonly headingRef?: Ref<HTMLHeadingElement>;
  readonly isCurrent: () => boolean;
  readonly onReview: (entry: ResearchFollowup) => void;
  readonly onManage: () => void;
}

export function ManagedDailyResearchReview({
  workspace,
  navigationPending,
  headingRef,
  isCurrent,
  onReview,
  onManage,
}: Props) {
  const model = workspace.followups;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const saved = useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  const session = useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
    workspace.sessionOwner.getSnapshot,
  );
  const active = session.phase === "active";
  const current = () =>
    active &&
    workspace.sessionOwner.getSnapshot().phase === "active" &&
    isCurrent();
  const entries = saved.draft?.entries ?? [];
  const groups = groupResearchFollowupsByDueDate(
    entries,
    new Date(state.assessmentTime ?? NaN),
  );
  const canLoad = active && saved.phase === "idle" && !saved.uncertain;
  const dueCount = groups ? groups.overdue.length + groups.today.length : 0;
  const review = (entry: ResearchFollowup) => {
    if (
      !navigationPending &&
      current() &&
      model.coordinator.getSnapshot().draft === saved.draft &&
      model.currentEntry(entry.id) === entry
    )
      onReview(entry);
  };
  return (
    <section
      className="managed-daily-research-review"
      aria-labelledby="managed-daily-research-heading"
    >
      <header>
        <div>
          <h2
            id="managed-daily-research-heading"
            ref={headingRef}
            tabIndex={-1}
          >
            Research checks due
          </h2>
          <p>Your authored checks from the current Follow-ups draft.</p>
        </div>
        <div className="trial-actions">
          <button
            id="managed-daily-followups-load"
            disabled={!canLoad}
            onClick={() => {
              if (
                current() &&
                model.coordinator.getSnapshot() === saved &&
                canLoad
              )
                void model.coordinator.load();
            }}
          >
            {saved.phase === "loading"
              ? "Loading follow-ups…"
              : saved.saved
                ? "Load latest follow-ups"
                : "Load follow-ups"}
          </button>
          <button
            id="managed-daily-followups-manage"
            className="trial-secondary"
            disabled={!active || navigationPending}
            onClick={() => {
              if (!navigationPending && current()) onManage();
            }}
          >
            Manage follow-ups
          </button>
        </div>
      </header>
      <p className="managed-daily-research-status" role="status">
        {!active
          ? "This session has ended. Follow-ups are cleared."
          : saved.baseVersion === null
            ? "Follow-ups not loaded."
            : ""}
        {active &&
        saved.baseVersion !== null &&
        saved.saved &&
        saved.baseVersion !== saved.saved.version
          ? `Current draft based on version ${saved.baseVersion}. Loaded saved version ${saved.saved.version}.`
          : ""}
        {saved.dirty ? " Unsaved follow-up changes." : ""}
        {active ? ` ${saved.message}` : ""}
      </p>
      {saved.uncertain ? (
        <p className="managed-daily-research-warning">
          The original follow-up save is uncertain. Open Manage follow-ups to
          reconcile that exact command. This draft remains visible.
        </p>
      ) : saved.conflict ? (
        <p className="managed-daily-research-warning">
          {saved.replayPending
            ? "The original save is confirmed; the latest version still needs review."
            : "The latest saved version and this draft need review."}{" "}
          Open Manage follow-ups to choose which version to keep. This queue
          continues to show your draft.
        </p>
      ) : null}
      {active && saved.draft && (
        <>
          <div className="managed-daily-research-day">
            <p>
              {groups ? (
                <>
                  Assessed for{" "}
                  <time dateTime={groups.assessedOn}>{groups.assessedOn}</time>{" "}
                  UTC. Planning dates do not establish source freshness.
                </>
              ) : (
                "A valid UTC assessment date is required. Due status is unavailable."
              )}
            </p>
            <button
              id="managed-daily-followups-reassess"
              className="trial-secondary"
              onClick={() => {
                if (current()) model.reassessDueDate(new Date());
              }}
            >
              Reassess due date
            </button>
          </div>
          {groups && (
            <>
              <p>
                {dueCount} due · {groups.later.length} later ·{" "}
                {groups.completed.length} completed ·{" "}
                {groups.invalidDates.length} need a valid due date
              </p>
              {entries.length === 0 ? (
                <p>
                  No follow-ups in this draft. Open Manage follow-ups to add a
                  check from My Watchlist.
                </p>
              ) : dueCount === 0 ? (
                <p>
                  No open checks with valid dates are due for this assessed day.
                </p>
              ) : null}
              {[
                { label: "Overdue", entries: groups.overdue },
                { label: "Due today", entries: groups.today },
                {
                  label: "Needs a valid due date",
                  entries: groups.invalidDates,
                },
              ].map(
                (group) =>
                  group.entries.length > 0 && (
                    <section key={group.label} aria-label={group.label}>
                      <h3>{group.label}</h3>
                      <ul>
                        {group.entries.map((entry) => (
                          <li key={entry.id}>
                            <div>
                              <p className="managed-daily-research-identity">
                                <ListingIdentity member={entry.listing} />
                              </p>
                              <p className="managed-daily-research-check">
                                {entry.check || "Check text required"}
                              </p>
                              <p>
                                Due {entry.dueOn || "date required"}
                                {entry.status === "completed"
                                  ? " · Completed check"
                                  : ""}
                              </p>
                              {entry.catalogSnapshotSha256 !==
                                state.catalogSnapshotSha256 && (
                                <p className="managed-daily-research-status">
                                  Older or unavailable catalog identity. Review
                                  stays available; company research requires a
                                  current exact listing.
                                </p>
                              )}
                            </div>
                            <button
                              className="trial-secondary"
                              id={`managed-daily-review-${entry.id}`}
                              disabled={navigationPending}
                              onClick={() => review(entry)}
                            >
                              {group.label === "Needs a valid due date"
                                ? "Correct due date"
                                : "Review check"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ),
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
