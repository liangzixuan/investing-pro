"use client";

import type {
  PersonalSecQuarterAssessmentResponseDto,
  PersonalSecQuarterAssessmentSelectionDto,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";

import { fetchPersonalSecQuarterAssessment } from "../../lib/personal-sec-quarter-assessment-api";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export interface PersonalSecQuarterAssessmentProps {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly selection: PersonalMarketSelection;
  readonly filing: PersonalSecQuarterAssessmentSelectionDto;
  readonly responseGeneration: number;
  readonly requestToken: number;
  readonly enabled: boolean;
  readonly onSessionUnavailable: () => void;
  readonly onClose: () => void;
}

export function PersonalSecQuarterAssessment(
  props: PersonalSecQuarterAssessmentProps,
) {
  const {
    catalogSnapshotSha256,
    selection,
    filing,
    responseGeneration,
    requestToken,
    enabled,
  } = props;
  const [result, setResult] =
    useState<PersonalSecQuarterAssessmentResponseDto | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("Preparing quarter assessment…");
  const [error, setError] = useState(false);
  const context = JSON.stringify([
    catalogSnapshotSha256,
    selection,
    filing,
    responseGeneration,
    requestToken,
    enabled,
  ]);
  const activeContext = useRef(context);
  activeContext.current = context;
  const [loadedContext, setLoadedContext] = useState(context);
  const epoch = useRef(0);
  const mounted = useRef(false);
  const sessionLost = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const heading = useRef<HTMLHeadingElement | null>(null);
  const deliberateRequest = useRef({ token: requestToken, context });
  if (deliberateRequest.current.token !== requestToken)
    deliberateRequest.current = { token: requestToken, context };

  useEffect(() => {
    mounted.current = true;
    invalidate("Preparing quarter assessment…");
    setLoadedContext(context);
    if (enabled) heading.current?.focus();
    const scheduledEpoch = epoch.current;
    void Promise.resolve().then(() => {
      if (
        scheduledEpoch === epoch.current &&
        activeContext.current === context &&
        deliberateRequest.current.context === context &&
        deliberateRequest.current.token === requestToken
      )
        void load();
    });
    return () => {
      mounted.current = false;
      epoch.current += 1;
      controller.current?.abort();
      controller.current = null;
    };
  }, [context, requestToken]);

  function invalidate(nextMessage: string): void {
    epoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    setResult(null);
    setRunning(false);
    setMessage(nextMessage);
    setError(false);
  }

  async function load(): Promise<void> {
    if (
      !mounted.current ||
      sessionLost.current ||
      !enabled ||
      activeContext.current !== context ||
      controller.current !== null
    )
      return;
    invalidate(
      "Checking the selected filing’s quarter and financial statement…",
    );
    setLoadedContext(context);
    const operationEpoch = epoch.current;
    const operation = new AbortController();
    controller.current = operation;
    setRunning(true);
    const isCurrent = (): boolean =>
      mounted.current &&
      operationEpoch === epoch.current &&
      activeContext.current === context &&
      !operation.signal.aborted;
    try {
      const next = await fetchPersonalSecQuarterAssessment(
        {
          schemaVersion: "1.0.0",
          catalogSnapshotSha256,
          listingId: selection.listingId,
          symbol: selection.symbol,
          selection: filing,
        },
        operation.signal,
      );
      if (!isCurrent()) return;
      if (
        next.catalogSnapshotSha256 !== catalogSnapshotSha256 ||
        !Object.entries(selection).every(
          ([key, value]) =>
            next.security[key as keyof typeof next.security] === value,
        )
      )
        throw new PersonalWorkspaceApiError("invalid_response");
      setResult(next);
      setMessage(
        "Assessment completed. Refresh explicitly to check these sources again.",
      );
    } catch (caught) {
      if (!isCurrent()) return;
      setResult(null);
      const code =
        caught instanceof PersonalWorkspaceApiError
          ? caught.code
          : "unavailable";
      if (code === "session_unavailable") {
        sessionLost.current = true;
        invalidate(
          "The workspace session ended. Revalidate it before checking a filing.",
        );
        callbacks.current.onSessionUnavailable();
      } else {
        setError(true);
        setMessage(
          code === "not_configured"
            ? "SEC contact setup is required in local startup settings."
            : code === "conflict"
              ? "The catalog changed. Refresh SEC evidence and select the filing again."
              : code === "rate_limited"
                ? "SEC requests are busy or rate limited. Retry later."
                : code === "invalid_response"
                  ? "The assessment could not be validated for this company and filing."
                  : "The quarter assessment could not finish. Retry when the local workspace and SEC source are available.",
        );
      }
    } finally {
      if (isCurrent()) {
        controller.current = null;
        setRunning(false);
      }
    }
  }

  const current = enabled && !sessionLost.current && loadedContext === context;
  const assessment = current ? result?.assessment : undefined;
  const isRunning = current && running;
  const renderEpoch = epoch.current;
  const canAct = (): boolean =>
    mounted.current &&
    current &&
    activeContext.current === context &&
    epoch.current === renderEpoch;
  return (
    <section
      id="sec-quarter-assessment"
      className="sec-quarterly-comparison"
      aria-labelledby="sec-quarter-assessment-title"
      aria-busy={isRunning}
    >
      <div className="sec-quarterly-comparison-heading">
        <h3 id="sec-quarter-assessment-title" ref={heading} tabIndex={-1}>
          Quarter assessment
        </h3>
        <button
          type="button"
          onClick={() => {
            if (canAct()) callbacks.current.onClose();
          }}
        >
          Close assessment
        </button>
      </div>
      <p>
        {selection.symbol} · {filing.form} · Filed {filing.filedDate} · Report
        ended {filing.reportDate ?? "unresolved"}
      </p>
      <p className="sec-quarterly-message">
        Checks directly reported three-month revenue and net income attributable
        to the parent for this filing. Source limits or unresolved evidence
        leave the affected value unavailable.
      </p>
      <div className="sec-quarterly-actions">
        <button
          type="button"
          disabled={!current || isRunning}
          onClick={() => {
            if (canAct()) void load();
          }}
        >
          {result === null ? "Retry assessment" : "Refresh assessment"}
        </button>
        {isRunning ? (
          <button
            type="button"
            onClick={() => {
              if (canAct())
                invalidate("Assessment cancelled. No result was retained.");
            }}
          >
            Cancel assessment
          </button>
        ) : null}
      </div>
      <p role={error && current ? "alert" : "status"}>
        {current
          ? message
          : "Select a filing in the active workspace to assess it."}
      </p>
      {assessment === undefined ? null : assessment.stage !== "assessment" ? (
        <div className="discovery-warning">
          <strong>
            {assessment.status === "held"
              ? "Quarter not supported"
              : "Assessment unavailable"}
          </strong>
          <p>{reasonLabel(assessment.reason)}</p>
        </div>
      ) : (
        <>
          <h4>
            {assessment.status === "supported_as_filed"
              ? "Both values supported as filed"
              : assessment.status === "conflicted"
                ? "Source values conflict"
                : "Quarter evidence remains unresolved"}
          </h4>
          <div
            className="sec-quarterly-table-scroll"
            role="region"
            tabIndex={0}
            aria-label="Selected filing quarter assessment"
          >
            <table className="sec-quarterly-table">
              <caption>Selected-filing assessment</caption>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Result</th>
                  <th scope="col">Source period</th>
                </tr>
              </thead>
              <tbody>
                {assessment.analysis.metrics.map((metric) => (
                  <tr key={metric.metric}>
                    <th scope="row">
                      {metric.metric === "revenue"
                        ? "Revenue"
                        : "Parent net income"}
                    </th>
                    <td>
                      {metric.status === "supported_as_filed" ? (
                        <>
                          <strong>{formatExactUsd(metric.value)}</strong>
                          <span>Supported as filed</span>
                        </>
                      ) : (
                        <>
                          <strong>
                            {metric.status === "conflicted"
                              ? "Conflicting evidence"
                              : "Unavailable"}
                          </strong>
                          <ul>
                            {metric.reasons.map((reason) => (
                              <li key={reason}>{reasonLabel(reason)}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </td>
                    <td>
                      {metric.period === null
                        ? "Not established"
                        : `${metric.period.startDate} to ${metric.period.endDate}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {assessment.analysis.pair.status === "supported_as_filed" ? null : (
            <p>{assessment.analysis.pair.reasons.map(reasonLabel).join(" ")}</p>
          )}
          <details>
            <summary>Evidence checks</summary>
            <p>
              All selected or unresolved Company Facts occurrences and all four
              primary-document concept populations participate in the check.
              Equal duplicates remain separate.
            </p>
            <ul>
              {assessment.analysis.concepts.map((concept) => (
                <li key={concept.concept}>
                  {concept.concept}: {concept.companyFactsRefs.length} Company
                  Facts references and {concept.primaryRefs.length} primary
                  references. {concept.reasons.map(reasonLabel).join(" ")}
                </li>
              ))}
            </ul>
            <p>
              Checked {assessment.acceptedAt}. This is an assessment time, not a
              source freshness or first-publication claim.
            </p>
          </details>
        </>
      )}
      {assessment === undefined || assessment.sources.length === 0 ? null : (
        <details>
          <summary>SEC sources used</summary>
          <ul>
            {assessment.sources.map((source) => (
              <li key={source.id}>
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.id === "submissions"
                    ? "Current filing metadata"
                    : source.id === "company_facts"
                      ? "Company Facts"
                      : "Primary filing document"}
                </a>
                {" · Retrieved "}
                {source.retrievalCompletedAt}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="sec-quarterly-message">
        TTM remains unavailable. This check does not choose a later revision or
        derive a quarter by subtraction.
      </p>
    </section>
  );
}

function formatExactUsd(value: string): string {
  const negative = value.startsWith("-");
  const [whole, fraction] = (negative ? value.slice(1) : value).split(".");
  return `${negative ? "−" : ""}$${whole!.replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}${fraction === undefined ? "" : `.${fraction}`}`;
}

function reasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    report_identity_unresolved:
      "The filing's reporting identity is unresolved.",
    report_metadata_conflict: "Reporting metadata conflicts.",
    unsupported_amendment:
      "Amended filings are outside the supported quarter check.",
    report_date_unresolved: "A report-end date is required.",
    unsupported_transition_period:
      "Transition reporting periods are not supported.",
    unsupported_week_calendar: "Week-based fiscal calendars are not supported.",
    unsupported_stub_period: "Partial fiscal periods are not supported.",
    unsupported_q4: "Fourth quarters are not supported.",
    unsupported_ytd_only:
      "Only cumulative evidence is available; a direct quarter is required.",
    fiscal_boundary_unresolved:
      "The filing does not establish the required current fiscal-year boundary.",
    fiscal_boundary_conflict: "Fiscal-year boundaries conflict.",
    fiscal_calendar_unresolved:
      "The calendar-month fiscal convention is unresolved.",
    fiscal_slot_unresolved: "The current fiscal-quarter slot is unresolved.",
    fiscal_ytd_role_unresolved:
      "The current fiscal-year-to-date role is unresolved.",
    cash_date_join_mismatch:
      "The cash date witnesses do not agree with the reporting period.",
    principal_statement_unresolved:
      "The principal income statement could not be established.",
    consolidation_scope_unresolved:
      "The statement's consolidation scope is unresolved.",
    caption_ownership_unresolved:
      "The statement caption could not be bound to a unique table.",
    current_column_unresolved:
      "The complete current-quarter column could not be established.",
    column_ownership_conflict:
      "The numeric cell overlaps conflicting column headers.",
    whole_revenue_scope_unresolved:
      "Whole-company revenue could not be established.",
    parent_attribution_unresolved:
      "Net income attributable to the parent could not be established.",
    unsupported_common_share_numerator:
      "Common-share or EPS income cannot substitute for parent net income.",
    unsupported_continuing_income:
      "Continuing-operations income cannot substitute for total net income.",
    display_amount_unresolved:
      "The full signed displayed amount is unresolved.",
    display_unit_unresolved: "The displayed USD unit or scale is unresolved.",
    display_amount_mismatch: "The displayed and tagged amounts disagree.",
    adjacent_cell_ownership_conflict:
      "Adjacent sign or currency cells have conflicting ownership.",
    static_visibility_unresolved:
      "The source markup does not meet the supported static visibility rules.",
    static_script_unresolved:
      "The filing contains scripts. This assessment does not run them, so their effect on the displayed statements is unknown.",
    competing_revenue_concepts:
      "More than one revenue concept could represent the current total.",
    membership_unresolved:
      "Some source occurrences cannot be safely included or excluded.",
    current_non_usd: "A possible current occurrence uses an unsupported unit.",
    current_value_conflict: "Possible current source values disagree.",
    concept_absent: "This concept has no current source population.",
    no_current_company_facts_row:
      "No current Company Facts row supports this metric.",
    no_current_primary_row:
      "No current primary-document row supports this metric.",
    unwitnessed_company_facts_reference:
      "A current Company Facts occurrence has no matching principal-statement witness.",
    principal_witness_unresolved:
      "A usable principal-statement witness could not be established.",
    pair_period_mismatch:
      "The two metrics do not share the same established quarter.",
    metric_not_supported:
      "Both metrics must be supported before the pair is available.",
    accession_not_in_current_submissions:
      "The selected filing is absent from current Submissions. Older history was not loaded.",
    submission_metadata_conflict:
      "Current filing metadata differs from the selection. Refresh SEC evidence.",
    primary_document_unavailable:
      "A supported primary document could not be identified.",
    not_covered: "The source does not cover this filing.",
    rate_limited: "SEC requests are rate limited. Retry later.",
    upstream_unavailable: "The SEC source is unavailable. Retry later.",
    invalid_response: "The source response could not be validated.",
    response_too_large: "A source exceeds the response size limit.",
    candidate_limit:
      "The source exceeds the occurrence limit. No incomplete result was used.",
    duplicate_json_key: "The source contains duplicate JSON keys.",
    json_depth_limit: "The source exceeds the supported JSON nesting depth.",
    company_facts_structure_invalid:
      "Company Facts has an unsupported or incomplete structure.",
    company_facts_field_limit:
      "A Company Facts field exceeds the retention limit.",
    company_facts_projection_limit:
      "Complete Company Facts evidence exceeds the retention limit.",
    runtime_unavailable: "The local filing parser is unavailable.",
    parser_timeout: "The filing parser exceeded its time limit.",
    worker_failed: "The filing parser could not finish.",
    invalid_output: "The filing parser output could not be validated.",
    output_too_large: "Complete evidence exceeds the output limit.",
    invalid_evidence_graph:
      "The source evidence references could not be validated.",
    operation_deadline:
      "The assessment exceeded its 60-second deadline. Retry later.",
    invalid_document: "The primary filing has unsupported or malformed markup.",
    document_limit: "The primary filing exceeds the document size limit.",
    node_limit: "The primary filing exceeds the element limit.",
    depth_limit: "The primary filing exceeds the nesting limit.",
    attribute_limit: "The primary filing exceeds the attribute limit.",
    context_limit: "The primary filing exceeds the context limit.",
    unit_limit: "The primary filing exceeds the unit limit.",
    aggregate_candidate_limit:
      "The complete four-concept population exceeds the occurrence limit.",
    metadata_limit: "Complete reporting metadata exceeds the retention limit.",
    structural_limit:
      "Complete statement structure exceeds the retention limit.",
    output_limit: "Complete primary evidence exceeds the output limit.",
    duplicate_id: "The primary filing contains duplicate source identifiers.",
    invalid_namespace: "A required source namespace could not be resolved.",
    source_hash_mismatch:
      "The primary document bytes do not match their source binding.",
  };
  return (
    labels[reason] ??
    `Source check could not complete: ${reason.replaceAll("_", " ")}.`
  );
}
