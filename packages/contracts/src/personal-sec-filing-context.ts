import type { PersonalMarketDataIdentityDto } from "./index";
import type { PersonalSecQuarterlyObservationDto } from "./personal-sec-quarterly-evidence";

export const PERSONAL_SEC_FILING_CONTEXT_SCHEMA_VERSION = "2.0.0" as const;
export const PERSONAL_SEC_FILING_REPORTING_CONCEPTS = Object.freeze([
  "DocumentType",
  "DocumentPeriodEndDate",
  "DocumentFiscalYearFocus",
  "DocumentFiscalPeriodFocus",
] as const);
/** Explicit SEC schema targetNamespace values; these are identifiers, not fetch URLs. */
export const PERSONAL_SEC_FILING_DEI_NAMESPACES = Object.freeze([
  "http://xbrl.sec.gov/dei/2024",
  "http://xbrl.sec.gov/dei/2025",
  "http://xbrl.sec.gov/dei/2026",
] as const);

export const PERSONAL_SEC_FILING_CONTEXT_LIMITS = Object.freeze({
  documentBytes: 32 * 1024 * 1024,
  workerTimeoutMs: 10_000,
  workerInputBytes: 45 * 1024 * 1024,
  workerOutputBytes: 1024 * 1024,
  workerStderrBytes: 16 * 1024,
  nodes: 1_000_000,
  depth: 256,
  attributesPerElement: 64,
  contexts: 20_000,
  units: 5_000,
  candidates: 100,
  dimensionsPerContext: 32,
  unitMeasures: 32,
  identifierCharacters: 256,
  namespaceCharacters: 256,
  rawTextCharacters: 4096,
  decimalCharacters: 64,
  metadataCandidates: 40,
  metadataOutputBytes: 128 * 1024,
});

/** A browser request identifies a selection; only fresh server sources revalidate it. */
export type PersonalSecFilingContextSelectionDto = Pick<
  PersonalSecQuarterlyObservationDto,
  | "id"
  | "metric"
  | "taxonomy"
  | "concept"
  | "unit"
  | "value"
  | "startDate"
  | "endDate"
  | "accessionNumber"
  | "form"
  | "filedDate"
>;

export type PersonalSecFilingContextIssue =
  | "invalid_document"
  | "document_limit"
  | "node_limit"
  | "depth_limit"
  | "attribute_limit"
  | "context_limit"
  | "unit_limit"
  | "candidate_limit"
  | "output_limit"
  | "duplicate_id"
  | "invalid_namespace"
  | "invalid_identifier"
  | "malformed_context"
  | "unresolved_context"
  | "unsupported_entity"
  | "entity_mismatch"
  | "unsupported_dimensions"
  | "unsupported_unit"
  | "unresolved_unit"
  | "unsupported_period"
  | "period_mismatch"
  | "unsupported_inline"
  | "unsupported_transform"
  | "invalid_numeric"
  | "decimal_limit";

export interface PersonalSecFilingContextQNameDto {
  readonly raw: string;
  readonly namespace: string | null;
  readonly localName: string | null;
}

export interface PersonalSecFilingContextCandidateDto {
  /** One-based document element position, independent of potentially absent IDs. */
  readonly locator: string;
  readonly factId: string | null;
  readonly contextId: string | null;
  readonly unitId: string | null;
  readonly concept: PersonalSecFilingContextQNameDto;
  readonly entityIdentifier: string | null;
  readonly entityScheme: string | null;
  readonly entityCik: string | null;
  readonly dimensions: readonly Readonly<{
    kind: "explicit" | "typed";
    dimension: PersonalSecFilingContextQNameDto;
    member: PersonalSecFilingContextQNameDto | null;
    typedText: string | null;
  }>[];
  readonly periodKind: "duration" | "instant" | "unsupported";
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly unit: "USD" | null;
  readonly unitMeasures: readonly PersonalSecFilingContextQNameDto[];
  readonly rawText: string;
  readonly format: PersonalSecFilingContextQNameDto | null;
  readonly sign: string | null;
  readonly scale: string | null;
  readonly decimals: string | null;
  readonly precision: string | null;
  readonly value: string | null;
  readonly issues: readonly PersonalSecFilingContextIssue[];
}

