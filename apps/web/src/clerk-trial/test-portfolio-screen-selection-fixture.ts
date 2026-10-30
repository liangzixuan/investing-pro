import { vi } from "vitest";
import type {
  ManagedCatalogSnapshotDto,
  ManagedPortfolioPayload,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { eodSelection } from "./eod-history-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";

export const portfolioScreenListing = eodSelection.listing;
export const portfolioScreenAlternate = {
  ...portfolioScreenListing,
  listingId: "listing-class-c",
  securityId: "security-class-c",
  securityName: "Zero Class C",
  shareClassId: "class-c",
  shareClassName: "Class C",
  symbol: "ZEROC",
};
const outside = {
  ...portfolioScreenListing,
  listingId: "listing-outside",
  issuerId: "issuer-outside",
  issuerName: "Outside Company 東京",
  securityId: "security-outside",
  shareClassId: "class-outside",
  symbol: "OUT",
};
export const portfolioScreenCatalog: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: eodSelection.catalogSnapshotSha256,
  catalogId: "invented-portfolio-screen",
  catalogVersion: "one",
  asOf: "2026-10-01T00:00:00.000Z",
  acquiredAt: "2026-10-01T00:00:00.000Z",
  generatedAt: "2026-10-01T00:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented engineering catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 3,
    activeListings: 3,
    admittedSourceRecords: 3,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 2,
    providerMappings: 0,
    quarantinedSourceRecords: 0,
    sourceRecords: 3,
    staleSourceRecords: 0,
    shareClasses: 3,
    totalSecurities: 3,
    unsupportedSourceRecords: 0,
  },
};
export const portfolioScreenLedger: ManagedPortfolioPayload = {
  schemaVersion: 3,
  name: "My Portfolio",
  currency: "USD",
  snapshotSha256: portfolioScreenCatalog.snapshotSha256,
  basisMethod: "fifo_with_opening_pool",
  identities: [portfolioScreenListing, portfolioScreenAlternate, outside],
  opening: {
    asOfDate: "2026-10-01",
    cashUsd: "100.00",
    holdings: [portfolioScreenListing, portfolioScreenAlternate, outside].map(
      (identity) => ({
        listingId: identity.listingId,
        shares: "2.000001",
        totalCostBasisUsd: "80.00",
        confirmedOn: "2026-10-01",
      }),
    ),
  },
  transactions: [],
};

export async function portfolioScreenFixture(
  loadPortfolio = true,
  loadCohort = true,
) {
  const unexpected = vi.fn(() =>
    Promise.reject(new Error("Unexpected unrelated request")),
  );
  const api = {
    status: vi
      .fn<ManagedApi["status"]>()
      .mockResolvedValue({ snapshot: portfolioScreenCatalog }),
    load: vi.fn<ManagedApi["load"]>().mockResolvedValue({
      version: 1,
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: portfolioScreenCatalog.snapshotSha256,
        memberships: [],
      },
    }),
    loadPortfolio: vi
      .fn<ManagedApi["loadPortfolio"]>()
      .mockResolvedValue({ version: 1, payload: portfolioScreenLedger }),
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing:
            portfolioScreenLedger.identities.find(
              (listing) => listing.listingId === listingId,
            ) ?? null,
        })),
      }),
    ),
    annualReport: vi
      .fn<ManagedApi["annualReport"]>()
      .mockImplementation(unexpected),
    savePortfolio: vi
      .fn<ManagedApi["savePortfolio"]>()
      .mockImplementation(unexpected),
    save: unexpected,
    loadFollowups: unexpected,
    saveFollowups: unexpected,
    loadValuationAssumptions: unexpected,
    saveValuationAssumptions: unexpected,
    search: unexpected,
    interimReport: unexpected,
    eodHistory: unexpected,
    recentFilings: unexpected,
    monetaryAnnouncements: unexpected,
    cpiHeadlines: unexpected,
    blsCalendar: unexpected,
    economicCalendar: unexpected,
  } satisfies ManagedApi;
  const workspace = new ManagedWorkspace(
    api,
    {
      userId: "invented-screen-owner",
      sessionId: "invented-screen-session",
      getToken: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined),
    },
    undefined,
    {
      financialScreenListingIds: [
        portfolioScreenListing.listingId,
        portfolioScreenAlternate.listingId,
      ],
      researchCoverage: createManagedResearchCoverageFixture(
        [portfolioScreenListing, portfolioScreenAlternate].map((listing) => ({
          listing,
          cik: "0000000001",
        })),
      ),
    },
  );
  await workspace.refreshCatalog();
  if (loadPortfolio) {
    await workspace.portfolio.coordinator.load();
    await workspace.portfolio.reviewCatalog();
    workspace.portfolio.applyReview();
    const draft = workspace.portfolio.coordinator.getSnapshot().draft!;
    workspace.portfolio.replace(draft, {
      ...draft.ledger!,
      opening: { ...draft.ledger!.opening, cashUsd: "123.4500" },
    });
  }
  workspace.setView("discover");
  if (loadCohort)
    await workspace.financialScreen.loadUniverse(
      workspace.financialScreen.getSnapshot(),
    );
  const choice = (alternate = true) =>
    workspace.financialScreen
      .getSnapshot()
      .memberships.find(
        (member) =>
          member.listing.listingId ===
          (alternate ? portfolioScreenAlternate : portfolioScreenListing)
            .listingId,
      )!;
  return {
    workspace,
    api,
    unexpected,
    choice,
    dispose: () => workspace.sessionOwner.dispose(),
  };
}
