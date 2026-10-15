import { afterEach, describe, expect, it, vi } from "vitest";
import { AppwriteException } from "node-appwrite";
import { AtomicStore } from "./test-appwrite-atomic-store";
import {
  runResearchFollowupsStorageProof,
  type ResearchFollowupsProofFactory,
  type ResearchFollowupsProofReport,
} from "./research-followups-storage-proof";
import {
  FOLLOWUPS_PROOF_EXPECTED_CALLS,
  FOLLOWUPS_PROOF_LIMITS,
  FOLLOWUPS_PROOF_PHASES,
  FOLLOWUPS_PROOF_ROWS,
  FOLLOWUPS_PROOF_PRINCIPALS,
  followupsProofLocation,
} from "./research-followups-proof-data";

const BUILD = "a".repeat(64);
function operation(store: AtomicStore) {
  let opens = 0,
    closes = 0;
  const factory: ResearchFollowupsProofFactory = () => {
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
type PrestageMode = "stage400" | "commit400" | "commit409" | "unknown";
async function prestageFixture(mode: PrestageMode) {
  const store = new AtomicStore(),
    op = operation(store);
  const incrementInputs: { value: number; max: number }[] = [];
  for (const phase of ["create", "stale"] as const)
    expect(
      (await runResearchFollowupsStorageProof(phase, BUILD, op.factory))
        .outcome,
    ).toBe("passed");
  if (mode !== "stage400") {
    const increment = store.incrementRowColumn.bind(store);
    let increments = 0;
    // Model a server that accepts staging but enforces the bound at commit.
    // Only this in-memory model receives the changed bound; the repository's
    // actual input and the phase trace remain observable through the spy.
    vi.spyOn(store, "incrementRowColumn").mockImplementation((input) => {
      incrementInputs.push({ value: input.value, max: input.max });
      return increment(
        ++increments === 2 ? { ...input, max: input.max + 1 } : input,
      );
    });
    const update = store.updateTransaction.bind(store);
    let commits = 0;
    vi.spyOn(store, "updateTransaction").mockImplementation((input) => {
      if (input.commit && ++commits === 2)
        store.beforeCommit = () =>
          Promise.reject(
            mode === "unknown"
              ? new Error("Private unacknowledged response")
              : new AppwriteException(
                  "Private commit response",
                  mode === "commit400" ? 400 : 409,
                  mode === "commit400"
                    ? "attribute_limit_exceeded"
                    : "transaction_conflict",
                ),
          );
      return update(input);
    });
  }
  return {
    store,
    incrementInputs,
    run: () => runResearchFollowupsStorageProof("prestage", BUILD, op.factory),
  };
}
afterEach(() => vi.useRealTimers());
describe("fixed Follow-ups storage proof", () => {
  it.for([
    ["stage400", 16, true],
    ["commit400", 18, false],
    ["commit409", 17, false],
  ] as const)(
    "proves the same winner and absent loser after %s without assuming rejection timing",
    async ([mode, calls, rollback], { task }) => {
      const f = await prestageFixture(mode);
      const report = await f.run();
      Object.assign(task.meta, { proofReport: report });
      expect(report, JSON.stringify(report)).toMatchObject({
        outcome: "passed",
        failure: "none",
        repositoryError: "conflict",
        observedVersion: 3,
        operationCount: calls,
        httpDispatches: calls,
        rollbackObserved: rollback,
        cleanupIncomplete: false,
        closed: true,
        checks: [
          "prestage_CAS_refusal",
          "winner_current_and_receipt_preserved",
          "loser_receipt_absent",
        ],
      });
      expect(report.trace).toHaveLength(calls);
      expect(calls).toBeLessThanOrEqual(FOLLOWUPS_PROOF_LIMITS.prestage);
      const winnerCommit = report.trace.findIndex(
        (entry) => entry.actor === "winner" && entry.operation === "commit",
      );
      const loserIncrement = report.trace.findIndex(
        (entry) => entry.actor === "loser" && entry.operation === "increment",
      );
      expect(loserIncrement).toBeGreaterThan(winnerCommit);
      expect(
        report.trace
          .slice(-2)
          .map(({ actor, operation }) => [actor, operation]),
      ).toEqual([
        ["read", "read_current"],
        ["inspection", "read_receipt"],
      ]);
      expect(
        report.trace.filter((entry) => entry.operation === "rollback"),
      ).toHaveLength(rollback ? 1 : 0);
      expect(
        f.store.current(FOLLOWUPS_PROOF_PRINCIPALS.a.userId, "followups"),
      ).toMatchObject({
        version: 3,
      });
      expect(
        f.store
          .receipts()
          .some(
            (row) =>
              row.$id === followupsProofLocation("a", "prestage-loser").rowId,
          ),
      ).toBe(false);
      if (mode !== "stage400") {
        expect(f.incrementInputs).toEqual([
          { value: 1, max: 3 },
          { value: 1, max: 3 },
        ]);
        expect(
          report.trace.find(
            (entry) => entry.actor === "loser" && entry.operation === "commit",
          ),
        ).toMatchObject({
          outcome: "appwrite_error",
          status: mode === "commit400" ? 400 : 409,
          errorType:
            mode === "commit400"
              ? "attribute_limit_exceeded"
              : "transaction_conflict",
          transactionStatus: null,
        });
      }
      expect(JSON.stringify(report)).not.toContain("Private");
    },
  );
  it.each(["winner-payload", "receipt-digest", "receipt-time"] as const)(
    "refuses %s corruption after a commit-time conflict",
    async (corruption) => {
      const f = await prestageFixture("commit409");
      const get = f.store.getRow.bind(f.store);
      vi.spyOn(f.store, "getRow").mockImplementation(async (input) => {
        const row = await get(input);
        if (
          corruption === "winner-payload" &&
          row.$tableId === "followups" &&
          row.version === 3
        )
          row.payloadJson = "{}";
        if (
          input.rowId === followupsProofLocation("a", "prestage-winner").rowId
        ) {
          if (corruption === "receipt-digest")
            row.digestSha256 = "0".repeat(64);
          if (corruption === "receipt-time")
            row.committedAt = "2000-01-01T00:00:00.000Z";
        }
        return row;
      });
      const report = await f.run();
      expect(report, JSON.stringify(report)).toMatchObject({
        outcome: "failed",
        failure:
          corruption === "winner-payload"
            ? "operation_failed"
            : "unexpected_result",
        repositoryError:
          corruption === "winner-payload" ? "unavailable" : "conflict",
        checks: [],
        closed: true,
      });
    },
  );
  it("does not turn an unknown loser commit into a proved conflict", async () => {
    const f = await prestageFixture("unknown");
    const report = await f.run();
    expect(report).toMatchObject({
      outcome: "failed",
      failure: "unexpected_result",
      repositoryError: "commit_unknown",
      rollbackObserved: false,
      checks: [],
      closed: true,
    });
    expect(report.trace.some((entry) => entry.operation === "rollback")).toBe(
      false,
    );
    expect(JSON.stringify(report)).not.toContain("Private");
  });
  it("executes the real ten phase bodies after 18 exact absence reads within 128/156 calls", async ({
    task,
  }) => {
    const store = new AtomicStore(),
      op = operation(store);
    const counts: number[] = [];
    const reports: ResearchFollowupsProofReport[] = [];
    Object.assign(task.meta, { proofReports: reports });
    for (const phase of FOLLOWUPS_PROOF_PHASES) {
      const before = store.calls.length;
      const report = await runResearchFollowupsStorageProof(
        phase,
        BUILD,
        op.factory,
      );
      reports.push(report);
      expect(report, JSON.stringify(report)).toMatchObject({
        outcome: "passed",
        failure: "none",
        closed: true,
        cleanupIncomplete: false,
        operationCount: FOLLOWUPS_PROOF_EXPECTED_CALLS[phase],
      });
      expect(report.operationCount).toBeLessThanOrEqual(
        FOLLOWUPS_PROOF_LIMITS[phase],
      );
      expect(report.trace.length).toBeLessThanOrEqual(20);
      expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThanOrEqual(
        8192,
      );
      expect(report.httpDispatches).toBe(store.calls.length - before);
      counts.push(report.operationCount);
      if (phase === "preflight")
        expect(
          store.calls.map((row) => (row.input as { rowId: string }).rowId),
        ).toEqual(FOLLOWUPS_PROOF_ROWS.map((row) => row.rowId));
    }
    expect(counts.reduce((a, b) => a + b, 0)).toBe(128);
    expect(
      Object.values(FOLLOWUPS_PROOF_LIMITS).reduce((a, b) => a + b, 0),
    ).toBe(156);
    expect(op.counts()).toEqual({ opens: 11, closes: 11 });
    expect(
      store.current(FOLLOWUPS_PROOF_PRINCIPALS.a.userId, "followups").version,
    ).toBe(5);
    expect(
      store.current(FOLLOWUPS_PROOF_PRINCIPALS.b.userId, "followups").version,
    ).toBe(1);
    expect(
      store.current(FOLLOWUPS_PROOF_PRINCIPALS.size.userId, "followups")
        .version,
    ).toBe(2);
    expect(
      store.calls.some((row) =>
        JSON.stringify(row.input).includes('"watchlists"'),
      ),
    ).toBe(false);
  });
  it("refuses an occupied preflight and a wrong predecessor without starting a transaction", async () => {
    const store = new AtomicStore(),
      op = operation(store);
    expect(
      (await runResearchFollowupsStorageProof("create", BUILD, op.factory))
        .outcome,
    ).toBe("passed");
    const before = store.calls.length;
    expect(
      (await runResearchFollowupsStorageProof("preflight", BUILD, op.factory))
        .outcome,
    ).toBe("failed");
    expect(
      (await runResearchFollowupsStorageProof("unknown", BUILD, op.factory))
        .outcome,
    ).toBe("failed");
    expect(
      store.calls.slice(before).every((row) => row.operation === "getRow"),
    ).toBe(true);
  });
  it("accepts SDK metadata precision/offset while checking application and receipt time equality", async () => {
    const store = new AtomicStore(),
      op = operation(store);
    await runResearchFollowupsStorageProof("create", BUILD, op.factory);
    for (const row of store.rows.values()) {
      row.$createdAt = "2026-09-28T21:00:00.123456+00:00";
      row.$updatedAt = "2026-09-28T21:00:00+00:00";
    }
    expect(
      (await runResearchFollowupsStorageProof("stale", BUILD, op.factory))
        .outcome,
    ).toBe("passed");
  });
  it("rejects a mismatched committed application timestamp even when each row is individually valid", async () => {
    const store = new AtomicStore(),
      op = operation(store);
    await runResearchFollowupsStorageProof("create", BUILD, op.factory);
    const read = store.getRow.bind(store);
    store.getRow = async (input) => {
      const value = await read(input);
      if (input.rowId === followupsProofLocation("a", "stale-winner").rowId)
        value.committedAt = "2026-10-15T00:00:00.000Z";
      return value;
    };
    expect(
      (await runResearchFollowupsStorageProof("stale", BUILD, op.factory))
        .outcome,
    ).toBe("failed");
  });
  it("stops an incomplete preflight on the original failure without retry or secret-bearing report", async () => {
    const store = new AtomicStore(),
      op = operation(store);
    store.fail = {
      operation: "getRow",
      error: new AppwriteException(
        "private SDK body credential",
        503,
        "privateType",
      ),
    };
    const report = await runResearchFollowupsStorageProof(
      "preflight",
      BUILD,
      op.factory,
    );
    expect(report).toMatchObject({
      outcome: "failed",
      operationCount: 1,
      closed: true,
    });
    expect(JSON.stringify(report)).not.toMatch(
      /private SDK|credential|privateType/u,
    );
    expect(store.calls).toHaveLength(1);
  });
  it("uses the actual function UTC clock for writes, never the fixed negative clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-03-12T04:05:06.789Z"));
    const store = new AtomicStore(),
      op = operation(store);
    const report = await runResearchFollowupsStorageProof(
      "create",
      BUILD,
      op.factory,
    );
    expect(report.outcome).toBe("passed");
    expect(
      store.current(FOLLOWUPS_PROOF_PRINCIPALS.a.userId, "followups"),
    ).toMatchObject({
      createdAt: "2027-03-12T04:05:06.789Z",
      updatedAt: "2027-03-12T04:05:06.789Z",
    });
    expect(
      [...store.rows.values()].find((row) => row.$tableId === "receipts")
        ?.committedAt,
    ).toBe("2027-03-12T04:05:06.789Z");
  });
  it("refuses a non-future 9999 probe before storage", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("9999-12-31T00:00:00.000Z"));
    const store = new AtomicStore(),
      op = operation(store);
    expect(
      await runResearchFollowupsStorageProof(
        "domain-guards",
        BUILD,
        op.factory,
      ),
    ).toMatchObject({ outcome: "failed", operationCount: 0, closed: true });
    expect(store.calls).toHaveLength(0);
  });
  it("reports a failed rollback as incomplete rather than claiming a clean failure", async () => {
    const store = new AtomicStore(),
      op = operation(store);
    for (const phase of ["create", "stale", "prestage", "overlap"] as const)
      expect(
        (await runResearchFollowupsStorageProof(phase, BUILD, op.factory))
          .outcome,
      ).toBe("passed");
    store.rollbackFails = true;
    const report = await runResearchFollowupsStorageProof(
      "rollback",
      BUILD,
      op.factory,
    );
    expect(report).toMatchObject({
      outcome: "incomplete",
      failure: "cleanup_failed",
      cleanupIncomplete: true,
      closed: true,
    });
    expect(
      store.calls
        .filter(
          (row) =>
            row.operation === "updateTransaction" &&
            (row.input as { rollback?: boolean }).rollback,
        )
        .at(-1),
    ).toBeDefined();
  });
  it("bounds an aborted actor and closes its operation without late restoration", async () => {
    vi.useFakeTimers();
    const store = new AtomicStore(),
      op = operation(store);
    let release!: () => void;
    store.beforeRead = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const task = runResearchFollowupsStorageProof("create", BUILD, op.factory);
    await vi.advanceTimersByTimeAsync(11000);
    const report = await task;
    expect(report).toMatchObject({
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
});
