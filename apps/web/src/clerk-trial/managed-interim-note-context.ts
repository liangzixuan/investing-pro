import type {
  PersonalSecInterimCanonicalResponseDto,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedInterimReportState } from "./managed-interim-report";
import type { ResearchWatchlistState } from "./managed-workspace";
import {
  prepareManagedInterimStatementsNote,
  type ManagedInterimCellSelection,
} from "./managed-interim-statements-note";
interface Context {
  readonly response: PersonalSecInterimCanonicalResponseDto;
  readonly cells: readonly ManagedInterimCellSelection[];
  readonly source: () => ManagedInterimReportState;
  readonly watchlist: () => ResearchWatchlistState;
  readonly visitCurrent: () => boolean;
  readonly selectionCurrent: () => boolean;
  readonly apply: (note: string, previous: string) => void;
}
interface Capture {
  readonly context: Context;
  readonly source: ManagedInterimReportState;
  readonly watchlist: ResearchWatchlistState;
  readonly member: WatchlistMembership;
}
function admittedSource(
  source: ManagedInterimReportState,
  response: PersonalSecInterimCanonicalResponseDto,
) {
  if (source.response !== response) return false;
  if (source.running || source.catalogChanged) return false;
  return source.view?.canonical === response.evidence;
}
function watchlistCurrent(capture: Capture) {
  const current = capture.context.watchlist();
  return (
    current.canEdit &&
    current.revision === capture.watchlist.revision &&
    current.member === capture.member
  );
}
function workspaceCurrent(capture: Capture) {
  if (!capture.context.visitCurrent()) return false;
  if (capture.context.source() !== capture.source) return false;
  if (!admittedSource(capture.source, capture.context.response)) return false;
  return watchlistCurrent(capture);
}
function captureCurrent(capture: Capture) {
  return (
    workspaceCurrent(capture) &&
    capture.context.selectionCurrent() &&
    workspaceCurrent(capture)
  );
}
function applyCapturedNote(capture: Capture, note: string) {
  if (!captureCurrent(capture))
    throw new Error("Statement note capture changed.");
  capture.context.apply(note, capture.member.note);
  if (capture.context.watchlist().member?.note !== note)
    throw new Error("Statement note could not be applied.");
}
export function captureManagedInterimNote(context: Context) {
  const watchlist = context.watchlist();
  if (!watchlist.canEdit || !watchlist.member)
    return {
      preview: null,
      reason:
        watchlist.reason ??
        "Add this company to the watchlist draft before preparing statement cells.",
    };
  const capture: Capture = {
    context,
    watchlist,
    source: context.source(),
    member: watchlist.member,
  };
  return prepareManagedInterimStatementsNote({
    response: context.response,
    selection: context.cells,
    note: capture.member.note,
    showingPrevious: capture.source.showingPrevious,
    isCurrent: () => captureCurrent(capture),
    apply: (note) => applyCapturedNote(capture, note),
  });
}
