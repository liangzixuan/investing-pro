import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppwriteException } from "node-appwrite";
import {
  encodePortfolioPayload,
  type ManagedPortfolioCommand,
} from "@research-cockpit/contracts";
import { AtomicStore } from "./test-appwrite-atomic-store";
import {
  runPortfolioStorageProof,
  type PortfolioProofFactory,
  type PortfolioProofReport,
} from "./portfolio-storage-proof";
import {
  PORTFOLIO_PROOF_COMMAND_PINS,
  PORTFOLIO_PROOF_LIMITS,
  PORTFOLIO_PROOF_PHASES,
  PORTFOLIO_PROOF_PRINCIPALS,
  PORTFOLIO_PROOF_ROWS,
  portfolioProofData,
  portfolioProofLocation,
  type PortfolioProofPhase,
} from "./portfolio-proof-data";

const BUILD = "b".repeat(64);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-03-12T04:05:06.789Z"));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function operation(store: AtomicStore) {
  let opens = 0,
    closes = 0;
  const factory: PortfolioProofFactory = () => {
    opens++;
    let closed = false;
    const start = store.calls.length;
    return {
      newStore: () => store,
      snapshot: () => ({
        requests: store.calls.length - start,
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
  return { factory, counts: () => ({ opens, closes }) };
}
async function seeded(before: PortfolioProofPhase) {
  const store = new AtomicStore(),
    op = operation(store);
  for (const phase of PORTFOLIO_PROOF_PHASES.slice(
    1,
    PORTFOLIO_PROOF_PHASES.indexOf(before),
  )) {
    const result = await runPortfolioStorageProof(phase, BUILD, op.factory);
    expect(result, JSON.stringify(result)).toMatchObject({
      outcome: "passed",
      closed: true,
    });
  }
  return { store, op };
}
const rowKey = (
  owner: "a" | "b" | "size",
  name?: Parameters<typeof portfolioProofLocation>[1],
) => {
  const row = portfolioProofLocation(owner, name);
  return JSON.stringify([row.databaseId, row.tableId, row.rowId]);
};
function exactRows(store: AtomicStore) {
  const data = portfolioProofData();
  for (const [owner, name, version] of [
    ["a", "unknown", 5],
    ["b", "create", 1],
    ["size", "capacity", 1],
  ] as const) {
    const commands: Readonly<
      Partial<
        Record<
          Parameters<typeof portfolioProofLocation>[1] & string,
          ManagedPortfolioCommand
        >
      >
    > = data.commands[owner];
    const current = store.rows.get(rowKey(owner))!;
    expect(current).toMatchObject({
      ownerId: PORTFOLIO_PROOF_PRINCIPALS[owner].userId,
      resourceId: "main",
      version,
      payloadJson: encodePortfolioPayload(commands[name]!.payload),
    });
  }
  for (const row of PORTFOLIO_PROOF_ROWS)
    expect(
      store.rows.has(JSON.stringify([row.databaseId, row.tableId, row.rowId])),
    ).toBe(row.expectedPresentAfterProof);
  expect(store.rows.size).toBe(10);
  expect(store.receipts()).toHaveLength(7);
}
describe("fixed Portfolio storage proof", () => {
  it("qualifies all11 real phases with complete canonical rows and7 receipts inside155 calls", async ({
    task,
  }) => {
    const store = new AtomicStore(),
      op = operation(store),
      reports: PortfolioProofReport[] = [];
    Object.assign(task.meta, { portfolioReports: reports });
    for (const phase of PORTFOLIO_PROOF_PHASES) {
      const start = store.calls.length;
      const result = await runPortfolioStorageProof(phase, BUILD, op.factory);
      reports.push(result);
      expect(result, JSON.stringify(result)).toMatchObject({
        outcome: "passed",
        failure: "none",
        closed: true,
        cleanupIncomplete: false,
      });
      expect(result.operationCount).toBeLessThanOrEqual(
        PORTFOLIO_PROOF_LIMITS[phase],
      );
      expect(result.httpDispatches).toBe(store.calls.length - start);
      expect(result.trace.length).toBeLessThanOrEqual(20);
      expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(
        8192,
      );
      for (const call of store.calls.slice(start))
        if (
          call.operation.endsWith("Row") ||
          call.operation === "incrementRowColumn"
        ) {
          const input = call.input as {
            databaseId: string;
            tableId: string;
            rowId: string;
          };
          expect(
            PORTFOLIO_PROOF_ROWS.some(
              (row) =>
                row.databaseId === input.databaseId &&
                row.tableId === input.tableId &&
                row.rowId === input.rowId,
            ),
          ).toBe(true);
        }
    }
    expect(
      reports.reduce((sum, r) => sum + r.operationCount, 0),
    ).toBeLessThanOrEqual(155);
    expect(op.counts()).toEqual({ opens: 11, closes: 11 });
    exactRows(store);
    expect(
      reports.find((r) => r.phase === "unknown")?.receipts[0]?.committedAt,
    ).toBe("2027-03-12T04:05:06.789Z");
    expect(reports.find((r) => r.phase === "capacity")?.checks).toContain(
      "measured_cardinality_cap_payload",
    );
    expect(
      PORTFOLIO_PROOF_COMMAND_PINS.find((p) => p.owner === "size")
        ?.payloadBytes,
    ).toBe(132270);
  });
  it("refuses occupied or wrong-predecessor state without starting any transaction", async () => {
    const { store, op } = await seeded("stale");
    const start = store.calls.length;
    for (const phase of ["preflight", "unknown"] as const)
      expect(
        (await runPortfolioStorageProof(phase, BUILD, op.factory)).outcome,
      ).toBe("failed");
    expect(
      store.calls.slice(start).every((c) => c.operation === "getRow"),
    ).toBe(true);
  });
  it.each(["prestage", "overlap"] as const)(
    "requires fresh absent loser receipt after %s",
    async (phase) => {
      const { store, op } = await seeded(phase);
      const get = store.getRow.bind(store);
      let loserReads = 0;
      const loserId = portfolioProofLocation(
        "a",
        phase === "prestage" ? "prestage-loser" : "overlap-loser",
      ).rowId;
      vi.spyOn(store, "getRow").mockImplementation((input) => {
        if (input.rowId === loserId) loserReads++;
        return get(input);
      });
      const result = await runPortfolioStorageProof(phase, BUILD, op.factory);
      expect(result, JSON.stringify(result)).toMatchObject({
        outcome: "passed",
        closed: true,
      });
      expect(loserReads).toBeGreaterThanOrEqual(3);
      expect(result.trace.at(-1)).toMatchObject({
        actor: "inspection",
        operation: "read_receipt",
        outcome: "appwrite_error",
        status: 404,
        errorType: "row_not_found",
      });
    },
  );
  it.each(["current-payload", "winner-time", "loser-present"] as const)(
    "refuses %s after a staged race",
    async (corruption) => {
      const { store, op } = await seeded("overlap");
      const get = store.getRow.bind(store);
      vi.spyOn(store, "getRow").mockImplementation(async (input) => {
        if (
          corruption === "loser-present" &&
          input.rowId === portfolioProofLocation("a", "overlap-loser").rowId &&
          store.rows.get(rowKey("a"))?.version === 4
        )
          return {
            ...store.rows.get(rowKey("a", "overlap-winner"))!,
            $id: input.rowId,
          };
        const row = await get(input);
        if (
          corruption === "current-payload" &&
          input.tableId === "portfolios" &&
          row.version === 4
        )
          row.payloadJson = "{}";
        if (
          corruption === "winner-time" &&
          input.rowId === portfolioProofLocation("a", "overlap-winner").rowId
        )
          row.committedAt = "2000-01-01T00:00:00.000Z";
        return row;
      });
      expect(
        (await runPortfolioStorageProof("overlap", BUILD, op.factory)).outcome,
      ).not.toBe("passed");
    },
  );
  it.for(["prestage", "overlap"] as const)(
    "qualifies typed commit400 and409 %s conflict paths within20",
    async (phase, { task }) => {
      const reports: { status: number; report: PortfolioProofReport }[] = [];
      Object.assign(task.meta, { raceReports: reports });
      for (const status of [400, 409]) {
        const { store, op } = await seeded(phase);
        const increment = store.incrementRowColumn.bind(store);
        let increments = 0;
        if (phase === "prestage")
          vi.spyOn(store, "incrementRowColumn").mockImplementation((input) =>
            increment(
              ++increments === 2 ? { ...input, max: input.max + 1 } : input,
            ),
          );
        const update = store.updateTransaction.bind(store);
        let commits = 0;
        vi.spyOn(store, "updateTransaction").mockImplementation((input) => {
          if (input.commit && ++commits === 2)
            store.beforeCommit = () =>
              Promise.reject(
                new AppwriteException(
                  "Private commit body",
                  status,
                  status === 400
                    ? "attribute_limit_exceeded"
                    : "transaction_conflict",
                ),
              );
          return update(input);
        });
        const result = await runPortfolioStorageProof(phase, BUILD, op.factory);
        reports.push({ status, report: result });
        expect(result, JSON.stringify(result)).toMatchObject({
          outcome: "passed",
          repositoryError: "conflict",
          rollbackObserved: false,
          closed: true,
          cleanupIncomplete: false,
        });
        expect(result.operationCount).toBeLessThanOrEqual(20);
        expect(JSON.stringify(result)).not.toContain("Private");
      }
    },
  );
  it("does not turn an unacknowledged overlap into conflict or rollback", async () => {
    const { store, op } = await seeded("overlap");
    const update = store.updateTransaction.bind(store);
    let commits = 0;
    vi.spyOn(store, "updateTransaction").mockImplementation((input) => {
      if (input.commit && ++commits === 2)
        store.beforeCommit = () =>
          Promise.reject(new Error("Private transport body"));
      return update(input);
    });
    const result = await runPortfolioStorageProof("overlap", BUILD, op.factory);
    expect(result).toMatchObject({
      outcome: "failed",
      repositoryError: "commit_unknown",
      rollbackObserved: false,
      closed: true,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
  });
  it("requires acknowledged rollback and preserves all current metadata plus absence", async () => {
    const { store, op } = await seeded("rollback");
    const before = structuredClone(store.rows.get(rowKey("a")));
    const result = await runPortfolioStorageProof(
      "rollback",
      BUILD,
      op.factory,
    );
    expect(result).toMatchObject({
      outcome: "passed",
      rollbackObserved: true,
      closed: true,
    });
    expect(store.rows.get(rowKey("a"))).toEqual(before);
    expect(store.rows.has(rowKey("a", "rollback"))).toBe(false);
  });
  it("retains incomplete cleanup when rollback or close fails", async () => {
    const { store, op } = await seeded("rollback");
    store.rollbackFails = true;
    expect(
      await runPortfolioStorageProof("rollback", BUILD, op.factory),
    ).toMatchObject({
      outcome: "incomplete",
      failure: "cleanup_failed",
      cleanupIncomplete: true,
      closed: true,
    });
    const normal = operation(new AtomicStore());
    const factory: PortfolioProofFactory = (signal) => ({
      ...normal.factory(signal),
      close: () => Promise.reject(new Error("Private close")),
    });
    const result = await runPortfolioStorageProof("preflight", BUILD, factory);
    expect(result.outcome).toBe("incomplete");
    expect(JSON.stringify(result)).not.toContain("Private");
  });
  it.each(["sequence", "permission", "time", "extra"] as const)(
    "refuses malformed %s row metadata",
    async (field) => {
      const { store, op } = await seeded("stale");
      const raw = store.rows.get(rowKey("a"))!;
      if (field === "sequence") raw.$sequence = NaN;
      if (field === "permission") raw.$permissions = ['read("any")'];
      if (field === "time") raw.$createdAt = "not a date";
      if (field === "extra") raw.unexpected = "Private";
      const result = await runPortfolioStorageProof("stale", BUILD, op.factory);
      expect(result.outcome).not.toBe("passed");
      expect(result.closed).toBe(true);
      expect(JSON.stringify(result)).not.toContain("Private");
    },
  );
  it.each([NaN, -1, 21, 1.5] as const)(
    "refuses nonfinite/out-of-bound dispatch metadata %s",
    async (requests) => {
      const op = operation(new AtomicStore());
      const factory: PortfolioProofFactory = (signal) => {
        const base = op.factory(signal);
        return { ...base, snapshot: () => ({ ...base.snapshot(), requests }) };
      };
      const result = await runPortfolioStorageProof(
        "preflight",
        BUILD,
        factory,
      );
      expect(result.outcome).toBe("incomplete");
      expect(result.httpDispatches).toBeNull();
    },
  );
  it("retains failure after a single upstream error without retry or private diagnostics", async () => {
    const store = new AtomicStore(),
      op = operation(store);
    store.fail = {
      operation: "getRow",
      error: new AppwriteException(
        "Private SDK credential body",
        503,
        "private_type",
      ),
    };
    const result = await runPortfolioStorageProof(
      "preflight",
      BUILD,
      op.factory,
    );
    expect(result).toMatchObject({
      outcome: "failed",
      operationCount: 1,
      closed: true,
    });
    expect(store.calls).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(
      /Private|credential|private_type/,
    );
  });
  it("aborts a held original read, closes once and cannot restore a retired actor", async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    const store = new AtomicStore(),
      op = operation(store);
    let release!: () => void;
    store.beforeRead = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const task = runPortfolioStorageProof("create", BUILD, op.factory);
    await vi.advanceTimersByTimeAsync(11000);
    const result = await task;
    expect(result).toMatchObject({
      outcome: "incomplete",
      failure: "deadline",
      closed: true,
      operationCount: 1,
    });
    release();
    await Promise.resolve();
    expect(store.rows.size).toBe(0);
    expect(op.counts()).toEqual({ opens: 1, closes: 1 });
  });
  it("does not accept a future guard after its fixed future date", async () => {
    vi.setSystemTime(new Date("9999-12-31T00:00:00.000Z"));
    const store = new AtomicStore(),
      op = operation(store);
    expect(
      await runPortfolioStorageProof("domain-guards", BUILD, op.factory),
    ).toMatchObject({ outcome: "failed", operationCount: 0, closed: true });
  });
  it("releases a race that never reaches its barrier and closes the original actor", async () => {
    const { store, op } = await seeded("prestage");
    store.fail = {
      operation: "createTransaction",
      error: new AppwriteException(
        "Private begin failure",
        503,
        "unknown_type",
      ),
    };
    const result = await runPortfolioStorageProof(
      "prestage",
      BUILD,
      op.factory,
    );
    expect(result).toMatchObject({
      outcome: "incomplete",
      failure: "stage_not_reached",
      closed: true,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(op.counts().opens).toBe(op.counts().closes);
  });
  it("refuses unclosed or malformed transport status without retaining supplied diagnostics", async () => {
    for (const bad of [
      { closed: false },
      { lastStatus: Infinity },
      { lastStatus: 600 },
      { lastStatus: "Private" },
    ]) {
      const op = operation(new AtomicStore());
      const factory: PortfolioProofFactory = (signal) => {
        const base = op.factory(signal);
        return {
          ...base,
          snapshot: () =>
            ({ ...base.snapshot(), ...bad }) as ReturnType<
              typeof base.snapshot
            >,
        };
      };
      const result = await runPortfolioStorageProof(
        "preflight",
        BUILD,
        factory,
      );
      expect(result).toMatchObject({
        outcome: "incomplete",
        failure: "cleanup_failed",
      });
      expect(JSON.stringify(result)).not.toContain("Private");
    }
  });
  it("cannot pass a finite but inconsistent transport dispatch census", async () => {
    const op = operation(new AtomicStore());
    const factory: PortfolioProofFactory = (signal) => {
      const base = op.factory(signal);
      return { ...base, snapshot: () => ({ ...base.snapshot(), requests: 0 }) };
    };
    expect(
      await runPortfolioStorageProof("preflight", BUILD, factory),
    ).toMatchObject({
      outcome: "incomplete",
      failure: "cleanup_failed",
      httpDispatches: null,
    });
  });
  it("uses actual UTC repository policy to refuse capacity before its authored dates without a transaction", async () => {
    vi.setSystemTime(new Date("2000-01-01T00:00:00.000Z"));
    const store = new AtomicStore(),
      op = operation(store);
    const result = await runPortfolioStorageProof(
      "capacity",
      BUILD,
      op.factory,
    );
    expect(result).toMatchObject({
      outcome: "failed",
      repositoryError: "invalid_request",
      closed: true,
    });
    expect(store.calls.every((call) => call.operation === "getRow")).toBe(true);
  });
  it("rejects arbitrary phases/build IDs before factory or store access", async () => {
    const factory = vi.fn<PortfolioProofFactory>();
    await expect(
      runPortfolioStorageProof("other" as PortfolioProofPhase, BUILD, factory),
    ).rejects.toThrow("Invalid proof");
    await expect(
      runPortfolioStorageProof("create", "not a build", factory),
    ).rejects.toThrow("Invalid proof");
    expect(factory).not.toHaveBeenCalled();
  });
});
