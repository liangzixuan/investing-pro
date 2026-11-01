import { useId, useSyncExternalStore, type ReactNode } from "react";
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

import type { ManagedWatchlistDailyReviewCapture } from "./managed-watchlist-daily-review";
import { ManagedWatchlistDailyReview } from "./ManagedWatchlistDailyReview";
import { useManagedWatchlistDailyReviewControls } from "./useManagedWatchlistDailyReviewControls";

export function ManagedFilingsReview({
  model,
  active,
  onView,
  onViewDaily,
  dailyChecks,
}: {
  dailyChecks?: ReactNode;
  onViewDaily?: (
    capture: ManagedWatchlistDailyReviewCapture,
    opener: HTMLButtonElement,
  ) => void;
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
  const dailyControls = useManagedWatchlistDailyReviewControls({
    model,
    state,
    active,
  });
  const selected = selectedReviewRow(state);
  return (
    <details className="managed-filings-review">
      <summary>Review a group of watchlist companies</summary>
      <section
        aria-labelledby={heading}
        aria-busy={
          state.daily?.phase === "running" ||
          (selected?.filings.running ?? false)
        }
      >
        <h3 id={heading} ref={controls.focus.group} tabIndex={-1}>
          {state.daily ? "Watchlist daily review" : "Watchlist filing review"}
        </h3>
        {!state.daily && (
          <p>
            Choose up to {FILINGS_REVIEW_LIMIT} listings. Check one company at a
            time, then inspect its filings and write a cited note in company
            research. Each check uses the last 90 UTC dates.
          </p>
        )}
        {state.daily ? (
          <ManagedWatchlistDailyReview
            model={model}
            state={state}
            active={active}
            {...(onViewDaily ? { onViewDaily } : {})}
            dailyChecks={dailyChecks}
            onReset={(event) =>
              dailyControls.transition(
                event.currentTarget,
                controls.focus.group,
                () => model.resetDaily(state),
              )
            }
          />
        ) : state.rows.length ? (
          <ManagedFilingsReviewVisit state={state} controls={controls} />
        ) : (
          <ManagedFilingsReviewPicker
            model={model}
            state={state}
            controls={controls}
            onStartDaily={(event) =>
              dailyControls.transition(
                event.currentTarget,
                controls.focus.group,
                () => model.startDaily(state),
              )
            }
          />
        )}
        {!state.daily && (
          <p>
            Choosing companies, switching and opening a retained response make
            no source request. Company research keeps the existing
            reference-to-note, Review and Save steps. Back retains this review.
            Finish or leaving My Watchlist clears its temporary responses. Notes
            stay in your watchlist draft.
          </p>
        )}
      </section>
    </details>
  );
}
