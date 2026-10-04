import type { ResearchWatchlistState } from "./managed-workspace";

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
          <label htmlFor="managed-research-note">
            Research note for {symbol}
          </label>
          <textarea
            id="managed-research-note"
            rows={3}
            maxLength={4000}
            value={state.member.note}
            disabled={!state.canEdit}
            aria-describedby="managed-research-note-help"
            onChange={(event) => onNote(event.target.value)}
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
