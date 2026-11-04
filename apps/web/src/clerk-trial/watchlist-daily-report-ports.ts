import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

export interface WatchlistDailyReportHtmlDocument {
  readonly purpose: "investment.watchlist-daily-html";
  readonly filename: string;
  readonly text: string;
  readonly byteLength: number;
}

export interface WatchlistDailyReportDeliveryAdapter {
  readonly actionLabel?: string;
  deliver(
    document: WatchlistDailyReportHtmlDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
