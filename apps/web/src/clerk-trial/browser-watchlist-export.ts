import { isSavedWatchlistExportDocument } from "./managed-watchlist-export-document";
import type { WatchlistExportDeliveryAdapter } from "./watchlist-export-delivery";
import { createBrowserTextDownload } from "./browser-text-download";

export const browserWatchlistExportAdapter: WatchlistExportDeliveryAdapter =
  createBrowserTextDownload(
    isSavedWatchlistExportDocument,
    "text/plain;charset=utf-8",
    "Watchlist export unavailable",
  );
