import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type {
  SavedScenarioPlan,
  SavedScenarioReading,
} from "./managed-watchlist-valuation-review";
import { ManagedValuationResults } from "./ManagedValuationResults";
import {
  ManagedValuationPriceContext,
  valuationPriceRefusal,
} from "./ManagedValuationPriceContext";
import { ValuationAssumptionReview } from "./ValuationAssumptionReview";
import { ListingIdentity } from "./ManagedListingIdentity";
import { CapturedSourcePacket } from "./ManagedScreenResearchReading";
import { useValuationAssumptionsView } from "./useValuationAssumptionsView";
import "./managed-watchlist-valuation-review.css";

export function SavedScenarioReadingView({
  plan,
  reading,
}: {
  plan: SavedScenarioPlan;
  reading: SavedScenarioReading | null;
}) {
  return (
    <>
      <p>
        Confirmed saved resource version: {plan.collection.saved.version}.
        Captured at (UTC): {plan.capturedAt}.
      </p>
      {reading && (
        <p>
          Evaluated at (UTC): {reading.evaluatedAt}. Saved inputs evaluated now;
          these are not historical calculated values.
        </p>
      )}
      <ol>
        {plan.rows.map((row, index) => {
          const result = reading?.rows[index];
          return (
            <li
              key={row.selection.listing.listingId}
              data-saved-scenario-listing={row.selection.listing.listingId}
            >
              <section aria-labelledby={`watchlist-saved-scenario-${index}`}>
                <h5 id={`watchlist-saved-scenario-${index}`}>
                  {row.selection.listing.symbol} ·{" "}
                  {row.selection.listing.shareClassName}
                </h5>
                <ListingIdentity member={row.selection.listing} />
                {row.reason && (
                  <p>
                    {row.reason === "missing_saved_inputs"
                      ? "No confirmed saved valuation inputs for this listing."
                      : "Saved inputs do not match the current catalog, full listing or admitted issuer. Review their identity in Saved inputs."}
                  </p>
                )}
                {row.entry && <ValuationAssumptionReview entry={row.entry} />}
                <p>
                  {row.price.reason
                    ? valuationPriceRefusal(row.price.reason)
                    : `Retained raw close ${row.price.reference!.rawCloseUsd} USD on ${row.price.reference!.date}.`}
                </p>
                {row.source.price && (
                  <>
                    <p>{row.source.price.message}</p>
                    {row.source.price.showingPrevious && (
                      <p>
                        Previous Price response retained; its original dates
                        remain unchanged.
                      </p>
                    )}
                    <CapturedSourcePacket
                      label="Complete retained Price state and response"
                      value={row.source.price}
                    />
                  </>
                )}
                {result?.calculation && (
                  <ManagedValuationResults calculation={result.calculation} />
                )}
                {result?.comparison && (
                  <ManagedValuationPriceContext context={result.comparison} />
                )}
              </section>
            </li>
          );
        })}
      </ol>
    </>
  );
}
export function ManagedWatchlistValuationReview({
  workspace,
  active,
}: {
  workspace: ManagedWorkspace;
  active: boolean;
}) {
  const model = workspace.watchlistValuationReview;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const group = useSyncExternalStore(
    workspace.filingsReview.subscribe,
    workspace.filingsReview.getSnapshot,
    workspace.filingsReview.getSnapshot,
  );
  const view = useValuationAssumptionsView({
    model: workspace.valuationAssumptions,
    workbench: workspace.valuation,
    navigationPending: !active || !state.active,
  });
  const heading = useRef<HTMLHeadingElement>(null);
  const committed = useRef<typeof state | null>(null);
  const focus = useRef<typeof state | null>(null);
  useLayoutEffect(() => {
    committed.current = state;
    if (
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
  }, [state, model]);
  if (!group.daily) return null;
  const ready = () =>
    active &&
    state.active &&
    committed.current === state &&
    model.getSnapshot() === state;
  const finished = group.daily.phase === "finished";
  return (
    <section
      className="managed-watchlist-valuation-review"
      aria-labelledby="watchlist-saved-scenario-heading"
    >
      <h4 id="watchlist-saved-scenario-heading" ref={heading} tabIndex={-1}>
        Saved scenarios for this daily review
      </h4>
      <p>
        Evaluate confirmed saved assumptions against the retained dated Price
        evidence. Unsaved valuation drafts are excluded and remain unchanged.
        Source reads, evaluation and Finish do not save a resource.
      </p>
      {!finished && (
        <div className="trial-actions">
          <button
            id="watchlist-saved-scenario-load"
            type="button"
            disabled={!active || !state.active || !view.canLoad}
            onClick={() => {
              if (ready() && view.ready() && view.canLoad)
                void workspace.valuationAssumptions.coordinator.load();
            }}
          >
            Load saved valuation inputs
          </button>
          <button
            id="watchlist-saved-scenario-preview"
            type="button"
            disabled={!active || !model.canPreview(state)}
            onClick={() => {
              if (ready()) focus.current = model.preview(state);
            }}
          >
            Preview saved scenarios
          </button>
          <button
            id="watchlist-saved-scenario-evaluate"
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
              id="watchlist-saved-scenario-clear"
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
      )}
      <p role="status">{view.saved.message}</p>
      {!finished &&
        (view.saved.uncertain ||
          view.saved.conflict ||
          view.saved.replayPending) && (
          <p>
            Open a current company's Research from My Watchlist, then expand
            Saved inputs.
            {view.saved.uncertain
              ? " Use Reconcile original valuation save before loading again."
              : " Load the latest saved inputs, compare the retained draft, then choose Use saved version or Keep valuation draft."}{" "}
            Return to My Watchlist and start a new daily review, then preview
            the confirmed collection again. Recovery does not automatically
            evaluate or save these scenarios.
          </p>
        )}
      {state.plan ? (
        <SavedScenarioReadingView plan={state.plan} reading={state.reading} />
      ) : (
        <p>
          {finished
            ? "No saved-scenario reading was retained for this finished review. Start a new daily review to load and preview saved inputs."
            : "No saved-scenario reading is retained. Load the confirmed collection and preview it during an active daily review."}
        </p>
      )}
      <p>
        {finished
          ? "This finished reading is passive. Start a new daily review, or open current company research from My Watchlist to restore or revise inputs."
          : "Open the selected company through this group's Research control to restore or revise inputs explicitly."}{" "}
        Only a current company calculation can prepare a note or check. Save
        valuation inputs, Watchlist and Follow-ups separately.
      </p>
    </section>
  );
}
