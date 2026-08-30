export type DataMode = "synthetic";
export type QualityState = "verified_fixture" | "restated_fixture";
export type MetricUnit =
  "USD_MILLIONS" | "USD_PER_SHARE" | "MILLIONS_SHARES" | "PERCENT" | "RATIO";

export interface InstrumentDto {
  id: string;
  symbol: string;
  name: string;
  description: string;
  exchangeLabel: string;
  sector: string;
  industry: string;
  country: string;
  currency: "USD";
  isSynthetic: true;
}

export interface MetricDto {
  key: string;
  label: string;
  category:
    "scale" | "growth" | "profitability" | "cash" | "leverage" | "market";
  value: string;
  displayValue: string;
  unit: MetricUnit;
  definitionId: string;
  definitionVersion: string;
  formula: string;
  formulaInputs: string[];
  evidenceIds: string[];
  qualityState: QualityState;
  asOf: string;
}

export interface HistoricalPointDto {
  period: string;
  revenue: string;
  ebitda: string;
  revenueDisplay: string;
  ebitdaDisplay: string;
  evidenceIds: string[];
}

export interface TimelineEventDto {
  id: string;
  occurredAt: string;
  kind: "filing" | "restatement";
  title: string;
  summary: string;
  evidenceIds: string[];
}

export interface EvidencePassportDto {
  id: string;
  title: string;
  sourceType: "synthetic_filing" | "synthetic_price_record";
  documentId: string;
  locator: string;
  excerpt: string;
  contentHash: string;
  /** Underlying synthetic source-publication time. */
  availableAt: string;
  /** Half-open public-knowledge interval; not database system time. */
  knownFrom: string;
  knownTo: string | null;
  rightsPolicyId: string;
  rightsPolicyVersion: string;
  synthetic: true;
}

export interface OmissionSummaryDto {
  hasOmissions: boolean;
  /** Exact in memory; nullable when a future repository cannot disclose a count. */
  count: number | null;
  reasonCode: "RIGHTS_DENIED";
  explanation: string;
}

export interface ValuationDefaultsDto {
  baseRevenue: string;
  cash: string;
  debt: string;
  dilutedShares: string;
  evidenceIds: string[];
  modelVersion: "exit-multiple-v1";
}

export interface DossierDto {
  schemaVersion: "1.0.0";
  dataMode: DataMode;
  demoDisclosure: string;
  requestedKnownAt: string;
  generatedAt: string;
  instrument: InstrumentDto;
  metrics: MetricDto[];
  history: HistoricalPointDto[];
  timeline: TimelineEventDto[];
  evidence: EvidencePassportDto[];
  valuationDefaults: ValuationDefaultsDto;
  omissions: OmissionSummaryDto;
}

export interface PersonalFilingReadinessDto {
  schemaVersion: "1.0.0";
  profile: "personal_single_user_local";
  status: "quality_gate_ready";
  dataPlane: "disabled";
}

export interface ValuationInputDto {
  baseRevenue: string;
  cash: string;
  debt: string;
  dilutedShares: string;
  annualRevenueGrowthPercent: string;
  targetEbitdaMarginPercent: string;
  discountRatePercent: string;
  exitMultiple: string;
  horizonYears: number;
}

export interface ValuationResultDto {
  schemaVersion: "1.0.0";
  modelVersion: "exit-multiple-v1";
  yearNRevenue: string;
  yearNEbitda: string;
  terminalEnterpriseValue: string;
  presentEnterpriseValue: string;
  equityValue: string;
  valuePerShare: string;
  formulaTrace: string[];
}

/**
 * Complete replacement payload for the bounded synthetic thesis update route.
 * Identity and tenancy come only from the server-resolved demo context;
 * version and idempotency come from strict precondition headers. None is
 * accepted in this body.
 */
export interface ThesisWriteRequestDto {
  instrumentId: string;
  claim: string;
  evidence: string;
  risks: string;
  invalidation: string;
}

/** Complete replacement payload for the bounded synthetic alert update route. */
export interface AlertWriteRequestDto {
  instrumentId: string;
  metricKey: string;
  operator: AlertOperator;
  threshold: string;
}

export interface ThesisWriteResponseDto {
  schemaVersion: "1.0.0";
  synthetic: true;
  id: string;
  instrumentId: string;
  claim: string;
  evidence: string;
  risks: string;
  invalidation: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlertWriteResponseDto {
  schemaVersion: "1.0.0";
  synthetic: true;
  id: string;
  instrumentId: string;
  metricKey: string;
  operator: AlertOperator;
  threshold: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LocalThesisDto {
  schemaVersion: "1.0.0";
  instrumentId: string;
  claim: string;
  evidence: string;
  risks: string;
  invalidation: string;
  updatedAt: string;
}

export type AlertOperator = "above" | "below";

export interface LocalAlertRuleDto {
  schemaVersion: "1.0.0";
  id: string;
  instrumentId: string;
  metricKey: string;
  operator: AlertOperator;
  threshold: string;
  createdAt: string;
}

export interface AlertEvaluationDto {
  schemaVersion: "1.0.0";
  eventId: string;
  dedupeKey: string;
  ruleId: string;
  metricKey: string;
  metricValue: string;
  threshold: string;
  operator: AlertOperator;
  triggered: boolean;
  evaluatedAt: string;
  deliveryMode: "local_demo_only";
}

export interface ProblemDetailsDto {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  traceId: string;
}
