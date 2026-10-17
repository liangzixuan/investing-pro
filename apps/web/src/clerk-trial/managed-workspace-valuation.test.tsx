import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { TrialApiError } from "./api";
import { ManagedWorkspace } from "./managed-workspace";
import { eodSelection } from "./eod-history-fixture";
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
async function fixture() {
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
    loadPortfolio: vi.fn().mockImplementation(unexpected),
    savePortfolio: vi.fn().mockImplementation(unexpected),
    loadFollowups: vi.fn().mockImplementation(unexpected),
    saveFollowups: vi.fn().mockImplementation(unexpected),
    annualReport: vi.fn().mockImplementation(unexpected),
    eodHistory: vi.fn().mockImplementation(unexpected),
    recentFilings: vi.fn().mockImplementation(unexpected),
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
  const workspace = new ManagedWorkspace(api, session);
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
    const reopened = new ManagedWorkspace(f.api, {
      ...f.session,
      sessionId: "invented-fresh-session",
    });
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
    expect(parsed).toHaveProperty("schemaVersion", "4.0.0");
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
