import type { ManagedWorkspace } from "./managed-workspace";

/** Read a chosen local file without requiring a loaded price capture. */
export function capturePortfolioReportReadScope(workspace: ManagedWorkspace) {
  const route = workspace.capturePortfolioWatchlistRoute();
  const session = workspace.sessionOwner.getSnapshot();
  const view = workspace.getSnapshot();
  const portfolio = workspace.portfolio.getSnapshot();
  const saved = workspace.portfolio.coordinator.getSnapshot();
  return () =>
    session.phase === "active" &&
    workspace.sessionOwner.getSnapshot() === session &&
    workspace.getSnapshot() === view &&
    workspace.portfolio.getSnapshot() === portfolio &&
    workspace.portfolio.coordinator.getSnapshot() === saved &&
    route?.() === true;
}
