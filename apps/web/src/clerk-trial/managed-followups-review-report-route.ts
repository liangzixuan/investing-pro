import type {
  ManagedWorkspace,
  ManagedDiscoveryState,
} from "./managed-workspace";
import type { ManagedSessionState } from "./managed-session-owner";

export interface FollowupsReportRoute {
  readonly session: Readonly<ManagedSessionState>;
  readonly catalogSnapshot: ManagedDiscoveryState["snapshot"];
}
function activeSession(workspace: ManagedWorkspace) {
  const session = workspace.sessionOwner.getSnapshot();
  return session.phase === "active" ? session : null;
}
function followupsViewOpen(view: ManagedDiscoveryState) {
  if (view.view !== "followups") return false;
  if (view.research) return false;
  if (view.companyRoute) return false;
  return !view.followupOpening;
}
function catalogIdle(view: ManagedDiscoveryState) {
  if (view.read) return false;
  if (view.reviewing) return false;
  return !view.review;
}
export function captureFollowupsReportRoute(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
): FollowupsReportRoute | null {
  if (!routeActive()) return null;
  const session = activeSession(workspace);
  if (!session) return null;
  const view = workspace.getSnapshot();
  if (!followupsViewOpen(view)) return null;
  if (!catalogIdle(view)) return null;
  return { session, catalogSnapshot: view.snapshot };
}
export function sameFollowupsReportRoute(
  before: FollowupsReportRoute,
  after: FollowupsReportRoute,
) {
  return (
    before.catalogSnapshot === after.catalogSnapshot &&
    before.session === after.session
  );
}
