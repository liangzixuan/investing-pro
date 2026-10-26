import {
  parseResearchFollowupsPayload,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import {
  requireDraftFile,
  requiredDraftFileHash,
  requiredDraftFileRecord,
  requiredDraftFileTime,
  requiredDraftFileVersion,
} from "./managed-watchlist-draft-file-validation";

export interface FollowupsReviewReportInput {
  readonly capturedAt: string;
  readonly draft: ResearchFollowupsPayload;
  readonly baseVersion: number;
  readonly dirty: boolean;
  readonly currentCatalogSnapshotSha256: string | null;
}
export interface PreparedFollowupsReviewReport extends FollowupsReviewReportInput {
  readonly kind: "followups_review";
}
const INPUT_KEYS = [
  "capturedAt",
  "draft",
  "baseVersion",
  "dirty",
  "currentCatalogSnapshotSha256",
] as const;
const owned = new WeakSet<object>();

export function isPreparedFollowupsReviewReport(
  value: unknown,
): value is PreparedFollowupsReviewReport {
  return typeof value === "object" && value !== null && owned.has(value);
}

/** Own the complete valid authored draft without normalizing or saving it. */
export function prepareFollowupsReviewReport(
  input: FollowupsReviewReportInput,
): PreparedFollowupsReviewReport | null {
  try {
    const fields = requiredDraftFileRecord(input, INPUT_KEYS);
    const draft = parseResearchFollowupsPayload(fields.draft);
    requireDraftFile(draft !== null);
    requireDraftFile(typeof fields.dirty === "boolean");
    const report: PreparedFollowupsReviewReport = Object.freeze({
      kind: "followups_review",
      capturedAt: requiredDraftFileTime(fields.capturedAt),
      draft,
      baseVersion: requiredDraftFileVersion(fields.baseVersion),
      dirty: fields.dirty,
      currentCatalogSnapshotSha256:
        fields.currentCatalogSnapshotSha256 === null
          ? null
          : requiredDraftFileHash(fields.currentCatalogSnapshotSha256),
    });
    owned.add(report);
    return report;
  } catch {
    return null;
  }
}
