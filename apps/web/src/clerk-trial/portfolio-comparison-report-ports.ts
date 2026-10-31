import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

export interface PortfolioComparisonReportHtmlDocument {
  readonly purpose: "investment.portfolio-comparison-html";
  readonly filename: string;
  readonly text: string;
  readonly byteLength: number;
}

export interface PortfolioComparisonReportDeliveryAdapter {
  deliver(
    document: PortfolioComparisonReportHtmlDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
