import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type {
  ManagedPortfolioValuationReview as ReviewModel,
  PortfolioValuationReviewState,
} from "./managed-portfolio-valuation-review";
import type { PortfolioSavedScenarioRow } from "./portfolio-valuation-plan";
import type { ManagedValuationAssumptions } from "./managed-valuation-assumptions";
import type { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import { useValuationAssumptionsView } from "./useValuationAssumptionsView";
import { PortfolioSavedScenarioReadingView } from "./PortfolioSavedScenarioReadingView";
import "./managed-portfolio-valuation-review.css";

export interface ManagedPortfolioValuationReviewProps {
  readonly model: ReviewModel;
  readonly assumptions: ManagedValuationAssumptions;
  readonly workbench: ManagedValuationWorkbench;
  readonly active: boolean;
  readonly canPreview: boolean;
  readonly onPreview: (
    expected: PortfolioValuationReviewState,
  ) => PortfolioValuationReviewState | null;
  readonly onResearch: (
    row: PortfolioSavedScenarioRow,
    opener: HTMLButtonElement,
  ) => void;
  readonly canResearch: (row: PortfolioSavedScenarioRow) => boolean;
}
export function ManagedPortfolioValuationReview({
  model,
  assumptions,
  workbench,
  active,
  canPreview,
  onPreview,
  onResearch,
  canResearch,
}: ManagedPortfolioValuationReviewProps) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const view = useValuationAssumptionsView({
    model: assumptions,
    workbench,
    navigationPending: !active,
  });
  const heading = useRef<HTMLHeadingElement>(null);
  const committed = useRef<object | null>(null);
  const focus = useRef<PortfolioValuationReviewState | null>(null);
  const rendered = {};
  useLayoutEffect(() => {
    committed.current = rendered;
    if (
      active &&
      state.active &&
      focus.current === state &&
      model.getSnapshot() === state &&
      heading.current?.isConnected
    ) {
      focus.current = null;
      heading.current.focus();
    }
    return () => {
      committed.current = null;
    };
  });
  const current = () =>
    active && committed.current === rendered && model.getSnapshot() === state;
  const ready = () => current() && state.active;
  const previewAllowed =
    canPreview && assumptions.canCaptureConfirmedCollection();
  return (
    <section
      className="managed-portfolio-valuation-review"
      aria-labelledby="portfolio-saved-scenario-heading"
    >
      <h3 id="portfolio-saved-scenario-heading" ref={heading} tabIndex={-1}>
        Saved scenarios for these holdings
      </h3>
      <p>
        Load confirmed saved inputs, preview every holding, then evaluate
        explicitly against the chosen close date. Unsaved valuation drafts are
        excluded and remain unchanged. Preview and Evaluate do not load sources,
        restore drafts or save resources.
      </p>
      <div className="trial-actions">
        <button
          id="portfolio-saved-scenario-load"
          type="button"
          disabled={!active || !view.canLoad}
          onClick={() => {
            if (current() && view.ready() && view.canLoad)
              void assumptions.coordinator.load();
          }}
        >
          Load saved valuation inputs
        </button>
        <button
          id="portfolio-saved-scenario-preview"
          type="button"
          disabled={!active || !previewAllowed}
          onClick={() => {
            if (
              current() &&
              canPreview &&
              assumptions.canCaptureConfirmedCollection()
            )
              focus.current = onPreview(state);
          }}
        >
          Preview saved scenarios
        </button>
        <button
          id="portfolio-saved-scenario-evaluate"
          type="button"
          disabled={!active || !model.canEvaluate(state)}
          onClick={() => {
            if (ready()) focus.current = model.evaluate(state);
          }}
        >
          Evaluate saved scenarios
        </button>
        {state.plan && (
          <button
            id="portfolio-saved-scenario-clear"
            type="button"
            disabled={!active || !state.active}
            onClick={() => {
              if (ready()) focus.current = model.clear(state);
            }}
          >
            Clear saved-scenario reading
          </button>
        )}
      </div>
      <p role="status">{view.saved.message}</p>
      {(view.saved.uncertain ||
        view.saved.conflict ||
        view.saved.replayPending) && (
        <p>
          Open current Research for a holding, then expand Saved inputs.{" "}
          {view.saved.uncertain
            ? "Use Reconcile original valuation save before loading again."
            : "Load the latest saved inputs, compare the retained draft, then choose Use saved version or Keep valuation draft."}{" "}
          Return to Portfolio, load the chosen closes and preview the confirmed
          collection again. Recovery does not evaluate or save scenarios
          automatically.
        </p>
      )}
      {state.plan ? (
        <>
          <PortfolioSavedScenarioReadingView
            plan={state.plan}
            reading={state.reading}
          />
          <nav
            aria-label="Research holdings from this saved-scenario reading"
            className="trial-actions"
          >
            {state.plan.rows.map((row, index) => (
              <button
                key={row.selection.listing.listingId}
                id={`portfolio-saved-scenario-research-${index}`}
                type="button"
                disabled={!active || !state.active || !canResearch(row)}
                onClick={(event) => {
                  if (
                    ready() &&
                    state.plan?.rows.includes(row) &&
                    canResearch(row)
                  )
                    onResearch(row, event.currentTarget);
                }}
              >
                Research {row.selection.listing.symbol} ·{" "}
                {row.selection.listing.shareClassName}
              </button>
            ))}
          </nav>
        </>
      ) : (
        <p>
          No saved-scenario reading is retained. Load supported closes, choose a
          date and load confirmed saved inputs, then select Preview.
        </p>
      )}
      <p>
        Use current Research to restore or revise inputs, calculate and author a
        question or assessment. Back keeps this original reading while its
        Portfolio and saved inputs remain current. Save Portfolio, valuation
        inputs and Follow-ups separately.
      </p>
    </section>
  );
}
