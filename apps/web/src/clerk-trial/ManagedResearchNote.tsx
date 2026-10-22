import type { ResearchWatchlistState } from "./managed-workspace";
import { ManagedNoteEditor } from "./ManagedNoteEditor";
import { ManagedThesisReview } from "./ManagedThesisReview";
import type { ThesisFollowupContext } from "./managed-thesis-followup";

/** Edits the watchlist draft; the existing watchlist screen owns explicit saves. */
export function ManagedResearchNote({
  state,
  navigationPending,
  symbol,
  onAdd,
  onNote,
  onReview,
  followup,
}: {
  state: ResearchWatchlistState;
  navigationPending: boolean;
  symbol: string;
  onAdd: () => void;
  onNote: (note: string, expectedNote?: string) => void;
  onReview: () => void;
  followup?: ThesisFollowupContext | undefined;
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
        <button
          className="trial-secondary"
          disabled={navigationPending}
          onClick={onReview}
        >
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
        Up to 2,000 characters. Edit your watchlist draft here, then review and
        save all changes in My Watchlist.
      </p>
      {state.member && (
        <ManagedThesisReview
          key={state.member.listingId}
          id="managed-research-note"
          symbol={symbol}
          note={state.member.note}
          disabled={!state.canEdit || navigationPending}
          onChange={onNote}
          {...(followup ? { followup } : {})}
        />
      )}
      {state.reason && <p role="status">{state.reason}</p>}
    </section>
  );
}
