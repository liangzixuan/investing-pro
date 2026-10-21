import {
  FILINGS_REVIEW_LIMIT,
  type ManagedFilingsReview,
  type ManagedFilingsReviewState,
} from "./managed-filings-review";
import type { ManagedFilingsReviewControls } from "./useManagedFilingsReviewControls";

export function ManagedFilingsReviewPicker({
  model,
  state,
  controls,
}: {
  model: ManagedFilingsReview;
  state: ManagedFilingsReviewState;
  controls: ManagedFilingsReviewControls;
}) {
  return (
    <>
      <fieldset disabled={!controls.enabled || state.catalogChanged}>
        <legend>Companies for this review</legend>
        {!state.memberships.length && (
          <p>
            Load a watchlist with current catalog identities to choose
            companies.
          </p>
        )}
        {state.memberships.map((member) => (
          <label
            className="managed-filings-review-choice"
            key={member.listing.listingId}
          >
            <input
              type="checkbox"
              checked={state.chosen.includes(member)}
              disabled={!model.canChoose(state, member)}
              onChange={() => controls.choose(member)}
            />
            <span>
              {member.listing.symbol} · {member.listing.issuerName} ·{" "}
              {member.listing.shareClassName} · {member.listing.exchangeMic}
            </span>
          </label>
        ))}
      </fieldset>
      <p>
        {state.chosen.length} of {FILINGS_REVIEW_LIMIT} selected. Source
        eligibility is shown before Load.
      </p>
      <button
        type="button"
        disabled={!controls.enabled || !model.canStart(state)}
        onClick={controls.start}
      >
        Start filing review
      </button>
    </>
  );
}
