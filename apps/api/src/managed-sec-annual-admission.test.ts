import { AppwriteException } from "node-appwrite";
import { describe, expect, it, vi } from "vitest";

import {
  createManagedSecAnnualAdmission,
  type ManagedSecAnnualAdmissionStore,
} from "./managed-sec-annual-admission";

const ENTRY = "2026-10-01T12:00:00.000Z";
const principal = { userId: "synthetic_sec_principal_01" };
const location = {
  databaseId: "synthetic-db",
  tableId: "synthetic-budget",
  rowId: "shared-v1",
};
function fixture() {
  let clock = Date.parse(ENTRY);
  let row: Record<string, unknown> = {
    $id: location.rowId,
    $databaseId: location.databaseId,
    $tableId: location.tableId,
    $sequence: "1",
    $createdAt: ENTRY,
    $updatedAt: ENTRY,
    $permissions: [],
    ownerId: principal.userId,
    version: 1,
    nextAllowedAt: ENTRY,
  };
  const transactions = new Map<string, { maximum?: number; next?: string }>();
  let count = 0;
  const store: ManagedSecAnnualAdmissionStore = {
    getRow: vi.fn(() => Promise.resolve(structuredClone(row))),
    createTransaction: vi.fn(() => {
      const $id = `tx-${++count}`;
      transactions.set($id, {});
      return Promise.resolve({ $id, status: "pending" });
    }),
    incrementRowColumn: vi.fn<
      ManagedSecAnnualAdmissionStore["incrementRowColumn"]
    >((input) => {
      transactions.get(input.transactionId)!.maximum = input.max;
      return Promise.resolve({});
    }),
    updateRow: vi.fn<ManagedSecAnnualAdmissionStore["updateRow"]>((input) => {
      transactions.get(input.transactionId)!.next = input.data
        .nextAllowedAt as string;
      return Promise.resolve({});
    }),
    updateTransaction: vi.fn<
      ManagedSecAnnualAdmissionStore["updateTransaction"]
    >((input) => {
      const pending = transactions.get(input.transactionId)!;
      if (input.rollback)
        return Promise.resolve({
          $id: input.transactionId,
          status: "rolled_back",
        });
      if (Number(row.version) + 1 > pending.maximum!)
        return Promise.reject(
          new AppwriteException(
            "Synthetic conflict",
            409,
            "transaction_conflict",
          ),
        );
      row = {
        ...row,
        version: Number(row.version) + 1,
        nextAllowedAt: pending.next,
        $updatedAt: new Date(clock).toISOString(),
      };
      return Promise.resolve({ $id: input.transactionId, status: "committed" });
    }),
  };
  const make = () =>
    createManagedSecAnnualAdmission({
      ...location,
      store,
      now: () => new Date(clock),
    });
  return {
    store,
    make,
    clock: (value: number) => {
      clock = value;
    },
    patch: (value: Record<string, unknown>) => {
      Object.assign(row, value);
    },
    row: () => row,
  };
}
const signal = () => new AbortController().signal;

