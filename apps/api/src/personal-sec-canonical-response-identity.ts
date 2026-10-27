import type { PersonalMarketDataIdentityDto } from "@research-cockpit/contracts";
type Identity = PersonalMarketDataIdentityDto &
  Readonly<{ issuerId: string; cik: string }>;

/** Read only the public tuple; never flatten catalog/private properties. */
export function readSecCanonicalPublicIdentity(value: Identity): Identity {
  if (value === null || typeof value !== "object")
    throw new TypeError("Invalid SEC identity.");
  if (Object.getPrototypeOf(value) !== Object.prototype)
    throw new TypeError("Invalid SEC identity.");
  const data = Object.getOwnPropertyDescriptors(value);
  const country = readField(data, "country");
  if (country !== "US") throw new TypeError("Invalid SEC identity.");
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
  assertCodes(result);
  assertIds(result);
  assertNames(result);
  return Object.freeze(result);
}
function assertCodes(value: Identity): void {
  if (value.country !== "US") throw new TypeError("Invalid SEC identity.");
  if (!/^[A-Z0-9]{4}$/u.test(value.exchangeMic))
    throw new TypeError("Invalid SEC identity.");
  assertSecurityCodes(value);
}
function assertSecurityCodes(value: Identity): void {
  if (!/^[A-Z0-9][A-Z0-9.-]{0,14}$/u.test(value.symbol))
    throw new TypeError("Invalid SEC identity.");
  if (!/^(?!0000000000)[0-9]{10}$/u.test(value.cik))
    throw new TypeError("Invalid SEC identity.");
}
function assertIds(value: Identity): void {
  const identifier = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
  if (!identifier.test(value.issuerId))
    throw new TypeError("Invalid SEC identity.");
  if (!identifier.test(value.listingId))
    throw new TypeError("Invalid SEC identity.");
}
function assertNames(value: Identity): void {
  if (!name(value.issuerName)) throw new TypeError("Invalid SEC identity.");
  if (!name(value.securityName)) throw new TypeError("Invalid SEC identity.");
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
  if (!item?.enumerable) throw new TypeError("Invalid SEC identity.");
  if (!Object.hasOwn(item, "value"))
    throw new TypeError("Invalid SEC identity.");
  const value: unknown = item.value;
  if (typeof value !== "string") throw new TypeError("Invalid SEC identity.");
  return value;
}
