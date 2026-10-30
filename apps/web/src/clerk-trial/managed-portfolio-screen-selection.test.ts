import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  getPortfolioScreenSelection,
  preparePortfolioScreenSelection,
} from "./managed-portfolio-screen-selection";
import {
  portfolioScreenFixture,
  portfolioScreenAlternate,
  portfolioScreenListing,
  portfolioScreenCatalog,
} from "./test-portfolio-screen-selection-fixture";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";

const fixtures: Awaited<ReturnType<typeof portfolioScreenFixture>>[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
});
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function fixture(loadPortfolio = true, loadCohort = true) {
  const f = await portfolioScreenFixture(loadPortfolio, loadCohort);
  fixtures.push(f);
  return f;
}
const route = () => true;
function prepare(f: Awaited<ReturnType<typeof fixture>>, alternate = true) {
  const result = preparePortfolioScreenSelection(f.workspace, route, [
    f.choice(alternate),
  ]);
  expect(result.reason).toBeNull();
  expect(result.preview).not.toBeNull();
  return result.preview!;
}

it("previews every exact holding and changes selection once without touching dirty Portfolio or criteria", async () => {
  const f = await fixture();
  const saved = f.workspace.portfolio.coordinator.getSnapshot();
  const raw = JSON.stringify(saved.draft);
  expect(saved.dirty).toBe(true);
  expect(
    getPortfolioScreenSelection(f.workspace, route, []).plan.choiceGroups[0]
      ?.selected,
  ).toBeNull();
  expect(
    preparePortfolioScreenSelection(f.workspace, route, []).preview,
  ).toBeNull();
  const screen = f.workspace.financialScreen.getSnapshot();
  const preview = prepare(f);
  expect(preview.plan.rows.map((row) => row.status)).toEqual([
    "other_share_class",
    "included",
    "outside_cohort",
  ]);
  expect(preview.plan.rows.map((row) => row.holding.shares)).toEqual([
    "2.000001",
    "2.000001",
    "2.000001",
  ]);
  const notifications = vi.fn();
  const off = f.workspace.financialScreen.subscribe(notifications);
  const applied = preview.apply();
  expect(applied?.isCurrent()).toBe(true);
  expect(preview.apply()).toBeNull();
  expect(notifications).toHaveBeenCalledTimes(1);
  off();
  const after = f.workspace.financialScreen.getSnapshot();
  expect(after.selected.map((member) => member.listing)).toEqual([
    portfolioScreenAlternate,
  ]);
  expect(after.criteria).toBe(screen.criteria);
  expect(after.criteriaRevision).toBe(screen.criteriaRevision);
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(saved);
  expect(JSON.stringify(saved.draft)).toBe(raw);
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.unexpected).not.toHaveBeenCalled();
});

it("keeps an identical ordered selection and its run, then Research/Back retains the same packet and Portfolio", async () => {
  const f = await fixture();
  const saved = f.workspace.portfolio.coordinator.getSnapshot();
  const preview = prepare(f, false);
  const before = f.workspace.financialScreen.getSnapshot();
  expect(preview.unchanged).toBe(true);
  expect(preview.apply()?.unchanged).toBe(true);
  expect(f.workspace.financialScreen.getSnapshot()).toBe(before);
  const response = await annualComparisonResponse("left");
  f.api.annualReport.mockResolvedValue(response);
  expect(f.api.annualReport).not.toHaveBeenCalled();
  await f.workspace.financialScreen.run(before);
  expect(f.api.annualReport).toHaveBeenCalledTimes(1);
  const screen = f.workspace.financialScreen.getSnapshot();
  const row = screen.run!.rows[0]!;
  expect(row.report?.response).toBe(response);
  const same = prepare(f, false);
  expect(same.apply()?.unchanged).toBe(true);
  expect(f.workspace.financialScreen.getSnapshot()).toBe(screen);
  f.workspace.openFinancialScreenReport({ run: screen.run!, row, response });
  expect(f.workspace.getSnapshot().research?.selection.listing.listingId).toBe(
    portfolioScreenListing.listingId,
  );
  f.workspace.closeResearch();
  expect(f.workspace.getSnapshot().view).toBe("discover");
  expect(f.workspace.financialScreen.getSnapshot().run).toBe(screen.run);
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(saved);
  expect(f.api.annualReport).toHaveBeenCalledTimes(1);
});

it.each([
  "same view",
  "navigation ABA",
  "view ABA",
  "file ABA",
  "editor ABA",
  "criteria ABA",
  "draft ABA",
])("permanently retires a preview after %s", async (kind) => {
  const f = await fixture();
  const preview = prepare(f);
  const { workspace: w } = f;
  const draft = w.portfolio.coordinator.getSnapshot().draft!;
  if (kind === "same view") w.setView("discover");
  if (kind === "navigation ABA") {
    w.setNavigationBlocked(true);
    w.setNavigationBlocked(false);
  }
  if (kind === "view ABA") {
    w.setView("portfolio");
    w.setView("discover");
  }
  if (kind === "file ABA") {
    const owner = {};
    w.portfolio.beginDraftFileActivity(owner);
    w.portfolio.endDraftFileActivity(owner);
  }
  if (kind === "editor ABA") {
    w.portfolio.setPendingEditor(draft, true);
    w.portfolio.setPendingEditor(draft, false);
  }
  if (kind === "criteria ABA") {
    const screen = w.financialScreen.getSnapshot();
    w.financialScreen.stageCriteria(screen);
    w.financialScreen.setCriteria(
      w.financialScreen.getSnapshot(),
      screen.criteria,
    );
  }
  if (kind === "draft ABA") {
    w.portfolio.replace(draft, {
      ...draft.ledger!,
      opening: { ...draft.ledger!.opening, cashUsd: "2" },
    });
    w.portfolio.replace(
      w.portfolio.coordinator.getSnapshot().draft!,
      draft.ledger!,
    );
  }
  const current = w.financialScreen.getSnapshot();
  expect(preview.isCurrent()).toBe(false);
  expect(preview.apply()).toBeNull();
  expect(w.financialScreen.getSnapshot()).toBe(current);
});

