import { prepareManagedInterimStatementsNote } from "../../src/clerk-trial/managed-interim-statements-note";
import { parseSecInterimCanonicalResponse } from "../../src/lib/sec-interim-canonical-response";
import type { SharedNativeFixture } from "./fixture";
import type { NativeInterimStatementsMetadata } from "./interim-statements-fixture";
import { buildInterimFixture } from "./interim-report-packet";

const prefix = "Thèse café 📈";
const selectedCells: NativeInterimStatementsMetadata["selectedCells"] = [
  {
    concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
    periodKey: JSON.stringify(["duration", "2026-04-01", "2026-06-30"]),
  },
  {
    concept: "NetCashProvidedByUsedInOperatingActivities",
    periodKey: JSON.stringify(["duration", "2026-01-01", "2026-06-30"]),
  },
  {
    concept: "Assets",
    periodKey: JSON.stringify(["instant", null, "2026-06-30"]),
  },
];
export function refuseCompanyPassFixture(): never {
  throw new Error("Unexpected invented reviewed company source pass action");
}
function interimPacket(base: SharedNativeFixture) {
  const known = base.researchCoverage.listings[0]!;
  const listing = known.listing;
  return buildInterimFixture({
    catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
    security: {
      listingId: listing.listingId,
      symbol: listing.symbol,
      issuerId: listing.issuerId,
      issuerName: listing.issuerName,
      securityName: listing.securityName,
      country: listing.country,
      exchangeMic: listing.exchangeMic,
      cik: known.cik,
    },
  });
}
type Packet = Awaited<ReturnType<typeof interimPacket>>;
function interimMetadata(owned: Packet): NativeInterimStatementsMetadata {
  const prepared = prepareManagedInterimStatementsNote({
    response: owned,
    selection: selectedCells,
    note: prefix,
    showingPrevious: false,
    isCurrent: () => true,
    apply: refuseCompanyPassFixture,
  });
  if (!prepared.preview) return refuseCompanyPassFixture();
  return {
    prefix,
    expectedNote: prepared.preview.note,
    selectedCells,
    issuers: [owned.security.cik],
    generation: owned.evidence.generation,
    pins: {
      reportDate: "2026-06-30",
      filedDate: "2026-07-30",
      accession: "0000000001-26-000002",
      quarterRevenue: "40",
      ytdRevenue: "75",
      ytdCash: "9",
      assets: "120",
    },
  };
}
/** Construct and admit the same invented packet before deriving its exact expected note. */
export async function reviewedCompanyPassEvidence(base: SharedNativeFixture) {
  const packet = await interimPacket(base);
  const request = {
    schemaVersion: "1.0.0" as const,
    catalogSnapshotSha256: packet.catalogSnapshotSha256,
    listingId: packet.security.listingId,
    symbol: packet.security.symbol,
  };
  const owned = await parseSecInterimCanonicalResponse(
    packet,
    request,
    new AbortController().signal,
  );
  if (!owned) return refuseCompanyPassFixture();
  return { packet, metadata: interimMetadata(owned) };
}
