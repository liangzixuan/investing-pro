import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import {
  WatchlistDailyReportController,
  type WatchlistDailyReportSource,
} from "./watchlist-daily-report-controller";
import { formatWatchlistDailyReportHtml } from "./watchlist-daily-report-html";
import type { WatchlistDailyReportDeliveryAdapter } from "./watchlist-daily-report-ports";
import type { PreparedWatchlistDailyReport } from "./watchlist-daily-report";
import { WatchlistDailyReportSnapshot } from "./WatchlistDailyReportSnapshot";

const empty = Object.freeze({ report: null, saving: false, message: "" });
const emptyStore = { getSnapshot: () => empty, subscribe: () => () => {} };

export function ManagedWatchlistDailyReport({
  workspace,
  active,
  delivery,
}: {
  readonly workspace: ManagedWorkspace;
  readonly active: boolean;
  readonly delivery: WatchlistDailyReportDeliveryAdapter | undefined;
}) {
  const source = useMemo<WatchlistDailyReportSource>(() => {
    const owned = workspace.getWatchlistDailyReportSource();
    return {
      subscribe: owned.subscribe,
      capture: () => (active ? owned.capture() : null),
    };
  }, [workspace, active]);
  const [controller, setController] =
    useState<WatchlistDailyReportController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusRequest = useRef<PreparedWatchlistDailyReport | null>(null);
  useLayoutEffect(() => {
    const next = new WatchlistDailyReportController(
      source,
      delivery,
      formatWatchlistDailyReportHtml,
    );
    setController(next);
    return () => next.dispose();
  }, [source, delivery]);
  const store = controller ?? emptyStore;
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const group = useSyncExternalStore(
    workspace.filingsReview.subscribe,
    workspace.filingsReview.getSnapshot,
    workspace.filingsReview.getSnapshot,
  );
  useLayoutEffect(() => {
    controller?.reconcile();
    const request = focusRequest.current;
    focusRequest.current = null;
    if (
      request &&
      active &&
      request === state.report &&
      controller?.getSnapshot().report === request
    )
      heading.current?.focus();
  });
  if (group.daily?.phase !== "finished") return null;
  return (
    <section aria-labelledby="managed-watchlist-daily-report-heading">
      <h4
        id="managed-watchlist-daily-report-heading"
        ref={heading}
        tabIndex={-1}
      >
        Keep this daily review
      </h4>
      <p>
        Capture the finished reading, saved scenarios and current authored
        checks in one private report. Source and evaluation times stay as
        recorded. Saving this file does not save online resources.
      </p>
      <button
        type="button"
        id="managed-watchlist-daily-report-prepare"
        disabled={!active || !controller || state.saving}
        onClick={() => {
          if (!active || !controller) return;
          controller.prepare();
          focusRequest.current = controller.getSnapshot().report;
        }}
      >
        Prepare daily review report
      </button>
      {state.report && (
        <>
          <details>
            <summary>Preview complete daily review report</summary>
            <WatchlistDailyReportSnapshot report={state.report} />
          </details>
          {delivery && (
            <button
              type="button"
              id="managed-watchlist-daily-report-save"
              disabled={!active || state.saving}
              onClick={() => {
                if (active) void controller?.save();
              }}
            >
              {delivery.actionLabel ?? "Save daily review (HTML)"}
            </button>
          )}
          {state.saving && (
            <button type="button" onClick={() => controller?.cancel()}>
              Cancel daily report save
            </button>
          )}
          <button type="button" onClick={() => controller?.close()}>
            Clear daily report preview
          </button>
        </>
      )}
      <p role="status" aria-live="polite">
        {state.message}
      </p>
    </section>
  );
}
