import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecQuarterlyObservationDto,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import {
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
      },
    },
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: raw.catalogSnapshotSha256,
      listingId: raw.security.listingId,
      symbol: raw.security.symbol,
    },
    new AbortController().signal,
  );
  if (!parsed) throw new Error("Invalid invented Annual comparison packet");
  return parsed;
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
    mode === "source-unavailable" ? unavailable(packet) : packet,
  );
}

function unavailable(packet: Response): Response {
  return {
    ...packet,
    evidence: {
      ...packet.evidence,
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
