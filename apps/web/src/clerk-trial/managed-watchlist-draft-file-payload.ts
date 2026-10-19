import {
  encodeMainWatchlistPayload,
  isMainWatchlistPayload,
  MANAGED_WATCHLIST_LIMITS,
  type MainWatchlistPayload,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import {
  draftFileEncoder,
  requireDraftFile,
  requiredDraftFileArray,
  requiredDraftFileHash,
  requiredDraftFileRecord,
} from "./managed-watchlist-draft-file-validation";

type Header = Omit<MainWatchlistPayload, "memberships">;
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

function requiredHeader(
  value: Record<(typeof DRAFT_KEYS)[number], unknown>,
): Header {
  requireDraftFile(value.schemaVersion === 1);
  requireDraftFile(value.name === "My Watchlist");
  return {
    name: "My Watchlist",
    schemaVersion: 1,
    snapshotSha256: requiredDraftFileHash(value.snapshotSha256),
  };
}

function requiredMember(value: unknown, header: Header): WatchlistMembership {
  const { note, ...identity } = requiredDraftFileRecord(value, MEMBER_KEYS);
  requireDraftFile(typeof note === "string");
  requireDraftFile(note.length <= MANAGED_WATCHLIST_LIMITS.payloadBytes);
  // Only the detached empty-note projection uses the saved identity contract.
  // The editing note is then restored unchanged, including invalid raw text.
  const projected: unknown = {
    ...header,
    memberships: [{ ...identity, note: "" }],
  };
  requireDraftFile(isMainWatchlistPayload(projected));
  return Object.freeze({ ...projected.memberships[0]!, note });
}

function requiredMembers(
  value: unknown,
  header: Header,
): readonly WatchlistMembership[] {
  const values = requiredDraftFileArray(value, 10_000);
  const baseBytes = draftFileEncoder.encode(
    encodeMainWatchlistPayload({ ...header, memberships: [] }),
  ).byteLength;
  let byteLength = baseBytes;
  const memberships: WatchlistMembership[] = [],
    listingIds = new Set<string>();
  for (const valueMember of values) {
    const member = requiredMember(valueMember, header);
    requireDraftFile(!listingIds.has(member.listingId));
    byteLength +=
      draftFileEncoder.encode(
        encodeMainWatchlistPayload({ ...header, memberships: [member] }),
      ).byteLength -
      baseBytes +
      (memberships.length ? 1 : 0);
    requireDraftFile(byteLength <= MANAGED_WATCHLIST_LIMITS.payloadBytes);
    listingIds.add(member.listingId);
    memberships.push(member);
  }
  return Object.freeze(memberships);
}

/** Own the whole editing payload; catalog admission and saved-note validity stay separate. */
export function requiredWatchlistDraftFilePayload(
  value: unknown,
): MainWatchlistPayload {
  const fields = requiredDraftFileRecord(value, DRAFT_KEYS);
  const header = requiredHeader(fields);
  return Object.freeze({
    memberships: requiredMembers(fields.memberships, header),
    ...header,
  });
}
