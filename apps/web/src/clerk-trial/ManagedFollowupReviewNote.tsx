import { useLayoutEffect, useRef, useState } from "react";
import type {
  FollowupReviewNoteContext,
  FollowupReviewNotePreview,
} from "./managed-followup-review-note-context";

type NotePreview = Readonly<FollowupReviewNotePreview>;
interface NoteState {
  preview: NotePreview | null;
  message: string | null;
}
interface NoteInteraction {
  readonly context: FollowupReviewNoteContext;
  readonly committed: { current: FollowupReviewNoteContext | null };
  readonly active: { current: NotePreview | null };
  readonly setState: (state: NoteState) => void;
}
function isCommitted(note: NoteInteraction): boolean {
  return note.committed.current === note.context;
}
function clearPreview(note: NoteInteraction) {
  note.active.current?.cancel();
  note.active.current = null;
  note.setState({ preview: null, message: null });
}
function preparePreview(note: NoteInteraction) {
  if (!isCommitted(note)) return;
  note.active.current?.cancel();
  const result = note.context.prepare();
  note.active.current = result.preview;
  note.setState({ preview: result.preview, message: result.reason });
}
function appendPreview(note: NoteInteraction, preview: NotePreview | null) {
  if (!isCommitted(note)) return;
  if (note.active.current !== preview) return;
  if (!preview) return;
  const appended = preview.append();
  note.active.current = null;
  note.setState({
    preview: null,
    message: appended
      ? "Assessment added to the company note draft. Review and save My Watchlist and Follow-ups separately."
      : "The preview is no longer current. Nothing was added. Preview again.",
  });
}
function cancelPreview(note: NoteInteraction) {
  if (isCommitted(note)) clearPreview(note);
}
function closeDisclosure(note: NoteInteraction, open: boolean) {
  if (isCommitted(note) && !open) clearPreview(note);
}
function useFollowupReviewNote(context: FollowupReviewNoteContext) {
  const [state, setState] = useState<NoteState>({
    preview: null,
    message: null,
  });
  const committed = useRef<FollowupReviewNoteContext | null>(null);
  const active = useRef<NotePreview | null>(null);
  useLayoutEffect(() => {
    committed.current = context;
    return () => {
      if (committed.current === context) committed.current = null;
    };
  });
  useLayoutEffect(() => () => active.current?.cancel(), []);
  const preview = state.preview?.isCurrent() ? state.preview : null;
  const stale = state.preview !== null && preview === null;
  const message =
    context.reason ??
    (stale
      ? "The preview no longer matches the current drafts. Preview again."
      : state.message);
  const interaction = { context, committed, active, setState };
  return {
    preview,
    message,
    prepare: () => preparePreview(interaction),
    append: () => appendPreview(interaction, preview),
    cancel: () => cancelPreview(interaction),
    close: (open: boolean) => closeDisclosure(interaction, open),
  };
}
function previewEditor(
  preview: Readonly<FollowupReviewNotePreview> | null,
  append: () => void,
  cancel: () => void,
) {
  if (!preview) return null;
  return (
    <div>
      <label htmlFor="managed-followup-note-preview">
        Complete company note preview
      </label>
      <textarea
        id="managed-followup-note-preview"
        className="managed-followup-note-preview"
        rows={8}
        readOnly
        value={preview.note}
      />
      <button
        id="managed-followup-note-append"
        type="button"
        className="trial-secondary"
        onClick={append}
      >
        Append assessment to note draft
      </button>
      <button type="button" className="trial-secondary" onClick={cancel}>
        Keep current note
      </button>
    </div>
  );
}
export function ManagedFollowupReviewNote({
  context,
}: {
  context: FollowupReviewNoteContext;
}) {
  const note = useFollowupReviewNote(context);
  return (
    <details
      className="managed-followup-review-note"
      onToggle={(event) => note.close(event.currentTarget.open)}
    >
      <summary>Keep assessment in company note</summary>
      <p>
        {context.entry.listing.symbol} · {context.entry.listing.shareClassName}{" "}
        · {context.entry.listing.exchangeMic}
      </p>
      <p className="managed-research-followup-help">
        Preview the complete company note with this question and your
        assessment. The recorded UTC time describes this authored capture.
        Source dates, due dates and completion dates stay unchanged. Append does
        not save either draft.
      </p>
      <button
        id="managed-followup-note-preview-action"
        type="button"
        className="trial-secondary"
        disabled={context.reason !== null}
        onClick={note.prepare}
      >
        Preview complete note
      </button>
      {previewEditor(note.preview, note.append, note.cancel)}
      <p role="status" aria-live="polite">
        {note.message}
      </p>
    </details>
  );
}
