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
  "watchlist" | "thesisFollowup" | "researchFollowup" | "reportRevisitTarget"
> {
  const routeActive = () => !navigation?.invalid && !navigation?.isPending();
  return {
    reportRevisitTarget: () =>
      workspace.captureCompanyReportRevisitTarget(selection, routeActive),
    watchlist: workspace.getResearchWatchlist(selection),
    thesisFollowup: workspace.researchThesisFollowupContext(selection),
    researchFollowup: (
      <ManagedResearchFollowup
        key={`${selection.catalogSnapshotSha256}:${selection.listing.listingId}`}
        workspace={workspace}
        selection={selection}
        navigationPending={navigation?.pending ?? false}
        routeActive={routeActive}
        onReview={onReviewFollowups}
      />
    ),
  };
}
