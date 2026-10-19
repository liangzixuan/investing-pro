import {
  assertPersonalSecJsonUniqueKeys,
  MANAGED_WATCHLIST_LIMITS,
  type MainWatchlistPayload,
} from "@research-cockpit/contracts";
import { requiredWatchlistDraftFilePayload } from "./managed-watchlist-draft-file-payload";
import {
  draftFileEncoder,
  requireDraftFile,
  requiredDraftFileHash,
  requiredDraftFileRecord,
  requiredDraftFileText,
  requiredDraftFileTime,
  requiredDraftFileVersion,
} from "./managed-watchlist-draft-file-validation";

export const MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES =
  MANAGED_WATCHLIST_LIMITS.envelopeBytes;
const FORMAT = "investment-watchlist-draft";
const MIME = "application/json";
const INPUT_KEYS = [
  "accountScope",
  "capturedAt",
  "baseVersion",
  "draft",
] as const;
const CONTENT_KEYS = ["format", "version", ...INPUT_KEYS] as const;
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

function requiredContent(
  value: unknown,
  accountScope: string,
): ManagedWatchlistDraftFileContent {
  const fields = requiredDraftFileRecord(value, CONTENT_KEYS);
  requireDraftFile(fields.format === FORMAT);
  requireDraftFile(fields.version === 1);
  requireDraftFile(requiredDraftFileHash(fields.accountScope) === accountScope);
  return Object.freeze({
    format: FORMAT,
    version: 1,
    accountScope,
    capturedAt: requiredDraftFileTime(fields.capturedAt),
    baseVersion: requiredDraftFileVersion(fields.baseVersion),
    draft: requiredWatchlistDraftFilePayload(fields.draft),
  });
}
function documentFor(
  content: ManagedWatchlistDraftFileContent,
): ManagedWatchlistDraftFileDocument {
  const text = JSON.stringify(content) + "\n";
  const byteLength = draftFileEncoder.encode(text).byteLength;
  requireDraftFile(byteLength <= MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES);
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
    const fields = requiredDraftFileRecord(input, INPUT_KEYS);
    const accountScope = requiredDraftFileHash(fields.accountScope);
    return documentFor(
      requiredContent({ format: FORMAT, version: 1, ...fields }, accountScope),
    );
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
    const expectedScope = requiredDraftFileHash(accountScope);
    const admitted = requiredDraftFileText(
      text,
      MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES,
    );
    assertPersonalSecJsonUniqueKeys(admitted);
    return requiredContent(JSON.parse(admitted) as unknown, expectedScope);
  } catch {
    return null;
  }
}

/** Delivery accepts only the exact canonical formatter output and matching metadata. */
export function isManagedWatchlistDraftFileDocument(
  value: unknown,
): value is ManagedWatchlistDraftFileDocument {
  try {
    const fields = requiredDraftFileRecord(value, DOCUMENT_KEYS);
    const text = requiredDraftFileText(
      fields.text,
      MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES,
    );
    const scope = requiredDraftFileHash(fields.accountScope);
    const content = parseManagedWatchlistDraftFile(text, scope);
    requireDraftFile(content !== null);
    const expected = documentFor(content);
    return DOCUMENT_KEYS.every((key) => fields[key] === expected[key]);
  } catch {
    return false;
  }
}
