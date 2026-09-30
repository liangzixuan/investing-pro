import { AppwriteException } from "node-appwrite";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppwriteWatchlistStore } from "./appwrite-watchlist-repository";
import type { ClerkTrialFunctionContext } from "./clerk-trial-function";
import {
  CLERK_TRIAL_PROOF_PHASES,
  CLERK_TRIAL_PROOF_PLAN_SHA256,
  createClerkTrialStorageProofFunction,
  runClerkTrialStorageProof,
  type ClerkTrialProofFactory,
  type ClerkTrialProofPhase,
} from "./clerk-trial-storage-proof";

const TIME = "2026-09-29T21:00:00.000Z";
const BUILD = "a".repeat(64);
type Row = Record<string, unknown>;
type Operation = keyof AppwriteWatchlistStore;
type Input<K extends Operation> = Parameters<AppwriteWatchlistStore[K]>[0];
interface Transaction {
  base: Map<string, string | undefined>;
  rows: Map<string, Row>;
}

/** Atomic model: first staged write captures row state; commit verifies all bases. */
class AtomicStore implements AppwriteWatchlistStore {
  readonly rows = new Map<string, Row>();
  readonly transactions = new Map<string, Transaction>();
  readonly calls: { operation: Operation; input: unknown }[] = [];
  beforeIncrement: (() => Promise<void>) | undefined;
  beforeCommit: (() => Promise<void>) | undefined;
  beforeRead: (() => Promise<void>) | undefined;
  fail: { operation: Operation; error: unknown } | undefined;
  commitOutcome: "normal" | "lost-before" | "lost-after" | "malformed-after" =
    "normal";
  rollbackFails = false;
  ordinaryRequestLimit = Infinity;
  private next = 0;

