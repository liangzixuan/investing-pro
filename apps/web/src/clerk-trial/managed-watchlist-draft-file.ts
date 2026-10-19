import {
  assertPersonalSecJsonUniqueKeys,
  encodeMainWatchlistPayload,
  isMainWatchlistPayload,
  MANAGED_WATCHLIST_LIMITS,
  type MainWatchlistPayload,
  type WatchlistMembership,
} from "@research-cockpit/contracts";

export const MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES =
  MANAGED_WATCHLIST_LIMITS.envelopeBytes;
const FORMAT = "investment-watchlist-draft";
const MIME = "application/json";
const HASH = /^sha256:[0-9a-f]{64}$/u;
const encoder = new TextEncoder();
const INPUT_KEYS = [
  "accountScope",
  "capturedAt",
  "baseVersion",
  "draft",
] as const;
const CONTENT_KEYS = ["format", "version", ...INPUT_KEYS] as const;
const DRAFT_KEYS = [
  "memberships",
  "name",
  "schemaVersion",
  "snapshotSha256",
] as const;
const MEMBER_KEYS = [
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "issuerName",
  "listingId",
  "note",
  "securityId",
  "securityName",
  "shareClassId",
  "shareClassName",
  "symbol",
] as const;
const DOCUMENT_KEYS = [
  "filename",
  "mime",
  "text",
  "byteLength",
  "membershipCount",
  "accountScope",
  "capturedAt",
  "baseVersion",
] as const;

export interface ManagedWatchlistDraftFileInput {
  readonly accountScope: string;
  readonly capturedAt: string;
  readonly baseVersion: number;
  readonly draft: MainWatchlistPayload;
}
export interface ManagedWatchlistDraftFileContent extends ManagedWatchlistDraftFileInput {
  readonly format: typeof FORMAT;
  readonly version: 1;
}
export interface ManagedWatchlistDraftFileDocument {
  readonly filename: string;
  readonly mime: typeof MIME;
  readonly text: string;
  readonly byteLength: number;
  readonly membershipCount: number;
  readonly accountScope: string;
  readonly capturedAt: string;
  readonly baseVersion: number;
}

function exactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (typeof value !== "object" || value === null) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  if (Reflect.ownKeys(value).length !== keys.length) return false;
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      descriptor?.enumerable === true && Object.hasOwn(descriptor, "value")
    );
  });
}
function memberArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || value.length > 10_000) return false;
  if (Object.getPrototypeOf(value) !== Array.prototype) return false;
  if (Reflect.ownKeys(value).length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value"))
      return false;
  }
  return true;
}
function copyMember(
  value: unknown,
  header: Omit<MainWatchlistPayload, "memberships">,
): WatchlistMembership | null {
  if (!exactRecord(value, MEMBER_KEYS)) return null;
  const { note, ...identity } = value;
  if (
    typeof note !== "string" ||
    note.length > MANAGED_WATCHLIST_LIMITS.payloadBytes
  )
    return null;
  // Validate only listing identity through the public saved contract. Its note
  // is a detached empty projection; the editing note is restored unchanged.
  const projected: unknown = {
    ...header,
    memberships: [{ ...identity, note: "" }],
  };
  if (!isMainWatchlistPayload(projected)) return null;
  return Object.freeze({ ...projected.memberships[0]!, note });
}
function copyMembers(
  values: unknown[],
  header: Omit<MainWatchlistPayload, "memberships">,
): readonly WatchlistMembership[] | null {
  const baseBytes = encoder.encode(
    encodeMainWatchlistPayload({ ...header, memberships: [] }),
  ).byteLength;
  let byteLength = baseBytes;
  const memberships: WatchlistMembership[] = [],
    listingIds = new Set<string>();
  for (const valueMember of values) {
    const member = copyMember(valueMember, header);
    if (!member || listingIds.has(member.listingId)) return null;
    byteLength +=
      encoder.encode(
        encodeMainWatchlistPayload({ ...header, memberships: [member] }),
      ).byteLength -
      baseBytes +
      (memberships.length ? 1 : 0);
    if (byteLength > MANAGED_WATCHLIST_LIMITS.payloadBytes) return null;
    listingIds.add(member.listingId);
    memberships.push(member);
  }
  return Object.freeze(memberships);
}
function copyDraft(value: unknown): MainWatchlistPayload | null {
  if (!exactRecord(value, DRAFT_KEYS)) return null;
  if (value.schemaVersion !== 1 || value.name !== "My Watchlist") return null;
  if (
    typeof value.snapshotSha256 !== "string" ||
    !HASH.test(value.snapshotSha256)
  )
    return null;
  if (!memberArray(value.memberships)) return null;
  const header = {
    name: "My Watchlist",
    schemaVersion: 1,
    snapshotSha256: value.snapshotSha256,
  } as const;
  const memberships = copyMembers(value.memberships, header);
  return memberships
    ? Object.freeze({
        memberships,
        ...header,
      })
    : null;
}
function canonicalTime(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  )
    return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
