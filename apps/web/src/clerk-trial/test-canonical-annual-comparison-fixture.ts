import type { annualComparisonResponse as OriginalComparisonResponse } from "./annual-comparison-fixture";
import type {
  PersonalSecAnnualCanonicalResponseDto,
  PersonalSecAnnualStatementObservationDto,
} from "@research-cockpit/contracts";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../lib/test-personal-sec-annual-api-fixture";
import {
  admitUiPacket,
  response,
} from "../features/research/test-canonical-annual-ui-fixture";
import {
  annualComparisonRows,
  annualComparisonCashRows,
  annualComparisonLiquidityRows,
  annualComparisonMemberships,
} from "./annual-comparison-fixture";
export {
  annualComparisonRows,
  annualComparisonCashRows,
  annualComparisonLiquidityRows,
  annualComparisonOperatingRows,
  annualComparisonBalanceRows,
  annualComparisonMemberships,
} from "./annual-comparison-fixture";
export { viewOf } from "../features/research/test-canonical-annual-ui-fixture";
type Side = "left" | "right";
type Options = NonNullable<Parameters<typeof OriginalComparisonResponse>[1]>;
type Mode = NonNullable<Options["mode"]>;
const filingCoordinates = {
  left: {
    cik: "0000000001",
    accessionNumber: "0000000001-26-000001",
    filedDate: "2026-02-01",
    reportDate: "2025-12-31",
  },
  right: {
    cik: "0000000002",
    accessionNumber: "0000000002-25-000001",
    filedDate: "2025-08-01",
    reportDate: "2025-06-30",
  },
} as const;
function modeRows(side: Side, mode: Mode) {
  const rows = annualComparisonRows(side);
  const reportDate = side === "left" ? "2025-12-31" : "2025-06-30";
  if (mode === "missing-prior")
    return rows.filter((item) => item.endDate === reportDate);
  if (mode === "multiple-bases")
    return [
      ...rows,
      ...rows
        .filter((item) => item.metric === "revenue")
        .map((item) => ({
          ...item,
          concept:
            "RevenueFromContractWithCustomerExcludingAssessedTax" as const,
          value: item.endDate === reportDate ? "500" : "250",
        })),
    ];
  if (mode === "exact-decimal")
    return rows.map((item) =>
      item.metric === "revenue"
        ? {
            ...item,
            value:
              item.endDate === reportDate ? `1000.${"0".repeat(58)}1` : "1000",
          }
        : item,
    );
  return rows;
}

function locatedRows(
  side: Side,
  rows: readonly PersonalSecAnnualStatementObservationDto[],
) {
  const { cik, accessionNumber, filedDate, reportDate } =
    filingCoordinates[side];
  const nextIndex = new Map<string, number>();
  return rows.map((item) => {
    const index = nextIndex.get(item.concept) ?? 0;
    nextIndex.set(item.concept, index + 1);
    return {
      ...item,
      accessionNumber,
      filedDate,
      filing: {
        ...item.filing,
        status: "matched" as const,
        form: "10-K" as const,
        filedDate,
        reportDate,
        acceptedAt: `${filedDate}T00:00:00.000Z`,
        sourceUrl: `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${accessionNumber}-index.htm`,
      },
      sourceLocator: `/facts/us-gaap/${item.concept}/units/USD/${index}`,
    };
  });
}

