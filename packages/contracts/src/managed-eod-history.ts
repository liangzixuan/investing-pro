import { parseManagedCatalogResolveResponse } from "./managed-workspace";
import type { WatchlistMembership } from "./personal-watchlist";

export const MANAGED_EOD_HISTORY_SCHEMA_VERSION = "1.0.0" as const;
export const MANAGED_EOD_HISTORY_PATH = "/v1/managed/eod-history" as const;
export const MANAGED_EOD_HISTORY_LIMITS = Object.freeze({
  requestBytes: 4_096,
  responseBytes: 65_536,
  sourceBytes: 32_768,
  rows: 32,
});
export interface ManagedEodHistoryRequestDto {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listingId: string;
  readonly range: "1m";
}
export type ManagedEodIdentity = Omit<WatchlistMembership, "note">;
export interface ManagedEodCloseDto {
  readonly date: string;
  /** Positive normalized decimal; the display table preserves this string. */
  readonly close: string;
}
export interface ManagedEodHistoryResponseDto {
  readonly schemaVersion: typeof MANAGED_EOD_HISTORY_SCHEMA_VERSION;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly security: ManagedEodIdentity;
  readonly range: "1m";
  readonly provider: "Tiingo";
  readonly currency: "USD";
  readonly priceBasis: "raw_close";
  readonly window: Readonly<{ startDate: string; endDate: string }>;
  readonly requestStartedAt: string;
  readonly completedAt: string;
  readonly rows: readonly ManagedEodCloseDto[];
}
export const MANAGED_EOD_ERROR_CODES = Object.freeze([
  "invalid_request",
  "catalog_changed",
  "not_configured",
  "unsupported_listing",
  "unavailable",
  "request_timeout",
  "source_rate_limited",
] as const);
export type ManagedEodErrorCode = (typeof MANAGED_EOD_ERROR_CODES)[number];
export type ManagedEodErrorDto =
  | Readonly<{ error: ManagedEodErrorCode }>
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
const RESPONSE_KEYS = [
  "schemaVersion",
  "catalogSnapshotSha256",
  "security",
  "range",
  "provider",
  "currency",
  "priceBasis",
  "window",
  "requestStartedAt",
  "completedAt",
  "rows",
] as const;

/** Capture data descriptors once. Accessors and exotic object prototypes fail closed. */
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
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
      return null;
    entries.push([key, descriptor.value]);
  }
  return Object.fromEntries(entries) as Record<K[number], unknown>;
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
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
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

export function parseManagedEodHistoryRequest(
  value: unknown,
): ManagedEodHistoryRequestDto | null {
  try {
    const data = record(value, ["catalogSnapshotSha256", "listingId", "range"]);
    if (
      !data ||
      typeof data.catalogSnapshotSha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(data.catalogSnapshotSha256) ||
      typeof data.listingId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(data.listingId) ||
      data.range !== "1m"
    )
      return null;
    return bounded(
      {
        catalogSnapshotSha256: data.catalogSnapshotSha256 as `sha256:${string}`,
        listingId: data.listingId,
        range: "1m" as const,
      },
      MANAGED_EOD_HISTORY_LIMITS.requestBytes,
    );
  } catch {
    return null;
  }
}

/** Inclusive calendar-month window, clamped at the previous month's last day. */
export function managedEodHistoryWindow(
  requestStartedAt: string,
): Readonly<{ startDate: string; endDate: string }> | null {
  if (!instant(requestStartedAt)) return null;
  const endDate = requestStartedAt.slice(0, 10);
  const start = new Date(`${endDate}T00:00:00.000Z`);
  const day = start.getUTCDate();
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 1);
  const last = new Date(start);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  start.setUTCDate(Math.min(day, last.getUTCDate()));
  const startDate = start.toISOString().slice(0, 10);
  return date(startDate) ? Object.freeze({ startDate, endDate }) : null;
}

