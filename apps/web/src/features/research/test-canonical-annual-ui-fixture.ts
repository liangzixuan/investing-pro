import type {
  PersonalSecAnnualCanonicalResponseDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import {
  canonicalAnnualPacket,
  withCanonicalAnnualGeneration,
} from "./sec-annual-canonical-fixture";
import { row } from "./sec-annual-evidence-fixture";
import {
  bindAnnualPacket,
  replaceConceptRows,
  type TestAnnualPacket,
} from "../../lib/test-personal-sec-annual-api-fixture";
import { parseSecAnnualCanonicalResponse } from "../../lib/sec-annual-canonical-response";
import { getManagedAnnualView } from "../../clerk-trial/managed-annual-view";

// Reuse only invented source-row fields, never the old fixture's v5 packet builder.
export {
  row,
  annualComparativeRows,
  annualHistoryRows,
} from "./sec-annual-evidence-fixture";

export async function admitUiPacket(
  packet: PersonalSecAnnualCanonicalResponseDto,
) {
  const admitted = await parseSecAnnualCanonicalResponse(
    packet,
    {
      schemaVersion: "6.0.0",
      catalogSnapshotSha256: packet.catalogSnapshotSha256,
      listingId: packet.security.listingId,
      symbol: packet.security.symbol,
    },
    new AbortController().signal,
  );
  if (!admitted) throw new Error("Invented canonical UI evidence was refused");
  viewOf(admitted);
  return admitted;
}
export function viewOf(response: PersonalSecAnnualCanonicalResponseDto) {
  const view = getManagedAnnualView(response);
  if (!view) throw new Error("UI fixture requires owned canonical evidence");
  return view;
}
export async function response(
  rows: readonly PersonalSecQuarterlyObservationDto[] = [
    row(),
    row("NetIncomeLoss", "100"),
  ],
  cutoffAt = "2026-09-20T00:00:00.000Z",
): Promise<PersonalSecAnnualCanonicalResponseDto> {
  const packet = structuredClone(
    await canonicalAnnualPacket(),
  ) as TestAnnualPacket;
  const capturedAt = (seconds: number) =>
    new Date(Date.parse(cutoffAt) + seconds * 1000).toISOString();
  packet.security = {
    country: "US",
    exchangeMic: "XNAS",
    issuerId: "issuer-zero",
    issuerName: "Zero Company",
    listingId: "listing-zero",
    securityName: "Zero Class A",
    symbol: "ZERO",
    cik: "0000000001",
  };
  packet.evidence.cik = packet.security.cik;
  packet.evidence.target = {
    status: "target",
    accessionNumber: "0000000001-26-000001",
    form: "10-K",
    filedDate: "2026-02-01",
    reportDate: "2025-12-31",
    acceptedAt: "2026-02-01T00:00:00.000Z",
  };
  packet.evidence.generation.cutoffAt = cutoffAt;
  packet.evidence.generation.completedAt = capturedAt(2);
  packet.evidence.generation.sources.companyFacts.sourceUrl =
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json";
  packet.evidence.generation.sources.companyFacts.fetchedAt = capturedAt(1);
  packet.evidence.generation.sources.submissions.sourceUrl =
    "https://data.sec.gov/submissions/CIK0000000001.json";
  packet.evidence.generation.sources.submissions.fetchedAt = capturedAt(2);
  for (const item of packet.evidence.facts.scans) {
    const changes = rows
      .filter((row) => row.concept === item.concept)
      .map(({ metric, ...fields }) => {
        void metric;
        return fields;
      });
    replaceConceptRows(packet, item.concept, changes);
  }
  return admitUiPacket(await bindAnnualPacket(packet));
}
export async function sourceUnavailableResponse() {
  const packet = structuredClone(await response([])) as TestAnnualPacket;
  Object.assign(packet.evidence.generation.sources.companyFacts, {
    status: "upstream_unavailable",
    fetchedAt: null,
    sha256: null,
    bytes: null,
  });
  for (const item of packet.evidence.facts.scans)
    item.scan = { status: "source_unavailable", absence: null, coverage: null };
  return admitUiPacket(await withCanonicalAnnualGeneration(packet));
}
