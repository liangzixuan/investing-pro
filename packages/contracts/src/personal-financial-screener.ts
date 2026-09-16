import type { PersonalSecurityMasterScreenRowDto } from "./index";

export const PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS = [
  "revenue",
  "grossProfit",
  "netIncome",
  "operatingIncome",
  "operatingCashFlow",
  "netMargin",
  "operatingMargin",
  "operatingCashFlowMargin",
  "ppePurchases",
  "operatingCashFlowLessPpePurchases",
  "grossMargin",
  "operatingCashFlowToNetIncome",
  "operatingCashFlowLessPpePurchasesMargin",
] as const;
export type PersonalFinancialScreenAnnualMetricDto =
  (typeof PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS)[number];
export const PERSONAL_FINANCIAL_SCREEN_INSTANT_METRICS = [
  "currentAssets",
  "currentLiabilities",
  "currentRatio",
  "currentAssetsLessCurrentLiabilities",
] as const;
export type PersonalFinancialScreenInstantMetricDto =
  (typeof PERSONAL_FINANCIAL_SCREEN_INSTANT_METRICS)[number];
export const PERSONAL_FINANCIAL_SCREEN_GROWTH_METRICS = [
  "revenueGrowth",
] as const;
export type PersonalFinancialScreenGrowthMetricDto =
  (typeof PERSONAL_FINANCIAL_SCREEN_GROWTH_METRICS)[number];
export const PERSONAL_FINANCIAL_SCREEN_METRICS = [
  ...PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS,
  ...PERSONAL_FINANCIAL_SCREEN_INSTANT_METRICS,
  ...PERSONAL_FINANCIAL_SCREEN_GROWTH_METRICS,
] as const;
export type PersonalFinancialScreenMetricDto =
  (typeof PERSONAL_FINANCIAL_SCREEN_METRICS)[number];
export const PERSONAL_SEC_ANNUAL_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
  "NetIncomeLoss",
  "OperatingIncomeLoss",
  "NetCashProvidedByUsedInOperatingActivities",
  "GrossProfit",
  "PaymentsToAcquirePropertyPlantAndEquipment",
] as const;
export type PersonalSecAnnualConceptDto =
  (typeof PERSONAL_SEC_ANNUAL_CONCEPTS)[number];
export const PERSONAL_SEC_REVENUE_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
] as const;
export type PersonalSecRevenueConceptDto =
  (typeof PERSONAL_SEC_REVENUE_CONCEPTS)[number];
export const PERSONAL_FINANCIAL_REVENUE_BASES = [
  "agreement",
  "Revenues",
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "SalesRevenueNet",
] as const;
export type PersonalFinancialRevenueBasisDto =
  (typeof PERSONAL_FINANCIAL_REVENUE_BASES)[number];
export const PERSONAL_SEC_INSTANT_CONCEPTS = [
  "AssetsCurrent",
  "LiabilitiesCurrent",
] as const;
export type PersonalSecInstantConceptDto =
  (typeof PERSONAL_SEC_INSTANT_CONCEPTS)[number];
export type PersonalSecFinancialConceptDto =
  PersonalSecAnnualConceptDto | PersonalSecInstantConceptDto;
export interface PersonalSecInstantFactDto {
  readonly cik: string;
  readonly accessionNumber: string;
  readonly asOfDate: string;
  readonly value: string;
}
export interface PersonalSecInstantFrameDto {
  readonly concept: PersonalSecInstantConceptDto;
  readonly status: PersonalSecAnnualFrameDto["status"];
  readonly sourceUrl: string;
  readonly facts: readonly PersonalSecInstantFactDto[];
  readonly unknownCiks: readonly string[];
}
export interface PersonalSecFinancialSnapshotDto extends PersonalSecAnnualFinancialSnapshotDto {
  readonly instantQuarter: 4;
  readonly instantFrames: readonly PersonalSecInstantFrameDto[];
  readonly priorCalendarYear: number;
  readonly priorRevenueFrames: readonly PersonalSecRevenueFrameDto[];
}
export interface PersonalFinancialScreenInstantSourceRefDto {
  readonly concept: PersonalSecInstantConceptDto;
  readonly accessionNumber: string;
  readonly asOfDate: string;
  readonly value: string;
}
export interface PersonalSecAnnualFactDto {
  readonly cik: string;
  readonly accessionNumber: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly value: string;
}
export interface PersonalSecAnnualFrameDto {
  readonly concept: PersonalSecAnnualConceptDto;
  readonly status:
    | "available"
    | "not_covered"
    | "rate_limited"
    | "upstream_unavailable"
    | "invalid_response";
  readonly sourceUrl: string;
  readonly facts: readonly PersonalSecAnnualFactDto[];
  readonly unknownCiks: readonly string[];
}
export interface PersonalSecRevenueFrameDto extends PersonalSecAnnualFrameDto {
  readonly concept: PersonalSecRevenueConceptDto;
}
export interface PersonalSecAnnualFinancialSnapshotDto {
  readonly calendarYear: number;
  readonly fetchedAt: string;
  readonly expiresAt: string;
  readonly snapshotSha256: `sha256:${string}`;
  readonly frames: readonly PersonalSecAnnualFrameDto[];
}
export interface PersonalFinancialScreenSourceRefDto {
  readonly concept: PersonalSecAnnualConceptDto;
  readonly accessionNumber: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly value: string;
}
export type PersonalFinancialScreenAnnualCellDto =
  | {
      readonly status: "available";
      readonly value: string;
      readonly unit: "USD" | "percent";
      readonly sources: readonly PersonalFinancialScreenSourceRefDto[];
    }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "missing"
        | "conflicting"
        | "period_mismatch"
        | "filing_mismatch"
        | "unsupported_sign"
        | "nonpositive_revenue"
        | "nonpositive_net_income"
        | "source_unavailable"
        | "invalid_value";
      readonly unit: "USD" | "percent";
      readonly sources: readonly PersonalFinancialScreenSourceRefDto[];
    };
