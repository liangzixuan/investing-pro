import type {
  PersonalSecAnnualGenerationDto,
  PersonalSecAnnualResolutionDto,
  PersonalSecAnnualTargetDto,
} from "./personal-sec-annual-evidence";
import type { PersonalSecQuarterlyObservationDto } from "./personal-sec-quarterly-evidence";

export const PERSONAL_SEC_ANNUAL_SCAN_STATUSES = Object.freeze([
  "available",
  "source_unavailable",
  "invalid_response",
  "candidate_limit",
] as const);
export type PersonalSecAnnualScanStatus =
  (typeof PERSONAL_SEC_ANNUAL_SCAN_STATUSES)[number];

export const PERSONAL_SEC_ANNUAL_CASH_CONCEPTS = Object.freeze([
  "NetCashProvidedByUsedInOperatingActivities",
  "PaymentsToAcquirePropertyPlantAndEquipment",
] as const);
export type PersonalSecAnnualCashConcept =
  (typeof PERSONAL_SEC_ANNUAL_CASH_CONCEPTS)[number];
export type PersonalSecAnnualCashMetric =
  "operating_cash_flow" | "ppe_purchases";

export const PERSONAL_SEC_ANNUAL_CASH_LIMITS = Object.freeze({
  candidateRowsPerMetric: 10_000,
  observationsPerMetric: 100,
  decimalCharacters: 64,
} as const);

export const PERSONAL_SEC_ANNUAL_CASH_ABSENCES = Object.freeze([
  "concept_missing",
  "usd_missing",
  "empty_usd",
] as const);
export type PersonalSecAnnualCashAbsence =
  (typeof PERSONAL_SEC_ANNUAL_CASH_ABSENCES)[number];

export const PERSONAL_SEC_ANNUAL_CASH_REASONS = Object.freeze([
  "invalid_clock",
  "source_unavailable",
  "source_stale",
  "target_unresolved",
  "invalid_response",
  "candidate_limit",
  "invalid_source_rows",
  "selected_report_overflow",
  ...PERSONAL_SEC_ANNUAL_CASH_ABSENCES,
  "no_report_period",
  "unsupported_form",
  "missing_or_non_FY_focus",
  "invalid_annual_period",
  "filing_unmatched_or_conflicted",
  "report_end_mismatch",
  "future_or_inconsistent_dates",
  "cutoff_time_unresolved",
  "report_date_missing",
  "filed_date_missing",
  "ambiguous_period",
  "ambiguous_value",
  "period_mismatch",
  "filing_mismatch",
  "unsupported_sign",
] as const);
export type PersonalSecAnnualCashUnavailableReason =
  (typeof PERSONAL_SEC_ANNUAL_CASH_REASONS)[number];

type CashObservationMetadata = Omit<
  PersonalSecQuarterlyObservationDto,
  "metric" | "concept"
>;
/** Annual-only fixed concept/metric pairs; quarterly admission is unchanged. */
export type PersonalSecAnnualCashObservationDto = CashObservationMetadata &
  (
    | Readonly<{
        metric: "operating_cash_flow";
        concept: "NetCashProvidedByUsedInOperatingActivities";
      }>
    | Readonly<{
        metric: "ppe_purchases";
        concept: "PaymentsToAcquirePropertyPlantAndEquipment";
      }>
  );

export interface PersonalSecAnnualCashCoverageDto {
  readonly full: Readonly<{
    candidateRows: number;
    inspectedRows: number;
    invalidRows: number;
    duplicateRows: number;
    uniqueObservations: number;
  }>;
  /** Null when the Submissions target is unresolved. */
  readonly selected: number | null;
  readonly otherAccessions: number | null;
  readonly returned: number;
  readonly omittedSelected: number | null;
}

export type PersonalSecAnnualCashScanDto =
  | Readonly<{
      /** Full fixed-concept scan completed, including any counted invalid rows. */
      status: "available";
      absence: PersonalSecAnnualCashAbsence | null;
      coverage: PersonalSecAnnualCashCoverageDto;
    }>
  | Readonly<{
      status: Exclude<PersonalSecAnnualScanStatus, "available">;
      absence: null;
      /** No fabricated complete counts after a failed/over-limit scan. */
      coverage: null;
    }>;

export interface PersonalSecAnnualCashMetricEvidenceDto {
  readonly scan: PersonalSecAnnualCashScanDto;
  /** Complete unique selected-accession rows before annual filtering, or none. */
  readonly observations: readonly PersonalSecAnnualCashObservationDto[];
}

export type PersonalSecAnnualCashValueDto =
  | Readonly<{
      status: "available";
      value: string;
      startDate: string;
      endDate: string;
      accessionNumber: string;
      observationIds: readonly `sec-fact:${string}`[];
      /** Historical amounts remain visible when this policy flag is false. */
      currentUseEligible: boolean;
    }>
  | Readonly<{
      status: "unavailable";
      reason: PersonalSecAnnualCashUnavailableReason;
      observationIds: readonly `sec-fact:${string}`[];
    }>;

export interface PersonalSecAnnualCashResolutionDto {
  readonly operatingCashFlow: PersonalSecAnnualCashValueDto;
  readonly ppePurchases: PersonalSecAnnualCashValueDto;
  readonly operatingCashFlowLessPpePurchases: PersonalSecAnnualCashValueDto;
  readonly utilityAge: PersonalSecAnnualResolutionDto["utilityAge"];
}

export interface PersonalSecAnnualCashGenerationDto {
  readonly operatingCashFlow: PersonalSecAnnualCashMetricEvidenceDto;
  readonly ppePurchases: PersonalSecAnnualCashMetricEvidenceDto;
  readonly resolution: PersonalSecAnnualCashResolutionDto;
}

export interface PersonalSecAnnualCashResolutionInput {
  readonly cik: string;
  readonly generation: PersonalSecAnnualGenerationDto;
  readonly target: PersonalSecAnnualTargetDto;
  readonly cashGeneration: Omit<
    PersonalSecAnnualCashGenerationDto,
    "resolution"
  >;
}
