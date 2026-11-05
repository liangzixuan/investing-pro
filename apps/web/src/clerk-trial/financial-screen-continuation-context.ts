import { FinancialScreenContinuationController } from "./financial-screen-continuation-controller";
import type { ManagedWorkspace } from "./managed-workspace";

/** Missing-read authority follows the current Discover visit and Watchlist handoff. */
export function createWorkspaceScreenContinuation(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
) {
  const controller = new FinancialScreenContinuationController(
    workspace.financialScreen,
    {
      captureOwner: () => {
        const route = workspace.captureWatchlistScreenRoute();
        const session = workspace.sessionOwner.getSnapshot();
        const saved = workspace.coordinator.getSnapshot();
        const files = workspace.getWatchlistDraftFileActivityRevision();
        let retired = false;
        const isCurrent = () => {
          if (
            !route?.() ||
            !routeActive() ||
            session.phase !== "active" ||
            workspace.sessionOwner.getSnapshot() !== session ||
            workspace.coordinator.getSnapshot() !== saved ||
            workspace.getWatchlistDraftFileActivityRevision() !== files ||
            workspace.hasWatchlistDraftFileActivity() ||
            saved.phase !== "idle" ||
            saved.uncertain ||
            saved.conflict ||
            saved.replayPending
          )
            retired = true;
          return !retired;
        };
        return isCurrent() ? { isCurrent } : null;
      },
    },
  );
  const reconcile = () => controller.reconcile();
  const subscriptions = [
    workspace.subscribe(reconcile),
    workspace.sessionOwner.subscribe(reconcile),
    workspace.coordinator.subscribe(reconcile),
  ];
  return {
    controller,
    dispose: () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      controller.retire();
    },
  };
}
