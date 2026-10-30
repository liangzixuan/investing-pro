import type { CompanyReportComparisonCheckTarget } from "./company-report-comparison-check-target";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";

export interface CompanyReportComparisonCheckActions {
  readonly target: () => CompanyReportComparisonCheckTarget | null;
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => readonly unknown[];
}

/** Observe all existing owners without starting a read or creating an attachment. */
export function companyReportComparisonCheckActions(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
  routeActive: () => boolean,
): CompanyReportComparisonCheckActions {
  const owners = [
    workspace,
    workspace.sessionOwner,
    workspace.coordinator,
    workspace.followups,
    workspace.followups.coordinator,
    workspace.portfolio,
    workspace.portfolio.coordinator,
    workspace.valuation,
    workspace.valuationAssumptions,
    workspace.valuationAssumptions.coordinator,
    workspace.annual,
    workspace.interim,
    workspace.eod,
    workspace.filings,
  ];
  let snapshot: readonly unknown[] = [];
  return {
    target: () =>
      workspace.captureCompanyReportComparisonCheckTarget(
        selection,
        routeActive,
      ),
    subscribe: (listener) => {
      const stops = owners.map((owner) => owner.subscribe(listener));
      return () => stops.forEach((stop) => stop());
    },
    getSnapshot: () => {
      const next = owners.map((owner) => owner.getSnapshot());
      if (next.some((value, index) => value !== snapshot[index]))
        snapshot = next;
      return snapshot;
    },
  };
}
