import type {
  PersonalSecQuarterlyEvidenceDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";

export type PersonalSecQuarterlyComparisonRelation =
  "single_observation" | "same_value" | "different_values";

export type PersonalSecQuarterlyComparison =
  | Readonly<{
      status: "missing_period";
      cik: string;
      selected: PersonalSecQuarterlyObservationDto;
    }>
  | Readonly<{
      status: "compared";
      cik: string;
      selected: PersonalSecQuarterlyObservationDto;
      rows: readonly PersonalSecQuarterlyObservationDto[];
      relation: PersonalSecQuarterlyComparisonRelation;
      distinctAccessions: number;
      distinctValues: number;
      conflictingAccessions: readonly string[];
    }>;

/**
 * Consumes one complete, browser-validated evidence response (at most 200 rows).
 * Canonical decimal strings compare exactly without numeric conversion. This
 * compares retained source observations; it does not select a revision operand.
 */
export function comparePersonalSecQuarterlyObservations(
  evidence: PersonalSecQuarterlyEvidenceDto,
  selectedId: string,
): PersonalSecQuarterlyComparison | null {
  const selected = evidence.observations.find((row) => row.id === selectedId);
  if (selected === undefined) return null;
  if (selected.startDate === null) {
    return Object.freeze({
      status: "missing_period",
      cik: evidence.cik,
      selected: snapshot(selected),
    });
  }

  const rows = evidence.observations
    .filter(
      (row) =>
        row.metric === selected.metric &&
        row.taxonomy === selected.taxonomy &&
        row.concept === selected.concept &&
        row.unit === selected.unit &&
        row.startDate === selected.startDate &&
        row.endDate === selected.endDate,
    )
    .map(snapshot)
    .sort(
      (left, right) =>
        compareText(left.filedDate, right.filedDate) ||
        compareText(left.accessionNumber, right.accessionNumber) ||
        compareText(left.form, right.form) ||
        compareText(left.id, right.id),
    );
  const values = new Set<string>();
  const accessionValues = new Map<string, Set<string>>();
  for (const row of rows) {
    values.add(row.value);
    const reported =
      accessionValues.get(row.accessionNumber) ?? new Set<string>();
    reported.add(row.value);
    accessionValues.set(row.accessionNumber, reported);
  }
  const conflictingAccessions = [...accessionValues]
    .filter(([, reported]) => reported.size > 1)
    .map(([accession]) => accession)
    .sort(compareText);

  return Object.freeze({
    status: "compared",
    cik: evidence.cik,
    selected: rows.find((row) => row.id === selectedId)!,
    rows: Object.freeze(rows),
    relation:
      rows.length === 1
        ? "single_observation"
        : values.size === 1
          ? "same_value"
          : "different_values",
    distinctAccessions: accessionValues.size,
    distinctValues: values.size,
    conflictingAccessions: Object.freeze(conflictingAccessions),
  });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function snapshot(
  row: PersonalSecQuarterlyObservationDto,
): PersonalSecQuarterlyObservationDto {
  return Object.freeze({ ...row, filing: Object.freeze({ ...row.filing }) });
}
