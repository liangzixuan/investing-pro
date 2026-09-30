import { createHash } from "node:crypto";

import { AppwriteException, TablesDB } from "node-appwrite";

import { createAppwriteTransport } from "./appwrite-transport";
import {
  appwriteWatchlistStore,
  createAppwriteWatchlistRepository,
  type AppwriteWatchlistStore,
} from "./appwrite-watchlist-repository";
import {
  CLERK_TRIAL_CATALOG,
  fromClerkTrialPayload,
  toClerkTrialPayload,
} from "./clerk-trial-catalog";
import type { ClerkTrialFunctionContext } from "./clerk-trial-function";
import {
  WatchlistRepositoryError,
  type MainWatchlistReceipt,
  type PutMainWatchlistCommand,
  type WatchlistRepositoryErrorCode,
} from "./watchlist-repository";

export const CLERK_TRIAL_PROOF_PHASES = [
  "create",
  "stale",
  "prestage",
  "overlap",
  "rollback",
  "unknown",
  "reopen",
] as const;
export type ClerkTrialProofPhase = (typeof CLERK_TRIAL_PROOF_PHASES)[number];
const LIMITS: Record<ClerkTrialProofPhase, number> = {
  create: 16,
  stale: 16,
  prestage: 20,
  overlap: 20,
  rollback: 12,
  unknown: 12,
  reopen: 2,
};
const DATABASE = "investment_clerk_trial_v1";
const PRINCIPAL = Object.freeze({ userId: "proof-watchlist-20260929-v2" });
const KEY_PREFIX = "proof-20260929-v2-";
const NOTES = {
  create: "Invented proof create",
  stale: "Invented proof stale winner",
  prestage: "Invented proof prestage winner",
  overlap: "Invented proof overlap winner",
  unknown: "Invented proof acknowledged later",
};
export const CLERK_TRIAL_PROOF_PLAN_SHA256 = createHash("sha256")
  .update(
    JSON.stringify({
      version: 1,
      database: DATABASE,
      principal: PRINCIPAL.userId,
      keys: KEY_PREFIX,
      notes: NOTES,
      phases: CLERK_TRIAL_PROOF_PHASES,
      limits: LIMITS,
      snapshot: CLERK_TRIAL_CATALOG.snapshotSha256,
    }),
  )
  .digest("hex");

export interface ClerkTrialProofOperation {
  newStore(): AppwriteWatchlistStore;
  snapshot(): { readonly requests: number; readonly lastStatus: number | null };
  close(): Promise<void>;
}
export type ClerkTrialProofFactory = (
  signal: AbortSignal,
) => ClerkTrialProofOperation;
type ProofActor =
  "read" | "writer" | "winner" | "loser" | "replay" | "inspection";
type TraceOperation =
  | "read_current"
  | "read_receipt"
  | "begin"
  | "create_current"
  | "create_receipt"
  | "update_payload"
  | "increment"
  | "commit"
  | "rollback";
const ERROR_TYPES = [
  "row_not_found",
  "attribute_limit_exceeded",
  "transaction_conflict",
  "transaction_failed",
  "document_invalid_structure",
  "row_invalid_structure",
  "general_argument_invalid",
] as const;
type TraceErrorType = (typeof ERROR_TYPES)[number] | "other";
interface OperationTrace {
  sequence: number;
  actor: ProofActor;
  operation: TraceOperation;
  outcome: "pending" | "ok" | "appwrite_error" | "error";
  status: number | null;
  errorType: TraceErrorType | null;
  transactionStatus:
    "pending" | "committing" | "committed" | "failed" | "other" | null;
}
export interface ClerkTrialProofReport {
  readonly version: 1;
  readonly buildProof: string;
  readonly planSha256: string;
  readonly phase: ClerkTrialProofPhase;
  readonly outcome: "passed" | "failed" | "incomplete";
  readonly observedVersion: number | null;
  readonly repositoryError: WatchlistRepositoryErrorCode | null;
  readonly failure:
    | "none"
    | "unexpected_result"
    | "stage_not_reached"
    | "deadline"
    | "operation_limit"
    | "operation_failed"
    | "cleanup_failed";
  readonly upstreamStatus: number | null;
  readonly operationCount: number;
  readonly httpDispatches: number;
  readonly elapsedMs: number;
  readonly payloadEqual: boolean;
  readonly receiptEqual: boolean;
  readonly losingReceiptAbsent: boolean;
  readonly rollbackObserved: boolean;
  readonly replayed: boolean;
  readonly injectedFailure:
    "none" | "before_receipt" | "after_commit_acknowledgment";
  /** Store dispatch order after hooks; this is not a wire trace. */
  readonly trace: readonly Readonly<OperationTrace>[];
}
class ProofFailure extends Error {
  constructor(readonly reason: ClerkTrialProofReport["failure"]) {
    super(reason);
  }
}
function requireProof(value: unknown): asserts value {
  if (!value) throw new ProofFailure("unexpected_result");
}
function command(
  expectedVersion: number,
  key: string,
  note: string,
): PutMainWatchlistCommand {
  return {
    expectedVersion,
    idempotencyKey: `${KEY_PREFIX}${key}`,
    payload: toClerkTrialPayload(["DEMO_A", "DEMO_B"], note),
  };
}
function receiptId(key: string) {
  return `r${createHash("sha256")
    .update(JSON.stringify([PRINCIPAL.userId, "main", `${KEY_PREFIX}${key}`]))
    .digest("hex")
    .slice(0, 32)}`;
}
function repositoryCode(error: unknown): WatchlistRepositoryErrorCode | null {
  return error instanceof WatchlistRepositoryError ? error.code : null;
}
type PutOutcome =
  { ok: true; receipt: MainWatchlistReceipt } | { ok: false; error: unknown };
