import { createElement } from "react";
import { ManagedValuationDraftFiles } from "./ManagedValuationDraftFiles";
import type { ManagedValuationDraftFileDeliveryAdapter } from "./valuation-draft-file-delivery";
import type { ComponentProps } from "react";
import type { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedWorkspace } from "./managed-workspace";

type ValuationResearchProps = Pick<
  ComponentProps<typeof ManagedCompanyResearch>,
  | "valuation"
  | "valuationAssumptions"
  | "valuationNoteActions"
  | "valuationRevenueBasisActions"
  | "valuationDraftFiles"
>;

export function managedValuationResearchProps(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
  files?: {
    accountScope: Promise<string> | undefined;
    delivery: ManagedValuationDraftFileDeliveryAdapter | undefined;
    navigationPending: boolean;
    routeActive: () => boolean;
  },
): ValuationResearchProps {
  return {
    valuationDraftFiles: files?.accountScope
      ? createElement(ManagedValuationDraftFiles, {
          workspace,
          selection,
          accountScope: files.accountScope,
          delivery: files.delivery,
          navigationPending: files.navigationPending,
          routeActive: files.routeActive,
        })
      : null,
    valuation: workspace.valuation,
    valuationAssumptions: workspace.valuationAssumptions,
    valuationRevenueBasisActions: {
      prepare: (concept) =>
        workspace.prepareAnnualRevenueBasis(selection, concept),
      isCurrent: (preview) =>
        workspace.annualRevenueBasisPreviewIsCurrent(preview),
      apply: (preview) => workspace.applyAnnualRevenueBasis(preview),
      retirePreview: () => workspace.retireAnnualRevenueBasisPreview(),
      getApplied: () => workspace.getAppliedAnnualRevenueBasis(selection),
    },
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
