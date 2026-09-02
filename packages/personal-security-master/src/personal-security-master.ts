import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

export const PERSONAL_SECURITY_MASTER_SCHEMA_VERSION = "1.0.0" as const;
export const PERSONAL_SECURITY_MASTER_PROFILE =
  "personal_single_user_local_security_master" as const;
export const PERSONAL_SECURITY_MASTER_CLAIM =
  "bounded_exact_owner_local_security_master_snapshot_admitted" as const;

export const PERSONAL_SECURITY_MASTER_LIMITS = Object.freeze({
  aggregateArrayEntries: 600_000,
  aggregateStringCodePoints: 12_000_000,
  documentDepth: 10,
  documentNodes: 1_000_000,
  issuers: 20_000,
  listingsPerShareClass: 16,
  maximumStringCodePoints: 2_048,
  measurementIterations: 100,
  measurementQueries: 32,
  normalizedSearchQueryCodePoints: 512,
  provenanceArtifacts: 16,
  providerMappings: 200_000,
  records: 20_000,
  searchQueryCodePoints: 128,
  searchResultCap: 25,
  searchableNameCodePoints: 128,
  snapshotBytes: 16_777_216,
  shareClassesPerSecurity: 16,
  tickerHistoryPerListing: 128,
});

export const PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN = Object.freeze({
  iterations: 100,
  queryCount: 32,
  querySetDigestMethod:
    "sha256_of_utf8_canonical_json_ordered_raw_query_array_with_lf" as const,
  resultLimit: 25,
});

export const PERSONAL_SECURITY_MASTER_SEARCH_NORMALIZATION = Object.freeze([
  "trim_unicode_whitespace",
  "unicode_nfkd",
  "remove_combining_marks",
  "unicode_uppercase",
  "replace_non_letter_or_number_runs_with_one_space",
  "collapse_and_trim_spaces",
] as const);

export const PERSONAL_SECURITY_MASTER_SYMBOL_NORMALIZATION = Object.freeze([
  "trim_unicode_whitespace",
  "unicode_nfkc",
  "unicode_uppercase",
  "preserve_ascii_dot_and_hyphen",
  "invalid_symbol_form_is_name_search_only",
] as const);

export const PERSONAL_SECURITY_MASTER_SEARCH_RANKING = Object.freeze([
  "current_symbol_exact",
  "current_symbol_prefix",
  "former_symbol_exact",
  "former_symbol_prefix",
  "name_exact",
  "name_token_prefix",
  "name_contains",
] as const);

export const PERSONAL_SECURITY_MASTER_SEARCH_TIE_BREAKS = Object.freeze([
  "unicode_code_point_current_symbol",
  "unicode_code_point_exchange_mic",
  "unicode_code_point_normalized_security_name",
  "unicode_code_point_normalized_share_class_name",
  "unicode_code_point_share_class_id",
  "unicode_code_point_security_id",
  "unicode_code_point_listing_id",
] as const);

export const PERSONAL_SECURITY_MASTER_PROVIDER_MAPPING_TARGETS = Object.freeze({
  composite: "share_class_country_composite",
  issuer: "issuer",
  listing: "listing",
  security: "security",
  share_class: "share_class",
} as const);

export const PERSONAL_SECURITY_MASTER_CHECKS = Object.freeze([
  "exact_expected_sha256_and_owned_uint8array_snapshot",
  "canonical_utf8_lf_json_with_closed_schema",
  "bounded_bytes_rows_depth_nodes_strings_and_arrays",
  "explicit_owner_local_provenance_and_source_policy_compatibility",
  "exact_source_admitted_and_exclusion_coverage_accounting",
  "source_coverage_admitted_records_count_security_records",
  "stable_issuer_security_share_class_listing_and_mapping_identifiers",
  "one_to_many_issuer_security_share_class_listing_graph",
  "active_common_stock_and_adr_eligibility",
  "us_country_and_operating_exchange_mic_identity",
  "filing_or_prospective_observed_current_former_ticker_chronology",
  "global_identity_provider_mapping_and_active_mic_symbol_uniqueness",
  "required_share_class_and_listing_provider_mapping_coverage",
  "immutable_admission_and_defensive_search_results",
  "bounded_deterministic_symbol_and_name_search",
  "coarse_catalog_coverage_with_synthetic_nonclaim",
] as const);

export const PERSONAL_SECURITY_MASTER_NOT_PROVEN = Object.freeze([
  "source_authenticity_or_provider_attestation",
  "legal_opinion_or_rights_authority_approval",
  "complete_us_or_global_security_coverage",
  "real_universe_three_thousand_security_breadth",
  "provider_mapping_freshness_or_external_resolution",
  "iso_mic_registry_authenticity_or_operating_mic_correctness",
  "licensed_exchange_effective_ticker_dates",
  "later_policy_revocation_after_offline_snapshot",
  "network_transport_file_persistence_or_vault_activation",
  "production_hardware_latency_slo",
  "multi_user_tenant_or_redistribution_safety",
] as const);

export const PERSONAL_SECURITY_MASTER_FAILURE_CODES = Object.freeze([
  "PERSONAL_SECURITY_MASTER_INVALID_INPUT",
  "PERSONAL_SECURITY_MASTER_DIGEST_MISMATCH",
  "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
  "PERSONAL_SECURITY_MASTER_SEARCH_INVALID",
  "PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID",
] as const);

export type PersonalSecurityMasterFailureCode =
  (typeof PERSONAL_SECURITY_MASTER_FAILURE_CODES)[number];

export class PersonalSecurityMasterError extends Error {
  public constructor(public readonly code: PersonalSecurityMasterFailureCode) {
    super("Personal security master operation failed.");
    this.name = "PersonalSecurityMasterError";
  }
}

class InternalPersonalSecurityMasterFailure extends Error {
  public constructor(public readonly code: PersonalSecurityMasterFailureCode) {
    super();
  }
}

export type PersonalSecurityMasterContentKind =
  "owner_local_source" | "synthetic_engineering";

export type PersonalSecurityMasterInstrumentType = "adr" | "common_stock";

export type PersonalSecurityMasterSearchMatchKind =
  (typeof PERSONAL_SECURITY_MASTER_SEARCH_RANKING)[number];

export interface PersonalSecurityMasterAdmissionInput {
  readonly expectedSha256: `sha256:${string}`;
  readonly snapshot: Uint8Array;
}

export interface PersonalSecurityMasterProvenance {
  readonly acquiredAt: string;
  readonly artifacts: readonly PersonalSecurityMasterProvenanceArtifact[];
  readonly attribution: string;
  readonly contentKind: PersonalSecurityMasterContentKind;
  readonly sourceId: string;
  readonly sourceLocator: `owner-local-composite-manifest:sha256:${string}`;
  readonly sourceRevision: `sha256:${string}`;
}

export interface PersonalSecurityMasterProvenanceArtifact {
  readonly acquiredAt: string;
  readonly artifactId: string;
  readonly contentSha256: `sha256:${string}`;
  readonly mediaType:
    | "application/json"
    | "application/zip"
    | "text/csv"
    | "text/html"
    | "text/plain";
  readonly sourceUri: string;
  readonly sourceVersion: string;
}

export interface PersonalSecurityMasterSourcePolicyCompatibility {
  readonly attribution: "required";
  readonly cache: "permitted_owner_local";
  readonly decision: "compatible";
  readonly deleteOnRequest: true;
  readonly display: "permitted_owner_local";
  readonly effectiveAt: string;
  readonly expiresAt: string;
  readonly export: "prohibited";
  readonly intendedUse: "personal_security_research";
  readonly localOnly: true;
  readonly operation: "fetch_snapshot";
  readonly policyDocumentSha256: `sha256:${string}`;
  readonly policyId: string;
  readonly policyProfile: "personal_single_user_local_connected";
  readonly policySchemaVersion: "1.0.0";
  readonly policyVersion: string;
  readonly redistribution: "prohibited";
  readonly retention: "permitted_owner_local";
  readonly reviewedAt: string;
  readonly revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation";
  readonly revokedAt: null;
  readonly rightsBasis: "owner_reviewed_rights_compatible";
  readonly search: "permitted_owner_local";
  readonly sourceId: string;
}

