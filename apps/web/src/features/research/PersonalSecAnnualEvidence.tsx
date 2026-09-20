"use client";

import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualPairDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";

import { fetchPersonalSecAnnualEvidence } from "../../lib/personal-sec-annual-evidence-api";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export interface PersonalSecAnnualEvidenceProps {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly selection: PersonalMarketSelection | null;
  readonly enabled: boolean;
  readonly onSessionUnavailable: () => void;
}

const initialMessage =
  "Load the observed annual report explicitly to inspect its SEC inputs.";

export function PersonalSecAnnualEvidence({
  catalogSnapshotSha256,
  selection,
  enabled,
  onSessionUnavailable,
}: PersonalSecAnnualEvidenceProps) {
  const key = JSON.stringify([catalogSnapshotSha256, selection, enabled]);
  const context = useRef({ key, version: 0 });
  if (context.current.key !== key) {
    context.current = { key, version: context.current.version + 1 };
  }
  const version = context.current.version;
  const [state, setState] = useState<{
    version: number;
    response: PersonalSecAnnualEvidenceResponseDto | null;
    running: boolean;
    message: string;
    error: boolean;
  }>({
    version,
    response: null,
    running: false,
    message: initialMessage,
    error: false,
  });
  const epoch = useRef(0);
  const mounted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const sessionCallback = useRef(onSessionUnavailable);
  sessionCallback.current = onSessionUnavailable;
  const loadButton = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef<{
    version: number;
    epoch: number;
    origin: HTMLButtonElement;
  } | null>(null);

  useEffect(() => {
    mounted.current = true;
    epoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    pendingFocus.current = null;
    setState({
      version,
      response: null,
      running: false,
      message: initialMessage,
      error: false,
    });
    return () => {
      mounted.current = false;
      epoch.current += 1;
      controller.current?.abort();
      controller.current = null;
      pendingFocus.current = null;
    };
  }, [version]);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (pending === null || state.running) return;
    pendingFocus.current = null;
    const button = loadButton.current;
    if (
      mounted.current &&
      enabled &&
      selection !== null &&
      pending.version === context.current.version &&
      pending.epoch === epoch.current &&
      button?.isConnected &&
      !button.closest("[hidden]") &&
      (document.activeElement === pending.origin ||
        document.activeElement === document.body)
    ) {
      button.focus();
    }
  }, [state, enabled, selection]);

  const currentContext =
    enabled && selection !== null && state.version === version;
  const current = currentContext ? state.response : null;
  const running = currentContext && state.running;
  const renderEpoch = epoch.current;
  const isCurrentRender = () =>
    mounted.current &&
    enabled &&
    selection !== null &&
    context.current.version === version &&
    epoch.current === renderEpoch;

  async function load() {
    if (
      !isCurrentRender() ||
      selection === null ||
      controller.current !== null ||
      state.version !== version
    )
      return;
    pendingFocus.current = null;
    const operation = ++epoch.current;
    const abort = new AbortController();
    controller.current = abort;
    setState({
      version,
      response: null,
      running: true,
      message: `Loading the observed annual report for ${selection.symbol}…`,
      error: false,
    });
    const valid = () =>
      mounted.current &&
      context.current.version === version &&
      operation === epoch.current &&
      !abort.signal.aborted;
    try {
      const response = await fetchPersonalSecAnnualEvidence(
        {
          schemaVersion: "1.0.0",
          catalogSnapshotSha256,
          listingId: selection.listingId,
          symbol: selection.symbol,
        },
        abort.signal,
      );
      if (!valid()) return;
      if (
        response.catalogSnapshotSha256 !== catalogSnapshotSha256 ||
        !sameSelection(response.security, selection)
      )
        throw new PersonalWorkspaceApiError("invalid_response");
      setState({
        version,
        response,
        running: false,
        message: `Annual SEC response loaded for ${selection.symbol}. Refresh explicitly to check again.`,
        error: false,
      });
    } catch (caught) {
      if (!valid()) return;
      const code =
        caught instanceof PersonalWorkspaceApiError
          ? caught.code
          : "unavailable";
      setState({
        version,
        response: null,
        running: false,
        error: true,
        message: errorMessage(code),
      });
      if (code === "session_unavailable") sessionCallback.current();
    } finally {
      if (valid()) controller.current = null;
    }
  }

  function cancel(origin: HTMLButtonElement) {
    if (!isCurrentRender() || !running || controller.current === null) return;
    epoch.current += 1;
    controller.current.abort();
    controller.current = null;
    pendingFocus.current =
      document.activeElement === origin
        ? { version, epoch: epoch.current, origin }
        : null;
    setState({
      version,
      response: null,
      running: false,
      message: "Annual report load cancelled. Load again when ready.",
      error: false,
    });
  }

  return (
    <section
      className="personal-financials-panel personal-sec-quarterly-evidence"
      aria-labelledby="sec-annual-evidence-title"
      aria-busy={running}
    >
      <div className="discovery-section-heading personal-financials-heading">
        <div>
          <p className="eyebrow">Selected-company SEC research</p>
          <h2 id="sec-annual-evidence-title">Observed annual SEC report</h2>
        </div>
        <span>Revenue · Net income · Net margin · USD</span>
      </div>
      <p className="market-scope-note">
        Uses the annual report observed in current SEC submissions, not complete
        filing history or point-in-time evidence. Revenue concepts remain
        separate. Loading makes no change to saved research.
      </p>
      {!enabled ? (
        <p className="discovery-warning">
          Revalidate the owner session to load an annual SEC report.
        </p>
      ) : selection === null ? (
        <p className="discovery-empty-state">
          Choose a company to inspect its observed annual report.
        </p>
      ) : (
        <>
          <div className="sec-quarterly-actions">
            <button
              ref={loadButton}
              className="primary-action compact-action"
              type="button"
              disabled={running || state.version !== version}
              onClick={() => void load()}
            >
              {running
                ? "Loading annual report…"
                : current === null
                  ? "Load observed annual report"
                  : "Refresh annual report"}
            </button>
            {running ? (
              <button
                type="button"
                onClick={(event) => cancel(event.currentTarget)}
              >
                Cancel annual report
              </button>
            ) : null}
          </div>
          <p
            className={
              currentContext && state.error
                ? "market-message market-message-error"
                : "sec-quarterly-message"
            }
            role={currentContext && state.error ? "alert" : "status"}
          >
            {currentContext ? state.message : initialMessage}
          </p>
        </>
      )}
      {current === null ? null : (
        <AnnualEvidenceResult
          key={current.evidence.generation.sha256}
          response={current}
        />
      )}
    </section>
  );
}

