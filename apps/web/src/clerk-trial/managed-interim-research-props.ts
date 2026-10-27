import type { ComponentProps } from "react";
import type { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import type {
  ManagedWorkspace,
  ManagedResearchVisit,
} from "./managed-workspace";
/** Capture the exact rendered visit; old handlers retain its selection authority. */
export function interimResearchProps(
  workspace: ManagedWorkspace,
  visit: ManagedResearchVisit,
): Pick<
  ComponentProps<typeof ManagedCompanyResearch>,
  "interim" | "interimStatementsActions"
> {
  return {
    interim: workspace.interim,
    interimStatementsActions: {
      prepare: (response, cells, current) =>
        workspace.prepareInterimStatementsNote(
          visit.selection,
          response,
          cells,
          current,
        ),
      isCurrent: (preview) =>
        workspace.interimStatementsPreviewIsCurrent(preview),
      append: (preview) => workspace.appendInterimStatementsNote(preview),
      cancel: (preview) => workspace.cancelInterimStatementsNote(preview),
    },
  };
}
