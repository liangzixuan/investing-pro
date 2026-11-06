import type { FinancialScreenRefinementReading as Reading } from "./managed-financial-screen-refinement";
import {
  MANAGED_FINANCIAL_SCREEN_FIELDS,
  type ManagedFinancialScreenCriteria,
  type ManagedFinancialScreenRow,
} from "./managed-financial-screen-results";
import { ListingIdentity, identityLabels } from "./ManagedListingIdentity";
import { AnnualStatementsContext } from "./ManagedAnnualStatements";

const fieldLabel = (key: ManagedFinancialScreenCriteria["sort"]["field"]) =>
  key === "symbol"
    ? "Symbol"
    : MANAGED_FINANCIAL_SCREEN_FIELDS.find((field) => field.key === key)!.label;
export function ScreenFilterOutcomes({
  side,
  criteria,
  clauses,
  evaluation,
}: {
  side: "original" | "revised" | "previous" | "current";
  criteria: ManagedFinancialScreenCriteria;
  clauses: Reading["rows"][number]["originalClauses"];
  evaluation: ManagedFinancialScreenRow | null;
}) {
  return (
    <section aria-label={`${side} filter outcomes`} data-refinement-side={side}>
      <h5>
        {side[0]!.toUpperCase() + side.slice(1)} result:{" "}
        {evaluation?.match ?? "Unavailable"}
      </h5>
      <p>
        Sort: {fieldLabel(criteria.sort.field)},{" "}
        {criteria.sort.direction === "asc" ? "ascending" : "descending"}.
      </p>
      {criteria.clauses.length ? (
        <ol>
          {criteria.clauses.map((clause, index) => (
            <li key={index} data-refinement-clause={`${side}:${index}`}>
              {fieldLabel(clause.field)} (
              {
                MANAGED_FINANCIAL_SCREEN_FIELDS.find(
                  (field) => field.key === clause.field,
                )!.unit
              }
              ) {clause.operator === "gte" ? "At least" : "At most"}{" "}
              {clause.value}: {clauses[index] ?? "Unavailable"}
            </li>
          ))}
        </ol>
      ) : (
        <p>No numerical criteria.</p>
      )}
      <dl>
        {MANAGED_FINANCIAL_SCREEN_FIELDS.map((field) => {
          const metric = evaluation?.metrics[field.key];
          return (
            <div key={field.key} data-refinement-field={field.key}>
              <dt>
                {field.label} ({field.unit})
              </dt>
              <dd>
                {!metric ? (
                  "Unavailable"
                ) : metric.status === "unavailable" ? (
                  `Unknown: ${metric.reason}`
                ) : (
                  <>
                    {metric.value};{" "}
                    {"asOfDate" in metric
                      ? `As of ${metric.asOfDate}`
                      : `${metric.startDate} to ${metric.endDate}`}
                    ;{" "}
                    {metric.currentUseEligible
                      ? "Eligible for current filters"
                      : "Historical evidence; excluded from current filters"}
                  </>
                )}
                {metric && (
                  <span>
                    {" "}
                    Observation IDs:{" "}
                    {metric.observationIds.join(", ") || "None"}.
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
export function FinancialScreenRefinementReading({
  reading,
}: {
  reading: Reading;
}) {
  return (
    <div className="managed-screen-refinement-reading">
      <p>
        Original source run started {reading.sourceRun.startedAt}; completed{" "}
        {reading.sourceRun.completedAt ?? "Not completed"}; status{" "}
        {reading.sourceRun.status}. Local filter evaluation{" "}
        {reading.evaluatedAt}.
      </p>
      <p>
        {reading.unchanged
          ? "These filters are unchanged. Existing comparison and shortlist stay selected."
          : "Applying changed filters clears the current comparison and shortlist. Reports remain available for Research."}
      </p>
      {reading.rows.map((row) => {
        const response = row.original.report?.response;
        return (
          <article
            key={row.original.member.listing.listingId}
            data-refinement-listing-id={row.original.member.listing.listingId}
          >
            <h4>
              {row.original.member.listing.symbol} —{" "}
              {row.original.member.listing.issuerName}
            </h4>
            <ListingIdentity member={row.original.member.listing} />
            <dl aria-label="Exact listing identity">
              {Object.entries(identityLabels).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {
                      row.original.member.listing[
                        key as keyof typeof row.original.member.listing
                      ]
                    }
                  </dd>
                </div>
              ))}
            </dl>
            {row.original.failure && (
              <p>Read failed or incomplete: {row.original.failure}</p>
            )}
            {!response && (
              <p>
                No loaded Annual report. No source request is made by this
                preview.
              </p>
            )}
            <ScreenFilterOutcomes
              side="original"
              criteria={reading.originalCriteria}
              clauses={row.originalClauses}
              evaluation={row.original.evaluation}
            />
            <ScreenFilterOutcomes
              side="revised"
              criteria={reading.criteria}
              clauses={row.revisedClauses}
              evaluation={row.revised}
            />
            {response && (
              <details>
                <summary>
                  Inspect retained {row.original.member.listing.symbol} Annual
                  evidence
                </summary>
                <p>
                  CIK {response.security.cik}; cutoff{" "}
                  {response.evidence.generation.cutoffAt}; completed{" "}
                  {response.evidence.generation.completedAt}; generation{" "}
                  {response.evidence.generation.sha256}.
                </p>
                {row.original.report?.view && (
                  <AnnualStatementsContext
                    evidence={response.evidence}
                    statements={row.original.report.view.statements}
                    presentation="report"
                  />
                )}
              </details>
            )}
          </article>
        );
      })}
    </div>
  );
}