type Hooks = {
  beforeIncrement?: () => Promise<void>;
  beforeReceipt?: () => void;
  beforeCommit?: () => Promise<void>;
  afterCommit?: (
    input: { transactionId: string; commit?: boolean; rollback?: boolean },
    result: unknown,
  ) => void;
};

/** Each invocation is one phase. Callers must stop after a non-passing result. */
export async function runClerkTrialStorageProof(
  phase: ClerkTrialProofPhase,
  buildProof: string,
  factory: ClerkTrialProofFactory,
): Promise<ClerkTrialProofReport> {
  if (
    !CLERK_TRIAL_PROOF_PHASES.includes(phase) ||
    !/^[0-9a-f]{64}$/u.test(buildProof)
  )
    throw new Error("Invalid proof configuration");
  const started = performance.now();
  const controller = new AbortController();
  // Reserve the final second of the 12-second invocation for cancellation/close.
  const timer = setTimeout(() => controller.abort(), 11000);
  const abort = new Promise<never>((_, reject) =>
    controller.signal.addEventListener(
      "abort",
      () => reject(new ProofFailure("deadline")),
      { once: true },
    ),
  );
  // The shared abort promise may reject while no operation is waiting on it.
  void abort.catch(() => undefined);
  let stopped = false;
  let operation: ClerkTrialProofOperation | undefined;
  let count = 0;
  let upstreamStatus: number | null = null;
  let observedVersion: number | null = null;
  let payloadEqual = false,
    receiptEqual = false,
    losingReceiptAbsent = false,
    rollbackObserved = false,
    replayed = false;
  const injection: { value: ClerkTrialProofReport["injectedFailure"] } = {
    value: "none",
  };
  let limitReached = false;
  let overlapLoserReceiptAbsentAfterCommit = false;
  let outcome: ClerkTrialProofReport["outcome"];
  let failure: ClerkTrialProofReport["failure"] = "none";
  let errorCode: WatchlistRepositoryErrorCode | null = null;
  const releases: (() => void)[] = [];
  const actors: Promise<PutOutcome>[] = [];
  const trace: OperationTrace[] = [];
  const bounded = <T>(promise: Promise<T>) => Promise.race([promise, abort]);
  function assertRunning() {
    if (stopped || controller.signal.aborted)
      throw new ProofFailure("deadline");
  }
  function barrier() {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    releases.push(release);
    return { wait: () => bounded(promise), release };
  }
  async function call<T>(
    method: keyof AppwriteWatchlistStore,
    action: () => Promise<T>,
  ) {
    assertRunning();
    if (count >= LIMITS[phase]) {
      limitReached = true;
      throw new ProofFailure("operation_limit");
    }
    count++;
    try {
      return await bounded(action());
    } catch (error) {
      if (
        (method === "incrementRowColumn" || method === "updateTransaction") &&
        error instanceof AppwriteException &&
        Number.isInteger(error.code) &&
        error.code >= 400 &&
        error.code <= 599
      )
        upstreamStatus = error.code;
      throw error;
    }
  }
  async function observe<T>(
    actor: ProofActor,
    operation: TraceOperation,
    action: () => Promise<T>,
  ) {
    assertRunning();
    if (trace.length >= 20) throw new ProofFailure("operation_limit");
    const entry: OperationTrace = {
      sequence: trace.length + 1,
      actor,
      operation,
      outcome: "pending",
      status: null,
      errorType: null,
      transactionStatus: null,
    };
    trace.push(entry);
    try {
      const result = await action();
      entry.outcome = "ok";
      if (
        ["begin", "commit", "rollback"].includes(operation) &&
        typeof result === "object" &&
        result !== null &&
        "status" in result
      ) {
        const status = result.status;
        entry.transactionStatus =
          status === "pending" ||
          status === "committing" ||
          status === "committed" ||
          status === "failed"
            ? status
            : "other";
      }
      return result;
    } catch (error) {
      entry.outcome =
        error instanceof AppwriteException ? "appwrite_error" : "error";
      if (error instanceof AppwriteException) {
        entry.status =
          Number.isInteger(error.code) && error.code >= 100 && error.code <= 599
            ? error.code
            : null;
        entry.errorType =
          ERROR_TYPES.find((value) => value === error.type) ?? "other";
      }
      throw error;
    }
  }
  function store(
    hooks: Hooks = {},
    actor: ProofActor = "writer",
  ): AppwriteWatchlistStore {
    const base = operation!.newStore();
    let commitLimitRejected = false;
    return {
      getRow: (input) =>
        call("getRow", () =>
          observe(
            actor,
            input.tableId === "receipts" ? "read_receipt" : "read_current",
            async () => {
              try {
                return await base.getRow(input);
              } catch (error) {
                if (
                  phase === "overlap" &&
                  actor === "loser" &&
                  commitLimitRejected &&
                  input.databaseId === DATABASE &&
                  input.tableId === "receipts" &&
                  input.rowId === receiptId("overlap-loser") &&
                  error instanceof AppwriteException &&
                  error.code === 404 &&
                  error.type === "row_not_found"
                )
                  overlapLoserReceiptAbsentAfterCommit = true;
                throw error;
              }
            },
          ),
        ),
      createTransaction: (input) =>
        call("createTransaction", () =>
          observe(actor, "begin", () => base.createTransaction(input)),
        ),
      createRow: (input) =>
        call("createRow", async () => {
          if (input.tableId === "receipts") hooks.beforeReceipt?.();
          return observe(
            actor,
            input.tableId === "receipts" ? "create_receipt" : "create_current",
            () => base.createRow(input),
          );
        }),
      updateRow: (input) =>
        call("updateRow", () =>
          observe(actor, "update_payload", () => base.updateRow(input)),
        ),
      incrementRowColumn: (input) =>
        call("incrementRowColumn", async () => {
          await hooks.beforeIncrement?.();
          assertRunning();
          return observe(actor, "increment", () =>
            base.incrementRowColumn(input),
          );
        }),
      updateTransaction: (input) =>
        call("updateTransaction", async () => {
          if (input.commit) await hooks.beforeCommit?.();
          assertRunning();
          const result = await observe(
            actor,
            input.commit ? "commit" : "rollback",
            async () => {
              try {
                return await base.updateTransaction(input);
              } catch (error) {
                if (
                  input.commit &&
                  error instanceof AppwriteException &&
                  error.code === 400 &&
                  error.type === "attribute_limit_exceeded"
                )
                  commitLimitRejected = true;
                throw error;
              }
            },
          );
          if (
            input.rollback &&
            typeof result === "object" &&
            result !== null &&
            "$id" in result &&
            result.$id === input.transactionId &&
            "status" in result &&
            result.status === "failed"
          )
            rollbackObserved = true;
          if (input.commit) hooks.afterCommit?.(input, result);
          return result;
        }),
    };
  }
  function repository(hooks?: Hooks, actor: ProofActor = "writer") {
    return createAppwriteWatchlistRepository({
      store: store(hooks, actor),
      databaseId: DATABASE,
      watchlistsTableId: "watchlists",
      receiptsTableId: "receipts",
      catalog: CLERK_TRIAL_CATALOG,
    });
  }
  function put(
    input: PutMainWatchlistCommand,
    hooks?: Hooks,
    actor: ProofActor = "writer",
  ) {
    const task = repository(hooks, actor)
      .put(PRINCIPAL, input)
      .then(
        (receipt) => ({ ok: true as const, receipt }),
        (error) => ({ ok: false as const, error: error as unknown }),
      );
    actors.push(task);
    return task;
  }
  async function success(
    input: PutMainWatchlistCommand,
    actor: ProofActor = "writer",
  ) {
    const result = await bounded(put(input, undefined, actor));
    if (!result.ok) throw result.error;
    requireProof(
      result.receipt.version === input.expectedVersion + 1 &&
        !result.receipt.replayed,
    );
    return result.receipt;
  }
  async function expectError(
    task: Promise<PutOutcome>,
    code: WatchlistRepositoryErrorCode,
  ) {
    const result = await bounded(task);
    errorCode = result.ok ? null : repositoryCode(result.error);
    requireProof(!result.ok && repositoryCode(result.error) === code);
  }
  async function read(version: number, note: string) {
    const record = await repository(undefined, "read").get(PRINCIPAL);
    observedVersion = record?.version ?? 0;
    if (version === 0) {
      requireProof(record === null);
      payloadEqual = true;
      return;
    }
    requireProof(record !== null && record.version === version);
    requireProof(
      JSON.stringify(fromClerkTrialPayload(record.payload)) ===
        JSON.stringify({ selected: ["DEMO_A", "DEMO_B"], note }),
    );
    payloadEqual = true;
  }
  async function absent(key: string) {
    try {
      await store({}, "inspection").getRow({
        databaseId: DATABASE,
        tableId: "receipts",
        rowId: receiptId(key),
      });
    } catch (error) {
      if (
        error instanceof AppwriteException &&
        error.code === 404 &&
        error.type === "row_not_found"
      ) {
        losingReceiptAbsent = true;
        return;
      }
      throw error;
    }
    throw new ProofFailure("unexpected_result");
  }
  async function replay(
    input: PutMainWatchlistCommand,
    original?: MainWatchlistReceipt,
  ) {
    const result = await bounded(put(input, undefined, "replay"));
    requireProof(
      result.ok &&
        result.receipt.replayed &&
        result.receipt.version === input.expectedVersion + 1,
    );
    if (original)
      requireProof(
        result.receipt.id === original.id &&
          result.receipt.version === original.version &&
          result.receipt.digestSha256 === original.digestSha256 &&
          result.receipt.committedAt === original.committedAt,
      );
    receiptEqual = true;
    replayed = true;
  }
  try {
    operation = factory(controller.signal);
    if (phase === "create") {
      await read(0, "");
      const input = command(0, "create", NOTES.create);
      const original = await success(input);
      await read(1, NOTES.create);
      await replay(input, original);
      await expectError(
        put(command(0, "create", "Invented conflicting key")),
        "idempotency_conflict",
      );
    } else if (phase === "stale") {
      await read(1, NOTES.create);
      await success(command(1, "stale-winner", NOTES.stale), "winner");
      await expectError(
        put(
          command(1, "stale-loser", "Invented stale loser"),
          undefined,
          "loser",
        ),
        "conflict",
      );
      await read(2, NOTES.stale);
      await absent("stale-loser");
    } else if (phase === "prestage") {
      await read(2, NOTES.stale);
      const reached = barrier(),
        release = barrier();
      const loser = put(
        command(2, "prestage-loser", "Invented prestage loser"),
        {
          beforeIncrement: async () => {
            reached.release();
            await release.wait();
          },
        },
        "loser",
      );
      const initial = await Promise.race([
        reached.wait().then(() => true),
        loser.then(() => false),
      ]);
      if (!initial) throw new ProofFailure("stage_not_reached");
      await success(command(2, "prestage-winner", NOTES.prestage), "winner");
      release.release();
      await expectError(loser, "conflict");
      await read(3, NOTES.prestage);
      await absent("prestage-loser");
    } else if (phase === "overlap") {
      await read(3, NOTES.prestage);
      const readyA = barrier(),
        readyB = barrier(),
        releaseA = barrier(),
        releaseB = barrier();
      const winner = put(
        command(3, "overlap-winner", NOTES.overlap),
        {
          beforeCommit: async () => {
            readyA.release();
            await releaseA.wait();
          },
        },
        "winner",
      );
      const loser = put(
        command(3, "overlap-loser", "Invented overlap loser"),
        {
          beforeCommit: async () => {
            readyB.release();
            await releaseB.wait();
          },
        },
        "loser",
      );
      const staged = await Promise.race([
        Promise.all([readyA.wait(), readyB.wait()]).then(() => true),
        winner.then(() => false),
        loser.then(() => false),
      ]);
      if (!staged) throw new ProofFailure("stage_not_reached");
      releaseA.release();
      const won = await bounded(winner);
      requireProof(
        won.ok && won.receipt.version === 4 && !won.receipt.replayed,
      );
      releaseB.release();
      await expectError(loser, "conflict");
      await read(4, NOTES.overlap);
      await replay(command(3, "overlap-winner", NOTES.overlap), won.receipt);
      // Reconciliation may already have read this exact receipt after commit.
      // Both actors have settled; the remaining checks above perform no writes.
      if (overlapLoserReceiptAbsentAfterCommit) losingReceiptAbsent = true;
      else await absent("overlap-loser");
    } else if (phase === "rollback") {
      await read(4, NOTES.overlap);
      await expectError(
        put(command(4, "rollback", "Invented rolled back"), {
          beforeReceipt: () => {
            injection.value = "before_receipt";
            throw new Error("Injected proof failure");
          },
        }),
        "unavailable",
      );
      requireProof(injection.value === "before_receipt" && rollbackObserved);
      await read(4, NOTES.overlap);
      await absent("rollback");
    } else if (phase === "unknown") {
      await read(4, NOTES.overlap);
      const input = command(4, "unknown", NOTES.unknown);
      await expectError(
        put(input, {
          afterCommit: (transaction, result) => {
            requireProof(
              typeof result === "object" &&
                result !== null &&
                "$id" in result &&
                result.$id === transaction.transactionId &&
                "status" in result &&
                result.status === "committed",
            );
            injection.value = "after_commit_acknowledgment";
            throw new Error("Injected lost acknowledgment");
          },
        }),
        "commit_unknown",
      );
      requireProof(injection.value === "after_commit_acknowledgment");
      await replay(input);
      await read(5, NOTES.unknown);
    } else {
      await read(5, NOTES.unknown);
    }
    outcome = "passed";
  } catch (error) {
    errorCode = repositoryCode(error) ?? errorCode;
    failure = controller.signal.aborted
      ? "deadline"
      : limitReached
        ? "operation_limit"
        : error instanceof ProofFailure
          ? error.reason
          : "operation_failed";
    outcome =
      failure === "stage_not_reached" ||
      failure === "deadline" ||
      failure === "operation_limit"
        ? "incomplete"
        : "failed";
  } finally {
    stopped = true;
    controller.abort();
    clearTimeout(timer);
    releases.forEach((release) => release());
    try {
      let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          (async () => {
            await Promise.all(actors);
            await operation?.close();
          })(),
          new Promise<never>((_, reject) => {
            cleanupTimer = setTimeout(
              () => reject(new ProofFailure("cleanup_failed")),
              Math.max(
                0,
                Math.min(1000, 12000 - (performance.now() - started)),
              ),
            );
          }),
        ]);
      } finally {
        clearTimeout(cleanupTimer);
      }
    } catch {
      outcome = "incomplete";
      failure = "cleanup_failed";
    }
  }
  const snapshot = operation?.snapshot();
  const report: ClerkTrialProofReport = {
    version: 1,
    buildProof,
    planSha256: CLERK_TRIAL_PROOF_PLAN_SHA256,
    phase,
    outcome,
    observedVersion,
    repositoryError: errorCode,
    failure,
    upstreamStatus: upstreamStatus ?? snapshot?.lastStatus ?? null,
    operationCount: count,
    httpDispatches: snapshot?.requests ?? 0,
    elapsedMs: Math.max(0, Math.round(performance.now() - started)),
    payloadEqual,
    receiptEqual,
    losingReceiptAbsent,
    rollbackObserved,
    replayed,
    injectedFailure: injection.value,
    trace: trace.map((entry) => ({ ...entry })),
  };
  requireProof(Buffer.byteLength(JSON.stringify(report)) <= 8192);
  return report;
}

