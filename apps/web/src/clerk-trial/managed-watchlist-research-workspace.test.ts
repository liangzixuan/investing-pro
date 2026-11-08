import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedWorkspace } from "./managed-workspace";
import type { ManagedApi } from "./managed-api";
import { watchlistScreenFixture } from "./test-watchlist-screen-selection-fixture";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";

const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.sessionOwner.dispose();
});

async function fixture() {
  const f = await watchlistScreenFixture(true, false);
  owners.push(f.workspace);
  f.workspace.setView("watchlist");
  return f;
}

function start(w: ManagedWorkspace) {
  const pair = w.watchlistResearchPair;
  const members = pair.getSnapshot().memberships;
  expect(members).toHaveLength(4);
  pair.select(pair.getSnapshot(), members[0]!);
  pair.select(pair.getSnapshot(), members[1]!);
  expect(pair.preview(pair.getSnapshot())).not.toBeNull();
  expect(pair.start(pair.getSnapshot())).not.toBeNull();
  return pair;
}

function calculate(w: ManagedWorkspace, amount: string) {
  const v = w.valuation;
  v.setDcfField("startingUnleveredCashFlowUsd", amount);
  v.setDcfField("enterpriseToEquityBridgeUsd", "100");
  v.setDcfField("dilutedShares", "10");
  v.setDcfField("waccPercent", "10");
  v.setDcfField("terminalGrowthPercent", "0");
  v.setExitField("baseRevenue", "1000.125");
  v.setExitField("cash", "100");
  v.setExitField("debt", "200");
  v.setExitField("dilutedShares", "100");
  v.setExitField("discountRatePercent", "10");
  for (const [scenario, growth] of [
    ["conservative", "0"],
    ["base", "10"],
    ["expansion", "20"],
  ] as const) {
    v.setDcfScenario(scenario, growth);
    v.setExitScenario(scenario, "annualRevenueGrowthPercent", growth);
    v.setExitScenario(scenario, "targetEbitdaMarginPercent", "20");
    v.setExitScenario(scenario, "exitMultiple", "10");
  }
  const result = v.calculate();
  expect(result).not.toBeNull();
  return result;
}

