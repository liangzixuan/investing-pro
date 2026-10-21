import type { ManagedCompanyFilingsState } from "./managed-company-filings";
import type { ManagedFilingsReviewRow } from "./managed-filings-review";
import type { ManagedFilingsReviewControls } from "./useManagedFilingsReviewControls";
import {
  FilingsPacketSource,
  FilingsPacketSummary,
} from "./ManagedFilingsPacket";
import { ManagedFilingsRefreshComparisonDetails } from "./ManagedFilingsRefreshComparisonDetails";

function latestAttempt(filings: ManagedCompanyFilingsState) {
  return filings.showingPrevious && filings.lastCheck !== filings.response
    ? filings.lastCheck
    : null;
}
function ReviewPacket({ filings }: { filings: ManagedCompanyFilingsState }) {
  const response = filings.response;
  if (!response) return null;
  const last = latestAttempt(filings);
  return (
    <>
      {filings.showingPrevious && (
        <p className="managed-watchlist-filings-warning">
          Showing the previous response completed {response.completedAt}. This
          attempt has not confirmed newer filings.
        </p>
      )}
      <FilingsPacketSummary response={response} />
      <FilingsPacketSource response={response} />
      {filings.refreshComparison?.current === response && (
        <ManagedFilingsRefreshComparisonDetails
          comparison={filings.refreshComparison}
        />
      )}
      {last && (
        <p>
          Latest source attempt checked {last.issuer.fetchedAt}; completed{" "}
          {last.completedAt}.
        </p>
      )}
    </>
  );
}
function loadLabel(filings: ManagedCompanyFilingsState) {
  if (filings.running) return "Loading filings…";
  return filings.response ? "Refresh review filings" : "Load review filings";
}
export function ManagedFilingsReviewSource({
  row,
  controls,
}: {
  row: ManagedFilingsReviewRow;
  controls: ManagedFilingsReviewControls;
}) {
  const { member, filings } = row;
  return (
    <section
      className="managed-watchlist-filings"
      aria-label={`Filing review for ${member.listing.symbol}`}
    >
      <h4 ref={controls.focus.company} tabIndex={-1}>
        {member.listing.symbol} · {member.listing.issuerName} ·{" "}
        {member.listing.shareClassName} · {member.listing.exchangeMic}
      </h4>
      <div className="trial-actions">
        <button
          type="button"
          ref={controls.focus.load}
          disabled={!controls.enabled || !controls.canLoad}
          onClick={controls.load}
        >
          {loadLabel(filings)}
        </button>
        <button
          type="button"
          className="trial-secondary"
          disabled={!controls.enabled || !filings.running}
          onClick={controls.cancel}
        >
          Cancel review check
        </button>
        <button
          type="button"
          className="trial-secondary"
          disabled={!controls.enabled || !controls.canInspect}
          onClick={controls.inspect}
        >
          Inspect filings and write note
        </button>
      </div>
      <p role={filings.error ? "alert" : "status"}>{filings.message}</p>
      <ReviewPacket filings={filings} />
    </section>
  );
}
