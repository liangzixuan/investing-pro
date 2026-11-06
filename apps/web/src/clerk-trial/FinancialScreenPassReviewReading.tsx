import { useState } from "react";
import type { FinancialScreenPassReviewPlan } from "./managed-financial-screen-pass-review";
import type {
  ManagedFinancialScreenRun,
  ManagedFinancialScreenResultRow,
} from "./managed-financial-screen";
import { evaluateManagedFinancialScreenRow } from "./managed-financial-screen-results";
import { ScreenFilterOutcomes } from "./FinancialScreenRefinementReading";
import { ListingIdentity, identityLabels } from "./ManagedListingIdentity";
import { AnnualStatementsContext } from "./ManagedAnnualStatements";
function RawReading({ value, label }: { value: unknown; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{label}</summary>
      {open && <pre>{JSON.stringify(value, null, 2)}</pre>}
    </details>
  );
}
function Side({
  row,
  run,
  side,
}: {
  row: ManagedFinancialScreenResultRow;
  run: ManagedFinancialScreenRun;
  side: "previous" | "current";
}) {
  const response = row.report?.response;
  const clauses = run.criteria.clauses.map((clause) =>
    response
      ? (evaluateManagedFinancialScreenRow(response, {
          clauses: [clause],
          sort: run.criteria.sort,
        })?.match ?? null)
      : null,
  );
  return (
    <section data-pass-side={side}>
      <p>
        {side === "previous" ? "Previous" : "Current"} read:{" "}
        {row.report
          ? response
            ? row.failure
              ? "Partial evidence"
              : "Admitted evidence"
            : "Unavailable"
          : row.attempt?.status === "cancelled"
            ? "Cancelled after dispatch"
            : run.status === "running"
              ? "No settled response"
              : "Not attempted"}
        . {row.failure ?? ""}
      </p>
      {row.attempt && (
        <p>
          Request started {row.attempt.startedAt}; settled{" "}
          {row.attempt.completedAt}; {row.attempt.status}.
        </p>
      )}
      <p>
        Evaluation time: {row.evaluatedAt ?? "Not recorded"}. Financial periods
        and source dates below are independent.
      </p>
      <ScreenFilterOutcomes
        side={side}
        criteria={run.criteria}
        clauses={clauses}
        evaluation={row.evaluation}
      />
      {response && (
        <>
          <p>
            CIK {response.security.cik}; cutoff{" "}
            {response.evidence.generation.cutoffAt}; completed{" "}
            {response.evidence.generation.completedAt}; generation{" "}
            {response.evidence.generation.sha256}.
          </p>
          <details>
            <summary>
              Inspect {side} {row.member.listing.symbol} Annual evidence
            </summary>
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
      <RawReading
        label={`Complete ${side} ${row.member.listing.symbol} packet and result`}
        value={row}
      />
    </section>
  );
}
export function FinancialScreenPassReviewReading({
  plan,
  result,
  currentHandle,
}: {
  plan: FinancialScreenPassReviewPlan;
  result: ManagedFinancialScreenRun | null;
  currentHandle: symbol | null;
}) {
  const current =
    result?.handle === currentHandle &&
    result.criteriaRevision === plan.sourceRun.criteriaRevision &&
    result.selectionRevision === plan.sourceRun.selectionRevision &&
    result.rows.length === plan.requests.length &&
    result.rows.every((row, i) => row.member === plan.requests[i])
      ? result
      : null;
  return (
    <div className="managed-screen-pass-review-reading">
      <p>
        Previous pass started {plan.sourceRun.startedAt}; completed{" "}
        {plan.sourceRun.completedAt}; status {plan.sourceRun.status}. Fresh-pass
        plan prepared {plan.preparedAt}.
      </p>
      {plan.sourceRun.refinedAt && (
        <p>
          Earlier local filter evaluation {plan.sourceRun.refinedAt}; source
          dates are unchanged.
        </p>
      )}
      {current && (
        <p>
          Reviewed fresh pass started {current.startedAt}; completed{" "}
          {current.completedAt ?? "Not completed"}; status {current.status}.
        </p>
      )}
      <p>
        {plan.requests.length} companies in the reviewed request order. A
        repeated read may return unchanged evidence. Different financial periods
        are not a like-for-like change. Unavailable or unattempted reads do not
        establish a nonmatch.
      </p>
      {plan.sourceRun.rows.map((previous, i) => (
        <article
          key={previous.member.listing.listingId}
          data-pass-listing-id={previous.member.listing.listingId}
        >
          <h4>
            {previous.member.listing.symbol} ·{" "}
            {previous.member.listing.issuerName}
          </h4>
          <ListingIdentity member={previous.member.listing} />
          <dl aria-label="Exact listing identity">
            {Object.entries(identityLabels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  {
                    previous.member.listing[
                      key as keyof typeof previous.member.listing
                    ]
                  }
                </dd>
              </div>
            ))}
          </dl>
          <Side row={previous} run={plan.sourceRun} side="previous" />
          {current ? (
            <Side row={current.rows[i]!} run={current} side="current" />
          ) : (
            <p>Fresh pass not started for this preview.</p>
          )}
        </article>
      ))}
      <RawReading
        label="Complete previous pass, filters and continuation history"
        value={plan.sourceRun}
      />
    </div>
  );
}
