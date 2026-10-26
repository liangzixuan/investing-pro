import {
  isPersonalPortfolioIdentity,
  type ResearchFollowup,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import {
  holdingPositionsMatch,
  type HoldingFollowupPosition,
} from "./managed-holding-followup";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { SaveState } from "./save-coordinator";

interface HoldingContext {
  readonly workspace: ManagedWorkspace;
  readonly selection: ManagedResearchSelection;
  readonly routeCurrent: () => boolean;
  readonly view: ReturnType<ManagedWorkspace["getSnapshot"]>;
  readonly session: ReturnType<ManagedWorkspace["sessionOwner"]["getSnapshot"]>;
  readonly portfolio: ReturnType<ManagedWorkspace["portfolio"]["getSnapshot"]>;
  readonly ledger: ReturnType<
    ManagedWorkspace["portfolio"]["coordinator"]["getSnapshot"]
  >;
  readonly portfolioActivity: object;
  readonly followups: ReturnType<ManagedWorkspace["followups"]["getSnapshot"]>;
  readonly saved: ReturnType<
    ManagedWorkspace["followups"]["coordinator"]["getSnapshot"]
  >;
  readonly followupActivity: object;
  readonly watchlist: ReturnType<
    ManagedWorkspace["coordinator"]["getSnapshot"]
  >;
  readonly valuationSaved: ReturnType<
    ManagedWorkspace["valuationAssumptions"]["coordinator"]["getSnapshot"]
  >;
  readonly valuation: ReturnType<ManagedWorkspace["valuation"]["getSnapshot"]>;
}
function recoveryReady(state: SaveState<unknown>) {
  return !state.conflict && !state.uncertain && !state.replayPending;
}
function baselineReady(state: SaveState<unknown>) {
  return (
    state.latestLoaded &&
    state.draft !== null &&
    state.saved !== null &&
    state.baseVersion === state.saved.version
  );
}
export function holdingResourceReady(state: SaveState<unknown>) {
  return state.phase === "idle" && recoveryReady(state) && baselineReady(state);
}
function projectedPosition({
  workspace,
  selection,
}: HoldingContext): HoldingFollowupPosition | null {
  const projection = workspace.portfolio.getProjection();
  if (projection?.status !== "valid") return null;
  const holding = projection.portfolio.holdings.find(
    (row) =>
      row.identity.listingId === selection.listing.listingId &&
      Number(row.shares) > 0,
  );
  if (!holding || !isPersonalPortfolioIdentity(holding.identity)) return null;
  const position = {
    listing: Object.freeze({ ...holding.identity }),
    shares: holding.shares,
    totalCostBasisUsd: holding.totalCostBasisUsd,
    confirmedOn: holding.confirmedOn,
  };
  return holdingPositionsMatch(position, {
    ...position,
    listing: selection.listing,
  })
    ? Object.freeze(position)
    : null;
}
function routeIssue(c: HoldingContext) {
  if (
    !c.routeCurrent() ||
    c.session.phase !== "active" ||
    c.view.view !== "portfolio" ||
    c.view.research?.selection !== c.selection ||
    c.selection.origin !== "portfolio" ||
    c.selection.cik !== null
  )
    return "Return to the current holding in Portfolio research after the pending action finishes.";
  return c.view.read || c.view.review || c.view.reviewing
    ? "Finish the current catalog action before preparing a holding check."
    : null;
}
function portfolioIssue(c: HoldingContext) {
  if (
    c.portfolio.pendingEditor ||
    c.portfolio.reviewing ||
    c.portfolio.review ||
    c.workspace.portfolio.hasDraftFileActivity()
  )
    return "Apply or reset the Portfolio form and finish its identity or file review first.";
  return !holdingResourceReady(c.ledger) ||
    !c.workspace.portfolio.canSavePayload()
    ? "Load the current Portfolio and finish its save or recovery decision first."
    : null;
}
function catalogIssue(c: HoldingContext) {
  const digest = c.view.snapshot?.snapshotSha256;
  return !digest ||
    digest !== c.selection.catalogSnapshotSha256 ||
    c.portfolio.catalogSnapshotSha256 !== digest ||
    c.ledger.draft?.ledger?.snapshotSha256 !== digest
    ? "Review the holding against the current Portfolio catalog first."
    : null;
}
function followupsIssue(c: HoldingContext) {
  if (!c.saved.draft)
    return "Load Follow-ups here before previewing this check. Your question and due date stay here.";
  if (!holdingResourceReady(c.saved) || !c.workspace.followups.canEdit())
    return "Finish Follow-ups load, save or recovery before previewing this check.";
  if (
    c.followups.reviewing ||
    c.followups.review ||
    c.workspace.followups.hasDraftFileActivity() ||
    c.followups.catalogSnapshotSha256 !== c.selection.catalogSnapshotSha256
  )
    return "Finish Follow-ups file or catalog review before previewing this check.";
  return null;
}
function initialLoadSessionCurrent(c: HoldingContext) {
  return (
    c.workspace.sessionOwner.getSnapshot().phase === "active" &&
    c.workspace.coordinator.getSnapshot() === c.watchlist &&
    c.workspace.valuationAssumptions.coordinator.getSnapshot() ===
      c.valuationSaved &&
    c.workspace.valuation.getSnapshot() === c.valuation
  );
}
function baseUnchanged(c: HoldingContext, includeFollowups: boolean) {
  const session = c.workspace.sessionOwner.getSnapshot();
  const sessionCurrent = includeFollowups
    ? session === c.session
    : initialLoadSessionCurrent(c);
  return (
    c.routeCurrent() &&
    c.workspace.getSnapshot() === c.view &&
    sessionCurrent &&
    c.workspace.portfolio.getSnapshot() === c.portfolio &&
    c.workspace.portfolio.coordinator.getSnapshot() === c.ledger &&
    c.workspace.portfolio.getDraftFileActivityRevision() ===
      c.portfolioActivity &&
    !c.workspace.portfolio.hasDraftFileActivity()
  );
}
function followupsUnchanged(c: HoldingContext) {
  return (
    c.workspace.followups.getSnapshot() === c.followups &&
    c.workspace.followups.coordinator.getSnapshot() === c.saved &&
    c.workspace.followups.getDraftFileActivityRevision() ===
      c.followupActivity &&
    !c.workspace.followups.hasDraftFileActivity()
  );
}
function lifetime(
  c: HoldingContext,
  position: HoldingFollowupPosition,
  includeFollowups: boolean,
) {
  let retired = false;
  return () => {
    if (retired) return false;
    retired =
      !baseUnchanged(c, includeFollowups) ||
      (includeFollowups && !followupsUnchanged(c));
    const current = retired ? null : projectedPosition(c);
    retired ||= !current || !holdingPositionsMatch(position, current);
    return !retired;
  };
}
/** Portfolio authority is independent of My Watchlist; initial Follow-ups Load has its own continuation. */
export function captureHoldingFollowupContext(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
  routeCurrent: () => boolean,
  includeFollowups = true,
) {
  const c: HoldingContext = {
    workspace,
    selection,
    routeCurrent,
    view: workspace.getSnapshot(),
    session: workspace.sessionOwner.getSnapshot(),
    portfolio: workspace.portfolio.getSnapshot(),
    ledger: workspace.portfolio.coordinator.getSnapshot(),
    portfolioActivity: workspace.portfolio.getDraftFileActivityRevision(),
    followups: workspace.followups.getSnapshot(),
    saved: workspace.followups.coordinator.getSnapshot(),
    followupActivity: workspace.followups.getDraftFileActivityRevision(),
    watchlist: workspace.coordinator.getSnapshot(),
    valuationSaved: workspace.valuationAssumptions.coordinator.getSnapshot(),
    valuation: workspace.valuation.getSnapshot(),
  };
  const refuse = (reason: string) => ({
    position: null,
    reason,
    isCurrent: () => false,
  });
  const issue =
    routeIssue(c) ??
    portfolioIssue(c) ??
    catalogIssue(c) ??
    (includeFollowups ? followupsIssue(c) : null);
  if (issue) return refuse(issue);
  const position = projectedPosition(c);
  return position
    ? {
        position,
        reason: null,
        isCurrent: lifetime(c, position, includeFollowups),
      }
    : refuse(
        "Choose an exact current positive Portfolio holding before keeping its next check.",
      );
}
export function selectHoldingFollowupForReview(
  workspace: ManagedWorkspace,
  entry: ResearchFollowup,
  draft: ResearchFollowupsPayload,
  current: () => boolean,
) {
  if (!current() || workspace.followups.currentEntry(entry.id) !== entry)
    return null;
  workspace.followups.select(entry.id);
  if (!current()) return null;
  workspace.followups.setFilter(
    entry.status === "completed" ? "completed" : "open",
  );
  const selected = workspace.followups.getSnapshot();
  const isCurrent = () =>
    current() &&
    workspace.followups.getSnapshot() === selected &&
    selected.selectedId === entry.id;
  return isCurrent() ? Object.freeze({ entry, draft, isCurrent }) : null;
}
