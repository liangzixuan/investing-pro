import type {
  CompanyReportArchive,
  CompanyReportRevisitSnapshot,
} from "./managed-company-report-archive";
import { requiredDraftFileTime } from "./managed-watchlist-draft-file-validation";

function sourceDates(snapshot: CompanyReportRevisitSnapshot): string {
  return snapshot.sources
    .map((source) => {
      if (source.status === "not_loaded") return `${source.source} not loaded`;
      const completed = source.fields.find(
        (field) => field.label === "Completed",
      )!.value;
      const window = source.fields.find((field) => field.label === "Window");
      const period = window ? ` (${window.value})` : "";
      const retained = source.retainedPrevious
        ? "; retained previous, latest attempt unconfirmed"
        : "";
      return `${source.source} completed ${completed}${period}${retained}`;
    })
    .join("; ");
}
export function companyReportComparisonExcerpt(
  input: {
    readonly archive: CompanyReportArchive;
    readonly assessment: string;
    readonly assessedAt: string;
  },
  captured: CompanyReportRevisitSnapshot,
  completeReferences = false,
): string {
  const { archive, assessment } = input;
  const assessedAt = requiredDraftFileTime(input.assessedAt);
  const references = captured.sources
    .flatMap((source) =>
      completeReferences ? source.references : source.references.slice(0, 1),
    )
    .map((reference) => reference.url);
  const archivedReferences = [
    ...new Set(
      archive.sources.flatMap((source) =>
        source.references.map((reference) => reference.url),
      ),
    ),
  ];
  const archiveCitation = completeReferences
    ? archivedReferences.length
      ? ` Archived source references (unverified file claims): ${archivedReferences.join("; ")}.`
      : " Archived source references unavailable."
    : "";
  const citation = references.length
    ? ` Current source references: ${[...new Set(references)].join("; ")}.`
    : " Current source dates and raw-close windows remain those of the loaded packets.";
  return `${captured.listing.symbol} ${captured.listing.exchangeMic} report revisit assessed ${assessedAt}: archived report prepared ${archive.preparedAt}; current report prepared ${captured.preparedAt}. Archived source dates: ${sourceDates(archive)}. Current source dates: ${sourceDates(captured)}. Authored assessment: ${assessment}${archiveCitation}${citation} The file is not authenticated; reopening renews no source dates. Imported calculations are unverified and were not used as current evidence.`;
}
