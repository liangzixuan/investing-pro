import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedCompanyNavigation } from "./useManagedCompanyNavigation";
import { ManagedFilingsReview } from "./ManagedFilingsReview";

function navigationAllowsReview(
  navigation: ManagedCompanyNavigation | null | undefined,
) {
  return !navigation?.invalid && !navigation?.hasCompanyRoute();
}
export function ManagedFilingsReviewEntry({
  workspace,
  navigation,
  openResearch,
}: {
  workspace: ManagedWorkspace;
  navigation: ManagedCompanyNavigation | null | undefined;
  openResearch: (opener: HTMLButtonElement, action: () => void) => void;
}) {
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
