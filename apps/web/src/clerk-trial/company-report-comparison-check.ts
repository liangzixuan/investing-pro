import { membershipMatchesResult } from "@research-cockpit/contracts";
import type { CompanyReportComparisonCapture } from "./company-report-revisit";
import type { CompanyReportComparisonCheckTarget } from "./company-report-comparison-check-target";
import { prepareCompanyReportComparisonAssessment } from "./company-report-comparison-assessment";

export interface CompanyReportComparisonCheckPreview {
  readonly result: string;
  readonly excerpt: string;
  readonly target: CompanyReportComparisonCheckTarget;
  readonly isCurrent: () => boolean;
  readonly apply: () => boolean;
  readonly cancel: () => void;
}
export const staleComparisonCheck =
  "The comparison, check or company visit changed. Preview the current assessment again.";

/** Join two captured owners without loading, selecting, completing or saving. */
export function prepareCompanyReportComparisonCheck(
  capture: CompanyReportComparisonCapture,
  target: CompanyReportComparisonCheckTarget,
  hostCurrent: () => boolean,
  assessedAt = new Date().toISOString(),
): {
  preview: CompanyReportComparisonCheckPreview | null;
  reason: string | null;
} {
  let retired = false;
  const current = () => {
    if (retired) return false;
    retired =
      !hostCurrent() ||
      !capture.isCurrent() ||
      !target.isCurrent() ||
      !capture.isCurrent() ||
      !hostCurrent();
    return !retired;
  };
  if (
    !target.editable ||
    !current() ||
    target.entry.catalogSnapshotSha256 !==
      capture.current.selection.catalogSnapshotSha256 ||
    !membershipMatchesResult(
      { ...target.entry.listing, note: "" },
      capture.current.selection.listing,
    )
  )
    return { preview: null, reason: staleComparisonCheck };
  const prepared = prepareCompanyReportComparisonAssessment({
    archive: capture.archive,
    current: capture.current,
    assessment: capture.assessment,
    currentResult: target.entry.result,
    assessedAt,
  });
  if (!prepared.preview) return { preview: null, reason: prepared.reason };
  if (!current()) return { preview: null, reason: staleComparisonCheck };
  const { result, excerpt } = prepared.preview;
  return {
    reason: null,
    preview: Object.freeze({
      result,
      excerpt,
      target,
      isCurrent: current,
      cancel: () => {
        retired = true;
      },
      apply() {
        if (!current()) return false;
        retired = true;
        return target.apply(result);
      },
    }),
  };
}
