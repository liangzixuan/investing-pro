import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedFinancialScreenState } from "./managed-financial-screen";

export function capturePortfolioScreenContext(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
) {
  const view = workspace.getSnapshot();
  const session = workspace.sessionOwner.getSnapshot();
  const portfolio = workspace.portfolio.getSnapshot();
  const saved = workspace.portfolio.coordinator.getSnapshot();
  const screen = workspace.financialScreen.getSnapshot();
  const activity = workspace.portfolio.getDraftFileActivityRevision();
  const route = workspace.capturePortfolioScreenRoute();
  let retired = false;
  const isCurrent = (installed: ManagedFinancialScreenState = screen) => {
    if (
      workspace.getSnapshot() !== view ||
      workspace.sessionOwner.getSnapshot() !== session ||
      workspace.portfolio.getSnapshot() !== portfolio ||
      workspace.portfolio.coordinator.getSnapshot() !== saved ||
      workspace.portfolio.getDraftFileActivityRevision() !== activity ||
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
    portfolio,
    saved,
    screen,
    route,
    routeActive,
    isCurrent,
  };
}

type Context = ReturnType<typeof capturePortfolioScreenContext>;

function portfolioIssue({ workspace, portfolio, saved }: Context) {
  if (!saved.latestLoaded || saved.draft === null || saved.saved === null)
    return "Open Portfolio and load its latest saved version first.";
  if (
    saved.phase !== "idle" ||
    saved.conflict ||
    saved.uncertain ||
    saved.replayPending ||
    saved.baseVersion === null ||
    saved.baseVersion !== saved.saved.version
  )
    return "Finish the Portfolio save or recovery and load its latest version first.";
  if (portfolio.pendingEditor || portfolio.review || portfolio.reviewing)
    return "Apply or reset the Portfolio form and finish its identity review first.";
  if (workspace.portfolio.hasDraftFileActivity())
    return "Finish or cancel the Portfolio file operation first.";
  if (saved.draft.ledger === null)
    return "Set up Portfolio before selecting its held companies.";
  if (!workspace.portfolio.canEdit() || !workspace.portfolio.canSavePayload())
    return "Review Portfolio identities against the current catalog and correct its ledger first.";
  return null;
}

export function portfolioScreenContextIssue(context: Context) {
  const { view, session, screen, portfolio, saved } = context;
  if (
    session.phase !== "active" ||
    !context.route?.() ||
    !context.routeActive()
  )
    return "Return to Discover in an active session before using Portfolio companies.";
  const issue = portfolioIssue(context);
  if (issue) return issue;
  if (
    !view.snapshot ||
    portfolio.catalogSnapshotSha256 !== view.snapshot.snapshotSha256 ||
    saved.draft?.ledger?.snapshotSha256 !== view.snapshot.snapshotSha256
  )
    return "Review Portfolio against the current catalog first.";
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
