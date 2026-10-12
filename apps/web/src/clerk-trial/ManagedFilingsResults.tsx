import { useState } from "react";
import type { ManagedSecFilingsResponseDto } from "@research-cockpit/contracts";

const PAGE_SIZE = 25;

export function ManagedFilingsResults({
  response,
}: {
  response: ManagedSecFilingsResponseDto;
}) {
  const [paging, setPaging] = useState({ response, page: 0 });

  if (paging.response !== response) setPaging({ response, page: 0 });

  const page = paging.response === response ? paging.page : 0;

  const issuer = response.issuer;

  const pages = Math.max(1, Math.ceil(issuer.filings.length / PAGE_SIZE));

  const available = issuer.status === "available";

  return (
    <div
      className="managed-filings-results"
      role="region"
      aria-label="SEC filings results"
      tabIndex={0}
    >
      <FilingsSource response={response} />
      {available && (
        <>
          <p className="managed-filings-count" role="status">
            {issuer.filings.length === 0
              ? "No matching filings were observed in the checked source object."
              : `${issuer.filings.length} filings · Page ${page + 1} of ${pages}`}
          </p>

          <ol className="managed-filings-list" start={page * PAGE_SIZE + 1}>
            {issuer.filings
              .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
              .map((filing) => (
                <li key={filing.accessionNumber}>
                  <div>
                    <a href={filing.sourceUrl} target="_blank" rel="noreferrer">
                      Form {filing.form}
                      <span className="managed-filings-accession">
                        {filing.accessionNumber}
                      </span>
                    </a>
                  </div>

                  <dl>
                    <div>
                      <dt>Filed</dt>
                      <dd>{filing.filingDate}</dd>
                    </div>
                    <div>
                      <dt>Report date</dt>
                      <dd>{filing.reportDate ?? "Not reported"}</dd>
                    </div>
                  </dl>
                </li>
              ))}
          </ol>
        </>
      )}

      <nav className="managed-filings-pagination" aria-label="Filings pages">
        <button
          className="trial-secondary"
          aria-disabled={!available || page === 0}
          onClick={() => {
            if (available && page > 0) setPaging({ response, page: page - 1 });
          }}
        >
          Previous filings page
        </button>

        <button
          className="trial-secondary"
          aria-disabled={!available || page + 1 >= pages}
          onClick={() => {
            if (available && page + 1 < pages)
              setPaging({ response, page: page + 1 });
          }}
        >
          Next filings page
        </button>
      </nav>
    </div>
  );
}

function FilingsSource({
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
        <br />
        Request started {response.requestStartedAt} · Completed{" "}
        {response.completedAt}
      </p>

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
