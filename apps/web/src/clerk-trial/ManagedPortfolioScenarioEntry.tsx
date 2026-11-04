import { useSyncExternalStore } from "react";
import {
  membershipMatchesResult,
  type PersonalPortfolioIdentity,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedPortfolioCloseReview } from "./managed-portfolio-close-review";
import type { PortfolioDraft } from "./managed-portfolio";
import { ManagedPortfolioValuationReview } from "./ManagedPortfolioValuationReview";

export function ManagedPortfolioScenarioEntry({
  workspace,
  prices,
  canPreview,
  navigationPending,
  onResearch,
}: {
  workspace: ManagedWorkspace;
  prices?: ManagedPortfolioCloseReview | undefined;
  canPreview: boolean;
  navigationPending: boolean;
  onResearch: (
    draft: PortfolioDraft,
    listing: PersonalPortfolioIdentity,
    opener: HTMLButtonElement,
  ) => void;
}) {
  useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const context = workspace.portfolioValuationReview;
  return (
    <ManagedPortfolioValuationReview
      model={context.model}
      assumptions={workspace.valuationAssumptions}
      workbench={workspace.valuation}
      active={
        !navigationPending && !!workspace.capturePortfolioWatchlistRoute()
      }
      canPreview={canPreview}
      onPreview={(expected) =>
        prices && canPreview ? context.preview(prices, expected) : null
      }
      canResearch={(row) => context.canResearch(row)}
      onResearch={(row, opener) => {
        const draft = workspace.portfolio.coordinator.getSnapshot().draft;
        const listing = draft?.ledger?.identities.find((identity) =>
          membershipMatchesResult(
            { ...identity, note: "" },
            row.selection.listing,
          ),
        );
        if (draft && listing)
          context.research(row, () => onResearch(draft, listing, opener));
      }}
    />
  );
}
