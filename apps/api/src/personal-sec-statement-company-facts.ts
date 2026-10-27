import {
  PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS as LIMITS,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY_VERSION,
  type PersonalSecAnnualStatementAbsence,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementConceptScanDto,
  type PersonalSecAnnualStatementFactsDto,
  type PersonalSecAnnualStatementObservationDto,
  type PersonalSecAnnualStatementScanDto,
  type PersonalSecAnnualScanStatus,
} from "@research-cockpit/contracts";
import {
  isPersonalSecSourceRecord as isRecord,
  normalizePersonalSecSourceCik,
  normalizePersonalSecSourceFactFields,
  PersonalSecSourceError,
} from "./personal-sec-quarterly-evidence-provider";

export type PersonalSecStatementRawObservation<Id extends string> = Omit<
  PersonalSecAnnualStatementObservationDto,
  "filing" | "id"
> &
  Readonly<{ id: Id }>;
export type PersonalSecStatementCompanyFacts<Id extends string> = Omit<
  PersonalSecAnnualStatementFactsDto,
  "observations"
> &
  Readonly<{ observations: readonly PersonalSecStatementRawObservation<Id>[] }>;
export type PersonalSecStatementFactFields = Omit<
  PersonalSecStatementRawObservation<string>,
  "id" | "sourceLocator"
>;
interface ScanContext<Id extends string> {
  readonly accession: string | null;
  readonly identify: (
    fields: PersonalSecStatementFactFields,
  ) => Readonly<{ key: string; id: Id }>;
}

/** A whole-source failure keeps every registered concept explicitly unavailable. */
export function unavailablePersonalSecStatementCompanyFacts<Id extends string>(
  status: Exclude<PersonalSecAnnualScanStatus, "available">,
): PersonalSecStatementCompanyFacts<Id> {
  return Object.freeze({
    registryVersion: PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY_VERSION,
    scans: Object.freeze(
      PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map(({ concept }) =>
        Object.freeze({
          concept,
          scan: Object.freeze({ status, absence: null, coverage: null }),
        }),
      ),
    ),
    observations: Object.freeze([]),
  });
}

/**
 * Scan the fixed registry against one parsed issuer envelope. Output follows
 * registry order, then end/start/filed dates descending and accession/ID ascending.
 * Every selected row is retained before any period admission, or the entire
 * overflowing concept is withheld. There is no partial selected row set.
 */
export function scanPersonalSecStatementCompanyFacts<Id extends string>(
  value: unknown,
  cik: string,
  context: ScanContext<Id>,
): PersonalSecStatementCompanyFacts<Id> {
  const taxonomy = sourceTaxonomy(value, cik);
  const scans: PersonalSecAnnualStatementConceptScanDto[] = [];
  const observations: PersonalSecStatementRawObservation<Id>[] = [];
  for (const { concept } of PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY) {
    const result = scanConcept(taxonomy?.[concept], concept, context);
    scans.push(Object.freeze({ concept, scan: result.scan }));
    observations.push(...result.observations);
  }
  return Object.freeze({
    registryVersion: PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY_VERSION,
    scans: Object.freeze(scans),
    observations: Object.freeze(observations),
  });
}

function issuerFacts(value: unknown, cik: string): Record<string, unknown> {
  if (!isRecord(value)) invalidSource();
  if (normalizePersonalSecSourceCik(value.cik) !== cik) invalidSource();
  if (!isRecord(value.facts)) invalidSource();
  return value.facts;
}
function sourceTaxonomy(
  value: unknown,
  cik: string,
): Record<string, unknown> | undefined {
  const taxonomy = issuerFacts(value, cik)["us-gaap"];
  if (taxonomy === undefined) return undefined;
  if (!isRecord(taxonomy)) invalidSource();
  return taxonomy;
}

function scanConcept<Id extends string>(
  entry: unknown,
  concept: PersonalSecAnnualStatementConcept,
  context: ScanContext<Id>,
): Readonly<{
  scan: PersonalSecAnnualStatementScanDto;
  observations: readonly PersonalSecStatementRawObservation<Id>[];
}> {
  try {
    const { rows, absence } = candidates(entry);
    if (rows.length > LIMITS.candidateRowsPerConcept)
      throw new PersonalSecSourceError("candidate_limit");
    const unique = new Map<string, PersonalSecStatementRawObservation<Id>>();
    let invalidRows = 0;
    let duplicateRows = 0;
    for (const [index, raw] of rows.entries()) {
      const source = normalizePersonalSecSourceFactFields(raw);
      if (source === null) {
        invalidRows++;
        continue;
      }
      const fields = {
        taxonomy: "us-gaap" as const,
        concept,
        unit: "USD" as const,
        ...source,
      };
      const { key: serialized, id } = context.identify(fields);
      if (unique.has(serialized)) {
        duplicateRows++;
        continue;
      }
      unique.set(
        serialized,
        Object.freeze({
          id,
          ...fields,
          sourceLocator: `/facts/us-gaap/${concept}/units/USD/${index}`,
        }),
      );
    }
    const all = [...unique.values()];
    const selected =
      context.accession === null
        ? null
        : all.filter((row) => row.accessionNumber === context.accession);
    const observations =
      selected !== null && selected.length <= LIMITS.observationsPerConcept
        ? selected.sort(compareRows)
        : [];
    return Object.freeze({
      scan: Object.freeze({
        status: "available",
        absence,
        coverage: Object.freeze({
          full: Object.freeze({
            candidateRows: rows.length,
            inspectedRows: rows.length,
            invalidRows,
            duplicateRows,
            uniqueObservations: all.length,
          }),
          selected: selected?.length ?? null,
          otherAccessions:
            selected === null ? null : all.length - selected.length,
          returned: observations.length,
          omittedSelected:
            selected === null ? null : selected.length - observations.length,
        }),
      }),
      observations: Object.freeze(observations),
    });
  } catch (error) {
    if (
      !(error instanceof PersonalSecSourceError) ||
      (error.status !== "invalid_response" &&
        error.status !== "candidate_limit")
    )
      throw error;
    return Object.freeze({
      scan: Object.freeze({
        status: error.status,
        absence: null,
        coverage: null,
      }),
      observations: Object.freeze([]),
    });
  }
}

function candidates(entry: unknown): Readonly<{
  rows: readonly unknown[];
  absence: PersonalSecAnnualStatementAbsence | null;
}> {
  if (entry === undefined) return { rows: [], absence: "concept_missing" };
  const rows = conceptUnits(entry).USD;
  if (rows === undefined) return { rows: [], absence: "usd_missing" };
  if (!Array.isArray(rows)) invalidSource();
  return { rows, absence: rows.length === 0 ? "empty_usd" : null };
}
function conceptUnits(entry: unknown): Record<string, unknown> {
  if (!isRecord(entry)) invalidSource();
  if (!isRecord(entry.units)) invalidSource();
  return entry.units;
}

function compareRows(
  a: PersonalSecStatementRawObservation<string>,
  b: PersonalSecStatementRawObservation<string>,
): number {
  return (
    b.endDate.localeCompare(a.endDate) ||
    (b.startDate ?? "").localeCompare(a.startDate ?? "") ||
    b.filedDate.localeCompare(a.filedDate) ||
    a.accessionNumber.localeCompare(b.accessionNumber) ||
    a.id.localeCompare(b.id)
  );
}

/** Structural source failures retain one status throughout envelope and concept admission. */
function invalidSource(): never {
  throw new PersonalSecSourceError("invalid_response");
}
