import type { ResearchFollowupsPayload } from "@research-cockpit/contracts";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";

/** Complete authored content and exact identities; no source or currentness claim. */
export function FollowupsDraftDetails({
  draft,
}: {
  draft: ResearchFollowupsPayload;
}) {
  if (!draft.entries.length) return <p>No follow-ups in this draft.</p>;
  return (
    <ol>
      {draft.entries.map((entry) => (
        <li key={entry.id}>
          <p>
            <ListingIdentity member={entry.listing} />
          </p>
          <p>Entry ID: {entry.id}</p>
          <p>
            Due <time dateTime={entry.dueOn}>{entry.dueOn}</time> UTC.{" "}
            {entry.status === "completed"
              ? `Completed ${entry.completedOn} UTC.`
              : "Open."}
          </p>
          <p className="managed-followups-authored">{entry.check}</p>
          <p className="managed-followups-authored">
            {entry.result || "No authored result."}
          </p>
          <details>
            <summary>Full listing identity and captured catalog</summary>
            <dl>
              {Object.entries(entry.listing).map(([key, value]) => (
                <div key={key}>
                  <dt>{identityLabels[key as keyof typeof identityLabels]}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p>Catalog: {entry.catalogSnapshotSha256}</p>
          </details>
        </li>
      ))}
    </ol>
  );
}
