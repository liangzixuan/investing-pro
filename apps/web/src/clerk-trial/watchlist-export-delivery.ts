import type { SavedWatchlistExportDocument } from "./managed-watchlist-export-document";

export interface WatchlistExportDeliveryContext {
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
}

export type WatchlistExportDeliveryResult =
  "download_requested" | "written" | "cancelled";

export interface WatchlistExportDeliveryAdapter {
  deliver(
    document: SavedWatchlistExportDocument,
    context: WatchlistExportDeliveryContext,
  ): Promise<WatchlistExportDeliveryResult>;
}
