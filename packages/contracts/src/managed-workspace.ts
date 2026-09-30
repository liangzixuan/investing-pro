import type {
  PersonalSecurityMasterCoverageDto,
  PersonalSecurityMasterSearchResultDto,
} from "./index";

export const MANAGED_CATALOG_STATUS_PATH = "/v1/managed/catalog" as const;
export const MANAGED_CATALOG_SEARCH_PATH =
  "/v1/managed/catalog/search" as const;
export const MANAGED_CATALOG_LIMITS = Object.freeze({
  searchResultCap: 25,
  searchQueryCodePoints: 128,
  normalizedSearchQueryCodePoints: 512,
  maximumRequestTargetCodeUnits: 2048,
  sources: 8,
  excludedCandidates: 64,
  responseBytes: 131_072,
} as const);

export interface ManagedCatalogCoverageDto extends Omit<
  PersonalSecurityMasterCoverageDto,
  "basis"
> {
  readonly basis:
    "reviewed_snapshot_only" | "synthetic_engineering_only_not_real_universe";
}

export type ManagedCatalogSourceDto = Readonly<{
  label: string;
  url: string;
}> &
  (
    | Readonly<{ issuerName: null; filingDate: null }>
    | Readonly<{ issuerName: string; filingDate: string }>
  );

export interface ManagedCatalogExcludedCandidateDto {
  readonly symbol: string;
  readonly reason: "source_review_incomplete" | "identity_not_resolved";
}

/** Public display metadata; full snapshot and rights admission stay server-side. */
export interface ManagedCatalogSnapshotDto {
  readonly schemaVersion: "1.0.0";
  readonly profile: "personal_single_user_managed_security_master";
  readonly snapshotSha256: `sha256:${string}`;
  readonly catalogId: string;
  readonly catalogVersion: string;
  readonly asOf: string;
  readonly generatedAt: string;
  readonly acquiredAt: string;
  readonly contentKind: "redistributable_source" | "synthetic_engineering";
  readonly attribution: string;
  readonly coverage: ManagedCatalogCoverageDto;
  readonly sources: readonly ManagedCatalogSourceDto[];
  readonly excludedCandidates: readonly ManagedCatalogExcludedCandidateDto[];
}

export interface ManagedCatalogStatusDto {
  readonly snapshot: ManagedCatalogSnapshotDto;
}

export interface ManagedCatalogSearchDto extends ManagedCatalogStatusDto {
  readonly results: readonly PersonalSecurityMasterSearchResultDto[];
  readonly limitApplied: typeof MANAGED_CATALOG_LIMITS.searchResultCap;
  readonly totalMatches: number;
  readonly normalizedQuery: string;
}

const ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const SYMBOL = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const DISALLOWED = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const COVERAGE_COUNTS = [
  "activeEligibleSecurities",
  "activeListings",
  "admittedSourceRecords",
  "formerTickerEntries",
  "ineligibleSourceRecords",
  "inactiveSecurities",
  "issuers",
  "providerMappings",
  "quarantinedSourceRecords",
  "sourceRecords",
  "staleSourceRecords",
  "shareClasses",
  "totalSecurities",
  "unsupportedSourceRecords",
] as const;
const RESULT_KEYS = [
  "cik",
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "issuerName",
  "listingId",
  "matchKind",
  "matchedValue",
  "securityId",
  "securityName",
  "shareClassId",
  "shareClassName",
  "symbol",
] as const;
const MATCH_KINDS = [
  "current_symbol_exact",
  "current_symbol_prefix",
  "former_symbol_exact",
  "former_symbol_prefix",
  "name_exact",
  "name_token_prefix",
  "name_contains",
];

/** Parse wire metadata without admitting a security-master snapshot. */
export function parseManagedCatalogStatus(
  value: unknown,
): ManagedCatalogStatusDto | null {
  try {
    if (!hasKeys(value, ["snapshot"]) || !isSnapshot(value.snapshot))
      return null;
    return Object.freeze({ snapshot: copySnapshot(value.snapshot) });
  } catch {
    return null;
  }
}

