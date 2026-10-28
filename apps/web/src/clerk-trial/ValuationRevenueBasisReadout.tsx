import type { Ref } from "react";
import { managedAnnualBasisLabel } from "../features/research/managed-annual-basis-label";
import type {
  AnnualRevenueBasisSource,
  AppliedValuationRevenueBasis,
  PreparedValuationRevenueBasis,
} from "./managed-valuation-revenue-basis";
import { ValuationAssumptionReview } from "./ValuationAssumptionReview";

const sourceOriginLabels = {
  request: "Explicit Annual load",
  "watchlist-comparison": "Admitted Watchlist comparison evidence",
  "financial-screen": "Admitted financial-screen evidence",
};
export function ReportedRevenueSource({
  source,
}: {
  source: AnnualRevenueBasisSource;
}) {
  return (
    <div
      role="region"
      aria-label="Selected reported revenue source"
      className="managed-valuation-note-preview"
    >
      <p>
        {managedAnnualBasisLabel(source.concept)} ·{" "}
        <code>{source.concept}</code>
      </p>
      <p>
        Reported USD {source.value}; {source.startDate} to {source.endDate}.
      </p>
      <p>
        {source.form}, filed {source.filedDate}; accession{" "}
        {source.accessionNumber}.
      </p>
      <p>
        Original cutoff {source.cutoffAt}; completed {source.completedAt}.
        Company Facts captured {source.companyFactsCapturedAt}; Submissions
        captured {source.submissionsCapturedAt}.
      </p>
      <p>SEC source CIK {source.cik}.</p>
      <p>Loaded via: {sourceOriginLabels[source.responseOrigin]}.</p>
      <p>
        {source.currentUseEligible
          ? "Current-use policy at original load: eligible."
          : "Historical evidence; current-use policy at original load: unavailable."}
      </p>
      {source.showingPrevious && (
        <p>
          Retained previous report. This load has not confirmed newer evidence.
        </p>
      )}
      <a href={source.filingUrl} target="_blank" rel="noreferrer">
        Original SEC filing index
      </a>
    </div>
  );
}
export function RevenueBasisChangeReview({
  preview,
  current,
  disabled,
  onApply,
  previewElement,
}: {
  preview: PreparedValuationRevenueBasis;
  current: boolean;
  disabled: boolean;
  onApply: () => void;
  previewElement: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={previewElement}
      tabIndex={-1}
      role="region"
      aria-label="Complete starting revenue change preview"
      className="managed-valuation-note-preview"
    >
      <h4>
        {current
          ? "Review starting revenue change"
          : "Previous starting revenue preview"}
      </h4>
      <p>{preview.excerpt}</p>
      <p>
        Exit-model Starting revenue: current{" "}
        <span className="managed-valuation-raw">
          {preview.beforeRevenue === "" ? "Empty" : preview.beforeRevenue}
        </span>
        ; proposed{" "}
        <span className="managed-valuation-raw">{preview.afterRevenue}</span>{" "}
        USD.
      </p>
      <div className="managed-valuation-comparison">
        <section aria-label="Current complete valuation inputs">
          <h5>Current inputs</h5>
          <ValuationAssumptionReview entry={preview.before} />
        </section>
        <section aria-label="Proposed complete valuation inputs">
          <h5>Proposed inputs</h5>
          <ValuationAssumptionReview entry={preview.after} />
        </section>
      </div>
      <button
        type="button"
        className="trial-secondary"
        disabled={disabled || !current}
        onClick={onApply}
      >
        Apply reported revenue to authored inputs
      </button>
    </div>
  );
}
export function AppliedRevenueReference({
  context,
}: {
  context: AppliedValuationRevenueBasis;
}) {
  return (
    <div
      role="region"
      aria-label="Applied Annual revenue reference"
      className="managed-valuation-note-preview"
    >
      <h4>Applied Annual revenue reference</h4>
      <p>{context.excerpt}</p>
      <p>
        A current reference is included in the complete Exit multiple note
        preview. Saved valuation inputs retain raw authored text only.
        Calculate, Stage, Review and Save remain separate actions.
      </p>
    </div>
  );
}
