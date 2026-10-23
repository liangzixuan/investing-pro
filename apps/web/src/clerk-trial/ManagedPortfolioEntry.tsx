import type { ComponentProps } from "react";
import { ManagedPortfolio } from "./ManagedPortfolio";
import type { ManagedDiscoveryState } from "./managed-workspace";

type Props = Omit<
  ComponentProps<typeof ManagedPortfolio>,
  "draftFileRouteActive" | "onReviewWatchlist"
> & {
  readonly discovery: Pick<
    ManagedDiscoveryState,
    "view" | "research" | "companyRoute"
  >;
  readonly navigation: {
    readonly active: () => boolean;
    readonly view: (view: "watchlist") => boolean;
  };
};

/** The root route owns visibility and all Portfolio file operations. */
export function ManagedPortfolioEntry({
  discovery,
  navigation,
  ...props
}: Props) {
  if (discovery.view !== "portfolio") return null;
  return (
    <div
      hidden={Boolean(
        discovery.research || discovery.companyRoute || !navigation.active(),
      )}
    >
      <ManagedPortfolio
        {...props}
        draftFileRouteActive={navigation.active}
        onReviewWatchlist={() => {
          navigation.view("watchlist");
        }}
      />
    </div>
  );
}
