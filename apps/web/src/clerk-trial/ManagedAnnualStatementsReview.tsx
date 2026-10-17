import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualStatements } from "@research-cockpit/personal-financial-analytics";
import { ManagedAnnualStatements } from "./ManagedAnnualStatements";
import type {
  ManagedAnnualStatementCellSelection,
  ManagedAnnualStatementsNotePreparation,
  PreparedManagedAnnualStatementsNote,
} from "./managed-annual-statements-note";

export interface ManagedAnnualStatementsReviewActions {
  /**
   * Combine selectionIsCurrent with the captured response, source/retained status,
   * exact listing/catalog, visit/session and opaque workspace/note revisions.
   * Every external edit, including edit then restore, must invalidate the capture.
   * The supplied guard owns only this view's choices, blocking and mounted lifetime.
   */
  prepare: (
    response: PersonalSecAnnualCanonicalResponseDto,
    selection: readonly ManagedAnnualStatementCellSelection[],
    selectionIsCurrent: () => boolean,
  ) => ManagedAnnualStatementsNotePreparation;
  isCurrent: (preview: PreparedManagedAnnualStatementsNote) => boolean;
  append: (preview: PreparedManagedAnnualStatementsNote) => {
    readonly appended: boolean;
    readonly message: string;
  };
}
export interface ManagedAnnualStatementsReviewProps {
  /** Admitted, immutable canonical v6 response, including verified hashes. */
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly actions: ManagedAnnualStatementsReviewActions;
  /** Fences note choices and actions; local reading and Inspect remain available. */
  readonly blockedReason: string | null;
}
interface SourceLifetime {
  readonly response: PersonalSecAnnualCanonicalResponseDto;
}
interface ReviewContext {
  readonly source: SourceLifetime;
  readonly blockedReason: string | null;
  live: boolean;
  selectionRevision: symbol;
  previewRevision: symbol;
}
interface Preparation {
  readonly source: SourceLifetime;
  readonly guard: () => boolean;
  readonly value: ManagedAnnualStatementsNotePreparation;
}
const emptySelection: readonly ManagedAnnualStatementCellSelection[] =
  Object.freeze([]);
function copySelection(keys: readonly ManagedAnnualStatementCellSelection[]) {
  return Object.freeze(
    keys.map((key) =>
      Object.freeze({ concept: key.concept, endDate: key.endDate }),
    ),
  );
}
function previewIsCurrent(
  preparation: Preparation | null,
  actions: ManagedAnnualStatementsReviewActions,
) {
  try {
    return Boolean(
      preparation?.value.preview &&
      preparation.guard() &&
      actions.isCurrent(preparation.value.preview),
    );
  } catch {
    return false;
  }
}

