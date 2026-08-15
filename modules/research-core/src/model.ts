import type {
  EvidencePassportDto,
  InstrumentDto,
  MetricUnit,
  QualityState,
  TimelineEventDto,
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

/**
 * One instrument-scoped historical series version. Knowledge and system
 * intervals are half-open so a restatement can replace the point without the
 * composer manufacturing a value from a different record collection.
 */
export interface HistoricalPointRecord {
  id: string;
  instrumentId: string;
  synthetic: true;
  period: string;
  revenue: string;
  ebitda: string;
  sourceAvailableAt: string;
  publicKnownFrom: string;
  publicKnownTo: string | null;
  systemRecordedFrom: string;
  systemRecordedTo: string | null;
  evidenceIds: string[];
}

/**
 * An immutable, instrument-scoped event supplied by the snapshot adapter.
 * Its cited evidence's publication time is the event-text availability gate.
 */
export interface TimelineEventRecord {
  id: string;
  instrumentId: string;
  synthetic: true;
  occurredAt: string;
  kind: TimelineEventDto["kind"];
  title: string;
  summary: string;
  evidenceIds: string[];
}

/**
 * Explicit shared-evidence membership for an instrument snapshot. Evidence
 * passports remain reusable source records; a binding determines whether one
 * may cross this instrument projection boundary.
 */
export interface InstrumentEvidenceBinding {
  instrumentId: string;
  evidenceId: string;
  projectionOrder: number;
  synthetic: true;
}

export interface ResearchSnapshot {
  dataMode: "synthetic";
  /** Deterministic snapshot/composition time; this is not a live clock. */
  generatedAt: string;
  instrument: InstrumentDto;
  rightsPolicies: RightsPolicy[];
  facts: FinancialFact[];
  evidence: EvidencePassportDto[];
  evidenceBindings: InstrumentEvidenceBinding[];
  historicalPoints: HistoricalPointRecord[];
  timelineEvents: TimelineEventRecord[];
}

export type SyntheticFixture = ResearchSnapshot;
