import { describe, expect, it } from "vitest";
import type { ManagedResearchFollowupsCommand } from "@research-cockpit/contracts";
import { createFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";

const signal = () => new AbortController().signal;
const command = (
  expectedVersion = 0,
  idempotencyKey = "invented-command-1",
): ManagedResearchFollowupsCommand => ({
  expectedVersion,
  idempotencyKey,
  payload: { schemaVersion: 1, entries: [] },
});

describe("independent invented follow-up RAM store", () => {
  it("starts empty, owns the captured command and replays its original receipt after a later commit", async () => {
    const f = createResearchFollowupsFixture();
    expect(await f.api.loadFollowups(signal())).toEqual({
      version: 0,
      payload: { schemaVersion: 1, entries: [] },
    });
    const first = command();
    const accepted = await f.api.saveFollowups(first, signal());
    (first as { expectedVersion: number }).expectedVersion = 50;
    await f.api.saveFollowups(command(1, "invented-command-2"), signal());
    expect(await f.api.saveFollowups(command(), signal())).toEqual({
      ...accepted,
      replayed: true,
    });
    expect((await f.api.loadFollowups(signal())).version).toBe(2);
    await expect(
      f.api.saveFollowups(command(1), signal()),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    expect(f.getSnapshot()).toMatchObject({
      commits: 2,
      replays: 1,
      keyConflicts: 1,
      version: 2,
    });
  });

  it("captures held reads at dispatch and commits held saves before their acknowledgements", async () => {
    const f = createResearchFollowupsFixture();
    f.setNextRead("hold");
    const oldRead = f.api.loadFollowups(signal());
    f.setNextSave("hold");
    const abort = new AbortController();
    const oldSave = f.api.saveFollowups(command(), abort.signal);
    expect(f.getSnapshot()).toMatchObject({ commits: 1, held: 2, version: 1 });
    abort.abort();
    f.nextSession();
    expect((await f.api.loadFollowups(signal())).version).toBe(1);
    f.settleHeld();
    expect((await oldRead).version).toBe(0);
    f.settleHeld();
    expect(await oldSave).toMatchObject({ version: 1, replayed: false });
    expect(f.getSnapshot()).toMatchObject({
      aborted: 1,
      settled: 2,
      held: 0,
      commits: 1,
    });
    expect(() => f.settleHeld()).toThrow("No invented held response");
  });

  it("commits lost acknowledgements once and rejects stale versions without creating a receipt", async () => {
    const f = createResearchFollowupsFixture();
    f.setNextSave("lost-ack");
    await expect(
      f.api.saveFollowups(command(), signal()),
    ).rejects.toMatchObject({ code: "commit_unknown" });
    expect(await f.api.saveFollowups(command(), signal())).toMatchObject({
      version: 1,
      replayed: true,
    });
    f.setNextSave("conflict");
    await expect(
      f.api.saveFollowups(command(1, "invented-command-2"), signal()),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(
      await f.api.saveFollowups(command(2, "invented-command-2"), signal()),
    ).toMatchObject({ version: 3, replayed: false });
    expect(f.getSnapshot()).toMatchObject({
      commits: 2,
      otherClientCommits: 1,
      conflicts: 1,
      version: 3,
    });
  });

  it.each(["fail", "retire"] as const)(
    "%s refuses both operations before any commit and sessions reset modes",
    async (mode) => {
      const f = createResearchFollowupsFixture();
      f.setNextRead(mode);
      await expect(f.api.loadFollowups(signal())).rejects.toMatchObject({
        code: mode === "fail" ? "unavailable" : "unauthenticated",
      });
      f.setNextSave(mode);
      await expect(
        f.api.saveFollowups(command(), signal()),
      ).rejects.toMatchObject({
        code: mode === "fail" ? "unavailable" : "unauthenticated",
      });
      f.setNextRead("hold");
      f.setNextSave("lost-ack");
      const first = f.nextSession();
      const second = f.nextSession();
      expect(first.userId).toBe(second.userId);
      expect(first.sessionId).not.toBe(second.sessionId);
      expect(f.getSnapshot()).toMatchObject({
        version: 0,
        commits: 0,
        nextRead: "complete",
        nextSave: "complete",
      });
    },
  );

  it("bounds held responses, rejects cancelled/noncanonical inputs before counters and does not clear pending replies on a new session", async () => {
    const f = createResearchFollowupsFixture();
    const aborted = new AbortController();
    aborted.abort();
    await expect(f.api.loadFollowups(aborted.signal)).rejects.toThrow(
      "cancelled",
    );
    await expect(
      f.api.saveFollowups(
        { ...command(), extra: true } as ManagedResearchFollowupsCommand,
        signal(),
      ),
    ).rejects.toThrow("Invalid invented");
    expect(f.getSnapshot()).toMatchObject({ load: 0, save: 0 });
    const reads = Array.from({ length: 4 }, () => {
      f.setNextRead("hold");
      return f.api.loadFollowups(signal());
    });
    f.setNextSave("hold");
    await expect(f.api.saveFollowups(command(), signal())).rejects.toThrow(
      "queue is full",
    );
    expect(f.getSnapshot()).toMatchObject({ held: 4, save: 0, commits: 0 });
    f.nextSession();
    for (let index = 0; index < 4; index++) f.settleHeld();
    expect(await Promise.all(reads)).toHaveLength(4);
  });
});

describe("shared fixture and actual aggregate lifetime", () => {
  async function setup() {
    const fixture = await createFixture("research-followups");
    const workspace = new ManagedWorkspace(
      fixture.api,
      fixture.session,
      undefined,
      {
        priceCoverage: fixture.priceCoverage,
        marketsCohort: fixture.marketsCohort,
      },
    );
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    return { fixture, workspace, controls: fixture.followups! };
  }

  it("does not load follow-ups on mount and preserves old scenarios' fail-fast resource methods", async () => {
    const { fixture, workspace, controls } = await setup();
    expect(controls.getSnapshot()).toMatchObject({ load: 0, save: 0 });
    expect(fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 1,
      save: 0,
      resolve: 0,
      annual: 0,
      eod: 0,
      filings: 0,
    });
    workspace.sessionOwner.dispose();
    const prior = await createFixture("company-snapshot");
    expect(prior.followups).toBeNull();
    const before = prior.getSnapshot();
    await expect(prior.api.loadFollowups(signal())).rejects.toThrow(
      "explicit fixture action",
    );
    await expect(prior.api.saveFollowups(command(), signal())).rejects.toThrow(
      "explicit fixture action",
    );
    expect(prior.getSnapshot()).toBe(before);
  });

  it("a follow-up auth failure retires both real resources and discards a late held read", async () => {
    const { fixture, workspace, controls } = await setup();
    controls.setNextRead("hold");
    const late = workspace.followups.coordinator.load();
    workspace.sessionOwner.dispose();
    expect(controls.getSnapshot().aborted).toBe(1);
    const next = new ManagedWorkspace(fixture.api, controls.nextSession());
    await next.coordinator.load();
    await next.refreshCatalog();
    controls.setNextRead("retire");
    await next.followups.coordinator.load();
    expect(next.sessionOwner.getSnapshot().phase).not.toBe("active");
    expect(next.coordinator.getSnapshot().draft).toBeNull();
    expect(next.followups.coordinator.getSnapshot().draft).toBeNull();
    controls.settleHeld();
    await late;
    expect(workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(controls.getSnapshot()).toMatchObject({
      retirements: 1,
      signOut: 0,
      token: 0,
    });
    expect(fixture.getSnapshot()).toMatchObject({
      save: 0,
      annual: 0,
      eod: 0,
      filings: 0,
    });
    next.sessionOwner.dispose();
  });
});
