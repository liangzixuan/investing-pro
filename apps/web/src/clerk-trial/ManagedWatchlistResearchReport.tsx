import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  isPreparedWatchlistResearchReport,
  type ManagedWatchlistResearchPair,
  type PreparedWatchlistResearchReport,
} from "./managed-watchlist-research-pair";
import {
  OwnedReportController,
  type OwnedReportSource,
} from "./owned-report-controller";
import { formatWatchlistResearchReportHtml } from "./watchlist-research-report-html";
import type {
  WatchlistResearchReportDeliveryAdapter,
  WatchlistResearchReportHtmlDocument,
} from "./watchlist-research-report-ports";
import { WatchlistResearchReportSnapshot } from "./WatchlistResearchReportSnapshot";

export const watchlistResearchReportMessages = Object.freeze({
  withdrawn:
    "This Watchlist research report is no longer current. Prepare it again after review.",
  captureUnavailable:
    "The complete Watchlist research could not be captured. Review both retained readings and finish pending work; nothing was clipped.",
  prepared: "Prepared for review. No source request or resource Save was made.",
  cancelled:
    "Watchlist research report save cancelled. If writing had started, the chosen document may be incomplete.",
  formatUnavailable: "Complete Watchlist research report unavailable.",
  preparing: "Preparing the complete Watchlist research HTML report…",
  saveFailed:
    "The complete Watchlist research report could not be saved. The chosen document may be incomplete. No draft was changed.",
  written: "Watchlist research report written to the chosen document.",
  downloadRequested:
    "Watchlist research report download requested. Check the browser destination.",
});

export function createWatchlistResearchReportSource(
  model: ManagedWatchlistResearchPair,
  routeActive: () => boolean,
): OwnedReportSource<PreparedWatchlistResearchReport> {
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
type Controller = OwnedReportController<
  PreparedWatchlistResearchReport,
  WatchlistResearchReportHtmlDocument
>;
const empty = Object.freeze({ report: null, saving: false, message: "" });
const emptyStore = { getSnapshot: () => empty, subscribe: () => () => {} };

export function ManagedWatchlistResearchReport({
  model,
  delivery,
  routeActive,
}: {
  readonly model: ManagedWatchlistResearchPair;
  readonly delivery: WatchlistResearchReportDeliveryAdapter | undefined;
  readonly routeActive: () => boolean;
}) {
  const route = useRef(routeActive);
  route.current = routeActive;
  const [controller, setController] = useState<Controller | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<{
    report: PreparedWatchlistResearchReport;
    opener: HTMLButtonElement;
  } | null>(null);
  useLayoutEffect(() => {
    const next = new OwnedReportController(
      createWatchlistResearchReportSource(model, () => route.current()),
      delivery,
      {
        admit: isPreparedWatchlistResearchReport,
        format: formatWatchlistResearchReportHtml,
        messages: watchlistResearchReportMessages,
      },
    );
    setController(next);
    return () => next.dispose();
  }, [model, delivery]);
  useLayoutEffect(() => {
    controller?.reconcile();
  });
  const store = controller ?? emptyStore;
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const pair = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  useLayoutEffect(() => {
    const request = pendingFocus.current;
    pendingFocus.current = null;
    const target = heading.current;
    if (
      request &&
      request.report === state.report &&
      state.report === controller?.getSnapshot().report &&
      route.current() &&
      target?.isConnected &&
      !target.closest("[hidden], [inert]") &&
      target.getClientRects().length > 0 &&
      target.ownerDocument.activeElement === request.opener
    )
      target.focus();
  }, [state.report, controller]);
  if (!pair.reading) return null;
  return (
    <section aria-labelledby="managed-watchlist-research-report-heading">
      <h3
        id="managed-watchlist-research-report-heading"
        tabIndex={-1}
        ref={heading}
      >
        Keep Watchlist research
      </h3>
      <p>
        Prepare both complete retained readings for a private offline report.
        Recapture a company first to include later thesis edits. Resource Saves
        remain separate.
      </p>
      <button
        id="managed-watchlist-research-report-prepare"
        disabled={
          !controller ||
          state.saving ||
          !pair.reading.left ||
          !pair.reading.right ||
          !routeActive()
        }
        onClick={(event) => {
          if (!route.current()) return;
          const opener = event.currentTarget;
          const ownsFocus = opener.ownerDocument.activeElement === opener;
          controller?.prepare();
          const report = controller?.getSnapshot().report;
          if (report && ownsFocus) pendingFocus.current = { report, opener };
        }}
      >
        Prepare Watchlist research report
      </button>
      {state.report && (
        <>
          <details>
            <summary>Preview complete Watchlist research report</summary>
            <WatchlistResearchReportSnapshot report={state.report} />
          </details>
          <div className="managed-screen-research-actions">
            {delivery && (
              <button
                id="managed-watchlist-research-report-save"
                disabled={state.saving}
                onClick={() => {
                  void controller?.save();
                }}
              >
                {delivery.actionLabel ?? "Save Watchlist research (HTML)"}
              </button>
            )}
            {state.saving && (
              <button
                id="managed-watchlist-research-report-cancel"
                onClick={() => controller?.cancel()}
              >
                Cancel report save
              </button>
            )}
            <button
              id="managed-watchlist-research-report-clear"
              onClick={() => controller?.close()}
            >
              Clear report preview
            </button>
          </div>
        </>
      )}
      <p role="status" aria-live="polite">
        {state.message}
      </p>
    </section>
  );
}
