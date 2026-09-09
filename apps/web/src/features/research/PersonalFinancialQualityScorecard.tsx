import type { PersonalAnnualFinancialsDto } from "@research-cockpit/contracts";
import {
  buildPersonalFinancialQualityScorecard,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_FACT_KEYS,
} from "@research-cockpit/personal-financial-analytics";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export interface PersonalFinancialQualityScorecardProps {
  readonly financials: PersonalAnnualFinancialsDto | null;
  readonly selection: PersonalMarketSelection | null;
}

type ScorecardResult = ReturnType<
  typeof buildPersonalFinancialQualityScorecard
>;
type ReadyScorecard = Extract<ScorecardResult, { status: "ready" }>;
type ScorecardCheck = ReadyScorecard["groups"][number]["checks"][number];
type ScorecardObservation = ScorecardCheck["currentObservation"];

const groupDisplayLabels = {
  balance_sheet: "Balance sheet",
  growth_efficiency: "Growth & efficiency",
  profitability_cash: "Profitability & cash",
} as const satisfies Readonly<
  Record<ReadyScorecard["groups"][number]["groupId"], string>
>;

export function PersonalFinancialQualityScorecard({
  financials,
  selection,
}: PersonalFinancialQualityScorecardProps) {
  const exactFinancials =
    selection !== null &&
    financials !== null &&
    isExactListing(financials, selection)
      ? financials
      : null;
  const result =
    exactFinancials === null
      ? null
      : buildPersonalFinancialQualityScorecard(
          mapAnnualFinancials(exactFinancials),
        );

  return (
    <section
      aria-describedby="personal-financial-quality-intro personal-financial-quality-caveat"
      aria-labelledby="personal-financial-quality-title"
      className="personal-financials-panel personal-quality-scorecard"
    >
      <div className="discovery-section-heading personal-financials-heading personal-quality-scorecard-heading">
        <div>
          <p className="eyebrow">Transparent annual diagnostics</p>
          <h2 id="personal-financial-quality-title">
            Financial quality and balance-sheet checks
          </h2>
        </div>
        <ScorecardSummary result={result} />
      </div>

      <p
        className="market-scope-note personal-quality-scorecard-intro"
        id="personal-financial-quality-intro"
      >
        Twelve fixed checks explain whether the provider-reported annual figures
        meet each published test. Every result keeps its formula, fiscal
        periods, and exact source references visible.
      </p>

      {selection === null ? (
        <ReadinessState
          detail="Use “View market” in search results or My Watchlist, then load annual financials for that exact admitted listing."
          title="Select a company and load annual financials."
        />
      ) : financials === null ? (
        <ReadinessState
          detail="Open the Annual financials panel and load provider-reported annual statements before running these checks."
          title={`Load annual financials for ${selection.symbol}.`}
        />
      ) : exactFinancials === null ? (
        <ReadinessState
          detail="The loaded statements belong to a different listing and are ignored. Reload annual financials for the selected listing."
          title={`Reload annual financials for ${selection.symbol}.`}
        />
      ) : result?.status === "ready" ? (
        <ReadyResult result={result} symbol={selection.symbol} />
      ) : result?.status === "quarantined" ? (
        <QuarantinedResult result={result} />
      ) : null}

      <p
        className="fcff-dcf-caveat personal-quality-scorecard-caveat"
        id="personal-financial-quality-caveat"
        role="note"
      >
        These checks use the provider&apos;s most-recent corrected annual
        statements. They are not sector-adjusted and are not a Piotroski
        F-Score, Altman Z-Score, or Beneish M-Score. They are not a health
        grade, rating, or buy/sell signal. The panel runs in active-session
        browser memory only, makes no network request, persists nothing, and
        provides no export.
      </p>
    </section>
  );
}

function ScorecardSummary({
  result,
}: {
  readonly result: ScorecardResult | null;
}) {
  if (result?.status !== "ready") {
    return (
      <span className="personal-quality-scorecard-summary">
        12 transparent checks
      </span>
    );
  }

  return (
    <span aria-live="polite" className="personal-quality-scorecard-summary">
      {result.counts.met} met · {result.counts.notMet} not met ·{" "}
      {result.counts.unavailable} unavailable
    </span>
  );
}

