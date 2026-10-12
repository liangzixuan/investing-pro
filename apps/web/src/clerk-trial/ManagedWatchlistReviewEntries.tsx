import type { WatchlistMembership } from "@research-cockpit/contracts";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import type { WatchlistReviewEntry } from "./managed-watchlist-review";

type ReviewLabels = {
  savedLabel: string;
  draftLabel: string;
  identityPresentation: "inline" | "disclosure";
};

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

function changeDescription(entry: WatchlistReviewEntry, draftLabel: string) {
  if (!entry.saved) return `Only in ${draftLabel.toLowerCase()}`;
  if (!entry.draft) return "Only in the saved version";
  return [
    entry.noteChanged ? "Note differs" : null,
    entry.savedPosition !== entry.draftPosition ? "Order differs" : null,
    entry.identityChanged ? "Listing identity differs" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function IdentityChanges({
  saved,
  draft,
  savedLabel,
  draftLabel,
}: {
  saved: WatchlistMembership;
  draft: WatchlistMembership;
  savedLabel: string;
  draftLabel: string;
}) {
  return (
    <dl className="managed-metadata">
      {(Object.keys(identityLabels) as (keyof typeof identityLabels)[])
        .filter((key) => saved[key] !== draft[key])
        .map((key) => (
          <div key={key}>
            <dt>{identityLabels[key]}</dt>
            <dd>
              {savedLabel}: {saved[key]}. {draftLabel}: {draft[key]}.
            </dd>
          </div>
        ))}
    </dl>
  );
}

function ReviewEntry({
  entry,
  savedLabel,
  draftLabel,
  identityPresentation,
}: ReviewLabels & { entry: WatchlistReviewEntry }) {
  const identityChanges = entry.identityChanged &&
    entry.saved &&
    entry.draft && (
      <IdentityChanges
        saved={entry.saved}
        draft={entry.draft}
        savedLabel={
          identityPresentation === "disclosure" ? "Saved" : savedLabel
        }
        draftLabel={draftLabel}
      />
    );
  return (
    <li data-managed-review-listing-id={entry.listingId}>
      <h4>{(entry.draft ?? entry.saved)!.symbol}</h4>
      <small>Listing ID: {entry.listingId}</small>
      <p>{changeDescription(entry, draftLabel)}</p>
      <div className="managed-version-pair">
        <VersionEntry
          label={savedLabel}
          member={entry.saved}
          position={entry.savedPosition}
        />
        <VersionEntry
          label={draftLabel}
          member={entry.draft}
          position={entry.draftPosition}
        />
      </div>
      {identityChanges &&
        (identityPresentation === "disclosure" ? (
          <details>
            <summary>Review changed listing identity</summary>
            {identityChanges}
          </details>
        ) : (
          identityChanges
        ))}
    </li>
  );
}

export function ManagedWatchlistReviewEntries({
  entries,
  ...labels
}: ReviewLabels & { entries: readonly WatchlistReviewEntry[] }) {
  return (
    <ul className="managed-version-changes">
      {entries.map((entry) => (
        <ReviewEntry key={entry.listingId} entry={entry} {...labels} />
      ))}
    </ul>
  );
}
