import type { PersonalMarketDataIdentityDto } from "./index";
import type { PersonalSecQuarterlyConcept } from "./personal-sec-quarterly-evidence";
import type {
  PersonalSecQuarterPrimaryEvidenceDto,
  QuarterPrimaryFailureReason,
} from "./personal-sec-quarter-assessment-evidence";

export type Sha256 = `sha256:${string}`;
export type EvidenceId = string;
export type SourceId = "submissions" | "company_facts" | "primary";
export type Metric = "revenue" | "net_income";
export type Period = Readonly<{ startDate: string; endDate: string }>;

export const PERSONAL_SEC_QUARTER_ASSESSMENT_SCHEMA_VERSION = "1.0.0" as const;
export const PERSONAL_SEC_QUARTER_PROJECTOR_VERSION =
  "company-facts-occurrences-1.0.0" as const;
export const PERSONAL_SEC_QUARTER_PARSER_VERSION =
  "accession-evidence-1.0.0" as const;
export const PERSONAL_SEC_QUARTER_PROFILE_VERSION =
  "standalone-quarter-profiles-1.0.0" as const;
export const PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS = {
  sourceGets: 3,
  companyFactsBytes: 8 * 1024 * 1024,
  submissionsBytes: 8 * 1024 * 1024,
  primaryBytes: 32 * 1024 * 1024,
  operationDeadlineMs: 60_000,
  requestTimeoutMs: 10_000,
  workerInputBytes: 45 * 1024 * 1024,
  workerOutputBytes: 1024 * 1024,
  workerStderrBytes: 16 * 1024,
  workerTimeoutMs: 10_000,
  primaryCandidatesPerConcept: 512,
  primaryCandidatesTotal: 2048,
  companyFactsInspectedRows: 20_000,
  companyFactsRowsPerConcept: 512,
  companyFactsRowsTotal: 2048,
  companyFactsProjectionBytes: 256 * 1024,
  structuralRecords: 4096,
  structuralBytes: 256 * 1024,
  metadataCandidates: 40,
  metadataBytes: 128 * 1024,
  recordTextCharacters: 4096,
  tables: 64,
  rowsPerTable: 256,
  logicalColumns: 64,
  span: 64,
  finalResponseBytes: 2 * 1024 * 1024,
  jsonDepth: 256,
  decimalCharacters: 64,
} as const;

export interface PersonalSecQuarterAssessmentSelectionDto {
  readonly accessionNumber: string;
  readonly form: "10-Q" | "10-Q/A";
  readonly filedDate: string;
  readonly reportDate: string | null;
}

export interface PersonalSecQuarterAssessmentRequestDto {
  readonly schemaVersion: "1.0.0";
  readonly catalogSnapshotSha256: Sha256;
  readonly listingId: string;
  readonly symbol: string;
  readonly selection: PersonalSecQuarterAssessmentSelectionDto;
}

export interface PersonalSecQuarterAssessmentTargetDto {
  readonly catalogSnapshotSha256: Sha256;
  readonly security: PersonalMarketDataIdentityDto & {
    readonly issuerId: string;
    readonly cik: string;
  };
}

export interface PersonalSecQuarterSourceDto {
  readonly id: SourceId;
  readonly sourceUrl: string;
  readonly sha256: Sha256;
  readonly bytes: number;
  readonly retrievalStartedAt: string;
  readonly retrievalCompletedAt: string;
}

export interface PersonalSecQuarterSubmissionDto {
  readonly id: "submissions:selected";
  readonly sourceId: "submissions";
  readonly rowIndex: number;
  /** All matching current-Submissions row positions, including equal duplicates. */
  readonly matchingRowIndices: readonly number[];
  readonly accessionNumber: string;
  readonly form: "10-Q";
  readonly filedDate: string;
  readonly reportDate: string;
  readonly acceptedAt: string | null;
  readonly primaryDocument: string;
}

/** JSON strings are decoded; number text is the exact original JSON lexeme.
 * Array/object text is compact lossless JSON, not a verbatim source-byte claim.
 * Every original row field is retained, including unknown names and wrong types.
 */
