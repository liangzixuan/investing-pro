import { companyReportComparisonCheckActions } from "./company-report-comparison-check-actions";
import { ManagedCompanyResearchChecks } from "./ManagedCompanyResearchChecks";
import type { ComponentProps } from "react";
import type { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedCompanyNavigation } from "./useManagedCompanyNavigation";
import { ManagedResearchFollowup } from "./ManagedResearchFollowup";

/** Company research reads and edits the original resource drafts. */
export function managedResearchDraftProps(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
  navigation: ManagedCompanyNavigation | undefined,
  onReviewFollowups: () => void,
): Pick<
  ComponentProps<typeof ManagedCompanyResearch>,
  | "watchlist"
  | "thesisFollowup"
  | "researchFollowup"
  | "companyResearchChecks"
  | "reportRevisitTarget"
  | "reportComparisonCheck"
> {
  const routeActive = () => !navigation?.invalid && !navigation?.isPending();
  return {
    reportComparisonCheck: companyReportComparisonCheckActions(
      workspace,
      selection,
      routeActive,
    ),
    reportRevisitTarget: () =>
      workspace.captureCompanyReportRevisitTarget(selection, routeActive),
    watchlist: workspace.getResearchWatchlist(selection),
    thesisFollowup: workspace.researchThesisFollowupContext(selection),
    companyResearchChecks: (
      <ManagedCompanyResearchChecks
        key={`${selection.catalogSnapshotSha256}:${selection.listing.listingId}`}
        workspace={workspace}
        selection={selection}
        navigationPending={navigation?.pending ?? false}
        routeActive={routeActive}
      />
    ),
    researchFollowup: (
      <ManagedResearchFollowup
        key={`${selection.catalogSnapshotSha256}:${selection.listing.listingId}`}
        workspace={workspace}
        selection={selection}
        navigationPending={navigation?.pending ?? false}
        routeActive={routeActive}
        onReview={() => {
          if (selection.origin === "followups") onReviewFollowups();
          else
            workspace.reviewCompanyResearchCheck(selection, () => {
              if (navigation) return navigation.view("followups");
              workspace.setView("followups");
              return workspace.getSnapshot().view === "followups";
            });
        }}
      />
    ),
  };
}
