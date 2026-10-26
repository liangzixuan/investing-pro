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
function holdingRouteActive(c: HoldingContext) {
  if (!c.routeCurrent()) return false;
  if (c.session.phase !== "active") return false;
  return c.view.view === "portfolio";
}
function holdingSelectionCurrent(c: HoldingContext) {
  if (c.view.research?.selection !== c.selection) return false;
  if (c.selection.origin !== "portfolio") return false;
  return c.selection.cik === null;
}
function catalogActionPending(c: HoldingContext) {
  return Boolean(c.view.read || c.view.review || c.view.reviewing);
}
function routeIssue(c: HoldingContext) {
  if (!holdingRouteActive(c) || !holdingSelectionCurrent(c))
    return "Return to the current holding in Portfolio research after the pending action finishes.";
  return catalogActionPending(c)
    ? "Finish the current catalog action before preparing a holding check."
    : null;
}
function portfolioFormPending(c: HoldingContext) {
  if (c.portfolio.pendingEditor) return true;
  return Boolean(c.portfolio.reviewing || c.portfolio.review);
}
function portfolioIssue(c: HoldingContext) {
  if (portfolioFormPending(c) || c.workspace.portfolio.hasDraftFileActivity())
    return "Apply or reset the Portfolio form and finish its identity or file review first.";
  return !holdingResourceReady(c.ledger) ||
    !c.workspace.portfolio.canSavePayload()
    ? "Load the current Portfolio and finish its save or recovery decision first."
    : null;
}
function catalogMatches(c: HoldingContext, digest: string) {
  if (digest !== c.selection.catalogSnapshotSha256) return false;
  if (c.portfolio.catalogSnapshotSha256 !== digest) return false;
  return c.ledger.draft?.ledger?.snapshotSha256 === digest;
}
function catalogIssue(c: HoldingContext) {
  const digest = c.view.snapshot?.snapshotSha256;
  if (!digest)
    return "Review the holding against the current Portfolio catalog first.";
  return catalogMatches(c, digest)
    ? null
    : "Review the holding against the current Portfolio catalog first.";
}
function followupsReviewPending(c: HoldingContext) {
  if (c.followups.reviewing || c.followups.review) return true;
  return c.workspace.followups.hasDraftFileActivity();
}
function followupsCatalogIssue(c: HoldingContext) {
  if (followupsReviewPending(c))
    return "Finish Follow-ups file or catalog review before previewing this check.";
  return c.followups.catalogSnapshotSha256 !== c.selection.catalogSnapshotSha256
    ? "Finish Follow-ups file or catalog review before previewing this check."
    : null;
}
function followupsIssue(c: HoldingContext) {
  if (!c.saved.draft)
    return "Load Follow-ups here before previewing this check. Your question and due date stay here.";
  if (!holdingResourceReady(c.saved) || !c.workspace.followups.canEdit())
    return "Finish Follow-ups load, save or recovery before previewing this check.";
  return followupsCatalogIssue(c);
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
function portfolioUnchanged(c: HoldingContext) {
  return (
    c.workspace.portfolio.getSnapshot() === c.portfolio &&
    c.workspace.portfolio.coordinator.getSnapshot() === c.ledger &&
    c.workspace.portfolio.getDraftFileActivityRevision() ===
      c.portfolioActivity &&
    !c.workspace.portfolio.hasDraftFileActivity()
  );
}
function baseUnchanged(c: HoldingContext, includeFollowups: boolean) {
  const session = c.workspace.sessionOwner.getSnapshot();
  const sessionCurrent = includeFollowups
    ? session === c.session
    : initialLoadSessionCurrent(c);
  if (!c.routeCurrent()) return false;
  if (c.workspace.getSnapshot() !== c.view) return false;
  return sessionCurrent && portfolioUnchanged(c);
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
function positionUnchanged(
  c: HoldingContext,
  position: HoldingFollowupPosition,
) {
  const current = projectedPosition(c);
  return current !== null && holdingPositionsMatch(position, current);
}
function contextUnchanged(c: HoldingContext, includeFollowups: boolean) {
  if (!baseUnchanged(c, includeFollowups)) return false;
  if (!includeFollowups) return true;
  return followupsUnchanged(c);
}
function lifetime(
  c: HoldingContext,
  position: HoldingFollowupPosition,
  includeFollowups: boolean,
) {
  let retired = false;
  return () => {
    if (retired) return false;
    retired = !contextUnchanged(c, includeFollowups);
    if (retired) return false;
    retired = !positionUnchanged(c, position);
    return !retired;
  };
}
function contextIssue(c: HoldingContext, includeFollowups: boolean) {
  const issue = routeIssue(c) ?? portfolioIssue(c) ?? catalogIssue(c);
  if (issue) return issue;
  return includeFollowups ? followupsIssue(c) : null;
}
function refusedContext(reason: string) {
  return { position: null, reason, isCurrent: () => false };
}
function readHoldingContext(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
  routeCurrent: () => boolean,
): HoldingContext {
  return {
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
}
/** Portfolio authority is independent of My Watchlist; initial Follow-ups Load has its own continuation. */
export function captureHoldingFollowupContext(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
  routeCurrent: () => boolean,
  includeFollowups = true,
) {
  const c = readHoldingContext(workspace, selection, routeCurrent);
  const issue = contextIssue(c, includeFollowups);
  if (issue) return refusedContext(issue);
  const position = projectedPosition(c);
  return position
    ? {
        position,
        reason: null,
        isCurrent: lifetime(c, position, includeFollowups),
      }
    : refusedContext(
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
  return selectedHoldingReview(workspace, entry, draft, current);
}
function selectedHoldingReview(
  workspace: ManagedWorkspace,
  entry: ResearchFollowup,
  draft: ResearchFollowupsPayload,
  current: () => boolean,
) {
  const selected = workspace.followups.getSnapshot();
  const isCurrent = () =>
    current() &&
    workspace.followups.getSnapshot() === selected &&
    selected.selectedId === entry.id;
  return isCurrent() ? Object.freeze({ entry, draft, isCurrent }) : null;
}
