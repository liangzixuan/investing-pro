import { describe, expect, it } from "vitest";
import { createFixture } from "./fixture";
import { balanceSheetPacket } from "./balance-sheet-fixture";
import { parseSecAnnualEvidenceResponse } from "../../src/lib/sec-annual-evidence-response";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import { prepareCompanyReport } from "../../src/clerk-trial/managed-company-report";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";

const request = {
  schemaVersion: "5.0.0" as const,
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
  listingId: "listing-zero",
  symbol: "ZERO",
};
const keys = ["totalAssets", "totalLiabilities", "shareholdersEquity"] as const;
const amounts = ["1000.125", "1200.25", "-200.125"];

describe("invented balance-sheet acceptance", () => {
  it("admits three independent instant totals with original filing coordinates and absent income", async () => {
    const packet = await balanceSheetPacket();
    const decoded = await parseSecAnnualEvidenceResponse(
      packet,
      request,
      new AbortController().signal,
    );
    expect(decoded).toEqual(packet);
    if (!decoded) throw new Error("Expected admitted balance-sheet packet");
    expect(decoded.evidence.observations).toEqual([]);
    expect(decoded.evidence.resolution.pairs).toEqual([]);
    for (const [index, key] of keys.entries()) {
      const metric = decoded.evidence.balanceSheet[key];
      expect(metric.observations).toHaveLength(1);
      expect(metric.observations[0]).toMatchObject({
        value: amounts[index],
        unit: "USD",
        startDate: null,
        durationDays: null,
        endDate: "2025-12-31",
        accessionNumber: "0000000001-26-000001",
        filing: { status: "matched", reportDate: "2025-12-31" },
      });
      expect(metric.observations[0]!.sourceLocator).toBe(
        `/facts/us-gaap/${["Assets", "Liabilities", "StockholdersEquity"][index]}/units/USD/0`,
      );
      expect(decoded.evidence.balanceSheet.resolution[key]).toEqual({
        status: "available",
        unit: "USD",
        value: amounts[index],
        asOfDate: "2025-12-31",
        accessionNumber: "0000000001-26-000001",
        currentUseEligible: true,
        observationIds: [metric.observations[0]!.id],
      });
    }
    expect(decoded.evidence.generation).toMatchObject({
      cutoffAt: "2026-09-20T00:00:00.000Z",
      completedAt: "2026-09-20T00:00:02.000Z",
      sources: {
        companyFacts: { fetchedAt: "2026-09-20T00:00:01.000Z" },
        submissions: { fetchedAt: "2026-09-20T00:00:02.000Z" },
      },
    });
  });

  it("captures one read, retains all totals on failure and fences the held late packet after aggregate retirement", async () => {
    const fixture = await createFixture("annual-balance-sheet");
    const workspace = new ManagedWorkspace(
      fixture.api,
      fixture.session,
      undefined,
      {
        marketsCohort: fixture.marketsCohort,
        priceCoverage: fixture.priceCoverage,
      },
    );
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("watchlist");
    workspace.note("listing-zero", "Balance sheet draft · Café 東京 📈");
    workspace.move("listing-zero", 1);
    const draft = workspace.coordinator.getSnapshot().draft;
    if (!draft) throw new Error("Expected watchlist draft");
    workspace.openWatchlistAnnual(draft.memberships[1]!);
    const selection = workspace.getSnapshot().research?.selection;
    if (!selection) throw new Error("Expected exact company selection");
    const snapshot = () =>
      companySnapshotEvidence(
        selection,
        workspace.eod.getSnapshot(),
        workspace.annual.getSnapshot(),
        workspace.filings.getSnapshot(),
      );
    const report = () =>
      prepareCompanyReport(
        selection,
        snapshot(),
        workspace.getResearchWatchlist(selection),
      );
    expect(report()).toBeNull();
    expect(fixture.getSnapshot().annual).toBe(0);
    await workspace.annual.load();
    const initial = workspace.annual.getSnapshot().response;
    const prepared = report();
    if (!initial || !prepared)
      throw new Error("Expected complete Annual capture");
    const document = formatCompanyReportDocument(prepared);
    if (!document) throw new Error("Expected captured report document");
    expect(JSON.parse(document.text)).toMatchObject({
      authoredResearch: { note: "Balance sheet draft · Café 東京 📈" },
      sources: {
        annual: { response: initial },
        price: { status: "not_loaded" },
        filings: { status: "not_loaded" },
      },
    });
    expect(fixture.getSnapshot().annual).toBe(1);
    await workspace.annual.load();
    expect(workspace.annual.getSnapshot()).toMatchObject({
      response: initial,
      showingPrevious: true,
      error: true,
    });
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(JSON.parse(document.text)).toMatchObject({
      sources: { annual: { response: initial } },
    });
    const held = workspace.annual.load();
    expect(fixture.getSnapshot().annual).toBe(3);
    expect(() => fixture.settleCancelledRead()).toThrow(
      "Only the retired balance-sheet read may settle",
    );
    await workspace.refreshCatalog();
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
    });
    expect(workspace.annual.getSnapshot().response).toBeNull();
    fixture.settleCancelledRead();
    await held;
    await Promise.resolve();
    expect(workspace.annual.getSnapshot().response).toBeNull();
    expect(workspace.getSnapshot().research).toBeNull();
    expect(report()).toBeNull();
    expect(fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 2,
      annual: 3,
      refreshFailed: 1,
      aborted: 1,
      lateResolved: 1,
      marketsResolve: 1,
      save: 0,
      eod: 0,
      filings: 0,
      marketsEod: 0,
      calendar: 0,
      fed: 0,
      search: 0,
      resolve: 0,
      token: 0,
      signOut: 0,
    });
    expect(() => fixture.settleCancelledRead()).toThrow(
      "Only the retired balance-sheet read may settle",
    );
    workspace.sessionOwner.dispose();
  });

  it("refuses wrong identities, obsolete versions, pre-start and extra reads", async () => {
    const fixture = await createFixture("annual-balance-sheet");
    const signal = new AbortController().signal;
    expect(() => fixture.api.annualReport(request, signal)).toThrow(
      "Unexpected balance-sheet Annual request or order",
    );
    await fixture.api.status(signal);
    for (const wrong of [
      { ...request, listingId: "listing-one" },
      { ...request, symbol: "ONE" },
      {
        ...request,
        catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const,
      },
      { ...request, schemaVersion: "4.0.0" },
    ])
      expect(() =>
        fixture.api.annualReport(wrong as typeof request, signal),
      ).toThrow("Unexpected balance-sheet Annual request or order");
    expect(fixture.getSnapshot().annual).toBe(0);
    await fixture.api.annualReport(request, signal);
    await expect(
      fixture.api.annualReport(request, signal),
    ).rejects.toMatchObject({ code: "unavailable" });
    const controller = new AbortController();
    const held = fixture.api.annualReport(request, controller.signal);
    expect(() => fixture.api.annualReport(request, signal)).toThrow(
      "Unexpected balance-sheet Annual request or order",
    );
    await expect(fixture.api.status(signal)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    controller.abort();
    fixture.settleCancelledRead();
    const late = await held;
    expect(late.evidence.balanceSheet.resolution.totalAssets).toMatchObject({
      value: "999.875",
    });
    expect(() => fixture.api.annualReport(request, signal)).toThrow(
      "Unexpected balance-sheet Annual request or order",
    );
  });

  it("rejects source and persistence work outside the admitted journey", async () => {
    const fixture = await createFixture("annual-balance-sheet");
    const signal = new AbortController().signal;
    expect(() => fixture.api.eodHistory({} as never, signal)).toThrow(
      "Unexpected balance-sheet Price read",
    );
    expect(() => fixture.api.recentFilings({} as never, signal)).toThrow(
      "Unexpected balance-sheet Filings read",
    );
    expect(() => fixture.api.search("ZERO", signal)).toThrow(
      "Unexpected balance-sheet search",
    );
    await expect(fixture.api.save({} as never, signal)).rejects.toThrow(
      "Unexpected fixture operation: save",
    );
    expect(() => fixture.api.economicCalendar(signal)).toThrow();
    expect(() => fixture.api.monetaryAnnouncements(signal)).toThrow();
    await expect(fixture.api.loadFollowups(signal)).rejects.toThrow(
      "Follow-ups require an explicit fixture action",
    );
  });
});
