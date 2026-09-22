import type {
  PersonalSecRecentFilingDto,
  PersonalWatchlistFilingListingDto,
} from "./personal-watchlist-filings";

export const PERSONAL_FILING_MONITOR_LIMITS = {
  selectedListings: 20,
  seenPerIssuer: 1_000,
  inboxPerIssuer: 50,
  inbox: 1_000,
  issuerBytes: 192 * 1_024,
  lookbackDays: 30,
  retentionDays: 30,
} as const;
export interface PersonalFilingMonitorPolicyDto {
  readonly enabled: boolean;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly watchlistVersion: number;
  readonly listingIds: readonly string[];
  readonly dailyTime: string;
  readonly timeZone: string;
  readonly quietHours: boolean;
  readonly desktopNotifications: boolean;
}
export interface PersonalFilingMonitorCommandDto {
  readonly schemaVersion: "1.0.0";
  readonly expectedVersion: number;
}
export interface PersonalFilingMonitorConfigureDto extends PersonalFilingMonitorCommandDto {
  readonly policy: PersonalFilingMonitorPolicyDto;
}
export interface PersonalFilingMonitorAcknowledgeDto extends PersonalFilingMonitorCommandDto {
  readonly eventIds: readonly string[];
}
export type PersonalFilingMonitorDeliveryStatus =
  | "disabled"
  | "pending"
  | "reserved"
  | "not_submitted"
  | "submission_unconfirmed"
  | "observed_shown"
  | "delivery_uncertain";
export interface PersonalFilingMonitorInboxDto {
  readonly id: string;
  readonly filing: PersonalSecRecentFilingDto;
  readonly listings: readonly PersonalWatchlistFilingListingDto[];
  readonly firstSeenAt: string;
  readonly readAt: string | null;
  readonly delivery: {
    readonly status: PersonalFilingMonitorDeliveryStatus;
    readonly attemptedAt: string | null;
    readonly completedAt: string | null;
    readonly shownObserved: boolean;
  };
}
export interface PersonalFilingMonitorIssuerDto {
  readonly cik: string;
  readonly listings: readonly PersonalWatchlistFilingListingDto[];
  readonly seeded: boolean;
  readonly lastCompleteAt: string | null;
  readonly status:
    "unseeded" | "complete" | "unavailable" | "truncated" | "overflow";
  readonly coverageGap: boolean;
}
export interface PersonalFilingMonitorDto {
  readonly schemaVersion: "1.0.0";
  readonly version: number;
  readonly policy: PersonalFilingMonitorPolicyDto | null;
  readonly bindingStatus: "unconfigured" | "current" | "needs_rebind";
  readonly running: boolean;
  readonly nextCheckAt: string | null;
  readonly lastCheckAt: string | null;
  readonly lastOutcome:
    | "seeded"
    | "checked"
    | "partial"
    | "provider_busy"
    | "provider_unavailable"
    | "needs_rebind"
    | null;
  readonly coverageGap: boolean;
  readonly issuers: readonly PersonalFilingMonitorIssuerDto[];
  readonly inbox: readonly PersonalFilingMonitorInboxDto[];
  readonly unreadCount: number;
}

const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const statuses = new Set([
  "disabled",
  "pending",
  "reserved",
  "not_submitted",
  "submission_unconfirmed",
  "observed_shown",
  "delivery_uncertain",
]);
function keys(value: unknown, names: string): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === names.split(",").sort().join(",")
  );
}
function integer(value: unknown, minimum = 0): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= minimum
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
function nullableInstant(value: unknown) {
  return value === null || instant(value);
}
function date(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    instant(`${value}T00:00:00.000Z`)
  );
}
function ids(value: unknown, cap: number) {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= cap &&
    value.every((v) => typeof v === "string" && identifier.test(v)) &&
    new Set(value).size === value.length
  );
}
export function isPersonalFilingMonitorTimeZone(
  value: unknown,
): value is string {
  if (
    typeof value !== "string" ||
    value.length > 100 ||
    !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/u.test(value)
  )
    return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}
