import type { ComponentProps, RefObject } from "react";
import type { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedCompanyNavigation } from "./useManagedCompanyNavigation";

/** Keep the original workspace opener while changing the researched company. */
export function managedResearchCompanyNavigationProps(
  workspace: ManagedWorkspace,
  navigation: ManagedCompanyNavigation | undefined,
): Pick<
  ComponentProps<typeof ManagedCompanyResearch>,
  "canOpenCompany" | "onOpenCompany"
> {
  return {
    canOpenCompany: (visit, member) =>
      !navigation?.invalid && workspace.canOpenResearchCompany(visit, member),
    onOpenCompany: (visit, member) => {
      if (
        navigation?.invalid ||
        !workspace.canOpenResearchCompany(visit, member)
      )
        return;
      const open = () => workspace.openResearchCompany(visit, member);
      if (navigation) navigation.open(open);
      else open();
    },
  };
}

/** Bind company entry and its focus origin to the same current workspace and route. */
export function managedResearchOpener(
  workspace: ManagedWorkspace,
  navigation: ManagedCompanyNavigation | undefined,
  panelOrigin: RefObject<HTMLButtonElement | null>,
) {
  return (opener: HTMLButtonElement, action: () => void) => {
    if (!workspace.canNavigate()) return;
    const open = () => {
      action();
      if (workspace.getSnapshot().research) panelOrigin.current = opener;
    };
    if (navigation) navigation.open(open);
    else open();
  };
}
