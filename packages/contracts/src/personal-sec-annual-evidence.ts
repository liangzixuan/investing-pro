import type { PersonalMarketDataIdentityDto } from "./index";
import type {
  PersonalSecQuarterlyConcept,
  PersonalSecQuarterlyObservationDto,
  PersonalSecQuarterlySourceStatus,
} from "./personal-sec-quarterly-evidence";

export const PERSONAL_SEC_ANNUAL_EVIDENCE_SCHEMA_VERSION = "1.0.0" as const;
export const PERSONAL_SEC_ANNUAL_DEFINITION_VERSION = "1.0.0" as const;
export const PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS = Object.freeze([
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
] as const);
export type PersonalSecAnnualRevenueConcept =
  (typeof PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS)[number];
export const PERSONAL_SEC_ANNUAL_TARGET_REASONS = Object.freeze([
  "submissions_unavailable",
  "invalid_submissions",
  "invalid_clock",
  "target_missing_report_date",
  "no_observed_annual_target",
  "report_date_missing",
  "filed_date_missing",
  "future_or_inconsistent_dates",
  "cutoff_time_unresolved",
  "target_ambiguous",
] as const);
export type PersonalSecAnnualTargetReason =
  (typeof PERSONAL_SEC_ANNUAL_TARGET_REASONS)[number];
export const PERSONAL_SEC_ANNUAL_REFUSAL_REASONS = Object.freeze([
  "source_unavailable",
  "invalid_source_rows",
  "target_unresolved",
  "selected_report_overflow",
  "invalid_clock",
  "source_stale",
] as const);
export type PersonalSecAnnualRefusalReason =
  (typeof PERSONAL_SEC_ANNUAL_REFUSAL_REASONS)[number];
export const PERSONAL_SEC_ANNUAL_PAIR_REASONS = Object.freeze([
  "unsupported_form",
  "missing_or_non_FY_focus",
  "invalid_annual_period",
  "filing_unmatched_or_conflicted",
  "report_end_mismatch",
  "future_or_inconsistent_dates",
  "cutoff_time_unresolved",
  "report_date_missing",
  "filed_date_missing",
  "ambiguous_revenue_period_or_value",
  "income_missing_same_filing_period",
  "income_metadata_or_period_invalid",
  "ambiguous_income_value",
  "nonpositive_revenue",
] as const);
export type PersonalSecAnnualPairReason =
  (typeof PERSONAL_SEC_ANNUAL_PAIR_REASONS)[number];
export const PERSONAL_SEC_ANNUAL_DIAGNOSTIC_REASONS = Object.freeze([
  ...PERSONAL_SEC_ANNUAL_PAIR_REASONS,
  "income_only_other_period_or_accession",
  "no_income_observations",
] as const);
export type PersonalSecAnnualDiagnosticReason =
  (typeof PERSONAL_SEC_ANNUAL_DIAGNOSTIC_REASONS)[number];

/** Current Submissions metadata, not evidence of complete issuer filing history. */
export interface PersonalSecAnnualFilingDto {
  readonly accessionNumber: string;
  readonly form: string;
  readonly filedDate: string | null;
  readonly reportDate: string | null;
  readonly acceptedAt: string | null;
}
export type PersonalSecAnnualTargetDto =
  | Readonly<{
      status: "target";
      accessionNumber: string;
      form: "10-K" | "20-F";
      filedDate: string;
      reportDate: string;
      acceptedAt: string | null;
    }>
  | Readonly<{ status: "unresolved"; reason: PersonalSecAnnualTargetReason }>;
