import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import type {
  ManagedFinancialScreen,
  ManagedFinancialScreenState,
  ManagedFinancialScreenResultRow,
  ManagedFinancialScreenRun,
} from "./managed-financial-screen";
import {
  ScreenComparisonReportController,
  type ScreenComparisonReportSource,
} from "./screen-comparison-report-controller";
import { formatScreenComparisonReportHtml } from "./screen-comparison-report-html";
import type { ScreenComparisonReportDeliveryAdapter } from "./screen-comparison-report-ports";

export interface ManagedScreenComparisonReportOptions {
  readonly model: ManagedFinancialScreen;
  readonly screen: ManagedFinancialScreenState;
  readonly delivery?: ScreenComparisonReportDeliveryAdapter;
  readonly routeActive?: () => boolean;
}
const activeRoute = () => true;
const empty = Object.freeze({ report: null, saving: false, message: "" });
const emptyStore = {
  getSnapshot: () => empty,
  subscribe: () => () => {},
};

/** Pending navigation fences delivery before a committed model retirement. */
export function createScreenComparisonReportSource(
  model: ManagedFinancialScreen,
  routeActive: () => boolean,
): ScreenComparisonReportSource {
  return {
    capture: () => {
      if (!routeActive()) return null;
      const capture = model.captureComparisonReport(new Date().toISOString());
      if (!capture) return null;
      let current = true;
      return {
        report: capture.report,
        current: () => {
          if (!current) return false;
          current = routeActive();
          if (!current) return false;
          current = capture.current();
          return current;
        },
      };
    },
    subscribe: model.subscribe,
  };
}

export function useManagedScreenComparisonReport({
  model,
  delivery,
  routeActive = activeRoute,
}: ManagedScreenComparisonReportOptions) {
  const [controller, setController] =
    useState<ScreenComparisonReportController | null>(null);
  useLayoutEffect(() => {
    const next = new ScreenComparisonReportController(
      createScreenComparisonReportSource(model, routeActive),
      delivery,
      formatScreenComparisonReportHtml,
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
  return { controller, state };
}

function currentRowReady(
  model: ManagedFinancialScreen,
  screen: ManagedFinancialScreenState,
  run: ManagedFinancialScreenRun,
  row: ManagedFinancialScreenResultRow,
) {
  const response = row.report?.response;
  if (!response) return false;
  if (model.getSnapshot() !== screen) return false;
  return model.canAdmitReport({ run, row, response });
}

export function comparisonCaptureReady(
  model: ManagedFinancialScreen,
  screen: ManagedFinancialScreenState,
) {
  const { run, comparison } = screen;
  if (!run) return false;
  if (run.status === "running") return false;
  if (!comparison.left) return false;
  if (!comparison.right) return false;
  if (comparison.left === comparison.right) return false;
  return [comparison.left, comparison.right].every((row) =>
    currentRowReady(model, screen, run, row),
  );
}
