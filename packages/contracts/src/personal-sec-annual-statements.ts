import type { PersonalMarketDataIdentityDto } from "./index";
import type {
  PersonalSecAnnualGenerationDto,
  PersonalSecAnnualTargetDto,
  PersonalSecAnnualEvidenceDto,
} from "./personal-sec-annual-evidence";
import type { PersonalSecAnnualStatementFactsDto } from "./personal-sec-annual-statement-facts";
import type {
  PersonalSecAnnualStatementConcept,
  PersonalSecAnnualStatementId,
  PersonalSecAnnualStatementLineId,
} from "./personal-sec-annual-statement-registry";

/** New canonical transport; the existing endpoint changes only at integration. */
export const PERSONAL_SEC_ANNUAL_CANONICAL_VERSION = "6.0.0" as const;

export interface PersonalSecAnnualCanonicalRequestDto {
  readonly schemaVersion: typeof PERSONAL_SEC_ANNUAL_CANONICAL_VERSION;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listingId: string;
  readonly symbol: string;
}

/** Closed version-6 request; identity and CIK still come from the current catalog. */
export function parseManagedSecAnnualCanonicalRequest(
  value: unknown,
): PersonalSecAnnualCanonicalRequestDto | null {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Object.getPrototypeOf(value) !== Object.prototype
    )
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    const expected = [
      "schemaVersion",
      "catalogSnapshotSha256",
      "listingId",
      "symbol",
    ];
    if (
      keys.length !== expected.length ||
      !expected.every((key) => Object.hasOwn(descriptors, key)) ||
      !keys.every(
        (key) =>
          typeof key === "string" &&
          descriptors[key]?.enumerable &&
          Object.hasOwn(descriptors[key], "value"),
      )
    )
      return null;
    const schemaVersion: unknown = descriptors.schemaVersion!.value;
    const catalogSnapshotSha256: unknown =
      descriptors.catalogSnapshotSha256!.value;
    const listingId: unknown = descriptors.listingId!.value;
    const symbol: unknown = descriptors.symbol!.value;
    if (
      schemaVersion !== PERSONAL_SEC_ANNUAL_CANONICAL_VERSION ||
      typeof catalogSnapshotSha256 !== "string" ||
      !/^sha256:[a-f0-9]{64}$/u.test(catalogSnapshotSha256) ||
      typeof listingId !== "string" ||
      !/^[a-z0-9][a-z0-9._:-]{2,127}$/u.test(listingId) ||
      typeof symbol !== "string" ||
      !/^[A-Z0-9][A-Z0-9.-]{0,14}$/u.test(symbol)
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

export type PersonalSecAnnualCanonicalGenerationDto = Omit<
  PersonalSecAnnualGenerationDto,
  "definitionVersion"
> &
  Readonly<{
    definitionVersion: typeof PERSONAL_SEC_ANNUAL_CANONICAL_VERSION;
  }>;

export interface PersonalSecAnnualCanonicalEvidenceDto {
  readonly cik: string;
  readonly generation: PersonalSecAnnualCanonicalGenerationDto;
  readonly target: PersonalSecAnnualTargetDto;
  readonly targetScan: PersonalSecAnnualEvidenceDto["targetScan"];
  readonly facts: PersonalSecAnnualStatementFactsDto;
}

export interface PersonalSecAnnualCanonicalResponseDto {
  readonly schemaVersion: typeof PERSONAL_SEC_ANNUAL_CANONICAL_VERSION;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly security: PersonalMarketDataIdentityDto &
    Readonly<{ issuerId: string; cik: string }>;
  readonly evidence: PersonalSecAnnualCanonicalEvidenceDto;
}

export const PERSONAL_SEC_ANNUAL_STATEMENT_CELL_REASONS = Object.freeze([
  "invalid_clock",
  "source_unavailable",
  "source_stale",
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
  "missing_or_non_FY_focus",
  "invalid_annual_period",
  "invalid_instant_period",
  "filing_unmatched_or_conflicted",
  "report_end_mismatch",
  "future_or_inconsistent_dates",
  "cutoff_time_unresolved",
  "report_date_missing",
  "filed_date_missing",
  "ambiguous_period",
  "ambiguous_value",
] as const);
export type PersonalSecAnnualStatementCellReason =
  (typeof PERSONAL_SEC_ANNUAL_STATEMENT_CELL_REASONS)[number];

export interface PersonalSecAnnualStatementColumnDto {
  readonly endDate: string;
  readonly kind: "selected_report" | "comparative";
}

export type PersonalSecAnnualStatementCellDto = Readonly<{
  endDate: string;
  observationIds: readonly `sec-fact:${string}`[];
}> &
  (
    | Readonly<{
        status: "available";
        value: string;
        startDate: string | null;
        currentUseEligible: boolean;
      }>
    | Readonly<{
        status: "unavailable";
        reason: PersonalSecAnnualStatementCellReason;
      }>
  );

export interface PersonalSecAnnualStatementRowDto {
  readonly concept: PersonalSecAnnualStatementConcept;
  readonly lineId: PersonalSecAnnualStatementLineId;
  readonly cells: readonly PersonalSecAnnualStatementCellDto[];
}

export interface PersonalSecAnnualStatementDto {
  readonly id: PersonalSecAnnualStatementId;
  readonly columns: readonly PersonalSecAnnualStatementColumnDto[];
  readonly rows: readonly PersonalSecAnnualStatementRowDto[];
}

export interface PersonalSecAnnualStatementsDto {
  /** A global refusal remains explicit even when no target date can form columns. */
  readonly contextReason: PersonalSecAnnualStatementCellReason | null;
  readonly statements: readonly PersonalSecAnnualStatementDto[];
  readonly utilityAge: Readonly<{
    endAgeDays: number;
    sourceAgeDays: readonly [number, number];
    withinWindow: boolean;
  }> | null;
}
