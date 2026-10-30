import {
  MANAGED_RESEARCH_FOLLOWUPS_LIMITS,
  normalizeResearchFollowupResult,
} from "@research-cockpit/contracts";
import type { PreparedCompanyReport } from "./managed-company-report";
import {
  companyReportArchiveMatches,
  projectCurrentCompanyReport,
  type CompanyReportArchive,
} from "./managed-company-report-archive";
import { companyReportComparisonExcerpt } from "./company-report-comparison-excerpt";

export interface CompanyReportComparisonAssessmentPreparation {
  readonly preview: Readonly<{ result: string; excerpt: string }> | null;
  readonly reason: string | null;
}
function refuse(reason: string): CompanyReportComparisonAssessmentPreparation {
  return { preview: null, reason };
}
function validRawResult(value: string) {
  return (
    [...value].length <= MANAGED_RESEARCH_FOLLOWUPS_LIMITS.resultCodePoints &&
    !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value) &&
    normalizeResearchFollowupResult(value) !== null
  );
}
/** Complete draft proposal only. Raw authored text is never normalized or clipped here. */
export function prepareCompanyReportComparisonAssessment(input: {
  readonly archive: CompanyReportArchive;
  readonly current: PreparedCompanyReport;
  readonly assessment: string;
  readonly assessedAt: string;
  readonly currentResult: string;
}): CompanyReportComparisonAssessmentPreparation {
  try {
    return prepare(input);
  } catch {
    return refuse(
      "The report comparison could not be prepared. Review both captures again.",
    );
  }
}
function prepare(
  input: Parameters<typeof prepareCompanyReportComparisonAssessment>[0],
): CompanyReportComparisonAssessmentPreparation {
  const { archive, current, assessment, currentResult } = input;
  if (!companyReportArchiveMatches(archive, current.selection))
    return refuse(
      "The archived report does not match this exact company and CIK.",
    );
  const captured = projectCurrentCompanyReport(current);
  if (!captured)
    return refuse(
      "Prepare a current company report before comparing it with the archive.",
    );
  if (!validRawResult(currentResult))
    return refuse(
      "Correct the current Follow-ups assessment before adding the report comparison.",
    );
  if (!validRawResult(assessment))
    return refuse(
      "Use a single-line comparison assessment within the 2,000-character result limit.",
    );
  if (!assessment.trim())
    return refuse(
      "Write your assessment before preparing the comparison result.",
    );
  const excerpt = companyReportComparisonExcerpt(input, captured, true);
  // The same comparison remains a duplicate when a later preview has a new assessment time.
  const comparison = excerpt.slice(
    excerpt.indexOf(": archived report prepared "),
  );
  if (currentResult.includes(comparison))
    return refuse(
      "This comparison is already in the current Follow-ups assessment.",
    );
  const result = currentResult ? `${currentResult} ${excerpt}` : excerpt;
  if (!validRawResult(result))
    return refuse(
      "The complete assessment exceeds the single-line, 2,000-character result limit. Nothing was clipped or saved.",
    );
  return { preview: Object.freeze({ result, excerpt }), reason: null };
}
