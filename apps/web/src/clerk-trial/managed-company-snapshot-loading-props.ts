import type { ComponentProps } from "react";
import type { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import type {
  ManagedWorkspace,
  ManagedResearchVisit,
} from "./managed-workspace";
import type { ManagedCompanyNavigation } from "./useManagedCompanyNavigation";

/** Bind explicit snapshot actions to their rendered visit and the live navigation guard. */
export function managedCompanySnapshotLoadingProps(
  workspace: ManagedWorkspace,
  visit: ManagedResearchVisit,
  navigation: ManagedCompanyNavigation | undefined,
): Pick<
  ComponentProps<typeof ManagedCompanyResearch>,
  "snapshotLoad" | "onLoadSnapshot" | "onCancelSnapshot"
> {
  return {
    snapshotLoad: workspace.companySnapshotLoad,
    onLoadSnapshot: async () => {
      if (navigation?.invalid || navigation?.isPending()) return;
      await workspace.loadCompanySnapshot(visit);
    },
    onCancelSnapshot: () => workspace.cancelCompanySnapshot(visit),
  };
}
