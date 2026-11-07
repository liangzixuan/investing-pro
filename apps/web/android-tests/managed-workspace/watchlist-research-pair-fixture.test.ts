import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManagedScreenResearchReading } from "../../src/clerk-trial/ManagedScreenResearchReading";
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
    const html = renderToStaticMarkup(
      createElement(ManagedScreenResearchReading, { capture: reading.right! }),
    );
    expect(html).toContain("No Annual response was retained.");
    expect(html).toContain(
      "This source was unavailable for the captured company.",
    );
    const counts = meta.getSnapshot();
    w.openWatchlistResearchSide(pair.getSnapshot(), "right");
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
    await w.coordinator.save();
    expect(pair.getSnapshot().reading).toBe(reading);
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
    "void fullPriceContext",
    "void tap",
    "void committedFrame",
    "ReassessmentNativeEditor.Dom readEditingDom",
    "void diagnoseEditing",
    "void replace",
  ])
    expect(body(current, name)).toBe(body(original, name));
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
