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

describe("atomic current-holdings review admission", () => {
  it("installs the complete explicit order in one publication without draft mutation or requests", async () => {
    const f = await fixture();
    const captured = f.model.getReviewContext()!;
    const selected = [current(f, 2), current(f, 0)];
    const observed: ReturnType<typeof f.review.getSnapshot>[] = [];
    f.review.subscribe(() => observed.push(f.review.getSnapshot()));
    const installed = f.review.admitOrdered(captured, selected, () => true);
    expect(observed).toHaveLength(1);
    expect(installed).toBe(observed[0]);
    expect(installed).toBe(f.review.getSnapshot());
    expect(installed).toMatchObject({
      phase: "reviewing",
      position: 0,
      entered: true,
      available: true,
    });
    expect(installed!.chosen.map((row) => row.entry)).toEqual(selected);
    expect(installed!.selected?.entry).toBe(selected[0]);
    expect(f.model.coordinator.getSnapshot().draft).toBe(captured.draft);
    expect(Object.isFrozen(installed!.chosen)).toBe(true);
    unchangedCalls(f);
  });
  it("refuses zero, six, duplicate, foreign and copied entries without any publication", async () => {
    const f = await fixture(Array.from({ length: 6 }, (_, i) => entry(i + 1)));
    const captured = f.model.getReviewContext()!;
    const before = f.review.getSnapshot();
    const listener = vi.fn();
    f.review.subscribe(listener);
    for (const selected of [
      [],
      [...captured.draft.entries],
      [current(f), current(f)],
      [entry(1)],
      [{ ...current(f) }],
    ]) {
      expect(f.review.admitOrdered(captured, selected, () => true)).toBeNull();
      expect(f.review.getSnapshot()).toBe(before);
      expect(f.model.coordinator.getSnapshot().draft).toBe(captured.draft);
    }
    expect(listener).not.toHaveBeenCalled();
    expect(
      f.review.admitOrdered(
        captured,
        captured.draft.entries.slice(0, 5),
        () => true,
      )!.chosen,
    ).toHaveLength(5);
    unchangedCalls(f);
  });
  it.each(["later", "completed", "invalid"])(
    "refuses a current but %s check without mutation",
    async (kind) => {
      const f = await fixture();
      if (kind === "completed")
        f.model.complete(current(f), new Date("2026-10-24T12:00:00Z"));
      else
        f.model.edit(
          current(f),
          "dueOn",
          kind === "later" ? "2999-01-01" : "2026-02-30",
        );
      const captured = f.model.getReviewContext()!;
      const before = f.review.getSnapshot();
      const listener = vi.fn();
      f.review.subscribe(listener);
      expect(
        f.review.admitOrdered(captured, [current(f)], () => true),
      ).toBeNull();
      expect(f.review.getSnapshot()).toBe(before);
      expect(listener).not.toHaveBeenCalled();
    },
  );
  it("checks scope, exact draft, catalog and assessed day rather than accepting reconstructed context", async () => {
    const f = await fixture();
    const captured = f.model.getReviewContext()!;
    const before = f.review.getSnapshot();
    for (const altered of [
      { ...captured, scope: {} },
      { ...captured, draft: { ...captured.draft } },
      { ...captured, catalogSnapshotSha256: otherDigest },
      { ...captured, assessedOn: "2026-10-25" },
    ])
      expect(
        f.review.admitOrdered(altered, [current(f)], () => true),
      ).toBeNull();
    expect(f.review.getSnapshot()).toBe(before);
    f.model.edit(
      current(f),
      "result",
      "Owned edit changes draft before admission",
    );
    expect(
      f.review.admitOrdered(captured, [current(f)], () => true),
    ).toBeNull();
    const beforeDayChange = f.model.getReviewContext()!;
    f.model.reassessDueDate(new Date("2026-10-25T00:00:00Z"));
    f.model.reassessDueDate(new Date("2026-10-24T00:00:00Z"));
    expect(f.model.getReviewContext()!.draft).toBe(beforeDayChange.draft);
    expect(f.model.getReviewContext()!.scope).not.toBe(beforeDayChange.scope);
    expect(
      f.review.admitOrdered(beforeDayChange, [current(f)], () => true),
    ).toBeNull();
    expect(
      f.review.admitOrdered(captured, [current(f)], () => true),
    ).toBeNull();
  });
  it("requires the Portfolio capability twice before publishing and rejects capability reentry or route ABA", async () => {
    const f = await fixture();
    const captured = f.model.getReviewContext()!;
    const before = f.review.getSnapshot();
    const listener = vi.fn();
    f.review.subscribe(listener);
    expect(
      f.review.admitOrdered(captured, [current(f)], () => false),
    ).toBeNull();
    expect(
      f.review.admitOrdered(
        captured,
        [current(f)],
        vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
      ),
    ).toBeNull();
    expect(f.review.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    const nested = vi.fn(() => {
      expect(
        f.review.admitOrdered(captured, [current(f)], () => true),
      ).toBeNull();
      f.review.setAvailable(false);
      f.review.setAvailable(true);
      return true;
    });
    expect(f.review.admitOrdered(captured, [current(f)], nested)).toBeNull();
    expect(f.review.getSnapshot().entered).toBe(false);
  });
  it("refuses reentrant source edits in the final precommit capability check", async () => {
    const f = await fixture();
    const captured = f.model.getReviewContext()!;
    let calls = 0;
    expect(
      f.review.admitOrdered(captured, [current(f)], () => {
        if (++calls === 2)
          f.model.edit(current(f), "result", "Intervening authored result");
        return true;
      }),
    ).toBeNull();
    expect(f.review.getSnapshot().entered).toBe(false);
    expect(current(f).result).toBe("Intervening authored result");
  });
  it("returns no successful ownership after a reentrant publication retires the review", async () => {
    const f = await fixture();
    const captured = f.model.getReviewContext()!;
    const observed: ReturnType<typeof f.review.getSnapshot>[] = [];
    f.review.subscribe(() => {
      const state = f.review.getSnapshot();
      observed.push(state);
      if (state.phase === "reviewing") {
        expect(state.chosen).toHaveLength(2);
        expect(
          f.review.admitOrdered(captured, [current(f)], () => true),
        ).toBeNull();
        f.review.leave();
      }
    });
    expect(
      f.review.admitOrdered(captured, [current(f), current(f, 1)], () => true),
    ).toBeNull();
    expect(observed.map((state) => state.phase)).toEqual([
      "reviewing",
      "choosing",
    ]);
    expect(f.review.getSnapshot().entered).toBe(false);
  });
  it("returns null if the Portfolio capability is lost after the single installed publication", async () => {
    const f = await fixture();
    let currentPortfolio = true;
    f.review.subscribe(() => {
      currentPortfolio = false;
    });
    expect(
      f.review.admitOrdered(
        f.model.getReviewContext()!,
        [current(f)],
        () => currentPortfolio,
      ),
    ).toBeNull();
    expect(f.review.getSnapshot()).toMatchObject({
      entered: false,
      chosen: [],
    });
    expect(f.review.getSnapshot().reason).toBe(
      "Portfolio changed. Choose a new review.",
    );
  });
  it("does not clear a replacement installed inside the postpublication capability check", async () => {
    const f = await fixture();
    let calls = 0;
    let replacement: ReturnType<typeof f.review.getSnapshot> | null = null;
    const result = f.review.admitOrdered(
      f.model.getReviewContext()!,
      [current(f)],
      () => {
        if (++calls === 3) {
          f.review.leave();
          f.review.setAvailable(true);
          f.review.enter();
          replacement = f.review.getSnapshot();
          return false;
        }
        return true;
      },
    );
    expect(result).toBeNull();
    expect(f.review.getSnapshot()).toBe(replacement);
    expect(f.review.getSnapshot()).toMatchObject({
      entered: true,
      phase: "choosing",
    });
  });
  it("refuses paused or retired admission even when its capability says current", async () => {
    const f = await fixture();
    const captured = f.model.getReviewContext()!;
    f.review.setAvailable(false);
    const paused = f.review.getSnapshot();
    expect(
      f.review.admitOrdered(captured, [current(f)], () => true),
    ).toBeNull();
    expect(f.review.getSnapshot()).toBe(paused);
    f.review.setAvailable(true);
    f.review.retire();
    const retired = f.review.getSnapshot();
    expect(
      f.review.admitOrdered(captured, [current(f)], () => true),
    ).toBeNull();
    expect(f.review.getSnapshot()).toBe(retired);
  });
  it("does not replace an existing choosing/running review, but admits a fresh review after Finish", async () => {
    const f = await fixture();
    const captured = f.model.getReviewContext()!;
    f.review.enter();
    const choosing = f.review.getSnapshot();
    expect(
      f.review.admitOrdered(captured, [current(f)], () => true),
    ).toBeNull();
    expect(f.review.getSnapshot()).toBe(choosing);
    choose(f, 0);
    f.review.start(f.review.getSnapshot());
    const running = f.review.getSnapshot();
    expect(
      f.review.admitOrdered(captured, [current(f, 1)], () => true),
    ).toBeNull();
    expect(f.review.getSnapshot()).toBe(running);
    f.review.finish(running);
    expect(
      f.review.admitOrdered(captured, [current(f, 1)], () => true)?.selected
        ?.entry,
    ).toBe(current(f, 1));
  });
  it("retains admitted order through owned results/completion and retires on an external draft replacement", async () => {
    const f = await fixture();
    const installed = f.review.admitOrdered(
      f.model.getReviewContext()!,
      [current(f, 1), current(f)],
      () => true,
    )!;
    const handles = installed.chosen.map((row) => row.handle);
    f.model.edit(current(f, 1), "result", "  完全な結果 📈\n  ");
    f.model.complete(current(f, 1), new Date("2026-10-24T12:00:00Z"));
    const after = f.review.getSnapshot();
    expect(after.chosen.map((row) => row.handle)).toEqual(handles);
    expect(after.position).toBe(0);
    expect(after.selected?.entry.status).toBe("completed");
    expect(after.selected?.entry.result).toBe("  完全な結果 📈\n  ");
    f.model.coordinator.replaceDraft({
      ...f.model.coordinator.getSnapshot().draft!,
    });
    expect(f.review.getSnapshot().entered).toBe(false);
    unchangedCalls(f);
  });
});

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
      chosen: [{ entry: current(f) }, { entry: current(f, 1) }],
      selected: null,
      position: -1,
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
  it("Finish retains ordered readings until explicit enter and cannot auto-complete or Save", async () => {
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

describe("finished chosen review reading", () => {
  it("retains original handles and full current results/statuses without a current check or new requests", async () => {
    const f = await fixture();
    const started = start(f, [2, 0]);
    const handles = started.chosen.map((row) => row.handle);
    const raw = "  東京 📈 <script>literal</script>\ncomplete result  ";
    f.model.edit(current(f, 2), "result", raw);
    f.model.complete(current(f, 2), new Date("2026-10-24T12:00:00Z"));
    const before = f.review.getSnapshot();
    const draft = f.model.coordinator.getSnapshot().draft;
    f.review.finish(before);
    const finished = f.review.getSnapshot();
    expect(finished).toMatchObject({
      entered: true,
      phase: "finished",
      selected: null,
      position: -1,
    });
    expect(finished.chosen).toBe(before.chosen);
    expect(finished.chosen.map((row) => row.handle)).toEqual(handles);
    expect(finished.chosen.map((row) => row.entry)).toEqual([
      current(f, 2),
      current(f),
    ]);
    expect(finished.chosen[0]!.entry.result).toBe(raw);
    expect(f.model.coordinator.getSnapshot().draft).toBe(draft);
    expect(f.review.captureCurrent(finished)).toBeNull();
    expect(f.review.canContinue(finished)).toBe(false);
    expect(f.review.canStart(finished)).toBe(false);
    f.review.continue(before);
    f.review.finish(before);
    f.review.start(finished);
    expect(f.review.getSnapshot()).toBe(finished);
    f.model.reopen(current(f, 2));
    f.model.edit(current(f), "result", "  Later complete text 😀  ");
    f.model.complete(current(f), new Date("2026-10-24T12:00:00Z"));
    const refreshed = f.review.getSnapshot();
    expect(refreshed).toMatchObject({
      phase: "finished",
      selected: null,
      position: -1,
    });
    expect(refreshed.chosen.map((row) => row.handle)).toEqual(handles);
    expect(
      refreshed.chosen.map((row) => [row.entry.status, row.entry.result]),
    ).toEqual([
      ["open", raw],
      ["completed", "  Later complete text 😀  "],
    ]);
    expect(Object.isFrozen(refreshed.chosen)).toBe(true);
    expect(f.review.captureCurrent(refreshed)).toBeNull();
    unchangedCalls(f);
  });

  it.each([
    "question",
    "date",
    "remove",
    "draft",
    "catalog",
    "day",
    "save",
    "load",
    "retire",
  ] as const)(
    "retires finished records after %s and never revives old actions",
    async (boundary) => {
      const f = await fixture();
      start(f, [1, 0]);
      f.model.edit(current(f), "result", "Unsaved authored result");
      f.review.finish(f.review.getSnapshot());
      const finished = f.review.getSnapshot();
      const draft = f.model.coordinator.getSnapshot().draft!;
      if (boundary === "question")
        f.model.edit(current(f), "check", "Changed question");
      if (boundary === "date") f.model.edit(current(f), "dueOn", "2026-10-25");
      if (boundary === "remove") f.model.remove(current(f));
      if (boundary === "draft")
        f.model.coordinator.replaceDraft(structuredClone(draft));
      if (boundary === "catalog") f.model.syncCatalog(otherDigest);
      if (boundary === "day")
        f.model.reassessDueDate(new Date("2026-10-25T00:00:00Z"));
      if (boundary === "save") await f.model.coordinator.save();
      if (boundary === "load") await f.model.coordinator.load();
      if (boundary === "retire") f.model.retire();
      expect(f.review.getSnapshot()).toMatchObject({
        entered: false,
        chosen: [],
        selected: null,
        position: -1,
      });
      if (boundary !== "retire") f.model.coordinator.replaceDraft(draft);
      const cleared = f.review.getSnapshot();
      f.review.finish(finished);
      f.review.start(finished);
      f.review.continue(finished);
      f.review.choose(finished, finished.chosen[0]!.handle);
      expect(f.review.getSnapshot()).toBe(cleared);
      expect(f.review.captureCurrent(finished)).toBeNull();
    },
  );

  it.each(["enter", "leave"] as const)(
    "%s clears terminal records and does not reuse their handles",
    async (action) => {
      const f = await fixture();
      const original = start(f, [1, 0]);
      f.review.finish(original);
      if (action === "leave") {
        f.review.leave();
        expect(f.review.getSnapshot().chosen).toEqual([]);
        f.review.setAvailable(true);
      }
      expect(f.review.enter()).toBe(true);
      const choosing = f.review.getSnapshot();
      expect(choosing.chosen).toEqual([]);
      expect(
        choosing.rows.every(
          (row) => !original.chosen.some((old) => old.handle === row.handle),
        ),
      ).toBe(true);
      f.review.choose(choosing, original.chosen[0]!.handle);
      expect(f.review.getSnapshot()).toBe(choosing);
      unchangedCalls(f);
    },
  );
});
