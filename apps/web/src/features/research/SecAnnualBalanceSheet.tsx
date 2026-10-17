import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import type {
  PersonalSecAnnualStatementScanDto,
  PersonalSecAnnualStatementObservationDto,
  PersonalSecAnnualBalanceSheetValueDto,
  PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import type { Ref } from "react";
import {
  annualLiquidityUnavailableReasonText,
  SecAnnualBalanceObservation,
} from "./SecAnnualLiquidity";

import { SecAnnualBalanceSheetHistory } from "./SecAnnualBalanceSheetHistory";

const metrics = [
  ["totalAssets", "Total assets", "Assets"],
  ["totalLiabilities", "Total liabilities", "Liabilities"],
  ["shareholdersEquity", "Shareholders’ equity · parent", "StockholdersEquity"],
] as const;

export function SecAnnualBalanceSheet({
  response,
  view,
  headingTarget,
}: {
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly view: PersonalSecAnnualCanonicalView;
  readonly headingTarget?: {
    readonly id: string;
    readonly ref: Ref<HTMLHeadingElement>;
  };
}) {
  const { target } = response.evidence;
  const balanceSheet = view.balanceSheet;
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
      <SecAnnualBalanceSheetHistory response={response} view={view} />
      <details className="sec-quarterly-row-details sec-annual-balance-sheet-source">
        <summary>Balance sheet sources and reported inputs</summary>
        <SecAnnualBalanceSheetSourceBody response={response} view={view} />
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
  view,
}: {
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly view: PersonalSecAnnualCanonicalView;
}) {
  const { generation, facts } = response.evidence;
  const balanceSheet = view.balanceSheet;
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
      {metrics.map(([key, label, concept]) => (
        <BalanceSheetInputs
          key={key}
          label={label}
          scan={facts.scans.find((entry) => entry.concept === concept)!.scan}
          observations={facts.observations.filter(
            (row) => row.concept === concept,
          )}
          value={balanceSheet.resolution[key]}
        />
      ))}
    </>
  );
}

function BalanceSheetInputs({
  label,
  scan,
  observations,
  value,
}: {
  readonly label: string;
  readonly scan: PersonalSecAnnualStatementScanDto;
  readonly observations: readonly PersonalSecAnnualStatementObservationDto[];
  readonly value: PersonalSecAnnualBalanceSheetValueDto;
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
          {scan.absence &&
            ` ${annualLiquidityUnavailableReasonText(scan.absence)}`}
        </p>
      ) : (
        <p>{annualLiquidityUnavailableReasonText(scan.status)}</p>
      )}
      <p>Value references: {value.observationIds.join(" · ") || "None"}</p>
      <ol>
        {observations.map((row) => (
          <li key={row.id}>
            <SecAnnualBalanceObservation row={row} />
          </li>
        ))}
      </ol>
    </section>
  );
}
