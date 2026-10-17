import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecQuarterlyObservationDto,
  type PersonalSecAnnualCanonicalRequestDto,
} from "@research-cockpit/contracts";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../../lib/test-personal-sec-annual-api-fixture";
import {
  response,
  row,
  admitUiPacket,
} from "./test-canonical-annual-ui-fixture";
export {
  response,
  row,
  annualComparativeRows,
  annualHistoryRows,
  viewOf,
  admitUiPacket,
} from "./test-canonical-annual-ui-fixture";
export function request(): PersonalSecAnnualCanonicalRequestDto {
  return {
    schemaVersion: "6.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listingId: "listing-zero",
    symbol: "ZERO",
  };
}
async function withConcepts(
  values: Partial<Record<PersonalSecAnnualStatementConcept, string | null>>,
  incomeRows: readonly PersonalSecQuarterlyObservationDto[] = [],
  cutoffAt?: string,
) {
  const packet = structuredClone(
    await response(incomeRows, cutoffAt),
  ) as TestAnnualPacket;
  for (const entry of registry) {
    if (!Object.hasOwn(values, entry.concept)) continue;
    const value = values[entry.concept];
    packet.evidence.facts.observations =
      packet.evidence.facts.observations.filter(
        (item) => item.concept !== entry.concept,
      );
    const count = value == null ? 0 : 1;
    packet.evidence.facts.scans.find(
      (item) => item.concept === entry.concept,
    )!.scan = {
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
    if (value != null) {
      const { metric, ...fields } = row();
      void metric;
      packet.evidence.facts.observations.push({
        ...fields,
        concept: entry.concept,
        value,
        sourceLocator: `/facts/us-gaap/${entry.concept}/units/USD/0`,
        ...(entry.periodType === "instant"
          ? { startDate: null, durationDays: null, frame: "CY2025Q4I" }
          : {}),
      });
    }
  }
  return packet;
}
export async function financialReviewResponse({
  operatingIncome = "250.125",
  cutoffAt,
}: {
  readonly operatingIncome?: string | null;
  readonly cutoffAt?: string;
} = {}) {
  const packet = await withConcepts(
    {
      OperatingIncomeLoss: operatingIncome,
      NetCashProvidedByUsedInOperatingActivities: "120.125",
      PaymentsToAcquirePropertyPlantAndEquipment: "200.25",
      AssetsCurrent: "100",
      LiabilitiesCurrent: "100",
      Assets: "1000",
      Liabilities: "1007.5",
      StockholdersEquity: "-7.5",
    },
    [],
    cutoffAt,
  );
  return admitUiPacket(await bindAnnualPacket(packet));
}
export async function incomeRefusalResponse(
  status: "invalid_response" | "candidate_limit",
) {
  const packet = structuredClone(await response([])) as TestAnnualPacket;
  for (const item of packet.evidence.facts.scans)
    if (
      [
        "Revenues",
        "SalesRevenueNet",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "NetIncomeLoss",
      ].includes(item.concept)
    )
      item.scan = { status, absence: null, coverage: null };
  return admitUiPacket(await bindAnnualPacket(packet));
}
export async function unavailableReadResponse(
  cutoffAt = "2026-09-21T00:00:00.000Z",
) {
  const packet = structuredClone(
    await response([], cutoffAt),
  ) as TestAnnualPacket;
  Object.assign(packet.evidence.generation.sources.companyFacts, {
    status: "upstream_unavailable",
    fetchedAt: null,
    bytes: null,
    sha256: null,
  });
  for (const item of packet.evidence.facts.scans)
    item.scan = { status: "source_unavailable", absence: null, coverage: null };
  return admitUiPacket(await bindAnnualPacket(packet));
}
export async function navigationResponse(
  side: "left" | "right" = "left",
  {
    mode = "default",
    rows = [row(), row("NetIncomeLoss", "100")],
  }: {
    readonly mode?: "default" | "income-invalid";
    readonly rows?: readonly PersonalSecQuarterlyObservationDto[];
  } = {},
) {
  const packet = await withConcepts(
    {
      NetCashProvidedByUsedInOperatingActivities: "1000",
      PaymentsToAcquirePropertyPlantAndEquipment: "250",
      AssetsCurrent: "1000",
      LiabilitiesCurrent: "400",
    },
    rows,
  );
  if (mode === "income-invalid") {
    packet.evidence.facts.observations =
      packet.evidence.facts.observations.filter(
        (item) => item.concept !== "NetIncomeLoss",
      );
    packet.evidence.facts.scans.find(
      (item) => item.concept === "NetIncomeLoss",
    )!.scan = { status: "invalid_response", absence: null, coverage: null };
  }
  if (side === "right") {
    Object.assign(packet.security, {
      issuerId: "issuer-one",
      issuerName: "One Company",
      listingId: "listing-one",
      securityName: "One Class A",
      symbol: "ONE",
      cik: "0000000002",
    });
    packet.evidence.cik = "0000000002";
    if (packet.evidence.target.status !== "target")
      throw new Error("Expected invented target");
    packet.evidence.target.accessionNumber = "0000000002-26-000001";
    packet.evidence.generation.sources.companyFacts.sourceUrl =
      "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000002.json";
    packet.evidence.generation.sources.submissions.sourceUrl =
      "https://data.sec.gov/submissions/CIK0000000002.json";
    for (const item of packet.evidence.facts.observations) {
      item.accessionNumber = packet.evidence.target.accessionNumber;
      item.filing.sourceUrl =
        "https://www.sec.gov/Archives/edgar/data/2/0000000002-26-000001-index.htm";
    }
  }
  return admitUiPacket(await bindAnnualPacket(packet));
}
