import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import { ManagedWatchlistReviewEntries } from "./ManagedWatchlistReviewEntries";
import { reviewWatchlistVersions } from "./managed-watchlist-review";
import type { SaveState, VersionedPayload } from "./save-coordinator";

const phaseMessages = {
  loading:
    "Loading the saved version. This review updates when loading finishes.",
  saving: "Saving the watchlist. This review updates when the save settles.",
  reconciling: "Finish save recovery above before reviewing further changes.",
  signing_out: "Check the sign-out review before continuing.",
  retired: "",
} as const;

function unavailableReason(state: SaveState<MainWatchlistPayload>) {
  if (state.phase !== "idle") return phaseMessages[state.phase];
  if (state.conflict || state.uncertain || state.replayPending)
    return "Finish save recovery above before reviewing further changes.";
  if (!state.saved) return "Load a saved version before reviewing changes.";
  return null;
}

function UnsavedComparison({
  saved,
  draft,
  review,
}: {
  saved: VersionedPayload<MainWatchlistPayload>;
  draft: MainWatchlistPayload;
  review: ReturnType<typeof reviewWatchlistVersions>;
}) {
  return (
    <>
      <h3>Last confirmed saved version {saved.version} and current draft</h3>
      <p>
        This includes every draft listing, regardless of search or selection.
      </p>
      <p>
        Another device may have saved a newer version. Save watchlist still
        checks the complete draft and its notes before saving.
      </p>
      {review.catalogChanged && (
        <>
          <p>
            These versions use different catalogs. The normal catalog checks
            still apply before saving.
          </p>
          <dl className="managed-metadata">
            <dt>Last confirmed saved catalog</dt>
            <dd>{saved.payload.snapshotSha256}</dd>
            <dt>Current draft catalog</dt>
            <dd>{draft.snapshotSha256}</dd>
          </dl>
        </>
      )}
      {!review.entries.length && !review.catalogChanged && (
        <p>No differences from last confirmed saved version {saved.version}.</p>
      )}
      <ManagedWatchlistReviewEntries
        entries={review.entries}
        savedLabel={`Last confirmed saved version ${saved.version}`}
        draftLabel="Current draft"
        identityPresentation="inline"
      />
    </>
  );
}

export function ManagedUnsavedWatchlistReview({
  state,
}: {
  state: SaveState<MainWatchlistPayload>;
}) {
  if (!state.draft || state.phase === "retired") return null;
  const reason = unavailableReason(state);
  const review = reason
    ? null
    : reviewWatchlistVersions(state.saved!.payload, state.draft);
  return (
    <details id="managed-unsaved-review">
      <summary id="managed-unsaved-review-summary">
        Review unsaved changes
        {review && (
          <>
            {" · "}
            {review.entries.length} changed{" "}
            {review.entries.length === 1 ? "listing" : "listings"} ·{" "}
            {review.unchanged} unchanged
          </>
        )}
      </summary>
      {reason ? (
        <p>{reason}</p>
      ) : (
        <UnsavedComparison
          saved={state.saved!}
          draft={state.draft}
          review={review!}
        />
      )}
    </details>
  );
}
