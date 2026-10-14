import { CompanySnapshotPrice } from "./CompanySnapshotPrice";
import { CompanySnapshotAnnual } from "./CompanySnapshotAnnual";
import { useSyncExternalStore } from "react";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedAnnualReport } from "./managed-annual-report";
import type { ManagedEodHistory } from "./managed-eod-history";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import "./managed-company-snapshot.css";

export function ManagedCompanySnapshot({
  selection,
  price,
  annual,
  onSection,
}: {
  selection: ManagedResearchSelection;
  price: ManagedEodHistory;
  annual: ManagedAnnualReport;
  onSection: (section: "eod" | "annual") => void;
}) {
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
  return (
    <CompanySnapshotView
      evidence={companySnapshotEvidence(selection, priceState, annualState)}
      onSection={onSection}
    />
  );
}

export function CompanySnapshotView({
  evidence,
  onSection,
}: {
  evidence: ReturnType<typeof companySnapshotEvidence>;
  onSection: (section: "eod" | "annual") => void;
}) {
  return (
    <details className="managed-company-snapshot">
      <summary>Loaded research snapshot</summary>
      <p>
        Evidence already loaded for this company visit. Opening this snapshot
        makes no request. Dates and bases stay separate.
      </p>
      <div className="managed-snapshot-grid">
        <CompanySnapshotPrice
          state={evidence.price}
          onOpen={() => onSection("eod")}
        />
        <CompanySnapshotAnnual
          state={evidence.annual}
          onOpen={() => onSection("annual")}
        />
      </div>
    </details>
  );
}
