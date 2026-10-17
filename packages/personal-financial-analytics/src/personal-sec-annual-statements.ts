import {
  PERSONAL_SEC_ANNUAL_STATEMENT_CELL_REASONS,
  PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  type PersonalSecAnnualCanonicalEvidenceDto,
  type PersonalSecAnnualStatementCellDto,
  type PersonalSecAnnualStatementCellReason,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementId,
  type PersonalSecAnnualStatementObservationDto,
  type PersonalSecAnnualStatementsDto,
} from "@research-cockpit/contracts";
import {
  getPersonalSecAnnualFilingReason,
  getPersonalSecAnnualRowReason,
  getPersonalSecAnnualSourceClockReason,
  getPersonalSecAnnualSourceUtilityAge,
} from "./personal-sec-annual-evidence";
import { assertPersonalSecAnnualCanonicalEvidence } from "./personal-sec-annual-statement-facts";

type Evidence = PersonalSecAnnualCanonicalEvidenceDto;
type Row = PersonalSecAnnualStatementObservationDto;
type Reason = PersonalSecAnnualStatementCellReason;
const statementIds = [
  "income_statement",
  "balance_sheet",
  "cash_flow",
] as const;
const rowReasonOrder: readonly Reason[] = [
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
];

/** Projects reported cells from an admitted canonical graph; performs no source read or derived financial arithmetic. */
export function resolvePersonalSecAnnualStatements(
  evidence: Evidence,
): PersonalSecAnnualStatementsDto {
  assertPersonalSecAnnualCanonicalEvidence(evidence);
  const contextReason = contextRefusal(evidence);
  const utilityAge = getPersonalSecAnnualSourceUtilityAge(
    evidence.generation,
    evidence.target,
  );
  const scans = new Map(
    evidence.facts.scans.map((item) => [item.concept, item.scan]),
  );
  const rows = new Map<PersonalSecAnnualStatementConcept, Row[]>();
  for (const row of evidence.facts.observations) {
    const list = rows.get(row.concept) ?? [];
    list.push(row);
    rows.set(row.concept, list);
  }
  const scanReason = (
    concept: PersonalSecAnnualStatementConcept,
  ): Reason | null => {
    const scan = scans.get(concept)!;
    if (scan.status !== "available") return scan.status;
    if (scan.coverage.full.invalidRows > 0) return "invalid_source_rows";
    if (
      (scan.coverage.selected ?? 0) >
      PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS.observationsPerConcept
    )
      return "selected_report_overflow";
    return scan.absence;
  };
  const cell = (
    entry: (typeof registry)[number],
    endDate: string,
  ): PersonalSecAnnualStatementCellDto => {
    const values = (rows.get(entry.concept) ?? []).filter(
      (row) => row.endDate === endDate,
    );
    const observationIds = values.map((row) => row.id);
    const unavailable = (
      reason: Reason,
    ): PersonalSecAnnualStatementCellDto => ({
      endDate,
      observationIds,
      status: "unavailable",
      reason,
    });
    const refused = contextReason ?? scanReason(entry.concept);
    if (refused !== null) return unavailable(refused);
    if (values.length === 0) return unavailable("no_report_period");
    const reasons = values.map((row) =>
      rowRefusal(row, entry.periodType, evidence),
    );
    const rowReason = rowReasonOrder.find((reason) => reasons.includes(reason));
    if (rowReason) return unavailable(rowReason);
    const first = values[0]!;
    if (values.some((row) => row.startDate !== first.startDate))
      return unavailable("ambiguous_period");
    if (values.some((row) => row.value !== first.value))
      return unavailable("ambiguous_value");
    return {
      endDate,
      observationIds,
      status: "available",
      value: first.value,
      startDate: first.startDate,
      currentUseEligible:
        evidence.target.status === "target" &&
        endDate === evidence.target.reportDate &&
        utilityAge?.withinWindow === true,
    };
  };
  return freeze({
    contextReason,
    utilityAge,
    statements: statementIds.map((id: PersonalSecAnnualStatementId) => {
      const entries = registry.filter((entry) => entry.statement === id);
      const reportDate =
        evidence.target.status === "target" ? evidence.target.reportDate : null;
      const priorDates =
        contextReason === null && reportDate !== null
          ? [
              ...new Set(
                entries.flatMap((entry) =>
                  scanReason(entry.concept) === null
                    ? (rows.get(entry.concept) ?? [])
                        .filter(
                          (row) =>
                            row.endDate < reportDate &&
                            rowRefusal(row, entry.periodType, evidence) ===
                              null,
                        )
                        .map((row) => row.endDate)
                    : [],
                ),
              ),
            ]
              .sort()
              .reverse()
              .slice(0, 2)
          : [];
      const columns =
        reportDate === null
          ? []
          : [
              { endDate: reportDate, kind: "selected_report" as const },
              ...priorDates.map((endDate) => ({
                endDate,
                kind: "comparative" as const,
              })),
            ];
      return {
        id,
        columns,
        rows: entries.map((entry) => ({
          concept: entry.concept,
          lineId: entry.lineId,
          cells: columns.map((column) => cell(entry, column.endDate)),
        })),
      };
    }),
  });
}

function contextRefusal(evidence: Evidence): Reason | null {
  const sourceReason = getPersonalSecAnnualSourceClockReason(
    evidence.generation,
  );
  if (sourceReason !== null) return sourceReason;
  if (evidence.target.status !== "target") return "target_unresolved";
  const reason = getPersonalSecAnnualFilingReason(
    evidence.target,
    evidence.generation.cutoffAt,
    evidence.generation.sources.submissions.fetchedAt!,
  );
  if (reason !== null) {
    if (!PERSONAL_SEC_ANNUAL_STATEMENT_CELL_REASONS.includes(reason as Reason))
      throw new TypeError("Invalid canonical annual statement filing context.");
    return reason as Reason;
  }
  return getPersonalSecAnnualSourceUtilityAge(
    evidence.generation,
    evidence.target,
  )!.sourceAgeDays.some((age) => age > 7)
    ? "source_stale"
    : null;
}
function rowRefusal(
  row: Row,
  periodType: "duration" | "instant",
  evidence: Evidence,
): Reason | null {
  if (evidence.target.status !== "target") return "target_unresolved";
  if (periodType === "duration")
    return getPersonalSecAnnualRowReason(
      row,
      evidence.generation.cutoffAt,
      evidence.generation.sources.companyFacts.fetchedAt!,
      evidence.target.reportDate,
    ) as Reason | null;
  if (row.form !== "10-K" && row.form !== "20-F") return "unsupported_form";
  if (row.filingFocusPeriod !== "FY") return "missing_or_non_FY_focus";
  if (row.startDate !== null || row.durationDays !== null)
    return "invalid_instant_period";
  if (row.filing.status !== "matched") return "filing_unmatched_or_conflicted";
  if (row.filing.reportDate !== evidence.target.reportDate)
    return "report_end_mismatch";
  if (row.endDate > row.filedDate) return "future_or_inconsistent_dates";
  return null;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
