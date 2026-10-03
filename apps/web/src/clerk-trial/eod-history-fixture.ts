import {
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryRequestDto,
  type ManagedEodHistoryResponseDto,
} from "@research-cockpit/contracts";
import type { EodHistorySelection } from "./managed-eod-history";

/** Invented, parser-admitted packets shared only by EOD regression tests. */
export const eodSelection: EodHistorySelection = {
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
  origin: "discover",
  cik: "0000000001",
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
export const eodRequest = (): ManagedEodHistoryRequestDto => ({
  catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
  listingId: eodSelection.listing.listingId,
  range: "1m",
});
export function eodResponse(): ManagedEodHistoryResponseDto {
  const result = parseManagedEodHistoryResponse(
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
      range: "1m",
      security: eodSelection.listing,
      provider: "Tiingo",
      currency: "USD",
      priceBasis: "raw_close",
      window: { startDate: "2026-08-20", endDate: "2026-09-20" },
      requestStartedAt: "2026-09-20T00:00:00.000Z",
      completedAt: "2026-09-20T00:00:01.000Z",
      rows: [
        { date: "2026-09-18", close: "100.25" },
        { date: "2026-09-19", close: "101.5" },
      ],
    },
    eodRequest(),
  );
  if (!result) throw new Error("Invalid invented EOD fixture");
  return result;
}
