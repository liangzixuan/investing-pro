import { afterEach, expect, it, vi } from "vitest";
import { createFixture } from "./fixture";
import {
  portfolioScreenHeldIds,
  portfolioScreenIds,
  portfolioScreenSelectedIds,
} from "./portfolio-screen-selection-fixture-data";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { preparePortfolioScreenSelection } from "../../src/clerk-trial/managed-portfolio-screen-selection";
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  owners.splice(0).forEach((w) => w.sessionOwner.dispose());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
  const fixture = await createFixture("portfolio-screen-selection"),
    signal = new AbortController().signal;
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    { researchCoverage: fixture.researchCoverage },
  );
  owners.push(workspace);
  workspace.setView("portfolio");
  return {
    fixture,
    meta: fixture.portfolioScreenSelection!,
    signal,
    workspace,
  };
}
it("starts with every personal resource unloaded and no source calls", async () => {
  const f = await setup();
  expect(f.meta.getSnapshot()).toEqual({
    status: 0,
    portfolioLoad: 0,
    resolve: 0,
    annual: 0,
    rejected: 0,
    unexpected: {},
    annualRequests: [],
  });
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
});
it("uses real Portfolio review, current cohort and explicit share-class preview without Annual or Save", async () => {
  const f = await setup(),
    w = f.workspace;
  await w.refreshCatalog();
  await w.portfolio.coordinator.load();
  await w.portfolio.reviewCatalog();
  w.portfolio.applyReview();
  const draft = w.portfolio.coordinator.getSnapshot().draft!;
  w.portfolio.replace(draft, {
    ...draft.ledger!,
    opening: { ...draft.ledger!.opening, cashUsd: "1500.00" },
  });
  const saved = w.portfolio.coordinator.getSnapshot();
  expect(saved.dirty).toBe(true);
  expect(w.portfolio.canSavePayload()).toBe(true);
  expect(
    (
      w.portfolio.getProjection() as Extract<
        NonNullable<ReturnType<typeof w.portfolio.getProjection>>,
        { status: "valid" }
      >
    ).portfolio.holdings.map((h) => h.identity.listingId),
  ).toEqual(portfolioScreenHeldIds);
  w.setView("discover");
  await w.financialScreen.loadUniverse(w.financialScreen.getSnapshot());
  expect(preparePortfolioScreenSelection(w, () => true, []).preview).toBeNull();
  const screen = w.financialScreen.getSnapshot(),
    choice = screen.memberships.find(
      (m) => m.listing.listingId === portfolioScreenIds.googl,
    )!;
  const p = preparePortfolioScreenSelection(w, () => true, [choice]);
  expect(p.reason).toBeNull();
  expect(p.preview!.plan.rows.map((row) => row.status)).toEqual([
    "included",
    "other_share_class",
    "included",
    "outside_cohort",
    "uncovered",
  ]);
  expect(p.preview!.plan.members.map((m) => m.listing.listingId)).toEqual(
    portfolioScreenSelectedIds,
  );
  expect(p.preview!.apply()).not.toBeNull();
  expect(p.preview!.apply()).toBeNull();
  expect(w.financialScreen.getSnapshot().criteria).toBe(screen.criteria);
  expect(w.portfolio.coordinator.getSnapshot()).toBe(saved);
  expect(f.meta.getSnapshot().unexpected).toEqual({});
  expect(f.meta.getSnapshot()).toMatchObject({
    status: 1,
    portfolioLoad: 1,
    resolve: 2,
    annual: 0,
    rejected: 0,
  });
});
it("admits only the selected independently dated packets and requires the unchanged twenty-second pace", async () => {
  const f = await setup();
  await f.fixture.api.status(f.signal);
  await f.fixture.api.loadPortfolio(f.signal);
  const digest = f.fixture.researchCoverage.catalogSnapshotSha256;
  for (const listingIds of [
    portfolioScreenHeldIds,
    f.meta.identities.slice(0, 18).map((r) => r.listingId),
  ])
    await f.fixture.api.resolve(
      { snapshotSha256: digest, listingIds },
      f.signal,
    );
  let now = 100;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const request = (i: number) => ({
    schemaVersion: "6.0.0" as const,
    catalogSnapshotSha256: digest,
    listingId: f.meta.packets[i]!.security.listingId,
    symbol: f.meta.packets[i]!.security.symbol,
  });
  const first = await f.fixture.api.annualReport(request(0), f.signal);
  expect(first).toEqual(f.meta.packets[0]);
  expect(first).not.toBe(f.meta.packets[0]);
  await expect(
    f.fixture.api.annualReport(request(1), f.signal),
  ).rejects.toThrow("Annual pace");
  now += 20000;
  expect(await f.fixture.api.annualReport(request(1), f.signal)).toEqual(
    f.meta.packets[1],
  );
  await expect(
    f.fixture.api.resolve(
      { snapshotSha256: digest, listingIds: [portfolioScreenIds.googl] },
      f.signal,
    ),
  ).rejects.toThrow("resolve order");
  expect(f.meta.getSnapshot().annualRequests.map((r) => r.symbol)).toEqual([
    "AAPL",
    "GOOGL",
  ]);
});
it.each(["load", "loadFollowups", "loadValuationAssumptions"] as const)(
  "rejects unrequested %s rather than using a base fixture fallback",
  async (operation) => {
    const f = await setup();
    await expect(f.fixture.api[operation](f.signal)).rejects.toThrow(
      "Unexpected invented held-company screening operation",
    );
    expect(f.meta.getSnapshot()).toMatchObject({
      rejected: 1,
      unexpected: { [operation]: 1 },
    });
  },
);
it("runs the actual paced screen then Research/Back reuses both packets and the independent whole Portfolio", async () => {
  const f = await setup(),
    w = f.workspace;
  await w.refreshCatalog();
  await w.portfolio.coordinator.load();
  await w.portfolio.reviewCatalog();
  w.portfolio.applyReview();
  const draft = w.portfolio.coordinator.getSnapshot().draft!;
  w.portfolio.replace(draft, {
    ...draft.ledger!,
    opening: { ...draft.ledger!.opening, cashUsd: "1500.00" },
  });
  const original = w.portfolio.coordinator.getSnapshot();
  w.setView("discover");
  await w.financialScreen.loadUniverse(w.financialScreen.getSnapshot());
  const member = w.financialScreen
    .getSnapshot()
    .memberships.find((m) => m.listing.listingId === portfolioScreenIds.googl)!;
  expect(
    preparePortfolioScreenSelection(w, () => true, [member]).preview!.apply(),
  ).not.toBeNull();
  vi.useFakeTimers({
    toFake: ["Date", "setTimeout", "clearTimeout", "performance"],
  });
  const pending = w.financialScreen.run(w.financialScreen.getSnapshot());
  await vi.waitFor(() => expect(f.meta.getSnapshot().annual).toBe(1));
  await vi.advanceTimersByTimeAsync(20000);
  await pending;
  const screen = w.financialScreen.getSnapshot(),
    row = screen.run!.rows[1]!,
    response = row.report!.response!;
  expect(screen.run!.status).toBe("completed");
  expect(screen.run!.rows.map((r) => r.failure)).toEqual([null, null]);
  expect(screen.run!.rows.map((r) => r.report!.response)).toEqual(
    f.meta.packets,
  );
  w.openFinancialScreenReport({ run: screen.run!, row, response });
  await vi.waitFor(() =>
    expect(w.annual.getSnapshot().response).toEqual(response),
  );
  expect(w.annual.getSnapshot().response).toEqual(response);
  expect(w.annual.getSnapshot().responseOrigin).toBe("financial-screen");
  w.closeResearch();
  expect(w.financialScreen.getSnapshot().run).toBe(screen.run);
  expect(w.portfolio.coordinator.getSnapshot()).toBe(original);
  expect(f.meta.getSnapshot()).toMatchObject({
    annual: 2,
    resolve: 2,
    rejected: 0,
  });
  expect(f.meta.getSnapshot().unexpected).toEqual({});
});
