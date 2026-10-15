import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";
import {
  comparePersonalSecAnnualOperatingEvidence,
  type PersonalSecAnnualOperatingHistoryReason,
} from "@research-cockpit/personal-financial-analytics";
import { annualMarginChangeText } from "../../lib/sec-annual-comparison-display";
import { annualOperatingUnavailableReasonText } from "./SecAnnualOperatingResults";

export function SecAnnualOperatingChange({
  response,
  concept,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
  readonly concept: PersonalSecAnnualRevenueConcept;
}) {
  const comparison = comparePersonalSecAnnualOperatingEvidence(
    response.evidence,
    concept,
  );
  return (
    <section
      className="managed-annual-operating-change"
      aria-label={`Reported operating change ${concept}`}
    >
      <h6>Reported operating change</h6>
      {comparison.status === "unavailable" ? (
        <p className="managed-annual-unavailable">
          Operating change unavailable.{" "}
          {comparison.stage === "current_pair"
            ? "The current operating-income and selected-revenue pair is unavailable."
            : "The immediately preceding operating-income and selected-revenue pair is unavailable."}{" "}
          {annualOperatingHistoryReasonText(comparison.reason)}
        </p>
      ) : (
        <>
          <p className="managed-annual-basis-help">
            Prior:{" "}
            <time dateTime={comparison.prior.startDate}>
              {comparison.prior.startDate}
            </time>{" "}
            to{" "}
            <time dateTime={comparison.prior.endDate}>
              {comparison.prior.endDate}
            </time>
            . Current:{" "}
            <time dateTime={comparison.current.startDate}>
              {comparison.current.startDate}
            </time>{" "}
            to{" "}
            <time dateTime={comparison.current.endDate}>
              {comparison.current.endDate}
            </time>
            .
          </p>
          <dl>
            <div>
              <dt>
                Operating income change · USD<small>App calculation</small>
              </dt>
              <dd>{comparison.operatingIncomeDifference}</dd>
            </div>
            <div>
              <dt>
                Operating margin change · percentage points
                <small>App calculation</small>
              </dt>
              <dd>
                {annualMarginChangeText(comparison.operatingMarginChange)}
              </dd>
            </div>
          </dl>
          <p className="managed-annual-basis-help">
            Changes compare current minus prior. Margin change subtracts the
            unrounded operating-income-to-revenue ratios and rounds once to two
            decimal places, half up. Revenue must be positive in both periods.
          </p>
          <p className="managed-annual-basis-help">
            Same filing {comparison.accessionNumber}. Original load completed{" "}
            {response.evidence.generation.completedAt}. Both periods' complete
            inputs remain in History calculation references below. Opening this
            comparison does not refresh sources.
          </p>
        </>
      )}
    </section>
  );
}

export function annualOperatingHistoryReasonText(
  reason: PersonalSecAnnualOperatingHistoryReason,
): string {
  if (reason === "current_use_unavailable")
    return "The selected operating report is outside the current-use limits at this load. Reported amounts remain above.";
  if (reason === "no_report_period")
    return "One or both operating inputs are missing for the required annual period. Older periods are not substituted.";
  if (reason === "report_end_mismatch")
    return "The observation’s filing report date does not match the selected filing.";
  if (reason === "nonpositive_revenue")
    return "Operating margin requires revenue greater than zero.";
  if (reason === "ambiguous_value")
    return "The source contains conflicting reported amounts.";
  if (reason === "ambiguous_period")
    return "The source contains conflicting annual periods.";
  return annualOperatingUnavailableReasonText(reason);
}
