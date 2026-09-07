import type {
  PersonalSecurityMasterSearchResponseDto,
  PersonalSecurityMasterSearchResultDto,
  PersonalSecurityMasterSnapshotReceiptDto,
  PersonalSecurityMasterStatusDto,
} from "@research-cockpit/contracts";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3100";
const literalLoopbackHttpOriginPattern =
  /^http:\/\/(?:127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})$/u;
const controlFormatOrSurrogateCharacter = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const identifier = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const exchangeMic = /^[A-Z0-9]{4}$/u;
const symbol = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const digest = /^sha256:[0-9a-f]{64}$/u;
const bareDigest = /^[0-9a-f]{64}$/u;
const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export const MAIN_PERSONAL_WATCHLIST_ID = "main" as const;
export const MAIN_PERSONAL_WATCHLIST_NAME = "My Watchlist" as const;
export const MAIN_PERSONAL_WATCHLIST_PATH =
  "/v1/personal-filing/workspace/watchlists/main" as const;

const privateRequestOptions = Object.freeze({
  cache: "no-store",
  credentials: "include",
  redirect: "error",
  referrerPolicy: "no-referrer",
} satisfies Pick<
  RequestInit,
  "cache" | "credentials" | "redirect" | "referrerPolicy"
>);

export type PersonalWorkspaceApiErrorCode =
  | "conflict"
  | "invalid_request"
  | "invalid_response"
  | "session_unavailable"
  | "unavailable";

export class PersonalWorkspaceApiError extends Error {
  constructor(readonly code: PersonalWorkspaceApiErrorCode) {
    super("The personal workspace request was not accepted.");
    this.name = "PersonalWorkspaceApiError";
  }
}

export interface PersonalWatchlistMembership {
  readonly country: "US";
  readonly exchangeMic: string;
  readonly instrumentType: "adr" | "common_stock";
  readonly issuerId: string;
  readonly issuerName: string;
  readonly listingId: string;
  readonly note: string;
  readonly securityId: string;
  readonly securityName: string;
  readonly shareClassId: string;
  readonly shareClassName: string;
  readonly symbol: string;
}

export interface PersonalWatchlistPayload {
  readonly schemaVersion: 1;
  readonly name: typeof MAIN_PERSONAL_WATCHLIST_NAME;
  readonly snapshotSha256: `sha256:${string}`;
  readonly memberships: readonly PersonalWatchlistMembership[];
}

