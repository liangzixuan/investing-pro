import {
  MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES,
  parseManagedWatchlistDraftFile,
} from "./managed-watchlist-draft-file";

/** Check the advertised size before the caller starts a file read. */
export function assertWatchlistDraftFileSize(size: number) {
  if (!Number.isSafeInteger(size)) throw new Error("size");
  if (size <= 0) throw new Error("size");
  if (size > MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES) throw new Error("size");
}

/** Actual bytes must match the bounded file and decode without replacement. */
export function decodeWatchlistDraftFile(
  bytes: ArrayBuffer,
  expectedSize: number,
  accountScope: string,
) {
  if (bytes.byteLength !== expectedSize) return null;
  if (bytes.byteLength > MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES) return null;
  const text = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  return parseManagedWatchlistDraftFile(text, accountScope);
}
