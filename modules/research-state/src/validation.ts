import type {
  AlertPayload,
  DeleteCommand,
  SaveAlertCommand,
  SaveThesisCommand,
  SyntheticActorContext,
  ThesisPayload,
} from "./model";
import { invalidInput } from "./errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9._:-]+$/;
const METRIC_KEY_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;
const DECIMAL_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const ISO_UTC_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/;

export function validateActor(actor: SyntheticActorContext): void {
  assertExactRecord(
    actor,
    ["principalId", "organizationId", "requestId", "synthetic"],
    "actor",
  );
  if (actor.synthetic !== true)
    throw invalidInput("Only synthetic actor contexts are accepted.");
  assertUuid(actor.organizationId, "organizationId");
  assertUuid(actor.principalId, "principalId");
  assertToken(actor.requestId, "requestId", 8, 128);
}

export function validateSaveThesis(command: SaveThesisCommand): void {
  assertExactRecord(
    command,
    ["id", "payload", "expectedVersion", "idempotencyKey"],
    "save thesis command",
  );
  assertUuid(command.id, "thesis id");
  assertExpectedVersion(command.expectedVersion);
  assertIdempotencyKey(command.idempotencyKey);
  validateThesisPayload(command.payload);
}

export function validateSaveAlert(command: SaveAlertCommand): void {
  assertExactRecord(
    command,
    ["id", "payload", "expectedVersion", "idempotencyKey"],
    "save alert command",
  );
  assertUuid(command.id, "alert id");
  assertExpectedVersion(command.expectedVersion);
  assertIdempotencyKey(command.idempotencyKey);
  validateAlertPayload(command.payload);
}

export function validateDelete(command: DeleteCommand): void {
  assertExactRecord(
    command,
    ["id", "expectedVersion", "idempotencyKey"],
    "delete command",
  );
  assertUuid(command.id, "resource id");
  assertPositiveInteger(command.expectedVersion, "expectedVersion");
  assertIdempotencyKey(command.idempotencyKey);
}

export function validateThesisPayload(payload: ThesisPayload): void {
  assertExactRecord(
    payload,
    ["instrumentId", "claim", "evidence", "risks", "invalidation"],
    "thesis payload",
  );
  assertToken(payload.instrumentId, "instrumentId", 3, 160);
  assertText(payload.claim, "claim", 4_000);
  assertText(payload.evidence, "evidence", 8_000);
  assertText(payload.risks, "risks", 8_000);
  assertText(payload.invalidation, "invalidation", 4_000);
}

export function validateAlertPayload(payload: AlertPayload): void {
  assertExactRecord(
    payload,
    ["instrumentId", "metricKey", "operator", "threshold"],
    "alert payload",
  );
  assertToken(payload.instrumentId, "instrumentId", 3, 160);
  if (
    typeof payload.metricKey !== "string" ||
    !METRIC_KEY_PATTERN.test(payload.metricKey)
  )
    throw invalidInput("metricKey has an invalid format.");
  if (payload.operator !== "above" && payload.operator !== "below")
    throw invalidInput("operator must be above or below.");
  if (
    typeof payload.threshold !== "string" ||
    payload.threshold.length > 64 ||
    !DECIMAL_PATTERN.test(payload.threshold)
  )
    throw invalidInput("threshold must be a plain base-10 decimal.");
}

export function assertUuid(value: string, field: string): void {
  if (typeof value !== "string" || !UUID_PATTERN.test(value))
    throw invalidInput(`${field} must be an RFC 4122 UUID.`);
}

export function assertIsoUtc(value: string, field: string): void {
  if (typeof value !== "string")
    throw invalidInput(`${field} must be a valid UTC RFC 3339 date-time.`);
  const match = ISO_UTC_PATTERN.exec(value);
  if (!match)
    throw invalidInput(`${field} must be a valid UTC RFC 3339 date-time.`);
  const milliseconds = (match[2] ?? "").padEnd(3, "0");
  const canonical = `${match[1]}.${milliseconds}Z`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== canonical)
    throw invalidInput(`${field} must be a valid UTC RFC 3339 date-time.`);
}

function assertExpectedVersion(value: number | null): void {
  if (value !== null) assertPositiveInteger(value, "expectedVersion");
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw invalidInput(`${field} must be a positive safe integer.`);
}

function assertIdempotencyKey(value: string): void {
  assertToken(value, "idempotencyKey", 8, 128);
}

function assertToken(
  value: string,
  field: string,
  minimum: number,
  maximum: number,
): void {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    value.length > maximum ||
    !TOKEN_PATTERN.test(value)
  )
    throw invalidInput(`${field} has an invalid format.`);
}

function assertText(value: string, field: string, maximum: number): void {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximum ||
    containsDisallowedControl(value)
  )
    throw invalidInput(
      `${field} must be non-empty safe text within ${maximum} characters.`,
    );
}

function assertExactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw invalidInput(`${label} must be an object.`);
  const allowed = new Set(allowedKeys);
  const keys = Object.keys(value);
  if (keys.length !== allowed.size || keys.some((key) => !allowed.has(key)))
    throw invalidInput(`${label} contains missing or unknown fields.`);
}

function containsDisallowedControl(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (
      code <= 8 ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    )
      return true;
  }
  return false;
}
