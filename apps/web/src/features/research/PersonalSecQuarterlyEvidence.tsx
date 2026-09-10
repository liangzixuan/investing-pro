"use client";

import type {
  PersonalSecQuarterlyEvidenceResponseDto,
  PersonalSecQuarterlyObservationDto,
  PersonalSecQuarterlySourceStatus,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";

import {
  comparePersonalSecQuarterlyObservations,
  type PersonalSecQuarterlyComparison,
} from "../../lib/personal-sec-quarterly-comparison";
import { fetchPersonalSecQuarterlyEvidence } from "../../lib/personal-sec-quarterly-evidence-api";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export interface PersonalSecQuarterlyEvidenceProps {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly selection: PersonalMarketSelection | null;
  readonly enabled: boolean;
  readonly onSessionUnavailable: () => void;
}

const pageSize = 25;
const initialMessage = "Load dated SEC observations for the selected company.";
const sourceLabels = {
  available: "Loaded",
  not_covered: "Not covered",
  rate_limited: "Rate limited",
  upstream_unavailable: "SEC unavailable",
  invalid_response: "Invalid source response",
  response_too_large: "Source response exceeds size limit",
  candidate_limit: "Source exceeds observation limit",
} as const satisfies Record<PersonalSecQuarterlySourceStatus, string>;
const filingLabels = {
  matched: "Matched to current submissions",
  metadata_conflict: "Filing metadata conflict",
  not_in_current_submissions: "Not found in current submissions",
  submissions_unavailable: "Filing metadata unavailable",
} as const;

export function PersonalSecQuarterlyEvidence({
  catalogSnapshotSha256,
  selection,
  enabled,
  onSessionUnavailable,
}: PersonalSecQuarterlyEvidenceProps) {
  const [response, setResponse] =
    useState<PersonalSecQuarterlyEvidenceResponseDto | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [metric, setMetric] = useState("all");
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [comparisonPage, setComparisonPage] = useState(0);
  const comparisonHeading = useRef<HTMLHeadingElement | null>(null);
  const comparisonTrigger = useRef<HTMLButtonElement | null>(null);
  const observationsRegion = useRef<HTMLDivElement | null>(null);
  const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const callback = useRef(onSessionUnavailable);
  callback.current = onSessionUnavailable;
  const context = JSON.stringify([catalogSnapshotSha256, selection, enabled]);
  const activeContext = useRef(context);
  activeContext.current = context;
  const [loadedContext, setLoadedContext] = useState(context);

  useEffect(() => {
    epoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    setResponse(null);
    setRunning(false);
    setMessage(initialMessage);
    setError(false);
    setPage(0);
    setMetric("all");
    setComparisonId(null);
    setComparisonPage(0);
    comparisonTrigger.current = null;
    setLoadedContext(context);
    return () => {
      epoch.current += 1;
      controller.current?.abort();
      controller.current = null;
      comparisonTrigger.current = null;
    };
  }, [context]);

  useEffect(() => {
    if (comparisonId !== null) comparisonHeading.current?.focus();
  }, [comparisonId]);

  function invalidate(nextMessage: string) {
    epoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    setResponse(null);
    setRunning(false);
    setMessage(nextMessage);
    setError(false);
    setPage(0);
    setMetric("all");
    setComparisonId(null);
    setComparisonPage(0);
    comparisonTrigger.current = null;
  }

  async function load() {
    if (
      !enabled ||
      selection === null ||
      loadedContext !== context ||
      controller.current !== null ||
      activeContext.current !== context
    )
      return;
    invalidate(`Loading SEC evidence for ${selection.symbol}…`);
    const operationEpoch = epoch.current;
    const operationContext = context;
    const operationController = new AbortController();
    controller.current = operationController;
    setRunning(true);
    const isCurrent = () =>
      operationEpoch === epoch.current &&
      !operationController.signal.aborted &&
      activeContext.current === operationContext;
    try {
      const result = await fetchPersonalSecQuarterlyEvidence(
        {
          schemaVersion: "1.0.0",
          catalogSnapshotSha256,
          listingId: selection.listingId,
          symbol: selection.symbol,
        },
        operationController.signal,
      );
      if (!isCurrent()) return;
      if (
        result.catalogSnapshotSha256 !== catalogSnapshotSha256 ||
        !sameSelection(result.security, selection)
      )
        throw new PersonalWorkspaceApiError("invalid_response");
      setResponse(result);
      setMessage(
        `SEC evidence loaded for ${selection.symbol}. Refresh explicitly to check again.`,
      );
    } catch (caught) {
      if (!isCurrent()) return;
      const code =
        caught instanceof PersonalWorkspaceApiError
          ? caught.code
          : "unavailable";
      setResponse(null);
      setError(true);
      if (code === "session_unavailable") {
        invalidate(
          "The owner session expired. Revalidate it to load SEC evidence.",
        );
        callback.current();
      } else if (code === "not_configured")
        setMessage(
          "SEC contact setup is required. Configure the SEC User-Agent and contact email in local startup settings, then load again.",
        );
      else if (code === "conflict")
        setMessage(
          "The catalog changed. Revalidate the owner session and choose the company again.",
        );
      else if (code === "not_covered")
        setMessage(
          "No supported SEC issuer binding or source coverage is available for this listing.",
        );
      else if (code === "rate_limited")
        setMessage("SEC requests are rate limited. Load again later.");
      else if (code === "invalid_response")
        setMessage(
          "The SEC evidence response could not be validated for this company. No observations were retained.",
        );
      else
        setMessage(
          "SEC evidence could not be loaded. Check the local workspace and source availability, then retry.",
        );
    } finally {
      if (isCurrent()) {
        controller.current = null;
        setRunning(false);
      }
    }
  }

  const currentContext = enabled && loadedContext === context;
  const current = currentContext && selection !== null ? response : null;
  const isRunning = currentContext && running;
  const observations =
    current?.evidence.observations.filter(
      (item) => metric === "all" || item.metric === metric,
    ) ?? [];
  const rows = observations.slice(page * pageSize, (page + 1) * pageSize);
  const comparison =
    current !== null && comparisonId !== null
      ? comparePersonalSecQuarterlyObservations(current.evidence, comparisonId)
      : null;
  const renderEpoch = epoch.current;

  function closeComparison() {
    setComparisonId(null);
    setComparisonPage(0);
    if (comparisonTrigger.current?.isConnected)
      comparisonTrigger.current.focus();
    else observationsRegion.current?.focus();
    comparisonTrigger.current = null;
  }

  function openComparison(id: string, trigger: HTMLButtonElement | null) {
    if (
      current === null ||
      renderEpoch !== epoch.current ||
      activeContext.current !== context
    )
      return;
    if (comparisonId === id) {
      closeComparison();
      return;
    }
    comparisonTrigger.current = trigger;
    setComparisonPage(0);
    setComparisonId(id);
  }

  return (
    <section
      className="personal-financials-panel personal-sec-quarterly-evidence"
      aria-labelledby="sec-quarterly-evidence-title"
      aria-busy={isRunning}
    >
      <div className="discovery-section-heading personal-financials-heading">
        <div>
          <p className="eyebrow">Selected-company source evidence</p>
          <h2 id="sec-quarterly-evidence-title">SEC quarterly evidence</h2>
        </div>
        <span>Dated revenue and net income · USD</span>
      </div>
      <p className="market-scope-note">
        Inspect source observations and filing references before assigning
        fiscal quarters. This SEC load is independent of Tiingo setup and stays
        in active-session memory.
      </p>
      {!enabled ? (
        <p className="discovery-warning">
          Revalidate the owner session to load SEC evidence.
        </p>
      ) : selection === null ? (
        <p className="discovery-empty-state">
          Choose a company from search, My Watchlist or a screener to inspect
          its SEC evidence.
        </p>
      ) : (
        <>
          <div className="sec-quarterly-actions">
            <button
              className="primary-action compact-action"
              type="button"
              disabled={isRunning || loadedContext !== context}
              onClick={() => void load()}
            >
              {isRunning
                ? "Loading SEC evidence…"
                : current === null
                  ? "Load SEC quarterly evidence"
                  : "Refresh SEC quarterly evidence"}
            </button>
            {isRunning ? (
              <button
                type="button"
                onClick={() =>
                  invalidate(
                    "SEC evidence load cancelled. Load again when ready.",
                  )
                }
              >
                Cancel SEC evidence load
              </button>
            ) : null}
          </div>
          <p
            className={
              error && currentContext
                ? "market-message market-message-error"
                : "sec-quarterly-message"
            }
            role={error && currentContext ? "alert" : "status"}
          >
            {currentContext ? message : initialMessage}
          </p>
        </>
      )}
      {current === null ? null : (
        <>
          <div className="sec-quarterly-coverage">
            <div>
              <span>Company Facts</span>
              <strong>
                {sourceLabels[current.evidence.sources.companyFacts.status]}
              </strong>
            </div>
            <div>
              <span>Current submissions</span>
              <strong>
                {sourceLabels[current.evidence.sources.submissions.status]}
              </strong>
            </div>
            <div>
              <span>Observations retained</span>
              <strong>
                {current.evidence.coverage.returnedObservations} of{" "}
                {current.evidence.coverage.availableObservations}
              </strong>
            </div>
            <div>
              <span>Loaded at</span>
              <strong>{formatInstant(current.evidence.fetchedAt)}</strong>
            </div>
          </div>
          <p className="sec-quarterly-caveat">
            <strong>TTM unavailable.</strong> Actual dates and filing-focus
            labels do not establish a standalone-quarter or cumulative
            year-to-date basis, a verified fiscal calendar, or compatible
            revisions. No values are combined into a total.
          </p>
          {current.evidence.coverage.truncated ? (
            <p className="discovery-warning">
              The view retains up to 100 observations per metric. Additional
              source observations were omitted by the response limit.
            </p>
          ) : null}
          {current.evidence.coverage.invalidRows > 0 ? (
            <p className="discovery-warning">
              {current.evidence.coverage.invalidRows} invalid source rows were
              excluded; they were not replaced with zero.
            </p>
          ) : null}
          {current.evidence.coverage.duplicateRows > 0 ? (
            <p className="sec-quarterly-message">
              {current.evidence.coverage.duplicateRows} identical source rows
              were deduplicated. Distinct concepts, periods and revisions remain
              separate.
            </p>
          ) : null}
          {current.evidence.coverage.conceptsWithoutUsd.length > 0 ? (
            <p className="sec-quarterly-message">
              No USD observations supplied for:{" "}
              {current.evidence.coverage.conceptsWithoutUsd.join(", ")}. No
              currency conversion was applied.
            </p>
          ) : null}
          {current.evidence.olderHistoryAvailable ? (
            <p className="sec-quarterly-message">
              Older filing metadata exists outside the current submissions
              response and was not fetched. Unmatched observations keep their
              source dates.
            </p>
          ) : null}
          <div className="sec-quarterly-actions">
            <label>
              Observation metric
              <select
                aria-label="SEC observation metric"
                value={metric}
                onChange={(event) => {
                  setMetric(event.target.value);
                  setPage(0);
                  setComparisonId(null);
                  setComparisonPage(0);
                  comparisonTrigger.current = null;
                }}
              >
                <option value="all">Revenue and net income</option>
                <option value="revenue">Revenue</option>
                <option value="net_income">Net income</option>
              </select>
            </label>
            <p role="status">
              {observations.length === 0
                ? "No observations to display."
                : `${page * pageSize + 1} – ${Math.min((page + 1) * pageSize, observations.length)} of ${observations.length} loaded observations`}
            </p>
          </div>
          {comparison === null ? null : (
            <section
              className="sec-quarterly-comparison"
              id="sec-quarterly-comparison"
              aria-labelledby="sec-quarterly-comparison-title"
            >
              <div className="sec-quarterly-comparison-heading">
                <h3
                  id="sec-quarterly-comparison-title"
                  ref={comparisonHeading}
                  tabIndex={-1}
                >
                  Same-period comparison
                </h3>
                <button type="button" onClick={closeComparison}>
                  Close comparison
                </button>
              </div>
              <ComparisonResult
                comparison={comparison}
                page={comparisonPage}
                onPageChange={setComparisonPage}
              />
              <p className="sec-quarterly-message">
                Uses only the loaded observations; comparison makes no source
                requests. Different values do not establish a restatement, and
                no revision is selected for calculation. This is not a complete
                revision history. TTM remains unavailable.
              </p>
              {current.evidence.coverage.truncated ? (
                <p className="discovery-warning">
                  This source response was truncated. Matching observations may
                  have been omitted, so this comparison may be incomplete.
                </p>
              ) : null}
              {current.evidence.coverage.invalidRows > 0 ? (
                <p className="discovery-warning">
                  {current.evidence.coverage.invalidRows} invalid source rows
                  were excluded from the loaded observations and this
                  comparison.
                </p>
              ) : null}
              {current.evidence.sources.submissions.status !== "available" ? (
                <p className="discovery-warning">
                  Current submissions:{" "}
                  {sourceLabels[current.evidence.sources.submissions.status]}.
                  Filing metadata could not be fully checked.
                </p>
              ) : null}
              {current.evidence.olderHistoryAvailable ? (
                <p className="sec-quarterly-message">
                  Older filing metadata was not loaded. Unmatched accession
                  metadata remains unresolved.
                </p>
              ) : null}
            </section>
          )}
          {rows.length === 0 ? (
            <p className="discovery-empty-state">
              No dated USD observations are available for this selection. Source
              statuses and omissions remain visible above.
            </p>
          ) : (
            <div
              ref={observationsRegion}
              className="sec-quarterly-table-scroll"
              role="region"
              tabIndex={0}
              aria-label="Dated SEC source observations"
            >
              <table className="sec-quarterly-table">
                <caption>
                  Source observations · newest end date first · revisions and
                  durations kept separate
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Reported field</th>
                    <th scope="col">Actual source dates</th>
                    <th scope="col">Value (USD)</th>
                    <th scope="col">Filing and provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr
                      key={item.id}
                      className={
                        comparisonId === item.id
                          ? "sec-quarterly-selected-row"
                          : undefined
                      }
                      aria-current={
                        comparisonId === item.id ? "true" : undefined
                      }
                    >
                      <th scope="row">
                        <strong>
                          {item.metric === "revenue" ? "Revenue" : "Net income"}
                        </strong>
                        <span>
                          {item.taxonomy}:{item.concept}
                        </span>
                      </th>
                      <td>
                        {item.startDate === null ? (
                          <span>Start date not supplied</span>
                        ) : (
                          <span>{item.startDate} to</span>
                        )}
                        <strong>{item.endDate}</strong>
                        <span>
                          {item.durationDays === null
                            ? "Duration unknown"
                            : `${item.durationDays} calendar days`}
                        </span>
                        <span>Period basis unresolved</span>
                      </td>
                      <td>
                        <strong className="sec-quarterly-value">
                          {formatUsd(item.value)}
                        </strong>
                        <button
                          className="sec-quarterly-compare-action"
                          type="button"
                          aria-label={`Compare same period for ${metricLabel(item.metric)}, ${item.concept}, ${item.startDate ?? "unknown start date"} to ${item.endDate}, accession ${item.accessionNumber}, value ${item.value} USD`}
                          aria-expanded={comparisonId === item.id}
                          aria-controls={
                            comparison === null
                              ? undefined
                              : "sec-quarterly-comparison"
                          }
                          onClick={(event) =>
                            openComparison(
                              item.id,
                              event?.currentTarget ?? null,
                            )
                          }
                        >
                          Compare same period
                        </button>
                        {comparisonId === item.id ? (
                          <span className="sec-quarterly-selected-label">
                            Selected for comparison
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span>
                          {item.form} · Filed {item.filedDate}
                        </span>
                        <strong>{filingLabels[item.filing.status]}</strong>
                        {item.filing.status === "matched" &&
                        item.filing.sourceUrl !== null ? (
                          <a
                            href={item.filing.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View SEC filing
                          </a>
                        ) : null}
                        <ObservationDetails observation={item} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {observations.length > pageSize ? (
            <nav
              aria-label="SEC observation pages"
              className="sec-quarterly-actions"
            >
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                Previous observations
              </button>
              <button
                type="button"
                disabled={(page + 1) * pageSize >= observations.length}
                onClick={() => setPage((value) => value + 1)}
              >
                Next observations
              </button>
            </nav>
          ) : null}
          <p className="market-attribution">
            Source: SEC Company Facts and current Submissions for CIK{" "}
            {current.security.cik}. Values reflect extracted filing
            observations, including different revisions. Filing acceptance does
            not establish first public availability. No point-in-time or TTM
            claim is made.
          </p>
        </>
      )}
    </section>
  );
}

function ComparisonResult({
  comparison,
  page,
  onPageChange,
}: {
  readonly comparison: PersonalSecQuarterlyComparison;
  readonly page: number;
  readonly onPageChange: (page: number) => void;
}) {
  const selected = comparison.selected;
  return (
    <>
      <dl className="sec-quarterly-comparison-coordinates">
        <div>
          <dt>Reported field and unit</dt>
          <dd>
            {metricLabel(selected.metric)} · {selected.unit}
          </dd>
        </div>
        <div>
          <dt>Exact source concept</dt>
          <dd>{`${selected.taxonomy}:${selected.concept}`}</dd>
        </div>
        <div>
          <dt>Actual source period</dt>
          <dd>
            {selected.startDate ?? "Start date not supplied"} to{" "}
            {selected.endDate}
          </dd>
        </div>
      </dl>
      <p className="sec-quarterly-message">
        Issuer CIK {comparison.cik} · Selected observation:{" "}
        {formatUsd(selected.value)} · Accession {selected.accessionNumber} ·{" "}
        {selected.form} · Filed {selected.filedDate}.
      </p>
      {comparison.status === "missing_period" ? (
        <p className="discovery-warning" role="status">
          Comparison unavailable: this observation has no start date. Unknown
          periods are not grouped together.
        </p>
      ) : (
        <>
          <p className="sec-quarterly-comparison-summary" role="status">
            <strong>
              {comparison.relation === "single_observation"
                ? "Single retained observation."
                : comparison.relation === "same_value"
                  ? "Same reported value."
                  : "Different reported values."}
            </strong>{" "}
            {comparison.rows.length} retained{" "}
            {comparison.rows.length === 1 ? "observation" : "observations"}{" "}
            across {comparison.distinctAccessions} distinct{" "}
            {comparison.distinctAccessions === 1 ? "accession" : "accessions"}.{" "}
            {comparison.distinctValues} distinct reported{" "}
            {comparison.distinctValues === 1 ? "value" : "values"}.
          </p>
          {comparison.conflictingAccessions.length === 0 ? null : (
            <p className="discovery-warning">
              Different values occur within{" "}
              {comparison.conflictingAccessions.length}{" "}
              {comparison.conflictingAccessions.length === 1
                ? "accession"
                : "accessions"}
              . The affected rows are flagged below; filing membership does not
              resolve these differences.
            </p>
          )}
          <div
            className="sec-quarterly-table-scroll"
            role="region"
            tabIndex={0}
            aria-label="Same-period SEC observation comparison"
          >
            <table className="sec-quarterly-table sec-quarterly-comparison-table">
              <caption>
                Exact source period and concept shown above · oldest filing date
                first · no preferred revision
              </caption>
              <thead>
                <tr>
                  <th scope="col">Value (USD)</th>
                  <th scope="col">Accession and filing</th>
                  <th scope="col">Filing match</th>
                  <th scope="col">Provenance</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows
                  .slice(page * pageSize, (page + 1) * pageSize)
                  .map((item) => (
                    <tr
                      key={item.id}
                      className={
                        item.id === selected.id
                          ? "sec-quarterly-selected-row"
                          : undefined
                      }
                      aria-current={
                        item.id === selected.id ? "true" : undefined
                      }
                    >
                      <th scope="row">
                        <strong className="sec-quarterly-value">
                          {formatUsd(item.value)}
                        </strong>
                        {item.id === selected.id ? (
                          <span className="sec-quarterly-selected-label">
                            Selected observation
                          </span>
                        ) : null}
                      </th>
                      <td>
                        <strong>{item.accessionNumber}</strong>
                        <span>
                          {item.form} · Filed {item.filedDate}
                        </span>
                        {comparison.conflictingAccessions.includes(
                          item.accessionNumber,
                        ) ? (
                          <span className="sec-quarterly-comparison-conflict">
                            Different values within this accession
                          </span>
                        ) : null}
                      </td>
                      <td>{filingLabels[item.filing.status]}</td>
                      <td>
                        {item.filing.status === "matched" &&
                        item.filing.sourceUrl !== null ? (
                          <a
                            href={item.filing.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View SEC filing
                          </a>
                        ) : null}
                        <ObservationDetails observation={item} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="sec-quarterly-actions">
            <p role="status">
              {page * pageSize + 1} –{" "}
              {Math.min((page + 1) * pageSize, comparison.rows.length)} of{" "}
              {comparison.rows.length} matching observations
            </p>
            {comparison.rows.length > pageSize ? (
              <nav
                aria-label="SEC comparison pages"
                className="sec-quarterly-actions"
              >
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => onPageChange(Math.max(0, page - 1))}
                >
                  Previous comparison observations
                </button>
                <button
                  type="button"
                  disabled={(page + 1) * pageSize >= comparison.rows.length}
                  onClick={() => onPageChange(page + 1)}
                >
                  Next comparison observations
                </button>
              </nav>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}

function ObservationDetails({
  observation: item,
}: {
  readonly observation: PersonalSecQuarterlyObservationDto;
}) {
  return (
    <details className="sec-quarterly-row-details">
      <summary>Inspect observation</summary>
      <dl>
        <dt>Accession</dt>
        <dd>{item.accessionNumber}</dd>
        <dt>Filing focus, not the fact quarter</dt>
        <dd>
          {item.filingFocusYear === null
            ? "Year not supplied"
            : `FY ${item.filingFocusYear}`}{" "}
          · {item.filingFocusPeriod ?? "Period not supplied"}
        </dd>
        <dt>Source calendar frame</dt>
        <dd>{item.frame ?? "Not supplied"}</dd>
        <dt>Company Facts locator</dt>
        <dd>{item.sourceLocator}</dd>
        {item.filing.form === null ? null : (
          <>
            <dt>Current submissions metadata</dt>
            <dd>
              {item.filing.form} · Filed {item.filing.filedDate}
            </dd>
          </>
        )}
        {item.filing.reportDate === null ? null : (
          <>
            <dt>Filing report date</dt>
            <dd>{item.filing.reportDate}</dd>
          </>
        )}
        {item.filing.acceptedAt === null ? null : (
          <>
            <dt>Filing accepted</dt>
            <dd>{formatInstant(item.filing.acceptedAt)}</dd>
          </>
        )}
        <dt>Observation identifier</dt>
        <dd>{item.id}</dd>
      </dl>
    </details>
  );
}

function sameSelection(
  security: PersonalSecQuarterlyEvidenceResponseDto["security"],
  selection: PersonalMarketSelection,
): boolean {
  return (
    security.listingId === selection.listingId &&
    security.issuerId === selection.issuerId &&
    security.symbol === selection.symbol &&
    security.country === selection.country &&
    security.exchangeMic === selection.exchangeMic &&
    security.issuerName === selection.issuerName &&
    security.securityName === selection.securityName
  );
}
function formatInstant(value: string): string {
  return `${value.replace("T", " ").replace(/Z$/u, "")} UTC`;
}
function metricLabel(
  metric: PersonalSecQuarterlyObservationDto["metric"],
): string {
  return metric === "revenue" ? "Revenue" : "Net income";
}
function formatUsd(value: string): string {
  const negative = value.startsWith("-");
  const [integer = "0", fraction] = (negative ? value.slice(1) : value).split(
    ".",
  );
  return `${negative ? "−" : ""}$${integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}${fraction === undefined ? "" : `.${fraction}`}`;
}