function closeRows(
  value: unknown,
  window: Readonly<{ startDate: string; endDate: string }>,
): readonly ManagedEodCloseDto[] | null {
  if (!Array.isArray(value)) return null;
  const length: unknown = Object.getOwnPropertyDescriptor(
    value,
    "length",
  )?.value;
  if (
    typeof length !== "number" ||
    !Number.isInteger(length) ||
    length < 1 ||
    length > MANAGED_EOD_HISTORY_LIMITS.rows ||
    Reflect.ownKeys(value).length !== length + 1
  )
    return null;
  const rows: ManagedEodCloseDto[] = [];
  let previous = "";
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
      return null;
    const row = record(descriptor.value, ["date", "close"]);
    if (
      !row ||
      !date(row.date) ||
      row.date <= previous ||
      row.date < window.startDate ||
      row.date > window.endDate ||
      typeof row.close !== "string" ||
      row.close.length > 64 ||
      !/^(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/u.test(row.close) ||
      row.close === "0" ||
      !Number.isFinite(Number(row.close)) ||
      Number(row.close) <= 0
    )
      return null;
    rows.push(Object.freeze({ date: row.date, close: row.close }));
    previous = row.date;
  }
  return Object.freeze(rows);
}

/** Own a bounded packet and bind the request; the panel also joins its full selected identity. */
export function parseManagedEodHistoryResponse(
  value: unknown,
  capturedRequest: ManagedEodHistoryRequestDto,
): ManagedEodHistoryResponseDto | null {
  try {
    const request = parseManagedEodHistoryRequest(capturedRequest);
    const data = record(value, RESPONSE_KEYS);
    if (
      !request ||
      !data ||
      data.schemaVersion !== MANAGED_EOD_HISTORY_SCHEMA_VERSION ||
      data.catalogSnapshotSha256 !== request.catalogSnapshotSha256 ||
      data.range !== request.range ||
      data.provider !== "Tiingo" ||
      data.currency !== "USD" ||
      data.priceBasis !== "raw_close" ||
      !instant(data.requestStartedAt) ||
      !instant(data.completedAt)
    )
      return null;
    const elapsed =
      Date.parse(data.completedAt) - Date.parse(data.requestStartedAt);
    if (elapsed < 0 || elapsed >= 10_000) return null;
    const expectedWindow = managedEodHistoryWindow(data.requestStartedAt);
    const window = record(data.window, ["startDate", "endDate"]);
    if (
      !expectedWindow ||
      !window ||
      window.startDate !== expectedWindow.startDate ||
      window.endDate !== expectedWindow.endDate
    )
      return null;
    const security = record(data.security, LISTING_KEYS);
    const resolved = parseManagedCatalogResolveResponse(
      {
        snapshotSha256: request.catalogSnapshotSha256,
        results: [{ listingId: request.listingId, listing: security }],
      },
      {
        snapshotSha256: request.catalogSnapshotSha256,
        listingIds: [request.listingId],
      },
    );
    const listing = resolved?.results[0]?.listing;
    if (!listing) return null;
    const rows = closeRows(data.rows, expectedWindow);
    if (!rows) return null;
    return bounded(
      {
        schemaVersion: MANAGED_EOD_HISTORY_SCHEMA_VERSION,
        catalogSnapshotSha256: request.catalogSnapshotSha256,
        security: listing,
        range: "1m" as const,
        provider: "Tiingo" as const,
        currency: "USD" as const,
        priceBasis: "raw_close" as const,
        window: expectedWindow,
        requestStartedAt: data.requestStartedAt,
        completedAt: data.completedAt,
        rows,
      },
      MANAGED_EOD_HISTORY_LIMITS.responseBytes,
    );
  } catch {
    return null;
  }
}

export function parseManagedEodError(
  value: unknown,
): ManagedEodErrorDto | null {
  try {
    const limited = record(value, ["error", "nextAllowedAt"]);
    if (limited?.error === "rate_limited" && instant(limited.nextAllowedAt)) {
      return Object.freeze({
        error: "rate_limited",
        nextAllowedAt: limited.nextAllowedAt,
      });
    }
    const data = record(value, ["error"]);
    if (!data || !MANAGED_EOD_ERROR_CODES.some((code) => code === data.error))
      return null;
    return Object.freeze({ error: data.error as ManagedEodErrorCode });
  } catch {
    return null;
  }
}
