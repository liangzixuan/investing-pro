import type { PersonalSecAnnualScanStatus } from "./personal-sec-annual-cash-generation";
import type {
  PersonalSecAnnualResolutionDto,
  PersonalSecAnnualResolutionInput,
  PersonalSecAnnualRevenueConcept,
} from "./personal-sec-annual-evidence";
import type { PersonalSecQuarterlyObservationDto } from "./personal-sec-quarterly-evidence";

export const PERSONAL_SEC_ANNUAL_OPERATING_LIMITS = Object.freeze({
  candidateRowsPerMetric: 10_000,
  observationsPerMetric: 100,
  decimalCharacters: 64,
  marginCharacters: 132,
} as const);
export const PERSONAL_SEC_ANNUAL_OPERATING_ABSENCES = Object.freeze([
  "concept_missing",
  "usd_missing",
  "empty_usd",
] as const);
export type PersonalSecAnnualOperatingAbsence =
  (typeof PERSONAL_SEC_ANNUAL_OPERATING_ABSENCES)[number];
export const PERSONAL_SEC_ANNUAL_OPERATING_REASONS = Object.freeze([
  "invalid_clock",
  "source_unavailable",
  "source_stale",
  "target_unresolved",
  "invalid_response",
  "candidate_limit",
  "invalid_source_rows",
  "selected_report_overflow",
  ...PERSONAL_SEC_ANNUAL_OPERATING_ABSENCES,
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
  "nonpositive_revenue",
] as const);
export type PersonalSecAnnualOperatingUnavailableReason =
  (typeof PERSONAL_SEC_ANNUAL_OPERATING_REASONS)[number];

/** Annual-only identity; the quarterly observation contract is unchanged. */
export type PersonalSecAnnualOperatingObservationDto = Omit<
  PersonalSecQuarterlyObservationDto,
  "metric" | "concept"
> &
  Readonly<{
    metric: "operating_income";
    concept: "OperatingIncomeLoss";
  }>;

export interface PersonalSecAnnualOperatingCoverageDto {
  readonly full: Readonly<{
    candidateRows: number;
    inspectedRows: number;
    invalidRows: number;
    duplicateRows: number;
    uniqueObservations: number;
  }>;
  readonly selected: number | null;
  readonly otherAccessions: number | null;
  readonly returned: number;
  readonly omittedSelected: number | null;
}
export type PersonalSecAnnualOperatingScanDto =
  | Readonly<{
      status: "available";
      absence: PersonalSecAnnualOperatingAbsence | null;
      coverage: PersonalSecAnnualOperatingCoverageDto;
    }>
  | Readonly<{
      status: Exclude<PersonalSecAnnualScanStatus, "available">;
      absence: null;
      coverage: null;
    }>;
export interface PersonalSecAnnualOperatingMetricEvidenceDto {
  readonly scan: PersonalSecAnnualOperatingScanDto;
  /** Complete selected-accession observations before annual filtering, or none. */
  readonly observations: readonly PersonalSecAnnualOperatingObservationDto[];
}
export type PersonalSecAnnualOperatingValueDto<
  Unit extends "USD" | "percent" = "USD" | "percent",
> =
  | Readonly<{
      status: "available";
      unit: Unit;
      value: string;
      startDate: string;
      endDate: string;
      accessionNumber: string;
      observationIds: readonly `sec-fact:${string}`[];
      currentUseEligible: boolean;
    }>
  | Readonly<{
      status: "unavailable";
      unit: Unit;
      reason: PersonalSecAnnualOperatingUnavailableReason;
      observationIds: readonly `sec-fact:${string}`[];
    }>;
export interface PersonalSecAnnualOperatingMarginDto {
  readonly concept: PersonalSecAnnualRevenueConcept;
  readonly revenue: PersonalSecAnnualOperatingValueDto<"USD">;
  readonly operatingMargin: PersonalSecAnnualOperatingValueDto<"percent">;
}
export interface PersonalSecAnnualOperatingResolutionDto {
  readonly operatingIncome: PersonalSecAnnualOperatingValueDto<"USD">;
  /** All named revenue bases in the fixed contract order; never substitute one. */
  readonly margins: readonly PersonalSecAnnualOperatingMarginDto[];
  readonly utilityAge: PersonalSecAnnualResolutionDto["utilityAge"];
}
export interface PersonalSecAnnualOperatingResultsDto {
  readonly operatingIncome: PersonalSecAnnualOperatingMetricEvidenceDto;
  readonly resolution: PersonalSecAnnualOperatingResolutionDto;
}
export type PersonalSecAnnualOperatingResolutionInput =
  PersonalSecAnnualResolutionInput &
    Readonly<{
      operatingResults: Omit<
        PersonalSecAnnualOperatingResultsDto,
        "resolution"
      >;
    }>;
