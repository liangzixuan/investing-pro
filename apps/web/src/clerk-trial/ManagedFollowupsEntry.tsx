import type { ComponentProps } from "react";
import { ManagedResearchFollowups } from "./ManagedResearchFollowups";
import type { ManagedDiscoveryState } from "./managed-workspace";

type Props = Omit<
  ComponentProps<typeof ManagedResearchFollowups>,
  "draftFileRouteActive"
> & {
  readonly discovery: Pick<
    ManagedDiscoveryState,
    "view" | "research" | "companyRoute"
  >;
  readonly routeActive: () => boolean;
};

/** The root route owns visibility and Follow-ups file-operation lifetime. */
export function ManagedFollowupsEntry({
  discovery,
  routeActive,
  ...props
}: Props) {
  if (discovery.view !== "followups") return null;
  return (
    <div
      hidden={Boolean(
        discovery.research || discovery.companyRoute || !routeActive(),
      )}
    >
      <ManagedResearchFollowups {...props} draftFileRouteActive={routeActive} />
    </div>
  );
}
