"use client";

export interface PersonalCompanyResearchNoteProps {
  readonly value: string;
  readonly disabled: boolean;
  readonly message: string | null;
  readonly onChange: (value: string) => void;
  readonly onSave: () => void;
}

export function PersonalCompanyResearchNote({
  value,
  disabled,
  message,
  onChange,
  onSave,
}: PersonalCompanyResearchNoteProps) {
  return (
    <div className="company-research-note">
      <label htmlFor="company-watchlist-note">My Watchlist research note</label>
      <p
        className="company-research-note-hint"
        id="company-watchlist-note-hint"
      >
        This is the same note shown in My Watchlist. Up to 2,000 characters;
        save changes explicitly.
      </p>
      <textarea
        aria-describedby="company-watchlist-note-hint company-watchlist-note-status"
        disabled={disabled}
        id="company-watchlist-note"
        maxLength={2000}
        onChange={(event) => onChange(event.currentTarget.value)}
        rows={4}
        value={value}
      />
      <div className="company-research-note-actions">
        <button
          className="secondary-action compact-action"
          disabled={disabled}
          onClick={onSave}
          type="button"
        >
          Save research note
        </button>
        <p
          aria-atomic="true"
          aria-live="polite"
          className="company-research-note-status"
          id="company-watchlist-note-status"
          role="status"
        >
          {message}
        </p>
      </div>
    </div>
  );
}
