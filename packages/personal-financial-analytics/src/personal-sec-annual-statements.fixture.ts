import { createHash } from "node:crypto";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  serializePersonalSecAnnualStatementObservation,
  type PersonalSecAnnualCanonicalEvidenceDto,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementObservationDto,
  type PersonalSecAnnualStatementScanDto,
} from "@research-cockpit/contracts";

type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;
export type Fixture = Mutable<PersonalSecAnnualCanonicalEvidenceDto>;
export const accession = "0000999999-26-000001";
export const archiveUrl = `https://www.sec.gov/Archives/edgar/data/42/${accession}-index.htm`;

/** Invented evidence, with real deterministic observation hashes and no source requests. */
export function observation(
  concept: PersonalSecAnnualStatementConcept,
  index = 0,
  changes: Partial<PersonalSecAnnualStatementObservationDto> = {},
): PersonalSecAnnualStatementObservationDto {
  const instant =
    registry.find((entry) => entry.concept === concept)!.periodType ===
    "instant";
  const row: Mutable<PersonalSecAnnualStatementObservationDto> = {
    id: "sec-fact:" as const,
    taxonomy: "us-gaap" as const,
    concept,
    unit: "USD" as const,
    value: "9007199254740993.125",
    startDate: instant ? null : "2024-10-01",
    endDate: "2025-09-30",
    durationDays: instant ? null : 365,
    periodBasis: "unresolved" as const,
    filingFocusYear: 2025,
    filingFocusPeriod: "FY",
    frame: `fixture-${index}`,
    accessionNumber: accession,
    form: "10-K",
    filedDate: "2026-02-01",
    sourceLocator: `/facts/us-gaap/${concept}/units/USD/${index}`,
    filing: {
      status: "matched" as const,
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-09-30",
      acceptedAt: "2026-02-01T16:00:00.000Z",
      sourceUrl: archiveUrl,
    },
    ...changes,
  };
  if (row.startDate !== null && changes.durationDays === undefined)
    row.durationDays =
      (Date.parse(row.endDate) - Date.parse(row.startDate)) / 86400000 + 1;
  if (changes.id === undefined)
    row.id = `sec-fact:${createHash("sha256").update(serializePersonalSecAnnualStatementObservation(row)).digest("hex")}`;
  return row;
}

export function fixture(
  rows: readonly PersonalSecAnnualStatementObservationDto[] = [],
): Fixture {
  const sorted = [...rows].sort(
    (a, b) =>
      registry.findIndex((e) => e.concept === a.concept) -
        registry.findIndex((e) => e.concept === b.concept) ||
      compare(b.endDate, a.endDate) ||
      compare(b.startDate ?? "", a.startDate ?? "") ||
      compare(b.filedDate, a.filedDate) ||
      compare(a.accessionNumber, b.accessionNumber) ||
      compare(a.id, b.id),
  );
  return structuredClone({
    cik: "0000000042",
    generation: {
      definitionVersion: "6.0.0",
      cutoffAt: "2026-02-02T06:00:00.000Z",
      completedAt: "2026-02-02T06:00:03.000Z",
      sha256: `sha256:${"0".repeat(64)}` as const,
      sources: {
        companyFacts: {
          status: "available",
          sourceUrl:
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000042.json",
          fetchedAt: "2026-02-02T06:00:01.000Z",
          sha256: `sha256:${"1".repeat(64)}` as const,
          bytes: 1234,
        },
        submissions: {
          status: "available",
          sourceUrl: "https://data.sec.gov/submissions/CIK0000000042.json",
          fetchedAt: "2026-02-02T06:00:02.000Z",
          sha256: `sha256:${"2".repeat(64)}` as const,
          bytes: 567,
        },
      },
    },
    target: {
      status: "target",
      accessionNumber: accession,
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-09-30",
      acceptedAt: "2026-02-01T16:00:00.000Z",
    },
    targetScan: {
      currentFilings: 3,
      annualFilings: 1,
      olderHistoryAvailable: true,
    },
    facts: {
      registryVersion: "1.0.0",
      scans: registry.map((entry) => {
        const matches = sorted.filter((row) => row.concept === entry.concept);
        const count = matches.length;
        const candidates =
          count === 0
            ? 0
            : Math.max(
                count,
                ...matches.map(
                  (row) => Number(row.sourceLocator.split("/").at(-1)) + 1,
                ),
              );
        return {
          concept: entry.concept,
          scan: {
            status: "available",
            absence: count === 0 ? "concept_missing" : null,
            coverage: {
              full: {
                candidateRows: candidates,
                inspectedRows: candidates,
                invalidRows: 0,
                duplicateRows: candidates - count,
                uniqueObservations: count,
              },
              selected: count,
              otherAccessions: 0,
              returned: count,
              omittedSelected: 0,
            },
          },
        };
      }),
      observations: sorted,
    },
  } satisfies PersonalSecAnnualCanonicalEvidenceDto);
}
export function setScan(
  input: Fixture,
  concept: PersonalSecAnnualStatementConcept,
  scan: PersonalSecAnnualStatementScanDto,
): void {
  input.facts.scans.find((entry) => entry.concept === concept)!.scan =
    structuredClone(scan);
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
