import type { PersonalSecAnnualScanStatus } from "./personal-sec-annual-cash-generation";
import type {
  PersonalSecAnnualGenerationDto,
  PersonalSecAnnualResolutionDto,
  PersonalSecAnnualTargetDto,
} from "./personal-sec-annual-evidence";
import type { PersonalSecQuarterlyObservationDto } from "./personal-sec-quarterly-evidence";

export const PERSONAL_SEC_ANNUAL_LIQUIDITY_CONCEPTS = Object.freeze([
  "AssetsCurrent",
  "LiabilitiesCurrent",
] as const);
export type PersonalSecAnnualLiquidityConcept =
  (typeof PERSONAL_SEC_ANNUAL_LIQUIDITY_CONCEPTS)[number];
export type PersonalSecAnnualLiquidityMetric =
  "current_assets" | "current_liabilities";

export const PERSONAL_SEC_ANNUAL_LIQUIDITY_LIMITS = Object.freeze({
  candidateRowsPerMetric: 10_000,
  observationsPerMetric: 100,
  decimalCharacters: 64,
  differenceCharacters: 128,
  ratioCharacters: 129,
} as const);

export const PERSONAL_SEC_ANNUAL_LIQUIDITY_ABSENCES = Object.freeze([
  "concept_missing",
  "usd_missing",
  "empty_usd",
] as const);
export type PersonalSecAnnualLiquidityAbsence =
  (typeof PERSONAL_SEC_ANNUAL_LIQUIDITY_ABSENCES)[number];

export const PERSONAL_SEC_ANNUAL_LIQUIDITY_REASONS = Object.freeze([
  "invalid_clock",
  "source_unavailable",
  "source_stale",
  "target_unresolved",
  "invalid_response",
  "candidate_limit",
  "invalid_source_rows",
  "selected_report_overflow",
  ...PERSONAL_SEC_ANNUAL_LIQUIDITY_ABSENCES,
  "no_report_date",
  "unsupported_form",
  "missing_or_non_FY_focus",
  "invalid_instant_period",
  "filing_unmatched_or_conflicted",
  "report_end_mismatch",
  "future_or_inconsistent_dates",
  "cutoff_time_unresolved",
  "report_date_missing",
  "filed_date_missing",
  "ambiguous_value",
  "balance_date_mismatch",
  "filing_mismatch",
  "unsupported_sign",
  "nonpositive_current_liabilities",
] as const);
export type PersonalSecAnnualLiquidityUnavailableReason =
  (typeof PERSONAL_SEC_ANNUAL_LIQUIDITY_REASONS)[number];

type LiquidityObservationMetadata = Omit<
  PersonalSecQuarterlyObservationDto,
  "metric" | "concept"
>;
/** Raw period fields remain available when instant admission refuses a row. */
export type PersonalSecAnnualLiquidityObservationDto =
  LiquidityObservationMetadata &
    (
      | Readonly<{
          metric: "current_assets";
          concept: "AssetsCurrent";
        }>
      | Readonly<{
          metric: "current_liabilities";
          concept: "LiabilitiesCurrent";
        }>
    );

export interface PersonalSecAnnualLiquidityCoverageDto {
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

export type PersonalSecAnnualLiquidityScanDto =
  | Readonly<{
      status: "available";
      absence: PersonalSecAnnualLiquidityAbsence | null;
      coverage: PersonalSecAnnualLiquidityCoverageDto;
    }>
  | Readonly<{
      status: Exclude<PersonalSecAnnualScanStatus, "available">;
      absence: null;
      coverage: null;
    }>;

export interface PersonalSecAnnualLiquidityMetricEvidenceDto {
  readonly scan: PersonalSecAnnualLiquidityScanDto;
  /** All unique selected-accession rows before report-date admission, or none. */
  readonly observations: readonly PersonalSecAnnualLiquidityObservationDto[];
}

export type PersonalSecAnnualLiquidityValueDto<
  Unit extends "USD" | "multiple" = "USD" | "multiple",
> =
  | Readonly<{
      status: "available";
      unit: Unit;
      value: string;
      asOfDate: string;
      accessionNumber: string;
      observationIds: readonly `sec-fact:${string}`[];
      currentUseEligible: boolean;
    }>
  | Readonly<{
      status: "unavailable";
      unit: Unit;
      reason: PersonalSecAnnualLiquidityUnavailableReason;
      observationIds: readonly `sec-fact:${string}`[];
    }>;

export interface PersonalSecAnnualLiquidityResolutionDto {
  readonly currentAssets: PersonalSecAnnualLiquidityValueDto<"USD">;
  readonly currentLiabilities: PersonalSecAnnualLiquidityValueDto<"USD">;
  readonly workingCapital: PersonalSecAnnualLiquidityValueDto<"USD">;
  readonly currentRatio: PersonalSecAnnualLiquidityValueDto<"multiple">;
  readonly utilityAge: PersonalSecAnnualResolutionDto["utilityAge"];
}

export interface PersonalSecAnnualLiquidityDto {
  readonly currentAssets: PersonalSecAnnualLiquidityMetricEvidenceDto;
  readonly currentLiabilities: PersonalSecAnnualLiquidityMetricEvidenceDto;
  readonly resolution: PersonalSecAnnualLiquidityResolutionDto;
}

export interface PersonalSecAnnualLiquidityResolutionInput {
  readonly cik: string;
  readonly generation: PersonalSecAnnualGenerationDto;
  readonly target: PersonalSecAnnualTargetDto;
  readonly liquidity: Omit<PersonalSecAnnualLiquidityDto, "resolution">;
}
