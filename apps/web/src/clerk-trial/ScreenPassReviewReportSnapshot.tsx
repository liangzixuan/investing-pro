import type { PreparedScreenPassReviewReport } from "./screen-pass-review-report";
import {
  AnnualPassRowReading,
  PassRawReading,
} from "./FinancialScreenPassReviewReading";
import { ListingIdentity } from "./ManagedListingIdentity";
import { useContext } from "react";
import { OfflineResearchReading } from "./ManagedScreenResearchReading";
export function ScreenPassReviewReportSnapshot({
  report,
}: {
  readonly report: PreparedScreenPassReviewReport;
}) {
  const eager = useContext(OfflineResearchReading);
  return (
    <article aria-label="Complete Annual-pass comparison report">
      <h2>Annual-pass comparison</h2>
      <p>
        Report prepared {report.preparedAt}; catalog{" "}
        {report.catalogSnapshotSha256}.
      </p>
      <p>
        Fresh-pass plan prepared {report.plan.preparedAt}.{" "}
        {report.plan.requests.length} exact listings in reviewed request order.
      </p>
      <p>
        Previous pass: {report.plan.sourceRun.status}, started{" "}
        {report.plan.sourceRun.startedAt}, completed{" "}
        {report.plan.sourceRun.completedAt}. Current pass:{" "}
        {report.current.status}, started {report.current.startedAt}, completed{" "}
        {report.current.completedAt}.
      </p>
      <p>
        Clause readouts present the captured filters against retained evidence.
        They do not record a new source read or evaluation. Each row keeps its
        original evaluation time. Different financial periods are not a
        like-for-like change; unavailable or unattempted reads do not establish
        a nonmatch.
      </p>
      {report.plan.requests.map(({ listing }, index) => (
        <article
          key={listing.listingId}
          data-pass-report-listing={listing.listingId}
        >
          <h3>
            {index + 1}. {listing.symbol} · {listing.issuerName}
          </h3>
          <ListingIdentity member={listing} />
          <AnnualPassRowReading
            row={report.plan.sourceRun.rows[index]!}
            run={report.plan.sourceRun}
            side="previous"
            eager={eager}
          />
          <AnnualPassRowReading
            row={report.current.rows[index]!}
            run={report.current}
            side="current"
            eager={eager}
          />
        </article>
      ))}
      <PassRawReading
        label="Complete previous pass, filters and continuation history"
        value={report.plan.sourceRun}
        eager={eager}
      />
      <PassRawReading
        label="Complete current pass, filters and continuation history"
        value={report.current}
        eager={eager}
      />
      <PassRawReading
        label="Complete Annual-pass report payload"
        value={report}
        eager={eager}
        payload
      />
    </article>
  );
}
