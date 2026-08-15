import type {
  FinancialFact,
  OperationProjectionQuery,
  OperationProjectionSourceResult,
  ProjectionOperation,
  RightsPolicy,
} from "@research-cockpit/research-core";

const POSTGRES_NUMERIC_PRECISION = 38;
const POSTGRES_NUMERIC_SCALE = 12;
const MAX_IDENTIFIER_LENGTH = 240;

const ROW_KEYS = [
  "row_id",
  "instrument_id",
  "security_id",
  "concept_key",
  "value_numeric",
  "value_scale",
  "unit_code",
  "currency_code",
  "dimensions_json",
  "period_start",
  "period_end",
  "known_from",
  "known_to",
  "system_from",
  "system_to",
  "available_at",
  "evidence_id",
  "rights_policy_id",
  "rights_policy_version",
  "quality_state",
  "classification",
  "policy_id",
  "policy_version",
  "policy_classification",
  "policy_territory",
  "policy_expires_at",
  "grant_policy_id",
  "grant_policy_version",
  "grant_purpose",
  "grant_channel",
  "grant_allowed",
] as const;

const QUERY_KEYS = ["scope", "operation", "context"] as const;
const SCOPE_KEYS = [
  "instrumentId",
  "publicKnownAt",
  "systemRecordedAt",
] as const;
const CONTEXT_KEYS = ["territory", "evaluatedAt"] as const;

const OPERATION_GRANT = {
  display_api: { purpose: "display", channel: "api" },
  derive_api: { purpose: "derive", channel: "api" },
  alert_local_alert: { purpose: "alert", channel: "local_alert" },
} as const;

const UNIT_CURRENCY = {
  USD_MILLIONS: "USD",
  USD_PER_SHARE: "USD",
  MILLIONS_SHARES: null,
  PERCENT: null,
  RATIO: null,
} as const;

type ExactDataRecord = Readonly<Record<string, unknown>>;

interface NormalizedTimestamp {
  canonical: string;
  epochMilliseconds: number;
}

interface NormalizedInterval {
  from: NormalizedTimestamp;
  to: NormalizedTimestamp | null;
}

interface NormalizedRow {
  candidate: {
    rowId: string;
    instrumentId: string;
    value: FinancialFact;
    rightsPolicyId: string;
    rightsPolicyVersion: string;
  };
  policy: RightsPolicy;
  policyFingerprint: string;
  conceptKey: string;
}

/**
 * A deliberately value-free boundary error. Callers may log the code, but must
 * not replace it with the rejected row or a database-driver error message.
 */
export class PostgresProjectionNormalizationError extends Error {
  public readonly code = "INVALID_POSTGRES_PROJECTION_ROWS" as const;

  public constructor() {
    super("PostgreSQL projection rows failed normalization.");
    this.name = "PostgresProjectionNormalizationError";
  }
}

/**
 * Normalizes the narrow, dimensionless synthetic-fact subset that the current
 * core can represent. This is a pure wire contract, not a query or adapter.
 *
 * `instrument_id` must be a listing ID produced by an explicit
 * listing -> share class -> security join. `security_id` is validated as a
 * separate identity and is never treated as the core instrument ID.
 */
export function normalizePostgresFinancialFactRows(
  query: OperationProjectionQuery,
  rows: unknown,
): OperationProjectionSourceResult<FinancialFact> {
  try {
    return normalizeRows(query, rows);
  } catch {
    throw new PostgresProjectionNormalizationError();
  }
}

