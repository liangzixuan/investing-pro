import {
  ProofFailure,
  type ProofFailureReason,
} from "./appwrite-storage-proof-phase";
import {
  VALUATION_PROOF_PHASES,
  VALUATION_PROOF_PLAN_SHA256,
  type ValuationProofPhase,
} from "./valuation-assumptions-proof-data";
import {
  ValuationProofContext,
  valuationRepositoryCode,
} from "./valuation-assumptions-storage-proof-context";
import {
  requireValuationProof as requireProof,
  valuationProofFingerprint,
} from "./valuation-assumptions-storage-proof-evidence";
import {
  VALUATION_STORAGE_PHASE_ACTIONS,
  valuationSchema,
} from "./valuation-assumptions-storage-proof-phases";
import type {
  ValuationProofFactory,
  ValuationProofReport,
} from "./valuation-assumptions-storage-proof-types";
export type {
  ValuationProofFactory,
  ValuationProofOperation,
  ValuationProofReport,
} from "./valuation-assumptions-storage-proof-types";

interface Outcome {
  outcome: ValuationProofReport["outcome"];
  failure: ValuationProofReport["failure"];
}
const OPERATION_COUNTS: Readonly<
  Record<ValuationProofPhase, readonly number[]>
> = Object.freeze({
  schema: [0],
  preflight: [18],
  "create-isolation": [18],
  stale: [14],
  prestage: [17, 18, 19],
  overlap: [18, 19],
  rollback: [10],
  unknown: [9],
  capacity: [8],
  "domain-guards": [15],
  "historical-edit-and-catalog-review": [18],
  reopen: [6],
  remove: [9],
  "reopen-empty": [1],
});
function admittedSnapshot(context: ValuationProofContext) {
  const value = context.operation?.snapshot();
  requireProof(value);
  requireProof(Number.isSafeInteger(value.requests));
  requireProof(value.requests >= 0 && value.requests <= 20);
  requireProof(typeof value.closed === "boolean");
  if (value.lastStatus !== null) {
    requireProof(Number.isInteger(value.lastStatus));
    requireProof(value.lastStatus >= 100 && value.lastStatus <= 599);
  }
  return value;
}
function failed(context: ValuationProofContext, error: unknown): Outcome {
  context.repositoryError =
    valuationRepositoryCode(error) ?? context.repositoryError;
  let failure: ProofFailureReason = "operation_failed";
  if (error instanceof ProofFailure) failure = error.reason;
  if (context.lifetime.limitReached) failure = "operation_limit";
  if (context.lifetime.controller.signal.aborted) failure = "deadline";
  const incomplete = [
    "deadline",
    "operation_limit",
    "stage_not_reached",
  ].includes(failure);
  return { outcome: incomplete ? "incomplete" : "failed", failure };
}
async function close(
  context: ValuationProofContext,
  outcome: Outcome,
): Promise<void> {
  try {
    await context.lifetime.close(context.operation);
  } catch {
    outcome.outcome = "incomplete";
    outcome.failure = "cleanup_failed";
  }
  if (!context.lifetime.rollbackIncomplete) return;
  outcome.outcome = "incomplete";
  outcome.failure = "cleanup_failed";
}
function snapshot(context: ValuationProofContext, outcome: Outcome) {
  let httpDispatches: number | null = null,
    upstreamStatus: number | null = null;
  let closed = false;
  try {
    const value = admittedSnapshot(context);
    if (outcome.outcome === "passed") {
      requireProof(
        OPERATION_COUNTS[context.phase].includes(context.lifetime.count),
      );
      const expected =
        context.phase === "schema"
          ? 2
          : context.lifetime.count - (context.phase === "rollback" ? 1 : 0);
      requireProof(value.requests === expected);
    }
    httpDispatches = value.requests;
    upstreamStatus = value.lastStatus;
    closed = value.closed;
    if (context.phase === "schema") context.metadataCount = value.requests;
    requireProof(closed);
  } catch {
    outcome.outcome = "incomplete";
    outcome.failure = "cleanup_failed";
  }
  return {
    httpDispatches,
    upstreamStatus: context.lifetime.upstreamStatus ?? upstreamStatus,
    closed,
  };
}
function freezeReport<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeReport(child);
  return Object.freeze(value);
}
function observations(context: ValuationProofContext) {
  return {
    currentRecords: [...context.rows]
      .filter(([, row]) => row.$tableId !== "receipts")
      .map(([rowId, row]) => ({
        rowId,
        version: row.version as number,
        digestSha256: row.digestSha256 as string,
        createdAt: row.createdAt as string,
        updatedAt: row.updatedAt as string,
      })),
    rowFingerprints: [...context.rows].map(([rowId, row]) => ({
      rowId,
      sha256: valuationProofFingerprint(row),
    })),
    receipts: [...context.rows]
      .filter(([, row]) => row.$tableId === "receipts")
      .map(([rowId, row]) => ({
        rowId,
        version: row.version as number,
        digestSha256: row.digestSha256 as string,
        committedAt: row.committedAt as string,
      })),
    trace: context.lifetime.trace.map((entry) => ({ ...entry })),
  };
}
function report(
  context: ValuationProofContext,
  buildProof: string,
  outcome: Outcome,
  schema: ValuationProofReport["schema"],
): ValuationProofReport {
  const transport = snapshot(context, outcome);
  const elapsed = performance.now() - context.lifetime.started;
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    outcome.outcome = "failed";
    outcome.failure = "unexpected_result";
  }
  const result: ValuationProofReport = {
    version: 1,
    buildProof,
    planSha256: VALUATION_PROOF_PLAN_SHA256,
    phase: context.phase,
    ...outcome,
    repositoryError: context.repositoryError,
    operationCount: context.lifetime.count,
    metadataCount: context.metadataCount,
    ...transport,
    elapsedMs:
      Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed) : null,
    observedVersion: context.observedVersion,
    rollbackObserved: context.lifetime.rollbackObserved,
    cleanupIncomplete:
      context.lifetime.rollbackIncomplete ||
      outcome.failure === "cleanup_failed",
    checks: [...context.checks],
    ...observations(context),
    schema,
  };
  requireProof(Buffer.byteLength(JSON.stringify(result)) <= 8192);
  return freezeReport(result);
}

/** Fixed, source-owned phases only. No invocation accepts a row, principal or payload. */
export async function runValuationAssumptionsStorageProof(
  phase: ValuationProofPhase,
  buildProof: string,
  factory: ValuationProofFactory,
): Promise<ValuationProofReport> {
  if (!VALUATION_PROOF_PHASES.includes(phase))
    throw new Error("Invalid valuation proof phase");
  if (!/^[0-9a-f]{64}$/u.test(buildProof))
    throw new Error("Invalid valuation proof build");
  const context = new ValuationProofContext(phase);
  let outcome: Outcome = { outcome: "passed", failure: "none" };
  let schema: ValuationProofReport["schema"] = null;
  try {
    context.operation = factory(context.lifetime.controller.signal);
    if (phase === "schema") schema = await valuationSchema(context);
    else await VALUATION_STORAGE_PHASE_ACTIONS[phase](context);
  } catch (error) {
    outcome = failed(context, error);
  } finally {
    await close(context, outcome);
  }
  return report(context, buildProof, outcome, schema);
}
