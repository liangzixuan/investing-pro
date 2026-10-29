import { useId, useLayoutEffect, useRef, type RefObject } from "react";
import type { ScreenComparisonReportDeliveryAdapter } from "./screen-comparison-report-ports";
import { ScreenComparisonReportSnapshot } from "./ScreenComparisonReportSnapshot";
import {
  comparisonCaptureReady,
  useManagedScreenComparisonReport,
  type ManagedScreenComparisonReportOptions,
} from "./useManagedScreenComparisonReport";

type View = ReturnType<typeof useManagedScreenComparisonReport> & {
  readonly ready: boolean;
  readonly delivery: ScreenComparisonReportDeliveryAdapter | undefined;
};

export function ManagedFinancialScreenComparisonReport(
  props: ManagedScreenComparisonReportOptions,
) {
  const view = useManagedScreenComparisonReport(props);
  return (
    <ScreenComparisonReportView
      {...view}
      ready={
        comparisonCaptureReady(props.model, props.screen) &&
        (props.routeActive?.() ?? true)
      }
      delivery={props.delivery}
    />
  );
}

/** A stale rendered control cannot act on a replacement capture. */
function reviewedController({ controller, state }: View) {
  if (!controller) return null;
  if (controller.getSnapshot() !== state) return null;
  return controller;
}

function reportActions(
  view: View,
  captureButton: RefObject<HTMLButtonElement | null>,
) {
  return {
    prepare: () => {
      if (!view.ready) return;
      reviewedController(view)?.prepare();
    },
    save: () => {
      if (!view.ready) return;
      void reviewedController(view)?.save();
    },
    close: () => {
      const controller = reviewedController(view);
      if (!controller) return;
      controller.close();
      captureButton.current?.focus();
    },
    cancel: () => reviewedController(view)?.cancel(),
  };
}
type Actions = ReturnType<typeof reportActions>;

function canCapture(view: View) {
  if (!view.ready) return false;
  if (!view.controller) return false;
  return !view.state.saving;
}
function canSave(view: View) {
  if (!view.ready) return false;
  if (!view.delivery) return false;
  return !view.state.saving;
}

function savedReportActions(view: View, actions: Actions) {
  return (
    <div className="trial-actions">
      <button type="button" disabled={!canSave(view)} onClick={actions.save}>
        Save comparison report (HTML)
      </button>
      <button type="button" onClick={actions.close}>
        Close comparison report
      </button>
      {view.state.saving && (
        <button type="button" onClick={actions.cancel}>
          Cancel comparison report save
        </button>
      )}
    </div>
  );
}

function capturedReport(
  view: View,
  id: string,
  heading: RefObject<HTMLHeadingElement | null>,
  actions: Actions,
) {
  if (!view.state.report) return null;
  return (
    <section
      id="managed-screen-comparison-report-captured"
      aria-labelledby={`${id}-captured`}
    >
      <h4 id={`${id}-captured`} ref={heading} tabIndex={-1}>
        Captured screening comparison
      </h4>
      <p>Review both complete statement sets and their original sources.</p>
      <ScreenComparisonReportSnapshot report={view.state.report} />
      {savedReportActions(view, actions)}
    </section>
  );
}

/** The preview and saved HTML use the same complete passive report component. */
export function ScreenComparisonReportView(view: View) {
  const id = useId();
  const captureButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const actions = reportActions(view, captureButton);
  useLayoutEffect(() => {
    if (view.state.report) heading.current?.focus();
  }, [view.state.report]);
  return (
    <section
      id="managed-screen-comparison-report"
      className="managed-screen-comparison"
      aria-labelledby={`${id}-heading`}
    >
      <h4 id={`${id}-heading`}>Keep the screening comparison</h4>
      <p>
        Capture both selected companies for a private reading copy. Each company
        keeps its own fiscal periods and source clocks. Capture makes no request
        and changes no draft. The complete HTML reading copy must fit 8 MiB; an
        oversized report is refused in full.
      </p>
      <button
        ref={captureButton}
        type="button"
        disabled={!canCapture(view)}
        onClick={actions.prepare}
      >
        Capture comparison report
      </button>
      {view.state.message && <p role="status">{view.state.message}</p>}
      {capturedReport(view, id, heading, actions)}
    </section>
  );
}
