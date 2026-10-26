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
interface CapturedNote {
  readonly port: FollowupReviewNotePort;
  readonly watchlist: ResearchWatchlistState;
  readonly watchlistSaved: SaveState<MainWatchlistPayload>;
  readonly followupsSaved: SaveState<ResearchFollowupsPayload>;
  readonly reason: string | null;
}
const stale =
  "The check or company note changed. Preview the current drafts again.";
function captureReason(
  followup: ManagedResearchFollowupContext,
  watchlist: ResearchWatchlistState,
): string | null {
  if (!followup.editable)
    return (
      followup.reason ?? "Finish Follow-ups recovery before preparing a note."
    );
  if (!watchlist.member)
    return (
      watchlist.reason ??
      "This check has no existing company note. Add this exact company to My Watchlist separately first."
    );
  if (!watchlist.canEdit)
    return (
      watchlist.reason ??
      "Finish My Watchlist recovery before preparing a note."
    );
  return null;
}
function visitIsCurrent({ port, reason }: CapturedNote): boolean {
  return (
    reason === null &&
    port.followup.isCurrent() &&
    port.routeActive() &&
    port.canEditFollowups()
  );
}
function sameWatchlist(
  current: ResearchWatchlistState,
  captured: ResearchWatchlistState,
): boolean {
  return (
    current.canEdit &&
    current.member === captured.member &&
    current.revision === captured.revision
  );
}
function sameSaveStates({
  port,
  watchlistSaved,
  followupsSaved,
}: CapturedNote): boolean {
  return (
    port.watchlistSaved() === watchlistSaved &&
    port.followupsSaved() === followupsSaved
  );
}
function permanentCurrent(captured: CapturedNote): () => boolean {
  let retired = false;
  return () => {
    if (retired) return false;
    const current = captured.port.watchlist();
    retired =
      !visitIsCurrent(captured) ||
      !sameWatchlist(current, captured.watchlist) ||
      !sameSaveStates(captured);
    return !retired;
  };
}
function recordedTime(now: () => Date): string | null {
  try {
    return now().toISOString();
  } catch {
    return null;
  }
}
function consumeOnce(
  text: Readonly<FollowupReviewNoteText>,
  member: NonNullable<ResearchWatchlistState["member"]>,
  port: FollowupReviewNotePort,
  isCurrent: () => boolean,
): Readonly<FollowupReviewNotePreview> {
  let consumed = false;
  const current = () => !consumed && isCurrent();
  return Object.freeze({
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
}
function prepareCapturedNote(
  captured: CapturedNote,
  isCurrent: () => boolean,
  now: () => Date,
): ReturnType<FollowupReviewNoteContext["prepare"]> {
  const { port, watchlist, reason } = captured;
  const member = watchlist.member;
  if (reason || !member || !isCurrent())
    return { preview: null, reason: reason ?? stale };
  const recordedAt = recordedTime(now);
  if (recordedAt === null)
    return {
      preview: null,
      reason: "The authored assessment time is unavailable.",
    };
  const prepared = prepareFollowupReviewNote({
    entry: port.followup.entry,
    note: member.note,
    recordedAt,
  });
  if (!isCurrent()) return { preview: null, reason: stale };
  if (!prepared.preview) return { preview: null, reason: prepared.reason };
  return {
    preview: consumeOnce(prepared.preview, member, port, isCurrent),
    reason: null,
  };
}

/** One cross-draft capability. Both original resources retain their own Save. */
export function captureFollowupReviewNoteContext(
  port: FollowupReviewNotePort,
): FollowupReviewNoteContext {
  const watchlist = port.watchlist();
  const watchlistSaved = port.watchlistSaved();
  const followupsSaved = port.followupsSaved();
  const reason = captureReason(port.followup, watchlist);
  const captured = { port, watchlist, watchlistSaved, followupsSaved, reason };
  const isCurrent = permanentCurrent(captured);
  return Object.freeze({
    entry: port.followup.entry,
    reason,
    prepare: (now: () => Date = () => new Date()) =>
      prepareCapturedNote(captured, isCurrent, now),
  });
}
