"use client";

export interface PersonalCompanyWatchlistActionProps {
  readonly saved: boolean;
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly unavailableReason: string | null;
  readonly message: string | null;
  readonly onAdd: () => void;
}

export function PersonalCompanyWatchlistAction({
  saved,
  pending,
  disabled,
  unavailableReason,
  message,
  onAdd,
}: PersonalCompanyWatchlistActionProps) {
  return (
    <div className={saved ? undefined : "company-research-note"}>
      {!saved && (
        <p
          className="company-research-note-hint"
          id="company-watchlist-add-hint"
        >
          {unavailableReason ??
            "Add this company to My Watchlist to keep a research note."}
        </p>
      )}
      <div className="company-research-note-actions">
        {!saved && unavailableReason === null && (
          <button
            aria-busy={pending}
            aria-describedby="company-watchlist-add-hint company-watchlist-add-status"
            className="secondary-action compact-action"
            disabled={disabled || pending}
            id="company-watchlist-add"
            onClick={onAdd}
            type="button"
          >
            {pending ? "Adding…" : "Add to My Watchlist"}
          </button>
        )}
        <p
          aria-atomic="true"
          aria-live="polite"
          className="company-research-note-status"
          id="company-watchlist-add-status"
          role="status"
        >
          {message}
        </p>
      </div>
    </div>
  );
}
