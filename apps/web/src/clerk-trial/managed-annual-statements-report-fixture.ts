import type {
  PersonalSecAnnualStatementConcept,
  PersonalSecAnnualStatementObservationDto,
} from "@research-cockpit/contracts";
import {
  bindAnnualPacket,
  replaceConceptRows,
  type TestAnnualPacket,
} from "../lib/test-personal-sec-annual-api-fixture";
import { annualReportPacket } from "./test-annual-report-fixture";
import { parseSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";

export interface ReportAnnualFixtureOptions {
  cutoffAt?: string;
  includeIncome?: boolean;
  operatingIncome?: string | null;
  operatingCashFlow?: string | null;
  ppePurchases?: string | null;
  currentAssets?: string | null;
  currentLiabilities?: string | null;
  shareholdersEquity?: string | null;
  conceptRows?: Partial<
    Record<
      PersonalSecAnnualStatementConcept,
      readonly Partial<PersonalSecAnnualStatementObservationDto>[]
    >
  >;
}

/** Invented source rows, real canonical hashes/counts and real decoder ownership. */
export async function reportAnnualPacket(
  options: ReportAnnualFixtureOptions = {},
) {
  const packet = structuredClone(
    await annualReportPacket(),
  ) as TestAnnualPacket;
  const accession = "0000000001-26-000001";
  if (packet.evidence.target.status !== "target")
    throw new Error("Expected fixture target");
  packet.evidence.target.accessionNumber = accession;
  for (const row of packet.evidence.facts.observations) {
    row.accessionNumber = accession;
    row.filing.sourceUrl = `https://www.sec.gov/Archives/edgar/data/1/${accession}-index.htm`;
  }
  const amounts = {
    RevenueFromContractWithCustomerExcludingAssessedTax: null,
    Revenues: options.includeIncome === false ? null : "1000",
    SalesRevenueNet: options.includeIncome === false ? null : "900",
    NetIncomeLoss: options.includeIncome === false ? null : "100",
    OperatingIncomeLoss:
      options.operatingIncome === undefined
        ? "-25.125"
        : options.operatingIncome,
    NetCashProvidedByUsedInOperatingActivities:
      options.operatingCashFlow === undefined
        ? "250"
        : options.operatingCashFlow,
    PaymentsToAcquirePropertyPlantAndEquipment:
      options.ppePurchases === undefined ? "75" : options.ppePurchases,
    AssetsCurrent:
      options.currentAssets === undefined ? "800" : options.currentAssets,
    LiabilitiesCurrent:
      options.currentLiabilities === undefined
        ? "400"
        : options.currentLiabilities,
    Assets: "500",
    Liabilities: "600",
    StockholdersEquity:
      options.shareholdersEquity === undefined
        ? "-7.5"
        : options.shareholdersEquity,
  } satisfies Partial<Record<PersonalSecAnnualStatementConcept, string | null>>;
  for (const [concept, value] of Object.entries(amounts)) {
    if (options.conceptRows && Object.hasOwn(options.conceptRows, concept))
      continue;
    const entry = packet.evidence.facts.scans.find(
      (item) => item.concept === concept,
    )!;
    replaceConceptRows(
      packet,
      entry.concept,
      value === null ? [] : [{ value }],
    );
  }
  for (const [concept, rows] of Object.entries(options.conceptRows ?? {})) {
    const entry = packet.evidence.facts.scans.find(
      (item) => item.concept === concept,
    )!;
    replaceConceptRows(packet, entry.concept, rows);
  }
  if (options.cutoffAt) {
    const cutoff = Date.parse(options.cutoffAt);
    packet.evidence.generation.cutoffAt = options.cutoffAt;
    packet.evidence.generation.sources.submissions.fetchedAt = new Date(
      cutoff + 1000,
    ).toISOString();
    packet.evidence.generation.sources.companyFacts.fetchedAt = new Date(
      cutoff + 2000,
    ).toISOString();
    packet.evidence.generation.completedAt = new Date(
      cutoff + 3000,
    ).toISOString();
  }
  const bound = await bindAnnualPacket(packet);
  const admitted = await parseSecAnnualCanonicalResponse(
    bound,
    {
      schemaVersion: "6.0.0",
      catalogSnapshotSha256: bound.catalogSnapshotSha256,
      listingId: bound.security.listingId,
      symbol: bound.security.symbol,
    },
    new AbortController().signal,
  );
  if (!admitted) throw new Error("Report canonical fixture refused");
  return admitted;
}

export const reportFinancialReviewPacket = (
  options: ReportAnnualFixtureOptions = {},
) =>
  reportAnnualPacket({
    includeIncome: false,
    operatingIncome: "250.125",
    operatingCashFlow: "120.125",
    ppePurchases: "200.25",
    currentAssets: "180.025",
    currentLiabilities: "180.025",
    ...options,
  });
