import { afterEach, describe, expect, it } from "vitest";
import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { createFixture } from "./fixture";
import {
  calendarFollowupCheck,
  calendarFollowupDueOn,
  calendarFollowupExpected,
  calendarFollowupOriginal,
  calendarFollowupQuestion,
  calendarFollowupUrl,
  calendarFollowupWatchlistNote,
} from "./calendar-followup-fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  calendarFollowupEvidence,
  prepareCalendarFollowup,
} from "../../src/clerk-trial/managed-calendar-followup";

const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
});
type Fixture = Awaited<ReturnType<typeof createFixture>>;
function makeWorkspace(fixture: Fixture, fresh = false) {
  const workspace = new ManagedWorkspace(
    fixture.api,
    fresh ? fixture.followups!.nextSession() : fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
    },
  );
  workspaces.push(workspace);
  return workspace;
}
async function mounted() {
  const fixture = await createFixture("markets-calendar-followup");
  const workspace = makeWorkspace(fixture);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("markets");
  for (let index = 0; index < 8; index++) await Promise.resolve();
  workspace.note("listing-zero", calendarFollowupWatchlistNote);
  return { fixture, workspace };
}
type Mounted = Awaited<ReturnType<typeof mounted>>;
async function source(f: Mounted) {
  expect(await f.workspace.announcements.load()).toBe("accepted");
  const capture = f.workspace.captureMarketsCalendarSource(
    `fed:${calendarFollowupUrl}`,
    () => true,
  );
  expect(capture.reason).toBeNull();
  expect(capture.capture).not.toBeNull();
  return capture.capture!;
}
type Capture = Awaited<ReturnType<typeof source>>;
function target(f: Mounted) {
  return f.workspace.coordinator
    .getSnapshot()
    .draft!.memberships.find((row) => row.listingId === "listing-beta-c")!;
}
function prepare(f: Mounted, capture: Capture) {
  const context = f.workspace.captureMarketsCalendarFollowup(
    capture,
    target(f),
  );
  expect(context.reason).toBeNull();
  expect(context.port).not.toBeNull();
  const value = prepareCalendarFollowup(
    context.port!,
    calendarFollowupQuestion,
    calendarFollowupDueOn,
    () => true,
  );
  expect(value.reason).toBeNull();
  expect(value.preview!.check).toBe(calendarFollowupCheck);
  return value.preview!;
}
async function create(f: Mounted, capture: Capture) {
  await f.workspace.loadMarketsCalendarFollowups(
    capture,
    target(f),
    () => true,
  );
  const preview = prepare(f, capture);
  const created = preview.create();
  expect(created).not.toBeNull();
  expect(preview.create()).toBeNull();
  return created!;
}
async function researchAndBack(
  f: Mounted,
  entry: NonNullable<ReturnType<ReturnType<typeof prepare>["create"]>>,
) {
  const draft = f.workspace.followups.coordinator.getSnapshot().draft;
  const review = f.workspace.reviewFollowup(entry, () => {
    f.workspace.setView("followups");
    return true;
  });
  expect(review?.entry).toBe(entry);
  expect(f.workspace.followups.getSnapshot()).toMatchObject({
    selectedId: entry.id,
    filter: "open",
  });
  const prepared = await f.workspace.prepareFollowupResearch(entry);
  expect(prepared).not.toBeNull();
  f.workspace.openFollowupResearch(prepared!);
  expect(f.workspace.getSnapshot().research?.selection.listing).toEqual(
    entry.listing,
  );
  f.workspace.closeResearch();
  expect(f.workspace.getSnapshot()).toMatchObject({
    view: "followups",
    research: null,
  });
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
}
function assertNoOtherEffects(f: Mounted, loads = 1) {
  expect(f.fixture.getSnapshot()).toMatchObject({
    load: loads,
    save: 0,
    eod: 0,
    annual: 0,
    filings: 0,
    marketsEod: 0,
    search: 0,
    calendar: 0,
    token: 0,
    signOut: 0,
  });
  expect(f.fixture.followups!.getSnapshot()).toMatchObject({
    token: 0,
    signOut: 0,
    replays: 0,
  });
}

