import type {
  PersonalSecurityMasterCoverageDto,
  PersonalSecurityMasterSearchResultDto,
} from "./index";
import {
  encodeMainWatchlistPayload,
  isMainWatchlistPayload,
  type MainWatchlistPayload,
  type WatchlistMembership,
} from "./personal-watchlist";

export const MANAGED_WATCHLIST_PATH = "/v1/managed/watchlist" as const;
export const MANAGED_WATCHLIST_LIMITS = Object.freeze({
  payloadBytes: 262_144,
  envelopeBytes: 266_240,
} as const);
export const MANAGED_CATALOG_RESOLVE_PATH =
  "/v1/managed/catalog/resolve" as const;
export const MANAGED_CATALOG_RESOLVE_LIMITS = Object.freeze({
  listingIds: 50,
  requestBytes: 8_192,
  responseBytes: 131_072,
} as const);

export interface ManagedWatchlistCommand {
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly payload: MainWatchlistPayload;
}

export interface ManagedWatchlistDto {
  readonly version: number;
  readonly payload: MainWatchlistPayload;
}

export interface ManagedWatchlistReceiptDto extends ManagedWatchlistDto {
  readonly replayed: boolean;
}

export interface ManagedCatalogResolveRequest {
  readonly snapshotSha256: string;
  readonly listingIds: readonly string[];
}

export interface ManagedCatalogResolveResponse {
  readonly snapshotSha256: string;
  readonly results: readonly Readonly<{
    listingId: string;
    listing: Omit<WatchlistMembership, "note"> | null;
  }>[];
}

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
const SAVED_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const COMMAND_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const LISTING_KEYS = [
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "issuerName",
  "listingId",
  "securityId",
  "securityName",
  "shareClassId",
  "shareClassName",
  "symbol",
] as const;
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

/** Captures saved structure only; current catalog admission belongs to the repository. */
export function parseManagedWatchlistCommand(
  value: unknown,
): ManagedWatchlistCommand | null {
  try {
    if (!hasKeys(value, ["expectedVersion", "idempotencyKey", "payload"]))
      return null;
    const { expectedVersion, idempotencyKey } = value;
    if (
      !isCount(expectedVersion) ||
      expectedVersion >= Number.MAX_SAFE_INTEGER ||
      typeof idempotencyKey !== "string" ||
      !COMMAND_KEY.test(idempotencyKey)
    )
      return null;
    const payload = copyWatchlistPayload(value.payload);
    if (payload === null) return null;
    return boundedCopy(
      { expectedVersion, idempotencyKey, payload },
      MANAGED_WATCHLIST_LIMITS.envelopeBytes,
    );
  } catch {
    return null;
  }
}

export function parseManagedWatchlist(
  value: unknown,
): ManagedWatchlistDto | null {
  try {
    if (!hasKeys(value, ["version", "payload"])) return null;
    const version = value.version;
    if (!isCount(version)) return null;
    const payload = copyWatchlistPayload(value.payload);
    if (payload === null || (version === 0 && payload.memberships.length > 0))
      return null;
    return boundedCopy(
      { version, payload },
      MANAGED_WATCHLIST_LIMITS.envelopeBytes,
    );
  } catch {
    return null;
  }
}

/** A replay confirms this captured command, not the latest stored version. */
export function parseManagedWatchlistReceipt(
  value: unknown,
  capturedCommand: ManagedWatchlistCommand,
): ManagedWatchlistReceiptDto | null {
  try {
    const command = parseManagedWatchlistCommand(capturedCommand);
    if (
      command === null ||
      !hasKeys(value, ["version", "payload", "replayed"]) ||
      typeof value.replayed !== "boolean"
    )
      return null;
    const replayed = value.replayed;
    const saved = parseManagedWatchlist({
      version: value.version,
      payload: value.payload,
    });
    if (
      saved === null ||
      saved.version !== command.expectedVersion + 1 ||
      encodeMainWatchlistPayload(saved.payload) !==
        encodeMainWatchlistPayload(command.payload)
    )
      return null;
    return boundedCopy(
      { ...saved, replayed },
      MANAGED_WATCHLIST_LIMITS.envelopeBytes,
    );
  } catch {
    return null;
  }
}

export function parseManagedCatalogResolveRequest(
  value: unknown,
): ManagedCatalogResolveRequest | null {
  try {
    if (
      !hasKeys(value, ["snapshotSha256", "listingIds"]) ||
      typeof value.snapshotSha256 !== "string" ||
      !DIGEST.test(value.snapshotSha256) ||
      !isList(
        value.listingIds,
        MANAGED_CATALOG_RESOLVE_LIMITS.listingIds,
        isSavedId,
      ) ||
      value.listingIds.length === 0 ||
      new Set(value.listingIds).size !== value.listingIds.length
    )
      return null;
    return boundedCopy(
      {
        snapshotSha256: value.snapshotSha256,
        listingIds: Object.freeze([...value.listingIds]),
      },
      MANAGED_CATALOG_RESOLVE_LIMITS.requestBytes,
    );
  } catch {
    return null;
  }
}

