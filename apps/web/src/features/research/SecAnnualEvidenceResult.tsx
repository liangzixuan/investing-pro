import { ObservationDetails } from "./SecAnnualObservation";
import { SecAnnualCashGeneration } from "./SecAnnualCashGeneration";
import { SecAnnualCashHistory } from "./SecAnnualCashHistory";
import { SecAnnualOperatingResults } from "./SecAnnualOperatingResults";
import { SecAnnualOperatingHistory } from "./SecAnnualOperatingHistory";
import { SecAnnualLiquidity } from "./SecAnnualLiquidity";
import { SecAnnualBalanceSheet } from "./SecAnnualBalanceSheet";
import { SecAnnualLiquidityHistory } from "./SecAnnualLiquidityHistory";
import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualPairDto,
  PersonalSecAnnualOperatingMarginDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { ManagedAnnualReportNavigation } from "./ManagedAnnualReportNavigation";
import { ManagedAnnualTrend } from "./ManagedAnnualTrend";
import {
  SecAnnualFinancials,
  AnnualOverviewSummary,
} from "./SecAnnualFinancials";
import {
  comparePersonalSecAnnualEvidence,
  resolvePersonalSecAnnualHistory,
  type PersonalSecAnnualComparison,
  type PersonalSecAnnualHistory,
} from "@research-cockpit/personal-financial-analytics";
import {
  annualComparisonPercentText,
  annualMarginChangeText,
} from "../../lib/sec-annual-comparison-display";
import { managedAnnualBasisLabel } from "./managed-annual-basis-label";

type AnnualBasis =
  PersonalSecAnnualEvidenceResponseDto["evidence"]["resolution"]["bases"][number];

type FinancialReviewSlot = (
  inspect: (
    section: "operating" | "cash" | "liquidity" | "balanceSheet",
  ) => void,
) => ReactNode;

const sourceStatuses = {
  available: "Available",
  not_covered: "No coverage for this issuer",
  rate_limited: "SEC request rate limited",
  upstream_unavailable: "SEC source temporarily unavailable",
  invalid_response: "Source response could not be validated",
  response_too_large: "Source response exceeds the byte limit",
  candidate_limit: "Source exceeds the bounded scan limit",
} as const;

const reasons: Readonly<Record<string, string>> = {
  source_unavailable: "A required SEC source is unavailable.",
  invalid_source_rows:
    "The income scan contains invalid observations; revenue and net income are withheld.",
  target_unresolved: "The observed annual report could not be resolved.",
  selected_report_overflow:
    "The selected report exceeds the 100 revenue or 100 net-income reference limit.",
  invalid_clock: "Source capture times could not be validated.",
  source_stale: "The source captures exceed the seven-day freshness limit.",
  submissions_unavailable: "Current SEC submissions are unavailable.",
  invalid_submissions: "Current SEC submissions could not be validated.",
  target_missing_report_date: "An annual filing is missing its report date.",
  no_observed_annual_target:
    "No eligible annual report was observed in current submissions.",
  report_date_missing: "The report date is missing.",
  filed_date_missing: "The filed date is missing.",
  future_or_inconsistent_dates:
    "Source dates are future-dated or inconsistent.",
  cutoff_time_unresolved:
    "The filing's time relative to this load's cutoff is unresolved.",
  target_ambiguous:
    "More than one annual filing shares the observed target dates.",
  unsupported_form: "The observation is not from an unamended 10-K or 20-F.",
  missing_or_non_FY_focus:
    "The observation lacks an annual filing-focus label.",
  invalid_annual_period:
    "The observation does not establish a 335–395 day annual period.",
  filing_unmatched_or_conflicted:
    "The observation's filing metadata does not match current submissions.",
  report_end_mismatch:
    "The observation ends outside the selected report's period.",
  ambiguous_revenue_period_or_value:
    "Revenue has conflicting values or annual start dates.",
  income_missing_same_filing_period:
    "NetIncomeLoss is missing for this filing and exact period.",
  income_metadata_or_period_invalid:
    "Net-income metadata or its annual period could not be admitted.",
  ambiguous_income_value:
    "Net income has conflicting values for this filing and period.",
  nonpositive_revenue: "A margin requires revenue greater than zero.",
  income_only_other_period_or_accession:
    "Net income is present only for another period or filing.",
  no_income_observations: "No NetIncomeLoss observations were supplied.",
};

