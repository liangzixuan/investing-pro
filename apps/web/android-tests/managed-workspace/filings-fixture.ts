import {
  parseManagedSecFilingsResponse,
  type WatchlistMembership,
} from "@research-cockpit/contracts";

/** Fixed invented metadata only; no provider or document request. */
export function inventedFilingsPacket(
  listing: Omit<WatchlistMembership, "note">,
  empty = false,
) {
  const request = {
    schemaVersion: "1.0.0" as const,
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
    listingId: listing.listingId,
    symbol: listing.symbol,
  };
  const cik = "0000000001";
  const filings = empty
    ? []
    : Array.from({ length: 26 }, (_, index) => {
        const accessionNumber = `0000000001-26-${String(index + 1).padStart(6, "0")}`;
        return {
          cik,
          accessionNumber,
          form: index === 0 ? "10-Q" : "8-K",
          filingDate: "2026-09-19",
          reportDate: index === 0 ? "2026-06-30" : null,
          sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${accessionNumber}-index.htm`,
        };
      });
  const packet = parseManagedSecFilingsResponse(
    {
      schemaVersion: request.schemaVersion,
      catalogSnapshotSha256: request.catalogSnapshotSha256,
      security: { ...listing, cik },
      window: {
        lookbackDays: 90,
        fromDate: "2026-06-23",
        throughDate: "2026-09-20",
      },
      requestStartedAt: "2026-09-20T00:00:00.000Z",
      completedAt: "2026-09-20T00:00:02.000Z",
      issuer: {
        cik,
        status: "available",
        fetchedAt: "2026-09-20T00:00:01.000Z",
        sourceUrl: `https://data.sec.gov/submissions/CIK${cik}.json`,
        olderHistoryAvailable: true,
        matchingFilings: filings.length,
        truncated: false,
        filings,
      },
    },
    request,
  );
  if (!packet) throw new Error("Invalid invented company filings packet");
  return packet;
}