describe("managed SEC shared admission", () => {
  it("uses five typed calls, preserves the version guard, and shares cooldown across instances", async () => {
    const f = fixture();
    await expect(f.make().reserve(principal, ENTRY, signal())).resolves.toEqual(
      { version: 2, nextAllowedAt: "2026-10-01T12:00:20.000Z" },
    );
    expect(f.store.getRow).toHaveBeenCalledWith(location);
    expect(f.store.createTransaction).toHaveBeenCalledWith({ ttl: 60 });
    expect(f.store.incrementRowColumn).toHaveBeenCalledWith({
      ...location,
      transactionId: "tx-1",
      column: "version",
      value: 1,
      max: 2,
    });
    expect(f.store.updateRow).toHaveBeenCalledWith({
      ...location,
      transactionId: "tx-1",
      data: { nextAllowedAt: "2026-10-01T12:00:20.000Z" },
    });
    await expect(
      f.make().reserve(principal, ENTRY, signal()),
    ).rejects.toMatchObject({
      code: "rate_limited",
      nextAllowedAt: "2026-10-01T12:00:20.000Z",
    });
    expect(f.store.createTransaction).toHaveBeenCalledTimes(1);
    f.clock(Date.parse(ENTRY) + 20_000);
    await expect(
      f.make().reserve(principal, "2026-10-01T12:00:20.000Z", signal()),
    ).resolves.toMatchObject({ version: 3 });
  });
  it("grants exactly one of two independently constructed same-version contenders", async () => {
    const f = fixture();
    const results = await Promise.allSettled([
      f.make().reserve(principal, ENTRY, signal()),
      f.make().reserve(principal, ENTRY, signal()),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(f.row().version).toBe(2);
    expect(f.store.getRow).toHaveBeenCalledTimes(2);
  });
  it("does not return a permit after a real commit followed by injected acknowledgment loss", async () => {
    const f = fixture(),
      original = f.store.updateTransaction;
    f.store.updateTransaction = vi.fn<
      ManagedSecAnnualAdmissionStore["updateTransaction"]
    >(async (input) => {
      await original(input);
      throw new Error("Synthetic acknowledgment loss");
    });
    await expect(
      f.make().reserve(principal, ENTRY, signal()),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(f.row().version).toBe(2);
    expect(f.store.updateTransaction).toHaveBeenCalledTimes(1);
    await expect(
      f.make().reserve(principal, ENTRY, signal()),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });
  it.each([
    { ownerId: "another-owner" },
    { version: 0 },
    { version: Number.MAX_SAFE_INTEGER },
    { nextAllowedAt: "invalid" },
    { $permissions: ["read(any)"] },
    { $id: "another-row" },
    { $databaseId: "another-db" },
    { extra: true },
    { $updatedAt: "2026-10-01T12:00:03.000Z" },
    { nextAllowedAt: "2026-10-01T12:01:00.000Z" },
    { nextAllowedAt: "2026-10-01T11:59:57.000Z" },
  ])(
    "denies malformed or inconsistent row metadata before a transaction: %j",
    async (patch) => {
      const f = fixture();
      f.patch(patch);
      await expect(
        f.make().reserve(principal, ENTRY, signal()),
      ).rejects.toMatchObject({ code: "unavailable" });
      expect(f.store.createTransaction).not.toHaveBeenCalled();
    },
  );
  it("missing rows fail closed without creating schema", async () => {
    const f = fixture();
    vi.mocked(f.store.getRow).mockRejectedValue(
      new AppwriteException("Missing", 404, "row_not_found"),
    );
    await expect(
      f.make().reserve(principal, ENTRY, signal()),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(f.store.createTransaction).not.toHaveBeenCalled();
  });
  it("rolls back once after a staged update failure and never dispatches commit", async () => {
    const f = fixture();
    vi.mocked(f.store.updateRow).mockRejectedValue(
      new Error("Synthetic failure"),
    );
    await expect(
      f.make().reserve(principal, ENTRY, signal()),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(f.store.updateTransaction).toHaveBeenCalledExactlyOnceWith({
      transactionId: "tx-1",
      rollback: true,
    });
    expect(f.row().version).toBe(1);
  });
  it("rejects a late commit acknowledgment without rollback, readback or permit recovery", async () => {
    const f = fixture(),
      original = f.store.updateTransaction;
    f.store.updateTransaction = vi.fn<
      ManagedSecAnnualAdmissionStore["updateTransaction"]
    >(async (input) => {
      const answer = await original(input);
      f.clock(Date.parse(ENTRY) + 2_000);
      return answer;
    });
    await expect(
      f.make().reserve(principal, ENTRY, signal()),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(f.store.updateTransaction).toHaveBeenCalledTimes(1);
    expect(f.store.getRow).toHaveBeenCalledTimes(1);
    expect(f.row().version).toBe(2);
  });
  it("rejects an aborted entry and a backward local clock before storage", async () => {
    const f = fixture(),
      c = new AbortController();
    c.abort();
    await expect(
      f.make().reserve(principal, ENTRY, c.signal),
    ).rejects.toMatchObject({ code: "unavailable" });
    f.clock(Date.parse(ENTRY) - 1);
    await expect(
      f.make().reserve(principal, ENTRY, signal()),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(f.store.getRow).not.toHaveBeenCalled();
  });
});
