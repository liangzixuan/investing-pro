import { createBrowserTextDownload } from "./browser-text-download";
import { isManagedWatchlistDraftFileDocument } from "./managed-watchlist-draft-file";
import type { ManagedWatchlistDraftFileDeliveryAdapter } from "./managed-watchlist-draft-file-delivery";

export const browserWatchlistDraftFileAdapter: ManagedWatchlistDraftFileDeliveryAdapter =
  createBrowserTextDownload(
    isManagedWatchlistDraftFileDocument,
    "application/json;charset=utf-8",
    "Watchlist draft file unavailable",
  );
