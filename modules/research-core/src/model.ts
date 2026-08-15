import type {
  EvidencePassportDto,
  InstrumentDto,
  MetricUnit,
  QualityState,
} from "@research-cockpit/contracts";

export type AuthorizedPurpose =
  "display" | "derive" | "alert" | "export" | "ai";

export interface RightsPolicy {
  id: string;
  version: string;
  classification: "synthetic";
  allowedPurposes: AuthorizedPurpose[];
  channels: Array<"api" | "web" | "local_alert">;
  territory: "demo_only";
  expiresAt: null;
}

export interface FinancialFact {
  id: string;
  instrumentId: string;
  key: string;
  value: string;
  unit: MetricUnit;
  periodEnd: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  systemFrom: string;
  systemTo: string | null;
  availableAt: string;
  evidenceId: string;
  rightsPolicyId: string;
  qualityState: QualityState;
}

export interface SyntheticFixture {
  instrument: InstrumentDto;
  rightsPolicies: RightsPolicy[];
  facts: FinancialFact[];
  evidence: EvidencePassportDto[];
}