export function parseManagedCatalogResolveResponse(
  value: unknown,
  capturedRequest: ManagedCatalogResolveRequest,
): ManagedCatalogResolveResponse | null {
  try {
    const request = parseManagedCatalogResolveRequest(capturedRequest);
    if (
      request === null ||
      !hasKeys(value, ["snapshotSha256", "results"]) ||
      value.snapshotSha256 !== request.snapshotSha256 ||
      !isList(
        value.results,
        MANAGED_CATALOG_RESOLVE_LIMITS.listingIds,
        isResolvedResult,
      ) ||
      value.results.length !== request.listingIds.length ||
      !value.results.every(
        (result, index) => result.listingId === request.listingIds[index],
      )
    )
      return null;
    return boundedCopy(
      {
        snapshotSha256: request.snapshotSha256,
        results: Object.freeze(
          value.results.map((result) =>
            Object.freeze({
              listingId: result.listingId,
              listing:
                result.listing === null
                  ? null
                  : Object.freeze({ ...result.listing }),
            }),
          ),
        ),
      },
      MANAGED_CATALOG_RESOLVE_LIMITS.responseBytes,
    );
  } catch {
    return null;
  }
}

function copyWatchlistPayload(value: unknown): MainWatchlistPayload | null {
  if (
    !hasKeys(value, [
      "memberships",
      "name",
      "schemaVersion",
      "snapshotSha256",
    ]) ||
    !isList(
      value.memberships,
      10_000,
      (member): member is Record<string, unknown> =>
        hasKeys(member, [...LISTING_KEYS, "note"]),
    ) ||
    !isMainWatchlistPayload(value)
  )
    return null;
  const encoded = encodeMainWatchlistPayload(value);
  if (
    new TextEncoder().encode(encoded).byteLength >
    MANAGED_WATCHLIST_LIMITS.payloadBytes
  )
    return null;
  const copy: unknown = JSON.parse(encoded);
  if (!isMainWatchlistPayload(copy)) return null;
  return Object.freeze({
    ...copy,
    memberships: Object.freeze(
      copy.memberships.map((entry) => Object.freeze(entry)),
    ),
  });
}

function boundedCopy<T extends object>(
  value: T,
  maximumBytes: number,
): Readonly<T> | null {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength <=
    maximumBytes
    ? Object.freeze(value)
    : null;
}

function isSavedId(value: unknown): value is string {
  return typeof value === "string" && SAVED_ID.test(value);
}

function isResolvedResult(
  value: unknown,
): value is ManagedCatalogResolveResponse["results"][number] {
  return (
    hasKeys(value, ["listingId", "listing"]) &&
    isSavedId(value.listingId) &&
    (value.listing === null ||
      (isResolvedListing(value.listing) &&
        value.listing.listingId === value.listingId))
  );
}

function isResolvedListing(
  value: unknown,
): value is Omit<WatchlistMembership, "note"> {
  return (
    hasKeys(value, LISTING_KEYS) &&
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
    typeof value.symbol === "string" &&
    SYMBOL.test(value.symbol)
  );
}

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

type SnapshotFields = {
  readonly [Key in keyof ManagedCatalogSnapshotDto]: unknown;
};

function isSnapshot(value: unknown): value is ManagedCatalogSnapshotDto {
  return (
    hasKeys(value, [
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
    ]) &&
    hasSnapshotIdentity(value) &&
    hasSnapshotChronology(value) &&
    hasSnapshotProvenance(value)
  );
}

function hasSnapshotIdentity(value: SnapshotFields): boolean {
  return (
    value.schemaVersion === "1.0.0" &&
    value.profile === "personal_single_user_managed_security_master" &&
    typeof value.snapshotSha256 === "string" &&
    DIGEST.test(value.snapshotSha256) &&
    isId(value.catalogId) &&
    isId(value.catalogVersion)
  );
}

function hasSnapshotChronology(
  value: SnapshotFields,
): value is SnapshotFields &
  Pick<ManagedCatalogSnapshotDto, "asOf" | "generatedAt" | "acquiredAt"> {
  if (
    !isInstant(value.asOf) ||
    !isInstant(value.generatedAt) ||
    !isInstant(value.acquiredAt) ||
    value.acquiredAt > value.generatedAt ||
    value.generatedAt > value.asOf
  )
    return false;
  return true;
}

function hasSnapshotProvenance(
  value: SnapshotFields &
    Pick<ManagedCatalogSnapshotDto, "asOf" | "generatedAt" | "acquiredAt">,
): boolean {
  if (!isText(value.attribution, 512) || !isCoverage(value.coverage))
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
