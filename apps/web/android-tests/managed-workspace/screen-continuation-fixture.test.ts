import { afterEach, expect, it, vi } from "vitest";
import { createFixture } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { prepareWatchlistScreenSelection } from "../../src/clerk-trial/managed-watchlist-screen-selection";
import { portfolioScreenIds } from "./portfolio-screen-selection-fixture-data";
import { watchlistScreenAuthoredNote } from "./watchlist-screen-selection-fixture";

const owners: ManagedWorkspace[] = [];
afterEach(() => {
  owners.splice(0).forEach((w) => w.sessionOwner.dispose());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const criteria = (value: string) => ({
  clauses: [
    { field: "operatingCashFlow" as const, operator: "gte" as const, value },
  ],
  sort: { field: "symbol" as const, direction: "asc" as const },
});
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T08:00:00Z"));
  const fixture = await createFixture("screen-continuation");
  const w = new ManagedWorkspace(fixture.api, fixture.session, undefined, {
    researchCoverage: fixture.researchCoverage,
  });
  owners.push(w);
  w.setView("watchlist");
  await w.refreshCatalog();
  await w.coordinator.load();
  w.note(portfolioScreenIds.apple, watchlistScreenAuthoredNote);
  const resource = w.coordinator.getSnapshot();
  w.setView("discover");
  const screen = w.financialScreen;
  await screen.loadUniverse(screen.getSnapshot());
  screen.setCriteria(screen.getSnapshot(), criteria("0.00"));
  const member = screen
    .getSnapshot()
    .memberships.find((m) => m.listing.listingId === portfolioScreenIds.googl)!;
  expect(
    prepareWatchlistScreenSelection(w, () => true, [member]).preview!.apply(),
  ).not.toBeNull();
  vi.useFakeTimers({
    toFake: ["Date", "setTimeout", "clearTimeout", "performance"],
  });
  return {
    w,
    screen,
    fixture,
    meta: fixture.watchlistScreenSelection!,
    resource,
  };
}

async function cancelledRun() {
  const f = await setup();
  const pending = f.screen.run(f.screen.getSnapshot());
  await vi.waitFor(() =>
    expect(f.screen.getSnapshot().run?.rows[0]?.evaluation).not.toBeNull(),
  );
  f.screen.cancel();
  await pending;
  expect(f.meta.getSnapshot().annual).toBe(1);
  expect(f.screen.getSnapshot().run!.status).toBe("cancelled");
  return f;
}

it("explicitly reads only the missing Annual packet, keeps original evidence through Research/Back, and separately saves the unchanged Watchlist draft", async () => {
  const f = await cancelledRun(),
    { w, screen } = f;
  const original = screen.getSnapshot(),
    originalRun = original.run!;
  const retained = originalRun.rows[0]!;
  const counts = f.meta.getSnapshot();
  const preview = screen.captureContinuation(
    original,
    "2026-11-05T08:00:01.000Z",
  )!;
  expect(preview).not.toBeNull();
  expect(preview.plan.requests.map((m) => m.listing.listingId)).toEqual([
    portfolioScreenIds.googl,
  ]);
  expect(preview.plan.rows.map((row) => row.disposition)).toEqual([
    "retained",
    "missing",
  ]);
  expect(screen.getSnapshot()).toBe(original);
  expect(f.meta.getSnapshot()).toBe(counts);
  preview.cancel();
  expect(await preview.run()).toBeNull();
  expect(screen.getSnapshot()).toBe(original);
  const selected = screen.captureContinuation(
    original,
    "2026-11-05T08:00:02.000Z",
  )!;
  const pending = selected.run();
  expect(await selected.run()).toBeNull();
  await vi.advanceTimersByTimeAsync(20000);
  await pending;
  const current = screen.getSnapshot(),
    run = current.run!;
  expect(run.rows.map((row) => row.report!.response)).toEqual(f.meta.packets);
  expect(run.rows[0]!.report).toBe(retained.report);
  expect(run.rows[0]!.evaluation).toBe(retained.evaluation);
  expect(run.handle).toBe(originalRun.handle);
  expect(run.startedAt).toBe(originalRun.startedAt);
  expect(run.completedAt).toBe(originalRun.completedAt);
  expect(run.status).toBe(originalRun.status);
  expect(run.rows.map((row) => row.evaluation!.match)).toEqual([
    "match",
    "unknown",
  ]);
  expect(screen.canContinue(current)).toBe(false);
  expect(w.coordinator.getSnapshot()).toBe(f.resource);
  const row = run.rows[1]!,
    response = row.report!.response!;
  w.openFinancialScreenReport({ run, row, response });
  await vi.waitFor(() =>
    expect(w.annual.getSnapshot().response).toEqual(response),
  );
  expect(w.annual.getSnapshot().responseOrigin).toBe("financial-screen");
  w.closeResearch();
  expect(screen.getSnapshot().run).toBe(run);
  expect(f.meta.getSnapshot().annual).toBe(2);
  w.setView("watchlist");
  await w.reviewCatalog();
  w.applyReview();
  await w.coordinator.save();
  await w.coordinator.load();
  expect(w.coordinator.getSnapshot()).toMatchObject({
    baseVersion: 4,
    dirty: false,
  });
  expect(w.coordinator.getSnapshot().draft).toEqual(f.resource.draft);
  expect(f.meta.saved().payload).toEqual(f.resource.draft);
  expect(f.meta.getSnapshot()).toMatchObject({
    status: 1,
    load: 2,
    save: 1,
    resolve: 2,
    annual: 2,
    rejected: 0,
    unexpected: {},
  });
  expect(w.portfolio.coordinator.getSnapshot().draft).toBeNull();
  expect(w.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(w.valuationAssumptions.coordinator.getSnapshot().draft).toBeNull();
});

it("cancels an explicit continuation during pacing without reloading retained evidence, then requires a fresh preview", async () => {
  const f = await cancelledRun(),
    screen = f.screen;
  const original = screen.getSnapshot(),
    retained = original.run!.rows[0]!;
  const preview = screen.captureContinuation(
    original,
    "2026-11-05T08:00:01.000Z",
  )!;
  const pending = preview.run();
  screen.cancel();
  await pending;
  await vi.advanceTimersByTimeAsync(20000);
  expect(f.meta.getSnapshot().annual).toBe(1);
  expect(screen.getSnapshot().run!.rows[0]!.report).toBe(retained.report);
  expect(screen.getSnapshot().run!.rows[1]!.report).toBeNull();
  expect(await preview.run()).toBeNull();
  const next = screen.captureContinuation(
    screen.getSnapshot(),
    "2026-11-05T08:00:21.000Z",
  )!;
  expect(next.plan.requests.map((m) => m.listing.listingId)).toEqual([
    portfolioScreenIds.googl,
  ]);
  await next.run();
  expect(f.meta.getSnapshot().annual).toBe(2);
  expect(screen.getSnapshot().run!.rows[0]!.report).toBe(retained.report);
  expect(screen.getSnapshot().run!.rows[1]!.report!.response).toEqual(
    f.meta.packets[1],
  );
  expect(f.w.coordinator.getSnapshot()).toBe(f.resource);
});