function sameSelection(
  security: PersonalSecAnnualEvidenceResponseDto["security"],
  selection: PersonalMarketSelection,
) {
  return (
    security.country === selection.country &&
    security.exchangeMic === selection.exchangeMic &&
    security.issuerId === selection.issuerId &&
    security.issuerName === selection.issuerName &&
    security.listingId === selection.listingId &&
    security.securityName === selection.securityName &&
    security.symbol === selection.symbol
  );
}

function errorMessage(code: string): string {
  if (code === "session_unavailable")
    return "The owner session expired. Revalidate it to load annual SEC evidence.";
  if (code === "not_configured")
    return "SEC contact setup is required in local startup settings before loading.";
  if (code === "conflict")
    return "The catalog changed. Choose the company again before loading.";
  if (code === "not_covered")
    return "No supported SEC issuer binding is available for this company.";
  if (code === "rate_limited")
    return "SEC requests are rate limited. Load again later.";
  if (code === "invalid_response")
    return "The annual SEC response could not be validated. No report or values were retained.";
  return "Annual SEC evidence could not be loaded. Check source availability, then load again.";
}

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
    "The source contains invalid observations; annual values are withheld.",
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

function AnnualEvidenceResult({
  response,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
}) {
  const evidence = response.evidence;
  const { target, completeness, coverage, resolution, generation } = evidence;
  return (
    <div className="sec-quarterly-comparison">
      <h3>{response.security.symbol} · Observed annual report</h3>
      <p className="sec-quarterly-message">
        {response.security.issuerName} · {response.security.exchangeMic} ·{" "}
        {response.security.securityName} · CIK {evidence.cik}
      </p>
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
          <dt>Complete selected evidence</dt>
          <dd>
            {completeness.status === "complete"
              ? "Complete for the four requested USD concepts"
              : `Unavailable. ${reason(completeness.reason)}`}
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
        Complete selected evidence does not mean complete issuer history or a
        valid annual pair. The observed report is chosen from current
        submissions before examining values; a missing pair is not replaced by
        an older report. Annual net margin uses NetIncomeLoss ÷ the named
        revenue basis × 100, rounded half up to two decimal places. No
        alternative income concept, TTM or cash-flow value is substituted.
      </p>
      {coverage === null ? null : (
        <p className="sec-quarterly-message">
          Full source scan: {coverage.full.inspectedRows} requested rows;{" "}
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
      {resolution.bases.map((basis) => (
        <section
          className="sec-filing-context"
          key={basis.concept}
          aria-label={`Annual revenue basis ${basis.concept}`}
        >
          <h4>{basis.concept}</h4>
          <p className="sec-quarterly-message">
            {basis.status === "eligible"
              ? "Valid annual pair"
              : basis.status === "missing"
                ? "Unknown: this revenue basis is missing for the observed report."
                : basis.status === "withheld"
                  ? "Annual values withheld because complete selected evidence is unavailable."
                  : "Unknown: this revenue basis cannot form a valid annual pair."}
          </p>
          {basis.pairs.map((pair) => (
            <AnnualPair
              key={JSON.stringify([pair.startDate, pair.endDate])}
              pair={pair}
              observations={evidence.observations}
            />
          ))}
        </section>
      ))}
      <details className="sec-quarterly-row-details sec-filing-context">
        <summary>
          Inspect selected-report evidence ({evidence.observations.length}{" "}
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
              {name === "companyFacts"
                ? "Company Facts"
                : "Current submissions"}
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
    </div>
  );
}

function AnnualPair({
  pair,
  observations,
}: {
  readonly pair: PersonalSecAnnualPairDto;
  readonly observations: readonly PersonalSecQuarterlyObservationDto[];
}) {
  const ids = [...pair.revenueObservationIds, ...pair.incomeObservationIds];
  return (
    <div>
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
    </div>
  );
}

function ObservationDetails({
  row,
}: {
  readonly row: PersonalSecQuarterlyObservationDto;
}) {
  return (
    <details className="sec-quarterly-row-details">
      <summary>
        {row.concept} · {row.startDate ?? "Unknown start"} to {row.endDate} ·{" "}
        {row.value} USD
      </summary>
      <dl className="sec-quarterly-comparison-coordinates">
        <div>
          <dt>Exact USD observation</dt>
          <dd>{row.value}</dd>
        </div>
        <div>
          <dt>Inclusive duration</dt>
          <dd>
            {row.durationDays === null ? "Unknown" : `${row.durationDays} days`}
          </dd>
        </div>
        <div>
          <dt>Filing focus, not observation year</dt>
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
              : "Filing metadata conflict"}{" "}
            · {row.filing.form} · {row.filing.filedDate}
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

function reason(value: string | null): string {
  return value === null
    ? "Unavailable"
    : (reasons[value] ?? "The evidence cannot be admitted.");
}
