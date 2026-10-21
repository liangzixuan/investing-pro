import type { ComponentProps } from "react";
import { ManagedPortfolio } from "./ManagedPortfolio";
import type { ManagedDiscoveryState } from "./managed-workspace";

type Props = Omit<
  ComponentProps<typeof ManagedPortfolio>,
  "draftFileRouteActive"
> & {
  readonly discovery: Pick<
    ManagedDiscoveryState,
    "view" | "research" | "companyRoute"
  >;
  readonly routeActive: () => boolean;
};

/** The root route owns visibility and all Portfolio file operations. */
export function ManagedPortfolioEntry({
  discovery,
  routeActive,
  ...props
}: Props) {
  if (discovery.view !== "portfolio") return null;
  return (
    <div
      hidden={Boolean(
        discovery.research || discovery.companyRoute || !routeActive(),
      )}
    >
      <ManagedPortfolio {...props} draftFileRouteActive={routeActive} />
    </div>
  );
}
