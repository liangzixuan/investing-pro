import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { TrialSession } from "../../src/clerk-trial/session";
import { savedValuationInputs } from "./fixture";
import { fixture } from "./native-fixture-environment";
export function ResearchDraftSetFixtureControls({
  workspace,
  onFreshSession,
}: {
  workspace: ManagedWorkspace;
  onFreshSession: (session: TrialSession) => void;
}) {
  const control = fixture.researchDraftSet!,
    counts = useSyncExternalStore(control.subscribe, control.getSnapshot),
    watchlist = useSyncExternalStore(
      workspace.coordinator.subscribe,
      workspace.coordinator.getSnapshot,
    ),
    portfolio = useSyncExternalStore(
      workspace.portfolio.coordinator.subscribe,
      workspace.portfolio.coordinator.getSnapshot,
    ),
    followups = useSyncExternalStore(
      workspace.followups.coordinator.subscribe,
      workspace.followups.coordinator.getSnapshot,
    ),
    valuation = useSyncExternalStore(
      workspace.valuationAssumptions.coordinator.subscribe,
      workspace.valuationAssumptions.coordinator.getSnapshot,
    ),
    editor = useSyncExternalStore(
      workspace.valuation.subscribe,
      workspace.valuation.getSnapshot,
    ),
    portfolioLocal = useSyncExternalStore(
      workspace.portfolio.subscribe,
      workspace.portfolio.getSnapshot,
    ),
    valuationLocal = useSyncExternalStore(
      workspace.valuationAssumptions.subscribe,
      workspace.valuationAssumptions.getSnapshot,
    );
  const loaded =
    portfolio.baseVersion !== null &&
    followups.baseVersion !== null &&
    valuation.baseVersion !== null;
  function editorDraft() {
    const context = workspace.valuation.getSnapshot().context;
    if (!context || context.listing.listingId !== "listing-zero")
      throw new Error("Invented exact ZERO editor context required");
    const entry = {
      ...savedValuationInputs!,
      listing: context.listing,
      cik: context.cik,
      catalogSnapshotSha256: context.catalogSnapshotSha256,
    };
    if (
      !workspace.valuation.restoreDraftInputs(
        entry,
        workspace.valuation.getSnapshot(),
      ) ||
      !workspace.valuation.calculate()
    )
      throw new Error("Invented independent editor refused");
  }
  return (
    <aside aria-label="Invented research draft-set controls">
      <button
        id="fixture-draft-set-load"
        disabled={loaded || watchlist.baseVersion === null}
        onClick={() => {
          void Promise.all([
            workspace.portfolio.coordinator.load(),
            workspace.followups.coordinator.load(),
            workspace.valuationAssumptions.coordinator.load(),
          ]);
        }}
      >
        Load the remaining invented resource bases
      </button>
      <button
        id="fixture-draft-set-stage"
        disabled={
          !loaded || counts.session !== 0 || watchlist.dirty || !editor.context
        }
        onClick={() => {
          workspace.coordinator.replaceDraft(control.data.captured.watchlist);
          workspace.portfolio.coordinator.replaceDraft({
            ledger: control.data.captured.portfolio,
          });
          workspace.followups.coordinator.replaceDraft(
            control.data.captured.followups,
          );
          workspace.valuationAssumptions.coordinator.replaceDraft(
            control.data.captured.valuation,
          );
          editorDraft();
        }}
      >
        Stage all four complete invented drafts
      </button>
      <button
        id="fixture-draft-set-independent"
        disabled={
          !loaded || counts.session !== 1 || editor.dirty || !editor.context
        }
        onClick={() => {
          workspace.coordinator.replaceDraft(control.data.independentWatchlist);
          workspace.followups.coordinator.replaceDraft(
            control.data.newer.followups,
          );
          editorDraft();
        }}
      >
        Prepare independent current drafts and calculated editor
      </button>
      <button
        id="fixture-draft-set-fresh-session"
        disabled={
          counts.session >= 2 ||
          !loaded ||
          (counts.session === 1 &&
            (counts.portfolioSave !== 1 || counts.valuationSave !== 1))
        }
        onClick={() => {
          workspace.sessionOwner.dispose();
          history.replaceState(null, "", "/");
          onFreshSession(control.nextSession());
        }}
      >
        Start fresh invented draft-set session
      </button>
      <pre id="fixture-research-draft-set" hidden>
        {JSON.stringify({
          counts,
          watchlist,
          portfolio,
          followups,
          valuation,
          editor,
          portfolioLocal,
          valuationLocal,
          data: control.data,
          saved: control.saved(),
        })}
      </pre>
    </aside>
  );
}
