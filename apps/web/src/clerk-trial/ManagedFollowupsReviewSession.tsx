import { ManagedFollowupsReviewFilings } from "./ManagedFollowupsReviewFilings";
import type { FollowupsReviewFilingsState } from "./managed-followups-review-filings";
import { useSyncExternalStore } from "react";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import {
  FOLLOWUPS_REVIEW_LIMIT,
  type FollowupsReviewState,
} from "./managed-followups-review-session";
import type { ManagedWorkspace } from "./managed-workspace";
import { ListingIdentity, identityLabels } from "./ManagedListingIdentity";
import { FollowupsDraftDetails } from "./ManagedFollowupsDraftDetails";
import { useManagedFollowupsReviewControls } from "./useManagedFollowupsReviewControls";

function ReviewCheck({ entry }: { entry: ResearchFollowup }) {
  return (
    <>
      <p>
        <ListingIdentity member={entry.listing} />
      </p>
      <p>
        Due <time dateTime={entry.dueOn}>{entry.dueOn}</time> UTC.{" "}
        {entry.status === "completed"
          ? `Completed ${entry.completedOn} UTC.`
          : "Open."}
      </p>
      <p className="managed-followups-authored">{entry.check}</p>
      <details>
        <summary>Full listing identity</summary>
        <dl>
          {Object.entries(entry.listing).map(([key, value]) => (
            <div key={key}>
              <dt>{identityLabels[key as keyof typeof identityLabels]}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p>Catalog: {entry.catalogSnapshotSha256}</p>
      </details>
    </>
  );
}

type ReviewControls = ReturnType<typeof useManagedFollowupsReviewControls>;
type SavedFollowups = ReturnType<
  ManagedWorkspace["followups"]["coordinator"]["getSnapshot"]
>;

function finishedReview(saved: SavedFollowups, controls: ReviewControls) {
  return (
    <>
      <p>
        The session has ended. Review the complete current draft below,
        including checks outside this session. Complete or reopen checks in the
        normal editor, then use Save follow-ups separately.
      </p>
      <p>
        Draft based on version {saved.baseVersion ?? "not loaded"}.
        {saved.dirty ? " Unsaved changes." : " No unsaved changes."}
      </p>
      {saved.draft && <FollowupsDraftDetails draft={saved.draft} />}
      <button
        id="managed-followups-review-again"
        className="trial-secondary"
        disabled={!controls.canEnter}
        onClick={(event) => controls.enter(event.currentTarget)}
      >
        Choose another set
      </button>
    </>
  );
}
function chooseReviewChecks(
  state: FollowupsReviewState,
  controls: ReviewControls,
) {
  return (
    <>
      <p>
        Assessed on {state.assessedOn} UTC. Selection order becomes the review
        order.
      </p>
      {!state.rows.length && (
        <p>
          No eligible due checks. Keep using the normal editor to load or change
          your follow-ups.
        </p>
      )}
      <ol className="managed-followups-review-choices">
        {state.rows.map((row) => {
          const position = state.chosen.findIndex(
            (chosen) => chosen.handle === row.handle,
          );
          return (
            <li key={row.entry.id}>
              <ReviewCheck entry={row.entry} />
              <button
                id={`managed-followups-review-choose-${row.entry.id}`}
                className="trial-secondary"
                aria-pressed={position >= 0}
                disabled={!controls.canChoose(row.handle)}
                onClick={() => controls.choose(row.handle)}
              >
                {position >= 0
                  ? `Chosen ${position + 1}: remove this check`
                  : "Choose this check"}
              </button>
            </li>
          );
        })}
      </ol>
      <button
        id="managed-followups-review-start"
        disabled={!controls.canStart}
        onClick={(event) => controls.start(event.currentTarget)}
      >
        Start this review
      </button>
    </>
  );
}
function currentReviewCheck(
  state: FollowupsReviewState,
  controls: ReviewControls,
) {
  if (!state.selected) return null;
  return (
    <>
      <p id="managed-followups-review-position">
        Check {state.position + 1} of {state.chosen.length}. Assessed on{" "}
        {state.assessedOn} UTC.
      </p>
      <ReviewCheck entry={state.selected.entry} />
      <p>Your assessment</p>
      <p className="managed-followups-authored">
        {state.selected.entry.result || "No authored assessment yet."}
      </p>
      <div className="trial-actions">
        <button
          id="managed-followups-review-research"
          disabled={!controls.enabled}
          onClick={(event) => controls.research(event.currentTarget)}
        >
          Open company research
        </button>
        {state.selected.entry.status === "open" ? (
          <button
            id="managed-followups-review-complete"
            className="trial-secondary"
            disabled={!controls.canComplete}
            onClick={(event) => controls.complete(event.currentTarget)}
          >
            Complete this check
          </button>
        ) : (
          <button
            id="managed-followups-review-reopen"
            className="trial-secondary"
            disabled={!controls.canReopen}
            onClick={(event) => controls.reopen(event.currentTarget)}
          >
            Reopen this check
          </button>
        )}
        <button
          id="managed-followups-review-next"
          className="trial-secondary"
          disabled={!controls.canContinue}
          onClick={(event) => controls.next(event.currentTarget)}
        >
          Continue to next check
        </button>
      </div>
      <details>
        <summary>Chosen review order</summary>
        <ol>
          {state.chosen.map((row) => (
            <li key={row.entry.id}>
              <ReviewCheck entry={row.entry} />
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}
function reviewContent(
  state: FollowupsReviewState,
  saved: SavedFollowups,
  controls: ReviewControls,
) {
  if (!state.entered)
    return (
      <button
        id="managed-followups-review-enter"
        className="trial-secondary"
        disabled={!controls.canEnter}
        onClick={(event) => controls.enter(event.currentTarget)}
      >
        Choose checks for review
      </button>
    );
  if (state.phase === "finished") return finishedReview(saved, controls);
  if (state.phase === "choosing") return chooseReviewChecks(state, controls);
  return currentReviewCheck(state, controls);
}

export function ManagedFollowupsReviewSession(props: {
  onReviewFilingsResearch?:
    | ((state: FollowupsReviewFilingsState, opener: HTMLButtonElement) => void)
    | undefined;
  workspace: ManagedWorkspace;
  active: boolean;
  routeActive: () => boolean;
  onResearch: (entry: ResearchFollowup, opener: HTMLButtonElement) => void;
}) {
  const { workspace } = props;
  const model = workspace.followupsReview;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const saved = useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
    workspace.followups.coordinator.getSnapshot,
  );
  const controls = useManagedFollowupsReviewControls({ ...props, state });
  const id = "managed-followups-review-heading";
  return (
    <details className="managed-followups-review">
      <summary>Review a few due checks</summary>
      <section aria-labelledby={id}>
        <h3 id={id} ref={controls.heading} tabIndex={-1}>
          Follow-ups review session
        </h3>
        <p>
          Choose up to {FOLLOWUPS_REVIEW_LIMIT} overdue or due-today checks.
          Review one company at a time and return here to continue.
        </p>
        {reviewContent(state, saved, controls)}
        {state.phase === "reviewing" && state.selected && (
          <ManagedFollowupsReviewFilings
            workspace={workspace}
            active={props.active}
            routeActive={props.routeActive}
            onInspect={props.onReviewFilingsResearch}
          />
        )}
        {state.entered && state.phase === "reviewing" && (
          <button
            id="managed-followups-review-finish"
            className="trial-secondary"
            disabled={!controls.enabled}
            onClick={(event) => controls.finish(event.currentTarget)}
          >
            Finish and review full draft
          </button>
        )}
        {state.reason && <p role="status">{state.reason}</p>}
        <p>
          Start, Continue and Finish do not request sources, mark checks
          complete or save. Company research keeps its separate source actions.
          Leaving Follow-ups ends the temporary session; your authored draft
          stays.
        </p>
      </section>
    </details>
  );
}
