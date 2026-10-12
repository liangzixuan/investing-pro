import {
  MANAGED_WATCHLIST_LIMITS,
  parseManagedWatchlist,
  type MainWatchlistPayload,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type { SaveState, VersionedPayload } from "./save-coordinator";

export interface SavedWatchlistExportDocument {
  readonly version: number;
  readonly filename: string;
  readonly text: string;
  readonly byteLength: number;
  readonly membershipCount: number;
}

// Each canonical member has at least 190 JSON structural bytes. Its export
// framing uses at most 243 bytes, even with safe-integer ordinal/byte counts.
// Values occur once and UTF-8 JSON cannot be smaller than those raw values.
// Twice the admitted payload therefore covers all member expansion; the header
// (including the empty-list message) needs at most 284 of these extra 512 bytes.
export const MANAGED_WATCHLIST_EXPORT_MAX_BYTES =
  2 * MANAGED_WATCHLIST_LIMITS.payloadBytes + 512;

const IDENTITY_FIELDS = [
  ["listingId", "Listing ID"],
  ["symbol", "Symbol"],
  ["exchangeMic", "Exchange MIC"],
  ["country", "Country"],
  ["instrumentType", "Instrument type"],
  ["issuerId", "Issuer ID"],
  ["issuerName", "Issuer name"],
  ["securityId", "Security ID"],
  ["securityName", "Security name"],
  ["shareClassId", "Share class ID"],
  ["shareClassName", "Share class name"],
] as const satisfies readonly (readonly [keyof WatchlistMembership, string])[];

const DOCUMENT_KEYS = [
  "version",
  "filename",
  "text",
  "byteLength",
  "membershipCount",
] as const;

const encoder = new TextEncoder();

function filename(version: number): string {
  return `Investment-watchlist-v${version}.txt`;
}

function formatMember(member: WatchlistMembership, index: number): string {
  return [
    `Listing ${index + 1}`,
    ...IDENTITY_FIELDS.map(([key, label]) => `${label}: ${member[key]}`),
    `Saved note (${encoder.encode(member.note).byteLength} UTF-8 bytes):`,
    member.note,
    "End saved note.",
    "",
  ].join("\n");
}

/** Uses only a confirmed saved version; never reads or normalizes a draft. */
export function formatManagedWatchlistExport(
  saved: VersionedPayload<MainWatchlistPayload>,
): SavedWatchlistExportDocument | null {
  const admitted = parseManagedWatchlist(saved);
  if (!admitted) return null;
  const { version, payload } = admitted;
  const membershipCount = payload.memberships.length;
  const text = [
    "Investment - My Watchlist",
    `Saved version: ${version}`,
    `Catalog snapshot: ${payload.snapshotSha256}`,
    `Listings: ${membershipCount}`,
    "Scope: All listings from this confirmed saved version. Unsaved changes are not included.",
    "",
    membershipCount === 0
      ? "No saved listings.\n"
      : payload.memberships.map(formatMember).join("\n"),
  ].join("\n");
  const document = Object.freeze({
    version,
    filename: filename(version),
    text,
    byteLength: encoder.encode(text).byteLength,
    membershipCount,
  });
  return isSavedWatchlistExportDocument(document) ? document : null;
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function hasDocumentKeys(
  value: unknown,
): value is Record<(typeof DOCUMENT_KEYS)[number], unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === DOCUMENT_KEYS.length &&
    DOCUMENT_KEYS.every((key) => Object.hasOwn(value, key))
  );
}

function isBoundedUtf8Text(text: unknown, byteLength: number): text is string {
  return (
    typeof text === "string" &&
    text.length > 0 &&
    text.length <= MANAGED_WATCHLIST_EXPORT_MAX_BYTES &&
    !/\p{Cs}/u.test(text) &&
    byteLength <= MANAGED_WATCHLIST_EXPORT_MAX_BYTES &&
    encoder.encode(text).byteLength === byteLength
  );
}

/** Adapter boundary: reject malformed text rather than replacing or clipping it. */
export function isSavedWatchlistExportDocument(
  value: unknown,
): value is SavedWatchlistExportDocument {
  if (!hasDocumentKeys(value)) return false;
  if (
    !isCount(value.version) ||
    !isCount(value.membershipCount) ||
    value.filename !== filename(value.version) ||
    !isCount(value.byteLength)
  )
    return false;
  return isBoundedUtf8Text(value.text, value.byteLength);
}

export type ManagedWatchlistExportUnavailableReason =
  | Exclude<SaveState<MainWatchlistPayload>["phase"], "idle">
  | "no_saved"
  | "conflict"
  | "uncertain"
  | "replay_pending";

export function managedWatchlistExportUnavailableReason(
  state: SaveState<MainWatchlistPayload>,
): ManagedWatchlistExportUnavailableReason | null {
  if (state.phase !== "idle") return state.phase;
  if (!state.saved) return "no_saved";
  if (state.replayPending) return "replay_pending";
  if (state.uncertain) return "uncertain";
  if (state.conflict) return "conflict";
  return null;
}
