"use client";

import type {
  PersonalSecFilingContextCandidateDto,
  PersonalSecFilingContextInspectionDto,
  PersonalSecFilingContextQNameDto,
  PersonalSecFilingContextResponseDto,
  PersonalSecFilingContextUnavailableReason,
  PersonalSecFilingReportingMetadataDto,
  PersonalSecFilingReportingObservationDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";
import {
  fetchPersonalSecFilingContext,
  selectPersonalSecFilingContextObservation,
} from "../../lib/personal-sec-filing-context-api";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export interface PersonalSecFilingContextProps {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly selection: PersonalMarketSelection;
  readonly observation: PersonalSecQuarterlyObservationDto;
  readonly responseGeneration: number;
  readonly requestToken: number;
  readonly enabled: boolean;
  readonly onSessionUnavailable: () => void;
  readonly onClose: () => void;
}

const unavailable: Record<PersonalSecFilingContextUnavailableReason, string> = {
  selection_changed_or_not_retained:
    "The selected observation changed or is no longer retained by the bounded Company Facts response. Refresh SEC evidence and select an observation again.",
  accession_not_in_current_submissions:
    "This accession was not found in current Submissions. Older history was not loaded.",
  submission_metadata_conflict:
    "The filing metadata no longer agrees with the selected observation. Refresh SEC evidence before inspecting again.",
  primary_document_unavailable:
    "A supported primary filing document could not be identified.",
  not_covered: "The source does not cover this filing.",
  rate_limited: "SEC requests are rate limited. Retry later.",
  upstream_unavailable: "The SEC source is unavailable. Retry later.",
  invalid_response: "The source response could not be validated.",
  response_too_large: "The source response exceeds the inspection size limit.",
  candidate_limit:
    "The source exceeds the candidate limit; an incomplete prefix was not used.",
  runtime_unavailable:
    "The filing parser runtime is unavailable in local startup settings.",
  parser_timeout: "The filing parser exceeded its time limit.",
  worker_failed: "The filing parser could not complete this inspection.",
  invalid_output: "The filing parser result could not be validated.",
  output_too_large: "The filing parser output exceeds the inspection limit.",
};
const outcome = {
  matched: "Exact value correspondence found",
  value_differs: "Corresponding filing value differs",
  ambiguous: "Conflicting corresponding values",
  no_corresponding_fact:
    "No corresponding fact found in the supported projection",
  unsupported: "Correspondence could not be established",
} as const;

export function PersonalSecFilingContext(props: PersonalSecFilingContextProps) {
  const {
    catalogSnapshotSha256,
    selection,
    observation,
    responseGeneration,
    requestToken,
    enabled,
  } = props;
  const [result, setResult] =
    useState<PersonalSecFilingContextResponseDto | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(
    "Preparing selected filing inspection…",
  );
  const [isError, setIsError] = useState(false);
  const [page, setPage] = useState(0);
  const context = JSON.stringify([
    catalogSnapshotSha256,
    selection,
    observation,
    responseGeneration,
    enabled,
    requestToken,
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
    invalidate("Preparing selected filing inspection…");
    setLoadedContext(context);
    heading.current?.focus();
    const scheduledEpoch = epoch.current;
    // Deferring dispatch lets StrictMode clean up its first setup before any I/O.
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

  function invalidate(nextMessage: string) {
    epoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    setResult(null);
    setRunning(false);
    setPage(0);
    setMessage(nextMessage);
    setIsError(false);
  }

  async function load() {
    if (
      !mounted.current ||
      sessionLost.current ||
      !enabled ||
      activeContext.current !== context ||
      controller.current !== null ||
      observation.filing.status !== "matched" ||
      observation.startDate === null ||
      (observation.form !== "10-Q" && observation.form !== "10-Q/A")
    )
      return;
    invalidate(
      "Revalidating the selected observation and inspecting its primary filing…",
    );
    setLoadedContext(context);
    const operationEpoch = epoch.current;
    const operation = new AbortController();
    controller.current = operation;
    setRunning(true);
    const current = () =>
      operationEpoch === epoch.current &&
      activeContext.current === context &&
      !operation.signal.aborted;
    try {
      const next = await fetchPersonalSecFilingContext(
        {
          schemaVersion: "2.0.0",
          catalogSnapshotSha256,
          listingId: selection.listingId,
          symbol: selection.symbol,
          selection: selectPersonalSecFilingContextObservation(observation),
        },
        operation.signal,
      );
      if (!current()) return;
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
        "Filing inspection completed. Refresh explicitly to inspect the sources again.",
      );
    } catch (error) {
      if (!current()) return;
      setResult(null);
      const code =
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable";
      if (code === "session_unavailable") {
        sessionLost.current = true;
        invalidate(
          "The owner session expired. Revalidate it before inspecting filings.",
        );
        callbacks.current.onSessionUnavailable();
      } else {
        setIsError(true);
        setMessage(
          code === "not_configured"
            ? "SEC contact setup is required in local startup settings."
            : code === "conflict"
              ? "The catalog or selected source observation changed. Refresh SEC evidence and select the observation again."
              : code === "rate_limited"
                ? "SEC requests are rate limited. Retry later."
                : code === "invalid_response"
                  ? "The inspection response could not be validated for this company and observation."
                  : "Filing inspection could not be completed. The loaded SEC observations remain available.",
        );
      }
    } finally {
      if (current()) {
        controller.current = null;
        setRunning(false);
      }
    }
  }

  const currentContext =
    enabled && !sessionLost.current && loadedContext === context;
  const inspection = currentContext ? (result?.inspection ?? null) : null;
  const isRunning = currentContext && running;
  return (
    <section
      id="sec-filing-context"
      className="sec-filing-context"
      aria-labelledby="sec-filing-context-title"
      aria-busy={isRunning}
    >
      <div className="sec-quarterly-comparison-heading">
        <h3 id="sec-filing-context-title" tabIndex={-1} ref={heading}>
          Selected filing context
        </h3>
        <button
          type="button"
          onClick={() => {
            invalidate("Inspection closed.");
            callbacks.current.onClose();
          }}
        >
          Close filing inspection
        </button>
      </div>
      {currentContext ? (
        <>
          <p className="sec-quarterly-message">
            {inspection?.status === "available"
              ? "Revalidated source observation"
              : "Requested source observation"}{" "}
            · {selection.symbol} · Accession {observation.accessionNumber} ·{" "}
            {observation.form} · Filed {observation.filedDate}
          </p>
          <dl className="sec-quarterly-comparison-coordinates">
            <div>
              <dt>Source concept and unit</dt>
              <dd>
                {`${observation.taxonomy}:${observation.concept}`} ·{" "}
                {observation.unit}
              </dd>
            </div>
            <div>
              <dt>Actual source period</dt>
              <dd>
                {observation.startDate ?? "Unknown start"} to{" "}
                {observation.endDate}
                <span className="sec-filing-metadata-duration">
                  {observation.durationDays === null
                    ? "Inclusive duration unavailable"
                    : `${observation.durationDays} days, inclusive`}
                </span>
              </dd>
            </div>
            <div>
              <dt>Selected exact value (USD)</dt>
              <dd className="sec-quarterly-value">{observation.value}</dd>
            </div>
          </dl>
        </>
      ) : null}
      <div className="sec-quarterly-actions">
        <button
          type="button"
          disabled={!currentContext || isRunning}
          onClick={() => void load()}
        >
          Refresh filing inspection
        </button>
        {isRunning ? (
          <button
            type="button"
            onClick={() =>
              invalidate("Filing inspection cancelled. Refresh when ready.")
            }
          >
            Cancel filing inspection
          </button>
        ) : null}
      </div>
      <p
        role={isError && currentContext ? "alert" : "status"}
        className={
          isError && currentContext
            ? "market-message market-message-error"
            : "sec-quarterly-message"
        }
      >
        {sessionLost.current
          ? "The owner session expired. Revalidate it before inspecting filings."
          : currentContext
            ? message
            : "The selected context changed. Choose an observation to inspect."}
      </p>
      {inspection === null ? null : inspection.status === "unavailable" ? (
        <p className="discovery-warning" role="status">
          <strong>
            Inspection unavailable during{" "}
            {inspection.stage.replaceAll("_", " ")}.
          </strong>{" "}
          {unavailable[inspection.reason]}
        </p>
      ) : (
        <InspectionResult
          inspection={inspection}
          page={page}
          onPageChange={setPage}
        />
      )}
      <p className="sec-quarterly-caveat">
        <strong>TTM remains unavailable.</strong> A value match does not
        establish standalone-quarter or year-to-date basis, a fiscal calendar,
        consolidated accounting semantics or a preferred revision. Inspection
        does not replace loaded observations. Only the bounded primary-document
        projection is examined; no general filing-coverage claim is made.
      </p>
    </section>
  );
}

function InspectionResult({
  inspection,
  page,
  onPageChange,
}: {
  readonly inspection: Extract<
    PersonalSecFilingContextInspectionDto,
    { status: "available" }
  >;
  readonly page: number;
  readonly onPageChange: (page: number) => void;
}) {
  const { analysis, observation } = inspection;
  const size = 10;
  const rows = analysis.candidates.slice(page * size, (page + 1) * size);
  return (
    <>
      <ReportingMetadata
        metadata={analysis.reportingMetadata}
        reportDate={observation.filing.reportDate}
      />
      <p className="sec-filing-context-outcome" role="status">
        <strong>{outcome[analysis.status]}</strong>
        {analysis.reason === null
          ? null
          : ` · ${analysis.reason.replaceAll("_", " ")}`}
      </p>
      <p className="sec-quarterly-message">
        Issuer CIK {inspection.cik}.{" "}
        {analysis.correspondingCandidateLocators.length} corresponding
        candidates; {analysis.candidates.length} retained candidates. Equivalent
        references remain separate. Unsupported or conflicting candidates do not
        select a preferred value.
      </p>
      {analysis.reason !== null && analysis.candidates.length === 0 ? (
        <p className="discovery-warning">
          The parser stopped with an unsupported or bounded result. No
          partial-prefix candidates are presented.
        </p>
      ) : null}
      {analysis.status === "unsupported" && analysis.candidates.length > 0 ? (
        <p className="discovery-warning">
          Some candidates remain unsupported or uncertain. Retained references
          are shown for inspection; a clean candidate cannot establish a match
          while relevant uncertainty remains.
        </p>
      ) : null}
      <details className="sec-quarterly-row-details">
        <summary>Inspect revalidated source references</summary>
        <dl>
          <dt>Company Facts retrieved</dt>
          <dd>{inspection.companyFacts.fetchedAt}</dd>
          <dt>Company Facts source</dt>
          <dd>{inspection.companyFacts.sourceUrl}</dd>
          <dt>Current Submissions retrieved</dt>
          <dd>{inspection.submissions.fetchedAt}</dd>
          <dt>Submissions source</dt>
          <dd>{inspection.submissions.sourceUrl}</dd>
          <dt>Primary document retrieved</dt>
          <dd>{inspection.document.fetchedAt}</dd>
          <dt>Document digest and bytes</dt>
          <dd>
            {inspection.document.sha256} · {inspection.document.bytes} bytes
          </dd>
          <dt>Revalidated observation</dt>
          <dd>{observation.id}</dd>
          <dt>Company Facts locator</dt>
          <dd>{observation.sourceLocator}</dd>
          <dt>Filing acceptance (not first public availability)</dt>
          <dd>{observation.filing.acceptedAt ?? "Not supplied"}</dd>
        </dl>
        <a
          href={inspection.document.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View inspected SEC document
        </a>
      </details>
      {rows.length === 0 ? (
        <p className="discovery-empty-state">
          No candidate values are available from this inspection. Absence is not
          a zero-valued fact.
        </p>
      ) : (
        <div
          role="region"
          tabIndex={0}
          aria-label="Selected source versus filing candidates"
          className="sec-quarterly-table-scroll"
        >
          <table className="sec-quarterly-table sec-filing-context-table">
            <caption>
              Filing candidates in document order · compare with the selected
              source fields above
            </caption>
            <thead>
              <tr>
                <th scope="col">Entity and concept</th>
                <th scope="col">Period and unit</th>
                <th scope="col">Exact filing value (USD)</th>
                <th scope="col">Correspondence and provenance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((candidate) => (
                <tr key={candidate.locator}>
                  <th scope="row">
                    <strong>CIK {candidate.entityCik ?? "unresolved"}</strong>
                    <span>{candidate.concept.raw}</span>
                    <span>
                      {candidate.concept.namespace ?? "Namespace unresolved"}
                    </span>
                  </th>
                  <td>
                    <span>
                      {candidate.startDate ?? "No start date"} to{" "}
                      {candidate.endDate ?? "No end date"}
                    </span>
                    <span>{candidate.periodKind}</span>
                    <strong>
                      {candidate.unit ?? "Unit unsupported or unresolved"}
                    </strong>
                    <span>
                      {candidate.dimensions.length === 0
                        ? "No explicit/typed dimensions retained"
                        : `${candidate.dimensions.length} dimensions retained`}
                    </span>
                  </td>
                  <td>
                    <strong className="sec-quarterly-value">
                      {candidate.value ?? "Value unavailable"}
                    </strong>
                  </td>
                  <td>
                    <strong>
                      {analysis.correspondingCandidateLocators.includes(
                        candidate.locator,
                      )
                        ? candidate.value === observation.value
                          ? "Corresponding coordinate; same exact value"
                          : "Corresponding coordinate; different value"
                        : "Correspondence not established"}
                    </strong>
                    {candidate.issues.length > 0 ? (
                      <span>
                        {candidate.issues
                          .map((issue) => issue.replaceAll("_", " "))
                          .join("; ")}
                      </span>
                    ) : null}
                    <CandidateDetails candidate={candidate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {analysis.candidates.length > 0 ? (
        <div className="sec-quarterly-actions">
          <p role="status">
            {page * size + 1} –{" "}
            {Math.min((page + 1) * size, analysis.candidates.length)} of{" "}
            {analysis.candidates.length} filing candidates
          </p>
          {analysis.candidates.length > size ? (
            <nav
              aria-label="Filing candidate pages"
              className="sec-quarterly-actions"
            >
              <button
                type="button"
                disabled={page === 0}
                onClick={() => onPageChange(Math.max(0, page - 1))}
              >
                Previous filing candidates
              </button>
              <button
                type="button"
                disabled={(page + 1) * size >= analysis.candidates.length}
                onClick={() => onPageChange(page + 1)}
              >
                Next filing candidates
              </button>
            </nav>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

const reportingLabels = {
  DocumentType: "Document type",
  DocumentPeriodEndDate: "Document period end",
  DocumentFiscalYearFocus: "Fiscal year focus",
  DocumentFiscalPeriodFocus: "Fiscal period focus",
} as const;
const reportingStatus = {
  observed: "Observed; supported references agree",
  missing: "No supported same-issuer value",
  conflicting: "Conflicting reported values",
  unsupported: "Value unresolved",
} as const;

function ReportingMetadata({
  metadata,
  reportDate,
}: {
  readonly metadata: PersonalSecFilingReportingMetadataDto;
  readonly reportDate: string | null;
}) {
  const periodEnd = metadata.fields.find(
    (field) => field.concept === "DocumentPeriodEndDate",
  );
  return (
    <section
      className="sec-filing-metadata"
      aria-labelledby="sec-filing-metadata-title"
    >
      <h4 id="sec-filing-metadata-title">Filing-declared reporting metadata</h4>
      <p className="sec-quarterly-caveat">
        These labels describe this filing. They do not assign fiscal labels to
        the selected fact, whose actual dates and inclusive duration are shown
        above. Comparative and longer-duration facts can appear in the same
        filing. Standalone-quarter/YTD basis, revisions and TTM remain
        unresolved.
      </p>
      {metadata.status === "assessed" ? null : (
        <p className="discovery-warning" role="status">
          {metadata.status === "limited"
            ? "Reporting metadata reached a separate extraction limit. No partial metadata references are shown; the numeric result below is assessed separately."
            : "Reporting metadata is unavailable because the document could not be fully inspected. No partial metadata references are shown."}
          {metadata.reason === null
            ? null
            : ` Reason: ${metadata.reason.replaceAll("_", " ")}.`}
        </p>
      )}
      <div className="sec-filing-metadata-grid">
        {metadata.fields.map((field) => {
          const references = metadata.observations.filter((row) =>
            field.observationLocators.includes(row.locator),
          );
          return (
            <section className="sec-filing-metadata-field" key={field.concept}>
              <h5>{reportingLabels[field.concept]}</h5>
              <p>{field.concept}</p>
              <p>
                <strong>{field.value ?? "No resolved value"}</strong>
              </p>
              <p>{reportingStatus[field.status]}</p>
              {references.length === 0 ? (
                <p>No retained references.</p>
              ) : (
                <details className="sec-quarterly-row-details">
                  <summary>
                    Inspect {references.length}{" "}
                    {references.length === 1 ? "reference" : "references"} for{" "}
                    {field.concept}
                  </summary>
                  {references.map((row) => (
                    <ReportingReference key={row.locator} row={row} />
                  ))}
                </details>
              )}
            </section>
          );
        })}
      </div>
      <p className="sec-quarterly-message">
        <strong>Report-end comparison with current Submissions.</strong>{" "}
        {periodEnd?.status === "observed" && periodEnd.value !== null
          ? reportDate === null
            ? `The filing declares ${periodEnd.value}; current Submissions does not supply a report date, so agreement cannot be checked.`
            : periodEnd.value === reportDate
              ? `The filing-declared period end and current Submissions report date agree: ${reportDate}.`
              : `The filing declares ${periodEnd.value}; current Submissions reports ${reportDate}. These dates differ; neither replaces the selected fact’s period.`
          : `The filing-declared period end is unresolved. Current Submissions report date: ${reportDate ?? "not supplied"}. No agreement is established.`}
      </p>
    </section>
  );
}

function ReportingReference({
  row,
}: {
  readonly row: PersonalSecFilingReportingObservationDto;
}) {
  return (
    <dl className="sec-filing-metadata-reference">
      <dt>Document element / fact / context identifiers</dt>
      <dd>
        {row.locator} / {row.factId ?? "Absent"} / {row.contextId ?? "Absent"}
      </dd>
      <dt>Resolved DEI concept</dt>
      <dd>{describeQName(row.concept)}</dd>
      <dt>Context entity</dt>
      <dd>
        CIK {row.entityCik ?? "unresolved"} ·{" "}
        {row.entityIdentifier ?? "Unresolved"} ·{" "}
        {row.entityScheme ?? "Unresolved"}
      </dd>
      <dt>Metadata context period</dt>
      <dd>
        {row.periodKind} · {row.startDate ?? "No start date"} to{" "}
        {row.endDate ?? "No end date"}
      </dd>
      <dt>Raw metadata text</dt>
      <dd className="sec-filing-context-raw">{row.rawText || "Empty"}</dd>
      <dt>Format attribute</dt>
      <dd>{row.format === null ? "Absent" : describeQName(row.format)}</dd>
      <dt>Normalized reference value</dt>
      <dd>{row.value ?? "Unavailable"}</dd>
      <dt>Reference assessment</dt>
      <dd>
        {row.issues.length === 0
          ? "Supported same-issuer reference"
          : row.issues.map((issue) => issue.replaceAll("_", " ")).join("; ")}
      </dd>
      <dt>Dimensions</dt>
      <dd>
        {row.dimensions.length === 0
          ? "No explicit/typed dimensions retained"
          : row.dimensions
              .map(
                (dimension) =>
                  `${dimension.kind}: ${describeQName(dimension.dimension)} · ${dimension.member === null ? (dimension.typedText ?? "Member unresolved") : describeQName(dimension.member)}`,
              )
              .join("; ")}
      </dd>
    </dl>
  );
}

function CandidateDetails({
  candidate,
}: {
  readonly candidate: PersonalSecFilingContextCandidateDto;
}) {
  return (
    <details className="sec-quarterly-row-details">
      <summary>Inspect candidate context</summary>
      <dl>
        <dt>Document element</dt>
        <dd>{candidate.locator}</dd>
        <dt>Fact / context / unit identifiers</dt>
        <dd>
          {candidate.factId ?? "Absent"} / {candidate.contextId ?? "Absent"} /{" "}
          {candidate.unitId ?? "Absent"}
        </dd>
        <dt>Entity identifier and scheme</dt>
        <dd>
          {candidate.entityIdentifier ?? "Unresolved"} ·{" "}
          {candidate.entityScheme ?? "Unresolved"}
        </dd>
        <dt>Resolved concept</dt>
        <dd>{describeQName(candidate.concept)}</dd>
        <dt>Unit measures</dt>
        <dd>
          {candidate.unitMeasures.map(describeQName).join("; ") || "Unresolved"}
        </dd>
        <dt>Raw numeric text</dt>
        <dd className="sec-filing-context-raw">
          {candidate.rawText || "Empty"}
        </dd>
        <dt>Transformation</dt>
        <dd>
          {candidate.format === null
            ? "No format attribute"
            : describeQName(candidate.format)}
        </dd>
        <dt>Sign / scale / decimals / precision</dt>
        <dd>
          {[
            candidate.sign,
            candidate.scale,
            candidate.decimals,
            candidate.precision,
          ]
            .map((value) => value ?? "Absent")
            .join(" / ")}
        </dd>
        {candidate.dimensions.map((dimension, index) => (
          <div key={index}>
            <dt>{dimension.kind} dimension</dt>
            <dd>
              {describeQName(dimension.dimension)} ·{" "}
              {dimension.member === null
                ? (dimension.typedText ?? "Member unresolved")
                : describeQName(dimension.member)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
function describeQName(value: PersonalSecFilingContextQNameDto): string {
  return `${value.raw} · ${value.namespace ?? "namespace unresolved"} · ${value.localName ?? "local name unresolved"}`;
}
