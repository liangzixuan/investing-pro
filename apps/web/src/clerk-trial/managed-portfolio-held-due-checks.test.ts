import type { ManagedApi } from "./managed-api";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { heldDueFixture } from "./test-portfolio-held-due-fixture";
import { portfolioScreenCatalog } from "./test-portfolio-screen-selection-fixture";
const fixtures: Awaited<ReturnType<typeof heldDueFixture>>[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
});
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function fixture(p = true, f = true) {
  const value = await heldDueFixture(p, f);
  fixtures.push(value);
  return value;
}
function prepare(f: Awaited<ReturnType<typeof fixture>>) {
  expect(f.intake.getSnapshot().reason).toBeNull();
  expect(f.intake.prepare(f.intake.getSnapshot())).toBe(true);
  const entries = f.intake.getSnapshot().plan.eligible;
  f.intake.choose(f.intake.getSnapshot(), entries[1]!);
  f.intake.choose(f.intake.getSnapshot(), entries[0]!);
  return f.intake.getSnapshot();
}

it("loads independently without preparing, resolving identities or requesting company sources", async () => {
  const f = await fixture(false, false),
    before = vi.mocked(f.api.resolve).mock.calls.length;
  expect(f.intake.getSnapshot().prepared).toBe(false);
  expect(f.intake.getSnapshot().canPrepare).toBe(false);
  await f.intake.loadPortfolio(f.intake.getSnapshot());
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  expect(f.intake.getSnapshot().reason).toContain("identities");
  await f.workspace.portfolio.reviewCatalog();
  f.workspace.portfolio.applyReview();
  await f.intake.loadFollowups(f.intake.getSnapshot());
  expect(f.intake.getSnapshot().canPrepare).toBe(true);
  expect(f.intake.getSnapshot().prepared).toBe(false);
  expect(f.api.resolve).toHaveBeenCalledTimes(before + 1);
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("starts both held share classes in explicit order atomically and preserves raw dirty Portfolio", async () => {
  const f = await fixture(),
    saved = f.workspace.portfolio.coordinator.getSnapshot(),
    raw = JSON.stringify(saved.draft);
  const state = prepare(f),
    observed: unknown[] = [];
  const off = f.review.subscribe(() => observed.push(f.review.getSnapshot()));
  const installed = f.intake.start(state);
  off();
  expect(installed).toBe(f.review.getSnapshot());
  expect(installed?.chosen.map((r) => r.entry.id)).toEqual(
    state.chosen.map((e) => e.id),
  );
  expect(installed?.chosen[0]!.entry.listing.issuerId).toBe(
    installed?.chosen[1]!.entry.listing.issuerId,
  );
  expect(observed).toHaveLength(1);
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(saved);
  expect(JSON.stringify(saved.draft)).toBe(raw);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.intake.start(state)).toBeNull();
});
it("survives intentional Research/Back, authored assessments and Complete, with separate Save/fresh Load", async () => {
  const f = await fixture(),
    saved = f.workspace.portfolio.coordinator.getSnapshot();
  const state = prepare(f);
  expect(f.intake.start(state)).not.toBeNull();
  const entry = f.review.captureCurrent(f.review.getSnapshot())!;
  const prepared = await f.workspace.prepareFollowupResearch(entry);
  expect(prepared).not.toBeNull();
  f.workspace.openFollowupResearch(prepared!);
  const context = f.workspace.researchFollowupContext(
    f.workspace.getSnapshot().research!.selection,
  )!;
  context.editAssessment("Owned complete assessment · 東京");
  f.workspace.closeResearch();
  expect(f.review.getSnapshot().entered).toBe(true);
  expect(f.review.getSnapshot().selected?.entry.result).toBe(
    "Owned complete assessment · 東京",
  );
  f.workspace.followups.complete(
    f.workspace.followups.currentEntry(entry.id)!,
    new Date(),
  );
  expect(f.review.getSnapshot().entered).toBe(true);
  f.review.continue(f.review.getSnapshot());
  expect(f.review.getSnapshot().position).toBe(1);
  f.review.finish(f.review.getSnapshot());
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  await f.workspace.followups.coordinator.save();
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  const fresh = f.makeFresh();
  await fresh.refreshCatalog();
  fresh.setView("followups");
  await fresh.followups.coordinator.load();
  expect(fresh.followupsReview.getSnapshot().entered).toBe(false);
  expect(fresh.portfolioHeldDueChecks.getSnapshot().prepared).toBe(false);
  expect(fresh.followups.currentEntry(entry.id)?.result).toBe(
    "Owned complete assessment · 東京",
  );
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(saved);
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.unexpected).not.toHaveBeenCalled();
});
it.each([
  "portfolio-form",
  "portfolio-file",
  "followups-file",
  "followups-replace",
  "day",
  "catalog",
  "session",
])(
  "retires a running held review after %s without reviving on ABA",
  async (kind) => {
    const f = await fixture();
    expect(f.intake.start(prepare(f))).not.toBeNull();
    const w = f.workspace,
      p = w.portfolio,
      d = p.coordinator.getSnapshot().draft!,
      file = {};
    if (kind === "portfolio-form") {
      p.setPendingEditor(d, true);
      p.setPendingEditor(d, false);
    }
    if (kind === "portfolio-file") {
      p.beginDraftFileActivity(file);
      p.endDraftFileActivity(file);
    }
    if (kind === "followups-file") {
      w.followups.beginDraftFileActivity(file);
      w.followups.endDraftFileActivity(file);
    }
    if (kind === "followups-replace") {
      const d = w.followups.coordinator.getSnapshot().draft!;
      w.followups.coordinator.replaceDraft(structuredClone(d));
    }
    if (kind === "day") {
      w.followups.reassessDueDate(new Date("2026-10-31"));
      w.followups.reassessDueDate(new Date("2026-10-30"));
    }
    if (kind === "catalog") {
      vi.mocked(f.api.status).mockResolvedValue({
        snapshot: {
          ...portfolioScreenCatalog,
          snapshotSha256: `sha256:${"b".repeat(64)}`,
        },
      });
      await w.refreshCatalog();
    }
    if (kind === "session") w.sessionOwner.retire("Invented session ended");
    expect(f.review.getSnapshot().entered).toBe(false);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  },
);
it.each(["same-view", "navigation", "draft", "file"])(
  "rejects an old intake after %s ABA",
  async (kind) => {
    const f = await fixture(),
      old = prepare(f),
      w = f.workspace;
    if (kind === "same-view") w.setView("followups");
    if (kind === "navigation") {
      w.setNavigationBlocked(true);
      w.setNavigationBlocked(false);
    }
    if (kind === "draft") {
      const d = w.followups.coordinator.getSnapshot().draft!;
      w.followups.coordinator.replaceDraft(structuredClone(d));
    }
    if (kind === "file") {
      const file = {};
      w.portfolio.beginDraftFileActivity(file);
      w.portfolio.endDraftFileActivity(file);
    }
    expect(f.intake.start(old)).toBeNull();
    expect(f.review.getSnapshot().entered).toBe(false);
    expect(f.intake.getSnapshot().prepared).toBe(false);
  },
);
it("does not replace another choosing review and retires a reentrantly changed Portfolio on Start", async () => {
  const f = await fixture();
  f.review.enter();
  expect(f.intake.getSnapshot().canPrepare).toBe(false);
  f.review.leave();
  f.workspace.setView("followups");
  const state = prepare(f);
  const off = f.review.subscribe(() => {
    if (f.review.getSnapshot().phase === "reviewing")
      f.workspace.portfolio.setPendingEditor(
        f.workspace.portfolio.coordinator.getSnapshot().draft!,
        true,
      );
  });
  expect(f.intake.start(state)).toBeNull();
  off();
  expect(f.review.getSnapshot().entered).toBe(false);
});
it("cancels only the owned intake and requires fresh explicit preparation", async () => {
  const f = await fixture(),
    old = prepare(f);
  expect(f.intake.cancel(old)).toBe(true);
  expect(f.intake.start(old)).toBeNull();
  expect(f.intake.getSnapshot().chosen).toEqual([]);
  expect(f.review.getSnapshot().entered).toBe(false);
});

