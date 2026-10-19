import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_VALUATION_ASSUMPTIONS_PAYLOAD,
  type ManagedCatalogSnapshotDto,
  type ManagedValuationAssumptionsDto,
  type ValuationAssumptionEntry,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { eodSelection } from "./eod-history-fixture";
import { ManagedValuationAssumptions } from "./managed-valuation-assumptions";
import {
  ManagedValuationWorkbench,
  type DcfField,
  type ExitField,
} from "./managed-valuation-workbench";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { TrialSession } from "./session";

const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: eodSelection.catalogSnapshotSha256,
  catalogId: "invented-catalog",
  catalogVersion: "invented-version",
  acquiredAt: "2026-10-01T00:00:00.000Z",
  generatedAt: "2026-10-01T00:00:00.000Z",
  asOf: "2026-10-01T00:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented test catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 1,
    activeListings: 1,
    admittedSourceRecords: 1,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 1,
    providerMappings: 1,
    quarantinedSourceRecords: 0,
    sourceRecords: 1,
    staleSourceRecords: 0,
    shareClasses: 1,
    totalSecurities: 1,
    unsupportedSourceRecords: 0,
  },
};
function entry(
  selection: ManagedResearchSelection = eodSelection,
): ValuationAssumptionEntry {
  const editor = new ManagedValuationWorkbench();
  editor.activate(selection);
  editor.setDcfField("waccPercent", " 1.. 😀 ");
  editor.setExitField("horizonYears", "");
  editor.setExitScenario("expansion", "exitMultiple", "12.00");
  return editor.captureInputs()!.entry;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
function fixture(
  initial: ManagedValuationAssumptionsDto = {
    version: 0,
    payload: EMPTY_VALUATION_ASSUMPTIONS_PAYLOAD,
  },
) {
  let stored = structuredClone(initial);
  let catalog = snapshot;
  let keys = 0;
  const listings = new Map(
    initial.payload.entries.map((row) => [row.listing.listingId, row.listing]),
  );
  listings.set(eodSelection.listing.listingId, eodSelection.listing);
  const api: Pick<
    ManagedApi,
    "loadValuationAssumptions" | "saveValuationAssumptions" | "resolve"
  > = {
    loadValuationAssumptions: vi
      .fn<ManagedApi["loadValuationAssumptions"]>()
      .mockImplementation(() => Promise.resolve(structuredClone(stored))),
    saveValuationAssumptions: vi
      .fn<ManagedApi["saveValuationAssumptions"]>()
      .mockImplementation((command) => {
        stored = {
          version: command.expectedVersion + 1,
          payload: structuredClone(command.payload),
        };
        return Promise.resolve({ ...structuredClone(stored), replayed: false });
      }),
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: listings.get(listingId) ?? null,
        })),
      }),
    ),
  };
  const session: TrialSession = {
    userId: "invented-user",
    sessionId: "invented-session",
    getToken: vi.fn(),
    signOut: vi.fn(),
  };
  const workbench = new ManagedValuationWorkbench();
  const onRetire = vi.fn();
  const model = new ManagedValuationAssumptions(api, session, workbench, {
    getCatalogSnapshot: () => catalog,
    onRetire,
    newKey: () => `invented-valuation-command-${++keys}`,
  });
  return {
    model,
    workbench,
    api,
    session,
    onRetire,
    listings,
    saved: () => structuredClone(stored),
    setCatalog: (value: ManagedCatalogSnapshotDto) => {
      catalog = value;
    },
  };
}
async function stage(f: ReturnType<typeof fixture>) {
  await f.model.prepareStage();
  const review = f.model.getSnapshot().stageReview;
  expect(review).not.toBeNull();
  expect(f.model.stageCurrent(review)).toBe(true);
}
async function loaded(initial?: ManagedValuationAssumptionsDto) {
  const f = fixture(initial);
  f.workbench.activate(eodSelection);
  await f.model.coordinator.load();
  return f;
}
function fillValidInputs(editor: ManagedValuationWorkbench) {
  const dcf = {
    startingUnleveredCashFlowUsd: "100",
    enterpriseToEquityBridgeUsd: "0",
    dilutedShares: "10",
    forecastYears: "5",
    waccPercent: "10",
    terminalGrowthPercent: "2",
  };
  const exit = {
    baseRevenue: "1000",
    cash: "0",
    debt: "0",
    dilutedShares: "10",
    horizonYears: "5",
    discountRatePercent: "10",
  };
  for (const [field, value] of Object.entries(dcf))
    editor.setDcfField(field as DcfField, value);
  for (const [field, value] of Object.entries(exit))
    editor.setExitField(field as ExitField, value);
  for (const scenario of ["conservative", "base", "expansion"] as const) {
    editor.setDcfScenario(scenario, "5");
    editor.setExitScenario(scenario, "annualRevenueGrowthPercent", "5");
    editor.setExitScenario(scenario, "targetEbitdaMarginPercent", "20");
    editor.setExitScenario(scenario, "exitMultiple", "10");
  }
}

