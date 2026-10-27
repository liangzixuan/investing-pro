import { archivedInterimEvidence } from "./managed-company-report-archive";
import { InterimStatementsReportView } from "./InterimStatementsReportView";
import type {
  CompanyReportRevisitSnapshot,
  CompanyReportSourceProvenance,
} from "./managed-company-report-archive";
import { identityLabels } from "./ManagedListingIdentity";

function reportIdentity(snapshot: CompanyReportRevisitSnapshot) {
  return (
    <dl className="managed-metadata">
      <div>
        <dt>Report preparation time</dt>
        <dd>{snapshot.preparedAt}</dd>
      </div>
      <div>
        <dt>Catalog snapshot SHA-256</dt>
        <dd>{snapshot.catalogSnapshotSha256}</dd>
      </div>
      <div>
        <dt>CIK</dt>
        <dd>{snapshot.selectionCik ?? "Not supplied"}</dd>
      </div>
      {(Object.keys(identityLabels) as (keyof typeof identityLabels)[]).map(
        (key) => (
          <div key={key}>
            <dt>{identityLabels[key]}</dt>
            <dd>{snapshot.listing[key]}</dd>
          </div>
        ),
      )}
    </dl>
  );
}
function noteText(note: string | null) {
  if (note === null)
    return "This company was outside the Watchlist at capture.";
  if (note === "") return "The Watchlist note was empty at capture.";
  return note;
}
function sourceFlags(source: CompanyReportSourceProvenance) {
  return (
    <p>
      {source.status === "loaded"
        ? "Loaded in this capture."
        : "Not loaded in this capture."}{" "}
      {source.retainedPrevious ? "Retained previous response. " : ""}
      {source.lastAttemptFailed ? "Last attempt failed." : ""}
    </p>
  );
}
function sourceReferences(source: CompanyReportSourceProvenance) {
  if (source.references.length === 0) return null;
  return (
    <ul>
      {source.references.map((reference, index) => (
        <li key={index}>
          {reference.label}: {reference.url}
        </li>
      ))}
    </ul>
  );
}
const sourceLabels = {
  price: "Price",
  annual: "Annual",
  interim: "Interim",
  filings: "Filings",
};
function sourceProvenance(
  source: CompanyReportSourceProvenance,
  title: string,
) {
  return (
    <section
      key={source.source}
      aria-label={`${title} ${source.source} provenance`}
    >
      <h5>{sourceLabels[source.source]} source provenance</h5>
      {sourceFlags(source)}
      {source.responseOrigin && (
        <p>Original response origin: {source.responseOrigin}</p>
      )}
      <dl className="managed-metadata">
        {source.fields.map((field, index) => (
          <div key={index}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      {sourceReferences(source)}
    </section>
  );
}
export function CompanyReportRevisitSnapshotView({
  snapshot,
  title,
}: {
  snapshot: CompanyReportRevisitSnapshot;
  title: string;
}) {
  const interim = archivedInterimEvidence(snapshot);
  return (
    <section aria-label={title}>
      <h4>{title}</h4>
      {reportIdentity(snapshot)}
      <h5>Whole authored Watchlist note</h5>
      <p className="managed-company-report-note">{noteText(snapshot.note)}</p>
      {snapshot.sources.map((source) => sourceProvenance(source, title))}
      {interim && (
        <InterimStatementsReportView
          evidence={interim.response.evidence}
          statements={interim.statements}
        />
      )}
    </section>
  );
}
