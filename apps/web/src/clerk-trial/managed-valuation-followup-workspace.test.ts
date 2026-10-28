import { afterEach, expect, it, vi } from "vitest";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import type { ManagedApi } from "./managed-api";
import { prepareValuationFollowup } from "./managed-valuation-followup";
import { VALUATION_SCENARIOS } from "./managed-valuation-workbench";
import { ManagedValuationDraftRecovery } from "./managed-valuation-draft-recovery";
import {
  deferred,
  inputFile,
  scope,
} from "./test-valuation-draft-recovery-fixture";

const owners: ManagedWorkspace[] = [];
const files: ManagedValuationDraftRecovery[] = [];
afterEach(() => {
  for (const file of files.splice(0)) file.dispose();
  for (const owner of owners.splice(0)) owner.sessionOwner.dispose();
  vi.restoreAllMocks();
});
const question = "Will the next report support the assumptions? · Café 東京 😀";
const dueOn = "2026-12-31";
async function fixture(load = true) {
  const base = await createFixture("research-followups");
  const signal = new AbortController().signal;
  const catalog = await base.api.status(signal);
  const saved = await base.api.load(signal);
  const api: ManagedApi = {
    ...base.api,
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue(catalog),
    load: vi.fn<ManagedApi["load"]>().mockResolvedValue(saved),
    save: vi.fn(base.api.save),
    loadFollowups: vi.fn(base.followups!.api.loadFollowups),
    saveFollowups: vi.fn(base.followups!.api.saveFollowups),
    loadValuationAssumptions: vi.fn(base.api.loadValuationAssumptions),
    saveValuationAssumptions: vi.fn(base.api.saveValuationAssumptions),
    annualReport: vi.fn(base.api.annualReport),
    interimReport: vi.fn(base.api.interimReport),
    eodHistory: vi.fn(base.api.eodHistory),
    recentFilings: vi.fn(base.api.recentFilings),
    resolve: vi.fn<ManagedApi["resolve"]>((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing:
            base.researchCoverage.listings.find(
              (row) => row.listing.listingId === listingId,
            )?.listing ?? null,
        })),
      }),
    ),
  };
  const make = () => {
    const model = new ManagedWorkspace(
      api,
      base.followups!.nextSession(),
      undefined,
      {
        researchCoverage: base.researchCoverage,
        priceCoverage: base.priceCoverage,
      },
    );
    owners.push(model);
    return model;
  };
  const workspace = make();
  await workspace.refreshCatalog();
  await workspace.coordinator.load();
  workspace.setView("watchlist");
  const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
  const open = () =>
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
  open();
  const selection = workspace.getSnapshot().research!.selection;
  const fill = () => {
    const v = workspace.valuation;
    v.setDcfField("startingUnleveredCashFlowUsd", "100");
    v.setDcfField("enterpriseToEquityBridgeUsd", "100");
    v.setDcfField("dilutedShares", "10");
    v.setDcfField("waccPercent", "10");
    v.setDcfField("terminalGrowthPercent", "0");
    v.setExitField("baseRevenue", "1000");
    v.setExitField("cash", "100");
    v.setExitField("debt", "200");
    v.setExitField("dilutedShares", "100");
    v.setExitField("discountRatePercent", "10");
    for (const scenario of VALUATION_SCENARIOS) {
      v.setDcfScenario(scenario, "10");
      v.setExitScenario(scenario, "annualRevenueGrowthPercent", "10");
      v.setExitScenario(scenario, "targetEbitdaMarginPercent", "20");
      v.setExitScenario(scenario, "exitMultiple", "10");
    }
    return v.calculate()!;
  };
  fill();
  const context = () => workspace.captureValuationFollowup(selection);
  const initialLoad = (current: () => boolean = () => true) =>
    workspace.loadValuationFollowups(selection, current);
  const prepare = (model = "exit", scenario = "base", text = question) => {
    const captured = context();
    expect(captured.reason).toBeNull();
    const prepared = prepareValuationFollowup(
      captured.port!,
      model,
      scenario,
      text,
      dueOn,
      () => true,
    );
    expect(prepared.reason).toBeNull();
    return prepared.preview!;
  };
  const recovery = () => {
    const model = new ManagedValuationDraftRecovery({
      workspace,
      selection: () => selection,
      routeActive: () => true,
      accountScope: Promise.resolve(scope),
      delivery: { deliver: () => Promise.resolve("written") },
    });
    files.push(model);
    return model;
  };
  if (load) await initialLoad();
  return {
    base,
    api,
    workspace,
    make,
    member,
    selection,
    open,
    fill,
    context,
    initialLoad,
    prepare,
    recovery,
  };
}

