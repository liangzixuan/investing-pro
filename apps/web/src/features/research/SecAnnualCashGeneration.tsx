import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import type {
  PersonalSecAnnualStatementScanDto,
  PersonalSecAnnualStatementObservationDto,
  PersonalSecAnnualCashUnavailableReason,
  PersonalSecAnnualCashValueDto,
  PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { ObservationDetails } from "./SecAnnualObservation";
import type { ReactNode, Ref } from "react";

const reasons: Record<PersonalSecAnnualCashUnavailableReason, string> = {
  invalid_clock: "The original source times could not be validated.",
  source_unavailable: "A required SEC source is unavailable.",
  source_stale: "The source captures exceed the seven-day freshness limit.",
  target_unresolved: "The annual filing could not be resolved.",
  invalid_response: "This cash concept could not be validated.",
  candidate_limit: "This cash concept exceeds the source scan limit.",
  invalid_source_rows: "This cash concept contains invalid observations.",
  selected_report_overflow: "This filing exceeds the cash observation limit.",
  concept_missing: "This reported cash concept is absent from the source.",
  usd_missing: "This reported cash concept has no USD observations.",
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
    "The filing's time relative to the load is unresolved.",
  report_date_missing: "The filing's report date is missing.",
  filed_date_missing: "The filing date is missing.",
  ambiguous_period: "The source contains conflicting annual periods.",
  ambiguous_value: "The source contains conflicting reported amounts.",
  period_mismatch: "The reported cash amounts cover different periods.",
  filing_mismatch: "The reported cash amounts come from different filings.",
  unsupported_sign:
    "Reported PP&E purchases are negative; this subtraction is unavailable.",
};

export function SecAnnualCashGeneration({
  response,
  view,
  cashAction,
  margins,
  history,
  headingTarget,
}: {
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly view: PersonalSecAnnualCanonicalView;
  readonly cashAction?: ReactNode;
  readonly margins?: ReactNode;
  readonly history?: ReactNode;
  readonly headingTarget?: {
    readonly id: string;
    readonly ref: Ref<HTMLHeadingElement>;
  };
}) {
  const cash = view.cashGeneration;
  return (
    <section className="sec-annual-cash" aria-label="Annual cash generation">
      <h4
        id={headingTarget?.id}
        ref={headingTarget?.ref}
        tabIndex={headingTarget ? -1 : undefined}
        data-annual-report-target={headingTarget ? "cash" : undefined}
      >
        Cash generation
      </h4>
      <p className="sec-quarterly-message">
        Exact, unscaled USD from the selected annual filing. Each reported
        amount is checked independently.
      </p>
      <dl className="sec-annual-cash-values">
        <CashValue
          label="Operating cash flow"
          value={cash.resolution.operatingCashFlow}
        />
        <CashValue
          label="PP&E purchases"
          value={cash.resolution.ppePurchases}
        />
        <CashValue
          label="Operating cash flow less PP&E purchases"
          value={cash.resolution.operatingCashFlowLessPpePurchases}
          calculated
        />
      </dl>
      <p className="sec-quarterly-message">
        The app calculation subtracts purchases of property, plant and equipment
        from operating cash flow for the same filing and period. It does not
        adjust for leases, acquisitions or other investing cash flows.
      </p>
      {cashAction}
      {margins}
      {history}
      <details className="sec-quarterly-row-details sec-annual-cash-source">
        <summary>Cash sources and calculation inputs</summary>
        <SecAnnualCashSourceBody response={response} view={view} />
      </details>
    </section>
  );
}

function CashValue({
  label,
  value,
  calculated = false,
}: {
  readonly label: string;
  readonly value: PersonalSecAnnualCashValueDto;
  readonly calculated?: boolean;
}) {
  return (
    <div>
      <dt>
        {label}
        <small>{calculated ? "App calculation" : "Reported"} · USD</small>
      </dt>
      <dd>
        <SecAnnualCashValueContent value={value} />
      </dd>
    </div>
  );
}

export function SecAnnualCashValueContent({
  value,
}: {
  readonly value: PersonalSecAnnualCashValueDto;
}) {
  return value.status === "available" ? (
    <>
      <span className="sec-annual-cash-amount">{value.value}</span>
      <small>
        {value.startDate} to {value.endDate}
      </small>
      <small
        className={value.currentUseEligible ? undefined : "discovery-warning"}
      >
        {value.currentUseEligible
          ? "Within current-use limits at this load."
          : "Historical amount; outside current-use limits at this load."}
      </small>
    </>
  ) : (
    <span className="sec-annual-cash-unavailable">
      Unavailable. {annualCashUnavailableReasonText(value.reason)}
    </span>
  );
}

export function annualCashUnavailableReasonText(
  reason: PersonalSecAnnualCashUnavailableReason,
): string {
  return reasons[reason];
}

export function SecAnnualCashSourceBody({
  response,
  view,
}: {
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly view: PersonalSecAnnualCanonicalView;
}) {
  const { generation, facts } = response.evidence;
  const cash = view.cashGeneration;
  return (
    <>
      <p>
        Company Facts captured{" "}
        {generation.sources.companyFacts.fetchedAt ?? "Unavailable"}.
        Submissions captured{" "}
        {generation.sources.submissions.fetchedAt ?? "Unavailable"}. Completed{" "}
        {generation.completedAt}.
      </p>
      {cash.resolution.utilityAge && (
        <p>
          Report age at cutoff: {cash.resolution.utilityAge.endAgeDays} days.
          Current use requires a report within 485 days and source captures
          within seven days.
        </p>
      )}
      <CashInputs
        label="Operating cash flow"
        scan={
          facts.scans.find(
            (entry) =>
              entry.concept === "NetCashProvidedByUsedInOperatingActivities",
          )!.scan
        }
        observations={facts.observations.filter(
          (row) => row.concept === "NetCashProvidedByUsedInOperatingActivities",
        )}
      />
      <CashInputs
        label="PP&E purchases"
        scan={
          facts.scans.find(
            (entry) =>
              entry.concept === "PaymentsToAcquirePropertyPlantAndEquipment",
          )!.scan
        }
        observations={facts.observations.filter(
          (row) => row.concept === "PaymentsToAcquirePropertyPlantAndEquipment",
        )}
      />
      <p>
        Calculation references:{" "}
        {cash.resolution.operatingCashFlowLessPpePurchases.observationIds.join(
          " · ",
        ) || "None"}
      </p>
    </>
  );
}

function CashInputs({
  label,
  scan,
  observations,
}: {
  readonly label: string;
  readonly scan: PersonalSecAnnualStatementScanDto;
  readonly observations: readonly PersonalSecAnnualStatementObservationDto[];
}) {
  return (
    <section aria-label={`${label} source inputs`}>
      <h5>{label}</h5>
      {scan.status === "available" ? (
        <p>
          Scanned {scan.coverage.full.inspectedRows} rows:{" "}
          {scan.coverage.full.invalidRows} invalid,{" "}
          {scan.coverage.full.duplicateRows} identical duplicates. Returned{" "}
          {scan.coverage.returned} of {scan.coverage.selected ?? "unresolved"}{" "}
          selected-filing observations;{" "}
          {scan.coverage.omittedSelected ?? "unknown"} omitted.
          {scan.absence && ` ${reasons[scan.absence]}`}
        </p>
      ) : (
        <p>{reasons[scan.status]}</p>
      )}
      <ol>
        {observations.map((row) => (
          <li key={row.id}>
            <ObservationDetails row={row} />
          </li>
        ))}
      </ol>
    </section>
  );
}
