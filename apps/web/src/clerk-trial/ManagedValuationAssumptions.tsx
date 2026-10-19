import {
  CompletePayload,
  ValuationConflictReview,
  ValuationStagingReview,
  ValuationRestoreReview,
  ValuationDraftEntries,
  ValuationSavedEntries,
} from "./ValuationAssumptionsPanels";
import "./managed-valuation-workbench.css";

import {
  useValuationAssumptionsView,
  type ManagedValuationAssumptionsProps,
} from "./useValuationAssumptionsView";
import {
  ValuationLoadStageActions,
  ValuationSaveActions,
  ValuationCancelActions,
  ValuationResourceStatus,
} from "./ValuationAssumptionsActions";
export type { ManagedValuationAssumptionsProps } from "./useValuationAssumptionsView";
export function ManagedValuationAssumptions(
  props: ManagedValuationAssumptionsProps,
) {
  const view = useValuationAssumptionsView(props);
  return (
    <details className="managed-valuation-workbench managed-valuation-assumptions">
      <summary>Saved valuation inputs</summary>
      <p>
        Keep one complete set of authored DCF and exit inputs per listing, up to
        20 listings. Load explicitly, review the exact text, stage it, then
        Review and Save. Inputs can include unfinished numbers. Source evidence
        and calculated results are not saved here.
      </p>
      <div className="trial-actions">
        <ValuationLoadStageActions view={view} />
        <ValuationSaveActions view={view} />
      </div>
      <ValuationResourceStatus view={view} />
      <ValuationConflictReview view={view} />
      <ValuationStagingReview view={view} />
      <ValuationRestoreReview view={view} />
      <ValuationCancelActions view={view} />
      {view.reviewCurrent && view.saved.draft && (
        <CompletePayload
          label="Complete valuation draft for Save"
          payload={view.saved.draft}
        />
      )}
      <ValuationDraftEntries view={view} />
      <ValuationSavedEntries view={view} />
    </details>
  );
}
