import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialsDto,
  PersonalMarketDataRangeDto,
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
  PersonalQuarterlyFinancialsDto,
  PersonalValuationHistoryDto,
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
const isoDate = /^\d{4}-\d{2}-\d{2}$/u;
const decimal = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;

export const PERSONAL_MARKET_DATA_STATUS_PATH =
  "/v1/personal-filing/market-data/status" as const;
export const PERSONAL_MARKET_OVERVIEW_PATH =
  "/v1/personal-filing/market-data/overview" as const;
export const PERSONAL_ANNUAL_FINANCIALS_PATH =
  "/v1/personal-filing/market-data/annual-financials" as const;
export const PERSONAL_QUARTERLY_FINANCIALS_PATH =
  "/v1/personal-filing/market-data/quarterly-financials" as const;
export const PERSONAL_VALUATION_HISTORY_PATH =
  "/v1/personal-filing/market-data/valuation-history" as const;

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
  | "credentials_invalid"
  | "invalid_request"
  | "invalid_response"
  | "not_entitled"
  | "not_configured"
  | "not_covered"
  | "provider_unavailable"
  | "rate_limited"
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
const marketProviderKeys = [
  "attribution",
  "export",
  "historyFeed",
  "id",
  "name",
  "persistence",
  "quoteFeed",
  "redistribution",
  "retention",
] as const;
const marketStatusKeys = [
  "profile",
  "provider",
  "schemaVersion",
  "status",
] as const;
const marketOverviewKeys = [
  "history",
  "profile",
  "provider",
  "quote",
  "schemaVersion",
  "security",
  "status",
] as const;
const marketIdentityKeys = [
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;
const marketQuoteKeys = [
  "change",
  "changePercent",
  "currency",
  "freshness",
  "ingestedAt",
  "kind",
  "previousClose",
  "price",
  "sourceTime",
] as const;
const marketHistoryKeys = ["bars", "endDate", "range", "startDate"] as const;
const marketBarKeys = [
  "adjusted",
  "date",
  "dividendCash",
  "raw",
  "splitFactor",
] as const;
const marketOhlcvKeys = ["close", "high", "low", "open", "volume"] as const;
const marketRanges = new Set<PersonalMarketDataRangeDto>([
  "1m",
  "3m",
  "ytd",
  "1y",
  "5y",
  "10y",
]);
const annualFinancialsKeys = [
  "asOf",
  "coverage",
  "profile",
  "provider",
  "schemaVersion",
  "security",
  "status",
  "years",
] as const;
const annualFinancialsProviderKeys = [
  "attribution",
  "export",
  "id",
  "name",
  "persistence",
  "redistribution",
  "retention",
  "revisionBasis",
  "statementFeed",
  "valueCurrency",
] as const;
const annualFinancialsCoverageKeys = [
  "earliestFiscalYear",
  "knownReportedCells",
  "latestFiscalYear",
  "missingFiscalYears",
  "requestedAnnualYears",
  "returnedAnnualYears",
  "status",
  "unknownReportedCells",
] as const;
const annualFinancialYearKeys = [
  "fiscalYear",
  "reported",
  "statementDate",
] as const;
const annualFinancialReportedFieldKeys = [
  "revenue",
  "cost_of_revenue",
  "gross_profit",
  "research_and_development",
  "selling_general_and_administrative",
  "operating_expenses",
  "operating_income",
  "interest_expense",
  "pretax_income",
  "income_tax_expense",
  "net_income",
  "ebitda",
  "cash",
  "accounts_receivable",
  "inventory",
  "current_assets",
  "property_plant_equipment_net",
  "intangibles",
  "assets",
  "current_liabilities",
  "debt",
  "liabilities",
  "shareholders_equity",
  "depreciation_and_amortization",
  "share_based_compensation",
  "operating_cash_flow",
  "capital_expenditures",
  "free_cash_flow",
  "investing_cash_flow",
  "financing_cash_flow",
] as const satisfies readonly PersonalAnnualFinancialReportedFieldKeyDto[];
const annualFinancialKnownCellKeys = ["status", "value"] as const;
const annualFinancialUnknownCellKeys = ["reason", "status", "value"] as const;
const quarterlyFinancialsKeys = [
  "asOf",
  "coverage",
  "profile",
  "provider",
  "quarters",
  "schemaVersion",
  "security",
  "status",
] as const;
const quarterlyFinancialsCoverageKeys = [
  "earliestFiscalQuarter",
  "earliestFiscalYear",
  "knownReportedCells",
  "latestFiscalQuarter",
  "latestFiscalYear",
  "missingFiscalQuarters",
  "requestedQuarterlyPeriods",
  "returnedQuarterlyPeriods",
  "status",
  "unknownReportedCells",
] as const;
const quarterlyFinancialPeriodKeys = [
  "fiscalQuarter",
  "fiscalYear",
  "reported",
  "statementDate",
] as const;
const fiscalQuarterCoordinateKeys = ["fiscalQuarter", "fiscalYear"] as const;
const valuationHistoryKeys = [
  "asOf",
  "coverage",
  "history",
  "profile",
  "provider",
  "schemaVersion",
  "security",
  "status",
] as const;
const valuationCoverageKeys = [
  "knownCells",
  "observationCount",
  "status",
  "unknownCells",
] as const;
const valuationHistorySeriesKeys = [
  "endDate",
  "latestPoint",
  "points",
  "range",
  "startDate",
] as const;
const valuationHistoryPointKeys = [
  "date",
  "enterpriseValue",
  "marketCapitalization",
  "priceToBook",
  "priceToEarnings",
  "trailingPeg1Y",
] as const;
const valuationProviderKeys = [
  "attribution",
  "export",
  "id",
  "name",
  "persistence",
  "redistribution",
  "retention",
  "revisionBasis",
  "valuationFeed",
  "valueCurrency",
] as const;
const valuationKnownCellKeys = ["status", "unit", "value"] as const;
const valuationUnknownCellKeys = ["reason", "status", "unit", "value"] as const;
const valuationPointCellKeys = [
  "enterpriseValue",
  "marketCapitalization",
  "priceToBook",
  "priceToEarnings",
  "trailingPeg1Y",
] as const satisfies readonly (keyof Omit<
  PersonalValuationHistoryDto["history"]["points"][number],
  "date"
>)[];

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

export async function fetchPersonalMarketDataStatus(
  signal: AbortSignal,
): Promise<PersonalMarketDataStatusDto> {
  const response = await request(PERSONAL_MARKET_DATA_STATUS_PATH, {
    headers: { Accept: "application/json" },
    method: "GET",
    signal,
  });
  if (!response.ok) throw responseError(response.status);
  const value: unknown = await response.json();
  if (!isPersonalMarketDataStatus(value)) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return Object.freeze({
    ...value,
    provider: Object.freeze({ ...value.provider }),
  });
}

export async function fetchPersonalMarketOverview(
  input: Readonly<{
    listingId: string;
    range: PersonalMarketDataRangeDto;
    symbol: string;
  }>,
  signal: AbortSignal,
): Promise<PersonalMarketOverviewDto> {
  if (
    !isIdentifier(input.listingId) ||
    typeof input.symbol !== "string" ||
    !symbol.test(input.symbol) ||
    !marketRanges.has(input.range)
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const response = await request(PERSONAL_MARKET_OVERVIEW_PATH, {
    body: JSON.stringify({
      listingId: input.listingId,
      symbol: input.symbol,
      range: input.range,
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });
  if (!response.ok) throw marketOverviewResponseError(response.status);
  const value: unknown = await response.json();
  if (
    !isPersonalMarketOverview(value) ||
    value.security.listingId !== input.listingId ||
    value.security.symbol !== input.symbol ||
    value.history.range !== input.range
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return copyPersonalMarketOverview(value);
}

export async function fetchPersonalAnnualFinancials(
  input: Readonly<{ listingId: string; symbol: string }>,
  signal: AbortSignal,
): Promise<PersonalAnnualFinancialsDto> {
  if (
    !isIdentifier(input.listingId) ||
    typeof input.symbol !== "string" ||
    !symbol.test(input.symbol)
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const response = await request(PERSONAL_ANNUAL_FINANCIALS_PATH, {
    body: JSON.stringify({
      listingId: input.listingId,
      symbol: input.symbol,
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });
  if (!response.ok) throw annualFinancialsResponseError(response.status);
  const value: unknown = await response.json();
  if (
    !isPersonalAnnualFinancials(value) ||
    value.security.listingId !== input.listingId ||
    value.security.symbol !== input.symbol
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return copyPersonalAnnualFinancials(value);
}

export async function fetchPersonalQuarterlyFinancials(
  input: Readonly<{ listingId: string; symbol: string }>,
  signal: AbortSignal,
): Promise<PersonalQuarterlyFinancialsDto> {
  if (
    !isIdentifier(input.listingId) ||
    typeof input.symbol !== "string" ||
    !symbol.test(input.symbol)
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const response = await request(PERSONAL_QUARTERLY_FINANCIALS_PATH, {
    body: JSON.stringify({
      listingId: input.listingId,
      symbol: input.symbol,
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });
  if (!response.ok) throw annualFinancialsResponseError(response.status);
  const value: unknown = await response.json();
  if (
    !isPersonalQuarterlyFinancials(value) ||
    value.security.listingId !== input.listingId ||
    value.security.symbol !== input.symbol
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return copyPersonalQuarterlyFinancials(value);
}

export async function fetchPersonalValuationHistory(
  input: Readonly<{
    listingId: string;
    range: PersonalMarketDataRangeDto;
    symbol: string;
  }>,
  signal: AbortSignal,
): Promise<PersonalValuationHistoryDto> {
  if (
    !isIdentifier(input.listingId) ||
    typeof input.symbol !== "string" ||
    !symbol.test(input.symbol) ||
    !marketRanges.has(input.range)
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const response = await request(PERSONAL_VALUATION_HISTORY_PATH, {
    body: JSON.stringify({
      listingId: input.listingId,
      range: input.range,
      symbol: input.symbol,
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });
  if (!response.ok) throw annualFinancialsResponseError(response.status);
  const value: unknown = await response.json();
  if (
    !isPersonalValuationHistory(value) ||
    value.security.listingId !== input.listingId ||
    value.security.symbol !== input.symbol ||
    value.history.range !== input.range
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return copyPersonalValuationHistory(value);
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

function marketOverviewResponseError(
  status: number,
): PersonalWorkspaceApiError {
  if (status === 403)
    return new PersonalWorkspaceApiError("session_unavailable");
  if (status === 404) return new PersonalWorkspaceApiError("not_covered");
  if (status === 424)
    return new PersonalWorkspaceApiError("credentials_invalid");
  if (status === 429) return new PersonalWorkspaceApiError("rate_limited");
  if (status === 502)
    return new PersonalWorkspaceApiError("provider_unavailable");
  if (status === 503) return new PersonalWorkspaceApiError("not_configured");
  if (status === 400) return new PersonalWorkspaceApiError("invalid_request");
  return new PersonalWorkspaceApiError("unavailable");
}

function annualFinancialsResponseError(
  status: number,
): PersonalWorkspaceApiError {
  if (status === 402) return new PersonalWorkspaceApiError("not_entitled");
  return marketOverviewResponseError(status);
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

function isPersonalMarketDataStatus(
  value: unknown,
): value is PersonalMarketDataStatusDto {
  return (
    hasExactKeys(value, marketStatusKeys) &&
    value.profile === "personal_single_user_local_market_data" &&
    isPersonalMarketDataProvider(value.provider) &&
    value.schemaVersion === "1.0.0" &&
    (value.status === "configured" || value.status === "not_configured")
  );
}

function isPersonalMarketDataProvider(
  value: unknown,
): value is PersonalMarketDataStatusDto["provider"] {
  return (
    hasExactKeys(value, marketProviderKeys) &&
    value.attribution === "Tiingo" &&
    value.export === "prohibited" &&
    value.historyFeed === "tiingo_eod_composite" &&
    value.id === "tiingo" &&
    value.name === "Tiingo" &&
    value.persistence === "none" &&
    value.quoteFeed === "tiingo_iex_derived_reference" &&
    value.redistribution === "prohibited" &&
    value.retention === "active_owner_session_memory_only"
  );
}

function isPersonalMarketOverview(
  value: unknown,
): value is PersonalMarketOverviewDto {
  return (
    hasExactKeys(value, marketOverviewKeys) &&
    value.profile === "personal_single_user_local_market_data" &&
    isPersonalMarketDataProvider(value.provider) &&
    isPersonalMarketQuote(value.quote) &&
    value.schemaVersion === "1.0.0" &&
    isPersonalMarketIdentity(value.security) &&
    value.status === "available" &&
    isPersonalMarketHistory(value.history)
  );
}

function isPersonalAnnualFinancials(
  value: unknown,
): value is PersonalAnnualFinancialsDto {
  if (
    !hasExactKeys(value, annualFinancialsKeys) ||
    !isInstant(value.asOf) ||
    !isAnnualFinancialsCoverage(value.coverage) ||
    value.profile !== "personal_single_user_local_fundamentals" ||
    !isAnnualFinancialsProvider(value.provider) ||
    value.schemaVersion !== "1.1.0" ||
    !isPersonalMarketIdentity(value.security) ||
    value.status !== "available"
  ) {
    return false;
  }
  const years = value.years;
  if (
    !Array.isArray(years) ||
    years.length < 1 ||
    years.length > 10 ||
    !years.every(isAnnualFinancialYear)
  ) {
    return false;
  }
  let priorYear = Number.POSITIVE_INFINITY;
  let known = 0;
  let unknown = 0;
  for (const year of years) {
    if (year.fiscalYear >= priorYear) {
      return false;
    }
    priorYear = year.fiscalYear;
    for (const key of annualFinancialReportedFieldKeys) {
      if (year.reported[key].status === "known") known += 1;
      else unknown += 1;
    }
  }
  const latest = years[0]?.fiscalYear;
  const earliest = years.at(-1)?.fiscalYear;
  if (latest === undefined || earliest === undefined) return false;
  const requestedAnnualYears = value.coverage.requestedAnnualYears;
  if (
    years.some(
      ({ fiscalYear }) => fiscalYear < latest - requestedAnnualYears + 1,
    )
  ) {
    return false;
  }
  const presentYears = new Set(years.map(({ fiscalYear }) => fiscalYear));
  const expectedMissing = Array.from(
    { length: value.coverage.requestedAnnualYears },
    (_, offset) => latest - offset,
  ).filter((fiscalYear) => !presentYears.has(fiscalYear));
  return (
    value.coverage.returnedAnnualYears === years.length &&
    value.coverage.latestFiscalYear === latest &&
    value.coverage.earliestFiscalYear === earliest &&
    value.coverage.knownReportedCells === known &&
    value.coverage.unknownReportedCells === unknown &&
    JSON.stringify(value.coverage.missingFiscalYears) ===
      JSON.stringify(expectedMissing) &&
    value.coverage.status ===
      (expectedMissing.length === 0 && unknown === 0 ? "complete" : "partial")
  );
}

function isPersonalQuarterlyFinancials(
  value: unknown,
): value is PersonalQuarterlyFinancialsDto {
  if (
    !hasExactKeys(value, quarterlyFinancialsKeys) ||
    !isInstant(value.asOf) ||
    !isQuarterlyFinancialsCoverage(value.coverage) ||
    value.profile !== "personal_single_user_local_fundamentals" ||
    !isAnnualFinancialsProvider(value.provider) ||
    value.schemaVersion !== "1.0.0" ||
    !isPersonalMarketIdentity(value.security) ||
    value.status !== "available" ||
    !Array.isArray(value.quarters) ||
    value.quarters.length < 1 ||
    value.quarters.length > 16 ||
    !value.quarters.every(isQuarterlyFinancialPeriod)
  ) {
    return false;
  }

  let priorOrdinal = Number.POSITIVE_INFINITY;
  let known = 0;
  let unknown = 0;
  for (const quarter of value.quarters) {
    const ordinal = fiscalQuarterOrdinal(
      quarter.fiscalYear,
      quarter.fiscalQuarter,
    );
    if (ordinal >= priorOrdinal) return false;
    priorOrdinal = ordinal;
    for (const key of annualFinancialReportedFieldKeys) {
      if (quarter.reported[key].status === "known") known += 1;
      else unknown += 1;
    }
  }

  const latest = value.quarters[0];
  const earliest = value.quarters.at(-1);
  if (latest === undefined || earliest === undefined) return false;
  const expectedCoordinates = Array.from(
    { length: value.coverage.requestedQuarterlyPeriods },
    (_, offset) => fiscalQuarterAtOffset(latest, offset),
  );
  const present = new Set(
    value.quarters.map(({ fiscalQuarter, fiscalYear }) =>
      fiscalQuarterKey(fiscalYear, fiscalQuarter),
    ),
  );
  const expectedMissing = expectedCoordinates.filter(
    ({ fiscalQuarter, fiscalYear }) =>
      !present.has(fiscalQuarterKey(fiscalYear, fiscalQuarter)),
  );
  const oldestRequested = expectedCoordinates.at(-1);
  if (
    oldestRequested === undefined ||
    value.quarters.some(
      ({ fiscalQuarter, fiscalYear }) =>
        fiscalQuarterOrdinal(fiscalYear, fiscalQuarter) <
        fiscalQuarterOrdinal(
          oldestRequested.fiscalYear,
          oldestRequested.fiscalQuarter,
        ),
    )
  ) {
    return false;
  }
  return (
    value.coverage.returnedQuarterlyPeriods === value.quarters.length &&
    value.coverage.latestFiscalYear === latest.fiscalYear &&
    value.coverage.latestFiscalQuarter === latest.fiscalQuarter &&
    value.coverage.earliestFiscalYear === earliest.fiscalYear &&
    value.coverage.earliestFiscalQuarter === earliest.fiscalQuarter &&
    value.coverage.knownReportedCells === known &&
    value.coverage.unknownReportedCells === unknown &&
    JSON.stringify(value.coverage.missingFiscalQuarters) ===
      JSON.stringify(expectedMissing) &&
    value.coverage.status ===
      (expectedMissing.length === 0 && unknown === 0 ? "complete" : "partial")
  );
}

function isPersonalValuationHistory(
  value: unknown,
): value is PersonalValuationHistoryDto {
  if (
    !hasExactKeys(value, valuationHistoryKeys) ||
    !isInstant(value.asOf) ||
    !isValuationCoverage(value.coverage) ||
    value.profile !== "personal_single_user_local_valuation" ||
    !isValuationProvider(value.provider) ||
    value.schemaVersion !== "1.0.0" ||
    !isPersonalMarketIdentity(value.security) ||
    value.status !== "available" ||
    !isValuationHistorySeries(value.history)
  ) {
    return false;
  }
  let knownCells = 0;
  for (const point of value.history.points) {
    for (const key of valuationPointCellKeys) {
      if (point[key].status === "known") knownCells += 1;
    }
  }
  const totalCells =
    value.history.points.length * valuationPointCellKeys.length;
  const unknownCells = totalCells - knownCells;
  const expectedWindow = valuationRangeDates(value.history.range, value.asOf);
  return (
    value.history.startDate === expectedWindow.startDate &&
    value.history.endDate === expectedWindow.endDate &&
    value.coverage.observationCount === value.history.points.length &&
    value.coverage.knownCells === knownCells &&
    value.coverage.unknownCells === unknownCells &&
    value.coverage.status === (unknownCells === 0 ? "complete" : "partial")
  );
}

function valuationRangeDates(
  range: PersonalMarketDataRangeDto,
  asOf: string,
): Readonly<{ endDate: string; startDate: string }> {
  const instant = new Date(asOf);
  const endDate = instant.toISOString().slice(0, 10);
  let start: Date;
  switch (range) {
    case "1m":
      start = subtractValuationCalendar(instant, 0, 1);
      break;
    case "3m":
      start = subtractValuationCalendar(instant, 0, 3);
      break;
    case "ytd":
      start = new Date(Date.UTC(instant.getUTCFullYear(), 0, 1));
      break;
    case "1y":
      start = subtractValuationCalendar(instant, 1, 0);
      break;
    case "5y":
      start = subtractValuationCalendar(instant, 5, 0);
      break;
    case "10y":
      start = subtractValuationCalendar(instant, 10, 0);
      break;
  }
  return { endDate, startDate: start.toISOString().slice(0, 10) };
}

function subtractValuationCalendar(
  date: Date,
  years: number,
  months: number,
): Date {
  const sourceMonth = date.getUTCMonth();
  const targetMonthOrdinal = sourceMonth - months;
  const targetYear =
    date.getUTCFullYear() - years + Math.floor(targetMonthOrdinal / 12);
  const targetMonth = ((targetMonthOrdinal % 12) + 12) % 12;
  const targetDay = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate(),
  );
  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

function isValuationProvider(
  value: unknown,
): value is PersonalValuationHistoryDto["provider"] {
  return (
    hasExactKeys(value, valuationProviderKeys) &&
    value.attribution === "Tiingo" &&
    value.export === "prohibited" &&
    value.id === "tiingo" &&
    value.name === "Tiingo" &&
    value.persistence === "none" &&
    value.redistribution === "prohibited" &&
    value.retention === "active_owner_session_memory_only" &&
    value.revisionBasis === "provider_most_recent" &&
    value.valuationFeed === "tiingo_fundamentals_daily" &&
    value.valueCurrency === "USD"
  );
}

function isValuationCoverage(
  value: unknown,
): value is PersonalValuationHistoryDto["coverage"] {
  return (
    hasExactKeys(value, valuationCoverageKeys) &&
    isNonnegativeInteger(value.knownCells) &&
    isPositiveInteger(value.observationCount) &&
    value.observationCount <= 4_096 &&
    (value.status === "complete" || value.status === "partial") &&
    isNonnegativeInteger(value.unknownCells)
  );
}

function isValuationHistorySeries(
  value: unknown,
): value is PersonalValuationHistoryDto["history"] {
  if (!hasExactKeys(value, valuationHistorySeriesKeys)) return false;
  const latestPoint: unknown = value.latestPoint;
  const points: readonly unknown[] = Array.isArray(value.points)
    ? value.points
    : [];
  if (
    !isDate(value.startDate) ||
    !isDate(value.endDate) ||
    value.startDate > value.endDate ||
    !marketRanges.has(value.range as PersonalMarketDataRangeDto) ||
    !Array.isArray(value.points) ||
    points.length < 1 ||
    points.length > 4_096 ||
    !isValuationHistoryPoint(latestPoint)
  ) {
    return false;
  }

  let previousDate = "";
  for (const point of points) {
    if (
      !isValuationHistoryPoint(point) ||
      point.date <= previousDate ||
      point.date < value.startDate ||
      point.date > value.endDate
    ) {
      return false;
    }
    previousDate = point.date;
  }
  const latest: unknown = points.at(-1);
  return (
    isValuationHistoryPoint(latest) &&
    sameValuationHistoryPoint(latestPoint, latest)
  );
}

function isValuationHistoryPoint(
  value: unknown,
): value is PersonalValuationHistoryDto["history"]["points"][number] {
  return (
    hasExactKeys(value, valuationHistoryPointKeys) &&
    isDate(value.date) &&
    isValuationCell(value.enterpriseValue, "USD") &&
    isValuationCell(value.marketCapitalization, "USD") &&
    isValuationCell(value.priceToBook, "ratio") &&
    isValuationCell(value.priceToEarnings, "ratio") &&
    isValuationCell(value.trailingPeg1Y, "ratio")
  );
}

function isValuationCell(value: unknown, unit: "USD" | "ratio"): boolean {
  if (hasExactKeys(value, valuationKnownCellKeys)) {
    return (
      value.status === "known" &&
      value.unit === unit &&
      isCanonicalFinancialDecimal(value.value)
    );
  }
  return (
    hasExactKeys(value, valuationUnknownCellKeys) &&
    value.reason === "not_supplied_by_provider" &&
    value.status === "unknown" &&
    value.unit === unit &&
    value.value === null
  );
}

function sameValuationHistoryPoint(
  left: PersonalValuationHistoryDto["history"]["points"][number],
  right: PersonalValuationHistoryDto["history"]["points"][number],
): boolean {
  return (
    left.date === right.date &&
    valuationPointCellKeys.every((key) =>
      sameValuationCell(left[key], right[key]),
    )
  );
}

function sameValuationCell(
  left: PersonalValuationHistoryDto["history"]["points"][number][(typeof valuationPointCellKeys)[number]],
  right: PersonalValuationHistoryDto["history"]["points"][number][(typeof valuationPointCellKeys)[number]],
): boolean {
  return (
    left.status === right.status &&
    left.unit === right.unit &&
    left.value === right.value &&
    (left.status === "known" ||
      (right.status === "unknown" && left.reason === right.reason))
  );
}

function isAnnualFinancialsProvider(
  value: unknown,
): value is PersonalAnnualFinancialsDto["provider"] {
  return (
    hasExactKeys(value, annualFinancialsProviderKeys) &&
    value.attribution === "Tiingo" &&
    value.export === "prohibited" &&
    value.id === "tiingo" &&
    value.name === "Tiingo" &&
    value.persistence === "none" &&
    value.redistribution === "prohibited" &&
    value.retention === "active_owner_session_memory_only" &&
    value.revisionBasis === "provider_most_recent" &&
    value.statementFeed === "tiingo_fundamentals_statements" &&
    value.valueCurrency === "USD"
  );
}

function isAnnualFinancialsCoverage(
  value: unknown,
): value is PersonalAnnualFinancialsDto["coverage"] {
  return (
    hasExactKeys(value, annualFinancialsCoverageKeys) &&
    isPositiveInteger(value.earliestFiscalYear) &&
    isNonnegativeInteger(value.knownReportedCells) &&
    isPositiveInteger(value.latestFiscalYear) &&
    Array.isArray(value.missingFiscalYears) &&
    value.missingFiscalYears.length <= 9 &&
    value.missingFiscalYears.every(
      (fiscalYear) =>
        isPositiveInteger(fiscalYear) &&
        fiscalYear >= 1900 &&
        fiscalYear <= 9999,
    ) &&
    new Set(value.missingFiscalYears).size ===
      value.missingFiscalYears.length &&
    value.requestedAnnualYears === 10 &&
    isPositiveInteger(value.returnedAnnualYears) &&
    value.returnedAnnualYears <= 10 &&
    (value.status === "complete" || value.status === "partial") &&
    isNonnegativeInteger(value.unknownReportedCells)
  );
}

function isQuarterlyFinancialsCoverage(
  value: unknown,
): value is PersonalQuarterlyFinancialsDto["coverage"] {
  return (
    hasExactKeys(value, quarterlyFinancialsCoverageKeys) &&
    isFiscalQuarter(value.earliestFiscalQuarter) &&
    isBoundedFiscalYear(value.earliestFiscalYear) &&
    isNonnegativeInteger(value.knownReportedCells) &&
    isFiscalQuarter(value.latestFiscalQuarter) &&
    isBoundedFiscalYear(value.latestFiscalYear) &&
    Array.isArray(value.missingFiscalQuarters) &&
    value.missingFiscalQuarters.length <= 15 &&
    value.missingFiscalQuarters.every(isFiscalQuarterCoordinate) &&
    new Set(
      value.missingFiscalQuarters.map(({ fiscalQuarter, fiscalYear }) =>
        fiscalQuarterKey(fiscalYear, fiscalQuarter),
      ),
    ).size === value.missingFiscalQuarters.length &&
    value.requestedQuarterlyPeriods === 16 &&
    isPositiveInteger(value.returnedQuarterlyPeriods) &&
    value.returnedQuarterlyPeriods <= 16 &&
    (value.status === "complete" || value.status === "partial") &&
    isNonnegativeInteger(value.unknownReportedCells)
  );
}

function isAnnualFinancialYear(
  value: unknown,
): value is PersonalAnnualFinancialsDto["years"][number] {
  if (
    !hasExactKeys(value, annualFinancialYearKeys) ||
    !isPositiveInteger(value.fiscalYear) ||
    value.fiscalYear < 1900 ||
    value.fiscalYear > 9999 ||
    !isDate(value.statementDate)
  ) {
    return false;
  }
  const reported = value.reported;
  if (!hasExactKeys(reported, annualFinancialReportedFieldKeys)) return false;
  return annualFinancialReportedFieldKeys.every((key) =>
    isAnnualFinancialReportedCell(reported[key]),
  );
}

function isQuarterlyFinancialPeriod(
  value: unknown,
): value is PersonalQuarterlyFinancialsDto["quarters"][number] {
  if (
    !hasExactKeys(value, quarterlyFinancialPeriodKeys) ||
    !isFiscalQuarter(value.fiscalQuarter) ||
    !isBoundedFiscalYear(value.fiscalYear) ||
    !isDate(value.statementDate)
  ) {
    return false;
  }
  const reported = value.reported;
  if (!hasExactKeys(reported, annualFinancialReportedFieldKeys)) return false;
  return annualFinancialReportedFieldKeys.every((key) =>
    isAnnualFinancialReportedCell(reported[key]),
  );
}

function isFiscalQuarterCoordinate(
  value: unknown,
): value is PersonalQuarterlyFinancialsDto["coverage"]["missingFiscalQuarters"][number] {
  return (
    hasExactKeys(value, fiscalQuarterCoordinateKeys) &&
    isFiscalQuarter(value.fiscalQuarter) &&
    isBoundedFiscalYear(value.fiscalYear)
  );
}

function isFiscalQuarter(value: unknown): value is 1 | 2 | 3 | 4 {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function isBoundedFiscalYear(value: unknown): value is number {
  return isPositiveInteger(value) && value >= 1900 && value <= 9999;
}

function fiscalQuarterOrdinal(fiscalYear: number, fiscalQuarter: number) {
  return fiscalYear * 4 + fiscalQuarter - 1;
}

function fiscalQuarterKey(fiscalYear: number, fiscalQuarter: number) {
  return `${String(fiscalYear)}-Q${String(fiscalQuarter)}`;
}

function fiscalQuarterAtOffset(
  latest: Readonly<{ fiscalQuarter: number; fiscalYear: number }>,
  offset: number,
): Readonly<{ fiscalQuarter: 1 | 2 | 3 | 4; fiscalYear: number }> {
  const ordinal =
    fiscalQuarterOrdinal(latest.fiscalYear, latest.fiscalQuarter) - offset;
  const fiscalYear = Math.floor(ordinal / 4);
  return {
    fiscalQuarter: ((ordinal % 4) + 1) as 1 | 2 | 3 | 4,
    fiscalYear,
  };
}

function isAnnualFinancialReportedCell(
  value: unknown,
): value is PersonalAnnualFinancialsDto["years"][number]["reported"][PersonalAnnualFinancialReportedFieldKeyDto] {
  if (hasExactKeys(value, annualFinancialKnownCellKeys)) {
    return value.status === "known" && isCanonicalFinancialDecimal(value.value);
  }
  return (
    hasExactKeys(value, annualFinancialUnknownCellKeys) &&
    value.reason === "not_supplied_by_provider" &&
    value.status === "unknown" &&
    value.value === null
  );
}

function isCanonicalFinancialDecimal(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    value !== "-0" &&
    /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/u.test(value)
  );
}

function isPersonalMarketIdentity(
  value: unknown,
): value is PersonalMarketOverviewDto["security"] {
  return (
    hasExactKeys(value, marketIdentityKeys) &&
    value.country === "US" &&
    typeof value.exchangeMic === "string" &&
    exchangeMic.test(value.exchangeMic) &&
    isBoundedDisplayText(value.issuerName, 256) &&
    isIdentifier(value.listingId) &&
    isBoundedDisplayText(value.securityName, 256) &&
    typeof value.symbol === "string" &&
    symbol.test(value.symbol)
  );
}

function isPersonalMarketQuote(
  value: unknown,
): value is PersonalMarketOverviewDto["quote"] {
  if (!hasExactKeys(value, marketQuoteKeys)) return false;
  const relatedValuesArePresent =
    (value.change === null &&
      value.changePercent === null &&
      value.previousClose === null) ||
    (isDecimal(value.change, true) &&
      isDecimal(value.changePercent, true) &&
      isDecimal(value.previousClose, false));
  return (
    relatedValuesArePresent &&
    value.currency === "USD" &&
    (value.freshness === "current" ||
      value.freshness === "older_than_36_hours") &&
    isInstant(value.ingestedAt) &&
    (value.kind === "derived_realtime_reference" ||
      value.kind === "end_of_day_close") &&
    isDecimal(value.price, false) &&
    isInstant(value.sourceTime)
  );
}

function isPersonalMarketHistory(
  value: unknown,
): value is PersonalMarketOverviewDto["history"] {
  if (
    !hasExactKeys(value, marketHistoryKeys) ||
    !Array.isArray(value.bars) ||
    value.bars.length < 1 ||
    value.bars.length > 4_096 ||
    !isDate(value.startDate) ||
    !isDate(value.endDate) ||
    !marketRanges.has(value.range as PersonalMarketDataRangeDto)
  ) {
    return false;
  }
  if (value.startDate > value.endDate) return false;
  let previousDate = "";
  for (const bar of value.bars) {
    if (
      !isPersonalMarketBar(bar) ||
      bar.date <= previousDate ||
      bar.date < value.startDate ||
      bar.date > value.endDate
    ) {
      return false;
    }
    previousDate = bar.date;
  }
  return true;
}

function isPersonalMarketBar(
  value: unknown,
): value is PersonalMarketOverviewDto["history"]["bars"][number] {
  return (
    hasExactKeys(value, marketBarKeys) &&
    isPersonalMarketOhlcv(value.adjusted) &&
    isDate(value.date) &&
    isDecimal(value.dividendCash, false, true) &&
    isPersonalMarketOhlcv(value.raw) &&
    isDecimal(value.splitFactor, false)
  );
}

function isPersonalMarketOhlcv(
  value: unknown,
): value is PersonalMarketOverviewDto["history"]["bars"][number]["raw"] {
  if (!hasExactKeys(value, marketOhlcvKeys)) return false;
  if (
    !isDecimal(value.close, false) ||
    !isDecimal(value.high, false) ||
    !isDecimal(value.low, false) ||
    !isDecimal(value.open, false) ||
    !isDecimal(value.volume, false, true)
  ) {
    return false;
  }
  const close = Number(value.close);
  const high = Number(value.high);
  const low = Number(value.low);
  const open = Number(value.open);
  return (
    high >= Math.max(open, close, low) && low <= Math.min(open, close, high)
  );
}

function copyPersonalMarketOverview(
  value: PersonalMarketOverviewDto,
): PersonalMarketOverviewDto {
  return Object.freeze({
    ...value,
    provider: Object.freeze({ ...value.provider }),
    quote: Object.freeze({ ...value.quote }),
    security: Object.freeze({ ...value.security }),
    history: Object.freeze({
      ...value.history,
      bars: Object.freeze(
        value.history.bars.map((bar) =>
          Object.freeze({
            ...bar,
            adjusted: Object.freeze({ ...bar.adjusted }),
            raw: Object.freeze({ ...bar.raw }),
          }),
        ),
      ),
    }),
  });
}

function copyPersonalAnnualFinancials(
  value: PersonalAnnualFinancialsDto,
): PersonalAnnualFinancialsDto {
  return Object.freeze({
    ...value,
    coverage: Object.freeze({
      ...value.coverage,
      missingFiscalYears: Object.freeze([...value.coverage.missingFiscalYears]),
    }),
    provider: Object.freeze({ ...value.provider }),
    security: Object.freeze({ ...value.security }),
    years: Object.freeze(
      value.years.map((year) =>
        Object.freeze({
          ...year,
          reported: Object.freeze(
            Object.fromEntries(
              annualFinancialReportedFieldKeys.map((key) => [
                key,
                Object.freeze({ ...year.reported[key] }),
              ]),
            ),
          ) as PersonalAnnualFinancialsDto["years"][number]["reported"],
        }),
      ),
    ),
  });
}

function copyPersonalQuarterlyFinancials(
  value: PersonalQuarterlyFinancialsDto,
): PersonalQuarterlyFinancialsDto {
  return Object.freeze({
    ...value,
    coverage: Object.freeze({
      ...value.coverage,
      missingFiscalQuarters: Object.freeze(
        value.coverage.missingFiscalQuarters.map((coordinate) =>
          Object.freeze({ ...coordinate }),
        ),
      ),
    }),
    provider: Object.freeze({ ...value.provider }),
    quarters: Object.freeze(
      value.quarters.map((quarter) =>
        Object.freeze({
          ...quarter,
          reported: Object.freeze(
            Object.fromEntries(
              annualFinancialReportedFieldKeys.map((key) => [
                key,
                Object.freeze({ ...quarter.reported[key] }),
              ]),
            ),
          ) as PersonalQuarterlyFinancialsDto["quarters"][number]["reported"],
        }),
      ),
    ),
    security: Object.freeze({ ...value.security }),
  });
}

function copyPersonalValuationHistory(
  value: PersonalValuationHistoryDto,
): PersonalValuationHistoryDto {
  const copyPoint = (
    point: PersonalValuationHistoryDto["history"]["points"][number],
  ) =>
    Object.freeze({
      ...point,
      enterpriseValue: Object.freeze({ ...point.enterpriseValue }),
      marketCapitalization: Object.freeze({ ...point.marketCapitalization }),
      priceToBook: Object.freeze({ ...point.priceToBook }),
      priceToEarnings: Object.freeze({ ...point.priceToEarnings }),
      trailingPeg1Y: Object.freeze({ ...point.trailingPeg1Y }),
    });
  const points = Object.freeze(value.history.points.map(copyPoint));
  return Object.freeze({
    ...value,
    coverage: Object.freeze({ ...value.coverage }),
    history: Object.freeze({
      ...value.history,
      latestPoint: points[points.length - 1]!,
      points,
    }),
    provider: Object.freeze({ ...value.provider }),
    security: Object.freeze({ ...value.security }),
  });
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

function isDecimal(
  value: unknown,
  signed: boolean,
  allowZero = false,
): value is string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !decimal.test(value) ||
    (!signed && value.startsWith("-"))
  ) {
    return false;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return false;
  if (signed) return true;
  return allowZero ? numeric >= 0 : numeric > 0;
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !isoDate.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
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
