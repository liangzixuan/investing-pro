import {
  assertPersonalSecJsonUniqueKeys,
  parseValuationAssumptionEntry,
  type ValuationAssumptionEntry,
} from "@research-cockpit/contracts";
import {
  draftFileEncoder,
  requireDraftFile,
  requiredDraftFileHash,
  requiredDraftFileRecord,
  requiredDraftFileText,
  requiredDraftFileTime,
} from "./managed-watchlist-draft-file-validation";

export const MANAGED_VALUATION_DRAFT_FILE_MAX_BYTES = 128 * 1024;
const FORMAT = "investment-valuation-inputs-draft";
const MIME = "application/json";
const INPUT_KEYS = ["accountScope", "capturedAt", "entry"] as const;
const CONTENT_KEYS = ["format", "version", ...INPUT_KEYS] as const;
const DOCUMENT_KEYS = [
  "filename",
  "mime",
  "text",
  "byteLength",
  "accountScope",
  "capturedAt",
] as const;

export interface ManagedValuationDraftFileInput {
  readonly accountScope: string;
  readonly capturedAt: string;
  readonly entry: ValuationAssumptionEntry;
}
export interface ManagedValuationDraftFileContent extends ManagedValuationDraftFileInput {
  readonly format: typeof FORMAT;
  readonly version: 1;
}
export interface ManagedValuationDraftFileDocument {
  readonly filename: string;
  readonly mime: typeof MIME;
  readonly text: string;
  readonly byteLength: number;
  readonly accountScope: string;
  readonly capturedAt: string;
}

function requiredContent(
  value: unknown,
  accountScope: string,
): ManagedValuationDraftFileContent {
  const fields = requiredDraftFileRecord(value, CONTENT_KEYS);
  requireDraftFile(fields.format === FORMAT);
  requireDraftFile(fields.version === 1);
  requireDraftFile(requiredDraftFileHash(fields.accountScope) === accountScope);
  const entry = parseValuationAssumptionEntry(fields.entry);
  requireDraftFile(entry !== null);
  return Object.freeze({
    format: FORMAT,
    version: 1,
    accountScope,
    capturedAt: requiredDraftFileTime(fields.capturedAt),
    entry,
  });
}
function documentFor(
  content: ManagedValuationDraftFileContent,
): ManagedValuationDraftFileDocument {
  const text = JSON.stringify(content) + "\n";
  const byteLength = draftFileEncoder.encode(text).byteLength;
  requireDraftFile(byteLength <= MANAGED_VALUATION_DRAFT_FILE_MAX_BYTES);
  return Object.freeze({
    filename: `Investment-valuation-inputs-draft-${content.capturedAt.replace(/[:.]/gu, "-")}.json`,
    mime: MIME,
    text,
    byteLength,
    accountScope: content.accountScope,
    capturedAt: content.capturedAt,
  });
}

/** Capture bounded raw inputs exactly; numeric validity and calculation are separate. */
export function formatManagedValuationDraftFile(
  input: ManagedValuationDraftFileInput,
): ManagedValuationDraftFileDocument | null {
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
export function parseManagedValuationDraftFile(
  text: string,
  accountScope: string,
): ManagedValuationDraftFileContent | null {
  try {
    const scope = requiredDraftFileHash(accountScope);
    const admitted = requiredDraftFileText(
      text,
      MANAGED_VALUATION_DRAFT_FILE_MAX_BYTES,
    );
    assertPersonalSecJsonUniqueKeys(admitted);
    return requiredContent(JSON.parse(admitted) as unknown, scope);
  } catch {
    return null;
  }
}

/** Delivery requires the exact canonical text and all matching wrapper fields. */
export function isManagedValuationDraftFileDocument(
  value: unknown,
): value is ManagedValuationDraftFileDocument {
  try {
    const fields = requiredDraftFileRecord(value, DOCUMENT_KEYS);
    const text = requiredDraftFileText(
      fields.text,
      MANAGED_VALUATION_DRAFT_FILE_MAX_BYTES,
    );
    const scope = requiredDraftFileHash(fields.accountScope);
    const content = parseManagedValuationDraftFile(text, scope);
    requireDraftFile(content !== null);
    const expected = documentFor(content);
    return DOCUMENT_KEYS.every((key) => fields[key] === expected[key]);
  } catch {
    return false;
  }
}

/** Check the advertised size before starting a file read. */
export function assertValuationDraftFileSize(size: number): void {
  if (!Number.isSafeInteger(size)) throw new Error("size");
  if (size <= 0) throw new Error("size");
  if (size > MANAGED_VALUATION_DRAFT_FILE_MAX_BYTES) throw new Error("size");
}

/** Decode only the actual bounded bytes, without Unicode replacement. */
export function decodeValuationDraftFile(
  bytes: ArrayBuffer,
  expectedSize: number,
  accountScope: string,
): ManagedValuationDraftFileContent | null {
  try {
    assertValuationDraftFileSize(expectedSize);
    requireDraftFile(bytes instanceof ArrayBuffer);
    const view = new Uint8Array(bytes);
    requireDraftFile(view.byteLength === expectedSize);
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(view);
    return parseManagedValuationDraftFile(text, accountScope);
  } catch {
    return null;
  }
}
