import { TrialApiError } from "./api";
import {
  prepareScreenShortlistWatchlist,
  isScreenShortlistWatchlistCurrent,
  applyScreenShortlistWatchlist,
  type ScreenShortlistWatchlistPreview,
} from "./managed-screen-shortlist-watchlist";
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
    cpiHeadlines: vi
      .fn<ManagedApi["cpiHeadlines"]>()
      .mockRejectedValue(new Error("Unexpected CPI headlines read")),
    interimReport: vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new Error("Unexpected interim read")),
    loadValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions read"),
      ),
    saveValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions write"),
      ),
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
    blsCalendar: vi.fn(),
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
      null,
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

async function shortlistFixture(twoCompanies = false) {
  const f = await fixture(twoCompanies);
  const screen = f.workspace.financialScreen;
  await screen.loadUniverse(screen.getSnapshot());
  if (twoCompanies) {
    vi.useFakeTimers({
      toFake: ["Date", "performance", "setTimeout", "clearTimeout"],
    });
    vi.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));
    try {
      const running = screen.run(screen.getSnapshot());
      await vi.advanceTimersByTimeAsync(20_000);
      await running;
    } finally {
      vi.useRealTimers();
    }
  } else await screen.run(screen.getSnapshot());
  const run = screen.getSnapshot().run!;
  for (const row of [...run.rows].reverse())
    screen.toggleShortlist(screen.getSnapshot(), row);
  return { ...f, screen, run };
}
function transferRequestCounts(f: WorkflowFixture) {
  return [
    f.api.status,
    f.api.resolve,
    f.api.annualReport,
    f.api.load,
    f.api.save,
    f.api.eodHistory,
    f.api.recentFilings,
    f.api.loadFollowups,
    f.api.saveFollowups,
    f.api.loadPortfolio,
    f.api.savePortfolio,
  ].map((call) => vi.mocked(call).mock.calls.length);
}
function requireShortlistPreview(workspace: ManagedWorkspace) {
  const result = prepareScreenShortlistWatchlist(workspace);
  expect(result.reason).toBe("");
  expect(result.preview).not.toBeNull();
  return result.preview!;
}
function assertTransferRefused(
  workspace: ManagedWorkspace,
  preview: ScreenShortlistWatchlistPreview,
) {
  const before = workspace.coordinator.getSnapshot();
  expect(isScreenShortlistWatchlistCurrent(workspace, preview)).toBe(false);
  expect(applyScreenShortlistWatchlist(workspace, preview).added).toBe(false);
  expect(workspace.coordinator.getSnapshot()).toBe(before);
}

