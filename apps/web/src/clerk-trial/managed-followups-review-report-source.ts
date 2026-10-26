import type { ManagedWorkspace } from "./managed-workspace";
import {
  prepareFollowupsReviewReport,
  type PreparedFollowupsReviewReport,
} from "./followups-review-report";
import type { FollowupsReviewReportSource } from "./followups-review-report-controller";
import {
  captureFollowupsReportContext,
  sameFollowupsReportContext,
  type FollowupsReportContext,
} from "./managed-followups-review-report-admission";

interface CaptureLifetime {
  readonly context: FollowupsReportContext;
  retired: boolean;
}
/** Captures latch retirement even when the original resource values return. */
class FollowupsReportCaptures {
  private readonly captures = new Set<CaptureLifetime>();
  constructor(
    private readonly readContext: () => FollowupsReportContext | null,
  ) {}
  private retire(capture: CaptureLifetime) {
    capture.retired = true;
    this.captures.delete(capture);
  }
  private current(capture: CaptureLifetime) {
    if (capture.retired) return false;
    if (!sameFollowupsReportContext(capture.context, this.readContext()))
      this.retire(capture);
    return !capture.retired;
  }
  admit(
    report: PreparedFollowupsReviewReport,
    context: FollowupsReportContext,
  ) {
    const capture = { context, retired: false };
    this.captures.add(capture);
    return Object.freeze({ report, current: () => this.current(capture) });
  }
  reconcile() {
    const context = this.readContext();
    for (const capture of this.captures) {
      if (!sameFollowupsReportContext(capture.context, context))
        this.retire(capture);
    }
  }
  dispose() {
    for (const capture of this.captures) this.retire(capture);
  }
}
export function createManagedFollowupsReviewReportSource(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
) {
  let disposed = false;
  const listeners = new Set<() => void>();
  const readContext = () =>
    disposed ? null : captureFollowupsReportContext(workspace, routeActive);
  const captures = new FollowupsReportCaptures(readContext);
  const reconcile = () => {
    if (disposed) return;
    captures.reconcile();
    for (const listener of listeners) listener();
  };
  const unsubscribers = [
    workspace,
    workspace.followups,
    workspace.followups.coordinator,
    workspace.sessionOwner,
  ].map((resource) => resource.subscribe(reconcile));
  const source: FollowupsReviewReportSource = {
    capture: () => {
      const context = readContext();
      if (!context) return null;
      const report = prepareFollowupsReviewReport({
        capturedAt: new Date().toISOString(),
        draft: context.draft,
        baseVersion: context.baseVersion,
        dirty: context.saveState.dirty,
        currentCatalogSnapshotSha256: context.catalog,
      });
      if (!report) return null;
      if (!sameFollowupsReportContext(context, readContext())) return null;
      return captures.admit(report, context);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    ...source,
    canCapture: () => readContext() !== null,
    reconcile,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      captures.dispose();
      for (const unsubscribe of unsubscribers) unsubscribe();
      listeners.clear();
    },
  };
}
