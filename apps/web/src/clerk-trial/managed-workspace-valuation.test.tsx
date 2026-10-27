import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { TrialApiError } from "./api";
import { ManagedWorkspace } from "./managed-workspace";
import { eodSelection, eodResponse, eodRequest } from "./eod-history-fixture";
import { parseManagedEodHistoryResponse } from "@research-cockpit/contracts";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import {
  companyReportIsCurrent,
  prepareCompanyReport,
} from "./managed-company-report";
import {
  COMPANY_REPORT_VALUATION_MAX_BYTES,
  formatCompanyReportDocument,
  isCompanyReportDocument,
} from "./managed-company-report-document";
import { CompanyReportHtmlView } from "./CompanyReportHtmlView";
import { bindManagedBrowserUnload } from "./managed-browser-unload";

const digest = eodSelection.catalogSnapshotSha256;
const member = { ...eodSelection.listing, note: "Café 東京 📈 thesis" };
const other = {
  ...member,
  listingId: "listing-other",
  securityId: "security-other",
  shareClassId: "class-other",
  symbol: "OTHER",
  note: "Independent note",
};
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented-valuation",
  catalogVersion: "invented-v1",
  acquiredAt: "2026-09-19T00:00:00.000Z",
  generatedAt: "2026-09-20T00:00:00.000Z",
  asOf: "2026-09-20T00:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented engineering catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 2,
    activeListings: 2,
    admittedSourceRecords: 2,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 1,
    providerMappings: 2,
    quarantinedSourceRecords: 0,
    sourceRecords: 2,
    staleSourceRecords: 0,
    shareClasses: 2,
    totalSecurities: 2,
    unsupportedSourceRecords: 0,
  },
};
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of owners.splice(0)) workspace.sessionOwner.dispose();
});
async function fixture(withPrice = false) {
  let stored: { version: number; payload: MainWatchlistPayload } = {
    version: 1,
    payload: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: digest,
      memberships: [member, other],
    },
  };
  const unexpected = () =>
    Promise.reject(new Error("Unexpected source or unrelated storage request"));
  const api: ManagedApi = {
    interimReport: vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new Error("Unexpected interim read")),
    loadValuationAssumptions: vi
      .fn<ManagedApi["loadValuationAssumptions"]>()
      .mockRejectedValue(
        new Error("Unexpected invented valuation assumptions read"),
      ),
    saveValuationAssumptions: vi
      .fn<ManagedApi["saveValuationAssumptions"]>()
      .mockRejectedValue(
        new Error("Unexpected invented valuation assumptions write"),
      ),
    loadPortfolio: vi.fn().mockImplementation(unexpected),
    savePortfolio: vi.fn().mockImplementation(unexpected),
    loadFollowups: vi.fn().mockImplementation(unexpected),
    saveFollowups: vi.fn().mockImplementation(unexpected),
    annualReport: vi.fn().mockImplementation(unexpected),
    eodHistory: vi.fn().mockImplementation(unexpected),
    recentFilings: vi.fn().mockImplementation(unexpected),
    blsCalendar: vi.fn(),
    economicCalendar: vi.fn().mockImplementation(unexpected),
    monetaryAnnouncements: vi.fn().mockImplementation(unexpected),
    search: vi.fn().mockImplementation(unexpected),
    resolve: vi.fn().mockImplementation(unexpected),
    status: vi.fn().mockResolvedValue({ snapshot }),
    load: vi
      .fn()
      .mockImplementation(() => Promise.resolve(structuredClone(stored))),
    save: vi.fn<ManagedApi["save"]>().mockImplementation((command) => {
      stored = {
        version: command.expectedVersion + 1,
        payload: structuredClone(command.payload),
      };
      return Promise.resolve({ ...structuredClone(stored), replayed: false });
    }),
  };
  const session = {
    userId: "invented-valuation-user",
    sessionId: "invented-valuation-session",
    getToken: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  const workspace = new ManagedWorkspace(api, session, undefined, {
    ...(withPrice ? { priceCoverage: [eodSelection.listing] } : {}),
    researchCoverage: inventedManagedResearchCoverage,
  });
  owners.push(workspace);
  workspace.setView("watchlist");
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  const open = (listingId = member.listingId) =>
    workspace.openWatchlistAnnual(
      workspace.coordinator
        .getSnapshot()
        .draft!.memberships.find((row) => row.listingId === listingId)!,
    );
  open();
  const selection = () => workspace.getSnapshot().research!.selection;
  const evidence = () =>
    companySnapshotEvidence(
      selection(),
      workspace.eod.getSnapshot(),
      workspace.annual.getSnapshot(),
      workspace.filings.getSnapshot(),
      null,
    );
  const prepare = () =>
    workspace.prepareValuationNote(selection(), "dcf", "base");
  const report = () =>
    prepareCompanyReport(
      selection(),
      evidence(),
      workspace.getResearchWatchlist(selection()),
      () => new Date("2026-10-16T23:00:00.000Z"),
      workspace.valuation.getSnapshot().calculation,
    );
  const fill = () => {
    const v = workspace.valuation;
    for (const [key, value] of Object.entries({
      startingUnleveredCashFlowUsd: "100",
      enterpriseToEquityBridgeUsd: "100",
      dilutedShares: "10",
      waccPercent: "10",
      terminalGrowthPercent: "0",
    }))
      v.setDcfField(key as "waccPercent", value);
    for (const [key, value] of Object.entries({
      baseRevenue: "1000",
      cash: "100",
      debt: "200",
      dilutedShares: "100",
      discountRatePercent: "10",
    }))
      v.setExitField(key as "baseRevenue", value);
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
    return v.calculate()!;
  };
  const noSources = () => {
    for (const [key, fn] of Object.entries(api))
      if (!["load", "status", "save"].includes(key))
        expect(fn).not.toHaveBeenCalled();
  };
  return {
    workspace,
    api,
    session,
    open,
    selection,
    evidence,
    prepare,
    report,
    fill,
    noSources,
    stored: () => structuredClone(stored),
  };
}