export interface PersonalSecurityMasterCatalogCoverage {
  readonly admittedSourceRecords: number;
  readonly activeEligibleSecurities: number;
  readonly activeListings: number;
  readonly basis:
    | "owner_declared_snapshot_only"
    | "synthetic_engineering_only_not_real_universe";
  readonly eligibleSecurityBand:
    "at_least_3000" | "from_1000_to_2999" | "under_1000";
  readonly formerTickerEntries: number;
  readonly ineligibleSourceRecords: number;
  readonly inactiveSecurities: number;
  readonly issuers: number;
  readonly providerMappings: number;
  readonly quarantinedSourceRecords: number;
  readonly sourceRecords: number;
  readonly staleSourceRecords: number;
  readonly shareClasses: number;
  readonly totalSecurities: number;
  readonly unsupportedSourceRecords: number;
}

export interface PersonalSecurityMasterCatalog {
  readonly asOf: string;
  readonly catalogId: string;
  readonly catalogVersion: string;
  readonly claim: typeof PERSONAL_SECURITY_MASTER_CLAIM;
  readonly coverage: PersonalSecurityMasterCatalogCoverage;
  readonly generatedAt: string;
  readonly profile: typeof PERSONAL_SECURITY_MASTER_PROFILE;
  readonly provenance: PersonalSecurityMasterProvenance;
  readonly schemaVersion: typeof PERSONAL_SECURITY_MASTER_SCHEMA_VERSION;
  readonly snapshotSha256: `sha256:${string}`;
  readonly sourcePolicyCompatibility: PersonalSecurityMasterSourcePolicyCompatibility;
  readonly status: "admitted_for_personal_local_search";
}

export interface PersonalSecurityMasterSearchInput {
  readonly limit: number;
  readonly query: string;
}

export interface PersonalSecurityMasterSearchResult {
  readonly cik: string;
  readonly country: "US";
  readonly exchangeMic: string;
  readonly instrumentType: PersonalSecurityMasterInstrumentType;
  readonly issuerName: string;
  readonly issuerId: string;
  readonly listingId: string;
  readonly matchKind: PersonalSecurityMasterSearchMatchKind;
  readonly matchedValue: string;
  readonly securityId: string;
  readonly securityName: string;
  readonly shareClassId: string;
  readonly shareClassName: string;
  readonly symbol: string;
}

export interface PersonalSecurityMasterSearchResponse {
  readonly limitApplied: number;
  readonly normalizedQuery: string;
  readonly results: readonly PersonalSecurityMasterSearchResult[];
  readonly totalMatches: number;
}

export interface PersonalSecurityMasterMeasurementInput {
  readonly hardwareProfile: string;
  readonly iterations: number;
  readonly queries: readonly string[];
  readonly resultLimit: number;
}

export interface PersonalSecurityMasterMeasurement {
  readonly activeEligibleSecurities: number;
  readonly basis:
    | "owner_local_exact_snapshot_and_declared_hardware"
    | "synthetic_engineering_only_not_production_slo";
  readonly catalogId: string;
  readonly catalogVersion: string;
  readonly hardwareProfile: string;
  readonly iterations: number;
  readonly maximumMilliseconds: number;
  readonly method: "nearest_rank_p95_of_individual_local_searches";
  readonly p95Milliseconds: number;
  readonly queryCount: number;
  readonly querySetDigestMethod: typeof PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.querySetDigestMethod;
  readonly rawQuerySetSha256: `sha256:${string}`;
  readonly resultLimit: number;
  readonly sampleCount: number;
  readonly snapshotSha256: `sha256:${string}`;
}

interface RawSecurityRecord {
  readonly active: boolean;
  readonly eligibility: "eligible" | "ineligible";
  readonly instrumentType: PersonalSecurityMasterInstrumentType;
  readonly issuerId: string;
  readonly securityId: string;
  readonly securityName: string;
  readonly shareClasses: readonly RawShareClass[];
}

interface RawIssuer {
  readonly cik: string;
  readonly issuerId: string;
  readonly issuerName: string;
}

interface RawShareClass {
  readonly active: boolean;
  readonly listings: readonly RawListing[];
  readonly securityId: string;
  readonly shareClassId: string;
  readonly shareClassName: string;
}

interface RawListing {
  readonly active: boolean;
  readonly country: "US";
  readonly currentSymbol: string | null;
  readonly exchangeMic: string;
  readonly exchangeMicType: "operating";
  readonly listingId: string;
  readonly securityId: string;
  readonly shareClassId: string;
  readonly tickerHistory: readonly RawTickerHistory[];
}

interface RawTickerHistory {
  readonly listingId: string;
  readonly symbol: string;
  readonly timeBasis: "prospective_snapshot_observed" | "sec_filing_observed";
  readonly validFrom: string;
  readonly validTo: string | null;
}

interface RawProviderMapping {
  readonly mappingKind:
    "composite" | "issuer" | "listing" | "security" | "share_class";
  readonly mappingId: string;
  readonly providerId: string;
  readonly providerSecurityId: string;
  readonly targetId: string;
}

interface ValidatedSnapshot {
  readonly asOf: string;
  readonly catalogId: string;
  readonly catalogVersion: string;
  readonly coverage: PersonalSecurityMasterCatalogCoverage;
  readonly generatedAt: string;
  readonly issuers: readonly RawIssuer[];
  readonly provenance: PersonalSecurityMasterProvenance;
  readonly providerMappings: readonly RawProviderMapping[];
  readonly records: readonly RawSecurityRecord[];
  readonly sourceCoverage: SourceCoverage;
  readonly sourcePolicyCompatibility: PersonalSecurityMasterSourcePolicyCompatibility;
}

interface SourceCoverage {
  readonly admittedRecords: number;
  readonly ineligibleRecords: number;
  readonly quarantinedRecords: number;
  readonly sourceRecords: number;
  readonly staleRecords: number;
  readonly unsupportedRecords: number;
}

interface ValidatedSecurityGraph {
  readonly issuers: readonly RawIssuer[];
  readonly providerMappings: readonly RawProviderMapping[];
  readonly records: readonly RawSecurityRecord[];
}

interface SearchEntry {
  readonly currentSymbolNormalized: string;
  readonly formerSymbols: readonly Readonly<{
    normalized: string;
    symbol: string;
  }>[];
  readonly issuerNameNormalized: string;
  readonly issuer: RawIssuer;
  readonly listing: RawListing;
  readonly record: RawSecurityRecord;
  readonly securityNameNormalized: string;
  readonly shareClass: RawShareClass;
  readonly shareClassNameNormalized: string;
}

interface CatalogState {
  readonly catalogId: string;
  readonly catalogVersion: string;
  readonly contentKind: PersonalSecurityMasterContentKind;
  readonly eligibleSecurities: number;
  readonly searchEntries: readonly SearchEntry[];
  readonly snapshotSha256: `sha256:${string}`;
}

interface NormalizedSearchRequest {
  readonly limit: number;
  readonly nameQuery: string;
  readonly symbolQuery: string | null;
}

interface RankedSearchResult {
  readonly rank: number;
  readonly result: PersonalSecurityMasterSearchResult;
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const CIK = /^[0-9]{10}$/u;
const MIC = /^[A-Z0-9]{4}$/u;
const SYMBOL = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const PROVIDER_SECURITY_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const DISALLOWED_CHARACTER = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const COMBINING_MARKS = /\p{M}+/gu;
const NON_LETTER_OR_NUMBER = /[^\p{L}\p{N}]+/gu;
const SPACES = / +/gu;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
);
const TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
);
const TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
);
const ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
);
const UINT8_ARRAY_FILL = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "fill",
)?.value as typeof Uint8Array.prototype.fill;
const UINT8_ARRAY_SET = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "set",
)?.value as typeof Uint8Array.prototype.set;
const CATALOG_STATES = new WeakMap<
  PersonalSecurityMasterCatalog,
  CatalogState
>();

export function admitPersonalSecurityMasterSnapshot(
  input: PersonalSecurityMasterAdmissionInput,
): PersonalSecurityMasterCatalog {
  let ownedSnapshot: Uint8Array | undefined;
  try {
    if (arguments.length !== 1) fail("PERSONAL_SECURITY_MASTER_INVALID_INPUT");
    const admission = snapshotAdmissionInput(input);
    ownedSnapshot = admission.snapshot;
    const snapshotSha256 = sha256(ownedSnapshot);
    if (snapshotSha256 !== admission.expectedSha256) {
      fail("PERSONAL_SECURITY_MASTER_DIGEST_MISMATCH");
    }
    const validated = validateSnapshot(parseCanonicalDocument(ownedSnapshot));
    const catalog = Object.freeze({
      asOf: validated.asOf,
      catalogId: validated.catalogId,
      catalogVersion: validated.catalogVersion,
      claim: PERSONAL_SECURITY_MASTER_CLAIM,
      coverage: validated.coverage,
      generatedAt: validated.generatedAt,
      profile: PERSONAL_SECURITY_MASTER_PROFILE,
      provenance: validated.provenance,
      schemaVersion: PERSONAL_SECURITY_MASTER_SCHEMA_VERSION,
      snapshotSha256,
      sourcePolicyCompatibility: validated.sourcePolicyCompatibility,
      status: "admitted_for_personal_local_search" as const,
    });
    CATALOG_STATES.set(
      catalog,
      Object.freeze({
        catalogId: validated.catalogId,
        catalogVersion: validated.catalogVersion,
        contentKind: validated.provenance.contentKind,
        eligibleSecurities: validated.coverage.activeEligibleSecurities,
        searchEntries: buildSearchEntries(validated.records, validated.issuers),
        snapshotSha256,
      }),
    );
    return catalog;
  } catch (error) {
    throw publicError(error, "PERSONAL_SECURITY_MASTER_INVALID_INPUT");
  } finally {
    if (ownedSnapshot !== undefined) {
      Reflect.apply(UINT8_ARRAY_FILL, ownedSnapshot, [0]);
    }
  }
}

