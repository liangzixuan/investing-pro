import type {
  ManagedFinancialScreenMember,
  ManagedFinancialScreenResultRow,
  ManagedFinancialScreenRun,
} from "./managed-financial-screen";

export interface FinancialScreenContinuationPlan {
  readonly sourceRun: ManagedFinancialScreenRun;
  readonly preparedAt: string;
  readonly rows: readonly {
    readonly row: ManagedFinancialScreenResultRow;
    readonly disposition: "retained" | "missing";
    readonly reason: string;
  }[];
  readonly requests: readonly ManagedFinancialScreenMember[];
}
export interface FinancialScreenContinuationAttempt {
  readonly member: ManagedFinancialScreenMember;
  readonly startedAt: string;
  readonly completedAt: string;
  /** This attempt's evaluation time, separate from an earlier local refinement. */
  readonly evaluatedAt: string | null;
  readonly result: ManagedFinancialScreenResultRow | null;
  readonly status: "completed" | "cancelled";
}
export interface FinancialScreenContinuationPass {
  readonly handle: symbol;
  readonly preparedAt: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly status: "running" | "completed" | "cancelled" | "stopped";
  readonly requests: readonly ManagedFinancialScreenMember[];
  readonly attempts: readonly FinancialScreenContinuationAttempt[];
}

/** Describes retained evidence and a finite missing-only pass; owns no action. */
export function prepareFinancialScreenContinuation(
  run: ManagedFinancialScreenRun,
  preparedAt: string,
): FinancialScreenContinuationPlan | null {
  if (
    run.status === "running" ||
    !run.completedAt ||
    !run.rows.length ||
    run.continuations?.some((pass) => pass.status === "running") ||
    !Number.isFinite(Date.parse(preparedAt)) ||
    new Date(preparedAt).toISOString() !== preparedAt
  )
    return null;
  const rows = Object.freeze(
    run.rows.map((row) =>
      Object.freeze({
        row,
        disposition: row.report?.response
          ? ("retained" as const)
          : ("missing" as const),
        reason: row.report?.response
          ? "Keep the admitted packet and its original dates, including partial or unknown values."
          : (row.failure ?? "No Annual response was retained."),
      }),
    ),
  );
  const requests = Object.freeze(
    rows
      .filter((row) => row.disposition === "missing")
      .map((row) => row.row.member),
  );
  if (!requests.length) return null;
  return Object.freeze({ sourceRun: run, preparedAt, rows, requests });
}
