import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ManagedSecFilingsResponseDto } from "@research-cockpit/contracts";
import { ManagedFollowupsReviewFilings } from "./managed-followups-review-filings";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import { ManagedSecFilingsError, type ManagedApi } from "./managed-api";

const cleanups: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
});
afterEach(() => {
  cleanups.splice(0).forEach((off) => off());
  vi.useRealTimers();
});
async function fixture() {
  const f = await createFollowupsReviewFixture();
  const read = vi.fn<ManagedApi["recentFilings"]>();
  const coverage = createManagedResearchCoverageFixture(
    f.entries
      .slice(0, 2)
      .map((entry) => ({ listing: entry.listing, cik: "0000000001" })),
    f.entries[0]!.catalogSnapshotSha256,
  );
  const model = new ManagedFollowupsReviewFilings(
    f.model,
    f.workspace.followups,
    read,
    vi.fn(),
    undefined,
    { coverage },
  );
  cleanups.push(() => {
    model.retire();
    f.dispose();
  });
  expect(f.model.enter()).toBe(true);
  for (const row of f.model.getSnapshot().rows)
    f.model.choose(f.model.getSnapshot(), row.handle);
  f.model.start(f.model.getSnapshot());
  const wire = (count = 2) =>
    filingsResponse(
      count,
      "available",
      model.getSnapshot().selected!.filings.selection!,
    );
  const load = async (count = 2) => {
    read.mockResolvedValueOnce(wire(count));
    await model.load(model.getSnapshot());
  };
  return { ...f, review: f.model, model, read, wire, load };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it("starts without requests and keeps exact packets independently through Continue, owned assessment and completion", async () => {
  const f = await fixture();
  expect(f.read).not.toHaveBeenCalled();
  const draft = f.workspace.followups.coordinator.getSnapshot().draft;
  await f.load();
  const first = f.model.getSnapshot().selected!;
  f.workspace.followups.edit(
    first.entry,
    "result",
    "  Café 東京 😀 authored  ",
  );
  expect(f.model.getSnapshot().selected!.filings.response).toBe(
    first.filings.response,
  );
  f.workspace.followups.complete(
    f.model.getSnapshot().selected!.entry,
    new Date(),
  );
  expect(f.model.getSnapshot().selected!.filings.response).toBe(
    first.filings.response,
  );
  f.review.continue(f.review.getSnapshot());
  expect(f.model.getSnapshot().selected!.filings.response).toBeNull();
  await f.load(0);
  expect(f.model.getSnapshot().rows[0]!.filings.response).toBe(
    first.filings.response,
  );
  expect(
    f.model.getSnapshot().selected!.filings.response!.issuer.filings,
  ).toEqual([]);
  expect(f.model.canInspect(f.model.getSnapshot())).toBe(true);
  expect(f.read.mock.calls.map(([request]) => request.listingId)).toEqual(
    draft!.entries.slice(0, 2).map((entry) => entry.listing.listingId),
  );
  f.review.continue(f.review.getSnapshot());
  expect(f.model.getSnapshot().selected!.filings.supported).toBe(false);
  expect(f.model.canLoad(f.model.getSnapshot())).toBe(false);
  await f.model.load(f.model.getSnapshot());
  expect(f.read).toHaveBeenCalledTimes(2);
});

it("retains original clocks after cancellation and rejects a late reply", async () => {
  const f = await fixture();
  await f.load();
  const previous = f.model.getSnapshot().selected!.filings.response;
  const pending = deferred<ManagedSecFilingsResponseDto>();
  f.read.mockReturnValueOnce(pending.promise);
  const request = f.model.load(f.model.getSnapshot());
  const signal = f.read.mock.calls.at(-1)![1];
  f.model.cancel(f.model.getSnapshot());
  expect(signal.aborted).toBe(true);
  pending.resolve(f.wire(3));
  await request;
  expect(f.model.getSnapshot().selected!.filings).toMatchObject({
    response: previous,
    showingPrevious: true,
    running: false,
  });
  expect(f.model.getSnapshot().selected!.filings.response).toBe(previous);
});

it("keeps a transient failed refresh separate from the retained packet", async () => {
  const f = await fixture();
  await f.load();
  const previous = f.model.getSnapshot().selected!.filings.response;
  f.read.mockRejectedValueOnce(new ManagedSecFilingsError("unavailable"));
  await f.model.load(f.model.getSnapshot());
  expect(f.model.getSnapshot().selected!.filings).toMatchObject({
    response: previous,
    showingPrevious: true,
    error: true,
  });
});

it("does not replace evidence with malformed or other-listing packets", async () => {
  const f = await fixture();
  await f.load();
  const other = filingsResponse(1, "available", {
    ...f.model.getSnapshot().selected!.filings.selection!,
    listing: f.entries[1]!.listing,
  });
  f.read.mockResolvedValueOnce(other);
  await f.model.load(f.model.getSnapshot());
  expect(f.model.getSnapshot().selected!.filings.response).toBeNull();
  expect(f.model.canInspect(f.model.getSnapshot())).toBe(false);
});

it.each(["check", "dueOn", "external draft", "finish", "route", "session"])(
  "retires packets and captured actions after %s, including restoration",
  async (kind) => {
    const f = await fixture();
    await f.load();
    const state = f.model.getSnapshot();
    const capture = f.model.capture(state)!;
    const entry = state.selected!.entry;
    if (kind === "check" || kind === "dueOn") {
      f.workspace.followups.edit(
        entry,
        kind,
        kind === "check" ? "Changed" : "2026-10-25",
      );
      f.workspace.followups.edit(
        f.workspace.followups.currentEntry(entry.id)!,
        kind,
        entry[kind],
      );
    } else if (kind === "external draft") {
      const draft = f.workspace.followups.coordinator.getSnapshot().draft!;
      f.workspace.followups.coordinator.replaceDraft(structuredClone(draft));
    } else if (kind === "finish") f.review.finish(f.review.getSnapshot());
    else if (kind === "route") {
      f.workspace.setView("markets");
      f.workspace.setView("followups");
    } else f.workspace.sessionOwner.retire("Invented session end");
    expect(capture.isCurrent()).toBe(false);
    expect(f.model.canLoad(state)).toBe(false);
    expect(f.model.capture(state)).toBeNull();
    await f.model.load(state);
    expect(f.read).toHaveBeenCalledOnce();
  },
);

it("retires a captured action after pause/restore but retains owned evidence", async () => {
  const f = await fixture();
  await f.load();
  const state = f.model.getSnapshot();
  f.review.setAvailable(false);
  f.review.setAvailable(true);
  await f.model.load(state);
  expect(f.read).toHaveBeenCalledOnce();
  expect(f.model.getSnapshot().selected!.filings.response).toBe(
    state.selected!.filings.response,
  );
});

it("makes a reentrant retirement during loading inert before provider dispatch", async () => {
  const f = await fixture();
  const off = f.model.subscribe(() => {
    if (f.model.getSnapshot().selected?.filings.running) f.review.leave();
  });
  await f.model.load(f.model.getSnapshot());
  off();
  expect(f.read).not.toHaveBeenCalled();
  expect(f.model.getSnapshot().rows).toEqual([]);
});

it("cancels an old selected check without importing its late reply into the next one", async () => {
  const f = await fixture();
  const wire = f.wire();
  const pending = deferred<ManagedSecFilingsResponseDto>();
  f.read.mockReturnValueOnce(pending.promise);
  const request = f.model.load(f.model.getSnapshot());
  f.review.continue(f.review.getSnapshot());
  await f.load(0);
  pending.resolve(wire);
  await request;
  expect(f.model.getSnapshot().rows[0]!.filings.response).toBeNull();
  expect(
    f.model.getSnapshot().selected!.filings.response!.issuer.filings,
  ).toEqual([]);
});

it("retains the packet but permanently retires Inspect after a failed refresh with the same response object", async () => {
  const f = await fixture();
  await f.load();
  const capture = f.model.capture(f.model.getSnapshot())!;
  const response = f.model.getSnapshot().selected!.filings.response;
  f.read.mockRejectedValueOnce(new ManagedSecFilingsError("unavailable"));
  await f.model.load(f.model.getSnapshot());
  expect(f.model.getSnapshot().selected!.filings.response).toBe(response);
  expect(capture.isCurrent()).toBe(false);
  expect(f.model.capture(f.model.getSnapshot())).not.toBeNull();
});
it("retires file-scoped captured actions even after file activity ends without a draft change", async () => {
  const f = await fixture();
  await f.load();
  const state = f.model.getSnapshot(),
    capture = f.model.capture(state)!,
    file = {};
  f.workspace.followups.beginDraftFileActivity(file);
  f.workspace.followups.endDraftFileActivity(file);
  expect(capture.isCurrent()).toBe(false);
  expect(f.model.canLoad(state)).toBe(false);
  expect(f.model.getSnapshot().selected!.filings.response).toBeNull();
});
