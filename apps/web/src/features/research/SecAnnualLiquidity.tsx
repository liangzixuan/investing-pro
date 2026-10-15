import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualLiquidityMetricEvidenceDto,
  PersonalSecAnnualLiquidityObservationDto,
  PersonalSecAnnualLiquidityUnavailableReason,
  PersonalSecAnnualLiquidityValueDto,
  PersonalSecAnnualBalanceSheetObservationDto,
} from "@research-cockpit/contracts";
import type { ReactNode, Ref } from "react";

const reasons: Record<PersonalSecAnnualLiquidityUnavailableReason, string> = {
  invalid_clock: "The original source times could not be validated.",
  source_unavailable: "A required SEC source is unavailable.",
  source_stale: "The source captures exceed the seven-day freshness limit.",
  target_unresolved: "The annual filing could not be resolved.",
  invalid_response: "This balance concept could not be validated.",
  candidate_limit: "This balance concept exceeds the source scan limit.",
  invalid_source_rows: "This balance concept contains invalid observations.",
  selected_report_overflow:
    "This filing exceeds the balance observation limit.",
  concept_missing: "This reported balance concept is absent from the source.",
  usd_missing: "This reported balance concept has no USD observations.",
  empty_usd: "The source contains no USD observations for this concept.",
  no_report_date:
    "No observation matches the selected filing's report-end date.",
  unsupported_form: "The observation is not from an unamended annual filing.",
  missing_or_non_FY_focus:
    "The observation lacks an annual filing-focus label.",
  invalid_instant_period:
    "The source observation has a period rather than a balance at one date.",
  filing_unmatched_or_conflicted:
    "The observation's filing metadata does not match submissions.",
  report_end_mismatch:
    "The balance date differs from the selected report's end date.",
  future_or_inconsistent_dates:
    "The source dates are future-dated or inconsistent.",
  cutoff_time_unresolved:
    "The filing's time relative to this load could not be resolved.",
  report_date_missing: "The filing's report date is missing.",
  filed_date_missing: "The filing date is missing.",
  ambiguous_value: "The source contains conflicting reported balances.",
  balance_date_mismatch: "The reported balances have different dates.",
  filing_mismatch: "The reported balances come from different filings.",
  unsupported_sign: "This calculation requires nonnegative reported balances.",
  nonpositive_current_liabilities:
    "Current ratio requires current liabilities greater than zero.",
};

export function annualLiquidityUnavailableReasonText(
  reason: PersonalSecAnnualLiquidityUnavailableReason,
): string {
  return reasons[reason];
}

export function SecAnnualLiquidity({
  response,
  liquidityAction,
  history,
  headingTarget,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
  readonly liquidityAction?: ReactNode;
  readonly history?: ReactNode;
  readonly headingTarget?: {
    readonly id: string;
    readonly ref: Ref<HTMLHeadingElement>;
  };
}) {
  const { liquidity, target } = response.evidence;
  const values = liquidity.resolution;
  return (
    <section className="sec-annual-liquidity" aria-label="Annual liquidity">
      <h4
        id={headingTarget?.id}
        ref={headingTarget?.ref}
        tabIndex={headingTarget ? -1 : undefined}
        data-annual-report-target={headingTarget ? "liquidity" : undefined}
      >
        Liquidity at fiscal year-end
      </h4>
      <p className="sec-quarterly-message">
        Exact, unscaled USD balances from the selected annual filing. Each
        reported amount is checked independently. Current ratio is a rounded
        multiple.
      </p>
      <div
        className="sec-annual-liquidity-results"
        role="region"
        aria-label="Annual liquidity results"
        tabIndex={0}
      >
        <table>
          <caption>
            {target.status === "target"
              ? `Balances at ${target.reportDate}`
              : "Balance date unavailable"}
          </caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <LiquidityRow label="Current assets" value={values.currentAssets} />
            <LiquidityRow
              label="Current liabilities"
              value={values.currentLiabilities}
            />
            <LiquidityRow
              label="Working capital"
              value={values.workingCapital}
              calculated
            />
            <LiquidityRow
              label="Current ratio"
              value={values.currentRatio}
              calculated
            />
          </tbody>
        </table>
      </div>
      <p className="sec-quarterly-message">
        Working capital subtracts current liabilities from current assets.
        Current ratio divides current assets by current liabilities and rounds
        to two decimal places, half up. Both calculations require nonnegative
        balances from the same filing and date; the ratio requires positive
        liabilities.
      </p>
      {liquidityAction}
      {history}
      <details className="sec-quarterly-row-details sec-annual-liquidity-source">
        <summary>Liquidity sources and calculation inputs</summary>
        <SecAnnualLiquiditySourceBody response={response} />
      </details>
    </section>
  );
}