export function SecAnnualEvidenceResult({
  response,
  renderPairAction,
  cashAction,
  liquidityAction,
  renderOperatingAction,
  renderFinancialReview,
  appearance = "evidence",
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
  readonly renderPairAction?: (pair: PersonalSecAnnualPairDto) => ReactNode;
  readonly cashAction?: ReactNode;
  readonly liquidityAction?: ReactNode;
  readonly renderOperatingAction?: (
    basis: PersonalSecAnnualOperatingMarginDto,
  ) => ReactNode;
  readonly renderFinancialReview?: FinancialReviewSlot;
  readonly appearance?: "evidence" | "financial";
}) {
  if (appearance === "financial")
    return (
      <ManagedAnnualFinancialResult
        response={response}
        renderPairAction={renderPairAction}
        cashAction={cashAction}
        liquidityAction={liquidityAction}
        renderOperatingAction={renderOperatingAction}
        renderFinancialReview={renderFinancialReview}
      />
    );
  return (
    <div className="sec-quarterly-comparison">
      <AnnualEvidenceContext response={response} />
      <AnnualBases response={response} renderPairAction={renderPairAction} />
      <SecAnnualOperatingResults response={response} />
      <SecAnnualCashGeneration response={response} />
      <SecAnnualBalanceSheet response={response} />
      <AnnualEvidenceSources response={response} />
    </div>
  );
}

function ManagedAnnualFinancialResult({
  response,
  renderPairAction,
  cashAction,
  liquidityAction,
  renderOperatingAction,
  renderFinancialReview,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
  readonly renderPairAction:
    ((pair: PersonalSecAnnualPairDto) => ReactNode) | undefined;
  readonly cashAction: ReactNode;
  readonly liquidityAction: ReactNode;
  readonly renderOperatingAction:
    ((basis: PersonalSecAnnualOperatingMarginDto) => ReactNode) | undefined;
  readonly renderFinancialReview: FinancialReviewSlot | undefined;
}) {
  const id = useId();
  const income = useRef<HTMLDivElement>(null);
  const operating = useRef<HTMLHeadingElement>(null);
  const cash = useRef<HTMLHeadingElement>(null);
  const liquidity = useRef<HTMLHeadingElement>(null);
  const balanceSheet = useRef<HTMLHeadingElement>(null);
  const sources = useRef<HTMLElement>(null);
  const sourceDetails = useRef<HTMLDetailsElement>(null);
  const committedResponse = useRef<PersonalSecAnnualEvidenceResponseDto | null>(
    null,
  );
  useLayoutEffect(() => {
    committedResponse.current = response;
    return () => {
      committedResponse.current = null;
    };
  }, [response]);
  const targets = {
    income: { id: `${id}-income`, ref: income },
    operating: { id: `${id}-operating`, ref: operating },
    cash: { id: `${id}-cash`, ref: cash },
    liquidity: { id: `${id}-liquidity`, ref: liquidity },
    balanceSheet: { id: `${id}-balance-sheet`, ref: balanceSheet },
    sources: { id: `${id}-sources`, ref: sources },
  };
  return (
    <div className="sec-quarterly-comparison managed-annual-overview">
      <AnnualOverviewSummary
        response={response}
        targetMessage={
          response.evidence.target.status === "unresolved"
            ? reason(response.evidence.target.reason)
            : null
        }
        completenessMessage={incomeCompletenessMessage(response.evidence)}
      />
      <ManagedAnnualReportNavigation
        response={response}
        targets={targets}
        sourceDetails={sourceDetails}
      />
      {renderFinancialReview?.((section) => {
        const target = targets[section].ref.current;
        if (
          committedResponse.current !== response ||
          !target?.isConnected ||
          target.getClientRects().length === 0
        )
          return;
        target.focus({ preventScroll: true });
        if (
          committedResponse.current === response &&
          targets[section].ref.current === target &&
          target.isConnected
        )
          target.scrollIntoView({ block: "start", behavior: "instant" });
      })}
      <ManagedAnnualTrend response={response} />
      <div
        className="managed-annual-financial-region"
        role="region"
        aria-label="Annual financial results"
        tabIndex={0}
        id={targets.income.id}
        ref={income}
        data-annual-report-target="income"
      >
        <AnnualBases
          response={response}
          renderPairAction={renderPairAction}
          financial
        />
      </div>
      <SecAnnualOperatingResults
        response={response}
        headingTarget={targets.operating}
        renderHistory={(basis) => (
          <SecAnnualOperatingHistory
            response={response}
            concept={basis.concept}
          />
        )}
        {...(renderOperatingAction ? { renderOperatingAction } : {})}
      />
      <SecAnnualCashGeneration
        response={response}
        cashAction={cashAction}
        headingTarget={targets.cash}
        history={<SecAnnualCashHistory response={response} />}
      />
      <SecAnnualLiquidity
        response={response}
        liquidityAction={liquidityAction}
        headingTarget={targets.liquidity}
        history={<SecAnnualLiquidityHistory response={response} />}
      />
      <SecAnnualBalanceSheet
        response={response}
        headingTarget={targets.balanceSheet}
      />
      <details className="managed-annual-provenance" ref={sourceDetails}>
        <summary
          id={targets.sources.id}
          ref={sources}
          data-annual-report-target="sources"
        >
          Source and validation details
        </summary>
        <p className="sec-quarterly-message">
          Observed SEC annual revenue, net income, net margin, operating results
          and cash generation, plus liquidity and reported balance sheet totals.
          Revenue concepts stay separate. This view covers the observed report
          in current submissions; it does not provide complete filing history or
          prices.
        </p>
        <AnnualBasisSources bases={response.evidence.resolution.bases} />
        <SecAnnualSourceDetails response={response} />
      </details>
    </div>
  );
}