describe("composed authored valuation workflow", () => {
  it("calculates both models, previews one scenario, appends once, saves and reopens the exact note without source calls", async () => {
    const f = await fixture();
    const original = f.workspace.coordinator.getSnapshot().draft;
    const capture = f.fill();
    expect(capture.dcfResult).toMatchObject({
      status: "available",
      scenarios: { base: { valuePerShareUsd: "140.00" } },
    });
    expect(capture.exitResult).toMatchObject({
      status: "available",
      scenarios: { base: { valuePerShare: "19.00" } },
    });
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(original);
    const preview = f.prepare().preview!;
    expect(preview).not.toBeNull();
    expect(preview.note.startsWith(`${member.note} `)).toBe(true);
    expect(preview.note).toContain("140.00");
    expect(f.workspace.appendValuationNote(preview).appended).toBe(true);
    expect(f.workspace.appendValuationNote(preview).appended).toBe(false);
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.workspace.canSavePayload()).toBe(true);
    await f.workspace.coordinator.save();
    expect(f.api.save).toHaveBeenCalledOnce();
    const reopened = new ManagedWorkspace(
      f.api,
      {
        ...f.session,
        sessionId: "invented-fresh-session",
      },
      undefined,
      { researchCoverage: inventedManagedResearchCoverage },
    );
    owners.push(reopened);
    await reopened.coordinator.load();
    expect(reopened.coordinator.getSnapshot().draft!.memberships).toEqual([
      { ...member, note: preview.note },
      other,
    ]);
    expect(reopened.valuation.getSnapshot().calculation).toBeNull();
    expect(reopened.valuation.hasDraft()).toBe(false);
    const report = f.report()!;
    const doc = formatCompanyReportDocument(report)!;
    expect(isCompanyReportDocument(doc)).toBe(true);
    const parsed: unknown = JSON.parse(doc.text);
    expect(parsed).toHaveProperty("schemaVersion", "6.0.0");
    expect(parsed).toHaveProperty("authoredResearch.note", preview.note);
    expect(parsed).toHaveProperty("valuation", capture);
    expect(parsed).toHaveProperty(
      "valuation.dcfResult.sensitivity.cells.length",
      25,
    );
    expect(parsed).toHaveProperty(
      "valuation.exitResult.sensitivity.cells.length",
      25,
    );
    expect(parsed).toHaveProperty("sources", {
      interim: { status: "not_loaded", lastAttemptFailed: false },
      price: { status: "not_loaded", lastAttemptFailed: false },
      annual: { status: "not_loaded", lastAttemptFailed: false },
      filings: { status: "not_loaded", lastAttemptFailed: false },
    });
    expect(
      renderToStaticMarkup(
        <CompanyReportHtmlView report={report} jsonText={doc.text} />,
      ),
    ).toContain("140.00");
    expect(f.workspace.coordinator.getSnapshot().dirty).toBe(false);
    expect(f.workspace.sessionOwner.getSnapshot()).toMatchObject({
      valuationInputs: true,
      needsLeaveReview: true,
    });
    f.noSources();
  });
  it.each([
    "edit",
    "note restore",
    "section round trip",
    "visit round trip",
    "pending navigation",
    "save",
    "retire",
  ] as const)("refuses a prepared append after %s", async (boundary) => {
    const f = await fixture();
    f.fill();
    const preview = f.prepare().preview!;
    expect(preview).not.toBeNull();
    if (boundary === "edit")
      f.workspace.valuation.setDcfField("waccPercent", "11");
    if (boundary === "note restore") {
      f.workspace.noteResearch(f.selection(), "changed");
      f.workspace.noteResearch(f.selection(), member.note);
    }
    if (boundary === "section round trip") {
      f.workspace.switchToEod();
      f.workspace.switchToAnnual();
    }
    if (boundary === "visit round trip") {
      f.workspace.closeResearch();
      f.open();
    }
    if (boundary === "pending navigation")
      f.workspace.setNavigationBlocked(true);
    if (boundary === "save") {
      f.workspace.noteResearch(f.selection(), "Another saved note");
      await f.workspace.coordinator.save();
    }
    if (boundary === "retire") f.workspace.sessionOwner.retire();
    const before = f.workspace.coordinator.getSnapshot().draft;
    expect(f.workspace.valuationNotePreviewIsCurrent(preview)).toBe(false);
    expect(f.workspace.appendValuationNote(preview).appended).toBe(false);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    f.noSources();
  });
  it("retains raw inputs through Back and another company, fences reports on edit and requires explicit ownership change", async () => {
    const f = await fixture();
    const capture = f.fill(),
      report = f.report()!;
    expect(
      companyReportIsCurrent(
        report,
        f.selection(),
        f.evidence(),
        f.workspace.getResearchWatchlist(f.selection()),
        capture,
      ),
    ).toBe(true);
    f.workspace.closeResearch();
    f.open(other.listingId);
    expect(f.workspace.valuation.getSnapshot()).toMatchObject({
      editable: false,
      calculation: null,
      owner: { listing: { symbol: member.symbol } },
    });
    expect(f.report()).toBeNull();
    f.workspace.closeResearch();
    f.open();
    expect(f.workspace.valuation.getSnapshot().calculation).toBe(capture);
    expect(
      companyReportIsCurrent(
        report,
        f.selection(),
        f.evidence(),
        f.workspace.getResearchWatchlist(f.selection()),
        capture,
      ),
    ).toBe(false);
    const current = f.report()!;
    f.workspace.valuation.setExitField("cash", "101");
    expect(
      companyReportIsCurrent(
        current,
        f.selection(),
        f.evidence(),
        f.workspace.getResearchWatchlist(f.selection()),
        f.workspace.valuation.getSnapshot().calculation,
      ),
    ).toBe(false);
    f.noSources();
  });
  it("refuses a preview in another workspace without consuming the owning workspace's action", async () => {
    const f = await fixture(),
      otherWorkspace = await fixture();
    f.fill();
    otherWorkspace.fill();
    const preview = f.prepare().preview!;
    expect(
      otherWorkspace.workspace.valuationNotePreviewIsCurrent(preview),
    ).toBe(false);
    expect(otherWorkspace.workspace.appendValuationNote(preview).appended).toBe(
      false,
    );
    expect(f.workspace.valuationNotePreviewIsCurrent(preview)).toBe(true);
    expect(f.workspace.appendValuationNote(preview).appended).toBe(true);
    expect(
      otherWorkspace.workspace.coordinator.getSnapshot().draft!.memberships[0]!
        .note,
    ).toBe(member.note);
  });
  it("never revives a prepared report after a batched note edit and restore", async () => {
    const f = await fixture();
    f.fill();
    const report = f.report()!;
    const selection = f.selection();
    f.workspace.noteResearch(selection, "Changed note");
    f.workspace.noteResearch(selection, member.note);
    expect(f.workspace.getResearchWatchlist(selection).member!.note).toBe(
      report.note,
    );
    expect(
      companyReportIsCurrent(
        report,
        selection,
        f.evidence(),
        f.workspace.getResearchWatchlist(selection),
        f.workspace.valuation.getSnapshot().calculation,
      ),
    ).toBe(false);
    expect(f.report()).not.toBeNull();
  });
  it("keeps both model refusals and exact invalid lexemes in reports; refuses an oversized valuation graph", async () => {
    const f = await fixture();
    f.workspace.valuation.setDcfField("forecastYears", "5e0");
    const capture = f.workspace.valuation.calculate()!;
    expect(capture.dcfResult.status).toBe("unavailable");
    expect(capture.exitResult.status).toBe("unavailable");
    expect(f.prepare().preview).toBeNull();
    const report = f.report()!,
      doc = formatCompanyReportDocument(report)!;
    expect(JSON.parse(doc.text) as unknown).toHaveProperty(
      "valuation.dcfDraft.forecastYears",
      "5e0",
    );
    expect(
      formatCompanyReportDocument({
        ...report,
        valuation: {
          ...capture,
          explanation: "x".repeat(
            COMPANY_REPORT_VALUATION_MAX_BYTES,
          ) as typeof capture.explanation,
        },
      }),
    ).toBeNull();
    f.noSources();
  });
  it("preserves the appended note through uncertain-save reconciliation using the original command", async () => {
    const f = await fixture();
    f.fill();
    const preview = f.prepare().preview!;
    f.workspace.appendValuationNote(preview);
    vi.mocked(f.api.save).mockRejectedValueOnce(
      new TrialApiError("commit_unknown"),
    );
    await f.workspace.coordinator.save();
    expect(f.workspace.coordinator.getSnapshot().uncertain).toBe(true);
    expect(f.prepare().preview).toBeNull();
    const command = vi.mocked(f.api.save).mock.calls[0]![0];
    vi.mocked(f.api.save).mockResolvedValueOnce({
      version: 2,
      payload: command.payload,
      replayed: true,
    });
    await f.workspace.coordinator.reconcile();
    expect(vi.mocked(f.api.save).mock.calls[1]![0]).toEqual(command);
    expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
      uncertain: false,
      draft: { memberships: [{ note: preview.note }, other] },
    });
    f.noSources();
  });
  it("warns before unload for unsaved inputs alone and clears inputs/results on sign-out", async () => {
    const f = await fixture(),
      target = new EventTarget();
    const unbind = bindManagedBrowserUnload(f.workspace.sessionOwner, target);
    const before = new Event("beforeunload", { cancelable: true });
    target.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);
    f.workspace.valuation.setDcfField("startingUnleveredCashFlowUsd", "123");
    expect(f.workspace.coordinator.getSnapshot().dirty).toBe(false);
    const dirty = new Event("beforeunload", { cancelable: true });
    target.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    await f.workspace.sessionOwner.signOut();
    expect(f.workspace.valuation.getSnapshot()).toMatchObject({
      retired: true,
      owner: null,
      calculation: null,
      dcfDraft: { startingUnleveredCashFlowUsd: "" },
    });
    const after = new Event("beforeunload", { cancelable: true });
    target.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
    expect(f.session.signOut).toHaveBeenCalledOnce();
    unbind();
    f.noSources();
  });
});

