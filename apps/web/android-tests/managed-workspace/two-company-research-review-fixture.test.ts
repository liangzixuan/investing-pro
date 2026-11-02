import { afterEach, expect, it, vi } from "vitest";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { createFixture } from "./fixture";
import {
  decisionQuestion,
  decisionDue,
  decisionThesis,
  decisionUnsaved,
  decisionExpectedWatchlist,
  decisionExpectedValuations,
  decisionExpectedFollowups,
} from "./two-company-research-review-fixture-data";
afterEach(() => vi.useRealTimers());
it("screens two periods, retains both complete calculations, saves independently and fresh-loads exact payloads", async () => {
  const f = await createFixture("two-company-research-review"),
    meta = f.twoCompanyResearchReview!;
  const options = {
    researchCoverage: f.researchCoverage,
    priceCoverage: f.priceCoverage,
    marketsCohort: f.marketsCohort,
    financialScreenListingIds: f.screenComparison!.listingIds,
  };
  const w = new ManagedWorkspace(f.api, f.session, undefined, options);
  let fresh: ManagedWorkspace | undefined;
  try {
    w.setView("discover");
    await w.refreshCatalog();
    await w.coordinator.load();
    await w.followups.coordinator.load();
    w.setView("watchlist");
    w.openWatchlistAnnual(w.coordinator.getSnapshot().draft!.memberships[0]!);
    await w.valuationAssumptions.coordinator.load();
    w.returnFromResearch();
    w.setView("discover");
    const screen = w.financialScreen;
    await screen.loadUniverse(screen.getSnapshot());
    vi.useFakeTimers({
      toFake: ["Date", "performance", "setTimeout", "clearTimeout"],
    });
    vi.setSystemTime(new Date("2026-11-01T12:00:00.000Z"));
    const running = screen.run(screen.getSnapshot());
    await vi.advanceTimersByTimeAsync(20000);
    await running;
    vi.useRealTimers();
    const run = screen.getSnapshot().run!,
      [left, right] = run.rows;
    expect(run.status).toBe("completed");
    screen.selectComparison(screen.getSnapshot(), "left", left!);
    screen.selectComparison(screen.getSnapshot(), "right", right!);
    const calculate = vi.spyOn(w.valuation, "calculate");
    for (const [i, row] of [left!, right!].entries()) {
      w.openFinancialScreenReport({
        run,
        row,
        response: row.report!.response!,
      });
      await vi.waitFor(() =>
        expect(w.annual.getSnapshot().checkingSeed).toBe(false),
      );
      if (i) {
        expect(w.valuation.getSnapshot().editable).toBe(false);
        expect(
          w.valuationAssumptions.coordinator.getSnapshot().saved!.payload
            .entries[0],
        ).toEqual(meta.data.revised[0]);
        w.valuation.discardAndUse(w.getSnapshot().research!.selection);
      }
      w.valuationAssumptions.reviewSavedInputs(
        w.valuationAssumptions.coordinator.getSnapshot().saved!.payload.entries[
          i
        ]!,
      );
      expect(w.valuationAssumptions.useSavedInputs()).toBe(true);
      w.valuation.setExitField(
        "baseRevenue",
        meta.data.revised[i]!.exit.inputs.baseRevenue,
      );
      const result = w.valuation.calculate()!;
      const counts = meta.getSnapshot(),
        state = w.screenResearchReview.getSnapshot();
      const capture =
        w.captureScreenResearchReading(state)!.reading![i ? "right" : "left"]!;
      expect(meta.getSnapshot()).toBe(counts);
      expect(capture.valuation).toEqual(result);
      expect(capture.valuation).not.toBe(result);
      expect(capture.evidence.annual!.response).toEqual(meta.packets[i]);
      expect(capture.evidence.price?.response ?? null).toBeNull();
      expect(JSON.parse(capture.document.text)).toHaveProperty(
        "sources.annual.response",
        meta.packets[i],
      );
      expect(w.captureScreenResearchReading(state)).toBeNull();
      await w.valuationAssumptions.prepareStage();
      expect(w.valuationAssumptions.stageCurrent()).toBe(true);
      await w.valuationAssumptions.coordinator.save();
      w.returnFromResearch();
      expect(
        w.screenResearchReview.getSnapshot().reading![i ? "right" : "left"],
      ).toBe(capture);
    }
    const pair = w.screenResearchReview.getSnapshot().reading!;
    expect(pair.left!.evidence.annual!.response!.evidence.target).toMatchObject(
      { reportDate: "2025-12-31" },
    );
    expect(
      pair.right!.evidence.annual!.response!.evidence.target,
    ).toMatchObject({ reportDate: "2025-06-30" });
    const reads = meta.getSnapshot();
    w.openScreenResearchSide(w.screenResearchReview.getSnapshot(), "right");
    await vi.waitFor(() =>
      expect(w.annual.getSnapshot().checkingSeed).toBe(false),
    );
    expect(meta.getSnapshot()).toBe(reads);
    expect(calculate).toHaveBeenCalledTimes(2);
    const selection = w.getSnapshot().research!.selection;
    w.noteResearch(selection, decisionThesis);
    const host = w.researchThesisFollowupContext(selection)!,
      preview = w.followups.prepareNextCheck(
        host.member,
        decisionQuestion,
        decisionDue,
      );
    const created = w.followups.createNextCheck(
      preview.capture!,
      host.isCurrent,
    )!;
    expect(w.screenResearchReview.getSnapshot().reading).toBe(pair);
    w.returnFromResearch();
    await w.coordinator.save();
    w.note("listing-zero", decisionUnsaved);
    await w.followups.coordinator.save();
    expect(w.coordinator.getSnapshot().dirty).toBe(true);
    expect(meta.saved().valuations.payload.entries[2]).toEqual(
      meta.data.entries[2],
    );
    w.sessionOwner.dispose();
    fresh = new ManagedWorkspace(
      f.api,
      f.followups!.nextSession(),
      undefined,
      options,
    );
    await fresh.refreshCatalog();
    expect(fresh.coordinator.getSnapshot().draft).toBeNull();
    await fresh.coordinator.load();
    await fresh.valuationAssumptions.coordinator.load();
    await fresh.followups.coordinator.load();
    expect(fresh.coordinator.getSnapshot().draft).toEqual(
      decisionExpectedWatchlist(meta.data),
    );
    expect(
      fresh.valuationAssumptions.coordinator.getSnapshot().draft!.entries,
    ).toEqual(decisionExpectedValuations(meta.data, 2));
    expect(fresh.followups.coordinator.getSnapshot().draft).toEqual(
      decisionExpectedFollowups(meta.data, created.id),
    );
    expect(fresh.screenResearchReview.getSnapshot().reading).toBeNull();
    expect(fresh.valuation.getSnapshot().calculation).toBeNull();
    expect(meta.getSnapshot()).toMatchObject({
      status: 2,
      load: 2,
      valuationLoad: 2,
      valuationSave: 2,
      save: 1,
      annual: 2,
      eod: 0,
      filings: 0,
      rejected: 0,
      unexpected: {},
    });
  } finally {
    w.sessionOwner.dispose();
    fresh?.sessionOwner.dispose();
  }
});
it("refuses a passive-price request and a nonmatching save before changing any resource", async () => {
  const f = await createFixture("two-company-research-review"),
    meta = f.twoCompanyResearchReview!,
    before = meta.saved();
  await expect(
    f.api.eodHistory(
      {
        listingId: "listing-one",
        catalogSnapshotSha256: meta.data.watchlist.snapshotSha256,
        range: "1m",
      },
      new AbortController().signal,
    ),
  ).rejects.toThrow("Unexpected invented");
  await expect(
    f.api.save({} as never, new AbortController().signal),
  ).rejects.toThrow("Unexpected invented");
  expect(meta.saved()).toEqual(before);
  expect(meta.getSnapshot().rejected).toBe(2);
});
