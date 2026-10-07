import { normalizeWatchlistNote } from "@research-cockpit/contracts";

/** Shows save-policy feedback while preserving the raw shared draft. */
export function ManagedNoteEditor({
  id,
  listingId,
  symbol,
  note,
  disabled,
  helpId,
  onChange,
}: {
  id: string;
  listingId: string;
  symbol: string;
  note: string;
  disabled: boolean;
  helpId: string;
  onChange: (note: string) => void;
}) {
  const invalid = normalizeWatchlistNote(note) === null;
  const errorId = `${id}-error`;
  return (
    <>
      <label htmlFor={id}>Research note for {symbol}</label>
      <textarea
        id={id}
        data-managed-note-listing-id={listingId}
        rows={3}
        maxLength={4000}
        value={note}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${helpId} ${errorId}` : helpId}
        onChange={(event) => onChange(event.target.value)}
      />
      <div id={errorId} role="status" aria-live="polite">
        {invalid
          ? "Use at most 2,000 characters. Remove embedded line breaks and unsupported characters."
          : null}
      </div>
    </>
  );
}
