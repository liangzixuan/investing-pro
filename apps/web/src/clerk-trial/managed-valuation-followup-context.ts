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

/** Capture resource identities without loading evidence or changing a draft. */
export function captureValuationFollowupContext(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
  routeCurrent: () => boolean,
  includeFollowups = true,
): { port: ValuationFollowupPort | null; reason: string | null } {
  const refuse = (reason: string) => ({ port: null, reason });
  const view = workspace.getSnapshot();
  const session = workspace.sessionOwner.getSnapshot();
  const member = workspace.getResearchWatchlist(selection);
  const editor = workspace.valuation.getSnapshot();
  const assumptions = workspace.valuationAssumptions.getSnapshot();
  const savedInputs = workspace.valuationAssumptions.coordinator.getSnapshot();
  const watchlist = workspace.coordinator.getSnapshot();
  const followups = workspace.followups.getSnapshot();
  const savedFollowups = workspace.followups.coordinator.getSnapshot();
  const sources = [
    workspace.eod,
    workspace.annual,
    workspace.filings,
    workspace.interim,
  ] as const;
  const sourceStates = sources.map((source) => source.getSnapshot());
  const appliedBasis = workspace.getAppliedAnnualRevenueBasis(selection);
  const valuationFiles = workspace.valuation.getDraftFileActivityRevision();
  const followupFiles = workspace.followups.getDraftFileActivityRevision();
  if (
    !routeCurrent() ||
    session.phase !== "active" ||
    view.research?.selection !== selection ||
    view.read ||
    view.review ||
    view.reviewing
  )
    return refuse(
      "Return to the current company after the pending research action finishes.",
    );
  if (!member.canEdit || !member.member || !loaded(watchlist))
    return refuse(
      "Use the exact editable company in My Watchlist before keeping a valuation check.",
    );
  if (!editor.editable || !editor.calculation || editor.inputIssue)
    return refuse(
      "Calculate the current company's authored inputs before keeping a valuation check.",
    );
  if (
    !settled(savedInputs) ||
    assumptions.reviewing ||
    assumptions.stageReview ||
    assumptions.restoreReview ||
    assumptions.catalogReview ||
    workspace.valuation.hasDraftFileActivity()
  )
    return refuse(
      "Finish valuation input save, recovery or file review before keeping this check.",
    );
  if (
    sourceStates.some((state) => state.running || state.catalogChanged) ||
    workspace.annual.getSnapshot().checkingSeed
  )
    return refuse(
      "Wait for the current company source action to finish before previewing this check.",
    );
  if (
    workspace.followups.hasDraftFileActivity() ||
    followups.reviewing ||
    followups.review
  )
    return refuse(
      "Finish Follow-ups file or catalog review before keeping this check.",
    );
  if (
    includeFollowups &&
    (!loaded(savedFollowups) ||
      !workspace.followups.canEdit() ||
      followups.catalogSnapshotSha256 !== selection.catalogSnapshotSha256)
  )
    return refuse(
      "Load Follow-ups here, or finish its save or recovery decision, before previewing this check.",
    );

  const host = workspace.thesisFollowupContext(member.member, selection);
  let retired = false;
  const resources: [{ getSnapshot: () => unknown }, unknown][] = [
    [workspace, view],
    [workspace.coordinator, watchlist],
    [workspace.valuation, editor],
    [workspace.valuationAssumptions, assumptions],
    [workspace.valuationAssumptions.coordinator, savedInputs],
    ...sources.map(
      (source, index): [{ getSnapshot: () => unknown }, unknown] => [
        source,
        sourceStates[index],
      ],
    ),
  ];
  if (includeFollowups)
    resources.push(
      [workspace.sessionOwner, session],
      [workspace.followups, followups],
      [workspace.followups.coordinator, savedFollowups],
    );
  const filesCurrent = () =>
    workspace.valuation.getDraftFileActivityRevision() === valuationFiles &&
    !workspace.valuation.hasDraftFileActivity() &&
    workspace.followups.getDraftFileActivityRevision() === followupFiles &&
    !workspace.followups.hasDraftFileActivity();
  const unchanged = () =>
    routeCurrent() &&
    host.isCurrent() &&
    workspace.sessionOwner.getSnapshot().phase === "active" &&
    resources.every(
      ([resource, captured]) => resource.getSnapshot() === captured,
    ) &&
    filesCurrent() &&
    workspace.getAppliedAnnualRevenueBasis(selection) === appliedBasis;
  return {
    port: Object.freeze({
      model: workspace.followups,
      member: member.member,
      calculation: editor.calculation,
      isCurrent: () => {
        retired ||= !unchanged();
        return !retired;
      },
    }),
    reason: null,
  };
}
