import { afterEach, describe, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import { DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA } from "./managed-financial-screen-results";
import {
  comparisonFollowupFixture,
  disposeComparisonFollowupFixture,
  held,
} from "./managed-screen-comparison-followup-fixture";
import { ManagedScreenComparisonFollowupContext } from "./managed-screen-comparison-followup-context";
const fixtures: Awaited<ReturnType<typeof comparisonFollowupFixture>>[] = [];
async function fixture(load = true) {
  const f = await comparisonFollowupFixture(load);
  fixtures.push(f);
  return f;
}
type ComparisonFixture = Awaited<ReturnType<typeof fixture>>;
type SourceRetirement = readonly [
  string,
  (
    f: ComparisonFixture,
    digest: ComparisonFixture["source"]["comparison"]["catalogSnapshotSha256"],
  ) => void,
];
const sourceRetirements: readonly SourceRetirement[] = [
  [
    "pair",
    (f) => {
      f.screen.choose("left", null);
      f.screen.choose("left", f.screen.rows[0]!);
    },
  ],
  [
    "criteria",
    (f) => {
      f.screen.model.stageCriteria(f.screen.model.getSnapshot());
      f.screen.model.setCriteria(
        f.screen.model.getSnapshot(),
        DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA,
      );
    },
  ],
  [
    "catalog",
    (f, digest) => {
      f.screen.model.reconcile(null, false, false);
      f.screen.model.reconcile(digest, true, true);
    },
  ],
  [
    "inactive",
    (f, digest) => {
      f.screen.model.reconcile(digest, false, false);
      f.screen.model.reconcile(digest, true, true);
    },
  ],
  [
    "Watchlist",
    (f) => {
      const draft = f.watchlist.getSnapshot().draft!;
      f.watchlist.replaceDraft({
        ...draft,
        memberships: draft.memberships.map((member, index) =>
          index === 0 ? { ...member, note: "Temporary authored note" } : member,
        ),
      });
      f.watchlist.replaceDraft(draft);
    },
  ],
  [
    "navigation",
    (f) => {
      f.state.navigation++;
      f.updates.emit();
      f.state.navigation--;
      f.updates.emit();
    },
  ],
  [
    "session",
    (f) => {
      f.state.sessionPhase = "expired";
      f.sessions.emit();
      f.state.sessionPhase = "active";
      f.sessions.emit();
    },
  ],
  [
    "route",
    (f) => {
      f.state.available = false;
      f.updates.emit();
      f.state.available = true;
      f.updates.emit();
    },
  ],
];

afterEach(() => {
  for (const f of fixtures.splice(0)) disposeComparisonFollowupFixture(f);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("comparison source and draft ownership", () => {
  it("starts without a destination and exposes only the two exact current Watchlist intersections", async () => {
    const f = await fixture();
    expect(f.source.isCurrent()).toBe(true);
    expect(
      f.context
        .destinations(f.source)
        .map((row) => [row.side, row.listing.listingId, row.eligible]),
    ).toEqual([
      ["left", f.source.comparison.left.listing.listingId, true],
      ["right", f.source.comparison.right.listing.listingId, true],
    ]);
    expect(f.context.capturePort(f.source, "").port).toBeNull();
    expect(f.context.capturePort(f.source, "third").port).toBeNull();
    const draft = f.watchlist.getSnapshot().draft!;
    f.watchlist.replaceDraft({
      ...draft,
      memberships: [
        draft.memberships[0]!,
        { ...draft.memberships[1]!, listingId: "unrelated-third-company" },
      ],
    });
    const current = f.capture();
    expect(f.context.destinations(current).map((row) => row.eligible)).toEqual([
      true,
      false,
    ]);
    expect(f.context.capturePort(current, "right").port).toBeNull();
    expect(
      f.context.capturePort(current, "unrelated-third-company").port,
    ).toBeNull();
    expect(f.context.capturePort(current, "left").port?.member.note).toBe(
      "Keep this unsaved Watchlist note.",
    );
  });
  it("refuses same-listing share-class mismatch and copied or foreign context tokens", async () => {
    const f = await fixture();
    const copied = { ...f.source };
    expect(f.context.capturePort(copied, "left").port).toBeNull();
    expect(f.context.canLoad(copied, "left")).toBe(false);
    const other = new ManagedScreenComparisonFollowupContext(f.host);
    expect(other.capturePort(f.source, "left").port).toBeNull();
    const foreign = other.capture(
      new Date().toISOString(),
      () => true,
    ).capture!;
    expect(f.context.capturePort(foreign, "left").port).toBeNull();
    other.retire();
    const draft = f.watchlist.getSnapshot().draft!;
    f.watchlist.replaceDraft({
      ...draft,
      memberships: draft.memberships.map((member, i) =>
        i ? member : { ...member, shareClassId: "other-class" },
      ),
    });
    expect(f.context.destinations(f.capture())[0]!.eligible).toBe(false);
  });
  it("keeps raw source choice through only an explicit eligible initial read, then captures fresh full draft context", async () => {
    const f = await fixture(false);
    const pending = held<ReturnType<typeof f.stored>>();
    f.api.loadFollowups.mockImplementationOnce(() => pending.promise);
    expect(f.api.loadFollowups).not.toHaveBeenCalled();
    expect(f.context.capturePort(f.source, "left").port).toBeNull();
    expect(f.context.canLoad(f.source, "left")).toBe(true);
    const loading = f.context.load(f.source, "left", () => f.form.current);
    expect(f.followups.coordinator.getSnapshot().phase).toBe("loading");
    expect(f.source.isCurrent()).toBe(true);
    pending.resolve(f.stored());
    await loading;
    expect(f.source.isCurrent()).toBe(true);
    expect(f.context.capturePort(f.source, "left").port?.isCurrent()).toBe(
      true,
    );
    expect(f.context.canLoad(f.source, "left")).toBe(false);
    await f.context.load(f.source, "left", () => true);
    expect(f.api.loadFollowups).toHaveBeenCalledOnce();
    expect(f.screen.read).toHaveBeenCalledTimes(2);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  });
  it("retains the owned source after a failed initial read and allows only an explicit retry", async () => {
    const f = await fixture(false);
    f.api.loadFollowups.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.context.load(f.source, "left", () => true);
    expect(f.source.isCurrent()).toBe(true);
    expect(f.followups.coordinator.getSnapshot().draft).toBeNull();
    await f.context.load(f.source, "left", () => true);
    expect(f.api.loadFollowups).toHaveBeenCalledTimes(2);
    expect(f.context.capturePort(f.source, "left").port).not.toBeNull();
    expect(f.screen.read).toHaveBeenCalledTimes(2);
  });
  it.each(["form", "source", "navigation", "file", "retirement"])(
    "refuses a late initial read after %s retirement",
    async (cause) => {
      const f = await fixture(false);
      const pending = held<ReturnType<typeof f.stored>>();
      f.api.loadFollowups.mockImplementationOnce(() => pending.promise);
      const loading = f.context.load(f.source, "left", () => f.form.current);
      if (cause === "form") f.form.current = false;
      if (cause === "source") f.screen.choose("left", null);
      if (cause === "navigation") {
        f.state.navigation++;
        f.updates.emit();
      }
      if (cause === "file") {
        const op = {};
        f.followups.beginDraftFileActivity(op);
        f.followups.endDraftFileActivity(op);
      }
      if (cause === "retirement") f.context.retire();
      pending.resolve(f.stored());
      await loading;
      expect(f.followups.coordinator.getSnapshot().draft).toBeNull();
      expect(f.api.saveFollowups).not.toHaveBeenCalled();
      expect(f.watchlistSave).not.toHaveBeenCalled();
    },
  );
  it("keeps immutable source across FU edits but permanently retires old ports and previews, including ABA", async () => {
    const f = await fixture();
    const port = f.port();
    const preview = f.prepare().preview!;
    const draft = f.followups.coordinator.getSnapshot().draft!;
    f.followups.coordinator.replaceDraft({
      ...draft,
      entries: [...draft.entries],
    });
    f.followups.coordinator.replaceDraft(draft);
    expect(f.source.isCurrent()).toBe(true);
    expect(port.isCurrent()).toBe(false);
    expect(preview.create()).toBeNull();
    expect(f.prepare().preview?.isCurrent()).toBe(true);
  });
  it("FU file activity retires even the source after Cancel without a draft mutation", async () => {
    const f = await fixture();
    const draft = f.followups.coordinator.getSnapshot().draft;
    const preview = f.prepare().preview!;
    const op = {};
    f.followups.beginDraftFileActivity(op);
    expect(f.source.isCurrent()).toBe(false);
    f.followups.endDraftFileActivity(op);
    expect(f.followups.coordinator.getSnapshot().draft).toBe(draft);
    expect(f.source.isCurrent()).toBe(false);
    expect(preview.create()).toBeNull();
    expect(f.capture().isCurrent()).toBe(true);
  });
  it.each(sourceRetirements)(
    "irreversibly retires old source on %s out-and-back",
    async (_cause, retireSource) => {
      const f = await fixture();
      const digest = f.source.comparison.catalogSnapshotSha256;
      retireSource(f, digest);
      expect(f.source.isCurrent()).toBe(false);
      expect(f.context.capturePort(f.source, "left").port).toBeNull();
      expect(f.screen.read).toHaveBeenCalledTimes(2);
    },
  );
  it("refuses during a pending Follow-ups Save and cannot revive the preceding action after settlement", async () => {
    const f = await fixture();
    f.prepare().preview!.create();
    const port = f.port("right");
    const pending = held<Awaited<ReturnType<typeof f.api.saveFollowups>>>();
    const payload = f.followups.coordinator.getSnapshot().draft!;
    f.api.saveFollowups.mockImplementationOnce(() => pending.promise);
    const saving = f.followups.coordinator.save();
    expect(f.context.capturePort(f.source, "right").port).toBeNull();
    expect(port.isCurrent()).toBe(false);
    pending.resolve({ version: 1, payload, replayed: false });
    await saving;
    expect(port.isCurrent()).toBe(false);
    expect(f.source.isCurrent()).toBe(true);
    expect(f.followups.coordinator.getSnapshot().latestLoaded).toBe(false);
    expect(f.context.capturePort(f.source, "right").port).toBeNull();
    f.api.loadFollowups.mockResolvedValueOnce({ version: 1, payload });
    await f.followups.coordinator.load();
    expect(port.isCurrent()).toBe(false);
    expect(f.context.capturePort(f.source, "right").port).not.toBeNull();
  });
  it.each([
    "latestLoaded",
    "baseVersion",
    "conflict",
    "uncertain",
    "replayPending",
  ])("refuses incomplete or recovering FU baseline %s", async (field) => {
    const f = await fixture();
    const saved = f.followups.coordinator.getSnapshot();
    const value =
      field === "latestLoaded" ? false : field === "baseVersion" ? 7 : true;
    vi.spyOn(f.followups.coordinator, "getSnapshot").mockReturnValue({
      ...saved,
      [field]: value,
    });
    expect(f.context.capturePort(f.source, "left").port).toBeNull();
  });
});
