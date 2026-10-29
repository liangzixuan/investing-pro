import {
  parseManagedSecFilingsResponse,
  parseResearchFollowupsPayload,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { SharedNativeFixture } from "./fixture";
import { inventedFilingsPacket } from "./filings-fixture";

export const filingAssessmentQuestion =
  "Does the filing change the original capacity thesis? Café 東京 📈";
export const filingAssessmentRaw =
  "My assessment: capacity needs another review. <script>invented</script> & Café 東京 📈";
export const filingAssessmentWatchlistNote =
  "Independent unsaved filing assessment note · Café 東京 📈";
export const filingAssessmentCitation =
  "Observed SEC filing reference: ZERO (XNAS); CIK 0000000001; Form 10-Q; accession 0000000001-26-000001; filed 2026-09-19; report date 2026-06-30; filing index https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. " +
  "Source: SEC Submissions; requested window 2026-06-23 to 2026-09-20; original request started 2026-09-20T00:00:00.000Z; retrieved 2026-09-20T00:00:01.000Z; completed 2026-09-20T00:00:02.000Z. " +
  "Only the current recent-filings object was checked; older continuation files were not loaded; complete window coverage is not established. " +
  "The source lists older continuation files. " +
  "Filing contents were not fetched. Evidence dates are unchanged; this action does not refresh sources.";
export const filingAssessmentResult = `${filingAssessmentRaw} ${filingAssessmentCitation}`;

/** Literal reference expectation above is independent of the production formatter. */
export function filingAssessmentPacket(base: SharedNativeFixture) {
  const listing = base.researchCoverage.listings[0]!.listing;
  const original = inventedFilingsPacket(listing);
  const packet = parseManagedSecFilingsResponse(
    {
      ...original,
      issuer: {
        ...original.issuer,
        filings: original.issuer.filings.slice(0, 2),
        matchingFilings: 2,
        truncated: false,
      },
    },
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
      listingId: listing.listingId,
      symbol: listing.symbol,
    },
  );
  if (!packet) throw new Error("Invalid invented filing assessment packet");
  return packet;
}

export function filingAssessmentOriginal(base: SharedNativeFixture) {
  const payload = parseResearchFollowupsPayload({
    schemaVersion: 1,
    entries: base.researchCoverage.listings.slice(0, 2).map((row, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
      listing: row.listing,
      check:
        index === 0
          ? filingAssessmentQuestion
          : "Keep the independent ONE check unchanged.",
      result: index === 0 ? "" : "Original independent ONE assessment.",
      dueOn: index === 0 ? "2000-01-01" : "2099-12-31",
      status: "open",
      completedOn: null,
    })),
  });
  if (!payload) throw new Error("Invalid invented filing assessment resource");
  return payload;
}

export function filingAssessmentExpected(
  base: SharedNativeFixture,
  completedOn: string,
): ResearchFollowupsPayload {
  const original = filingAssessmentOriginal(base);
  return {
    ...original,
    entries: original.entries.map((entry, index) =>
      index === 0
        ? {
            ...entry,
            result: filingAssessmentResult,
            status: "completed",
            completedOn,
          }
        : entry,
    ),
  };
}
