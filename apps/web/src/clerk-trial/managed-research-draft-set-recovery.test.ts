import * as watchlistFiles from "./managed-watchlist-draft-file";
import { afterEach, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import {
  draftSetFixture,
  draftSetFile,
  scope,
} from "./test-research-draft-set-fixture";
import { ManagedWatchlistDraftRecovery } from "./managed-watchlist-draft-recovery";
import { deferred } from "./test-valuation-draft-recovery-fixture";
const closes: (() => void)[] = [];
afterEach(() => {
  for (const close of closes.splice(0)) close();
});
async function fixture() {
  const f = await draftSetFixture();
  closes.push(f.close);
  return f;
}
it("captures a chosen loaded subset, reports omissions, inspects before delivery and preserves independent state", async () => {
  const f = await fixture(),
    w = f.workspace,
    editor = w.valuation.getSnapshot(),
    states = [
      w.coordinator.getSnapshot(),
      w.portfolio.coordinator.getSnapshot(),
      w.followups.coordinator.getSnapshot(),
      w.valuationAssumptions.coordinator.getSnapshot(),
    ] as const;
  expect(f.recovery.getSnapshot().canCapture).toBe(false);
  f.recovery.selectResource("portfolio", true);
  f.recovery.selectResource("valuation", true);
  expect(f.recovery.captureDrafts()).toBe(true);
  const state = f.recovery.getSnapshot();
  expect(state.file?.omitted).toEqual(["watchlist", "followups"]);
  expect(state.file?.members.watchlist).toBeNull();
  expect(state.file?.members.portfolio?.draft).toEqual(
    states[1]?.draft?.ledger,
  );
  expect(f.deliver).not.toHaveBeenCalled();
  await f.recovery.saveFile();
  expect(f.deliver).toHaveBeenCalledOnce();
  expect(w.valuation.getSnapshot()).toBe(editor);
  expect([
    w.coordinator.getSnapshot(),
    w.portfolio.coordinator.getSnapshot(),
    w.followups.coordinator.getSnapshot(),
    w.valuationAssumptions.coordinator.getSnapshot(),
  ]).toEqual(states);
  expect(f.unexpected).not.toHaveBeenCalled();
});
it("recovers Portfolio alone then valuation in a fresh session with newer bases and separate catalog Review/Save/Load", async () => {
  const first = await fixture(),
    file = first.capture();
  await first.recovery.saveFile();
  first.close();
  const f = await fixture();
  await f.newer();
  const w = f.workspace;
  w.coordinator.replaceDraft({
    ...w.coordinator.getSnapshot().draft!,
    memberships: [],
  });
  w.valuation.setDcfField("waccPercent", "unrelated editor");
  w.valuation.calculate();
  const watch = w.coordinator.getSnapshot(),
    followups = w.followups.coordinator.getSnapshot(),
    editor = w.valuation.getSnapshot(),
    valuation = w.valuationAssumptions.coordinator.getSnapshot(),
    base = w.portfolio.coordinator.getSnapshot().saved;
  await f.recovery.readFile(draftSetFile(file));
  expect(f.recovery.getSnapshot().phase).toBe("inventory");
  expect(w.portfolio.coordinator.getSnapshot().dirty).toBe(false);
  expect(f.recovery.compareResource("portfolio")).toBe(true);
  expect(f.recovery.getSnapshot().comparison?.currentBase).toBe(7);
  expect(f.recovery.restoreResource()).toBe(true);
  expect(f.recovery.restoreResource()).toBe(false);
  expect(w.portfolio.coordinator.getSnapshot()).toMatchObject({
    baseVersion: 7,
    saved: base,
    dirty: true,
    draft: { ledger: file.members.portfolio!.draft },
  });
  expect(w.coordinator.getSnapshot()).toBe(watch);
  expect(w.followups.coordinator.getSnapshot()).toBe(followups);
  expect(w.valuation.getSnapshot()).toBe(editor);
  expect(w.valuationAssumptions.coordinator.getSnapshot()).toBe(valuation);
  expect(f.api.savePortfolio).not.toHaveBeenCalled();
  await w.portfolio.reviewCatalog();
  w.portfolio.applyReview();
  await w.portfolio.coordinator.save();
  await w.portfolio.coordinator.load();
  expect(f.api.savePortfolio).toHaveBeenCalledOnce();
  expect(w.portfolio.coordinator.getSnapshot().baseVersion).toBe(8);
  expect(f.recovery.compareResource("valuation")).toBe(true);
  expect(f.recovery.getSnapshot().comparison?.currentBase).toBe(9);
  expect(f.recovery.restoreResource()).toBe(true);
  expect(w.valuation.getSnapshot()).toBe(editor);
  expect(w.valuationAssumptions.coordinator.getSnapshot().draft).toEqual(
    file.members.valuation!.payload,
  );
  await w.valuationAssumptions.reviewCatalog();
  expect(w.valuationAssumptions.applyCatalogReview()).toBe(true);
  await w.valuationAssumptions.coordinator.save();
  await w.valuationAssumptions.coordinator.load();
  expect(w.valuationAssumptions.coordinator.getSnapshot().baseVersion).toBe(10);
  expect(w.coordinator.getSnapshot()).toBe(watch);
  expect(w.followups.coordinator.getSnapshot()).toBe(followups);
  expect(w.valuation.getSnapshot()).toBe(editor);
  expect(f.unexpected).not.toHaveBeenCalled();
});
it("keeps loaded empty collections distinct from an unloaded member", async () => {
  const f = await fixture();
  await f.newer();
  expect(f.recovery.getSnapshot().eligibility.followups).toBe(true);
  f.recovery.selectResource("followups", true);
  expect(f.recovery.captureDrafts()).toBe(true);
  expect(
    f.recovery.getSnapshot().file?.members.followups?.draft.entries,
  ).toEqual([]);
  f.recovery.closeFile();
  const unready = await draftSetFixture({ portfolioLoaded: false });
  closes.push(unready.close);
  expect(
    unready.workspace.portfolio.coordinator.getSnapshot().baseVersion,
  ).toBeNull();
  expect(unready.recovery.getSnapshot().eligibility.portfolio).toBe(false);
  expect(unready.recovery.selectResource("portfolio", true)).toBe(false);
});
it.each([
  "draft ABA",
  "route ABA",
  "catalog",
  "pending load",
  "file activity",
  "editor file activity",
  "session",
])("retires a resource comparison after %s without mutation", async (cause) => {
  const f = await fixture(),
    file = f.capture();
  f.recovery.closeFile();
  await f.recovery.readFile(draftSetFile(file));
  expect(f.recovery.compareResource("valuation")).toBe(true);
  const model = f.workspace.valuationAssumptions,
    old = model.coordinator.getSnapshot().draft!;
  if (cause === "draft ABA") {
    model.coordinator.replaceDraft({ schemaVersion: 1, entries: [] });
    model.coordinator.replaceDraft(old);
  }
  if (cause === "route ABA") {
    f.workspace.setView("portfolio");
    f.workspace.setView("watchlist");
  }
  if (cause === "catalog") await f.workspace.refreshCatalog();
  if (cause === "pending load") await model.coordinator.load();
  if (cause === "file activity") {
    const owner = {};
    model.beginCollectionFileActivity(owner);
    model.endCollectionFileActivity(owner);
  }
  if (cause === "editor file activity") {
    const owner = {};
    f.workspace.valuation.beginDraftFileActivity(owner);
    f.workspace.valuation.endDraftFileActivity(owner);
  }
  if (cause === "session") f.workspace.sessionOwner.retire("retired");
  const before = model.coordinator.getSnapshot();
  expect(f.recovery.restoreResource()).toBe(false);
  expect(model.coordinator.getSnapshot()).toBe(before);
  expect(f.recovery.getSnapshot().comparison).toBeNull();
});
it("withdraws a comparison when a competing single-resource file operation begins and ends", async () => {
  const f = await fixture(),
    file = f.capture();
  f.recovery.closeFile();
  f.workspace.setView("watchlist");
  await f.recovery.readFile(draftSetFile(file));
  expect(f.recovery.compareResource("watchlist")).toBe(true);
  const old = f.workspace.coordinator.getSnapshot();
  const other = new ManagedWatchlistDraftRecovery({
    workspace: f.workspace,
    accountScope: Promise.resolve(scope),
    delivery: { deliver: () => Promise.resolve("written") },
    routeActive: () => true,
  });
  await Promise.resolve();
  const bytes = new TextEncoder().encode(
    JSON.stringify(file.members.watchlist),
  ).buffer;
  await other.readFile({
    size: bytes.byteLength,
    arrayBuffer: () => Promise.resolve(bytes),
  });
  expect(other.getSnapshot().phase).toBe("review");
  other.cancel();
  expect(other.getSnapshot().phase).toBe("idle");
  expect(other.getSnapshot().preview).toBeNull();
  other.dispose();
  expect(f.recovery.getSnapshot().comparison).toBeNull();
  expect(f.recovery.restoreResource()).toBe(false);
  expect(f.workspace.coordinator.getSnapshot()).toBe(old);
});
it("cancels late reads and chosen-document writes without reviving captures", async () => {
  const f = await fixture(),
    file = f.capture();
  f.recovery.closeFile();
  const pending = deferred<ArrayBuffer>();
  const reading = f.recovery.readFile({
    size: draftSetFile(file).size,
    arrayBuffer: () => pending.promise,
  });
  f.recovery.cancel();
  pending.resolve(await draftSetFile(file).arrayBuffer());
  await reading;
  expect(f.recovery.getSnapshot().file).toBeNull();
  const delivery = deferred<"written">();
  f.deliver.mockReturnValueOnce(delivery.promise);
  for (const key of [
    "watchlist",
    "portfolio",
    "followups",
    "valuation",
  ] as const)
    f.recovery.selectResource(key, true);
  expect(f.recovery.captureDrafts()).toBe(true);
  const saving = f.recovery.saveFile();
  const context = f.deliver.mock.calls[0]![1];
  f.recovery.cancel();
  expect(context.signal.aborted).toBe(true);
  expect(context.isCurrent()).toBe(false);
  delivery.resolve("written");
  await saving;
  expect(f.recovery.getSnapshot().file).toBeNull();
});
it("consumes comparison before notifications and refuses a reentrant replacement without acknowledging the older restore", async () => {
  const f = await fixture(),
    file = f.capture();
  f.recovery.closeFile();
  await f.recovery.readFile(draftSetFile(file));
  expect(f.recovery.compareResource("portfolio")).toBe(true);
  let changed = false;
  const stop = f.recovery.subscribe(() => {
    if (!changed && f.recovery.getSnapshot().phase === "inventory") {
      changed = true;
      f.workspace.portfolio.coordinator.replaceDraft({
        ledger: {
          ...file.members.portfolio!.draft,
          opening: {
            ...file.members.portfolio!.draft.opening,
            cashUsd: "9999.00",
          },
        },
      });
    }
  });
  expect(f.recovery.restoreResource()).toBe(false);
  stop();
  expect(
    f.workspace.portfolio.coordinator.getSnapshot().draft?.ledger?.opening
      .cashUsd,
  ).toBe("9999.00");
  expect(f.recovery.compareResource("portfolio")).toBe(true);
  let replaced = false;
  const unsub = f.workspace.portfolio.coordinator.subscribe(() => {
    if (!replaced && f.workspace.portfolio.coordinator.getSnapshot().dirty) {
      replaced = true;
      f.workspace.portfolio.coordinator.replaceDraft({
        ledger: {
          ...file.members.portfolio!.draft,
          opening: {
            ...file.members.portfolio!.draft.opening,
            cashUsd: "8888.00",
          },
        },
      });
    }
  });
  expect(f.recovery.restoreResource()).toBe(false);
  unsub();
  expect(
    f.workspace.portfolio.coordinator.getSnapshot().draft?.ledger?.opening
      .cashUsd,
  ).toBe("8888.00");
});
it("refuses uncertain saving resources and never resolves a receipt or loads a source", async () => {
  const f = await fixture();
  f.workspace.portfolio.coordinator.replaceDraft(
    f.workspace.portfolio.coordinator.getSnapshot().draft!,
  );
  await f.workspace.portfolio.reviewCatalog();
  f.workspace.portfolio.applyReview();
  f.api.savePortfolio = vi.fn(() =>
    Promise.reject(new TrialApiError("commit_unknown")),
  );
  await f.workspace.portfolio.coordinator.save();
  expect(f.recovery.getSnapshot().eligibility.portfolio).toBe(false);
  expect(f.recovery.selectResource("portfolio", true)).toBe(false);
  expect(f.unexpected).not.toHaveBeenCalled();
});

it.each(["result notification", "activity release"])(
  "does not acknowledge a restore replaced during %s",
  async (phase) => {
    const f = await fixture(),
      file = f.capture();
    f.recovery.closeFile();
    await f.recovery.readFile(draftSetFile(file));
    expect(f.recovery.compareResource("portfolio")).toBe(true);
    let changed = false;
    const replace = () => {
      if (changed) return;
      changed = true;
      f.workspace.portfolio.coordinator.replaceDraft({
        ledger: {
          ...file.members.portfolio!.draft,
          opening: {
            ...file.members.portfolio!.draft.opening,
            cashUsd: "7777.00",
          },
        },
      });
    };
    const stop =
      phase === "result notification"
        ? f.recovery.subscribe(() => {
            if (
              f.recovery.getSnapshot().message.startsWith("Portfolio restored")
            )
              replace();
          })
        : f.workspace.portfolio.subscribe(() => {
            if (
              !f.workspace.portfolio.hasDraftFileActivity() &&
              f.workspace.portfolio.coordinator.getSnapshot().dirty
            )
              replace();
          });
    expect(f.recovery.restoreResource()).toBe(false);
    stop();
    expect(
      f.workspace.portfolio.coordinator.getSnapshot().draft?.ledger?.opening
        .cashUsd,
    ).toBe("7777.00");
    expect(f.recovery.getSnapshot().message).toMatch(/changed/u);
  },
);

it("refuses a malformed included member before mutating any of the four drafts", async () => {
  const f = await fixture(),
    file = f.capture();
  f.recovery.closeFile();
  const w = f.workspace,
    before = [
      w.coordinator.getSnapshot(),
      w.portfolio.coordinator.getSnapshot(),
      w.followups.coordinator.getSnapshot(),
      w.valuationAssumptions.coordinator.getSnapshot(),
    ];
  const text = JSON.stringify({
      ...file,
      members: {
        ...file.members,
        portfolio: { ...file.members.portfolio!, version: 2 },
      },
    }),
    bytes = new TextEncoder().encode(text).buffer;
  await f.recovery.readFile({
    size: bytes.byteLength,
    arrayBuffer: () => Promise.resolve(bytes),
  });
  expect(f.recovery.getSnapshot().file).toBeNull();
  expect(f.recovery.compareResource("valuation")).toBe(false);
  expect([
    w.coordinator.getSnapshot(),
    w.portfolio.coordinator.getSnapshot(),
    w.followups.coordinator.getSnapshot(),
    w.valuationAssumptions.coordinator.getSnapshot(),
  ]).toEqual(before);
});
it("rechecks every chosen snapshot after reentrant activity notifications and never publishes a mixed capture", async () => {
  const f = await fixture();
  for (const k of ["watchlist", "portfolio", "followups", "valuation"] as const)
    f.recovery.selectResource(k, true);
  let changed = false;
  const stop = f.workspace.portfolio.subscribe(() => {
    if (!changed && f.workspace.portfolio.hasDraftFileActivity()) {
      changed = true;
      f.workspace.valuationAssumptions.coordinator.replaceDraft({
        schemaVersion: 1,
        entries: [],
      });
    }
  });
  expect(f.recovery.captureDrafts()).toBe(false);
  stop();
  expect(f.recovery.getSnapshot().file).toBeNull();
  expect(
    f.workspace.valuationAssumptions.coordinator.getSnapshot().draft?.entries,
  ).toEqual([]);
  expect(f.workspace.portfolio.hasDraftFileActivity()).toBe(false);
  expect(f.workspace.followups.hasDraftFileActivity()).toBe(false);
  expect(f.workspace.hasWatchlistDraftFileActivity()).toBe(false);
  expect(f.workspace.valuationAssumptions.hasCollectionFileActivity()).toBe(
    false,
  );
  expect(f.deliver).not.toHaveBeenCalled();
});
it("keeps unselected edits independent but aborts delivery after a selected draft changes", async () => {
  const f = await fixture();
  f.recovery.selectResource("portfolio", true);
  expect(f.recovery.captureDrafts()).toBe(true);
  f.workspace.followups.coordinator.replaceDraft({
    schemaVersion: 1,
    entries: [],
  });
  expect(f.recovery.getSnapshot().phase).toBe("capture");
  const pending = deferred<"written">();
  f.deliver.mockReturnValueOnce(pending.promise);
  const operation = f.recovery.saveFile();
  const context = f.deliver.mock.calls[0]![1];
  f.workspace.portfolio.coordinator.replaceDraft(
    f.workspace.portfolio.coordinator.getSnapshot().draft!,
  );
  expect(context.signal.aborted).toBe(true);
  expect(context.isCurrent()).toBe(false);
  pending.resolve("written");
  await operation;
  expect(f.recovery.getSnapshot().file).toBeNull();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft?.entries,
  ).toEqual([]);
});

