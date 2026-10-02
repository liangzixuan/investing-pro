import { describe, expect, it, vi } from "vitest";
import {
  createManagedEodAdmission,
  MANAGED_EOD_ADMISSION_LIMITS,
  type ManagedEodAdmissionStore,
} from "./managed-eod-admission";

const ENTRY = "2026-10-02T12:00:00.000Z",
  NOW = Date.parse(ENTRY);
const HOUR = 3_600_000 + 4_000,
  DAY = 86_400_000 + 4_000,
  MONTH = 31 * 86_400_000 + 4_000;
const principal = { userId: "invented-owner" };
const location = {
  databaseId: "invented-db",
  tableId: "invented-budget",
  rowId: "shared",
};
function fixture(times: number[] = []) {
  let clock = NOW;
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
    reservationsJson: JSON.stringify(times),
  };
  const pending = new Map<string, { maximum?: number; json?: string }>();
  let count = 0;
  const store: ManagedEodAdmissionStore = {
    getRow: vi.fn(() => Promise.resolve(structuredClone(row))),
    createTransaction: vi.fn(() => {
      const $id = `tx-${++count}`;
      pending.set($id, {});
      return Promise.resolve({ $id, status: "pending" });
    }),
    incrementRowColumn: vi.fn<ManagedEodAdmissionStore["incrementRowColumn"]>(
      (input) => {
        pending.get(input.transactionId)!.maximum = input.max;
        return Promise.resolve({});
      },
    ),
    updateRow: vi.fn<ManagedEodAdmissionStore["updateRow"]>((input) => {
      pending.get(input.transactionId)!.json = input.data
        .reservationsJson as string;
      return Promise.resolve({});
    }),
    updateTransaction: vi.fn<ManagedEodAdmissionStore["updateTransaction"]>(
      (input) => {
        if (input.rollback)
          return Promise.resolve({
            $id: input.transactionId,
            status: "rolled_back",
          });
        const update = pending.get(input.transactionId)!;
        if (Number(row.version) + 1 > update.maximum!)
          return Promise.reject(new Error("Invented transaction conflict"));
        row = {
          ...row,
          version: Number(row.version) + 1,
          reservationsJson: update.json,
          $updatedAt: new Date(clock).toISOString(),
        };
        return Promise.resolve({
          $id: input.transactionId,
          status: "committed",
        });
      },
    ),
  };
  return {
    store,
    row: () => row,
    patch: (value: Record<string, unknown>) => Object.assign(row, value),
    clock: (value: number) => {
      clock = value;
    },
    make: () =>
      createManagedEodAdmission({
        ...location,
        store,
        now: () => new Date(clock),
      }),
  };
}
const signal = () => new AbortController().signal;
const reserve = (f: ReturnType<typeof fixture>, at = ENTRY) =>
  f.make().reserve(principal, at, signal());

