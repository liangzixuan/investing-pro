import { AppwriteException } from "node-appwrite";
import type { AppwriteVersionedRowStore } from "./appwrite-versioned-row-store";
const TIME = "2026-09-28T21:00:00.000Z";
type Row = Record<string, unknown>;
type Operation = keyof AppwriteVersionedRowStore;
export type Input<K extends Operation> = Parameters<
  AppwriteVersionedRowStore[K]
>[0];
interface Transaction {
  base: Map<string, string | undefined>;
  rows: Map<string, Row>;
}

/** Atomic model: first staged write captures row state; commit verifies all bases. */
export class AtomicStore implements AppwriteVersionedRowStore {
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
  private next = 0;

  private visit(operation: Operation, input: unknown) {
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
  current(userId = "synthetic-owner", tableId = "watchlists"): Row {
    const row = [...this.rows.values()].find(
      (entry) => entry.$tableId === tableId && entry.ownerId === userId,
    );
    if (row === undefined) throw new Error("Missing synthetic current row");
    return row;
  }
  receipts() {
    return [...this.rows.values()].filter((row) => row.$tableId === "receipts");
  }
}
