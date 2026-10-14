import type { ManagedSecFilingsResponseDto } from "@research-cockpit/contracts";
import type { ManagedFilingsRefreshComparison } from "./managed-filings-refresh-comparison";

export function ManagedFilingsRefreshComparisonDetails({
  comparison,
}: {
  comparison: ManagedFilingsRefreshComparison;
}) {
  return (
    <div className="managed-filings-refresh-comparison">
      <p className="managed-filings-refresh-count" role="status">
        Newly observed in this refresh: {comparison.newAccessions.length} of{" "}
        {comparison.current.issuer.filings.length} filings in the displayed
        response.
      </p>
      <p className="managed-filings-scope">
        These accessions were absent from the previous loaded list. This does
        not establish when they were published or that either list is complete.
      </p>
      <details>
        <summary>Compared loaded lists</summary>
        <div className="managed-filings-compared-lists">
          <ComparedList
            label="Previous loaded list"
            response={comparison.previous}
          />
          <ComparedList
            label="Current loaded list"
            response={comparison.current}
          />
        </div>
        <p className="managed-filings-scope">
          Only the SEC current recent-filings objects were checked. Older
          continuation files were not loaded. Different windows and response
          limits can affect which accessions appear in each list.
        </p>
      </details>
    </div>
  );
}

function ComparedList({
  label,
  response,
}: {
  label: string;
  response: ManagedSecFilingsResponseDto;
}) {
  const issuer = response.issuer;
  return (
    <section aria-label={label}>
      <h4>{label}</h4>
      <dl>
        <div>
          <dt>Loaded window</dt>
          <dd>
            {response.window.fromDate} to {response.window.throughDate}
          </dd>
        </div>
        <div>
          <dt>Request started</dt>
          <dd>{response.requestStartedAt}</dd>
        </div>
        <div>
          <dt>Retrieved</dt>
          <dd>{issuer.fetchedAt}</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>{response.completedAt}</dd>
        </div>
        <div>
          <dt>Retained rows</dt>
          <dd>
            {issuer.filings.length} of {issuer.matchingFilings} matching entries
          </dd>
        </div>
        <div>
          <dt>Response limit</dt>
          <dd>
            {issuer.truncated
              ? "This list was truncated."
              : "This list was not truncated."}
          </dd>
        </div>
        <div>
          <dt>Older continuation files</dt>
          <dd>
            {issuer.olderHistoryAvailable
              ? "Listed by the source; not loaded."
              : "None listed by the source."}
          </dd>
        </div>
      </dl>
      <a href={issuer.sourceUrl} target="_blank" rel="noreferrer">
        SEC Submissions source
      </a>
    </section>
  );
}
