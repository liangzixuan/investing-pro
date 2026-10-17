import {
  serializePersonalSecAnnualStatementObservation,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import {
  canonicalAnnualPacket,
  canonicalFixtureHash,
  withCanonicalAnnualGeneration,
} from "../features/research/sec-annual-canonical-fixture";
import { parseSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import { eodSelection } from "./eod-history-fixture";

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
type Mode =
  | "default"
  | "income-invalid"
  | "current-use-unavailable"
  | "source-unavailable"
  | "exact-decimal";

/** Invented canonical graph for this model's admission and lifetime tests only. */
export async function annualReportPacket(
  side: "left" | "right" = "left",
  { mode = "default" }: { readonly mode?: Mode } = {},
): Promise<PersonalSecAnnualCanonicalResponseDto> {
  const packet = structuredClone(
    await canonicalAnnualPacket(),
  ) as Mutable<PersonalSecAnnualCanonicalResponseDto>;
  const listing = eodSelection.listing;
  const cik = side === "left" ? "0000000001" : "0000000002";
  packet.security = {
    country: listing.country,
    exchangeMic: listing.exchangeMic,
    issuerId: side === "left" ? listing.issuerId : "issuer-one",
    issuerName: side === "left" ? listing.issuerName : "One Company",
    listingId: side === "left" ? listing.listingId : "listing-one",
    securityName: side === "left" ? listing.securityName : "One Class A",
    symbol: side === "left" ? listing.symbol : "ONE",
    cik,
  };
  packet.evidence.cik = cik;
  for (const [key, source] of Object.entries(
    packet.evidence.generation.sources,
  )) {
    source.sourceUrl =
      key === "companyFacts"
        ? `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`
        : `https://data.sec.gov/submissions/CIK${cik}.json`;
  }
  for (const row of packet.evidence.facts.observations) {
    row.filing.sourceUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${row.accessionNumber}-index.htm`;
    if (mode === "exact-decimal")
      row.value = "9007199254740993.123456789012345678";
    row.id = `sec-fact:${await canonicalFixtureHash(serializePersonalSecAnnualStatementObservation(row))}`;
  }
  if (mode === "current-use-unavailable") {
    packet.evidence.generation.cutoffAt = "2028-09-20T00:00:00.000Z";
    packet.evidence.generation.completedAt = "2028-09-20T00:00:03.000Z";
    packet.evidence.generation.sources.companyFacts.fetchedAt =
      "2028-09-20T00:00:02.000Z";
    packet.evidence.generation.sources.submissions.fetchedAt =
      "2028-09-20T00:00:01.000Z";
  }
  if (mode === "income-invalid") {
    const scan = packet.evidence.facts.scans.find(
      (item) => item.concept === "NetIncomeLoss",
    )!;
    scan.scan = { status: "invalid_response", absence: null, coverage: null };
    packet.evidence.facts.observations =
      packet.evidence.facts.observations.filter(
        (row) => row.concept !== "NetIncomeLoss",
      );
  }
  if (mode === "source-unavailable") {
    Object.assign(packet.evidence.generation.sources.companyFacts, {
      status: "upstream_unavailable",
      fetchedAt: null,
      sha256: null,
      bytes: null,
    });
    packet.evidence.facts.observations = [];
    for (const item of packet.evidence.facts.scans)
      item.scan = {
        status: "source_unavailable",
        absence: null,
        coverage: null,
      };
  }
  const rebound = await withCanonicalAnnualGeneration(packet);
  const admitted = await parseSecAnnualCanonicalResponse(
    rebound,
    {
      schemaVersion: "6.0.0",
      catalogSnapshotSha256: rebound.catalogSnapshotSha256,
      listingId: rebound.security.listingId,
      symbol: rebound.security.symbol,
    },
    new AbortController().signal,
  );
  if (!admitted)
    throw new Error("Invented canonical model fixture was refused");
  return admitted;
}
