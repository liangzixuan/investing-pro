import { createHash } from "node:crypto";

import {
  PERSONAL_SEC_ANNUAL_CASH_LIMITS as LIMITS,
  type PersonalSecAnnualCashAbsence,
  type PersonalSecAnnualCashConcept,
  type PersonalSecAnnualCashObservationDto,
  type PersonalSecAnnualCashScanDto,
  type PersonalSecAnnualScanStatus,
} from "@research-cockpit/contracts";

import {
  isPersonalSecSourceRecord as isRecord,
  normalizePersonalSecCompanyFacts,
  normalizePersonalSecSourceCik,
  normalizePersonalSecSourceFactFields,
  PersonalSecSourceError,
} from "./personal-sec-quarterly-evidence-provider";

type WithoutFiling<T> = T extends unknown ? Omit<T, "filing"> : never;
type CashRow = WithoutFiling<PersonalSecAnnualCashObservationDto>;
export interface PersonalSecAnnualCashSourceMetric {
  readonly scan: PersonalSecAnnualCashScanDto;
  readonly observations: readonly CashRow[];
}

/** The complete parsed issuer envelope is shared; fixed concept scans are not. */
export function normalizePersonalSecAnnualCompanyFacts(
  value: unknown,
  cik: string,
  accession: string | null,
) {
  if (
    !isRecord(value) ||
    normalizePersonalSecSourceCik(value.cik) !== cik ||
    !isRecord(value.facts)
  )
    throw new PersonalSecSourceError("invalid_response");
  const taxonomy = value.facts["us-gaap"];
  if (taxonomy !== undefined && !isRecord(taxonomy))
    throw new PersonalSecSourceError("invalid_response");
  const income = scanIncome(value, cik);
  return Object.freeze({
    ...income,
    operatingCashFlow: scanCash(
      taxonomy,
      "NetCashProvidedByUsedInOperatingActivities",
      accession,
    ),
    ppePurchases: scanCash(
      taxonomy,
      "PaymentsToAcquirePropertyPlantAndEquipment",
      accession,
    ),
  });
}

function scanIncome(value: unknown, cik: string) {
  try {
    return Object.freeze({
      incomeScanStatus: "available" as const,
      income: normalizePersonalSecCompanyFacts(value, cik),
    });
  } catch (error) {
    return Object.freeze({
      incomeScanStatus: scanFailure(error),
      income: undefined,
    });
  }
}

export function unavailablePersonalSecAnnualCashMetric(
  status: Exclude<PersonalSecAnnualScanStatus, "available">,
): PersonalSecAnnualCashSourceMetric {
  return Object.freeze({
    scan: Object.freeze({ status, absence: null, coverage: null }),
    observations: Object.freeze([]),
  });
}

function scanCash(
  taxonomy: Record<string, unknown> | undefined,
  concept: PersonalSecAnnualCashConcept,
  accession: string | null,
): PersonalSecAnnualCashSourceMetric {
  try {
    const { rows, absence } = cashCandidates(taxonomy?.[concept]);
    if (rows.length > LIMITS.candidateRowsPerMetric)
      throw new PersonalSecSourceError("candidate_limit");
    const normalized = normalizeCashRows(rows, concept);
    return selectCash(normalized, rows.length, absence, accession);
  } catch (error) {
    return unavailablePersonalSecAnnualCashMetric(scanFailure(error));
  }
}

function cashCandidates(entry: unknown): {
  rows: readonly unknown[];
  absence: PersonalSecAnnualCashAbsence | null;
} {
  if (entry === undefined) return { rows: [], absence: "concept_missing" };
  if (!isRecord(entry) || !isRecord(entry.units))
    throw new PersonalSecSourceError("invalid_response");
  const rows = entry.units.USD;
  if (rows === undefined) return { rows: [], absence: "usd_missing" };
  if (!Array.isArray(rows))
    throw new PersonalSecSourceError("invalid_response");
  return { rows, absence: rows.length === 0 ? "empty_usd" : null };
}

function normalizeCashRows(
  rows: readonly unknown[],
  concept: PersonalSecAnnualCashConcept,
) {
  const unique = new Map<string, CashRow>();
  let invalidRows = 0;
  let duplicateRows = 0;
  for (const [index, value] of rows.entries()) {
    const row = cashRow(value, concept, index);
    if (row === null) invalidRows += 1;
    else if (unique.has(row.id)) duplicateRows += 1;
    else unique.set(row.id, row);
  }
  return {
    observations: [...unique.values()].sort(compareRows),
    invalidRows,
    duplicateRows,
  };
}

function cashRow(
  value: unknown,
  concept: PersonalSecAnnualCashConcept,
  index: number,
): CashRow | null {
  const source = normalizePersonalSecSourceFactFields(value);
  if (source === null) return null;
  const identity =
    concept === "NetCashProvidedByUsedInOperatingActivities"
      ? {
          metric: "operating_cash_flow" as const,
          taxonomy: "us-gaap" as const,
          concept,
        }
      : {
          metric: "ppe_purchases" as const,
          taxonomy: "us-gaap" as const,
          concept,
        };
  const fields = { ...identity, unit: "USD" as const, ...source };
  return Object.freeze({
    id: `sec-fact:${createHash("sha256").update(JSON.stringify(fields)).digest("hex")}`,
    ...fields,
    sourceLocator: `/facts/us-gaap/${concept}/units/USD/${index}`,
  });
}

function compareRows(a: CashRow, b: CashRow): number {
  return (
    b.endDate.localeCompare(a.endDate) ||
    (b.startDate ?? "").localeCompare(a.startDate ?? "") ||
    b.filedDate.localeCompare(a.filedDate) ||
    a.accessionNumber.localeCompare(b.accessionNumber) ||
    a.concept.localeCompare(b.concept) ||
    a.id.localeCompare(b.id)
  );
}

function selectCash(
  normalized: ReturnType<typeof normalizeCashRows>,
  candidateRows: number,
  absence: PersonalSecAnnualCashAbsence | null,
  accession: string | null,
): PersonalSecAnnualCashSourceMetric {
  const selected =
    accession === null
      ? null
      : normalized.observations.filter(
          (row) => row.accessionNumber === accession,
        );
  const observations =
    selected !== null && selected.length <= LIMITS.observationsPerMetric
      ? selected
      : [];
  return Object.freeze({
    scan: Object.freeze({
      status: "available",
      absence,
      coverage: Object.freeze({
        full: Object.freeze({
          candidateRows,
          inspectedRows: candidateRows,
          invalidRows: normalized.invalidRows,
          duplicateRows: normalized.duplicateRows,
          uniqueObservations: normalized.observations.length,
        }),
        selected: selected?.length ?? null,
        otherAccessions:
          selected === null
            ? null
            : normalized.observations.length - selected.length,
        returned: observations.length,
        omittedSelected:
          selected === null ? null : selected.length - observations.length,
      }),
    }),
    observations: Object.freeze(observations),
  });
}

function scanFailure(error: unknown): "invalid_response" | "candidate_limit" {
  if (
    error instanceof PersonalSecSourceError &&
    (error.status === "invalid_response" || error.status === "candidate_limit")
  )
    return error.status;
  throw error;
}
