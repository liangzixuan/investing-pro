import type { TextDocumentDeliveryContext } from "./document-delivery";
import type { ManagedWatchlistDraftFileDocument } from "./managed-watchlist-draft-file";

export type ManagedWatchlistDraftFileDeliveryContext =
  TextDocumentDeliveryContext;
export type ManagedWatchlistDraftFileDeliveryResult =
  "download_requested" | "written" | "cancelled";

export interface ManagedWatchlistDraftFileDeliveryAdapter {
  deliver(
    document: ManagedWatchlistDraftFileDocument,
    context: ManagedWatchlistDraftFileDeliveryContext,
  ): Promise<ManagedWatchlistDraftFileDeliveryResult>;
}