describe("financial-screen shortlist Watchlist draft transfer", () => {
  it("reviews every exact listing, skips existing membership and requires a separate explicit Save", async () => {
    const f = await shortlistFixture(true);
    const before = f.workspace.coordinator.getSnapshot().draft!;
    const otherDrafts = [
      f.workspace.followups.coordinator.getSnapshot().draft,
      f.workspace.portfolio.coordinator.getSnapshot().draft,
    ];
    const counts = transferRequestCounts(f);
    const preview = requireShortlistPreview(f.workspace);
    expect(preview).toEqual({
      rows: f.screen.getSnapshot().shortlist.map((row) => ({
        listing: row.member.listing,
        status:
          row.member.listing.listingId === f.listing.listingId
            ? "existing"
            : "add",
      })),
      additions: 1,
      runStartedAt: f.run.startedAt,
      runCompletedAt: f.run.completedAt,
    });
    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview.rows)).toBe(true);
    expect(Object.isFrozen(preview.rows[0]!.listing)).toBe(true);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(isScreenShortlistWatchlistCurrent(f.workspace, preview)).toBe(true);
    const replace = vi.spyOn(f.workspace.coordinator, "replaceDraft");
    expect(applyScreenShortlistWatchlist(f.workspace, preview).added).toBe(
      true,
    );
    expect(replace).toHaveBeenCalledOnce();
    expect(f.workspace.coordinator.getSnapshot().draft!.memberships).toEqual([
      ...before.memberships,
      { ...preview.rows[0]!.listing, note: "" },
    ]);
    expect(transferRequestCounts(f)).toEqual(counts);
    expect([
      f.workspace.followups.coordinator.getSnapshot().draft,
      f.workspace.portfolio.coordinator.getSnapshot().draft,
    ]).toEqual(otherDrafts);
    assertTransferRefused(f.workspace, preview);
    await f.workspace.coordinator.save();
    expect(f.api.save).toHaveBeenCalledOnce();
    expect(f.stored().payload).toEqual(
      f.workspace.coordinator.getSnapshot().draft,
    );
    expect(f.stored().version).toBe(2);
  });
  it("appends missing members in shortlist order and retains invalid raw notes and current order", async () => {
    const f = await shortlistFixture(true);
    const draft = f.workspace.coordinator.getSnapshot().draft!;
    const raw = {
      ...f.listing,
      listingId: "listing-unrelated",
      note: "  raw\u0000 note  ",
    };
    f.workspace.coordinator.replaceDraft({ ...draft, memberships: [raw] });
    const preview = requireShortlistPreview(f.workspace);
    expect(preview.additions).toBe(2);
    expect(applyScreenShortlistWatchlist(f.workspace, preview).added).toBe(
      true,
    );
    expect(f.workspace.coordinator.getSnapshot().draft!.memberships).toEqual([
      raw,
      ...preview.rows.map((row) => ({ ...row.listing, note: "" })),
    ]);
    expect(f.workspace.canSavePayload()).toBe(false);
    expect(f.api.save).not.toHaveBeenCalled();
  });
  it("does not write an all-existing shortlist and consumes its review", async () => {
    const f = await shortlistFixture();
    const before = f.workspace.coordinator.getSnapshot();
    const preview = requireShortlistPreview(f.workspace);
    expect(preview.additions).toBe(0);
    expect(preview.rows[0]!.status).toBe("existing");
    expect(applyScreenShortlistWatchlist(f.workspace, preview).added).toBe(
      false,
    );
    expect(f.workspace.coordinator.getSnapshot()).toBe(before);
    assertTransferRefused(f.workspace, preview);
  });
  it.each([
    "country",
    "exchangeMic",
    "instrumentType",
    "issuerId",
    "issuerName",
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "symbol",
  ] as const)(
    "refuses the whole proposal for changed existing %s identity",
    async (field) => {
      const f = await shortlistFixture(true);
      const draft = f.workspace.coordinator.getSnapshot().draft!;
      f.workspace.coordinator.replaceDraft({
        ...draft,
        memberships: [{ ...draft.memberships[0]!, [field]: "changed" }],
      });
      const before = f.workspace.coordinator.getSnapshot();
      const refused = prepareScreenShortlistWatchlist(f.workspace);
      expect(refused.preview).toBeNull();
      expect(refused.reason).toContain("identities");
      expect(f.workspace.coordinator.getSnapshot()).toBe(before);
      expect(f.api.save).not.toHaveBeenCalled();
    },
  );
  it.each([9_999, 10_000])(
    "applies the complete shortlist only within the 10,000 member bound from %i",
    async (count) => {
      const f = await shortlistFixture();
      const draft = f.workspace.coordinator.getSnapshot().draft!;
      const memberships = Array.from({ length: count }, (_, index) => ({
        ...f.listing,
        listingId: `invented-other-${index}`,
        note: `${index}`,
      }));
      f.workspace.coordinator.replaceDraft({ ...draft, memberships });
      const before = f.workspace.coordinator.getSnapshot();
      const result = prepareScreenShortlistWatchlist(f.workspace);
      if (count === 10_000) {
        expect(result.preview).toBeNull();
        expect(result.reason).toContain("10,000");
        expect(f.workspace.coordinator.getSnapshot()).toBe(before);
        return;
      }
      expect(result.preview!.additions).toBe(1);
      expect(
        applyScreenShortlistWatchlist(f.workspace, result.preview!).added,
      ).toBe(true);
      expect(f.workspace.coordinator.getSnapshot().draft!.memberships).toEqual([
        ...memberships,
        { ...f.listing, note: "" },
      ]);
      expect(f.api.save).not.toHaveBeenCalled();
    },
  );
  it("denies forged and foreign reviews without consuming the genuine review", async () => {
    const f = await shortlistFixture();
    const foreign = await fixture();
    const preview = requireShortlistPreview(f.workspace);
    assertTransferRefused(f.workspace, { ...preview });
    assertTransferRefused(foreign.workspace, preview);
    expect(isScreenShortlistWatchlistCurrent(f.workspace, preview)).toBe(true);
  });
  it("consumes a review before synchronous draft subscribers can reenter", async () => {
    const f = await shortlistFixture();
    f.workspace.remove(f.listing.listingId);
    const preview = requireShortlistPreview(f.workspace);
    const reenter = vi.fn(() =>
      applyScreenShortlistWatchlist(f.workspace, preview),
    );
    const unsubscribe = f.workspace.coordinator.subscribe(reenter);
    try {
      expect(applyScreenShortlistWatchlist(f.workspace, preview).added).toBe(
        true,
      );
    } finally {
      unsubscribe();
    }
    expect(reenter).toHaveBeenCalledOnce();
    expect(reenter).toHaveReturnedWith({
      added: false,
      message:
        "Prepare a new review because the screen, Watchlist or session changed.",
    });
    expect(f.workspace.coordinator.getSnapshot().draft!.memberships).toEqual([
      { ...f.listing, note: "" },
    ]);
  });
  it.each([
    "draft",
    "criteria",
    "shortlist",
    "navigation",
    "catalog",
    "session",
    "save",
    "other-resource",
  ] as const)(
    "rejects an authorized review after %s changes",
    async (change) => {
      const f = await shortlistFixture();
      const preview = requireShortlistPreview(f.workspace);
      await shortlistChanges[change](f);
      assertTransferRefused(f.workspace, preview);
    },
  );
  it("does not revive a review after visiting a screened company and returning Back", async () => {
    const f = await shortlistFixture();
    const preview = requireShortlistPreview(f.workspace);
    const row = f.run.rows[0]!;
    const report = { run: f.run, row, response: row.report!.response! };
    f.workspace.openFinancialScreenReport(report);
    await vi.waitFor(() =>
      expect(f.workspace.annual.getSnapshot().checkingSeed).toBe(false),
    );
    expect(prepareScreenShortlistWatchlist(f.workspace).preview).toBeNull();
    f.workspace.closeResearch();
    expect(f.screen.canAdmitReport(report)).toBe(true);
    assertTransferRefused(f.workspace, preview);
    expect(requireShortlistPreview(f.workspace)).not.toBe(preview);
  });
  it("requires shortlist reports, matching catalog and the imported-file catalog review", async () => {
    const f = await fixture();
    expect(prepareScreenShortlistWatchlist(f.workspace).preview).toBeNull();
    const { screen, capture } = await runScreen(f);
    screen.toggleShortlist(screen.getSnapshot(), capture.row);
    const draft = f.workspace.coordinator.getSnapshot().draft!;
    f.workspace.coordinator.replaceDraft({
      ...draft,
      snapshotSha256: `sha256:${"b".repeat(64)}`,
    });
    expect(prepareScreenShortlistWatchlist(f.workspace).reason).toContain(
      "catalog",
    );
    f.workspace.coordinator.replaceDraft(draft);
    f.workspace.setView("watchlist");
    expect(f.workspace.restoreWatchlistFileDraft(draft)).toBe(true);
    f.workspace.setView("discover");
    const refused = prepareScreenShortlistWatchlist(f.workspace);
    expect(refused.preview).toBeNull();
    expect(refused.reason).toContain("imported");
  });
  it.each(["conflict", "unavailable"] as const)(
    "refuses a %s save recovery state before preparing another review",
    async (code) => {
      const f = await shortlistFixture();
      const preview = requireShortlistPreview(f.workspace);
      vi.mocked(f.api.save).mockRejectedValueOnce(new TrialApiError(code));
      await f.workspace.coordinator.save();
      expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
        phase: "idle",
        conflict: code === "conflict",
        uncertain: code === "unavailable",
      });
      assertTransferRefused(f.workspace, preview);
      expect(prepareScreenShortlistWatchlist(f.workspace).preview).toBeNull();
      expect(f.api.save).toHaveBeenCalledOnce();
    },
  );
  it("refuses both pending writes and original-receipt replay until the normal saved-version review", async () => {
    const f = await shortlistFixture();
    const draft = f.workspace.coordinator.getSnapshot().draft!;
    let finish!: (value: Awaited<ReturnType<ManagedApi["save"]>>) => void;
    vi.mocked(f.api.save).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const preview = requireShortlistPreview(f.workspace);
    const saving = f.workspace.coordinator.save();
    expect(f.workspace.coordinator.getSnapshot().phase).toBe("saving");
    assertTransferRefused(f.workspace, preview);
    expect(prepareScreenShortlistWatchlist(f.workspace).preview).toBeNull();
    finish({ version: 2, payload: draft, replayed: true });
    await saving;
    expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
      phase: "idle",
      replayPending: true,
      conflict: true,
      latestLoaded: false,
    });
    expect(prepareScreenShortlistWatchlist(f.workspace).preview).toBeNull();
    expect(f.api.save).toHaveBeenCalledOnce();
  });
  it("refuses duplicate draft identities and staged criteria before issuing a review", async () => {
    const f = await shortlistFixture();
    const draft = f.workspace.coordinator.getSnapshot().draft!;
    f.workspace.coordinator.replaceDraft({
      ...draft,
      memberships: [...draft.memberships, ...draft.memberships],
    });
    expect(prepareScreenShortlistWatchlist(f.workspace).preview).toBeNull();
    f.workspace.coordinator.replaceDraft(draft);
    f.screen.stageCriteria(f.screen.getSnapshot());
    expect(prepareScreenShortlistWatchlist(f.workspace).preview).toBeNull();
  });
});

type ShortlistFixture = Awaited<ReturnType<typeof shortlistFixture>>;
const shortlistChanges = {
  draft: (f) => f.workspace.note(f.listing.listingId, "Changed after review"),
  criteria: (f) => {
    f.screen.stageCriteria(f.screen.getSnapshot());
    f.screen.setCriteria(f.screen.getSnapshot(), f.run.criteria);
  },
  shortlist: (f) => {
    const row = f.run.rows[0]!;
    f.screen.toggleShortlist(f.screen.getSnapshot(), row);
    f.screen.toggleShortlist(f.screen.getSnapshot(), row);
  },
  navigation: (f) => {
    f.workspace.setView("watchlist");
    f.workspace.setView("discover");
  },
  catalog: (f) => f.workspace.refreshCatalog(),
  session: (f) => f.workspace.sessionOwner.signOut(),
  save: (f) => f.workspace.coordinator.save(),
  "other-resource": (f) => {
    const entry =
      f.workspace.followups.coordinator.getSnapshot().draft!.entries[0]!;
    f.workspace.followups.edit(entry, "check", "Changed independent follow-up");
  },
} satisfies Record<string, (f: ShortlistFixture) => void | Promise<void>>;
