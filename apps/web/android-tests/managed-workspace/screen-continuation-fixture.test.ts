import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { ScreenContinuationFixtureControls } from "./screen-continuation-fixture-controls";
import { WatchlistScreenSelectionFixtureControls } from "./watchlist-screen-selection-fixture-controls";
import { createFixture } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { prepareWatchlistScreenSelection } from "../../src/clerk-trial/managed-watchlist-screen-selection";
import { portfolioScreenIds } from "./portfolio-screen-selection-fixture-data";
import { watchlistScreenAuthoredNote } from "./watchlist-screen-selection-fixture";

const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const { createValuationDraftTestHooks } =
    await import("../../src/clerk-trial/valuation-draft-files-test-hooks");
  return {
    ...(await original<typeof React>()),
    ...createValuationDraftTestHooks(hooks),
  };
});
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
});
function continuedReading(workspace: ManagedWorkspace) {
  hooks.index = 0;
  const tree = ScreenContinuationFixtureControls({ workspace });
  const $ = load(renderToStaticMarkup(tree));
  return {
    tree,
    data: JSON.parse($("#fixture-screen-continuation").text()) as {
      applied: boolean;
      after: null | {
        run: { rows: { listing: { listingId: string }; response: unknown }[] };
      };
      sameAppliedRun: boolean;
      sameSourceHandle: boolean;
      sameRetainedReports: boolean;
      sameResource: boolean;
    },
  };
}
function captureReading(workspace: ManagedWorkspace, id: string) {
  const { tree } = continuedReading(workspace);
  const children = (tree as React.ReactElement<{ children?: React.ReactNode }>)
    .props.children;
  const button = React.Children.toArray(children).find(
    (child) =>
      React.isValidElement<{ id?: string }>(child) && child.props.id === id,
  ) as React.ReactElement<{ disabled: boolean; onClick: () => void }>;
  expect(button).toBeDefined();
  expect(button.props.disabled).toBe(false);
  button.props.onClick();
  return continuedReading(workspace).data;
}

function savedReading(
  props: Parameters<typeof WatchlistScreenSelectionFixtureControls>[0],
) {
  const previous = { index: hooks.index, slots: hooks.slots };
  hooks.index = 0;
  hooks.slots = [];
  try {
    const $ = load(
      renderToStaticMarkup(
        React.createElement(WatchlistScreenSelectionFixtureControls, props),
      ),
    );
    return JSON.parse($("#fixture-watchlist-screen-selection").text()) as {
      canonical: string;
      expectedCanonical: string;
      unrelatedUnloaded: boolean;
      watchlist: { baseVersion: number; dirty: boolean };
      counts: {
        load: number;
        save: number;
        resolve: number;
        annual: number;
        rejected: number;
        unexpected: Record<string, number>;
      };
    };
  } finally {
    hooks.index = previous.index;
    hooks.slots = previous.slots;
  }
}

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

it("serializes the cancelled run for the exact native missing-packet predicate without losing retained payloads", async () => {
  const f = await cancelledRun();
  const before = f.screen.getSnapshot();
  const counts = f.meta.getSnapshot();
  const $ = load(
    renderToStaticMarkup(
      React.createElement(WatchlistScreenSelectionFixtureControls, {
        workspace: f.w,
        fixture: f.meta,
      }),
    ),
  );
  const d = JSON.parse($("#fixture-watchlist-screen-selection").text()) as {
    counts: { annual: number };
    screen: {
      run: { status: string; rows: { response: unknown }[] };
    };
    expectedPackets: unknown[];
  };
  const r = d.screen.run;
  expect(
    d.counts.annual === 1 &&
      r.status === "cancelled" &&
      JSON.stringify(r.rows[0]!.response) ===
        JSON.stringify(d.expectedPackets[0]) &&
      r.rows[1]!.response === null,
  ).toBe(true);
  expect(r.rows.map((row) => row.response)).toEqual([f.meta.packets[0], null]);
  expect(d.expectedPackets).toEqual(f.meta.packets);
  expect(Object.hasOwn(r.rows[1]!, "response")).toBe(true);
  expect(f.screen.getSnapshot()).toBe(before);
  expect(f.meta.getSnapshot()).toBe(counts);
});