it("creates only the complete authored Follow-ups draft once and persists it only after a separate Save/fresh Load", async () => {
  const f = await fixture();
  const watchlist = f.workspace.coordinator.getSnapshot();
  const editor = f.workspace.valuation.getSnapshot();
  const savedInputs =
    f.workspace.valuationAssumptions.coordinator.getSnapshot();
  const preview = f.prepare();
  expect(preview.check).toBe(
    `Question: ${question} | Authored estimate: Exit multiple authored-exit-multiple-v1; Base scenario; USD/share 19.00. Summary only; inputs and source evidence not included.`,
  );
  expect(preview.listing).toEqual(f.selection.listing);
  expect(preview.dueOn).toBe(dueOn);
  const created = preview.create();
  expect(created).not.toBeNull();
  expect(created).toMatchObject({
    check: preview.check,
    dueOn,
    listing: preview.listing,
    status: "open",
    result: "",
    completedOn: null,
  });
  expect(preview.create()).toBeNull();
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  expect(f.workspace.valuationAssumptions.coordinator.getSnapshot()).toBe(
    savedInputs,
  );
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  f.workspace.closeResearch();
  f.workspace.setView("followups");
  f.workspace.followups.select(created!.id);
  const research = await f.workspace.prepareFollowupResearch(created!);
  expect(research).not.toBeNull();
  f.workspace.openFollowupResearch(research!);
  expect(f.workspace.getSnapshot().research?.selection.listing).toEqual(
    preview.listing,
  );
  f.workspace.closeResearch();
  expect(f.workspace.followups.currentEntry(created!.id)).toEqual(created);
  const unsaved = f.make();
  await unsaved.followups.coordinator.load();
  expect(unsaved.followups.coordinator.getSnapshot().draft!.entries).toEqual(
    [],
  );
  await f.workspace.followups.coordinator.save();
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  const fresh = f.make();
  await fresh.followups.coordinator.load();
  expect(fresh.followups.coordinator.getSnapshot().draft!.entries).toEqual([
    created,
  ]);
  for (const call of [
    f.api.save,
    f.api.loadValuationAssumptions,
    f.api.saveValuationAssumptions,
    f.api.annualReport,
    f.api.interimReport,
    f.api.eodHistory,
    f.api.recentFilings,
  ])
    expect(call).not.toHaveBeenCalled();
});

it("loads an initially absent Follow-ups draft explicitly without recalculating or replacing loaded work", async () => {
  const f = await fixture(false);
  const editor = f.workspace.valuation.getSnapshot();
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  expect(f.context().port).toBeNull();
  expect(f.workspace.canLoadValuationFollowups(f.selection)).toBe(true);
  await f.initialLoad();
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  const created = f.prepare().create();
  const draft = f.workspace.followups.coordinator.getSnapshot().draft;
  await f.initialLoad();
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
  expect(f.workspace.followups.currentEntry(created!.id)).toEqual(created);
});

it.each([
  "form",
  "note",
  "valuation",
  "files",
  "navigation",
  "session",
] as const)(
  "rejects an initial Load continuation after %s changes",
  async (boundary) => {
    const f = await fixture(false);
    const read = deferred<Awaited<ReturnType<ManagedApi["loadFollowups"]>>>();
    vi.mocked(f.api.loadFollowups).mockReturnValueOnce(read.promise);
    let current = true;
    const pending = f.initialLoad(() => current);
    if (boundary === "form") current = false;
    if (boundary === "note")
      f.workspace.note(f.member.listingId, "changed question context");
    if (boundary === "valuation") f.workspace.valuation.calculate();
    if (boundary === "files") {
      const marker = {};
      f.workspace.valuation.beginDraftFileActivity(marker);
      f.workspace.valuation.endDraftFileActivity(marker);
    }
    if (boundary === "navigation") {
      f.workspace.setNavigationBlocked(true);
      f.workspace.setNavigationBlocked(false);
    }
    if (boundary === "session") f.workspace.sessionOwner.dispose();
    read.resolve({ version: 0, payload: { schemaVersion: 1, entries: [] } });
    await pending;
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  },
);