/** Private deployment only; no phase accepts caller data or storage locations. */
export function createClerkTrialStorageProofFunction(buildProof: string) {
  if (!/^[0-9a-f]{64}$/u.test(buildProof))
    throw new Error("Invalid proof build binding");
  return async ({ req, res }: ClerkTrialFunctionContext) => {
    const phase = CLERK_TRIAL_PROOF_PHASES.find(
      (value) => req.path === `/proof/${value}`,
    );
    if (
      !phase ||
      req.method !== "POST" ||
      req.queryString ||
      req.bodyText !== ""
    )
      return res.json({ error: "invalid_proof_request" }, 400, {
        "cache-control": "no-store",
      });
    const key = req.headers["x-appwrite-key"];
    if (!key)
      return res.json({ error: "proof_authority_unavailable" }, 503, {
        "cache-control": "no-store",
      });
    const report = await runClerkTrialStorageProof(
      phase,
      buildProof,
      (signal) => {
        const transport = createAppwriteTransport({
          endpoint: "https://nyc.cloud.appwrite.io/v1",
          signal,
        });
        transport.client.setProject("6abac57a0007b7c1a671").setKey(key);
        return {
          newStore: () =>
            appwriteWatchlistStore(new TablesDB(transport.client)),
          snapshot: transport.snapshot,
          close: () => transport.close(),
        };
      },
    );
    return res.json(report, report.outcome === "passed" ? 200 : 409, {
      "cache-control": "no-store",
    });
  };
}
