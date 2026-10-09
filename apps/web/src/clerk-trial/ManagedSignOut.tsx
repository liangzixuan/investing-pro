import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { SaveCoordinator } from "./save-coordinator";

/** Review an intentional sign-out without changing the coordinator's retirement rules. */
export function ManagedSignOut<P>({
  coordinator,
}: {
  coordinator: SaveCoordinator<P>;
}) {
  const state = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const signOutButton = useRef<HTMLButtonElement>(null);
  const stayButton = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const retired = state.phase === "retired" || state.phase === "signing_out";
  const visible = reviewOpen && !retired;
  const pending =
    state.uncertain ||
    state.phase === "saving" ||
    state.phase === "reconciling";

  useLayoutEffect(() => {
    if (visible) stayButton.current?.focus();
  }, [visible]);

  const requestSignOut = () => {
    const current = coordinator.getSnapshot();
    if (current.phase === "signing_out") return;
    if (
      current.phase !== "retired" &&
      (current.dirty ||
        current.uncertain ||
        current.phase === "saving" ||
        current.phase === "reconciling")
    ) {
      setReviewOpen(true);
      return;
    }
    void coordinator.signOut();
  };
  const confirmSignOut = () => {
    const current = coordinator.getSnapshot();
    if (current.phase === "retired" || current.phase === "signing_out") return;
    setReviewOpen(false);
    void coordinator.signOut();
  };
  const stay = () => {
    setReviewOpen(false);
    if (coordinator.getSnapshot().phase !== "signing_out")
      signOutButton.current?.focus();
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
              : state.dirty
                ? "Sign out with unsaved changes?"
                : "Sign out this session?"}
          </h2>
          <p>
            {pending
              ? `${state.uncertain ? "The save result is uncertain." : "The save is still in progress."} The server may already have saved it. Signing out clears this screen and its pending save details. Sign in again and load the saved version to check the outcome.`
              : state.dirty
                ? "Your changes have not been confirmed as saved. Signing out discards this local draft. It does not change the saved watchlist."
                : "There are no unconfirmed local changes. Signing out clears this screen and leaves the saved watchlist intact."}
          </p>
          <div className="trial-actions">
            <button id="managed-signout-stay" ref={stayButton} onClick={stay}>
              {pending
                ? "Stay and check save"
                : state.dirty
                  ? "Keep editing"
                  : "Stay signed in"}
            </button>
            <button
              id="managed-signout-confirm"
              className="trial-secondary"
              onClick={confirmSignOut}
            >
              {pending
                ? "Sign out and clear this screen"
                : state.dirty
                  ? "Sign out and discard local changes"
                  : "Sign out this session"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
