import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { prepareScreenComparisonFollowup } from "../../src/clerk-trial/managed-screen-comparison-followup";
import { ScreenComparisonFollowupFixtureDiagnostics } from "./screen-comparison-followup-fixture-diagnostics";
import { createFixture } from "./fixture";
import {
  comparisonFollowupCheck,
  comparisonFollowupDueOn,
  comparisonFollowupExpected,
  comparisonFollowupNote,
  comparisonFollowupQuestion,
} from "./screen-comparison-followup-fixture-data";

const owners: ManagedWorkspace[] = [];
const clock = "2026-10-29T03:04:05.006Z";
afterEach(() => {
  for (const w of owners.splice(0)) w.sessionOwner.dispose();
  vi.useRealTimers();
});
function mount(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  fresh = false,
) {
  const w = new ManagedWorkspace(
    fixture.api,
    fresh ? fixture.followups!.nextSession() : fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
      financialScreenListingIds: fixture.screenComparison!.listingIds,
    },
  );
  owners.push(w);
  return w;
}
async function setup() {
  vi.useFakeTimers();
  const fixture = await createFixture("screen-comparison-followup");
  const workspace = mount(fixture);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note("listing-zero", comparisonFollowupNote);
  const before = encodeMainWatchlistPayload(
    workspace.coordinator.getSnapshot().draft!,
  );
  workspace.setView("discover");
  return { fixture, workspace, before, screen: workspace.financialScreen };
}
type Mounted = Awaited<ReturnType<typeof setup>>;
async function pair(f: Mounted) {
  const s = f.screen;
  await s.loadUniverse(s.getSnapshot());
  s.stageCriteria(s.getSnapshot());
  s.setCriteria(s.getSnapshot(), {
    clauses: [{ field: "operatingCashFlow", operator: "gte", value: "0" }],
    sort: { field: "symbol", direction: "asc" },
  });
  const running = s.run(s.getSnapshot());
  await vi.waitFor(() => expect(f.fixture.getSnapshot().annual).toBe(1));
  await vi.advanceTimersByTimeAsync(20000);
  await running;
  const rows = s.getSnapshot().run!.rows;
  s.selectComparison(
    s.getSnapshot(),
    "left",
    rows.find((r) => r.member.listing.listingId === "listing-zero")!,
  );
  s.selectComparison(
    s.getSnapshot(),
    "right",
    rows.find((r) => r.member.listing.listingId === "listing-one")!,
  );
}
function counts(
  f: Mounted,
  expected: { sessions: number; resolve: number; load: number; save: number },
) {
  expect(f.fixture.getSnapshot()).toMatchObject({
    load: expected.sessions,
    status: expected.sessions,
    marketsResolve: expected.sessions,
    resolve: expected.resolve,
    annual: 2,
    save: 0,
    eod: 0,
    filings: 0,
    interimReport: 0,
    marketsEod: 0,
    search: 0,
    calendar: 0,
    fed: 0,
    interimPortfolioLoad: 0,
    interimPortfolioSave: 0,
    interimFollowupsLoad: 0,
    interimFollowupsSave: 0,
    token: 0,
    signOut: 0,
  });
  expect(f.fixture.followups!.getSnapshot()).toMatchObject({
    session: expected.sessions,
    load: expected.load,
    save: expected.save,
    commits: expected.save,
    replays: 0,
    token: 0,
    signOut: 0,
  });
  expect(f.fixture.screenComparisonFollowup!.getSnapshot().rejected).toBe(0);
  expect(
    Object.values(f.fixture.screenComparisonReport!.getSnapshot()),
  ).toEqual(Array(10).fill(0));
  expect(f.fixture.screenComparisonReport!.getSnapshot()).toEqual({
    price: 0,
    filings: 0,
    interim: 0,
    cpi: 0,
    bls: 0,
    bea: 0,
    fed: 0,
    search: 0,
    resourceLoad: 0,
    resourceSave: 0,
  });
}
function diagnosticCanonical(text: string): string {
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null || !("followups" in value))
    throw new Error("Missing invented Follow-ups diagnostic object");
  const followups = value.followups;
  if (
    typeof followups !== "object" ||
    followups === null ||
    !("canonical" in followups) ||
    typeof followups.canonical !== "string"
  )
    throw new Error("Missing complete invented Follow-ups canonical payload");
  return followups.canonical;
}
function prepare(
  f: Mounted,
  capture: NonNullable<
    ReturnType<
      ManagedWorkspace["screenComparisonFollowup"]["capture"]
    >["capture"]
  >,
) {
  const port = f.workspace.screenComparisonFollowup.capturePort(
    capture,
    "right",
  ).port;
  expect(port).not.toBeNull();
  return prepareScreenComparisonFollowup(
    port!,
    { question: comparisonFollowupQuestion, dueOn: comparisonFollowupDueOn },
    () => true,
  );
}
async function loaded(f: Mounted) {
  await pair(f);
  const c = f.workspace.screenComparisonFollowup;
  const capture = c.capture(clock, () => true).capture!;
  expect(capture).not.toBeNull();
  expect(capture.isCurrent()).toBe(true);
  expect(
    c
      .destinations(capture)
      .map((d) => [d.side, d.listing.listingId, d.eligible]),
  ).toEqual([
    ["left", "listing-zero", true],
    ["right", "listing-one", true],
  ]);
  expect(c.canLoad(capture, "")).toBe(false);
  expect(c.capturePort(capture, "").port).toBeNull();
  expect(c.canLoad(capture, "right")).toBe(true);
  const original = f.workspace.followups.coordinator.getSnapshot();
  expect(original.draft).toBeNull();
  await c.load(capture, "right", () => true);
  expect(capture.isCurrent()).toBe(true);
  expect(f.workspace.followups.coordinator.getSnapshot()).toMatchObject({
    baseVersion: 1,
    dirty: false,
  });
  return capture;
}

