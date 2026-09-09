export const PERSONAL_PORTFOLIO_LIMITS = Object.freeze({
  holdings: 20,
  payloadBytes: 256 * 1_024,
  maximumShares: "1000000000",
  shareDecimalPlaces: 6,
  maximumMoneyUsd: "1000000000000",
  moneyDecimalPlaces: 2,
} as const);

export type PersonalPortfolioIdentity = Readonly<{
  country: "US";
  exchangeMic: string;
  instrumentType: "adr" | "common_stock";
  issuerId: string;
  issuerName: string;
  listingId: string;
  securityId: string;
  securityName: string;
  shareClassId: string;
  shareClassName: string;
  symbol: string;
}>;

export type PersonalPortfolioHolding = Readonly<{
  identity: PersonalPortfolioIdentity;
  shares: string;
  totalCostBasisUsd: string | null;
  confirmedOn: string;
}>;

export type PersonalPortfolioPayload = Readonly<{
  schemaVersion: 1;
  name: "My Portfolio";
  currency: "USD";
  snapshotSha256: string;
  cashUsd: string | null;
  holdings: readonly PersonalPortfolioHolding[];
}>;

const IDENTITY_KEYS = [
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
const HOLDING_KEYS = [
  "identity",
  "shares",
  "totalCostBasisUsd",
  "confirmedOn",
] as const;
const PAYLOAD_KEYS = [
  "schemaVersion",
  "name",
  "currency",
  "snapshotSha256",
  "cashUsd",
  "holdings",
] as const;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const UNSAFE_TEXT = /[\p{Cc}\p{Cf}\p{Cs}]/u;

export function isPersonalPortfolioIdentity(
  value: unknown,
): value is PersonalPortfolioIdentity {
  if (!exactRecord(value, IDENTITY_KEYS)) return false;
  return (
    value.country === "US" &&
    typeof value.exchangeMic === "string" &&
    /^[A-Z0-9]{4}$/u.test(value.exchangeMic) &&
    (value.instrumentType === "adr" ||
      value.instrumentType === "common_stock") &&
    isIdentifier(value.issuerId) &&
    isIdentifier(value.listingId) &&
    isIdentifier(value.securityId) &&
    isIdentifier(value.shareClassId) &&
    isDisplayText(value.issuerName) &&
    isDisplayText(value.securityName) &&
    isDisplayText(value.shareClassName) &&
    typeof value.symbol === "string" &&
    /^[A-Z0-9][A-Z0-9.-]{0,14}$/u.test(value.symbol)
  );
}

/** Ordinary unsigned decimal text; fixed fractional trailing zeroes are allowed. */
export function isPersonalPortfolioShares(value: unknown): value is string {
  return boundedDecimal(value, 6, 1_000_000_000n, false);
}

export function isPersonalPortfolioMoney(value: unknown): value is string {
  return boundedDecimal(value, 2, 1_000_000_000_000n, true);
}

/** Future confirmation dates are checked when the caller supplies today's UTC date. */
export function isPersonalPortfolioPayload(
  value: unknown,
  today?: string,
): value is PersonalPortfolioPayload {
  if (today !== undefined && !calendarDate(today)) return false;
  if (
    !exactRecord(value, PAYLOAD_KEYS) ||
    value.schemaVersion !== 1 ||
    value.name !== "My Portfolio" ||
    value.currency !== "USD" ||
    typeof value.snapshotSha256 !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value.snapshotSha256) ||
    (value.cashUsd !== null && !isPersonalPortfolioMoney(value.cashUsd)) ||
    !Array.isArray(value.holdings) ||
    value.holdings.length > PERSONAL_PORTFOLIO_LIMITS.holdings
  ) {
    return false;
  }
  const listingIds = new Set<string>();
  for (const holding of value.holdings as readonly unknown[]) {
    if (
      !exactRecord(holding, HOLDING_KEYS) ||
      !isPersonalPortfolioIdentity(holding.identity) ||
      !isPersonalPortfolioShares(holding.shares) ||
      (holding.totalCostBasisUsd !== null &&
        !isPersonalPortfolioMoney(holding.totalCostBasisUsd)) ||
      !calendarDate(holding.confirmedOn) ||
      (today !== undefined && holding.confirmedOn > today) ||
      listingIds.has(holding.identity.listingId)
    ) {
      return false;
    }
    listingIds.add(holding.identity.listingId);
  }
  try {
    return (
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      PERSONAL_PORTFOLIO_LIMITS.payloadBytes
    );
  } catch {
    return false;
  }
}

function boundedDecimal(
  value: unknown,
  scale: number,
  maximum: bigint,
  zeroAllowed: boolean,
): value is string {
  if (
    typeof value !== "string" ||
    value.length > 20 ||
    !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value)
  ) {
    return false;
  }
  const [integer = "0", fraction = ""] = value.split(".");
  if (fraction.length > scale) return false;
  const scaled = BigInt(`${integer}${fraction.padEnd(scale, "0")}`);
  return (
    (zeroAllowed ? scaled >= 0n : scaled > 0n) &&
    scaled <= maximum * 10n ** BigInt(scale)
  );
}

function calendarDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u.test(value)
  ) {
    return false;
  }
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function isDisplayText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    [...value].length <= 512 &&
    !UNSAFE_TEXT.test(value)
  );
}

function exactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(value).length === keys.length &&
    keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        descriptor !== undefined &&
        "value" in descriptor &&
        descriptor.enumerable === true
      );
    })
  );
}
