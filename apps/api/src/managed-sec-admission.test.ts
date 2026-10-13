import { AppwriteException } from "node-appwrite";
import { PERSONAL_SEC_ANNUAL_EVIDENCE_SCHEMA_VERSION } from "@research-cockpit/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  createManagedSecAdmission,
  type ManagedSecAdmissionStore,
} from "./managed-sec-admission";
import { createManagedSecAnnualService } from "./managed-sec-annual-service";
import { createManagedSecFilingsService } from "./managed-sec-filings-service";
import {
  createManagedCatalogService,
  getManagedWorkspaceCatalog,
} from "./managed-workspace-catalog";

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
  const store: ManagedSecAdmissionStore = {
    getRow: vi.fn(() => Promise.resolve(structuredClone(row))),
    createTransaction: vi.fn(() => {
      const $id = `tx-${++count}`;
      transactions.set($id, {});
      return Promise.resolve({ $id, status: "pending" });
    }),
    incrementRowColumn: vi.fn<ManagedSecAdmissionStore["incrementRowColumn"]>(
      (input) => {
        transactions.get(input.transactionId)!.maximum = input.max;
        return Promise.resolve({});
      },
    ),
    updateRow: vi.fn<ManagedSecAdmissionStore["updateRow"]>((input) => {
      transactions.get(input.transactionId)!.next = input.data
        .nextAllowedAt as string;
      return Promise.resolve({});
    }),
    updateTransaction: vi.fn<ManagedSecAdmissionStore["updateTransaction"]>(
      (input) => {
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
        return Promise.resolve({
          $id: input.transactionId,
          status: "committed",
        });
      },
    ),
  };
  const make = () =>
    createManagedSecAdmission({
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

function serviceContenders(f: ReturnType<typeof fixture>) {
  const listing = createManagedCatalogService().search("AAPL")!.results[0]!;
  const request = {
    schemaVersion: "1.0.0" as const,
    catalogSnapshotSha256: getManagedWorkspaceCatalog().snapshotSha256,
    listingId: listing.listingId,
    symbol: listing.symbol,
  };
  const source = (url: string | URL | Request) =>
    (typeof url === "string"
      ? url
      : url instanceof URL
        ? url.href
        : url.url
    ).includes("companyfacts")
      ? { cik: 320193, facts: {} }
      : {
          cik: 320193,
          filings: {
            recent: {
              accessionNumber: [],
              form: [],
              filingDate: [],
              reportDate: [],
              acceptanceDateTime: [],
            },
            files: [],
          },
        };
  const annualFetch = vi.fn<typeof fetch>((input) =>
    Promise.resolve(Response.json(source(input))),
  );
  const filingsFetch = vi.fn<typeof fetch>((input) =>
    Promise.resolve(Response.json(source(input))),
  );
  const options = {
    configuration: {
      userAgent: "Shared admission fixture fixture@example.test",
    },
    catalog: getManagedWorkspaceCatalog(),
    enteredAt: ENTRY,
    startedAt: 0,
    monotonic: () => 0,
    now: () => new Date(ENTRY),
    openAdmission: () => ({
      admission: f.make(),
      close: () => Promise.resolve(),
    }),
    scheduler: { wait: () => Promise.resolve() },
  };
  return {
    annualFetch,
    filingsFetch,
    annual: () =>
      createManagedSecAnnualService({ ...options, fetch: annualFetch }).load(
        {
          ...request,
          schemaVersion: PERSONAL_SEC_ANNUAL_EVIDENCE_SCHEMA_VERSION,
        },
        principal,
        signal(),
      ),
    filings: () =>
      createManagedSecFilingsService({ ...options, fetch: filingsFetch }).load(
        request,
        principal,
        signal(),
      ),
  };
}

describe("managed SEC shared admission", () => {
  it.each(["annual", "filings"] as const)(
    "admits one actual Annual/Filings contender when %s starts first",
    async (first) => {
      const f = fixture(),
        services = serviceContenders(f);
      const order =
        first === "annual"
          ? [services.annual, services.filings]
          : [services.filings, services.annual];
      const results = await Promise.allSettled(order.map((start) => start()));
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect(f.row()).toMatchObject({
        version: 2,
        nextAllowedAt: "2026-10-01T12:00:20.000Z",
      });
      expect([
        services.annualFetch.mock.calls.length,
        services.filingsFetch.mock.calls.length,
      ]).toEqual(first === "annual" ? [2, 0] : [0, 1]);
      expect(f.store.getRow).toHaveBeenCalledTimes(2);
    },
  );
  it.each(["missing", "uncertain_commit"] as const)(
    "both actual services make zero SEC reads after %s admission",
    async (failure) => {
      const f = fixture();
      if (failure === "missing")
        vi.mocked(f.store.getRow).mockRejectedValue(
          new AppwriteException("Missing", 404),
        );
      else {
        const commit = f.store.updateTransaction;
        f.store.updateTransaction = async (input) => {
          await commit(input);
          throw new Error("Lost commit acknowledgment");
        };
      }
      const services = serviceContenders(f);
      const results = await Promise.allSettled([
        services.annual(),
        services.filings(),
      ]);
      expect(results.every((result) => result.status === "rejected")).toBe(
        true,
      );
      expect(services.annualFetch).not.toHaveBeenCalled();
      expect(services.filingsFetch).not.toHaveBeenCalled();
      expect(f.store.getRow).toHaveBeenCalledTimes(2);
    },
  );
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
      ManagedSecAdmissionStore["updateTransaction"]
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
      ManagedSecAdmissionStore["updateTransaction"]
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
