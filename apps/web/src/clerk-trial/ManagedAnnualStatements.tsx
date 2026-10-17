import { useId, useState } from "react";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  type PersonalSecAnnualCanonicalEvidenceDto,
  type PersonalSecAnnualStatementCellDto,
  type PersonalSecAnnualStatementCellReason,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementDto,
  type PersonalSecAnnualStatementId,
  type PersonalSecAnnualStatementObservationDto,
  type PersonalSecAnnualStatementRegistryEntry,
  type PersonalSecAnnualStatementsDto,
} from "@research-cockpit/contracts";
import "./managed-annual-statements.css";

export interface ManagedAnnualStatementsProps {
  readonly evidence: PersonalSecAnnualCanonicalEvidenceDto;
  readonly statements: PersonalSecAnnualStatementsDto;
  readonly selectedCells: readonly Readonly<{
    concept: PersonalSecAnnualStatementConcept;
    endDate: string;
  }>[];
  readonly onToggleCell: (
    concept: PersonalSecAnnualStatementConcept,
    endDate: string,
  ) => void;
  /** Pauses note-cell selection; local reading and source inspection remain available. */
  readonly disabled?: boolean;
}
export const annualStatementLabels = {
  income_statement: "Income statement",
  balance_sheet: "Balance sheet",
  cash_flow: "Cash flow",
} as const;
export const annualStatementOrder = [
  "income_statement",
  "balance_sheet",
  "cash_flow",
] as const;
const sourceStatusLabels = {
  available: "available",
  not_covered: "not covered",
  rate_limited: "rate limited",
  upstream_unavailable: "unavailable from SEC",
  invalid_response: "invalid response",
  response_too_large: "source byte limit exceeded",
  candidate_limit: "source scan limit exceeded",
} as const;
const reasonText: Readonly<
  Record<PersonalSecAnnualStatementCellReason, string>
> = {
  invalid_clock: "The source or load dates are invalid.",
  source_unavailable: "A required SEC source is unavailable.",
  source_stale: "The source dates are outside the allowed limits.",
  target_unresolved: "An annual filing could not be selected.",
  invalid_response: "The concept's source data is invalid.",
  candidate_limit: "The concept exceeds the source scan limit.",
  invalid_source_rows: "The concept's source rows failed validation.",
  selected_report_overflow:
    "This filing has more observations for the concept than the allowed limit.",
  concept_missing: "This exact concept is absent from Company Facts.",
  usd_missing: "This concept has no reported USD observations.",
  empty_usd: "This concept's USD observation list is empty.",
  no_report_period: "No admitted fact matches this date and period.",
  unsupported_form: "The reported filing form is not supported.",
  missing_or_non_FY_focus: "The fact does not establish annual filing focus.",
  invalid_annual_period:
    "The reported duration does not meet the annual-period rules.",
  invalid_instant_period: "The fact does not establish an instant balance.",
  filing_unmatched_or_conflicted:
    "The fact's filing metadata is unmatched or conflicted.",
  report_end_mismatch:
    "The fact does not match the selected filing's report date.",
  future_or_inconsistent_dates:
    "The reported dates are future or inconsistent dates.",
  cutoff_time_unresolved:
    "Availability at the original load cutoff could not be established.",
  report_date_missing: "The filing's report date is missing.",
  filed_date_missing: "The filing's filed date is missing.",
  ambiguous_period: "Reported observations disagree on the period.",
  ambiguous_value: "Reported observations disagree on the amount.",
};

export function annualStatementUnavailableText(
  reason: PersonalSecAnnualStatementCellReason,
): string {
  return reasonText[reason];
}

