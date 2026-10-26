import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";

const fixtures: Awaited<ReturnType<typeof createFollowupsReviewFixture>>[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T02:00:00.123Z"));
});
afterEach(() => {
  for (const f of fixtures.splice(0)) f.dispose();
  vi.useRealTimers();
});
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function fixture() {
  const f = await createFollowupsReviewFixture();
  fixtures.push(f);
  let saved = structuredClone(f.workspace.coordinator.getSnapshot().saved!);
  vi.mocked(f.api.load).mockImplementation(() =>
    Promise.resolve(structuredClone(saved)),
  );
  vi.spyOn(f.api, "save").mockImplementation((command) => {
    expect(command.expectedVersion).toBe(saved.version);
    saved = {
      version: saved.version + 1,
      payload: structuredClone(command.payload),
    };
    return Promise.resolve({ ...structuredClone(saved), replayed: false });
  });
  expect(f.model.enter()).toBe(true);
  f.model.choose(f.model.getSnapshot(), f.model.getSnapshot().rows[0]!.handle);
  f.model.start(f.model.getSnapshot());
  const context = await f.open();
  context.editAssessment("Assessment · Cafe\u0301 東京 😀");
  const selection = f.workspace.getSnapshot().research!.selection;
  const capture = () =>
    f.workspace.captureFollowupReviewNote(selection, () => true)!;
  const current = () => f.workspace.followups.currentEntry(f.entries[0]!.id)!;
  return { ...f, selection, capture, current };
}
function noSources(f: Awaited<ReturnType<typeof fixture>>) {
  for (const source of [
    f.api.eodHistory,
    f.api.annualReport,
    f.api.recentFilings,
  ])
    expect(source).not.toHaveBeenCalled();
}

it("previews full raw note, appends once before reentrant notification, keeps Back and separate Saves/fresh Load", async () => {
  const f = await fixture();
  const raw = "  Cafe\u0301 source 2026-09-20 https://example.test/filing  ";
  f.workspace.note(f.selection.listing.listingId, raw);
  const followups = f.workspace.followups.coordinator.getSnapshot().draft;
  const preview = f.capture().prepare().preview!;
  expect(preview.note.startsWith(raw + " ")).toBe(true);
  expect(preview.note).toContain("Assessment · Cafe\u0301 東京 😀");
  expect(preview.recordedAt).toBe("2026-10-26T02:00:00.123Z");
  let reentrant: boolean | null = null;
  const stop = f.workspace.coordinator.subscribe(() => {
    reentrant = preview.append();
  });
  expect(preview.append()).toBe(true);
  stop();
  expect(reentrant).toBe(false);
  expect(preview.append()).toBe(false);
  expect(
    f.workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
  ).toBe(preview.note);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(followups);
  expect(f.api.save).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  vi.setSystemTime(new Date("2026-10-27T11:00:00.000Z"));
  expect(f.capture().prepare().reason).toContain("already");
  f.workspace.closeResearch();
  expect(f.model.getSnapshot()).toMatchObject({
    position: 0,
    entered: true,
    available: true,
  });
  expect(f.model.getSnapshot().selected!.entry.result).toBe(f.current().result);
  const retained = f.workspace.followups.coordinator.getSnapshot().draft;
  await f.workspace.coordinator.save();
  expect(f.api.save).toHaveBeenCalledOnce();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(retained);
  const firstFresh = f.make();
  await firstFresh.refreshCatalog();
  await firstFresh.coordinator.load();
  await firstFresh.followups.coordinator.load();
  expect(
    firstFresh.coordinator.getSnapshot().draft!.memberships[0]!.note,
  ).toContain("source 2026-09-20");
  expect(firstFresh.followups.currentEntry(f.entries[0]!.id)!.result).toBe("");
  await f.workspace.followups.coordinator.save();
  const fresh = f.make();
  await fresh.refreshCatalog();
  await fresh.coordinator.load();
  await fresh.followups.coordinator.load();
  expect(fresh.followups.currentEntry(f.entries[0]!.id)!.result).toBe(
    "Assessment · Café 東京 😀",
  );
  expect(fresh.coordinator.getSnapshot().draft!.memberships[0]!.note).toContain(
    "recorded at (UTC): 2026-10-26T02:00:00.123Z",
  );
  noSources(f);
});

