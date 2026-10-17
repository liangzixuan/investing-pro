import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
  ManagedResearchFollowupsDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import type { TrialSession } from "./session";
import { ManagedWorkspace } from "./managed-workspace";
import { financialReviewResponse } from "./test-canonical-financial-review-fixture";
import { eodSelection } from "./eod-history-fixture";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import { prepareCompanyReport } from "./managed-company-report";
import { formatCompanyReportDocument } from "./managed-company-report-document";

const digest = eodSelection.catalogSnapshotSha256;
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented-screen-workspace",
  catalogVersion: "invented-v1",
  acquiredAt: "2026-09-19T00:00:00.000Z",
  generatedAt: "2026-09-20T00:00:00.000Z",
  asOf: "2026-09-20T00:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented engineering cohort, not market coverage",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 1,
    activeListings: 1,
    admittedSourceRecords: 1,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 1,
    providerMappings: 1,
    quarantinedSourceRecords: 0,
    sourceRecords: 1,
    staleSourceRecords: 0,
    shareClasses: 1,
    totalSecurities: 1,
    unsupportedSourceRecords: 0,
  },
};
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.sessionOwner.dispose();
  vi.restoreAllMocks();
});

async function fixture() {
  const response = await financialReviewResponse();
  const listing = eodSelection.listing;
  let stored: { version: number; payload: MainWatchlistPayload } = {
    version: 1,
    payload: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: digest,
      memberships: [{ ...listing, note: "Saved original thesis" }],
    } satisfies MainWatchlistPayload,
  };
  const followups: ManagedResearchFollowupsDto = {
    version: 1,
    payload: {
      schemaVersion: 1,
      entries: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          catalogSnapshotSha256: digest,
          listing,
          check: "Check the next filing",
          dueOn: "2026-10-20",
          status: "open",
          completedOn: null,
          result: "",
        },
      ],
    },
  };
  const unexpected = () =>
    Promise.reject(new Error("Unexpected unrelated source or save request"));
  const api: ManagedApi = {
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    search: vi.fn<ManagedApi["search"]>().mockImplementation(unexpected),
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: digest,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: listingId === listing.listingId ? listing : null,
        })),
      }),
    ),
    annualReport: vi
      .fn<ManagedApi["annualReport"]>()
      .mockResolvedValue(response),
    eodHistory: vi
      .fn<ManagedApi["eodHistory"]>()
      .mockImplementation(unexpected),
    recentFilings: vi
      .fn<ManagedApi["recentFilings"]>()
      .mockImplementation(unexpected),
    monetaryAnnouncements: vi
      .fn<ManagedApi["monetaryAnnouncements"]>()
      .mockImplementation(unexpected),
    economicCalendar: vi
      .fn<ManagedApi["economicCalendar"]>()
      .mockImplementation(unexpected),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockImplementation(() => Promise.resolve(structuredClone(stored))),
    save: vi.fn<ManagedApi["save"]>().mockImplementation((command) => {
      stored = {
        version: command.expectedVersion + 1,
        payload: structuredClone(command.payload),
      };
      return Promise.resolve({ ...structuredClone(stored), replayed: false });
    }),
    loadFollowups: vi
      .fn<ManagedApi["loadFollowups"]>()
      .mockResolvedValue(followups),
    saveFollowups: vi
      .fn<ManagedApi["saveFollowups"]>()
      .mockImplementation(unexpected),
    loadPortfolio: vi
      .fn<ManagedApi["loadPortfolio"]>()
      .mockResolvedValue({ version: 0, payload: null }),
    savePortfolio: vi
      .fn<ManagedApi["savePortfolio"]>()
      .mockImplementation(unexpected),
  };
  const session: TrialSession = {
    userId: "invented-screen-user",
    sessionId: "invented-screen-session",
    getToken: vi.fn(),
    signOut: vi.fn<TrialSession["signOut"]>().mockResolvedValue(),
  };
  const options = { financialScreenListingIds: [listing.listingId] };
  const workspace = new ManagedWorkspace(api, session, undefined, options);
  owners.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  await workspace.followups.coordinator.load();
  await workspace.portfolio.coordinator.load();
  workspace.note(listing.listingId, "Unsaved café 東京 research");
  workspace.followups.edit(
    workspace.followups.coordinator.getSnapshot().draft!.entries[0]!,
    "check",
    "Unsaved independent follow-up",
  );
  workspace.portfolio.start("2026-10-01", "1000.00");
  workspace.setView("discover");
  return {
    workspace,
    api,
    session,
    options,
    response,
    listing,
    stored: () => stored,
  };
}

async function runScreen(f: Awaited<ReturnType<typeof fixture>>) {
  const screen = f.workspace.financialScreen;
  await screen.loadUniverse(screen.getSnapshot());
  screen.setCriteria(screen.getSnapshot(), {
    clauses: [
      { field: "operatingCashFlow", operator: "gte", value: "120.125" },
    ],
    sort: { field: "operatingCashFlow", direction: "desc" },
  });
  await screen.run(screen.getSnapshot());
  const run = screen.getSnapshot().run!;
  const row = run.rows[0]!;
  expect(row.evaluation?.match).toBe("match");
  expect(row.evaluation?.metrics.operatingCashFlow).toMatchObject({
    status: "available",
    value: "120.125",
  });
  return { screen, capture: { run, row, response: row.report!.response! } };
}

