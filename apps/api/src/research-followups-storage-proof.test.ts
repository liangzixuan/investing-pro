import { afterEach, describe, expect, it, vi } from "vitest";
import { AppwriteException } from "node-appwrite";
import { AtomicStore } from "./test-appwrite-atomic-store";
import {
  runResearchFollowupsStorageProof,
  type ResearchFollowupsProofFactory,
} from "./research-followups-storage-proof";
import {
  FOLLOWUPS_PROOF_EXPECTED_CALLS,
  FOLLOWUPS_PROOF_LIMITS,
  FOLLOWUPS_PROOF_PHASES,
  FOLLOWUPS_PROOF_ROWS,
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
afterEach(() => vi.useRealTimers());
describe("fixed Follow-ups storage proof", () => {
  it("executes the real ten phase bodies after 18 exact absence reads within 127/156 calls", async () => {
    const store = new AtomicStore(),
      op = operation(store);
    const counts: number[] = [];
    for (const phase of FOLLOWUPS_PROOF_PHASES) {
      const before = store.calls.length;
      const report = await runResearchFollowupsStorageProof(
        phase,
        BUILD,
        op.factory,
      );
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
    expect(counts.reduce((a, b) => a + b, 0)).toBe(127);
    expect(
      Object.values(FOLLOWUPS_PROOF_LIMITS).reduce((a, b) => a + b, 0),
    ).toBe(156);
    expect(op.counts()).toEqual({ opens: 11, closes: 11 });
    expect(
      store.current("proof-followups-b03a64a-a", "followups").version,
    ).toBe(5);
    expect(
      store.current("proof-followups-b03a64a-b", "followups").version,
    ).toBe(1);
    expect(
      store.current("proof-followups-b03a64a-size", "followups").version,
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
      store.current("proof-followups-b03a64a-a", "followups"),
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