export function searchPersonalSecurityMaster(
  catalog: PersonalSecurityMasterCatalog,
  input: PersonalSecurityMasterSearchInput,
): PersonalSecurityMasterSearchResponse {
  try {
    if (arguments.length !== 2) fail("PERSONAL_SECURITY_MASTER_SEARCH_INVALID");
    const state = CATALOG_STATES.get(catalog);
    if (state === undefined) fail("PERSONAL_SECURITY_MASTER_SEARCH_INVALID");
    const request = snapshotSearchInput(input);
    return searchState(state, request);
  } catch (error) {
    throw publicError(error, "PERSONAL_SECURITY_MASTER_SEARCH_INVALID");
  }
}

export function measurePersonalSecurityMasterSearchP95(
  catalog: PersonalSecurityMasterCatalog,
  input: PersonalSecurityMasterMeasurementInput,
  readNowMilliseconds: () => number = () => performance.now(),
): PersonalSecurityMasterMeasurement {
  try {
    if (arguments.length < 2 || arguments.length > 3) {
      fail("PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID");
    }
    const state = CATALOG_STATES.get(catalog);
    if (state === undefined || typeof readNowMilliseconds !== "function") {
      fail("PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID");
    }
    const request = snapshotMeasurementInput(input);
    const rawQuerySetSha256 = digestOrderedRawQuerySet(request.queries);
    const samples: number[] = [];
    for (let iteration = 0; iteration < request.iterations; iteration += 1) {
      for (const query of request.queries) {
        const start = readNowMilliseconds();
        const searchRequest = normalizeSearchRequest(
          query,
          request.resultLimit,
        );
        searchState(state, searchRequest);
        const finish = readNowMilliseconds();
        const elapsed = finish - start;
        if (
          !Number.isFinite(start) ||
          !Number.isFinite(finish) ||
          finish < start ||
          !Number.isFinite(elapsed)
        ) {
          fail("PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID");
        }
        samples.push(elapsed);
      }
    }
    samples.sort((left, right) => left - right);
    const p95Index = Math.ceil(samples.length * 0.95) - 1;
    const p95Milliseconds = samples[p95Index];
    const maximumMilliseconds = samples.at(-1);
    if (p95Milliseconds === undefined || maximumMilliseconds === undefined) {
      fail("PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID");
    }
    return Object.freeze({
      activeEligibleSecurities: state.eligibleSecurities,
      basis:
        state.contentKind === "synthetic_engineering"
          ? "synthetic_engineering_only_not_production_slo"
          : "owner_local_exact_snapshot_and_declared_hardware",
      catalogId: state.catalogId,
      catalogVersion: state.catalogVersion,
      hardwareProfile: request.hardwareProfile,
      iterations: request.iterations,
      maximumMilliseconds,
      method: "nearest_rank_p95_of_individual_local_searches" as const,
      p95Milliseconds,
      queryCount: request.queries.length,
      querySetDigestMethod:
        PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.querySetDigestMethod,
      rawQuerySetSha256,
      resultLimit: request.resultLimit,
      sampleCount: samples.length,
      snapshotSha256: state.snapshotSha256,
    });
  } catch (error) {
    throw publicError(error, "PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID");
  }
}

function snapshotAdmissionInput(value: unknown): {
  readonly expectedSha256: `sha256:${string}`;
  readonly snapshot: Uint8Array;
} {
  const input = exactDataObject(
    value,
    ["expectedSha256", "snapshot"],
    "PERSONAL_SECURITY_MASTER_INVALID_INPUT",
  );
  if (
    typeof input.expectedSha256 !== "string" ||
    !HASH.test(input.expectedSha256)
  ) {
    fail("PERSONAL_SECURITY_MASTER_INVALID_INPUT");
  }
  return Object.freeze({
    expectedSha256: input.expectedSha256 as `sha256:${string}`,
    snapshot: byteSnapshot(input.snapshot),
  });
}

function snapshotSearchInput(value: unknown): NormalizedSearchRequest {
  const input = exactDataObject(
    value,
    ["limit", "query"],
    "PERSONAL_SECURITY_MASTER_SEARCH_INVALID",
  );
  if (
    !Number.isInteger(input.limit) ||
    (input.limit as number) < 1 ||
    (input.limit as number) > PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap ||
    typeof input.query !== "string" ||
    DISALLOWED_CHARACTER.test(input.query) ||
    codePointLength(input.query) >
      PERSONAL_SECURITY_MASTER_LIMITS.searchQueryCodePoints
  ) {
    fail("PERSONAL_SECURITY_MASTER_SEARCH_INVALID");
  }
  return normalizeSearchRequest(input.query, input.limit as number);
}

function normalizeSearchRequest(
  query: string,
  limit: number,
): NormalizedSearchRequest {
  const nameQuery = normalizeSearchText(query);
  if (
    codePointLength(nameQuery) === 0 ||
    codePointLength(nameQuery) >
      PERSONAL_SECURITY_MASTER_LIMITS.normalizedSearchQueryCodePoints
  ) {
    fail("PERSONAL_SECURITY_MASTER_SEARCH_INVALID");
  }
  return Object.freeze({
    limit,
    nameQuery,
    symbolQuery: normalizeSymbolQuery(query),
  });
}

function snapshotMeasurementInput(value: unknown): {
  readonly hardwareProfile: string;
  readonly iterations: number;
  readonly queries: readonly string[];
  readonly resultLimit: number;
} {
  const input = exactDataObject(
    value,
    ["hardwareProfile", "iterations", "queries", "resultLimit"],
    "PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID",
  );
  if (
    !isBoundedText(input.hardwareProfile, 1, 256) ||
    input.hardwareProfile !== input.hardwareProfile.trim() ||
    input.iterations !== PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.iterations ||
    input.resultLimit !==
      PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.resultLimit ||
    !Array.isArray(input.queries)
  ) {
    fail("PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID");
  }
  const capturedQueries = exactDenseDataArray(
    input.queries,
    PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.queryCount,
    "PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID",
  );
  const normalizedQueries = new Set<string>();
  const queries: string[] = [];
  for (let index = 0; index < capturedQueries.length; index += 1) {
    const query = capturedQueries[index];
    if (
      typeof query !== "string" ||
      DISALLOWED_CHARACTER.test(query) ||
      codePointLength(query) >
        PERSONAL_SECURITY_MASTER_LIMITS.searchQueryCodePoints
    ) {
      fail("PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID");
    }
    const nameQuery = normalizeSearchText(query);
    const normalizedQuery = normalizeSymbolQuery(query) ?? nameQuery;
    if (
      codePointLength(nameQuery) === 0 ||
      codePointLength(nameQuery) >
        PERSONAL_SECURITY_MASTER_LIMITS.normalizedSearchQueryCodePoints ||
      normalizedQueries.has(normalizedQuery)
    ) {
      fail("PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID");
    }
    normalizedQueries.add(normalizedQuery);
    queries[index] = query;
  }
  if (queries.length !== PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.queryCount) {
    fail("PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID");
  }
  return Object.freeze({
    hardwareProfile: input.hardwareProfile,
    iterations: input.iterations,
    queries: Object.freeze(queries),
    resultLimit: input.resultLimit,
  });
}

function digestOrderedRawQuerySet(
  queries: readonly string[],
): `sha256:${string}` {
  const canonicalBytes = new TextEncoder().encode(
    `${canonicalJson(queries)}\n`,
  );
  return `sha256:${createHash("sha256").update(canonicalBytes).digest("hex")}`;
}

