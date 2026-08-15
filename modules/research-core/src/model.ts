import type {
  EvidencePassportDto,
  InstrumentDto,
  MetricUnit,
  QualityState,
} from "@research-cockpit/contracts";

export type AuthorizedPurpose =
  "display" | "derive" | "alert" | "export" | "ai";

export type AuthorizedChannel = "api" | "web" | "local_alert";

export interface RightsGrant {
  purpose: AuthorizedPurpose;
  channel: AuthorizedChannel;
  allowed: boolean;
}

export interface RightsPolicy {
  id: string;
  version: string;
  classification: "synthetic";
  grants: RightsGrant[];
  territory: string;
  expiresAt: string | null;
}

export interface FinancialFact {
  id: string;
  instrumentId: string;
  key: string;
  value: string;
  unit: MetricUnit;
  /** Financial reporting-period end, independent of publication or ingestion time. */
  reportingPeriodEnd: string;
  /** Half-open interval during which the fact was publicly known. */
  publicKnownFrom: string;
  publicKnownTo: string | null;
  /** Half-open interval during which this record existed in the research system. */
  systemRecordedFrom: string;
  systemRecordedTo: string | null;
  /** Timestamp at which the underlying synthetic source became publicly available. */
  sourceAvailableAt: string;
  evidenceId: string;
  rightsPolicyId: string;
  rightsPolicyVersion: string;
  qualityState: QualityState;
}

export interface ResearchSnapshot {
  dataMode: "synthetic";
  /** Deterministic snapshot/composition time; this is not a live clock. */
  generatedAt: string;
  instrument: InstrumentDto;
  rightsPolicies: RightsPolicy[];
  facts: FinancialFact[];
  evidence: EvidencePassportDto[];
}

export type SyntheticFixture = ResearchSnapshot;
