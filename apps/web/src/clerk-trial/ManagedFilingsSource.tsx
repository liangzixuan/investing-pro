import type { ManagedSecFilingsResponseDto } from "@research-cockpit/contracts";

export function ManagedFilingsSource({
  response,
}: {
  response: ManagedSecFilingsResponseDto;
}) {
  const issuer = response.issuer;
  const available = issuer.status === "available";
  return (
    <>
      <p className="managed-filings-period">
        <strong>
          {response.window.fromDate} to {response.window.throughDate}
        </strong>{" "}
        · 90 days · CIK {issuer.cik}
      </p>
      <p className="managed-filings-source">
        <a href={issuer.sourceUrl} target="_blank" rel="noreferrer">
          SEC Submissions source
        </a>{" "}
        · {available ? "Retrieved" : "Checked"} {issuer.fetchedAt}
      </p>
      <p className="managed-filings-scope">
        {available
          ? "Current recent-filings object only; complete 90-day coverage is not established."
          : "Source contents were not validated; complete 90-day coverage is not established."}
      </p>
      <details className="managed-filings-source-details">
        <summary>Filings source and coverage</summary>
        <dl>
          <div>
            <dt>Request started</dt>
            <dd>{response.requestStartedAt}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>{response.completedAt}</dd>
          </div>
        </dl>
        <p className="managed-filings-scope">
          {available
            ? "Only the SEC current recent-filings object was checked."
            : "This attempt requested the SEC current recent-filings object; its contents were not successfully validated."}{" "}
          Older continuation files were not loaded; this list does not establish
          complete coverage of the 90-day window.
        </p>
        {issuer.olderHistoryAvailable && (
          <p className="managed-filings-scope">
            The source lists older continuation files.
          </p>
        )}
      </details>
      {issuer.truncated && (
        <p className="managed-filings-warning">
          Showing {issuer.filings.length} of {issuer.matchingFilings} matching
          entries retained from the current source object. The response limit
          truncated this list.
        </p>
      )}
    </>
  );
}
