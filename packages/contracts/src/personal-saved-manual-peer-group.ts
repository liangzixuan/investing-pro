export const PERSONAL_SAVED_MANUAL_PEER_MAXIMUM_PEERS = 3 as const;
export const PERSONAL_SAVED_MANUAL_PEER_MAXIMUM_PAYLOAD_BYTES = 256 * 1024;
export const PERSONAL_SAVED_MANUAL_PEER_IDENTITY_FIELDS = Object.freeze([
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
] as const);

export interface PersonalSavedManualPeerIdentityDto {
  readonly country: "US";
  readonly exchangeMic: string;
  readonly instrumentType: "adr" | "common_stock";
  readonly issuerId: string;
  readonly issuerName: string;
  readonly listingId: string;
  readonly securityId: string;
  readonly securityName: string;
  readonly shareClassId: string;
  readonly shareClassName: string;
  readonly symbol: string;
}
export interface PersonalSavedManualPeerGroupDto {
  readonly createdAgainstCatalogSnapshotSha256: `sha256:${string}`;
  readonly primary: PersonalSavedManualPeerIdentityDto;
  readonly peers: readonly PersonalSavedManualPeerIdentityDto[];
}
export interface PersonalSavedManualPeerPayloadDto {
  readonly schemaVersion: 1;
  readonly group: PersonalSavedManualPeerGroupDto | null;
}
export interface PersonalSavedManualPeerBindingDto {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly watchlistVersion: number;
}
export type PersonalSavedManualPeerPutRequestDto =
  | Readonly<{
      operation: "save";
      payload: PersonalSavedManualPeerPayloadDto;
      context: PersonalSavedManualPeerBindingDto;
    }>
  | Readonly<{
      operation: "clear";
      payload: PersonalSavedManualPeerPayloadDto;
      context: null;
    }>;
export interface PersonalSavedManualPeerResolveRequestDto extends PersonalSavedManualPeerBindingDto {
  readonly primary: PersonalSavedManualPeerIdentityDto;
  readonly expectedVersion: number;
}
export interface PersonalSavedManualPeerResolvedDto extends PersonalSavedManualPeerBindingDto {
  readonly schemaVersion: "1.0.0";
  readonly savedPeerGroupVersion: number;
  readonly group: PersonalSavedManualPeerGroupDto;
}

export function isPersonalSavedManualPeerIdentity(
  value: unknown,
): value is PersonalSavedManualPeerIdentityDto {
  return (
    exactRecord(value, PERSONAL_SAVED_MANUAL_PEER_IDENTITY_FIELDS) &&
    value.country === "US" &&
    matches(value.exchangeMic, /^[A-Z0-9]{4}$/u) &&
    (value.instrumentType === "adr" ||
      value.instrumentType === "common_stock") &&
    matches(value.symbol, /^[A-Z0-9][A-Z0-9.-]{0,14}$/u) &&
    [
      value.issuerId,
      value.listingId,
      value.securityId,
      value.shareClassId,
    ].every((field) =>
      matches(field, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u),
    ) &&
    [value.issuerName, value.securityName, value.shareClassName].every(
      displayText,
    )
  );
}
export function isPersonalSavedManualPeerGroup(
  value: unknown,
): value is PersonalSavedManualPeerGroupDto {
  if (
    !exactRecord(value, [
      "createdAgainstCatalogSnapshotSha256",
      "primary",
      "peers",
    ]) ||
    !digest(value.createdAgainstCatalogSnapshotSha256) ||
    !isPersonalSavedManualPeerIdentity(value.primary) ||
    !densePeers(value.peers)
  )
    return false;
  const listings = new Set([value.primary.listingId]);
  const issuers = new Set([value.primary.issuerId]);
  for (const peer of value.peers) {
    if (
      !isPersonalSavedManualPeerIdentity(peer) ||
      listings.has(peer.listingId) ||
      issuers.has(peer.issuerId)
    )
      return false;
    listings.add(peer.listingId);
    issuers.add(peer.issuerId);
  }
  return true;
}
export function isPersonalSavedManualPeerPayload(
  value: unknown,
): value is PersonalSavedManualPeerPayloadDto {
  return (
    exactRecord(value, ["schemaVersion", "group"]) &&
    value.schemaVersion === 1 &&
    (value.group === null || isPersonalSavedManualPeerGroup(value.group)) &&
    new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      PERSONAL_SAVED_MANUAL_PEER_MAXIMUM_PAYLOAD_BYTES
  );
}
export function isPersonalSavedManualPeerBinding(
  value: unknown,
): value is PersonalSavedManualPeerBindingDto {
  return (
    exactRecord(value, ["catalogSnapshotSha256", "watchlistVersion"]) &&
    bindingFields(value)
  );
}
export function isPersonalSavedManualPeerPutRequest(
  value: unknown,
): value is PersonalSavedManualPeerPutRequestDto {
  if (
    !exactRecord(value, ["operation", "payload", "context"]) ||
    !isPersonalSavedManualPeerPayload(value.payload)
  )
    return false;
  return value.operation === "clear"
    ? value.context === null && value.payload.group === null
    : value.operation === "save" &&
        value.payload.group !== null &&
        isPersonalSavedManualPeerBinding(value.context) &&
        value.payload.group.createdAgainstCatalogSnapshotSha256 ===
          value.context.catalogSnapshotSha256;
}
export function isPersonalSavedManualPeerResolveRequest(
  value: unknown,
): value is PersonalSavedManualPeerResolveRequestDto {
  return (
    exactRecord(value, [
      "catalogSnapshotSha256",
      "watchlistVersion",
      "primary",
      "expectedVersion",
    ]) &&
    bindingFields(value) &&
    version(value.expectedVersion) &&
    isPersonalSavedManualPeerIdentity(value.primary)
  );
}
export function isPersonalSavedManualPeerResolved(
  value: unknown,
): value is PersonalSavedManualPeerResolvedDto {
  return (
    exactRecord(value, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "watchlistVersion",
      "savedPeerGroupVersion",
      "group",
    ]) &&
    value.schemaVersion === "1.0.0" &&
    bindingFields(value) &&
    version(value.savedPeerGroupVersion) &&
    isPersonalSavedManualPeerGroup(value.group)
  );
}
function bindingFields(value: Record<string, unknown>): boolean {
  return digest(value.catalogSnapshotSha256) && version(value.watchlistVersion);
}
function version(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}
function digest(value: unknown): value is `sha256:${string}` {
  return matches(value, /^sha256:[0-9a-f]{64}$/u);
}
function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}
function displayText(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    [...value].length <= 512 &&
    !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)
  );
}
function densePeers(value: unknown): value is unknown[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > PERSONAL_SAVED_MANUAL_PEER_MAXIMUM_PEERS ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    return false;
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable
    )
      return false;
  }
  return true;
}
function exactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
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
