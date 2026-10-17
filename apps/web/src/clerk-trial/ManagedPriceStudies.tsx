import { useId } from "react";
import type { ManagedEodHistoryResponseDto } from "@research-cockpit/contracts";
import {
  type ManagedPriceStudies as Studies,
  type ManagedPriceStudyKey,
} from "./managed-price-studies";
import type { ManagedPriceStudiesActions } from "./managed-price-studies-note";
import { usePriceStudiesReview } from "./use-price-studies-review";
import "./managed-price-studies.css";

const empty: readonly ManagedPriceStudyKey[] = Object.freeze([]);

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
  const {
    studies,
    keys,
    preview,
    current,
    status,
    onToggle,
    onPrepare,
    onAppend,
  } = usePriceStudiesReview({ response, blockedReason, actions });
  if (!studies)
    return (
      <p role="status">
        Studies are unavailable for this price packet. The original close
        history remains available.
      </p>
    );
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
        onToggle={onToggle}
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
          onClick={onPrepare}
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
              onClick={onAppend}
            >
              Add study results to note draft
            </button>
          </div>
        )}
        <p id={`${id}-status`} role="status" aria-live="polite">
          {status}
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
