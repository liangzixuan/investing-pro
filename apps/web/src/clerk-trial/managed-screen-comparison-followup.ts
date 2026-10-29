import {
  membershipMatchesResult,
  normalizeResearchFollowupCheck,
  type ManagedEodIdentity,
  type ResearchFollowup,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type {
  ManagedResearchFollowups,
  NextCheckCapture,
} from "./managed-research-followups";
import {
  isPreparedScreenComparisonReport,
  type PreparedScreenComparisonReport,
} from "./screen-comparison-report";

export type ScreenComparisonFollowupSide = "left" | "right";
export interface ScreenComparisonFollowupCapture {
  readonly comparison: PreparedScreenComparisonReport;
  readonly isCurrent: () => boolean;
}
export interface ScreenComparisonFollowupDestination {
  readonly side: ScreenComparisonFollowupSide;
  readonly listing: ManagedEodIdentity;
  readonly eligible: boolean;
  readonly reason: string | null;
}
export interface ScreenComparisonFollowupPort {
  readonly model: Pick<
    ManagedResearchFollowups,
    "prepareNextCheck" | "createNextCheck"
  >;
  readonly member: WatchlistMembership;
  readonly comparison: PreparedScreenComparisonReport;
  readonly side: ScreenComparisonFollowupSide;
  readonly isCurrent: () => boolean;
}
export interface ScreenComparisonFollowupChoice {
  readonly question: string;
  readonly dueOn: string;
}
export interface ScreenComparisonFollowupPreview {
  readonly comparison: PreparedScreenComparisonReport;
  readonly side: ScreenComparisonFollowupSide;
  readonly listing: NextCheckCapture["listing"];
  readonly catalogSnapshotSha256: NextCheckCapture["digest"];
  readonly check: string;
  readonly dueOn: string;
  readonly isCurrent: () => boolean;
  readonly create: () => ResearchFollowup | null;
  readonly cancel: () => void;
}
export interface ScreenComparisonFollowupPreparation {
  readonly preview: ScreenComparisonFollowupPreview | null;
  readonly reason: string | null;
}
const stale =
  "The comparison, company, question, date or draft context changed. Preview the current check again.";
const refuse = (reason: string): ScreenComparisonFollowupPreparation => ({
  preview: null,
  reason,
});

/** A saved reference identifies the reviewed pair; it does not contain its source packets. */
export function screenComparisonFollowupReference(
  comparison: PreparedScreenComparisonReport,
): string | null {
  if (!isPreparedScreenComparisonReport(comparison)) return null;
  return (
    "Comparison reference: " +
    comparison.left.listing.listingId +
    " / " +
    comparison.right.listing.listingId +
    "; captured " +
    comparison.preparedAt +
    ". Full criteria, statements and source evidence not included."
  );
}
function completeQuestion(
  question: string,
  comparison: PreparedScreenComparisonReport,
) {
  if (typeof question !== "string") return null;
  if (/[\p{Cc}\p{Cf}\p{Cs}]/u.test(question)) return null;
  if (normalizeResearchFollowupCheck(question) === null) return null;
  const reference = screenComparisonFollowupReference(comparison);
  if (reference === null) return null;
  const check = "Question: " + question + " | " + reference;
  if ([...check].length > 500) return null;
  return normalizeResearchFollowupCheck(check);
}
function permanentCurrent(
  hostCurrent: () => boolean,
  formCurrent: () => boolean,
) {
  let retired = false;
  return () => {
    if (retired) return false;
    try {
      if (!hostCurrent()) retired = true;
      else if (!formCurrent()) retired = true;
      else retired = !hostCurrent();
    } catch {
      retired = true;
    }
    return !retired;
  };
}
function destinationMatches(port: ScreenComparisonFollowupPort) {
  if (port.side !== "left" && port.side !== "right") return false;
  if (!isPreparedScreenComparisonReport(port.comparison)) return false;
  return membershipMatchesResult(
    port.member,
    port.comparison[port.side].listing,
  );
}
function ownedPreview(
  port: ScreenComparisonFollowupPort,
  capture: NextCheckCapture,
  current: () => boolean,
  create: ManagedResearchFollowups["createNextCheck"],
): ScreenComparisonFollowupPreview {
  let consumed = false;
  const available = () => !consumed && current();
  const preview: ScreenComparisonFollowupPreview = Object.freeze({
    comparison: port.comparison,
    side: port.side,
    listing: capture.listing,
    catalogSnapshotSha256: capture.digest,
    check: capture.check,
    dueOn: capture.dueOn,
    isCurrent() {
      return this === preview && available();
    },
    cancel() {
      if (this === preview) consumed = true;
    },
    create() {
      if (this !== preview) return null;
      if (!available()) return null;
      consumed = true;
      try {
        return create(capture, current);
      } catch {
        return null;
      }
    },
  });
  return preview;
}
/** Prepare the complete question once. Existing Follow-ups owns the only draft mutation. */
export function prepareScreenComparisonFollowup(
  requested: ScreenComparisonFollowupPort,
  choice: ScreenComparisonFollowupChoice,
  formIsCurrent: () => boolean,
): ScreenComparisonFollowupPreparation {
  const port = Object.freeze({ ...requested });
  const question = choice.question;
  const dueOn = choice.dueOn;
  const current = permanentCurrent(port.isCurrent, formIsCurrent);
  if (!current()) return refuse(stale);
  if (!destinationMatches(port))
    return refuse(
      "Choose an exact current Watchlist company from this compared pair.",
    );
  const check = completeQuestion(question, port.comparison);
  if (check === null)
    return refuse(
      "The whole question and comparison reference must fit within 500 characters on one line. Nothing was clipped.",
    );
  const prepare = port.model.prepareNextCheck.bind(port.model);
  const create = port.model.createNextCheck.bind(port.model);
  const prepared = prepare(port.member, check, dueOn);
  if (!current()) return refuse(stale);
  const capture = prepared.capture;
  if (!capture)
    return refuse(
      prepared.reason ?? "Review Follow-ups before creating this check.",
    );
  if (capture.digest !== port.comparison.catalogSnapshotSha256)
    return refuse(stale);
  return {
    preview: ownedPreview(port, capture, current, create),
    reason: null,
  };
}
