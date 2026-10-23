import { normalizeWatchlistNote } from "@research-cockpit/contracts";
import type { PreparedCompanyReport } from "./managed-company-report";
import {
  companyReportArchiveMatches,
  projectCurrentCompanyReport,
  type CompanyReportArchive,
  type CompanyReportRevisitSnapshot,
} from "./managed-company-report-archive";
import { requiredDraftFileTime } from "./managed-watchlist-draft-file-validation";

export interface CompanyReportRevisitNotePreparation {
  readonly preview: Readonly<{ note: string; excerpt: string }> | null;
  readonly reason: string | null;
}
function refuse(reason: string): CompanyReportRevisitNotePreparation {
  return { preview: null, reason };
}
function validNote(value: string): boolean {
  if ([...value].length > 2_000) return false;
  if (/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)) return false;
  return normalizeWatchlistNote(value) !== null;
}
/** A complete authored proposal only; it cannot apply, restore or save any note. */
export function prepareCompanyReportRevisitNote(input: {
  readonly archive: CompanyReportArchive;
  readonly current: PreparedCompanyReport;
  readonly assessment: string;
  readonly assessedAt: string;
}): CompanyReportRevisitNotePreparation {
  try {
    return prepare(input);
  } catch {
    return refuse(
      "The report comparison could not be prepared. Review both captures again.",
    );
  }
}
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
function prepare(
  input: Parameters<typeof prepareCompanyReportRevisitNote>[0],
): CompanyReportRevisitNotePreparation {
  const { archive, current, assessment } = input;
  if (!companyReportArchiveMatches(archive, current.selection))
    return refuse(
      "The archived report does not match this exact company and CIK.",
    );
  const captured = projectCurrentCompanyReport(current);
  if (!captured)
    return refuse(
      "Prepare a current company report before comparing it with the archive.",
    );
  if (captured.note === null)
    return refuse(
      "Add this company to My Watchlist before preparing a comparison note.",
    );
  if (!validNote(captured.note))
    return refuse(
      "Correct the current note before adding the report comparison.",
    );
  const issue = assessmentIssue(assessment);
  if (issue) return refuse(issue);
  return completeProposal(captured.note, comparisonExcerpt(input, captured));
}
function assessmentIssue(assessment: string): string | null {
  if (!validNote(assessment))
    return "Use a single-line assessment within the 2,000-character note limit.";
  if (assessment.trim().length === 0)
    return "Write your assessment before preparing the comparison note.";
  return null;
}
function comparisonExcerpt(
  input: Parameters<typeof prepareCompanyReportRevisitNote>[0],
  captured: CompanyReportRevisitSnapshot,
): string {
  const { archive, assessment } = input;
  const assessedAt = requiredDraftFileTime(input.assessedAt);
  const references = captured.sources
    .flatMap((source) => source.references.slice(0, 1))
    .map((reference) => reference.url);
  const citation = references.length
    ? ` Current source references: ${[...new Set(references)].join("; ")}.`
    : " Current source dates and raw-close windows remain those of the loaded packets.";
  return `${captured.listing.symbol} ${captured.listing.exchangeMic} report revisit assessed ${assessedAt}: archived report prepared ${archive.preparedAt}; current report prepared ${captured.preparedAt}. Archived source dates: ${sourceDates(archive)}. Current source dates: ${sourceDates(captured)}. Authored assessment: ${assessment}${citation} The file is not authenticated; reopening renews no source dates. Imported calculations are unverified and were not used as current evidence.`;
}
function completeProposal(
  currentNote: string,
  excerpt: string,
): CompanyReportRevisitNotePreparation {
  if (currentNote.endsWith(excerpt))
    return refuse(
      "This comparison is already at the end of the current note draft.",
    );
  const note = currentNote ? `${currentNote} ${excerpt}` : excerpt;
  if (!validNote(note))
    return refuse(
      "The complete note exceeds the single-line, 2,000-character limit. Nothing was clipped or saved.",
    );
  return { preview: Object.freeze({ note, excerpt }), reason: null };
}