it("blocks intake throughout pending Portfolio Save and does not revive its consumed preview", async () => {
  const f = await fixture(),
    old = prepare(f);
  let release!: (
    value: Awaited<ReturnType<ManagedApi["savePortfolio"]>>,
  ) => void;
  const pending = new Promise<Awaited<ReturnType<ManagedApi["savePortfolio"]>>>(
    (resolve) => {
      release = resolve;
    },
  );
  const save = vi.fn<ManagedApi["savePortfolio"]>(() => pending);
  f.api.savePortfolio = save;
  const operation = f.workspace.portfolio.coordinator.save();
  expect(f.workspace.portfolio.coordinator.getSnapshot().phase).toBe("saving");
  expect(f.intake.getSnapshot().canPrepare).toBe(false);
  expect(f.intake.getSnapshot().canLoadPortfolio).toBe(false);
  expect(f.intake.start(old)).toBeNull();
  const command = save.mock.calls[0]![0];
  release({
    version: command.expectedVersion + 1,
    payload: command.payload,
    replayed: false,
  });
  await operation;
  expect(f.workspace.portfolio.coordinator.getSnapshot().phase).toBe("idle");
  expect(f.intake.getSnapshot().canPrepare).toBe(false);
  f.api.loadPortfolio = () =>
    Promise.resolve({
      version: command.expectedVersion + 1,
      payload: command.payload,
    });
  await f.intake.loadPortfolio(f.intake.getSnapshot());
  expect(f.intake.getSnapshot().canPrepare).toBe(true);
  expect(f.intake.getSnapshot().prepared).toBe(false);
  expect(f.intake.start(old)).toBeNull();
});
it("retires an intake on an equal-digest catalog replacement and ignores a late resource load after leaving", async () => {
  const f = await fixture(),
    old = prepare(f);
  vi.mocked(f.api.status).mockResolvedValue({
    snapshot: { ...portfolioScreenCatalog },
  });
  await f.workspace.refreshCatalog();
  expect(f.intake.start(old)).toBeNull();
  let release!: (
    value: Awaited<ReturnType<ManagedApi["loadFollowups"]>>,
  ) => void;
  f.api.loadFollowups = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const load = f.intake.loadFollowups(f.intake.getSnapshot());
  f.workspace.setView("portfolio");
  release(structuredClone(f.stored()));
  await load;
  expect(f.intake.getSnapshot().prepared).toBe(false);
  expect(f.review.getSnapshot().entered).toBe(false);
  expect(f.intake.getSnapshot().canPrepare).toBe(false);
});

