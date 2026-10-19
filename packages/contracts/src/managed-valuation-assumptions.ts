import {
  isWatchlistListingIdentity,
  type WatchlistMembership,
} from "./personal-watchlist";

export const MANAGED_VALUATION_ASSUMPTIONS_PATH =
  "/v1/managed/valuation-assumptions" as const;
export const MANAGED_VALUATION_DCF_MODEL_VERSION = "authored-cash-flow-dcf-v1";
export const MANAGED_VALUATION_EXIT_MODEL_VERSION = "authored-exit-multiple-v1";
export const MANAGED_VALUATION_ASSUMPTIONS_LIMITS = Object.freeze({
  entries: 20,
  inputCodePoints: 512,
  payloadBytes: 262_144,
  envelopeBytes: 266_240,
} as const);
const scenarios = ["conservative", "base", "expansion"] as const;
type Scenario = (typeof scenarios)[number];
const dcfFields = [
  "startingUnleveredCashFlowUsd",
  "enterpriseToEquityBridgeUsd",
  "dilutedShares",
  "forecastYears",
  "waccPercent",
  "terminalGrowthPercent",
] as const;
const exitFields = [
  "baseRevenue",
  "cash",
  "debt",
  "dilutedShares",
  "horizonYears",
  "discountRatePercent",
] as const;
const dcfScenarioFields = ["annualCashFlowGrowthPercent"] as const;
const exitScenarioFields = [
  "annualRevenueGrowthPercent",
  "targetEbitdaMarginPercent",
  "exitMultiple",
] as const;
type Inputs<F extends string, S extends string> = Readonly<
  Record<F, string>
> & {
  readonly scenarios: Readonly<Record<Scenario, Readonly<Record<S, string>>>>;
};
export type ValuationDcfInputs = Inputs<
  (typeof dcfFields)[number],
  (typeof dcfScenarioFields)[number]
>;
export type ValuationExitInputs = Inputs<
  (typeof exitFields)[number],
  (typeof exitScenarioFields)[number]
>;
export interface ValuationAssumptionEntry {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listing: Omit<WatchlistMembership, "note">;
  readonly cik: string | null;
  readonly dcf: Readonly<{
    modelVersion: typeof MANAGED_VALUATION_DCF_MODEL_VERSION;
    inputs: ValuationDcfInputs;
  }>;
  readonly exit: Readonly<{
    modelVersion: typeof MANAGED_VALUATION_EXIT_MODEL_VERSION;
    inputs: ValuationExitInputs;
  }>;
}
export interface ValuationAssumptionsPayload {
  readonly schemaVersion: 1;
  readonly entries: readonly ValuationAssumptionEntry[];
}
export interface ManagedValuationAssumptionsCommand {
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly payload: ValuationAssumptionsPayload;
}
export interface ManagedValuationAssumptionsDto {
  readonly version: number;
  readonly payload: ValuationAssumptionsPayload;
}
export interface ManagedValuationAssumptionsReceiptDto extends ManagedValuationAssumptionsDto {
  readonly replayed: boolean;
}
export const EMPTY_VALUATION_ASSUMPTIONS_PAYLOAD: ValuationAssumptionsPayload =
  Object.freeze({ schemaVersion: 1, entries: Object.freeze([]) });
const listingKeys = [
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
const commandKey = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;

/** Capture authored text only; calculator validity and catalog admission are separate. */
export function parseValuationAssumptionEntry(
  value: unknown,
): ValuationAssumptionEntry | null {
  try {
    if (
      !hasKeys(value, [
        "catalogSnapshotSha256",
        "listing",
        "cik",
        "dcf",
        "exit",
      ])
    )
      return null;
    const context = captureEntryContext(value);
    const dcf = captureModel(
      value.dcf,
      MANAGED_VALUATION_DCF_MODEL_VERSION,
      dcfFields,
      dcfScenarioFields,
    );
    const exit = captureModel(
      value.exit,
      MANAGED_VALUATION_EXIT_MODEL_VERSION,
      exitFields,
      exitScenarioFields,
    );
    if (context === null || dcf === null || exit === null) return null;
    return Object.freeze({ ...context, dcf, exit });
  } catch {
    return null;
  }
}

function captureEntryContext(
  value: Record<"catalogSnapshotSha256" | "listing" | "cik", unknown>,
): Pick<
  ValuationAssumptionEntry,
  "catalogSnapshotSha256" | "listing" | "cik"
> | null {
  if (
    typeof value.catalogSnapshotSha256 !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value.catalogSnapshotSha256)
  )
    return null;
  if (
    !hasKeys(value.listing, listingKeys) ||
    !isWatchlistListingIdentity(value.listing)
  )
    return null;
  if (!(
    value.cik === null ||
    (typeof value.cik === "string" && /^[0-9]{10}$/u.test(value.cik))
  ))
    return null;
  const listingValue = value.listing;
  const listing = Object.freeze(
    Object.fromEntries(listingKeys.map((key) => [key, listingValue[key]])),
  ) as ValuationAssumptionEntry["listing"];
  return {
    catalogSnapshotSha256: value.catalogSnapshotSha256 as `sha256:${string}`,
    listing,
    cik: value.cik,
  };
}

export function parseValuationAssumptionsPayload(
  value: unknown,
): ValuationAssumptionsPayload | null {
  try {
    if (
      !hasKeys(value, ["schemaVersion", "entries"]) ||
      value.schemaVersion !== 1 ||
      !isEntryArray(value.entries)
    )
      return null;
    const entries: ValuationAssumptionEntry[] = [];
    for (const item of value.entries) {
      const entry = parseValuationAssumptionEntry(item);
      if (entry === null) return null;
      entries.push(entry);
    }
    if (
      new Set(entries.map((entry) => entry.listing.listingId)).size !==
      entries.length
    )
      return null;
    return bounded(
      { schemaVersion: 1 as const, entries: Object.freeze(entries) },
      MANAGED_VALUATION_ASSUMPTIONS_LIMITS.payloadBytes,
    );
  } catch {
    return null;
  }
}

