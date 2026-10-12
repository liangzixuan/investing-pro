import { parseManagedCatalogResolveResponse } from "./managed-workspace";
import type { WatchlistMembership } from "./personal-watchlist";
import type {
  PersonalSecIssuerFilingsDto,
  PersonalSecRecentFilingDto,
} from "./personal-watchlist-filings";

export const MANAGED_SEC_FILINGS_PATH = "/v1/managed/sec-filings" as const;
export const MANAGED_SEC_FILINGS_LIMITS = Object.freeze({
  requestBytes: 4_096,
  responseBytes: 524_288,
  lookbackDays: 90,
  filings: 1_000,
});
export interface ManagedSecFilingsRequestDto {
  readonly schemaVersion: "1.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listingId: string;
  readonly symbol: string;
}
export interface ManagedSecFilingsResponseDto {
  readonly schemaVersion: "1.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly security: Omit<WatchlistMembership, "note"> &
    Readonly<{ cik: string }>;
  readonly window: Readonly<{
    lookbackDays: 90;
    fromDate: string;
    throughDate: string;
  }>;
  readonly requestStartedAt: string;
  readonly completedAt: string;
  readonly issuer: PersonalSecIssuerFilingsDto;
}
export type ManagedSecFilingsErrorCode =
  | "invalid_request"
  | "catalog_changed"
  | "not_configured"
  | "unavailable"
  | "request_timeout";
export type ManagedSecFilingsErrorDto =
  | Readonly<{ error: ManagedSecFilingsErrorCode }>
  | Readonly<{ error: "rate_limited"; nextAllowedAt: string }>;

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
const ISSUER_KEYS = [
  "cik",
  "status",
  "fetchedAt",
  "sourceUrl",
  "olderHistoryAvailable",
  "matchingFilings",
  "truncated",
  "filings",
] as const;
const FILINGS_KEYS = [
  "cik",
  "accessionNumber",
  "form",
  "filingDate",
  "reportDate",
  "sourceUrl",
] as const;
const STATUSES: readonly PersonalSecIssuerFilingsDto["status"][] = [
  "available",
  "not_covered",
  "rate_limited",
  "upstream_unavailable",
  "invalid_response",
];
const ERROR_CODES: readonly ManagedSecFilingsErrorCode[] = [
  "invalid_request",
  "catalog_changed",
  "not_configured",
  "unavailable",
  "request_timeout",
];

/** Read data descriptors once; getters, extra keys and exotic prototypes fail closed. */
function record<const K extends readonly string[]>(
  value: unknown,
  keys: K,
): Record<K[number], unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  if (Reflect.ownKeys(value).length !== keys.length) return null;
  const entries: [string, unknown][] = [];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!dataDescriptor(descriptor)) return null;
    entries.push([key, descriptor.value]);
  }
  return Object.fromEntries(entries) as Record<K[number], unknown>;
}
function dataDescriptor(
  value: PropertyDescriptor | undefined,
): value is PropertyDescriptor & { value: unknown } {
  return (
    value !== undefined &&
    value.enumerable === true &&
    Object.hasOwn(value, "value")
  );
}
function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}
function filingDate(
  value: unknown,
  window: ManagedSecFilingsResponseDto["window"],
): value is string {
  return date(value) && value >= window.fromDate && value <= window.throughDate;
}
function reportDate(value: unknown): value is string | null {
  return value === null || date(value);
}
function form(value: unknown): value is string {
  return (
    matches(value, /^[A-Za-z0-9][A-Za-z0-9 /()._-]{0,39}$/u) &&
    value === value.trim()
  );
}
function instant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
function date(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function cik(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{10}$/u.test(value) &&
    value !== "0000000000"
  );
}
function bounded<T extends object>(
  value: T,
  bytes: number,
): Readonly<T> | null {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength <= bytes
    ? Object.freeze(value)
    : null;
}

export function parseManagedSecFilingsRequest(
  value: unknown,
): ManagedSecFilingsRequestDto | null {
  try {
    const data = record(value, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "listingId",
      "symbol",
    ]);
    if (!data || data.schemaVersion !== "1.0.0") return null;
    if (
      typeof data.catalogSnapshotSha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(data.catalogSnapshotSha256)
    )
      return null;
    if (
      typeof data.listingId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(data.listingId)
    )
      return null;
    if (
      typeof data.symbol !== "string" ||
      !/^[A-Z0-9][A-Z0-9.-]{0,14}$/u.test(data.symbol)
    )
      return null;
    return bounded(
      {
        schemaVersion: "1.0.0" as const,
        catalogSnapshotSha256: data.catalogSnapshotSha256 as `sha256:${string}`,
        listingId: data.listingId,
        symbol: data.symbol,
      },
      MANAGED_SEC_FILINGS_LIMITS.requestBytes,
    );
  } catch {
    return null;
  }
}

