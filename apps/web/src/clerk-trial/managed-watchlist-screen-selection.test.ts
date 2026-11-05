import { afterEach, expect, it, vi } from "vitest";
import {
  getWatchlistScreenSelection,
  prepareWatchlistScreenSelection,
} from "./managed-watchlist-screen-selection";
import {
  watchlistScreenFixture,
  watchlistScreenListing,
} from "./test-watchlist-screen-selection-fixture";
import { TrialApiError } from "./api";
import { watchlistScreenCatalog } from "./test-watchlist-screen-selection-fixture";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";
const fixtures: Awaited<ReturnType<typeof watchlistScreenFixture>>[] = [];
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.restoreAllMocks();
});
async function fixture(load = true, cohort = true) {
  const f = await watchlistScreenFixture(load, cohort);
  fixtures.push(f);
  return f;
}
const route = () => true;
function prepare(f: Awaited<ReturnType<typeof fixture>>, alternate = true) {
  const result = prepareWatchlistScreenSelection(f.workspace, route, [
    f.choice(alternate),
  ]);
  expect(result.reason).toBeNull();
  expect(result.preview).not.toBeNull();
  return result.preview!;
}
it("applies once atomically without changing dirty Watchlist, resource versions, criteria or calling a source", async () => {
  const f = await fixture();
  const w = f.workspace;
  const saved = w.coordinator.getSnapshot();
  const raw = JSON.stringify(saved.draft);
  const before = w.financialScreen.getSnapshot();
  const preview = prepare(f);
  const notify = vi.fn();
  const off = w.financialScreen.subscribe(notify);
  const applied = preview.apply();
  expect(applied?.isCurrent()).toBe(true);
  expect(preview.apply()).toBeNull();
  expect(notify).toHaveBeenCalledTimes(1);
  off();
  expect(w.financialScreen.getSnapshot().selected).toEqual([f.choice()]);
  expect(w.financialScreen.getSnapshot().criteria).toBe(before.criteria);
  expect(w.financialScreen.getSnapshot().criteriaRevision).toBe(
    before.criteriaRevision,
  );
  expect(w.coordinator.getSnapshot()).toBe(saved);
  expect(saved.dirty).toBe(true);
  expect(JSON.stringify(saved.draft)).toBe(raw);
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.save).not.toHaveBeenCalled();
  expect(f.api.loadPortfolio).not.toHaveBeenCalled();
});
it("preserves an identical ordered run and source response, and changed selection retires it", async () => {
  const f = await fixture();
  const w = f.workspace;
  const response = await annualComparisonResponse("left");
  f.api.annualReport.mockResolvedValue(response);
  await w.financialScreen.run(w.financialScreen.getSnapshot());
  const before = w.financialScreen.getSnapshot();
  expect(before.run!.rows[0]!.report!.response).toBe(response);
  const same = prepare(f, false);
  expect(same.unchanged).toBe(true);
  expect(same.apply()?.unchanged).toBe(true);
  expect(w.financialScreen.getSnapshot()).toBe(before);
  expect(prepare(f).apply()?.unchanged).toBe(false);
  expect(w.financialScreen.getSnapshot().run).toBeNull();
  expect(f.api.annualReport).toHaveBeenCalledTimes(1);
  expect(f.api.save).not.toHaveBeenCalled();
});
it.each([
  "same view",
  "navigation ABA",
  "view ABA",
  "file ABA",
  "draft ABA",
  "criteria ABA",
  "selection ABA",
  "session",
])("permanently refuses stale preview after %s", async (kind) => {
  const f = await fixture();
  const w = f.workspace;
  const preview = prepare(f);
  const original = w.coordinator.getSnapshot().draft!.memberships[0]!;
  if (kind === "same view") w.setView("discover");
  if (kind === "navigation ABA") {
    w.setNavigationBlocked(true);
    w.setNavigationBlocked(false);
  }
  if (kind === "view ABA") {
    w.setView("watchlist");
    w.setView("discover");
  }
  if (kind === "file ABA") {
    const owner = {};
    w.beginWatchlistDraftFileActivity(owner);
    w.endWatchlistDraftFileActivity(owner);
  }
  if (kind === "draft ABA") {
    w.note(original.listingId, "changed");
    w.note(original.listingId, original.note);
  }
  if (kind === "criteria ABA") {
    const s = w.financialScreen.getSnapshot();
    w.financialScreen.stageCriteria(s);
    w.financialScreen.setCriteria(w.financialScreen.getSnapshot(), s.criteria);
  }
  if (kind === "selection ABA") {
    const s = w.financialScreen.getSnapshot();
    w.financialScreen.applyCompanySelection(s, [f.choice()]);
    w.financialScreen.applyCompanySelection(
      w.financialScreen.getSnapshot(),
      s.selected,
    );
  }
  if (kind === "session") w.sessionOwner.dispose();
  const current = w.financialScreen.getSnapshot();
  expect(preview.isCurrent()).toBe(false);
  expect(preview.apply()).toBeNull();
  expect(w.financialScreen.getSnapshot()).toBe(current);
});
it("refuses unloaded, staged, busy-file and cancelled previews", async () => {
  const f = await fixture(false, false);
  const w = f.workspace;
  expect(prepareWatchlistScreenSelection(w, route, []).preview).toBeNull();
  await w.coordinator.load();
  expect(getWatchlistScreenSelection(w, route, []).reason).not.toBeNull();
  await w.financialScreen.loadUniverse(w.financialScreen.getSnapshot());
  const owner = {};
  w.beginWatchlistDraftFileActivity(owner);
  expect(
    prepareWatchlistScreenSelection(w, route, [f.choice()]).preview,
  ).toBeNull();
  w.endWatchlistDraftFileActivity(owner);
  const preview = prepare(f);
  preview.cancel();
  expect(preview.apply()).toBeNull();
  w.financialScreen.stageCriteria(w.financialScreen.getSnapshot());
  expect(getWatchlistScreenSelection(w, route, []).reason).toMatch(/criteria/i);
});
it("consumes before reentrant notifications and never reports success for a replaced route", async () => {
  const f = await fixture();
  const w = f.workspace;
  const preview = prepare(f);
  const second = vi.fn();
  const off = w.financialScreen.subscribe(() => {
    second(preview.apply());
    w.setNavigationBlocked(true);
  });
  expect(preview.apply()).toBeNull();
  expect(second).toHaveBeenCalledWith(null);
  off();
  expect(w.financialScreen.getSnapshot().selected).toEqual([f.choice()]);
  expect(f.api.save).not.toHaveBeenCalled();
});
it("retires on explicit Save and fresh Load while preserving their independent versions", async () => {
  const f = await fixture();
  const w = f.workspace;
  const savedRaw = JSON.stringify(w.coordinator.getSnapshot().draft);
  const preview = prepare(f);
  await w.coordinator.save();
  expect(preview.apply()).toBeNull();
  expect(f.api.save).toHaveBeenCalledTimes(1);
  expect(f.saved().version).toBe(4);
  expect(f.saved().payload).toEqual(JSON.parse(savedRaw));
  expect(getWatchlistScreenSelection(w, route, [f.choice()]).reason).toMatch(
    /load/i,
  );
  await w.coordinator.load();
  const next = prepare(f);
  await w.coordinator.load();
  expect(next.apply()).toBeNull();
  expect(w.coordinator.getSnapshot().draft!.memberships[0]!.listingId).toBe(
    watchlistScreenListing.listingId,
  );
  expect(f.api.annualReport).not.toHaveBeenCalled();
});

