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

/** Complete authored text only. No source clock, draft or saved record is changed. */
export function prepareFollowupReviewNote(input: {
  readonly entry: ResearchFollowup;
  readonly note: string;
  readonly recordedAt: string;
}): FollowupReviewNotePreparation {
  const { entry, note, recordedAt } = input;
  if (
    !validRaw(entry.check, 500) ||
    normalizeResearchFollowupCheck(entry.check) === null ||
    !isResearchFollowupDueDate(entry.dueOn) ||
    (entry.status === "completed" &&
      !isResearchFollowupDueDate(entry.completedOn))
  )
    return refuse(
      "Correct the complete check and its dates in Follow-ups first.",
    );
  if (
    !validRaw(entry.result, 2_000) ||
    !normalizeResearchFollowupResult(entry.result)
  )
    return refuse("Write a valid, nonempty assessment in Follow-ups first.");
  if (!validRaw(note, 2_000))
    return refuse(
      "Correct the current company note before adding an assessment.",
    );
  try {
    requiredDraftFileTime(recordedAt);
    if (!isResearchFollowupDueDate(recordedAt.slice(0, 10))) throw new Error();
  } catch {
    return refuse(
      "The authored assessment time is unavailable. Preview again.",
    );
  }
  const state =
    entry.status === "completed"
      ? `Completed on (UTC): ${entry.completedOn}`
      : "State: open";
  // Exclude the new capture clock when checking for an already appended assessment.
  const content = `Follow-up assessment for ${entry.listing.symbol} (${entry.listing.shareClassName}, ${entry.listing.exchangeMic}). Question: ${entry.check} | Due date (UTC): ${entry.dueOn} | ${state} | My assessment: ${entry.result}`;
  if (
    note
      .normalize("NFC")
      .includes(
        `${content} | Authored assessment recorded at (UTC): `.normalize("NFC"),
      )
  )
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
