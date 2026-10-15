import { describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedResearchFollowupsDto,
  ResearchFollowup,
  ResearchFollowupsPayload,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { ManagedResearchFollowups } from "./managed-research-followups";
import { SaveCoordinator } from "./save-coordinator";
import type { SavePort } from "./save-coordinator";
import { MANAGED_WATCHLIST_SAVE_COPY } from "./save-coordinator-copy";
import type { TrialSession } from "./session";

const digest = `sha256:${"a".repeat(64)}` as const;
const nextDigest = `sha256:${"b".repeat(64)}` as const;
const id = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const listing = {
  country: "US",
  exchangeMic: "XNAS",
  instrumentType: "common_stock",
  issuerId: "issuer-one",
  issuerName: "Invented issuer",
  listingId: "listing-one",
  securityId: "security-one",
  securityName: "Common stock",
  shareClassId: "class-one",
  shareClassName: "Class A",
  symbol: "DEMO",
} as const;
const member: WatchlistMembership = {
  ...listing,
  note: "unsaved watchlist note",
};
const entry = (number = 1): ResearchFollowup => ({
  id: id(number),
  catalogSnapshotSha256: digest,
  listing: { ...listing, listingId: `listing-${number}` },
  check: "Review the next filing",
  dueOn: "2026-10-20",
  status: "open",
  completedOn: null,
  result: "",
});
const payload = (...entries: ResearchFollowup[]): ResearchFollowupsPayload => ({
  schemaVersion: 1,
  entries,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(initial = payload(), newEntryId?: () => string) {
  let stored: ManagedResearchFollowupsDto = {
    version: initial.entries.length ? 1 : 0,
    payload: initial,
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
          listing: { ...listing, listingId },
        })),
      }),
    ),
  };
  const session: TrialSession = {
    userId: "user-invented",
    sessionId: "session-invented",
    getToken: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  const context: {
    draft: MainWatchlistPayload | null;
    catalogSnapshotSha256: string | null;
  } = {
    draft: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: digest,
      memberships: [member],
    },
    catalogSnapshotSha256: digest,
  };
  let key = 0;
  let entryId = 100;
  const onRetire = vi.fn();
  const model = new ManagedResearchFollowups(api, session, {
    getCreationContext: () => context,
    onRetire,
    newKey: () => `invented-followup-${++key}`,
    newEntryId: newEntryId ?? (() => id(entryId++)),
  });
  const current = (index = 0) =>
    model.coordinator.getSnapshot().draft!.entries[index]!;
  return { model, api, session, context, onRetire, current };
}

