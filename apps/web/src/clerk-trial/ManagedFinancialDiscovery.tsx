import { ManagedPortfolioScreenSelection } from "./ManagedPortfolioScreenSelection";
import type { ManagedCompanyNavigation } from "./useManagedCompanyNavigation";
import { useManagedScreenRecipeRoute } from "./useManagedScreenRecipeRoute";
import type { ScreenComparisonReportDeliveryAdapter } from "./screen-comparison-report-ports";
import type { ManagedFinancialScreenRecipeDeliveryAdapter } from "./financial-screen-recipe-delivery";
import { ManagedFinancialScreen } from "./ManagedFinancialScreen";
import { ManagedScreenComparisonFollowup } from "./ManagedScreenComparisonFollowup";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import { ManagedScreenShortlistWatchlist } from "./ManagedScreenShortlistWatchlist";
import type { ManagedFinancialScreenReportCapture } from "./managed-financial-screen";
import type { ManagedWorkspace } from "./managed-workspace";

interface Props {
  readonly workspace: ManagedWorkspace;
  readonly recipeDelivery?: ManagedFinancialScreenRecipeDeliveryAdapter;
  readonly comparisonReportDelivery?: ScreenComparisonReportDeliveryAdapter;
  readonly recipesRouteActive: () => boolean;
  readonly navigationPending: boolean;
  readonly onOpenReport: (
    capture: ManagedFinancialScreenReportCapture,
    opener: HTMLButtonElement,
  ) => void;
  readonly onReviewWatchlist: () => void;
  readonly onReviewFollowup: (
    entry: ResearchFollowup,
    opener: HTMLButtonElement,
  ) => void;
}

/** Keep screening and the explicit draft handoff in the same discovery flow. */
export function ManagedFinancialDiscovery(props: Props) {
  return (
    <>
      <ManagedPortfolioScreenSelection
        workspace={props.workspace}
        routeActive={props.recipesRouteActive}
      />
      <ManagedFinancialScreen
        model={props.workspace.financialScreen}
        onOpenReport={props.onOpenReport}
        recipesRouteActive={props.recipesRouteActive}
        {...(props.comparisonReportDelivery
          ? { comparisonReportDelivery: props.comparisonReportDelivery }
          : {})}
        {...(props.recipeDelivery
          ? { recipeDelivery: props.recipeDelivery }
          : {})}
      />
      <ManagedScreenComparisonFollowup
        workspace={props.workspace}
        routeActive={props.recipesRouteActive}
        navigationPending={props.navigationPending}
        onReview={props.onReviewFollowup}
      />
      <ManagedScreenShortlistWatchlist
        workspace={props.workspace}
        navigationPending={props.navigationPending}
        onReviewWatchlist={props.onReviewWatchlist}
      />
    </>
  );
}

interface DiscoveryOptions {
  readonly workspace: ManagedWorkspace;
  readonly navigation: ManagedCompanyNavigation | undefined;
  readonly openResearch: (
    opener: HTMLButtonElement,
    action: () => void,
  ) => void;
  readonly onReviewWatchlist: () => void;
  readonly onReviewFollowup: Props["onReviewFollowup"];
  readonly recipeDelivery:
    ManagedFinancialScreenRecipeDeliveryAdapter | undefined;
  readonly comparisonReportDelivery:
    ScreenComparisonReportDeliveryAdapter | undefined;
}

export function useManagedFinancialDiscovery({
  workspace,
  navigation,
  openResearch,
  onReviewWatchlist,
  onReviewFollowup,
  recipeDelivery,
  comparisonReportDelivery,
}: DiscoveryOptions): Props {
  const recipesRouteActive = useManagedScreenRecipeRoute(workspace, navigation);
  return {
    workspace,
    navigationPending: navigation?.pending ?? false,
    ...(recipeDelivery ? { recipeDelivery } : {}),
    ...(comparisonReportDelivery ? { comparisonReportDelivery } : {}),
    recipesRouteActive,
    onReviewWatchlist,
    onReviewFollowup,
    onOpenReport: (capture, opener) =>
      openResearch(opener, () => workspace.openFinancialScreenReport(capture)),
  };
}