it.each(["conflict", "unavailable"] as const)(
  "refuses selection during Watchlist %s recovery",
  async (code) => {
    const f = await fixture();
    const preview = prepare(f);
    f.api.save.mockRejectedValueOnce(new TrialApiError(code));
    await f.workspace.coordinator.save();
    expect(
      prepareWatchlistScreenSelection(f.workspace, route, [f.choice()]).preview,
    ).toBeNull();
    expect(preview.apply()).toBeNull();
    const state = f.workspace.coordinator.getSnapshot();
    expect(code === "conflict" ? state.conflict : state.uncertain).toBe(true);
    expect(f.api.annualReport).not.toHaveBeenCalled();
  },
);
it("retires on catalog replacement even with the same digest, and refuses catalog mismatch", async () => {
  const f = await fixture();
  const preview = prepare(f);
  f.api.status.mockResolvedValueOnce({
    snapshot: { ...watchlistScreenCatalog, catalogVersion: "next" },
  });
  await f.workspace.refreshCatalog();
  expect(preview.apply()).toBeNull();
  f.api.status.mockResolvedValueOnce({
    snapshot: {
      ...watchlistScreenCatalog,
      snapshotSha256: `sha256:${"b".repeat(64)}`,
    },
  });
  await f.workspace.refreshCatalog();
  expect(
    prepareWatchlistScreenSelection(f.workspace, route, []).preview,
  ).toBeNull();
});
it("permanently retires a route callback refusal and a reentrant replacement selection", async () => {
  const f = await fixture();
  let active = true;
  const preview = prepareWatchlistScreenSelection(f.workspace, () => active, [
    f.choice(),
  ]).preview!;
  expect(preview).not.toBeNull();
  active = false;
  expect(preview.isCurrent()).toBe(false);
  active = true;
  expect(preview.apply()).toBeNull();
  const next = prepare(f);
  const off = f.workspace.financialScreen.subscribe(() => {
    off();
    f.workspace.financialScreen.select(
      f.workspace.financialScreen.getSnapshot(),
      f.choice(),
      false,
    );
  });
  expect(next.apply()).toBeNull();
  expect(next.apply()).toBeNull();
  expect(f.workspace.financialScreen.getSnapshot().selected).toEqual([]);
});
