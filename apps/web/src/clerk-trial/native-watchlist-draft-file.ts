import { isManagedWatchlistDraftFileDocument } from "./managed-watchlist-draft-file";
import type { ManagedWatchlistDraftFileDeliveryAdapter } from "./managed-watchlist-draft-file-delivery";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export type InvestmentWatchlistDraftFilePlugin = NativeTextDocumentPlugin<{
  capturedAt: string;
  baseVersion: number;
}>;

export function createNativeWatchlistDraftFileAdapter(
  plugin: InvestmentWatchlistDraftFilePlugin,
): ManagedWatchlistDraftFileDeliveryAdapter {
  return createNativeTextDocumentDelivery(
    plugin,
    isManagedWatchlistDraftFileDocument,
    (document) => ({
      capturedAt: document.capturedAt,
      baseVersion: document.baseVersion,
    }),
    "Watchlist draft file unavailable",
  );
}