/** Canonical field order and entry order bind the captured save command. */
export function encodeValuationAssumptionsPayload(
  payload: ValuationAssumptionsPayload,
): string {
  const captured = parseValuationAssumptionsPayload(payload);
  if (captured === null)
    throw new TypeError("Invalid valuation assumptions payload");
  return JSON.stringify(captured);
}

export function parseManagedValuationAssumptionsCommand(
  value: unknown,
): ManagedValuationAssumptionsCommand | null {
  try {
    if (
      !hasKeys(value, ["expectedVersion", "idempotencyKey", "payload"]) ||
      !isVersion(value.expectedVersion) ||
      value.expectedVersion >= Number.MAX_SAFE_INTEGER ||
      typeof value.idempotencyKey !== "string" ||
      !commandKey.test(value.idempotencyKey)
    )
      return null;
    const payload = parseValuationAssumptionsPayload(value.payload);
    return payload === null
      ? null
      : bounded(
          {
            expectedVersion: value.expectedVersion,
            idempotencyKey: value.idempotencyKey,
            payload,
          },
          MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes,
        );
  } catch {
    return null;
  }
}

export function parseManagedValuationAssumptions(
  value: unknown,
): ManagedValuationAssumptionsDto | null {
  try {
    if (!hasKeys(value, ["version", "payload"]) || !isVersion(value.version))
      return null;
    const payload = parseValuationAssumptionsPayload(value.payload);
    if (
      payload === null ||
      (value.version === 0 && payload.entries.length !== 0)
    )
      return null;
    return bounded(
      { version: value.version, payload },
      MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes,
    );
  } catch {
    return null;
  }
}

export function parseManagedValuationAssumptionsReceipt(
  value: unknown,
  capturedCommand: ManagedValuationAssumptionsCommand,
): ManagedValuationAssumptionsReceiptDto | null {
  try {
    const command = parseManagedValuationAssumptionsCommand(capturedCommand);
    if (
      command === null ||
      !hasKeys(value, ["version", "payload", "replayed"]) ||
      typeof value.replayed !== "boolean"
    )
      return null;
    const saved = parseManagedValuationAssumptions({
      version: value.version,
      payload: value.payload,
    });
    if (
      saved === null ||
      saved.version !== command.expectedVersion + 1 ||
      JSON.stringify(saved.payload) !== JSON.stringify(command.payload)
    )
      return null;
    return bounded(
      { ...saved, replayed: value.replayed },
      MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes,
    );
  } catch {
    return null;
  }
}

function raw(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 1024 &&
    [...value].length <= MANAGED_VALUATION_ASSUMPTIONS_LIMITS.inputCodePoints &&
    !/[\uD800-\uDFFF]/u.test(value)
  );
}
function captureRawMap<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): Readonly<Record<Keys[number], string>> | null {
  if (
    !hasKeys(value, keys) ||
    !keys.every((key) => raw(value[key as Keys[number]]))
  )
    return null;
  return Object.freeze(
    Object.fromEntries(keys.map((key) => [key, value[key as Keys[number]]])),
  ) as Readonly<Record<Keys[number], string>>;
}
function captureModel<
  const Version extends string,
  const Fields extends readonly string[],
  const ScenarioFields extends readonly string[],
>(
  value: unknown,
  version: Version,
  fields: Fields,
  scenarioFields: ScenarioFields,
): Readonly<{
  modelVersion: Version;
  inputs: Inputs<Fields[number], ScenarioFields[number]>;
}> | null {
  if (
    !hasKeys(value, ["modelVersion", "inputs"]) ||
    value.modelVersion !== version ||
    !hasKeys(value.inputs, [...fields, "scenarios"])
  )
    return null;
  const inputs = value.inputs as Record<string, unknown>;
  const fieldsOnly = Object.fromEntries(
    fields.map((key) => [key, inputs[key]]),
  );
  const captured = captureRawMap(fieldsOnly, fields);
  const nested = captureScenarios(inputs.scenarios, scenarioFields);
  if (captured === null || nested === null) return null;
  return Object.freeze({
    modelVersion: version,
    inputs: Object.freeze({ ...captured, scenarios: nested }),
  });
}
function captureScenarios<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): Readonly<Record<Scenario, Readonly<Record<Keys[number], string>>>> | null {
  if (!hasKeys(value, scenarios)) return null;
  const captured = scenarios.map((name) => captureRawMap(value[name], keys));
  if (captured.some((item) => item === null)) return null;
  return Object.freeze(
    Object.fromEntries(scenarios.map((name, index) => [name, captured[index]])),
  ) as Readonly<Record<Scenario, Readonly<Record<Keys[number], string>>>>;
}
function hasKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  return (
    Reflect.ownKeys(value).length === keys.length &&
    keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        descriptor?.enumerable === true && Object.hasOwn(descriptor, "value")
      );
    })
  );
}
function isEntryArray(value: unknown): value is readonly unknown[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length > MANAGED_VALUATION_ASSUMPTIONS_LIMITS.entries ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    return false;
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
      return false;
  }
  return true;
}
function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function bounded<T extends object>(
  value: T,
  maximum: number,
): Readonly<T> | null {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength <= maximum
    ? Object.freeze(value)
    : null;
}