  private visit(operation: Operation, input: unknown) {
    if (
      this.calls.length >= this.ordinaryRequestLimit &&
      !(
        operation === "updateTransaction" &&
        (input as Input<"updateTransaction">).rollback
      )
    )
      throw new AppwriteException("Synthetic reserved rollback slot", 0);
    this.calls.push({ operation, input: structuredClone(input) });
    if (this.fail?.operation === operation) {
      const error = this.fail.error;
      this.fail = undefined;
      throw error;
    }
  }
  private key(input: Input<"getRow">) {
    return JSON.stringify([input.databaseId, input.tableId, input.rowId]);
  }
  private stage(input: Input<"updateRow">): {
    tx: Transaction;
    key: string;
    row: Row | undefined;
  } {
    const tx = this.transactions.get(input.transactionId);
    if (tx === undefined) throw new Error("Missing transaction");
    const key = this.key(input);
    if (!tx.base.has(key)) tx.base.set(key, JSON.stringify(this.rows.get(key)));
    return {
      tx,
      key,
      row: structuredClone(tx.rows.get(key) ?? this.rows.get(key)),
    };
  }
  async getRow(input: Input<"getRow">) {
    this.visit("getRow", input);
    const hook = this.beforeRead;
    this.beforeRead = undefined;
    await hook?.();
    const row = this.rows.get(this.key(input));
    if (row === undefined)
      throw new AppwriteException(
        "Missing synthetic row",
        404,
        "row_not_found",
      );
    return structuredClone(row);
  }
  createTransaction(input: Input<"createTransaction">) {
    return Promise.resolve().then(() => {
      this.visit("createTransaction", input);
      if (!Number.isInteger(input.ttl) || input.ttl < 60 || input.ttl > 3600)
        throw new AppwriteException("Synthetic invalid transaction TTL", 400);
      const id = `transaction-${++this.next}`;
      this.transactions.set(id, { base: new Map(), rows: new Map() });
      return { $id: id, status: "pending" };
    });
  }
  createRow(input: Input<"createRow">) {
    return Promise.resolve().then(() => {
      this.visit("createRow", input);
      const { tx, key, row } = this.stage(input);
      if (row !== undefined)
        throw new AppwriteException("Synthetic duplicate", 409);
      const created = {
        ...input.data,
        $id: input.rowId,
        $databaseId: input.databaseId,
        $tableId: input.tableId,
        $sequence: "1",
        $createdAt: "2026-09-28T21:00:00.000000+00:00",
        $updatedAt: TIME,
        $permissions: input.permissions,
      };
      tx.rows.set(key, created);
      return structuredClone(created);
    });
  }
  updateRow(input: Input<"updateRow">) {
    return Promise.resolve().then(() => {
      this.visit("updateRow", input);
      const { tx, key, row } = this.stage(input);
      if (row === undefined)
        throw new AppwriteException("Synthetic missing", 404);
      const updated = { ...row, ...input.data };
      tx.rows.set(key, updated);
      return structuredClone(updated);
    });
  }
  async incrementRowColumn(input: Input<"incrementRowColumn">) {
    this.visit("incrementRowColumn", input);
    const hook = this.beforeIncrement;
    this.beforeIncrement = undefined;
    await hook?.();
    const { tx, key, row } = this.stage({ ...input, data: {} });
    if (row === undefined || typeof row.version !== "number")
      throw new Error("Invalid synthetic row");
    if (row.version + input.value > input.max)
      throw new AppwriteException("Synthetic maximum exceeded", 400);
    row.version += input.value;
    tx.rows.set(key, row);
    return structuredClone(row);
  }
  async updateTransaction(input: Input<"updateTransaction">) {
    this.visit("updateTransaction", input);
    const tx = this.transactions.get(input.transactionId);
    if (tx === undefined) throw new Error("Missing transaction");
    if (input.rollback) {
      if (this.rollbackFails) throw new Error("Synthetic rollback failure");
      this.transactions.delete(input.transactionId);
      return { $id: input.transactionId, status: "failed" };
    }
    const hook = this.beforeCommit;
    this.beforeCommit = undefined;
    await hook?.();
    if (this.commitOutcome === "lost-before")
      throw new Error("Synthetic transport lost before commit");
    for (const [key, base] of tx.base) {
      if (JSON.stringify(this.rows.get(key)) !== base)
        throw new AppwriteException("Synthetic write conflict", 409);
    }
    for (const [key, row] of tx.rows) this.rows.set(key, structuredClone(row));
    this.transactions.delete(input.transactionId);
    if (this.commitOutcome === "lost-after")
      throw new Error("Synthetic transport lost after commit");
    return {
      $id: input.transactionId,
      status:
        this.commitOutcome === "malformed-after" ? "committing" : "committed",
    };
  }
  current(userId = "proof-watchlist-20260929-v2"): Row {
    const row = [...this.rows.values()].find(
      (entry) => entry.$tableId === "watchlists" && entry.ownerId === userId,
    );
    if (row === undefined) throw new Error("Missing synthetic current row");
    return row;
  }
  receipts() {
    return [...this.rows.values()].filter((row) => row.$tableId === "receipts");
  }
}

function fixture() {
  const store = new AtomicStore();
  const closed: boolean[] = [];
  const signals: AbortSignal[] = [];
  const factory: ClerkTrialProofFactory = (signal) => {
    signals.push(signal);
    const index = closed.length;
    closed.push(false);
    return {
      newStore: () => store,
      // A model store has zero HTTP dispatches; model operations remain separate.
      snapshot: () => ({ requests: 0, lastStatus: null }),
      close: () => {
        closed[index] = true;
        return Promise.resolve();
      },
    };
  };
  const run = (phase: ClerkTrialProofPhase) =>
    runClerkTrialStorageProof(phase, BUILD, factory);
  return { store, closed, signals, factory, run };
}
async function reach(
  f: ReturnType<typeof fixture>,
  phase: ClerkTrialProofPhase,
) {
  for (const previous of CLERK_TRIAL_PROOF_PHASES.slice(
    0,
    CLERK_TRIAL_PROOF_PHASES.indexOf(phase),
  )) {
    expect((await f.run(previous)).outcome).toBe("passed");
  }
}
afterEach(() => vi.useRealTimers());