describe("saved authored valuation assumptions", () => {
  it("saves both editable models, reopens in a fresh session, reviews/restores and calculates only explicitly", async () => {
    const original = await loaded();
    fillValidInputs(original.workbench);
    await stage(original);
    expect(original.workbench.getSnapshot().calculation).toBeNull();
    expect(original.api.saveValuationAssumptions).not.toHaveBeenCalled();
    await original.model.coordinator.save();
    const durable = original.saved();
    const fresh = fixture(durable);
    fresh.workbench.activate({
      ...eodSelection,
      cik: null,
      origin: "watchlist",
    });
    await fresh.model.coordinator.load();
    expect(
      fresh.workbench.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd,
    ).toBe("");
    const saved =
      fresh.model.coordinator.getSnapshot().saved!.payload.entries[0]!;
    const review = fresh.model.reviewSavedInputs(saved)!;
    expect(fresh.model.useSavedInputs(review)).toBe(true);
    expect(fresh.workbench.getSnapshot().dcfDraft).toEqual(
      durable.payload.entries[0]!.dcf.inputs,
    );
    expect(fresh.workbench.getSnapshot().exitDraft).toEqual(
      durable.payload.entries[0]!.exit.inputs,
    );
    expect(fresh.workbench.getSnapshot().calculation).toBeNull();
    const calculation = fresh.workbench.calculate()!;
    expect(calculation.dcfResult.status).toBe("available");
    expect(calculation.exitResult.status).toBe("available");
    expect(original.api.resolve).toHaveBeenCalledOnce();
    expect(fresh.api.resolve).not.toHaveBeenCalled();
    expect(fresh.api.saveValuationAssumptions).not.toHaveBeenCalled();
  });
  it("keeps scratch input through explicit read, stages both raw maps and preserves other saved entries", async () => {
    const other = entry({
      ...eodSelection,
      listing: {
        ...eodSelection.listing,
        listingId: "other-listing",
        symbol: "OTHER",
      },
    });
    const f = fixture({
      version: 3,
      payload: { schemaVersion: 1, entries: [other] },
    });
    f.workbench.activate(eodSelection);
    f.workbench.setDcfField("waccPercent", " 1.. 😀 ");
    f.workbench.setExitField("horizonYears", "");
    const before = f.workbench.getSnapshot();
    expect(f.api.loadValuationAssumptions).not.toHaveBeenCalled();
    await f.model.coordinator.load();
    expect(f.workbench.getSnapshot()).toBe(before);
    await f.model.prepareStage();
    const review = f.model.getSnapshot().stageReview!;
    expect(review.previous).toBeNull();
    expect(review.payload.entries[0]).toEqual(other);
    expect(review.capture.entry.dcf.inputs.waccPercent).toBe(" 1.. 😀 ");
    expect(review.capture.entry.exit.inputs.horizonYears).toBe("");
    expect(f.model.sessionResource.getSnapshot().dirty).toBe(true);
    expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
    expect(f.workbench.getSnapshot().calculation).toBeNull();
    expect(f.model.stageCurrent(review)).toBe(true);
    expect(f.workbench.hasDraft()).toBe(true);
    await f.model.coordinator.save();
    expect(f.api.saveValuationAssumptions).toHaveBeenCalledOnce();
    expect(f.saved()).toEqual({ version: 4, payload: review.payload });
    expect(f.workbench.hasDraft()).toBe(false);
    expect(f.saved().payload.entries[0]).toEqual(other);
  });

  it.each([true, false])(
    "fresh read restores only confirmed saved raw inputs across known/null CIK (%s)",
    async (knownFirst) => {
      const first = entry({
        ...eodSelection,
        cik: knownFirst ? eodSelection.cik : null,
        origin: "discover",
      });
      const f = fixture({
        version: 7,
        payload: { schemaVersion: 1, entries: [first] },
      });
      const context = {
        ...eodSelection,
        cik: knownFirst ? null : eodSelection.cik,
        origin: "watchlist" as const,
      };
      f.workbench.activate(context);
      f.workbench.setExitField("cash", "current scratch");
      await f.model.coordinator.load();
      const confirmed =
        f.model.coordinator.getSnapshot().saved!.payload.entries[0]!;
      const preview = f.model.reviewSavedInputs(confirmed)!;
      expect(preview.current.exitDraft.cash).toBe("current scratch");
      expect(f.workbench.getSnapshot().exitDraft.cash).toBe("current scratch");
      expect(f.model.useSavedInputs(preview)).toBe(true);
      expect(f.workbench.getSnapshot().owner).toEqual(context);
      expect(f.workbench.getSnapshot().dcfDraft).toEqual(first.dcf.inputs);
      expect(f.workbench.getSnapshot().exitDraft).toEqual(first.exit.inputs);
      expect(f.workbench.getSnapshot().calculation).toBeNull();
      expect(f.workbench.hasDraft()).toBe(false);
      expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
      expect(f.api.resolve).not.toHaveBeenCalled();
      expect(f.workbench.calculate()!.dcfResult.status).toBe("unavailable");
      f.workbench.setExitField("cash", "new revision");
      expect(f.workbench.hasDraft()).toBe(true);
    },
  );

  it("does not treat staged or copied entries as confirmed saved data", async () => {
    const f = await loaded();
    await stage(f);
    const staged = f.model.coordinator.getSnapshot().draft!.entries[0]!;
    expect(f.model.reviewSavedInputs(staged)).toBeNull();
    await f.model.coordinator.save();
    const saved = f.model.coordinator.getSnapshot().saved!.payload.entries[0]!;
    expect(f.model.reviewSavedInputs(structuredClone(saved))).toBeNull();
    f.workbench.activate({ ...eodSelection, cik: "0000000002" });
    expect(f.model.reviewSavedInputs(saved)).toBeNull();
  });
  it("refuses replacing an existing nonnull issuer claim with a conflicting nonnull claim", async () => {
    const f = await loaded({
      version: 1,
      payload: { schemaVersion: 1, entries: [entry()] },
    });
    f.workbench.activate({ ...eodSelection, cik: "0000000002" });
    await f.model.prepareStage();
    expect(f.model.getSnapshot().stageReview).toBeNull();
    expect(f.api.resolve).not.toHaveBeenCalled();
    expect(f.model.coordinator.getSnapshot().draft!.entries[0]!.cik).toBe(
      "0000000001",
    );
  });

  it("blocks staging rejected overlength input but retains invalid numeric text", async () => {
    const f = await loaded();
    f.workbench.setDcfField("waccPercent", "9".repeat(513));
    await f.model.prepareStage();
    expect(f.model.getSnapshot().stageReview).toBeNull();
    expect(f.api.resolve).not.toHaveBeenCalled();
    f.workbench.setDcfField("waccPercent", " 12.. ");
    await stage(f);
    expect(
      f.model.coordinator.getSnapshot().draft!.entries[0]!.dcf.inputs
        .waccPercent,
    ).toBe(" 12.. ");
  });

  it("requires exact catalog listing admission and rejects unreviewed resource replacement", async () => {
    const f = await loaded();
    f.listings.set(eodSelection.listing.listingId, {
      ...eodSelection.listing,
      shareClassId: "rebound",
    });
    await f.model.prepareStage();
    expect(f.model.getSnapshot().stageReview).toBeNull();
    f.model.coordinator.replaceDraft({ schemaVersion: 1, entries: [entry()] });
    expect(f.model.canSavePayload()).toBe(false);
    await f.model.coordinator.save();
    expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
  });

  it("enforces twenty entries without displacing another model, and permits explicit historical removal", async () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      entry({
        ...eodSelection,
        listing: { ...eodSelection.listing, listingId: `listing-${i}` },
      }),
    );
    const f = await loaded({
      version: 9,
      payload: { schemaVersion: 1, entries },
    });
    await f.model.prepareStage();
    expect(f.api.resolve).not.toHaveBeenCalled();
    expect(f.model.getSnapshot().stageReview).toBeNull();
    const first = f.model.coordinator.getSnapshot().draft!.entries[0]!;
    expect(f.model.remove(first)).toBe(true);
    expect(f.model.coordinator.getSnapshot().draft!.entries).toHaveLength(19);
    expect(f.model.canSavePayload()).toBe(true);
    expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
    await stage(f);
    expect(f.model.coordinator.getSnapshot().draft!.entries).toHaveLength(20);
  });
});

