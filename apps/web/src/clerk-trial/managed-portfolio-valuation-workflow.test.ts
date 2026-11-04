import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import { capturePortfolioCloseContext } from "./portfolio-close-review-context";
import { prepareHoldingFollowup } from "./managed-holding-followup";
import { captureValuationCalculationGuard } from "./managed-valuation-workbench";

const now = "2026-11-04T12:00:00.000Z";
const owners: ManagedWorkspace[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});
afterEach(() => {
  owners.splice(0).forEach((w) => w.sessionOwner.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("keeps a complete dated holdings reading through current Research and owned Back, then saves and reloads each authored resource independently", async () => {
  const fixture = await createFixture("portfolio-saved-scenario");
  const store = fixture.portfolioSavedScenario!;
  const apiCalls = Object.keys(fixture.api).map((key) => ({
    key,
    spy: vi.spyOn(fixture.api, key as keyof typeof fixture.api),
  }));
  const w = new ManagedWorkspace(fixture.api, fixture.session, undefined, {
    marketsCohort: fixture.marketsCohort,
    researchCoverage: fixture.researchCoverage,
    priceCoverage: fixture.priceCoverage,
  });
  owners.push(w);
  await w.refreshCatalog();
  await w.portfolio.coordinator.load();
  await w.portfolio.reviewCatalog();
  w.portfolio.applyReview();
  await w.valuationAssumptions.coordinator.load();
  w.setView("portfolio");
  const original = store.saved();
  const prices = w.createPortfolioCloseReview();
  prices.enter(capturePortfolioCloseContext(w));
  await prices.load();
  prices.selectDate("2026-11-02");
  const context = w.portfolioValuationReview,
    model = context.model;
  const calculate = vi.spyOn(w.valuation, "calculate");
  const before = store.getSnapshot();
  const portfolioBefore = w.portfolio.coordinator.getSnapshot(),
    editorBefore = w.valuation.getSnapshot();
  const p = context.preview(prices, model.getSnapshot())!;
  expect(p.plan).not.toBeNull();
  expect(p.plan!.rows.map((r) => r.source.holding.identity)).toEqual(
    original.portfolio.payload!.identities,
  );
  expect(p.plan!.rows.map((r) => r.reason)).toEqual([
    null,
    null,
    "missing_saved_inputs",
  ]);
  expect(p.plan!.rows[2]!.price.reason).toBe("price_unsupported");
  expect(w.coordinator.getSnapshot().draft).toBeNull();
  expect(w.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(fixture.followups!.getSnapshot()).toMatchObject({ load: 0, save: 0 });
  expect(
    original.watchlist.payload.memberships.some(
      (m) => m.listingId === p.plan!.rows[2]!.selection.listing.listingId,
    ),
  ).toBe(false);
  expect(p.plan!.collection.saved).toEqual(original.valuations);
  vi.setSystemTime("2026-11-04T12:01:00.000Z");
  const reading = model.evaluate(p)!.reading!,
    readingJson = JSON.stringify(reading);
  expect(reading.plan.capturedAt).toBe(now);
  expect(reading.evaluatedAt).toBe("2026-11-04T12:01:00.000Z");
  expect(reading.plan.report.selectedDate).toBe("2026-11-02");
  expect(reading.rows[0]!.row.price.reference).toMatchObject({
    date: "2026-11-02",
    rawCloseUsd: "120.5",
  });
  expect(reading.rows[0]!.row.source.response!.rows.at(-1)!.close).toBe("130");
  for (const result of reading.rows.slice(0, 2)) {
    expect(result.comparison!.rows).toHaveLength(6);
    expect(result.calculation!.dcfDraft).toEqual(result.row.entry!.dcf.inputs);
    expect(result.calculation!.exitDraft).toEqual(
      result.row.entry!.exit.inputs,
    );
    expect(captureValuationCalculationGuard(result.calculation!)).toBeNull();
  }
  expect(reading.rows[1]!.row.entry!.exit.inputs.baseRevenue).toBe(
    "unfinished 1..",
  );
  expect(
    reading.rows[1]!.comparison!.rows.filter((r) => r.model === "exit").every(
      (r) => r.result.status === "unavailable",
    ),
  ).toBe(true);
  expect(reading.rows[2]!.calculation).toBeNull();
  expect(store.getSnapshot()).toEqual(before);
  expect(calculate).not.toHaveBeenCalled();
  expect(w.portfolio.coordinator.getSnapshot()).toBe(portfolioBefore);
  expect(w.valuation.getSnapshot()).toBe(editorBefore);

  const row = p.plan!.rows[0]!,
    draft = w.portfolio.coordinator.getSnapshot().draft!,
    listing = draft.ledger!.identities[0]!;
  const forgedOpen = vi.fn();
  expect(
    context.research(
      { ...row, selection: { ...row.selection, cik: "0000000099" } },
      forgedOpen,
    ),
  ).toBe(false);
  expect(
    context.research(
      { ...row, selection: p.plan!.rows[1]!.selection },
      forgedOpen,
    ),
  ).toBe(false);
  expect(forgedOpen).not.toHaveBeenCalled();
  expect(model.getSnapshot().reading).toBe(reading);
  const open = () =>
    context.research(row, () => w.openPortfolioResearch(draft, listing));
  expect(open()).toBe(true);
  const selection = w.getSnapshot().research!.selection;
  expect(selection).toEqual(row.selection);
  prices.retire();
  expect(model.getSnapshot().reading).toBe(reading);
  expect(store.getSnapshot()).toEqual(before);
  expect(calculate).not.toHaveBeenCalled();
  const savedEntry =
    w.valuationAssumptions.coordinator.getSnapshot().saved!.payload.entries[0]!;
  const restore = w.valuationAssumptions.reviewSavedInputs(savedEntry);
  expect(restore).not.toBeNull();
  expect(w.valuationAssumptions.useSavedInputs(restore)).toBe(true);
  expect(
    w.valuation.setDcfField("startingUnleveredCashFlowUsd", "125.0500"),
  ).toBe(true);
  expect(w.valuation.setExitField("baseRevenue", "1100.1250")).toBe(true);
  const revised = w.valuation.calculate()!;
  expect(revised).not.toBeNull();
  expect(revised.dcfDraft.startingUnleveredCashFlowUsd).toBe("125.0500");
  expect(calculate).toHaveBeenCalledTimes(1);
  expect(model.getSnapshot().reading).toBe(reading);
  expect(w.canLoadHoldingFollowups(selection)).toBe(true);
  await w.loadHoldingFollowups(selection, () => true);
  const unrelated = structuredClone(
    w.followups.coordinator.getSnapshot().draft!.entries,
  );
  const port = w.captureHoldingFollowup(selection).port;
  expect(port).not.toBeNull();
  const question =
    "Does the current holding still meet the revised cash-flow assumptions?";
  const check = prepareHoldingFollowup(
    port!,
    question,
    "2026-12-15",
    () => true,
  ).preview;
  expect(check).not.toBeNull();
  const created = check!.create()!;
  expect(created).not.toBeNull();
  const assessment =
    "Current authored inputs changed; the earlier selected-date comparison remains preserved.";
  w.followups.edit(created, "result", assessment);
  const authoredChecks = structuredClone(
    w.followups.coordinator.getSnapshot().draft!,
  );
  expect(authoredChecks.entries[0]).toEqual(unrelated[0]);
  expect(authoredChecks.entries[1]).toMatchObject({
    listing: listing,
    check: question,
    result: assessment,
    status: "open",
  });
  expect(store.getSnapshot()).toEqual(before);
  expect(fixture.followups!.getSnapshot().save).toBe(0);
  const dirtyEditor = w.valuation.getSnapshot();
  expect(dirtyEditor.dirty).toBe(true);
  w.returnFromResearch();
  await w.setCompanyRoute(null);
  expect(context.resumePortfolio()).toBe(true);
  expect(model.getSnapshot().reading).toBe(reading);
  expect(JSON.stringify(reading)).toBe(readingJson);
  expect(w.valuation.getSnapshot().dcfDraft).toBe(dirtyEditor.dcfDraft);
  expect(w.valuation.getSnapshot().exitDraft).toBe(dirtyEditor.exitDraft);
  expect(store.getSnapshot()).toEqual(before);
  expect(calculate).toHaveBeenCalledTimes(1);

  await w.followups.coordinator.save();
  expect(fixture.followups!.getSnapshot()).toMatchObject({
    save: 1,
    commits: 1,
  });
  expect(store.saved().portfolio).toEqual(original.portfolio);
  expect(store.saved().valuations).toEqual(original.valuations);
  expect(model.getSnapshot().reading).toBe(reading);
  expect(open()).toBe(true);
  await w.valuationAssumptions.prepareStage();
  expect(
    model.getSnapshot().reading,
    "saved baseline survives unsaved stage preview",
  ).toBe(reading);
  expect(w.valuationAssumptions.stageCurrent()).toBe(true);
  expect(
    model.getSnapshot().reading,
    "saved baseline survives unsaved stage application",
  ).toBe(reading);
  await w.valuationAssumptions.coordinator.save();
  expect(
    store.getSnapshot(),
    JSON.stringify(
      apiCalls
        .filter((r) => r.spy.mock.calls.length)
        .map((r) => [r.key, r.spy.mock.calls.length]),
    ),
  ).toMatchObject({
    portfolioSave: 0,
    valuationSave: 1,
    eod: 2,
    load: 0,
    save: 0,
    unexpected: 0,
  });
  expect(store.saved().valuations.payload.entries[1]).toEqual(
    original.valuations.payload.entries[1],
  );
  expect(store.saved().valuations.payload.entries[0]).toMatchObject({
    cik: row.selection.cik,
    dcf: { inputs: revised.dcfDraft },
    exit: { inputs: revised.exitDraft },
  });
  expect(model.getSnapshot().reading).toBeNull(); // Confirmed collection ownership changed.
  w.closeResearch();
  const ledger = {
    ...draft.ledger!,
    opening: { ...draft.ledger!.opening, cashUsd: "11.00" },
  };
  w.portfolio.replace(w.portfolio.coordinator.getSnapshot().draft!, ledger);
  await w.portfolio.coordinator.save();
  expect(store.getSnapshot()).toMatchObject({
    portfolioSave: 1,
    valuationSave: 1,
    eod: 2,
    load: 0,
    save: 0,
    unexpected: 0,
  });
  expect(store.saved().portfolio.payload).toEqual(ledger);
  expect(store.saved().watchlist).toEqual(original.watchlist);
  const finalEditor = w.valuation.getSnapshot();
  await w.portfolio.coordinator.load();
  await w.valuationAssumptions.coordinator.load();
  await w.followups.coordinator.load();
  expect(w.portfolio.coordinator.getSnapshot().draft!.ledger).toEqual(ledger);
  expect(w.valuationAssumptions.coordinator.getSnapshot().draft).toEqual(
    store.saved().valuations.payload,
  );
  expect(w.followups.coordinator.getSnapshot().draft).toEqual(authoredChecks);
  expect(w.valuation.getSnapshot().dcfDraft).toBe(finalEditor.dcfDraft);
  expect(w.valuation.getSnapshot().exitDraft).toBe(finalEditor.exitDraft);
  expect(store.getSnapshot()).toMatchObject({
    portfolioLoad: 2,
    valuationLoad: 2,
    portfolioSave: 1,
    valuationSave: 1,
    eod: 2,
    load: 0,
    save: 0,
    unexpected: 0,
  });
  expect(fixture.followups!.getSnapshot()).toMatchObject({
    load: 2,
    save: 1,
    commits: 1,
  });
  expect(calculate).toHaveBeenCalledTimes(1);
});
