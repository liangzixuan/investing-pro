import type { ComponentProps } from "react";
import type { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedWorkspace } from "./managed-workspace";

type ValuationResearchProps = Pick<
  ComponentProps<typeof ManagedCompanyResearch>,
  "valuation" | "valuationAssumptions" | "valuationNoteActions"
>;

export function managedValuationResearchProps(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
): ValuationResearchProps {
  return {
    valuation: workspace.valuation,
    valuationAssumptions: workspace.valuationAssumptions,
    valuationNoteActions: {
      prepare: (model, scenario, includePriceComparison) =>
        workspace.prepareValuationNote(
          selection,
          model,
          scenario,
          includePriceComparison,
        ),
      isCurrent: (preview) => workspace.valuationNotePreviewIsCurrent(preview),
      append: (preview) => workspace.appendValuationNote(preview),
    },
  };
}
