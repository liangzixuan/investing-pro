import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { ManagedScreenResearchReading } from "../../src/clerk-trial/ManagedScreenResearchReading";
import { WatchlistResearchReportSnapshot } from "../../src/clerk-trial/WatchlistResearchReportSnapshot";
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

it("uses a direct Watchlist pair with one Annual and an uncovered reading, then independently saves and fresh-loads whole resources", async () => {
  const f = await createFixture("watchlist-research-pair"),
    meta = f.watchlistResearchPair!;
  const options = {
    researchCoverage: f.researchCoverage,
    priceCoverage: f.priceCoverage,
    marketsCohort: f.marketsCohort,
  };
  const w = new ManagedWorkspace(f.api, f.session, undefined, options);
  let fresh: ManagedWorkspace | undefined;
  try {
    await w.refreshCatalog();
    w.setView("watchlist");
    await w.coordinator.load();
    await w.followups.coordinator.load();
    await w.valuationAssumptions.coordinator.load();
    const pair = w.watchlistResearchPair,
      initial = meta.getSnapshot();
    const members = pair.getSnapshot().memberships;
    expect(members).toHaveLength(2);
    pair.select(pair.getSnapshot(), members[0]!);
    pair.select(pair.getSnapshot(), members[1]!);
    expect(pair.preview(pair.getSnapshot())).not.toBeNull();
    expect(pair.start(pair.getSnapshot())).not.toBeNull();
    expect(meta.getSnapshot()).toBe(initial);
    expect(w.financialScreen.getSnapshot().run).toBeNull();
    const untouchedPortfolio = w.portfolio.coordinator.getSnapshot();
    for (const [i, side] of (["left", "right"] as const).entries()) {
      const beforeOpen = meta.getSnapshot();
      w.openWatchlistResearchSide(pair.getSnapshot(), side);
      const visit = w.getSnapshot().research!;
      expect(visit.selection.origin).toBe("watchlist");
      expect(meta.getSnapshot()).toBe(beforeOpen);
      if (!i) {
        await w.requestResearchSource(visit, "annual");
        expect(w.annual.getSnapshot().response).toEqual(meta.packets[0]);
      } else {
        await w.setCompanyRoute({
          kind: "company",
          listingId: visit.selection.listing.listingId,
          section: "eod",
        });
        expect(w.eod.getSnapshot().available).toBe(false);
        expect(meta.getSnapshot()).toBe(beforeOpen);
        expect(w.valuation.getSnapshot().editable).toBe(false);
        w.valuation.discardAndUse(visit.selection);
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
      const calculation = w.valuation.calculate();
      expect(calculation).not.toBeNull();
      const counts = meta.getSnapshot(),
        state = pair.getSnapshot();
      const captured =
        w.captureWatchlistResearchReading(state)!.reading![side]!;
      expect(meta.getSnapshot()).toBe(counts);
      expect(captured.valuation).toEqual(calculation);
      expect(captured.valuation).not.toBe(calculation);
      expect(captured.evidence.annual?.response ?? null).toEqual(
        i ? null : meta.packets[0],
      );
      expect(captured.evidence.price?.response ?? null).toBeNull();
      expect(captured.document.byteLength).toBe(
        new TextEncoder().encode(captured.document.text).byteLength,
      );
      expect(w.captureWatchlistResearchReading(state)).toBeNull();
      await w.valuationAssumptions.prepareStage();
      expect(w.valuationAssumptions.stageCurrent()).toBe(true);
      expect(
        w.valuationAssumptions.coordinator.getSnapshot().draft!.entries,
      ).toEqual(decisionExpectedValuations(meta.data, i + 1));
      await w.valuationAssumptions.coordinator.save();
      expect(w.valuationAssumptions.coordinator.getSnapshot().phase).toBe(
        "idle",
      );
      expect(meta.getSnapshot()).toMatchObject({
        rejected: 0,
        valuationSave: i + 1,
      });
      w.returnFromResearch();
      expect(pair.getSnapshot().reading![side]).toBe(captured);
    }
    const reading = pair.getSnapshot().reading!;
    expect(reading.right!.evidence.annual?.response ?? null).toBeNull();
    expect(reading.right!.evidence.price?.available).toBe(false);
    for (const [side, expectedReason, expectedText] of [
      [
        "left",
        "price_not_loaded",
        "Load raw closing prices explicitly in the Price section to compare this scenario.",
      ],
      [
        "right",
        "price_invalid",
        "The loaded history does not provide an admitted latest raw USD close for this comparison.",
      ],
    ] as const) {
      const capture = reading[side]!,
        price = capture.valuationPrice!,
        $ = load(
          renderToStaticMarkup(
            createElement(ManagedScreenResearchReading, { capture }),
          ),
        ),
        context = $('[aria-label="Dated valuation price comparison"]'),
        labels = {
          conservative: "Conservative",
          base: "Base",
          expansion: "Expansion",
        };
      expect(price.reason).toBe(expectedReason);
      expect(price.reference).toBeNull();
      expect(price.selection).toEqual(capture.selection);
      expect(price.calculation).toEqual(capture.valuation);
      const dcf = capture.valuation!.dcfResult,
        exit = capture.valuation!.exitResult;
      if (dcf.status !== "available" || exit.status !== "available")
        throw new Error("Both authored fixture models must be available.");
      expect(price.rows.map((row) => `${row.model}|${row.scenario}`)).toEqual([
        "dcf|conservative",
        "dcf|base",
        "dcf|expansion",
        "exit|conservative",
        "exit|base",
        "exit|expansion",
      ]);
      for (const row of price.rows) {
        const dcfScenario = dcf.scenarios[row.scenario];
        if (dcfScenario.status !== "available")
          throw new Error("Every fixture DCF scenario must be available.");
        expect(row.result).toMatchObject({
          status: "unavailable",
          reason: expectedReason,
        });
        expect(row.modelValuePerShareUsd).toBe(
          row.model === "dcf"
            ? dcfScenario.valuePerShareUsd
            : exit.scenarios[row.scenario].valuePerShare,
        );
      }
      expect(context.find("table")).toHaveLength(1);
      expect(
        context
          .find("tbody tr")
          .toArray()
          .map((row) =>
            $(row)
              .find("th, td")
              .toArray()
              .map((cell) => $(cell).text()),
          ),
      ).toEqual(
        price.rows.map((row) => [
          row.model === "dcf" ? "Cash flow DCF" : "Exit multiple",
          labels[row.scenario],
          row.modelValuePerShareUsd,
          `Unavailable. ${expectedText}`,
        ]),
      );
      expect(context.find('[role="status"]').text()).toBe(
        `Comparison unavailable. ${expectedText}`,
      );
    }
    const html = renderToStaticMarkup(
      createElement(ManagedScreenResearchReading, { capture: reading.right! }),
    );
    expect(html).toContain("No Annual response was retained.");
    expect(html).toContain(
      "This source was unavailable for the captured company.",
    );
    const counts = meta.getSnapshot();
    const firstReport = pair.captureReport(pair.getSnapshot())!;
    expect(firstReport.current()).toBe(true);
    expect(firstReport.report.reading).toEqual({
      kind: "watchlist_research_reading",
      listings: reading.members.map((member) => member.listing),
      left: reading.left,
      right: reading.right,
    });
    const reportHtml = load(
      renderToStaticMarkup(
        createElement(WatchlistResearchReportSnapshot, {
          report: firstReport.report,
        }),
      ),
    );
    expect(
      JSON.parse(reportHtml("[data-watchlist-research-payload]").text()),
    ).toEqual(firstReport.report);
    expect(reportHtml("[data-research-reading-side]")).toHaveLength(2);
    expect(
      reportHtml("script,img,iframe,form,button,input,select,canvas,object"),
    ).toHaveLength(0);
    expect(meta.getSnapshot()).toBe(counts);
    w.openWatchlistResearchSide(pair.getSnapshot(), "right");
    expect(firstReport.current()).toBe(false);
    expect(meta.getSnapshot()).toBe(counts);
    const selection = w.getSnapshot().research!.selection;
    w.noteResearch(selection, decisionThesis);
    const host = w.researchThesisFollowupContext(selection)!;
    const preview = w.followups.prepareNextCheck(
      host.member,
      decisionQuestion,
      decisionDue,
    );
    const created = w.followups.createNextCheck(
      preview.capture!,
      host.isCurrent,
    )!;
    expect(pair.getSnapshot().reading).toBe(reading);
    w.returnFromResearch();
    expect(pair.getSnapshot().reading).toBe(reading);
    w.openWatchlistResearchSide(pair.getSnapshot(), "right");
    const proposed = w.captureWatchlistResearchReading(pair.getSnapshot())!;
    expect(proposed.reading).toBe(reading);
    expect(proposed.replacement!.side).toBe("right");
    expect(proposed.replacement!.previous).toBe(reading.right);
    expect(proposed.replacement!.updated.note).toBe(decisionThesis);
    expect(pair.captureReport(proposed)).toBeNull();
    expect(meta.getSnapshot()).toBe(counts);
    expect(pair.cancelReplacement(proposed)!.reading).toBe(reading);
    expect(pair.getSnapshot().replacement).toBeNull();
    expect(pair.applyReplacement(proposed)).toBeNull();
    const abandoned = w.captureWatchlistResearchReading(pair.getSnapshot())!;
    expect(abandoned.replacement).not.toBeNull();
    w.returnFromResearch();
    expect(pair.getSnapshot().replacement).toBeNull();
    expect(pair.getSnapshot().reading).toBe(reading);
    expect(pair.applyReplacement(abandoned)).toBeNull();
    const retainedReport = pair.captureReport(pair.getSnapshot())!;
    expect(retainedReport.report.reading.right).toBe(reading.right);
    w.openWatchlistResearchSide(pair.getSnapshot(), "right");
    expect(retainedReport.current()).toBe(false);
    const reviewed = w.captureWatchlistResearchReading(pair.getSnapshot())!;
    const updated = reviewed.replacement!.updated;
    expect(reviewed.reading).toBe(reading);
    const recaptured = pair.applyReplacement(reviewed)!.reading!;
    expect(recaptured.right).toBe(updated);
    expect(pair.getSnapshot().replacement).toBeNull();
    expect(pair.applyReplacement(reviewed)).toBeNull();
    expect(recaptured.left).toBe(reading.left);
    expect(recaptured.right!.note).toBe(decisionThesis);
    expect(recaptured.right!.valuationPrice!.reason).toBe("price_not_loaded");
    expect(recaptured.right).not.toBe(reading.right);
    w.returnFromResearch();
    const nextReport = pair.captureReport(pair.getSnapshot())!;
    expect(nextReport.current()).toBe(true);
    expect(nextReport.report.reading.left).toBe(
      firstReport.report.reading.left,
    );
    expect(nextReport.report.reading.right).toBe(recaptured.right);
    const nextReportHtml = load(
      renderToStaticMarkup(
        createElement(WatchlistResearchReportSnapshot, {
          report: nextReport.report,
        }),
      ),
    );
    expect(
      nextReportHtml('[data-research-reading-side="right"]').text(),
    ).toContain(
      "Load raw closing prices explicitly in the Price section to compare this scenario.",
    );
    expect(firstReport.report.reading.right).toBe(reading.right);
    expect(meta.getSnapshot()).toBe(counts);
    await w.coordinator.save();
    expect(nextReport.current()).toBe(false);
    expect(pair.getSnapshot().reading).toBe(recaptured);
    w.note("listing-zero", decisionUnsaved);
    await w.followups.coordinator.save();
    expect(meta.saved().valuations.payload.entries).toEqual(
      decisionExpectedValuations(meta.data, 2),
    );
    expect(w.portfolio.coordinator.getSnapshot()).toBe(untouchedPortfolio);
    w.sessionOwner.dispose();
    fresh = new ManagedWorkspace(
      f.api,
      f.followups!.nextSession(),
      undefined,
      options,
    );
    await fresh.refreshCatalog();
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
    expect(fresh.watchlistResearchPair.getSnapshot().reading).toBeNull();
    expect(fresh.valuation.getSnapshot().calculation).toBeNull();
    expect(meta.getSnapshot()).toMatchObject({
      status: 2,
      load: 2,
      valuationLoad: 2,
      valuationSave: 2,
      save: 1,
      annual: 1,
      eod: 0,
      filings: 0,
      rejected: 0,
      unexpected: {},
      requests: ["listing-zero"],
    });
  } finally {
    w.sessionOwner.dispose();
    fresh?.sessionOwner.dispose();
  }
});

it("keeps native touch, IME, full result and passive JSON assertions while registering a separate Watchlist journey", () => {
  const java = (name: string) =>
    readFileSync(
      new URL(
        `../../android/app/src/androidTest/java/local/investment/personal/${name}.java`,
        import.meta.url,
      ),
      "utf8",
    );
  const original = java("ManagedTwoCompanyResearchReviewTest"),
    current = java("ManagedWatchlistResearchPairTest");
  const same = (text: string) =>
    /private static final String SAME_JSON = ("(?:\\.|[^"\\])*");/.exec(
      text,
    )?.[1];
  expect(same(current)).toBeDefined();
  expect(same(current)).toBe(same(original));
  const body = (text: string, name: string) => {
    const from = text.indexOf(`    private ${name}`);
    expect(from).toBeGreaterThan(0);
    const next = text.indexOf("\n    private ", from + 1);
    return text.slice(from, next < 0 ? text.lastIndexOf("\n}") : next);
  };
  for (const name of [
    "void fullResults",
    "void tap",
    "void committedFrame",
    "ReassessmentNativeEditor.Dom readEditingDom",
    "void diagnoseEditing",
    "void replace",
  ])
    expect(body(current, name)).toBe(body(original, name));
  // The unsupported right Price visit has a distinct refusal. Reverse only
  // these parameter substitutions; every remaining native assertion stays exact.
  const priceBody = body(current, "void fullPriceContext")
    .replace(
      "String side,String expectedReason,String expectedReasonText",
      "String side",
    )
    .replace(
      'reason="+q(expectedReasonText)+",keys=',
      "reason='Load raw closing prices explicitly in the Price section to compare this scenario.',keys=",
    )
    .replace(
      'p.reason!=="+q(expectedReason)+"',
      "p.reason!=='price_not_loaded'",
    )
    .replace(
      'r.result.reason==="+q(expectedReason)+"',
      "r.result.reason==='price_not_loaded'",
    );
  expect(priceBody).toBe(body(original, "void fullPriceContext"));
  expect(current).toContain(
    'fullPriceContext(side, "left".equals(side) ? "price_not_loaded" : "price_invalid", "left".equals(side) ? "Load raw closing prices explicitly in the Price section to compare this scenario." : "The loaded history does not provide an admitted latest raw USD close for this comparison.");',
  );
  expect(current).not.toContain("Load screening cohort");
  expect(current).not.toContain("Run screen (2 companies)");
  expect(current).toContain("#managed-watchlist-pair-preview");
  expect(current).toContain("#managed-watchlist-pair-start");
  expect(current).toContain("Price section for ONE");
  expect(current).toContain(".counts.annual===1");
  expect(current).toContain("WATCHLIST_RESEARCH_PAIR");
  expect(current).toContain("WATCHLIST_RESEARCH_RETURN");
});

it("refuses implicit sources and unrelated or nonmatching writes without changing resources", async () => {
  const f = await createFixture("watchlist-research-pair"),
    meta = f.watchlistResearchPair!,
    before = meta.saved();
  const signal = new AbortController().signal;
  await expect(
    f.api.eodHistory(
      {
        listingId: "listing-one",
        catalogSnapshotSha256: meta.data.watchlist.snapshotSha256,
        range: "1m",
      },
      signal,
    ),
  ).rejects.toThrow("Unexpected invented");
  await expect(f.api.save({} as never, signal)).rejects.toThrow(
    "Unexpected invented",
  );
  await expect(f.api.savePortfolio({} as never, signal)).rejects.toThrow(
    "Unexpected invented",
  );
  expect(meta.saved()).toEqual(before);
  expect(meta.getSnapshot().rejected).toBe(3);
});
