import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PortfolioReportRevisit } from "./portfolio-report-revisit";
import { portfolioReportFocusLease } from "./portfolio-report-revisit-focus";
import { PortfolioComparisonReportController } from "./portfolio-comparison-report-controller";
import type { PortfolioComparisonReportDeliveryAdapter } from "./portfolio-comparison-report-ports";
import { formatPortfolioComparisonReportHtml } from "./portfolio-comparison-report-html";
import { PortfolioComparisonReportSnapshot } from "./PortfolioComparisonReportSnapshot";

type Props = {
  revisit: PortfolioReportRevisit;
  delivery: PortfolioComparisonReportDeliveryAdapter | undefined;
};

export function PortfolioComparisonReportControls({
  revisit,
  delivery,
}: Props) {
  const [controller, setController] =
    useState<PortfolioComparisonReportController | null>(null);
  useLayoutEffect(() => {
    const next = new PortfolioComparisonReportController(
      {
        capture: () =>
          revisit.captureComparisonReport(new Date().toISOString()),
        subscribe: revisit.subscribe,
      },
      delivery,
      formatPortfolioComparisonReportHtml,
    );
    setController(next);
    return () => next.dispose();
  }, [revisit, delivery]);
  return controller ? (
    <PortfolioComparisonReportView
      revisit={revisit}
      controller={controller}
      delivery={delivery}
    />
  ) : null;
}

export function PortfolioComparisonReportView({
  revisit,
  controller,
  delivery,
}: Props & { controller: PortfolioComparisonReportController }) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const source = useSyncExternalStore(
    revisit.subscribe,
    revisit.getSnapshot,
    revisit.getSnapshot,
  );
  const captureButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const pending = useRef<ReturnType<typeof portfolioReportFocusLease> | null>(
    null,
  );
  const [focus, setFocus] = useState<{
    report: NonNullable<typeof state.report>;
    state: typeof state;
    lease: ReturnType<typeof portfolioReportFocusLease>;
  } | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.dispose();
    };
  }, []);
  useLayoutEffect(() => {
    if (!focus) return;
    if (
      mounted.current &&
      controller.getSnapshot() === focus.state &&
      state.report === focus.report &&
      revisit.ownsComparison(focus.report.comparison) &&
      focus.lease.current()
    )
      heading.current?.focus();
    focus.lease.dispose();
    setFocus(null);
  }, [controller, focus, revisit, state]);
  const ready =
    !!source.filename &&
    !!source.comparison &&
    revisit.ownsComparison(source.comparison);
  const owned = () =>
    mounted.current &&
    controller.getSnapshot() === state &&
    revisit.getSnapshot() === source &&
    !!source.filename &&
    !!source.comparison &&
    revisit.ownsComparison(source.comparison);
  const prepare = (button: HTMLButtonElement) => {
    if (!owned() || state.saving) return;
    pending.current?.dispose();
    const lease = portfolioReportFocusLease(button);
    pending.current = lease;
    controller.prepare();
    const next = controller.getSnapshot();
    if (
      mounted.current &&
      next.report &&
      next.report.comparison === source.comparison &&
      revisit.ownsComparison(next.report.comparison) &&
      lease.current()
    )
      setFocus({ report: next.report, state: next, lease });
    else lease.dispose();
  };
  const close = (button: HTMLButtonElement) => {
    if (!owned()) return;
    const lease = portfolioReportFocusLease(button);
    controller.close();
    if (
      mounted.current &&
      !controller.getSnapshot().report &&
      source.comparison &&
      revisit.ownsComparison(source.comparison) &&
      lease.current()
    )
      captureButton.current?.focus();
    lease.dispose();
  };
  return (
    <section aria-label="Keep the Portfolio comparison">
      <h4>Keep the complete comparison</h4>
      <p>
        Capture both complete records and their original dates for a private
        reading copy. The saved file remains unverified. This does not save
        Portfolio or refresh sources. The complete HTML must fit 8 MiB.
      </p>
      <button
        id="portfolio-comparison-report-capture"
        ref={captureButton}
        type="button"
        disabled={!ready || state.saving}
        onClick={(event) => prepare(event.currentTarget)}
      >
        Capture comparison report
      </button>
      {state.message && (
        <p id="portfolio-comparison-report-status" role="status">
          {state.message}
        </p>
      )}
      {state.report && (
        <section
          id="portfolio-comparison-report-preview"
          aria-labelledby="portfolio-comparison-report-heading"
        >
          <h4
            id="portfolio-comparison-report-heading"
            ref={heading}
            tabIndex={-1}
          >
            Captured Portfolio comparison report
          </h4>
          <PortfolioComparisonReportSnapshot report={state.report} />
          <div className="managed-portfolio-actions">
            <button
              id="portfolio-comparison-report-save"
              type="button"
              disabled={!ready || !delivery || state.saving}
              onClick={() => {
                if (owned() && delivery && !state.saving)
                  void controller.save();
              }}
            >
              Save comparison report (HTML)
            </button>
            <button
              id="portfolio-comparison-report-close"
              type="button"
              onClick={(event) => close(event.currentTarget)}
            >
              Close comparison report
            </button>
            {state.saving && (
              <button
                id="portfolio-comparison-report-cancel"
                type="button"
                onClick={() => {
                  if (owned()) controller.cancel();
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
