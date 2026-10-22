import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import type {
  ManagedFinancialScreenResultRow,
  ManagedFinancialScreenState,
} from "./managed-financial-screen";
import type { ManagedSessionState } from "./managed-session-owner";
import type {
  ManagedDiscoveryState,
  ManagedWorkspace,
} from "./managed-workspace";
import type { SaveState } from "./save-coordinator";

export interface ScreenShortlistContext {
  readonly workspace: ManagedWorkspace;
  readonly view: ManagedDiscoveryState;
  readonly screen: ManagedFinancialScreenState;
  readonly saved: SaveState<MainWatchlistPayload>;
  readonly session: Readonly<ManagedSessionState>;
}
export function captureScreenShortlistContext(
  workspace: ManagedWorkspace,
): ScreenShortlistContext {
  return {
    workspace,
    view: workspace.getSnapshot(),
    screen: workspace.financialScreen.getSnapshot(),
    saved: workspace.coordinator.getSnapshot(),
    session: workspace.sessionOwner.getSnapshot(),
  };
}
function catalogOperationIssue({
  view,
}: ScreenShortlistContext): string | null {
  const message =
    "Finish the catalog operation before reviewing the shortlist.";
  if (view.read) return message;
  if (view.review) return message;
  if (view.reviewing) return message;
  return null;
}
function routeIssue(context: ScreenShortlistContext): string | null {
  const { workspace, view, session } = context;
  if (session.phase !== "active")
    return "Start an active session before reviewing the shortlist.";
  if (view.view !== "discover")
    return "Return to the financial screen before reviewing the shortlist.";
  if (view.research || view.companyRoute)
    return "Close company research before reviewing the shortlist.";
  if (!workspace.canNavigate())
    return "Finish the current editor before reviewing the shortlist.";
  return catalogOperationIssue(context);
}
function loadedBaselineIssue({ saved }: ScreenShortlistContext): string | null {
  if (!saved.latestLoaded)
    return "Load the latest Watchlist before reviewing the shortlist.";
  if (saved.baseVersion !== saved.saved?.version)
    return "Load the latest Watchlist before reviewing the shortlist.";
  if (!saved.draft) return "Load My Watchlist before reviewing the shortlist.";
  return null;
}
function saveIssue(context: ScreenShortlistContext): string | null {
  const { workspace, saved } = context;
  if (!workspace.canEdit())
    return "Resolve the current Watchlist operation before reviewing the shortlist.";
  if (saved.phase !== "idle")
    return "Wait for the Watchlist operation to finish.";
  if (saved.uncertain || saved.replayPending)
    return "Reconcile the pending Watchlist save before reviewing the shortlist.";
  return loadedBaselineIssue(context);
}
function catalogBindingIssue({
  view,
  screen,
  saved,
}: ScreenShortlistContext): string | null {
  const digest = view.snapshot!.snapshotSha256;
  if (saved.draft?.snapshotSha256 !== digest)
    return "Review catalog changes in My Watchlist before adding the shortlist.";
  if (screen.catalogSnapshotSha256 !== digest)
    return "Refresh the financial screen against the current catalog.";
  return null;
}
function catalogIssue(context: ScreenShortlistContext): string | null {
  if (!context.view.snapshot)
    return "Refresh the catalog before reviewing the shortlist.";
  if (context.workspace.watchlistFileCatalogReviewRequired())
    return "Review the imported Watchlist catalog before adding the shortlist.";
  return catalogBindingIssue(context);
}
function reportRowIssue(
  context: ScreenShortlistContext,
  row: ManagedFinancialScreenResultRow,
): string | null {
  const response = row.report?.response;
  if (!response) return "Run the screen again before reviewing the shortlist.";
  if (
    !context.workspace.financialScreen.canAdmitReport({
      run: context.screen.run!,
      row,
      response,
    })
  )
    return "Run the screen again with the current criteria and catalog before reviewing the shortlist.";
  return null;
}
function reportIssue(context: ScreenShortlistContext): string | null {
  const { screen } = context;
  if (!screen.run || screen.shortlist.length === 0)
    return "Shortlist at least one screened company first.";
  for (const row of screen.shortlist) {
    const issue = reportRowIssue(context, row);
    if (issue) return issue;
  }
  return null;
}
export function screenShortlistContextIssue(
  context: ScreenShortlistContext,
): string | null {
  return (
    routeIssue(context) ??
    saveIssue(context) ??
    catalogIssue(context) ??
    reportIssue(context)
  );
}
export function isScreenShortlistContextCurrent(
  workspace: ManagedWorkspace,
  context: ScreenShortlistContext,
): boolean {
  if (workspace !== context.workspace) return false;
  if (workspace.getSnapshot() !== context.view) return false;
  if (workspace.financialScreen.getSnapshot() !== context.screen) return false;
  if (workspace.coordinator.getSnapshot() !== context.saved) return false;
  return workspace.sessionOwner.getSnapshot() === context.session;
}