describe("managed EOD fixed shared reservations", () => {
  it("uses five typed CAS calls, counts duplicate timestamps and never refunds", async () => {
    const f = fixture([NOW]);
    expect(await reserve(f)).toEqual({ version: 2, reservedAt: ENTRY });
    expect(await reserve(f)).toEqual({ version: 3, reservedAt: ENTRY });
    expect(JSON.parse(f.row().reservationsJson as string)).toEqual([
      NOW,
      NOW,
      NOW,
    ]);
    expect(f.store.incrementRowColumn).toHaveBeenNthCalledWith(1, {
      ...location,
      transactionId: "tx-1",
      column: "version",
      value: 1,
      max: 2,
    });
    expect(f.store.updateTransaction).toHaveBeenCalledTimes(2);
    expect(MANAGED_EOD_ADMISSION_LIMITS.maxRequests).toBe(6);
    expect(MANAGED_EOD_ADMISSION_LIMITS.reservationChargeBytes * 256).toBe(
      268_435_456,
    );
  });
  it.each([
    { duration: HOUR, limit: 24 },
    { duration: DAY, limit: 128 },
    { duration: MONTH, limit: 256 },
  ])(
    "expires each $limit limit exactly at its guarded boundary",
    async ({ duration, limit }) => {
      const time = NOW - duration + 1;
      const f = fixture(Array<number>(limit).fill(time));
      await expect(reserve(f)).rejects.toMatchObject({
        code: "rate_limited",
        nextAllowedAt: new Date(NOW + 1).toISOString(),
      });
      expect(f.store.createTransaction).not.toHaveBeenCalled();
      f.clock(NOW + 1);
      await expect(
        reserve(f, new Date(NOW + 1).toISOString()),
      ).resolves.toMatchObject({ version: 2 });
    },
  );
  it("uses the last expiring blocker when duplicate monthly/day/hour windows overlap", async () => {
    const times = [
      ...Array<number>(128).fill(NOW - DAY - 1),
      ...Array<number>(104).fill(NOW - HOUR - 1),
      ...Array<number>(24).fill(NOW),
    ];
    const f = fixture(times);
    await expect(reserve(f)).rejects.toMatchObject({
      code: "rate_limited",
      nextAllowedAt: new Date(times[0]! + MONTH).toISOString(),
    });
    expect(f.row().reservationsJson).toBe(JSON.stringify(times));
  });
  it("allows only one contender at 255 entries and denies another at full capacity", async () => {
    const old = NOW - 2 * DAY;
    const f = fixture(Array<number>(255).fill(old));
    const outcomes = await Promise.allSettled([reserve(f), reserve(f)]);
    expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(JSON.parse(f.row().reservationsJson as string)).toEqual([
      ...Array<number>(255).fill(old),
      NOW,
    ]);
    expect(Buffer.byteLength(f.row().reservationsJson as string)).toBe(3585);
    await expect(reserve(f)).rejects.toMatchObject({
      code: "rate_limited",
      nextAllowedAt: new Date(old + MONTH).toISOString(),
    });
    expect(f.row().version).toBe(2);
  });
  it("prunes only expired monthly timestamps and preserves every unexpired one", async () => {
    const f = fixture([NOW - MONTH, NOW - MONTH + 1]);
    await reserve(f);
    expect(JSON.parse(f.row().reservationsJson as string)).toEqual([
      NOW - MONTH + 1,
      NOW,
    ]);
  });
  it.each([
    { patch: { ownerId: "other" } },
    { patch: { $permissions: ["read(any)"] } },
    { patch: { version: Number.MAX_SAFE_INTEGER } },
    { patch: { version: 0 } },
    { patch: { reservationsJson: "[1, 2]" } },
    { patch: { reservationsJson: "[2,1]" } },
    { patch: { reservationsJson: "[null]" } },
    { patch: { reservationsJson: "[0]" } },
    { patch: { reservationsJson: JSON.stringify([NOW + 1]) } },
    { patch: { reservationsJson: "[1.5]" } },
    { patch: { reservationsJson: "[1e3]" } },
    {
      patch: { reservationsJson: JSON.stringify(Array<number>(257).fill(NOW)) },
    },
    { patch: { reservationsJson: " ".repeat(8193) } },
    { patch: { extra: true } },
    { patch: { $updatedAt: new Date(NOW + 2001).toISOString() } },
    { patch: { $createdAt: new Date(NOW + 1).toISOString() } },
  ])("fails closed on malformed/foreign quota row %#", async ({ patch }) => {
    const f = fixture();
    f.patch(patch);
    await expect(reserve(f)).rejects.toMatchObject({ code: "unavailable" });
    expect(f.store.createTransaction).not.toHaveBeenCalled();
  });
  it("does not recover a permit or roll back after commit acknowledgment loss", async () => {
    const f = fixture(),
      original = f.store.updateTransaction;
    f.store.updateTransaction = vi.fn<
      ManagedEodAdmissionStore["updateTransaction"]
    >(async (input) => {
      await original(input);
      throw new Error("Invented lost ack");
    });
    await expect(reserve(f)).rejects.toMatchObject({ code: "unavailable" });
    expect(f.row().version).toBe(2);
    expect(f.store.getRow).toHaveBeenCalledTimes(1);
    expect(f.store.updateTransaction).toHaveBeenCalledTimes(1);
  });
  it("refuses a late committed result without refund or retry", async () => {
    const f = fixture(),
      original = f.store.updateTransaction;
    f.store.updateTransaction = vi.fn<
      ManagedEodAdmissionStore["updateTransaction"]
    >(async (input) => {
      const value = await original(input);
      f.clock(NOW + 2000);
      return value;
    });
    await expect(reserve(f)).rejects.toMatchObject({ code: "unavailable" });
    expect(f.row().version).toBe(2);
    expect(f.store.updateTransaction).toHaveBeenCalledTimes(1);
  });
  it("uses the remaining rollback slot on a precommit failure", async () => {
    const f = fixture();
    f.store.updateRow = vi.fn(() =>
      Promise.reject(new Error("Invented failed update")),
    );
    await expect(reserve(f)).rejects.toMatchObject({ code: "unavailable" });
    expect(f.store.updateTransaction).toHaveBeenCalledExactlyOnceWith({
      transactionId: "tx-1",
      rollback: true,
    });
    expect(f.row().version).toBe(1);
  });
  it("denies before storage for expired, retired or backwards clocks", async () => {
    const f = fixture();
    f.clock(NOW + 2000);
    await expect(reserve(f)).rejects.toMatchObject({ code: "unavailable" });
    f.clock(NOW - 1);
    await expect(reserve(f)).rejects.toMatchObject({ code: "unavailable" });
    f.clock(NOW);
    await expect(
      f.make().reserve(principal, ENTRY, AbortSignal.abort()),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(f.store.getRow).not.toHaveBeenCalled();
  });
});