export interface PersonalSecFilingContextParserResultDto {
  readonly schemaVersion: "2.0.0";
  readonly status:
    | "matched"
    | "value_differs"
    | "ambiguous"
    | "no_corresponding_fact"
    | "unsupported";
  /** A global failure has no partial-prefix candidates; row issues remain on each row. */
  readonly reason: PersonalSecFilingContextIssue | null;
  readonly candidates: readonly PersonalSecFilingContextCandidateDto[];
  readonly correspondingCandidateLocators: readonly string[];
  readonly reportingMetadata: PersonalSecFilingReportingMetadataDto;
}

export type PersonalSecFilingReportingConcept =
  (typeof PERSONAL_SEC_FILING_REPORTING_CONCEPTS)[number];
export type PersonalSecFilingReportingIssue =
  PersonalSecFilingContextIssue | "invalid_metadata_value";
export type PersonalSecFilingReportingObservationDto = Pick<
  PersonalSecFilingContextCandidateDto,
  | "locator"
  | "factId"
  | "contextId"
  | "concept"
  | "entityIdentifier"
  | "entityScheme"
  | "entityCik"
  | "dimensions"
  | "periodKind"
  | "startDate"
  | "endDate"
  | "rawText"
  | "format"
  | "value"
> & {
  readonly issues: readonly PersonalSecFilingReportingIssue[];
};
export interface PersonalSecFilingReportingFieldDto {
  readonly concept: PersonalSecFilingReportingConcept;
  readonly status: "observed" | "missing" | "conflicting" | "unsupported";
  readonly value: string | null;
  /** All retained references for this concept, including excluded/unsupported rows. */
  readonly observationLocators: readonly string[];
}
export interface PersonalSecFilingReportingMetadataDto {
  readonly status: "assessed" | "limited" | "unavailable";
  readonly reason: PersonalSecFilingContextIssue | null;
  /** Exactly the four concepts in PERSONAL_SEC_FILING_REPORTING_CONCEPTS order. */
  readonly fields: readonly PersonalSecFilingReportingFieldDto[];
  readonly observations: readonly PersonalSecFilingReportingObservationDto[];
}

/** Empty typed projection for an assessed document with no retained DEI facts. */
export function createEmptyPersonalSecFilingReportingMetadata(): PersonalSecFilingReportingMetadataDto {
  return Object.freeze({
    status: "assessed",
    reason: null,
    fields: Object.freeze(
      PERSONAL_SEC_FILING_REPORTING_CONCEPTS.map((concept) =>
        Object.freeze({
          concept,
          status: "missing" as const,
          value: null,
          observationLocators: Object.freeze([]),
        }),
      ),
    ),
    observations: Object.freeze([]),
  });
}

export type PersonalSecFilingContextUnavailableReason =
  | "selection_changed_or_not_retained"
  | "accession_not_in_current_submissions"
  | "submission_metadata_conflict"
  | "primary_document_unavailable"
  | "not_covered"
  | "rate_limited"
  | "upstream_unavailable"
  | "invalid_response"
  | "response_too_large"
  | "candidate_limit"
  | "runtime_unavailable"
  | "parser_timeout"
  | "worker_failed"
  | "invalid_output"
  | "output_too_large";

export type PersonalSecFilingContextInspectionDto =
  | Readonly<{
      status: "unavailable";
      cik: string;
      stage: "company_facts" | "submissions" | "document" | "parser";
      reason: PersonalSecFilingContextUnavailableReason;
    }>
  | Readonly<{
      status: "available";
      cik: string;
      observation: PersonalSecQuarterlyObservationDto;
      companyFacts: Readonly<{ sourceUrl: string; fetchedAt: string }>;
      submissions: Readonly<{ sourceUrl: string; fetchedAt: string }>;
      document: Readonly<{
        sourceUrl: string;
        fetchedAt: string;
        sha256: `sha256:${string}`;
        bytes: number;
      }>;
      analysis: PersonalSecFilingContextParserResultDto;
    }>;

export interface PersonalSecFilingContextRequestDto {
  readonly schemaVersion: "2.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listingId: string;
  readonly symbol: string;
  readonly selection: PersonalSecFilingContextSelectionDto;
}

export interface PersonalSecFilingContextResponseDto {
  readonly schemaVersion: "2.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly security: PersonalMarketDataIdentityDto & {
    readonly issuerId: string;
    readonly cik: string;
  };
  readonly inspection: PersonalSecFilingContextInspectionDto;
}
