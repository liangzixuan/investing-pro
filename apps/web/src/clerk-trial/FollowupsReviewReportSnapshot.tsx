import {
  isPreparedFollowupsReviewReport,
  type PreparedFollowupsReviewReport,
} from "./followups-review-report";

export function FollowupsReviewReportSnapshot({
  report,
}: {
  readonly report: PreparedFollowupsReviewReport;
}) {
  if (!isPreparedFollowupsReviewReport(report)) return null;
  return (
    <article aria-label="Captured Follow-ups review report">
      <h2>Follow-ups review report</h2>
      <p>
        This private reading copy contains the complete captured draft in
        resource order, including open and completed checks. Assessments are
        authored observations. Due dates are planning dates; completion dates
        record authored actions. Capture time does not establish source
        freshness.
      </p>
      <p>
        This snapshot is not a cloud backup or immutable history. Save
        follow-ups remains a separate online action.
      </p>
      <dl>
        <dt>Authored capture time (UTC)</dt>
        <dd>{report.capturedAt}</dd>
        <dt>Online base version</dt>
        <dd>{report.baseVersion}</dd>
        <dt>Unsaved draft changes at capture</dt>
        <dd>{report.dirty ? "Yes" : "No"}</dd>
        <dt>Current catalog reference at capture</dt>
        <dd>{report.currentCatalogSnapshotSha256 ?? "Unavailable"}</dd>
        <dt>Captured checks</dt>
        <dd>{report.draft.entries.length}</dd>
      </dl>
      <h3>Complete Follow-ups draft</h3>
      {report.draft.entries.length === 0 && <p>No captured follow-ups.</p>}
      {report.draft.entries.map((entry, index) => (
        <section className="fact" key={entry.id}>
          <h3>
            {index + 1}. {entry.listing.issuerName} · {entry.listing.symbol}
          </h3>
          <dl>
            <dt>Check identifier</dt>
            <dd>{entry.id}</dd>
            <dt>Entry catalog reference</dt>
            <dd>{entry.catalogSnapshotSha256}</dd>
            <dt>Country</dt>
            <dd>{entry.listing.country}</dd>
            <dt>Exchange MIC</dt>
            <dd>{entry.listing.exchangeMic}</dd>
            <dt>Instrument type</dt>
            <dd>{entry.listing.instrumentType}</dd>
            <dt>Issuer identifier</dt>
            <dd>{entry.listing.issuerId}</dd>
            <dt>Issuer name</dt>
            <dd>{entry.listing.issuerName}</dd>
            <dt>Listing identifier</dt>
            <dd>{entry.listing.listingId}</dd>
            <dt>Security identifier</dt>
            <dd>{entry.listing.securityId}</dd>
            <dt>Security name</dt>
            <dd>{entry.listing.securityName}</dd>
            <dt>Share class identifier</dt>
            <dd>{entry.listing.shareClassId}</dd>
            <dt>Share class name</dt>
            <dd>{entry.listing.shareClassName}</dd>
            <dt>Symbol</dt>
            <dd>{entry.listing.symbol}</dd>
            <dt>Status</dt>
            <dd>{entry.status}</dd>
            <dt>Due date (UTC planning date)</dt>
            <dd>{entry.dueOn}</dd>
            <dt>Completed on (authored action date)</dt>
            <dd>{entry.completedOn ?? "Not completed"}</dd>
          </dl>
          <h4>Full question</h4>
          <p className="note">{entry.check}</p>
          <h4>Authored assessment</h4>
          <p className="note">{entry.result || "No authored assessment."}</p>
        </section>
      ))}
      <details>
        <summary>Complete captured report JSON</summary>
        <p>
          All captured metadata, listing identities, catalog references,
          questions, assessments and original dates follow in resource order.
        </p>
        <pre>{JSON.stringify(report, null, 2)}</pre>
      </details>
    </article>
  );
}