export interface PersonalWatchlistRecord {
  readonly id: typeof MAIN_PERSONAL_WATCHLIST_ID;
  readonly version: number;
  readonly payload: PersonalWatchlistPayload;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SavedPersonalWatchlist {
  readonly version: number;
  readonly payload: PersonalWatchlistPayload;
}

const snapshotKeys = [
  "asOf",
  "catalogId",
  "catalogVersion",
  "claim",
  "coverage",
  "generatedAt",
  "profile",
  "provenance",
  "schemaVersion",
  "snapshotSha256",
  "sourcePolicyCompatibility",
  "status",
] as const;
const coverageKeys = [
  "activeEligibleSecurities",
  "activeListings",
  "admittedSourceRecords",
  "basis",
  "eligibleSecurityBand",
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
const provenanceKeys = [
  "acquiredAt",
  "artifacts",
  "attribution",
  "contentKind",
  "sourceId",
  "sourceRevision",
] as const;
const artifactKeys = [
  "acquiredAt",
  "artifactId",
  "contentSha256",
  "mediaType",
  "sourceUri",
  "sourceVersion",
] as const;
const policyKeys = [
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
] as const;
const searchResponseKeys = [
  "limitApplied",
  "normalizedQuery",
  "results",
  "snapshot",
  "totalMatches",
] as const;
const searchResultKeys = [
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
const vaultRecordKeys = [
  "createdAt",
  "id",
  "kind",
  "payload",
  "payloadSha256",
  "profile",
  "updatedAt",
  "version",
] as const;
const watchlistPayloadKeys = [
  "memberships",
  "name",
  "schemaVersion",
  "snapshotSha256",
] as const;
const membershipKeys = [
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "issuerName",
  "listingId",
  "note",
  "securityId",
  "securityName",
  "shareClassId",
  "shareClassName",
  "symbol",
] as const;
const mutationReceiptKeys = [
  "committedAt",
  "digestSha256",
  "id",
  "kind",
  "operation",
  "profile",
  "replayed",
  "version",
] as const;

export async function fetchPersonalSecurityMasterStatus(
  signal: AbortSignal,
): Promise<PersonalSecurityMasterStatusDto> {
  const response = await request("/v1/personal-filing/security-master/status", {
    headers: { Accept: "application/json" },
    method: "GET",
    signal,
  });
  if (!response.ok) throw responseError(response.status);
  const value: unknown = await response.json();
  if (!hasExactKeys(value, ["snapshot"]) || !isSnapshot(value.snapshot)) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return value as unknown as PersonalSecurityMasterStatusDto;
}

export async function searchPersonalSecurities(
  rawQuery: string,
  signal: AbortSignal,
  limit = 10,
): Promise<PersonalSecurityMasterSearchResponseDto> {
  const query = normalizeSearchQuery(rawQuery);
  if (
    query === null ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 25
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const path = `/v1/personal-filing/security-master/search?q=${encodeURIComponent(query)}&limit=${String(limit)}`;
  const response = await request(path, {
    headers: { Accept: "application/json" },
    method: "GET",
    signal,
  });
  if (!response.ok) throw responseError(response.status);
  const value: unknown = await response.json();
  if (!isSearchResponse(value)) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return value;
}

export async function fetchMainPersonalWatchlist(
  signal: AbortSignal,
): Promise<PersonalWatchlistRecord | null> {
  const response = await request(MAIN_PERSONAL_WATCHLIST_PATH, {
    headers: { Accept: "application/json" },
    method: "GET",
    signal,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw responseError(response.status);
  const value: unknown = await response.json();
  if (!isMainWatchlistRecord(value)) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return Object.freeze({
    id: MAIN_PERSONAL_WATCHLIST_ID,
    version: value.version,
    payload: copyWatchlistPayload(value.payload),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  });
}

export async function saveMainPersonalWatchlist(
  currentVersion: number,
  payload: PersonalWatchlistPayload,
  signal: AbortSignal,
): Promise<SavedPersonalWatchlist> {
  if (
    !Number.isSafeInteger(currentVersion) ||
    currentVersion < 0 ||
    !isWatchlistPayload(payload)
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const creating = currentVersion === 0;
  const response = await request(MAIN_PERSONAL_WATCHLIST_PATH, {
    body: JSON.stringify({ payload }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(creating
        ? { "If-None-Match": "*" }
        : { "If-Match": `"v${String(currentVersion)}"` }),
      "X-Research-Cockpit-Idempotency-Key": mutationIdempotencyKey(),
      "X-Research-Cockpit-Intent": creating
        ? "personal-vault-create"
        : "personal-vault-update",
    },
    method: "POST",
    signal,
  });
  if (!response.ok) throw responseError(response.status);
  const value: unknown = await response.json();
  if (
    !isMutationReceipt(value) ||
    value.version !== currentVersion + 1 ||
    response.status !== (creating ? 201 : 200)
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return Object.freeze({
    version: value.version,
    payload: copyWatchlistPayload(payload),
  });
}

export function createEmptyPersonalWatchlist(
  snapshotSha256: string,
): PersonalWatchlistPayload {
  if (!digest.test(snapshotSha256)) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  return Object.freeze({
    schemaVersion: 1,
    name: MAIN_PERSONAL_WATCHLIST_NAME,
    snapshotSha256: snapshotSha256 as `sha256:${string}`,
    memberships: Object.freeze([]),
  });
}

export function membershipFromSearchResult(
  result: PersonalSecurityMasterSearchResultDto,
): PersonalWatchlistMembership {
  const candidate: PersonalWatchlistMembership = {
    country: result.country,
    exchangeMic: result.exchangeMic,
    instrumentType: result.instrumentType,
    issuerId: result.issuerId,
    issuerName: result.issuerName,
    listingId: result.listingId,
    note: "",
    securityId: result.securityId,
    securityName: result.securityName,
    shareClassId: result.shareClassId,
    shareClassName: result.shareClassName,
    symbol: result.symbol,
  };
  if (!isWatchlistMembership(candidate)) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  return Object.freeze(candidate);
}

export function normalizeWatchlistNote(value: string): string | null {
  const normalized = value.trim().normalize("NFC");
  return [...normalized].length <= 2_000 &&
    !controlFormatOrSurrogateCharacter.test(normalized)
    ? normalized
    : null;
}

function normalizeSearchQuery(value: string): string | null {
  const query = value.trim().normalize("NFC");
  return query.length > 0 &&
    [...query].length <= 128 &&
    !controlFormatOrSurrogateCharacter.test(query)
    ? query
    : null;
}

async function request(
  path: string,
  options: Pick<RequestInit, "body" | "headers" | "method" | "signal">,
): Promise<Response> {
  const baseUrl = getPersonalWorkspaceApiBaseUrl();
  if (baseUrl === null) {
    throw new PersonalWorkspaceApiError("unavailable");
  }
  try {
    return await fetch(new URL(path, baseUrl), {
      ...privateRequestOptions,
      ...options,
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    void error;
    throw new PersonalWorkspaceApiError("unavailable");
  }
}

function getPersonalWorkspaceApiBaseUrl(): string | null {
  if (hasControllingServiceWorker()) return null;
  const match = literalLoopbackHttpOriginPattern.exec(apiBaseUrl);
  if (match?.[0] !== apiBaseUrl) return null;
  const port = Number(match[1]);
  return port >= 1 && port <= 65_535 ? apiBaseUrl : null;
}

function hasControllingServiceWorker(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    return navigator.serviceWorker?.controller != null;
  } catch {
    return true;
  }
}

function responseError(status: number): PersonalWorkspaceApiError {
  if (status === 403)
    return new PersonalWorkspaceApiError("session_unavailable");
  if (status === 409) return new PersonalWorkspaceApiError("conflict");
  if (status === 400) return new PersonalWorkspaceApiError("invalid_request");
  return new PersonalWorkspaceApiError("unavailable");
}

function mutationIdempotencyKey(): string {
  try {
    return `watchlist-${globalThis.crypto.randomUUID()}`;
  } catch {
    throw new PersonalWorkspaceApiError("unavailable");
  }
}

function isSearchResponse(
  value: unknown,
): value is PersonalSecurityMasterSearchResponseDto {
  if (!hasExactKeys(value, searchResponseKeys)) return false;
  return (
    isPositiveInteger(value.limitApplied) &&
    value.limitApplied <= 25 &&
    typeof value.normalizedQuery === "string" &&
    value.normalizedQuery.length > 0 &&
    Array.isArray(value.results) &&
    value.results.length <= value.limitApplied &&
    value.results.every(isSearchResult) &&
    isSnapshot(value.snapshot) &&
    isNonnegativeInteger(value.totalMatches) &&
    value.totalMatches >= value.results.length
  );
}

function isSearchResult(
  value: unknown,
): value is PersonalSecurityMasterSearchResultDto {
  if (!hasExactKeys(value, searchResultKeys)) return false;
  return (
    typeof value.cik === "string" &&
    /^[0-9]{10}$/u.test(value.cik) &&
    value.country === "US" &&
    typeof value.exchangeMic === "string" &&
    exchangeMic.test(value.exchangeMic) &&
    (value.instrumentType === "adr" ||
      value.instrumentType === "common_stock") &&
    isIdentifier(value.issuerId) &&
    isDisplayText(value.issuerName) &&
    isIdentifier(value.listingId) &&
    [
      "current_symbol_exact",
      "current_symbol_prefix",
      "former_symbol_exact",
      "former_symbol_prefix",
      "name_exact",
      "name_token_prefix",
      "name_contains",
    ].includes(String(value.matchKind)) &&
    isDisplayText(value.matchedValue) &&
    isIdentifier(value.securityId) &&
    isDisplayText(value.securityName) &&
    isIdentifier(value.shareClassId) &&
    isDisplayText(value.shareClassName) &&
    typeof value.symbol === "string" &&
    symbol.test(value.symbol)
  );
}

function isSnapshot(
  value: unknown,
): value is PersonalSecurityMasterSnapshotReceiptDto {
  if (!hasExactKeys(value, snapshotKeys)) return false;
  return (
    isInstant(value.asOf) &&
    isIdentifier(value.catalogId) &&
    isIdentifier(value.catalogVersion) &&
    value.claim ===
      "bounded_exact_owner_local_security_master_snapshot_admitted" &&
    isCoverage(value.coverage) &&
    isInstant(value.generatedAt) &&
    value.profile === "personal_single_user_local_security_master" &&
    isProvenance(value.provenance) &&
    value.schemaVersion === "1.0.0" &&
    typeof value.snapshotSha256 === "string" &&
    digest.test(value.snapshotSha256) &&
    isSourcePolicy(value.sourcePolicyCompatibility) &&
    value.status === "admitted_for_personal_local_search"
  );
}

function isCoverage(value: unknown): boolean {
  if (!hasExactKeys(value, coverageKeys)) return false;
  return (
    coverageKeys
      .filter((key) => key !== "basis" && key !== "eligibleSecurityBand")
      .every((key) => isNonnegativeInteger(value[key])) &&
    (value.basis === "owner_declared_snapshot_only" ||
      value.basis === "synthetic_engineering_only_not_real_universe") &&
    ["at_least_3000", "from_1000_to_2999", "under_1000"].includes(
      String(value.eligibleSecurityBand),
    )
  );
}

function isProvenance(value: unknown): boolean {
  if (!hasExactKeys(value, provenanceKeys)) return false;
  return (
    isInstant(value.acquiredAt) &&
    Array.isArray(value.artifacts) &&
    value.artifacts.length > 0 &&
    value.artifacts.every(isArtifact) &&
    isDisplayText(value.attribution) &&
    (value.contentKind === "owner_local_source" ||
      value.contentKind === "synthetic_engineering") &&
    isIdentifier(value.sourceId) &&
    typeof value.sourceRevision === "string" &&
    digest.test(value.sourceRevision)
  );
}

function isArtifact(value: unknown): boolean {
  if (!hasExactKeys(value, artifactKeys)) return false;
  return (
    isInstant(value.acquiredAt) &&
    isIdentifier(value.artifactId) &&
    typeof value.contentSha256 === "string" &&
    digest.test(value.contentSha256) &&
    [
      "application/json",
      "application/zip",
      "text/csv",
      "text/html",
      "text/plain",
    ].includes(String(value.mediaType)) &&
    typeof value.sourceUri === "string" &&
    value.sourceUri.startsWith("https://") &&
    isBoundedDisplayText(value.sourceVersion, 256)
  );
}

function isSourcePolicy(value: unknown): boolean {
  if (!hasExactKeys(value, policyKeys)) return false;
  return (
    value.attribution === "required" &&
    value.cache === "permitted_owner_local" &&
    value.decision === "compatible" &&
    value.deleteOnRequest === true &&
    value.display === "permitted_owner_local" &&
    isInstant(value.effectiveAt) &&
    isInstant(value.expiresAt) &&
    value.export === "prohibited" &&
    value.intendedUse === "personal_security_research" &&
    value.localOnly === true &&
    value.operation === "fetch_snapshot" &&
    typeof value.policyDocumentSha256 === "string" &&
    digest.test(value.policyDocumentSha256) &&
    isIdentifier(value.policyId) &&
    value.policyProfile === "personal_single_user_local_connected" &&
    value.policySchemaVersion === "1.0.0" &&
    isIdentifier(value.policyVersion) &&
    value.redistribution === "prohibited" &&
    value.retention === "permitted_owner_local" &&
    isInstant(value.reviewedAt) &&
    value.revocationCheck ===
      "offline_snapshot_only_cannot_discover_later_revocation" &&
    value.revokedAt === null &&
    value.rightsBasis === "owner_reviewed_rights_compatible" &&
    value.search === "permitted_owner_local" &&
    isIdentifier(value.sourceId)
  );
}

function isMainWatchlistRecord(value: unknown): value is {
  version: number;
  payload: PersonalWatchlistPayload;
  createdAt: string;
  updatedAt: string;
} {
  if (!hasExactKeys(value, vaultRecordKeys)) return false;
  return (
    isInstant(value.createdAt) &&
    value.id === MAIN_PERSONAL_WATCHLIST_ID &&
    value.kind === "watchlist" &&
    isWatchlistPayload(value.payload) &&
    typeof value.payloadSha256 === "string" &&
    bareDigest.test(value.payloadSha256) &&
    value.profile === "personal_single_user_local_vault" &&
    isInstant(value.updatedAt) &&
    isPositiveInteger(value.version)
  );
}

function isWatchlistPayload(value: unknown): value is PersonalWatchlistPayload {
  if (!hasExactKeys(value, watchlistPayloadKeys)) return false;
  if (
    value.schemaVersion !== 1 ||
    value.name !== MAIN_PERSONAL_WATCHLIST_NAME ||
    typeof value.snapshotSha256 !== "string" ||
    !digest.test(value.snapshotSha256) ||
    !Array.isArray(value.memberships) ||
    value.memberships.length > 10_000 ||
    !value.memberships.every(isWatchlistMembership)
  ) {
    return false;
  }
  return (
    new Set(value.memberships.map((membership) => membership.listingId))
      .size === value.memberships.length
  );
}

function isWatchlistMembership(
  value: unknown,
): value is PersonalWatchlistMembership {
  if (!hasExactKeys(value, membershipKeys)) return false;
  return (
    value.country === "US" &&
    typeof value.exchangeMic === "string" &&
    exchangeMic.test(value.exchangeMic) &&
    (value.instrumentType === "adr" ||
      value.instrumentType === "common_stock") &&
    isIdentifier(value.issuerId) &&
    isDisplayText(value.issuerName) &&
    isIdentifier(value.listingId) &&
    typeof value.note === "string" &&
    normalizeWatchlistNote(value.note) === value.note &&
    isIdentifier(value.securityId) &&
    isDisplayText(value.securityName) &&
    isIdentifier(value.shareClassId) &&
    isDisplayText(value.shareClassName) &&
    typeof value.symbol === "string" &&
    symbol.test(value.symbol)
  );
}

function isMutationReceipt(value: unknown): value is { version: number } {
  if (!hasExactKeys(value, mutationReceiptKeys)) return false;
  return (
    isInstant(value.committedAt) &&
    typeof value.digestSha256 === "string" &&
    bareDigest.test(value.digestSha256) &&
    value.id === MAIN_PERSONAL_WATCHLIST_ID &&
    value.kind === "watchlist" &&
    value.operation === "put" &&
    value.profile === "personal_single_user_local_vault" &&
    typeof value.replayed === "boolean" &&
    isPositiveInteger(value.version)
  );
}

function copyWatchlistPayload(
  payload: PersonalWatchlistPayload,
): PersonalWatchlistPayload {
  return Object.freeze({
    schemaVersion: 1,
    name: MAIN_PERSONAL_WATCHLIST_NAME,
    snapshotSha256: payload.snapshotSha256,
    memberships: Object.freeze(
      payload.memberships.map((membership) => Object.freeze({ ...membership })),
    ),
  });
}

function hasExactKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    expected.every((key, index) => actual[index] === key)
  );
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifier.test(value);
}

function isDisplayText(value: unknown): value is string {
  return isBoundedDisplayText(value, 512);
}

function isBoundedDisplayText(value: unknown, maximumCodePoints: number) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    [...value].length <= maximumCodePoints &&
    !controlFormatOrSurrogateCharacter.test(value)
  );
}

function isInstant(value: unknown): value is string {
  if (typeof value !== "string" || !isoInstant.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}
