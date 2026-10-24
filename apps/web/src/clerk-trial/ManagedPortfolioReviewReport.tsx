import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { ManagedPortfolioCloseReview } from "./managed-portfolio-close-review";
import type { PortfolioReviewReportDeliveryAdapter } from "./portfolio-review-report-ports";
import {
  PortfolioReviewReportController,
  emptyPortfolioReviewReport,
} from "./portfolio-review-report-controller";
import { formatPortfolioReviewReportHtml } from "./portfolio-review-report-html";
import { PortfolioReviewReportSnapshot } from "./PortfolioReviewReportSnapshot";

interface Props {
  prices: ManagedPortfolioCloseReview | undefined;
  ready: boolean;
  delivery: PortfolioReviewReportDeliveryAdapter | undefined;
}
const empty = emptyPortfolioReviewReport();
const emptySnapshot = () => empty;
const noopSubscribe = () => () => {};
function useReport({ prices, delivery }: Props) {
  const [controller, setController] =
    useState<PortfolioReviewReportController | null>(null);
  useLayoutEffect(() => {
    if (!prices) return;
    const next = new PortfolioReviewReportController(
      {
        capture: () => prices.captureReport(new Date().toISOString()),
        subscribe: prices.subscribe,
      },
      delivery,
      formatPortfolioReviewReportHtml,
    );
    setController(next);
    return () => next.dispose();
  }, [prices, delivery]);
  const state = useSyncExternalStore(
    controller?.subscribe ?? noopSubscribe,
    controller?.getSnapshot ?? emptySnapshot,
    controller?.getSnapshot ?? emptySnapshot,
  );
  return { controller, state };
}
type ReportState = ReturnType<PortfolioReviewReportController["getSnapshot"]>;
type Controller = PortfolioReviewReportController | null;
function captureReady(props: Props) {
  if (!props.ready) return false;
  const prices = props.prices?.getSnapshot();
  if (!prices) return false;
  if (prices.running) return false;
  return !!prices.selectedDate;
}
function captureDisabled(
  ready: boolean,
  controller: Controller,
  saving: boolean,
) {
  if (!ready) return true;
  if (!controller) return true;
  return saving;
}
function CaptureAction({
  ready,
  controller,
  saving,
}: {
  ready: boolean;
  controller: Controller;
  saving: boolean;
}) {
  const capture = () => {
    if (!ready) return;
    controller?.prepare();
  };
  return (
    <div className="managed-portfolio-actions">
      <button
        type="button"
        disabled={captureDisabled(ready, controller, saving)}
        onClick={capture}
      >
        Capture holdings report
      </button>
    </div>
  );
}
function ReportActions({
  controller,
  saving,
  delivery,
}: {
  controller: Controller;
  saving: boolean;
  delivery: Props["delivery"];
}) {
  return (
    <div className="managed-portfolio-actions">
      <button
        type="button"
        disabled={!delivery || saving}
        onClick={() => {
          void controller?.save();
        }}
      >
        Save report (HTML)
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={() => controller?.close()}
      >
        Close captured report
      </button>
      {saving && (
        <button type="button" onClick={() => controller?.cancel()}>
          Cancel report save
        </button>
      )}
    </div>
  );
}
function CapturedReport({
  state,
  ready,
  controller,
  delivery,
}: {
  state: ReportState;
  ready: boolean;
  controller: Controller;
  delivery: Props["delivery"];
}) {
  if (!ready) return null;
  if (!state.report) return null;
  return (
    <>
      <PortfolioReviewReportSnapshot report={state.report} />
      <ReportActions
        controller={controller}
        saving={state.saving}
        delivery={delivery}
      />
    </>
  );
}
function ReportStatus({ message }: { message: string }) {
  if (!message) return null;
  return <p role="status">{message}</p>;
}
export function ManagedPortfolioReviewReport(props: Props) {
  const { controller, state } = useReport(props);
  return (
    <section
      className="managed-portfolio-review-report"
      aria-label="Portfolio review report"
    >
      <h4>Keep a readable holdings report</h4>
      <p>
        Capture the current ledger, selected close date and original source
        evidence. Review the complete report before saving a private HTML copy.
        This does not save Portfolio or create a restorable draft file.
      </p>
      <CaptureAction
        ready={captureReady(props)}
        controller={controller}
        saving={state.saving}
      />
      <CapturedReport
        state={state}
        ready={props.ready}
        controller={controller}
        delivery={props.delivery}
      />
      <ReportStatus message={state.message} />
    </section>
  );
}