it("saving only Follow-ups does not persist the appended Watchlist note", async () => {
  const f = await fixture();
  const original =
    f.workspace.coordinator.getSnapshot().saved!.payload.memberships[0]!.note;
  expect(f.capture().prepare().preview!.append()).toBe(true);
  await f.workspace.followups.coordinator.save();
  const fresh = f.make();
  await fresh.refreshCatalog();
  await fresh.coordinator.load();
  await fresh.followups.coordinator.load();
  expect(fresh.coordinator.getSnapshot().draft!.memberships[0]!.note).toBe(
    original,
  );
  expect(fresh.followups.currentEntry(f.entries[0]!.id)!.result).toBe(
    "Assessment · Café 東京 😀",
  );
  expect(f.api.save).not.toHaveBeenCalled();
  noSources(f);
});

it("cancel consumes the proposal without changing either draft or original dates", async () => {
  const f = await fixture();
  const before = [
    f.workspace.coordinator.getSnapshot(),
    f.workspace.followups.coordinator.getSnapshot(),
  ];
  const preview = f.capture().prepare().preview!;
  preview.cancel();
  expect(preview.append()).toBe(false);
  expect([
    f.workspace.coordinator.getSnapshot(),
    f.workspace.followups.coordinator.getSnapshot(),
  ]).toEqual(before);
  expect(f.current()).toMatchObject({
    dueOn: "2026-10-20",
    completedOn: null,
    status: "open",
  });
  noSources(f);
});

type NoteFixture = Awaited<ReturnType<typeof fixture>>;
const boundaries = [
  {
    name: "watchlist equal draft",
    retire(this: void, f: NoteFixture) {
      f.workspace.coordinator.replaceDraft({
        ...f.workspace.coordinator.getSnapshot().draft!,
      });
    },
  },
  {
    name: "watchlist note round trip",
    retire(this: void, f: NoteFixture) {
      const note =
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!.note;
      f.workspace.note(f.selection.listing.listingId, "changed");
      f.workspace.note(f.selection.listing.listingId, note);
    },
  },
  {
    name: "followups equal draft",
    retire(this: void, f: NoteFixture) {
      f.workspace.followups.coordinator.replaceDraft({
        ...f.workspace.followups.coordinator.getSnapshot().draft!,
      });
    },
  },
  {
    name: "assessment round trip",
    retire(this: void, f: NoteFixture) {
      const value = f.current().result;
      f.workspace.followups.edit(f.current(), "result", "changed");
      f.workspace.followups.edit(f.current(), "result", value);
    },
  },
  {
    name: "question",
    retire(this: void, f: NoteFixture) {
      f.workspace.followups.edit(f.current(), "check", "Changed question");
    },
  },
  {
    name: "due date",
    retire(this: void, f: NoteFixture) {
      f.workspace.followups.edit(f.current(), "dueOn", "2026-10-21");
    },
  },
  {
    name: "completion",
    retire(this: void, f: NoteFixture) {
      f.workspace.followups.complete(
        f.current(),
        new Date("2026-10-26T00:00:00Z"),
      );
    },
  },
  {
    name: "identity",
    retire(this: void, f: NoteFixture) {
      f.workspace.followups.coordinator.replaceDraft({
        schemaVersion: 1,
        entries: [
          {
            ...f.current(),
            listing: { ...f.current().listing, shareClassId: "other-class" },
          },
        ],
      });
    },
  },
  {
    name: "destination identity",
    retire(this: void, f: NoteFixture) {
      const draft = f.workspace.coordinator.getSnapshot().draft!;
      f.workspace.coordinator.replaceDraft({
        ...draft,
        memberships: draft.memberships.map((member) => ({
          ...member,
          shareClassId: "changed-destination-class",
        })),
      });
    },
  },
  {
    name: "catalog",
    retire(this: void, f: NoteFixture) {
      f.workspace.followups.syncCatalog(`sha256:${"b".repeat(64)}`);
    },
  },
  {
    name: "navigation round trip",
    retire(this: void, f: NoteFixture) {
      f.workspace.setNavigationBlocked(true);
      f.workspace.setNavigationBlocked(false);
    },
  },
  {
    name: "view round trip",
    retire(this: void, f: NoteFixture) {
      f.workspace.setView("markets");
      f.workspace.setView("followups");
    },
  },
  {
    name: "close",
    retire(this: void, f: NoteFixture) {
      f.workspace.closeResearch();
    },
  },
  {
    name: "session",
    retire(this: void, f: NoteFixture) {
      f.workspace.sessionOwner.retire();
    },
  },
];
it.each(boundaries)(
  "permanently retires a captured note after $name",
  async ({ retire }) => {
    const f = await fixture();
    const preview = f.capture().prepare().preview!;
    retire(f);
    const after = f.workspace.coordinator.getSnapshot().draft;
    expect(preview.isCurrent()).toBe(false);
    expect(preview.append()).toBe(false);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(after);
    noSources(f);
  },
);

