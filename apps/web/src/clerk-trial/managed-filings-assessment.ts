import {
  MANAGED_RESEARCH_FOLLOWUPS_LIMITS,
  membershipMatchesResult,
  normalizeResearchFollowupResult,
  type ManagedSecFilingsResponseDto,
  type PersonalSecRecentFilingDto,
  type ResearchFollowup,
} from "@research-cockpit/contracts";
import { filingReferenceNoteExcerpt } from "./managed-filings-note";

export interface FilingsAssessmentPort {
  readonly entry: ResearchFollowup;
  readonly response: ManagedSecFilingsResponseDto;
  readonly showingPrevious: boolean;
  readonly isCurrent: () => boolean;
  readonly editAssessment: (raw: string) => boolean;
}
export interface FilingsAssessmentPreview {
  readonly result: string;
  readonly citation: string;
  readonly entry: ResearchFollowup;
  readonly listing: ResearchFollowup["listing"];
  readonly catalogSnapshotSha256: ResearchFollowup["catalogSnapshotSha256"];
  readonly response: ManagedSecFilingsResponseDto;
  readonly filing: PersonalSecRecentFilingDto;
  readonly showingPrevious: boolean;
  readonly isCurrent: () => boolean;
  readonly apply: () => boolean;
  readonly cancel: () => void;
}
export interface FilingsAssessmentPreparation {
  readonly preview: Readonly<FilingsAssessmentPreview> | null;
  readonly reason: string | null;
}
const ports = new WeakSet<FilingsAssessmentPort>();
const stale =
  "The filing, check or current visit changed. Preview the current assessment again.";
const refuse = (reason: string): FilingsAssessmentPreparation => ({
  preview: null,
  reason,
});

/** Workspace-only authority: copied ports cannot borrow a different source. */
export function createFilingsAssessmentPort(
  port: FilingsAssessmentPort,
): Readonly<FilingsAssessmentPort> | null {
  if (!port.isCurrent()) return null;
  if (!sourceMatches(port)) return null;
  if (port.response.issuer.status !== "available") return null;
  if (typeof port.showingPrevious !== "boolean") return null;
  let retired = false;
  const owned = Object.freeze({
    ...port,
    isCurrent: () => {
      if (retired) return false;
      retired = !port.isCurrent();
      return !retired;
    },
  });
  if (!owned.isCurrent()) return null;
  ports.add(owned);
  return owned;
}
function sourceMatches(port: FilingsAssessmentPort): boolean {
  if (port.entry.catalogSnapshotSha256 !== port.response.catalogSnapshotSha256)
    return false;
  return membershipMatchesResult(
    { ...port.entry.listing, note: "" },
    port.response.security,
  );
}
function validRawResult(raw: string): boolean {
  if (/[\p{Cc}\p{Cf}\p{Cs}]/u.test(raw)) return false;
  if ([...raw].length > MANAGED_RESEARCH_FOLLOWUPS_LIMITS.resultCodePoints)
    return false;
  return normalizeResearchFollowupResult(raw) !== null;
}
function proposedResult(
  raw: string,
  citation: string,
): { result: string | null; reason: string | null } {
  if (!raw.trim())
    return {
      result: null,
      reason:
        "Write your assessment for this check before adding a filing reference.",
    };
  if (!validRawResult(raw))
    return {
      result: null,
      reason:
        "Correct the assessment before adding evidence. No text was changed.",
    };
  if (raw.includes(citation))
    return {
      result: null,
      reason: "This exact filing reference is already in the assessment draft.",
    };
  const result = raw + " " + citation;
  return validRawResult(result)
    ? { result, reason: null }
    : {
        result: null,
        reason:
          "The complete assessment and filing reference must fit within 2,000 characters on one line. Nothing was clipped or changed.",
      };
}
function permanentCurrent(
  port: FilingsAssessmentPort,
  formIsCurrent: () => boolean,
): () => boolean {
  let retired = false;
  return () => {
    if (retired) return false;
    retired = !port.isCurrent() || !formIsCurrent() || !port.isCurrent();
    return !retired;
  };
}
function preview(
  port: FilingsAssessmentPort,
  filing: PersonalSecRecentFilingDto,
  citation: string,
  result: string,
  current: () => boolean,
): Readonly<FilingsAssessmentPreview> {
  let consumed = false;
  const available = () => !consumed && current();
  return Object.freeze({
    result,
    citation,
    entry: port.entry,
    listing: port.entry.listing,
    catalogSnapshotSha256: port.entry.catalogSnapshotSha256,
    response: port.response,
    filing,
    showingPrevious: port.showingPrevious,
    isCurrent: available,
    cancel: () => {
      consumed = true;
    },
    apply() {
      if (!available()) return false;
      consumed = true;
      return port.editAssessment(result);
    },
  });
}
/** Whole qualified source text appends only to an existing authored result. */
export function prepareFilingsAssessment(
  port: FilingsAssessmentPort,
  filing: PersonalSecRecentFilingDto,
  formIsCurrent: () => boolean,
): FilingsAssessmentPreparation {
  if (!ports.has(port)) return refuse(stale);
  const current = permanentCurrent(port, formIsCurrent);
  if (!current()) return refuse(stale);
  if (!sourceMatches(port)) return refuse(stale);
  const citation = filingReferenceNoteExcerpt(
    port.response,
    filing,
    port.showingPrevious,
  );
  if (citation === null)
    return refuse("Choose an observed filing from the current loaded packet.");
  const proposal = proposedResult(port.entry.result, citation);
  if (proposal.result === null) return refuse(proposal.reason!);
  if (!current()) return refuse(stale);
  return {
    preview: preview(port, filing, citation, proposal.result, current),
    reason: null,
  };
}