/** Fixed inclusive UTC dates, captured from the original operation entry. */
export function managedSecFilingsWindow(
  requestStartedAt: string,
): ManagedSecFilingsResponseDto["window"] | null {
  if (!instant(requestStartedAt)) return null;
  const throughDate = requestStartedAt.slice(0, 10);
  const fromDate = new Date(Date.parse(throughDate) - 89 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return date(fromDate)
    ? Object.freeze({ lookbackDays: 90, fromDate, throughDate })
    : null;
}

function security(
  value: unknown,
  request: ManagedSecFilingsRequestDto,
): ManagedSecFilingsResponseDto["security"] | null {
  const data = record(value, [...LISTING_KEYS, "cik"]);
  if (!data || !cik(data.cik) || data.symbol !== request.symbol) return null;
  const { cik: issuer, ...listing } = data;
  const result = parseManagedCatalogResolveResponse(
    {
      snapshotSha256: request.catalogSnapshotSha256,
      results: [{ listingId: request.listingId, listing }],
    },
    {
      snapshotSha256: request.catalogSnapshotSha256,
      listingIds: [request.listingId],
    },
  );
  const checked = result?.results[0]?.listing;
  return checked ? Object.freeze({ ...checked, cik: issuer }) : null;
}
function filing(
  value: unknown,
  issuer: string,
  window: ManagedSecFilingsResponseDto["window"],
): PersonalSecRecentFilingDto | null {
  const row = record(value, FILINGS_KEYS);
  if (!row || row.cik !== issuer) return null;
  if (!matches(row.accessionNumber, /^\d{10}-\d{2}-\d{6}$/u)) return null;
  if (!form(row.form)) return null;
  if (!filingDate(row.filingDate, window)) return null;
  if (!reportDate(row.reportDate)) return null;
  const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${issuer.replace(/^0+/u, "")}/${row.accessionNumber}-index.htm`;
  if (row.sourceUrl !== sourceUrl) return null;
  return Object.freeze({
    cik: issuer,
    accessionNumber: row.accessionNumber,
    form: row.form,
    filingDate: row.filingDate,
    reportDate: row.reportDate,
    sourceUrl,
  });
}
function orderedAfter(
  row: PersonalSecRecentFilingDto,
  previous: PersonalSecRecentFilingDto | undefined,
): boolean {
  if (!previous) return true;
  return (
    row.filingDate < previous.filingDate ||
    (row.filingDate === previous.filingDate &&
      row.accessionNumber > previous.accessionNumber)
  );
}
function sourceRows(
  value: unknown,
  issuer: string,
  window: ManagedSecFilingsResponseDto["window"],
): readonly PersonalSecRecentFilingDto[] | null {
  if (
    !Array.isArray(value) ||
    value.length > MANAGED_SEC_FILINGS_LIMITS.filings ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    return null;
  const rows: PersonalSecRecentFilingDto[] = [];
  const accessions = new Set<string>();
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!dataDescriptor(descriptor)) return null;
    const row = filing(descriptor.value, issuer, window);
    if (!row || accessions.has(row.accessionNumber)) return null;
    const previous = rows.at(-1);
    if (!orderedAfter(row, previous)) return null;
    rows.push(row);
    accessions.add(row.accessionNumber);
  }
  return Object.freeze(rows);
}
function boundedCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 10_000
  );
}
function sourceCoverage(data: Record<(typeof ISSUER_KEYS)[number], unknown>) {
  if (
    typeof data.olderHistoryAvailable !== "boolean" ||
    typeof data.truncated !== "boolean" ||
    !boundedCount(data.matchingFilings)
  )
    return null;
  if (
    data.status !== "available" &&
    (data.matchingFilings !== 0 || data.olderHistoryAvailable)
  )
    return null;
  if (
    data.truncated !==
    data.matchingFilings > MANAGED_SEC_FILINGS_LIMITS.filings
  )
    return null;
  return {
    olderHistoryAvailable: data.olderHistoryAvailable,
    truncated: data.truncated,
    matchingFilings: data.matchingFilings,
  };
}
function observedWithin(
  value: unknown,
  started: string,
  completed: string,
): value is string {
  return instant(value) && value >= started && value <= completed;
}
function source(
  value: unknown,
  identity: ManagedSecFilingsResponseDto["security"],
  window: ManagedSecFilingsResponseDto["window"],
  started: string,
  completed: string,
): PersonalSecIssuerFilingsDto | null {
  const data = record(value, ISSUER_KEYS);
  if (!data || data.cik !== identity.cik) return null;
  if (!STATUSES.includes(data.status as PersonalSecIssuerFilingsDto["status"]))
    return null;
  if (!observedWithin(data.fetchedAt, started, completed)) return null;
  if (
    data.sourceUrl !==
    `https://data.sec.gov/submissions/CIK${identity.cik}.json`
  )
    return null;
  const coverage = sourceCoverage(data);
  if (!coverage) return null;
  const rows = sourceRows(data.filings, identity.cik, window);
  if (
    !rows ||
    rows.length !==
      Math.min(coverage.matchingFilings, MANAGED_SEC_FILINGS_LIMITS.filings)
  )
    return null;
  return Object.freeze({
    cik: identity.cik,
    status: data.status as PersonalSecIssuerFilingsDto["status"],
    fetchedAt: data.fetchedAt,
    sourceUrl: data.sourceUrl,
    ...coverage,
    filings: rows,
  });
}
function responseWindow(
  value: unknown,
  started: string,
): ManagedSecFilingsResponseDto["window"] | null {
  const expected = managedSecFilingsWindow(started);
  const actual = record(value, ["lookbackDays", "fromDate", "throughDate"]);
  if (
    !expected ||
    !actual ||
    actual.lookbackDays !== 90 ||
    actual.fromDate !== expected.fromDate ||
    actual.throughDate !== expected.throughDate
  )
    return null;
  return expected;
}
function responseTimes(started: unknown, completed: unknown) {
  if (!instant(started) || !instant(completed)) return null;
  const elapsed = Date.parse(completed) - Date.parse(started);
  return elapsed >= 0 && elapsed < 10_000
    ? { requestStartedAt: started, completedAt: completed }
    : null;
}

