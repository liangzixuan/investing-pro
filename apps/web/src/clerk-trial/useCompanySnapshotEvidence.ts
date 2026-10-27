import { useSyncExternalStore } from "react";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedInterimReport } from "./managed-interim-report";
import type { ManagedAnnualReport } from "./managed-annual-report";
import type { ManagedEodHistory } from "./managed-eod-history";
import type { ManagedCompanyFilings } from "./managed-company-filings";
import { companySnapshotEvidence } from "./managed-company-snapshot";

export interface CompanyEvidenceModels {
  selection: ManagedResearchSelection;
  price: ManagedEodHistory;
  annual: ManagedAnnualReport;
  interim: ManagedInterimReport;
  filings: ManagedCompanyFilings;
}

/** Observe the existing visit models; subscribing never starts a request. */
export function useCompanySnapshotEvidence({
  selection,
  price,
  annual,
  interim,
  filings,
}: CompanyEvidenceModels) {
  const priceState = useSyncExternalStore(
    price.subscribe,
    price.getSnapshot,
    price.getSnapshot,
  );
  const annualState = useSyncExternalStore(
    annual.subscribe,
    annual.getSnapshot,
    annual.getSnapshot,
  );
  const filingsState = useSyncExternalStore(
    filings.subscribe,
    filings.getSnapshot,
    filings.getSnapshot,
  );
  const interimState = useSyncExternalStore(
    interim.subscribe,
    interim.getSnapshot,
    interim.getSnapshot,
  );
  return companySnapshotEvidence(
    selection,
    priceState,
    annualState,
    filingsState,
    interimState,
  );
}