describe("invented complete comparison dated-check native fixture", () => {
  it("does not read sources or Follow-ups on opening and refuses capture without a complete pair", async () => {
    const f = await setup();
    expect(
      f.workspace.screenComparisonFollowup.capture(clock, () => true).capture,
    ).toBeNull();
    expect(f.fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 1,
      marketsResolve: 1,
      resolve: 0,
      annual: 0,
      save: 0,
    });
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      load: 0,
      save: 0,
      commits: 0,
    });
  });
  it("preserves the complete comparison through explicit initial Load and creates exactly the independent right-company reference once", async () => {
    const f = await setup();
    const capture = await loaded(f);
    expect(capture.comparison.left.response).toEqual(
      f.fixture.screenComparisonFollowup!.packets[0],
    );
    expect(capture.comparison.right.response).toEqual(
      f.fixture.screenComparisonFollowup!.packets[1],
    );
    const prior = f.workspace.followups.coordinator.getSnapshot().draft!;
    const preview = prepare(f, capture).preview!;
    expect(preview.check).toBe(comparisonFollowupCheck(clock));
    expect(Array.from(preview.check).length).toBeLessThanOrEqual(500);
    const entry = preview.create()!;
    expect(entry).not.toBeNull();
    expect(preview.create()).toBeNull();
    const expected = comparisonFollowupExpected(f.fixture, entry)!;
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toEqual(
      expected,
    );
    expect(expected.entries.slice(0, 2)).toEqual(prior.entries);
    expect(expected.entries[2]).toMatchObject({
      listing: {
        listingId: "listing-one",
        shareClassId: "class-one",
        exchangeMic: "XNAS",
      },
      dueOn: comparisonFollowupDueOn,
      status: "open",
      completedOn: null,
      result: "",
    });
    expect(encodeResearchFollowupsPayload(expected)).not.toContain(
      "observations",
    );
    expect(
      encodeMainWatchlistPayload(f.workspace.coordinator.getSnapshot().draft!),
    ).toBe(f.before);
    const $ = load(
      renderToStaticMarkup(
        createElement(ScreenComparisonFollowupFixtureDiagnostics, {
          workspace: f.workspace,
          fixture: f.fixture,
        }),
      ),
    );
    const diagnostic = $("#fixture-screen-comparison-followup");
    expect(diagnostic.is("[hidden]")).toBe(true);
    expect(diagnosticCanonical(diagnostic.text())).toBe(
      encodeResearchFollowupsPayload(expected),
    );
    counts(f, { sessions: 1, resolve: 1, load: 1, save: 0 });
  });
  it("retires preview on form ABA and rejects overflow without clipping or changing either draft", async () => {
    const f = await setup();
    const capture = await loaded(f);
    const port = f.workspace.screenComparisonFollowup.capturePort(
      capture,
      "right",
    ).port!;
    const prior = f.workspace.followups.coordinator.getSnapshot();
    let active = true;
    const preview = prepareScreenComparisonFollowup(
      port,
      { question: comparisonFollowupQuestion, dueOn: comparisonFollowupDueOn },
      () => active,
    ).preview!;
    active = false;
    expect(preview.isCurrent()).toBe(false);
    active = true;
    expect(preview.create()).toBeNull();
    const freshPort = f.workspace.screenComparisonFollowup.capturePort(
      capture,
      "right",
    ).port!;
    expect(
      prepareScreenComparisonFollowup(
        freshPort,
        { question: "x".repeat(500), dueOn: comparisonFollowupDueOn },
        () => true,
      ).preview,
    ).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot()).toBe(prior);
    expect(
      encodeMainWatchlistPayload(f.workspace.coordinator.getSnapshot().draft!),
    ).toBe(f.before);
    counts(f, { sessions: 1, resolve: 1, load: 1, save: 0 });
  });
  it("keeps literal cohort and source counts through exact ONE Research/Back and one Save followed by explicit fresh Load", async () => {
    const f = await setup();
    const capture = await loaded(f);
    const entry = prepare(f, capture).preview!.create()!;
    const expected = comparisonFollowupExpected(f.fixture, entry)!;
    f.workspace.setView("followups");
    f.workspace.followups.select(entry.id);
    const research = await f.workspace.prepareFollowupResearch(entry);
    expect(research).not.toBeNull();
    f.workspace.openFollowupResearch(research!);
    expect(
      f.workspace.getSnapshot().research!.selection.listing.listingId,
    ).toBe("listing-one");
    f.workspace.closeResearch();
    expect(capture.isCurrent()).toBe(false);
    expect(f.workspace.followups.getSnapshot().selectedId).toBe(entry.id);
    expect(
      encodeMainWatchlistPayload(f.workspace.coordinator.getSnapshot().draft!),
    ).toBe(f.before);
    counts(f, { sessions: 1, resolve: 2, load: 1, save: 0 });
    await f.workspace.followups.coordinator.save();
    expect(f.workspace.followups.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 2,
      dirty: false,
      draft: expected,
    });
    counts(f, { sessions: 1, resolve: 2, load: 1, save: 1 });
    f.workspace.sessionOwner.dispose();
    const fresh = mount(f.fixture, true);
    await fresh.coordinator.load();
    await fresh.refreshCatalog();
    expect(fresh.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(
      fresh.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).not.toBe(comparisonFollowupNote);
    counts(f, { sessions: 2, resolve: 2, load: 1, save: 1 });
    fresh.setView("followups");
    await fresh.followups.coordinator.load();
    expect(
      encodeResearchFollowupsPayload(
        fresh.followups.coordinator.getSnapshot().draft!,
      ),
    ).toBe(encodeResearchFollowupsPayload(expected));
    counts(f, { sessions: 2, resolve: 2, load: 2, save: 1 });
  });
  it("refuses an altered saved reference before the independent resource commit", async () => {
    const f = await setup();
    const capture = await loaded(f);
    const entry = prepare(f, capture).preview!.create()!;
    f.workspace.setView("followups");
    const research = await f.workspace.prepareFollowupResearch(entry);
    f.workspace.openFollowupResearch(research!);
    f.workspace.closeResearch();
    const expected = comparisonFollowupExpected(f.fixture, entry)!;
    const altered = {
      ...expected,
      entries: expected.entries.map((e, i) =>
        i === 2
          ? { ...e, check: e.check.replace("listing-one", "listing-other") }
          : e,
      ),
    };
    await expect(
      async () =>
        await f.fixture.api.saveFollowups(
          {
            expectedVersion: 1,
            idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            payload: altered,
          },
          new AbortController().signal,
        ),
    ).rejects.toThrow(
      "Unexpected invented screen-comparison-followup operation",
    );
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      save: 0,
      commits: 0,
    });
    expect(f.fixture.screenComparisonFollowup!.getSnapshot().rejected).toBe(1);
  });
});
