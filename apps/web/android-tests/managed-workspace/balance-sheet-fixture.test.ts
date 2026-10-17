import {
  admitUiPacket,
  viewOf,
} from "../../src/features/research/test-canonical-annual-ui-fixture";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  comparePersonalSecAnnualBalanceSheetHistory,
  resolvePersonalSecAnnualCanonicalBalanceSheetHistory,
} from "@research-cockpit/personal-financial-analytics";
import { SecAnnualBalanceSheetHistory } from "../../src/features/research/SecAnnualBalanceSheetHistory";
import { SecAnnualBalanceSheetChange } from "../../src/features/research/SecAnnualBalanceSheetChange";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { createFixture } from "./fixture";
import { balanceSheetPacket } from "./balance-sheet-fixture";
import { parseSecAnnualCanonicalResponse } from "../../src/lib/sec-annual-canonical-response";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import { prepareCompanyReport } from "../../src/clerk-trial/managed-company-report";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";

const request = {
  schemaVersion: "6.0.0" as const,
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
  listingId: "listing-zero",
  symbol: "ZERO",
};
const keys = ["totalAssets", "totalLiabilities", "shareholdersEquity"] as const;
const amounts = ["1000.125", "1200.25", "-200.125"];
const concepts = {
  totalAssets: "Assets",
  totalLiabilities: "Liabilities",
  shareholdersEquity: "StockholdersEquity",
} as const;
function sourceRows(
  response: Awaited<ReturnType<typeof balanceSheetPacket>>,
  key: (typeof keys)[number],
) {
  return response.evidence.facts.observations.filter(
    (row) => row.concept === concepts[key],
  );
}

