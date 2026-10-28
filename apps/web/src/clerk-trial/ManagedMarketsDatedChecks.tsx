import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedMarketsNavigationProps } from "./ManagedMarketsNavigation";
import { ManagedDailyResearchReview } from "./ManagedDailyResearchReview";
import { ManagedCpiHeadlines } from "./ManagedCpiHeadlines";
import { ManagedMarketsCalendarFollowup } from "./ManagedMarketsCalendarFollowup";
interface Props {
  workspace: ManagedWorkspace;
  sections: ManagedMarketsNavigationProps;
  isCurrent: () => boolean;
  navigationPending: boolean;
  navigation: {
    review: (entry: ResearchFollowup) => void;
    manageFollowups: () => void;
    manageWatchlist: () => void;
  };
}
/** Dated checks share exact-entry navigation and their own original source headings. */
export function ManagedMarketsDatedChecks({
  workspace,
  sections,
  isCurrent,
  navigationPending,
  navigation,
}: Props) {
  return (
    <>
      <ManagedDailyResearchReview
        workspace={workspace}
        navigationPending={navigationPending}
        headingRef={sections.targets.review.ref}
        isCurrent={isCurrent}
        onReview={navigation.review}
        onManage={navigation.manageFollowups}
      />
      <ManagedCpiHeadlines
        headingRef={sections.targets.cpi.ref}
        workspace={workspace}
        isCurrent={isCurrent}
        navigationPending={navigationPending}
        onReview={navigation.review}
        onManageWatchlist={navigation.manageWatchlist}
      />
      <ManagedMarketsCalendarFollowup
        workspace={workspace}
        navigation={sections}
        headingRef={sections.targets.day.ref}
        isCurrent={isCurrent}
        navigationPending={navigationPending}
        onReview={navigation.review}
        onManageWatchlist={navigation.manageWatchlist}
      />
    </>
  );
}