/** Owns temporary choices and review authority; the workspace owns the actual note. */
export function ManagedAnnualStatementsReview({
  response,
  actions,
  blockedReason,
}: ManagedAnnualStatementsReviewProps) {
  const id = useId();
  const source = useMemo<SourceLifetime>(
    () => Object.freeze({ response }),
    [response],
  );
  const statements = useMemo(
    () => resolvePersonalSecAnnualStatements(response.evidence),
    [response],
  );
  const context = useMemo<ReviewContext>(
    () => ({
      source,
      blockedReason,
      live: false,
      selectionRevision: Symbol("statement choices"),
      previewRevision: Symbol("statement preview"),
    }),
    [source, blockedReason],
  );
  const active = useRef<ReviewContext | null>(null);
  const consumed = useRef(new WeakSet<PreparedManagedAnnualStatementsNote>());
  const [choice, setChoice] = useState(() => ({
    source,
    keys: emptySelection,
  }));
  const [prepared, setPrepared] = useState<Preparation | null>(null);
  const [feedback, setFeedback] = useState<{
    readonly context: ReviewContext;
    readonly message: string;
  } | null>(null);
  useLayoutEffect(() => {
    context.live = true;
    active.current = context;
    return () => {
      context.live = false;
      if (active.current === context) active.current = null;
    };
  }, [context]);

  const keys = choice.source === source ? choice.keys : emptySelection;
  const revision = context.selectionRevision;
  const canAct = () =>
    context.live &&
    active.current === context &&
    context.blockedReason === null &&
    context.selectionRevision === revision;
  const preparation = prepared?.source === source ? prepared : null;
  const preview = preparation?.value.preview ?? null;
  const current =
    previewIsCurrent(preparation, actions) &&
    (preview === null || !consumed.current.has(preview));
  const blocked = blockedReason !== null;
  const message = feedback?.context === context ? feedback.message : "";
  const reason =
    preview && !current
      ? "The selected cells, annual report, note or review context changed. Preview the complete note again."
      : preparation?.value.reason;

  return (
    <section
      className="managed-annual-statements-review"
      aria-label="Review annual statement cells in the note draft"
    >
      {blockedReason && (
        <p className="managed-annual-statements-block" role="status">
          {blockedReason}
        </p>
      )}
      <ManagedAnnualStatements
        evidence={response.evidence}
        statements={statements}
        selectedCells={keys}
        disabled={blocked}
        onToggleCell={(concept, endDate) => {
          if (!canAct()) return;
          const cell = statements.statements
            .flatMap((statement) => statement.rows)
            .find((row) => row.concept === concept)
            ?.cells.find((candidate) => candidate.endDate === endDate);
          if (cell?.status !== "available") return;
          const selected = keys.some(
            (key) => key.concept === concept && key.endDate === endDate,
          );
          const next = selected
            ? keys.filter(
                (key) => key.concept !== concept || key.endDate !== endDate,
              )
            : [...keys, { concept, endDate }];
          context.selectionRevision = Symbol("statement choices");
          context.previewRevision = Symbol("statement preview");
          setChoice({ source, keys: copySelection(next) });
          setPrepared(null);
          setFeedback(null);
        }}
      />
      <details className="managed-annual-statements-note">
        <summary>Review selected statement cells ({keys.length})</summary>
        <p id={`${id}-help`}>
          Choose available cells in any statement, then preview the complete
          existing note and proposed addition. The preview keeps exact amounts,
          periods, qualifications and source references. A proposal over the
          single-line, 2,000-character note limit is refused as a whole. Nothing
          is clipped or saved here.
        </p>
        <button
          type="button"
          className="trial-secondary"
          disabled={blocked || keys.length === 0}
          aria-describedby={`${id}-help ${id}-status`}
          onClick={() => {
            if (!canAct() || keys.length === 0) return;
            const previewRevision = Symbol("statement preview");
            context.previewRevision = previewRevision;
            const guard = () =>
              canAct() && context.previewRevision === previewRevision;
            let value: ManagedAnnualStatementsNotePreparation;
            try {
              value = actions.prepare(response, copySelection(keys), guard);
            } catch {
              value = {
                preview: null,
                reason:
                  "The statement note could not be prepared. Review the current draft and try a new preview.",
              };
            }
            if (!guard()) return;
            setPrepared({ source, guard, value });
            setFeedback(null);
          }}
        >
          Preview statement note
        </button>
        {preview && (
          <div
            className="managed-annual-statements-note-preview"
            aria-label="Complete annual statement note preview"
          >
            <h4>
              {current ? "Complete note preview" : "Previous note preview"}
            </h4>
            <p className="trial-saved-note">{preview.note}</p>
            <button
              type="button"
              className="trial-secondary"
              disabled={blocked || !current}
              onClick={() => {
                if (
                  !canAct() ||
                  !preparation ||
                  !previewIsCurrent(preparation, actions) ||
                  consumed.current.has(preview)
                )
                  return;
                consumed.current.add(preview);
                let result: {
                  readonly appended: boolean;
                  readonly message: string;
                };
                try {
                  result = actions.append(preview);
                } catch {
                  result = {
                    appended: false,
                    message:
                      "The statement note could not be added. Review the draft and prepare a new preview.",
                  };
                }
                context.previewRevision = Symbol("statement preview consumed");
                setPrepared(null);
                setFeedback({ context, message: result.message });
              }}
            >
              Add statement cells to note draft
            </button>
          </div>
        )}
        <p id={`${id}-status`} role="status" aria-live="polite">
          {blockedReason ||
            message ||
            reason ||
            (keys.length
              ? "Preview the complete note before adding these cells. Use the existing Review and Save actions after append."
              : "Select at least one available statement cell to preview.")}
        </p>
      </details>
    </section>
  );
}
