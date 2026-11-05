import { vi } from "vitest";
import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import {
  portfolioScreenLedger,
  portfolioScreenListing,
  portfolioScreenAlternate,
  portfolioScreenCatalog,
} from "./test-portfolio-screen-selection-fixture";
export {
  portfolioScreenListing as watchlistScreenListing,
  portfolioScreenAlternate as watchlistScreenAlternate,
  portfolioScreenCatalog as watchlistScreenCatalog,
};
export const watchlistScreenUncovered = {
  ...portfolioScreenListing,
  listingId: "listing-uncovered",
  issuerId: "issuer-uncovered",
  issuerName: "Uncovered Company",
  securityId: "security-uncovered",
  shareClassId: "class-uncovered",
  symbol: "UNC",
};
const identities = [
  ...portfolioScreenLedger.identities,
  watchlistScreenUncovered,
];
export async function watchlistScreenFixture(
  loadWatchlist = true,
  loadCohort = true,
) {
  const unexpected = vi.fn(() =>
    Promise.reject(new Error("Unexpected unrelated request")),
  );
  let version = 3;
  let payload: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: portfolioScreenCatalog.snapshotSha256,
    memberships: identities.map((listing) => ({
      ...listing,
      note: "Original note 東京 " + listing.symbol,
    })),
  };
  const save = vi.fn<ManagedApi["save"]>().mockImplementation((command) => {
    if (command.expectedVersion !== version)
      return Promise.reject(new Error("Unexpected fixture version"));
    payload = structuredClone(command.payload);
    version += 1;
    return Promise.resolve({ version, payload, replayed: false });
  });
  const api = {
    status: vi
      .fn<ManagedApi["status"]>()
      .mockResolvedValue({ snapshot: portfolioScreenCatalog }),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockImplementation(() => Promise.resolve({ version, payload })),
    loadPortfolio: unexpected,
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing:
            identities.find((listing) => listing.listingId === listingId) ??
            null,
        })),
      }),
    ),
    annualReport: vi
      .fn<ManagedApi["annualReport"]>()
      .mockImplementation(unexpected),
    savePortfolio: vi
      .fn<ManagedApi["savePortfolio"]>()
      .mockImplementation(unexpected),
    save,
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
        watchlistScreenUncovered.listingId,
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
  if (loadWatchlist) {
    await workspace.coordinator.load();
    workspace.note(
      portfolioScreenListing.listingId,
      "Unsaved note Ω and precise 2.000001",
    );
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
    saved: () => ({ version, payload }),
    dispose: () => workspace.sessionOwner.dispose(),
  };
}
