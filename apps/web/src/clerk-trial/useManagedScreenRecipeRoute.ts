import { useCallback, useLayoutEffect, useRef } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedCompanyNavigation } from "./useManagedCompanyNavigation";

function navigationAllowsRecipe(
  navigation: ManagedCompanyNavigation | undefined,
) {
  if (!navigation) return true;
  if (navigation.pending || navigation.isPending()) return false;
  return !navigation.invalid && !navigation.hasCompanyRoute();
}

function currentRecipeRoute(
  workspace: ManagedWorkspace,
  navigation: ManagedCompanyNavigation | undefined,
) {
  if (!navigationAllowsRecipe(navigation)) return false;
  if (workspace.sessionOwner.getSnapshot().phase !== "active") return false;
  const current = workspace.getSnapshot();
  if (current.view !== "discover") return false;
  return !current.research && !current.companyRoute;
}

/** Keep document IO bound to committed navigation and its live pending/URL guards. */
export function useManagedScreenRecipeRoute(
  workspace: ManagedWorkspace,
  navigation: ManagedCompanyNavigation | undefined,
) {
  const current = useRef(navigation);
  useLayoutEffect(() => {
    current.current = navigation;
  }, [navigation]);
  const pending = navigation?.pending;
  const invalid = navigation?.invalid;
  return useCallback(
    () => currentRecipeRoute(workspace, current.current),
    [workspace, pending, invalid],
  );
}
