import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppwriteException } from "node-appwrite";
import { AtomicStore, type Input } from "./test-appwrite-atomic-store";
import {
  runValuationAssumptionsStorageProof,
  type ValuationProofFactory,
  type ValuationProofReport,
} from "./valuation-assumptions-storage-proof";
import {
  VALUATION_PROOF_PHASES,
  VALUATION_PROOF_ROWS,
  VALUATION_PROOF_LIMITS,
  valuationProofData,
  valuationProofLocation,
  type ValuationProofPhase,
} from "./valuation-assumptions-proof-data";
import {
  VALUATION_PROOF_SCHEMA,
  VALUATION_PROOF_TARGET,
} from "./valuation-assumptions-proof-schema";
import { ValuationProofContext } from "./valuation-assumptions-storage-proof-context";
import { ProofFailure } from "./appwrite-storage-proof-phase";
import { valuationProofRow } from "./valuation-assumptions-storage-proof-evidence";

const BUILD = "b".repeat(64);
const TIME = "2027-03-12T04:05:06.789Z";
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(TIME));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function metadata() {
  return {
    database: {
      $id: VALUATION_PROOF_TARGET.databaseId,
      name: VALUATION_PROOF_SCHEMA.database.name,
      enabled: true,
      type: "tablesdb",
      $createdAt: TIME,
      $updatedAt: TIME,
    },
    tableList: {
      total: 2,
      tables: VALUATION_PROOF_SCHEMA.tables.map((table) => ({
        $id: table.id,
        name: table.name,
        databaseId: VALUATION_PROOF_TARGET.databaseId,
        enabled: true,
        rowSecurity: true,
        $permissions: [],
        indexes: [],
        bytesMax: 0,
        bytesUsed: 0,
        $createdAt: TIME,
        $updatedAt: TIME,
        columns: table.columns.map((column) => ({
          ...column,
          required: true,
          status: "available",
          error: "",
          $createdAt: TIME,
          $updatedAt: TIME,
        })),
      })),
    },
  };
}
function operation(store: AtomicStore) {
  let opens = 0,
    closes = 0,
    metadataCalls = 0;
  const factory: ValuationProofFactory = () => {
    opens++;
    const start = store.calls.length;
    let closed = false,
      metadataRequests = 0;
    return {
      newStore: () => {
        if (closed) throw Error("Synthetic closed");
        return store;
      },
      metadata: () => {
        metadataCalls++;
        metadataRequests += 2;
        return Promise.resolve(metadata());
      },
      snapshot: () => ({
        requests: store.calls.length - start + metadataRequests,
        lastStatus: null,
        closed,
      }),
      close: () => {
        closed = true;
        closes++;
        return Promise.resolve();
      },
    };
  };
  return { factory, counts: () => ({ opens, closes, metadataCalls }) };
}
async function seeded(before: ValuationProofPhase) {
  const store = new AtomicStore(),
    op = operation(store);
  for (const phase of VALUATION_PROOF_PHASES.slice(
    1,
    VALUATION_PROOF_PHASES.indexOf(before),
  )) {
    phaseClock(phase);
    const report = await runValuationAssumptionsStorageProof(
      phase,
      BUILD,
      op.factory,
    );
    expect(report, JSON.stringify(report)).toMatchObject({
      outcome: "passed",
      closed: true,
    });
  }
  return { store, op };
}
const key = (input: { databaseId: string; tableId: string; rowId: string }) =>
  JSON.stringify([input.databaseId, input.tableId, input.rowId]);
