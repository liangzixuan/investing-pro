import { ManagedFinancialScreen } from "./ManagedFinancialScreen";
import { ManagedScreenShortlistWatchlist } from "./ManagedScreenShortlistWatchlist";
import type { ManagedFinancialScreenReportCapture } from "./managed-financial-screen";
import type { ManagedWorkspace } from "./managed-workspace";

interface Props {
  readonly workspace: ManagedWorkspace;
  readonly navigationPending: boolean;
  readonly onOpenReport: (
    capture: ManagedFinancialScreenReportCapture,
    opener: HTMLButtonElement,
  ) => void;
  readonly onReviewWatchlist: () => void;
}

/** Keep screening and the explicit draft handoff in the same discovery flow. */
export function ManagedFinancialDiscovery(props: Props) {
  return (
    <>
      <ManagedFinancialScreen
        model={props.workspace.financialScreen}
        onOpenReport={props.onOpenReport}
      />
      <ManagedScreenShortlistWatchlist
        workspace={props.workspace}
        navigationPending={props.navigationPending}
        onReviewWatchlist={props.onReviewWatchlist}
      />
    </>
  );
}

export function managedFinancialDiscoveryProps(
  workspace: ManagedWorkspace,
  navigationPending: boolean,
  openResearch: (opener: HTMLButtonElement, action: () => void) => void,
  onReviewWatchlist: () => void,
): Props {
  return {
    workspace,
    navigationPending,
    onReviewWatchlist,
    onOpenReport: (capture, opener) =>
      openResearch(opener, () => workspace.openFinancialScreenReport(capture)),
  };
}
