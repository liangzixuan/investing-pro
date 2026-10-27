import type { PersonalSecInterimCanonicalResponseDto } from "@research-cockpit/contracts";
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
function admittedSource(
  source: ManagedInterimReportState,
  response: PersonalSecInterimCanonicalResponseDto,
) {
  if (source.response !== response) return false;
  if (source.running || source.catalogChanged) return false;
  return source.view?.canonical === response.evidence;
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
  const source = context.source(),
    member = watchlist.member;
  const workspaceCurrent = () => {
    if (!context.visitCurrent()) return false;
    if (context.source() !== source) return false;
    if (!admittedSource(source, context.response)) return false;
    const current = context.watchlist();
    return (
      current.canEdit &&
      current.revision === watchlist.revision &&
      current.member === member
    );
  };
  const isCurrent = () =>
    workspaceCurrent() && context.selectionCurrent() && workspaceCurrent();
  return prepareManagedInterimStatementsNote({
    response: context.response,
    selection: context.cells,
    note: member.note,
    showingPrevious: source.showingPrevious,
    isCurrent,
    apply: (note) => {
      if (!isCurrent()) throw new Error("Statement note capture changed.");
      context.apply(note, member.note);
      if (context.watchlist().member?.note !== note)
        throw new Error("Statement note could not be applied.");
    },
  });
}
