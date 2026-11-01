import type { ReactNode } from "react";
import type { ManagedValuationReassessment } from "./managed-valuation-reassessment";
import { ManagedValuationReassessmentSaved } from "./ManagedValuationReassessmentSaved";
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
  type ManagedValuationAssumptionsProps as AssumptionsProps,
} from "./useValuationAssumptionsView";
import {
  ValuationLoadStageActions,
  ValuationSaveActions,
  ValuationCancelActions,
  ValuationResourceStatus,
} from "./ValuationAssumptionsActions";
export interface ManagedValuationAssumptionsProps extends AssumptionsProps {
  readonly reassessment?: ManagedValuationReassessment;
}
export function ManagedValuationAssumptions(
  props: ManagedValuationAssumptionsProps & { collectionFiles?: ReactNode },
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
      {props.collectionFiles}
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
      {props.reassessment ? (
        <ManagedValuationReassessmentSaved
          model={props.reassessment}
          view={view}
        />
      ) : (
        <ValuationSavedEntries view={view} />
      )}
    </details>
  );
}