export function SecAnnualSourceDetails({
  response,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
}) {
  return (
    <>
      <AnnualEvidenceContext response={response} />
      <AnnualComparisonMethodology />
      <AnnualEvidenceSources response={response} />
    </>
  );
}

function AnnualEvidenceContext({
  response,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
}) {
  const evidence = response.evidence;
  const { target, coverage, resolution } = evidence;
  return (
    <>
      <h3>{response.security.symbol} · Observed annual report</h3>
      <p className="sec-quarterly-message">
        {response.security.issuerName} · {response.security.exchangeMic} ·{" "}
        {response.security.securityName} · CIK {evidence.cik}
      </p>
      <AnnualReportCoordinates response={response} />
      {target.status === "target" ? (
        <p className="sec-quarterly-message">
          Filed {target.filedDate} · Accepted{" "}
          {target.acceptedAt ?? "time not supplied"} · Accession{" "}
          {target.accessionNumber}.{" "}
          <a
            href={`https://www.sec.gov/Archives/edgar/data/${evidence.cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open observed filing index
          </a>
        </p>
      ) : null}
      {resolution.utilityAge === null ? null : (
        <p className="sec-quarterly-message">
          Report age at cutoff: {resolution.utilityAge.endAgeDays} days. Source
          ages at completion:{" "}
          {resolution.utilityAge.sourceAgeDays
            .map((days) => days.toFixed(3))
            .join(" / ")}{" "}
          days.
        </p>
      )}
      <p className="sec-quarterly-caveat">
        Complete selected income evidence does not mean complete issuer history
        or a valid annual pair. The observed report is chosen from current
        submissions before examining values; a missing pair is not replaced by
        an older report. Annual net margin uses NetIncomeLoss ÷ the named
        revenue basis × 100, rounded half up to two decimal places. No
        alternative income concept, TTM or cash-flow value is substituted.
      </p>
      {coverage === null ? null : (
        <p className="sec-quarterly-message">
          Revenue and income scan: {coverage.full.inspectedRows} requested rows;{" "}
          {coverage.full.invalidRows} invalid and {coverage.full.duplicateRows}{" "}
          identical duplicates. Selected evidence returned:{" "}
          {coverage.returned.observations}
          {coverage.selected === null
            ? " (target unresolved)"
            : ` of ${coverage.selected.observations}`}
          . Original history view: {coverage.history.returned.observations} of{" "}
          {coverage.full.observations}
          {coverage.history.truncated
            ? "; history remains truncated."
            : "; no history observations omitted."}
        </p>
      )}
      {evidence.targetScan?.olderHistoryAvailable ? (
        <p className="sec-quarterly-message">
          Older submissions exist outside this source response and were not
          fetched.
        </p>
      ) : null}
    </>
  );
}

function AnnualReportCoordinates({
  response,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
}) {
  const { target, completeness, resolution, generation } = response.evidence;
  return (
    <dl className="sec-quarterly-comparison-coordinates">
      <div>
        <dt>Observed report</dt>
        <dd>
          {target.status === "target"
            ? `${target.form} · period ending ${target.reportDate}`
            : reason(target.reason)}
        </dd>
      </div>
      <div>
        <dt>Revenue and income scan</dt>
        <dd>{evidenceIncomeScanStatus(response.evidence.incomeScanStatus)}</dd>
      </div>
      <div>
        <dt>Revenue and income evidence</dt>
        <dd>
          {completeness.status === "complete"
            ? "Complete for the four requested USD concepts"
            : `Unavailable. ${incomeCompletenessMessage(response.evidence)}`}
        </dd>
      </div>
      <div>
        <dt>Annual pair validity</dt>
        <dd>
          {resolution.selectedReportPairEligible
            ? "At least one same-report annual pair is valid"
            : "No valid annual pair for the observed report"}
        </dd>
      </div>
      <div>
        <dt>Current-use age policy</dt>
        <dd>
          {resolution.currentTargetEligible
            ? "Valid pair within the 485-day report / seven-day source limits"
            : "Unavailable under the current-use policy"}
        </dd>
      </div>
      <div>
        <dt>Load cutoff</dt>
        <dd>{generation.cutoffAt}</dd>
      </div>
      <div>
        <dt>Completed</dt>
        <dd>{generation.completedAt}</dd>
      </div>
    </dl>
  );
}

function AnnualBases({
  response,
  renderPairAction,
  financial = false,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
  readonly renderPairAction:
    ((pair: PersonalSecAnnualPairDto) => ReactNode) | undefined;
  readonly financial?: boolean;
}) {
  const evidence = response.evidence;
  const { resolution } = evidence;
  const missing = financial ? resolution.bases.filter(isMissingBasis) : [];
  const bases = financial
    ? resolution.bases
        .filter((basis) => !isMissingBasis(basis))
        .sort(
          (left, right) =>
            Number(right.status === "eligible") -
            Number(left.status === "eligible"),
        )
    : resolution.bases;
  return (
    <>
      {bases.map((basis) => (
        <section
          className="sec-filing-context"
          key={basis.concept}
          aria-label={`Annual revenue basis ${basis.concept}`}
        >
          <h4>
            {financial ? managedAnnualBasisLabel(basis.concept) : basis.concept}
          </h4>
          {(!financial || basis.status !== "eligible") && (
            <AnnualBasisStatus status={basis.status} />
          )}
          {renderPairs(basis.pairs, evidence, renderPairAction, financial)}
        </section>
      ))}
      {missing.length > 0 && (
        <MissingAnnualBases bases={missing} hasOtherBases={bases.length > 0} />
      )}
    </>
  );
}

function isMissingBasis(basis: AnnualBasis): boolean {
  return basis.status === "missing" && basis.pairs.length === 0;
}

function MissingAnnualBases({
  bases,
  hasOtherBases,
}: {
  readonly bases: readonly AnnualBasis[];
  readonly hasOtherBases: boolean;
}) {
  return (
    <section
      className="managed-annual-missing-bases"
      aria-label="Missing revenue bases"
    >
      <h4>{hasOtherBases ? "Other revenue bases" : "Revenue bases"}</h4>
      <dl>
        {bases.map((basis) => (
          <div key={basis.concept} data-annual-missing-basis={basis.concept}>
            <dt>{managedAnnualBasisLabel(basis.concept)}</dt>
            <dd>Missing from this report's loaded evidence.</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AnnualBasisSources({
  bases,
}: {
  readonly bases: readonly AnnualBasis[];
}) {
  return (
    <section
      className="managed-annual-basis-sources"
      aria-label="Revenue basis source status"
    >
      <h4>Revenue basis source status</h4>
      <dl>
        {bases.map((basis) => (
          <div key={basis.concept} data-annual-source-basis={basis.concept}>
            <dt>{basis.concept}</dt>
            <dd>{basis.status}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AnnualBasisStatus({
  status,
}: {
  readonly status: PersonalSecAnnualEvidenceResponseDto["evidence"]["resolution"]["bases"][number]["status"];
}) {
  return (
    <p className="sec-quarterly-message">
      {status === "eligible"
        ? "Valid annual pair"
        : status === "missing"
          ? "Unknown: this revenue basis is missing for the observed report."
          : status === "withheld"
            ? "Revenue and net income withheld because their complete selected evidence is unavailable."
            : "Unknown: this revenue basis cannot form a valid annual pair."}
    </p>
  );
}

function renderPairs(
  pairs: readonly PersonalSecAnnualPairDto[],
  evidence: PersonalSecAnnualEvidenceResponseDto["evidence"],
  renderPairAction: ((pair: PersonalSecAnnualPairDto) => ReactNode) | undefined,
  financial: boolean,
) {
  return pairs.map((pair) => (
    <AnnualPair
      key={JSON.stringify([pair.startDate, pair.endDate])}
      pair={pair}
      financial={financial}
      observations={evidence.observations}
      comparison={
        pair.status === "eligible"
          ? comparePersonalSecAnnualEvidence(evidence, pair.concept)
          : null
      }
      history={
        pair.status === "eligible"
          ? resolvePersonalSecAnnualHistory(evidence, pair.concept)
          : null
      }
      action={pair.status === "eligible" ? renderPairAction?.(pair) : null}
    />
  ));
}

function AnnualEvidenceSources({
  response,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
}) {
  const evidence = response.evidence;
  const { generation } = evidence;
  return (
    <details className="sec-quarterly-row-details sec-filing-context">
      <summary>
        Inspect selected-report income evidence ({evidence.observations.length}{" "}
        observations)
      </summary>
      <p className="sec-quarterly-message">
        All returned observations for this accession, including comparative
        years and other periods, appear below in retained order. Filing-focus
        labels are not the observation's fiscal year. Exact USD values are
        unscaled.
      </p>
      <ol>
        {evidence.observations.map((row) => (
          <li key={row.id}>
            <ObservationDetails row={row} />
          </li>
        ))}
      </ol>
      <dl className="sec-quarterly-comparison-coordinates">
        <div>
          <dt>Definition version</dt>
          <dd>{generation.definitionVersion}</dd>
        </div>
        <div>
          <dt>Source generation</dt>
          <dd>{generation.sha256}</dd>
        </div>
      </dl>
      {(["companyFacts", "submissions"] as const).map((name) => (
        <div className="sec-quarterly-message" key={name}>
          <strong>
            {name === "companyFacts" ? "Company Facts" : "Current submissions"}
          </strong>
          <dl className="sec-quarterly-row-details">
            <dt>Source status</dt>
            <dd>{sourceStatuses[generation.sources[name].status]}</dd>
            <dt>Source</dt>
            <dd>{generation.sources[name].sourceUrl}</dd>
            <dt>Captured</dt>
            <dd>
              {generation.sources[name].fetchedAt ??
                "No complete body captured"}
            </dd>
            <dt>Body bytes</dt>
            <dd>{generation.sources[name].bytes ?? "Unknown"}</dd>
            <dt>Body SHA-256</dt>
            <dd>{generation.sources[name].sha256 ?? "Unavailable"}</dd>
          </dl>
        </div>
      ))}
    </details>
  );
}

interface AnnualPairProps {
  readonly financial?: boolean;
  readonly pair: PersonalSecAnnualPairDto;
  readonly observations: readonly PersonalSecQuarterlyObservationDto[];
  readonly action: ReactNode;
  readonly comparison: PersonalSecAnnualComparison | null;
  readonly history: PersonalSecAnnualHistory | null;
}

function AnnualPair(props: AnnualPairProps) {
  const { pair, financial = false, comparison, history, action } = props;
  return (
    <div>
      {financial && pair.status === "eligible" ? (
        <SecAnnualFinancials
          pair={pair}
          comparison={comparison}
          history={history}
          comparisonMessage={
            comparison?.status === "unavailable"
              ? comparisonMessages[comparison.reason]
              : null
          }
          historyMessage={
            history?.status === "available" && history.stoppedReason
              ? comparisonMessages[history.stoppedReason]
              : null
          }
        />
      ) : (
        <AnnualPairValues {...props} />
      )}
      {action}
      {financial && (
        <AnnualHistoryInputs
          history={history}
          pair={pair}
          observations={props.observations}
        />
      )}
      <AnnualPairInputs pair={pair} observations={props.observations} />
    </div>
  );
}

function AnnualPairValues({
  pair,
  observations,
  comparison,
  history,
}: AnnualPairProps) {
  return (
    <>
      <p className="sec-quarterly-message">
        {pair.startDate ?? "Start date unknown"} to {pair.endDate}
      </p>
      {pair.status === "eligible" ? (
        <dl className="sec-quarterly-comparison-coordinates">
          <div>
            <dt>Revenue · USD</dt>
            <dd className="sec-quarterly-value">{pair.revenue}</dd>
          </div>
          <div>
            <dt>Net income · USD</dt>
            <dd className="sec-quarterly-value">{pair.netIncome}</dd>
          </div>
          <div>
            <dt>Net margin · %</dt>
            <dd className="sec-quarterly-value">{pair.netMarginPercent}</dd>
          </div>
        </dl>
      ) : (
        <p className="discovery-warning">Unknown. {reason(pair.status)}</p>
      )}
      {comparison === null ? null : (
        <AnnualComparison comparison={comparison} observations={observations} />
      )}
      {history?.status === "available" ? (
        <AnnualHistory history={history} observations={observations} />
      ) : null}
    </>
  );
}

function AnnualHistoryInputs({
  history,
  pair,
  observations,
}: Pick<AnnualPairProps, "history" | "pair" | "observations">) {
  return (
    <>
      {history?.status === "available" && (
        <details className="sec-quarterly-row-details">
          <summary>Inspect annual history inputs · {pair.concept}</summary>
          {history.periods.map((period) => (
            <section key={period.endDate}>
              <h5>
                {period.startDate} to {period.endDate}
              </h5>
              <ol>
                {period.observationIds.map((id) => {
                  const row = observations.find((item) => item.id === id);
                  return row ? (
                    <li key={id}>
                      <ObservationDetails row={row} />
                    </li>
                  ) : null;
                })}
              </ol>
            </section>
          ))}
        </details>
      )}
    </>
  );
}

function AnnualPairInputs({
  pair,
  observations,
}: Pick<AnnualPairProps, "pair" | "observations">) {
  const ids = [...pair.revenueObservationIds, ...pair.incomeObservationIds];
  return (
    <details className="sec-quarterly-row-details">
      <summary>
        Inspect annual pair inputs · {pair.concept} · {pair.endDate}
      </summary>
      {pair.subordinateReasons.length === 0 ? null : (
        <ul>
          {pair.subordinateReasons.map((item) => (
            <li key={item}>{reason(item)}</li>
          ))}
        </ul>
      )}
      <ol>
        {ids.map((id) => {
          const row = observations.find((item) => item.id === id);
          return row === undefined ? null : (
            <li key={id}>
              <ObservationDetails row={row} />
            </li>
          );
        })}
      </ol>
    </details>
  );
}

const comparisonMessages = {
  current_report_unavailable: "A valid current annual pair is required.",
  current_use_unavailable:
    "The report is outside the current-use policy at its original load.",
  previous_period_missing:
    "The immediately preceding annual revenue and net-income period is missing for this basis.",
  previous_period_ambiguous:
    "The preceding annual observations have conflicting start dates.",
  previous_period_invalid:
    "The preceding annual period or metadata cannot be admitted.",
  filing_metadata_mismatch:
    "The comparison inputs do not match the selected filing metadata.",
  previous_values_conflicted:
    "The preceding annual observations contain conflicting values.",
} as const;

function AnnualHistory({
  history,
  observations,
}: {
  readonly history: Extract<PersonalSecAnnualHistory, { status: "available" }>;
  readonly observations: readonly PersonalSecQuarterlyObservationDto[];
}) {
  const earlier = history.comparisons[1];
  return (
    <details
      className="sec-quarterly-row-details sec-annual-history"
      aria-label={`Reported annual history ${history.concept}`}
    >
      <summary>
        Read reported annual history · {history.periods.length}{" "}
        {history.periods.length === 1 ? "period" : "periods"}
      </summary>
      <p className="sec-quarterly-message">
        Up to three adjacent annual periods, newest first, reported in accession{" "}
        {history.accessionNumber}. Amounts are exact, unscaled USD. Original
        load and source dates above apply to every period. Period length,
        accounting changes and restatements are unadjusted; these are not
        as-originally-filed history or organic growth.
      </p>
      <ol className="sec-annual-history-periods">
        {history.periods.map((period) => (
          <li key={period.endDate}>
            <h5>
              {period.startDate} to {period.endDate}
            </h5>
            <dl>
              <dt>Revenue · USD</dt>
              <dd>{period.revenue}</dd>
              <dt>Net income · USD</dt>
              <dd>{period.netIncome}</dd>
              <dt>Net margin · %</dt>
              <dd>
                {period.netMarginPercent === null
                  ? "Unavailable: revenue must be positive"
                  : `${period.netMarginPercent}%`}
              </dd>
            </dl>
            <details className="sec-quarterly-row-details">
              <summary>Inspect period inputs · {period.endDate}</summary>
              <ol>
                {period.observationIds.map((id) => {
                  const row = observations.find((item) => item.id === id);
                  return row === undefined ? null : (
                    <li key={id}>
                      <ObservationDetails row={row} />
                    </li>
                  );
                })}
              </ol>
            </details>
          </li>
        ))}
      </ol>
      {earlier === undefined ? null : (
        <section
          className="sec-annual-earlier-comparison"
          aria-label={`Earlier reported annual comparison ${history.concept}`}
        >
          <h5>Earlier reported annual comparison</h5>
          <p className="sec-quarterly-message">
            Prior: {earlier.priorStartDate} to {earlier.priorEndDate}. Current:{" "}
            {earlier.currentStartDate} to {earlier.currentEndDate}.
          </p>
          <AnnualAmountChanges comparison={earlier} />
          <p className="sec-quarterly-caveat">
            Changes use the exact reported amounts above. Percentage change
            requires a positive prior value and is rounded half up to two
            places. The same filing, source dates and unadjusted-period limits
            apply.
          </p>
          <details className="sec-quarterly-row-details">
            <summary>
              Inspect earlier comparison inputs · {history.concept}
            </summary>
            <ol>
              {earlier.observationIds.map((id) => {
                const row = observations.find((item) => item.id === id);
                return row === undefined ? null : (
                  <li key={id}>
                    <ObservationDetails row={row} />
                  </li>
                );
              })}
            </ol>
          </details>
        </section>
      )}
      {history.stoppedReason === null ? null : (
        <p className="sec-quarterly-message">
          The next earlier period is unavailable.{" "}
          {comparisonMessages[history.stoppedReason]}
        </p>
      )}
    </details>
  );
}

function AnnualAmountChanges({
  comparison,
}: {
  readonly comparison: Pick<
    Extract<PersonalSecAnnualComparison, { status: "available" }>,
    "revenue" | "netIncome"
  >;
}) {
  return (
    <>
      {(["revenue", "netIncome"] as const).map((metric) => {
        const value = comparison[metric];
        const label = metric === "revenue" ? "Revenue" : "Net income";
        return (
          <dl className="sec-quarterly-comparison-coordinates" key={metric}>
            <div>
              <dt>{label} prior · USD</dt>
              <dd>{value.prior}</dd>
            </div>
            <div>
              <dt>{label} current · USD</dt>
              <dd>{value.current}</dd>
            </div>
            <div>
              <dt>{label} change · USD</dt>
              <dd>{value.difference}</dd>
            </div>
            <div>
              <dt>{label} reported change</dt>
              <dd>{annualComparisonPercentText(value)}</dd>
            </div>
          </dl>
        );
      })}
    </>
  );
}

function AnnualComparison({
  comparison,
  observations,
}: {
  readonly comparison: PersonalSecAnnualComparison;
  readonly observations: readonly PersonalSecQuarterlyObservationDto[];
}) {
  if (comparison.status === "unavailable") {
    return (
      <p className="sec-quarterly-message">
        Reported annual comparison unavailable.{" "}
        {comparisonMessages[comparison.reason]}
      </p>
    );
  }
  return (
    <section
      className="sec-annual-comparison"
      aria-label={`Reported annual comparison ${comparison.concept}`}
    >
      <h5>Reported annual comparison</h5>
      <p className="sec-quarterly-message">
        Prior: {comparison.priorStartDate} to {comparison.priorEndDate}.
        Current: {comparison.currentStartDate} to {comparison.currentEndDate}.
      </p>
      <AnnualAmountChanges comparison={comparison} />
      <dl className="sec-quarterly-comparison-coordinates">
        <div>
          <dt>Net margin prior · %</dt>
          <dd>
            {comparison.netMargin.status === "available"
              ? `${comparison.netMargin.prior}%`
              : annualMarginChangeText(comparison.netMargin)}
          </dd>
        </div>
        <div>
          <dt>Net margin current · %</dt>
          <dd>{comparison.netMargin.current}%</dd>
        </div>
        <div>
          <dt>Net margin change · percentage points</dt>
          <dd>{annualMarginChangeText(comparison.netMargin)}</dd>
        </div>
      </dl>
      <AnnualComparisonMethodology />
      <details className="sec-quarterly-row-details">
        <summary>
          Inspect annual comparison inputs · {comparison.concept}
        </summary>
        <p className="sec-quarterly-message">
          Accession {comparison.accessionNumber}. Original load and source dates
          above apply to both periods.
        </p>
        <ol>
          {comparison.observationIds.map((id) => {
            const row = observations.find((item) => item.id === id);
            return row === undefined ? null : (
              <li key={id}>
                <ObservationDetails row={row} />
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}

function AnnualComparisonMethodology() {
  return (
    <p className="sec-quarterly-caveat">
      Amounts are exact, unscaled USD. Percentage change is (current − prior) ÷
      prior × 100, rounded half up to two decimal places, and requires a
      positive prior value. Net margin is NetIncomeLoss ÷ the named revenue
      basis × 100 and requires positive revenue. Margin change subtracts the
      unrounded ratios and is rounded once to two decimal places, in percentage
      points. These reported amounts include any unusual items in NetIncomeLoss.
      Consecutive annual periods can differ in length. No adjustment for period
      length, accounting changes or restatements is made. These are comparatives
      reported in the same filing, not an as-originally-filed history or organic
      growth.
    </p>
  );
}

function reason(value: string | null): string {
  return value === null
    ? "Unavailable"
    : (reasons[value] ?? "The evidence cannot be admitted.");
}

function evidenceIncomeScanStatus(
  status: PersonalSecAnnualEvidenceResponseDto["evidence"]["incomeScanStatus"],
) {
  return {
    available: "Complete source scan",
    source_unavailable: "Source unavailable",
    invalid_response: "Income concepts could not be validated",
    candidate_limit: "Income concepts exceed the bounded scan limit",
  }[status];
}

function incomeCompletenessMessage(
  evidence: PersonalSecAnnualEvidenceResponseDto["evidence"],
): string | null {
  if (evidence.completeness.status === "complete") return null;
  if (evidence.completeness.reason === "source_unavailable") {
    if (evidence.incomeScanStatus === "invalid_response")
      return "Revenue and income could not be validated.";
    if (evidence.incomeScanStatus === "candidate_limit")
      return "The revenue and income scan exceeds its source limit.";
  }
  return reason(evidence.completeness.reason);
}
