import type { PersonalSecurityMasterScreenRowDto } from "./index";

export const PERSONAL_FINANCIAL_SCREEN_METRICS = [
  "revenue",
  "netIncome",
  "operatingIncome",
  "operatingCashFlow",
  "netMargin",
  "operatingMargin",
  "operatingCashFlowMargin",
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
] as const;
export type PersonalSecAnnualConceptDto =
  (typeof PERSONAL_SEC_ANNUAL_CONCEPTS)[number];
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
export type PersonalFinancialScreenCellDto =
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
        | "nonpositive_revenue"
        | "source_unavailable"
        | "invalid_value";
      readonly unit: "USD" | "percent";
      readonly sources: readonly PersonalFinancialScreenSourceRefDto[];
    };
export interface PersonalFinancialScreenClauseDto {
  readonly field: PersonalFinancialScreenMetricDto;
  readonly operator: "gte" | "lte";
  readonly value: string;
}
export interface PersonalFinancialScreenCriteriaDto {
  readonly calendarYear: number;
  readonly identityText: string;
  readonly clauses: readonly PersonalFinancialScreenClauseDto[];
  readonly sort: {
    readonly field: PersonalFinancialScreenMetricDto | "symbol";
    readonly direction: "asc" | "desc";
  };
}
export interface PersonalFinancialScreenRequestDto {
  readonly schemaVersion: "1.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly financialSnapshotSha256: `sha256:${string}` | null;
  readonly criteria: PersonalFinancialScreenCriteriaDto;
  readonly page: { readonly offset: number; readonly limit: number };
  readonly refresh: boolean;
}
export interface PersonalFinancialScreenRowDto {
  readonly identity: PersonalSecurityMasterScreenRowDto;
  readonly metrics: Readonly<
    Record<PersonalFinancialScreenMetricDto, PersonalFinancialScreenCellDto>
  >;
}
export interface PersonalFinancialScreenResponseDto {
  readonly schemaVersion: "1.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly financialSnapshotSha256: `sha256:${string}`;
  readonly calendarYear: number;
  readonly fetchedAt: string;
  readonly expiresAt: string;
  readonly sources: readonly {
    readonly concept: PersonalSecAnnualConceptDto;
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
  readonly formulaVersion: "1.0.0";
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
