import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

export interface PortfolioReviewReportHtmlDocument {
  readonly purpose: "investment.portfolio-review-html";
  readonly filename: string;
  readonly text: string;
  readonly byteLength: number;
}

export interface PortfolioReviewReportDeliveryAdapter {
  deliver(
    document: PortfolioReviewReportHtmlDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
