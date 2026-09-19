export const PERSONAL_SAVED_DCF_MODEL_VERSION = "1.0.0" as const;
export const PERSONAL_SAVED_DCF_MAXIMUM_ENTRIES = 20 as const;
export const PERSONAL_SAVED_DCF_MAXIMUM_PAYLOAD_BYTES = 256 * 1024;
export const PERSONAL_SAVED_DCF_IDENTITY_FIELDS = Object.freeze([
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

export interface PersonalSavedDcfIdentityDto {
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

export interface PersonalSavedDcfAssumptionsDto {
  readonly forecastYears: number;
  readonly taxShieldRatePercent: string;
  readonly waccPercent: string;
  readonly terminalGrowthPercent: string;
  readonly scenarios: Readonly<{
    conservative: Readonly<{ annualFcfProxyGrowthPercent: string }>;
    base: Readonly<{ annualFcfProxyGrowthPercent: string }>;
    expansion: Readonly<{ annualFcfProxyGrowthPercent: string }>;
  }>;
}

export interface PersonalSavedDcfEntryDto {
  readonly identity: PersonalSavedDcfIdentityDto;
  readonly createdAgainstCatalogSnapshotSha256: `sha256:${string}`;
  /** Unsupported, structurally valid versions may be displayed and cleared. */
  readonly modelVersion: string;
  readonly assumptions: PersonalSavedDcfAssumptionsDto;
}

export interface PersonalSavedDcfPayloadDto {
  readonly schemaVersion: 1;
  readonly entries: readonly PersonalSavedDcfEntryDto[];
}

export interface PersonalSavedDcfBindingDto {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly watchlistVersion: number;
}

export type PersonalSavedDcfPutRequestDto =
  | Readonly<{
      operation: "save";
      listingId: string;
      payload: PersonalSavedDcfPayloadDto;
      context: PersonalSavedDcfBindingDto;
    }>
  | Readonly<{
      operation: "clear";
      listingId: string;
      payload: PersonalSavedDcfPayloadDto;
      context: null;
    }>;

export interface PersonalSavedDcfResolveRequestDto extends PersonalSavedDcfBindingDto {
  readonly identity: PersonalSavedDcfIdentityDto;
  readonly expectedVersion: number;
}

export interface PersonalSavedDcfResolvedDto extends PersonalSavedDcfBindingDto {
  readonly schemaVersion: "1.0.0";
  readonly savedAssumptionsVersion: number;
  readonly entry: PersonalSavedDcfEntryDto;
}

const ASSUMPTION_KEYS = [
  "forecastYears",
  "taxShieldRatePercent",
  "waccPercent",
  "terminalGrowthPercent",
  "scenarios",
] as const;
const SCENARIOS = ["conservative", "base", "expansion"] as const;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?$/u;
const CANONICAL_DECIMAL = /^-?(?:0|[1-9][0-9]*)\.[0-9]{4}$/u;
const MODEL_VERSION =
  /^(?:0|[1-9][0-9]{0,3})\.(?:0|[1-9][0-9]{0,3})\.(?:0|[1-9][0-9]{0,3})$/u;

/** Validates owner inputs without requiring any provider or model result. */
export function normalizePersonalSavedDcfAssumptions(
  value: unknown,
): PersonalSavedDcfAssumptionsDto | null {
  if (!assumptionShape(value, false)) return null;
  const rates = assumptionRates(value).map(scaledRate);
  const [tax, wacc, terminal, conservative, base, expansion] = rates;
  if (
    value.forecastYears < 5 ||
    value.forecastYears > 10 ||
    tax === undefined ||
    tax < 0n ||
    tax > 500_000n ||
    wacc === undefined ||
    wacc < 10_000n ||
    wacc > 300_000n ||
    terminal === undefined ||
    terminal < -20_000n ||
    terminal > 50_000n ||
    conservative === undefined ||
    conservative < -500_000n ||
    conservative > 500_000n ||
    base === undefined ||
    base < -500_000n ||
    base > 500_000n ||
    expansion === undefined ||
    expansion < -500_000n ||
    expansion > 500_000n ||
    conservative > base ||
    base > expansion ||
    wacc <= terminal
  )
    return null;
  return Object.freeze({
    forecastYears: value.forecastYears,
    taxShieldRatePercent: fixedRate(tax),
    waccPercent: fixedRate(wacc),
    terminalGrowthPercent: fixedRate(terminal),
    scenarios: Object.freeze({
      conservative: Object.freeze({
        annualFcfProxyGrowthPercent: fixedRate(conservative),
      }),
      base: Object.freeze({ annualFcfProxyGrowthPercent: fixedRate(base) }),
      expansion: Object.freeze({
        annualFcfProxyGrowthPercent: fixedRate(expansion),
      }),
    }),
  });
}

/** Current-model bounds and canonical persisted representation. */
export function isPersonalSavedDcfAssumptions(
  value: unknown,
): value is PersonalSavedDcfAssumptionsDto {
  return (
    assumptionShape(value, true) &&
    normalizePersonalSavedDcfAssumptions(value) !== null
  );
}

export function isPersonalSavedDcfIdentity(
  value: unknown,
): value is PersonalSavedDcfIdentityDto {
  return (
    exactRecord(value, PERSONAL_SAVED_DCF_IDENTITY_FIELDS) &&
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
    ].every(identifier) &&
    [value.issuerName, value.securityName, value.shareClassName].every(
      displayText,
    )
  );
}

/** Stored shape is separate from support for the model version. */
export function isPersonalSavedDcfEntry(
  value: unknown,
): value is PersonalSavedDcfEntryDto {
  return (
    exactRecord(value, [
      "identity",
      "createdAgainstCatalogSnapshotSha256",
      "modelVersion",
      "assumptions",
    ]) &&
    isPersonalSavedDcfIdentity(value.identity) &&
    digest(value.createdAgainstCatalogSnapshotSha256) &&
    matches(value.modelVersion, MODEL_VERSION) &&
    assumptionShape(value.assumptions, true) &&
    (value.modelVersion !== PERSONAL_SAVED_DCF_MODEL_VERSION ||
      isPersonalSavedDcfAssumptions(value.assumptions))
  );
}

export function isPersonalSavedDcfSupportedEntry(
  value: unknown,
): value is PersonalSavedDcfEntryDto {
  return (
    isPersonalSavedDcfEntry(value) &&
    value.modelVersion === PERSONAL_SAVED_DCF_MODEL_VERSION
  );
}

export function isPersonalSavedDcfPayload(
  value: unknown,
): value is PersonalSavedDcfPayloadDto {
  if (
    !exactRecord(value, ["schemaVersion", "entries"]) ||
    value.schemaVersion !== 1 ||
    !denseArray(value.entries, PERSONAL_SAVED_DCF_MAXIMUM_ENTRIES)
  )
    return false;
  const listings = new Set<string>();
  for (const entry of value.entries) {
    if (
      !isPersonalSavedDcfEntry(entry) ||
      listings.has(entry.identity.listingId)
    )
      return false;
    listings.add(entry.identity.listingId);
  }
  return (
    new TextEncoder().encode(JSON.stringify(value)).byteLength <=
    PERSONAL_SAVED_DCF_MAXIMUM_PAYLOAD_BYTES
  );
}

export function isPersonalSavedDcfBinding(
  value: unknown,
): value is PersonalSavedDcfBindingDto {
  return (
    exactRecord(value, ["catalogSnapshotSha256", "watchlistVersion"]) &&
    bindingFields(value)
  );
}

export function isPersonalSavedDcfPutRequest(
  value: unknown,
): value is PersonalSavedDcfPutRequestDto {
  if (
    !exactRecord(value, ["operation", "listingId", "payload", "context"]) ||
    !identifier(value.listingId) ||
    !isPersonalSavedDcfPayload(value.payload)
  )
    return false;
  const target = value.payload.entries.find(
    (entry) => entry.identity.listingId === value.listingId,
  );
  if (value.operation === "clear")
    return value.context === null && target === undefined;
  return (
    value.operation === "save" &&
    isPersonalSavedDcfBinding(value.context) &&
    isPersonalSavedDcfSupportedEntry(target) &&
    target.createdAgainstCatalogSnapshotSha256 ===
      value.context.catalogSnapshotSha256
  );
}

export function isPersonalSavedDcfResolveRequest(
  value: unknown,
): value is PersonalSavedDcfResolveRequestDto {
  return (
    exactRecord(value, [
      "identity",
      "catalogSnapshotSha256",
      "watchlistVersion",
      "expectedVersion",
    ]) &&
    isPersonalSavedDcfIdentity(value.identity) &&
    bindingFields(value) &&
    version(value.expectedVersion)
  );
}

export function isPersonalSavedDcfResolved(
  value: unknown,
): value is PersonalSavedDcfResolvedDto {
  return (
    exactRecord(value, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "watchlistVersion",
      "savedAssumptionsVersion",
      "entry",
    ]) &&
    value.schemaVersion === "1.0.0" &&
    bindingFields(value) &&
    version(value.savedAssumptionsVersion) &&
    isPersonalSavedDcfSupportedEntry(value.entry)
  );
}

function assumptionShape(
  value: unknown,
  canonical: boolean,
): value is PersonalSavedDcfAssumptionsDto {
  if (
    !exactRecord(value, ASSUMPTION_KEYS) ||
    !Number.isSafeInteger(value.forecastYears) ||
    !exactRecord(value.scenarios, SCENARIOS)
  )
    return false;
  for (const name of SCENARIOS) {
    if (!exactRecord(value.scenarios[name], ["annualFcfProxyGrowthPercent"]))
      return false;
  }
  const rates = [
    value.taxShieldRatePercent,
    value.waccPercent,
    value.terminalGrowthPercent,
    ...SCENARIOS.map(
      (name) =>
        (value.scenarios as Record<string, Record<string, unknown>>)[name]!
          .annualFcfProxyGrowthPercent,
    ),
  ];
  return rates.every(
    (rate) =>
      typeof rate === "string" &&
      rate.length <= 64 &&
      (canonical
        ? CANONICAL_DECIMAL.test(rate) && rate !== "-0.0000"
        : DECIMAL.test(rate)),
  );
}

function assumptionRates(value: PersonalSavedDcfAssumptionsDto): string[] {
  return [
    value.taxShieldRatePercent,
    value.waccPercent,
    value.terminalGrowthPercent,
    ...SCENARIOS.map(
      (name) => value.scenarios[name].annualFcfProxyGrowthPercent,
    ),
  ];
}

function scaledRate(value: string): bigint {
  const negative = value.startsWith("-");
  const [integer = "0", fraction = ""] = (
    negative ? value.slice(1) : value
  ).split(".");
  const scaled = BigInt(integer) * 10_000n + BigInt(fraction.padEnd(4, "0"));
  return negative ? -scaled : scaled;
}

function fixedRate(value: bigint): string {
  const positive = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${String(positive / 10_000n)}.${String(positive % 10_000n).padStart(4, "0")}`;
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
function identifier(value: unknown): value is string {
  return matches(value, IDENTIFIER);
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
function denseArray(value: unknown, maximum: number): value is unknown[] {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
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
