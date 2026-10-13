import { liquidity } from "../features/research/sec-annual-liquidity-fixture";
import {
  cashGeneration,
  cashRow,
} from "../features/research/sec-annual-cash-fixture";
import type {
  PersonalSecAnnualCashObservationDto,
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecQuarterlyObservationDto,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import {
  getPersonalSecAnnualRefusalReason,
  resolvePersonalSecAnnualEvidence,
  serializePersonalSecAnnualGeneration,
} from "@research-cockpit/personal-financial-analytics";
import {
  annualComparativeRows,
  response as annualResponse,
} from "../features/research/sec-annual-evidence-fixture";
import { parseSecAnnualEvidenceResponse } from "../lib/sec-annual-evidence-response";
import { eodSelection } from "./eod-history-fixture";

type Response = PersonalSecAnnualEvidenceResponseDto;
type Side = "left" | "right";
type Mode =
  | "default"
  | "multiple-bases"
  | "exact-decimal"
  | "missing-prior"
  | "current-use-unavailable"
  | "income-invalid"
  | "source-unavailable";

/** Invented identities and complete packets for tests and isolated previews only. */
export const annualComparisonMemberships: Readonly<
  Record<Side, WatchlistMembership>
> = {
  left: { ...eodSelection.listing, note: "Calendar company research: Café 😀" },
  right: {
    ...eodSelection.listing,
    listingId: "listing-one",
    issuerId: "issuer-one",
    issuerName: "One Company",
    securityId: "security-one",
    securityName: "One Class A",
    shareClassId: "class-one",
    symbol: "ONE",
    note: "Fiscal company research\nKeep this exact note.",
  },
};

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

export function annualComparisonRows(side: Side = "left") {
  if (side === "left") return annualComparativeRows();
  return annualComparativeRows().map((item) => {
    const current = item.endDate === "2025-12-31";
    const revenue = item.metric === "revenue";
    return {
      ...item,
      concept: revenue ? ("SalesRevenueNet" as const) : item.concept,
      value: revenue ? (current ? "750" : "600") : current ? "150" : "90",
      startDate: current ? "2024-07-01" : "2023-07-01",
      endDate: current ? "2025-06-30" : "2024-06-30",
      durationDays: current ? 365 : 366,
      frame: null,
    };
  });
}

export async function parseAnnualComparisonFixture(
  raw: Response,
  cashRows: readonly PersonalSecAnnualCashObservationDto[] = [
    ...raw.evidence.cashGeneration.operatingCashFlow.observations,
    ...raw.evidence.cashGeneration.ppePurchases.observations,
  ],
): Promise<Response> {
  const bytes = new TextEncoder().encode(
    serializePersonalSecAnnualGeneration(raw.evidence),
  );
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const evidence = {
    ...raw.evidence,
    generation: {
      ...raw.evidence.generation,
      sha256: `sha256:${digest}` as const,
    },
  };
  const parsed = await parseSecAnnualEvidenceResponse(
    {
      ...raw,
      evidence: {
        ...evidence,
        resolution: resolvePersonalSecAnnualEvidence(evidence),
        cashGeneration: await cashGeneration(evidence, cashRows),
        liquidity: await liquidity(evidence, [
          ...raw.evidence.liquidity.currentAssets.observations,
          ...raw.evidence.liquidity.currentLiabilities.observations,
        ]),
      },
    },
    {
      schemaVersion: "3.0.0",
      catalogSnapshotSha256: raw.catalogSnapshotSha256,
      listingId: raw.security.listingId,
      symbol: raw.security.symbol,
    },
    new AbortController().signal,
  );
  if (!parsed) throw new Error("Invalid invented Annual comparison packet");
  return parsed;
}

export function annualComparisonCashRows(
  side: Side = "left",
): PersonalSecAnnualCashObservationDto[] {
  const { cik, accessionNumber, filedDate, reportDate } =
    filingCoordinates[side];
  const coordinates = {
    startDate: side === "left" ? "2025-01-01" : "2024-07-01",
    endDate: reportDate,
    durationDays: 365,
    accessionNumber,
    form: "10-K" as const,
    filedDate,
    frame: null,
    filing: {
      status: "matched" as const,
      form: "10-K" as const,
      filedDate,
      reportDate,
      acceptedAt: `${filedDate}T00:00:00.000Z`,
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${accessionNumber}-index.htm`,
    },
  };
  return [
    cashRow(
      "operating_cash_flow",
      side === "left" ? "1000" : "900",
      coordinates,
    ),
    cashRow("ppe_purchases", side === "left" ? "250" : "300", coordinates),
  ];
}

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
  rows: readonly PersonalSecQuarterlyObservationDto[],
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

export async function annualComparisonResponse(
  side: Side = "left",
  options: {
    readonly mode?: Mode;
    readonly rows?: PersonalSecQuarterlyObservationDto[];
    readonly cashRows?: readonly PersonalSecAnnualCashObservationDto[];
    readonly cutoffAt?: string;
  } = {},
): Promise<Response> {
  const mode = options.mode ?? "default";
  const cutoffAt =
    options.cutoffAt ??
    (mode === "current-use-unavailable"
      ? "2028-09-20T00:00:00.000Z"
      : "2026-09-20T00:00:00.000Z");
  const raw = await annualResponse(
    options.rows ?? modeRows(side, mode),
    cutoffAt,
  );
  const observations = await Promise.all(
    locatedRows(side, raw.evidence.observations).map(hashObservation),
  );
  const member = annualComparisonMemberships[side];
  const { cik, accessionNumber, filedDate, reportDate } =
    filingCoordinates[side];
  const evidence = {
    ...raw.evidence,
    observations,
    cik,
    target: {
      status: "target" as const,
      accessionNumber,
      form: "10-K" as const,
      filedDate,
      reportDate,
      acceptedAt: `${filedDate}T00:00:00.000Z`,
    },
    generation: {
      ...raw.evidence.generation,
      sources: {
        companyFacts: {
          ...raw.evidence.generation.sources.companyFacts,
          sourceUrl: `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
        },
        submissions: {
          ...raw.evidence.generation.sources.submissions,
          sourceUrl: `https://data.sec.gov/submissions/CIK${cik}.json`,
        },
      },
    },
  };
  const packet: Response = {
    ...raw,
    security: {
      country: member.country,
      exchangeMic: member.exchangeMic,
      issuerId: member.issuerId,
      issuerName: member.issuerName,
      listingId: member.listingId,
      securityName: member.securityName,
      symbol: member.symbol,
      cik,
    },
    evidence,
  };
  return parseAnnualComparisonFixture(
    mode === "source-unavailable"
      ? unavailable(packet)
      : mode === "income-invalid"
        ? incomeUnavailable(packet)
        : packet,
    options.cashRows ?? annualComparisonCashRows(side),
  );
}