it("refuses a missing destination and never adds a Watchlist member", async () => {
  const f = await fixture();
  f.workspace.coordinator.replaceDraft({
    ...f.workspace.coordinator.getSnapshot().draft!,
    memberships: [],
  });
  const capture = f.capture();
  expect(capture.reason).toContain("no existing company note");
  expect(capture.prepare().preview).toBeNull();
  expect(f.workspace.coordinator.getSnapshot().draft!.memberships).toEqual([]);
  noSources(f);
});

interface HeldSave {
  start(): Promise<void>;
  accept(): void;
  reject(error: TrialApiError): void;
}
function holdWatchlistSave(f: NoteFixture): HeldSave {
  const held = deferred<Awaited<ReturnType<ManagedApi["save"]>>>();
  vi.mocked(f.api.save).mockReturnValueOnce(held.promise);
  return {
    start: () => f.workspace.coordinator.save(),
    accept() {
      const command = vi.mocked(f.api.save).mock.calls[0]![0];
      held.resolve({
        version: command.expectedVersion + 1,
        payload: command.payload,
        replayed: false,
      });
    },
    reject: held.reject,
  };
}
function holdFollowupsSave(f: NoteFixture): HeldSave {
  const held = deferred<Awaited<ReturnType<ManagedApi["saveFollowups"]>>>();
  vi.mocked(f.api.saveFollowups).mockReturnValueOnce(held.promise);
  return {
    start: () => f.workspace.followups.coordinator.save(),
    accept() {
      const command = vi.mocked(f.api.saveFollowups).mock.calls[0]![0];
      held.resolve({
        version: command.expectedVersion + 1,
        payload: command.payload,
        replayed: false,
      });
    },
    reject: held.reject,
  };
}
type SaveOutcome = "pending" | "conflict" | "uncertain";
function settleSave(held: HeldSave, outcome: SaveOutcome) {
  if (outcome === "pending") held.accept();
  else
    held.reject(
      new TrialApiError(outcome === "conflict" ? "conflict" : "unavailable"),
    );
}
const saveOutcomes: readonly SaveOutcome[] = [
  "pending",
  "conflict",
  "uncertain",
];
const saveBoundaries = [
  { resource: "watchlist", hold: holdWatchlistSave },
  { resource: "followups", hold: holdFollowupsSave },
].flatMap((resource) =>
  saveOutcomes.map((outcome) => ({ ...resource, outcome })),
);
it.each(saveBoundaries)(
  "blocks $outcome $resource Save and does not revive old captures",
  async ({ hold, outcome }) => {
    const f = await fixture();
    f.workspace.note(f.selection.listing.listingId, "Dirty current note");
    const preview = f.capture().prepare().preview!;
    const held = hold(f);
    const saving = held.start();
    expect(f.capture().reason).toBeTruthy();
    expect(preview.isCurrent()).toBe(false);
    settleSave(held, outcome);
    await saving;
    expect(preview.append()).toBe(false);
    if (outcome !== "pending") expect(f.capture().prepare().preview).toBeNull();
    expect(f.current().result).toContain("Assessment");
    noSources(f);
  },
);

