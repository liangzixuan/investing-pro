import type { ManagedValuationReassessment } from "./managed-valuation-reassessment";
import type { ValuationAssumptionsView } from "./useValuationAssumptionsView";
import { ValuationSavedEntries } from "./ValuationAssumptionsPanels";
import { ManagedValuationBaselineReading } from "./ManagedValuationReassessmentReading";
import {
  useValuationReassessmentView,
  valuationFocusOrigin,
} from "./useValuationReassessmentView";

export function ManagedValuationReassessmentSaved({
  model,
  view,
}: {
  model: ManagedValuationReassessment;
  view: ValuationAssumptionsView;
}) {
  const reassessment = useValuationReassessmentView(
    model,
    view.navigationPending,
  );
  const state = reassessment.state;
  return (
    <>
      <ValuationSavedEntries
        view={view}
        baselineActions={{
          canCapture: (entry) =>
            view.editable && model.canCapture(entry, view.saved),
          capture: (entry) => {
            if (
              !view.ready() ||
              !reassessment.ready() ||
              !view.editable ||
              !model.canCapture(entry, view.saved)
            )
              return;
            const origin = valuationFocusOrigin();
            reassessment.requestFocus(model.capture(entry, view.saved), origin);
          },
        }}
      />
      {state?.baseline && (
        <>
          <ManagedValuationBaselineReading
            baseline={state.baseline}
            headingRef={reassessment.headingRef}
          />
          <button
            type="button"
            className="trial-secondary"
            id="managed-valuation-reassessment-cancel"
            disabled={view.navigationPending || !state.active}
            onClick={() => {
              if (view.ready() && reassessment.ready() && state.active)
                model.cancel(state);
            }}
          >
            Cancel reassessment
          </button>
          <p>
            Cancel clears this baseline and its paired reading. Editor inputs,
            source states and resource drafts stay unchanged.
          </p>
        </>
      )}
    </>
  );
}