export function isPersonalFilingMonitorPolicyDto(
  value: unknown,
): value is PersonalFilingMonitorPolicyDto {
  return (
    keys(
      value,
      "enabled,catalogSnapshotSha256,watchlistVersion,listingIds,dailyTime,timeZone,quietHours,desktopNotifications",
    ) &&
    typeof value.enabled === "boolean" &&
    typeof value.catalogSnapshotSha256 === "string" &&
    /^sha256:[0-9a-f]{64}$/u.test(value.catalogSnapshotSha256) &&
    integer(value.watchlistVersion, 1) &&
    ids(value.listingIds, 20) &&
    typeof value.dailyTime === "string" &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value.dailyTime) &&
    isPersonalFilingMonitorTimeZone(value.timeZone) &&
    typeof value.quietHours === "boolean" &&
    typeof value.desktopNotifications === "boolean"
  );
}
export function isPersonalFilingMonitorCommandDto(
  value: unknown,
): value is PersonalFilingMonitorCommandDto {
  return (
    keys(value, "schemaVersion,expectedVersion") &&
    value.schemaVersion === "1.0.0" &&
    integer(value.expectedVersion)
  );
}
export function isPersonalFilingMonitorConfigureDto(
  value: unknown,
): value is PersonalFilingMonitorConfigureDto {
  return (
    keys(value, "schemaVersion,expectedVersion,policy") &&
    value.schemaVersion === "1.0.0" &&
    integer(value.expectedVersion) &&
    isPersonalFilingMonitorPolicyDto(value.policy)
  );
}
export function isPersonalFilingMonitorAcknowledgeDto(
  value: unknown,
): value is PersonalFilingMonitorAcknowledgeDto {
  return (
    keys(value, "schemaVersion,expectedVersion,eventIds") &&
    value.schemaVersion === "1.0.0" &&
    integer(value.expectedVersion, 1) &&
    ids(value.eventIds, 1_000)
  );
}
function listings(
  value: unknown,
): value is readonly PersonalWatchlistFilingListingDto[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 20 &&
    new Set(
      value.map((v: unknown) =>
        keys(v, "listingId,symbol,issuerName") ? v.listingId : undefined,
      ),
    ).size === value.length &&
    value.every(
      (v) =>
        keys(v, "listingId,symbol,issuerName") &&
        typeof v.listingId === "string" &&
        identifier.test(v.listingId) &&
        typeof v.symbol === "string" &&
        /^[A-Z0-9][A-Z0-9.-]{0,14}$/u.test(v.symbol) &&
        typeof v.issuerName === "string" &&
        v.issuerName.length > 0 &&
        v.issuerName.length <= 500 &&
        !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(v.issuerName),
    )
  );
}
export function isPersonalFilingMonitorInboxDto(
  value: unknown,
): value is PersonalFilingMonitorInboxDto {
  if (
    !keys(value, "id,filing,listings,firstSeenAt,readAt,delivery") ||
    !keys(
      value.filing,
      "cik,accessionNumber,form,filingDate,reportDate,sourceUrl",
    ) ||
    !keys(value.delivery, "status,attemptedAt,completedAt,shownObserved") ||
    typeof value.delivery.shownObserved !== "boolean"
  )
    return false;
  const f = value.filing,
    d = value.delivery;
  if (!(
    typeof f.cik === "string" &&
    /^\d{10}$/u.test(f.cik) &&
    Number(f.cik) > 0 &&
    typeof f.accessionNumber === "string" &&
    /^\d{10}-\d{2}-\d{6}$/u.test(f.accessionNumber) &&
    value.id === `${f.cik}:${f.accessionNumber}` &&
    typeof f.form === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9 /()._-]{0,39}$/u.test(f.form) &&
    f.form === f.form.trim() &&
    date(f.filingDate) &&
    (f.reportDate === null || date(f.reportDate)) &&
    f.sourceUrl ===
      `https://www.sec.gov/Archives/edgar/data/${f.cik.replace(/^0+/u, "")}/${f.accessionNumber}-index.htm` &&
    listings(value.listings) &&
    instant(value.firstSeenAt) &&
    nullableInstant(value.readAt) &&
    typeof d.status === "string" &&
    statuses.has(d.status) &&
    nullableInstant(d.attemptedAt) &&
    nullableInstant(d.completedAt)
  ))
    return false;
  if (
    f.filingDate > value.firstSeenAt.slice(0, 10) ||
    (value.readAt !== null && String(value.readAt) < value.firstSeenAt)
  )
    return false;
  if (d.status === "disabled" || d.status === "pending")
    return d.attemptedAt === null && d.completedAt === null && !d.shownObserved;
  if (typeof d.attemptedAt !== "string" || d.attemptedAt < value.firstSeenAt)
    return false;
  if (d.status === "reserved")
    return d.completedAt === null && !d.shownObserved;
  return (
    typeof d.completedAt === "string" &&
    d.completedAt >= d.attemptedAt &&
    (d.status === "observed_shown"
      ? d.shownObserved === true
      : d.status === "delivery_uncertain" || d.shownObserved === false)
  );
}
export function isPersonalFilingMonitorIssuerDto(
  value: unknown,
): value is PersonalFilingMonitorIssuerDto {
  return (
    keys(value, "cik,listings,seeded,lastCompleteAt,status,coverageGap") &&
    typeof value.cik === "string" &&
    /^\d{10}$/u.test(value.cik) &&
    Number(value.cik) > 0 &&
    listings(value.listings) &&
    typeof value.seeded === "boolean" &&
    nullableInstant(value.lastCompleteAt) &&
    value.seeded === (value.lastCompleteAt !== null) &&
    typeof value.status === "string" &&
    ["unseeded", "complete", "unavailable", "truncated", "overflow"].includes(
      value.status,
    ) &&
    (value.status !== "complete" || value.seeded) &&
    (value.status !== "unseeded" || !value.seeded) &&
    typeof value.coverageGap === "boolean"
  );
}
export function isPersonalFilingMonitorDto(
  value: unknown,
): value is PersonalFilingMonitorDto {
  if (
    !keys(
      value,
      "schemaVersion,version,policy,bindingStatus,running,nextCheckAt,lastCheckAt,lastOutcome,coverageGap,issuers,inbox,unreadCount",
    )
  )
    return false;
  if (!(
    value.schemaVersion === "1.0.0" &&
    integer(value.version) &&
    (value.policy === null || isPersonalFilingMonitorPolicyDto(value.policy)) &&
    typeof value.bindingStatus === "string" &&
    ["unconfigured", "current", "needs_rebind"].includes(value.bindingStatus) &&
    typeof value.running === "boolean" &&
    nullableInstant(value.nextCheckAt) &&
    nullableInstant(value.lastCheckAt) &&
    (value.lastOutcome === null ||
      (typeof value.lastOutcome === "string" &&
        [
          "seeded",
          "checked",
          "partial",
          "provider_busy",
          "provider_unavailable",
          "needs_rebind",
        ].includes(value.lastOutcome))) &&
    typeof value.coverageGap === "boolean" &&
    Array.isArray(value.issuers) &&
    value.issuers.length <= 20 &&
    value.issuers.every(isPersonalFilingMonitorIssuerDto) &&
    new Set(value.issuers.map((v) => v.cik)).size === value.issuers.length &&
    Array.isArray(value.inbox) &&
    value.inbox.length <= 1_000 &&
    value.inbox.every(isPersonalFilingMonitorInboxDto) &&
    new Set(value.inbox.map((v) => v.id)).size === value.inbox.length &&
    integer(value.unreadCount) &&
    value.unreadCount === value.inbox.filter((v) => v.readAt === null).length
  ))
    return false;
  const issuers = value.issuers;
  if (
    !value.inbox.every((v) =>
      issuers.some(
        (i) =>
          i.cik === v.filing.cik &&
          JSON.stringify(
            i.listings.map((l) => [l.listingId, l.symbol, l.issuerName]),
          ) ===
            JSON.stringify(
              v.listings.map((l) => [l.listingId, l.symbol, l.issuerName]),
            ),
      ),
    )
  )
    return false;
  if (value.policy === null)
    return (
      value.version === 0 &&
      value.bindingStatus === "unconfigured" &&
      issuers.length === 0 &&
      value.inbox.length === 0 &&
      !value.running &&
      value.nextCheckAt === null &&
      value.lastCheckAt === null &&
      value.lastOutcome === null &&
      !value.coverageGap
    );
  const policy = value.policy;
  const selected = issuers.flatMap((i) => i.listings.map((l) => l.listingId));
  return (
    value.version > 0 &&
    value.bindingStatus !== "unconfigured" &&
    selected.length === policy.listingIds.length &&
    new Set(selected).size === selected.length &&
    selected.every((id) => policy.listingIds.includes(id)) &&
    (policy.enabled ? value.nextCheckAt !== null : value.nextCheckAt === null)
  );
}
