import type { ManagedWorkspace } from "./managed-workspace";
import {
  prepareDueCheckEvidenceReport,
  dueCheckEvidenceReportReady,
} from "./due-check-evidence-report";
import type { DueCheckEvidenceReportSource } from "./due-check-evidence-report-controller";
import {
  captureFollowupsReportContext,
  sameFollowupsReportContext,
} from "./managed-followups-review-report-admission";

/** One route-owned source. Existing review/evidence/resource owners remain authoritative. */
export function createManagedDueCheckEvidenceReportSource(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
  now: () => Date = () => new Date(),
) {
  let disposed = false;
  let reading = false;
  let generation = 0;
  const listeners = new Set<() => void>();
  const read = () => {
    if (disposed || reading) return null;
    reading = true;
    const revision = generation;
    try {
      const context = captureFollowupsReportContext(workspace, routeActive);
      const review = workspace.followupsReview.getSnapshot();
      const evidence = workspace.reviewEvidence.getSnapshot();
      if (
        revision !== generation ||
        disposed ||
        !context ||
        !dueCheckEvidenceReportReady(review, evidence, context)
      )
        return null;
      return {
        context,
        review,
        evidence,
        file: workspace.followups.getDraftFileActivityRevision(),
      };
    } finally {
      reading = false;
    }
  };
  type State = NonNullable<ReturnType<typeof read>>;
  const same = (a: State | null, b: State | null) =>
    !!a &&
    !!b &&
    a.review === b.review &&
    a.evidence === b.evidence &&
    a.file === b.file &&
    sameFollowupsReportContext(a.context, b.context);
  let state = read();
  const reconcile = () => {
    const next = read();
    if (same(state, next) || (state === null && next === null)) return;
    state = next;
    const revision = ++generation;
    for (const listener of listeners) {
      if (revision !== generation) break;
      listener();
    }
  };
  const unsubscribe = [
    workspace,
    workspace.followups,
    workspace.followups.coordinator,
    workspace.sessionOwner,
    workspace.followupsReview,
    workspace.reviewEvidence,
  ].map((owner) => owner.subscribe(reconcile));
  const source: DueCheckEvidenceReportSource = {
    capture: () => {
      reconcile();
      const captured = state,
        revision = generation;
      if (!captured) return null;
      let valid = true;
      const current = () => {
        if (!valid) return false;
        reconcile();
        valid = !disposed && revision === generation && same(captured, state);
        return valid;
      };
      let report;
      try {
        report = prepareDueCheckEvidenceReport(
          captured.review,
          captured.evidence,
          captured.context,
          now().toISOString(),
        );
      } catch {
        return null;
      }
      if (!report || !current()) return null;
      return Object.freeze({ report, current });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    ...source,
    reconcile,
    canCapture: () => {
      reconcile();
      return state !== null;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      state = null;
      ++generation;
      unsubscribe.forEach((stop) => stop());
      for (const listener of listeners) listener();
      listeners.clear();
    },
  };
}
