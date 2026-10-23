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
  options: {
    navigation: ManagedCompanyNavigation | undefined;
    navigationPending: boolean;
    onReviewFollowups: () => void;
  },
): Pick<
  ComponentProps<typeof ManagedCompanyResearch>,
  "watchlist" | "thesisFollowup" | "researchFollowup"
> {
  return {
    watchlist: workspace.getResearchWatchlist(selection),
    thesisFollowup: workspace.researchThesisFollowupContext(selection),
    researchFollowup: (
      <ManagedResearchFollowup
        key={`${selection.catalogSnapshotSha256}:${selection.listing.listingId}`}
        workspace={workspace}
        selection={selection}
        navigationPending={options.navigationPending}
        routeActive={() =>
          !options.navigation?.invalid && !options.navigation?.isPending()
        }
        onReview={options.onReviewFollowups}
      />
    ),
  };
}