describe("bounded Clerk trial storage proof", () => {
  it("models Appwrite's transaction TTL range and uses its shortest allowed lifetime", async () => {
    const f = fixture();
    await expect(f.store.createTransaction({ ttl: 30 })).rejects.toMatchObject({
      code: 400,
    });
    expect(f.store.transactions.size).toBe(0);
    expect((await f.run("create")).outcome).toBe("passed");
    expect(
      f.store.calls.filter((call) => call.operation === "createTransaction"),
    ).toEqual([
      { operation: "createTransaction", input: { ttl: 30 } },
      { operation: "createTransaction", input: { ttl: 60 } },
    ]);
  });

  it("runs seven explicit phases through the unchanged repository using an atomic model", async () => {
    const f = fixture();
    const reports = [];
    for (const phase of CLERK_TRIAL_PROOF_PHASES)
      reports.push(await f.run(phase));
    expect(reports.map((report) => report.outcome)).toEqual(
      Array(7).fill("passed"),
    );
    expect(reports.map((report) => report.observedVersion)).toEqual([
      1, 2, 3, 4, 4, 5, 5,
    ]);
    expect(reports.map((report) => report.operationCount)).toEqual([
      10, 13, 17, 19, 10, 10, 1,
    ]);
    expect(
      reports.every(
        (report) => report.httpDispatches === 0 && report.payloadEqual,
      ),
    ).toBe(true);
    expect(reports[0]).toMatchObject({
      replayed: true,
      receiptEqual: true,
      repositoryError: "idempotency_conflict",
    });
    expect(reports[2]).toMatchObject({
      repositoryError: "conflict",
      upstreamStatus: 400,
      losingReceiptAbsent: true,
    });
    expect(reports[3]).toMatchObject({
      repositoryError: "conflict",
      upstreamStatus: 409,
      receiptEqual: true,
      losingReceiptAbsent: true,
    });
    expect(reports[4]).toMatchObject({
      injectedFailure: "before_receipt",
      rollbackObserved: true,
      losingReceiptAbsent: true,
    });
    expect(reports[5]).toMatchObject({
      injectedFailure: "after_commit_acknowledgment",
      repositoryError: "commit_unknown",
      replayed: true,
      receiptEqual: true,
    });
    expect(f.store.receipts()).toHaveLength(5);
    expect(f.store.current().version).toBe(5);
    expect(f.closed).toEqual(Array(7).fill(true));
    expect(f.signals.every((signal) => signal.aborted)).toBe(true);
    for (const report of reports) {
      expect(report.trace.length).toBeLessThanOrEqual(20);
      expect(report.trace.map((entry) => entry.sequence)).toEqual(
        report.trace.map((_, index) => index + 1),
      );
      for (const entry of report.trace)
        expect(Object.keys(entry).sort()).toEqual([
          "actor",
          "errorType",
          "operation",
          "outcome",
          "sequence",
          "status",
          "transactionStatus",
        ]);
      expect(report.buildProof).toBe(BUILD);
      expect(report.planSha256).toBe(CLERK_TRIAL_PROOF_PLAN_SHA256);
      expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThanOrEqual(
        8192,
      );
      expect(JSON.stringify(report)).not.toMatch(
        /Invented|ownerId|proof-watchlist|transaction-|secret|payloadJson/u,
      );
    }
  });

  it("orders the prestage trace after barriers and distinguishes commit-time limit reconciliation", async () => {
    const f = fixture();
    await reach(f, "prestage");
    const increment = f.store.incrementRowColumn.bind(f.store);
    let increments = 0;
    vi.spyOn(f.store, "incrementRowColumn").mockImplementation((input) =>
      increment(++increments === 2 ? { ...input, max: input.max + 1 } : input),
    );
    const update = f.store.updateTransaction.bind(f.store);
    let commits = 0;
    vi.spyOn(f.store, "updateTransaction").mockImplementation((input) => {
      if (input.commit && ++commits === 2)
        return Promise.reject(
          new AppwriteException(
            "private record",
            400,
            "attribute_limit_exceeded",
          ),
        );
      return update(input);
    });
    const report = await f.run("prestage");
    expect(report).toMatchObject({
      outcome: "passed",
      repositoryError: "conflict",
      observedVersion: 3,
      operationCount: 19,
    });
    const winnerCommit = report.trace.findIndex(
      (entry) => entry.actor === "winner" && entry.operation === "commit",
    );
    const loserIncrement = report.trace.findIndex(
      (entry) => entry.actor === "loser" && entry.operation === "increment",
    );
    expect(loserIncrement).toBeGreaterThan(winnerCommit);
    expect(
      report.trace.find(
        (entry) => entry.actor === "loser" && entry.operation === "commit",
      ),
    ).toMatchObject({
      outcome: "appwrite_error",
      status: 400,
      errorType: "attribute_limit_exceeded",
    });
    expect(
      report.trace
        .filter((entry) => entry.actor === "loser")
        .slice(-2)
        .map((entry) => entry.operation),
    ).toEqual(["read_receipt", "read_current"]);
    expect(report.trace.some((entry) => entry.operation === "rollback")).toBe(
      false,
    );
    expect(JSON.stringify(report)).not.toContain("private record");
  });

  it("retains the actual unexpected loser error and strips unknown upstream type/message", async () => {
    const f = fixture();
    await reach(f, "prestage");
    const increment = f.store.incrementRowColumn.bind(f.store);
    let increments = 0;
    vi.spyOn(f.store, "incrementRowColumn").mockImplementation((input) => {
      if (++increments === 2)
        return Promise.reject(
          new AppwriteException("private record", 503, "private type"),
        );
      return increment(input);
    });
    const report = await f.run("prestage");
    expect(report).toMatchObject({
      outcome: "failed",
      failure: "unexpected_result",
      repositoryError: "unavailable",
      rollbackObserved: true,
    });
    expect(
      report.trace.find(
        (entry) => entry.actor === "loser" && entry.operation === "increment",
      ),
    ).toMatchObject({
      outcome: "appwrite_error",
      status: 503,
      errorType: "other",
    });
    expect(
      report.trace.find((entry) => entry.operation === "rollback"),
    ).toMatchObject({
      outcome: "ok",
      status: null,
      transactionStatus: "failed",
    });
    expect(JSON.stringify(report)).not.toMatch(/private record|private type/u);
  });

  it("reuses the exact postcommit overlap absence within nineteen ordinary calls", async () => {
    const f = fixture();
    await reach(f, "overlap");
    f.store.calls.length = 0;
    f.store.ordinaryRequestLimit = 19;
    const update = f.store.updateTransaction.bind(f.store);
    vi.spyOn(f.store, "updateTransaction").mockImplementation(async (input) => {
      try {
        return await update(input);
      } catch (error) {
        if (
          input.commit &&
          error instanceof AppwriteException &&
          error.code === 409
        )
          throw new AppwriteException(
            "Synthetic commit limit",
            400,
            "attribute_limit_exceeded",
          );
        throw error;
      }
    });
    const report = await f.run("overlap");
    expect(report).toMatchObject({
      outcome: "passed",
      failure: "none",
      repositoryError: "conflict",
      observedVersion: 4,
      payloadEqual: true,
      receiptEqual: true,
      replayed: true,
      losingReceiptAbsent: true,
      operationCount: 19,
      httpDispatches: 0,
    });
    expect(f.store.calls).toHaveLength(19);
    const rejection = report.trace.findIndex(
      (entry) => entry.actor === "loser" && entry.operation === "commit",
    );
    expect(report.trace[rejection]).toMatchObject({
      outcome: "appwrite_error",
      status: 400,
      errorType: "attribute_limit_exceeded",
    });
    expect(report.trace[rejection + 1]).toMatchObject({
      actor: "loser",
      operation: "read_receipt",
      outcome: "appwrite_error",
      status: 404,
      errorType: "row_not_found",
    });
    expect(report.trace.some((entry) => entry.actor === "inspection")).toBe(
      false,
    );
    expect(f.closed.at(-1)).toBe(true);
  });

  it("keeps the explicit overlap absence read for the original commit409 path", async () => {
    const f = fixture();
    await reach(f, "overlap");
    const report = await f.run("overlap");
    expect(report).toMatchObject({
      outcome: "passed",
      upstreamStatus: 409,
      operationCount: 19,
      losingReceiptAbsent: true,
    });
    expect(report.trace.at(-1)).toMatchObject({
      actor: "inspection",
      operation: "read_receipt",
      outcome: "appwrite_error",
      status: 404,
      errorType: "row_not_found",
    });
  });

  it.each(["databaseId", "tableId", "rowId"] as const)(
    "does not reuse postcommit absence for a different %s",
    async (field) => {
      const f = fixture();
      await reach(f, "overlap");
      f.store.calls.length = 0;
      f.store.ordinaryRequestLimit = 19;
      const update = f.store.updateTransaction.bind(f.store);
      let loserCommitRejected = false;
      vi.spyOn(f.store, "updateTransaction").mockImplementation(
        async (input) => {
          try {
            return await update(input);
          } catch (error) {
            if (
              input.commit &&
              error instanceof AppwriteException &&
              error.code === 409
            ) {
              loserCommitRejected = true;
              throw new AppwriteException(
                "Synthetic commit limit",
                400,
                "attribute_limit_exceeded",
              );
            }
            throw error;
          }
        },
      );
      const get = f.store.getRow.bind(f.store);
      let substituted = false;
      vi.spyOn(f.store, "getRow").mockImplementation((input) => {
        if (
          loserCommitRejected &&
          input.tableId === "receipts" &&
          !substituted
        ) {
          // A deliberately substituted store target cannot authorize reuse.
          substituted = true;
          expect(Reflect.set(input, field, "other")).toBe(true);
        }
        return get(input);
      });
      const report = await f.run("overlap");
      expect(substituted).toBe(true);
      expect(report).toMatchObject({
        outcome: "failed",
        losingReceiptAbsent: false,
        operationCount: 20,
        observedVersion: 4,
        receiptEqual: true,
        replayed: true,
      });
      expect(report.trace.at(-1)).toMatchObject({
        actor: "inspection",
        operation: "read_receipt",
        outcome: "appwrite_error",
        status: null,
        errorType: "other",
      });
    },
  );

  it.each([
    { code: 403, type: "row_not_found" },
    { code: 404, type: "document_not_found" },
  ])(
    "does not reuse postcommit receipt error $code/$type",
    async ({ code, type }) => {
      const f = fixture();
      await reach(f, "overlap");
      const update = f.store.updateTransaction.bind(f.store);
      let loserCommitRejected = false;
      vi.spyOn(f.store, "updateTransaction").mockImplementation(
        async (input) => {
          try {
            return await update(input);
          } catch (error) {
            if (
              input.commit &&
              error instanceof AppwriteException &&
              error.code === 409
            ) {
              loserCommitRejected = true;
              throw new AppwriteException(
                "Synthetic commit limit",
                400,
                "attribute_limit_exceeded",
              );
            }
            throw error;
          }
        },
      );
      const get = f.store.getRow.bind(f.store);
      vi.spyOn(f.store, "getRow").mockImplementation((input) =>
        loserCommitRejected && input.tableId === "receipts"
          ? Promise.reject(
              new AppwriteException("Synthetic unreadable receipt", code, type),
            )
          : get(input),
      );
      expect(await f.run("overlap")).toMatchObject({
        outcome: "failed",
        losingReceiptAbsent: false,
        repositoryError: "commit_unknown",
      });
    },
  );

  it("does not reuse the initial precommit overlap receipt absence", async () => {
    const f = fixture();
    await reach(f, "overlap");
    const get = f.store.getRow.bind(f.store);
    let receiptReads = 0;
    vi.spyOn(f.store, "getRow").mockImplementation((input) => {
      if (input.tableId === "receipts" && ++receiptReads === 5)
        return Promise.resolve({ $id: input.rowId });
      return get(input);
    });
    const report = await f.run("overlap");
    expect(receiptReads).toBe(5);
    expect(report).toMatchObject({
      outcome: "failed",
      failure: "unexpected_result",
      losingReceiptAbsent: false,
      observedVersion: 4,
      receiptEqual: true,
      replayed: true,
    });
    expect(report.trace.at(-1)).toMatchObject({
      actor: "inspection",
      operation: "read_receipt",
      outcome: "ok",
    });
  });

  it.each(["rolled_back", "pending", "committed", "wrong_id"])(
    "does not accept a rollback response with %s",
    async (invalid) => {
      const f = fixture();
      await reach(f, "rollback");
      const update = f.store.updateTransaction.bind(f.store);
      vi.spyOn(f.store, "updateTransaction").mockImplementation(
        async (input) => {
          const result = await update(input);
          if (!input.rollback) return result;
          return {
            $id:
              invalid === "wrong_id"
                ? "other-transaction"
                : input.transactionId,
            status: invalid === "wrong_id" ? "failed" : invalid,
          };
        },
      );
      expect(await f.run("rollback")).toMatchObject({
        outcome: "failed",
        failure: "unexpected_result",
        rollbackObserved: false,
      });
    },
  );

  it("does not recreate or advance the create phase after it was consumed", async () => {
    const f = fixture();
    expect((await f.run("create")).outcome).toBe("passed");
    const before = f.store.calls.length;
    expect(await f.run("create")).toMatchObject({
      outcome: "failed",
      failure: "unexpected_result",
      operationCount: 1,
      observedVersion: 1,
    });
    expect(f.store.calls.slice(before).map((call) => call.operation)).toEqual([
      "getRow",
    ]);
    expect(f.store.current().version).toBe(1);
  });

  it.each([
    "stale",
    "prestage",
    "overlap",
    "rollback",
    "unknown",
    "reopen",
  ] as const)(
    "rejects a missing phase prerequisite for %s without mutation",
    async (phase) => {
      const f = fixture();
      expect(await f.run(phase)).toMatchObject({
        outcome: "failed",
        observedVersion: 0,
        operationCount: 1,
      });
      expect(f.store.calls.map((call) => call.operation)).toEqual(["getRow"]);
    },
  );

  it("does not report overlap acceptance when one transaction cannot reach its commit barrier", async () => {
    const f = fixture();
    await reach(f, "overlap");
    const before = f.store.calls.length;
    f.store.fail = {
      operation: "createTransaction",
      error: new AppwriteException("private response", 503),
    };
    expect(await f.run("overlap")).toMatchObject({
      outcome: "incomplete",
      failure: "stage_not_reached",
    });
    expect(f.store.current().version).toBe(3);
    expect(
      f.store.calls
        .slice(before)
        .filter(
          (call) =>
            call.operation === "updateTransaction" &&
            (call.input as Input<"updateTransaction">).commit,
        ),
    ).toHaveLength(0);
    expect(f.closed.at(-1)).toBe(true);
  });

  it("requires an actual rollback acknowledgement instead of inferring it from the injected failure", async () => {
    const f = fixture();
    await reach(f, "rollback");
    f.store.rollbackFails = true;
    expect(await f.run("rollback")).toMatchObject({
      outcome: "failed",
      failure: "unexpected_result",
      rollbackObserved: false,
      injectedFailure: "before_receipt",
    });
    expect(f.store.current().version).toBe(4);
  });

  it("does not label an unacknowledged backend commit as the planned lost-acknowledgement injection", async () => {
    const f = fixture();
    await reach(f, "unknown");
    f.store.commitOutcome = "lost-before";
    expect(await f.run("unknown")).toMatchObject({
      outcome: "failed",
      failure: "unexpected_result",
      injectedFailure: "none",
      repositoryError: "commit_unknown",
    });
    expect(f.store.current().version).toBe(4);
  });

  it("reopens from a new repository without a write or transaction", async () => {
    const f = fixture();
    await reach(f, "reopen");
    const before = f.store.calls.length;
    expect(await f.run("reopen")).toMatchObject({
      outcome: "passed",
      observedVersion: 5,
      operationCount: 1,
    });
    expect(f.store.calls.slice(before).map((call) => call.operation)).toEqual([
      "getRow",
    ]);
  });

  it("bounds an unresponsive store and aborts its operation before cleanup", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.store.beforeRead = () => new Promise<void>(() => undefined);
    const pending = f.run("create");
    await vi.advanceTimersByTimeAsync(12000);
    expect(await pending).toMatchObject({
      outcome: "incomplete",
      failure: "deadline",
      operationCount: 1,
    });
    expect(f.signals[0]!.aborted).toBe(true);
    expect(f.closed).toEqual([true]);
  });

  it("bounds even a hung cleanup and reports it rather than claiming completion", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const pending = runClerkTrialStorageProof("reopen", BUILD, (signal) => ({
      ...f.factory(signal),
      close: () => new Promise<void>(() => undefined),
    }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toMatchObject({
      outcome: "incomplete",
      failure: "cleanup_failed",
    });
    expect(f.signals[0]!.aborted).toBe(true);
  });

  it("keeps total work and even hung cleanup within the twelve-second budget", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.store.beforeRead = () => new Promise<void>(() => undefined);
    const pending = runClerkTrialStorageProof("create", BUILD, (signal) => ({
      ...f.factory(signal),
      close: () => new Promise<void>(() => undefined),
    }));
    await vi.advanceTimersByTimeAsync(12000);
    expect(await pending).toMatchObject({
      outcome: "incomplete",
      failure: "cleanup_failed",
      elapsedMs: 12000,
    });
    expect(f.signals[0]!.aborted).toBe(true);
  });

  it("reports actual transport dispatch counts separately from model operation counts", async () => {
    const f = fixture();
    expect(
      await runClerkTrialStorageProof("create", BUILD, (signal) => ({
        ...f.factory(signal),
        snapshot: () => ({ requests: 9, lastStatus: 200 }),
      })),
    ).toMatchObject({
      outcome: "passed",
      operationCount: 10,
      httpDispatches: 9,
    });
  });

  it("rejects invalid phase/build before constructing a transport", async () => {
    const factory = vi.fn();
    await expect(
      runClerkTrialStorageProof(
        "other" as ClerkTrialProofPhase,
        BUILD,
        factory,
      ),
    ).rejects.toThrow("Invalid proof configuration");
    await expect(
      runClerkTrialStorageProof("create", "missing", factory),
    ).rejects.toThrow("Invalid proof configuration");
    expect(factory).not.toHaveBeenCalled();
  });
});

describe("private storage proof function admission", () => {
  const context = (
    overrides: Partial<ClerkTrialFunctionContext["req"]> = {},
  ) => ({
    req: {
      method: "POST",
      path: "/proof/create",
      queryString: "",
      bodyText: "",
      headers: {},
      ...overrides,
    },
    res: { json: vi.fn(), text: vi.fn(), empty: vi.fn() },
  });
  it.each([
    { method: "GET" },
    { path: "/proof/all" },
    { queryString: "owner=other" },
    { bodyText: "{}" },
  ])(
    "rejects caller targets/data without transport construction: %j",
    async (override) => {
      const ctx = context(override);
      await createClerkTrialStorageProofFunction(BUILD)(ctx);
      expect(ctx.res.json).toHaveBeenCalledWith(
        { error: "invalid_proof_request" },
        400,
        { "cache-control": "no-store" },
      );
    },
  );
  it("requires the platform execution key and never prints it", async () => {
    const ctx = context();
    await createClerkTrialStorageProofFunction(BUILD)(ctx);
    expect(ctx.res.json).toHaveBeenCalledWith(
      { error: "proof_authority_unavailable" },
      503,
      { "cache-control": "no-store" },
    );
  });
});
