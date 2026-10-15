import { afterEach, describe, expect, it, vi } from "vitest";
import { TablesDB } from "node-appwrite";
import { MockAgent } from "undici";
import { StorageProofPhase } from "./appwrite-storage-proof-phase";
import { AtomicStore } from "./test-appwrite-atomic-store";
import { appwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import { createAppwriteTransport } from "./appwrite-transport";

afterEach(() => vi.useRealTimers());
describe("proof phase lifetime and reserves", () => {
  it("allocates no timer for an invalid limit", () => {
    vi.useFakeTimers();
    const before = vi.getTimerCount();
    for (const limit of [0, 1, 21, NaN, 1.5])
      expect(() => new StorageProofPhase(limit, true)).toThrow(
        "Invalid proof limit",
      );
    expect(vi.getTimerCount()).toBe(before);
  });
  it("reserves rollback capacity while a begin response is held", async () => {
    const phase = new StorageProofPhase(2, true),
      base = new AtomicStore();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const begin = base.createTransaction.bind(base);
    base.createTransaction = async (input) => {
      await held;
      return begin(input);
    };
    const store = phase.store(base),
      pending = store.createTransaction({ ttl: 60 });
    await expect(
      store.getRow({ databaseId: "db", tableId: "followups", rowId: "f" }),
    ).rejects.toMatchObject({ reason: "operation_limit" });
    expect(phase.count).toBe(1);
    release();
    const transaction = (await pending) as { $id: string };
    await store.updateTransaction({
      transactionId: transaction.$id,
      rollback: true,
    });
    expect(phase.count).toBe(2);
    expect(phase.rollbackObserved).toBe(true);
    await phase.close({ close: () => Promise.resolve() });
  });
  it("starts transport close even when an actor rejects", async () => {
    const phase = new StorageProofPhase(2, true),
      close = vi.fn(() => Promise.resolve());
    const rejected = Promise.reject(new Error("invented actor"));
    void rejected.catch(() => undefined);
    phase.actors.push(rejected);
    await expect(phase.close({ close })).rejects.toMatchObject({
      reason: "cleanup_failed",
    });
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("starts close despite a nonsettling actor and retains the one-second cleanup ceiling", async () => {
    vi.useFakeTimers();
    const phase = new StorageProofPhase(2, true),
      close = vi.fn(() => Promise.resolve());
    phase.actors.push(new Promise(() => undefined));
    const task = phase.close({ close });
    const asserted = expect(task).rejects.toMatchObject({
      reason: "cleanup_failed",
    });
    await vi.advanceTimersByTimeAsync(1000);
    await asserted;
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("reports close rejection and a remaining-deadline timeout", async () => {
    const phase = new StorageProofPhase(2, true);
    await expect(
      phase.close({ close: () => Promise.reject(new Error("invented close")) }),
    ).rejects.toMatchObject({ reason: "cleanup_failed" });
    vi.useFakeTimers({ toFake: ["performance", "setTimeout", "clearTimeout"] });
    const late = new StorageProofPhase(2, true);
    await vi.advanceTimersByTimeAsync(11900);
    const task = late.close({ close: () => new Promise(() => undefined) });
    const asserted = expect(task).rejects.toMatchObject({
      reason: "cleanup_failed",
    });
    await vi.advanceTimersByTimeAsync(100);
    await asserted;
  });
  it("reserves the local final call for rollback after an injected non-dispatch call", async () => {
    const phase = new StorageProofPhase(4, true),
      base = new AtomicStore(),
      store = phase.store(base, {
        beforeReceipt: () => {
          throw new Error("invented before dispatch");
        },
      });
    const transaction = (await store.createTransaction({ ttl: 60 })) as {
      $id: string;
    };
    await expect(
      store.createRow({
        databaseId: "db",
        tableId: "receipts",
        rowId: "r",
        data: {},
        permissions: [],
        transactionId: transaction.$id,
      }),
    ).rejects.toThrow("invented before dispatch");
    await expect(
      store.getRow({ databaseId: "db", tableId: "followups", rowId: "f" }),
    ).rejects.toBeDefined();
    await expect(
      store.getRow({ databaseId: "db", tableId: "followups", rowId: "f" }),
    ).rejects.toMatchObject({ reason: "operation_limit" });
    expect(phase.count).toBe(3);
    expect(base.calls).toHaveLength(2);
    await store.updateTransaction({
      transactionId: transaction.$id,
      rollback: true,
    });
    expect(phase.count).toBe(4);
    expect(phase.rollbackObserved).toBe(true);
    expect(phase.trace.at(-1)?.operation).toBe("rollback");
    await phase.close({ close: () => Promise.resolve() });
  });
  it("reserves local trace and the twentieth real SDK dispatch for rollback", async () => {
    class Owned extends MockAgent {
      override destroy() {
        return this.close();
      }
    }
    const agent = new Owned();
    agent.disableNetConnect();
    const pool = agent.get("https://proof.example.invalid");
    const headers = { "content-type": "application/json" };
    pool
      .intercept({ path: "/v1/tablesdb/transactions", method: "POST" })
      .reply(201, { $id: "tx", status: "pending" }, { headers });
    pool
      .intercept({
        path: "/v1/tablesdb/db/tables/followups/rows/f",
        method: "GET",
      })
      .reply(200, {}, { headers })
      .times(18);
    pool
      .intercept({ path: "/v1/tablesdb/transactions/tx", method: "PATCH" })
      .reply(200, { $id: "tx", status: "failed" }, { headers });
    const phase = new StorageProofPhase(20, true),
      transport = createAppwriteTransport({
        endpoint: "https://proof.example.invalid/v1",
        dispatcher: agent,
        signal: phase.controller.signal,
      });
    transport.client.setProject("invented").setKey("invented");
    const store = phase.store(
      appwriteVersionedRowStore(new TablesDB(transport.client)),
    );
    try {
      await store.createTransaction({ ttl: 60 });
      for (let i = 0; i < 18; i++)
        await store.getRow({
          databaseId: "db",
          tableId: "followups",
          rowId: "f",
        });
      await expect(
        store.getRow({ databaseId: "db", tableId: "followups", rowId: "f" }),
      ).rejects.toMatchObject({ reason: "operation_limit" });
      expect(phase.count).toBe(19);
      expect(phase.trace).toHaveLength(19);
      expect(transport.snapshot().requests).toBe(19);
      await store.updateTransaction({ transactionId: "tx", rollback: true });
      expect(phase.count).toBe(20);
      expect(phase.trace).toHaveLength(20);
      expect(transport.snapshot().requests).toBe(20);
      expect(phase.rollbackObserved).toBe(true);
    } finally {
      await phase.close(transport);
    }
    expect(transport.snapshot().closed).toBe(true);
    agent.assertNoPendingInterceptors();
  });
  it("does not dispatch rollback after abort and marks cleanup incomplete", async () => {
    const phase = new StorageProofPhase(4, true),
      base = new AtomicStore(),
      store = phase.store(base);
    const transaction = (await store.createTransaction({ ttl: 60 })) as {
      $id: string;
    };
    phase.controller.abort();
    await expect(
      store.updateTransaction({
        transactionId: transaction.$id,
        rollback: true,
      }),
    ).rejects.toMatchObject({ reason: "deadline" });
    await phase.close({ close: () => Promise.resolve() });
    expect(base.calls).toHaveLength(1);
    expect(phase.rollbackIncomplete).toBe(true);
  });
});
