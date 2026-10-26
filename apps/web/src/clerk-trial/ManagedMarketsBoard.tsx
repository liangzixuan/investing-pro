import type { ComponentProps } from "react";
import { ManagedMarkets } from "./ManagedMarkets";
import {
  ManagedMarketsNavigation,
  type ManagedMarketsNavigationProps,
} from "./ManagedMarketsNavigation";
import { ManagedMarketsSourceReview } from "./ManagedMarketsSourceReview";
import type { ManagedWorkspace } from "./managed-workspace";

interface ManagedMarketsBoardProps extends Pick<
  ComponentProps<typeof ManagedMarkets>,
  "navigationPending" | "onResearch" | "onWatchlist"
> {
  workspace: Pick<ManagedWorkspace, "markets" | "marketsSourceReview">;
  navigation: ManagedMarketsNavigationProps;
  isCurrent: () => boolean;
}

/** Keep source review beside the board within the same Markets lifetime. */
export function ManagedMarketsBoard({
  workspace,
  navigation,
  isCurrent,
  navigationPending,
  onResearch,
  onWatchlist,
}: ManagedMarketsBoardProps) {
  return (
    <>
      <ManagedMarketsSourceReview
        model={workspace.marketsSourceReview}
        isCurrent={isCurrent}
        disabled={navigationPending}
      />
      <ManagedMarkets
        model={workspace.markets}
        navigationPending={navigationPending}
        headingRef={navigation.targets.board.ref}
        sectionNavigation={<ManagedMarketsNavigation {...navigation} />}
        onResearch={onResearch}
        onWatchlist={onWatchlist}
      />
    </>
  );
}
