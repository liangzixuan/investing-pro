import {
  parseResearchFollowupsPayload,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import {
  reviewFilingsIdentities,
  reviewFilingsOriginal,
  reviewFilingsResult,
} from "./review-filings-evidence-fixture-data";
export const dailyQuestion =
  "Does this exact GOOG Class C filing support capacity growth? Café 東京 📈 <script>invented</script> & uncertainty.";
export const dailyDueOn = "2026-12-31";
// Independent literal oracle; no production citation/question formatter.
export const dailyQuestionCheck = `Question: ${dailyQuestion} | SEC filing metadata: Form 10-Q; accession 0000000002-26-000001; filed 2026-09-19; https://www.sec.gov/Archives/edgar/data/2/0000000002-26-000001-index.htm`;
export function dailyReviewData(digest: `sha256:${string}`, day: string) {
  const identities = reviewFilingsIdentities();
  return {
    identities,
    watchlist: {
      schemaVersion: 1 as const,
      name: "My Watchlist" as const,
      snapshotSha256: digest,
      memberships: [identities[0]!, identities[1]!, identities[6]!].map(
        (listing) => ({
          ...listing,
          note: `Original ${listing.symbol} thesis Café 東京 📈 <script>invented</script> & complete uncertainty.`,
        }),
      ),
    },
    original: {
      ...reviewFilingsOriginal(digest, day),
      entries: reviewFilingsOriginal(digest, day).entries.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              listing: identities[2]!,
              check:
                "Keep the complete independent AAPL question and original assessment.",
            }
          : entry,
      ),
    },
  };
}
export function dailyReviewExpected(
  original: ResearchFollowupsPayload,
  _day: string,
  createdId: string,
): ResearchFollowupsPayload {
  const parsed = parseResearchFollowupsPayload({
    schemaVersion: 1,
    entries: [
      ...original.entries.map((entry, index) =>
        index === 1
          ? {
              ...entry,
              result: reviewFilingsResult(1),
              status: "open",
              completedOn: null,
            }
          : entry,
      ),
      {
        id: createdId,
        listing: reviewFilingsIdentities()[0]!,
        catalogSnapshotSha256: original.entries[0]!.catalogSnapshotSha256,
        check: dailyQuestionCheck,
        dueOn: dailyDueOn,
        status: "open",
        completedOn: null,
        result: "",
      },
    ],
  });
  if (!parsed)
    throw new Error("Invalid invented Watchlist daily-review result");
  return parsed;
}