function byteSnapshot(value: unknown): Uint8Array {
  try {
    if (typeof value !== "object" || value === null) {
      fail("PERSONAL_SECURITY_MASTER_INVALID_INPUT");
    }
    const bytes = value as Uint8Array;
    const tag = TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(bytes) as unknown;
    const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const backingByteLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      buffer,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      typeof byteLength !== "number" ||
      typeof backingByteLength !== "number" ||
      Object.getPrototypeOf(bytes) !== Uint8Array.prototype ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    ) {
      fail("PERSONAL_SECURITY_MASTER_INVALID_INPUT");
    }
    if (
      byteLength < 3 ||
      byteLength > PERSONAL_SECURITY_MASTER_LIMITS.snapshotBytes
    ) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    const snapshot = new Uint8Array(byteLength);
    Reflect.apply(UINT8_ARRAY_SET, snapshot, [bytes]);
    return snapshot;
  } catch (error) {
    if (error instanceof InternalPersonalSecurityMasterFailure) throw error;
    fail("PERSONAL_SECURITY_MASTER_INVALID_INPUT");
  }
}

function parseCanonicalDocument(bytes: Uint8Array): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  try {
    assertJsonBudget(value);
    if (`${canonicalJson(value)}\n` !== text) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
  } catch (error) {
    if (error instanceof InternalPersonalSecurityMasterFailure) throw error;
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  return value;
}

function validateSnapshot(value: unknown): ValidatedSnapshot {
  const root = exactRecord(value, [
    "asOf",
    "catalogId",
    "catalogVersion",
    "generatedAt",
    "issuers",
    "profile",
    "provenance",
    "providerMappings",
    "records",
    "schemaVersion",
    "sourceCoverage",
    "sourcePolicyCompatibility",
  ]);
  if (
    root.schemaVersion !== PERSONAL_SECURITY_MASTER_SCHEMA_VERSION ||
    root.profile !== PERSONAL_SECURITY_MASTER_PROFILE ||
    !isSafeId(root.catalogId) ||
    !isVersion(root.catalogVersion) ||
    typeof root.asOf !== "string" ||
    typeof root.generatedAt !== "string" ||
    !Array.isArray(root.issuers) ||
    root.issuers.length < 1 ||
    root.issuers.length > PERSONAL_SECURITY_MASTER_LIMITS.issuers ||
    !Array.isArray(root.providerMappings) ||
    root.providerMappings.length < 1 ||
    root.providerMappings.length >
      PERSONAL_SECURITY_MASTER_LIMITS.providerMappings ||
    !Array.isArray(root.records) ||
    root.records.length < 1 ||
    root.records.length > PERSONAL_SECURITY_MASTER_LIMITS.records
  ) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  const asOf = parseInstant(root.asOf);
  const generatedAt = parseInstant(root.generatedAt);
  if (generatedAt > asOf) fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  const provenance = validateProvenance(root.provenance, generatedAt);
  const sourceCoverage = validateSourceCoverage(
    root.sourceCoverage,
    root.records.length,
  );
  const sourcePolicyCompatibility = validateSourcePolicyCompatibility(
    root.sourcePolicyCompatibility,
    asOf,
    provenance,
  );
  const graph = validateSecurityGraph(
    root.issuers,
    root.records,
    root.providerMappings,
    asOf,
  );
  const coverage = buildCoverage(
    graph.records,
    provenance.contentKind,
    sourceCoverage,
    graph.issuers.length,
    graph.providerMappings.length,
  );
  return Object.freeze({
    asOf: root.asOf,
    catalogId: root.catalogId,
    catalogVersion: root.catalogVersion,
    coverage,
    generatedAt: root.generatedAt,
    issuers: graph.issuers,
    provenance,
    providerMappings: graph.providerMappings,
    records: graph.records,
    sourceCoverage,
    sourcePolicyCompatibility,
  });
}

function validateProvenance(
  value: unknown,
  generatedAt: number,
): PersonalSecurityMasterProvenance {
  const record = exactRecord(value, [
    "acquiredAt",
    "artifacts",
    "attribution",
    "contentKind",
    "sourceId",
    "sourceLocator",
    "sourceRevision",
  ]);
  if (
    typeof record.acquiredAt !== "string" ||
    !Array.isArray(record.artifacts) ||
    record.artifacts.length < 1 ||
    record.artifacts.length >
      PERSONAL_SECURITY_MASTER_LIMITS.provenanceArtifacts ||
    !isBoundedText(record.attribution, 1, 512) ||
    (record.contentKind !== "owner_local_source" &&
      record.contentKind !== "synthetic_engineering") ||
    !isSafeId(record.sourceId) ||
    !isBoundedText(record.sourceLocator, 1, 2_048) ||
    typeof record.sourceRevision !== "string" ||
    !HASH.test(record.sourceRevision) ||
    record.sourceLocator !==
      `owner-local-composite-manifest:${record.sourceRevision}`
  ) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  const acquiredAt = parseInstant(record.acquiredAt);
  if (acquiredAt > generatedAt) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  const artifacts = validateProvenanceArtifacts(record.artifacts, acquiredAt);
  return Object.freeze({
    acquiredAt: record.acquiredAt,
    artifacts,
    attribution: record.attribution,
    contentKind: record.contentKind,
    sourceId: record.sourceId,
    sourceLocator:
      record.sourceLocator as `owner-local-composite-manifest:sha256:${string}`,
    sourceRevision: record.sourceRevision as `sha256:${string}`,
  });
}

function validateProvenanceArtifacts(
  values: readonly unknown[],
  compositeAcquiredAt: number,
): readonly PersonalSecurityMasterProvenanceArtifact[] {
  const artifacts: PersonalSecurityMasterProvenanceArtifact[] = [];
  let previousArtifactId = "";
  for (const value of values) {
    const artifact = exactRecord(value, [
      "acquiredAt",
      "artifactId",
      "contentSha256",
      "mediaType",
      "sourceUri",
      "sourceVersion",
    ]);
    if (
      typeof artifact.acquiredAt !== "string" ||
      !isSafeId(artifact.artifactId) ||
      artifact.artifactId <= previousArtifactId ||
      typeof artifact.contentSha256 !== "string" ||
      !HASH.test(artifact.contentSha256) ||
      !isArtifactMediaType(artifact.mediaType) ||
      !isHttpsUrl(artifact.sourceUri) ||
      !isBoundedText(artifact.sourceVersion, 1, 256) ||
      artifact.sourceVersion !== artifact.sourceVersion.trim() ||
      parseInstant(artifact.acquiredAt) > compositeAcquiredAt
    ) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    artifacts.push(
      Object.freeze({
        acquiredAt: artifact.acquiredAt,
        artifactId: artifact.artifactId,
        contentSha256: artifact.contentSha256 as `sha256:${string}`,
        mediaType: artifact.mediaType,
        sourceUri: artifact.sourceUri,
        sourceVersion: artifact.sourceVersion,
      }),
    );
    previousArtifactId = artifact.artifactId;
  }
  return Object.freeze(artifacts);
}