export interface PersonalSecAnnualSourceDto {
  readonly status: PersonalSecQuarterlySourceStatus;
  readonly sourceUrl: string;
  /** Capture after the bounded body read; null when no body was captured. */
  readonly fetchedAt: string | null;
  readonly sha256: `sha256:${string}` | null;
  readonly bytes: number | null;
}
export interface PersonalSecAnnualGenerationDto {
  readonly definitionVersion: typeof PERSONAL_SEC_ANNUAL_DEFINITION_VERSION;
  /** Captured once at the start of this explicit load. */
  readonly cutoffAt: string;
  readonly completedAt: string;
  readonly sources: Readonly<{
    companyFacts: PersonalSecAnnualSourceDto;
    submissions: PersonalSecAnnualSourceDto;
  }>;
  /** SHA-256 of the shared canonical generation serialization, not authorization. */
  readonly sha256: `sha256:${string}`;
}
export interface PersonalSecAnnualMetricCountsDto {
  readonly observations: number;
  readonly revenue: number;
  readonly netIncome: number;
}
export interface PersonalSecAnnualCoverageDto {
  readonly full: PersonalSecAnnualMetricCountsDto &
    Readonly<{
      inspectedRows: number;
      invalidRows: number;
      duplicateRows: number;
      uniqueObservations: number;
      conceptsWithoutUsd: readonly PersonalSecQuarterlyConcept[];
    }>;
  /** Null if no observed target was resolved. No inferred empty selection. */
  readonly selected: PersonalSecAnnualMetricCountsDto | null;
  readonly otherAccessions: PersonalSecAnnualMetricCountsDto | null;
  readonly returned: PersonalSecAnnualMetricCountsDto;
  readonly omittedSelected: PersonalSecAnnualMetricCountsDto | null;
  /** Truthful original history retention; never renamed selected completeness. */
  readonly history: Readonly<{
    returned: PersonalSecAnnualMetricCountsDto;
    truncated: boolean;
  }>;
}
export interface PersonalSecAnnualPairDto {
  readonly accessionNumber: string;
  readonly concept: PersonalSecAnnualRevenueConcept;
  readonly startDate: string | null;
  readonly endDate: string;
  readonly status: "eligible" | PersonalSecAnnualPairReason;
  readonly subordinateReasons: readonly PersonalSecAnnualDiagnosticReason[];
  readonly revenue: string | null;
  readonly netIncome: string | null;
  readonly netMarginPercent: string | null;
  /** Exact ordered IDs in evidence.observations; no duplicated raw packet. */
  readonly revenueObservationIds: readonly `sec-fact:${string}`[];
  readonly incomeObservationIds: readonly `sec-fact:${string}`[];
}
export interface PersonalSecAnnualBasisDto {
  readonly concept: PersonalSecAnnualRevenueConcept;
  readonly status: "eligible" | "rejected" | "missing" | "withheld";
  /** Only requested report-end pairs; all comparative pairs remain in resolution.pairs. */
  readonly pairs: readonly PersonalSecAnnualPairDto[];
}
export interface PersonalSecAnnualResolutionDto {
  readonly pairs: readonly PersonalSecAnnualPairDto[];
  readonly bases: readonly PersonalSecAnnualBasisDto[];
  readonly selectedReportPairEligible: boolean;
  readonly currentTargetEligible: boolean;
  readonly utilityAge: Readonly<{
    endAgeDays: number;
    sourceAgeDays: readonly [number, number];
    withinWindow: boolean;
  }> | null;
}
export interface PersonalSecAnnualEvidenceDto {
  readonly cik: string;
  readonly generation: PersonalSecAnnualGenerationDto;
  /** Server selection over the full bounded Submissions source, before values. */
  readonly target: PersonalSecAnnualTargetDto;
  readonly targetScan: Readonly<{
    currentFilings: number;
    annualFilings: number;
    olderHistoryAvailable: boolean;
  }> | null;
  readonly completeness:
    | Readonly<{ status: "complete"; reason: null }>
    | Readonly<{ status: "refused"; reason: PersonalSecAnnualRefusalReason }>;
  /** Null when the full CompanyFacts scan was unavailable/invalid. */
  readonly coverage: PersonalSecAnnualCoverageDto | null;
  /** Every selected-accession observation before annual filtering; at most100/100. */
  readonly observations: readonly PersonalSecQuarterlyObservationDto[];
  readonly resolution: PersonalSecAnnualResolutionDto;
}
export type PersonalSecAnnualResolutionInput = Omit<
  PersonalSecAnnualEvidenceDto,
  "resolution"
>;
export interface PersonalSecAnnualEvidenceRequestDto {
  readonly schemaVersion: typeof PERSONAL_SEC_ANNUAL_EVIDENCE_SCHEMA_VERSION;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listingId: string;
  readonly symbol: string;
}
export interface PersonalSecAnnualEvidenceResponseDto {
  readonly schemaVersion: typeof PERSONAL_SEC_ANNUAL_EVIDENCE_SCHEMA_VERSION;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly security: PersonalMarketDataIdentityDto & {
    readonly issuerId: string;
    readonly cik: string;
  };
  readonly evidence: PersonalSecAnnualEvidenceDto;
}