it("explicitly reads only the missing Annual packet, keeps original evidence through Research/Back, and separately saves the unchanged Watchlist draft", async () => {
  const f = await cancelledRun(),
    { w, screen } = f;
  const original = screen.getSnapshot(),
    originalRun = original.run!;
  const retained = originalRun.rows[0]!;
  captureReading(w, "fixture-continuation-capture-before");
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
  const captured = captureReading(w, "fixture-continuation-capture-after");
  expect(captured.applied).toBe(true);
  expect(captured.after!.run.rows.map((row) => row.response)).toEqual(
    f.meta.packets,
  );
  const row = run.rows[1]!,
    response = row.report!.response!;
  w.openFinancialScreenReport({ run, row, response });
  await vi.waitFor(() =>
    expect(w.annual.getSnapshot().response).toEqual(response),
  );
  expect(w.annual.getSnapshot().responseOrigin).toBe("financial-screen");
  const inResearch = continuedReading(w).data;
  expect(inResearch.after).toEqual(captured.after);
  expect(w.getSnapshot().research?.selection.origin).toBe("screening");
  expect(w.getSnapshot().research?.selection.listing.listingId).toBe(
    inResearch.after!.run.rows[1]!.listing.listingId,
  );
  const matchesCapturedPacket = (actual: unknown) =>
    JSON.stringify(actual) ===
    JSON.stringify(inResearch.after!.run.rows[1]!.response);
  expect(matchesCapturedPacket(w.annual.getSnapshot().response)).toBe(true);
  expect(inResearch.after!.run.rows[1]!.response).toEqual(f.meta.packets[1]);
  expect(
    matchesCapturedPacket({
      ...response,
      security: { ...response.security, symbol: "CHANGED" },
    }),
  ).toBe(false);
  expect(
    matchesCapturedPacket({
      ...response,
      evidence: {
        ...response.evidence,
        generation: {
          ...response.evidence.generation,
          cutoffAt: "2026-11-06T00:00:00Z",
        },
      },
    }),
  ).toBe(false);
  const missing: Record<string, unknown> = { ...response };
  delete missing.evidence;
  expect(matchesCapturedPacket(missing)).toBe(false);
  expect(matchesCapturedPacket({ ...response, extra: true })).toBe(false);
  expect(f.meta.getSnapshot()).toMatchObject({ annual: 2, resolve: 1 });
  w.closeResearch();
  expect(continuedReading(w).data).toMatchObject({
    after: captured.after,
    sameAppliedRun: true,
    sameSourceHandle: true,
    sameRetainedReports: true,
    sameResource: true,
  });
  expect(screen.getSnapshot().run).toBe(run);
  expect(f.meta.getSnapshot().annual).toBe(2);
  w.setView("watchlist");
  await w.reviewCatalog();
  w.applyReview();
  const beforeSave = savedReading({ workspace: w, fixture: f.meta });
  expect(beforeSave.canonical).toBe(beforeSave.expectedCanonical);
  expect(beforeSave).toMatchObject({
    counts: { save: 0, resolve: 2 },
    watchlist: { dirty: true },
  });
  await w.coordinator.save();
  const saved = savedReading({ workspace: w, fixture: f.meta });
  expect(saved.canonical).toBe(saved.expectedCanonical);
  expect(saved).toMatchObject({
    counts: { save: 1 },
    watchlist: { baseVersion: 4, dirty: false },
    unrelatedUnloaded: true,
  });
  await w.coordinator.load();
  const loaded = savedReading({ workspace: w, fixture: f.meta });
  expect(loaded.canonical).toBe(loaded.expectedCanonical);
  expect(loaded).toMatchObject({
    counts: {
      load: 2,
      save: 1,
      resolve: 2,
      annual: 2,
      rejected: 0,
      unexpected: {},
    },
    watchlist: { baseVersion: 4, dirty: false },
    unrelatedUnloaded: true,
  });
  expect(Object.keys(loaded.counts.unexpected)).toEqual([]);
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
