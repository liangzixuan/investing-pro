import { afterEach, describe, expect, it, vi } from "vitest";
import { AppwriteException, TablesDB } from "node-appwrite";
import { MockAgent } from "undici";
import { createAppwriteTransport } from "./appwrite-transport";
import { appwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import { AtomicStore } from "./test-appwrite-atomic-store";
import {
  WATCHLIST_RESTORE_PROOF_LIMITS,
  WATCHLIST_RESTORE_PROOF_ROWS,
  WATCHLIST_RESTORE_PROOF_TARGET,
  watchlistRestoreProofLocation,
  type WatchlistRestoreProofPhase,
} from "./watchlist-restore-proof-data";
import {
  runWatchlistRestoreProof,
  type WatchlistRestoreProofFactory,
  type WatchlistRestoreProofReport,
} from "./watchlist-storage-restore-proof";

const BUILD = "a".repeat(64);
class ProofMockAgent extends MockAgent {
  override destroy(): Promise<void> {
    return this.close();
  }
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function operation(
  store: AtomicStore,
  targetExists = () =>
    [...store.rows.values()].some(
      (row) =>
        row.$databaseId === WATCHLIST_RESTORE_PROOF_TARGET.restoredDatabaseId,
    ),
) {
  let opens = 0,
    closes = 0;
  const factory: WatchlistRestoreProofFactory = () => {
    opens++;
    const start = store.calls.length;
    let closed = false;
    return {
      newStore: () => ({
        getRow: (input) => {
          if (
            input.databaseId ===
              WATCHLIST_RESTORE_PROOF_TARGET.restoredDatabaseId &&
            !targetExists()
          ) {
            store.calls.push({
              operation: "getRow",
              input: structuredClone(input),
            });
            return Promise.reject(
              new AppwriteException(
                "Invented missing restore database",
                404,
                "database_not_found",
              ),
            );
          }
          return store.getRow(input);
        },
        createTransaction: (input) => store.createTransaction(input),
        createRow: (input) => store.createRow(input),
        updateRow: (input) => store.updateRow(input),
        incrementRowColumn: (input) => store.incrementRowColumn(input),
        updateTransaction: (input) => store.updateTransaction(input),
      }),
      snapshot: () => ({
        requests: store.calls.length - start,
        lastStatus: null,
        closed,
      }),
      close: () => {
        closes++;
        closed = true;
        return Promise.resolve();
      },
    };
  };
  return { factory, counts: () => ({ opens, closes }) };
}
const key = (side: "source" | "restored", version?: 1 | 2 | 3) => {
  const loc = watchlistRestoreProofLocation(side, version);
  return JSON.stringify([loc.databaseId, loc.tableId, loc.rowId]);
};
function exactSource(store: AtomicStore) {
  return JSON.stringify(
    [...store.rows].filter(
      ([, row]) =>
        row.$databaseId === WATCHLIST_RESTORE_PROOF_TARGET.sourceDatabaseId,
    ),
  );
}
/** A row-copy model exercises the checker. It is not an Appwrite native restore. */
function modelRestoredRows(store: AtomicStore) {
  for (const version of [undefined, 1, 2] as const) {
    const row = structuredClone(store.rows.get(key("source", version))!);
    row.$databaseId = WATCHLIST_RESTORE_PROOF_TARGET.restoredDatabaseId;
    store.rows.set(key("restored", version), row);
  }
}
async function fixture() {
  const store = new AtomicStore(),
    op = operation(store);
  const result = await runWatchlistRestoreProof("seed", BUILD, op.factory);
  expect(result, JSON.stringify(result)).toMatchObject({
    outcome: "passed",
    operationCount: 19,
  });
  return { store, op, seeded: result };
}

function assertCompletePhaseReports(
  reports: readonly WatchlistRestoreProofReport[],
) {
  for (const [index, result] of reports.entries()) {
    expect(result, JSON.stringify(result)).toMatchObject({
      outcome: "passed",
      failure: "none",
      cleanupIncomplete: false,
      closed: true,
    });
    expect(result.operationCount).toBe([8, 19, 18, 6][index]);
    expect(result.httpDispatches).toBe(result.operationCount);
    expect(result.operationCount).toBeLessThanOrEqual(
      WATCHLIST_RESTORE_PROOF_LIMITS[result.phase],
    );
    expect(result.trace.length).toBeLessThanOrEqual(20);
    expect(result.httpDispatches).toBeLessThanOrEqual(19);
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(8192);
    expect(JSON.stringify(result)).not.toMatch(
      /café|quoted|payloadJson|ownerId/u,
    );
  }
}
function assertAllowedRowTraffic(calls: AtomicStore["calls"]) {
  for (const call of calls) {
    if (
      call.operation === "createTransaction" ||
      call.operation === "updateTransaction"
    )
      continue;
    const input = call.input as {
      databaseId: string;
      tableId: string;
      rowId: string;
    };
    expect(
      WATCHLIST_RESTORE_PROOF_ROWS.some(
        (row) =>
          row.databaseId === input.databaseId &&
          row.tableId === input.tableId &&
          row.rowId === input.rowId,
      ),
    ).toBe(true);
  }
}
describe("fixed native-restore application qualification", () => {
  it.each([
    {
      firstSourceError: "row_not_found",
      targetError: "database_not_found",
      optIn: true,
      expected: "passed",
      count: 8,
    },
    {
      firstSourceError: "database_not_found",
      targetError: "database_not_found",
      optIn: true,
      expected: "failed",
      count: 1,
    },
    {
      firstSourceError: "table_not_found",
      targetError: "database_not_found",
      optIn: true,
      expected: "failed",
      count: 1,
    },
    {
      firstSourceError: "row_not_found",
      targetError: "row_not_found",
      optIn: true,
      expected: "failed",
      count: 5,
    },
    {
      firstSourceError: "row_not_found",
      targetError: "database_not_found",
      optIn: false,
      expected: "failed",
      count: 5,
    },
  ])(
    "checks preflight through the real SDK and bounded transport: %j",
    async (scenario) => {
      const agent = new ProofMockAgent();
      agent.disableNetConnect();
      const pool = agent.get(
        new URL(WATCHLIST_RESTORE_PROOF_TARGET.endpoint).origin,
      );
      for (const [index, row] of WATCHLIST_RESTORE_PROOF_ROWS.entries()) {
        pool
          .intercept({
            path: `/v1/tablesdb/${row.databaseId}/tables/${row.tableId}/rows/${row.rowId}`,
            method: "GET",
          })
          .reply(
            404,
            JSON.stringify({
              message: "private response content",
              type:
                row.side === "restored"
                  ? scenario.targetError
                  : index === 0
                    ? scenario.firstSourceError
                    : "row_not_found",
            }),
            { headers: { "content-type": "application/json" } },
          );
      }
      const result = await runWatchlistRestoreProof(
        "preflight",
        BUILD,
        (signal) => {
          const transport = createAppwriteTransport({
            endpoint: WATCHLIST_RESTORE_PROOF_TARGET.endpoint,
            signal,
            dispatcher: agent,
            ...(scenario.optIn
              ? {
                  expectedAbsentDatabaseId:
                    WATCHLIST_RESTORE_PROOF_TARGET.restoredDatabaseId,
                }
              : {}),
          });
          transport.client
            .setProject("invented-project")
            .setKey("invented-key");
          return {
            newStore: () =>
              appwriteVersionedRowStore(new TablesDB(transport.client)),
            snapshot: transport.snapshot,
            close: () => transport.close(),
          };
        },
      );
      expect(result).toMatchObject({
        outcome: scenario.expected,
        operationCount: scenario.count,
        httpDispatches: scenario.count,
        closed: true,
      });
      expect(JSON.stringify(result)).not.toMatch(
        /private response|invented-key/u,
      );
      if (scenario.expected === "passed") agent.assertNoPendingInterceptors();
    },
  );
  it("requires an absent restore database and refuses missing source schema", async () => {
    const store = new AtomicStore();
    const occupiedTarget = operation(store, () => true);
    expect(
      await runWatchlistRestoreProof(
        "preflight",
        BUILD,
        occupiedTarget.factory,
      ),
    ).toMatchObject({ outcome: "failed", operationCount: 5 });
    expect(store.calls.every((call) => call.operation === "getRow")).toBe(true);
    for (const errorType of ["database_not_found", "table_not_found"]) {
      const missingSource = new AtomicStore();
      missingSource.fail = {
        operation: "getRow",
        error: new AppwriteException(
          "Invented missing source schema",
          404,
          errorType,
        ),
      };
      expect(
        await runWatchlistRestoreProof(
          "preflight",
          BUILD,
          operation(missingSource).factory,
        ),
      ).toMatchObject({ outcome: "failed", operationCount: 1 });
    }
  });
  it("refuses an existing first receipt without a partial seed or second commit", async () => {
    const existing = await fixture();
    const store = new AtomicStore();
    store.rows.set(
      key("source", 1),
      structuredClone(existing.store.rows.get(key("source", 1))!),
    );
    const original = JSON.stringify([...store.rows]);
    const result = await runWatchlistRestoreProof(
      "seed",
      BUILD,
      operation(store).factory,
    );
    expect(result).toMatchObject({
      outcome: "failed",
      failure: "unexpected_result",
      operationCount: 4,
      closed: true,
    });
    expect(store.calls.every((call) => call.operation === "getRow")).toBe(true);
    expect(JSON.stringify([...store.rows])).toBe(original);
  });
  it("checks both database lifetimes, original receipt replay and one target-only next Save in51calls", async () => {
    const store = new AtomicStore(),
      op = operation(store);
    const preflight = await runWatchlistRestoreProof(
      "preflight",
      BUILD,
      op.factory,
    );
    const seed = await runWatchlistRestoreProof("seed", BUILD, op.factory);
    const original = exactSource(store);
    modelRestoredRows(store);
    const beforeRestore = store.calls.length;
    const restored = await runWatchlistRestoreProof(
      "verify-restored",
      BUILD,
      op.factory,
    );
    const restoredCalls = store.calls.slice(beforeRestore);
    const beforeSource = store.calls.length;
    const source = await runWatchlistRestoreProof(
      "verify-source",
      BUILD,
      op.factory,
    );
    expect(exactSource(store)).toBe(original);
    expect(source.rowFingerprints).toEqual(seed.rowFingerprints);
    expect(store.rows.size).toBe(7);
    expect(store.rows.get(key("restored"))!.version).toBe(3);
    expect(store.rows.has(key("source", 3))).toBe(false);
    expect(
      store.calls
        .slice(beforeSource)
        .every((call) => call.operation === "getRow"),
    ).toBe(true);
    expect(
      restoredCalls.filter(
        (call) =>
          call.operation === "updateTransaction" &&
          (call.input as { commit?: boolean }).commit,
      ),
    ).toHaveLength(1);
    assertCompletePhaseReports([preflight, seed, restored, source]);
    expect(op.counts()).toEqual({ opens: 4, closes: 4 });
    assertAllowedRowTraffic(store.calls);
  });
  it("refuses a second seed or target-check replay without another mutation", async () => {
    const { store, op } = await fixture();
    const start = store.calls.length;
    expect(
      (await runWatchlistRestoreProof("seed", BUILD, op.factory)).outcome,
    ).toBe("failed");
    expect(
      store.calls.slice(start).every((call) => call.operation === "getRow"),
    ).toBe(true);
    modelRestoredRows(store);
    expect(
      (await runWatchlistRestoreProof("verify-restored", BUILD, op.factory))
        .outcome,
    ).toBe("passed");
    const committed = JSON.stringify([...store.rows]);
    const again = store.calls.length;
    expect(
      (await runWatchlistRestoreProof("verify-restored", BUILD, op.factory))
        .outcome,
    ).toBe("failed");
    expect(
      store.calls.slice(again).every((call) => call.operation === "getRow"),
    ).toBe(true);
    expect(JSON.stringify([...store.rows])).toBe(committed);
  });
  it.each([undefined, 1, 2] as const)(
    "refuses missing restored row %s before a transaction",
    async (version) => {
      const { store, op } = await fixture();
      modelRestoredRows(store);
      store.rows.delete(key("restored", version));
      const before = store.calls.length;
      expect(
        (await runWatchlistRestoreProof("verify-restored", BUILD, op.factory))
          .outcome,
      ).toBe("failed");
      expect(
        store.calls.slice(before).every((call) => call.operation === "getRow"),
      ).toBe(true);
    },
  );
  it.each([
    [undefined, "payloadJson", "corrupt"],
    [undefined, "digestSha256", "0".repeat(64)],
    [undefined, "version", 1],
    [undefined, "createdAt", "2026-10-18T00:00:02.000Z"],
    [undefined, "$permissions", ['read("any")']],
    [undefined, "$databaseId", "another-database"],
    [1, "keyDigest", "0".repeat(64)],
    [1, "requestDigest", "0".repeat(64)],
    [1, "committedAt", "2026-10-18T00:00:02.000Z"],
    [2, "version", 1],
    [2, "ownerId", "another-owner"],
    [2, "$id", "another-row"],
  ] as const)(
    "refuses corrupt restored %s/%s before mutation",
    async (version, field, value) => {
      const { store, op } = await fixture();
      modelRestoredRows(store);
      store.rows.get(key("restored", version))![field] = structuredClone(value);
      const before = store.calls.length;
      const result = await runWatchlistRestoreProof(
        "verify-restored",
        BUILD,
        op.factory,
      );
      expect(result.outcome).toBe("failed");
      expect(
        store.calls.slice(before).every((call) => call.operation === "getRow"),
      ).toBe(true);
    },
  );
  it("refuses a falsely missing row, a target-only receipt on source, and source drift", async () => {
    const { store, op } = await fixture();
    modelRestoredRows(store);
    store.fail = {
      operation: "getRow",
      error: new AppwriteException(
        "private nonexistent database",
        404,
        "database_not_found",
      ),
    };
    expect(
      (await runWatchlistRestoreProof("preflight", BUILD, op.factory)).outcome,
    ).toBe("failed");
    expect(
      (await runWatchlistRestoreProof("verify-restored", BUILD, op.factory))
        .outcome,
    ).toBe("passed");
    const receipt = structuredClone(store.rows.get(key("restored", 3))!);
    receipt.$databaseId = WATCHLIST_RESTORE_PROOF_TARGET.sourceDatabaseId;
    store.rows.set(key("source", 3), receipt);
    expect(
      (await runWatchlistRestoreProof("verify-source", BUILD, op.factory))
        .outcome,
    ).toBe("failed");
    store.rows.delete(key("source", 3));
    store.rows.get(key("source"))!.payloadJson = "changed";
    const start = store.calls.length;
    expect(
      (await runWatchlistRestoreProof("verify-source", BUILD, op.factory))
        .outcome,
    ).toBe("failed");
    expect(
      store.calls.slice(start).every((call) => call.operation === "getRow"),
    ).toBe(true);
  });
  it("retains acknowledged rollback and source state when target receipt staging fails", async () => {
    const { store, op } = await fixture();
    modelRestoredRows(store);
    const original = JSON.stringify([...store.rows]);
    store.fail = {
      operation: "createRow",
      error: new Error("private staging failure"),
    };
    const report = await runWatchlistRestoreProof(
      "verify-restored",
      BUILD,
      op.factory,
    );
    expect(report).toMatchObject({
      outcome: "failed",
      cleanupIncomplete: false,
      closed: true,
    });
    expect(report.trace).toContainEqual(
      expect.objectContaining({
        operation: "rollback",
        transactionStatus: "failed",
      }),
    );
    expect(JSON.stringify([...store.rows])).toBe(original);
    expect(JSON.stringify(report)).not.toContain("private staging failure");
  });
  it("does not retry or roll back an uncertain target commit", async () => {
    const { store, op } = await fixture();
    modelRestoredRows(store);
    const source = exactSource(store);
    store.commitOutcome = "lost-after";
    const start = store.calls.length;
    const result = await runWatchlistRestoreProof(
      "verify-restored",
      BUILD,
      op.factory,
    );
    expect(result).toMatchObject({
      outcome: "failed",
      repositoryError: "commit_unknown",
      closed: true,
    });
    expect(store.rows.get(key("restored"))!.version).toBe(3);
    expect(exactSource(store)).toBe(source);
    expect(
      store.calls
        .slice(start)
        .filter((call) => call.operation === "updateTransaction"),
    ).toHaveLength(1);
  });
  it("does not conceal an unacknowledged rollback", async () => {
    const { store, op } = await fixture();
    modelRestoredRows(store);
    const original = JSON.stringify([...store.rows]);
    store.fail = {
      operation: "createRow",
      error: new Error("Invented staging failure"),
    };
    store.rollbackFails = true;
    expect(
      await runWatchlistRestoreProof("verify-restored", BUILD, op.factory),
    ).toMatchObject({
      outcome: "incomplete",
      failure: "cleanup_failed",
      cleanupIncomplete: true,
    });
    expect(JSON.stringify([...store.rows])).toBe(original);
  });
  it("fences a late read after deadline without allowing a Save", async () => {
    vi.useFakeTimers();
    const store = new AtomicStore(),
      op = operation(store);
    let release!: () => void;
    store.beforeRead = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const task = runWatchlistRestoreProof("seed", BUILD, op.factory);
    await vi.advanceTimersByTimeAsync(11000);
    const report = await task;
    expect(report).toMatchObject({
      outcome: "incomplete",
      failure: "deadline",
      closed: true,
      operationCount: 1,
    });
    const retained = JSON.stringify(report);
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.rows.size).toBe(0);
    expect(store.calls).toHaveLength(1);
    expect(JSON.stringify(report)).toBe(retained);
    expect(op.counts()).toEqual({ opens: 1, closes: 1 });
  });
  it.each(["close", "counter", "closed"])(
    "does not accept %s cleanup evidence",
    async (kind) => {
      const store = new AtomicStore(),
        op = operation(store);
      const factory: WatchlistRestoreProofFactory = (signal) => {
        const base = op.factory(signal);
        return {
          ...base,
          close:
            kind === "close"
              ? () => Promise.reject(new Error("private close"))
              : () => base.close(),
          snapshot: () => ({
            ...base.snapshot(),
            ...(kind === "counter" ? { requests: 0 } : {}),
            ...(kind === "closed" ? { closed: false } : {}),
          }),
        };
      };
      const report = await runWatchlistRestoreProof(
        "preflight",
        BUILD,
        factory,
      );
      expect(report).toMatchObject({
        outcome: "incomplete",
        failure: "cleanup_failed",
        cleanupIncomplete: true,
      });
      expect(JSON.stringify(report)).not.toContain("private close");
    },
  );
  it("refuses invalid phase/build configuration before transport allocation", async () => {
    const factory = vi.fn();
    await expect(
      runWatchlistRestoreProof(
        "other" as WatchlistRestoreProofPhase,
        BUILD,
        factory,
      ),
    ).rejects.toThrow();
    await expect(
      runWatchlistRestoreProof("preflight", "bad", factory),
    ).rejects.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });
});