function ReadyResult({
  result,
  symbol,
}: {
  readonly result: ReadyScorecard;
  readonly symbol: string;
}) {
  return (
    <div className="personal-financials-result personal-quality-scorecard-result">
      <div className="financials-coverage-strip personal-quality-scorecard-counts">
        <div>
          <span>Checks evaluated</span>
          <strong>
            {result.counts.evaluated} / {result.counts.total}
          </strong>
        </div>
        <div>
          <span>Met</span>
          <strong>{result.counts.met}</strong>
        </div>
        <div>
          <span>Not met</span>
          <strong>{result.counts.notMet}</strong>
        </div>
        <div>
          <span>Unavailable</span>
          <strong>{result.counts.unavailable}</strong>
        </div>
      </div>

      <p
        className="financials-ttm-gate personal-quality-scorecard-ready-note"
        role="status"
      >
        <strong>{symbol} annual diagnostic is ready.</strong>
        <span>
          Formula set {result.formulaSetVersion} · provider-most-recent basis ·
          source response {result.asOf} · calculated in browser memory
        </span>
      </p>

      <div className="financial-statement-stack personal-quality-scorecard-groups">
        {result.groups.map((group) => {
          const titleId = `personal-financial-quality-${group.groupId}`;
          const groupLabel = groupDisplayLabels[group.groupId];
          return (
            <section
              aria-labelledby={titleId}
              className="personal-quality-scorecard-group"
              key={group.groupId}
            >
              <h3 id={titleId}>{groupLabel}</h3>
              <div
                aria-label={`${groupLabel} financial quality checks`}
                className="fcff-dcf-table-scroll personal-quality-scorecard-table-scroll"
                role="region"
                tabIndex={0}
              >
                <table className="personal-quality-scorecard-table">
                  <caption>
                    {groupLabel} · exact annual checks and admitted sources
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Check</th>
                      <th scope="col">Result</th>
                      <th scope="col">Exact test</th>
                      <th scope="col">Current observation</th>
                      <th scope="col">Prior observation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.checks.map((check) => (
                      <CheckRow check={check} key={check.checkId} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CheckRow({ check }: { readonly check: ScorecardCheck }) {
  const status = checkStatusLabel(check.status);
  return (
    <tr data-status={check.status}>
      <th scope="row">
        <span>{check.label}</span>
        <small>
          {check.formulaId} · formula {check.formulaVersion}
        </small>
      </th>
      <td
        aria-label={`${check.label}: ${status}`}
        className="personal-quality-scorecard-status"
      >
        <strong>{status}</strong>
        {check.status === "unavailable" ? (
          <small className="personal-quality-scorecard-unavailable-reason">
            Reason: {unavailableReasonLabel(check.reason)} ({check.reason})
          </small>
        ) : null}
      </td>
      <td className="personal-quality-scorecard-expression">
        <code>{check.expression}</code>
      </td>
      <td className="personal-quality-scorecard-observation-cell">
        <Observation observation={check.currentObservation} />
      </td>
      <td className="personal-quality-scorecard-observation-cell">
        <Observation observation={check.priorObservation} />
      </td>
    </tr>
  );
}

function Observation({
  observation,
}: {
  readonly observation: ScorecardObservation;
}) {
  if (observation === null) {
    return <span>Not required</span>;
  }

  return (
    <span className="personal-quality-scorecard-observation">
      <span className="personal-quality-scorecard-observation-value">
        FY {observation.fiscalYear} ·{" "}
        {observation.value === null
          ? "Unavailable"
          : formatObservationValue(observation.value, observation.unit)}
      </span>
      <small className="personal-quality-scorecard-observation-meta">
        Statement {observation.statementDate} ·{" "}
        {observation.inputRefs.length === 0
          ? "No admitted source"
          : `Sources ${observation.inputRefs
              .map((input) => `${input.factKey} ← ${input.sourceRef}`)
              .join(" + ")}`}
      </small>
    </span>
  );
}

function QuarantinedResult({
  result,
}: {
  readonly result: Extract<ScorecardResult, { status: "quarantined" }>;
}) {
  return (
    <div
      className="market-message market-message-error personal-quality-scorecard-quarantine"
      role="alert"
    >
      <strong>Financial quality checks were withheld.</strong>
      <span>
        The annual source packet failed structural validation. No derived check,
        count, or observation is shown.
      </span>
      <ul>
        {result.issues.map((issue, issueIndex) => (
          <li
            key={`${String(issue.index)}:${issue.reason}:${String(issueIndex)}`}
          >
            {issue.index === null
              ? "Packet"
              : `Annual period ${issue.index + 1}`}
            : {quarantineReasonLabel(issue.reason)} ({issue.reason})
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReadinessState({
  detail,
  title,
}: {
  readonly detail: string;
  readonly title: string;
}) {
  return (
    <div className="discovery-empty-state market-empty-state personal-quality-scorecard-readiness">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function mapAnnualFinancials(financials: PersonalAnnualFinancialsDto) {
  return {
    asOf: financials.asOf,
    periods: financials.years.map((year) => ({
      facts: PERSONAL_FINANCIAL_QUALITY_SCORECARD_FACT_KEYS.flatMap((key) => {
        const cell = year.reported[key];
        return cell.status === "known"
          ? [
              {
                key,
                sourceRef: `${String(year.fiscalYear)}:${key}`,
                unit: "USD" as const,
                value: cell.value,
              },
            ]
          : [];
      }),
      fiscalYear: year.fiscalYear,
      statementDate: year.statementDate,
    })),
  };
}

function isExactListing(
  financials: PersonalAnnualFinancialsDto,
  selection: PersonalMarketSelection,
) {
  return (
    financials.security.country === "US" &&
    financials.security.exchangeMic === selection.exchangeMic &&
    financials.security.issuerName === selection.issuerName &&
    financials.security.listingId === selection.listingId &&
    financials.security.securityName === selection.securityName &&
    financials.security.symbol === selection.symbol
  );
}

function checkStatusLabel(status: ScorecardCheck["status"]): string {
  if (status === "met") return "Met";
  if (status === "not_met") return "Not met";
  return "Unavailable";
}

function formatObservationValue(
  value: string,
  unit: Exclude<ScorecardObservation, null>["unit"],
): string {
  return unit === "USD" ? `USD ${value}` : `${value} ratio`;
}

function unavailableReasonLabel(reason: string): string {
  return reason
    .split("_")
    .map((part, index) =>
      index === 0 ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part,
    )
    .join(" ");
}

function quarantineReasonLabel(reason: string): string {
  return unavailableReasonLabel(reason);
}
