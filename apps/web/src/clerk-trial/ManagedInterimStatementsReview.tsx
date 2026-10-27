import { useLayoutEffect, useRef, useState } from "react";
import type { PersonalSecInterimCanonicalResponseDto } from "@research-cockpit/contracts";
import { getManagedInterimView } from "./managed-interim-view";
import {
  InterimSourceContext,
  InterimStatementRows,
  interimStatementIds,
  interimStatementLabels,
  interimStatementOrder,
} from "./InterimStatementsReportView";
import {
  useInterimStatementsReview,
  type ManagedInterimStatementsActions,
} from "./use-interim-statements-review";
export type { ManagedInterimStatementsActions } from "./use-interim-statements-review";
function NotePreview({ value }: { readonly value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    const resize = () => {
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight + 2}px`;
    };
    resize();
    let width = field.getBoundingClientRect().width;
    const observe = () => {
      const next = field.getBoundingClientRect().width;
      if (next === width) return;
      width = next;
      resize();
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(observe);
    observer?.observe(field);
    return () => observer?.disconnect();
  }, [value]);
  return (
    <textarea
      id="managed-interim-note-preview"
      aria-label="Complete interim note preview"
      value={value}
      readOnly
      rows={6}
      ref={ref}
      style={{ overflow: "hidden", resize: "none" }}
    />
  );
}

function InterimNotePanel({
  state,
  blockedReason,
}: {
  readonly state: ReturnType<typeof useInterimStatementsReview>;
  readonly blockedReason: string | null;
}) {
  const { preview, current } = state;
  return (
    <details className="managed-interim-note" onToggle={state.close}>
      <summary>Review selected interim cells ({state.keys.length})</summary>
      <p>
        Preview the complete existing note and proposed addition. Appending
        changes only the note draft; Save My Watchlist remains separate.
      </p>
      {blockedReason && <p role="status">{blockedReason}</p>}
      <button
        type="button"
        id="interim-note-preview"
        disabled={blockedReason !== null || state.keys.length === 0}
        onClick={state.prepare}
      >
        Preview complete note
      </button>
      {preview && <PreparedInterimNote state={state} />}
      {preview && !current && (
        <p role="status">
          The report, selection, note or visit changed. Preview the complete
          note again.
        </p>
      )}
      {state.reason && <p role="status">{state.reason}</p>}
      {state.message && (
        <p id="interim-note-status" role="status">
          {state.message}
        </p>
      )}
    </details>
  );
}
function PreparedInterimNote({
  state,
}: {
  readonly state: ReturnType<typeof useInterimStatementsReview>;
}) {
  const preview = state.preview!;
  return (
    <>
      <NotePreview value={preview.note} />
      <p>
        {[...preview.note].length} / 2,000 code points. Full raw note, source
        identity and reported periods are preserved.
      </p>
      <button
        type="button"
        id="interim-note-append"
        disabled={!state.current}
        onClick={state.append}
      >
        Append to note draft
      </button>
      <button
        type="button"
        className="trial-secondary"
        id="interim-note-cancel"
        onClick={state.cancel}
      >
        Cancel note preview
      </button>
    </>
  );
}
export function ManagedInterimStatementsReview({
  response,
  actions,
  blockedReason,
}: {
  readonly response: PersonalSecInterimCanonicalResponseDto;
  readonly actions: ManagedInterimStatementsActions;
  readonly blockedReason: string | null;
}) {
  const view = getManagedInterimView(response)!;
  const state = useInterimStatementsReview(response, blockedReason, actions);
  const [tab, setTab] =
    useState<(typeof interimStatementOrder)[number]>("income_statement");
  return (
    <section
      className="managed-interim-review"
      aria-label="Review interim statement cells"
    >
      <InterimSourceContext evidence={response.evidence} />
      <nav aria-label="Interim concept views">
        {interimStatementOrder.map((id) => (
          <button
            type="button"
            className="trial-secondary"
            key={id}
            id={`interim-view-${interimStatementIds[id]}`}
            aria-pressed={tab === id}
            aria-controls={`interim-table-${interimStatementIds[id]}`}
            onClick={() => setTab(id)}
          >
            {interimStatementLabels[id]}
          </button>
        ))}
      </nav>
      <div id={`interim-table-${interimStatementIds[tab]}`}>
        <InterimStatementRows
          evidence={response.evidence}
          statement={view.statements.statements.find(
            (statement) => statement.id === tab,
          )!}
          selected={state.keys}
          onToggle={state.toggle}
          disabled={blockedReason !== null}
        />
      </div>
      <InterimNotePanel state={state} blockedReason={blockedReason} />
    </section>
  );
}
