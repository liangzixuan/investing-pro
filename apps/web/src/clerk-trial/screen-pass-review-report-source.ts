import type { ManagedWorkspace } from "./managed-workspace";
import type { FinancialScreenPassReviewController } from "./financial-screen-pass-review-controller";
import {
  prepareScreenPassReviewReport,
  screenPassReportReady,
} from "./screen-pass-review-report";
/** The mounted pass owner remains the only comparison owner. No source request is available here. */
export function createScreenPassReviewReportSource(
  workspace: ManagedWorkspace,
  pass: FinancialScreenPassReviewController,
  routeActive: () => boolean,
  now: () => Date = () => new Date(),
) {
  let disposed = false,
    reading = false,
    generation = 0;
  const listeners = new Set<() => void>();
  const read = () => {
    if (disposed || reading) return null;
    reading = true;
    const revision = generation;
    try {
      const review = pass.getSnapshot(),
        screen = workspace.financialScreen.getSnapshot(),
        session = workspace.sessionOwner.getSnapshot(),
        saved = workspace.coordinator.getSnapshot(),
        route = workspace.captureWatchlistScreenRoute();
      if (
        !screenPassReportReady(review) ||
        screen.run !== review.result ||
        screen.pending ||
        screen.criteriaStaged ||
        !screen.active ||
        screen.catalogChanged ||
        !screen.catalogSnapshotSha256 ||
        screen.criteriaRevision !== review.result!.criteriaRevision ||
        screen.selectionRevision !== review.result!.selectionRevision ||
        !route ||
        !routeActive() ||
        session.phase !== "active" ||
        saved.phase !== "idle" ||
        saved.uncertain ||
        saved.conflict ||
        saved.replayPending ||
        workspace.hasWatchlistDraftFileActivity()
      )
        return null;
      const files = workspace.getWatchlistDraftFileActivityRevision();
      return !disposed && revision === generation
        ? {
            review,
            session,
            saved,
            route,
            catalog: screen.catalogSnapshotSha256,
            files,
          }
        : null;
    } finally {
      reading = false;
    }
  };
  type Reading = NonNullable<ReturnType<typeof read>>;
  const same = (a: Reading | null, b: Reading | null) =>
    !!a &&
    !!b &&
    a.review === b.review &&
    a.session === b.session &&
    a.saved === b.saved &&
    a.catalog === b.catalog &&
    a.files === b.files &&
    a.route();
  let state = read();
  const reconcile = () => {
    const before = generation,
      next = read();
    const equal = same(state, next) || (!state && !next);
    if (disposed || before !== generation || equal) return;
    state = next;
    const revision = ++generation;
    for (const listener of listeners) {
      if (revision !== generation) break;
      listener();
    }
  };
  const stops = [
    workspace,
    workspace.financialScreen,
    pass,
    workspace.coordinator,
    workspace.sessionOwner,
  ].map((owner) => owner.subscribe(reconcile));
  return {
    capture: () => {
      reconcile();
      const captured = state,
        revision = generation;
      if (!captured) return null;
      let valid = true;
      const current = () => {
        if (!valid) return false;
        reconcile();
        const equal = same(captured, state);
        valid = !disposed && generation === revision && equal;
        return valid;
      };
      let report;
      try {
        report = prepareScreenPassReviewReport(
          captured.review,
          captured.catalog,
          now().toISOString(),
        );
      } catch {
        return null;
      }
      return report && current() ? Object.freeze({ report, current }) : null;
    },
    canCapture: () => {
      reconcile();
      return state !== null;
    },
    reconcile,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      state = null;
      ++generation;
      stops.forEach((stop) => stop());
      for (const listener of listeners) listener();
      listeners.clear();
    },
  };
}
