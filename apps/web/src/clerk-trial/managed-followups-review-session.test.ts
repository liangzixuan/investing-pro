import { describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedResearchFollowupsDto,
  ResearchFollowup,
} from "@research-cockpit/contracts";
import { ManagedResearchFollowups } from "./managed-research-followups";
import { ManagedFollowupsReviewSession } from "./managed-followups-review-session";
import type { ManagedApi } from "./managed-api";
import type { TrialSession } from "./session";

const digest = `sha256:${"a".repeat(64)}` as const;
const otherDigest = `sha256:${"b".repeat(64)}` as const;
function entry(number: number): ResearchFollowup {
  return {
    id: `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
    catalogSnapshotSha256: digest,
    listing: {
      country: "US",
      exchangeMic: "XNAS",
      instrumentType: "common_stock",
      issuerId: `issuer-${number}`,
      issuerName: `Invented issuer ${number}`,
      listingId: `listing-${number}`,
      securityId: `security-${number}`,
      securityName: "Common stock",
      shareClassId: `class-${number}`,
      shareClassName: "Class A",
      symbol: `DEMO${number}`,
    },
    check: `Read the complete question ${number}`,
    dueOn: "2026-10-24",
    status: "open",
    completedOn: null,
    result: `Original result ${number}`,
  };
}
async function fixture(entries = [entry(1), entry(2), entry(3)]) {
  let stored: ManagedResearchFollowupsDto = {
    version: 4,
    payload: { schemaVersion: 1, entries },
  };
  const api = {
    loadFollowups: vi.fn<ManagedApi["loadFollowups"]>(() =>
      Promise.resolve(stored),
    ),
    saveFollowups: vi.fn<ManagedApi["saveFollowups"]>((command) => {
      stored = {
        version: command.expectedVersion + 1,
        payload: command.payload,
      };
      return Promise.resolve({ ...stored, replayed: false });
    }),
    resolve: vi.fn<ManagedApi["resolve"]>((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: entries.find((e) => e.listing.listingId === listingId)!
            .listing,
        })),
      }),
    ),
  };
  const session: TrialSession = {
    userId: "invented-user",
    sessionId: "invented-session",
    getToken: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  const watchlist: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: digest,
    memberships: entries.map((e) => ({
      ...e.listing,
      note: "Unrelated unsaved Watchlist note",
    })),
  };
  const context = { draft: watchlist, catalogSnapshotSha256: digest as string };
  const model = new ManagedResearchFollowups(api, session, {
    getCreationContext: () => context,
    onRetire: vi.fn(),
    newKey: () => "invented-review-save-v1",
    newEntryId: () => entry(20).id,
  });
  const review = new ManagedFollowupsReviewSession(model);
  await model.coordinator.load();
  model.reassessDueDate(new Date("2026-10-24T12:00:00.000Z"));
  review.setAvailable(true);
  return { model, review, api, context, stored: () => stored };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function choose(f: Fixture, index: number) {
  const state = f.review.getSnapshot();
  f.review.choose(state, state.rows[index]!.handle);
}
function start(f: Fixture, indexes = [0, 1]) {
  expect(f.review.enter()).toBe(true);
  for (const index of indexes) choose(f, index);
  f.review.start(f.review.getSnapshot());
  return f.review.getSnapshot();
}
function current(f: Fixture, index = 0) {
  return f.model.coordinator.getSnapshot().draft!.entries[index]!;
}
function unchangedCalls(f: Fixture) {
  expect(f.api.loadFollowups).toHaveBeenCalledTimes(1);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).not.toHaveBeenCalled();
}

describe("temporary daily Follow-ups review", () => {
  it("requires explicit entry and choice, preserves chosen order and whole content without calls or draft mutation", async () => {
    const f = await fixture();
    const draft = f.model.coordinator.getSnapshot().draft;
    expect(f.review.getSnapshot()).toMatchObject({
      entered: false,
      available: false,
      chosen: [],
    });
    f.review.start(f.review.getSnapshot());
    expect(f.review.captureCurrent(f.review.getSnapshot())).toBeNull();
    const state = start(f, [2, 0]);
    expect(state.chosen.map((row) => row.entry.id)).toEqual([
      entry(3).id,
      entry(1).id,
    ]);
    expect(state.selected?.entry).toEqual(entry(3));
    expect(state.position).toBe(0);
    expect(state.assessedOn).toBe("2026-10-24");
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.chosen)).toBe(true);
    expect(Object.isFrozen(state.selected?.handle)).toBe(true);
    expect(f.model.coordinator.getSnapshot().draft).toBe(draft);
    expect(f.context.draft.memberships[0]?.note).toBe(
      "Unrelated unsaved Watchlist note",
    );
    unchangedCalls(f);
  });
  it("excludes later, completed, invalid Gregorian dates and stale catalog claims without discarding them", async () => {
    const input = [
      entry(1),
      { ...entry(2), dueOn: "2026-10-25" },
      { ...entry(3), status: "completed" as const, completedOn: "2026-10-23" },
    ];
    const f = await fixture(input);
    f.model.edit(current(f), "dueOn", "2026-02-30");
    expect(f.review.enter()).toBe(true);
    expect(f.review.getSnapshot().rows).toHaveLength(0);
    expect(f.model.coordinator.getSnapshot().draft?.entries).toHaveLength(3);
    f.review.leave();
    f.model.edit(current(f), "dueOn", "2026-10-23");
    f.model.syncCatalog(otherDigest);
    f.review.setAvailable(true);
    f.review.enter();
    expect(f.review.getSnapshot().rows).toEqual([]);
    unchangedCalls(f);
  });
  it("bounds explicit selection to five, toggles choice and refuses forged, foreign and stale handles", async () => {
    const f = await fixture(Array.from({ length: 6 }, (_, i) => entry(i + 1)));
    const other = await fixture();
    f.review.enter();
    other.review.enter();
    const initial = f.review.getSnapshot();
    f.review.choose(initial, { key: Symbol("forged") });
    f.review.choose(initial, other.review.getSnapshot().rows[0]!.handle);
    expect(f.review.getSnapshot()).toBe(initial);
    for (let i = 0; i < 5; i++) choose(f, i);
    expect(
      f.review.canChoose(
        f.review.getSnapshot(),
        f.review.getSnapshot().rows[5]!.handle,
      ),
    ).toBe(false);
    choose(f, 5);
    expect(f.review.getSnapshot().chosen).toHaveLength(5);
    f.review.start(initial);
    expect(f.review.getSnapshot().phase).toBe("choosing");
    choose(f, 0);
    choose(f, 5);
    expect(f.review.getSnapshot().chosen.map((row) => row.entry.id)).toEqual(
      [2, 3, 4, 5, 6].map((n) => entry(n).id),
    );
    unchangedCalls(f);
  });
  it("keeps exact assessment/status edits through suspension and explicit Continue, then saves the entire resource separately", async () => {
    const f = await fixture();
    const first = start(f);
    const raw = "📈".repeat(2000);
    const watchlist = f.context.draft;
    f.review.setAvailable(false);
    f.model.edit(current(f), "result", raw);
    f.model.complete(current(f), new Date("2026-10-24T12:00:00Z"));
    expect(f.review.getSnapshot()).toMatchObject({
      entered: true,
      phase: "reviewing",
      available: false,
      position: 0,
    });
    expect(f.review.getSnapshot().selected?.entry.result).toBe(raw);
    f.review.setAvailable(true);
    f.review.continue(first);
    expect(f.review.getSnapshot().position).toBe(0);
    const fresh = f.review.getSnapshot();
    expect(f.review.captureCurrent(fresh)?.result).toBe(raw);
    f.review.continue(fresh);
    expect(f.review.getSnapshot().position).toBe(1);
    f.model.edit(current(f, 1), "result", "Second complete assessment");
    expect(f.review.getSnapshot().selected?.entry.result).toBe(
      "Second complete assessment",
    );
    expect(f.review.canContinue(f.review.getSnapshot())).toBe(false);
    f.review.finish(f.review.getSnapshot());
    expect(f.review.getSnapshot()).toMatchObject({
      phase: "finished",
      chosen: [],
      selected: null,
    });
    unchangedCalls(f);
    expect(f.context.draft).toBe(watchlist);
    await f.model.coordinator.save();
    expect(f.api.saveFollowups).toHaveBeenCalledTimes(1);
    const saved = f.stored().payload.entries;
    expect(saved.map((e) => e.result)).toEqual([
      raw,
      "Second complete assessment",
      "Original result 3",
    ]);
    expect(saved[0]?.status).toBe("completed");
    expect(saved[1]?.status).toBe("open");
    await f.model.coordinator.load();
    expect(f.model.coordinator.getSnapshot().draft?.entries).toEqual(saved);
    expect(f.review.getSnapshot().entered).toBe(false);
  });
  it("retains invalid raw assessments without clipping while Save remains refused", async () => {
    const f = await fixture();
    start(f);
    const raw = "x".repeat(2001) + "\n";
    f.model.edit(current(f), "result", raw);
    expect(f.review.getSnapshot().selected?.entry.result).toBe(raw);
    expect(f.review.getSnapshot().entered).toBe(true);
    expect(f.model.canSavePayload()).toBe(false);
    await f.model.coordinator.save();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(current(f).result).toBe(raw);
  });
  it.each(["result", "complete", "reopen"] as const)(
    "preserves own %s changes without reviving stale rendered state",
    async (action) => {
      const f = await fixture();
      const state = start(f);
      const actions = {
        result: () => f.model.edit(current(f), "result", "New result"),
        complete: () => f.model.complete(current(f), new Date("2026-10-24")),
        reopen: () => {
          f.model.complete(current(f), new Date("2026-10-24"));
          f.model.reopen(current(f));
        },
      };
      actions[action]();
      expect(f.review.getSnapshot().entered).toBe(true);
      expect(f.review.captureCurrent(state)).toBeNull();
      expect(f.review.captureCurrent(f.review.getSnapshot())).toBe(current(f));
    },
  );
  it.each(["check", "dueOn"] as const)(
    "retires on any authored %s write even an equal value and later restoration",
    async (field) => {
      const f = await fixture();
      const state = start(f);
      const original = current(f)[field];
      f.model.edit(current(f), field, original);
      expect(f.review.getSnapshot().entered).toBe(false);
      f.model.edit(current(f), field, original);
      f.review.continue(state);
      expect(f.review.captureCurrent(state)).toBeNull();
    },
  );
  it("preserves chosen order through authored additions and removal of an unchosen check, but removal of a chosen check ends it", async () => {
    const f = await fixture();
    start(f);
    const ids = f.review.getSnapshot().chosen.map((row) => row.entry.id);
    f.model.remove(current(f, 2));
    expect(f.review.getSnapshot().chosen.map((row) => row.entry.id)).toEqual(
      ids,
    );
    const member = { ...entry(20).listing, note: "Unrelated" };
    f.context.draft = {
      ...f.context.draft,
      memberships: [...f.context.draft.memberships, member],
    };
    f.model.add(member, "2026-10-24");
    expect(f.review.getSnapshot().chosen.map((row) => row.entry.id)).toEqual(
      ids,
    );
    expect(f.review.getSnapshot().chosen).toHaveLength(2);
    f.model.remove(current(f));
    expect(f.review.getSnapshot().entered).toBe(false);
  });
  it.each(["equal", "rebound", "metadata", "reorder"] as const)(
    "retires unknown external %s replacement, never equality-rebases",
    async (kind) => {
      const f = await fixture();
      const state = start(f);
      const draft = f.model.coordinator.getSnapshot().draft!;
      const replacements = {
        equal: draft,
        rebound: {
          ...draft,
          entries: [
            {
              ...current(f),
              listing: { ...current(f).listing, shareClassId: "other-class" },
            },
            ...draft.entries.slice(1),
          ],
        },
        metadata: {
          ...draft,
          entries: [
            {
              ...current(f),
              listing: { ...current(f).listing, symbol: "SAME" },
            },
            ...draft.entries.slice(1),
          ],
        },
        reorder: { ...draft, entries: [...draft.entries].reverse() },
      };
      f.model.coordinator.replaceDraft(replacements[kind]);
      expect(f.review.getSnapshot().entered).toBe(false);
      f.model.coordinator.replaceDraft(draft);
      f.review.start(state);
      expect(f.review.getSnapshot().entered).toBe(false);
    },
  );
  it("unknown equal replacement inside an authored copy notification cannot inherit the own-edit marker", async () => {
    const f = await fixture();
    start(f);
    let replace = true;
    const stop = f.model.coordinator.subscribe(() => {
      if (!replace) return;
      replace = false;
      f.model.coordinator.replaceDraft(
        f.model.coordinator.getSnapshot().draft!,
      );
    });
    f.model.edit(
      current(f),
      "result",
      "Owned result before external replacement",
    );
    stop();
    expect(current(f).result).toBe("Owned result before external replacement");
    expect(f.review.getSnapshot().entered).toBe(false);
    unchangedCalls(f);
  });
  it("a session subscriber's equal replacement also consumes the local marker before notifications", async () => {
    const f = await fixture();
    start(f);
    let replace = true;
    const stop = f.review.subscribe(() => {
      if (!replace) return;
      replace = false;
      f.model.coordinator.replaceDraft(
        f.model.coordinator.getSnapshot().draft!,
      );
    });
    f.model.edit(current(f), "result", "Local assessment");
    stop();
    expect(f.review.getSnapshot().entered).toBe(false);
    expect(current(f).result).toBe("Local assessment");
  });
  it.each([
    "catalog",
    "day",
    "invalid-day",
    "load",
    "identity-review",
    "file-restore",
  ] as const)(
    "ends on %s without restoration reviving prior callbacks",
    async (action) => {
      const f = await fixture();
      const state = start(f);
      const actions = {
        catalog: () => {
          f.model.syncCatalog(otherDigest);
          f.model.syncCatalog(digest);
        },
        day: () => f.model.reassessDueDate(new Date("2026-10-25")),
        "invalid-day": () => f.model.reassessDueDate(new Date(NaN)),
        load: () => f.model.coordinator.load(),
        "identity-review": () => f.model.reviewCatalog(),
        "file-restore": () =>
          f.model.restoreFileDraft(
            f.model.getDraftFileContext()!,
            f.model.coordinator.getSnapshot().draft!,
          ),
      };
      await actions[action]();
      expect(f.review.getSnapshot().entered).toBe(false);
      expect(f.review.captureCurrent(state)).toBeNull();
    },
  );
  it("same-day reassessment retains the plan but new render state fences prior captures", async () => {
    const f = await fixture();
    const state = start(f);
    f.model.reassessDueDate(new Date("2026-10-24T22:00:00Z"));
    expect(f.review.getSnapshot().entered).toBe(true);
    expect(f.review.captureCurrent(state)).toBeNull();
    expect(f.review.getSnapshot().assessedOn).toBe("2026-10-24");
  });
  it("setAvailable never enters, suspends without losing position and invalidates old captures across equal route round trips", async () => {
    const f = await fixture();
    const inactive = f.review.getSnapshot();
    f.review.setAvailable(false);
    f.review.setAvailable(true);
    expect(f.review.getSnapshot()).not.toBe(inactive);
    expect(f.review.getSnapshot().entered).toBe(false);
    const state = start(f);
    f.review.setAvailable(false);
    const suspended = f.review.getSnapshot();
    expect(suspended.selected?.entry.id).toBe(entry(1).id);
    expect(f.review.captureCurrent(suspended)).toBeNull();
    f.review.setAvailable(true);
    expect(f.review.captureCurrent(state)).toBeNull();
    expect(f.review.captureCurrent(f.review.getSnapshot())?.id).toBe(
      entry(1).id,
    );
    unchangedCalls(f);
  });
  it("Finish clears only temporary choices, stays finished until explicit enter and cannot auto-complete or Save", async () => {
    const f = await fixture();
    const state = start(f);
    const draft = f.model.coordinator.getSnapshot().draft;
    f.review.finish(state);
    const finished = f.review.getSnapshot();
    f.review.continue(state);
    f.review.start(state);
    expect(f.review.getSnapshot()).toBe(finished);
    expect(f.model.coordinator.getSnapshot().draft).toBe(draft);
    f.review.setAvailable(false);
    f.review.setAvailable(true);
    expect(f.review.getSnapshot().phase).toBe("finished");
    expect(f.review.enter()).toBe(true);
    expect(f.review.getSnapshot()).toMatchObject({
      phase: "choosing",
      chosen: [],
    });
    unchangedCalls(f);
  });
  it.each(["leave", "retire", "store-retire"] as const)(
    "%s wins over reentrant Start/Continue and never revives old handles",
    async (action) => {
      const f = await fixture();
      const state = start(f);
      const stop = f.review.subscribe(() => {
        f.review.start(state);
        f.review.continue(state);
      });
      const actions = {
        leave: () => f.review.leave(),
        retire: () => f.review.retire(),
        "store-retire": () => f.model.retire(),
      };
      actions[action]();
      stop();
      expect(f.review.getSnapshot().entered).toBe(false);
      expect(f.review.captureCurrent(state)).toBeNull();
      f.review.setAvailable(true);
      expect(f.review.getSnapshot().entered).toBe(false);
      unchangedCalls(f);
    },
  );
  it("end of an owned save is not a resumed review and a fresh session starts with no chosen plan", async () => {
    const f = await fixture();
    start(f);
    await f.model.coordinator.save();
    // A clean Save has no dispatch and no phase transition, so explicitly author first.
    f.model.edit(current(f), "result", "Updated");
    await f.model.coordinator.save();
    expect(f.review.getSnapshot().entered).toBe(false);
    expect(f.api.saveFollowups).toHaveBeenCalledTimes(1);
    const fresh = new ManagedFollowupsReviewSession(f.model);
    fresh.setAvailable(true);
    expect(fresh.getSnapshot()).toMatchObject({
      entered: false,
      chosen: [],
      selected: null,
    });
    fresh.retire();
  });
});
