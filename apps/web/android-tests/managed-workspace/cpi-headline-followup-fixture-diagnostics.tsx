import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { SharedNativeFixture } from "./fixture";
import {
  cpiFollowupExpected,
  cpiFollowupOriginal,
} from "./cpi-headline-followup-fixture";

/** Invented complete resources use their contracts encoders, never object key order. */
export function CpiHeadlineFollowupFixtureDiagnostics({
  workspace,
  fixture,
}: {
  workspace: ManagedWorkspace;
  fixture: SharedNativeFixture;
}) {
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
  const source = useSyncExternalStore(
    workspace.cpiHeadlines.subscribe,
    workspace.cpiHeadlines.getSnapshot,
    workspace.cpiHeadlines.getSnapshot,
  );
  return (
    <pre id="fixture-cpi-followup-evidence" hidden>
      {JSON.stringify({
        encodedWatchlist: watchlist.draft
          ? encodeMainWatchlistPayload(watchlist.draft)
          : null,
        encodedFollowups: followups.draft
          ? encodeResearchFollowupsPayload(followups.draft)
          : null,
        originalEncodedFollowups: encodeResearchFollowupsPayload(
          cpiFollowupOriginal(fixture),
        ),
        expectedEncodedFollowups: followups.draft?.entries[2]
          ? encodeResearchFollowupsPayload(
              cpiFollowupExpected(fixture, followups.draft.entries[2].id),
            )
          : null,
        packet: source.headlines,
      })}
    </pre>
  );
}
