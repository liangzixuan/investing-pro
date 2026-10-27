import type { PersonalMarketDataIdentityDto } from "./index";
import type { PersonalSecAnnualSourceDto } from "./personal-sec-annual-evidence";
import type {
  PersonalSecAnnualStatementCoverageDto,
  PersonalSecAnnualStatementScanDto,
} from "./personal-sec-annual-statement-facts";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementId,
  type PersonalSecAnnualStatementLineId,
} from "./personal-sec-annual-statement-registry";
import type { PersonalSecQuarterlyObservationDto } from "./personal-sec-quarterly-evidence";

export const PERSONAL_SEC_INTERIM_CANONICAL_VERSION = "1.0.0" as const;
export const MANAGED_SEC_INTERIM_EVIDENCE_PATH =
  "/v1/managed/sec-interim-evidence" as const;
export const MANAGED_SEC_INTERIM_EVIDENCE_LIMITS = Object.freeze({
  requestBytes: 4_096,
  responseBytes: 2_097_152,
});
/** Reuse only the period-neutral concept metadata, never Annual eligibility. */
export const PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY =
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY;
export const PERSONAL_SEC_INTERIM_STATEMENT_FACT_LIMITS = Object.freeze({
  concepts: 32,
  candidateRowsPerConcept: 10_000,
  observationsPerConcept: 100,
  observations: 3_200,
  decimalCharacters: 64,
});
export type PersonalSecInterimStatementConcept =
  PersonalSecAnnualStatementConcept;
export type PersonalSecInterimStatementId = PersonalSecAnnualStatementId;
export type PersonalSecInterimStatementScanDto =
  PersonalSecAnnualStatementScanDto;
export type PersonalSecInterimStatementCoverageDto =
  PersonalSecAnnualStatementCoverageDto;
export type PersonalSecInterimSourceDto = PersonalSecAnnualSourceDto;

export interface PersonalSecInterimCanonicalRequestDto {
  readonly schemaVersion: typeof PERSONAL_SEC_INTERIM_CANONICAL_VERSION;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listingId: string;
  readonly symbol: string;
}

function requestValues(
  value: unknown,
): Record<keyof PersonalSecInterimCanonicalRequestDto, unknown> | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return null;
  const fields = Object.getOwnPropertyDescriptors(value);
  const names = [
    "schemaVersion",
    "catalogSnapshotSha256",
    "listingId",
    "symbol",
  ];
  if (
    Reflect.ownKeys(fields).length !== names.length ||
    !names.every(
      (key) => fields[key]?.enumerable && Object.hasOwn(fields[key], "value"),
    )
  )
    return null;
  return {
    schemaVersion: fields.schemaVersion!.value,
    catalogSnapshotSha256: fields.catalogSnapshotSha256!.value,
    listingId: fields.listingId!.value,
    symbol: fields.symbol!.value,
  };
}
function requestText(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}
export function parseManagedSecInterimCanonicalRequest(
  value: unknown,
): PersonalSecInterimCanonicalRequestDto | null {
  try {
    const fields = requestValues(value);
    if (!fields) return null;
    const { schemaVersion, catalogSnapshotSha256, listingId, symbol } = fields;
    if (
      schemaVersion !== PERSONAL_SEC_INTERIM_CANONICAL_VERSION ||
      !requestText(catalogSnapshotSha256, /^sha256:[a-f0-9]{64}$/u) ||
      !requestText(listingId, /^[a-z0-9][a-z0-9._:-]{2,127}$/u) ||
      !requestText(symbol, /^[A-Z0-9][A-Z0-9.-]{0,14}$/u)
    )
      return null;
    return Object.freeze({
      schemaVersion,
      catalogSnapshotSha256: catalogSnapshotSha256 as `sha256:${string}`,
      listingId,
      symbol,
    });
  } catch {
    return null;
  }
}

export interface PersonalSecInterimFilingDto {
  readonly accessionNumber: string;
  readonly form: string;
  readonly filedDate: string | null;
  readonly reportDate: string | null;
  readonly acceptedAt: string | null;
}
export const PERSONAL_SEC_INTERIM_TARGET_REASONS = Object.freeze([
  "submissions_unavailable",
  "invalid_submissions",
  "invalid_clock",
  "target_missing_report_date",
  "no_observed_interim_target",
  "report_date_missing",
  "filed_date_missing",
  "future_or_inconsistent_dates",
  "cutoff_time_unresolved",
  "target_ambiguous",
  "amendment_not_supported",
] as const);
export type PersonalSecInterimTargetReason =
  (typeof PERSONAL_SEC_INTERIM_TARGET_REASONS)[number];
export type PersonalSecInterimTargetDto =
  | Readonly<{
      status: "target";
      accessionNumber: string;
      form: "10-Q";
      filedDate: string;
      reportDate: string;
      acceptedAt: string | null;
    }>
  | Readonly<{ status: "unresolved"; reason: PersonalSecInterimTargetReason }>;