function incomeUnavailable(packet: Response): Response {
  const evidence = {
    ...packet.evidence,
    incomeScanStatus: "invalid_response" as const,
    observations: [],
    coverage: null,
  };
  const reason = getPersonalSecAnnualRefusalReason(evidence);
  if (reason === null) throw new Error("Invented income refusal required");
  return {
    ...packet,
    evidence: {
      ...evidence,
      completeness: { status: "refused", reason },
    },
  };
}

function unavailable(packet: Response): Response {
  return {
    ...packet,
    evidence: {
      ...packet.evidence,
      incomeScanStatus: "source_unavailable",
      completeness: { status: "refused", reason: "source_unavailable" },
      observations: [],
      coverage: null,
      generation: {
        ...packet.evidence.generation,
        sources: {
          ...packet.evidence.generation.sources,
          companyFacts: {
            ...packet.evidence.generation.sources.companyFacts,
            status: "upstream_unavailable",
            fetchedAt: null,
            bytes: null,
            sha256: null,
          },
        },
      },
    },
  };
}

async function hashObservation(
  item: PersonalSecQuarterlyObservationDto,
): Promise<PersonalSecQuarterlyObservationDto> {
  const fields = Object.fromEntries(
    Object.entries(item).filter(
      ([key]) => !["id", "sourceLocator", "filing"].includes(key),
    ),
  );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(fields)),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return { ...item, id: `sec-fact:${hash}` };
}
