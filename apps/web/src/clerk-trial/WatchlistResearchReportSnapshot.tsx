import {
  isPreparedWatchlistResearchReport,
  type PreparedWatchlistResearchReport,
} from "./managed-watchlist-research-pair";
import { identityLabels } from "./ManagedListingIdentity";
import {
  ManagedScreenResearchReading,
  OfflineResearchReading,
} from "./ManagedScreenResearchReading";

/** Both complete readings are present even while a disclosure is closed. */
export function WatchlistResearchReportSnapshot({
  report,
}: {
  readonly report: PreparedWatchlistResearchReport;
}) {
  if (!isPreparedWatchlistResearchReport(report)) return null;
  return (
    <article aria-label="Complete Watchlist company research report">
      <h1>Watchlist company research</h1>
      <p>
        Report prepared {report.preparedAt}. Each retained reading keeps its
        original capture, calculation and source times. Notes include authored
        drafts; this report does not establish that a thesis or other resource
        was saved. Recapture a company to include later edits.
      </p>
      <p>
        These two listings were chosen from My Watchlist. This private
        historical copy does not rank companies, align their reporting periods,
        restore inputs, create a check or update an account.
      </p>
      {report.reading.listings.map((listing, index) => (
        <section
          key={listing.listingId}
          aria-label={`${index === 0 ? "First" : "Second"} company identity`}
        >
          <h2>{index === 0 ? "First" : "Second"} company</h2>
          <dl>
            {Object.entries(identityLabels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{listing[key as keyof typeof identityLabels]}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <OfflineResearchReading value={true}>
        <ManagedScreenResearchReading capture={report.reading.left} />
        <ManagedScreenResearchReading capture={report.reading.right} />
      </OfflineResearchReading>
      <details>
        <summary>Complete Watchlist research payload (JSON)</summary>
        <pre data-watchlist-research-payload="true">
          {JSON.stringify(report)}
        </pre>
      </details>
    </article>
  );
}
