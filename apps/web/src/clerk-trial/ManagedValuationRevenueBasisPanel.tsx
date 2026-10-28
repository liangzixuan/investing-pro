import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS } from "@research-cockpit/contracts";
import { managedAnnualBasisLabel } from "../features/research/managed-annual-basis-label";
import type { ManagedAnnualReport } from "./managed-annual-report";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import {
  resolveAnnualRevenueBasis,
  type AppliedValuationRevenueBasis,
  type PreparedValuationRevenueBasis,
} from "./managed-valuation-revenue-basis";
import { ValuationAssumptionReview } from "./ValuationAssumptionReview";

const sourceOriginLabels = {
  request: "Explicit Annual load",
  "watchlist-comparison": "Admitted Watchlist comparison evidence",
  "financial-screen": "Admitted financial-screen evidence",
};

export interface ManagedValuationRevenueBasisActions {
  prepare: (concept: string) => {
    preview: PreparedValuationRevenueBasis | null;
    reason: string | null;
  };
  isCurrent: (preview: PreparedValuationRevenueBasis) => boolean;
  apply: (preview: PreparedValuationRevenueBasis) => {
    applied: boolean;
    message: string;
  };
  retirePreview: () => void;
  getApplied: () => AppliedValuationRevenueBasis | null;
}

