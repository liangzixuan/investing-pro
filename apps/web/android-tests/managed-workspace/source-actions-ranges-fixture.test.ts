import { expect, it, vi } from "vitest";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { createFixture } from "./fixture";

it("uses exact-visit overview Price actions across staged ranges, Cancel, reopen and retirement", async () => {
  const fixture = await createFixture("company-price-ranges");
  const reads = vi.spyOn(fixture.api, "eodHistory");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      priceCoverage: fixture.priceCoverage,
      marketsCohort: fixture.marketsCohort,
    },
  );
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note("listing-zero", "Overview ranges · Café 東京 📈");
  const draft = structuredClone(workspace.coordinator.getSnapshot().draft);
  const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
  const visit = () => {
    const current = workspace.getSnapshot().research;
    if (!current) throw new Error("Expected an invented company visit");
    return current;
  };
  const open = async () => {
    workspace.setNavigationBlocked(false);
    workspace.openWatchlistEod(member);
    workspace.setNavigationBlocked(true);
    await workspace.setCompanyRoute({
      kind: "company",
      listingId: member.listingId,
      section: "eod",
    });
  };
  try {
    await open();
    workspace.eod.selectRange("1y");
    expect(reads).not.toHaveBeenCalled();
    await workspace.requestResearchSource(visit(), "eod");
    const year = workspace.eod.getSnapshot().response;
    expect(year).toMatchObject({
      range: "1y",
      completedAt: "2026-09-20T00:00:01.000Z",
    });
    workspace.eod.selectRange("1m");
    expect(reads).toHaveBeenCalledTimes(1);
    expect(workspace.eod.getSnapshot().response).toBe(year);
    const second = workspace.requestResearchSource(visit(), "eod");
    workspace.cancelResearchSource(visit(), "eod");
    fixture.settleCancelledEod();
    await second;
    expect(workspace.eod.getSnapshot()).toMatchObject({
      response: year,
      showingPrevious: true,
      running: false,
    });
    await workspace.requestResearchSource(visit(), "eod");
    expect(workspace.eod.getSnapshot().response).toMatchObject({
      range: "1m",
      completedAt: "2026-09-21T00:00:02.000Z",
    });
    workspace.eod.selectRange("1y");
    const oldVisit = visit();
    const fourth = workspace.requestResearchSource(oldVisit, "eod");
    workspace.closeResearch();
    await workspace.setCompanyRoute(null);
    workspace.setNavigationBlocked(false);
    fixture.settleCancelledEod();
    await fourth;
    await open();
    expect(workspace.eod.getSnapshot()).toMatchObject({
      selectedRange: "1m",
      response: null,
    });
    await workspace.requestResearchSource(oldVisit, "eod");
    workspace.cancelResearchSource(oldVisit, "eod");
    expect(reads).toHaveBeenCalledTimes(4);
    const fifth = workspace.requestResearchSource(visit(), "eod");
    expect(reads).toHaveBeenCalledTimes(5);
    expect(workspace.eod.getSnapshot().running).toBe(true);
    expect(reads.mock.calls.map(([request]) => request.range)).toEqual([
      "1y",
      "1m",
      "1m",
      "1y",
      "1m",
    ]);
    expect(workspace.coordinator.getSnapshot().draft).toEqual(draft);
    await workspace.refreshCatalog();
    fixture.settleCancelledEod();
    await fifth;
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(workspace.eod.getSnapshot()).toMatchObject({
      selection: null,
      response: null,
      running: false,
    });
    expect(fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 2,
      save: 0,
      annual: 0,
      filings: 0,
      eod: 5,
      eodAborted: 3,
      eodLateResolved: 3,
    });
  } finally {
    workspace.coordinator.retire();
  }
});
