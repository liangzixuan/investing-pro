import { MANAGED_FINANCIAL_SCREEN_FIELDS } from "./managed-financial-screen-results";
import { identityLabels } from "./ManagedListingIdentity";
import {
  AnnualStatementTable,
  AnnualStatementsContext,
  annualStatementLabels,
  annualStatementOrder,
} from "./ManagedAnnualStatements";
import {
  isPreparedScreenComparisonReport,
  type PreparedScreenComparisonReport,
} from "./screen-comparison-report";

export function ScreenComparisonReportSnapshot({
  report,
}: {
  readonly report: PreparedScreenComparisonReport;
}) {
  if (!isPreparedScreenComparisonReport(report)) return null;
  return (
    <article aria-label="Captured screening comparison">
      <h2>Financial screen comparison</h2>
      <p>
        Prepared {report.preparedAt}. Private reading copy, not a saved screen
        or an importable draft. Preparation does not renew source times.
      </p>
      <p>
        These independently dated statements do not align fiscal periods,
        establish a peer group, rank companies or give an investment verdict.
        Missing concepts remain unavailable.
      </p>
      <dl>
        <dt>Catalog snapshot</dt>
        <dd>{report.catalogSnapshotSha256}</dd>
        <dt>Screen run status</dt>
        <dd>{report.run.status}</dd>
        <dt>Run started</dt>
        <dd>{report.run.startedAt}</dd>
        <dt>Run completed</dt>
        <dd>{report.run.completedAt ?? "Not completed"}</dd>
      </dl>
      <h3>Complete screen criteria</h3>
      <p>
        {report.criteria.sort.field === "symbol"
          ? "Ticker"
          : MANAGED_FINANCIAL_SCREEN_FIELDS.find(
              (field) => field.key === report.criteria.sort.field,
            )!.label}{" "}
        ·{" "}
        {report.criteria.sort.direction === "asc" ? "ascending" : "descending"}
      </p>
      {report.criteria.clauses.length ? (
        <ul>
          {report.criteria.clauses.map((clause, index) => {
            const field = MANAGED_FINANCIAL_SCREEN_FIELDS.find(
              (item) => item.key === clause.field,
            )!;
            return (
              <li key={index}>
                {field.label}{" "}
                {clause.operator === "gte" ? "at least" : "at most"}{" "}
                {clause.value} {field.unit}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No numeric filters.</p>
      )}
      {(["left", "right"] as const).map((side) => {
        const company = report[side];
        return (
          <section key={side} aria-label={`${side} company`}>
            <h3>
              {side === "left" ? "Left company" : "Right company"}:{" "}
              {company.listing.symbol} · {company.listing.issuerName}
            </h3>
            <h4>Complete listing identity</h4>
            <dl>
              {Object.entries(company.listing).map(([key, value]) => (
                <div key={key}>
                  <dt>{identityLabels[key as keyof typeof identityLabels]}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              <dt>SEC source CIK</dt>
              <dd>{company.response.evidence.cik}</dd>
            </dl>
            <p>
              Response origin: {company.responseOrigin ?? "Unknown"}.{" "}
              {company.showingPrevious
                ? "Retained previous response; original times unchanged."
                : "Loaded response."}{" "}
              {company.message}
            </p>
            {company.error && <p>Latest attempt reported an error.</p>}
            {company.failure && <p>{company.failure}</p>}
            <AnnualStatementsContext
              evidence={company.response.evidence}
              statements={company.view.statements}
              presentation="report"
            />
            {annualStatementOrder.map((group) => {
              const statement = company.view.statements.statements.find(
                (item) => item.id === group,
              );
              return (
                <section key={group}>
                  <h4>{annualStatementLabels[group]}</h4>
                  {statement ? (
                    <AnnualStatementTable
                      statement={statement}
                      evidence={company.response.evidence}
                    />
                  ) : (
                    <p>Statement unavailable.</p>
                  )}
                </section>
              );
            })}
          </section>
        );
      })}
      <details>
        <summary>Complete captured comparison and source packets</summary>
        <pre>{JSON.stringify(report, null, 2)}</pre>
      </details>
    </article>
  );
}
