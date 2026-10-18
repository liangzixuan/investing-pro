import { createHash } from "node:crypto";

/** Local admission limits, not provider storage or billing limits. */
export const NATIVE_BACKUP_RECEIPT_LIMITS = Object.freeze({
  envelopeBytes: 65536,
  optionsBytes: 16384,
  resourceCount: 32,
  resourceBytes: 1024,
  resourceTypeBytes: 64,
} as const);

export const NATIVE_BACKUP_DESTINATION_EVIDENCE = Object.freeze([
  "destination_absent_before_restore",
  "restored_schema_and_complete_row_inventory",
  "unchanged_source_application_proof",
] as const);

const ARCHIVE_STATUSES = [
  "pending",
  "processing",
  "uploading",
  "completed",
  "failed",
  "skipped",
] as const;
const RESTORATION_STATUSES = [
  "pending",
  "downloading",
  "processing",
  "completed",
  "failed",
] as const;
const COMMON_FIELDS = [
  "$id",
  "$createdAt",
  "$updatedAt",
  "policyId",
  "status",
  "startedAt",
  "migrationId",
  "services",
  "resources",
] as const;
type ArchiveStatus = (typeof ARCHIVE_STATUSES)[number];
type RestorationStatus = (typeof RESTORATION_STATUSES)[number];
type Progress = "pending" | "completed" | "failed" | "skipped";
const TERMINAL_PROGRESS: Partial<
  Record<ArchiveStatus | RestorationStatus, Progress>
> = {
  completed: "completed",
  failed: "failed",
  skipped: "skipped",
};
type ReceiptFailure =
  "envelope" | "field" | "expectation" | "identity" | "state";

export class NativeBackupReceiptError extends Error {
  constructor(readonly reason: ReceiptFailure) {
    super("Invalid native backup receipt");
  }
}

interface OpaqueSummary {
  readonly bytes: number;
  readonly sha256: string;
}
interface ReceiptMetadata {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly policyId: string;
  readonly startedAt: string;
  readonly migrationId: string;
  readonly resources: OpaqueSummary & { readonly count: number };
}
interface ReceiptState {
  readonly progress: Progress;
  readonly terminal: boolean;
  readonly pollingAllowed: boolean;
  readonly operationRetryAllowed: false;
}

export interface NativeBackupArchiveExpectation {
  sourceResourceId: string;
  /** Omit only while admitting the original creation receipt. */
  archiveId?: string;
  /** Bind after a nonempty migration ID has been captured. */
  migrationId?: string;
  /** Supply only a type supported by the producer's documented contract. */
  expectedResourceType?: string;
}
export interface NativeBackupArchiveReceipt
  extends ReceiptMetadata, ReceiptState {
  readonly status: ArchiveStatus;
  readonly sourceResourceId: string;
  readonly resourceType: string | null;
  readonly size: number;
}
export interface NativeBackupRestorationExpectation {
  archive: NativeBackupArchiveReceipt;
  requestedDestinationResourceId: string;
  /** Omit only while admitting the original creation receipt. */
  restorationId?: string;
  /** Bind after a nonempty migration ID has been captured. */
  migrationId?: string;
}
export interface NativeBackupRestorationReceipt
  extends ReceiptMetadata, ReceiptState {
  readonly status: RestorationStatus;
  readonly archiveId: string;
  readonly sourceResourceId: string;
  readonly requestedDestinationResourceId: string;
  readonly destinationEvidence: "request_only";
  readonly requiredIndependentEvidence: typeof NATIVE_BACKUP_DESTINATION_EVIDENCE;
  readonly options: OpaqueSummary;
}

function refuse(reason: ReceiptFailure): never {
  throw new NativeBackupReceiptError(reason);
}

function isSdkStringifier(descriptor: PropertyDescriptor | undefined): boolean {
  if (!descriptor) return false;
  if (descriptor.enumerable !== false) return false;
  if (descriptor.configurable !== true) return false;
  if (descriptor.writable !== true) return false;
  if (!("value" in descriptor)) return false;
  return typeof descriptor.value === "function";
}

