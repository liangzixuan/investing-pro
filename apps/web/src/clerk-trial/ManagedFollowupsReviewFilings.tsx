import {
  FilingsPacketSource,
  FilingsPacketSummary,
} from "./ManagedFilingsPacket";
import { ListingIdentity } from "./ManagedListingIdentity";
import { ManagedFilingsRefreshComparisonDetails } from "./ManagedFilingsRefreshComparisonDetails";
import {
  useManagedFollowupsReviewFilings,
  type ReviewFilingsProps,
} from "./useManagedFollowupsReviewFilings";
import "./managed-company-filings.css";

export function ManagedFollowupsReviewFilings(props: ReviewFilingsProps) {
  const controls = useManagedFollowupsReviewFilings(props);
  const { state } = controls;
  const row = state.selected;
  if (!row) return null;
  const { filings, entry } = row;
  const response = filings.response;
  const last =
    filings.showingPrevious && filings.lastCheck !== response
      ? filings.lastCheck
      : null;
  return (
    <section
      id="managed-followups-review-filings"
      className="managed-watchlist-filings"
      aria-labelledby="managed-followups-review-filings-heading"
      aria-busy={filings.running}
    >
      <h4
        id="managed-followups-review-filings-heading"
        ref={controls.heading}
        tabIndex={-1}
      >
        Filings for this check
      </h4>
      <p>
        <ListingIdentity member={entry.listing} />
      </p>
      <p>
        Load recent filing metadata explicitly for this check. Each check keeps
        its own response and original source times. Filing metadata does not
        establish relevance to your question or that filing contents were read.
      </p>
      <div className="trial-actions">
        <button
          id="managed-followups-review-filings-load"
          type="button"
          disabled={!controls.canLoad}
          onClick={(event) => controls.load(event.currentTarget)}
        >
          {filings.running
            ? "Loading review filings…"
            : response
              ? "Refresh review filings"
              : "Load review filings"}
        </button>
        <button
          id="managed-followups-review-filings-cancel"
          type="button"
          className="trial-secondary"
          disabled={!controls.canCancel}
          onClick={(event) => controls.cancel(event.currentTarget)}
        >
          Cancel review filings
        </button>
        <button
          id="managed-followups-review-filings-inspect"
          type="button"
          className="trial-secondary"
          disabled={!controls.canInspect}
          onClick={(event) => controls.inspect(event.currentTarget)}
        >
          Inspect filings and assess this check
        </button>
      </div>
      <p role={filings.error ? "alert" : "status"}>{filings.message}</p>
      <p>
        {state.rows.filter((item) => item.filings.response !== null).length} of{" "}
        {state.rows.length} chosen checks have a retained response.
      </p>
      {response && (
        <>
          {filings.showingPrevious && (
            <p className="managed-watchlist-filings-warning">
              Showing the previous response completed {response.completedAt}.
              This attempt has not confirmed newer filings. Its original dates
              and source metadata remain unchanged.
            </p>
          )}
          <FilingsPacketSummary response={response} />
          <FilingsPacketSource response={response} />
          {filings.refreshComparison?.current === response && (
            <ManagedFilingsRefreshComparisonDetails
              comparison={filings.refreshComparison}
            />
          )}
          <ol
            className="managed-followups-review-filings-list"
            aria-label="All filings retained for this check"
          >
            {response.issuer.filings.map((filing) => (
              <li key={filing.accessionNumber}>
                <a href={filing.sourceUrl} target="_blank" rel="noreferrer">
                  Form {filing.form}
                  <span className="managed-filings-accession">
                    {filing.accessionNumber}
                  </span>
                </a>
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
          <details>
            <summary>Complete retained filing packet</summary>
            <pre className="managed-followups-authored">
              {JSON.stringify(response, null, 2)}
            </pre>
          </details>
        </>
      )}
      {last && (
        <p>
          Latest source attempt checked {last.issuer.fetchedAt}; completed{" "}
          {last.completedAt}.
        </p>
      )}
      <p>
        Inspect uses this retained response without another filing request.
        Assessment, Complete and Save follow-ups remain separate actions.
      </p>
    </section>
  );
}
