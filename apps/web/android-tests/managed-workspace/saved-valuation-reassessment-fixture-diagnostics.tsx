import { useRef, useSyncExternalStore } from "react";
import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { SavedValuationReassessmentFixture } from "./saved-valuation-reassessment-fixture";
import {
  reassessmentCheck,
  reassessmentDue,
  reassessmentQuestion,
  reassessmentReason,
  reassessmentUnsaved,
  reassessmentExpectedFollowups,
  reassessmentExpectedValuations,
} from "./saved-valuation-reassessment-fixture-data";
export function SavedValuationReassessmentFixtureDiagnostics({
  workspace,
  fixture,
}: {
  workspace: ManagedWorkspace;
  fixture: SavedValuationReassessmentFixture;
}) {
  const counts = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot);
  const view = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const workbench = useSyncExternalStore(
    workspace.valuation.subscribe,
    workspace.valuation.getSnapshot,
  );
  const reassessment = useSyncExternalStore(
    workspace.valuationReassessment.subscribe,
    workspace.valuationReassessment.getSnapshot,
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
  const price = useSyncExternalStore(
    workspace.eod.subscribe,
    workspace.eod.getSnapshot,
  );
  const annual = useSyncExternalStore(
    workspace.annual.subscribe,
    workspace.annual.getSnapshot,
  );
  const filings = useSyncExternalStore(
    workspace.filings.subscribe,
    workspace.filings.getSnapshot,
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
    <pre id="fixture-saved-valuation-reassessment" hidden>
      {JSON.stringify({
        counts,
        view,
        workbench,
        reassessment,
        watchlist,
        valuations,
        followups,
        price,
        annual,
        filings,
        data: fixture.data,
        calculationPublications: calculations.current.count,
        saved: fixture.saved(),
        annualPacket: fixture.annual,
        question: reassessmentQuestion,
        dueOn: reassessmentDue,
        expectedCheck: reassessmentCheck,
        reason: reassessmentReason,
        unsaved: reassessmentUnsaved,
        expectedValuations: reassessmentExpectedValuations(fixture.data),
        watchlistCanonical: watchlist.draft
          ? encodeMainWatchlistPayload(watchlist.draft)
          : null,
        followupsCanonical: followups.draft
          ? encodeResearchFollowupsPayload(followups.draft)
          : null,
        expectedFollowupsCanonical: created
          ? encodeResearchFollowupsPayload(
              reassessmentExpectedFollowups(fixture.data, created.id),
            )
          : null,
      })}
    </pre>
  );
}
