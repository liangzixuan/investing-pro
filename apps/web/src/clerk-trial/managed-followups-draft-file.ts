import {
  assertPersonalSecJsonUniqueKeys,
  MANAGED_RESEARCH_FOLLOWUPS_LIMITS,
  parseResearchFollowupsPayload,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import {
  draftFileEncoder,
  requireDraftFile,
  requiredDraftFileHash,
  requiredDraftFileRecord,
  requiredDraftFileText,
  requiredDraftFileTime,
  requiredDraftFileVersion,
} from "./managed-watchlist-draft-file-validation";

export const MANAGED_FOLLOWUPS_DRAFT_FILE_MAX_BYTES =
  MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes;
const FORMAT = "investment-followups-draft";
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
  "accountScope",
  "capturedAt",
  "baseVersion",
] as const;

export interface ManagedFollowupsDraftFileInput {
  readonly accountScope: string;
  readonly capturedAt: string;
  readonly baseVersion: number;
  readonly draft: ResearchFollowupsPayload;
}
export interface ManagedFollowupsDraftFileContent extends ManagedFollowupsDraftFileInput {
  readonly format: typeof FORMAT;
  readonly version: 1;
}
export interface ManagedFollowupsDraftFileDocument {
  readonly filename: string;
  readonly mime: typeof MIME;
  readonly text: string;
  readonly byteLength: number;
  readonly accountScope: string;
  readonly capturedAt: string;
  readonly baseVersion: number;
}

function requiredContent(
  value: unknown,
  accountScope: string,
): ManagedFollowupsDraftFileContent {
  const fields = requiredDraftFileRecord(value, CONTENT_KEYS);
  requireDraftFile(fields.format === FORMAT);
  requireDraftFile(fields.version === 1);
  requireDraftFile(requiredDraftFileHash(fields.accountScope) === accountScope);
  const draft = parseResearchFollowupsPayload(fields.draft);
  requireDraftFile(draft !== null);
  return Object.freeze({
    format: FORMAT,
    version: 1,
    accountScope,
    capturedAt: requiredDraftFileTime(fields.capturedAt),
    baseVersion: requiredDraftFileVersion(fields.baseVersion),
    draft,
  });
}
function documentFor(
  content: ManagedFollowupsDraftFileContent,
): ManagedFollowupsDraftFileDocument {
  const text = JSON.stringify(content) + "\n";
  const byteLength = draftFileEncoder.encode(text).byteLength;
  requireDraftFile(byteLength <= MANAGED_FOLLOWUPS_DRAFT_FILE_MAX_BYTES);
  return Object.freeze({
    filename: `Investment-followups-draft-${content.capturedAt.replace(/[:.]/gu, "-")}.json`,
    mime: MIME,
    text,
    byteLength,
    accountScope: content.accountScope,
    capturedAt: content.capturedAt,
    baseVersion: content.baseVersion,
  });
}

/** Capture valid authored checks exactly, without normalizing or clipping raw input. */
export function formatManagedFollowupsDraftFile(
  input: ManagedFollowupsDraftFileInput,
): ManagedFollowupsDraftFileDocument | null {
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

/** Reading captures a local draft; it does not establish saved or catalog state. */
export function parseManagedFollowupsDraftFile(
  text: string,
  accountScope: string,
): ManagedFollowupsDraftFileContent | null {
  try {
    const scope = requiredDraftFileHash(accountScope);
    const admitted = requiredDraftFileText(
      text,
      MANAGED_FOLLOWUPS_DRAFT_FILE_MAX_BYTES,
    );
    assertPersonalSecJsonUniqueKeys(admitted);
    return requiredContent(JSON.parse(admitted) as unknown, scope);
  } catch {
    return null;
  }
}

/** Delivery requires the exact canonical text and all matching wrapper fields. */
export function isManagedFollowupsDraftFileDocument(
  value: unknown,
): value is ManagedFollowupsDraftFileDocument {
  try {
    const fields = requiredDraftFileRecord(value, DOCUMENT_KEYS);
    const text = requiredDraftFileText(
      fields.text,
      MANAGED_FOLLOWUPS_DRAFT_FILE_MAX_BYTES,
    );
    const scope = requiredDraftFileHash(fields.accountScope);
    const content = parseManagedFollowupsDraftFile(text, scope);
    requireDraftFile(content !== null);
    const expected = documentFor(content);
    return DOCUMENT_KEYS.every((key) => fields[key] === expected[key]);
  } catch {
    return false;
  }
}

/** Check the advertised size before starting a file read. */
export function assertFollowupsDraftFileSize(size: number): void {
  if (!Number.isSafeInteger(size)) throw new Error("size");
  if (size <= 0) throw new Error("size");
  if (size > MANAGED_FOLLOWUPS_DRAFT_FILE_MAX_BYTES) throw new Error("size");
}

/** Decode only the actual bounded bytes, without Unicode replacement. */
export function decodeFollowupsDraftFile(
  bytes: ArrayBuffer,
  expectedSize: number,
  accountScope: string,
): ManagedFollowupsDraftFileContent | null {
  try {
    assertFollowupsDraftFileSize(expectedSize);
    requireDraftFile(bytes instanceof ArrayBuffer);
    const view = new Uint8Array(bytes);
    requireDraftFile(view.byteLength === expectedSize);
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(view);
    return parseManagedFollowupsDraftFile(text, accountScope);
  } catch {
    return null;
  }
}
