import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { TrialSession } from "../../src/clerk-trial/session";
import { fixture } from "./native-fixture-environment";

/** Fresh independent read without loading or saving My Watchlist or Portfolio. */
export function HoldingFollowupFixtureControls({
  workspace,
  onFreshSession,
}: {
  workspace: ManagedWorkspace;
  onFreshSession: (session: TrialSession) => void;
}) {
  const state = useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
  );
  return (
    <aside aria-label="Invented holding follow-up session">
      <button
        id="fixture-holding-followup-fresh-session"
        disabled={
          state.phase !== "idle" || state.baseVersion !== 2 || state.dirty
        }
        onClick={() => {
          workspace.sessionOwner.dispose();
          history.replaceState(null, "", "/");
          onFreshSession(fixture.portfolio!.nextSession());
        }}
      >
        Start fresh invented holding session
      </button>
    </aside>
  );
}
