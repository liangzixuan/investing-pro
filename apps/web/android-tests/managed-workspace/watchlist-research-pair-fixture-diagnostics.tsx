import { useRef, useSyncExternalStore } from "react";
import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { WatchlistResearchPairFixture } from "./watchlist-research-pair-fixture";
import {
  decisionQuestion,
  decisionDue,
  decisionThesis,
  decisionUnsaved,
  decisionExpectedWatchlist,
  decisionExpectedValuations,
  decisionExpectedFollowups,
} from "./two-company-research-review-fixture-data";
/** Observations only. Native controls perform every product action. */
export function WatchlistResearchPairFixtureDiagnostics({
  workspace,
  fixture,
}: {
  workspace: ManagedWorkspace;
  fixture: WatchlistResearchPairFixture;
}) {
  const counts = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot);
  const view = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const workbench = useSyncExternalStore(
    workspace.valuation.subscribe,
    workspace.valuation.getSnapshot,
  );
  const review = useSyncExternalStore(
    workspace.watchlistResearchPair.subscribe,
    workspace.watchlistResearchPair.getSnapshot,
  );
  const watchlist = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  const valuations = useSyncExternalStore(
    workspace.valuationAssumptions.coordinator.subscribe,
    workspace.valuationAssumptions.coordinator.getSnapshot,
  );
  const followups = useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
  );
  const annual = useSyncExternalStore(
    workspace.annual.subscribe,
    workspace.annual.getSnapshot,
  );
  const calculations = useRef({
    owner: workspace,
    seen: new WeakSet<object>(),
    count: 0,
  });
  if (calculations.current.owner !== workspace)
    calculations.current = {
      owner: workspace,
      seen: new WeakSet<object>(),
      count: 0,
    };
  if (
    workbench.calculation &&
    !calculations.current.seen.has(workbench.calculation)
  ) {
    calculations.current.seen.add(workbench.calculation);
    calculations.current.count++;
  }
  const created = followups.draft?.entries.find(
    (e) => !fixture.data.followups.entries.some((old) => old.id === e.id),
  );
  return (
    <pre id="fixture-watchlist-research-pair" hidden>
      {JSON.stringify({
        counts,
        view,
        workbench,
        review,
        watchlist,
        valuations,
        followups,
        annual,
        data: fixture.data,
        packets: fixture.packets,
        saved: fixture.saved(),
        calculationPublications: calculations.current.count,
        question: decisionQuestion,
        dueOn: decisionDue,
        thesis: decisionThesis,
        unsaved: decisionUnsaved,
        expectedValuations: decisionExpectedValuations(fixture.data, 2),
        watchlistCanonical: watchlist.draft
          ? encodeMainWatchlistPayload(watchlist.draft)
          : null,
        expectedWatchlistCanonical: encodeMainWatchlistPayload(
          decisionExpectedWatchlist(fixture.data),
        ),
        followupsCanonical: followups.draft
          ? encodeResearchFollowupsPayload(followups.draft)
          : null,
        expectedFollowupsCanonical: created
          ? encodeResearchFollowupsPayload(
              decisionExpectedFollowups(fixture.data, created.id),
            )
          : null,
      })}
    </pre>
  );
}
