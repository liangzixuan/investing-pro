import type {
  PersonalSecAnnualEvidenceRequestDto,
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualResolutionInput,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualEvidence,
  serializePersonalSecAnnualGeneration,
} from "@research-cockpit/personal-financial-analytics";

type Wire = PersonalSecAnnualEvidenceResponseDto;
// Invented annual packets shared by the UI and transport boundary tests.
export function request(): PersonalSecAnnualEvidenceRequestDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listingId: "listing-zero",
    symbol: "ZERO",
  };
}
export function row(
  concept: PersonalSecQuarterlyObservationDto["concept"] = "Revenues",
  value = "1000",
  changes: Partial<PersonalSecQuarterlyObservationDto> = {},
): PersonalSecQuarterlyObservationDto {
  return {
    id: `sec-fact:${"0".repeat(64)}`,
    metric: concept === "NetIncomeLoss" ? "net_income" : "revenue",
    taxonomy: "us-gaap",
    concept,
    unit: "USD",
    value,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    durationDays: 365,
    periodBasis: "unresolved",
    filingFocusYear: 2025,
    filingFocusPeriod: "FY",
    frame: "CY2025",
    accessionNumber: "0000000001-26-000001",
    form: "10-K",
    filedDate: "2026-02-01",
    sourceLocator: `/facts/us-gaap/${concept}/units/USD/0`,
    filing: {
      status: "matched",
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T00:00:00.000Z",
      sourceUrl:
        "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
    },
    ...changes,
  };
}
async function hash(value: string): Promise<`sha256:${string}`> {
  return `sha256:${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
export function annualComparativeRows() {
  const prior = {
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    durationDays: 366,
    frame: "CY2024",
  };
  return [
    row(),
    row("NetIncomeLoss", "100"),
    row("Revenues", "800", prior),
    row("NetIncomeLoss", "80", prior),
  ];
}
export async function response(
  rows = [row(), row("NetIncomeLoss", "100")],
  cutoffAt = "2026-09-20T00:00:00.000Z",
): Promise<Wire> {
  const capturedAt = (seconds: number) =>
    new Date(Date.parse(cutoffAt) + seconds * 1000).toISOString();
  const observations = await Promise.all(
    rows.map(async (item) => {
      const fields = Object.fromEntries(
        Object.entries(item).filter(
          ([key]) => !["id", "sourceLocator", "filing"].includes(key),
        ),
      );
      return {
        ...item,
        id: `sec-fact:${(await hash(JSON.stringify(fields))).slice(7)}` as const,
      };
    }),
  );
  observations.sort(
    (a, b) =>
      b.endDate.localeCompare(a.endDate) ||
      (b.startDate ?? "").localeCompare(a.startDate ?? "") ||
      b.filedDate.localeCompare(a.filedDate) ||
      a.accessionNumber.localeCompare(b.accessionNumber) ||
      a.concept.localeCompare(b.concept) ||
      a.id.localeCompare(b.id),
  );
  const counts = {
    observations: observations.length,
    revenue: observations.filter((o) => o.metric === "revenue").length,
    netIncome: observations.filter((o) => o.metric === "net_income").length,
  };
  const zero = { observations: 0, revenue: 0, netIncome: 0 };
  const input: PersonalSecAnnualResolutionInput = {
    cik: "0000000001",
    generation: {
      definitionVersion: "1.0.0",
      cutoffAt,
      completedAt: capturedAt(2),
      sha256: `sha256:${"0".repeat(64)}`,
      sources: {
        companyFacts: {
          status: "available",
          sourceUrl:
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
          fetchedAt: capturedAt(1),
          bytes: 1000,
          sha256: `sha256:${"b".repeat(64)}`,
        },
        submissions: {
          status: "available",
          sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
          fetchedAt: capturedAt(2),
          bytes: 500,
          sha256: `sha256:${"c".repeat(64)}`,
        },
      },
    },
    target: {
      status: "target",
      accessionNumber: "0000000001-26-000001",
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T00:00:00.000Z",
    },
    targetScan: {
      currentFilings: 1,
      annualFilings: 1,
      olderHistoryAvailable: false,
    },
    completeness: { status: "complete", reason: null },
    coverage: {
      full: {
        ...counts,
        inspectedRows: observations.length,
        invalidRows: 0,
        duplicateRows: 0,
        uniqueObservations: observations.length,
        conceptsWithoutUsd: [],
      },
      selected: counts,
      otherAccessions: zero,
      returned: counts,
      omittedSelected: zero,
      history: { returned: counts, truncated: false },
    },
    observations,
  };
  const generation = {
    ...input.generation,
    sha256: await hash(serializePersonalSecAnnualGeneration(input)),
  };
  const evidence = { ...input, generation };
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: request().catalogSnapshotSha256,
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Company",
      listingId: "listing-zero",
      securityName: "Zero Class A",
      symbol: "ZERO",
      cik: "0000000001",
    },
    evidence: {
      ...evidence,
      resolution: resolvePersonalSecAnnualEvidence(evidence),
    },
  };
}
