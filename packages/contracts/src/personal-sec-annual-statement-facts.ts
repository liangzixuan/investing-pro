import type { PersonalSecAnnualScanStatus } from "./personal-sec-annual-cash-generation";
import type { PersonalSecQuarterlyObservationDto } from "./personal-sec-quarterly-evidence";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  type PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY_VERSION,
  type PersonalSecAnnualStatementConcept,
} from "./personal-sec-annual-statement-registry";

/** Independent concept scans; source-byte, request and deadline limits also apply. */
export const PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS = Object.freeze({
  concepts: PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.length,
  candidateRowsPerConcept: 10_000,
  observationsPerConcept: 100,
  observations: PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.length * 100,
  decimalCharacters: 64,
} as const);

export const PERSONAL_SEC_ANNUAL_STATEMENT_ABSENCES = Object.freeze([
  "concept_missing",
  "usd_missing",
  "empty_usd",
] as const);
export type PersonalSecAnnualStatementAbsence =
  (typeof PERSONAL_SEC_ANNUAL_STATEMENT_ABSENCES)[number];

/** One source observation. Its registered concept determines the reported line. */
export type PersonalSecAnnualStatementObservationDto = Omit<
  PersonalSecQuarterlyObservationDto,
  "metric" | "concept"
> &
  Readonly<{ concept: PersonalSecAnnualStatementConcept }>;

export interface PersonalSecAnnualStatementCoverageDto {
  readonly full: Readonly<{
    candidateRows: number;
    inspectedRows: number;
    invalidRows: number;
    duplicateRows: number;
    uniqueObservations: number;
  }>;
  /** Null when no Submissions target was resolved. */
  readonly selected: number | null;
  readonly otherAccessions: number | null;
  readonly returned: number;
  readonly omittedSelected: number | null;
}

export type PersonalSecAnnualStatementScanDto =
  | Readonly<{
      status: "available";
      absence: PersonalSecAnnualStatementAbsence | null;
      coverage: PersonalSecAnnualStatementCoverageDto;
    }>
  | Readonly<{
      status: Exclude<PersonalSecAnnualScanStatus, "available">;
      absence: null;
      coverage: null;
    }>;

export interface PersonalSecAnnualStatementConceptScanDto {
  readonly concept: PersonalSecAnnualStatementConcept;
  readonly scan: PersonalSecAnnualStatementScanDto;
}

/** Canonical graph. Derived cells and financial views must reference these IDs. */
export interface PersonalSecAnnualStatementFactsDto {
  readonly registryVersion: typeof PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY_VERSION;
  /** Exactly one entry per registered concept, in registry order. */
  readonly scans: readonly PersonalSecAnnualStatementConceptScanDto[];
  /** Complete bounded selected-accession rows, before annual-period admission. */
  readonly observations: readonly PersonalSecAnnualStatementObservationDto[];
}

/** Normalized source identity; caller validates fields before hashing this text. */
export function serializePersonalSecAnnualStatementObservation(
  row: Omit<
    PersonalSecAnnualStatementObservationDto,
    "id" | "sourceLocator" | "filing"
  >,
): string {
  return JSON.stringify([
    "sec-annual-statement-fact",
    "1.0.0",
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
