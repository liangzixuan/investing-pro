import type {
  ManagedFinancialScreenRun,
  ManagedFinancialScreenResultRow,
} from "./managed-financial-screen";
import {
  evaluateManagedFinancialScreenRow,
  validateManagedFinancialScreenCriteria,
  type ManagedFinancialScreenCriteria,
  type ManagedFinancialScreenRow,
} from "./managed-financial-screen-results";

export interface FinancialScreenRefinementRow {
  readonly original: ManagedFinancialScreenResultRow;
  readonly revised: ManagedFinancialScreenRow | null;
  readonly originalClauses: readonly (
    ManagedFinancialScreenRow["match"] | null
  )[];
  readonly revisedClauses: readonly (
    ManagedFinancialScreenRow["match"] | null
  )[];
}
export interface FinancialScreenRefinementReading {
  readonly sourceRun: ManagedFinancialScreenRun;
  readonly originalCriteria: ManagedFinancialScreenCriteria;
  readonly criteria: ManagedFinancialScreenCriteria;
  readonly evaluatedAt: string;
  readonly unchanged: boolean;
  readonly rows: readonly FinancialScreenRefinementRow[];
}

/** Re-evaluate only original admitted packets. No source or current-owner authority. */
export function prepareFinancialScreenRefinement(
  run: ManagedFinancialScreenRun,
  value: unknown,
  evaluatedAt: string,
): FinancialScreenRefinementReading | null {
  const criteria = validateManagedFinancialScreenCriteria(value);
  const original = validateManagedFinancialScreenCriteria(run.criteria);
  if (
    !criteria ||
    !original ||
    run.status === "running" ||
    !run.completedAt ||
    !Number.isFinite(Date.parse(evaluatedAt)) ||
    new Date(evaluatedAt).toISOString() !== evaluatedAt
  )
    return null;
  const rows: FinancialScreenRefinementRow[] = [];
  for (const row of run.rows) {
    const response = row.report?.response;
    const revised = response
      ? evaluateManagedFinancialScreenRow(response, criteria)
      : null;
    if (response && !revised) return null;
    const clauses = (definition: ManagedFinancialScreenCriteria) =>
      Object.freeze(
        definition.clauses.map((clause) =>
          response
            ? (evaluateManagedFinancialScreenRow(response, {
                clauses: [clause],
                sort: definition.sort,
              })?.match ?? null)
            : null,
        ),
      );
    rows.push(
      Object.freeze({
        original: row,
        revised,
        originalClauses: clauses(original),
        revisedClauses: clauses(criteria),
      }),
    );
  }
  if (!rows.some((row) => row.revised)) return null;
  return Object.freeze({
    sourceRun: run,
    originalCriteria: run.criteria,
    criteria,
    evaluatedAt,
    unchanged: JSON.stringify(original) === JSON.stringify(criteria),
    rows: Object.freeze(rows),
  });
}
