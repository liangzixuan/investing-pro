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
    return captureEntry(value);
  } catch {
    return null;
  }
}

function invalid(): never {
  throw new TypeError("Invalid valuation assumptions");
}
function captureEntry(value: unknown): ValuationAssumptionEntry {
  const entry = record(value, [
    "catalogSnapshotSha256",
    "listing",
    "cik",
    "dcf",
    "exit",
  ]);
  const context = captureEntryContext(entry);
  const dcf = captureModel(
    entry.dcf,
    MANAGED_VALUATION_DCF_MODEL_VERSION,
    dcfFields,
    dcfScenarioFields,
  );
  const exit = captureModel(
    entry.exit,
    MANAGED_VALUATION_EXIT_MODEL_VERSION,
    exitFields,
    exitScenarioFields,
  );
  return Object.freeze({ ...context, dcf, exit });
}

function captureEntryContext(
  value: Record<"catalogSnapshotSha256" | "listing" | "cik", unknown>,
): Pick<ValuationAssumptionEntry, "catalogSnapshotSha256" | "listing" | "cik"> {
  const digest = patternedString(
    value.catalogSnapshotSha256,
    /^sha256:[0-9a-f]{64}$/u,
  );
  const listingValue = record(value.listing, listingKeys);
  if (!isWatchlistListingIdentity(listingValue)) invalid();
  const listing = Object.freeze(
    Object.fromEntries(listingKeys.map((key) => [key, listingValue[key]])),
  ) as ValuationAssumptionEntry["listing"];
  return {
    catalogSnapshotSha256: digest as `sha256:${string}`,
    listing,
    cik: nullableCik(value.cik),
  };
}

export function parseValuationAssumptionsPayload(
  value: unknown,
): ValuationAssumptionsPayload | null {
  try {
    return capturePayload(value);
  } catch {
    return null;
  }
}

function capturePayload(value: unknown): ValuationAssumptionsPayload {
  const payload = record(value, ["schemaVersion", "entries"]);
  if (payload.schemaVersion !== 1) invalid();
  const entries = entryItems(payload.entries).map(captureEntry);
  const identities = new Set(entries.map((entry) => entry.listing.listingId));
  if (identities.size !== entries.length) invalid();
  return bounded(
    { schemaVersion: 1 as const, entries: Object.freeze(entries) },
    MANAGED_VALUATION_ASSUMPTIONS_LIMITS.payloadBytes,
  );
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
    return captureCommand(value);
  } catch {
    return null;
  }
}

function captureCommand(value: unknown): ManagedValuationAssumptionsCommand {
  const command = record(value, [
    "expectedVersion",
    "idempotencyKey",
    "payload",
  ]);
  const expectedVersion = version(command.expectedVersion);
  if (expectedVersion >= Number.MAX_SAFE_INTEGER) invalid();
  const idempotencyKey = patternedString(command.idempotencyKey, commandKey);
  const payload = capturePayload(command.payload);
  return bounded(
    { expectedVersion, idempotencyKey, payload },
    MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes,
  );
}

export function parseManagedValuationAssumptions(
  value: unknown,
): ManagedValuationAssumptionsDto | null {
  try {
    return captureRead(value);
  } catch {
    return null;
  }
}

function captureRead(value: unknown): ManagedValuationAssumptionsDto {
  const saved = record(value, ["version", "payload"]);
  const savedVersion = version(saved.version);
  const payload = capturePayload(saved.payload);
  if (savedVersion === 0) requireEmptyPayload(payload);
  return bounded(
    { version: savedVersion, payload },
    MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes,
  );
}
function requireEmptyPayload(payload: ValuationAssumptionsPayload): void {
  if (payload.entries.length !== 0) invalid();
}