describe("assumption review and save lifetimes", () => {
  it("restores the unsaved scratch warning only after confirmed removal and never auto-cleans on reappearance", async () => {
    const f = await loaded();
    f.workbench.setExitField("cash", "saved authored text");
    await stage(f);
    await f.model.coordinator.save();
    const durable = f.saved();
    expect(f.workbench.hasDraft()).toBe(false);
    const removing = f.model.coordinator.getSnapshot().draft!.entries[0]!;
    expect(f.model.remove(removing)).toBe(true);
    expect(f.workbench.hasDraft()).toBe(false);
    await f.model.coordinator.save();
    expect(f.saved().payload.entries).toHaveLength(0);
    expect(f.workbench.hasDraft()).toBe(true);
    expect(f.workbench.getSnapshot().exitDraft.cash).toBe(
      "saved authored text",
    );
    vi.mocked(f.api.loadValuationAssumptions).mockResolvedValueOnce({
      ...durable,
      version: 9,
    });
    await f.model.coordinator.load();
    expect(f.workbench.hasDraft()).toBe(true);
    const saved = f.model.coordinator.getSnapshot().saved!.payload.entries[0]!;
    expect(f.model.useSavedInputs(f.model.reviewSavedInputs(saved))).toBe(true);
    expect(f.workbench.hasDraft()).toBe(false);
  });

  it.each(["removed", "replaced"] as const)(
    "keeps paused editor inputs dirty when a latest load confirms they were %s",
    async (change) => {
      const savedEntry = entry();
      const f = await loaded({
        version: 1,
        payload: { schemaVersion: 1, entries: [savedEntry] },
      });
      const confirmed =
        f.model.coordinator.getSnapshot().saved!.payload.entries[0]!;
      expect(f.model.useSavedInputs(f.model.reviewSavedInputs(confirmed))).toBe(
        true,
      );
      f.workbench.activate(null);
      expect(f.workbench.hasDraft()).toBe(false);
      const changed = {
        ...savedEntry,
        exit: {
          ...savedEntry.exit,
          inputs: {
            ...savedEntry.exit.inputs,
            cash: "different confirmed text",
          },
        },
      };
      vi.mocked(f.api.loadValuationAssumptions).mockResolvedValueOnce({
        version: 5,
        payload: {
          schemaVersion: 1,
          entries: change === "removed" ? [] : [changed],
        },
      });
      await f.model.coordinator.load();
      expect(f.workbench.hasDraft()).toBe(true);
      expect(f.workbench.getSnapshot().context).toBeNull();
      expect(f.workbench.getSnapshot().dcfDraft).toEqual(savedEntry.dcf.inputs);
      expect(f.workbench.getSnapshot().exitDraft).toEqual(
        savedEntry.exit.inputs,
      );
      expect(f.model.coordinator.getSnapshot().dirty).toBe(false);
      expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
    },
  );
  it.each(["edit", "navigation", "catalog", "cancel", "retire"] as const)(
    "refuses a late stage review after %s",
    async (change) => {
      const f = await loaded();
      const pending = deferred<Awaited<ReturnType<ManagedApi["resolve"]>>>();
      vi.mocked(f.api.resolve).mockReturnValue(pending.promise);
      const work = f.model.prepareStage();
      const draft = f.model.coordinator.getSnapshot().draft;
      if (change === "edit") f.workbench.setExitField("cash", "newer");
      if (change === "navigation") f.workbench.activate(null);
      if (change === "catalog") {
        f.setCatalog({ ...snapshot });
        f.model.syncCatalog();
      }
      if (change === "cancel") f.model.cancelReview();
      if (change === "retire") f.model.retire();
      pending.resolve({
        snapshotSha256: snapshot.snapshotSha256,
        results: [
          {
            listingId: eodSelection.listing.listingId,
            listing: eodSelection.listing,
          },
        ],
      });
      await work;
      expect(f.model.getSnapshot().stageReview).toBeNull();
      expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
      if (change !== "retire")
        expect(f.model.coordinator.getSnapshot().draft).toBe(draft);
      else expect(f.workbench.getSnapshot().retired).toBe(true);
    },
  );

  it.each(["edit", "cancel", "retire"] as const)(
    "does not stage after a synchronous review-clear listener performs %s",
    async (action) => {
      const f = await loaded();
      await f.model.prepareStage();
      const review = f.model.getSnapshot().stageReview!;
      const before = f.model.coordinator.getSnapshot().draft;
      let armed = true;
      f.model.subscribe(() => {
        if (!armed) return;
        if (f.model.getSnapshot().stageReview !== null) return;
        armed = false;
        if (action === "edit")
          f.workbench.setExitField("cash", "listener edit");
        if (action === "cancel") f.model.cancelReview();
        if (action === "retire") f.model.retire();
      });
      expect(f.model.stageCurrent(review)).toBe(false);
      if (action !== "retire")
        expect(f.model.coordinator.getSnapshot().draft).toBe(before);
      expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
    },
  );

  it.each(["edit", "cancel", "read_then_cancel"] as const)(
    "does not restore after a synchronous review-clear listener performs %s",
    async (action) => {
      const f = await loaded({
        version: 1,
        payload: { schemaVersion: 1, entries: [entry()] },
      });
      f.workbench.setExitField("cash", "scratch");
      const saved =
        f.model.coordinator.getSnapshot().saved!.payload.entries[0]!;
      const review = f.model.reviewSavedInputs(saved)!;
      let armed = true;
      f.model.subscribe(() => {
        if (!armed) return;
        if (f.model.getSnapshot().restoreReview !== null) return;
        armed = false;
        if (action === "edit")
          f.workbench.setExitField("cash", "listener edit");
        if (action === "cancel") f.model.cancelReview();
        if (action === "read_then_cancel") {
          void f.model.coordinator.load();
          f.model.cancelReview();
        }
      });
      expect(f.model.useSavedInputs(review)).toBe(false);
      expect(f.workbench.getSnapshot().exitDraft.cash).toBe(
        action === "edit" ? "listener edit" : "scratch",
      );
    },
  );

  it("cannot acknowledge later editor text from an earlier matching receipt", async () => {
    const f = await loaded();
    f.workbench.setExitField("cash", "captured");
    await stage(f);
    const pending =
      deferred<Awaited<ReturnType<ManagedApi["saveValuationAssumptions"]>>>();
    vi.mocked(f.api.saveValuationAssumptions).mockReturnValue(pending.promise);
    const saving = f.model.coordinator.save();
    const command = vi.mocked(f.api.saveValuationAssumptions).mock.calls[0]![0];
    f.workbench.setExitField("cash", "later text");
    pending.resolve({
      version: command.expectedVersion + 1,
      payload: command.payload,
      replayed: false,
    });
    await saving;
    expect(f.model.coordinator.getSnapshot().dirty).toBe(false);
    expect(f.workbench.getSnapshot().exitDraft.cash).toBe("later text");
    expect(f.workbench.hasDraft()).toBe(true);
  });

  it("reconciles only the original uncertain command and keeps later editor revisions dirty", async () => {
    const f = await loaded();
    await stage(f);
    vi.mocked(f.api.saveValuationAssumptions).mockRejectedValueOnce(
      new TrialApiError("commit_unknown"),
    );
    await f.model.coordinator.save();
    const original = vi.mocked(f.api.saveValuationAssumptions).mock
      .calls[0]![0];
    expect(f.model.coordinator.getSnapshot().uncertain).toBe(true);
    f.workbench.setDcfField("waccPercent", "later invalid");
    await f.model.prepareStage();
    expect(f.model.getSnapshot().stageReview).toBeNull();
    vi.mocked(f.api.saveValuationAssumptions).mockResolvedValueOnce({
      version: 1,
      payload: original.payload,
      replayed: true,
    });
    await f.model.coordinator.reconcile();
    expect(vi.mocked(f.api.saveValuationAssumptions).mock.calls[1]![0]).toEqual(
      original,
    );
    expect(f.model.coordinator.getSnapshot().replayPending).toBe(true);
    expect(f.workbench.hasDraft()).toBe(true);
    expect(f.workbench.getSnapshot().dcfDraft.waccPercent).toBe(
      "later invalid",
    );
  });

  it("loads the latest conflict explicitly and requires a saved/draft choice", async () => {
    const f = await loaded();
    await stage(f);
    vi.mocked(f.api.saveValuationAssumptions).mockRejectedValueOnce(
      new TrialApiError("conflict"),
    );
    await f.model.coordinator.save();
    expect(f.model.coordinator.getSnapshot().conflict).toBe(true);
    expect(f.model.canEdit()).toBe(false);
    vi.mocked(f.api.loadValuationAssumptions).mockResolvedValueOnce({
      version: 3,
      payload: EMPTY_VALUATION_ASSUMPTIONS_PAYLOAD,
    });
    await f.model.coordinator.load();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toHaveLength(1);
    f.model.coordinator.useSaved();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toHaveLength(0);
    expect(f.model.coordinator.getSnapshot().baseVersion).toBe(3);
  });

  it("retirement clears scratch and resource before late saved reads or callbacks finish", async () => {
    const f = fixture();
    f.workbench.activate(eodSelection);
    f.workbench.setExitField("cash", "private invented draft");
    const pending = deferred<ManagedValuationAssumptionsDto>();
    vi.mocked(f.api.loadValuationAssumptions).mockReturnValue(pending.promise);
    const work = f.model.coordinator.load();
    f.model.retire();
    expect(f.workbench.getSnapshot().owner).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft).toBeNull();
    pending.resolve({
      version: 1,
      payload: { schemaVersion: 1, entries: [entry()] },
    });
    await work;
    expect(f.model.coordinator.getSnapshot().phase).toBe("retired");
    expect(f.workbench.getSnapshot().exitDraft.cash).toBe("");
    expect(f.onRetire).toHaveBeenCalledOnce();
  });
});