function datedPricePacket(lastClose = "110.000000000000000003") {
  const packet = parseManagedEodHistoryResponse(
    {
      ...eodResponse(),
      rows: [
        { date: "2026-09-17", close: "100.000000000000000001" },
        { date: "2026-09-18", close: "107.500000000000000002" },
        { date: "2026-09-19", close: lastClose },
      ],
    },
    eodRequest(),
  );
  if (!packet) throw new Error("Invented dated price packet was refused");
  return packet;
}
async function pricedFixture() {
  const f = await fixture(true);
  const calculation = f.fill();
  const packet = datedPricePacket();
  vi.mocked(f.api.eodHistory).mockResolvedValue(packet);
  f.workspace.switchToEod();
  await f.workspace.requestResearchSource(
    f.workspace.getSnapshot().research!,
    "eod",
  );
  const prepare = () =>
    f.workspace.prepareValuationNote(f.selection(), "dcf", "base", true);
  return { ...f, calculation, packet, prepare };
}
function pendingPrice() {
  let resolve!: (packet: ReturnType<typeof datedPricePacket>) => void;
  const promise = new Promise<ReturnType<typeof datedPricePacket>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe("composed authored valuation with explicitly dated Price", () => {
  it("opts in to a whole dated-comparison note, appends once, captures schema6, Reviews/Saves and reads the exact note in a fresh workspace", async () => {
    const f = await pricedFixture();
    const before = f.workspace.coordinator.getSnapshot().draft;
    const without = f.workspace.prepareValuationNote(
      f.selection(),
      "dcf",
      "base",
    );
    expect(without.preview!.note).not.toContain("110.000000000000000003");
    const prepared = f.prepare();
    expect(prepared.reason).toBeNull();
    const preview = prepared.preview!;
    expect(preview.note.startsWith(member.note + " ")).toBe(true);
    expect(preview.note).toContain("140.00");
    expect(preview.note).toContain("27.27%");
    expect(preview.note).toContain("110.000000000000000003");
    expect(preview.note).toContain("2026-09-19");
    expect([...preview.note].length).toBeLessThanOrEqual(2000);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(f.workspace.appendValuationNote(preview).appended).toBe(true);
    expect(f.workspace.appendValuationNote(preview).appended).toBe(false);
    const report = f.report()!;
    expect(report.valuation).toBe(f.calculation);
    const doc = formatCompanyReportDocument(report)!;
    expect(isCompanyReportDocument(doc)).toBe(true);
    const parsed: unknown = JSON.parse(doc.text);
    expect(parsed).toHaveProperty("schemaVersion", "6.0.0");
    expect(parsed).toHaveProperty("authoredResearch.note", preview.note);
    expect(parsed).toHaveProperty("sources.price.response", f.packet);
    expect(parsed).toHaveProperty("valuationPrice.reference", {
      date: "2026-09-19",
      rawCloseUsd: "110.000000000000000003",
      showingPrevious: false,
      sourcePath: "sources.price.response",
    });
    expect(parsed).not.toHaveProperty("valuationPrice.calculation");
    expect(parsed).not.toHaveProperty("valuationPrice.selection");
    expect(parsed).not.toHaveProperty("valuationPrice.reference.response");
    expect(doc.text.split(JSON.stringify(f.packet))).toHaveLength(2);
    expect(report.valuationPrice!.rows).toHaveLength(6);
    expect(
      report.valuationPrice!.rows.map((row) => `${row.model}:${row.scenario}`),
    ).toEqual([
      "dcf:conservative",
      "dcf:base",
      "dcf:expansion",
      "exit:conservative",
      "exit:base",
      "exit:expansion",
    ]);
    expect(
      report.valuationPrice!.rows.find(
        (row) => row.model === "dcf" && row.scenario === "base",
      ),
    ).toMatchObject({
      modelValuePerShareUsd: "140.00",
      result: { status: "available", differencePercent: "27.27" },
    });
    expect(
      report.valuationPrice!.rows.find(
        (row) => row.model === "exit" && row.scenario === "base",
      ),
    ).toMatchObject({
      modelValuePerShareUsd: "19.00",
      result: { status: "available", differencePercent: "-82.73" },
    });
    const html = renderToStaticMarkup(
      <CompanyReportHtmlView report={report} jsonText={doc.text} />,
    );
    expect(html).toContain("110.000000000000000003");
    expect(html).toContain("2026-09-19");
    expect(html).toContain("27.27");
    expect(html).toContain("-82.73");
    const $ = load(html);
    const comparison = $(".managed-valuation-price-context");
    expect(comparison).toHaveLength(1);
    expect(comparison.find("h3").text()).toBe(
      "Authored scenarios versus dated raw close",
    );
    expect(comparison.find("tbody tr")).toHaveLength(6);
    expect(comparison.find("button,input,select,textarea")).toHaveLength(0);
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.api.eodHistory).toHaveBeenCalledOnce();
    f.workspace.closeResearch();
    f.workspace.setView("watchlist");
    expect(f.workspace.valuation.getSnapshot()).toMatchObject({
      context: null,
      calculation: null,
      dcfDraft: { startingUnleveredCashFlowUsd: "100" },
      exitDraft: { cash: "100" },
    });
    expect(f.workspace.coordinator.getSnapshot().draft!.memberships[1]).toEqual(
      other,
    );
    await f.workspace.coordinator.save();
    const fresh = new ManagedWorkspace(
      f.api,
      {
        ...f.session,
        sessionId: "dated-price-fresh-session",
      },
      undefined,
      { researchCoverage: inventedManagedResearchCoverage },
    );
    owners.push(fresh);
    await fresh.coordinator.load();
    expect(fresh.coordinator.getSnapshot().draft!.memberships).toEqual([
      { ...member, note: preview.note },
      other,
    ]);
    expect(fresh.valuation.getSnapshot().calculation).toBeNull();
    expect(f.api.save).toHaveBeenCalledOnce();
    expect(f.api.eodHistory).toHaveBeenCalledOnce();
    for (const key of [
      "annualReport",
      "recentFilings",
      "economicCalendar",
      "monetaryAnnouncements",
      "loadPortfolio",
      "savePortfolio",
      "loadFollowups",
      "saveFollowups",
    ] as const)
      expect(f.api[key]).not.toHaveBeenCalled();
  });
  it.each([
    "model edit restore",
    "range edit restore",
    "navigation round trip",
    "retirement",
  ] as const)(
    "does not renew a dated note handle after %s",
    async (boundary) => {
      const f = await pricedFixture();
      const preview = f.prepare().preview!;
      const report = f.report()!;
      if (boundary === "model edit restore") {
        f.workspace.valuation.setDcfField("waccPercent", "11");
        f.workspace.valuation.setDcfField("waccPercent", "10");
        f.fill();
      }
      if (boundary === "range edit restore") {
        f.workspace.eod.selectRange("1y");
        f.workspace.eod.selectRange("1m");
      }
      if (boundary === "navigation round trip") {
        f.workspace.switchToAnnual();
        f.workspace.switchToEod();
      }
      if (boundary === "retirement") f.workspace.sessionOwner.retire();
      expect(f.workspace.valuationNotePreviewIsCurrent(preview)).toBe(false);
      expect(f.workspace.appendValuationNote(preview).appended).toBe(false);
      if (boundary !== "retirement" && boundary !== "navigation round trip")
        expect(
          companyReportIsCurrent(
            report,
            f.selection(),
            f.evidence(),
            f.workspace.getResearchWatchlist(f.selection()),
            f.workspace.valuation.getSnapshot().calculation,
          ),
        ).toBe(false);
      expect(f.api.eodHistory).toHaveBeenCalledOnce();
    },
  );
  it("retires old handles on refresh cancellation and refuses a late packet without changing the original source or authored draft", async () => {
    const f = await pricedFixture();
    const preview = f.prepare().preview!;
    const report = f.report()!;
    const waiting = pendingPrice();
    vi.mocked(f.api.eodHistory).mockReturnValueOnce(waiting.promise);
    const visit = f.workspace.getSnapshot().research!;
    const refresh = f.workspace.requestResearchSource(visit, "eod");
    expect(f.workspace.eod.getSnapshot().running).toBe(true);
    expect(f.workspace.valuationNotePreviewIsCurrent(preview)).toBe(false);
    f.workspace.cancelResearchSource(
      f.workspace.getSnapshot().research!,
      "eod",
    );
    waiting.resolve(datedPricePacket("999.75"));
    await refresh;
    expect(f.workspace.eod.getSnapshot().response).toBe(f.packet);
    expect(f.workspace.eod.getSnapshot().showingPrevious).toBe(true);
    expect(f.workspace.appendValuationNote(preview).appended).toBe(false);
    expect(
      companyReportIsCurrent(
        report,
        f.selection(),
        f.evidence(),
        f.workspace.getResearchWatchlist(f.selection()),
        f.calculation,
      ),
    ).toBe(false);
    expect(f.workspace.coordinator.getSnapshot().draft!.memberships).toEqual([
      member,
      other,
    ]);
    expect(f.api.eodHistory).toHaveBeenCalledTimes(2);
  });
  it("keeps the original dates after a failed refresh and fences an equal-valued replacement", async () => {
    const f = await pricedFixture();
    const preview = f.prepare().preview!;
    vi.mocked(f.api.eodHistory).mockRejectedValueOnce(
      new TrialApiError("unavailable"),
    );
    await f.workspace.requestResearchSource(
      f.workspace.getSnapshot().research!,
      "eod",
    );
    expect(f.workspace.eod.getSnapshot().response).toBe(f.packet);
    expect(f.workspace.eod.getSnapshot().showingPrevious).toBe(true);
    expect(f.workspace.appendValuationNote(preview).appended).toBe(false);
    const retained = f.report()!;
    expect(retained.valuationPrice!.reference).toMatchObject({
      date: "2026-09-19",
      showingPrevious: true,
    });
    const previous = f.prepare().preview!;
    expect(previous.note).toMatch(/previous|retained/iu);
    vi.mocked(f.api.eodHistory).mockResolvedValueOnce(datedPricePacket());
    await f.workspace.requestResearchSource(
      f.workspace.getSnapshot().research!,
      "eod",
    );
    expect(f.workspace.appendValuationNote(previous).appended).toBe(false);
    expect(f.workspace.eod.getSnapshot().response).not.toBe(f.packet);
    expect(f.workspace.eod.getSnapshot().showingPrevious).toBe(false);
    expect(f.api.eodHistory).toHaveBeenCalledTimes(3);
  });
});