function validateSourcePolicyCompatibility(
  value: unknown,
  asOf: number,
  provenance: PersonalSecurityMasterProvenance,
): PersonalSecurityMasterSourcePolicyCompatibility {
  const record = exactRecord(value, [
    "attribution",
    "cache",
    "decision",
    "deleteOnRequest",
    "display",
    "effectiveAt",
    "expiresAt",
    "export",
    "intendedUse",
    "localOnly",
    "operation",
    "policyDocumentSha256",
    "policyId",
    "policyProfile",
    "policySchemaVersion",
    "policyVersion",
    "redistribution",
    "retention",
    "reviewedAt",
    "revocationCheck",
    "revokedAt",
    "rightsBasis",
    "search",
    "sourceId",
  ]);
  if (
    record.attribution !== "required" ||
    record.cache !== "permitted_owner_local" ||
    record.decision !== "compatible" ||
    record.deleteOnRequest !== true ||
    record.display !== "permitted_owner_local" ||
    typeof record.effectiveAt !== "string" ||
    typeof record.expiresAt !== "string" ||
    record.export !== "prohibited" ||
    record.intendedUse !== "personal_security_research" ||
    record.localOnly !== true ||
    record.operation !== "fetch_snapshot" ||
    typeof record.policyDocumentSha256 !== "string" ||
    !HASH.test(record.policyDocumentSha256) ||
    !isSafeId(record.policyId) ||
    record.policyProfile !== "personal_single_user_local_connected" ||
    record.policySchemaVersion !== "1.0.0" ||
    !isVersion(record.policyVersion) ||
    record.redistribution !== "prohibited" ||
    record.retention !== "permitted_owner_local" ||
    typeof record.reviewedAt !== "string" ||
    record.revocationCheck !==
      "offline_snapshot_only_cannot_discover_later_revocation" ||
    record.revokedAt !== null ||
    record.rightsBasis !== "owner_reviewed_rights_compatible" ||
    record.search !== "permitted_owner_local" ||
    record.sourceId !== provenance.sourceId
  ) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  const effectiveAt = parseInstant(record.effectiveAt);
  const reviewedAt = parseInstant(record.reviewedAt);
  const acquiredAt = parseInstant(provenance.acquiredAt);
  const expiresAt = parseInstant(record.expiresAt);
  if (
    effectiveAt > reviewedAt ||
    reviewedAt > acquiredAt ||
    acquiredAt > asOf ||
    asOf >= expiresAt
  ) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  return Object.freeze({
    attribution: "required",
    cache: "permitted_owner_local",
    decision: "compatible",
    deleteOnRequest: true,
    display: "permitted_owner_local",
    effectiveAt: record.effectiveAt,
    expiresAt: record.expiresAt,
    export: "prohibited",
    intendedUse: "personal_security_research",
    localOnly: true,
    operation: "fetch_snapshot",
    policyDocumentSha256: record.policyDocumentSha256 as `sha256:${string}`,
    policyId: record.policyId,
    policyProfile: "personal_single_user_local_connected",
    policySchemaVersion: "1.0.0",
    policyVersion: record.policyVersion,
    redistribution: "prohibited",
    retention: "permitted_owner_local",
    reviewedAt: record.reviewedAt,
    revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
    revokedAt: null,
    rightsBasis: "owner_reviewed_rights_compatible",
    search: "permitted_owner_local",
    sourceId: record.sourceId,
  });
}

function validateSourceCoverage(
  value: unknown,
  admittedCount: number,
): SourceCoverage {
  const record = exactRecord(value, [
    "admittedRecords",
    "ineligibleRecords",
    "quarantinedRecords",
    "sourceRecords",
    "staleRecords",
    "unsupportedRecords",
  ]);
  const admittedRecords = coverageCount(record.admittedRecords);
  const ineligibleRecords = coverageCount(record.ineligibleRecords);
  const quarantinedRecords = coverageCount(record.quarantinedRecords);
  const sourceRecords = coverageCount(record.sourceRecords);
  const staleRecords = coverageCount(record.staleRecords);
  const unsupportedRecords = coverageCount(record.unsupportedRecords);
  if (
    admittedRecords !== admittedCount ||
    sourceRecords !==
      admittedRecords +
        ineligibleRecords +
        quarantinedRecords +
        staleRecords +
        unsupportedRecords
  ) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  return Object.freeze({
    admittedRecords,
    ineligibleRecords,
    quarantinedRecords,
    sourceRecords,
    staleRecords,
    unsupportedRecords,
  });
}

function coverageCount(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > PERSONAL_SECURITY_MASTER_LIMITS.records
  ) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  return value;
}

function validateSecurityGraph(
  issuerValues: readonly unknown[],
  recordValues: readonly unknown[],
  mappingValues: readonly unknown[],
  asOf: number,
): ValidatedSecurityGraph {
  const allStableIds = new Set<string>();
  const cikAndTickerTokens = new Set<string>();
  const issuerIds = new Set<string>();
  const referencedIssuerIds = new Set<string>();
  const securityIds = new Set<string>();
  const shareClassIds = new Set<string>();
  const listingIds = new Set<string>();
  const activeExchangeSymbols = new Set<string>();
  const issuers = validateIssuers(
    issuerValues,
    issuerIds,
    allStableIds,
    cikAndTickerTokens,
  );
  const records = validateRecords(
    recordValues,
    asOf,
    issuerIds,
    referencedIssuerIds,
    securityIds,
    shareClassIds,
    listingIds,
    allStableIds,
    activeExchangeSymbols,
    cikAndTickerTokens,
  );
  if (
    referencedIssuerIds.size !== issuerIds.size ||
    [...issuerIds].some((issuerId) => !referencedIssuerIds.has(issuerId))
  ) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  const providerSecurityTokens = new Set<string>();
  const providerMappings = validateProviderMappings(
    mappingValues,
    issuerIds,
    securityIds,
    shareClassIds,
    listingIds,
    allStableIds,
    providerSecurityTokens,
  );
  if (
    [...allStableIds].some(
      (identity) =>
        cikAndTickerTokens.has(identity) ||
        providerSecurityTokens.has(identity),
    )
  ) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  return Object.freeze({ issuers, providerMappings, records });
}

function validateIssuers(
  values: readonly unknown[],
  issuerIds: Set<string>,
  allStableIds: Set<string>,
  cikTokens: Set<string>,
): readonly RawIssuer[] {
  const issuers: RawIssuer[] = [];
  let previousIssuerId = "";
  for (const value of values) {
    const issuer = exactRecord(value, ["cik", "issuerId", "issuerName"]);
    if (
      !isCik(issuer.cik) ||
      !isSafeId(issuer.issuerId) ||
      issuer.issuerId <= previousIssuerId ||
      !isName(issuer.issuerName) ||
      issuerIds.has(issuer.issuerId) ||
      cikTokens.has(identityKey(issuer.cik))
    ) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    registerStableId(issuer.issuerId, allStableIds);
    issuerIds.add(issuer.issuerId);
    cikTokens.add(identityKey(issuer.cik));
    issuers.push(
      Object.freeze({
        cik: issuer.cik,
        issuerId: issuer.issuerId,
        issuerName: issuer.issuerName,
      }),
    );
    previousIssuerId = issuer.issuerId;
  }
  return Object.freeze(issuers);
}

function validateRecords(
  values: readonly unknown[],
  asOf: number,
  issuerIds: ReadonlySet<string>,
  referencedIssuerIds: Set<string>,
  securityIds: Set<string>,
  shareClassIds: Set<string>,
  listingIds: Set<string>,
  allStableIds: Set<string>,
  activeExchangeSymbols: Set<string>,
  cikAndTickerTokens: Set<string>,
): readonly RawSecurityRecord[] {
  const records: RawSecurityRecord[] = [];
  let previousSecurityId = "";

  for (const value of values) {
    const record = exactRecord(value, [
      "active",
      "eligibility",
      "instrumentType",
      "issuerId",
      "securityId",
      "securityName",
      "shareClasses",
    ]);
    if (
      typeof record.active !== "boolean" ||
      (record.eligibility !== "eligible" &&
        record.eligibility !== "ineligible") ||
      (record.instrumentType !== "common_stock" &&
        record.instrumentType !== "adr") ||
      !isSafeId(record.issuerId) ||
      !issuerIds.has(record.issuerId) ||
      !isSafeId(record.securityId) ||
      record.securityId <= previousSecurityId ||
      !isName(record.securityName) ||
      !Array.isArray(record.shareClasses) ||
      record.shareClasses.length < 1 ||
      record.shareClasses.length >
        PERSONAL_SECURITY_MASTER_LIMITS.shareClassesPerSecurity ||
      securityIds.has(record.securityId) ||
      record.active !== true ||
      record.eligibility !== "eligible"
    ) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    registerStableId(record.securityId, allStableIds);
    securityIds.add(record.securityId);
    referencedIssuerIds.add(record.issuerId);
    const shareClasses = validateShareClasses(
      record.shareClasses,
      record.securityId,
      record.active,
      asOf,
      shareClassIds,
      listingIds,
      allStableIds,
      activeExchangeSymbols,
      cikAndTickerTokens,
    );
    records.push(
      Object.freeze({
        active: record.active,
        eligibility: record.eligibility,
        instrumentType: record.instrumentType,
        issuerId: record.issuerId,
        securityId: record.securityId,
        securityName: record.securityName,
        shareClasses,
      }),
    );
    previousSecurityId = record.securityId;
  }
  return Object.freeze(records);
}