describe("direct Watchlist research comparison", () => {
  it("reviews a revised thesis without changing either reading, cancels, then applies one exact candidate", async () => {
    const f = await fixture();
    const w = f.workspace;
    const pair = start(w);
    for (const side of ["left", "right"] as const) {
      w.openWatchlistResearchSide(pair.getSnapshot(), side);
      if (side === "right")
        w.valuation.discardAndUse(w.getSnapshot().research!.selection);
      calculate(w, side === "left" ? "100.050" : "200.125");
      expect(
        w.captureWatchlistResearchReading(pair.getSnapshot()),
      ).not.toBeNull();
      w.returnFromResearch();
    }
    const original = pair.getSnapshot().reading!;
    const oldReport = pair.captureReport(pair.getSnapshot())!;
    w.openWatchlistResearchSide(pair.getSnapshot(), "right");
    const selection = w.getSnapshot().research!.selection;
    w.noteResearch(
      selection,
      "Updated thesis 東京; keep the original source dates.",
    );
    const draft = w.coordinator.getSnapshot().draft;
    const preview = w.captureWatchlistResearchReading(pair.getSnapshot())!;
    expect(preview.replacement?.previous).toBe(original.right);
    expect(preview.replacement?.updated.note).toContain("Updated thesis 東京");
    expect(preview.reading).toBe(original);
    expect(oldReport.current()).toBe(false);
    expect(pair.captureReport(preview)).toBeNull();
    expect(pair.cancelReplacement(preview)?.reading).toBe(original);
    expect(pair.applyReplacement(preview)).toBeNull();
    const next = w.captureWatchlistResearchReading(pair.getSnapshot())!;
    const updated = next.replacement!.updated;
    expect(pair.applyReplacement(next)?.reading?.right).toBe(updated);
    expect(pair.getSnapshot().reading?.left).toBe(original.left);
    expect(pair.applyReplacement(next)).toBeNull();
    expect(w.coordinator.getSnapshot().draft).toBe(draft);
    w.returnFromResearch();
    const report = pair.captureReport(pair.getSnapshot())!.report;
    expect(report.reading.right).toBe(updated);
    expect(report.reading.left).toBe(original.left);
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(f.api.eodHistory).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.unexpected).not.toHaveBeenCalled();
  });

  it.each(["note", "section", "back", "pending"] as const)(
    "withdraws a replacement after workspace %s changes without overwriting the retained reading",
    async (change) => {
      const { workspace: w, api } = await fixture();
      const pair = start(w);
      w.openWatchlistResearchSide(pair.getSnapshot(), "left");
      const visit = w.getSnapshot().research!;
      calculate(w, "123.450");
      const original = w.captureWatchlistResearchReading(
        pair.getSnapshot(),
      )!.reading;
      const preview = w.captureWatchlistResearchReading(pair.getSnapshot())!;
      expect(preview.replacement).not.toBeNull();
      if (change === "note") w.noteResearch(visit.selection, "A later edit");
      if (change === "section")
        await w.setCompanyRoute({
          kind: "company",
          listingId: visit.selection.listing.listingId,
          section: "eod",
        });
      if (change === "back") w.returnFromResearch();
      if (change === "pending") {
        w.setNavigationBlocked(true);
        w.setNavigationBlocked(false);
      }
      expect(pair.getSnapshot().replacement).toBeNull();
      expect(pair.getSnapshot().reading).toBe(original);
      expect(pair.applyReplacement(preview)).toBeNull();
      expect(api.save).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
    },
  );

  it("starts two exact share classes without loading a source or running an Annual screen", async () => {
    const f = await fixture();
    const w = f.workspace;
    const pair = start(w);
    expect(
      pair.getSnapshot().reading?.members.map((m) => m.listing.listingId),
    ).toEqual(
      f
        .saved()
        .payload.memberships.slice(0, 2)
        .map((m) => m.listingId),
    );
    expect(w.financialScreen.getSnapshot().run).toBeNull();
    w.openWatchlistResearchSide(pair.getSnapshot(), "left");
    expect(w.getSnapshot().research?.selection.origin).toBe("watchlist");
    expect(pair.getSnapshot().activeSide).toBe("left");
    w.returnFromResearch();
    w.closeResearch();
    w.setView("watchlist");
    expect(pair.getSnapshot().reading).not.toBeNull();
    w.openWatchlistResearchSide(pair.getSnapshot(), "right");
    expect(pair.getSnapshot().activeSide).toBe("right");
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(f.api.eodHistory).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.unexpected).not.toHaveBeenCalled();
  });

  it("keeps complete readings through thesis, dated check and independent Saves, then verifies fresh-session Loads", async () => {
    const f = await fixture();
    const w = f.workspace;
    const api: ManagedApi = f.api;
    let valuations: Awaited<
      ReturnType<ManagedApi["loadValuationAssumptions"]>
    > = {
      version: 0,
      payload: { schemaVersion: 1, entries: [] },
    };
    let checks: Awaited<ReturnType<ManagedApi["loadFollowups"]>> = {
      version: 0,
      payload: { schemaVersion: 1, entries: [] },
    };
    api.loadValuationAssumptions = vi.fn<
      ManagedApi["loadValuationAssumptions"]
    >(() => Promise.resolve(structuredClone(valuations)));
    api.saveValuationAssumptions = vi.fn<
      ManagedApi["saveValuationAssumptions"]
    >((command) => {
      valuations = {
        version: command.expectedVersion + 1,
        payload: structuredClone(command.payload),
      };
      return Promise.resolve({
        ...structuredClone(valuations),
        replayed: false,
      });
    });
    api.loadFollowups = vi.fn<ManagedApi["loadFollowups"]>(() =>
      Promise.resolve(structuredClone(checks)),
    );
    api.saveFollowups = vi.fn<ManagedApi["saveFollowups"]>((command) => {
      checks = {
        version: command.expectedVersion + 1,
        payload: structuredClone(command.payload),
      };
      return Promise.resolve({ ...structuredClone(checks), replayed: false });
    });
    await w.followups.coordinator.load();
    await w.valuationAssumptions.coordinator.load();
    const packet = await annualComparisonResponse("left");
    api.annualReport = vi.fn<ManagedApi["annualReport"]>(() =>
      Promise.resolve(packet),
    );
    const pair = start(w);
    for (const [side, amount] of [
      ["left", "100.050"],
      ["right", "200.125"],
    ] as const) {
      w.openWatchlistResearchSide(pair.getSnapshot(), side);
      const visit = w.getSnapshot().research!;
      if (side === "left") {
        await w.requestResearchSource(visit, "annual");
        expect(w.annual.getSnapshot().response).toEqual(packet);
      }
      if (side === "right") {
        expect(w.valuation.getSnapshot().editable).toBe(false);
        w.valuation.discardAndUse(visit.selection);
      }
      const calculated = calculate(w, amount);
      const before = pair.getSnapshot();
      const installed = w.captureWatchlistResearchReading(before);
      expect(installed).not.toBeNull();
      const capture = installed!.reading![side]!;
      expect(capture.selection).toEqual(visit.selection);
      expect(capture.valuation).toEqual(calculated);
      expect(capture.valuation).not.toBe(calculated);
      expect(capture.evidence.price?.response ?? null).toBeNull();
      expect(capture.evidence.annual?.response ?? null).toEqual(
        side === "left" ? packet : null,
      );
      expect(capture.document.byteLength).toBe(
        new TextEncoder().encode(capture.document.text).byteLength,
      );
      expect(w.captureWatchlistResearchReading(before)).toBeNull();
      await w.valuationAssumptions.prepareStage();
      expect(w.valuationAssumptions.stageCurrent()).toBe(true);
      await w.valuationAssumptions.coordinator.save();
      expect(pair.getSnapshot().reading![side]).toBe(capture);
      w.returnFromResearch();
      expect(pair.getSnapshot().reading![side]).toBe(capture);
    }
    const reading = pair.getSnapshot().reading!;
    w.openWatchlistResearchSide(pair.getSnapshot(), "left");
    const selection = w.getSnapshot().research!.selection;
    w.noteResearch(
      selection,
      "Review both authored cases after the next filing. 東京",
    );
    const host = w.researchThesisFollowupContext(selection)!;
    const prepared = w.followups.prepareNextCheck(
      host.member,
      "Compare cash generation with both retained cases.",
      "2026-12-01",
    );
    expect(prepared.capture).not.toBeNull();
    expect(
      w.followups.createNextCheck(prepared.capture!, host.isCurrent),
    ).not.toBeNull();
    expect(pair.getSnapshot().reading).toBe(reading);
    await w.coordinator.save();
    await w.followups.coordinator.save();
    expect(w.coordinator.getSnapshot().latestLoaded).toBe(false);
    expect(pair.getSnapshot().reading).toBe(reading);
    expect(reading.left!.note).not.toBe(f.saved().payload.memberships[0]!.note);
    w.returnFromResearch();
    await w.coordinator.load();
    expect(pair.getSnapshot().reading).toBeNull();
    expect(w.coordinator.getSnapshot().draft).toEqual(f.saved().payload);
    const fresh = new ManagedWorkspace(api, {
      userId: "invented-screen-owner",
      sessionId: "invented-watchlist-pair-fresh",
      getToken: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined),
    });
    owners.push(fresh);
    await fresh.refreshCatalog();
    await fresh.coordinator.load();
    await fresh.followups.coordinator.load();
    await fresh.valuationAssumptions.coordinator.load();
    expect(fresh.coordinator.getSnapshot().draft).toEqual(f.saved().payload);
    expect(fresh.followups.coordinator.getSnapshot().draft).toEqual(
      checks.payload,
    );
    expect(fresh.valuationAssumptions.coordinator.getSnapshot().draft).toEqual(
      valuations.payload,
    );
    expect(valuations.payload.entries).toHaveLength(2);
    expect(checks.payload.entries).toHaveLength(1);
    expect(fresh.watchlistResearchPair.getSnapshot().reading).toBeNull();
    expect(api.annualReport).toHaveBeenCalledTimes(1);
    expect(api.savePortfolio).not.toHaveBeenCalled();
    expect(f.unexpected).not.toHaveBeenCalled();
  });

  it("retires an owned pair for a foreign visit to the same exact company", async () => {
    const { workspace: w } = await fixture();
    const pair = start(w);
    w.openWatchlistResearchSide(pair.getSnapshot(), "left");
    const old = pair.getSnapshot();
    w.openWatchlistAnnual(w.coordinator.getSnapshot().draft!.memberships[0]!);
    expect(pair.getSnapshot().reading).toBeNull();
    expect(w.captureWatchlistResearchReading(old)).toBeNull();
  });

  it("preserves the exact owned visit across URL reflection, section change and router Back cleanup", async () => {
    const { workspace: w, api } = await fixture();
    const pair = start(w);
    w.openWatchlistResearchSide(pair.getSnapshot(), "left");
    const oldVisit = w.getSnapshot().research!;
    w.setNavigationBlocked(true);
    await w.setCompanyRoute({
      kind: "company",
      listingId: oldVisit.selection.listing.listingId,
      section: "eod",
    });
    const nextVisit = w.getSnapshot().research!;
    expect(nextVisit).not.toBe(oldVisit);
    expect(pair.getSnapshot().activeSide).toBe("left");
    calculate(w, "123.456");
    expect(pair.capture(pair.getSnapshot(), oldVisit)).toBeNull();
    const retained = w.captureWatchlistResearchReading(pair.getSnapshot());
    expect(retained).not.toBeNull();
    w.setNavigationBlocked(false);
    w.returnFromResearch();
    await w.setCompanyRoute(null);
    w.setView("watchlist");
    expect(pair.getSnapshot().reading).toBe(retained!.reading);
    const fileOwner = {};
    w.beginWatchlistDraftFileActivity(fileOwner);
    w.endWatchlistDraftFileActivity(fileOwner);
    expect(pair.getSnapshot().reading).toBeNull();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it.each(["close", "foreign"] as const)(
    "does not overwrite a reentrant %s during an owned section change",
    async (action) => {
      const { workspace: w } = await fixture();
      const pair = start(w);
      w.openWatchlistResearchSide(pair.getSnapshot(), "left");
      const visit = w.getSnapshot().research!;
      calculate(w, "100");
      expect(pair.getSnapshot().canCapture).toBe(true);
      let armed = true;
      const foreign = w.coordinator.getSnapshot().draft!.memberships[1]!;
      const unsubscribe = pair.subscribe(() => {
        if (
          !armed ||
          pair.getSnapshot().canCapture ||
          w.getSnapshot().research !== visit
        )
          return;
        armed = false;
        if (action === "close") w.closeResearch();
        else w.openWatchlistAnnual(foreign);
      });
      await w.setCompanyRoute({
        kind: "company",
        listingId: visit.selection.listing.listingId,
        section: "eod",
      });
      unsubscribe();
      expect(armed).toBe(false);
      expect(pair.getSnapshot().reading).toBeNull();
      if (action === "close") expect(w.getSnapshot().research).toBeNull();
      else
        expect(w.getSnapshot().research?.selection.listing.listingId).toBe(
          foreign.listingId,
        );
      expect(w.getSnapshot().companyRoute).toBeNull();
    },
  );
});
