const MAIN_WATCHLIST_NAME = "My Watchlist" as const;
const MAXIMUM_MEMBERSHIPS = 10_000;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SNAPSHOT_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MIC_PATTERN = /^[A-Z0-9]{4}$/u;
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const CONTROL_FORMAT_OR_SURROGATE_CHARACTER = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const WATCHLIST_PAYLOAD_KEYS = [
  "memberships",
  "name",
  "schemaVersion",
  "snapshotSha256",
] as const;
const MEMBERSHIP_KEYS = [
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

export type WatchlistMembership = Readonly<{
  country: "US";
  exchangeMic: string;
  instrumentType: "adr" | "common_stock";
  issuerId: string;
  issuerName: string;
  listingId: string;
  note: string;
  securityId: string;
  securityName: string;
  shareClassId: string;
  shareClassName: string;
  symbol: string;
}>;

export type MainWatchlistPayload = Readonly<{
  memberships: readonly WatchlistMembership[];
  name: typeof MAIN_WATCHLIST_NAME;
  schemaVersion: 1;
  snapshotSha256: string;
}>;

/** Validates saved shape; the repository separately checks catalog admission. */
export function isMainWatchlistPayload(
  value: unknown,
): value is MainWatchlistPayload {
  if (!hasExactKeys(value, WATCHLIST_PAYLOAD_KEYS)) return false;
  if (
    value.schemaVersion !== 1 ||
    value.name !== MAIN_WATCHLIST_NAME ||
    typeof value.snapshotSha256 !== "string" ||
    !SNAPSHOT_DIGEST_PATTERN.test(value.snapshotSha256) ||
    !Array.isArray(value.memberships) ||
    value.memberships.length > MAXIMUM_MEMBERSHIPS ||
    !value.memberships.every(isWatchlistMembership)
  ) {
    return false;
  }
  return (
    new Set(value.memberships.map((membership) => membership.listingId))
      .size === value.memberships.length
  );
}

function isWatchlistMembership(value: unknown): value is WatchlistMembership {
  if (!hasExactKeys(value, MEMBERSHIP_KEYS)) return false;
  return (
    value.country === "US" &&
    typeof value.exchangeMic === "string" &&
    MIC_PATTERN.test(value.exchangeMic) &&
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
    SYMBOL_PATTERN.test(value.symbol)
  );
}

/** Notes are not security identity; every admitted listing field must match. */
export function membershipMatchesResult(
  membership: WatchlistMembership,
  result: Omit<WatchlistMembership, "note">,
): boolean {
  return (
    membership.country === result.country &&
    membership.exchangeMic === result.exchangeMic &&
    membership.instrumentType === result.instrumentType &&
    membership.issuerId === result.issuerId &&
    membership.issuerName === result.issuerName &&
    membership.listingId === result.listingId &&
    membership.securityId === result.securityId &&
    membership.securityName === result.securityName &&
    membership.shareClassId === result.shareClassId &&
    membership.shareClassName === result.shareClassName &&
    membership.symbol === result.symbol
  );
}

function normalizeWatchlistNote(value: string): string | null {
  const normalized = value.trim().normalize("NFC");
  return [...normalized].length <= 2_000 &&
    !CONTROL_FORMAT_OR_SURROGATE_CHARACTER.test(normalized)
    ? normalized
    : null;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

function isDisplayText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    [...value].length <= 512 &&
    !CONTROL_FORMAT_OR_SURROGATE_CHARACTER.test(value)
  );
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
