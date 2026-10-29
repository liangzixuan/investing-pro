import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import { prepareFilingsAssessment } from "./managed-filings-assessment";
import { ManagedSecFilingsError, type ManagedApi } from "./managed-api";

const fixtures: Awaited<ReturnType<typeof createFollowupsReviewFixture>>[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T02:00:00.123Z"));
});
afterEach(() => {
  for (const f of fixtures.splice(0)) f.dispose();
  vi.useRealTimers();
});
async function fixture() {
  const f = await createFollowupsReviewFixture();
  fixtures.push(f);
  vi.spyOn(f.api, "save");
  expect(f.model.enter()).toBe(true);
  f.model.choose(f.model.getSnapshot(), f.model.getSnapshot().rows[0]!.handle);
  f.model.start(f.model.getSnapshot());
  const context = await f.open();
  context.editAssessment("  Assessment · Cafe\u0301 東京 😀  ");
  const selection = f.workspace.getSnapshot().research!.selection;
  vi.mocked(f.api.recentFilings).mockResolvedValueOnce(
    filingsResponse(2, "available", selection),
  );
  await f.workspace.requestResearchSource(
    f.workspace.getSnapshot().research!,
    "filings",
  );
  const response = f.workspace.filings.getSnapshot().response!;
  expect(response).not.toBeNull();
  const filing = response.issuer.filings[0]!;
  const current = () => f.workspace.followups.currentEntry(f.entries[0]!.id)!;
  const capture = () =>
    f.workspace.captureFilingsAssessment(selection, response);
  const prepare = () => {
    const captured = capture();
    expect(captured.reason).toBeNull();
    expect(captured.port).not.toBeNull();
    const prepared = prepareFilingsAssessment(
      captured.port!,
      filing,
      () => true,
    );
    expect(prepared.reason).toBeNull();
    expect(prepared.preview).not.toBeNull();
    return prepared.preview!;
  };
  return { ...f, selection, response, filing, current, capture, prepare };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function noExtraEffects(f: Fixture) {
  expect(f.api.recentFilings).toHaveBeenCalledOnce();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.save).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
}

it("applies only the full raw result once, keeps Review/Back, and persists only after explicit completion and separate Save/fresh Load", async () => {
  const f = await fixture();
  const before = f.current();
  const watchlist = f.workspace.coordinator.getSnapshot();
  const other = f.workspace.followups.currentEntry(f.entries[2]!.id);
  const preview = f.prepare();
  let reentrant: boolean | undefined;
  const stop = f.workspace.followups.coordinator.subscribe(() => {
    reentrant = preview.apply();
  });
  expect(preview.apply()).toBe(true);
  stop();
  expect(reentrant).toBe(false);
  expect(preview.apply()).toBe(false);
  expect(f.current()).toEqual({ ...before, result: preview.result });
  expect(f.workspace.followups.currentEntry(f.entries[2]!.id)).toEqual(other);
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
  noExtraEffects(f);
  expect(f.capture().port).not.toBeNull();
  expect(
    prepareFilingsAssessment(f.capture().port!, f.filing, () => true).reason,
  ).toContain("already");
  f.workspace.closeResearch();
  expect(f.model.getSnapshot().selected!.entry.result).toBe(preview.result);
  expect(f.model.getSnapshot().position).toBe(0);
  const unsaved = f.make();
  await unsaved.refreshCatalog();
  await unsaved.followups.coordinator.load();
  expect(unsaved.followups.currentEntry(before.id)!.result).toBe("");
  f.workspace.followups.complete(f.current(), new Date("2026-10-26T00:00:00Z"));
  await f.workspace.followups.coordinator.save();
  const fresh = f.make();
  await fresh.refreshCatalog();
  await fresh.followups.coordinator.load();
  expect(fresh.followups.currentEntry(before.id)).toMatchObject({
    result: preview.result.normalize("NFC").trim(),
    status: "completed",
    completedOn: "2026-10-26",
  });
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  expect(f.api.save).not.toHaveBeenCalled();
});

it("cancel keeps both draft snapshots and every original source date", async () => {
  const f = await fixture();
  const before = f.workspace.followups.coordinator.getSnapshot();
  const source = f.workspace.filings.getSnapshot();
  const preview = f.prepare();
  preview.cancel();
  expect(preview.apply()).toBe(false);
  expect(f.workspace.followups.coordinator.getSnapshot()).toBe(before);
  expect(f.workspace.filings.getSnapshot()).toBe(source);
  noExtraEffects(f);
});

