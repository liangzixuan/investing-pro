import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

export interface ScreenPassReviewReportHtmlDocument {
  readonly purpose: "investment.screen-pass-review-html";
  readonly filename: string;
  readonly text: string;
  readonly byteLength: number;
}
export interface ScreenPassReviewReportDeliveryAdapter {
  readonly actionLabel?: string;
  deliver(
    document: ScreenPassReviewReportHtmlDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
