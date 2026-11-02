import { readFileSync } from "node:fs";
import { sameJsonValue } from "./research-draft-set-native-comparison";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { ManagedScreenResearchReading } from "../../src/clerk-trial/ManagedScreenResearchReading";
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
it("binds the native captured-value comparison to the tested complete JSON comparator", () => {
  const helper = (name: string) => {
    const source = readFileSync(
      new URL(
        `../../android/app/src/androidTest/java/local/investment/personal/${name}.java`,
        import.meta.url,
      ),
      "utf8",
    );
    const literal =
      /private static final String SAME_JSON = ("(?:\\.|[^"\\])*");/.exec(
        source,
      )?.[1];
    expect(literal).toBeDefined();
    return JSON.parse(literal!) as string;
  };
  expect(helper("ManagedTwoCompanyResearchReviewTest")).toBe(
    helper("ManagedResearchDraftSetRecoveryTest"),
  );
});
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
      const $ = load(
        renderToStaticMarkup(
          createElement(ManagedScreenResearchReading, { capture }),
        ),
      );
      const valuationSection = $('[aria-label="Captured valuation"]');
      const models = valuationSection.find(
        '[aria-label="Authored valuation results"]',
      );
      expect(valuationSection.find("table")).toHaveLength(8);
      expect(models.find("table")).toHaveLength(7);
      expect(
        models
          .find("table")
          .map((_index, table) => $(table).find("tbody tr").length)
          .get(),
      ).toEqual([3, 5, 5, 5, 25, 3, 25]);
      const price = valuationSection.find(
        '[aria-label="Dated valuation price comparison"]',
      );
      expect(price.find("table")).toHaveLength(1);
      expect(capture.valuationPrice?.reference).toBeNull();
      expect(capture.valuationPrice?.reason).toBe("price_not_loaded");
      expect(capture.valuationPrice?.rows).toHaveLength(6);
      expect(capture.valuationPrice?.selection).toEqual(capture.selection);
      expect(capture.valuationPrice?.calculation).toEqual(capture.valuation);
      const capturedPrice = capture.valuationPrice!;
      expect(sameJsonValue(capturedPrice.selection, capture.selection)).toBe(
        true,
      );
      expect(sameJsonValue(capturedPrice.calculation, capture.valuation)).toBe(
        true,
      );
      const changedIdentity = structuredClone(capture.selection);
      Object.assign(changedIdentity.listing, { listingId: "another-listing" });
      expect(sameJsonValue(capturedPrice.selection, changedIdentity)).toBe(
        false,
      );
      const changedRaw = structuredClone(capture.valuation!);
      Object.assign(changedRaw.exitDraft, { baseRevenue: "999.0" });
      expect(sameJsonValue(capturedPrice.calculation, changedRaw)).toBe(false);
      const reordered = structuredClone(capture.valuation!);
      if (reordered.dcfResult.status !== "available")
        throw new Error("Expected the complete fixture DCF calculation");
      Object.assign(reordered.dcfResult.scenarios.base, {
        projection: [
          ...reordered.dcfResult.scenarios.base.projection,
        ].reverse(),
      });
      expect(sameJsonValue(capturedPrice.calculation, reordered)).toBe(false);
      expect(
        capture.valuationPrice!.rows.map(
          (row) => `${row.model}|${row.scenario}`,
        ),
      ).toEqual([
        "dcf|conservative",
        "dcf|base",
        "dcf|expansion",
        "exit|conservative",
        "exit|base",
        "exit|expansion",
      ]);
      const labels = {
        conservative: "Conservative",
        base: "Base",
        expansion: "Expansion",
      };
      const priceRows = price
        .find("tbody tr")
        .toArray()
        .map((row) =>
          $(row)
            .children()
            .map((_index, cell) => $(cell).text())
            .get(),
        );
      expect(priceRows).toEqual(
        capture.valuationPrice!.rows.map((row) => [
          row.model === "dcf" ? "Cash flow DCF" : "Exit multiple",
          labels[row.scenario],
          row.modelValuePerShareUsd,
          "Unavailable. Load raw closing prices explicitly in the Price section to compare this scenario.",
        ]),
      );
      expect(
        capture.valuationPrice!.rows.every(
          (row) =>
            row.result.status === "unavailable" &&
            row.result.reason === "price_not_loaded",
        ),
      ).toBe(true);
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
    expect(
      JSON.stringify(
        fresh.valuationAssumptions.coordinator.getSnapshot().saved!.payload
          .entries,
      ),
    ).toBe(JSON.stringify(decisionExpectedValuations(meta.data, 2)));
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

it("measures the full pacing interval at dispatch despite delayed promise work", async () => {
  const fixture = await createFixture("two-company-research-review");
  const meta = fixture.twoCompanyResearchReview!;
  const signal = new AbortController().signal;
  await fixture.api.load(signal);
  let now = 100;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  const request = (index: number) => {
    const packet = meta.packets[index]!;
    return {
      schemaVersion: "6.0.0" as const,
      catalogSnapshotSha256: packet.catalogSnapshotSha256,
      listingId: packet.security.listingId,
      symbol: packet.security.symbol,
    };
  };
  try {
    const first = fixture.api.annualReport(request(0), signal);
    now = 175;
    await first;
    now = 20_099;
    const early = fixture.api.annualReport(request(1), signal);
    now = 20_100;
    await expect(early).rejects.toThrow("exact paced Annual read");
    expect(meta.getSnapshot().annual).toBe(1);
    const second = fixture.api.annualReport(request(1), signal);
    now = 20_101;
    await expect(second).resolves.toEqual(meta.packets[1]);
    expect(meta.getSnapshot()).toMatchObject({
      annual: 2,
      rejected: 1,
      requests: ["listing-zero", "listing-one"],
    });
  } finally {
    clock.mockRestore();
  }
});
