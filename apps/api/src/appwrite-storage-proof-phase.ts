import { AppwriteException } from "node-appwrite";
import type {
  AppwriteRowLocation,
  AppwriteVersionedRowStore,
} from "./appwrite-versioned-row-store";

export type ProofActor =
  "read" | "writer" | "winner" | "loser" | "replay" | "inspection";
export type TraceOperation =
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
export interface OperationTrace {
  sequence: number;
  actor: ProofActor;
  operation: TraceOperation;
  outcome: "pending" | "ok" | "appwrite_error" | "error";
  status: number | null;
  errorType: (typeof ERROR_TYPES)[number] | "other" | null;
  transactionStatus:
    "pending" | "committing" | "committed" | "failed" | "other" | null;
}
export type ProofFailureReason =
  | "unexpected_result"
  | "stage_not_reached"
  | "deadline"
  | "operation_limit"
  | "operation_failed"
  | "cleanup_failed";
export class ProofFailure extends Error {
  constructor(readonly reason: ProofFailureReason) {
    super(reason);
  }
}
type TransactionInput = Parameters<
  AppwriteVersionedRowStore["updateTransaction"]
>[0];
export interface ProofStoreHooks {
  beforeIncrement?: () => Promise<void>;
  beforeReceipt?: () => void;
  beforeCommit?: () => Promise<void>;
  afterCommit?: (input: TransactionInput, result: unknown) => void;
  visit?: (input: AppwriteRowLocation) => void;
  read?: (input: AppwriteRowLocation, result: unknown) => void;
  readError?: (input: AppwriteRowLocation, error: unknown) => void;
  commitError?: (error: unknown) => void;
}

/** Counting and lifetime only. Resource identities and assertions belong to the caller. */
export class StorageProofPhase {
  readonly started = performance.now();
  readonly controller = new AbortController();
  readonly trace: OperationTrace[] = [];
  readonly actors: Promise<unknown>[] = [];
  readonly releases: (() => void)[] = [];
  count = 0;
  upstreamStatus: number | null = null;
  limitReached = false;
  rollbackObserved = false;
  rollbackIncomplete = false;
  private readonly rollbackEligible = new Set<string>();
  private pendingBegins = 0;
  private stopped = false;
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly abort: Promise<never>;

