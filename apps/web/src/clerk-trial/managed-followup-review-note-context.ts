import type {
  MainWatchlistPayload,
  ResearchFollowup,
  ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedResearchFollowupContext } from "./managed-research-followup-context";
import type { ResearchWatchlistState } from "./managed-workspace";
import type { SaveState } from "./save-coordinator";
import {
  prepareFollowupReviewNote,
  type FollowupReviewNoteText,
} from "./managed-followup-review-note";

export interface FollowupReviewNotePreview extends FollowupReviewNoteText {
  readonly isCurrent: () => boolean;
  readonly append: () => boolean;
  readonly cancel: () => void;
}
export interface FollowupReviewNoteContext {
  readonly entry: ResearchFollowup;
  readonly reason: string | null;
  readonly prepare: (now?: () => Date) => {
    readonly preview: Readonly<FollowupReviewNotePreview> | null;
    readonly reason: string | null;
  };
}
interface FollowupReviewNotePort {
  readonly followup: ManagedResearchFollowupContext;
  readonly watchlist: () => ResearchWatchlistState;
  readonly watchlistSaved: () => SaveState<MainWatchlistPayload>;
  readonly followupsSaved: () => SaveState<ResearchFollowupsPayload>;
  readonly canEditFollowups: () => boolean;
  readonly routeActive: () => boolean;
  readonly note: (note: string, expectedNote: string) => void;
}

/** One cross-draft capability. Both original resources retain their own Save. */
export function captureFollowupReviewNoteContext(
  port: FollowupReviewNotePort,
): FollowupReviewNoteContext {
  const { followup } = port;
  const watchlist = port.watchlist();
  const watchlistSaved = port.watchlistSaved();
  const followupsSaved = port.followupsSaved();
  const member = watchlist.member;
  const reason = !followup.editable
    ? (followup.reason ?? "Finish Follow-ups recovery before preparing a note.")
    : !member
      ? (watchlist.reason ??
        "This check has no existing company note. Add this exact company to My Watchlist separately first.")
      : !watchlist.canEdit
        ? (watchlist.reason ??
          "Finish My Watchlist recovery before preparing a note.")
        : null;
  let retired = false;
  const isCurrent = () => {
    if (retired) return false;
    const current = port.watchlist();
    retired =
      reason !== null ||
      !followup.isCurrent() ||
      !port.routeActive() ||
      !port.canEditFollowups() ||
      !current.canEdit ||
      current.member !== member ||
      current.revision !== watchlist.revision ||
      port.watchlistSaved() !== watchlistSaved ||
      port.followupsSaved() !== followupsSaved;
    return !retired;
  };
  return Object.freeze({
    entry: followup.entry,
    reason,
    prepare(now: () => Date = () => new Date()) {
      const stale =
        "The check or company note changed. Preview the current drafts again.";
      if (reason || !member || !isCurrent())
        return { preview: null, reason: reason ?? stale };
      let recordedAt: string;
      try {
        recordedAt = now().toISOString();
      } catch {
        return {
          preview: null,
          reason: "The authored assessment time is unavailable.",
        };
      }
      const prepared = prepareFollowupReviewNote({
        entry: followup.entry,
        note: member.note,
        recordedAt,
      });
      if (!isCurrent()) return { preview: null, reason: stale };
      if (!prepared.preview) return { preview: null, reason: prepared.reason };
      const text = prepared.preview;
      let consumed = false;
      const current = () => !consumed && isCurrent();
      const preview: Readonly<FollowupReviewNotePreview> = Object.freeze({
        ...text,
        isCurrent: current,
        cancel: () => {
          consumed = true;
        },
        append() {
          if (!current()) return false;
          consumed = true;
          port.note(text.note, member.note);
          return (
            port
              .watchlistSaved()
              .draft?.memberships.find(
                (item) => item.listingId === member.listingId,
              )?.note === text.note
          );
        },
      });
      return { preview, reason: null };
    },
  });
}
