import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  ManagedFinancialScreen,
  ManagedFinancialScreenState,
} from "./managed-financial-screen";
import {
  ScreenComparisonReportController,
  type ScreenComparisonReportSource,
} from "./screen-comparison-report-controller";
import { formatScreenComparisonReportHtml } from "./screen-comparison-report-html";
import type { ScreenComparisonReportDeliveryAdapter } from "./screen-comparison-report-ports";
import { ScreenComparisonReportSnapshot } from "./ScreenComparisonReportSnapshot";

interface Props {
  readonly model: ManagedFinancialScreen;
  readonly screen: ManagedFinancialScreenState;
  readonly delivery?: ScreenComparisonReportDeliveryAdapter;
  readonly routeActive?: () => boolean;
}
const activeRoute = () => true;
const empty = Object.freeze({ report: null, saving: false, message: "" });
const emptySnapshot = () => empty;
const noopSubscribe = () => () => {};

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
          current = current && routeActive() && capture.current();
          return current;
        },
      };
    },
    subscribe: model.subscribe,
  };
}

function useReport({ model, delivery, routeActive = activeRoute }: Props) {
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
  const state = useSyncExternalStore(
    controller?.subscribe ?? noopSubscribe,
    controller?.getSnapshot ?? emptySnapshot,
    controller?.getSnapshot ?? emptySnapshot,
  );
  return { controller, state };
}

export function comparisonCaptureReady(
  model: ManagedFinancialScreen,
  screen: ManagedFinancialScreenState,
) {
  const { run, comparison } = screen;
  if (!run || run.status === "running" || !comparison.left || !comparison.right)
    return false;
  if (comparison.left === comparison.right) return false;
  return [comparison.left, comparison.right].every((row) => {
    const response = row.report?.response;
    return (
      !!response &&
      model.getSnapshot() === screen &&
      model.canAdmitReport({ run, row, response })
    );
  });
}

type View = ReturnType<typeof useReport> & {
  readonly ready: boolean;
  readonly delivery: ScreenComparisonReportDeliveryAdapter | undefined;
};

export function ManagedFinancialScreenComparisonReport(props: Props) {
  const view = useReport(props);
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

/** The preview and saved HTML use the same complete passive report component. */
export function ScreenComparisonReportView({
  controller,
  state,
  ready,
  delivery,
}: View) {
  const id = useId();
  const captureButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (state.report) heading.current?.focus();
  }, [state.report]);
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
        disabled={!ready || !controller || state.saving}
        onClick={() => {
          if (ready && controller && controller.getSnapshot() === state)
            controller.prepare();
        }}
      >
        Capture comparison report
      </button>
      {state.message && <p role="status">{state.message}</p>}
      {state.report && (
        <section
          id="managed-screen-comparison-report-captured"
          aria-labelledby={`${id}-captured`}
        >
          <h4 id={`${id}-captured`} ref={heading} tabIndex={-1}>
            Captured screening comparison
          </h4>
          <p>Review both complete statement sets and their original sources.</p>
          <ScreenComparisonReportSnapshot report={state.report} />
          <div className="trial-actions">
            <button
              type="button"
              disabled={!ready || !delivery || state.saving}
              onClick={() => {
                if (ready && controller && controller.getSnapshot() === state)
                  void controller.save();
              }}
            >
              Save comparison report (HTML)
            </button>
            <button
              type="button"
              onClick={() => {
                if (!controller || controller.getSnapshot() !== state) return;
                controller.close();
                captureButton.current?.focus();
              }}
            >
              Close comparison report
            </button>
            {state.saving && (
              <button
                type="button"
                onClick={() => {
                  if (controller && controller.getSnapshot() === state)
                    controller.cancel();
                }}
              >
                Cancel comparison report save
              </button>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
