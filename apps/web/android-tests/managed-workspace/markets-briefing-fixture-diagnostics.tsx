import { useSyncExternalStore } from "react";
import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { SharedNativeFixture } from "./fixture";
import { briefingExpected } from "./markets-briefing-fixture";

/** Complete invented evidence only; this component never invokes product actions. */
export function MarketsBriefingFixtureDiagnostics({
  workspace,
  fixture,
}: {
  workspace: ManagedWorkspace;
  fixture: SharedNativeFixture;
}) {
  useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const draft = useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
  );
  const pass = useSyncExternalStore(
    workspace.marketsSourceReview.subscribe,
    workspace.marketsSourceReview.getSnapshot,
  );
  const board = useSyncExternalStore(
    workspace.markets.subscribe,
    workspace.markets.getSnapshot,
  );
  const bls = useSyncExternalStore(
    workspace.blsCalendar.subscribe,
    workspace.blsCalendar.getSnapshot,
  );
  const cpi = useSyncExternalStore(
    workspace.cpiHeadlines.subscribe,
    workspace.cpiHeadlines.getSnapshot,
  );
  const entries = draft.draft?.entries;
  const reading = workspace.getMarketsBriefingReading();
  return (
    <pre id="fixture-markets-briefing-evidence" hidden>
      {JSON.stringify({
        encodedFollowups: draft.draft
          ? encodeResearchFollowupsPayload(draft.draft)
          : null,
        expectedEncodedFollowups:
          entries?.[3] && entries[2]
            ? encodeResearchFollowupsPayload(
                briefingExpected(fixture, entries[3].id, entries[2].id),
              )
            : null,
        pass,
        board,
        bls,
        cpi,
        reading,
        retainedCpiReference: reading
          ? reading.cpi.headlines === cpi.headlines
          : null,
        retainedBlsReference: reading
          ? reading.bls.calendar === bls.calendar
          : null,
      })}
    </pre>
  );
}
