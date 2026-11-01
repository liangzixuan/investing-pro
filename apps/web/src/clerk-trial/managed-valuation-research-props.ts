import { createElement } from "react";
import { ManagedValuationCollectionDraftFiles } from "./ManagedValuationCollectionDraftFiles";
import type { ManagedValuationCollectionDraftFileDeliveryAdapter } from "./valuation-collection-draft-file-delivery";
import { ManagedValuationFollowup } from "./ManagedValuationFollowup";
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
  | "valuationReassessment"
  | "valuationNoteActions"
  | "valuationRevenueBasisActions"
  | "valuationDraftFiles"
  | "valuationCollectionFiles"
  | "valuationFollowup"
>;

export function managedValuationResearchProps(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
  files?: {
    accountScope: Promise<string> | undefined;
    delivery: ManagedValuationDraftFileDeliveryAdapter | undefined;
    collectionDelivery?:
      ManagedValuationCollectionDraftFileDeliveryAdapter | undefined;
    navigationPending: boolean;
    routeActive: () => boolean;
  },
): ValuationResearchProps {
  return {
    valuationFollowup: createElement(ManagedValuationFollowup, {
      valuation: workspace.valuation,
      owner: selection,
      navigationPending: files?.navigationPending ?? false,
      actions: {
        model: workspace.followups,
        getContext: () => workspace.captureValuationFollowup(selection),
        canLoad: () => workspace.canLoadValuationFollowups(selection),
        load: (formIsCurrent) =>
          workspace.loadValuationFollowups(selection, formIsCurrent),
      },
    }),
    valuationCollectionFiles: files?.accountScope
      ? createElement(ManagedValuationCollectionDraftFiles, {
          workspace,
          accountScope: files.accountScope,
          delivery: files.collectionDelivery,
          navigationPending: files.navigationPending,
          routeActive: files.routeActive,
        })
      : null,
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
    valuationReassessment: workspace.valuationReassessment,
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
