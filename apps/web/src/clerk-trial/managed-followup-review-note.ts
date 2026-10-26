import {
  normalizeResearchFollowupCheck,
  normalizeResearchFollowupResult,
  normalizeWatchlistNote,
  type ResearchFollowup,
} from "@research-cockpit/contracts";
import { isResearchFollowupDueDate } from "./managed-research-followups-date";
import { requiredDraftFileTime } from "./managed-watchlist-draft-file-validation";

export interface FollowupReviewNoteText {
  readonly note: string;
  readonly excerpt: string;
  readonly recordedAt: string;
}
export interface FollowupReviewNotePreparation {
  readonly preview: Readonly<FollowupReviewNoteText> | null;
  readonly reason: string | null;
}
interface NoteInput {
  readonly entry: ResearchFollowup;
  readonly note: string;
  readonly recordedAt: string;
}
const refuse = (reason: string): FollowupReviewNotePreparation => ({
  preview: null,
  reason,
});
function validRaw(value: string, limit: number): boolean {
  return (
    [...value].length <= limit &&
    !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value) &&
    normalizeWatchlistNote(value) !== null
  );
}
function validCheck(entry: ResearchFollowup): boolean {
  if (!validRaw(entry.check, 500)) return false;
  if (normalizeResearchFollowupCheck(entry.check) === null) return false;
  if (!isResearchFollowupDueDate(entry.dueOn)) return false;
  return (
    entry.status !== "completed" || isResearchFollowupDueDate(entry.completedOn)
  );
}
function validRecordedAt({ recordedAt }: NoteInput): boolean {
  try {
    requiredDraftFileTime(recordedAt);
    return isResearchFollowupDueDate(recordedAt.slice(0, 10));
  } catch {
    return false;
  }
}
function inputReason(input: NoteInput): string | null {
  const { entry, note } = input;
  if (!validCheck(entry))
    return "Correct the complete check and its dates in Follow-ups first.";
  if (
    !validRaw(entry.result, 2_000) ||
    !normalizeResearchFollowupResult(entry.result)
  )
    return "Write a valid, nonempty assessment in Follow-ups first.";
  if (!validRaw(note, 2_000))
    return "Correct the current company note before adding an assessment.";
  if (!validRecordedAt(input))
    return "The authored assessment time is unavailable. Preview again.";
  return null;
}
function assessmentContent(entry: ResearchFollowup): string {
  const state =
    entry.status === "completed"
      ? `Completed on (UTC): ${entry.completedOn}`
      : "State: open";
  return `Follow-up assessment for ${entry.listing.symbol} (${entry.listing.shareClassName}, ${entry.listing.exchangeMic}). Question: ${entry.check} | Due date (UTC): ${entry.dueOn} | ${state} | My assessment: ${entry.result}`;
}
function hasRecordedAssessment({ note }: NoteInput, content: string): boolean {
  // Compare canonical text without the new clock; keep both drafts' raw text.
  return note
    .normalize("NFC")
    .includes(
      `${content} | Authored assessment recorded at (UTC): `.normalize("NFC"),
    );
}
function completeProposal(
  input: NoteInput,
  content: string,
): FollowupReviewNotePreparation {
  const { note, recordedAt } = input;
  if (hasRecordedAssessment(input, content))
    return refuse(
      "This complete assessment is already in the company note draft.",
    );
  const excerpt = `${content} | Authored assessment recorded at (UTC): ${recordedAt}. Authored text; original source dates remain unchanged.`;
  const candidate = note ? `${note} ${excerpt}` : excerpt;
  if (!validRaw(candidate, 2_000))
    return refuse(
      "The complete note exceeds the 2,000-character single-line limit. Nothing was clipped or changed.",
    );
  return {
    preview: Object.freeze({ note: candidate, excerpt, recordedAt }),
    reason: null,
  };
}

/** Complete authored text only. No source clock, draft or saved record is changed. */
export function prepareFollowupReviewNote(
  input: NoteInput,
): FollowupReviewNotePreparation {
  const reason = inputReason(input);
  if (reason) return refuse(reason);
  return completeProposal(input, assessmentContent(input.entry));
}
