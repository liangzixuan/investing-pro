import {
  PERSONAL_PORTFOLIO_LEDGER_LIMITS,
  isPersonalPortfolioLedgerPayload,
  type PersonalPortfolioLedgerPayloadV3,
} from "./personal-portfolio-ledger";

export const MANAGED_PORTFOLIO_PATH = "/v1/managed/portfolio" as const;
export const MANAGED_PORTFOLIO_LIMITS = Object.freeze({
  identities: PERSONAL_PORTFOLIO_LEDGER_LIMITS.identities,
  transactions: PERSONAL_PORTFOLIO_LEDGER_LIMITS.transactions,
  payloadBytes: PERSONAL_PORTFOLIO_LEDGER_LIMITS.payloadBytes,
  envelopeBytes: PERSONAL_PORTFOLIO_LEDGER_LIMITS.payloadBytes + 4_096,
});

export type ManagedPortfolioPayload = PersonalPortfolioLedgerPayloadV3;

export interface ManagedPortfolioCommand {
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly payload: ManagedPortfolioPayload;
}

export type ManagedPortfolioDto =
  | Readonly<{ version: 0; payload: null }>
  | Readonly<{ version: number; payload: ManagedPortfolioPayload }>;

export interface ManagedPortfolioReceiptDto {
  readonly version: number;
  readonly payload: ManagedPortfolioPayload;
  readonly replayed: boolean;
}

const PAYLOAD_KEYS = [
  "schemaVersion",
  "name",
  "currency",
  "snapshotSha256",
  "basisMethod",
  "identities",
  "opening",
  "transactions",
] as const;
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
  "listingId",
  "shares",
  "totalCostBasisUsd",
  "confirmedOn",
] as const;
const TRANSACTION_KEYS = [
  "id",
  "date",
  "type",
  "listingId",
  "shares",
  "grossUsd",
  "feeUsd",
] as const;
const SPLIT_KEYS = [
  "id",
  "date",
  "type",
  "listingId",
  "ratioNumerator",
  "ratioDenominator",
] as const;
const COMMAND_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;

/** Saved shape only; fresh-write date and catalog policies belong to the repository. */
export function parsePortfolioPayload(
  value: unknown,
): ManagedPortfolioPayload | null {
  try {
    const record = captureRecord(value, PAYLOAD_KEYS);
    if (record === null || record.schemaVersion !== 3) return null;
    const opening = captureRecord(record.opening, [
      "asOfDate",
      "cashUsd",
      "holdings",
    ]);
    if (opening === null) return null;
    const identities = captureList(
      record.identities,
      MANAGED_PORTFOLIO_LIMITS.identities,
      (identity) => captureRecord(identity, IDENTITY_KEYS),
    );
    const holdings = captureList(
      opening.holdings,
      MANAGED_PORTFOLIO_LIMITS.identities,
      (holding) => captureRecord(holding, HOLDING_KEYS),
    );
    const transactions = captureList(
      record.transactions,
      MANAGED_PORTFOLIO_LIMITS.transactions,
      captureActivity,
    );
    if (identities === null || holdings === null || transactions === null)
      return null;
    const captured = {
      ...record,
      identities,
      opening: Object.freeze({ ...opening, holdings }),
      transactions,
    };
    // Validate the owned data once with the existing ledger arithmetic and limits.
    if (
      !isPersonalPortfolioLedgerPayload(captured) ||
      captured.schemaVersion !== 3
    )
      return null;
    return bounded(captured, MANAGED_PORTFOLIO_LIMITS.payloadBytes);
  } catch {
    return null;
  }
}

/** Field order is canonical; activity order and decimal spelling are unchanged. */
export function encodePortfolioPayload(
  payload: ManagedPortfolioPayload,
): string {
  const captured = parsePortfolioPayload(payload);
  if (captured === null) throw new TypeError("Invalid portfolio payload");
  return JSON.stringify(captured);
}

export function parseManagedPortfolioCommand(
  value: unknown,
): ManagedPortfolioCommand | null {
  try {
    const record = captureRecord(value, [
      "expectedVersion",
      "idempotencyKey",
      "payload",
    ]);
    if (record === null) return null;
    const { expectedVersion, idempotencyKey } = record;
    if (
      !isVersion(expectedVersion) ||
      expectedVersion >= Number.MAX_SAFE_INTEGER ||
      typeof idempotencyKey !== "string" ||
      !COMMAND_KEY.test(idempotencyKey)
    )
      return null;
    const payload = parsePortfolioPayload(record.payload);
    return payload === null
      ? null
      : bounded(
          { expectedVersion, idempotencyKey, payload },
          MANAGED_PORTFOLIO_LIMITS.envelopeBytes,
        );
  } catch {
    return null;
  }
}

export function parseManagedPortfolio(
  value: unknown,
): ManagedPortfolioDto | null {
  try {
    const record = captureRecord(value, ["version", "payload"]);
    if (record === null || !isVersion(record.version)) return null;
    if (record.version === 0)
      return record.payload === null
        ? Object.freeze({ version: 0, payload: null })
        : null;
    const payload = parsePortfolioPayload(record.payload);
    return payload === null
      ? null
      : bounded(
          { version: record.version, payload },
          MANAGED_PORTFOLIO_LIMITS.envelopeBytes,
        );
  } catch {
    return null;
  }
}

/** A replay confirms this captured command, not a later shared portfolio version. */
export function parseManagedPortfolioReceipt(
  value: unknown,
  capturedCommand: ManagedPortfolioCommand,
): ManagedPortfolioReceiptDto | null {
  try {
    const command = parseManagedPortfolioCommand(capturedCommand);
    const record = captureRecord(value, ["version", "payload", "replayed"]);
    if (
      command === null ||
      record === null ||
      typeof record.replayed !== "boolean"
    )
      return null;
    const saved = parseManagedPortfolio({
      version: record.version,
      payload: record.payload,
    });
    if (
      saved === null ||
      saved.payload === null ||
      saved.version !== command.expectedVersion + 1 ||
      JSON.stringify(saved.payload) !== JSON.stringify(command.payload)
    )
      return null;
    return bounded(
      {
        version: saved.version,
        payload: saved.payload,
        replayed: record.replayed,
      },
      MANAGED_PORTFOLIO_LIMITS.envelopeBytes,
    );
  } catch {
    return null;
  }
}

function captureActivity(value: unknown): object | null {
  const type = Object.getOwnPropertyDescriptor(value, "type");
  return captureRecord(
    value,
    type?.value === "split" ? SPLIT_KEYS : TRANSACTION_KEYS,
  );
}

/** Copy descriptors rather than reading getters or retaining caller-owned records. */
function captureRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): Readonly<Record<Keys[number], unknown>> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  if (Reflect.ownKeys(value).length !== keys.length) return null;
  const copied = {} as Record<Keys[number], unknown>;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
      return null;
    const field: unknown = descriptor.value;
    copied[key as Keys[number]] = field;
  }
  return Object.freeze(copied);
}

function captureList(
  value: unknown,
  maximum: number,
  capture: (entry: unknown) => object | null,
): readonly object[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
    return null;
  const length: unknown = Object.getOwnPropertyDescriptor(
    value,
    "length",
  )?.value;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > maximum ||
    Reflect.ownKeys(value).length !== length + 1
  )
    return null;
  const copied: object[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
      return null;
    const entry = capture(descriptor.value);
    if (entry === null) return null;
    copied.push(entry);
  }
  return Object.freeze(copied);
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