function recordDescriptors(value: unknown): PropertyDescriptorMap {
  if (value === null) refuse("envelope");
  if (typeof value !== "object") refuse("envelope");
  if (Array.isArray(value)) refuse("envelope");
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) refuse("envelope");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  // Client.call adds exactly this non-enumerable data function to SDK results.
  if (isSdkStringifier(Object.getOwnPropertyDescriptor(value, "toString")))
    Reflect.deleteProperty(descriptors, "toString");
  return descriptors;
}

function jsonDataValue(descriptor: PropertyDescriptor | undefined): unknown {
  if (!descriptor) refuse("envelope");
  if (!("value" in descriptor)) refuse("envelope");
  if (!descriptor.enumerable) refuse("envelope");
  return descriptor.value;
}

function envelope(
  value: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  const descriptors = recordDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length > fields.length) refuse("envelope");
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (typeof key !== "string" || !fields.includes(key)) refuse("envelope");
    result[key] = jsonDataValue(descriptors[key]);
  }
  return result;
}

function text(value: unknown, maxBytes: number): string {
  if (typeof value !== "string") refuse("field");
  if (Buffer.byteLength(value, "utf8") > maxBytes) refuse("field");
  return value;
}

function identifier(value: unknown, empty = false): string {
  const result = text(value, 36);
  if (empty && result === "") return result;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(result)) refuse("field");
  return result;
}

function expectedIdentifier(value: unknown): string {
  try {
    return identifier(value);
  } catch {
    return refuse("expectation");
  }
}

function bind(actual: string, expected: string | undefined): void {
  if (expected === undefined) return;
  if (actual !== expectedIdentifier(expected)) refuse("identity");
}

function timestamp(value: unknown, empty = false): string {
  const result = text(value, 40);
  if (empty && result === "") return result;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
      result,
    );
  if (!match || !Number.isFinite(Date.parse(result))) refuse("field");
  requireCalendarDay(Number(match[1]), Number(match[2]), Number(match[3]));
  return result;
}

function requireCalendarDay(year: number, month: number, day: number): void {
  if (month < 1) refuse("field");
  if (month > 12) refuse("field");
  if (day < 1) refuse("field");
  const endOfMonth = new Date(0);
  endOfMonth.setUTCFullYear(year, month, 0);
  if (day > endOfMonth.getUTCDate()) refuse("field");
}

function archiveSize(value: unknown): number {
  if (typeof value !== "number") refuse("field");
  if (!Number.isSafeInteger(value)) refuse("field");
  if (value < 0) refuse("field");
  return value;
}

function strings(value: unknown, count: number, bytes: number): string[] {
  if (!Array.isArray(value) || value.length > count) refuse("field");
  return Array.from(value, (item: unknown) => text(item, bytes));
}

function opaque(value: string): OpaqueSummary {
  return Object.freeze({
    bytes: Buffer.byteLength(value, "utf8"),
    sha256: createHash("sha256").update(value, "utf8").digest("hex"),
  });
}

function status<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    refuse("state");
  return value as T;
}

function state(value: ArchiveStatus | RestorationStatus): ReceiptState {
  const progress = TERMINAL_PROGRESS[value] ?? "pending";
  return {
    progress,
    terminal: progress !== "pending",
    pollingAllowed: progress === "pending",
    operationRetryAllowed: false,
  };
}

function metadata(
  raw: Record<string, unknown>,
  providerStatus: string,
): ReceiptMetadata {
  const services = strings(raw.services, 1, 8);
  if (services.length !== 1 || services[0] !== "tablesdb") refuse("identity");
  const resources = strings(
    raw.resources,
    NATIVE_BACKUP_RECEIPT_LIMITS.resourceCount,
    NATIVE_BACKUP_RECEIPT_LIMITS.resourceBytes,
  );
  return {
    id: identifier(raw.$id),
    createdAt: timestamp(raw.$createdAt),
    updatedAt: timestamp(raw.$updatedAt),
    policyId: identifier(raw.policyId, true),
    startedAt: timestamp(raw.startedAt, providerStatus === "pending"),
    migrationId: identifier(raw.migrationId, providerStatus === "pending"),
    resources: Object.freeze({
      ...opaque(JSON.stringify(resources)),
      count: resources.length,
    }),
  };
}

