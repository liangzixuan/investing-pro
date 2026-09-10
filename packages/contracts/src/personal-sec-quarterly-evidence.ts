import type { PersonalMarketDataIdentityDto } from "./index";

export const PERSONAL_SEC_QUARTERLY_CONCEPTS = Object.freeze([
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
  "NetIncomeLoss",
] as const);

export const PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS = Object.freeze({
  responseBytes: 8 * 1024 * 1024,
  requestTimeoutMs: 10_000,
  candidateRows: 20_000,
  submissionRows: 10_000,
  observationsPerMetric: 100,
  observations: 200,
  decimalCharacters: 64,
});

export type PersonalSecQuarterlyConcept =
  (typeof PERSONAL_SEC_QUARTERLY_CONCEPTS)[number];

export type PersonalSecQuarterlySourceStatus =
  | "available"
  | "not_covered"
  | "rate_limited"
  | "upstream_unavailable"
  | "invalid_response"
  | "response_too_large"
  | "candidate_limit";

export interface PersonalSecQuarterlyObservationDto {
  /** SHA-256 of normalized source fields; the first identical row keeps its locator. */
  readonly id: `sec-fact:${string}`;
  readonly metric: "revenue" | "net_income";
  readonly taxonomy: "us-gaap";
  readonly concept: PersonalSecQuarterlyConcept;
  readonly unit: "USD";
  readonly value: string;
  readonly startDate: string | null;
  readonly endDate: string;
  /** Inclusive calendar days; a duration is not a fiscal-quarter classification. */
  readonly durationDays: number | null;
  readonly periodBasis: "unresolved";
  readonly filingFocusYear: number | null;
  readonly filingFocusPeriod: string | null;
  readonly frame: string | null;
  readonly accessionNumber: string;
  readonly form: string;
  readonly filedDate: string;
  /** JSON pointer in the fixed Company Facts source, never a fetchable URL. */
  readonly sourceLocator: string;
  readonly filing: Readonly<{
    status:
      | "matched"
      | "metadata_conflict"
      | "not_in_current_submissions"
      | "submissions_unavailable";
    form: string | null;
    filedDate: string | null;
    reportDate: string | null;
    /** Source acceptance timestamp; does not establish first public availability. */
    acceptedAt: string | null;
    sourceUrl: string | null;
  }>;
}

export interface PersonalSecQuarterlyEvidenceDto {
  readonly cik: string;
  readonly fetchedAt: string;
  readonly sources: Readonly<{
    companyFacts: Readonly<{
      status: PersonalSecQuarterlySourceStatus;
      sourceUrl: string;
    }>;
    submissions: Readonly<{
      status: PersonalSecQuarterlySourceStatus;
      sourceUrl: string;
    }>;
  }>;
  readonly olderHistoryAvailable: boolean;
  readonly coverage: Readonly<{
    /** Inspected requested USD rows, including invalid and duplicate rows. */
    inspectedRows: number;
    invalidRows: number;
    duplicateRows: number;
    /** Unique valid observations before the per-metric output cap. */
    availableObservations: number;
    returnedObservations: number;
    truncated: boolean;
    conceptsWithoutUsd: readonly PersonalSecQuarterlyConcept[];
  }>;
  readonly observations: readonly PersonalSecQuarterlyObservationDto[];
  readonly ttm: Readonly<{
    status: "unavailable";
    reason: "period_and_revision_not_admitted";
  }>;
}

export interface PersonalSecQuarterlyEvidenceRequestDto {
  readonly schemaVersion: "1.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listingId: string;
  readonly symbol: string;
}

export interface PersonalSecQuarterlyEvidenceResponseDto {
  readonly schemaVersion: "1.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly security: PersonalMarketDataIdentityDto & {
    readonly issuerId: string;
    readonly cik: string;
  };
  readonly evidence: PersonalSecQuarterlyEvidenceDto;
}
