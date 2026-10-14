import {
  PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_ITEMS,
  type PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";
import type { ManagedFedRefreshComparison } from "./managed-fed-refresh-comparison";

export function ManagedFedRefreshComparisonDetails({
  comparison,
  showingPrevious,
}: {
  comparison: ManagedFedRefreshComparison;
  showingPrevious: boolean;
}) {
  return (
    <div className="managed-fed-refresh-comparison">
      <p className="managed-fed-refresh-count" role="status">
        Newly observed in this refresh: {comparison.newUrls.length} of{" "}
        {comparison.current.items.length} links in the displayed feed.
      </p>
      <p>These URLs were absent from the previous loaded list.</p>
      {showingPrevious && (
        <p>Comparison remains between the last two accepted feeds.</p>
      )}
      <details>
        <summary>Compared loaded feeds</summary>
        <div className="managed-fed-compared-feeds">
          <ComparedFeed
            label="Previous loaded feed"
            response={comparison.previous}
          />
          <ComparedFeed
            label="Current loaded feed"
            response={comparison.current}
          />
        </div>
        <p>
          Only the loaded lists were compared, with up to{" "}
          {PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_ITEMS} links per feed. An
          absent URL does not establish a new publication, an article change or
          complete feed history.
        </p>
      </details>
    </div>
  );
}

function ComparedFeed({
  label,
  response,
}: {
  label: string;
  response: PersonalMonetaryAnnouncementsDto;
}) {
  return (
    <section aria-label={label}>
      <h3>{label}</h3>
      <dl>
        <div>
          <dt>Retrieved (UTC)</dt>
          <dd>
            <time dateTime={response.fetchedAt}>{response.fetchedAt}</time>
          </dd>
        </div>
        <div>
          <dt>Loaded links</dt>
          <dd>
            {response.items.length} of {response.availableItemCount} validated
            feed entries
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            <a
              href={response.source.feedUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {response.source.name}
            </a>
          </dd>
        </div>
      </dl>
    </section>
  );
}
