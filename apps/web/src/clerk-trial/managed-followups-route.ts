import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedCompanyNavigation } from "./useManagedCompanyNavigation";

/** Recheck the live route ref before a Follow-ups file action or late result. */
export function managedFollowupsRouteActive(
  workspace: ManagedWorkspace,
  navigation: ManagedCompanyNavigation | undefined,
  routeActive: () => boolean,
) {
  return () =>
    routeActive() &&
    !navigation?.isPending() &&
    workspace.sessionOwner.getSnapshot().phase === "active";
}
