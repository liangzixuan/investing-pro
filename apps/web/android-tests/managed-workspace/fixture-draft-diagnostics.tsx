import { MarketsBriefingFixtureDiagnostics } from "./markets-briefing-fixture-diagnostics";
import { CpiHeadlineFollowupFixtureDiagnostics } from "./cpi-headline-followup-fixture-diagnostics";
import { ValuationScenarioFollowupFixtureDiagnostics } from "./valuation-scenario-followup-fixture-diagnostics";
import { formatManagedWatchlistExport } from "../../src/clerk-trial/managed-watchlist-export-document";
import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { authoredValuationNoteDraft, authoredValuationPrefix } from "./fixture";
import { fixture, scenario, nativeExport } from "./native-fixture-environment";
function SavedValuationFixtureDiagnostics({
  workspace,
}: {
  workspace: ManagedWorkspace;
}) {
  const controls = fixture.savedValuation!;
  const counts = useSyncExternalStore(controls.subscribe, controls.getSnapshot);
  const editor = useSyncExternalStore(
    workspace.valuation.subscribe,
    workspace.valuation.getSnapshot,
  );
  const resource = useSyncExternalStore(
    workspace.valuationAssumptions.coordinator.subscribe,
    workspace.valuationAssumptions.coordinator.getSnapshot,
  );
  return (
    <aside aria-label="Invented saved valuation diagnostics">
      <pre id="fixture-saved-valuation-store" hidden>
        {JSON.stringify({
          counts,
          expected: controls.expected,
          saved: controls.saved(),
        })}
      </pre>
      <pre id="fixture-valuation-draft" hidden>
        {JSON.stringify(editor)}
      </pre>
      <pre id="fixture-saved-valuation-resource" hidden>
        {JSON.stringify(resource)}
      </pre>
    </aside>
  );
}
function useDraftObservations(workspace: ManagedWorkspace) {
  const draft = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  const valuation = useSyncExternalStore(
    workspace.valuation.subscribe,
    workspace.valuation.getSnapshot,
  );

  return { draft, valuation };
}
function SavedValuationDiagnostics({
  workspace,
}: {
  workspace: ManagedWorkspace;
}) {
  return (
    <>
      {fixture.savedValuation && (
        <SavedValuationFixtureDiagnostics workspace={workspace} />
      )}
    </>
  );
}
function AuthoredValuationDiagnostics({
  valuation,
}: Pick<ReturnType<typeof useDraftObservations>, "valuation">) {
  return (
    <>
      {scenario === "authored-valuation" && (
        <>
          <pre
            id="fixture-valuation-expected"
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {JSON.stringify({
              prefix: authoredValuationPrefix,
              expectedNote: authoredValuationNoteDraft,
            })}
          </pre>
          <pre
            id="fixture-valuation-draft"
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {JSON.stringify(valuation)}
          </pre>
        </>
      )}
    </>
  );
}
function ValuationPriceDiagnostics() {
  return (
    <>
      {fixture.valuationPrice && (
        <pre id="fixture-valuation-price" hidden>
          {JSON.stringify(fixture.valuationPrice)}
        </pre>
      )}
    </>
  );
}
function ValuationEditorDiagnostics({
  valuation,
}: Pick<ReturnType<typeof useDraftObservations>, "valuation">) {
  return (
    <>
      {(fixture.valuationPrice ||
        scenario === "valuation-scenario-followup") && (
        <pre id="fixture-valuation-draft" hidden>
          {JSON.stringify(valuation)}
        </pre>
      )}
    </>
  );
}
function ExportDocumentDiagnostics({
  draft,
}: Pick<ReturnType<typeof useDraftObservations>, "draft">) {
  return (
    <>
      {nativeExport && (
        <pre id="fixture-export-document">
          {JSON.stringify(
            draft.saved ? formatManagedWatchlistExport(draft.saved) : null,
          )}
        </pre>
      )}
    </>
  );
}
function WatchlistDraftDiagnostics({
  draft,
}: Pick<ReturnType<typeof useDraftObservations>, "draft">) {
  return (
    <>
      <pre
        id="fixture-workspace-draft"
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {JSON.stringify({
          phase: draft.phase,
          baseVersion: draft.baseVersion,
          dirty: draft.dirty,
          memberships:
            draft.draft?.memberships.map(({ listingId, symbol, note }) => ({
              listingId,
              symbol,
              note,
            })) ?? null,
        })}
      </pre>
    </>
  );
}
export function FixtureDraftDiagnostics({
  workspace,
}: {
  workspace: ManagedWorkspace;
}) {
  const values = useDraftObservations(workspace);
  return (
    <aside aria-label="Invented draft diagnostics">
      <SavedValuationDiagnostics workspace={workspace} />
      <AuthoredValuationDiagnostics valuation={values.valuation} />
      <ValuationPriceDiagnostics />
      <ValuationEditorDiagnostics valuation={values.valuation} />
      <ExportDocumentDiagnostics draft={values.draft} />
      <WatchlistDraftDiagnostics draft={values.draft} />
      {scenario === "markets-briefing" && (
        <MarketsBriefingFixtureDiagnostics
          workspace={workspace}
          fixture={fixture}
        />
      )}
      {scenario === "cpi-headline-followup" && (
        <CpiHeadlineFollowupFixtureDiagnostics
          workspace={workspace}
          fixture={fixture}
        />
      )}
      {scenario === "valuation-scenario-followup" && (
        <ValuationScenarioFollowupFixtureDiagnostics
          model={workspace.followups}
        />
      )}
    </aside>
  );
}
