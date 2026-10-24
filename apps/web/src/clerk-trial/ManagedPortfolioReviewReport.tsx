import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { ManagedPortfolioCloseReview } from "./managed-portfolio-close-review";
import type { PortfolioReviewReportDeliveryAdapter } from "./portfolio-review-report-delivery";
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
export function ManagedPortfolioReviewReport(props: Props) {
  const { controller, state } = useReport(props);
  const prices = props.prices?.getSnapshot();
  const ready = props.ready && !prices?.running && !!prices?.selectedDate;
  const report = props.ready ? state.report : null;
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
      <div className="managed-portfolio-actions">
        <button
          type="button"
          disabled={!ready || !controller || state.saving}
          onClick={() => {
            if (ready) controller?.prepare();
          }}
        >
          Capture holdings report
        </button>
      </div>
      {report && (
        <>
          <PortfolioReviewReportSnapshot report={report} />
          <div className="managed-portfolio-actions">
            <button
              type="button"
              disabled={!props.delivery || state.saving}
              onClick={() => {
                void controller?.save();
              }}
            >
              Save report (HTML)
            </button>
            <button
              type="button"
              disabled={state.saving}
              onClick={() => controller?.close()}
            >
              Close captured report
            </button>
            {state.saving && (
              <button type="button" onClick={() => controller?.cancel()}>
                Cancel report save
              </button>
            )}
          </div>
        </>
      )}
      {state.message && <p role="status">{state.message}</p>}
    </section>
  );
}
