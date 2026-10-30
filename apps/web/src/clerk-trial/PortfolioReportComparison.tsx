import { portfolioReportFocusLease } from "./portfolio-report-revisit-focus";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PortfolioReviewReportController } from "./portfolio-review-report-controller";
import { PortfolioReportRevisit } from "./portfolio-report-revisit";
import { PortfolioReviewReportSnapshot } from "./PortfolioReviewReportSnapshot";
import { PortfolioReportComparisonRows } from "./PortfolioReportComparisonRows";

export function PortfolioReportComparison({
  reports,
  onResearch,
}: {
  reports: PortfolioReviewReportController;
  onResearch?:
    ((listingId: string, opener: HTMLButtonElement) => void) | undefined;
}) {
  const [controller, setController] = useState<PortfolioReportRevisit | null>(
    null,
  );
  useLayoutEffect(() => {
    const next = new PortfolioReportRevisit(reports);
    setController(next);
    return () => next.dispose();
  }, [reports]);
  return controller ? (
    <PortfolioReportComparisonView
      reports={reports}
      controller={controller}
      onResearch={onResearch}
    />
  ) : null;
}
export function PortfolioReportComparisonView({
  reports,
  controller,
  onResearch,
}: {
  reports: PortfolioReviewReportController;
  controller: PortfolioReportRevisit;
  onResearch?:
    ((listingId: string, opener: HTMLButtonElement) => void) | undefined;
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const savedHeading = useRef<HTMLHeadingElement>(null);
  const comparisonHeading = useRef<HTMLHeadingElement>(null);
  const pending = useRef<ReturnType<typeof portfolioReportFocusLease> | null>(
    null,
  );
  const [focus, setFocus] = useState<{
    kind: "saved" | "comparison";
    value: object;
    lease: ReturnType<typeof portfolioReportFocusLease>;
  } | null>(null);
  useLayoutEffect(() => () => pending.current?.dispose(), []);
  useLayoutEffect(() => {
    if (!focus) return;
    const owned =
      focus.kind === "saved"
        ? state.saved === focus.value &&
          state.saved !== null &&
          controller.ownsSaved(state.saved)
        : state.comparison === focus.value &&
          state.comparison !== null &&
          controller.ownsComparison(state.comparison);
    if (owned && focus.lease.current())
      (focus.kind === "saved"
        ? savedHeading
        : comparisonHeading
      ).current?.focus();
    focus.lease.dispose();
    setFocus(null);
  }, [focus, state, controller]);
  const lease = (button: HTMLButtonElement) => {
    pending.current?.dispose();
    const next = portfolioReportFocusLease(button);
    pending.current = next;
    return next;
  };
  const read = async (button: HTMLButtonElement) => {
    const owner = lease(button);
    const success = await controller.read();
    const saved = controller.getSnapshot().saved;
    if (success && saved && owner.current())
      setFocus({ kind: "saved", value: saved, lease: owner });
    else owner.dispose();
  };
  const compare = (button: HTMLButtonElement) => {
    const owner = lease(button);
    const success = controller.compare();
    const comparison = controller.getSnapshot().comparison;
    if (success && comparison && owner.current())
      setFocus({ kind: "comparison", value: comparison, lease: owner });
    else owner.dispose();
  };
  return (
    <section aria-label="Revisit a saved Portfolio report">
      <h4>Compare a saved Portfolio report</h4>
      <p>
        Choose a private HTML report saved by this app. Read it locally, capture
        the current holdings separately, then compare the two complete records.
      </p>
      <label className="managed-draft-file-input">
        Choose a saved Portfolio report (HTML)
        <input
          id="portfolio-report-file"
          type="file"
          accept="text/html,.html"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) controller.choose(file);
          }}
        />
      </label>
      <p>{state.filename}</p>
      <div className="managed-portfolio-actions">
        <button
          id="portfolio-report-read"
          type="button"
          disabled={!state.filename || state.reading}
          onClick={(event) => {
            void read(event.currentTarget);
          }}
        >
          Read saved report
        </button>
        {(state.filename || state.saved) && (
          <button
            id="portfolio-report-read-cancel"
            type="button"
            onClick={() => controller.clear()}
          >
            {state.reading ? "Cancel report read" : "Clear saved report"}
          </button>
        )}
      </div>
      {state.message && <p role="status">{state.message}</p>}
      {state.saved && (
        <section aria-labelledby="portfolio-report-saved-heading">
          <h4
            id="portfolio-report-saved-heading"
            ref={savedHeading}
            tabIndex={-1}
          >
            Saved Portfolio report
          </h4>
          <p>
            This local copy is unverified. Reading it does not establish an
            online saved version or refresh its sources.
          </p>
          <PortfolioReviewReportSnapshot
            report={state.saved}
            compositionId="portfolio-report-saved-composition"
          />
        </section>
      )}
      <div className="managed-portfolio-actions">
        <button
          id="portfolio-report-compare"
          type="button"
          disabled={!state.saved || state.reading || !reports.captureCurrent()}
          onClick={(event) => compare(event.currentTarget)}
        >
          Compare saved and current reports
        </button>
      </div>
      {state.comparison && (
        <section aria-labelledby="portfolio-report-comparison-heading">
          <h4
            id="portfolio-report-comparison-heading"
            ref={comparisonHeading}
            tabIndex={-1}
          >
            Saved and current Portfolio comparison
          </h4>
          <p>
            Each record keeps its own balances, selected close date and source
            clocks. Changes describe these records; they do not measure
            investment returns.
          </p>
          <PortfolioReportComparisonRows
            comparison={state.comparison}
            onResearch={
              onResearch
                ? (listingId, opener) =>
                    controller.research(listingId, () =>
                      onResearch(listingId, opener),
                    )
                : undefined
            }
          />
        </section>
      )}
    </section>
  );
}
