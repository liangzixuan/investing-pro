import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  isPreparedScreenResearchReport,
  type ManagedScreenResearchReview,
  type PreparedScreenResearchReport,
} from "./managed-screen-research-review";
import {
  OwnedReportController,
  type OwnedReportMessages,
  type OwnedReportSource,
} from "./owned-report-controller";
import { formatScreenResearchReportHtml } from "./screen-research-report-html";
import type {
  ScreenResearchReportDeliveryAdapter,
  ScreenResearchReportHtmlDocument,
} from "./screen-research-report-ports";
import { ScreenResearchReportSnapshot } from "./ScreenResearchReportSnapshot";

export const screenResearchReportMessages: OwnedReportMessages = Object.freeze({
  withdrawn:
    "The captured paired research is no longer current. Capture it again after review.",
  captureUnavailable:
    "The complete paired research could not be captured. Review the current loaded pair and its admission and complete-size limits; nothing was clipped.",
  prepared: "Captured for review. No source request or online Save was made.",
  cancelled: "Paired research report save cancelled.",
  formatUnavailable: "Complete paired research report unavailable.",
  preparing: "Preparing the complete paired research HTML report…",
  saveFailed:
    "The complete paired research report could not be saved. No draft was changed.",
  written: "Paired research report written to the chosen document.",
  downloadRequested:
    "Paired research report download requested. Check the browser destination.",
});

export function createScreenResearchReportSource(
  model: ManagedScreenResearchReview,
  routeActive: () => boolean,
): OwnedReportSource<PreparedScreenResearchReport> {
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
  const [controller, setController] = useState<OwnedReportController<
    PreparedScreenResearchReport,
    ScreenResearchReportHtmlDocument
  > | null>(null);
  useLayoutEffect(() => {
    const next = new OwnedReportController(
      createScreenResearchReportSource(model, routeActive),
      delivery,
      {
        admit: isPreparedScreenResearchReport,
        format: formatScreenResearchReportHtml,
        messages: screenResearchReportMessages,
      },
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
