import {
  managedSecFilingsWindow,
  type ManagedSecFilingsResponseDto,
} from "@research-cockpit/contracts";
import type { ManagedResearchSelection } from "./managed-research-selection";

export const filingsSelection: ManagedResearchSelection = {
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
  cik: "0000000001",
  origin: "discover",
  listing: {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: "issuer-zero",
    issuerName: "Zero Company",
    listingId: "listing-zero",
    securityId: "security-zero",
    securityName: "Zero Class A",
    shareClassId: "class-zero",
    shareClassName: "Class A",
    symbol: "ZERO",
  },
};
export function filingsResponse(
  count = 26,
  status: ManagedSecFilingsResponseDto["issuer"]["status"] = "available",
  selected = filingsSelection,
): ManagedSecFilingsResponseDto {
  const cik = selected.cik ?? "0000000001";
  const requestStartedAt = "2026-10-12T00:00:00.000Z";
  const rows =
    status === "available"
      ? Array.from({ length: count }, (_, index) => {
          const accessionNumber = `${cik}-26-${String(index + 1).padStart(6, "0")}`;
          return {
            cik,
            accessionNumber,
            form: index === 0 ? "10-Q" : "8-K",
            filingDate: "2026-10-11",
            reportDate: index === 0 ? "2026-09-30" : null,
            sourceUrl: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNumber}-index.htm`,
          };
        })
      : [];
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: selected.catalogSnapshotSha256,
    security: { ...selected.listing, cik },
    window: managedSecFilingsWindow(requestStartedAt)!,
    requestStartedAt,
    completedAt: "2026-10-12T00:00:01.000Z",
    issuer: {
      cik,
      status,
      fetchedAt: "2026-10-12T00:00:00.500Z",
      sourceUrl: `https://data.sec.gov/submissions/CIK${cik}.json`,
      olderHistoryAvailable: status === "available",
      matchingFilings: rows.length,
      truncated: false,
      filings: rows,
    },
  };
}