function validateShareClasses(
  values: readonly unknown[],
  securityId: string,
  securityActive: boolean,
  asOf: number,
  shareClassIds: Set<string>,
  listingIds: Set<string>,
  allStableIds: Set<string>,
  activeExchangeSymbols: Set<string>,
  cikAndTickerTokens: Set<string>,
): readonly RawShareClass[] {
  const shareClasses: RawShareClass[] = [];
  let activeCount = 0;
  let previousShareClassId = "";
  for (const value of values) {
    const shareClass = exactRecord(value, [
      "active",
      "listings",
      "securityId",
      "shareClassId",
      "shareClassName",
    ]);
    if (
      typeof shareClass.active !== "boolean" ||
      !Array.isArray(shareClass.listings) ||
      shareClass.listings.length < 1 ||
      shareClass.listings.length >
        PERSONAL_SECURITY_MASTER_LIMITS.listingsPerShareClass ||
      shareClass.securityId !== securityId ||
      !isSafeId(shareClass.shareClassId) ||
      shareClass.shareClassId <= previousShareClassId ||
      shareClassIds.has(shareClass.shareClassId) ||
      !isName(shareClass.shareClassName)
    ) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    registerStableId(shareClass.shareClassId, allStableIds);
    shareClassIds.add(shareClass.shareClassId);
    const listings = validateListings(
      shareClass.listings,
      securityId,
      shareClass.shareClassId,
      shareClass.active,
      asOf,
      listingIds,
      allStableIds,
      activeExchangeSymbols,
    );
    for (const listing of listings) {
      for (const history of listing.tickerHistory) {
        cikAndTickerTokens.add(identityKey(history.symbol));
      }
    }
    if (shareClass.active) activeCount += 1;
    shareClasses.push(
      Object.freeze({
        active: shareClass.active,
        listings,
        securityId,
        shareClassId: shareClass.shareClassId,
        shareClassName: shareClass.shareClassName,
      }),
    );
    previousShareClassId = shareClass.shareClassId;
  }
  if (securityActive !== activeCount > 0) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  return Object.freeze(shareClasses);
}

function validateListings(
  values: readonly unknown[],
  securityId: string,
  shareClassId: string,
  shareClassActive: boolean,
  asOf: number,
  listingIds: Set<string>,
  allStableIds: Set<string>,
  activeExchangeSymbols: Set<string>,
): readonly RawListing[] {
  const listings: RawListing[] = [];
  let activeCount = 0;
  let previousListingId = "";
  for (const value of values) {
    const listing = exactRecord(value, [
      "active",
      "country",
      "currentSymbol",
      "exchangeMic",
      "exchangeMicType",
      "listingId",
      "securityId",
      "shareClassId",
      "tickerHistory",
    ]);
    if (
      typeof listing.active !== "boolean" ||
      listing.country !== "US" ||
      (listing.currentSymbol !== null && !isSymbol(listing.currentSymbol)) ||
      !isMic(listing.exchangeMic) ||
      listing.exchangeMicType !== "operating" ||
      !isSafeId(listing.listingId) ||
      listing.listingId <= previousListingId ||
      listing.securityId !== securityId ||
      listing.shareClassId !== shareClassId ||
      !Array.isArray(listing.tickerHistory) ||
      listing.tickerHistory.length < 1 ||
      listing.tickerHistory.length >
        PERSONAL_SECURITY_MASTER_LIMITS.tickerHistoryPerListing ||
      listingIds.has(listing.listingId)
    ) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    registerStableId(listing.listingId, allStableIds);
    const tickerHistory = validateTickerHistory(
      listing.tickerHistory,
      listing.listingId,
      listing.exchangeMic,
      listing.active,
      listing.currentSymbol,
      asOf,
      activeExchangeSymbols,
    );
    if (listing.active) activeCount += 1;
    listingIds.add(listing.listingId);
    listings.push(
      Object.freeze({
        active: listing.active,
        country: "US",
        currentSymbol: listing.currentSymbol,
        exchangeMic: listing.exchangeMic,
        exchangeMicType: "operating",
        listingId: listing.listingId,
        securityId,
        shareClassId,
        tickerHistory,
      }),
    );
    previousListingId = listing.listingId;
  }
  if (shareClassActive !== activeCount > 0) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  return Object.freeze(listings);
}

function validateTickerHistory(
  values: readonly unknown[],
  listingId: string,
  exchangeMic: string,
  listingActive: boolean,
  currentSymbol: string | null,
  asOf: number,
  activeExchangeSymbols: Set<string>,
): readonly RawTickerHistory[] {
  const history: RawTickerHistory[] = [];
  let previousFrom = -Infinity;
  let previousTo = -Infinity;
  let previousSymbol = "";
  for (const [index, value] of values.entries()) {
    const item = exactRecord(value, [
      "listingId",
      "symbol",
      "timeBasis",
      "validFrom",
      "validTo",
    ]);
    if (
      item.listingId !== listingId ||
      !isSymbol(item.symbol) ||
      (item.timeBasis !== "sec_filing_observed" &&
        item.timeBasis !== "prospective_snapshot_observed") ||
      typeof item.validFrom !== "string" ||
      (item.validTo !== null && typeof item.validTo !== "string")
    ) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    const validFrom = parseInstant(item.validFrom);
    const validTo = item.validTo === null ? null : parseInstant(item.validTo);
    if (
      validFrom > asOf ||
      validFrom <= previousFrom ||
      validFrom < previousTo ||
      (validTo !== null && (validTo <= validFrom || validTo > asOf)) ||
      (item.symbol === previousSymbol && index > 0) ||
      (validTo === null && index !== values.length - 1)
    ) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    history.push(
      Object.freeze({
        listingId,
        symbol: item.symbol,
        timeBasis: item.timeBasis,
        validFrom: item.validFrom,
        validTo: item.validTo,
      }),
    );
    previousFrom = validFrom;
    previousTo = validTo ?? Infinity;
    previousSymbol = item.symbol;
  }
  const last = history.at(-1);
  if (
    last === undefined ||
    (listingActive &&
      (currentSymbol === null ||
        last.validTo !== null ||
        last.symbol !== currentSymbol)) ||
    (!listingActive && (currentSymbol !== null || last.validTo === null))
  ) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  if (listingActive && currentSymbol !== null) {
    const activeKey = `${exchangeMic}\u0000${currentSymbol}`;
    if (activeExchangeSymbols.has(activeKey)) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    activeExchangeSymbols.add(activeKey);
  }
  return Object.freeze(history);
}

function validateProviderMappings(
  values: readonly unknown[],
  issuerIds: ReadonlySet<string>,
  securityIds: ReadonlySet<string>,
  shareClassIds: ReadonlySet<string>,
  listingIds: ReadonlySet<string>,
  allStableIds: Set<string>,
  providerSecurityTokens: Set<string>,
): readonly RawProviderMapping[] {
  const mappings: RawProviderMapping[] = [];
  const mappingIds = new Set<string>();
  const providerIdentities = new Set<string>();
  const providerTargetIdentities = new Set<string>();
  const mappedShareClassIds = new Set<string>();
  const mappedListingIds = new Set<string>();
  let previousMappingId = "";
  for (const value of values) {
    const mapping = exactRecord(value, [
      "mappingKind",
      "mappingId",
      "providerId",
      "providerSecurityId",
      "targetId",
    ]);
    if (
      (mapping.mappingKind !== "composite" &&
        mapping.mappingKind !== "issuer" &&
        mapping.mappingKind !== "listing" &&
        mapping.mappingKind !== "security" &&
        mapping.mappingKind !== "share_class") ||
      !isSafeId(mapping.mappingId) ||
      mapping.mappingId <= previousMappingId ||
      !isSafeId(mapping.providerId) ||
      typeof mapping.providerSecurityId !== "string" ||
      !PROVIDER_SECURITY_ID.test(mapping.providerSecurityId) ||
      !isSafeId(mapping.targetId) ||
      mappingIds.has(mapping.mappingId) ||
      identityKey(mapping.mappingId) ===
        identityKey(mapping.providerSecurityId) ||
      !mappingTargetsExpectedEntity(
        mapping.mappingKind,
        mapping.targetId,
        issuerIds,
        securityIds,
        shareClassIds,
        listingIds,
      )
    ) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    registerStableId(mapping.mappingId, allStableIds);
    const providerIdentity = `${mapping.providerId}\u0000${mapping.providerSecurityId}`;
    if (providerIdentities.has(providerIdentity)) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    providerIdentities.add(providerIdentity);
    const providerTargetIdentity = `${mapping.providerId}\u0000${mapping.mappingKind}\u0000${mapping.targetId}`;
    if (providerTargetIdentities.has(providerTargetIdentity)) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    providerTargetIdentities.add(providerTargetIdentity);
    providerSecurityTokens.add(identityKey(mapping.providerSecurityId));
    if (mapping.mappingKind === "listing") {
      mappedListingIds.add(mapping.targetId);
    } else if (
      mapping.mappingKind === "share_class" ||
      mapping.mappingKind === "composite"
    ) {
      mappedShareClassIds.add(mapping.targetId);
    }
    mappingIds.add(mapping.mappingId);
    mappings.push(
      Object.freeze({
        mappingKind: mapping.mappingKind,
        mappingId: mapping.mappingId,
        providerId: mapping.providerId,
        providerSecurityId: mapping.providerSecurityId,
        targetId: mapping.targetId,
      }),
    );
    previousMappingId = mapping.mappingId;
  }
  if (
    [...shareClassIds].some((id) => !mappedShareClassIds.has(id)) ||
    [...listingIds].some((id) => !mappedListingIds.has(id))
  ) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  return Object.freeze(mappings);
}

