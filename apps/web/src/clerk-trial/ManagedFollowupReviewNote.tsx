import { useLayoutEffect, useRef, useState } from "react";
import type {
  FollowupReviewNoteContext,
  FollowupReviewNotePreview,
} from "./managed-followup-review-note-context";

export function ManagedFollowupReviewNote({
  context,
}: {
  context: FollowupReviewNoteContext;
}) {
  const [state, setState] = useState<{
    preview: Readonly<FollowupReviewNotePreview> | null;
    message: string | null;
  }>({ preview: null, message: null });
  const committed = useRef<FollowupReviewNoteContext | null>(null);
  const active = useRef<Readonly<FollowupReviewNotePreview> | null>(null);
  useLayoutEffect(() => {
    committed.current = context;
    return () => {
      if (committed.current === context) committed.current = null;
    };
  });
  useLayoutEffect(() => () => active.current?.cancel(), []);
  const current = () => committed.current === context;
  const preview = state.preview?.isCurrent() ? state.preview : null;
  const clear = () => {
    active.current?.cancel();
    active.current = null;
    setState({ preview: null, message: null });
  };
  const stale = state.preview !== null && preview === null;
  return (
    <details
      className="managed-followup-review-note"
      onToggle={(event) => {
        if (current() && !event.currentTarget.open) clear();
      }}
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
        onClick={() => {
          if (!current()) return;
          active.current?.cancel();
          const result = context.prepare();
          active.current = result.preview;
          setState({ preview: result.preview, message: result.reason });
        }}
      >
        Preview complete note
      </button>
      {preview && (
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
            onClick={() => {
              if (!current() || active.current !== preview) return;
              const appended = preview.append();
              active.current = null;
              setState({
                preview: null,
                message: appended
                  ? "Assessment added to the company note draft. Review and save My Watchlist and Follow-ups separately."
                  : "The preview is no longer current. Nothing was added. Preview again.",
              });
            }}
          >
            Append assessment to note draft
          </button>
          <button
            type="button"
            className="trial-secondary"
            onClick={() => {
              if (current()) clear();
            }}
          >
            Keep current note
          </button>
        </div>
      )}
      <p role="status" aria-live="polite">
        {context.reason ??
          (stale
            ? "The preview no longer matches the current drafts. Preview again."
            : state.message)}
      </p>
    </details>
  );
}