describe("invented balance-sheet acceptance", () => {
  it("admits three independent instant totals with original filing coordinates and absent income", async () => {
    const packet = await balanceSheetPacket();
    const decoded = await parseSecAnnualCanonicalResponse(
      packet,
      request,
      new AbortController().signal,
    );
    expect(decoded).toEqual(packet);
    if (!decoded) throw new Error("Expected admitted balance-sheet packet");
    expect(decoded.schemaVersion).toBe("6.0.0");
    expect(decoded.evidence.facts.scans).toHaveLength(32);
    expect(
      decoded.evidence.facts.observations.filter((row) =>
        [
          "Revenues",
          "SalesRevenueNet",
          "RevenueFromContractWithCustomerExcludingAssessedTax",
          "NetIncomeLoss",
        ].includes(row.concept),
      ),
    ).toEqual([]);
    expect(viewOf(decoded).income.resolution.pairs).toEqual([]);
    for (const [index, key] of keys.entries()) {
      const observations = sourceRows(decoded, key);
      expect(observations).toHaveLength([3, 2, 3][index]!);
      expect(observations[0]).toMatchObject({
        value: amounts[index],
        unit: "USD",
        startDate: null,
        durationDays: null,
        endDate: "2025-12-31",
        accessionNumber: "0000000001-26-000001",
        filing: { status: "matched", reportDate: "2025-12-31" },
      });
      expect(observations[0]!.sourceLocator).toBe(
        `/facts/us-gaap/${["Assets", "Liabilities", "StockholdersEquity"][index]}/units/USD/0`,
      );
      expect(viewOf(decoded).balanceSheet.resolution[key]).toEqual({
        status: "available",
        unit: "USD",
        value: amounts[index],
        asOfDate: "2025-12-31",
        accessionNumber: "0000000001-26-000001",
        currentUseEligible: true,
        observationIds: [observations[0]!.id],
      });
    }
    const history = historyFor(decoded);
    expect(history.status).toBe("available");
    if (history.status !== "available")
      throw new Error("Expected reported dates");
    expect(history.balances.map((balance) => balance.asOfDate)).toEqual([
      "2025-12-31",
      "2024-12-31",
      "2023-09-30",
    ]);
    expect(history.balances[1]).toMatchObject({
      totalAssets: { value: "900.5", currentUseEligible: false },
      totalLiabilities: {
        status: "unavailable",
        reason: "no_report_date",
        observationIds: [],
      },
      shareholdersEquity: { value: "0", currentUseEligible: false },
    });
    expect(history.balances[2]).toMatchObject({
      totalAssets: { value: "800.875" },
      totalLiabilities: { value: "900" },
      shareholdersEquity: { value: "-98.625" },
    });
    const change = changeFor(decoded);
    expect(change).toMatchObject({
      status: "available",
      accessionNumber: "0000000001-26-000001",
      currentDate: "2025-12-31",
      priorDate: "2024-12-31",
      totalAssets: {
        status: "available",
        difference: "99.625",
        current: history.balances[0]!.totalAssets,
        prior: history.balances[1]!.totalAssets,
        observationIds: sourceRows(decoded, "totalAssets")
          .slice(0, 2)
          .map((row) => row.id),
      },
      totalLiabilities: {
        status: "unavailable",
        current: history.balances[0]!.totalLiabilities,
        prior: history.balances[1]!.totalLiabilities,
      },
      shareholdersEquity: {
        status: "available",
        difference: "-200.125",
        current: history.balances[0]!.shareholdersEquity,
        prior: history.balances[1]!.shareholdersEquity,
      },
    });
    if (change.status !== "available") throw new Error("Expected change dates");
    expect(change.totalLiabilities).not.toHaveProperty("difference");
    const calculated = changeMarkup(decoded);
    expect(calculated).toContain("99.625</span>");
    expect(calculated).toContain("-200.125</span>");
    expect(calculated).toContain(
      "Prior amount: No reported amount at this date.",
    );
    expect(calculated).not.toContain("300.25");
    expect(calculated).not.toContain("2023-09-30");
    for (const key of keys)
      for (const row of sourceRows(decoded, key)) {
        expect(row.accessionNumber).toBe("0000000001-26-000001");
        expect(row.filing.reportDate).toBe("2025-12-31");
        expect(row.filing.acceptedAt).toBe("2026-02-01T00:00:00.000Z");
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
    const historyBefore = markup(initial);
    const changeBefore = changeFor(initial);
    const calculatedBefore = changeMarkup(initial);
    expect(historyBefore).toContain("900.5");
    expect(historyBefore).toContain("No reported amount at this date.");
    expect(JSON.stringify(JSON.parse(document.text))).toContain(
      JSON.stringify(initial),
    );
    const captured = await parseSecAnnualCanonicalResponse(
      (
        JSON.parse(document.text) as {
          sources: { annual: { response: unknown } };
        }
      ).sources.annual.response,
      request,
      new AbortController().signal,
    );
    expect(captured).toEqual(initial);
    if (!captured) throw new Error("Expected decoded captured evidence");
    expect(changeFor(captured)).toEqual(changeBefore);
    expect(changeMarkup(captured)).toBe(calculatedBefore);
    expect(fixture.getSnapshot().save).toBe(0);
    expect(
      sourceRows(initial, "totalAssets").map((row) => row.endDate),
    ).toEqual(["2025-12-31", "2024-12-31", "2023-09-30"]);
    expect(
      initial.evidence.facts.scans
        .filter((item) =>
          Object.values(concepts).some((concept) => concept === item.concept),
        )
        .map((item) => item.concept),
    ).toEqual(["Assets", "Liabilities", "StockholdersEquity"]);
    expect(Object.keys(viewOf(initial).balanceSheet)).toEqual([
      "resolution",
      "history",
      "change",
    ]);
    expect(fixture.getSnapshot().annual).toBe(1);
    await workspace.annual.load();
    expect(workspace.annual.getSnapshot()).toMatchObject({
      response: initial,
      showingPrevious: true,
      error: true,
    });
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(markup(workspace.annual.getSnapshot().response!)).toBe(
      historyBefore,
    );
    expect(changeMarkup(workspace.annual.getSnapshot().response!)).toBe(
      calculatedBefore,
    );
    expect(JSON.parse(document.text)).toMatchObject({
      sources: { annual: { response: initial } },
    });
    const held = workspace.annual.load();
    expect(fixture.getSnapshot().annual).toBe(3);
    expect(markup(workspace.annual.getSnapshot().response!)).toBe(
      historyBefore,
    );
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
    expect(changeFor(captured)).toEqual(changeBefore);
    expect(changeMarkup(captured)).toBe(calculatedBefore);
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
      { ...request, schemaVersion: "5.0.0" },
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
    const late = await admitUiPacket(await held);
    expect(viewOf(late).balanceSheet.resolution.totalAssets).toMatchObject({
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

function historyFor(response: Awaited<ReturnType<typeof balanceSheetPacket>>) {
  return resolvePersonalSecAnnualCanonicalBalanceSheetHistory(
    response.evidence,
  );
}
function markup(response: Awaited<ReturnType<typeof balanceSheetPacket>>) {
  return renderToStaticMarkup(
    createElement(SecAnnualBalanceSheetHistory, {
      response,
      view: viewOf(response),
    }),
  );
}
function changeFor(response: Awaited<ReturnType<typeof balanceSheetPacket>>) {
  return comparePersonalSecAnnualBalanceSheetHistory(historyFor(response));
}
function changeMarkup(
  response: Awaited<ReturnType<typeof balanceSheetPacket>>,
) {
  return renderToStaticMarkup(
    createElement(SecAnnualBalanceSheetChange, {
      change: changeFor(response),
    }),
  );
}

describe("balance-sheet history cancellation and replacement", () => {
  it("retains dated history on Cancel, ignores a changed late packet and replaces only after a new explicit read", async () => {
    const first = await parseSecAnnualCanonicalResponse(
        await balanceSheetPacket(),
        request,
        new AbortController().signal,
      ),
      replacement = await parseSecAnnualCanonicalResponse(
        await balanceSheetPacket(true),
        request,
        new AbortController().signal,
      );
    if (!first || !replacement) throw new Error("Expected admitted v5 packets");
    let settle: ((value: NonNullable<typeof first>) => void) | undefined;
    const read = vi
      .fn<ManagedApi["annualReport"]>()
      .mockResolvedValueOnce(first)
      .mockImplementationOnce(
        () =>
          new Promise<typeof first>((resolve) => {
            settle = resolve;
          }),
      )
      .mockResolvedValueOnce(replacement);
    const fixture = await createFixture("annual-balance-sheet");
    const workspace = new ManagedWorkspace(
      { ...fixture.api, annualReport: read },
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
    workspace.note("listing-zero", "Change draft · Café 東京 📈  ");
    workspace.move("listing-zero", 1);
    const draft = workspace.coordinator.getSnapshot().draft;
    if (!draft) throw new Error("Expected watchlist draft");
    workspace.openWatchlistAnnual(draft.memberships[1]!);
    const selection = workspace.getSnapshot().research?.selection;
    if (!selection) throw new Error("Expected exact company selection");
    const model = workspace.annual;
    expect(read).not.toHaveBeenCalled();
    await model.load();
    const original = model.getSnapshot().response;
    if (!original) throw new Error("Expected original admitted packet");
    const before = markup(original);
    const changeBefore = changeFor(original);
    const calculatedBefore = changeMarkup(original);
    const report = prepareCompanyReport(
      selection,
      companySnapshotEvidence(
        selection,
        workspace.eod.getSnapshot(),
        model.getSnapshot(),
        workspace.filings.getSnapshot(),
      ),
      workspace.getResearchWatchlist(selection),
    );
    if (!report) throw new Error("Expected original captured report");
    const captured = formatCompanyReportDocument(report);
    if (!captured) throw new Error("Expected complete report document");
    const capturedBefore = captured.text;
    expect(changeBefore).toMatchObject({
      totalAssets: { difference: "99.625" },
      shareholdersEquity: { difference: "-200.125" },
    });
    expect(read).toHaveBeenCalledTimes(1);
    const pending = model.load();
    expect(model.getSnapshot().response).toBe(original);
    model.cancel();
    expect(model.getSnapshot().response).toBe(original);
    if (!settle) throw new Error("Expected held request");
    settle(replacement);
    await pending;
    expect(markup(model.getSnapshot().response!)).toBe(before);
    expect(changeMarkup(model.getSnapshot().response!)).toBe(calculatedBefore);
    expect(changeFor(model.getSnapshot().response!)).toEqual(changeBefore);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1]![1].aborted).toBe(true);
    await model.load();
    expect(read).toHaveBeenCalledTimes(3);
    expect(markup(model.getSnapshot().response!)).toContain("901.5");
    expect(changeFor(model.getSnapshot().response!)).toMatchObject({
      currentDate: "2025-12-31",
      priorDate: "2024-12-31",
      totalAssets: { difference: "98.375" },
      totalLiabilities: {
        status: "unavailable",
        prior: { reason: "no_report_date" },
      },
      shareholdersEquity: { difference: "777.375" },
    });
    expect(changeMarkup(model.getSnapshot().response!)).toContain(
      "98.375</span>",
    );
    expect(changeMarkup(model.getSnapshot().response!)).not.toContain(
      "99.625</span>",
    );
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(formatCompanyReportDocument(report)?.text).toBe(capturedBefore);
    expect(JSON.parse(capturedBefore)).toMatchObject({
      authoredResearch: { note: "Change draft · Café 東京 📈  " },
      sources: { annual: { response: original } },
    });
    expect(changeFor(original)).toEqual(changeBefore);
    expect(fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 1,
      save: 0,
      eod: 0,
      filings: 0,
      marketsEod: 0,
      calendar: 0,
      fed: 0,
    });
    expect(model.getSnapshot().response?.evidence.generation.completedAt).toBe(
      "2026-09-21T00:00:02.000Z",
    );
    model.close();
    expect(model.getSnapshot().response).toBeNull();
    workspace.sessionOwner.dispose();
  });
});
