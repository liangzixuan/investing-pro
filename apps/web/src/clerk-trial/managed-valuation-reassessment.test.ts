import { ManagedValuationReassessment } from "./managed-valuation-reassessment";
import {
  captureValuationCalculationGuard,
  evaluateValuationInputs,
} from "./managed-valuation-workbench";
import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_VALUATION_ASSUMPTIONS_PAYLOAD,
  type ManagedCatalogSnapshotDto,
  type ManagedValuationAssumptionsDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { eodSelection } from "./eod-history-fixture";
import { ManagedValuationAssumptions } from "./managed-valuation-assumptions";
import {
  ManagedValuationWorkbench,
  type DcfField,
  type ExitField,
} from "./managed-valuation-workbench";
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

const captureTime = "2026-11-01T10:00:00.000Z";
const evaluationTime = "2026-11-01T10:01:00.000Z";
async function reassessmentFixture(validSaved = true) {
  const source = new ManagedValuationWorkbench();
  source.activate(eodSelection);
  if (validSaved) fillValidInputs(source);
  else source.setDcfField("waccPercent", " raw 1.. 😀 ");
  const savedEntry = source.captureInputs()!.entry;
  const f = await loaded({
    version: 7,
    payload: { schemaVersion: 1, entries: [savedEntry] },
  });
  fillValidInputs(f.workbench);
  let available = true;
  let time = captureTime;
  const model = new ManagedValuationReassessment(f.workbench, f.model, {
    now: () => time,
    available: () => available,
  });
  const saved = f.model.coordinator.getSnapshot().saved!.payload.entries[0]!;
  return {
    ...f,
    reassessment: model,
    savedEntry: saved,
    capture: () => model.capture(saved, f.model.coordinator.getSnapshot())!,
    calculate: () => {
      time = evaluationTime;
      return model.calculate(model.getSnapshot(), f.workbench.getSnapshot());
    },
    available: (value: boolean) => {
      available = value;
      model.reconcile();
    },
  };
}

