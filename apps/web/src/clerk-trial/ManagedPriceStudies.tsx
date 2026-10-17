import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ManagedEodHistoryResponseDto } from "@research-cockpit/contracts";
import {
  resolveManagedPriceStudies,
  type ManagedPriceStudies as Studies,
  type ManagedPriceStudyKey,
} from "./managed-price-studies";
import type {
  ManagedPriceStudiesActions,
  PreparedPriceStudiesNote,
  PriceStudiesNotePreparation,
} from "./managed-price-studies-note";
import "./managed-price-studies.css";

interface Context {
  readonly response: ManagedEodHistoryResponseDto;
  readonly blockedReason: string | null;
  live: boolean;
  choiceRevision: symbol;
  previewRevision: symbol;
}
interface Preparation {
  readonly response: ManagedEodHistoryResponseDto;
  readonly guard: () => boolean;
  readonly value: PriceStudiesNotePreparation;
}
const empty: readonly ManagedPriceStudyKey[] = Object.freeze([]);
function isCurrent(
  prepared: Preparation | null,
  actions: ManagedPriceStudiesActions,
) {
  try {
    return Boolean(
      prepared?.value.preview &&
      prepared.guard() &&
      actions.isCurrent(prepared.value.preview),
    );
  } catch {
    return false;
  }
}

/** Temporary choices have a committed lifetime; the workspace owns draft changes. */
export function ManagedPriceStudies({
  response,
  showingPrevious,
  blockedReason,
  actions,
}: {
  readonly response: ManagedEodHistoryResponseDto;
  readonly showingPrevious: boolean;
  readonly blockedReason: string | null;
  readonly actions: ManagedPriceStudiesActions;
}) {
  const id = useId();
  const studies = useMemo(
    () => resolveManagedPriceStudies(response),
    [response],
  );
  const context = useMemo<Context>(
    () => ({
      response,
      blockedReason,
      live: false,
      choiceRevision: Symbol("study choices"),
      previewRevision: Symbol("study preview"),
    }),
    [response, blockedReason],
  );
  const active = useRef<Context | null>(null);
  const consumed = useRef(new WeakSet<PreparedPriceStudiesNote>());
  const [choice, setChoice] = useState<{
    response: ManagedEodHistoryResponseDto;
    keys: readonly ManagedPriceStudyKey[];
  }>(() => ({ response, keys: empty }));
  const [prepared, setPrepared] = useState<Preparation | null>(null);
  const [feedback, setFeedback] = useState<{
    context: Context;
    message: string;
  } | null>(null);
  useLayoutEffect(() => {
    context.live = true;
    active.current = context;
    return () => {
      context.live = false;
      if (active.current === context) active.current = null;
    };
  }, [context]);
  if (!studies)
    return (
      <p role="status">
        Studies are unavailable for this price packet. The original close
        history remains available.
      </p>
    );
  const keys = choice.response === response ? choice.keys : empty;
  const revision = context.choiceRevision;
  const canAct = () =>
    context.live &&
    active.current === context &&
    context.blockedReason === null &&
    context.choiceRevision === revision;
  const preparation = prepared?.response === response ? prepared : null;
  const preview = preparation?.value.preview ?? null;
  const current =
    isCurrent(preparation, actions) &&
    (preview === null || !consumed.current.has(preview));
  const message = feedback?.context === context ? feedback.message : "";
  return (
    <section
      className="managed-price-studies"
      aria-label="Raw close research studies"
    >
      <h4>Raw close studies</h4>
      {blockedReason && <p role="status">{blockedReason}</p>}
      <PriceStudiesContext
        studies={studies}
        showingPrevious={showingPrevious}
      />
      <ManagedPriceStudyTable
        studies={studies}
        selected={keys}
        disabled={blockedReason !== null}
        onToggle={(key) => {
          if (
            !canAct() ||
            !studies.rows.some((row) => row.key === key && row.available)
          )
            return;
          context.choiceRevision = Symbol("study choices");
          context.previewRevision = Symbol("study preview");
          setChoice({
            response,
            keys: Object.freeze(
              keys.includes(key)
                ? keys.filter((entry) => entry !== key)
                : [...keys, key],
            ),
          });
          setPrepared(null);
          setFeedback(null);
        }}
      />
      <details className="managed-price-studies-review">
        <summary>Review selected study results ({keys.length})</summary>
        <p id={`${id}-help`}>
          Choose available results, then preview the complete existing note and
          proposed addition. The single-line, 2,000-character limit applies to
          the whole note. Nothing is clipped or saved here.
        </p>
        <button
          type="button"
          className="trial-secondary"
          disabled={blockedReason !== null || keys.length === 0}
          aria-describedby={`${id}-help ${id}-status`}
          onClick={() => {
            if (!canAct()) return;
            context.previewRevision = Symbol("study preview");
            const previewRevision = context.previewRevision;
            const guard = () =>
              canAct() && context.previewRevision === previewRevision;
            let value: PriceStudiesNotePreparation;
            try {
              value = actions.prepare(response, keys, guard);
            } catch {
              value = {
                preview: null,
                reason:
                  "The study note could not be prepared. Review the current price history and draft.",
              };
            }
            setPrepared({ response, guard, value });
            setFeedback(null);
          }}
        >
          Preview complete note
        </button>
        {preview && (
          <div className="managed-price-studies-preview">
            <p>Complete proposed note</p>
            <p className="managed-price-studies-note-text">{preview.note}</p>
            <button
              type="button"
              className="trial-secondary"
              disabled={!current || blockedReason !== null}
              onClick={() => {
                if (
                  !canAct() ||
                  !preparation ||
                  !isCurrent(preparation, actions) ||
                  consumed.current.has(preview)
                )
                  return;
                consumed.current.add(preview);
                let result: { readonly message: string };
                try {
                  result = actions.append(preview);
                } catch {
                  result = {
                    message:
                      "The study note could not be applied. Review the draft and prepare a new preview.",
                  };
                }
                context.previewRevision = Symbol("study preview consumed");
                setPrepared(null);
                setFeedback({ context, message: result.message });
              }}
            >
              Add study results to note draft
            </button>
          </div>
        )}
        <p id={`${id}-status`} role="status" aria-live="polite">
          {blockedReason ||
            message ||
            (preview && !current
              ? "The study choices, history, note or review context changed. Preview the complete note again."
              : preparation?.value.reason) ||
            ""}
        </p>
      </details>
    </section>
  );
}

