import type { ResearchWatchlistState } from "./managed-workspace";
import { ManagedNoteEditor } from "./ManagedNoteEditor";

/** Edits the watchlist draft; the existing watchlist screen owns explicit saves. */
export function ManagedResearchNote({
  state,
  symbol,
  onAdd,
  onNote,
  onReview,
}: {
  state: ResearchWatchlistState;
  symbol: string;
  onAdd: () => void;
  onNote: (note: string) => void;
  onReview: () => void;
}) {
  return (
    <section aria-labelledby="managed-research-note-heading">
      <h3 id="managed-research-note-heading">My Watchlist note</h3>
      <div className="trial-actions">
        <button
          className="trial-secondary"
          disabled={!state.canAdd}
          onClick={onAdd}
        >
          {state.member ? "In watchlist draft" : "Add to watchlist draft"}
        </button>
        <button className="trial-secondary" onClick={onReview}>
          Review in My Watchlist
        </button>
      </div>
      {state.member && (
        <div className="managed-research-note-editor">
          <ManagedNoteEditor
            id="managed-research-note"
            listingId={state.member.listingId}
            symbol={symbol}
            note={state.member.note}
            disabled={!state.canEdit}
            helpId="managed-research-note-help"
            onChange={onNote}
          />
        </div>
      )}
      <p id="managed-research-note-help">
        Notes support up to 2,000 characters. This is your watchlist draft.
        Review and save all watchlist changes in My Watchlist.
      </p>
      {state.reason && <p role="status">{state.reason}</p>}
    </section>
  );
}
