import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualPairDto,
} from "@research-cockpit/contracts";
import type {
  PersonalSecAnnualComparison,
  PersonalSecAnnualHistory,
} from "@research-cockpit/personal-financial-analytics";
import {
  annualComparisonPercentText,
  annualMarginChangeText,
} from "../../lib/sec-annual-comparison-display";

type AvailableComparison = Extract<
  PersonalSecAnnualComparison,
  { status: "available" }
>;

/** Presentation only: all values and eligibility come from the annual resolver. */
export function AnnualOverviewSummary({
  response,
  targetMessage,
  completenessMessage,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
  readonly targetMessage: string | null;
  readonly completenessMessage: string | null;
}) {
  const { target, resolution, generation } = response.evidence;
  return (
    <header className="managed-annual-summary">
      <p>
        {target.status === "target"
          ? `${target.form} · report ending ${target.reportDate} · filed ${target.filedDate}`
          : targetMessage}
      </p>
      <p>
        SEC evidence · loaded{" "}
        <time dateTime={generation.completedAt}>{generation.completedAt}</time>
        {target.status === "target" && (
          <>
            {" "}
            ·{" "}
            <a
              href={`https://www.sec.gov/Archives/edgar/data/${response.evidence.cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open observed filing index
            </a>
          </>
        )}
      </p>
      <p
        className={
          resolution.currentTargetEligible
            ? "managed-annual-age"
            : "discovery-warning"
        }
      >
        {resolution.currentTargetEligible
          ? "Within current-use limits at this load."
          : "Unavailable under the current-use policy at this load. Any valid reported amounts below remain historical; comparison and history are unavailable."}
      </p>
      {completenessMessage && (
        <p className="discovery-warning">
          Annual values withheld. {completenessMessage}
        </p>
      )}
      <p className="managed-annual-basis-help">
        Exact, unscaled USD · separate revenue bases. Period length, accounting
        changes and restatements are unadjusted.
      </p>
    </header>
  );
}

export function SecAnnualFinancials({
  pair,
  comparison,
  history,
  comparisonMessage,
  historyMessage,
}: {
  readonly pair: PersonalSecAnnualPairDto;
  readonly comparison: PersonalSecAnnualComparison | null;
  readonly history: PersonalSecAnnualHistory | null;
  readonly comparisonMessage: string | null;
  readonly historyMessage: string | null;
}) {
  const periods = history?.status === "available" ? history.periods : [pair];
  const earlier =
    history?.status === "available" ? history.comparisons[1] : undefined;
  return (
    <div className="managed-annual-financials">
      <ReportedAmounts periods={periods} />
      <CurrentReportedComparison
        comparison={comparison}
        concept={pair.concept}
      />
      {comparisonMessage && (
        <p className="managed-annual-unavailable">
          Reported annual comparison unavailable. {comparisonMessage}
        </p>
      )}
      {earlier && (
        <ReportedChanges
          comparison={earlier}
          concept={pair.concept}
          label="Earlier reported annual comparison"
        />
      )}
      {historyMessage && (
        <p className="managed-annual-unavailable">
          The next earlier period is unavailable. {historyMessage}
        </p>
      )}
      <p className="managed-annual-basis-help">
        Up to three adjacent periods from the same filing. Changes compare the
        exact reported amounts; percentages require a positive prior value.
        These are reported comparatives, not as-originally-filed history or
        organic growth.
      </p>
    </div>
  );
}

function CurrentReportedComparison({
  comparison,
  concept,
}: {
  readonly comparison: PersonalSecAnnualComparison | null;
  readonly concept: PersonalSecAnnualPairDto["concept"];
}) {
  if (comparison?.status !== "available") return null;
  return (
    <>
      <ReportedChanges
        comparison={comparison}
        concept={concept}
        label="Reported annual comparison"
      />
      <p className="managed-annual-margin-change">
        Net margin change · {annualMarginChangeText(comparison.netMargin)}
      </p>
    </>
  );
}

function ReportedAmounts({
  periods,
}: {
  readonly periods: readonly Pick<
    PersonalSecAnnualPairDto,
    "startDate" | "endDate" | "revenue" | "netIncome" | "netMarginPercent"
  >[];
}) {
  return (
    <table className="managed-annual-values">
      <caption>
        Reported annual amounts · {periods.length}{" "}
        {periods.length === 1 ? "period" : "periods"} · newest first
      </caption>
      <thead>
        <tr>
          <th scope="col">Metric</th>
          {periods.map((period) => (
            <th scope="col" key={period.endDate}>
              <time dateTime={period.startDate ?? undefined}>
                {period.startDate ?? "Start date unknown"}
              </time>
              <span>to</span>
              <time dateTime={period.endDate}>{period.endDate}</time>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">
            Revenue <small>USD</small>
          </th>
          {periods.map((period) => (
            <td key={period.endDate}>{period.revenue}</td>
          ))}
        </tr>
        <tr>
          <th scope="row">
            Net income <small>USD</small>
          </th>
          {periods.map((period) => (
            <td key={period.endDate}>{period.netIncome}</td>
          ))}
        </tr>
        <tr>
          <th scope="row">
            Net margin <small>%</small>
          </th>
          {periods.map((period) => (
            <td key={period.endDate}>
              {period.netMarginPercent === null
                ? "Unavailable: revenue must be positive"
                : `${period.netMarginPercent}%`}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function ReportedChanges({
  comparison,
  label,
  concept,
}: {
  readonly comparison: Pick<
    AvailableComparison,
    | "priorStartDate"
    | "priorEndDate"
    | "currentStartDate"
    | "currentEndDate"
    | "revenue"
    | "netIncome"
  >;
  readonly concept: PersonalSecAnnualPairDto["concept"];
  readonly label: string;
}) {
  return (
    <table
      className="managed-annual-changes"
      aria-label={`${label} ${concept}`}
    >
      <caption>
        {label}
        <span>
          Prior: {comparison.priorStartDate} to {comparison.priorEndDate}.
          Current: {comparison.currentStartDate} to {comparison.currentEndDate}.
        </span>
      </caption>
      <thead>
        <tr>
          <th scope="col">Metric</th>
          <th scope="col">Change · USD</th>
          <th scope="col">Reported change</th>
        </tr>
      </thead>
      <tbody>
        {(["revenue", "netIncome"] as const).map((metric) => (
          <tr key={metric}>
            <th scope="row">
              {metric === "revenue" ? "Revenue" : "Net income"}
            </th>
            <td>{comparison[metric].difference}</td>
            <td>{annualComparisonPercentText(comparison[metric])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