describe("confirmed saved valuation reassessment", () => {
  it("requires exact CIK on both owner and context while preserving nullable restore semantics", async () => {
    const source = new ManagedValuationWorkbench();
    source.activate({ ...eodSelection, cik: null });
    const unknown = source.captureInputs()!.entry;
    const f = await loaded({
      version: 7,
      payload: { schemaVersion: 1, entries: [unknown] },
    });
    const saved = f.model.coordinator.getSnapshot().saved!.payload.entries[0]!;
    expect(f.model.canCaptureConfirmedEntry(saved)).toBe(false);
    expect(f.model.captureConfirmedEntry(saved)).toBeNull();
    // Explicit restore keeps its original compatible-CIK admission.
    expect(f.model.reviewSavedInputs(saved)).not.toBeNull();

    const known = await reassessmentFixture();
    known.workbench.activate({ ...eodSelection, cik: null });
    expect(known.workbench.getSnapshot().owner!.cik).toBe(eodSelection.cik);
    expect(known.workbench.getSnapshot().context!.cik).toBeNull();
    expect(known.capture()).toBeNull();

    const g = fixture({
      version: 7,
      payload: { schemaVersion: 1, entries: [saved] },
    });
    g.workbench.activate({ ...eodSelection, cik: null });
    fillValidInputs(g.workbench);
    await g.model.coordinator.load();
    const sameUnknown =
      g.model.coordinator.getSnapshot().saved!.payload.entries[0]!;
    expect(g.model.captureConfirmedEntry(sameUnknown)).not.toBeNull();
    g.workbench.activate(eodSelection);
    expect(g.workbench.getSnapshot().owner!.cik).toBeNull();
    expect(g.model.captureConfirmedEntry(sameUnknown)).toBeNull();
  });
  it("captures an exact saved baseline beside an initially blank owned editor without restoring it", async () => {
    const source = new ManagedValuationWorkbench();
    source.activate(eodSelection);
    fillValidInputs(source);
    const f = await loaded({
      version: 3,
      payload: { schemaVersion: 1, entries: [source.captureInputs()!.entry] },
    });
    const editor = f.workbench.getSnapshot();
    const model = new ManagedValuationReassessment(f.workbench, f.model, {
      now: () => captureTime,
    });
    const state = model.capture(
      f.model.coordinator.getSnapshot().saved!.payload.entries[0]!,
    )!;
    expect(state.active).toBe(true);
    expect(f.workbench.getSnapshot()).toBe(editor);
    expect(editor.dcfDraft.startingUnleveredCashFlowUsd).toBe("");
    f.workbench.setDcfField("startingUnleveredCashFlowUsd", "1");
    expect(model.getSnapshot().baseline).toBe(state.baseline);
  });

  it("pure evaluation leaves mutable caller inputs unchanged and unregistered", async () => {
    const f = await reassessmentFixture();
    const input = structuredClone(f.workbench.getSnapshot());
    const before = structuredClone(input);
    const result = evaluateValuationInputs(
      input.owner!,
      input.dcfDraft,
      input.exitDraft,
    );
    expect(input).toEqual(before);
    expect(Object.isFrozen(input.dcfDraft)).toBe(false);
    expect(Object.isFrozen(input.dcfDraft.scenarios)).toBe(false);
    expect(Object.isFrozen(result.dcfDraft.scenarios)).toBe(true);
    expect(captureValuationCalculationGuard(result)).toBeNull();
  });

  it("captures complete raw confirmed inputs without editing, calculating, publishing resource state or reading sources", async () => {
    const f = await reassessmentFixture(false);
    const editor = f.workbench.getSnapshot(),
      resource = f.model.coordinator.getSnapshot(),
      review = f.model.getSnapshot();
    const calculate = vi.spyOn(f.workbench, "calculate"),
      notify = vi.fn();
    f.model.subscribe(notify);
    const state = f.capture();
    expect(state.baseline!.capture.entry.dcf.inputs.waccPercent).toBe(
      " raw 1.. 😀 ",
    );
    expect(state.baseline!.capture.saved.version).toBe(7);
    expect(state.baseline!.capturedAt).toBe(captureTime);
    expect(Object.isFrozen(state.baseline!.capture.entry.dcf.inputs)).toBe(
      true,
    );
    expect(Object.isFrozen(state.baseline!.capture.catalog.sources)).toBe(true);
    expect(Object.isFrozen(state.baseline!.capture.saved.payload.entries)).toBe(
      true,
    );
    expect(f.workbench.getSnapshot()).toBe(editor);
    expect(f.model.coordinator.getSnapshot()).toBe(resource);
    expect(f.model.getSnapshot()).toBe(review);
    expect(notify).not.toHaveBeenCalled();
    expect(calculate).not.toHaveBeenCalled();
    expect(f.api.resolve).not.toHaveBeenCalled();
    expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
  });
  it("refuses staged copies, foreign share classes, stale resource state and forged confirmed tokens", async () => {
    const f = await reassessmentFixture();
    expect(
      f.model.captureConfirmedEntry(structuredClone(f.savedEntry)),
    ).toBeNull();
    const stale = f.model.coordinator.getSnapshot();
    f.model.coordinator.replaceDraft(stale.draft!);
    expect(f.model.captureConfirmedEntry(f.savedEntry, stale)).toBeNull();
    const token = f.model.captureConfirmedEntry(f.savedEntry)!;
    expect(f.model.isConfirmedEntryCaptureCurrent({ ...token })).toBe(false);
    f.workbench.activate({
      ...eodSelection,
      listing: { ...eodSelection.listing, shareClassId: "other-class" },
    });
    expect(f.capture()).toBeNull();
  });
  it("evaluates complete saved and revised maps once and grants action authority only to revised result", async () => {
    const f = await reassessmentFixture();
    const baseline = f.capture().baseline;
    f.workbench.setDcfField("waccPercent", "invalid");
    const calculate = vi.spyOn(f.workbench, "calculate");
    const result = f.calculate()!;
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(result.baseline).toBe(baseline);
    expect(result.reading!.evaluatedAt).toBe(evaluationTime);
    expect(result.reading!.savedCalculation.dcfResult.status).toBe("available");
    expect(result.reading!.revisedCalculation.dcfResult.status).toBe(
      "unavailable",
    );
    expect(result.reading!.revisedCalculation.exitResult.status).toBe(
      "available",
    );
    expect(result.reading!.revisedCalculation.dcfDraft.waccPercent).toBe(
      "invalid",
    );
    expect(
      captureValuationCalculationGuard(result.reading!.savedCalculation),
    ).toBeNull();
    expect(
      captureValuationCalculationGuard(result.reading!.revisedCalculation)?.(),
    ).toBe(true);
    const passive = evaluateValuationInputs(
      eodSelection,
      result.reading!.savedCalculation.dcfDraft,
      result.reading!.savedCalculation.exitDraft,
    );
    expect(passive).toEqual(result.reading!.savedCalculation);
    expect(captureValuationCalculationGuard(passive)).toBeNull();
  });
  it("keeps invalid saved assumptions complete beside valid revised results", async () => {
    const f = await reassessmentFixture(false);
    f.capture();
    const reading = f.calculate()!.reading!;
    expect(reading.savedCalculation.dcfDraft.waccPercent).toBe(" raw 1.. 😀 ");
    expect(reading.savedCalculation.dcfResult.status).toBe("unavailable");
    expect(reading.revisedCalculation.dcfResult.status).toBe("available");
    expect(reading.revisedCalculation.exitResult.status).toBe("available");
  });
  it("keeps baseline but retires paired results after edit and same-value ABA, including rejected oversized text", async () => {
    const f = await reassessmentFixture();
    const initial = f.capture();
    f.calculate();
    f.workbench.setExitField("cash", "1");
    f.workbench.setExitField("cash", "0");
    expect(f.reassessment.getSnapshot().baseline).toBe(initial.baseline);
    expect(f.reassessment.getSnapshot().reading).toBeNull();
    f.workbench.setExitField("cash", "0".repeat(513));
    expect(f.calculate()).toBeNull();
    expect(f.reassessment.getSnapshot().baseline).toBe(initial.baseline);
  });
  it.each(["editor", "collection"])(
    "latches %s file activity even after cancellation",
    async (kind) => {
      const f = await reassessmentFixture();
      const initial = f.capture(),
        token = initial.baseline!.capture;
      const activity = {};
      if (kind === "editor") {
        f.workbench.beginDraftFileActivity(activity);
        f.workbench.endDraftFileActivity(activity);
      } else {
        f.model.beginCollectionFileActivity(activity);
        f.model.endCollectionFileActivity(activity);
      }
      expect(f.reassessment.getSnapshot().baseline).toBeNull();
      expect(f.model.isConfirmedEntryCaptureCurrent(token)).toBe(false);
      expect(
        f.reassessment.calculate(initial, f.workbench.getSnapshot()),
      ).toBeNull();
    },
  );
  it("retires on Load start and does not revive after same version/content returns", async () => {
    const f = await reassessmentFixture();
    const initial = f.capture();
    const pending = deferred<ManagedValuationAssumptionsDto>();
    vi.mocked(f.api.loadValuationAssumptions).mockImplementationOnce(
      () => pending.promise,
    );
    const load = f.model.coordinator.load();
    expect(f.reassessment.getSnapshot().baseline).toBeNull();
    pending.resolve(f.saved());
    await load;
    expect(
      f.model.isConfirmedEntryCaptureCurrent(initial.baseline!.capture),
    ).toBe(false);
    expect(f.reassessment.getSnapshot().baseline).toBeNull();
  });
  it("latches catalog replacement and return", async () => {
    const f = await reassessmentFixture();
    const initial = f.capture();
    f.setCatalog({ ...snapshot, snapshotSha256: `sha256:${"b".repeat(64)}` });
    f.model.syncCatalog();
    f.setCatalog(snapshot);
    f.model.syncCatalog();
    expect(f.reassessment.getSnapshot().baseline).toBeNull();
    expect(
      f.model.isConfirmedEntryCaptureCurrent(initial.baseline!.capture),
    ).toBe(false);
  });
  it("preserves baseline through ordinary Stage/Review but retires on Save beginning", async () => {
    const f = await reassessmentFixture();
    const initial = f.capture();
    f.workbench.setExitField("cash", "1");
    await stage(f);
    expect(f.reassessment.getSnapshot().baseline).toBe(initial.baseline);
    const save = f.model.coordinator.save();
    expect(f.reassessment.getSnapshot().baseline).toBeNull();
    await save;
  });
  it("retains exact passive reading only across explicit owned Back and same-owner return", async () => {
    const f = await reassessmentFixture();
    f.capture();
    const result = f.calculate()!;
    const calculate = vi.spyOn(f.workbench, "calculate");
    f.reassessment.pauseForOwnedBack();
    f.workbench.activate(null);
    expect(f.reassessment.getSnapshot().reading).toBe(result.reading);
    expect(f.reassessment.getSnapshot().active).toBe(false);
    expect(f.reassessment.canResumeOwned(eodSelection)).toBe(true);
    f.workbench.activate(eodSelection);
    expect(f.reassessment.resumeOwned()).not.toBeNull();
    expect(f.reassessment.getSnapshot().reading).toBe(result.reading);
    expect(calculate).not.toHaveBeenCalled();
    expect(f.api.resolve).not.toHaveBeenCalled();
    f.workbench.activate(null);
    f.workbench.activate(eodSelection);
    expect(f.reassessment.getSnapshot().baseline).toBeNull();
  });
  it("retires a dirty retained owner when a foreign context becomes active", async () => {
    const f = await reassessmentFixture();
    f.capture();
    f.reassessment.pauseForOwnedBack();
    f.workbench.activate(null);
    const other = {
      ...eodSelection,
      listing: { ...eodSelection.listing, shareClassId: "other-class" },
    };
    expect(f.reassessment.canResumeOwned(other)).toBe(false);
    f.workbench.activate(other);
    f.workbench.activate(eodSelection);
    expect(f.reassessment.getSnapshot().baseline).toBeNull();
  });
  it("availability ABA preserves evidence but rejects old action snapshots", async () => {
    const f = await reassessmentFixture();
    const initial = f.capture();
    f.available(false);
    expect(f.calculate()).toBeNull();
    f.available(true);
    expect(f.reassessment.getSnapshot().baseline).toBe(initial.baseline);
    expect(
      f.reassessment.calculate(initial, f.workbench.getSnapshot()),
    ).toBeNull();
    expect(f.calculate()).not.toBeNull();
  });
  it("refuses reentrant capture publication and preserves independent state", async () => {
    const f = await reassessmentFixture();
    const editor = f.workbench.getSnapshot();
    f.reassessment.subscribe(() => {
      if (f.reassessment.getSnapshot().baseline)
        f.workbench.beginDraftFileActivity({});
    });
    expect(f.capture()).toBeNull();
    expect(f.workbench.getSnapshot()).toBe(editor);
    expect(f.reassessment.getSnapshot().baseline).toBeNull();
  });
  it("refuses calculation if an editor listener changes and restores raw values", async () => {
    const f = await reassessmentFixture();
    f.capture();
    f.workbench.subscribe(() => {
      if (f.workbench.getSnapshot().calculation) {
        f.workbench.setExitField("cash", "1");
        f.workbench.setExitField("cash", "0");
      }
    });
    expect(f.calculate()).toBeNull();
    expect(f.reassessment.getSnapshot().reading).toBeNull();
  });
  it("returns null after reading publication is replaced reentrantly", async () => {
    const f = await reassessmentFixture();
    f.capture();
    f.reassessment.subscribe(() => {
      const state = f.reassessment.getSnapshot();
      if (state.reading) f.reassessment.cancel(state);
    });
    expect(f.calculate()).toBeNull();
    expect(f.reassessment.getSnapshot().baseline).toBeNull();
  });
  it("cancel changes only this owner and discard/restore/session retire it", async () => {
    const f = await reassessmentFixture();
    f.capture();
    f.calculate();
    const editor = f.workbench.getSnapshot(),
      resource = f.model.coordinator.getSnapshot();
    expect(f.reassessment.cancel(f.reassessment.getSnapshot())).toBe(
      f.reassessment.getSnapshot(),
    );
    expect(f.workbench.getSnapshot()).toBe(editor);
    expect(f.model.coordinator.getSnapshot()).toBe(resource);
    f.capture();
    f.workbench.discardAndUse(eodSelection);
    expect(f.reassessment.getSnapshot().baseline).toBeNull();
    f.capture();
    f.workbench.restoreInputs(f.savedEntry, f.workbench.getSnapshot());
    expect(f.reassessment.getSnapshot().baseline).toBeNull();
    f.capture();
    f.model.retire();
    expect(f.reassessment.getSnapshot().baseline).toBeNull();
  });
});