/** Genuine 32-concept canonical source graph. The old envelope builder is never called. */
export async function annualComparisonResponse(
  side: Side = "left",
  options: Options = {},
) {
  const mode = options.mode ?? "default";
  const cutoff =
    options.cutoffAt ??
    (mode === "current-use-unavailable"
      ? "2028-09-20T00:00:00.000Z"
      : undefined);
  const packet = structuredClone(
    await response([], cutoff),
  ) as TestAnnualPacket;
  const { cik, accessionNumber, filedDate, reportDate } =
    filingCoordinates[side];
  const member = annualComparisonMemberships[side];
  packet.security = {
    country: member.country,
    exchangeMic: member.exchangeMic,
    issuerId: member.issuerId,
    issuerName: member.issuerName,
    listingId: member.listingId,
    securityName: member.securityName,
    symbol: member.symbol,
    cik,
  };
  packet.evidence.cik = cik;
  packet.evidence.target = {
    status: "target",
    accessionNumber,
    form: "10-K",
    filedDate,
    reportDate,
    acceptedAt: `${filedDate}T00:00:00.000Z`,
  };
  packet.evidence.generation.sources.companyFacts.sourceUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  packet.evidence.generation.sources.submissions.sourceUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const rows = [
    ...locatedRows(side, options.rows ?? modeRows(side, mode)),
    ...(options.cashRows ?? annualComparisonCashRows(side)),
    ...(options.liquidityRows ?? annualComparisonLiquidityRows(side)),
    ...(options.operatingRows ?? []),
    ...(options.balanceRows ?? []),
  ];
  setRows(packet, rows);
  if (mode === "income-invalid") {
    const concepts = new Set([
      "Revenues",
      "SalesRevenueNet",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "NetIncomeLoss",
    ]);
    packet.evidence.facts.observations =
      packet.evidence.facts.observations.filter(
        (row) => !concepts.has(row.concept),
      );
    for (const item of packet.evidence.facts.scans)
      if (concepts.has(item.concept))
        item.scan = {
          status: "invalid_response",
          absence: null,
          coverage: null,
        };
  }
  if (mode === "source-unavailable") {
    Object.assign(packet.evidence.generation.sources.companyFacts, {
      status: "upstream_unavailable",
      fetchedAt: null,
      bytes: null,
      sha256: null,
    });
    packet.evidence.facts.observations = [];
    for (const item of packet.evidence.facts.scans)
      item.scan = {
        status: "source_unavailable",
        absence: null,
        coverage: null,
      };
  }
  return parseAnnualComparisonFixture(packet);
}
function setRows(
  packet: TestAnnualPacket,
  rows: readonly PersonalSecAnnualStatementObservationDto[],
) {
  packet.evidence.facts.observations = [];
  const target = packet.evidence.target;
  for (const item of packet.evidence.facts.scans) {
    const all = rows.filter((row) => row.concept === item.concept);
    const selected =
      target.status === "target"
        ? all.filter((row) => row.accessionNumber === target.accessionNumber)
        : [];
    const included = selected.length <= 100 ? selected : [];
    packet.evidence.facts.observations.push(
      ...included.map((row) => {
        const fields = structuredClone(row);
        Reflect.deleteProperty(fields, "metric");
        return fields;
      }),
    );
    item.scan = {
      status: "available",
      absence: all.length === 0 ? "concept_missing" : null,
      coverage: {
        full: {
          candidateRows: all.length,
          inspectedRows: all.length,
          invalidRows: 0,
          duplicateRows: 0,
          uniqueObservations: all.length,
        },
        selected: target.status === "target" ? selected.length : null,
        otherAccessions:
          target.status === "target" ? all.length - selected.length : null,
        returned: included.length,
        omittedSelected:
          target.status === "target" ? selected.length - included.length : null,
      },
    };
  }
}
export async function parseAnnualComparisonFixture(
  raw: PersonalSecAnnualCanonicalResponseDto,
  cashRows?: readonly PersonalSecAnnualStatementObservationDto[],
  liquidityRows?: readonly PersonalSecAnnualStatementObservationDto[],
  operatingRows?: readonly PersonalSecAnnualStatementObservationDto[],
  balanceRows?: readonly PersonalSecAnnualStatementObservationDto[],
) {
  const packet = structuredClone(raw) as TestAnnualPacket;
  const groups = [
    {
      concepts: [
        "NetCashProvidedByUsedInOperatingActivities",
        "PaymentsToAcquirePropertyPlantAndEquipment",
      ],
      rows: cashRows,
    },
    { concepts: ["AssetsCurrent", "LiabilitiesCurrent"], rows: liquidityRows },
    { concepts: ["OperatingIncomeLoss"], rows: operatingRows },
    {
      concepts: ["Assets", "Liabilities", "StockholdersEquity"],
      rows: balanceRows,
    },
  ];
  for (const group of groups)
    if (group.rows !== undefined) {
      const rows = [
        ...packet.evidence.facts.observations.filter(
          (row) => !group.concepts.includes(row.concept),
        ),
        ...group.rows,
      ];
      const unaffected = packet.evidence.facts.scans
        .filter((item) => !group.concepts.includes(item.concept))
        .map((item) => structuredClone(item));
      setRows(packet, rows);
      for (const original of unaffected)
        packet.evidence.facts.scans[
          packet.evidence.facts.scans.findIndex(
            (item) => item.concept === original.concept,
          )
        ] = original;
    }
  return admitUiPacket(await bindAnnualPacket(packet));
}