it("rechecks captured drafts after a reentrant clock and refuses an invalid clock", async () => {
  const f = await fixture();
  const capture = f.capture();
  expect(capture.prepare(() => new Date(Number.NaN)).preview).toBeNull();
  expect(
    capture.prepare(() => {
      f.workspace.note(f.selection.listing.listingId, "Intervening note");
      return new Date();
    }).preview,
  ).toBeNull();
  expect(
    f.workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
  ).toBe("Intervening note");
  noSources(f);
});

it("does not revive a capture after a complete pending-to-ready Save round trip that it never observed", async () => {
  const f = await fixture();
  f.workspace.note(f.selection.listing.listingId, "Dirty note");
  const preview = f.capture().prepare().preview!;
  const held = deferred<Awaited<ReturnType<ManagedApi["save"]>>>();
  vi.mocked(f.api.save).mockReturnValueOnce(held.promise);
  const saving = f.workspace.coordinator.save();
  const command = vi.mocked(f.api.save).mock.calls[0]![0];
  held.resolve({
    version: command.expectedVersion + 1,
    payload: command.payload,
    replayed: false,
  });
  await saving;
  expect(f.workspace.coordinator.getSnapshot().phase).toBe("idle");
  expect(preview.isCurrent()).toBe(false);
  expect(preview.append()).toBe(false);
  expect(f.capture().prepare().preview).not.toBeNull();
  noSources(f);
});

it("refuses the same unsaved decomposed assessment after Watchlist Save normalizes only its note", async () => {
  const f = await fixture();
  const raw = f.current().result;
  expect(raw).toContain("Cafe\u0301");
  const preview = f.capture().prepare().preview!;
  expect(preview.append()).toBe(true);
  await f.workspace.coordinator.save();
  expect(
    f.workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
  ).toContain("Café");
  expect(f.current().result).toBe(raw);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  vi.setSystemTime(new Date("2026-10-28T02:00:00.000Z"));
  const note =
    f.workspace.coordinator.getSnapshot().draft!.memberships[0]!.note;
  expect(f.capture().prepare().reason).toContain("already");
  expect(
    f.workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
  ).toBe(note);
  noSources(f);
});

it("preserves the actual unloaded Watchlist refusal instead of suggesting a missing-member addition", async () => {
  const f = await fixture();
  const fresh = f.make();
  await fresh.refreshCatalog();
  fresh.setView("followups");
  await fresh.followups.coordinator.load();
  let entry = fresh.followups.currentEntry(f.entries[0]!.id)!;
  fresh.followups.edit(entry, "result", "Assessment without Watchlist load");
  entry = fresh.followups.currentEntry(entry.id)!;
  const prepared = await fresh.prepareFollowupResearch(entry);
  expect(prepared).not.toBeNull();
  fresh.openFollowupResearch(prepared!);
  const capture = fresh.captureFollowupReviewNote(
    fresh.getSnapshot().research!.selection,
    () => true,
  )!;
  expect(capture.reason).toBe(
    "Load My Watchlist before adding or editing a note.",
  );
  expect(capture.prepare().reason).toBe(capture.reason);
  expect(capture.prepare().preview).toBeNull();
  expect(fresh.coordinator.getSnapshot().draft).toBeNull();
  expect(f.api.save).not.toHaveBeenCalled();
  noSources(f);
});