function checkEnvelopeBytes(raw: Record<string, unknown>): void {
  text(JSON.stringify(raw), NATIVE_BACKUP_RECEIPT_LIMITS.envelopeBytes);
}

/** Capture creation IDs once, then require them on every later observation. */
export function decodeNativeBackupArchive(
  value: unknown,
  expected: NativeBackupArchiveExpectation,
): NativeBackupArchiveReceipt {
  const sourceResourceId = expectedIdentifier(expected.sourceResourceId);
  const raw = envelope(value, [
    ...COMMON_FIELDS,
    "size",
    "resourceId",
    "resourceType",
  ]);
  const providerStatus = status(raw.status, ARCHIVE_STATUSES);
  const common = metadata(raw, providerStatus);
  bind(common.id, expected.archiveId);
  bind(common.migrationId, expected.migrationId);
  if (identifier(raw.resourceId) !== sourceResourceId) refuse("identity");
  const resourceType =
    "resourceType" in raw
      ? text(raw.resourceType, NATIVE_BACKUP_RECEIPT_LIMITS.resourceTypeBytes)
      : null;
  if (expected.expectedResourceType !== undefined) {
    const expectedType = text(
      expected.expectedResourceType,
      NATIVE_BACKUP_RECEIPT_LIMITS.resourceTypeBytes,
    );
    if (expectedType === "") refuse("expectation");
    if (resourceType !== expectedType) refuse("identity");
  }
  const size = archiveSize(raw.size);
  checkEnvelopeBytes(raw);
  return Object.freeze({
    ...common,
    ...state(providerStatus),
    status: providerStatus,
    sourceResourceId,
    resourceType,
    size,
  });
}

function requireCompletedArchive(archive: NativeBackupArchiveReceipt): void {
  if (archive.status !== "completed") refuse("expectation");
  if (archive.progress !== "completed") refuse("expectation");
  if (!archive.terminal) refuse("expectation");
  if (archive.pollingAllowed) refuse("expectation");
  if (archive.operationRetryAllowed !== false) refuse("expectation");
}

/**
 * The destination is bound to the trusted request, not echoed by this receipt.
 * Acceptance also requires the listed independent inventory and source proofs.
 * options and resources remain opaque; neither has a documented inner grammar.
 */
export function decodeNativeBackupRestoration(
  value: unknown,
  expected: NativeBackupRestorationExpectation,
): NativeBackupRestorationReceipt {
  const sourceResourceId = expectedIdentifier(
    expected.archive.sourceResourceId,
  );
  const archiveId = expectedIdentifier(expected.archive.id);
  const requestedDestinationResourceId = expectedIdentifier(
    expected.requestedDestinationResourceId,
  );
  requireCompletedArchive(expected.archive);
  if (sourceResourceId === requestedDestinationResourceId)
    refuse("expectation");
  const raw = envelope(value, [...COMMON_FIELDS, "archiveId", "options"]);
  const providerStatus = status(raw.status, RESTORATION_STATUSES);
  const common = metadata(raw, providerStatus);
  bind(common.id, expected.restorationId);
  bind(common.migrationId, expected.migrationId);
  bind(identifier(raw.archiveId), archiveId);
  const options = opaque(
    text(raw.options, NATIVE_BACKUP_RECEIPT_LIMITS.optionsBytes),
  );
  checkEnvelopeBytes(raw);
  return Object.freeze({
    ...common,
    ...state(providerStatus),
    status: providerStatus,
    archiveId,
    sourceResourceId,
    requestedDestinationResourceId,
    destinationEvidence: "request_only",
    requiredIndependentEvidence: NATIVE_BACKUP_DESTINATION_EVIDENCE,
    options,
  });
}