export interface PersonalSecQuarterSourceFieldDto {
  readonly name: string;
  readonly kind: "null" | "boolean" | "number" | "string" | "array" | "object";
  readonly text: string;
}

export type CompanyFactsIssue =
  | "row_not_object"
  | "missing_accession"
  | "invalid_accession"
  | "invalid_start_date"
  | "invalid_end_date"
  | "invalid_period"
  | "invalid_form"
  | "invalid_filed_date"
  | "invalid_fiscal_year"
  | "invalid_fiscal_period"
  | "invalid_frame"
  | "invalid_numeric"
  | "decimal_limit"
  | "invalid_unit_key"
  | "unsupported_row_fields";

export interface PersonalSecQuarterCompanyFactDto {
  /** Graph-local ID cf:<concept ordinal>:<unit ordinal>:<source row index>.
   * Valid only with this projection's sourceSha256 and the bound source bundle.
   */
  readonly id: EvidenceId;
  readonly concept: PersonalSecQuarterlyConcept;
  readonly sourceLocator: string;
  readonly unitKey: string;
  readonly unitIndex: number;
  readonly rowIndex: number;
  readonly accessionMembership: "selected" | "potential";
  readonly accessionNumber: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly form: string | null;
  readonly filedDate: string | null;
  readonly fiscalYear: number | null;
  readonly fiscalPeriod: string | null;
  readonly frame: string | null;
  readonly value: string | null;
  readonly rawFields: readonly PersonalSecQuarterSourceFieldDto[];
  /** For a non-object row only; no row data is discarded. */
  readonly nonObjectRow: Readonly<{
    kind: "null" | "boolean" | "number" | "string" | "array";
    text: string;
  }> | null;
  readonly issues: readonly CompanyFactsIssue[];
}

export interface PersonalSecQuarterCompanyFactsPopulationDto {
  readonly concept: PersonalSecQuarterlyConcept;
  readonly present: boolean;
  /** Unit keys in original object enumeration order, with their array lengths. */
  readonly units: readonly Readonly<{
    unitKey: string;
    inspectedRows: number;
    otherAccessionRows: number;
    retainedIds: readonly EvidenceId[];
  }>[];
  readonly inspectedRows: number;
  readonly otherAccessionRows: number;
  readonly retainedIds: readonly EvidenceId[];
}

export interface PersonalSecQuarterCompanyFactsDto {
  readonly schemaVersion: "1.0.0";
  readonly sourceSha256: Sha256;
  readonly cik: string;
  readonly accessionNumber: string;
  readonly inspectedRows: number;
  readonly otherAccessionRows: number;
  /** Exactly four, in PERSONAL_SEC_QUARTERLY_CONCEPTS order. */
  readonly populations: readonly PersonalSecQuarterCompanyFactsPopulationDto[];
  readonly occurrences: readonly PersonalSecQuarterCompanyFactDto[];
}

export interface PersonalSecQuarterEvidenceDto {
  readonly schemaVersion: "1.0.0";
  readonly submission: PersonalSecQuarterSubmissionDto;
  readonly companyFacts: PersonalSecQuarterCompanyFactsDto;
  readonly primary: PersonalSecQuarterPrimaryEvidenceDto;
}

export type ProfileId =
  | "report_identity_v1"
  | "principal_statement_v1"
  | "calendar_direct_boundary_v1"
  | "calendar_fiscal_ytd_roles_v1"
  | "standalone_column_v1"
  | "whole_revenue_v1"
  | "parent_income_explicit_v1"
  | "parent_income_wholly_owned_v1"
  | "signed_usd_display_v1"
  | "static_source_path_v1";

