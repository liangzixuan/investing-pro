import { useSyncExternalStore } from "react";
import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { ManagedNativeFixture } from "./fixture";
import type { createNativeFollowupsReviewReportFixture } from "./native-followups-review-report-fixture";

/** Complete invented draft observations; this component has no mutation controls. */
export function FilingAssessmentFixtureDiagnostics({
  workspace,
  fixture,
  report,
}: {
  workspace: ManagedWorkspace;
  fixture: ManagedNativeFixture;
  report: ReturnType<typeof createNativeFollowupsReviewReportFixture>;
}) {
  const metadata = fixture.filingAssessment!;
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
  const filings = useSyncExternalStore(
    workspace.filings.subscribe,
    workspace.filings.getSnapshot,
    workspace.filings.getSnapshot,
  );
  const file = useSyncExternalStore(
    report.subscribe,
    report.getSnapshot,
    report.getSnapshot,
  );
  return (
    <aside aria-label="Invented filing assessment observations">
      <pre id="fixture-filing-check-assessment" hidden>
        {JSON.stringify({
          ...counters,
          watchlist: {
            phase: watchlist.phase,
            baseVersion: watchlist.baseVersion,
            dirty: watchlist.dirty,
            canonical: watchlist.draft
              ? encodeMainWatchlistPayload(watchlist.draft)
              : null,
          },
          followups: {
            phase: followups.phase,
            baseVersion: followups.baseVersion,
            dirty: followups.dirty,
            canonical: followups.draft
              ? encodeResearchFollowupsPayload(followups.draft)
              : null,
          },
          filings: {
            response: filings.response,
            showingPrevious: filings.showingPrevious,
            running: filings.running,
            responseOrigin: filings.responseOrigin,
          },
        })}
      </pre>
      <pre id="fixture-followups-report" hidden>
        {JSON.stringify(file)}
      </pre>
    </aside>
  );
}
