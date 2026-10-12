import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import { ManagedWatchlistReviewEntries } from "./ManagedWatchlistReviewEntries";
import { reviewWatchlistVersions } from "./managed-watchlist-review";

export function ManagedWatchlistReview({
  saved,
  draft,
  version,
}: {
  saved: MainWatchlistPayload;
  draft: MainWatchlistPayload;
  version: number;
}) {
  const review = reviewWatchlistVersions(saved, draft);
  return (
    <section
      className="managed-version-review"
      aria-labelledby="managed-version-review-heading"
    >
      <h3 id="managed-version-review-heading">
        Review saved version {version} and my draft
      </h3>
      <p>
        {review.entries.length} changed{" "}
        {review.entries.length === 1 ? "listing" : "listings"} ·{" "}
        {review.unchanged} unchanged. Choosing a version uses its whole
        watchlist, including notes and order.
      </p>
      {review.catalogChanged && (
        <p>
          These versions use different catalogs. Keeping your draft retains its
          catalog. The normal catalog checks still apply before saving.
        </p>
      )}
      {!review.entries.length && (
        <p>The listings, notes and order are the same.</p>
      )}
      <ManagedWatchlistReviewEntries
        entries={review.entries}
        savedLabel={`Saved version ${version}`}
        draftLabel="My draft"
        identityPresentation="disclosure"
      />
    </section>
  );
}
