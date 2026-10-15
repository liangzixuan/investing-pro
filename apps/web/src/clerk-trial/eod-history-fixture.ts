import {
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryRequestDto,
  type ManagedEodHistoryRange,
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
export const eodRequest = (
  range: ManagedEodHistoryRange = "1m",
): ManagedEodHistoryRequestDto => ({
  catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
  listingId: eodSelection.listing.listingId,
  range,
});
export function eodResponse(
  range: ManagedEodHistoryRange = "1m",
): ManagedEodHistoryResponseDto {
  const result = parseManagedEodHistoryResponse(
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
      range,
      security: eodSelection.listing,
      provider: "Tiingo",
      currency: "USD",
      priceBasis: "raw_close",
      window: {
        startDate: range === "1y" ? "2025-09-20" : "2026-08-20",
        endDate: "2026-09-20",
      },
      requestStartedAt: "2026-09-20T00:00:00.000Z",
      completedAt: "2026-09-20T00:00:01.000Z",
      rows: [
        ...(range === "1y" ? [{ date: "2025-09-22", close: "90.125" }] : []),
        { date: "2026-09-18", close: "100.25" },
        { date: "2026-09-19", close: "101.5" },
      ],
    },
    eodRequest(range),
  );
  if (!result) throw new Error("Invalid invented EOD fixture");
  return result;
}
