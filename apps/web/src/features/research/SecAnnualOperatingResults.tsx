import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualOperatingMarginDto,
  PersonalSecAnnualOperatingUnavailableReason,
  PersonalSecAnnualOperatingValueDto,
} from "@research-cockpit/contracts";
import type { ReactNode, Ref } from "react";
import { ObservationDetails } from "./SecAnnualObservation";
import { managedAnnualBasisLabel } from "./managed-annual-basis-label";

const reasons: Record<PersonalSecAnnualOperatingUnavailableReason, string> = {
  invalid_clock: "The original source times could not be validated.",
  source_unavailable: "A required SEC source is unavailable.",
  source_stale: "The source captures exceed the seven-day freshness limit.",
  target_unresolved: "The annual filing could not be resolved.",
  invalid_response: "This concept could not be validated.",
  candidate_limit: "This concept exceeds the source scan limit.",
  invalid_source_rows: "The source scan contains invalid observations.",
  selected_report_overflow: "This filing exceeds the observation limit.",
  concept_missing: "This reported concept is absent from the source.",
  usd_missing: "This reported concept has no USD observations.",
  empty_usd: "The source contains no USD observations for this concept.",
  no_report_period:
    "No observation covers the selected annual filing's period.",
  unsupported_form: "The observation is not from an unamended annual filing.",
  missing_or_non_FY_focus:
    "The observation lacks an annual filing-focus label.",
  invalid_annual_period:
    "The observation does not establish a 335–395 day annual period.",
  filing_unmatched_or_conflicted:
    "The observation's filing metadata does not match submissions.",
  report_end_mismatch:
    "The observation ends outside the selected report's period.",
  future_or_inconsistent_dates:
    "The source dates are future-dated or inconsistent.",
  cutoff_time_unresolved:
    "The filing's time relative to this load is unresolved.",
  report_date_missing: "The filing's report date is missing.",
  filed_date_missing: "The filing date is missing.",
  ambiguous_period: "The source contains conflicting annual periods.",
  ambiguous_value: "The source contains conflicting reported amounts.",
  period_mismatch: "The reported amounts cover different periods.",
  filing_mismatch: "The reported amounts come from different filings.",
  nonpositive_revenue: "Operating margin requires revenue greater than zero.",
};

export function SecAnnualOperatingValueContent({
  value,
}: {
  readonly value: PersonalSecAnnualOperatingValueDto;
}) {
  return value.status === "available" ? (
    <>
      <span className="sec-annual-liquidity-amount">
        {value.value}
        {value.unit === "percent" ? "%" : ""}
      </span>
      <small>
        {value.startDate} to {value.endDate}
      </small>
      <small
        className={value.currentUseEligible ? undefined : "discovery-warning"}
      >
        {value.currentUseEligible
          ? "Within current-use limits at this load."
          : "Historical value; outside current-use limits at this load."}
      </small>
    </>
  ) : (
    <span className="sec-annual-liquidity-unavailable">
      Unavailable. {reasons[value.reason]}
    </span>
  );
}

