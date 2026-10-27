import {
  PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY as registry,
  PERSONAL_SEC_INTERIM_STATEMENT_FACT_LIMITS as limits,
  type PersonalSecInterimCanonicalEvidenceDto as Evidence,
  type PersonalSecInterimStatementObservationDto as Row,
  type PersonalSecInterimStatementReason as Reason,
  type PersonalSecInterimStatementCellDto as Cell,
  type PersonalSecInterimStatementPeriodDto as Period,
  type PersonalSecInterimStatementRowDto,
  type PersonalSecInterimStatementsDto,
} from "@research-cockpit/contracts";
import {
  assertPersonalSecInterimCanonicalEvidence,
  interimTemporalContext,
} from "./personal-sec-interim-evidence";
import { freeze } from "./personal-sec-interim-validation";
type Entry = (typeof registry)[number];

function contextReason(evidence: Evidence): Reason | null {
  if (!interimTemporalContext(evidence)) return "invalid_clock";
  if (
    Object.values(evidence.generation.sources).some(
      (source) => source.status !== "available",
    )
  )
    return "source_unavailable";
  return evidence.target.status === "target" ? null : "target_unresolved";
}
function scanReason(evidence: Evidence, index: number): Reason | null {
  const scan = evidence.facts.scans[index]!.scan;
  if (scan.status !== "available") return scan.status;
  if (scan.coverage.full.invalidRows > 0) return "invalid_source_rows";
  if ((scan.coverage.selected ?? 0) > limits.observationsPerConcept)
    return "selected_report_overflow";
  return scan.absence;
}
function periodReason(row: Row, entry: Entry): Reason | null {
  if (entry.periodType === "duration" && row.startDate === null)
    return "invalid_duration_period";
  if (entry.periodType === "instant" && row.startDate !== null)
    return "invalid_instant_period";
  return null;
}
function filingReason(row: Row, reportDate: string): Reason | null {
  if (row.filing.status !== "matched") return "filing_unmatched_or_conflicted";
  if (row.filing.reportDate !== reportDate) return "report_end_mismatch";
  if (row.endDate > reportDate || row.endDate > row.filedDate)
    return "future_or_inconsistent_dates";
  return null;
}
function rowReason(row: Row, entry: Entry, evidence: Evidence): Reason | null {
  if (evidence.target.status !== "target") return "target_unresolved";
  if (row.form !== "10-Q") return "unsupported_form";
  return (
    periodReason(row, entry) ?? filingReason(row, evidence.target.reportDate)
  );
}
function periodKind(row: Row, evidence: Evidence): Period["kind"] {
  if (evidence.target.status !== "target") return "unresolved";
  if (row.endDate > evidence.target.reportDate) return "unresolved";
  return row.endDate === evidence.target.reportDate
    ? "selected_report"
    : "comparative";
}
function period(row: Row, entry: Entry, evidence: Evidence): Period {
  return {
    key: JSON.stringify([entry.periodType, row.startDate, row.endDate]),
    periodType: entry.periodType,
    startDate: row.startDate,
    endDate: row.endDate,
    durationDays: row.durationDays,
    kind: periodKind(row, evidence),
    classification:
      entry.periodType === "instant" ? "instant" : "not_established",
  };
}
function projectCell(
  rows: readonly Row[],
  entry: Entry,
  evidence: Evidence,
  refusal: Reason | null,
): Cell {
  const first = rows[0]!;
  const shared = {
    period: period(first, entry, evidence),
    observationIds: rows.map((row) => row.id),
  };
  const reason =
    refusal ??
    rows
      .map((row) => rowReason(row, entry, evidence))
      .find((value) => value !== null) ??
    null;
  if (reason) return { ...shared, status: "unavailable", reason };
  if (rows.some((row) => row.value !== first.value))
    return { ...shared, status: "unavailable", reason: "ambiguous_value" };
  return { ...shared, status: "available", value: first.value };
}
function groupPeriods(entry: Entry, evidence: Evidence): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();
  for (const row of evidence.facts.observations) {
    if (row.concept !== entry.concept) continue;
    const key = period(row, entry, evidence).key;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return groups;
}
function projectRow(
  entry: Entry,
  index: number,
  evidence: Evidence,
  context: Reason | null,
): PersonalSecInterimStatementRowDto {
  const groups = groupPeriods(entry, evidence);
  const reason =
    context ??
    scanReason(evidence, index) ??
    (groups.size === 0 ? "no_report_period" : null);
  return {
    concept: entry.concept,
    lineId: entry.lineId,
    reason,
    cells: Array.from(groups.values(), (group) =>
      projectCell(group, entry, evidence, reason),
    ),
  };
}
/** Exact reported windows only. No period subtraction, taxonomy substitution or fiscal inference. */
export function resolvePersonalSecInterimStatements(
  evidence: Evidence,
): PersonalSecInterimStatementsDto {
  assertPersonalSecInterimCanonicalEvidence(evidence);
  const context = contextReason(evidence);
  const rows = registry.map((entry, index) => ({
    statement: entry.statement,
    row: projectRow(entry, index, evidence, context),
  }));
  return freeze({
    contextReason: context,
    statements: (
      ["income_statement", "balance_sheet", "cash_flow"] as const
    ).map((id) => ({
      id,
      rows: rows
        .filter((item) => item.statement === id)
        .map((item) => item.row),
    })),
  });
}
