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
  const fixture = await createFixture("screen-refinement");
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

it("compares and applies revised filters on the same complete packets, then Research/Back and separate Save/fresh Load", async () => {
  const f = await setup(),
    { w, screen } = f;
  const pending = screen.run(screen.getSnapshot());
  await vi.waitFor(() => expect(f.meta.getSnapshot().annual).toBe(1));
  await vi.advanceTimersByTimeAsync(20000);
  await pending;
  const originalRun = screen.getSnapshot().run!;
  expect(originalRun.rows.map((row) => row.report!.response)).toEqual(
    f.meta.packets,
  );
  expect(originalRun.rows.map((row) => row.evaluation!.match)).toEqual([
    "match",
    "unknown",
  ]);
  screen.toggleShortlist(screen.getSnapshot(), originalRun.rows[0]!);
  screen.selectComparison(screen.getSnapshot(), "left", originalRun.rows[0]!);
  screen.selectComparison(screen.getSnapshot(), "right", originalRun.rows[1]!);
  const original = screen.getSnapshot(),
    counts = f.meta.getSnapshot();
  const preview = screen.captureRefinement(
    original,
    criteria("1100.00"),
    "2026-11-05T09:00:00.000Z",
  )!;
  expect(preview).not.toBeNull();
  expect(screen.getSnapshot()).toBe(original);
  expect(f.meta.getSnapshot()).toBe(counts);
  preview.cancel();
  expect(preview.apply()).toBeNull();
  expect(screen.getSnapshot()).toBe(original);

  const revised = screen.captureRefinement(
    original,
    criteria("1100.00"),
    "2026-11-05T09:01:00.000Z",
  )!;
  expect(revised.apply()).not.toBeNull();
  expect(revised.apply()).toBeNull();
  const current = screen.getSnapshot(),
    run = current.run!;
  expect(current.criteria).toEqual(criteria("1100.00"));
  expect(current.criteriaStaged).toBe(false);
  expect(current.shortlist).toEqual([]);
  expect(current.comparison).toEqual({ left: null, right: null });
  expect(run.rows.map((row) => row.evaluation!.match)).toEqual([
    "nonmatch",
    "unknown",
  ]);
  expect(run.handle).toBe(originalRun.handle);
  expect(run.startedAt).toBe(originalRun.startedAt);
  expect(run.completedAt).toBe(originalRun.completedAt);
  expect(run.status).toBe(originalRun.status);
  expect(run.refinedAt).toBe("2026-11-05T09:01:00.000Z");
  for (const [i, row] of run.rows.entries()) {
    expect(row.report).toBe(originalRun.rows[i]!.report);
    expect(row.report!.response).toEqual(f.meta.packets[i]);
    expect(row.evaluation!.metrics).toEqual(
      originalRun.rows[i]!.evaluation!.metrics,
    );
    expect(row.failure).toBe(originalRun.rows[i]!.failure);
  }
  expect(f.meta.getSnapshot()).toBe(counts);
  expect(w.coordinator.getSnapshot()).toBe(f.resource);

  screen.toggleShortlist(screen.getSnapshot(), run.rows[0]!);
  const shortlisted = screen.getSnapshot();
  const same = screen.captureRefinement(
    shortlisted,
    criteria("1100.00"),
    "2026-11-05T09:02:00.000Z",
  )!;
  expect(same.apply()).not.toBeNull();
  expect(screen.getSnapshot()).toBe(shortlisted);
  expect(screen.getSnapshot().run).toBe(run);
  const row = run.rows[1]!,
    response = row.report!.response!;
  w.openFinancialScreenReport({ run, row, response });
  await vi.waitFor(() =>
    expect(w.annual.getSnapshot().response).toEqual(response),
  );
  expect(w.annual.getSnapshot().responseOrigin).toBe("financial-screen");
  w.closeResearch();
  expect(screen.getSnapshot().run).toBe(run);
  expect(screen.getSnapshot().shortlist).toBe(shortlisted.shortlist);
  expect(f.meta.getSnapshot()).toBe(counts);
  expect(w.coordinator.getSnapshot()).toBe(f.resource);

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

it("refuses pending source work and preserves unread rows after an explicit cancellation", async () => {
  const f = await setup(),
    screen = f.screen;
  const pending = screen.run(screen.getSnapshot());
  await vi.waitFor(() =>
    expect(screen.getSnapshot().run?.rows[0]?.evaluation).not.toBeNull(),
  );
  expect(
    screen.captureRefinement(
      screen.getSnapshot(),
      criteria("950"),
      "2026-11-05T09:00:00.000Z",
    ),
  ).toBeNull();
  screen.cancel();
  await pending;
  const before = screen.getSnapshot().run!,
    counts = f.meta.getSnapshot();
  expect(before.status).toBe("cancelled");
  expect(before.rows[1]!.report).toBeNull();
  const preview = screen.captureRefinement(
    screen.getSnapshot(),
    criteria("1100"),
    "2026-11-05T09:01:00.000Z",
  )!;
  expect(preview.apply()).not.toBeNull();
  const after = screen.getSnapshot().run!;
  expect(after.status).toBe("cancelled");
  expect(after.rows[0]!.evaluation!.match).toBe("nonmatch");
  expect(after.rows[0]!.report).toBe(before.rows[0]!.report);
  expect(after.rows[1]!.report).toBeNull();
  expect(after.rows[1]!.evaluation).toBeNull();
  expect(after.rows[1]!.failure).toBe(before.rows[1]!.failure);
  expect(f.meta.getSnapshot()).toBe(counts);
  expect(f.meta.getSnapshot().annual).toBe(1);
});