export function SecAnnualOperatingResults({
  response,
  renderOperatingAction,
  headingTarget,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
  readonly renderOperatingAction?: (
    basis: PersonalSecAnnualOperatingMarginDto,
  ) => ReactNode;
  readonly headingTarget?: {
    readonly id: string;
    readonly ref: Ref<HTMLHeadingElement>;
  };
}) {
  const { resolution } = response.evidence.operatingResults;
  return (
    <section
      className="sec-annual-operating"
      aria-label="Annual operating results"
    >
      <h4
        id={headingTarget?.id}
        ref={headingTarget?.ref}
        tabIndex={headingTarget ? -1 : undefined}
        data-annual-report-target={headingTarget ? "operating" : undefined}
      >
        Operating results
      </h4>
      <p className="sec-quarterly-message">
        Exact, unscaled USD from the selected annual filing. Reported operating
        income is checked independently of revenue and net income.
      </p>
      <dl className="sec-annual-cash-values">
        <div>
          <dt>Reported operating income · USD</dt>
          <dd>
            <SecAnnualOperatingValueContent
              value={resolution.operatingIncome}
            />
          </dd>
        </div>
      </dl>
      {resolution.margins.map((basis) => (
        <section
          key={basis.concept}
          aria-label={`Operating margin basis ${basis.concept}`}
        >
          <h5>{managedAnnualBasisLabel(basis.concept)}</h5>
          <dl className="sec-annual-cash-values">
            <div>
              <dt>Reported revenue · USD</dt>
              <dd>
                <SecAnnualOperatingValueContent value={basis.revenue} />
              </dd>
            </div>
            <div>
              <dt>Operating margin · App calculation</dt>
              <dd>
                <SecAnnualOperatingValueContent value={basis.operatingMargin} />
              </dd>
            </div>
          </dl>
          {renderOperatingAction?.(basis)}
        </section>
      ))}
      <p className="sec-quarterly-message">
        Operating margin divides reported operating income by the selected
        positive revenue and multiplies by 100. It uses the same filing and
        exact period, rounded to two decimal places, half up. Revenue bases stay
        separate. Negative operating income is valid. This measure does not
        establish adjusted earnings, EBIT or EBITDA.
      </p>
      <details className="sec-quarterly-row-details sec-annual-operating-source">
        <summary>Operating sources and calculation inputs</summary>
        <SecAnnualOperatingSourceBody response={response} />
      </details>
    </section>
  );
}

export function SecAnnualOperatingSourceBody({
  response,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
}) {
  const { operatingResults, generation } = response.evidence;
  const { resolution, operatingIncome } = operatingResults;
  return (
    <>
      <p>
        Annual cutoff {generation.cutoffAt}. Company Facts captured{" "}
        {generation.sources.companyFacts.fetchedAt ?? "Unavailable"}.
        Submissions captured{" "}
        {generation.sources.submissions.fetchedAt ?? "Unavailable"}. Completed{" "}
        {generation.completedAt}.
      </p>
      {resolution.utilityAge && (
        <p>
          Report age at cutoff: {resolution.utilityAge.endAgeDays} days. Current
          use requires a report within 485 days and source captures within seven
          days.
        </p>
      )}
      <p>
        Only reported OperatingIncomeLoss USD observations are used for
        operating income. Missing values are not filled from other concepts or
        filings.
      </p>
      {operatingIncome.scan.status === "available" ? (
        <p>
          Scanned {operatingIncome.scan.coverage.full.inspectedRows} rows:{" "}
          {operatingIncome.scan.coverage.full.invalidRows} invalid,{" "}
          {operatingIncome.scan.coverage.full.duplicateRows} identical
          duplicates. Returned {operatingIncome.scan.coverage.returned} of{" "}
          {operatingIncome.scan.coverage.selected ?? "unresolved"}{" "}
          selected-filing observations;{" "}
          {operatingIncome.scan.coverage.omittedSelected ?? "unknown"} omitted.{" "}
          {operatingIncome.scan.absence &&
            reasons[operatingIncome.scan.absence]}
        </p>
      ) : (
        <p>{reasons[operatingIncome.scan.status]}</p>
      )}
      <h5>Operating income source observations</h5>
      <ol>
        {operatingIncome.observations.map((row) => (
          <li key={row.id}>
            <ObservationDetails row={row} />
          </li>
        ))}
      </ol>
      <h5>Revenue source observations</h5>
      <ol>
        {response.evidence.observations
          .filter((row) => row.metric === "revenue")
          .map((row) => (
            <li key={row.id}>
              <ObservationDetails row={row} />
            </li>
          ))}
      </ol>
      {resolution.margins.map((basis) => (
        <p key={basis.concept}>
          {basis.concept} margin references:{" "}
          {basis.operatingMargin.observationIds.join(" · ") || "None"}
        </p>
      ))}
    </>
  );
}
