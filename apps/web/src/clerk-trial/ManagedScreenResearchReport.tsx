import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { ManagedScreenResearchReview } from "./managed-screen-research-review";
import {
  ScreenResearchReportController,
  type ScreenResearchReportSource,
} from "./screen-research-report-controller";
import { formatScreenResearchReportHtml } from "./screen-research-report-html";
import type { ScreenResearchReportDeliveryAdapter } from "./screen-research-report-ports";
import { ScreenResearchReportSnapshot } from "./ScreenResearchReportSnapshot";

export function createScreenResearchReportSource(
  model: ManagedScreenResearchReview,
  routeActive: () => boolean,
): ScreenResearchReportSource {
  return {
    subscribe: model.subscribe,
    capture: () => {
      if (!routeActive()) return null;
      const capture = model.captureReport(model.getSnapshot());
      if (!capture) return null;
      let valid = true;
      return {
        report: capture.report,
        current: () => {
          if (!valid) return false;
          valid = routeActive() && capture.current();
          return valid;
        },
      };
    },
  };
}
const empty = Object.freeze({ report: null, saving: false, message: "" });
const emptyStore = { getSnapshot: () => empty, subscribe: () => () => {} };
export function ManagedScreenResearchReport({
  model,
  delivery,
  routeActive,
}: {
  readonly model: ManagedScreenResearchReview;
  readonly delivery: ScreenResearchReportDeliveryAdapter | undefined;
  readonly routeActive: () => boolean;
}) {
  const [controller, setController] =
    useState<ScreenResearchReportController | null>(null);
  useLayoutEffect(() => {
    const next = new ScreenResearchReportController(
      createScreenResearchReportSource(model, routeActive),
      delivery,
      formatScreenResearchReportHtml,
    );
    setController(next);
    return () => next.dispose();
  }, [model, delivery, routeActive]);
  useLayoutEffect(() => {
    controller?.reconcile();
  });
  const store = controller ?? emptyStore;
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const review = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  if (!review.reading) return null;
  return (
    <section aria-labelledby="managed-screen-research-report-heading">
      <h3 id="managed-screen-research-report-heading">Keep paired research</h3>
      <p>
        Prepare both retained company readings for a private offline report.
        Recapture a company first if its later thesis edits should be included.
      </p>
      <button
        id="managed-screen-research-report-prepare"
        disabled={
          !controller ||
          state.saving ||
          !review.reading?.left ||
          !review.reading.right ||
          !routeActive()
        }
        onClick={() => controller?.prepare()}
      >
        Prepare paired research report
      </button>
      {state.report && (
        <>
          <details>
            <summary>Preview complete paired research report</summary>
            <ScreenResearchReportSnapshot report={state.report} />
          </details>
          {delivery && (
            <button
              id="managed-screen-research-report-save"
              disabled={state.saving}
              onClick={() => {
                void controller?.save();
              }}
            >
              {delivery.actionLabel ?? "Save paired research (HTML)"}
            </button>
          )}
          {state.saving && (
            <button onClick={() => controller?.cancel()}>
              Cancel report save
            </button>
          )}
          <button onClick={() => controller?.close()}>
            Clear report preview
          </button>
        </>
      )}
      <p role="status" aria-live="polite">
        {state.message}
      </p>
    </section>
  );
}