export function parseManagedValuationAssumptionsReceipt(
  value: unknown,
  capturedCommand: ManagedValuationAssumptionsCommand,
): ManagedValuationAssumptionsReceiptDto | null {
  try {
    const command = captureCommand(capturedCommand);
    const receipt = record(value, ["version", "payload", "replayed"]);
    if (typeof receipt.replayed !== "boolean") invalid();
    const saved = captureRead({
      version: receipt.version,
      payload: receipt.payload,
    });
    if (saved.version !== command.expectedVersion + 1) invalid();
    if (JSON.stringify(saved.payload) !== JSON.stringify(command.payload))
      invalid();
    return bounded(
      { ...saved, replayed: receipt.replayed },
      MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes,
    );
  } catch {
    return null;
  }
}

function raw(value: unknown): string {
  if (typeof value !== "string") invalid();
  if (value.length > 1024) invalid();
  if ([...value].length > MANAGED_VALUATION_ASSUMPTIONS_LIMITS.inputCodePoints)
    invalid();
  if (/[\uD800-\uDFFF]/u.test(value)) invalid();
  return value;
}
function captureRawMap<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): Readonly<Record<Keys[number], string>> {
  const source = record(value, keys);
  return Object.freeze(
    Object.fromEntries(
      keys.map((key) => [key, raw(source[key as Keys[number]])]),
    ),
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
}> {
  const model = record(value, ["modelVersion", "inputs"]);
  if (model.modelVersion !== version) invalid();
  const inputs: Record<string, unknown> = record(model.inputs, [
    ...fields,
    "scenarios",
  ]);
  const fieldsOnly = Object.fromEntries(
    fields.map((key) => [key, inputs[key]]),
  );
  const captured = captureRawMap(fieldsOnly, fields);
  const nested = captureScenarios(inputs.scenarios, scenarioFields);
  return Object.freeze({
    modelVersion: version,
    inputs: Object.freeze({ ...captured, scenarios: nested }),
  });
}
function captureScenarios<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): Readonly<Record<Scenario, Readonly<Record<Keys[number], string>>>> {
  const source = record(value, scenarios);
  const captured = scenarios.map((name) => captureRawMap(source[name], keys));
  return Object.freeze(
    Object.fromEntries(scenarios.map((name, index) => [name, captured[index]])),
  ) as Readonly<Record<Scenario, Readonly<Record<Keys[number], string>>>>;
}
function record<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): Record<Keys[number], unknown> {
  const source = ordinaryRecord(value);
  if (Reflect.ownKeys(source).length !== keys.length) invalid();
  for (const key of keys) dataProperty(source, key);
  return source as Record<Keys[number], unknown>;
}
function ordinaryRecord(value: unknown): object {
  if (value === null) invalid();
  if (typeof value !== "object") invalid();
  if (Object.getPrototypeOf(value) !== Object.prototype) invalid();
  return value;
}
function dataProperty(value: object, key: PropertyKey): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor?.enumerable !== true) invalid();
  if (!Object.hasOwn(descriptor, "value")) invalid();
  return descriptor.value;
}
function entryItems(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) invalid();
  if (Object.getPrototypeOf(value) !== Array.prototype) invalid();
  if (value.length > MANAGED_VALUATION_ASSUMPTIONS_LIMITS.entries) invalid();
  if (Reflect.ownKeys(value).length !== value.length + 1) invalid();
  return Array.from({ length: value.length }, (_, index) =>
    dataProperty(value, String(index)),
  );
}
function patternedString(value: unknown, pattern: RegExp): string {
  if (typeof value !== "string") invalid();
  if (!pattern.test(value)) invalid();
  return value;
}
function nullableCik(value: unknown): string | null {
  if (value === null) return null;
  return patternedString(value, /^[0-9]{10}$/u);
}
function version(value: unknown): number {
  if (typeof value !== "number") invalid();
  if (!Number.isSafeInteger(value)) invalid();
  if (value < 0) invalid();
  return value;
}
function bounded<T extends object>(value: T, maximum: number): Readonly<T> {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maximum)
    invalid();
  return Object.freeze(value);
}
