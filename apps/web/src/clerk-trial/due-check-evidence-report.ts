import {
  parseResearchFollowupsPayload,
  type ResearchFollowup,
} from "@research-cockpit/contracts";
import type { FollowupsReviewState } from "./managed-followups-review-session";
import { FOLLOWUPS_REVIEW_LIMIT } from "./managed-followups-review-session";
import type {
  FollowupsReviewEvidenceState,
  PassiveFollowupEvidenceReading,
} from "./managed-followups-review-evidence";
import type { FollowupsReportContext } from "./managed-followups-review-report-admission";
import { requiredDraftFileTime } from "./managed-watchlist-draft-file-validation";

export interface PreparedDueCheckEvidenceReport {
  readonly kind: "due_check_evidence_review";
  readonly preparedAt: string;
  readonly assessedOn: string;
  readonly rows: readonly {
    readonly entry: ResearchFollowup;
    readonly reading: PassiveFollowupEvidenceReading | null;
  }[];
  readonly resource: {
    readonly baseVersion: number;
    readonly savedVersion: number;
    readonly dirty: boolean;
    readonly catalog: string;
  };
}
const reports = new WeakSet<object>();
export function isPreparedDueCheckEvidenceReport(
  value: unknown,
): value is PreparedDueCheckEvidenceReport {
  return typeof value === "object" && value !== null && reports.has(value);
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function validText(value: unknown): boolean {
  if (typeof value === "string") return !/\p{Cs}/u.test(value);
  return (
    value === null ||
    typeof value !== "object" ||
    Object.values(value).every(validText)
  );
}
export function dueCheckEvidenceReportReady(
  review: FollowupsReviewState,
  evidence: FollowupsReviewEvidenceState,
  context: FollowupsReportContext,
): boolean {
  try {
    if (
      !review.entered ||
      review.phase !== "finished" ||
      !review.available ||
      !review.assessedOn
    )
      return false;
    if (
      evidence.phase !== "finished" ||
      review.chosen.length === 0 ||
      review.chosen.length > FOLLOWUPS_REVIEW_LIMIT
    )
      return false;
    if (
      evidence.rows.length !== review.chosen.length ||
      !context.catalog ||
      !context.saveState.saved
    )
      return false;
    const entries = review.chosen.map((row) => row.entry);
    if (!parseResearchFollowupsPayload({ schemaVersion: 1, entries }))
      return false;
    if (
      !review.chosen.every(
        (row, i) =>
          row.handle === evidence.rows[i]!.handle &&
          row.entry === evidence.rows[i]!.entry &&
          context.draft.entries.includes(row.entry) &&
          row.entry.catalogSnapshotSha256 === context.catalog,
      )
    )
      return false;
    return evidence.rows.every(({ entry, reading }) =>
      validText({ entry, reading }),
    );
  } catch {
    return false;
  }
}
/** Copies only chosen passive data. The source, not this object, owns action freshness. */
export function prepareDueCheckEvidenceReport(
  review: FollowupsReviewState,
  evidence: FollowupsReviewEvidenceState,
  context: FollowupsReportContext,
  preparedAt: string,
): PreparedDueCheckEvidenceReport | null {
  try {
    if (!dueCheckEvidenceReportReady(review, evidence, context)) return null;
    const data: PreparedDueCheckEvidenceReport = {
      kind: "due_check_evidence_review",
      preparedAt: requiredDraftFileTime(preparedAt),
      assessedOn: review.assessedOn!,
      rows: evidence.rows.map(({ entry, reading }) => ({ entry, reading })),
      resource: {
        baseVersion: context.baseVersion,
        savedVersion: context.saveState.saved!.version,
        dirty: context.saveState.dirty,
        catalog: context.catalog!,
      },
    };
    if (!validText(data)) return null;
    const report = freeze(structuredClone(data));
    reports.add(report);
    return report;
  } catch {
    return null;
  }
}
