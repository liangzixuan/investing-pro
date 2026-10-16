import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  ManagedResourceSaveSummary,
  ManagedSessionOwner,
} from "./managed-session-owner";

function resourceStatus(resource: ManagedResourceSaveSummary): string {
  const details: string[] = [];
  if (resource.dirty) details.push("Unsaved local changes.");
  if (resource.phase === "loading") details.push("Loading the saved version.");
  if (resource.phase === "saving") details.push("Save in progress.");
  if (resource.phase === "reconciling")
    details.push("Reconciling the original save.");
  if (resource.uncertain) details.push("Save result uncertain.");
  if (resource.conflict) details.push("Saved version needs review.");
  if (resource.replayPending)
    details.push("Original save replayed. Load and review the latest version.");
  return details.join(" ") || "No unconfirmed local changes.";
}

/** Review all three save resources before the session owner performs one sign-out. */
export function ManagedSignOut({ owner }: { owner: ManagedSessionOwner }) {
  const state = useSyncExternalStore(
    owner.subscribe,
    owner.getSnapshot,
    owner.getSnapshot,
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const signOutButton = useRef<HTMLButtonElement>(null);
  const stayButton = useRef<HTMLButtonElement>(null);
  const review = useRef({ revision: 0, open: false });
  const renderedReviewRevision = review.current.revision;
  const headingId = useId();
  const retired = state.phase === "retired" || state.phase === "signing_out";
  const visible = reviewOpen && !retired;
  const resources = [state.watchlist, state.followups, state.portfolio];
  const uncertain = resources.some((resource) => resource.uncertain);
  const pending = resources.some(
    (resource) =>
      resource.uncertain ||
      resource.phase === "saving" ||
      resource.phase === "reconciling",
  );
  const dirty = resources.some((resource) => resource.dirty);

  useLayoutEffect(() => {
    if (visible) stayButton.current?.focus();
  }, [visible]);

  const requestSignOut = () => {
    const current = owner.getSnapshot();
    if (current.phase === "signing_out") return;
    if (current.phase === "active" && current.needsLeaveReview) {
      if (review.current.open) return;
      review.current = { revision: review.current.revision + 1, open: true };
      setReviewOpen(true);
      return;
    }
    review.current = { revision: review.current.revision + 1, open: false };
    setReviewOpen(false);
    void owner.signOut();
  };
  const confirmSignOut = () => {
    const current = owner.getSnapshot();
    if (
      current.phase !== "active" ||
      !reviewOpen ||
      !review.current.open ||
      renderedReviewRevision !== review.current.revision
    )
      return;
    review.current = { revision: review.current.revision + 1, open: false };
    setReviewOpen(false);
    void owner.signOut();
  };
  const stay = () => {
    review.current = { revision: review.current.revision + 1, open: false };
    setReviewOpen(false);
    if (owner.getSnapshot().phase === "active") signOutButton.current?.focus();
  };

  return (
    <>
      <div className="trial-session-bar">
        <p>Shared across your signed-in devices</p>
        <button
          id="managed-signout-open"
          ref={signOutButton}
          className="trial-secondary"
          disabled={state.phase === "signing_out"}
          aria-expanded={visible}
          onClick={requestSignOut}
        >
          {state.signOutFailed
            ? "Try signing out again"
            : "Sign out this session"}
        </button>
      </div>
      {visible && (
        <section
          id="managed-signout-review"
          className="trial-status"
          aria-labelledby={headingId}
        >
          <h2 id={headingId}>
            {pending
              ? "Check this save before signing out"
              : dirty
                ? "Sign out with unsaved changes?"
                : state.needsLeaveReview
                  ? "Review saved versions before signing out"
                  : "Sign out this session?"}
          </h2>
          <p>
            {pending
              ? `${uncertain ? "The save result is uncertain." : "The save is still in progress."} The server may already have saved it. Signing out clears all three local drafts and their pending save details. Sign in again and load the saved version of each resource to check the outcome.`
              : dirty
                ? "Your changes have not been confirmed as saved. Signing out discards all three local drafts. It does not change the saved watchlist, follow-ups or portfolio."
                : state.needsLeaveReview
                  ? "A saved version still needs review. Signing out clears all three local drafts and their recovery details. Sign in again and load each saved version to check it."
                  : "There are no unconfirmed local changes. Signing out clears this screen and leaves the saved watchlist, follow-ups and portfolio intact."}
          </p>
          <dl aria-label="Local save states">
            <div>
              <dt>Watchlist</dt>
              <dd>{resourceStatus(state.watchlist)}</dd>
            </div>
            <div>
              <dt>Follow-ups</dt>
              <dd>{resourceStatus(state.followups)}</dd>
            </div>
            <div>
              <dt>Portfolio</dt>
              <dd>{resourceStatus(state.portfolio)}</dd>
            </div>
          </dl>
          <p>Other signed-in devices keep their own sessions.</p>
          <div className="trial-actions">
            <button id="managed-signout-stay" ref={stayButton} onClick={stay}>
              {pending
                ? "Stay and check save"
                : dirty
                  ? "Keep editing"
                  : state.needsLeaveReview
                    ? "Stay and review saved versions"
                    : "Stay signed in"}
            </button>
            <button
              id="managed-signout-confirm"
              className="trial-secondary"
              onClick={confirmSignOut}
            >
              {pending
                ? "Sign out and clear this screen"
                : dirty
                  ? "Sign out and discard local changes"
                  : "Sign out this session"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