describe("independent saved valuation catalog review", () => {
  it("updates only reviewed catalog metadata, then needs confirmed Save before restore", async () => {
    const previous = entry();
    const f = await loaded({
      version: 1,
      payload: { schemaVersion: 1, entries: [previous] },
    });
    const currentCatalog = {
      ...snapshot,
      snapshotSha256: `sha256:${"b".repeat(64)}` as const,
    };
    const currentListing = {
      ...eodSelection.listing,
      issuerName: "Updated display",
    };
    f.setCatalog(currentCatalog);
    f.model.syncCatalog();
    f.listings.set(currentListing.listingId, currentListing);
    f.workbench.activate({
      ...eodSelection,
      catalogSnapshotSha256: currentCatalog.snapshotSha256,
      listing: currentListing,
    });
    const oldSaved =
      f.model.coordinator.getSnapshot().saved!.payload.entries[0]!;
    expect(f.model.reviewSavedInputs(oldSaved)).toBeNull();
    await f.model.reviewCatalog();
    expect(f.model.getSnapshot().catalogReview!.entries[0]!.status).toBe(
      "update",
    );
    expect(f.model.applyCatalogReview()).toBe(true);
    const updated = f.model.coordinator.getSnapshot().draft!.entries[0]!;
    expect(updated.dcf).toEqual(previous.dcf);
    expect(updated.exit).toEqual(previous.exit);
    expect(f.model.reviewSavedInputs(updated)).toBeNull();
    expect(f.model.canSavePayload()).toBe(true);
    await f.model.coordinator.save();
    const confirmed =
      f.model.coordinator.getSnapshot().saved!.payload.entries[0]!;
    expect(f.model.useSavedInputs(f.model.reviewSavedInputs(confirmed))).toBe(
      true,
    );
    expect(f.workbench.getSnapshot().owner!.listing.issuerName).toBe(
      "Updated display",
    );
    expect(f.api.resolve).toHaveBeenCalledOnce();
  });

  it.each(["missing", "rebound"] as const)(
    "retains readable %s identities and refuses their catalog update",
    async (status) => {
      const f = await loaded({
        version: 1,
        payload: { schemaVersion: 1, entries: [entry()] },
      });
      if (status === "missing")
        f.listings.delete(eodSelection.listing.listingId);
      else
        f.listings.set(eodSelection.listing.listingId, {
          ...eodSelection.listing,
          shareClassId: "rebound",
        });
      await f.model.reviewCatalog();
      expect(f.model.getSnapshot().catalogReview!.entries[0]!.status).toBe(
        status,
      );
      expect(f.model.applyCatalogReview()).toBe(false);
      const previous = f.model.coordinator.getSnapshot().draft!.entries[0]!;
      expect(f.model.remove(previous)).toBe(true);
      expect(f.model.canSavePayload()).toBe(true);
    },
  );
});
