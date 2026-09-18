import type { PersonalSecurityMasterScreenRowDto } from "./index";

export interface PersonalFinancialComparisonSelectionDto {
  readonly createdAgainstCatalogSnapshotSha256: `sha256:${string}`;
  readonly members: readonly PersonalSecurityMasterScreenRowDto[];
}

export interface PersonalFinancialComparisonSelectionPayloadDto {
  readonly schemaVersion: 1;
  readonly selection: PersonalFinancialComparisonSelectionDto | null;
}

export interface PersonalFinancialComparisonSelectionBindingDto {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly watchlistVersion: number;
}

export interface PersonalFinancialComparisonSelectionPutRequestDto {
  readonly payload: PersonalFinancialComparisonSelectionPayloadDto;
  readonly context: PersonalFinancialComparisonSelectionBindingDto | null;
}

export interface PersonalFinancialComparisonSelectionResolveRequestDto extends PersonalFinancialComparisonSelectionBindingDto {
  readonly expectedVersion: number;
}

export interface PersonalFinancialComparisonSelectionResolvedDto extends PersonalFinancialComparisonSelectionBindingDto {
  readonly schemaVersion: "1.0.0";
  readonly savedSelectionVersion: number;
  readonly members: readonly PersonalSecurityMasterScreenRowDto[];
}

export const PERSONAL_FINANCIAL_COMPARISON_IDENTITY_FIELDS = Object.freeze([
  "cik",
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
] as const satisfies readonly (keyof PersonalSecurityMasterScreenRowDto)[]);

/** Structural admission only; current catalog/watchlist equality is separate. */
export function isPersonalFinancialComparisonIdentity(
  value: unknown,
): value is PersonalSecurityMasterScreenRowDto {
  if (!exactRecord(value, PERSONAL_FINANCIAL_COMPARISON_IDENTITY_FIELDS))
    return false;
  return (
    matches(value.cik, /^[0-9]{10}$/u) &&
    value.country === "US" &&
    matches(value.exchangeMic, /^[A-Z0-9]{4}$/u) &&
    (value.instrumentType === "adr" ||
      value.instrumentType === "common_stock") &&
    matches(value.symbol, /^[A-Z0-9][A-Z0-9.-]{0,31}$/u) &&
    [
      value.issuerId,
      value.listingId,
      value.securityId,
      value.shareClassId,
    ].every((id) => matches(id, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u)) &&
    [value.issuerName, value.securityName, value.shareClassName].every(
      (name) =>
        typeof name === "string" &&
        name.length > 0 &&
        [...name].length <= 500 &&
        !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(name),
    )
  );
}

export function isPersonalFinancialComparisonMembers(
  value: unknown,
): value is readonly PersonalSecurityMasterScreenRowDto[] {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.length > 3 ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable
    )
      return false;
  }
  const listings = new Set<string>();
  const issuers = new Set<string>();
  const ciks = new Set<string>();
  for (const member of value) {
    if (
      !isPersonalFinancialComparisonIdentity(member) ||
      listings.has(member.listingId) ||
      issuers.has(member.issuerId) ||
      ciks.has(member.cik)
    )
      return false;
    listings.add(member.listingId);
    issuers.add(member.issuerId);
    ciks.add(member.cik);
  }
  return true;
}

export function isPersonalFinancialComparisonSelection(
  value: unknown,
): value is PersonalFinancialComparisonSelectionDto {
  return (
    exactRecord(value, ["createdAgainstCatalogSnapshotSha256", "members"]) &&
    digest(value.createdAgainstCatalogSnapshotSha256) &&
    isPersonalFinancialComparisonMembers(value.members)
  );
}

export function isPersonalFinancialComparisonSelectionPayload(
  value: unknown,
): value is PersonalFinancialComparisonSelectionPayloadDto {
  return (
    exactRecord(value, ["schemaVersion", "selection"]) &&
    value.schemaVersion === 1 &&
    (value.selection === null ||
      isPersonalFinancialComparisonSelection(value.selection))
  );
}

export function isPersonalFinancialComparisonSelectionBinding(
  value: unknown,
): value is PersonalFinancialComparisonSelectionBindingDto {
  return (
    exactRecord(value, ["catalogSnapshotSha256", "watchlistVersion"]) &&
    bindingFields(value)
  );
}

export function isPersonalFinancialComparisonSelectionPutRequest(
  value: unknown,
): value is PersonalFinancialComparisonSelectionPutRequestDto {
  return (
    exactRecord(value, ["payload", "context"]) &&
    isPersonalFinancialComparisonSelectionPayload(value.payload) &&
    (value.payload.selection === null
      ? value.context === null
      : isPersonalFinancialComparisonSelectionBinding(value.context) &&
        value.payload.selection.createdAgainstCatalogSnapshotSha256 ===
          value.context.catalogSnapshotSha256)
  );
}

export function isPersonalFinancialComparisonSelectionResolveRequest(
  value: unknown,
): value is PersonalFinancialComparisonSelectionResolveRequestDto {
  return (
    exactRecord(value, [
      "catalogSnapshotSha256",
      "watchlistVersion",
      "expectedVersion",
    ]) &&
    bindingFields(value) &&
    version(value.expectedVersion)
  );
}

export function isPersonalFinancialComparisonSelectionResolved(
  value: unknown,
): value is PersonalFinancialComparisonSelectionResolvedDto {
  return (
    exactRecord(value, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "watchlistVersion",
      "savedSelectionVersion",
      "members",
    ]) &&
    value.schemaVersion === "1.0.0" &&
    bindingFields(value) &&
    version(value.savedSelectionVersion) &&
    isPersonalFinancialComparisonMembers(value.members)
  );
}

function bindingFields(value: Record<string, unknown>): boolean {
  return digest(value.catalogSnapshotSha256) && version(value.watchlistVersion);
}

function digest(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}

function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}

function version(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
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
