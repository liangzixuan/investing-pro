import type { ManagedWorkspace } from "./managed-workspace";
import { prepareFollowupsReviewReport } from "./followups-review-report";
import type {
  FollowupsReviewReportCapture,
  FollowupsReviewReportSource,
} from "./followups-review-report-controller";

function reportContext(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
) {
  if (!routeActive()) return null;
  const session = workspace.sessionOwner.getSnapshot();
  if (session.phase !== "active") return null;
  const view = workspace.getSnapshot();
  if (
    view.view !== "followups" ||
    view.research ||
    view.companyRoute ||
    view.followupOpening ||
    view.read ||
    view.reviewing ||
    view.review
  )
    return null;
  if (workspace.followups.hasDraftFileActivity()) return null;
  const context = workspace.followups.getDraftFileContext(false);
  const saved = workspace.followups.coordinator.getSnapshot();
  if (
    !context ||
    !saved.latestLoaded ||
    !saved.saved ||
    saved.baseVersion !== saved.saved.version ||
    saved.phase !== "idle" ||
    saved.conflict ||
    saved.uncertain ||
    saved.replayPending
  )
    return null;
  return {
    ...context,
    saveState: saved,
    catalogSnapshot: view.snapshot,
    session,
  };
}
type Context = NonNullable<ReturnType<typeof reportContext>>;
function sameContext(before: Context, after: Context | null) {
  return (
    after !== null &&
    before.saveState === after.saveState &&
    before.saved === after.saved &&
    before.draft === after.draft &&
    before.baseVersion === after.baseVersion &&
    before.catalog === after.catalog &&
    before.catalogSnapshot === after.catalogSnapshot &&
    before.session === after.session
  );
}

/** Capture capabilities latch retirement, including changes that later restore old values. */
export function createManagedFollowupsReviewReportSource(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
) {
  let disposed = false;
  const listeners = new Set<() => void>();
  const captures = new Set<{ context: Context; retired: boolean }>();
  const currentContext = () =>
    disposed ? null : reportContext(workspace, routeActive);
  const reconcile = () => {
    if (disposed) return;
    const context = currentContext();
    for (const capture of captures) {
      if (sameContext(capture.context, context)) continue;
      capture.retired = true;
      captures.delete(capture);
    }
    for (const listener of listeners) listener();
  };
  const unsubscribers = [
    workspace,
    workspace.followups,
    workspace.followups.coordinator,
    workspace.sessionOwner,
  ].map((resource) => resource.subscribe(reconcile));
  const source: FollowupsReviewReportSource = {
    capture: (): FollowupsReviewReportCapture | null => {
      const context = currentContext();
      if (!context) return null;
      const report = prepareFollowupsReviewReport({
        capturedAt: new Date().toISOString(),
        draft: context.draft,
        baseVersion: context.baseVersion,
        dirty: context.saveState.dirty,
        currentCatalogSnapshotSha256: context.catalog,
      });
      if (!report || !sameContext(context, currentContext())) return null;
      const capture = { context, retired: false };
      captures.add(capture);
      return Object.freeze({
        report,
        current: () => {
          if (!capture.retired && !sameContext(context, currentContext())) {
            capture.retired = true;
            captures.delete(capture);
          }
          return !capture.retired;
        },
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    ...source,
    canCapture: () => currentContext() !== null,
    reconcile,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const capture of captures) capture.retired = true;
      captures.clear();
      for (const unsubscribe of unsubscribers) unsubscribe();
      listeners.clear();
    },
  };
}
