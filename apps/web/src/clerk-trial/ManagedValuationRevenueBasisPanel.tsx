import { useId } from "react";
import { PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS } from "@research-cockpit/contracts";
import { managedAnnualBasisLabel } from "../features/research/managed-annual-basis-label";
import { resolveAnnualRevenueBasis } from "./managed-valuation-revenue-basis";
import {
  useValuationRevenueBasisReview,
  type RevenueBasisReviewOptions,
} from "./use-valuation-revenue-basis-review";
import {
  AppliedRevenueReference,
  ReportedRevenueSource,
  RevenueBasisChangeReview,
} from "./ValuationRevenueBasisReadout";

export function ManagedValuationRevenueBasisPanel(
  options: RevenueBasisReviewOptions,
) {
  const id = useId();
  const review = useValuationRevenueBasisReview(options);
  const candidate = resolveAnnualRevenueBasis(
    options.selection,
    review.sourceState,
    review.concept,
  );
  return (
    <details className="managed-valuation-revenue-basis">
      <summary>Use reported Annual revenue as a model basis</summary>
      <p>
        Choose one loaded revenue basis explicitly. Review the source and
        complete current and proposed inputs before applying it to Starting
        revenue in the exit multiple model. This remains your authored
        assumption. It does not set cash flow DCF inputs, shares, growth,
        margins, cash or debt.
      </p>
      <label className="managed-valuation-field" htmlFor={`${id}-basis`}>
        <span>Reported Annual revenue basis</span>
        <select
          id={`${id}-basis`}
          value={review.concept}
          disabled={options.disabled}
          onChange={(event) => review.choose(event.currentTarget.value)}
        >
          <option value="">Choose one revenue basis</option>
          {PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((item) => (
            <option key={item} value={item}>
              {managedAnnualBasisLabel(item)}
            </option>
          ))}
        </select>
      </label>
      {candidate.source ? (
        <ReportedRevenueSource source={candidate.source} />
      ) : (
        <p role="status">{candidate.reason}</p>
      )}
      <button
        type="button"
        className="trial-secondary"
        disabled={options.disabled || !candidate.source}
        onClick={review.prepare}
      >
        Preview starting revenue change
      </button>
      {review.preview && (
        <RevenueBasisChangeReview
          preview={review.preview}
          current={review.current}
          disabled={options.disabled}
          onApply={review.apply}
          previewElement={review.previewElement}
        />
      )}
      {review.message && <p role="status">{review.message}</p>}
      {review.applied && <AppliedRevenueReference context={review.applied} />}
      <p>
        Opening, selecting and previewing make no source request, calculation or
        saved change. Original source clocks stay unchanged.
      </p>
    </details>
  );
}