export type AssessmentReason =
  | "report_identity_unresolved"
  | "report_metadata_conflict"
  | "unsupported_amendment"
  | "unsupported_transition_period"
  | "unsupported_week_calendar"
  | "unsupported_stub_period"
  | "unsupported_q4"
  | "unsupported_ytd_only"
  | "fiscal_boundary_unresolved"
  | "fiscal_boundary_conflict"
  | "fiscal_calendar_unresolved"
  | "fiscal_slot_unresolved"
  | "fiscal_ytd_role_unresolved"
  | "cash_date_join_mismatch"
  | "principal_statement_unresolved"
  | "consolidation_scope_unresolved"
  | "caption_ownership_unresolved"
  | "current_column_unresolved"
  | "column_ownership_conflict"
  | "whole_revenue_scope_unresolved"
  | "parent_attribution_unresolved"
  | "unsupported_common_share_numerator"
  | "unsupported_continuing_income"
  | "display_amount_unresolved"
  | "display_unit_unresolved"
  | "display_amount_mismatch"
  | "adjacent_cell_ownership_conflict"
  | "static_visibility_unresolved"
  | "static_script_unresolved"
  | "competing_revenue_concepts"
  | "membership_unresolved"
  | "current_non_usd"
  | "current_value_conflict"
  | "concept_absent"
  | "no_current_company_facts_row"
  | "no_current_primary_row"
  | "unwitnessed_company_facts_reference"
  | "principal_witness_unresolved"
  | "pair_period_mismatch"
  | "metric_not_supported";

export type PredicateObserved =
  | Readonly<{
      kind: "identity";
      form: "10-Q";
      reportDate: string;
      fiscalYear: number;
      fiscalQuarter: 1 | 2 | 3;
    }>
  | Readonly<{
      kind: "calendar";
      fiscalYearStart: string;
      fiscalYearEnd: string;
      quarterStart: string;
      quarterEnd: string;
      slot: 1 | 2 | 3;
      yearLabel: number;
      openingCashContextRef: EvidenceId | null;
      closingCashContextRef: EvidenceId | null;
    }>
  | Readonly<{
      kind: "statement";
      tableRef: EvidenceId;
      headingRefs: readonly EvidenceId[];
      consolidationRefs: readonly EvidenceId[];
      sectionRefs: readonly EvidenceId[];
    }>
  | Readonly<{
      kind: "column";
      numericCellRef: EvidenceId;
      yearHeaderRefs: readonly EvidenceId[];
      durationHeaderRefs: readonly EvidenceId[];
      adjacentCellRefs: readonly EvidenceId[];
    }>
  | Readonly<{
      kind: "scope";
      rowRef: EvidenceId;
      labelCellRefs: readonly EvidenceId[];
      scopeRefs: readonly EvidenceId[];
      attribution: "whole_revenue" | "parent_explicit" | "wholly_owned";
    }>
  | Readonly<{
      kind: "display";
      numericCellRef: EvidenceId;
      adjacentCellRefs: readonly EvidenceId[];
      unitRef: EvidenceId;
      captionRefs: readonly EvidenceId[];
      text: string;
      scalePower10: 0 | 3 | 6;
      value: string;
    }>
  | Readonly<{
      kind: "static";
      pathRefs: readonly EvidenceId[];
      documentProfileRef: EvidenceId;
      uninterpretedScriptRefs: readonly EvidenceId[];
      sourceInterpretation: "static_markup_only";
    }>;

export interface PersonalSecQuarterPredicateDto {
  readonly id: string;
  readonly profile: ProfileId;
  readonly version: "1.0.0";
  readonly state: "supported" | "unresolved" | "contradicted";
  readonly evidenceIds: readonly EvidenceId[];
  readonly reasons: readonly AssessmentReason[];
  readonly observed: PredicateObserved | null;
}

export interface PersonalSecQuarterWitnessDto {
  readonly id: string;
  readonly primaryRef: EvidenceId;
  readonly companyFactsRefs: readonly EvidenceId[];
  readonly concept: PersonalSecQuarterlyConcept;
  readonly contextRef: EvidenceId;
  readonly unitRef: EvidenceId;
  readonly tableRef: EvidenceId;
  readonly rowRef: EvidenceId;
  readonly labelCellRefs: readonly EvidenceId[];
  readonly numericCellRef: EvidenceId;
  readonly adjacentCellRefs: readonly EvidenceId[];
  readonly yearHeaderRefs: readonly EvidenceId[];
  readonly durationHeaderRefs: readonly EvidenceId[];
  readonly captionRefs: readonly EvidenceId[];
  readonly scopeRefs: readonly EvidenceId[];
  readonly visibilityRefs: readonly EvidenceId[];
  readonly predicateIds: readonly string[];
  readonly period: Period;
  readonly value: string;
  readonly display: Readonly<{
    text: string;
    scalePower10: 0 | 3 | 6;
    signConvention: "unsigned" | "minus" | "parentheses";
  }>;
}