export interface PersonalSecInterimCanonicalGenerationDto {
  readonly definitionVersion: typeof PERSONAL_SEC_INTERIM_CANONICAL_VERSION;
  readonly cutoffAt: string;
  readonly completedAt: string;
  readonly sources: Readonly<{
    companyFacts: PersonalSecInterimSourceDto;
    submissions: PersonalSecInterimSourceDto;
  }>;
  readonly sha256: `sha256:${string}`;
}
export type PersonalSecInterimStatementObservationDto = Omit<
  PersonalSecQuarterlyObservationDto,
  "metric" | "concept" | "id"
> &
  Readonly<{
    id: `sec-interim-fact:${string}`;
    concept: PersonalSecInterimStatementConcept;
  }>;
export interface PersonalSecInterimStatementFactsDto {
  readonly registryVersion: "1.0.0";
  readonly scans: readonly Readonly<{
    concept: PersonalSecInterimStatementConcept;
    scan: PersonalSecInterimStatementScanDto;
  }>[];
  readonly observations: readonly PersonalSecInterimStatementObservationDto[];
}
export interface PersonalSecInterimCanonicalEvidenceDto {
  readonly cik: string;
  readonly generation: PersonalSecInterimCanonicalGenerationDto;
  readonly target: PersonalSecInterimTargetDto;
  readonly targetScan: Readonly<{
    currentFilings: number;
    interimFilings: number;
    olderHistoryAvailable: boolean;
  }> | null;
  readonly facts: PersonalSecInterimStatementFactsDto;
}
export interface PersonalSecInterimCanonicalResponseDto {
  readonly schemaVersion: typeof PERSONAL_SEC_INTERIM_CANONICAL_VERSION;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly security: PersonalMarketDataIdentityDto &
    Readonly<{ issuerId: string; cik: string }>;
  readonly evidence: PersonalSecInterimCanonicalEvidenceDto;
}

/** Domain-specific identity; excludes the separately bound locator and filing join. */
export function serializePersonalSecInterimStatementObservation(
  row: Omit<
    PersonalSecInterimStatementObservationDto,
    "id" | "sourceLocator" | "filing"
  >,
): string {
  return JSON.stringify([
    "sec-interim-statement-fact",
    PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
    row.taxonomy,
    row.concept,
    row.unit,
    row.value,
    row.startDate,
    row.endDate,
    row.durationDays,
    row.periodBasis,
    row.filingFocusYear,
    row.filingFocusPeriod,
    row.frame,
    row.accessionNumber,
    row.form,
    row.filedDate,
  ]);
}
export const PERSONAL_SEC_INTERIM_STATEMENT_REASONS = Object.freeze([
  "invalid_clock",
  "source_unavailable",
  "target_unresolved",
  "invalid_response",
  "candidate_limit",
  "invalid_source_rows",
  "selected_report_overflow",
  "concept_missing",
  "usd_missing",
  "empty_usd",
  "no_report_period",
  "unsupported_form",
  "invalid_duration_period",
  "invalid_instant_period",
  "filing_unmatched_or_conflicted",
  "report_end_mismatch",
  "future_or_inconsistent_dates",
  "ambiguous_value",
] as const);
export type PersonalSecInterimStatementReason =
  (typeof PERSONAL_SEC_INTERIM_STATEMENT_REASONS)[number];
export interface PersonalSecInterimStatementPeriodDto {
  /** Lossless closed tuple identity; use with the concept, never endDate alone. */
  readonly key: string;
  readonly periodType: "duration" | "instant";
  readonly startDate: string | null;
  readonly endDate: string;
  readonly durationDays: number | null;
  readonly kind: "selected_report" | "comparative" | "unresolved";
  readonly classification: "not_established" | "instant";
}
export type PersonalSecInterimStatementCellDto = Readonly<{
  period: PersonalSecInterimStatementPeriodDto;
  observationIds: readonly `sec-interim-fact:${string}`[];
}> &
  (
    | Readonly<{ status: "available"; value: string }>
    | Readonly<{
        status: "unavailable";
        reason: PersonalSecInterimStatementReason;
      }>
  );
export interface PersonalSecInterimStatementRowDto {
  readonly concept: PersonalSecInterimStatementConcept;
  readonly lineId: PersonalSecAnnualStatementLineId;
  readonly reason: PersonalSecInterimStatementReason | null;
  readonly cells: readonly PersonalSecInterimStatementCellDto[];
}
export interface PersonalSecInterimStatementDto {
  readonly id: PersonalSecInterimStatementId;
  readonly rows: readonly PersonalSecInterimStatementRowDto[];
}
export interface PersonalSecInterimStatementsDto {
  readonly contextReason: PersonalSecInterimStatementReason | null;
  readonly statements: readonly PersonalSecInterimStatementDto[];
}
