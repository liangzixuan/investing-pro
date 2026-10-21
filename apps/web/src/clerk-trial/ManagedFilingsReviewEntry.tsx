import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedCompanyNavigation } from "./useManagedCompanyNavigation";
import { ManagedFilingsReview } from "./ManagedFilingsReview";
import type { ComponentProps } from "react";
import type { ManagedWatchlistEditor } from "./ManagedWatchlistEditor";

type EntryProps = {
  workspace: ManagedWorkspace;
  navigation: ManagedCompanyNavigation | null | undefined;
  openResearch: (opener: HTMLButtonElement, action: () => void) => void;
};

export function watchlistFilingsActions({
  workspace,
  navigation,
  openResearch,
}: EntryProps): Pick<
  ComponentProps<typeof ManagedWatchlistEditor>,
  "onSelectedMember" | "onViewFilings"
> {
  return {
    onSelectedMember: (member) => {
      if (navigationAllowsReview(navigation))
        workspace.selectWatchlistFilingsMember(member);
    },
    onViewFilings: (capture, opener) => {
      if (!navigationAllowsReview(navigation)) return;
      openResearch(opener, () => workspace.openWatchlistFilings(capture));
    },
  };
}

function navigationAllowsReview(
  navigation: ManagedCompanyNavigation | null | undefined,
) {
  return !navigation?.invalid && !navigation?.hasCompanyRoute();
}
export function ManagedFilingsReviewEntry({
  workspace,
  navigation,
  openResearch,
}: EntryProps) {
  return (
    <ManagedFilingsReview
      model={workspace.filingsReview}
      active={navigationAllowsReview(navigation)}
      onView={(capture, opener) => {
        if (!navigationAllowsReview(navigation)) return;
        openResearch(opener, () => workspace.openFilingsReview(capture));
      }}
    />
  );
}
