import { CompanySnapshotPrice } from "./CompanySnapshotPrice";
import { CompanySnapshotAnnual } from "./CompanySnapshotAnnual";
import { CompanySnapshotFilings } from "./CompanySnapshotFilings";
import {
  useCompanySnapshotEvidence,
  type CompanyEvidenceModels,
} from "./useCompanySnapshotEvidence";
import type { companySnapshotEvidence } from "./managed-company-snapshot";
import "./managed-company-snapshot.css";

export function ManagedCompanySnapshot({
  navigationPending,
  onSection,
  ...models
}: CompanyEvidenceModels & {
  navigationPending: boolean;
  onSection: (section: "eod" | "annual" | "filings") => void;
}) {
  const evidence = useCompanySnapshotEvidence(models);
  return (
    <CompanySnapshotView
      evidence={evidence}
      onSection={onSection}
      navigationPending={navigationPending}
    />
  );
}

export function CompanySnapshotView({
  navigationPending,
  evidence,
  onSection,
}: {
  navigationPending: boolean;
  evidence: ReturnType<typeof companySnapshotEvidence>;
  onSection: (section: "eod" | "annual" | "filings") => void;
}) {
  return (
    <details className="managed-company-snapshot">
      <summary>Loaded research snapshot</summary>
      <p>
        Evidence already loaded for this company visit. Opening this snapshot
        makes no request. Dates and bases stay separate.
      </p>
      <CompanySnapshotEvidenceView
        evidence={evidence}
        onSection={onSection}
        navigationPending={navigationPending}
      />
    </details>
  );
}

export function CompanySnapshotEvidenceView({
  navigationPending,
  evidence,
  onSection,
}: {
  navigationPending: boolean;
  evidence: ReturnType<typeof companySnapshotEvidence>;
  onSection: (section: "eod" | "annual" | "filings") => void;
}) {
  return (
    <div className="managed-snapshot-grid">
      <CompanySnapshotPrice
        navigationPending={navigationPending}
        state={evidence.price}
        onOpen={() => onSection("eod")}
      />
      <CompanySnapshotAnnual
        navigationPending={navigationPending}
        state={evidence.annual}
        onOpen={() => onSection("annual")}
      />
      <CompanySnapshotFilings
        navigationPending={navigationPending}
        state={evidence.filings}
        onOpen={() => onSection("filings")}
      />
    </div>
  );
}