export type PersonalFinancialScreenInstantCellDto =
  | {
      readonly status: "available";
      readonly value: string;
      readonly unit: "USD" | "multiple";
      readonly sources: readonly PersonalFinancialScreenInstantSourceRefDto[];
    }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "missing"
        | "conflicting"
        | "source_unavailable"
        | "invalid_value"
        | "unsupported_balance_date"
        | "balance_date_mismatch"
        | "filing_mismatch"
        | "nonpositive_current_liabilities"
        | "unsupported_sign";
      readonly unit: "USD" | "multiple";
      readonly sources: readonly PersonalFinancialScreenInstantSourceRefDto[];
    };
export interface PersonalFinancialScreenGrowthSourceRefDto extends PersonalFinancialScreenSourceRefDto {
  readonly concept: PersonalSecRevenueConceptDto;
  readonly role: "current_revenue" | "prior_revenue";
  readonly calendarYear: number;
}
export type PersonalFinancialScreenGrowthCellDto = {
  readonly unit: "percent";
  readonly currentRevenue: PersonalFinancialScreenAnnualCellDto;
  readonly priorRevenue: PersonalFinancialScreenAnnualCellDto;
  readonly sources: readonly PersonalFinancialScreenGrowthSourceRefDto[];
} & (
  | { readonly status: "available"; readonly value: string }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "prior_unavailable"
        | "current_unavailable"
        | "period_mismatch"
        | "concept_set_changed"
        | "nonadjacent_periods"
        | "nonpositive_prior_revenue"
        | "filing_mismatch";
    }
);
export type PersonalFinancialScreenCellDto =
  | PersonalFinancialScreenAnnualCellDto
  | PersonalFinancialScreenInstantCellDto
  | PersonalFinancialScreenGrowthCellDto;
export interface PersonalFinancialScreenClauseDto {
  readonly field: PersonalFinancialScreenMetricDto;
  readonly operator: "gte" | "lte";
  readonly value: string;
}
export interface PersonalFinancialScreenCriteriaDto {
  readonly calendarYear: number;
  /** Omission always retains the original agreement policy. */
  readonly revenueBasis?: PersonalFinancialRevenueBasisDto;
  readonly identityText: string;
  readonly clauses: readonly PersonalFinancialScreenClauseDto[];
  readonly sort: {
    readonly field: PersonalFinancialScreenMetricDto | "symbol";
    readonly direction: "asc" | "desc";
  };
}
export interface PersonalFinancialScreenRequestDto {
  readonly schemaVersion: "9.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly financialSnapshotSha256: `sha256:${string}` | null;
  readonly criteria: PersonalFinancialScreenCriteriaDto;
  readonly page: { readonly offset: number; readonly limit: number };
  readonly refresh: boolean;
}
export interface PersonalFinancialScreenRowDto {
  readonly identity: PersonalSecurityMasterScreenRowDto;
  readonly metrics: Readonly<
    Record<
      PersonalFinancialScreenAnnualMetricDto,
      PersonalFinancialScreenAnnualCellDto
    > &
      Record<
        PersonalFinancialScreenInstantMetricDto,
        PersonalFinancialScreenInstantCellDto
      > &
      Record<
        PersonalFinancialScreenGrowthMetricDto,
        PersonalFinancialScreenGrowthCellDto
      >
  >;
}
export interface PersonalFinancialScreenResponseDto {
  readonly schemaVersion: "9.0.0";
  readonly instantQuarter: 4;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly financialSnapshotSha256: `sha256:${string}`;
  readonly calendarYear: number;
  readonly priorCalendarYear: number;
  /** Present exactly when the request explicitly supplies a revenue basis. */
  readonly revenueBasis?: PersonalFinancialRevenueBasisDto;
  readonly fetchedAt: string;
  readonly expiresAt: string;
  readonly sources: readonly {
    readonly concept: PersonalSecFinancialConceptDto;
    readonly status: PersonalSecAnnualFrameDto["status"];
    readonly sourceUrl: string;
  }[];
  readonly priorRevenueSources: readonly {
    readonly concept: PersonalSecRevenueConceptDto;
    readonly status: PersonalSecAnnualFrameDto["status"];
    readonly sourceUrl: string;
  }[];
  readonly rows: readonly PersonalFinancialScreenRowDto[];
  readonly totalUniverse: number;
  readonly identityMatches: number;
  readonly totalMatches: number;
  readonly totalNonMatches: number;
  readonly totalUnknown: number;
  readonly metricCoverage: Readonly<
    Record<
      PersonalFinancialScreenMetricDto,
      { readonly known: number; readonly unknown: number }
    >
  >;
  readonly offset: number;
  readonly limitApplied: number;
  readonly hasMore: boolean;
  readonly formulaVersion: "1.7.0";
}
export interface PersonalFinancialSavedViewDto {
  readonly id: string;
  readonly name: string;
  readonly criteria: PersonalFinancialScreenCriteriaDto;
  readonly createdAgainstCatalogSnapshotSha256: `sha256:${string}`;
  readonly createdAgainstFinancialSnapshotSha256: `sha256:${string}`;
}
export interface PersonalFinancialSavedViewsPayloadDto {
  readonly schemaVersion: 1;
  readonly views: readonly PersonalFinancialSavedViewDto[];
}