  constructor(
    private readonly limit: number,
    private readonly reserveRollback = false,
  ) {
    if (!Number.isInteger(limit) || limit < 2 || limit > 20)
      throw new Error("Invalid proof limit");
    this.timer = setTimeout(() => this.controller.abort(), 11000);
    this.abort = new Promise<never>((_, reject) => {
      this.controller.signal.addEventListener(
        "abort",
        () => reject(new ProofFailure("deadline")),
        { once: true },
      );
    });
    void this.abort.catch(() => undefined);
  }
  bounded = <T>(promise: Promise<T>): Promise<T> =>
    Promise.race([promise, this.abort]);
  assertRunning() {
    if (this.stopped || this.controller.signal.aborted)
      throw new ProofFailure("deadline");
  }
  barrier() {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.releases.push(release);
    return { wait: () => this.bounded(promise), release };
  }
  private async call<T>(
    method: keyof AppwriteVersionedRowStore,
    action: () => Promise<T>,
    rollback = false,
  ) {
    try {
      this.assertRunning();
      const ceiling =
        this.limit -
        (this.reserveRollback &&
        (this.pendingBegins > 0 ||
          this.rollbackEligible.size > 0 ||
          method === "createTransaction") &&
        !rollback
          ? 1
          : 0);
      if (this.count >= ceiling) {
        this.limitReached = true;
        throw new ProofFailure("operation_limit");
      }
      this.count++;
      return await this.bounded(action());
    } catch (error) {
      if (rollback) this.rollbackIncomplete = true;
      if (
        (method === "incrementRowColumn" || method === "updateTransaction") &&
        error instanceof AppwriteException &&
        Number.isInteger(error.code) &&
        error.code >= 400 &&
        error.code <= 599
      )
        this.upstreamStatus = error.code;
      throw error;
    }
  }
  private async observe<T>(
    actor: ProofActor,
    operation: TraceOperation,
    action: () => Promise<T>,
  ) {
    this.assertRunning();
    if (
      this.trace.length >=
      20 -
        (this.reserveRollback &&
        (this.pendingBegins > 0 ||
          this.rollbackEligible.size > 0 ||
          operation === "begin") &&
        operation !== "rollback"
          ? 1
          : 0)
    ) {
      this.limitReached = true;
      throw new ProofFailure("operation_limit");
    }
    const entry: OperationTrace = {
      sequence: this.trace.length + 1,
      actor,
      operation,
      outcome: "pending",
      status: null,
      errorType: null,
      transactionStatus: null,
    };
    this.trace.push(entry);
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
  store(
    base: AppwriteVersionedRowStore,
    hooks: ProofStoreHooks = {},
    actor: ProofActor = "writer",
  ): AppwriteVersionedRowStore {
    return {
      getRow: (input) =>
        this.call("getRow", () =>
          this.observe(
            actor,
            input.tableId === "receipts" ? "read_receipt" : "read_current",
            async () => {
              hooks.visit?.(input);
              try {
                const result = await base.getRow(input);
                hooks.read?.(input, result);
                return result;
              } catch (error) {
                hooks.readError?.(input, error);
                throw error;
              }
            },
          ),
        ),
      createTransaction: (input) =>
        this.call("createTransaction", () => {
          this.pendingBegins++;
          return this.observe(actor, "begin", async () => {
            const result = await base.createTransaction(input);
            if (
              typeof result === "object" &&
              result !== null &&
              "$id" in result &&
              typeof result.$id === "string"
            )
              this.rollbackEligible.add(result.$id);
            return result;
          }).finally(() => {
            this.pendingBegins--;
          });
        }),
      createRow: (input) =>
        this.call("createRow", async () => {
          hooks.visit?.(input);
          if (input.tableId === "receipts") hooks.beforeReceipt?.();
          return this.observe(
            actor,
            input.tableId === "receipts" ? "create_receipt" : "create_current",
            () => base.createRow(input),
          );
        }),
      updateRow: (input) =>
        this.call("updateRow", () => {
          hooks.visit?.(input);
          return this.observe(actor, "update_payload", () =>
            base.updateRow(input),
          );
        }),
      incrementRowColumn: (input) =>
        this.call("incrementRowColumn", async () => {
          hooks.visit?.(input);
          await hooks.beforeIncrement?.();
          this.assertRunning();
          return this.observe(actor, "increment", () =>
            base.incrementRowColumn(input),
          );
        }),
      updateTransaction: (input) =>
        this.call(
          "updateTransaction",
          async () => {
            if (input.commit) await hooks.beforeCommit?.();
            this.assertRunning();
            const result = await this.observe(
              actor,
              input.commit ? "commit" : "rollback",
              async () => {
                try {
                  if (input.commit)
                    this.rollbackEligible.delete(input.transactionId);
                  const value = await base.updateTransaction(input);
                  if (
                    input.rollback &&
                    typeof value === "object" &&
                    value !== null &&
                    "$id" in value &&
                    value.$id === input.transactionId &&
                    "status" in value &&
                    value.status === "failed"
                  )
                    this.rollbackEligible.delete(input.transactionId);
                  return value;
                } catch (error) {
                  if (input.commit) hooks.commitError?.(error);
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
              this.rollbackObserved = true;
            if (input.commit) hooks.afterCommit?.(input, result);
            return result;
          },
          input.rollback === true,
        ),
    };
  }
  async close(operation: { close(): Promise<void> } | undefined) {
    this.stopped = true;
    this.controller.abort();
    clearTimeout(this.timer);
    this.releases.forEach((release) => release());
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          const results = await Promise.allSettled([
            ...this.actors,
            Promise.resolve().then(() => operation?.close()),
          ]);
          if (results.some((result) => result.status === "rejected"))
            throw new ProofFailure("cleanup_failed");
        })(),
        new Promise<never>((_, reject) => {
          cleanupTimer = setTimeout(
            () => reject(new ProofFailure("cleanup_failed")),
            Math.max(
              0,
              Math.min(1000, 12000 - (performance.now() - this.started)),
            ),
          );
        }),
      ]);
    } finally {
      clearTimeout(cleanupTimer);
      if (this.pendingBegins > 0 || this.rollbackEligible.size > 0)
        this.rollbackIncomplete = true;
    }
  }
}
