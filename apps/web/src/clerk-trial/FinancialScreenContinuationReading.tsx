import type {
  FinancialScreenContinuationPlan,
  FinancialScreenContinuationPass,
} from "./managed-financial-screen-continuation";
import type {
  ManagedFinancialScreenRun,
  ManagedFinancialScreenResultRow,
} from "./managed-financial-screen";
import { MANAGED_FINANCIAL_SCREEN_FIELDS } from "./managed-financial-screen-results";
import { ListingIdentity, identityLabels } from "./ManagedListingIdentity";
import { AnnualStatementsContext } from "./ManagedAnnualStatements";

function RowEvidence({
  row,
  label,
}: {
  row: ManagedFinancialScreenResultRow;
  label: string;
}) {
  const response = row.report?.response;
  return (
    <section aria-label={label}>
      <h5>{label}</h5>
      <p>
        Result: {row.evaluation?.match ?? "Not evaluated"}.{" "}
        {row.failure ? `Read outcome: ${row.failure}.` : ""}
      </p>
      {!response && <p>No Annual response retained.</p>}
      {response && (
        <>
          <p>
            CIK {response.security.cik}. Original cutoff{" "}
            {response.evidence.generation.cutoffAt}; completed{" "}
            {response.evidence.generation.completedAt}; generation{" "}
            {response.evidence.generation.sha256}.
          </p>
          <dl>
            {MANAGED_FINANCIAL_SCREEN_FIELDS.map((field) => {
              const metric = row.evaluation?.metrics[field.key];
              return (
                <div key={field.key} data-continuation-field={field.key}>
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
          <details>
            <summary>Inspect complete retained Annual evidence</summary>
            {row.report?.view && (
              <AnnualStatementsContext
                evidence={response.evidence}
                statements={row.report.view.statements}
                presentation="report"
              />
            )}
          </details>
        </>
      )}
    </section>
  );
}
function Pass({
  pass,
  index,
}: {
  pass: FinancialScreenContinuationPass;
  index: number;
}) {
  return (
    <section data-continuation-pass={index}>
      <h4>
        Continuation pass {index + 1}: {pass.status}
      </h4>
      <p>
        Plan prepared {pass.preparedAt}; pass started {pass.startedAt};
        completed {pass.completedAt ?? "Not completed"}.
      </p>
      <ol aria-label={`Pass ${index + 1} request order`}>
        {pass.requests.map((member) => {
          const attempt = pass.attempts.find((a) => a.member === member);
          return (
            <li
              key={member.listing.listingId}
              data-continuation-attempt={member.listing.listingId}
            >
              <p>
                {member.listing.symbol} · {member.listing.listingId}:{" "}
                {attempt?.status ?? "Not attempted"}.
              </p>
              {attempt && (
                <>
                  <p>
                    Attempt started {attempt.startedAt}; completed{" "}
                    {attempt.completedAt}; evaluated{" "}
                    {attempt.evaluatedAt ?? "Not evaluated"}.
                  </p>
                  {attempt.result && (
                    <RowEvidence
                      row={attempt.result}
                      label="Attempt evidence"
                    />
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
export function FinancialScreenContinuationReading({
  plan,
  result,
}: {
  plan: FinancialScreenContinuationPlan;
  result: ManagedFinancialScreenRun | null;
}) {
  const current = result?.handle === plan.sourceRun.handle ? result : null;
  return (
    <div className="managed-screen-continuation-reading">
      <p>
        Original source run started {plan.sourceRun.startedAt}; completed{" "}
        {plan.sourceRun.completedAt ?? "Not completed"}; status{" "}
        {plan.sourceRun.status}. Plan prepared {plan.preparedAt}.
      </p>
      {plan.sourceRun.refinedAt && (
        <p>
          Earlier local filter evaluation {plan.sourceRun.refinedAt}. This is
          not a source refresh time.
        </p>
      )}
      <h4>Applied filters for the reviewed reads</h4>
      <p>
        Sort:{" "}
        {plan.sourceRun.criteria.sort.field === "symbol"
          ? "Symbol"
          : MANAGED_FINANCIAL_SCREEN_FIELDS.find(
              (f) => f.key === plan.sourceRun.criteria.sort.field,
            )!.label}
        ,{" "}
        {plan.sourceRun.criteria.sort.direction === "asc"
          ? "ascending"
          : "descending"}
        .
      </p>
      <ul>
        {plan.sourceRun.criteria.clauses.map((clause, index) => (
          <li key={index}>
            {
              MANAGED_FINANCIAL_SCREEN_FIELDS.find(
                (f) => f.key === clause.field,
              )!.label
            }{" "}
            {clause.operator === "gte" ? "At least" : "At most"} {clause.value}
          </li>
        ))}
      </ul>
      {!plan.sourceRun.criteria.clauses.length && <p>No numerical criteria.</p>}
      <h4>Finite request list</h4>
      <p>
        {plan.requests.length} missing reads;{" "}
        {plan.rows.length - plan.requests.length} retained packets. Run clears
        the earlier comparison and shortlist. Personal drafts remain unchanged.
      </p>
      <ol aria-label="Reviewed missing Annual requests">
        {plan.requests.map((member) => (
          <li key={member.listing.listingId}>
            {member.listing.symbol} · {member.listing.listingId}
          </li>
        ))}
      </ol>
      {plan.rows.map((item) => {
        const latest = current?.rows.find(
          (row) => row.member === item.row.member,
        );
        return (
          <article
            key={item.row.member.listing.listingId}
            data-continuation-listing-id={item.row.member.listing.listingId}
            data-continuation-disposition={item.disposition}
          >
            <h4>
              {item.row.member.listing.symbol}:{" "}
              {item.disposition === "retained"
                ? "Retained packet"
                : "Missing Annual read"}
            </h4>
            <ListingIdentity member={item.row.member.listing} />
            <dl aria-label="Exact listing identity">
              {Object.entries(identityLabels).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {
                      item.row.member.listing[
                        key as keyof typeof item.row.member.listing
                      ]
                    }
                  </dd>
                </div>
              ))}
            </dl>
            <p>{item.reason}</p>
            <RowEvidence row={item.row} label="Evidence at preview" />
            {latest && latest.report !== item.row.report && (
              <RowEvidence row={latest} label="Evidence after this pass" />
            )}
          </article>
        );
      })}
      {(current?.continuations ?? plan.sourceRun.continuations ?? []).map(
        (pass, index) => (
          <Pass key={index} pass={pass} index={index} />
        ),
      )}
    </div>
  );
}