it("retires the exact Research assessment callback when its Portfolio owner changes", async () => {
  const f = await fixture();
  expect(f.intake.start(prepare(f))).not.toBeNull();
  const entry = f.review.captureCurrent(f.review.getSnapshot())!;
  const prepared = await f.workspace.prepareFollowupResearch(entry);
  f.workspace.openFollowupResearch(prepared!);
  const context = f.workspace.researchFollowupContext(
    f.workspace.getSnapshot().research!.selection,
  )!;
  expect(context.isCurrent()).toBe(true);
  const draft = f.workspace.followups.coordinator.getSnapshot().draft;
  const file = {};
  f.workspace.portfolio.beginDraftFileActivity(file);
  f.workspace.portfolio.endDraftFileActivity(file);
  expect(f.review.getSnapshot().entered).toBe(false);
  expect(context.isCurrent()).toBe(false);
  context.editAssessment("Stale must not apply");
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
});
it("cancels the exact pending Research opening and rejects its late response after Portfolio retirement", async () => {
  const f = await fixture();
  expect(f.intake.start(prepare(f))).not.toBeNull();
  const entry = f.review.captureCurrent(f.review.getSnapshot())!;
  let release!: (response: Awaited<ReturnType<ManagedApi["resolve"]>>) => void;
  const response = new Promise<Awaited<ReturnType<ManagedApi["resolve"]>>>(
    (resolve) => {
      release = resolve;
    },
  );
  const resolve = vi.fn<ManagedApi["resolve"]>(() => response);
  f.api.resolve = resolve;
  const opening = f.workspace.prepareFollowupResearch(entry);
  expect(f.workspace.getSnapshot().followupOpening).toBe(true);
  const signal = resolve.mock.calls[0]![1];
  const draft = f.workspace.followups.coordinator.getSnapshot().draft;
  const file = {};
  f.workspace.portfolio.beginDraftFileActivity(file);
  expect(signal.aborted).toBe(true);
  expect(f.workspace.getSnapshot().followupOpening).toBe(false);
  f.workspace.portfolio.endDraftFileActivity(file);
  release({
    snapshotSha256: entry.catalogSnapshotSha256,
    results: [{ listingId: entry.listing.listingId, listing: entry.listing }],
  });
  expect(await opening).toBeNull();
  expect(f.workspace.getSnapshot().research).toBeNull();
  expect(f.workspace.getSnapshot().followupOpening).toBe(false);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
});
