import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import { useSyncExternalStore } from "react";
import type { ManagedResearchFollowups } from "../../src/clerk-trial/managed-research-followups";

/** Complete canonical invented payload; object property insertion order is not persisted data. */
export function ValuationScenarioFollowupFixtureDiagnostics({
  model,
}: {
  model: ManagedResearchFollowups;
}) {
  const saved = useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  return (
    <pre id="fixture-valuation-followup-canonical" hidden>
      {saved.draft ? encodeResearchFollowupsPayload(saved.draft) : "null"}
    </pre>
  );
}
