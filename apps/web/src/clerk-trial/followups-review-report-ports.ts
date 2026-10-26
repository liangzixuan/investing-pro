import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

export interface FollowupsReviewReportHtmlDocument {
  readonly purpose: "investment.followups-review-html";
  readonly filename: string;
  readonly text: string;
  readonly byteLength: number;
}
export interface FollowupsReviewReportDeliveryAdapter {
  deliver(
    document: FollowupsReviewReportHtmlDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