function mappingTargetsExpectedEntity(
  mappingKind: RawProviderMapping["mappingKind"],
  targetId: string,
  issuerIds: ReadonlySet<string>,
  securityIds: ReadonlySet<string>,
  shareClassIds: ReadonlySet<string>,
  listingIds: ReadonlySet<string>,
): boolean {
  switch (mappingKind) {
    case "issuer":
      return issuerIds.has(targetId);
    case "security":
      return securityIds.has(targetId);
    case "share_class":
    case "composite":
      return shareClassIds.has(targetId);
    case "listing":
      return listingIds.has(targetId);
  }
}

function buildCoverage(
  records: readonly RawSecurityRecord[],
  contentKind: PersonalSecurityMasterContentKind,
  sourceCoverage: SourceCoverage,
  issuerCount: number,
  providerMappingCount: number,
): PersonalSecurityMasterCatalogCoverage {
  let activeEligibleSecurities = 0;
  let activeListings = 0;
  let formerTickerEntries = 0;
  let inactiveSecurities = 0;
  let shareClasses = 0;
  for (const record of records) {
    if (record.active && record.eligibility === "eligible") {
      activeEligibleSecurities += 1;
    } else {
      inactiveSecurities += 1;
    }
    shareClasses += record.shareClasses.length;
    for (const shareClass of record.shareClasses) {
      for (const listing of shareClass.listings) {
        if (listing.active) activeListings += 1;
        formerTickerEntries += listing.tickerHistory.filter(
          (entry) => entry.validTo !== null,
        ).length;
      }
    }
  }
  const eligibleSecurityBand =
    activeEligibleSecurities >= 3_000
      ? "at_least_3000"
      : activeEligibleSecurities >= 1_000
        ? "from_1000_to_2999"
        : "under_1000";
  return Object.freeze({
    admittedSourceRecords: sourceCoverage.admittedRecords,
    activeEligibleSecurities,
    activeListings,
    basis:
      contentKind === "synthetic_engineering"
        ? "synthetic_engineering_only_not_real_universe"
        : "owner_declared_snapshot_only",
    eligibleSecurityBand,
    formerTickerEntries,
    ineligibleSourceRecords: sourceCoverage.ineligibleRecords,
    inactiveSecurities,
    issuers: issuerCount,
    providerMappings: providerMappingCount,
    quarantinedSourceRecords: sourceCoverage.quarantinedRecords,
    sourceRecords: sourceCoverage.sourceRecords,
    staleSourceRecords: sourceCoverage.staleRecords,
    shareClasses,
    totalSecurities: records.length,
    unsupportedSourceRecords: sourceCoverage.unsupportedRecords,
  });
}

function buildSearchEntries(
  records: readonly RawSecurityRecord[],
  issuers: readonly RawIssuer[],
): readonly SearchEntry[] {
  const entries: SearchEntry[] = [];
  const issuersById = new Map(
    issuers.map((issuer) => [issuer.issuerId, issuer] as const),
  );
  for (const record of records) {
    if (!record.active || record.eligibility !== "eligible") continue;
    const issuer = issuersById.get(record.issuerId);
    if (issuer === undefined) fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    for (const shareClass of record.shareClasses) {
      if (!shareClass.active) continue;
      for (const listing of shareClass.listings) {
        if (!listing.active || listing.currentSymbol === null) continue;
        entries.push(
          Object.freeze({
            currentSymbolNormalized:
              normalizeSymbolQuery(listing.currentSymbol) ??
              listing.currentSymbol,
            formerSymbols: Object.freeze(
              listing.tickerHistory
                .filter((entry) => entry.validTo !== null)
                .map((entry) =>
                  Object.freeze({
                    normalized:
                      normalizeSymbolQuery(entry.symbol) ?? entry.symbol,
                    symbol: entry.symbol,
                  }),
                ),
            ),
            issuer,
            issuerNameNormalized: normalizeSearchText(issuer.issuerName),
            listing,
            record,
            securityNameNormalized: normalizeSearchText(record.securityName),
            shareClass,
            shareClassNameNormalized: normalizeSearchText(
              shareClass.shareClassName,
            ),
          }),
        );
      }
    }
  }
  return Object.freeze(entries);
}

function searchState(
  state: CatalogState,
  request: NormalizedSearchRequest,
): PersonalSecurityMasterSearchResponse {
  const matches: RankedSearchResult[] = [];
  for (const entry of state.searchEntries) {
    const match = rankSearchEntry(
      entry,
      request.nameQuery,
      request.symbolQuery,
    );
    if (match === undefined) continue;
    const currentSymbol = entry.listing.currentSymbol;
    if (currentSymbol === null) continue;
    matches.push(
      Object.freeze({
        rank: match.rank,
        result: Object.freeze({
          cik: entry.issuer.cik,
          country: entry.listing.country,
          exchangeMic: entry.listing.exchangeMic,
          instrumentType: entry.record.instrumentType,
          issuerId: entry.record.issuerId,
          issuerName: entry.issuer.issuerName,
          listingId: entry.listing.listingId,
          matchKind: match.kind,
          matchedValue: match.value,
          securityId: entry.record.securityId,
          securityName: entry.record.securityName,
          shareClassId: entry.shareClass.shareClassId,
          shareClassName: entry.shareClass.shareClassName,
          symbol: currentSymbol,
        }),
      }),
    );
  }
  matches.sort(compareRankedResults);
  return Object.freeze({
    limitApplied: request.limit,
    normalizedQuery: request.symbolQuery ?? request.nameQuery,
    results: Object.freeze(
      matches.slice(0, request.limit).map((match) => match.result),
    ),
    totalMatches: matches.length,
  });
}

function rankSearchEntry(
  entry: SearchEntry,
  nameQuery: string,
  symbolQuery: string | null,
):
  | Readonly<{
      kind: PersonalSecurityMasterSearchMatchKind;
      rank: number;
      value: string;
    }>
  | undefined {
  const currentSymbol = entry.listing.currentSymbol;
  if (currentSymbol === null) return undefined;
  if (symbolQuery !== null && entry.currentSymbolNormalized === symbolQuery) {
    return Object.freeze({
      kind: "current_symbol_exact",
      rank: 0,
      value: currentSymbol,
    });
  }
  if (
    symbolQuery !== null &&
    entry.currentSymbolNormalized.startsWith(symbolQuery)
  ) {
    return Object.freeze({
      kind: "current_symbol_prefix",
      rank: 1,
      value: currentSymbol,
    });
  }
  const formerExact = entry.formerSymbols.find(
    (candidate) => symbolQuery !== null && candidate.normalized === symbolQuery,
  );
  if (formerExact !== undefined) {
    return Object.freeze({
      kind: "former_symbol_exact",
      rank: 2,
      value: formerExact.symbol,
    });
  }
  const formerPrefix = entry.formerSymbols.find(
    (candidate) =>
      symbolQuery !== null && candidate.normalized.startsWith(symbolQuery),
  );
  if (formerPrefix !== undefined) {
    return Object.freeze({
      kind: "former_symbol_prefix",
      rank: 3,
      value: formerPrefix.symbol,
    });
  }
  if (
    entry.issuerNameNormalized === nameQuery ||
    entry.securityNameNormalized === nameQuery ||
    entry.shareClassNameNormalized === nameQuery
  ) {
    return Object.freeze({
      kind: "name_exact",
      rank: 4,
      value:
        entry.issuerNameNormalized === nameQuery
          ? entry.issuer.issuerName
          : entry.securityNameNormalized === nameQuery
            ? entry.record.securityName
            : entry.shareClass.shareClassName,
    });
  }
  if (hasTokenPrefix(entry.issuerNameNormalized, nameQuery)) {
    return Object.freeze({
      kind: "name_token_prefix",
      rank: 5,
      value: entry.issuer.issuerName,
    });
  }
  if (hasTokenPrefix(entry.securityNameNormalized, nameQuery)) {
    return Object.freeze({
      kind: "name_token_prefix",
      rank: 5,
      value: entry.record.securityName,
    });
  }
  if (hasTokenPrefix(entry.shareClassNameNormalized, nameQuery)) {
    return Object.freeze({
      kind: "name_token_prefix",
      rank: 5,
      value: entry.shareClass.shareClassName,
    });
  }
  if (entry.issuerNameNormalized.includes(nameQuery)) {
    return Object.freeze({
      kind: "name_contains",
      rank: 6,
      value: entry.issuer.issuerName,
    });
  }
  if (entry.securityNameNormalized.includes(nameQuery)) {
    return Object.freeze({
      kind: "name_contains",
      rank: 6,
      value: entry.record.securityName,
    });
  }
  if (entry.shareClassNameNormalized.includes(nameQuery)) {
    return Object.freeze({
      kind: "name_contains",
      rank: 6,
      value: entry.shareClass.shareClassName,
    });
  }
  return undefined;
}

