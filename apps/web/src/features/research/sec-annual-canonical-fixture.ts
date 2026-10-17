import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  serializePersonalSecAnnualStatementObservation,
  type PersonalSecAnnualCanonicalRequestDto,
  type PersonalSecAnnualCanonicalResponseDto,
  type PersonalSecAnnualStatementConceptScanDto,
  type PersonalSecAnnualStatementObservationDto,
} from "@research-cockpit/contracts";
import { serializePersonalSecAnnualCanonicalGeneration } from "@research-cockpit/personal-financial-analytics";

export const canonicalAnnualRequest: PersonalSecAnnualCanonicalRequestDto =
  Object.freeze({
    schemaVersion: "6.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listingId: "listing-invented",
    symbol: "INVENTED",
  });
const cik = "0000000042";
const accession = "0000999999-26-000001";
const target = Object.freeze({
  status: "target",
  accessionNumber: accession,
  form: "10-K",
  filedDate: "2026-02-01",
  reportDate: "2025-12-31",
  acceptedAt: "2026-02-01T00:00:00.000Z",
} as const);

/** Invented normalized wire evidence only; no provider, API module or source request. */
export async function canonicalAnnualPacket({
  rowsPerConcept = 1,
  escapedMetadata = false,
}: {
  readonly rowsPerConcept?: number;
  readonly escapedMetadata?: boolean;
} = {}): Promise<PersonalSecAnnualCanonicalResponseDto> {
  if (
    !Number.isSafeInteger(rowsPerConcept) ||
    rowsPerConcept < 0 ||
    rowsPerConcept > 100
  )
    throw new RangeError(
      "Invented fixture rows must be from 0 to 100 per concept.",
    );
  const observations: PersonalSecAnnualStatementObservationDto[] = [];
  const scans: PersonalSecAnnualStatementConceptScanDto[] = [];
  for (const entry of PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY) {
    const conceptRows: PersonalSecAnnualStatementObservationDto[] = [];
    for (let index = 0; index < rowsPerConcept; index++) {
      const negative =
        entry.concept === "StockholdersEquity" ||
        entry.concept === "NetIncomeLoss" ||
        entry.concept === "NetCashProvidedByUsedInInvestingActivities";
      const fields = {
        taxonomy: "us-gaap",
        concept: entry.concept,
        unit: "USD",
        value: `${negative ? "-" : ""}9007199254740993.${(index * 2 + 1).toString().padStart(18, "0")}`,
        startDate: entry.periodType === "instant" ? null : "2025-01-01",
        endDate: "2025-12-31",
        durationDays: entry.periodType === "instant" ? null : 365,
        periodBasis: "unresolved",
        filingFocusYear: 2025,
        filingFocusPeriod: escapedMetadata ? '\\"'.repeat(16) : "FY",
        frame: escapedMetadata
          ? '\\"'.repeat(64)
          : entry.periodType === "instant"
            ? "CY2025Q4I"
            : "CY2025",
        accessionNumber: accession,
        form: "10-K",
        filedDate: "2026-02-01",
      } as const;
      conceptRows.push({
        id: `sec-fact:${await canonicalFixtureHash(serializePersonalSecAnnualStatementObservation(fields))}`,
        ...fields,
        sourceLocator: `/facts/us-gaap/${entry.concept}/units/USD/${index}`,
        filing: {
          status: "matched",
          form: target.form,
          filedDate: target.filedDate,
          reportDate: target.reportDate,
          acceptedAt: target.acceptedAt,
          sourceUrl: `https://www.sec.gov/Archives/edgar/data/42/${accession}-index.htm`,
        },
      });
    }
    conceptRows.sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );
    observations.push(...conceptRows);
    scans.push({
      concept: entry.concept,
      scan: {
        status: "available",
        absence: rowsPerConcept === 0 ? "empty_usd" : null,
        coverage: {
          full: {
            candidateRows: rowsPerConcept,
            inspectedRows: rowsPerConcept,
            invalidRows: 0,
            duplicateRows: 0,
            uniqueObservations: rowsPerConcept,
          },
          selected: rowsPerConcept,
          otherAccessions: 0,
          returned: rowsPerConcept,
          omittedSelected: 0,
        },
      },
    });
  }
  const packet: PersonalSecAnnualCanonicalResponseDto = {
    schemaVersion: "6.0.0",
    catalogSnapshotSha256: canonicalAnnualRequest.catalogSnapshotSha256,
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-invented",
      issuerName: "Invented Café 東京 📈",
      listingId: canonicalAnnualRequest.listingId,
      securityName: "Invented common shares",
      symbol: canonicalAnnualRequest.symbol,
      cik,
    },
    evidence: {
      cik,
      generation: {
        definitionVersion: "6.0.0",
        cutoffAt: "2026-09-20T00:00:00.000Z",
        completedAt: "2026-09-20T00:00:03.000Z",
        sources: {
          companyFacts: {
            status: "available",
            sourceUrl: `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
            fetchedAt: "2026-09-20T00:00:02.000Z",
            sha256: `sha256:${await canonicalFixtureHash("Invented Company Facts source metadata")}`,
            bytes: 1024,
          },
          submissions: {
            status: "available",
            sourceUrl: `https://data.sec.gov/submissions/CIK${cik}.json`,
            fetchedAt: "2026-09-20T00:00:01.000Z",
            sha256: `sha256:${await canonicalFixtureHash("Invented Submissions source metadata")}`,
            bytes: 512,
          },
        },
        sha256: `sha256:${"0".repeat(64)}`,
      },
      target: { ...target },
      targetScan: {
        currentFilings: 1,
        annualFilings: 1,
        olderHistoryAvailable: false,
      },
      facts: { registryVersion: "1.0.0", scans, observations },
    },
  };
  return withCanonicalAnnualGeneration(packet);
}

/** Rebind an invented packet after a test changes shaped evidence metadata. */
export async function withCanonicalAnnualGeneration(
  packet: PersonalSecAnnualCanonicalResponseDto,
): Promise<PersonalSecAnnualCanonicalResponseDto> {
  const sha256 =
    `sha256:${await canonicalFixtureHash(serializePersonalSecAnnualCanonicalGeneration(packet.evidence))}` as const;
  return {
    ...packet,
    evidence: {
      ...packet.evidence,
      generation: { ...packet.evidence.generation, sha256 },
    },
  };
}
export async function canonicalFixtureHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