export interface PersonalSecQuarterMembershipDto {
  readonly reference: EvidenceId;
  readonly source: "company_facts" | "primary";
  readonly disposition: "possible_current" | "excluded" | "unresolved";
  readonly reason:
    | "current_period"
    | "other_period"
    | "other_entity"
    | "dimensioned_scope"
    | "membership_unresolved";
  readonly evidenceIds: readonly EvidenceId[];
}

export interface PersonalSecQuarterConceptDecisionDto {
  readonly concept: PersonalSecQuarterlyConcept;
  readonly status: "absent" | "held" | "conflicted" | "supported_as_filed";
  readonly reasons: readonly AssessmentReason[];
  readonly companyFactsRefs: readonly EvidenceId[];
  readonly primaryRefs: readonly EvidenceId[];
  readonly memberships: readonly PersonalSecQuarterMembershipDto[];
  readonly predicateIds: readonly string[];
  readonly witnessIds: readonly string[];
}

export type PersonalSecQuarterMetricDecisionDto =
  | Readonly<{
      metric: Metric;
      status: "held" | "conflicted";
      reasons: readonly AssessmentReason[];
      concept: PersonalSecQuarterlyConcept | null;
      witnessIds: readonly string[];
      value: null;
      unit: null;
      period: null;
    }>
  | Readonly<{
      metric: Metric;
      status: "supported_as_filed";
      reasons: readonly [];
      concept: PersonalSecQuarterlyConcept;
      witnessIds: readonly string[];
      value: string;
      unit: "USD";
      period: Period;
    }>;

export type PersonalSecQuarterPairDecisionDto =
  | Readonly<{
      status: "held" | "conflicted";
      reasons: readonly AssessmentReason[];
      revenue: null;
      netIncome: null;
      unit: null;
      period: null;
    }>
  | Readonly<{
      status: "supported_as_filed";
      reasons: readonly [];
      revenue: string;
      netIncome: string;
      unit: "USD";
      period: Period;
    }>;

export interface PersonalSecQuarterAnalysisDto {
  readonly schemaVersion: "1.0.0";
  readonly predicates: readonly PersonalSecQuarterPredicateDto[];
  readonly witnesses: readonly PersonalSecQuarterWitnessDto[];
  readonly concepts: readonly PersonalSecQuarterConceptDecisionDto[];
  readonly metrics: readonly PersonalSecQuarterMetricDecisionDto[];
  readonly pair: PersonalSecQuarterPairDecisionDto;
  readonly ttm: Readonly<{
    status: "unavailable";
    reason: "source_not_admitted";
  }>;
}

export interface PersonalSecQuarterAssessmentInputDto {
  readonly cik: string;
  readonly selection: PersonalSecQuarterAssessmentSelectionDto;
  readonly sources: readonly PersonalSecQuarterSourceDto[];
  readonly evidence: PersonalSecQuarterEvidenceDto;
}

export type PersonalSecQuarterEngineResultDto =
  | Readonly<{
      status: "unavailable";
      reason: "invalid_evidence_graph";
      ttm: Readonly<{ status: "unavailable"; reason: "source_not_admitted" }>;
    }>
  | Readonly<{
      status: "assessed";
      analysis: PersonalSecQuarterAnalysisDto;
    }>;

export type AcquisitionStage =
  "submissions" | "company_facts" | "document" | "parser" | "assembly";
