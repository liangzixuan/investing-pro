import {
  PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY as registry,
  type PersonalSecInterimCanonicalResponseDto as Response,
} from "@research-cockpit/contracts";
import {
  buildInterimFixture,
  sealFixture,
} from "../../android-tests/managed-workspace/interim-report-packet";
import { canonicalAnnualPacket } from "../features/research/sec-annual-canonical-fixture";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../lib/test-personal-sec-annual-api-fixture";
import { eodSelection } from "./eod-history-fixture";
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const size = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;
async function maximumAnnualSource() {
  const annual = structuredClone(
    await canonicalAnnualPacket({ rowsPerConcept: 100, escapedMetadata: true }),
  ) as TestAnnualPacket;
  annual.catalogSnapshotSha256 = eodSelection.catalogSnapshotSha256;
  annual.security = {
    country: eodSelection.listing.country,
    exchangeMic: eodSelection.listing.exchangeMic,
    issuerId: eodSelection.listing.issuerId,
    issuerName: eodSelection.listing.issuerName,
    listingId: eodSelection.listing.listingId,
    securityName: eodSelection.listing.securityName,
    symbol: eodSelection.listing.symbol,
    cik: "0000000042",
  };
  annual.evidence.cik = "0000000042";
  annual.evidence.generation.sources.submissions.sourceUrl =
    "https://data.sec.gov/submissions/CIK0000000042.json";
  annual.evidence.generation.sources.companyFacts.sourceUrl =
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000042.json";
  // Every row has maximum decimal/frame/focus sizes and independently escaped metadata.
  annual.evidence.facts.observations = annual.evidence.facts.observations.map(
    (row, index) => ({
      ...row,
      value: "9".repeat(64),
      frame: String(index % 100).padEnd(128, "\\"),
    }),
  );
  return annual;
}
async function maximumInterimSource(annual: TestAnnualPacket) {
  const interim = structuredClone(
    await buildInterimFixture({
      catalogSnapshotSha256: annual.catalogSnapshotSha256,
      security: annual.security,
    }),
  ) as Mutable<Response>;
  const sample = interim.evidence.facts.observations[0]!;
  interim.evidence.facts.observations = registry.flatMap((entry) =>
    Array.from({ length: 100 }, (_, index) => {
      const endDate = new Date(Date.UTC(2026, 5, 30 - index))
        .toISOString()
        .slice(0, 10);
      const startDate =
        entry.periodType === "instant"
          ? null
          : new Date(Date.UTC(2026, 0, 1 - index)).toISOString().slice(0, 10);
      return {
        ...sample,
        concept: entry.concept,
        value: "9".repeat(64),
        startDate,
        endDate,
        durationDays:
          startDate === null
            ? null
            : (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1,
        frame: String(index).padEnd(128, "\\"),
        filingFocusPeriod: '\\"'.repeat(16),
        sourceLocator: `/facts/us-gaap/${entry.concept}/units/USD/${index}`,
      };
    }),
  );
  return interim;
}
export async function capacitySources() {
  const annual = await maximumAnnualSource(),
    interim = await maximumInterimSource(annual);
  fit(annual);
  fit(interim);
  const annualBound = await bindAnnualPacket(annual),
    interimBound = {
      ...interim,
      evidence: await sealFixture(interim.evidence),
    };
  return {
    annual: annualBound,
    interim: interimBound,
    annualBytes: size(annualBound),
    interimBytes: size(interimBound),
  };
}

function recount(packet: TestAnnualPacket | Mutable<Response>) {
  const indexes = new Map<string, number>();
  for (const row of packet.evidence.facts.observations) {
    const index = indexes.get(row.concept) ?? 0;
    row.sourceLocator = `/facts/us-gaap/${row.concept}/units/USD/${index}`;
    indexes.set(row.concept, index + 1);
  }
  for (const item of packet.evidence.facts.scans) {
    const count = packet.evidence.facts.observations.filter(
      (row) => row.concept === item.concept,
    ).length;
    item.scan = {
      status: "available",
      absence: count === 0 ? "concept_missing" : null,
      coverage: {
        full: {
          candidateRows: count,
          inspectedRows: count,
          invalidRows: 0,
          duplicateRows: 0,
          uniqueObservations: count,
        },
        selected: count,
        otherAccessions: 0,
        returned: count,
        omittedSelected: 0,
      },
    };
  }
}
function fit(packet: TestAnnualPacket | Mutable<Response>) {
  recount(packet);
  // Fill the actual admitted2MiB envelope; trim whole rows only, never captured output.
  let position = 0,
    bytes = size(packet);
  while (bytes > 2097152) {
    const concept = registry[position % registry.length]!.concept;
    const index = packet.evidence.facts.observations.findIndex(
      (row) => row.concept === concept,
    );
    if (index < 0) throw new Error("Capacity fixture exhausted");
    const [removed] = packet.evidence.facts.observations.splice(index, 1);
    bytes -= size(removed) + 1;
    position++;
  }
  recount(packet);
  if (size(packet) > 2097152) throw new Error("Capacity accounting changed");
}

/** Valid low-overhead wire with the full3200 distinct-period singleton groups. */
export async function lowOverheadInterim(source: Response) {
  const raw = structuredClone(source) as Mutable<Response>,
    sample = raw.evidence.facts.observations[0]!;
  raw.evidence.facts.observations = registry.flatMap((entry) =>
    Array.from({ length: 100 }, (_, index) => {
      const endDate = new Date(Date.UTC(2026, 5, 30 - index))
          .toISOString()
          .slice(0, 10),
        startDate =
          entry.periodType === "instant"
            ? null
            : new Date(Date.UTC(2026, 0, 1 - index)).toISOString().slice(0, 10);
      return {
        ...sample,
        concept: entry.concept,
        value: "1",
        frame: null,
        filingFocusPeriod: null,
        filingFocusYear: null,
        startDate,
        endDate,
        durationDays:
          startDate === null
            ? null
            : (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1,
        sourceLocator: `/facts/us-gaap/${entry.concept}/units/USD/${index}`,
        filing: {
          status: "not_in_current_submissions" as const,
          form: null,
          filedDate: null,
          reportDate: null,
          acceptedAt: null,
          sourceUrl: null,
        },
      };
    }),
  );
  recount(raw);
  return { ...raw, evidence: await sealFixture(raw.evidence) };
}
