import type { PersonalMarketDataIdentityDto } from "@research-cockpit/contracts";
type Identity = PersonalMarketDataIdentityDto &
  Readonly<{ issuerId: string; cik: string }>;

// Fixed validation order follows public tuple admission; none of these keys come from input.
const FORMATTED_FIELDS = [
  ["exchangeMic", /^[A-Z0-9]{4}$/u],
  ["symbol", /^[A-Z0-9][A-Z0-9.-]{0,14}$/u],
  ["cik", /^(?!0000000000)[0-9]{10}$/u],
  ["issuerId", /^[a-z0-9][a-z0-9._:-]{2,127}$/u],
  ["listingId", /^[a-z0-9][a-z0-9._:-]{2,127}$/u],
] as const;

/** Read only the public tuple; never flatten catalog/private properties. */
export function readSecCanonicalPublicIdentity(value: Identity): Identity {
  if (value === null || typeof value !== "object") invalidIdentity();
  if (Object.getPrototypeOf(value) !== Object.prototype) invalidIdentity();
  const data = Object.getOwnPropertyDescriptors(value);
  const country = readField(data, "country");
  if (country !== "US") invalidIdentity();
  const result: Identity = {
    country,
    exchangeMic: readField(data, "exchangeMic"),
    issuerId: readField(data, "issuerId"),
    issuerName: readField(data, "issuerName"),
    listingId: readField(data, "listingId"),
    securityName: readField(data, "securityName"),
    symbol: readField(data, "symbol"),
    cik: readField(data, "cik"),
  };
  assertFormattedFields(result);
  assertNames(result);
  return Object.freeze(result);
}
function assertFormattedFields(value: Identity): void {
  if (!FORMATTED_FIELDS.every(([field, format]) => format.test(value[field])))
    invalidIdentity();
}
function assertNames(value: Identity): void {
  if (!name(value.issuerName)) invalidIdentity();
  if (!name(value.securityName)) invalidIdentity();
}
function name(value: string): boolean {
  if (value !== value.trim().normalize("NFC")) return false;
  const length = [...value].length;
  if (length === 0 || length > 512) return false;
  return !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value);
}

function readField(
  data: Record<string, PropertyDescriptor>,
  key: string,
): string {
  const item = data[key];
  if (!item?.enumerable) invalidIdentity();
  if (!Object.hasOwn(item, "value")) invalidIdentity();
  const value: unknown = item.value;
  if (typeof value !== "string") invalidIdentity();
  return value;
}

/** All malformed public tuples have the same failure, without exposing a supplied field. */
function invalidIdentity(): never {
  throw new TypeError("Invalid SEC identity.");
}