function hasTokenPrefix(value: string, query: string): boolean {
  return value.split(" ").some((token) => token.startsWith(query));
}

function compareRankedResults(
  left: RankedSearchResult,
  right: RankedSearchResult,
): number {
  return (
    left.rank - right.rank ||
    compareCodePoints(left.result.symbol, right.result.symbol) ||
    compareCodePoints(left.result.exchangeMic, right.result.exchangeMic) ||
    compareCodePoints(
      normalizeSearchText(left.result.securityName),
      normalizeSearchText(right.result.securityName),
    ) ||
    compareCodePoints(
      normalizeSearchText(left.result.shareClassName),
      normalizeSearchText(right.result.shareClassName),
    ) ||
    compareCodePoints(left.result.shareClassId, right.result.shareClassId) ||
    compareCodePoints(left.result.securityId, right.result.securityId) ||
    compareCodePoints(left.result.listingId, right.result.listingId)
  );
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .replace(NON_LETTER_OR_NUMBER, " ")
    .replace(SPACES, " ")
    .trim();
}

function normalizeSymbolQuery(value: string): string | null {
  const candidate = value.trim().normalize("NFKC").toUpperCase();
  return SYMBOL.test(candidate) ? candidate : null;
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = [...left].map((value) => value.codePointAt(0) as number);
  const rightPoints = [...right].map((value) => value.codePointAt(0) as number);
  const sharedLength = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

function exactDataObject(
  value: unknown,
  keys: readonly string[],
  code: PersonalSecurityMasterFailureCode,
): Record<string, unknown> {
  if (!isPlainRecord(value)) fail(code);
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(code);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.some((key) => typeof key !== "string") ||
    !exactKeys(ownKeys as string[], keys) ||
    !exactKeys(Object.keys(descriptors), keys) ||
    !keys.every((key) => {
      const descriptor = descriptors[key];
      return (
        descriptor !== undefined &&
        "value" in descriptor &&
        descriptor.enumerable === true
      );
    })
  ) {
    fail(code);
  }
  const captured: Record<string, unknown> = {};
  for (const key of keys) captured[key] = descriptors[key]!.value;
  return captured;
}

function exactDenseDataArray(
  value: unknown,
  expectedLength: number,
  code: PersonalSecurityMasterFailureCode,
): readonly unknown[] {
  if (!Array.isArray(value)) fail(code);
  let descriptors: PropertyDescriptorMap;
  let prototype: object | null;
  try {
    descriptors = Object.getOwnPropertyDescriptors(
      value,
    ) as unknown as PropertyDescriptorMap;
    prototype = Reflect.getPrototypeOf(value);
  } catch {
    fail(code);
  }
  const keys = Reflect.ownKeys(descriptors);
  const lengthDescriptor = descriptors.length;
  if (
    prototype !== Array.prototype ||
    keys.length !== expectedLength + 1 ||
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.value !== expectedLength ||
    lengthDescriptor.enumerable !== false
  ) {
    fail(code);
  }
  const captured: unknown[] = [];
  for (let index = 0; index < expectedLength; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      fail(code);
    }
    captured[index] = descriptor.value;
  }
  if (captured.length !== expectedLength) fail(code);
  return Object.freeze(captured);
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!isPlainRecord(value) || !exactKeys(Object.keys(value), keys)) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  if (actual.length !== expected.length) return false;
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedExpected.every((key, index) => sortedActual[index] === key);
}

function assertJsonBudget(root: unknown): void {
  const stack: Array<{ depth: number; value: unknown }> = [
    { depth: 0, value: root },
  ];
  let aggregateArrayEntries = 0;
  let aggregateStringCodePoints = 0;
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined)
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    nodes += 1;
    if (
      nodes > PERSONAL_SECURITY_MASTER_LIMITS.documentNodes ||
      current.depth > PERSONAL_SECURITY_MASTER_LIMITS.documentDepth
    ) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
    if (typeof current.value === "string") {
      const length = codePointLength(current.value);
      if (
        length > PERSONAL_SECURITY_MASTER_LIMITS.maximumStringCodePoints ||
        DISALLOWED_CHARACTER.test(current.value)
      ) {
        fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
      }
      aggregateStringCodePoints += length;
    } else if (
      current.value === null ||
      typeof current.value === "boolean" ||
      (typeof current.value === "number" && Number.isSafeInteger(current.value))
    ) {
      continue;
    } else if (Array.isArray(current.value)) {
      aggregateArrayEntries += current.value.length;
      for (const value of current.value) {
        stack.push({ depth: current.depth + 1, value });
      }
    } else {
      if (!isPlainRecord(current.value)) {
        fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
      }
      for (const [key, value] of Object.entries(current.value)) {
        const keyLength = codePointLength(key);
        if (
          keyLength > PERSONAL_SECURITY_MASTER_LIMITS.maximumStringCodePoints ||
          DISALLOWED_CHARACTER.test(key)
        ) {
          fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
        }
        aggregateStringCodePoints += keyLength;
        stack.push({ depth: current.depth + 1, value });
      }
    }
    if (
      aggregateArrayEntries >
        PERSONAL_SECURITY_MASTER_LIMITS.aggregateArrayEntries ||
      aggregateStringCodePoints >
        PERSONAL_SECURITY_MASTER_LIMITS.aggregateStringCodePoints
    ) {
      fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
    }
  }
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (!isPlainRecord(value)) throw new TypeError();
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value);
}

function isVersion(value: unknown): value is string {
  return isSafeId(value);
}

function isCik(value: unknown): value is string {
  return typeof value === "string" && CIK.test(value);
}

function isMic(value: unknown): value is string {
  return typeof value === "string" && MIC.test(value);
}

function isSymbol(value: unknown): value is string {
  return typeof value === "string" && SYMBOL.test(value);
}

function isArtifactMediaType(
  value: unknown,
): value is PersonalSecurityMasterProvenanceArtifact["mediaType"] {
  return (
    value === "application/json" ||
    value === "application/zip" ||
    value === "text/csv" ||
    value === "text/html" ||
    value === "text/plain"
  );
}

function isHttpsUrl(value: unknown): value is string {
  if (!isBoundedText(value, 1, 2_048)) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.search === "" &&
      parsed.hash === "" &&
      parsed.href === value
    );
  } catch {
    return false;
  }
}

function isName(value: unknown): value is string {
  if (
    !isBoundedText(
      value,
      1,
      PERSONAL_SECURITY_MASTER_LIMITS.searchableNameCodePoints,
    ) ||
    value !== value.trim() ||
    DISALLOWED_CHARACTER.test(value)
  ) {
    return false;
  }
  const normalized = normalizeSearchText(value);
  return (
    codePointLength(normalized) > 0 &&
    codePointLength(normalized) <=
      PERSONAL_SECURITY_MASTER_LIMITS.normalizedSearchQueryCodePoints
  );
}

function isBoundedText(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  if (typeof value !== "string") return false;
  const length = codePointLength(value);
  return (
    length >= minimum && length <= maximum && !DISALLOWED_CHARACTER.test(value)
  );
}

function codePointLength(value: string): number {
  return [...value].length;
}

function parseInstant(value: string): number {
  if (!ISO_UTC.test(value)) fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  const instant = Date.parse(value);
  if (!Number.isFinite(instant) || new Date(instant).toISOString() !== value) {
    fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  }
  return instant;
}

function registerStableId(value: string, allStableIds: Set<string>): void {
  const key = identityKey(value);
  if (allStableIds.has(key)) fail("PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID");
  allStableIds.add(key);
}

function identityKey(value: string): string {
  return value.normalize("NFKC").toUpperCase();
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function publicError(
  error: unknown,
  fallback: PersonalSecurityMasterFailureCode,
): PersonalSecurityMasterError {
  return new PersonalSecurityMasterError(
    error instanceof InternalPersonalSecurityMasterFailure
      ? error.code
      : fallback,
  );
}

function fail(code: PersonalSecurityMasterFailureCode): never {
  throw new InternalPersonalSecurityMasterFailure(code);
}
