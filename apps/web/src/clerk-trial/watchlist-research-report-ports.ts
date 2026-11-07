import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

export interface WatchlistResearchReportHtmlDocument {
  readonly purpose: "investment.watchlist-research-html";
  readonly filename: string;
  readonly text: string;
  readonly byteLength: number;
}

export interface WatchlistResearchReportDeliveryAdapter {
  readonly actionLabel?: string;
  deliver(
    document: WatchlistResearchReportHtmlDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