function phaseClock(phase: ValuationProofPhase) {
  vi.setSystemTime(
    new Date(Date.parse(TIME) + VALUATION_PROOF_PHASES.indexOf(phase) * 1000),
  );
}
const NORMAL_COUNTS = [
  ["schema", 0, 2],
  ["preflight", 18, 18],
  ["create-isolation", 18, 18],
  ["stale", 14, 14],
  ["prestage", 17, 17],
  ["overlap", 18, 18],
  ["rollback", 10, 9],
  ["unknown", 9, 9],
  ["capacity", 8, 8],
  ["domain-guards", 15, 15],
  ["historical-edit-and-catalog-review", 18, 18],
  ["reopen", 6, 6],
  ["remove", 9, 9],
  ["reopen-empty", 1, 1],
];
function admittedPhase(report: ValuationProofReport, physicalCalls: number) {
  expect(report, JSON.stringify(report)).toMatchObject({
    outcome: "passed",
    failure: "none",
    closed: true,
    cleanupIncomplete: false,
  });
  expect(report.operationCount).toBeLessThanOrEqual(
    VALUATION_PROOF_LIMITS[report.phase],
  );
  expect(report.httpDispatches).toBe(physicalCalls + report.metadataCount);
  expect(report.metadataCount).toBe(report.phase === "schema" ? 2 : 0);
  expect(report.trace.length).toBeLessThanOrEqual(20);
  expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThanOrEqual(8192);
  expect(Object.isFrozen(report)).toBe(true);
  expect(Object.isFrozen(report.trace)).toBe(true);
}
function finalRows(store: AtomicStore) {
  expect(store.rows.get(key(valuationProofLocation("a")))).toMatchObject({
    version: 8,
    payloadJson: '{"schemaVersion":1,"entries":[]}',
  });
  for (const row of VALUATION_PROOF_ROWS)
    expect(store.rows.has(key(row))).toBe(row.expectedPresentAfterProof);
  expect(store.rows.size).toBe(13);
  expect(store.receipts()).toHaveLength(10);
}
function creationEvidence(reports: readonly ValuationProofReport[]) {
  const originals = new Map<string, string>();
  for (const report of reports)
    for (const row of report.currentRecords) {
      if (!originals.has(row.rowId)) {
        expect(row.version).toBe(1);
        originals.set(row.rowId, row.createdAt);
      }
      expect(row.createdAt).toBe(originals.get(row.rowId));
      if (row.version > 1) expect(row.updatedAt > row.createdAt).toBe(true);
    }
  expect(originals.size).toBe(3);
}

describe("fixed valuation storage qualification", () => {
  it("runs all14 real-repository phases with exact capacity, fresh operations and final fixed rows", async ({
    task,
  }) => {
    const store = new AtomicStore(),
      op = operation(store),
      reports: ValuationProofReport[] = [];
    Object.assign(task.meta, { valuationReports: reports });
    for (const phase of VALUATION_PROOF_PHASES) {
      phaseClock(phase);
      const start = store.calls.length;
      const report = await runValuationAssumptionsStorageProof(
        phase,
        BUILD,
        op.factory,
      );
      reports.push(report);
      admittedPhase(report, store.calls.length - start);
    }
    expect(op.counts()).toEqual({ opens: 14, closes: 14, metadataCalls: 1 });
    finalRows(store);
    creationEvidence(reports);
    expect(
      reports.map((r) => [r.phase, r.operationCount, r.httpDispatches]),
    ).toEqual(NORMAL_COUNTS);
  });
  it("uses schema metadata only and refuses drift before any row access", async () => {
    const store = new AtomicStore(),
      op = operation(store),
      base = op.factory;
    const report = await runValuationAssumptionsStorageProof(
      "schema",
      BUILD,
      (signal) => {
        const value = base(signal);
        return {
          ...value,
          metadata: async () => {
            await value.metadata();
            return { database: null, tableList: null };
          },
        };
      },
    );
    expect(report).toMatchObject({
      outcome: "failed",
      operationCount: 0,
      metadataCount: 2,
      closed: true,
    });
    expect(store.calls).toHaveLength(0);
  });
  it("refuses an occupied fixed row without deletion or alternative principals", async () => {
    const f = await seeded("stale");
    const before = structuredClone([...f.store.rows]);
    const report = await runValuationAssumptionsStorageProof(
      "preflight",
      BUILD,
      f.op.factory,
    );
    expect(report.outcome).not.toBe("passed");
    expect([...f.store.rows]).toEqual(before);
    expect(f.store.calls.slice(-1)[0]?.operation).toBe("getRow");
  });
  it.each(["database_not_found", "table_not_found", "unknown"])(
    "does not classify404 %s as an absent row",
    async (type) => {
      const store = new AtomicStore(),
        op = operation(store);
      store.fail = {
        operation: "getRow",
        error: new AppwriteException("Synthetic hidden detail", 404, type),
      };
      const report = await runValuationAssumptionsStorageProof(
        "preflight",
        BUILD,
        op.factory,
      );
      expect(report.outcome).not.toBe("passed");
      expect(report.closed).toBe(true);
      expect(JSON.stringify(report)).not.toContain("Synthetic hidden detail");
    },
  );
  it("refuses every malformed command before any store call", async () => {
    const f = await seeded("capacity");
    const context = new ValuationProofContext("capacity");
    context.operation = f.op.factory(context.lifetime.controller.signal);
    const before = f.store.calls.length;
    try {
      for (const variant of valuationProofData().invalidCommands) {
        await context.refuse(
          context.putValue(
            { owner: "size", catalog: "overflow" },
            variant.command,
          ),
          "invalid_request",
        );
        expect(f.store.calls.length, variant.name).toBe(before);
      }
    } finally {
      await context.lifetime.close(context.operation);
    }
  });
  it("requires persisted rows on a fresh reopen rather than seeding from commands", async () => {
    const store = new AtomicStore(),
      op = operation(store);
    const report = await runValuationAssumptionsStorageProof(
      "reopen",
      BUILD,
      op.factory,
    );
    expect(report.outcome).not.toBe("passed");
    expect(store.rows.size).toBe(0);
    expect(store.calls.every((call) => call.operation === "getRow")).toBe(true);
  });
});