it("uses cheap eligibility during large raw draft edits and serializes only on explicit capture", async () => {
  const f = await fixture(),
    format = vi.spyOn(watchlistFiles, "formatManagedWatchlistDraftFile");
  try {
    const before = f.workspace.coordinator.getSnapshot().draft!;
    for (let i = 0; i < 10; i++)
      f.workspace.coordinator.replaceDraft({
        ...before,
        memberships: [
          { ...before.memberships[0]!, note: "x".repeat(128000) + i },
        ],
      });
    expect(format).not.toHaveBeenCalled();
    expect(f.recovery.getSnapshot().eligibility.watchlist).toBe(true);
    f.recovery.selectResource("watchlist", true);
    expect(f.recovery.captureDrafts()).toBe(true);
    expect(format).toHaveBeenCalled();
    expect(
      f.recovery.getSnapshot().file?.members.watchlist?.draft.memberships[0]
        ?.note,
    ).toHaveLength(128001);
    f.recovery.closeFile();
    f.workspace.coordinator.replaceDraft({
      ...before,
      memberships: [{ ...before.memberships[0]!, note: "x".repeat(300000) }],
    });
    expect(f.recovery.captureDrafts()).toBe(false);
    expect(f.recovery.getSnapshot().message).toMatch(/invalid|limits/u);
    expect(f.recovery.getSnapshot().file).toBeNull();
  } finally {
    format.mockRestore();
  }
});
it("compares the full invalid current raw note and restores the admitted file without demanding current exportability", async () => {
  const f = await fixture(),
    file = f.capture();
  f.recovery.closeFile();
  const w = f.workspace,
    current = w.coordinator.getSnapshot().draft!;
  w.coordinator.replaceDraft({
    ...current,
    memberships: [{ ...current.memberships[0]!, note: "raw".repeat(100000) }],
  });
  expect(
    watchlistFiles.formatManagedWatchlistDraftFile({
      accountScope: scope,
      capturedAt: "2026-10-30T00:00:00.000Z",
      baseVersion: w.coordinator.getSnapshot().baseVersion!,
      draft: w.coordinator.getSnapshot().draft!,
    }),
  ).toBeNull();
  await f.recovery.readFile(draftSetFile(file));
  expect(f.recovery.compareResource("watchlist")).toBe(true);
  const content = f.recovery.getSnapshot().comparison?.currentContent;
  expect(content?.format).toBe("investment-watchlist-draft");
  if (content?.format !== "investment-watchlist-draft")
    throw new Error("Missing complete current Watchlist");
  expect(content.draft.memberships[0]?.note).toHaveLength(300000);
  expect(f.recovery.restoreResource()).toBe(true);
  expect(w.coordinator.getSnapshot().draft).toEqual(
    file.members.watchlist!.draft,
  );
});
it("compares a loaded uninitialized Portfolio distinctly and restores only its admitted ledger at current base zero", async () => {
  const f = await fixture(),
    file = f.capture();
  f.recovery.closeFile();
  vi.mocked(f.api.loadPortfolio).mockResolvedValueOnce({
    version: 0,
    payload: null,
  });
  await f.workspace.portfolio.coordinator.load();
  expect(f.recovery.getSnapshot().eligibility.portfolio).toBe(false);
  await f.recovery.readFile(draftSetFile(file));
  expect(f.recovery.compareResource("portfolio")).toBe(true);
  expect(f.recovery.getSnapshot().comparison).toMatchObject({
    currentContent: null,
    currentBase: 0,
  });
  expect(f.recovery.restoreResource()).toBe(true);
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toMatchObject({
    baseVersion: 0,
    dirty: true,
    draft: { ledger: file.members.portfolio!.draft },
  });
});

