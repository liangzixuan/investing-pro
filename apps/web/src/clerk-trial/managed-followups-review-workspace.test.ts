import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import type { ManagedApi } from "./managed-api";

const fixtures: Awaited<ReturnType<typeof createFollowupsReviewFixture>>[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T12:00:00.000Z"));
});
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.useRealTimers();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function fixture() {
  const value = await createFollowupsReviewFixture();
  fixtures.push(value);
  return value;
}

it("keeps chosen order through two company assessments, explicit next, full draft and separate Save/fresh Load", async () => {
  const f = await fixture();
  const watchlist = f.workspace.coordinator.getSnapshot().draft;
  f.start();
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.model.getSnapshot().chosen.map((row) => row.entry.id)).toEqual([
    f.entries[1]!.id,
    f.entries[0]!.id,
  ]);
  const first = await f.open();
  expect(f.model.getSnapshot()).toMatchObject({
    entered: true,
    available: false,
    position: 0,
  });
  first.editAssessment("First assessment · 東京");
  f.workspace.closeResearch();
  expect(f.model.getSnapshot()).toMatchObject({
    entered: true,
    available: true,
    position: 0,
  });
  expect(f.model.getSnapshot().selected?.entry.result).toBe(
    "First assessment · 東京",
  );
  expect(f.api.resolve).toHaveBeenCalledTimes(1);
  f.model.continue(f.model.getSnapshot());
  expect(f.api.resolve).toHaveBeenCalledTimes(1);
  const second = await f.open();
  second.editAssessment("Second assessment");
  f.workspace.closeResearch();
  f.model.finish(f.model.getSnapshot());
  expect(f.model.getSnapshot().phase).toBe("finished");
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.workspace.followups.currentEntry(f.entries[2]!.id)?.result).toBe(
    "Unchosen result stays",
  );
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(watchlist);
  for (const source of [
    f.api.eodHistory,
    f.api.annualReport,
    f.api.recentFilings,
  ])
    expect(source).not.toHaveBeenCalled();
  await f.workspace.followups.coordinator.save();
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  expect(f.storage.getSnapshot().commits).toBe(2); // one initial RAM setup + one explicit product Save
  const fresh = f.make();
  await fresh.refreshCatalog();
  fresh.setView("followups");
  await fresh.followups.coordinator.load();
  expect(
    fresh.followups.coordinator
      .getSnapshot()
      .draft?.entries.map((entry) => entry.result),
  ).toEqual([
    "Second assessment",
    "First assessment · 東京",
    "Unchosen result stays",
  ]);
  expect(fresh.followupsReview.getSnapshot().entered).toBe(false);
});

it("refuses an old queued opening after Finish and an equal-looking new session", async () => {
  const f = await fixture();
  f.start();
  const prepared = await f.workspace.prepareFollowupResearch(
    f.model.captureCurrent(f.model.getSnapshot())!,
  );
  f.model.finish(f.model.getSnapshot());
  expect(f.model.enter()).toBe(true);
  const oldChosen = f.model.getSnapshot().rows[1]!;
  f.model.choose(f.model.getSnapshot(), oldChosen.handle);
  f.model.start(f.model.getSnapshot());
  f.workspace.openFollowupResearch(prepared!);
  expect(f.workspace.getSnapshot().research).toBeNull();
  expect(f.api.resolve).toHaveBeenCalledOnce();
});

it("keeps a late resolve inert after leaving and returning to Follow-ups", async () => {
  const f = await fixture();
  f.start();
  const original = vi.mocked(f.api.resolve).getMockImplementation()!;
  const held = deferred<Awaited<ReturnType<ManagedApi["resolve"]>>>();
  vi.mocked(f.api.resolve).mockReturnValueOnce(held.promise);
  const pending = f.workspace.prepareFollowupResearch(
    f.model.captureCurrent(f.model.getSnapshot())!,
  );
  const request = vi.mocked(f.api.resolve).mock.calls[0]![0];
  f.workspace.setView("markets");
  f.workspace.setView("followups");
  held.resolve(await original(request, new AbortController().signal));
  expect(await pending).toBeNull();
  expect(f.model.getSnapshot().entered).toBe(false);
  expect(f.workspace.getSnapshot().research).toBeNull();
});

