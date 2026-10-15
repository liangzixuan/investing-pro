import type { PersonalSecAnnualScanStatus } from "./personal-sec-annual-cash-generation";
import type {
  PersonalSecAnnualGenerationDto,
  PersonalSecAnnualResolutionDto,
  PersonalSecAnnualTargetDto,
} from "./personal-sec-annual-evidence";
import type { PersonalSecQuarterlyObservationDto } from "./personal-sec-quarterly-evidence";

export const PERSONAL_SEC_ANNUAL_BALANCE_SHEET_CONCEPTS = Object.freeze([
  "Assets",
  "Liabilities",
  "StockholdersEquity",
] as const);
export type PersonalSecAnnualBalanceSheetConcept =
  (typeof PERSONAL_SEC_ANNUAL_BALANCE_SHEET_CONCEPTS)[number];
export type PersonalSecAnnualBalanceSheetMetric =
  "total_assets" | "total_liabilities" | "shareholders_equity";

export const PERSONAL_SEC_ANNUAL_BALANCE_SHEET_LIMITS = Object.freeze({
  candidateRowsPerMetric: 10_000,
  observationsPerMetric: 100,
  decimalCharacters: 64,
} as const);

export const PERSONAL_SEC_ANNUAL_BALANCE_SHEET_ABSENCES = Object.freeze([
  "concept_missing",
  "usd_missing",
  "empty_usd",
] as const);
export type PersonalSecAnnualBalanceSheetAbsence =
  (typeof PERSONAL_SEC_ANNUAL_BALANCE_SHEET_ABSENCES)[number];

export const PERSONAL_SEC_ANNUAL_BALANCE_SHEET_REASONS = Object.freeze([
  "invalid_clock",
  "source_unavailable",
  "source_stale",
  "target_unresolved",
  "invalid_response",
  "candidate_limit",
  "invalid_source_rows",
  "selected_report_overflow",
  ...PERSONAL_SEC_ANNUAL_BALANCE_SHEET_ABSENCES,
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
] as const);
export type PersonalSecAnnualBalanceSheetUnavailableReason =
  (typeof PERSONAL_SEC_ANNUAL_BALANCE_SHEET_REASONS)[number];

type BalanceSheetObservationMetadata = Omit<
  PersonalSecQuarterlyObservationDto,
  "metric" | "concept"
>;
/** Exact reported totals. StockholdersEquity is equity attributable to the parent. */
export type PersonalSecAnnualBalanceSheetObservationDto =
  BalanceSheetObservationMetadata &
    (
      | Readonly<{ metric: "total_assets"; concept: "Assets" }>
      | Readonly<{ metric: "total_liabilities"; concept: "Liabilities" }>
      | Readonly<{
          metric: "shareholders_equity";
          concept: "StockholdersEquity";
        }>
    );

export interface PersonalSecAnnualBalanceSheetCoverageDto {
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

export type PersonalSecAnnualBalanceSheetScanDto =
  | Readonly<{
      status: "available";
      absence: PersonalSecAnnualBalanceSheetAbsence | null;
      coverage: PersonalSecAnnualBalanceSheetCoverageDto;
    }>
  | Readonly<{
      status: Exclude<PersonalSecAnnualScanStatus, "available">;
      absence: null;
      coverage: null;
    }>;

export interface PersonalSecAnnualBalanceSheetMetricEvidenceDto {
  readonly scan: PersonalSecAnnualBalanceSheetScanDto;
  /** All unique selected-accession rows before report-date admission, or none. */
  readonly observations: readonly PersonalSecAnnualBalanceSheetObservationDto[];
}

export type PersonalSecAnnualBalanceSheetValueDto =
  | Readonly<{
      status: "available";
      unit: "USD";
      value: string;
      asOfDate: string;
      accessionNumber: string;
      observationIds: readonly `sec-fact:${string}`[];
      currentUseEligible: boolean;
    }>
  | Readonly<{
      status: "unavailable";
      unit: "USD";
      reason: PersonalSecAnnualBalanceSheetUnavailableReason;
      observationIds: readonly `sec-fact:${string}`[];
    }>;

export interface PersonalSecAnnualBalanceSheetResolutionDto {
  readonly totalAssets: PersonalSecAnnualBalanceSheetValueDto;
  readonly totalLiabilities: PersonalSecAnnualBalanceSheetValueDto;
  /** Parent equity only; never inferred from the other reported totals. */
  readonly shareholdersEquity: PersonalSecAnnualBalanceSheetValueDto;
  readonly utilityAge: PersonalSecAnnualResolutionDto["utilityAge"];
}

export interface PersonalSecAnnualBalanceSheetDto {
  readonly totalAssets: PersonalSecAnnualBalanceSheetMetricEvidenceDto;
  readonly totalLiabilities: PersonalSecAnnualBalanceSheetMetricEvidenceDto;
  readonly shareholdersEquity: PersonalSecAnnualBalanceSheetMetricEvidenceDto;
  readonly resolution: PersonalSecAnnualBalanceSheetResolutionDto;
}

export interface PersonalSecAnnualBalanceSheetResolutionInput {
  readonly cik: string;
  readonly generation: PersonalSecAnnualGenerationDto;
  readonly target: PersonalSecAnnualTargetDto;
  readonly balanceSheet: Omit<PersonalSecAnnualBalanceSheetDto, "resolution">;
}
