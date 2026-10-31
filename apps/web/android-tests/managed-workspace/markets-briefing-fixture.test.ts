import { afterEach, expect, it, vi } from "vitest";
import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { prepareCalendarFollowup } from "../../src/clerk-trial/managed-calendar-followup";
import { createFixture } from "./fixture";
import {
  briefingExpected,
  briefingQuestion,
  briefingScheduledQuestion,
  briefingScheduledCheck,
  briefingCheck,
  briefingDueOn,
  briefingUrl,
  briefingBlsPacket,
  briefingPacket,
} from "./markets-briefing-fixture";
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const w of owners.splice(0)) w.sessionOwner.dispose();
});
type Fixture = Awaited<ReturnType<typeof createFixture>>;
function owner(f: Fixture, fresh = false) {
  const w = new ManagedWorkspace(
    f.api,
    fresh ? f.followups!.nextSession() : f.session,
    undefined,
    {
      researchCoverage: f.researchCoverage,
      marketsCohort: f.marketsCohort,
      priceCoverage: f.priceCoverage,
    },
  );
  owners.push(w);
  return w;
}
async function setup() {
  const f = await createFixture("markets-briefing");
  const w = owner(f);
  await w.coordinator.load();
  await w.refreshCatalog();
  await vi.waitFor(() => expect(w.markets.getSnapshot().rows).toHaveLength(3));
  return { f, w };
}
async function run(w: ManagedWorkspace) {
  for (const id of ["price-1", "price-2", "bea", "fed"])
    w.marketsSourceReview.choose(id, false);
  w.marketsSourceReview.preview();
  expect(w.marketsSourceReview.getSnapshot().plan.map((x) => x.id)).toEqual([
    "price-0",
    "bls",
    "cpi",
  ]);
  await w.marketsSourceReview.start();
  expect(w.marketsSourceReview.getSnapshot().phase).toBe("complete");
}
async function createChecks(w: ManagedWorkspace) {
  const event = briefingBlsPacket().events[0]!;
  const scheduled = w.captureMarketsCalendarSource(
    `bls:${JSON.stringify([event.series, event.scheduledAt])}`,
    () => true,
  ).capture!;
  expect(scheduled).not.toBeNull();
  const members = w.coordinator.getSnapshot().draft!.memberships;
  await w.loadMarketsCalendarFollowups(scheduled, members[2]!, () => true);
  const a = prepareCalendarFollowup(
    w.captureMarketsCalendarFollowup(scheduled, members[2]!).port!,
    briefingScheduledQuestion,
    briefingDueOn,
    () => true,
  );
  expect(a.reason).toBeNull();
  expect(a.preview?.check).toBe(briefingScheduledCheck);
  const first = a.preview!.create()!;
  expect(first.listing.listingId).toBe("listing-beta-c");
  const source = w.captureCpiHeadlineSource(briefingUrl, () => true).capture!;
  const b = prepareCalendarFollowup(
    w.captureMarketsCalendarFollowup(source, members[0]!).port!,
    briefingQuestion,
    briefingDueOn,
    () => true,
  );
  expect(b.preview?.check).toBe(briefingCheck);
  const second = b.preview!.create()!;
  expect(second.listing.listingId).toBe("listing-zero");
  return { source, first, second };
}
function navigate(w: ManagedWorkspace, view: "markets" | "followups") {
  w.setNavigationBlocked(true);
  w.setView(view);
  w.setNavigationBlocked(false);
  return true;
}
it("runs the mixed pass once, retains whole evidence through two independently chosen checks, Research/Back/return and separate Save/fresh Load", async () => {
  const { f, w } = await setup();
  expect(f.getSnapshot()).toMatchObject({ cpi: 0, bls: 0, eod: 0, resolve: 0 });
  await run(w);
  expect(w.cpiHeadlines.getSnapshot().headlines).toEqual(briefingPacket());
  expect(w.blsCalendar.getSnapshot().calendar).toEqual(briefingBlsPacket());
  const { source, first, second } = await createChecks(w);
  const expected = encodeResearchFollowupsPayload(
    briefingExpected(f, second.id, first.id),
  );
  expect(
    encodeResearchFollowupsPayload(
      w.followups.coordinator.getSnapshot().draft!,
    ),
  ).toBe(expected);
  expect(f.followups!.getSnapshot()).toMatchObject({ save: 0, load: 1 });
  expect(
    w.reviewMarketsBriefingFollowup(second, source, () =>
      navigate(w, "followups"),
    )?.entry,
  ).toBe(second);
  const reading = w.getMarketsBriefingReading()!;
  expect(reading).not.toBeNull();
  const prepared = await w.prepareFollowupResearch(second);
  expect(prepared).not.toBeNull();
  w.openFollowupResearch(prepared!);
  w.setNavigationBlocked(true);
  await w.setCompanyRoute({
    kind: "company",
    listingId: second.listing.listingId,
    section: "eod",
  });
  w.closeResearch();
  w.setNavigationBlocked(false);
  await w.setCompanyRoute(null);
  expect(w.resumeMarketsBriefingFollowup()).toBe(true);
  expect(w.returnToMarketsBriefing(() => navigate(w, "markets"))).toBe(true);
  expect(w.getMarketsBriefingReading()).toBe(reading);
  expect(reading.cpi.headlines).toBe(w.cpiHeadlines.getSnapshot().headlines);
  expect(reading.bls.calendar).toBe(w.blsCalendar.getSnapshot().calendar);
  expect(f.getSnapshot()).toMatchObject({
    cpi: 1,
    bls: 1,
    eod: 1,
    resolve: 1,
    annual: 0,
    filings: 0,
    calendar: 0,
    fed: 0,
    save: 0,
  });
  w.setView("followups");
  await w.followups.coordinator.save();
  expect(f.followups!.getSnapshot()).toMatchObject({ save: 1, commits: 1 });
  w.sessionOwner.dispose();
  const fresh = owner(f, true);
  await fresh.coordinator.load();
  await fresh.refreshCatalog();
  fresh.setView("followups");
  await fresh.followups.coordinator.load();
  expect(
    encodeResearchFollowupsPayload(
      fresh.followups.coordinator.getSnapshot().draft!,
    ),
  ).toBe(expected);
  expect(fresh.cpiHeadlines.getSnapshot().headlines).toBeNull();
  expect(f.getSnapshot()).toMatchObject({ cpi: 1, bls: 1, eod: 1, resolve: 1 });
});
it("refuses out-of-order source reads and unrelated financial operations", async () => {
  const { f } = await setup();
  const signal = new AbortController().signal;
  expect(() => f.api.cpiHeadlines(signal)).toThrow(
    "Unexpected invented markets-briefing",
  );
  expect(() => f.api.blsCalendar(signal)).toThrow(
    "Unexpected invented markets-briefing",
  );
  expect(() => f.api.annualReport({} as never, signal)).toThrow(
    "Unexpected invented markets-briefing",
  );
  expect(f.followups!.getSnapshot()).toMatchObject({ save: 0, load: 0 });
});
it("refuses changed complete citations, order or company identity before any Save", async () => {
  const { f, w } = await setup();
  await run(w);
  const { source, first, second } = await createChecks(w);
  w.reviewMarketsBriefingFollowup(second, source, () =>
    navigate(w, "followups"),
  );
  await w.prepareFollowupResearch(second);
  const payload = briefingExpected(f, second.id, first.id);
  const signal = new AbortController().signal;
  for (const entries of [
    payload.entries.slice().reverse(),
    payload.entries.map((e, i) =>
      i === 2 ? { ...e, check: briefingScheduledQuestion } : e,
    ),
    payload.entries.map((e, i) =>
      i === 3 ? { ...e, listing: f.marketsCohort[2] } : e,
    ),
  ])
    expect(() =>
      f.api.saveFollowups(
        {
          expectedVersion: 1,
          idempotencyKey: "40000000-0000-4000-8000-000000000001",
          payload: { ...payload, entries },
        },
        signal,
      ),
    ).toThrow("Unexpected invented markets-briefing");
  expect(f.followups!.getSnapshot()).toMatchObject({ save: 0, commits: 0 });
});