export function parseManagedSecFilingsResponse(
  value: unknown,
  capturedRequest: ManagedSecFilingsRequestDto,
): ManagedSecFilingsResponseDto | null {
  try {
    const request = parseManagedSecFilingsRequest(capturedRequest);
    const data = record(value, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "security",
      "window",
      "requestStartedAt",
      "completedAt",
      "issuer",
    ]);
    if (
      !request ||
      !data ||
      data.schemaVersion !== "1.0.0" ||
      data.catalogSnapshotSha256 !== request.catalogSnapshotSha256
    )
      return null;
    const times = responseTimes(data.requestStartedAt, data.completedAt);
    if (!times) return null;
    const expected = responseWindow(data.window, times.requestStartedAt);
    if (!expected) return null;
    const identity = security(data.security, request);
    if (!identity) return null;
    const issuer = source(
      data.issuer,
      identity,
      expected,
      times.requestStartedAt,
      times.completedAt,
    );
    if (!issuer) return null;
    return bounded(
      {
        schemaVersion: "1.0.0" as const,
        catalogSnapshotSha256: request.catalogSnapshotSha256,
        security: identity,
        window: expected,
        ...times,
        issuer,
      },
      MANAGED_SEC_FILINGS_LIMITS.responseBytes,
    );
  } catch {
    return null;
  }
}

export function parseManagedSecFilingsError(
  value: unknown,
): ManagedSecFilingsErrorDto | null {
  try {
    const cooldown = record(value, ["error", "nextAllowedAt"]);
    if (cooldown?.error === "rate_limited" && instant(cooldown.nextAllowedAt))
      return Object.freeze({
        error: "rate_limited",
        nextAllowedAt: cooldown.nextAllowedAt,
      });
    const data = record(value, ["error"]);
    return data &&
      ERROR_CODES.includes(data.error as ManagedSecFilingsErrorCode)
      ? Object.freeze({ error: data.error as ManagedSecFilingsErrorCode })
      : null;
  } catch {
    return null;
  }
}
