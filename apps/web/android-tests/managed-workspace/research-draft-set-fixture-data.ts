import {
  encodeMainWatchlistPayload,
  parsePortfolioPayload,
  parseResearchFollowupsPayload,
  type MainWatchlistPayload,
} from "@research-cockpit/contracts";
import type { SharedNativeFixture } from "./fixture";
import { savedValuationInputs } from "./fixture";
import { collectionPayload } from "./valuation-collection-recovery-fixture";

export function researchDraftSetData(base: SharedNativeFixture) {
  const listings = base.researchCoverage.listings
      .slice(0, 2)
      .map((row) => row.listing),
    digest = base.researchCoverage.catalogSnapshotSha256,
    old = `sha256:${"b".repeat(64)}`;
  const watchlist: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist" as const,
    snapshotSha256: digest,
    memberships: listings.map((listing, index) => ({
      ...listing,
      note:
        index === 0
          ? "ZERO whole research note Café 東京 📈 <script>literal</script>"
          : "ONE independent raw note, keep this exact order.",
    })),
  };
  encodeMainWatchlistPayload(watchlist);
  const portfolio = parsePortfolioPayload({
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: old,
    basisMethod: "fifo_with_opening_pool",
    identities: listings,
    opening: {
      asOfDate: "2000-01-01",
      cashUsd: "1000.00",
      holdings: [
        {
          listingId: listings[0]!.listingId,
          shares: "1.000000",
          totalCostBasisUsd: "10.00",
          confirmedOn: "2000-01-01",
        },
      ],
    },
    transactions: [
      {
        id: "invented-buy-zero",
        date: "2000-01-02",
        type: "buy",
        listingId: listings[0]!.listingId,
        shares: "2.500000",
        grossUsd: "25.00",
        feeUsd: "0.50",
      },
      {
        id: "invented-buy-one",
        date: "2000-01-02",
        type: "buy",
        listingId: listings[1]!.listingId,
        shares: "1.000000",
        grossUsd: "15.00",
        feeUsd: "0.25",
      },
    ],
  });
  const followups = parseResearchFollowupsPayload({
    schemaVersion: 1,
    entries: listings.map((listing, index) => ({
      id:
        index === 0
          ? "11111111-1111-4111-8111-111111111111"
          : "22222222-2222-4222-8222-222222222222",
      listing,
      catalogSnapshotSha256: digest,
      check:
        index === 0
          ? "Which complete observation changes ZERO? Café 東京 📈"
          : "Keep the independent ONE question.",
      dueOn: "2000-01-01",
      result:
        index === 0
          ? "Full authored result <script>literal</script> Café 東京 📈"
          : "Retain this open check's independent result.",
      ...(index === 0
        ? { status: "completed", completedOn: "2000-01-02" }
        : { status: "open", completedOn: null }),
    })),
  });
  if (!portfolio || !followups)
    throw new Error("Invalid invented research draft-set payload");
  const valuation = collectionPayload(base),
    reviewedValuation = collectionPayload(base, true);
  const newerWatchlist: MainWatchlistPayload = {
    ...watchlist,
    name: "My Watchlist" as const,
    memberships: watchlist.memberships.map((member) => ({
      ...member,
      note: "Newer saved independent note",
    })),
  };
  const newerPortfolio = parsePortfolioPayload({
    ...portfolio,
    name: "My Portfolio",
    snapshotSha256: digest,
    identities: [listings[0]!],
    opening: { asOfDate: "2000-01-01", cashUsd: "2222.00", holdings: [] },
    transactions: [],
  });
  if (!newerPortfolio) throw new Error("Invalid invented newer Portfolio");
  const newerValuation = {
    schemaVersion: 1 as const,
    entries: [structuredClone(savedValuationInputs!)],
  };
  return {
    captured: { watchlist, portfolio, followups, valuation },
    reviewed: {
      portfolio: { ...portfolio, snapshotSha256: digest },
      valuation: reviewedValuation,
    },
    newer: {
      watchlist: newerWatchlist,
      portfolio: newerPortfolio,
      followups: { schemaVersion: 1 as const, entries: [] },
      valuation: newerValuation,
    },
    independentWatchlist: {
      ...newerWatchlist,
      name: "My Watchlist" as const,
      memberships: newerWatchlist.memberships.map((member) => ({
        ...member,
        note: "Keep this unsaved Watchlist Café 東京 📈",
      })),
    },
  };
}