export function parseManagedCatalogSearch(
  value: unknown,
): ManagedCatalogSearchDto | null {
  try {
    if (
      !hasKeys(value, [
        "snapshot",
        "results",
        "limitApplied",
        "totalMatches",
        "normalizedQuery",
      ]) ||
      !isSnapshot(value.snapshot) ||
      value.limitApplied !== MANAGED_CATALOG_LIMITS.searchResultCap ||
      !isCount(value.totalMatches) ||
      value.totalMatches > value.snapshot.coverage.activeListings ||
      !isText(
        value.normalizedQuery,
        MANAGED_CATALOG_LIMITS.normalizedSearchQueryCodePoints,
      ) ||
      !isList(
        value.results,
        MANAGED_CATALOG_LIMITS.searchResultCap,
        isSearchResult,
      ) ||
      value.results.length !==
        Math.min(value.limitApplied, value.totalMatches) ||
      new Set(value.results.map((result) => result.listingId)).size !==
        value.results.length
    )
      return null;
    return Object.freeze({
      snapshot: copySnapshot(value.snapshot),
      results: Object.freeze(
        value.results.map((result) => Object.freeze({ ...result })),
      ),
      limitApplied: value.limitApplied,
      totalMatches: value.totalMatches,
      normalizedQuery: value.normalizedQuery,
    });
  } catch {
    return null;
  }
}

function isSnapshot(value: unknown): value is ManagedCatalogSnapshotDto {
  if (
    !hasKeys(value, [
      "schemaVersion",
      "profile",
      "snapshotSha256",
      "catalogId",
      "catalogVersion",
      "asOf",
      "generatedAt",
      "acquiredAt",
      "contentKind",
      "attribution",
      "coverage",
      "sources",
      "excludedCandidates",
    ]) ||
    value.schemaVersion !== "1.0.0" ||
    value.profile !== "personal_single_user_managed_security_master" ||
    typeof value.snapshotSha256 !== "string" ||
    !DIGEST.test(value.snapshotSha256) ||
    !isId(value.catalogId) ||
    !isId(value.catalogVersion) ||
    !isInstant(value.asOf) ||
    !isInstant(value.generatedAt) ||
    !isInstant(value.acquiredAt) ||
    value.acquiredAt > value.generatedAt ||
    value.generatedAt > value.asOf ||
    !isText(value.attribution, 512) ||
    !isCoverage(value.coverage)
  )
    return false;
  const basis =
    value.contentKind === "redistributable_source"
      ? "reviewed_snapshot_only"
      : value.contentKind === "synthetic_engineering"
        ? "synthetic_engineering_only_not_real_universe"
        : null;
  const asOfDate = value.asOf.slice(0, 10);
  return (
    basis !== null &&
    value.coverage.basis === basis &&
    isList(value.sources, MANAGED_CATALOG_LIMITS.sources, isSource) &&
    value.sources.every(
      (source) => source.filingDate === null || source.filingDate <= asOfDate,
    ) &&
    isList(
      value.excludedCandidates,
      MANAGED_CATALOG_LIMITS.excludedCandidates,
      isExcludedCandidate,
    ) &&
    new Set(value.excludedCandidates.map((entry) => entry.symbol)).size ===
      value.excludedCandidates.length
  );
}

function isCoverage(value: unknown): value is ManagedCatalogCoverageDto {
  if (
    !hasKeys(value, [...COVERAGE_COUNTS, "basis", "eligibleSecurityBand"]) ||
    !COVERAGE_COUNTS.every((key) => isCount(value[key]))
  )
    return false;
  const counts = value as unknown as ManagedCatalogCoverageDto;
  const band =
    counts.activeEligibleSecurities >= 3000
      ? "at_least_3000"
      : counts.activeEligibleSecurities >= 1000
        ? "from_1000_to_2999"
        : "under_1000";
  return (
    (counts.basis === "reviewed_snapshot_only" ||
      counts.basis === "synthetic_engineering_only_not_real_universe") &&
    counts.eligibleSecurityBand === band &&
    counts.admittedSourceRecords === counts.totalSecurities &&
    counts.activeEligibleSecurities + counts.inactiveSecurities ===
      counts.totalSecurities &&
    counts.issuers <= counts.totalSecurities &&
    counts.shareClasses >= counts.totalSecurities &&
    counts.sourceRecords ===
      counts.admittedSourceRecords +
        counts.ineligibleSourceRecords +
        counts.quarantinedSourceRecords +
        counts.staleSourceRecords +
        counts.unsupportedSourceRecords
  );
}