export function CapturedPriceStudies({
  studies,
  showingPrevious,
}: {
  readonly studies: Studies;
  readonly showingPrevious: boolean;
}) {
  return (
    <section
      className="captured-price-studies"
      aria-label="Captured raw close studies"
    >
      <h4>Captured raw close studies</h4>
      <PriceStudiesContext
        studies={studies}
        showingPrevious={showingPrevious}
      />
      <ManagedPriceStudyTable studies={studies} />
    </section>
  );
}

export function PriceStudiesContext({
  studies,
  showingPrevious,
}: {
  readonly studies: Studies;
  readonly showingPrevious: boolean;
}) {
  return (
    <>
      <p>
        Calculated through {studies.calculation.asOfDate} from the loaded{" "}
        {studies.response.range} history. Observed closes are unadjusted for
        splits or dividends; gaps are not filled. These are descriptive
        calculations, not total returns, recommendations or forecasts.
      </p>
      <p>
        Formula set {studies.calculation.formulaSetVersion}; percentages rounded
        half-up to four decimal places. Each result keeps its own observed
        sample.
      </p>
      {showingPrevious && (
        <p className="discovery-warning">
          Retained previous history. The latest attempt has not confirmed newer
          prices; original source dates still apply.
        </p>
      )}
    </>
  );
}
export function ManagedPriceStudyTable({
  studies,
  selected = empty,
  disabled = false,
  onToggle,
}: {
  readonly studies: Studies;
  readonly selected?: readonly ManagedPriceStudyKey[];
  readonly disabled?: boolean;
  readonly onToggle?: (key: ManagedPriceStudyKey) => void;
}) {
  return (
    <div
      className="managed-price-studies-table-wrap"
      tabIndex={0}
      role="region"
      aria-label="Raw close study values"
    >
      <table className="managed-price-studies-table">
        <thead>
          <tr>
            <th scope="col">Study and sample</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {studies.rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                {row.label}
                <small>{row.sample}</small>
              </th>
              <td>
                <strong>{row.value}</strong>
                <small>{row.detail}</small>
                {onToggle && row.available && (
                  <label className="managed-price-studies-choice">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.key)}
                      disabled={disabled}
                      onChange={() => onToggle(row.key)}
                    />
                    Include {row.label} in note
                  </label>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