it.each([
  "note",
  "followups",
  "saved-inputs",
  "calculation",
  "valuation-file",
  "followup-file",
  "navigation",
  "visit",
  "session",
] as const)(
  "permanently retires the preview after %s including round trips",
  async (boundary) => {
    const f = await fixture();
    const preview = f.prepare();
    if (boundary === "note") {
      f.workspace.note(f.member.listingId, "changed");
      f.workspace.note(f.member.listingId, f.member.note);
    }
    if (boundary === "followups")
      f.workspace.followups.coordinator.replaceDraft({
        schemaVersion: 1,
        entries: [],
      });
    if (boundary === "saved-inputs")
      await f.workspace.valuationAssumptions.coordinator.load();
    if (boundary === "calculation") f.workspace.valuation.calculate();
    if (boundary === "valuation-file") {
      const marker = {};
      f.workspace.valuation.beginDraftFileActivity(marker);
      f.workspace.valuation.endDraftFileActivity(marker);
    }
    if (boundary === "followup-file") {
      const marker = {};
      f.workspace.followups.beginDraftFileActivity(marker);
      f.workspace.followups.endDraftFileActivity(marker);
    }
    if (boundary === "navigation") {
      f.workspace.setNavigationBlocked(true);
      f.workspace.setNavigationBlocked(false);
    }
    if (boundary === "visit") {
      f.workspace.closeResearch();
      f.open();
    }
    if (boundary === "session") f.workspace.sessionOwner.dispose();
    expect(preview.isCurrent()).toBe(false);
    expect(preview.create()).toBeNull();
    expect(preview.isCurrent()).toBe(false);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  },
);

it("holds a real local input file read and review without changing inputs, then retires old previews after Cancel", async () => {
  const f = await fixture();
  const preview = f.prepare();
  const editor = f.workspace.valuation.getSnapshot();
  const file = inputFile(f.workspace.valuation.captureInputs()!.entry);
  const bytes = deferred<ArrayBuffer>();
  file.arrayBuffer.mockReturnValueOnce(bytes.promise);
  const recovery = f.recovery();
  await Promise.resolve();
  const read = recovery.readFile(file);
  expect(f.workspace.valuation.hasDraftFileActivity()).toBe(true);
  expect(f.context().port).toBeNull();
  expect(preview.create()).toBeNull();
  bytes.resolve(await file.arrayBuffer());
  await read;
  expect(recovery.getSnapshot().phase).toBe("review");
  expect(f.workspace.valuation.hasDraftFileActivity()).toBe(true);
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  recovery.cancel();
  expect(f.workspace.valuation.hasDraftFileActivity()).toBe(false);
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  expect(preview.isCurrent()).toBe(false);
  expect(f.prepare().create()).not.toBeNull();
});

it("file export and disposal release activity without invalidating their own editor capture", async () => {
  const f = await fixture();
  const recovery = f.recovery();
  await Promise.resolve();
  const editor = f.workspace.valuation.getSnapshot();
  const preview = f.prepare();
  await recovery.exportInputs();
  expect(recovery.getSnapshot().message).toContain("saved");
  expect(f.workspace.valuation.hasDraftFileActivity()).toBe(false);
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  expect(preview.create()).toBeNull();
  await recovery.readFile(
    inputFile(f.workspace.valuation.captureInputs()!.entry),
  );
  expect(f.workspace.valuation.hasDraftFileActivity()).toBe(true);
  recovery.dispose();
  expect(f.workspace.valuation.hasDraftFileActivity()).toBe(false);
});

it.each(["eod", "annual", "filings", "interim"] as const)(
  "retires a preview after %s evidence is closed and reopened without a request",
  async (source) => {
    const f = await fixture();
    const preview = f.prepare();
    f.workspace[source].close();
    f.workspace[source].open(f.selection);
    expect(preview.isCurrent()).toBe(false);
    expect(preview.create()).toBeNull();
    for (const request of [
      f.api.eodHistory,
      f.api.annualReport,
      f.api.recentFilings,
      f.api.interimReport,
      f.api.saveFollowups,
    ])
      expect(request).not.toHaveBeenCalled();
  },
);

it("refuses a company outside the editable Watchlist and any valuation file activity without changing Follow-ups", async () => {
  const f = await fixture();
  const draft = f.workspace.followups.coordinator.getSnapshot().draft;
  const marker = {};
  f.workspace.valuation.beginDraftFileActivity(marker);
  expect(f.context().port).toBeNull();
  f.workspace.valuation.endDraftFileActivity(marker);
  expect(f.context().port).not.toBeNull();
  const watchlist = f.workspace.coordinator.getSnapshot().draft!;
  f.workspace.coordinator.replaceDraft({
    ...watchlist,
    memberships: watchlist.memberships.filter(
      (member) => member.listingId !== f.member.listingId,
    ),
  });
  expect(f.context().port).toBeNull();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
