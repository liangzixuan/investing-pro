import { ManagedWorkspace } from "./managed-workspace";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { afterEach, expect, it, vi } from "vitest";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import { eodResponse } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";

const workspaces: ManagedWorkspace[] = [];
const fixtures: Awaited<ReturnType<typeof createFollowupsReviewFixture>>[] = [];
afterEach(() => {
  workspaces.splice(0).forEach((w) => w.sessionOwner.dispose());
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.restoreAllMocks();
});
async function fixture() {
  const f = await createFollowupsReviewFixture();
  fixtures.push(f);
  const w = new ManagedWorkspace(f.api, f.storage.nextSession(), undefined, {
    researchCoverage: createManagedResearchCoverageFixture(
      f.entries.map((e) => ({ listing: e.listing, cik: "0000000001" })),
    ),
    priceCoverage: f.entries.slice(1).map((e) => e.listing),
    marketsCohort: f.entries.map((e) => e.listing),
  });
  workspaces.push(w);
  await w.refreshCatalog();
  await w.coordinator.load();
  await w.followups.coordinator.load();
  const draft = w.coordinator.getSnapshot().draft!;
  w.coordinator.replaceDraft({
    ...draft,
    memberships: f.entries
      .slice(1)
      .map((e) => ({ ...e.listing, note: "Original note" })),
  });
  w.setView("watchlist");
  const group = w.filingsReview;
  for (const member of [...group.getSnapshot().memberships].reverse())
    group.choose(group.getSnapshot(), member);
  group.startDaily(group.getSnapshot());
  expect(group.getSnapshot().daily?.phase).toBe("ready");
  const selection = (id: string) =>
    group.getSnapshot().rows.find((r) => r.member.listing.listingId === id)!
      .filings.selection!;
  vi.mocked(f.api.eodHistory).mockImplementation((request) =>
    Promise.resolve({
      ...eodResponse(request.range),
      catalogSnapshotSha256: request.catalogSnapshotSha256,
      security: selection(request.listingId).listing,
    }),
  );
  vi.mocked(f.api.recentFilings).mockImplementation((request) =>
    Promise.resolve(
      filingsResponse(1, "available", selection(request.listingId)),
    ),
  );
  const run = async () => {
    const plan = group.prepareDaily(group.getSnapshot(), ["price", "filings"]);
    expect(plan).not.toBeNull();
    await group.runDaily(group.getSnapshot(), plan!);
    expect(group.getSnapshot().daily?.phase).toBe("settled");
  };
  return { ...f, w, group, run };
}
it("retains paired packets, complete authored results and order through owned Research, Back and passive Finish", async () => {
  const f = await fixture();
  await f.run();
  expect(f.api.eodHistory).toHaveBeenCalledTimes(2);
  expect(f.api.recentFilings).toHaveBeenCalledTimes(2);
  f.group.select(f.group.getSnapshot(), f.group.getSnapshot().rows[0]!.member);
  const before = f.group.getSnapshot();
  const capture = f.group.captureDaily(before)!;
  f.w.openWatchlistDailyReview(capture);
  const visit = f.w.getSnapshot().research!;
  expect(visit).not.toBeNull();
  expect(f.w.eod.getSnapshot().response).toEqual(capture.price.response);
  expect(f.w.filings.getSnapshot().response).toEqual(capture.filings.response);
  const context = f.w.getCompanyResearchChecks(visit.selection)!;
  expect(context.canAttach).toBe(true);
  expect(context.attach(context.followups.value!)?.isCurrent()).toBe(true);
  const result =
    "Whole authored assessment · Cafe\u0301 東京 📈 " + "evidence ".repeat(100);
  f.w.followups.edit(context.followups.value!, "result", result);
  f.w.note(visit.selection.listing.listingId, "Whole revised note");
  f.w.closeResearch();
  expect(f.group.getSnapshot().rows.map((r) => r.member)).toEqual(
    before.rows.map((r) => r.member),
  );
  expect(f.group.getSnapshot().rows[0]!.price?.response).toBe(
    capture.price.response,
  );
  expect(f.w.getWatchlistDailyChecks()!.rows[0]!.check!.value!.result).toBe(
    result,
  );
  expect(f.group.finishDaily(f.group.getSnapshot())?.daily?.phase).toBe(
    "finished",
  );
  expect(f.group.captureDaily(f.group.getSnapshot())).toBeNull();
  expect(f.api.eodHistory).toHaveBeenCalledTimes(2);
  expect(f.api.recentFilings).toHaveBeenCalledTimes(2);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it.each([
  "watchlist-file",
  "followups-file",
  "fresh-load",
  "unrelated-research",
] as const)(
  "retires daily authority on %s and refuses old captures after restoration",
  async (kind) => {
    const f = await fixture();
    const capture = f.group.captureDaily(f.group.getSnapshot())!;
    const marker = {};
    if (kind === "watchlist-file") {
      f.w.beginWatchlistDraftFileActivity(marker);
      f.w.endWatchlistDraftFileActivity(marker);
    }
    if (kind === "followups-file") {
      f.w.followups.beginDraftFileActivity(marker);
      f.w.followups.endDraftFileActivity(marker);
    }
    if (kind === "fresh-load") await f.w.coordinator.load();
    if (kind === "unrelated-research")
      f.w.openWatchlistEod(
        f.w.coordinator.getSnapshot().draft!.memberships[0]!,
      );
    expect(f.group.getSnapshot().daily).toBeNull();
    f.w.closeResearch();
    f.w.openWatchlistDailyReview(capture);
    expect(f.w.getSnapshot().research).toBeNull();
    expect(f.api.eodHistory).not.toHaveBeenCalled();
    expect(f.api.recentFilings).not.toHaveBeenCalled();
  },
);
it("rejects a reentrant file change during paired Research seed installation", async () => {
  const f = await fixture();
  await f.run();
  const capture = f.group.captureDaily(f.group.getSnapshot())!;
  let once = false;
  const unsubscribe = f.w.eod.subscribe(() => {
    if (once || !f.w.eod.getSnapshot().selection) return;
    once = true;
    const activity = {};
    f.w.beginWatchlistDraftFileActivity(activity);
    f.w.endWatchlistDraftFileActivity(activity);
  });
  f.w.openWatchlistDailyReview(capture);
  unsubscribe();
  expect(once).toBe(true);
  expect(f.w.getSnapshot().research).toBeNull();
  expect(f.group.getSnapshot().daily).toBeNull();
  expect(f.api.eodHistory).toHaveBeenCalledTimes(2);
  expect(f.api.recentFilings).toHaveBeenCalledTimes(2);
});
it("loads initial Follow-ups explicitly once and cannot use a stale Load from a finished reading", async () => {
  const f = await fixture();
  const w = f.make();
  await w.refreshCatalog();
  await w.coordinator.load();
  w.setView("watchlist");
  const group = w.filingsReview;
  group.choose(group.getSnapshot(), group.getSnapshot().memberships[0]!);
  group.startDaily(group.getSnapshot());
  const originalReads = vi.mocked(f.api.loadFollowups).mock.calls.length;
  const ready = w.getWatchlistDailyChecks()!;
  expect(ready.canLoad).toBe(true);
  expect(ready.rows[0]!.check!.status).toBe("unloaded");
  await ready.load();
  await ready.load();
  expect(f.api.loadFollowups).toHaveBeenCalledTimes(originalReads + 1);
  expect(group.getSnapshot().daily).not.toBeNull();
  expect(w.getWatchlistDailyChecks()!.rows[0]!.check!.value?.check).toBe(
    f.entries[0]!.check,
  );
  expect(w.getWatchlistDailyChecks()!.canLoad).toBe(false);
  group.finishDaily(group.getSnapshot());
  await ready.load();
  expect(f.api.loadFollowups).toHaveBeenCalledTimes(originalReads + 1);
  expect(group.getSnapshot().daily?.phase).toBe("finished");
});

it("keeps the owned Router visit through section changes and Back without source reads", async () => {
  const f = await fixture();
  await f.run();
  const capture = f.group.captureDaily(f.group.getSnapshot())!;
  f.w.openWatchlistDailyReview(capture);
  const visit = f.w.getSnapshot().research!;
  const listingId = visit.selection.listing.listingId;
  f.w.setNavigationBlocked(true);
  await f.w.setCompanyRoute({ kind: "company", listingId, section: "filings" });
  expect(f.group.getSnapshot().daily).not.toBeNull();
  f.w.switchToEod();
  await f.w.setCompanyRoute({ kind: "company", listingId, section: "eod" });
  expect(f.w.eod.getSnapshot().response).toEqual(capture.price.response);
  f.w.switchToFilings();
  await f.w.setCompanyRoute({ kind: "company", listingId, section: "filings" });
  expect(f.w.filings.getSnapshot().response).toEqual(capture.filings.response);
  f.w.setNavigationBlocked(false);
  await f.w.setCompanyRoute(null);
  f.w.setView("watchlist");
  expect(f.group.getSnapshot().daily).not.toBeNull();
  expect(
    f.group
      .getSnapshot()
      .rows.find((r) => r.member.listing.listingId === listingId)?.price
      ?.response,
  ).toBe(capture.price.response);
  expect(f.group.finishDaily(f.group.getSnapshot())?.daily?.phase).toBe(
    "finished",
  );
  expect(f.api.eodHistory).toHaveBeenCalledTimes(2);
  expect(f.api.recentFilings).toHaveBeenCalledTimes(2);
});
it("retires an owned visit when the same listing is independently reopened", async () => {
  const f = await fixture();
  const capture = f.group.captureDaily(f.group.getSnapshot())!;
  f.w.openWatchlistDailyReview(capture);
  const listingId = f.w.getSnapshot().research!.selection.listing.listingId;
  f.w.openWatchlistEod(
    f.w.coordinator
      .getSnapshot()
      .draft!.memberships.find((m) => m.listingId === listingId)!,
  );
  expect(f.group.getSnapshot().daily).toBeNull();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
});
