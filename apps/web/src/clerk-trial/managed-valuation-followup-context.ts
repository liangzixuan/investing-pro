import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { SaveState } from "./save-coordinator";
import type { ValuationFollowupPort } from "./managed-valuation-followup";

function settled(state: SaveState<unknown>) {
  return (
    state.phase === "idle" &&
    !state.conflict &&
    !state.uncertain &&
    !state.replayPending
  );
}
function loaded(state: SaveState<unknown>) {
  return (
    settled(state) &&
    state.latestLoaded &&
    state.draft !== null &&
    state.saved !== null &&
    state.baseVersion === state.saved.version
  );
}
function readContext(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
  routeCurrent: () => boolean,
) {
  return {
    workspace,
    selection,
    routeCurrent,
    view: workspace.getSnapshot(),
    session: workspace.sessionOwner.getSnapshot(),
    member: workspace.getResearchWatchlist(selection),
    editor: workspace.valuation.getSnapshot(),
    assumptions: workspace.valuationAssumptions.getSnapshot(),
    savedInputs: workspace.valuationAssumptions.coordinator.getSnapshot(),
    watchlist: workspace.coordinator.getSnapshot(),
    followups: workspace.followups.getSnapshot(),
    savedFollowups: workspace.followups.coordinator.getSnapshot(),
    eod: workspace.eod.getSnapshot(),
    annual: workspace.annual.getSnapshot(),
    filings: workspace.filings.getSnapshot(),
    interim: workspace.interim.getSnapshot(),
    appliedBasis: workspace.getAppliedAnnualRevenueBasis(selection),
    valuationFiles: workspace.valuation.getDraftFileActivityRevision(),
    followupFiles: workspace.followups.getDraftFileActivityRevision(),
  };
}
type Context = ReturnType<typeof readContext>;
type ResourceCapture = readonly [{ getSnapshot: () => unknown }, unknown];
function routeReady(c: Context) {
  return (
    c.routeCurrent() &&
    c.session.phase === "active" &&
    c.view.research?.selection === c.selection
  );
}
function catalogActionPending(c: Context) {
  return Boolean(c.view.read || c.view.review || c.view.reviewing);
}
function routeIssue(c: Context) {
  if (!routeReady(c))
    return "Return to the current company after the pending research action finishes.";
  return catalogActionPending(c)
    ? "Return to the current company after the pending research action finishes."
    : null;
}
function watchlistIssue(c: Context) {
  const editableMember = c.member.canEdit && c.member.member !== null;
  return editableMember && loaded(c.watchlist)
    ? null
    : "Use the exact editable company in My Watchlist before keeping a valuation check.";
}
function editorReady(c: Context) {
  return (
    c.editor.editable && c.editor.calculation !== null && !c.editor.inputIssue
  );
}
function inputReviewPending(c: Context) {
  return [
    c.assumptions.reviewing,
    c.assumptions.stageReview,
    c.assumptions.restoreReview,
    c.assumptions.catalogReview,
  ].some(Boolean);
}
function valuationIssue(c: Context) {
  if (!editorReady(c))
    return "Calculate the current company's authored inputs before keeping a valuation check.";
  if (!settled(c.savedInputs))
    return "Finish valuation input save, recovery or file review before keeping this check.";
  if (inputReviewPending(c))
    return "Finish valuation input save, recovery or file review before keeping this check.";
  return c.workspace.valuation.hasDraftFileActivity()
    ? "Finish valuation input save, recovery or file review before keeping this check."
    : null;
}
function sourceIssue(c: Context) {
  const pending = [c.eod, c.annual, c.filings, c.interim].some(
    (source) => source.running || source.catalogChanged,
  );
  return pending || c.workspace.annual.getSnapshot().checkingSeed
    ? "Wait for the current company source action to finish before previewing this check."
    : null;
}
function followupReviewPending(c: Context) {
  return [
    c.workspace.followups.hasDraftFileActivity(),
    c.followups.reviewing,
    c.followups.review,
  ].some(Boolean);
}
function followupsReady(c: Context) {
  return (
    loaded(c.savedFollowups) &&
    c.workspace.followups.canEdit() &&
    c.followups.catalogSnapshotSha256 === c.selection.catalogSnapshotSha256
  );
}
function followupsIssue(c: Context, includeFollowups: boolean) {
  if (followupReviewPending(c))
    return "Finish Follow-ups file or catalog review before keeping this check.";
  if (!includeFollowups) return null;
  return followupsReady(c)
    ? null
    : "Load Follow-ups here, or finish its save or recovery decision, before previewing this check.";
}
function contextIssue(c: Context, includeFollowups: boolean) {
  return (
    routeIssue(c) ??
    watchlistIssue(c) ??
    valuationIssue(c) ??
    sourceIssue(c) ??
    followupsIssue(c, includeFollowups)
  );
}
function capturedResources(
  c: Context,
  includeFollowups: boolean,
): readonly ResourceCapture[] {
  const w = c.workspace;
  const resources: ResourceCapture[] = [
    [w, c.view],
    [w.coordinator, c.watchlist],
    [w.valuation, c.editor],
    [w.valuationAssumptions, c.assumptions],
    [w.valuationAssumptions.coordinator, c.savedInputs],
    [w.eod, c.eod],
    [w.annual, c.annual],
    [w.filings, c.filings],
    [w.interim, c.interim],
  ];
  if (includeFollowups)
    resources.push(
      [w.sessionOwner, c.session],
      [w.followups, c.followups],
      [w.followups.coordinator, c.savedFollowups],
    );
  return resources;
}
function filesCurrent(c: Context) {
  const w = c.workspace;
  return (
    w.valuation.getDraftFileActivityRevision() === c.valuationFiles &&
    !w.valuation.hasDraftFileActivity() &&
    w.followups.getDraftFileActivityRevision() === c.followupFiles &&
    !w.followups.hasDraftFileActivity()
  );
}
function contextCurrent(
  c: Context,
  hostCurrent: () => boolean,
  resources: readonly ResourceCapture[],
) {
  return (
    c.routeCurrent() &&
    hostCurrent() &&
    c.workspace.sessionOwner.getSnapshot().phase === "active" &&
    resources.every(
      ([resource, captured]) => resource.getSnapshot() === captured,
    ) &&
    filesCurrent(c) &&
    c.workspace.getAppliedAnnualRevenueBasis(c.selection) === c.appliedBasis
  );
}
function lifetime(c: Context, includeFollowups: boolean) {
  const resources = capturedResources(c, includeFollowups);
  const host = c.workspace.thesisFollowupContext(c.member.member!, c.selection);
  let retired = false;
  return () => {
    retired ||= !contextCurrent(c, host.isCurrent, resources);
    return !retired;
  };
}
function refuse(reason: string) {
  return { port: null, reason };
}

/** Capture resource identities without loading evidence or changing a draft. */
export function captureValuationFollowupContext(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
  routeCurrent: () => boolean,
  includeFollowups = true,
): { port: ValuationFollowupPort | null; reason: string | null } {
  const context = readContext(workspace, selection, routeCurrent);
  const issue = contextIssue(context, includeFollowups);
  if (issue) return refuse(issue);
  const member = context.member.member;
  const calculation = context.editor.calculation;
  if (!member || !calculation)
    return refuse("Return to the current company before keeping this check.");
  return {
    port: Object.freeze({
      model: workspace.followups,
      member,
      calculation,
      isCurrent: lifetime(context, includeFollowups),
    }),
    reason: null,
  };
}
