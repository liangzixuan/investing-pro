import { useSyncExternalStore } from "react";
import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { ManagedNativeFixture } from "./fixture";

/** Read-only invented custody and source observations; no test action mutates a draft. */
export function ScreenComparisonFollowupFixtureDiagnostics({
  workspace,
  fixture,
}: {
  workspace: ManagedWorkspace;
  fixture: ManagedNativeFixture;
}) {
  const metadata = fixture.screenComparisonFollowup!;
  const counts = useSyncExternalStore(
    metadata.subscribe,
    metadata.getSnapshot,
    metadata.getSnapshot,
  );
  const refusals = useSyncExternalStore(
    fixture.screenComparisonReport!.subscribe,
    fixture.screenComparisonReport!.getSnapshot,
    fixture.screenComparisonReport!.getSnapshot,
  );
  const watchlist = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
    workspace.coordinator.getSnapshot,
  );
  const followups = useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
    workspace.followups.coordinator.getSnapshot,
  );
  return (
    <aside aria-label="Invented screening comparison follow-up diagnostics">
      <pre id="fixture-screen-comparison-followup" hidden>
        {JSON.stringify({
          ...counts,
          refusals,
          watchlist: {
            phase: watchlist.phase,
            dirty: watchlist.dirty,
            baseVersion: watchlist.baseVersion,
            canonical: watchlist.draft
              ? encodeMainWatchlistPayload(watchlist.draft)
              : null,
          },
          followups: {
            phase: followups.phase,
            dirty: followups.dirty,
            baseVersion: followups.baseVersion,
            canonical: followups.draft
              ? encodeResearchFollowupsPayload(followups.draft)
              : null,
          },
        })}
      </pre>
      <pre id="fixture-screen-comparison-followup-packets" hidden>
        {JSON.stringify(metadata.packets)}
      </pre>
    </aside>
  );
}