const boundaries = [
  {
    name: "assessment ABA",
    change(this: void, f: Fixture) {
      const raw = f.current().result;
      f.workspace.followups.edit(f.current(), "result", "other");
      f.workspace.followups.edit(f.current(), "result", raw);
    },
  },
  {
    name: "question ABA",
    change(this: void, f: Fixture) {
      const raw = f.current().check;
      f.workspace.followups.edit(f.current(), "check", "other");
      f.workspace.followups.edit(f.current(), "check", raw);
    },
  },
  {
    name: "date ABA",
    change(this: void, f: Fixture) {
      const raw = f.current().dueOn;
      f.workspace.followups.edit(f.current(), "dueOn", "2026-12-01");
      f.workspace.followups.edit(f.current(), "dueOn", raw);
    },
  },
  {
    name: "equal Follow-ups draft",
    change(this: void, f: Fixture) {
      f.workspace.followups.coordinator.replaceDraft({
        ...f.workspace.followups.coordinator.getSnapshot().draft!,
      });
    },
  },
  {
    name: "Watchlist draft ABA",
    change(this: void, f: Fixture) {
      const member =
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!;
      f.workspace.note(member.listingId, "other");
      f.workspace.note(member.listingId, member.note);
    },
  },
  {
    name: "file activity ABA",
    change(this: void, f: Fixture) {
      const activity = {};
      f.workspace.followups.beginDraftFileActivity(activity);
      f.workspace.followups.endDraftFileActivity(activity);
    },
  },
  {
    name: "navigation ABA",
    change(this: void, f: Fixture) {
      f.workspace.setNavigationBlocked(true);
      f.workspace.setNavigationBlocked(false);
    },
  },
  {
    name: "catalog",
    change(this: void, f: Fixture) {
      f.workspace.followups.syncCatalog(`sha256:${"b".repeat(64)}`);
    },
  },
  {
    name: "source close/open",
    change(this: void, f: Fixture) {
      f.workspace.filings.close();
      f.workspace.filings.open(f.selection);
    },
  },
  {
    name: "company section ABA",
    change(this: void, f: Fixture) {
      f.workspace.switchToAnnual();
      f.workspace.switchToFilings();
    },
  },
  {
    name: "visit close",
    change(this: void, f: Fixture) {
      f.workspace.closeResearch();
    },
  },
  {
    name: "session",
    change(this: void, f: Fixture) {
      f.workspace.sessionOwner.retire();
    },
  },
];
it.each(boundaries)(
  "permanently refuses a captured assessment after $name without observing the intermediate state",
  async ({ change }) => {
    const f = await fixture();
    const preview = f.prepare();
    change(f);
    const after = f.workspace.followups.coordinator.getSnapshot();
    expect(preview.isCurrent()).toBe(false);
    expect(preview.apply()).toBe(false);
    expect(f.workspace.followups.coordinator.getSnapshot()).toBe(after);
    noExtraEffects(f);
  },
);

it("refuses generic company visits and copied/mismatched packets", async () => {
  const f = await fixture();
  expect(
    f.workspace.captureFilingsAssessment(
      f.selection,
      structuredClone(f.response),
    ).port,
  ).toBeNull();
  expect(
    f.workspace.captureFilingsAssessment(
      { ...f.selection, origin: "route" },
      f.response,
    ).port,
  ).toBeNull();
  expect(
    f.workspace.captureFilingsAssessment(
      {
        ...f.selection,
        listing: { ...f.selection.listing, shareClassId: "other" },
      },
      f.response,
    ).port,
  ).toBeNull();
  noExtraEffects(f);
});

it("does not invent Watchlist authority when an existing exact check outlives its member", async () => {
  const f = await fixture();
  f.workspace.coordinator.replaceDraft({
    ...f.workspace.coordinator.getSnapshot().draft!,
    memberships: [],
  });
  const before = f.workspace.coordinator.getSnapshot();
  const preview = f.prepare();
  expect(preview.apply()).toBe(true);
  expect(f.workspace.coordinator.getSnapshot()).toBe(before);
  expect(before.draft!.memberships).toEqual([]);
  noExtraEffects(f);
});

it("refuses while file activity is pending and admits only a fresh capture afterward", async () => {
  const f = await fixture();
  const before = f.prepare();
  const operation = {};
  f.workspace.followups.beginDraftFileActivity(operation);
  expect(f.capture().port).toBeNull();
  f.workspace.followups.endDraftFileActivity(operation);
  expect(before.apply()).toBe(false);
  expect(f.prepare().apply()).toBe(true);
  noExtraEffects(f);
});

it("retires across pending Save and settlement even without a callback during the pending state", async () => {
  const f = await fixture();
  const preview = f.prepare();
  let settle!: (
    value: Awaited<ReturnType<ManagedApi["saveFollowups"]>>,
  ) => void;
  vi.mocked(f.api.saveFollowups).mockReturnValueOnce(
    new Promise((resolve) => {
      settle = resolve;
    }),
  );
  const saving = f.workspace.followups.coordinator.save();
  expect(f.capture().port).toBeNull();
  const command = vi.mocked(f.api.saveFollowups).mock.calls[0]![0];
  settle({
    version: command.expectedVersion + 1,
    payload: command.payload,
    replayed: false,
  });
  await saving;
  expect(preview.apply()).toBe(false);
  expect(f.prepare().apply()).toBe(true);
  expect(f.api.recentFilings).toHaveBeenCalledOnce();
});

it("retains original loaded clocks after a failed refresh and refuses the old capture", async () => {
  const f = await fixture();
  const before = f.prepare();
  vi.setSystemTime(new Date("2026-10-26T02:00:10.123Z"));
  vi.mocked(f.api.recentFilings).mockRejectedValueOnce(
    new ManagedSecFilingsError("unavailable"),
  );
  await f.workspace.requestResearchSource(
    f.workspace.getSnapshot().research!,
    "filings",
  );
  expect(before.apply()).toBe(false);
  expect(f.workspace.filings.getSnapshot().response).toBe(f.response);
  const preview = f.prepare();
  expect(preview.citation).toContain("Retained previous filings response");
  expect(preview.citation).toContain(f.response.completedAt);
  expect(f.api.recentFilings).toHaveBeenCalledTimes(2);
});
