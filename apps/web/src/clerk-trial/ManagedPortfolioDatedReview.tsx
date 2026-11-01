import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { PortfolioDatedReviewReading } from "./managed-portfolio-dated-review-context";
import { PortfolioReviewReportSnapshot } from "./PortfolioReviewReportSnapshot";
import { ListingIdentity, identityLabels } from "./ManagedListingIdentity";
import "./managed-portfolio-dated-review.css";

export interface PortfolioDatedReviewFocus {
  readonly reading: PortfolioDatedReviewReading;
  readonly opener: HTMLButtonElement;
}

/** Passive evidence remains outside the hidden Follow-ups container during Research. */
export function ManagedPortfolioDatedReview({
  workspace,
  navigationPending,
  focusRequest,
}: {
  workspace: ManagedWorkspace;
  navigationPending: boolean;
  focusRequest: PortfolioDatedReviewFocus | null;
}) {
  const model = workspace.portfolioDatedReview;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const view = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const consumed = useRef<PortfolioDatedReviewFocus | null>(null);
  useLayoutEffect(() => {
    if (!focusRequest || consumed.current === focusRequest) return;
    if (navigationPending) return;
    consumed.current = focusRequest;
    if (
      model.getSnapshot() !== state ||
      workspace.getSnapshot() !== view ||
      state.reading !== focusRequest.reading ||
      model.getSnapshot().reading !== focusRequest.reading ||
      view.research ||
      view.companyRoute ||
      view.view !== "followups"
    )
      return;
    const target = heading.current;
    if (!target?.isConnected || target.closest("[hidden], [inert]")) return;
    const active = target.ownerDocument.activeElement;
    if (active !== focusRequest.opener && active !== target.ownerDocument.body)
      return;
    target.focus();
  }, [focusRequest, model, state, view, navigationPending, workspace]);
  if (!state.reading || navigationPending) return null;
  const reading = state.reading;
  const entries = workspace.followups.getReviewContext()?.draft.entries ?? [];
  const chosen = new Set(state.review?.chosen.map((row) => row.entry.id) ?? []);
  const remaining = reading.plan.eligible.flatMap((original) => {
    const entry = entries.find((row) => row.id === original.id);
    return entry?.status === "open" && !chosen.has(entry.id) ? [entry] : [];
  });
  return (
    <section
      className="trial-panel managed-portfolio-dated-review"
      aria-label="Dated Portfolio review"
    >
      <h2 id="portfolio-dated-review-heading" ref={heading} tabIndex={-1}>
        Dated Portfolio review
      </h2>
      <p>
        Original close date: {reading.report.review.asOfDate}. Priced holdings:{" "}
        {reading.report.review.pricedHoldings} of{" "}
        {reading.report.review.totalHoldings}. Checks assessed on{" "}
        {reading.assessedOn} (UTC).
      </p>
      <p>
        The reading keeps its original balances and source times. Research and
        check edits do not refresh it. Save Follow-ups separately.
      </p>
      <details id="portfolio-dated-review-reading">
        <summary>Original dated Portfolio reading</summary>
        <PortfolioReviewReportSnapshot
          report={reading.report}
          compositionId="portfolio-dated-review-composition"
        />
      </details>
      {state.phase === "finished" && (
        <section
          id="portfolio-dated-review-remaining"
          aria-label="Other open checks from this dated review"
        >
          <h3>Other open checks from the original due plan</h3>
          <p>
            The chosen review keeps its ordered results below. Finishing does
            not complete or save checks.
          </p>
          {remaining.length === 0 ? (
            <p>No other eligible checks remain open.</p>
          ) : (
            <ol>
              {remaining.map((entry) => (
                <li key={entry.id}>
                  <ListingIdentity member={entry.listing} />
                  <details>
                    <summary>Full listing identity</summary>
                    <dl>
                      {Object.entries(entry.listing).map(([key, value]) => (
                        <div key={key}>
                          <dt>
                            {identityLabels[key as keyof typeof identityLabels]}
                          </dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p>Catalog: {entry.catalogSnapshotSha256}</p>
                  </details>
                  <p className="portfolio-dated-raw">{entry.check}</p>
                  <p>
                    Due {entry.dueOn}. Status: {entry.status}.
                  </p>
                  <p className="portfolio-dated-raw">
                    {entry.result || "No authored result."}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </section>
  );
}