function normalizeRows(
  queryValue: unknown,
  rowsValue: unknown,
): OperationProjectionSourceResult<FinancialFact> {
  const query = exactDataRecord(queryValue, QUERY_KEYS);
  const scope = exactDataRecord(query.scope, SCOPE_KEYS);
  const context = exactDataRecord(query.context, CONTEXT_KEYS);
  const operation = projectionOperation(query.operation);
  const instrumentId = canonicalText(scope.instrumentId, MAX_IDENTIFIER_LENGTH);
  const publicKnownAt = queryTimestamp(scope.publicKnownAt);
  const systemRecordedAt = queryTimestamp(scope.systemRecordedAt);
  const territory = canonicalText(context.territory, 80);
  const evaluatedAt = queryTimestamp(context.evaluatedAt);

  if (
    publicKnownAt.epochMilliseconds > evaluatedAt.epochMilliseconds ||
    systemRecordedAt.epochMilliseconds > evaluatedAt.epochMilliseconds
  ) {
    invalid();
  }

  const rows = exactArray(rowsValue);
  const candidates: NormalizedRow["candidate"][] = [];
  const policiesByReference = new Map<
    string,
    { policy: RightsPolicy; fingerprint: string }
  >();
  const rowIds = new Set<string>();
  const conceptKeys = new Set<string>();

  for (const rowValue of rows) {
    const normalized = normalizeRow({
      rowValue,
      operation,
      instrumentId,
      territory,
      publicKnownAt,
      systemRecordedAt,
    });

    if (
      rowIds.has(normalized.candidate.rowId) ||
      conceptKeys.has(normalized.conceptKey)
    ) {
      invalid();
    }
    rowIds.add(normalized.candidate.rowId);
    conceptKeys.add(normalized.conceptKey);

    const reference = policyReference(
      normalized.policy.id,
      normalized.policy.version,
    );
    const existing = policiesByReference.get(reference);
    if (existing && existing.fingerprint !== normalized.policyFingerprint) {
      invalid();
    }
    if (!existing) {
      policiesByReference.set(reference, {
        policy: normalized.policy,
        fingerprint: normalized.policyFingerprint,
      });
    }
    candidates.push(normalized.candidate);
  }

  candidates.sort((left, right) => compareCodeUnits(left.rowId, right.rowId));
  const policies = [...policiesByReference.values()]
    .map(({ policy }) => policy)
    .sort((left, right) =>
      compareCodeUnits(
        policyReference(left.id, left.version),
        policyReference(right.id, right.version),
      ),
    );

  return {
    scope: {
      instrumentId,
      publicKnownAt: originalTimestamp(scope.publicKnownAt),
      systemRecordedAt: originalTimestamp(scope.systemRecordedAt),
    },
    operation,
    candidates,
    policies,
    completeness: { state: "unknown", reason: "rls_filtered" },
  };
}