describe("independent managed research follow-ups", () => {
  it("requires explicit load and adds only the actual current watchlist member", async () => {
    const f = fixture();
    f.model.add(member, "2026-10-20");
    expect(f.model.coordinator.getSnapshot().draft).toBeNull();
    expect(f.api.loadFollowups).not.toHaveBeenCalled();
    await f.model.coordinator.load();
    f.model.add({ ...member }, "2026-10-20");
    expect(f.model.coordinator.getSnapshot().draft?.entries).toEqual([]);
    f.model.add(member, "invalid date retained");
    expect(f.current()).toMatchObject({
      check: "",
      dueOn: "invalid date retained",
      listing,
    });
    expect(f.current().listing).not.toHaveProperty("note");
    expect(f.model.getSnapshot().selectedId).toBe(f.current().id);
    expect(f.model.canSavePayload()).toBe(false);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(f.api.resolve).not.toHaveBeenCalled();
    expect(f.context.draft?.memberships[0]).toBe(member);
  });

  it("refuses stale catalogs, replaced membership, and reentrant creation callbacks", async () => {
    const f = fixture();
    await f.model.coordinator.load();
    f.context.catalogSnapshotSha256 = nextDigest;
    f.model.syncCatalog(nextDigest);
    f.model.add(member, "2026-10-20");
    expect(f.model.coordinator.getSnapshot().draft?.entries).toEqual([]);
    f.context.draft = {
      ...f.context.draft!,
      snapshotSha256: nextDigest,
      memberships: [{ ...member }],
    };
    f.model.add(member, "2026-10-20");
    expect(f.model.coordinator.getSnapshot().draft?.entries).toEqual([]);
    const reentrant = fixture(payload(), () => {
      reentrant.context.draft = { ...reentrant.context.draft! };
      return id(100);
    });
    await reentrant.model.coordinator.load();
    reentrant.model.add(member, "2026-10-20");
    expect(reentrant.model.coordinator.getSnapshot().draft?.entries).toEqual(
      [],
    );
  });

  it("rechecks full member identity after entry ID creation reenters the context", async () => {
    const mutable = { ...member };
    const f = fixture(payload(), () => {
      mutable.exchangeMic = "XNYS";
      return id(100);
    });
    f.context.draft = { ...f.context.draft!, memberships: [mutable] };
    await f.model.coordinator.load();
    f.model.add(mutable, "2026-10-20");
    expect(f.model.coordinator.getSnapshot().draft?.entries).toEqual([]);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  });

  it("keeps complete raw inputs and normalizes only the captured save", async () => {
    const f = fixture(payload(entry()));
    await f.model.coordinator.load();
    f.model.edit(f.current(), "check", "  Cafe\u0301 review  ");
    f.model.edit(f.current(), "result", "  Re\u0301sult  ");
    expect(f.current().check).toBe("  Cafe\u0301 review  ");
    expect(f.current().result).toBe("  Re\u0301sult  ");
    await f.model.coordinator.save();
    expect(
      f.api.saveFollowups.mock.calls[0]![0].payload.entries[0],
    ).toMatchObject({ check: "Café review", result: "Résult" });
    expect(f.current().check).toBe("Café review");
    expect(Object.isFrozen(f.current().listing)).toBe(true);
    expect(f.api.resolve).not.toHaveBeenCalled();
  });

  it.each([
    ["check", "x".repeat(501)],
    ["result", "x".repeat(2001)],
    ["check", "line\ncontrol"],
    ["dueOn", "2026-02-29"],
  ] as const)(
    "refuses invalid %s without clipping raw input",
    async (field, raw) => {
      const f = fixture(payload(entry()));
      await f.model.coordinator.load();
      f.model.edit(f.current(), field, raw);
      expect(f.current()[field]).toBe(raw);
      expect(f.model.canSavePayload()).toBe(false);
      await f.model.coordinator.save();
      expect(f.api.saveFollowups).not.toHaveBeenCalled();
      expect(f.current()[field]).toBe(raw);
      expect(f.model.coordinator.getSnapshot().dirty).toBe(true);
    },
  );

  it("requires exact current entry references for every author action", async () => {
    const f = fixture(payload(entry()));
    await f.model.coordinator.load();
    const old = f.current();
    f.model.edit(old, "check", "Changed check");
    f.model.edit(old, "result", "stale overwrite");
    f.model.remove(old);
    f.model.complete(old, new Date("2026-10-15T23:59:59Z"));
    f.model.reopen({
      ...f.current(),
      status: "completed",
      completedOn: "2026-10-15",
    });
    expect(f.current()).toMatchObject({
      check: "Changed check",
      result: "",
      status: "open",
    });
    f.model.remove(f.current());
    expect(f.model.currentEntry(old.id)).toBeNull();
  });

  it("captures completion UTC day, refuses invalid clocks, and reopens without losing result", async () => {
    const f = fixture(payload(entry()));
    await f.model.coordinator.load();
    f.model.edit(f.current(), "result", "Authored result");
    const before = f.current();
    f.model.complete(before, new Date(NaN));
    expect(f.current()).toBe(before);
    f.model.complete(before, new Date("+010000-01-01T00:00:00Z"));
    expect(f.current()).toBe(before);
    f.model.complete(before, new Date("2026-10-15T23:30:00-02:00"));
    expect(f.current()).toMatchObject({
      status: "completed",
      completedOn: "2026-10-16",
      result: "Authored result",
    });
    await f.model.coordinator.save();
    await f.model.coordinator.load();
    expect(f.current().completedOn).toBe("2026-10-16");
    f.model.reopen(f.current());
    expect(f.current()).toMatchObject({
      status: "open",
      completedOn: null,
      result: "Authored result",
    });
    await f.model.coordinator.save();
    expect(f.api.saveFollowups).toHaveBeenCalledTimes(2);
  });

  it("keeps selection/filter local and refuses duplicate IDs/listings and the twenty-first entry", async () => {
    const f = fixture(payload(entry(1)), () => id(1));
    await f.model.coordinator.load();
    f.model.add(member, "2026-10-20");
    expect(f.model.coordinator.getSnapshot().draft?.entries).toHaveLength(1);
    const g = fixture(payload({ ...entry(), listing }));
    await g.model.coordinator.load();
    g.model.add(member, "2026-10-20");
    expect(g.model.coordinator.getSnapshot().draft?.entries).toHaveLength(1);
    const full = fixture(
      payload(...Array.from({ length: 20 }, (_, i) => entry(i + 1))),
    );
    await full.model.coordinator.load();
    const before = full.model.coordinator.getSnapshot().draft;
    full.model.add(member, "2026-10-20");
    full.model.select(full.current().id);
    full.model.setFilter("completed");
    expect(full.model.coordinator.getSnapshot().draft).toBe(before);
    expect(full.model.coordinator.getSnapshot().dirty).toBe(false);
    expect(full.model.getSnapshot().filter).toBe("completed");
    expect(full.api.resolve).not.toHaveBeenCalled();
  });

  it("does not change a dirty watchlist command while follow-ups save independently", async () => {
    const f = fixture(payload(entry()));
    const watchSave = deferred<{
      version: number;
      payload: MainWatchlistPayload;
      replayed: boolean;
    }>();
    const save = vi.fn<SavePort<MainWatchlistPayload>["save"]>(
      () => watchSave.promise,
    );
    const watch = new SaveCoordinator<MainWatchlistPayload>(
      {
        mode: "managed",
        empty: () => null,
        copy: structuredClone,
        capture: (value) => value,
        load: () => Promise.resolve({ version: 4, payload: f.context.draft! }),
        save,
      },
      f.session,
      MANAGED_WATCHLIST_SAVE_COPY,
      { newKey: () => "watchlist-command-1" },
    );
    await watch.load();
    watch.replaceDraft(f.context.draft!);
    const pending = watch.save();
    const watchState = watch.getSnapshot();
    const command = structuredClone(save.mock.calls[0]![0]);
    await f.model.coordinator.load();
    f.model.edit(f.current(), "check", "Independent follow-up");
    await f.model.coordinator.save();
    expect(watch.getSnapshot()).toBe(watchState);
    expect(save.mock.calls[0]![0]).toEqual(command);
    expect(save).toHaveBeenCalledTimes(1);
    expect(f.api.saveFollowups.mock.calls[0]![0].expectedVersion).toBe(1);
    watchSave.resolve({
      version: 5,
      payload: f.context.draft!,
      replayed: false,
    });
    await pending;
  });

  it("retains a conflicting draft until a successful latest load and explicit choice", async () => {
    const f = fixture(payload(entry()));
    await f.model.coordinator.load();
    f.model.edit(f.current(), "check", "My local plan");
    f.api.saveFollowups.mockRejectedValueOnce(new TrialApiError("conflict"));
    await f.model.coordinator.save();
    f.model.coordinator.useSaved();
    expect(f.current().check).toBe("My local plan");
    f.api.loadFollowups.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.model.coordinator.load();
    f.model.coordinator.keepDraft();
    expect(f.model.coordinator.getSnapshot().baseVersion).toBe(1);
    f.api.loadFollowups.mockResolvedValueOnce({
      version: 3,
      payload: payload({ ...entry(), check: "Other device" }),
    });
    await f.model.coordinator.load();
    expect(f.current().check).toBe("My local plan");
    f.model.coordinator.keepDraft();
    await f.model.coordinator.save();
    expect(f.api.saveFollowups.mock.calls[1]![0]).toMatchObject({
      expectedVersion: 3,
      payload: { entries: [{ check: "My local plan" }] },
    });
  });

  it("freezes raw author edits during conflict until an explicit choice, independently of watchlist edits", async () => {
    const completed: ResearchFollowup = {
      ...entry(2),
      status: "completed",
      completedOn: "2026-10-14",
    };
    const f = fixture(payload(entry(), completed));
    const watchSave = vi.fn<SavePort<MainWatchlistPayload>["save"]>();
    const watch = new SaveCoordinator<MainWatchlistPayload>(
      {
        mode: "managed",
        empty: () => null,
        copy: structuredClone,
        capture: (value) => value,
        load: () => Promise.resolve({ version: 4, payload: f.context.draft! }),
        save: watchSave,
      },
      f.session,
      MANAGED_WATCHLIST_SAVE_COPY,
    );
    await watch.load();
    await f.model.coordinator.load();
    f.model.edit(f.current(), "check", "  Invalid\nraw check  ");
    f.model.edit(f.current(), "dueOn", "invalid raw date");
    const raw = f.model.coordinator.getSnapshot().draft!;
    await f.model.coordinator.load();
    expect(f.model.coordinator.getSnapshot()).toMatchObject({
      conflict: true,
      latestLoaded: true,
    });
    expect(f.model.canEdit()).toBe(false);
    f.model.edit(f.current(), "check", "Blocked overwrite");
    f.model.edit(f.current(), "result", "Blocked result");
    f.model.edit(f.current(), "dueOn", "2026-10-15");
    f.model.complete(f.current(), new Date("2026-10-15T00:00:00Z"));
    f.model.reopen(f.current(1));
    f.model.remove(f.current());
    f.model.add(member, "2026-10-20");
    await f.model.reviewCatalog();
    expect(f.model.coordinator.getSnapshot().draft).toBe(raw);
    expect(f.model.currentEntry(raw.entries[0]!.id)).toBe(raw.entries[0]);
    expect(f.api.resolve).not.toHaveBeenCalled();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(watch.canEdit()).toBe(true);
    watch.replaceDraft({
      ...f.context.draft!,
      memberships: [{ ...member, note: "Independent watchlist edit" }],
    });
    expect(watch.getSnapshot().draft?.memberships[0]!.note).toBe(
      "Independent watchlist edit",
    );
    expect(f.model.coordinator.getSnapshot().draft).toBe(raw);
    expect(watchSave).not.toHaveBeenCalled();
    f.model.coordinator.keepDraft();
    expect(f.model.canEdit()).toBe(true);
    expect(f.current()).toMatchObject({
      check: "  Invalid\nraw check  ",
      dueOn: "invalid raw date",
    });
    f.model.edit(f.current(), "check", "Corrected explicitly");
    expect(f.current().check).toBe("Corrected explicitly");
    expect(f.current().dueOn).toBe("invalid raw date");
  });

  it("reconciles the exact unknown command then requires latest state after an old replay", async () => {
    const f = fixture(payload(entry()));
    await f.model.coordinator.load();
    f.model.edit(f.current(), "check", "Captured plan");
    f.api.saveFollowups.mockRejectedValueOnce(
      new TrialApiError("commit_unknown"),
    );
    await f.model.coordinator.save();
    const command = f.api.saveFollowups.mock.calls[0]![0];
    f.model.edit(f.current(), "check", "Forbidden while uncertain");
    f.model.remove(f.current());
    expect(f.current().check).toBe("Captured plan");
    f.api.saveFollowups.mockResolvedValueOnce({
      version: 2,
      payload: command.payload,
      replayed: true,
    });
    await f.model.coordinator.reconcile();
    expect(f.api.saveFollowups.mock.calls[1]![0]).toEqual(command);
    expect(f.model.coordinator.getSnapshot()).toMatchObject({
      replayPending: true,
      conflict: true,
      latestLoaded: false,
    });
    f.model.coordinator.useSaved();
    expect(f.model.coordinator.getSnapshot().replayPending).toBe(true);
    f.api.loadFollowups.mockResolvedValueOnce({
      version: 3,
      payload: payload({ ...entry(), check: "Later shared plan" }),
    });
    await f.model.coordinator.load();
    f.model.coordinator.useSaved();
    expect(f.current().check).toBe("Later shared plan");
    expect(f.model.coordinator.getSnapshot().baseVersion).toBe(3);
  });

  it("does not accept a substituted save receipt", async () => {
    const f = fixture(payload(entry()));
    await f.model.coordinator.load();
    f.model.edit(f.current(), "check", "Captured plan");
    f.api.saveFollowups.mockResolvedValueOnce({
      version: 2,
      payload: payload(entry()),
      replayed: false,
    });
    await f.model.coordinator.save();
    expect(f.model.coordinator.getSnapshot().uncertain).toBe(true);
    expect(f.current().check).toBe("Captured plan");
  });

  it("reviews at most twenty identities in one request and retains missing/rebound entries", async () => {
    const f = fixture(payload(entry(1), entry(2), entry(3)));
    await f.model.coordinator.load();
    f.model.syncCatalog(nextDigest);
    f.api.resolve.mockResolvedValueOnce({
      snapshotSha256: nextDigest,
      results: [
        {
          listingId: "listing-1",
          listing: {
            ...listing,
            listingId: "listing-1",
            issuerName: "Updated name",
            symbol: "NEW",
          },
        },
        { listingId: "listing-2", listing: null },
        {
          listingId: "listing-3",
          listing: { ...listing, listingId: "listing-3", exchangeMic: "XNYS" },
        },
      ],
    });
    const before = f.model.coordinator.getSnapshot().draft!;
    await f.model.reviewCatalog();
    expect(f.api.resolve).toHaveBeenCalledTimes(1);
    expect(f.api.resolve.mock.calls[0]![0]).toEqual({
      snapshotSha256: nextDigest,
      listingIds: ["listing-1", "listing-2", "listing-3"],
    });
    expect(
      f.model.getSnapshot().review?.entries.map((item) => item.status),
    ).toEqual(["update", "missing", "rebound"]);
    f.model.applyReview();
    expect(f.current()).toMatchObject({
      catalogSnapshotSha256: nextDigest,
      listing: { issuerName: "Updated name", symbol: "NEW" },
      check: before.entries[0]!.check,
    });
    expect(f.current(1)).toEqual(before.entries[1]);
    expect(f.current(2)).toEqual(before.entries[2]);
    f.model.edit(f.current(1), "result", "Keep planning after catalog removal");
    expect(f.current(1).result).toBe("Keep planning after catalog removal");
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  });

  it.each([
    "issuerId",
    "securityId",
    "shareClassId",
    "instrumentType",
  ] as const)("does not reassign retained %s during review", async (field) => {
    const f = fixture(payload(entry()));
    await f.model.coordinator.load();
    f.api.resolve.mockResolvedValueOnce({
      snapshotSha256: digest,
      results: [
        {
          listingId: "listing-1",
          listing: {
            ...entry().listing,
            [field]: field === "instrumentType" ? "adr" : "different-id",
          },
        },
      ],
    });
    const before = f.current();
    await f.model.reviewCatalog();
    expect(f.model.getSnapshot().review?.entries[0]!.status).toBe("rebound");
    f.model.applyReview();
    expect(f.current()).toEqual(before);
  });

  it.each(["draft", "catalog", "retire"] as const)(
    "aborts identity review and ignores a late result after %s changes",
    async (change) => {
      const f = fixture(payload(entry()));
      await f.model.coordinator.load();
      const pending = deferred<Awaited<ReturnType<ManagedApi["resolve"]>>>();
      f.api.resolve.mockReturnValueOnce(pending.promise);
      const work = f.model.reviewCatalog();
      const signal = f.api.resolve.mock.calls[0]![1];
      if (change === "draft") f.model.edit(f.current(), "check", "New draft");
      else if (change === "catalog") f.model.syncCatalog(nextDigest);
      else f.model.retire();
      expect(signal.aborted).toBe(true);
      pending.resolve({
        snapshotSha256: digest,
        results: [{ listingId: "listing-1", listing: entry().listing }],
      });
      await work;
      expect(f.model.getSnapshot().review).toBeNull();
      expect(f.model.getSnapshot().reviewing).toBe(false);
      f.model.applyReview();
      if (change === "draft") expect(f.current().check).toBe("New draft");
      expect(f.session.signOut).not.toHaveBeenCalled();
    },
  );

  it("rechecks reentrant listeners before dispatch and refuses stale apply", async () => {
    const f = fixture(payload(entry()));
    await f.model.coordinator.load();
    const stop = f.model.subscribe(() => {
      if (f.model.getSnapshot().reviewing)
        f.model.edit(f.current(), "check", "Reentrant draft");
    });
    await f.model.reviewCatalog();
    expect(f.api.resolve).not.toHaveBeenCalled();
    stop();
    await f.model.reviewCatalog();
    expect(f.model.getSnapshot().review).not.toBeNull();
    f.model.edit(f.current(), "result", "Changed after review");
    const before = f.model.coordinator.getSnapshot().draft;
    f.model.applyReview();
    expect(f.model.coordinator.getSnapshot().draft).toBe(before);
  });

  it("rejects an incorrectly bound identity response without changing the draft", async () => {
    const f = fixture(payload(entry()));
    await f.model.coordinator.load();
    const before = f.current();
    f.api.resolve.mockResolvedValueOnce({
      snapshotSha256: nextDigest,
      results: [{ listingId: "listing-1", listing: entry().listing }],
    });
    await f.model.reviewCatalog();
    expect(f.model.getSnapshot().review).toBeNull();
    expect(f.model.getSnapshot().message).toContain("could not finish");
    expect(f.current()).toBe(before);
  });

  it.each(["load", "save", "resolve"] as const)(
    "retires through the aggregate callback after fatal %s and never signs out the SDK",
    async (action) => {
      const f = fixture(payload(entry()));
      await f.model.coordinator.load();
      f.model.select(f.current().id);
      f.model.setFilter("all");
      const error = new TrialApiError("unauthenticated");
      if (action === "load") {
        f.api.loadFollowups.mockRejectedValueOnce(error);
        await f.model.coordinator.load();
      } else if (action === "save") {
        f.model.edit(f.current(), "check", "Changed");
        f.api.saveFollowups.mockRejectedValueOnce(error);
        await f.model.coordinator.save();
      } else {
        f.api.resolve.mockRejectedValueOnce(error);
        await f.model.reviewCatalog();
      }
      expect(f.onRetire).toHaveBeenCalledTimes(1);
      expect(f.model.coordinator.getSnapshot()).toMatchObject({
        phase: "retired",
        draft: null,
        saved: null,
      });
      expect(f.model.getSnapshot()).toMatchObject({
        selectedId: null,
        filter: "open",
        catalogSnapshotSha256: null,
        review: null,
        reviewing: false,
      });
      f.model.retire();
      expect(f.onRetire).toHaveBeenCalledTimes(1);
      expect(f.session.signOut).not.toHaveBeenCalled();
    },
  );

  it("discards a successful late save after local retirement", async () => {
    const f = fixture(payload(entry()));
    await f.model.coordinator.load();
    f.model.edit(f.current(), "check", "Captured plan");
    const pending =
      deferred<Awaited<ReturnType<ManagedApi["saveFollowups"]>>>();
    f.api.saveFollowups.mockReturnValueOnce(pending.promise);
    const work = f.model.coordinator.save();
    const [command, signal] = f.api.saveFollowups.mock.calls[0]!;
    f.model.retire();
    expect(signal.aborted).toBe(true);
    pending.resolve({ version: 2, payload: command.payload, replayed: false });
    await work;
    expect(f.model.coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
      saved: null,
    });
    expect(f.onRetire).toHaveBeenCalledTimes(1);
  });
});