function LiquidityRow({
  label,
  value,
  calculated = false,
}: {
  readonly label: string;
  readonly value: PersonalSecAnnualLiquidityValueDto;
  readonly calculated?: boolean;
}) {
  return (
    <tr>
      <th scope="row">
        {label}
        <small>
          {calculated ? "App calculation" : "Reported"} · {value.unit}
        </small>
      </th>
      <td>
        <SecAnnualLiquidityValueContent value={value} />
      </td>
    </tr>
  );
}

export function SecAnnualLiquidityValueContent({
  value,
}: {
  readonly value: PersonalSecAnnualLiquidityValueDto;
}) {
  return value.status === "available" ? (
    <>
      <span className="sec-annual-liquidity-amount">
        {value.value}
        {value.unit === "multiple" ? "×" : ""}
      </span>
      <small>At {value.asOfDate}</small>
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

export function SecAnnualLiquiditySourceBody({
  response,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
}) {
  const { generation, liquidity } = response.evidence;
  return (
    <>
      <p>
        Annual cutoff {generation.cutoffAt}. Company Facts captured{" "}
        {generation.sources.companyFacts.fetchedAt ?? "Unavailable"}.
        Submissions captured{" "}
        {generation.sources.submissions.fetchedAt ?? "Unavailable"}. Completed{" "}
        {generation.completedAt}.
      </p>
      {liquidity.resolution.utilityAge && (
        <p>
          Report age at cutoff: {liquidity.resolution.utilityAge.endAgeDays}{" "}
          days. Current use requires a report within 485 days and source
          captures within seven days.
        </p>
      )}
      <p>
        Only the reported AssetsCurrent and LiabilitiesCurrent USD concepts are
        used. These are balances at a date, not annual flows. Missing amounts
        are not filled from other concepts or filings; current assets are not
        all cash.
      </p>
      <LiquidityInputs
        label="Current assets"
        evidence={liquidity.currentAssets}
      />
      <LiquidityInputs
        label="Current liabilities"
        evidence={liquidity.currentLiabilities}
      />
      <p>
        Working capital references:{" "}
        {liquidity.resolution.workingCapital.observationIds.join(" · ") ||
          "None"}
      </p>
      <p>
        Current ratio references:{" "}
        {liquidity.resolution.currentRatio.observationIds.join(" · ") || "None"}
      </p>
    </>
  );
}

function LiquidityInputs({
  label,
  evidence,
}: {
  readonly label: string;
  readonly evidence: PersonalSecAnnualLiquidityMetricEvidenceDto;
}) {
  const { scan } = evidence;
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
        {evidence.observations.map((row) => (
          <li key={row.id}>
            <SecAnnualBalanceObservation row={row} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SecAnnualBalanceObservation({
  row,
}: {
  readonly row:
    | PersonalSecAnnualLiquidityObservationDto
    | PersonalSecAnnualBalanceSheetObservationDto;
}) {
  return (
    <details className="sec-quarterly-row-details">
      <summary>
        {row.concept} · Source end {row.endDate} · {row.value} USD
      </summary>
      <dl className="sec-quarterly-comparison-coordinates">
        <div>
          <dt>Exact USD observation</dt>
          <dd>{row.value}</dd>
        </div>
        <div>
          <dt>Source end date</dt>
          <dd>{row.endDate}</dd>
        </div>
        <div>
          <dt>Source start date</dt>
          <dd>{row.startDate ?? "Not supplied"}</dd>
        </div>
        <div>
          <dt>Source duration</dt>
          <dd>
            {row.durationDays === null
              ? "Not supplied; an instant balance requires no duration."
              : `${row.durationDays} days; not an instant balance.`}
          </dd>
        </div>
        <div>
          <dt>Filing focus, not balance year</dt>
          <dd>
            {row.filingFocusYear ?? "Unknown"} ·{" "}
            {row.filingFocusPeriod ?? "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Calendar frame</dt>
          <dd>{row.frame ?? "Not supplied"}</dd>
        </div>
        <div>
          <dt>Reported form / filed date</dt>
          <dd>
            {row.form} · {row.filedDate}
          </dd>
        </div>
        <div>
          <dt>Accession</dt>
          <dd>{row.accessionNumber}</dd>
        </div>
        <div>
          <dt>Joined filing metadata</dt>
          <dd>
            {row.filing.status === "matched"
              ? "Matched to current submissions"
              : "Filing metadata not matched"}
            {" · "}
            {row.filing.form ?? "Unknown"} · {row.filing.filedDate ?? "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Joined report / accepted time</dt>
          <dd>
            {row.filing.reportDate ?? "Unknown"} ·{" "}
            {row.filing.acceptedAt ?? "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Filing index</dt>
          <dd>
            {row.filing.sourceUrl ? (
              <a href={row.filing.sourceUrl} target="_blank" rel="noreferrer">
                Open original filing index
              </a>
            ) : (
              "Unavailable"
            )}
          </dd>
        </div>
        <div>
          <dt>Company Facts source pointer</dt>
          <dd>{row.sourceLocator}</dd>
        </div>
        <div>
          <dt>Observation identifier</dt>
          <dd>{row.id}</dd>
        </div>
      </dl>
    </details>
  );
}
