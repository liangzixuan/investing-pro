import { screenPassReviewWorkspaceFixture } from "./test-screen-pass-review-workspace";
import { afterEach, expect, it, vi } from "vitest";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { createWorkspaceScreenPassReview } from "../../src/clerk-trial/financial-screen-pass-review-context";
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  owners.splice(0).forEach((w) => w.sessionOwner.dispose());
  vi.useRealTimers();
});
it("keeps both fresh reads paced when the previous pass still owns the first cooldown", async () => {
  const { meta, w, screen, resource } =
    await screenPassReviewWorkspaceFixture();
  owners.push(w);
  const original = screen.getSnapshot().run!;
  // Preview work consumes five seconds, leaving two separate pacing intervals.
  await vi.advanceTimersByTimeAsync(5000);
  const owner = createWorkspaceScreenPassReview(w, () => true);
  const preview = owner.controller.preview(owner.controller.getSnapshot())!;
  const started = performance.now();
  const pending = owner.controller.run(preview);
  const firstDelay =
    20000 - (performance.now() - meta.getSnapshot().annualRequests.at(-1)!.at);
  expect(firstDelay).toBeGreaterThan(10000);
  expect(firstDelay).toBeLessThanOrEqual(15000);
  await vi.advanceTimersByTimeAsync(firstDelay - 1);
  expect(meta.getSnapshot().annual).toBe(2);
  await vi.advanceTimersByTimeAsync(1);
  await vi.waitFor(() =>
    expect(screen.getSnapshot().run!.rows[0]!.evaluation).not.toBeNull(),
  );
  const firstReady = performance.now();
  expect(firstReady - started).toBeLessThan(30000);
  expect(meta.getSnapshot().annual).toBe(3);
  expect(screen.getSnapshot()).toMatchObject({
    pending: { kind: "waiting", member: original.rows[1]!.member },
    run: { status: "running" },
  });
  expect(screen.getSnapshot().run!.rows[0]!.report!.response).toEqual(
    meta.packets[0],
  );
  expect(screen.getSnapshot().run!.rows[1]!.report).toBeNull();
  // The former single 30-second wait expires while the correct fourth read waits.
  await vi.advanceTimersByTimeAsync(30000 - (performance.now() - started));
  expect(meta.getSnapshot().annual).toBe(3);
  expect(screen.getSnapshot().pending).toMatchObject({
    kind: "waiting",
    member: original.rows[1]!.member,
  });
  const secondDelay =
    20000 - (performance.now() - meta.getSnapshot().annualRequests.at(-1)!.at);
  expect(secondDelay).toBeGreaterThan(0);
  await vi.advanceTimersByTimeAsync(secondDelay - 1);
  expect(meta.getSnapshot().annual).toBe(3);
  await vi.advanceTimersByTimeAsync(1);
  const settled = (await pending)!;
  expect(performance.now() - firstReady).toBeLessThan(30000);
  expect(settled.result).toBe(screen.getSnapshot().run);
  expect(settled.result!.rows.map((row) => row.report!.response)).toEqual(
    meta.packets,
  );
  expect(screen.getSnapshot().pending).toBeNull();
  expect(meta.getSnapshot()).toMatchObject({
    annual: 4,
    resolve: 1,
    save: 0,
    rejected: 0,
  });
  expect(meta.getSnapshot().annualRequests.map((row) => row.symbol)).toEqual([
    "AAPL",
    "GOOGL",
    "AAPL",
    "GOOGL",
  ]);
  expect(w.coordinator.getSnapshot()).toBe(resource);
  expect(preview.plan!.sourceRun).toBe(original);
  owner.dispose();
});
it("reviews a complete fresh pass, retains source clocks through current Research/Back, and independently saves then reloads every Watchlist field", async () => {
  const { meta, w, screen, resource } =
    await screenPassReviewWorkspaceFixture();
  owners.push(w);
  const original = screen.getSnapshot().run!;
  screen.toggleShortlist(screen.getSnapshot(), original.rows[0]!);
  screen.selectComparison(screen.getSnapshot(), "left", original.rows[0]!);
  const before = screen.getSnapshot(),
    counts = meta.getSnapshot();
  const owner = createWorkspaceScreenPassReview(
    w,
    () => w.getSnapshot().view === "discover",
  );
  const controller = owner.controller;
  const preview = controller.preview(controller.getSnapshot())!;
  expect(preview.plan!.sourceRun).toBe(original);
  expect(preview.plan!.requests).toEqual(original.rows.map((r) => r.member));
  controller.cancel(preview);
  expect(await controller.run(preview)).toBeNull();
  expect(screen.getSnapshot()).toBe(before);
  expect(meta.getSnapshot()).toBe(counts);
  const next = controller.preview(controller.getSnapshot())!,
    pending = controller.run(next);
  expect(screen.getSnapshot().shortlist).toEqual([]);
  expect(screen.getSnapshot().comparison).toEqual({ left: null, right: null });
  const wait =
    20000 - (performance.now() - meta.getSnapshot().annualRequests.at(-1)!.at);
  await vi.advanceTimersByTimeAsync(wait - 1);
  expect(meta.getSnapshot().annual).toBe(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(meta.getSnapshot().annual).toBe(3);
  await vi.waitFor(() =>
    expect(screen.getSnapshot().run!.rows[0]!.evaluation).not.toBeNull(),
  );
  await vi.advanceTimersByTimeAsync(20000);
  const settled = (await pending)!;
  const current = screen.getSnapshot().run!;
  expect(settled.result).toBe(current);
  expect(current.handle).not.toBe(original.handle);
  expect(next.plan!.sourceRun).toBe(original);
  expect(current.rows.map((r) => r.report!.response)).toEqual(meta.packets);
  expect(original.rows.map((r) => r.report!.response)).toEqual(meta.packets);
  expect(current.rows.map((r) => r.evaluation)).toEqual(
    original.rows.map((r) => r.evaluation),
  );
  expect(current.rows.map((r) => r.evaluation!.match)).toEqual([
    "match",
    "unknown",
  ]);
  expect(current.startedAt).not.toBe(original.startedAt);
  expect(current.completedAt).not.toBe(original.completedAt);
  expect(current.rows[0]!.report!.response!.evidence.generation).toEqual(
    original.rows[0]!.report!.response!.evidence.generation,
  );
  expect(meta.getSnapshot().annualRequests.map((r) => r.symbol)).toEqual([
    "AAPL",
    "GOOGL",
    "AAPL",
    "GOOGL",
  ]);
  for (let i = 1; i < 4; i++)
    expect(
      meta.getSnapshot().annualRequests[i]!.at -
        meta.getSnapshot().annualRequests[i - 1]!.at,
    ).toBeGreaterThanOrEqual(20000);
  expect(meta.getSnapshot()).toMatchObject({
    annual: 4,
    resolve: 1,
    save: 0,
    rejected: 0,
    unexpected: {},
  });
  expect(w.coordinator.getSnapshot()).toBe(resource);
  const old = original.rows[0]!;
  w.openFinancialScreenReport({
    run: original,
    row: old,
    response: old.report!.response!,
  });
  expect(w.getSnapshot().research).toBeNull();
  const row = current.rows[1]!,
    response = row.report!.response!;
  w.openFinancialScreenReport({ run: current, row, response });
  await vi.waitFor(() =>
    expect(w.annual.getSnapshot().response).toEqual(response),
  );
  expect(w.annual.getSnapshot().responseOrigin).toBe("financial-screen");
  expect(w.getSnapshot().research!.selection).toMatchObject({
    listing: row.member.listing,
    origin: "screening",
  });
  w.closeResearch();
  expect(screen.getSnapshot().run).toBe(current);
  expect(controller.getSnapshot()).toBe(settled);
  screen.toggleShortlist(screen.getSnapshot(), row);
  expect(screen.getSnapshot().shortlist).toEqual([row]);
  expect(w.coordinator.getSnapshot()).toBe(resource);
  w.setView("watchlist");
  await w.reviewCatalog();
  w.applyReview();
  expect(meta.getSnapshot()).toMatchObject({ annual: 4, resolve: 2, save: 0 });
  await w.coordinator.save();
  await w.coordinator.load();
  expect(w.coordinator.getSnapshot()).toMatchObject({
    baseVersion: 4,
    dirty: false,
    draft: resource.draft,
  });
  expect(meta.saved().payload).toEqual(resource.draft);
  expect(meta.getSnapshot()).toMatchObject({
    load: 2,
    save: 1,
    annual: 4,
    resolve: 2,
    rejected: 0,
    unexpected: {},
  });
  expect(w.portfolio.coordinator.getSnapshot().draft).toBeNull();
  expect(w.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(w.valuationAssumptions.coordinator.getSnapshot().draft).toBeNull();
  owner.dispose();
});