export type AcquisitionReason =
  | QuarterPrimaryFailureReason
  | "accession_not_in_current_submissions"
  | "submission_metadata_conflict"
  | "primary_document_unavailable"
  | "not_covered"
  | "rate_limited"
  | "upstream_unavailable"
  | "invalid_response"
  | "response_too_large"
  | "candidate_limit"
  | "duplicate_json_key"
  | "json_depth_limit"
  | "company_facts_structure_invalid"
  | "company_facts_field_limit"
  | "company_facts_projection_limit"
  | "runtime_unavailable"
  | "parser_timeout"
  | "worker_failed"
  | "invalid_output"
  | "output_too_large"
  | "invalid_evidence_graph"
  | "operation_deadline";

export type PersonalSecQuarterAssessmentDto =
  | Readonly<{
      status: "unavailable";
      cik: string;
      selection: PersonalSecQuarterAssessmentSelectionDto;
      stage: AcquisitionStage;
      reason: AcquisitionReason;
      sources: readonly PersonalSecQuarterSourceDto[];
    }>
  | Readonly<{
      status: "held";
      cik: string;
      selection: PersonalSecQuarterAssessmentSelectionDto;
      stage: "selection";
      reason: "unsupported_amendment" | "report_date_unresolved";
      sources: readonly PersonalSecQuarterSourceDto[];
    }>
  | Readonly<{
      status: "held" | "conflicted" | "supported_as_filed";
      cik: string;
      selection: PersonalSecQuarterAssessmentSelectionDto;
      stage: "assessment";
      acceptedAt: string;
      bundleId: Sha256;
      sources: readonly PersonalSecQuarterSourceDto[];
      evidence: PersonalSecQuarterEvidenceDto;
      analysis: PersonalSecQuarterAnalysisDto;
    }>;

export interface PersonalSecQuarterAssessmentResponseDto {
  readonly schemaVersion: "1.0.0";
  readonly catalogSnapshotSha256: Sha256;
  readonly security: PersonalMarketDataIdentityDto & {
    readonly issuerId: string;
    readonly cik: string;
  };
  readonly assessment: PersonalSecQuarterAssessmentDto;
}

export * from "./personal-sec-quarter-assessment-evidence";
export * from "./personal-sec-quarter-assessment-validation";

export const PERSONAL_SEC_QUARTER_ASSESSMENT_KEYSETS = {
  request: [
    "schemaVersion",
    "catalogSnapshotSha256",
    "listingId",
    "symbol",
    "selection",
  ],
  selection: ["accessionNumber", "form", "filedDate", "reportDate"],
  target: ["catalogSnapshotSha256", "security"],
  security: [
    "country",
    "exchangeMic",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
    "issuerId",
    "cik",
  ],
  response: [
    "schemaVersion",
    "catalogSnapshotSha256",
    "security",
    "assessment",
  ],
  source: [
    "id",
    "sourceUrl",
    "sha256",
    "bytes",
    "retrievalStartedAt",
    "retrievalCompletedAt",
  ],
  unavailable: ["status", "cik", "selection", "stage", "reason", "sources"],
  selectionHeld: ["status", "cik", "selection", "stage", "reason", "sources"],
  complete: [
    "status",
    "cik",
    "selection",
    "stage",
    "acceptedAt",
    "bundleId",
    "sources",
    "evidence",
    "analysis",
  ],
  evidence: ["schemaVersion", "submission", "companyFacts", "primary"],
  engineInput: ["cik", "selection", "sources", "evidence"],
  engineUnavailable: ["status", "reason", "ttm"],
  engineAssessed: ["status", "analysis"],
  analysis: [
    "schemaVersion",
    "predicates",
    "witnesses",
    "concepts",
    "metrics",
    "pair",
    "ttm",
  ],
  predicate: [
    "id",
    "profile",
    "version",
    "state",
    "evidenceIds",
    "reasons",
    "observed",
  ],
  concept: [
    "concept",
    "status",
    "reasons",
    "companyFactsRefs",
    "primaryRefs",
    "memberships",
    "predicateIds",
    "witnessIds",
  ],
  metric: [
    "metric",
    "status",
    "reasons",
    "concept",
    "witnessIds",
    "value",
    "unit",
    "period",
  ],
  pair: ["status", "reasons", "revenue", "netIncome", "unit", "period"],
  ttm: ["status", "reason"],
} as const;
