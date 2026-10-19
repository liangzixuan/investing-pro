import type { ManagedFinancialScreenReportCapture } from "./managed-financial-screen";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
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
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";
import { MANAGED_RESEARCH_COVERAGE } from "./managed-research-eligibility";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../lib/test-personal-sec-annual-api-fixture";
import { parseSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import { filingsResponse } from "./sec-filings-fixture";
import { reviewWatchlistVersions } from "./managed-watchlist-review";

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

async function amdFixtureReport(selection: ManagedResearchSelection) {
  // Financial values remain invented; only the fixed public identity is reused.
  const packet = structuredClone(
    await financialReviewResponse(),
  ) as TestAnnualPacket;
  const cik = selection.cik!;
  packet.catalogSnapshotSha256 = selection.catalogSnapshotSha256;
  // The wire security projection intentionally excludes catalog graph-only fields.
  const { listing } = selection;
  packet.security = {
    country: listing.country,
    exchangeMic: listing.exchangeMic,
    issuerId: listing.issuerId,
    issuerName: listing.issuerName,
    listingId: listing.listingId,
    securityName: listing.securityName,
    symbol: listing.symbol,
    cik,
  };
  packet.evidence.cik = cik;
  for (const [key, source] of Object.entries(
    packet.evidence.generation.sources,
  ))
    source.sourceUrl =
      key === "companyFacts"
        ? `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`
        : `https://data.sec.gov/submissions/CIK${cik}.json`;
  for (const observation of packet.evidence.facts.observations)
    observation.filing.sourceUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${observation.accessionNumber}-index.htm`;
  const bound = await bindAnnualPacket(packet);
  const accepted = await parseSecAnnualCanonicalResponse(
    bound,
    {
      schemaVersion: "6.0.0",
      catalogSnapshotSha256: selection.catalogSnapshotSha256,
      listingId: listing.listingId,
      symbol: listing.symbol,
    },
    new AbortController().signal,
  );
  if (!accepted) throw new Error("Invented AMD workflow graph was refused");
  return accepted;
}

async function fixture(
  twoCompanies = false,
  selected: ManagedResearchSelection = eodSelection,
) {
  const original = twoCompanies
    ? await annualComparisonResponse("left")
    : await financialReviewResponse();
  const response =
    selected === eodSelection ? original : await amdFixtureReport(selected);
  const rightResponse = twoCompanies
    ? await annualComparisonResponse("right")
    : null;
  const listing = selected.listing;
  const digest = selected.catalogSnapshotSha256;
  const secondListing = {
    ...listing,
    listingId: "listing-one",
    issuerId: "issuer-one",
    issuerName: "One Company",
    securityId: "security-one",
    securityName: "One Class A",
    shareClassId: "class-one",
    symbol: "ONE",
  };
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
    status: vi
      .fn<ManagedApi["status"]>()
      .mockResolvedValue({ snapshot: { ...snapshot, snapshotSha256: digest } }),
    search: vi.fn<ManagedApi["search"]>().mockImplementation(unexpected),
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: digest,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing:
            listingId === listing.listingId
              ? listing
              : twoCompanies && listingId === secondListing.listingId
                ? secondListing
                : null,
        })),
      }),
    ),
    annualReport: vi
      .fn<ManagedApi["annualReport"]>()
      .mockImplementation((request) =>
        Promise.resolve(
          rightResponse && request.listingId === secondListing.listingId
            ? rightResponse
            : response,
        ),
      ),
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
  const options = {
    researchCoverage:
      selected === eodSelection
        ? inventedManagedResearchCoverage
        : MANAGED_RESEARCH_COVERAGE,
    financialScreenListingIds: twoCompanies
      ? [listing.listingId, secondListing.listingId]
      : [listing.listingId],
  };
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
    rightResponse,
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

type WorkflowFixture = Awaited<ReturnType<typeof fixture>>;
async function inspectAmdSources(
  f: WorkflowFixture,
  selected: ManagedResearchSelection,
  capture: ManagedFinancialScreenReportCapture,
) {
  f.workspace.openFinancialScreenReport(capture);
  await vi.waitFor(() =>
    expect(f.workspace.annual.getSnapshot().checkingSeed).toBe(false),
  );
  const originalGeneration = capture.response.evidence.generation;
  expect(f.workspace.annual.getSnapshot()).toMatchObject({
    supported: true,
    responseOrigin: "financial-screen",
  });
  expect(
    f.workspace.annual.getSnapshot().response?.evidence.generation,
  ).toEqual(originalGeneration);
  expect(f.api.annualReport).toHaveBeenCalledOnce();
  const firstVisit = f.workspace.getSnapshot().research!;
  await f.workspace.requestResearchSource(firstVisit, "eod");
  expect(f.workspace.eod.hasPriceCoverage(selected.listing)).toBe(false);
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  f.workspace.switchToFilings();
  expect(f.workspace.filings.getSnapshot().supported).toBe(true);
  expect(f.api.recentFilings).not.toHaveBeenCalled();
  const expectedFilings = filingsResponse(2, "available", selected);
  vi.mocked(f.api.recentFilings).mockResolvedValueOnce(expectedFilings);
  await f.workspace.requestResearchSource(
    f.workspace.getSnapshot().research!,
    "filings",
  );
  const filings = f.workspace.filings.getSnapshot().response!;
  expect(filings.security.cik).toBe(selected.cik);
  expect(filings.issuer.filings).toHaveLength(2);
  expect(filings.window).toEqual(expectedFilings.window);
  expect(filings.issuer.fetchedAt).toBe(expectedFilings.issuer.fetchedAt);
  expect(filings.issuer.sourceUrl).toBe(expectedFilings.issuer.sourceUrl);
  expect(filings.issuer.filings[0]!.sourceUrl).toBe(
    expectedFilings.issuer.filings[0]!.sourceUrl,
  );
  expect(f.api.recentFilings).toHaveBeenCalledOnce();
  f.workspace.switchToAnnual();
}
async function saveAmdAnnualNote(
  f: WorkflowFixture,
  selected: ManagedResearchSelection,
) {
  const visit = f.workspace.getSnapshot().research!;
  const beforePreview = f.workspace.coordinator.getSnapshot().draft!;
  const proposal = f.workspace.prepareFinancialReview(
    visit.selection,
    f.workspace.annual.getSnapshot().response!,
    ["operatingIncome"],
  );
  expect(proposal.preview).not.toBeNull();
  const preview = proposal.preview!;
  expect(preview.note).toContain("AMD");
  expect(preview.note).toContain(selected.cik);
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(beforePreview);
  expect(f.workspace.appendFinancialReview(preview).appended).toBe(true);
  const saveState = f.workspace.coordinator.getSnapshot();
  const review = reviewWatchlistVersions(
    saveState.saved!.payload,
    saveState.draft!,
  );
  expect(review.entries[0]).toMatchObject({
    listingId: selected.listing.listingId,
    noteChanged: true,
    identityChanged: false,
  });
  expect(f.api.save).not.toHaveBeenCalled();
  await f.workspace.coordinator.save();
  expect(f.api.save).toHaveBeenCalledOnce();
  expect(f.stored().payload.memberships[0]!.note).toBe(preview.note);
}

describe("financial screening through company research and Save", () => {
  it("connects the qualified AMD identity to independent sources, cited draft review, Save and retained Back using invented financial values", async () => {
    const entry = MANAGED_RESEARCH_COVERAGE.listings.find(
      (row) => row.listing.symbol === "AMD",
    )!;
    const selected: ManagedResearchSelection = {
      ...entry,
      catalogSnapshotSha256: MANAGED_RESEARCH_COVERAGE.catalogSnapshotSha256,
      origin: "screening",
    };
    const f = await fixture(false, selected);
    const independentDrafts = [
      f.workspace.followups.coordinator.getSnapshot().draft,
      f.workspace.portfolio.coordinator.getSnapshot().draft,
    ];
    const { screen, capture } = await runScreen(f);
    screen.toggleShortlist(screen.getSnapshot(), capture.row);
    const selectedMembers = screen.getSnapshot().selected;
    const shortlist = screen.getSnapshot().shortlist;
    await inspectAmdSources(f, selected, capture);
    await saveAmdAnnualNote(f, selected);
    f.workspace.closeResearch();
    expect(f.workspace.getSnapshot().view).toBe("discover");
    expect(screen.getSnapshot().run).toBe(capture.run);
    expect(screen.getSnapshot().criteria).toBe(capture.run.criteria);
    expect(screen.getSnapshot().selected).toBe(selectedMembers);
    expect(screen.getSnapshot().selected[0]).toBe(capture.row.member);
    expect(screen.getSnapshot().shortlist).toBe(shortlist);
    expect(shortlist[0]).toBe(capture.row);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
      independentDrafts[0],
    );
    expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBe(
      independentDrafts[1],
    );
    expect(f.api.annualReport).toHaveBeenCalledOnce();
    expect(f.api.eodHistory).not.toHaveBeenCalled();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(f.api.savePortfolio).not.toHaveBeenCalled();
  });
  it("keeps a two-company statement comparison and all independent drafts through either research visit without another Annual read", async () => {
    const f = await fixture(true);
    const screen = f.workspace.financialScreen;
    await screen.loadUniverse(screen.getSnapshot());
    const drafts = [
      f.workspace.coordinator.getSnapshot().draft,
      f.workspace.followups.coordinator.getSnapshot().draft,
      f.workspace.portfolio.coordinator.getSnapshot().draft,
    ];
    vi.useFakeTimers({
      toFake: ["Date", "performance", "setTimeout", "clearTimeout"],
    });
    vi.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));
    try {
      const running = screen.run(screen.getSnapshot());
      await vi.advanceTimersByTimeAsync(0);
      expect(f.api.annualReport).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(19_999);
      expect(f.api.annualReport).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1);
      await running;
      expect(f.api.annualReport).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
    const run = screen.getSnapshot().run!;
    const [left, right] = run.rows;
    expect(left!.report!.response).toEqual(f.response);
    expect(right!.report!.response).toEqual(f.rightResponse);
    expect(left!.report!.response!.evidence.target).toMatchObject({
      status: "target",
      reportDate: "2025-12-31",
    });
    expect(right!.report!.response!.evidence.target).toMatchObject({
      status: "target",
      reportDate: "2025-06-30",
    });
    screen.selectComparison(screen.getSnapshot(), "left", left!);
    screen.selectComparison(screen.getSnapshot(), "right", right!);
    const pair = screen.getSnapshot().comparison;
    expect(pair).toEqual({ left, right });
    screen.toggleShortlist(screen.getSnapshot(), right!);
    const criteria = screen.getSnapshot().criteria;
    for (const row of [right!, left!]) {
      f.workspace.openFinancialScreenReport({
        run,
        row,
        response: row.report!.response!,
      });
      await vi.waitFor(() =>
        expect(f.workspace.annual.getSnapshot().checkingSeed).toBe(false),
      );
      expect(
        f.workspace.getSnapshot().research!.selection.listing.listingId,
      ).toBe(row.member.listing.listingId);
      expect(f.workspace.annual.getSnapshot().response).toEqual(
        row.report!.response,
      );
      expect(f.workspace.annual.getSnapshot().responseOrigin).toBe(
        "financial-screen",
      );
      expect(f.api.annualReport).toHaveBeenCalledTimes(2);
      f.workspace.closeResearch();
      expect(f.workspace.getSnapshot().view).toBe("discover");
      expect(screen.getSnapshot().run).toBe(run);
      expect(screen.getSnapshot().comparison).toBe(pair);
      expect(screen.getSnapshot().criteria).toBe(criteria);
      expect(screen.getSnapshot().shortlist).toEqual([right]);
      expect([
        f.workspace.coordinator.getSnapshot().draft,
        f.workspace.followups.coordinator.getSnapshot().draft,
        f.workspace.portfolio.coordinator.getSnapshot().draft,
      ]).toEqual(drafts);
    }
    for (const request of [
      f.api.save,
      f.api.saveFollowups,
      f.api.savePortfolio,
      f.api.eodHistory,
      f.api.recentFilings,
    ])
      expect(request).not.toHaveBeenCalled();
  });
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
      { ...f.options, researchCoverage: inventedManagedResearchCoverage },
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
