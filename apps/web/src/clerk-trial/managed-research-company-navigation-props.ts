import type { ComponentProps } from "react";
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
