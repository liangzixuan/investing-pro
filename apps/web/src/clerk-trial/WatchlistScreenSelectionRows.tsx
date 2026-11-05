import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import type { WatchlistScreenSelectionPlan } from "./managed-watchlist-screen-selection-plan";

export const WATCHLIST_SCREEN_PAGE_SIZE = 25;
/** Every eligibility row is reachable; only one bounded page mounts identities. */
export function WatchlistScreenSelectionRows({
  rows,
  id,
  page,
  onPage,
}: {
  readonly rows: WatchlistScreenSelectionPlan["rows"];
  readonly id: string;
  readonly page: number;
  readonly onPage: (page: number) => void;
}) {
  const pages = Math.max(
    1,
    Math.ceil(rows.length / WATCHLIST_SCREEN_PAGE_SIZE),
  );
  const current = Number.isInteger(page)
    ? Math.max(0, Math.min(pages - 1, page))
    : 0;
  const start = current * WATCHLIST_SCREEN_PAGE_SIZE;
  const shown = rows.slice(start, start + WATCHLIST_SCREEN_PAGE_SIZE);
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const labels: Record<
    WatchlistScreenSelectionPlan["rows"][number]["status"],
    string
  > = {
    included: "Included",
    outside_cohort: "Outside this cohort",
    uncovered: "Annual unavailable",
    identity_mismatch: "Identity mismatch",
    choice_required: "Share-class choice required",
    other_share_class: "Other watched share class",
    cohort_unloaded: "Cohort not loaded",
  };
  return (
    <section aria-labelledby={`${id}-heading`}>
      <h5 id={`${id}-heading`}>All Watchlist eligibility outcomes</h5>
      <p id={`${id}-count`} role="status">
        {rows.length} entries. Showing {rows.length ? start + 1 : 0}–
        {start + shown.length}. Page {current + 1} of {pages}.
      </p>
      <ul aria-label="Complete eligibility counts">
        {Array.from(counts, ([status, count]) => (
          <li key={status}>
            {labels[status as keyof typeof labels]}: {count}
          </li>
        ))}
      </ul>
      <ol
        className="managed-watchlist-screen-rows"
        start={start + 1}
        aria-describedby={`${id}-count`}
      >
        {shown.map((row) => (
          <li
            key={row.membership.listingId}
            data-listing-id={row.membership.listingId}
          >
            <p>
              <ListingIdentity member={row.membership} />
            </p>
            <p data-watchlist-outcome={row.status}>{row.reason}</p>
            <details>
              <summary>Complete watched listing identity</summary>
              <dl className="managed-watchlist-screen-identity">
                {Object.entries(identityLabels).map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>
                      {row.membership[key as keyof typeof identityLabels]}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </li>
        ))}
      </ol>
      {pages > 1 && (
        <nav aria-label="Watchlist eligibility pages">
          <button
            type="button"
            className="trial-secondary"
            id={`${id}-previous`}
            disabled={current === 0}
            onClick={() => onPage(current - 1)}
          >
            Previous entries
          </button>
          <label htmlFor={`${id}-page`}>
            Go to page
            <select
              id={`${id}-page`}
              value={current}
              onChange={(event) => {
                const requested = Number(event.currentTarget.value);
                if (
                  Number.isInteger(requested) &&
                  requested >= 0 &&
                  requested < pages
                )
                  onPage(requested);
              }}
            >
              {Array.from({ length: pages }, (_, index) => (
                <option value={index} key={index}>
                  {index + 1}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="trial-secondary"
            id={`${id}-next`}
            disabled={current + 1 >= pages}
            onClick={() => onPage(current + 1)}
          >
            Next entries
          </button>
        </nav>
      )}
    </section>
  );
}
