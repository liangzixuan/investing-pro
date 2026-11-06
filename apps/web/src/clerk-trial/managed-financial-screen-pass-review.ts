import type {
  ManagedFinancialScreenRun,
  ManagedFinancialScreenMember,
} from "./managed-financial-screen";
export interface FinancialScreenPassReviewPlan {
  readonly sourceRun: ManagedFinancialScreenRun;
  readonly preparedAt: string;
  readonly requests: readonly ManagedFinancialScreenMember[];
}
/** One passive baseline and one finite same-definition pass; no nested history. */
export function prepareFinancialScreenPassReview(
  run: ManagedFinancialScreenRun,
  preparedAt: string,
): FinancialScreenPassReviewPlan | null {
  if (
    run.status === "running" ||
    !run.completedAt ||
    !run.rows.length ||
    run.continuations?.some((pass) => pass.status === "running") ||
    !Number.isFinite(Date.parse(preparedAt)) ||
    new Date(preparedAt).toISOString() !== preparedAt
  )
    return null;
  return Object.freeze({
    sourceRun: run,
    preparedAt,
    requests: Object.freeze(run.rows.map((row) => row.member)),
  });
}