function Observation({
  observation,
}: {
  readonly observation: PersonalSecAnnualStatementObservationDto;
}) {
  const filing = observation.filing;
  return (
    <div className="managed-annual-statement-observation">
      <dl>
        <div>
          <dt>Observation reference</dt>
          <dd>{observation.id}</dd>
        </div>
        <div>
          <dt>Original reported amount</dt>
          <dd>USD {observation.value}</dd>
        </div>
        <div>
          <dt>Reported period</dt>
          <dd>
            {observation.startDate === null
              ? `At ${observation.endDate}`
              : `${observation.startDate} through ${observation.endDate}`}
          </dd>
        </div>
        <div>
          <dt>Reported duration and period classification</dt>
          <dd>
            {observation.durationDays === null
              ? "Instant balance"
              : `${observation.durationDays} days`}{" "}
            · {observation.periodBasis}
          </dd>
        </div>
        <div>
          <dt>Source pointer</dt>
          <dd>{observation.sourceLocator}</dd>
        </div>
        <div>
          <dt>Fact filing</dt>
          <dd>
            {observation.form} · {observation.accessionNumber} · filed{" "}
            {observation.filedDate}
          </dd>
        </div>
        <div>
          <dt>Filing metadata match</dt>
          <dd>{filing.status}</dd>
        </div>
        <div>
          <dt>Matched filing dates</dt>
          <dd>
            Form {filing.form ?? "Unavailable"}; report date{" "}
            {filing.reportDate ?? "Unavailable"}; filed{" "}
            {filing.filedDate ?? "Unavailable"}; accepted{" "}
            {filing.acceptedAt ?? "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>Filing reference</dt>
          <dd>{filing.sourceUrl ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt>Annual focus and source frame</dt>
          <dd>
            {observation.filingFocusYear ?? "Unavailable"} ·{" "}
            {observation.filingFocusPeriod ?? "Unavailable"} ·{" "}
            {observation.frame ?? "No frame supplied"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function LineInspection({
  entry,
  cells,
  evidence,
}: {
  readonly entry: PersonalSecAnnualStatementRegistryEntry;
  readonly cells: readonly PersonalSecAnnualStatementCellDto[];
  readonly evidence: PersonalSecAnnualCanonicalEvidenceDto;
}) {
  const conceptScan = evidence.facts.scans.find(
    (item) => item.concept === entry.concept,
  )?.scan;
  const observations = evidence.facts.observations.filter(
    (item) => item.concept === entry.concept,
  );
  return (
    <details className="managed-annual-statement-inspect">
      <summary>Inspect {entry.label}</summary>
      <dl>
        <div>
          <dt>Exact concept and unit</dt>
          <dd>
            {entry.taxonomy}:{entry.concept} · {entry.unit}
          </dd>
        </div>
        <div>
          <dt>Registered meaning</dt>
          <dd>{entry.qualification}</dd>
        </div>
        <div>
          <dt>Taxonomy basis</dt>
          <dd>
            {entry.taxonomyStatus === "legacy_deprecated"
              ? `Legacy basis, deprecated ${entry.deprecatedDate}; verified against ${entry.verifiedTaxonomyVersion}.`
              : `Active concept in US-GAAP ${entry.verifiedTaxonomyVersion}.`}
          </dd>
        </div>
        <div>
          <dt>Concept scan</dt>
          <dd>
            {conceptScan?.status ?? "Unavailable"}
            {conceptScan?.status === "available" && conceptScan.absence
              ? ` · ${conceptScan.absence}`
              : ""}
          </dd>
        </div>
        {conceptScan?.status === "available" && (
          <div>
            <dt>Scan coverage</dt>
            <dd>
              {conceptScan.coverage.full.candidateRows} candidate rows;{" "}
              {conceptScan.coverage.full.inspectedRows} source rows inspected;{" "}
              {conceptScan.coverage.full.invalidRows} invalid;{" "}
              {conceptScan.coverage.full.duplicateRows} duplicates;{" "}
              {conceptScan.coverage.full.uniqueObservations} unique
              observations; {conceptScan.coverage.selected ?? "Unresolved"}{" "}
              selected-filing observations; {conceptScan.coverage.returned}{" "}
              returned; {conceptScan.coverage.omittedSelected ?? "Unresolved"}{" "}
              omitted; {conceptScan.coverage.otherAccessions ?? "Unresolved"}{" "}
              observations from other accessions.
            </dd>
          </div>
        )}
      </dl>
      <p>
        All returned observations for this exact concept in the selected filing
        are below. Their presence does not establish a line's position in the
        published statements.
      </p>
      <dl>
        {cells.map((cell) => (
          <div key={cell.endDate}>
            <dt>Cell references for {cell.endDate}</dt>
            <dd>
              {cell.observationIds.length
                ? cell.observationIds.join(", ")
                : "No linked observations."}
            </dd>
          </div>
        ))}
      </dl>
      {observations.length ? (
        observations.map((observation) => (
          <Observation key={observation.id} observation={observation} />
        ))
      ) : (
        <p>No observations were returned for this concept.</p>
      )}
    </details>
  );
}

export function AnnualStatementCell({
  entry,
  cell,
  selected = false,
  disabled = false,
  onToggleCell,
}: {
  readonly entry: PersonalSecAnnualStatementRegistryEntry;
  readonly cell: PersonalSecAnnualStatementCellDto;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  /** Omit in a report to render only the exact value and its qualifications. */
  readonly onToggleCell?: ManagedAnnualStatementsProps["onToggleCell"];
}) {
  if (cell.status === "unavailable")
    return (
      <div className="managed-annual-statement-cell">
        <span>Unavailable. {annualStatementUnavailableText(cell.reason)}</span>
        <small>For {cell.endDate}</small>
      </div>
    );
  return (
    <div className="managed-annual-statement-cell">
      <strong className="managed-annual-statement-amount">
        USD {cell.value}
      </strong>
      <small>
        {cell.startDate === null
          ? `At ${cell.endDate}`
          : `${cell.startDate} through ${cell.endDate}`}
      </small>
      <small>
        {cell.currentUseEligible
          ? "Within current-use limits at this load."
          : "Historical value; not eligible for current use at this load."}
      </small>
      {onToggleCell && (
        <label className="managed-annual-statement-choice">
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            aria-label={`Include ${entry.label}, ${cell.startDate === null ? "at " : `${cell.startDate} through `}${cell.endDate}, USD ${cell.value} in the note`}
            onChange={() => {
              if (!disabled) onToggleCell(entry.concept, cell.endDate);
            }}
          />
          <span>Select for note</span>
        </label>
      )}
    </div>
  );
}

export function AnnualStatementTable({
  statement,
  evidence,
  selectedCells = [],
  onToggleCell,
  disabled = false,
}: Pick<ManagedAnnualStatementsProps, "evidence" | "disabled"> &
  Partial<
    Pick<ManagedAnnualStatementsProps, "selectedCells" | "onToggleCell">
  > & {
    readonly statement: PersonalSecAnnualStatementDto;
  }) {
  const entries = PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.filter(
    (entry) => entry.statement === statement.id,
  );
  if (!statement.columns.length)
    return (
      <>
        <p>No admitted statement dates are available for this load.</p>
        {!onToggleCell &&
          entries.map((entry) => (
            <section
              key={entry.concept}
              className="managed-annual-statement-undated"
            >
              <h5>{entry.label}</h5>
              <p>{entry.qualification}</p>
              <LineInspection entry={entry} cells={[]} evidence={evidence} />
            </section>
          ))}
      </>
    );
  return (
    <div
      className="managed-annual-statement-table"
      role="region"
      aria-label={`${annualStatementLabels[statement.id]} reported USD table`}
      tabIndex={0}
    >
      <table>
        <caption>
          {annualStatementLabels[statement.id]} · exact reported USD
        </caption>
        <thead>
          <tr>
            <th scope="col">Reported line</th>
            {statement.columns.map((column) => (
              <th key={column.endDate} scope="col">
                {column.endDate}
                <small>
                  {column.kind === "selected_report"
                    ? "Selected report date"
                    : "Historical comparative"}
                </small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const row = statement.rows.find(
              (item) => item.concept === entry.concept,
            );
            const cells = row?.cells ?? [];
            return (
              <tr key={entry.concept}>
                <th scope="row">
                  <span>{entry.label}</span>
                  <small>{entry.qualification}</small>
                  <LineInspection
                    entry={entry}
                    cells={cells}
                    evidence={evidence}
                  />
                </th>
                {statement.columns.map((column) => {
                  const cell = cells.find(
                    (item) => item.endDate === column.endDate,
                  );
                  return (
                    <td key={column.endDate}>
                      {cell ? (
                        <AnnualStatementCell
                          entry={entry}
                          cell={cell}
                          selected={selectedCells.some(
                            (choice) =>
                              choice.concept === entry.concept &&
                              choice.endDate === cell.endDate,
                          )}
                          disabled={disabled}
                          {...(onToggleCell ? { onToggleCell } : {})}
                        />
                      ) : (
                        <span>
                          Unavailable. No resolved cell was supplied for this
                          date.
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SourceContext({
  evidence,
}: {
  readonly evidence: PersonalSecAnnualCanonicalEvidenceDto;
}) {
  const { generation, target } = evidence;
  return (
    <>
      <p>
        {target.status === "target"
          ? `${target.form} · report date ${target.reportDate} · filed ${target.filedDate}.`
          : "An annual filing could not be selected for this load."}
      </p>
      <p>
        Company Facts captured{" "}
        {generation.sources.companyFacts.fetchedAt ?? "Unavailable"} (
        {sourceStatusLabels[generation.sources.companyFacts.status]}).
        Submissions captured{" "}
        {generation.sources.submissions.fetchedAt ?? "Unavailable"} (
        {sourceStatusLabels[generation.sources.submissions.status]}). Original
        load completed {generation.completedAt}.
      </p>
      <details className="managed-annual-statement-inspect">
        <summary>Inspect filing and original source references</summary>
        <dl>
          <div>
            <dt>Issuer CIK</dt>
            <dd>{evidence.cik}</dd>
          </div>
          <div>
            <dt>Selected filing</dt>
            <dd>
              {target.status === "target"
                ? `${target.accessionNumber}; accepted ${target.acceptedAt ?? "Unavailable"}`
                : target.reason}
            </dd>
          </div>
          <div>
            <dt>Original load cutoff</dt>
            <dd>{generation.cutoffAt}</dd>
          </div>
          <div>
            <dt>Annual definition and registry</dt>
            <dd>
              {generation.definitionVersion} · {evidence.facts.registryVersion}
            </dd>
          </div>
          <div>
            <dt>Generation digest</dt>
            <dd>{generation.sha256}</dd>
          </div>
          {(["companyFacts", "submissions"] as const).map((key) => {
            const source = generation.sources[key];
            return (
              <div key={key}>
                <dt>
                  {key === "companyFacts"
                    ? "Company Facts source"
                    : "Submissions source"}
                </dt>
                <dd>
                  {source.status} · {source.sourceUrl}
                  <br />
                  Captured {source.fetchedAt ?? "Unavailable"};{" "}
                  {source.bytes ?? "Unknown"} bytes;{" "}
                  {source.sha256 ?? "No source digest"}
                </dd>
              </div>
            );
          })}
          <div>
            <dt>Submissions scope</dt>
            <dd>
              {evidence.targetScan
                ? `${evidence.targetScan.currentFilings} current filing records; ${evidence.targetScan.annualFilings} annual filings; older history ${evidence.targetScan.olderHistoryAvailable ? "exists outside this load" : "not indicated"}.`
                : "Unavailable"}
            </dd>
          </div>
        </dl>
      </details>
    </>
  );
}

export function AnnualStatementsContext({
  evidence,
  statements,
}: Pick<ManagedAnnualStatementsProps, "evidence" | "statements">) {
  return (
    <>
      <p>
        Exact reported US-GAAP concepts in full USD, with signs and decimals
        unchanged. The registry uses 2026 concepts and one separately named
        legacy net-sales basis. Missing concepts stay unavailable.
      </p>
      <p>
        These groups do not establish the facts' positions on the published
        statements. This view excludes custom-taxonomy and IFRS facts. It does
        not reconstruct totals, comprehensive debt, EBITDA or FCFF.
      </p>
      <SourceContext evidence={evidence} />
      {statements.contextReason && (
        <p role="status">
          Statement availability:{" "}
          {annualStatementUnavailableText(statements.contextReason)}
        </p>
      )}
      <p>
        Comparative dates come from the selected filing and need not be
        consecutive fiscal years. Each flow keeps its actual start and end
        dates. Earlier values are historical comparatives, not an
        as-originally-filed timeline.
      </p>
    </>
  );
}

/** Reading and cell choice only. The parent owns preview, stale-action guards and Save. */
export function ManagedAnnualStatements({
  evidence,
  statements,
  selectedCells,
  onToggleCell,
  disabled = false,
}: ManagedAnnualStatementsProps) {
  const id = useId();
  const [selectedStatement, setSelectedStatement] =
    useState<PersonalSecAnnualStatementId>("income_statement");
  const statement = statements.statements.find(
    (item) => item.id === selectedStatement,
  );
  return (
    <section
      className="managed-annual-statements"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Standardized annual statements</h3>
      <label
        className="managed-annual-statement-selector"
        htmlFor={`${id}-statement`}
      >
        <span>Statement</span>
        <select
          id={`${id}-statement`}
          value={selectedStatement}
          onChange={(event) => {
            if (
              annualStatementOrder.includes(
                event.currentTarget.value as PersonalSecAnnualStatementId,
              )
            )
              setSelectedStatement(
                event.currentTarget.value as PersonalSecAnnualStatementId,
              );
          }}
        >
          {annualStatementOrder.map((key) => (
            <option key={key} value={key}>
              {annualStatementLabels[key]}
            </option>
          ))}
        </select>
      </label>
      <AnnualStatementsContext evidence={evidence} statements={statements} />
      <p>
        Showing {annualStatementLabels[selectedStatement]}. Select specific
        available reported cells for the existing note preview. Selection does
        not add or save a note.
      </p>
      {statement ? (
        <AnnualStatementTable
          statement={statement}
          evidence={evidence}
          selectedCells={selectedCells}
          onToggleCell={onToggleCell}
          disabled={disabled}
        />
      ) : (
        <p>This statement view is unavailable for this load.</p>
      )}
    </section>
  );
}
