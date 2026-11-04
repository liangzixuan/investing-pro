import { useState } from "react";
import type {
  PortfolioSavedScenarioPlan,
  PortfolioSavedScenarioReading,
} from "./managed-portfolio-valuation-review";
import type { PortfolioValuationComparison } from "./portfolio-valuation-price";
import {
  ManagedValuationResults,
  valuationScenarioLabels,
} from "./ManagedValuationResults";
import { valuationPriceRefusal } from "./ManagedValuationPriceContext";
import { ListingIdentity } from "./ManagedListingIdentity";
import { ValuationAssumptionReview } from "./ValuationAssumptionReview";
import { CapturedSourcePacket } from "./ManagedScreenResearchReading";
import { PortfolioReviewReportSnapshot } from "./PortfolioReviewReportSnapshot";

export function portfolioScenarioRefusal(reason: string): string {
  const reasons: Readonly<Record<string, string>> = {
    portfolio_report_unowned:
      "The original Portfolio reading is no longer admitted.",
    price_identity_mismatch:
      "This evidence does not match the exact holding, catalog or research context.",
    price_unsupported:
      "Raw closing-price coverage is unavailable for this holding.",
    price_not_loaded:
      "No closing-price response was retained for this holding. Load closes explicitly and make a new preview.",
    selected_close_missing:
      "The retained response has no raw close on the chosen date. A newer observation is not substituted.",
  };
  return reasons[reason] ?? valuationPriceRefusal(reason);
}
function PortfolioScenarioComparisons({
  comparison,
}: {
  comparison: PortfolioValuationComparison;
}) {
  return (
    <section aria-label="Portfolio scenario price comparison">
      <h5>Six scenarios versus the chosen raw close</h5>
      {comparison.reason && (
        <p>
          Comparison unavailable. {portfolioScenarioRefusal(comparison.reason)}
        </p>
      )}
      <div
        className="managed-valuation-table"
        role="region"
        aria-label="All Portfolio scenario price comparisons"
        tabIndex={0}
      >
        <table>
          <caption>
            Authored values and differences from the chosen-date raw close
          </caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Scenario</th>
              <th scope="col">Authored value (USD/share)</th>
              <th scope="col">Difference from raw close (%)</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={`${row.model}-${row.scenario}`}>
                <th scope="row">
                  {row.model === "dcf" ? "Cash flow DCF" : "Exit multiple"}
                </th>
                <td>{valuationScenarioLabels[row.scenario]}</td>
                <td>{row.modelValuePerShareUsd ?? "Unavailable"}</td>
                <td>
                  {row.result.status === "available"
                    ? `${row.result.differencePercent}%`
                    : `Unavailable. ${portfolioScenarioRefusal(row.result.reason)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Difference = ((authored USD/share ÷ chosen raw close USD) − 1) × 100.
        Authored diluted share counts are not source-verified. These comparisons
        do not reconcile share counts or adjust for splits or dividends. They
        are scenario context, not price targets or trading recommendations.
      </p>
    </section>
  );
}
export function PortfolioSavedScenarioReadingView({
  plan,
  reading,
}: {
  plan: PortfolioSavedScenarioPlan;
  reading: PortfolioSavedScenarioReading | null;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  return (
    <>
      <p>
        Chosen close date: <strong>{plan.report.selectedDate}</strong>. Original
        Portfolio reading prepared at (UTC): {plan.report.preparedAt}. Saved
        collection version: {plan.collection.saved.version}. Scenario preview
        captured at (UTC): {plan.capturedAt}.
      </p>
      {reading && (
        <p>
          Evaluated at (UTC): {reading.evaluatedAt}. Current saved assumptions
          evaluated now are not historical valuation results or a backtest.
        </p>
      )}
      <details onToggle={(event) => setReportOpen(event.currentTarget.open)}>
        <summary>Complete original Portfolio reading</summary>
        {reportOpen && (
          <PortfolioReviewReportSnapshot
            report={plan.report}
            compositionId="portfolio-saved-scenario-composition"
          />
        )}
      </details>
      <CapturedSourcePacket
        label="Complete confirmed saved collection and catalog"
        value={plan.collection}
      />
      <ol>
        {plan.rows.map((row, index) => {
          const result = reading?.rows[index];
          const reference = row.price.reference;
          return (
            <li
              key={row.selection.listing.listingId}
              data-portfolio-scenario-listing={row.selection.listing.listingId}
            >
              <section aria-labelledby={`portfolio-saved-scenario-${index}`}>
                <h4 id={`portfolio-saved-scenario-${index}`}>
                  {row.selection.listing.symbol} ·{" "}
                  {row.selection.listing.shareClassName}
                </h4>
                <ListingIdentity member={row.selection.listing} />
                <p>
                  Authored holding: {row.source.holding.shares} shares,
                  confirmed {row.source.holding.confirmedOn}. Research issuer
                  CIK: {row.selection.cik ?? "Unavailable"}. Catalog:{" "}
                  {row.selection.catalogSnapshotSha256}.
                </p>
                {row.reason && (
                  <p>
                    {row.reason === "missing_saved_inputs"
                      ? "No confirmed saved valuation inputs for this holding."
                      : "Saved inputs do not match the current catalog, full listing or admitted issuer. Review their identity in Saved inputs."}
                  </p>
                )}
                {row.entry && <ValuationAssumptionReview entry={row.entry} />}
                {row.price.reason && (
                  <p>{portfolioScenarioRefusal(row.price.reason)}</p>
                )}
                {reference && (
                  <>
                    <p>
                      Chosen raw close: {reference.rawCloseUsd} USD on{" "}
                      {reference.date}. Source: {reference.response.provider}.
                      Currency: {reference.response.currency}. Raw close,
                      unadjusted for splits or dividends; a historical
                      observation, not a current quote.
                    </p>
                    <p>
                      Source request started (UTC):{" "}
                      {reference.response.requestStartedAt}. Completed (UTC):{" "}
                      {reference.response.completedAt}. Requested range:{" "}
                      {reference.response.range}; window{" "}
                      {reference.response.window.startDate} to{" "}
                      {reference.response.window.endDate}.
                    </p>
                    {reference.showingPrevious && (
                      <p>
                        Previous close history is retained. Its original dates
                        and request times are unchanged.
                      </p>
                    )}
                  </>
                )}
                <p>{row.source.message}</p>
                <CapturedSourcePacket
                  label="Complete original holding and closing-price evidence"
                  value={row.source}
                />
                {result?.calculation && (
                  <ManagedValuationResults calculation={result.calculation} />
                )}
                {result?.comparison && (
                  <PortfolioScenarioComparisons
                    comparison={result.comparison}
                  />
                )}
              </section>
            </li>
          );
        })}
      </ol>
      <p>
        No aggregate Portfolio fair value is calculated. Holdings, saved
        assumptions and source evidence remain separate.
      </p>
    </>
  );
}