it("preserves the replacement opening created synchronously by an old resolve's abort listener", async () => {
  const f = await fixture();
  f.start();
  const entry = f.model.captureCurrent(f.model.getSnapshot())!;
  const resolve = vi.mocked(f.api.resolve);
  const original = resolve.getMockImplementation()!;
  const held = deferred<Awaited<ReturnType<ManagedApi["resolve"]>>>();
  let replacement: ReturnType<
    typeof f.workspace.prepareFollowupResearch
  > | null = null;
  resolve.mockImplementationOnce((_request, signal) => {
    signal.addEventListener(
      "abort",
      () => {
        replacement = f.workspace.prepareFollowupResearch(entry);
      },
      { once: true },
    );
    return held.promise;
  });
  const old = f.workspace.prepareFollowupResearch(entry);
  const outer = f.workspace.prepareFollowupResearch(entry);
  expect(await outer).toBeNull();
  expect(replacement).not.toBeNull();
  const capture = await replacement!;
  expect(capture).not.toBeNull();
  held.resolve(
    await original(resolve.mock.calls[0]![0], new AbortController().signal),
  );
  expect(await old).toBeNull();
  f.workspace.openFollowupResearch(capture!);
  expect(f.workspace.getSnapshot().research?.selection.listing.listingId).toBe(
    entry.listing.listingId,
  );
  expect(resolve).toHaveBeenCalledTimes(2);
});

it("refuses a reentrant opening while navigation is being blocked", async () => {
  const f = await fixture();
  f.start();
  const entry = f.model.captureCurrent(f.model.getSnapshot())!;
  let attempted: ReturnType<typeof f.workspace.prepareFollowupResearch> | null =
    null;
  const unsubscribe = f.model.subscribe(() => {
    if (attempted === null && !f.model.getSnapshot().available)
      attempted = f.workspace.prepareFollowupResearch(entry);
  });
  f.workspace.setNavigationBlocked(true);
  unsubscribe();
  expect(attempted).not.toBeNull();
  expect(await attempted!).toBeNull();
  expect(f.api.resolve).not.toHaveBeenCalled();
  f.workspace.setNavigationBlocked(false);
  expect(f.model.getSnapshot()).toMatchObject({
    entered: true,
    available: true,
    position: 0,
  });
});

it("ends the temporary order for a different manual check and preserves both drafts", async () => {
  const f = await fixture();
  const followups = f.workspace.followups.coordinator.getSnapshot().draft;
  const watchlist = f.workspace.coordinator.getSnapshot().draft;
  f.start();
  const capture = await f.workspace.prepareFollowupResearch(
    followups!.entries[2]!,
  );
  expect(capture?.reviewHandle).toBeNull();
  f.workspace.openFollowupResearch(capture!);
  expect(f.model.getSnapshot().entered).toBe(false);
  expect(f.workspace.getSnapshot().research?.selection.listing.listingId).toBe(
    f.entries[2]!.listing.listingId,
  );
  f.workspace.closeResearch();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(followups);
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(watchlist);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it("keeps the chosen company and authored assessment through the native router's blocked Back transition", async () => {
  const f = await fixture();
  f.start();
  const first = await f.open();
  first.editAssessment("Assessment before native Back");
  f.workspace.setNavigationBlocked(true);
  expect(f.model.getSnapshot()).toMatchObject({
    entered: true,
    available: false,
    position: 0,
  });
  expect(f.model.getSnapshot().selected?.entry.result).toBe(
    "Assessment before native Back",
  );
  f.workspace.closeResearch();
  expect(f.model.getSnapshot()).toMatchObject({
    entered: true,
    available: false,
    position: 0,
  });
  f.workspace.setNavigationBlocked(false);
  expect(f.model.getSnapshot()).toMatchObject({
    entered: true,
    available: true,
    position: 0,
  });
  expect(f.model.getSnapshot().selected?.entry.result).toBe(
    "Assessment before native Back",
  );
  expect(f.api.resolve).toHaveBeenCalledOnce();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
