import type {
  MainWatchlistPayload,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import { reviewWatchlistVersions } from "./managed-watchlist-review";

function VersionEntry({
  label,
  member,
  position,
}: {
  label: string;
  member: WatchlistMembership | null;
  position: number | null;
}) {
  return (
    <div className="managed-version-side">
      <h5>{label}</h5>
      {member ? (
        <>
          <p>
            <ListingIdentity member={member} />
          </p>
          <p>Position {position}</p>
          <p className="trial-saved-note">
            {member.note === "" ? "No note" : member.note}
          </p>
        </>
      ) : (
        <p>Not in this version</p>
      )}
    </div>
  );
}

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
      <ul className="managed-version-changes">
        {review.entries.map((entry) => (
          <li
            key={entry.listingId}
            data-managed-review-listing-id={entry.listingId}
          >
            <h4>{(entry.draft ?? entry.saved)!.symbol}</h4>
            <small>Listing ID: {entry.listingId}</small>
            <p>
              {!entry.saved
                ? "Only in my draft"
                : !entry.draft
                  ? "Only in the saved version"
                  : [
                      entry.noteChanged ? "Note differs" : null,
                      entry.savedPosition !== entry.draftPosition
                        ? "Order differs"
                        : null,
                      entry.identityChanged ? "Listing identity differs" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
            </p>
            <div className="managed-version-pair">
              <VersionEntry
                label={`Saved version ${version}`}
                member={entry.saved}
                position={entry.savedPosition}
              />
              <VersionEntry
                label="My draft"
                member={entry.draft}
                position={entry.draftPosition}
              />
            </div>
            {entry.identityChanged && entry.saved && entry.draft && (
              <details>
                <summary>Review changed listing identity</summary>
                <dl className="managed-metadata">
                  {(
                    Object.keys(
                      identityLabels,
                    ) as (keyof typeof identityLabels)[]
                  )
                    .filter((key) => entry.saved![key] !== entry.draft![key])
                    .map((key) => (
                      <div key={key}>
                        <dt>{identityLabels[key]}</dt>
                        <dd>
                          Saved: {entry.saved![key]}. My draft:{" "}
                          {entry.draft![key]}.
                        </dd>
                      </div>
                    ))}
                </dl>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
