import { afterEach, expect, it, vi } from "vitest";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  reassessmentReason,
  reassessmentUnsaved,
  reassessmentExpectedFollowups,
  reassessmentExpectedValuations,
} from "./saved-valuation-reassessment-fixture-data";
import { createFixture } from "./fixture";
afterEach(() => vi.useRealTimers());
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T12:00:00.000Z"));
  const f = await createFixture("saved-valuation-reassessment");
  const meta = f.savedValuationReassessment!;
  const w = new ManagedWorkspace(f.api, f.session, undefined, {
    researchCoverage: f.researchCoverage,
    priceCoverage: f.priceCoverage,
    marketsCohort: f.marketsCohort,
  });
  w.setView("watchlist");
  await w.refreshCatalog();
  await w.coordinator.load();
  w.openWatchlistAnnual(w.coordinator.getSnapshot().draft!.memberships[0]!);
  await w.valuationAssumptions.coordinator.load();
  return { f, meta, w };
}
it("captures the exact confirmed class without effects, retains the partial source pass and evaluates both complete authored maps", async () => {
  const { f, w, meta } = await setup();
  let fresh: ManagedWorkspace | undefined;
  try {
    const saved = w.valuationAssumptions.coordinator.getSnapshot();
    const [a, c] = saved.saved!.payload.entries;
    expect(w.valuationReassessment.capture(c!, saved)).toBeNull();
    w.valuationAssumptions.reviewSavedInputs(a!);
    expect(w.valuationAssumptions.useSavedInputs()).toBe(true);
    const editor = w.valuation.getSnapshot();
    const baseline = w.valuationReassessment.capture(a!, saved)!;
    expect(baseline.baseline!.capture.entry).toEqual(a);
    expect(w.valuation.getSnapshot()).toBe(editor);
    expect(meta.getSnapshot()).toMatchObject({
      eod: 0,
      annual: 0,
      filings: 0,
      save: 0,
      valuationSave: 0,
    });

    const visit = w.getSnapshot().research!;
    const plan = w.prepareCompanySourcePass(visit, [
      "eod",
      "annual",
      "filings",
    ]);
    expect(plan).not.toBeNull();
    await w.runCompanySourcePass(visit, plan!);
    expect(meta.getSnapshot()).toMatchObject({
      requests: ["eod", "annual", "filings"],
      active: 0,
      maxActive: 1,
      rejected: 0,
    });
    expect(w.eod.getSnapshot().response).not.toBeNull();
    expect(w.annual.getSnapshot().response).toEqual(meta.annual);
    expect(w.filings.getSnapshot().response).toBeNull();
    w.valuation.setDcfField("startingUnleveredCashFlowUsd", "110.00");
    w.valuation.setExitField("baseRevenue", "1000");
    w.valuation.setExitField("cash", "200.00");
    const result = w.valuationReassessment.calculate(
      w.valuationReassessment.getSnapshot(),
      w.valuation.getSnapshot(),
    )!;
    expect(result.reading!.savedCalculation).toMatchObject({
      dcfResult: { scenarios: { base: { valuePerShareUsd: "140.00" } } },
      exitResult: { scenarios: { base: { valuePerShare: "15.00" } } },
    });
    expect(result.reading!.revisedCalculation).toMatchObject({
      dcfResult: { scenarios: { base: { valuePerShareUsd: "155.00" } } },
      exitResult: { scenarios: { base: { valuePerShare: "20.00" } } },
    });
    expect(w.valuation.getSnapshot().calculation).toBe(
      result.reading!.revisedCalculation,
    );
    const counts = meta.getSnapshot();
    w.returnFromResearch();
    w.openWatchlistAnnual(w.coordinator.getSnapshot().draft!.memberships[0]!);
    expect(w.valuationReassessment.getSnapshot().reading).toBe(result.reading);
    expect(meta.getSnapshot()).toBe(counts);
    expect(meta.saved().valuations.payload.entries).toEqual(meta.data.entries);
    await w.followups.coordinator.load();
    const expectedFollowups = reassessmentExpectedFollowups(
      meta.data,
      "71000000-0000-4000-8000-000000000002",
    );
    w.followups.coordinator.replaceDraft(expectedFollowups);
    await w.valuationAssumptions.prepareStage();
    expect(w.valuationAssumptions.stageCurrent()).toBe(true);
    await w.valuationAssumptions.coordinator.save();
    expect(meta.getSnapshot()).toMatchObject({ valuationSave: 1, save: 0 });
    expect(f.followups!.getSnapshot().save).toBe(0);
    expect(w.valuationReassessment.getSnapshot().baseline).toBeNull();
    w.returnFromResearch();
    const watchlist = w.coordinator.getSnapshot().draft!;
    w.coordinator.replaceDraft({
      ...watchlist,
      memberships: watchlist.memberships.map((m, i) =>
        i === 0 ? { ...m, note: reassessmentReason } : m,
      ),
    });
    await w.coordinator.save();
    expect(meta.getSnapshot()).toMatchObject({ valuationSave: 1, save: 1 });
    w.coordinator.replaceDraft({
      ...w.coordinator.getSnapshot().draft!,
      memberships: w.coordinator
        .getSnapshot()
        .draft!.memberships.map((m, i) =>
          i === 1 ? { ...m, note: reassessmentUnsaved } : m,
        ),
    });
    expect(w.coordinator.getSnapshot().dirty).toBe(true);
    await w.followups.coordinator.save();
    expect(f.followups!.getSnapshot()).toMatchObject({ save: 1, commits: 1 });
    w.sessionOwner.dispose();
    fresh = new ManagedWorkspace(f.api, f.followups!.nextSession(), undefined, {
      researchCoverage: f.researchCoverage,
      priceCoverage: f.priceCoverage,
      marketsCohort: f.marketsCohort,
    });
    fresh.setView("watchlist");
    await fresh.refreshCatalog();
    expect(fresh.coordinator.getSnapshot().draft).toBeNull();
    expect(fresh.valuationReassessment.getSnapshot().reading).toBeNull();
    await fresh.coordinator.load();
    await fresh.followups.coordinator.load();
    await fresh.valuationAssumptions.coordinator.load();
    expect(fresh.followups.coordinator.getSnapshot().draft).toEqual(
      expectedFollowups,
    );
    expect(
      fresh.coordinator.getSnapshot().draft!.memberships.map((m) => m.note),
    ).toEqual([reassessmentReason, meta.data.watchlist.memberships[1]!.note]);
    expect(
      fresh.valuationAssumptions.coordinator.getSnapshot().draft!.entries,
    ).toEqual(reassessmentExpectedValuations(meta.data));
    expect(fresh.valuation.getSnapshot().calculation).toBeNull();
    expect(fresh.eod.getSnapshot().response).toBeNull();
    expect(meta.getSnapshot()).toMatchObject({
      status: 2,
      load: 2,
      valuationLoad: 2,
      save: 1,
      valuationSave: 1,
      eod: 1,
      annual: 1,
      filings: 1,
      rejected: 0,
    });
  } finally {
    w.sessionOwner.dispose();
    fresh?.sessionOwner.dispose();
  }
});
it("rejects a source read for the other share class without changing any stored resource", async () => {
  const { f, w, meta } = await setup();
  try {
    const before = meta.saved();
    await expect(
      f.api.eodHistory(
        {
          listingId: meta.data.identities[1]!.listingId,
          catalogSnapshotSha256: meta.data.entries[0]!.catalogSnapshotSha256,
          range: "1m",
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow("Unexpected invented");
    expect(meta.saved()).toEqual(before);
    expect(meta.getSnapshot()).toMatchObject({
      eod: 0,
      annual: 0,
      filings: 0,
      save: 0,
      valuationSave: 0,
      rejected: 1,
    });
  } finally {
    w.sessionOwner.dispose();
  }
});