function normalizeRow(input: {
  rowValue: unknown;
  operation: ProjectionOperation;
  instrumentId: string;
  territory: string;
  publicKnownAt: NormalizedTimestamp;
  systemRecordedAt: NormalizedTimestamp;
}): NormalizedRow {
  const row = exactDataRecord(input.rowValue, ROW_KEYS);
  const rowId = canonicalText(row.row_id, MAX_IDENTIFIER_LENGTH);
  const rowInstrumentId = canonicalText(
    row.instrument_id,
    MAX_IDENTIFIER_LENGTH,
  );
  canonicalText(row.security_id, MAX_IDENTIFIER_LENGTH);
  if (rowInstrumentId !== input.instrumentId) invalid();

  const conceptKey = exactPattern(
    row.concept_key,
    /^[a-z][a-z0-9_]{0,119}$/,
    120,
  );
  const valueScale = integerInRange(row.value_scale, 0, POSTGRES_NUMERIC_SCALE);
  const value = fixedDecimal(row.value_numeric, valueScale);
  const unit = unitAndCurrency(row.unit_code, row.currency_code);
  if (row.dimensions_json !== "{}") invalid();

  const periodStart = nullableCalendarDate(row.period_start);
  const periodEnd = calendarDate(row.period_end);
  if (periodStart !== null && periodStart > periodEnd) invalid();

  const publicInterval = interval(row.known_from, row.known_to);
  const systemInterval = interval(row.system_from, row.system_to);
  const sourceAvailableAt = timestamp(row.available_at);
  if (
    sourceAvailableAt.epochMilliseconds >
      publicInterval.from.epochMilliseconds ||
    publicInterval.from.epochMilliseconds >
      systemInterval.from.epochMilliseconds ||
    !contains(publicInterval, input.publicKnownAt) ||
    !contains(systemInterval, input.systemRecordedAt)
  ) {
    invalid();
  }

  const evidenceId = canonicalText(row.evidence_id, MAX_IDENTIFIER_LENGTH);
  const rightsPolicyId = canonicalText(
    row.rights_policy_id,
    MAX_IDENTIFIER_LENGTH,
  );
  const rightsPolicyVersion = semanticVersion(row.rights_policy_version);
  const policyId = canonicalText(row.policy_id, MAX_IDENTIFIER_LENGTH);
  const policyVersion = semanticVersion(row.policy_version);
  const grantPolicyId = canonicalText(
    row.grant_policy_id,
    MAX_IDENTIFIER_LENGTH,
  );
  const grantPolicyVersion = semanticVersion(row.grant_policy_version);
  if (
    policyId !== rightsPolicyId ||
    policyVersion !== rightsPolicyVersion ||
    grantPolicyId !== rightsPolicyId ||
    grantPolicyVersion !== rightsPolicyVersion
  ) {
    invalid();
  }

  if (
    row.classification !== "synthetic" ||
    row.policy_classification !== "synthetic" ||
    row.policy_territory !== "demo_only" ||
    input.territory !== "demo_only"
  ) {
    invalid();
  }

  const qualityState = qualityStateValue(row.quality_state);
  const expectedGrant = OPERATION_GRANT[input.operation];
  if (
    row.grant_purpose !== expectedGrant.purpose ||
    row.grant_channel !== expectedGrant.channel ||
    row.grant_allowed !== true
  ) {
    invalid();
  }

  const expiresAt = nullableTimestamp(row.policy_expires_at);
  const policy: RightsPolicy = {
    id: policyId,
    version: policyVersion,
    classification: "synthetic",
    grants: [
      {
        purpose: expectedGrant.purpose,
        channel: expectedGrant.channel,
        allowed: true,
      },
    ],
    territory: "demo_only",
    expiresAt: expiresAt?.canonical ?? null,
  };
  const policyFingerprint = JSON.stringify({
    classification: row.policy_classification,
    territory: row.policy_territory,
    expiresAt: row.policy_expires_at,
    grantPolicyId: row.grant_policy_id,
    grantPolicyVersion: row.grant_policy_version,
    purpose: row.grant_purpose,
    channel: row.grant_channel,
    allowed: row.grant_allowed,
  });

  const fact: FinancialFact = {
    id: rowId,
    instrumentId: rowInstrumentId,
    key: conceptKey,
    value,
    unit,
    reportingPeriodEnd: periodEnd,
    publicKnownFrom: publicInterval.from.canonical,
    publicKnownTo: publicInterval.to?.canonical ?? null,
    systemRecordedFrom: systemInterval.from.canonical,
    systemRecordedTo: systemInterval.to?.canonical ?? null,
    sourceAvailableAt: sourceAvailableAt.canonical,
    evidenceId,
    rightsPolicyId,
    rightsPolicyVersion,
    qualityState,
  };

  return {
    candidate: {
      rowId,
      instrumentId: rowInstrumentId,
      value: fact,
      rightsPolicyId,
      rightsPolicyVersion,
    },
    policy,
    policyFingerprint,
    conceptKey,
  };
}

function exactArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) invalid();
  if (Object.getPrototypeOf(value) !== Array.prototype) invalid();
  const keys = Reflect.ownKeys(value);
  const normalized: unknown[] = [];
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor)) invalid();
  const lengthValue: unknown = lengthDescriptor.value;
  if (
    typeof lengthValue !== "number" ||
    !Number.isSafeInteger(lengthValue) ||
    lengthValue < 0
  ) {
    invalid();
  }
  for (const key of keys) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) invalid();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      invalid();
    }
  }
  for (let index = 0; index < lengthValue; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      invalid();
    }
    const element: unknown = descriptor.value;
    normalized.push(element);
  }
  return normalized;
}

function exactDataRecord<const TKeys extends readonly string[]>(
  value: unknown,
  expectedKeys: TKeys,
): ExactDataRecord & Record<TKeys[number], unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid();
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    invalid();
  }

  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    invalid();
  }
  const normalized: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      invalid();
    }
    const fieldValue: unknown = descriptor.value;
    normalized[key] = fieldValue;
  }
  return normalized;
}

function projectionOperation(value: unknown): ProjectionOperation {
  if (
    value !== "display_api" &&
    value !== "derive_api" &&
    value !== "alert_local_alert"
  ) {
    invalid();
  }
  return value;
}

function canonicalText(value: unknown, maximumLength: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value.trim() !== value ||
    hasControlCharacter(value)
  ) {
    invalid();
  }
  return value;
}

function exactPattern(
  value: unknown,
  pattern: RegExp,
  maximumLength: number,
): string {
  const normalized = canonicalText(value, maximumLength);
  if (!pattern.test(normalized)) invalid();
  return normalized;
}