export function ManagedValuationRevenueBasisPanel({
  model,
  annual,
  selection,
  actions,
  disabled,
}: {
  model: ManagedValuationWorkbench;
  annual: ManagedAnnualReport;
  selection: ManagedResearchSelection;
  actions: ManagedValuationRevenueBasisActions;
  disabled: boolean;
}) {
  const id = useId();
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const sourceState = useSyncExternalStore(
    annual.subscribe,
    annual.getSnapshot,
    annual.getSnapshot,
  );
  const [concept, setConcept] = useState("");
  const [preview, setPreview] = useState<PreparedValuationRevenueBasis | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const live = useRef(false);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const previewElement = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      actionsRef.current.retirePreview();
    };
  }, []);
  useLayoutEffect(() => {
    actionsRef.current.retirePreview();
    setConcept("");
    setPreview(null);
    setMessage("");
  }, [model, selection]);
  useLayoutEffect(() => {
    if (preview) previewElement.current?.focus();
  }, [preview]);
  const candidate = resolveAnnualRevenueBasis(selection, sourceState, concept);
  const current = preview !== null && actions.isCurrent(preview);
  const applied = actions.getApplied();
  const commandContext = {
    model,
    annual,
    selection,
    disabled,
    state,
    sourceState,
  };
  const latestCommandContext = useRef(commandContext);
  latestCommandContext.current = commandContext;
  const canAct = () =>
    live.current &&
    latestCommandContext.current === commandContext &&
    !disabled &&
    model.getSnapshot() === state &&
    annual.getSnapshot() === sourceState;
  return (
    <details className="managed-valuation-revenue-basis">
      <summary>Use reported Annual revenue as a model basis</summary>
      <p>
        Choose one loaded revenue basis explicitly. Review the source and
        complete current and proposed inputs before applying it to Starting
        revenue in the exit multiple model. This remains your authored
        assumption. It does not set cash flow DCF inputs, shares, growth,
        margins, cash or debt.
      </p>
      <label className="managed-valuation-field" htmlFor={`${id}-basis`}>
        <span>Reported Annual revenue basis</span>
        <select
          id={`${id}-basis`}
          value={concept}
          disabled={disabled}
          onChange={(event) => {
            const value = event.currentTarget.value;
            if (
              !canAct() ||
              (value !== "" &&
                !PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.some(
                  (item) => item === value,
                ))
            )
              return;
            actions.retirePreview();
            setConcept(value);
            setPreview(null);
            setMessage("");
          }}
        >
          <option value="">Choose one revenue basis</option>
          {PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((item) => (
            <option key={item} value={item}>
              {managedAnnualBasisLabel(item)}
            </option>
          ))}
        </select>
      </label>
      {candidate.source ? (
        <div
          role="region"
          aria-label="Selected reported revenue source"
          className="managed-valuation-note-preview"
        >
          <p>
            {managedAnnualBasisLabel(candidate.source.concept)} ·{" "}
            <code>{candidate.source.concept}</code>
          </p>
          <p>
            Reported USD {candidate.source.value}; {candidate.source.startDate}{" "}
            to {candidate.source.endDate}.
          </p>
          <p>
            {candidate.source.form}, filed {candidate.source.filedDate};
            accession {candidate.source.accessionNumber}.
          </p>
          <p>
            Original cutoff {candidate.source.cutoffAt}; completed{" "}
            {candidate.source.completedAt}. Company Facts captured{" "}
            {candidate.source.companyFactsCapturedAt}; Submissions captured{" "}
            {candidate.source.submissionsCapturedAt}.
          </p>
          <p>
            Loaded via: {sourceOriginLabels[candidate.source.responseOrigin]}.
          </p>
          <p>
            {candidate.source.currentUseEligible
              ? "Current-use policy at original load: eligible."
              : "Historical evidence; current-use policy at original load: unavailable."}
          </p>
          {candidate.source.showingPrevious && (
            <p>
              Retained previous report. This load has not confirmed newer
              evidence.
            </p>
          )}
          <a href={candidate.source.filingUrl} target="_blank" rel="noreferrer">
            Original SEC filing index
          </a>
        </div>
      ) : (
        <p role="status">{candidate.reason}</p>
      )}
      <button
        type="button"
        className="trial-secondary"
        disabled={disabled || !candidate.source}
        onClick={() => {
          if (!canAct()) return;
          const result = actions.prepare(concept);
          setPreview(result.preview);
          setMessage(result.reason ?? "");
        }}
      >
        Preview starting revenue change
      </button>
      {preview && (
        <div
          ref={previewElement}
          tabIndex={-1}
          role="region"
          aria-label="Complete starting revenue change preview"
          className="managed-valuation-note-preview"
        >
          <h4>
            {current
              ? "Review starting revenue change"
              : "Previous starting revenue preview"}
          </h4>
          <p>{preview.excerpt}</p>
          <p>
            Only exit-model Starting revenue changes from{" "}
            <span className="managed-valuation-raw">
              {preview.beforeRevenue === "" ? "Empty" : preview.beforeRevenue}
            </span>{" "}
            to{" "}
            <span className="managed-valuation-raw">
              {preview.afterRevenue}
            </span>{" "}
            USD.
          </p>
          <div className="managed-valuation-comparison">
            <section aria-label="Current complete valuation inputs">
              <h5>Current inputs</h5>
              <ValuationAssumptionReview entry={preview.before} />
            </section>
            <section aria-label="Proposed complete valuation inputs">
              <h5>Proposed inputs</h5>
              <ValuationAssumptionReview entry={preview.after} />
            </section>
          </div>
          <button
            type="button"
            className="trial-secondary"
            disabled={disabled || !current}
            onClick={() => {
              if (!canAct() || !actions.isCurrent(preview)) return;
              const result = actions.apply(preview);
              setPreview(null);
              setMessage(result.message);
            }}
          >
            Apply reported revenue to authored inputs
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {applied && (
        <div
          role="region"
          aria-label="Applied Annual revenue reference"
          className="managed-valuation-note-preview"
        >
          <h4>Applied Annual revenue reference</h4>
          <p>{applied.excerpt}</p>
          <p>
            A current reference is included in the complete Exit multiple note
            preview. Saved valuation inputs retain raw authored text only.
            Calculate, Stage, Review and Save remain separate actions.
          </p>
        </div>
      )}
      <p>
        Opening, selecting and previewing make no source request, calculation or
        saved change. Original source clocks stay unchanged.
      </p>
    </details>
  );
}