function commitConflict(store: AtomicStore, code: 400 | 409) {
  const original = store.updateTransaction.bind(store);
  let commits = 0;
  store.updateTransaction = async (input: Input<"updateTransaction">) => {
    if (input.commit && ++commits === 2)
      store.beforeCommit = () =>
        Promise.reject(
          new AppwriteException(
            "Synthetic supported conflict",
            code,
            code === 400 ? "attribute_limit_exceeded" : "transaction_conflict",
          ),
        );
    return original(input);
  };
}
async function historicalEditWithChangedReceiptTime() {
  const phase = "historical-edit-and-catalog-review";
  const f = await seeded(phase);
  phaseClock(phase);
  const get = f.store.getRow.bind(f.store);
  const edited = valuationProofLocation("a", "historical-edit");
  const changedTime = "2000-01-01T00:00:00.000Z";
  f.store.getRow = async (input) => {
    const row = await get(input);
    if (input.rowId === edited.rowId) row.committedAt = changedTime;
    return row;
  };
  return { f, edited, changedTime };
}
describe("real conflict and transaction outcomes", () => {
  it.each([
    ["prestage", 400],
    ["prestage", 409],
    ["overlap", 400],
    ["overlap", 409],
  ] as const)(
    "qualifies %s commit%s conflict through fresh reconciliation",
    async (phase, status) => {
      const f = await seeded(phase);
      commitConflict(f.store, status);
      if (phase === "prestage") {
        const increment = f.store.incrementRowColumn.bind(f.store);
        let increments = 0;
        f.store.incrementRowColumn = (input) =>
          increment(
            ++increments === 2 ? { ...input, max: input.max + 1 } : input,
          );
      }
      const report = await runValuationAssumptionsStorageProof(
        phase,
        BUILD,
        f.op.factory,
      );
      expect(report, JSON.stringify(report)).toMatchObject({
        outcome: "passed",
        repositoryError: "conflict",
        closed: true,
      });
      expect(report.operationCount).toBe(status === 400 ? 19 : 18);
      expect(report.httpDispatches).toBe(report.operationCount);
    },
  );
  it("requires acknowledged rollback and unchanged raw row metadata", async () => {
    const f = await seeded("rollback");
    const before = structuredClone(
      f.store.rows.get(key(valuationProofLocation("a"))),
    );
    const report = await runValuationAssumptionsStorageProof(
      "rollback",
      BUILD,
      f.op.factory,
    );
    expect(report).toMatchObject({
      outcome: "passed",
      operationCount: 10,
      httpDispatches: 9,
      rollbackObserved: true,
    });
    expect(f.store.rows.get(key(valuationProofLocation("a")))).toEqual(before);
  });
  it("refuses a rewritten creation timestamp during the same phase", async () => {
    const f = await seeded("stale");
    const get = f.store.getRow.bind(f.store);
    f.store.getRow = async (input) => {
      const row = await get(input);
      if (input.tableId === "assumptions" && row.version === 2)
        row.createdAt = "2000-01-01T00:00:00.000Z";
      return row;
    };
    const report = await runValuationAssumptionsStorageProof(
      "stale",
      BUILD,
      f.op.factory,
    );
    expect(report.outcome).not.toBe("passed");
    expect(report.closed).toBe(true);
  });
  it("refuses a valid but changed intermediate historical-edit receipt time despite a correct v7 commit", async () => {
    const phase = "historical-edit-and-catalog-review";
    const { f, edited, changedTime } =
      await historicalEditWithChangedReceiptTime();
    const report = await runValuationAssumptionsStorageProof(
      phase,
      BUILD,
      f.op.factory,
    );
    const current = f.store.rows.get(key(valuationProofLocation("a")));
    const reviewed = f.store.rows.get(
      key(valuationProofLocation("a", "catalog-reviewed")),
    );
    expect(current?.version).toBe(7);
    expect(reviewed?.version).toBe(7);
    expect(reviewed?.committedAt).toBe(current?.updatedAt);
    expect(reviewed?.committedAt).not.toBe(changedTime);
    expect(f.store.rows.get(key(edited))?.committedAt).toBe(
      reviewed?.committedAt,
    );
    expect(report).toMatchObject({ outcome: "failed", closed: true });
  });
  it("fails closed when rollback cannot be acknowledged", async () => {
    const f = await seeded("rollback");
    f.store.rollbackFails = true;
    const report = await runValuationAssumptionsStorageProof(
      "rollback",
      BUILD,
      f.op.factory,
    );
    expect(report).toMatchObject({
      outcome: "incomplete",
      failure: "cleanup_failed",
      cleanupIncomplete: true,
      closed: true,
    });
  });
  it("unknown phase actually commits once and reconciles only original receipt", async () => {
    const f = await seeded("unknown"),
      start = f.store.calls.length;
    const report = await runValuationAssumptionsStorageProof(
      "unknown",
      BUILD,
      f.op.factory,
    );
    expect(report).toMatchObject({
      outcome: "passed",
      repositoryError: "commit_unknown",
      rollbackObserved: false,
    });
    const calls = f.store.calls.slice(start);
    expect(
      calls.filter((call) => call.operation === "updateTransaction"),
    ).toHaveLength(1);
    expect(f.store.rows.get(key(valuationProofLocation("a")))?.version).toBe(5);
  });
  it.each(["lost-before", "lost-after", "malformed-after"] as const)(
    "does not qualify %s without a real committed acknowledgment",
    async (outcome) => {
      const f = await seeded("unknown");
      f.store.commitOutcome = outcome;
      const report = await runValuationAssumptionsStorageProof(
        "unknown",
        BUILD,
        f.op.factory,
      );
      expect(report).toMatchObject({
        outcome: "failed",
        repositoryError: "commit_unknown",
        closed: true,
      });
      expect(report.checks).not.toContain("real_commit_ack_locally_suppressed");
    },
  );
});

