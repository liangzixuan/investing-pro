import { useSyncExternalStore } from "react";
import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
  parseResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { ManagedNativeFixture } from "./fixture";
import type { createNativeFollowupsReviewReportFixture } from "./native-followups-review-report-fixture";

/** Complete invented read-only observations, never a production entry point. */
export function ReviewCompletionFixtureDiagnostics({
  workspace,
  fixture,
  report,
}: {
  workspace: ManagedWorkspace;
  fixture: ManagedNativeFixture;
  report: ReturnType<typeof createNativeFollowupsReviewReportFixture>;
}) {
  const metadata = fixture.reviewCompletion!;
  const counters = useSyncExternalStore(
    metadata.subscribe,
    metadata.getSnapshot,
    metadata.getSnapshot,
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
  const file = useSyncExternalStore(
    report.subscribe,
    report.getSnapshot,
    report.getSnapshot,
  );
  return (
    <aside aria-label="Invented review completion observations">
      <pre id="fixture-review-check-completion" hidden>
        {JSON.stringify({
          ...counters,
          watchlist: {
            dirty: watchlist.dirty,
            canonical: watchlist.draft
              ? encodeMainWatchlistPayload(watchlist.draft)
              : null,
          },
          followups: {
            raw: followups.draft,
            canonical:
              followups.draft && parseResearchFollowupsPayload(followups.draft)
                ? encodeResearchFollowupsPayload(followups.draft)
                : null,
          },
        })}
      </pre>
      <pre id="fixture-followups-report" hidden>
        {JSON.stringify(file)}
      </pre>
    </aside>
  );
}
