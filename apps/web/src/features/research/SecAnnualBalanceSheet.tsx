import type {
  PersonalSecAnnualBalanceSheetMetricEvidenceDto,
  PersonalSecAnnualBalanceSheetValueDto,
  PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import type { Ref } from "react";
import {
  annualLiquidityUnavailableReasonText,
  SecAnnualBalanceObservation,
} from "./SecAnnualLiquidity";

import { SecAnnualBalanceSheetHistory } from "./SecAnnualBalanceSheetHistory";

const metrics = [
  ["totalAssets", "Total assets"],
  ["totalLiabilities", "Total liabilities"],
  ["shareholdersEquity", "Shareholders’ equity · parent"],
] as const;

export function SecAnnualBalanceSheet({
  response,
  headingTarget,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
  readonly headingTarget?: {
    readonly id: string;
    readonly ref: Ref<HTMLHeadingElement>;
  };
}) {
  const { balanceSheet, target } = response.evidence;
  return (
    <section
      className="sec-annual-balance-sheet"
      aria-label="Annual balance sheet totals"
    >
      <h4
        id={headingTarget?.id}
        ref={headingTarget?.ref}
        tabIndex={headingTarget ? -1 : undefined}
        data-annual-report-target={headingTarget ? "balanceSheet" : undefined}
      >
        Balance sheet totals
      </h4>
      <p className="sec-quarterly-message">
        Exact, unscaled USD balances from the selected annual filing. Each total
        is checked independently. Parent equity excludes noncontrolling
        interests.
      </p>
      <div
        className="sec-annual-balance-sheet-results"
        role="region"
        aria-label="Annual balance sheet results"
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
            {metrics.map(([key, label]) => (
              <tr key={key}>
                <th scope="row">
                  {label}
                  <small>Reported · USD</small>
                </th>
                <td>
                  <SecAnnualBalanceSheetValueContent
                    value={balanceSheet.resolution[key]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SecAnnualBalanceSheetHistory response={response} />
      <details className="sec-quarterly-row-details sec-annual-balance-sheet-source">
        <summary>Balance sheet sources and reported inputs</summary>
        <SecAnnualBalanceSheetSourceBody response={response} />
      </details>
    </section>
  );
}

export function SecAnnualBalanceSheetValueContent({
  value,
}: {
  readonly value: PersonalSecAnnualBalanceSheetValueDto;
}) {
  return value.status === "available" ? (
    <>
      <span className="sec-annual-liquidity-amount">{value.value}</span>
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
      Unavailable. {annualLiquidityUnavailableReasonText(value.reason)}
    </span>
  );
}

export function SecAnnualBalanceSheetSourceBody({
  response,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
}) {
  const { balanceSheet, generation } = response.evidence;
  return (
    <>
      <p>
        Annual cutoff {generation.cutoffAt}. Company Facts captured{" "}
        {generation.sources.companyFacts.fetchedAt ?? "Unavailable"}.
        Submissions captured{" "}
        {generation.sources.submissions.fetchedAt ?? "Unavailable"}. Completed{" "}
        {generation.completedAt}.
      </p>
      {balanceSheet.resolution.utilityAge && (
        <p>
          Report age at cutoff: {balanceSheet.resolution.utilityAge.endAgeDays}{" "}
          days. Current use requires a report within 485 days and source
          captures within seven days.
        </p>
      )}
      <p>
        Only the reported us-gaap Assets, Liabilities and StockholdersEquity USD
        concepts are used. StockholdersEquity is equity attributable to the
        parent. Missing totals are not inferred from an accounting equation,
        other concepts or other filings. These balances are not market values.
      </p>
      {metrics.map(([key, label]) => (
        <BalanceSheetInputs
          key={key}
          label={label}
          evidence={balanceSheet[key]}
          value={balanceSheet.resolution[key]}
        />
      ))}
    </>
  );
}

function BalanceSheetInputs({
  label,
  evidence,
  value,
}: {
  readonly label: string;
  readonly evidence: PersonalSecAnnualBalanceSheetMetricEvidenceDto;
  readonly value: PersonalSecAnnualBalanceSheetValueDto;
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
          {scan.absence &&
            ` ${annualLiquidityUnavailableReasonText(scan.absence)}`}
        </p>
      ) : (
        <p>{annualLiquidityUnavailableReasonText(scan.status)}</p>
      )}
      <p>Value references: {value.observationIds.join(" · ") || "None"}</p>
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