describe("bounded lifetime and sanitized evidence", () => {
  it("closes a returned operation even when lazy store construction throws", async () => {
    const store = new AtomicStore(),
      op = operation(store);
    const report = await runValuationAssumptionsStorageProof(
      "preflight",
      BUILD,
      (signal) => ({
        ...op.factory(signal),
        newStore: () => {
          throw Error("private construction detail");
        },
      }),
    );
    expect(report).toMatchObject({ outcome: "failed", closed: true });
    expect(op.counts().closes).toBe(1);
    expect(JSON.stringify(report)).not.toContain("private construction detail");
  });
  it("refuses missing or extra physical dispatches", async () => {
    const store = new AtomicStore(),
      op = operation(store);
    const report = await runValuationAssumptionsStorageProof(
      "preflight",
      BUILD,
      (signal) => {
        const value = op.factory(signal);
        return {
          ...value,
          snapshot: () => ({ ...value.snapshot(), requests: 19 }),
        };
      },
    );
    expect(report).toMatchObject({
      outcome: "incomplete",
      failure: "cleanup_failed",
    });
  });
  it("does not expose corrupt stored payload, grants, hidden accessors or foreign metadata", async () => {
    const f = await seeded("reopen");
    const row = f.store.rows.get(key(valuationProofLocation("a")))!;
    row.$permissions = ["read(any)"];
    row.payloadJson = "private malformed payload";
    const report = await runValuationAssumptionsStorageProof(
      "reopen",
      BUILD,
      f.op.factory,
    );
    expect(report.outcome).not.toBe("passed");
    expect(JSON.stringify(report)).not.toContain("private malformed payload");
  });
  it.each(["grant", "foreign-location", "payload", "receipt-time"])(
    "rejects %s evidence in an independent reopened invocation",
    async (kind) => {
      const f = await seeded("reopen");
      const current = f.store.rows.get(key(valuationProofLocation("a")))!;
      const receipt = f.store.rows.get(
        key(valuationProofLocation("a", "catalog-reviewed")),
      )!;
      if (kind === "grant") current.$permissions = ["read(any)"];
      if (kind === "foreign-location") current.$databaseId = "foreign";
      if (kind === "payload") current.payloadJson = "{}";
      if (kind === "receipt-time")
        receipt.committedAt = "2000-01-01T00:00:00.000Z";
      const report = await runValuationAssumptionsStorageProof(
        "reopen",
        BUILD,
        f.op.factory,
      );
      expect(report.outcome).not.toBe("passed");
      expect(report.closed).toBe(true);
    },
  );
  it("admits only the documented SDK stringifier without invoking accessors", () => {
    const row = { field: "invented" };
    const stringifier = vi.fn();
    Object.defineProperty(row, "toString", {
      value: stringifier,
      configurable: true,
      writable: true,
      enumerable: false,
    });
    expect(valuationProofRow(row)).toEqual({ field: "invented" });
    expect(stringifier).not.toHaveBeenCalled();
    const getter = vi.fn();
    Object.defineProperty(row, "secret", { get: getter, enumerable: true });
    expect(() => valuationProofRow(row)).toThrow(ProofFailure);
    expect(getter).not.toHaveBeenCalled();
  });
  it("stops at its fixed operation ceiling without an extra port call", async () => {
    const store = new AtomicStore(),
      op = operation(store),
      context = new ValuationProofContext("reopen-empty");
    context.operation = op.factory(context.lifetime.controller.signal);
    const row = valuationProofLocation("a", "catalog-refused");
    try {
      await context.requireAbsent(row);
      await context.requireAbsent(row);
      await expect(context.requireAbsent(row)).rejects.toMatchObject({
        reason: "operation_limit",
      });
      expect(store.calls).toHaveLength(2);
    } finally {
      await context.lifetime.close(context.operation);
    }
  });
  it("deadline closes once and fences a late read without changing the returned report", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const store = new AtomicStore(),
      op = operation(store);
    let release!: () => void;
    store.beforeRead = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const task = runValuationAssumptionsStorageProof(
      "preflight",
      BUILD,
      op.factory,
    );
    await vi.advanceTimersByTimeAsync(11000);
    const report = await task,
      captured = JSON.stringify(report);
    expect(report).toMatchObject({
      outcome: "incomplete",
      failure: "deadline",
      closed: true,
    });
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(JSON.stringify(report)).toBe(captured);
    expect(op.counts()).toEqual({ opens: 1, closes: 1, metadataCalls: 0 });
    expect(store.calls).toHaveLength(1);
  });
  it("releases held race actors after constructor failure and marks pending transaction cleanup incomplete", async () => {
    const f = await seeded("prestage");
    let stores = 0;
    const report = await runValuationAssumptionsStorageProof(
      "prestage",
      BUILD,
      (signal) => {
        const value = f.op.factory(signal);
        return {
          ...value,
          newStore: () => {
            if (++stores === 2) throw Error("private construction");
            return value.newStore();
          },
        };
      },
    );
    expect(report).toMatchObject({
      outcome: "incomplete",
      failure: "cleanup_failed",
      cleanupIncomplete: true,
      closed: true,
    });
    expect(JSON.stringify(report)).not.toContain("private construction");
  });
  it("cannot report cleanup success when close rejects", async () => {
    const store = new AtomicStore(),
      op = operation(store);
    const report = await runValuationAssumptionsStorageProof(
      "preflight",
      BUILD,
      (signal) => {
        const value = op.factory(signal);
        return {
          ...value,
          close: async () => {
            await value.close();
            throw Error("private close");
          },
        };
      },
    );
    expect(report).toMatchObject({
      outcome: "incomplete",
      failure: "cleanup_failed",
      cleanupIncomplete: true,
      closed: true,
    });
    expect(JSON.stringify(report)).not.toContain("private close");
  });
  it("invalid phase/build never invokes a factory", async () => {
    const factory = vi.fn<ValuationProofFactory>();
    await expect(
      runValuationAssumptionsStorageProof(
        "unknown-phase" as ValuationProofPhase,
        BUILD,
        factory,
      ),
    ).rejects.toThrow();
    await expect(
      runValuationAssumptionsStorageProof("schema", "unbound", factory),
    ).rejects.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });
});