describe("financial screening through company research and Save", () => {
  it("adds a screened company to the watchlist only through the explicit company action", async () => {
    const f = await fixture();
    f.workspace.remove(f.listing.listingId);
    const before = f.workspace.coordinator.getSnapshot().draft;
    const followups = f.workspace.followups.coordinator.getSnapshot().draft;
    const portfolio = f.workspace.portfolio.coordinator.getSnapshot().draft;
    const { capture } = await runScreen(f);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    f.workspace.openFinancialScreenReport(capture);
    await vi.waitFor(() =>
      expect(f.workspace.annual.getSnapshot().checkingSeed).toBe(false),
    );
    const selection = f.workspace.getSnapshot().research!.selection;
    expect(f.workspace.getResearchWatchlist(selection)).toMatchObject({
      canAdd: true,
      member: null,
    });
    f.workspace.addResearchToWatchlist(selection);
    expect(f.workspace.coordinator.getSnapshot().draft!.memberships).toEqual([
      { ...f.listing, note: "" },
    ]);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
      followups,
    );
    expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBe(
      portfolio,
    );
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.api.annualReport).toHaveBeenCalledOnce();
  });

  it("runs explicitly, inspects the captured source, shortlists, visits and returns with all three drafts", async () => {
    const f = await fixture();
    const drafts = [
      f.workspace.coordinator.getSnapshot().draft,
      f.workspace.followups.coordinator.getSnapshot().draft,
      f.workspace.portfolio.coordinator.getSnapshot().draft,
    ];
    expect(f.api.annualReport).not.toHaveBeenCalled();
    const priorIdentityReads = vi.mocked(f.api.resolve).mock.calls.length;
    const { screen, capture } = await runScreen(f);
    expect(f.api.resolve).toHaveBeenCalledTimes(priorIdentityReads + 1);
    expect(f.api.annualReport).toHaveBeenCalledOnce();
    expect(capture.response.evidence.generation).toEqual(
      f.response.evidence.generation,
    );
    screen.toggleShortlist(screen.getSnapshot(), capture.row);
    f.workspace.openFinancialScreenReport(capture);
    await vi.waitFor(() =>
      expect(f.workspace.annual.getSnapshot().checkingSeed).toBe(false),
    );
    const visit = f.workspace.getSnapshot().research!;
    expect(visit.selection.origin).toBe("screening");
    expect(f.workspace.annual.getSnapshot().responseOrigin).toBe(
      "financial-screen",
    );
    expect(f.workspace.annual.getSnapshot().response).toEqual(capture.response);
    expect(f.api.annualReport).toHaveBeenCalledOnce();
    expect([
      f.workspace.coordinator.getSnapshot().draft,
      f.workspace.followups.coordinator.getSnapshot().draft,
      f.workspace.portfolio.coordinator.getSnapshot().draft,
    ]).toEqual(drafts);
    const preview = f.workspace.prepareFinancialReview(
      visit.selection,
      f.workspace.annual.getSnapshot().response!,
      ["operatingIncome"],
    ).preview!;
    expect(preview).not.toBeNull();
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(true);
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(false);
    const evidence = companySnapshotEvidence(
      visit.selection,
      f.workspace.eod.getSnapshot(),
      f.workspace.annual.getSnapshot(),
      f.workspace.filings.getSnapshot(),
    );
    const report = prepareCompanyReport(
      visit.selection,
      evidence,
      f.workspace.getResearchWatchlist(visit.selection),
    );
    const document = formatCompanyReportDocument(report!);
    expect(JSON.parse(document!.text)).toHaveProperty(
      "sources.annual.responseOrigin",
      "financial-screen",
    );
    expect(JSON.parse(document!.text)).toHaveProperty(
      "sources.annual.response",
      capture.response,
    );
    expect(f.api.save).not.toHaveBeenCalled();
    await f.workspace.coordinator.save();
    expect(f.api.save).toHaveBeenCalledOnce();
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
      drafts[1],
    );
    expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBe(
      drafts[2],
    );
    f.workspace.closeResearch();
    expect(f.workspace.getSnapshot().view).toBe("discover");
    expect(screen.getSnapshot().run).toBe(capture.run);
    expect(screen.getSnapshot().shortlist).toEqual([capture.row]);
    expect(screen.getSnapshot().criteria).toEqual(capture.run.criteria);
    expect(f.api.annualReport).toHaveBeenCalledOnce();
    const fresh = new ManagedWorkspace(
      f.api,
      { ...f.session, sessionId: "invented-fresh-screen-session" },
      undefined,
      f.options,
    );
    owners.push(fresh);
    await fresh.coordinator.load();
    expect(fresh.coordinator.getSnapshot().draft).toEqual(f.stored().payload);
    expect(fresh.coordinator.getSnapshot().draft!.memberships[0]!.note).toBe(
      preview.note,
    );
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(f.api.savePortfolio).not.toHaveBeenCalled();
    expect(f.api.eodHistory).not.toHaveBeenCalled();
    expect(f.api.recentFilings).not.toHaveBeenCalled();
  });

  it("rejects replaced, inactive and old-revision research captures without a read", async () => {
    const f = await fixture();
    const { screen, capture } = await runScreen(f);
    f.workspace.openFinancialScreenReport({
      ...capture,
      row: { ...capture.row },
    });
    expect(f.workspace.getSnapshot().research).toBeNull();
    f.workspace.setView("watchlist");
    f.workspace.openFinancialScreenReport(capture);
    expect(f.workspace.getSnapshot().research).toBeNull();
    f.workspace.setView("discover");
    screen.stageCriteria(screen.getSnapshot());
    screen.setCriteria(screen.getSnapshot(), capture.run.criteria);
    f.workspace.openFinancialScreenReport(capture);
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(f.api.annualReport).toHaveBeenCalledOnce();
  });
});
