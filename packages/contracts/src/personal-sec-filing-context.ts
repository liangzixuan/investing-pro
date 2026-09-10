import type { PersonalMarketDataIdentityDto } from "./index";
import type { PersonalSecQuarterlyObservationDto } from "./personal-sec-quarterly-evidence";

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
  readonly schemaVersion: "1.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listingId: string;
  readonly symbol: string;
  readonly selection: PersonalSecFilingContextSelectionDto;
}

export interface PersonalSecFilingContextResponseDto {
  readonly schemaVersion: "1.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly security: PersonalMarketDataIdentityDto & {
    readonly issuerId: string;
    readonly cik: string;
  };
  readonly inspection: PersonalSecFilingContextInspectionDto;
}
