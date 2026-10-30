import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { TrialSession } from "../../src/clerk-trial/session";
import { savedValuationInputs } from "./fixture";
import { fixture } from "./native-fixture-environment";

export function ValuationCollectionRecoveryFixtureControls({
  workspace,
  onFreshSession,
}: {
  workspace: ManagedWorkspace;
  onFreshSession: (session: TrialSession) => void;
}) {
  const controls = fixture.collectionRecovery!;
  const counts = useSyncExternalStore(controls.subscribe, controls.getSnapshot);
  const resource = useSyncExternalStore(
    workspace.valuationAssumptions.coordinator.subscribe,
    workspace.valuationAssumptions.coordinator.getSnapshot,
  );
  const local = useSyncExternalStore(
    workspace.valuationAssumptions.subscribe,
    workspace.valuationAssumptions.getSnapshot,
  );
  const editor = useSyncExternalStore(
    workspace.valuation.subscribe,
    workspace.valuation.getSnapshot,
  );
  const watchlist = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  const followups = useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
  );
  const portfolio = useSyncExternalStore(
    workspace.portfolio.coordinator.subscribe,
    workspace.portfolio.coordinator.getSnapshot,
  );
  const contextReady =
    editor.context?.listing.listingId ===
    controls.captured.entries[0]!.listing.listingId;
  return (
    <aside aria-label="Invented valuation collection recovery controls">
      <button
        id="fixture-collection-stage"
        disabled={
          counts.session !== 0 ||
          resource.baseVersion !== 3 ||
          resource.dirty ||
          !contextReady
        }
        onClick={() =>
          workspace.valuationAssumptions.coordinator.replaceDraft(
            controls.captured,
          )
        }
      >
        Stage both invented collection entries
      </button>
      <button
        id="fixture-collection-independent-editor"
        disabled={!contextReady || editor.dirty}
        onClick={() => {
          const context = workspace.valuation.getSnapshot().context!;
          const entry = {
            ...savedValuationInputs!,
            cik: context.cik,
            listing: context.listing,
            catalogSnapshotSha256: context.catalogSnapshotSha256,
          };
          if (
            !workspace.valuation.restoreDraftInputs(
              entry,
              workspace.valuation.getSnapshot(),
            )
          )
            throw new Error("Invented independent editor restore refused");
          if (!workspace.valuation.calculate())
            throw new Error("Invented independent calculation refused");
        }}
      >
        Prepare independent calculated editor
      </button>
      <button
        id="fixture-collection-fresh-session"
        disabled={
          counts.session >= 2 ||
          (counts.session === 0 ? counts.load !== 1 : counts.save !== 1)
        }
        onClick={() => {
          workspace.sessionOwner.dispose();
          history.replaceState(null, "", "/");
          onFreshSession(controls.nextSession());
        }}
      >
        Start fresh invented collection session
      </button>
      <pre id="fixture-valuation-collection" hidden>
        {JSON.stringify({
          counts,
          resource,
          local,
          editor,
          watchlist,
          followups,
          portfolio,
          captured: controls.captured,
          reviewed: controls.reviewed,
          newer: controls.newer,
          saved: controls.saved(),
        })}
      </pre>
    </aside>
  );
}
