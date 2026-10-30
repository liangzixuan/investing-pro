import type { PortfolioReportComparison as Comparison } from "./portfolio-report-comparison";
import { PortfolioIdentity } from "./ManagedPortfolioLedgerDetails";

type Side = NonNullable<Comparison["rows"][number]["current"]>;
const fieldLabels: Readonly<Record<string, string>> = {
  preparedAt: "Capture time",
  selectedDate: "Selected close date",
  dates: "Available close dates",
  ledger: "Authored ledger",
  portfolio: "Holdings and cash",
  review: "Dated holdings review",
  sourceRows: "Original sources",
  message: "Report qualification",
  identity: "Listing identity",
  shares: "Shares",
  confirmedOn: "Confirmation date",
  holding: "Authored holding",
  close: "Raw USD close",
  valueUsd: "Holding value (USD)",
  qualification: "Value qualification",
  composition: "Share of complete value",
  source: "Original source",
};
function changedFields(fields: readonly string[]) {
  return (
    fields
      .map((field) => fieldLabels[field] ?? "Other report details")
      .join(", ") || "None"
  );
}
function valueQualification(reason: Side["line"]["reason"]) {
  if (reason === null) return "Eligible at the selected close date";
  return reason === "balance_after_close"
    ? "Authored balances are later than this close date."
    : "No eligible close was loaded for this exact date.";
}

function ReportSide({ side, label }: { side: Side | null; label: string }) {
  if (!side) return <p>{label}: absent from this report.</p>;
  return (
    <section aria-label={label}>
      <h5>{label}</h5>
      <PortfolioIdentity listing={side.holding.identity} />
      <dl>
        <dt>Shares</dt>
        <dd>{side.line.shares}</dd>
        <dt>Confirmed on</dt>
        <dd>{side.line.confirmedOn}</dd>
        <dt>Raw USD close</dt>
        <dd>{side.line.close ?? "Unavailable"}</dd>
        <dt>Holding value (USD)</dt>
        <dd>{side.line.valueUsd ?? "Unavailable"}</dd>
        <dt>Share of complete value</dt>
        <dd>
          {side.composition.percent === null
            ? "Unavailable"
            : `${side.composition.percent}%`}
        </dd>
        <dt>Qualification</dt>
        <dd>{valueQualification(side.line.reason)}</dd>
      </dl>
      {side.sourceRow.response && (
        <dl>
          <dt>Provider / basis / currency</dt>
          <dd>
            {side.sourceRow.response.provider} /{" "}
            {side.sourceRow.response.priceBasis} /{" "}
            {side.sourceRow.response.currency}
          </dd>
          <dt>Requested range</dt>
          <dd>{side.sourceRow.response.range}</dd>
          <dt>Requested window</dt>
          <dd>
            {side.sourceRow.response.window.startDate} through{" "}
            {side.sourceRow.response.window.endDate}
          </dd>
          <dt>Request started</dt>
          <dd>{side.sourceRow.response.requestStartedAt}</dd>
          <dt>Completed</dt>
          <dd>{side.sourceRow.response.completedAt}</dd>
          <dt>Catalog reference</dt>
          <dd>{side.sourceRow.response.catalogSnapshotSha256}</dd>
        </dl>
      )}
      <p>{side.sourceRow.message}</p>
      {side.sourceRow.showingPrevious && (
        <p>
          Previous history retained. Its original source clocks remain
          unchanged.
        </p>
      )}
      <details>
        <summary>Complete composition and original source</summary>
        <pre>
          {JSON.stringify(
            { composition: side.composition, source: side.sourceRow },
            null,
            2,
          )}
        </pre>
      </details>
    </section>
  );
}
const statuses = {
  "saved-only": "Saved only",
  "current-only": "Current only",
  both: "Exact identity in both reports",
  "identity-conflict": "Identity conflict",
};
export function PortfolioReportComparisonRows({
  comparison,
  onResearch,
}: {
  comparison: Comparison;
  onResearch?:
    ((listingId: string, opener: HTMLButtonElement) => void) | undefined;
}) {
  return (
    <>
      <dl>
        <dt>Saved capture / selected close</dt>
        <dd>
          {comparison.saved.preparedAt} / {comparison.saved.selectedDate}
        </dd>
        <dt>Current capture / selected close</dt>
        <dd>
          {comparison.current.preparedAt} / {comparison.current.selectedDate}
        </dd>
        <dt>Saved cash / complete value (USD)</dt>
        <dd>
          {comparison.saved.review.cashUsd ?? "Unknown"} /{" "}
          {comparison.saved.review.totalValueUsd ?? "Unavailable"}
        </dd>
        <dt>Current cash / complete value (USD)</dt>
        <dd>
          {comparison.current.review.cashUsd ?? "Unknown"} /{" "}
          {comparison.current.review.totalValueUsd ?? "Unavailable"}
        </dd>
        <dt>Saved cash share</dt>
        <dd>
          {comparison.saved.review.composition.cashPercent === null
            ? "Unavailable"
            : `${comparison.saved.review.composition.cashPercent}%`}
        </dd>
        <dt>Current cash share</dt>
        <dd>
          {comparison.current.review.composition.cashPercent === null
            ? "Unavailable"
            : `${comparison.current.review.composition.cashPercent}%`}
        </dd>
        <dt>Changed report fields</dt>
        <dd>{changedFields(comparison.changedFields)}</dd>
      </dl>
      {comparison.rows.map((row) => (
        <section
          data-portfolio-comparison-row={row.listingId}
          data-comparison-status={row.status}
          className="fact"
          key={row.listingId}
          aria-label={`Compared holding ${row.listingId}`}
        >
          <h5>{statuses[row.status]}</h5>
          <p>{row.listingId}</p>
          <p>Changed fields: {changedFields(row.changedFields)}</p>
          {row.conflictsWith.length > 0 && (
            <p>Conflicting identities: {row.conflictsWith.join(", ")}</p>
          )}
          <ReportSide label="Saved holding" side={row.saved} />
          <ReportSide label="Current holding" side={row.current} />
          {onResearch && row.current && row.status !== "identity-conflict" && (
            <div className="managed-portfolio-actions">
              <button
                id={`portfolio-report-research-${row.listingId}`}
                type="button"
                onClick={(event) =>
                  onResearch(row.listingId, event.currentTarget)
                }
              >
                Research current holding
              </button>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
