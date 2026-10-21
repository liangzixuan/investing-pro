import { useId, useSyncExternalStore } from "react";
import {
  FILINGS_REVIEW_LIMIT,
  type ManagedFilingsReview as ReviewModel,
  type ManagedFilingsReviewCapture,
} from "./managed-filings-review";
import {
  selectedReviewRow,
  useManagedFilingsReviewControls,
} from "./useManagedFilingsReviewControls";
import { ManagedFilingsReviewPicker } from "./ManagedFilingsReviewPicker";
import { ManagedFilingsReviewVisit } from "./ManagedFilingsReviewVisit";

export function ManagedFilingsReview({
  model,
  active,
  onView,
}: {
  model: ReviewModel;
  active: boolean;
  onView: (
    capture: ManagedFilingsReviewCapture,
    opener: HTMLButtonElement,
  ) => void;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const heading = useId();
  const controls = useManagedFilingsReviewControls(
    model,
    state,
    active,
    onView,
  );
  const selected = selectedReviewRow(state);
  return (
    <details className="managed-filings-review">
      <summary>Review a group of watchlist companies</summary>
      <section
        aria-labelledby={heading}
        aria-busy={selected?.filings.running ?? false}
      >
        <h3 id={heading} ref={controls.focus.group} tabIndex={-1}>
          Watchlist filing review
        </h3>
        <p>
          Choose up to {FILINGS_REVIEW_LIMIT} listings. Check one company at a
          time, then inspect its filings and write a cited note in company
          research. Each check uses the last 90 UTC dates.
        </p>
        {state.rows.length ? (
          <ManagedFilingsReviewVisit state={state} controls={controls} />
        ) : (
          <ManagedFilingsReviewPicker
            model={model}
            state={state}
            controls={controls}
          />
        )}
        <p>
          Choosing companies, switching and opening a retained response make no
          source request. Company research keeps the existing reference-to-note,
          Review and Save steps. Back retains this review. Finish or leaving My
          Watchlist clears its temporary responses. Notes stay in your watchlist
          draft.
        </p>
      </section>
    </details>
  );
}
