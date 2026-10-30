import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedValuationSnapshot } from "./managed-valuation-workbench";
import type { ValuationAssumptionEntry } from "@research-cockpit/contracts";
import type { ManagedValuationDraftFileDeliveryAdapter } from "./valuation-draft-file-delivery";

export interface ValuationDraftRecoveryOptions {
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ManagedValuationDraftFileDeliveryAdapter | undefined;
  routeActive: () => boolean;
  selection: () => ManagedResearchSelection;
  now?: () => string;
}
export interface ValuationDraftContext {
  editor: ManagedValuationSnapshot;
  visit: NonNullable<ReturnType<ManagedWorkspace["getSnapshot"]>["research"]>;
  catalog: NonNullable<ReturnType<ManagedWorkspace["getSnapshot"]>["snapshot"]>;
  assumptions: ReturnType<
    ManagedWorkspace["valuationAssumptions"]["getSnapshot"]
  >;
  save: ReturnType<
    ManagedWorkspace["valuationAssumptions"]["coordinator"]["getSnapshot"]
  >;
}
function editableInputs(editor: ManagedValuationSnapshot) {
  return editor.editable && !editor.retired && editor.owner !== null;
}
function savedInputsIdle(
  save: ValuationDraftContext["save"],
  assumptions: ValuationDraftContext["assumptions"],
) {
  return (
    save.phase === "idle" &&
    [
      save.conflict,
      save.uncertain,
      save.replayPending,
      assumptions.reviewing,
      assumptions.stageReview,
      assumptions.restoreReview,
      assumptions.catalogReview,
    ].every((pending) => !pending)
  );
}

function currentResearchVisit(options: ValuationDraftRecoveryOptions) {
  if (!options.routeActive()) return null;
  const view = options.workspace.getSnapshot();
  if (!view.research) return null;
  if (view.research.selection !== options.selection()) return null;
  if (!view.snapshot) return null;
  if (view.read || view.reviewing) return null;
  if (
    view.snapshot.snapshotSha256 !==
    view.research.selection.catalogSnapshotSha256
  )
    return null;
  return { visit: view.research, catalog: view.snapshot };
}

export function valuationDraftContext(
  options: ValuationDraftRecoveryOptions,
): ValuationDraftContext | null {
  const visit = currentResearchVisit(options);
  if (!visit) return null;
  const workspace = options.workspace;
  if (workspace.valuationAssumptions.hasCollectionFileActivity()) return null;
  const editor = workspace.valuation.getSnapshot();
  if (!editableInputs(editor)) return null;
  const assumptions = workspace.valuationAssumptions.getSnapshot();
  const save = workspace.valuationAssumptions.coordinator.getSnapshot();
  if (!savedInputsIdle(save, assumptions)) return null;
  return { ...visit, editor, assumptions, save };
}

export function sameValuationDraftContext(
  current: ValuationDraftContext | null,
  before: ValuationDraftContext,
) {
  if (!current) return false;
  return (Object.keys(before) as (keyof ValuationDraftContext)[]).every(
    (key) => current[key] === before[key],
  );
}

export function valuationDraftMatchesCompany(
  entry: ValuationAssumptionEntry,
  context: ValuationDraftContext,
) {
  const selected = context.visit.selection;
  return (
    entry.catalogSnapshotSha256 === selected.catalogSnapshotSha256 &&
    entry.cik === selected.cik &&
    Object.keys(selected.listing).every(
      (key) =>
        entry.listing[key as keyof typeof entry.listing] ===
        selected.listing[key as keyof typeof selected.listing],
    )
  );
}
