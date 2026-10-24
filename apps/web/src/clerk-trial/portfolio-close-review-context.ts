import type { ManagedWorkspace } from "./managed-workspace";
import type { PortfolioCloseContext } from "./managed-portfolio-close-review";

function captureFrame(workspace: ManagedWorkspace) {
  return {
    view: workspace.getSnapshot(),
    session: workspace.sessionOwner.getSnapshot(),
    portfolio: workspace.portfolio.getSnapshot(),
    saved: workspace.portfolio.coordinator.getSnapshot(),
  };
}
function sameFrame(
  workspace: ManagedWorkspace,
  frame: ReturnType<typeof captureFrame>,
) {
  return (
    workspace.getSnapshot() === frame.view &&
    workspace.sessionOwner.getSnapshot() === frame.session &&
    workspace.portfolio.getSnapshot() === frame.portfolio &&
    workspace.portfolio.coordinator.getSnapshot() === frame.saved
  );
}
function readyFrame(frame: ReturnType<typeof captureFrame>) {
  if (frame.session.phase !== "active") return false;
  if (frame.portfolio.pendingEditor) return false;
  if (frame.portfolio.reviewing) return false;
  return !frame.portfolio.review;
}
function captureLedger(workspace: ManagedWorkspace) {
  const file = workspace.portfolio.getDraftFileContext();
  if (!file?.draft.ledger) return null;
  const ledger = file.draft.ledger;
  const projection = workspace.portfolio.getProjection();
  if (!ledger || projection?.status !== "valid") return null;
  if (!workspace.portfolio.canSavePayload()) return null;
  return { ledger, portfolio: projection.portfolio };
}
/** Readiness is independent of Watchlist; the ledger must have current identity approval. */
export function capturePortfolioCloseContext(
  workspace: ManagedWorkspace,
): PortfolioCloseContext | null {
  const frame = captureFrame(workspace);
  const route = workspace.capturePortfolioWatchlistRoute();
  if (!route || !readyFrame(frame)) return null;
  const admitted = captureLedger(workspace);
  if (!admitted) return null;
  const current = () =>
    route() &&
    sameFrame(workspace, frame) &&
    workspace.portfolio.canSavePayload();
  return current() ? Object.freeze({ ...admitted, current }) : null;
}
