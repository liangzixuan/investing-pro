import type { ManagedWorkspace } from "./managed-workspace";
import type { SaveState } from "./save-coordinator";

export interface PortfolioWatchlistContext {
  readonly workspace: ManagedWorkspace;
  readonly view: ReturnType<ManagedWorkspace["getSnapshot"]>;
  readonly session: ReturnType<ManagedWorkspace["sessionOwner"]["getSnapshot"]>;
  readonly portfolio: ReturnType<ManagedWorkspace["portfolio"]["getSnapshot"]>;
  readonly ledger: ReturnType<
    ManagedWorkspace["portfolio"]["coordinator"]["getSnapshot"]
  >;
  readonly watchlist: ReturnType<
    ManagedWorkspace["coordinator"]["getSnapshot"]
  >;
  readonly routeCurrent: (() => boolean) | null;
}

export function capturePortfolioWatchlistContext(
  workspace: ManagedWorkspace,
): PortfolioWatchlistContext {
  return {
    workspace,
    view: workspace.getSnapshot(),
    session: workspace.sessionOwner.getSnapshot(),
    portfolio: workspace.portfolio.getSnapshot(),
    ledger: workspace.portfolio.coordinator.getSnapshot(),
    watchlist: workspace.coordinator.getSnapshot(),
    routeCurrent: workspace.capturePortfolioWatchlistRoute(),
  };
}
function visitUnchanged(context: PortfolioWatchlistContext) {
  const { workspace, view, session } = context;
  if (workspace.getSnapshot() !== view) return false;
  if (workspace.sessionOwner.getSnapshot() !== session) return false;
  return context.routeCurrent?.() === true;
}
function resourcesUnchanged(context: PortfolioWatchlistContext) {
  const { workspace, portfolio, ledger, watchlist } = context;
  if (workspace.portfolio.getSnapshot() !== portfolio) return false;
  if (workspace.portfolio.coordinator.getSnapshot() !== ledger) return false;
  return workspace.coordinator.getSnapshot() === watchlist;
}
export function isPortfolioWatchlistContextCurrent(
  workspace: ManagedWorkspace,
  context: PortfolioWatchlistContext,
) {
  if (workspace !== context.workspace) return false;
  if (!visitUnchanged(context)) return false;
  return resourcesUnchanged(context);
}
function recoveryClear(state: SaveState<unknown>) {
  return !state.conflict && !state.uncertain && !state.replayPending;
}
function loadedBaseline(state: SaveState<unknown>) {
  if (!state.latestLoaded) return false;
  if (state.draft === null) return false;
  if (state.saved === null) return false;
  if (state.baseVersion === null) return false;
  return state.baseVersion === state.saved.version;
}
function fresh(state: SaveState<unknown>) {
  if (state.phase !== "idle") return false;
  if (!recoveryClear(state)) return false;
  return loadedBaseline(state);
}
const returnToPortfolio =
  "Finish the current operation and return to Portfolio.";
function rootRouteIssue({ workspace, view }: PortfolioWatchlistContext) {
  if (view.view !== "portfolio") return returnToPortfolio;
  if (view.research || view.companyRoute) return returnToPortfolio;
  if (!workspace.canNavigate()) return returnToPortfolio;
  return null;
}
function catalogOperationIssue({ view }: PortfolioWatchlistContext) {
  if (view.read) return returnToPortfolio;
  if (view.review) return returnToPortfolio;
  if (view.reviewing) return returnToPortfolio;
  return null;
}
function routeIssue(context: PortfolioWatchlistContext) {
  const message =
    "Return to Portfolio in an active session before reviewing a holding.";
  if (context.session.phase !== "active") return message;
  if (!context.routeCurrent?.()) return message;
  return rootRouteIssue(context) ?? catalogOperationIssue(context);
}
function portfolioEditorIssue({ portfolio }: PortfolioWatchlistContext) {
  const message =
    "Apply or reset the Portfolio form and finish its identity review first.";
  if (portfolio.pendingEditor) return message;
  if (portfolio.reviewing) return message;
  if (portfolio.review) return message;
  return null;
}
function portfolioSaveIssue({ ledger }: PortfolioWatchlistContext) {
  if (!fresh(ledger))
    return "Load the latest Portfolio and resolve any pending save or conflict first.";
  return null;
}
function watchlistSaveIssue({
  workspace,
  watchlist,
}: PortfolioWatchlistContext) {
  const message =
    "Open My Watchlist, load its latest version and resolve any pending save or conflict first.";
  if (!fresh(watchlist)) return message;
  if (!workspace.canEdit()) return message;
  return null;
}
function resourceIssue(context: PortfolioWatchlistContext) {
  return (
    portfolioEditorIssue(context) ??
    portfolioSaveIssue(context) ??
    watchlistSaveIssue(context)
  );
}
const catalogMessage =
  "Review Portfolio and Watchlist against the current catalog first.";
function portfolioCatalogIssue(
  context: PortfolioWatchlistContext,
  digest: string,
) {
  if (context.portfolio.catalogSnapshotSha256 !== digest) return catalogMessage;
  if (context.ledger.draft?.ledger?.snapshotSha256 !== digest)
    return catalogMessage;
  return null;
}
function watchlistCatalogIssue(
  context: PortfolioWatchlistContext,
  digest: string,
) {
  if (context.watchlist.draft?.snapshotSha256 !== digest) return catalogMessage;
  if (context.workspace.watchlistFileCatalogReviewRequired())
    return catalogMessage;
  return null;
}
function catalogIssue(context: PortfolioWatchlistContext) {
  const digest = context.view.snapshot?.snapshotSha256;
  if (!digest) return catalogMessage;
  return (
    portfolioCatalogIssue(context, digest) ??
    watchlistCatalogIssue(context, digest)
  );
}
function ledgerApprovalIssue({ workspace }: PortfolioWatchlistContext) {
  if (!workspace.portfolio.canSavePayload())
    return "Review and apply Portfolio identities against the current catalog, and correct its ledger before adding a holding.";
  return null;
}

/** Current route, saved-resource and catalog readiness are separate admission decisions. */
export function portfolioWatchlistContextIssue(
  context: PortfolioWatchlistContext,
): string | null {
  return (
    routeIssue(context) ??
    resourceIssue(context) ??
    catalogIssue(context) ??
    ledgerApprovalIssue(context)
  );
}
