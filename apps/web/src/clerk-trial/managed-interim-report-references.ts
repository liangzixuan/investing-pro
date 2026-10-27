import type { PersonalSecInterimStatementsDto } from "@research-cockpit/contracts";
/** References only: values and full period metadata remain in the one canonical graph. */
export function interimReportReferences(
  value: PersonalSecInterimStatementsDto,
) {
  return {
    contextReason: value.contextReason,
    statements: value.statements.map((statement) => ({
      id: statement.id,
      rows: statement.rows.map((row) => ({
        concept: row.concept,
        lineId: row.lineId,
        reason: row.reason,
        cells: row.cells.map((cell) => ({
          periodKey: cell.period.key,
          observationIds: cell.observationIds,
          status: cell.status,
          reason: cell.status === "unavailable" ? cell.reason : null,
        })),
      })),
    })),
  };
}
