import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";

export interface PortfolioWatchlistProps {
  readonly workspace: ManagedWorkspace;
  readonly navigationPending: boolean;
  readonly routeActive: () => boolean;
  readonly onReviewWatchlist: () => void;
}
export function usePortfolioWatchlistFrame(workspace: ManagedWorkspace) {
  const discovery = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const portfolio = useSyncExternalStore(
    workspace.portfolio.subscribe,
    workspace.portfolio.getSnapshot,
    workspace.portfolio.getSnapshot,
  );
  const ledger = useSyncExternalStore(
    workspace.portfolio.coordinator.subscribe,
    workspace.portfolio.coordinator.getSnapshot,
    workspace.portfolio.coordinator.getSnapshot,
  );
  const watchlist = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
    workspace.coordinator.getSnapshot,
  );
  const session = useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
    workspace.sessionOwner.getSnapshot,
  );
  return {
    workspace,
    discovery,
    portfolio,
    ledger,
    watchlist,
    session,
    route: workspace.capturePortfolioWatchlistRoute(),
  };
}
export type PortfolioWatchlistFrame = ReturnType<
  typeof usePortfolioWatchlistFrame
>;

/** The select and navigation controls share the current Portfolio form lock. */
export function portfolioHoldingControlsBlocked(
  frame: PortfolioWatchlistFrame,
  props: PortfolioWatchlistProps,
) {
  if (props.navigationPending) return true;
  if (frame.portfolio.pendingEditor) return true;
  return frame.portfolio.reviewing;
}
function routeOwnerCurrent(
  frame: PortfolioWatchlistFrame,
  props: PortfolioWatchlistProps,
) {
  if (!props.routeActive()) return false;
  if (frame.route?.() !== true) return false;
  return frame.workspace === props.workspace;
}
function snapshotsCurrent(frame: PortfolioWatchlistFrame) {
  const w = frame.workspace;
  if (w.getSnapshot() !== frame.discovery) return false;
  if (w.portfolio.getSnapshot() !== frame.portfolio) return false;
  if (w.portfolio.coordinator.getSnapshot() !== frame.ledger) return false;
  return w.sessionOwner.getSnapshot() === frame.session;
}
/** A successful local append may change Watchlist; source and route must stay captured. */
export function portfolioWatchlistSourceCurrent(
  frame: PortfolioWatchlistFrame,
  props: PortfolioWatchlistProps,
) {
  if (portfolioHoldingControlsBlocked(frame, props)) return false;
  if (frame.portfolio.review) return false;
  if (!routeOwnerCurrent(frame, props)) return false;
  return snapshotsCurrent(frame);
}