function isSource(value: unknown): value is ManagedCatalogSourceDto {
  return (
    hasKeys(value, ["label", "url", "issuerName", "filingDate"]) &&
    isText(value.label, 128) &&
    isHttpsUrl(value.url) &&
    ((value.issuerName === null && value.filingDate === null) ||
      (isText(value.issuerName, 128) && isDate(value.filingDate)))
  );
}

function isExcludedCandidate(
  value: unknown,
): value is ManagedCatalogExcludedCandidateDto {
  return (
    hasKeys(value, ["symbol", "reason"]) &&
    typeof value.symbol === "string" &&
    SYMBOL.test(value.symbol) &&
    (value.reason === "source_review_incomplete" ||
      value.reason === "identity_not_resolved")
  );
}

function isSearchResult(
  value: unknown,
): value is PersonalSecurityMasterSearchResultDto {
  return (
    hasKeys(value, RESULT_KEYS) &&
    typeof value.cik === "string" &&
    /^[0-9]{10}$/u.test(value.cik) &&
    value.country === "US" &&
    typeof value.exchangeMic === "string" &&
    /^[A-Z0-9]{4}$/u.test(value.exchangeMic) &&
    (value.instrumentType === "adr" ||
      value.instrumentType === "common_stock") &&
    isId(value.issuerId) &&
    isId(value.listingId) &&
    isId(value.securityId) &&
    isId(value.shareClassId) &&
    isText(value.issuerName, 128) &&
    isText(value.securityName, 128) &&
    isText(value.shareClassName, 128) &&
    isText(value.matchedValue, 128) &&
    typeof value.matchKind === "string" &&
    MATCH_KINDS.includes(value.matchKind) &&
    typeof value.symbol === "string" &&
    SYMBOL.test(value.symbol)
  );
}

function copySnapshot(
  value: ManagedCatalogSnapshotDto,
): ManagedCatalogSnapshotDto {
  return Object.freeze({
    ...value,
    coverage: Object.freeze({ ...value.coverage }),
    sources: Object.freeze(
      value.sources.map((source) => Object.freeze({ ...source })),
    ),
    excludedCandidates: Object.freeze(
      value.excludedCandidates.map((entry) => Object.freeze({ ...entry })),
    ),
  });
}

function hasKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const actual = Reflect.ownKeys(value);
  return (
    actual.length === keys.length &&
    keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        descriptor !== undefined &&
        descriptor.enumerable &&
        Object.hasOwn(descriptor, "value")
      );
    })
  );
}

function isText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum * 2 &&
    [...value].length <= maximum &&
    value === value.trim() &&
    !DISALLOWED.test(value)
  );
}

function isList<T>(
  value: unknown,
  maximum: number,
  isItem: (item: unknown) => item is T,
): value is readonly T[] {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (
      !descriptor ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, "value") ||
      !isItem(descriptor.value)
    )
      return false;
  }
  return true;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isInstant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  )
    return false;
  const instant = Date.parse(value);
  return Number.isFinite(instant) && new Date(instant).toISOString() === value;
}

function isDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    isInstant(`${value}T00:00:00.000Z`)
  );
}

function isHttpsUrl(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^[\x21-\x7e]{1,2048}$/u.test(value) ||
    value.includes("?") ||
    value.includes("#")
  )
    return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.href === value &&
      url.username === "" &&
      url.password === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}
