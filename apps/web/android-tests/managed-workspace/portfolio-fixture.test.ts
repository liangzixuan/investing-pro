import { describe, expect, it } from "vitest";
import { createFixture } from "./fixture";
import { createPortfolioResource } from "./portfolio-fixture";
import type {
  ManagedPortfolioCommand,
  ManagedPortfolioPayload,
} from "@research-cockpit/contracts";

const signal = () => new AbortController().signal;
function payload(): ManagedPortfolioPayload {
  return {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    basisMethod: "fifo_with_opening_pool",
    identities: [],
    opening: { asOfDate: "2026-10-01", cashUsd: "1000.00", holdings: [] },
    transactions: [],
  };
}
function command(): ManagedPortfolioCommand {
  return {
    expectedVersion: 0,
    idempotencyKey: "invented-portfolio-save-1",
    payload: payload(),
  };
}
describe("invented native Portfolio resource", () => {
  it("does no construction-time read and starts with an owned version-zero null", async () => {
    const f = await createFixture("portfolio-ledger");
    expect(f.getSnapshot()).toMatchObject({
      load: 0,
      status: 0,
      resolve: 0,
      annual: 0,
      eod: 0,
      filings: 0,
    });
    expect(f.portfolio!.getSnapshot()).toMatchObject({
      session: 1,
      load: 0,
      save: 0,
    });
    expect(f.followups!.getSnapshot()).toMatchObject({
      session: 1,
      load: 0,
      save: 0,
    });
    expect(await f.api.loadPortfolio(signal())).toEqual({
      version: 0,
      payload: null,
    });
    expect(f.getSnapshot().load).toBe(0);
  });
  it("replays only the exact admitted command before fresh modes and keeps other resources independent", async () => {
    const f = createPortfolioResource();
    const input = command();
    f.setNextSave("lost-ack");
    await expect(f.api.savePortfolio(input, signal())).rejects.toMatchObject({
      code: "commit_unknown",
    });
    f.setNextSave("retire");
    expect(await f.api.savePortfolio(input, signal())).toEqual({
      version: 1,
      payload: payload(),
      replayed: true,
    });
    await expect(
      f.api.savePortfolio(
        {
          ...input,
          payload: {
            ...input.payload,
            opening: { ...input.payload.opening, cashUsd: "1001.00" },
          },
        },
        signal(),
      ),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    expect(await f.api.loadPortfolio(signal())).toEqual({
      version: 1,
      payload: payload(),
    });
    expect(f.getSnapshot()).toMatchObject({
      commits: 1,
      replays: 1,
      keyConflicts: 1,
      retirements: 0,
    });
  });
  it("models conflict as another complete ledger without a loser receipt", async () => {
    const f = createPortfolioResource();
    f.setNextSave("conflict");
    await expect(
      f.api.savePortfolio(command(), signal()),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      f.api.savePortfolio(command(), signal()),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await f.api.loadPortfolio(signal())).toEqual({
      version: 1,
      payload: payload(),
    });
    expect(f.getSnapshot()).toMatchObject({
      commits: 0,
      replays: 0,
      conflicts: 2,
      otherClientCommits: 1,
    });
  });
  it("holds captured replies, records abort and settles once without undoing a commit", async () => {
    const f = createPortfolioResource();
    const controller = new AbortController();
    f.setNextSave("hold");
    const reply = f.api.savePortfolio(command(), controller.signal);
    expect(f.getSnapshot()).toMatchObject({ commits: 1, held: 1 });
    controller.abort();
    f.settleHeld();
    expect(await reply).toMatchObject({ version: 1, replayed: false });
    expect(f.getSnapshot()).toMatchObject({ aborted: 1, settled: 1, held: 0 });
    expect(() => f.settleHeld()).toThrow("No invented held response");
  });
  it("fails reads without changing storage and bounds requests/queue/modes", async () => {
    const f = createPortfolioResource();
    f.setNextRead("fail");
    await expect(f.api.loadPortfolio(signal())).rejects.toMatchObject({
      code: "unavailable",
    });
    const held = Array.from({ length: 4 }, () => {
      f.setNextRead("hold");
      return f.api.loadPortfolio(signal());
    });
    f.setNextRead("hold");
    await expect(f.api.loadPortfolio(signal())).rejects.toThrow(
      "queue is full",
    );
    for (const reply of held) {
      f.settleHeld();
      expect(await reply).toEqual({ version: 0, payload: null });
    }
    const aborted = new AbortController();
    aborted.abort();
    await expect(f.api.loadPortfolio(aborted.signal)).rejects.toThrow(
      "cancelled",
    );
    await expect(
      f.api.savePortfolio(
        { ...command(), payload: {} } as ManagedPortfolioCommand,
        signal(),
      ),
    ).rejects.toThrow("Invalid invented");
    expect(f.getSnapshot()).toMatchObject({
      commits: 0,
      version: 0,
      failures: 1,
    });
    const bounded = createPortfolioResource();
    for (let i = 0; i < 64; i++) await bounded.api.loadPortfolio(signal());
    await expect(bounded.api.loadPortfolio(signal())).rejects.toThrow(
      "unbounded",
    );
  });
  it("allows only explicit exact current identity resolution and retires each invented session independently", async () => {
    const f = await createFixture("portfolio-ledger");
    const request = {
      snapshotSha256: `sha256:${"a".repeat(64)}`,
      listingIds: ["listing-zero"],
    };
    await expect(f.api.resolve(request, signal())).rejects.toThrow(
      "Unexpected invented",
    );
    await f.api.status(signal());
    const result = await f.api.resolve(request, signal());
    expect(result.results[0]?.listing?.symbol).toBe("ZERO");
    await expect(
      f.api.resolve({ ...request, listingIds: ["listing-one"] }, signal()),
    ).rejects.toThrow("Unexpected invented");
    expect(f.getSnapshot()).toMatchObject({
      resolve: 1,
      annual: 0,
      eod: 0,
      filings: 0,
      save: 0,
    });
    await f.session.signOut();
    const next = f.portfolio!.nextSession();
    await next.signOut();
    expect(f.portfolio!.getSnapshot()).toMatchObject({
      session: 2,
      signOut: 2,
      token: 0,
    });
    expect(f.followups!.getSnapshot()).toMatchObject({
      session: 2,
      signOut: 2,
      token: 0,
      save: 0,
    });
  });
});

async function holdingWatchlistFixture() {
  const f = await createFixture("portfolio-ledger");
  const original = await f.api.load(signal());
  const input = {
    expectedVersion: 1,
    idempotencyKey: "invented-holding-watchlist-save",
    payload: {
      ...original.payload,
      memberships: [
        {
          ...original.payload.memberships[1]!,
          note: "Holding research list note",
        },
        { ...original.payload.memberships[0]!, note: "" },
      ],
    },
  };
  return { f, input };
}
it("admits only the declared holding Watchlist command and reloads its complete version without a Portfolio write", async () => {
  const { f, input } = await holdingWatchlistFixture();
  expect(f.getSnapshot()).toMatchObject({
    load: 1,
    save: 0,
    annual: 0,
    eod: 0,
    filings: 0,
  });
  expect(await f.api.save(input, signal())).toEqual({
    version: 2,
    payload: input.payload,
    replayed: false,
  });
  expect(await f.api.load(signal())).toEqual({
    version: 2,
    payload: input.payload,
  });
  expect(f.getSnapshot()).toMatchObject({
    load: 2,
    save: 1,
    annual: 0,
    eod: 0,
    filings: 0,
  });
  expect(f.portfolio!.getSnapshot().save).toBe(0);
  expect(f.followups!.getSnapshot().save).toBe(0);
});
it.each(["order", "note", "identity", "version", "key"] as const)(
  "retains the original fixture refusal for changed holding command %s",
  async (change) => {
    const { f, input } = await holdingWatchlistFixture();
    const bad = structuredClone(input);
    holdingCommandChanges[change](bad);
    await expect(f.api.save(bad, signal())).rejects.toThrow(
      "Unexpected fixture operation: save",
    );
    expect(f.getSnapshot().save).toBe(1);
    expect((await f.api.load(signal())).version).toBe(1);
  },
);
const holdingCommandChanges = {
  order: (input) => {
    input.payload.memberships.reverse();
  },
  note: (input) => {
    input.payload.memberships[1]!.note = "Not the declared blank note";
  },
  identity: (input) => {
    input.payload.memberships[1]!.securityId = "different-security";
  },
  version: (input) => {
    input.expectedVersion = 0;
  },
  key: (input) => {
    input.idempotencyKey = "";
  },
} satisfies Record<
  string,
  (input: Awaited<ReturnType<typeof holdingWatchlistFixture>>["input"]) => void
>;
