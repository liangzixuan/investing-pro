import {
  isWatchlistListingIdentity,
  normalizeWatchlistNote,
  type WatchlistMembership,
} from "./personal-watchlist";

export const MANAGED_RESEARCH_FOLLOWUPS_PATH =
  "/v1/managed/research-followups" as const;
export const MANAGED_RESEARCH_FOLLOWUPS_LIMITS = Object.freeze({
  entries: 20,
  checkCodePoints: 500,
  resultCodePoints: 2_000,
  payloadBytes: 262_144,
  envelopeBytes: 266_240,
} as const);

export type ResearchFollowup = Readonly<{
  id: string;
  catalogSnapshotSha256: `sha256:${string}`;
  listing: Omit<WatchlistMembership, "note">;
  check: string;
  dueOn: string;
  result: string;
}> &
  (
    | Readonly<{ status: "open"; completedOn: null }>
    | Readonly<{ status: "completed"; completedOn: string }>
  );

export interface ResearchFollowupsPayload {
  readonly schemaVersion: 1;
  readonly entries: readonly ResearchFollowup[];
}

export interface ManagedResearchFollowupsCommand {
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly payload: ResearchFollowupsPayload;
}

export interface ManagedResearchFollowupsDto {
  readonly version: number;
  readonly payload: ResearchFollowupsPayload;
}

export interface ManagedResearchFollowupsReceiptDto extends ManagedResearchFollowupsDto {
  readonly replayed: boolean;
}

const ENTRY_KEYS = [
  "id",
  "catalogSnapshotSha256",
  "listing",
  "check",
  "dueOn",
  "status",
  "completedOn",
  "result",
] as const;
const LISTING_KEYS = [
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
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const COMMAND_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;

export function normalizeResearchFollowupCheck(value: string): string | null {
  const normalized = normalizeWatchlistNote(value);
  return normalized !== null &&
    normalized.length > 0 &&
    [...normalized].length <= MANAGED_RESEARCH_FOLLOWUPS_LIMITS.checkCodePoints
    ? normalized
    : null;
}

export function normalizeResearchFollowupResult(value: string): string | null {
  return normalizeWatchlistNote(value);
}

/** Saved shape only; catalog eligibility and completion clocks belong to the repository. */
export function parseResearchFollowupsPayload(
  value: unknown,
): ResearchFollowupsPayload | null {
  try {
    if (
      !hasKeys(value, ["schemaVersion", "entries"]) ||
      value.schemaVersion !== 1 ||
      !isEntryList(value.entries)
    )
      return null;
    const entries = value.entries.map(copyEntry);
    if (
      new Set(entries.map((entry) => entry.id)).size !== entries.length ||
      new Set(entries.map((entry) => entry.listing.listingId)).size !==
        entries.length
    )
      return null;
    return bounded(
      { schemaVersion: 1, entries: Object.freeze(entries) },
      MANAGED_RESEARCH_FOLLOWUPS_LIMITS.payloadBytes,
    );
  } catch {
    return null;
  }
}

/** Field order is fixed; entry order remains part of the captured command. */
export function encodeResearchFollowupsPayload(
  payload: ResearchFollowupsPayload,
): string {
  const captured = parseResearchFollowupsPayload(payload);
  if (captured === null)
    throw new TypeError("Invalid research follow-ups payload");
  return JSON.stringify(captured);
}

export function parseManagedResearchFollowupsCommand(
  value: unknown,
): ManagedResearchFollowupsCommand | null {
  try {
    if (!hasKeys(value, ["expectedVersion", "idempotencyKey", "payload"]))
      return null;
    const { expectedVersion, idempotencyKey } = value;
    if (
      !isVersion(expectedVersion) ||
      expectedVersion >= Number.MAX_SAFE_INTEGER ||
      typeof idempotencyKey !== "string" ||
      !COMMAND_KEY.test(idempotencyKey)
    )
      return null;
    const payload = parseResearchFollowupsPayload(value.payload);
    return payload === null
      ? null
      : bounded(
          { expectedVersion, idempotencyKey, payload },
          MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes,
        );
  } catch {
    return null;
  }
}

export function parseManagedResearchFollowups(
  value: unknown,
): ManagedResearchFollowupsDto | null {
  try {
    if (!hasKeys(value, ["version", "payload"]) || !isVersion(value.version))
      return null;
    const payload = parseResearchFollowupsPayload(value.payload);
    return payload === null ||
      (value.version === 0 && payload.entries.length !== 0)
      ? null
      : bounded(
          { version: value.version, payload },
          MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes,
        );
  } catch {
    return null;
  }
}

/** A replay confirms the captured command, not the latest shared version. */
export function parseManagedResearchFollowupsReceipt(
  value: unknown,
  capturedCommand: ManagedResearchFollowupsCommand,
): ManagedResearchFollowupsReceiptDto | null {
  try {
    const command = parseManagedResearchFollowupsCommand(capturedCommand);
    if (
      command === null ||
      !hasKeys(value, ["version", "payload", "replayed"]) ||
      typeof value.replayed !== "boolean"
    )
      return null;
    const saved = parseManagedResearchFollowups({
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
      MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes,
    );
  } catch {
    return null;
  }
}

function isEntry(value: unknown): value is ResearchFollowup {
  return (
    hasKeys(value, ENTRY_KEYS) &&
    typeof value.id === "string" &&
    UUID_V4.test(value.id) &&
    typeof value.catalogSnapshotSha256 === "string" &&
    DIGEST.test(value.catalogSnapshotSha256) &&
    hasKeys(value.listing, LISTING_KEYS) &&
    isWatchlistListingIdentity(value.listing) &&
    typeof value.check === "string" &&
    normalizeResearchFollowupCheck(value.check) === value.check &&
    typeof value.result === "string" &&
    normalizeResearchFollowupResult(value.result) === value.result &&
    isDate(value.dueOn) &&
    ((value.status === "open" && value.completedOn === null) ||
      (value.status === "completed" && isDate(value.completedOn)))
  );
}

function copyEntry(entry: ResearchFollowup): ResearchFollowup {
  const listing = entry.listing;
  return Object.freeze({
    id: entry.id,
    catalogSnapshotSha256: entry.catalogSnapshotSha256,
    listing: Object.freeze({
      country: listing.country,
      exchangeMic: listing.exchangeMic,
      instrumentType: listing.instrumentType,
      issuerId: listing.issuerId,
      issuerName: listing.issuerName,
      listingId: listing.listingId,
      securityId: listing.securityId,
      securityName: listing.securityName,
      shareClassId: listing.shareClassId,
      shareClassName: listing.shareClassName,
      symbol: listing.symbol,
    }),
    check: entry.check,
    dueOn: entry.dueOn,
    ...(entry.status === "open"
      ? { status: "open" as const, completedOn: null }
      : { status: "completed" as const, completedOn: entry.completedOn }),
    result: entry.result,
  });
}

function isEntryList(value: unknown): value is readonly ResearchFollowup[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length > MANAGED_RESEARCH_FOLLOWUPS_LIMITS.entries ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    return false;
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (
      !descriptor?.enumerable ||
      !Object.hasOwn(descriptor, "value") ||
      !isEntry(descriptor.value)
    )
      return false;
  }
  return true;
}

function hasKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
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

function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/u.test(value))
    return false;
  const instant = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(instant) &&
    new Date(instant).toISOString() === `${value}T00:00:00.000Z`
  );
}

function bounded<T extends object>(
  value: T,
  maximum: number,
): Readonly<T> | null {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength <= maximum
    ? Object.freeze(value)
    : null;
}