function copyContent(
  value: unknown,
  accountScope: string,
): ManagedWatchlistDraftFileContent | null {
  if (!exactRecord(value, CONTENT_KEYS)) return null;
  if (value.format !== FORMAT || value.version !== 1) return null;
  if (!HASH.test(accountScope) || value.accountScope !== accountScope)
    return null;
  if (!canonicalTime(value.capturedAt)) return null;
  if (
    !Number.isSafeInteger(value.baseVersion) ||
    (value.baseVersion as number) < 0
  )
    return null;
  const draft = copyDraft(value.draft);
  if (!draft) return null;
  return Object.freeze({
    format: FORMAT,
    version: 1,
    accountScope,
    capturedAt: value.capturedAt,
    baseVersion: value.baseVersion as number,
    draft,
  });
}
function documentFor(
  content: ManagedWatchlistDraftFileContent,
): ManagedWatchlistDraftFileDocument | null {
  const text = JSON.stringify(content) + "\n";
  const byteLength = encoder.encode(text).byteLength;
  if (byteLength > MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES) return null;
  return Object.freeze({
    filename: `Investment-watchlist-draft-${content.capturedAt.replace(/[:.]/gu, "-")}.json`,
    mime: MIME,
    text,
    byteLength,
    membershipCount: content.draft.memberships.length,
    accountScope: content.accountScope,
    capturedAt: content.capturedAt,
    baseVersion: content.baseVersion,
  });
}

/** Explicit draft transfer. Raw invalid notes remain drafts and are never normalized. */
export function formatManagedWatchlistDraftFile(
  input: ManagedWatchlistDraftFileInput,
): ManagedWatchlistDraftFileDocument | null {
  try {
    if (
      !exactRecord(input, INPUT_KEYS) ||
      typeof input.accountScope !== "string"
    )
      return null;
    const content = copyContent(
      { format: FORMAT, version: 1, ...input },
      input.accountScope,
    );
    return content ? documentFor(content) : null;
  } catch {
    return null;
  }
}

/** Reading never grants catalog eligibility or writes a saved Watchlist. */
export function parseManagedWatchlistDraftFile(
  text: string,
  accountScope: string,
): ManagedWatchlistDraftFileContent | null {
  try {
    if (typeof accountScope !== "string" || !HASH.test(accountScope))
      return null;
    if (
      typeof text !== "string" ||
      text.length > MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES
    )
      return null;
    if (
      /\p{Cs}/u.test(text) ||
      encoder.encode(text).byteLength > MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES
    )
      return null;
    assertPersonalSecJsonUniqueKeys(text);
    return copyContent(JSON.parse(text) as unknown, accountScope);
  } catch {
    return null;
  }
}

/** Delivery accepts only the exact canonical formatter output and matching metadata. */
export function isManagedWatchlistDraftFileDocument(
  value: unknown,
): value is ManagedWatchlistDraftFileDocument {
  try {
    if (!exactRecord(value, DOCUMENT_KEYS)) return false;
    if (
      typeof value.text !== "string" ||
      typeof value.accountScope !== "string"
    )
      return false;
    const content = parseManagedWatchlistDraftFile(
      value.text,
      value.accountScope,
    );
    const expected = content ? documentFor(content) : null;
    return (
      expected !== null &&
      DOCUMENT_KEYS.every((key) => value[key] === expected[key])
    );
  } catch {
    return false;
  }
}
