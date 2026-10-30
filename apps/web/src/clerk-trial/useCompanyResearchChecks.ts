import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";

export function useCompanyResearchChecks(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
) {
  useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
    workspace.coordinator.getSnapshot,
  );
  useSyncExternalStore(
    workspace.portfolio.subscribe,
    workspace.portfolio.getSnapshot,
    workspace.portfolio.getSnapshot,
  );
  useSyncExternalStore(
    workspace.portfolio.coordinator.subscribe,
    workspace.portfolio.coordinator.getSnapshot,
    workspace.portfolio.coordinator.getSnapshot,
  );
  useSyncExternalStore(
    workspace.followups.subscribe,
    workspace.followups.getSnapshot,
    workspace.followups.getSnapshot,
  );
  useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
    workspace.followups.coordinator.getSnapshot,
  );
  useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
    workspace.sessionOwner.getSnapshot,
  );
  useSyncExternalStore(
    workspace.annual.subscribe,
    workspace.annual.getSnapshot,
    workspace.annual.getSnapshot,
  );
  useSyncExternalStore(
    workspace.interim.subscribe,
    workspace.interim.getSnapshot,
    workspace.interim.getSnapshot,
  );
  useSyncExternalStore(
    workspace.filings.subscribe,
    workspace.filings.getSnapshot,
    workspace.filings.getSnapshot,
  );
  useSyncExternalStore(
    workspace.eod.subscribe,
    workspace.eod.getSnapshot,
    workspace.eod.getSnapshot,
  );
  useSyncExternalStore(
    workspace.valuationAssumptions.coordinator.subscribe,
    workspace.valuationAssumptions.coordinator.getSnapshot,
    workspace.valuationAssumptions.coordinator.getSnapshot,
  );
  return workspace.getCompanyResearchChecks(selection);
}
