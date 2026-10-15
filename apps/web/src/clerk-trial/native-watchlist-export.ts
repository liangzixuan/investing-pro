import { isSavedWatchlistExportDocument } from "./managed-watchlist-export-document";
import type { WatchlistExportDeliveryAdapter } from "./watchlist-export-delivery";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";
export type InvestmentWatchlistExportPlugin = NativeTextDocumentPlugin<{
  version: number;
}>;
export function createNativeWatchlistExportAdapter(
  plugin: InvestmentWatchlistExportPlugin,
): WatchlistExportDeliveryAdapter {
  return createNativeTextDocumentDelivery(
    plugin,
    isSavedWatchlistExportDocument,
    (document) => ({ version: document.version }),
    "Watchlist export unavailable",
  );
}