describe("isolated native Markets calendar question fixture", () => {
  it("starts with separate exact Class A/Class C identities and no implicit feed or Follow-ups load", async () => {
    const f = await mounted();
    expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
      dirty: true,
      baseVersion: 1,
    });
    expect(
      f.workspace.coordinator
        .getSnapshot()
        .draft!.memberships.map((row) => [row.listingId, row.shareClassName]),
    ).toEqual([
      ["listing-zero", "Class A"],
      ["listing-beta-a", "Class A"],
      ["listing-beta-c", "Class C"],
    ]);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.workspace.marketsSourceReview.getSnapshot()).toMatchObject({
      phase: "retired",
      plan: [],
      canStart: false,
    });
    expect(f.fixture.getSnapshot().fed).toBe(0);
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      load: 0,
      save: 0,
      commits: 0,
    });
    assertNoOtherEffects(f);
  });

  it("retains the independent raw form/source through explicit initial load, cancel and one exact Class C create", async () => {
    const f = await mounted(),
      capture = await source(f);
    const before = f.workspace.coordinator.getSnapshot();
    expect(calendarFollowupEvidence(capture.source)).toMatchObject({
      instant: null,
      timeKind: "published",
      fetchedAt: "2026-10-23T18:00:00.000Z",
      showingPrevious: false,
    });
    expect(
      f.workspace.canLoadMarketsCalendarFollowups(capture, target(f)),
    ).toBe(true);
    await f.workspace.loadMarketsCalendarFollowups(
      capture,
      target(f),
      () => true,
    );
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toEqual(
      calendarFollowupOriginal(f.fixture),
    );
    const cancelled = prepare(f, capture);
    cancelled.cancel();
    expect(cancelled.create()).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot().dirty).toBe(false);
    const preview = prepare(f, capture),
      created = preview.create()!;
    expect(created.listing).toEqual(f.fixture.marketsCohort[2]);
    expect(preview.create()).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toEqual(
      calendarFollowupExpected(f.fixture, created.id),
    );
    expect(f.workspace.coordinator.getSnapshot()).toBe(before);
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 0,
      commits: 0,
    });
    assertNoOtherEffects(f);
  });

  it("reviews the exact entry through Research/Back, saves only the canonical whole Follow-ups resource and fresh-loads it", async () => {
    const f = await mounted(),
      capture = await source(f);
    const watchlist = f.workspace.coordinator.getSnapshot();
    const encoded = encodeMainWatchlistPayload(watchlist.draft!);
    const entry = await create(f, capture),
      expected = calendarFollowupExpected(f.fixture, entry.id);
    await researchAndBack(f, entry);
    expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
    await f.workspace.followups.coordinator.save();
    const accepted = f.workspace.followups.coordinator.getSnapshot();
    expect(accepted).toMatchObject({ baseVersion: 2, dirty: false });
    expect(encodeResearchFollowupsPayload(accepted.draft!)).toBe(
      encodeResearchFollowupsPayload(expected),
    );
    expect(
      encodeMainWatchlistPayload(f.workspace.coordinator.getSnapshot().draft!),
    ).toBe(encoded);
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 1,
      commits: 1,
    });
    assertNoOtherEffects(f);
    f.workspace.sessionOwner.dispose();
    const fresh = makeWorkspace(f.fixture, true);
    await fresh.coordinator.load();
    await fresh.refreshCatalog();
    fresh.setView("followups");
    expect(fresh.followups.coordinator.getSnapshot().draft).toBeNull();
    await fresh.followups.coordinator.load();
    expect(fresh.followups.coordinator.getSnapshot()).toMatchObject({
      draft: expected,
      baseVersion: 2,
      dirty: false,
    });
    expect(fresh.coordinator.getSnapshot().draft!.memberships[0]!.note).toBe(
      "Original independent note",
    );
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      session: 2,
      load: 2,
      save: 1,
      commits: 1,
    });
    assertNoOtherEffects(f, 2);
  });

  it("refuses a changed older assessment rather than accepting only the new entry", async () => {
    const f = await mounted(),
      capture = await source(f),
      entry = await create(f, capture);
    await researchAndBack(f, entry);
    const expected = calendarFollowupExpected(f.fixture, entry.id);
    const payload = {
      ...expected,
      entries: expected.entries.map((row, index) =>
        index === 0 ? { ...row, result: "Changed older assessment" } : row,
      ),
    };
    await expect(
      Promise.resolve().then(() =>
        f.fixture.api.saveFollowups(
          {
            expectedVersion: 1,
            idempotencyKey: "invented-calendar-wrong-payload-key",
            payload,
          },
          new AbortController().signal,
        ),
      ),
    ).rejects.toThrow("Unexpected invented markets-calendar-followup action");
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      save: 0,
      commits: 0,
      version: 1,
    });
  });
});
