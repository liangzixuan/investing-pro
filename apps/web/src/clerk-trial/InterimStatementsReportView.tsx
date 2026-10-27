import {
  PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY as registry,
  type PersonalSecInterimCanonicalEvidenceDto as Evidence,
  type PersonalSecInterimStatementsDto,
  type PersonalSecInterimStatementDto as Statement,
  type PersonalSecInterimStatementRowDto as Row,
  type PersonalSecInterimStatementCellDto as Cell,
  type PersonalSecInterimStatementConcept as Concept,
  type PersonalSecInterimSourceDto,
} from "@research-cockpit/contracts";
import {
  interimPeriodText,
  type ManagedInterimCellSelection as Selection,
} from "./managed-interim-statements-note";
export const interimStatementOrder = [
  "income_statement",
  "balance_sheet",
  "cash_flow",
] as const;
export const interimStatementLabels = {
  income_statement: "Income",
  balance_sheet: "Balance",
  cash_flow: "Cash",
} as const;
export const interimStatementIds = {
  income_statement: "income",
  balance_sheet: "balance",
  cash_flow: "cash",
} as const;
function InterimTarget({ target }: { readonly target: Evidence["target"] }) {
  if (target.status !== "target")
    return (
      <p>Interim target unavailable: {target.reason.replaceAll("_", " ")}.</p>
    );
  return (
    <dl>
      <dt>Report date</dt>
      <dd>{target.reportDate}</dd>
      <dt>Filed date</dt>
      <dd>{target.filedDate}</dd>
      <dt>Accepted time (UTC)</dt>
      <dd>{target.acceptedAt ?? "Unavailable"}</dd>
      <dt>Accession</dt>
      <dd>{target.accessionNumber}</dd>
    </dl>
  );
}
function InterimSourceCapture({
  name,
  source,
}: {
  readonly name: string;
  readonly source: PersonalSecInterimSourceDto;
}) {
  return (
    <details>
      <summary>
        {name}: {source.status.replaceAll("_", " ")}; retrieved{" "}
        {source.fetchedAt ?? "not captured"}
      </summary>
      <p>{source.sourceUrl}</p>
      <p>
        Source SHA: {source.sha256 ?? "Unavailable"}; bytes:{" "}
        {source.bytes ?? "Unavailable"}.
      </p>
    </details>
  );
}
export function InterimSourceContext({
  evidence,
}: {
  readonly evidence: Evidence;
}) {
  const { generation, target, targetScan } = evidence;
  return (
    <section aria-label="Original interim filing and source clocks">
      <p>
        Latest observed 10-Q in this loaded submissions window. Standard
        CompanyFacts concept views do not establish matched primary-document
        statements.
      </p>
      <InterimTarget target={target} />
      <dl>
        <dt>Original load cutoff (UTC)</dt>
        <dd>{generation.cutoffAt}</dd>
        <dt>Completed (UTC)</dt>
        <dd>{generation.completedAt}</dd>
        <dt>Canonical generation</dt>
        <dd>{generation.sha256}</dd>
      </dl>
      {targetScan && (
        <p>
          Loaded submissions: {targetScan.currentFilings} filings;{" "}
          {targetScan.interimFilings} interim candidates. Older history
          available: {targetScan.olderHistoryAvailable ? "yes" : "no"}. No older
          history file was requested.
        </p>
      )}
      {Object.entries(generation.sources).map(([name, source]) => (
        <InterimSourceCapture key={name} name={name} source={source} />
      ))}
    </section>
  );
}
interface Choices {
  readonly selected: readonly Selection[];
  readonly onToggle:
    ((concept: Concept, periodKey: string) => void) | undefined;
  readonly disabled: boolean;
}
function InterimScan({
  scan,
}: {
  readonly scan: Evidence["facts"]["scans"][number]["scan"];
}) {
  return (
    <>
      <p>
        Scan: {scan.status.replaceAll("_", " ")}; absence:{" "}
        {scan.absence ?? "none"}.
      </p>
      {scan.coverage && (
        <p>
          Candidate rows {scan.coverage.full.candidateRows}; inspected{" "}
          {scan.coverage.full.inspectedRows}; invalid{" "}
          {scan.coverage.full.invalidRows}; duplicates{" "}
          {scan.coverage.full.duplicateRows}; unique observations{" "}
          {scan.coverage.full.uniqueObservations}; selected accession{" "}
          {scan.coverage.selected}; other accessions{" "}
          {scan.coverage.otherAccessions}; returned {scan.coverage.returned};
          omitted selected {scan.coverage.omittedSelected}.
        </p>
      )}
    </>
  );
}
function PeriodReadout({ period }: { readonly period: Cell["period"] }) {
  const kind = {
    comparative: "Comparative/historical period in the selected accession.",
    selected_report: "Ends on the selected filing's report date.",
    unresolved: "Reported date is not admitted against the selected filing.",
  };
  return (
    <>
      {interimPeriodText(period)}
      <p>{kind[period.kind]}</p>
      {period.periodType === "duration" && (
        <p>Quarter/YTD classification not established.</p>
      )}
    </>
  );
}
function ObservationReadout({
  observation,
}: {
  readonly observation: Evidence["facts"]["observations"][number];
}) {
  return (
    <details>
      <summary>{observation.id}</summary>
      <p>
        Observed FY: {observation.filingFocusYear ?? "unknown"}; FP:{" "}
        {observation.filingFocusPeriod ?? "unknown"}; frame:{" "}
        {observation.frame ?? "unknown"}. These fields do not establish quarter
        or YTD classification.
      </p>
      <p>
        Accession {observation.accessionNumber}; form {observation.form}; filed{" "}
        {observation.filedDate}; source locator {observation.sourceLocator}.
      </p>
    </details>
  );
}
function InterimCell({
  evidence,
  concept,
  cell,
  choices,
}: {
  readonly evidence: Evidence;
  readonly concept: Concept;
  readonly cell: Cell;
  readonly choices: Choices;
}) {
  const selected = choices.selected.some(
    (key) => key.concept === concept && key.periodKey === cell.period.key,
  );
  return (
    <tr data-interim-cell-key={JSON.stringify([concept, cell.period.key])}>
      {choices.onToggle && (
        <td>
          <input
            type="checkbox"
            aria-label={`Choose ${concept}; ${interimPeriodText(cell.period)}`}
            checked={selected}
            disabled={choices.disabled || cell.status !== "available"}
            onChange={() => choices.onToggle?.(concept, cell.period.key)}
          />
        </td>
      )}
      <td>
        <PeriodReadout period={cell.period} />
      </td>
      <td data-interim-value>
        {cell.status === "available"
          ? `USD ${cell.value}`
          : `Unavailable: ${cell.reason.replaceAll("_", " ")}`}
      </td>
      <td>
        {cell.observationIds.map((id) => (
          <ObservationReadout
            key={id}
            observation={evidence.facts.observations.find(
              (row) => row.id === id,
            )!}
          />
        ))}
      </td>
    </tr>
  );
}
function InterimConceptRow({
  evidence,
  row,
  choices,
}: {
  readonly evidence: Evidence;
  readonly row: Row;
  readonly choices: Choices;
}) {
  const entry = registry.find((entry) => entry.concept === row.concept)!,
    scan = evidence.facts.scans.find(
      (item) => item.concept === row.concept,
    )!.scan;
  return (
    <details open={row.cells.length > 0} data-interim-concept={row.concept}>
      <summary>
        {entry.label} · {row.concept}
        {row.cells.length === 0
          ? ` · Unavailable: ${(row.reason ?? "concept_missing").replaceAll("_", " ")}`
          : ""}
      </summary>
      <p>{entry.qualification}</p>
      <InterimScan scan={scan} />
      {row.cells.length > 0 && (
        <div className="managed-valuation-table">
          <table aria-label={`${entry.label} exact reported periods`}>
            <thead>
              <tr>
                {choices.onToggle && <th scope="col">Note selection</th>}
                <th scope="col">Exact reported period</th>
                <th scope="col">Reported USD</th>
                <th scope="col">Observation references and filing metadata</th>
              </tr>
            </thead>
            <tbody>
              {row.cells.map((cell) => (
                <InterimCell
                  key={cell.period.key}
                  evidence={evidence}
                  concept={row.concept}
                  cell={cell}
                  choices={choices}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
export function InterimStatementRows({
  evidence,
  statement,
  selected = [],
  onToggle,
  disabled = false,
}: {
  readonly evidence: Evidence;
  readonly statement: Statement;
  readonly selected?: readonly Selection[];
  readonly onToggle?: (concept: Concept, periodKey: string) => void;
  readonly disabled?: boolean;
}) {
  const choices = { selected, onToggle, disabled };
  return (
    <section
      className="managed-interim-statements"
      aria-label={`${interimStatementLabels[statement.id]} reported concepts`}
    >
      <h4>{interimStatementLabels[statement.id]}</h4>
      <p>
        Reported USD only. Exact start/end dates remain separate, including
        periods with the same end. Quarter/YTD classification is not established
        for durations; no subtraction, Q4 derivation, annualization or TTM
        calculation.
      </p>
      {statement.rows.map((row) => (
        <InterimConceptRow
          key={row.concept}
          evidence={evidence}
          row={row}
          choices={choices}
        />
      ))}
    </section>
  );
}
export function InterimStatementsReportView({
  evidence,
  statements,
}: {
  readonly evidence: Evidence;
  readonly statements: PersonalSecInterimStatementsDto;
}) {
  return (
    <section aria-label="Captured interim reported-period views">
      <h3>Interim reported periods</h3>
      <InterimSourceContext evidence={evidence} />
      {statements.contextReason && (
        <p>
          Context unavailable: {statements.contextReason.replaceAll("_", " ")}.
        </p>
      )}
      {statements.statements.map((statement) => (
        <InterimStatementRows
          key={statement.id}
          evidence={evidence}
          statement={statement}
        />
      ))}
    </section>
  );
}
