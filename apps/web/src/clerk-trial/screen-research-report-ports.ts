import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

export interface ScreenResearchReportHtmlDocument {
  readonly purpose: "investment.screen-research-html";
  readonly filename: string;
  readonly text: string;
  readonly byteLength: number;
}

export interface ScreenResearchReportDeliveryAdapter {
  readonly actionLabel?: string;
  deliver(
    document: ScreenResearchReportHtmlDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
