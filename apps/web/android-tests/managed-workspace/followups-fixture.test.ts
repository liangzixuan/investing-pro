import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ManagedResearchFollowupsCommand } from "@research-cockpit/contracts";
import { createFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ManagedDailyResearchReview } from "../../src/clerk-trial/ManagedDailyResearchReview";

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

  function dailyReview(workspace: ManagedWorkspace) {
    return renderToStaticMarkup(
      createElement(ManagedDailyResearchReview, {
        workspace,
        navigationPending: false,
        isCurrent: () => workspace.getSnapshot().view === "markets",
        onReview: () => undefined,
        onManage: () => undefined,
      }),
    );
  }

  it("reviews the actual due draft with the shared captured day and leaves both resources unsaved", async () => {
    const { fixture, workspace, controls } = await setup();
    await workspace.followups.coordinator.load();
    workspace.note("listing-zero", "Independent draft α 日本語  ");
    const watchlist = workspace.coordinator.getSnapshot().draft!;
    const clock = new Date("2026-10-16T00:01:00.000Z");
    workspace.followups.reassessDueDate(clock);
    workspace.followups.add(watchlist.memberships[0]!, "2026-10-16");
    const id = workspace.followups.getSnapshot().selectedId!;
    workspace.followups.edit(
      workspace.followups.currentEntry(id)!,
      "check",
      "Review ZERO Δ  ",
    );
    workspace.followups.edit(
      workspace.followups.currentEntry(id)!,
      "result",
      "Keep raw result  ",
    );
    workspace.followups.setFilter("completed");
    const entry = workspace.followups.currentEntry(id)!;
    const draft = workspace.followups.coordinator.getSnapshot().draft!;
    const requests = fixture.getSnapshot();
    const followupRequests = controls.getSnapshot();
    const local = workspace.followups.getSnapshot();

    clock.setUTCDate(17);
    const html = dailyReview(workspace);
    expect(html).toContain('dateTime="2026-10-16"');
    expect(html).toContain('aria-label="Due today"');
    expect(html).toContain("Review ZERO Δ  ");
    expect(html).toContain("Due 2026-10-16");
    expect(html).toContain(`id="managed-daily-review-${id}"`);
    expect(html).toContain("Class A · XNAS · Common stock");
    expect(workspace.followups.getSnapshot()).toBe(local);
    expect(workspace.reviewFollowup(entry, () => false)).toBeNull();
    expect(workspace.followups.getSnapshot()).toBe(local);
    expect(workspace.getSnapshot().view).toBe("markets");

    const review = workspace.reviewFollowup(entry, () => {
      workspace.setView("followups");
      return true;
    });
    expect(review).toMatchObject({ entry, draft });
    expect(review?.entry).toBe(entry);
    expect(review?.draft).toBe(draft);
    expect(review?.isCurrent()).toBe(true);
    expect(workspace.followups.getSnapshot()).toMatchObject({
      selectedId: id,
      filter: "open",
      assessmentTime: Date.parse("2026-10-16T00:01:00.000Z"),
    });
    expect(workspace.coordinator.getSnapshot().draft).toBe(watchlist);
    expect(workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
    expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
    expect(workspace.followups.coordinator.getSnapshot().dirty).toBe(true);
    expect(fixture.getSnapshot()).toEqual(requests);
    expect(controls.getSnapshot()).toEqual(followupRequests);
    expect(followupRequests).toMatchObject({ load: 1, save: 0, commits: 0 });

    workspace.followups.edit(entry, "dueOn", "2026-02-30 ");
    expect(workspace.followups.currentEntry(id)).toMatchObject({
      dueOn: "2026-02-30 ",
      check: "Review ZERO Δ  ",
      result: "Keep raw result  ",
    });
    expect(entry.dueOn).toBe("2026-10-16");
    expect(review?.isCurrent()).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(watchlist);
    expect(controls.getSnapshot()).toEqual(followupRequests);
    workspace.sessionOwner.dispose();
  });

  it("keeps the due draft after an explicit failed load and clears its clock and late reply on retirement", async () => {
    const { fixture, workspace, controls } = await setup();
    await workspace.followups.coordinator.load();
    workspace.note("listing-zero", "Retained separate draft  ");
    const watchlist = workspace.coordinator.getSnapshot().draft!;
    workspace.followups.reassessDueDate(new Date("2026-10-16T23:59:00.000Z"));
    workspace.followups.add(watchlist.memberships[0]!, "2026-10-16");
    const id = workspace.followups.getSnapshot().selectedId!;
    workspace.followups.edit(
      workspace.followups.currentEntry(id)!,
      "check",
      "Inspect this authored check 日本語  ",
    );
    const draft = workspace.followups.coordinator.getSnapshot().draft!;
    const requests = fixture.getSnapshot();
    controls.setNextRead("fail");
    await workspace.followups.coordinator.load();
    expect(workspace.followups.coordinator.getSnapshot()).toMatchObject({
      phase: "idle",
      baseVersion: 0,
      dirty: true,
    });
    expect(workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
    expect(workspace.coordinator.getSnapshot().draft).toBe(watchlist);
    expect(dailyReview(workspace)).toContain(
      "Inspect this authored check 日本語  ",
    );
    expect(dailyReview(workspace)).toContain('dateTime="2026-10-16"');
    expect(controls.getSnapshot()).toMatchObject({
      load: 2,
      save: 0,
      commits: 0,
    });

    controls.setNextRead("hold");
    const late = workspace.followups.coordinator.load();
    workspace.sessionOwner.dispose();
    expect(controls.getSnapshot()).toMatchObject({
      load: 3,
      aborted: 1,
      held: 1,
    });
    expect(workspace.followups.getSnapshot().assessmentTime).toBeNull();
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    controls.settleHeld();
    await late;
    expect(workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(workspace.followups.getSnapshot().assessmentTime).toBeNull();
    const retired = dailyReview(workspace);
    expect(retired).not.toContain("Inspect this authored check");
    expect(retired).not.toContain(`managed-daily-review-${id}`);
    expect(fixture.getSnapshot()).toEqual(requests);
    expect(controls.getSnapshot()).toMatchObject({
      load: 3,
      save: 0,
      commits: 0,
      settled: 1,
      held: 0,
      signOut: 0,
      token: 0,
    });
  });

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
