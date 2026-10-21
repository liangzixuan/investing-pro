import type {
  ManagedFilingsReviewRow,
  ManagedFilingsReviewState,
} from "./managed-filings-review";
import {
  selectedReviewRow,
  type ManagedFilingsReviewControls,
} from "./useManagedFilingsReviewControls";
import { ManagedFilingsReviewSource } from "./ManagedFilingsReviewSource";

function retainedStatus(row: ManagedFilingsReviewRow) {
  const response = row.filings.response!;
  if (response.issuer.status === "available")
    return `${response.issuer.filings.length} filings in retained response`;
  return `Source result: ${response.issuer.status.replaceAll("_", " ")}`;
}
function rowStatus(row: ManagedFilingsReviewRow) {
  if (row.filings.running) return "Check in progress";
  if (row.filings.response)
    return `${row.filings.showingPrevious ? "Previous response · " : ""}${retainedStatus(row)}`;
  return row.filings.supported ? "No response loaded" : "Source not supported";
}
export function ManagedFilingsReviewVisit({
  state,
  controls,
}: {
  state: ManagedFilingsReviewState;
  controls: ManagedFilingsReviewControls;
}) {
  const selected = selectedReviewRow(state);
  return (
    <>
      <p>
        {state.rows.filter((row) => row.filings.response !== null).length} of{" "}
        {state.rows.length} responses retained. Each response keeps its own
        dates and source limits.
      </p>
      <ol
        className="managed-filings-review-companies"
        aria-label="Companies in this filing review"
      >
        {state.rows.map((row) => (
          <li key={row.member.listing.listingId}>
            <button
              type="button"
              className="trial-secondary"
              disabled={!controls.enabled || state.catalogChanged}
              aria-current={row.member === state.selected ? "true" : undefined}
              onClick={() => controls.select(row.member)}
            >
              {row.member.listing.symbol} · {row.member.listing.shareClassName}{" "}
              · {row.member.listing.exchangeMic}
              <span>{rowStatus(row)}</span>
            </button>
          </li>
        ))}
      </ol>
      {selected && (
        <ManagedFilingsReviewSource row={selected} controls={controls} />
      )}
      <button
        type="button"
        className="trial-secondary"
        disabled={!controls.enabled}
        onClick={controls.finish}
      >
        Finish filing review
      </button>
    </>
  );
}