function semanticVersion(value: unknown): string {
  return exactPattern(value, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 80);
}

function integerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    invalid();
  }
  return value;
}

function fixedDecimal(value: unknown, scale: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 80) {
    invalid();
  }
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match) invalid();
  const sign = match[1] ?? "";
  const integer = match[2];
  const fraction = match[3] ?? "";
  if (
    integer === undefined ||
    integer.length > POSTGRES_NUMERIC_PRECISION - POSTGRES_NUMERIC_SCALE ||
    fraction.length > POSTGRES_NUMERIC_SCALE ||
    fraction.slice(scale).replace(/0/g, "") !== ""
  ) {
    invalid();
  }
  const normalizedFraction = fraction.slice(0, scale).padEnd(scale, "0");
  const isZero =
    /^0+$/.test(integer) &&
    (normalizedFraction === "" || /^0+$/.test(normalizedFraction));
  return `${isZero ? "" : sign}${integer}${
    scale === 0 ? "" : `.${normalizedFraction}`
  }`;
}

function unitAndCurrency(
  unitValue: unknown,
  currencyValue: unknown,
): keyof typeof UNIT_CURRENCY {
  if (
    typeof unitValue !== "string" ||
    !Object.hasOwn(UNIT_CURRENCY, unitValue)
  ) {
    invalid();
  }
  const unit = unitValue as keyof typeof UNIT_CURRENCY;
  if (currencyValue !== UNIT_CURRENCY[unit]) invalid();
  return unit;
}

function qualityStateValue(value: unknown): FinancialFact["qualityState"] {
  if (value !== "verified_fixture" && value !== "restated_fixture") invalid();
  return value;
}

function calendarDate(value: unknown): string {
  if (typeof value !== "string") invalid();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) invalid();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    invalid();
  }
  return value;
}

function nullableCalendarDate(value: unknown): string | null {
  return value === null ? null : calendarDate(value);
}

function timestamp(value: unknown): NormalizedTimestamp {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    invalid();
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match) invalid();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ?? "";
  const zone = match[8];
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    fraction.slice(3).replace(/0/g, "") !== "" ||
    zone === undefined
  ) {
    invalid();
  }

  let offsetMinutes = 0;
  if (zone !== "Z") {
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMinutePart = Number(zone.slice(4, 6));
    if (
      zone === "-00:00" ||
      offsetHours > 14 ||
      offsetMinutePart > 59 ||
      (offsetHours === 14 && offsetMinutePart !== 0)
    ) {
      invalid();
    }
    offsetMinutes =
      (offsetHours * 60 + offsetMinutePart) * (zone.startsWith("+") ? 1 : -1);
  }

  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(
    hour,
    minute,
    second,
    Number(fraction.slice(0, 3).padEnd(3, "0")),
  );
  const epochMilliseconds = local.getTime() - offsetMinutes * 60_000;
  if (!Number.isFinite(epochMilliseconds)) invalid();
  const canonical = new Date(epochMilliseconds).toISOString();
  if (!/^\d{4}-/.test(canonical)) invalid();
  return { canonical, epochMilliseconds };
}

function queryTimestamp(value: unknown): NormalizedTimestamp {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) {
    invalid();
  }
  return timestamp(value);
}

function originalTimestamp(value: unknown): string {
  if (typeof value !== "string") invalid();
  queryTimestamp(value);
  return value;
}

function nullableTimestamp(value: unknown): NormalizedTimestamp | null {
  return value === null ? null : timestamp(value);
}

function interval(fromValue: unknown, toValue: unknown): NormalizedInterval {
  const from = timestamp(fromValue);
  const to = nullableTimestamp(toValue);
  if (to !== null && to.epochMilliseconds <= from.epochMilliseconds) invalid();
  return { from, to };
}

function contains(
  value: NormalizedInterval,
  instant: NormalizedTimestamp,
): boolean {
  return (
    value.from.epochMilliseconds <= instant.epochMilliseconds &&
    (value.to === null ||
      instant.epochMilliseconds < value.to.epochMilliseconds)
  );
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= 31 || (codePoint >= 127 && codePoint <= 159))
    ) {
      return true;
    }
  }
  return false;
}

function policyReference(id: string, version: string): string {
  return `${id}\u0000${version}`;
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function invalid(): never {
  throw new PostgresProjectionNormalizationError();
}
