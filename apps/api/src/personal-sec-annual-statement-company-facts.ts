import { createHash } from "node:crypto";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS as LIMITS,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY_VERSION,
  serializePersonalSecAnnualStatementObservation,
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

export type PersonalSecAnnualStatementRawObservation = Omit<
  PersonalSecAnnualStatementObservationDto,
  "filing"
>;
/** Raw source rows; the existing provider separately joins Submissions metadata. */
export type PersonalSecAnnualStatementCompanyFacts = Omit<
  PersonalSecAnnualStatementFactsDto,
  "observations"
> &
  Readonly<{
    observations: readonly PersonalSecAnnualStatementRawObservation[];
  }>;

/** A whole-source failure keeps every registered concept explicitly unavailable. */
export function unavailablePersonalSecAnnualStatementCompanyFacts(
  status: Exclude<PersonalSecAnnualScanStatus, "available">,
): PersonalSecAnnualStatementCompanyFacts {
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
 * Every selected row is retained before annual-period admission, or the entire
 * overflowing concept is withheld. There is no partial selected row set.
 */
export function normalizePersonalSecAnnualStatementCompanyFacts(
  value: unknown,
  cik: string,
  accession: string | null,
): PersonalSecAnnualStatementCompanyFacts {
  if (
    !isRecord(value) ||
    normalizePersonalSecSourceCik(value.cik) !== cik ||
    !isRecord(value.facts)
  )
    throw new PersonalSecSourceError("invalid_response");
  const taxonomy = value.facts["us-gaap"];
  if (taxonomy !== undefined && !isRecord(taxonomy))
    throw new PersonalSecSourceError("invalid_response");
  const scans: PersonalSecAnnualStatementConceptScanDto[] = [];
  const observations: PersonalSecAnnualStatementRawObservation[] = [];
  for (const { concept } of PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY) {
    const result = scanConcept(taxonomy?.[concept], concept, accession);
    scans.push(Object.freeze({ concept, scan: result.scan }));
    observations.push(...result.observations);
  }
  return Object.freeze({
    registryVersion: PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY_VERSION,
    scans: Object.freeze(scans),
    observations: Object.freeze(observations),
  });
}

function scanConcept(
  entry: unknown,
  concept: PersonalSecAnnualStatementConcept,
  accession: string | null,
): Readonly<{
  scan: PersonalSecAnnualStatementScanDto;
  observations: readonly PersonalSecAnnualStatementRawObservation[];
}> {
  try {
    const { rows, absence } = candidates(entry);
    if (rows.length > LIMITS.candidateRowsPerConcept)
      throw new PersonalSecSourceError("candidate_limit");
    const unique = new Map<string, PersonalSecAnnualStatementRawObservation>();
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
      const serialized = serializePersonalSecAnnualStatementObservation(fields);
      if (unique.has(serialized)) {
        duplicateRows++;
        continue;
      }
      const id =
        `sec-fact:${createHash("sha256").update(serialized).digest("hex")}` as const;
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
      accession === null
        ? null
        : all.filter((row) => row.accessionNumber === accession);
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
  if (!isRecord(entry) || !isRecord(entry.units))
    throw new PersonalSecSourceError("invalid_response");
  const rows = entry.units.USD;
  if (rows === undefined) return { rows: [], absence: "usd_missing" };
  if (!Array.isArray(rows))
    throw new PersonalSecSourceError("invalid_response");
  return { rows, absence: rows.length === 0 ? "empty_usd" : null };
}
function compareRows(
  a: PersonalSecAnnualStatementRawObservation,
  b: PersonalSecAnnualStatementRawObservation,
): number {
  return (
    b.endDate.localeCompare(a.endDate) ||
    (b.startDate ?? "").localeCompare(a.startDate ?? "") ||
    b.filedDate.localeCompare(a.filedDate) ||
    a.accessionNumber.localeCompare(b.accessionNumber) ||
    a.id.localeCompare(b.id)
  );
}
