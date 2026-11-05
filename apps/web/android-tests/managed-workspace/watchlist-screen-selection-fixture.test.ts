import { afterEach, expect, it, vi } from "vitest";
import { encodeMainWatchlistPayload } from "@research-cockpit/contracts";
import { createFixture } from "./fixture";
import {
  portfolioScreenHeldIds,
  portfolioScreenIds,
  portfolioScreenSelectedIds,
} from "./portfolio-screen-selection-fixture-data";
import { watchlistScreenAuthoredNote } from "./watchlist-screen-selection-fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { prepareWatchlistScreenSelection } from "../../src/clerk-trial/managed-watchlist-screen-selection";
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  owners.splice(0).forEach((w) => w.sessionOwner.dispose());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
  const fixture = await createFixture("watchlist-screen-selection");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    { researchCoverage: fixture.researchCoverage },
  );
  owners.push(workspace);
  workspace.setView("watchlist");
  return {
    fixture,
    meta: fixture.watchlistScreenSelection!,
    workspace,
    signal: new AbortController().signal,
  };
}
it("loads no personal data or source until explicitly requested", async () => {
  const f = await setup();
  expect(f.meta.getSnapshot()).toEqual({
    status: 0,
    load: 0,
    save: 0,
    resolve: 0,
    annual: 0,
    rejected: 0,
    unexpected: {},
    annualRequests: [],
  });
  expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBeNull();
});
it.each([
  "loadPortfolio",
  "loadFollowups",
  "loadValuationAssumptions",
] as const)("refuses unrelated %s", async (operation) => {
  const f = await setup();
  await expect(f.fixture.api[operation](f.signal)).rejects.toThrow(
    "Unexpected invented Watchlist-company screening operation",
  );
  expect(f.meta.getSnapshot().unexpected).toEqual({ [operation]: 1 });
});
it("keeps the complete Watchlist through explicit class selection, paced Run, comparison, Research/Back and separate Review/Save/fresh Load", async () => {
  const f = await setup(),
    w = f.workspace;
  await w.refreshCatalog();
  await w.coordinator.load();
  w.note(portfolioScreenIds.apple, watchlistScreenAuthoredNote);
  const original = w.coordinator.getSnapshot();
  expect(original.dirty).toBe(true);
  expect(original.draft!.memberships.map((m) => m.listingId)).toEqual(
    portfolioScreenHeldIds,
  );
  const canonical = encodeMainWatchlistPayload(original.draft!);
  w.setView("discover");
  await w.financialScreen.loadUniverse(w.financialScreen.getSnapshot());
  const before = w.financialScreen.getSnapshot(),
    member = before.memberships.find(
      (m) => m.listing.listingId === portfolioScreenIds.googl,
    )!;
  expect(prepareWatchlistScreenSelection(w, () => true, []).preview).toBeNull();
  const preview = prepareWatchlistScreenSelection(w, () => true, [
    member,
  ]).preview!;
  expect(preview.plan.rows.map((r) => r.status)).toEqual([
    "included",
    "other_share_class",
    "included",
    "outside_cohort",
    "uncovered",
  ]);
  expect(preview.plan.members.map((m) => m.listing.listingId)).toEqual(
    portfolioScreenSelectedIds,
  );
  expect(preview.apply()).not.toBeNull();
  expect(preview.apply()).toBeNull();
  expect(w.coordinator.getSnapshot()).toBe(original);
  expect(w.financialScreen.getSnapshot().criteria).toBe(before.criteria);
  expect(f.meta.getSnapshot()).toMatchObject({
    load: 1,
    save: 0,
    resolve: 1,
    annual: 0,
    rejected: 0,
  });
  vi.useFakeTimers({
    toFake: ["Date", "setTimeout", "clearTimeout", "performance"],
  });
  const pending = w.financialScreen.run(w.financialScreen.getSnapshot());
  await vi.waitFor(() => expect(f.meta.getSnapshot().annual).toBe(1));
  await vi.advanceTimersByTimeAsync(20000);
  await pending;
  const completed = w.financialScreen.getSnapshot(),
    run = completed.run!;
  expect(run.status).toBe("completed");
  expect(run.rows.map((r) => r.report!.response)).toEqual(f.meta.packets);
  expect(run.rows.map((r) => r.failure)).toEqual([null, null]);
  expect(
    f.meta.getSnapshot().annualRequests[1]!.at -
      f.meta.getSnapshot().annualRequests[0]!.at,
  ).toBeGreaterThanOrEqual(20000);
  w.financialScreen.toggleShortlist(
    w.financialScreen.getSnapshot(),
    run.rows[0]!,
  );
  w.financialScreen.selectComparison(
    w.financialScreen.getSnapshot(),
    "left",
    run.rows[0]!,
  );
  w.financialScreen.selectComparison(
    w.financialScreen.getSnapshot(),
    "right",
    run.rows[1]!,
  );
  const compared = w.financialScreen.getSnapshot();
  expect(compared.shortlist).toEqual([run.rows[0]]);
  expect(compared.comparison).toEqual({
    left: run.rows[0],
    right: run.rows[1],
  });
  const row = run.rows[1]!,
    response = row.report!.response!;
  w.openFinancialScreenReport({ run, row, response });
  await vi.waitFor(() =>
    expect(w.annual.getSnapshot().response).toEqual(response),
  );
  expect(w.annual.getSnapshot().responseOrigin).toBe("financial-screen");
  w.closeResearch();
  expect(w.financialScreen.getSnapshot().run).toBe(run);
  expect(w.financialScreen.getSnapshot().comparison).toBe(compared.comparison);
  expect(w.financialScreen.getSnapshot().shortlist).toBe(compared.shortlist);
  expect(w.coordinator.getSnapshot()).toBe(original);
  const same = prepareWatchlistScreenSelection(w, () => true, [
    member,
  ]).preview!;
  expect(same.unchanged).toBe(true);
  expect(same.apply()).not.toBeNull();
  expect(w.financialScreen.getSnapshot().run).toBe(run);
  expect(w.financialScreen.getSnapshot().comparison).toBe(compared.comparison);
  expect(w.financialScreen.getSnapshot().shortlist).toBe(compared.shortlist);
  const alternate = w.financialScreen
    .getSnapshot()
    .memberships.find((m) => m.listing.listingId === portfolioScreenIds.goog)!;
  expect(
    prepareWatchlistScreenSelection(w, () => true, [
      alternate,
    ]).preview!.apply(),
  ).not.toBeNull();
  expect(w.financialScreen.getSnapshot()).toMatchObject({
    run: null,
    shortlist: [],
    comparison: { left: null, right: null },
  });
  expect(w.financialScreen.getSnapshot().criteria).toBe(before.criteria);
  expect(encodeMainWatchlistPayload(w.coordinator.getSnapshot().draft!)).toBe(
    canonical,
  );
  w.setView("watchlist");
  await w.reviewCatalog();
  w.applyReview();
  expect(encodeMainWatchlistPayload(w.coordinator.getSnapshot().draft!)).toBe(
    canonical,
  );
  await w.coordinator.save();
  expect(w.coordinator.getSnapshot()).toMatchObject({
    baseVersion: 4,
    dirty: false,
  });
  expect(f.meta.saved().payload).toEqual(original.draft);
  await w.coordinator.load();
  expect(w.coordinator.getSnapshot()).toMatchObject({
    baseVersion: 4,
    dirty: false,
  });
  expect(w.coordinator.getSnapshot().draft).toEqual(original.draft);
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
