import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

export interface ScreenComparisonReportHtmlDocument {
  readonly purpose: "investment.screen-comparison-html";
  readonly filename: string;
  readonly text: string;
  readonly byteLength: number;
}

export interface ScreenComparisonReportDeliveryAdapter {
  deliver(
    document: ScreenComparisonReportHtmlDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
