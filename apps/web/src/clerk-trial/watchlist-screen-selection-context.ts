import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedFinancialScreenState } from "./managed-financial-screen";
import { captureWatchlistResourceDraftContext } from "./managed-watchlist-draft-context";

export function captureWatchlistScreenContext(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
) {
  const view = workspace.getSnapshot();
  const session = workspace.sessionOwner.getSnapshot();
  const saved = workspace.coordinator.getSnapshot();
  const screen = workspace.financialScreen.getSnapshot();
  const activity = workspace.getWatchlistDraftFileActivityRevision();
  const route = workspace.captureWatchlistScreenRoute();
  const draft = captureWatchlistResourceDraftContext(saved, view, true);
  let retired = false;
  const isCurrent = (installed: ManagedFinancialScreenState = screen) => {
    if (
      workspace.getSnapshot() !== view ||
      workspace.sessionOwner.getSnapshot() !== session ||
      workspace.coordinator.getSnapshot() !== saved ||
      workspace.getWatchlistDraftFileActivityRevision() !== activity ||
      workspace.financialScreen.getSnapshot() !== installed ||
      !route?.() ||
      !routeActive()
    )
      retired = true;
    return !retired;
  };
  return {
    workspace,
    view,
    session,
    saved,
    screen,
    draft,
    route,
    routeActive,
    isCurrent,
  };
}
type Context = ReturnType<typeof captureWatchlistScreenContext>;
export function watchlistScreenContextIssue(context: Context): string | null {
  const { workspace, view, session, saved, screen, draft } = context;
  if (
    session.phase !== "active" ||
    !context.route?.() ||
    !context.routeActive()
  )
    return "Return to Discover in an active session before using Watchlist companies.";
  if (
    !saved.latestLoaded ||
    !saved.draft ||
    !saved.saved ||
    saved.baseVersion !== saved.saved.version
  )
    return "Load the latest My Watchlist version first.";
  if (!draft || !workspace.canEdit())
    return "Finish the Watchlist operation, catalog review or recovery first.";
  if (workspace.hasWatchlistDraftFileActivity())
    return "Finish or cancel the Watchlist file operation first.";
  if (
    workspace.watchlistFileCatalogReviewRequired() ||
    !view.snapshot ||
    draft.draft.snapshotSha256 !== view.snapshot.snapshotSha256
  )
    return "Review My Watchlist against the current catalog first.";
  if (
    !screen.active ||
    screen.catalogChanged ||
    screen.catalogSnapshotSha256 !== view.snapshot.snapshotSha256
  )
    return "Load the current screening cohort first.";
  if (screen.pending)
    return "Finish or cancel the current screening request first.";
  if (screen.criteriaStaged)
    return "Apply or reset the screening criteria first.";
  if (!screen.canRead)
    return "Wait for screening access before preparing a selection.";
  return null;
}
