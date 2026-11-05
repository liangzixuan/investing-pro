import {
  isPreparedDueCheckEvidenceReport,
  type PreparedDueCheckEvidenceReport,
} from "./due-check-evidence-report";
import { FollowupEvidenceReading } from "./ManagedFollowupsReviewEvidence";
import { ListingIdentity, identityLabels } from "./ManagedListingIdentity";
import { CapturedSourcePacket } from "./ManagedScreenResearchReading";

/** Passive chosen rows. Export mode materializes the otherwise lazy disclosures. */
export function DueCheckEvidenceReportSnapshot({
  report,
}: {
  readonly report: PreparedDueCheckEvidenceReport;
}) {
  if (!isPreparedDueCheckEvidenceReport(report)) return null;
  return (
    <article aria-label="Complete finished due-check evidence report">
      <h1>Finished due-check evidence review</h1>
      <p>
        Report prepared (UTC): {report.preparedAt}. Review due-date assessment
        (UTC): {report.assessedOn}. Source dates and capture times remain
        separate.
      </p>
      <p>
        This private reading copy keeps the chosen checks and their retained
        evidence. Authored assessments can include unsaved changes. It does not
        refresh sources, save Follow-ups or restore a draft.
      </p>
      <p>
        Follow-ups saved version {report.resource.savedVersion}; draft base
        version {report.resource.baseVersion};{" "}
        {report.resource.dirty
          ? "unsaved changes"
          : "no unsaved changes reported"}
        . Catalog reference: {report.resource.catalog}.
      </p>
      <ol aria-label="Chosen checks in original review order">
        {report.rows.map(({ entry, reading }, index) => (
          <li key={entry.id} data-due-check-report-entry={entry.id}>
            <section aria-label={`Chosen check ${index + 1}`}>
              <h2>
                <ListingIdentity member={entry.listing} />
              </h2>
              <h3>Authored check at report preparation</h3>
              <p className="managed-followups-authored">{entry.check}</p>
              <p>
                Due {entry.dueOn} UTC. Status: {entry.status}. Completed on{" "}
                {entry.completedOn ?? "not completed"}. Check identifier:{" "}
                {entry.id}.
              </p>
              <h3>Authored assessment at report preparation</h3>
              <p className="managed-followups-authored">
                {entry.result || "No authored assessment."}
              </p>
              <details>
                <summary>Complete current check identity</summary>
                <dl>
                  {Object.entries(identityLabels).map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>
                        {entry.listing[key as keyof typeof identityLabels]}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt>Entry catalog reference</dt>
                    <dd>{entry.catalogSnapshotSha256}</dd>
                  </div>
                </dl>
              </details>
              {reading ? (
                <FollowupEvidenceReading reading={reading} />
              ) : (
                <p>No source reading was retained for this chosen check.</p>
              )}
            </section>
          </li>
        ))}
      </ol>
      <div data-due-check-report-payload="true">
        <CapturedSourcePacket
          label="Complete finished due-check report payload"
          value={report}
        />
      </div>
    </article>
  );
}