it("retires legacy Watchlist file ownership before disposal activity-end notifications can start another operation", async () => {
  const f = await fixture();
  f.workspace.setView("watchlist");
  f.workspace.coordinator.replaceDraft(
    f.workspace.coordinator.getSnapshot().draft!,
  );
  const pending = deferred<"written">(),
    deliver = vi.fn(() => pending.promise),
    legacy = new ManagedWatchlistDraftRecovery({
      workspace: f.workspace,
      accountScope: Promise.resolve(scope),
      delivery: { deliver },
      routeActive: () => true,
    });
  await Promise.resolve();
  const saving = legacy.exportDraft();
  expect(deliver).toHaveBeenCalledOnce();
  let tried = false;
  const stop = f.workspace.subscribe(() => {
    if (!tried && !f.workspace.hasWatchlistDraftFileActivity()) {
      tried = true;
      legacy.cancel();
      void legacy.exportDraft();
    }
  });
  legacy.dispose();
  stop();
  expect(tried).toBe(true);
  expect(deliver).toHaveBeenCalledOnce();
  expect(f.workspace.hasWatchlistDraftFileActivity()).toBe(false);
  expect(legacy.getSnapshot().phase).toBe("retired");
  pending.resolve("written");
  await saving;
});

it("keeps legacy Watchlist clear activity-end notifications from starting a hidden replacement operation", async () => {
  const f = await fixture();
  f.workspace.setView("watchlist");
  f.workspace.coordinator.replaceDraft(
    f.workspace.coordinator.getSnapshot().draft!,
  );
  const pending = deferred<"written">(),
    deliver = vi.fn(() => pending.promise),
    legacy = new ManagedWatchlistDraftRecovery({
      workspace: f.workspace,
      accountScope: Promise.resolve(scope),
      delivery: { deliver },
      routeActive: () => true,
    });
  await Promise.resolve();
  const saving = legacy.exportDraft();
  let tried = false;
  const stop = f.workspace.subscribe(() => {
    if (!tried && !f.workspace.hasWatchlistDraftFileActivity()) {
      tried = true;
      legacy.cancel();
      void legacy.exportDraft();
    }
  });
  legacy.cancel();
  stop();
  expect(tried).toBe(true);
  expect(deliver).toHaveBeenCalledOnce();
  expect(f.workspace.hasWatchlistDraftFileActivity()).toBe(false);
  expect(legacy.getSnapshot().phase).toBe("idle");
  pending.resolve("written");
  await saving;
  legacy.dispose();
});
