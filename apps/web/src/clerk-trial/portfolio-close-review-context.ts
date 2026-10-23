import type { ManagedWorkspace } from "./managed-workspace";
import type { PortfolioCloseContext } from "./managed-portfolio-close-review";

/** Readiness is independent of Watchlist; the ledger must have current identity approval. */
export function capturePortfolioCloseContext(
  workspace: ManagedWorkspace,
): PortfolioCloseContext | null {
  const view = workspace.getSnapshot();
  const session = workspace.sessionOwner.getSnapshot();
  const portfolio = workspace.portfolio.getSnapshot();
  const saved = workspace.portfolio.coordinator.getSnapshot();
  const route = workspace.capturePortfolioWatchlistRoute();
  const file = workspace.portfolio.getDraftFileContext();
  const projection = workspace.portfolio.getProjection();
  if (
    !route ||
    session.phase !== "active" ||
    portfolio.pendingEditor ||
    portfolio.reviewing ||
    portfolio.review ||
    !file?.draft.ledger
  )
    return null;
  const ledger = file.draft.ledger;
  if (
    !ledger ||
    projection?.status !== "valid" ||
    !workspace.portfolio.canSavePayload()
  )
    return null;
  const current = () =>
    route() &&
    workspace.getSnapshot() === view &&
    workspace.sessionOwner.getSnapshot() === session &&
    workspace.portfolio.getSnapshot() === portfolio &&
    workspace.portfolio.coordinator.getSnapshot() === saved &&
    workspace.portfolio.canSavePayload();
  return current()
    ? Object.freeze({ ledger, portfolio: projection.portfolio, current })
    : null;
}