it("refuses unloaded resources, staged criteria and pending file activity without source reads", async () => {
  const f = await fixture(false, false);
  expect(getPortfolioScreenSelection(f.workspace, route, []).reason).toMatch(
    /load/i,
  );
  expect(
    preparePortfolioScreenSelection(f.workspace, route, []).preview,
  ).toBeNull();
  await f.workspace.portfolio.coordinator.load();
  await f.workspace.portfolio.reviewCatalog();
  f.workspace.portfolio.applyReview();
  expect(getPortfolioScreenSelection(f.workspace, route, []).reason).toMatch(
    /cohort/i,
  );
  await f.workspace.financialScreen.loadUniverse(
    f.workspace.financialScreen.getSnapshot(),
  );
  f.workspace.financialScreen.stageCriteria(
    f.workspace.financialScreen.getSnapshot(),
  );
  expect(
    getPortfolioScreenSelection(f.workspace, route, [f.choice()]).reason,
  ).toMatch(/criteria/i);
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.unexpected).not.toHaveBeenCalled();
});

it("consumes before notification and refuses success after a reentrant selection or route replacement", async () => {
  const f = await fixture();
  let preview = prepare(f);
  let calls = 0;
  const off = f.workspace.financialScreen.subscribe(() => {
    off();
    calls++;
    expect(preview.apply()).toBeNull();
    f.workspace.setView("portfolio");
  });
  expect(preview.apply()).toBeNull();
  expect(calls).toBe(1);
  off();
  const replacement = await fixture();
  preview = prepare(replacement);
  const detach = replacement.workspace.financialScreen.subscribe(() => {
    detach();
    replacement.workspace.financialScreen.select(
      replacement.workspace.financialScreen.getSnapshot(),
      replacement.choice(),
      false,
    );
  });
  expect(preview.apply()).toBeNull();
  expect(preview.isCurrent()).toBe(false);
});

it("cancels without mutation and fences retired sessions", async () => {
  const f = await fixture();
  const preview = prepare(f);
  const screen = f.workspace.financialScreen.getSnapshot();
  preview.cancel();
  expect(preview.apply()).toBeNull();
  expect(f.workspace.financialScreen.getSnapshot()).toBe(screen);
  const next = prepare(f);
  f.workspace.sessionOwner.retire("Session ended.");
  expect(next.apply()).toBeNull();
});

it("withdraws readiness during an explicit save and requires a fresh loaded base afterward", async () => {
  const f = await fixture();
  const preview = prepare(f);
  let resolve!: (
    value: Awaited<ReturnType<ManagedApi["savePortfolio"]>>,
  ) => void;
  f.api.savePortfolio.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const draft = f.workspace.portfolio.coordinator.getSnapshot().draft!;
  const saving = f.workspace.portfolio.coordinator.save();
  expect(
    getPortfolioScreenSelection(f.workspace, route, [f.choice()]).reason,
  ).not.toBeNull();
  expect(preview.apply()).toBeNull();
  resolve({ version: 2, payload: draft.ledger!, replayed: false });
  await saving;
  expect(f.workspace.portfolio.coordinator.getSnapshot().baseVersion).toBe(2);
  expect(
    getPortfolioScreenSelection(f.workspace, route, [f.choice()]).reason,
  ).toMatch(/load/i);
  expect(preview.apply()).toBeNull();
});

it.each(["conflict", "unavailable"] as const)(
  "keeps Portfolio %s recovery separate from selection",
  async (code) => {
    const f = await fixture();
    const preview = prepare(f);
    f.api.savePortfolio.mockRejectedValueOnce(new TrialApiError(code));
    await f.workspace.portfolio.coordinator.save();
    expect(
      preparePortfolioScreenSelection(f.workspace, route, [f.choice()]).preview,
    ).toBeNull();
    expect(preview.apply()).toBeNull();
    const state = f.workspace.portfolio.coordinator.getSnapshot();
    expect(code === "conflict" ? state.conflict : state.uncertain).toBe(true);
  },
);

it("retires the preview when the catalog is replaced, including the same digest with a new object", async () => {
  const f = await fixture();
  const preview = prepare(f);
  f.api.status.mockResolvedValueOnce({
    snapshot: { ...portfolioScreenCatalog, catalogVersion: "next" },
  });
  await f.workspace.refreshCatalog();
  expect(preview.isCurrent()).toBe(false);
  expect(preview.apply()).toBeNull();
  f.api.status.mockResolvedValueOnce({
    snapshot: {
      ...portfolioScreenCatalog,
      snapshotSha256: `sha256:${"b".repeat(64)}`,
    },
  });
  await f.workspace.refreshCatalog();
  expect(
    getPortfolioScreenSelection(f.workspace, route, []).reason,
  ).not.toBeNull();
});

it.each([
  { latestLoaded: false },
  { baseVersion: 99 },
  { conflict: true },
  { uncertain: true },
  { replayPending: true },
])("refuses a noncurrent Portfolio base %j", async (changed) => {
  const f = await fixture();
  const saved = f.workspace.portfolio.coordinator.getSnapshot();
  vi.spyOn(f.workspace.portfolio.coordinator, "getSnapshot").mockReturnValue({
    ...saved,
    ...changed,
  });
  expect(
    preparePortfolioScreenSelection(f.workspace, route, [f.choice()]).preview,
  ).toBeNull();
});
