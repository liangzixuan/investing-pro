import type { ManagedSecFilingsResponseDto } from "@research-cockpit/contracts";

export function FilingsPacketSummary({
  response,
}: {
  response: ManagedSecFilingsResponseDto;
}) {
  if (response.issuer.status !== "available") return null;
  const newest = response.issuer.filings[0];
  return (
    <div className="managed-watchlist-filings-summary">
      {newest ? (
        <>
          <p>Newest observed filing</p>
          <a href={newest.sourceUrl} target="_blank" rel="noreferrer">
            Form {newest.form} · Filed <time>{newest.filingDate}</time>
            <span>{newest.accessionNumber}</span>
          </a>
        </>
      ) : (
        <p>No matching filings were observed in the checked source object.</p>
      )}
      <p>
        {response.issuer.filings.length} loaded filings ·{" "}
        {response.window.fromDate} to {response.window.throughDate}
      </p>
      {response.issuer.truncated && (
        <p className="managed-watchlist-filings-warning">
          Showing {response.issuer.filings.length} of{" "}
          {response.issuer.matchingFilings} matching entries; the response limit
          truncated this list.
        </p>
      )}
    </div>
  );
}

export function FilingsPacketSource({
  response,
}: {
  response: ManagedSecFilingsResponseDto;
}) {
  const issuer = response.issuer;
  const available = issuer.status === "available";
  return (
    <details className="managed-watchlist-filings-source">
      <summary>Filings source and coverage</summary>
      <dl className="managed-metadata">
        <dt>CIK</dt>
        <dd>{issuer.cik}</dd>
        <dt>Inclusive request window</dt>
        <dd>
          {response.window.fromDate} to {response.window.throughDate} · 90 UTC
          dates
        </dd>
        <dt>Request started</dt>
        <dd>
          <time>{response.requestStartedAt}</time>
        </dd>
        <dt>Request completed</dt>
        <dd>
          <time>{response.completedAt}</time>
        </dd>
        <dt>Source {available ? "retrieved" : "checked"}</dt>
        <dd>
          <time>{issuer.fetchedAt}</time>
        </dd>
      </dl>
      <a href={issuer.sourceUrl} target="_blank" rel="noreferrer">
        SEC Submissions source
      </a>
      <p>
        {available
          ? "Only the SEC current recent-filings object was checked."
          : "This attempt requested the SEC current recent-filings object; its contents were not successfully validated."}{" "}
        Older continuation files and filing bodies were not loaded. This packet
        does not establish complete coverage of the requested window.
      </p>
      {issuer.olderHistoryAvailable && (
        <p>The source lists older continuation files.</p>
      )}
    </details>
  );
}
